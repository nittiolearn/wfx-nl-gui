(function() {

//-------------------------------------------------------------------------------------------------
// course_srv.js:
// Common functionality used in all the course controllers
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.course_srv', [])
    .service('nlCourse', CourseSrv);
}

//-------------------------------------------------------------------------------------------------
var CourseSrv = ['nl',
function(nl) {
    this.getActionUrl = function(actionId, urlParams) {
        if (!(actionId in _dashboardActions)) return null;
        var action = _dashboardActions[actionId];
        return nl.fmt2(action.url, urlParams);
    };

	var CURRENT_CONTENT_VERSION=5;
    this.migrateCourse = function(course) {
        if (!course.content) course.content = {};
        if (course.content.contentVersion == CURRENT_CONTENT_VERSION) return course;
        if (!course.content.modules) course.content.modules= [];
        for(var i=0; i<course.content.modules.length; i++) {
            var item = course.content.modules[i];
        	if(item.type == 'link' && item.urlParams.indexOf('course_cert') >= 0) {
            	item.type = 'certificate';
            	item.autocomplete =  true;
            	item.hide_remarks = true;
            	item.certificate_image = (course.content.certificate || {}).bg || '';
            }
            if(item.type == 'certificate') {
                // Not /#/course_cert as same URL (/) will not be loaded 
                // in iframe by some browser
                item.urlParams = '/default/home/#/course_cert';
                if (!item.certificate_format) item.certificate_format = 'default';
            }
            if (item.type == 'lesson' && !('isQuiz' in item)) item.isQuiz = true;
        }
        if (course.content.certificate) delete course.content.certificate;
        course.content.contentVersion = CURRENT_CONTENT_VERSION;
        if(!course.content.languages || course.content.languages.length == 0) course.content.languages = [{lang:'en', name: "English"}];
        return course;
    };

    var CURRENT_ATTENDANCE_VERSION = 1; //For course attendance version attendance register is 1 for now;
    this.getAttendanceVersion = function() {
        return CURRENT_ATTENDANCE_VERSION
    };

    this.migrateCourseAttendance = function(attendance) { 
        //old code attendance was attendance = {repid1: [sessionid1, sessionid2], repid2: [sessionid3, sessionid4], not_attended: {repid1:  [sessionid3, sessionid4]}}
        //new migration should be attendance = {version_register: 1, repid1: [{id: sessionid1, attId: attended, remarks: "some remarks"}, {id: sessionid2, attId: medical_leave, remarks: "some remarks"}]}
        if("attendance_version" in attendance) return attendance;
        var newAttendance = {};
        var attended = angular.copy(attendance);
        var not_attended = {};
        if ('not_attended' in attendance) {
            not_attended = angular.copy(attendance.not_attended);
            delete attended['not_attended'];
        }
        for(var key in attended) {
            var repid = parseInt(key);
			var attendedSessionsList = attendance[repid] || [];
           for(var k=0; k<attendedSessionsList.length; k++) {
                if(!(repid in newAttendance)) newAttendance[repid] = [];
                newAttendance[repid].push({id: attendedSessionsList[k], attId: 'attended', remarks: ''});
            }
        }

        for(var key in not_attended) {
            var repid = parseInt(key);
			var notAttendedSessionsList = not_attended[repid] || [];
            for(var k=0; k<notAttendedSessionsList.length; k++) {
                if(!(repid in newAttendance)) newAttendance[repid] = [];
                newAttendance[repid].push({id: notAttendedSessionsList[k], attId: 'not_attended', remarks: ''});
            }
           
        }
        return newAttendance;
    };

    this.isCourseReportCompleted = function(repObj) {
        if (!repObj.content || !repObj.content.modules) return false;
        var module_list = repObj.content.modules || [];
        if (module_list.length == 0) return false;
        var modules = {};
        for (var i=0; i<module_list.length; i++) modules[module_list[i].id] = module_list[i];
        var lastModule = module_list[module_list.length-1];
        var statusInfo = repObj.statusinfo || {};
        var lessonReports = repObj.lessonReports || {};
        return _getStatusOfModule(lastModule, modules, statusInfo, lessonReports);
    };

    var CURRENT_COURSE_SESSION_VERSION = 1; //For course attendance version attendance register is 1 for now;
    this.getSessionVersion = function() {
        return CURRENT_COURSE_SESSION_VERSION;
    };

    this.migrateModifiedILT = function(modifiedILT) {
        //Earlier the modifiedILT stored in the course assignment is of {_id0:480, _id1: 360};
        //Migrated version of modifiedILT is {_id0: {duration:480, url:'meeting link url', start: dateOBj, notes: ''}, _id1: {duration: 360, url: '', notes: '', start: dateOBJ}}
        if (!modifiedILT) return {};
        if (Object.keys(modifiedILT).length == 0) return modifiedILT;
        if (modifiedILT.session_version && modifiedILT.session_version == CURRENT_COURSE_SESSION_VERSION) return modifiedILT;
        var newModifiedILT = {session_version: CURRENT_COURSE_SESSION_VERSION};
        for (var key in modifiedILT) {
            newModifiedILT[key] = {duration: modifiedILT[key], url: null, notes: null, start: null};
        }
        return newModifiedILT;
    };

    this.getCheckListDialogParams = function(grpChecklist, checklist) {
        var ret = [];
        var allItemsChecked = true;
        for (var i=0; i<grpChecklist.length; i++) {
            var isFound = false;
            for (var j=0; j<checklist.length; j++) {
                if (grpChecklist[i] == checklist[j]) {
                    isFound = true;
                    break;
                }
            }
            if (!isFound) allItemsChecked = false;
            if (isFound) ret.push({selected: true, name: grpChecklist[i]});
            else ret.push({selected: false, name: grpChecklist[i]});
        }
        if (allItemsChecked) return null;
        var msg = '<div class="padding-mid fsh6">The course may not be ready for distribution as some of the checklists are not marked:</div>';
        for (var i=0; i<ret.length; i++) {
            var item = ret[i];
            msg += nl.t('<div class="row row-center margin0 padding-mid fsh6"><span><i class="icon {} black"></i><span class="padding-mid">{}</span></span></div>', item.selected ? 'ion-checkmark-circled' : 'ion-close-circled', item.name);
        }
        msg += '<div class="row row-center margin0 padding-mid fsh6">Are you sure you would like to go ahead assigning this course.</div>';
        return msg;
    };

	function _getStatusOfModule(module, modules, statusInfo, lessonReports, score) {
		if (score === undefined) score = null;
        if (module['type'] == 'certificate' || module['type'] == 'module' || 
            (module['type'] == 'link' && 'urlParams' in module && module['urlParams'].indexOf('course_cert') >= 0))  {
            var sa = 'start_after' in module ? module['start_after'] : [];
            for (var i=0; i<sa.length; i++) {
            	var info = sa[i];
                var pred = info['module'] in modules ? modules[info['module']] : null;
                if(!pred) continue;
                if (!_getStatusOfModule(pred, modules, statusInfo, lessonReports, info)) return false;
            }
            return true;
        } else if(module['type'] == 'lesson') {
            var info = module['id'] in lessonReports ? lessonReports[module['id']] : null;
            if (!info || !('completed' in info) || !(info['completed'])) return false;
            if (('selfLearningMode' in info) && info['selfLearningMode']) return true;
            var max_score = (score && ('max_score' in score)) ? score['max_score'] : 100;
            var min_score = (score && ('min_score' in score)) ? score['min_score'] : null;
            if (!min_score) min_score = info['passScore'] || 0;
            var percScore = 0;
            if (!('maxScore' in info) || !('score' in info) || (info['maxScore'] == 0)) 
            	percScore = 0;
            else
                percScore = 100.0*info['score']/info['maxScore'];
            if (percScore < min_score || percScore > max_score) return false;
            return true;
        }
        // info or link
        var info = module['id'] in statusInfo ? statusInfo[module['id']] : null;
        if (!info || (info['status'] != 'done')) return false;
        return true;
	}
}];

// Dashboard actions as defined in server side
var _dashboardActions = {
    // Generic actions; provided only for stop gap. A specific customizable
    // action will have to be defined to each generic action used as a stopgap
    'none': {'url': '{}', 'permission': '', 'termCheck': 'Open'},
    'logedin': {'url': '{}', 'permission': 'basic_access', 'termCheck': 'Open'},
    'restricted': {'url': '{}', 'permission': 'basic_access', 'termCheck': 'Restricted'},
    'authorized': {'url': '{}', 'permission': 'basic_access'},

    // Action with customizable urlParams
    'dashboard.home': {'url': '/#/home?{}', 'permission': 'basic_access', 'termCheck': 'Open'},
    'lesson.view': {'url': '/lesson/view/{}', 'permission': 'lesson_view'},
    'lesson.view_approved': {'url': '/#/lesson_list?type=approved&{}', 'permission': 'lesson_view'},
    'lesson.self_assign_list': {'url': '/#/lesson_list?type=selfassign&{}', 'permission': 'lesson_view'},
    'lesson.create': {'url': '/#/lesson_list?type=new&{}', 'permission': 'lesson_create'},
    'lesson.create2': {'url': '/lesson/create2/{}', 'permission': 'lesson_create'},
    'lesson.my': {'url': '/#/lesson_list?type=my&{}', 'permission': 'lesson_create'},
    'lesson.review': {'url': '/#/lesson_list?type=review&{}', 'permission': 'lesson_create'},
    'lesson.manage': {'url': '/#/lesson_list?type=manage&{}', 'permission': 'lesson_approve'},
    'lesson.translate': {'url': '/#/lesson_translate?{}', 'permission': 'lesson_create'},
    'lesson.importcsv': {'url': '/#/lesson_import?{}', 'permission': 'lesson_create'},
    'searchlist.view': {'url': '/#/searchlist_view?id={}', 'permission': 'basic_access'},
    'assign_desk.create': {'url': '/#/lesson_list?type=sendassignment&{}', 'permission': 'assignment_send'},
    'assign_desk.new': {'url': '/#/assignment?type=new&{}', 'permission': 'assignment_do', 'termCheck': 'Restricted'},
    'assign_desk.past': {'url': '/#/assignment?type=past&{}', 'permission': 'assignment_do', 'termCheck': 'Restricted'},
    'assign_desk.view': {'url': '/#/assignment?type=sent&{}', 'permission': 'assignment_send'},
    'assign_desk.manage': {'url': '/#/assignment?type=manage&{}', 'permission': 'assignment_manage'},
    'assign_desk.summary_report': {'url': '/#/learning_reports?type=module&{}', 'permission': 'assignment_send'},
    'assign_desk.active_users': {'url': '/#/learning_reports_completed_modules?{}', 'permission': 'assignment_manage'},
    'assign_desk.self_assign_report': {'url': '/#/learning_reports?type=module_self_assign&{}', 'permission': 'assignment_manage'},
    'assign_desk.shared': {'url': '/#/home', 'permission': 'admin_group'}, // Removed.
    'course.view': {'url': '/#/course_view?mode=published&{}', 'permission': 'basic_access'},
    'course.view_my': {'url': '/#/course_list?my=1&{}', 'permission': 'course_create'},
    'course.view_published': {'url': '/#/course_list?{}', 'permission': 'assignment_send'},
    'course.view_assigned': {'url': '/#/course_assign_list?{}', 'permission': 'assignment_manage'},
    'course.view_assigned_my': {'url': '/#/course_assign_my_list?{}', 'permission': 'assignment_send'},
    'course.view_assigned_suborg': {'url': '/#/course_assign_suborg_list?{}', 'permission': 'assignment_send'},
    'course.summary_report': {'url': '/#/learning_reports?type=course&{}', 'permission': 'assignment_send'},
    'course.do': {'url': '/#/course_report_list?my=1&{}', 'permission': 'course_do', 'termCheck': 'Restricted'},
    'learner.do': {'url': '/#/learner_view', 'permission': 'basic_access', 'termCheck': 'Restricted'},
    'learning_reports.user': {'url': '/#/learning_reports?type=user&{}', 'permission': 'assignment_send', 'termCheck': 'Restricted'},
    'sco.export': {'url': '/#/sco_export?{}', 'permission': 'sco_export'},
    'sco.offline_export': {'url': '/#/offline_export?{}', 'permission': 'sco_export'},
    'sco.import': {'url': '/#/sco_import_list?{}', 'permission': 'sco_import'}
};

module_init();
})();

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

	var CURRENT_CONTENT_VERSION=3;    
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
            }
        }
        if (course.content.certificate) delete course.content.certificate;
        course.content.contentVersion = CURRENT_CONTENT_VERSION;
        return course;		
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
    'assign_desk.user_report': {'url': '/#/assignment?type=new&{}', 'permission': 'assignment_do', 'termCheck': 'Restricted'},
    'assign_desk.shared': {'url': '/#/home', 'permission': 'admin_group'}, // Removed.
    'course.view': {'url': '/#/course_view?mode=published&{}', 'permission': 'basic_access'},
    'course.view_my': {'url': '/#/course_list?my=1&{}', 'permission': 'course_create'},
    'course.view_published': {'url': '/#/course_list?{}', 'permission': 'assignment_send'},
    'course.view_assigned': {'url': '/#/course_assign_list?{}', 'permission': 'assignment_manage'},
    'course.view_assigned_my': {'url': '/#/course_assign_my_list?{}', 'permission': 'assignment_send'},
    'course.summary_report': {'url': '/#/learning_reports?type=course&{}', 'permission': 'assignment_send'},
    'course.do': {'url': '/#/course_report_list?my=1&{}', 'permission': 'course_do', 'termCheck': 'Restricted'},
    'rno.list': {'url': '/#/rno_list?{}', 'permission': 'basic_access', 'termCheck': 'Restricted'},
    'rno.view': {'url': '/#/rno_view?{}', 'permission': '', 'termCheck': 'Open'},
    'sco.export': {'url': '/#/sco_export?{}', 'permission': 'sco_export'},
    'sco.import': {'url': '/#/sco_import_list?{}', 'permission': 'sco_import'}
};

module_init();
})();

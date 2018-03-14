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
    'searchlist.view': {'url': '/#/searchlist_view?id={}', 'permission': 'basic_access'},
    'assign_desk.create': {'url': '/#/lesson_list?type=sendassignment&{}', 'permission': 'assignment_send'},
    'assign_desk.new': {'url': '/#/assignment?type=new&{}', 'permission': 'assignment_do', 'termCheck': 'Restricted'},
    'assign_desk.past': {'url': '/#/assignment?type=past&{}', 'permission': 'assignment_do', 'termCheck': 'Restricted'},
    'assign_desk.view': {'url': '/#/assignment?type=sent&{}', 'permission': 'assignment_send'},
    'assign_desk.manage': {'url': '/#/assignment?type=manage&{}', 'permission': 'assignment_manage'},
    'assign_desk.summary_report': {'url': '/#/assignment_summary_report?{}', 'permission': 'assignment_send'},
    'assign_desk.user_report': {'url': '/#/assignment_user_report?{}', 'permission': 'basic_access'},
    'assign_desk.shared': {'url': '/#/home', 'permission': 'admin_group'}, // Removed.
    'course.view': {'url': '/#/course_view?mode=published&{}', 'permission': 'basic_access'},
    'course.view_my': {'url': '/#/course_list?my=1&{}', 'permission': 'course_create'},
    'course.view_published': {'url': '/#/course_list?{}', 'permission': 'assignment_send'},
    'course.view_assigned': {'url': '/#/course_assign_list?{}', 'permission': 'assignment_send'},
    'course.summary_report': {'url': '/#/course_summary_report?{}', 'permission': 'assignment_send'},
    'course.do': {'url': '/#/course_report_list?my=1&{}', 'permission': 'course_do', 'termCheck': 'Restricted'},
    'rno.list': {'url': '/#/rno_list?{}', 'permission': 'basic_access', 'termCheck': 'Restricted'},
    'rno.view': {'url': '/#/rno_view?{}', 'permission': '', 'termCheck': 'Open'},
    'sco.export': {'url': '/#/sco_export?{}', 'permission': 'sco_export'},
    'sco.import': {'url': '/#/sco_import_list?{}', 'permission': 'sco_import'}
};

module_init();
})();

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
var CourseSrv = ['nl', 'nlServerApi',
function(nl, nlServerApi) {
	// TODO - cache output and use from cache when possible
    this.courseGetList = function(data) {
    	return nlServerApi.courseGetList(data);
    };

    this.courseGet = function(courseId, published) {
    	return nlServerApi.courseGet(courseId, published);
    };
    
    this.courseCreate = function(data) {
    	return nlServerApi.courseCreate(data);
    };
    
    this.courseModify = function(data) {
    	return nlServerApi.courseModify(data);
    };
    
    this.courseDelete = function(courseId) {
    	return nlServerApi.courseDelete(courseId);
    };
    
    this.courseUnpublish = function(courseId) {
    	return nlServerApi.courseUnpublish(courseId);
    };

    this.courseAssignmentDelete = function(assignId) {
    	return nlServerApi.courseAssignmentDelete(assignId);
    };
    
	this.courseGetAssignmentList = function(data) {
    	return nlServerApi.courseGetAssignmentList(data);
	};
	
    this.courseGetAssignmentReportList = function(data) {
        return nlServerApi.courseGetAssignmentReportList(data);
    };
    
    this.courseGetAssignmentReportSummary = function(data) {
        return nlServerApi.courseGetAssignmentReportSummary(data);
    };
    
	this.courseGetMyReportList = function(data) {
    	return nlServerApi.courseGetMyReportList(data);
	};
	
	this.courseGetReport = function(repid, mine) {
    	return nlServerApi.courseGetReport(repid, mine);
	};
	
	this.courseReportUpdateStatus = function(repid, statusinfo) {
    	return nlServerApi.courseReportUpdateStatus(repid, statusinfo);
	};

    this.courseCreateLessonReport = function(repid, refid, moduleid, attempt) {
        return nlServerApi.courseCreateLessonReport(repid, refid, moduleid, attempt);
    };
    
    this.getActionUrl = function(actionId, urlParams) {
        if (!(actionId in _dashboardActions)) return null;
        var action = _dashboardActions[actionId];
        return nl.fmt2(action.url, urlParams);
    };
    
    this.getApprovedList = function(){
    	var data = {};
    	return nlServerApi.lessonGetApprovedList(data);
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
    'lesson.create': {'url': '/#/lesson_list?type=new&{}', 'permission': 'lesson_create'},
    'lesson.create2': {'url': '/lesson/create2/{}', 'permission': 'lesson_create'},
    'lesson.my': {'url': '/#/lesson_list?type=my&{}', 'permission': 'lesson_create'},
    'lesson.review': {'url': '/#/lesson_list?type=review&{}', 'permission': 'lesson_review'},
    'lesson.manage': {'url': '/#/lesson_list?type=manage&{}', 'permission': 'lesson_approve'},
    'searchlist.view': {'url': '/#/searchlist_view?id={}', 'permission': 'basic_access'},
    'assign_desk.create': {'url': '/#/lesson_list?type=sendassignment&{}', 'permission': 'assignment_send'},
    'assign_desk.new': {'url': '/#/assignment?type=new&{}', 'permission': 'assignment_do', 'termCheck': 'Restricted'},
    'assign_desk.past': {'url': '/#/assignment?type=past&{}', 'permission': 'assignment_do', 'termCheck': 'Restricted'},
    'assign_desk.view': {'url': '/#/assignment?type=sent&{}', 'permission': 'assignment_send'},
    'assign_desk.manage': {'url': '/#/assignment?type=manage&{}', 'permission': 'assignment_manage'},
    'assign_desk.summary_report': {'url': '/#/assignment_summary_report?{}', 'permission': 'assignment_manage'},
    'assign_desk.user_report': {'url': '/#/assignment_user_report?{}', 'permission': 'basic_access'},
    'assign_desk.shared': {'url': '/#/assignment?type=shared&{}', 'permission': 'basic_access'},
    'course.view': {'url': '/#/course_view?mode=published&{}', 'permission': 'basic_access'},
    'course.view_my': {'url': '/#/course_list?my=1&{}', 'permission': 'course_create'},
    'course.view_published': {'url': '/#/course_list?{}', 'permission': 'course_review'},
    'course.view_assigned': {'url': '/#/course_assign_list?{}', 'permission': 'course_review'},
    'course.do': {'url': '/#/course_report_list?my=1&{}', 'permission': 'course_do', 'termCheck': 'Restricted'},
    'rno.list': {'url': '/#/rno_list?{}', 'permission': 'basic_access', 'termCheck': 'Restricted'},
    'rno.view': {'url': '/#/rno_view?{}', 'permission': '', 'termCheck': 'Open'},
    'sco.export': {'url': '/#/sco_export?{}', 'permission': 'lesson_approve'},
    'sco.import': {'url': '/#/sco_import_list?{}', 'permission': 'lesson_approve'}
};

module_init();
})();

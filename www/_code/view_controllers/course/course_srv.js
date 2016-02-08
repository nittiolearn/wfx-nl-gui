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
	
	this.courseGetMyReportList = function(data) {
    	return nlServerApi.courseGetMyReportList(data);
	};
	
	this.courseGetReport = function(repid, mine) {
    	return nlServerApi.courseGetReport(repid, mine);
	};
	
	this.courseReportUpdateStatus = function(repid, statusinfo) {
    	return nlServerApi.courseReportUpdateStatus(repid, statusinfo);
	};

    this.courseCreateLessonReport = function(repid, refid, moduleid) {
        return nlServerApi.courseCreateLessonReport(repid, refid, moduleid);
    };
    
    this.getActionUrl = function(actionId, urlParams) {
        if (!(actionId in _dashboardActions)) return null;
        var action = _dashboardActions[actionId];
        return nl.fmt2(action.url, urlParams);
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
    'lesson.view_approved': {'url': '/lesson/search?{}', 'permission': 'basic_access'},
    'lesson.create2': {'url': '/lesson/create2/{}', 'permission': 'lesson_create'},
    'lesson.my': {'url': '/lesson/my?{}', 'permission': 'lesson_create'},
    'lesson.review': {'url': '/lesson/review/1?{}', 'permission': 'lesson_review'},
    'searchlist.view': {'url': '/#/searchlist_view?id={}', 'permission': 'basic_access'},
    'assign_desk.new': {'url': '/assignment/assigned_to_me?{}', 'permission': 'assignment_do', 'termCheck': 'Restricted'},
    'assign_desk.past': {'url': '/assignment/assigned_to_me/past?{}', 'permission': 'assignment_do', 'termCheck': 'Restricted'}
};

module_init();
})();

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
    this.courseGetList = function(mine) {
    	return nlServerApi.courseGetList(mine);
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
    
    this.assignmentDelete = function(courseId) {
    	return nlServerApi.assignmentDelete(courseId);
    };
    
    this.courseUnpublish = function(courseId) {
    	return nlServerApi.courseUnpublish(courseId);
    };

	this.courseGetAssignmentList = function(mine) {
    	return nlServerApi.courseGetAssignmentList(mine);
	};
	
	this.courseGetAssignmentReportList = function(assignid) {
    	return nlServerApi.courseGetAssignmentReportList(assignid);
	};
	
	this.courseGetMyReportList = function() {
    	return nlServerApi.courseGetMyReportList();
	};
	
	this.courseGetReport = function(repid, mine) {
    	return nlServerApi.courseGetReport(repid, mine);
	};

    this.courseCreateLessonReport = function(repid, refid) {
        return nlServerApi.courseCreateLessonReport(repid, refid);
    };

}];

module_init();
})();

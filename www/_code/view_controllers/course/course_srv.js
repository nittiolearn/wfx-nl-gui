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

    this.courseCreateLessonReport = function(repid, refid) {
        return nlServerApi.courseCreateLessonReport(repid, refid);
    };

}];

module_init();
})();

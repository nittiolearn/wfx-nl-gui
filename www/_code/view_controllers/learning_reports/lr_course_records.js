(function() {

//-------------------------------------------------------------------------------------------------
// lr_course_records.js: Process and store a list of db.course records
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.lr_course_records', [])
	.config(configFn)
	.service('nlLrCourseRecords', NlLrCourseRecords);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
}];

var NlLrCourseRecords = ['nl', 'nlCourse', 'nlLrFilter',
function(nl, nlCourse, nlLrFilter) {

    var _records = {};
    
	this.init = function() {
		_records = {};
	};

    this.wasFetched = function(cid) {
    	return (cid in _records) ? true : false;
    };
    
    this.addRecord = function(course, cid) {
    	_records[cid] = course;
    };
    
    this.getContentOfCourseAssignment = function() {
    	if(nlLrFilter.getType() != 'course_assign') return null;
    	for (var cid in _records) return _records[cid].content;
    	return null;
    };
    
    this.getRecord = function(cid) {
    	return _records[cid];
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

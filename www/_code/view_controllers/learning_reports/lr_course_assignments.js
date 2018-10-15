(function() {

//-------------------------------------------------------------------------------------------------
// lr_course_assignment_records.js: Process and store a list of db.course_assignment records
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.lr_course_assignments', [])
	.config(configFn)
	.service('nlLrCourseAssignmentRecords', NlLrCourseAssignmentRecords);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
}];

var NlLrCourseAssignmentRecords = ['nl', 'nlCourse', 'nlLrFilter',
function(nl, nlCourse, nlLrFilter) {

    var _records = {};
	this.init = function() {
		_records = {};
	};

    this.wasFetched = function(key) {
    	return (key in _records) ? true : false;
    };
    
    this.addRecord = function(courseAssign, key) {
    	_records[key] = courseAssign;
    };
    
    this.getRecord = function(key) {
    	return _records[key];
    };
    
    this.updateAttendanceInRecord = function(key, attendance) {
    	_records[key].attendance = attendance;
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

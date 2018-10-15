(function() {

//-------------------------------------------------------------------------------------------------
// lr_assignment_records.js: Process and store a list of db.course_assignment, db.assignment records
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.lr_assignments', [])
	.config(configFn)
	.service('nlLrAssignmentRecords', NlLrAssignmentRecords);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
}];

var NlLrAssignmentRecords = ['nl', 'nlCourse', 'nlLrFilter',
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

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
    
    this.addRecord = function(assign, key) {
    	_records[key] = assign;
    };
    
    this.getRecord = function(key) {
    	return _records[key];
    };
    
    // Same is available in server side too (needs to be updated in the same way) - see ncourse.overrideAssignmentParameterInReport
    this.overrideAssignmentParameterInReport = function(report, repcontent) {
		var table = report.ctype == _nl.ctypes.CTYPE_COURSE ? 'course_assignment:' : 'assignment:';
        var assignInfo = this.getRecord(table+report.assignment);
        if (!assignInfo) return;
		if (report.ctype == _nl.ctypes.CTYPE_COURSE) assignInfo = assignInfo.info;
        if (!assignInfo) return;

        repcontent.batchname = (report.assigntype == _nl.atypes.ATYPE_TRAINING ? repcontent.trainingName : 
        	assignInfo ? assignInfo.batchname : repcontent.batchname) || '';
        repcontent.not_before = assignInfo.not_before;
        repcontent.not_after = assignInfo.not_after || '';
        repcontent.submissionAfterEndtime = assignInfo.submissionAfterEndtime;
        	
		if (report.ctype == _nl.ctypes.CTYPE_COURSE) {
			_copyAttrsIf(assignInfo, repcontent, ['remarks'], ['']);
	        if (assignInfo.blended) _copyAttrsIf(assignInfo, repcontent, ['iltTrainerName', 'iltVenue', 'iltCostInfra', 'iltCostTrainer',
	        	'iltCostFoodSta', 'iltCostTravelAco', 'iltCostMisc'], ['', '', '', '', '', '', '']);
		} else {
	        _copyAttrsIf(assignInfo, repcontent, ['assign_remarks', 'max_duration', 'learnmode'], ['', undefined, undefined]);
		}
        return repcontent;
    };
    
    this.updateAttendanceInRecord = function(key, attendance) {
    	_records[key].attendance = attendance;
    };

	function _copyAttrsIf(src, dest, attrs, defVals) {
		for (var i=0; i<attrs.length; i++) {
			var attr = attrs[i];
			if (attr in src) dest[attr] = src[attr];
			else if (defVals[i] !== undefined) dest[attr] = defVals[i];
		}
	}
	
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

(function() {

//-------------------------------------------------------------------------------------------------
// getmany_store.js: To store assignment and course items which a report record depends on
// (i.e. records retreived by courseOrAssignGetMany)
// Bring all SubFetcher code here in future.
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.getmany_store', [])
    .service('nlGetManyStore', NlGetManyStore);
}

//-------------------------------------------------------------------------------------------------
var NlGetManyStore = ['nl',
function(nl) {
    var _records = null;
    this.init = function() {
        _records = {'assignment': {}, 'course_assignment': {}, 'course': {}};
    };
    this.init();

    this.key = function(table, id) {
        return {table: table, id: ''+id};
    };

    this.keyStr = function(key) {
        return nl.fmt2('{}:{}', key.table, key.id);
    };

    this.getAssignmentKeyFromReport = function(reportRecord) {
        if (!reportRecord.assignment) return null;
        var atype = reportRecord.assigntype || _nl.atypes.ATYPE_MODULE;
        if (atype == _nl.atypes.ATYPE_MODULE) return this.key('assignment', reportRecord.assignment);
        else if (atype == _nl.atypes.ATYPE_COURSE) return this.key('course_assignment', reportRecord.assignment);
        return null;
    };

    this.getContentKeyFromReport = function(reportRecord) {
        if (!reportRecord.lesson_id) return null;
        var ctype = reportRecord.ctype || _nl.ctypes.CTYPE_MODULE;
        if (ctype == _nl.ctypes.CTYPE_COURSE) return this.key('course', reportRecord.lesson_id);
        return null;
    };

    this.isFetchPending = function(key) {
        if (!key) return false;
        return !(key.id in _records[key.table]);
    };

    this.addRecord = function(key, record) {
        if (!key) return;
        _records[key.table][key.id] = record;
    };

    this.getRecord = function(key) {
        if (!key) return null;
        return _records[key.table][key.id] || null;
    };

    this.getAssignmentRecordFromReport = function(reportRecord) {
        var key = this.getAssignmentKeyFromReport(reportRecord);
        return this.getRecord(key);
    };

    this.getAnyRecord = function(table) {
        var records = _records[table];
		for (var itemid in records) return records[itemid];
    }

    // Same is available in server side too (needs to be updated in the same way) - see ncourse.overrideAssignmentParameterInReport
    this.overrideAssignmentParameterInReport = function(report, repcontent) {
        var key = this.getAssignmentKeyFromReport(report);
        var assignInfo = this.getRecord(key);
        if (!assignInfo) return;
		if (report.assigntype == _nl.atypes.ATYPE_COURSE) assignInfo = assignInfo.info;
        if (!assignInfo) return;

        repcontent.batchname = (report.assigntype == _nl.atypes.ATYPE_TRAINING 
            ? repcontent.trainingName : assignInfo.batchname) || '';
        repcontent.not_before = assignInfo.not_before;
        repcontent.not_after = assignInfo.not_after || '';
        repcontent.submissionAfterEndtime = assignInfo.submissionAfterEndtime;
        	
		if (report.ctype == _nl.ctypes.CTYPE_COURSE) {
			_copyAttrsIf(assignInfo, repcontent, ['remarks'], ['']);
	        if (assignInfo.blended) _copyAttrsIf(assignInfo, repcontent, ['iltTrainerName', 'iltVenue', 'iltCostInfra', 'iltCostTrainer',
	        	'iltCostFoodSta', 'iltCostTravelAco', 'iltCostMisc'], ['', '', '', '', '', '', '']);
		} else if (report.assigntype == _nl.atypes.ATYPE_COURSE) {
	        _copyAttrsIf(assignInfo, repcontent, ['remarks'], [''], ['assign_remarks']);
        } else {
	        _copyAttrsIf(assignInfo, repcontent, ['assign_remarks', 'max_duration', 'learnmode'], ['', undefined, undefined]);
		}
        return repcontent;
    };
    
    this.updateAttendanceInRecord = function(key, attendance) {
    	_records[key.table][key.id].attendance = attendance;
    };

    this.updateMilestoneInRecord = function(key, milestone) {
    	_records[key.table][key.id].milestone = milestone;
	};
	
	this.updateRatingInRecord = function(key, rating) {
    	_records[key.table][key.id].rating = rating;
	};

	function _copyAttrsIf(src, dest, attrs, defVals, destAttrs) {
        if (!destAttrs) destAttrs = attrs;
		for (var i=0; i<attrs.length; i++) {
			var attr = attrs[i];
			if (attr in src) dest[destAttrs[i]] = src[attr];
			else if (defVals[i] !== undefined) dest[attr] = defVals[i];
		}
	}

}];

function SubFetcher(nl, nlDlg, nlServerApi, nlGetManyStore) {
	var _pendingIds = {};
	var self=this;
	this.markForFetching = function(reportRecord) {
		var key = nlGetManyStore.getAssignmentKeyFromReport(reportRecord);
		if (nlGetManyStore.isFetchPending(key)) _pendingIds[nlGetManyStore.keyStr(key)] = true;
		key = nlGetManyStore.getContentKeyFromReport(reportRecord);
		if (nlGetManyStore.isFetchPending(key)) _pendingIds[nlGetManyStore.keyStr(key)] = true;
	};
	
	this.fetchPending = function() {
        return (Object.keys(_pendingIds).length > 0);
	};
	
	this.fetch = function(onDoneCallback) {
        var recordinfos = [];
        for (var key in _pendingIds) {
        	var parts = key.split(':');
        	recordinfos.push({table: parts[0], id: parseInt(parts[1])});
        }
        _fetchInBatchs(recordinfos, 0, onDoneCallback);
    };
    
    this.subfetchAndOverride = function(results, onDoneFunction) {
    	// Called from learner list views
		for(var i=0; i<results.length; i++) this.markForFetching(_getReportRecord(results[i]));
        if (!this.fetchPending()) return onDoneFunction(results);
        
        nl.timeout(function() {
        	nlDlg.showLoadingScreen();
	        self.fetch(function() {
	        	nlDlg.hideLoadingScreen();
	        	for(var i=0; i<results.length; i++) {
	        		nlGetManyStore.overrideAssignmentParameterInReport(_getReportRecord(results[i]), results[i]);
	        	}
	        	onDoneFunction(results);
	        });
        });
    };
    
    this.getSubFetchedCourseRecord = function(cid) {
    	// Called from learner list views
    	return nlGetManyStore.getRecord(nlGetManyStore.key('course', cid));
    };
    
    function _getReportRecord(repObj) {
    	var isCourseObj = 'courseid' in repObj; 
    	return {ctype: isCourseObj ? _nl.ctypes.CTYPE_COURSE : repObj.ctype,
			assigntype: isCourseObj ? _nl.atypes.ATYPE_COURSE : repObj.assigntype,
			assignment: isCourseObj ? repObj.assignid : repObj.assignment,
			lesson_id: isCourseObj ? repObj.courseid : repObj.lesson_id};
    }
    
    var MAX_PER_BATCH = 50;
    function _fetchInBatchs(recordinfos, startPos, onDoneCallback) {
        var newRecordInfo = [];
        var maxLen = recordinfos.length < startPos + MAX_PER_BATCH ? recordinfos.length : startPos + MAX_PER_BATCH;
        for(var i=startPos; i<maxLen; i++) newRecordInfo.push(recordinfos[i]);
        if (newRecordInfo.length == 0) {
            onDoneCallback(true);
            return;
        }
        nlServerApi.courseOrAssignGetMany(newRecordInfo).then(function(results) {
            for(var i=0; i<results.length; i++) {
                var resultObj = results[i];
                if (resultObj.error) {
                	nl.log.warn('Error fetching courseOrAssignGetMany object', resultObj);
                	continue;
                }
                if (resultObj.table == 'course_assignment') {
                	resultObj.info = angular.fromJson(resultObj.info);
                	if (resultObj.info.not_before) resultObj.info.not_before = nl.fmt.json2Date(resultObj.info.not_before); 
                	if (resultObj.info.not_after) resultObj.info.not_after = nl.fmt.json2Date(resultObj.info.not_after); 
                } else if (resultObj.table == 'assignment') {
                	if (resultObj.not_before) resultObj.not_before = nl.fmt.json2Date(resultObj.not_before); 
                	if (resultObj.not_after) resultObj.not_after = nl.fmt.json2Date(resultObj.not_after); 
                }
                var key = nlGetManyStore.key(resultObj.table, resultObj.id);
                nlGetManyStore.addRecord(key, resultObj);
                delete _pendingIds[nlGetManyStore.keyStr(key)];
            }
            startPos += results.length;
            _fetchInBatchs(recordinfos, startPos, onDoneCallback);
        }, function(error) {
            onDoneCallback(false);
        });
	}
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

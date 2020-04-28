(function() {

//-------------------------------------------------------------------------------------------------
// getmany_store.js: To store assignment and course items which a report record depends on
// (i.e. records retreived by courseOrAssignGetMany)
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.getmany_store', [])
    .service('nlGetManyStore', NlGetManyStore);
}

//-------------------------------------------------------------------------------------------------
var NlGetManyStore = ['nl', 'nlDlg', 'nlServerApi', 'nlGroupInfo',
function(nl, nlDlg, nlServerApi, nlGroupInfo) {
    var self = this;
    var _records = null;
    var _subFetcher = new SubFetcher(nl, nlDlg, nlServerApi, this);
    
    this.init = function() {
        _records = {'assignment': {}, 'course_assignment': {}, 'course': {}};
    };
    this.init();

    this.key = function(table, id) {
        return {table: table, id: ''+id};
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

    this.isKeyFound = function(key) {
        return (key.id in _records[key.table]);
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

    this.updateTrainerObjsInRecord = function(key, data) {
        // TODO-LATER: after v166: remove next 3 methods
        var record = _records[key.table][key.id];
    	record.attendance = angular.toJson(data.attendance);
    	record.rating = angular.toJson(data.rating);
    	record.milestone = angular.toJson(data.milestone);
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

    this.fetchReferredRecords = function(results, showLoadingScreen, onDoneFunction) {
        return _subFetcher.fetchReferredRecords(results, showLoadingScreen, onDoneFunction);
    };

    // Same is available in server side too (needs to be updated in the same way) - see ncourse.overrideAssignmentParametersInRepContent
    this.overrideAssignmentParametersInRepContent = function(report, repcontent) {
        var key = this.getAssignmentKeyFromReport(report);
        var assignInfo = this.getRecord(key);
        if (!assignInfo) return;
		if (report.assigntype == _nl.atypes.ATYPE_COURSE) assignInfo = assignInfo.info;
        if (!assignInfo) return;

        repcontent.batchname = assignInfo.batchname || '';
        if (assignInfo.batchtype) repcontent.batchtype = assignInfo.batchtype;
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
    
    function _copyAttrsIf(src, dest, attrs, defVals, destAttrs) {
        if (!destAttrs) destAttrs = attrs;
		for (var i=0; i<attrs.length; i++) {
			var attr = attrs[i];
			if (attr in src) dest[destAttrs[i]] = src[attr];
			else if (defVals[i] !== undefined) dest[attr] = defVals[i];
		}
    }
    var _msInfoCache = {};
    var _nhtBatchStatus = {};
    this.clearCache = function() {
        _msInfoCache = {};
        _nhtBatchStatus = {};
    }

    this.getNhtBatchStates = function() {
        return _nhtBatchStatus;
    }
    this.getBatchMilestoneInfo = function(reportRecord, nhtBatchStatus) {
        var courseAssignment = this.getAssignmentRecordFromReport(reportRecord) || {};
        var _batchStatus = nhtBatchStatus[reportRecord.assignment] || {};
        if (!courseAssignment.id) return {};
        if (courseAssignment.id in _msInfoCache) {
            var msInfo = _msInfoCache[courseAssignment.id];
            if(msInfo.batchStatus == 'Closed') _nhtBatchStatus.closed = true;
            else _nhtBatchStatus.running = true;
            return _msInfoCache[courseAssignment.id];
        }
        var ret = {batchStatus: ''};
        _msInfoCache[courseAssignment.id] = ret;

        var groupMsInfo = _getGroupMilestonesAsDict();
        var grpMilestoneDict = groupMsInfo.ret;
        var defaultBatchStatus = groupMsInfo.defaultBatchStatus;
        _updateBatchStatusWithDefaultStates(defaultBatchStatus, _batchStatus);
        if (!grpMilestoneDict) return ret;

        var course = this.getRecord(this.getContentKeyFromReport(reportRecord));
        var modules = course && course.content ? course.content.modules : null;
        if (!modules) return ret;

        var plannedMsInfo = courseAssignment.info ? courseAssignment.info.msDates : null;
        if (!plannedMsInfo) return ret;
        if (Object.keys(plannedMsInfo).length == 0) return ret;
        ret.batchStatus = 'Pending';
        
        var actualMsInfo = courseAssignment.milestone ? angular.fromJson(courseAssignment.milestone) : {};
        
        var allMilestonesReached = true;
        var firstMsUpdated = false;
        var lastPlanned = null;
        var lastActual = null;
        for(var i=0; i<modules.length; i++) {
            var item = modules[i]
            if(item.type != 'milestone') continue;
            var mstype = item.milestone_type;
            if(!mstype) continue;
            var plannedMs = plannedMsInfo['milestone_'+item.id] || '';
            var actualMs = actualMsInfo[item.id] || {};
            if (!firstMsUpdated) {
                firstMsUpdated = true;
                ret.firstPlanned = nl.fmt.json2Date(plannedMs || '', 'date');
                ret.firstActual = nl.fmt.json2Date(actualMs.reached || '', 'date');
            }
            ret[mstype+'planned'] = nl.fmt.date2StrDDMMYY(nl.fmt.json2Date(plannedMs || '', 'date'));
            lastPlanned = plannedMs;
            var grpMileStoneObj = grpMilestoneDict[mstype];
            if (!allMilestonesReached || !grpMileStoneObj) continue;

            if(grpMileStoneObj.batch_status && !(grpMileStoneObj.batch_status in _batchStatus)) {
                allMilestonesReached = false;
                continue;
            }
            if(!actualMs.reached || actualMs.status != 'done') {
                allMilestonesReached = false;
                continue;
            }
            lastActual = nl.fmt.json2Date(actualMs.reached || '', 'date');
            ret[mstype+'actual'] = nl.fmt.date2StrDDMMYY(nl.fmt.json2Date(actualMs.reached || '', 'date'));
            if (grpMileStoneObj && grpMileStoneObj.batch_status)
                ret.batchStatus = grpMileStoneObj.batch_status;
        }
        ret.lastPlanned = lastPlanned;
        ret.lastActual = lastActual;
        if (allMilestonesReached) {
            ret.batchStatus = 'Closed';
            _nhtBatchStatus.closed = true;
        } else {
            _nhtBatchStatus.running = true;
        }
        return ret;
    };

    function _updateBatchStatusWithDefaultStates(defaultBatchStatus, _batchStatus) {
        var status = angular.copy(_batchStatus);
        for (var key in status) {
            var index = defaultBatchStatus[key];
            _updateBatchStates(index, _batchStatus, defaultBatchStatus);
        }
    }

    function _updateBatchStates(index, _batchStatus, defaultBatchStatus) {
        for (var key in defaultBatchStatus) {
            if (defaultBatchStatus[key] < index) _batchStatus[key] = true;
        }
    }

    function  _getGroupMilestonesAsDict() {
        var groupInfo = nlGroupInfo.get();
        if (!groupInfo.props.milestones) return {ret: null, defaultBatchStatus: {}};
        var milestones = groupInfo.props.milestones;
        var ret = {};
        var defaultBatchStatus = {};
        for(var i=0; i<milestones.length; i++) {
            ret[milestones[i].id] = milestones[i];
            if (milestones[i].batch_status) defaultBatchStatus[milestones[i].batch_status] = i;
        }
        return {ret: ret, defaultBatchStatus: defaultBatchStatus};
    }

}];

function SubFetcher(nl, nlDlg, nlServerApi, nlGetManyStore) {
    var _pendingKeys = {};
    var _errorKeys = {};

	this.fetchReferredRecords = function(results, showLoadingScreen, onDoneFunction) {
        for (var i=0; i<results.length; i++) {
            _markKeyForFetching(nlGetManyStore.getAssignmentKeyFromReport(results[i]));
            _markKeyForFetching(nlGetManyStore.getContentKeyFromReport(results[i]));
        }
        if (Object.keys(_pendingKeys).length == 0) return onDoneFunction();

        var recordinfos = [];
        for (var keyStr in _pendingKeys) recordinfos.push(_pendingKeys[keyStr]);

        nl.timeout(function() {
        	if (showLoadingScreen) nlDlg.showLoadingScreen();
	        _fetchInBatchs(recordinfos, 0, function() {
	        	if (showLoadingScreen) nlDlg.hideLoadingScreen();
	        	onDoneFunction();
	        });
        });
    };
    
	function _markKeyForFetching(key) {
        var keyStr = _keyStr(key);
        if (!keyStr || keyStr in _errorKeys || nlGetManyStore.isKeyFound(key)) return;
		_pendingKeys[keyStr] = key;
	}

    function _keyStr(key) {
        if (!key) return null;
        return nl.fmt2('{}:{}', key.table, key.id);
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
                delete _pendingKeys[_keyStr(key)];
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

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
    var _updateNHTBatchStats = new UpdateBatch(nl, nlGroupInfo);
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
			nl.utils.copyAttrs(assignInfo, repcontent, ['remarks'], ['']);
	        if (assignInfo.blended) nl.utils.copyAttrs(assignInfo, repcontent, ['iltTrainerName', 'iltVenue', 'iltCostInfra', 'iltCostTrainer',
	        	'iltCostFoodSta', 'iltCostTravelAco', 'iltCostMisc'], ['', '', '', '', '', '', '']);
		} else if (report.assigntype == _nl.atypes.ATYPE_COURSE) {
	        nl.utils.copyAttrs(assignInfo, repcontent, ['remarks'], [''], ['assign_remarks']);
        } else {
	        nl.utils.copyAttrs(assignInfo, repcontent, ['assign_remarks', 'max_duration', 'learnmode'], ['', undefined, undefined]);
		}
        return repcontent;
    };
    
    this.clearCache = function() {
        _updateNHTBatchStats.clearCache();
    }

    this.getNhtBatchStates = function() {
        return _updateNHTBatchStats.getNhtBatchStates();
    };

    this.getTmsAssignmentInfo = function() {
        return _updateNHTBatchStats.getMsInfoCache();
    };

    this.getBatchInfo = function(reportRecord) { 
        var courseAssignment = self.getAssignmentRecordFromReport(reportRecord);
        if (!courseAssignment.id) return {};
        var _msInfoCache = _updateNHTBatchStats.getMsInfoCache();
        if (courseAssignment.id in _msInfoCache) {
            return _msInfoCache[courseAssignment.id];
        }
    };

    this.updateMilestoneBatchInfo = function(courseAssign, modules) {
        var _msInfoCache = _updateNHTBatchStats.getMsInfoCache();
        if (courseAssign.id in _msInfoCache) return;
        _updateNHTBatchStats.updateBatchInfo(modules, courseAssign);
    };
}];

function UpdateBatch(nl, nlGroupInfo) {
    var _groupMsInfo = undefined;
    var _msInfoCache = {};
    var _nhtBatchStatus = {};
    this.clearCache = function() {
        _msInfoCache = {};
        _nhtBatchStatus = {};
        _groupMsInfo = undefined;
    };

    this.getNhtBatchStates = function() {
        return _nhtBatchStatus;
    };

    this.getMsInfoCache = function() {
        return _msInfoCache;
    };

    this.updateBatchInfo = function(modules, courseAssign) {
        if (!modules) return null;
        if (_groupMsInfo === undefined) _groupMsInfo = _getGroupMilestonesAsDict();
        if (!_groupMsInfo) return null;
        var plannedMsInfo = courseAssign.info ? courseAssign.info.msDates : null;
        if (!plannedMsInfo || Object.keys(plannedMsInfo).length == 0) return null;
        var milestone = courseAssign.milestone ? angular.fromJson(courseAssign.milestone) : null;        

        var firstMsItemInCourse = null;
        var ret = {batchStatus: 'Pending', allMsMarked: true, modules: modules};
        for (var i=0; i<modules.length; i++) {
            var cm = modules[i];
            if (cm.type != 'milestone') continue;
            if(!cm.milestone_type) continue;
            if (!firstMsItemInCourse) firstMsItemInCourse = cm;
            _updatePlannedForMs(ret, cm, plannedMsInfo);
            if (!ret.allMsMarked) continue;
            var markedMilestoneObj = milestone[cm.id] || {}; //_id1: {status: done|pending, comment: 'Some remark', reached: reachedtime, learnersDict: {repid: {}}}
            if (!markedMilestoneObj.learnersDict) {
                _updateMsForNonEtmAsd(ret, cm, milestone);
                continue;
            }
            _updateMsForEtmAsd(ret, cm, milestone);
        }
        if (ret.batchStatus == 'Pending') {
            var mstype = firstMsItemInCourse.milestone_type;
            var ms = _groupMsInfo[mstype];
            if (ms && ms.batch_status) ret.batchStatus = ms.batch_status;
        }
        if (ret.allMsMarked || ret.batchStatus == 'Closed') {
            ret.batchStatus = 'Closed';
            _nhtBatchStatus.closed = true;
        } else {
            _nhtBatchStatus.running = true;
        }
        _msInfoCache[courseAssign.id] = ret;
        return ret;

    };

    function _updatePlannedForMs(ret, cm, plannedMsInfo) {
        var mstype = cm.milestone_type;
        var plannedMs = plannedMsInfo['milestone_'+cm.id] || '';
        ret[mstype+'planned'] = nl.fmt.date2StrDDMMYY(nl.fmt.json2Date(plannedMs || '', 'date'));
        if (!ret.firstPlanned) ret.firstPlanned = nl.fmt.json2Date(plannedMs || '', 'date');
        ret.lastPlanned = plannedMs;
    }

    function _updateMsForNonEtmAsd(ret, cm, milestone) {
        var mstype = cm.milestone_type;
        var markedMilestoneObj = milestone[cm.id] || {};
        if (markedMilestoneObj.status == 'done') {
            ret[mstype+'actual'] = markedMilestoneObj ? nl.fmt.date2StrDDMMYY(nl.fmt.json2Date(markedMilestoneObj.reached || '', 'date')) : '';
            if (ret.firstActual) ret.firstActual = nl.fmt.json2Date(markedMilestoneObj.reached || '', 'date');
            var grpMsObj = _groupMsInfo[mstype];
            if (grpMsObj && grpMsObj.batch_status) ret.batchStatus = grpMsObj.batch_status;
            ret.lastActual = markedMilestoneObj.reached;
        } else {
            ret.allMsMarked = false;
        }
    }

    function _updateMsForEtmAsd(ret, cm, milestone) {
        var mstype = cm.milestone_type;
        var markedObj = _getMarkedMsInfo(cm, milestone);
        if (markedObj.marked) {
            var grpMsObj = _groupMsInfo[mstype];
            if (grpMsObj && grpMsObj.batch_status) ret.batchStatus = grpMsObj.batch_status;
            ret[mstype+'actual'] = markedObj.markedOn ? nl.fmt.date2StrDDMMYY(nl.fmt.json2Date(markedObj.markedOn || '', 'date')) : '';
            ret.lastActual = markedObj.markedOn;
        } else {
            ret.allMsMarked = false;
        }
    }

    function _getMarkedMsInfo(cm, milestone) {
        var markedMilestone = milestone[cm.id] || {};
        var learnersDict = 'learnersDict' in markedMilestone ? markedMilestone['learnersDict'] : '';
        var msStats = {marked: false, markedOn: ''};
        var noLearnerMarked = true;
        for (var repid in learnersDict) {
            var msLearnerInfo = learnersDict[repid];
            if (msLearnerInfo.marked == 'done') {
                noLearnerMarked = false;
                msStats.marked = true;
                if (!msStats.markedOn || msStats.markedOn > msLearnerInfo.reached) msStats.markedOn = msLearnerInfo.reached;
            }
        }
        if (noLearnerMarked) {
            //Code to update ms if no learner marked.
            //If none of learner gone through recertification this case handled here
            if (markedMilestone.status == 'done') {
                msStats.marked = true;
                msStats.markedOn = markedMilestone.reached;
            }
        }
        return msStats;
    }

    function  _getGroupMilestonesAsDict() {
        var groupInfo = nlGroupInfo.get();
        if (!groupInfo.props.milestones) return null;
        var milestones = groupInfo.props.milestones;
        var ret = {};
        for(var i=0; i<milestones.length; i++) {
            ret[milestones[i].id] = milestones[i];
        }
        return ret;
    }

}

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

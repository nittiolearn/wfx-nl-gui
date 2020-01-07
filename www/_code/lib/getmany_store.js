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
    this.clearMsInfoCache = function() {
        _msInfoCache = {};
    }

    this.getBatchMilestoneInfo = function(reportRecord) {
        var courseAssignment = this.getAssignmentRecordFromReport(reportRecord) || {};
        if (!courseAssignment.id) return {};
        if (courseAssignment.id in _msInfoCache) return _msInfoCache[courseAssignment.id];
        var ret = {batchStatus: ''};
        _msInfoCache[courseAssignment.id] = ret;

        var grpMilestoneDict = _getGroupMilestonesAsDict();
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
        for(var i=0; i<modules.length; i++) {
            var item = modules[i]
            if(item.type != 'milestone') continue;
            var mstype = item.milestone_type;
            if(!mstype) continue;
            var plannedMs = plannedMsInfo['milestone_'+item.id] || '';
            var actualMs = actualMsInfo[item.id] || {};
            ret[mstype+'planned'] = nl.fmt.fmtDateDelta(plannedMs, null, 'minutes');
            ret[mstype+'actual'] = nl.fmt.fmtDateDelta(actualMs.reached || '', null, 'minutes');
            if (!actualMs.reached) allMilestonesReached = false;
            var grpMileStoneObj = grpMilestoneDict[mstype];
            if (actualMs.reached && grpMileStoneObj && grpMileStoneObj.batch_status)
                ret.batchStatus = grpMileStoneObj.batch_status;
        }
        if (allMilestonesReached) ret.batchStatus = 'Closed';
        return ret;
    };

    function  _getGroupMilestonesAsDict() {
        var groupInfo = nlGroupInfo.get();
        if (!groupInfo.props.milestones) return null;
        var milestones = groupInfo.props.milestones;
        var ret = {};
        for(var i=0; i<milestones.length; i++) ret[milestones[i].id] = milestones[i];
        return ret;
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

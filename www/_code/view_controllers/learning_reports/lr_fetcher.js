(function() {

//-------------------------------------------------------------------------------------------------
// lr_fetcher.js: Fetch db.report (and db.couse, db.training_kind, ... when needed) from the server (single instance)
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.lr_fetcher', [])
	.config(configFn)
	.service('nlLrFetcher', NlLrFetcher);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
}];

var NlLrFetcher = ['nl', 'nlDlg', 'nlServerApi', 'nlLrFilter', 'nlLrReportRecords', 'nlGetManyStore',
function(nl, nlDlg, nlServerApi, nlLrFilter, nlLrReportRecords, nlGetManyStore) {
	
    var self = this;
    var _pageFetcher = null;
    var _subFetcher = new SubFetcher(nl, nlDlg, nlServerApi, nlGetManyStore);
	var _limit = null;

	this.init = function() {
	    _pageFetcher = nlServerApi.getPageFetcher({defMax: 50, itemType: 'learning record'});
	    var params = nl.location.search();
		_limit = ('limit' in params) ? parseInt(params.limit) : 5000;
	};
	
	this.getSubFetcher = function() {
		// Used in learner list views to patchup assignment content on to report content
		// assignment.js (/#/assignment?type=new|past) and course_list.js (/#/course_report_list) for fetching needed assignment records
        nlGetManyStore.init();
		return _subFetcher;
	};
	
    this.canFetchMore = function() {
        return _pageFetcher.canFetchMore();
    };
    
    this.fetchInProgress = function(dontShowAlert) {
        if (!_pageFetcher.fetchInProgress()) return false;
        if (dontShowAlert) return true;
        nlDlg.popupAlert({title: 'Please wait', template: 'Currently feching data from server. You can initiate the next operation once the fetching is completed.'});
        return true;
    };

    this.fetchReports = function(fetchMore, onDoneCallback) {
        if (this.fetchInProgress()) {
            onDoneCallback(false);
            return;
        }
        _fetchReports(fetchMore, function(results) {
            if (!results) {
                onDoneCallback(false);
                return;
            }
            for (var i=0; i<results.length; i++) nlLrReportRecords.addRecord(results[i]);
            nlLrReportRecords.postProcessRecordsIfNeeded().then(function() {
	            onDoneCallback(results);
            });
        });
    };
    
    //-----------------------------------------------------------------------------------
    var _TEST_COPY_COUNT = 0; // TODO: Make sure this is always set to 0 before checking
    var _TEST_UNIQUE_REPROT_ID = 50000;
    function _testCopyResults(results) {
        if (_TEST_COPY_COUNT == 0) return;
        var resultsOrigLen = results.length;
        for(var i=0; i<resultsOrigLen; i++) {
            for (var j=0; j<_TEST_COPY_COUNT; j++) {
                var result = angular.copy(results[i]);
                result.id = _TEST_UNIQUE_REPROT_ID++;
                results.push(result);
            }
        }
    }

    //-----------------------------------------------------------------------------------
    function _fetchReports(fetchMore, onDoneCallback) {
    	var params = nlLrFilter.getServerParams();
    	var dontHideLoading = true;
        _pageFetcher.fetchBatchOfPages(nlServerApi.learningReportsGetList, params, fetchMore, 
        function(results, batchDone, promiseHolder) {
            if (!results) {
                onDoneCallback(false);
                return;
            }
            _testCopyResults(results);
            for(var i=0; i<results.length; i++) {
            	_subFetcher.markForFetching(results[i]);
            }

            if (_subFetcher.fetchPending()) {
                promiseHolder.promise = nl.q(function(resolve, reject) {
                    _subFetcher.fetch(function(result2) {
                        if (!result2) {
                            resolve(false);
                            onDoneCallback(false);
                            return;
                        }
                        resolve(true);
                        onDoneCallback(results);
                    });
                });
            } else {
                nl.timeout(function() {
                    onDoneCallback(results);
                });
            }
        }, _limit, dontHideLoading);
    }
    
    //-----------------------------------------------------------------------------------
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

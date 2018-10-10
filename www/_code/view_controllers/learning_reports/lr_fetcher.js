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

var NlLrFetcher = ['nl', 'nlDlg', 'nlServerApi', 'nlLrFilter', 'nlLrReportRecords', 'nlLrCourseRecords', 'nlLrCourseAssignmentRecords',
function(nl, nlDlg, nlServerApi, nlLrFilter, nlLrReportRecords, nlLrCourseRecords, nlLrCourseAssignmentRecords) {
	
    var self = this;
    var _pageFetcher = null;
    var _subFetcher = new SubFetcher(nlServerApi, nlLrCourseRecords, nlLrCourseAssignmentRecords);
	var _limit = null;

	this.init = function() {
	    _pageFetcher = nlServerApi.getPageFetcher({defMax: 50, itemType: 'course learning record'});
	    var params = nl.location.search();
		_limit = ('limit' in params) ? parseInt(params.limit) : 5000;
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
    function _fetchReports(fetchMore, onDoneCallback) {
    	var params = nlLrFilter.getServerParams();
    	var dontHideLoading = true;
        _pageFetcher.fetchBatchOfPages(nlServerApi.learningReportsGetList, params, fetchMore, 
        function(results, batchDone, promiseHolder) {
            if (!results) {
                onDoneCallback(false);
                return;
            }
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

function SubFetcher(nlServerApi, nlLrCourseRecords, nlLrCourseAssignmentRecords) {
	var _pendingCourseIds = {};
	var _pendingCourseAssignIds = {};
	
	this.markForFetching = function(reportRecord) {
    	if (reportRecord.ctype != _nl.ctypes.CTYPE_COURSE) return;
        var courseid = reportRecord.lesson_id;
        if (courseid && !nlLrCourseRecords.wasFetched(courseid)) _pendingCourseIds[courseid] = true;
        var courseAssignId = reportRecord.assignment;
        if (courseAssignId && !nlLrCourseAssignmentRecords.wasFetched(courseAssignId)) _pendingCourseAssignIds[courseAssignId] = true;
	};
	
	this.fetchPending = function() {
        return (Object.keys(_pendingCourseIds).length > 0 || Object.keys(_pendingCourseAssignIds).length > 0);
	};
	
	this.fetch = function(onDoneCallback) {
        var recordinfos = [];
        for (var cid in _pendingCourseIds) recordinfos.push({id: parseInt(cid),table: 'course'});
        for (var cid in _pendingCourseAssignIds) recordinfos.push({id: parseInt(cid), table: 'course_assignment'});
        _fetchInBatchs(recordinfos, 0, onDoneCallback);
   };

    var MAX_PER_BATCH = 50;
    function _fetchInBatchs(recordinfos, startPos, onDoneCallback) {
        var newRecordInfo = [];
        var maxLen = recordinfos.length < startPos + MAX_PER_BATCH ? recordinfos.length : startPos + MAX_PER_BATCH;
        for(var i=startPos; i<maxLen; i++) newRecordInfo.push(recordinfos[i]);
        if (newRecordInfo.length == 0) {
            onDoneCallback(true);
            return;
        }
        nlServerApi.courseOrCourseAssignGetMany(newRecordInfo).then(function(results) {
            for(var cid in results) {
            	cid = parseInt(cid);
                var course = results[cid];
                if (course.error) nl.log.warn('Error fetching course id', cid);
                if(course.type == 'course_assignment') {
                	nlLrCourseAssignmentRecords.addRecord(course, cid);
	                delete _pendingCourseAssignIds[cid];
                } else {
	                nlLrCourseRecords.addRecord(course, cid);
	                delete _pendingCourseIds[cid];
                }
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

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

var NlLrFetcher = ['nl', 'nlDlg', 'nlServerApi', 'nlLrFilter', 'nlLrReportRecords', 'nlLrCourseRecords',
function(nl, nlDlg, nlServerApi, nlLrFilter, nlLrReportRecords, nlLrCourseRecords) {
	
    var self = this;
    var _pageFetcher = null;
    var _pendingCourseIds = {};
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
                var courseid = results[i].lesson_id;
                if (!courseid || nlLrCourseRecords.wasFetched(courseid)) continue;
                _pendingCourseIds[courseid] = true;
            }

            if (Object.keys(_pendingCourseIds).length > 0) {
                promiseHolder.promise = nl.q(function(resolve, reject) {
                    _fetchCourses(function(result2) {
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
    function _fetchCourses(onDoneCallback) {
        var cids = [];
        for (var cid in _pendingCourseIds) cids.push(parseInt(cid));
        _fetchCoursesInBatchs(cids, 0, onDoneCallback);
    }

    var MAX_PER_BATCH = 50;
    function _fetchCoursesInBatchs(cids, startPos, onDoneCallback) {
        var courseIds = [];
        var maxLen = cids.length < startPos + MAX_PER_BATCH ? cids.length : startPos + MAX_PER_BATCH;
        for(var i=startPos; i<maxLen; i++) courseIds.push(cids[i]);
        if (courseIds.length == 0) {
            onDoneCallback(true);
            return;
        }
        nlServerApi.courseGetMany(courseIds, true).then(function(results) {
            for(var cid in results) {
            	cid = parseInt(cid);
                var course = results[cid];
                if (course.error) nl.log.warn('Error fetching course id', cid);
                nlLrCourseRecords.addRecord(course, cid);
                delete _pendingCourseIds[cid];
            }
            startPos += results.length;
            _fetchCoursesInBatchs(cids, startPos, onDoneCallback);
        }, function(error) {
            onDoneCallback(false);
        });
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

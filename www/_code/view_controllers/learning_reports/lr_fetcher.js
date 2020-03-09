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

var NlLrFetcher = ['nl', 'nlDlg', 'nlServerApi', 'nlLrFilter', 'nlLrReportRecords', 'nlGetManyStore', 'nlLrTransform', 'nlGroupInfo',
function(nl, nlDlg, nlServerApi, nlLrFilter, nlLrReportRecords, nlGetManyStore, nlLrTransform, nlGroupInfo) {
	
    var _pageFetcher = null;
    var _limit = null;

	this.init = function() {
	    _pageFetcher = nlServerApi.getPageFetcher({defMax: 500, itemType: 'learning record'});
	    var params = nl.location.search();
		_limit = ('limit' in params) ? parseInt(params.limit) : 100000;
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
	            onDoneCallback(true);
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
        params._jsMaxRetries = 3;
    	var dontHideLoading = true;
        _pageFetcher.fetchBatchOfPages(nlServerApi.learningReportsGetList, params, fetchMore, 
        function(results, batchDone, promiseHolder, rawResp) {
            if (!results) {
                nlDlg.popupAlert({title: 'Error', template: 'Error connecting to the server. Press the <i class="ion-refresh"></i> (fetch more) toolbar icon to resume fetching.'});
                onDoneCallback(false);
                return;
            }
            if (rawResp.transform) {
                var aoa = results;
                results = [];
                for (var i=0; i<aoa.length; i++)
                    results.push(nlLrTransform.lrArrayToObj(aoa[i]));
            }
            if (nlLrFilter.getMyOu()) results = _filterMyOus(results);
            _testCopyResults(results);
            promiseHolder.promise = nl.q(function(resolve, reject) {
                nlGetManyStore.fetchReferredRecords(results, false, function() {
                    resolve(true);
                    onDoneCallback(results);
                });
            });
        }, _limit, dontHideLoading);
    }

    function _filterMyOus(results) {
        var ret = [];
        var myOu = nlLrFilter.getMyOu();
        for (var i=0; i < results.length; i++) {
            var report = results[i];
            var user = nlGroupInfo.getUserObj(''+report.student);
            if (!user || !user.org_unit) continue;
            if (user.org_unit.indexOf(myOu) != 0) continue;
            ret.push(report);
        }
        return ret;
    }
    
    //-----------------------------------------------------------------------------------
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

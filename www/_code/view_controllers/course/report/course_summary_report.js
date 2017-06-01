(function() {

//-------------------------------------------------------------------------------------------------
// course_summary_report.js: Display and export course reports
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.course_summary_report', [])
	.config(configFn)
	.controller('nl.CourseReportSummaryCtrl', CourseReportSummaryCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.course_summary_report', {
		url: '^/course_summary_report',
		views: {
			'appContent': {
				templateUrl: 'view_controllers/course/report/course_summary_report.html',
				controller: 'nl.CourseReportSummaryCtrl'
			}
		}});
}];

//-------------------------------------------------------------------------------------------------
var CourseReportSummaryCtrl = ['nl', 'nlDlg', 'nlRouter', '$scope', 'nlServerApi', 
'nlProgressLog', 'nlExporter', 'nlRangeSelectionDlg',
function(nl, nlDlg, nlRouter, $scope, nlServerApi, nlProgressLog, 
    nlExporter, nlRangeSelectionDlg) {
    
    var _data = {urlParams: {}, fetchInProgress: false, canFetchMore: false,
        updatedFrom: null, updatedTill: null,
        courseRecords: {}, reportRecords: [], pendingCourseIds: {}};
    var _fetcher = new Fetcher(nl, nlDlg, nlServerApi, _data);

	function _onPageEnter(userInfo) {
        nlRangeSelectionDlg.init();
		return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Course summary report');
		    _initParams();
		    $scope.toolbar = _getToolbar();
            $scope.ui = {showDetails: true};
            $scope.data = _data;
            $scope.stats = {};
            _showRangeSelection(resolve);
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    function _initParams() {
        var params = nl.location.search();
        _data.urlParams.max = ('max' in params) ? parseInt(params.max) : 50;
        _data.urlParams.limit = ('limit' in params) ? parseInt(params.limit) : null;
        _data.urlParams.courseId = params.courseid || null;
    }

    function _getToolbar() {
        return [{
            title : 'Get reports for required date/time range',
            icon : 'ion-android-time',
            onClick : function() {
                _showRangeSelection(null);
            }
        }];
    }

    function _showRangeSelection(resolve) {
        if (_fetcher.isFetchInProgress()) return;
        nlRangeSelectionDlg.show($scope).then(function(dateRange) {
            if (!dateRange) {
                if (resolve) resolve(false);
                return;
            }
            _data.updatedFrom = dateRange.updatedFrom;
            _data.updatedTill = dateRange.updatedTill;
            _getDataFromServer(resolve);
        });
    }

    function _getDataFromServer(resolve) {
        _fetcher.fetch(function(result) {
            _updateScope();
            if (resolve) resolve(!result.isError);
            resolve = null;
        });
    }
    
    function _updateScope() {
        $scope.dataJson = angular.toJson(_data, 2);
        $scope.stats.repcount = _data.reportRecords.length;
        $scope.stats.courses = Object.keys(_data.courseRecords);
        $scope.stats.coursecount = $scope.stats.courses.length;
    }
}];

//-------------------------------------------------------------------------------------------------
function Fetcher(nl, nlDlg, nlServerApi, _data) {
    var self = this;
    
    this.isFetchInProgress = function() {
        if (!_data.fetchInProgress) return false;
        nlDlg.popupAlert('Already feching data from server. Please wait.');
        return true;
    };

    this.fetch = function(onDoneCallback) {
        if (this.isFetchInProgress()) {
            onDoneCallback({isError: true});
            return;
        }
        _data.fetchInProgress = true;

        _data.reportRecords = [];
        _data.pendingCourseIds = {};
        _data.reportFetchStartPos = null;

        _executeFunction(0, function(result) {
            if (result.isError) {
                _data.fetchInProgress = false;
                canFetchMore
                onDoneCallback(result);
                return;
            }
            if (result.fetchDone) _data.fetchInProgress = false;
            onDoneCallback(result);
        });
    };
    
    var functionList = [_fetchReports, _fetchCourses];
    function _executeFunction(pos, onDoneCallback) {
        functionList[pos](function(result) {
            if (result.isError) {
                onDoneCallback(result);
                return;
            }
            if (!result.fetchDone) {
                onDoneCallback(result);
                return;
            }
            pos++;
            if (pos < functionList.length) _executeFunction(pos, onDoneCallback);
            else onDoneCallback(result);
        });
    }

    //-----------------------------------------------------------------------------------
    function _fetchReports(onDoneCallback) {
        var params = {compact: true, startpos: _data.reportFetchStartPos,
            max: _data.urlParams.max, updatedfrom: _data.updatedFrom,
            updatedtill: _data.updatedTill};
        if (_data.urlParams.courseId) params.courseid = _data.urlParams.courseId;
        
        nlServerApi.batchFetch(nlServerApi.courseGetAllReportList, params, function(result) {
            if (result.isError) {
                onDoneCallback(result);
                return;
            }
            var records = result.resultset;
            for(var i=0; i<records.length; i++) {
                _data.reportRecords.push(records[i]);
                var courseid = records[i].courseid;
                if (courseid in _data.courseRecords) continue;
                _data.pendingCourseIds[courseid] = true;
            }

            onDoneCallback(result);
            if (!result.fetchDone) return;
            _data.canFetchMore = result.canFetchMore;
            _data.reportFetchStartPos = result.canFetchMore ? result.nextStartPos : null;
        }, _data.urlParams.limit, 'course learning record');
    }
    //-----------------------------------------------------------------------------------
    function _fetchCourses(onDoneCallback) {
        var cids = [];
        for (var cid in _data.pendingCourseIds) cids.push(parseInt(cid));
        _data.pendingCourseIds = {};
        _fetchCoursesInBatchs(cids, 0, onDoneCallback);
    }

    var MAX_PER_BATCH = 50;
    function _fetchCoursesInBatchs(cids, startPos, onDoneCallback) {
        var courseIds = [];
        var maxLen = cids.length < startPos + MAX_PER_BATCH ? cids.length : startPos + MAX_PER_BATCH;
        for(var i=startPos; i<maxLen; i++) courseIds.push(cids[i]);
        if (courseIds.length == 0) {
            nlDlg.popupStatus('');
            onDoneCallback({isError: false, fetchDone: true});
            return;
        }
        nlServerApi.courseGetMany(courseIds, true).then(function(result) {
            for(var i=0; i<result.length; i++) {
                var course = result[i];
                _data.courseRecords[course.id] = course;
            }
            startPos += result.length;
            nlDlg.popupStatus(nl.fmt2('Fetched {} of {} course objects from server.', startPos, cids.length), false);
            _fetchCoursesInBatchs(cids, startPos, onDoneCallback);
        }, function(error) {
            onDoneCallback({isError: true, errorMsg: error});
        });
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

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
        
    var _urlParams = {};
    var _assignRecords, _courseRecords, _reportRecords;

	function _onPageEnter(userInfo) {
        nlRangeSelectionDlg.init();
		return nl.q(function(resolve, reject) {
		    _initParams();
		    $scope.toolbar = _getToolbar();
            _showRangeSelection(resolve);
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    function _initParams() {
            var params = nl.location.search();
            _urlParams.max = ('max' in params) ? parseInt(params.max) : 50;
            _urlParams.limit = ('limit' in params) ? parseInt(params.limit) : null;
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
        nlRangeSelectionDlg.show($scope).then(function(dateRange) {
            if (!dateRange) {
                if (resolve) resolve(false);
                return;
            }
            nlDlg.showLoadingScreen();
            _getDataFromServer(dateRange, resolve);
        });
    }

    function _initRecords() {
        _assignRecords = [];
        _courseRecords = {};
        _reportRecords = [];
    }
    _initRecords();
    
    function _getDataFromServer(dateRange, resolve) {
        _assignRecords = [];
        _reportRecords = [];
        var params = {mine: false, compact: true,
            startpos: '', max: _urlParams.max, 
            updatedfrom: dateRange.updatedFrom, updatedtill: dateRange.updatedTill};
        nlServerApi.batchFetch(nlServerApi.courseGetAssignmentList, params, function(result) {
            if (result.isError) {
                if (resolve) resolve(false);
                return;
            }
            var records = result.resultset;
            for(var i=0; i<records.length; i++) _assignRecords.push(records[i]);
            $scope.assignRecords = angular.toJson(_assignRecords, 2);
            $scope.assignRecordsLen = _assignRecords.length;
            if (!result.fetchDone) return;
            if (resolve) resolve(true);
            nlDlg.hideLoadingScreen();
        }, _urlParams.limit);
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

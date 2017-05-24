(function() {

//-------------------------------------------------------------------------------------------------
// course_summary_report.js: Display and export course reports
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.course_summary_report', [])
	.config(configFn)
	.controller('nl.CourseReportCtrl', CourseReportSummaryCtrl);
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
	function _onPageEnter(userInfo) {
        nlRangeSelectionDlg.init();
		return nl.q(function(resolve, reject) {
            _showRangeSelection(resolve);
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    function _showRangeSelection(resolve) {
        nlRangeSelectionDlg.show($scope).then(function(data) {
            if (!data) {
                if (resolve) resolve(false);
                return;
            }
            nlDlg.showLoadingScreen();
            _getDataFromServer(data, resolve);
        });
    }

    function _getDataFromServer(data, resolve) {
        nlDlg.popupStatus('TODO - dummy waiting', false);
        nl.timeout(function() {
            nlDlg.popupStatus('TODO - dummy wait done');
            nlDlg.hideLoadingScreen();
        }, 5000);
    }
    
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

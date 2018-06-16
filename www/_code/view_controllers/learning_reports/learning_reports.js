(function() {

//-------------------------------------------------------------------------------------------------
// learning_reports.js: Common service to display different types of learning reports
// All other subservices defined in this folder (service names starting from nlLr***)
// are only used within this module.
// nl.LearningReportsCtrl: the controller implementing /#/learning_reports URL. It simply
// 						   delegates to nlLearningReports service.
// nlLearningReports: defined in this module is the overall controller of all sub-services
//					  defined in this folder. This manages the $scope and deligates other
//					  tasks to below sub servies.
//
// nlLrFilter:	Show learning report filter dialog and get the filter params towards the server (single instance)
// nlLrFetcher:	Fetch db.report (and db.couse, db.training_kind, ... when needed) from the server (single instance)
// nlReportRecords: Stores a list of db.report records fetched from server after processing (single instance)
// nlCourseRecords: Stores a list of db.course records fetched from server after processing (single instance)
// nlSummaryStats: Used to create a summary stats (multiple instances supported)
// nlLrExporter: Export learning report (single instance)
// nlLrHelper: Assorted helpers used across modules in this folder
//
// Dependancies within nlLearningReports (module can depend only on modules in any of below layers):
// nlLearningReports
//   nlLrFetcher, nlLrExporter
//     nlLrReportRecords
//       nlSummaryStats, nlLrCourseRecords
//         nlLrFilter
//           nlLrHelper
//
// n.lLrImportCtrl: the controller implemeting /#/lr_import (independant controller)

//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports', ['nl.learning_reports.lr_helper', 'nl.learning_reports.lr_filter', 
		'nl.learning_reports.lr_fetcher', 'nl.learning_reports.lr_exporter', 
		'nl.learning_reports.lr_report_records', 'nl.learning_reports.lr_course_records',
		'nl.learning_reports.lr_summary_stats', 'nl.learning_reports.lr_import'])
	.config(configFn)
	.controller('nl.LearningReportsCtrl', LearningReportsCtrl)
	.service('nlLearningReports', NlLearningReports);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.learning_reports', {
		url: '^/learning_reports',
		views: {
			'appContent': {
				templateUrl: 'view_controllers/learning_reports/learning_reports.html',
				controller: 'nl.LearningReportsCtrl'
			}
		}});
}];

var LearningReportsCtrl = ['$scope', 'nlLearningReports',
function($scope, nlLearningReports) {
	var reportView = nlLearningReports.create($scope);
	reportView.show();
}];
    
var NlLearningReports = ['nl', 'nlDlg', 'nlRouter', 'nlServerApi', 'nlGroupInfo', 'nlTable',
'nlLrHelper', 'nlLrFilter', 'nlLrFetcher', 'nlLrExporter', 'nlLrReportRecords', 'nlLrCourseRecords', 'nlLrSummaryStats',
function(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable,
	nlLrHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrCourseRecords, nlLrSummaryStats) {
    this.create = function($scope, settings) {
    	if (!settings) settings = {};
    	return new NlLearningReportView(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable,
			nlLrHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrCourseRecords, nlLrSummaryStats,
			$scope, settings);
    };
}];
    
//-------------------------------------------------------------------------------------------------
function NlLearningReportView(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable,
			nlLrHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrCourseRecords, nlLrSummaryStats,
			$scope, settings) {

    this.show = function() {
		nlRouter.initContoller($scope, '', _onPageEnter);
    };

	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
            nlGroupInfo.init().then(function() {
		        nlGroupInfo.update();
            	_init(userInfo);
            	resolve(true); // Has to be before next line for loading screen
            	_showRangeSelection();
            }, function(err) {
                resolve(false);
            });
		});
	}

	// Private members
    var _isAdmin = false;
    var _summaryStats = null;
    
    function _init(userInfo) {
	    _isAdmin = nlRouter.isPermitted(userInfo, 'admin_user');
	    // Order is important
        nlLrFilter.init(settings, userInfo);
        nlLrCourseRecords.init();
	    _summaryStats = nlLrSummaryStats.getSummaryStats();
        nlLrReportRecords.init(_summaryStats);
        nlLrFetcher.init();
        nlLrExporter.init(userInfo);
        nl.pginfo.pageTitle = nlLrFilter.getTitle();
        _initScope();
    }

    function _initScope() {
        $scope.toolbar = _getToolbar();
        $scope.metaHeaders = nlLrHelper.getMetaHeaders(true);
        $scope.ui = {showOrgCharts: true, showOrgs: true, showUsers: false};
        $scope.utable = {
            columns: _getUserColumns(),
            styleTable: 'nl-table-styled2 compact',
            onRowClick: 'expand',
            detailsTemplate: 'view_controllers/learning_reports/learning_report_details.html',
            clickHandler: _userRowClickHandler,
            metas: nlLrHelper.getMetaHeaders(false)
        };
        nlTable.initTableObject($scope.utable);
        $scope.otable = {
            columns: _getOrgColumns(),
            styleTable: 'nl-table-styled2 compact',
            getSummaryRow: _getOrgSummaryRow
        };
        nlTable.initTableObject($scope.otable);
        _initChartData();
    }
    
    function _getUserColumns() {
        var columns = [];
        columns.push({id: 'user.user_id', name: 'User Id', smallScreen: true});
        columns.push({id: 'user.org_unit', name: 'Org'});
        var mh = nlLrHelper.getMetaHeaders(true);
        for(var i=0; i<mh.length; i++) {
            columns.push({id: 'usermd.' + mh[i].id, name: mh[i].name});
        }
        if (!nlLrFilter.getObjectId()) {
            columns.push({id: 'course.name', name: 'Course', mediumScreen: false});
        }
        columns.push({id: 'stats.status.txt', name: 'Status', smallScreen: true, 
            icon: 'stats.status.icon'});
        columns.push({id: 'stats.percCompleteStr', name: 'Progress', mediumScreen: false,
            styleTd: 'text-right'});

        // Only search and details relevant columns
        columns.push({id: 'user.name', name: 'User Name', searchKey: 'username', 
            smallScreen: false, mediumScreen: false, largeScreen: false});
        columns.push({id: 'user.email', name: 'Email Id', searchKey: 'email', 
            smallScreen: false, mediumScreen: false, largeScreen: false});
        columns.push({id: 'user.username', name: 'Login Id', searchKey: 'login', 
            smallScreen: false, mediumScreen: false, largeScreen: false});
        return columns;
    }
    
    function _userRowClickHandler(rec, action) {
        if (action == 'delete') {
            return _deleteReport(rec);
        }
    }
    
    function _deleteReport(report) {
        var template = nl.t('Once deleted, you will not be able to recover this report. Are you sure you want to delete this report?');
        nlDlg.popupConfirm({title: 'Please confirm', template: template,
            okText : nl.t('Delete')}).then(function(res) {
            if (!res) return;
            var repid = report._raw.raw_record.id;
            nlDlg.showLoadingScreen();
            nlServerApi.courseReportDelete(repid).then(function(statusInfo) {
                nlDlg.hideLoadingScreen();
                nlLrReportRecords.removeRecord(repid);
                _updateScope();
            });
        });
    }
            
    function _getOrgColumns() {
        var columns = [];
        var mh = nlLrHelper.getMetaHeaders(true);
        columns.push({id: 'org', name: 'Org', smallScreen: true});
        for(var i=0; i<mh.length; i++) {
            columns.push({id: mh[i].id, name: mh[i].name});
        }
        columns.push({id: 'percStr', name: 'Completion', smallScreen: true, searchable: false, styleTd: 'text-right'});
        columns.push({id: 'assigned', name: 'Assigned', searchable: false, styleTd: 'text-right'});
        columns.push({id: 'done', name: 'Done', searchable: false, styleTd: 'text-right'});
        columns.push({id: 'failed', name: 'Failed', searchable: false, styleTd: 'text-right'});
        columns.push({id: 'started', name: 'Started', searchable: false, styleTd: 'text-right'});
        columns.push({id: 'pending', name: 'Pending', searchable: false, styleTd: 'text-right'});
        return columns;
    }

    function _getOrgSummaryRow(records) {
        var summaryRecord = {'org': {txt: 'Overall'}};
        var assigned = 0;
        var done = 0;
        var failed = 0;
        var started = 0;
        var pending = 0;
        for (var i=0; i<records.length; i++) {
            var rec = records[i];
            if (!rec.passesFilter) continue;
            assigned += rec.assigned;
            done += rec.done;
            failed += rec.failed;
            started += rec.started;
            pending += rec.pending;
        }

        summaryRecord['percStr'] = {txt: assigned > 0 ? Math.round(done/assigned*100) + ' %': ''};
        summaryRecord['assigned'] = {txt: assigned};
        summaryRecord['done'] = {txt: done};
        summaryRecord['failed'] = {txt: failed};
        summaryRecord['started'] = {txt: started};
        summaryRecord['pending'] = {txt: pending};

        _updateChartData(summaryRecord);
        return summaryRecord;
    }

    function _getToolbar() {
        return [{
            title : 'Fetch more records in the currently selected date time range',
            icon : 'ion-refresh',
            id: 'tbfetchmore',
            onClick : _fetchMore
        }, {
            title : 'Modify the date/time range and fetch records',
            icon : 'ion-android-time',
            id: 'tbfilter',
            onClick : _showRangeSelection
        }, {
            title : 'Export report',
            icon : 'ion-ios-cloud-download',
            id: 'export',
            onClick : _onExport
        }];
    }
    
    $scope.canShowToolbarIcon = function(tbid) {
        if (nlLrFetcher.fetchInProgress(true)) return false;
        if (tbid == 'tbfetchmore') return nlLrFetcher.canFetchMore();
        if (tbid == 'tbfilter') return nlLrFilter.isFilterShown();
        return true;
    };
    
    function _showRangeSelection() {
        if (nlLrFetcher.fetchInProgress()) return;
        nlLrFilter.show($scope).then(function(status) {
            if (!status) return;
            nlLrReportRecords.reset();
            _updateTimeRangeStr();
            _getDataFromServer();
        });
    }
    
    function _updateTimeRangeStr() {
        $scope.filterStr = nlLrFilter.getFilterStr();
    }
    
    function _fetchMore() {
        if (nlLrFetcher.fetchInProgress()) return;
        _getDataFromServer(true);
    }

    function _getDataFromServer(fetchMore) {
    	nlDlg.showLoadingScreen();
        nlLrFetcher.fetchReports(fetchMore, function(result) {
	    	nlDlg.hideLoadingScreen();
            _updateScope();
        });
    }
    
    function _updateScope() {
        nl.pginfo.pageTitle = nlLrFilter.getTitle();
        nl.pginfo.pageSubTitle = nlLrFilter.getSubTitle();
        
        $scope.fetchInProgress = nlLrFetcher.fetchInProgress(true);
        $scope.canFetchMore = nlLrFetcher.canFetchMore();
        
        var reportAsList = nlLrReportRecords.asList();
        $scope.noDataFound = (reportAsList.length == 0);
        nlTable.updateTableObject($scope.utable, reportAsList);
        nlTable.updateTableObject($scope.otable, _summaryStats.asList());
    }

    function _initChartData() {
        var labels =  ['done', 'failed', 'started', 'pending'];
        var colors = ['#007700', '#770000', '#FFCC00', '#A0A0C0'];

        $scope.charts = [{
            type: 'doughnut',
            title: 'Progress',
            data: [0, 0, 0, 0],
            labels: labels,
            colors: colors
        },
        {
            type: 'line',
            title: 'Updates over time',
            data: [[]],
            labels: [],
            series: ['S1'],
            colors: colors
        }];
    }
    
    function _updateChartData(summaryRecord) {
        _updateProgressChartData(summaryRecord);
        _updateTimeChartData();
        nl.timeout(function() {
            _updateProgressChartData(summaryRecord);
            _updateTimeChartData();
        });
    }
    
    function _updateProgressChartData(summaryRecord) {
        var c = $scope.charts[0];
        c.data = [summaryRecord.done.txt, summaryRecord.failed.txt, summaryRecord.started.txt, summaryRecord.pending.txt];
        c.title = nl.t('Progress: {} of {} done', summaryRecord.done.txt, summaryRecord.assigned.txt);
    }
        
    function _updateTimeChartData() {
        var c = $scope.charts[1];
        var ranges = nlLrReportRecords.getTimeRanges();
        
        var reportRecords = nlLrReportRecords.getRecords();
        for(var key in reportRecords) {
            var rec = reportRecords[key];
            var orgEntry = _summaryStats.getOrgEntry(rec);
            if (!orgEntry || !orgEntry.passesFilter) continue;
            for(var i=0; i<ranges.length; i++) {
                if (rec.raw_record.updated >= ranges[i].end) continue;
                ranges[i].count++;
                break;
            }
        }
        
        c.labels = [];
        c.data = [[]];
        for (var i=0; i<ranges.length; i++) {
            var r = ranges[i];
            c.labels.push(r.label);
            c.data[0].push(r.count);
        }
    }
    
    function _onExport() {
        if (nlLrFetcher.fetchInProgress()) return;
		var reportRecords = nlLrReportRecords.asList();
        nlLrExporter.export($scope, reportRecords, _isAdmin);
    }
};

//-------------------------------------------------------------------------------------------------
module_init();
})();

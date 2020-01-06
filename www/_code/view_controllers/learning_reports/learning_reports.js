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
// nlAssignmentRecords: Stores a list of db.course_assignment and db.assignment records fetched from server after processing (single instance)
// nlSummaryStats: Used to create a summary stats (multiple instances supported)
// nlLrExporter: Export learning report (single instance)
// nlLrHelper: Assorted helpers used across modules in this folder
//
// Dependancies within nlLearningReports (module can depend only on modules in any of below layers):
// nlLearningReports
//   nlLrFetcher, nlLrExporter
//     nlLrReportRecords
//       nlSummaryStats
//         nlLrFilter
//           nlLrHelper
//
// All modules under "others" folder is for generating other kinds of reports.
// n.lLrImportCtrl: the controller implemeting /#/lr_import (independant controller)

//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports', ['nl.learning_reports.lr_helper', 'nl.learning_reports.lr_filter', 
		'nl.learning_reports.lr_transform', 'nl.learning_reports.lr_fetcher', 'nl.learning_reports.lr_exporter', 
		'nl.learning_reports.lr_report_records', 'nl.learning_reports.lr_summary_stats', 'nl.learning_reports.lr_import',
		'nl.learning_reports.lr_drilldown', 'nl.learning_reports.lr_nht_srv',
		'nl.learning_reports.others.lr_completed_modules'])
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
	
var NlLearningReports = ['nl', 'nlDlg', 'nlRouter', 'nlServerApi', 'nlGroupInfo', 'nlTable', 'nlSendAssignmentSrv',
'nlLrHelper', 'nlReportHelper', 'nlLrFilter', 'nlLrFetcher', 'nlLrExporter', 'nlLrReportRecords', 'nlLrSummaryStats', 'nlGetManyStore', 
'nlTreeListSrv', 'nlMarkup', 'nlLrDrilldown', 'nlCourse', 'nlLrNht',
function(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlSendAssignmentSrv,
	nlLrHelper, nlReportHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrSummaryStats,
	nlGetManyStore, nlTreeListSrv, nlMarkup, nlLrDrilldown, nlCourse, nlLrNht) {
	this.create = function($scope, settings) {
		if (!settings) settings = {};
		return new NlLearningReportView(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlSendAssignmentSrv,
			nlLrHelper, nlReportHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrSummaryStats,
			$scope, settings, nlGetManyStore, nlTreeListSrv, nlMarkup, nlLrDrilldown, nlCourse, nlLrNht);
	};
}];
	
//-------------------------------------------------------------------------------------------------
function NlLearningReportView(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlSendAssignmentSrv,
			nlLrHelper, nlReportHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrSummaryStats,
			$scope, settings, nlGetManyStore, nlTreeListSrv, nlMarkup, nlLrDrilldown, nlCourse, nlLrNht) {
	var _userInfo = null;
	var _groupInfo = null;
	var _attendanceObj = {};
	var _customScoresHeader = null;
	this.show = function() {
		nlRouter.initContoller($scope, '', _onPageEnter);
	};

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		_convertAttendanceArrayToObj(_userInfo.groupinfo.attendance);
		return nl.q(function(resolve, reject) {
			nlGroupInfo.init().then(function() {
				nlGroupInfo.update();
				_groupInfo = nlGroupInfo.get();
				_init();
				resolve(true); // Has to be before next line for loading screen
				_showRangeSelection();
			}, function(err) {
				resolve(false);
			});
		});
	}

	// Private members
	var _isAdmin = false;
	var _customReportTemplate = '';

	function _convertAttendanceArrayToObj(attendanceArray) {
		for(var i=0; i<attendanceArray.length; i++) {
			_attendanceObj[attendanceArray[i].id] = attendanceArray[i];
		}
	}

	function _init() {
		_isAdmin = nlRouter.isPermitted(_userInfo, 'admin_user');
		_customReportTemplate = nlGroupInfo.getCustomReportTemplate();

		// Order is important
		nlGetManyStore.init();
		nlTreeListSrv.init(nl);
		nlLrFilter.init(settings, _userInfo, _groupInfo);
		nlLrReportRecords.init(_userInfo);
		nlLrFetcher.init();
		nlLrExporter.init(_userInfo);
		nlLrDrilldown.init(nlGroupInfo);
		nlLrNht.init(nlGroupInfo);
		nl.pginfo.pageTitle = nlLrFilter.getTitle();
		_initScope();
	}

	function _initScope() {
		$scope.debug = nlLrFilter.isDebugMode();
		$scope.toolbar = _getToolbar();
		$scope.learningRecords = nlLrReportRecords.getRecords();
		$scope.metaHeaders = nlLrHelper.getMetaHeaders(true);
		$scope.utable = {
			search: {disabled : true},
			columns: _getUserColumns(),
			styleTable: 'nl-table-styled2 compact',
			onRowClick: 'expand',
			detailsTemplate: 'view_controllers/learning_reports/learning_report_details.html',
			clickHandler: _userRowClickHandler,
			metas: nlLrHelper.getMetaHeaders(false)
		};
		nlTable.initTableObject($scope.utable);
		$scope.otable = {
			search: {disabled : true},
			columns: _getOrgColumns(),
			styleTable: 'nl-table-styled2 compact',
			getSummaryRow: _getOrgSummaryRow
		};
		nlTable.initTableObject($scope.otable);
		$scope.tabData = _initTabData($scope.utable, $scope.otable);
		$scope.selectedTable = $scope.otable;
		_initChartData();
	}
	
	function _getUserColumns() {
		var type = nlLrFilter.getType();
		var columns = [];
		if(type != 'user') {
			columns.push({id: 'user.user_id', name: 'User Id', smallScreen: true});
			columns.push({id: 'user.name', name: 'User Name'});	
		} else {
			columns.push({id: 'raw_record.typeStr', name: 'Report type'});
		}
		columns.push({id: 'user.org_unit', name: 'Org'});
		var mh = nlLrHelper.getMetaHeaders(true);
		for(var i=0; i<mh.length; i++) {
			columns.push({id: 'usermd.' + mh[i].id, name: mh[i].name});
		}
		if (!nlLrFilter.getObjectId() || type == 'user') {
			columns.push({id: 'repcontent.name', name: 'Course / module', mediumScreen: false});
		}
		columns.push({id: 'stats.status.txt', name: 'Status', smallScreen: true, 
			icon: 'stats.status.icon'});

		// Only search and details relevant columns
		columns.push({id: 'user.email', name: 'Email Id', searchKey: 'email', 
			smallScreen: false, mediumScreen: false, largeScreen: false});
		columns.push({id: 'user.username', name: 'Login Id', searchKey: 'login', 
			smallScreen: false, mediumScreen: false, largeScreen: false});
		return columns;
	}
	
	function _userRowClickHandler(rec, action) {
		if (action == 'delete') {
			return _deleteReport(rec);
		} else if(action == 'view_report') {
			if(rec._raw.raw_record.canReview) {
				nl.window.open(rec._raw.raw_record.url,'_blank')
			} else {
				nlDlg.popupAlert({title: 'Unable to view', template: 'Currently course is unpublished. You can view only after the course is published'})
			}
		}
	}
	
	function _deleteReport(report) {
		var template = nl.t('Once deleted, you will not be able to recover this report. Are you sure you want to delete this report?');
		nlDlg.popupConfirm({title: 'Please confirm', template: template,
			okText : nl.t('Delete')}).then(function(res) {
			if (!res) return;
			var repid = report._raw.raw_record.id;
			nlDlg.showLoadingScreen();
			nlServerApi.learningReportDelete({repids: [repid]}).then(function(statusInfo) {
				nlDlg.hideLoadingScreen();
				var status = statusInfo.resultset[0];
				if (!status.status) {
					nlDlg.popupAlert({title: 'Error', template: nl.fmt2('Error deleting at the server: {}', status.error)});
					return;
				}
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
		columns.push({id: 'assigned', name: 'Total', searchable: false, styleTd: 'text-right'});
		columns.push({id: 'done', name: 'Completed', searchable: false, styleTd: 'text-right'});
		columns.push({id: 'failed', name: 'Failed', searchable: false, styleTd: 'text-right'});
		columns.push({id: 'started', name: 'Started', searchable: false, styleTd: 'text-right'});
		columns.push({id: 'pending', name: 'Pending', searchable: false, styleTd: 'text-right'});
		return columns;
	}

	function _getOrgSummaryRow(records) {
		return $scope.tabData.summaryStatSummaryRow;
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
			title : 'View content',
			icon : 'ion-ios-eye',
			id: 'content',
			onClick : _onViewContent
		}, {
			title : 'Mark attendance',
			icon : 'ion-person-stalker',
			id: 'attendance',
			onClick : _onClickOnMarkAttendance
		}, {
			title : 'Provide ratings',
			icon : 'ion-speedometer',
			id: 'rating',
			onClick : _onClickOnMarkRatings
		}, {
			title : 'Mark milestone',
			icon : 'ion-flag',
			id: 'milestone',
			onClick : _onClickOnMarkMilestone
		}, {
			title : 'Send reminder to users who have not completed',
			icon : 'ion-ios-bell',
			id: 'reminderNotify',
			onClick : _onClickOnReminderNotification,
		}, {
			title : 'Modify assignment properties',
			icon : 'ion-edit',
			id: 'modifyAssignment',
			onClick : _onClickModifyAssignment,
		}, {
			title : 'Select and filter users',
			icon : 'ion-ios-people',
			id: 'selectUser',
			onClick : _showRangeSelection,
		}, {
			title : 'Download report',
			icon : 'ion-ios-cloud-download',
			id: 'export',
			onClick : _onExport
		}, {
			title : 'Download custom MIS report',
			icon : 'material-icons',
			icon_content : 'assignment_returned',
			id: 'exportCustomReport',
			onClick : _onExportCustomReport
		}];
	}

	$scope.canShowToolbarIcon = function(tbid) {
			var type = nlLrFilter.getType();
		if (nlLrFetcher.fetchInProgress(true)) return false;
		if (tbid == 'tbfetchmore') return nlLrFetcher.canFetchMore();
		if (tbid == 'tbfilter') return nlLrFilter.isFilterShown();
		if (tbid == 'content') return (nlLrFilter.getType() == 'module_assign' || nlLrFilter.getType() == 'course_assign');
		if (tbid == 'attendance') {
			var content = _getContentOfCourseAssignment();
			return content && content.blended ? true : false;
		}
		if (tbid == 'rating') {
			var content = _getContentOfCourseAssignment();
			if(!content) return false;
			for(var i=0; i<content.modules.length; i++) {
				if(content.modules[i].type == 'rating') return true;
			}
			return false;
		}
		if(tbid == 'reminderNotify') {
			var reminderDict = nlLrReportRecords.getReminderDict();
			var isReminderEnabled = _isReminderNotificationEnabled();
			return ((type == 'course_assign' || type == 'module_assign') && isReminderEnabled &&  (reminderDict.users && reminderDict.users.length != 0));
		}
		if (tbid == 'modifyAssignment') {
			return (type == 'course_assign' || type == 'module_assign');
		}

		if (tbid == 'milestone') {
			var content = _getContentOfCourseAssignment();
			if(!content) return false;
			for(var i=0; i<content.modules.length; i++) {
				if(content.modules[i].type == 'milestone') return true;
			}
			return false;
		}

		if (tbid == 'exportCustomReport') return (type == 'course') && ($scope.debug || _customReportTemplate);
		if (tbid == 'selectUser') return (nlLrFilter.getType() == 'user');
		return true;
	};
	
	$scope.chartsOnLoad = function() {
		nl.window.resize();
	}
	
	$scope.checkOverflow = function() {
		var document = nl.window.document;
		var element = document.getElementsByClassName("nl-left-tabbed-content");
		var isOverflowing = element[0].clientWidth < element[0].scrollWidth;
		return isOverflowing;
	};

	$scope.getContTabHeight = function() {
		var document = nl.window.document;
		var bodyElement = document.getElementsByClassName("nl-learning-report-body")
		var topElem = document.getElementsByClassName("nl-topsection");
		return (bodyElement[0].clientHeight - topElem[0].clientHeight-18);
	};

	$scope.onDetailsClick = function(e, item, columns) {		
		e.stopImmediatePropagation();
		e.preventDefault();
		var detailsDlg = nlDlg.create($scope);
		detailsDlg.setCssClass('nl-heigth-max nl-width-max');
		detailsDlg.scope.item = item;
		detailsDlg.scope.columns = columns;
		detailsDlg.scope.getRoundedPerc = function(divider, dividend) {
			return Math.round((divider*100)/dividend);
		}
		var cancelButton = {text: nl.t('Close')};
		detailsDlg.show('view_controllers/learning_reports/lr_courses_tab_details.html',
			[], cancelButton);
	};

	$scope.generateDrillDownArray = function(item) {
		if(!item.isFolder) return;
		item.isOpen = !item.isOpen;
		var selectedId = $scope.tabData.selectedTab.id;
		if(selectedId == 'drilldown') {
			$scope.drillDownInfo = {columns: _drillDownColumns, rows: _generateDrillDownArray(false, _statsCountDict, true)};
		} else {
			$scope.nhtInfo = {columns: _nhtColumns, rows: _generateDrillDownArray(false, _nhtStatsDict, false, (nlLrFilter.getType() == "course_assign"))};
		}
	};

	$scope.generateBatchDataArray = function(item) {
		if(!item.isFolder) return;
		item.isOpen = !item.isOpen;
		_generateBatchDataArray(false);
	};

	function _getContentOfCourseAssignment() {
		if(nlLrFilter.getType() != 'course_assign') return null;
		var course = nlGetManyStore.getAnyRecord('course');
		if (!course || !course.content) return null;
		return course.content;
	}

	function _isReminderNotificationEnabled() {
		var props = _groupInfo.props;
        var isMailEnabled = (props['notifyBy'] || []).length > 0;
		return isMailEnabled;
	}

	function _initTabData(utable, otable) {
		var ret =  {tabs: [{
			title : 'Click here to see reports overview',
			name: 'Overview',
			icon : 'ion-stats-bars',
			id: 'overview',
			updated: false,
			tables: []
		}, {
			title : 'Click here to view course-wise progress',
			name: 'Drill down',
			icon : 'ion-social-buffer',
			id: 'drilldown',
			updated: false,
			tables: []
		}, {
			title : 'Click here to view learning records',
			name: 'Learning records',
			icon : 'ion-ios-compose',
			id: 'learningrecords',
			updated: false,
			tables: [utable]
		},{
			title : 'Click here to view time summary',
			name: 'Time summary',
			icon : 'ion-clock',
			id: 'timesummary',
			updated: false,
			tables: []
		}]};
		ret.search = '';
		ret.lastSeached = '';
		ret.filter = {};
		ret.searchPlaceholder = 'Type the search words and press enter';
		ret.records = null; 
		ret.summaryStats = null;
		ret.summaryStatSummaryRow = null;
		ret.selectedTab = ret.tabs[0];
		ret.processingOnging = true;
		ret.nothingToDisplay = false;
		ret.onSearch = _onSearch;
		ret.onFilter = _onFilter;
		ret.onTabSelect = _onTabSelect;
		ret.isNHTAdded = false;
		return ret;
	}

	function _someTabDataChanged() {
		$scope.drillDownInfo = {};
		$scope.nhtInfo = {};
		var tabs = $scope.tabData.tabs;
		for (var i=0; i<tabs.length; i++) {
			tabs[i].updated = false;
		}
		$scope.tabData.records = null;
	}

	function _onTabSelect(tab) {
		$scope.tabData.selectedTab = tab;
		_updateCurrentTab();
	}

	function _updateCurrentTab(avoidFlicker) {
		var tabData = $scope.tabData;
		var tab = tabData.selectedTab;
		if (tab.updated) return;
		if (!avoidFlicker) {
			tabData.nothingToDisplay = false;
			tabData.processingOnging = true;
			nlDlg.showLoadingScreen();
		}
		nl.timeout(function() {
			_actualUpdateCurrentTab(tabData, tab);
			tab.updated = true;
			if (tabData.records.length > 0) {
				tabData.processingOnging = false;
				tabData.nothingToDisplay = false;
			} else {
				tabData.processingOnging = true;
				tabData.nothingToDisplay = true;
			}
			nlDlg.hideLoadingScreen();
		}, 100);
	}

	function _actualUpdateCurrentTab(tabData, tab) {
		if (!tabData.records) {
			var summaryStats = nlLrSummaryStats.getSummaryStats();
			tabData.records = _getFilteredRecords(summaryStats);
			tabData.summaryStats = summaryStats.asList();

			tabData.summaryStatSummaryRow = _getSummaryStatSummaryRow(tabData.summaryStats);
		}
		
		if (tab.id == 'overview') {
			_updateOverviewTab(tabData.summaryStatSummaryRow);
		} else if (tab.id == 'learningrecords') {
			nlTable.updateTableObject($scope.utable, tabData.records);
		} else if (tab.id == 'organisations') {
			nlTable.updateTableObject($scope.otable, tabData.summaryStats);
		} else if (tab.id == 'timesummary') {
			_updateTimeSummaryTab();
		} else if (tab.id == 'drilldown') {
			_updateDrillDownTab();
		} else if (tab.id == 'nht') {
			_updateNhtTab();
		}
	}

	function _onSearch(event) {
		if (event && event.which !== 13) return;
		var tabData = $scope.tabData;
		if (tabData.lastSeached == tabData.search) return;
		tabData.lastSeached = tabData.search;
		_someTabDataChanged();
		_updateCurrentTab();
	}

	function _onFilter() {
		var dlg = nlDlg.create($scope);
		dlg.scope.data = {batchStatus: {id: $scope.tabData.filter.closed_batches ? 'closed' : 'running'}};
		dlg.scope.options = {batchStatus: [{id: 'running', name: 'Running Batches'}, 
			{id: 'closed', name: 'Closed Batches'}]};
		dlg.scope.help = {batchStatus: {name: 'Batch Status', help: 'Select running or closed batches'}};
		var okButton = {text: nl.t('Apply'), onTap: function(e) {
			$scope.tabData.filter.closed_batches = dlg.scope.data.batchStatus.id == 'closed';
			_someTabDataChanged();
			_updateCurrentTab();
		}};

		var cancelButton = {text: nl.t('Close')};
		dlg.show('view_controllers/learning_reports/lr_records_filter_dlg.html',
			[okButton], cancelButton);
	}

	function _getFilteredRecords(summaryStats) {
		var records = nlLrReportRecords.getRecords();
		var tabData = $scope.tabData;
		var filterInfo = _getFilterInfo(tabData);
		var searchInfo = _getSearchInfo(tabData);
		var filteredRecords  = [];
		for (var recid in records) {
			var record = records[recid];
			if (!_doesPassFilter(tabData, record, filterInfo)) continue;
			if (!_doesPassSearch(record, searchInfo)) continue;
			filteredRecords.push(record);
			summaryStats.addToStats(record);
		}
		filteredRecords.sort(function(a, b) {
			return (b.stats.status.id - a.stats.status.id);
		});
		return filteredRecords;
	}

	function _getSearchInfo(tabData) {
		var search = tabData.search;
		var searchArray = search.split(' AND ');
		var ret = [];
		for (var i=0; i<searchArray.length; i++) {
			var e=searchArray[i].trim().toLowerCase();
			if (e) ret.push(e);
		}
		return ret;
	}

	function _getFilterInfo(tabData) {
		if (!tabData.isNHTAdded) return {};
		var filter = tabData.filter;
		if (!filter.closed_batches) filter.closed_batches = false;
		return filter;
	}

	function _doesPassFilter(tabData, record, filterInfo) {
		if (!tabData.isNHTAdded) return true;
		var msInfo = nlGetManyStore.getBatchMilestoneInfo(record.raw_record);
		if (filterInfo.closed_batches) return msInfo.batchStatus == 'Closed';
		return msInfo.batchStatus != 'Closed';		
	}

	function _doesPassSearch(record, searchInfo) {
			if (searchInfo.length == 0) return true;
		var repcontent = record.repcontent || {};
		var raw_record = record.raw_record || {};
		var user = record.user || {};
		var usermeta = record.usermd || {};
		var mdKeys = [];
		for (var md in usermeta) mdKeys.push(md);
		for (var i=0; i<searchInfo.length; i++) {
			var searchElem = searchInfo[i];
			if (_isFoundInAnyOfAttrs(searchElem, repcontent, ['name', 'batchname'])) continue;
			if (_isFoundInAnyOfAttrs(searchElem, repcontent, ['name', 'batchtype'])) continue;
			if (_isFoundInAnyOfAttrs(searchElem, raw_record, ['subject', '_grade'])) continue;
			if (_isFoundInAnyOfAttrs(searchElem, user, ['username', 'name', 'email', 'org_unit'])) continue;
			if (_isFoundInAnyOfAttrs(searchElem, usermeta, mdKeys)) continue;
			return false;
		}
		return true;
	}

	function _isFoundInAnyOfAttrs(str, obj, attrs) {
		for (var i=0; i<attrs.length; i++)
			if (_isFoundInAttr(str, obj, attrs[i])) return true;
		return false;
	}

	function _isFoundInAttr(str, obj, attr) {
		var inStr = obj ? obj[attr] : null;
		if (!inStr) return false;
		return (inStr.toLowerCase().indexOf(str) >= 0);
	}

	function _getSummaryStatSummaryRow(summaryStats) {
		var summaryRecord = {'org': {txt: 'Overall'}};
		var assigned = 0;
		var done = 0;
		var failed = 0;
		var started = 0;
		var pending = 0;
		for (var i=0; i<summaryStats.length; i++) {
			var rec = summaryStats[i];
			assigned += rec.assigned;
			done += rec.done;
			failed += rec.failed;
			started += rec.started;
			pending += rec.pending;
		}

		summaryRecord['assigned'] = {txt: assigned};
		summaryRecord['done'] = {txt: done};
		summaryRecord['failed'] = {txt: failed};
		summaryRecord['started'] = {txt: started};
		summaryRecord['pending'] = {txt: pending};
		return summaryRecord;
	}

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
			_updateScope(true);
		});
	}
	
	function _updateReportRecords() {
		nlLrReportRecords.updateReportRecords();
		_updateScope();
	}
	
	function _setSubTitle(anyRecord) {
		nl.pginfo.pageSubTitle = '';
		var objid = nlLrFilter.getObjectId();
		var type = nlLrFilter.getType();
		if (!objid || !anyRecord || !anyRecord.repcontent) return;
		if (type == 'user') nl.pginfo.pageSubTitle = nl.t('({})', objid);
		else nl.pginfo.pageSubTitle = anyRecord.repcontent.name || ''
	}
	
	function _updateScope(avoidFlicker) {
		nl.pginfo.pageTitle = nlLrFilter.getTitle();	
		$scope.fetchInProgress = nlLrFetcher.fetchInProgress(true);
		$scope.canFetchMore = nlLrFetcher.canFetchMore();
		_checkAndUpdateNHT();
		var anyRecord = nlLrReportRecords.getAnyRecord();
		_setSubTitle(anyRecord);
		$scope.noDataFound = (anyRecord == null);
		_someTabDataChanged();
		_updateCurrentTab(avoidFlicker);

	}

	function _checkAndUpdateNHT() {
		var type = nlLrFilter.getType();
		if(type != 'user' && nlLrReportRecords.isNHT() && !$scope.tabData.isNHTAdded) {
			$scope.tabData.tabs.splice(2, 0, {title : 'Click here to view New Hire Training status',
												name: 'NHT',
												icon : 'ion-filing',
												id: 'nht',
												updated: false,
												tables: []
											});
			$scope.tabData.isNHTAdded = true;
		}

	}

	function _initChartData() {
		$scope.overviewArray = [];
		var labels =  ['done', 'failed', 'started', 'pending'];
		var colors = [_nl.colorsCodes.done, _nl.colorsCodes.failed, _nl.colorsCodes.started, _nl.colorsCodes.pending];

		var type = nlLrFilter.getType();
			var typeStr = type == 'module' || type == 'module_assign' || type == 'module_self_assign' ? 'Modules' : 'Courses';
		$scope.charts = [{
			type: 'doughnut',
			title: 'Progress',
			data: [0, 0, 0, 0],
			labels: labels,
			colors: colors
		},
		{
			type: 'bar',
			title: nl.fmt2('{} assigned vs completed over time', typeStr),
			data: [[]],
			labels: [],
			series: ['Assigned', 'Completed'],
			colors: [_nl.colorsCodes.blue2, _nl.colorsCodes.done]
		}];
		var brackets = typeStr == 'Courses' ? '(within courses) ': '';
		$scope.timeSummaryCharts = [{
				type: 'bar',
				id: 'days',
				title: nl.fmt2('Modules {}completed over days', brackets),
				subtitle: 'Most recent data upto a maximum of 31 days are shown',
				data: [[]],
				labels: [],
				series: ['S1'],
				colors: [_nl.colorsCodes.blue2]
			},
			{
				type: 'bar',
				title: nl.fmt2('Modules {}completed over weeks', brackets),
				subtitle: 'Most recent data upto a maximum of 15 weeks are shown',
				data: [[]],
				labels: [],
				series: ['S1'],
				colors: [_nl.colorsCodes.blue2]
			},
			{
				type: 'bar',
				title: nl.fmt2('Modules {}completed over months', brackets),
				subtitle: 'Most recent data upto a maximum of 15 months are shown',
				data: [[]],
				labels: [],
				series: ['S1'],
				colors: [_nl.colorsCodes.blue2]
			}],
			$scope.drillDownInfo = {};
			$scope.nhtInfo = {};
			$scope.batchinfo = {};
	}
	
	function _updateOverviewTab(summaryRecord) {
		_updateOverviewDoughnut(summaryRecord);
		_updateOverviewInfoGraphicsCards(summaryRecord);
		_updateOverviewTimeChart();
	}

	function _updateOverviewDoughnut(summaryRecord) {
		var c = $scope.charts[0];
		var type = nlLrFilter.getType();
		var typeStr = type == 'module' || type == 'module_assign' || type == 'module_self_assign' ? 'Module' : 'Course';
		c.data = [summaryRecord.done.txt, summaryRecord.failed.txt, summaryRecord.started.txt, summaryRecord.pending.txt];
		c.title = nl.t('{} progress: {} of {} done', typeStr, (summaryRecord.done.txt + summaryRecord.failed.txt), summaryRecord.assigned.txt);
	}
	
	function _updateOverviewInfoGraphicsCards(summaryRecord) {
		var userStatusDict = {};
		var records = $scope.tabData.records;
		for (var i=0; i<records.length; i++) {
			var rec = records[i];
			if (!rec) continue;
			var uid = (rec.user || {}).user_id;
			if (!uid) continue;
			var status = rec.stats.status;
			status = nlReportHelper.isDone(status) ? 'done' : status.id == nlReportHelper.STATUS_STARTED ? 'started' : 'pending';
			if (!(uid in userStatusDict)) {
				userStatusDict[uid] = status;
				continue;
			}
			var oldStatus =  userStatusDict[uid];
			if (status == 'pending' && oldStatus == 'pending') {
				status = 'pending';
			} else if (status == 'done' &&  oldStatus == 'done') {
				status = 'done';
			} else {
				status = 'started';	
			}
			userStatusDict[uid] = status;
		}
		var uDone = 0;
		var uStarted = 0;
		var uPending = 0;
		for(var uid in userStatusDict) {
			var status = userStatusDict[uid];
			if (status == 'done') uDone++;
			else if (status == 'started') uStarted++;
			else uPending++;
		}
		var type = nlLrFilter.getType();
			var typeStr = type == 'module' || type == 'module_assign' || type == 'module_self_assign' ? 'Modules' : 'Courses';
		var completedPerc = ((summaryRecord.done.txt+summaryRecord.failed.txt)/summaryRecord.assigned.txt)*100 || 0;
		var startedPerc = (summaryRecord.started.txt/summaryRecord.assigned.txt)*100 || 0;
		var pendingPerc = (summaryRecord.pending.txt/summaryRecord.assigned.txt)*100 || 0;
		completedPerc = Math.round(completedPerc);
		startedPerc = Math.round(startedPerc);
		pendingPerc = Math.round(pendingPerc)
		$scope.overviewArray = [
			{title: nl.fmt2('{} completed', typeStr), desc:'', perc: completedPerc, showperc:1},
			{title: nl.fmt2('{} started', typeStr), desc:'', perc: startedPerc, showperc:1},
			{title: nl.fmt2('{} yet to start', typeStr), desc:'', perc: pendingPerc, showperc:1},
			{title: nl.fmt2('{} completed', 'Learners'), desc:'', perc: uDone, showperc:0},
			{title: nl.fmt2('{} started', 'Learners'), desc:'', perc: uStarted, showperc:0},
			{title: nl.fmt2('{} yet to start', 'Learners'), desc:'', perc: uPending, showperc:0}];
	}

	function _updateOverviewTimeChart() {
		var c = $scope.charts[1];
		var ranges = nlLrReportRecords.getTimeRanges();
		var records = $scope.tabData.records;
		var type = nlLrFilter.getType();
			var isModuleRep = type == 'module' || type == 'module_assign' || type == 'module_self_assign';
		for (var j=0; j<records.length; j++) {
			var rec = records[j];
			var ended = isModuleRep ? _getModuleEndedTime(rec.raw_record) : _getCourseEndedTime(rec);
			var isAssignedCountFound = false;
			var isCompletedCountFound = false;
			for(var i=0; i<ranges.length; i++) {
				if (_isTsInRange(rec.raw_record.created, ranges[i])) {
					ranges[i].count++;
					isAssignedCountFound = true;
					if (!ended) break;
				}
				if (!_isTsInRange(ended, ranges[i])) continue;
				if(!isCompletedCountFound) {
					ranges[i].completed++;
					isCompletedCountFound = true;
				}
				if(isAssignedCountFound) break;
			}
		}
		
		c.labels = [];
		c.data = [[], []];
		for (var i=0; i<ranges.length; i++) {
			var r = ranges[i];
			c.labels.push(r.label);
			c.data[0].push(r.count);
			c.data[1].push(r.completed)
		}
	}
	
	function _isTsInRange(ts, range) {
		return (ts >= range.start && ts < range.end);
	}

	function _getModuleEndedTime(rep) {
		if (!rep.completed) return null;
		return (rep.ended ? nl.fmt.json2Date(rep.ended) : rep.updated) || null;
	}

	function _getCourseEndedTime(rep) {
		if (!nlReportHelper.isDone(rep.stats.status)) return null;
		return rep.raw_record.updated;
	}

	function _updateTimeSummaryTab() {
		var records = $scope.tabData.records;
		var type = nlLrFilter.getType();
		var loadcomplete = false;
		for(var chartindex=0; chartindex<$scope.timeSummaryCharts.length; chartindex++) {
			var c = $scope.timeSummaryCharts[chartindex];
			var rangeType = chartindex == 0 ? 'days' : chartindex == 1 ? 'weeks' : 'months';
			var maxBuckets = (rangeType == 'days') ? 31 : 15;
			var ranges = nlLrReportRecords.getTimeRanges(rangeType, maxBuckets);
				var isModuleRep = type == 'module' || type == 'module_assign' || type == 'module_self_assign';
			for (var i=0; i<records.length; i++) {
				var rec = records[i];
				var recId = rec.raw_record.id;
				var lessonReports = isModuleRep ? {recId: rec.raw_record} : rec.repcontent.lessonReports;

				for(var report in lessonReports) {
					var rep = lessonReports[report];
					var ended = _getModuleEndedTime(rep);
					if (!ended) continue;
					for(var rangeindex=0; rangeindex<ranges.length; rangeindex++) {
						if (!_isTsInRange(ended, ranges[rangeindex])) continue;
						ranges[rangeindex].count++;
						break;
					}
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
	}

	var _nhtStatsDict = {};
	var _nhtColumns = null;
	var _nhtUniqueUserRecords = {};
	var _nhtColumnsSelectedInView = null;
	function _updateNhtTab() {
		nlLrNht.clearStatusCountTree();
		var records = $scope.tabData.records;
		_nhtUniqueUserRecords = {};
		for(var i=0; i<records.length; i++) {
			var record = records[i];
			if(!record.raw_record.isNHT) continue;
			if(!(record.user.user_id in _nhtUniqueUserRecords)) {
				_nhtUniqueUserRecords[record.user.user_id] = record;
				continue;
			}	
			var oldUserRecord = _nhtUniqueUserRecords[record.user.user_id];
			if(oldUserRecord.repcontent.updated > record.repcontent.updated) continue;
			_nhtUniqueUserRecords[record.user.user_id] = record;
		}
		for(var key in _nhtUniqueUserRecords) {
			var record = _nhtUniqueUserRecords[key];
				nlLrNht.addCount(record);
		}
		_nhtStatsDict = nlLrNht.getStatsCountDict();
		_initNhtColumns();
		var tableTitle = $scope.tabData.filter.closed_batches ? 'Closed batches' : 'Running batches';
		$scope.nhtInfo = {columns: _nhtColumns, tableTitle: tableTitle, rows: _generateDrillDownArray(true, _nhtStatsDict, false, (nlLrFilter.getType() == "course_assign"))};
	}

	function _initNhtColumns() {
		_nhtColumns = _getNhtColumns();
		_updateNhtColumns();
        $scope.nhtViewSelectorConfig = {
            canEdit: nlRouter.isPermitted(_userInfo, 'assignment_manage'),
            tableType: 'nht_views',
            allColumns: _nhtColumns,
            onViewChange: function(selectedColumns) {
				_nhtColumnsSelectedInView = {};
				for(var i=0; i<selectedColumns.length; i++) {
					var col = selectedColumns[i];
					_nhtColumnsSelectedInView[col.id] = true;
				}
				_someTabDataChanged();
				_updateCurrentTab();
            }
        };
	}

	function _updateNhtColumns() {
		var isClosedBatches = $scope.tabData.filter.closed_batches;
		for(var i=0; i<_nhtColumns.length; i++) {
			var col = _nhtColumns[i];
			var notApplicable = isClosedBatches && col.showIn == 'running' ||
				!isClosedBatches && col.showIn == 'closed';
			if (notApplicable) {
				col.canShow = false;
				continue;
			}
			col.canShow = !_nhtColumnsSelectedInView || _nhtColumnsSelectedInView[col.id];
		}
	}

	function _getNhtColumns() {
		var columns = [];
		var attrition = nlLrNht.getAttritionArray();
		_customScoresHeader = nlLrReportRecords.getCustomScoresHeader();
		var etmUserStates = _groupInfo.props.etmUserStates || [];
		var milestones = _groupInfo.props.milestones || [];
		var statusDict = _getStatusDictFromArray();
		columns.push({id: 'cntTotal', name: 'Head Count', table: true, hidePerc:true, smallScreen: true, background: 'bggrey', showAlways: true});
		columns.push({id: 'batchStatus', name: 'Batch Status', table: true, hidePerc:true, smallScreen: true, showAlways: true});
		columns.push({id: 'batchName', name: 'Batch', table: true, hidePerc:true, smallScreen: true, background: 'bggrey', showAlways: true});
		columns.push({id: 'partner', name: 'Partner', table: true, hidePerc:true, smallScreen: true, background: 'bggrey', showAlways: true});
		columns.push({id: 'lob', name: 'LOB', table: true, hidePerc:true, smallScreen: true, background: 'bggrey', showAlways: true});

		for(var i=0; i<etmUserStates.length; i++) {
			var userState = etmUserStates[i];
			columns.push({id: 'attrition-' + userState.id, 
				name: 'Attrition during ' + userState.name, hidePerc:true, table: true, showAlways: true});
		}
		columns.push({id: 'attrition', name: 'Total Attrition', hidePerc:true, table: true, showAlways: true});

		columns.push({id: 'batchtype', name: 'Batch Type', table: true, hidePerc:true, smallScreen: true, background: 'bggrey', showAlways: true});
		columns.push({id: 'trainer', name: 'Trainer', table: true, hidePerc:true, smallScreen: true, background: 'bggrey', showAlways: true});

		for(var i=0; i<milestones.length; i++) {
			var item = milestones[i];
			columns.push({id: item.id+'planned', name: nl.t('Planned {} date', item.name), table: true, hidePerc:true, style:'min-width:fit-content'});
		}

		for(var i=0; i<milestones.length; i++) {
			var item = milestones[i];
			columns.push({id: item.id+'actual', name: nl.t('Actual {} date', item.name), table: true, hidePerc:true, style:'min-width:fit-content'});	
		}

		for(var i=0; i<etmUserStates.length; i++) {
			var userState = etmUserStates[i];
			columns.push({id: userState.id, name: nl.t('In {} Count',userState.name), showIn: 'running', hidePerc: true, showAlways: true, table: true});
			if(userState.tenures) {
				for (var j=userState.tenures.length-1; j>=0; j--) columns.push({id: userState.tenures[j].id, name: nl.t('In {} Count', userState.tenures[j].name), showIn: 'closed', hidePerc: true, showAlways: true, table: true});
			}
		}

		columns.push({id: 'certifiedFirstAttempt', name: 'Certified in Fisrt Attempt', hidePerc: true, table: true, showAlways: true});
		columns.push({id: 'certifiedSecondAttempt', name: 'Certified in 2nd Attempt', hidePerc: true, table: true, showAlways: true});
		columns.push({id: 'certified', name: 'Total Certified', hidePerc: true, table: true, showAlways: true});
		columns.push({id: 'failed', name: 'Total Not Certified', hidePerc:true, table: true, showAlways: true});
		columns.push({id: 'batchFirstPass', name: 'First Pass Percentage', showIn: 'closed', hidePerc: true, table: true, showAlways: true});
		columns.push({id: 'batchThroughput', name: 'Batch Throughput', showIn: 'closed', hidePerc: true, table: true, showAlways: true});

		// Others - not asked by customer but may be needed
		columns.push({id: 'avgDelay', name: 'Average delay(In days)', hidePerc: true, table: true, showAlways: true});
		columns.push({id: 'avgScore', name: 'Avg Quiz score', table: true, background: 'nl-bg-blue', hidePerc:true});
		for(var i=0; i<_customScoresHeader.length; i++) columns.push({id: 'perc'+_customScoresHeader[i], name: _customScoresHeader[i], table: true, background: 'nl-bg-blue', hidePerc:true});

		// Hidden columns
		columns.push({id: 'start', name: 'Batch start date', table: false, hidePerc:true, style:'min-width:fit-content'});
		columns.push({id: 'end', name: 'Batch end date', table: false, hidePerc:true, style:'min-width:fit-content'});
		columns.push({id: 'pending', name: 'Pending', hidePerc:true, table: false, showAlways: true});
		columns.push({id: 'batchTotal', name: 'Batches', table: false, hidePerc:true, showAlways: true});
		return columns;
	}

	var _statsCountDict = {};
	var _drillDownColumns = [];
	function _updateDrillDownTab() {
		nlLrDrilldown.clearStatusCountTree();
		var records = $scope.tabData.records;
		for(var i=0; i<records.length; i++) {
			nlLrDrilldown.addCount(records[i]);
		}
		_statsCountDict = nlLrDrilldown.getStatsCountDict();
		_drillDownColumns = _getDrillDownColumns();
		$scope.drillDownInfo = {columns: _drillDownColumns, rows: _generateDrillDownArray(true, _statsCountDict, true, false)};
	}

	var drillDownArray = [];
	function _generateDrillDownArray(firstTimeGenerated, statusDict, singleRepCheck, showLeafOnly) {
		drillDownArray = [];
		var isSingleReport = (singleRepCheck && Object.keys(statusDict).length <= 2) ? true : false;
		for(var key in statusDict) {
			var root = statusDict[key];
			if(key == 0) {
				root.cnt.style = 'nl-bg-dark-blue';
				root.cnt['sortkey'] = 0+root.cnt.name;
				if(isSingleReport) continue;
			} else {
				root.cnt.style = 'nl-bg-blue';
				root.cnt['sortkey'] = 1+root.cnt.name+key;
			}
			if(showLeafOnly) {
				_addSuborgOrOusToArray(root.children, root.cnt.sortkey, null, showLeafOnly);
			} else {
				drillDownArray.push(root.cnt);
				if(firstTimeGenerated && isSingleReport) root.cnt.isOpen = true;
				if(root.cnt.isOpen) _addSuborgOrOusToArray(root.children, root.cnt.sortkey, null, showLeafOnly);
			}
		}
		drillDownArray.sort(function(a, b) {
			if(b.sortkey.toLowerCase() < a.sortkey.toLowerCase()) return 1;
			if(b.sortkey.toLowerCase() > a.sortkey.toLowerCase()) return -1;
			if(b.sortkey.toLowerCase() == a.sortkey.toLowerCase()) return 0;				
		})
		return drillDownArray;
	};

	function _addSuborgOrOusToArray(subOrgDict, sortkey, subOrgName, showLeafOnly) {
		for(var key in subOrgDict) {
			var org = subOrgDict[key];
				org.cnt['sortkey'] = sortkey+'.aa'+org.cnt.name;
				org.cnt['orgname'] = org.cnt['name'];
				if(nlGroupInfo.isSubOrgEnabled()) {
					if(subOrgName && org.cnt['name'].indexOf(subOrgName+'.') === 0) org.cnt['orgname'] = org.cnt['name'].slice(subOrgName.length+1);
				}
			if(showLeafOnly) {
				if(!org.children || Object.keys(org.children).length == 0) {
					org.cnt.indentation = 0;
					drillDownArray.push(org.cnt);
				} else {
					_addSuborgOrOusToArray(org.children, org.cnt.sortkey, org.cnt.name, showLeafOnly);
				}
			} else {
				drillDownArray.push(org.cnt);
				if(org.cnt.isOpen && org.children) _addSuborgOrOusToArray(org.children, org.cnt.sortkey, org.cnt.name, showLeafOnly);
			}
		}
	}

	function _getDrillDownColumns() {
		var columns = [];
		var attrition = nlLrDrilldown.getAttritionObj();
		var customStartedStates = nlLrDrilldown.getCustomStatusObj();
		var statusDict = _getStatusDictFromArray();
		_customScoresHeader = nlLrReportRecords.getCustomScoresHeader();
		var isReattemptEnabled = nlLrReportRecords.isReattemptEnabled() || false;
		columns.push({id: 'cntTotal', name: 'Total', table: true, percid:'percTotal', smallScreen: true, background: 'bggrey', showAlways: true});
		columns.push({id: 'cntInactive', name: 'Inactive', table: true, percid:'percInactive', background: 'nl-bg-blue', showAlways: true});
		if(attrition.length > 0) {
			columns.push({id: 'attrition', name: 'Attrition', percid: 'percAttrition', indentation: 'padding-left-22'});
			for(var i=0; i<attrition.length; i++) {
				var name = attrition[i];
				var formattedName = _getFormattedName(name, statusDict);
				columns.push({id: attrition[i], name: formattedName, percid:'perc'+attrition[i], indentation: 'padding-left-44'});
			}
		}
		columns.push({id: 'doneInactive', name: 'Completed by inactive users', percid: 'percDoneInactive', indentation: 'padding-left-22'});
		columns.push({id: 'pendingInactive', name: 'Pending by inactive users', percid:'percPendingInactive', indentation: 'padding-left-22'});
		columns.push({id: 'cntActive', name: 'Active', percid: 'percActive', background: 'nl-bg-blue', showAlways: true});
		columns.push({id: 'completed', name: 'Completed', percid: 'percCompleted', indentation: 'padding-left-22', showAlways: true});
		columns.push({id: 'certified', name: 'Certified', percid: 'percCertified', table: true, indentation: 'padding-left-44'});
		if(isReattemptEnabled) {
			columns.push({id: 'certifiedInFirstAttempt', name: 'Certified in first attempt', percid: 'percCertifiedInFirstAttempt', table: true, indentation: 'padding-left-66'});
			columns.push({id: 'certifiedInReattempt', name: 'Certified in Reattempt', percid: 'percCertifiedInReattempt', indentation: 'padding-left-66'});
		}
		columns.push({id: 'failed', name: 'Failed', percid: 'percFailed', table: true, indentation: 'padding-left-44'});
		columns.push({id: 'started', name: 'Started', percid: 'percStarted', table: true, indentation: 'padding-left-22', showAlways: true});
		if(customStartedStates.length > 0) {
			for(var i=0; i<customStartedStates.length; i++) {
				if(customStartedStates[i] in statusDict)
					columns.push({id: customStartedStates[i], name: statusDict[customStartedStates[i]], percid:'perc'+customStartedStates[i], table: true, indentation: 'padding-left-44'});
			}
		}
		columns.push({id: 'pending', name: 'Pending', smallScreen: true, percid: 'percPending', table: true, indentation: 'padding-left-22', showAlways: true});
		columns.push({id: 'avgScore', name: 'Avg Quiz score', table: true, background: 'nl-bg-blue', hidePerc:true});
		for(var i=0; i<_customScoresHeader.length; i++) columns.push({id: 'perc'+_customScoresHeader[i], name: _customScoresHeader[i], table: true, background: 'nl-bg-blue', hidePerc:true});
		columns.push({id: 'avgDelay', name: 'Avg Delay in days', table: true, background: 'nl-bg-blue', hidePerc:true});
		return columns;
	}

	function _getFormattedName(name, statusDict) {
		var nameArray = name.split('-');
		var first = nameArray[0].trim();
		var firstletter = first.charAt(0).toUpperCase();
		var newString = firstletter+first.substring(1);
			newString = newString+' during '+statusDict[nameArray[1]];
		return newString;
	}

	function _getStatusDictFromArray() {
		var newStatus = _groupInfo.props.etmUserStates || [];
		var ret = {};
		for(var i=0; i<newStatus.length; i++) {
			var userState = newStatus[i];
			ret[userState.id] = userState.name;
			if(userState.tenures) {
				for (var j=userState.tenures.length-1; j>=0; j--) ret[userState.tenures[j].id] = userState.tenures[j].name;
			}
		}
		return ret;
	}

	function _onExport() {
		if (nlLrFetcher.fetchInProgress()) return;
		var reportRecords = nlLrReportRecords.asList();
		if(!_customScoresHeader) _customScoresHeader = nlLrReportRecords.getCustomScoresHeader();
		_updateDrillDownTab();
		var drillDownCols = _getDrillDownColumns();
		var header = [];
		for(var i=0; i<drillDownCols.length; i++) {
			var col = drillDownCols[i];
			if(col.table) header.push(col);
		}
		var headerArray = [{id: 'courseName', name: 'Course name'}];
		if(nlGroupInfo.isSubOrgEnabled()) headerArray.push({id: 'subOrgId', name: 'Suborg Id'});
		headerArray.push({id: 'organisationId', name: 'Organisation Id'});

		header = headerArray.concat(header);
		var drillDownStats = {statsCountDict: _statsCountDict, columns: header};
		var nhtStats = null;
		if(nlLrReportRecords.isNHT()) {
			_updateNhtTab();
			var nhtHeader = [];
			for(var i=0; i<_nhtColumns.length; i++) {
				var col = _nhtColumns[i];
				if(col.canShow) nhtHeader.push(col);
			}
			var nhtArray = [{id: 'all', name: 'All'}];
			if(nlGroupInfo.isSubOrgEnabled()) nhtArray.push({id: 'subOrgId', name: 'Suborg Id'});
			nhtArray.push({id: 'organisationId', name: 'Organisation Id'});		
			nhtArray.push({id: 'batchName', name: 'Batch name'});
			nhtHeader = nhtArray.concat(nhtHeader);
			nhtStats = {statsCountDict: _nhtStatsDict, columns: nhtHeader};	
		}

		nlLrExporter.export($scope, reportRecords, _isAdmin, _customScoresHeader, drillDownStats, nhtStats);
	}
	
	function _onExportCustomReport() {
		if (nlLrFetcher.fetchInProgress()) return;
		var reportRecordsDict = nlLrReportRecords.getRecords();
		var customReportTemplate = _customReportTemplate || nlGroupInfo.getDefaultCustomReportTemplate();
		nlLrExporter.exportCustomReport($scope, reportRecordsDict, customReportTemplate);
	}
	
	function _onViewContent() {
		var objId = nlLrFilter.getObjectId();
		var type = nlLrFilter.getType();
		if(type == 'module_assign') {
			nl.window.location.href = nl.fmt2('/lesson/view_assign/{}', objId);
		} else {
			nlDlg.preventMultiCalls(true, _onCourseAssignView);
		}
	}
	
	var attendance = null;
	var milestone = null;
	var rating = null;
	var allModules = [];

	function _getCourseAssignmnt() {
		return nlGetManyStore.getRecord(nlGetManyStore.key('course_assignment', nlLrFilter.getObjectId()));
	}

	function _onCourseAssignView() {
		var courseAssignment = _getCourseAssignmnt();
		var learningRecords = nlLrReportRecords.getRecords();
		var content = _getContentOfCourseAssignment();
			attendance = courseAssignment.attendance ? angular.fromJson(courseAssignment.attendance) : {};
			attendance.not_attended = attendance.not_attended || {};
			milestone = courseAssignment.milestone ? angular.fromJson(courseAssignment.milestone) : {};
		allModules = [];
		for(var i=0; i<content.modules.length; i++) {
			var module = angular.copy(content.modules[i]);
			_initModule(module);
			allModules.push(module);
		}
		content.modules = allModules;
		var assignStatsViewerDlg = nlDlg.create($scope);
		assignStatsViewerDlg.setCssClass('nl-height-max nl-width-max');
		assignStatsViewerDlg.scope.dlgTitle = courseAssignment.info.name;
		assignStatsViewerDlg.scope.modules = _getSessionsAndModules(learningRecords);
		assignStatsViewerDlg.scope.selectedSession = assignStatsViewerDlg.scope.modules[0];
		assignStatsViewerDlg.scope.allowedAttrs = _getAllowedAttrs();
		if(assignStatsViewerDlg.scope.selectedSession.type != 'module') {
			_updateChartInfo(assignStatsViewerDlg.scope, learningRecords);
		}
		assignStatsViewerDlg.scope.onClick = function(e, cm) {
			assignStatsViewerDlg.scope.selectedSession = cm;
			if(cm.type === 'module') {
				nlTreeListSrv.toggleItem(cm);
				_showVisible(assignStatsViewerDlg);
				return;
			}
			assignStatsViewerDlg.scope.selectedSession = cm;
			_updateChartInfo(assignStatsViewerDlg.scope, learningRecords);
		};

		assignStatsViewerDlg.scope.getUrl = function(lessonId) {
			return nl.fmt2('/lesson/view/{}', lessonId);
		};

		var cancelButton = {text: nl.t('Close')};
		assignStatsViewerDlg.show('view_controllers/learning_reports/assignment_stats_viewer_dlg.html',
			[], cancelButton);
	}

	function _getAllowedAttrs() {
		var ret = [];
		for(var key in _attendanceObj) ret.push({attr: key, title: _attendanceObj[key].name, type: 'string'});
		ret = ret.concat([{attr:'success', title: 'Success', type:'string'}, {attr:'partial_success', title: 'Partially done', type:'string'}, 
				{attr:'failed', title: 'Failed', type:'string'}, {attr:'started', title: 'Started', type: 'string'}, 
				{attr:'pending', title: 'Pending', type: 'string'}, {attr:'total', title: 'Total', type:'total'}]);
		return ret;
	}
	
	function _initModule(cm) {
		nlTreeListSrv.addItem(cm);
		var retData = {lessPara: true};
		cm.textHtml = cm.text ? nlMarkup.getHtml(cm.text, retData): '';
		cm.planned_date = cm.planned_date ? nl.fmt.json2Date(cm.planned_date) : null;
		cm.start_date = cm.start_date ? nl.fmt.json2Date(cm.start_date) : null;
		if (!('maxAttempts' in cm) && cm.type == 'lesson') cm.maxAttempts = 1;
	}

	function _showVisible(assignStatsViewerDlg) {
		assignStatsViewerDlg.scope.modules = [];
		for(var i=0; i<allModules.length; i++) {
			var cm=allModules[i];
			if (!cm.visible) continue;
			assignStatsViewerDlg.scope.modules.push(cm);
		}
	};

	var _lessonLabels = ['done', 'failed', 'stated', 'pending'];
	var _LessonColours = [_nl.colorsCodes.done, _nl.colorsCodes.failed, _nl.colorsCodes.started, _nl.colorsCodes.pending];
	var _infoLabels = ['done', 'pending'];
	var _infoColours = [_nl.colorsCodes.done, _nl.colorsCodes.pending];
	var _milestoneLabels = ['done', 'pending'];
	var _milestoneColors = [_nl.colorsCodes.done, _nl.colorsCodes.pending]
	var _RatingLabels = ['done', 'partial', 'failed', 'pending'];
	var _RatingColors = [_nl.colorsCodes.done, _nl.colorsCodes.started, _nl.colorsCodes.failed, _nl.colorsCodes.pending]
	var _GateLabels = ['done', 'failed', 'pending'];
	var _GateColors = [_nl.colorsCodes.done, _nl.colorsCodes.failed, _nl.colorsCodes.pending];
	function _updateChartInfo(dlgScope, learningRecords) {
		if(dlgScope.selectedSession.type == 'lesson') {
			var ret = {labels: _lessonLabels, colours: _LessonColours};
			ret.data = [dlgScope.selectedSession.success.length, dlgScope.selectedSession.failed.length,
						dlgScope.selectedSession.started.length, dlgScope.selectedSession.pending.length];
			dlgScope.chartInfo = ret;
		} else if(dlgScope.selectedSession.type == 'iltsession') {
			var iltLabels = [];
			var iltColors = [];
			var data = [];
			for(var key in _attendanceObj) {
				iltLabels.push(_attendanceObj[key].name);
				data.push(dlgScope.selectedSession[key].length);
				iltColors.push(key == 'attended' ? _nl.colorsCodes.done : _nl.colorsCodes.failed);
			}
			data.push(dlgScope.selectedSession.pending.length);
			iltColors.push(_nl.colorsCodes.pending);
			iltLabels.push('pending');
			dlgScope.chartInfo = {labels: iltLabels, colours: iltColors, data: data};
		} else if(dlgScope.selectedSession.type == 'rating') {
			var ret = {labels: _RatingLabels, colours: _RatingColors};
			ret.data = [dlgScope.selectedSession.success.length, dlgScope.selectedSession.partial_success.length,
						dlgScope.selectedSession.failed.length, dlgScope.selectedSession.pending.length];
			dlgScope.chartInfo = ret;
		} else if(dlgScope.selectedSession.type == 'milestone') {
			var ret = {labels: _milestoneLabels, colours: _milestoneColors};
				ret.data = [dlgScope.selectedSession.success.length, dlgScope.selectedSession.pending.length];
				dlgScope.chartInfo = ret;
		} else if(dlgScope.selectedSession.type == 'gate') {
			var ret = {labels: _GateLabels, colours: _GateColors};
				ret.data = [dlgScope.selectedSession.success.length, dlgScope.selectedSession.failed.length, dlgScope.selectedSession.pending.length];
				dlgScope.chartInfo = ret;		
		} else {
			var ret = {labels: _infoLabels, colours: _infoColours};
			ret.data = [dlgScope.selectedSession.success.length, dlgScope.selectedSession.pending.length];
			dlgScope.chartInfo = ret;        	
		}
	}

	function _getSessionsAndModules(learningRecords) {
		var ret = [];
		var total = Object.keys(learningRecords).length;
		for(var i=0; i<allModules.length; i++) {
			var item = allModules[i];
			ret.push(item);
			if(item.type == 'module') continue;
			item.total = total;
			item['pending'] = [];
			
			if(item.type == 'iltsession') {
				for(var key in _attendanceObj) item[key] = [];
			} else {
				item['success'] = [];
				if(item.type == 'lesson' || item.type == 'rating' || item.type == 'gate') {
					item['failed'] = [];
					if(item.type == 'lesson') item['started'] = [];
					else if (item.type == 'rating') item['partial_success'] = [];
				}
			}
		}
	
		for(var key in learningRecords) {
			var repcontent = learningRecords[key].repcontent;
			var courseItemStatusInfos = repcontent.statusinfo || {};
			for(var j=0; j<ret.length; j++) {
				if(ret[j].type == 'module') continue;
				var courseItemStatusInfo = courseItemStatusInfos[ret[j].id] || {};
				var courseItemStatus = courseItemStatusInfo.status || 'pending'; 
				var bucket = ret[j].type == 'iltsession' ? courseItemStatusInfo.stateStr : courseItemStatus;
				if (courseItemStatus == 'pending' || courseItemStatus == 'waiting' || courseItemStatus == 'delayed'
					|| !bucket || !(bucket in ret[j])) bucket = 'pending';
				ret[j][bucket].push({id: parseInt(key), name: learningRecords[key].user.name});
			}
		}
		return ret;
	}

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	//Mark milestone for items inside the course
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	function _onClickOnMarkMilestone() {
		var courseAssignment = _getCourseAssignmnt();
		milestone = courseAssignment.milestone ? angular.fromJson(courseAssignment.milestone) : {};
		attendance = courseAssignment.attendance ? angular.fromJson(courseAssignment.attendance) : {};
		attendance = nlCourse.migrateCourseAttendance(attendance);
		rating = courseAssignment.rating ? angular.fromJson(courseAssignment.rating) : {};
		nlDlg.preventMultiCalls(true, _showMilestoneMarker);
	}

	var oldMilestone = {};
	var milestoneUpdated = false;
	function _showMilestoneMarker() {
		var milestoneDlg = nlDlg.create($scope);
		milestoneDlg.setCssClass('nl-height-max nl-width-max');
		var content = _getContentOfCourseAssignment();
		milestoneDlg.scope.milestones = _getMilestoneItems(content);
		milestoneDlg.scope.selectedItem = milestoneDlg.scope.milestones[0];
		oldMilestone = angular.copy(milestone);

		milestoneDlg.scope.onClick = function(selectedItem) {
			var currentMilestone = milestoneDlg.scope.selectedItem;
			delete selectedItem.error;
			var ret = _checkMilestoneIsMarked(milestoneDlg.scope, selectedItem);
			if(!ret.status)
				selectedItem.error = ret.name;
			milestoneDlg.scope.selectedItem = selectedItem;
		};

		milestoneDlg.scope.toggleLearnerMilestone = function(user) {
			if(user.attrition) return;
			user.marked = !user.marked;
		};

		milestoneDlg.scope.markOrUnmarkAll = function(selectedItem, state) {
			for(var i=0; i<selectedItem.learnersList.length; i++) {
				if(selectedItem.learnersList[i].attrition) continue;
				selectedItem.learnersList[i].marked = state;
			}
		};

		var okButton = {text: nl.t('Update milestone'), onTap: function(e) {
			var updateMilestoneList = [];
				milestone = {};
				e.preventDefault();
				milestoneUpdated = false;
			for(var i=0; i<milestoneDlg.scope.milestones.length; i++) {
				var _milestone = milestoneDlg.scope.milestones[i];				
				updateMilestoneList.push({id: _milestone.id, name:_milestone.name, selectedUsers: []});
				_updateMilestoneDelta(updateMilestoneList[i], _milestone)
				if(!_milestone.milestoneObj.status) continue;
				var _learnersList = _milestone.learnersList; 
				if(milestone[_milestone.id]) {
					for(var j=0; j<_learnersList.length; j++) {
						var learnerMilestone = _learnersList[j];
						if(learnerMilestone.attrition) continue;
						_updateLearnerMilestoneDelta(updateMilestoneList[i], milestone[_milestone.id], learnerMilestone);
					}
				}
			}
			if(!milestoneUpdated) {
				return nlDlg.popupAlert({title: 'Alert message', template: 'You have not made any changes. Please update milestone markings or press cancel in the milestone marking dialog if you do not wish to make any change.'});
			}
			nl.timeout(function() {
				_markingConfirmationDlg(milestoneDlg.scope, updateMilestoneList, 'milestone', milestone);
			});
		}};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
		}};
		milestoneDlg.show('view_controllers/learning_reports/mark_milestone_dlg.html',
		[okButton], cancelButton);

	}

	function _checkMilestoneIsMarked(dlgScope, selectedMilestone) {
		var _milestones = dlgScope.milestones;
		var pendingMilestone = null;
		for(var i=0; i<_milestones.length; i++) {
			var _milestone = _milestones[i];
			if(_milestone.milestoneNo == selectedMilestone.milestoneNo) {
				pendingMilestone = _milestone;
				break;
			} else if(_milestone.milestoneNo < selectedMilestone.milestoneNo && !_milestone.milestoneObj.status) {
				pendingMilestone = _milestone;
				break;
			}
		}
		if(pendingMilestone && pendingMilestone.milestoneNo != selectedMilestone.milestoneNo) 
			return {status: false, name: pendingMilestone.name}
		return {status: true};
	}
	
	function _getMilestoneItems(content, getOnlyMilestone) {
		var ret = [];
		var iltAndRatingIds = {};
		var learningRecords = nlLrReportRecords.getRecords();
		for(var i=0; i<content.modules.length; i++) {
			var item = content.modules[i];
			if(item.type == 'iltsession' || item.type == 'rating') iltAndRatingIds[item.id] = true;
			if(item.type != 'milestone') continue; 
			var _milestone = milestone[item.id] || {};
			ret.push({id: item.id, earlierItemIds: angular.copy(iltAndRatingIds), canMarkMilestone:true,  milestoneNo:i, name:item.name, 
						milestoneObj: {status: _milestone.status == 'done' ? true : false, comment:  _milestone.comment || ''}, 
						pendingIlts: [], pendingRatings: [], learnersList:[], attritedLearners:{}, learnersDict: _milestone.learnersDict || {}, unmarkedUsers: {}});
			iltAndRatingIds = {};
		}

		if(!getOnlyMilestone) {
			var sessions = _getIltSessions(content, learningRecords);
			var ratings = _getRatings(content, learningRecords, 'true', sessions);
			for(var i=0; i<ret.length; i++) {
				var _milestone = ret[i];
				var earlierSessions = _getEarlierItems(sessions, _milestone.earlierItemIds);
				//Check for earllier attendance items.
				for(var j=0; j<earlierSessions.length; j++) {
					var newAttendance = earlierSessions[j].newAttendance;
					for(var k=0; k<newAttendance.length; k++) {
						var userAttendance = newAttendance[k].attendance;
						var groupAttendendanceObj = _attendanceObj[userAttendance.id] || {};
						if(newAttendance[k].attrition || groupAttendendanceObj.isAttrition) {
							_milestone.attritedLearners[newAttendance[k].userid] = newAttendance[k].attritionStr || groupAttendendanceObj.name;
							continue;
						}
						if(!_milestone.canMarkMilestone) continue;
						if(userAttendance.id == "") {
							_milestone.pendingIlts.push(earlierSessions[j].name);
							_milestone.canMarkMilestone = false;
						}
	
					}
				}
			}
			//check for earlier ratings
			for(var i=0; i<ret.length; i++) {
				var _milestone = ret[i];
				var earlierItems = _getEarlierItems(ratings, _milestone.earlierItemIds);
				for(var j=0; j<earlierItems.length; j++) {
					var _ratings = earlierItems[j].rating;
					for(var k=0; k<_ratings.length; k++) {
						var userRating = _ratings[k].rating;
						if(earlierItems[j].ratingType == 'select') userRating = userRating.id;
						else if (earlierItems[j].ratingType != 'input') continue;
						if(!userRating && userRating !== 0 && !_ratings[k].attrition && _ratings[k].canRate != 'not_attended') {
							ret[i].pendingRatings.push(earlierItems[j].name);
							ret[i].canMarkMilestone = false;
							break;	
						}
					}
				}
			}	
		}

		var disableMilestoneMarking = {};
		for(var key in learningRecords) {
			var repid = parseInt(key);
			var user = learningRecords[key].user;
			var userid = user.user_id;
			for(var j=0; j<ret.length; j++) {
				var item = ret[j];
				var _markedMilestone = milestone[item.id] || {};
				var _learnersDict = _markedMilestone.learnersDict || {};
				var msUserObj = {id: repid, milestoneid: item.id, name: user.name, userid: userid, }
				if (repid in disableMilestoneMarking) {
					msUserObj.attrition = true;
					msUserObj.attritionStr = nl.t('Earlier milestone for learner is not marked', item.attritedLearners[userid]);
					item.unmarkedUsers[repid] = true;
				} else if(userid in item.attritedLearners) {
					msUserObj.attrition = true;
					msUserObj.attritionStr = nl.t('Learner {} earlier, milestone marking is disabled', item.attritedLearners[userid]);
				} else {
					if (repid in _learnersDict) {
						msUserObj.marked = _learnersDict[repid].marked == 'done' ? true : false;
						msUserObj.remarks = _learnersDict[repid].remarks;
					} else {
						msUserObj.marked = true;
						msUserObj.remarks = '';
					}
				}
				if ((repid in _learnersDict) && (_learnersDict[repid].marked == "pending")) {
					disableMilestoneMarking[repid] = true;
					item.unmarkedUsers[repid] = true;
				}
				item.learnersList.push(msUserObj);
			}
		}
		for(var i=0; i<ret.length; i++) {
			var learnersList = ret[i].learnersList;
			learnersList.sort(function(a, b) {
				if(b.name.toLowerCase() < a.name.toLowerCase()) return 1;
				if(b.name.toLowerCase() > a.name.toLowerCase()) return -1;
				if(b.name.toLowerCase() == a.name.toLowerCase()) return 0;				
			});
			ret[i].learnersList = learnersList;
		}		
		return ret;
	}

	function _getEarlierItems(sessions, earlierItemIds) {
		var ret = [];
		for(var i=0; i<sessions.length; i++) 
			if(sessions[i].id in earlierItemIds) ret.push(sessions[i]);
		return ret; //returns earlier or in between items.
	}

	function _updateMilestoneDelta(updateMilestoneList, newMilestone) {
		var oldObj = oldMilestone[newMilestone.id] || {};
		if(!oldObj.status) oldObj['status'] = '';
		if(!oldObj.comment) oldObj['comment'] = '';
		var newStatus = newMilestone.milestoneObj.status ? 'done' : oldObj['status'] == '' ? '' : 'pending';
		var reached = oldObj.reached || null;
		if(newMilestone.milestoneObj.status && oldObj.status != newStatus) reached = new Date();
		var updated = oldObj.updated || null;
		if(oldObj.status != newStatus || oldObj.comment !== newMilestone.milestoneObj.comment) {
			updateMilestoneList.selectedUsers.push({name: newMilestone.name, 
				status: newStatus,
				remarks: newMilestone.milestoneObj.comment || "", header: true});
			milestoneUpdated = true;
			updated = new Date();
		}
		if(updated || milestone.id in oldMilestone)
			milestone[newMilestone.id] = {status: newMilestone.milestoneObj.status ? 'done' : 'pending', comment: newMilestone.milestoneObj.comment, updated: updated, reached: reached};
	}

	function _updateLearnerMilestoneDelta(updateMilestoneList, currentMilestone, updatedLearnerMilestone) {
		if (!('learnersDict' in currentMilestone)) currentMilestone.learnersDict = {};
		var repid = updatedLearnerMilestone.id;  //updatedLearnerMilestone is {id: repid, remarks: '', milestoneid: _idxx, marked: true/false, updated: 213252}
		var oldMsObj = oldMilestone[updatedLearnerMilestone.milestoneid] || {};
		var	learnersDict = oldMsObj.learnersDict || {};
		if (!(repid in learnersDict) && updatedLearnerMilestone.marked && updatedLearnerMilestone.remarks == "") return;
		var oldMilestoneObj = learnersDict[repid] || {};
		if(!oldMilestoneObj.marked) oldMilestoneObj['marked'] = '';
		if(!oldMilestoneObj.remarks) oldMilestoneObj['remarks'] = '';
		var newStatus = updatedLearnerMilestone.marked ? 'done' : updatedLearnerMilestone.marked == '' ? '' : 'pending';
		var reached = oldMilestoneObj.reached || null;
		if(updatedLearnerMilestone.marked && oldMilestoneObj.marked != newStatus) reached = new Date();
		var updated = oldMilestoneObj.updated || !(repid in learnersDict) ? new Date() : null;
		if(oldMilestoneObj.marked !== newStatus || oldMilestoneObj.remarks !== updatedLearnerMilestone.remarks) {
			updateMilestoneList.selectedUsers.push({name: updatedLearnerMilestone.name, 
				status: newStatus,
				remarks: updatedLearnerMilestone.remarks || "", children: true});
			updated = new Date();
			milestoneUpdated = true;
		}
		if(updated || (repid in learnersDict))
			currentMilestone.learnersDict[repid] = {marked: updatedLearnerMilestone.marked ? 'done' : 'pending', remarks: updatedLearnerMilestone.remarks, updated: updated, reached: reached};
	}

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	//Mark attendance related code
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	function _onClickOnMarkAttendance() {
		var courseAssignment = _getCourseAssignmnt();
		milestone = courseAssignment.milestone ? angular.fromJson(courseAssignment.milestone) : {};
		attendance = courseAssignment.attendance ? angular.fromJson(courseAssignment.attendance) : {};
		attendance = nlCourse.migrateCourseAttendance(attendance);
		nlDlg.preventMultiCalls(true, _showAttendanceMarker);
	}

	var oldAttendance = {};
	function _showAttendanceMarker() {
		var markAttendanceDlg = nlDlg.create($scope);
		markAttendanceDlg.setCssClass('nl-height-max nl-width-max');
		var content = _getContentOfCourseAssignment();
		var learningRecords = nlLrReportRecords.getRecords();
		markAttendanceDlg.scope.attendanceOptions = _userInfo.groupinfo.attendance;
		markAttendanceDlg.scope.sessions = _getIltSessions(content, learningRecords);
		markAttendanceDlg.scope.selectedSession = markAttendanceDlg.scope.sessions[0];
		oldAttendance = {};
		oldAttendance = angular.copy(attendance);
		markAttendanceDlg.scope.onClick = function(session) {
			var currentSession = markAttendanceDlg.scope.selectedSession;
			if(session.sessionNo > currentSession.sessionNo) {
				var ret = _checkIfCurrentSessionIsCompletelyMarked(markAttendanceDlg.scope, currentSession, session);
				if(!ret.status) {
					nlDlg.popupAlert({title: 'Alert message', 
						template: ret.msg})
					return;	
				}
			}
			markAttendanceDlg.scope.selectedSession = session;
		};
		
		markAttendanceDlg.scope.bulkAttendanceMarker = function(e) {
			nlDlg.preventMultiCalls(true, function() {
				_showbulkMarkerDlg(markAttendanceDlg.scope, 'attendance');
			});
		};

		var okButton = {text: nl.t('Mark attendance'), onTap: function(e) {
			var updatedSessionsList = [];
				attendance = {};
				attendanceUpdated = false;
				e.preventDefault();
			for(var i=0; i<markAttendanceDlg.scope.sessions.length; i++) {
				var session = markAttendanceDlg.scope.sessions[i];
				updatedSessionsList.push({id: session.id, name:session.name, isUpdated: false, selectedUsers: []});
				for(var j=0; j<session.newAttendance.length; j++) {
					var userSessionAttendance = session.newAttendance[j];
					if(userSessionAttendance.attendance.id == '' && userSessionAttendance.remarks == '') continue;
					if(!_validateAttendance(userSessionAttendance)) {
						nlDlg.popupAlert({title: 'Error', template: nl.t('Remarks mandatory for {} of {}', userSessionAttendance.name, session.name)});
						return;
					}
					_updateAttendanceDelta(updatedSessionsList[i], userSessionAttendance);
				}
			}
			if(!attendanceUpdated) {
				return nlDlg.popupAlert({title: 'Alert message', template: 'You have not made any changes. Please update attendance markings or press cancel in the attendance dialog if you do not wish to make any change.'});
			}
			for(var i=0; i<updatedSessionsList.length; i++) {
				var selectedUsers = updatedSessionsList[i].selectedUsers || [];
				selectedUsers.sort(function(a, b) {
					if(b.name.toLowerCase() < a.name.toLowerCase()) return 1;
					if(b.name.toLowerCase() > a.name.toLowerCase()) return -1;
					if(b.name.toLowerCase() == a.name.toLowerCase()) return 0;				
				});
				updatedSessionsList[i].selectedUsers = selectedUsers;
			}
			nl.timeout(function() {
				_markingConfirmationDlg(markAttendanceDlg.scope, updatedSessionsList, 'attendance', attendance);
			});
		}};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
		}};
		markAttendanceDlg.show('view_controllers/learning_reports/mark_attendance_dlg.html',
		[okButton], cancelButton);
	}

	function _checkIfCurrentSessionIsCompletelyMarked(dlgScope, currentSession, selectedSession) {
		var currentSessionAttendance = currentSession.newAttendance;
		var sessions = dlgScope.sessions;
		var msg = '<div class="padding-mid fsh6"><p style="line-height:30px">Please mark attendance for all learners in all the earlier sessions before marking attendance for this session.</p></div>';
		for(var i=0; i<currentSessionAttendance.length; i++) {
			var userSession = currentSessionAttendance[i];
			var attendance = userSession.attendance;
			if(attendance.id == "" && !userSession.attrition) {
				return {status: false, msg: msg};
			}
		}
		var pendingSession = null;
		for(var i=0; i<sessions.length; i++) {
			var session = sessions[i];
			if(session.sessionNo == selectedSession.sessionNo) {
				pendingSession = selectedSession;			
				break;
			}
			for(var j=0; j<session.newAttendance.length; j++) {
				var userSession = session.newAttendance[j];
				var attendance = userSession.attendance;
				if(attendance.id == "" && !userSession.attrition) pendingSession = session;
			}
			if(pendingSession) break;
		}
		if(pendingSession.sessionNo < selectedSession.sessionNo)
			return {status: false, msg: msg};
		return {status: true};
	}

	function _validateAttendance(userSessionAttendance) {
		var remarks = (userSessionAttendance.remarkOptions && userSessionAttendance.remarkOptions.length > 0) ? userSessionAttendance.remarks.id : (userSessionAttendance.remarks || '');
		if (userSessionAttendance.attendance.id == '') return true;
		var selectedAttendance = _attendanceObj[userSessionAttendance.attendance.id] || {};
		if (selectedAttendance.timePerc != 100 && (!remarks || remarks == "")) return false;
		return true;
	}

	var attendanceUpdated = false; //This flag is to check whether the trainer had done changes to mark or not

	function _updateAttendanceDelta(updateSessionList, newAttendancePerSession) {
		var repid = newAttendancePerSession.id;
		var sessionid = updateSessionList.id;
		var oldAttendancePerSession = {};  //This is {id: sessionid1, remarks: '', attId: 'attended/not-attended/medical_leave', marked: 1222, updated: 213252}
		var oldAttendancePerReport = oldAttendance[repid] || []; //repid: [{id: sessionid1, attId: 'attended', remarks: '' },{id: sessionid2, attId: 'not_attended', remarks: '' }.....]
		for(var i=0; i<oldAttendancePerReport.length; i++) {
			var sessionAttendance = oldAttendancePerReport[i];
			if(sessionAttendance.id != sessionid) continue;
			oldAttendancePerSession = sessionAttendance;
			break;
		}
		if(!oldAttendancePerSession.attId) oldAttendancePerSession['attId'] = '';
		if(!oldAttendancePerSession.remarks) oldAttendancePerSession['remarks'] = '';
		var marked = oldAttendancePerSession.marked || null;
		var updated = oldAttendancePerSession.updated || null;
		var _remarks = (newAttendancePerSession.remarkOptions && newAttendancePerSession.remarkOptions.length > 0) ? newAttendancePerSession.remarks.name : (newAttendancePerSession.remarks || "");
		if(oldAttendancePerSession.attId != newAttendancePerSession.attendance.id || oldAttendancePerSession.remarks !== _remarks) {
			updateSessionList.selectedUsers.push({name: newAttendancePerSession.name, 
				status: (newAttendancePerSession.attendance.id in _attendanceObj) ? _attendanceObj[newAttendancePerSession.attendance.id].name : '', 
				remarks: _remarks});
			attendanceUpdated = true;
			updated = new Date();
			if (oldAttendancePerSession.attId != newAttendancePerSession.attendance.id) marked = updated;
		}
		if(!(repid in attendance)) attendance[repid] = [];
		var userAttendance = {id: sessionid, attId: newAttendancePerSession.attendance.id, updated: updated, marked: marked, remarks: _remarks}
		attendance[repid].push(userAttendance);
	}

	function _getAboveMilestone(milestonesItems, milestoneid) {
		for(var i=0; i<milestonesItems.length; i++) {
			var _ms = milestonesItems[i];
			if(_ms.id == milestoneid) return _ms;
		}
	}

	function _getIltSessions(content, learningRecords) {
		var ret = [];
		var milestoneItems = _getMilestoneItems(content, true);
		var remarks = _groupInfo.props.attendanceRemarks || [];
		var _remarkOptions = [];
		if(remarks.length > 0) {
			_remarkOptions.push({id: '', name: ''});
			for(var i=0; i<remarks.length; i++) _remarkOptions.push({id: remarks[i], name: remarks[i]})
		}
		var lastMilestone = null;
		var previousMilestoneIds = {};
		for(var i=0; i<content.modules.length; i++) {
			var item = content.modules[i];
			if(item.type == 'milestone') {
				lastMilestone = content.modules[i];
				previousMilestoneIds[item.id] = true;
			}
			if(item.type != 'iltsession') continue; 
			var dict = {id: item.id, name:item.name, sessionNo: i, newAttendance: [], canMarkAttendance: true, previousMs: angular.copy(previousMilestoneIds)};
			if(lastMilestone) {
				var aboveMilestone = _getAboveMilestone(milestoneItems, lastMilestone.id);
				if(!aboveMilestone.milestoneObj.status) {
					dict.canMarkAttendance = false;
					dict.error = aboveMilestone.name;
				}	
			}
			ret.push(dict);
		}
		
		for(var key in learningRecords) {
			var userAttendance = attendance[parseInt(key)] || [];
			var user = learningRecords[key].user;
			var stats = learningRecords[key].stats;
			var attritionStr = learningRecords[key].stats.attritionStr || '';
			var disableMarkingStr = '';
			var attrition = false;
			var repid = parseInt(key);
			for(var j=0; j<ret.length; j++) {
				var notMarked = true;
				if(!attrition) {
					var  canMarkLearner = _canMarkLearner(milestoneItems, ret[j].previousMs, repid);
					if(!canMarkLearner) {
						attrition = true;
						disableMarkingStr = nl.t('Earlier milestone for this learner is not marked');
					}
				}
				for(var k=0; k<userAttendance.length; k++) {
					if (ret[j].id == userAttendance[k].id) {
						notMarked = false;
						var attendanceObj = {id: repid, name: user.name, attendance: {id: userAttendance[k].attId}, 
											remarks: userAttendance[k].remarks || '', userid: user.user_id, attrition: attrition, 
											attritionStr: attritionStr, disableMarkingStr: disableMarkingStr}
						if(_remarkOptions.length > 0) {
							attendanceObj.remarkOptions = angular.copy(_remarkOptions);
							attendanceObj.remarks = {name: userAttendance[k].remarks, id: userAttendance[k].remarks};
						}
						ret[j].newAttendance.push(attendanceObj);
						break;
					}
				}
				if(notMarked) {
					var attendanceObj = {id: repid, name: user.name, attendance: {id: ''}, userid: user.user_id, remarks: '', 
										 attrition: attrition, attritionStr: attritionStr, canMarkLearner: canMarkLearner};
					if(_remarkOptions.length > 0) {
						attendanceObj.remarkOptions = angular.copy(_remarkOptions);
						attendanceObj.remarks = {id: '', name: ''};
					}
					ret[j].newAttendance.push(attendanceObj);
				}
				if(stats.attritedAt == ret[j].id) attrition = true;
			}
		}

		for(var i=0; i<ret.length; i++) {
			var newAttendance = ret[i].newAttendance;
			newAttendance.sort(function(a, b) {
				if(b.name.toLowerCase() < a.name.toLowerCase()) return 1;
				if(b.name.toLowerCase() > a.name.toLowerCase()) return -1;
				if(b.name.toLowerCase() == a.name.toLowerCase()) return 0;				
			});

			ret[i].newAttendance = newAttendance;
		}
		return ret;
	}

	function _canMarkLearner(milestoneItems, previousMs, repid) {
		for(var i=0; i<milestoneItems.length; i++) {
			var _ms = milestoneItems[i];
			var unmarkedUsers = milestoneItems[i].unmarkedUsers;
			if((_ms.id in previousMs) && (repid in unmarkedUsers)) return false;
		}
		return true;
	}
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	//Mark ratings related code
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	var oldRating = {};
	var ratingUpdated = false;
	function _onClickOnMarkRatings() {
		var courseAssignment = _getCourseAssignmnt();
		milestone = courseAssignment.milestone ? angular.fromJson(courseAssignment.milestone) : {};
		rating = courseAssignment.rating ? angular.fromJson(courseAssignment.rating) : {};
		attendance = courseAssignment.attendance ? angular.fromJson(courseAssignment.attendance) : {};
		attendance = nlCourse.migrateCourseAttendance(attendance);
		nlDlg.preventMultiCalls(true, _showRatingMarker);
	}

	function _showRatingMarker() {
		var ratingDlg = nlDlg.create($scope);
		ratingDlg.setCssClass('nl-height-max nl-width-max');
		var content = _getContentOfCourseAssignment();
		var learningRecords = nlLrReportRecords.getRecords();
		ratingDlg.scope.ratings = _getRatings(content, learningRecords, 'true');
		ratingDlg.scope.selectedRating = ratingDlg.scope.ratings[0];
		oldRating = {};
		oldRating = angular.copy(rating);
		ratingDlg.scope.onClick = function(item) {
			ratingDlg.scope.selectedRating = item;
		};
		ratingDlg.scope.bulkRatingMarker = function(e) {
			nlDlg.preventMultiCalls(true, function() {
				_showbulkMarkerDlg(ratingDlg.scope, 'rating');
			});
		};

		ratingDlg.scope.onDropdownItemSelected = function(user, item) {
			item.selected = !item.selected;
			var remarks = [];
			for(var i=0; i<user.remarkOptions.length; i++) {
				var remark = user.remarkOptions[i];
				if(remark.selected) remarks.push(remark.name);
			}
			user.remarks = nl.fmt.arrayToString(remarks);
		}

		var okButton = {text: nl.t('Provide rating'), onTap: function(e) {
			var updatedSessionsList = [];
				rating = {};
				ratingUpdated = false;
				e.preventDefault();
			for(var i=0; i<ratingDlg.scope.ratings.length; i++) {
				var ratingItem = ratingDlg.scope.ratings[i];
				updatedSessionsList.push({id: ratingItem.id, name:ratingItem.name, rating_type: ratingItem.ratingType, selectedUsers: []});
				for(var j=0; j<ratingItem.rating.length; j++) {
					var userRating = ratingItem.rating[j];
					if(ratingItem.ratingType == 'input' && ((userRating.rating != 0 && (!userRating.rating || userRating.rating === null)) && !userRating.remarks)) continue;
					if(ratingItem.ratingType == 'select' && ((userRating.rating.id != 0 && !userRating.rating.id) && !userRating.remarks)) continue;
					if(ratingItem.ratingType == 'select' && (userRating.remarkOptions && userRating.remarkOptions.length > 0)) {
						if(!_validateRating(userRating)) {
							return nlDlg.popupAlert({title: 'Validation error', template: nl.t('Remarks mandatory for {} of {}', userRating.name, ratingItem.name)})
						}
					}
					_updateRatingDelta(updatedSessionsList[i], userRating);
				}
			}
			if(!ratingUpdated) {
				return nlDlg.popupAlert({title: 'Alert message', template: 'You have not made any changes. Please provide ratings or press cancel in the rating dialog if you do not wish to make any change.'});
			}
			for(var i=0; i<updatedSessionsList.length; i++) {
				var selectedUsers = updatedSessionsList[i].selectedUsers || [];
				selectedUsers.sort(function(a, b) {
					if(b.name.toLowerCase() < a.name.toLowerCase()) return 1;
					if(b.name.toLowerCase() > a.name.toLowerCase()) return -1;
					if(b.name.toLowerCase() == a.name.toLowerCase()) return 0;				
				});
				updatedSessionsList[i].selectedUsers = selectedUsers;
			}
			nl.timeout(function() {
				_markingConfirmationDlg(ratingDlg.scope, updatedSessionsList, 'rating', rating);
			});
		}};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
		}};
		ratingDlg.show('view_controllers/learning_reports/mark_rating_dlg.html',
		[okButton], cancelButton);
	}

	function _validateRating(userRating) {
		if(userRating.rating.id === "") return true;
		if(userRating.rating.id != 100 && (!userRating.remarks || userRating.remarks == '')) return false;
		return true;
	}

	function _updateRatingDelta(updateSessionList, newRatingPerItem) {
		var repid = newRatingPerItem.id;
		var sessionid = updateSessionList.id;
		var oldRatingPerItem = {};  //This is {id: itemid1, remarks: '', attId: '0-100'}
		var oldRatingPerUserReport = oldRating[repid] || []; //repid: [{id: sessionid1, attId: 'attended', remarks: '' },{id: sessionid2, attId: 'not_attended', remarks: '' }.....]
		for(var i=0; i<oldRatingPerUserReport.length; i++) {
			var itemRating = oldRatingPerUserReport[i];
			if(itemRating.id != sessionid) continue;
			var _remark = angular.copy(itemRating.remarks);
			_remark = nl.fmt.arrayToString(itemRating.remarks);
			itemRating.remarks = _remark;
			oldRatingPerItem = itemRating;
			break;
		}
		if(!('attId' in oldRatingPerItem)) oldRatingPerItem['attId'] = '';
		if(!oldRatingPerItem.remarks) oldRatingPerItem['remarks'] = '';
		var dict = {name: newRatingPerItem.name};
		var marked = oldRatingPerItem.marked || null;
		var updated = oldRatingPerItem.updated || null;
		if(updateSessionList.rating_type == 'input') {
			if(newRatingPerItem.rating !== null && (oldRatingPerItem.attId !== newRatingPerItem.rating || oldRatingPerItem.remarks !== newRatingPerItem.remarks)) {
				updateSessionList.selectedUsers.push({name: newRatingPerItem.name, 
					status: (newRatingPerItem.rating === 0) ? 0 : newRatingPerItem.rating, 
					remarks: newRatingPerItem.remarks || ""});
				ratingUpdated = true;	
				updated = new Date();
				if (oldRatingPerItem.attId !== newRatingPerItem.rating) marked = updated;
			}
		} else if(updateSessionList.rating_type == 'select') {
			if(oldRatingPerItem.attId !== newRatingPerItem.rating.id || oldRatingPerItem.remarks != newRatingPerItem.remarks) {
				updateSessionList.selectedUsers.push({name: newRatingPerItem.name, 
					status: newRatingPerItem.rating.name || '', 
					remarks: newRatingPerItem.remarks || ""});
				ratingUpdated = true;	
				updated = new Date();
				if (oldRatingPerItem.attId !== newRatingPerItem.rating) marked = updated;
			}
		}

		if(!(repid in rating)) rating[repid] = [];
		if(updateSessionList.rating_type == 'input') {
			var _remarks = []; 
			if(Array.isArray(newRatingPerItem.remarks)) 
				_remarks = newRatingPerItem.remarks;
			else 
				_remarks = [newRatingPerItem.remarks]
			rating[repid].push({id: sessionid, attId: (newRatingPerItem.rating === 0) ? 0 : newRatingPerItem.rating, remarks: _remarks, marked: marked, updated: updated});
		}

		if(updateSessionList.rating_type == 'select') {
			var _userRating = {id: sessionid, attId: newRatingPerItem.rating.id, marked: marked, updated: updated}
			if(newRatingPerItem.remarkOptions && newRatingPerItem.remarkOptions.length > 0) {
				var _remarkArray = [];
				for(var i=0; i<newRatingPerItem.remarkOptions.length; i++) {
					var remark = newRatingPerItem.remarkOptions[i];
					if(remark.selected) _remarkArray.push(remark.name);
				}
				_userRating.remarks = _remarkArray;
			} else {
				_userRating.remarks = [newRatingPerItem.remarks];
			}
			rating[repid].push(_userRating);
		}
	}

	function _getRatings(content, learningRecords, isFirstTime, sessions) {
		var ret = [];
		var lastMilestone = null;
		var previousILTItem = null;
		var milestoneItems = _getMilestoneItems(content, true);
		var previousMilestoneIds = {};
		for(var i=0; i<content.modules.length; i++) {
			var item = content.modules[i];
			if(item.type == 'milestone') {
				previousMilestoneIds[item.id] = true;
				lastMilestone = content.modules[i];
			}
			if(item.type == 'iltsession') previousILTItem = content.modules[i]
			if(item.type != 'rating') continue;
			var dict = {id: item.id, name:item.name, rating_type: item.rating_type, rating: [], 
						ratingOptions: [], remarkOptions: [], canMarkRating: true, previousMs: angular.copy(previousMilestoneIds)};
			_checkAndUpdateRatingParams(dict);
			if(lastMilestone) {
				var aboveMilestone = _getAboveMilestone(milestoneItems, lastMilestone.id);
				if(!aboveMilestone.milestoneObj.status) {
					dict.canMarkRating = false;
					dict.error = aboveMilestone.name;
				}	
			}
			if(previousILTItem) dict.previousILT = previousILTItem;
			ret.push(dict);
		}
		if(!sessions) sessions = _getIltSessions(content, learningRecords);
		var _sessionsDict = {};
		for(var i=0; i<sessions.length; i++) {
			var _session = sessions[i];
			if(!(_session.id in _sessionsDict)) _sessionsDict[_session.id] = {};
			for(var j=0; j<_session.newAttendance.length; j++) {
				var _userObj = _session.newAttendance[j];
				if(_userObj.attendance.id === '') {
					_sessionsDict[_session.id][_userObj.id] = {timePerc: '', name: _session.name};
				} else {
					_sessionsDict[_session.id][_userObj.id] = {timePerc: (_userObj.attendance.id in _attendanceObj) ? _attendanceObj[_userObj.attendance.id].timePerc : 0 , name: _session.name};
				}
			}
		}
		for(var key in learningRecords) {
			var user = learningRecords[key].user;
			var repid = parseInt(key);
			var _statusinfo = learningRecords[key].repcontent.statusinfo;
			var stats = learningRecords[key].stats;
			for(var j=0; j<ret.length; j++) {
				var ratingItem = ret[j];
				var statusinfo = _statusinfo[ret[j].id];
				var attrition = (statusinfo.status == 'waiting' && statusinfo.isAttrition) || false;
				var attritionStr = stats.attritionStr || '';
				var disableMarkingStr = '';
				if(!attrition) {
					var canMarkLearner = _canMarkLearner(milestoneItems, ret[j].previousMs, repid);
					if(!canMarkLearner) {
						attrition = true;
						disableMarkingStr = nl.t('Earlier milestone for this learner is not marked');
					}
				}
				var iltStats = _sessionsDict[ratingItem.previousILT.id][repid];
				var _dict = {id: repid, name: user.name, userid: user.user_id, remarks: nl.fmt.arrayToString(statusinfo.remarks || ''), attrition: attrition, attritionStr: attritionStr, disableMarkingStr: disableMarkingStr};
				if(iltStats.timePerc === '') {
					_dict.canRate = 'pending';
					_dict.errorStr = nl.t('Attedance not marked.')
				} else if (iltStats.timePerc === 0) {
					_dict.canRate = 'not_attended';
					_dict.errorStr = nl.t('Learner not attended')
				} else {
					_dict.canRate = 'attended';
				}
				if(statusinfo.status == 'pending') {
					if(ret[j].ratingType == 'input') {
						_dict.rating = null;
						ret[j].rating.push(_dict);
					} else if(ret[j].ratingType == 'select') {
						_dict.rating = {id: ''};
						if(ret[j].remarkOptions.length > 0) {
							_dict['remarkOptions'] = angular.copy(ret[j].remarkOptions);
							_updateSelectedRating(statusinfo.remarks, _dict['remarkOptions']);
						}
						ret[j].rating.push(_dict);
					}
				} else {
					if(ret[j].ratingType == 'input') {
						_dict.rating = statusinfo.origScore;
						ret[j].rating.push(_dict);
					} else if(ret[j].ratingType == 'select') {
						_dict.rating = {id: statusinfo.origScore, name: statusinfo.rating};
						if(ret[j].remarkOptions.length > 0) {
							_dict['remarkOptions'] = angular.copy(ret[j].remarkOptions);
							_updateSelectedRating(statusinfo.remarks, _dict['remarkOptions']);
						}
						ret[j].rating.push(_dict);
					}
				}
			}
		}

		for(var i=0; i<ret.length; i++) {
			var newRating = ret[i].rating;
			newRating.sort(function(a, b) {
				if(b.name.toLowerCase() < a.name.toLowerCase()) return 1;
				if(b.name.toLowerCase() > a.name.toLowerCase()) return -1;
				if(b.name.toLowerCase() == a.name.toLowerCase()) return 0;				
			});

			ret[i].rating = newRating;
		}
		return ret;
	}

	function _updateSelectedRating(remarks, remarkOptions) {
		if (!Array.isArray(remarks)) return;
		for(var i=0; i<remarks.length; i++) {
			var remark = remarks[i];
			for(var j=0; j<remarkOptions.length; j++) {
				var option = remarkOptions[j];
				if(remark == option.name) option.selected = true;
			}
		}
	}

	function _checkAndUpdateRatingParams(item) {
		for(var i=0; i<_groupInfo.props.ratings.length; i++) {
			var rating = _groupInfo.props.ratings[i];
			if(item.rating_type == rating.id) {
				if(rating.type == 'number') {
					item.ratingType = 'input';
					break;
				}
				if(rating.type != 'status' && rating.type != 'select') break;
				item.ratingOptions = [];
				item.ratingType = 'select';
				for(var k=0; k<rating.values.length; k++) {
					item.ratingOptions.push({id: rating.values[k]['p'], name: rating.values[k]['v']});
				}
				if (rating.remarks && rating.remarks.length > 0) {
					for (var l=0; l<rating.remarks.length; l++) {
						var remark = rating.remarks[l];
						item.remarkOptions.push({id:l, name:remark, selected:false});
					}
				}
			}
		}
	}

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	//common code accorss making attendance and rating
	//---------------------------------------------------------------------------------------------------------------------------------------------------------	
	function _showbulkMarkerDlg(dlgScope, markType) {
		var bulkMarkerDlg = nlDlg.create(dlgScope);
		if(markType == 'rating') {
			bulkMarkerDlg.scope.selectedItem = dlgScope.selectedRating;
			bulkMarkerDlg.scope.markingOptions = dlgScope.selectedRating.ratingOptions;
			bulkMarkerDlg.scope.rating_type = dlgScope.selectedRating.ratingType;
			bulkMarkerDlg.scope.selectedMarkingType = null;
			bulkMarkerDlg.scope.data = {ratingNumber: '', bulkMarkStr: 'Mark all learners rating as'};	
		}

		if(markType == 'attendance') {
			bulkMarkerDlg.scope.selectedItem = dlgScope.selectedSession;
			bulkMarkerDlg.scope.markingOptions = angular.copy(_userInfo.groupinfo.attendance);
			bulkMarkerDlg.scope.selectedMarkingType = null;	
			bulkMarkerDlg.scope.rating_type = 'select';
			bulkMarkerDlg.scope.data = {ratingNumber: '', bulkMarkStr: 'Mark all learners attendance as'};	
		}

		bulkMarkerDlg.scope.selectForBulkMarking = function(opt) {
			bulkMarkerDlg.scope.selectedMarkingType = opt;
			for(var i=0; i<bulkMarkerDlg.scope.markingOptions.length; i++) {
				var item = bulkMarkerDlg.scope.markingOptions[i];
				if(item.id == opt.id) 
					item.selected = !item.selected;
				else 
					item.selected = false;
			}
		};

		var okButton = {text: nl.t('Confirm to mark'), onTap: function(e){
			for(var i=0; i<bulkMarkerDlg.scope.markingOptions.length; i++) {
				if(bulkMarkerDlg.scope.markingOptions[i].selected) bulkMarkerDlg.scope.selectedMarkingType = bulkMarkerDlg.scope.markingOptions[i];
			}

			if(markType == 'attendance') {
				if(!bulkMarkerDlg.scope.selectedMarkingType){
					e.preventDefault();
					return nlDlg.popupAlert({title: 'Please select', template: 'Please select the attendance type to mark all'});
				}
				for(var i=0; i<dlgScope.selectedSession.newAttendance.length; i++) {
					if(dlgScope.selectedSession.newAttendance[i].attrition) continue;
					dlgScope.selectedSession.newAttendance[i].attendance = bulkMarkerDlg.scope.selectedMarkingType;
				}
			}

			if(markType == 'rating') {
				if(!(bulkMarkerDlg.scope.selectedMarkingType || bulkMarkerDlg.scope.data.ratingNumber >= 0)){
					e.preventDefault();
					return nlDlg.popupAlert({title: 'Please select', template: 'Please provide ratings to mark all'});
				}
				for(var i=0; i<dlgScope.selectedRating.rating.length; i++) {
					if(dlgScope.selectedRating.rating[i].attrition || dlgScope.selectedRating.rating[i].canRate == 'pending') continue;
					if(dlgScope.selectedRating.ratingType == 'select'){
						dlgScope.selectedRating.rating[i].rating = bulkMarkerDlg.scope.selectedMarkingType;
					} else {
						dlgScope.selectedRating.rating[i].rating = bulkMarkerDlg.scope.data.ratingNumber;
					}
				}
			}
			bulkMarkerDlg.scope.onCloseDlg();
		}};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
		}};
		bulkMarkerDlg.show('view_controllers/learning_reports/bulk_marker_dlg.html',
			[okButton], cancelButton);
	}

	function _markingConfirmationDlg(dlgScope, markedSessions, paramName, paramObj) {
		var confirmationDlg = nlDlg.create($scope);
		confirmationDlg.setCssClass('nl-height-max nl-width-max');
		confirmationDlg.scope.markedSessions = markedSessions;
		confirmationDlg.scope.paramName = paramName;
		if(paramName == 'attendance') {
			if(!('attendance_version' in attendance)) 
			attendance['attendance_version'] = nlCourse.getAttendanceVersion();
		}
		var buttonText = nl.t('Confirm {}', paramName);
		var okButton = {text: buttonText, onTap: function(e) {
			var data = {paramName: paramName, paramObject: paramObj, assignid: nlLrFilter.getObjectId()};
			nlDlg.showLoadingScreen();
			nlServerApi.courseUpdateParams(data).then(function(result) {
				nlDlg.hideLoadingScreen();
				nlDlg.closeAll();
				var srvUpdateFn = null;
				if(result && (paramName == 'attendance')) {
					attendance = result;
					srvUpdateFn = nlGetManyStore.updateAttendanceInRecord;
				}
				if(result && (paramName == 'rating')) {
					rating = result;
					srvUpdateFn = nlGetManyStore.updateRatingInRecord;
				}
				if(result && (paramName == 'milestone')) {
					milestone = result;
					srvUpdateFn = nlGetManyStore.updateMilestoneInRecord;
				}
				var jsonStr = angular.toJson(result);
				srvUpdateFn(nlGetManyStore.key('course_assignment', nlLrFilter.getObjectId()), jsonStr);
				_updateReportRecords();
			});
		}};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
			//confirmationDlg.scope.onCloseDlg(e, null);
		}};
		confirmationDlg.show('view_controllers/learning_reports/marking_confirmation_dlg.html',
			[okButton], cancelButton);
	}

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	//Code for modifying assignment
	//---------------------------------------------------------------------------------------------------------------------------------------------------------	

	function _onClickModifyAssignment() {
		var launchType = nlLrFilter.getType(); 
		var nominatedUsers = nlLrReportRecords.getNominatedUserDict();
		var record = nlLrReportRecords.getAnyRecord();
		var key = '';
		var enableSubmissionAfterEndtime = false;
		if (launchType == 'module_assign') {
			key = 'assignment';
			enableSubmissionAfterEndtime = true;
		} else if (launchType == 'course_assign') {
			key = 'course_assignment';
		}
		key = nlGetManyStore.key(key, nlLrFilter.getObjectId());
		var assignRec = nlGetManyStore.getRecord(key);
		if (!assignRec) {
			nlDlg.popupAlert({title: 'Error', template: 'Cannot get the assignment information.'});
			return;
		}
		var assignContent = launchType == 'course_assign' ? assignRec.info : assignRec;
		var assignInfo = {isModify: true, dlgTitle: 'Modify assignment properties',
			assigntype: (launchType == 'course_assign') ? 'course' : 'lesson',
			assignid: nlLrFilter.getObjectId(),
		
			title: assignContent.name,
			icon: launchType == 'module_assign' ? nl.url.lessonIconUrl(assignContent.image) : assignContent.icon,
			showDateField: true,
			hideEmailNotifications: false,
			enableSubmissionAfterEndtime: enableSubmissionAfterEndtime,
			
			batchname: assignContent.batchname,
			remarks: launchType == 'module_assign' ? assignContent.assign_remarks : assignContent.remarks,
			starttime: assignContent.not_before || '', 
			endtime: assignContent.not_after || '', 
			msDates: assignContent.msDates || null,
			submissionAfterEndtime: assignContent.submissionAfterEndtime,
			dontShowUsers: nominatedUsers};
			
		if (assignContent.batchtype) assignInfo.batchtype = assignContent.batchtype;
		if (launchType == 'module_assign') {
			assignInfo.esttime = assignContent.max_duration;
			assignInfo.learnmode = assignContent.learnmode; // TODO: This is not shown in GUI due to error.
		} else {
			assignInfo.blended = assignContent.blended || false;
			assignInfo.modifiedILT = _getModifiedILT(assignContent.modifiedILT, record.course.content);
			assignInfo.iltTrainerName = assignContent.iltTrainerName || '';
			assignInfo.iltVenue = assignContent.iltVenue || '';
			assignInfo.iltCostInfra = assignContent.iltCostInfra || '';
			assignInfo.iltCostTrainer = assignContent.iltCostTrainer || '';
			assignInfo.iltCostFoodSta = assignContent.iltCostFoodSta || '';
			assignInfo.iltCostTravelAco = assignContent.iltCostTravelAco || '';
			assignInfo.iltCostMisc = assignContent.iltCostMisc || '';
			assignInfo.course = nlGetManyStore.getRecord(nlGetManyStore.key('course', assignContent.courseid));
		}
		nlSendAssignmentSrv.show($scope, assignInfo, _userInfo).then(function(result) {
			if (!result) return;
			
			assignContent.batchname = result.batchname;
			if(result.batchtype) assignContent.batchtype = result.batchtype;
			assignContent.not_before = result.not_before || '';
			assignContent.not_after = result.not_after || '';
			assignContent.submissionAfterEndtime = result.submissionAfterEndtime;
			if (launchType == 'module_assign') {
				assignContent.assign_remarks = result.remarks;
				assignContent.max_duration = result.max_duration;
				assignContent.learnmode = result.learnmode;
			} else {
				assignContent.remarks = result.remarks;
				if (assignContent.blended) {
					assignContent.modifiedILT = result.modifiedILT || {};
					assignContent.iltTrainerName = result.iltTrainerName || '';
					assignContent.iltVenue = result.iltVenue || '';
					assignContent.iltCostInfra = result.iltCostInfra || '';
					assignContent.iltCostTrainer = result.iltCostTrainer || '';
					assignContent.iltCostFoodSta = result.iltCostFoodSta || '';
					assignContent.iltCostTravelAco = result.iltCostTravelAco || '';
					assignContent.iltCostMisc = result.iltCostMisc || '';
				}
			}
			if(result.selectedusers.length > 0) {
				nl.window.location.reload();
			} else {
				nlGetManyStore.addRecord(key, assignRec);
				_updateReportRecords();
			}
		});
	}

	function _getModifiedILT(modifiedILT, content) {
		if(!modifiedILT) return {};
		var ret = {};
		if (!content || !content.modules) return ret;
		for(var i=0; i<content.modules.length; i++) {
			var item = content.modules[i];
			if(item.type != 'iltsession') continue;
			ret[item.id] = {name: item.name, duration: item.id in modifiedILT ? modifiedILT[item.id] : item.iltduration};
		}
		return ret;
	}

	function _onClickOnReminderNotification() {
		var reminderNotifyDlg = nlDlg.create($scope);
		var reminderDict = nlLrReportRecords.getReminderDict();
			reminderNotifyDlg.setCssClass('nl-height-max nl-width-max');
			reminderNotifyDlg.scope.reminderDict = reminderDict;
			reminderNotifyDlg.scope.help = {remarks: {name: 'Note', help: 'This note will be included in the reminder email.'}};
			reminderNotifyDlg.scope.data = {remarks: 'Kindly complete this assignment.'};
			
		var okButton = {text: nl.t('Remind users'), onTap: function(e) {
			var reminderDict = reminderNotifyDlg.scope.reminderDict;
			var remarks = reminderNotifyDlg.scope.data.remarks;
			nl.timeout(function() {
				_sendReminderInBatches(reminderDict, remarks, 0);
			});
		}};
		var cancelButton = {text: nl.t('cancel')};
		reminderNotifyDlg.show('view_controllers/learning_reports/reminder_notification_dlg.html',
			[okButton], cancelButton);
	};
	
	function _sendReminderInBatches(reminderDict, remarks, startFrom) {
		if (startFrom == 0) {
			nlDlg.showLoadingScreen();
		}
		if (startFrom >= reminderDict.users.length) {
			nlDlg.popupStatus('Reminder notifications sent.');
			nlDlg.hideLoadingScreen();
			return;
		}

		var maxPerBatch = 100;
		var batchLength = reminderDict.users.length - startFrom;
		if (batchLength > maxPerBatch) batchLength = maxPerBatch; 
		var params = {name: reminderDict.name, assigned_by: reminderDict.assigned_by, 
			ctype: reminderDict.ctype, remarks: remarks, users: []};
		for (var i=startFrom; i<batchLength; i++){
			params.users.push(reminderDict.users[i]);
		}
		startFrom += batchLength;
		nlDlg.popupStatus(nl.fmt2('Sending {} of {} reminder notifications ...', startFrom, reminderDict.users.length), false);
		nlServerApi.sendReminderNotification(params).then(function(result) {
			_sendReminderInBatches(reminderDict, remarks, startFrom);
		}, function(error) {
			nlDlg.popdownStatus(0);
		});
	}
};

//-------------------------------------------------------------------------------------------------
module_init();
})();
		

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
		'nl.learning_reports.lr_summary_stats', 'nl.learning_reports.lr_import', 'nl.learning_reports.lr_assignments',
		'nl.learning_reports.lr_drilldown', 'nl.learning_reports.lr_batch'])
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
'nlLrHelper', 'nlLrFilter', 'nlLrFetcher', 'nlLrExporter', 'nlLrReportRecords', 'nlLrCourseRecords', 'nlLrSummaryStats', 'nlLrAssignmentRecords', 
'nlTreeListSrv', 'nlMarkup', 'nlLrDrilldown', 'nlLrBatch', 'nlCourse',
function(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlSendAssignmentSrv,
	nlLrHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrCourseRecords, nlLrSummaryStats,
	nlLrAssignmentRecords, nlTreeListSrv, nlMarkup, nlLrDrilldown, nlLrBatch, nlCourse) {
	this.create = function($scope, settings) {
		if (!settings) settings = {};
		return new NlLearningReportView(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlSendAssignmentSrv,
			nlLrHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrCourseRecords, nlLrSummaryStats,
			$scope, settings, nlLrAssignmentRecords, nlTreeListSrv, nlMarkup, nlLrDrilldown, nlLrBatch, nlCourse);
	};
}];
	
//-------------------------------------------------------------------------------------------------
function NlLearningReportView(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlSendAssignmentSrv,
			nlLrHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrCourseRecords, nlLrSummaryStats,
			$scope, settings, nlLrAssignmentRecords, nlTreeListSrv, nlMarkup, nlLrDrilldown, nlLrBatch, nlCourse) {
	var _userInfo = null;
	var _groupInfo = null;
	var _attendanceObj = {};
	this.show = function() {
		nlRouter.initContoller($scope, '', _onPageEnter);
	};

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		_convertAttendanceArrayToObj(_userInfo.groupinfo.attendance);
		return nl.q(function(resolve, reject) {
			nlGroupInfo.init().then(function() {
				_groupInfo = nlGroupInfo.get();
				nlGroupInfo.update();
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
		nlTreeListSrv.init(nl);
		nlLrFilter.init(settings, _userInfo);
		nlLrCourseRecords.init();
		nlLrAssignmentRecords.init();
		nlLrReportRecords.init(_userInfo);
		nlLrFetcher.init();
		nlLrExporter.init(_userInfo);
		nlLrDrilldown.init(nlGroupInfo);
		nlLrBatch.init();
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
		var columns = [];
		columns.push({id: 'user.user_id', name: 'User Id', smallScreen: true});
		columns.push({id: 'user.name', name: 'User Name'});
		columns.push({id: 'user.org_unit', name: 'Org'});
		var mh = nlLrHelper.getMetaHeaders(true);
		for(var i=0; i<mh.length; i++) {
			columns.push({id: 'usermd.' + mh[i].id, name: mh[i].name});
		}
		if (!nlLrFilter.getObjectId()) {
			columns.push({id: 'course.name', name: 'Course / module', mediumScreen: false});
		}
		columns.push({id: 'stats.status.txt', name: 'Status', smallScreen: true, 
			icon: 'stats.status.icon'});
		columns.push({id: 'stats.percCompleteStr', name: 'Progress', mediumScreen: false,
			styleTd: 'text-right'});

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
			nlServerApi.learningReportDelete({repid: repid}).then(function(statusInfo) {
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
			var content = nlLrCourseRecords.getContentOfCourseAssignment();
			return content && content.blended ? true : false;
		}
		if (tbid == 'rating') {
			var content = nlLrCourseRecords.getContentOfCourseAssignment();
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
			var content = nlLrCourseRecords.getContentOfCourseAssignment();
			if(!content) return false;
			for(var i=0; i<content.modules.length; i++) {
				if(content.modules[i].type == 'milestone') return true;
			}
			return false;
		}

		if (tbid == 'exportCustomReport') return (type == 'course') && ($scope.debug || _customReportTemplate);
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

	$scope.onDetailsClick = function(e, item) {		
		e.stopImmediatePropagation();
		e.preventDefault();
		var detailsDlg = nlDlg.create($scope);
		detailsDlg.setCssClass('nl-heigth-max nl-width-max');
		detailsDlg.scope.item = item;
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
		_generateDrillDownArray(false);
	};

	function _isReminderNotificationEnabled() {
		var props = nlGroupInfo.get().props;
		var isMailEnabled = false;
		for(var i=0; i<props.taskNotifications.length; i++) {
			if(props.taskNotifications[i] != 3) continue;
			isMailEnabled = true;
			break;
		}
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

		var showBatch = false;
		if (showBatch) {
			ret.tabs.splice(1, 0, {
				title : 'Click here to view batch progress',
				name: 'Batch',
				icon : 'ion-pricetags',
				id: 'batch',
				updated: false,
				tables: []
			});
		}
		var type = nlLrFilter.getType();
		ret.search = '';
		ret.lastSeached = '';
		ret.searchPlaceholder = 'Type the search words and press enter';
		ret.records = null; 
		ret.summaryStats = null;
		ret.summaryStatSummaryRow = null;
		ret.selectedTab = ret.tabs[0];
		ret.processingOnging = true;
		ret.nothingToDisplay = false;
		ret.onSearch = _onSearch;
		ret.onTabSelect = _onTabSelect;
		return ret;
	}

	function _someTabDataChanged() {
		$scope.drillDownArray = [];
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
		} else if(tab.id == 'drilldown') {
			_updateDrillDownTab();
		} else if(tab.id == 'batch') {
			$scope.batchinfo = nlLrBatch.getBatchInfo(_groupInfo, $scope.tabData.records);
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

	function _getFilteredRecords(summaryStats) {
		var records = nlLrReportRecords.getRecords();
		var tabData = $scope.tabData;
		var searchInfo = _getSearchInfo(tabData);
		var filteredRecords  = [];
		for (var recid in records) {
			var record = records[recid];
			if (!_doesPassFilter(record, searchInfo)) continue;
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

	function _doesPassFilter(record, searchInfo) {
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
		if (!objid || !anyRecord || !anyRecord.repcontent) return;
		nl.pginfo.pageSubTitle = anyRecord.repcontent.name || '';
	}
	
	function _updateScope(avoidFlicker) {
		nl.pginfo.pageTitle = nlLrFilter.getTitle();
		
		$scope.fetchInProgress = nlLrFetcher.fetchInProgress(true);
		$scope.canFetchMore = nlLrFetcher.canFetchMore();

		var anyRecord = nlLrReportRecords.getAnyRecord();
		_setSubTitle(anyRecord);
		$scope.noDataFound = (anyRecord == null);
		_someTabDataChanged();
		_updateCurrentTab(avoidFlicker);
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
			$scope.drillDownArray = [];
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
			status = nlLrHelper.isDone(status) ? 'done' : status.id == nlLrHelper.STATUS_STARTED ? 'started' : 'pending';
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
		if (!nlLrHelper.isDone(rep.stats.status)) return null;
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

	var _statsCountDict = {};
	function _updateDrillDownTab() {
		nlLrDrilldown.clearStatusCountTree();
		var records = $scope.tabData.records;
		for(var i=0; i<records.length; i++) {
			nlLrDrilldown.addCount(records[i]);
		}
		_statsCountDict = nlLrDrilldown.getStatsCountDict();
		_generateDrillDownArray(true);
	}

	function _generateDrillDownArray(firstTimeGenerated) {
		$scope.drillDownArray = [];
		var isSingleReport = Object.keys(_statsCountDict).length <= 2 ? true : false;
		for(var key in _statsCountDict) {
			var root = _statsCountDict[key];
			if(key == 0) {
				root.cnt.style = 'nl-bg-dark-blue';
				root.cnt['sortkey'] = 0+root.cnt.name;
				if(isSingleReport) continue
			} else {
				root.cnt.style = 'nl-bg-blue';
				root.cnt['sortkey'] = 1+root.cnt.name;
			}
			$scope.drillDownArray.push(root.cnt);
			if(firstTimeGenerated && isSingleReport) root.cnt.isOpen = true;
			if(root.cnt.isOpen) {
				_addSuborgOrOusToArray(root.children, root.cnt.sortkey, isSingleReport, firstTimeGenerated);
			}
		}
		$scope.drillDownArray.sort(function(a, b) {
			if(b.sortkey.toLowerCase() < a.sortkey.toLowerCase()) return 1;
			if(b.sortkey.toLowerCase() > a.sortkey.toLowerCase()) return -1;
			if(b.sortkey.toLowerCase() == a.sortkey.toLowerCase()) return 0;				
		})
	};


	function _addSuborgOrOusToArray(subOrgDict, sortkey) {
		for(var key in subOrgDict) {
			var org = subOrgDict[key]
				org.cnt['sortkey'] = sortkey+org.cnt.name;
			$scope.drillDownArray.push(org.cnt);
			if(org.cnt.isOpen && org.children) {
				_addSuborgOrOusToArray(org.children, org.cnt.sortkey)
			}
		}
	}

	function _onExport() {
		if (nlLrFetcher.fetchInProgress()) return;
		var reportRecords = nlLrReportRecords.asList();
		nlLrExporter.export($scope, reportRecords, _isAdmin);
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

	function _onCourseAssignView() {
		var courseAssignment = nlLrAssignmentRecords.getRecord('course_assignment:' + nlLrFilter.getObjectId());
		var learningRecords = nlLrReportRecords.getRecords();
		var content = nlLrCourseRecords.getContentOfCourseAssignment();
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
		ret = ret.concat([{attr:'completed', title: 'Completed', type:'string'}, {attr:'partial_success', title: 'Partially done', type:'string'}, 
				{attr:'started', title: 'Started', type: 'string'}, {attr:'failed', title: 'Failed', type:'string'}, 
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

	var _lessonLabels = ['Completed', 'Failed', 'Started', 'Pending'];
	var _LessonColours = [_nl.colorsCodes.done, _nl.colorsCodes.failed, _nl.colorsCodes.started, _nl.colorsCodes.pending];
	var _infoLabels = ['Completed', 'Pending'];
	var _infoColours = [_nl.colorsCodes.done, _nl.colorsCodes.pending];
	var _milestoneLabels = ['Completed', 'Pending'];
	var _milestoneColors = [_nl.colorsCodes.done, _nl.colorsCodes.pending]
	var _RatingLabels = ['Completed', 'Partial', 'Failed', 'Pending'];
	var _RatingColors = [_nl.colorsCodes.done, _nl.colorsCodes.started, _nl.colorsCodes.failed, _nl.colorsCodes.pending]
	function _updateChartInfo(dlgScope, learningRecords) {
		if(dlgScope.selectedSession.type == 'lesson') {
			var ret = {labels: _lessonLabels, colours: _LessonColours};
			ret.data = [dlgScope.selectedSession.completed.length, dlgScope.selectedSession.failed.length,
						dlgScope.selectedSession.started.length, dlgScope.selectedSession.pending.length];
			dlgScope.chartInfo = ret;
		} else if(dlgScope.selectedSession.type == 'iltsession') {
			var iltLabels = [];
			var iltColors = [];
			var data = [];
			for(var key in _attendanceObj) {
				iltLabels.push(_attendanceObj[key].name);
				data.push(dlgScope.selectedSession[key].length);
				if(key == 'attended') 
					iltColors.push(_nl.colorsCodes.done);
				else 
					iltColors.push(_nl.colorsCodes.failed);
			}
			data.push(dlgScope.selectedSession.pending.length);
			iltColors.push(_nl.colorsCodes.pending);
			iltLabels.push('pending');
			dlgScope.chartInfo = {labels: iltLabels, colours: iltColors, data: data};
		} else if(dlgScope.selectedSession.type == 'rating') {
			var ret = {labels: _RatingLabels, colours: _RatingColors};
			ret.data = [dlgScope.selectedSession.completed.length, dlgScope.selectedSession.partial_success.length,
						dlgScope.selectedSession.failed.length, dlgScope.selectedSession.pending.length];
			dlgScope.chartInfo = ret;
		} else if(dlgScope.selectedSession.type == 'milestone') {
			var ret = {labels: _milestoneLabels, colours: _milestoneColors};

			if(milestone[dlgScope.selectedSession.id] && milestone[dlgScope.selectedSession.id].status == 'done') {
				ret.data = [Object.keys(learningRecords).length, 0];
				dlgScope.chartInfo = ret;
			} else {
				ret.data = [0, Object.keys(learningRecords).length];
				dlgScope.chartInfo = ret;
			}
		} else {
			var ret = {labels: _infoLabels, colours: _infoColours};
			ret.data = [dlgScope.selectedSession.completed.length, dlgScope.selectedSession.pending.length];
			dlgScope.chartInfo = ret;        	
		}
	}

	function _getSessionsAndModules(learningRecords) {
		var ret = [];
		var indentationLevel = 0;
		for(var i=0; i<allModules.length; i++) {
			var item = allModules[i];
			if(item.type == 'module') {
				ret.push(item);
			} else if(item.type == 'lesson') {
				item['completed'] = [];
				item['pending'] = [];
				item['failed'] = [];
				item['started'] = [];
				item.total = Object.keys(learningRecords).length;
				ret.push(item);
			} else if(item.type == 'iltsession') {
				for(var key in _attendanceObj) item[key] = [];
				item['pending'] = [];
				item.total = Object.keys(learningRecords).length;
				ret.push(item);
			} else if(item.type == 'rating'){
				item['completed'] = [];
				item['partial_success'] = [];
				item['failed'] = [];
				item['pending'] = [];
				item.total = Object.keys(learningRecords).length;
				ret.push(item);
			} else {
				item['completed'] = [];
				item['pending'] = [];
				item.total = Object.keys(learningRecords).length;
				ret.push(item);
			}
		}
	
		for(var key in learningRecords) {
			var repcontent = learningRecords[key].repcontent;
			for(var j=0; j<ret.length; j++) {
				if(ret[j].type == 'module') continue;
				if(ret[j].type == 'lesson') {
					var report = repcontent.statusinfo[ret[j].id];
					if(_isEndState(report.status)) {
						if(report.selfLearningMode) {
							ret[j].completed.push({id: parseInt(key), name: learningRecords[key].user.name});
						} else {
							if(report.status == 'failed') 
								ret[j].failed.push({id: parseInt(key), name: learningRecords[key].user.name});
							else 
								ret[j].completed.push({id: parseInt(key), name: learningRecords[key].user.name});
						}
					} else if(report.status == 'started'){
						ret[j].started.push({id: parseInt(key), name: learningRecords[key].user.name});
					} else {
						ret[j].pending.push({id: parseInt(key), name: learningRecords[key].user.name});
					}
				} else if(ret[j].type == 'iltsession'){
					var report = 'statusinfo' in repcontent ? repcontent.statusinfo[ret[j].id] : {};
					if(!report.status || report.status == 'pending') {
						ret[j].pending.push({id: parseInt(key), name: learningRecords[key].user.name});
					} else {
						ret[j][report.stateStr].push({id: parseInt(key), name: learningRecords[key].user.name});
					}
				} else if(ret[j].type == 'rating'){
					var report = 'statusinfo' in repcontent ? repcontent.statusinfo[ret[j].id] : {};
					if(report && report.status != 'pending') {
						if(report.status == 'success')
							ret[j].completed.push({id: parseInt(key), name: learningRecords[key].user.name});
						else
							ret[j][report.status].push({id: parseInt(key), name: learningRecords[key].user.name});
					} else {
						ret[j].pending.push({id: parseInt(key), name: learningRecords[key].user.name});    					
					}
				} else {
					var report = 'statusinfo' in repcontent ? repcontent.statusinfo[ret[j].id] : {};
					if(_isEndState(report.status)) {
						ret[j].completed.push({id: parseInt(key), name: learningRecords[key].user.name});
					} else {
						ret[j].pending.push({id: parseInt(key), name: learningRecords[key].user.name});    					
					}
				}
			}
		}
		return ret;
	}

    function _isEndState(status) {
        return status == 'failed' || status == 'success' || status == 'partial_success';
    }
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	//Mark milestone for items inside the course
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	function _onClickOnMarkMilestone() {
		var courseAssignment = nlLrAssignmentRecords.getRecord('course_assignment:' + nlLrFilter.getObjectId());
		milestone = courseAssignment.milestone ? angular.fromJson(courseAssignment.milestone) : {};
		nlDlg.preventMultiCalls(true, _showMilestoneMarker);
	}

	var oldMilestone = {};
	var milestoneUpdated = false;
	function _showMilestoneMarker() {
		var milestoneDlg = nlDlg.create($scope);
		milestoneDlg.setCssClass('nl-height-max nl-width-max');
		var content = nlLrCourseRecords.getContentOfCourseAssignment();
		milestoneDlg.scope.milestones = _getMilestoneItems(content);
		milestoneDlg.scope.selectedItem = milestoneDlg.scope.milestones[0];
		oldMilestone = angular.copy(milestone);

		milestoneDlg.scope.onClick = function(selectedItem) {
			milestoneDlg.scope.selectedItem = selectedItem;
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

	function _getMilestoneItems(content) {
		var ret = [];
		for(var i=0; i<content.modules.length; i++) {
			if(content.modules[i].type != 'milestone') continue; 
			var item = content.modules[i];
			var _milestone = milestone[item.id] || {};
			ret.push({id: item.id, name:item.name, milestoneObj: {status: _milestone.status == 'done' ? true : false, comment:  _milestone.comment || ''}});
		}
		return ret;
	}

	function _updateMilestoneDelta(updateMilestoneList, newMilestone) {
		var oldObj = oldMilestone[newMilestone.id] || {};
		if(!oldObj.status) oldObj['status'] = '';
		if(!oldObj.comment) oldObj['comment'] = '';
		var newStatus = newMilestone.milestoneObj.status ? 'done' : 'pending';
		var reached = oldObj.reached || null;
		if(newMilestone.milestoneObj.status && oldObj.status != newStatus) reached = new Date();
		var updated = oldObj.updated || null;
		if(oldObj.status != newStatus || oldObj.comment !== newMilestone.milestoneObj.comment) {
			updateMilestoneList.selectedUsers.push({name: newMilestone.name, 
				status: newStatus,
				remarks: newMilestone.milestoneObj.comment || ""});
			milestoneUpdated = true;
			updated = new Date();
		}
		if(updated || milestone.id in oldMilestone)
			milestone[newMilestone.id] = {status: newMilestone.milestoneObj.status ? 'done' : 'pending', comment: newMilestone.milestoneObj.comment, updated: updated, reached: reached};
	}

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	//Mark attendance related code
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	function _onClickOnMarkAttendance() {
		var data = {assignid: nlLrFilter.getObjectId()};
		var courseAssignment = nlLrAssignmentRecords.getRecord('course_assignment:' + nlLrFilter.getObjectId());
		attendance = courseAssignment.attendance ? angular.fromJson(courseAssignment.attendance) : {};
		attendance = nlCourse.migrateCourseAttendance(attendance);
		nlDlg.preventMultiCalls(true, _showAttendanceMarker);
	}

	var oldAttendance = {};
	function _showAttendanceMarker() {
		var markAttendanceDlg = nlDlg.create($scope);
		markAttendanceDlg.setCssClass('nl-height-max nl-width-max');
		var content = nlLrCourseRecords.getContentOfCourseAssignment();
		var learningRecords = nlLrReportRecords.getRecords();
		markAttendanceDlg.scope.attendanceOptions = _userInfo.groupinfo.attendance;
		markAttendanceDlg.scope.sessions = _getIltSessions(content, learningRecords);
		markAttendanceDlg.scope.selectedSession = markAttendanceDlg.scope.sessions[0];
		oldAttendance = {};
		oldAttendance = angular.copy(attendance);
		markAttendanceDlg.scope.onClick = function(session) {
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

	var attendanceUpdated = false; //This flag is to check whether the trainer had done changes to mark or not

	function _updateAttendanceDelta(updateSessionList, newAttendancePerSession) {
		var repid = newAttendancePerSession.id;
		var sessionid = updateSessionList.id;
		var oldAttendancePerSession = {};  //This is {id: sessionid1, remarks: '', attId: 'attended/not-attended/medical_leave', update: 1222, updated: 213252}
		var oldAttendancePerReport = oldAttendance[repid] || []; //repid: [{id: sessionid1, attId: 'attended', remarks: '' },{id: sessionid2, attId: 'not_attended', remarks: '' }.....]
		for(var i=0; i<oldAttendancePerReport.length; i++) {
			var sessionAttendance = oldAttendancePerReport[i];
			if(sessionAttendance.id != sessionid) continue;
			oldAttendancePerSession = sessionAttendance;
			break;
		}
		if(!oldAttendancePerSession.attId) oldAttendancePerSession['attId'] = '';
		if(!oldAttendancePerSession.remarks) oldAttendancePerSession['remarks'] = '';
		var update = oldAttendancePerSession.update || null;
		var updated = oldAttendancePerSession.updated || null;
		if(oldAttendancePerSession.attId != newAttendancePerSession.attendance.id || oldAttendancePerSession.remarks !== newAttendancePerSession.remarks) {
			updateSessionList.selectedUsers.push({name: newAttendancePerSession.name, 
				status: (newAttendancePerSession.attendance.id in _attendanceObj) ? _attendanceObj[newAttendancePerSession.attendance.id].name : '', 
				remarks: newAttendancePerSession.remarks || ""});
			attendanceUpdated = true;
			update = oldAttendancePerSession.update || new Date();
			updated = new Date();
		}
		if(!(repid in attendance)) attendance[repid] = [];
		attendance[repid].push({id: sessionid, attId: newAttendancePerSession.attendance.id, remarks: newAttendancePerSession.remarks, updated: updated, update: update});
	}

	function _getIltSessions(content, learningRecords, type) {
		var ret = [];
		for(var i=0; i<content.modules.length; i++) {
			if(content.modules[i].type != 'iltsession') continue; 
			var item = content.modules[i];
			ret.push({id: item.id, name:item.name, newAttendance: []});
		}
		
		for(var key in learningRecords) {
			var userAttendance = attendance[parseInt(key)] || [];
			var user = learningRecords[key].user;
			for(var j=0; j<ret.length; j++) {
				var notMarked = true;
				for(var k=0; k<userAttendance.length; k++) {
					if (ret[j].id == userAttendance[k].id) {
						notMarked = false;
						ret[j].newAttendance.push({id: parseInt(key), name: user.name, attendance: {id: userAttendance[k].attId}, remarks: userAttendance[k].remarks || '', userid: user.user_id});
						break;
					}
				}
				if(notMarked) ret[j].newAttendance.push({id: parseInt(key), name: user.name, attendance: {id: ''}, userid: user.user_id, remarks: ''});
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
		
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	//Mark ratings related code
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	var oldRating = {};
	var ratingUpdated = false;
	function _onClickOnMarkRatings() {
		var data = {assignid: nlLrFilter.getObjectId()};
		var courseAssignment = nlLrAssignmentRecords.getRecord('course_assignment:' + nlLrFilter.getObjectId());
		rating = courseAssignment.rating ? angular.fromJson(courseAssignment.rating) : {};
		nlDlg.preventMultiCalls(true, _showRatingMarker);
	}

	function _showRatingMarker() {
		var ratingDlg = nlDlg.create($scope);
		ratingDlg.setCssClass('nl-height-max nl-width-max');
		var content = nlLrCourseRecords.getContentOfCourseAssignment();
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

	function _updateRatingDelta(updateSessionList, newRatingPerItem) {
		var repid = newRatingPerItem.id;
		var sessionid = updateSessionList.id;
		var oldRatingPerItem = {};  //This is {id: itemid1, remarks: '', attId: '0-100'}
		var oldRatingPerUserReport = oldRating[repid] || []; //repid: [{id: sessionid1, attId: 'attended', remarks: '' },{id: sessionid2, attId: 'not_attended', remarks: '' }.....]
		for(var i=0; i<oldRatingPerUserReport.length; i++) {
			var itemRating = oldRatingPerUserReport[i];
			if(itemRating.id != sessionid) continue;
			oldRatingPerItem = itemRating;
			break;
		}
		if(!('attId' in oldRatingPerItem)) oldRatingPerItem['attId'] = '';
		if(!oldRatingPerItem.remarks) oldRatingPerItem['remarks'] = '';
		var dict = {name: newRatingPerItem.name};
		var update = oldRatingPerItem.update || null;
		var updated = oldRatingPerItem.updated || null;
		if(updateSessionList.rating_type == 'input') {
			if(newRatingPerItem.rating !== null && (oldRatingPerItem.attId !== newRatingPerItem.rating || oldRatingPerItem.remarks !== newRatingPerItem.remarks)) {
				updateSessionList.selectedUsers.push({name: newRatingPerItem.name, 
					status: (newRatingPerItem.rating === 0) ? 0 : newRatingPerItem.rating, 
					remarks: newRatingPerItem.remarks || ""});
				ratingUpdated = true;	
				update = oldRatingPerItem.update || new Date();
				updated = new Date();
			}
		} else if(updateSessionList.rating_type == 'select') {
			if(oldRatingPerItem.attId !== newRatingPerItem.rating.id || oldRatingPerItem.remarks != newRatingPerItem.remarks) {
				updateSessionList.selectedUsers.push({name: newRatingPerItem.name, 
					status: newRatingPerItem.rating.name || '', 
					remarks: newRatingPerItem.remarks || ""});
				ratingUpdated = true;	
				update = oldRatingPerItem.update || new Date();
				updated = new Date();
			}
		}

		if(!(repid in rating)) rating[repid] = [];
		if(updateSessionList.rating_type == 'input') 
			rating[repid].push({id: sessionid, attId: (newRatingPerItem.rating === 0) ? 0 : newRatingPerItem.rating, remarks: newRatingPerItem.remarks || '', update: update, updated: updated});

		if(updateSessionList.rating_type == 'select')
			rating[repid].push({id: sessionid, attId: newRatingPerItem.rating.id, remarks: newRatingPerItem.remarks || '', update: update, updated: updated});
	}

	function _getRatings(content, learningRecords, isFirstTime) {
		var ret = [];
		for(var i=0; i<content.modules.length; i++) {
			if(content.modules[i].type != 'rating') continue; 
			var item = content.modules[i];
			var dict = {id: item.id, name:item.name, rating_type: item.rating_type, rating: [], ratingOptions: []};
			_checkAndUpdateRatingParams(dict);
			ret.push(dict);
		}
		
		for(var key in learningRecords) {
			var user = learningRecords[key].user;
			for(var j=0; j<ret.length; j++) {
				var statusinfo = learningRecords[key].repcontent.statusinfo[ret[j].id]
				var ratingid = ret[j].rating_type;
				if(statusinfo.status == 'pending') {
					if(ret[j].ratingType == 'input') {
						ret[j].rating.push({id: parseInt(key), name: user.name, rating: null, userid: user.user_id, remarks: statusinfo.remarks || ''});
					} else if(ret[j].ratingType == 'select') {
						ret[j].rating.push({id: parseInt(key), name: user.name, rating: {id: ''}, userid: user.user_id, remarks: statusinfo.remarks || ''});
					}
				} else {
					if(ret[j].ratingType == 'input') {
						ret[j].rating.push({id: parseInt(key), name: user.name, rating: statusinfo.score, userid: user.user_id, remarks: statusinfo.remarks});
					} else if(ret[j].ratingType == 'select') {
						ret[j].rating.push({id: parseInt(key), name: user.name, rating: {id: statusinfo.score, name: statusinfo.rating}, userid: user.user_id, remarks: statusinfo.remarks});
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

	function _checkAndUpdateRatingParams(item) {
		for(var i=0; i<_groupInfo.props.ratings.length; i++) {
			var rating = _groupInfo.props.ratings[i];
			if(item.rating_type == rating.id) {
				if(rating.type == 'number') {
					item.ratingType = 'input';
					break;
				}
				if(rating.type == 'status') {
					item.ratingOptions = [];
					item.ratingType = 'select';
					for(var k=0; k<rating.values.length; k++) {
						item.ratingOptions.push({id: rating.values[k]['p'], name: rating.values[k]['v']});
					}
				}
				if(rating.type == 'select') {
					item.ratingOptions = [];
					item.ratingType = 'select';
					for(var k=0; k<rating.values.length; k++) {
						item.ratingOptions.push({id: rating.values[k]['p'], name: rating.values[k]['v']});
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
				for(var i=0; i<dlgScope.selectedSession.newAttendance.length; i++) dlgScope.selectedSession.newAttendance[i].attendance = bulkMarkerDlg.scope.selectedMarkingType;
			}

			if(markType == 'rating') {
				if(!(bulkMarkerDlg.scope.selectedMarkingType || bulkMarkerDlg.scope.data.ratingNumber >= 0)){
					e.preventDefault();
					return nlDlg.popupAlert({title: 'Please select', template: 'Please provide ratings to mark all'});
				}
				for(var i=0; i<dlgScope.selectedRating.rating.length; i++) {
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
					srvUpdateFn = nlLrAssignmentRecords.updateAttendanceInRecord;
				}
				if(result && (paramName == 'rating')) {
					rating = result;
					srvUpdateFn = nlLrAssignmentRecords.updateRatingInRecord;
				}
				if(result && (paramName == 'milestone')) {
					milestone = result;
					srvUpdateFn = nlLrAssignmentRecords.updateMilestoneInRecord;
				}
				var jsonStr = angular.toJson(result);
				srvUpdateFn('course_assignment:' + nlLrFilter.getObjectId(), jsonStr);
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
			key = 'assignment:{}';
			enableSubmissionAfterEndtime = true;
		} else if (launchType == 'course_assign') {
			key = 'course_assignment:{}';
		}
		key = nl.fmt2(key, nlLrFilter.getObjectId());
		var assignRec = nlLrAssignmentRecords.getRecord(key);
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
			submissionAfterEndtime: assignContent.submissionAfterEndtime,
			dontShowUsers: nominatedUsers};
			
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
		}
		nlSendAssignmentSrv.show($scope, assignInfo, _userInfo).then(function(result) {
			if (!result) return;
			
			assignContent.batchname = result.batchname;
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
				nlLrAssignmentRecords.addRecord(assignRec, key);
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

		var maxPerBatch = 500;
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
		
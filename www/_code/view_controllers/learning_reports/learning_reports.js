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
			'nl.learning_reports.lr_summary_stats', 'nl.learning_reports.lr_import', 'nl.learning_reports.lr_assignments'])
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
	'nlTreeListSrv', 'nlMarkup',
	function(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlSendAssignmentSrv,
		nlLrHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrCourseRecords, nlLrSummaryStats, nlLrAssignmentRecords, nlTreeListSrv, nlMarkup) {
		this.create = function($scope, settings) {
			if (!settings) settings = {};
			return new NlLearningReportView(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlSendAssignmentSrv,
				nlLrHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrCourseRecords, nlLrSummaryStats,
				$scope, settings, nlLrAssignmentRecords, nlTreeListSrv, nlMarkup);
		};
	}];
		
	//-------------------------------------------------------------------------------------------------
	function NlLearningReportView(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlSendAssignmentSrv,
				nlLrHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrCourseRecords, nlLrSummaryStats,
				$scope, settings, nlLrAssignmentRecords, nlTreeListSrv, nlMarkup) {
	
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
		
		function _init(userInfo) {
			_isAdmin = nlRouter.isPermitted(userInfo, 'admin_user');
			// Order is important
			nlTreeListSrv.init(nl);
			nlLrFilter.init(settings, userInfo);
			nlLrCourseRecords.init();
			nlLrAssignmentRecords.init();
			nlLrReportRecords.init(userInfo);
			nlLrFetcher.init();
			nlLrExporter.init(userInfo);
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
			if (tbid == 'content') return (nlLrFilter.getType() == 'module_assign' || nlLrFilter.getType() == 'course_assign');
			if (tbid == 'attendance') {
				var content = nlLrCourseRecords.getContentOfCourseAssignment();
				return content && content.blended ? true : false;
			}
			if(tbid == 'reminderNotify') {
				var type = nlLrFilter.getType();
				var reminderDict = nlLrReportRecords.getReminderDict();
				var isReminderEnabled = _isReminderNotificationEnabled();
				return ((type == 'course_assign' || type == 'module_assign') && isReminderEnabled &&  (reminderDict.users && reminderDict.users.length != 0));
			}
			if (tbid == 'modifyAssignment') {
				var type = nlLrFilter.getType();
				return (type == 'course_assign' || type == 'module_assign');
			}
	 
			return true;
		};
		
		$scope.chartsOnLoad = function() {
			nl.window.resize();
		}
		
		$scope.getAvgScore = function(item) {
			if(!item.completed || !item.scorePerc) return 0;
			return Math.round(item.scorePerc/(item.completed));
		};

		$scope.getTimeSpentInMins = function(item) {
			return Math.round(item.timeSpent/60);
		};

		$scope.checkOverflow = function() {
			var document = nl.window.document;
			var element = document.getElementsByClassName("nl-left-tabbed-content");
			var isOverflowing = element[0].clientWidth < element[0].scrollWidth;
			return isOverflowing;
		}
		$scope.getContTabHeight = function() {
			var document = nl.window.document;
			var bodyElement = document.getElementsByClassName("nl-learning-report-body")
			var topElem = document.getElementsByClassName("nl-topsection");
			return (bodyElement[0].clientHeight - topElem[0].clientHeight-18);
		}

		$scope.onDetailsClick = function(event, item) {		
			var detailsDlg = nlDlg.create($scope);
			detailsDlg.setCssClass('nl-heigth-max nl-width-max');
			detailsDlg.scope.item = item;
			detailsDlg.scope.getRoundedPerc = function(divider, dividend) {
				return Math.round((divider*100)/dividend);
			}
			var cancelButton = {text: nl.t('Close')};
			detailsDlg.show('view_controllers/learning_reports/lr_courses_tab_details.html',
				[], cancelButton);

		}
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
				title : 'Click here to view learning records',
				name: 'Learning records',
				icon : 'ion-ios-compose',
				id: 'learningrecords',
				updated: false,
				tables: [utable]
			}, {
				title : 'Click here to view organisational reports',
				name: 'Organisations',
				icon : 'ion-ios-people',
				id: 'organisations',
				updated: false,
				tables: [otable]
			},{
				title : 'Click here to view time summary',
				name: 'Time summary',
				icon : 'ion-clock',
				id: 'timesummary',
				updated: false,
				tables: []
			},]};
			var type = nlLrFilter.getType();
 			if($scope.debug && (type == 'course' || type == 'course_assign')) {
				var coursesTab = {
					title : 'Click here to view course-wise progress',
					name: 'Courses',
					icon : 'ion-ios-bookmarks',
					id: 'orglevelsummary',
					updated: false,
					tables: []
				}
				ret.tabs.push(coursesTab);
			}
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
			} else if(tab.id == 'orglevelsummary') {
				_updateCoursesSummary();
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
			var colors = ['#007700', '#770000', '#FFCC00', '#A0A0C0'];
	
			var type = nlLrFilter.getType();
			var typeStr = type == 'module' || type == 'module_assign' ? 'Modules' : 'Courses';
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
				colors: ['#3366ff', '#ff6600']
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
					colors: ['#3366ff']
				},
				{
					type: 'bar',
					title: nl.fmt2('Modules {}completed over weeks', brackets),
					subtitle: 'Most recent data upto a maximum of 15 weeks are shown',
					data: [[]],
					labels: [],
					series: ['S1'],
					colors: ['#3366ff']
				},
				{
					type: 'bar',
					title: nl.fmt2('Modules {}completed over months', brackets),
					subtitle: 'Most recent data upto a maximum of 15 months are shown',
					data: [[]],
					labels: [],
					series: ['S1'],
					colors: ['#3366ff']
				}],
			$scope.orgLevelSummaryArray = [];
		}
		
		function _updateOverviewTab(summaryRecord) {
			_updateOverviewDoughnut(summaryRecord);
			_updateOverviewInfoGraphicsCards(summaryRecord);
			_updateOverviewTimeChart();
		}

		function _updateOverviewDoughnut(summaryRecord) {
			var c = $scope.charts[0];
			var type = nlLrFilter.getType();
			var typeStr = type == 'module' || type == 'module_assign' ? 'Module' : 'Course';
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
			var typeStr = type == 'module' || type == 'module_assign' ? 'Modules' : 'Courses';
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
			var isModuleRep = type == 'module' || type == 'module_assign';
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
				var isModuleRep = type == 'module' || type == 'module_assign';
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
	var suborgDict = null;
	var _isSuborgEnabled = false;
		function _updateCoursesSummary() {
			suborgDict = nlGroupInfo.getSuborgStructure();
			_isSuborgEnabled = nlGroupInfo.isSuborgEnabled();
			var records = $scope.tabData.records;
			$scope.orgLevelSummaryArray = [];
			for(var i=0; i<records.length; i++) {
				var record = records[i];
				var assignFound = false;
				for(var j=0; j<$scope.orgLevelSummaryArray.length; j++) {
					var assignRec = $scope.orgLevelSummaryArray[j];
					if(assignRec.courseid != record.repcontent.courseid) continue;
					assignFound = true;
					_updateCoursesTable(assignRec, record, false);
					break;
				}
				if(!assignFound) {
					var defaultDict = angular.copy(defaultItemDict);
					defaultDict['name'] = record.repcontent.name;
					defaultDict['courseid'] = record.repcontent.courseid;
					defaultDict['orgItems'] = {};
					defaultDict['showChildren'] = true;
					_addItemToCoursesTable(defaultDict, '', $scope.orgLevelSummaryArray, record, false);
				}
				if(_isSuborgEnabled) 
					_updateSuborgRecords(record);
				else 
					_updateNonSuborgRecords(record);
			}
		}


		var defaultItemDict = {assigned: 1, completed: 0, certified: 0, pending: 0, inactive: 0, failed: 0, active: 0, scorePerc: 0, 
								timeSpent: 0, completedInactive: 0, pendingInactive: 0, certifiedInFirstAttempt: 0, certifiedInSecondAttempt: 0,
								certifiedInMoreAttempt: 0};
		
		function _updateSuborgRecords(record) {
			for(var i=0; i<$scope.orgLevelSummaryArray.length; i++) {
				var orgRec = $scope.orgLevelSummaryArray[i]
				if (orgRec.courseid == record.repcontent.courseid) {
					var orgFound = false;
					for(var suborg in orgRec.orgItems) {
						var suborgItem = orgRec.orgItems[suborg];
						if(record.user.org_unit.indexOf(suborg) >= 0) {
							orgFound = true;
							var recOuunit = record.user.org_unit;
							if(!suborgItem.ouItems[recOuunit]) {
								var defaultDict = angular.copy(defaultItemDict);
								defaultDict['name'] = record.user.org_unit;
								defaultDict['assigned'] = 0;
								suborgItem.ouItems[recOuunit] = defaultDict;
							}
							_updateCoursesTable(suborgItem, record, true);
							break;
						}
					}
					if(!orgFound) {
						var suborgFound = false;
						var recOuunit = record.user.org_unit;
						for(var suborg in suborgDict) {
							if(record.user.org_unit.indexOf(suborg) >=0) {
								suborgFound = true;
								var orgDict = angular.copy(defaultItemDict);
									orgDict['name'] = suborg;
									orgDict['ouItems'] = {};
									var defaultDict = angular.copy(defaultItemDict);
									defaultDict['name'] = record.user.org_unit;
									orgDict.ouItems[recOuunit] = defaultDict;
									_addItemToCoursesTable(orgDict, suborg, orgRec, record, true);
								break;
							}
						}
						if(!suborgFound) {
							if(!orgRec.orgItems['Others']) {
								var orgDict = angular.copy(defaultItemDict);
								orgDict['name'] = 'Others';
								orgDict['ouItems'] = {};
								var defaultDict = angular.copy(defaultItemDict);
								defaultDict['name'] = record.user.org_unit;
								orgDict.ouItems[recOuunit] = defaultDict;
								_addItemToCoursesTable(orgDict, 'Others', orgRec, record, true);
							} else {
								if(!orgRec.orgItems.Others.ouItems[recOuunit]) {
									var defaultDict = angular.copy(defaultItemDict);
									defaultDict['name'] = record.user.org_unit;
									defaultDict['assigned'] = 0;
									orgRec.orgItems.Others.ouItems[recOuunit] = defaultDict;
								}
								_updateCoursesTable(orgRec.orgItems.Others, record, true);
							}
						}
					}
				}
			}
		}

		function _updateNonSuborgRecords(record) {
			for(var i=0; i<$scope.orgLevelSummaryArray.length; i++) {
				var orgRec = $scope.orgLevelSummaryArray[i]
				if (orgRec.courseid == record.repcontent.courseid) {
					var orgFound = false;
					for(var orgunit in orgRec.orgItems) {
						var orgItem = orgRec.orgItems[orgunit];
						if(orgunit == record.user.org_unit) {
							orgFound = true;
							_updateCoursesTable(orgItem, record, false)							
							break;
						}
					}
					if(!orgFound) {
						var defaultDict = angular.copy(defaultItemDict);
						defaultDict['name'] = record.user.org_unit;
						_addItemToCoursesTable(defaultDict, record.user.org_unit, orgRec, record, false)
					}
				}
			}
		};

		function _addItemToCoursesTable(item, suborg, orgRec, record, addOu) {
			var ouItemDict = addOu ? item.ouItems[record.user.org_unit] : '';
			var status = record.stats.status;
			if(record.user.state == 0) {
				_updateInactiveUserData(item, ouItemDict, status, addOu);
			} else {
				_updateActiveUserData(item, ouItemDict, record, status, addOu)				
			}
			if(suborg) 
				orgRec.orgItems[suborg] = item;
			else 
				orgRec.push(item);
		}

		function _updateCoursesTable(suborgItem, record, addOu) {
			var ouItemDict = addOu ? suborgItem.ouItems[record.user.org_unit] : '';
			var status = record.stats.status;
			suborgItem.assigned += 1;
			if(addOu) ouItemDict.assigned += 1;
			if(record.user.state == 0) {
				_updateInactiveUserData(suborgItem, ouItemDict, status, addOu);
			} else {
				_updateActiveUserData(suborgItem, ouItemDict, record, status, addOu);
			}
		}

		function _updateInactiveUserData(item, ouItemDict, status, addOu) {
			item.inactive += 1;
			if(addOu) ouItemDict.inactive += 1;
			if(status.id == nlLrHelper.STATUS_DONE || status.id == nlLrHelper.STATUS_PASSED ||
				status.id == nlLrHelper.STATUS_CERTIFIED || status.id == nlLrHelper.STATUS_FAILED) {
				item['completedInactive'] += 1;
				if(addOu) ouItemDict['completedInactive'] += 1;
			} else {
				item['pendingInactive'] += 1;
				if(addOu) ouItemDict['pendingInactive'] += 1;
			}
		}

		function _updateActiveUserData(tableRow, ouItemDict, record, status, addOu) {
			tableRow.active += 1;
			if(addOu) ouItemDict.active += 1;
			if(status.id == nlLrHelper.STATUS_DONE || status.id == nlLrHelper.STATUS_PASSED || 
				status.id == nlLrHelper.STATUS_CERTIFIED) {
				_updateCompletedUserDate(tableRow, ouItemDict, record, addOu);
			} else if(status.id == nlLrHelper.STATUS_FAILED) {
				tableRow.failed += 1;
				tableRow.completed += 1;
				if(addOu) ouItemDict.failed += 1;
			} else {
				tableRow.pending += 1;
				if(addOu) ouItemDict.pending += 1;
			}
			_updateOrgAndOuPercentages(tableRow, ouItemDict, record, addOu);
		}

		function _updateCompletedUserDate(tableItem, ouItemDict, record, addOu) {
			tableItem.completed += 1;
			tableItem.certified += 1;
	
			if(record.stats.avgAttempts == 1) {
				tableItem['certifiedInFirstAttempt'] += 1;
			} else if(record.stats.avgAttempts > 1 && record.stats.avgAttempts <= 2) {
				tableItem['certifiedInSecondAttempt'] += 1;
			} else {
				tableItem['certifiedInMoreAttempt'] += 1;
			}	

			if(addOu) {
				ouItemDict.completed += 1;
				ouItemDict.certified += 1;
				if(record.stats.avgAttempts == 1) {
					ouItemDict['certifiedInFirstAttempt'] += 1;
				} else if(record.stats.avgAttempts > 1 && record.stats.avgAttempts <= 2) {
					ouItemDict['certifiedInSecondAttempt'] += 1;
				} else {
					ouItemDict['certifiedInMoreAttempt'] += 1;
				}
			}
		}

		function _updateOrgAndOuPercentages(tableItem, ouItemDict, record, addOu) {
			tableItem.scorePerc += record.stats.percScore;
			tableItem.timeSpent += record.stats.timeSpentSeconds;

			tableItem['certifiedPerc'] = Math.round(tableItem.certified*100/tableItem.active);
			tableItem['failedPerc'] = Math.round(tableItem.failed*100/tableItem.active);
			tableItem['pendingPerc'] = Math.round(tableItem.pending*100/tableItem.active);
			
			if(addOu) {
				ouItemDict['scorePerc'] += record.stats.percScore;
				ouItemDict['timeSpent'] += record.stats.timeSpentSeconds;
				ouItemDict['certifiedPerc'] = Math.round(ouItemDict.certified*100/ouItemDict.active);
				ouItemDict['failedPerc'] = Math.round(ouItemDict.failed*100/ouItemDict.active);
				ouItemDict['pendingPerc'] = Math.round(ouItemDict.pending*100/ouItemDict.active);
			}
		}

		function _onExport() {
			if (nlLrFetcher.fetchInProgress()) return;
			var reportRecords = nlLrReportRecords.asList();
			nlLrExporter.export($scope, reportRecords, _isAdmin);
		}
		
		function _onViewContent() {
			var objId = nlLrFilter.getObjectId();
			var type = nlLrFilter.getType();
			if(type == 'module_assign') {
				nl.window.location.href = nl.fmt2('/lesson/view_assign/{}', objId);
			} else {
				_onCourseAssignView();
			}
		}
		
		var attendance = null;
		var milestone = null;
		var allModules = [];
		function _onCourseAssignView() {
			var data = {assignid: nlLrFilter.getObjectId()};
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
				if(cm.type == 'milestone' && milestone[cm.id] && milestone[cm.id].status == "done") {
					assignStatsViewerDlg.scope.selectedSession.milestoneReached = true;
					assignStatsViewerDlg.scope.selectedSession.milestoneComment = milestone[cm.id].comment;
				} 
				assignStatsViewerDlg.scope.selectedSession = cm;
				_updateChartInfo(assignStatsViewerDlg.scope, learningRecords);
			};

			assignStatsViewerDlg.scope.getUrl = function(lessonId) {
				return nl.fmt2('/lesson/view/{}', lessonId);
			};

			assignStatsViewerDlg.scope.onClickOnMilestoneReached = function() {
				var item = assignStatsViewerDlg.scope.selectedSession;
				milestone[item.id] = {status: 'done', comment: assignStatsViewerDlg.scope.selectedSession.milestoneComment};
				var template = nl.t('Once the milestone is marked as reached, It cannot be reverted(unmarked).');
				nlDlg.popupConfirm({title: 'Please confirm', template: template}).then(function(result) {
					if(result) {
						var data = {param:'milestone', paramObject: milestone, assignid: nlLrFilter.getObjectId()};
						nlDlg.showLoadingScreen();
						nlServerApi.courseUpdateParams(data).then(function(milestone) {
							if(milestone) attendance = milestone;
							var jsonMilestoneStr = angular.toJson(milestone);
							nlLrAssignmentRecords.updateMilestoneInRecord(
								'course_assignment:' + nlLrFilter.getObjectId(), jsonMilestoneStr);
								_updateReportRecords();
								learningRecords = nlLrReportRecords.getRecords();
								assignStatsViewerDlg.scope.modules = _getSessionsAndModules(learningRecords);
								assignStatsViewerDlg.scope.selectedSession.milestoneReached = true;
								_updateChartInfo(assignStatsViewerDlg.scope, nlLrReportRecords.getRecords());
								nlDlg.hideLoadingScreen();
						});
					}
				});
			}
			var cancelButton = {text: nl.t('Close')};
			assignStatsViewerDlg.show('view_controllers/learning_reports/assignment_stats_viewer_dlg.html',
				[], cancelButton);
		}
	
		function _getAllowedAttrs() {
			return [{attr:'attended', title: 'Attended', type:'string'}, {attr:'completed', title: 'Completed', type:'string'}, {attr: 'not_attended', title: 'Not attended', type:'string'},
					{attr:'failed', title: 'Failed', type:'string'}, {attr:'started', title: 'Started', type: 'string'}, {attr:'pending', title: 'Pending', type: 'string'},
					{attr:'total', title: 'Total', type:'total'}];
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
	
		var _iltLabels = ['Attended', 'Not Attended', 'Pending'];
		var _iltColours = ['#007700', '#F54B22', '#A0A0C0'];
		var _lessonLabels = ['Completed', 'Failed', 'Started', 'Pending'];
		var _LessonColours = ['#007700', '#F54B22', '#FFCC00', '#A0A0C0'];
		var _infoLabels = ['Completed', 'Pending'];
		var _infoColours = ['#007700', '#A0A0C0'];
		var _milestoneLabels = ['Completed', 'Pending'];
		var _milestoneColors = ['#007700', '#A0A0C0']
		function _updateChartInfo(dlgScope, learningRecords) {
			if(dlgScope.selectedSession.type == 'lesson') {
				var ret = {labels: _lessonLabels, colours: _LessonColours};
				ret.data = [dlgScope.selectedSession.completed.length, dlgScope.selectedSession.failed.length,
							dlgScope.selectedSession.started.length, dlgScope.selectedSession.pending.length];
				dlgScope.chartInfo = ret;
			} else if(dlgScope.selectedSession.type == 'iltsession') {
				var ret = {labels: _iltLabels, colours: _iltColours};
				ret.data = [dlgScope.selectedSession.attended.length, dlgScope.selectedSession.not_attended.length,
							dlgScope.selectedSession.pending.length];
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
					item['attended'] = [];
					item['not_attended'] = [];
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
						var report = repcontent.lessonReports[ret[j].id];
						if(report && report.completed) {
							if(report.selfLearningMode) {
								ret[j].completed.push({id: parseInt(key), name: learningRecords[key].user.name});
							} else {
								var passScore = report.passScore || 0;
								var score = report.score || 0;
								var percScore = (report.score/report.maxScore)*100;
								if(percScore >= passScore)
									ret[j].completed.push({id: parseInt(key), name: learningRecords[key].user.name});
								else{
									ret[j].failed.push({id: parseInt(key), name: learningRecords[key].user.name});
								}
							}
						} else if(report && report.started){
							ret[j].started.push({id: parseInt(key), name: learningRecords[key].user.name});
						} else {
							ret[j].pending.push({id: parseInt(key), name: learningRecords[key].user.name});
						}
					} else if(ret[j].type == 'iltsession'){
						var report = 'statusinfo' in repcontent ? repcontent.statusinfo[ret[j].id] : {};
						if(report && report.state && report.state == 'attended') {
							ret[j].attended.push({id: parseInt(key), name: learningRecords[key].user.name});
						} else if(report && report.state && report.state == 'not_attended') {
							ret[j].not_attended.push({id: parseInt(key), name: learningRecords[key].user.name});
						} else {
							ret[j].pending.push({id: parseInt(key), name: learningRecords[key].user.name});
						}
					} else {
						var report = 'statusinfo' in repcontent ? repcontent.statusinfo[ret[j].id] : {};
						if(report && report.status == 'done') {
							ret[j].completed.push({id: parseInt(key), name: learningRecords[key].user.name});
						} else {
							ret[j].pending.push({id: parseInt(key), name: learningRecords[key].user.name});    					
						}
					}
				}
			}
			return ret;
		}
	
		function _onClickOnMarkAttendance() {
			var data = {assignid: nlLrFilter.getObjectId()};
			var courseAssignment = nlLrAssignmentRecords.getRecord('course_assignment:' + nlLrFilter.getObjectId());
			attendance = courseAssignment.attendance ? angular.fromJson(courseAssignment.attendance) : {};
			attendance.not_attended = attendance.not_attended || {};
			_showAttendanceMarker();
		}
	
		function _showAttendanceMarker() {
			var markAttendanceDlg = nlDlg.create($scope);
			markAttendanceDlg.setCssClass('nl-height-max nl-width-max');
			var content = nlLrCourseRecords.getContentOfCourseAssignment();
			var learningRecords = nlLrReportRecords.getRecords();
	
			markAttendanceDlg.scope.sessions = _getIltSessions(content, learningRecords);
			markAttendanceDlg.scope.selectedSession = markAttendanceDlg.scope.sessions[0];
			markAttendanceDlg.scope.selectedSession.button = {state: 'selectall', name:'All attended'};
			markAttendanceDlg.scope.onClick = function(session) {
				markAttendanceDlg.scope.selectedSession = session;
				markAttendanceDlg.scope.selectedSession.button = markAttendanceDlg.scope.selectedSession.button || {state: 'selectall', name:'All attended'};
			};
			markAttendanceDlg.scope.markAllUsers = function(state) {
				var selectedSession = markAttendanceDlg.scope.selectedSession;
				var newState = 0;
				if(state == 'selectall') {
					selectedSession.button = {state: 'deselectall', name:'All absent'};
					newState = 1;
				} else if(state == 'deselectall') {
					selectedSession.button = {state: 'clear', name:'Clear all'};
					newState = 2;
				} else {
					selectedSession.button = {state: 'selectall', name:'All attended'};
					newState = 0;
				}
				
				var pending = selectedSession.pending;
				for(var i=0; i<pending.length; i++) pending[i].status = newState;
			};
	
			markAttendanceDlg.scope.updateAttendance = function(user) {
				for(var i=0; i<markAttendanceDlg.scope.selectedSession.pending.length; i++) {
					if(user.id == markAttendanceDlg.scope.selectedSession.pending[i].id) {
						if(markAttendanceDlg.scope.selectedSession.pending[i].status == 0) {
							markAttendanceDlg.scope.selectedSession.pending[i].status = 1;
						} else if(markAttendanceDlg.scope.selectedSession.pending[i].status == 1) {
							markAttendanceDlg.scope.selectedSession.pending[i].status = 2;
						} else {
							markAttendanceDlg.scope.selectedSession.pending[i].status = 0;
						}
						break;
					}
				}
			};
			
			var okButton = {text: nl.t('Mark attendance'), onTap: function(e) {
				var updatedSessionsList = [];
				var userSelected = false;
				for(var i=0; i<markAttendanceDlg.scope.sessions.length; i++) {
					var session = markAttendanceDlg.scope.sessions[i];
					updatedSessionsList.push({id: session.id, name:session.name, selectedUsers: []});
					for(var j=0; j<session.pending.length; j++) {
						var user = session.pending[j];
						if (user.status == 1) {
							userSelected = true;
							updatedSessionsList[i].selectedUsers.push({name: user.name, status: 'Attended'});
							if(!(user.id in attendance)) attendance[user.id] = [];
							attendance[user.id].push(session.id);
						}
						if (user.status == 2) {
							userSelected = true;
							updatedSessionsList[i].selectedUsers.push({name: user.name, status: 'Not attended'});
							if(!(user.id in attendance.not_attended)) attendance.not_attended[user.id] = [];
							attendance.not_attended[user.id].push(session.id);
						}
					}
				}
				if(!userSelected) {
					e.preventDefault();
					return nlDlg.popupAlert({title: 'Alert message', template: 'Please select the user to mark attendance'});
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
					_attendanceConfirmationDlg(markAttendanceDlg.scope, updatedSessionsList);
				});
			}};
			var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
			}};
			markAttendanceDlg.show('view_controllers/learning_reports/mark_attendance_dlg.html',
				[okButton], cancelButton);
		}
	
		function _getIltSessions(content, learningRecords, type) {
			var ret = [];
			for(var i=0; i<content.modules.length; i++) {
				if(content.modules[i].type != 'iltsession') continue; 
				var item = content.modules[i];
				ret.push({id: item.id, name:item.name, attended:[], pending: []});
			}
			for(var key in learningRecords) {
				var userAttendance = attendance[parseInt(key)] || [];
				var userNotAttended = attendance.not_attended[parseInt(key)] || [];
				for(var j=0; j<ret.length; j++) {
					var isAttended = 0;
					for(var k=0; k<userAttendance.length; k++) {
						if (ret[j].id == userAttendance[k]) {
							isAttended = 1;
							ret[j].attended.push({id: parseInt(key), name: learningRecords[key].user.name, status: 1});
							break;
						}
					}
					for(var k=0; k<userNotAttended.length; k++) {
						if (ret[j].id == userNotAttended[k]) {
							isAttended = 2;
							ret[j].attended.push({id: parseInt(key), name: learningRecords[key].user.name, status: 2});
							break;
						}
					}
					if(isAttended == 0) ret[j].pending.push({id: parseInt(key), name: learningRecords[key].user.name, status: 0});
				}
			}
			for(var i=0; i<ret.length; i++) {
				var attended = ret[i].attended;
				var pending = ret[i].pending;
				attended.sort(function(a, b) {
					if(b.name.toLowerCase() < a.name.toLowerCase()) return 1;
					if(b.name.toLowerCase() > a.name.toLowerCase()) return -1;
					if(b.name.toLowerCase() == a.name.toLowerCase()) return 0;				
				});
	
				attended.sort(function(a, b) {
					if(b.status < a.status) return 1;
					if(b.status > a.status) return -1;
					if(b.status == a.status) return 0;				
				});
				
				pending.sort(function(a, b) {
					if(b.name.toLowerCase() < a.name.toLowerCase()) return 1;
					if(b.name.toLowerCase() > a.name.toLowerCase()) return -1;
					if(b.name.toLowerCase() == a.name.toLowerCase()) return 0;
				});
				ret[i].attended = attended;
				ret[i].pending = pending;
			}
			return ret;
		}
		 
	
		function _attendanceConfirmationDlg(dlgScope, markedSessions) {
			var confirmationDlg = nlDlg.create($scope);
			confirmationDlg.setCssClass('nl-height-max nl-width-max');
			confirmationDlg.scope.markedSessions = markedSessions;
			var okButton = {text: nl.t('Confirm attendance'), onTap: function(e) {
			var data = {param: 'attendance', paramObject: attendance, assignid: nlLrFilter.getObjectId()};
				nlDlg.showLoadingScreen();
				nlServerApi.courseUpdateParams(data).then(function(result) {
					nlDlg.hideLoadingScreen();
					if(result) attendance = result;
					var jsonAttendanceStr = angular.toJson(result);
					nlLrAssignmentRecords.updateAttendanceInRecord(
						'course_assignment:' + nlLrFilter.getObjectId(), jsonAttendanceStr);
					_updateReportRecords();
				});
			}};
			var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
				confirmationDlg.scope.onCloseDlg(e, null);
			}};
			confirmationDlg.show('view_controllers/learning_reports/mark_attendance_confirmation_dlg.html',
				[okButton], cancelButton);
		}
		
		function _getSelectedNameAndSessions(content, selectedItem) {
			var ret = {};
			for(var i=0; i<content.length; i++) {
				var selectedUserList = selectedItem[content[i].id] || [];
				selectedUserList.sort(function(a, b) {
					if(b.toLowerCase() < a.toLowerCase()) return 1;
					if(b.toLowerCase() > a.toLowerCase()) return -1;
					if(b.toLowerCase() == a.toLowerCase()) return 0;
				});
				ret[content[i].id] = {name: content[i].name, selectedUsers: selectedUserList || []};
			}
			return ret;
		}
		
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
			nlSendAssignmentSrv.show($scope, assignInfo).then(function(result) {
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
			var ret = {};
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
	
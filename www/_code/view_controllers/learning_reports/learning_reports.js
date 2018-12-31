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
		var _summaryStats = null;
		
		function _init(userInfo) {
			_isAdmin = nlRouter.isPermitted(userInfo, 'admin_user');
			// Order is important
			nlTreeListSrv.init(nl);
			nlLrFilter.init(settings, userInfo);
			nlLrCourseRecords.init();
			nlLrAssignmentRecords.init();        
			_summaryStats = nlLrSummaryStats.getSummaryStats();
			nlLrReportRecords.init(_summaryStats, userInfo);
			nlLrFetcher.init();
			nlLrExporter.init(userInfo);
			nl.pginfo.pageTitle = nlLrFilter.getTitle();
			_initScope();
		}
	
		function _initScope() {
			$scope.toolbar = _getToolbar();
			$scope.tabElements = _getTabElements();
			$scope.learningRecords = nlLrReportRecords.getRecords();
			$scope.searchDict = {placeholder: nl.t('Start typing to search'), searchStr: '', infoText: nl.t('Found {} matches from {} items searched', Object.keys($scope.learningRecords).length, Object.keys($scope.learningRecords).length)};
			$scope.selectedTab = $scope.tabElements[0]
			$scope.metaHeaders = nlLrHelper.getMetaHeaders(true);
			$scope.ui = {showOrgCharts: true, showOrgs: true, showUsers: false, showTimeSummaryTab: false};
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
	
			summaryRecord['assigned'] = {txt: assigned};
			summaryRecord['done'] = {txt: done, style:'background-color:red'};
			summaryRecord['failed'] = {txt: failed};
			summaryRecord['started'] = {txt: started};
			summaryRecord['pending'] = {txt: pending, style:'nl-bg-red'};
	
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
	
		function _getTabElements() {
			return [{
				title : 'Click here to see reports overview',
				name: 'Overview',
				icon : 'ion-stats-bars',
				id: 'overview',
				onClick : _clickOnOverview
			}, {
				title : 'Click here to view learning records',
				name: 'Learning records',
				icon : 'ion-ios-compose',
				id: 'learningrecords',
				onClick : _clickOnLearningRecords
			}, {
				title : 'Click here to view organisational reports',
				name: 'Organisations',
				icon : 'ion-ios-people',
				id: 'organisations',
				onClick : _clickOnOrganisations
			},{
				title : 'Click here to view time summary',
				name: 'Time summary',
				icon : 'ion-clock',
				id: 'timesummary',
				onClick : _clickOnTimeSummary
			}];
		}
	
		function _clickOnOverview(tab) {
			$scope.selectedTab = tab;
			var filter = $scope.selectedTable.search.filter;
			$scope.selectedTable = $scope.otable;
			$scope.selectedTable.search.filter = filter
		}
	
		function _clickOnOrganisations(tab) {
			$scope.selectedTab = tab;
			var filter = $scope.selectedTable.search.filter;
			$scope.selectedTable = $scope.otable;
			$scope.selectedTable.search.filter = filter
		}
	
		function _clickOnLearningRecords(tab) {
			$scope.selectedTab = tab;
			var filter = $scope.selectedTable.search.filter;
			$scope.selectedTable = $scope.utable;
			$scope.selectedTable.search.filter = filter
			_updateScope();
		}

		function _clickOnTimeSummary(tab) {
			$scope.selectedTab = tab;
			$scope.ui['showTimeSummaryTab'] = false;
			var filter = $scope.selectedTable.search.filter;
			$scope.selectedTable = $scope.otable;
			$scope.selectedTable.search.filter = filter
			_updateScope();
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
				_updateScope();
			});
		}
		
		function _updateReportRecords() {
			nlLrReportRecords.updateReportRecords();
			_updateScope();
		}
		
		function _setSubTitle(recs) {
			nl.pginfo.pageSubTitle = '';
			var objid = nlLrFilter.getObjectId();
			if (!objid) return;
			if (recs.length <= 0) return;
			if (!recs[0].repcontent) return;
			nl.pginfo.pageSubTitle = recs[0].repcontent.name || '';
		}
		
		function _updateScope() {
			nl.pginfo.pageTitle = nlLrFilter.getTitle();
			
			$scope.fetchInProgress = nlLrFetcher.fetchInProgress(true);
			$scope.canFetchMore = nlLrFetcher.canFetchMore();
			
			var reportAsList = nlLrReportRecords.asList();
			_setSubTitle(reportAsList);
			$scope.noDataFound = (reportAsList.length == 0);
			nlTable.updateTableObject($scope.utable, reportAsList);
			nlTable.updateTableObject($scope.otable, _summaryStats.asList());
		}
	
		function _initChartData() {
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
			$scope.timeSummaryCharts = [{
					type: 'bar',
					title: 'Modules completed over days',
					data: [[]],
					labels: [],
					series: ['S1'],
					colors: ['#3366ff']
				},
				{
					type: 'bar',
					title: 'Modules completed over weeks',
					data: [[]],
					labels: [],
					series: ['S1'],
					colors: ['#3366ff']
				},
				{
					type: 'bar',
					title: 'Modules completed over months',
					data: [[]],
					labels: [],
					series: ['S1'],
					colors: ['#3366ff']
				}]
		}
		
		function _updateChartData(summaryRecord) {
			_updateProgressChartData(summaryRecord);
			_updateTimeChartData();
			_updateTimeSummaryTab();
			nl.timeout(function() {
				_updateProgressChartData(summaryRecord);
				_updateTimeChartData();
				_updateTimeSummaryTab();
			});
		}
		
		function _updateProgressChartData(summaryRecord) {
			var c = $scope.charts[0];
			var type = nlLrFilter.getType();
			var typeStr = type == 'module' || type == 'module_assign' ? 'Module' : 'Course';
			_updateGrapicalInfoCards(summaryRecord);
			c.data = [summaryRecord.done.txt, summaryRecord.failed.txt, summaryRecord.started.txt, summaryRecord.pending.txt];
			c.title = nl.t('{} progress: {} of {} done', typeStr, (summaryRecord.done.txt + summaryRecord.failed.txt), summaryRecord.assigned.txt);
		}
		
		function _updateGrapicalInfoCards(summaryRecord) {
			var _completedDict = {};
			var _pendingDict = {}; 
			var _startedDict = {};

			var reportRecords = nlLrReportRecords.getRecords();
			var type = nlLrFilter.getType();
			if(type == 'module' || type == 'module_assign') {
				for(var rep in reportRecords) {
					var rec = reportRecords[rep];
					var orgEntry = _summaryStats.getOrgEntry(rec);
					if (!orgEntry || !(orgEntry.passesFilter || _isFound())) continue;
					if (!rec.raw_record.started) {
						if(rec.user.user_id in _completedDict)
							delete _completedDict[rec.user.user_id]
						if(rec.user.user_id in _startedDict)
							delete _startedDict[rec.user.user_id]
						_pendingDict[rec.user.user_id] = true;
					}
					if (rec.raw_record.started && !rec.raw_record.completed && !(rec.user.user_id in _pendingDict)) {
						if(rec.user.user_id in _completedDict)
							delete _completedDict[rec.user.user_id]
						_startedDict[rec.user.user_id] = true;
					}
					if (rec.raw_record.completed && !(_pendingDict[rec.user.user_id] || _startedDict[rec.user.user_id])) 
						_completedDict[rec.user.user_id] = true;
				}
			} else if (type == 'course' || type == 'course_assign') {
				for(var rep in reportRecords) {
					var rec = reportRecords[rep];
					var orgEntry = _summaryStats.getOrgEntry(rec);
					if (!orgEntry || !(orgEntry.passesFilter || _isFound(rec))) continue;
					var totalItems = rec.stats.nLessons + rec.stats.nOthers;
					var completedItems = rec.stats.nLessonsDone + rec.stats.nOthersDone;
					if (completedItems == 0 && (rec.stats.status.txt != 'started')) {
						if(rec.user.user_id in _completedDict)
							delete _completedDict[rec.user.user_id]
						if(rec.user.user_id in _startedDict)
							delete _startedDict[rec.user.user_id]
						_pendingDict[rec.user.user_id] = true;
					}
					if ((rec.stats.status.txt == 'started') && (totalItems != completedItems) && !(rec.user.user_id in _pendingDict)) {
						if(rec.user.user_id in _completedDict)
							delete _completedDict[rec.user.user_id]
						_startedDict[rec.user.user_id] = true;
					}
					if (totalItems == completedItems && !(_pendingDict[rec.user.user_id] || _startedDict[rec.user.user_id])) 
						_completedDict[rec.user.user_id] = true;	
				}
			}
			var typeStr = type == 'module' || type == 'module_assign' ? 'Modules' : 'Courses';
			$scope.overviewArray = [
				{title: nl.fmt2('{} completed', typeStr), desc:'', perc: Math.round((summaryRecord.done.txt/summaryRecord.assigned.txt)*100 || 0), showperc:1},
				{title: nl.fmt2('{} started', typeStr), desc:'', perc: Math.round((summaryRecord.started.txt/summaryRecord.assigned.txt)*100 || 0), showperc:1},
				{title: nl.fmt2('{} yet to start', typeStr), desc:'', perc: Math.round((summaryRecord.pending.txt/summaryRecord.assigned.txt)*100 || 0), showperc:1},
				{title: nl.fmt2('{} completed', 'Learners'), desc:'', perc: Object.keys(_completedDict).length || 0, showperc:0},
				{title: nl.fmt2('{} started', 'Learners'), desc:'', perc: Object.keys(_startedDict).length || 0, showperc:0},
				{title: nl.fmt2('{} yet to start', 'Learners'), desc:'', perc: Object.keys(_pendingDict).length || 0, showperc:0}];
		}

		function _updateTimeChartData() {
			var c = $scope.charts[1];
			var ranges = nlLrReportRecords.getTimeRanges();
			var reportRecords = nlLrReportRecords.getRecords();
			var type = nlLrFilter.getType();
			var isModuleRep = type == 'module' || type == 'module_assign';
			for(var key in reportRecords) {
				var rec = reportRecords[key];
				var orgEntry = _summaryStats.getOrgEntry(rec);
				if (!orgEntry || !(orgEntry.passesFilter || _isFound(rec))) continue;
				var ended = isModuleRep ? _getModuleEndedTime(rec) : _getCourseEndedTime(rec);
				for(var i=0; i<ranges.length; i++) {
					if (_isTsInRange(rec.raw_record.created, ranges[i])) ranges[i].count++;
					if (!ended) break;
					if (!_isTsInRange(ended, ranges[i])) continue;
					ranges[i].completed++;
					break;
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
			$scope.ui['showTimeSummaryTab'] = false;
			nlDlg.showLoadingScreen();
			nl.timeout(function() {
				var reportRecords = nlLrReportRecords.getRecords();
				var type = nlLrFilter.getType();
				var loadcomplete = false;
				for(var j=0; j<$scope.timeSummaryCharts.length; j++) {
					var c = $scope.timeSummaryCharts[j];
					var rangeType = j == 0 ? 'days' : j == 1 ? 'weeks' : 'months';
					var ranges = nlLrReportRecords.getTimeRanges(rangeType);
					var isModuleRep = type == 'module' || type == 'module_assign';
					for(var key in reportRecords) {
						var rec = reportRecords[key];
						var orgEntry = _summaryStats.getOrgEntry(rec);
						if (!orgEntry || !(orgEntry.passesFilter || _isFound(rec))) continue;
						var recId = rec.raw_record.id;
						var lessonReports = isModuleRep ? {recId: rec.raw_record} : rec.repcontent.lessonReports;
	
						for(var report in lessonReports) {
							var rep = lessonReports[report];
							var ended = _getModuleEndedTime(rep);
							if (!ended) continue;
							for(var i=0; i<ranges.length; i++) {
								if (!_isTsInRange(ended, ranges[i])) continue;
								ranges[i].count++;
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
					if(j==2) {
						loadcomplete = true;
					}
				}
				if(loadcomplete) {
					$scope.ui['showTimeSummaryTab'] = true;
					nlDlg.hideLoadingScreen();
				}
			}, 500);
		}

		function _isFound(rec) {
			var filter = $scope.selectedTable.search.filter.toLowerCase();
			var recname = rec.repcontent.name.toLowerCase();
			var username = rec.user.username.toLowerCase();
			var email = rec.user.email;
			var name = rec.user.name.toLowerCase();
			var org_unit = rec.user.org_unit.toLowerCase();
			if(recname.indexOf(filter) >= 0 || username.indexOf(filter) >= 0 || email.indexOf(filter) >= 0 || 
				name.indexOf(filter) >= 0 || org_unit.indexOf(filter) >= 0) {
					return true;
			}
			return false; 
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
		var allModules = [];
		function _onCourseAssignView() {
			var data = {assignid: nlLrFilter.getObjectId()};
			var courseAssignment = nlLrAssignmentRecords.getRecord('course_assignment:' + nlLrFilter.getObjectId());
			var learningRecords = nlLrReportRecords.getRecords();
			var content = nlLrCourseRecords.getContentOfCourseAssignment();
				attendance = courseAssignment.attendance ? angular.fromJson(courseAssignment.attendance) : {};
				attendance.not_attended = attendance.not_attended || {};
	
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
				 _updateChartInfo(assignStatsViewerDlg.scope);
			}
			assignStatsViewerDlg.scope.onClick = function(e, cm) {
				assignStatsViewerDlg.scope.selectedSession = cm;
				if(cm.type === 'module') {
					nlTreeListSrv.toggleItem(cm);
					_showVisible(assignStatsViewerDlg);
					return;
				}
				assignStatsViewerDlg.scope.selectedSession = cm;
				_updateChartInfo(assignStatsViewerDlg.scope);
			};
			assignStatsViewerDlg.scope.getUrl = function(lessonId) {
				return nl.fmt2('/lesson/view/{}', lessonId);
			};
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
		function _updateChartInfo(dlgScope) {
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
			var data = {attendance: attendance, assignid: nlLrFilter.getObjectId()};
				nlDlg.showLoadingScreen();
				nlServerApi.courseUpdateAttendance(data).then(function(result) {
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
				hideEmailNotifications: true,
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
						assignContent.iltTrainerName = result.iltTrainerName || '';
						assignContent.iltVenue = result.iltVenue || '';
						assignContent.iltCostInfra = result.iltCostInfra || '';
						assignContent.iltCostTrainer = result.iltCostTrainer || '';
						assignContent.iltCostFoodSta = result.iltCostFoodSta || '';
						assignContent.iltCostTravelAco = result.iltCostTravelAco || '';
						assignContent.iltCostMisc = result.iltCostMisc || '';
					}
				}
				if(result.selectedusers) {
					nl.window.location.reload();
				} else {
					nlLrAssignmentRecords.addRecord(assignRec, key);
					_updateReportRecords();
				}
			});
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
	
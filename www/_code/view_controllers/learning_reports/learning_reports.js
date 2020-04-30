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
		'nl.learning_reports.lr_fetcher', 'nl.learning_reports.lr_exporter', 
		'nl.learning_reports.lr_report_records', 'nl.learning_reports.lr_summary_stats', 'nl.learning_reports.lr_import',
		'nl.learning_reports.lr_drilldown', 'nl.learning_reports.lr_nht_srv',
		'nl.learning_reports.others.lr_completed_modules',
		'nl.learning_reports.lr_course_assign_view', 'nl.learning_reports.lr_update_batch_dlg'])
	.config(configFn)
	.controller('nl.LearningReportsCtrl', LearningReportsCtrl)
	.service('nlLearningReports', NlLearningReports)
	.directive('markMilestoneTab', NlMarkMilestoneTabDirective)
	.directive('markRatingTab', NlMarkRatingTabDirective);
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

var NlMarkMilestoneTabDirective = [
function() {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/learning_reports/mark_milestone_tab.html',
        scope: {
			selecteditem: '='
        },
        link: function($scope, iElem, iAttrs) {
            $scope.toggleLearnerMilestone = function(user) {
                $scope.$parent.$parent.$parent.$parent.toggleLearnerMilestone(user);
            };

            $scope.markOrUnmarkAll = function(item, status) {
                $scope.$parent.$parent.$parent.$parent.markOrUnmarkAll(item, status);
            };
        }
    }
}];

var NlMarkRatingTabDirective = [
function() {
	return {
		restrict: 'E',
		transclude: true,
		templateUrl: 'view_controllers/learning_reports/mark_rating_tab.html',
		scope: {
			selecteditem: '='
		},
		link: function($scope, iElem, iAttrs) {
			$scope.onDropdownItemSelected = function(user, item) {
				$scope.$parent.$parent.$parent.$parent.onDropdownItemSelected(user, item);
			};
			$scope.bulkRatingMarker = function(e) {
				$scope.$parent.$parent.$parent.$parent.bulkRatingMarker(e);
			};
		}
	}
}];

var LearningReportsCtrl = ['$scope', 'nlLearningReports',
function($scope, nlLearningReports) {
	var reportView = nlLearningReports.create($scope);
	reportView.show();
}];
	
var NlLearningReports = ['nl', 'nlDlg', 'nlRouter', 'nlServerApi', 'nlGroupInfo', 'nlTable', 'nlSendAssignmentSrv',
'nlLrHelper', 'nlReportHelper', 'nlLrFilter', 'nlLrFetcher', 'nlLrExporter', 'nlLrReportRecords', 'nlLrSummaryStats', 'nlGetManyStore', 
'nlTreeListSrv', 'nlMarkup', 'nlLrDrilldown', 'nlCourse', 'nlLrNht', 'nlLrUpdateBatchDlg',
function(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlSendAssignmentSrv,
	nlLrHelper, nlReportHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrSummaryStats,
	nlGetManyStore, nlTreeListSrv, nlMarkup, nlLrDrilldown, nlCourse, nlLrNht, nlLrUpdateBatchDlg) {
	this.create = function($scope, settings) {
		if (!settings) settings = {};
		return new NlLearningReportView(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlSendAssignmentSrv,
			nlLrHelper, nlReportHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrSummaryStats,
			$scope, settings, nlGetManyStore, nlTreeListSrv, nlMarkup, nlLrDrilldown, nlCourse, nlLrNht, nlLrUpdateBatchDlg);
	};
}];
	
//-------------------------------------------------------------------------------------------------
function NlLearningReportView(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlSendAssignmentSrv,
			nlLrHelper, nlReportHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrSummaryStats,
			$scope, settings, nlGetManyStore, nlTreeListSrv, nlMarkup, nlLrDrilldown, nlCourse, nlLrNht, nlLrUpdateBatchDlg) {
	var _userInfo = null;
	var _groupInfo = null;
	var _recordsFilter = null;
	var _customScoresHeader = null;
	this.show = function() {
		nlRouter.initContoller($scope, '', _onPageEnter);
	};

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		_initAttendanceOptions(_userInfo.groupinfo.attendance);
		return nl.q(function(resolve, reject) {
			nlGroupInfo.init2().then(function() {
				nlGroupInfo.update();
				_groupInfo = nlGroupInfo.get();
				_recordsFilter = new RecordsFilter(nl, nlDlg, nlLrFilter, nlGroupInfo, _groupInfo, $scope, _onApplyFilter);
				_init();
				resolve(true); // Has to be before next line for loading screen
				_showRangeSelection();
			}, function(err) {
				resolve(false);
			});
		});
	}

	// Private members
	var _customReportTemplate = '';
	var _certHandler = new CertificateHandler(nl, $scope);

	function _init() {
		_customReportTemplate = nlGroupInfo.getCustomReportTemplate();

		// Order is important
		nlGetManyStore.init();
		nlLrFilter.init(settings, _userInfo, _groupInfo);
		nlLrReportRecords.init(_userInfo, _groupInfo, _canAddReportRecord);
		nlLrFetcher.init();
		nlLrExporter.init(_userInfo, _groupInfo);
		nlLrDrilldown.init(nlGroupInfo);
		nlLrNht.init(nlGroupInfo);
		_certHandler.init(_groupInfo);
		_recordsFilter.init();
		nl.pginfo.pageTitle = nlLrFilter.getTitle();
		_initScope();
	}

	function _canAddReportRecord(report) {
		if (nlLrFilter.getMode() == 'cert_report') return _certHandler.canAddReportRecord(report);
		return true;
	}

	var _lrColumns = null;
	var _tableNavPos = {};
	function _initScope() {
		$scope.debug = nlLrFilter.isDebugMode();
		$scope.toolbar = _getToolbar();
		$scope.learningRecords = nlLrReportRecords.getRecords();
		$scope.metaHeaders = nlLrHelper.getMetaHeaders(true);
		_lrColumns = _selectedLrCols || _getLrColumns();
		_tableNavPos = {currentpos: 0, nextpos: 100};
		$scope.utable = {
			search: {disabled : true},
			columns: _lrColumns,
			styleTable: 'nl-table nl-table-styled3 rowlines',
			styleHeader: ' ',
			onRowClick: 'expand',
			detailsTemplate: 'view_controllers/learning_reports/learning_report_details.html',
			clickHandler: _userRowClickHandler,
			metas: nlLrHelper.getMetaHeaders(false)
		};
		$scope.utable.styleDetail = 'nl-max-1100';
		nlTable.initTableObject($scope.utable);
		_initTabData($scope.utable);
		_initChartData();
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
			title : 'Bulk delete',
			icon : 'ion-ios-trash',
			id: 'bulkdelete',
			onClick : _onBulkDelete
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
		var canManage = nlRouter.isPermitted(_userInfo, 'assignment_manage');
		if (tbid == 'bulkdelete') return (canManage && (type == 'course_assign' || type == 'module_assign'));
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
		}
	};

	$scope.getMaxVisibleString = function() {
		var startpos = _tableNavPos.currentpos;
		var endpos = _tableNavPos.currentpos + $scope.utable._internal.visibleRecs.length;
		return nl.t ('Showing {} - {} records of {} items.', startpos, endpos, $scope.tabData.records.length);
	};

	$scope.canShowPrev = function() {
		if (_tableNavPos.currentpos > 0) return true;
		return false;
	};

	$scope.canShowNext = function() {
		if (_tableNavPos.currentpos + 100 < $scope.tabData.records.length) return true;
		return false;
	};

	$scope.onClickOnNext = function () {
		if (_tableNavPos.currentpos + 100 > $scope.tabData.records.length) return;
		if (_tableNavPos.currentpos < $scope.tabData.records.length) {
			_tableNavPos.currentpos += 100;
		}
		nlTable.updateTableObject($scope.utable, $scope.tabData.records, _tableNavPos.currentpos);
	};

	$scope.onClickOnPrev = function () {
		if (_tableNavPos.currentpos == 0) return;
		if (_tableNavPos.currentpos >= 100) {
			_tableNavPos.currentpos -= 100;
		}
		nlTable.updateTableObject($scope.utable, $scope.tabData.records, _tableNavPos.currentpos);
	}

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

	var _tabManager = null;
	function _initTabData(utable) {
		$scope.tabData =  {tabs: [], utable: utable};
		_tabManager = new LrTabManager($scope.tabData, nlGetManyStore, nlLrFilter, _groupInfo);

		var ret = $scope.tabData;
		ret.isFilterApplied = false;
		_updateTabs();

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
		ret.onFilter = _recordsFilter.showFilterDialog;
		ret.onTabSelect = _onTabSelect;
	}

	function _updateTabs(checkSelected) {
		_tabManager.update(checkSelected);
	}
	
	function _someTabDataChanged() {
		$scope.drillDownInfo = {};
		$scope.nhtRunningInfo = {};
		$scope.nhtClosedInfo = {};
		$scope.iltBatchInfo = {};
		$scope.certificateInfo = {};
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
		if (tab.id == 'nhtclosed') _updateSelectedColumnsOfNHT(true);
		if (tab.id == 'nhtrunning') _updateSelectedColumnsOfNHT(false);
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

	var nhtMandatoryCols = {batchFirstPass: true, batchThroughput: true};
	function _updateSelectedColumnsOfNHT(isClosed) {
		if (!_selectedNhtColumns) return;
		for (var i=0; i<_selectedNhtColumns.length; i++) {
			var col = _selectedNhtColumns[i];
			if (col.id in nhtMandatoryCols) {
				if(isClosed) col.canShow = true;
				else col.canShow = false;
			}
		}
	}

	function _actualUpdateCurrentTab(tabData, tab) {
		if (!tabData.records) {
			var summaryStats = nlLrSummaryStats.getSummaryStats();
			tabData.records = _getFilteredRecords(summaryStats);
			tabData.summaryStats = summaryStats.asList();
			tabData.summaryStatSummaryRow = _getSummaryStatSummaryRow(tabData.summaryStats);
			_updateTabs(true);
		}
		
		if (tab.id == 'overview') {
			_updateOverviewTab(tabData.summaryStatSummaryRow);
		} else if (tab.id == 'learningrecords') {
			_updateLearningRecordsTab(tabData);
		} else if (tab.id == 'timesummary') {
			_updateTimeSummaryTab();
		} else if (tab.id == 'drilldown') {
			_updateDrillDownTab();
		} else if (tab.id == 'nhtrunning') {
			_updateRunningNhtTab();
		} else if (tab.id == 'nhtclosed') {
			_updateClosedNhtTab();
		} else if (tab.id == 'iltbatchdata') {
			_updateILTBatch();
		} else if (tab.id == 'certificate') {
			_certHandler.updateCertificateTab();
		}
	}

	var _selectedLrCols = null;
	var _defaultLrCol = ["user.user_id", "user.name", "repcontent.name", "user.org_unit", "stats.status.txt"];
	var _lastSelectedCols = null;
	function _updateLearningRecordsTab(tabData) {
		_lrSelectedColumns(_lastSelectedCols || _defaultLrCol);
		nlTable.updateTableObject($scope.utable, tabData.records);
		$scope.lrViewSelectorConfig = {
			canEdit: nlRouter.isPermitted(_userInfo, 'assignment_manage'),
			tableType: 'lr_views',
			allColumns: _getLrColumns(),
			defaultViewColumns: {id: 'default', name: 'Default', columns: _defaultLrCol},
			onViewChange: function(selectedColumns) {
				_lastSelectedCols = selectedColumns;
				_lrSelectedColumns(selectedColumns);
				nlTable.updateTableObject($scope.utable, tabData.records);
			}
		};
	}

	function _lrSelectedColumns(selectedColumns) {
		var lrColumnsDict = nl.utils.arrayToDictById(_getLrColumns());
		var ret = [];
		for(var i=0;i<selectedColumns.length;i++) {
			var colid = selectedColumns[i].id || selectedColumns[i];
			if ((!(colid in lrColumnsDict)) || lrColumnsDict[colid].hideInMode) continue;
			ret.push(lrColumnsDict[colid]);
		}
		$scope.utable.columns = ret;
		_selectedLrCols = ret;
	}

	function _getLrColumns() {
		_customScoresHeader = nlLrReportRecords.getCustomScoresHeader();
		var mh = nlLrHelper.getMetaHeaders(false);
		var type = nlLrFilter.getType();
		var columns = [];
		columns.push(_col('user.user_id', 'User Id', type == 'user'));
		columns.push(_col('user.name', 'User Name', type == 'user'));
		columns.push(_col('raw_record.typeStr', 'Report type', type != 'user'));
		columns.push(_col('repcontent.name', 'Course Name', nlLrFilter.getObjectId() && type != 'user'));
		columns.push(_col('raw_record._batchName', 'Batch name'));
		columns.push(_col('raw_record._grade', _userInfo.groupinfo.gradelabel));
		columns.push(_col('raw_record.subject', _userInfo.groupinfo.subjectlabel));
		columns.push(_col('created', 'Assigned On'));
		columns.push(_col('updated', 'Last Updated On'));
		columns.push(_col('not_before', 'From'));
		columns.push(_col('not_after', 'Till'));
		columns.push(_col('stats.status.txt', 'Status', false, 'stats.status.icon'));
		columns.push(_col('stats.percCompleteStr','Progress'));
		columns.push(_col('stats.percCompleteDesc', 'Progress Details'));
		columns.push(_col('stats.avgAttempts', 'Quiz Attempts'));
		columns.push(_col('stats.percScoreStr', 'Achieved %'));
		columns.push(_col('stats.nMaxScore', 'Maximum Score'));
		columns.push(_col('stats.nScore', 'Achieved Score'));
		
		for(var i=0; i< _customScoresHeader.length; i++) columns.push(_col('stats.customScoreDict.' + _customScoresHeader[i], _customScoresHeader[i]));

		columns.push(_col('stats.feedbackScore', 'Feedback score'));
		columns.push(_col('stats.timeSpentMinutes', 'Online Time Spent (minutes)'));
		columns.push(_col('stats.iltTimeSpent', 'ILT time spent(minutes)'));
		columns.push(_col('stats.iltTotalTime', 'ILT total time(minutes)'));
		columns.push(_col('stats.delayDays', 'Delay days'));
		columns.push(_col('repcontent.iltVenue', 'Venue'));
		columns.push(_col('repcontent.iltTrainerName','Trainer name'));
		columns.push(_col('repcontent.iltCostInfra', 'Infra Cost'));
		columns.push(_col('repcontent.iltCostTrainer', 'Trainer Cost'));
		columns.push(_col('repcontent.iltCostFoodSta', 'Food Cost'));
		columns.push(_col('repcontent.iltCostTravelAco', 'Travel Cost'));
		columns.push(_col('repcontent.iltCostMisc', 'Misc Cost'));
		columns.push(_col('user.stateStr', 'User state'));
		columns.push(_col('user.email', 'Email Id'));
		columns.push(_col('user.org_unit', 'Org'));
		columns.push(_col('orgparts.part1', 'OU - part 1'));
		columns.push(_col('orgparts.part2', 'OU - part 2'));
		columns.push(_col('orgparts.part3', 'OU - part 3'));
		columns.push(_col('orgparts.part4', 'OU - part 4'));

		columns.push(_col('user.mobile', 'Mobile Number'));
		columns.push(_col('user.seclogin', 'Secondary login'));
		columns.push(_col('user.supervisor', 'Supervisor'));

		for(var i=0; i<mh.length; i++) {
			var keyName = 'usermd.' + mh[i].id;
			columns.push(_col(keyName, mh[i].name));
		}

		// Id's are always exported, So the below 3 fields.
		columns.push(_col('stats.internalIdentifier', 'Report Id'));
		columns.push(_col('repcontent.assignid', 'Assign Id'));
		columns.push(_col('repcontent.courseid', 'Course/ Module Id'));
		columns.push(_col('raw_record.typeStr', 'Type', type != 'user'));
		columns.push(_col('repcontent.targetLang', 'Language'));
		_lrColumns = columns;
		return _lrColumns;
	}
	
	function _col(id, name, hideInMode, icon) {
		var __column = { id: id, name: name, allScreens: true, canShow:true, hideInMode: hideInMode, styleTd: 'minw-number nl-text-center'};
		if(icon) __column.icon = icon;
		return __column;
	}

	function _onSearch(event) {
		if (event && event.which !== 13) return;
		var tabData = $scope.tabData;
		if (tabData.lastSeached == tabData.search) return;
		tabData.lastSeached = tabData.search;
		_someTabDataChanged();
		_updateCurrentTab();
	}

	function _onApplyFilter() {
		_someTabDataChanged();
		_updateCurrentTab();
	}

	function _getFilteredRecords(summaryStats) {
		var records = nlLrReportRecords.getRecords();
		var batchStatusObj = nlLrReportRecords.getNhtBatchStatus();
		var tabData = $scope.tabData;
		var searchInfo = _getSearchInfo(tabData);
		var filteredRecords  = [];
		_tableNavPos = {currentpos: 0, nextpos: 100};
		for (var recid in records) {
			var record = records[recid];
			if (record.raw_record.isNHT) nlGetManyStore.getBatchMilestoneInfo(record.raw_record, batchStatusObj);	
			if (!_recordsFilter.doesPassFilter(record)) continue;
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
			nlGetManyStore.clearCache();
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
		nlGetManyStore.clearCache();
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
		_tableNavPos = {currentpos: 0, nextpos: 100};
		_updateTabs();
		var anyRecord = nlLrReportRecords.getAnyRecord();
		_setSubTitle(anyRecord);
		$scope.noDataFound = (anyRecord == null);
		_someTabDataChanged();
		var tab = $scope.tabData.selectedTab;
		if (tab.id == 'nhtclosed' || tab.id == 'nhtrunning' || tab.id == 'iltbatchdata') tab.updated = false;
		_updateCurrentTab(avoidFlicker, true);
	}

	function _initChartData() {
		$scope.overviewArray = [];
		var labels =  ['done', 'failed', 'active-ongoing', 'pending'];
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
			$scope.nhtRunningInfo = {};
			$scope.nhtClosedInfo = {};
			$scope.batchinfo = {};
			$scope.iltBatchInfo = {};
			$scope.certificateInfo = {};
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
			{title: nl.fmt2('{} Active-Ongoing', typeStr), desc:'', perc: startedPerc, showperc:1},
			{title: nl.fmt2('{} yet to start', typeStr), desc:'', perc: pendingPerc, showperc:1},
			{title: nl.fmt2('{} completed', 'Learners'), desc:'', perc: uDone, showperc:0},
			{title: nl.fmt2('{} Active-Ongoing', 'Learners'), desc:'', perc: uStarted, showperc:0},
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

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	//Running NHT tab
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	var _nhtColumns = null;
	var _nhtColumnsSelectedInView = null;

	function _updateRunningNhtTab() {
		$scope.nhtRunningInfo = _getNhtTab(true);
	}

	function _updateClosedNhtTab() {
		$scope.nhtClosedInfo = _getNhtTab(false);
	}

	function _getNhtTab(isRunning) {
		_initNhtColumns();
		nlLrNht.clearStatusCountTree();
		var records = $scope.tabData.records;
		var reportDict = {};
		var transferedOut = {};
		var batchStatusObj = nlLrReportRecords.getNhtBatchStatus();

		for(var i=0; i<records.length; i++) {
			var record = records[i];
			if(!record.raw_record.isNHT) continue;
			if (record.stats.attritionStr == 'Transfer-Out') {
				transferedOut[record.user.user_id] = record;
				continue;
			}
			var msInfo = nlGetManyStore.getBatchMilestoneInfo(record.raw_record, batchStatusObj);
			if(isRunning && msInfo.batchStatus == 'Closed' ||
				!isRunning && msInfo.batchStatus != 'Closed') continue;
			if(!(record.user.user_id in reportDict)) {
				reportDict[record.user.user_id] = record;
				continue;
			}	
			var oldUserRecord = reportDict[record.user.user_id];
			if(oldUserRecord.repcontent.updated > record.repcontent.updated) continue;
			reportDict[record.user.user_id] = record;
		}
		for (var transferid in transferedOut) {
			if (transferid in reportDict) continue;
			reportDict[transferid] = transferedOut[transferid];
		}
		for(var key in reportDict) {
			var record = reportDict[key];
				nlLrNht.addCount(record);
		}
		return {columns: _nhtColumns,  selectedColumns: _selectedNhtColumns || _nhtColumns,
			rows: _generateDrillDownArray(true, nlLrNht.getStatsCountDict(), false, 
				(nlLrFilter.getType() == "course_assign"), true)};
	}

	var _selectedNhtColumns = null;
	function _initNhtColumns() {
		var defColumns = ["cntTotal", "batchStatus", "batchName", "partner", "lob", "trainer", "avgDelay", "batchFirstPass", "batchThroughput"];
		_nhtColumns = _getNhtColumns();
		if (!_selectedNhtColumns) {
			var nhtColumnsDict = nl.utils.arrayToDictById(_nhtColumns);
			_selectedNhtColumns = [];
			for(var i=0;i<defColumns.length;i++) {
				var colid = defColumns[i];
				if (!(colid in nhtColumnsDict)) continue;
				_selectedNhtColumns.push(nhtColumnsDict[colid]);
			}
		}
		_updateNhtColumns();
        $scope.nhtViewSelectorConfig = {
            canEdit: nlRouter.isPermitted(_userInfo, 'assignment_manage'),
            tableType: 'nht_views',
			allColumns: _nhtColumns,
			defaultViewColumns: {id: 'default', name: 'Default', columns: defColumns},
            onViewChange: function(selectedColumns) {
				_nhtColumnsSelectedInView = {};
				_selectedNhtColumns = selectedColumns;
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
		var isClosedBatches = $scope.tabData.selectedTab.id == 'nhtclosed';
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
		if(_selectedNhtColumns) {
			for(var i=0; i<_selectedNhtColumns.length; i++) {
				var col = _selectedNhtColumns[i];
				var notApplicable = isClosedBatches && col.showIn == 'running' ||
					!isClosedBatches && col.showIn == 'closed';
				if (notApplicable) {
					col.canShow = false;
					continue;
				}
				col.canShow = !_nhtColumnsSelectedInView || _nhtColumnsSelectedInView[col.id];
			}	
		}
	}

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	//Closed NHT tab
	//---------------------------------------------------------------------------------------------------------------------------------------------------------

	function _getNhtColumns() {
		var columns = [];
		_customScoresHeader = nlLrReportRecords.getCustomScoresHeader();
		var customScoresHeaderWithType = nlLrReportRecords.getCustomScoresHeaderWithType();
		var milestones = _groupInfo.props.milestones || [];
		columns.push({id: 'cntTotal', name: 'Head Count', table: true, hidePerc:true, smallScreen: true, background: 'bggrey', showAlways: true});
		columns.push({id: 'batchStatus', name: 'Batch Status', table: true, hidePerc:true, smallScreen: true, showAlways: true});
		columns.push({id: 'batchName', name: 'Batch', table: true, hidePerc:true, smallScreen: true, background: 'bggrey', showAlways: true});
		columns.push({id: 'partner', name: 'Center', table: true, hidePerc:true, smallScreen: true, background: 'bggrey', showAlways: true});
		columns.push({id: 'lob', name: _groupInfo.props.subjectlabel || 'LOB', table: true, hidePerc:true, smallScreen: true, background: 'bggrey', showAlways: true});

		columns.push({id: 'inductionDropOut', name: 'Induction drop out', table: true, hidePerc:true, smallScreen: true, background: 'bggrey', showAlways: true});
		var allBatchStatus = [];
		for(var i=0; i<milestones.length; i++) {
			var item = milestones[i];
			if (item.batch_status) allBatchStatus.push(item.batch_status);
		}

		for(var i=0; i<allBatchStatus.length-1; i++) {
			var userState = allBatchStatus[i];
			columns.push({id: 'attrition-' + userState, 
				name: 'Attrition during ' + userState, hidePerc:true, table: true, showAlways: true});
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

		for (var i=0; i<allBatchStatus.length; i++) {
			var status = allBatchStatus[i];
			columns.push({id: status, name: nl.t('In {} Count',status), showIn: 'running', hidePerc: true, showAlways: true, table: true});
		}
		columns.push({id: 'certifiedFirstAttempt', name: 'Certified in First Attempt', hidePerc: true, table: true, showAlways: true});
		columns.push({id: 'certifiedSecondAttempt', name: 'Certified in 2nd Attempt', hidePerc: true, table: true, showAlways: true});
		columns.push({id: 'certified', name: 'Total Certified', hidePerc: true, table: true, showAlways: true});
		columns.push({id: 'notCertified', name: 'Not Certified', hidePerc: true, table: true, showAlways: true});
		columns.push({id: 'certificationThroughput', name: 'Certification Throughput', hidePerc: true, table: true, showAlways: true});

		columns.push({id: 'failed', name: 'Total Not Certified', hidePerc:true, table: false, showAlways: true}); //This is not asked by abrar
		columns.push({id: 'batchFirstPass', name: 'First Pass Percentage', showIn: 'closed', hidePerc: true, table: true, showAlways: true});
		columns.push({id: 'batchThroughput', name: 'E2E Throughput', showIn: 'closed', hidePerc: true, table: true, showAlways: true});
		columns.push({id: 'runningThroughput', name: 'Running Throughput', showIn: 'running', hidePerc: true, table: true, showAlways: true});
		// Others - not asked by customer but may be needed
		columns.push({id: 'avgDelay', name: 'Average delay(In days)', hidePerc: true, table: true, showAlways: true});
		columns.push({id: 'avgScore', name: 'Avg Quiz score', table: true, background: 'nl-bg-blue', hidePerc:true});
		for(var i=0; i<_customScoresHeader.length; i++) {
			if (customScoresHeaderWithType[_customScoresHeader[i]] == 'rag') continue;
			columns.push({id: 'perc'+_customScoresHeader[i], name: _customScoresHeader[i], table: true, background: 'nl-bg-blue', hidePerc:true});
		}
		columns.push({id: 'plannedCycle', name: 'Planned cycle time', hidePerc: true, table: true, showAlways: true});
		columns.push({id: 'actualCycle', name: 'Actual cycle time', hidePerc: true, table: true, showAlways: true});

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
	function _generateDrillDownArray(firstTimeGenerated, statusDict, singleRepCheck, showLeafOnly, isNHT) {
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
				_addSuborgOrOusToArray(root.children, root.cnt.sortkey, null, showLeafOnly, isNHT);
			} else {
				drillDownArray.push(root.cnt);
				if(firstTimeGenerated && isSingleReport) root.cnt.isOpen = true;
				if(isNHT) {
					root.cnt.isOpen = true;
					root.cnt.cls = 'alternate';
					showLeafOnly = true;
				}
				if(root.cnt.isOpen) _addSuborgOrOusToArray(root.children, root.cnt.sortkey, null, showLeafOnly, isNHT);
			}
		}
		drillDownArray.sort(function(a, b) {
			if(b.sortkey.toLowerCase() < a.sortkey.toLowerCase()) return 1;
			if(b.sortkey.toLowerCase() > a.sortkey.toLowerCase()) return -1;
			if(b.sortkey.toLowerCase() == a.sortkey.toLowerCase()) return 0;				
		});
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
		var customScoresHeaderWithType = nlLrReportRecords.getCustomScoresHeaderWithType();
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
		columns.push({id: 'started', name: 'Active-Ongoing', percid: 'percStarted', table: true, indentation: 'padding-left-22', showAlways: true});
		if(customStartedStates.length > 0) {
			for(var i=0; i<customStartedStates.length; i++) {
				if(customStartedStates[i] in statusDict)
					columns.push({id: customStartedStates[i], name: statusDict[customStartedStates[i]], percid:'perc'+customStartedStates[i], table: true, indentation: 'padding-left-44'});
			}
		}
		columns.push({id: 'pending', name: 'Pending', smallScreen: true, percid: 'percPending', table: true, indentation: 'padding-left-22', showAlways: true});
		columns.push({id: 'avgScore', name: 'Avg Quiz score', table: true, background: 'nl-bg-blue', hidePerc:true});
		for(var i=0; i<_customScoresHeader.length; i++) {
			if (customScoresHeaderWithType[_customScoresHeader[i]] == 'rag') continue;
			columns.push({id: 'perc'+_customScoresHeader[i], name: _customScoresHeader[i], table: true, background: 'nl-bg-blue', hidePerc:true});
		}
		columns.push({id: 'avgDelay', name: 'Avg Delay in days', table: true, background: 'nl-bg-blue', hidePerc:true});
		return columns;
	}

	function _getFormattedName(name, statusDict) {
		var nameArray = name.split('-');
		var first = nameArray[0].trim();
		var firstletter = first.charAt(0).toUpperCase();
		nameArray.splice(0, 1);
		var statusStr = nameArray.join('-');
		var newString = firstletter+first.substring(1);
			newString = newString+' during '+statusDict[statusStr];
		return newString;
	}

	function _getStatusDictFromArray() {
		var courseStates = _groupInfo.props.milestones || [];
		var ret = {};
		for(var i=0; i<courseStates.length; i++) {
			var userState = courseStates[i];
			if (userState.batch_status) ret[userState.batch_status] = userState.batch_status;
		}
		return ret;
	}
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	//ILTBatch tab
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	function _updateSessionDates(sessionInfo, sessionDates) {
		var sessionDate =  sessionInfo.sessiondate || '';
		if(sessionDate) {;
			if (sessionInfo.shiftHrs && sessionInfo.shiftMins) {
				sessionDates[sessionDate] = {start: nl.t('{}:{}', sessionInfo.shiftHrs, sessionInfo.shiftMins), end: _getShiftEnd(sessionInfo)};
			} else {
				sessionDates[sessionDate] = {};
			}
		}

	}

	function _getShiftEnd(sessionInfo) {
		if (sessionInfo.shiftEnd) return sessionInfo.shiftEnd;
		if (sessionInfo.shiftHrs && sessionInfo.shiftMins) {
			var shiftEndHrs = parseInt(sessionInfo.shiftHrs) + 9;	
			return nl.t('{}: {}', shiftEndHrs, sessionInfo.shiftMins);
		}
	}

	function _updateAsdSessionDates(cm, sessionDates) {
		var sessionInfos = g_attendance.sessionInfos || {};
		var sessionInfo = sessionInfos[cm.id];
		for(var j=0; j<sessionInfo.asd.length; j++) {
			var session = sessionInfo.asd[j];
			if(session)
				_updateSessionDates(session, sessionDates);
		}
	}

	function _updateILTBatch() {
		var records = $scope.tabData.records;
		var content = _getContentOfCourseAssignment();
		var courseAssignment = _getCourseAssignmnt();
			g_attendance = courseAssignment.attendance ? angular.fromJson(courseAssignment.attendance) : {};
			g_attendance = nlCourse.migrateCourseAttendance(g_attendance);
		var asdAddedModules = nlReportHelper.getAsdUpdatedModules(content.modules || [], g_attendance)
		var sessionDates = {};
		var iltSessions = [];
		var	sessionInfos = g_attendance.sessionInfos || {};	
		if ('_root' in sessionInfos) {
			var rootAsds = sessionInfos['_root'].asd;
			for(var i=0; i<rootAsds.length; i++) {
				_updateSessionDates(rootAsds[i], sessionDates)			
			}
		}

		for(var i=0; i<asdAddedModules.length; i++) {
			var cm = asdAddedModules[i];
			if (cm.type != 'iltsession') continue;
			iltSessions.push(cm);
			if (cm.asdChildren && cm.asdChildren.length > 0) _updateAsdSessionDates(cm, sessionDates);
			if(!cm.asdSession) {
				var sessionInfos = g_attendance.sessionInfos || {};
				var sessionInfo = sessionInfos[cm.id];
				if(sessionInfo)
					_updateSessionDates(sessionInfo, sessionDates);
			}
		}

		var userObj = {};
		var iltBatchInfoRow = [];
		for(var i=0; i<records.length; i++) {
			userObj = {};
			var record = records[i];
			userObj.name = record.user.name;
			userObj.coursename = record.repcontent.name;
			userObj.batchname = record.repcontent.batchname;
			userObj.not_before = record.not_before ? nl.fmt.fmtDateDelta(record.raw_record.not_before, null, 'date') : '';  //Show only after the feature is enabled for the type=course
			userObj.not_after = record.not_after ? nl.fmt.fmtDateDelta(record.raw_record.not_after, null, 'date') : '';  //Show only after the feature is enabled for the type=course
			userObj.learner_status = (record.user.state == 0) ? nl.t('Inactive') : nl.t('Active')
			var _statusInfos = record.repcontent.statusinfo;
			userObj.lob = record.course.contentmetadata.subject;
			var isCertified = false;
			for(var j=0; j<iltSessions.length; j++) {
				var cm = iltSessions[j];
				var sessionInfo = _statusInfos[cm.id];
				if (isCertified) continue;
				isCertified = (sessionInfo.attId == 'certified');
				var sessionDate =  nl.fmt.date2StrDDMMYY(nl.fmt.json2Date(cm.sessiondate || ''), null, 'date');
				if (sessionInfo.stateStr == 'notapplicable' 
					|| !sessionInfo.state || sessionInfo.status == 'waiting') continue;
				if (sessionDate)
					userObj[sessionDate] = sessionInfo.state || '-';
			}
			iltBatchInfoRow.push(userObj);
		};
		iltBatchInfoRow.sort(function(a, b) {
			if(b.name.toLowerCase() < a.name.toLowerCase()) return 1;
			if(b.name.toLowerCase() > a.name.toLowerCase()) return -1;
			if(b.name.toLowerCase() == a.name.toLowerCase()) return 0;				
		});
		$scope.iltBatchInfo = {columns: _getILTColumns(sessionDates), rows: iltBatchInfoRow};
	}

	function _getILTColumns(sessionDates) {
		var headerRow = [];
		var lobTitle = _groupInfo.props.subjectlabel || 'lob';
		headerRow.push({id: 'name', name: nl.t('Learner name'), class: 'minw-string'});
		headerRow.push({id: 'lob', name: nl.t(lobTitle), class: 'minw-string'});
		headerRow.push({id: 'coursename', name: nl.t('Course name'), table: false, class: 'minw-string'});
		headerRow.push({id: 'batchname', name: nl.t('Batch name'), table: false, class: 'minw-string'});
		headerRow.push({id: 'not_before', name: nl.t('Start date'), class: 'minw-number'});
		headerRow.push({id: 'not_after', name: nl.t('End date'), class: 'minw-number'});
		headerRow.push({id: 'learner_status', name: nl.t('Status'), class: 'minw-number'});
		var sessionDatesArray = [];
		for(var key in sessionDates) sessionDatesArray.push({date: nl.fmt.json2Date(key) || '', start: sessionDates[key].start, end: sessionDates[key].end});
		sessionDatesArray.sort(function(a, b) {
			var key1 = new Date(a.date);
			var key2 = new Date(b.date);
		
			if (key1 < key2) {
				return -1;
			} else if (key1 == key2) {
				return 0;
			} else {
				return 1;
			}
		});	

		for(var i=0; i<sessionDatesArray.length; i++) {
			var date = nl.fmt.date2StrDDMMYY(sessionDatesArray[i].date, null, 'date');
			var hrName = nl.t('{}', date);
			if (sessionDatesArray[i].start) hrName += nl.t(' {} - {}', sessionDatesArray[i].start, sessionDatesArray[i].end);
			headerRow.push({id: date, name: hrName, class: 'minw-number'});
		}
		return headerRow;
	}

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	function _onExport() {
		if (nlLrFetcher.fetchInProgress()) return;
		var reportRecords = nlLrReportRecords.asList();
		if(!_customScoresHeader) _customScoresHeader = nlLrReportRecords.getCustomScoresHeader();

		var drillDownStats = null;
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
		drillDownStats = {statsCountDict: _statsCountDict, columns: header};

		var nhtStats = {};
		var batchStatus = nlGetManyStore.getNhtBatchStates();
		if (batchStatus.running || batchStatus.closed) {
			if (batchStatus.running) {
				_updateRunningNhtTab();
				nhtStats.running = $scope.nhtRunningInfo.rows;
			}
			if (batchStatus.closed) {
				_updateClosedNhtTab();
				nhtStats.closed = $scope.nhtClosedInfo.rows;
			}
			nhtStats.columns = [];
			for(var i=0; i<_nhtColumns.length; i++) {
				var col = _nhtColumns[i];
				if(col.canShow) nhtStats.columns.push(col);
			}
		}
		var iltBatchStats = null;
		if (nlLrFilter.getType() == 'course_assign' && _groupInfo.props.etmAsd && _groupInfo.props.etmAsd.length > 0) {
			_updateILTBatch();
			iltBatchStats = {statsCountArray: $scope.iltBatchInfo.rows, columns: $scope.iltBatchInfo.columns};
		}

		if(!_selectedLrCols) {
			_lrSelectedColumns(_defaultLrCol)
		}
		var lrStats = {columns: _selectedLrCols};

		var certificateStats = null;
		if (nlLrFilter.getType() == 'course' && nlLrFilter.getMode() == 'cert_report') {
			certificateStats = _certHandler.getExportData();
		}

		nlLrExporter.export($scope, reportRecords, _customScoresHeader, drillDownStats, nhtStats, iltBatchStats, lrStats, certificateStats);
	}
	
	function _onExportCustomReport() {
		if (nlLrFetcher.fetchInProgress()) return;
		var reportRecordsDict = nlLrReportRecords.getRecords();
		var customReportTemplate = _customReportTemplate || nlGroupInfo.getDefaultCustomReportTemplate();
		nlLrExporter.exportCustomReport($scope, reportRecordsDict, customReportTemplate);
	}
	
	function _onBulkDelete() {
		var deleteDlg = nlDlg.create($scope);	
		deleteDlg.setCssClass('nl-width-max');
		deleteDlg.scope.dlgTitle = nl.t('Delete multiple reports');
		deleteDlg.scope.data = {reportids: ''};
		var okButton = {text: nl.t('Delete'), onTap: function(e) {
			e.preventDefault();
			_validateAndDeleteReports(deleteDlg.scope.data);
		}};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
		}};
		deleteDlg.show('view_controllers/learning_reports/bulk_delete_reports_dlg.html',
			[okButton], cancelButton);
	}

	function _validateAndDeleteReports(data) {
		var reportids = data.reportids;
		if (!reportids) {
			return nlDlg.popupAlert({title: 'Error', template: 'No report ids provided. Please enter the report ids and continue deletion.'});
		}
		reportids = reportids.split('\n');
		var repidsArray = [];
		var repidsNotFound = [];
		var uniqueIds = {};
		var records = nlLrReportRecords.getRecords();
		for (var i=0; i<reportids.length; i++) {
			var id = reportids[i].trim();
			if (!id) continue;
			if (id && id.indexOf('id=') == 0) id = id.substring(3);
			var intid = parseInt(id);
			if (intid in uniqueIds) {
					repidsNotFound.push({id: id, idname: reportids[i], name: 'Repeated report id'});
				continue;
			}	
			uniqueIds[intid] = true;
			if (id in records) {
				var report = records[id];
				repidsArray.push({id: id, idname: reportids[i], username: report.user.username});
			} else {
				repidsNotFound.push({id: id, idname: reportids[i], name: 'Invalid report id'});
			}
		}
		if (repidsArray.length == 0) 
			return nlDlg.popupAlert({title: 'Report ids not valid', template:'Please enter the valid report ids and try deleting.'});

		var confirmationDlg = nlDlg.create($scope);
			confirmationDlg.setCssClass('nl-width-max nl-height-max');
			confirmationDlg.scope.dlgTitle = nl.t('Please confirm');
			confirmationDlg.scope.data = {validReports: repidsArray, invalidReports: repidsNotFound};
			confirmationDlg.scope.data.str1 = nl.t('Found {} valid', repidsArray.length);
			if (repidsNotFound.length > 0) 
				confirmationDlg.scope.data.str1 += nl.t(' and {} invalid inputs.', repidsNotFound.length);
			else 	
				confirmationDlg.scope.data.str1 += nl.t(' inputs.');

		var okButton = {text: nl.t('Continue'), onTap: function(e) {
			var repids = [];
			var data = confirmationDlg.scope.data;
			for(var i=0; i<data.validReports.length; i++) repids.push(data.validReports[i].id);
			nlDlg.showLoadingScreen();
			nlServerApi.learningReportDelete({repids: repids}).then(function(status){
				nlDlg.hideLoadingScreen();
				nlDlg.closeAll();
				for (var i=0; i<repids.length; i++) nlLrReportRecords.removeRecord(repids[i]);
				_updateScope();
			});
		}};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
		}};
		confirmationDlg.show('view_controllers/learning_reports/confirm_bulk_delete_dlg.html',
			[okButton], cancelButton);
	};

	function _onViewContent() {
		var objId = nlLrFilter.getObjectId();
		var type = nlLrFilter.getType();
		if(type == 'module_assign') {
			nl.window.location.href = nl.fmt2('/lesson/view_assign/{}', objId);
		} else {
			nlDlg.preventMultiCalls(true, _onCourseAssignView);
		}
	}

	function _onCourseAssignView() {
		var courseAssign = _getCourseAssignmnt();
		var modifiedILT = courseAssign.info && courseAssign.info.modifiedILT ? courseAssign.info.modifiedILT : {};
		modifiedILT = nlCourse.migrateModifiedILT(modifiedILT);
		var content = _getContentOfCourseAssignment() || {};
		var nlLrCourseAssignView = nlLrUpdateBatchDlg.getCourseAssignView();
		var trainerItemsInfos = nlLrUpdateBatchDlg.getTrainerItemInfos(courseAssign,
			content.modules, nlLrReportRecords.getRecords(), _groupInfo);
		nlLrCourseAssignView.show($scope, trainerItemsInfos.allModules, courseAssign, function(cm) {
			if (!cm) return null;
			var moduleInfo = {records: [], internalStatusToStatusStrs: {}};
			var internalStatusMap = {}; // {statusInteral: {statusDsplay1: true, statusDisplay2: true}}
			if (cm.type == 'module') return;
			if (cm.type == 'milestone') {
				cm.milestoneObj = {};
				var trainerItemsInfo = trainerItemsInfos[cm.id] || {};
				cm.milestoneObj['comment'] = trainerItemsInfo.comment;
				cm.milestoneObj['status'] = trainerItemsInfo.milestoneMarked;
				cm.milestoneObj['reached'] = trainerItemsInfo.reached && trainerItemsInfo.milestoneMarked 
					? nl.fmt.date2StrDDMMYY(trainerItemsInfo.reached) : '';
			}
			if (cm.type == 'iltsession') {
				var modifiedSession = modifiedILT[cm.id] || {};
				if (modifiedSession.url) {
					cm.start = modifiedSession.start || null;
					cm.url = modifiedSession.url || null;
					cm.notes = modifiedSession.notes || null;	
				}
			}

			if(cm.type == 'milestone' || cm.type == 'rating' || cm.type == 'iltsession' 
				|| cm.type == 'info' || cm.type == 'link') cm.showRemarks = true;
			var learningRecords = nlLrReportRecords.getRecords();
			for (var key in learningRecords) {
				_updateModuleInfo(learningRecords[key], moduleInfo, internalStatusMap, cm);
			}
			for(var statusId in internalStatusMap) {
				moduleInfo.internalStatusToStatusStrs[statusId] = [];
				for (var statusDispName in internalStatusMap[statusId]) {
					moduleInfo.internalStatusToStatusStrs[statusId].push(statusDispName);
				}
			}
			moduleInfo.records.sort(function(a, b) {
				if(b.name.toLowerCase() < a.name.toLowerCase()) return 1;
				if(b.name.toLowerCase() > a.name.toLowerCase()) return -1;
				if(b.name.toLowerCase() == a.name.toLowerCase()) return 0;				
			});
			return moduleInfo;
		});
	}

	function _updateModuleInfo(lr, moduleInfo, internalStatusMap, cm) {
		var recordItem = {name: lr.user.name, id: lr.user.user_id};
		moduleInfo.records.push(recordItem);
		var itemStatus = lr.repcontent.statusinfo[cm.id];
		recordItem.statusStr = _getDisplayStr(itemStatus.status);
		if (cm.showRemarks) recordItem.remarks = nl.fmt.arrayToString(itemStatus.remarks);

		if (itemStatus.status == 'waiting' && itemStatus.isAttrition) {
			recordItem.statusStr = 'Earlier attrition';
		} else if ((itemStatus.status == 'waiting' || itemStatus.status == 'pending') && itemStatus.isMarkedCertified) {
			recordItem.statusStr = 'Earlier certified';
		} else if (itemStatus.status == 'waiting') {
			recordItem.remarks = '';
		} else if (itemStatus.status == 'delayed') {
		} else if (cm.type == 'lesson') {
			if(itemStatus.maxScore > 0) {
				cm.showScore = true;
				recordItem.score = itemStatus.score || '';
				if (itemStatus.status == 'success') recordItem.statusStr = 'Passed';
			}
		} else if (cm.type == 'certificate') {
			if (itemStatus.status == 'success') recordItem.statusStr = 'Certified';
		} else if (cm.type == 'gate') {
			cm.showScore = true;
			recordItem.score = itemStatus.score || '';
			if (itemStatus.status == 'success') recordItem.statusStr = 'Passed';
		} else if (cm.type == 'info' || cm.type == 'link') {
		} else if (cm.type == 'iltsession') {
			if (itemStatus.state) recordItem.statusStr = itemStatus.state;
			if (itemStatus.otherRemarks) recordItem.remarks = nl.fmt2('{} ({})', recordItem.remarks, itemStatus.otherRemarks);
		} else if (cm.type == 'rating') {
			if (itemStatus.ratingString) recordItem.statusStr = itemStatus.rating;
			else if (itemStatus.status == 'success') recordItem.statusStr = 'Passed';
			if (itemStatus.otherRemarks) recordItem.remarks = nl.fmt2('{} ({})', recordItem.remarks, itemStatus.otherRemarks);
		} else if (cm.type == 'milestone') {
			if (itemStatus.status == 'success') {
				var reachedOn = null;
				if (itemStatus.reached) 
					reachedOn = nl.fmt.date2StrDDMMYY(nl.fmt.json2Date(itemStatus.reached || ''), null);
				else 
					reachedOn = cm.milestoneObj.reached;
				recordItem.statusStr = nl.t('Achieved');
				recordItem.statusStr2 = nl.t('{}', reachedOn);
			}
		}
		if (!(itemStatus.status in internalStatusMap)) {
			internalStatusMap[itemStatus.status] = {};
		}
		internalStatusMap[itemStatus.status][recordItem.statusStr] = true;
	}

	var _statusDisplayStrs = {
		'success' : 'Done',
		'failed' : 'Failed',
		'pending' : 'Pending',
		'waiting' : 'Locked',
		'delayed' : 'Pending',
		'started' : 'Active-Ongoing',
		'partial_success': 'Partial success'
	};

	function _getDisplayStr(status) {
		if (status in _statusDisplayStrs) return _statusDisplayStrs[status];
		return status;
	}
	
	var g_attendance = null;
	var g_milestone = null;
	var g_rating = null;

	function _getCourseAssignmnt() {
		return nlGetManyStore.getRecord(nlGetManyStore.key('course_assignment', nlLrFilter.getObjectId()));
	}

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	//Mark milestone for items inside the course
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	function _onClickOnMarkMilestone() {
		return _onUpdateTrainingBatch('milestone');
		// TODO-LATER-1150: Remove unused code
		var courseAssignment = _getCourseAssignmnt();
		g_milestone = courseAssignment.milestone ? angular.fromJson(courseAssignment.milestone) : {};
		g_attendance = courseAssignment.attendance ? angular.fromJson(courseAssignment.attendance) : {};
		g_attendance = nlCourse.migrateCourseAttendance(g_attendance);
		g_rating = courseAssignment.rating ? angular.fromJson(courseAssignment.rating) : {};
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
		oldMilestone = angular.copy(g_milestone);

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
				g_milestone = {};
				e.preventDefault();
				milestoneUpdated = false;
			for(var i=0; i<milestoneDlg.scope.milestones.length; i++) {
				var _milestone = milestoneDlg.scope.milestones[i];				
				updateMilestoneList.push({id: _milestone.id, name:_milestone.name, selectedUsers: []});
				_updateMilestoneDelta(updateMilestoneList[i], _milestone)
				if(!_milestone.milestoneObj.status) continue;
				var _learnersList = _milestone.learnersList; 
				if(g_milestone[_milestone.id]) {
					for(var j=0; j<_learnersList.length; j++) {
						var learnerMilestone = _learnersList[j];
						if(learnerMilestone.attrition) continue;
						_updateLearnerMilestoneDelta(updateMilestoneList[i], g_milestone[_milestone.id], learnerMilestone);
					}
				}
			}
			if(!milestoneUpdated) {
				return nlDlg.popupAlert({title: 'Alert message', template: 'You have not made any changes. Please update milestone markings or press cancel in the milestone marking dialog if you do not wish to make any change.'});
			}
			nl.timeout(function() {
				_markingConfirmationDlg(milestoneDlg.scope, updateMilestoneList, 'milestone', g_milestone);
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
			} else if(_milestone.milestoneNo < selectedMilestone.milestoneNo 
				&& (!_milestone.milestoneObj.status || _milestone.error || !_milestone.canMarkMilestone)) {
				pendingMilestone = _milestone;
				break;
			}
		}
		if(pendingMilestone && pendingMilestone.milestoneNo != selectedMilestone.milestoneNo) 
			return {status: false, name: pendingMilestone.name}
		return {status: true};
	}

	function _arrayToDict(arr) {
		var ret = {};
		for(var i=0; i<arr.length; i++) {
			ret[arr[i].id] = arr[i];
		}
		return ret;
	}
	
	function _getMilestoneItems(content, getOnlyMilestone) {
		var ret = [];
		var iltAndRatingIds = {};
		var learningRecords = nlLrReportRecords.getRecords();
		for(var i=0; i<content.modules.length; i++) {
			var item = content.modules[i];
			if(item.type == 'iltsession' || item.type == 'rating') iltAndRatingIds[item.id] = true;
			if(item.type != 'milestone') continue; 
			var _milestone = g_milestone[item.id] || {};
			ret.push({id: item.id, hide_locked: item.hide_locked || false, earlierItemIds: angular.copy(iltAndRatingIds), canMarkMilestone:true,  milestoneNo:i, name:item.name, 
						milestoneObj: {status: _milestone.status == 'done' ? true : false, comment:  _milestone.comment || '',
						reached: _milestone.reached ? nl.fmt.date2StrDDMMYY(nl.fmt.json2Date(_milestone.reached || ''), null, 'date') : '', updated: _milestone.updated ? nl.fmt.date2StrDDMMYY(nl.fmt.json2Date(_milestone.updated || ''), null, 'date'): ''}, 
						pendingIlts: [], pendingRatings: [], learnersList:[], attritedLearners:{}, learnersDict: _milestone.learnersDict || {}, unmarkedUsers: {}});
			iltAndRatingIds = {};
		}
		var sessions = null;
		var ratings = null;
		if(!getOnlyMilestone) {
			sessions = _getIltSessions(content, learningRecords);
			ratings = _getRatings(content, learningRecords, 'true', sessions);
			for(var i=0; i<ret.length; i++) {
				var _milestone = ret[i];
				var aboveMilestone = i > 0 ? ret[i-1] : null;
				if (aboveMilestone && aboveMilestone.attritedLearners) _milestone.attritedLearners = aboveMilestone.attritedLearners; //update next milestone with attrited ccurrent learners.
				if (aboveMilestone && (!aboveMilestone.canMarkMilestone || aboveMilestone.error)) {
					_milestone.error = aboveMilestone['name'];
					//_milestone.canMarkMilestone = false;
					continue;
				}
				var earlierSessions = _getEarlierItems(sessions, _milestone.earlierItemIds);
				//Check for earlier attendance items.
				for(var j=0; j<earlierSessions.length; j++) {
					var newAttendance = earlierSessions[j].newAttendance;
					for(var k=0; k<newAttendance.length; k++) {
						var userAttendance = newAttendance[k].attendance;
						if(newAttendance[k].not_applicable) continue;
						var groupAttendendanceObj = _attendanceObj[userAttendance.id] || {};
						if(newAttendance[k].attrition || groupAttendendanceObj.isAttrition) {
							_milestone.attritedLearners[newAttendance[k].userid] = newAttendance[k].attritionStr || groupAttendendanceObj.name;
							continue;
						}
						if(userAttendance.id === "" && newAttendance[k].canMarkLearner) {
							if(_milestone.milestoneObj.status) _milestone.unmarkedUsers[newAttendance[k].userid] = 'Earlier items not marked';
							_milestone.pendingIlts.push(earlierSessions[j].name);
							_milestone.canMarkMilestone = false;
							break;
						}
	
					}
				}
				var earlierItems = _getEarlierItems(ratings, _milestone.earlierItemIds);
				for(var j=0; j<earlierItems.length; j++) {
					var _ratings = earlierItems[j].rating;
					for(var k=0; k<_ratings.length; k++) {
						var userRating = _ratings[k].rating;
						if(_ratings[k].not_applicable) continue;
						if(earlierItems[j].ratingType == 'select') userRating = userRating.id;
						else if (earlierItems[j].rating_type == 'rag') continue;
						if(!userRating && userRating !== 0 && !_ratings[k].attrition && _ratings[k].canRate != 'not_attended') {
							if(_milestone.milestoneObj.status) _milestone.unmarkedUsers[_ratings[k].id] = 'Earlier items not marked';
							_milestone.pendingRatings.push(earlierItems[j].name);
							_milestone.canMarkMilestone = false;
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
			var statusinfo = learningRecords[key].repcontent.statusinfo;
			var userid = user.user_id;
			for(var j=0; j<ret.length; j++) {
				var item = ret[j];
				var itemStatus = statusinfo[item.id];
				var _markedMilestone = g_milestone[item.id] || {};
				var _learnersDict = _markedMilestone.learnersDict || {};
				var msUserObj = {id: repid, milestoneid: item.id, name: user.name, userid: userid};

				if(!(repid in disableMilestoneMarking) && !itemStatus.isAttrition
					&& (item.hide_locked && itemStatus.status == 'waiting')) {
					msUserObj.attrition = true;
					msUserObj.attritionStr = nl.t('Not applicable');
					item.learnersList.push(msUserObj);
					continue;
				}
				if(repid in item.unmarkedUsers) {
					disableMilestoneMarking[repid] = true;
					msUserObj.attrition = true;
					msUserObj.attritionStr = item.unmarkedUsers[repid];
					item.learnersList.push(msUserObj);
					continue;
				}
				if (repid in disableMilestoneMarking) {
					msUserObj.attrition = true;
					msUserObj.attritionStr = nl.t('Earlier milestone for learner is not marked');
					item.unmarkedUsers[repid] = true;
				} else if(itemStatus.isAttrition) {
					msUserObj.attrition = true;
					msUserObj.attritionStr = nl.t('Learner {} earlier, milestone marking is disabled', item.attritedLearners[userid]);
				} else {
					if (repid in _learnersDict) {
						msUserObj.marked = _learnersDict[repid].marked == 'done' ? true : false;
						msUserObj.remarks = _learnersDict[repid].remarks;
						msUserObj._updated =_learnersDict[repid].updated;
						msUserObj._reached =_learnersDict[repid].reached;
					} else {
						msUserObj.marked = _markedMilestone.status == 'done' ? true : false;
						msUserObj.remarks = '';
					}
				}
				if ((repid in _learnersDict) && (_learnersDict[repid].marked == "pending")) { //code to disable marking individual learner if earlier item is not marked
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
		if(updated || newMilestone.id in oldMilestone)
			g_milestone[newMilestone.id] = {status: newMilestone.milestoneObj.status ? 'done' : 'pending', comment: newMilestone.milestoneObj.comment, updated: updated, reached: reached};
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
		var newStatus = updatedLearnerMilestone.marked ? 'done' : 'pending';
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
	var _attendanceOptionsAsd = [];
	var _attendanceOptions = [];
	var _attendanceObj = {};
	function _initAttendanceOptions(attendanceArray) {
		_attendanceOptionsAsd = attendanceArray || []; 
		for (var i=0; i<_attendanceOptionsAsd.length; i++) {
			var item = _attendanceOptionsAsd[i];
			_attendanceObj[item.id] = item;
			if (item.id === 'notapplicable') continue;
			_attendanceOptions.push(item);
		}
	}

	function _onUpdateTrainingBatch(launchType) {
		nlDlg.preventMultiCalls(true, function() {
			_showUpdateTrainingBatchDlg(launchType);
		});
	}

	function _showUpdateTrainingBatchDlg(launchType) {
		var courseAssignment = _getCourseAssignmnt();
		var content = _getContentOfCourseAssignment() || {};
		nlLrUpdateBatchDlg.showUpdateTrainingBatchDlg($scope, courseAssignment, content.modules, 
			nlLrReportRecords.getRecords(), _groupInfo, launchType)
		.then(function(data) {
			if (!data) return;
			data.assignid = nlLrFilter.getObjectId();
			nlDlg.showLoadingScreen();
			nlServerApi.courseUpdateParams(data).then(function(result) {
				nlDlg.hideLoadingScreen();
				var key = nlGetManyStore.key('course_assignment', nlLrFilter.getObjectId());
				nlGetManyStore.updateTrainerObjsInRecord(key, data);
				_updateReportRecords();
			});
		});
	}

	function _onClickOnMarkAttendance() {
		return _onUpdateTrainingBatch('iltsession');
		// TODO-LATER-1150: Remove unused code
		var courseAssignment = _getCourseAssignmnt();
		g_milestone = courseAssignment.milestone ? angular.fromJson(courseAssignment.milestone) : {};
		g_attendance = courseAssignment.attendance ? angular.fromJson(courseAssignment.attendance) : {};
		g_attendance = nlCourse.migrateCourseAttendance(g_attendance);
		nlDlg.preventMultiCalls(true, _showAttendanceMarker);
	}

	var oldAttendance = {};
	var oldSessionsAttendance = {};
	var attendanceUpdated = false; //This flag is to check whether the trainer had done changes to mark or not
	var removeSessions = {status: false, removeSessionInfo : []};
	function _showAttendanceMarker() {
		var markAttendanceDlg = nlDlg.create($scope);
		markAttendanceDlg.setCssClass('nl-height-max nl-width-max');
		var content = _getContentOfCourseAssignment();
		var learningRecords = nlLrReportRecords.getRecords();
		markAttendanceDlg.scope.sessions = _getIltSessions(content, learningRecords);
		markAttendanceDlg.scope.selectedSession = markAttendanceDlg.scope.sessions[0];
		markAttendanceDlg.scope.canShowDate = (_groupInfo.props.etmAsd &&_groupInfo.props.etmAsd.length > 0) || false;
		oldAttendance = {};
		oldAttendance = angular.copy(g_attendance);
		oldSessionsAttendance = _getSessionsAttendance(markAttendanceDlg.scope.sessions);
		oldAttendance.lastAsdId = g_attendance.lastAsdId || 0;
		removeSessions = {status: false, removeSessionInfo : []};
		var lastIndex = null;
		markAttendanceDlg.scope.onClick = function(session, index) {
			var currentSession = markAttendanceDlg.scope.selectedSession;
			if(index > lastIndex) {
				var ret = _checkIfCurrentSessionIsCompletelyMarked(markAttendanceDlg.scope, currentSession, session, index, lastIndex);
				if(!ret.status) {
					nlDlg.popupAlert({title: 'Alert message', 
						template: ret.msg})
					return;	
				}
			}
			lastIndex = index;
			markAttendanceDlg.scope.selectedSession = session;
		};

		markAttendanceDlg.scope.onClickAddAsd = function(selectedSession, addAbove) {
			oldAttendance.lastAsdId++;
			var attendanceUserList = angular.copy(selectedSession.newAttendance);
			_updateUserAttendanceList(attendanceUserList);
			var dict = {id: oldAttendance.lastAsdId, hide_locked: false, name:_groupInfo.props.etmAsd[0].name || _groupInfo.props.etmAsd[0].id,
						newAttendance: attendanceUserList, canMarkAttendance: true, 
						previousMs: selectedSession.previousMs, attendanceOptions: _attendanceOptionsAsd,
						attendanceDate: null, asdSession: true, reason: _groupInfo.props.etmAsd[0], reasonOptions: _groupInfo.props.etmAsd};
			for(var i=0; i<markAttendanceDlg.scope.sessions.length; i++) {
				if (selectedSession.id == markAttendanceDlg.scope.sessions[i].id) {
					var posToAddItem = addAbove ? i : i+1;
					markAttendanceDlg.scope.sessions.splice(posToAddItem, 0, dict);
					break;
				}
			}
		};

		markAttendanceDlg.scope.onClickRemoveAsd = function(selectedSession) {
			var msg = {title: 'Alert message', template: nl.t('Do you really want to remove the selectedSession {}', selectedSession.name)};
			nlDlg.popupConfirm(msg).then(function(result) {
				if(!result) return;

				for(var i=0; i<markAttendanceDlg.scope.sessions.length; i++) {
					if (selectedSession.id != markAttendanceDlg.scope.sessions[i].id) continue;	
					var removedSession = {name: markAttendanceDlg.scope.sessions[i].name, attendanceDate: markAttendanceDlg.scope.sessions[i].attendanceDate};
					markAttendanceDlg.scope.sessions.splice(i, 1);
					markAttendanceDlg.scope.selectedSession = markAttendanceDlg.scope.sessions[i-1];
					if(!(selectedSession.id in oldSessionsAttendance)) break;
					removeSessions.status = true;
					removeSessions.removeSessionInfo.push(removedSession);
					break;
				}
			});
		}
		markAttendanceDlg.scope.bulkAttendanceMarker = function(e) {
			nlDlg.preventMultiCalls(true, function() {
				_showbulkMarkerDlg(markAttendanceDlg.scope, 'attendance');
			});
		};

		var okButton = {text: nl.t('Mark attendance'), onTap: function(e) {
			var updatedSessionsList = [];
			g_attendance = {};
			var etmAsdEnabled = markAttendanceDlg.scope.canShowDate || false;
			if(etmAsdEnabled) g_attendance = {sessionInfos: {}, lastAsdId: oldAttendance.lastAsdId};
			attendanceUpdated = removeSessions.status || false;
			e.preventDefault();
			var lastFixedId = null;
			var lastILTDate = null;
			var isAsdUpdated = false;
			var asdUpdate = {};
			for (var i = 0; i < markAttendanceDlg.scope.sessions.length; i++) {
				var session = markAttendanceDlg.scope.sessions[i];
				if (!session.asdSession && etmAsdEnabled) {
					lastFixedId = session.id;
					g_attendance.sessionInfos[session.id] = {};
				}
				var sessionObj = {id: session.id, name: session.name, isUpdated: false, selectedUsers: [], isdateUpdated: false};
				if(markAttendanceDlg.scope.canShowDate) sessionObj['sessiondate'] = session.attendanceDate;

				updatedSessionsList.push(sessionObj);
				if (etmAsdEnabled && session.canMarkAttendance && session.hasOwnProperty('attendanceDate')) {
					if(!_validateAttendanceDate(lastILTDate, session.attendanceDate, oldSessionsAttendance[session.id], session.name)) {
						return;
					}
					if (!session.asdSession && g_attendance.sessionInfos)
						g_attendance.sessionInfos[session.id]['sessiondate'] = nl.fmt.date2Str(session.attendanceDate || null, 'date');
				}
				
				if(session.asdSession) {
					var asdName = session.reason.name + (session.remarks ? ': ' + session.remarks : '');
					if(!session.reason.remarksOptional && !session.remarks) {
						nlDlg.popupAlert({title: 'Error', template: nl.t('Remarks mandatory for {}', asdName)});
						return;
					}
					if (!lastFixedId) {
						lastFixedId = '_root';
						if(!(lastFixedId in g_attendance.sessionInfos)) g_attendance.sessionInfos[lastFixedId] = {};
					}
					if(!('asd' in g_attendance.sessionInfos[lastFixedId])) g_attendance.sessionInfos[lastFixedId]['asd'] = [];
					sessionObj.name = asdName;
					g_attendance.sessionInfos[lastFixedId]['asd'].push({id: session.id, name: asdName , sessiondate: session.attendanceDate ? nl.fmt.date2Str(session.attendanceDate, 'date') : null, reason: session.reason, remarks: session.remarks});
					if(session.name != asdName) {
						isAsdUpdated = true;
						updatedSessionsList[i].isAsdUpdated = true;
						updatedSessionsList[i].reason = session.reason.name;
						updatedSessionsList[i].remarks = session.remarks;
						asdUpdate[session.id] = true;
					}
				}

				for(var j=0; j<session.newAttendance.length; j++) {
					var userSessionAttendance = session.newAttendance[j];
					if(userSessionAttendance.attendance.id == '' && userSessionAttendance.remarks == '') continue;
					if(session.canMarkAttendance && userSessionAttendance.canMarkLearner && !_validateAttendance(userSessionAttendance)) {
						nlDlg.popupAlert({title: 'Error', template: nl.t('Remarks mandatory for {} of {}', userSessionAttendance.name, session.name)});
						return;
					}
					_updateAttendanceDelta(updatedSessionsList[i], userSessionAttendance);	
					if(session.asdSession && session.id == updatedSessionsList[i].id) {
						updatedSessionsList[i].asdSession = true;
					}
				}
				if((updatedSessionsList[i].sessiondate != oldSessionsAttendance[session.id]) && (updatedSessionsList[i].sessiondate != null)) {
					isAsdUpdated = true;
					updatedSessionsList[i].isdateUpdated = true;
				}
				if (!(session.asdSession)) lastILTDate = session.attendanceDate;
			}

			if(!(attendanceUpdated || isAsdUpdated)) {
				return nlDlg.popupAlert({title: 'Alert message', template: 'You have not made any changes. Please update attendance markings or press cancel in the attendance dialog if you do not wish to make any change.'});
			}
			
			for(var i=0; i<updatedSessionsList.length; i++) {
				if(etmAsdEnabled && attendanceUpdated && !updatedSessionsList[i].sessiondate && updatedSessionsList[i].selectedUsers.length > 0 ) {
					return nlDlg.popupAlert({title: 'Alert message', template: 'Please choose the date appropriately for the session: ' + updatedSessionsList[i].name});
				}	

				var selectedUsers = updatedSessionsList[i].selectedUsers || [];
				selectedUsers.sort(function(a, b) {
					if(b.name.toLowerCase() < a.name.toLowerCase()) return 1;
					if(b.name.toLowerCase() > a.name.toLowerCase()) return -1;
					if(b.name.toLowerCase() == a.name.toLowerCase()) return 0;				
				});
				updatedSessionsList[i].selectedUsers = selectedUsers;
			}
			nl.timeout(function() {
				_markingConfirmationDlg(markAttendanceDlg.scope, updatedSessionsList, 'attendance', g_attendance);
			});
		}};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
		}};
		markAttendanceDlg.show('view_controllers/learning_reports/mark_attendance_dlg.html',
		[okButton], cancelButton);
	}

	function _updateUserAttendanceList(attendanceUserList) {
		for(var i=0; i<attendanceUserList.length; i++) {
			attendanceUserList[i].attendance = {id: ''};
			if(attendanceUserList[i].canMarkLearner){
				attendanceUserList[i].remarks = (attendanceUserList[i].remarkOptions && attendanceUserList[i].remarkOptions.length > 0) ? {id: "", name: ""} : '';
				attendanceUserList[i].attendance = {id: "notapplicable", name: 'Not applicable', timePerc: 0};
			}
		}
	}

	function _validateAttendanceDate(lastILTDate, attendedDate, oldSessionDate, name) {
		if(!attendedDate && oldSessionDate) {
			nlDlg.popupAlert({title: 'Error', template: nl.t('Attendance date is mandatory for {}.', name)});
			return false;
		}
		if(!lastILTDate) return true;
		if(attendedDate && (nl.fmt.date2Str(lastILTDate, 'date') < nl.fmt.date2Str(attendedDate, 'date'))) return true;
		if(!attendedDate && !oldSessionDate) return true;
		nlDlg.popupAlert({title: 'Error', template: nl.t('Attendance date of {} should be greater than previous fixed session.', name)});
		return false;
	}

	function _checkIfCurrentSessionIsCompletelyMarked(dlgScope, currentSession, selectedSession, currentIndex, lastIndex) {
		var currentSessionAttendance = currentSession.newAttendance;
		var sessions = dlgScope.sessions;
		var msg = '<div class="padding-mid fsh6"><p style="line-height:30px">Please mark attendance for all learners in all the earlier sessions before marking attendance for this session.</p></div>';
		for(var i=0; i<currentSessionAttendance.length; i++) {
			var userSession = currentSessionAttendance[i];
			var attendance = userSession.attendance;
			if(attendance.id == "" && userSession.canMarkLearner) {
				if(!userSession.attrition && !userSession.not_applicable && userSession.canMarkLearner)
					return {status: false, msg: msg};
			}
		}
		var pendingSession = null;
		var pendingIndex = null;
		for(var i=0; i<sessions.length; i++) {
			var session = sessions[i];
			if (i == currentIndex) {
				pendingIndex = i;
				break;
			}
			for(var j=0; j<session.newAttendance.length; j++) {
				var userSession = session.newAttendance[j];
				var attendance = userSession.attendance;
				if(attendance.id == "" && !userSession.attrition && !userSession.not_applicable && userSession.canMarkLearner) {
					pendingIndex = i;
					pendingSession = session;
				}
			}
			if(pendingSession) break;
		}
		if(pendingIndex < currentIndex)
			return {status: false, msg: msg};
		return {status: true};
	}

	function _validateAttendance(userSessionAttendance) {
		var remarks = (userSessionAttendance.remarkOptions && userSessionAttendance.remarkOptions.length > 0) ? userSessionAttendance.remarks.id : (userSessionAttendance.remarks || '');
		if (userSessionAttendance.attendance.id == '' || userSessionAttendance.attendance.id == 'notapplicable') return true;
		var selectedAttendance = _attendanceObj[userSessionAttendance.attendance.id] || {};
		return remarks || selectedAttendance.remarksOptional ? true: false;
	}

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
		var _remarks = (newAttendancePerSession.remarkOptions && newAttendancePerSession.remarkOptions.length > 0) ? newAttendancePerSession.remarks.name || '' : (newAttendancePerSession.remarks || "");
		if(oldAttendancePerSession.attId != newAttendancePerSession.attendance.id || oldAttendancePerSession.remarks != _remarks) {
			updateSessionList.selectedUsers.push({name: newAttendancePerSession.name, 
				status: (newAttendancePerSession.attendance.id in _attendanceObj) ? _attendanceObj[newAttendancePerSession.attendance.id].name : '', 
				remarks: _remarks});
			attendanceUpdated = true;
			updated = new Date();
			if (oldAttendancePerSession.attId != newAttendancePerSession.attendance.id) marked = updated;
		}
		if(!(repid in g_attendance)) g_attendance[repid] = [];
		var userAttendance = {id: sessionid, attId: newAttendancePerSession.attendance.id, updated: updated, marked: marked, remarks: _remarks };
		g_attendance[repid].push(userAttendance);
	}

	function _getAboveMilestone(milestonesItems, milestoneid) {
		for(var i=0; i<milestonesItems.length; i++) {
			var _ms = milestonesItems[i];
			if(_ms.id == milestoneid) return _ms;
		}
	}

	function _getSessionsAttendance(sessions) {
		var sessionsDate = {};
		for(var i=0; i< sessions.length; i++) {
			if(sessions[i].hasOwnProperty('attendanceDate')) {
				var id= sessions[i].id;
				sessionsDate[id] = sessions[i].attendanceDate;
			}
		}
		return sessionsDate;
	}

	var sessionNo = 1;
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
		var rootUpdated = false;
		sessionNo = 1;
		for(var i=0; i<content.modules.length; i++) {
			var item = content.modules[i];
			if(item.type == 'milestone') {
				lastMilestone = content.modules[i];
				previousMilestoneIds[item.id] = true;
			}
			if(item.type != 'iltsession') continue;
			var sessionInfos = g_attendance.sessionInfos || {};
			var sessionInfo = sessionInfos[item.id] || {};
			var dict = {id: item.id, hide_locked: item.hide_locked || false, name:item.name, newAttendance: [], canMarkAttendance: true, 
						previousMs: angular.copy(previousMilestoneIds), attendanceOptions: _attendanceOptions, canMarkAttendance: true,
						attendanceDate: nl.fmt.json2Date(sessionInfo.sessiondate || '')};
			if(lastMilestone) {
				var aboveMilestone = _getAboveMilestone(milestoneItems, lastMilestone.id);
				if(!aboveMilestone.milestoneObj.status || !aboveMilestone.canMarkMilestone) {
					dict.canMarkAttendance = false;
					dict.error = aboveMilestone.name;
				};
			}
			if(!rootUpdated && sessionInfos['_root']) {
				rootUpdated = true;
				var rootSessionInfo = sessionInfos['_root'];
				_updateAsdOnRead(ret, rootSessionInfo, dict);
			}
			dict.sessionNo = sessionNo;
			ret.push(dict);
			sessionNo++;
			if('asd' in sessionInfo && _groupInfo.props.etmAsd) {
				_updateAsdOnRead(ret, sessionInfo, dict);
			}
		}
		
		for(var key in learningRecords) {
			var userAttendance = g_attendance[parseInt(key)] || [];
			var user = learningRecords[key].user;
			var stats = learningRecords[key].stats;
			var statusinfo = learningRecords[key].repcontent.statusinfo;
			var attritionStr = learningRecords[key].stats.attritionStr || '';
			var earlierAttrition = false;
			var repid = parseInt(key);
			for(var j=0; j<ret.length; j++) {
				var itemStatus = statusinfo[ret[j].id];
				var attendanceObj = {id: repid, name: user.name,attendance: {id: ''}, 
					attrition: earlierAttrition, attritionStr: attritionStr,
					userid: user.user_id, remarks: '', canMarkLearner: true};
				if(_remarkOptions.length > 0) {
					attendanceObj.remarkOptions = angular.copy(_remarkOptions);
					attendanceObj.remarks = {id: '', name: ''};
				}
				ret[j].newAttendance.push(attendanceObj);
				if (earlierAttrition) {
					attendanceObj.canMarkLearner = false;
					continue;
				}

				if(stats.attritedAt == ret[j].id) earlierAttrition = true;	
				if(ret[j].hide_locked && itemStatus.status == 'waiting') {
					attendanceObj.disableMarkingStr = nl.t('Not applicable');
					attendanceObj.canMarkLearner = false;
					attendanceObj.not_applicable = true;
					continue;
				}
				var canMarkLearner = _canMarkLearner(milestoneItems, ret[j].previousMs, repid);
				if(!canMarkLearner) {
					attendanceObj.disableMarkingStr = nl.t('Earlier milestone for this learner is not marked');
					attendanceObj.canMarkLearner = false;
					continue;
				}

				for(var k=0; k<userAttendance.length; k++) {
					if (ret[j].id != userAttendance[k].id) continue;
					var name = userAttendance[k].attId in _attendanceObj ? _attendanceObj[userAttendance[k].attId].name : userAttendance[k].attId;
					attendanceObj.attendance = {id: userAttendance[k].attId, name: name};
					if(_remarkOptions.length > 0) {
						attendanceObj.remarkOptions = angular.copy(_remarkOptions);
						attendanceObj.remarks = {name: userAttendance[k].remarks, id: userAttendance[k].remarks};
					} else {
						attendanceObj.remarks = userAttendance[k].remarks || '';
					}
					break;
				}
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

	function _updateAsdOnRead(ret, sessionInfo, dict) {
		for(var j=0; j<sessionInfo.asd.length; j++) {
			var copyOfDict = angular.copy(dict);
			copyOfDict.id = sessionInfo.asd[j].id;
			copyOfDict.name = sessionInfo.asd[j].name;
			copyOfDict.remarks = sessionInfo.asd[j].remarks || '';
			copyOfDict.reasonOptions = _groupInfo.props.etmAsd || [];
			copyOfDict.reason = sessionInfo.asd[j].reason ? sessionInfo.asd[j].reason : _groupInfo.props.etmAsd[0];
			copyOfDict.asdSession = true;
			copyOfDict.sessionNo = sessionNo;
			copyOfDict.attendanceOptions =  _attendanceOptionsAsd;
			copyOfDict.attendanceDate = nl.fmt.json2Date(sessionInfo.asd[j].sessiondate || '');
			ret.push(copyOfDict);
			sessionNo = sessionNo++;
		}
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
		return _onUpdateTrainingBatch('rating');
		// TODO-LATER-1150: Remove unused code
		var courseAssignment = _getCourseAssignmnt();
		g_milestone = courseAssignment.milestone ? angular.fromJson(courseAssignment.milestone) : {};
		g_rating = courseAssignment.rating ? angular.fromJson(courseAssignment.rating) : {};
		g_attendance = courseAssignment.attendance ? angular.fromJson(courseAssignment.attendance) : {};
		g_attendance = nlCourse.migrateCourseAttendance(g_attendance);
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
		oldRating = angular.copy(g_rating);
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
				g_rating = {};
				ratingUpdated = false;
				e.preventDefault();
			for(var i=0; i<ratingDlg.scope.ratings.length; i++) {
				var ratingItem = ratingDlg.scope.ratings[i];
				updatedSessionsList.push({id: ratingItem.id, name:ratingItem.name, rating_type: ratingItem.ratingType, selectedUsers: []});
				for(var j=0; j<ratingItem.rating.length; j++) {
					var userRating = ratingItem.rating[j];
					if(ratingItem.ratingType == 'input' && ((userRating.rating != 0 && (!userRating.rating || userRating.rating === null)) && !userRating.remarks)) continue;
					if(ratingItem.ratingType == 'select' && ((userRating.rating.id != 0 && !userRating.rating.id) && !userRating.remarks)) continue;
					if(ratingItem.rating_type == 'rag' && (userRating.remarkOptions && userRating.remarkOptions.length > 0)) {
						if(userRating.canRate == 'attended' && !_validateRating(userRating)) {
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
				_markingConfirmationDlg(ratingDlg.scope, updatedSessionsList, 'rating', g_rating);
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

		if(!(repid in g_rating)) g_rating[repid] = [];
		if(updateSessionList.rating_type == 'input') {
			var _remarks = []; 
			if(Array.isArray(newRatingPerItem.remarks)) 
				_remarks = newRatingPerItem.remarks;
			else 
				_remarks = [newRatingPerItem.remarks]
			g_rating[repid].push({id: sessionid, attId: (newRatingPerItem.rating === 0) ? 0 : newRatingPerItem.rating, remarks: _remarks, marked: marked, updated: updated});
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
			g_rating[repid].push(_userRating);
		}
	}

	function _getRatings(content, learningRecords, isFirstTime, sessions) {
		var ret = [];
		var lastMilestone = null;
		var previousILTItem = null;
		var milestoneItems = _getMilestoneItems(content, true);
		var previousMilestoneIds = {};
		var _modules = nlReportHelper.getAsdUpdatedModules(content.modules || [], g_attendance)
		for(var i=0; i<_modules.length; i++) {
			var item = _modules[i];
			if(item.type == 'milestone') {
				previousMilestoneIds[item.id] = true;
				lastMilestone = item;
			}
			if(item.type == 'iltsession') previousILTItem = item;
			if(item.type != 'rating') continue;
			var dict = {id: item.id, hide_locked: item.hide_locked, name:item.name, rating_type: item.rating_type, rating: [],
						ratingOptions: [], remarkOptions: [], canMarkRating: true, previousMs: angular.copy(previousMilestoneIds)};
			_checkAndUpdateRatingParams(dict);
			if(lastMilestone) {
				var aboveMilestone = _getAboveMilestone(milestoneItems, lastMilestone.id);
				if(!aboveMilestone.milestoneObj.status || !aboveMilestone.canMarkMilestone) {
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
				if(_userObj.attendance.id === '' && _userObj.canMarkLearner) {
					_sessionsDict[_session.id][_userObj.id] = {timePerc: '', name: _session.name, not_applicable: _userObj.not_applicable || false};
				} else {
					_sessionsDict[_session.id][_userObj.id] = {timePerc: (_userObj.attendance.id in _attendanceObj) ? _attendanceObj[_userObj.attendance.id].timePerc : 0 , name: _session.name, not_applicable: _userObj.not_applicable || false};
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
				var _learnerEarlierIltStats = ratingItem.previousILT ? _sessionsDict[ratingItem.previousILT.id][repid] : {};

				if(!attrition && ratingItem.hide_locked && statusinfo.status == 'waiting' && _learnerEarlierIltStats.not_applicable) {
					var _dict = {id: repid, name: user.name, userid: user.user_id,
								attrition: false, errorStr: nl.t('Not applicable'),
								canRate: 'not_attended', not_applicable: true};
					ret[j].rating.push(_dict);
				} else {
					if(!attrition) {
						var canMarkLearner = _canMarkLearner(milestoneItems, ret[j].previousMs, repid);
						if(!canMarkLearner) {
							attrition = true;
							disableMarkingStr = nl.t('Earlier milestone for this learner is not marked');
						}
					}
					var _dict = {id: repid, name: user.name, userid: user.user_id,
						remarks: nl.fmt.arrayToString(statusinfo.remarks || ''), 
						attrition: attrition, attritionStr: attritionStr, disableMarkingStr: disableMarkingStr,
						canRate: 'attended'};
					if(ratingItem.rating_type != 'rag' && ratingItem.previousILT) {
						var iltStats = _sessionsDict[ratingItem.previousILT.id][repid];
						var _lastILTStatusInfo = _statusinfo[ratingItem.previousILT.id];
						if(iltStats.timePerc === '') {
							_dict.canRate = 'pending';
							_dict.errorStr = nl.t('Attendance not marked.');
						} else if (iltStats.timePerc === 0 && _lastILTStatusInfo.maxTimePerc === 0) {
							_dict.canRate = 'not_attended';
							_dict.errorStr = nl.t('Learner not attended');
						} else {
							_dict.canRate = 'attended';
						}
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
			var _rating = _groupInfo.props.ratings[i];
			if(item.rating_type == _rating.id) {
				if(_rating.type == 'number') {
					item.ratingType = 'input';
					break;
				}
				if(_rating.type != 'status' && _rating.type != 'select') break;
				item.ratingOptions = [];
				item.ratingType = 'select';
				for(var k=0; k<_rating.values.length; k++) {
					item.ratingOptions.push({id: _rating.values[k]['p'], name: _rating.values[k]['v']});
				}
				if (_rating.remarks && _rating.remarks.length > 0) {
					for (var l=0; l<_rating.remarks.length; l++) {
						var remark = _rating.remarks[l];
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
			var _ratingRemarkOptions = dlgScope.selectedRating.remarkOptions;
			bulkMarkerDlg.scope.selectedItem = dlgScope.selectedRating;
			bulkMarkerDlg.scope.markingOptions = dlgScope.selectedRating.ratingOptions;
			bulkMarkerDlg.scope.rating_type = dlgScope.selectedRating.ratingType;
			if(_ratingRemarkOptions.length > 0) {
				bulkMarkerDlg.scope.remarksOptions = _ratingRemarkOptions;
				bulkMarkerDlg.scope.isRatingRemarkOptions = true;
				for(var i=0; i< _ratingRemarkOptions.length; i++) {
					_ratingRemarkOptions[i].selected = false;
				}
			} else {
				bulkMarkerDlg.scope.remarksOptions = '';
				bulkMarkerDlg.scope.isRatingRemarkOptions = false;
			}
			bulkMarkerDlg.scope.selectedMarkingType = null;
			var selectedRemarks = '';
			bulkMarkerDlg.scope.data = {ratingNumber: '', bulkMarkStr: 'Mark all learners rating as', remarks: selectedRemarks};
			bulkMarkerDlg.scope.onItemSelected = function(item) {
				item.selected = !item.selected;
				var remarks = [];
				for(var i=0; i<bulkMarkerDlg.scope.remarksOptions.length; i++) {
					var remark = bulkMarkerDlg.scope.remarksOptions[i];
					if(remark.selected) remarks.push(remark.name);
				}
				bulkMarkerDlg.scope.data.remarks = nl.fmt.arrayToString(remarks);
			}
		}

		if(markType == 'attendance') {
			bulkMarkerDlg.scope.selectedItem = dlgScope.selectedSession;
			bulkMarkerDlg.scope.markingOptions = dlgScope.selectedSession.asdSession ? _attendanceOptionsAsd : _attendanceOptions;
			bulkMarkerDlg.scope.selectedMarkingType = null;	
			bulkMarkerDlg.scope.rating_type = 'select';

			var selectedRemarks = '';
			bulkMarkerDlg.scope.remarksOptions = '';
			if(dlgScope.selectedSession.newAttendance[0].remarkOptions) {
				bulkMarkerDlg.scope.remarksOptions = dlgScope.selectedSession.newAttendance[0].remarkOptions;
				selectedRemarks = angular.copy(dlgScope.selectedSession.newAttendance[0].remarkOptions[0]);
			}
			bulkMarkerDlg.scope.data = {ratingNumber: '', bulkMarkStr: 'Mark all learners attendance as', remarks: selectedRemarks};
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
					if(dlgScope.selectedSession.newAttendance[i].attrition ||
						!dlgScope.selectedSession.newAttendance[i].canMarkLearner) continue;
					dlgScope.selectedSession.newAttendance[i].attendance = bulkMarkerDlg.scope.selectedMarkingType;
					dlgScope.selectedSession.newAttendance[i].remarks = bulkMarkerDlg.scope.data.remarks;
				}
			}

			if(markType == 'rating') {
				if(!(bulkMarkerDlg.scope.selectedMarkingType || bulkMarkerDlg.scope.data.ratingNumber >= 0)){
					e.preventDefault();
					return nlDlg.popupAlert({title: 'Please select', template: 'Please provide ratings to mark all'});
				}
				for(var i=0; i<dlgScope.selectedRating.rating.length; i++) {
					if(dlgScope.selectedRating.rating[i].attrition || dlgScope.selectedRating.rating[i].canRate == 'pending' || dlgScope.selectedRating.rating[i].canRate == 'not_attended') continue;
					if(dlgScope.selectedRating.ratingType == 'select'){
						dlgScope.selectedRating.rating[i].rating = bulkMarkerDlg.scope.selectedMarkingType || {id: ''};
					} else {
						dlgScope.selectedRating.rating[i].rating = bulkMarkerDlg.scope.data.ratingNumber;
					}
					dlgScope.selectedRating.rating[i].remarks = bulkMarkerDlg.scope.data.remarks;
					dlgScope.selectedRating.rating[i].remarkOptions = bulkMarkerDlg.scope.remarksOptions;
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
		confirmationDlg.scope.canShowDate =dlgScope.canShowDate;
		confirmationDlg.scope.removeSessions = removeSessions;
		if(paramName == 'attendance') {
			if(!('attendance_version' in g_attendance)) 
			g_attendance['attendance_version'] = nlCourse.getAttendanceVersion();
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
					g_attendance = result;
					srvUpdateFn = nlGetManyStore.updateAttendanceInRecord;
				}
				if(result && (paramName == 'rating')) {
					g_rating = result;
					srvUpdateFn = nlGetManyStore.updateRatingInRecord;
				}
				if(result && (paramName == 'milestone')) {
					g_milestone = result;
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
			assignInfo.modifiedILT = assignContent.modifiedILT;
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

//---------------------------------------------------------------------------------------------------------------------------------------------------------
// Certificate tab
//---------------------------------------------------------------------------------------------------------------------------------------------------------
function CertificateHandler(nl, $scope) { 

	var _groupInfo= null;
	this.init = function(groupInfo) {
		_groupInfo = groupInfo;
	};

	this.canAddReportRecord = function(record) {
		return record.stats.certid && record.stats.isCertified && record.user.state;
	};

	this.getExportData = function() {
		var userDict = {};
		_updateCertificateTab(userDict);
		return {statsCountArray: _exportCertificateRows(userDict), columns: _exportCertificateColumns()};
	};

	this.updateCertificateTab = function() {
		var userDict = {};
		_updateCertificateTab(userDict);
	};

	function _updateCertificateTab(userDict) {
		var records = $scope.tabData.records;
		var userObj = {};
		var courseId = null;
		var certDict = {};

		for(var i=0; i<records.length; i++) {
			userObj = {};
			var record = records[i];
			var certificateRows = [];

			var userId = record.user.user_id;
			courseId = record.raw_record.lesson_id;
			if(!userDict[userId]) userDict[userId] = {name: record.user.name, user_id: record.user.user_id, 
													_grade: record.raw_record._grade, subject: record.raw_record.subject, 
													certificates :{}};
			userObj = userDict[userId];

			if(!certDict[courseId]) certDict[courseId] = {name: record.repcontent.name, _grade: record.raw_record._grade, 
														subject: record.raw_record.subject, valid: 0, expired: 0};
			if(!(courseId in userObj.certificates)) {
				userObj.certificates[courseId] = {name: record.repcontent.name, expireOn:record.stats.expireOn, 
					certExpired: record.stats.certExpired || null};
				if(record.stats.certExpired) certDict[courseId].expired += 1;
				else certDict[courseId].valid += 1;

			} else if(userObj.certificates[courseId].expireOn < record.stats.expireOn) {
				if(userObj.certificates[courseId].certExpired && !record.stats.certExpired) {
					certDict[courseId].valid += 1;
					certDict[courseId].expired -= 1;
				}
				userObj.certificates[courseId].expireOn = record.stats.expireOn;
			}
		};
		for(var id in certDict) certificateRows.push(certDict[id]);		
		$scope.certificateInfo = {columns: _getCertificateColumns(), rows: certificateRows};
	}

	function _getCertificateColumns() {
		var headerRow = [];
		headerRow.push({id: 'name', name: nl.t('Certificate name'), class: 'minw-string'});
		headerRow.push({id: '_grade', name: nl.t(_groupInfo.props.gradelabel), class: 'minw-string nl-text-center'});
		headerRow.push({id: 'subject', name: nl.t(_groupInfo.props.subjectlabel), class: 'minw-string nl-text-center'});
		headerRow.push({id: 'valid', name: nl.t('Valid Certificates'), class: 'minw-number nl-text-center'});
		headerRow.push({id: 'expired', name: nl.t('Expired Certificates'), class: 'minw-number nl-text-center'});
		return headerRow;
	}

	function _exportCertificateRows(userDict) {
		var certificateRows = [];
		for(var userid in userDict) {
			var userObj = userDict[userid];
			for(var certid in userObj.certificates) {
				var expireOn = nl.fmt.date2Str(userObj.certificates[certid].expireOn || null, 'date');
				certificateRows.push({user_id: userObj.user_id, name: userObj.name, 
									_grade: userObj._grade,
									subject: userObj.subject,
									certificate_name: userObj.certificates[certid].name,
									certificate_expiry: expireOn});
			}
		}
		return certificateRows;
	}

	function _exportCertificateColumns() {
		var headerRow = [];
		headerRow.push({id: 'user_id', name: nl.t('User id'), class: 'minw-string'});
		headerRow.push({id: 'name', name: nl.t('User name'), class: 'minw-number nl-text-center'});
		headerRow.push({id: '_grade', name: nl.t(_groupInfo.props.gradelabel), class: 'minw-string nl-text-center'});
		headerRow.push({id: 'subject', name: nl.t(_groupInfo.props.subjectlabel), class: 'minw-string nl-text-center'});
		headerRow.push({id: 'certificate_name', name: nl.t('Certificate'), class: 'minw-string nl-text-center'});
		headerRow.push({id: 'certificate_expiry', name: nl.t('Expiry Date'), class: 'minw-string nl-text-center'});
		return headerRow;
	}

}
//-------------------------------------------------------------------------------------------------
function LrTabManager(tabData, nlGetManyStore, nlLrFilter, _groupInfo) {

	this.update = function(checkSelected) {
		tabData.tabs = [];
		var tabs = tabData.tabs;
		if (nlLrFilter.getMode() == 'cert_report') {
			_addCertificateTab(tabs);
			_addLrTab(tabs);
		} else {
			_addOverviewTabs(tabs);
			_addDrilldownTab(tabs);
			_addNhtTabs(tabs);
			_addAttendanceTab(tabs);
			_addLrTab(tabs);
			_addTimeSummaryTab(tabs);
		}
		_updateSelectedTab(tabs, checkSelected);
	};

	function _addOverviewTabs(tabs) {
		tabs.push({
			title : 'Click here to see reports overview',
			name: 'Overview',
			icon : 'ion-stats-bars',
			id: 'overview',
			updated: false,
			tables: []
		});
	}

	function _addDrilldownTab(tabs) {
		tabs.push({
			title : 'Click here to view course-wise progress',
			name: 'Drill Down',
			icon : 'ion-social-buffer',
			id: 'drilldown',
			updated: false,
			tables: []
		});
	}

	function _addNhtTabs(tabs) {
		var type = nlLrFilter.getType();
		if (type == 'user') return;

		var batchStatus = nlGetManyStore.getNhtBatchStates();
		if(batchStatus.running) {
			tabs.push({
				title : 'Click here to view running batch summary',
				name: 'Running NHT Batches',
				icon : 'ion-filing',
				iconsuperscript : 'R',
				id: 'nhtrunning',
				updated: false,
				tables: []
			});	
		} 
		if (batchStatus.closed) {
			tabs.push({
				title : 'Click here to view closed batch summary',
				name: 'Closed NHT Batches',
				icon : 'ion-filing',
				iconsuperscript : 'C',
				id: 'nhtclosed',
				updated: false,
				tables: []
			});	
		}
	}

	function _addAttendanceTab(tabs) {
		if (nlLrFilter.getType() != 'course_assign' || 
			!_groupInfo.props.etmAsd || _groupInfo.props.etmAsd.length == 0) return;
		tabs.push({
			title : 'Click here to view NHT batch attendance summary',
			name: 'NHT Batch Attendance',
			icon: 'ion-person-stalker',
			id: 'iltbatchdata',
			updated: false,
			tables: []
		});	
	}

	function _addLrTab(tabs) {
		tabs.push({
			title : 'Click here to view learning records',
			name: 'Learning Records',
			icon : 'ion-ios-compose',
			id: 'learningrecords',
			updated: false,
			tables: [tabData.utable]
		});
	}

	function _addTimeSummaryTab(tabs) {
		tabs.push({
			title : 'Click here to view time summary',
			name: 'Time Summary',
			icon : 'ion-clock',
			id: 'timesummary',
			updated: false,
			tables: []
		});
	}

	function _addCertificateTab(tabs) {
		tabs.push({
			title : 'Click here to view certification status',
			name: 'Certificates',
			icon : 'ion-trophy',
			id: 'certificate',
			updated: false,
			tables: []
		});
	}

	function _updateSelectedTab(tabs, checkSelected) {
		if (!tabData.selectedTab) return;
		var isSelTabFound = false;
		for(var i=0; i<tabs.length; i++) {
			if (tabData.selectedTab.id != tabs[i].id) continue;
			isSelTabFound = true;
			tabData.selectedTab = tabs[i]; // Reset the new object (updated attribute many change)
			break;
		}
		if (checkSelected && !isSelTabFound) tabData.selectedTab = tabs[0];
	}
}

//-------------------------------------------------------------------------------------------------
function RecordsFilter(nl, nlDlg, nlLrFilter, nlGroupInfo, _groupInfo, $scope, onApplyFilterFn) {

	var _filterInfo = null;
	var _orgToSubOrg = {};
	var _subOrgArray = null;
	var _subjectArray = null;
	var _gradeArray = null;
	$scope.canShowFilterDialog = false;

	this.init = function() {
		var type = nlLrFilter.getType();
		if (type != 'user' && nlGroupInfo.isSubOrgEnabled()) {
			_orgToSubOrg = nlGroupInfo.getOrgToSubOrgDict();
			_subOrgArray = _initSubOrgs();
			$scope.canShowFilterDialog = true;
		}
		if ((type == 'course' || type == 'module') && !nlLrFilter.getObjectId()) {
			_subjectArray = _initOptionsArray(_groupInfo.props.subjects);
			_gradeArray = _initOptionsArray(_groupInfo.props.grades);
			$scope.canShowFilterDialog = true;
		}

		_filterInfo = {
			suborg: {id: _subOrgArray ? _subOrgArray[0].id : ''},
			subject: {id: _subjectArray ? _subjectArray[0].id : ''},
			grade: {id: _gradeArray ? _gradeArray[0].id : ''}
		};
	};

	this.showFilterDialog = function() {
		var dlg = nlDlg.create($scope);
		dlg.scope.isSubOrgEnabled = nlGroupInfo.isSubOrgEnabled();
		dlg.scope.data = _filterInfo;
		dlg.scope.options = {suborg: _subOrgArray, subject: _subjectArray, grade: _gradeArray};
		dlg.scope.help = {
			suborg: {name: 'Center', help: 'Filter the report records based on their organization unit'},
			subject: {name: _groupInfo.props.subjectlabel},
			grade: {name: _groupInfo.props.gradelabel},
		};
		var okButton = {text: nl.t('Apply'), onTap: function(e) {
			onApplyFilterFn();
		}};

		var cancelButton = {text: nl.t('Close')};
		dlg.show('view_controllers/learning_reports/lr_records_filter_dlg.html',
			[okButton], cancelButton);
	};

	this.doesPassFilter = function(record) {
		if (_filterInfo.subject.id && _filterFail('subject', record.raw_record.subject)) return false;
		if (_filterInfo.grade.id && _filterFail('grade', record.raw_record._grade)) return false;
		if (_filterInfo.suborg.id && _filterFail('suborg', _orgToSubOrg[record.user.org_unit] || 'Others')) return false;
		return true;
	};

	function _filterFail(filtAttr, recordVal) {
		var filtVal = _filterInfo[filtAttr].id;
		return (filtVal != recordVal);
	}

	function _initSubOrgs() {
		var subOrgDict = {};
		for (var key in _orgToSubOrg) {
			var subOrg = _orgToSubOrg[key] || 'Others';
			if (subOrg in subOrgDict) continue;
			var subOrgParts = subOrg.split('.');
			var center = subOrgParts[subOrgParts.length -1];
			subOrgDict[subOrg] = center;
		}
		var arr = [];
		for(var key in subOrgDict) arr.push({id: key, name: subOrgDict[key]});
		return _initOptionsArray2(arr);
	}

	function _initOptionsArray(arr) {
		arr = arr || [];
		var ret = [];
		for (var i=0; i<arr.length; i++) {
			ret.push({id: arr[i], name: arr[i]});
		}
		return _initOptionsArray2(ret);
	}

	function _initOptionsArray2(arr) {
		arr.sort(function(a, b) {
			var aName = a.name.toLowerCase();
			var bName = b.name.toLowerCase();
			if(aName > bName) return 1;
			if(aName < bName) return -1;
			return 0;
		});
		var allEntry = {id: '', name: 'All'};
		arr.splice(0, 0, allEntry);
		return arr;
	}
	
}
//-------------------------------------------------------------------------------------------------
module_init();
})();
		

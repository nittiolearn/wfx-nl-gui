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
		'nl.learning_reports.lr_course_assign_view', 'nl.learning_reports.lr_update_batch_dlg', 'nl.learning_reports.lr_pagelevelscore'])
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
	
var NlLearningReports = ['nl', 'nlDlg', 'nlRouter', 'nlServerApi', 'nlGroupInfo', 'nlTable', 'nlTableViewSelectorSrv', 'nlSendAssignmentSrv',
'nlLrHelper', 'nlReportHelper', 'nlLrFilter', 'nlLrFetcher', 'nlLrExporter', 'nlLrReportRecords', 'nlLrSummaryStats', 'nlGetManyStore', 
'nlTreeListSrv', 'nlMarkup', 'nlLrDrilldown', 'nlCourse', 'nlLrNht', 'nlLrUpdateBatchDlg', 'nlTreeSelect',
function(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlTableViewSelectorSrv, nlSendAssignmentSrv,
	nlLrHelper, nlReportHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrSummaryStats,
	nlGetManyStore, nlTreeListSrv, nlMarkup, nlLrDrilldown, nlCourse, nlLrNht, nlLrUpdateBatchDlg, nlTreeSelect) {
	this.create = function($scope, settings) {
		if (!settings) settings = {};
		return new NlLearningReportView(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlTableViewSelectorSrv, nlSendAssignmentSrv,
			nlLrHelper, nlReportHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrSummaryStats,
			$scope, settings, nlGetManyStore, nlTreeListSrv, nlMarkup, nlLrDrilldown, nlCourse, nlLrNht, nlLrUpdateBatchDlg, nlTreeSelect);
	};
}];
	
//-------------------------------------------------------------------------------------------------
function NlLearningReportView(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlTableViewSelectorSrv, nlSendAssignmentSrv,
			nlLrHelper, nlReportHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrSummaryStats,
			$scope, settings, nlGetManyStore, nlTreeListSrv, nlMarkup, nlLrDrilldown, nlCourse, nlLrNht, nlLrUpdateBatchDlg, nlTreeSelect) {
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
				nlTableViewSelectorSrv.init(userInfo).then(function() {
					_recordsFilter = new RecordsFilter(nl, nlDlg, nlLrFilter, nlGroupInfo, _groupInfo,
						$scope, nlLrReportRecords, nlTreeSelect, nlTable, _onApplyFilter);
					_init();
					resolve(true); // Has to be before next line for loading screen
					_showRangeSelection();
				});
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
		$scope.pivotConfig = {};
		if (nlGroupInfo.isSubOrgEnabled()) {
			$scope.pivotConfig.level1Field = {id: 'user.suborg'};
			$scope.pivotConfig.level2Field = {id: 'user.org_unit'};
		} else {
			$scope.pivotConfig.level1Field = {id: 'user.org_unit'};
			$scope.pivotConfig.level2Field = {id: null};
		}
		$scope.pivotConfig.pivotIndividualCourses = true;
		$scope.grpAdmin = ((_userInfo || {}).permissions || {}).nittio_support || false;

		nlLrDrilldown.init($scope);
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

	var _tableNavPos = {};
	var MAX_VISIBLE = 100;
	function _initScope() {
		$scope.debug = nlLrFilter.isDebugMode();
		$scope.toolbar = _getToolbar();
		$scope.learningRecords = nlLrReportRecords.getRecords();
		$scope.metaHeaders = nlLrHelper.getMetaHeaders(true);
		_tableNavPos = {currentpos: 0, nextpos: MAX_VISIBLE};
		$scope.utable = {
			maxVisible: MAX_VISIBLE,
			origColumns: [],
			styleTable: 'nl-table nl-table-styled3 rowlines',
			styleHeader: ' ',
			onRowClick: 'expand',
			detailsTemplate: 'view_controllers/learning_reports/learning_report_details.html',
			clickHandler: _userRowClickHandler,
			metas: nlLrHelper.getMetaHeaders(false),
			detailsInfo: {gradelabel: _userInfo.groupinfo.gradelabel, 
				subjectlabel: _userInfo.groupinfo.subjectlabel},
			getVisibleString: _getMaxVisibleStringFn,
			canShowPrev: _canShowPrev,
			canShowNext: _canShowNext,
			onClickOnNext: _onClickOnNext,
			onClickOnPrev: _onClickOnPrev,
			canSort: _canSort
		};
		_updateSelectedLrColumns();
		$scope.utable.styleDetail = 'nl-max-1100';
		var custColsDict = nl.utils.arrayToDictById(nlTableViewSelectorSrv.getCustomColumns('lr_views'));
		var lookupTablesDict = nl.utils.arrayToDictById(nlTableViewSelectorSrv.getLookupTables('lr_views'));
		nlTable.initTableObject($scope.utable, custColsDict, lookupTablesDict);
		_initTabData($scope.utable);
		_initChartData();
	}
	
	function _getMaxVisibleStringFn() {
		var records = $scope.tabData && $scope.tabData.records || [];
		var startpos = _tableNavPos.currentpos + 1;
		if (records.length > MAX_VISIBLE) {
			var endpos = _tableNavPos.currentpos + $scope.utable._internal.visibleRecs.length;
			return nl.t('{} - {} of {}', startpos, endpos, records.length);
		}
		return nl.t('{} - {} of {}', startpos, records.length, records.length);
	};

	function _canShowPrev() {
		if (_tableNavPos.currentpos > 0) return true;
		return false;
	};

	function _canShowNext() {
		var records = $scope.tabData && $scope.tabData.records || [];
		if (_tableNavPos.currentpos + MAX_VISIBLE < records.length) return true;
		return false;
	};

	function _onClickOnNext() {
		var records = $scope.tabData.records || [];
		if (_tableNavPos.currentpos + MAX_VISIBLE > records.length) return;
		if (_tableNavPos.currentpos < records.length) {
			_tableNavPos.currentpos += MAX_VISIBLE;
		}
		nlTable.updateTablePage($scope.utable, _tableNavPos.currentpos);
	};

	function _onClickOnPrev() {
		if (_tableNavPos.currentpos == 0) return;
		if (_tableNavPos.currentpos >= MAX_VISIBLE) {
			_tableNavPos.currentpos -= MAX_VISIBLE;
		}
		nlTable.updateTablePage($scope.utable, _tableNavPos.currentpos);
	}
	
	function _canSort() {
		return false;
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
			title : 'Import user data',
			icon : 'ion-android-contacts',
			id: 'importuserdata',
			onClick : _onImportUserData
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
		if (tbid == 'importuserdata') return nlLrFilter.isCustomEnabled();
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

	$scope.onLinkClicked = function(e, item, col) {
		if (!col.hyperlink) return;
		var url = nl.fmt2('#/learning_reports?type=course_assign&objid={}', item.batchid);
		nl.window.open(url,'_blank');
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
		// This function is currently called only from drilldown tab on click of rows
		// but the internal function (_generateDrillDownArray) is called for drilldown as well as nht tabs.
		if(!item.isFolder) return;
		item.isOpen = !item.isOpen;
		_updateVisibleDrilldownRows($scope.drillDownInfo.drilldown);
	};

	$scope.onClickOnShowMore = function(item) {
		item.cnt.visible += $scope.drillDownInfo.drilldown.defMaxVisible;
		_updateVisibleDrilldownRows($scope.drillDownInfo.drilldown);
	};

	$scope.sortNhtRows = function(colid) {
		if(!colid) return;
		var tabData = $scope.tabData;
		var tab = tabData.selectedTab;
		var nht = {};
		if (tab.id == 'nhtrunning') nht = $scope.nhtRunningInfo;
		else if (tab.id == 'nhtclosed') nht = $scope.nhtClosedInfo;

		nht.sort = nht.sort || {colid: null, ascending: true};
		var sortObj = nht.sort;
		if (colid == sortObj.colid) {
            sortObj.ascending = sortObj.ascending ? false : true;
        } else {
            sortObj.colid = colid;
            sortObj.ascending = true;
		}
		var summaryRow = nht.rows[0];
		if (summaryRow.isSummaryRow) nht.rows.splice(0, 1);
		nht.rows.sort(function(a, b) {
			var aVal = a[colid] || "";
			var bVal = b[colid] || "";
			if (sortObj.ascending) return _compare(aVal, bVal);
			else return _compare(bVal, aVal);
		});
		if (summaryRow.isSummaryRow) nht.rows.splice(0, 0, summaryRow);
	}

    function _compare(a,b) {
        if (a > b) return 1;
        else if (a < b) return -1;
        return 0;
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
		ret.search = '';
		ret.lastSeached = '';
		ret.filter = {};
		ret.searchPlaceholder = 'Type the search words and press enter';
		ret.records = null; 
		ret.summaryStats = null;
		ret.summaryStatSummaryRow = null;
		ret.processingOnging = true;
		ret.nothingToDisplay = false;
		ret.onSearch = _onSearch;
		ret.onFilter = function() {
			_recordsFilter.showFilterDialog(nl.utils.arrayToDictById(_getLrColumns()));
		};
		ret.onTabSelect = _onTabSelect;
		_tabManager.update(false);
	}

	function _someTabDataChanged() {
		// $scope.drillDownInfo = {table: {},
		//  charts: {selectedchart: {}, chartArray: []},
		//  drilldowntabs: [{id: ‘data’,  name: ‘Data’}, {id: ‘charts’, name: ‘Charts’}],
		// Selected tab: {id: ‘data’, name: ‘Data’}}
		$scope.drillDownInfo = {}; 
		$scope.nhtOverviewInfo = {};
		$scope.nhtRunningInfo = {};
		$scope.nhtClosedInfo = {};
		$scope.iltBatchInfo = {};
		$scope.certificateInfo = {};
		$scope.pageLevelInfo = {};
		var tabs = $scope.tabData.tabs;
		for (var i=0; i<tabs.length; i++) {
			tabs[i].updated = false;
		}
		_allNhtColumns = null;
		$scope.tabData.records = null;
	}

	function _onTabSelect(tab) {
		$scope.tabData.selectedTab = tab;
		_updateCurrentTab();
	}

	function _updateCurrentTab(avoidFlicker) {
		var tabData = $scope.tabData;
		var tab = tabData.selectedTab;
		if (tab && tab.updated) return;
		if (!avoidFlicker) {
			tabData.nothingToDisplay = false;
			tabData.processingOnging = true;
			nlDlg.showLoadingScreen();
		}
		nl.timeout(function() {
			_actualUpdateCurrentTab(tabData, tab);
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

	function _initTabDataFilterdRecords() {
		var tabData = $scope.tabData;
		if (tabData.records) return tabData.records;
		var summaryStats = nlLrSummaryStats.getSummaryStats();
		tabData.records = _getFilteredRecords(summaryStats);
		tabData.summaryStats = summaryStats.asList();
		tabData.summaryStatSummaryRow = _getSummaryStatSummaryRow(tabData.summaryStats);
		_tabManager.update(true);
		return tabData.records;
	}

	function _actualUpdateCurrentTab(tabData, tab) {
		_initTabDataFilterdRecords();
		if (!(tab && tab.canShow)) tab = $scope.tabData.selectedTab;
		tab.updated = true;
		if (tab.id == 'overview') {
			_updateOverviewTab(tabData.summaryStatSummaryRow);
		} else if (tab.id == 'learningrecords') {
			_updateLearningRecordsTab(tabData);
		} else if (tab.id == 'pagelevelrecords') {	
            _updatePageLevelRecordsTab();
		} else if (tab.id == 'timesummary') {
			_updateTimeSummaryTab();
		} else if (tab.id == 'drilldown') {
			_updateDrillDownTab();
		} else if (tab.id == 'nhtrunning') {
			_updateRunningNhtTab();
		} else if (tab.id == 'nhtclosed') {
			_updateClosedNhtTab();
		} else if (tab.id == 'nhtbatchattendance') {
			if (nlLrFilter.getType() == 'course_assign') _updateNhtBatchAttendanceTab();
			if (nlLrFilter.getType() == 'course') _updateNhtBatchAttendanceTabForCourses();
		} else if (tab.id == 'certificate') {
			_certHandler.updateCertificateTab();
		} else if (tab.id == 'nhtoverview') {
			_updateNhtOverviewBatch();
		}
	}

	var _defaultLrColIds = ["user.user_id", "user.name", "repcontent.name", "user.org_unit", "stats.status.txt"];
	var _selectedLrColIds = _defaultLrColIds;
	function _updateLearningRecordsTab(tabData) {
		_updateSelectedLrColumns();
		nlTable.updateTableRecords($scope.utable, tabData.records || []);
		$scope.lrViewSelectorConfig = {
			canEdit: nlRouter.isPermitted(_userInfo, 'assignment_manage'),
			tableType: 'lr_views',
			allColumns: _getLrColumns(),
			formulaColumns: _getLrFormulaColumns(),
			defaultViewColumns: {id: 'default', name: 'Default', columns: _defaultLrColIds},
			onViewChange: function(selectedColIdList) {
				nlDlg.showLoadingScreen();
				nl.timeout(function() {
					_onLrViewChange(selectedColIdList);
					nlDlg.hideLoadingScreen();
				}, 100);
			}
		};
	}

	function _onLrViewChange(selectedColIdList) {
		_selectedLrColIds = selectedColIdList;
		_updateSelectedLrColumns();
		var custColsDict = nl.utils.arrayToDictById(nlTableViewSelectorSrv.getCustomColumns('lr_views'));
		var lookupTablesDict = nl.utils.arrayToDictById(nlTableViewSelectorSrv.getLookupTables('lr_views'));
		nlTable.updateTableColumns($scope.utable, $scope.tabData.records || [], custColsDict, lookupTablesDict);
	}

	function _updateSelectedLrColumns() {
		var lrColumnsDict = nl.utils.arrayToDictById(_getLrColumns());
		var custColsDict = nl.utils.arrayToDictById(nlTableViewSelectorSrv.getCustomColumns('lr_views'));
		var ret = [];
		for(var i=0;i<_selectedLrColIds.length;i++) {
			var colid = _selectedLrColIds[i];
			var colInfo = lrColumnsDict[colid];
			if (colInfo && !colInfo.hideInMode)
				ret.push(lrColumnsDict[colid]);
			else if (custColsDict[colid])
				ret.push(custColsDict[colid]);
		}
		$scope.utable.origColumns = ret;
		return lrColumnsDict;
	}

	function _getLrFormulaColumns() {
		var columns = [];
		columns.push(_col('raw_record.created', 'Created Timestamp'));
		columns.push(_col('raw_record.updated', 'Updated Timestamp'));
		return columns;
	}

	function _getLrColumns() {
		_customScoresHeader = nlLrReportRecords.getCustomScoresHeader();
        var trainingParams = nlGroupInfo.getTrainingParams();
		var type = nlLrFilter.getType();
		var columns = [];
		columns.push(_col('user.user_id', 'User Id', 'text-left',  type == 'user'));
		columns.push(_col('user.name', 'User Name', 'text-left', type == 'user'));
		columns.push(_col('raw_record.typeStr', 'Report type', 'text-left', type != 'user'));
		columns.push(_col('repcontent.name', 'Course Name', 'text-left', nlLrFilter.getObjectId() && type != 'user'));
		columns.push(_col('raw_record._batchName', 'Batch name'));
		if ((_groupInfo.props || {}).batchtype) {
			columns.push(_col('repcontent.batchtype', 'Batch Type'));
		}
		columns.push(_col('raw_record._grade', _userInfo.groupinfo.gradelabel));
		columns.push(_col('raw_record.subject', _userInfo.groupinfo.subjectlabel));
		columns.push(_col('created', 'Assigned On'));
		columns.push(_col('updated', 'Last Updated On'));
		columns.push(_col('repcontent.not_before_str', 'From'));
		columns.push(_col('repcontent.not_after_str', 'Till'));
		columns.push(_col('stats.status.txt', 'Status', 'text-left', false, 'stats.status.icon'));
		columns.push(_col('stats.totalQuizAttempts', 'Quiz Attempts', 'text-right'));
		columns.push(_col('stats.percScoreStr', 'Achieved %', 'text-right'));
		columns.push(_col('stats.nMaxScore', 'Maximum Score', 'text-right'));
		columns.push(_col('stats.nScore', 'Achieved Score', 'text-right'));
		columns.push(_col('stats.progressDesc', 'Progress', 'text-left'));		
		for(var i=0; i< _customScoresHeader.length; i++)
			columns.push(_col('stats.customScoreDict.' + _customScoresHeader[i], _customScoresHeader[i], 'text-right'));

		var qsMaxLength = nlLrReportRecords.getQsMaxLength();
		for(var i=1; i <= qsMaxLength; i++) {
			columns.push(_col('quizscore.name' + i, nl.fmt2('Quiz {} name', i)));
			columns.push(_col('quizscore.score' + i, nl.fmt2('Quiz {} score', i), 'text-right'));
		}
		columns.push(_col('stats.feedbackScore', 'Feedback score'));
		columns.push(_col('stats.timeSpentMinutes', 'Online Time Spent (minutes)', 'text-right'));
		columns.push(_col('stats.iltTimeSpent', 'ILT time spent(minutes)', 'text-right'));
		columns.push(_col('stats.iltTotalTime', 'ILT total time(minutes)', 'text-right'));
		columns.push(_col('stats.delayDays', 'Delay days', 'text-right'));
		columns.push(_col('repcontent.senderName', 'Sender Name'));
		columns.push(_col('repcontent.senderID', 'Sender ID'));
		for (var i=0; i<trainingParams.length; i++) {
			var param = trainingParams[i];			
			columns.push(_col('repcontent.'+param.id, param.name, param.number ? 'text-right' : 'text-left'));
		}
		columns.push(_col('user.stateStr', 'User state', 'text-right'));
		columns.push(_col('user.email', 'Email Id'));
		columns.push(_col('user.org_unit', 'Org'));
		if (nlGroupInfo.isSubOrgEnabled())
			columns.push(_col('user.suborg', 'Center'));
		columns.push(_col('user.ou_part1', 'OU - part 1'));
		columns.push(_col('user.ou_part2', 'OU - part 2'));
		columns.push(_col('user.ou_part3', 'OU - part 3'));
		columns.push(_col('user.ou_part4', 'OU - part 4'));
		columns.push(_col('user.usertypeStr', 'User Type'));

		columns.push(_col('user.mobile', 'Mobile Number'));
		columns.push(_col('user.seclogin', 'Secondary login'));
		columns.push(_col('user.supervisor', 'Supervisor'));
		
		if (_groupInfo.props.etmAsd && _groupInfo.props.etmAsd.length > 0) {
			var milestones = _groupInfo.props.milestones;
			for(var i=0; i<milestones.length; i++) {
				var item = milestones[i];
				columns.push(_col('repcontent.'+item.id+'_planned', nl.t('Planned {} date', item.name)));
				columns.push(_col('repcontent.'+item.id+'_actual', nl.t('Actual {} date', item.name)));
			}	
		}

		var mh = _groupInfo.props.usermetadatafields || [];
		var isLdapSet = false;
		for(var i=0; i<mh.length; i++) {			
			var keyName = 'usermd.' + mh[i].id;
			if (mh[i].id == 'meta_ldap') isLdapSet = true;
			columns.push(_col(keyName, mh[i].name));
		}
		if (isLdapSet) columns.push(_col('repcontent.ldapid', 'Sender LDAP ID'));
		// Id's are always exported, So the below 3 fields.
		columns.push(_col('raw_record.id', 'Report Id', 'text-right'));
		columns.push(_col('raw_record.assignment', 'Assign Id', 'text-right'));
		columns.push(_col('raw_record.lesson_id', 'Course/ Module Id', 'text-right'));
		columns.push(_col('repcontent.targetLang', 'Language'));
		var userAttrCols = nlLrHelper.getUserAttrCols();
		for (var i=0; i<userAttrCols.length; i++) {
			var c = userAttrCols[i];
			columns.push(_col(c.id, c.name));
		}
		for (var i=0; i<columns.length; i++) columns[i].defName = columns[i].name;
		nlTableViewSelectorSrv.updateAllColumnNames('lr_views', columns);
		return columns;
	}
	
	function _col(id, name, textalign, hideInMode, icon) {
		var style = 'minw-number ';
		if (textalign) {
			style += textalign;
		} else {
			style += 'text-left';
		}
		var column = { id: id, name: name, allScreens: true,
			hideInMode: hideInMode, styleTd: style, iconType: 'ionicon'};
		if(icon) column.icon = icon;
		return column;
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
		$scope.filterCount = _recordsFilter.getFilterCount();
		_someTabDataChanged();
		_updateCurrentTab();
	}

	function _getFilteredRecords(summaryStats) {
		var records = nlLrReportRecords.getRecords();
		var tabData = $scope.tabData;
		var searchInfo = _getSearchInfo(tabData);
		var filteredRecords  = [];
		_tableNavPos = {currentpos: 0, nextpos: MAX_VISIBLE};
		for (var recid in records) {
			var record = records[recid];
			if (record.raw_record.isNHT) {
				_tabManager.nhtRecordFound();
				var modules = record.course && record.course.content ? record.course.content.modules : record.repcontent.content.modules;
				var courseAssignment = nlGetManyStore.getAssignmentRecordFromReport(record.raw_record);
				nlGetManyStore.updateMilestoneBatchInfo(courseAssignment, modules);
			} else {
				_tabManager.lmsRecordFound();
			}
			if (!_recordsFilter.doesPassFilter(record)) continue;
			if (!_doesPassSearch(record, searchInfo)) continue;
			filteredRecords.push(record);
			summaryStats.addToStats(record);
		}
		filteredRecords.sort(function(a, b) {
			return (b.stats.status.id - a.stats.status.id);
		});
		var batchStatusObj = nlLrReportRecords.getNhtBatchStatus();
		nlGetManyStore.updateBatchInfoCache(batchStatusObj);
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
			if (_isFoundInAnyOfAttrs(searchElem, repcontent, ['name', ])) continue;
			if (_isFoundInAnyOfAttrs(searchElem, raw_record, ['_batchName', 'subject', '_grade'])) continue;
			if (_isFoundInAnyOfAttrs(searchElem, user, ['username', 'name', 'email', 'org_unit'])) continue;
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
		nlTable.resetCache($scope.utable);
		_tabManager.clear();
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
		_tableNavPos = {currentpos: 0, nextpos: MAX_VISIBLE};
		var anyRecord = nlLrReportRecords.getAnyRecord();
		_setSubTitle(anyRecord);
		$scope.noDataFound = (anyRecord == null);
		_someTabDataChanged();
		_updateCurrentTab(avoidFlicker, true);
		_recordsFilter.markDirty();
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
			colors: colors,
			options:{}
		},
		{
			type: 'bar',
			title: nl.fmt2('{} assigned vs completed over time', typeStr),
			data: [[]],
			labels: [],
			series: ['Assigned', 'Completed'],
			colors: [_nl.colorsCodes.blue2, _nl.colorsCodes.done],
			options:{}			
		}];
		var brackets = typeStr == 'Courses' ? '(within courses) ': '';
		$scope.timeSummaryCharts = [{
				type: 'bar',
				id: 'days',
				title: nl.fmt2('Modules {}completed over days', brackets),
				subtitle: 'Most recent data upto a maximum of 31 days are shown',
				data: [[]],
				labels: [],
				series: [],
				colors: [_nl.colorsCodes.blue2],
				options:{}
			},
			{
				type: 'bar',
				title: nl.fmt2('Modules {}completed over weeks', brackets),
				subtitle: 'Most recent data upto a maximum of 15 weeks are shown',
				data: [[]],
				labels: [],
				series: [],
				colors: [_nl.colorsCodes.blue2],
				options:{}
			},
			{
				type: 'bar',
				title: nl.fmt2('Modules {}completed over months', brackets),
				subtitle: 'Most recent data upto a maximum of 15 months are shown',
				data: [[]],
				labels: [],
				series: [],
				colors: [_nl.colorsCodes.blue2],
				options:{}
			}],
			$scope.drillDownInfo = {};
			$scope.nhtOverviewInfo = {};
			$scope.nhtRunningInfo = {};
			$scope.nhtClosedInfo = {};
			$scope.batchinfo = {};
			$scope.iltBatchInfo = {};
			$scope.certificateInfo = {};
			$scope.pageLevelInfo = {};
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
		var records = $scope.tabData.records || [];
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
		var records = $scope.tabData.records || [];
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
		var records = $scope.tabData.records || [];
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
	// NHT overview tab
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	function _updateNhtOverviewBatch() {
		var overviewStats = nlLrNht.getStatsCountDict('', $scope.tabData.records || []);
		var allCount = overviewStats[0].cnt;
		$scope.nhtOverviewInfo = {
			firstInfoGraphics: _getfirstInfoGraphicsArray(allCount), 
			secondInfoGraphics: _getSecondInfoGraphicsArray(allCount),
			thirdInfoGraphics: _getThirdInfoGraphicsArray(allCount),
			fourthInfoGraphics: _getFourthInfoGraphicsArray(allCount),
			chartData: _getNhtChartData(allCount),
			showChart: (allCount.cntTotal > 0)
		};
	};

	function _getNhtChartData(allCount) {
		var labels = ['Training', 'OJT', 'Certification', 'Re-certification', 'Certified', 'Failed', 'Attrition'];
		var colors = [_nl.colorsCodes.blue2, _nl.colorsCodes.blue1, _nl.colorsCodes.started, _nl.colorsCodes.started, _nl.colorsCodes.done,  _nl.colorsCodes.failed, _nl.colorsCodes.delayed];
		var chartData = [{type: 'doughnut', labels: labels, 
						colors: colors, series: [], options: []}];
		chartData[0].data = [allCount.Training || 0, allCount.OJT || 0, allCount.Certification || 0,
			allCount['Re-certification'] || 0, allCount.certified || 0, allCount.failed || 0, allCount.attrition || 0];
		return chartData;
	}

	function _getfirstInfoGraphicsArray(allCount) {
		var ret = [];
		var str1 = allCount.batchFirstPass || '';
		if (str1.length > 0) str1 = str1.substring(0, str1.length-2);
		ret.push({title: 'FPA', perc: str1 || '-', showperc: true});
		var str2 = allCount.certificationThroughput || '';
		if (str2.length > 0) str2 = str2.substring(0, str2.length-2);
		ret.push({title: 'Cert throughput', perc: str2 || '-', showperc: true});
		var str3 = allCount.batchThroughput || '';
		if (str3.length > 0) str3 = str3.substring(0, str3.length-2);
		ret.push({title: 'E2E throughput', perc: str3 || '-', showperc: true});
		return ret;
    }

	function _getSecondInfoGraphicsArray(allCount) {
		var ret = [];
		ret.push({title: 'Initial HC', perc: allCount.cntTotal, showperc: false});
		var currentHc = allCount.cntTotal - (allCount.attrition || 0) - (allCount.failed || 0);
		ret.push({title: 'Current HC', perc: currentHc || 0, showperc: false});
		ret.push({title: 'Attrition', perc: allCount.attrition || 0, showperc: false});
		return ret;
    }

	function _getThirdInfoGraphicsArray(allCount) {
		var ret = [];
		ret.push({title: 'Training', perc: allCount.Training || 0, showperc: false});
		ret.push({title: 'OJT', perc: allCount.OJT || 0, showperc: false});
		ret.push({title: 'Certification', perc: allCount.Certification || 0, showperc: false});
		return ret;
    }

	function _getFourthInfoGraphicsArray(allCount) {
		var ret = [];
		ret.push({title: 'Re-certification', perc: allCount['Re-certification'] || 0, showperc: false});
		ret.push({title: 'Certified', perc: allCount.certified || 0, showperc: false});
		ret.push({title: 'Failed', perc: allCount.failed || 0, showperc: false});
		return ret;
	}
	
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	// Running and Closed NHT tabs
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	var MAX_VISIBLE_NHT = 100;
	function _updateRunningNhtTab() {
		$scope.nhtRunningInfo = _getNhtTab('nhtrunning');
		if ($scope.nhtRunningInfo.allRows.length > MAX_VISIBLE_NHT) 
			$scope.nhtRunningInfo.rows = $scope.nhtRunningInfo.allRows.slice(0, MAX_VISIBLE_NHT);
		else
			$scope.nhtRunningInfo.rows = $scope.nhtRunningInfo.allRows.slice(0);
		if ($scope.nhtRunningInfo.summaryRow) 
			$scope.nhtRunningInfo.rows.splice(0, 0, $scope.nhtRunningInfo.summaryRow);
	}

	function _updateClosedNhtTab() {
		$scope.nhtClosedInfo = _getNhtTab('nhtclosed');
		if ($scope.nhtClosedInfo.allRows.length > MAX_VISIBLE_NHT) 
			$scope.nhtClosedInfo.rows = $scope.nhtClosedInfo.allRows.slice(0, MAX_VISIBLE_NHT);
		else
			$scope.nhtClosedInfo.rows = $scope.nhtClosedInfo.allRows.slice(0);
		if ($scope.nhtClosedInfo.summaryRow) 
			$scope.nhtClosedInfo.rows.splice(0, 0, $scope.nhtClosedInfo.summaryRow);
	}

	function _getNhtTab(batchType) {
		var colInfo = _getNhtAllAndSelectedColumns();
		var statusCounts = nlLrNht.getStatsCountDict(batchType, $scope.tabData.records || []);
		var all = _generateDrillDownArray(true, statusCounts, false, (nlLrFilter.getType() == "course_assign"), true);
		var sumRow = all[0];
		if (!sumRow.isSummaryRow) sumRow = null;
		var ret = {columns: colInfo.all,  selectedColumns: colInfo.selected,
			isRunning: batchType == 'nhtrunning', currentpos: 0, nextpos: MAX_VISIBLE_NHT, MAX_VISIBLE_NHT: MAX_VISIBLE_NHT};
		if (sumRow) {
			ret.allRows = all.slice(1);
			ret.summaryRow = sumRow;
		} else {
			ret.allRows = all;
		}
		return ret;
	}

	function _getNhtAllAndSelectedColumns() {
		var allNhtColumns = _initNhtColumns();
		var ret = {all: allNhtColumns, selected: []};
		var nhtColumnsDict = nl.utils.arrayToDictById(ret.all);
		for(var i=0;i<_selectedNhtColIds.length;i++) {
			var colid = _selectedNhtColIds[i];
			if (!(colid in nhtColumnsDict)) continue;
			ret.selected.push(nhtColumnsDict[colid]);
		}
		return ret;
	}

	var _defaultNhtColIds = ["cntTotal", "batchStatus", "batchName", "suborg", "subject", "trainer", "avgDelay", "batchFirstPass", "batchThroughput"];
	var _selectedNhtColIds = _defaultNhtColIds;
	var _allNhtColumns = null;
	function _initNhtColumns() {
		if (_allNhtColumns) return _allNhtColumns;
		_allNhtColumns = _getNhtColumns();
		if (!$scope.nhtViewSelectorConfig) {
			$scope.nhtViewSelectorConfig = {
				canEdit: nlRouter.isPermitted(_userInfo, 'assignment_manage'),
				tableType: 'nht_views',
				allColumns: _getNhtColumns(),
				defaultViewColumns: {id: 'default', name: 'Default', columns: _defaultNhtColIds},
				onViewChange: function(selectedColIdList) {
					// Custom columns are not supported for NHT View
					nlDlg.showLoadingScreen();
					nl.timeout(function() {
						_onNhtViewChange(selectedColIdList);
						nlDlg.hideLoadingScreen();
					}, 100);
				}
			};
		}
		$scope.nhtViewSelectorConfig.allColumns = _allNhtColumns;
		return _allNhtColumns;
	}

	function _onNhtViewChange(selectedColIdList) {
		_selectedNhtColIds = selectedColIdList;
		_someTabDataChanged();
		_updateCurrentTab();
	}

	function _getNhtColumns() {
		var columns = [];
		_customScoresHeader = nlLrReportRecords.getCustomScoresHeader();
		var customScoresHeaderWithType = nlLrReportRecords.getCustomScoresHeaderWithType();
		var milestones = _groupInfo.props.milestones || [];
		var type = nlLrFilter.getType();
		columns.push({id: 'cntTotal', name: 'Head Count', table: true, hidePerc:true, smallScreen: true, background: 'bggrey', showAlways: true});
		columns.push({id: 'batchStatus', name: 'Batch Status', table: true, hidePerc:true, smallScreen: true, showAlways: true});
		columns.push({id: 'batchName', name: 'Batch', table: true, hidePerc:true, smallScreen: true, background: 'bggrey', showAlways: true, hyperlink: (type != 'course_assign' ? true : false)});
		columns.push({id: 'suborg', name: 'Center', table: true, hidePerc:true, smallScreen: true, background: 'bggrey', showAlways: true});
		columns.push({id: 'subject', name: _groupInfo.props.subjectlabel, table: true, hidePerc:true, smallScreen: true, background: 'bggrey', showAlways: true});

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
		columns.push({id: 'batchFirstPass', name: 'First Pass Percentage', hidePerc: true, table: true, showAlways: true});
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
		for (var i=0; i<columns.length; i++) columns[i].defName = columns[i].name;
		nlTableViewSelectorSrv.updateAllColumnNames('nht_views', columns);
		return columns;
	}

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	// Pagelevel report visualistion tab
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	function _updatePageLevelRecordsTab() {
		var records = $scope.tabData.records; 
		var pageLevelDataObj = _getPageLevelRecords(records);
		var pageLevelColumns = _getPlrColumns(); 
		var pageRows = [];
		for(var key in pageLevelDataObj) {
			pageLevelDataObj[key]['scorePerc'] = Math.round(pageLevelDataObj[key].score/pageLevelDataObj[key].maxScore*100);
			pageLevelDataObj[key]['notAttempted'] = pageLevelDataObj[key].totalAttempt - pageLevelDataObj[key].userAttempt 
			pageRows.push(pageLevelDataObj[key]);
		}
		pageRows = pageRows.sort(function(a, b) {
			if(b.pageno < a.pageno) return 1;
			if(b.pageno > a.pageno) return -1;
			if(b.pageno == a.pageno) return 0;
		});
		$scope.pageLevelInfo = {columns: pageLevelColumns, visibleRows: pageRows, rows: pageRows}; 
		if (pageRows.length == 0) return;
		_updatePageLevelCharts(pageRows); 
	}

	function _getPageLevelRecords(records) {
		var  pageLevelQuestionsObj= {};
		for(var i=0; i<records.length; i++) {
			var report = records[i];
			if (!report.raw_record.completed) continue;
			var pages = report.repcontent.learningData.pages;
			var filteredPages = report.repcontent.learningData.pagesFiltered;
			for(var j=0; j<filteredPages.length; j++) { 
				var key = filteredPages[j];
				var page = pages[key] || null;
				if (!page) continue;
				var pageNo = page.pageNo;
				var maxScore = page.maxScore + page.popupMaxScore;
				if (!pageNo || maxScore === 0) continue;
				if (!(key in pageLevelQuestionsObj)) {
					pageLevelQuestionsObj[key] = {pageno: pageNo, title:nl.t('Page {} - {}', pageNo, page.title), userAttempt:0, maxScore:0, score:0, correct:0, partial:0, incorrect:0, skipped:0, totalAttempt: 0, updated: report.repcontent.updated};
				} else {
					if(pageLevelQuestionsObj[key].updated < report.repcontent.updated) pageLevelQuestionsObj[key].title = nl.t('Page {} - {}', pageNo, page.title);
				}
				_updatePageLevelData(pageLevelQuestionsObj[key], page);
			}
	    }
		return pageLevelQuestionsObj;
	}

	function _updatePageLevelData(questionObj, page) {
		var maxScore = page.maxScore + page.popupMaxScore;
		questionObj.maxScore += maxScore;
		questionObj.totalAttempt += 1;
		if (page.answerStatus == 0) {
			questionObj.skipped++
			return;
		}
		questionObj.userAttempt++;
		var score = page.score + page.popupScore;
		if (score == maxScore) {
			questionObj.correct += 1;
			questionObj.score += score; 
			return;
		}
		if(score > 0 && score < maxScore) {
			questionObj.score += score; 
			questionObj.partial++;
			return;
		}
		if (score == 0) questionObj.incorrect++;
	}

	function _getPlrColumns() { 
		var columns = [];
		columns.push({id: 'title', name: 'Question'});
		columns.push({id: 'scorePerc', name: 'Score (%)'});
		columns.push({id: 'skipped', name: 'Not attempt'});
		columns.push({id: 'correct', name: 'Correct'});
		columns.push({id: 'partial', name: 'Partially correct'});
		columns.push({id: 'incorrect', name: 'Incorrect'});
		return columns;
	}

	function _updatePageLevelCharts(plrRows) { 
		var darkmode = false;
		if (_userInfo.groupinfo.groupCustomClass == 'nldarkmode') darkmode = true;
		var charts = {labels: [], series: ['Correct', 'Partially correct', 'Incorrect'],
					  	options: {scales: {
							xAxes: [{
								stacked: true,
								ticks: {
									callback: function(label, index, labels) {
										return label+'%';
									},
								},
								scaleLabel: {
									display: true,
								}
							}],
							yAxes: [{
								stacked: true,
								barPercentage: 0.9,
								categoryPercentage: 0.6
							}]
							},
							tooltips: {
								enabled: true,
								callbacks: {
								  label: function(tooltipItem, data) {
									var allData = data.datasets[tooltipItem.datasetIndex].data;
									var tooltipLabel = data.datasets[tooltipItem.datasetIndex].label;
									var tooltipData = allData[tooltipItem.index];
									return tooltipLabel + ": " + tooltipData + "%";
								  }
								}
							}
						}, colors: [_nl.colorsCodes.done, _nl.colorsCodes.pending, _nl.colorsCodes.failed,],
						title: "Completion percentage based on question solved.",
						currentpos: 0,
						maxvisible: 10
					};
		if (darkmode) {
			charts.options.scales.xAxes[0].gridLines = {display: true, color: "#A0A0C0"},
			charts.options.scales.xAxes[0].ticks.fontColor = "#FFFFFF"
			charts.options.scales.yAxes[0].gridLines = {display: true, color: "#A0A0C0"},
			charts.options.scales.xAxes[0].ticks = {fontColor: "#FFFFFF", 'beginAtZero': true}
			charts.options.scales.yAxes[0].ticks = {fontColor: "#FFFFFF", 'beginAtZero': true}
		}
			
		var chartArray = [charts];
		$scope.pageLevelInfo.selectedChart = chartArray[0];
		charts.graphData = [];
		for (var i=0; i<plrRows.length; i++) {
			var page = plrRows[i];
			var total = page.correct + page.partial + page.incorrect;
			var correctperc = Math.round(page.correct/total*100);
			var partialPerc = Math.round(page.partial/total*100);
			if (correctperc + partialPerc > 100) partialPerc --;
			var incorrectPerc = 100 - (correctperc + partialPerc);
			charts.graphData.push({title: page.title, correct: correctperc, partial: partialPerc, incorrect: incorrectPerc});
		}
	   
		_updatePageCharts(charts);
		$scope.pageLevelInfo.charts = {getVisibleStringFn: _getVisibleStringCharts, canShowNext: _canShowNextCharts,
									  canShowPrev: _canShowPrevCharts, onClickOnNext: _onClickOnNextCharts,
									  onClickOnPrev: _onClickOnPrevCharts};
	};

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	// Drilldown tab
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	var _drilldownStatsCountDict = {};
	var _drillDownColumns = [];

	$scope.updatePivotTable = function() {
		var dlg = nlDlg.create($scope);
		dlg.setCssClass('nl-width-max nl-height-max');
		dlg.scope.help = _getHelp();
		dlg.scope.data = {};
		dlg.scope.options = {firstPivot: _getPivotOptions()};
		dlg.scope.options.secondPivot = angular.copy(dlg.scope.options.firstPivot);
		dlg.scope.options.secondPivot.splice(0, 0, {id: null, name: ''});

        dlg.scope.data.firstPivot = $scope.pivotConfig.level1Field;
		dlg.scope.data.secondPivot = $scope.pivotConfig.level2Field;
		dlg.scope.data.pivotIndividualCourses = $scope.pivotConfig.pivotIndividualCourses;
		var okButton = {text: nl.t('Apply Filters'), onTap: function(e) {
			$scope.pivotConfig = {level1Field: dlg.scope.data.firstPivot,
				level2Field: dlg.scope.data.secondPivot,
				pivotIndividualCourses: dlg.scope.data.pivotIndividualCourses};
			nlLrDrilldown.init($scope);
			_updateDrillDownTab();
		}};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
		}};
		dlg.show('view_controllers/learning_reports/update_drilldown_pivot_dlg.html',
			[okButton], cancelButton);
	};

	function _getHelp() {
        return {
            firstPivot: {name: nl.t('Drill down level 1'), help: nl.t('Select the item to create first level drilldown (applicable in Chart and Data tabs).')},
			secondPivot: {name: nl.t('Drill down level 2'), help: nl.t('Select the item to create second level drilldown (applicable in Data tab).')},
			pivotIndividualCourses: {name: nl.t('Course drilldowns'), help: nl.t('Enable this to show individual course level drill downs in Data tab')}
        }
    }

	function _getPivotOptions() {
		var ret = [];
		var tabs = _recordsFilter.getTabs();
		var dontInclude = {'stats.status.txt': true};
		var lrColNamesDict = nl.utils.arrayToDictById(_getLrColumns());
		for(var i=0; i<tabs.length; i++) {
			var tab = tabs[i];
			if (tab.id in dontInclude) continue;
			var columnInfo = lrColNamesDict[tab.valueFieldId||tab.id] || {};
			ret.push({id: tab.id, name: columnInfo.name || tab.id,
				valueFieldId: tab.valueFieldId});
		}
		return ret;
	}

	function _updateDrillDownTab() {
		nlLrDrilldown.clearStatusCountTree();
		var records = $scope.tabData.records || [];
		for(var i=0; i<records.length; i++) {
			nlLrDrilldown.addCount(records[i]);
		}
		_drilldownStatsCountDict = nlLrDrilldown.getStatsCountDict();
		_drillDownColumns = _getDrillDownColumns();
		var selectedTab = $scope.drillDownInfo.selectedtab || null;
		$scope.drillDownInfo.tabs = [{id: 'charts', name: 'Chart', tabNo: 1}, {id: 'data', name: 'Data', tabNo: 2}];
		$scope.drillDownInfo.selectedtab = selectedTab || $scope.drillDownInfo.tabs[0];
		var all = _generateFullDrilldownArray(true, _drilldownStatsCountDict, true);
		$scope.drillDownInfo.drilldown = {columns: _drillDownColumns, allRows: all, shown: 0, childCount: all.length, defMaxVisible: 100};
		_updateVisibleDrilldownRows($scope.drillDownInfo.drilldown);
		_updateDrillDownCharts();
		return _drillDownColumns;
	}
	
	function _updateVisibleDrilldownRows(drilldown) {
		var _rows = [];
		drilldown.shown = 0;
		for(var i=0; i<drilldown.allRows.length; i++) {
			var row = drilldown.allRows[i];
			_rows.push(row);
			if (row.isOpen && row.children) 
				_addChildrenToRow(_rows, row);
			drilldown.shown += 1;
			if (!drilldown.visible) drilldown.visible = drilldown.defMaxVisible;
			if (drilldown.shown < drilldown.visible) continue;
			if (drilldown.visible < drilldown.allRows.length) {
				_rows.push({cnt: drilldown, showMoreLink: true});
				break;
			}
		}
		drilldown.rows = _rows;
	}

	function _addChildrenToRow(_rows, row) {
		var children = row.children || [];
		row.shown = 0;
		for(var i=0; i<children.length; i++) {
			var child = children[i];
			_rows.push(child);
			if (child.isOpen && child.children) {
				_addChildrenToRow(_rows, child);
			}
			row.shown += 1;
			if(!row.visible) row.visible = $scope.drillDownInfo.drilldown.defMaxVisible;
			if(row.shown < row.visible) continue;
			if (row.visible < row.children.length) {
				_rows.push({cnt: row, showMoreLink: true});
				break;
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
		columns.push({id: 'cntTotal', name: 'Total', table: true, percid:'percTotal', smallScreen: true, background: 'bggrey', showAlways: true, hidePerc:true});
		columns.push({id: 'cntInactive', name: 'Inactive', table: true, percid:'percInactive', background: 'nl-bg-blue', showAlways: true, hidePerc:true});
		if(attrition.length > 0) {
			columns.push({id: 'attrition', name: 'Attrition', percid: 'percAttrition', indentation: 'padding-left-22', hidePerc: true});
			for(var i=0; i<attrition.length; i++) {
				var name = attrition[i];
				var formattedName = _getFormattedName(name, statusDict);
				columns.push({id: attrition[i], name: formattedName, percid:'perc'+attrition[i], indentation: 'padding-left-44', hidePerc: true});
			}
		}
		columns.push({id: 'doneInactive', name: 'Completed by inactive users', percid: 'percDoneInactive', indentation: 'padding-left-22', hidePerc: true});
		columns.push({id: 'pendingInactive', name: 'Pending by inactive users', percid:'percPendingInactive', indentation: 'padding-left-22', hidePerc: true});
		columns.push({id: 'cntActive', name: 'Total (excl. inactive)', percid: 'percActive', table: true, background: 'nl-bg-blue', showAlways: true});
		columns.push({id: 'completed', name: 'Completed', percid: 'percCompleted', table: true, indentation: 'padding-left-22', showAlways: true});
		columns.push({id: 'certified', name: 'Certified/Done', percid: 'percCertified', table: true, indentation: 'padding-left-44'});
		columns.push({id: 'failed', name: 'Failed', percid: 'percFailed', table: true, indentation: 'padding-left-44'});
		columns.push({id: 'notcompleted', name: 'Not completed', percid: 'percNotcompleted', table: true, indentation: 'padding-left-22', showAlways: true});
		columns.push({id: 'started', name: 'Active ongoing', percid: 'percStarted', table: true, indentation: 'padding-left-44', showAlways: true});
		if(customStartedStates.length > 0) {
			for(var i=0; i<customStartedStates.length; i++) {
				if(customStartedStates[i] in statusDict)
					columns.push({id: customStartedStates[i], name: statusDict[customStartedStates[i]], percid:'perc'+customStartedStates[i], table: true, indentation: 'padding-left-66'});
			}
		}
		columns.push({id: 'pending', name: 'Not started', smallScreen: true, percid: 'percPending', table: true, indentation: 'padding-left-44', showAlways: true});
		columns.push({id: 'avgScore', name: 'Avg quiz score', table: true, background: 'nl-bg-blue', hidePerc:true});
		for(var i=0; i<_customScoresHeader.length; i++) {
			if (customScoresHeaderWithType[_customScoresHeader[i]] == 'rag') continue;
			columns.push({id: 'perc'+_customScoresHeader[i], name: _customScoresHeader[i], table: true, background: 'nl-bg-blue', hidePerc:true});
		}
		columns.push({id: 'avgDelay', name: 'Avg delay in days', table: false, background: 'nl-bg-blue', hidePerc:true});
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
	// Drilldown reports visualisations
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	function _updateDrillDownCharts() {
		var lrColNamesDict = _updateSelectedLrColumns();
		var level1pivotName = $scope.pivotConfig.level1Field.name || lrColNamesDict[$scope.pivotConfig.level1Field.id].name;
		$scope.drillDownInfo.charts = {options: [{id: $scope.pivotConfig.level1Field.id, name: nl.t('{} (A-Z)', level1pivotName)}, {id: 'completed', name: 'Highest completion'}, {id: 'pending', name: 'Lowest completion'}]};
		var summaryRow = (_drilldownStatsCountDict[0] && _drilldownStatsCountDict[0].children) ? _drilldownStatsCountDict[0].children : {};
		var darkmode = false;
		if (_userInfo.groupinfo.groupCustomClass == 'nldarkmode') darkmode = true;
		var charts = {labels: [], series: ['Certified/Done', 'Failed', 'Pending'],
					  	options: {scales: {
							xAxes: [{
								stacked: true,
								ticks: {
									callback: function(label, index, labels) {
										return label+'%';
									},
								},
								scaleLabel: {
									display: true,
								}
							}],
							yAxes: [{
								stacked: true,
								barPercentage: 0.9,
								categoryPercentage: 0.6
							}]
							},
							tooltips: {
								enabled: true,
								callbacks: {
								  label: function(tooltipItem, data) {
									var allData = data.datasets[tooltipItem.datasetIndex].data;
									var tooltipLabel = data.datasets[tooltipItem.datasetIndex].label;
									var tooltipData = allData[tooltipItem.index];
									return tooltipLabel + ": " + tooltipData + "%";
								  }
								}
							}
						}, colors: [_nl.colorsCodes.done, _nl.colorsCodes.failed, _nl.colorsCodes.pending],
						title: nl.t('Completion percentage based on {}', $scope.pivotConfig.level1Field.name || lrColNamesDict[$scope.pivotConfig.level1Field.id].name),
						currentpos: 0,
						maxvisible: 10
					};
		if (darkmode) {
			charts.options.scales.xAxes[0].gridLines = {display: true, color: "#A0A0C0"},
			charts.options.scales.xAxes[0].ticks.fontColor = "#FFFFFF"
			charts.options.scales.yAxes[0].gridLines = {display: true, color: "#A0A0C0"},
			charts.options.scales.xAxes[0].ticks = {fontColor: "#FFFFFF", 'beginAtZero': true}
			charts.options.scales.yAxes[0].ticks = {fontColor: "#FFFFFF", 'beginAtZero': true}
		}
		charts.graphData = [];
		for (var key in summaryRow) {
			var statsDict = summaryRow[key].cnt;
			var total = statsDict.certified+statsDict.failed+statsDict.notcompleted;
			var certPerc = Math.round(statsDict.certified/total*100);
			var failPerc = Math.round(statsDict.failed/total*100);
			if (certPerc + failPerc > 100) failPerc--;
			var notCompPerc = 100 - (certPerc+failPerc);
			charts.graphData.push({name: statsDict.name || key, cert: certPerc, failed: failPerc, notCompleted: notCompPerc});
		}
		_sortAndUpdate(charts, 'pending');
		$scope.drillDownInfo.charts.chartsArray= [charts];
		$scope.drillDownInfo.charts.selectedChart = $scope.drillDownInfo.charts.chartsArray[0];
		$scope.drillDownInfo.charts.sortAndUpdateFn = _sortAndUpdate;
		$scope.drillDownInfo.charts.getVisibleStringFn = _getVisibleStringCharts;
		$scope.drillDownInfo.charts.canShowNextFn = _canShowNextCharts;
		$scope.drillDownInfo.charts.onClickOnNextFn = _onClickOnNextCharts;
		$scope.drillDownInfo.charts.onClickOnPrevFn = _onClickOnPrevCharts;
	};

	function _sortAndUpdate(charts, sortOn) {
		charts.currentpos = 0;
		if (sortOn == 'completed') {
			charts.graphData.sort(function(a, b) {
				if(b.notCompleted < a.notCompleted) return 1;
				if(b.notCompleted > a.notCompleted) return -1;
				if(b.notCompleted == a.notCompleted) return 0;
			});	
		} else if (sortOn == 'pending'){
			charts.graphData.sort(function(a, b) {
				if(b.notCompleted > a.notCompleted) return 1;
				if(b.notCompleted < a.notCompleted) return -1;
				if(b.notCompleted == a.notCompleted) return 0;
			});	
		} else {
			charts.graphData.sort(function(a, b) {
				if(b.name < a.name) return 1;
				if(b.name > a.name) return -1;
				if(b.name == a.name) return 0;
			});	
		}
		if (charts.graphData.length < charts.maxvisible) charts.maxvisible = charts.graphData.length;
		var series1 = [];
		var series2 = [];
		var series3 = [];
		charts.labels = [];
		for(var i=0; i<charts.maxvisible; i++) {
			charts.labels.push(charts.graphData[i].name);
			series1.push(charts.graphData[i].cert);
			series2.push(charts.graphData[i].failed);
			series3.push(charts.graphData[i].notCompleted);
		}
		charts.data = [series1, series2, series3];
	}

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	// Common code for navigation of charts for drilldown and pagelevel Charts
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	function _getVisibleStringCharts(selectedChart) {
		if (selectedChart.currentpos + selectedChart.maxvisible < selectedChart.graphData.length) {
			return nl.t('{} - {} of {}', selectedChart.currentpos+1, selectedChart.currentpos+selectedChart.maxvisible, selectedChart.graphData.length)
		} 
		return nl.t('{} - {} of {}', selectedChart.currentpos+1, selectedChart.graphData.length, selectedChart.graphData.length);
	}

	function  _canShowPrevCharts(selectedChart) {
		if (!selectedChart) return;
		if (selectedChart.currentpos > 0) return true;
		return false;
	};

	function _canShowNextCharts(selectedChart) {
		if (!selectedChart) return;
		if (selectedChart.currentpos + selectedChart.maxvisible < selectedChart.graphData.length) return true;
		return false;
	}

	function _onClickOnNextCharts(selectedChart, type) {
		if (selectedChart.currentpos + selectedChart.maxvisible > selectedChart.graphData.length) return;
		if (selectedChart.currentpos < selectedChart.graphData.length) {
			selectedChart.currentpos += selectedChart.maxvisible;
		}
		if (type == 'page') _updatePageCharts(selectedChart)
		else _updateCharts(selectedChart);
	}

	function _onClickOnPrevCharts(selectedChart, type) {
		if (selectedChart.currentpos == 0) return;
		if (selectedChart.currentpos >= selectedChart.maxvisible) {
			selectedChart.currentpos -= selectedChart.maxvisible;
		}
		if (type == 'page') _updatePageCharts(selectedChart)
		else _updateCharts(selectedChart);
	}

	function _updateCharts(selectedChart) {
		var records = selectedChart.graphData || [];
		var series1 = [];
		var series2 = [];
		var series3 = [];
		var labels = [];
		var endPos = selectedChart.currentpos+selectedChart.maxvisible
		if (endPos > records.length) endPos = records.length;
		for(var i=selectedChart.currentpos; i<endPos; i++) {
			labels.push(records[i].name);
			series1.push(records[i].cert);
			series2.push(records[i].failed);
			series3.push(records[i].notCompleted);
		}
		selectedChart.data = [series1, series2, series3];
		selectedChart.labels = labels;
	}

	function _updatePageCharts(selectedChart) {
		var records = selectedChart.graphData || [];
		var series1 = [];
		var series2 = [];
		var series3 = [];
		var labels = [];
		var endPos = selectedChart.currentpos+selectedChart.maxvisible
		if (endPos > records.length) endPos = records.length;
		for(var i=selectedChart.currentpos; i<endPos; i++) {
			var pageItem = selectedChart.graphData[i]
			var title = pageItem.title; 
			if(title.length >= 15) {
				title = title.slice(0,15);  
				title  = title + "...";  
			}
			labels.push(title);
			series1.push(records[i].correct);
			series2.push(records[i].partial);
			series3.push(records[i].incorrect);
		}
		selectedChart.data = [series1, series2, series3]; 
		selectedChart.labels = labels;
	}

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	// Common code between Drilldown and NHT tabs
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	function _generateDrillDownArray(firstTimeGenerated, statusDict, singleRepCheck, showLeafOnly, isNHT) {
		var drillDownArray = [];
		var isSingleReport = (singleRepCheck && Object.keys(statusDict).length == 2) ? true : false;
		for(var key in statusDict) {
			var root = statusDict[key];
			if(key == 0) {
				root.cnt.style = 'nl-bg-dark-blue';
				root.cnt['sortkey'] = 0+root.cnt.name;
				root.cnt.isSummaryRow = true;
				if(isSingleReport) continue;
			} else {
				root.cnt.style = 'nl-bg-blue';
				root.cnt['sortkey'] = 1+root.cnt.name+key;
			}
			if(showLeafOnly) {
				_addSuborgOrOusToArray(drillDownArray, root.children, root.cnt.sortkey, 
					null, showLeafOnly, isNHT);
			} else {
				drillDownArray.push(root.cnt);
				if(firstTimeGenerated && isSingleReport) root.cnt.isOpen = true;
				if(isNHT) {
					root.cnt.isOpen = true;
					root.cnt.cls = 'alternate';
					showLeafOnly = true;
				}
				if(root.cnt.isOpen) _addSuborgOrOusToArray(drillDownArray, root.children,
					root.cnt.sortkey, null, showLeafOnly, isNHT);
			}
		}
		drillDownArray.sort(function(a, b) {
			if(b.sortkey.toLowerCase() < a.sortkey.toLowerCase()) return 1;
			if(b.sortkey.toLowerCase() > a.sortkey.toLowerCase()) return -1;
			if(b.sortkey.toLowerCase() == a.sortkey.toLowerCase()) return 0;				
		});
		return drillDownArray;
	};

	function _addSuborgOrOusToArray(drillDownArray, subOrgDict, sortkey, subOrgName, showLeafOnly) {
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
					_addSuborgOrOusToArray(drillDownArray, org.children, org.cnt.sortkey, 
						org.cnt.name, showLeafOnly);
				}
			} else {
				drillDownArray.push(org.cnt);
				if(org.cnt.isOpen && org.children) _addSuborgOrOusToArray(drillDownArray,
					org.children, org.cnt.sortkey, org.cnt.name, showLeafOnly);
			}
		}
	}

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	// Code to compute and push all the for drilldown
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	function _generateFullDrilldownArray(firstTimeGenerated, statusDict, singleRepCheck) {
		var drillDown = [];
		var isSingleReport = (singleRepCheck && Object.keys(statusDict).length == 2) ? true : false;
		for(var key in statusDict) {
			var root = statusDict[key];
			if(key == 0) {
				root.cnt.style = 'nl-bg-dark-blue';
				root.cnt['sortkey'] = 0+root.cnt.name;
				root.cnt.isSummaryRow = true;
				if(isSingleReport) continue;
			} else {
				root.cnt.style = 'nl-bg-blue';
				root.cnt['sortkey'] = 1+root.cnt.name+key;
			}

			drillDown.push(root.cnt);
			root.cnt.childCount = 0;
			root.cnt.isOpen = false;
			root.cnt.shown = 0;
			root.cnt.children = [];
			if (root.children) _addSuborgOrOusToDrilldownArray(root.cnt, drillDown, root.children,
				root.cnt.sortkey, null);
		}
		drillDown.sort(function(a, b) {
			if(b.sortkey.toLowerCase() < a.sortkey.toLowerCase()) return 1;
			if(b.sortkey.toLowerCase() > a.sortkey.toLowerCase()) return -1;
			if(b.sortkey.toLowerCase() == a.sortkey.toLowerCase()) return 0;				
		});
		return drillDown;
	};

	function _addSuborgOrOusToDrilldownArray(folderitem, drillDown, subOrgDict, sortkey, subOrgName) {
		for(var key in subOrgDict) {
			folderitem.childCount++;
			var org = subOrgDict[key];
				org.cnt['sortkey'] = sortkey+'.aa'+org.cnt.name;
				org.cnt['orgname'] = org.cnt['name'];
				if(nlGroupInfo.isSubOrgEnabled()) {
					if(subOrgName && org.cnt['name'].indexOf(subOrgName+'.') === 0) org.cnt['orgname'] = org.cnt['name'].slice(subOrgName.length+1);
				}
				folderitem.children.push(org.cnt);
				if(org.children) {
					org.cnt.childCount = 0;
					org.cnt.shown = 0;
					org.cnt.children = [];
					org.cnt.isOpen = false;
					_addSuborgOrOusToDrilldownArray(org.cnt, drillDown,
					org.children, org.cnt.sortkey, org.cnt.name);
				}
		}
	}

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	// NhtBatchAttendance tab
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	function _updateSessionDates(sessionInfo, sessionDates) {
		var sessionDate =  sessionInfo.sessiondate || '';
		if (!sessionDate) return;
		if (sessionInfo.shiftHrs && sessionInfo.shiftMins)
			sessionDates[sessionDate] = {start: nl.t('{}:{}', sessionInfo.shiftHrs, sessionInfo.shiftMins), end: _getShiftEnd(sessionInfo), sessionName: sessionInfo.sessionName};
		else sessionDates[sessionDate] = {sessionName: sessionInfo.sessionName};
	}

	function _getShiftEnd(sessionInfo) {
		if (sessionInfo.shiftEnd) return sessionInfo.shiftEnd;
		if (sessionInfo.shiftHrs && sessionInfo.shiftMins) {
			var shiftEndHrs = parseInt(sessionInfo.shiftHrs) + 9;	
			return nl.t('{}: {}', shiftEndHrs, sessionInfo.shiftMins);
		}
	}
	//TODO-NOW: Please check root is udpated in asdAddedModules
	function _updateAsdSessionDates(sessionInfo, sessionDates, uniqueFixedSessionDates) {
		for(var j=0; j<sessionInfo.asd.length; j++) {
			var session = sessionInfo.asd[j];
			session.sessionName = session.name || sessionInfo.name;
			var sessionDate =  sessionInfo.sessiondate;
			if(session && !uniqueFixedSessionDates[sessionDate]) _updateSessionDates(session, sessionDates);
		}
	}

	function _updateNhtBatchAttendanceTabForCourses() {
		var tmsRecordsDict = nlLrNht.getStatsCountDict('', $scope.tabData.records || [], true);
		var assignmentObj = nlGetManyStore.getTmsAssignmentInfo();
		var sessionDates = {};
		var assignmentToObj = {};
		var uniqueFixedSessionDates = {};
		for (var assignid in assignmentObj) {
			var ilts = [];
			assignid = parseInt(assignid);
			var assignKey = nlGetManyStore.key('course_assignment', assignid);
			var courseAssignment = nlGetManyStore.getRecord(assignKey);
			var attendance = courseAssignment.attendance ? angular.fromJson(courseAssignment.attendance) : {};
				attendance = nlCourse.migrateCourseAttendance(attendance);
			var modules = assignmentObj[assignid].modules || [];
			var asdAddedModules = nlReportHelper.getAsdUpdatedModules(modules || [], attendance);
			var	sessionInfos = attendance.sessionInfos || {};
			if ('_root' in sessionInfos) _updateAsdSessionDates(sessionInfos['_root'], sessionDates, uniqueFixedSessionDates);
			for(var i=0; i<asdAddedModules.length; i++) {
				var cm = asdAddedModules[i];
				if (cm.type != 'iltsession') continue;
				ilts.push(cm);
			}
			assignmentToObj[assignid] = {sessions: ilts};
		}
		var records = [];
		for (var key in tmsRecordsDict) records.push(tmsRecordsDict[key]);
		_updateNhtAttendanceRows(null, records, assignmentToObj, true);
	}
	
	function _updateNhtBatchAttendanceTab() {
		var records = $scope.tabData.records || [];
		var content = _getContentOfCourseAssignment();
		var courseAssignment = _getCourseAssignmnt();
		var attendance = courseAssignment.attendance ? angular.fromJson(courseAssignment.attendance) : {};
			attendance = nlCourse.migrateCourseAttendance(attendance);
		var asdAddedModules = nlReportHelper.getAsdUpdatedModules(content.modules || [], attendance)
		var sessionDates = {};
		var iltSessions = [];
		var	sessionInfos = attendance.sessionInfos || {};	
		var uniqueFixedSessionDates = {};
		if ('_root' in sessionInfos) _updateAsdSessionDates(sessionInfos['_root'], sessionDates, uniqueFixedSessionDates);
		for(var i=0; i<asdAddedModules.length; i++) {
			var cm = asdAddedModules[i];
			if (cm.type != 'iltsession') continue;
			iltSessions.push(cm);
		}
		_updateNhtAttendanceRows(iltSessions, records, null, false);
	}

	function _updateNhtAttendanceRows(iltSessions, records, assignmentObj, multipleCourses) {
		var userObj = {};
		var iltBatchInfoRow = [];
		var metaHeaders = $scope.metaHeaders;
		var sessionDates = {};
		for(var i=0; i<records.length; i++) {
			userObj = {};
			var record = records[i];
			var usermd = record.usermd || {};
			userObj.name = record.user.name;
			userObj.coursename = record.repcontent.name;
			userObj.batchname = record.raw_record._batchName;
			userObj.not_before = nl.fmt.fmtDateDelta(record.repcontent.not_before, null, 'date');
			userObj.not_after = nl.fmt.fmtDateDelta(record.repcontent.not_after, null, 'date');
			var statusStr = record.stats._origstatus;
			if(statusStr.indexOf('attrition') == 0) userObj.learner_status = nl.t('Attrition');
			else if (record.user.state == 0) userObj.learner_status = nl.t('Inactive');
			else userObj.learner_status = nl.t('Active');

			for(var j=0; j<metaHeaders.length; j++) {
				var metas = metaHeaders[j];
				userObj[metas.id] = usermd[metas.id] || "";
			}
			var _statusInfos = record.repcontent.statusinfo;
			userObj.subject = record.raw_record.subject;
			var isCertifiedOrAttrition = false;
			if (multipleCourses) 
				iltSessions = assignmentObj[record.raw_record.assignment].sessions;
			for(var j=0; j<iltSessions.length; j++) {
				var cm = iltSessions[j];
				var sessionInfo = _statusInfos[cm.id];
				if (isCertifiedOrAttrition) continue;
				isCertifiedOrAttrition = (sessionInfo.attId == 'certified') || sessionInfo.isAttrition;
				var sessionDate = sessionInfo.attMarkedOn || "";
				var fmtSessionDate = nl.fmt.date2StrDDMMYY(nl.fmt.json2Date(sessionDate || ''), null, 'date');
				if (fmtSessionDate && !(fmtSessionDate in sessionDates)) {
					if (sessionInfo.shiftHrs && sessionInfo.shiftMins)
						sessionDates[fmtSessionDate] = {date: sessionDate, start: nl.t('{}:{}', sessionInfo.shiftHrs, sessionInfo.shiftMins), end: _getShiftEnd(sessionInfo), sessionName: cm.name};
					else 
						sessionDates[fmtSessionDate] = {date: sessionDate, name: cm.name};
				}
				if (sessionInfo.stateStr == 'notapplicable' || !sessionInfo.state || sessionInfo.status == 'waiting') continue;
				if (fmtSessionDate)
					userObj[fmtSessionDate] = sessionInfo.state || '-';
			}
			iltBatchInfoRow.push(userObj);
		};
		iltBatchInfoRow.sort(function(a, b) {
			if(b.name.toLowerCase() < a.name.toLowerCase()) return 1;
			if(b.name.toLowerCase() > a.name.toLowerCase()) return -1;
			if(b.name.toLowerCase() == a.name.toLowerCase()) return 0;				
		});
		var nhtHeaderObj = _getNhtBatchAttendanceColumns(sessionDates, multipleCourses);
		if (!multipleCourses)
			iltBatchInfoRow.splice(0, 0, nhtHeaderObj.titleRow);
		var headercols = [];
		for (var i=0; i<nhtHeaderObj.header.length; i++) {
			var header = nhtHeaderObj.header[i];
			if (header.hideCol) continue;
			headercols.push(header);
		}
		$scope.iltBatchInfo = {columns: headercols, origColumns: nhtHeaderObj.header, rows: iltBatchInfoRow, 
							   isMoreCols: nhtHeaderObj.totalCnt > 65, totalCnt: nhtHeaderObj.totalCnt, rowCnt: iltBatchInfoRow.length};
		$scope.iltBatchInfo.visibleRows = iltBatchInfoRow.slice(0, 100);
	}

	function _getNhtBatchAttendanceColumns(sessionDates, isCourses) {
		var headerRow = [];
		headerRow.push({id: 'name', name: nl.t('Learner name'), class: 'minw-string'});
		headerRow.push({id: 'subject', name: _groupInfo.props.subjectlabel, class: 'minw-string'});
		headerRow.push({id: 'coursename', name: nl.t('Course name'), table: false, class: 'minw-string'});
		headerRow.push({id: 'batchname', name: nl.t('Batch name'), table: false, class: 'minw-string'});
		headerRow.push({id: 'not_before', name: nl.t('Start date'), class: 'minw-number'});
		headerRow.push({id: 'not_after', name: nl.t('End date'), class: 'minw-number'});
		headerRow.push({id: 'learner_status', name: nl.t('Attrition status'), class: 'minw-number'});
		for(var i=0; i<$scope.metaHeaders.length; i++) {
			var metas = $scope.metaHeaders[i];
			headerRow.push({id: metas.id, name: metas.name, class: 'minw-number'});
		}
		var sessionDatesArray = [];
		for(var key in sessionDates) {
			var dateObj = sessionDates[key] || {};
			var	date = dateObj.date;
			if (isCourses)
				sessionDatesArray.push({date: nl.fmt.json2Date(date) || ''});
			else
				sessionDatesArray.push({date: nl.fmt.json2Date(date) || '', start: dateObj.start, end: dateObj.end , sessionName: dateObj.sessionName});
		}
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
		var sessionDatesLen = sessionDatesArray.length - 65;
		if (isCourses) {
			for(var i=0; i<sessionDatesArray.length; i++) {
				var date = nl.fmt.date2StrDDMMYY(sessionDatesArray[i].date, null, 'date');
				var hrname = date;
				headerRow.push({id: date, name: hrname, class: 'minw-number', hideCol: i < sessionDatesLen ? true : false});
			}
			return {header: headerRow, totalCnt: sessionDatesArray.length};
		}
		var titleDict = {class: 'header'};
		for(var i=0; i<sessionDatesArray.length; i++) {
			var date = nl.fmt.date2StrDDMMYY(sessionDatesArray[i].date, null, 'date');
			var hrname = date;
			if (sessionDatesArray[i].start) hrname += nl.t(' {} - {}', sessionDatesArray[i].start, sessionDatesArray[i].end);
			headerRow.push({id: date, name: hrname, class: 'minw-number', hideCol: i < sessionDatesLen ? true : false});
			titleDict[date] = sessionDatesArray[i].sessionName || "";
		}
		return {header: headerRow, titleRow: titleDict, totalCnt: sessionDatesArray.length};
	}

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	function _onExport() {
		if (nlLrFetcher.fetchInProgress()) return;
		if(!_customScoresHeader) _customScoresHeader = nlLrReportRecords.getCustomScoresHeader();

		var header = [{id: 'courseName', name: 'Course name'}];
		var lrColNamesDict = _updateSelectedLrColumns();
		header.push({id: 'level1Field', name: lrColNamesDict[$scope.pivotConfig.level1Field.id].name});
		if ($scope.pivotConfig.level2Field.id) header.push({id: 'level2Field',
			name: lrColNamesDict[$scope.pivotConfig.level2Field.id].name});
		var drillDownCols = _updateDrillDownTab();
		for(var i=0; i<drillDownCols.length; i++) {
			var col = drillDownCols[i];
			if(col.table) header.push(col);
		}
		var drillDownStats = {statsCountDict: _drilldownStatsCountDict, columns: header};

		var nhtStats = {};
		var batchStatus = nlGetManyStore.getNhtBatchStates();
		if (batchStatus.running || batchStatus.closed) {
			if (batchStatus.running) {
				_updateRunningNhtTab();
				nhtStats.runningRows = $scope.nhtRunningInfo.allRows.slice(0);
				if ($scope.nhtRunningInfo.summaryRow)
					nhtStats.runningRows.splice(0, 0, $scope.nhtRunningInfo.summaryRow);
			}
			if (batchStatus.closed) {
				_updateClosedNhtTab();
				nhtStats.closedRows = $scope.nhtClosedInfo.allRows.slice(0);
				if ($scope.nhtClosedInfo.summaryRow)
					nhtStats.closedRows.splice(0, 0, $scope.nhtClosedInfo.summaryRow);
			}
			nhtStats.runningHeaders = [];
			nhtStats.closedHeaders = [];
			var allNhtColumns = _initNhtColumns();
			for(var i=0; i<allNhtColumns.length; i++) {
				var col = allNhtColumns[i];
				if(col.showIn != 'closed') nhtStats.runningHeaders.push(col);
				if(col.showIn != 'running') nhtStats.closedHeaders.push(col);
			}
		}
		var subtype = nlLrFilter.getRepSubtype();
		var lrStats = {columns: $scope.utable.origColumns};
		var certificateStats = null;
		if (nlLrFilter.getType() == 'course' && nlLrFilter.getMode() == 'cert_report') {
			certificateStats = _certHandler.getExportData();
		}
        var isNHTEnabled = (!_groupInfo.props.milestones) ? false : true;
		nlLrExporter.export($scope, _getReportRecordsForExport, _customScoresHeader, 
			drillDownStats, nhtStats, (isNHTEnabled &&  _tabManager.isTmsRecordFound() && subtype != 'lms' || subtype == 'nht') ? _getNhtBatchAttendanceFn : null, lrStats, certificateStats);
	}
	
	function _getNhtBatchAttendanceFn() {
		if (nlLrFilter.getType() == 'course_assign') _updateNhtBatchAttendanceTab();
		if (nlLrFilter.getType() == 'course') _updateNhtBatchAttendanceTabForCourses();
		return {statsCountArray: $scope.iltBatchInfo.rows, columns: $scope.iltBatchInfo.origColumns};
	}

	function _getReportRecordsForExport(bFiltered) {
		return bFiltered ? _initTabDataFilterdRecords() : nlLrReportRecords.asList();
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
			_learningReportDeleteInLoop(repids, 0, function(status) {
				nlDlg.hideLoadingScreen();
				nlDlg.popdownStatus(0);
				nlDlg.closeAll();
				if (!status) return;
				for (var i=0; i<repids.length; i++) nlLrReportRecords.removeRecord(repids[i]);
				_updateScope();
			});
		}};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
		}};
		confirmationDlg.show('view_controllers/learning_reports/confirm_bulk_delete_dlg.html',
			[okButton], cancelButton);
	};

	function _learningReportDeleteInLoop(repids, startpos, onDoneFn) {
		nlDlg.popupStatus(nl.fmt2('Deleting ... ({} of {} done)', startpos, repids.length), false);
		nlServerApi.learningReportDelete({repids: repids, startpos: startpos}).then(function(result) {
			if (!result.more) return onDoneFn(true);
			_learningReportDeleteInLoop(repids, result.nextstartpos, onDoneFn);
		}, function() {
			onDoneFn(false);
		});
	}

	function _onImportUserData() {
		nlLrHelper.showImportUserAttrsDlg($scope).then(function(result) {
			if (!result) return;
			nlTable.resetCache($scope.utable);
			_updateScope();
		});
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
	
	function _getCourseAssignmnt() {
		return nlGetManyStore.getRecord(nlGetManyStore.key('course_assignment', nlLrFilter.getObjectId()));
	}

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	// Mark milestone attendance and ratings for items inside the course
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	function _onClickOnMarkMilestone() {
		return _onUpdateTrainingBatch('milestone');
	}

	function _onClickOnMarkAttendance() {
		return _onUpdateTrainingBatch('iltsession');
	}

	function _onClickOnMarkRatings() {
		return _onUpdateTrainingBatch('rating');
	}

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

	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	//Code for modifying assignment
	//---------------------------------------------------------------------------------------------------------------------------------------------------------	
	function _onClickModifyAssignment() {
		var launchType = nlLrFilter.getType(); 
		var nominatedUsers = nlLrReportRecords.getNominatedUserDict();
		var record = nlLrReportRecords.getAnyRecord();
		var key = '';
		if (launchType == 'module_assign') {
			key = 'assignment';
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
			enableSubmissionAfterEndtime: true,
			
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
			var trainingParams = nlGroupInfo.getTrainingParams();
			for (var i=0; i<trainingParams.length; i++) {
				var param = trainingParams[i];
				assignInfo[param.id] = assignContent[param.id] || '';	
			}
			assignInfo.course = nlGetManyStore.getRecord(nlGetManyStore.key('course', assignContent.courseid));
			assignInfo.submissionAfterEndtime = assignContent.submissionAfterEndtime || false
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
					var trainingParams = nlGroupInfo.getTrainingParams();
					for (var i=0; i<trainingParams.length; i++) {
						var param = trainingParams[i];
						assignContent[param.id] = result[param.id] || '';	
					}
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
			var userInfo = reminderDict.users[i];
			var minimalUser = nlGroupInfo.getMinimalUserObj(userInfo.user);
			minimalUser.repid = userInfo.repid;
			params.users.push(minimalUser);
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
		var records = $scope.tabData.records || [];
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

	this.clear = function() {
		_recordsFound = {lms: false, nht: false};
	};

	this.nhtRecordFound = function() {
		_recordsFound.nht = true;
	};

	this.lmsRecordFound = function() {
		_recordsFound.lms = true;
	};

	this.isTmsRecordFound = function() {
		return _recordsFound.nht;
	};

	this.update = function(bUpdateSelectedTab) {
		_updateCanShowOfTabs();
		if (bUpdateSelectedTab) _updateSelectedTab(tabData.tabs);
	};

	var _recordsFound = null;
	var _tabsDict = {
		overview: {
			title : 'Click here to see learning overview',
			name: 'Learning Overview',
			icon : 'ion-stats-bars',
			id: 'overview',
			iconsuperscript : 'L',
			updated: false,
			canShow: false,
			tables: []
		}, 
		nhtoverview: {
			title : 'Click here to see NHT reports overview',
			name: 'Training Overview',
			icon : 'ion-stats-bars',
			id: 'nhtoverview',
			iconsuperscript : 'T',
			updated: false,
			canShow: false,
			tables: []
		},
		drilldown: {
			title : 'Click here to view course-wise progress',
			name: 'Drill Down',
			icon : 'ion-social-buffer',
			id: 'drilldown',
			updated: false,
			canShow: true,
			tables: []
		},
		nhtrunning: {
			title : 'Click here to view running batch summary',
			name: 'Running Training Batches',
			icon : 'ion-filing',
			iconsuperscript : 'R',
			id: 'nhtrunning',
			updated: false,
			canShow: false,
			tables: []
		},
		nhtclosed: {
			title : 'Click here to view closed batch summary',
			name: 'Closed Training Batches',
			icon : 'ion-filing',
			iconsuperscript : 'C',
			id: 'nhtclosed',
			updated: false,
			canShow: false,
			tables: []
		},
		nhtbatchattendance: {
			title : 'Click here to view NHT batch attendance summary',
			name: 'NHT Batch Attendance',
			icon: 'ion-person-stalker',
			id: 'nhtbatchattendance',
			updated: false,
			canShow: false,
			tables: []
		},
		learningrecords: {
			title : 'Click here to view learning records',
			name: 'Learning Records',
			icon : 'ion-ios-compose',
			id: 'learningrecords',
			updated: false,
			canShow: true,
			tables: [tabData.utable]
		},
		pagelevelrecords: {
			title : 'Click here to view page level records',
			name: 'Page Level Records',
			icon : 'ion-ios-paper',
			id: 'pagelevelrecords',
			updated: false, 
			canShow: true,
			tables: [tabData.utable]
		},
		timesummary: {
			title : 'Click here to view time summary',
			name: 'Time Summary',
			icon : 'ion-clock',
			id: 'timesummary',
			updated: false,
			canShow: true,
			tables: []
		},
		certificate: {
			title : 'Click here to view certification status',
			name: 'Certificates',
			icon : 'ion-trophy',
			id: 'certificate',
			updated: false,
			canShow: true,
			tables: []
		}
	};
	
	function _init(self) {
		self.clear();
		tabData.tabs = [];
		var tabs = tabData.tabs;
		if (nlLrFilter.getMode() == 'cert_report') {
			tabs.push(_tabsDict.certificate);
			tabs.push(_tabsDict.learningrecords);
		} else {
			tabs.push(_tabsDict.overview);
			tabs.push(_tabsDict.nhtoverview);
			tabs.push(_tabsDict.nhtrunning);
			tabs.push(_tabsDict.nhtclosed);
			tabs.push(_tabsDict.nhtbatchattendance);
			tabs.push(_tabsDict.drilldown);
			tabs.push(_tabsDict.learningrecords);
			tabs.push(_tabsDict.timesummary);
			tabs.push(_tabsDict.pagelevelrecords);
		}
	}
	_init(this);

	function _updateCanShowOfTabs() {
		var subtype = nlLrFilter.getRepSubtype();
		var batchStatus = nlGetManyStore.getNhtBatchStates();
		var type = nlLrFilter.getType();
		var objid = nlLrFilter.getObjectId();
        var isNHTEnabled = (!_groupInfo.props.milestones) ? false : true;
		_tabsDict.overview.canShow = _recordsFound.lms && subtype != 'nht' || subtype == 'lms';
		_tabsDict.nhtoverview.canShow = isNHTEnabled && _recordsFound.nht && subtype != 'lms' || subtype == 'nht';
		_tabsDict.nhtrunning.canShow =  (type != 'user' && batchStatus.running);
		_tabsDict.nhtclosed.canShow =  (type != 'user' && batchStatus.closed);
		_tabsDict.nhtbatchattendance.canShow = isNHTEnabled && _recordsFound.nht && subtype != 'lms' || subtype == 'nht';
		_tabsDict.pagelevelrecords.canShow = (type == "module_assign" || type == 'module') && objid;
	}

	function _updateSelectedTab(tabs) {
		if (tabData.selectedTab && tabData.selectedTab.canShow) return;
		tabData.selectedTab = null;
		for(var i=0; i<tabs.length; i++) {
			if (!tabs[i].canShow) continue;
			tabData.selectedTab = tabs[i];
			break;
		}
	}
}

//-------------------------------------------------------------------------------------------------
function RecordsFilter(nl, nlDlg, nlLrFilter, nlGroupInfo, _groupInfo, $scope, nlLrReportRecords, 
	nlTreeSelect, nlTable, onApplyFilterFn) {
	this.init = function() {
		_initTabs();
	};

	this.getTabs = function() {
		return _tabs;
	}

	this.markDirty = function() {
		for(var i=0; i<_tabs.length; i++) {
			_tabs[i].updated = false;
		}
	};

	this.showFilterDialog = function(lrColNamesDict) {
		_updateTabNames(lrColNamesDict);
		var dlg = nlDlg.create($scope);
		dlg.setCssClass('nl-width-max nl-height-max')
		dlg.scope.data = {};
		dlg.scope.data.tabs = _tabs;
		dlg.scope.data.selectedTab = dlg.scope.data.tabs[0];
		for (var i=0; i<_tabs.length; i++) {
			if (_lastSelectedTabId != _tabs[i].id) continue;
			dlg.scope.data.selectedTab = _tabs[i];
			break;
		}
		_updateTab(dlg.scope.data.selectedTab);
		
		dlg.scope.data.onTabSelect = function(seletedTab) {
			dlg.scope.data.selectedTab = seletedTab;
			_updateTab(seletedTab);
		}
		var clearButton = {text: nl.t('Clear Filters'), onTap: function(e) {
			_lastSelectedTabId = null;
			_clearSelections();
			_filterInfo = _getFilterInfo();
			onApplyFilterFn();
		}};

		var okButton = {text: nl.t('Apply Filters'), onTap: function(e) {
			_lastSelectedTabId = dlg.scope.data.selectedTab.id;
			_filterInfo = _getFilterInfo();
			onApplyFilterFn();
		}};
		var cancelButton = {text: nl.t('Cancel')};
		dlg.show('view_controllers/learning_reports/lr_records_filter_dlg.html',
			[okButton, clearButton], cancelButton);
	};

	this.doesPassFilter = function(record) {
		for (var tabid in _filterInfo) {
			var filter = _filterInfo[tabid];
			var fieldVal = nlTable.getFieldValue($scope.utable, record, tabid);
			if (!(fieldVal in filter)) return false;
		}
		return true;
	};

	this.getFilterCount = function() {
		return Object.keys(_filterInfo).length;
	};

	//---------------------------------------------------------------------------------------------
	// Private methods and data
	var _tabs = [];
	var _tabsDict = {};
	var _filterInfo = {};
	var _lastSelectedTabId = null;
	function _initTabs() {
		_tabs = [];
		_tabsDict = {};
		_filterInfo = {};
		var type = nlLrFilter.getType();
		var isManyCourseOrModules = ((type == 'course' || type == 'module') && !nlLrFilter.getObjectId() || type == 'user');
		var isManyBatches = (type != 'course_assign' && type != 'module_assign');
		var isManyUsers = (type != 'user');
		_addTab('raw_record.subject', isManyCourseOrModules);
		_addTab('raw_record._grade', isManyCourseOrModules);
		_addTab('user.suborg', isManyUsers && nlGroupInfo.isSubOrgEnabled());
		_addTab('stats.status.txt', true);
		_addTab('raw_record.lesson_id', isManyCourseOrModules, 'repcontent.name');
		_addTab('raw_record.assignment', isManyBatches, 'raw_record._batchName');
		_addTab('repcontent.batchtype', isManyBatches);
		_addTab('repcontent.iltTrainerName', isManyBatches);
		_addTab('user.org_unit', isManyUsers);
		_addTab('user.ou_part1', isManyUsers);
		_addTab('user.ou_part2', isManyUsers);
		_addTab('user.ou_part3', isManyUsers);
		_addTab('user.ou_part4', isManyUsers);
		_addTab('user.usertypeStr', isManyUsers);
		var metadataFields = _groupInfo.props.usermetadatafields || [];
		for (var i=0; i< metadataFields.length; i++) {
            if (!metadataFields[i].filterable) continue;
			var tabid = 'usermd.' + metadataFields[i].id;
			_addTab(tabid, isManyUsers);
		}
		_addTab('repcontent.targetLang', isManyCourseOrModules);
	}

	function _addTab(tabid, condition, valueFieldId) {
		if (!condition) return;
		var tab = {name: '', id: tabid, valueFieldId: valueFieldId, updated: false, tabinfo: {}};
		_tabsDict[tabid] = tab;
		_tabs.push(tab);
	}

	function _clearSelections() {
		for(var i=0; i<_tabs.length; i++) {
			var tab = _tabs[i];
			if (tab.tabinfo && tab.tabinfo.data) _initTreeSelection(tab, {});
		}
	}
	
	function _updateTabNames(lrColNamesDict) {
		for(var tabid in _tabsDict) {
			var tab = _tabsDict[tabid];
			var key = tab.valueFieldId || tabid;
			tab.name = lrColNamesDict[key] ? lrColNamesDict[key].name : tabid;
		}		
	}

	function _updateTab(tab) {
		var filterInfo = _getFilterInfo(); // Needed for side effect when you move out of Tab + reset with old data;
		if (tab.updated) return;
		_updateInfo(tab, filterInfo);
		tab.updated = true;
	}

	function _updateInfo(tab, filterInfo) {
		var records = nlLrReportRecords.getRecords();
		var treeData = null;
		var fieldValues = {};
		var tooMany = false;
		for(var key in records) {
			var record = records[key];
			var objid = nlTable.getFieldValue($scope.utable, record, tab.id);
			if (fieldValues[objid]) continue;
			var name = tab.valueFieldId ? nlTable.getFieldValue($scope.utable, record, tab.valueFieldId) : objid;
			fieldValues[objid] = {id: '' + objid, name: '' + name};
			if (Object.keys(fieldValues).length >= 1000) {
				tooMany = true;
				break;
			}
		}
		treeData = nl.utils.dictToList(fieldValues);
		treeData.sort(function(a, b) {
			var aName = a.name.toLowerCase();
			var bName = b.name.toLowerCase();
			if(aName > bName) return 1;
			if(aName < bName) return -1;
			return 0;
		});
		if (treeData.length > 0 && treeData[0].name === '') treeData[0].name = '(blank values)';
		tab.tabinfo = {data: treeData, tooMany: tooMany};
		_initTreeSelection(tab, filterInfo);
	}

	function _initTreeSelection(tab, filterInfo) {
        tab.tabinfo.treeIsShown = true;
        tab.tabinfo.multiSelect = true;
        tab.tabinfo.singleLevelTree = true;
        tab.tabinfo.showSearchFieldAbove = 1;
		tab.tabinfo.fieldmodelid = tab.id;
        nlTreeSelect.updateSelectionTree(tab.tabinfo, filterInfo[tab.id] || {});
	}

	function _getFilterInfo() {
		var filterInfo = {};
		for(var i=0; i<_tabs.length; i++) {
			var tab = _tabs[i];
			if (!tab.tabinfo.data) continue;
			var selectedKeys = nlTreeSelect.getSelectedIds(tab.tabinfo);
			if (Object.keys(selectedKeys).length > 0) {
				filterInfo[tab.id] = selectedKeys;
				tab.filterApplied = true;
			} else {
				tab.filterApplied = false;
			} 
		}
		return filterInfo;
	}
}
//-------------------------------------------------------------------------------------------------
module_init();
})();
		

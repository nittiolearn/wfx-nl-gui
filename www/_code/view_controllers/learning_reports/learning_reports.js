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
	
var NlLearningReports = ['nl', 'nlDlg', 'nlRouter', 'nlServerApi', 'nlGroupInfo', 'nlTable', 'nlTableViewSelectorSrv', 'nlSendAssignmentSrv',
'nlLrHelper', 'nlReportHelper', 'nlLrFilter', 'nlLrFetcher', 'nlLrExporter', 'nlLrReportRecords', 'nlLrSummaryStats', 'nlGetManyStore', 
'nlTreeListSrv', 'nlMarkup', 'nlLrDrilldown', 'nlCourse', 'nlLrNht', 'nlLrUpdateBatchDlg', 'nlTreeSelect', 'nlOrgMdMoreFilters',
function(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlTableViewSelectorSrv, nlSendAssignmentSrv,
	nlLrHelper, nlReportHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrSummaryStats,
	nlGetManyStore, nlTreeListSrv, nlMarkup, nlLrDrilldown, nlCourse, nlLrNht, nlLrUpdateBatchDlg, nlTreeSelect, nlOrgMdMoreFilters) {
	this.create = function($scope, settings) {
		if (!settings) settings = {};
		return new NlLearningReportView(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlTableViewSelectorSrv, nlSendAssignmentSrv,
			nlLrHelper, nlReportHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrSummaryStats,
			$scope, settings, nlGetManyStore, nlTreeListSrv, nlMarkup, nlLrDrilldown, nlCourse, nlLrNht, nlLrUpdateBatchDlg, nlTreeSelect, nlOrgMdMoreFilters);
	};
}];
	
//-------------------------------------------------------------------------------------------------
function NlLearningReportView(nl, nlDlg, nlRouter, nlServerApi, nlGroupInfo, nlTable, nlTableViewSelectorSrv, nlSendAssignmentSrv,
			nlLrHelper, nlReportHelper, nlLrFilter, nlLrFetcher, nlLrExporter, nlLrReportRecords, nlLrSummaryStats,
			$scope, settings, nlGetManyStore, nlTreeListSrv, nlMarkup, nlLrDrilldown, nlCourse, nlLrNht, nlLrUpdateBatchDlg, nlTreeSelect, nlOrgMdMoreFilters) {
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
						$scope, nlLrReportRecords, nlTreeSelect, nlOrgMdMoreFilters, _onApplyFilter);
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
	var MAX_VISIBLE = 100;
	function _initScope() {
		$scope.debug = nlLrFilter.isDebugMode();
		$scope.toolbar = _getToolbar();
		$scope.learningRecords = nlLrReportRecords.getRecords();
		$scope.metaHeaders = nlLrHelper.getMetaHeaders(true);
		_lrColumns = _selectedLrCols || _getLrColumns();
		_tableNavPos = {currentpos: 0, nextpos: MAX_VISIBLE};
		$scope.utable = {
			search: {disabled : true},
			maxVisible: MAX_VISIBLE,
			columns: _lrColumns,
			origColumns: _lrColumns,
			styleTable: 'nl-table nl-table-styled3 rowlines',
			styleHeader: ' ',
			onRowClick: 'expand',
			detailsTemplate: 'view_controllers/learning_reports/learning_report_details.html',
			clickHandler: _userRowClickHandler,
			metas: nlLrHelper.getMetaHeaders(false),
			detailsInfo: {gradelabel: _userInfo.groupinfo.gradelabel, 
				subjectlabel: _userInfo.groupinfo.subjectlabel}
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

		nht.rows.sort(function(a, b) {
			var aVal = a[colid] || "";
			var bVal = b[colid] || "";
			if (sortObj.ascending) return _compare(aVal, bVal);
			else return _compare(bVal, aVal);
        });
	}

    function _compare(a,b) {
        if (a > b) return 1;
        else if (a < b) return -1;
        return 0;
    }

	$scope.getMaxVisibleString = function() {
		var posStr = '';
		var records = $scope.tabData.records || [];
		if (records.length > MAX_VISIBLE) {
			var startpos = _tableNavPos.currentpos + 1;
			var endpos = _tableNavPos.currentpos + $scope.utable._internal.visibleRecs.length;
			posStr = nl.t('{} - {} of ', startpos, endpos);
		}
		return nl.t ('Showing {}{} items.', posStr, records.length);
	};

	$scope.canShowPrev = function() {
		if (_tableNavPos.currentpos > 0) return true;
		return false;
	};

	$scope.canShowNext = function() {
		var records = $scope.tabData.records || [];
		if (_tableNavPos.currentpos + MAX_VISIBLE < records.length) return true;
		return false;
	};

	$scope.onClickOnNext = function () {
		if (_tableNavPos.currentpos + MAX_VISIBLE > $scope.tabData.records.length) return;
		if (_tableNavPos.currentpos < $scope.tabData.records.length) {
			_tableNavPos.currentpos += MAX_VISIBLE;
		}
		nlTable.updateTableObject($scope.utable, $scope.tabData.records, _tableNavPos.currentpos);
	};

	$scope.onClickOnPrev = function () {
		if (_tableNavPos.currentpos == 0) return;
		if (_tableNavPos.currentpos >= MAX_VISIBLE) {
			_tableNavPos.currentpos -= MAX_VISIBLE;
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
		$scope.nhtOverviewInfo = {};
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
		} else if (tab.id == 'nhtbatchattendance') {
			_updateNhtBatchAttendanceTab();
		} else if (tab.id == 'certificate') {
			_certHandler.updateCertificateTab();
		} else if (tab.id == 'nhtoverview') {
			_updateNhtOverviewBatch();
		}
	}

	var _selectedLrCols = null;
	var _defaultLrCol = ["user.user_id", "user.name", "repcontent.name", "user.org_unit", "stats.status.txt"];
	var _lastSelectedCols = null;
	function _updateLearningRecordsTab(tabData) {
		_lrSelectedColumns(_lastSelectedCols || _defaultLrCol);
		nlTable.updateTableObject($scope.utable, tabData.records, 0, true);
		$scope.lrViewSelectorConfig = {
			canEdit: nlRouter.isPermitted(_userInfo, 'assignment_manage'),
			tableType: 'lr_views',
			allColumns: _getLrColumns(),
			defaultViewColumns: {id: 'default', name: 'Default', columns: _defaultLrCol},
			onViewChange: function(selectedColumns, selectedCustColumns) {
				// TODO-NOW: handle selectedCustColumns
				_lastSelectedCols = selectedColumns;
				_lrSelectedColumns(selectedColumns);
				nlTable.updateTableObject($scope.utable, tabData.records, 0, true);
			}
		};
	}

	function _lrSelectedColumns(selectedColumns) {
		var lrColumnsDict = nl.utils.arrayToDictById(_getLrColumns());
		var ret = [];
		for(var i=0;i<selectedColumns.length;i++) {
			var colid = selectedColumns[i].id || selectedColumns[i];
			if ((!(colid in lrColumnsDict)) || lrColumnsDict[colid].hideInMode) continue;
			lrColumnsDict[colid].name = selectedColumns[i].name ? selectedColumns[i].name : lrColumnsDict[colid].name;
			ret.push(lrColumnsDict[colid]);
		}
		$scope.utable.columns = ret;
		$scope.utable.origColumns = ret;
		_selectedLrCols = ret;
	}

	function _getLrColumns() {
		_customScoresHeader = nlLrReportRecords.getCustomScoresHeader();
		var mh = nlLrHelper.getMetaHeaders(false);
		var type = nlLrFilter.getType();
		var qsMaxLength = nlLrReportRecords.getQsMaxLength();
		var quizArray = [];
		for (var i=0; i<qsMaxLength; i++) {
			quizArray.push(nl.t('Quiz {} name', i+1));
			quizArray.push(nl.t('Quiz {} score', i+1));
		}
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
		columns.push(_col('repcontent.not_before_str', 'From'));
		columns.push(_col('repcontent.not_after_str', 'Till'));
		columns.push(_col('stats.status.txt', 'Status', false, 'stats.status.icon'));
		columns.push(_col('stats.percCompleteStr','Progress'));
		columns.push(_col('stats.percCompleteDesc', 'Progress Details'));
		columns.push(_col('stats.avgAttempts', 'Quiz Attempts'));
		columns.push(_col('stats.percScoreStr', 'Achieved %'));
		columns.push(_col('stats.nMaxScore', 'Maximum Score'));
		columns.push(_col('stats.nScore', 'Achieved Score'));
		
		for(var i=0; i< _customScoresHeader.length; i++)
			columns.push(_col('stats.customScoreDict.' + _customScoresHeader[i], _customScoresHeader[i]));
		columns.push(_col('quizscore', 'Individual quiz scores (names and scores)', false, null, quizArray));
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
		columns.push(_col('user.ou_part1', 'OU - part 1'));
		columns.push(_col('user.ou_part2', 'OU - part 2'));
		columns.push(_col('user.ou_part3', 'OU - part 3'));
		columns.push(_col('user.ou_part4', 'OU - part 4'));

		columns.push(_col('user.mobile', 'Mobile Number'));
		columns.push(_col('user.seclogin', 'Secondary login'));
		columns.push(_col('user.supervisor', 'Supervisor'));

		for(var i=0; i<mh.length; i++) {
			var keyName = 'usermd.' + mh[i].id;
			columns.push(_col(keyName, mh[i].name));
		}

		// Id's are always exported, So the below 3 fields.
		columns.push(_col('raw_record.id', 'Report Id'));
		columns.push(_col('raw_record.assignment', 'Assign Id'));
		columns.push(_col('repcontent.courseid', 'Course/ Module Id'));
		columns.push(_col('repcontent.targetLang', 'Language'));
		_lrColumns = columns;
		nlTableViewSelectorSrv.updateAllColumnNames('lr_views', _lrColumns);
		return _lrColumns;
	}
	
	function _col(id, name, hideInMode, icon, multipleArray) {
		var __column = { id: id, name: name, allScreens: true, canShow:true, hideInMode: hideInMode, styleTd: 'minw-number nl-text-center', insertCols: multipleArray ? true: false, children: multipleArray};
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
		_tableNavPos = {currentpos: 0, nextpos: MAX_VISIBLE};
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
		_tableNavPos = {currentpos: 0, nextpos: MAX_VISIBLE};
		_updateTabs();
		var anyRecord = nlLrReportRecords.getAnyRecord();
		_setSubTitle(anyRecord);
		$scope.noDataFound = (anyRecord == null);
		_someTabDataChanged();
		var tab = $scope.tabData.selectedTab;
		if (tab.id == 'nhtclosed' || tab.id == 'nhtrunning' || tab.id == 'nhtbatchattendance' || tab.id == 'nhtoverview') tab.updated = false;
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
			$scope.nhtOverviewInfo = {};
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
	// NHT overview tab
	//---------------------------------------------------------------------------------------------------------------------------------------------------------
	function _updateNhtOverviewBatch() {
		nlLrNht.clearStatusCountTree();
		var records = $scope.tabData.records;
		var reportDict = {};
		for(var i=0; i<records.length; i++) {
			var record = records[i];
			if(!record.raw_record.isNHT) continue;
			if(!(record.user.user_id in reportDict)) {
				reportDict[record.user.user_id] = record;
				continue;
			}	
			var oldUserRecord = reportDict[record.user.user_id];
			if(oldUserRecord.raw_record.updated > record.raw_record.updated) continue;
			reportDict[record.user.user_id] = record;
		}
		for(var key in reportDict) nlLrNht.addCount(reportDict[key]);
		var overviewStats = nlLrNht.getStatsCountDict();

		$scope.nhtOverviewInfo = {firstInfoGraphics: _getfirstInfoGraphicsArray(overviewStats), 
								  secondInfoGraphics: _getSecondInfoGraphicsArray(overviewStats),
								  thirdInfoGraphics: _getThirdInfoGraphicsArray(overviewStats),
								  fourthInfoGraphics: _getFourthInfoGraphicsArray(overviewStats),
							      chartData: _getNhtChartData(overviewStats)};
	};

	function _getNhtChartData(overviewStats) {
		var allCount = overviewStats[0].cnt;
		var chartData = [{type: 'doughnut', labels: ['Training', 'OJT', 'Certification', 'Re-certification', 'Closed'], 
						colors:[_nl.colorsCodes.waiting, _nl.colorsCodes.started, _nl.colorsCodes.done, _nl.colorsCodes.done, _nl.colorsCodes.done], series: [], options: []}];
			chartData[0].data = [allCount.Training || 0, allCount.OJT || 0, allCount.Certification || 0, allCount['Re-certification'] || 0, allCount.completed];
		return chartData;
	}

	function _getfirstInfoGraphicsArray(overviewStats) {
		var allCount = overviewStats[0].cnt;
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

	function _getSecondInfoGraphicsArray(overviewStats) {
		var allCount = overviewStats[0].cnt;
		var ret = [];
		ret.push({title: 'Initial HC', perc: allCount.cntTotal, showperc: false});
		var currentHc = allCount.cntTotal - (allCount.attrition || 0) - (allCount.failed || 0);
		ret.push({title: 'Current HC', perc: currentHc || 0, showperc: false});
		ret.push({title: 'Attrition', perc: allCount.attrition || 0, showperc: false});
		return ret;
    }

	function _getThirdInfoGraphicsArray(overviewStats) {
		var allCount = overviewStats[0].cnt;
		var ret = [];
		ret.push({title: 'Training', perc: allCount.Training || 0, showperc: false});
		ret.push({title: 'OJT', perc: allCount.OJT || 0, showperc: false});
		ret.push({title: 'Certification', perc: allCount.Certification || 0, showperc: false});
		return ret;
    }

	function _getFourthInfoGraphicsArray(overviewStats) {
		var allCount = overviewStats[0].cnt;
		var ret = [];
		ret.push({title: 'Re-certification', perc: allCount['Re-certification'] || 0, showperc: false});
		ret.push({title: 'certified', perc: allCount.certified || 0, showperc: false});
		ret.push({title: 'failed', perc: allCount.failed || 0, showperc: false});
		return ret;
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
		var records = angular.copy($scope.tabData.records);
		var reportDict = {};
		var transferedOut = {};
		var batchStatusObj = nlLrReportRecords.getNhtBatchStatus();
		var nhtRecords = [];
		for (var i=0; i<records.length; i++) {
			var record = records[i];
			if (record.raw_record.isNHT) nhtRecords.push(record);
		}
		nhtRecords.sort(function(a, b) {
			if(b.raw_record.updated < a.raw_record.updated) return 1;
			if(b.raw_record.updated > a.raw_record.updated) return -1;
			if(b.raw_record.updated == a.raw_record.updated) return 0;				
		});

		for(var i=0; i<nhtRecords.length; i++) {
			var record = nhtRecords[i];
			if (record.stats.attritionStr == 'Transfer-Out') {
				transferedOut[record.user.user_id] = record;
				continue;
			}
			var oldUserRecord = reportDict[record.user.user_id] || null;
			if(oldUserRecord && oldUserRecord.raw_record.updated > record.raw_record.updated) continue;
			var msInfo = nlGetManyStore.getBatchMilestoneInfo(record.raw_record, batchStatusObj);
			if(isRunning && msInfo.batchStatus == 'Closed' ||
				!isRunning && msInfo.batchStatus != 'Closed') {
				if (record.user.user_id in reportDict) delete reportDict[record.user.user_id];
				continue;
			}
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
		var defColumns = ["cntTotal", "batchStatus", "batchName", "suborg", "subject", "trainer", "avgDelay", "batchFirstPass", "batchThroughput"];
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
            onViewChange: function(selectedColumns, selectedCustColumns) {
				// TODO-NOW: handle selectedCustColumns
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
				col.name = _selectedNhtColumns[i].name ? _selectedNhtColumns[i].name : col.name;
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
		nlTableViewSelectorSrv.updateAllColumnNames('nht_views', columns);
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
		if (!sessionDate) return;
		if (sessionInfo.shiftHrs && sessionInfo.shiftMins)
			sessionDates[sessionDate] = {start: nl.t('{}:{}', sessionInfo.shiftHrs, sessionInfo.shiftMins), end: _getShiftEnd(sessionInfo)};
		else sessionDates[sessionDate] = {};
	}

	function _getShiftEnd(sessionInfo) {
		if (sessionInfo.shiftEnd) return sessionInfo.shiftEnd;
		if (sessionInfo.shiftHrs && sessionInfo.shiftMins) {
			var shiftEndHrs = parseInt(sessionInfo.shiftHrs) + 9;	
			return nl.t('{}: {}', shiftEndHrs, sessionInfo.shiftMins);
		}
	}

	function _updateAsdSessionDates(sessionInfo, sessionDates) {
		for(var j=0; j<sessionInfo.asd.length; j++) {
			var session = sessionInfo.asd[j];
			if(session) _updateSessionDates(session, sessionDates);
		}
	}

	function _updateNhtBatchAttendanceTab() {
		var records = $scope.tabData.records;
		var content = _getContentOfCourseAssignment();
		var courseAssignment = _getCourseAssignmnt();
		var attendance = courseAssignment.attendance ? angular.fromJson(courseAssignment.attendance) : {};
		attendance = nlCourse.migrateCourseAttendance(attendance);
		var asdAddedModules = nlReportHelper.getAsdUpdatedModules(content.modules || [], attendance)
		var sessionDates = {};
		var iltSessions = [];
		var	sessionInfos = attendance.sessionInfos || {};	
		if ('_root' in sessionInfos) _updateAsdSessionDates(sessionInfos['_root'], sessionDates);

		for(var i=0; i<asdAddedModules.length; i++) {
			var cm = asdAddedModules[i];
			if (cm.type != 'iltsession') continue;
			iltSessions.push(cm);
			if (cm.asdChildren && cm.asdChildren.length > 0) _updateAsdSessionDates(sessionInfos[cm.id], sessionDates);
			if(!cm.asdSession) {
				var sessionInfo = sessionInfos[cm.id];
				if(sessionInfo)
					_updateSessionDates(sessionInfo, sessionDates, sessionInfos);
			}
		}

		var userObj = {};
		var iltBatchInfoRow = [];
		for(var i=0; i<records.length; i++) {
			userObj = {};
			var record = records[i];
			userObj.name = record.user.name;
			userObj.coursename = record.repcontent.name;
			userObj.batchname = record.raw_record._batchName;
			userObj.not_before = nl.fmt.fmtDateDelta(record.repcontent.not_before, null, 'date');
			userObj.not_after = nl.fmt.fmtDateDelta(record.repcontent.not_after, null, 'date');
			userObj.learner_status = (record.user.state == 0) ? nl.t('Inactive') : nl.t('Active')
			var _statusInfos = record.repcontent.statusinfo;
			userObj.subject = record.raw_record.subject;
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
		$scope.iltBatchInfo = {columns: _getNhtBatchAttendanceColumns(sessionDates), rows: iltBatchInfoRow};
	}

	function _getNhtBatchAttendanceColumns(sessionDates) {
		var headerRow = [];
		headerRow.push({id: 'name', name: nl.t('Learner name'), class: 'minw-string'});
		headerRow.push({id: 'subject', name: _groupInfo.props.subjectlabel, class: 'minw-string'});
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
		var nhtBatchAttendanceStats = null;
		if (nlLrFilter.getType() == 'course_assign' && _groupInfo.props.etmAsd && _groupInfo.props.etmAsd.length > 0) {
			_updateNhtBatchAttendanceTab();
			nhtBatchAttendanceStats = {statsCountArray: $scope.iltBatchInfo.rows, columns: $scope.iltBatchInfo.columns};
		}

		if(!_selectedLrCols) {
			_lrSelectedColumns(_defaultLrCol);
		}
		var _defcolumns = [];
		for(var i=0; i<_selectedLrCols.length; i++) {
			if (_selectedLrCols[i].insertCols) {
				var children = _selectedLrCols[i].children || [];
				for (var j=0; j<children.length; j++) {
					_defcolumns.push({id: nl.t('{}{}', _selectedLrCols[i].id, j), name: children[j]});
				}
			} else {
				_defcolumns.push(_selectedLrCols[i]);
			}
		}
		var lrStats = {columns: _defcolumns};
		var certificateStats = null;
		if (nlLrFilter.getType() == 'course' && nlLrFilter.getMode() == 'cert_report') {
			certificateStats = _certHandler.getExportData();
		}

		nlLrExporter.export($scope, reportRecords, _customScoresHeader, drillDownStats, nhtStats, nhtBatchAttendanceStats, lrStats, certificateStats);
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
			_addNhtOverviewTabs(tabs);
			_addDrilldownTab(tabs);
			_addNhtTabs(tabs);
			_addAttendanceTab(tabs);
			_addLrTab(tabs);
			_addTimeSummaryTab(tabs);
		}
		_updateSelectedTab(tabs, checkSelected);
	};

	function _addOverviewTabs(tabs) {
		var subtype = nlLrFilter.getRepSubtype();
		if (subtype == 'nht') return;
		tabs.push({
			title : 'Click here to see reports overview',
			name: 'Learning Overview',
			icon : 'ion-stats-bars',
			id: 'overview',
			iconsuperscript : 'L',
			updated: false,
			tables: []
		});
	}

	function _addNhtOverviewTabs(tabs) {
		var subtype = nlLrFilter.getRepSubtype();
		var batchStatus = nlGetManyStore.getNhtBatchStates();
		if (subtype == 'lms' && !(batchStatus.running || batchStatus.closed)) return;
		if(batchStatus.running || batchStatus.closed) {
			tabs.push({
				title : 'Click here to see NHT reports overview',
				name: 'Training Overview',
				icon : 'ion-stats-bars',
				id: 'nhtoverview',
				iconsuperscript : 'T',
				updated: false,
				tables: []
			});
		}
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
				name: 'Running Training Batches',
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
				name: 'Closed Training Batches',
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
			id: 'nhtbatchattendance',
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
function RecordsFilter(nl, nlDlg, nlLrFilter, nlGroupInfo, _groupInfo, $scope, nlLrReportRecords, 
	nlTreeSelect, nlOrgMdMoreFilters, onApplyFilterFn) {
	var _filterInfo = null;
	var _orgToSubOrg = {};
	var _filterManager = null;
	$scope.canShowFilterDialog = false;

	this.init = function() {
		_filterManager = new FilterManager(nlLrFilter, nlLrReportRecords, nlGroupInfo, _groupInfo, nlTreeSelect, nlOrgMdMoreFilters);
		_filterManager.initTabs();
		_filterInfo = {};
		$scope.canShowFilterDialog = true;
	};

	this.showFilterDialog = function() {
		var dlg = nlDlg.create($scope);
		dlg.setCssClass('nl-width-max nl-height-max')
		dlg.scope.data = {};
		dlg.scope.data.tabs = _filterManager.getTabs();
		var firstTab = dlg.scope.data.tabs[0];
		dlg.scope.data.selectedTab = firstTab;
		_filterManager.updateTabs(firstTab);
		dlg.scope.data.onTabSelect = function(seletedTab) {
			_filterManager.updateTabs(seletedTab);
			dlg.scope.data.selectedTab = seletedTab;
			_updateSelectedTabAttr(dlg.scope.data);
		}
		var clearButton = {text: nl.t('Clear'), onTap: function(e) {
			_filterManager.clearTabs();
			_filterManager.initTabs();
			_filterInfo = {};
			onApplyFilterFn();
		}};

		var okButton = {text: nl.t('Apply'), onTap: function(e) {
			_updateSelectedTabAttr(dlg.scope.data);
			onApplyFilterFn();
		}};
		var cancelButton = {text: nl.t('Close')};
		dlg.show('view_controllers/learning_reports/lr_records_filter_dlg.html',
			[okButton, clearButton], cancelButton);
	};

	function _updateSelectedTabAttr(data) {
		var tabs = data.tabs;
		_filterInfo = {};
		for(var i=0; i<tabs.length; i++) {
			var selectedTab = tabs[i];
			if (!selectedTab.updated) continue;
			if (selectedTab.id == 'usermeta') {
				_filterInfo[selectedTab.id] = {};
				for (var j=0; j<selectedTab.tabinfo.mdFilters.length; j++) {
					var mdInfo = selectedTab.tabinfo.mdFilters[j];
					var selectedKeys = nlTreeSelect.getSelectedIds(mdInfo.value);
					if (Object.keys(selectedKeys).length > 0) {
						_filterInfo[selectedTab.id][mdInfo.mf.id] = selectedKeys;
						selectedTab.filterApplied = true;
						break;
					} else {
						selectedTab.filterApplied = false;
					} 
				}
			} else {
				var selectedKeys = nlTreeSelect.getSelectedIds(selectedTab.tabinfo);
				if (Object.keys(selectedKeys).length > 0) {
					_filterInfo[selectedTab.id] = selectedKeys;
					selectedTab.filterApplied = true;
				} else {
					selectedTab.filterApplied = false;
				} 
			}
		}
	};

	this.doesPassFilter = function(record) {
		if (_filterInfo.subject && _filterFail('subject', record.raw_record.subject)) return false;
		if (_filterInfo.grade && _filterFail('grade', record.raw_record._grade)) return false;
		if (_filterInfo.suborg && _filterFail('suborg', _orgToSubOrg[record.user.org_unit] || 'Others')) return false;
		if (_filterInfo.status && _filterFail('status', record.stats.status.txt)) return false;
		if (_filterInfo.ids && _filterFail('ids', record.raw_record.lesson_id)) return false;
		if (_filterInfo.org_unit && _filterFail('org_unit', record.raw_record.org_unit)) return false;
		// TODO-NOW: orgparts to be handled better
		if (_filterInfo.ouparts && _filterFailForOuParts('ouparts', record.orgparts)) return false;
		if (_filterInfo.usertype && _filterFail('usertype', record.user.usertype)) return false;
		if (_filterInfo.batchname && _filterFail('batchname', record.raw_record._batchName)) return false;
		if (_filterInfo.usermeta && _filterFailForUserMeta('usermeta', record.usermd)) return false;
		return true;
	};

	function _filterFailForUserMeta(filtAttr, recordVal) {
		var usermeta = _filterInfo[filtAttr] || {};
		if (Object.keys(usermeta).length == 0) return false;
		var ifAttribute = false;
		for (var md in recordVal) {
			var mdkey = md;
			var mdVal = recordVal[md]
			var filterMdVal = usermeta[mdkey] || {};
			if (Object.keys(filterMdVal).length == 0) continue;
			if (mdVal in filterMdVal) return false;
			return true;
		}
		return true;
	}

	function _filterFail(filtAttr, recordVal) {
		var filteredDict = _filterInfo[filtAttr] || {};
		if (Object.keys(filteredDict).length == 0) return false;
		if (recordVal in filteredDict) return false;
		return true;
	}

	function _filterFailForOuParts(filtAttr, recordVal) {
		var filteredDict = _filterInfo[filtAttr] || {}
		if (Object.keys(filteredDict).length == 0) return false;
		for (var key in recordVal) {
			var val = recordVal[key]
			if (val in filteredDict) return false;
		}
		return true;
	}
}
//-------------------------------------------------------------------------------------------------
function FilterManager(nlLrFilter, nlLrReportRecords, nlGroupInfo ,_groupInfo, nlTreeSelect, nlOrgMdMoreFilters) {
	var _tabs = [];
	this.clearTabs = function() {
		_tabs = [];
	};

	this.initTabs = function() {
		var type = nlLrFilter.getType();
		var isManyCourseOrModules = ((type == 'course' || type == 'module') && !nlLrFilter.getObjectId() || type == 'user');
		var isManyUsers = (type != 'user');
		_addTab('subject', _groupInfo.props.subjectlabel, isManyCourseOrModules);
		_addTab('grade', _groupInfo.props.gradelabel, xisManyCourseOrModules);

		// TODO-NOW: get custom renamed value from learning reports custom view
		var subOrgLabel = 'Locations'; // TODO-NOW: get from group config
		_addTab('suborg', subOrgLabel, isManyUsers && nlGroupInfo.isSubOrgEnabled());
		_addTab('status', 'Status', true);
		_addTab('ids', 'Course/Module id', isManyCourseOrModules);
		_addTab('org_unit', 'Org unit', isManyUsers);
		_addTab('ou_part1', 'OU Part 1', isManyUsers);
		_addTab('ou_part2', 'OU Part 2', isManyUsers);
		_addTab('ou_part3', 'OU Part 3', isManyUsers);
		_addTab('ou_part4', 'OU Part 4', isManyUsers);
		_addTab('usertype', 'User type', isManyUsers);
		_addTab('batchname', 'Batch name', isManyUsers);
		_addTab('usermeta', 'User metadata', isManyUsers);
		// define suborglabel in group properties similar to gradelable (default: "Locations"). Use in everywhere in GUI (NHT: "Ceners" column title)
		// add Suborg as a column in learning_reports tab
	};

	function _addTab(tabid, name, condition) {
		if (!condition) return;
		_tabs.push({name: name, id: tabid, updated: false, tabinfo: {}});	
	}

	this.getTabs = function() {
		return _tabs;
	};

	this.updateTabs = function(tab) {
		if (tab.updated) return;
		if (tab.id == 'usermeta'){
			_updateMetaDataFilters(tab, tab.id);
			tab.updated = true;
		} else {
			_updateInfo(tab, tab.id);
			tab.updated = true;
		} 
	};

	function _updateInfo(tab, tabid) {
		var filterAttrs = nlLrReportRecords.getFilterAttrs();
		var treeData = dictToArray(filterAttrs[tabid]);
		if (tabid == 'org_unit') {
			var outreeArray = _getOuTreeArray(_groupInfo.outree);
			treeData = nlTreeSelect.strArrayToTreeArray(outreeArray || []);
		}
		if (tabid == 'subject') {
			treeData = nlTreeSelect.strArrayToTreeArray(_groupInfo.props.subjects || []);	
		} 

		if (tabid == 'grade') {
			treeData = nlTreeSelect.strArrayToTreeArray(_groupInfo.props.grades || []);	
		} 

		if (tabid == 'suborg') {
			treeData = _initSubOrgs();
		}
		tab.tabinfo = {data: treeData || []};
        nlTreeSelect.updateSelectionTree(tab.tabinfo, {});
        tab.tabinfo.treeIsShown = false;
        tab.tabinfo.multiSelect = true;
		tab.tabinfo.fieldmodelid = tabid;
	}

	function _updateMetaDataFilters(tab) {
		var tree = {data: []};
		tab.tabinfo = nlOrgMdMoreFilters.getData(tree, 'Meta data');
	}

	function _initSubOrgs() {
		var orgToSubOrg = nlGroupInfo.getOrgToSubOrgDict();
		var subOrgDict = {};
		for (var key in orgToSubOrg) {
			subOrgDict[orgToSubOrg[key] || 'Others'] = true;
		}
		var arr = [];
		for(var key in subOrgDict) arr.push({id: key, name: key});
		return _initOptionsArray2(arr);
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

	function _getOuTreeArray(outree) {
		var outreeArray = [];
		for(var i=0; i<outree.length; i++) {
			var ou = outree[i];
			outreeArray.push(ou.id);
			if(ou.children) _getChildreOuTreeArray(ou.children, outreeArray);
		}
		return outreeArray;
	}

	function _getChildreOuTreeArray(outree, outreeArray) {
		for(var i=0; i<outree.length; i++) {
			var ou = outree[i];
			outreeArray.push(ou.id);
			if(ou.children) _getChildreOuTreeArray(ou.children, outreeArray);
		}
	}


	function dictToArray(dictObj) {
		if (!dictObj) return [];
		var ret = [];
		for (var key in dictObj) ret.push({id: key, name: dictObj[key]});
		return ret;
	}
}
//-------------------------------------------------------------------------------------------------
module_init();
})();
		

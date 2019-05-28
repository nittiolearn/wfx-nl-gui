(function() {
	// learner_view.js: Common service to display learner view records
	// All other subservices defined in this folder (service names starting from nlLearnerView***)
	// are only used within this module.
	// nl.LearnerViewCtrl: the controller implementing /#/learner_view URL. It simply
	// 						   delegates to nlLearnerView service.

function module_init() {
	angular.module('nl.learner_view', ['nl.learner_view_records'])
	.config(configFn)
	.controller('nl.LearnerViewCtrl', LearnerViewCtrl)
	.directive('nlLearnerSection', LearnerSectionDirective)
	.directive('nlLearningStatusCounts', LearningStatusCountsDirective)
	.service('nlLearnerView', NlLearnerView)
	.service('nlLearverViewHelper', NlLearnerViewHelperSrv);
}
	
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.learner_view', {
		url: '^/learner_view',
		views: {
			'appContent': {
				templateUrl: 'view_controllers/learner_view/learner_view.html',
				controller: 'nl.LearnerViewCtrl'
			}
		}});
}];

var LearnerViewCtrl = ['$scope', 'nlLearnerView',
function($scope, nlLearnerView) {
	var reportView = nlLearnerView.create($scope);
	reportView.show();
}];

var LearningStatusCountsDirective = ['nl', 
function(nl) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/learner_view/learning_status_counts.html',
        scope: {
			item: '=',
			attr: '='
		},
        link: function($scope, iElem, iAttrs) {
            $scope.getRoundedPerc = function(divider, dividend) {
				return Math.round((divider*100)/dividend);
            };
		}
	}
}];


var NlLearnerView = ['nl', 'nlDlg', 'nlRouter', 'nlServerApi', 'nlLearverViewHelper',
'nlLearnerViewRecords', 'nlTopbarSrv',
function(nl, nlDlg, nlRouter, nlServerApi, nlLearverViewHelper, nlLearnerViewRecords, nlTopbarSrv) {
	this.create = function($scope) {
		return new NlLearnerViewImpl($scope, nl, nlDlg, nlRouter, nlServerApi, nlLearverViewHelper,
			nlLearnerViewRecords, nlTopbarSrv);
	};
}];

var NlLearnerViewHelperSrv = [function() {
	this.STATUS_PENDING = 0;
	this.STATUS_STARTED = 1;
	this.STATUS_DONE = 2;
	this.STATUS_PASSED = 3;
	this.STATUS_FAILED = 4;
	this.STATUS_CERTIFIED = 5;

	this.statusInfos = [
		{id: this.STATUS_PENDING, txt: 'pending', icon: 'ion-ios-circle-filled fgrey'},
		{id: this.STATUS_STARTED, txt: 'started', icon: 'ion-ios-circle-filled fgreen'},
		{id: this.STATUS_DONE, txt: 'done', icon: 'ion-checkmark-circled fgreen'},
		{id: this.STATUS_PASSED, txt: 'passed', icon: 'ion-checkmark-circled fgreen'},
		{id: this.STATUS_FAILED, txt: 'failed', icon: 'icon ion-close-circled forange'},
		{id: this.STATUS_CERTIFIED, txt: 'certified', icon: 'icon ion-android-star fgreen'}];
		
	this.isDone = function(statusInfo) {
		return statusInfo.id != this.STATUS_PENDING && statusInfo.id != this.STATUS_STARTED;
	};

	this.dictToList = function(d) {
		var ret = [];
		for(var k in d) ret.push(d[k]);
		return ret;
	};
}];

function NlLearnerViewImpl($scope, nl, nlDlg, nlRouter, nlServerApi, nlLearverViewHelper,
	nlLearnerViewRecords, nlTopbarSrv) {

	var _fetchChunk = 100;
	var _fetchLimit = _fetchChunk;

	this.show = function() {
		nlRouter.initContoller($scope, '', _onPageEnter);
	};

	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
			_init(userInfo);
			_getLearningRecordsFromServer(resolve, false);
		});
	}

	$scope.chartsOnLoad = function() {
		nl.window.resize();
	}	

// Private members
	function _init(userInfo) {
		nlLearnerViewRecords.init(userInfo);
		nl.pginfo.pageTitle = 'Assignment Reports';
		$scope.tabData = _initTabData();
		nlTopbarSrv.setPageMenus($scope.tabData.tabs, $scope.tabData.selectedTab.id);
		_initChartData();
	}

	function _initCmdLine() {
		var params = nl.location.search();
		// params.max is handled inside getPageFetcher
		if (params.limit) _fetchLimit = parseInt(params.limit);
	}

	function _initChartData() {
		$scope.mySummary = [];
		var label =  ['Completed', 'Pending'];
		var colors = ['#007700', '#A0A0C0'];

		$scope.charts = [{
			type: 'doughnut',
			title: 'Progress',
			data: [0, 0],
			labels: label,
			colors: colors
		},
		{
			type: 'bar',
			title: nl.fmt2('Assignments assigned vs completed over time'),
			data: [[]],
			labels: [],
			series: ['Assigned', 'Completed'],
			colors: ['#3366ff', '#ff6600']
		}];
	}
    var _pageFetcher = nlServerApi.getPageFetcher({defMax: _fetchChunk, itemType: 'learning record'});
	function _getLearningRecordsFromServer(resolve, fetchMore) {
		var params = {containerid: 0, type: 'all', assignor: 'all', learner: 'me'};
		var dontHideLoading = true;
		nlLearnerViewRecords.reset();
		var myResolve = resolve || null;
        _pageFetcher.fetchBatchOfPages(nlServerApi.learningReportsGetList, params, fetchMore, 
			function(results, batchDone, promiseHolder) {
				var msg = nl.t('{} records fetched', results.length);
				nlDlg.popupStatus(msg);
				for (var i=0; i<results.length; i++) nlLearnerViewRecords.addRecord(results[i]);
				_updateScope(true);
				if (myResolve) {
					myResolve(true);
					myResolve = null;
				}
		}, _fetchLimit, dontHideLoading);
	}

	function _initTabData() {
		var ret =  {tabs: [{
			id: 'assigned',
            type: 'tab',
			iconCls : 'ion-compose',
			name: 'My learning items',

			updated: false,
			onClick: _onTabSelect
		},{
			id: 'summary',
            type: 'tab',
			iconCls : 'ion-connection-bars',
			name: 'My learning summary',

			updated: false,
			onClick: _onTabSelect
		}]};
		ret.dataLoaded = false;
		ret.learningCounts = {};
		ret.search = '';
		ret.lastSeached = '';
		ret.searchPlaceholder = 'Type the search words and press enter';
		ret.records = null; 
		ret.summaryStats = null;
		ret.summaryStatSummaryRow = null;
		ret.selectedTab = ret.tabs[0];
		ret.onSearch = _onSearch;
		ret.assignedSections = [
			{type: 'active', title: 'ACTIVE', count: 0},
			{type: 'upcomming', title: 'UPCOMING', count: 0},
			{type: 'past', title: 'PAST', count: 0}
		];
		return ret;
	}
	var SEC_POS = {'active': 0, 'upcoming': 1, 'past': 2};

	function _onSearch(event) {
		if (event && event.which !== 13) return;
		var tabData = $scope.tabData;
		if (tabData.lastSeached == tabData.search) return;
		tabData.lastSeached = tabData.search;
		_someTabDataChanged();
		_updateCurrentTab();
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
			nlDlg.showLoadingScreen();
		}
		nl.timeout(function() {
			_actualUpdateCurrentTab(tabData, tab);
			tab.updated = true;
			nlDlg.hideLoadingScreen();
		}, 100);
	}

	function _actualUpdateCurrentTab(tabData, tab) {
		if (!tabData.records) {
			tabData.records = _getFilteredRecords();
		}
		if (tab.id == 'assigned') {
			_updateAssignedTab();
		} else if (tab.id == 'summary') {
			_updateSummaryTab();
		}
	}

	function _getFilteredRecords() {
		for (var type in SEC_POS)
			$scope.tabData.assignedSections[SEC_POS[type]].count = 0;
		var records = nlLearnerViewRecords.getRecords();
		var tabData = $scope.tabData;
		var searchInfo = _getSearchInfo(tabData);
		var filteredRecords  = [];
		for (var recid in records) {
			var record = records[recid];
			if (!_doesPassFilter(record, searchInfo)) continue;
			filteredRecords.push(record);
			var type = record.recStateObj.type;
			$scope.tabData.assignedSections[SEC_POS[type]].count++;
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

	function _updateScope(avoidFlicker) {
		$scope.tabData.dataLoaded = true;
		_someTabDataChanged();
		_updateCurrentTab(avoidFlicker);
	}

	function _updateAssignedTab() {
		return;
	}

	function _updateSummaryTab() {
		_updateOverviewDoughnut();
		_updateOverviewInfoGraphicsCards();
		_updateOverviewTimeChart();
	}

	var defaultItemDict = {assigned: 0, completed: 0, certified: 0, pending: 0, failed: 0, active: 0, scorePerc: 0, 
		timeSpent: 0, certifiedInFirstAttempt: 0, certifiedInSecondAttempt: 0,
		certifiedInMoreAttempt: 0};

	function _updateOverviewTimeChart() {
		var c = $scope.charts[1];
		var ranges = nlLearnerViewRecords.getTimeRanges();
		var records = $scope.tabData.records;
		$scope.tabData.learningCounts = angular.copy(defaultItemDict);
		for (var j=0; j<records.length; j++) {
			var rec = records[j];
			_updateCoursesDetailsDict(rec, $scope.tabData.learningCounts);
			var isModuleRep = rec.type == 'module';
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

	function _updateCoursesDetailsDict(record, detailsTabDict) {
		var status = record.stats.status;
		detailsTabDict.assigned += 1;
		detailsTabDict.active += 1;
		if(status.id == nlLearverViewHelper.STATUS_DONE || status.id == nlLearverViewHelper.STATUS_PASSED || 
			status.id == nlLearverViewHelper.STATUS_CERTIFIED) {
			_updateCompletedUserDate(detailsTabDict, record);
		} else if(status.id == nlLearverViewHelper.STATUS_FAILED) {
			detailsTabDict.failed += 1;
			detailsTabDict.completed += 1;
		} else {
			detailsTabDict.pending += 1;
		}
		_updateOrgAndOuPercentages(detailsTabDict, record);
	}

	function _updateCompletedUserDate(tableItem, record) {
		tableItem.completed += 1;
		tableItem.certified += 1;

		if(record.stats.avgAttempts == 1) {
			tableItem['certifiedInFirstAttempt'] += 1;
		} else if(record.stats.avgAttempts > 1 && record.stats.avgAttempts <= 2) {
			tableItem['certifiedInSecondAttempt'] += 1;
		} else {
			tableItem['certifiedInMoreAttempt'] += 1;
		}	
	}

	function _updateOrgAndOuPercentages(tableItem, record) {
		tableItem.scorePerc += record.stats.percScore;
		tableItem.timeSpent += record.stats.timeSpentSeconds;

		tableItem['certifiedPerc'] = Math.round(tableItem.certified*100/tableItem.active);
		tableItem['failedPerc'] = Math.round(tableItem.failed*100/tableItem.active);
		tableItem['pendingPerc'] = Math.round(tableItem.pending*100/tableItem.active);
	}

	function _isTsInRange(ts, range) {
		return (ts >= range.start && ts < range.end);
	}

	function _getModuleEndedTime(rep) {
		if (!rep.completed) return null;
		return (rep.ended ? nl.fmt.json2Date(rep.ended) : rep.updated) || null;
	}

	function _getCourseEndedTime(rep) {
		if (!nlLearverViewHelper.isDone(rep.stats.status)) return null;
		return rep.raw_record.updated;
	}

	function _updateOverviewDoughnut() {
		var c = $scope.charts[0];
		c.data = [0, 0];
		var records = $scope.tabData.records;
		for (var i=0; i<records.length; i++) {
			var rec = records[i]
			if(!rec) continue;
			var status = rec.stats.status;
			status = nlLearverViewHelper.isDone(status) ? 'done' : status.id == nlLearverViewHelper.STATUS_STARTED ? 'started' : (status.id == nlLearverViewHelper.STATUS_DELAYED) ? 'delayed' : 'pending';
			if (status == 'done') {
				c.data[0] += 1;
			} else {
				c.data[1] += 1;
			}
		}
		c.title = nl.t('Assignments progress: {} of {} done', c.data[0], records.length);
	}
	
	function _updateOverviewInfoGraphicsCards() {
		var statusDict = {assigned: 0, completed: 0, ongoing: 0, overdue: 0, pending: 0};
		var records = $scope.tabData.records;
		for (var i=0; i<records.length; i++) {
			var rec = records[i];
			if (!rec) continue;
			var status = rec.stats.status;
			statusDict.assigned +=1;
			status = nlLearverViewHelper.isDone(status) ? 'done' : status.id == nlLearverViewHelper.STATUS_STARTED ? 'started' : status.id == nlLearverViewHelper.STATUS_DELAYED ? 'delayed' : 'pending';			
			if (status == 'pending') {
				statusDict.pending +=1;
			} else if (status == 'done') {
				statusDict.completed += 1;
			} else if (status == 'started'){
				statusDict.ongoing += 1;
			} else if (status == 'delayed') {
				statusDict.overdue += 1;
			}
		}
		$scope.mySummary = [
			{title: nl.t('ASSIGNMENTS'), desc:'', count: statusDict.assigned},
			{title: nl.t('COMPLETIONS'), desc:'', count: statusDict.completed},
			{title: nl.t('ONGOING'), desc:'', count: statusDict.ongoing},
			{title: nl.t('OVERDUE'), desc:'', count: statusDict.overdue}];
	}
}

var LearnerSectionDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/learner_view/learner_section.html',
        scope: {
			record: '=',
			attr: '='
		},
        link: function($scope, iElem, iAttrs) {
			$scope.onDetailsLinkClicked = function($event, record, clickAttr) {
                var detailsDlg = nlDlg.create($scope);
				detailsDlg.setCssClass('');
                detailsDlg.scope.record = record;
                detailsDlg.show('view_controllers/learner_view/learner_view_details.html');
			}
		}
	}
}];

module_init();
})();
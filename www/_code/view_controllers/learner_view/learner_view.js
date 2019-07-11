(function() {
	// learner_view.js: Common service to display learner view records
	// All other subservices defined in this folder (service names starting from nlLearnerView***)
	// are only used within this module.
	// nl.LearnerViewCtrl: the controller implementing /#/learner_view URL. It simply
	// 						   delegates to nlLearnerView service.

function module_init() {
	angular.module('nl.learner_view', ['nl.learner_view_records'])
	.config(configFn)
	.directive('nlLearnerViewDir', nlLearnerViewDirDirective)
	.directive('nlLearnerSection', LearnerSectionDirective)
	.directive('nlLearningStatusCounts', LearningStatusCountsDirective)
	.controller('nl.LearnerViewCtrl', LearnerViewCtrl)
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

//-------------------------------------------------------------------------------------------------

var  nlLearnerViewDirDirective = ['nl',
function(nl) {
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/learner_view/learner_view_dir.html',
        link: function($scope, iElem, iAttrs) {
        }
	}
}];

//-------------------------------------------------------------------------------------------------
var LearnerSectionDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/learner_view/learner_section.html',
        scope: {
			record: '=',
			attr: '=',
			title: '=',
			desc: '=',
			icon: '=',
			url: '=',
			isreport: '=',
			buttontype:'=',
			buttontext: '='
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

//-------------------------------------------------------------------------------------------------

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

//-------------------------------------------------------------------------------------------------
var LearnerViewCtrl = ['$scope', 'nlLearnerView',
function($scope, nlLearnerView) {
	var reportView = nlLearnerView.create($scope);
	reportView.show();
}];

//-------------------------------------------------------------------------------------------------

var NlLearnerView = ['nl', 'nlDlg', 'nlRouter', 'nlServerApi', 'nlLearverViewHelper',
'nlLearnerViewRecords', 'nlTopbarSrv', 'nlCardsSrv',
function(nl, nlDlg, nlRouter, nlServerApi, nlLearverViewHelper, nlLearnerViewRecords, nlTopbarSrv, nlCardsSrv) {
	this.create = function($scope) {
		return new NlLearnerViewImpl($scope, nl, nlDlg, nlRouter, nlServerApi, nlLearverViewHelper,
			nlLearnerViewRecords, nlTopbarSrv, nlCardsSrv);
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
	nlLearnerViewRecords, nlTopbarSrv, nlCardsSrv) {
	var _fetchChunk = 100;
	var _userInfo = null;
	var _parent = false;
	var _isHome = false;
	this.show = function() {
		nlRouter.initContoller($scope, '', _onPageEnter);
	};

	this.afterPageEnter = function(userInfo, parent) {
		_userInfo = userInfo;
		_parent = parent;
		_isHome = true;
		return nl.q(function(resolve, reject) {
			_onPageEnter(userInfo);
			resolve(true);
		})
	};

	this.getTabData = function() {
		return $scope.tabData;
	};

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
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
		nl.pginfo.pageTitle = _isHome ? 'Learner view' : 'Assignment Reports';
		$scope.tabData = _initTabData();
		nlTopbarSrv.setPageMenus($scope.tabData.tabs, $scope.tabData.selectedTab.id);
		_initChartData();
	}

	function _initChartData() {
		$scope.mySummary = [];
		var label =  ['Completed', 'Pending'];
		var colors = [_nl.colorsCodes.done, _nl.colorsCodes.pending];

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
		});
	}

	function _initTabData() {
		var ret =  {tabs: [{
			id: 'assigned',
            type: 'tab',
			iconCls : 'ion-compose',
			name: 'Learn',
			text: 'My learning items',

			updated: false,
			onClick: _onTabSelect
		},{
			id: 'summary',
            type: 'tab',
			iconCls : 'ion-connection-bars',
			name: 'Summary',
			text: 'My learning summary',

			updated: false,
			onClick: _onTabSelect
		}]};
		if(_userInfo.dashboard_props && ('explore' in _userInfo.dashboard_props) 
			&& _userInfo.dashboard_props.explore.length > 0)
			ret.tabs.push({id: 'explore', type: 'tab', iconCls : 'ion-ios-navigate', name: 'Explore', text:'Click to view explore links', updated: false, onClick: _onTabSelect});
		if(_isHome && _userInfo.dashboard && _userInfo.dashboard.length > 0)
			ret.tabs.push({id: 'admin', type: 'tab', iconCls : 'ion-ios-gear', name: 'Admin', text:'Click here for admin view', updated: false, onClick: _onTabSelect});

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
			{type: 'upcoming', title: 'UPCOMING', count: 0},
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
		} else if (tab.id == 'explore') {
			_updateExploreTab();
		} else if (tab.id == 'admin') {
			_updateAdminTab();
		}
	}

	function _updateExploreTab() {
        $scope.exploreCards = _userInfo.dashboard_props.explore || []
	};

	function _updateAdminTab() {
        $scope.adminCards = {
            staticlist: parent ? [] : _getUnauthorizedCards(_userInfo),
            cardlist: _getAdminCards(_userInfo, _parent, _userInfo.dashboard)
        };
        nlCardsSrv.initCards($scope.adminCards);
	};

    function _getUnauthorizedCards(userInfo) {
        var unauthorizedCards = [];
        if (userInfo.termAccess == 'none') {
            unauthorizedCards.push(
                {title: nl.t('Access not allowed'), icon: nl.url.resUrl('dashboard/warning.png'), url: '', 
                    help: nl.t('<p>Access is not allowed from this device or IP address.</p>'), 
                    style: 'nl-bg-red', children: []});
        } else if (userInfo.termAccess == 'restricted') {
            unauthorizedCards.push(
                {title: nl.t('Restricted access'), icon: nl.url.resUrl('dashboard/warning.png'), url: '', 
                    help: nl.t('<p>You have only restricted access from this device or IP address.</p>'), 
                    style: 'nl-bg-red', children: []});
        }
        return unauthorizedCards;
	}

    function _getAdminCards(userInfo, parent, cardListFromServer) {
        var cards = _getChildCards(cardListFromServer, parent);
        _updateDetails(cards);
        return cards;
    }

    function _getChildCards(dashboard, parent) {
        if (!parent) return dashboard;
        for (var i=0; i < dashboard.length; i++) {
            var card = dashboard[i];
            if (card.linkId == parent) return card.children;
        }
        return [];
    }

    function _updateDetails(cards) {
        for(var i=0; i<cards.length; i++) {
            var card = cards[i];
            var avps = [];
            for (var j=0; j<card.children.length; j++) {
            	var child = card.children[j];
            	var avp = {attr:child.title, val:child.help, url:child.url};
            	avps.push(avp);
            }
            card.details = {help: card.help, avps: avps};
            card.links = [{id: 'details', text: nl.t('details')}];
        }
    }

    function _eulaWarning() {
        nlConfig.loadFromDb('EULA_INFO', function(eulaInfo) {
            if (eulaInfo == null) {
                userInfo = _defaultUserInfo();
            }
        });
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

	var defaultItemDict = {cntTotal: 0, cntActive: 0, completed: 0, certified: 0, pending: 0, failed: 0, scorePerc: 0, 
		percCompleted: 0, percCerfied: 0, percFailed: 0, percPending: 0, avgScore: 0, 
		timeSpent: 0, certInFirstAttempt: 0, certInSecondAttempt: 0, certInMoreAttempt: 0,
		percCertInFirstAttempt: 0, percCertInSecondAttempt: 0, percCertInMoreAttempt: 0};

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
		detailsTabDict.cntTotal += 1;
		detailsTabDict.cntActive += 1;
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
			tableItem['certInFirstAttempt'] += 1;
		} else if(record.stats.avgAttempts > 1 && record.stats.avgAttempts <= 2) {
			tableItem['certInSecondAttempt'] += 1;
		} else {
			tableItem['certInMoreAttempt'] += 1;
		}	
	}

	function _updateOrgAndOuPercentages(tableItem, record) {
		tableItem.scorePerc += record.stats.percScore;
		tableItem.timeSpent += record.stats.timeSpentSeconds;
		if(tableItem.cntActive > 0) {
			tableItem['percCompleted'] = Math.round(tableItem.completed*100/tableItem.cntActive);
			tableItem['percCertified'] = Math.round(tableItem.certified*100/tableItem.cntActive);
			tableItem['percFailed'] = Math.round(tableItem.failed*100/tableItem.cntActive);
			tableItem['percPending'] = Math.round(tableItem.pending*100/tableItem.cntActive);
			tableItem['avgScore'] = Math.round(tableItem.scorePerc/tableItem.completed);
			tableItem['percCertInFirstAttempt'] = Math.round(tableItem.certInFirstAttempt/tableItem.cntActive);
			tableItem['percCertInSecondAttempt'] = Math.round(tableItem.certInSecondAttempt/tableItem.cntActive);
			tableItem['percCertInMoreAttempt'] = Math.round(tableItem.certInMoreAttempt/tableItem.cntActive);
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

module_init();
})();
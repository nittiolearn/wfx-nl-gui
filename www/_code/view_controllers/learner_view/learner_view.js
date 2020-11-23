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
	.service('nlLearnerView', NlLearnerView);
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
			nltitle: '=',
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
			attr: '=',
			columns: '='
		},
        link: function($scope, iElem, iAttrs) {
            $scope.getRoundedPerc = function(divider, dividend) {
				return Math.round((divider*100)/dividend);
            };
		}
	}
}];

//-------------------------------------------------------------------------------------------------
var LearnerViewCtrl = ['nl', '$scope', 'nlLearnerView',
function(nl, $scope, nlLearnerView) {
	nl.rootScope.showAnnouncement = !nl.rootScope.hideAnnouncement;
	$scope.pane = true;
	var learnerView = nlLearnerView.create($scope);
	learnerView.show(true);
}];

//-------------------------------------------------------------------------------------------------

var NlLearnerView = ['nl', 'nlDlg', 'nlRouter', 'nlServerApi', 'nlReportHelper',
'nlLearnerViewRecords', 'nlTopbarSrv', 'nlCardsSrv', 'nlCourse', 'nlGetManyStore', 'nlAnnouncementSrv',
function(nl, nlDlg, nlRouter, nlServerApi, nlReportHelper, nlLearnerViewRecords, nlTopbarSrv, nlCardsSrv, nlCourse, nlGetManyStore, nlAnnouncementSrv) {
	this.create = function($scope) {
		return new NlLearnerViewImpl($scope, nl, nlDlg, this, nlRouter, nlServerApi, nlReportHelper,
			nlLearnerViewRecords, nlTopbarSrv, nlCardsSrv, nlCourse, nlGetManyStore, nlAnnouncementSrv);
	};

	this.initPageBgImg = function(data) {
        var bgimgs = (data.dashboard_props || {}).bgimgs;
        if (!bgimgs && data.groupinfo && data.groupinfo.bgimg)
            bgimgs = [data.groupinfo.bgimg];
        if (!bgimgs) return;
        var pos = Math.floor((Math.random() * bgimgs.length));
        nl.rootScope.pgBgimg = bgimgs[pos];
	};

}];

function NlLearnerViewImpl($scope, nl, nlDlg, nlLearnerView, nlRouter, nlServerApi, nlReportHelper, 
	nlLearnerViewRecords, nlTopbarSrv, nlCardsSrv, nlCourse, nlGetManyStore, nlAnnouncementSrv) {
	var self = this;
	var _fetchChunk = 100;
	var _userInfo = null;
	var _parent = false;
	var _isHome = false;
	var _enableAnnouncements = false; 
	this.show = function(enableAnnouncements) {
		_enableAnnouncements = enableAnnouncements;
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
		nl.pginfo.pageTitle = nl.t('Home Dashboard');
		nl.pginfo.pageSubTitle = nl.fmt2('({})', (userInfo || {}).displayname || '');
		if (!_isHome) nlLearnerView.initPageBgImg(_userInfo);
		return nl.q(function(resolve, reject) {
			_init(userInfo);
			nlLearnerViewRecords.reset();
			_fetchDataIfNeededAndUpdateScope(false, resolve);
			if(_enableAnnouncements) _loadAndShowAnnouncements(resolve);
		});
	}

	function _loadAndShowAnnouncements(resolve) {
		nlAnnouncementSrv.onPageEnter(_userInfo, $scope, 'pane').then(function() {
			resolve(true);
		});
	}
	// Private members
	function _init(userInfo) {
		nlLearnerViewRecords.init(userInfo);
		$scope.tabData = _initTabData();
		$scope.userName = userInfo.displayname;
		nlTopbarSrv.setPageMenus($scope.tabData.tabs, $scope.tabData.selectedTab.id);
		_initChartData();
		_onResize();
		nlGetManyStore.init();
	}

	function _initChartData() {
		$scope.charts = [{
			show: false,
			type: 'doughnut',
			title: 'Progress',
			data: [0, 0, 0, 0],
			labels: ['done', 'failed', 'started', 'pending'],
			colors: [_nl.colorsCodes.done, _nl.colorsCodes.failed, _nl.colorsCodes.started, _nl.colorsCodes.pending],
			options:{maintainAspectRatio: false}
		},
		{
			show: false,
			type: 'bar',
			title: nl.fmt2('Assigned vs completed over time'),
			data: [[]],
			labels: [],
			series: ['Assigned', 'Completed'],
			colors: [_nl.colorsCodes.blue2, _nl.colorsCodes.done],
			options: {scales: {yAxes: [{ticks: {beginAtZero:true}}]}, maintainAspectRatio: false}
		}];
	}

	function _initTabData() {
		var assignedTab = {id: 'assigned', type: 'tab', iconCls : 'ion-play',
			name: 'Learn', text: 'My learning items', updated: false,
			onClick: _onTabSelect};
		var summaryTab = {id: 'summary', type: 'tab', iconCls : 'ion-stats-bars',
			name: 'Summary', text: 'My learning summary', updated: false,
			onClick: _onTabSelect};
		var exploreTab = {id: 'explore', type: 'tab', iconCls : 'ion-ios-navigate',
			name: 'Explore', text:'Click to view explore links', updated: false,
			onClick: _onTabSelect};
		var adminTab = {id: 'admin', type: 'tab', iconCls : 'ion-ios-gear', 
			name: 'Admin', text:'Click here for admin view', updated: false, 
			onClick: _onTabSelect};

		var ret =  {tabs: []};
		var isAdminTabAvailable = _userInfo.dashboard && _userInfo.dashboard.length > 0;
		var isAdminFirst = _userInfo.dashboard_props && _userInfo.dashboard_props.adminFirst;
		var isExploreTabAvailable = _userInfo.dashboard_props && 
			_userInfo.dashboard_props.explore && 
			(_userInfo.dashboard_props.explore.length > 0);
		
		if (isAdminTabAvailable && isAdminFirst) ret.tabs.push(adminTab);
		ret.tabs.push(assignedTab);
		ret.tabs.push(summaryTab);
		if (isExploreTabAvailable) ret.tabs.push(exploreTab);
		if (isAdminTabAvailable && !isAdminFirst) ret.tabs.push(adminTab);

		ret.dataLoaded = false;
		ret.learningCounts = {};
		ret.search = '';
		ret.lastSeached = '';
		ret.filter = 'active';
		ret.searchPlaceholder = 'Search';
		ret.records = null; 
		ret.recordsLen = 0;
		ret.summaryStats = null;
		ret.summaryStatSummaryRow = null;
		ret.selectedTab = ret.tabs[0];
		ret.onSearch = _onSearch;
		ret.onFilter = _onFilter;
		ret.fetchMore = _fetchMore;
		ret.assignedSections = [
			{type: 'active', title: 'PENDING', items: []},
			{type: 'upcoming', title: 'UPCOMING', items: []},
			{type: 'past', title: 'PAST', items: []}
		];
		return ret;
	}

	var _lastScreenSize = '';
	function _onResize() {
		var screenSize = (nl.rootScope.screenSize == 'small') ? 'small' : 'large';
		if (_lastScreenSize == screenSize) return;
		$scope.tabData.cls = (screenSize == 'small') ? 'nl-hcard2' : 'nl-vcard2';
		_lastScreenSize = screenSize;
	}

    nl.resizeHandler.onResize(_onResize);

	function _onTabSelect(tab) {
		$scope.tabData.selectedTab = tab;
		_fetchDataIfNeededAndUpdateScope(false, null);
	}

	function _onSearch(event) {
		if (event && event.which !== 13) return;
		var tabData = $scope.tabData;
		if (tabData.lastSeached == tabData.search) return;
		tabData.lastSeached = tabData.search;
		_updateAssignedTab();
	}

	function _onFilter(event, filter) {
		var tabData = $scope.tabData;
		if (tabData.filter == filter) return;
		tabData.filter = filter;
		_updateAssignedTab();
	}

	function _fetchMore(event) {
		if (!$scope.tabData.canFetchMore) return;
		_fetchDataIfNeededAndUpdateScope(true, null);
	}

	function _fetchDataIfNeededAndUpdateScope(fetchMore, resolve) {
		var tabid = $scope.tabData.selectedTab.id;
		if ((!_lrFetchInitiated || fetchMore) && (tabid == 'assigned' || tabid == 'summary')) {
			_getLearningRecordsFromServer(fetchMore, function(result) {
				if (result) _updateCurrentTab(tabid);
				if (resolve) resolve(true);
			});
		} else {
			_updateCurrentTab(tabid);
			if (resolve) resolve(true);
		}
	}

	var _lrFetchInitiated = false;
    var _pageFetcher = nlServerApi.getPageFetcher({defMax: _fetchChunk, itemType: 'learning record'});
	function _getLearningRecordsFromServer(fetchMore, resolve) {
		_lrFetchInitiated = true;
		var params = {containerid: 0, type: 'all', assignor: 'all', learner: 'me'};

		var dontHideLoading = true;
		nlDlg.popupStatus('Fetching learning records from server ...', false);
		nlDlg.showLoadingScreen();
		function _onFetchComplete(results) {
			nlDlg.hideLoadingScreen();
			if (results) {
				for (var i=0; i<results.length; i++) nlLearnerViewRecords.addRecord(results[i]);
			}
			$scope.tabData.dataLoaded = true;
			$scope.tabData.records = nlLearnerViewRecords.getRecords();
			$scope.tabData.recordsLen = Object.keys($scope.tabData.records).length;
			$scope.tabData.canFetchMore = _pageFetcher.canFetchMore();
			var msg = 'Learning records fetched.';
			if ($scope.tabData.canFetchMore) {
				msg += ' Press on the fetch more icon to fetch more from server.';
			}
			nlDlg.popupStatus(msg);
			resolve(true);
		}

        _pageFetcher.fetchPage(nlServerApi.learningReportsGetList, params, fetchMore, function(results) {
			if (!results) {
				_onFetchComplete(false);
				return;
			}
			var msg = nl.t('Fetching assignment and course information from server ...', results.length);
			nlDlg.popupStatus(msg, false);
			nlGetManyStore.fetchReferredRecords(results, false, function() {
				_onFetchComplete(results);
			});
		}, dontHideLoading);
	}

	function _updateCurrentTab(tabid) {
		if (tabid == 'assigned') {
			_updateAssignedTab();
		} else if (tabid == 'summary') {
			_updateSummaryTab();
		} else if (tabid == 'explore') {
			_updateExploreTab();
		} else if (tabid == 'admin') {
			_updateAdminTab();
		}
	}

	function _updateExploreTab() {
        $scope.exploreCards = _userInfo.dashboard_props.explore || [];
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

	function _updateAssignedTab() {
		$scope.tabData.assignedSections = _getFilteredRecords();
	}

	var SEC_POS = {'active': 0, 'upcoming': 1, 'past': 2};
	function _getFilteredRecords() {
		var records = $scope.tabData.records;
		var assignedSections = $scope.tabData.assignedSections;
		for (var type in SEC_POS) {
			assignedSections[SEC_POS[type]].items = [];
		}

		$scope.tabData.assignedCounts = {all: 0, active: 0, started: 0};
		var assignedCounts = $scope.tabData.assignedCounts;

		var tabData = $scope.tabData;
		var searchInfo = _getSearchInfo(tabData);
		var filter = tabData.filter;
		for (var recid in records) {
			var record = records[recid];
			if (!_doesPassSearch(record, searchInfo)) continue;

			var type = record.recStateObj.type;
			var statusid = record.stats.status.id;
			var isActive = type == 'active';
			var isStarted = isActive && statusid == nlReportHelper.STATUS_STARTED;
			var doesPassFilter = (filter == 'all') ||
				(filter == 'active' && isActive) ||
				(filter == 'started' && isStarted);

			assignedCounts.all++;
			if (isActive) assignedCounts.active++;
			if (isStarted) assignedCounts.started++;

			if (!doesPassFilter) continue;
			assignedSections[SEC_POS[type]].items.push(record);
		}

		assignedSections[SEC_POS['active']].items.sort(function(a, b) {
			// DESCENDING
			return (b.raw_record.not_before - a.raw_record.not_before);
		});
		assignedSections[SEC_POS['upcoming']].items.sort(function(a, b) {
			// ASCENDING
			return (a.raw_record.not_before - b.raw_record.not_before);
		});
		assignedSections[SEC_POS['past']].items.sort(function(a, b) {
			// DESCENDING
			return (b.raw_record.updated - a.raw_record.updated);
		});
		return assignedSections;
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

	function _updateSummaryTab() {
		for(var i=0; i<$scope.charts.length; i++) $scope.charts[i].show = false;
		nl.timeout(function() {
			_updateSummaryTabImpl();
			for(var i=0; i<$scope.charts.length; i++) $scope.charts[i].show = true;
		}, 100);
	}

	function _updateSummaryTabImpl() {
		var learningCounts = {cntTotal: 0, completed: 0, certified: 0, pending: 0, failed: 0, started: 0, scorePerc: 0, 
								percCompleted: 0, percCerfied: 0, percFailed: 0, percPending: 0, avgScore: 0, 
								timeSpent: 0};
		$scope.tabData.learningCounts = learningCounts;
	
		var doughnutChart = $scope.charts[0];
		doughnutChart.data = [0, 0, 0, 0];

		var timeChart = $scope.charts[1];
		var ranges = nlLearnerViewRecords.getTimeRanges();
		var records = $scope.tabData.records;
		for (var recid in records) {
			var rec = records[recid];
			if(!rec) continue;
			var statusid = rec.stats.status.id;
			if (statusid == nlReportHelper.STATUS_PENDING) {
				doughnutChart.data[3] += 1;
			} else if(statusid == nlReportHelper.STATUS_STARTED) {
				doughnutChart.data[2] += 1;
			} else if (statusid == nlReportHelper.STATUS_FAILED) {
				doughnutChart.data[1] += 1;
			} else  {
				doughnutChart.data[0] += 1;
			}
			_updateCoursesDetailsDict(rec, learningCounts);
			var isModuleRep = rec.type == 'module';
			var ended = isModuleRep ? _getModuleEndedTime(rec.raw_record) : _getCourseEndedTime(rec);
			var isAssignedCountFound = false;
			var isCompletedCountFound = false;
			for(var i=0; i<ranges.length; i++) {
				if (!isAssignedCountFound && _isTsInRange(rec.raw_record.created, ranges[i])) {
					ranges[i].count++;
					isAssignedCountFound = true;
				}
				if (ended && !isCompletedCountFound && _isTsInRange(ended, ranges[i])) {
					ranges[i].completed++;
					isCompletedCountFound = true;
				}
				if(isAssignedCountFound && isCompletedCountFound) break;
			}
		}
		$scope.tabData.columns = _getLearningStatusColumns();
		doughnutChart.title = nl.t('Progress: {} of {} completed', learningCounts.completed, learningCounts.cntTotal);

		timeChart.labels = [];
		timeChart.data = [[], []];
		for (var i=0; i<ranges.length; i++) {
			var r = ranges[i];
			timeChart.labels.push(r.label);
			timeChart.data[0].push(r.count);
			timeChart.data[1].push(r.completed)
		}

	}

	function _getLearningStatusColumns() {
		var columns = [];
		columns.push({id: 'cntTotal', name: 'Total learning records', percid: 'percTotal', background: 'nl-bg-blue', showAlways: true});
		columns.push({id: 'completed', name: 'Completed', percid: 'percCompleted', indentation: 'padding-left-22', showAlways: true});
		columns.push({id: 'certified', name: 'Certified', percid: 'percCertified', indentation: 'padding-left-44'});
		columns.push({id: 'failed', name: 'Failed', percid: 'percFailed', indentation: 'padding-left-44'});
		columns.push({id: 'started', name: 'Started',  percid: 'percStarted', indentation: 'padding-left-22', showAlways: true});
		columns.push({id: 'pending', name: 'Pending', percid: 'percPending', indentation: 'padding-left-22', showAlways: true});
		return columns;
		
	}
	
	function _updateCoursesDetailsDict(record, detailsTabDict) {
		var status = record.stats.status;
		detailsTabDict.cntTotal += 1;
		if(status.id == nlReportHelper.STATUS_DONE || status.id == nlReportHelper.STATUS_PASSED || 
			status.id == nlReportHelper.STATUS_CERTIFIED) {
			_updateCompletedUserDate(detailsTabDict, record);
		} else if(status.id == nlReportHelper.STATUS_FAILED) {
			detailsTabDict.failed += 1;
			detailsTabDict.completed += 1;
		} else if(status.id == nlReportHelper.STATUS_STARTED){
			detailsTabDict.started += 1;
		}else{
			detailsTabDict.pending += 1;
		}
		_updateOrgAndOuPercentages(detailsTabDict, record);
	}

	function _updateCompletedUserDate(tableItem, record) {
		tableItem.completed += 1;
		tableItem.certified += 1;
	}

	function _updateOrgAndOuPercentages(tableItem, record) {
		tableItem.scorePerc += record.stats.percScore;
		tableItem.timeSpent += record.stats.timeSpentSeconds;
		tableItem.percTotal = 100;
		if(tableItem.cntTotal > 0) {
			tableItem['percCompleted'] = Math.round(tableItem.completed*100/tableItem.cntTotal);
			tableItem['percCertified'] = Math.round(tableItem.certified*100/tableItem.cntTotal);
			tableItem['percFailed'] = Math.round(tableItem.failed*100/tableItem.cntTotal);
			tableItem['percPending'] = Math.round(tableItem.pending*100/tableItem.cntTotal);
			tableItem['percStarted'] = Math.round(tableItem.started*100/tableItem.cntTotal);
			tableItem['avgScore'] = Math.round(tableItem.scorePerc/tableItem.completed);
		}
	}

	function _isTsInRange(ts, range) {
		return (ts >= range.start && ts < range.end);
	}

	function _getModuleEndedTime(raw_record) {
		if (!raw_record.completed) return null;
		return (raw_record.ended ? nl.fmt.json2Date(raw_record.ended) : raw_record.updated) || null;
	}

	function _getCourseEndedTime(rep) {
		if (!nlReportHelper.isDone(rep.stats.status)) return null;
		return rep.raw_record.updated;
	}
}

module_init();
})();
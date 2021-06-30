(function() {
	// learner_view.js: Common service to display learner view records
	// All other subservices defined in this folder (service names starting from nlLearnerView***)
	// are only used within this module.
	// nl.LearnerViewCtrl: the controller implementing /#/learner_view URL. It simply
	// 						   delegates to nlLearnerView service.

function module_init() {
	angular.module('nl.learner_view2', ['nl.learner_view_records2', 'nl.learner_view_timespent'])
	.config(configFn)
	.directive('nlLearnerViewDir2', LearnerView2Directive)
	.directive('nlLearnerViewTopSection', LearnerViewTopSectionDirective)
	.directive('nlLearnerSection2', LearnerSectionDirective2)
	.directive('nlLearningStatusCounts2', LearningStatusCountsDirective2)
	.directive('nlLearningStats', LearningStats)
	.directive('nlComputeImgInfo', ComputeImgInfoDirective)
	.directive('nlLearnerViewLeaderboard', LearnerViewLeaderboardDirective)
	.controller('nl.LearnerViewCtrl2', LearnerViewCtrl2)
	.service('nlLearnerView2', NlLearnerView2);
}
	
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.learner_view2', {
		url: '^/learner_view2',
		views: {
			'appContent': {
				templateUrl: 'view_controllers/learner_view2/learner_view2.html',
				controller: 'nl.LearnerViewCtrl2'
			}
		}});
}];

//-------------------------------------------------------------------------------------------------

var  LearnerView2Directive = ['nl',
function(nl) {
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/learner_view2/learner_view_dir2.html',
        link: function($scope, iElem, iAttrs) {
        }
	}
}];

//-------------------------------------------------------------------------------------------------

var LearnerViewTopSectionDirective = ['nl', 'nlDlg', 'nlLearnerViewTimeSpent',
function(nl, nlDlg, nlLearnerViewTimeSpent) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/learner_view2/learner_top_section.html',
        scope: {
			tabdata: '='
		},
        link: function($scope, iElem, iAttrs) {
			$scope.summary = nl.url.lessonIconUrl('summary.svg');
			$scope.learn = nl.url.lessonIconUrl('learn.svg');
			$scope.explore=nl.url.lessonIconUrl('explore.svg');
			$scope.creditStar =nl.url.lessonIconUrl('credit-star.svg');
			$scope.onDetailsLinkClicked = function($event, record, clickAttr) {
                var detailsDlg = nlDlg.create($scope);
				detailsDlg.setCssClass('nl-dlg2');
                detailsDlg.scope.record = record;
                detailsDlg.show('view_controllers/learner_view2/learner_view_details.html');
			};
			$scope.toScroll = function(button) {
				if (button.count == 0) return;
				var anchorid = button.id;
				var scrollid = nl.t('anchor-{}', anchorid);
				if (scrollid) nl.location.hash(scrollid);
				nl.anchorScroll();
			};
			$scope.viewStatistics =function() {
				$scope.tabdata.summaryStats = true;
				$scope.tabdata.explore = false;
				$scope.tabdata.showSearchbar = false;
			};
			$scope.exploreAvailable =function() {
				$scope.tabdata.explore= true;
				$scope.tabdata.summaryStats= false;
				$scope.tabdata.showSearchbar = false;
			};
			$scope.goback = function() {
				$scope.tabdata.summaryStats= false;
				$scope.tabdata.explore= false;
				$scope.tabdata.showSearchbar = true;
			};
			$scope.getImageResUrl = function(image) {
				return nl.url.lessonIconUrl(image);
			};
		}
	}
}];

//-------------------------------------------------------------------------------------------------
var LearnerSectionDirective2 = ['nl', 'nlDlg', 'nlServerApi',
function(nl, nlDlg, nlServerApi) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/learner_view2/learner_section2.html',
        scope: {
			card: '=',
			activecard : '=',
			tabdata: '=',
		},
        link: function($scope, iElem, iAttrs) {
			$scope.onDetailsLinkClicked = function($event, record, clickAttr) {
                var detailsDlg = nlDlg.create($scope);
				detailsDlg.setCssClass('nl-dlg2');
                detailsDlg.scope.record = record;
                detailsDlg.show('view_controllers/learner_view2/learner_view_details.html');
			}
			$scope.explore = function(exploreCard, activecard) {
				$scope.$parent.$parent.$parent.tabData.showSearchbar = true;
				const urlParams = new URLSearchParams(exploreCard.url);
				const params = Object.fromEntries(urlParams);
				for (var key in params) {
					if (key.indexOf('/#/') == 0) delete params[key];
				}
				return nl.q(function(resolve, reject) { 
					var a =$scope.$parent.fetchTheExploreSectionCards(exploreCard, params, false, resolve, activecard);	 
				});				
			}
		}
	}
}];

//-------------------------------------------------------------------------------------------------
var LearningStats = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/learner_view2/learner_view_stats.html',
	}
}];


//---------------------------------
var LearningStatusCountsDirective2 = ['nl', 
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
var LearnerViewCtrl2 = ['nl', '$scope', 'nlLearnerView2',
function(nl, $scope, nlLearnerView2) {
	nl.rootScope.showAnnouncement = !nl.rootScope.hideAnnouncement;
	$scope.canCoverdlg = function(url) {
		var info = _imgInfo[url];
		if (!info) return false;
		var ar = info.w ? info.h/info.w : 0;
		info.canCover = (ar < 1);
		return info.canCover;
	};
	$scope.pane = true;
	var learnerView = nlLearnerView2.create($scope);
	learnerView.show(true);
}];

//-------------------------------------------------------------------------------------------------
var _imgInfo = {};
var ComputeImgInfoDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
	return {
		restrict: 'A',
		link: function($scope, iElem, iAttrs) {
			iElem.bind('load', function(params) {
				$scope.$apply(function() {
					var w = iElem[0].naturalWidth;
					var h = iElem[0].naturalHeight;
					_imgInfo[iAttrs.src] = {w:w, h:h};
				})
			});
		 }
	};
}];

//-------------------------------------------------------------------------------------------------
var LearnerViewLeaderboardDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
	return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/learner_view2/learner_view_leaderboard.html',
		link: function($scope, iElem, iAttrs) {
			$scope.scrollPrev =function(num) {
				$scope.$parent.slideshow($scope.$parent.tabData.slideIndex += num);
			};
			$scope.scrollNext =function(num) {
				$scope.$parent.slideshow($scope.$parent.tabData.slideIndex += num);
			};	
		}
	}
}];

//-------------------------------------------------------------------------------------------------

var NlLearnerView2 = ['nl', 'nlDlg', 'nlRouter', 'nlReportHelper',
'nlLearnerViewRecords2', 'nlTopbarSrv', 'nlCardsSrv', 'nlCourse', 'nlGetManyStore', 'nlAnnouncementSrv', 'nlServerApi', 'nlGroupInfo','nlLearnerViewTimeSpent', 'nlFileReader',
function(nl, nlDlg, nlRouter, nlReportHelper, nlLearnerViewRecords2, nlTopbarSrv, nlCardsSrv, nlCourse, nlGetManyStore, nlAnnouncementSrv, nlServerApi, nlGroupInfo, nlLearnerViewTimeSpent, nlFileReader) {
	this.create = function($scope) {
		return new NlLearnerViewImpl($scope, nl, nlDlg, this, nlRouter, nlReportHelper,
			nlLearnerViewRecords2, nlTopbarSrv, nlCardsSrv, nlCourse, nlGetManyStore, nlAnnouncementSrv, nlServerApi, nlGroupInfo, nlLearnerViewTimeSpent, nlFileReader);
	};

	this.initPageBgImg = function(data) {
        var bgimgs = (data.dashboard_props || {}).bgimgs;
        if (!bgimgs && data.groupinfo && data.groupinfo.bgimg)
            bgimgs = [data.groupinfo.bgimg];
        if (!bgimgs) return;
        var pos = Math.floor((Math.random() * bgimgs.length));
        nl.rootScope.pgBgimg = bgimgs[pos];
	};

	this.resetPageBgImg = function() {
        nl.rootScope.pgBgimg = null;
	}
}];

function NlLearnerViewImpl($scope, nl, nlDlg, nlLearnerView2, nlRouter, nlReportHelper, 
	nlLearnerViewRecords2, nlTopbarSrv, nlCardsSrv, nlCourse, nlGetManyStore, nlAnnouncementSrv, nlServerApi, nlGroupInfo, nlLearnerViewTimeSpent, nlFileReader) {
	var self = this;
	var _userInfo = null;
	var _parent = false;
	var _isHome = false;
	var _enableAnnouncements = false; 
	$scope.nodata = nl.url.lessonIconUrl('nodata.svg');
	this.show = function(enableAnnouncements) {
		_enableAnnouncements = enableAnnouncements;
		nlRouter.initContoller($scope, '', _onPageEnter);
	};

	this.afterPageEnter = function(userInfo, parent) {
		// Not used as of now. May be used later from home.js
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
		if (!_isHome) nlLearnerView2.initPageBgImg(_userInfo);
		return nl.q(function(resolve, reject) {
			_init(userInfo);
			_getLearningRecordsFromCacheAndServer(resolve);
			if(_enableAnnouncements) _loadAndShowAnnouncements();
			nlGroupInfo.init2().then(function() {
				nlGroupInfo.update();
				_statsDetails();
			});
		});
	}
	
	function _loadAndShowAnnouncements() {
		nlAnnouncementSrv.onPageEnter(_userInfo, $scope, 'pane').then(function() {
		});
	}
    
	function _init(userInfo) {
		nlLearnerViewRecords2.init(userInfo);
		$scope.tabData = _initData();
		$scope.onCardLinkClicked = _onCardLinkClickedFn;
		$scope.onCardInternalUrlClicked = _onCardInternalUrlClickedFn;
		for(var i=0; i<$scope.tabData.sectionData.length; i++) {
			var cards = $scope.tabData.sectionData[i];
			cards.onClickOnNextFn = _onClickOnNextFn;
			cards.onClickOnPrevFn = _onClickOnPrevFn;
			cards.canShowNext = _canShowNext;
			cards.canShowPrev = _canShowPrev;
			cards.getVisibleString = _getVisibleString;
			cards.canSort = _canSort;
			nlCardsSrv.initCards(cards);
		}
		$scope.userName = userInfo.displayname;
		nlTopbarSrv.setPageMenus($scope.tabData.toptabs, $scope.tabData.selectedTab.id);
		_initChartData();
	}
	
	function _initChartData() {
		$scope.charts = [{
			show: false,
			type: 'pie',
			data: [0, 0, 0, 0],
			labels: ['Completed', 'Not started', 'Inprogress', 'Upcoming','Expired'],
			colors: [_nl.colorsCodes.done, _nl.colorsCodes.pending, _nl.colorsCodes.started, _nl.colorsCodes.upcoming, _nl.colorsCodes.failed ],
			options:{responsive: true, maintainAspectRatio: false,segmentShowStroke: false},
		},
		{
			show: false,
			type: 'bar',
			title: '',
			data: [[]],
			labels: [],
			series: ['Assigned', 'Completed'],
			colors: [_nl.colorsCodes.upcoming, _nl.colorsCodes.done],
			options: {scales: {
				xAxes: [{
					gridLines: {
						fontColor: '#000000',
					},
					ticks: {
						beginAtZero:true,
                    }
				}],
				yAxes: [{
					gridLines: {
						fontColor: '#000000',
					},
					ticks: {
						beginAtZero:true,
                	}
				}]
			}}
		},
		{
			show: false,
			type: 'line',
			backgroundColor: _nl.colorsCodes.started,
			data: [],
			labels: [],
			series: ['Completed'],
			colors: [_nl.colorsCodes.started],
			options: {scales: {
				xAxes: [{
					gridLines: {
						color: "rgba(0, 0, 0, 0)",
					}
				}],
				yAxes: [{
					gridLines: {
						color: "rgba(0, 0, 0, 0)",
					}   
				}]
			}}
		}];
	}

	function _onClickOnNextFn(cards, scope) {
		if (!cards) return;
		var cardWidth = 225;
		var document = nl.window.document;
		var className = nl.t('nl-card-section-scroll-{}', cards.type);
		var element = document.getElementsByClassName(className);
		var num = Math.floor(element[0].clientWidth/cardWidth);
		var widthToScroll = num*cardWidth+12;
		var len = widthToScroll/num;
		var timeout = 75;
		_callInLoop(0, len, element, 'add', timeout)
	}

	function _onClickOnPrevFn(cards, scope) {
		if (!cards) return;
		var cardWidth = 225;
		var document = nl.window.document;
		var className = nl.t('nl-card-section-scroll-{}', cards.type);
		var element = document.getElementsByClassName(className);
		var num = Math.floor(element[0].clientWidth/cardWidth);
		var widthToScroll = num*cardWidth+8;
		var len = widthToScroll/5;
		var timeout = 75;
		_callInLoop(0, len, element, 'sub', timeout)
	}

	function _callInLoop(startpos, len, element, type, timeout) {
		startpos += 1;
		nl.timeout(function() {
			if (type == 'add')
				element[0].scrollLeft += len;
			else
				element[0].scrollLeft -= len;
			if (startpos < 5) {
				_callInLoop(startpos, len, element, type, timeout)
			}
		}, timeout)
	}

	function _getVisibleString(cards) {
		return '';
	}

	function _canSort() {
		return false;
	}

	function _canShowNext(cards) {
		if (!cards) return;
		var document = nl.window.document;
		var className = nl.t('nl-card-section-scroll-{}', cards.type);
		var element = document.getElementsByClassName(className);
		if (!element[0]) return;
 		if (element[0].scrollWidth && (element[0].scrollWidth > (element[0].scrollLeft + element[0].clientWidth))) return true;
		return false;
	}

	function _canShowPrev(cards) {
		if (!cards) return;
		var document = nl.window.document;
		var className = nl.t('nl-card-section-scroll-{}', cards.type);
		var element = document.getElementsByClassName(className);
		if (!element[0]) return;
		if (element[0].scrollLeft > 0) return true;
		return false;
	
	}

	function _onCardLinkClickedFn(card, linkid) {
		_showDetailsDlg(card);
	}

	function _onCardInternalUrlClickedFn(card) {
		if (card.url) 
			nl.window.location.href = card.url;
		else 
			_showDetailsDlg(card);
	}

	function _showDetailsDlg(card) {
		var detailsDlg = nlDlg.create($scope);
		detailsDlg.setCssClass('nl-dlg2');
		var name = card.repcontent.name;
		var launchurl=card.url;
		if (name.length > 20)
			name = name.substring(0, 20) + '...';
		detailsDlg.scope.pageTitle = name;
		detailsDlg.scope.record = card;
		detailsDlg.show('view_controllers/learner_view2/learner_view_details.html');
	}


	function _initData() {
		var ret =  {toptabs: []};
		var isExploreTabAvailable = _userInfo.dashboard_props &&  _userInfo.dashboard_props.explore && (_userInfo.dashboard_props.explore.length > 0);
		var showCreditpoints = ((((_userInfo.groupinfo || {}).features || {}).learningCredits || {}).learnerUi || false) || false;
		_updateTopBarButtons(ret);
		ret.dataLoaded = false;
		ret.learningCounts = {};
		ret.search = '';
		ret.lastSeached = '';
		ret.filter = 'active';
		ret.searchPlaceholder = 'Search';
		ret.records = null; 
		ret.recordsLen = 0;
		ret.summaryStats = false;
		ret.exploreSection = isExploreTabAvailable;
		ret.explore = false;
		ret.summaryStatSummaryRow = null;
		ret.onSearch = _onSearch;
		ret.onKeyupSearch=_onKeyupSearch;
		ret.onFilter = _onFilter;
		ret.fetchMore = _fetchMore;
		ret.showSearchbar = true;
		ret.showCreditpoints = showCreditpoints;
		ret.currentlearnerStats =[];
		ret.currentlearnersevenDaysrank; 
		ret.currentlearnerthirtyDaysrank;
		ret.currentlearnernintyDaysrank;
		ret.slideIndex=1;
		ret.leaderBoardData = [
							  {days:'Past 7 Days', userData : []},
							  {days:'Past 30 Days', userData : []},
							  {days:'Past 90 Days', userData: []}
							];
		ret.tsnintydays = '';
		ret.tsthirtydays = '';
		ret.tssevendays = '';
		ret.sectionData = [
						{name: 'Continue Learning', type: 'progress', card2: true, cardlist: []},
						{name: 'New Assignments', type: 'pending', card2: true, cardlist: []},
						{name: 'Upcoming Assignments', type: 'upcoming', card2: true, cardlist: []}, 
						{name: 'Completed Assignments', type: 'completed', card2: true, cardlist: []},
						{name: 'Expired Assignments', type: 'expired', card2: true, cardlist: []}		
					];
		ret.tabs = [{id:'progress', title: 'In progress', count: 0, class: 'nl-learner-inprogress'}, 
					{id: 'pending', title: 'Not started', count: 0, class: 'nl-learner-notstarted'},
					{id:'upcoming', title: 'Upcoming', count: 0, class: 'nl-learner-upcoming'},
					{id:'completed', title: 'Completed', count: 0, class: 'nl-learner-complete'},
					{id:'expired', title: 'Expired', count: 0, class: 'nl-learner-expired'}]
		ret.exploreCardsSection = [];
		return ret;
	}
	
	function _updateTopBarButtons(ret) {
		ret.canFetchMore = true;
		var assignedTab = {id: 'assigned', type: 'tab', iconCls : 'ion-play',
			name: 'Learn', text: 'My learning items', updated: false,
			onClick: _onTabSelect};
		var adminTab = {id: 'admin', type: 'tab', iconCls : 'ion-ios-gear', 
			name: 'Admin', text:'Click here for admin view', updated: false, 
			onClick: _onTabSelect};
		var isAdminTabAvailable = _userInfo.dashboard && _userInfo.dashboard.length > 0;
		ret.toptabs.push(assignedTab);
		if (isAdminTabAvailable) {
			var isAdminFirst = _userInfo.dashboard_props && _userInfo.dashboard_props.adminFirst;
			if (isAdminFirst) 
				ret.toptabs.splice(0, 0, adminTab);
			else
				ret.toptabs.push(adminTab)
			ret.selectedTab = ret.toptabs[0];	
		} else {
			ret.selectedTab = assignedTab;
			ret.toptabs = [];
		}
	}

	function _onTabSelect(tab) {
		$scope.tabData.selectedTab = tab;
		_onAfterTabSelect(null);
	}

	function _onSearch(event) {
		if (event && event.which !== 13) return;
		var tabData = $scope.tabData;
		if (tabData.lastSeached == tabData.search) return;
		tabData.lastSeached = tabData.search;
		if($scope.tabData.explore) _updateExploreRecords();
		else _updateLearningRecords();		
	}
    
	function _updateExploreRecords() {
		var searchInfo = _getSearchInfo($scope.tabData);
		for(var i=0; i<$scope.exploreCards.length; i++) {
			var cards = $scope.exploreCards[i];
			var children = cards.masterCopy || [];
			if (children.length > 0) {
				cards.cardlist = [];
				for (var j=0; j<children.length; j++) {
					var child = children[j];
					if (!_doesPassSearchFn(child, searchInfo)) continue;
					cards.cardlist.push(child);
				}
			}
		}
	}

	function _doesPassSearchFn(child, searchInfo) {
		for (var i=0; i<searchInfo.length; i++) {
			var searchElem = searchInfo[i];
			if (_isFoundInAnyOfAttrs(searchElem, child.repcontent, ['grade', 'subject', 'title'])) continue;
			if (_isFoundInAnyOfAttrs(searchElem, child, ['name', 'title', 'authorName'])) continue;
			return false;
		}
		return true;
	}

	function _onKeyupSearch(event) {
		if(event.target.value=='') {
			if($scope.tabData.explore)  _updateExploreRecords();
			_updateLearningRecords();
		}
	}

	function _onFilter(event, filter) {
		var tabData = $scope.tabData;
		if (tabData.filter == filter) return;
		tabData.filter = filter;
		_updateLearningRecords();
	}

	function _fetchMore(event) {
		if (!$scope.tabData.canFetchMore) return;
		else {
			if($scope.tabData.explore) $scope.fetchTheExploreSectionCards();
			nlLearnerViewRecords2.fetchNextChunkFromServer(function(_, canFetchMore) {
				_updateTabDataWithRecords(canFetchMore);
			});
		}
	}

	function _onAfterTabSelect() {
		var tabid = $scope.tabData.selectedTab.id;
		if (tabid == 'assigned') {
			nlLearnerView2.resetPageBgImg();
			_getLearningRecordsFromCacheAndServer(null);
		} else {
			_updateCurrentTab(tabid);
		}
	}

	function _updateCurrentTab(tabid) {
		if (tabid == 'assigned') {
			nlLearnerView2.resetPageBgImg();
			_updateLearningRecords();
		} else if (tabid == 'admin') {
			nlLearnerView2.initPageBgImg(_userInfo);
			_updateAdminTab();
		}
	}

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
				card.fullDesc = false;
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

	function _getLearningRecordsFromCacheAndServer(resolve) {
		var bResolved = false;
		var tabid = $scope.tabData.selectedTab.id;
		if (tabid == 'assigned' && $scope.tabData.canFetchMore) {
			nlLearnerViewRecords2.initFromCache(function(dataFound) {
				if (!dataFound) {
					nlLearnerViewRecords2.fetchLatestChunkFromServer(function(_, canFetchMore) {
						_updateTabDataWithRecords(canFetchMore);
						if (resolve) resolve(true);
					});
					return;
				}
				_updateTabDataWithRecords(false);
				if (resolve) resolve(true);
				nlLearnerViewRecords2.updateCachedRecords(function(datachanged, canFetchMore) {
					if (datachanged || $scope.tabData.canFetchMore != canFetchMore) {
						_updateTabDataWithRecords(canFetchMore);
					} else {
						nlDlg.hideLoadingScreen();
						nlDlg.popupStatus('', 0);
					}
				});
			});	
		} else {
			_updateCurrentTab(tabid);
			if (resolve) resolve(true);
		}
	}

	function _updateTabDataWithRecords(canFetchMore) {
		$scope.tabData.records = nlLearnerViewRecords2.getRecords();
		$scope.tabData.recordsLen = Object.keys($scope.tabData.records).length;
		$scope.tabData.canFetchMore = canFetchMore;
		_updateCurrentLrReportsTab();
		$scope.tabData.dataLoaded = true;
		var msg = 'Fetched.';
		if (canFetchMore) msg += ' Press on the fetch more icon to fetch more from server.';
		nlDlg.popupStatus(msg);
		nlDlg.hideLoadingScreen();
	}

	function _updateCurrentLrReportsTab() {
		_updateLearningRecords();
		for(var i=0; i<$scope.tabData.sectionData.length; i++) {
			var cards = $scope.tabData.sectionData[i];
			nlCardsSrv.updateCards(cards, {});
		}
		_updateSummaryTab();
		_updateExploreTab();
	}
    
	function _updateLearningRecords() {
		$scope.tabData.sectionData = _getFilteredRecords();
	}

	var SEC_POS = {'progress': 0, 'pending': 1, 'upcoming': 2, 'completed': 3, 'expired': 4};
	var CARD_SIZE = {0: 'L', 1: 'L', 2: 'M', 3: 'S', 4: 'S'};
	var LAUNCH_BUTTON = {'progress': 'start.svg', 'pending': 'start.svg', 'upcoming': 'true', 'completed': 'review.svg', 'expired': 'review.svg'};
	var LAUNCH_BUTTON_LIGHT = {'progress': 'start-dark.svg', 'pending': 'start-dark.svg', 'upcoming': 'true', 'completed': 'review-dark.svg', 'expired': 'review-dark.svg'};
    
	function _getFilteredRecords() {
		var records = $scope.tabData.records;
		var cards = $scope.tabData.sectionData;
		var tabItemCount = $scope.tabData.tabs;
		for (var type in SEC_POS) {
			cards[SEC_POS[type]].cardlist = [];
			tabItemCount[SEC_POS[type]].count = 0;
			cards[SEC_POS[type]].size = CARD_SIZE[SEC_POS[type]];
		}

		var tabData = $scope.tabData;
		var searchInfo = _getSearchInfo(tabData);
		for (var recid in records) {
			var record = records[recid];
			if (!_doesPassSearch(record, searchInfo)) continue;
			var type = record.recStateObj.type;
			var secNo = SEC_POS[type];
			var card = _createLearnerCard(record);
			card.size = cards[secNo].size;
			cards[secNo].cardlist.push(card);
			tabItemCount[secNo].count += 1;
		}

		for (var key in SEC_POS) {
			if (key == 'upcoming' || key == 'expired' || key == 'pending') {
				cards[SEC_POS[key]].cardlist.sort(function(a, b) {
					// ASCENDING
					return (b.not_before - a.not_before);
				});		
			} else {
				cards[SEC_POS[key]].cardlist.sort(function(a, b) {
					// DESCENDING
					return (b.updated - a.updated);
				});
			}
		}
		return cards;
	}

	function _createLearnerCard(record) {
		var recordStateObj = record.recStateObj;
		var card = {};
		card.repcontent = record.repcontent;
		card.type = recordStateObj.type;
		var currentTheme = _userInfo.settings.userCustomClass;
		if (LAUNCH_BUTTON[card.type]) {
			if(currentTheme == 'nllightmode') {
				card.buttonUrl = nl.url.lessonIconUrl(LAUNCH_BUTTON_LIGHT[card.type]);
				card.openDlgBtn = nl.url.lessonIconUrl('down-arrow-dark.svg');
			} 
			if(currentTheme == 'nldarkmode') {
				card.buttonUrl = nl.url.lessonIconUrl(LAUNCH_BUTTON[card.type]);
				card.openDlgBtn = nl.url.lessonIconUrl('down-arrow.svg');
			} 
		}
		if(card.type != 'upcoming') {
			if(card.type != 'expired' || (card.type == 'expired' && record.type == 'course')) card.canShowLaunchbutton = true;
		}
		card.placeHolder = nl.url.lessonIconUrl('placeholder_new.jpg');
		card.title = record.repcontent.name;
		var icon = record.repcontent.icon || '';
		if (icon.indexOf('icon:') == 0) card.icon2 = 'ion-ios-bookmarks fblue';
		else card.icon = icon;
		card.url = record.recStateObj.url || null;
		card.isreport = true;
		card.not_before = record.raw_record.not_before;
		card.not_after = record.raw_record.not_after || '';
		card.updated = record.raw_record.updated || '';
		card.detailsavps = record.detailsavps;
		card.help = '';
		var date = new Date();
		if (card.type == 'expired') {
			card.progressPerc = record.stats.progressPerc;
			if(!card.progressPerc) card.progressPerc = 0;
			card.prgClass = 'nl-card2-progress-bar-barRed';	
			var date = nl.fmt.date2StrDDMMYYCard(card.not_after);
			if (date)
				card.help = nl.t('<div>Expired on {}</div>', date);
		}
		if (card.type == 'completed') {
			var date = null;
			card.label=record.stats.status.txt;
			if (card.not_after)	date = card.not_after;
			else if (record.raw_record.ended) date = record.raw_record.ended;
			if (!date) date = record.raw_record.updated;
			date = nl.fmt.date2StrDDMMYYCard(date);
			if (date)
				card.help = nl.t('<div>Finished on {}</div>', date);
		}
		if (card.type == 'upcoming') {
			var date = nl.fmt.date2StrDDMMYYCard(card.not_before);
			if (date)
				card.help = nl.t('<div>Starts on {}</div>', date);
			var duration = record.repcontent.max_duration;
			if (duration)
				card.help += nl.t('<div>Duration: {} mins</div>', duration);
		}
		if (card.type == 'pending') {		
			var not_after = card.not_after;	
			if (date < not_after) {
				var date = nl.fmt.date2StrDDMMYYCard(not_after);
				if (date)
					card.help = nl.t('<div>Ends on {}</div>', date);	
			}
			var duration = record.repcontent.max_duration;
			if (duration)
				card.help += nl.t('<div>Duration: {}</div>', duration);
		}
		if (card.type == 'progress') {
			card.prgClass = 'nl-card2-progress-bar-barGreen';	
			card.progressPerc = record.stats.progressPerc;	
			if(!card.progressPerc) card.progressPerc = 0;
			if(card.progressPerc == 100) card.progressPerc = 99;
			var not_after = card.not_after;	
			if (date < not_after) {
				var date = nl.fmt.date2StrDDMMYYCard(not_after);
				if (date)
					card.help = nl.t('<div>Ends on {}</div>', date);
			}
			if (record.type == 'module') {
				var timeSpentSec = record.stats.timeSpentSeconds;
				var maxDurationSec = record.repcontent.max_duration*60 || 0;
				if (maxDurationSec) {
					var timeLeft = maxDurationSec - timeSpentSec;
					var timeString=timeinseconds(timeLeft);
					card.help += nl.t('<div>{} mins remaining</div>', timeString);	
				} else {
					var timeSpentMins = timeSpentSec;
					var timeString=timeinseconds(timeSpentMins);
					card.help += nl.t('<div>Total time spent: {}</div>', timeString);
				}
			} else {
				if (record.stats.timeSpent)
				    var timeObj=record.stats.timeSpent/60;
					var timeString=timeinseconds(timeObj);
					card.help += nl.t('<div>Total time spent: {}</div>', timeString);	
			}
		}
		return card;
	}

	function timeinseconds(timeObj) {
		if(!timeObj) return '00:00:00';
		var hours = Math.floor(timeObj / 3600); 
		var minutes = Math.floor((timeObj - (hours * 3600)) / 60); 
		   var seconds = timeObj - (hours * 3600) - (minutes * 60)
		var timeString = hours.toString().padStart(2, '0') + ':' + 
						 minutes.toString().padStart(2, '0') + ':' + 
						 seconds.toString().padStart(2, '0');
		return timeString;
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
		var user = _userInfo || {};
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

	function _updateExploreTab() {
		$scope.exploreCards = _userInfo.dashboard_props.explore || [];
		var currentTheme = _userInfo.settings.userCustomClass;
		for(var i=0;i<$scope.exploreCards.length;i++) {
			$scope.exploreCards[i].hideCardList = true;
			$scope.exploreCards[i].activeCardContainer = false;
			if(currentTheme == 'nllightmode') {
				$scope.exploreCards[i].openDlgBtn = nl.url.lessonIconUrl('down-arrow-dark.svg');
				$scope.exploreCards[i].dropdownBtn = nl.url.lessonIconUrl('drop-down-arrow.svg');
				$scope.exploreCards[i].uparrownBtn = nl.url.lessonIconUrl('up-arrow.svg');
				$scope.exploreCards[i].buttonUrl = nl.url.lessonIconUrl('start-dark.svg');
			}
			if(currentTheme == 'nldarkmode') {
				$scope.exploreCards[i].openDlgBtn = nl.url.lessonIconUrl('down-arrow.svg');
				$scope.exploreCards[i].dropdownBtn = nl.url.lessonIconUrl('drop-down-arrow-dark.svg');
				$scope.exploreCards[i].uparrownBtn = nl.url.lessonIconUrl('up-arrow-dark.svg');
				$scope.exploreCards[i].buttonUrl = nl.url.lessonIconUrl('start.svg');
			}
		}
	}
    
	$scope.fetchTheExploreSectionCards = function(card, ret, fetchMore, resolve, activecard) {
		if (!card.cardlist) card.cardlist = [];
		if (!card.masterCopy) card.masterCopy = [];
		if(!card.showSearchbar);
		card.hideCardList=true;
		for(var i=0; i<$scope.exploreCards.length; i++) {
			$scope.exploreCards[i].activeCardContainer = false;
			if(i != activecard) {
				$scope.exploreCards[i].activeCardContainer = !$scope.exploreCards[i].activeCardContainer;
			}
		}
		card.showSearchbar = $scope.tabData.showSearchbar;
		card.nodataimg = $scope.nodata;
		if (card.cardlist.length > 0 ) {
			card.hideCardList = !card.hideCardList;
			return;
		}
		if (!card.ret) card.ret = ret
		if (!card.params) card.params = {metadata: card.ret};
		if (!card._pageFetcher) card._pageFetcher = nlServerApi.getPageFetcher({defMax: 100});
		card.listingFn = nlServerApi.lessonGetApprovedList;
		_getDataFromServerForExploreSection(card, fetchMore);
	}

	function _getDataFromServerForExploreSection(card, fetchMore, resolve) {
		card._pageFetcher.fetchPage(card.listingFn, card.params, fetchMore, function(results) {
            if (!results) {
                if (resolve) resolve(false);
                return;
			}
			var cards = _getLessonCards(_userInfo, results)
			card.masterCopy = card.masterCopy.concat(cards);
			card.cardlist = card.cardlist.concat(cards);
			card.name = card.title;
			card.canFetchMore = card._pageFetcher.canFetchMore();
			card._onClickOnFetchMore = _onClickOnFetchMoreFn;
			card.onCardLinkClicked = _onCardLinkClickedFn;
			card.onCardInternalUrlClicked = _onCardInternalUrlClickedFn;
			card.onClickOnNextFn = _onClickOnNextFn;
			card.onClickOnPrevFn = _onClickOnPrevFn;
			card.canShowNext = _canShowNext;
			card.canShowPrev = _canShowPrev;
			card.getVisibleString = _getVisibleString;
			card.showAndHide = _showAndHide;
			card.hideCardList = false;
            card.canSort = _canSort;
			card.type = 'explore';	
			if (resolve) resolve(true);
		});	
	}

	function _showAndHide(cards) {
		cards.hideCardList = !cards.hideCardList;
		$scope.tabData.showSearchbar = false;
	}
	function _onClickOnFetchMoreFn(card, fetchMore) {
		_getDataFromServerForExploreSection(card, fetchMore, null);
	}

	function _getLessonCards(userInfo, cardlist) {
		var cards = [];
		for (var i = 0; i < cardlist.length; i++)
		cards.push(_createLessonCard(cardlist[i], userInfo));
        cards.sort(function(a, b) {
            return (b.updated - a.updated);
        });
		return cards;
	}
	
	function _createLessonCard(lesson, userInfo) {
        var card = {
            lessonId : lesson.id,
            updated: nl.fmt.json2Date(lesson.updated),
            grp: lesson.grp,
            title : lesson.name,
            subject : lesson.subject,
            grade : lesson.grade,
            icon : nl.url.lessonIconUrl(lesson.image),
            authorName : lesson.authorname,
            remarks : lesson.description,
            esttime : lesson.esttime,
            children : [],
			links: [],
			openDlgBtn : $scope.exploreCards[0].openDlgBtn,
			dropdownBtn : $scope.exploreCards[0].dropdownBtn,
			uparrownBtn : $scope.exploreCards[0].uparrownBtn,
			buttonUrl : $scope.exploreCards[0].buttonUrl,
			canShowLaunchbutton : true,
            details: {help: lesson.description, avps: _getLessonListAvps(lesson)},
        };
		card.repcontent = card;
		card.repcontent.name=card.title;
		card.detailsavps = _getLessonListAvps(lesson);
		card.url = nl.fmt2('/lesson/do_report_selfassign?lessonid={}', lesson.id);
        _updateLinks(card, lesson, userInfo);
		return card;
	}	
	function _updateLinks(card, lesson, userInfo) {
            if (lesson.grp == _userInfo.groupinfo.id && userInfo.permissions.lesson_create 
                && userInfo.permissions.lesson_copy)
                card.links.push({id : 'lesson_copy', text : nl.t('copy')});
            card.links.push({id : 'lesson_report', text : nl.t('report')});
           
    }
	function _getLessonListAvps(lesson) {
        var avps = [];
        nl.fmt.addAvp(avps, 'Author', lesson.authorname);
		nl.fmt.addAvp(avps, 'Approved by', lesson.approvername);		
        nl.fmt.addAvp(avps, 'REMARKS', lesson.description);
		nl.fmt.addAvp(avps, 'Approved on', lesson.approvedon, 'date');
        nl.fmt.addAvp(avps, 'Internal identifier', lesson.id);
        return avps;
    }
	
	function _statsDetails() {
		showTimeSpent();
		var _groupInfo = nlGroupInfo.get();
		var _userid = _userInfo.userid;
		var data = {grpid: _groupInfo.grpid, table: 'learningcredits', recid: 'users', field: _userid+'.json'};
		$scope.tabData.defaultUser = nl.url.lessonIconUrl('default-user.png');
		nl.timeout(function() {
			nlServerApi.jsonFieldStream(data).then(function(resp) {
				if (!resp || !resp.data) {
					nlDlg.popupStatus('Some error occured while downloading ...', false);
					return;
				}
				$scope.tabData.currentlearnerStats.push(resp.data);
				$scope.tabData.currentlearnerStats[0].lcredits7 = resp.data.lcredits7 > 999 ? nFormatter(resp.data.lcredits7) : resp.data.lcredits7;
				$scope.tabData.currentlearnersevenDaysrank = resp.data.lrank7;
				$scope.tabData.currentlearnerStats[0].lcredits30 = resp.data.lcredits30 > 999 ? nFormatter(resp.data.lcredits30) : resp.data.lcredits30;
				$scope.tabData.currentlearnerthirtyDaysrank = resp.data.lrank30;
				$scope.tabData.currentlearnerStats[0].lcredits90 = resp.data.lcredits90 > 999 ? nFormatter(resp.data.lcredits90) : resp.data.lcredits90;
			    $scope.tabData.currentlearnernintyDaysrank = resp.data.lrank90;
				_leaderboard(resp.data, _groupInfo);
			})
		})
	}

	function nFormatter(n) {
		var pow = Math.pow, floor = Math.floor, abs = Math.abs, log = Math.log;
		var abbrev = 'kmb'; // could be an array of strings: [' m', ' Mo', ' Md']

		var base = floor(log(abs(n))/log(1000));
		var suffix = abbrev[Math.min(2, base - 1)];
		base = abbrev.indexOf(suffix) + 1;
		return suffix ? round(n/pow(1000,base),2)+suffix : ''+n;

		function round(n, precision) {
			var prec = Math.pow(10, precision);
			return Math.round(n*prec)/prec;
		}
   }

	function showTimeSpent() { 
		var timeSpentArr = nlLearnerViewTimeSpent.show();
		$scope.tabData.tsnintydays = timeSpentArr[0]; //time spent last 90 days
		$scope.tabData.tsthirtydays = timeSpentArr[1]; //time spent last 30 days
		$scope.tabData.tssevendays = timeSpentArr[2]; //time spent last 90 days		
	}

	function _leaderboard(data, _groupInfo) {
		var cohort = data.cohort;
		var _ldata = {grpid: _groupInfo.grpid, table: 'learningcredits', recid: 'cohorts', field: cohort+'.json'};
		nl.timeout(function() {
			    nlServerApi.jsonFieldStream(_ldata).then(function(resp) {
				if (!resp || !resp.data) {
					nlDlg.popupStatus('Some error occured while downloading ...', false);
					return;
				}
		 		_ShowTopOnLeaderBoard(resp.data);
			})
		})			
	}

	function _ShowTopOnLeaderBoard(data) {
		_getdatarankwise(data.lb7, $scope.tabData.currentlearnerStats[0].lrank7, 7);
		_getdatarankwise(data.lb30, $scope.tabData.currentlearnerStats[0].lrank30, 30);
		_getdatarankwise(data.lb90, $scope.tabData.currentlearnerStats[0].lrank90, 90);
	}

	function _getdatarankwise(data, currentUserrank, pastdays) {
		if(!data.length) return;
		var topLearner = 10; 
		var length = currentUserrank > topLearner ? 9 : topLearner;
		length = data.length > topLearner ? length : data.length;
		var i = 0;
		var currentlearnerClass, currentlearnerbg, username, currentlearnerintopten = false;
		for(i ; i < length; i++) {
			if(data[i].userid == $scope.tabData.currentlearnerStats[0].userid) currentlearnerintopten = true;
			currentlearnerClass = data[i].userid == $scope.tabData.currentlearnerStats[0].userid ?  'currentlearner' : '';
			currentlearnerbg = data[i].userid == $scope.tabData.currentlearnerStats[0].userid ?  'currentlearnerbg' : '';
		    username = data[i].username.split(' ').length > 4 ? maxfourwords(data[i].username) : data[i].username;
		   _StoreDataInLeaderBoard(pastdays, data, i, username, currentlearnerClass, currentlearnerbg);
		}
		if(!currentlearnerintopten) {
			var rank = getNumberWithOrdinal(currentUserrank);
			var cusername = $scope.tabData.currentlearnerStats[0].username;
			username = cusername.split(' ').length > 4 ? maxfourwords($scope.tabData.currentlearnerStats[0].username) : cusername;
			_CurrentUserDataInLeaderBoard(pastdays, rank, username);
		}
	}

	function getNumberWithOrdinal(rank) {
		var s = ["th", "st", "nd", "rd"],
			v = rank % 100;
		return rank + (s[(v - 20) % 10] || s[v] || s[0]);
	}

	function maxfourwords(username) {
		var wordsArray= username.split(" ");
		var res= '';
		for(var i=0; i < 4; i ++ ) {
			res = res + wordsArray[i] + " ";
		}
		return res.trim();
	}

	function _StoreDataInLeaderBoard(pastdays, data, i, username, currentlearnerClass, currentlearnerbg) {
		if(pastdays == 7) {
			data[i].lrank7 = getNumberWithOrdinal(data[i].lrank7);
			$scope.tabData.leaderBoardData[0].userData.push({'username' : username, 'lrank':data[i].lrank7,'lcredits':data[i].lcredits7, 'currentlearner': currentlearnerClass, 'currentlearnerbg': currentlearnerbg})
		}	
		else if(pastdays == 30) {
			data[i].lrank30 = getNumberWithOrdinal(data[i].lrank30);
			$scope.tabData.leaderBoardData[1].userData.push({'username' : username, 'lrank':data[i].lrank30,'lcredits':data[i].lcredits30, 'currentlearner': currentlearnerClass, 'currentlearnerbg': currentlearnerbg})
		}
		else {
			data[i].lrank90 = getNumberWithOrdinal(data[i].lrank90);
			$scope.tabData.leaderBoardData[2].userData.push({'username' : username, 'lrank':data[i].lrank90,'lcredits':data[i].lcredits90, 'currentlearner': currentlearnerClass, 'currentlearnerbg': currentlearnerbg})
		}
	}

	function _CurrentUserDataInLeaderBoard(pastdays, currentUserrank, username) {
		if(pastdays == 7) {
			$scope.tabData.leaderBoardData[0].userData.push({'username' : username , 'lrank': currentUserrank ,'lcredits':$scope.tabData.currentlearnerStats[0].lcredits7, 'currentlearner': 'currentlearner','currentlearnerbg': 'currentlearnerbg'})
		}	
		else if(pastdays == 30) {
			$scope.tabData.leaderBoardData[1].userData.push({'username' : username , 'lrank': currentUserrank, 'lcredits':$scope.tabData.currentlearnerStats[0].lcredits30, 'currentlearner': 'currentlearner','currentlearnerbg': 'currentlearnerbg'})
		}
		else {
			$scope.tabData.leaderBoardData[2].userData.push({'username' :  username , 'lrank': currentUserrank, 'lcredits':$scope.tabData.currentlearnerStats[0].lcredits90, 'currentlearner': 'currentlearner','currentlearnerbg': 'currentlearnerbg'})
		}
	}

	$scope.slideshow = function(n) {
		var i;
		var slides = nl.window.document.getElementsByClassName("leaderboard");
		if (n > slides.length) {$scope.tabData.slideIndex = 1}
		if (n < 1) {$scope.tabData.slideIndex = slides.length}
		for (i = 0; i < slides.length; i++) {
			slides[i].classList.add("hide-in-small");	
			slides[i].classList.remove("show-in-small");	
		}
		slides[$scope.tabData.slideIndex-1].classList.add("show-in-small");
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
		var darkmode = false;
		if (_userInfo.groupinfo.groupCustomClass == 'nldarkmode') darkmode = true;
		if (darkmode) {
			$scope.charts[1].options.scales.xAxes[0].gridLines = {display: true, color: "#A0A0C0"},
			$scope.charts[1].options.scales.xAxes[0].ticks.fontColor = "#FFFFFF"
			$scope.charts[1].options.scales.yAxes[0].gridLines = {display: true, color: "#A0A0C0"},
			$scope.charts[1].options.scales.yAxes[0].ticks = {fontColor: "#FFFFFF", 'beginAtZero': true}
		}
		var doughnutChart = $scope.charts[0];
		doughnutChart.data = [0, 0, 0, 0];
		var timeChart = $scope.charts[1];
		var lineChart = $scope.charts[2];

		var ranges = nlLearnerViewRecords2.getTimeRanges();
		var records = $scope.tabData.records;
		var tabs= $scope.tabData.tabs;
		for(var tabid in tabs) {
			var tab = tabs[tabid];
			if(!tab) continue;
            if(tab.id == "expired") {
				doughnutChart.data[4] = tab.count;
			}
			else if(tab.id == "upcoming") {
				doughnutChart.data[3] = tab.count;
			}
			else if(tab.id == "progress") {
				doughnutChart.data[2] = tab.count;
			}
			else if(tab.id == "pending") {
				doughnutChart.data[1] = tab.count;
			}
			else {
				doughnutChart.data[0] = tab.count;
			}
		}
		for (var recid in records) {
			var rec = records[recid];
			if(!rec) continue;
			var ended = isModuleRep ? _getModuleEndedTime(rec.raw_record) : _getCourseEndedTime(rec);
			//temp failed and completed
			// if(!ended) continue;
			// for(var i=0; i<ranges.length; i++) {
			// 	if (_isTsInRange(rec.raw_record.updated, ranges[i])) {
			// 		if(rec.stats.status.txt == 'failed') ranges[i].count++;
			// 		else ranges[i].completed++;
			// 		break;
			// 	}
			// }

			_updateCoursesDetailsDict(rec, learningCounts);
			var isModuleRep = rec.type == 'module';
			var ended;
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
		lineChart.labels = [];
		lineChart.data = [];
		timeChart.labels = [];
		timeChart.data = [[], []];
		for (var i=0; i<ranges.length; i++) {
			var r = ranges[i];
			timeChart.labels.push(r.label);
			timeChart.data[0].push(r.count);
			timeChart.data[1].push(r.completed);
			lineChart.labels.push(r.label);
			lineChart.data.push(r.completed)
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
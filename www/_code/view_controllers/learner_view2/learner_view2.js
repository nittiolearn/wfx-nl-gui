(function() {
	// learner_view.js: Common service to display learner view records
	// All other subservices defined in this folder (service names starting from nlLearnerView***)
	// are only used within this module.
	// nl.LearnerViewCtrl: the controller implementing /#/learner_view URL. It simply
	// 						   delegates to nlLearnerView service.

function module_init() {
	angular.module('nl.learner_view2', ['nl.learner_view_records2'])
	.config(configFn)
	.directive('nlLearnerViewTopSection', LearnerViewTopSectionDirective)
	.directive('nlLearnerSection2', LearnerSectionDirective2)
	.directive('nlLearningStatusCounts2', LearningStatusCountsDirective2)
	.directive('nlLearningStats', LearningStats)
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

var LearnerViewTopSectionDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/learner_view2/learner_top_section.html',
        scope: {
			tabdata: '='
		},
        link: function($scope, iElem, iAttrs) {
			$scope.rightArrow = nl.url.lessonIconUrl('right-arrow.svg');
			$scope.leftArrow = nl.url.lessonIconUrl('left-arrow.svg')
			$scope.onDetailsLinkClicked = function($event, record, clickAttr) {
                var detailsDlg = nlDlg.create($scope);
				detailsDlg.setCssClass('');
                detailsDlg.scope.record = record;
                detailsDlg.show('view_controllers/learner_view/learner_view_details.html');
			};
			$scope.toScroll = function(button) {
				if (button.count == 0) return;
				var anchorid = button.id;
				var scrollid = nl.t('anchor-{}', anchorid);
				if (scrollid) nl.location.hash(scrollid);
				nl.anchorScroll();
			};
			$scope.viewStatistics =function() {
				$scope.tabdata.summaryStats= true;
			};
			$scope.goback = function() {
				$scope.tabdata.summaryStats= false;
			};
			$scope.getImageResUrl = function(image) {
				return nl.url.lessonIconUrl(image);
			};
		}
	}
}];

//-------------------------------------------------------------------------------------------------
var LearnerSectionDirective2 = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/learner_view2/learner_section.html',
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
	$scope.pane = true;
	var learnerView = nlLearnerView2.create($scope);
	learnerView.show(true);
}];

//-------------------------------------------------------------------------------------------------

var NlLearnerView2 = ['nl', 'nlDlg', 'nlRouter', 'nlReportHelper',
'nlLearnerViewRecords2', 'nlTopbarSrv', 'nlCardsSrv', 'nlCourse', 'nlGetManyStore', 'nlAnnouncementSrv',
function(nl, nlDlg, nlRouter, nlReportHelper, nlLearnerViewRecords2, nlTopbarSrv, nlCardsSrv, nlCourse, nlGetManyStore, nlAnnouncementSrv) {
	this.create = function($scope) {
		return new NlLearnerViewImpl($scope, nl, nlDlg, this, nlRouter, nlReportHelper,
			nlLearnerViewRecords2, nlTopbarSrv, nlCardsSrv, nlCourse, nlGetManyStore, nlAnnouncementSrv);
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

function NlLearnerViewImpl($scope, nl, nlDlg, nlLearnerView, nlRouter, nlReportHelper, 
	nlLearnerViewRecords2, nlTopbarSrv, nlCardsSrv, nlCourse, nlGetManyStore, nlAnnouncementSrv) {
	var self = this;
	var _userInfo = null;
	var _parent = false;
	var _isHome = false;
	var _enableAnnouncements = false; 
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
		if (!_isHome) nlLearnerView.initPageBgImg(_userInfo);
		return nl.q(function(resolve, reject) {
			_init(userInfo);
			_getLearningRecordsFromCacheAndServer(resolve);
			if(_enableAnnouncements) _loadAndShowAnnouncements();
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
		_initChartData();
	}

	function _initChartData() {
		$scope.charts = [{
			show: false,
			type: 'pie',
			data: [0, 0, 0, 0],
			labels: ['Completed', 'Not started', 'Inprogress', 'Upcoming','Expired'],
			colors: [_nl.colorsCodes.done, _nl.colorsCodes.pending, _nl.colorsCodes.started, _nl.colorsCodes.blue1, _nl.colorsCodes.delayed ],
			options:{responsive: true, maintainAspectRatio: false,segmentShowStroke: false},
		},
		{
			show: false,
			type: 'bar',
			title: '',
			data: [[]],
			labels: [],
			series: ['Assigned', 'Completed'],
			colors: [_nl.colorsCodes.blue1, _nl.colorsCodes.done],
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
		var cardWidth = scope.w;
		var document = nl.window.document;
		var className = nl.t('nl-card-section-scroll-{}', cards.type);
		var element = document.getElementsByClassName(className);
		var num = Math.floor(element[0].clientWidth/cardWidth);
		var widthToScroll = num*cardWidth + num*16;
		var len = widthToScroll/5;
		var timeout = (cards.type == 'completed' || cards.type == 'expired') ? 120 : 50
		_callInLoop(0, len, element, 'add', timeout)
	}

	function _onClickOnPrevFn(cards, scope) {
		if (!cards) return;
		var cardWidth = scope.w;
		var document = nl.window.document;
		var className = nl.t('nl-card-section-scroll-{}', cards.type);
		var element = document.getElementsByClassName(className);
		var num = Math.floor(element[0].clientWidth/cardWidth);
		var widthToScroll = num*cardWidth + num*16;
		var len = widthToScroll/5;
		var timeout = (cards.type == 'completed' || cards.type == 'expired') ? 150 : 70
		_callInLoop(0, len, element, 'sub', timeout)
	}

	function _callInLoop(startpos, len, element, type, timeout) {
		startpos += 1;
		nl.timeout(function() {
			if (type == 'add')
				element[0].scrollLeft += len;
			else
				element[0].scrollLeft -= len;
			if (startpos < 5) _callInLoop(startpos, len, element, type, timeout)
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
		if (!card.url) return;
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
		detailsDlg.setCssClass('');
		var name = card.repcontent.name;
		if (name.length > 20)
			name = name.substring(0, 20) + '...';
		detailsDlg.scope.pageTitle = name;
		detailsDlg.scope.record = card;
		detailsDlg.show('view_controllers/learner_view/learner_view_details.html');
	}
	function _initData() {
		var ret = {};
		ret.dataLoaded = false;
		ret.learningCounts = {};
		ret.search = '';
		ret.lastSeached = '';
		ret.filter = 'active';
		ret.searchPlaceholder = 'Search';
		ret.records = null; 
		ret.recordsLen = 0;
		ret.summaryStats = false;
		ret.summaryStatSummaryRow = null;
		ret.onSearch = _onSearch;
		ret.onFilter = _onFilter;
		ret.fetchMore = _fetchMore;
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
		return ret;
	}
	
	function _onSearch(event) {
		if (event && event.which !== 13) return;
		var tabData = $scope.tabData;
		if (tabData.lastSeached == tabData.search) return;
		tabData.lastSeached = tabData.search;
		_updateLearningRecords();
	}

	function _onFilter(event, filter) {
		var tabData = $scope.tabData;
		if (tabData.filter == filter) return;
		tabData.filter = filter;
		_updateLearningRecords();
	}

	function _fetchMore(event) {
		if (!$scope.tabData.canFetchMore) return;
		nlLearnerViewRecords2.fetchNextChunkFromServer(function(canFetchMore) {
			_updateTabDataWithRecords(canFetchMore);
		});
	}

	function _getLearningRecordsFromCacheAndServer(resolve) {
		var bResolved = false;
		nlLearnerViewRecords2.initFromCache(function(dataFound) {
			if (!dataFound) {
				nlLearnerViewRecords2.fetchLatestChunkFromServer(function(canFetchMore) {
					_updateTabDataWithRecords(canFetchMore);
					resolve(true);
				});
				return;
			}
			_updateTabDataWithRecords(true);
			resolve(true);
			nlLearnerViewRecords2.updateCachedRecords(function(dataChanged, canFetchMore) {
				if (dataChanged) _updateTabDataWithRecords(canFetchMore);
			});
		});
	}

	function _updateTabDataWithRecords(canFetchMore) {
		$scope.tabData.dataLoaded = true;
		$scope.tabData.records = nlLearnerViewRecords2.getRecords();
		$scope.tabData.recordsLen = Object.keys($scope.tabData.records).length;
		$scope.tabData.canFetchMore = canFetchMore;
		_updateCurrentTab();
	}

	function _updateCurrentTab() {
		_updateLearningRecords();
		for(var i=0; i<$scope.tabData.sectionData.length; i++) {
			var cards = $scope.tabData.sectionData[i];
			nlCardsSrv.updateCards(cards, {});
		}
		_updateSummaryTab();
	}
    
	function _updateLearningRecords() {
		//TODO: Naveen - Rename and change this to UpdateLearningCards
		$scope.tabData.sectionData = _getFilteredRecords();
	}

	var SEC_POS = {'progress': 0, 'pending': 1, 'upcoming': 2, 'completed': 3, 'expired': 4};
	var CARD_SIZE = {0: 'L', 1: 'M', 2: 'M', 3: 'S', 4: 'S'};
	var LAUNCH_BUTTON = {'progress': 'start.svg', 'pending': 'start.svg', 'upcoming': '', 'completed': 'preview.svg', 'expired': 'info.svg'};
    
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
		if (LAUNCH_BUTTON[card.type]) {
			card.buttonUrl = nl.url.lessonIconUrl(LAUNCH_BUTTON[card.type]);
		}
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
		return card;
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
(function() {

//-------------------------------------------------------------------------------------------------
// assign_rep.js:
// TODO-LATER-123: Move this to /#/learning_reports
// Assignment reports controller to list assignment reports of a given lesson assignment
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.assign_rep', [])
    .config(configFn)
    .service('nlRangeSelectionDlg', NlRangeSelectionDlg)
    .controller('nl.AssignRepCtrl', getController('assignment'))
    .controller('nl.AssignSummaryRepCtrl', getController('group'))
    .controller('nl.AssignUserRepCtrl', getController('user'));
}
   
//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.assignment_report', {
        url: '^/assignment_report',
        views: {
            'appContent': {
				templateUrl : 'lib_ui/cards/cardsview.html',
                controller: 'nl.AssignRepCtrl'
            }
        }});
    $stateProvider.state('app.assignment_summary_report', {
        url: '^/assignment_summary_report',
        views: {
            'appContent': {
                templateUrl : 'lib_ui/cards/cardsview.html',
                controller: 'nl.AssignSummaryRepCtrl'
            }
        }});
    $stateProvider.state('app.assignment_user_report', {
        url: '^/assignment_user_report',
        views: {
            'appContent': {
                templateUrl : 'lib_ui/cards/cardsview.html',
                controller: 'nl.AssignUserRepCtrl'
            }
        }});
}];

//-------------------------------------------------------------------------------------------------
var DEFAULT_MAX_LIMIT=5000;

function TypeHandler(reptype, nl) {
    var self = this;
	this.initFromUrl = function() {
		var params = nl.location.search();
        self.limit = ('limit' in params) ? params.limit 
            : (reptype == 'user') ? 50
            : (reptype == 'group') ? DEFAULT_MAX_LIMIT
            : null;

		if (reptype == 'assignment') {
            self.assignid = ('assignid' in params) ? parseInt(params.assignid) : null;
            if (!self.assignid) return false;
		} else if (reptype == 'user') {
            self.userid = ('userid' in params) ? params.userid : null;
		}
        return true;
	};

	this.getAssignmentReportsParams = function(dateRange) {
		var data = {reptype: reptype};
		if (reptype == 'assignment') {
		    data.assignid = self.assignid;
		} else if (reptype == 'user') {
            data.userid = self.userid;
            data.completed = true;
		} else if (reptype == 'group' && dateRange) {
		    data.createdfrom = dateRange.updatedFrom;
		    data.createdtill = dateRange.updatedTill;
		}
		return data;
	};

	this.pageTitle = function(rep) {
        if (reptype == 'group') return nl.t('Assignment Summary Report');
	    var name = rep ? nl.fmt2(': {}', (reptype == 'user') ? nl.pginfo.username : rep.name) : '';
	    return nl.t('Assignment Report{}', name);
	};
};

//-------------------------------------------------------------------------------------------------
function getController(ctrlType) {
	return [
		'nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi', 'nlAssignReportStats',
		'nlGroupInfo', 'nlRangeSelectionDlg',
		function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, nlAssignReportStats,
			nlGroupInfo, nlRangeSelectionDlg) {
	    _assignRepImpl(ctrlType, nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, 
	    	nlAssignReportStats, nlGroupInfo, nlRangeSelectionDlg);
	}];
}

//-------------------------------------------------------------------------------------------------
function _assignRepImpl(reptype, nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, 
	nlAssignReportStats, nlGroupInfo, nlRangeSelectionDlg) {
	var _userInfo = null;
	var my = 0;
	var search = null;
	var mode = new TypeHandler(reptype, nl);
	var reportStats = null;
	var nameAndScore = [];
	var dateRange = null;

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		nlRangeSelectionDlg.init();
		return nl.q(function(resolve, reject) {
    		if (!mode.initFromUrl()) {
                nlDlg.popupStatus('Incorect parameters');
    		    resolve(false);
    		    return;
    		}
    		$scope.cards = {
                search: {placeholder: nl.t('Name/{}/Remarks/Keyword', _userInfo.groupinfo.subjectlabel)}
    		};
            if(reptype == 'group') $scope.cards.toolbar = _getToolbar();
            nlCardsSrv.initCards($scope.cards);
            nl.pginfo.pageTitle = mode.pageTitle(); 
            nlGroupInfo.init().then(function() {
                nlGroupInfo.update();
	            if(reptype == 'group') {
	            	_showRangeSelection(resolve);
	            } else {
	                _getDataFromServer(resolve);
	            }
            }, function() {
                resolve(false);
            });
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

	function _getToolbar() {
		return [{
			title : 'Get reports for required date/time range',
			icon : 'ion-android-time',
			onClick : _onDatetimeIconClick
		}];
	}

	function _onDatetimeIconClick() {
        if(_pageFetcher.fetchInProgress()) {
            nlDlg.popupAlert({title: 'Data still loading', 
                content: 'Still loading data from server. Please change date/time after the complete data is loaded.'});
            return;
        }
        _showRangeSelection(null);
	}
        
	function _showRangeSelection(resolve) {
	    nlRangeSelectionDlg.show($scope, true).then(function(data) {
	        if (!data) {
                if (resolve) resolve(false);
                return;
	        }
            nlDlg.showLoadingScreen();
            dateRange = data;
            _getDataFromServer(resolve);
	    });
	}

	$scope.onCardLinkClicked = function(card, linkid) {
		if(linkid == 'assignment_update'){
			nl.window.location.href = nl.t('/lesson/update_report_assign/{}', card.id);
		} else if(linkid == 'assignment_content'){
			nl.window.location.href = nl.t('/lesson/view_assign/{}', mode.assignid);
        } else if(linkid == 'assignment_export') {
            _assignmentExport($scope);
        } else if(linkid == 'status_overview'){
            _statusOverview();
        } else if (linkid === 'fetch_more') {
            _fetchMore();
		}
	};

	$scope.onCardInternalUrlClicked = function(card, internalUrl) {
	    $scope.onCardLinkClicked(card, internalUrl);
	};	

    function _fetchMore() {
        _getDataFromServer(null, true);
    }
    
    var _pageFetcher = nlServerApi.getPageFetcher();
	function _getDataFromServer(resolve, fetchMore) {
	    if (!fetchMore) {
            nlCardsSrv.updateCards($scope.cards, {cardlist: [], staticlist: []});
            reportStats = nlAssignReportStats.createReportStats(reptype, $scope);
	    }
	    var params = mode.getAssignmentReportsParams(dateRange);
        _pageFetcher.fetchBatchOfPages(nlServerApi.assignmentReport, params, fetchMore, function(results, batchDone) {
            if (!results) {
                if (resolve) resolve(false);
                return;
            }

            results = reportStats.updateReports(results);
            _appendAssignmentReportCards(results, $scope.cards.cardlist);
            if ($scope.cards.staticlist.length == 0 && results.length > 0) {
                _appendChartCard($scope.cards.staticlist);
            }
            _updateChartCard(reportStats);
            _updateStatusOverview();

            nlCardsSrv.updateCards($scope.cards, {
                canFetchMore: !_pageFetcher.fetchInProgress() && _pageFetcher.canFetchMore(),
                fetchInProgress: _pageFetcher.fetchInProgress()
            });
            if (resolve) resolve(true);
        }, mode.limit);
	}
	
	function _appendAssignmentReportCards(resultList, cardlist) {
		for (var i = 0; i < resultList.length; i++) {
			var card = _createReportCard(resultList[i]);
			cardlist.push(card);
		}
		cardlist.sort(function(a, b) {
			if (reptype != 'user') return (b.updated - a.updated);
			if (a.statusOrder == b.statusOrder) return (a.created - b.created);
			return a.statusOrder - b.statusOrder;
		});
	}
	
	function _createReportCard(report) {
        var status = reportStats.getStatusInfo()[report._statusStr];
		var card = {
			id : report.id,
			title : (reptype == 'assignment') ? report.studentname : report.name,
			updated: report.updated,
			created: report.created,
			statusOrder: status.order,
			internalUrl: null, 
			url : null,
			children : []
		};
        var statusIcon = '';
		if (reptype == 'user') {
			statusIcon = nl.fmt2('<span class="fsh2 {}"></span>', status.icon);
			if (report.icon || report.image)
				card.icon = nl.url.lessonIconUrl(report.icon || report.image);
			else
				card.icon2 = status.icon;
			card.url = report.completed ? nl.fmt2('/lesson/view_report_assign/{}', report.id)
				: (report.assigntype == _nl.atypes.ATYPE_COURSE) ? null
				: nl.fmt2('/lesson/do_report_assign/{}', report.id);
		} else {
			card.url = report.completed ? nl.fmt2('/lesson/review_report_assign/{}', report.id) : null;
			card.icon2 = status.icon;
		}
			
        card['help'] = '';
        if (reptype == 'group') {
            card['help'] = nl.fmt2('<div class="nl-textellipsis padding-small"><b>{}</b></div>', 
                report.studentname);
        }
        card['help'] += nl.fmt2('<div class="nl-textellipsis row row-center padding0 margin0">{}<b class="padding-small">{}</b></div>', 
            statusIcon, status.txt);
        card.links = [];

		if(report.completed) {
		    if (reptype == 'assignment')
                card.links.push({id : 'assignment_update', text : nl.t('update')});
			if (report._percStr)
				card['help'] += nl.t('<div class="nl-textellipsis padding-small"><span class="fsh3">{}</span> ({} of {})</div>', report._percStr, report._score || 0, report._maxScore);
		}
		
        card.details = {help: card['help'], avps: reportStats.getReportAvps(report, reptype)};
        card.links.push({id: 'details', text: nl.t('details')});
		return card;
	}

    var _chartCard = null;
    function _appendChartCard(cards) {
        _chartCard = {
            title : nl.t('Please wait ...'),
            fullDesc : true,
            children: [],
            internalUrl: 'status_overview', 
            style : 'nl-bg-blue',
            doughnutData : [1],
            doughnutLabel : ['Loading'],
            doughnutColor : ['#DDDDFF'],
            doughnutOptions : {responsive: true, maintainAspectRatio: true},
            help: nl.t('<canvas class="chart chart-doughnut" style="width: 100%; height: 100%" chart-data="card.doughnutData" chart-labels="card.doughnutLabel" chart-colours="card.doughnutColor" chart-options="card.doughnutOptions"></canvas>')
        };
        _chartCard.links = [];
        if (reptype == 'assignment') _chartCard.links.push({id: 'assignment_content', text: 'content'});
        _chartCard.links.push({id: 'assignment_export', text: 'export'}),
        _chartCard.links.push({id: 'details', text: 'details'});
        _chartCard.details = {
            help : null,
            avps : null
        };
        cards.push(_chartCard);
    }

    function _updateChartCard(reportStats) {
        var lst = reportStats.getRecords();
        nl.pginfo.pageTitle = mode.pageTitle(lst.length > 0 ? lst[0] : null); 
        if (lst.length == 0) return;
        var stats = reportStats.getStats();
        var completed = stats.passed + stats.failed;
        _chartCard.title =nl.t('{} of {} completed', completed, stats.students);
        _chartCard.doughnutData = _getCompletionChartData(stats);
        _chartCard.doughnutLabel = ["completed", "completed but scored low", "not completed"];
        _chartCard.doughnutColor = ['#007700', '#FFCC00', '#A0A0C0'];
        _chartCard.dist = [_getPercDistribution(stats.percentages)];
        _chartCard.details.avps = _getAssignmentAvps(lst);
	}
	
    function _getCompletionChartData(stats) {
        return [stats.passed, stats.failed, stats.students - stats.passed - stats.failed];
    }
    
    function _getPercDistribution(percentages) {
        var dist = [];
        for(var i=0; i<10; i++) {
            dist.push(0);
        }

        for (var i=0; i<percentages.length; i++){
            var perc = percentages[i];
            perc = Math.ceil(perc/10);
            if (perc > 0) perc--;
            dist[perc]++;
        }
        return dist;
    }

	function _getAssignmentAvps(lst) {
	    var now = new Date();
	    var report = lst[0];
		var avps = [];
        var linkAvp = nl.fmt.addLinksAvp(avps, 'Operation(s)');
        _populateLinks(linkAvp);
        if (reptype == 'assignment') nl.fmt.addAvp(avps, 'Name', report.name);
        nl.fmt.addAvp(avps, 'Number of reports', lst.length);
        nl.fmt.addAvp(avps, 'Most recent update', lst[0].updated, 'datedelta');
        nl.fmt.addAvp(avps, 'Earliest update', lst[lst.length-1].updated, 'datedelta');
        if (reptype != 'assignment') return avps;
        reportStats.populateCommonAvps(report, avps, 'user');
		return avps;
	}

    function _populateLinks(linkAvp) {
        var d = new Date();
        if (reptype == 'assignment') nl.fmt.addLinkToAvp(linkAvp, 'content', nl.fmt2('/lesson/view_assign/{}', mode.assignid));
        nl.fmt.addLinkToAvp(linkAvp, 'export', null, 'assignment_export');
        nl.fmt.addLinkToAvp(linkAvp, 'charts', null, 'status_overview');
    }

    var statusOverviewDlg = null;
	function _statusOverview() {
		statusOverviewDlg = nlDlg.create($scope);
		statusOverviewDlg.setCssClass('nl-height-max nl-width-max');
        statusOverviewDlg.scope.filters = {ouUsers: {}, grades: {}, subjects: {}};
        statusOverviewDlg.scope.onFilter = function() {
            _showFilter(statusOverviewDlg.scope);
        };
        
		statusOverviewDlg.scope.data = {
            completionLabel: _chartCard.doughnutLabel,
            completionColor: _chartCard.doughnutColor,
            completionData: null,
            percDistLabel: ['10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%']
		};

        var cancelButton = {text: nl.t('Close')};
        statusOverviewDlg.show('view_controllers/assignment_report/status_overview_dlg.html', [], cancelButton, false);
        
        // angular-charts workaround to ensure height/width of canvas are correctly calculated
        // set the chart properties after the dialog box appears
        _updateStatusOverview();
	}

    function _updateStatusOverview() {
        if (!statusOverviewDlg) return;
        nl.timeout(function() {
            var s = statusOverviewDlg.scope;
            $scope.filtersPresent = reportStats.isFilterPresent($scope.filters);
            if ($scope.filtersPresent) {
                s.stats = reportStats.getFilteredStats($scope.filters);
                s.data.completionData = _getCompletionChartData(s.stats);
                s.data.percDistData = [_getPercDistribution(s.stats.percentages)];
            } else {
                s.stats = reportStats.getStats();
                s.data.completionData = _chartCard.doughnutData;
                s.data.percDistData = _chartCard.dist;
            }
        });
    }

    function _showFilter(scope) {
        var filterDlg = nlDlg.create($scope); // scope and $scope are different!
        filterDlg.setCssClass('nl-height-max nl-width-max');
        filterDlg.scope.subjectlabel = _userInfo.groupinfo.subjectlabel;
        filterDlg.scope.gradelabel = _userInfo.groupinfo.gradelabel;
        filterDlg.scope.filterOptions = reportStats.getFilterOptions($scope.filters);
        filterDlg.scope.reptype = reptype;

        var filterButton = {text: nl.t('Apply'), onTap: function(e) {
            $scope.filters = reportStats.getSelectedFilters(filterDlg.scope.filterOptions);
            _updateStatusOverview();
        }};

        var clearButton = {text: nl.t('Clear'), onTap: function(e) {
            $scope.filters = null;
            _updateStatusOverview();
        }};

        var cancelButton = {text: nl.t('Close')};

        filterDlg.show('view_controllers/assignment_report/report_filter_dlg.html', 
            [filterButton, clearButton], cancelButton, false);
    }
    
    function _assignmentExport($scope) {
        if(_pageFetcher.fetchInProgress()) {
            nlDlg.popupAlert({title: 'Data still loading', 
                content: 'Still loading data from server. Please export after the complete data is loaded.'});
            return;
        }
        nlAssignReportStats.export($scope, reportStats.getRecords(), _userInfo);
    }
}

//-------------------------------------------------------------------------------------------------
// TODO-LATER-123: Remove nlRangeSelectionDlg after every user is moved to /#/learning_reports
var NlRangeSelectionDlg = ['nl', 'nlDlg', function(nl, nlDlg) {
    var updatedTillDate = null;
    var updatedFromDate = null;

    this.init = function() {
        var day = 24*60*60*1000; // 1 in ms
        var now = new Date();
        var offset = now.getTimezoneOffset()*60*1000; // in ms
        now = Math.floor(now.getTime()/day)*day + offset; // Today 00:00 Hrs in local time
        updatedTillDate = new Date(now + day);
        updatedFromDate = new Date(now - (6 * day));
    };
    
    this.show = function($scope, isCreate) {
        if (!updatedTillDate || !updatedFromDate) this.init();
        var rangeSelectionDlg = nlDlg.create($scope);
        rangeSelectionDlg.setCssClass('nl-height-max nl-width-max');
        rangeSelectionDlg.scope.isCreate = isCreate;
        rangeSelectionDlg.scope.data = {updatedFrom: updatedFromDate, updatedTill: updatedTillDate};
        rangeSelectionDlg.scope.error = {};
        rangeSelectionDlg.scope.dlgTitle = nl.t('{} time range', isCreate ? 'Assignment sent' : 'Report updated');
        var button = {text: nl.t('Fetch'), onTap: function(e){
            if (!_validateInputs(rangeSelectionDlg.scope)) {
                if (e) e.preventDefault();
                return;
            }
            var sd = rangeSelectionDlg.scope.data;
            updatedTillDate = sd.updatedTill;
            updatedFromDate = sd.updatedFrom;
            return rangeSelectionDlg.scope.data;
        }};
        var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
            return false;
        }};
        return rangeSelectionDlg.show('view_controllers/assignment_report/range_selection_dlg.html', [button], cancelButton, false);
    };

    function _validateInputs(scope){
        scope.error = {};
        if (!scope.data.updatedFrom) return _validateFail(scope, 'updatedFrom', 'From date is mandatory');
        if (!scope.data.updatedTill) return _validateFail(scope, 'updatedTill', 'Till date is mandatory');
        if (scope.data.updatedFrom >= scope.data.updatedTill) return _validateFail(scope, 'updatedTill', 'Till date should be later than from date');
        return true;
    }
                    
    function _validateFail(scope, attr, errMsg) {
        return nlDlg.setFieldError(scope, attr, nl.t(errMsg));
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

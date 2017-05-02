(function() {

//-------------------------------------------------------------------------------------------------
// assign_rep.js:
// Assignment reports controller to list assignment reports of a given lesson assignment
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.assign_rep', [])
    .config(configFn)
    .controller('nl.AssignRepCtrl', AssignRepCtrl)
    .controller('nl.AssignSummaryRepCtrl', AssignSummaryRepCtrl)
    .controller('nl.AssignUserRepCtrl', AssignUserRepCtrl);
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
function TypeHandler(reptype, nl, nlServerApi, nlDlg) {
    var self = this;
	this.initFromUrl = function() {
		var params = nl.location.search();
        self.assignid = ('assignid' in params) ? parseInt(params.assignid) : null;
        self.userid = ('userid' in params) ? params.userid : null;
        self.max = ('max' in params) ? parseInt(params.max) : 50;
        self.max--;
        self.start_at = ('start_at' in params) ? parseInt(params.start_at) : 0;
        self.completed = ('completed' in params) ? parseInt(params.completed) != 0 : true;

        self.limit = ('limit' in params) ? params.limit : (reptype == 'user') ? 100: null;
        self.dataFetched = false;
        self.fetchedCount = 0;
	};

	this.getAssignmentReports = function(dateRange, callbackFn) {
	    _getAssignmentReports('', dateRange, callbackFn);
    };

    function _getAssignmentReports(filter, dateRange, callbackFn) {
		var data = {reptype: reptype, assignid : self.assignid, userid : self.userid, 
		    max: self.max, start_at: self.start_at, completed: self.completed};
		if (dateRange.updatedFrom) data.updatedFrom = dateRange.updatedFrom;
		if (dateRange.updatedTill) data.updatedTill = dateRange.updatedTill;
		if (filter) data.search = filter;
		nlServerApi.assignmentReport(data).then(function(result) {
            var more = (result.length > self.max);
            self.fetchedCount += result.length;
            if (self.limit && self.fetchedCount >= self.limit) more = false;
            self.start_at += result.length;
            var msg = nl.t('Got {} items from the server.{}', self.start_at, more ? 
                ' Fetching more items ...' : '');
            nlDlg.popupStatus(msg, more ? false : undefined);
            if (more) {
                _getAssignmentReports(filter, dateRange, callbackFn);
            }
            
            callbackFn(false, result, more);
            if (!more) self.dataFetched = true;
		}, function(error) {
            nlDlg.popupStatus(error);
            callbackFn(true, error, false);
		});
	}

	this.pageTitle = function(rep) {
        if (reptype == 'group') return nl.t('Assignment Summary Report');
	    var name = rep ? nl.fmt2(': {}', (reptype == 'user') ? nl.pginfo.username : rep.name) : '';
	    return nl.t('Assignment Report{}', name);
	};
};

//-------------------------------------------------------------------------------------------------
var AssignRepCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi', 'NlAssignReportStats',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, NlAssignReportStats) {
    _assignRepImpl('assignment', nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, NlAssignReportStats);
}];

//-------------------------------------------------------------------------------------------------
var AssignSummaryRepCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi', 'NlAssignReportStats',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, NlAssignReportStats) {
    _assignRepImpl('group', nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, NlAssignReportStats);
}];

//-------------------------------------------------------------------------------------------------
var AssignUserRepCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi', 'NlAssignReportStats',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, NlAssignReportStats) {
    _assignRepImpl('user', nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, NlAssignReportStats);
}];

//-------------------------------------------------------------------------------------------------
function _assignRepImpl(reptype, nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, NlAssignReportStats) {
	var _userInfo = null;
	var my = 0;
	var search = null;
	var mode = new TypeHandler(reptype, nl, nlServerApi, nlDlg);
	var reportStats = null;
	var nameAndScore = [];

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {
    		mode.initFromUrl();
    		$scope.cards = {};
            _addSearchInfo($scope.cards);
    		$scope.cards.emptycard = _getEmptyCard(nlCardsSrv);
            $scope.cards.cardlist = [];
            $scope.cards.staticlist = [];
            reportStats = NlAssignReportStats.createReportStats(reptype);
            nl.pginfo.pageTitle = mode.pageTitle(); 
            reportStats.init().then(function() {
	            if(reptype == 'group') {
	            	_showRangeSelection(resolve);
	            } else {
	                _getDataFromServer(null, resolve);
	            }
            }, function() {
                resolve(false);
            });
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    var rangeSelectionDlg = null;
	function _showRangeSelection(resolve) {
		rangeSelectionDlg = nlDlg.create($scope);
		rangeSelectionDlg.setCssClass('nl-height-max nl-width-max');
		rangeSelectionDlg.scope.data = {updatedFrom: '', updatedTill: ''};
		rangeSelectionDlg.scope.error = {};
		rangeSelectionDlg.scope.dlgTitle = nl.t('Select range of updated time');
		var button = {text: nl.t('Get reports'), onTap: function(e){
			if (!_validateInputs(rangeSelectionDlg.scope)) {
				if (e) e.preventDefault();
				return null;
			}
			_getDataFromServer(rangeSelectionDlg.scope.data, resolve);
		}};

        var cancelButton = {text: nl.t('Close')};
        rangeSelectionDlg.show('view_controllers/assignment_report/range_selection_dlg.html', [button], cancelButton, false);
	}

	function _validateInputs(scope){
		scope.error = {};
		if (!scope.data.updatedFrom) return _validateFail(scope, 'updatedFrom', 'From date is mandatory');
		if (!scope.data.updatedTill) return _validateFail(scope, 'updatedTill', 'Till date is mandatory');
		if (scope.data.updatedFrom >= scope.data.updatedTill) return _validateFail(scope, 'updatedTill', 'Till date should be less than from date');
		return true;
	}
					
	function _validateFail(scope, attr, errMsg) {
		return nlDlg.setFieldError(scope, attr, nl.t(errMsg));
	}

	function _getEmptyCard(nlCardsSrv) {
		var help = help = nl.t('There are no assignments to display.');
		return nlCardsSrv.getEmptyCard({
			help : help
		});
	}

	$scope.onCardLinkClicked = function(card, linkid) {
		if(linkid == 'assignment_update'){
			nl.window.location.href = nl.t('/lesson/update_report_assign/{}', card.id);
		} else if(linkid == 'assignment_share') {
			_assignmentShare($scope, card);
		} else if(linkid == 'assignment_content'){
			nl.window.location.href = nl.t('/lesson/view_assign/{}', mode.assignid);
        } else if(linkid == 'assignment_export') {
            _assignmentExport($scope);
        } else if(linkid == 'status_overview'){
            _statusOverview();
		}
	};

	$scope.onCardInternalUrlClicked = function(card, internalUrl) {
	    $scope.onCardLinkClicked(card, internalUrl);
	};	

	function _getDataFromServer(dateRange, resolve) {
		mode.getAssignmentReports(dateRange, function(isError, result, more) {
		    if (isError) {
		        resolve(false);
		        return;
		    }
            reportStats.updateReports(result);
            _appendAssignmentReportCards(result, $scope.cards.cardlist);
            if ($scope.cards.staticlist.length == 0 && result.length > 0) {
                _appendChartCard($scope.cards.staticlist);
            }
            _updateChartCard(reportStats);
            _updateStatusOverview();
            resolve(true);
		});
	}
	
	function _appendAssignmentReportCards(resultList, cardlist) {
		for (var i = 0; i < resultList.length; i++) {
			var card = _createReportCard(resultList[i]);
			cardlist.push(card);
		}
		cardlist.sort(function(a, b) {
		    return (b.updated - a.updated);
		});
	}
	
	var _statusInfo = {
	    'pending' : {icon: 'ion-ios-circle-filled fgrey', txt: 'Pending'},
        'failed' : {icon: 'ion-alert-circled fyellow', txt: 'Scored low'},
        'completed' : {icon: 'ion-checkmark-circled fgreen', txt: 'Completed'}
	}
	function _createReportCard(report) {
	    var urlPart = (reptype == 'user' && report.student == _userInfo.userid)
	       ? 'view_report_assign' : 'review_report_assign';

        var status = _statusInfo[report._statusStr];
		var card = {
			id : report.id,
			title : (reptype == 'assignment') ? report.studentname : report.name,
			updated: report.updated,
			icon2 : status.icon,
			internalUrl: null, 
			url : report.completed ? nl.fmt2('/lesson/{}/{}', urlPart, report.id) : null,
			children : []
		};
        card['help'] = '';
        if (reptype == 'group') {
            card['help'] = nl.fmt2('<div class="nl-textellipsis padding-small"><b>{}</b></div>', 
                report.studentname);
        }
        card['help'] += nl.fmt2('<div class="nl-textellipsis padding-small"><b>{}</b></div>', 
            status.txt);
        card.links = [];

		if(report.completed) {
		    if (reptype == 'assignment')
                card.links.push({id : 'assignment_update', text : nl.t('update')},
                                {id : 'assignment_share', text : nl.t('share')});
			if (report._percStr)
				card['help'] += nl.t('<div class="nl-textellipsis padding-small"><span class="fsh3">{}</span> ({} of {})</div>', report._percStr, report._score || 0, report._maxScore);
		}
		
        card.details = {help: card['help'], avps: _getReportAvps(report)};
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
        nl.fmt.addAvp(avps, 'Most recent update', _fmtDateDelta(lst[0].updated, now));
        nl.fmt.addAvp(avps, 'Earliest update', _fmtDateDelta(lst[lst.length-1].updated, now));
        if (reptype != 'assignment') return avps;
        _populateCommonAvps(report, avps);
		return avps;
	}

    function _fmtDateDelta(d, now) {
        var dstr = nl.fmt.date2Str(d, 'minute');
        var diff = (now.getTime() - d.getTime())/1000/3600/24;
        if (diff < 2) return dstr;
        return nl.fmt2('{} ({} days ago)', dstr, Math.floor(diff));
    }
	
    function _populateLinks(linkAvp) {
        var d = new Date();
        if (reptype == 'assignment') nl.fmt.addLinkToAvp(linkAvp, 'content', nl.fmt2('/lesson/view_assign/{}', mode.assignid));
        nl.fmt.addLinkToAvp(linkAvp, 'export', null, 'assignment_export');
        nl.fmt.addLinkToAvp(linkAvp, 'charts', null, 'status_overview');
    }

    function _getReportAvps(report) {
        var now = new Date();
        var avps = [];
        nl.fmt.addAvp(avps, 'Learner', report.studentname);
        nl.fmt.addAvp(avps, 'Name', report.name);
        nl.fmt.addAvp(avps, 'Created on', _fmtDateDelta(report.created, now));
        nl.fmt.addAvp(avps, 'Last updated on', _fmtDateDelta(report.updated, now));
        if (report._timeMins) nl.fmt.addAvp(avps, 'Time spent', nl.fmt2('{} minutes', report._timeMins));
        _populateCommonAvps(report, avps);
        return avps;
    }

    function _populateCommonAvps(report, avps) {
        nl.fmt.addAvp(avps, 'Remarks', report.assign_remarks);
        nl.fmt.addAvp(avps, 'Assigned By', report.assigned_by);
        nl.fmt.addAvp(avps, 'Assigned To', report.assigned_to);
        nl.fmt.addAvp(avps, 'Assigned On ', report.assigned_on, 'date');
        nl.fmt.addAvp(avps, 'Subject', report.subject);
        nl.fmt.addAvp(avps, 'Author', report.authorname);
        nl.fmt.addAvp(avps, 'Module description', report.descMore);
        nl.fmt.addAvp(avps, 'Earliest start time', report.not_before, 'date');
        nl.fmt.addAvp(avps, 'Latest end time', report.not_after, 'date');
        nl.fmt.addAvp(avps, 'Max duration', report.max_duration, 'minutes');
        nl.fmt.addAvp(avps, 'Show answers', _learnmodeString(report.learnmode));
        nl.fmt.addAvp(avps, 'Is published?', report.published, 'boolean');
    }
    
	function _learnmodeString(learnmode) {
		if (learnmode == 1)
			return nl.fmt.t(['on every page']);
		if (learnmode == 2)
			return nl.fmt.t(['after submitting']);
		if (learnmode == 3)
			return nl.fmt.t(['only when published']);
		return '';
	}

    var statusOverviewDlg = null;
	function _statusOverview() {
		statusOverviewDlg = nlDlg.create($scope);
		statusOverviewDlg.setCssClass('nl-height-max nl-width-max');
		statusOverviewDlg.scope.showLeaderBoard = (reptype != 'user');
        statusOverviewDlg.scope.filters = {ous: {}, grades: {}, subjects: {}};
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
        if(!mode.dataFetched) {
            nlDlg.popupAlert({title: 'Data still loading', 
                content: 'Still loading data from server. Please export after the complete data is loaded.'});
            return;
        }
        NlAssignReportStats.export($scope, reportStats.getRecords(), _userInfo);
    }
    
	function _assignmentShare($scope, card){
		var data = {repid: card.id};
		var sharedUsersList = [];
		nlServerApi.assignmentSharedUsers(data).then(function(status){
			sharedUsersList = status;	
			var assignmentShareDlg = nlDlg.create($scope);
			_initAssignmentShareDlg(assignmentShareDlg, sharedUsersList);
			assignmentShareDlg.scope.removeSharedUser = function(id){
				var alreadySharedUsers = assignmentShareDlg.scope.data.sharedUsers;
				for(var i in alreadySharedUsers){
					var card = alreadySharedUsers[i];
					if(card.id == id) {
						assignmentShareDlg.scope.data.sharedUsers.splice(i, 1);
						var index = assignmentShareDlg.scope.data.selectedSharedUserListIds.indexOf(id);
						assignmentShareDlg.scope.data.selectedSharedUserListIds.splice(index, 1);
					}
				}
				_updateVisibalityToUsers(alreadySharedUsers, assignmentShareDlg);
			};
				
			var updateButton =  {text : nl.t('Update'), onTap: function(e){
				if(e) e.preventDefault();
				var data = {repid: card.id,
							sharedUsers: assignmentShareDlg.scope.data.selectedSharedUserListIds};
				nlServerApi.assignmentUpdateSharedUsers(data).then(function(status){
					assignmentShareDlg.close(false);
				});
			}};				
			var cancelButton = {
				text : nl.t('Cancel')
			};
				
			assignmentShareDlg.scope.onSharedUserSelect = function(){
				_showOuListDlg($scope, assignmentShareDlg, sharedUsersList);
			};	
			assignmentShareDlg.show('view_controllers/assignment_report/assignment_share_dlg.html', [updateButton], cancelButton, false);
		});
	};

	function _initAssignmentShareDlg(assignmentShareDlg, sharedUsersList){
			assignmentShareDlg.setCssClass('nl-height-max nl-width-max');
			assignmentShareDlg.scope.data = {};
			assignmentShareDlg.scope.data.users = sharedUsersList;
			assignmentShareDlg.scope.data.removeicon = nl.url.resUrl('quick-links/close.png');
			assignmentShareDlg.scope.data.sharedWith = nl.t('Not shared with any user:');
			assignmentShareDlg.scope.data.sharedUsersIds = _updateOuTree(sharedUsersList, assignmentShareDlg);
			assignmentShareDlg.scope.data.sharedUsers = assignmentShareDlg.scope.data.sharedUsersIds[0];
			assignmentShareDlg.scope.data.selectedSharedUserListIds = assignmentShareDlg.scope.data.sharedUsersIds[1];				
			assignmentShareDlg.scope.treeOptions = {
				defaultSelectedState : false,
				twistieExpandedTpl : nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('folder.png')),
				twistieCollapsedTpl : nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('folder_closed.png')),
				twistieLeafTpl : nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('file.png')),
				labelAttribute : 'text'
			};
	};

	function _updateOuTree(userData, assignmentShareDlg) {
		var alreadySharedUsers = [];
		var alreadySharedUsersIds = [];
		var sharedUsersAndIds = [];
		for (var i in userData) {
			var node = userData[i];
			for(var j in node.children){
				var subnode = node.children[j];
				if(subnode.shared == true){
					alreadySharedUsers.push(subnode);
					alreadySharedUsersIds.push(subnode.id);		
				}
			}
		}
		_updateVisibalityToUsers(alreadySharedUsers, assignmentShareDlg);
		sharedUsersAndIds.push(alreadySharedUsers, alreadySharedUsersIds);
		return sharedUsersAndIds;
	}

	function _updateVisibalityToUsers(alreadySharedUsers, assignmentShareDlg){
		if(alreadySharedUsers.length == 0) assignmentShareDlg.scope.data.sharedWith = nl.t('Shared With no users:');
		if(alreadySharedUsers.length == 1) assignmentShareDlg.scope.data.sharedWith = nl.t('Shared With {} user:', alreadySharedUsers.length);
		if(alreadySharedUsers.length > 1) assignmentShareDlg.scope.data.sharedWith = nl.t('Shared With {} users:', alreadySharedUsers.length);
	}
	
	function _addSearchInfo(cards) {
		cards.search = {
			placeholder : nl.t('Name/{}/Remarks/Keyword', _userInfo.groupinfo.subjectlabel),
			maxLimit: 100
		};
		cards.search.onSearch = _onSearch;
	}

	function _onSearch(filter) {
	    return; // Do nothing as all data are already fetched - just search locally!
	}
	
	
	function _showOuListDlg(parentScope, assignmentShareDlg, ouList){
				var ouSelectionDlg = nlDlg.create(parentScope);
			_initouSelectionDlg(ouSelectionDlg, ouList);

		function _initouSelectionDlg(ouSelectionDlg, ouList) {
			ouSelectionDlg.setCssClass('nl-height-max nl-width-max');	
			ouSelectionDlg.scope.treeData = ouList;
			ouSelectionDlg.scope.treeOptions = {
			defaultSelectedState: false,
			twistieExpandedTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('folder.png')),
			twistieCollapsedTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('folder_closed.png')),
			twistieLeafTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('file.png')),
		    labelAttribute: 'text'
			};
		}

		ouSelectionDlg.scope.onNodeClick = function(node, isSelected, tree) {
			assignmentShareDlg.scope.data.sharedUsers = _updateOuTree(ouSelectionDlg.scope.treeData);
		};

		function _updateOuTree(userData) {
			var alreadySharedUsers = [];
			assignmentShareDlg.scope.data.selectedSharedUserListIds = [];
			for (var i in userData) {
				var node = userData[i];
				for(var j in node.children){
					var subnode = node.children[j];
					if(subnode.shared == true || subnode.selected == true){
						alreadySharedUsers.push(subnode);
						assignmentShareDlg.scope.data.selectedSharedUserListIds.push(subnode.id);					
					}
				}
			}
			_updateVisibalityToUsers(alreadySharedUsers, assignmentShareDlg);
			return alreadySharedUsers;
		}
		var cancelButton = {text : nl.t('Add')};
		ouSelectionDlg.show('view_controllers/assignment_report/share_report_dlg.html',
			[], cancelButton, false);
	}
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

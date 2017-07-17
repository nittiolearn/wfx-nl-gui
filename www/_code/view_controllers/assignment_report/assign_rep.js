(function() {

//-------------------------------------------------------------------------------------------------
// assign_rep.js:
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
function TypeHandler(reptype, nl, nlServerApi, nlDlg) {
    var self = this;
	this.initFromUrl = function() {
		var params = nl.location.search();
        self.limit = ('limit' in params) ? params.limit : (reptype == 'user') ? 50: null;

		if (reptype == 'assignment') {
            self.assignid = ('assignid' in params) ? parseInt(params.assignid) : null;
            if (!self.assignid) return false;
		} else if (reptype == 'user') {
            self.userid = ('userid' in params) ? params.userid : null;
		}
        self.initVars();
        return true;
	};

	this.initVars = function() {
        self.nextStartPos = null;
        self.dataFetchInProgress = true;
        self.canFetchMore = true;
	};

	this.getAssignmentReports = function(dateRange, callbackFn) {
		var data = {reptype: reptype};
        if (self.nextStartPos) data.startpos = self.nextStartPos;
		if (reptype == 'assignment') {
		    data.assignid = self.assignid;
		} else if (reptype == 'user') {
            data.userid = self.userid;
            data.completed = true;
		} else if (reptype == 'group' && dateRange) {
		    data.updatedfrom = dateRange.updatedFrom;
		    data.updatedtill = dateRange.updatedTill;
		}
		self.dataFetchInProgress = true;
		nlServerApi.batchFetch(nlServerApi.assignmentReport, data, function(result) {
            if (result.isError) {
                self.dataFetchInProgress = false;
                callbackFn(true, null);
                return;
            }
            self.dataFetchInProgress = !result.fetchDone;
            self.nextStartPos = result.nextStartPos;
            self.canFetchMore = result.canFetchMore;
            callbackFn(false, result.resultset);
		}, self.limit);
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
		'nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi', 'NlAssignReportStats',
		'nlGroupInfo', 'nlRangeSelectionDlg', 'nlOuUserSelect',
		function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, NlAssignReportStats,
			nlGroupInfo, nlRangeSelectionDlg, nlOuUserSelect) {
	    _assignRepImpl(ctrlType, nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, 
	    	NlAssignReportStats, nlGroupInfo, nlRangeSelectionDlg, nlOuUserSelect);
	}];
}

//-------------------------------------------------------------------------------------------------
function _assignRepImpl(reptype, nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, 
	NlAssignReportStats, nlGroupInfo, nlRangeSelectionDlg, nlOuUserSelect) {
	var _userInfo = null;
	var my = 0;
	var search = null;
	var mode = new TypeHandler(reptype, nl, nlServerApi, nlDlg);
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
                search: {onSearch: _onSearch, placeholder: nl.t('Name/{}/Remarks/Keyword', _userInfo.groupinfo.subjectlabel)},
                emptycard: nlCardsSrv.getEmptyCard({help : nl.t('There are no assignments to display.')})
    		};
            if(reptype == 'group') $scope.cards.toolbar = _getToolbar();
            nlCardsSrv.initCards($scope.cards);
            nl.pginfo.pageTitle = mode.pageTitle(); 
            nlGroupInfo.init().then(function() {
                nlGroupInfo.update();
	            if(reptype == 'group') {
	            	_showRangeSelection(resolve);
	            } else {
	                _getDataFromServer(false, resolve);
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
        if(mode.dataFetchInProgress) {
            nlDlg.popupAlert({title: 'Data still loading', 
                content: 'Still loading data from server. Please change date/time after the complete data is loaded.'});
            return;
        }
        _showRangeSelection(null);
	}
        
	function _showRangeSelection(resolve) {
	    nlRangeSelectionDlg.show($scope).then(function(data) {
	        if (!data) {
                if (resolve) resolve(false);
                return;
	        }
            nlDlg.showLoadingScreen();
            dateRange = data;
            _getDataFromServer(false, resolve);
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
        } else if (linkid === 'fetch_more') {
            _fetchMore();
		}
	};

	$scope.onCardInternalUrlClicked = function(card, internalUrl) {
	    $scope.onCardLinkClicked(card, internalUrl);
	};	

    function _fetchMore() {
        nlDlg.showLoadingScreen();
        _getDataFromServer(true, null);
    }
    
	function _getDataFromServer(fetchMore, resolve) {
	    if (!fetchMore) {
            mode.initVars();
            nlCardsSrv.updateCards($scope.cards, {cardlist: [], staticlist: []});
            reportStats = NlAssignReportStats.createReportStats(reptype, $scope);
	    }
		mode.getAssignmentReports(dateRange, function(isError, result) {
		    if (isError) {
		        if (resolve) resolve(false);
		        return;
		    }
            reportStats.updateReports(result);
            _appendAssignmentReportCards(result, $scope.cards.cardlist);
            if ($scope.cards.staticlist.length == 0 && result.length > 0) {
                _appendChartCard($scope.cards.staticlist);
            }
            _updateChartCard(reportStats);
            _updateStatusOverview();

            nlCardsSrv.updateCards($scope.cards, {
                canFetchMore: !mode.dataFetchInProgress && mode.canFetchMore
            });
            nlDlg.hideLoadingScreen();
            if (resolve) resolve(true);
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
	
	function _createReportCard(report) {
	    var urlPart = (reptype == 'user' && report.student == _userInfo.userid)
	       ? 'view_report_assign' : 'review_report_assign';

        var status = reportStats.getStatusInfo()[report._statusStr];
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
		
        card.details = {help: card['help'], avps: reportStats.getReportAvps(report)};
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
        reportStats.populateCommonAvps(report, avps);
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
        if(mode.dataFetchInProgress) {
            nlDlg.popupAlert({title: 'Data still loading', 
                content: 'Still loading data from server. Please export after the complete data is loaded.'});
            return;
        }
        NlAssignReportStats.export($scope, reportStats.getRecords(), _userInfo);
    }

    var _ouUserSelector = null;
    var _selectedUsers = {};
    var _selectedUserIdsObj = {};
     
	function _assignmentShare($scope, card){
		var data = {repid: card.id};
		var sharedUsersList = [];
		var assignmentShareDlg = nlDlg.create($scope);
        var alreadySharedUsers = [];
			assignmentShareDlg.scope.data = {};
			assignmentShareDlg.scope.data.card = card;
        nlGroupInfo.init().then(function() {
            nlGroupInfo.update();
            _ouUserSelector = nlOuUserSelect.getOuUserSelector($scope, 
                nlGroupInfo.get(), {}, {});
			nlServerApi.assignmentSharedUsers(data).then(function(status){
				sharedUsersList = status;	
				_initAssignmentShareDlg(assignmentShareDlg, sharedUsersList);
	        	_showDlg(assignmentShareDlg, sharedUsersList, alreadySharedUsers);			
			});
        });
	};

	function _showDlg(assignmentShareDlg, sharedUserList, alreadySharedUsers){
		var updateButton =  {text : nl.t('Update'), onTap: function(e){
			if(e) e.preventDefault();
			var data = {repid: assignmentShareDlg.scope.data.card.id,
						sharedUsers: assignmentShareDlg.scope.data.selectedSharedUserListIds};
			nlServerApi.assignmentUpdateSharedUsers(data).then(function(status){
				assignmentShareDlg.close(false);
			});
		}};
		
		var cancelButton = {
			text : nl.t('Cancel')
		};
			
		assignmentShareDlg.scope.onSharedUserSelect = function(){
			_showOuListDlg($scope, assignmentShareDlg, sharedUserList);
		};
		
		assignmentShareDlg.show('view_controllers/assignment_report/assignment_share_dlg.html', [updateButton], cancelButton, false);
	}

	function _initAssignmentShareDlg(assignmentShareDlg, sharedUsersList){
		assignmentShareDlg.setCssClass('nl-height-max nl-width-max');
		assignmentShareDlg.scope.data.users = sharedUsersList;
		assignmentShareDlg.scope.data.removeicon = nl.url.resUrl('quick-links/close.png');
		assignmentShareDlg.scope.data.sharedWith = nl.t('Not shared with any user:');
		assignmentShareDlg.scope.data.sharedUsersIds = _updateOuTree(sharedUsersList, assignmentShareDlg);
		assignmentShareDlg.scope.data.sharedUsers = assignmentShareDlg.scope.data.sharedUsersIds[0];
		assignmentShareDlg.scope.data.selectedSharedUserListIds = assignmentShareDlg.scope.data.sharedUsersIds[1];				
		assignmentShareDlg.scope.data.ouUserTree =_ouUserSelector.getTreeSelect();
		_selectedUsers = _getSelectedUsers(assignmentShareDlg.scope.data.ouUserTree);
        _ouUserSelector.updateSelectedIds(_selectedUsers);
	};

	function _getSelectedUsers(userTree){
		var selectedUsers = {};
		for(var i=0; i< userTree.data.length; i++){
			var user = userTree.data[i];
			if(!user.userObj) continue;
			if(user.userObj.id in _selectedUserIdsObj) selectedUsers[user.id] = user;
		};
		return selectedUsers;
	};
	
	function _updateOuTree(userData, assignmentShareDlg) {
		var alreadySharedUsers = [];
		var alreadySharedUsersIds = [];
		var sharedUsersAndIds = [];
			_selectedUserIdsObj = {};
		for (var i in userData) {
			var node = userData[i];
			for(var j in node.children){
				var subnode = node.children[j];
				if(subnode.shared == true){
					alreadySharedUsers.push(subnode);
					alreadySharedUsersIds.push(subnode.id);
					_selectedUserIdsObj[subnode.id] = subnode;		
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
	
	function _onSearch(filter) {
	    return; // Do nothing as all data are already fetched - just search locally!
	}
	
	
	function _showOuListDlg(parentScope, assignmentShareDlg, ouList){
		var ouSelectionDlg = nlDlg.create(parentScope);
		ouSelectionDlg.scope.data = {};
        _ouUserSelector.updateSelectedIds(_selectedUsers);
		_initouSelectionDlg(ouSelectionDlg, assignmentShareDlg);

		var addButton = {text : nl.t('Add'), onTap: function(){
			if(Object.keys(ouSelectionDlg.scope.data.org_unit.selectedIds).length == 0) return;			
			assignmentShareDlg.scope.data.sharedUsersIds = _updateSelectedUsersAndIds(ouSelectionDlg.scope.data.org_unit.selectedIds);
			assignmentShareDlg.scope.data.sharedUsers = assignmentShareDlg.scope.data.sharedUsersIds[0];
			assignmentShareDlg.scope.data.selectedSharedUserListIds = assignmentShareDlg.scope.data.sharedUsersIds[1];
			_selectedUsers = ouSelectionDlg.scope.data.org_unit.selectedIds;
		}};
		var cancelButton = {text : nl.t('Cancel')};
		
		function _updateSelectedUsersAndIds(selectedIds){
			var alreadySharedUsers = [];
			var alreadySharedUsersIds = [];
			var sharedUsersAndIds = [];
			for (var i in selectedIds) {
				var node = selectedIds[i];
					var userObject = {container:node.userObj.org_unit, id: node.userObj.id, text: node.name};
					alreadySharedUsers.push(userObject);
					alreadySharedUsersIds.push(node.userObj.id);		
			}
			_updateVisibalityToUsers(alreadySharedUsers, assignmentShareDlg);
			sharedUsersAndIds.push(alreadySharedUsers, alreadySharedUsersIds);
			return sharedUsersAndIds;
		}

		ouSelectionDlg.show('view_controllers/assignment_report/share_report_dlg.html',
			[addButton], cancelButton, false);
	}
	
	function _initouSelectionDlg(ouSelectionDlg, assignmentShareDlg) {
		ouSelectionDlg.setCssClass('nl-height-max nl-width-max');
        ouSelectionDlg.scope.data.org_unit = assignmentShareDlg.scope.data.ouUserTree;
	}
}

//-------------------------------------------------------------------------------------------------
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

(function() {

//-------------------------------------------------------------------------------------------------
// assign_rep.js:
// Assignment reports controller to list assignment reports of a given lesson assignment
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.assign_rep', [])
    .config(configFn)
    .controller('nl.AssignRepCtrl', AssignRepCtrl);
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
}];

//-------------------------------------------------------------------------------------------------
function TypeHandler(nl, nlServerApi, nlDlg) {
    var self = this;
	this.initFromUrl = function() {
		var params = nl.location.search();
		self.assignid = ('assignid' in params) ? params.assignid : null;
        self.max = ('max' in params) ? params.max : 49;
        self.dataFetched = false;
	};

	this.getAssignmentReports = function(filter, callbackFn) {
	    self.start_at = 0;
        self.dataFetched = false;
	    _getAssignmentReports(filter, callbackFn);
    };

    function _getAssignmentReports(filter, callbackFn) {
		var data = {assignid : self.assignid, max: self.max, start_at: self.start_at};
		if (filter) data.search = filter;
		nlServerApi.assignmentReport(data).then(function(result) {
            var more = (result.length > self.max);
            self.start_at += result.length;
            var msg = nl.t('Got {} items from the server.{}', self.start_at, more ? 
                ' Fetching more items ...' : '');
            nlDlg.popupStatus(msg, more ? false : undefined);
            if (more) {
                _getAssignmentReports(filter, callbackFn);
            }
            
            callbackFn(false, result, more);
            if (!more) self.dataFetched = true;
		}, function(error) {
            nlDlg.popupStatus(error);
            callbackFn(true, error, false);
		});
	}

	this.pageTitle = function(name) {
		return nl.t('Assignment Report: {}', name);
	};
};

//-------------------------------------------------------------------------------------------------
var AssignRepCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi', 'NlAssignReportStats',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, NlAssignReportStats) {
	var _userInfo = null;
	var my = 0;
	var search = null;
	var mode = new TypeHandler(nl, nlServerApi, nlDlg);
	var reportStats = null;
	var assignid = null;
	var nameAndScore = [];

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {
		mode.initFromUrl();
		$scope.cards = {};
        _addSearchInfo($scope.cards);
		$scope.cards.emptycard = _getEmptyCard(nlCardsSrv);
		_getDataFromServer('', resolve);
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

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
			nl.window.location.href = nl.t('/lesson/view_assign/{}', card.id);
        } else if(linkid == 'assignment_export') {
            _assignmentExport($scope);
        } else if(linkid == 'status_overview'){
            _statusOverview($scope);
		}
	};

	$scope.onCardInternalUrlClicked = function(card, internalUrl) {
	    $scope.onCardLinkClicked(card, internalUrl);
	};	

	function _getDataFromServer(filter, resolve) {
	    $scope.cards.cardlist = [];
        $scope.cards.staticlist = [];
        reportStats = NlAssignReportStats.createReportStats();
		mode.getAssignmentReports(filter, function(isError, result, more) {
		    if (isError) {
		        resolve(false);
		        return;
		    }
		    if ($scope.cards.staticlist.length == 0 && result.length > 0) {
                _appendFirstStaticCard(result[0], $scope.cards.staticlist);
                _appendSecondStaticCard($scope.cards.staticlist);
		    }
            _appendAssignmentReportCards(result, $scope.cards.cardlist);
            reportStats.updateStats(result);
            _updateSecondStaticCard(reportStats);
            resolve(true);
		});
	}
	
	function _appendAssignmentReportCards(resultList, cardlist) {
		for (var i = 0; i < resultList.length; i++) {
			var card = _createAssignmentCard(resultList[i]);
			cardlist.push(card);
		}
		cardlist.sort(function(a, b) {
		    return (b.updated - a.updated);
		});
	}

	function _createAssignmentCard(assignment) {
		var url = null;
		var internalUrl = null;
		var status = null;
		nl.pginfo.pageTitle = mode.pageTitle(assignment.name); 
		var content = angular.fromJson(assignment.content);
		var bcompleted = assignment.completed || false;
		if(bcompleted){
			status = nl.t('completed');
			url = nl.fmt2('/lesson/review_report_assign/{}', assignment.id);
		} else {
			status = nl.t('not completed');
		}
		var card = {
			id : assignment.id,
			title : assignment.studentname,
			updated: nl.fmt.json2Date(assignment.updated),
			icon : nl.url.resUrl('dashboard/reports.png'),
			internalUrl: internalUrl, 
			url : url,
			children : []
		};
		if(bcompleted) {
			card.links = [];
			card.links.push({
				id : 'assignment_update',
				text : nl.t('update')
			},{
				id : 'assignment_share',
				text : nl.t('share')
			});
			var perc = content.maxScore > 0 ? Math.round((content.score/content.maxScore)*100) : 'NA';
			if(perc > 0){
				card['help'] = nl.t('<span class="nl-card-description"><b>Status: {}</b></span><br><span>score: {} / {} ({}%)</span>', status, content.score, content.maxScore, perc);
			}else {
				card['help'] = nl.t('<span class="nl-card-description"><b>Status: {}</b></span>', status);			
			}
		} else {
			card['help'] = nl.t('<span class="nl-card-description"><b>Status: {}</b></span>', status);
		}
		return card;
	}

	function _appendFirstStaticCard(lessonCard, cards) {
		var card = {
			id : mode.assignid,
			title : lessonCard.name,
			icon : nl.url.lessonIconUrl(lessonCard.icon || lessonCard.image),
			children : [],
			style : 'nl-bg-blue' 
		};
		card['help'] = nl.t('<span>by : {}</span><br><span>Assigned to :<b>{}</b></span>', lessonCard.assigned_by, lessonCard.assigned_to);
		card.links = [{id: 'assignment_content', text: 'content'},
					  {id: 'assignment_export', text: 'export'},
                      {id: 'details', text: 'details'}];
		card.details = {
			help : lessonCard.descMore,
			avps : _getAssignmentAvps(lessonCard)
		};
		cards.push(card);
	};

    var _secondStaticCard = null;
    function _appendSecondStaticCard(cards) {
        _secondStaticCard = {
            title : nl.t('Please wait ...'),
            fullDesc : true,
            internalUrl: 'status_overview', 
            style : 'nl-bg-blue',
            doughnutData : [1],
            doughnutLabel : ['Loading'],
            doughnutColor : ['#DDDDFF'],
            doughnutOptions : {responsive: true, maintainAspectRatio: true},
            help: nl.t('<canvas class="chart chart-doughnut" chart-data="card.doughnutData" chart-labels="card.doughnutLabel" chart-colours="card.doughnutColor" chart-options="card.doughnutOptions"></canvas>')
        };
        cards.push(_secondStaticCard);
    }

    function _updateSecondStaticCard(reportStats) {
        var stats = reportStats.getStats();
        var completed = stats.passed + stats.failed;
        _secondStaticCard.title =nl.t('{} of {} completed', completed, stats.students);
        _secondStaticCard.doughnutData = [stats.passed, stats.failed, stats.students - completed];
        _secondStaticCard.doughnutLabel = ["completed", "completed but scored low", "not completed"];
        _secondStaticCard.doughnutColor = ['#007700', '#FFCC00', '#F54B22'];
        _secondStaticCard.dist = [_getPercDistribution(reportStats.getPercentages())];
	};
	
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

	function _getAssignmentAvps(lessonCard) {
		var avps = [];
        var linkAvp = nl.fmt.addLinksAvp(avps, 'Operation(s)');
        _populateLinks(linkAvp);
		nl.fmt.addAvp(avps, 'Name', lessonCard.name);
		nl.fmt.addAvp(avps, 'Remarks', lessonCard.assign_remarks);
		nl.fmt.addAvp(avps, 'Assigned By', lessonCard.assigned_by);
		nl.fmt.addAvp(avps, 'Assigned On ', lessonCard.assigned_on, 'date');
		nl.fmt.addAvp(avps, 'Assigned To', lessonCard.assigned_to);
		nl.fmt.addAvp(avps, 'Subject', lessonCard.subject);
		nl.fmt.addAvp(avps, 'Author', lessonCard.authorname);
		nl.fmt.addAvp(avps, 'Module description', lessonCard.descMore);
		nl.fmt.addAvp(avps, 'Earliest start time', lessonCard.not_before, 'date');
		nl.fmt.addAvp(avps, 'Latest end time', lessonCard.not_after, 'date');
		nl.fmt.addAvp(avps, 'Max duration', lessonCard.max_duration, 'minutes');
		nl.fmt.addAvp(avps, 'Show answers', _learnmodeString(lessonCard.learnmode));
		nl.fmt.addAvp(avps, 'Is published?', lessonCard.published, 'boolean');
		return avps;
	}
	
    function _populateLinks(linkAvp) {
        var d = new Date();
        nl.fmt.addLinkToAvp(linkAvp, 'content', nl.fmt2('/lesson/view_assign/{}', mode.assignid));
        nl.fmt.addLinkToAvp(linkAvp, 'export', null, 'assignment_export');
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

	function _statusOverview($scope) {
		var statusOverviewDlg = nlDlg.create($scope);
		statusOverviewDlg.setCssClass('nl-height-max nl-width-max');

        statusOverviewDlg.scope.stats = reportStats.getStats();
        statusOverviewDlg.scope.leaderBoard = reportStats.getLeaderBoard();
		statusOverviewDlg.scope.data = {
            doughnutLabel: _secondStaticCard.doughnutLabel,
            doughnutColor: _secondStaticCard.doughnutColor,
            doughnutData: null,
            chartLabel: ['10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%']
		};

        var cancelButton = {text: nl.t('Close')};
        statusOverviewDlg.show('view_controllers/assignment_report/status_overview_dlg.html', [], cancelButton, false);
        
        // angular-charts workaround to ensure height/width of canvas are correctly calculated
        // set the chart properties after the dialog box appears
        nl.timeout(function() {
            statusOverviewDlg.scope.data.doughnutData = _secondStaticCard.doughnutData;
            statusOverviewDlg.scope.data.chartData = _secondStaticCard.dist;
        });
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
			maxLimit: 1000000 // A large number!
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
	
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

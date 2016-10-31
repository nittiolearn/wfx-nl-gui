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
function TypeHandler(nl, nlServerApi) {
	this.assignid = null;
	
	this.initFromUrl = function() {
		var params = nl.location.search();
		this.assignid = ('assignid' in params) ? params.assignid : null;
        this.max = ('max' in params) ? params.max : 500;
	};

	this.listingFunction = function(filter) {
		var data = {assignid : this.assignid, max: this.max};
		if (filter) data.search = filter;
		return nlServerApi.assignmentReport(data);
	};

	this.pageTitle = function(name) {
		return nl.t('Assignment Report: {}', name);
	};
};

//-------------------------------------------------------------------------------------------------
var AssignRepCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi', '$templateCache',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, $templateCache) {
	var _userInfo = null;
	var my = 0;
	var search = null;
	var mode = new TypeHandler(nl, nlServerApi);
	var assignid = null;
	var scorePercentage = [];
	var nameAndScore = [];

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {
		mode.initFromUrl();
		$scope.cards = {};
		$scope.cards.emptycard = _getEmptyCard(nlCardsSrv);
		_getDataFromServer('', resolve, reject);
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
		}
	};
	
	$scope.onCardInternalUrlClicked = function(card, internalUrl) {
		var cardId = card.Id;
		if(internalUrl == 'status_overview'){
			_statusOverview($scope, card);
		}
	};	

	function _getDataFromServer(filter, resolve, reject) {
		mode.listingFunction(filter).then(function(resultList) {
			nl.log.debug('Got result: ', resultList.length);
			$scope.cards.staticlist = _getStaticCard(_userInfo, resultList, nlCardsSrv);
			$scope.cards.cardlist = _getAssignmentReportCards(_userInfo, resultList, nlCardsSrv);
			_addSearchInfo($scope.cards);
			resolve(true);
		}, function(reason) {
			resolve(false);
		});
	}
	
	function _getAssignmentReportCards(_userInfo, resultList, nlCardsSrv){
		var cards = [];
		for (var i = 0; i < resultList.length; i++) {
			var card = _createAssignmentCard(resultList[i], _userInfo);
			cards.push(card);
		}
		return cards;
	}

	function _createAssignmentCard(assignment, userInfo) {
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

	function _getStaticCard(_userInfo, resultList, nlCardsSrv) {
		var cards = [];
		var lessonCard = null;
		var numberOfStudentsCompleted = 0;
		var totalNumberOfStudentsAssignmentAssigned = resultList.length;
		var totalScore = 0;
		var maxScore = 0;
		var averageScore = 0;
		nameAndScore = [];
		scorePercentage = [];
		var numberOfStudentsScoredBelowAverage = null;
		var studentsGotLessthanAvg = 0;
		var studentsGotHundredPercent = 0;
		for (var i = 0; i < resultList.length; i++) {
			lessonCard = resultList[i];
			var data = {};
			var content = angular.fromJson(resultList[i].content);
			if(resultList[i].completed) {
				maxScore = content.maxScore || 0;
				numberOfStudentsCompleted = 'score' in content ? numberOfStudentsCompleted+1 : numberOfStudentsCompleted;
				totalScore = 'score' in content ? totalScore+content.score : totalScore;
				var perc = content.maxScore > 0 ? Math.round((content.score/content.maxScore)*100) : -1;
				if (perc >= 0) scorePercentage.push(perc);
				if(perc >= 0) data = {name: lessonCard.studentname, id: lessonCard.id, percentage: perc, status: true};
				if(perc < 0) data = {name: lessonCard.studentname, id: lessonCard.id, percentage: null, status: true};
				nameAndScore.push(data);
			} else {
				data = {name: lessonCard.studentname, id: lessonCard.id, percentage: 0, status: false};				
				nameAndScore.push(data);
			}
		}
		if (!lessonCard) return cards;
		lessonCard['cardid'] = mode.assignid;
		averageScore = _getAverageScore(scorePercentage);
		var listofStudents = _getStudentsGotBelowAvg(averageScore, scorePercentage);
		if (averageScore >= 0) {
			averageScore += '%';
		}
		cards.push(_getFirstStaticCard(lessonCard, numberOfStudentsCompleted, totalNumberOfStudentsAssignmentAssigned, averageScore));
		cards.push(_getSecondStaticCard(scorePercentage, maxScore, totalScore, totalNumberOfStudentsAssignmentAssigned, numberOfStudentsCompleted, averageScore, listofStudents));
		return cards;
	}
	
	function _getFirstStaticCard(lessonCard, numberOfStudentsCompleted, totalNumberOfStudentsAssignmentAssigned, averageScore){
		var card = {
			id : mode.assignid,
			title : lessonCard.name,
			icon : nl.url.lessonIconUrl(lessonCard.icon || lessonCard.image),
			children : [],
			style : 'nl-bg-blue' 
		};
		card['help'] = nl.t('<span>by : {}</span><br><span>Assigned to :<b>{}</b></span>', lessonCard.assigned_by, lessonCard.assigned_to);
		card.links = [{id: 'assignment_content', text: 'content'},
					   {id: 'details', text: 'details'}];
		card.details = {
			help : lessonCard.descMore,
			avps : _getAssignmentAvps(lessonCard, numberOfStudentsCompleted, totalNumberOfStudentsAssignmentAssigned, averageScore)
		};			   
		return card;		
	};


	function _getSecondStaticCard(scorePercentage, maxScore, totalScore, totalAssigned, completed, averageScore, listofStudents){
		var scoreToDisplayInCharts = [];
		scoreToDisplayInCharts.push(_getScoreToDisplayInCharts(scorePercentage));
		var doughnutdata = null;
		var doughnutlabel = null;
		var doughnutcolor = null;
		if(maxScore !== 0) {
			doughnutdata = _getDoughnutData(scorePercentage, totalAssigned, completed);
			doughnutlabel = ["greater than 70%", "less than 70%", "not completed"];
			doughnutcolor = ['#007700', '#FFCC00', '#F54B22'];
		} else {
			doughnutdata = [completed, totalAssigned-completed];
			doughnutlabel = ["completed", "not completed"];
			doughnutcolor = ['#007700', '#F54B22'];
		}
		var title =nl.t('{} of {} completed', completed, totalAssigned);
		var card = {
			title : title,
			fullDesc : true,
			maxscore : maxScore,
			chartData: scoreToDisplayInCharts,
			totalStudentsAssigned : totalAssigned,
			totalScore : totalScore,
			completed : completed,
			averageScore: averageScore,
			focusStudents: listofStudents,
			scorePerc : scorePercentage,
			nameScore : nameAndScore,
			internalUrl: 'status_overview', 
			style : 'nl-bg-blue',
			doughnutData : doughnutdata,
			doughnutLabel : doughnutlabel,
			doughnutColor : doughnutcolor,
			doughnutOptions : {responsive: true, maintainAspectRatio: true}
		};
		card['help']=nl.t('<canvas id="doughnut" class="chart chart-doughnut" chart-data="card.doughnutData" chart-labels="card.doughnutLabel" chart-colours="card.doughnutColor" chart-options="card.doughnutOptions"></canvas>');
		return card;
	};
	
	function _getAverageScore(scorePercentage) {
		var  perc = scorePercentage;
		if (perc.length == 0) return 'NA';
		var sum = 0;
		for(var i in perc) {
			sum = perc[i] + sum;
		}
		return Math.round(sum/perc.length).toFixed(1);
	}
	
	function _getStudentsGotBelowAvg(averageScore, scorePercentage){
		var listofStudents = [];
		var studentsGotLessThanAverage = 0;
		var studentsGotHundredPercent = 0;
		for(var i in scorePercentage) {
			if(scorePercentage[i] < averageScore) studentsGotLessThanAverage = studentsGotLessThanAverage + 1;
			if(scorePercentage[i] == 100) studentsGotHundredPercent = studentsGotHundredPercent + 1;
		}
		listofStudents.push(studentsGotLessThanAverage, studentsGotHundredPercent);
		return listofStudents;
	}
	
	function _getScoreToDisplayInCharts(scorePercentage) {
		var chartArray = new Array(10).fill(0);
		for (var i in scorePercentage){
			var eachStudentPercentage = scorePercentage[i];
			eachStudentPercentage = Math.ceil((eachStudentPercentage)/10)*10;
			var number = eachStudentPercentage/10;
			if(number == 0){
				chartArray[number] = chartArray[number] + 1;
			} else {
				chartArray[number-1] = chartArray[number-1] + 1;
			}
		}
		return chartArray;
	}

	function _getDoughnutData(scorePercentage, totalAssigned, completed) {
		var chartArray = new Array(3).fill(0);
		for(var i in scorePercentage) {
			if(scorePercentage[i]  >= '70'){
				chartArray[0] =	chartArray[0] + 1;
			} else if(scorePercentage[i] <  '70') {
				chartArray[1] =	chartArray[1] + 1;
			}
		}		
		chartArray[2] = totalAssigned - completed;
		return chartArray;
	}
	
	
	function _getAssignmentAvps(lessonCard, completed, total, avgScore){
		var avps = [];
		var linkAvp = nl.fmt.addLinksAvp(avps, 'Operation(s)');
		_populateLinks(linkAvp, lessonCard.cardid);
		nl.fmt.addAvp(avps, 'Name', lessonCard.name);
		nl.fmt.addAvp(avps, 'Remarks', lessonCard.assign_remarks);
		nl.fmt.addAvp(avps, 'Assigned By', lessonCard.assigned_by);
		nl.fmt.addAvp(avps, 'Assigned On ', lessonCard.assigned_on, 'date');
		nl.fmt.addAvp(avps, 'Assigned To', lessonCard.assigned_to);
		nl.fmt.addAvp(avps, 'Subject', lessonCard.subject);
		nl.fmt.addAvp(avps, 'Completion Status', nl.t('{} of {}', completed, total));
		nl.fmt.addAvp(avps, 'Average Score', avgScore);
		nl.fmt.addAvp(avps, 'Author', lessonCard.authorname);
		nl.fmt.addAvp(avps, 'Module description', lessonCard.descMore);
		nl.fmt.addAvp(avps, 'Earliest start time', lessonCard.not_before, 'date');
		nl.fmt.addAvp(avps, 'Latest end time', lessonCard.not_after, 'date');
		nl.fmt.addAvp(avps, 'Max duration', lessonCard.max_duration, 'minutes');
		nl.fmt.addAvp(avps, 'Show answers', _learnmodeString(lessonCard.learnmode));
		nl.fmt.addAvp(avps, 'Is published?', lessonCard.published, 'boolean');
		return avps;
	}
	
	function _populateLinks(linkAvp, lessonId) {
		var d = new Date();
		nl.fmt.addLinkToAvp(linkAvp, 'content', nl.fmt2('/lesson/view_assign/{}', lessonId));
		nl.fmt.addLinkToAvp(linkAvp, 'export', nl.fmt2('/assignment/export/{}/{}', lessonId, d.getTimezoneOffset()));
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

	function _statusOverview($scope, card) {
		var statusOverviewDlg = nlDlg.create($scope);
		statusOverviewDlg.setCssClass('nl-height-max nl-width-max');
		statusOverviewDlg.scope.data = {};
		statusOverviewDlg.scope.data.card = card;
        var cancelButton = {text: nl.t('Close')};
        statusOverviewDlg.show('view_controllers/assignment_report/status_overview_dlg.html', [], cancelButton, false);
        
        statusOverviewDlg.scope.data.doughnutLabel = ['Completed', 'Not completed'];
        statusOverviewDlg.scope.data.doughnutColor = ['#009900', '#F54B22'];
        if(card.maxscore > 0)
            statusOverviewDlg.scope.data.chartLabel = ['10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'];  

        // angular-charts workaround to ensure height/width of canvas are correctly calculated
        // set the chart properties after the dialog box appears
        nl.timeout(function() {
            statusOverviewDlg.scope.data.doughnutData = [card.completed, (card.totalStudentsAssigned-card.completed)];
            if(card.maxscore > 0)
                statusOverviewDlg.scope.data.chartData = card.chartData;
        });
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
			placeholder : nl.t('Name/{}/Remarks/Keyword', _userInfo.groupinfo.subjectlabel)
		};
		cards.search.onSearch = _onSearch;
	}

	function _onSearch(filter) {
		nlDlg.showLoadingScreen();
		var promise = nl.q(function(resolve, reject) {
			_getDataFromServer(filter, resolve, reject);
		});
		promise.then(function(res) {
			nlDlg.hideLoadingScreen();
		});
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

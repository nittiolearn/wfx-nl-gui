(function() {

//-------------------------------------------------------------------------------------------------
// assignment.js:
// assignment module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.assignment', []).config(configFn).controller('nl.AssignmentDeskCtrl', AssignmentDeskCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.assignment', {
		url : '^/assignment',
		views : {
			'appContent' : {
				templateUrl : 'lib_ui/cards/cardsview.html',
				controller : 'nl.AssignmentDeskCtrl'
			}
		}
	});
}];

//-------------------------------------------------------------------------------------------------
var TYPES = {
	NEW : 0,
	PAST : 1,
	SHARED : 2,
	MANAGE : 3,
	SENT : 4
};
var TYPENAMES = {
	'new' : 0,
	'past' : 1,
	'shared' : 2,
	'manage' : 3,
	'sent' : 4
};

function TypeHandler(nl, nlServerApi) {
	this.type = TYPES.NEW;
	this.custtype = null;
	this.title = null;

	this.initFromUrl = function(userInfo) {
		var params = nl.location.search();
		this.type = _convertType(params.type, userInfo);
		this.custtype = ('custtype' in params) ? parseInt(params.custtype) : null;
		this.title = params.title || null;
	};

	this.listingFunction = function(filter) {
		var data = {
			search : filter
		};
		if (this.custtype !== null) data.custtype = this.custtype;
		if (this.type == TYPES.PAST) {
			data.bPast = true;
			return nlServerApi.assignmentGetMyList(data);
		} else if (this.type == TYPES.SHARED) {
			return nlServerApi.assignmentGetSharedList(data);
		} else if (this.type == TYPES.MANAGE) {
			data.mine = false;
			return nlServerApi.assignmentGetSentList(data);
		} else if (this.type == TYPES.SENT) {
			data.mine = true;
			return nlServerApi.assignmentGetSentList(data);
		} else {
			return nlServerApi.assignmentGetMyList(data);
		}
	};

	this.pageTitle = function() {
		if (this.title) return this.title;
		if (this.type == TYPES.NEW)
			return nl.t('New Assignments');
		if (this.type == TYPES.PAST)
			return nl.t('Past Assignments');
		if (this.type == TYPES.SHARED)
			return nl.t('Reports shared with me');
		if (this.type == TYPES.MANAGE)
			return nl.t('Manage assignments');
		if (this.type == TYPES.SENT)
			return nl.t('View assignment status');
		return '';
	};

	function _convertType(typeStr, userInfo) {
		if (typeStr === undefined) {
		    if (userInfo.permissions.assignment_send) return TYPES.SENT;
		    return TYPES.NEW;
		}
		typeStr = typeStr.toLowerCase();
		for (var t in TYPENAMES) {
			if (t == typeStr)
				return TYPENAMES[t];
		}
		return TYPES.NEW;
	}

}

//-----------------------------------------------------------------------------------------------------
var AssignmentDeskCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi) {

	var mode = new TypeHandler(nl, nlServerApi);
	var _userInfo = null;
	var _searchFilterInUrl = '';

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		_initParams();
		return nl.q(function(resolve, reject) {
			mode.initFromUrl(_userInfo);
			nl.pginfo.pageTitle = mode.pageTitle();
			$scope.cards = {};
			$scope.cards.staticlist = [];
			$scope.cards.emptycard = _getEmptyCard(nlCardsSrv);
			_getDataFromServer(_searchFilterInUrl, resolve, reject);
		});
	}


	nlRouter.initContoller($scope, '', _onPageEnter);
	
	$scope.onCardInternalUrlClicked = function(card, internalUrl) {
		var assignId = card.Id;
		if (internalUrl === 'assign_delete') {
			_deleteAssignment($scope, assignId);
		} else if (internalUrl === 'assign_publish'){
			_publishAssignment($scope, assignId);
		}
	};
	
	function _getEmptyCard(nlCardsSrv) {
		var help = help = nl.t('There are no assignments to display.');
		return nlCardsSrv.getEmptyCard({
			help : help
		});
	}
	
	function _getDataFromServer(filter, resolve, reject) {
		mode.listingFunction(filter).then(function(resultList) {
			nl.log.debug('Got result: ', resultList.length);
			$scope.cards.cardlist = _getCards(_userInfo, resultList, nlCardsSrv);
			_addSearchInfo($scope.cards);
			resolve(true);
		}, function(reason) {
			resolve(false);
		});
	}
	
	function _getCards(userInfo, resultList, nlCardsSrv) {
		var cards = [];
		for (var i = 0; i < resultList.length; i++) {
			var card = _createAssignmentCard(resultList[i], userInfo);
			cards.push(card);
		}
		return cards;
	}

	function _createAssignmentCard(assignment, userInfo) {
		var url = null;
		var internalUrl = null;
		if (mode.type == TYPES.SHARED) {
			url = nl.fmt2('/lesson/view_shared_report_assign/{}/', assignment.id);
		} else if (mode.type == TYPES.MANAGE || mode.type == TYPES.SENT) {
			url = nl.fmt2('/#/assignment_report?assignid={}', assignment.id);
		} else if(mode.type == TYPES.PAST){
			url = nl.fmt2('/lesson/view_report_assign/{}/', assignment.id);
		} else {
			url = nl.fmt2('/lesson/do_report_assign/{}/', assignment.id);				
		} 
		var card = {
			Id : assignment.id,
			title : assignment.name,
			icon : nl.url.lessonIconUrl(assignment.icon || assignment.image),
			internalUrl: internalUrl, 
			url : url,
			children : []
		};
		var descFmt = "<div class='nl-textellipsis'>Sent to: <b>{}</b></div>" + 
			"<div class='nl-textellipsis'>{}: {}</div>" +
			"<div class='nl-textellipsis'>by: <b>{}</b></div>";
		if (mode.type == TYPES.PAST || mode.type == TYPES.SHARED) {
		    descFmt += "<img src={} class='nl-24'> completed";
			card['help'] = nl.t(descFmt, assignment.assigned_to, _userInfo.groupinfo.subjectlabel, assignment.subject, 
			    assignment.assigned_by, nl.url.resUrl('general/tick.png'));
		} else {
            descFmt += "<div>{}</div>";
			card['help'] = nl.t(descFmt, assignment.assigned_to, _userInfo.groupinfo.subjectlabel, assignment.subject, 
			    assignment.assigned_by, assignment.assign_remarks);
		}
		card.details = {
			help : assignment.descMore,
			avps : _getAssignmentAvps(assignment)
		};
		card.links = [];
		if (mode.type == TYPES.MANAGE || mode.type == TYPES.SENT) {
			card.links.push({
				id : assignment.id,
				text : nl.t('content')
			},{
				id : 'details',
				text : nl.t('details')
			});
		} else {
			card.links.push({
				id : 'details',
				text : nl.t('details')
			});
		}
		return card;
	}

	function _getAssignmentAvps(assignment) {
		var avps = [];
		var linkAvp = nl.fmt.addLinksAvp(avps, 'Operations');
		_populateLinks(linkAvp, assignment.id, assignment.published);
		nl.fmt.addAvp(avps, 'Name', assignment.name);
		nl.fmt.addAvp(avps, 'Remarks', assignment.assign_remarks);
		nl.fmt.addAvp(avps, 'Assigned by', assignment.assigned_by);
		nl.fmt.addAvp(avps, 'Assigned on', assignment.assigned_on, 'date');
		if (mode.type !== TYPES.MANAGE && mode.type !== TYPES.SENT) {
			nl.fmt.addAvp(avps, 'Owner', assignment.studentname);
			nl.fmt.addAvp(avps, 'Started on', assignment.started, 'date');
			nl.fmt.addAvp(avps, 'Ended on', assignment.ended, 'date');
		}
		nl.fmt.addAvp(avps, 'Assigned to', assignment.assigned_to);
		nl.fmt.addAvp(avps, _userInfo.groupinfo.subjectlabel, assignment.subject);
		nl.fmt.addAvp(avps, 'Author', assignment.authorname);
		nl.fmt.addAvp(avps, 'Earliest start time', assignment.not_before, 'date');
		nl.fmt.addAvp(avps, 'Latest end time', assignment.not_after, 'date');
		nl.fmt.addAvp(avps, 'Max duration', assignment.max_duration, 'minutes');
		nl.fmt.addAvp(avps, 'Show answers', _learnmodeString(assignment.learnmode));
		nl.fmt.addAvp(avps, 'Is published?', assignment.published, 'boolean');
		nl.fmt.addAvp(avps, 'Discussion forum', assignment.forum, 'boolean');
		return avps;
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
	
	function _populateLinks(linkAvp, assignId, publish) {
		var d = new Date();
		if (mode.type == TYPES.PAST) {
			nl.fmt.addLinkToAvp(linkAvp, 'view report', nl.fmt2('/lesson/view_report_assign/{}', assignId));
		} else if (mode.type == TYPES.SHARED) {
			nl.fmt.addLinkToAvp(linkAvp, 'view report', nl.fmt2('/lesson/view_shared_report_assign/{}', assignId));
		} else if (mode.type == TYPES.MANAGE || mode.type == TYPES.SENT) {
			nl.fmt.addLinkToAvp(linkAvp, 'reports', nl.fmt2('/#/assignment_report?assignid={}', assignId));
			nl.fmt.addLinkToAvp(linkAvp, 'content', nl.fmt2('/lesson/view_assign/{}', assignId));
			nl.fmt.addLinkToAvp(linkAvp, 'export', nl.fmt2('/assignment/export/{}/{}', assignId, d.getTimezoneOffset()));
			nl.fmt.addLinkToAvp(linkAvp, 'delete', null, 'assign_delete');
			if(!publish) nl.fmt.addLinkToAvp(linkAvp, 'publish', null, 'assign_publish');
		} else {
			nl.fmt.addLinkToAvp(linkAvp, 'do assignment', nl.fmt2('/lesson/do_report_assign/{}', assignId));
		}
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


	$scope.onCardLinkClicked = function(card, linkid) {
		var url = nl.t('/lesson/view_assign/{}/', linkid);
		nl.window.location.href = url;
	};

	function _deleteAssignment($scope, assignId) {
		var msg = {title: 'Please confirm', 
				   template: nl.t('Deleting an assignment will delete all reports behind this assignment. This cannot be undone. Are you sure you want to delete?'),
				   okText: nl.t('Delete')};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;
			nlDlg.showLoadingScreen();
			nlServerApi.assignmentDelete(assignId).then(function(status) {
				nlDlg.hideLoadingScreen();
				for (var i in $scope.cards.cardlist) {
					var card = $scope.cards.cardlist[i];
					if (card.Id !== assignId) continue;
					$scope.cards.cardlist.splice(i, 1);
				}
				nlDlg.closeAll();
				_reloadFromServer();
			});	
		});
	}

	function _publishAssignment($scope, assignId){
		nlServerApi.assignmentPublish(assignId).then(function(status) {
			nlDlg.hideLoadingScreen();
			nlDlg.closeAll();
			_reloadFromServer();
		});
	}

	function _reloadFromServer() {
		nlDlg.showLoadingScreen();
		var promise = nl.q(function(resolve, reject) {
			_getDataFromServer(_searchFilterInUrl, resolve, reject);
		});
		promise.then(function(res) {
			nlDlg.hideLoadingScreen();
		});
	}

	function _initParams() {
		var params = nl.location.search();
		_searchFilterInUrl = ('search' in params) ? params.search : '';
	}
}];

//-----------------------------------------------------------------------------------------------------
module_init();
})();

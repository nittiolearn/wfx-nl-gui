(function() {

//-------------------------------------------------------------------------------------------------
// assignment.js:
// assignment module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.assignment', [])
	.config(configFn)
	.controller('nl.AssignmentDeskCtrl', AssignmentDeskCtrl);
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
	SENT : 2,
	MANAGE : 3
};
var TYPENAMES = {
	'new' : 0,
	'past' : 1,
	'sent' : 2,
	'manage' : 3
};

function TypeHandler(nl, nlServerApi) {
	this.type = TYPES.NEW;
	this.custtype = null;
	this.title = null;
	this.max_delete = 50;
	this.max2 = 500;

	this.initFromUrl = function(userInfo) {
		var params = nl.location.search();
		this.type = _convertType(params.type, userInfo);
		this.custtype = ('custtype' in params) ? parseInt(params.custtype) : null;
		this.title = params.title || null;
		this.max_delete = params.max_delete || 50;
		this.max2 = ('max2' in params) ? parseInt(params.max2) : 500;
	};

    this.getListFnAndUpdateParams = function(params) {
		if (this.custtype !== null) params.custtype = this.custtype;
		if (this.type == TYPES.PAST) {
			params.bPast = true;
			return nlServerApi.assignmentGetMyList;
		} else if (this.type == TYPES.MANAGE) {
			params.mine = false;
			return nlServerApi.assignmentGetSentList;
		} else if (this.type == TYPES.SENT) {
			params.mine = true;
			return nlServerApi.assignmentGetSentList;
		} else {
			return nlServerApi.assignmentGetMyList;
		}
	};

	this.pageTitle = function() {
		if (this.title) return this.title;
		if (this.type == TYPES.NEW)
			return nl.t('New Assignments');
		if (this.type == TYPES.PAST)
			return nl.t('Past Assignments');
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
var AssignmentDeskCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi', 'nlLrFetcher',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, nlLrFetcher) {

	var mode = new TypeHandler(nl, nlServerApi);
	var _userInfo = null;
	var _subFetcher = nlLrFetcher.getSubFetcher();

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {
			mode.initFromUrl(_userInfo);
			nl.pginfo.pageTitle = mode.pageTitle();
			$scope.cards = {
                search: {placeholder: nl.t('Name/{}/Remarks/Keyword', _userInfo.groupinfo.subjectlabel)}
            };
            nlCardsSrv.initCards($scope.cards);
			_getDataFromServer(resolve);
		});
	}


	nlRouter.initContoller($scope, '', _onPageEnter);
	
	$scope.onCardInternalUrlClicked = function(card, internalUrl) {
		var assignId = card.id;
		if (internalUrl === 'assign_delete') {
			_deleteAssignment($scope, assignId);
		} else if (internalUrl === 'assign_publish'){
			_publishAssignment($scope, assignId);
		} else if (internalUrl === 'view_content') {
            var url = nl.t('/lesson/view_assign/{}/', card.id);
            nl.window.location.href = url;
        } else if (internalUrl === 'fetch_more') {
            _fetchMore();
        }
	};
	
    $scope.onCardLinkClicked = function(card, linkId) {
        $scope.onCardInternalUrlClicked(card, linkId);
    };

    function _fetchMore() {
        _getDataFromServer(null, true);
    }
	
    var _pageFetcher = nlServerApi.getPageFetcher();
    var _resultList = [];
	function _getDataFromServer(resolve, fetchMore) {
		if (!fetchMore) _resultList = [];
	    var params = {};
		if(fetchMore) params['max'] = mode.max2;
		var listingFn = mode.getListFnAndUpdateParams(params);
        _pageFetcher.fetchPage(listingFn, params, fetchMore, function(results) {
            if (!results) {
                if (resolve) resolve(false);
                return;
            }
            function _afterSubFetching(updatedResults) {
	            _resultList = _resultList.concat(updatedResults);
	            nlCardsSrv.updateCards($scope.cards, {
	                cardlist: _getCards(_userInfo, _resultList),
	                canFetchMore: _pageFetcher.canFetchMore()
	            });
	            if (resolve) resolve(true);
            }

			if (mode.type != TYPES.NEW && mode.type != TYPES.PAST) {
				_afterSubFetching(results);
			} else {
				_subFetcher.subfetchAndOverride(results, _afterSubFetching);
			}
        });
	}
	
	function _getCards(userInfo, resultList) {
		var cards = [];
		for (var i = 0; i < resultList.length; i++) {
			if ((mode.type == TYPES.NEW || mode.type == TYPES.PAST) 
				&& resultList[i].ctype != _nl.ctypes.CTYPE_MODULE) continue;
			var card = _createAssignmentCard(resultList[i], userInfo);
			cards.push(card);
		}
		return cards;
	}

	function _createAssignmentCard(assignment, userInfo) {
        var content = assignment.content ? angular.fromJson(assignment.content) : {};
        assignment.subject = content.subject || '';

		var url = null;
		if (mode.type == TYPES.MANAGE || mode.type == TYPES.SENT) {
			url = nl.fmt2('/#/learning_reports?type=module_assign&objid={}', assignment.id);
		} else if(mode.type == TYPES.PAST){
			url = nl.fmt2('/lesson/view_report_assign/{}/', assignment.id);
		} else {
			url = nl.fmt2('/lesson/do_report_assign/{}/', assignment.id);				
		} 
		var card = {
			id : assignment.id,
			title : assignment.name,
			created: nl.fmt.json2Date(assignment.created),
			icon : nl.url.lessonIconUrl(assignment.icon || assignment.image),
			url : url,
			children : []
		};
		var descFmt = '';
		if(assignment.batchname)
			descFmt += nl.t("<div><b>{}</b></div>", assignment.batchname);
		if(assignment.not_before)			
			descFmt += nl.t("<div>From {}", nl.fmt.date2Str(nl.fmt.json2Date(assignment.not_before), 'date'));

		if(assignment.not_after) 
			descFmt += nl.t(" till {}</div>", nl.fmt.date2Str(nl.fmt.json2Date(assignment.not_after), 'date'));
		else
			descFmt += '</div>';
		if(assignment.assign_remarks) 
			descFmt +=  nl.t("<div>{}</div>", assignment.assign_remarks);
		
		card['help'] = descFmt;
		card.details = {
			help : assignment.descMore,
			avps : _getAssignmentAvps(assignment)
		};
		card.links = [];
		if (mode.type == TYPES.MANAGE || mode.type == TYPES.SENT) {
			card.links.push({id : 'view_content', text : nl.t('content')});
		}
        card.links.push({id : 'details', text : nl.t('details')});
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
			nl.fmt.addAvp(avps, 'Started on', assignment.started, 'date');
			nl.fmt.addAvp(avps, 'Ended on', assignment.ended, 'date');
		}
		nl.fmt.addAvp(avps, 'Assigned to', assignment.assigned_to);
		nl.fmt.addAvp(avps, _userInfo.groupinfo.subjectlabel, assignment.subject);
		nl.fmt.addAvp(avps, 'Author', assignment.authorname);
		nl.fmt.addAvp(avps, 'Batch name', assignment.batchname || '');
		nl.fmt.addAvp(avps, 'From', assignment.not_before, 'date');
		nl.fmt.addAvp(avps, 'Till', assignment.not_after, 'date');
		nl.fmt.addAvp(avps, 'Max duration', assignment.max_duration, 'minutes');
		nl.fmt.addAvp(avps, 'Show answers', _learnmodeString(assignment.learnmode));
		nl.fmt.addAvp(avps, 'Is published?', assignment.published, 'boolean');
		nl.fmt.addAvp(avps, 'Discussion forum', assignment.forum, 'boolean');
		nl.fmt.addAvp(avps, 'Submission after end time', assignment.submissionAfterEndtime, 'boolean');
		if(!(mode.type == TYPES.NEW || mode.type == TYPES.PAST))
			nl.fmt.addAvp(avps, 'Internal identifier', assignment.id);
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
		} else if (mode.type == TYPES.MANAGE || mode.type == TYPES.SENT) {
			nl.fmt.addLinkToAvp(linkAvp, 'reports', nl.fmt2('/#/learning_reports?type=module_assign&objid={}', assignId));
			nl.fmt.addLinkToAvp(linkAvp, 'content', nl.fmt2('/lesson/view_assign/{}', assignId));
			nl.fmt.addLinkToAvp(linkAvp, 'delete', null, 'assign_delete');
			if(!publish) nl.fmt.addLinkToAvp(linkAvp, 'publish', null, 'assign_publish');
		} else {
			nl.fmt.addLinkToAvp(linkAvp, 'do assignment', nl.fmt2('/lesson/do_report_assign/{}', assignId));
		}
	}

	function _deleteAssignment($scope, assignId) {
		var msg = {title: 'Please confirm', 
				   template: nl.t('Deleting an assignment will delete all reports behind this assignment. This cannot be undone. Are you sure you want to delete?'),
				   okText: nl.t('Delete')};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;
			nlDlg.popupStatus('Deletion in progress ...', false);
			nlDlg.showLoadingScreen();
			_deleteAssignmentInLoop(assignId, 0, function() {
				nlDlg.hideLoadingScreen();
				var cardlist = $scope.cards.cardlist;
				for (var i in cardlist) {
					var card = cardlist[i];
					if (card.id !== assignId) continue;
					cardlist.splice(i, 1);
				}
                nlCardsSrv.updateCards($scope.cards, {cardlist: cardlist});
				nlDlg.closeAll();
				//_reloadFromServer(); TODO- CHECK later commented when delete assignment in batches is introduced. Uncomment if really required
			});
		});
	}
	
	function _deleteAssignmentInLoop(assignId, deletedCount, callBack) {
		nlServerApi.assignmentDelete(assignId, mode.max_delete).then(function(status) {
			deletedCount += status.deleted_count;
			var msg = nl.fmt2('Deleted {} reports.', !deletedCount ? 'all' : deletedCount );
			if (status.more) msg += ' Deletion in progress ...';
			nlDlg.popupStatus(msg, status.more ? false : 2000);
			if (status.more) {
				_deleteAssignmentInLoop(assignId, deletedCount, callBack);
			} else {
				callBack();
			}
		}, function() {
			nlDlg.popdownStatus();
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
		_getDataFromServer();
	}
}];

//-----------------------------------------------------------------------------------------------------
module_init();
})();

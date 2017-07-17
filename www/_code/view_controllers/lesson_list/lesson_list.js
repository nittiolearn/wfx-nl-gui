(function() {

//-------------------------------------------------------------------------------------------------
// lesson.js:
// lesson list module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.lessonlist', []).config(configFn)
	.controller('nl.LessonListCtrl', LessonListCtrl)
	.service('nlExportLevel', ExportLevelSrv)
	.service('nlApproveDlg', ApproveDlgSrv)
	.service('nlLessonSelect', LessonSelectSrv);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.lesson_list', {
		url : '^/lesson_list',
		views : {
			'appContent' : {
				templateUrl : 'lib_ui/cards/cardsview.html',
				controller : 'nl.LessonListCtrl'
			}
		}
	});
}];

//-------------------------------------------------------------------------------------------------
var MODES = {
	NEW : 0,
	APPROVED : 1,
	MY : 2,
	MANAGE : 3,
	REVIEW : 4,
	SENDASSIGNMENT : 5
};
var MODENAMES = {
	'new' : 0,
	'approved' : 1, 'selfassign' : 1,
	'my' : 2,
	'manage' : 3,
	'review' : 4,
	'sendassignment' : 5
};

var STATUS = {
	PRIVATE : 0,
	UNDERREVIEW : 1,
	UNDERREVISION : 2,
	APPROVED : 3,
	APPROVEDREWORK : 4,
	APPROVEDREVIEW : 5
};

var STATUS_STR = [
    'Private',
    'Under review',
    'Rejected',
    'Approved',
    'Approved, update rejected',
    'Approved, update under review'
];

var STATUS_ICON = [
    'fgrey ion-record',
    'fyellow ion-record',
    'forange ion-record',
    'fgreen ion-checkmark-circled',
    'forange ion-alert-circled',
    'fyellow ion-checkmark-circled'
];

var LESSONTYPES = {
	LESSON : 0,
	TEMPLATE : 1
};

var REVSTATE = {
	ALL : 0,
	PENDING : 1,
	CLOSED : 2
};

var EXPORTLEVEL = {
	PRIVATE : 0,
	PUBLIC : 1
};

//-------------------------------------------------------------------------------------------------
function ModeHandler(nl, nlServerApi, nlMetaDlg) {
    var self=this;
	this.mode = MODES.NEW;
    this.title = null;

	this.custtype = null;
    this.metadataEnabled = false;
    this.searchMetadata = {};

    this.nextStartPos = null;
    this.canFetchMore = true;
    this.resultList = [];

    this.revstate = 1;

	this.initFromUrl = function(params) {
		if (!params) params = nl.location.search();
		_convertMode(params.type);
		self.custtype = ('custtype' in params) ? parseInt(params.custtype) : null;
		self.revstate = ('revstate' in params) ? parseInt(params.revstate) : 1;
		self.searchMetadata = (!params.showInDlg) ? nlMetaDlg.getMetadataFromUrl() : {};
		self.title = params.title || null;
	};
	
	this.listingFunction = function(fetchMore, cbFn) {
	    if (!fetchMore) {
	        self.canFetchMore = true;
            self.resultList = [];
            self.nextStartPos = null;
	    }
		var data = {};
        if (self.nextStartPos) data.startpos = self.nextStartPos;
		if (self.custtype !== null) data.custtype = self.custtype;
        data.metadata = self.searchMetadata;
        
        var fn = nlServerApi.lessonGetApprovedList;
		if (self.mode == MODES.NEW) {
			fn = nlServerApi.lessonGetTemplateList;
		} else if (self.mode == MODES.MY) {
			fn = nlServerApi.lessonGetPrivateList;
		} else if (self.mode == MODES.MANAGE) {
			fn = nlServerApi.lessonGetManageApprovedList;
		} else if (self.mode == MODES.REVIEW) {
			data.revstate = self.revstate;
			fn = nlServerApi.lessonGetReviewList;
		} else if (self.mode == MODES.SENDASSIGNMENT) {
			fn = nlServerApi.lessonGetApprovedList;
		}
        nlServerApi.batchFetch(fn, data, function(result) {
            if (result.isError) {
                cbFn(result);
                return;
            }
            self.canFetchMore = result.canFetchMore;
            self.nextStartPos = result.nextStartPos;
            cbFn(result);
        });
	};

	this.pageTitle = function() {
		if (self.title) return self.title;
		if (self.mode == MODES.NEW) return nl.t('Create new: select the template');
		if (self.mode == MODES.APPROVED) return nl.t('Approved modules');
		if (self.mode == MODES.MY) return nl.t('My modules');
		if (self.mode == MODES.MANAGE) return nl.t('Manage approved modules');
		if (self.mode == MODES.REVIEW) return nl.t('Review modules');
		if (self.mode == MODES.SENDASSIGNMENT) return nl.t('Send Assignment');
		return '';
	};

    this.getAllowedMetadataFeilds = function() {
        if (self.mode == MODES.MY || self.mode == MODES.REVIEW) return {grade: true, subject: true};
        return null; // All metadata fields are allowed
    };

	function _convertMode(modeStr) {
		self.modeStr = (modeStr || '').toLowerCase();
		self.mode = (self.modeStr in MODENAMES) ? MODENAMES[self.modeStr] : MODES.APPROVED;
	}

}

//-------------------------------------------------------------------------------------------------
var LessonListCtrl = ['$scope', 'nlLessonSelect',
function($scope, nlLessonSelect) {
	nlLessonSelect.show($scope);
}];

//-------------------------------------------------------------------------------------------------
var LessonSelectSrv = ['nl', 'nlRouter', 'nlDlg', 'nlCardsSrv', 'nlServerApi', 
'nlApproveDlg', 'nlSendAssignmentSrv', 'nlMetaDlg',
function(nl, nlRouter, nlDlg, nlCardsSrv, nlServerApi, nlApproveDlg, nlSendAssignmentSrv, nlMetaDlg) {
this.showSelectDlg = function($scope, initialUserInfo) {
	var self = this;
	return nl.q(function(resolve, reject) {
    	var _selectDlg = nlDlg.create($scope);
		_selectDlg.setCssClass('nl-height-max nl-width-max');
		var _resolved = false;
		var closeButton = {text : nl.t('Close'), onTap: function() {
			if (!_resolved) reject(false);
		}};
		_selectDlg.scope.onItemSelected = function(card) {
			var selectedList = [card];
			resolve(selectedList);
			_resolved = true;
			_selectDlg.close();
		};
		var params = {showInDlg: true, type: 'approved'};
		_selectDlg.show('view_controllers/lesson_list/lesson_select_dlg.html', [], closeButton);
		self.show(_selectDlg.scope, initialUserInfo, params);
	});
};

this.show = function($scope, initialUserInfo, params) {
	var _showInDlg = params && params.showInDlg;
	var mode = new ModeHandler(nl, nlServerApi, nlMetaDlg);
	var _userInfo = null;

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {
			mode.initFromUrl(params);
			if (!_showInDlg) nl.pginfo.pageTitle = mode.pageTitle();
			$scope.cards = {
			    staticlist: _getStaticCard(),
                search: {onSearch: _onSearch, placeholder : nl.t('Name/{}/Remarks/Keyword', _userInfo.groupinfo.subjectlabel)}
		    };
            nlCardsSrv.initCards($scope.cards);
            mode.metadataEnabled = (mode.mode == MODES.APPROVED) ||
                (mode.mode == MODES.MANAGE) ||
                (mode.mode == MODES.SENDASSIGNMENT);
            _getDataFromServer(false, resolve, reject);
		});
	}

	if (_showInDlg) {
		nlDlg.showLoadingScreen();
    	_onPageEnter(initialUserInfo).then(function() {
			nlDlg.hideLoadingScreen();
    	});
	} else {
		nlRouter.initContoller($scope, '', _onPageEnter);
	}

	function _getApproveToList() {
		var card = ['Visible to users within the group', 'Visible to users within the group and dependent group', 'Visible to every logedin user', 'Visible to everyone'];
		return card;
	}

	function _getStaticCard() {
        if (mode.mode != MODES.NEW) return [];
		var card = {
			title : nl.t('Create'),
			icon : nl.url.resUrl('dashboard/crnewwsheet.png'),
			description : nl.t('can create'),
			children : [{
				title : "Click on one of the listed templates or"
			}, {
				title : "Create based on default template",
				url : "/lesson/create2#/",
				linkId : "admin_group",
				children : []
			}],
			style : 'nl-bg-blue',
			links: []
		};
        if (_userInfo.permissions.lesson_create_adv) {
            card.children.push({
                title : "Create based on pdf",
                url : "/lesson/create2/0/0/pdf#/",
                linkId : "admin_group",
                children : []
            });
            card.children.push({
                title : "create a new template",
                url : "/lesson/create2/0/1#/",
                linkId : "admin_group",
                children : []
            });
        }
		return [card];
	}

	$scope.onCardInternalUrlClicked = function(card, internalUrl) {
		var lessonId = card.lessonId;
		if (internalUrl === 'lesson_delete') {
			_deleteLesson($scope, lessonId);
		} else if (internalUrl === 'lesson_select') {
			$scope.onItemSelected(card);
		} else if (internalUrl === 'lesson_approve') {
			_approveLesson($scope, lessonId);
		} else if (internalUrl === 'lesson_copy') {
			_copyLesson($scope, lessonId);
		} else if (internalUrl === 'lesson_closereview') {
			_closereviewLesson($scope, lessonId);
        } else if (internalUrl === 'lesson_metadata') {
            _metadataLesson($scope, lessonId, card);
        } else if (internalUrl === 'fetch_more') {
            _fetchMore();
		} else if (internalUrl === 'lesson_disapprove') {
			_disapproveLesson($scope, lessonId);
		} else if (internalUrl === 'lesson_view') {
			nl.window.location.href = nl.fmt2('/lesson/view/{}/', lessonId);
        } else if (internalUrl === 'lesson_view_priv') {
            nl.window.location.href = nl.fmt2('/lesson/view_priv/{}/', lessonId);
		} else if (internalUrl === 'lesson_reopen') {
			_reopenLesson($scope, lessonId);
		} else if (internalUrl === 'send_assignment') {
			var content = angular.fromJson(card.content);
			var assignInfo = {
				type : 'lesson',
				id : card.lessonId,
				icon : card.icon,
				title : card.title,
				authorName : card.authorName,
				subjGrade : nl.fmt2('{}, {}', card.subject, card.grade),
				description : card.description,
				esttime : content.esttime ? content.esttime : ''
			};
			nlSendAssignmentSrv.show($scope, assignInfo);
		}
	};

	$scope.onCardLinkClicked = function(card, linkId) {
	    $scope.onCardInternalUrlClicked(card, linkId);
	};

	function _getDataFromServer(fetchMore, resolve, reject) {
		mode.listingFunction(fetchMore, function(result) {
		    if (result.isError) {
		        resolve(false);
		        return;
		    }

            var results = result.resultset;
            nl.log.debug('Got result: ', results.length);

            mode.resultList = mode.resultList.concat(results);
            nlCardsSrv.updateCards($scope.cards, {
                cardlist: _getLessonCards(_userInfo, mode.resultList),
                canFetchMore: mode.canFetchMore
            });
            if (!result.fetchDone) return;
            resolve(true);
		});
	}

	function _getLessonCards(userInfo, resultList) {
		var cards = [];
		for (var i = 0; i < resultList.length; i++)
			cards.push(_createLessonCard(resultList[i], userInfo));
		return cards;
	}

	function _createLessonCard(lesson, userInfo) {
        var card = {
            lessonId : lesson.id,
            grp: lesson.grp,
            title : lesson.name,
            subject : lesson.subject,
            grade : lesson.grade,
            icon : nl.url.lessonIconUrl(lesson.image),
            authorName : lesson.authorname,
            description : lesson.description,
            content : lesson.content,
            children : [],
            details: {help : lesson.descMore, avps : _getLessonListAvps(lesson)},
            links: []
        };
        _updateCardUrl(card, lesson, userInfo);
        _updateLinks(card, lesson, userInfo);
        _updateCardHelp(card, lesson, userInfo);
		card.links.push({id : 'details', text : nl.t('details')});
		return card;
	}

    function _updateCardUrl(card, lesson, userInfo) {
        if (mode.mode == MODES.MY) card.url = nl.fmt2('/lesson/edit/{}/', lesson.id);
        else if (mode.mode == MODES.APPROVED || mode.mode == MODES.MANAGE) {
            if(_showInDlg) card.internalUrl = 'lesson_select';
            else if (mode.modeStr == 'selfassign') card.url = nl.fmt2('/lesson/do_report_selfassign?lessonid={}', lesson.id);
            else card.url = nl.fmt2('/lesson/view/{}/', lesson.id);
        } else if (mode.mode == MODES.SENDASSIGNMENT) card.internalUrl = 'send_assignment';
        else if (mode.mode == MODES.NEW) card.url = nl.fmt2('/lesson/create2/{}/', lesson.id);
        else if (mode.mode == MODES.REVIEW) card.url = nl.fmt2('/lesson/view_review/{}/', lesson.id);
    }
    
    function _updateLinks(card, lesson, userInfo) {
        if (mode.mode == MODES.MY) {
            card.links.push({id: 'lesson_view_priv', text: nl.t('view'), lessid: lesson.id});
            card.links.push({id: 'lesson_copy', text: nl.t('copy')});
        } else if (mode.mode == MODES.APPROVED) {
            if (!_showInDlg && lesson.grp == _userInfo.groupinfo.id && userInfo.permissions.lesson_create
                && mode.modeStr == 'approved')
                card.links.push({id : 'lesson_copy', text : nl.t('copy')});
            _addMetadataLink(card);
        } else if (mode.mode == MODES.SENDASSIGNMENT) {
            card.links.push({id : 'lesson_view', text : nl.t('view')});
        } else if (mode.mode == MODES.NEW) {
            // No links
        } else if (mode.mode == MODES.MANAGE) {
            _addDisapproveLink(card);
            _addMetadataLink(card);
        }
    }

    function _addMetadataLink(card) {
        if (!mode.metadataEnabled) return;
        card.links.push({id : 'lesson_metadata', text : nl.t('metadata')});
    }

    function _updateCardHelp(card, lesson, userInfo) {
        var gap = '<div style="height: 4px;"></div>';
        var gradeSubj = nl.fmt2("<div><b>{}, {}</b></div>{}", lesson.grade, lesson.subject, gap);
        var template = '';
        if (lesson.ltype == LESSONTYPES.TEMPLATE)
            template = nl.fmt2("<div class='fgreen'><b>Template</b></div>{}", gap);
        var status = nl.fmt2("<div><i class='icon {}'><span class='padding-small-h'></span>{}</div>{}", 
                STATUS_ICON[lesson.state||0], STATUS_STR[lesson.state||0], gap);
        var author = nl.fmt2("<div>by: {}</div>{}", lesson.authorname, gap);
        var desc = nl.fmt2("<div>{}</div>", lesson.description);

        var content = '';
        if (mode.mode == MODES.MY)
            content = nl.fmt2('{}{}{}{}', gradeSubj, template, status, desc);
        else if (mode.mode == MODES.APPROVED
            || mode.mode == MODES.SENDASSIGNMENT
            || mode.mode == MODES.MANAGE)
            content = nl.fmt2('{}{}{}', gradeSubj, template, author);
        else if (mode.mode == MODES.NEW)
            content = nl.fmt2('{}{}{}', gradeSubj, author, desc);
        else if (mode.mode == MODES.REVIEW) {
            var revstate = lesson.revstate == REVSTATE.CLOSED ? 'Review done' : 'Review pending';
            var resicon = lesson.revstate == REVSTATE.CLOSED ? 'ion-ios-checkmark-outline' : 'ion-ios-chatbubble-outline';
            revstate = nl.fmt2("<div><i class='icon {}'><span class='padding-small-h'></span>{}</div>{}", 
                revsicon, revstate, gap);
            content = nl.fmt2('{}{}{}{}', gradeSubj, author, revstate, template);
        }
        card.help = nl.t("<span class='nl-card-description'>{}</span>", content);
    }

	function _addReviewLinkForUnderReview(card, lesson) {
	    if (lesson.revstate == REVSTATE.CLOSED) _addReopenLink(card);
        else _addCloseReviewLink(card);

		_addApproveLink(card);
	}

	function _addReviewLinkForClosedUnderReview(card, lesson) {
		_addApproveLink(card);
	}

	function _addReviewLinkForApprovedReview(card, lesson) {
		_addCloseReviewLink(card);
		_addDisapproveLink(card);
	}

	function _addReviewLinkForClosedApprovedReview(card, lesson) {
		if (lesson.ltype == LESSONTYPES.LESSON || lesson.ltype == null)
			card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'>Approved, next update under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
		if (lesson.ltype == LESSONTYPES.TEMPLATE)
			card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'>Approved, next update under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span><br><span class='nl-template-color'>Template</span><br>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
		_addReopenLink(card);
		_addDisapproveLink(card);
	}

	function _addReviewLinkForPendingApproved(card, lesson) {
		if (lesson.ltype == LESSONTYPES.LESSON || lesson.ltype == null)
			card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved</span></span><br> by: {}<br><span><img class='nl-16' src={}><span> Review pending</span></span><br>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
		if (lesson.ltype == LESSONTYPES.TEMPLATE)
			card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved</span></span><br> by: {}<br><span><img class='nl-16' src={}><span> Review pending</span></span><br><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
		_addCloseReviewLink(card);
		_addDisapproveLink(card);
	}

	function _addReviewLinkForClosedApproved(card, lesson) {
		if (lesson.ltype == LESSONTYPES.LESSON || lesson.ltype == null)
			card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'>Approved</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
		if (lesson.ltype == LESSONTYPES.TEMPLATE)
			card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'>Approved</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span><br><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
		_addReopenLink(card);
		_addDisapproveLink(card);
	}

	function _addReviewLinkForUnderrevision(card, lesson) {
		if (lesson.ltype == LESSONTYPES.LESSON || lesson.ltype == null)
			card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'> Under revision</span></span><br> by: {}<br><span><img class='nl-16' src={}><span> Review pending</span><br>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
		if (lesson.ltype == LESSONTYPES.TEMPLATE)
			card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'> Under revision</span></span><br> by: {}<br><span><img class='nl-16' src={}><span> Review pending</span><br><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
		_addCloseReviewLink(card);
		_addApproveLink(card);
	}

	function _addReviewLinkForClosedUnderrevision(card, lesson) {
		if (lesson.ltype == LESSONTYPES.LESSON || lesson.ltype == null)
			card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'>Under revision</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
		if (lesson.ltype == LESSONTYPES.TEMPLATE)
			card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'>Under revision</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
		_addReopenLink(card);
		_addApproveLink(card);
	}

	function _addReviewLinkForUnderRework(card, lesson) {
		if (lesson.ltype == LESSONTYPES.LESSON || lesson.ltype == null)
			card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review pending</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
		if (lesson.ltype == LESSONTYPES.TEMPLATE)
			card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review pending</span><br><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
		_addCloseReviewLink(card);
		_addDisapproveLink(card);
	}

	function _addReviewLinkForClosedUnderRework(card, lesson) {
		if (lesson.ltype == LESSONTYPES.LESSON || lesson.ltype == null)
			card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'>Approved, next review update under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
		if (lesson.ltype == LESSONTYPES.TEMPLATE)
			card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'>Approved, next review update under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span><br><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
		_addReopenLink(card);
		_addDisapproveLink(card);
	}

	function _addReopenLink(card) {
		card.links.push({
			id : 'lesson_reopen',
			text : nl.t('reopen')
		});
	}

	function _addCloseReviewLink(card) {
		card.links.push({
			id : 'lesson_closereview',
			text : nl.t('close review')
		});
	}

	function _addApproveLink(card) {
        if (!_userInfo.permissions.lesson_approve) return;
		card.links.push({id: 'lesson_approve', text: nl.t('approve')});
	}

	function _addDisapproveLink(card) {
        if (!_userInfo.permissions.lesson_approve) return;
		card.links.push({id: 'lesson_disapprove', text: nl.t('disapprove')});
	}

    function _addMetadataLinkToDetails(linkAvp) {
        if (!mode.metadataEnabled) return;
        nl.fmt.addLinkToAvp(linkAvp, 'metadata', null, 'lesson_metadata');
    }

	function _getLessonListAvps(lesson) {
		var avps = [];
		if (!_showInDlg) {
			var linkAvp = nl.fmt.addLinksAvp(avps, 'Operation(s)');
			_populateLinks(linkAvp, lesson.id, lesson);
		}
		nl.fmt.addAvp(avps, 'Name', lesson.name);
		nl.fmt.addAvp(avps, _userInfo.groupinfo.subjectlabel, lesson.subject);
		nl.fmt.addAvp(avps, _userInfo.groupinfo.gradelabel, lesson.grade);
		if (mode.mode == MODES.MY || mode.mode == MODES.REVIEW)
			_addIconsToDeatilsDialog(avps, lesson);
		nl.fmt.addAvp(avps, 'Keywords', lesson.keywords);
		nl.fmt.addAvp(avps, 'Created on ', lesson.created, 'date');
		nl.fmt.addAvp(avps, 'Updated on', lesson.updated, 'date');
		nl.fmt.addAvp(avps, 'Author', lesson.authorname);
		nl.fmt.addAvp(avps, 'Group', lesson.grpname);
		nl.fmt.addAvp(avps, 'Is Template', lesson.ltype, 'boolean');
		if (mode.mode == MODES.APPROVED || mode.mode == MODES.MANAGE || mode.mode == MODES.NEW) {
			nl.fmt.addAvp(avps, 'Approved by', lesson.approvername);
			nl.fmt.addAvp(avps, 'Approved on', lesson.approvedon, 'date');
			nl.fmt.addAvp(avps, 'Approved to', lesson.oulist, '-', 'all classes/user groups');
		}
		if (mode.mode == MODES.REVIEW) {
			nl.fmt.addAvp(avps, 'Remarks', lesson.remarks);
			if (lesson.revstate == REVSTATE.PENDING)
				nl.fmt.addAvp(avps, 'Review status', 'Review pending', 'text', '-', nl.url.resUrl('toolbar-edit/comments1.png'), 'nl-16');
			if (lesson.revstate == REVSTATE.CLOSED)
				nl.fmt.addAvp(avps, 'Review status', 'Review done', 'text', '-', nl.url.resUrl('toolbar-edit/approve.png'), 'nl-16');
		}
		nl.fmt.addAvp(avps, 'Module type', lesson.ltype, '-', '0');
		nl.fmt.addAvp(avps, 'Description', lesson.description);
		return avps;
	}

	function _populateLinks(linkAvp, lessonId, lesson) {
		var d = new Date();
		if (mode.mode == MODES.NEW) {
			nl.fmt.addLinkToAvp(linkAvp, 'select', nl.fmt2('/lesson/create2/{}/0#/', lessonId));
            _addMetadataLinkToDetails(linkAvp);
		} else if (mode.mode == MODES.MY) {
			_addLinksToMycontentDetailsDlg(linkAvp, lessonId, lesson);
		} else if (mode.mode == MODES.MANAGE) {
			_addLinksToManageDetailsDlg(linkAvp, lessonId, lesson);
		} else if (mode.mode == MODES.APPROVED) {
			_addLinksToApprovedDetailsDlg(linkAvp, lessonId, lesson);
		} else if (mode.mode == MODES.REVIEW) {
			_addLinksToReviewDetailsDlg(linkAvp, lessonId, lesson);
		} else if (mode.mode == MODES.SENDASSIGNMENT) {
			nl.fmt.addLinkToAvp(linkAvp, 'view', nl.fmt2('/lesson/view/{}', lessonId));
			nl.fmt.addLinkToAvp(linkAvp, 'select', null, 'send_assignment');
            _addMetadataLinkToDetails(linkAvp);
		}
	}

	function _addIconsToDeatilsDialog(avps, lesson) {
		if (lesson.state == STATUS.PRIVATE)
			nl.fmt.addAvp(avps, 'status', 'Private', 'text', '-', nl.url.resUrl('general/ball-grey.png'), 'default');
		if (lesson.state == STATUS.UNDERREVIEW)
			nl.fmt.addAvp(avps, 'status', 'Under review', 'text', '-', nl.url.resUrl('general/ball-yellow.png'), 'default');
		if (lesson.state == STATUS.UNDERREVISION)
			nl.fmt.addAvp(avps, 'status', 'Under revision', 'text', '-', nl.url.resUrl('general/ball-maroon.png'), 'default');
		if (lesson.state == STATUS.APPROVED)
			nl.fmt.addAvp(avps, 'status', 'Approved', 'text', '-', nl.url.resUrl('general/ball-green.png'), 'default');
		if (lesson.state == STATUS.APPROVEDREWORK)
			nl.fmt.addAvp(avps, 'status', 'Approved, next update under review', 'text', '-', nl.url.resUrl('general/ball-green.png'), 'nl-24 nl-template-color');
		if (lesson.state == STATUS.APPROVEDREVIEW)
			nl.fmt.addAvp(avps, 'status', 'Approved, next update under review', 'text', '-', nl.url.resUrl('general/ball-green.png'), 'default');
	}

	function _addLinksToMycontentDetailsDlg(linkAvp, lessonId, lesson) {
		nl.fmt.addLinkToAvp(linkAvp, 'edit', nl.fmt2('/lesson/edit/{}/', lessonId));
		nl.fmt.addLinkToAvp(linkAvp, 'view', nl.fmt2('/lesson/view_priv/{}/', lessonId));
		nl.fmt.addLinkToAvp(linkAvp, 'delete', null, 'lesson_delete');
		if (lesson.state == STATUS.APPROVED || lesson.state == STATUS.APPROVEDREVIEW || lesson.state == STATUS.APPROVEDREWORK) {
			_addDisapproveLinkToDetails(linkAvp);
		} else {
			_addApproveLinkToDetails(linkAvp);
		}
		nl.fmt.addLinkToAvp(linkAvp, 'copy', null, 'lesson_copy');
	}

	function _addLinksToApprovedDetailsDlg(linkAvp, lessonId, lesson) {
		_addViewLinkforApprovedDetails(linkAvp, lessonId);
		if (lesson.grp == _userInfo.groupinfo.id)
			nl.fmt.addLinkToAvp(linkAvp, 'copy', null, 'lesson_copy');
		nl.fmt.addLinkToAvp(linkAvp, 'send assignment', null, 'send_assignment');
	}

	function _addLinksToManageDetailsDlg(linkAvp, lessonId, lesson) {
		_addViewLinkforApprovedDetails(linkAvp, lessonId);
		_addDisapproveLinkToDetails(linkAvp);
	}

	function _addViewLinkforApprovedDetails(linkAvp, lessonId) {
		nl.fmt.addLinkToAvp(linkAvp, 'view', nl.fmt2('/lesson/view/{}/', lessonId));
        _addMetadataLinkToDetails(linkAvp);
	}

	function _addLinksToReviewDetailsDlg(linkAvp, lessonId, lesson) {
		if (lesson.revstate == REVSTATE.PENDING) {
			nl.fmt.addLinkToAvp(linkAvp, 'close review', null, 'lesson_closereview');
			_addViewlinkToReviewDetails(linkAvp, lessonId);
			if (lesson.state == STATUS.UNDERREVIEW || lesson.state == STATUS.UNDERREVISION)
				_addApproveLinkToDetails(linkAvp);
			if (lesson.state == STATUS.APPROVED || lesson.state == STATUS.APPROVEDREWORK || lesson.state == STATUS.APPROVEDREVIEW)
				_addDisapproveLinkToDetails(linkAvp);
		} else if (lesson.revstate == REVSTATE.CLOSED) {
			nl.fmt.addLinkToAvp(linkAvp, 'reopen', null, 'lesson_reopen');
			_addViewlinkToReviewDetails(linkAvp, lessonId);
			if (lesson.state == STATUS.UNDERREVIEW || lesson.state == STATUS.UNDERREVISION)
				_addApproveLinkToDetails(linkAvp);
			if (lesson.state == STATUS.APPROVED || lesson.state == STATUS.APPROVEDREWORK || lesson.state == STATUS.APPROVEDREVIEW)
				_addDisapproveLinkToDetails(linkAvp);
		}
	}

	function _addApproveLinkToDetails(linkAvp) {
        if (!_userInfo.permissions.lesson_approve) return;
		nl.fmt.addLinkToAvp(linkAvp, 'approve', null, 'lesson_approve');
	}

	function _addDisapproveLinkToDetails(linkAvp) {
        if (!_userInfo.permissions.lesson_approve) return;
		nl.fmt.addLinkToAvp(linkAvp, 'disapprove', null, 'lesson_disapprove');
	}

	function _addViewlinkToReviewDetails(linkAvp, lessonId) {
		nl.fmt.addLinkToAvp(linkAvp, 'view', nl.fmt2('/lesson/view_review/{}', lessonId));
	}


    var REV_PENDING = 'Show pending items';
    var REV_DONE = 'Show completed items';
    var _additionaMetaFields = {
        revstate: {id: 'revstate', name: 'Review state', type: 'select', 
            values: [REV_PENDING, REV_DONE]}
    };

    function _onSearch(filter, searchCategory, onSearchParamChange) {
        mode.searchMetadata.search = filter;
        var cmConfig = {allowedFields: mode.getAllowedMetadataFeilds(),
            additionalFields: _additionaMetaFields};
        mode.searchMetadata.revstate = mode.revstate == 1 ? REV_PENDING : REV_DONE;
        nlMetaDlg.showAdvancedSearchDlg($scope, _userInfo, 'module', mode.searchMetadata, cmConfig)
        .then(function(result) {
            mode.searchMetadata = result.metadata;
            mode.revstate = mode.searchMetadata.revstate == REV_PENDING ? 1 : 2;
            if (mode.custtype) mode.searchMetadata.custtype = mode.custtype;
            onSearchParamChange(mode.searchMetadata.search || '', searchCategory);
            _reloadFromServer();
        });
    }

    function _fetchMore() {
        _reloadFromServer(true);
    }
    
	function _reloadFromServer(fetchMore) {
		nlDlg.showLoadingScreen();
		var promise = nl.q(function(resolve, reject) {
			_getDataFromServer(fetchMore, resolve, reject);
		});
		promise.then(function(res) {
			nlDlg.hideLoadingScreen();
		});
	}

	function _deleteLesson($scope, lessonId) {
		var msg = {
			title : 'Please confirm',
			template : nl.t('Are you sure you want to delete this module?'),
			okText : nl.t('Delete')
		};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result)
				return;
			nlDlg.showLoadingScreen();
			nlServerApi.lessonDelete(lessonId).then(function(status) {
				nlDlg.hideLoadingScreen();
				_updateCardlist($scope, lessonId);
			});
		});
	}

	function _metadataLesson($scope, lessonId, card) {
	    nlMetaDlg.showMetadata($scope, _userInfo, 'module', lessonId, card)
	    .then(function() {
	        _reloadFromServer();
	    });
	}

    function _disapproveLesson($scope, lessonId) {
        var msg = {
            title : 'Please confirm',
            template : nl.t('Are you sure you want to disapprove this module and send it for review?'),
            okText : nl.t('Disapprove')
        };
        nlDlg.popupConfirm(msg).then(function(result) {
            if (!result)
                return;
            nlDlg.showLoadingScreen();
            nlServerApi.lessonDisapprove(lessonId).then(function(status) {
                nlDlg.hideLoadingScreen();
                nlDlg.closeAll();
                _reloadFromServer();
            });
        });
    }

	function _approveLesson($scope, lessonId) {
		nlApproveDlg.show($scope, _userInfo.groupinfo.exportLevel, lessonId);
	}

	function _copyLesson($scope, lessonId) {
		var data = {};
		if (mode.mode == MODES.MY) {
			data = {
				lessonid : lessonId,
				private : true
			};
		} else {
			data = {
				lessonid : lessonId,
				private : false
			};
		}
		var msg = {
			title : 'Copy module',
			template : nl.t('Are you sure you want to make a private copy of this module?'),
			okText : nl.t('Copy')
		};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result)
				return;
			nlServerApi.lessonCopy(data).then(function(status) {
				nlDlg.showLoadingScreen();
				$scope.newLessonId = status;
				$scope.statusType = false;
				if (mode.mode != MODES.MY)
					$scope.statusType = true;
				var copyLessonDlg = nlDlg.create($scope);
				copyLessonDlg.scope.error = {};
				var copyButton = {
					text : nl.t('Ok'),
					onTap : function(e) {
						_reloadFromServer();
					}
				};
				var closeButton = {
					text : nl.t('Close'),
					onTap : function(e) {
						_reloadFromServer();
					}
				};
				copyLessonDlg.show('view_controllers/lesson_list/copy_lesson.html', [copyButton], closeButton, false);
				nlDlg.hideLoadingScreen();
			});

		});
	}


	$scope.gotoMyLessonsFromApproved = function() {
		nl.location.url('lesson_list?type=my');
	};

	function _reopenLesson($scope, lessonId) {
		var msg = {
			title : 'Please confirm',
			template : nl.t('Are you sure you want to reopen the review?'),
			okText : nl.t('reopen')
		};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result)
				return;
			nlServerApi.lessonReopenReview(lessonId).then(function(status) {
				nlDlg.showLoadingScreen();
				_updateCardAfterReviewlist();
			});
		});
	}

	function _closereviewLesson($scope, lessonId) {
		var msg = {
			title : 'Please confirm',
			template : nl.t('Are you sure you want to close the review?'),
			okText : nl.t('close review')
		};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result)
				return;
			nlServerApi.lessonCloseReview(lessonId).then(function(status) {
				nlDlg.showLoadingScreen();
				_updateCardAfterReviewlist();
			});
		});
	}

	function _updateCardlist($scope, lessonId) {
		for (var i in $scope.cards.cardlist) {
			var card = $scope.cards.cardlist[i];
			if (card.lessonId !== lessonId)
				continue;
			$scope.cards.cardlist.splice(i, 1);
		}
        nlCardsSrv.updateCards($scope.cards);
		nlDlg.closeAll();
	}

	function _updateCardAfterReviewlist() {
		nlDlg.closeAll();									
		_reloadFromServer();
	}

}; // End of init function
}];

//-------------------------------------------------------------------------------------------------
var ExportLevelSrv = [function() {
    
    this.EL_PRIVATE = 0;
    this.EL_DEPENDANT = 1;
    this.EL_LOGEDIN = 2;
    this.EL_PUBLIC = 3;

    var _exportLevelDesc = ['Visible only to users within the group', 'Visible to users within the group and dependent groups', 'Visible to every logedin user', 'Visible to everyone'];
    
    this.getExportLevelInfo = function(exportLevel) {
        var ret = {elOptions: [], elList: [], elDesc: {}};
        for (var i = 0; i <= exportLevel; i++) {
            ret.elOptions.push({id : i, name : _exportLevelDesc[i]});
            ret.elList.push(i);
            ret.elDesc[i] = _exportLevelDesc[i];
        }
        return ret;
    };
    
}];

//-------------------------------------------------------------------------------------------------
var ApproveDlgSrv = ['nl', 'nlDlg', 'nlServerApi', 'nlExportLevel', 
'nlGroupInfo', 'nlTreeSelect', 'nlOuUserSelect',
function(nl, nlDlg, nlServerApi, nlExportLevel, nlGroupInfo, nlTreeSelect, nlOuUserSelect) {
    var _filterTrees = null;
    var _nextPage = null;
	this.show = function(parentScope, groupExportLevel, lessonId, nextPage) {
	    _nextPage = nextPage || null;
		var approveDlg = nlDlg.create(parentScope);
		_initDlg(approveDlg, groupExportLevel, lessonId);
		nlDlg.showLoadingScreen();

        nlGroupInfo.init().then(function() {
            nlGroupInfo.update();
			nlServerApi.lessonPreApproveCheck(lessonId).then(function(data) {
				nlDlg.hideLoadingScreen();
				_onPreApproveDone(data, approveDlg, groupExportLevel);
				_showDlg(approveDlg);
			});
        });
	};

    function _filterArrayToDict(filters) {
        var ret = {};
        for(var key in filters) {
            var values = filters[key];
            ret[key] = {};
            for (var i=0; i<values.length; i++) {
                ret[key][values[i]] = true;
            }
        }
        return ret;
    }
    
    function _filterDictToArray(filters) {
        var ret = {};
        for(var key in filters) {
            var values = filters[key];
            ret[key] = [];
            for (var key1 in values) {
                ret[key].push(key1);
            }
        }
        return ret;
    }

    function _getSelectedOusFromTree(treeInfo) {
        var selected = nlTreeSelect.getSelectedIds(treeInfo);
        var ret = [];
        for(var key in selected) {
            ret.push(key);
        }
        return ret;
    }

	function _initDlg(approveDlg, groupExportLevel, lessonId) {
		approveDlg.lessonId = lessonId;
		approveDlg.setCssClass('nl-height-max nl-width-max');
		approveDlg.scope.error = {};
		approveDlg.scope.data = {};
		approveDlg.scope.options = {};
		approveDlg.scope.options.exportLevel = nlExportLevel.getExportLevelInfo(groupExportLevel).elOptions;
	}

	function _onPreApproveDone(data, approveDlg, groupExportLevel) {
        var filterValues = _filterArrayToDict(data.usermetadata || {});
        _filterTrees = nlOuUserSelect.getMetadataFilterTrees(filterValues, false);
        approveDlg.scope.data.filters = _filterTrees.getFilters();

        var groupInfo = nlGroupInfo.get();
        approveDlg.scope.data.org_unit = nlOuUserSelect.getOuTree(groupInfo, 
            data.selectedOus, true, true);

		var el = data.exportLevel && data.exportLevel <= groupExportLevel ? data.exportLevel : nlExportLevel.EL_PRIVATE;
		approveDlg.scope.data.exportLevel = {
			id : el
		};
	}

	function _onApproveClick(e, approveDlg) {
		if (e) e.preventDefault();
        var filterValues = _filterDictToArray(_filterTrees.getSelectedFilters());
		var data = {
			lessonid: approveDlg.lessonId,
            exportLevel: approveDlg.scope.data.exportLevel.id,
            selectedOus: _getSelectedOusFromTree(approveDlg.scope.data.org_unit),
            usermetadata: filterValues
		};
        nlDlg.showLoadingScreen();
		nlServerApi.lessonApprove(data).then(function(status) {
			nlDlg.hideLoadingScreen();
            approveDlg.close(false);
            approveDlg.destroy();
            if (_nextPage) nl.window.location.href = _nextPage;
            else nl.window.location.reload();
		});
	}

	function _showDlg(approveDlg) {
		var approveButton = {text : nl.t('Approve'), onTap : function(e) {
			_onApproveClick(e, approveDlg);
		}};
		var cancelButton = {text : nl.t('Cancel')};
		approveDlg.show('view_controllers/lesson_list/lesson_approve_dlg.html', [approveButton], cancelButton, false);
	}

}];

module_init();
})();

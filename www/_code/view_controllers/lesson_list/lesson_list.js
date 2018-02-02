(function() {

//-------------------------------------------------------------------------------------------------
// lesson_list.js:
// lesson list module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.lessonlist', ['nl.lessontranslate']).config(configFn)
	.controller('nl.LessonListCtrl', LessonListCtrl)
	.service('nlModuleStatusInfo', ModuleStatusInfoSrv)
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
    'fyellow ion-chatbubble-working',
    'forange ion-alert-circled',
    'fgreen ion-checkmark-circled',
    'forange ion-alert-circled',
    'fgreen ion-chatbubble-working'
];

var STATUS_HELP = [
    'Module created and not yet shared for review.',
    'Author has shared the module for review.',
    'Reviewer has rejected the module and the author needs to rework.',
    'Module is approved.',
    'Module is approved. Reviewer has rejected the next update and the author needs to rework.',
    'Module is approved and the next update is shared for review.'
];

var LESSONTYPES = {
	LESSON : 0,
	TEMPLATE : 1
};

var REVSTATE = {
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

    this.metadataEnabled = false;
    this.searchMetadata = {};
    this.resultList = [];
    this.revstate = 1;

	this.initFromUrl = function(params) {
		if (!params) params = nl.location.search();
		_convertMode(params.type);
		self.revstate = ('revstate' in params) ? parseInt(params.revstate) : 1;
		self.searchMetadata = (!params.showInDlg) ? nlMetaDlg.getMetadataFromUrl() : {};
		self.title = params.title || null;
	};
	
	this.getListFnAndUpdateParams = function(params) {
        var fn = nlServerApi.lessonGetApprovedList;
		if (self.mode == MODES.NEW) {
			fn = nlServerApi.lessonGetTemplateList;
		} else if (self.mode == MODES.MY) {
			fn = nlServerApi.lessonGetPrivateList;
		} else if (self.mode == MODES.MANAGE) {
			fn = nlServerApi.lessonGetManageApprovedList;
		} else if (self.mode == MODES.REVIEW) {
			params.revstate = self.revstate;
			fn = nlServerApi.lessonGetReviewList;
		} else if (self.mode == MODES.SENDASSIGNMENT) {
			fn = nlServerApi.lessonGetApprovedList;
		}
		return fn;
	};

	this.pageTitle = function() {
		if (self.title) return self.title;
		if (self.mode == MODES.NEW) return nl.t('Create new: select the template');
		if (self.mode == MODES.APPROVED) return nl.t('Approved modules');
		if (self.mode == MODES.MY) return nl.t('My modules');
		if (self.mode == MODES.MANAGE) return nl.t('Manage approved modules');
        if (self.mode == MODES.SENDASSIGNMENT) return nl.t('Send Assignment');
		if (self.mode == MODES.REVIEW && self.revstate == REVSTATE.PENDING) return nl.t('Review modules');
        if (self.mode == MODES.REVIEW && self.revstate == REVSTATE.CLOSED) return nl.t('Review modules: completed reviews');
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
'nlApproveDlg', 'nlSendAssignmentSrv', 'nlMetaDlg', 'nlGroupInfo',
function(nl, nlRouter, nlDlg, nlCardsSrv, nlServerApi, nlApproveDlg, nlSendAssignmentSrv, 
	nlMetaDlg, nlGroupInfo) {
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
		params.resolve = function(result) {
		    if (!result) return;
            _selectDlg.show('view_controllers/lesson_list/lesson_select_dlg.html', [], closeButton);
		};
		self.show(_selectDlg.scope, initialUserInfo, params);
	});
};

this.show = function($scope, initialUserInfo, params) {
	var _showInDlg = params && params.showInDlg;
	var mode = new ModeHandler(nl, nlServerApi, nlMetaDlg);
	var _userInfo = null;
    var _pageFetcher = nlServerApi.getPageFetcher();

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
	        nlGroupInfo.init().then(function() {
	            _getDataFromServer(resolve);
			});
		});
	}

	if (_showInDlg) {
		nlDlg.showLoadingScreen();
    	_onPageEnter(initialUserInfo).then(function(result) {
			nlDlg.hideLoadingScreen();
			if (params.resolve) params.resolve(result);
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
				url : "/lesson/create2",
				linkId : "admin_group",
				children : []
			}, {
                title : "Create based on pdf",
                url : "/lesson/create2/0/0/pdf",
                linkId : "admin_group",
                children : []
            }],
			style : 'nl-bg-blue',
			links: []
		};
        if (_userInfo.permissions.nittio_support) {
            card.children.push({
                title : "create a new template",
                url : "/lesson/create2/0/1",
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
			var assignInfo = {
				type : 'lesson',
				id : card.lessonId,
				icon : card.icon,
				title : card.title,
				authorName : card.authorName,
				subjGrade : nl.fmt2('{}, {}', card.subject, card.grade),
				description : card.description,
				esttime : card.esttime ? card.esttime : ''
			};
			nlSendAssignmentSrv.show($scope, assignInfo);
		}
	};

	$scope.onCardLinkClicked = function(card, linkId) {
	    $scope.onCardInternalUrlClicked(card, linkId);
	};

	function _getDataFromServer(resolve, fetchMore) {
        var params = {};
        if (!fetchMore) mode.resultList = [];
        params.metadata = mode.searchMetadata;
        var listingFn = mode.getListFnAndUpdateParams(params);
        _pageFetcher.fetchPage(listingFn, params, fetchMore, function(results) {
            if (!results) {
                if (resolve) resolve(false);
                return;
            }
            mode.resultList = mode.resultList.concat(results);
            nlCardsSrv.updateCards($scope.cards, {
                cardlist: _getLessonCards(_userInfo, mode.resultList),
                canFetchMore: _pageFetcher.canFetchMore()
            });
            if (resolve) resolve(true);
		});
	}

	function _getLessonCards(userInfo, resultList) {
		var cards = [];
		for (var i = 0; i < resultList.length; i++)
			cards.push(_createLessonCard(resultList[i], userInfo));
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
            description : lesson.description,
            esttime : lesson.esttime,
            children : [],
            links: [],
            details: {help: lesson.description, avps: _getLessonListAvps(lesson)}
        };
        _updateCardUrl(card, lesson, userInfo);
        _updateCardHelp(card, lesson, userInfo);
        _updateLinks(card, lesson, userInfo);
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
    
    function _updateCardHelp(card, lesson, userInfo) {
        var gap = '<div style="height: 4px;"></div>';
        var gradeSubj = nl.fmt2("<div><b>{}, {}</b></div>{}", lesson.grade, lesson.subject, gap);
        var template = '';
        if (lesson.ltype == LESSONTYPES.TEMPLATE)
            template = nl.fmt2("<div class='fgreen'><b>Template</b></div>{}", gap);
        var status = nl.fmt2("{}{}", _getStatusStr(lesson), gap);
        var author = nl.fmt2("<div>by: {}</div>{}", lesson.authorname, gap);
        var desc = nl.fmt2("<div>{}</div>", lesson.description);

        var content = '';
        if (mode.mode == MODES.MY)
            content = nl.fmt2('{}{}{}{}', gradeSubj, template, status, desc);
        else if (mode.mode == MODES.APPROVED
            || mode.mode == MODES.SENDASSIGNMENT
            || mode.mode == MODES.MANAGE)
            content = nl.fmt2('{}{}{}{}', gradeSubj, template, author, desc);
        else if (mode.mode == MODES.NEW)
            content = nl.fmt2('{}{}{}', gradeSubj, author, desc);
        else if (mode.mode == MODES.REVIEW) {
            var revstatus = nl.fmt2("{}{}", _getRevstateStr(lesson), gap);
            content = nl.fmt2('{}{}{}{}', gradeSubj, author, template, revstatus);
        }
        card.help = nl.t("<span class='nl-card-description'>{}</span>", content);
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
            _addApproveLink(lesson, card);
            _addMetadataLink(card);
        } else if (mode.mode == MODES.REVIEW) {
            if (lesson.revstate == REVSTATE.CLOSED) card.links.push({id : 'lesson_reopen', text: nl.t('reopen')});
            else card.links.push({id: 'lesson_closereview', text : nl.t('close review')});
            _addApproveLink(lesson, card);
        }
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
            nl.fmt.addAvp(avps, 'Status', _getStatusStr(lesson));
        nl.fmt.addAvp(avps, 'Created on ', lesson.created, 'date');
        nl.fmt.addAvp(avps, 'Updated on', lesson.updated, 'date');
        nl.fmt.addAvp(avps, 'Author', lesson.authorname);
        nl.fmt.addAvp(avps, 'Group', lesson.grpname);
        nl.fmt.addAvp(avps, 'Is Template', lesson.ltype, 'boolean');

        if (_isApproved(lesson)) {
            nl.fmt.addAvp(avps, 'Approved by', lesson.approvername);
            nl.fmt.addAvp(avps, 'Approved on', lesson.approvedon, 'date');
            nl.fmt.addAvp(avps, 'Approved to', _getApprovedToString(lesson), '-');
        }
        if (mode.mode == MODES.REVIEW) {
            nl.fmt.addAvp(avps, 'Remarks', lesson.remarks);
            nl.fmt.addAvp(avps, 'Review status', _getRevstateStr(lesson));
        }
        nl.fmt.addAvp(avps, 'Description', lesson.description);
        return avps;
    }

    function _populateLinks(linkAvp, lessonId, lesson) {
        if (mode.mode == MODES.NEW) {
            nl.fmt.addLinkToAvp(linkAvp, 'select', nl.fmt2('/lesson/create2/{}/0', lessonId));
        } else if (mode.mode == MODES.MY) {
            nl.fmt.addLinkToAvp(linkAvp, 'edit', nl.fmt2('/lesson/edit/{}/', lessonId));
            nl.fmt.addLinkToAvp(linkAvp, 'view', nl.fmt2('/lesson/view_priv/{}/', lessonId));
            nl.fmt.addLinkToAvp(linkAvp, 'delete', null, 'lesson_delete');
            _addApproveLinkToDetails(lesson, linkAvp);
            nl.fmt.addLinkToAvp(linkAvp, 'copy', null, 'lesson_copy');
        } else if (mode.mode == MODES.APPROVED || mode.mode == MODES.MANAGE) {
            nl.fmt.addLinkToAvp(linkAvp, 'view', nl.fmt2('/lesson/view/{}/', lessonId));
            if (lesson.grp == _userInfo.groupinfo.id)
                nl.fmt.addLinkToAvp(linkAvp, 'copy', null, 'lesson_copy');
            nl.fmt.addLinkToAvp(linkAvp, 'send assignment', null, 'send_assignment');
            _addApproveLinkToDetails(lesson, linkAvp);
            _addMetadataLinkToDetails(linkAvp);
        } else if (mode.mode == MODES.SENDASSIGNMENT) {
            nl.fmt.addLinkToAvp(linkAvp, 'view', nl.fmt2('/lesson/view/{}', lessonId));
            nl.fmt.addLinkToAvp(linkAvp, 'select', null, 'send_assignment');
            _addMetadataLinkToDetails(linkAvp);
        } else if (mode.mode == MODES.REVIEW) {
            if (lesson.revstate == REVSTATE.PENDING) {
                nl.fmt.addLinkToAvp(linkAvp, 'close review', null, 'lesson_closereview');
            } else if (lesson.revstate == REVSTATE.CLOSED) {
                nl.fmt.addLinkToAvp(linkAvp, 'reopen', null, 'lesson_reopen');
            }
            nl.fmt.addLinkToAvp(linkAvp, 'view', nl.fmt2('/lesson/view_review/{}', lessonId));
            _addApproveLinkToDetails(lesson, linkAvp);
        }
    }

    function _isApproved(lesson) {
        if (mode.mode == MODES.NEW || mode.mode == MODES.SENDASSIGNMENT
            || mode.mode == MODES.APPROVED || mode.mode == MODES.MANAGE) return true;
        return false;
    }

    function _getApproveAction(lesson) {
        if (mode.mode == MODES.NEW || mode.mode == MODES.SENDASSIGNMENT 
            || mode.modeStr == 'selfassign' || _showInDlg) return null;
        if (!_userInfo.permissions.lesson_approve) return null;
        if (mode.mode == MODES.APPROVED || mode.mode == MODES.MANAGE) return 'disapprove';
        if (mode.mode == MODES.MY)
            return (lesson.state == STATUS.APPROVED || lesson.state == STATUS.APPROVEDREWORK 
                || lesson.state == STATUS.APPROVEDREVIEW) ? 'disapprove' : 'approve';
        if (mode.mode == MODES.REVIEW)
            return (mode.revstate == REVSTATE.PENDING) ? 'approve' : null;
        return null;
    }

	function _addApproveLink(lesson, card) {
	    var action = _getApproveAction(lesson);
	    if (action == 'approve') card.links.push({id: 'lesson_approve', text: nl.t('approve')});
	    else if (action == 'disapprove') card.links.push({id: 'lesson_disapprove', text: nl.t('disapprove')});
	}

    function _addApproveLinkToDetails(lesson, linkAvp) {
        var action = _getApproveAction(lesson);
        if (action == 'approve') nl.fmt.addLinkToAvp(linkAvp, 'approve', null, 'lesson_approve');
        else if (action == 'disapprove') nl.fmt.addLinkToAvp(linkAvp, 'disapprove', null, 'lesson_disapprove');
    }

    function _addMetadataLink(card) {
        if (!mode.metadataEnabled) return;
        if (_showInDlg || mode.modeStr == 'selfassign') return;
        card.links.push({id : 'lesson_metadata', text : nl.t('metadata')});
    }

    function _addMetadataLinkToDetails(linkAvp) {
        if (!mode.metadataEnabled) return;
        if (_showInDlg || mode.modeStr == 'selfassign') return;
        nl.fmt.addLinkToAvp(linkAvp, 'metadata', null, 'lesson_metadata');
    }

    function _getStatusStr(lesson) {
        var state = lesson.state || STATUS.PRIVATE;
        return nl.fmt2("<div><i class='icon fsh4 {}'></i><span class='padding-small-h'></span>{}</div>",
            STATUS_ICON[state], STATUS_STR[state]);
    }
    
    function _getApprovedToString(lesson) {
    	var metaDataValues = lesson.usermetadata ? JSON.parse(lesson.usermetadata) : {};
    	if((Object.keys(metaDataValues).length == 0) && (lesson.oulist == '')) return 'all organizations';

    	var approvedString = '<div><ul>';
		if(lesson.oulist != '') approvedString += nl.t('<li class="sep4"><b>Organistaions: </b>{}</li>', lesson.oulist);

        if(metaDataValues) {
	        var metaFields = nlGroupInfo.getUserMetadata(null);
        	for(var i=0; i<metaFields.length; i++) {
        		var meta = metaFields[i];
        		if (!(meta.id in metaDataValues)) continue;
				approvedString += nl.t('<li class="sep4"><b>{}: </b>{}</li>', meta.name, metaDataValues[meta.id].toString());
        	}
        }
        return approvedString += '</ul></div>';
    }
    
    function _getRevstateStr(lesson) {
        var revstate = lesson.revstate == REVSTATE.CLOSED ? 'Review done' : 'Review pending';
        var resicon = lesson.revstate == REVSTATE.CLOSED ? 'ion-checkmark-circled fgreen' : 'ion-chatbubble-working fyellow';
        return nl.fmt2("<div><i class='icon fsh4 {}'></i><span class='padding-small-h'></span>{}</div>", 
            resicon, revstate);
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
            additionalFields: mode.mode == MODES.REVIEW ? _additionaMetaFields : {},
            canFetchMore: $scope.cards.canFetchMore,
            banner: $scope.cards._internal.search.infotxt2};
        if (mode.mode == MODES.REVIEW)
            mode.searchMetadata.revstate = mode.revstate == 1 ? REV_PENDING : REV_DONE;
        nlMetaDlg.showAdvancedSearchDlg($scope, _userInfo, 'module', mode.searchMetadata, cmConfig)
        .then(function(result) {
            if (result.canFetchMore) return _fetchMore();
            mode.searchMetadata = result.metadata;
            if (mode.mode == MODES.REVIEW)
                mode.revstate = mode.searchMetadata.revstate == REV_PENDING ? 1 : 2;
            nl.pginfo.pageTitle = mode.pageTitle();
            onSearchParamChange(mode.searchMetadata.search || '', searchCategory);
            _getDataFromServer();
        });
    }

    function _fetchMore() {
        _getDataFromServer(null, true);
    }
    
    function _deleteLesson($scope, lessonId) {
        _confirmAndCall($scope, lessonId, nlServerApi.lessonDelete, false, {
            template : nl.t('Are you sure you want to delete this module?'),
            okText : nl.t('Delete')         
        });
    }

    function _reopenLesson($scope, lessonId) {
        _confirmAndCall($scope, lessonId, nlServerApi.lessonReopenReview, false, {
            template : nl.t('Are you sure you want to reopen the review?'),
            okText : nl.t('reopen')
        });
    }

    function _closereviewLesson($scope, lessonId) {
        _confirmAndCall($scope, lessonId, nlServerApi.lessonCloseReview, false, {
            template : nl.t('Are you sure you want to close the review?'),
            okText : nl.t('close review')
        });
    }

    function _disapproveLesson($scope, lessonId) {
        _confirmAndCall($scope, lessonId, nlServerApi.lessonDisapprove, true, {
            template : nl.t('Are you sure you want to disapprove this module and send it for review?'),
            okText : nl.t('Disapprove')
        });
    }

    function _confirmAndCall($scope, lessonId, method, reload, confirmMsg) {
        confirmMsg.title = 'Please confirm';
        nlDlg.popupConfirm(confirmMsg).then(function(result) {
            if (!result) return;
            nlDlg.showLoadingScreen();
            method(lessonId).then(function(status) {
                nlDlg.hideLoadingScreen();
                nlDlg.closeAll();
                if (reload) _getDataFromServer();
                else _updateCardlist($scope, lessonId);
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
    }

	function _metadataLesson($scope, lessonId, card) {
	    nlMetaDlg.showMetadata($scope, _userInfo, 'module', lessonId, card)
	    .then(function() {
	        _getDataFromServer();
	    });
	}

	function _approveLesson($scope, lessonId) {
		nlApproveDlg.show($scope, _userInfo.groupinfo.exportLevel, lessonId);
	}

	function _copyLesson($scope, lessonId) {
		var msg = {
			title : 'Copy module',
			template : nl.t('Are you sure you want to make a private copy of this module?'),
			okText : nl.t('Copy')
		};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;
            var data = {lessonid : lessonId, private: mode.mode == MODES.MY};
            nlDlg.showLoadingScreen();
			nlServerApi.lessonCopy(data).then(function(newLessonId) {
				$scope.newLessonId = newLessonId;
				$scope.isApproved = (mode.mode != MODES.MY);
				var copyLessonDlg = nlDlg.create($scope);
				copyLessonDlg.scope.error = {};
				var closeButton = {text : nl.t('Close'), onTap : function(e) {
					_getDataFromServer();
				}};
				copyLessonDlg.show('view_controllers/lesson_list/copy_lesson.html', [], closeButton);
				nlDlg.hideLoadingScreen();
			});

		});
	}


	$scope.gotoMyLessonsFromApproved = function() {
		nl.location.url('lesson_list?type=my');
	};
}; // End of init function
}];

//-------------------------------------------------------------------------------------------------
var ModuleStatusInfoSrv = ['nl', 
function(nl) {
	this.getStatusInfos = function() {
		var ret = [];
		ret.push(_item(STATUS.PRIVATE));
		ret.push(_item(STATUS.UNDERREVIEW));
		ret.push(_item(STATUS.UNDERREVISION));
		ret.push(_item(STATUS.APPROVED));
		ret.push(_item(STATUS.APPROVEDREVIEW));
		ret.push(_item(STATUS.APPROVEDREWORK));
		return ret;
	};
	
	function _item(status) {
		return {status: status, title: STATUS_STR[status], icon: STATUS_ICON[status], help: STATUS_HELP[status]};
	}
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
            data.selectedOus, false, true);

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

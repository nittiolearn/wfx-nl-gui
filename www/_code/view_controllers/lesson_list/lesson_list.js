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
	var TYPES = {
		NEW : 0,
		APPROVED : 1,
		MY : 2,
		MANAGE : 3,
		REVIEW : 4,
		SENDASSIGNMENT : 5
	};
	var TYPENAMES = {
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
	function TypeHandler(nl, nlServerApi, nlMetaDlg) {
		this.type = TYPES.NEW;
		this.custtype = null;
		this.searchFilter = null;
        this.searchGrade = null;
        this.searchMetadata = {};
		this.revstate = null;
		this.title = null;
		this.content = null;
        this.canEnableMetadata = false;
        this.metadataEnabled = false;
		var self=this;
        self.start_at = 0;
        self.max = 50;
        self.canFetchMore = true;
        self.resultList = [];

		this.initFromUrl = function(params) {
			if (!params) params = nl.location.search();
			_convertType(params.type);
			this.custtype = ('custtype' in params) ? parseInt(params.custtype) : null;
			this.revstate = ('revstate' in params) ? parseInt(params.revstate) : null;
			this.searchGrade = ('grade' in params) ? params.grade : null;
			this.searchFilter = ('search' in params) ? params.search : null;
			this.searchMetadata = (!params.showInDlg) ? nlMetaDlg.getMetadataFromUrl() : {};
            this.canEnableMetadata = ('enablemeta' in params);
			this.title = params.title || null;
			this.content = params.content || null;
		};
		
        this.getFullResultList = function(results) {
            self.resultList = self.resultList.concat(results);
            self.canFetchMore = (results.length > self.max);
            self.start_at += results.length;
            return self.resultList;
        };
        
		this.listingFunction = function(fetchMore) {
		    if (!self.canFetchMore || !fetchMore) {
		        self.start_at = 0;
		        self.canFetchMore = true;
                self.resultList = [];
		    }
			var data = {start_at: self.start_at, max: self.max};
			if (this.custtype !== null) data.custtype = this.custtype;
			if (this.searchFilter !== null) data.search = this.searchFilter;
			if (this.searchGrade !== null) data.grade = this.searchGrade;
            if (this.content !== null) data.content = this.content;
            if (this.metadataEnabled) data.metadata = this.searchMetadata;
			if (this.type == TYPES.NEW) {
				return nlServerApi.lessonGetTemplateList(data);
			} else if (this.type == TYPES.MY) {
				return nlServerApi.lessonGetPrivateList(data);
			} else if (this.type == TYPES.MANAGE) {
				return nlServerApi.lessonGetManageApprovedList(data);
			} else if (this.type == TYPES.REVIEW) {
				data.revstate = this.revstate;
				return nlServerApi.lessonGetReviewList(data);
			} else if (this.type == TYPES.SENDASSIGNMENT) {
				return nlServerApi.lessonGetApprovedList(data);
			} else {
				return nlServerApi.lessonGetApprovedList(data);
			}
		};

		this.pageTitle = function() {
			if (this.title)
				return this.title;
			if (this.type == TYPES.NEW)
				return nl.t('Create new: select the template');
			if (this.type == TYPES.APPROVED)
				return nl.t('Approved modules');
			if (this.type == TYPES.MY)
				return nl.t('My modules');
			if (this.type == TYPES.MANAGE)
				return nl.t('Manage approved modules');
			if (this.type == TYPES.REVIEW)
				return nl.t('Review modules');
			if (this.type == TYPES.SENDASSIGNMENT)
				return nl.t('Send Assignment');
			return '';
		};

		function _convertType(typeStr) {
			self.typeStr = (typeStr || '').toLowerCase();
			self.type = (typeStr in TYPENAMES) ? TYPENAMES[self.typeStr] : TYPES.APPROVED;
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
		var mode = new TypeHandler(nl, nlServerApi, nlMetaDlg);
		var _userInfo = null;
		var _allCardsForReview = [];

		function _onPageEnter(userInfo) {
			_userInfo = userInfo;
			return nl.q(function(resolve, reject) {
				mode.initFromUrl(params);
				if (!_showInDlg) nl.pginfo.pageTitle = mode.pageTitle();
				$scope.cards = {};
				$scope.cards.staticlist = _getStaticCard();
				$scope.cards.emptycard = nlCardsSrv.getEmptyCard();
                mode.metadataEnabled = mode.canEnableMetadata && (
                    (mode.type == TYPES.APPROVED) ||
                    (mode.type == TYPES.MANAGE) ||
                    (mode.type == TYPES.SENDASSIGNMENT));
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
			var ret = [];
			if (mode.type == TYPES.APPROVED || mode.type == TYPES.MANAGE || mode.type == TYPES.MY || mode.type == TYPES.SENDASSIGNMENT)
				return ret;
			var card = {};
			if (mode.type == TYPES.NEW) {
				card = {
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
					style : 'nl-bg-blue'
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
			} else if (mode.type == TYPES.REVIEW) {
				card = {
					title : nl.t('Review'),
					icon : nl.url.resUrl('dashboard/wsheet.png'),
					children : [{
						title : "view all",
						internalUrl : "view_all",
						children : []
					}, {
						title : "view pending reviews",
						internalUrl : "view_pending",
						children : []
					}, {
						title : "view closed reviews",
						internalUrl : "view_closed",
						children : []
					}],
					style : 'nl-bg-blue'
				};
			}
			card.links = [];
			ret.push(card);
			return ret;
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
			} else if (internalUrl === 'view_all') {
				_showReviewCards($scope, REVSTATE.ALL);
			} else if (internalUrl === 'view_pending') {
				_showReviewCards($scope, REVSTATE.PENDING);
			} else if (internalUrl === 'view_closed') {
				_showReviewCards($scope, REVSTATE.CLOSED);
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
			mode.listingFunction(fetchMore).then(function(resultList) {
			    resultList = mode.getFullResultList(resultList);
				nl.log.debug('Got result: ', resultList.length);
				$scope.cards.cardlist = _getLessonCards(_userInfo, resultList);
				_allCardsForReview = $scope.cards.cardlist;
				if (mode.type == TYPES.REVIEW)
					_showReviewCards($scope, REVSTATE.PENDING);
				_addSearchInfo($scope.cards);
				resolve(true);
			}, function(reason) {
				resolve(false);
			});
		}

		function _getLessonCards(userInfo, resultList) {
			var cards = [];
			for (var i = 0; i < resultList.length; i++) {
				var card = _createLessonCard(resultList[i], userInfo);
				cards.push(card);
			}
			return cards;
		}

		function _createLessonCard(lesson, userInfo) {
			var url = null;
			var internalUrl = null;
			if (mode.type == TYPES.APPROVED || mode.type == TYPES.MANAGE)
				if(_showInDlg) {
					internalUrl = 'lesson_select';
				} else if (mode.typeStr == 'selfassign'){
                    url = nl.fmt2('/lesson/do_report_selfassign?lessonid={}', lesson.id);
                } else {
					url = nl.fmt2('/lesson/view/{}/', lesson.id);
				}
			if (mode.type == TYPES.MY)
				url = nl.fmt2('/lesson/edit/{}/', lesson.id);
			if (mode.type == TYPES.REVIEW)
				url = nl.fmt2('/lesson/view_review/{}/', lesson.id);
			if (mode.type == TYPES.NEW)
				url = nl.fmt2('/lesson/create2/{}/', lesson.id);
			if (mode.type == TYPES.SENDASSIGNMENT)
				internalUrl = 'send_assignment';
			var card = {
				lessonId : lesson.id,
				grp: lesson.grp,
				revstateId : lesson.revstate,
				title : lesson.name,
				subject : lesson.subject,
				grade : lesson.grade,
				icon : nl.url.lessonIconUrl(lesson.image),
				url : url,
				internalUrl : internalUrl,
				authorName : lesson.authorname,
				description : lesson.description,
				content : lesson.content,
				children : []
			};
			card.details = {
				help : lesson.descMore,
				avps : _getLessonListAvps(lesson)
			};
			card.links = [];
			if (mode.type == TYPES.MY) {
				_addHelpToMycontent(card, lesson);
			} else if (mode.type == TYPES.APPROVED) {
				_addHelpToApproved(card, lesson);
				if (!_showInDlg && lesson.grp == _userInfo.groupinfo.id)
					card.links.push({id : 'lesson_copy', text : nl.t('copy')});
                _addMetadataLink(card);
    		} else if (mode.type == TYPES.SENDASSIGNMENT) {
				card.links.push({id : 'lesson_view', text : nl.t('view')});
				_addHelpToApproved(card, lesson);
                _addMetadataLink(card);
			} else if (mode.type == TYPES.NEW) {
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br> by:{}<br> <span class='nl-template-color'>Template</span><br> <span>{}</span>", lesson.grade, lesson.subject, lesson.authorname, lesson.description);
                _addMetadataLink(card);
			} else if (mode.type == TYPES.MANAGE) {
				if (lesson.ltype == LESSONTYPES.LESSON || lesson.ltype == null)
					card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br> by:{}<br>", lesson.grade, lesson.subject, lesson.authorname);
				if (lesson.ltype == LESSONTYPES.TEMPLATE)
					card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br> by:{}<br> <span class='nl-template-color'>Template</span><br>", lesson.grade, lesson.subject, lesson.authorname);
				_addDisapproveLink(card);
                _addMetadataLink(card);
			} else if (mode.type == TYPES.REVIEW) {
				if (lesson.revstate == REVSTATE.PENDING && lesson.state == STATUS.UNDERREVIEW) {
					_addReviewLinkForUnderReview(card, lesson);
				} else if (lesson.revstate == REVSTATE.CLOSED && lesson.state == STATUS.UNDERREVIEW) {
					_addReviewLinkForClosedUnderReview(card, lesson);
				}
				;
				if (lesson.revstate == REVSTATE.PENDING && lesson.state == STATUS.UNDERREVISION) {
					_addReviewLinkForUnderrevision(card, lesson);
				} else if (lesson.revstate == REVSTATE.CLOSED && lesson.state == STATUS.UNDERREVISION) {
					_addReviewLinkForClosedUnderrevision(card, lesson);
				}
				if (lesson.revstate == REVSTATE.PENDING && lesson.state == STATUS.APPROVED) {
					_addReviewLinkForPendingApproved(card, lesson);
				} else if (lesson.revstate == REVSTATE.CLOSED && lesson.state == STATUS.APPROVED) {
					_addReviewLinkForClosedApproved(card, lesson);
				}
				if (lesson.revstate == REVSTATE.PENDING && lesson.state == STATUS.APPROVEDREWORK) {
					_addReviewLinkForUnderRework(card, lesson);
				} else if (lesson.revstate == REVSTATE.CLOSED && lesson.state == STATUS.APPROVEDREWORK) {
					_addReviewLinkForClosedUnderRework(card, lesson);
				}
				if (lesson.revstate == REVSTATE.PENDING && lesson.state == STATUS.APPROVEDREVIEW) {
					_addReviewLinkForApprovedReview(card, lesson);
				} else if (lesson.revstate == REVSTATE.CLOSED && lesson.state == STATUS.APPROVEDREVIEW) {
					_addReviewLinkForClosedApprovedReview(card, lesson);
				}
			}
			card.links.push({
				id : 'details',
				text : nl.t('details')
			});
			return card;
		}

		function _addHelpToMycontent(card, lesson) {
			var ltype = lesson.ltype || LESSONTYPES.LESSON;
			if (lesson.state == STATUS.PRIVATE && ltype == LESSONTYPES.LESSON)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}> Private</span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-grey.png'), lesson.description);
			if (lesson.state == STATUS.PRIVATE && ltype == LESSONTYPES.TEMPLATE)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}>Private</span><br><span class='nl-template-color'>Template</span><br>{}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-grey.png'), lesson.description);
			if (lesson.state == STATUS.UNDERREVIEW && ltype == LESSONTYPES.LESSON)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.description);
			if (lesson.state == STATUS.UNDERREVIEW && ltype == LESSONTYPES.TEMPLATE)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br><span class='nl-template-color'>Template</span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.description);
			if (lesson.state == STATUS.UNDERREVISION && ltype == LESSONTYPES.LESSON)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'> Under revision</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.description);
			if (lesson.state == STATUS.UNDERREVISION && ltype == LESSONTYPES.TEMPLATE)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'> Under revision</span></span><br><span class='nl-template-color'>Template</span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.description);
			if (lesson.state == STATUS.APPROVED && ltype == LESSONTYPES.LESSON)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.description);
			if (lesson.state == STATUS.APPROVED && ltype == LESSONTYPES.TEMPLATE)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved</span></span><br><span class='nl-template-color'>Template</span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.description);
			if (lesson.state == STATUS.APPROVEDREWORK && ltype == LESSONTYPES.LESSON)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'> Under revision</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.description);
			if (lesson.state == STATUS.APPROVEDREWORK && ltype == LESSONTYPES.TEMPLATE)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'> Under revision</span></span><br><span class='nl-template-color'>Template</span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.description);
			if (lesson.state == STATUS.APPROVEDREVIEW && ltype == LESSONTYPES.LESSON)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved, next update under review</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.description);
			if (lesson.state == STATUS.APPROVEDREVIEW && ltype == LESSONTYPES.TEMPLATE)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved, next update under review</span></span><br><span class='nl-template-color'>Template</span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.description);
			card.links.push({
				id : 'lesson_view_priv',
				text : nl.t('view'),
				lessid : lesson.id
			}, {
				id : 'lesson_copy',
				text : nl.t('copy')
			});
		}

		function _addHelpToApproved(card, lesson) {
			if (lesson.ltype == LESSONTYPES.LESSON || lesson.ltype == null)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br> by:{}<br> {}", lesson.grade, lesson.subject, lesson.authorname, lesson.description);
			if (lesson.ltype == LESSONTYPES.TEMPLATE)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br> by:{}<br> <span class='nl-template-color'>Template</span><br>{}", lesson.grade, lesson.subject, lesson.authorname, lesson.description);
		}

		function _addReviewLinkForUnderReview(card, lesson) {
			if (lesson.ltype == LESSONTYPES.LESSON || lesson.ltype == null)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> by: {} <br> <span><img class='nl-16' src={}> Review pending</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
			if (lesson.ltype == LESSONTYPES.TEMPLATE)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> by: {} <br> <span><img class='nl-16' src={}> Review pending</span><br><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
			_addCloseReviewLink(card);
			_addApproveLink(card);
		}

		function _addReviewLinkForClosedUnderReview(card, lesson) {
			if (lesson.ltype == LESSONTYPES.LESSON || lesson.ltype == null)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> review done</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
			if (lesson.ltype == LESSONTYPES.TEMPLATE)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> review done</span><br><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
			_addReopenLink(card);
			_addApproveLink(card);
		}

		function _addReviewLinkForApprovedReview(card, lesson) {
			if (lesson.ltype == LESSONTYPES.LESSON || lesson.ltype == null)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved, next update under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review pending</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
			if (lesson.ltype == LESSONTYPES.TEMPLATE)
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved, next update under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review pending</span><br><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
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
			card.links.push({
				id : 'lesson_approve',
				text : nl.t('approve')
			});
		}

		function _addDisapproveLink(card) {
            if (!_userInfo.permissions.lesson_approve) return;
			card.links.push({
				id : 'lesson_disapprove',
				text : nl.t('disapprove')
			});
		}

        function _addMetadataLink(card) {
            if (!mode.metadataEnabled) return;
            card.links.push({id : 'lesson_metadata', text : nl.t('metadata')});
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
			if (mode.type == TYPES.MY || mode.type == TYPES.REVIEW)
				_addIconsToDeatilsDialog(avps, lesson);
			nl.fmt.addAvp(avps, 'Keywords', lesson.keywords);
			nl.fmt.addAvp(avps, 'Created on ', lesson.created, 'date');
			nl.fmt.addAvp(avps, 'Updated on', lesson.updated, 'date');
			nl.fmt.addAvp(avps, 'Author', lesson.authorname);
			nl.fmt.addAvp(avps, 'Group', lesson.grpname);
			nl.fmt.addAvp(avps, 'Is Template', lesson.ltype, 'boolean');
			if (mode.type == TYPES.APPROVED || mode.type == TYPES.MANAGE || mode.type == TYPES.NEW) {
				nl.fmt.addAvp(avps, 'Approved by', lesson.approvername);
				nl.fmt.addAvp(avps, 'Approved on', lesson.approvedon, 'date');
				nl.fmt.addAvp(avps, 'Approved to', lesson.oulist, '-', 'all classes/user groups');
			}
			if (mode.type == TYPES.REVIEW) {
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
			if (mode.type == TYPES.NEW) {
				nl.fmt.addLinkToAvp(linkAvp, 'select', nl.fmt2('/lesson/create2/{}/0#/', lessonId));
                _addMetadataLinkToDetails(linkAvp);
			} else if (mode.type == TYPES.MY) {
				_addLinksToMycontentDetailsDlg(linkAvp, lessonId, lesson);
			} else if (mode.type == TYPES.MANAGE) {
				_addLinksToManageDetailsDlg(linkAvp, lessonId, lesson);
			} else if (mode.type == TYPES.APPROVED) {
				_addLinksToApprovedDetailsDlg(linkAvp, lessonId, lesson);
			} else if (mode.type == TYPES.REVIEW) {
				_addLinksToReviewDetailsDlg(linkAvp, lessonId, lesson);
			} else if (mode.type == TYPES.SENDASSIGNMENT) {
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

		function _addSearchInfo(cards) {
			cards.search = {
				placeholder : nl.t('Name/{}/Remarks/Keyword', _userInfo.groupinfo.subjectlabel)
			};
            cards.search.onSearch = _onSearch;
            if (mode.metadataEnabled) {
                cards.canFetchMore = mode.canFetchMore;
                return;
            }
			
			var grades = [];
			for(var i=0; i<_userInfo.groupinfo.grades.length; i++) {
			    var g = _userInfo.groupinfo.grades[i];
			    var pos = g.indexOf('.');
                var grp = (pos > -1) ? g.slice(0, pos) : '';
                var desc = (pos > -1) ? g.slice(pos+1) : g;
                desc = desc.replace('.', ' - ');
			    grades.push({id: g, desc: desc, grp: grp});
			}
			nlCardsSrv.updateGrades(cards, grades);
		}

		function _onSearch(filter, grade, onSearchParamChange) {
			mode.searchFilter = filter;
			mode.searchGrade = grade;
            if (!mode.metadataEnabled) {
                _reloadFromServer();
                return;
            }
            mode.searchMetadata.search = mode.searchFilter;
            mode.searchMetadata.grade = mode.searchGrade;
            nlMetaDlg.showAdvancedSearchDlg($scope, _userInfo, 'module', mode.searchMetadata)
            .then(function(result) {
                mode.searchFilter = result.metadata.search || '';
                mode.searchGrade = result.metadata.grade || null;
                mode.searchMetadata = result.metadata;
                onSearchParamChange(mode.searchFilter, mode.searchGrade);
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
			if (mode.type == TYPES.MY) {
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
					if (mode.type != TYPES.MY)
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

		function _showReviewCards($scope, revstate) {
			var cards = [];
			for (var i in _allCardsForReview) {
				var card = _allCardsForReview[i];
				if (revstate == REVSTATE.ALL || card.revstateId == revstate) {
					cards.push(card);
				};
			}
			$scope.cards.cardlist = cards;
		}

		function _updateCardlist($scope, lessonId) {
			for (var i in $scope.cards.cardlist) {
				var card = $scope.cards.cardlist[i];
				if (card.lessonId !== lessonId)
					continue;
				$scope.cards.cardlist.splice(i, 1);
			}
			nlDlg.closeAll();									
			_reloadFromServer();
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

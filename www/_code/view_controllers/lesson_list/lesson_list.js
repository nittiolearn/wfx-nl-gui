(function() {

	//-------------------------------------------------------------------------------------------------
	// assignment.js:
	// assignment module
	//-------------------------------------------------------------------------------------------------
	function module_init() {
		angular.module('nl.lessonlist', []).config(configFn).controller('nl.LessonListCtrl', LessonListCtrl);
	}

	//-------------------------------------------------------------------------------------------------
	var configFn = ['$stateProvider', '$urlRouterProvider',
	function($stateProvider, $urlRouterProvider) {
		$stateProvider.state('app.lesson', {
			url : '^/lesson',
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
		MY: 2,
		MANAGE : 3,
		REVIEW: 4
	};
	var TYPENAMES = {
		'new' : 0,
		'approved' : 1,
		'my' : 2,
		'manage' : 3,
		'review' : 4
	};
	var STATUS = {
		PRIVATE: 0,
		UNDERREVIEW: 1,
		UNDERREVISION: 2,
		APPROVED: 3,
		APPROVEDREWORK: 4,
		APPROVEDREVIEW: 5

	};
	
	var LESSONTYPES = {
		LESSON: 0,
		TEMPLATE:1
	};
	
	var REVSTATE = {
		COMPLETED: 0,
		PENDING: 1,
		CLOSED: 2
	};
	function TypeHandler(nl, nlServerApi) {
		this.type = TYPES.NEW;
		this.custtype = null;
		this.grade = null;
		this.revstate = null;
		
		this.initFromUrl = function() {
			var params = nl.location.search();
			this.type = _convertType(params.type);
			this.custtype = ('custtype' in params) ? parseInt(params.custtype) : null;
			this.revstate = ('revstate' in params) ? parseInt(params.revstate) : null;
			this.grade = ('grade' in params) ? params.grade : null;
		};

		this.listingFunction = function(filter) {
			var data = {
				search : filter
			};
			if (this.custtype !== null) data.custtype = this.custtype;
			if (this.grade !== null) data.grade = this.grade;
			if (this.type == TYPES.NEW) {
				return nlServerApi.lessonGetTemplateList(data);
			} else if (this.type == TYPES.MY) {
				return nlServerApi.lessonGetPrivateList(data);
			} else if (this.type == TYPES.MANAGE) {
				return nlServerApi.lessonGetManageApprovedList(data);
			} else if (this.type == TYPES.REVIEW) {
				data.revstate = this.revstate;
				return nlServerApi.lessonGetReviewList(data);
			} else {
				return nlServerApi.lessonGetApprovedList(data);
			}
		};

		this.pageTitle = function() {
			if (this.type == TYPES.NEW)
				return nl.t('Create new: select the template');
			if (this.type == TYPES.APPROVED)
				return nl.t('Approved lessons and worksheets');
			if (this.type == TYPES.MY)
				return nl.t('My lessons and worksheets');
			if (this.type == TYPES.MANAGE)
				return nl.t('Manage approved lessons and worksheets');
			if (this.type == TYPES.REVIEW)
				return nl.t('Review lessons and  worksheets');
			return '';
		};

		function _convertType(typeStr) {
			if (typeStr === undefined)
				return TYPES.APPROVED;
			typeStr = typeStr.toLowerCase();
			for (var t in TYPENAMES) {
				if (t == typeStr)
					return TYPENAMES[t];
			}
			return TYPES.APPROVED;
		}

	}

	var LessonListCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi',
	function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi) {

		var mode = new TypeHandler(nl, nlServerApi);
		var _userInfo = null;
		var _searchFilterInUrl = '';

		function _onPageEnter(userInfo) {
			_userInfo = userInfo;
			_initParams();
			return nl.q(function(resolve, reject) {
				mode.initFromUrl();
				nl.pginfo.pageTitle = mode.pageTitle();
				$scope.cards = {};
				$scope.cards.staticlist = _getStaticCard();
				$scope.cards.emptycard = _getEmptyCard(nlCardsSrv);
				_getDataFromServer(_searchFilterInUrl, resolve, reject);
			});
		}


		nlRouter.initContoller($scope, '', _onPageEnter);
		
		function _getEmptyCard(nlCardsSrv) {
			var help = help = nl.t('There are no assignments to display.');
			return nlCardsSrv.getEmptyCard({
				help : help
			});
		}

		function _getStaticCard() {
			var ret = [];
			if (mode.type == TYPES.APPROVED || mode.type == TYPES.MANAGE || mode.type == TYPES.MY) return ret;
			var card = {};
			if(mode.type == TYPES.NEW){	 
				 card = {title: nl.t('Create'), 
						icon: nl.url.resUrl('dashboard/crnewwsheet.png'), 
						help: nl.t('You can create a new course by clicking on this card'), 
						children: [{
            				help: "Create lessons based on templates",
            				title: "Create based on default template",
            				url: "/lesson/create2#/",
            				linkId: "admin_group",
            				children: []},
            				{
            				help: "Enable users to create lessons based on pdf",
            				title: "Create based on pdf",
            				url: "/lesson/create2/0/0/pdf#/",
            				linkId: "admin_group",
            				children: []},
            				{
            				help: "View list of groups. Modify user properties.",
            				title: "create a new template",
            				url: "/lesson/create2/0/1#/",
            				linkId: "admin_group",
            				children: []}], style: 'nl-bg-blue'};
            } else if(mode.type == TYPES.REVIEW){
				 card = {title: nl.t('Review'), 
						icon: nl.url.resUrl('dashboard/wsheet.png'), 
						help: nl.t('You can create a new course by clicking on this card'), 
						children: [{
            				help: "View all reviews",
            				title: "view all",
            				internalUrl: "view_all",
            				children: []},
            				{
            				help: "Enable users to create lessons based on pdf",
            				title: "view pending reviews",
            				internalUrl: "view_pending",
            				children: []},
            				{
            				help: "View list of groups. Modify user properties.",
            				title: "view closed reviews",
 	          				internalUrl: "view_closed",
             				children: []}], 
             		style: 'nl-bg-blue'};
            }
			card.links = [];
			ret.push(card);
			return ret;
		}
	    $scope.onCardInternalUrlClicked = function(card, internalUrl) {
	    	var lessonId = card.lessonId;
			if (internalUrl === 'lesson_delete') {
				_deleteLesson($scope, lessonId);
			} else if (internalUrl === 'lesson_approve'){
				_approveLesson($scope, lessonId);
			}  else if (internalUrl === 'lesson_copy'){
				_copyLesson($scope, lessonId);
			} else if (internalUrl === 'lesson_closereview'){
				_closereviewLesson($scope, lessonId);
			} else if (internalUrl === 'lesson_disapprove'){
				_disapproveLesson($scope, lessonId);
			} else if(internalUrl === 'lesson_view'){
				nl.window.location.href=nl.fmt2('/lesson/view/{}/', lessonId);
			} else if(internalUrl === 'lesson_reopen'){
				_reopenLesson($scope, lessonId);
			} else if(internalUrl === 'view_all'){
				_viewAllReview($scope, card);
			} else if(internalUrl === 'view_pending'){
				_viewPendingReview($scope, card);
			} else if(internalUrl === 'view_closed'){
				_viewClosedReview($scope, card);
			}
	    };

		$scope.onCardLinkClicked = function(card, linkId){
			var lessonId = card.lessonId;
			if(linkId == 'lesson_view'){
				nl.window.location.href=nl.fmt2('/lesson/view_priv/{}/', lessonId);				
			} else if(linkId == 'lesson_copy'){
				_copyLesson($scope, lessonId);
			} else if(linkId == 'lesson_approve'){
				_approveLesson($scope, lessonId);				
			} else if(linkId == 'lesson_closereview'){
				_closereviewLesson($scope, lessonId);
			} else if(linkId == 'lesson_disapprove'){
				_disapproveLesson($scope, lessonId);				
			} else if(linkId === 'lesson_reopen'){
				_reopenLesson($scope, lessonId);
			}	
		};
		function _getDataFromServer(filter, resolve, reject) {
			mode.listingFunction(filter).then(function(resultList) {
				nl.log.debug('Got result: ', resultList.length);
				$scope.cards.cardlist = _getLessonCards(_userInfo, resultList);
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
			if(mode.type == TYPES.APPROVED || mode.type == TYPES.MANAGE) url = nl.fmt2('/lesson/view/{}/', lesson.id);
			if(mode.type == TYPES.MY) url = nl.fmt2('/lesson/edit/{}/', lesson.id);
			if(mode.type == TYPES.REVIEW) url = nl.fmt2('/lesson/view_review/{}/', lesson.id);
			var card = {
				lessonId : lesson.id,
				revstateId : lesson.revstate,
				title : lesson.name,
				icon : nl.url.lessonIconUrl(lesson.image),
				url : url,
				children : []
			};
			card.details = {
				help : lesson.descMore,
				avps : _getAssignmentAvps(lesson)
			};
			card.links = [];
			if(mode.type == TYPES.MY ){
				_addHelpToMycontent(card, lesson);
			} else if(mode.type == TYPES.APPROVED) {
				_addHelpToApproved(card, lesson);
				card.links.push({
					id : 'lesson_copy',
					text : nl.t('copy')
				});
			} else if (mode.type == TYPES.MANAGE) {
				card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br> by:{}<br>", lesson.grade, lesson.subject, lesson.approvername);
				card.links.push({
					id : 'lesson_disapprove',
					text : nl.t('disapprove')
				});
			} else if (mode.type == TYPES.REVIEW) {
				if(lesson.revstate == REVSTATE.PENDING  && lesson.state == STATUS.UNDERREVIEW) {
					_addReviewLinkUnderReview(card, lesson);
				} else if(lesson.revstate == REVSTATE.CLOSED && lesson.state == STATUS.UNDERREVIEW){
							card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> by: {}<br><span><img src={}> review pending</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.authorname, nl.url.resUrl('general/tick.png'));
							card.links.push({
							id : 'lesson_reopen',
							text : nl.t('reopen')
						},{
							id : 'lesson_approve',
							text : nl.t('approve')
						});
				}; 
				if(lesson.revstate == REVSTATE.PENDING && lesson.state == STATUS.APPROVEDREVIEW){
					card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved, next update under review</span></span><br> by: {}<br><span><img src={}> review pending</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('general/search.png'));
					card.links.push({
					id : 'lesson_closereview',
					text : nl.t('close review')
					},{
					id : 'lesson_disapprove',
					text : nl.t('disapprove')
					});
				} else if(lesson.revstate == REVSTATE.CLOSED && lesson.state == STATUS.APPROVEDREVIEW){
					card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'>Approved, next update under review</span></span><br> by: {}<br><span><img src={}> Review done</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('general/tick.png'));
					card.links.push({
					id : 'lesson_reopen',
					text : nl.t('reopen')
					},{
					id : 'lesson_disapprove',
					text : nl.t('disapprove')
					});
				}
				if(lesson.revstate == REVSTATE.PENDING && lesson.state == STATUS.APPROVED){
					card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Under review</span></span><br> by: {}<br>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.authorname);
					card.links.push({
					id : 'lesson_closereview',
					text : nl.t('close review')
					},{
					id : 'lesson_disapprove',
					text : nl.t('disapprove')
					});
				} else if(lesson.revstate == REVSTATE.CLOSED && lesson.state == STATUS.APPROVED){
					card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'>Approved</span></span><br> by: {}<br><span><img src={}> Review done</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('general/tick.png'));
					card.links.push({
					id : 'lesson_reopen',
					text : nl.t('reopen')
					},{
					id : 'lesson_disapprove',
					text : nl.t('disapprove')
					});
				}  
				if(lesson.revstate == REVSTATE.PENDING && lesson.state == STATUS.UNDERREVISION){
					card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'> Under revision</span></span><br> by: {}<br><span><img src={}><span> review pending</span><br>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.authorname, nl.url.resUrl('general/search.png'));
					card.links.push({
					id : 'lesson_closereview',
					text : nl.t('close review')
					},{
					id : 'lesson_disapprove',
					text : nl.t('disapprove')
					});
				} else if(lesson.revstate == REVSTATE.CLOSED && lesson.state == STATUS.UNDERREVISION){
					card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'>Under revision</span></span><br> by: {}<br><span><img src={}> Review done</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.authorname, nl.url.resUrl('general/tick.png'));
					card.links.push({
					id : 'lesson_reopen',
					text : nl.t('reopen')
					},{
					id : 'lesson_disapprove',
					text : nl.t('disapprove')
					});
				}
				if(lesson.revstate == REVSTATE.PENDING && lesson.state == STATUS.UNDERREWORK){
					card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Under review</span></span><br> by: {}<br>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.authorname);
					card.links.push({
					id : 'lesson_closereview',
					text : nl.t('close review')
					},{
					id : 'lesson_disapprove',
					text : nl.t('disapprove')
					});
				} else if(lesson.revstate == REVSTATE.CLOSED && lesson.state == STATUS.UNDERREWORK){
					card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'>Approved, next review update under review</span></span><br> by: {}<br><span><img src={}> Review done</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('general/tick.png'));
					card.links.push({
					id : 'lesson_reopen',
					text : nl.t('reopen')
					},{
					id : 'lesson_disapprove',
					text : nl.t('disapprove')
					});
				}
			}		
			card.links.push({id : 'details', text : nl.t('details')});
			return card;
		}

		function _addHelpToMycontent(card, lesson){
			if (lesson.state == STATUS.PRIVATE && lesson.ltype == '0') card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}> Private</span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-grey.png'), lesson.description);
			if (lesson.state == STATUS.PRIVATE && lesson.ltype == '1') card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}>Private</span><br><span class='nl-template-color'>Template</span><br>{}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-grey.png'), lesson.description);
			if (lesson.state == STATUS.UNDERREVIEW && lesson.ltype == '0') card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.description);
			if (lesson.state == STATUS.UNDERREVIEW && lesson.ltype == '1') card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.description);
			if (lesson.state == STATUS.UNDERREVISION && lesson.ltype == '0') card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'> Under revision</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.description);
			if (lesson.state == STATUS.UNDERREVISION && lesson.ltype == '1') card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'> Under revision</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.description);
			if (lesson.state == STATUS.APPROVED && lesson.ltype == '0') card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.description);
			if (lesson.state == STATUS.APPROVED && lesson.ltype == '1') card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.description);
			if (lesson.state == STATUS.APPROVEDREWORK && lesson.ltype == '0') card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'> Under revision</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.description);
			if (lesson.state == STATUS.APPROVEDREWORK && lesson.ltype == '1') card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'> Under revision</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.description);
			if (lesson.state == STATUS.APPROVEDREVIEW && lesson.ltype == '0') card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved, next update under review</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.description);
			if (lesson.state == STATUS.APPROVEDREVIEW && lesson.ltype == '1') card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved, next update under review</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.description);
			card.links.push({
				id : 'lesson_view',
				text : nl.t('view'),
				lessid: lesson.id
			},{
				id : 'lesson_copy',
				text : nl.t('copy')
			});				
		}

		function _addHelpToApproved(card, lesson) {
				if(lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br> by:{}<br> {}", lesson.grade, lesson.subject, lesson.approvername, lesson.description);
				if(lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br> by:{}<br> <span class='nl-template-color'>Template</span><br>{}", lesson.grade, lesson.subject, lesson.approvername, lesson.description);
		}

		function _addReviewLinkUnderReview(card, lesson) {
			card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> by: {} <br> <span><img src={}>review pending</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.authorname, nl.url.resUrl('general/search.png'));
			card.links.push({
				id : 'lesson_closereview',
				text : nl.t('close review')
				},{
				id : 'lesson_approve',
				text : nl.t('approve')
			});
		}

		function _getAssignmentAvps(lesson) {
			var avps = [];
			var linkAvp = nl.fmt.addLinksAvp(avps, 'Operations');
			_populateLinks(linkAvp, lesson.id, lesson);
			nl.fmt.addAvp(avps, 'Name', lesson.name);
			nl.fmt.addAvp(avps, 'Subject', lesson.subject);
			nl.fmt.addAvp(avps, 'Grade', lesson.grade);
			if(mode.type == TYPES.MY || mode.type == TYPES.REVIEW) _addIconsToDeatilsDialog(avps, lesson); 
			nl.fmt.addAvp(avps, 'Keywords', lesson.keywords);
			nl.fmt.addAvp(avps, 'Created on ', lesson.created, 'date');
			nl.fmt.addAvp(avps, 'Updated on', lesson.updated, 'date');
			nl.fmt.addAvp(avps, 'Author', lesson.authorname);
			nl.fmt.addAvp(avps, 'Group', lesson.grpname);
			nl.fmt.addAvp(avps, 'Is Template', lesson.ltype, 'boolean');
			if(mode.type == TYPES.APPROVED || mode.type == TYPES.MANAGE){
				nl.fmt.addAvp(avps, 'Aproved by', lesson.approvername);
				nl.fmt.addAvp(avps, 'Aproved on', lesson.approvedon, 'date');
				nl.fmt.addAvp(avps, 'Aproved to', lesson.oulist);				
			}
			if(mode.type == TYPES.REVIEW){
				nl.fmt.addAvp(avps, 'Remarks', lesson.remarks);
				nl.fmt.addAvp(avps, 'Review status', 'review pending' , 'text', '-', nl.url.resUrl('toolbar-view/notes.png'), 'default'); 	
			}
			nl.fmt.addAvp(avps, 'Lesson type', lesson.ltype, '-', '0');
			nl.fmt.addAvp(avps, 'Description', lesson.description);
			return avps;
		}
		
		function _populateLinks(linkAvp, lessonId, lesson) {
			var d = new Date();
			if (mode.type == TYPES.NEW) {
				nl.fmt.addLinkToAvp(linkAvp, 'select', nl.fmt2('/lesson/create2/{}/0#/', lessonId));
			} else if(mode.type == TYPES.MY){
				_addLinksToMycontentDetailsDlg(linkAvp, lessonId, lesson);
			} else if(mode.type == TYPES.MANAGE){
				_addLinksToManageDetailsDlg(linkAvp, lessonId, lesson);
			} else if(mode.type == TYPES.APPROVED) {
				_addLinksToApprovedDetailsDlg(linkAvp, lessonId, lesson);
			} else if(mode.type == TYPES.REVIEW) {
				_addLinksToReviewDetailsDlg(linkAvp, lessonId, lesson);
			}
		}

		function _addIconsToDeatilsDialog(avps, lesson){
			if(lesson.state == STATUS.PRIVATE) nl.fmt.addAvp(avps, 'status', 'Private' , 'text', '-', nl.url.resUrl('general/ball-grey.png'), 'default');
			if(lesson.state == STATUS.UNDERREVIEW) nl.fmt.addAvp(avps, 'status', 'Under review' , 'text', '-', nl.url.resUrl('general/ball-yellow.png'), 'default');
			if(lesson.state == STATUS.UNDERREVISION) nl.fmt.addAvp(avps, 'status', 'Under revision' , 'text', '-', nl.url.resUrl('general/ball-maroon.png'), 'default');
			if(lesson.state == STATUS.APPROVED) nl.fmt.addAvp(avps, 'status', 'Approved' , 'text', '-', nl.url.resUrl('general/ball-green.png'), 'default');
			if(lesson.state == STATUS.APPROVEDREWORK) nl.fmt.addAvp(avps, 'status', 'Approved, next update under review' , 'text', '-', nl.url.resUrl('general/ball-green.png'), 'nl-24 nl-template-color');
			if(lesson.state == STATUS.APPROVEDREVIEW) nl.fmt.addAvp(avps, 'status', 'Approved, next update under review' , 'text', '-', nl.url.resUrl('general/ball-green.png'), 'default');
	 	}
	 	
	 	function _addLinksToMycontentDetailsDlg(linkAvp, lessonId, lesson) {
				nl.fmt.addLinkToAvp(linkAvp, 'edit', nl.fmt2('/lesson/edit/{}/', lessonId));
				nl.fmt.addLinkToAvp(linkAvp, 'view', nl.fmt2('/lesson/view_priv/{}/', lessonId));
				nl.fmt.addLinkToAvp(linkAvp, 'delete', null, 'lesson_delete');
				if(lesson.state == STATUS.APPROVED || lesson.state == STATUS.APPROVEDREVIEW || lesson.state == STATUS.APPROVEDREWORK) {
					nl.fmt.addLinkToAvp(linkAvp, 'disapprove', null, 'lesson_disapprove');
				}else{
					nl.fmt.addLinkToAvp(linkAvp, 'approve', null, 'lesson_approve');
				}
				nl.fmt.addLinkToAvp(linkAvp, 'copy', null, 'lesson_copy');
	 	}
	 	
	 	function _addLinksToApprovedDetailsDlg(linkAvp, lessonId, lesson){
				nl.fmt.addLinkToAvp(linkAvp, 'view', nl.fmt2('/lesson/view/{}/', lessonId));
				nl.fmt.addLinkToAvp(linkAvp, 'copy', null, 'lesson_copy');				
				nl.fmt.addLinkToAvp(linkAvp, 'send assignment', nl.fmt2('/assignment/create2/{}/', lessonId));								

	 	}
	 	
	 	function _addLinksToManageDetailsDlg(linkAvp, lessonId, lesson){
				nl.fmt.addLinkToAvp(linkAvp, 'view', nl.fmt2('/lesson/view/{}/', lessonId));
				nl.fmt.addLinkToAvp(linkAvp, 'disapprove', null, 'lesson_disapprove');				

	 	}

		function _addLinksToReviewDetailsDlg(linkAvp, lessonId, lesson){
			if(lesson.revstate == REVSTATE.PENDING) { 
				nl.fmt.addLinkToAvp(linkAvp, 'close review', null, 'lesson_closereview');
				nl.fmt.addLinkToAvp(linkAvp, 'view', nl.fmt2('/lesson/view_review/{}', lessonId));
				if(lesson.state == STATUS.UNDERREVIEW || lesson.state == STATUS.UNDERREVISION) nl.fmt.addLinkToAvp(linkAvp, 'approve', null, 'lesson_approve');
				if(lesson.state == STATUS.APPROVED || lesson.state == STATUS.APPROVEDREWORK || lesson.state == STATUS.APPROVEDREVIEW) nl.fmt.addLinkToAvp(linkAvp, 'disapprove', null, 'lesson_disapprove');				
			} else if(lesson.revstate == REVSTATE.CLOSED) { 
				nl.fmt.addLinkToAvp(linkAvp, 'reopen', null, 'lesson_reopen');
				nl.fmt.addLinkToAvp(linkAvp, 'view', nl.fmt2('/lesson/view_review/{}', lessonId));
			    if (lesson.state == STATUS.UNDERREVIEW || lesson.state == STATUS.UNDERREVISION)	nl.fmt.addLinkToAvp(linkAvp, 'approve', null, 'lesson_approve');
			    if (lesson.state == STATUS.APPROVED || lesson.state == STATUS.APPROVEDREWORK || lesson.state == STATUS.APPROVEDREVIEW)	nl.fmt.addLinkToAvp(linkAvp, 'disapprove', null, 'lesson_disapprove');
			}
		}

		function _addSearchInfo(cards) {
			cards.search = {
				placeholder : nl.t('Name/Subject/Remarks/Keyword')
			};
			cards.grades = ['All grades', 'Playschool', 'Nursery', 'LKG', 'UKG', 'Grade 1', 'Grade 2',
							'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9',
							'Grade 10', 'Grade 11', 'Grade 12', 'Grade-Other'];
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
		function _deleteLesson($scope, lessonId) {
			var msg = {title: 'Please confirm', 
					   template: nl.t('Deleting an assignment will delete all reports behind this assignment. This cannot be undone. Are you sure you want to delete?'),
					   okText: nl.t('Delete')};
			nlDlg.popupConfirm(msg).then(function(result) {
				if (!result) return;
				nlDlg.showLoadingScreen();
				nlServerApi.lessonDelete(lessonId).then(function(status) {
					nlDlg.hideLoadingScreen();
					_updateCardlist($scope, lessonId);
				});	
			});
		}

		
		function _disapproveLesson($scope, lessonId) {
			console.log(lessonId);
			var msg = {title: 'Please confirm', 
					   template: nl.t('Are u sure you want to disapprove the approved lesson'),
					   okText: nl.t('Disapprove')};
			nlDlg.popupConfirm(msg).then(function(result) {
				if (!result) return;
				nlDlg.showLoadingScreen();
				nlServerApi.lessonDisapprove(lessonId).then(function(status) {
					nlDlg.hideLoadingScreen();
					_updateCardlist($scope, lessonId);
				});	
			});
		}

		function _approveLesson($scope, lessonId){
			var approveDlg = nlDlg.create($scope);
			approveDlg.setCssClass('nl-height-max nl-width-max');
	        approveDlg.scope.error = {};
			var approveButton = {
				text : nl.t('approve'),
				onTap : function(e) {
					if (e) e.preventDefault();
				}
			};
			var cancelButton = {
				text : nl.t('Cancel')
			};
			approveDlg.show('view_controllers/lesson_list/lesson_approve_dlg.html',
			[approveButton], cancelButton, false);
			// nlServerApi.lessonApprove(lessonId).then(function(status) {
				// nlDlg.hideLoadingScreen();
			// });	
		}
		
		function _copyLesson($scope, lessonId) {
			var data = {};
			if(mode.type == TYPES.MY){
				data = {lessonid: lessonId, private: 1};
			}else{			
				data = {lessonid: lessonId, private :  0};
			}
			var msg = {title: 'Copy lesson', 
					   template: nl.t('Are u sure you want to make a private copy of this lesson/worksheet?'),
					   okText: nl.t('copy')};
			nlDlg.popupConfirm(msg).then(function(result) {
				if (!result) return;			
				nlServerApi.lessonCopy(data).then(function(status) {
					nlDlg.hideLoadingScreen();
					var template = "<ul><li><a href='/lesson/edit/{}'>Edit new lesson</a></li><li><a href='#/lesson?type=my'>view my lessons/worksheets</a></li></ul>";
					template = nl.fmt2(template, status); 
					var confirmMsg = {title: nl.t("Lesson copied"), template:template};				
					nlDlg.popupAlert(confirmMsg);	
				});
			});
		}
		
		function _reopenLesson($scope, lessonId) {
			var msg = {title: 'Please confirm', 
					   template: nl.t('Are u sure you want to reopen review?'),
					   okText: nl.t('reopen')};
			nlDlg.popupConfirm(msg).then(function(result) {
				if (!result) return;			
				nlServerApi.lessonReopenReview(lessonId).then(function(status) {
					nlDlg.showLoadingScreen();
					_updateCardAfterReviewlist($scope, lessonId);
				});
			});			
		}
		
		function _closereviewLesson($scope, lessonId) {
			var msg = {title: 'Please confirm', 
					   template: nl.t('Are u sure you want to reopen review?'),
					   okText: nl.t('close review')};
			nlDlg.popupConfirm(msg).then(function(result) {
				if (!result) return;			
				nlServerApi.lessonCloseReview(lessonId).then(function(status) {
					nlDlg.showLoadingScreen();
					_updateCardAfterReviewlist($scope, lessonId);
				});
			});			
		}
		
		function _viewAllReview($scope, card){
			for (var i in $scope.cards.cardlist) {
				var card = $scope.cards.cardlist[i];
			}			
			nl.window.location.reload();
		}
		
		function _viewPendingReview($scope, card){
			var cards = [];
			for (var i in $scope.cards.cardlist) {
				var card = $scope.cards.cardlist[i];
				if (card.revstateId == REVSTATE.PENDING) {
					cards.push(card);
				}
			}
			$scope.cards.cardlist = cards;
		}
		
		function _viewClosedReview($scope, card){
			var revstate = card.revstateId;
			var cards = [];
			for (var i in $scope.cards.cardlist) {
				var card = $scope.cards.cardlist[i];
				if (card.revstateId == REVSTATE.CLOSED) {
					cards.push(card);
				};
			}
			$scope.cards.cardlist = cards;
		}
		
		
		function _updateCardlist($scope, lessonId){
			for (var i in $scope.cards.cardlist) {
				var card = $scope.cards.cardlist[i];
				if (card.lessonId !== lessonId) continue;
				$scope.cards.cardlist.splice(i, 1);
			}
			nl.window.location.reload();
		}
		
		function _updateCardAfterReviewlist($scope, lessonId){
			for (var i in $scope.cards.cardlist) {
				var card = $scope.cards.cardlist[i];
			}
			nl.window.location.reload();
		}

		function _initParams() {
			var params = nl.location.search();
			_searchFilterInUrl = ('search' in params) ? params.search : '';
		}

	}];
	module_init();
})();

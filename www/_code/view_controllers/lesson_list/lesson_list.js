(function() {

//-------------------------------------------------------------------------------------------------
// assignment.js:
// assignment module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.lessonlist', [])
	.config(configFn)
	.controller('nl.LessonListCtrl', LessonListCtrl)
	.service('nlApproveDlg', ApproveDlgSrv);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.lesson', {
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
	ALL: 0,
	PENDING: 1,
	CLOSED: 2
};

var EXPORTLEVEL = {
	PRIVATE: 0,
	PUBLIC: 1
};

//-------------------------------------------------------------------------------------------------
function TypeHandler(nl, nlServerApi) {
	this.type = TYPES.NEW;
	this.custtype = null;
	this.searchFilter = null;
	this.searchGrade = null;
	this.revstate = null;
	
	this.initFromUrl = function() {
		var params = nl.location.search();
		this.type = _convertType(params.type);
		this.custtype = ('custtype' in params) ? parseInt(params.custtype) : null;
		this.revstate = ('revstate' in params) ? parseInt(params.revstate) : null;
		this.searchGrade = ('grade' in params) ? params.grade : 'All Grades';
		this.searchFilter = ('search' in params) ? params.search : null;
	};

	this.listingFunction = function() {
		var data = {};
		if (this.custtype !== null) data.custtype = this.custtype;
		if (this.searchFilter !== null) data.search = this.searchFilter;
		if (this.searchGrade !== null) data.grade = this.searchGrade;
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

//-------------------------------------------------------------------------------------------------
var LessonListCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi', 'nlApproveDlg',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, nlApproveDlg) {

	var mode = new TypeHandler(nl, nlServerApi);
	var _userInfo = null;
	var _allCardsForReview = [];
	
	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {
			mode.initFromUrl();
			nl.pginfo.pageTitle = mode.pageTitle();
			$scope.cards = {};
			$scope.cards.staticlist = _getStaticCard();
			$scope.cards.emptycard = _getEmptyCard(nlCardsSrv);
			_getDataFromServer(resolve, reject);
		});
	}


	nlRouter.initContoller($scope, '', _onPageEnter);
	
	function _getEmptyCard(nlCardsSrv) {
		var help = help = nl.t('There are no assignments to display.');
		return nlCardsSrv.getEmptyCard({
			help : help
		});
	}

	function _getApproveToList() {
		var card = ['Visible to users within the group', 'Visible to users within the group and dependent group', 'Visible to every logedin user', 'Visible to everyone'];
		return card;		
	}
	function _getStaticCard() {
		var ret = [];
		if (mode.type == TYPES.APPROVED || mode.type == TYPES.MANAGE || mode.type == TYPES.MY) return ret;
		var card = {};
		if(mode.type == TYPES.NEW){	 
			 card = {title: nl.t('Create'), 
					icon: nl.url.resUrl('dashboard/crnewwsheet.png'), 
					help: nl.t('You can create a new course by clicking on this card'), 
					description:nl.t('can create'),
					children: [{
        				title: "Click on one of the listed templates or"},
        				{
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
        				children: []}], 
        				style: 'nl-bg-blue'};
        } else if(mode.type == TYPES.REVIEW){
			 card = {title: nl.t('Review'), 
					icon: nl.url.resUrl('dashboard/wsheet.png'), 
					help: nl.t('<span>You can create a new course by clicking on this card</span>'), 
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
         				style:'nl-bg-blue'};
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
			_showReviewCards($scope, REVSTATE.ALL);
		} else if(internalUrl === 'view_pending'){
			_showReviewCards($scope, REVSTATE.PENDING);
		} else if(internalUrl === 'view_closed'){
			_showReviewCards($scope, REVSTATE.CLOSED);
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
	
	function _getDataFromServer(resolve, reject) {
		mode.listingFunction().then(function(resultList) {
			nl.log.debug('Got result: ', resultList.length);
			$scope.cards.cardlist = _getLessonCards(_userInfo, resultList);
			_allCardsForReview = $scope.cards.cardlist;
			if(mode.type == TYPES.REVIEW) _showReviewCards($scope, REVSTATE.PENDING);
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
		if(mode.type == TYPES.NEW) url = nl.fmt2('/lesson/create2/{}/', lesson.id);
		var card = {
			lessonId : lesson.id,
			revstateId : lesson.revstate,
			title : lesson.name,
			grade : lesson.grade,
			icon : nl.url.lessonIconUrl(lesson.image),
			url : url,
			children : []
		};
		card.details = {
			help : lesson.descMore,
			avps : _getLessonListAvps(lesson)
		};
		card.links = [];
		if(mode.type == TYPES.MY ){
			_addHelpToMycontent(card, lesson);
		} else if(mode.type == TYPES.APPROVED) {
			_addHelpToApproved(card, lesson);
			if(lesson.exportLevel == EXPORTLEVEL.PRIVATE){
				card.links.push({
					id : 'lesson_copy',
					text : nl.t('copy')
				});
			}
		} else if (mode.type == TYPES.NEW) {
			card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br> by:{}<br> <span class='nl-template-color'>Template</span><br> <span>{}</span>", lesson.grade, lesson.subject, lesson.approvername, lesson.description);
		} else if (mode.type == TYPES.MANAGE) {
			if(lesson.ltype == LESSONTYPES.LESSON)  card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br> by:{}<br>", lesson.grade, lesson.subject, lesson.approvername);
			if(lesson.ltype == LESSONTYPES.TEMPLATE)  card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br> by:{}<br> <span class='nl-template-color'>Template</span><br>", lesson.grade, lesson.subject, lesson.approvername);
			card.links.push({
				id : 'lesson_disapprove',
				text : nl.t('disapprove')
			});
		} else if (mode.type == TYPES.REVIEW) {
			if(lesson.revstate == REVSTATE.PENDING  && lesson.state == STATUS.UNDERREVIEW) {
				_addReviewLinkForUnderReview(card, lesson);
			} else if(lesson.revstate == REVSTATE.CLOSED && lesson.state == STATUS.UNDERREVIEW){
				_addReviewLinkForClosedUnderReview(card, lesson);
			}; 
			if(lesson.revstate == REVSTATE.PENDING && lesson.state == STATUS.APPROVEDREVIEW){
				_addReviewLinkForApprovedReview(card, lesson);
			} else if(lesson.revstate == REVSTATE.CLOSED && lesson.state == STATUS.APPROVEDREVIEW){
				_addReviewLinkForClosedApprovedReview(card, lesson);
			}
			if(lesson.revstate == REVSTATE.PENDING && lesson.state == STATUS.APPROVED){
				_addReviewLinkForPendingApproved(card, lesson);
			} else if(lesson.revstate == REVSTATE.CLOSED && lesson.state == STATUS.APPROVED){
				_addReviewLinkForClosedApproved(card, lesson);
			}  
			if(lesson.revstate == REVSTATE.PENDING && lesson.state == STATUS.UNDERREVISION){
				_addReviewLinkForUnderrevision(card, lesson);
			} else if(lesson.revstate == REVSTATE.CLOSED && lesson.state == STATUS.UNDERREVISION){
				_addReviewLinkForClosedUnderrevision(card, lesson);
			}
			if(lesson.revstate == REVSTATE.PENDING && lesson.state == STATUS.UNDERREWORK){
				_addReviewLinkForUnderRework(card, lesson);
			} else if(lesson.revstate == REVSTATE.CLOSED && lesson.state == STATUS.UNDERREWORK){
				_addReviewLinkForClosedUnderRework(card, lesson);
				if(lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'>Approved, next review update under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
				if(lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'>Approved, next review update under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span><br><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));				
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
		if (lesson.state == STATUS.PRIVATE && lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}> Private</span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-grey.png'), lesson.description);
		if (lesson.state == STATUS.PRIVATE && lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}>Private</span><br><span class='nl-template-color'>Template</span><br>{}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-grey.png'), lesson.description);
		if (lesson.state == STATUS.UNDERREVIEW && lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.description);
		if (lesson.state == STATUS.UNDERREVIEW && lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.description);
		if (lesson.state == STATUS.UNDERREVISION && lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'> Under revision</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.description);
		if (lesson.state == STATUS.UNDERREVISION && lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'> Under revision</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.description);
		if (lesson.state == STATUS.APPROVED && lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.description);
		if (lesson.state == STATUS.APPROVED && lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.description);
		if (lesson.state == STATUS.APPROVEDREWORK && lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'> Under revision</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.description);
		if (lesson.state == STATUS.APPROVEDREWORK && lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'> Under revision</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.description);
		if (lesson.state == STATUS.APPROVEDREVIEW && lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved, next update under review</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.description);
		if (lesson.state == STATUS.APPROVEDREVIEW && lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved, next update under review</span></span><br> {}", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.description);
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

	function _addReviewLinkForUnderReview(card, lesson) {
		if(lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> by: {} <br> <span><img class='nl-16' src={}> Review pending</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
		if(lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> by: {} <br> <span><img class='nl-16' src={}> Review pending</span><br><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
		card.links.push({
			id : 'lesson_closereview',
			text : nl.t('close review')
			},{
			id : 'lesson_approve',
			text : nl.t('approve')
		});
	}

	function _addReviewLinkForClosedUnderReview(card, lesson) {
		if(lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> review done</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
		if(lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> review done</span><br><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
			card.links.push({
			id : 'lesson_reopen',
			text : nl.t('reopen')
		},{
			id : 'lesson_approve',
			text : nl.t('approve')
		});
	}
	
	function _addReviewLinkForApprovedReview(card, lesson) {
		if(lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved, next update under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review pending</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
		if(lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved, next update under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review pending</span><br><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
		card.links.push({
		id : 'lesson_closereview',
		text : nl.t('close review')
		},{
		id : 'lesson_disapprove',
		text : nl.t('disapprove')
		});			
	}
	
	function _addReviewLinkForClosedApprovedReview(card, lesson) {
		if(lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'>Approved, next update under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
		if(lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'>Approved, next update under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span><br><span class='nl-template-color'>Template</span><br>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
		card.links.push({
		id : 'lesson_reopen',
		text : nl.t('reopen')
		},{
		id : 'lesson_disapprove',
		text : nl.t('disapprove')
		});
	}
	
	function _addReviewLinkForPendingApproved(card, lesson) {
		if(lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved</span></span><br> by: {}<br><span><img class='nl-16' src={}><span> Review pending</span></span><br>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
		if(lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'> Approved</span></span><br> by: {}<br><span><img class='nl-16' src={}><span> Review pending</span></span><br><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
		card.links.push({
		id : 'lesson_closereview',
		text : nl.t('close review')
		},{
		id : 'lesson_disapprove',
		text : nl.t('disapprove')
		});
	}
	
	function _addReviewLinkForClosedApproved(card, lesson) {
		if(lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'>Approved</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
		if(lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'>Approved</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span><br><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
		card.links.push({
		id : 'lesson_reopen',
		text : nl.t('reopen')
		},{
		id : 'lesson_disapprove',
		text : nl.t('disapprove')
		});
	}

	function _addReviewLinkForUnderrevision(card, lesson) {
		if(lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'> Under revision</span></span><br> by: {}<br><span><img class='nl-16' src={}><span> Review pending</span><br>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
		if(lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'> Under revision</span></span><br> by: {}<br><span><img class='nl-16' src={}><span> Review pending</span><br><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
		card.links.push({
		id : 'lesson_closereview',
		text : nl.t('close review')
		},{
		id : 'lesson_approve',
		text : nl.t('approve')
		});
	}

	function _addReviewLinkForClosedUnderrevision(card, lesson) {
		if(lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'>Under revision</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
		if(lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-revision-color'>Under revision</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-maroon.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
		card.links.push({
		id : 'lesson_reopen',
		text : nl.t('reopen')
		},{
		id : 'lesson_approve',
		text : nl.t('approve')
		});
	}

	function _addReviewLinkForUnderRework(card, lesson) {
		if(lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review pending</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
		if(lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-review-color'> Under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review pending</span><br><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-yellow.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/comments1.png'));
		card.links.push({
		id : 'lesson_closereview',
		text : nl.t('close review')
		},{
		id : 'lesson_disapprove',
		text : nl.t('disapprove')
		});
	}

	function _addReviewLinkForClosedUnderRework(card, lesson) {
		if(lesson.ltype == LESSONTYPES.LESSON) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'>Approved, next review update under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));
		if(lesson.ltype == LESSONTYPES.TEMPLATE) card['help'] = nl.t("<span class='nl-card-description'><b>{}, {}</b></span><br><span><img src={}><span class='nl-template-color'>Approved, next review update under review</span></span><br> by: {}<br><span><img class='nl-16' src={}> Review done</span><br><span class='nl-template-color'>Template</span>", lesson.grade, lesson.subject, nl.url.resUrl('general/ball-green.png'), lesson.authorname, nl.url.resUrl('toolbar-edit/approve.png'));				
		card.links.push({
		id : 'lesson_reopen',
		text : nl.t('reopen')
		},{
		id : 'lesson_disapprove',
		text : nl.t('disapprove')
		});
	}
	
	function _getLessonListAvps(lesson) {
		var avps = [];
		var linkAvp = nl.fmt.addLinksAvp(avps, 'Operation(s)');
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
		if(mode.type == TYPES.APPROVED || mode.type == TYPES.MANAGE || mode.type == TYPES.NEW){
			nl.fmt.addAvp(avps, 'Approved by', lesson.approvername);
			nl.fmt.addAvp(avps, 'Approved on', lesson.approvedon, 'date');
			nl.fmt.addAvp(avps, 'Approved to', lesson.oulist, '-', 'all classes/user groups');				
		}
		if(mode.type == TYPES.REVIEW){
			nl.fmt.addAvp(avps, 'Remarks', lesson.remarks);
			if(lesson.revstate == REVSTATE.PENDING) nl.fmt.addAvp(avps, 'Review status', 'Review pending' , 'text', '-', nl.url.resUrl('toolbar-edit/comments1.png'), 'nl-16'); 	
			if(lesson.revstate == REVSTATE.CLOSED) nl.fmt.addAvp(avps, 'Review status', 'Review done' , 'text', '-', nl.url.resUrl('toolbar-edit/approve.png'), 'nl-16'); 	
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
			if(lesson.exportLevel == EXPORTLEVEL.PRIVATE) nl.fmt.addLinkToAvp(linkAvp, 'copy', null, 'lesson_copy');				
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
		cards.grades = ['All Grades'].concat(_userInfo.groupinfo.grades);
		cards.search.onSearch = _onSearch;
	}

	function _onSearch(filter, grade) {
		mode.searchFilter = filter;
		mode.searchGrade = grade;
		_reloadFromServer();
	}

	function _reloadFromServer() {
		nlDlg.showLoadingScreen();
		var promise = nl.q(function(resolve, reject) {
			_getDataFromServer(resolve, reject);
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
		var msg = {title: 'Please confirm', 
				   template: nl.t('Are you sure you want to disapprove this lesson and send it for review?'),
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
		nlApproveDlg.show($scope, _userInfo.groupinfo.exportLevel, lessonId);
	}

	function _copyLesson($scope, lessonId) {
		var data = {};
		if(mode.type == TYPES.MY){
			data = {lessonid: lessonId, private: 1};
		}else{			
			data = {lessonid: lessonId, private: 0};
		}
		var msg = {title: 'Copy lesson', 
				   template: nl.t('Are you sure you want to make a private copy of this lesson/worksheet?'),
				   okText: nl.t('Copy')};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;			
			nlServerApi.lessonCopy(data).then(function(status) {
				nlDlg.showLoadingScreen();
				$scope.newLessonId = status;
				$scope.statusType = false;
				if(mode.type != TYPES.MY) $scope.statusType = true;
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
				copyLessonDlg.show('view_controllers/lesson_list/copy_lesson.html',
				[copyButton], closeButton, false);
				nlDlg.hideLoadingScreen();
			});
			
		});
	}
	$scope.gotoMyLessonsFromApproved = function() {
	  nl.location.url('lesson_list?type=my');
	};

	function _reopenLesson($scope, lessonId) {
		var msg = {title: 'Please confirm', 
				   template: nl.t('Are you sure you want to reopen the review?'),
				   okText: nl.t('reopen')};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;			
			nlServerApi.lessonReopenReview(lessonId).then(function(status) {
				nlDlg.showLoadingScreen();
				_updateCardAfterReviewlist();
			});
		});			
	}
	
	function _closereviewLesson($scope, lessonId) {
		var msg = {title: 'Please confirm', 
				   template: nl.t('Are you sure you want to close the review?'),
				   okText: nl.t('close review')};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;			
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
	
	
	function _updateCardlist($scope, lessonId){
		for (var i in $scope.cards.cardlist) {
			var card = $scope.cards.cardlist[i];
			if (card.lessonId !== lessonId) continue;
			$scope.cards.cardlist.splice(i, 1);
		}
		nl.window.location.reload();
	}
	
	function _updateCardAfterReviewlist(){
		nl.window.location.reload();
	}

}];

//-------------------------------------------------------------------------------------------------
var ApproveDlgSrv = ['nl', 'nlDlg', 'nlServerApi',
function(nl, nlDlg, nlServerApi) {

    this.show = function(parentScope, groupExportLevel, lessonId) {
		var approveDlg = nlDlg.create(parentScope);
		_initDlg(approveDlg, groupExportLevel, lessonId);
		nlDlg.showLoadingScreen();

		approveDlg.scope.onNodeClick = function(node, isSelected, tree) {
			_onNodeClick(approveDlg, node, isSelected);
		};

		nlServerApi.lessonPreApproveCheck(lessonId).then(function(data) {
			nlDlg.hideLoadingScreen();
			_onPerApproveDone(data, approveDlg, groupExportLevel);
			_showDlg(approveDlg);
		});
    };

	var EL_PRIVATE=0;
	var EL_DEPENDANT=1;
	var EL_LOGEDIN=2;
	var EL_PUBLIC=3;
	var _ExportLevelDesc = ['Visible only to users within the group', 
							'Visible to users within the group and dependent groups', 
							'Visible to every logedin user',
							'Visible to everyone'];
	
	function _getExportLevelOptions(exportLevel) {
		var elLevelList = [];
		for(var i=0; i<=exportLevel; i++)
			elLevelList.push({id: i, name: _ExportLevelDesc[i]});
		return elLevelList;
	}
	
	function _visibleToStr(selectedOus) {
		if (selectedOus.length == 0) return nl.t('all user groups/classes');
		return nl.t('{} user groups/classes: {}', selectedOus.length, selectedOus);			
	}
	                    
	function _dictToArray(dict1) {
		var ret = [];
		for(var i in dict1) ret.push(dict1[i]);
		return ret.sort();
	}
	
	function _arrayToDict(arr1) {
		var ret = {};
		for(var i in arr1) ret[arr1[i]] = arr1[i];
		return ret;
	}
	
	function _initDlg(approveDlg, groupExportLevel, lessonId) {
		approveDlg.lessonId = lessonId;
		approveDlg.setCssClass('nl-height-max nl-width-max');
        approveDlg.scope.error = {};
		approveDlg.scope.data = {};
		approveDlg.scope.options = {};
		approveDlg.scope.treeOptions = {
			defaultSelectedState: false,
			twistieExpandedTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('folder.png')),
			twistieCollapsedTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('folder_closed.png')),
			twistieLeafTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('file.png')),
		    labelAttribute: 'text'
		};
		approveDlg.scope.options.exportLevel = _getExportLevelOptions(groupExportLevel);
	}

	function _onPerApproveDone(data, approveDlg, groupExportLevel) {
		approveDlg.scope.treeData = data.ouTree;
		var el = data.exportLevel && data.exportLevel <= groupExportLevel ? data.exportLevel : EL_PRIVATE;
		approveDlg.scope.data.exportLevel = {id: el};
		approveDlg.selectedOusDict = _arrayToDict(data.selectedOus);
		approveDlg.scope.data.visibleTo = _visibleToStr(_dictToArray(approveDlg.selectedOusDict));
	}
	
	function _onNodeClick(approveDlg, node, isSelected) {
		if (isSelected) {
			approveDlg.selectedOusDict[node.id] = node.id;
		} else if (node.id in approveDlg.selectedOusDict) {
			delete approveDlg.selectedOusDict[node.id];
		}
		approveDlg.scope.data.visibleTo = _visibleToStr(_dictToArray(approveDlg.selectedOusDict));
	}
	
	function _onApproveClick(e, approveDlg) {
		if(e) e.preventDefault();
		nlDlg.showLoadingScreen();
		var data = {lessonid: approveDlg.lessonId};
		data.exportLevel = approveDlg.scope.data.exportLevel.id;
		data.selectedOus = _dictToArray(approveDlg.selectedOusDict);
		nlServerApi.lessonApprove(data).then(function(status) {
			nlDlg.showLoadingScreen();
			nl.window.location.reload();
		});
	}

	function _showDlg(approveDlg) {
		var approveButton = {text : nl.t('Approve'), onTap : function(e) {_onApproveClick(e, approveDlg); }};
		var cancelButton = {text : nl.t('Cancel')};
		approveDlg.show('view_controllers/lesson_list/lesson_approve_dlg.html',
			[approveButton], cancelButton, false);
    }
}];

module_init();
})();

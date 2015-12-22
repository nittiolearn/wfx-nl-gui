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
		url: '/assignment',
		views: {
			'appContent': {
				templateUrl: 'lib_ui/cards/cardsview.html',
				controller: 'nl.AssignmentDeskCtrl'
			}
		}});
}];
//-------------------------------------------------------------------------------------------------

var AssignmentDeskCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi) {
		
	var assignDict = {};
	var past = false;
	var _userInfo = null;
	var _searchFilterInUrl = '';

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		_initParams();
		return nl.q(function(resolve, reject) {
	        var params = nl.location.search();
	        past = ('past' in params) ? parseInt(params.past) == 1: false;
	       	nl.pginfo.pageTitle = past === true? nl.t('Past Assignments'): nl.t('New Assignments');
        	$scope.cards = {};
        	
			$scope.cards.emptycard = _getEmptyCard(nlCardsSrv);
			_getDataFromServer(_searchFilterInUrl, resolve, reject);
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

	function _getEmptyCard(nlCardsSrv) {
		var help = null;
		if (!past) {
			help = nl.t('There are no assignments to display.');
		}
		return nlCardsSrv.getEmptyCard({help:help});
	}

	function _getDataFromServer(filter, resolve, reject) {
		_listingFunction(filter).then(function(resultList) {
			nl.log.debug('Got result: ', resultList.length);
			$scope.cards.cardlist = _getCards(_userInfo, resultList, nlCardsSrv);
			_addSearchInfo($scope.cards);
			resolve(true);
		}, function(reason) {
            resolve(false);
		});
	}

	function _listingFunction(filter) {
			return nlServerApi.assignmentGetMyList({bPast: past, search: filter});
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
		assignDict[assignment.id] = assignment;
		var url = nl.fmt2('#/app/assignment?id={}', assignment.id);
	    var card = {assignmentId: assignment.id,
	    			title: assignment.name, 
					icon: nl.url.lessonIconUrl(assignment.icon), 
					url: url,
					help: nl.t("<b>Assigned to:</b> {}<br> <b>Subject:</b> {}<br> <b>by:</b> {}", assignment.assigned_to, assignment.subject, assignment.assigned_by),
					children: []};
		card.details = {help: card.help, avps: _getCourseAvps(assignment)};
		console.log(card);
		card.links = [];
		card.links.push({id: 'details', text: nl.t('details')});
		return card;
	}
	
	function  _getCourseAvps(assignment) {
		var avps = [];
		nl.fmt.addAvp(avps, 'Operations', 'View_report');
		nl.fmt.addAvp(avps, 'Name', assignment.name);
		nl.fmt.addAvp(avps, 'Remarks', assignment.remarks);		
		nl.fmt.addAvp(avps, 'Assigned by', assignment.assigned_by);
		nl.fmt.addAvp(avps, 'Owner', assignment.authorname);
		nl.fmt.addAvp(avps, 'Assigned on', assignment.assigned_on, 'date');
		nl.fmt.addAvp(avps, 'Started on', assignment.started_on, 'date');
		nl.fmt.addAvp(avps, 'Ended on', assignment.ended_on, 'date');
		nl.fmt.addAvp(avps, 'Assigned to', assignment.assigned_to);
		nl.fmt.addAvp(avps, 'Subject', assignment.subject);
		nl.fmt.addAvp(avps, 'Lesson Author', assignment.lesson_author);
		nl.fmt.addAvp(avps, 'Lesson Description', assignment.description);
		nl.fmt.addAvp(avps, 'Earliest start time', assignment.earliest_start_time, 'date');
		nl.fmt.addAvp(avps, 'Latest end time', assignment.latest_end_time, 'date');
		nl.fmt.addAvp(avps, 'Max duration', assignment.max_duration);
		nl.fmt.addAvp(avps, 'Show answers', assignment.show_answers);
		nl.fmt.addAvp(avps, 'Is published?', assignment.is_published);
		nl.fmt.addAvp(avps, 'Discussion forum', assignment.discussion_forum);
		return avps;
	}
	
	function _addSearchInfo(cards) {
		cards.search = {placeholder: nl.t('Enter course name/description')};
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

	function _initParams() {
		assignDict = {};
        var params = nl.location.search();
	        past = ('past' in params) ? parseInt(params.past) == 1: false;
        _searchFilterInUrl = ('search' in params) ? params.search : '';
	}

}];
module_init();
})();

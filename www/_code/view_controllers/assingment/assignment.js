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
		var url = nl.fmt2('/lesson/do_report_assign/{}/', assignment.id);
	    var card = {assignmentId: assignment.id,
	    			title: assignment.name, 
					icon: nl.url.lessonIconUrl(assignment.icon), 
					url: url,
					children: []};
		if(past == true) {
			card['help'] = nl.t("Assigned to: <b>{}</b><br> Subject: {}<br> by: <b>{}</b><br> <img src={} class='nl-24'> completed",
								 assignment.assigned_to, assignment.subject, assignment.assigned_by, nl.url.resUrl('general/tick.png'));
		}else{
			card['help'] = nl.t("Assigned to: <b>{}</b><br> Subject: {}<br> by: <b>{}</b><br> {}", 
								 assignment.assigned_to, assignment.subject, assignment.assigned_by, assignment.assign_remarks);			
		}
		card.details = {help: nl.t('Details about the assignment'), avps: _getAssignmentAvps(assignment)};
		card.links = [];
		card.links.push({id: 'details', text: nl.t('details')});
		//console.log(assignment.published);
		return card;
	}
	
	function  _getAssignmentAvps(assignment) {
		var avps = [];
		_addAvp(avps, 'Operations', assignment.id, 'link', past);
		nl.fmt.addAvp(avps, 'Name', assignment.name);
		nl.fmt.addAvp(avps, 'Remarks', assignment.assign_remarks);		
		nl.fmt.addAvp(avps, 'Assigned by', assignment.assigned_by);
		nl.fmt.addAvp(avps, 'Owner', assignment.authorname);
		nl.fmt.addAvp(avps, 'Assigned on', assignment.assigned_on, 'date');
		nl.fmt.addAvp(avps, 'Started on', assignment.started, 'date');
		nl.fmt.addAvp(avps, 'Ended on', assignment.ended, 'date');
		nl.fmt.addAvp(avps, 'Assigned to', assignment.assigned_to);
		nl.fmt.addAvp(avps, 'Subject', assignment.subject);
		nl.fmt.addAvp(avps, 'Lesson Author', assignment.authorname);
		nl.fmt.addAvp(avps, 'Lesson Description', assignment.descMore);
		nl.fmt.addAvp(avps, 'Earliest start time', assignment.not_before, 'date');
		nl.fmt.addAvp(avps, 'Latest end time', assignment.not_after, 'date');
		nl.fmt.addAvp(avps, 'Max duration', assignment.max_duration, 'minutes');
		_addAvp(avps, 'Show answers', assignment.learnmode, 'string');
		_addAvp(avps, 'Is published?', assignment.published, 'publish');
		nl.fmt.addAvp(avps, 'Discussion forum', assignment.forum, 'boolean');
		return avps;
	}
	
	function _addAvp(avps, fieldName, fieldValue, fmtType, fieldDefault){
		if(fmtType == 'link') {
		    if (fieldDefault == true) { 
		        fieldValue = nl.fmt.t(["<a href='/lesson/view_report_assign/{}/'> view report</a>", fieldValue]);
		    }else{
		        fieldValue = nl.fmt.t(["<a href='/lesson/do_report_assign/{}/'> Do assignments</a>", fieldValue]);
		    }
		 }
		if(fmtType == 'string') {
			if(fieldValue == 1) fieldValue = nl.fmt.t(['on every page']);
			if(fieldValue == 2) fieldValue = nl.fmt.t(['after submitting']);
			if(fieldValue == 3) fieldValue = nl.fmt.t(['only when published']);
		}
		if(fmtType == 'publish') fieldValue = fieldValue == true ? nl.fmt.t(['True']): nl.fmt.t(['False']);
		if(!fieldValue) fieldValue = fieldDefault || '-';		
		return avps.push({attr: nl.fmt.t([fieldName]), val: fieldValue});
	}
	
	function _addSearchInfo(cards) {
		cards.search = {placeholder: nl.t('Enter assignment name/description')};
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

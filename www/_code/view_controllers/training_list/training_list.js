(function() {

//-------------------------------------------------------------------------------------------------
// training_list.js:
// training module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.training_list', [])
	.config(configFn)
    .directive('nlTrainingDetails', TrainingDetailsDirective)
	.controller('nl.TrainingListCtrl', TrainingListCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.training_list', {
		url: '^/training_list',
		views: {
			'appContent': {
				templateUrl: 'lib_ui/cards/cardsview.html',
				controller: 'nl.TrainingListCtrl'
			}
	}});
}];
var _userInfo = null;
var _searchFilterInUrl = null;
var _max = 100;
var TrainingListCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlMetaDlg',
function(nl, nlRouter, $scope, nlServerApi, nlMetaDlg) {
    function _onPageEnter(userInfo) {
        _userInfo = userInfo;
        return nl.q(function(resolve, reject) {
			nl.pginfo.pageTitle = nl.t('Training List');
			$scope.cards = {};
			$scope.cards.listConfig = {columns: _getTableColumns(), canShowDetils: true, smallColumns: 1};
			_getDataFromServer(_searchFilterInUrl, false, resolve, reject);
        });
    }

    function _onPageLeave() {
    	return false;
    }
    
    nlRouter.initContoller($scope, '', _onPageEnter, _onPageLeave);

	function _getTableColumns() {
		return [{attr: 'title', name: 'Title', type: 'text', 'showInSmallScreen': true, cls: 'col'}, 
				{attr: 'start_date', name: 'Start date', type: 'date', 'showInSmallScreen': false, cls: 'col'},
				{attr: 'end_date', name: 'End date', type: 'date', 'showInSmallScreen': false, cls: 'col'}];		
	}

    function _onSearchImpl(fetchMore) {
		nlDlg.showLoadingScreen();
		var promise = nl.q(function(resolve, reject) {
			_getDataFromServer(_searchFilterInUrl, fetchMore, resolve, reject);
		});
		promise.then(function(res) {
			nlDlg.hideLoadingScreen();
		});
	}

	function _getDataFromServer(filter, fetchMore, resolve, reject) {
		nlServerApi.trainingList().then(function(trainingList) {
		    $scope.cards.cardlist = _getTrainingCards(_userInfo, trainingList);
			_addSearchInfo($scope.cards);
			resolve(true);
		}, function(reason) {
            resolve(false);
        });
	}

	function _getTrainingCards(userInfo, trainingList) {
		var lists = [];
		for (var i = 0; i < trainingList.length; i++) {
			var list = _createCard(trainingList[i], userInfo);
			lists.push(list);
		}
		return lists;
	}

	function _createCard(item, userInfo) {
		var url = null;
		var internalUrl = null;
		var card = {
			id : item.id,
			title : item.name,
			icon : nl.url.lessonIconUrl(item.image),
			internalUrl : internalUrl,
			authorName : item.authorname,
			description : item.description,
			start_date: nl.fmt.jsonDate2Str(item.start_date, 'minute'),
			end_date: nl.fmt.jsonDate2Str(item.end_date, 'minute'),
			created: nl.fmt.jsonDate2Str(item.created, 'minute'),
			updated: nl.fmt.jsonDate2Str(item.updated, 'minute'),
			children : []
		};
		card.details = {
			help : item.description,
			avps : _getLessonListAvps(item)
		};
		card.links = [];
		card.links.push({
			id : 'details',
			text : nl.t('details')
		});
		return card;		
	}

	function _getLessonListAvps(list){
		var avps = [];
		nl.fmt.addAvp(avps, 'Name', list.name);
		nl.fmt.addAvp(avps, 'Created on ', list.created, 'date');
		nl.fmt.addAvp(avps, 'Updated on', list.updated, 'date');
		nl.fmt.addAvp(avps, 'Author', list.authorname);
		nl.fmt.addAvp(avps, 'Description', list.description);
		nl.fmt.addAvp(avps, 'Start date', list.start_date, 'date');
		nl.fmt.addAvp(avps, 'End date', list.end_date, 'date');
		nl.fmt.addAvp(avps, 'Training type', list.trainingtype);
		nl.fmt.addAvp(avps, 'Nominate', list.nominate);
		return avps;
	}
	
	function _addSearchInfo(cards) {
		cards.search = {placeholder: nl.t('Enter course name/description'),
		                maxLimit: _max};
		cards.search.onSearch = _onSearch;
	}

	function _onSearch(filter, grade, onSearchParamChange) {
	    _searchFilterInUrl = filter;
        nlMetaDlg.showAdvancedSearchDlg($scope, _userInfo, 'course', _searchFilterInUrl)
        .then(function(result) {
            _searchFilterInUrl = result.metadata.search || '';
            onSearchParamChange(_searchFilterInUrl, grade);
            _onSearchImpl();
        });
    }

    function _fetchMore() {
        _onSearchImpl(true);
    }
    
    function _onSearchImpl(fetchMore) {
		nlDlg.showLoadingScreen();
		var promise = nl.q(function(resolve, reject) {
			_getDataFromServer(_searchFilterInUrl, fetchMore, resolve, reject);
		});
		promise.then(function(res) {
			nlDlg.hideLoadingScreen();
		});
	}
	
}];

var TrainingDetailsDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/training_list/training_details.html',
        scope: {
            trainingcard: '='
        },
    };
}];

module_init();
})();

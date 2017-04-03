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
				templateUrl: 'view_controllers/training_list/traininglistview.html',
				controller: 'nl.TrainingListCtrl'
			}
	}});
}];
var _userInfo = null;
var _searchFilterInUrl = null;
var _max = 100;
var TrainingListCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlServerApi', 'nlMetaDlg',
function(nl, nlRouter, $scope, nlDlg, nlServerApi, nlMetaDlg) {
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

	$scope.publishNewTraining = function(){
		_editTrainingModule(null, null);
	};
	
	$scope.onCardInternalUrlClicked = function(card, internalUrl){
		if(internalUrl == 'training_nominate'){
			_nominateUser(card);
		}else if(internalUrl == 'training_edit'){
			_editTrainingModule(card, card.id);
		}
	};

	function _nominateUser(card){
		nlServerApi.getNominationList(card.id).then(function(list){
			_showNominatedUserList(list);
		});				
	}

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
		var linkAvp = nl.fmt.addLinksAvp(avps, 'Operation(s)');
		_populateLinks(linkAvp);
		nl.fmt.addAvp(avps, 'Created on ', list.created, 'date');
		nl.fmt.addAvp(avps, 'Updated on', list.updated, 'date');
		nl.fmt.addAvp(avps, 'Published by', list.authorname);
		nl.fmt.addAvp(avps, 'Description', list.description);
		nl.fmt.addAvp(avps, 'Start date', list.start_date, 'date');
		nl.fmt.addAvp(avps, 'End date', list.end_date, 'date');
		//nl.fmt.addAvp(avps, 'Training type', list.trainingtype);
		//nl.fmt.addAvp(avps, 'Nominate', list.nominate);
		return avps;
	}
	
	function _populateLinks(linkAvp){
		nl.fmt.addLinkToAvp(linkAvp, nl.url.resUrl('user.png'), null, 'training_nominate');
		nl.fmt.addLinkToAvp(linkAvp, 'edit', null, 'training_edit');
		nl.fmt.addLinkToAvp(linkAvp, 'view', null, 'training_view');
		nl.fmt.addLinkToAvp(linkAvp, 'delete', null, 'training_delete');
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
	
	function _editTrainingModule(card, id){
		var _showTrainingEditDlg = nlDlg.create($scope);
			_showTrainingEditDlg.setCssClass('nl-height-max nl-width-max');
			_showTrainingEditDlg.scope.error = {};
			_showTrainingEditDlg.scope.data = {};
			_showTrainingEditDlg.scope.data.title = card ? nl.t('Edit training module') : nl.t('Publish new training');
			_showTrainingEditDlg.scope.data.card = card ? card : '';
		var PublishNewButton = {
			text : nl.t('Publish new'),
			onTap : function(e) {
				_onModuleEdit(e, $scope, _showTrainingEditDlg.scope, null);
			}
		};

		var editButton = {
			text : nl.t('Edit'),
			onTap : function(e) {
				_onModuleEdit(e, $scope, _showTrainingEditDlg.scope, id);
			}
		};
		var cancelButton = {
			text : nl.t('Cancel')
		};
		
		var buttonName = id ? editButton : PublishNewButton;
		_showTrainingEditDlg.show('view_controllers/training_list/trainig_edit_dlg.html', [buttonName], cancelButton);
	}

	function _onModuleEdit(e, $scope, dlgScope, id) { 
	    if(!_validateInputs(dlgScope)) {
	        if(e) e.preventDefault();
	        return null;
	    }
		//Server api modify need to be called on edit.
		var serverFunction = (id != null) ? nlServerApi.modifyTraining : nlServerApi.publishTraining;
		_onModifyDone(dlgScope.data.card, $scope, id);
	}

    function _onModifyDone(card, $scope, id) {
		nlDlg.hideLoadingScreen();
		var module = {
				id:'0',
				name:card.title,
				start_date: card.start_date,
				end_date : card.start_date,
				created : card.start_date,
				updated : card.start_date,
				authorname:"Nittio Admin",
				trainingtype:"offline",
				nominate:"self",
				description:card.description,
				image:"NittioSun.png"
			};
		var card = (id == null) ? _createCard(module, _userInfo) : _createCard(card, _userInfo);
		if(id != null){
	        var pos = _getCardPosition(card.id);
	        $scope.cards.cardlist.splice(pos, 1);
		}
		$scope.cards.cardlist.splice(0, 0, card);			
	}

	function _getCardPosition(courseId) {
		for(var i in $scope.cards.cardlist) {
			var card = $scope.cards.cardlist[i];
			if(card.courseId === courseId) return i;
		}
		nl.log.error('Cannot find modified card', courseId);
		return 0;
	}

   function _validateInputs(scope) {
        scope.error = {};
        if(!scope.data.card.title) return _validateFail(scope, 'title', 'Name is mandatory');
        if(!scope.data.card.start_date) return _validateFail(scope, 'start_date', 'start_date is mandatory');
        if(!scope.data.card.end_date) return _validateFail(scope, 'end_date', 'end_date is mandatory');
		return true;
	}

    function _validateFail(scope, attr, errMsg) {
    	return nlDlg.setFieldError(scope, attr,
        	nl.t(errMsg));
    }

	function _showNominatedUserList(userlist){
		var _showNominatedUserDlg = nlDlg.create($scope);
			_showNominatedUserDlg.setCssClass('nl-height-max nl-width-max');
			_showNominatedUserDlg.scope.data = {};
			_showNominatedUserDlg.scope.data.userlist = userlist;
			_showNominatedUserDlg.scope.data.headerCol = [{attr: 'username', name: nl.t('Username')}, {attr: 'nominatedOn', name: nl.t('Nominated on')}, {attr: "status", name: nl.t('Status')}];
			_showNominatedUserDlg.scope.data.title = nl.t('Nominated users');
		var cancelButton = {
			text : nl.t('Cancel')
		};
		_showNominatedUserDlg.show('view_controllers/training_list/nominated_user_dlg.html', [], cancelButton);		
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
        link: function($scope, iElem, iAttrs) {
            $scope.onCardInternalUrlClicked = function(card, internalUrl) {
            	$scope.$parent.onCardInternalUrlClicked(card, internalUrl);
            };
        }
    };
}];

module_init();
})();

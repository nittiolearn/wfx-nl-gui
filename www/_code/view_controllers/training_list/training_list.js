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

var TrainingListCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlServerApi', 'nlMetaDlg',
function(nl, nlRouter, $scope, nlDlg, nlServerApi, nlMetaDlg) {

	var _userInfo = null;
	var trainingListDict = {};
    function _onPageEnter(userInfo) {
        _userInfo = userInfo;
        trainingListDict = {};
        return nl.q(function(resolve, reject) {
			nl.pginfo.pageTitle = nl.t('Trainings');
			$scope.cards = {};
			$scope.cards.listConfig = {columns: _getTableColumns(), canShowDetils: true, smallColumns: 1};
			_getDataFromServer(false, resolve, reject);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);

	function _getTableColumns() {
		return [{attr: 'title', name: 'Title', type: 'text', 'showInSmallScreen': true, cls: 'col'}, 
				{attr: 'start_date', name: 'Start date', type: 'date', 'showInSmallScreen': false, cls: 'col'},
				{attr: 'end_date', name: 'End date', type: 'date', 'showInSmallScreen': false, cls: 'col'}];		
	}

	function _getDataFromServer(fetchMore, resolve, reject) {
		nlServerApi.getTrainingList().then(function(trainingList) {
			_addSearchInfo($scope.cards);
		    _updateTrainingCards(trainingList);
			resolve(true);
		}, function(reason) {
            resolve(false);
        });
	}

	function _addSearchInfo(cards) {
		cards.search = {placeholder: nl.t('Enter course name/description')};
	}

	function _updateTrainingCards(trainingList) {
		$scope.cards.cardlist = [];
		for (var i = 0; i < trainingList.length; i++) {
			var card = _createCard(trainingList[i]);
			$scope.cards.cardlist.push(card);
		}
	}

	function _createCard(item) {
		trainingListDict[item.id] = item;
		var card = {
			id : item.id,
			training : item,
			title : item.name,
			start_date: nl.fmt.jsonDate2Str(item.start, 'date'),
			end_date: nl.fmt.jsonDate2Str(item.end, 'date'),
			description: item.desc,
			children : [],
			details: {},
			links: [],
			listDetails: '<nl-training-details card="card"></nl-training-details>'
		};
		return card;
	}

	$scope.publishNewTraining = function() {
		_editTrainingModule(null, null);
	};
	
	$scope.onCardInternalUrlClicked = function(card, internalUrl) {
		if(internalUrl == 'training_nomination_list'){
			_nominationList(card);
		}else if(internalUrl == 'training_edit'){
			_editTrainingModule(card, card.id);
		}
	};

	function _nominationList(card) {
		nlDlg.showLoadingScreen();
		nlDlg.popupAlert({title: 'Alert message', template:'Yet to be implemented'}).then(function(){
			return;
		});
		// nlServerApi.getNominationList(card.id).then(function(list){
			// _showNominatedUserList(list);
		// });				
	}

	function _editTrainingModule(card, id){
		var _showTrainingEditDlg = nlDlg.create($scope);
			_showTrainingEditDlg.setCssClass('nl-height-max nl-width-max');
			_showTrainingEditDlg.scope.error = {};
			_showTrainingEditDlg.scope.data = {};
			_showTrainingEditDlg.scope.card = card;
			_showTrainingEditDlg.scope.dlgTitle = card ? nl.t('Edit training module') : nl.t('Create new training');
			_showTrainingEditDlg.scope.data = (card !== null) ? card : {title: '', description: '', start_date: '', end_date: ''};
		var PublishNewButton = {
			text : nl.t('Create'),
			onTap : function(e) {
				_onModuleEdit(e, $scope, _showTrainingEditDlg.scope, null, null);
			}
		};

		var editButton = {
			text : nl.t('Edit'),
			onTap : function(e) {
				_onModuleEdit(e, $scope, _showTrainingEditDlg.scope, card, id);
			}
		};
		var cancelButton = {
			text : nl.t('Cancel')
		};
		
		var buttonName = id ? editButton : PublishNewButton;
		_showTrainingEditDlg.show('view_controllers/training_list/trainig_edit_dlg.html', [buttonName], cancelButton);
	}

	function _onModuleEdit(e, $scope, dlgScope, card, id) { 
		if(!_validateInputs(dlgScope)) {
	        if(e) e.preventDefault();
	        return null;
	    }
		nlDlg.showLoadingScreen();	    
		
		var serverFunction = (id != null) ? nlServerApi.trainingModify : nlServerApi.trainingCreate;
		var startDateFromServer = (card !== null) ? trainingListDict[id].start : dlgScope.data.start_date;
		var EndDateFromServer = (card !== null) ? trainingListDict[id].end : dlgScope.data.end_date;
		if((id !== null) && (dlgScope.data.start_date === dlgScope.card.start_date)) {
			console.log(dlgScope.data.start_date, dlgScope.card.start_date, trainingListDict[id].start);
			dlgScope.data.start_date = trainingListDict[id].start;
		}
		if((id !== null) && (dlgScope.data.end_date === dlgScope.card.end_date)) {
			console.log(dlgScope.data.end_date);
			dlgScope.data.end_date = trainingListDict[id].end;
		}
		var data = {
				name: dlgScope.data.title,
				desc: dlgScope.data.description,
				nomination : "self",
				type : "external",
				id : (id !== null) ? dlgScope.data.id : 0, 
				moduleid: 0,
				start : dlgScope.data.start_date,
				end : dlgScope.data.end_date
		};
		serverFunction(data).then(function(module){
			_onModifyDone(module, $scope, id);
		});
	}

    function _onModifyDone(card, $scope, id) {
		nlDlg.hideLoadingScreen();
		card = _createCard(card);
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
        if(!scope.data.title) return _validateFail(scope, 'title', 'Name is mandatory');
        if(!scope.data.start_date) return _validateFail(scope, 'start_date', 'start_date is mandatory');
        if(!scope.data.end_date) return _validateFail(scope, 'end_date', 'end_date is mandatory');
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
            card: '='
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

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

var TrainingListCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlServerApi', 'nlMetaDlg', 'nlSendAssignmentSrv', 'nlLessonSelect',
function(nl, nlRouter, $scope, nlDlg, nlServerApi, nlMetaDlg, nlSendAssignmentSrv, nlLessonSelect) {

	var _userInfo = null;
	var trainingListDict = {};
	var _scope = null;
    function _onPageEnter(userInfo) {
        _userInfo = userInfo;
        trainingListDict = {};
        return nl.q(function(resolve, reject) {
			nl.pginfo.pageTitle = nl.t('Trainings');
			_scope = $scope;
			$scope.cards = {};
			$scope.cards.listConfig = {columns: _getTableColumns(), canShowDetils: true, smallColumns: 1};
			_getDataFromServer(false, resolve, reject);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);

	function _getTableColumns() {
		return [{attr: 'title', name: 'Training', type: 'text', 'showInSmallScreen': true, cls: 'col'}, 
				{attr: 'start_date', name: 'From', type: 'date', 'showInSmallScreen': false, cls: 'col'},
				{attr: 'end_date', name: 'Till', type: 'date', 'showInSmallScreen': false, cls: 'col'}];		
	}

	function _getDataFromServer(fetchMore, resolve, reject) {
		nlServerApi.getTrainingList().then(function(trainingList) {
			console.log(trainingList);
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
			moduleid: item.moduleid,
			start_date: nl.fmt.jsonDate2Str(item.start, 'minute'),
			end_date: nl.fmt.jsonDate2Str(item.end, 'minute'),
			description: item.desc,
			children : [],
			details: {},
			links: [],
			listDetails: '<nl-training-details card="card"></nl-training-details>'
		};
		card.training.created = nl.fmt.jsonDate2Str(item.created, 'second');
		card.training.updated = nl.fmt.jsonDate2Str(item.updated, 'second');
		return card;
	}

	$scope.publishNewTraining = function() {
		_editTrainingModule(null, null);
	};
		
	$scope.onCardInternalUrlClicked = function(card, internalUrl) {
		if(internalUrl == 'training_nomination_list'){
			_nominationUserList(card);
		}else if(internalUrl == 'training_edit'){
			_editTrainingModule(card, card.id);
		}else if(internalUrl == 'training_assign'){
			_assignTrainingModule(card);
		}
	};


	function _nominationUserList(card) {
		nlDlg.showLoadingScreen();
		nlServerApi.getNominationList().then(function(list){
			_showNominatedUserList(card, list);
		});				
	}

	function _editTrainingModule(card, id){
		var _showTrainingEditDlg = nlDlg.create($scope);
			_showTrainingEditDlg.setCssClass('nl-height-max nl-width-max');
			_showTrainingEditDlg.scope.error = {};
			_showTrainingEditDlg.scope.data = {};
			_showTrainingEditDlg.scope.dlgTitle = card ? nl.t('Edit training module') : nl.t('Create new training');
			_showTrainingEditDlg.scope.data = (card !== null) ? card : {title: '', description: '', start_date: '', end_date: '', moduleid: ''};

			_showTrainingEditDlg.scope.searchLesson = function _searchLesson(){
		    	nlLessonSelect.showSelectDlg($scope, _userInfo).then(function(selectionList) {
		    		if (selectionList.length != 1) return;
					_showTrainingEditDlg.scope.data.moduleid = selectionList[0].lessonId;
			    	_showTrainingEditDlg.scope.data.modulename = selectionList[0].title;
			    	_showTrainingEditDlg.scope.data.moduleicon = selectionList[0].icon;
		    	});
		    };

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
		var serverFunction = (id !== null) ? nlServerApi.trainingModify : nlServerApi.trainingCreate;

		var data = {
				name: dlgScope.data.title,
				desc: dlgScope.data.description,
				nomination : "self",
				type : "external",
				id : (id !== null) ? dlgScope.data.id : 0, 
				moduleid: dlgScope.data.moduleid,
				modulename: dlgScope.data.modulename,
				moduleicon: dlgScope.data.moduleicon,
				start : nl.fmt.json2Date(dlgScope.data.start_date),
				end : nl.fmt.json2Date(dlgScope.data.end_date)
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
        if(!scope.data.description) return _validateFail(scope, 'description', 'Provide description for module');
        if(!scope.data.start_date) return _validateFail(scope, 'start_date', 'start_date is mandatory');
        if(!scope.data.end_date) return _validateFail(scope, 'end_date', 'end_date is mandatory');
		return true;
	}

    function _validateFail(scope, attr, errMsg) {
    	return nlDlg.setFieldError(scope, attr,
        	nl.t(errMsg));
    }

	function _showNominatedUserList(card, userlist){
		var _showNominatedUserDlg = nlDlg.create($scope);
			_showNominatedUserDlg.setCssClass('nl-height-max nl-width-max');
			_showNominatedUserDlg.scope.data = {};
			_showNominatedUserDlg.scope.data.card = card;
			var sortedlist = _sortByDepartment(userlist);
			_showNominatedUserDlg.scope.data.userlist = sortedlist;
			_showNominatedUserDlg.scope.data.headerCol = [{attr: 'name', name: nl.t('Username')}, {attr: 'department', name: nl.t('Department')}, {attr: "status", name: nl.t('Status')}];
			_showNominatedUserDlg.scope.data.title = nl.t('Nominated users');
		var cancelButton = {
			text : nl.t('Cancel')
		};
		_showNominatedUserDlg.show('view_controllers/training_list/nominated_user_dlg.html', [], cancelButton);		
	}

	function _sortByDepartment(list){
		var sortedList = list.sort(function(a, b){
		    				var firstStr=a.department.toLowerCase(), secondStr=b.department.toLowerCase();
    						if (firstStr < secondStr) return -1; 
    						if (firstStr > secondStr) 	return 1;
    						return 0;
					});
		return sortedList;
	}
	
	function _assignTrainingModule(trainingModule){
        var trainingInfo = {type: 'module', id: trainingModule.moduleid, icon: null, 
            title: '', description: '', starttime: new Date(trainingModule.start_date),
            endtime: new Date(trainingModule.end_date), esttime: '', hideTimes: true, training: true};
	        trainingInfo.title = trainingInfo.title;
	        trainingInfo.description = trainingModule.description;
        	trainingInfo.authorName = _userInfo.displayname;
        nlServerApi.getNominationList().then(function(list){
        	trainingInfo.nominatedUsers = _getUserDict(list);
	        nlSendAssignmentSrv.show(_scope, trainingInfo).then(function(e) {
	            if (e) nl.location.url('/home'); 
	        });		
        });
	};
	
	function _getUserDict(list){
		var userDict = {};
		for(var i=0; i<list.length; i++){
			var user = list[i];
			userDict[user.id] = user.name;
		}
		return userDict;	
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

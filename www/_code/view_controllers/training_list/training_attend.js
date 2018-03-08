(function() {

//-------------------------------------------------------------------------------------------------
// training_attend.js:
// training module: learner's view of list of offline training
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.training_attend', [])
	.config(configFn)
	.controller('nl.TrainingAttendCtrl', TrainingAttendCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.training_attend', {
		url : '^/training_attend',
		views : {
			'appContent' : {
				templateUrl : 'lib_ui/cards/cardsview.html',
				controller : 'nl.TrainingAttendCtrl'
			}
		}
	});
}];

//-------------------------------------------------------------------------------------------------
var TrainingAttendCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi) {

	var _repid = null;
	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
			nl.pginfo.pageTitle = nl.t('My offline training');
            var params = nl.location.search();
            if (params.id) _repid = parseInt(params.id);
			$scope.cards = {
                search: {placeholder: nl.t('Enter training name/description')},
			    listConfig: {
            		columns : _getTableColumns(),
            		canShowDetils : true,
            		smallColumns : 1
            	}
            };
            nlCardsSrv.initCards($scope.cards);
			_getDataFromServer(resolve);
		});
	}


	nlRouter.initContoller($scope, '', _onPageEnter);

	function _getTableColumns() {
		return [{
			attr : 'title',
			name : 'Training',
			type : 'text',
			showInSmallScreen : true,
			cls : ''
		}, {
			attr : 'start_date',
			name : 'From',
			type : 'date',
			showInSmallScreen : false,
			cls : 'fsmall1'
		}, {
			attr : 'end_date',
			name : 'Till',
			type : 'date',
			showInSmallScreen : false,
			cls : 'fsmall1'
		}];
	}

    function _fetchMore() {
        _getDataFromServer(null, true);
    }

    var _pageFetcher = nlServerApi.getPageFetcher();
	function _getDataFromServer(resolve, fetchMore) {
        if (!fetchMore) {
            nlCardsSrv.updateCards($scope.cards, {cardlist: []});
        }
        var params = _repid ? {mode: 'single', id: _repid} : {mode: 'learner', filters: [{field: 'ctype', val: _nl.ctypes.CTYPE_TRAINING}]};
        _pageFetcher.fetchPage(nlServerApi.learningReportsGetList, params, fetchMore, function(results) {
            if (!results) {
                if (resolve) resolve(false);
                return;
            }
			_updateTrainingCards(results);
            nlCardsSrv.updateCards($scope.cards, 
                {canFetchMore: _pageFetcher.canFetchMore()});
            if (resolve) resolve(true);
		});
	}

	function _updateTrainingCards(trainingList) {
		for (var i = 0; i < trainingList.length; i++) {
			var card = _createCard(trainingList[i]);
			$scope.cards.cardlist.push(card);
		}
	}

	function _splitMultilineString(desc) {
		desc = desc.split('\n');
		var ret = '';
		for (var i = 0; i < desc.length; i++) {
			ret += nl.fmt2('<div class="padding1-mid-v">{}</div>', desc[i]);
		}
		return ret;
	}

	function _createCard(item) {
		var content = angular.fromJson(item.content);
		item.descMulti = _splitMultilineString(content.desc || '');
		var card = {
			id : item.id,
			canShowDelete: false, canShowEdit: false,
			training : item,
			title : content.name,
			module : {
				lessonId : item.moduleid,
				title : item.modulename,
				icon : item.moduleicon
			},
			start_date : content.start,
			end_date : content.end,
			description : item.desc,
			sessions: item.sessions,
			ctype: item.ctype,
			training_kind: item.training_kind,
			kindName: item.kindName,
			kindDesc: item.kindDesc,
			children : [],
			details : {},
			links : [],
			listDetails : '<nl-training-details card="card"></nl-training-details>'
		};
		card.training.created = item.created;
		card.training.updated = item.updated;
		return card;
	}

    $scope.onCardInternalUrlClicked = function(card, internalUrl) {
        $scope.onCardLinkClicked(card, internalUrl);
    };
    
    $scope.onCardLinkClicked = function(card, internalUrl) {
        if (internalUrl == 'training_assign' || internalUrl =='training_report') {
            _trainingReportView(card, internalUrl);
        } else if (internalUrl == 'training_edit') {
            _createNewTrainingModule(card, 'edit_batch');
        } else if (internalUrl == 'training_delete') {
            _deleteTrainingModule(card, card.id);
        } else if (internalUrl === 'fetch_more') {
            _fetchMore();
        }
    };
}];

module_init();
})();

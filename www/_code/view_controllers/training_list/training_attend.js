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
				templateUrl : 'view_controllers/training_list/training_attend.html',
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
            else {
				$scope.cards = {
	                search: {placeholder: nl.t('Enter training name/description')},
	            };
	            nlCardsSrv.initCards($scope.cards);
            }
			_getDataFromServer(resolve);
		});
	}

	nlRouter.initContoller($scope, '', _onPageEnter);
	
	$scope.onLaunchModule = function(item) {
		console.log(item);
		var ts = item.content.ts || {};
		if (!ts.childReportId) console.log('TODO: create a child report');
		console.log('TODO: launch the child report URL depeding on its status (see childStatus)');
	};

    function _fetchMore() {
        _getDataFromServer(null, true);
    }

    var _pageFetcher = nlServerApi.getPageFetcher();
	function _getDataFromServer(resolve, fetchMore) {
        if (!fetchMore && !_repid) {
            nlCardsSrv.updateCards($scope.cards, {cardlist: []});
        }
        var params = _repid ? {mode: 'single', objid: _repid} : {mode: 'learner', filters: [{field: 'ctype', val: _nl.ctypes.CTYPE_TRAINING}]};
        _pageFetcher.fetchPage(nlServerApi.learningReportsGetList, params, fetchMore, function(results) {
            if (!results) {
                if (resolve) resolve(false);
                return;
            }
            for (var i=0; i<results.length; i++)
				results[i].content = angular.fromJson(results[i].content);
            if (_repid && results.length == 1) {
            	$scope.item = results[0];
            } else {
				_updateTrainingCards(results);
	            nlCardsSrv.updateCards($scope.cards, 
	                {canFetchMore: _pageFetcher.canFetchMore()});
            }
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
		console.log('TODO-MUNNI-NOW', item);
		var card = {
			id : item.id,
			item : item,
			url: nl.fmt2('/#/training_attend?id={}', item.id),
			title : content.name,
			icon : content.moduleicon,
			start_date : content.start,
			end_date : content.end,
			description : content.desc,
			children : [],
			details : {help: content.desc, avps: _getAvps(item)},
			links : []
		};
		card.links.push({id: 'details', text: nl.t('details')});
		return card;
	}
	
	function _getAvps(item) {
		var content = item.content;
		var avps = [];
		nl.fmt.addAvp(avps, 'Batch Name', content.name);
		nl.fmt.addAvp(avps, 'Batch Description', content.desc);
		nl.fmt.addAvp(avps, 'Training Name', content.kindName);
		nl.fmt.addAvp(avps, 'Training Description', content.kindDesc);
		nl.fmt.addAvp(avps, 'TODO-MUNNI-NOW', 'Please fill needed items based on console log outout of item and content');
		return avps;
		
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

(function() {

//-------------------------------------------------------------------------------------------------
// dashboard.js: custom dashboard
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.searchlist_list', [])
	.config(configFn)
	.controller('nl.SearchlistCtrl', SearchlistCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider',
function($stateProvider) {
	$stateProvider.state('app.searchlist', {
		cache : true,
		url : '/searchlist',
		views : {
			'appContent' : {
				templateUrl : 'lib_ui/cards/cardsview.html',
				controller : 'nl.SearchlistCtrl'
			}
		}
	});
}];

var SearchlistCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlCardsSrv',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlCardsSrv) {
	var searchDict = {};
	var my = false;
	var _searchFilterInUrl = '';
	var _userInfo = null;

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		_initParams();
		return nl.q(function(resolve, reject) {
			nl.pginfo.pageTitle = nl.t('Search list dashboard');
	        var params = nl.location.search();
	        my = ('my' in params) ? parseInt(params.my) == 1: false;
        	$scope.cards = {};
			$scope.cards.staticlist = _getStaticCards();
			$scope.cards.emptycard = _getEmptyCard(nlCardsSrv);
			_getDataFromServer(_searchFilterInUrl, resolve, reject);
		});
	}

	nlRouter.initContoller($scope, '', _onPageEnter);

	function _getDataFromServer(filter, resolve, reject) {
		nlServerApi.searchListGetList({mine: my, search: filter})
		.then(function(resultList) {
			$scope.cards.cardlist = _getCards(_userInfo, resultList, nlCardsSrv);
			_addSearchInfo($scope.cards);
			resolve(true);
		}, function(reason) {
            resolve(false);
		});
	}
	
	function _addSearchInfo(cards) {
		cards.search = {placeholder: nl.t('Enter name/description')};
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

    function _getCards(userInfo, resultList, nlCardsSrv) {
        var cards = [];
        for (var i = 0; i < resultList.length; i++) {
            var card = _createSearchlistCard(resultList[i]);
            cards.push(card);
        }
        return cards;
    }
    
	function _createSearchlistCard(searchlist) {
		searchDict[searchlist.id] = searchlist;
		var createList = {
			searchlistId : searchlist.id,
			title : searchlist.name,
			url: nl.fmt2('#/app/searchlist_view?id={}', searchlist.id),
			icon : nl.url.resUrl('dashboard/defgroup.png'),
			help : nl.t('<P>Author: {}</P><P>Group:{}</P>', searchlist.authorname, searchlist.grpname),
			children :[]
		};
		createList.details = {help: searchlist.description, avps: _getAvps(searchlist)};
		createList.links = [];
		if (my) {
			createList.links.push({id: "searchlist_modify", text: nl.t('modify')});
			createList.links.push({id: "searchlist_delete", text: nl.t('delete')});
		}
		createList.links.push({id: 'details', text: nl.t('details')}); 
		return createList;
	}
	
	function  _getAvps(searchlist) {
		var avps = [];
        nl.fmt.addAvp(avps, 'Name', searchlist.name);
        nl.fmt.addAvp(avps, 'Author', searchlist.authorname);
		nl.fmt.addAvp(avps, 'Group', searchlist.grpname);
		nl.fmt.addAvp(avps, 'Updated by', searchlist.updated_by_name);
		nl.fmt.addAvp(avps, 'Created on', searchlist.created, 'date');
		nl.fmt.addAvp(avps, 'Updated on', searchlist.updated, 'date');
        nl.fmt.addAvp(avps, 'Result count', Object.keys(searchlist.result.result_dict).length);
        nl.fmt.addAvp(avps, 'Result updated on', searchlist.result.result_updated, 'date');
		return avps;
	}

	function _getStaticCards() {
		var ret = [];
        if(!my) return ret;
		var card = {title: nl.t('Create'), 
					icon: nl.url.resUrl('dashboard/crgroup.png'), 
					internalUrl: 'searchlist_create',
					help: nl.t('Click here to create custom search lists'), 
					children: [], style: 'nl-bg-blue'};
		card.links = [];
		ret.push(card);
		return ret;
	}

	function _getEmptyCard(nlCardsSrv) {
		var help = null;
			help = nl.t('There are no search lists created yet.');
	    return nlCardsSrv.getEmptyCard({help:help});
	}

	$scope.onCardInternalUrlClicked = function(internalUrl) {
		if (internalUrl === 'searchlist_create') {
			_createOrModifySearchlist($scope, null);
		}
    };

	$scope.onCardLinkClicked = function(card, linkid) {
		if (linkid === 'searchlist_modify') {
			_createOrModifySearchlist($scope, card.searchlistId);
		} else if (linkid === 'searchlist_delete') {
			_deleteSearchlist($scope, card.searchlistId);
		}
	};

	function _createOrModifySearchlist($scope, searchlistId) {
		var searchlistDlg = nlDlg.create($scope);
		searchlistDlg.setCssClass('nl-height-max nl-width-max');
        searchlistDlg.scope.error = {};
		if (searchlistId !== null) {
			var searchdata = searchDict[searchlistId];
			$scope.dlgTitle = nl.t('Modify search list');
			searchlistDlg.scope.data = {name: searchdata.name, 
									description: searchdata.description, config: angular.toJson(searchdata.config, 2)};
		} else {
			$scope.dlgTitle = nl.t('Create a new search list');
			searchlistDlg.scope.data = {name: '', 
									description: '', config: ''};
		}

		var buttons = [];
		var saveName = (searchlistId !== null) ? nl.t('Save') : nl.t('Create');
		var saveButton = {
			text : saveName,
			onTap : function(e) {
				_onSave(e, $scope, searchlistDlg, searchlistId);
			}
		};
		buttons.push(saveButton);
		var cancelButton = {
			text : nl.t('Cancel')
		};
		searchlistDlg.show('view_controllers/searchlist/searchlist_create_dlg.html',
			buttons, cancelButton, false);
	}
	function _onSave(e, $scope, searchlistDlg, searchlistId) {
	    if(!_validateInputs(searchlistDlg.scope)) {
	    	if(e) e.preventDefault();
	    	return;
	    }
		nlDlg.showLoadingScreen();
		var modifiedData = {
			name: searchlistDlg.scope.data.name, 
			description: searchlistDlg.scope.data.description,
			config: searchlistDlg.scope.data.config 
		};
		if(searchlistId !== null) modifiedData.id=searchlistId;
		var crModFn = (searchlistId !== null) ? nlServerApi.searchListModify : nlServerApi.searchListCreate;
		crModFn(modifiedData).then(function(searchlist) {
			_onModifyDone(searchlist, searchlistId, modifiedData, $scope);
		});
	}
	
	function _onModifyDone(searchlist, searchlistId, modifiedData, $scope) {
		nlDlg.hideLoadingScreen();
	    _updateForTesting(searchlist, modifiedData);
	    var card = _createSearchlistCard(searchlist);
	    if (searchlistId !== null) {
            var pos = _getCardPosition(searchlist.id);
            $scope.cards.cardlist.splice(pos, 1);
	    }
		$scope.cards.cardlist.splice(0, 0, card);			
	}

    function _validateInputs(scope) {
        scope.error = {};
        if(!scope.data.name) return _validateFail(scope, 'name', 'Search list name is mandatory');
        if(!scope.data.config) return _validateFail(scope, 'config', 'Search list config is mandatory');

        try {
            var config = angular.fromJson(scope.data.config);
            return _validateConfig(scope, config);            
        } catch (error) {
            return nlDlg.setFieldError(scope, 'config',
                nl.t('Error parsing JSON: {}. Try http://www.jsoneditoronline.org to debug more', error.toString()));
        }
        return true;
    }
    
    function _validateConfig(scope, config) {
        if (!angular.isObject(config) || angular.isArray(config)) return _validateFail(scope, 'config', 
            'Configuration needs to be a JSON object');
            
        if (!('table' in config)) return _validateFail(scope, 'config', 'table attribute missing');
        if (!('filter' in config)) return _validateFail(scope, 'config', 'filter attribute missing');
        if (!('report_fields' in config)) return _validateFail(scope, 'config', 'report_fields attribute missing');

        if (config.table != 'lesson_approved') return _validateFail(scope, 'config', 'table parameter value not supported');
        return true;
    }

    function _validateFail(scope, attr, errMsg) {
    	return nlDlg.setFieldError(scope, attr,
        	nl.t(errMsg));
    }

	function _getCardPosition(searchlistId) {
		for(var i in $scope.cards.cardlist) {
			var card = $scope.cards.cardlist[i];
			if(card.searchlistId === searchlistId) return i;
		}
		nl.log.error('Cannot find modified card', searchlistId);
		return 0;
	}
	var uniqueId = 100;

	function _updateForTesting(searchlist, modifiedData) {
		if (NL_SERVER_INFO.serverType !== 'local') return;
		if ('id' in modifiedData) {
			searchlist.id = modifiedData.id;
		} else {
			searchlist.id = uniqueId++;
		}
		searchlist.name  = modifiedData.name;
		searchlist.description  = modifiedData.description;
		if ('config' in modifiedData) searchlist.config  = angular.fromJson(modifiedData.config);
	    
	}

	function _deleteSearchlist($scope, searchlistId) {
		var msg = {title: 'Please confirm', 
				   template: 'Are you sure you want to delete? This cannot be undone.',
				   okText: nl.t('Delete')};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;
			nlDlg.showLoadingScreen();
			nlServerApi.searchListDelete(searchlistId).then(function(status) {
				nlDlg.hideLoadingScreen();
				if (searchlistId in searchDict) delete searchDict[searchlistId];
				for (var i in $scope.cards.cardlist) {
					var card = $scope.cards.cardlist[i];
					if (card.searchlistId !== searchlistId) continue;
					$scope.cards.cardlist.splice(i, 1);
				}
			});	
		});
	}

	function _initParams() {
		searchDict = {};
        var params = nl.location.search();
        my = ('my' in params) ? parseInt(params.my) == 1: false;
        _searchFilterInUrl = ('search' in params) ? params.search : '';
	}
}]; 

module_init();
})();
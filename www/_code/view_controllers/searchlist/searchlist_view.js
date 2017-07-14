(function() {

//-------------------------------------------------------------------------------------------------
// dashboard.js: custom dashboard
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.searchlist_view', [])
	.config(configFn)
	.controller('nl.SearchlistViewCtrl', SearchlistViewCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider',
function($stateProvider) {
	$stateProvider.state('app.searchlist_view', {
		cache : true,
		url : '^/searchlist_view',
		views : {
			'appContent' : {
				templateUrl : 'lib_ui/cards/cardsview.html',
				controller : 'nl.SearchlistViewCtrl'
			}
		}
	});

}];

var SearchlistViewCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlCardsSrv',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlCardsSrv) {
	var _max = null;
	var _searchlistId = 0;
	var _searchListObj = null;
	var _userInfo = null;

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		_initParams();
		return nl.q(function(resolve, reject) {
			nl.pginfo.pageTitle = nl.t('Search results');
	        var params = nl.location.search();
        	$scope.cards = {
                search: {onSearch: _onSearch, placeholder: nl.t('Enter name/description'), 
        	       icon: 'ion-information-circled'
        	    }
        	};
            nlCardsSrv.initCards($scope.cards);
			_getDataFromServer(false, resolve, reject);
		});
	}

	nlRouter.initContoller($scope, '', _onPageEnter);

	function _getDataFromServer(force, resolve, reject) {
		nlServerApi.searchListView(_searchlistId, force, _max).then(function(searchListObj) {
		    _searchListObj = searchListObj;
            var resultList = _getResultList(searchListObj);
            var repFields = searchListObj.config.report_fields;
            if (searchListObj.config.title) nl.pginfo.pageTitle = searchListObj.config.title;
            nlCardsSrv.updateCards($scope.cards, {
                cardlist: _getCards(_userInfo, resultList, repFields, nlCardsSrv)
            });
			resolve(true);
		}, function(reason) {
            resolve(false);
		});
	}
	
	function _getResultList(searchListObj) {
        var resultDict = searchListObj.result.result_dict;
	    var ret = [];
	    for (var d in resultDict) {
	        ret.push(resultDict[d]);
	    }
	    ret.sort(function(a, b) {
	        return nl.fmt.json2Date(b.updated) - nl.fmt.json2Date(a.updated);
	    });
	    return ret;
	}
	
    function _updateSearchDlgScope(scope) {
        scope.dlgTitle = nl.pginfo.pageTitle;
        scope.result_count = Object.keys(_searchListObj.result.result_dict).length;
        scope.result_updated = nl.fmt.jsonDate2Str(_searchListObj.result.result_updated);
    }

	function _onSearch(filter) {
        var searchlistDlg = nlDlg.create($scope);
        searchlistDlg.setCssClass('nl-height-max nl-width-max');
        _updateSearchDlgScope(searchlistDlg.scope);
        
        searchlistDlg.scope.updateResults = function() {
            searchlistDlg.close();
            nlDlg.showLoadingScreen();
            _getDataFromServer(false, function(result) {
                _onSearch(filter);
            });
        };

        searchlistDlg.show('view_controllers/searchlist/searchlist_view_dlg.html');
	}

    function _getCards(userInfo, resultList, repFields, nlCardsSrv) {
        var cards = [];
        for (var i = 0; i < resultList.length; i++) {
            var card = _createCard(resultList[i], repFields);
            cards.push(card);
        }
        return cards;
    }
    
	function _createCard(item, repFields) {
		var card = {
			searchlistId : item.id,
			title : item.name,
			url: nl.fmt2('/lesson/view/{}', item.id),
			icon : nl.url.lessonIconUrl(item.image),
			help : _getLessonDesc(item),
			children :[]
		};
		card.details = {help: item.description, avps: _getAvps(item, repFields)};
		card.links = [{id: 'details', text: nl.t('details')}];
		return card;
	}
	
    function _getLessonDesc(l) {
        var desc = nl.fmt2('<b>{}, {}</b>', l.grade, l.subject);
        desc += nl.fmt2('<p>by: {}</p>', l.authorname);
        if (l.ltype == 1) desc += '<b class="nl-green">Template</b>';
        desc += nl.fmt2('<p>{}</p>', l.description);
        return desc;
    }

	function  _getAvps(l, repFields) {
        var avps = [];
        nl.fmt.addAvp(avps, 'Name', l.name);
        nl.fmt.addAvp(avps, 'Author', l.authorname);
        for(var i=0; i<repFields.length; i++) {
            nl.fmt.addAvp(avps, repFields[i], l.repfields[repFields[i]]);
        }
        nl.fmt.addAvp(avps, 'Group', l.grpname);
        nl.fmt.addAvp(avps, 'Grade', l.grade);
        nl.fmt.addAvp(avps, 'Subject', l.subject);
        nl.fmt.addAvp(avps, 'Keywords', l.keywords);
        nl.fmt.addAvp(avps, 'Updated by', l.updated_by_name);
        nl.fmt.addAvp(avps, 'Created on', l.created, 'date');
        nl.fmt.addAvp(avps, 'Updated on', l.updated, 'date');
        nl.fmt.addAvp(avps, 'Is template', l.ltype == 1, 'boolean');
        nl.fmt.addAvp(avps, 'Approved by', l.approvername);
        nl.fmt.addAvp(avps, 'Approved on', l.approvedon, 'date');
        nl.fmt.addAvp(avps, 'Approved to', l.oulist, 'string', 'all classes/user groups');
        nl.fmt.addAvp(avps, 'Content type', l.custtype);
        return avps;
    }
    
	function _initParams() {
        var params = nl.location.search();
        _searchlistId = ('id' in params) ? parseInt(params.id) : 0;
        _max = ('max' in params) ? params.max : null;
	}
}]; 

module_init();
})();
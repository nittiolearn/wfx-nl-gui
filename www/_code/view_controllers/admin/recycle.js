(function() {

//-------------------------------------------------------------------------------------------------
// recycle.js:
// recycle bin module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.recycle', [])
	.config(configFn)
	.controller('nl.RecycleBinCtrl', RecycleBinCtrl);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.recyclebin', {
		url: '^/recyclebin',
		views: {
			'appContent': {
				templateUrl: 'lib_ui/cards/cardsview.html',
				controller: 'nl.RecycleBinCtrl'
			}
		}});
}];

var RecycleBinCtrl = ['nl', 'nlRouter', 'nlDlg', '$scope', 'nlCardsSrv', 
'nlServerApi', 'nlGroupInfo',
function(nl, nlRouter, nlDlg, $scope, nlCardsSrv, nlServerApi, nlGroupInfo) {
	var _params = {mine: true, restored: false};
    var _groupInfo = null;
    var _isAdmin = false;

	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
		    _isAdmin = nlRouter.isPermitted(userInfo, 'admin_user');
            var params = nl.location.search();
            _copyBoolIf(params, _params, 'mine');
            _copyIf(params, _params, 'entitytype');
            _copyIf(params, _params, 'actiontype');
            _copyBoolIf(params, _params, 'restored');
            if (!_isAdmin) _params.mine = true;

            $scope.cards = {search: {onSearch: _onSearch}};
            nlCardsSrv.initCards($scope.cards);
            nl.pginfo.pageTitle = nl.t('Archived items');
            nlGroupInfo.init().then(function() {
                _groupInfo = nlGroupInfo.get();
                _getDataFromServer(resolve);
            });

		});
	}
	
	nlRouter.initContoller($scope, '', _onPageEnter);

    $scope.onCardInternalUrlClicked = function(card, internalUrl) {
    	$scope.onCardLinkClicked(card, internalUrl);
    };

	$scope.onCardLinkClicked = function(card, linkid) {
		if (linkid === 'recyclebin_restore') {
			_restore(card);
        } else if (linkid === 'fetch_more') {
            _fetchMore();
		}
	};
	
    function _onSearch(filter) {
        var dlg = nlDlg.create($scope);
        dlg.scope.canFetchMore = _pageFetcher.canFetchMore();
        dlg.scope.error = {};
        dlg.scope.show = {entitytype: true, actiontype: true, restored: true, 
            mine: _isAdmin, name: true, entityid: _isAdmin};
        dlg.scope.options = _getFilterOptions();
        dlg.scope.data = angular.copy(_getCurrentFilters(dlg.scope.options));

        var okButton = {text : nl.t('Search'), onTap : function(e) {
            _currentFilters = dlg.scope.data;
            _getDataFromServer();
        }};
        var fetchMoreButton = {text : nl.t('Fetch more'), onTap : function(e) {
            _fetchMore();
        }};
        var closeButton = {text : nl.t('Cancel')};
        dlg.show('view_controllers/admin/recycle_filter_dlg.html', 
            [okButton, fetchMoreButton], closeButton);
    }
    
    function _getFilterOptions() {
        var opts = {
            entitytype: [
                {id: 'all', name: 'All items'},
                {id: 'lesson', name: 'Only modules'},
                {id: 'course', name: 'Only courses'},
                {id: 'course_assignment', name: 'Only course assignments'},
                {id: 'course_report', name: 'Only course reports'},
                {id: 'training', name: 'Only trainings'}],
            actiontype: [
                {id: 'all', name: 'All versions'},
                {id: 'deleted', name: 'Deleted versions only'},
                {id: 'versioned', name: 'Approved versions only'}],
            restored: [
                {id: 'all', name: 'Both restored and not yet restored items'},
                {id: 'not_restored', name: 'Items that are yet to be restored'},
                {id: 'restored', name: 'Items that were already restored'}],
            mine: [
                {id: 'all', name: 'Items archived by anyone'},
                {id: 'mine', name: 'Items archived by me'}],
        };
        return opts;
    }

    var _currentFilters = null;
    function _getCurrentFilters(opts) {
        if (_currentFilters) return _currentFilters;
        if (!opts) opts = _getFilterOptions();
        _currentFilters = {
            entitytype: {id: _params.entitytype || opts.entitytype[0].id},
            actiontype: {id: _params.actiontype || opts.actiontype[1].id},
            restored: {id: _params.restored === undefined ? 'all' : _params.restored ? 'restored' : 'not_restored'},
            mine: {id: _params.mine ? 'mine' : 'all'},
            name: '',
            entityid: ''
        };
        return _currentFilters;
    }

    function _getServerParams() {
        var filters = _getCurrentFilters();
        var serverParams = {};
        if (filters.entitytype && filters.entitytype.id != 'all')
            serverParams.entitytype = filters.entitytype.id;
        if (filters.actiontype && filters.actiontype.id != 'all')
            serverParams.actiontype = filters.actiontype.id;
        if (filters.restored && filters.restored.id != 'all')
            serverParams.restored = (filters.restored.id == 'restored');
        serverParams.mine = (!_isAdmin || !filters.mine || filters.mine.id != 'all');
        if (filters.name)
            serverParams.name = filters.name;
        if (filters.entityid)
            serverParams.entityid = parseInt(filters.entityid);
        return serverParams;
    }
    
    var _pageFetcher = nlServerApi.getPageFetcher();
    function _getDataFromServer(resolve, fetchMore) {
        if (!fetchMore) _cards = {};
        var params = _getServerParams();
        _pageFetcher.fetchPage(nlServerApi.recyclebinList, params, fetchMore, function(results) {
            if (!results) {
                if (resolve) resolve(false);
                return;
            }
            _updateCards(results);
            nlCardsSrv.updateCards($scope.cards, {
                canFetchMore: _pageFetcher.canFetchMore()
            });
            if (resolve) resolve(true);
        });
    }

    function _fetchMore() {
        _getDataFromServer(null, true);
    }

    var _cards = {};
	function _updateCards(lst) {
		for (var i=0; i<lst.length; i++) {
		    var user = _groupInfo.users[''+lst[i].user];
		    if (user) lst[i].username = nlGroupInfo.formatUserName(user);
            lst[i].created = nl.fmt.json2Date(lst[i].created);
            lst[i].updated = nl.fmt.json2Date(lst[i].updated);
			var card = _createCard(lst[i]);
			_cards[lst[i].id] = card;
		}
        var cards = [];
        for (var k in _cards) cards.push(_cards[k]);
        cards.sort(function(a, b) {
            return (b.created - a.created);
        });
        $scope.cards.cardlist = cards;
	}
	
	var _typeInfos = {
	    'lesson' : {name: 'Module', icon: 'ion-easel fblue'},
        'course' : {name: 'Course', icon: 'ion-ios-book fblue'},
        'course_assignment' : {name: 'Course assignment', icon: 'ion-paper-airplane fblue'},
        'course_report' : {name: 'Course report', icon: 'ion-pie-graph fblue'},
        'training' : {name: 'Training', icon: 'ion-calendar fblue'}
	};
	
	function _getTypeIcon(entitytype) {
        return entitytype in _typeInfos ? _typeInfos[entitytype].icon : 'ion-ios-undo fblue';
	}
	
    function _getTypeName(entitytype) {
        return entitytype in _typeInfos ? _typeInfos[entitytype].name : entitytype;
    }
    
	function _createCard(item) {
	    var actionType = item.actiontype == 'deleted' ? 'deleted' : 'archived';
	    var desc = nl.fmt2('<div><b>{} {} on:</b> {}</div>', 
	       _getTypeName(item.entitytype), actionType, nl.fmt.fmtDateDelta(item.created));
	    if (item.username) desc += nl.fmt2('<div>by {}</div>', item.username);
	    
	    var card = {id: item.id,
            updated: item.updated,
            created: item.created,
            title: item.name,
            username: item.username,
            internalUrl: 'recyclebin_restore',
            icon2: _getTypeIcon(item.entitytype),
			help: desc,
			children: []};

		card.details = {help: '', avps: _getAvps(item)};
		card.links = [];
		card.links.push({id: 'details', text: nl.t('details')});
		return card;
	}
	
	function  _getAvps(item) {
		var avps = [];
        nl.fmt.addAvp(avps, 'Name', item.name);
        nl.fmt.addAvp(avps, 'Type', _getTypeName(item.entitytype));
		nl.fmt.addAvp(avps, 'Archived on', item.created, 'date');
		if (item.username)
            nl.fmt.addAvp(avps, 'Archived by', item.username);
        nl.fmt.addAvp(avps, 'Remarks', item.desc);
        nl.fmt.addAvp(avps, 'Restored', item.restored, 'boolean');
        nl.fmt.addAvp(avps, 'Updated on', item.updated, 'date');
        nl.fmt.addAvp(avps, 'Entity id', item.entityid);
		return avps;
	}

    function _restore(card) {
        nlDlg.popupConfirm({title: 'Please confirm', 
            template: 'Are you sure you want restore this version?'})
        .then(function(confirm) {
            if (!confirm) return;
            nlDlg.showLoadingScreen();
            nlServerApi.recyclebinRestore(card.id).then(function(item) {
                _getDataFromServer();
                nlDlg.hideLoadingScreen();
                nlDlg.popupAlert({title: 'Done', template: 'Restored the version'});
            });
        });
    }

    function _copyIf(src, dest, attr) {
        if (!(attr in src)) return;
        dest[attr] = src[attr];
    }

    function _copyIntIf(src, dest, attr) {
        if (!(attr in src)) return;
        dest[attr] = parseInt(src[attr]);
    }

    function _copyBoolIf(src, dest, attr) {
        if (!(attr in src)) return;
        if (src[attr] == 'all') delete dest[attr];
        else dest[attr] = (src[attr] == 'true');
    }

}];

module_init();
})();

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

	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
            var params = nl.location.search();
            _copyBoolIf(params, _params, 'mine');
            _copyIf(params, _params, 'entitytype');
            _copyIf(params, _params, 'actiontype');
            _copyBoolIf(params, _params, 'restored');
            _copyIntIf(params, _params, 'max');
            _copyIntIf(params, _params, 'start_at');
            if (!nlRouter.isPermitted(userInfo, 'admin_user')) _params.mine = true;

            $scope.cards = {};
            $scope.cards.search = {placeholder: nl.t('Search')};
            nl.pginfo.pageTitle = nl.t('Recycle bin');

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
		}
	};
	
    function _getDataFromServer(resolve) {
        nlServerApi.recyclebinList(_params).then(function(lst) {
            _updateCards(lst);
            if (resolve) resolve(true);
        }, function(err) {
            if (resolve) resolve(false);
        });
    }

	function _updateCards(lst) {
		var cards = [];
		for (var i=0; i<lst.length; i++) {
		    var user = _groupInfo.users[''+lst[i].user];
		    if (user) lst[i].username = nlGroupInfo.formatUserName(user);
            lst[i].created = nl.fmt.json2Date(lst[i].created);
            lst[i].updated = nl.fmt.json2Date(lst[i].updated);
			var card = _createCard(lst[i]);
			cards.push(card);
		}
        cards.sort(function(a, b) {
            return (b.updated - a.updated);
        });
		$scope.cards.rebuildCache = true;
		$scope.cards.cardlist = cards;
	}
	
	function _createCard(item) {
	    var icon = '<i class=""></i>';
	    var desc = '<div><b>Archived on:</b></div>';
	    desc += '<div>{}</div>';
	    desc = nl.fmt2(desc, nl.fmt.fmtDateDelta(item.created));
	    if (item.username) desc += nl.fmt2('<div>by {}</div>', item.username);
	    
	    var card = {id: item.id,
            title: item.name,
            username: item.username,
            internalUrl: 'recyclebin_restore',
            icon2: 'ion-ios-undo fblue',
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
        nl.fmt.addAvp(avps, 'Type', item.entitytype);
		nl.fmt.addAvp(avps, 'Archived on', item.created, 'date');
		if (item.username)
            nl.fmt.addAvp(avps, 'Archived by', item.username);
        nl.fmt.addAvp(avps, 'Remarks', item.desc);
        nl.fmt.addAvp(avps, 'Restored', item.restored, 'boolean');
        nl.fmt.addAvp(avps, 'Updated on', item.updated, 'date');
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

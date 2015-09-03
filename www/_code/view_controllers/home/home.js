(function() {

//-------------------------------------------------------------------------------------------------
// dashboard.js:
// home dashboard
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.home', [])
    .config(configFn)
    .controller('nl.HomeCtrl', HomeCtrl)
    .controller('nl.DashboardViewCtrl', DashboardViewCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider',
function($stateProvider) {
    $stateProvider.state('app.home', {
        cache: true,
        url : '/home',
        views : {
            'appContent' : {
                templateUrl : 'lib_ui/cards/cardsview.html',
                controller : 'nl.HomeCtrl'
            }
        }
    });
    $stateProvider.state('app.dashboard_view', {
        cache: true,
        url : '/dashboard_view',
        views : {
            'appContent' : {
                templateUrl : 'lib_ui/cards/cardsview.html',
                controller : 'nl.DashboardViewCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var HomeCtrl = ['nl', 'nlRouter', '$scope', '$stateParams', 'nlServerApi', 'nlConfig', 'nlDlg',
function(nl, nlRouter, $scope, $stateParams, nlServerApi, nlConfig, nlDlg) {
    HomeCtrlImpl(true, nl, nlRouter, $scope, $stateParams, nlServerApi, nlConfig, nlDlg);
}];

var DashboardViewCtrl = ['nl', 'nlRouter', '$scope', '$stateParams', 'nlServerApi', 'nlConfig', 'nlDlg',
function(nl, nlRouter, $scope, $stateParams, nlServerApi, nlConfig, nlDlg) {
    HomeCtrlImpl(false, nl, nlRouter, $scope, $stateParams, nlServerApi, nlConfig, nlDlg);
}];

//-------------------------------------------------------------------------------------------------
function HomeCtrlImpl(isHome, nl, nlRouter, $scope, $stateParams, nlServerApi, nlConfig, nlDlg) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            var params = nl.location.search();
            var parent = ('parent' in params) ? params.parent : null;
            var dbid = ('dbid' in params) ? params.dbid : null;
            var published = (params.published == true);
            if (!isHome && dbid) {
                nlServerApi.dashboardGetCards(dbid, published).then(function(dashboardCards) {
                    nl.pginfo.pageTitle = nl.t('Custom Dashboard: {}', dashboardCards.description);
                    _initDashboardCards(userInfo, parent, dashboardCards.dashboard, resolve);
                });
            } else {
                nl.pginfo.pageTitle = nl.t('Home Dashboard');
                nl.pginfo.pageSubTitle = nl.fmt2('({})', userInfo.displayname);
                _initDashboardCards(userInfo, parent, userInfo.dashboard, resolve);
            }
        });
    }

    nlRouter.initContoller($scope, '', _onPageEnter);

    function _initDashboardCards(userInfo, parent, cardListFromServer, resolve) {
        $scope.cards = {};
        $scope.cards.cardlist = _getDashboardCards(userInfo, parent, cardListFromServer);
        _eulaWarning();
        resolve(true);
    }
    
    function _getDashboardCards(userInfo, parent, cardListFromServer) {
        var unauthorizedCards = parent ? [] : _getUnauthorizedCards(userInfo);
        var mainCards = _getChildCards(cardListFromServer, parent);
        var cards  = unauthorizedCards.concat(mainCards);
        _updateDetails(cards);
        return cards;
    }

    function _getUnauthorizedCards(userInfo) {
        var unauthorizedCards = [];
        if (userInfo.termAccess == 'none') {
            unauthorizedCards.push(
                {title: nl.t('Access not allowed'), icon: nl.url.resUrl('dashboard/warning.png'), url: '', 
                    help: nl.t('<p>Access is not allowed from this device.</p><p>You will only be able to access the help desk from this device.</p><p>If you think this device should not be restricted, please contact your administrator.</p>'), 
                    style: 'nl-bg-red', children: []});
        } else if (userInfo.termAccess == 'restricted') {
            unauthorizedCards.push(
                {title: nl.t('Restricted access'), icon: nl.url.resUrl('dashboard/warning.png'), url: '', 
                    help: nl.t('<p>You have only restricted access from this device.</p><p>You will only be able to access few of the features.</p><p>If you think this device should not be restricted, please contact your administrator.</p>'), 
                    style: 'nl-bg-red', children: []});
        }
        return unauthorizedCards;
    }
    
    function _getChildCards(dashboard, parent) {
        if (!parent) return dashboard;
        for (var i=0; i < dashboard.length; i++) {
            var card = dashboard[i];
            if (card.linkId == parent) return card.children;
        }
        return [];
    }

    function _updateDetails(cards) {
        for(var i=0; i<cards.length; i++) {
            var card = cards[i];
            _updatedUrl(card);
            var avps = [];
            for (var j=0; j<card.children.length; j++) {
            	var child = card.children[j];
	            _updatedUrl(child);
            	var avp = {attr:child.title, val:child.help, url:child.url};
            	avps.push(avp);
            }
            card.details = {help: card.help, avps: avps};
            card.links = [{id: 'details', text: nl.t('details')}];
        }
    }

    function _updatedUrl(card) {
        if (NL_SERVER_INFO.serverType == 'local' && card.url.indexOf('/nittioapp#') == 0) {
            card.url = card.url.substring(10);
        }
    }
    
    function _eulaWarning() {
        nlConfig.loadFromDb('EULA_INFO', function(eulaInfo) {
            if (eulaInfo == null) {
                userInfo = _defaultUserInfo();
            }
            _eulaWarningImpl(eulaInfo);
        });
    }
    
    function _eulaWarningImpl(eulaInfo) {
        var warningType = eulaInfo.eulaWarning;
        if (warningType == 'none') return;
        var title = (warningType == 'new') ? nl.t('Welcome') : nl.t('Terms of services is updated');
        
        nl.log.debug('_eulaWarningImpl: asking for confirmation');
        nlDlg.popupConfirm({title:title, templateUrl:'view_controllers/home/eula.html', 
                            okText: nl.t('Acknowledge'), cancelText: nl.t('Read Later')})
        .then(function(res) {
            if (!res) return;
            nlServerApi.authEulaAck().then(function () {
                nl.log.debug('_eulaWarningImpl: confirmed');
                nlDlg.popupStatus('Thanks for acknowledging');
                eulaInfo.eulaWarning = 'none';
                nlConfig.saveToDb('EULA_INFO', eulaInfo);
            });
        });
    }

};

module_init();
})();

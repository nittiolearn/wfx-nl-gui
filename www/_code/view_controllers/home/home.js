(function() {

//-------------------------------------------------------------------------------------------------
// home.js: home dashboard
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.home', [])
    .config(configFn)
    .controller('nl.HomeCtrl', HomeCtrl)
    .controller('nl.ErrorCtrl', ErrorCtrl)
    .controller('nl.AppHomeCtrl', AppHomeCtrl)
    .controller('nl.HomeRefreshCtrl', HomeRefreshCtrl)
    .controller('nl.DashboardViewCtrl', DashboardViewCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider',
function($stateProvider) {
    $stateProvider.state('app.home', {
        cache: true,
        url : '^/home',
        views : {
            'appContent' : {
                templateUrl : 'lib_ui/cards/cardsview.html',
                controller : 'nl.HomeCtrl'
            }
        }
    });
    $stateProvider.state('app.error', {
        cache: true,
        url : '^/error',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/home/error.html',
                controller : 'nl.ErrorCtrl'
            }
        }
    });
    $stateProvider.state('app.apphome', {
        cache: true,
        url : '^/apphome',
        views : {
            'appContent' : {
                template : '',
                controller : 'nl.AppHomeCtrl'
            }
        }
    });
    $stateProvider.state('app.home_refresh', {
        cache: true,
        url : '^/home_refresh',
        views : {
            'appContent' : {
                template : '',
                controller : 'nl.HomeRefreshCtrl'
            }
        }
    });
    $stateProvider.state('app.dashboard_view', {
        cache: true,
        url : '^/dashboard_view',
        views : {
            'appContent' : {
                templateUrl : 'lib_ui/cards/cardsview.html',
                controller : 'nl.DashboardViewCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var HomeCtrl = ['nl', 'nlRouter', '$scope', '$stateParams', 'nlServerApi', 'nlConfig', 'nlDlg', 'nlCardsSrv', 'nlAnnouncementSrv',
function(nl, nlRouter, $scope, $stateParams, nlServerApi, nlConfig, nlDlg, nlCardsSrv, nlAnnouncementSrv) {
    HomeCtrlImpl(true, nl, nlRouter, $scope, $stateParams, nlServerApi, nlConfig, nlDlg, nlCardsSrv, nlAnnouncementSrv);
}];

var DashboardViewCtrl = ['nl', 'nlRouter', '$scope', '$stateParams', 'nlServerApi', 'nlConfig', 'nlDlg', 'nlCardsSrv', 'nlAnnouncementSrv',
function(nl, nlRouter, $scope, $stateParams, nlServerApi, nlConfig, nlDlg, nlCardsSrv, nlAnnouncementSrv) {
    HomeCtrlImpl(false, nl, nlRouter, $scope, $stateParams, nlServerApi, nlConfig, nlDlg, nlCardsSrv, nlAnnouncementSrv);
}];

//-------------------------------------------------------------------------------------------------
function HomeCtrlImpl(isHome, nl, nlRouter, $scope, $stateParams, nlServerApi, nlConfig, nlDlg, nlCardsSrv, nlAnnouncementSrv) {

    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            var params = nl.location.search();
            var parent = ('parent' in params) ? params.parent : null;
            var dbid = ('dbid' in params) ? params.dbid : null;
            var published = (params.published == true);                
            nl.rootScope.showAnnouncement = !nl.rootScope.hideAnnouncement;
            $scope.pane = true;
            var data = nlAnnouncementSrv.getList();
            if(data) {
                nl.rootScope.announcementData = data;
            } else {
                nlAnnouncementSrv.show($scope).then(function(result) {
                    nl.rootScope.announcementData = $scope.announcementData;
                });
            }
            if (!isHome && dbid) {
                nlServerApi.dashboardGetCards(dbid, published).then(function(dashboardCards) {
                    nl.pginfo.pageTitle = nl.t('Custom Dashboard: {}', dashboardCards.description);
                    _initDashboardCards(userInfo, parent, dashboardCards.dashboard, resolve);
                    _initBgimg(dashboardCards);
                });
            } else {
                nl.pginfo.pageTitle = nl.t('Home Dashboard');
                nl.pginfo.pageSubTitle = nl.fmt2('({})', userInfo.displayname);
                _initDashboardCards(userInfo, parent, userInfo.dashboard, resolve);
                _initBgimg(userInfo);
            }
        });
    }

    nlRouter.initContoller($scope, '', _onPageEnter);

    function _initBgimg(data) {
        var bgimgs = (data.dashboard_props || {}).bgimgs;
        if (!bgimgs && data.groupinfo && data.groupinfo.bgimg)
            bgimgs = [data.groupinfo.bgimg];
        if (!bgimgs) return;
        var pos = Math.floor((Math.random() * bgimgs.length));
        nl.rootScope.pgBgimg = bgimgs[pos];
    }
    
    function _initDashboardCards(userInfo, parent, cardListFromServer, resolve) {
        $scope.cards = {
            staticlist: parent ? [] : _getUnauthorizedCards(userInfo),
            cardlist: _getDashboardCards(userInfo, parent, cardListFromServer)
        };
        nlCardsSrv.initCards($scope.cards);
        _eulaWarning();
        resolve(true);
    }

    function _getUnauthorizedCards(userInfo) {
        var unauthorizedCards = [];
        if (userInfo.termAccess == 'none') {
            unauthorizedCards.push(
                {title: nl.t('Access not allowed'), icon: nl.url.resUrl('dashboard/warning.png'), url: '', 
                    help: nl.t('<p>Access is not allowed from this device or IP address.</p>'), 
                    style: 'nl-bg-red', children: []});
        } else if (userInfo.termAccess == 'restricted') {
            unauthorizedCards.push(
                {title: nl.t('Restricted access'), icon: nl.url.resUrl('dashboard/warning.png'), url: '', 
                    help: nl.t('<p>You have only restricted access from this device or IP address.</p>'), 
                    style: 'nl-bg-red', children: []});
        }
        return unauthorizedCards;
    }
    
    function _getDashboardCards(userInfo, parent, cardListFromServer) {
        var cards = _getChildCards(cardListFromServer, parent);
        _updateDetails(cards);
        return cards;
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
            var avps = [];
            for (var j=0; j<card.children.length; j++) {
            	var child = card.children[j];
            	var avp = {attr:child.title, val:child.help, url:child.url};
            	avps.push(avp);
            }
            card.details = {help: card.help, avps: avps};
            card.links = [{id: 'details', text: nl.t('details')}];
        }
    }

    function _eulaWarning() {
        nlConfig.loadFromDb('EULA_INFO', function(eulaInfo) {
            if (eulaInfo == null) {
                userInfo = _defaultUserInfo();
            }
        });
    }    
};

//-------------------------------------------------------------------------------------------------
var ErrorCtrl = ['nl', 'nlRouter', '$scope',
function(nl, nlRouter, $scope) {
    nl.pginfo.isPageShown = true;
    nl.rootScope.bodyClass = 'showbody';
    var params = nl.location.search();
    $scope.msgType = params.msg || '';
}];
    
//-------------------------------------------------------------------------------------------------
var AppHomeCtrl = ['nl', 'nlRouter', '$scope',
function(nl, nlRouter, $scope) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            var next = nlRouter.isPermitted(userInfo, '/home') ?
                '/home' : '/login_now?nohome';
            nl.location.url(next);
            nl.location.replace();
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
}];
    
//-------------------------------------------------------------------------------------------------
var HomeRefreshCtrl = ['nl', 'nlRouter', '$scope', '$stateParams', 'nlServerApi', 'nlConfig', 'nlDlg',
function(nl, nlRouter, $scope, $stateParams, nlServerApi, nlConfig, nlDlg) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nlServerApi.clearCache().then(function(res) {
                nlDlg.popupStatus('Local cache cleared');
                nl.location.url('/home');
                nl.location.replace();
            });
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
}];

module_init();
})();

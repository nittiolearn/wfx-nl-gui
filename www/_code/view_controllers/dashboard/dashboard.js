(function() {

//-------------------------------------------------------------------------------------------------
// dashboard.js:
// home dashboard
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.dashboard', [])
    .config(configFn)
    .controller('nl.HomeCtrl', HomeCtrl);
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
}];

//-------------------------------------------------------------------------------------------------
var HomeCtrl = ['nl', 'nlRouter', '$scope', '$stateParams', 'nlServerApi', 'nlConfig', 'nlDlg',
function(nl, nlRouter, $scope, $stateParams, nlServerApi, nlConfig, nlDlg) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.log.debug('HomeCtrl:onPageEnter - enter');
            nl.pginfo.pageTitle = nl.t('Home Dashboard');
            nl.pginfo.pageSubTitle = nl.fmt2('({})', userInfo.displayname);
            $scope.cards = _getDashboardCards(userInfo);
            _eulaWarning();
            nl.log.debug('HomeCtrl:onPageEnter - done');
            resolve(true);
        });
    }

    nlRouter.initContoller($scope, '', _onPageEnter);

    function _getDashboardCards(userInfo) {
        var unauthorizedItems = [];
        if (userInfo.termAccess == 'none') {
            unauthorizedItems.push(
                {title: nl.t('Access not allowed'), icon: nl.url.resUrl('dashboard/warning.png'), url: '', 
                    help: nl.t('<p>Access is not allowed from this device.</p><p>You will only be able to access the help desk from this device.</p><p>If you think this device should not be restricted, please contact your administrator.</p>'), 
                    style: 'nl-bg-red', children: []});
        } else if (userInfo.termAccess == 'restricted') {
            unauthorizedItems.push(
                {title: nl.t('Restricted access'), icon: nl.url.resUrl('dashboard/warning.png'), url: '', 
                    help: nl.t('<p>You have only restricted access from this device.</p><p>You will only be able to access few of the features.</p><p>If you think this device should not be restricted, please contact your administrator.</p>'), 
                    style: 'nl-bg-red', children: []});
        }
        var cards  = unauthorizedItems.concat(userInfo.dashboard);
        var ret = {columnNames: [], cardlist: cards};
        _updateDetails(ret.cardlist);
        return ret;
    }

    function _updateDetails(cardlist) {
        for(var i=0; i<cardlist.length; i++) {
            var card = cardlist[i];
            card.details = {help: card.help, links: card.children, 
                            multiLineLinks: true, columnValues: []};
            card.links = [nl.t('details')];
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
        nlDlg.popupConfirm({title:title, templateUrl:'view_controllers/dashboard/eula.html', 
                            okText: nl.t('Acknowledge'), cancelText: nl.t('Read Later')})
        .then(function(res) {
            if (!res) return;
            nlServerApi.eulaAck().then(function () {
                nl.log.debug('_eulaWarningImpl: confirmed');
                nlDlg.popupStatus('Thanks for acknowledging');
                eulaInfo.eulaWarning = 'none';
                nlConfig.saveToDb('EULA_INFO', eulaInfo);
            });
        });
    }

}];

module_init();
})();

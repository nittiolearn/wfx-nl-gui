(function() {

//-------------------------------------------------------------------------------------------------
// temp.js:
// Temp module for experimentation
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.debug', [])
    .config(configFn)
    .controller('nl.DebugCtrl', DebugCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.debug', {
        url : '^/debug',
        views : {
            'appContent' : {
                templateUrl: 'lib_ui/cards/cardsview.html',
                controller : 'nl.DebugCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var DebugCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlLogViewer', 'nlServerApi',
function(nl, nlRouter, $scope, nlDlg, nlLogViewer, nlServerApi) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.log.debug('DebugCtrl:onPageEnter - enter');
            $scope.cards = _getCards();
            nl.log.debug('DebugCtrl:onPageEnter - done');
            resolve(true);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);

    function _getCards() {
        var cards = [];

        var card = {title: nl.t('View logs'), 
            icon: nl.url.resUrl('dashboard/alerts.png'), 
            internalUrl: 'debug_logviewer',
            help: nl.t('View logs, configure log levels'), 
            children: [], links: []};
        cards.push(card);

        return cards;
    }

    $scope.onCardInternalUrlClicked = function(internalUrl) {
        if (internalUrl === 'debug_logviewer') {
            nlLogViewer.show($scope);
        }
    };
}];


//-------------------------------------------------------------------------------------------------
module_init();
})();

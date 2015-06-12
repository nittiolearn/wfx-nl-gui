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
var HomeCtrl = ['nl', '$scope', '$stateParams', 'nlServerApi',
function(nl, $scope, $stateParams, nlServerApi) {
    nl.pginfo.pageTitle = nl.t('Home dashboard');
    $scope.cards = nlServerApi.getDashboardCards();

    $scope.onHold = function(event) {
        nl.log.debug('onHold');
        event.preventDefault();
        return false;
    };
    $scope.onTap = function(event) {
        nl.log.debug('onTap');
        event.preventDefault();
        return false;
    };
    $scope.onDoubleTap = function($event) {
        nl.log.debug('onDoubleTap');
        $event.preventDefault();
        return false;
    };
    $scope.onTouch = function($event) {
        nl.log.debug('onTouch');
        $event.preventDefault();
        return false;
    };
}];

module_init();
})();

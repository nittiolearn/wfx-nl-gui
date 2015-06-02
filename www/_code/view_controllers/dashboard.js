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
var HomeCtrl = ['nl', '$scope', '$rootScope', '$stateParams', 'nlServerApi',
function(nl, $scope, $rootScope, $stateParams, nlServerApi) {
    $rootScope.pageTitle = nl.t('Home dashboard');
    $scope.cards = nlServerApi.getDashboardCards();

    $scope.onHold = function(event) {
        console.log('onHold');
        event.preventDefault();
        return false;
    };
    $scope.onTap = function(event) {
        console.log('onTap');
        event.preventDefault();
        return false;
    };
    $scope.onDoubleTap = function($event) {
        console.log('onDoubleTap');
        $event.preventDefault();
        return false;
    };
    $scope.onTouch = function($event) {
        console.log('onTouch');
        $event.preventDefault();
        return false;
    };
}];

module_init();
})();

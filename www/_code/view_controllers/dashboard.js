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
}];

module_init();
})();

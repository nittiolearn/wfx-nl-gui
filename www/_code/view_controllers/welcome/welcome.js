(function() {

//-------------------------------------------------------------------------------------------------
// welcome.js: 
// Home page for an not-logged-in user
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.welcome', [])
    .config(configFn)
    .controller('nl.WelcomeCtrl', WelcomeCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.welcome', {
        url : '/welcome',
        views : {
            'appContent' : {
                templateUrl: 'view_controllers/welcome/welcome.html',
                controller : 'nl.WelcomeCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var WelcomeCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlLogViewer', 'nlServerApi', 'nlCardsSrv',
function(nl, nlRouter, $scope, nlDlg, nlLogViewer, nlServerApi, nlCardsSrv) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Teaching quality partner');
            nl.pginfo.pageSubTitle = '';
	        $scope.pageResUrl = nl.url.resUrl() + 'welcome';
            resolve(true);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
}];

module_init();
})();
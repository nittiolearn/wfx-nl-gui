(function() {

//-------------------------------------------------------------------------------------------------
// welcome.js: 
// Home page for an not-logged-in user
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.welcome', [])
    .config(configFn)
    .controller('nl.WelcomeCtrl', WelcomeCtrl)
    .directive('nlWelcomeDir', WelcomeDir);
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

var WelcomeDir = ['nl',
	function(nl) {
	    return function (scope, element) {
        var w = angular.element(nl.window);
        scope.getWindowDimensions = function () {
            return {
                'h': w[0].innerHeight,
                'w': w[0].innerWidth
            };
        };
        scope.$watch(scope.getWindowDimensions, function (newValue, oldValue) {
            scope.windowHeight = newValue.h;
            scope.windowWidth = newValue.w;

            scope.style = function () {
                return {
                	'position': 'relative',
                	'height': (100) + 'px',
					'width': scope.windowWidth + 'px',
					'margin-left':20 + 'px',
					'font-size': 1.25 + 'em'
                };
            };
            scope.style1 = function () {
                return {
                	'position': 'relative',
                	'height': (100) + 'px',
					'width': 500 + 'px',
					'margin-left':20 + 'px',
					'top': 5 + 'vh'
                };
            };
            scope.style2 = function () {
                return {
                	'position': 'relative',
                	'height': (100) + 'px',
					'width': 500 + 'px',
					'top': -15 + 'vh',
					'margin-left':20 + 'px',
                };
            };

        }, true);

        w.bind('resize', function () {
            scope.$apply();
        });
    };
}];

module_init();
})();
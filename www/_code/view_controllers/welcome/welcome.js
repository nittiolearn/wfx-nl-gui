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
        url : '^/welcome',
        views : {
            'appContent' : {
                templateUrl: 'view_controllers/welcome/welcome.html',
                controller : 'nl.WelcomeCtrl'
            }
        }
    });
    $stateProvider.state('app.business', {
        url : '^/business',
        views : {
            'appContent' : {
                templateUrl: 'view_controllers/welcome/business.html',
                controller : 'nl.WelcomeCtrl'
            }
        }
    });
    $stateProvider.state('app.school', {
        url : '^/school',
        views : {
            'appContent' : {
                templateUrl: 'view_controllers/welcome/school.html',
                controller : 'nl.WelcomeCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var WelcomeCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlLogViewer', 'nlServerApi', 'nlCardsSrv',
function(nl, nlRouter, $scope, nlDlg, nlLogViewer, nlServerApi, nlCardsSrv) {
    $scope.pageResUrl = nl.url.resUrl() + 'welcome';
    $scope.content = {
        title: nl.t('your teaching quality partner'),
        msg1: nl.t('Measure and improve the most important aspect of your school, the “Teaching quality”.'),
        msg2: nl.t('Structure all aspects of teaching. Set your goals, engage your teachers and leap ahead.')
    };
	function _onPageEnter(userInfo) {
	    nl.pginfo.hidemenu = true;
        return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = $scope.content.title;
            nl.pginfo.pageSubTitle = '';
            nlRouter.setWindowDescription('Looking to improve the teaching quality in your school? Use Nittio Learn for continuous teacher training, structured lesson planning, program of work tracking and classroom observations.');
            resolve(true);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
}];

module_init();
})();
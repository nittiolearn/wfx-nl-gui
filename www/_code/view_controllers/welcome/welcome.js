(function() {

//-------------------------------------------------------------------------------------------------
// welcome.js: 
// welcome static pages + controller and directives used across all static pages
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.welcome', [])
    .config(configFn)
    // Direcives used across all static pages
    .directive('nlSp', SpDirective)
    .directive('nlSpPage1', Page1Directive)
    .directive('nlSpFooter', FooterDirective)
    .directive('nlSpCopyright', CopyrightDirective)
    .service('nlAnchorScroll', AnchorScrollSrv)
    // Controller
    .controller('nl.WelcomeCtrl', WelcomeCtrl)
    .controller('nl.SchoolCtrl', SchoolCtrl)
    .controller('nl.BusinessCtrl', BusinessCtrl);
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
                controller : 'nl.BusinessCtrl'
            }
        }
    });
    $stateProvider.state('app.school', {
        url : '^/school',
        views : {
            'appContent' : {
                templateUrl: 'view_controllers/welcome/school.html',
                controller : 'nl.SchoolCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var SpDirective = [
function() {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/welcome/sp.html'
    };
}];

//-------------------------------------------------------------------------------------------------
var Page1Directive = [
function() {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/welcome/sp-page1.html'
    };
}];

//-------------------------------------------------------------------------------------------------
var FooterDirective = [
function() {
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/welcome/sp-footer.html'
    };
}];

//-------------------------------------------------------------------------------------------------
var CopyrightDirective = [
function() {
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/welcome/sp-copyright.html'
    };
}];

//-------------------------------------------------------------------------------------------------
var AnchorScrollSrv = ['nl', '$anchorScroll',
function(nl, $anchorScroll) {
    this.setAnchorHandler = function($scope) {
        $scope.gotoAnchor = function(anchor) {
            console.log('gotoAnchor', anchor);
            if (nl.location.hash() != anchor) {
                nl.location.hash(anchor);
            } else {
                $anchorScroll();
            }
        }
    }
}];

//-------------------------------------------------------------------------------------------------
var WelcomeCtrl = ['nl', 'nlRouter', '$scope', 'nlAnchorScroll', 
function(nl, nlRouter, $scope, nlAnchorScroll) {
    var welcomeConfig = {
        // Required in the controller
        title: nl.t('TODO-MUNNI: manage your trainings with ease'),
        desc: 'TODO-MUNNI: Manage your trainings with ease. Make learning sustained and effective.',
        pageUrl: null,
        bgImg: 'background.jpg',
        menus: [],
        
        // Required in the specific view template
        content: {
        }
    };
    _staticPageCtrl(welcomeConfig, nl, nlRouter, $scope, nlAnchorScroll);
}];

//-------------------------------------------------------------------------------------------------
var SchoolCtrl = ['nl', 'nlRouter', '$scope', 'nlAnchorScroll', 
function(nl, nlRouter, $scope, nlAnchorScroll) {
    var schoolConfig = {
        // Required in the controller
        title: nl.t('your teaching quality partner'),
        desc: 'Looking to improve the teaching quality in your school? Use Nittio Learn for continuous teacher training, structured lesson planning, program of work tracking and classroom observations.',
        pageUrl: 'school',
        bgImg: 'background.jpg',
        menus: [{name: 'Solutions', anchor: 'solutions'}, {name: 'Contact us', anchor: 'contact_us'}],
        
        // Required in the specific view template
        content: {
            msg1: nl.t('Measure and improve the most important aspect of your school, the “Teaching quality”.'),
            msg2: nl.t('Structure all aspects of teaching. Set your goals, engage your teachers and leap ahead.')
        }
    };
    _staticPageCtrl(schoolConfig, nl, nlRouter, $scope, nlAnchorScroll);
}];

//-------------------------------------------------------------------------------------------------
var BusinessCtrl = ['nl', 'nlRouter', '$scope', 'nlAnchorScroll', 
function(nl, nlRouter, $scope, nlAnchorScroll) {
    var businessConfig = {
        // Required in the controller
        title: nl.t('TODO-MUNNI: manage your trainings with ease'),
        desc: 'TODO-MUNNI: Manage your trainings with ease. Make learning sustained and effective.',
        pageUrl: 'business',
        bgImg: 'background.jpg',
        menus: [{name: 'Features', url: '/#/home'}, {name: 'Pricing', url: '/#/home'}, {name: 'Request a demo', url: '/#/home'}],
        
        // Required in the specific view template
        content: {
        }
    };
    _staticPageCtrl(businessConfig, nl, nlRouter, $scope, nlAnchorScroll);
}];

//-------------------------------------------------------------------------------------------------
function _staticPageCtrl(config, nl, nlRouter, $scope, nlAnchorScroll) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.pginfo.hidemenu = true;
            nl.pginfo.pageTitle = config.title;
            nl.pginfo.pageSubTitle = '';
            nlRouter.setWindowDescription(config.desc);
    
            $scope.baseResUrl = nl.url.resUrl() + 'welcome';
            $scope.pageResUrl = $scope.baseResUrl;
            if (config.pageUrl) $scope.pageResUrl += '/' + config.pageUrl;
            
            $scope.content = config.content;
            $scope.menus = config.menus;
            $scope.bgImg = config.bgImg ? $scope.pageResUrl + '/' + config.bgImg : null;
            
            resolve(true);
        });
    }
    nlAnchorScroll.setAnchorHandler($scope);
    nlRouter.initContoller($scope, '', _onPageEnter);
}

module_init();
})();
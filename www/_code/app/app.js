"use strict";

(function() {

//-------------------------------------------------------------------------------------------------
// Main application module with controllers for the layout and the home dashboard
//-------------------------------------------------------------------------------------------------
function module_init() {
    _patchToIonicRightClickIssue();
    
    var deps = ['ionic', 'nl.html_fragments', 'nl.utils', 'nl.remoteservices', 'nl.db'];
    deps = deps.concat(['nl.ui', 'nl.assign', 'nl.lesson']);
    deps = deps.concat(['nl.temp']);

    angular.module('nl.app', deps)
    .config(configFn)
    .controller('nl.AppCtrl', AppCtrl)
    .controller('nl.HomeCtrl', HomeCtrl)
    .run(['$ionicPlatform', function($ionicPlatform) {
        $ionicPlatform.ready(onIonicReady);
    }]);
}

//-------------------------------------------------------------------------------------------------
// Background:
// Ionic has a code to handle "mouseup" event (as part of scroll bar implementation) which does
// the same operation for both left and right mouse clicks. We need right click to be default
// (e.g. open a link in another tab). The event hadler below attaches infront of ionic and checks
// for right click and in that case does not pass the flow to ionic event handler.
function _patchToIonicRightClickIssue() {
    var d = angular.element(document);
    d.ready(function() {
        d.on('mouseup', _ignoreIfRightMouseUp);
    });
}
function _ignoreIfRightMouseUp(e) {
    if (e.which !== 3) return true;
    e.stopImmediatePropagation();
    e.preventDefault();
    return false;
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider', '$ionicConfigProvider',
function($stateProvider, $urlRouterProvider, $ionicConfigProvider) {
    
    $ionicConfigProvider.views.transition('ios');
    //$ionicConfigProvider.views.forwardCache(true);
    $ionicConfigProvider.views.maxCache(0);
    
    // if none of the above states are matched, use this as the fallback
    $urlRouterProvider.otherwise('/app/home');

    $stateProvider.state('app', {
        cache: true,
        url : "/app",
        templateUrl : "app/applayout.html",
        controller : 'nl.AppCtrl'
    });
    $stateProvider.state('app.home', {
        cache: true,
        url : "/home",
        views : {
            'appContent' : {
                templateUrl : "ui/cardsview.html",
                controller : 'nl.HomeCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
function onIonicReady() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins.Keyboard) {
        cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if (window.StatusBar) {
        // org.apache.cordova.statusbar required
        StatusBar.styleDefault();
    }
}

//-------------------------------------------------------------------------------------------------
var AppCtrl = ['nlLog', 'nlRes', '$scope', '$stateParams', '$location', 'nlPageNoSrv', 'nlKeyboardHandler', 
function(nlLog, nlRes, $scope, $stateParams, $location, nlPageNoSrv, nlKeyboardHandler) {
    $scope.logo = 'img/top-logo.png';
    $scope.title = 'Nittio Learn';
    $scope.subTitle = 'TODO 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 ';
    $scope.subTitle = '';
    $scope.pageNoData = nlPageNoSrv;
    $scope.pageNoData.totalPages = 1;
    $scope.pageNoData.currentPage = 1;

    $scope.isMenuShown = true;
    _updateMenuState(nlRes, $scope);

    $scope.onHomeClick = function() {
        $location.path('#');
    };

    $scope.onMenuClick = function() {
        $scope.isMenuShown = !($scope.isMenuShown);
        _updateMenuState(nlRes, $scope);
    };

    $scope.menuitems = [
        {img: nlRes.menuIcon('home.png'), alt:'home', title:'Home', handler: function() {
            $scope.onHomeClick();
        }}, {img: nlRes.menuIcon('help.png'), alt:'help', title:'Help', handler: function() {
            nlLog.debug('TODO: onHelpClick');
        }}, {img: nlRes.menuIcon('login.png'), alt:'login', title:'Login', handler: function() {
            nlLog.debug('TODO: onLoginClick');
        }}];
    
    $scope.onKeyDown = nlKeyboardHandler.onKeyDown;
    $scope.onSwipe = nlKeyboardHandler.onSwipe;
}];

function _updateMenuState(nlRes, $scope) {
    if ($scope.isMenuShown) {
        $scope.menuicon = nlRes.menuIcon('menuhide.png');
        $scope.menuicontext = 'Hide Menu';        
    } else {
        $scope.menuicon = nlRes.menuIcon('menushow.png');
        $scope.menuicontext = 'Show Menu';
    }
}

//-------------------------------------------------------------------------------------------------
var HomeCtrl = ['nlLog', 'nlRes', '$scope', '$stateParams', 'nlRemoteService',
function(nlLog, nlRes, $scope, $stateParams, nlRemoteService) {
    $scope.title = 'Nittio Learn';
    $scope.cards = nlRemoteService.getDashboardCards();

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

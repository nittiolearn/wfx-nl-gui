"use strict";

(function() {

//-------------------------------------------------------------------------------------------------
// app.js:
// Main application module with controllers for the overall layout
//-------------------------------------------------------------------------------------------------
function module_init() {
    _patchToIonicRightClickIssue();
    
    var deps = ['ionic', 'nl.html_fragments', 'nl.lib', 'nl.lib_ui', 'nl.server_api', 'nl.view_controllers'];
    angular.module('nl.app', deps)
    .config(configFn)
    .controller('nl.AppCtrl', AppCtrl)
    .run(['$ionicPlatform', function($ionicPlatform) {
        $ionicPlatform.ready(onIonicReady);
    }]);
}

//-------------------------------------------------------------------------------------------------
// Background:
// Ionic has a code to handle 'mouseup' event (as part of scroll bar implementation) which does
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
    if (!e || e.which !== 3) return true;
    e.stopImmediatePropagation();
    e.preventDefault();
    return false;
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider', '$ionicConfigProvider',
function($stateProvider, $urlRouterProvider, $ionicConfigProvider) {
    
    $ionicConfigProvider.views.transition('none');
    //$ionicConfigProvider.views.forwardCache(true);
    $ionicConfigProvider.views.maxCache(0);
    
    // backward compatiblity for '/app/..' URLs
    $urlRouterProvider.when(/^\/app\/.*/, ['nl', function (nl) {
        var loc = nl.location.url().substring(4);
        nl.location.url(loc);
        return true;
    }]);
    
    // if none of the above states are matched, use this as the fallback
    $urlRouterProvider.otherwise('/home');

    $stateProvider.state('app', {
        cache: true,
        url : '/app',
        templateUrl : 'applayout.html',
        controller : 'nl.AppCtrl'
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
var AppCtrl = ['nl', '$scope', 'nlKeyboardHandler', 'nlServerApi', 'nlRouter', 'nlLogViewer',
function(nl, $scope, nlKeyboardHandler, nlServerApi, nlRouter, nlLogViewer) {
    nl.log.info('UserAgent: ', navigator.userAgent);
    nl.rootScope.imgBasePath = nl.url.resUrl();
    nl.rootScope.pgInfo = nl.pginfo;
    nl.rootScope.pgBgimg = null;

    _initScreenSize(nl);
    nlLogViewer.showOnStartupIfRequired($scope);
    
    var homeUrl = '/#/home';
    var welcomeUrl = '/#/welcome';

    $scope.userMenuItems = [];
    $scope.helpMenuIcon = nl.url.resUrl('general/help.png');
    $scope.helpMenuTitle = nl.t('Help');
    $scope.homeMenuIcon = nl.url.resUrl('general/home.png');
    $scope.homeMenuTitle = nl.t('Home');
    $scope.userMenuIcon = nl.url.resUrl('user-login.png');
    $scope.logedIn = false;
    $scope.homeUrl = homeUrl;
    
    // Called from child scope on page enter
    $scope.onPageEnter = function(userInfo) {
        nl.log.debug('app:onPageEnter - enter');
        $scope.logo = userInfo.groupicon == '' ? nl.url.resUrl('general/top-logo1.png') : userInfo.groupicon;
        var bLoggedIn = (userInfo.username != '');
        $scope.userMenuItems = [];
        if (bLoggedIn) {
            $scope.logedIn = true;
            $scope.homeUrl = homeUrl;
            $scope.userMenuIcon = nl.url.resUrl('user.png');
            if (nlRouter.isPermitted(userInfo, 'change_password')) {
                $scope.userMenuItems.push({name: 'changepw', title: nl.t(' Change Password'), 
                    icon: nl.url.resUrl('general/login-pwdchange.png'),
                    url: '/auth/changepw'});
            }
            $scope.userMenuItems.push({name: 'logout', title: nl.t(' Sign Out'),
                icon: nl.url.resUrl('general/login-signout.png'),
                url: '#/logout_now'});
        } else {
            $scope.logedIn = false;
            $scope.homeUrl = welcomeUrl;
            $scope.userMenuIcon = nl.url.resUrl('user-login.png');
            $scope.userMenuItems.push({name: 'login', title: nl.t(' Sign In'), 
                icon: nl.url.resUrl('general/login-signin.png'),
                url: '#/login_now'});
            $scope.userMenuItems.push({name: 'pwlost', title: nl.t(' Sign Out'),
                icon: nl.url.resUrl('general/login-pwdlost.png'),
                url: '/auth/pwlost'});
        }
        nl.log.debug('app:onPageEnter - done');
    };
    
    $scope.showUserMenu = false;
    $scope.onUserMenu = function(e) {
        $scope.showUserMenu = !$scope.showUserMenu;
        if (e) e.stopImmediatePropagation();
        return false;
    };
    
    $scope.onCanvasClick = function(e) {
        $scope.showUserMenu = false;
    };

    $scope.onKeyDown = function(e) {
        if (!nlKeyboardHandler.ESC(e)) return;
        $scope.showUserMenu = false;
    };
    
}];

function _initScreenSize(nl) {
    angular.element(nl.window).bind('resize', function() {
        nl.rootScope.$apply(function() {
            _updateScreenSize(nl);
        });
    });
    _updateScreenSize(nl);
}

var W_SMALL = 700;
var W_LARGE = 1000;
function _updateScreenSize(nl) {
    var w = nl.window.innerWidth;
    var h = nl.window.innerHeight - 60;
    var hv = (w - 20)*9/16;
    if (h < hv) hv = h; 
    nl.rootScope.screenWidth = w;
    nl.rootScope.videoWidth = hv*16/9;
    if (w < W_SMALL) {
        nl.rootScope.screenSize = 'small';
        return;
    }
    if (w > W_LARGE) {
        nl.rootScope.screenSize = 'large';
        return;
    }
    nl.rootScope.screenSize = 'medium';
}

module_init();
})();

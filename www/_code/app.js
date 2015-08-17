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

var v = 
{
    "isBleedingEdge": true, 
    "allowedgroups": ["nittio", "demo", "interlaced"],
    "favourites": [
        {
            "type": "modify", "id": "favourites1", 
            "title": "Lesson 1", "desc": "Description of lesson 1", 
            "url" : "/lesson/view/5680613487017984", 
            "icon": "http://www.clker.com/cliparts/c/b/b/a/14395703001877181299images-th.png"
        }, 
        {
            "type": "new", "id": "favourites1_child", "parentid": "favourites1", 
            "desc": "Lesson 1", "title": "Description of lesson 1", 
            "url" : "/lesson/search"
        },
        {
            "type": "modify", "id": "favourites2", 
            "title": "Lesson 2", "desc": "Description of lesson 2", 
            "url" : "/lesson/search", 
            "icon": "http://www.clker.com/cliparts/C/d/4/c/d/Q/strandball-beachball-ball-surf-green-th.png"
        },
        {
            "type": "new", id": "favourites2_child", "parentid": "favourites2", 
            "desc": "Lesson 2", "title": "Description of lesson 2", 
            "url" : "/lesson/search"
        },
        {"type": "hide", "id": "wsheet"},
        {"type": "hide", "id": "assign_desk"}
    ]
}
;

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
    
    // if none of the above states are matched, use this as the fallback
    $urlRouterProvider.otherwise('/app/home');

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
    nlLogViewer.showOnStartupIfRequired($scope);
    
    var homeUrl = nl.url.getAppUrl() + '#/app/home';

    $scope.userMenuItems = [];
    $scope.helpMenuIcon = nl.url.resUrl('general/help.png');
    $scope.helpMenuTitle = nl.t('Help');
    $scope.homeMenuIcon = nl.url.resUrl('general/home.png');
    $scope.homeMenuTitle = nl.t('Home');
    $scope.userMenuIcon = nl.url.resUrl('general/top-login.png');
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
            $scope.userMenuIcon = nl.url.resUrl('general/top-logedin.png');
            if (nlRouter.isPermitted(userInfo, 'change_password')) {
                $scope.userMenuItems.push({name: 'changepw', title: nl.t(' Change Password'), 
                    icon: nl.url.resUrl('general/login-pwdchange.png'),
                    url: '/auth/changepw'});
            }
            $scope.userMenuItems.push({name: 'logout', title: nl.t(' Sign Out'),
                icon: nl.url.resUrl('general/login-signout.png'),
                url: '#/app/logout_now'});
        } else {
            $scope.logedIn = false;
            $scope.homeUrl = '/';
            $scope.userMenuIcon = nl.url.resUrl('general/top-login.png');
            $scope.userMenuItems.push({name: 'login', title: nl.t(' Sign In'), 
                icon: nl.url.resUrl('general/login-signin.png'),
                url: '#/app/login_now'});
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

module_init();
})();

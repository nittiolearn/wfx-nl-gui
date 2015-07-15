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
var AppCtrl = ['nl', '$scope', '$stateParams', '$location', 'nlDlg', 'nlKeyboardHandler', 'nlUserDlg',
function(nl, $scope, $stateParams, $location, nlDlg, nlKeyboardHandler, nlUserDlg) {
    nl.rootScope.imgBasePath = nl.url.resUrl();
    nl.rootScope.pgInfo = nl.pginfo;
    nl.rootScope.scrollInfo = nl.scrollinfo; // TODO-MUNNI - remove

    nl.rootScope.windowTitle = function() {
        var prefix = nl.t('Nittio Learn');
        if (nl.pginfo.pageTitle == '') return prefix;
        return prefix + ' - ' + nl.pginfo.pageTitle;
    };

    $scope.logo = nl.url.resUrl('general/top-logo1.png');
    $scope.helpMenuIcon = nl.url.resUrl('general/help.png');
    $scope.helpMenuTitle = nl.t('Help');
    $scope.homeMenuIcon = nl.url.resUrl('general/home.png');
    $scope.homeMenuTitle = nl.t('Home');
    $scope.userMenuIcon = nl.url.resUrl('general/top-logedin.png');
    $scope.userMenuTitle = nl.t('User: {}', ''); // TODO-MUNNI - user name

    $scope.onKeyDown = nlKeyboardHandler.onKeyDown;
    $scope.onSwipe = nlKeyboardHandler.onSwipe;
}];

module_init();
})();

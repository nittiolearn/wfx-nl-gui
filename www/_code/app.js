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

    nl.rootScope.windowTitle = function() {
        var prefix = nl.t('Nittio Learn');
        if (nl.pginfo.pageTitle == '') return prefix;
        return prefix + ' - ' + nl.pginfo.pageTitle;
    };

    $scope.getMenuItems = function() {
        return nl.menu.getMenuItems();
    };
    
    nl.menu.clearAppMenu();
    nl.menu.addAppMenuItem('Help', 'general/help.png', function() {
        nl.log.debug('TODO: onHelpClick');
    });
    nl.menu.addAppMenuItem('Login', 'general/top-logedin.png', function() {
        nlUserDlg.show($scope);
    });
    
    $scope.logo = nl.url.resUrl('general/top-logo1.png');

    _updateMenuState(nl, $scope);

    $scope.onHomeClick = function() {
        $location.path('#');
    };

    $scope.onMenuClick = function() {
        nl.pginfo.isMenuShown = !(nl.pginfo.isMenuShown);
        _updateMenuState(nl, $scope);
    };
    
    $scope.onKeyDown = nlKeyboardHandler.onKeyDown;
    $scope.onSwipe = nlKeyboardHandler.onSwipe;
}];

function _updateMenuState(nl, $scope) {
    if (nl.pginfo.isMenuShown) {
        $scope.menuicon = nl.url.resUrl('general/menuhide.png');
        $scope.menuicontext = 'Hide Menu';        
    } else {
        $scope.menuicon = nl.url.resUrl('general/menushow.png');
        $scope.menuicontext = 'Show Menu';
    }
}

module_init();
})();

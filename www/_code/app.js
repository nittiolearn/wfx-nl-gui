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
    .directive('nlBindContent', BindContentDirective)
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
'ChartJsProvider', '$sceDelegateProvider',
function($stateProvider, $urlRouterProvider, $ionicConfigProvider, 
ChartJsProvider, $sceDelegateProvider) {
    $sceDelegateProvider.resourceUrlWhitelist([
        'self', // Allow same origin resource loads.
        // Allow Nittio public resources (Only the 1st one works inside apps 
        // https/http mixed content)
        'https://storage.googleapis.com/resources.nittiolearn.com/**',
        'http://resources.nittiolearn.com/**'
    ]);
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
	_chartInfoInit(ChartJsProvider); 
}];

function _chartInfoInit(ChartJsProvider) {
    ChartJsProvider.setOptions({
      colours: ['#0000FF', '#FF8A80'],
      responsive: true,
      maintainAspectRatio: false,
      fullWidth: true
    });
    // Configure all line charts
    ChartJsProvider.setOptions('Line', {
      datasetFill: false
    });
}

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
var BindContentDirective= ['nl',
function(nl) {

    function _postLink($scope, iElem, iAttrs) {
        nl.rootScope.$watch($scope.nlBindContent, function(newVaue, oldValue) {
            iElem.attr('content', newVaue);
        });
    }
        
    return {
        restrict: 'A',
        scope: {
            nlBindContent: '@'
        },
        link: _postLink
    };
}];

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
    var welcomeUrl = '/#/welcome#home';

    $scope.userMenuItems = [];
    $scope.homeMenuTitle = nl.t('Home');
    $scope.logedIn = false;
    $scope.homeUrl = homeUrl;
    
    // Called from child scope on page enter
    $scope.onPageEnter = function(userInfo) {
        nl.log.debug('app:onPageEnter - enter');
        nl.rootScope.bodyClass = 'showbody';
        $scope.logo = userInfo.groupicon == '' ? nl.url.resUrl('general/top-logo2.png') : userInfo.groupicon;
        var bLoggedIn = (userInfo.username != '');
        $scope.userMenuItems = [];
        if (bLoggedIn) {
            $scope.logedIn = true;
            $scope.homeUrl = homeUrl;
            if (nlRouter.isPermitted(userInfo, 'change_password')) {
                $scope.userMenuItems.push({title: nl.t(' Change Password'), 
                    url: '/auth/changepw'});
            }
            $scope.userMenuItems.push({title: nl.t(' Sign Out'),
                url: '#/logout_now'});
        } else {
            $scope.logedIn = false;
            $scope.homeUrl = welcomeUrl;
            $scope.userMenuItems.push({title: nl.t(' Sign In'), 
                url: '#/login_now'});
            $scope.userMenuItems.push({title: nl.t(' Forgot Password'),
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
            _onResize(nl);
        });
    });
    _onResize(nl);
}

function _onResize(nl) {
    _updateScreenSize(nl);
    _updateResponsiveColClasses(nl);
    nl.resizeHandler.broadcast();
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

// Below variables may be used in ng-class for responsive adaptation of
// number of cols per row
var _respColNgClasses = {
    respCol442 : {large: 4, medium: 4, small: 2},
    respCol441 : {large: 4, medium: 4, small: 1},
    respCol431 : {large: 4, medium: 3, small: 1},
    respCol421 : {large: 4, medium: 2, small: 1},
    respCol331 : {large: 3, medium: 3, small: 1},
    respCol321 : {large: 3, medium: 2, small: 1},
    respCol221 : {large: 2, medium: 2, small: 1},
    respCol211 : {large: 2, medium: 1, small: 1},
    respCol111 : {large: 1, medium: 1, small: 1}
};

// % width per column
var _resp2ColNgClasses = {
    resp2Col33 : {large: 33, medium: 33, small: 1},
    resp2Col67 : {large: 67, medium: 67, small: 1},
    resp2Col20 : {large: 20, medium: 20, small: 1},
    resp2Col80 : {large: 80, medium: 80, small: 1},
};

// The resultant classes applied for a given class
var _respColClasses = {
    // For number of columns based systems
    1: 'w100',
    2: 'col col-50',
    3: 'col col-33',
    4: 'col col-25',
    // For percentage based systems
    20: 'col col-20',
    33: 'col col-33',
    67: 'col col-67',
    80: 'col col-80',
};

function _updateResponsiveColClasses(nl) {
    for (var ngClass in _respColNgClasses) {
        var nlClassData = _respColNgClasses[ngClass];
        var columns = nlClassData[nl.rootScope.screenSize];
        nl.rootScope[ngClass] = _respColClasses[columns];
    }
    for (var ngClass in _resp2ColNgClasses) {
        var nlClassData = _resp2ColNgClasses[ngClass];
        var columns = nlClassData[nl.rootScope.screenSize];
        nl.rootScope[ngClass] = _respColClasses[columns];
    }
}

module_init();
})();

"use strict";
//-------------------------------------------------------------------------------------------------
// app.js:
// Main application module with controllers for the overall layout.
// Also defines _nl which is set of global functions used everywhere.
//-------------------------------------------------------------------------------------------------
var _nl = {
    elemDirective: function(templateUrl, scope) {
        return [function() {
            var ret = {restrict: 'E', templateUrl: templateUrl};
            if (scope !== undefined) ret.scope = scope;
            return ret;
        }];
    },
    atypes: {
		ATYPE_MODULE: 0,
		ATYPE_SELF_MODULE: 1,
		ATYPE_COURSE: 2,
		ATYPE_SELF_COURSE: 3, // future
		ATYPE_TRAINING: 4 // Depricated and not used
	},
	ctypes: {
		CTYPE_MODULE: 0,
		CTYPE_COURSE: 2,
		CTYPE_TRAINING: 4 // Depricated and not used
    },
    colorsCodes: {
        done: '#2E8B57',          // $nlGreen1
        failed: '#CD5C5C',        // $nlRed
        started: '#3db773',       // nlGreen2
        pending: '#88929c',       // $nlOrange3
        waiting: '#A0A0C0',       // $nlGrey1
        delayed: '#88929c',       // $nlOrange1
        upcoming: '#4682B4',
        blue1: '#153673',         //$nlBlue1
        blue2: '#2461cc',         //$nlBlue2
        nllightred: '#F08080',     //$nllightred
        nllightblue:'#469EB4',     //$nllightblue
        nlmediumblue:'#468BB4',    //$nlmediumblue
        nldarkblue:'#4679B4',      //$nldarkblue
        nldarkerblue: '#4667B4',   //$nldarkerblue
    }
};

//-------------------------------------------------------------------------------------------------
(function() {

function module_init() {
    _patchToIonicRightClickIssue();
    
    var deps = ['ionic', 'nl.html_fragments', 'nl.external_lib', 'nl.lib', 'nl.lib_ui', 'nl.server_api', 
    	'nl.view_controllers', 'nl.nittiolesson'];
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
    if (!NL_SERVER_INFO.oldCode) $urlRouterProvider.otherwise('/home');

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
        colors: ['#0000FF', '#FF8A80'],
        responsive: true,
        maintainAspectRatio: false,
        hover: {mode: null},
        fullWidth: true
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
var AppCtrl = ['nl','nlDlg','nlServerApi', '$scope', '$anchorScroll', 'nlKeyboardHandler', 'nlAnnouncementSrv', 'nlRouter',
'nlLogViewer', 'nlOldCodeBridge', 'nlTopbarSrv', 'nlServerSideUserSettings', 'ChartJSSrv', 'nlResourceUploader', 'Upload', 'nlGroupInfo',
function(nl, nlDlg, nlServerApi, $scope, $anchorScroll, nlKeyboardHandler, nlAnnouncementSrv, nlRouter, nlLogViewer, 
    nlOldCodeBridge, nlTopbarSrv, nlServerSideUserSettings, ChartJSSrv, nlResourceUploader, Upload, nlGroupInfo) {
    nl.log.info('UserAgent: ', navigator.userAgent);
    if (NL_SERVER_INFO.oldCode) nlOldCodeBridge.expose();
    nl.rootScope.imgBasePath = nl.url.resUrl();
    nl.rootScope.pgInfo = nl.pginfo;
    nl.rootScope.pgBgimg = null;
    nl.rootScope.groupCustomClass = '';
    nl.rootScope.gotoAnchor = function(anchor) {
        if (anchor) nl.location.hash(anchor);
        $anchorScroll();
    };
    
    _initScreenSize(nl);
    
    var homeUrl = '/#/home';
    $scope.homeMenuTitle = nl.t('Home');
    $scope.logedIn = false;
    $scope.homeUrl = homeUrl; 
    
    // Called from child scope on page enter
    $scope.onPageEnter = function(userInfo) {
        nl.log.debug('app:onPageEnter - enter');       
        nl.rootScope.pgInfo.usericon = userInfo.usericon;
        nl.rootScope.currentPageURL=nl.location.url().split('#')[0];
        nl.rootScope.bodyClass = 'showbody';
        nlAnnouncementSrv.initAnnouncements(userInfo, $scope);
        $scope.logo = userInfo.groupicon == '' ? nl.url.resUrl('general/top-logo2.png') : userInfo.groupicon;
        var bLoggedIn = (userInfo.username != '');
        var topbarMenus = [];
        if (bLoggedIn) {
            $scope.logedIn = true;
            $scope.homeUrl = homeUrl;
            topbarMenus = _updateTopbarMenus(userInfo);
        }
        nlTopbarSrv.setCommonMenus(topbarMenus);
        nl.log.debug('app:onPageEnter - done');
    };
    
    $scope.onCanvasClick = function(e) {
        nl.resizeHandler.broadcast('ESC');
    };

    $scope.onKeyDown = function(e) {
        if (!nlKeyboardHandler.ESC(e)) return;
        nl.resizeHandler.broadcast('ESC');
    };
    
    function onThemeChange(userInfo, userCustomClass) {
        var settings = userInfo.settings || {};
        settings.userCustomClass = userCustomClass;
        nlDlg.popupStatus('Updating the theme ...', false);
        nlDlg.showLoadingScreen();
            nlServerApi.authUpdateSettings(settings).then(function(result) {
                nl.window.location.reload();
            }
        )
    }

    function _onFileOpened(dlgScope, resolve, reject) {
        if (!dlgScope.data.resource || !dlgScope.data.resource[0]) {
            return resolve(null);
        }
        var res = dlgScope.data.resource;
        var extn = nlResourceUploader.getValidExtension(res[0].resource, 'Image');
        var restype = nlResourceUploader.getRestypeFromExt(extn);   
        if(restype != 'Image') return _validateFail(dlgScope, 'name', 'Please select a image');      
        var fileInfo = {resource: res, restype: restype, extn: extn, name: ''};     
        _onUploadOrModify(fileInfo , resolve);
    }

    function _validateFail(scope, attr, errMsg) {
        return nlDlg.setFieldError(scope, attr, nl.t(errMsg));
    }

    function _onUploadOrModify(data, resolve) {
		var resourceList = data.resource;
        var resourceInfoDict = {shared: true, updateUserDatabase: true};
        var keyword = '';
        resourceInfoDict['insertfrom'] = '/';
	    if(resourceList.length == 0) {
	    	return;
		}
		nlResourceUploader.uploadInSequence(resourceList, keyword, 'high', null, resourceInfoDict, resolve)
		.then(function(resInfos) {
            nlServerApi.groupUpdateUserIcon(resInfos[0].url).then(function() {
                resolve(resInfos);
                nl.rootScope.pgInfo.usericon = resInfos[0].url
                nlDlg.popupStatus(false);
            });
        });       
	}


    function _updateTopbarMenus(userInfo) {
        var topbarMenus = [];
        if (nlRouter.isPermitted(userInfo, 'change_password')) {
            topbarMenus.push({
                id: 'pw_change',
                type: 'menu',
                icon: 'icon ion-ios-locked-outline',
                name: nl.t(' Change Password'), 
                url: '#/pw_change'
            });
        }
        if (nlServerSideUserSettings.canUpdateSettings(userInfo)) {
            topbarMenus.push({
                id: 'user_settings',
                type: 'menu',
                name: nl.t(' User Settings'),
                onClick: function() { nlServerSideUserSettings.updateSettings($scope, userInfo); }
            });
        }
        
        topbarMenus.push(nlLogViewer.getLogMenuItem($scope));
        var showUserProfile = ((userInfo.groupinfo || {}).features || {}).showUserProfile || false;
        if(showUserProfile) {
            topbarMenus.push({
                id: 'changeuserprofile',
                type: 'menu',
                icon: 'ion-android-person lnblue3',
                name: nl.t('Change profile picture'),
                theme:'',
                onClick: function() {
                        nl.q(function(resolve, reject) { 
                            var dlg = nlDlg.create($scope);
                            dlg.scope.data = {resource: null};
                            dlg.scope.error = {err:'Please select Image'};
                            var okButton = { text : nl.t('Continue'), onTap : function(e) {
                                _onFileOpened(dlg.scope, resolve, reject);
                            }};
                            var cancelButton = {text : nl.t('Cancel'), onTap : function() {
                                resolve(null);
                            }};
                            dlg.show('lib_ui/utils/image_upload.html', [okButton], cancelButton);             
                    })
                }
            });
        }
        topbarMenus.push({
            id: 'lighttheme',
            type: 'menu',
            icon: 'icon ion-ios-sunny-outline',
            name: nl.t('Light Theme'),
            theme: 'nllightmode',
            themeChange: userInfo.settings,
            onClick: function() {
                onThemeChange(userInfo, 'nllightmode');
            }
        });
        topbarMenus.push({
            id: 'darktheme',
            type: 'menu',
            icon: 'icon ion-ios-moon-outline',
            name: nl.t('Dark Theme'),
            themeChange: userInfo.settings,
            theme: 'nldarkmode',
            onClick: function() { 
                onThemeChange(userInfo, 'nldarkmode');
            }
        });
        topbarMenus.push({
            id: 'logout',
            type: 'menu',
            icon: 'icon ion-log-out',
            name: nl.t(' Sign Out'),
            url: '#/logout_now'
        });
        return topbarMenus;
    }
}];

function _initScreenSize(nl) {
    var ua = navigator.userAgent.toLowerCase();
    var isSafari = ua.indexOf('safari/') != -1 && ua.indexOf('chrome/') == -1;
    nl.rootScope.nlBrowserClasses = isSafari ? 'isSafari' : '';
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
    nl.rootScope.screenHeight = h;
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
    respCol632 : {large: 6, medium: 3, small: 2},
    respCol442 : {large: 4, medium: 4, small: 2},
    respCol441 : {large: 4, medium: 4, small: 1},
    respCol431 : {large: 4, medium: 3, small: 1},
    respCol422 : {large: 4, medium: 2, small: 2},
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

var _resp3ColNgClasses = {
    resp3Col20 : {large: 20, medium: 1, small: 1},
    resp3Col80 : {large: 80, medium: 1, small: 1},
}

// The resultant classes applied for a given class
var _respColClasses = {
    // For number of columns based systems
    1: 'w100',
    2: 'col col-50',
    3: 'col col-33',
    4: 'col col-25',
    6: 'col col-16-6',
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
    for (var ngClass in _resp3ColNgClasses) {
        var nlClassData = _resp3ColNgClasses[ngClass];
        var columns = nlClassData[nl.rootScope.screenSize];
        nl.rootScope[ngClass] = _respColClasses[columns];
    }

}

//-------------------------------------------------------------------------------------------------
module_init();
})();

(function() {

//-------------------------------------------------------------------------------------------------
// router.js: 
// Page router: contains the standard stuff done when the url of single page app changes
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.router', [])
    .service('nlRouter', NlRouter);
}

function UrlString(location) {
    this.init = function() {
        this.url = location.url().split('#')[0];
        this.path = location.path();
        this.search = location.search();
    };
    
    this.isSamePathAndDifferentSearch = function(rhs) {
        return (this.path == rhs.path) && (this.url != rhs.url);
    };

    this.init();
}

var NlRouter = ['nl', 'nlDlg', 'nlServerApi', 'nlMarkup', '$state', 'nlTopbarSrv', 'nlMobileConnector', 'nlGroupInfo', 'ChartJSSrv',
function(nl, nlDlg, nlServerApi, nlMarkup, $state, nlTopbarSrv, nlMobileConnector, nlGroupInfo, ChartJSSrv) {
    var permission = new Permission(nl);
    var defaultFn = function() {return function(resolve, reject) {resolve(true);};};

    // Backward compatibility to old URLs with nittioapp!    
    if (nl.window.location.pathname.indexOf('/nittioapp') == 0) {
        nl.window.location.href = '/#' + nl.location.url();
        return;
    }

    nlMobileConnector.onNavigateToLrMsgFromNittioMobile(function(data) {
        var template = nl.fmt2('<div class="padding-mid fsh6">{}</div>' +
            '<div class="padding-mid">{}</div>' +
            '<div class="padding-mid"></div>' +
            '<div class="padding-mid">Would you like to go to this assignment now?</div>',
            data.notif_title, data.notif_body);
        nlDlg.popupConfirm({title: 'Notification', template: template, 
            okText: 'Yes', cancelText: 'No'}).then(function(result) {
            if (!result) return;
            var ctype = parseInt(data.ctype);
            var repid = parseInt(data.repid);
            if (ctype == _nl.ctypes.CTYPE_MODULE) {
                var url = nl.fmt2('/lesson/do_report_assign/{}', repid);
            } else {
                var url = nl.fmt2('/#/course_view?mode=do&id={}', repid);
            }
            nl.window.location.href = url;
        });
    });
    
    var preservedSearchParams = null;
    this.initContoller = function($scope, pageUrl, pageEnterFn, pageLeaveFn) {
        if (preservedSearchParams) {
            nl.location.search(preservedSearchParams);
            preservedSearchParams = null;
        }
        var myUrlStr = new UrlString(nl.location);
        nl.log.debug('on initController: ', myUrlStr);
        
        if (pageEnterFn === undefined) pageEnterFn = defaultFn;
        $scope.$on('$ionicView.beforeEnter', function(e) {
            nl.log.debug('nlRouter: onPageEnter: ', myUrlStr.url);
            _onPageEnter($scope, pageUrl, pageEnterFn, e);
        });
        $scope.$on('$locationChangeStart', function(e) {
            var newUrlStr = new UrlString(nl.location);
            nl.log.debug('nlRouter: onPageLeave (locationChangeStart): ', myUrlStr.url, newUrlStr.url);
            _onPageLeave($scope, pageUrl, pageLeaveFn, e);
            if (newUrlStr.isSamePathAndDifferentSearch(myUrlStr)) {
                nl.log.debug('nlRouter: reloading page: ', myUrlStr.url, newUrlStr.url, newUrlStr.search);
                preservedSearchParams = newUrlStr.search;
                $state.go($state.current, {}, {reload: true}); // reload controllers
            }
        });
    };

    this.isPermitted = function(userInfo, taskName) {
        var perm = permission.getPermObj(taskName);
        if (perm == null) return false;
        if (!permission.checkLogin(userInfo, perm)) return false;
        return permission.isPermitted(userInfo, perm);
    };
    
    var windowDescription = '';
    this.setWindowDescription = function(descr) {
        windowDescription = descr;
    };
    
    this.updateBodyClass = function(cls, bAdd) {
        var classes = nl.rootScope.bodyClass || '';
        var classes = classes.split(' ');
        var newClasses = [];
        var addClsToEnd = bAdd;
        for(var i=0; i<classes.length; i++) {
            if (!classes[i]) continue;
            if (classes[i] == cls && !bAdd) continue;
            if (classes[i] == cls && bAdd) addClsToEnd = false;
            newClasses.push(classes[i]);
        }
        if (addClsToEnd) newClasses.push(cls);
        nl.rootScope.bodyClass = newClasses.join(' ');
    };

    this.sendGoogleAnalytics = function(userInfo, reqtype) {
        _sendGoogleAnalytics(userInfo, reqtype);
    };
    
    function _onPageEnter($scope, pageUrl, pageEnterFn, e) {
        windowDescription = '';
        nl.pginfo.isPageShown = false;
        nl.pginfo.isPrintable = false;
        nl.pginfo.hidemenu = false;
        nlServerApi.noPopup(false);
        nlDlg.popdownStatus();
        nlDlg.showLoadingScreen();
        var protocol = nl.location.protocol().toLowerCase();
        if (protocol.indexOf('file') >= 0) {
            nlDlg.hideLoadingScreen();
            return; // Empty page
        }
        _getUserInfo(pageUrl, function(userInfo) {
            _sendGoogleAnalytics(userInfo);
            nl.rootScope.pgBgimg = null;
            nl.rootScope.groupCustomClass = '';
            nl.pginfo.username = (userInfo.username == '') ? '' : userInfo.displayname;
            nlMarkup.setGid((userInfo.username == '') ? 0 : userInfo.groupinfo.id);
            nl.pginfo.groupCustomCss = userInfo.groupinfo && userInfo.groupinfo.groupCustomCss
                ? userInfo.groupinfo.groupCustomCss : '';
            var pagePerm = permission.getPermObj(pageUrl);
            nl.pginfo.groupCustomCss = userInfo.groupinfo && userInfo.groupinfo.groupCustomCss
            var groupCustomClass = (userInfo.settings || {}).userCustomClass
                            || (userInfo.groupinfo || {}).groupCustomClass || '';

            if (groupCustomClass) 
                nl.rootScope.groupCustomClass = groupCustomClass;
                    
            if (userInfo.groupinfo) {
                userInfo.groupinfo.groupCustomClass = nl.rootScope.groupCustomClass;
                if (userInfo.groupinfo.groupCustomClass == 'nldarkmode') 
                {
                    _nl.colorsCodes = Object.assign(_nl.darkcolorsCodes);
                    _initChartsForDarkMode();
                }
                else {
                    _nl.colorsCodes = Object.assign(_nl.tempcolorcode);
                    _initChartsForLightMode();
                }
            }
            function _initChartsForDarkMode() {
                var ChartJSProvider = ChartJSSrv.getChartJSProvider();
                ChartJSProvider.setOptions('bar',{
                    labels:[],
                    scales: {
                        xAxes: [{
                                gridLines: {
                                        display: true ,
                                        color: "#FFFFFF"
                                },
                                ticks: {
                                fontColor: "#FFFFFF",
                                }
                        }],
                        yAxes: [{
                            gridLines: {
                                display: true ,
                                color: "#FFFFFF"
                                },
                            ticks: {
                                fontColor: "#FFFFFF",
                            }
                        }],
                    }
                }); 
                ChartJSProvider.setOptions('line',{  
                    showLines: true,
                    spanGaps: false,
                
                    scales: {
                        xAxes: [{
                            type: 'category',
                            id: 'x-axis-0',
                            ticks: {
                                fontColor: "#FFFFFF",
                                beginAtZero:true,
                            }
                        }],
                        yAxes: [{
                            type: 'linear',
                            id: 'y-axis-0',
                            ticks: {
                                fontColor: "#FFFFFF",
                                beginAtZero:true,
                            }
                        }]
                    }
                })
            }
            function _initChartsForLightMode() {
                var ChartJSProvider = ChartJSSrv.getChartJSProvider();
                ChartJSProvider.setOptions('bar',{
                    labels:[],
                    scales: {
                        xAxes: [{
                            gridLines: {
                                display: true,
                                fontColor: '#000000',
                            },
                            ticks: {
                                beginAtZero:true,
                                fontColor: '#000000',
                            }
                        }],
                        yAxes: [{
                            gridLines: {
                                display: true
                                },
                            ticks: {
                                beginAtZero:true
                            }
                        }],
                    }
                });
            }
            
            if (pagePerm == null) {
                nlDlg.popupStatus(nl.t('Cannot access the page'));
                return _done('/home');
            }
            if (!permission.checkLogin(userInfo, pagePerm)) {
                if (nl.location.url() == '/home')  {
                    nl.window.location.reload();
                    return true;
                }
                nlDlg.popupStatus(nl.t('Please login to access this page'));
                var nextUrl = nl.window.encodeURIComponent('/#' + nl.location.url());
                return _done(nl.fmt2('/login_now?msg=auth_error&next={}', nextUrl));
            }

            if (!permission.isPermitted(userInfo, pagePerm)) {
                nlDlg.popupStatus(nl.t('You are not authorized to access this page'));
                return _done('/home');
            }
            if (userInfo.groupinfo && ('features' in userInfo.groupinfo) && userInfo.groupinfo.features['mobile']) {
                var mobileFeature = userInfo.groupinfo.features['mobile'] || {};
                if(mobileFeature['disable_screen_capture']) {
                    nlMobileConnector.disableScreenshot();
                } else {
                    nlMobileConnector.enableScreenshot();
                }
            } else if(userInfo.groupinfo && ('features' in userInfo.groupinfo)) {
                nlMobileConnector.enableScreenshot();
            }
            nlGroupInfo.onPageEnter(userInfo);
            if ('onPageEnter' in $scope.$parent) $scope.$parent.onPageEnter(userInfo);
            pageEnterFn(userInfo, e).then(function(status) {
                if (status) return _done(null);
                _done('/home');
            });
        }, function(errorData) {
            if (errorData && errorData.extendedStatusCode && 
                errorData.extendedStatusCode.indexOf('LOGIN') == 0) {
                return _done('/login_now?msg=logout');
            } else {
                return _done('/error?msg=network');
            }
        });
    }

    this.discoverNlContainer = function() {
        var win = nl.window;
        for(var tries=0; tries<10; tries++) {
            win = win.parent;
            if (win == null) return null;
            if (win.NITTIO_LEARN_CONTAINER) return win.NITTIO_LEARN_CONTAINER;
            if (win.parent == win) return null;
        }
        return null;
    };

    function _onPageLeave($scope, pageUrl, pageLeaveFn, e) {
        var canLeave = pageLeaveFn ? pageLeaveFn(e) : true;
        if (!canLeave) {
            e.preventDefault();
            return;
        }
        //nl.pginfo.isPageShown = false;
        //nl.pginfo.pageSubTitle = '';
        nlDlg.closeAll();
    }
    
    function _getUserInfo(pageUrl, resolve, reject) {
        var promise = permission.isOpenPage(pageUrl) ? nlServerApi.getUserInfoFromCache()
            : nlServerApi.getUserInfoFromCacheOrServer();
        promise.then(function(userInfo) {
            nlMobileConnector.initAppVersion(userInfo);
            _informAppUpdateIfNeeded(userInfo, pageUrl, resolve);
        }, reject);
    }
    
    function _done(rerouteToUrl) {
        var params = nl.location.search();
        nlTopbarSrv.showTopbar(!('embedded' in params || 'hidemenu' in params || nl.pginfo.hidemenu));
        nlDlg.hideLoadingScreen();

        if (rerouteToUrl != null) {
            nl.location.url(rerouteToUrl);
        }
        
        nlMobileConnector.exitFromAppMessageIfRequired();
        nl.pginfo.isPageShown = true;
        nl.pginfo.windowTitle = _getWindowTitle();
        nl.pginfo.windowDescription = windowDescription ? windowDescription : nl.pginfo.windowTitle;
        return true;
    }

    function _informAppUpdateIfNeeded(userInfo, pageUrl, resolve) {
        if (!permission.isUpdateCheckPage(pageUrl)) return resolve(userInfo);
        var grpInfo = userInfo.groupinfo || {};
        var notifyBy = grpInfo.notifyBy || []; 
        var bAppNotification = _appNotificationEnaled(notifyBy)
        var bScreenCaptureDisable = ((grpInfo.features || {}).mobile || {}).disable_screen_capture;
        nlMobileConnector.showAppUpdateMessageIfNeeded(bAppNotification, bScreenCaptureDisable);
        resolve(userInfo);
    }

    function _appNotificationEnaled(notifyBy) {
        for (var i=0; i<notifyBy.length; i++)
            if (notifyBy[i] == 'app') return true;
        return false;
    }
    
    function _sendGoogleAnalytics(userInfo, reqtype) {
        var userid = userInfo.nittioImpersonatedBy || userInfo.username || 'none';
        var useridParts = userid.split('.');
        var groupid = useridParts.length > 1 ? useridParts[1] : 'none';
        var usertype = userInfo.usertype || 'none';
        if (userInfo.nittioImpersonatedBy) usertype = 'none';

        var urlParts = nl.location.path().split('/');
        if (!reqtype) {
            reqtype = '/';
            if (urlParts.length > 1) reqtype += urlParts[1];
            if (urlParts.length > 2) reqtype += '/' + urlParts[2];
        }
        
        ga('set', 'dimension1', userid);
        ga('set', 'dimension2', groupid);
        ga('set', 'dimension4', usertype);
        ga('set', 'dimension3', reqtype);
        ga('send', 'pageview');
        nl.log.debug('ga sent: ', userid, groupid, usertype, reqtype);
    }
    
    function _getWindowTitle() {
        var prefix = nl.t('Nittio Learn');
        if (nl.pginfo.pageTitle == '') return prefix;
        return prefix + ' - ' + nl.pginfo.pageTitle;
    }

}];

function Permission(nl) {
    
    // Terminal Restriction Values: is the page accessible from unauthorized terminal?
    var TR_CLOSED = 0;      // Only users with 'access_anywhere' = 'Full' can access the page
    var TR_RESTRICTED = 1;  // Users with 'access_anywhere' = 'Restricted' or 'Full' can access the page
    var TR_OPEN = 2;        // All users can access the page

    var permissions = {
        // Page permissions
        '/home': {login: true, permission: 'basic_access', termRestriction: TR_OPEN}, 
        '/error': {login: false, permission: '', termRestriction: TR_OPEN}, 
        '/home_refresh': {login: false, permission: '', termRestriction: TR_OPEN},
        '/school': {login: false, permission: '', termRestriction: TR_OPEN}, 
        '/team': {login: false, permission: '', termRestriction: TR_OPEN}, 
        '/apphome': {login: false, permission: '', termRestriction: TR_OPEN}, 
        '/login_now': {login: false, permission: '', termRestriction: TR_OPEN}, 
        '/logout_now': {login: false, permission: '', termRestriction: TR_OPEN},
        '/audit': {login: true, permission: 'admin_user', termRestriction: TR_CLOSED},
        '/pw_change': {login: true, permission: 'change_password', termRestriction: TR_OPEN},
        '/pw_reset': {login: false, permission: '', termRestriction: TR_OPEN},
        '/impersonate': {login: true, permission: 'admin_impersonate_grp', termRestriction: TR_CLOSED},
        '/debug': {login: true, permission: 'nittio_support', termRestriction: TR_CLOSED},
        '/debugtemp': {login: true, permission: 'nittio_support', termRestriction: TR_CLOSED},
        '/nittio_mobile_sim': {login: true, permission: 'nittio_support', termRestriction: TR_CLOSED},
        '/forum': {login: true, permission: 'basic_access', termRestriction: TR_RESTRICTED},
        '/course_list': {login: true, permission: 'assignment_send', termRestriction: TR_CLOSED},
        '/folder_view': {login: true, permission: 'assignment_send', termRestriction: TR_CLOSED},
        '/course_assign_my_list': {login: true, permission: 'assignment_send', termRestriction: TR_CLOSED},
        '/course_assign_suborg_list': {login: true, permission: 'assignment_send', termRestriction: TR_CLOSED},
        '/course_assign_list': {login: true, permission: 'assignment_manage', termRestriction: TR_CLOSED},
		'/course_report_list': {login:true, permission: 'course_do', termRestriction: TR_RESTRICTED},
        '/course_view': {login: true, permission: 'course_do', termRestriction: TR_RESTRICTED},
        '/course_cert': {login: true, permission: 'course_do', termRestriction: TR_RESTRICTED},
        '/course_charts': {login: true, permission: 'assignment_manage', termRestriction: TR_CLOSED},
        '/learning_reports': {login: true, permission: 'assignment_send', termRestriction: TR_CLOSED},
        '/learning_reports_completed_modules': {login: true, permission: 'assignment_manage', termRestriction: TR_CLOSED},
        '/lr_import': {login: true, permission: 'nittio_support', termRestriction: TR_CLOSED},
        '/dashboard': {login: true, permission: 'nittio_support', termRestriction: TR_CLOSED},
        '/dashboard_view': {login: true, permission: 'nittio_support', termRestriction: TR_CLOSED},
        '/searchlist': {login: true, permission: 'nittio_support', termRestriction: TR_CLOSED},
        '/searchlist_view': {login: true, permission: 'basic_access', termRestriction: TR_CLOSED},
        '/sco_export': {login: true, permission: 'sco_export', termRestriction: TR_CLOSED},
        '/offline_export': {login: true, permission: 'sco_export', termRestriction: TR_CLOSED},
        '/sco_import_list': {login: true, permission: 'lesson_approve', termRestriction: TR_CLOSED},
		'/assignment': {login: true, permission: 'basic_access', termRestriction: TR_RESTRICTED},		
        '/assignment_send': {login: true, permission: 'assignment_send', termRestriction: TR_CLOSED},       
        '/lesson_list': {login: true, permission: 'basic_access', termRestriction: TR_OPEN},        
        '/lesson_translate': {login: true, permission: 'lesson_create', termRestriction: TR_CLOSED},        
        '/lesson_import': {login: true, permission: 'lesson_create', termRestriction: TR_CLOSED},        
        '/course_modules': {login: true, permission: 'nittio_support', termRestriction: TR_CLOSED},        
        '/leader_board': {login: true, permission: 'basic_access', termRestriction: TR_OPEN},
        '/change_owner': {login: true, permission: 'lesson_approve', termRestriction: TR_CLOSED},        
        '/upload_pdf': {login: true, permission: 'lesson_create', termRestriction: TR_CLOSED},        
        '/resource_list': {login: true, permission: 'basic_access', termRestriction: TR_OPEN},        
        '/resource_upload': {login: true, permission: 'basic_access', termRestriction: TR_OPEN},        
        '/admin_user': {login: true, permission: 'admin_user', termRestriction: TR_CLOSED},
        '/admin_group': {login: true, permission: 'admin_group', termRestriction: TR_CLOSED},
        '/recyclebin': {login: true, permission: 'lesson_approve', termRestriction: TR_CLOSED},
		'/learner_view': {login:true, permission: 'basic_access', termRestriction: TR_RESTRICTED},
		'/learner_view2': {login:true, permission: 'basic_access', termRestriction: TR_RESTRICTED},
        '/announcement': {login: true, permission: 'basic_access', termRestriction: TR_CLOSED},        

        // Operation permissions
        'assignment_manage': {login: true, permission: 'assignment_manage', termRestriction: TR_RESTRICTED},
        'assignment_send': {login: true, permission: 'assignment_send', termRestriction: TR_RESTRICTED},
        'change_password': {login: true, permission: 'change_password', termRestriction: TR_RESTRICTED},
        'forum_start_topic': {login: true, permission: 'assignment_send', termRestriction: TR_CLOSED},
        'forum_delete_msg': {login: true, permission: 'admin_user', termRestriction: TR_CLOSED},
        'forum_view_details': {login: true, permission: 'admin_user', termRestriction: TR_CLOSED},
        'admin_user': {login: true, permission: 'admin_user', termRestriction: TR_CLOSED},
        'admin_group': {login: true, permission: 'admin_group', termRestriction: TR_CLOSED},
        'nittio_support': {login: true, permission: 'nittio_support', termRestriction: TR_CLOSED}
    };
    
    var openPages = {'/login_now': 1, '/logout_now': 1,  '/pw_reset': 1,
                     '/welcome': 1};
    var updateCheckPages = {'/home': 1, '/learner_view': 1};
    this.isOpenPage = function(pageUrl) {
        var page = (pageUrl == '') ? nl.location.path() : pageUrl;
        return (page in openPages);
    };

    this.isUpdateCheckPage = function(pageUrl) {
        var page = (pageUrl == '') ? nl.location.path() : pageUrl;
        return (page in updateCheckPages);
    };

    this.getPermObj = function(permId) {
        if (permId == '') permId = nl.location.path();
        if (!(permId in permissions)) return null;
        return permissions[permId];
    };
    
    this.checkLogin = function(userInfo, pagePerm) {
        if (!pagePerm.login) return true; // Even unloggedin user can access the page
        return (userInfo.username != ''); // Login is required
    };

    this.isPermitted = function(userInfo, pagePerm) {
        if (!_isTerminalAuthorized(pagePerm, userInfo.termAccess)) return false;
        if (pagePerm.permission == '') return true;
        
        if (!(pagePerm.permission in userInfo.permissions)) return false;
        return userInfo.permissions[pagePerm.permission];
    };
    
    function _isTerminalAuthorized(pagePerm, userTermAccess) {

        // Does the user have 'full access' from the terminal?
        if (userTermAccess == 'allowed') return true;

        var pageTrLevel = 'termRestriction' in pagePerm ? pagePerm.termRestriction : TR_CLOSED;

        // Does the user have 'restricted access' from the terminal and page is accessible under
        // restricted or full access
        if (userTermAccess == 'restricted' && pageTrLevel >= TR_RESTRICTED) return true;
        
        // The user have 'no access' from the terminal but page is open to all users
        if (pageTrLevel == TR_OPEN) return true;
        
        return false;
    }
}

//-------------------------------------------------------------------------------------------------
// TODO: To be implemented
function NlMenu(nl) {
    var appmenu = [];
    var viewmenu = [];

    this.getMenuItems = function() {
        return appmenu.concat(viewmenu);
    };

    this.onViewEnter = function($scope, fn) {
        var self = this;
        router.onViewEnter($scope, fn);
    
        router.onViewLeave($scope, function() {
            self.clearViewMenu();
        });
    };

    this.clearAppMenu = function() {
        appmenu = [];
    };
    
    this.clearViewMenu = function() {
        viewmenu = [];
    };
    
    this.addAppMenuItem = function(title, img, handler) {
        addMenuItem(appmenu, title, img, handler);
    };

    this.addViewMenuItem = function(title, img, handler) {
        addMenuItem(viewmenu, title, img, handler);
    };
    
    function addMenuItem(menu, title, img, handler) {
        var menuItem = {title:nl.t(title), handler:handler, img:nl.url.resUrl(img)};
        menu.push(menuItem);
    }
    
}

//-------------------------------------------------------------------------------------------------
module_init();
}());

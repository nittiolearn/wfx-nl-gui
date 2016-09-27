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

var NlRouter = ['nl', 'nlDlg', 'nlServerApi', '$state',
function(nl, nlDlg, nlServerApi, $state) {
    var permission = new Permission(nl);
    var defaultFn = function() {return function(resolve, reject) {resolve(true);};};

    // Backward compatibility to old URLs with nittioapp!    
    if (nl.window.location.pathname.indexOf('/nittioapp') == 0) {
        nl.window.location.href = '/#' + nl.location.url();
        return;
    }
    
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
    }
    
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
        _getUserInfo(pageUrl).then(function(userInfo) {
            _sendGoogleAnalytics(userInfo);
            nl.rootScope.pgBgimg = _getUserBgimg(userInfo);
            nl.pginfo.username = (userInfo.username == '') ? '' : userInfo.displayname;
            var pagePerm = permission.getPermObj(pageUrl);
            if (pagePerm == null) {
                nlDlg.popupStatus(nl.t('Cannot access the page'));
                return _done('/home');
            }
            if (!permission.checkLogin(userInfo, pagePerm)) {
                if (nl.location.url() == '/home') return _done('/welcome');
                nlDlg.popupStatus(nl.t('Please login to access this page'));
                var nextUrl = nl.window.encodeURIComponent('/#' + nl.location.url());
                return _done(nl.fmt2('/login_now?msg=auth_error&next={}', nextUrl));
            }

            if (!permission.isPermitted(userInfo, pagePerm)) {
                nlDlg.popupStatus(nl.t('You are not authorized to access this page'));
                return _done('/home');
            }
            
            if ('onPageEnter' in $scope.$parent) $scope.$parent.onPageEnter(userInfo);
            pageEnterFn(userInfo, e).then(function(status) {
                if (status) return _done(null);
                _done('/home');
            });
        }, function() {
            return _done('/home');
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
    
    function _getUserBgimg(uInfo) {
        return ('groupinfo' in uInfo && uInfo.groupinfo.bgimg) ? uInfo.groupinfo.bgimg : null;
    }

    function _getUserInfo(pageUrl) {
        if (permission.isOpenPage(pageUrl)) return nlServerApi.getUserInfoFromCache();
        return nlServerApi.getUserInfoFromCacheOrServer();
    }
    
    function _done(rerouteToUrl) {
        var params = nl.location.search();
        nl.pginfo.isMenuShown = (!('embedded' in params || 'hidemenu' in params || nl.pginfo.hidemenu));
        nlDlg.hideLoadingScreen();

        if (rerouteToUrl != null) {
            nl.location.url(rerouteToUrl);
        }
        
        nl.pginfo.isPageShown = true;
        nl.pginfo.windowTitle = _getWindowTitle();
        nl.pginfo.windowDescription = windowDescription ? windowDescription : nl.pginfo.windowTitle;
        return true;
    }

    function _sendGoogleAnalytics(userInfo) {
        var userid = userInfo.username || 'none';
        var useridParts = userid.split('.');
        var groupid = useridParts.length > 1 ? useridParts[1] : 'none';
        var usertype = userInfo.usertype || 'none';

        var urlParts = nl.location.path().split('/');
        var reqtype = '/';
        if (urlParts.length > 1) reqtype += urlParts[1];
        if (urlParts.length > 2) reqtype += '/' + urlParts[2];
        
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
        '/home_refresh': {login: false, permission: '', termRestriction: TR_OPEN},
        '/welcome': {login: false, permission: '', termRestriction: TR_OPEN}, 
        '/school': {login: false, permission: '', termRestriction: TR_OPEN}, 
        '/business': {login: false, permission: '', termRestriction: TR_OPEN}, 
        '/team': {login: false, permission: '', termRestriction: TR_OPEN}, 
        '/login_now': {login: false, permission: '', termRestriction: TR_OPEN}, 
        '/logout_now': {login: false, permission: '', termRestriction: TR_OPEN},
        '/audit': {login: true, permission: 'admin_user', termRestriction: TR_CLOSED},
        '/impersonate': {login: true, permission: 'admin_impersonate_grp', termRestriction: TR_CLOSED},
        '/debug': {login: true, permission: 'debug_client', termRestriction: TR_CLOSED},
        '/debugtemp': {login: true, permission: 'debug_client', termRestriction: TR_CLOSED},
        '/forum': {login: true, permission: 'basic_access', termRestriction: TR_RESTRICTED},
        '/course_list': {login: true, permission: 'course_review', termRestriction: TR_CLOSED},
        '/course_assign_list': {login: true, permission: 'course_review', termRestriction: TR_CLOSED},
		'/course_report_list': {login:true, permission: 'course_do', termRestriction: TR_RESTRICTED},
        '/course_view': {login: true, permission: 'course_do', termRestriction: TR_RESTRICTED},
        '/course_cert': {login: true, permission: 'course_do', termRestriction: TR_RESTRICTED},
        '/course_charts': {login: true, permission: 'course_review', termRestriction: TR_CLOSED},
        '/dashboard': {login: true, permission: 'admin_user', termRestriction: TR_CLOSED},
        '/dashboard_view': {login: true, permission: 'admin_user', termRestriction: TR_CLOSED},
        '/searchlist': {login: true, permission: 'admin_user', termRestriction: TR_CLOSED},
        '/searchlist_view': {login: true, permission: 'basic_access', termRestriction: TR_CLOSED},
        '/rno_list': {login: true, permission: 'basic_access', termRestriction: TR_CLOSED},
        '/rno_view': {login: false, permission: '', termRestriction: TR_OPEN}, 
        '/rno_stats': {login: true, permission: 'basic_access', termRestriction: TR_CLOSED},
        '/sco_export': {login: true, permission: 'lesson_approve', termRestriction: TR_CLOSED},
        '/sco_import_list': {login: true, permission: 'lesson_approve', termRestriction: TR_CLOSED},
		'/assignment': {login: true, permission: 'basic_access', termRestriction: TR_RESTRICTED},		
        '/lesson_list': {login: true, permission: 'basic_access', termRestriction: TR_OPEN},        
        '/player': {login: true, permission: 'basic_access', termRestriction: TR_OPEN},        
        '/upload_pdf': {login: true, permission: 'lesson_create_adv', termRestriction: TR_CLOSED},        
        '/resource_list': {login: true, permission: 'basic_access', termRestriction: TR_OPEN},        
        '/resource_upload': {login: true, permission: 'basic_access', termRestriction: TR_OPEN},        
        '/assignment_report': {login: true, permission: 'assignment_send', termRestriction: TR_OPEN},        



        // Operation permissions
        'change_password': {login: true, permission: 'change_password', termRestriction: TR_RESTRICTED},
        'course_assign': {login: true, permission: 'course_assign', termRestriction: TR_CLOSED},
        'forum_start_topic': {login: true, permission: 'course_review', termRestriction: TR_CLOSED},
        'forum_delete_msg': {login: true, permission: 'admin_user', termRestriction: TR_CLOSED},
        'forum_view_details': {login: true, permission: 'admin_user', termRestriction: TR_CLOSED},
        'admin_user': {login: true, permission: 'admin_user', termRestriction: TR_CLOSED}
    };
    
    var openPages = {'/login_now': 1, '/logout_now': 1, 
                     '/welcome': 1, '/school': 1, '/business': 1, '/team': 1};
    this.isOpenPage = function(pageUrl) {
        var page = (pageUrl == '') ? nl.location.path() : pageUrl;
        return (page in openPages);
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

(function() {

//-------------------------------------------------------------------------------------------------
// router.js: 
// Page router: contains the standard stuff done when the url of single page app changes
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.router', [])
    .service('nlRouter', NlRouter);
}

var NlRouter = ['nl', 'nlDlg', 'nlServerApi',
function(nl, nlDlg, nlServerApi) {
    var permission = new Permission(nl);
    var defaultFn = function() {return function(resolve, reject) {resolve(true);};};
    
    this.initContoller = function($scope, pageUrl, pageEnterFn, pageLeaveFn) {
        if (pageEnterFn === undefined) pageEnterFn = defaultFn;
        $scope.$on('$ionicView.beforeEnter', function(e) {
            _onPageEnter($scope, pageUrl, pageEnterFn);
        });
        $scope.$on('$ionicView.beforeLeave', function(e) {
            _onPageLeave($scope, pageUrl, pageLeaveFn);
        });
    };
    
    this.isPermitted = function(userInfo, taskName) {
        var perm = permission.getPermObj(taskName);
        if (perm == null) return false;
        if (!permission.checkLogin(userInfo, perm)) return false;
        return permission.isPermitted(userInfo, perm);
    };
    
    function _onPageEnter($scope, pageUrl, pageEnterFn) {
        nl.log.debug('router.onPageEnter: ', nl.location.url());
        nl.pginfo.isPageShown = false;
        nlDlg.showLoadingScreen(200);
        var protocol = nl.location.protocol().toLowerCase();
        if (protocol.indexOf('file') >= 0) {
            nlDlg.hideLoadingScreen();
            return; // Progress wheel keeps on spinning
        }
        _getUserInfo(pageUrl).then(function(userInfo) {
            nl.pginfo.username = (userInfo.username == '') ? '' : userInfo.displayname;
            var pagePerm = permission.getPermObj(pageUrl);
            if (pagePerm == null) {
                nlDlg.popupStatus(nl.t('Cannot access the page'));
                return _done('/app/home');
            }
            if (!permission.checkLogin(userInfo, pagePerm)) {
                nlDlg.popupStatus(nl.t('Please login to access this page'));
                return _done(nl.fmt2('/app/login_now?msg=auth_error,next={}', nl.location.url()));
            }

            if (!permission.isPermitted(userInfo, pagePerm)) {
                nlDlg.popupStatus(nl.t('You are not authorized to access this page'));
                return _done('/app/home');
            }
            
            if ('onPageEnter' in $scope.$parent) $scope.$parent.onPageEnter(userInfo);
            pageEnterFn(userInfo).then(function(status) {
                if (status) return _done(null);
                _done('/app/home');
            });
        }, function() {
            return _done('/app/home');
        });
    }

    function _onPageLeave($scope, pageUrl, pageLeaveFn) {
        nl.log.debug('router.onPageLeave: ', nl.location.url());
        nl.pginfo.isPageShown = false;
        nl.pginfo.pageSubTitle = '';
        nlDlg.closeAll();
        if (pageLeaveFn) pageLeaveFn();
    }
    
    function _getUserInfo(pageUrl) {
        if (permission.isOpenPage(pageUrl)) return nlServerApi.getUserInfoFromCache();
        return nlServerApi.getUserInfoFromCacheOrServer();
    }
    
    function _done(rerouteToUrl) {
        var params = nl.location.search();
        nl.pginfo.isMenuShown = (!('hidemenu' in params));
        nlDlg.hideLoadingScreen();

        if (rerouteToUrl != null) nl.location.url(rerouteToUrl);
        
        nl.pginfo.isPageShown = true;
        nl.pginfo.windowTitle = _getWindowTitle();
        return true;
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
        '/app/home': {login: true, permission: 'basic_access', termRestriction: TR_OPEN}, 
        '/app/login_now': {login: false, permission: '', termRestriction: TR_OPEN}, 
        '/app/logout_now': {login: false, permission: '', termRestriction: TR_OPEN},
        '/app/audit': {login: true, permission: 'admin_user', termRestriction: TR_CLOSED},
        '/app/impersonate': {login: true, permission: 'admin_impersonate_grp', termRestriction: TR_CLOSED},
        '/app/temp': {login: true, permission: 'admin_user', termRestriction: TR_CLOSED},
        '/app/forum': {login: true, permission: 'basic_access', termRestriction: TR_CLOSED},

        // Operation permissions
        'change_password': {login: true, permission: 'change_password', termRestriction: TR_RESTRICTED} 
    };
    
    var openPages = {'/app/login_now': 1, '/app/logout_now': 1};
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

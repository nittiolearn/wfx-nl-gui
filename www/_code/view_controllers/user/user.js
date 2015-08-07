(function() {

//-------------------------------------------------------------------------------------------------
// lesson_ctrl.js:
// Controllers at lesson level
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.user', [])
    .config(configFn)
    .controller('nl.User.LoginCtrl', LoginCtrl)
    .controller('nl.User.LogoutCtrl', LogoutCtrl)
    .controller('nl.User.ImpersonateCtrl', ImpersonateCtrl)
    .controller('nl.User.AuditCtrl', AuditCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider',
function($stateProvider) {
    $stateProvider.state('app.login_now', {
        url : '/login_now',
        views : {
            'appContent' : {
                template : '',
                controller : 'nl.User.LoginCtrl'
            }
        }
    });
    $stateProvider.state('app.logout_now', {
        url : '/logout_now',
        views : {
            'appContent' : {
                template : '',
                controller : 'nl.User.LogoutCtrl'
            }
        }
    });
    $stateProvider.state('app.impersonate', {
        url : '/impersonate',
        views : {
            'appContent' : {
                template : '',
                controller : 'nl.User.ImpersonateCtrl'
            }
        }
    });
    $stateProvider.state('app.audit', {
        url : '/audit',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/user/audit.html',
                controller : 'nl.User.AuditCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var LoginCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlConfig',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlConfig) {
    _loginControllerImpl(true, nl, nlRouter, $scope, nlServerApi, nlDlg, nlConfig);
}];
    
var ImpersonateCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlConfig',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlConfig) {
    _loginControllerImpl(false, nl, nlRouter, $scope, nlServerApi, nlDlg, nlConfig);
}];

function _loginControllerImpl(isLogin, nl, nlRouter, $scope, nlServerApi, nlDlg, nlConfig) {
    $scope.isLogin  = isLogin;
    var loginDlg = nlDlg.create($scope);

    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            var username = userInfo.username;
            if (isLogin) {
                nl.pginfo.pageTitle = nl.t('Sign In');
                loginDlg.scope.msg = _getMsg(nl.location.search());
                loginDlg.scope.msgClass = '';
            } else {
                username = '';
                nl.pginfo.pageTitle = nl.t('Impersonate as user');
                loginDlg.scope.msg = nl.t('Be care full. Ensure you logout as soon as the work is done');
                loginDlg.scope.msgClass = 'nl-bg-red';
            }
            loginDlg.scope.data = {username: username, password: '', remember: false};
            loginDlg.scope.error = {};

            resolve(true);
            _showLoginDlg();
        });
    }
    function _onPageLeave() {
        loginDlg.close(false);
    }
    
    nlRouter.initContoller($scope, '', _onPageEnter, _onPageLeave);
    
    //---------------------------------------------------------------------------------------------
    // Controller private functions
    //---------------------------------------------------------------------------------------------
    function _showLoginDlg() {
        var buttonName = isLogin ? nl.t('Sign In') : nl.t('Impersonate');
        var loginButton = {text: buttonName, onTap: function(e) {
            if (e) e.preventDefault();
            if(!_validateInputs(loginDlg.scope)) return;
            nlDlg.showLoadingScreen();
            loginDlg.close(false);
            if (isLogin) {
                nlServerApi.login(loginDlg.scope.data).then(_onLoginSuccess, _onLoginFailed);
            } else {
                nlServerApi.impersonate(loginDlg.scope.data.username).then(_onLoginSuccess, _onLoginFailed);
            }
        }};
        var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
            if (e) e.preventDefault();
            loginDlg.close(false);
            loginDlg.destroy();
            nl.window.location.href = '/';
        }};
        loginDlg.show('view_controllers/user/logindlg.html', [loginButton], cancelButton, false);
    }
    
    function _getMsg(params) {
        var loginType = ('msg' in params) ? params.msg : '';
        var msg = '';
        if (loginType == 'logout') {
            msg = 'You have been signed out. Sign in again?';
        }
        else if (loginType == 'auth_error') {
            msg = 'You need to be signed in to access this page';
        }
        else if (loginType == 'login_error') {
            msg = 'Username or password is incorrect. Try again?';
        }
        return nl.t(msg);
    }
    
    function _getNextUrl(params) {
        var ret = {url: ('next' in params) ? params.next : nl.url.getAppUrl(), samePage: false};
        if (ret.url.indexOf(nl.url.getAppUrl()) != 0) return ret;
        ret.samePage = true;
        var pos = ret.url.indexOf('#');
        if (pos < 0) {
            ret.url = '/';
            return ret;
        }
        ret.url = ret.url.substring(pos+1);
        return ret;
    }
    
    function _validateInputs(scope) {
        scope.error = {};
        if (scope.data.username == '') {
            scope.error.username = nl.t('Username is required');
            return false;
        }
        if (scope.data.username.indexOf('.') < 0) {
            scope.error.username = nl.t('Username needs to be of format "userid.groupid"');
            return false;
        }
        if (!isLogin) return true;

        if (scope.data.password == '') {
            scope.error.password = nl.t('Password is required');
            return false;
        }
        return true;
    }
    
    function _onLoginSuccess(data) {
        nlServerApi.getUserInfoFromCache().then(function(userInfo) {
            loginDlg.destroy();
            nlDlg.hideLoadingScreen();

            var nextUrl = _getNextUrl(nl.location.search());
            if (!nextUrl.samePage) {
                nl.window.location.href = nextUrl.url;
                return;
            }
            
            if (isLogin) {
                var msg = nl.t('Welcome {}', userInfo.displayname);
                nlDlg.popupStatus(msg);
                nl.location.url(nextUrl.url);
            } else {
                var msg = nl.t('Impersonated as {}. Remember to logout as soon you are done!', userInfo.username);
                nlDlg.popupAlert({title:'Impersonated!', template:msg}).then(function() {
                    nl.location.url(nextUrl.url);
                });
            }
        });
    }

    function _onLoginFailed(data) {
        nlDlg.hideLoadingScreen();
        _showLoginDlg();
    }
}

//-------------------------------------------------------------------------------------------------
var LogoutCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg',
function(nl, nlRouter, $scope, nlServerApi, nlDlg) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Signing out - please wait ...');
            var bImp = ('impersonatedBy' in userInfo);
            var fn = (bImp) ? nlServerApi.impersonateEnd : nlServerApi.logout;
            fn($scope.data).then(function(data) {
                nlServerApi.getUserInfoFromCache().then(function(userInfo) {
                    if (bImp) {
                        nlDlg.popupStatus(nl.t('You have been signed out from the system'));
                    } else {
                        nlDlg.popupStatus(nl.t('You have been signed out from the system'));
                    }
                    nl.location.url('/app/login_now?msg=logout');
                    resolve(true);
                });
            }, function(reason) {
                var title = nl.t('Error signing out from the system');
                var template = nl.t('Reason: {}', reason);
                nlDlg.popupAlert({title:title, template:template}).then(function() {
                    resolve(false);
                });
            });
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
}];

//-------------------------------------------------------------------------------------------------
var AUDIT_TYPES = {1: 'LOGIN', 2: 'LOGIN_FAILED', 3: 'LOGOUT', 4: 'IMPERSONATE', 5: 'IMPERSONATE_FAILED', 6: 'IMPERSONATE_END'};

var AuditCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg',
function(nl, nlRouter, $scope, nlServerApi, nlDlg) {
    $scope.data = {eventsTill: ''};
    $scope.error = {};
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Audit records');
            _getAuditData(null).then(function(data) {
                resolve(true);
            });
        }, function(reason) {
            resolve(true);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
    
    $scope.onRetreive = function() {
        $scope.error = {};
        var till = ($scope.data.eventsTill != '') ? new Date($scope.data.eventsTill) : null;
        if (till != null && isNaN(till.valueOf())) {
            $scope.error.eventsTill = nl.t('Invalid date format');
            return;
        }
        nlDlg.showLoadingScreen();
        _getAuditData(till).then(function() {
            nlDlg.hideLoadingScreen();
        });
    };
    
    function _getAuditData(till) {
        return nlServerApi.getAuditData(till).then(function(data) {
            for (var i=0; i<data.length; i++) {
                data[i].updated = nl.fmt.jsonDate2Str(data[i].updated, true);
                if (data[i].type in AUDIT_TYPES) data[i].type = AUDIT_TYPES[data[i].type];
            }
            $scope.records = data;
            nlDlg.popupStatus(nl.t('{} records received', data.length));
        });
    }
    
}];

//-------------------------------------------------------------------------------------------------
module_init();
}());

(function() {

//-------------------------------------------------------------------------------------------------
// lesson_ctrl.js:
// Controllers at lesson level
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.user', [])
    .config(configFn)
    .controller('nl.User.LoginCtrl', LoginCtrl)
    .controller('nl.User.LogoutCtrl', LogoutCtrl);
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
}];

//-------------------------------------------------------------------------------------------------
var LoginCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlConfig',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlConfig) {
    
    var loginDlg = nlDlg.create($scope);

    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Sign In');
            loginDlg.scope.msg = _getMsg(nl.location.search());
            loginDlg.scope.data = {username: userInfo.username, password: '', remember: false};
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
            var loginButton = {text: nl.t('Sign In'), onTap: function(e) {
                e.preventDefault();
                if(!_validateInputs(loginDlg.scope)) return;
                nlDlg.showLoadingScreen();
                loginDlg.close(false);
                nlServerApi.login(loginDlg.scope.data).then(_onLoginSuccess, _onLoginFailed);
            }};
            var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
                e.preventDefault();
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
        if (scope.data.password == '') {
            scope.error.password = nl.t('Password is required');
            return false;
        }
        return true;
    }
    
    function _onLoginSuccess(data) {
        nlConfig.saveToDb("EULA_INFO", data, function() {
            nlServerApi.getUserInfoFromCache().then(function(userInfo) {
                loginDlg.destroy();
                nlDlg.hideLoadingScreen();
    
                var nextUrl = _getNextUrl(nl.location.search());
                if (!nextUrl.samePage) {
                    nl.window.location.href = nextUrl.url;
                    return;
                }
    
                var msg = nl.t('Welcome {}', userInfo.displayname);
                nlDlg.popupStatus(msg);
                nl.location.url(nextUrl.url);
            });
        });
    }

    function _onLoginFailed(data) {
        nlDlg.hideLoadingScreen();
        _showLoginDlg();
    }
    
}];

//-------------------------------------------------------------------------------------------------
var LogoutCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg',
function(nl, nlRouter, $scope, nlServerApi, nlDlg) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Signing out - please wait ...');
            nlServerApi.logout($scope.data).then(function(data) {
                nlServerApi.getUserInfoFromCache().then(function(userInfo) {
                    nlDlg.popupStatus(nl.t('You have been signed out from the system'));
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
module_init();
}());

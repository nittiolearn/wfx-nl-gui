(function() {

//-------------------------------------------------------------------------------------------------
// auth.js: Controllers for authentication related functions
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.auth', [])
    .config(configFn)
    .controller('nl.auth.LoginCtrl', LoginCtrl)
    .controller('nl.auth.LogoutCtrl', LogoutCtrl)
    .controller('nl.auth.ImpersonateCtrl', ImpersonateCtrl)
    .controller('nl.auth.AuditCtrl', AuditCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider',
function($stateProvider) {
    $stateProvider.state('app.login_now', {
        url : '^/login_now',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/auth/login.html',
                controller : 'nl.auth.LoginCtrl'
            }
        }
    });
    $stateProvider.state('app.logout_now', {
        url : '^/logout_now',
        views : {
            'appContent' : {
                template : '',
                controller : 'nl.auth.LogoutCtrl'
            }
        }
    });
    $stateProvider.state('app.impersonate', {
        url : '^/impersonate',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/auth/login.html',
                controller : 'nl.auth.ImpersonateCtrl'
            }
        }
    });
    $stateProvider.state('app.audit', {
        url : '^/audit',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/auth/audit.html',
                controller : 'nl.auth.AuditCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var LoginCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlConfig',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlConfig) {
    nl.log.debug('LoginCtrl - enter');
    _loginControllerImpl(true, nl, nlRouter, $scope, nlServerApi, nlDlg, nlConfig);
}];
    
var ImpersonateCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlConfig',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlConfig) {
    nl.log.debug('ImpersonateCtrl - enter');
    _loginControllerImpl(false, nl, nlRouter, $scope, nlServerApi, nlDlg, nlConfig);
}];

function _loginControllerImpl(isLogin, nl, nlRouter, $scope, nlServerApi, nlDlg, nlConfig) {
    nl.pginfo.hidemenu = true;
    $scope.isLogin  = isLogin;
    $scope.logo = nl.url.resUrl('website/nittiologowhite.png');
    $scope.bgImg = nl.url.resUrl('website/signin-bg1.jpg');
    $scope.showHome = true;
    $scope.showLogo = true;
    
    $scope.goHome = function() {
        if (!$scope.showHome) return;
        nl.location.url('/#/home');
    };

    $scope.lostPassword = function() {
        nl.window.location.href = '/auth/pwlost';
    };

    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.log.debug('_loginControllerImpl:onPageEnter - enter');
            nl.pginfo.hidemenu = true;
            var params = nl.location.search();
            if ('nohome' in params) $scope.showHome = false;
            if ('nologo' in params) $scope.showLogo = false;

            nlServerApi.clearCache();
            var username = userInfo.username;
            if (isLogin) {
                nl.pginfo.pageTitle = nl.t('Sign In');
                $scope.msg = _getMsg(params);
                $scope.msgClass = '';
            } else {
                username = '';
                nl.pginfo.pageTitle = nl.t('Impersonate as user');
                $scope.msg = nl.t('Be care full. Ensure you logout as soon as the work is done');
                $scope.msgClass = 'nl-bg-red';
            }
            $scope.data = {username: username, password: '', remember: true};
            $scope.error = {};

            nl.log.debug('_loginControllerImpl:onPageEnter - done');
            resolve(true);
            nl.timeout(function() {
                nlDlg.getField('username').focus();
            });
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
    
    //---------------------------------------------------------------------------------------------
    // Controller private functions
    //---------------------------------------------------------------------------------------------
    $scope.onUsernameEnter = function(keyEvent) {
	  	if (keyEvent.which !== 13) return;
	  	if(!_validateInputs($scope)) return;
	  	nlDlg.getField('password').focus();
	};

    $scope.onPasswordEnter = function(keyEvent) {
	  	if (keyEvent.which !== 13) return;
	  	$scope.loginWithSignInOrEnter();
	};
	
	$scope.loginWithSignInOrEnter = function() {
        if (!_validateInputs($scope)) return;
        nlDlg.showLoadingScreen();
        if (isLogin) {
            nlServerApi.authLogin($scope.data).then(_onLoginSuccess, _onLoginFailed);
        } else {
            nlServerApi.authImpersonate($scope.data.username).then(_onLoginSuccess, _onLoginFailed);
        }
    }    	
    
    function _getMsg(params) {
        var loginType = ('msg' in params) ? params.msg : '';
        var msg = '';
        if (loginType == 'logout') {
            msg = 'You have been signed out. Sign in again?';
        }
        else if (loginType == 'auth_error') {
            msg = 'You need to be signed in to access this page.';
        }
        else if (loginType == 'login_error') {
            msg = 'Username or password is incorrect. Try again?';
        }
        return nl.t(msg);
    }
    
    function _getNextUrl(params) {
        if (!('next' in params)) return {url: '/home', samePage: true};
        var next = params.next;
        var pos = next.indexOf('#');
        var controller = (pos > 0) ? next.substring(0, pos) : next;
        if (controller != '/') {
            return {url: next, samePage: false};
        }
        return {url: next.substring(pos+1), samePage: true};
    }
    
    function _validateInputs(scope) {
        scope.error = {};
        if (scope.data.username == '') {
        	return nlDlg.setFieldError(scope, 'username',
        		nl.t('Username is required'));
        }
        
        var username = scope.data.username.toLowerCase();
        username = username.replace(/[^a-z0-9_-]/g, function(x) {
            if (x == '.') return x;
            return '';
        });
        scope.data.username = username;
        if (scope.data.username.indexOf('.') < 0) {
        	return nlDlg.setFieldError(scope, 'username',
        		nl.t('Username needs to be of format "userid.groupid"'));
        }
        if (!isLogin) return true;

        if (scope.data.password == '') {
        	return nlDlg.setFieldError(scope, 'password',
        		nl.t('Password is required'));
        }
        return true;
    }
    
    function _onLoginSuccess(data) {
        nlServerApi.getUserInfoFromCache().then(function(userInfo) {
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
        nl.log.warn('_onLoginFailed');
        nlDlg.hideLoadingScreen();
    }
}

//-------------------------------------------------------------------------------------------------
var LogoutCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg',
function(nl, nlRouter, $scope, nlServerApi, nlDlg) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.log.debug('LogoutCtrl:onPageEnter - enter');
            nl.pginfo.pageTitle = nl.t('Signing out - please wait ...');
            var bImp = ('impersonatedBy' in userInfo);
            var fn = (bImp) ? nlServerApi.authImpersonateEnd : nlServerApi.authLogout;
            fn($scope.data).then(function(data) {
                nlServerApi.getUserInfoFromCache().then(function(userInfo) {
                    if (bImp) {
                        nlDlg.popupStatus(nl.t('You have been signed out from the system'));
                    } else {
                        nlDlg.popupStatus(nl.t('You have been signed out from the system'));
                    }
                    nl.log.debug('LogoutCtrl:onPageEnter - done');
                    nl.location.url('/login_now?msg=logout');
                    resolve(true);
                });
            }, function(reason) {
                nl.log.warn('LogoutCtrl: Error signing out from the system');
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
// Same object is defined in server side. Please update in both places.
var AUDIT_TYPES = {1: 'LOGIN', 2: 'LOGIN_FAILED', 3: 'LOGOUT', 4: 'IMPERSONATE', 5: 'IMPERSONATE_FAILED', 6: 'IMPERSONATE_END'};

var AuditCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg',
function(nl, nlRouter, $scope, nlServerApi, nlDlg) {
    $scope.data = {eventsTill: ''};
    $scope.error = {};
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.log.debug('AuditCtrl:onPageEnter - enter');
            nl.pginfo.pageTitle = nl.t('Audit records');
            _getAuditData(null).then(function(data) {
                nl.log.debug('AuditCtrl:onPageEnter - done');
                resolve(true);
            }, function(reason) {
                nl.log.warn('AuditCtrl:onPageEnter - loading failed');
                resolve(false);
            });
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
    
    $scope.onRetreive = function() {
        $scope.error = {};
        var till = ($scope.data.eventsTill != '') ? new Date($scope.data.eventsTill) : null;
        if (till != null && isNaN(till.valueOf())) {
        	return nlDlg.setFieldError($scope, 'eventsTill',
        		nl.t('Invalid date format'));
        }
        nlDlg.showLoadingScreen();
        _getAuditData(till).then(function() {
            nlDlg.hideLoadingScreen();
        });
    };
    
    function _getAuditData(till) {
        return nlServerApi.authGetAuditData(till).then(function(data) {
            for (var i=0; i<data.length; i++) {
                data[i].updated = nl.fmt.jsonDate2Str(data[i].updated, 'millisecond');
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

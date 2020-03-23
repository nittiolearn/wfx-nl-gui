(function() {

//-------------------------------------------------------------------------------------------------
// auth.js: Controllers for authentication related functions
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.auth', ['nl.auth.serverside_user_settings', 'nl.auth.audit'])
    .config(configFn)
    .controller('nl.auth.LoginCtrl', LoginCtrl)
    .controller('nl.auth.LogoutCtrl', LogoutCtrl)
    .controller('nl.auth.ImpersonateCtrl', ImpersonateCtrl)
    .controller('nl.auth.PwChangeCtrl', PwChangeCtrl)
    .controller('nl.auth.PwResetCtrl', PwResetCtrl)
    .service('nlPwLostHandler', nlPwLostHandler);
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
    $stateProvider.state('app.pw_change', {
        url : '^/pw_change',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/auth/login.html',
                controller : 'nl.auth.PwChangeCtrl'
            }
        }
    });
    $stateProvider.state('app.pw_reset', {
        url : '^/pw_reset',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/auth/login.html',
                controller : 'nl.auth.PwResetCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var LoginCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlServerSideUserSettings', 'nlPwLostHandler',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlServerSideUserSettings, nlPwLostHandler) {
    nl.log.debug('LoginCtrl - enter');
    _loginControllerImpl('login', nl, nlRouter, $scope, nlServerApi, nlDlg, nlServerSideUserSettings, nlPwLostHandler);
}];
    
var ImpersonateCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlServerSideUserSettings', 'nlPwLostHandler',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlServerSideUserSettings, nlPwLostHandler) {
    nl.log.debug('ImpersonateCtrl - enter');
    _loginControllerImpl('impersonate', nl, nlRouter, $scope, nlServerApi, nlDlg, nlServerSideUserSettings, nlPwLostHandler);
}];

var PwChangeCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlServerSideUserSettings', 'nlPwLostHandler',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlServerSideUserSettings, nlPwLostHandler) {
    nl.log.debug('ImpersonateCtrl - enter');
    _loginControllerImpl('pw_change', nl, nlRouter, $scope, nlServerApi, nlDlg, nlServerSideUserSettings, nlPwLostHandler);
}];

var PwResetCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlServerSideUserSettings', 'nlPwLostHandler',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlServerSideUserSettings, nlPwLostHandler) {
    nl.log.debug('ImpersonateCtrl - enter');
    _loginControllerImpl('pw_reset', nl, nlRouter, $scope, nlServerApi, nlDlg, nlServerSideUserSettings, nlPwLostHandler);
}];

function _loginControllerImpl(ctrlType, nl, nlRouter, $scope, nlServerApi, nlDlg, nlServerSideUserSettings, nlPwLostHandler) {
    var params = nl.location.search();
    _updateMsg(ctrlType == 'login' ? params.msg || '' : ctrlType);

    $scope.debug = 'debug' in params;
    $scope.reset_key = params.reset_key || '';
    $scope.user_id = params.user_id || '';
    $scope.initDone = false;
    
    var brandingInfo = nlServerApi.getBrandingInfo();
    nl.pginfo.hidemenu = true;    
    $scope.bgimg = nl.url.resUrl2(brandingInfo.bgimg) || '';

    $scope.logo1 = nl.url.resUrl2(brandingInfo.logo1) || '';
    $scope.logo1text = brandingInfo.logo1text || '';
    $scope.logo1url = brandingInfo.logo1url || '';
    $scope.logo1w = brandingInfo.logo1w || 240;
    $scope.logo1h = brandingInfo.logo1h || 80;
    $scope.logo1wm = brandingInfo.logo1wm || 240;
    $scope.logo1hm = brandingInfo.logo1hm || 80;
	$scope.showLogo1InMobile = brandingInfo.showLogo1InMobile === undefined ? true : brandingInfo.showLogo1InMobile; 

	$scope.logo2 = nl.url.resUrl2(brandingInfo.logo2) || '';
	$scope.logo2text = brandingInfo.logo2text || '';
	$scope.logo2url = brandingInfo.logo2url || '';
    $scope.logo2w = brandingInfo.logo2w || 240;
    $scope.logo2h = brandingInfo.logo2h || 80;
    $scope.logo2wm = brandingInfo.logo2wm || 240;
    $scope.logo2hm = brandingInfo.logo2hm || 80;
	$scope.showLogo2InMobile = brandingInfo.showLogo2InMobile === undefined ? true : brandingInfo.showLogo2InMobile; 

    $scope.loginVAlign = brandingInfo.loginVAlign || 'row-center';
    $scope.loginGap = brandingInfo.loginGap || 80;
    $scope.loginBoxClass = brandingInfo.loginBoxClass;

	$scope.mainImg = nl.url.resUrl2(brandingInfo.img) || ''; 
	$scope.showImgInMobile = brandingInfo.showImgInMobile === undefined ? true : brandingInfo.showImgInMobile; 

    $scope.lostPassword = function() {
        nlPwLostHandler.pwlost($scope, $scope.data.username);
    };

	$scope.onLinkClicked = function(url) {
		if(!url) return;
        nl.window.location.href = url;
	};

    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.log.debug('_loginControllerImpl:onPageEnter - enter');
            nl.pginfo.hidemenu = true;
            var username = userInfo.username || '';
            $scope.data = {username: username, password: '', remember: true, new_password1: '', new_password2: ''};
            $scope.error = {};
            if ($scope.msgType == 'pw_reset') {
                if ($scope.reset_key && $scope.user_id) return _validateResetKey(resolve);
                nlDlg.popupStatus('Incorrect URL');
                resolve(false);
                return;
            }
            _pageEnerDone(resolve);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
    
    //---------------------------------------------------------------------------------------------
    // Controller private functions
    //---------------------------------------------------------------------------------------------
    function _validateResetKey(resolve) {
        nlServerApi.authValidateResetKey({reset_key: $scope.reset_key, user_id: $scope.user_id})
        .then(function(data) {
            $scope.data.username = data.username;
            _pageEnerDone(resolve);
        }, function() {
            resolve(false);
        })
    }

    function _pageEnerDone(resolve) {
        $scope.initDone = true;
        nl.timeout(function() {
            var fieldName = 'username';
            if ($scope.msgType == 'pw_change') fieldName = 'password';
            else if ($scope.msgType == 'pw_reset') fieldName = 'new_password1';
            nlDlg.getField(fieldName).focus();
            resolve(true);
        });
    }

    $scope.onUsernameEnter = function(keyEvent) {
	  	if (keyEvent.which !== 13) return;
	  	if(!_validateInputs($scope, 'username')) return;
	  	if ($scope.msgType != 'impersonate')
	  	    nlDlg.getField('password').focus();
  	    else
            $scope.loginWithSignInOrEnter();
	};

    $scope.onPasswordEnter = function(keyEvent) {
	  	if (keyEvent.which !== 13) return;
	  	if(!_validateInputs($scope, 'password')) return;
	  	if ($scope.msgType == 'pw_change')
            nlDlg.getField('new_password1').focus();
  	    else
            $scope.loginWithSignInOrEnter();
	};
	
    $scope.onNewPasswordEnter = function(keyEvent) {
	  	if (keyEvent.which !== 13) return;
	  	if(!_validateInputs($scope, 'new_password1')) return;
        nlDlg.getField('new_password2').focus();
	};
	
    $scope.onVerifyNewPasswordEnter = function(keyEvent) {
	  	if (keyEvent.which !== 13) return;
	  	if(!_validateInputs($scope, 'new_password2')) return;
	  	$scope.loginWithSignInOrEnter();
	};
	
	$scope.loginWithSignInOrEnter = function() {
        if (!_validateInputs($scope)) return;
        nlDlg.showLoadingScreen();
        nlServerApi.clearCache();
        if ($scope.msgType != 'impersonate') {
            var dataToServer = {username: $scope.data.username, password: $scope.data.password, 
                remember: $scope.data.remember, showExtendedStatusCode: true};
            if ($scope.msgType == 'pw_change' || $scope.msgType == 'pw_reset') dataToServer.new_password = $scope.data.new_password1;
            if ($scope.msgType == 'pw_reset') {
                dataToServer.reset_key = $scope.reset_key;
                dataToServer.user_id = $scope.user_id;
            }
            if ($scope.msgType == "login_otp_received" && $scope.isOtp2fa) {
                dataToServer.otp_2fa = $scope.data.otp;
                // TODO-NOW: retry button in OTP screen does not work?
                // If once OTP is wrong, it hangs second time?
            }
            $scope.isOtp2fa = false;
            nlServerApi.authLogin(dataToServer).then(_onLoginSuccess, _onLoginFailed);
        } else {
            nlServerApi.authImpersonate($scope.data.username).then(_onLoginSuccess, _onLoginFailed);
        }
    }    	
    
    $scope.loginOTP = function() { _updateMsg('login_otp'); };
    $scope.loginWithUserID = function() { 
        $scope.isOtp2fa = false; 
        $scope.data.otp = '';
        _updateMsg('login_userid'); 
    };

    $scope.loginWithOTP = function() {
        if($scope.data.otp.length !== 4) return nlDlg.setFieldError($scope, 'otp', nl.t('Please Enter a Valid OTP'));
        nlDlg.showLoadingScreen();
        if ($scope.isOtp2fa) return $scope.loginWithSignInOrEnter();
        nlServerApi.clearCache();
        var dataToServer = {phonenumber: $scope.data.phonenumber, username: $scope.data.username,
            otp: $scope.data.otp};
        // TODO-LATER: This has to be reimplemented later
    }

    $scope.isNumberKey = function(evt, len, fieldname, fn) {
        if(evt.keyCode === 13) fn();
        var value = $scope.data[fieldname];
        var key = Number(evt.key)
        if (isNaN(key) || evt.key===null || evt.key===' ' || (value && value.length >= len)) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        return true;
    }

    $scope.onMobileEnter = function(evt) {
        if(evt.keyCode !== 13) return;
        $scope.requestOTP();
    };

    $scope.requestOTP = function() {
        if (!_validatePhoneNumber($scope)) return;
        nlDlg.showLoadingScreen();
        nlServerApi.clearCache();
        var phonenumber = $scope.data.phonenumber;
        if (phonenumber[0] != '+') phonenumber = "+91" + phonenumber;
        // TODO-LATER: Call the server
        $scope.msgType = "login_otp_received"
    }

    function _validatePhoneNumber(scope) {
        scope.error = {};
        if (scope.data.phonenumber == '' || scope.data.phonenumber == undefined) {
            return nlDlg.setFieldError(scope, 'phonenumber', nl.t('Phone Number is required'));
        } else if (scope.data.phonenumber.length > 0) {
            scope.data.phonenumber = scope.data.phonenumber.trim();
            var num = scope.data.phonenumber.replace(/ /g, "");
            if (num.length < 10 || num.match(/^\+?[0-9]+$/) == null) {
                return nlDlg.setFieldError(scope, 'phonenumber', nl.t('Please Enter a Valid Phone Number'));
            }
        }
        return true;
     }
    

    function _updateMsg(msgType) {
        $scope.msgType = msgType;
        $scope.msgClass = 'nl-signin-msg';
        nl.pginfo.pageTitle = nl.t('Sign In');
        $scope.msg = '';
        if (msgType == 'logout') {
            $scope.msg = 'You have been signed out. Sign in again?';
        } else if (msgType == 'auth_error') {
            $scope.msg = 'You need to be signed in to access this page.';
        } else if (msgType == 'login_error') {
            $scope.msg = 'Username or password is incorrect. Try again?';
        } else if (msgType == 'pw_change') {
            $scope.msg = 'Please set a new password for your account.';
            nl.pginfo.pageTitle = nl.t('Change password');
        } else if (msgType == 'pw_reset') {
            $scope.msg = 'Please reset your password.';
            nl.pginfo.pageTitle = nl.t('Reset password');
        } else if (msgType == 'impersonate') {
            $scope.msg = 'Be careful. Ensure you logout as soon as the work is done';
            nl.pginfo.pageTitle = nl.t('Impersonate as user');
        }
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
    
    function _validateInputs(scope, fieldType) {
        scope.error = {};
        if (scope.data.username == '') {
        	return nlDlg.setFieldError(scope, 'username',
        		nl.t('Username is required'));
        }
        var username = scope.data.username.toLowerCase();
        username = username.replace(/[^a-z0-9_-]/g, function(x) {
            if (x == '.' || x == '@') return x;
            return '';
        });
        scope.data.username = username;
        if (fieldType == 'username' || $scope.msgType == 'impersonate') {
            var parts = username.split('.');
            if (parts.length != 2) {
            	return nlDlg.setFieldError(scope, 'username',
            		nl.t('Username needs to be of format "userid.groupid"'));
            } 
            return true;
        }

        if (scope.data.password == '' && $scope.msgType != 'pw_reset') {
        	return nlDlg.setFieldError(scope, 'password',
        		nl.t('Password is required'));
        }
        if (fieldType == 'password' || ($scope.msgType != 'pw_change' && $scope.msgType != 'pw_reset'))
            return true;

        if (scope.data.new_password1 == '') {
            return nlDlg.setFieldError(scope, 'new_password1',
                nl.t('Please enter a new password.'));
        }
        if (fieldType == 'new_password1') return true;

        if (scope.data.new_password1 != scope.data.new_password2) {
            return nlDlg.setFieldError(scope, 'new_password2',
                nl.t('This does not match with the new password.'));
        }
        return true;
    }
    
    function _onLoginSuccess(data) {
        nlServerApi.getUserInfoFromCache().then(function(userInfo) {
            nlDlg.hideLoadingScreen();
            _updateUserSettingsIfNeeded(userInfo, function() {
                var nextUrl = _getNextUrl(nl.location.search());
                if (!nextUrl.samePage) {
                    nl.window.location.href = nextUrl.url;
                    return;
                }
                if ($scope.msgType != 'impersonate') {
                    var msg = nl.t('Welcome {}', userInfo.displayname);
                    nlDlg.popupStatus(msg);
                    nl.location.url(nextUrl.url);
                } else {
                    var msg = nl.t('Impersonated as {}. Remember to logout as soon you are done!', userInfo.username);
                    nlDlg.popupStatus(msg);
                    nl.location.url(nextUrl.url);
                }
            });
        });
    }

    function _onLoginFailed(data) {
        nl.timeout(function() {
            var isChange = $scope.msgType == 'pw_change' || $scope.msgType == 'pw_reset';
            var changeError = data.extendedStatusCode == 'PW_CHANGE_ERROR';
            var expired = data.extendedStatusCode == 'LOGIN_PW_EXPIRED';
            if (expired) _updateMsg('pw_change');
            $scope.hintmsg = changeError ? data.msg : '';
            if (isChange || expired) nlDlg.getField('new_password1').focus();
            if (data.extendedStatusCode == '2FA_OTP_VERIFY') {
                $scope.msgType = "login_otp_received";
                $scope.isOtp2fa = true;
            }
        });
    }

    function _updateUserSettingsIfNeeded(userInfo, onDoneFn) {
        if ($scope.msgType == 'impersonate') return onDoneFn();
        nlServerSideUserSettings.updateSecurityQuestionsIfNeeded($scope, userInfo).then(function(result) {
            onDoneFn();
        });
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
            nlServerApi.clearCache();
            fn().then(function(data) {
                nlServerApi.getUserInfoFromCache().then(function(userInfo) {
                    nlDlg.popupStatus(nl.t('You have been signed out from the system'));
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
var nlPwLostHandler = ['nl', 'nlDlg', 'nlServerApi', 'nlServerSideUserSettings',
function(nl, nlDlg, nlServerApi, nlServerSideUserSettings) {

    this.pwlost = function($scope, username) {
        _showDlg($scope, username);
    };

    function _showDlg($scope, username) {
        var dlg = nlDlg.create($scope);
        dlg.scope.data = {username: username || ''};

        var resetButton = {text : 'Reset Password', onTap : function(e) {
            var username = _getValidatedUserName(dlg.scope.data.username);
            if (!username) {
                e.preventDefault();
                return;
            }
            nlDlg.showLoadingScreen();
            nlServerApi.authPwLost(username).then(function(result) {
                nlDlg.hideLoadingScreen();
                nl.timeout(function() {
                    if (result.reset_type == 'self') return _pwSelfReset($scope, result.sec_questions, username);
                    nlDlg.popupAlert({title: 'Reset email sent', template: 'Password reset email has been sent to your registered email id. Follow the link in the email to reset your password.'});
                });
            });
        }};

        var cancelButton = {text : nl.t('Cancel')};
        dlg.show('view_controllers/auth/pwlost.html', [resetButton], cancelButton);
    }

    function _getValidatedUserName(username) {
        username = username.replace(/[^a-z0-9_-]/g, function(x) {
            if (x == '.') return x;
            return '';
        });
        var parts = username.split('.');
        if (parts.length != 2) {
            nlDlg.popupAlert({title: 'Error', template: 'Username needs to be of format "userid.groupid"'});
            return null;
        }
        return username;
    }

    function _pwSelfReset($scope, sec_questions, username) {
        var dlg = nlDlg.create($scope);
        dlg.scope.data = {new_password: '',  new_password2:  '', sec_questions: []};
        
        for(var i=0; i<sec_questions.length; i++) {
            var q = sec_questions[i];
            var qName = nlServerSideUserSettings.getQuestionString(q);
            if (!q) return _pwQuestionError();
            dlg.scope.data.sec_questions.push({q: q, qName: qName, a: ''});
        }

        var resetButton = {text : 'Reset Password', onTap : function(e) {
            if (!_validatePwSelfResetDlg(dlg.scope.data)) {
                e.preventDefault();
                return;
            }
            var data = {username: username, new_password: dlg.scope.data.new_password, sec_answers: {}};
            for(var i=0; i<dlg.scope.data.sec_questions.length; i++) {
                var item = dlg.scope.data.sec_questions[i];
                data.sec_answers[item.q] = item.a;
            }
    
            nlDlg.showLoadingScreen();
            nlServerApi.authPwSelfReset(data).then(function(result) {
                nlDlg.hideLoadingScreen();
                nlDlg.popupAlert({title: 'Reset done', template: 'Password reset is done. Please login with your newly set password.'});
            });
        }};

        var cancelButton = {text : nl.t('Cancel')};
        dlg.show('view_controllers/auth/pw_self_reset.html', [resetButton], cancelButton);
    }

    function _validatePwSelfResetDlg(data) {
        if (data.new_password != data.new_password2) return _vfail('New password is not matching');
        for(var i=0; i<data.sec_questions.length; i++) {
            var item = data.sec_questions[i];
            if (!item.a) return _vfail('Please answer all the questions');
        }
        return true;
    }

    function _vfail(msg) {
        nlDlg.popupAlert({title: 'Error', template: msg});
        return false;
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
}());

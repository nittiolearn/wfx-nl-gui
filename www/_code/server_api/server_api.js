(function() {

//-------------------------------------------------------------------------------------------------
// server_api.js:
// All Server side interfaces are collected in a single service
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.server_api', [])
    .service('nlServerApi', NlServerApi);
}

//-------------------------------------------------------------------------------------------------
var NlServerApi = ['nl', 'nlDlg', 'nlConfig',
function(nl, nlDlg, nlConfig) {
    
    var server = new NlServerInterface(nl, nlDlg, nlConfig);

    this.getUserInfoFromCache = function() {
        return server.getUserInfoFromCache();
    };

    this.getUserInfoFromServer = function() {
        nl.log.debug('server_api: getUserInfoFromServer - enter');
        return nl.q(function(resolve, reject) {
            _ping().then(function() {
                nl.log.debug('server_api: getUserInfoFromServer - done');
                server.getUserInfoFromCache().then(resolve);
            }, reject);
        });
    };

    this.getUserInfoFromCacheOrServer = function() {
        var self = this;
        return nl.q(function(resolve, reject) {
            // First attempt in cache!
            server.getUserInfoFromCache().then(function(userInfo) {
                if (userInfo.username != '') {
                    resolve(userInfo);
                    return;
                }
                // Second attempt in cache after refreshing cache
                server.reinitUserInfo();
                server.getUserInfoFromCache().then(function(userInfo) {
                    if (userInfo.username != '') {
                        resolve(userInfo);
                        return;
                    }
                    // Third attempt: get from server
                    self.getUserInfoFromServer().then(resolve, reject);
                });
            });
        });
    };
    
    this.login = function(data) {
        nl.log.debug('server_api: login');
        return _postAndSaveEula('_serverapi/login.json', data, false);
    };

    this.logout = function() {
        nl.log.debug('server_api: logout');
        return server.post('_serverapi/logout.json', {}, true, true);
    };

    this.eulaAck = function() {
        nl.log.debug('server_api: eulaAck');
        return server.post('_serverapi/eula_ack.json', {});
    };

    this.getAuditData = function(updatedTill, limitBy) {
        nl.log.debug('server_api: getAuditData');
        var data = {};
        if (updatedTill !== undefined && updatedTill !== null) data.updatedTill = updatedTill;
        if (limitBy !== undefined && limitBy !== null) data.limitBy = limitBy;
        return server.post('_serverapi/get_audit_data.json', data);
    };

    this.impersonate = function(username) {
        nl.log.debug('server_api: impersonate');
        return _postAndSaveEula('_serverapi/impersonate.json', {username:username}, false);
    };

    this.impersonateEnd = function() {
        nl.log.debug('server_api: impersonateEnd');
        return server.post('_serverapi/impersonate_end.json', {}, true);
    };
    
    function _ping() {
        return _postAndSaveEula('_serverapi/ping.json', {}, true);
    }

    function _postAndSaveEula(url, data, noPopup) {
        return nl.q(function(resolve, reject) {
            server.post(url, data, true, noPopup)
            .then(function(result) {
                nlConfig.saveToDb("EULA_INFO", result, function() {
                    resolve(result);
                });
            }, function() {
                reject();
            });
        });
    }
}];

function NlServerInterface(nl, nlDlg, nlConfig) {

    this.currentUserInfo = _defaultUserInfo();
    this.resolveWaiters = [];
    this.initDone = false;
    _initUserInfo(this);
    
    this.getUserInfoFromCache = function() {
        var self = this;
        return nl.q(function(resolve, reject) {
            if (self.initDone) {
                self.currentUserInfo = _validateUserInfo(self.currentUserInfo);
                resolve(self.currentUserInfo);
            } else {
                self.resolveWaiters.push(resolve);
            }
        });
    };

    this.reinitUserInfo = function() {
        this.initDone = false;
        _initUserInfo(this);
    };
    
    this.post = function(url, data, reloadUserInfo, noPopup) {
        reloadUserInfo = (reloadUserInfo == true);
        noPopup = (noPopup == true);
        var self = this;
        return nl.q(function(resolve, reject) {
            self.getUserInfoFromCache().then(function(userInfo) {
                data._u = reloadUserInfo ? 'NOT_DEFINED' : userInfo.username;
                data._v = NL_SERVER_INFO.versions.script;
                url = NL_SERVER_INFO.url + url;
                var ret = _postImpl(url, data)
                .success(function(data, status, headers, config) {
                    _processResponse(self, data, status, resolve, reject, noPopup);
                }).error(function(data, status, headers, config) {
                    _processResponse(self, data, status, resolve, reject, noPopup);
                });
            });
        });
    };
    
    //----------------------------------------------------------------------------------------------
    // Private methods
    function _defaultUserInfo() {
        return {username: '', lastupdated: null, groupicon: nl.url.resUrl('general/top-logo1.png'), dashboard: []};
    }
    
    function _postImpl(url, data) {
        if (NL_SERVER_INFO.serverType == 'local') return nl.http.get(url); // For local testing
        return nl.http.post(url, data);
    }
    
    var MAX_DIFF = 1000*60*30; // 30 minutes
    function _validateUserInfo(userInfo) {
        if (userInfo.username == '') return userInfo;
        var now = (new Date()).getTime();
        var diff = now - userInfo.lastupdated;
        if (diff < MAX_DIFF) return userInfo;
        nl.log.warn('_validateUserInfo: cache dirty: ', now/1000, userInfo.lastupdated/1000, diff/1000);
        return _defaultUserInfo();
    }

    function _touchUserInfo(userInfo) {
        userInfo.lastupdated = (new Date()).getTime();
    }

    function _initUserInfo(self) {
        _loadUserInfoFromDb(function(userInfo) {
            self.initDone = true;
            self.currentUserInfo = _validateUserInfo(userInfo);
            for(var i=0; i<self.resolveWaiters.length; i++) {
                self.resolveWaiters[i](self.currentUserInfo);
            }
            self.resolveWaiters = [];
            return true;
        });
    }
    
    function _saveUserInfoToDb(userInfo, resolve) {
        nlConfig.saveToDb('USER_INFO', userInfo, resolve);
    }

    function _loadUserInfoFromDb(resolve) {
        nlConfig.loadFromDb('USER_INFO', function(userInfo) {
            if (userInfo == null) userInfo = _defaultUserInfo();
            resolve(userInfo);
        });
    }

    //----------------------------------------------------------------------------------------------
    // Same values defined in mutils.py on the server side
    var ET_SUCCESS = -1;
    var ET_AUTHERROR = 0;
    var ET_LOGINERROR = 1;
    var ET_TERMINALERROR = 2;
    var ET_USAGEERROR = 3;
    
    var ET_ERROR_MESSAGES = [
        'You are not authorized to perform this operation', 
        'Please sign in to access this page',
        'You are not authorized to access from this terminal',
        'Application Error'];
    //----------------------------------------------------------------------------------------------
    
    function _processResponse(self, data, status, resolve, reject, noPopup) {
        nl.log.debug('_processResponse:', data, status);
        if (angular.isString(data)) {
            data = {_errorMsg: data};
        }
        
        function _processErrorOrResponse() {
            var status = ('_status' in data) ? data._status : ET_USAGEERROR;
            if (status > ET_USAGEERROR) status = ET_USAGEERROR;
            
            if ('_serverVersion' in data) {
                _handleVersionMismatch(data._serverVersion, reject);
            } else if (status != ET_SUCCESS) {
                _displayErrorMessage(status, data, reject, noPopup);
            } else {
                resolve(data._result);
            }
        }
        
        if ('_userInfo' in data) {
            _handleUserChange(self, data._userInfo).then(_processErrorOrResponse);
        } else {
            _processErrorOrResponse();
        }
    }

    function _displayErrorMessage(status, data, reject, noPopup) {
        var errorMsg = ('_errorMsg' in data) ? data._errorMsg : data;
        if (errorMsg == '') errorMsg = ET_ERROR_MESSAGES[status];
        nl.log.warn('_displayErrorMessage:', errorMsg, status);
        if (noPopup) {
            reject(errorMsg);
            return;
        }
        nlDlg.popupAlert({title: nl.t('Error'), template: nl.t(errorMsg)})
        .then(function(res) {
            reject(errorMsg);
        });
    }

    function _handleVersionMismatch(serverVersion, reject) {
        var content = nl.t('Server software has been updated. The page will be reloaded to updated to latest software.',
             serverVersion, NL_SERVER_INFO.versions.script);
        nl.log.error('_handleVersionMismatch:', serverVersion, NL_SERVER_INFO.versions.script);
        nlDlg.popupAlert({title: nl.t('Reload latest software'), template: content, okText: nl.t('Reload')})
        .then(function() {
            reject(content);
            nl.window.location.reload();
        });
    }

    function _handleUserChange(self, userInfo) {
        return nl.q(function(resolve, reject) {
            nl.log.warn(nl.fmt2('UserInfo changed', userInfo));
            self.currentUserInfo = userInfo;
            _touchUserInfo(self.currentUserInfo);
            _saveUserInfoToDb(self.currentUserInfo, resolve);
        });
    }
}

module_init();
})();

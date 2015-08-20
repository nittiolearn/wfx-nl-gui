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

    //---------------------------------------------------------------------------------------------
    // Common methods
    //---------------------------------------------------------------------------------------------
    this.getUserInfoFromCache = function() {
        return server.getUserInfoFromCache();
    };

    this.getUserInfoFromCacheOrServer = function() {
        return _getUserInfoFromCacheOrServer(this);
    };
    
    //---------------------------------------------------------------------------------------------
    // Auth Module
    //---------------------------------------------------------------------------------------------
    this.authLogin = function(data) {
        return _postAndSaveEula('_serverapi/auth_login.json', data, false);
    };

    this.authLogout = function() {
        return server.post('_serverapi/auth_logout.json', {}, true, true);
    };

    this.authEulaAck = function() {
        return server.post('_serverapi/auth_eula_ack.json', {});
    };

    this.authImpersonate = function(username) {
        return _postAndSaveEula('_serverapi/auth_impersonate.json', {username:username}, false);
    };

    this.authImpersonateEnd = function() {
        return server.post('_serverapi/auth_impersonate_end.json', {}, true);
    };
    
    this.authGetAuditData = function(updatedTill, limitBy) {
        var data = {};
        if (updatedTill !== undefined && updatedTill !== null) data.updatedTill = updatedTill;
        if (limitBy !== undefined && limitBy !== null) data.limitBy = limitBy;
        return server.post('_serverapi/auth_get_audit_data.json', data);
    };
    
    //---------------------------------------------------------------------------------------------
    // Course Module
    //---------------------------------------------------------------------------------------------
    this.courseGetList = function(mine) {
        // returns list of courseObjects
        return server.post('_serverapi/course_get_list.json', {mine: mine});
    };
    
    this.courseGet = function(courseId, published) {
        // return: courseObject
        return server.post('_serverapi/course_get.json', {courseid: courseId, published: published});
    };
    
    this.courseCreate = function(data) {
        // data: name, description, icon, content
        // return: courseObject
        return server.post('_serverapi/course_create.json', data);
    };
    
    this.courseModify = function(data) {
        // data: courseId, name, description, icon, content, publish
        // return: courseObject
        return server.post('_serverapi/course_modify.json', data);
    };
    
    this.courseDelete = function(courseId) {
        // return: true/false
        return server.post('_serverapi/course_delete.json', {courseid: courseId});
    };
    
    this.courseGetAssignmentList = function(mine) {
        // returns list of courseAssignmentObjects
        return server.post('_serverapi/course_get_assignment_list.json', {mine: mine});
    };


    this.courseGetAssignmentReportList = function(assignid) {
        // returns list of courseReportObjects
        return server.post('_serverapi/course_get_assignment_report_list.json', {assignid: assignid});
    };

    this.courseGetMyReportList = function() {
        // returns list of courseReportObjects
        return server.post('_serverapi/course_get_my_report_list.json', {});
    };

    this.courseGetReport = function(repid, mine) {
        // returns list of courseObjects
        return server.post('_serverapi/course_get_report.json', {repid: repid, mine: mine});
    };

    this.courseCreateLessonReport = function(repid, refid) {
        // returns the updated course report object
        return server.post('_serverapi/course_create_lesson_report.json', {repid: repid, refid: refid});
    };

    //---------------------------------------------------------------------------------------------
    // Private methods
    //---------------------------------------------------------------------------------------------
    function _getUserInfoFromCacheOrServer() {
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
                    _getUserInfoFromServer().then(resolve, reject);
                });
            });
        });
    };

    function _getUserInfoFromServer() {
        nl.log.debug('server_api: getUserInfoFromServer - enter');
        return nl.q(function(resolve, reject) {
            _ping().then(function() {
                nl.log.debug('server_api: getUserInfoFromServer - done');
                server.getUserInfoFromCache().then(resolve);
            }, reject);
        });
    }

    function _ping() {
        return _postAndSaveEula('_serverapi/auth_ping.json', {}, true);
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
                _postImpl(url, data)
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
        nl.log.info('server_api: posting: ', url);
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

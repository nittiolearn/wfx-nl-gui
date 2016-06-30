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
var NlServerApi = ['nl', 'nlDlg', 'nlConfig', 'Upload',
function(nl, nlDlg, nlConfig, Upload) {
    
    var server = new NlServerInterface(nl, nlDlg, nlConfig, Upload);

    //---------------------------------------------------------------------------------------------
    // Common methods
    //---------------------------------------------------------------------------------------------
    this.clearCache = function() {
        return nl.db.clear().then(function(res) {
            server.reinitUserInfo();
        });
    };

    this.getCurrentUserInfo = function() {
        return server.getCurrentUserInfo();
    };
    
    this.getUserInfoFromCache = function() {
        return server.getUserInfoFromCache();
    };

    this.getUserInfoFromCacheOrServer = function() {
        return _getUserInfoFromCacheOrServer(this);
    };
    
    this.executeRestApi = function(url, data) {
        // open API to execute any REST API (used from debug.js)
        // return: result of REST API
        return server.post(url, data);
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
    this.courseGetList = function(data) {
        // data: mine, search
        // returns list of course objects
        return server.post('_serverapi/course_get_list.json', data);
    };
    
    this.courseGet = function(courseId, published) {
        // return: course object
        return server.post('_serverapi/course_get.json', {courseid: courseId, published: published});
    };
    
    this.courseCreate = function(data) {
        // data: name, description, icon, content
        // return: course object
        return server.post('_serverapi/course_create.json', data);
    };
    
    this.courseModify = function(data) {
        // data: courseId, name, description, icon, content, publish
        // return: course object
        return server.post('_serverapi/course_modify.json', data);
    };
    
    this.courseDelete = function(courseId) {
        // return: true/false
        return server.post('_serverapi/course_delete.json', {courseid: courseId});
    };
    
	this.courseUnpublish = function(courseId) {
        // return: true/false
        return server.post('_serverapi/course_unpublish.json', {courseid: courseId});
    };

    this.courseAssignmentDelete = function(assignId) {
        // return: true/false
        return server.post('_serverapi/course_assignment_delete.json', {assignid: assignId});
    };
    
    this.courseGetAssignmentList = function(data) {
        // data: mine, search
        // returns list of courseAssignment objects
        return server.post('_serverapi/course_get_assignment_list.json', data);
    };
    
	this.courseGetAssignmentReportList = function(data) {
        // data: assignid, search
        // returns list of courseReport objects
        return server.post('_serverapi/course_get_assignment_report_list.json', data);
    };

    this.courseGetAssignmentReportSummary = function(data) {
        // data: assignid, search
        // returns object with course content and list of courseReport objects
        return server.post('_serverapi/course_get_assignment_report_summary.json', data);
    };

    this.courseGetMyReportList = function(data) {
        // data: search
        // returns list of courseReport objects
        return server.post('_serverapi/course_get_my_report_list.json', data);
    };

    this.courseGetReport = function(repid, mine) {
        // returns the courseReport object
        return server.post('_serverapi/course_get_report.json', {repid: repid, mine: mine});
    };
    
    this.courseReportUpdateStatus = function(repid, statusinfo) {
        // returns the updated course report object
        return server.post('_serverapi/course_report_update_status.json', {repid: repid, statusinfo: statusinfo});
    };

    this.courseCreateLessonReport = function(repid, refid, moduleid) {
        // returns the updated course report object
        return server.post('_serverapi/course_create_lesson_report.json', 
            {repid: repid, refid: refid, moduleid: moduleid});
    };
    
    //---------------------------------------------------------------------------------------------
    // Forum methods
    //---------------------------------------------------------------------------------------------
    this.forumCreateOrModifyMsg = function(data) {
        // returns list of forumMessages after creating/modifying
        return server.post('_serverapi/forum_create_or_modify_msg.json', data);
    };
    
    this.forumDeleteMsg = function(data) {
        // returns list of forumMessages after deleting current message
        return server.post('_serverapi/forum_delete_msg.json', data);
    };

    this.forumGetMsgs = function(data) {
        // returns list of forumMessages
        return server.post('_serverapi/forum_get_msgs.json', data);
    };
    
    //---------------------------------------------------------------------------------------------
    // Dashboard customization methods
    //---------------------------------------------------------------------------------------------
    this.dashboardGetList = function(data) {
        // data: mine, search
        // return: list of dashboardObjects
        return server.post('_serverapi/dashboard_get_list.json', data);
    };
    
    this.dashboardCreate = function(data) {
        // data: description, content
        // return: new dashboardObject
        return server.post('_serverapi/dashboard_create.json', data);
    };
    
    this.dashboardModify = function(data) {
        // data: dbid, description, content, publish
        // return: modified dashboardObject
        return server.post('_serverapi/dashboard_modify.json', data);
    };
    
    this.dashboardDelete = function(dbid) {
        // returns true/false
        return server.post('_serverapi/dashboard_delete.json', {dbid: dbid});
    };

    this.dashboardGetCards = function(dbid, published) {
        // return: list of dashboardObjects
        return server.post('_serverapi/dashboard_get_cards.json', {dbid: dbid, published: published});
    };

    //---------------------------------------------------------------------------------------------
	// search list entities
    //---------------------------------------------------------------------------------------------
    this.searchListGetList = function(data) {
        // data: mine, search
        // return: list of dashboardObjects
        return server.post('_serverapi/searchlist_getlist.json', data);
    };
    
    this.searchListCreate = function(data) {
        // data: name, description, config (JSON)
        // return: created searchlistObject
        return server.post('_serverapi/searchlist_create.json', data);
    };
    
    this.searchListModify = function(data) {
        // data: id, name, description, config (JSON)
        // return: modified searchlistObject
        return server.post('_serverapi/searchlist_modify.json', data);
    };

    this.searchListDelete = function(searchlist_id) {
        // returns true/false
        return server.post('_serverapi/searchlist_delete.json', {id: searchlist_id});
    };

    this.searchListView = function(searchlist_id, force, max) {
        // return: searchlistObject
        if (!force) force = false;
        var data = {id: searchlist_id, force: force};
        if (max) data.max = max;
        return server.post('_serverapi/searchlist_view.json', data);
    };

    //---------------------------------------------------------------------------------------------
    // Rno (Rating and observation) Module
    //---------------------------------------------------------------------------------------------
    this.rnoGetMetadata = function(metadataid) {
        return server.post('_serverapi/rno_meta_get.json', {id:metadataid});
    };

    this.rnoGetList = function(data) {
        // data: metadata, role, search
        return server.post('_serverapi/rno_get_list.json', data);
    };

    this.rnoCreate = function(data) {
        // data: metadata, config (first_name, last_name, email, user_type, image, ...), observer, reviewer
        // return: rno object
        return server.post('_serverapi/rno_create.json', data);
    };

    this.rnoModify = function(data) {
        // data: id, metadata, config (first_name, last_name, email, user_type, image, ...), observer, reviewer
        // return: modified rno object
        return server.post('_serverapi/rno_modify.json', data);
    };

    this.rnoDelete = function(rnoId) {
        // return: true/false
        return server.post('_serverapi/rno_delete.json', {id: rnoId});
    };

    this.rnoGetData = function(rnoId, reportKey) {
        // return: rno data JSON
        return server.post('_serverapi/rno_get_data.json', {id: rnoId, report_key: reportKey});
    };

    this.rnoUpdateData = function(rnoId, data, send) {
        // return: updated rno data JSON
        return server.post('_serverapi/rno_update_data.json', 
            {id: rnoId, data:data, send:send});
    };

    //---------------------------------------------------------------------------------------------
    // SCO Module (SCORM)
    //---------------------------------------------------------------------------------------------
    this.scoExport = function(data) {
        // return: lesson html and list of resources
        return server.post('_serverapi/sco_export.json', data);
    };
    
    //---------------------------------------------------------------------------------------------
	// assignment desk list entities
    //---------------------------------------------------------------------------------------------
    this.assignmentGetMyList = function(data) {
        // data: bPast, custtype, search
        // return: list of assignment reports
        return server.post('_serverapi/assignment_get_my_list.json', data);
    };

	this.assignmentGetSharedList = function(data) {
        // data: custtype, search
        // return: list of assignment reports
        return server.post('_serverapi/assignment_get_shared_list.json', data);
	};

	this.assignmentGetSentList = function(data) {
        // data: mine, custtype, search
        // return: list of assignments
        return server.post('_serverapi/assignment_get_sent_list.json', data);
	};
	this.assignmentDelete = function(assignId){
		//Delete the specific assignment.
        return server.post('_serverapi/assignment_delete.json', {assignid: assignId});		
	};

	this.assignmentPublish = function(assignId){
        // assignid = assignId		
		//publish the specific assignment.
        return server.post('_serverapi/assignment_publish.json', {assignid: assignId});		
	};

	this.checkPastAssignments = function(data) {
        // data = lessonid, {{and other parameters - please expand}}		
		//send assignment.
        return server.post('_serverapi/check_past_assignments.json', data);		
	};

	this.assignmentSend = function(data){
        // data = lessonid, {{and other parameters - please expand}}		
	//send assignment.
        return server.post('_serverapi/assignment_send.json', data);		
	};

	this.assignmentReport = function(data){
		//data = assignid
		//assignment_reports
		return server.post('_serverapi/assignment_get_reports.json', data);
	};
	
	this.assignmentSharedUsers = function(data){
		//data = repid
		//assignment_shared_users
		return server.post('_serverapi/assignment_shared_users.json', data);		
	};

	this.assignmentUpdateSharedUsers = function(data){
		//data = repid, sharedUsers
		//assignment_shared_users
		return server.post('_serverapi/assignment_update_shared_users.json', data);		
	};
	
    //---------------------------------------------------------------------------------------------
	// get group user entities
    //---------------------------------------------------------------------------------------------

	this.getOuList = function() {
    	//Mark completion of lesson review
        return server.post('_serverapi/group_get_ou_tree.json', {});
	};

	this.getOuUserList = function(data) {
    	//data: oulist
    	//Mark completion of lesson review
        return server.post('_serverapi/group_get_users.json', data);
	};

    //---------------------------------------------------------------------------------------------
	// lesson entities
    //---------------------------------------------------------------------------------------------
	this.lessonGetApprovedList = function(data) {
        // data: custtype, search, grade
        // return: list of approved lessons matching the filter
        return server.post('_serverapi/lesson_get_approved_list.json', data);				
	};

	this.lessonGetPrivateList = function(data) {
        // data: custtype, search, grade
        // return: list of my lessons lessons matching the filter
        return server.post('_serverapi/lesson_get_private_list.json', data);				
	};

	this.lessonGetReviewList = function(data) {
        // data: custtype, search, grade
        // return: list of lessons for my review matching the filter
        return server.post('_serverapi/lesson_get_review_list.json', data);				
	};

	this.lessonGetManageApprovedList = function(data) {
        // data: custtype, search, grade
        // return: list of approved lessons within the group matching the filter
        return server.post('_serverapi/lesson_get_manage_approved_list.json', data);				
	};

	this.lessonGetTemplateList = function(data) {
        // data: custtype, search, grade
        // return: list of lesson templates matching the filter
        return server.post('_serverapi/lesson_get_template_list.json', data);				
	};

	this.lessonDelete = function(lessonId) {
    //lessonid = lessonId
    //returns the list without deleted lesson
        return server.post('_serverapi/lesson_delete.json', {lessonid : lessonId});				
	};

	this.lessonCopy = function(data) {
        // data: lessonId, private=true/false
        //copy the lesson (private version of lesson or approved version of lesson)
        return server.post('_serverapi/lesson_copy.json', data);
	};

	this.lessonPreApproveCheck = function(lessonId){
	    //data = lessonid
	    //copy the lesson
		return server.post('_serverapi/lesson_preapprove_check.json', {lessonid : lessonId});
	};
	
	this.lessonApprove = function(data) {
        // data: lessonId, exportLevel, selectedOus.
        // return: list with approved lesson removed.
        return server.post('_serverapi/lesson_approve.json', data);
	};
	
	this.lessonDisapprove = function(lessonId) {
        // data: lessonId
        // return: list with disapproved lesson removed.
        return server.post('_serverapi/lesson_disapprove.json', {lessonid : lessonId});
	};
	
	this.lessonReopenReview = function(lessonId) {
    	//data: lessonId
    	//Mark completion of lesson review
        return server.post('_serverapi/lesson_reopen.json', {lessonid: lessonId});
	};
	
	this.lessonCloseReview = function(lessonId) {
    	//data: lessonId
    	//Mark completion of lesson review
        return server.post('_serverapi/lesson_closereview.json', {lessonid: lessonId});
	};
	
	this.lessonGetContent = function(dbid, ctx) {
       return server.post('_serverapi/lesson_get_content.json', {dbid: dbid, ctx: ctx});	    
	}

    //---------------------------------------------------------------------------------------------
    // resource entities
    //---------------------------------------------------------------------------------------------
    this.resourceUpload = function(data, urltype) {
        // Upload a resource - could be basic upload or upload and do something more based
        // on url type
        if (urltype === undefined) urltype = 'upload';
        return nl.q(function(resolve, reject) {
            server.post('_serverapi/resource_get_upload_url.json', {urltype: urltype})
            .then(function(uploadUrl) {
                var reloadUserInfo = false;
                var noPopup = false;
                var upload = true;
                server.post(uploadUrl, data, reloadUserInfo, noPopup, upload)
                .then(resolve, reject);
            }, reject);
        });
    };

    this.resourceUploadPdf = function(data) {
        return this.resourceUpload(data, 'upload_pdf');
    };

	this.resourceGetList = function(data){
		//data: mine, searchfilter
        return server.post('_serverapi/resource_get_list.json', data);
	};

	this.resourceDelete = function(resId){
        return server.post('_serverapi/resource_delete.json', {resid: resId});
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
        return _postAndSaveEula('_serverapi/auth_ping.json', {}, false);
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

function NlServerInterface(nl, nlDlg, nlConfig, Upload) {

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

    this.getCurrentUserInfo = function() {
        return this.currentUserInfo;
    };
    
    this.reinitUserInfo = function() {
        this.initDone = false;
        _initUserInfo(this);
    };
    
    this.post = function(url, data, reloadUserInfo, noPopup, upload) {
        reloadUserInfo = (reloadUserInfo == true);
        noPopup = (noPopup == true);
        upload = (upload == true);
        var self = this;
        var progressFn = null;
        if ('progressFn' in data) {
            progressFn = data.progressFn;
            delete data.progressFn;
        }
        return nl.q(function(resolve, reject) {
            self.getUserInfoFromCache().then(function(userInfo) {
                data._u = reloadUserInfo ? 'NOT_DEFINED' : userInfo.username;
                data._v = NL_SERVER_INFO.versions.script;
                if ('updated' in userInfo) data._ts = nl.fmt.json2Date(userInfo.updated);
                if (!upload) url = NL_SERVER_INFO.url + url;
                _postImpl(url, data, upload).then(
                function success(data) {
                    _processResponse(self, data.data, data.status, resolve, reject, noPopup);
                }, function error(data) {
                    _processResponse(self, data.data, data.status, resolve, reject, noPopup);
                }, function progress(evt) {
                    // Only in case of upload
                    var prog = parseInt(100.0 * evt.loaded / evt.total);
                    var resName = evt.config.data.resource.name;
                    if (progressFn) progressFn(prog, resName);
                });
            });
        });
    };
    
    //----------------------------------------------------------------------------------------------
    // Private methods
    function _defaultUserInfo() {
        return {username: '', lastupdated: null, groupicon: nl.url.resUrl('general/top-logo1.png'), dashboard: []};
    }
    
    var AJAX_TIMEOUT = 3*60*1000; // 3 mins timeout
    function _postImpl(url, data, upload) {
        nl.log.info('server_api: posting: ', url);
        if (NL_SERVER_INFO.serverType == 'local') return nl.http.get(url); // For local testing
        if (upload) return Upload.upload({url: url, data: data, timeout: AJAX_TIMEOUT});
        return nl.http.post(url, data, {timeout: AJAX_TIMEOUT});
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
        if (data == null || data == undefined) {
            data = {_errorMsg: nl.t('Error connecting to the server. Please check if your internet connection is working.')};
        }
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

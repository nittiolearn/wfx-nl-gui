(function() {

//-------------------------------------------------------------------------------------------------
// server_api.js:
// All Server side interfaces are collected in a single service
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.server_api', [])
    .service('nlServerApi', NlServerApi);
}

var g_noPopup = false;
var DEFAULT_CACHE_LIFE = 1000*3600; // In milliseconds

//-------------------------------------------------------------------------------------------------
var NlServerApi = ['nl', 'nlDlg', 'nlConfig', 'Upload',
function(nl, nlDlg, nlConfig, Upload) {
    
    var _brandingInfoHandler = new BrandingInfoHandler();
    var server = new NlServerInterface(nl, nlDlg, nlConfig, Upload, _brandingInfoHandler);

    //---------------------------------------------------------------------------------------------
    // Common methods
    //---------------------------------------------------------------------------------------------
    this.noPopup = function(bNoPopup) {
        g_noPopup = bNoPopup;
    };

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
    
    this.executeRestApi = function(url, data, reloadUserInfo, noPopup, serverType) {
        // open API to execute any REST API (used from debug.js)
        // return: result of REST API
        var config = {reloadUserInfo: reloadUserInfo, noPopup: noPopup, serverType: serverType};
        return server.post(url, data, config);
    };
    
    this.getBrandingInfo = function() {
    	return _brandingInfoHandler.getInfo();
    };

    this.updateBrandingInfoWithGroupId = function(data) {
        return _postWithReoadUserData('_serverapi/update_branding_info.json', data, false);
    };
    
    //---------------------------------------------------------------------------------------------
    // Auth Module
    //---------------------------------------------------------------------------------------------
    this.authLogin = function(data) {
        return _postWithReoadUserData('_serverapi/auth_login.json', data, false);
    };

    this.authLogout = function() {
        var config = {reloadUserInfo: true, noPopup: true};
        return server.post('_serverapi/auth_logout.json', {}, config);
    };

    this.authUpdateSettings = function(settings) {
        return server.post('_serverapi/auth_update_settings.json', {settings: settings});
    };

    this.authPwLost = function(username) {
        return server.post('_serverapi/auth_pwlost.json', {username: username});
    };

    this.authPwSelfReset = function(data) {
        return server.post('_serverapi/auth_pw_self_reset.json', data);
    };

    this.authImpersonate = function(username) {
        return _postWithReoadUserData('_serverapi/auth_impersonate.json', {username:username}, false);
    };

    this.authImpersonateEnd = function() {
        return server.post('_serverapi/auth_impersonate_end.json', {}, true);
    };

    this.authValidateResetKey = function(data) {
        return server.post('_serverapi/auth_validate_reset_key.json', data);
    }
    
    this.authGetAuditData = function(data) {
        return server.post('_serverapi/auth_get_audit_data.json', data);
    };
    
    this.authDemoRequest = function(data) {
        // data: name,email,phone,website,description
        // returns true or false
        return server.post('_serverapi/auth_register_demo.json', data);
    };

    //---------------------------------------------------------------------------------------------
    // Course Module
    //---------------------------------------------------------------------------------------------
    this.courseGetList = function(data) {
        // data: mine, search
        // returns list of course objects
        return server.post('_serverapi/course_get_list.json', data);
    };
    
    this.courseGet = function(courseId, published, restoreid) {
        // return: course object
        var data = {courseid: courseId, published: published};
        if(restoreid) data.restoreid = restoreid;
        return server.post('_serverapi/course_get.json', data);
    };

    this.courseOrAssignGetMany = function(recordinfos) {
        // return: course, course_assignment and module assignment objects
        return server.post('_serverapi/course_or_assign_get_many.json', {recordinfos: recordinfos});
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

    this.courseAssignmentDelete = function(assignId, max_delete) {
        // return: true/false
        return server.post('_serverapi/course_assignment_delete.json', {assignid: assignId, max_delete: max_delete});
    };
    
    this.courseGetAssignmentList = function(data) {
        // data: mine, search
        // returns list of courseAssignment objects
        return server.post('_serverapi/course_get_assignment_list.json', data);
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
    
    this.courseReportUpdateStatus = function(repid, statusinfo, completed) {
        // returns the updated course report object
        var data = {repid: repid, statusinfo: statusinfo, completed: completed};
        return server.post('_serverapi/course_report_update_status.json', data);
    };

    this.courseCreateLessonReport = function(repid, refid, moduleid, attempt, maxDuration, starttime, endtime, updateStartTime, targetLang) {
        // returns the updated course report object
        return server.post('_serverapi/course_create_lesson_report.json', 
            {repid: repid, refid: refid, moduleid: moduleid, attempt: attempt, maxDuration: maxDuration, not_before:starttime, not_after:endtime, updateStart: updateStartTime, targetLang: targetLang});
    };

    this.courseUpdateLessonReportTimes = function(repid, moduleid, lessonreportinfo, completed) {
        // returns the updated course report object
        return server.post('_serverapi/course_update_lesson_report_times.json', 
            {repid: repid, moduleid: moduleid, lessonreportinfo: lessonreportinfo, mine: true, completed: completed});
    };
    
    this.courseUpdateParams = function(data){
        // returns updated attendance/milestone/rating object
        return server.post('_serverapi/course_update_params.json', data);
	};

    this.courseSaveOrSubmitLessonReport = function(data) {
        // returns the updated lessonReport
        return server.post('_serverapi/course_save_or_submit_lesson_report.json', data);
    };

    this.courseUpdateStatus = function(repid, completed) {
        // returns updated repObj
        return server.post('_serverapi/course_update_status.json', {repid: repid, completed: completed});
    }
    this.courseUpdateReportLanguage = function(repid, lang) {
        return server.post('_serverapi/course_update_report_language.json', {repid: repid, targetLang: lang});
    } 
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
    // SearchCache Module
    //---------------------------------------------------------------------------------------------
    this.searchCacheGetInfo = function(data) {
        return server.post('_serverapi/search_cache_get_info.json', data);
    };

    this.searchCacheGetJson = function(cachetype, cacheid) {
        var url = nl.fmt2('_serverapi/search_cache_get_json.json?cachetype={}&cacheid={}', cachetype, cacheid);
        return nl.http.get(url);
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
    // SCO Module (SCORM)
    //---------------------------------------------------------------------------------------------
    this.scoExport = function(data) {
        // return: lesson html and list of resources
        return server.post('_serverapi/sco_export.json', data);
    };
    
    this.scoGetManifestList = function(data) {
        // returns list of manifest ids of imported sco content for this group
        return server.post('_serverapi/sco_get_manifest_list.json', data);
    };

    this.scoUpdateManifest = function(data) {
        // create or modify Manifest information
        // return: unique key for this manifest
        return server.post('_serverapi/sco_update_manifest.json', data);
    };

    this.scoDeleteManifest = function(manifestId) {
        // delete Manifest information
        // return: true/false
        return server.post('_serverapi/sco_delete_manifest.json', {id: manifestId});
    };

    this.scoGetManifestData = function(manifestId) {
        // delete Manifest information
        // return: manifestDataJson
        return server.post('_serverapi/sco_get_manifest_data.json', {id: manifestId});
    };

    //---------------------------------------------------------------------------------------------
	// assignment desk list entities
    //---------------------------------------------------------------------------------------------
    this.assignmentGetMyList = function(data) {
        // data: bPast, custtype, search
        // return: list of assignment reports
        return server.post('_serverapi/assignment_get_my_list.json', data);
    };

	this.assignmentGetSentList = function(data) {
        // data: mine, custtype, search
        // return: list of assignments
        return server.post('_serverapi/assignment_get_sent_list.json', data);
	};
	this.assignmentDelete = function(assignId, max_delete){
		//Delete the specific assignment.
        return server.post('_serverapi/assignment_delete.json', {assignid: assignId, max_delete: max_delete});		
	};

	this.assignmentPublish = function(assignId){
        // assignid = assignId		
		//publish the specific assignment.
        return server.post('_serverapi/assignment_publish.json', {assignid: assignId});		
	};

	this.assignmentSend = function(data){
        return server.post('_serverapi/assignment_send.json', data);		
	};

	this.assignmentModify = function(data){
        return server.post('_serverapi/assignment_modify.json', data);		
	};

	this.sendReminderNotification = function(data){
        return server.post('_serverapi/send_reminder_nofication.json', data);
	};

	this.learningReportsGetList = function(data) {
		//data = type, objid, assignor, parentonly, [filterParameters], [mquery parameters]
		return server.post('_serverapi/learning_reports_get_list.json', data);
	};
	
	this.learningReportsGetCompletedModuleList = function(data) {
		//data = [mquery parameters]
		return server.post('_serverapi/learning_reports_get_completed_module_list.json', data);
	};

    this.learningReportsImport = function(data) {
		return server.post('_serverapi/learning_reports_import.json', data);
	};

    this.learningReportDelete = function(data) {
        // return: status info array
        return server.post('_serverapi/learning_report_delete.json', data);
    };

    //---------------------------------------------------------------------------------------------
	// get group user entities
    //---------------------------------------------------------------------------------------------
	this.groupGetInfo3 = function(data) {
        return server.post('_serverapi/group_get_info3.json', data);     
	};

    this.groupUpdateUsers = function(grp, data) {
        //grp = id of the group
        //data = array of user updation records (one row of import CSV file)
        return server.post('_serverapi/group_update_users.json', {grp:grp, data:data});     
    };

    this.groupUpdateOrgTree = function(grp, data) {
        return server.post('_serverapi/group_update_org_tree.json', {grp:grp, data:data});
    };

    this.groupGetList = function(data) {
        return server.post('_serverapi/group_get_list.json', data);     
    };
    //---------------------------------------------------------------------------------------------
	// get announcement entities
    //---------------------------------------------------------------------------------------------
	this.getAnnouncementList = function(data) {
        // return: list of announcement 
        return server.post('_serverapi/announcement_get_list.json', data);				
	};

	this.createAnnouncement = function(data) {
        // return: create new announcement data = {title: 'xx', desc: 'xx', resource = {img: '', video: ''}}
        // return announcement record created newly
        return server.post('_serverapi/announcement_create.json', data);				
	};

	this.updateAnnouncement = function(data) {
        // return: create new announcement data={id: "xx", title: 'xx', desc: 'xx', resource = {img: '', video: ''}}
        // return updated announcement record,
        return server.post('_serverapi/announcement_modify.json', data);				
	};

	this.deleteAnnouncement = function(data) {
        // return: create new announcement data = {id: 'xx'}
        // return updated announcement record,
        return server.post('_serverapi/announcement_delete.json', data);				
	};

    //---------------------------------------------------------------------------------------------
	// group_settings entities
    //---------------------------------------------------------------------------------------------
	this.getGroupSettings = function(data) {
        // data = {settings_types: ['nht_views', 'lr_views']}; returns dict of settings_type to group_settings object
        return server.post('_serverapi/group_settings_get.json', data);				
	};

	this.updateGroupSettings = function(data) {
        // data = {settings_type: 'xx', info: obj}; returns True or error
        return server.post('_serverapi/group_settings_update.json', data);				
	};

    //---------------------------------------------------------------------------------------------
	// lesson entities
    //---------------------------------------------------------------------------------------------
	this.lessonGetApprovedList = function(data) {
        // return: list of approved lessons matching the filter
        return server.post('_serverapi/lesson_get_approved_list.json', data);				
	};

	this.lessonGetPrivateList = function(data) {
        // return: list of my lessons lessons matching the filter
        return server.post('_serverapi/lesson_get_private_list.json', data);				
	};

	this.lessonGetReviewList = function(data) {
        // return: list of lessons for my review matching the filter
        return server.post('_serverapi/lesson_get_review_list.json', data);				
	};

	this.lessonGetManageApprovedList = function(data) {
        // return: list of approved lessons within the group matching the filter
        return server.post('_serverapi/lesson_get_manage_approved_list.json', data);				
	};

	this.lessonGetTemplateList = function(data) {
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

	this.lessonSave = function(data) {
        // data: lessonId(=0 for new lesson), content=json
        //returns the lessonId
        return server.post('_serverapi/lesson_save.json', data);
	};

	this.lessonPreApproveCheck = function(lessonId){
	    //data = lessonid
	    //copy the lesson
		return server.post('_serverapi/lesson_preapprove_check.json', {lessonid : lessonId});
	};
	
	this.lessonApprove = function(data) {
        // data: lessonid, exportLevel, selectedOus.
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
	
	this.lessonInviteReview = function(data) {
    	//Share module for review
        return server.post('_serverapi/lesson_invite_review.json', data);
		
	};
	
	this.lessonCloseReview = function(lessonId) {
    	//data: lessonId
    	//Mark completion of lesson review
        return server.post('_serverapi/lesson_closereview.json', {lessonid: lessonId});
	};
	
	this.lessonGetContent = function(dbid, ctx) {
       return server.post('_serverapi/lesson_get_content.json', {dbid: dbid, ctx: ctx});	    
	};

    this.lessonCreate = function(template, isTemplate, name, section0) {
       return server.post('_serverapi/lesson_create.json', {template: template, 
           isTemplate: isTemplate, name: name, section0: section0});
    };

    this.lessonGetResourceLibrary = function(templateids, lessonid) {
       return server.post('_serverapi/lesson_get_resource_library.json', {templateids: templateids, lessonid: lessonid});
    };

    this.lessonUpdateResourceLibrary = function(data) {
       return server.post('_serverapi/lesson_update_resource_library.json', data);
    };
    
    this.changeOwner = function(data) {
    	return server.post('_serverapi/change_owner.json', data);
    };
    //---------------------------------------------------------------------------------------------
    // Content metadata
    //---------------------------------------------------------------------------------------------
    this.cmGetFields = function() {
        return _getFromCacheOrServer('contentmeta_get_fields', DEFAULT_CACHE_LIFE, 
           '_serverapi/contentmeta_get_fields.json', {}, true);
    };
    
    this.cmGet = function(cid, ctype) {
        return server.post('_serverapi/contentmeta_get.json', 
            {cid: cid, ctype: ctype});
    };

    this.cmSet = function(cid, ctype, metadata) {
        return server.post('_serverapi/contentmeta_set.json', 
            {cid: cid, ctype: ctype, metadata: metadata});
    };

    //---------------------------------------------------------------------------------------------
	//offline training entities
    //---------------------------------------------------------------------------------------------
	this.getTrainingList = function(params) {
        return server.post('_serverapi/training_get_list.json', params);
	};

	this.trainingCreate = function(data){
        return server.post('_serverapi/training_create.json', 
            data);
	};

	this.trainingModify = function(data){
        return server.post('_serverapi/training_modify.json', 
            data);
	};

	this.trainingDelete = function(id){
        return server.post('_serverapi/training_delete.json', {id: id});
	};

	this.getTrainingReportList = function(data){
		return server.post('_serverapi/training_get_report_list.json',
				data);
	};

	this.trainingUpdateAttendance = function(data) {
		return server.post('_serverapi/training_update_attendance.json',
				data);
	};

	this.trainingCreateChildReport = function(data) {
		return server.post('_serverapi/training_create_child_report.json',
				data);
	};

    //---------------------------------------------------------------------------------------------
	//training kind entities
    //---------------------------------------------------------------------------------------------
	this.getTrainingkindList = function () {
		return server.post('_serverapi/training_kind_get_list.json',
				{});
	};

	this.createTrainingkind = function(data) {
		return server.post('_serverapi/training_kind_create.json',
				data);
	};
	
	this.modifyTrainingkind = function(data) {
		return server.post('_serverapi/training_kind_modify.json',
				data);
	};

	this.deleteTrainingkind = function() {
		return server.post('_serverapi/training_kind_delete.json',
				data);
	};
    //---------------------------------------------------------------------------------------------
    // autovoice entities
    //---------------------------------------------------------------------------------------------
	this.getAudioUrl = function(data) {
		return server.post('_serverapi/auto_voice.json', data);
	};
    //---------------------------------------------------------------------------------------------
    // resource entities
    //---------------------------------------------------------------------------------------------
    this.resourceModifyAttrs = function(data) {
		return server.post('_serverapi/resource_modify_attrs.json', data);
    };
    
    // TODO-LATER: remove after moving PDF upload and autovoice to "gcsresumable"
    this.resourceUpload = function(data, urltype) {
        // Upload a resource - could be basic upload or upload and do something more based
        // on url type
        if (urltype === undefined) urltype = 'upload';
        return nl.q(function(resolve, reject) {
            server.post('_serverapi/resource_get_upload_url.json', {urltype: urltype})
            .then(function(uploadUrl) {
                var config = {upload: true};
                server.post(uploadUrl, data, config).then(resolve, reject);
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

    this.resourceDeleteBulk = function(insertfrom) {
        return server.post('_serverapi/resource_delete_bulk.json', {insertfrom: insertfrom});
    };

	this.courseExportReports = function(assignIds) {
		return server.post('_serverapi/course_export_reports.json', {assignids: assignIds});
	};
	
	this.courseExportCourses = function(courseIds) {
		return server.post('_serverapi/course_export_courses.json', {courseids: courseIds});
	};

    this.recyclebinList = function(params) {
        return server.post('_serverapi/recycle_get_list.json', params);
    };

    this.recyclebinRestore = function(recycleid, max_record) {
        return server.post('_serverapi/recycle_restore.json', {recycleid: recycleid, max_record: max_record});
    };
    //---------------------------------------------------------------------------------------------
    // translate text entities
    //---------------------------------------------------------------------------------------------
    
    this.translateTexts = function(data) {
    	return server.post('_serverapi/translate_texts.json', {data: data});
    };

    //---------------------------------------------------------------------------------------------
    // Utility for page and batch query
    //---------------------------------------------------------------------------------------------

    this.getPageFetcher = function(attrs) {
        return new PageFetcher(nl, nlDlg, attrs);
    };

    //---------------------------------------------------------------------------------------------
    // Unarchive the users
    //---------------------------------------------------------------------------------------------
    this.groupUpdateDeletedAttrOfUsers = function(data) {
        return server.post('_serverapi/group_update_deleted_attr_of_users.json', data);
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
        return _postWithReoadUserData('_serverapi/auth_ping.json', {showExtendedStatusCode: true}, true);
    }

    function _postWithReoadUserData(url, data, noPopup) {
        var config = {reloadUserInfo: true, noPopup: noPopup};
        return server.post(url, data, config);
    }

    function _cachedPost(cacheKey, addTimestamp, url, data, cachedValue) {
        return nl.q(function(resolve, reject) {
            server.post(url, data)
            .then(function(result) {
                if (result && result.reuse_cache && cachedValue !== undefined) {
                    resolve(cachedValue);
                } else {
                    var store = result;
                    if (addTimestamp) store = {updated: new Date(), data: result};
                    nlConfig.saveToDb(cacheKey, store, function() {
                        resolve(result);
                    });
                }
            }, function(err) {
                reject(err);
            });
        });
    }
    
    function _getFromCacheOrServer(cacheKey, cacheLife, url, data) {
        return nl.q(function(resolve, reject) {
            nlConfig.loadFromDb(cacheKey, function(result) {
                var cachedValue = undefined;
                if (result !== null) {
                    var now = new Date();
                    if (now - result.updated < cacheLife) {
                        nl.log.debug('server_api.cached: Cache is returned', cacheKey);
                        resolve(result.data);
                        return;
                    }
                    cachedValue = result.data;
                    if (cachedValue.versionstamp) data.versionstamp = cachedValue.versionstamp;
                    nl.log.info('server_api.cached: Cache might be stale', cacheKey);
                }
                _cachedPost(cacheKey, true, url, data, cachedValue)
                .then(function(result) {
                    nl.log.info('server_api.cached: Data fetched from server', cacheKey);
                    resolve(result);
                }, function(err) {
                    reject(err);
                });
            });
        });
    }
}];

function NlServerInterface(nl, nlDlg, nlConfig, Upload, brandingInfoHandler) {
	var _brandingInfoHandler = brandingInfoHandler;

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
    
    this.post = function(url, data, config) {
        if (!config) config = {};
        var reloadUserInfo = (config.reloadUserInfo == true);
        var noPopup = (config.noPopup == true || g_noPopup == true || data._jsMaxRetries);
        var upload = (config.upload == true);
        var serverType = config.serverType || 'default';

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
                if (serverType == 'api3' && userInfo.api3) data._token = userInfo.api3.token;
                if (!upload) url = _getBaseUrl(serverType, userInfo) + url;
                _postImpl(url, data, upload, serverType).then(
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
        return {username: '', lastupdated: null, groupicon: nl.url.resUrl('general/top-logo2.png'), dashboard: []};
    }

    function _getBaseUrl(serverType, userInfo) {
        if (serverType == 'api3' && userInfo.api3 && userInfo.api3.url) return userInfo.api3.url + '/';
        return NL_SERVER_INFO.url;
    }
    
    var AJAX_TIMEOUT = 3*60*1000; // 3 mins timeout
    var api3RequestHeaders = {'Content-Type':'text/plain'};
    function _postImpl(url, data, upload, serverType) {
        nl.log.info('server_api: posting: ', url);
        if (upload) return Upload.upload({url: url, data: data, timeout: AJAX_TIMEOUT});
        if (serverType == "api3"){
            return nl.http.post(url, data, {timeout: AJAX_TIMEOUT, headers: api3RequestHeaders});
        }else{
            return nl.http.post(url, data, {timeout: AJAX_TIMEOUT});
        }
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
            if ('brandingInfoJson' in data) _brandingInfoHandler.update(data['brandingInfoJson']);
            
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
        var errorMsg = data._errorMsg || ET_ERROR_MESSAGES[status];
        var extendedStatusCode = data._extendedStatusCode;
        var rejectData = errorMsg;
        if (data._extendedStatusCode) rejectData = {msg: errorMsg, extendedStatusCode: extendedStatusCode};

        nl.log.warn('_displayErrorMessage:', errorMsg, status);
        if (noPopup) {
            reject(rejectData);
            return;
        }
        nlDlg.popupAlert({title: 'Alert', template: errorMsg})
        .then(function(res) {
            reject(rejectData);
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

//----------------------------------------------------------------------------------------------
function PageFetcher(nl, nlDlg, attrs) {
    if (!attrs) attrs = {};
    var urlParams = nl.location.search();
    var _max = ('max' in urlParams) ? parseInt(urlParams.max) : attrs.defMax || 50;
    var _itemType = attrs.itemType || 'item';
    var _blockTillDone = attrs.blockTillDone || false;

    var _fetchInProgress = false;
    var _canFetchMore = true;
    var _nextStartPos = null;
    this.fetchInProgress = function() { return _fetchInProgress;};
    this.canFetchMore = function() { return _canFetchMore;};

    var _fetchLimit = undefined;
    var _fetchedCount = 0;
    var _retryCount = 0;
    this.fetchPage = function(listingFn, params, fetchMore, callback, dontHideLoading) {
        _fetchLimit = undefined;
        _fetchedCount = 0;
        nlDlg.showLoadingScreen();
        return _fetchPageImpl(listingFn, params, fetchMore, callback, dontHideLoading);
    };

    this.fetchBatchOfPages = function(listingFn, params, fetchMore, callback, fetchLimit, dontHideLoading) {
        _fetchLimit = fetchLimit;
        _fetchedCount = 0;
        _retryCount = 0;
        nlDlg.showLoadingScreen();
        function _batchCallback(results, batchDone, rawResp) {
            if (_retryIfNeeded(results, batchDone)) return;
            var promiseHolder = {};
            callback(results, batchDone, promiseHolder, rawResp);
            if (!results || batchDone) return;
            if (!promiseHolder.promise)
                _fetchPageImpl(listingFn, params, true, _batchCallback, dontHideLoading);
            else {
                promiseHolder.promise.then(function(result) {
                    if (!result) return;
                    _fetchPageImpl(listingFn, params, true, _batchCallback, dontHideLoading);
                });
            }
        }

        function _retryIfNeeded(results, batchDone) {
            if (!params._jsMaxRetries) return false;
            if (results) {
                _retryCount = 0;
                return false;
            }
            if (_retryCount >= params._jsMaxRetries) {
                nlDlg.popdownStatus(0);
                _fetchInProgress = false;
                _canFetchMore = true;
                return false;
            }
            var timeOut = _retryCount*2000;
            _retryCount++;
            if (timeOut == 0) {
                _fetchPageImpl(listingFn, params, true, _batchCallback, dontHideLoading);
            } else {
                nl.timeout(function() {
                    _fetchPageImpl(listingFn, params, true, _batchCallback, dontHideLoading);
                }, timeOut);
            }
            return true;
        }

        return _fetchPageImpl(listingFn, params, fetchMore, _batchCallback, dontHideLoading);
    };

    var IN_PROG_MSG = 'Fetching from server ...';
    var MORE_MSG = 'You could fetch more if needed.';
    
    function _fetchPageImpl(listingFn, params, fetchMore, callback, dontHideLoading) {
        _fetchInProgress = true;
        if (!fetchMore) _nextStartPos = null;
        if (!params.max) params.max = _max;
        params.startpos = _nextStartPos;
        if (!attrs.noStatus) nlDlg.popupStatus(IN_PROG_MSG, false);
        listingFn(params).then(function(resp) {
            if (!dontHideLoading && (!_blockTillDone || !resp.more)) nlDlg.hideLoadingScreen();
            _nextStartPos = resp.nextstartpos;
            _canFetchMore = resp.more;
            _fetchedCount += resp.resultset.length;
            var batchDone = _fetchLimit === undefined ? true
                : !_canFetchMore || (_fetchLimit !== null && _fetchLimit <= _fetchedCount);
            if (batchDone) {
                var msg = _canFetchMore ? MORE_MSG : '';
                if (!attrs.noStatus) nlDlg.popupStatus(msg);
                _fetchInProgress = false;
            }
            callback(resp.resultset, batchDone, resp);
        }, function(error) {
            if (!('_jsMaxRetries' in params)) {
                nlDlg.popdownStatus(0);
                _fetchInProgress = false;
            }
            callback(false);
        });
    }
}
    
//----------------------------------------------------------------------------------------------
function BrandingInfoHandler() {
	this._brandingInfo = angular.fromJson(NL_BRANDING_INFO);
	this.getInfo = function() {
		return this._brandingInfo;
	};
	this.update = function(bInfoJson) {
		this._brandingInfo = angular.fromJson(bInfoJson);
	};
}

//----------------------------------------------------------------------------------------------
module_init();
})();

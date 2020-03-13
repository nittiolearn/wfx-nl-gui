(function() {

//-------------------------------------------------------------------------------------------------
// assignment_send_srv.js:
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.send_assignment_srv', []).config(configFn)
    .controller('nl.AssignmentSendCtrl', SendAssignmentCtrl)
    .service('nlSendAssignmentSrv', SendAssignmentSrv);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.assignment_send', {
        url : '^/assignment_send',
        views : {
            'appContent' : {
                template : '',
                controller : 'nl.AssignmentSendCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var SendAssignmentCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlServerApi', 'nlSendAssignmentSrv',
function(nl, nlRouter, $scope, nlDlg, nlServerApi, nlSendAssignmentSrv) {
    var _dbid = null;
    var _type = 'lesson';
    var _userInfo = null;
    function _onPageEnter(userInfo) {
        _userInfo = userInfo;
        return nl.q(function(resolve, reject) {
            nlDlg.popupStatus('Not Supported');
            resolve(false);
            return;

            // TODO: remove all usages of this controller and the code
            var params = nl.location.search();
            _type = (params.type == 'course') ? 'course' : 'lesson';
            _dbid = params.id ? parseInt(params.id) : null;
            if (!_dbid) {
                nlDlg.popupStatus('Incorrect arguments');
                resolve(false);
                return;
            }
            _getDataFromServer().then(function(result) {
                _showAssignmentDlg(result);
                resolve(true);
            }, function() {
                resolve(false);
            });
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
    
    function _getDataFromServer() {
        if (_type == 'lesson') return nlServerApi.lessonGetContent(_dbid, 'view');
        return nlServerApi.courseGet(_dbid, true);
    }

    function _showAssignmentDlg(result) {
        var assignInfo = {assigntype: _type, id: _dbid};
        if (_type == 'lesson') {
            var lesson = result.lesson;
            assignInfo.icon = nl.url.lessonIconUrl(lesson.image);
            assignInfo.title = lesson.name;
            assignInfo.authorName = lesson.authorname;
            assignInfo.subjGrade = nl.fmt2('{}, {}', lesson.subject, lesson.grade);
            assignInfo.description = lesson.description;
            assignInfo.esttime = lesson.esttime ? lesson.esttime : '';
            assignInfo.showDateField = true;
            assignInfo.enableSubmissionAfterEndtime = true;
        } else {
            assignInfo.icon = result.icon;
            assignInfo.title = result.name;
            assignInfo.authorName = result.authorname;
            assignInfo.description = result.description;
        }
        nlSendAssignmentSrv.show($scope, assignInfo, _userInfo).then(function(result) {
        	if (!result) nl.location.url('/home'); 
        });
    }
    
}];

//-------------------------------------------------------------------------------------------------
var SendAssignmentSrv = ['nl', 'nlDlg', 'nlServerApi', 'nlGroupInfo', 'nlOuUserSelect',
function(nl, nlDlg, nlServerApi, nlGroupInfo, nlOuUserSelect) {
    //---------------------------------------------------------------------------------------------
    // Main Assignment Dialog
    //---------------------------------------------------------------------------------------------
    this.show = function(parentScope, assignInfo, userInfo) {
        _parentScope = parentScope;
        _assignInfo = assignInfo;
        _userInfo = userInfo;
        return nl.q(function(resolve, reject) {
            _impl(resolve, reject);
        });
    };

    //---------------------------------------------------------------------------------------------
    // Private data
    //---------------------------------------------------------------------------------------------
    var _parentScope = null;
    var _assignInfo = null;
    var _userInfo = null;

    var _dlg = null;
    var _ouUserSelector = null;
    var _selectedUsers = {};

    //---------------------------------------------------------------------------------------------
    // Constants
    //---------------------------------------------------------------------------------------------
    var learningModeStrings = [{id: 1, name: 'on every page'}, // LEARNMODE_SELF
                               {id: 2, name: 'after submitting'}, // LEARNMODE_ASSIGNMENT
                               {id: 3, name: 'only when published'}]; // LEARNMODE_TEST

    //---------------------------------------------------------------------------------------------
    // Private implementation
    //---------------------------------------------------------------------------------------------
    function _impl(resolve, reject) {
        _dlg = nlDlg.create(_parentScope);
        nlDlg.showLoadingScreen();
        nlGroupInfo.init2().then(function() {
            nlGroupInfo.updateRestrictedOuTree(_userInfo);
            var dontShowUsers = _assignInfo.dontShowUsers || {};
            if (_assignInfo.assigntype == 'training') _selectedUsers = {};
            _ouUserSelector = nlOuUserSelect.getOuUserSelector(_parentScope, 
                nlGroupInfo.get(), {}, dontShowUsers);
            _ouUserSelector.updateSelectedIds(_selectedUsers);
            _initDlgScope();
            _showDlg(resolve, reject);
        });
    }

    function _isAssignmentEnabled() {
		var props = nlGroupInfo.get().props;
        var isMailEnabled = (props['notifyBy'] || []).length > 0;
		return isMailEnabled;
    }
    
    function _initDlgScope() {
        _dlg.setCssClass('nl-height-max nl-width-max');
        var dlgScope = _dlg.scope;
        dlgScope.assignInfo = _assignInfo;
        dlgScope.enableEmailNotifications = _assignInfo.hideEmailNotifications ? false : _isAssignmentEnabled();
        dlgScope.options = {showAnswers: learningModeStrings};
        if(_assignInfo.isModify && _assignInfo.dontShowUsers) {
	        dlgScope.addedUserStr = nl.t('Already {} users are added to this assignment.', Object.keys(_assignInfo.dontShowUsers).length);
        }
        dlgScope.data = {
            ouUserTree: _ouUserSelector ? _ouUserSelector.getTreeSelect() : null,
            starttime: _assignInfo.starttime || new Date(),
            endtime: _assignInfo.endtime || '',
            maxduration: _assignInfo.esttime ? parseInt(_assignInfo.esttime) : '',
            showAnswers: 'learnmode' in _assignInfo ? {id:_assignInfo.learnmode} : learningModeStrings[1],
            remarks: _assignInfo.remarks || '',
            forum: false,
            submissionAfterEndtime: 'submissionAfterEndtime' in _assignInfo ? _assignInfo.submissionAfterEndtime : false,
            sendEmail: dlgScope.enableEmailNotifications,
            batchname: _assignInfo.batchname || '',
			iltTrainerName: _assignInfo.iltTrainerName,
			iltVenue: _assignInfo.iltVenue,
			iltCostInfra: _assignInfo.iltCostInfra,
			iltCostTrainer: _assignInfo.iltCostTrainer,
			iltCostFoodSta: _assignInfo.iltCostFoodSta,
			iltCostTravelAco: _assignInfo.iltCostTravelAco,
            iltCostMisc: _assignInfo.iltCostMisc,
            courseContent: (_assignInfo.course && _assignInfo.course.content) ? _assignInfo.course.content : null,
            update_content: false,
            modifiedILT: _assignInfo.modifiedILT || {},
        };
        if (_assignInfo.batchtype) dlgScope.data.batchtype = {id: _assignInfo.batchtype, name: _assignInfo.batchtype};
        if(!_assignInfo.batchname) {
		    var	d = nl.fmt.date2Str(new Date(), 'date');
		    dlgScope.data.batchname = nl.t('{} - Batch', d);
        }
		var props = nlGroupInfo.get().props;
        if (props.features && props.features.virtualILT) {
            dlgScope.data.virtualILT = true;
            dlgScope.data.useSameUrlForAll = true;
        }
        _sessionDetails.init();
        dlgScope.data.isEmailNotificationEnable = function() {
            var selectedUsers = _ouUserSelector.getSelectedUsers() || {};
            if(Object.keys(selectedUsers).length != 0) return true;
            return false;
        }

        dlgScope.help = _getHelp();
        _updateBatchType(dlgScope); 

        dlgScope.data.milestoneItems = _updateMilestones(_assignInfo);
        var currentMsDates = _assignInfo.msDates || {};

        for(var i=0; i< dlgScope.data.milestoneItems.length; i++) {
            var ms = dlgScope.data.milestoneItems[i].typeId;
            dlgScope.data[ms] = currentMsDates[ms] || '';
            dlgScope.help[ms] =  {name: dlgScope.data.milestoneItems[i].name, help: nl.t('Please Enter the Due Date of the Milestone mentioned.')};
        }

        dlgScope.data.onModifyDetails = function() {
            var modifyDlg = nlDlg.create(_parentScope);
            modifyDlg.setCssClass('nl-height-max nl-width-max');
            modifyDlg.scope.dlgTitle = nl.t('Modify training details');
            modifyDlg.scope.assignInfo = _assignInfo;
            modifyDlg.scope.data = dlgScope.data;
            modifyDlg.scope.help = dlgScope.help;
            if(Object.keys(modifyDlg.scope.data.modifiedILT).length == 0) {
                modifyDlg.scope.data.modifiedILT = _getModifiedILT(_assignInfo);
            }
            var cancelButton = {text : nl.t('Modify')};
            modifyDlg.show('view_controllers/assignment/modify_training_details_dlg.html',
                [], cancelButton);
        }
    }

    function _updateBatchType(dlgScope) {
        if (dlgScope.assignInfo.assigntype != 'course') return;
        var content = dlgScope.assignInfo.course.content;
        if (!content.nht) return;
        var groupInfo = nlGroupInfo.get();
        var batchtype = 'batchtype' in groupInfo.props ? groupInfo.props.batchtype : [];
        if (batchtype.length == 0) return;
        var options = [];
        var uniqueItemDict = {}
        for (var i=0; i<batchtype.length; i++) {
            var type = batchtype[i];
            if(type in uniqueItemDict) continue;
            options.push({id: type, name: type});
            uniqueItemDict[type] = true;
        }
        dlgScope.options.batchtype = options;
    }

	function _getHelp() {
		var showAnsStr = '<ul><li>By default, answers are shown to the learner "after submitting" the assignment.</li>';
			showAnsStr += '<li>You could change this to "on every page" if you want to learners to self learn and the score is not important.</li>';
			showAnsStr += '<li>You can set this to "only when published" if you are dispatching a test and you do not want the learners to see the answers. You can explicitly publish the results later when appropriate from the assignment desk.</li></ul>';
		var updateContentStr = '<p>The assignment content will be updated with the latest approved module content.</p>';
			updateContentStr += '<p class="fsh6 forange">Please do not add new pages or change page order. ';
			updateContentStr += 'If some learners have already completed the assignment, structural changes could result in errors.</p>';
			updateContentStr += '<p>You may update content to correct minor errors in the module content - example minor textual changes.</p>'; 
			updateContentStr += '<p>If you need to remove some wrong questions, you may delete the page. Correcting the answer will not reevaluate users who have already completed.</p>'; 
			updateContentStr += '<p>Learner who have already completed the module will not be able to redo based on updated content. ';
            updateContentStr += 'Learners who have not done the assignment will see the updated content.</p>';
		return {
			ouUserTree: {name: 'Add users', help: nl.t('Select the organizations and if needed, the specific learners.')},
			starttime: {name: 'From', help: nl.t('You may define the earliest date and time (upto minutes accuracy) from when the assignment is active. If not set, the assignment is active as soon as it is sent till the end time.')},
			endtime: {name: 'Till', help: nl.t('You may define the latest date and time (upto minutes accuracy) till when the assignment is active. If not set, the assignment is active after start time (or sent time if start is not defined).')},
			maxduration: {name: 'Time limit (minutes)', help: nl.t('You may restrict the learner to complete the assignment within the specified time limit. If not set, the learner may take any amount of time subject to start and end time restrictions.')},
			showAnswers: {name: 'Show answers', help: showAnsStr},
			remarks: {name: 'Remarks', help: nl.t('Add remarks if any that you want to share to the learners - e.g. submit before Friday.')},
			forum: {name: 'Forum', help: nl.t('You could choose to allow learners to discuss with you in a discussion forum. Only the learners belonging to this batch and learning administrators will be able to post and view messages in this forum.')},
			submissionAfterEndtime: {name: 'Submission after end time', help: nl.t('You can allow learners to submit assignment after the mentioned end time.')},
			sendEmail: {name: 'Notifications', help: nl.t('You could choose to send notifications to the learners.')},
            batchParams: {name: 'Training details', help: nl.t('You may configure the training batch details.')},
            iltTrainerName: {name: 'Trainer name', help: nl.t('Provide trainer name to this training.')},
			iltVenue: {name: 'Venue', help: nl.t('Configure venue of this training.')},
			iltCostInfra: {name: 'Infrastructure cost', help: nl.t(' Configure the infrastructure cost.')},
			iltCostTrainer: {name: 'Trainer cost', help: nl.t(' Configure the trainer cost.')},
			iltCostFoodSta: {name: 'Stationary and Food cost', help: nl.t(' Configure the stationary and food cost.')},
			iltCostTravelAco: {name: 'Travel and Accomodation cost', help: nl.t(' Configure the travel and accomodation cost.')},
			iltCostMisc: {name: 'Miscellaneous cost', help: nl.t(' Configure the miscellaneous cost.')},
			batchname: {name: 'Batch name', help: nl.t('This is an batch name mentioned while sending an assignemnt.')},
			update_content: {name: 'Update content', help: updateContentStr},
			batchtype: {name: 'Batch type', help: nl.t('This is an batch type mentioned while sending an assignemnt.')},
		};
	}

    function _showDlg(resolve, reject) {
    	var buttonName = _assignInfo.assigntype == 'training' ? nl.t('Nominate User') : nl.t('Send Assignment');
    	if (_assignInfo.isModify) buttonName = nl.t('Modify');
        var sendButton = {text : buttonName, onTap : function(e) {
            if (_ouUserSelector) _selectedUsers = _ouUserSelector.getSelectedUsers(); 
            if(e) e.preventDefault(e);
            truncateSecondsFromDate(_dlg.scope.data);
            if (!_validateBeforeAssign(_dlg.scope.data)) return;

            if (_assignInfo.isModify) return _modifyAssignment(e);
            _onSendAssignment(e);
        }};
        var cancelButton = {text : nl.t('Cancel'), onTap: function(e) {
            if (_ouUserSelector) _selectedUsers = _ouUserSelector.getSelectedUsers(); 
            resolve(_dlg._dlgResult || false);
        }};
        _dlg.show('view_controllers/assignment/send_assignment_dlg.html',
            [sendButton], cancelButton);
    }

    function truncateSecondsFromDate(params) {
        if(params.starttime) params.starttime.setSeconds(0);
        if(params.endtime) params.endtime.setSeconds(0);
        var msItems = params.milestoneItems;
        for (var i=0; i< msItems.length; i++) {
            var milestoneTypeid = msItems[i].typeId;
            if(params[milestoneTypeid]) params[milestoneTypeid].setSeconds(0);
        }
    }

    function _validateBeforeAssign() {
        _dlg.scope.error = {};
        if (_dlg.scope.assignInfo.showDateField) {
            if (!_dlg.scope.data.starttime) {
                return _validateFail('starttime', 'Start date/time is mandatory.');
            }
            var msItems = _dlg.scope.data.milestoneItems;
            if ((_dlg.scope.assignInfo.blended || msItems.length) && !_dlg.scope.data.endtime) {
                return _validateFail('endtime', 'End date/time is mandatory for ILT courses.');
            }
            if (_dlg.scope.data.endtime && _dlg.scope.data.starttime > _dlg.scope.data.endtime) {
                return _validateFail('endtime', 'End date/time should be more than start and current date/time.');
            }
	        var maxduration = _dlg.scope.data.maxduration;
	        maxduration = maxduration ? parseInt(maxduration) : 0;
            if (_dlg.scope.data.endtime && maxduration) {
                var minutes = Math.floor((_dlg.scope.data.endtime - _dlg.scope.data.starttime)/60000);
                if (minutes < maxduration)
                    return _validateFail('endtime', nl.fmt2('End date/time should be atleast {} minutes more than start date/time', maxduration));
            }
            for (var i=0; i< msItems.length; i++) {
                var milestoneTypeid = msItems[i].typeId;
                if(!_dlg.scope.data[milestoneTypeid]) {
                    return _validateFail( milestoneTypeid, 'Milestone date is mandatory.');
                }
                var earlierDate = i>=1 ? _dlg.scope.data[msItems[i-1].typeId] : _dlg.scope.data.starttime;
                if(_dlg.scope.data[milestoneTypeid] < earlierDate) {
                    return _validateFail( milestoneTypeid, 'Milestone date should be greater than start time and earlier milestones.');
                }
                if( _dlg.scope.data[milestoneTypeid] > _dlg.scope.data.endtime) {
                    return _validateFail( milestoneTypeid, 'Milestone date should be less than endtime.');
                }
            }
        }

        if (!_dlg.scope.assignInfo.isModify && Object.keys(_selectedUsers).length == 0) {
        	var templateMsg = _assignInfo.assigntype == 'training' 
        		? nl.t('Please select the users to nominate.') 
        		: nl.t('Please select the users to send the assignment to.');
            nlDlg.popupAlert({title:'Please select', template: templateMsg});
            return false;
        }

        if (_dlg.scope.options.batchtype && !_dlg.scope.data.batchtype) {
        	var templateMsg = nl.t('Please select batch type for this assignment.');
            nlDlg.popupAlert({title:'Please select', template: templateMsg});
            return false;
        }

        if (_dlg.scope.data.onlineSessions.length > 0) {
            var lastSession = null;
            for (var i=0; i<_dlg.scope.data.onlineSessions.length; i++) {
                var session = _dlg.scope.data.onlineSessions[i];
                if(!session.start) {
                    nlDlg.popupAlert({title:'Please select', template: 'Please select the start date for all sessions'});
                    return false;
                }
                if (!session.duration) {
                    nlDlg.popupAlert({title:'Please select', template: nl.t('Please select the session duration for {}', session.name)});
                    return false;
                }
                if (!lastSession) continue;
                lastSession = session;
            }
        }
        return true;
    }
    
    function _validateFail(attr, errMsg) {
        nlDlg.popupAlert({title:'Error', template: errMsg});
    	return nlDlg.setFieldError(_dlg.scope, attr, errMsg);
    }

    function _getOusAndUser() {
        var ret = {ous: [], userids: [], dispinfos: []};
        var ouDict = {};
        var count = 0;
        for(var key in _selectedUsers) {
            var user = _selectedUsers[key].userObj;
            if (!user) continue;
            ouDict[user.org_unit] = true;
            ret.userids.push(user.id);
            if (count < 500) ret.dispinfos.push({name: user.name, ou: user.org_unit});
            count++;
        }
        ret.ous = Object.keys(ouDict);
        return ret;
    }

    //---------------------------------------------------------------------------------------------
    // session and online meeting details
    //---------------------------------------------------------------------------------------------
    function SessionDetails() {
        this.init = function() {
            var modules = _assignInfo.course.content.modules;
            var modifiedILT = _dlg.scope.assignInfo.modifiedILT || {};
            var oldSessionDetails = {}
                oldSessionDetails = nlCourse.migrateModifiedILT(modifiedILT) || {};
            var onlineSessions = [];
            for (var i=0; i<modules.length; i++) {
                var cm = modules[i];
                if (cm.type != 'iltsession') continue;
                var oldSession = null;
                if (cm.id in oldSessionDetails) oldSession = oldSessionDetails[cm.id];
                var dict = {id: cm.id, name: cm.name};
                dict.start = oldSession && oldSession.start ? oldSession.start : new Date();
                dict.duration = oldSession && oldSession.duration ? oldSession.duration : cm.iltduration;
                if (_dlg.scope.data.virtualILT) {
                    if (onlineSessions.length == 0) dict.canShowUrlField = true;
                    dict.url = oldSession && oldSession.url ? oldSession.url : '';
                    dict.notes = oldSession && oldSession.notes ? oldSession.notes : '';    
                }
                onlineSessions.push(dict);
            }
            _dlg.scope.data.onlineSessions = onlineSessions;
        }

        this.getMinimizedSessionDetails = function() {
            var onlineSessions = _dlg.scope.data.onlineSessions || [];
            var useSameUrlForAll = _dlg.scope.data.useSameUrlForAll;
            var ret = {};
            var firstSession = null;
            for (var i=0; i<onlineSessions.length; i++) {
                var session = onlineSessions[i];
                var newILT = {duration: session.duration, start: session.start};
                if (_dlg.scope.data.virtualILT) {
                    if (!firstSession) firstSession = session;
                    if (useSameUrlForAll) {
                        newILT.url = firstSession.url; 
                        newILT.notes = firstSession.notes;    
                    } else {
                        if (session.canShowUrlField) {
                            newILT.url = firstSession.url; 
                            newILT.notes = firstSession.notes;    
                        }
                    }
                }
                ret[session.id] = newILT;
            }
            ret.session_version = nlCourse.getSessionVersion();
            return ret;
        }
    }
    //---------------------------------------------------------------------------------------------
    // On modify and afterwards code
    //---------------------------------------------------------------------------------------------
	function _modifyAssignment(e) {
        var ouUserInfo = _getOusAndUser();
        
        var assignInfo = _dlg.scope.assignInfo;
        var data = _dlg.scope.data;
		var params={atype: assignInfo.assigntype == 'course' ? _nl.atypes.ATYPE_COURSE : _nl.atypes.ATYPE_MODULE,
			assignid: assignInfo.assignid, batchname: data.batchname, remarks: data.remarks,
			not_before: data.starttime, not_after: data.endtime, 
			submissionAfterEndtime: data.submissionAfterEndtime,
			max_duration: data.maxduration, learnmode: data.showAnswers.id,
            update_content: data.update_content,
            sendemail: data.sendEmail || false, selectedusers: []};
        if (data.batchtype) params.batchtype = data.batchtype.id;
		if(ouUserInfo.userids.length > 0) {
            params['selectedusers'] = _getMinimalUserObjects(ouUserInfo.userids),
            params['oustr'] = _getOrgUnitStr(ouUserInfo.ous);
        }

		if (assignInfo.blended) {
            params.blended = true;
            params.modifiedILT = _getMinimizedILT(data.modifiedILT);
			params.iltTrainerName = data.iltTrainerName;
			params.iltVenue = data.iltVenue;
			params.iltCostInfra = data.iltCostInfra;
			params.iltCostTrainer = data.iltCostTrainer;
			params.iltCostFoodSta = data.iltCostFoodSta;
			params.iltCostTravelAco = data.iltCostTravelAco;
			params.iltCostMisc = data.iltCostMisc;
        }
        _updateMilestoneDates(_dlg.scope, params);
		_validateBeforeModify(params, assignInfo, function() {
			if (params.not_before) params.not_before = nl.fmt.date2UtcStr(params.not_before, 'second');
			if (params.not_after) params.not_after = nl.fmt.date2UtcStr(params.not_after, 'second');
            nlDlg.showLoadingScreen();
            _sendOrModifyInBatches(params, _dlg);
		});
	}


    function _validateBeforeModify(params, assignInfo, onModifyFn) {
    	if (params.atype == _nl.atypes.ATYPE_MODULE && params.update_content) {
	    	var confirm = _getHelp().update_content.help;
	    	confirm = nl.t('<div class="padding-mid fsh5">Updating the content could have undesired consequences. Are you sure you want to continue?</div><div class="padding-mid">{}</div>', confirm);
	    	nlDlg.popupConfirm({title: nl.t('Please confirm'), template: confirm}).then(function(result) {
	    		if (!result) return;
		    	onModifyFn();
	    	});
    	} else {
	    	onModifyFn();
    	}
    }
    
    function _getModifiedILT(assignInfo) {
        var ret = {};
        var modules = assignInfo.course.content.modules;
        for(var i=0; i<modules.length; i++) {
            var item = modules[i];
            if(item.type != 'iltsession') continue;
            ret[item.id] = {name: item.name, duration: item.iltduration};
        }
        return ret;
    }

    function _updateMilestones(_assignInfo) {
        var milestoneItems = [];
        if (_assignInfo.assigntype !== 'course') return milestoneItems;
        var modules = _assignInfo.course.content.modules;
        for(var i=0; i<modules.length; i++) {
            var item = modules[i];
            if(item.type != 'milestone') continue;
            milestoneItems.push({name: item.name, duedate: item['milestone_' + item.id] || '', typeId: 'milestone_' + item.id});
        }
        return milestoneItems;
    }

    function _updateMilestoneDates(dlgScope, serverParams) {
        var msDates = {};
        var msItems = dlgScope.data.milestoneItems;
        var bFound = false;
        for(var i=0; i< msItems.length; i++) {
            var ms = dlgScope.data.milestoneItems[i].typeId;
            var msDate = dlgScope.data[ms] || '';
            if (msDate) msDate = nl.fmt.date2UtcStr(msDate, 'second');
            msDates[ms] = msDate;
            bFound = true;
        }
        if (bFound) serverParams.msDates = msDates;
    }
    
    function _getMinimizedILT(modifiedILT) {
        var ret = {};
        for(var key in modifiedILT) {
            ret[key] = modifiedILT[key].duration;
        }
        return ret;
    }
    //---------------------------------------------------------------------------------------------
    // On Send and afterwards code
    //---------------------------------------------------------------------------------------------
    function _onSendAssignment(e) {
        var ouUserInfo = !_dlg.scope.assignInfo.isModify ? _getOusAndUser() : null;
        var assignInfo = _dlg.scope.assignInfo;
        var data = {
        	assigntype: assignInfo.assigntype == 'lesson' ? _nl.atypes.ATYPE_MODULE
        				: _nl.atypes.ATYPE_COURSE,
        	contentid: assignInfo.id,
        	assignid: assignInfo.assignid || 0,
            selectedusers: _getMinimalUserObjects(ouUserInfo.userids),
            oustr: _getOrgUnitStr(ouUserInfo.ous),
            remarks: _dlg.scope.data.remarks || '',
            forum: _dlg.scope.data.forum || false,
            sendemail: _dlg.scope.data.sendEmail || false,
            batchname: _dlg.scope.data.batchname || ''};

        if (_dlg.scope.data.batchtype) data.batchtype = _dlg.scope.data.batchtype.id;
        
        if (data.assigntype == _nl.atypes.ATYPE_MODULE  || data.assigntype == _nl.atypes.ATYPE_COURSE) {
	        var starttime = _dlg.scope.data.starttime || '';
	        var endtime = _dlg.scope.data.endtime || '';
	        var maxduration = _dlg.scope.data.maxduration;
	        maxduration = maxduration ? parseInt(maxduration) : 0;
	        if(starttime) starttime = nl.fmt.date2UtcStr(starttime, 'second');
	        if(endtime) endtime = nl.fmt.date2UtcStr(endtime, 'second');
            data.not_before = starttime;
            data.not_after = endtime;
            data.submissionAfterEndtime = _dlg.scope.data.submissionAfterEndtime || false;
            if (data.assigntype == _nl.atypes.ATYPE_MODULE){
 				data.learnmode = _dlg.scope.data.showAnswers.id;
				data.max_duration = maxduration || '';
			}
			if (assignInfo.blended && data.assigntype == _nl.atypes.ATYPE_COURSE) {
                data.blended = true;
                if(Object.keys(_dlg.scope.data.modifiedILT).length > 0) {
                    data.modifiedILT = _getMinimizedILT(_dlg.scope.data.modifiedILT);
                } else {
                    data.modifiedILT = {};
                }
				data.iltTrainerName = _dlg.scope.data.iltTrainerName || '';
				data.iltVenue = _dlg.scope.data.iltVenue || '';
				data.iltCostInfra = _dlg.scope.data.iltCostInfra || '';
				data.iltCostTrainer = _dlg.scope.data.iltCostTrainer || '';
				data.iltCostFoodSta = _dlg.scope.data.iltCostFoodSta || '';
				data.iltCostTravelAco = _dlg.scope.data.iltCostTravelAco || '';
				data.iltCostMisc = _dlg.scope.data.iltCostMisc || '';
			}
        }
        _updateMilestoneDates(_dlg.scope, data);
        _confirmAndSend(data, ouUserInfo);
    }
    
    function _getOrgUnitStr(ous) {
    	var sorted = ous.sort();
        var ret = sorted.join(', ');
        if (ret.length <= 100) return ret;
        return ret.substring(0, 100) + '...';
    }

    function _confirmAndSend(data, ouUserInfo) {
        var confirmDlg = nlDlg.create(_parentScope);
        confirmDlg.setCssClass('nl-height-max nl-width-max');
        confirmDlg.scope.count = ouUserInfo.userids.length;
        confirmDlg.scope.infos = ouUserInfo.dispinfos;
        confirmDlg.scope.assignInfo = _assignInfo;
        var okButton = {text : nl.t('Send'), onTap : function(e) {
            nlDlg.showLoadingScreen();
            _sendOrModifyInBatches(data).then(function(ctx) {
                nlDlg.hideLoadingScreen();
                _showAfterAssignmentSentDlg(ctx);
            }, function() {
                nlDlg.popdownStatus();
            });
        }};
        var cancelButton = {text : nl.t('Cancel')};
        confirmDlg.show('view_controllers/assignment/confirm_before_send_dlg.html',
            [okButton], cancelButton);
    }
    
    function _getMinimalUserObjects(selecteduserids) {
    	var selectedusers = [];
    	for (var i=0; i<selecteduserids.length; i++) {
            var userObj = nlGroupInfo.getMinimalUserObj(nlGroupInfo.getUserObj(''+selecteduserids[i]));
            if (!userObj) continue;
    		selectedusers.push(userObj);
    	}
    	return selectedusers;
    }
    
    var MAX_PER_BATCH = 50;
    function _sendOrModifyInBatches(data, _dlg) {
        var ctx = {data: data, sentUserCnt: 0, pendingUsers: [],
            totalUsersCnt: data.selectedusers.length};
        if (data.selectedusers.length > MAX_PER_BATCH) {
            ctx.pendingUsers = data.selectedusers.slice(MAX_PER_BATCH);
            ctx.data.selectedusers = data.selectedusers.slice(0, MAX_PER_BATCH);
        }
        var serverFn = nlServerApi.assignmentSend;
        if(_dlg) {
            ctx.data.justAddUsers = false;
            serverFn = nlServerApi.assignmentModify;
        }
        return nl.q(function(resolve, reject) {
            serverFn(ctx.data).then(function(assignId) {
                ctx.sentUserCnt += ctx.data.selectedusers.length;
                if(!_dlg) ctx.data.assignid = assignId;
                _sendOrModifyNextBatch(ctx, resolve, serverFn, _dlg);
            });
        });
    }

    function _sendOrModifyNextBatch(ctx, resolve, serverFn, _dlg) {
        var msg = nl.t('Sent assignment to {} of {}', ctx.sentUserCnt, ctx.totalUsersCnt);
        if(_dlg) msg = nl.t('Assignment modified {}', ctx.totalUsersCnt > 0 ? nl.t(', {} of {} users added to existing assignment', ctx.sentUserCnt, ctx.totalUsersCnt) : '' );

        if (ctx.pendingUsers.length == 0) {
            nlDlg.popupStatus(msg);
            if(_dlg) {
                nlDlg.hideLoadingScreen();
                if (ctx.data.not_before) ctx.data.not_before = nl.fmt.json2Date(ctx.data.not_before);
                if (ctx.data.not_after) ctx.data.not_after = nl.fmt.json2Date(ctx.data.not_after);
                _dlg._dlgResult = ctx.data;
                _dlg.close();
                resolve();
                return;    
            } else {
                resolve(ctx);
                return;    
            }
        }
        nlDlg.popupStatus(msg, false);
        if (ctx.pendingUsers.length > MAX_PER_BATCH) {
            ctx.data.selectedusers = ctx.pendingUsers.slice(0, MAX_PER_BATCH);
            ctx.pendingUsers = ctx.pendingUsers.slice(MAX_PER_BATCH);
        } else {
            ctx.data.selectedusers = ctx.pendingUsers;
            ctx.pendingUsers = [];
        }
        ctx.data.justAddUsers = true;
        serverFn(ctx.data).then(function(status) {
            ctx.sentUserCnt += ctx.data.selectedusers.length;
            _sendOrModifyNextBatch(ctx, resolve, serverFn, _dlg);
        });
    }

    function _showAfterAssignmentSentDlg(ctx) {
        if (_assignInfo.assigntype == 'training') {
        	var msg = nl.t('{} {} nominated for training.',  
        		ctx.sentUserCnt, 
        		ctx.sentUserCnt == 1 ? nl.t('user has been') : nl.t('users have been'));
        	nlDlg.popupAlert({title: nl.t('Training nominated'), template:msg}).then(function(){
				_dlg._dlgResult = true;
				_dlg.close();
			});    
	        return;
        }
        var afterAssignmentSentDlg = nlDlg.create(_parentScope);
        afterAssignmentSentDlg.scope.data = {sentUserCnt: ctx.sentUserCnt,
        	pageTitle: nl.t('Assignment sent')};
        if(ctx.data.assigntype == _nl.atypes.ATYPE_MODULE) {
            afterAssignmentSentDlg.scope.data.url = nl.fmt2('/#/learning_reports?type=module_assign&objid={}&max=500', ctx.data.assignid);
        } else if (ctx.data.assigntype == _nl.atypes.ATYPE_COURSE) {
            afterAssignmentSentDlg.scope.data.url = nl.fmt2('#/learning_reports?type=course_assign&objid={}&max=500', ctx.data.assignid);
        }
        var cancelButton = {text : nl.t('Close'), onTap: function(e) {
				_dlg._dlgResult = true;
				_dlg.close();
        }};
        afterAssignmentSentDlg.show('view_controllers/assignment/after_assignment_sent_dlg.html',
            [], cancelButton);
    }
}];
//-------------------------------------------------------------------------------------------------

module_init();
})();

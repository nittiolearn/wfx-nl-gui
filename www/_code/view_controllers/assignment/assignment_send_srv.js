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

    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
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
        nlSendAssignmentSrv.show($scope, assignInfo).then(function(e) {
            nl.location.url('/home'); 
        });
    }
    
}];

//-------------------------------------------------------------------------------------------------
var SendAssignmentSrv = ['nl', 'nlDlg', 'nlServerApi', 'nlGroupInfo', 'nlOuUserSelect',
function(nl, nlDlg, nlServerApi, nlGroupInfo, nlOuUserSelect) {
    //---------------------------------------------------------------------------------------------
    // Main Assignment Dialog
    //---------------------------------------------------------------------------------------------
    this.show = function(parentScope, assignInfo) {
        _parentScope = parentScope;
        _assignInfo = assignInfo;
        return nl.q(function(resolve, reject) {
            _impl(resolve, reject);
        });
    };

    //---------------------------------------------------------------------------------------------
    // Private data
    //---------------------------------------------------------------------------------------------
    var _parentScope = null;
    var _assignInfo = null;

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
        nlGroupInfo.init().then(function() {
            nlGroupInfo.update();
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
		var isMailEnabled = false;
		for(var i=0; i<props.taskNotifications.length; i++) {
			if(props.taskNotifications[i] != 3) continue;
			isMailEnabled = true;
			break;
		}
		return isMailEnabled;
    }
    
    function _initDlgScope() {
        _dlg.setCssClass('nl-height-max nl-width-max');
        var dlgScope = _dlg.scope;
        dlgScope.assignInfo = _assignInfo;
        dlgScope.enableEmailNotifications = _isAssignmentEnabled();
        dlgScope.options = {showAnswers: learningModeStrings};
        dlgScope.data = {
            ouUserTree: _ouUserSelector.getTreeSelect(),
            starttime: _assignInfo.starttime || new Date(),
            endtime: _assignInfo.endtime || '',
            maxduration: _assignInfo.esttime ? parseInt(_assignInfo.esttime) : '',
            showAnswers: learningModeStrings[1],
            remarks: _assignInfo.remarks || '',
            forum: false,
            submissionAfterEndtime: false,
            sendEmail: false,
            batchname: _assignInfo.batchname
        };
        dlgScope.help = _getHelp();
    }

	function _getHelp() {
		var showAnsStr = '<ul><li>By default, answers are shown to the learner "after submitting" the assignment.</li>';
			showAnsStr += '<li>You could change this to "on every page" if you want to learners to self learn and the score is not important.</li>';
			showAnsStr += '<li>You can set this to "only when published" if you are dispatching a test and you do not want the learners to see the answers. You can explicitly publish the results later when appropriate from the assignment desk.</li></ul>';
		return {
			ouUserTree: {name: 'Users', help: nl.t('Select the organizations (and if needed, the specific learners), put in a remark and click the Send Assignment button to send it to the selected class.')},
			starttime: {name: 'From', help: nl.t('You may define the earliest date and time (upto minutes accuracy) from when the assignment is active. If not set, the assignment is active as soon as it is sent till the end time.')},
			endtime: {name: 'Till', help: nl.t('You may define the latest date and time (upto minutes accuracy) till when the assignment is active. If not set, the assignment is active after start time (or sent time if start is not defined).')},
			maxduration: {name: 'Time limit (minutes)', help: nl.t('You may restrict the learner to complete the assignment within the specified time limit. If not set, the learner may take any amount of time subject to start and end time restrictions.')},
			showAnswers: {name: 'Show answers', help: showAnsStr},
			remarks: {name: 'Remarks', help: nl.t('Add remarks if any that you want to share to the learners - e.g. submit before Friday.')},
			forum: {name: 'Forum', help: nl.t('You could choose to allow learners to discuss with you in a discussion forum. Only the learners belonging to this batch and learning administrators will be able to post and view messages in this forum.')},
			submissionAfterEndtime: {name: 'Submission after end time', help: nl.t('You can allow learners to submit assignment after the mentioned end time.')},
			sendEmail: {name: 'Email notifications', help: nl.t('You could choose to send email notifications to the learners.')},
			trainerName: {name: 'Trainer name', help: nl.t('Provide trainer name to this training.')},
			venue: {name: 'Venue', help: nl.t('Configure venue of this training.')},
			infrastructureCost: {name: 'Infrastructure cost', help: nl.t(' Configure the infrastructure cost.')},
			trainerCost: {name: 'Trainer cost', help: nl.t(' Configure the trainer cost.')},
			stsAndFoodCost: {name: 'Stationary and Food cost', help: nl.t(' Configure the stationary and food cost.')},
			travelAndAccomodationCost: {name: 'Travel and Accomodation cost', help: nl.t(' Configure the travel and accomodation cost.')},
			miscellaneousCost: {name: 'Miscellaneous cost', help: nl.t(' Configure the miscellaneous cost.')},
			batchname: {name: 'Batch name', help: nl.t('This is an batch name mentioned while sending an assignemnt')}
		};
	}

    function _showDlg(resolve, reject) {
    	var buttonName = _assignInfo.assigntype == 'training' ? nl.t('Nominate User') : nl.t('Send Assignment');
        var sendButton = {text : buttonName, onTap : function(e) {
            _selectedUsers = _ouUserSelector.getSelectedUsers(); 
            _onSendAssignment(e);
        }};
        var cancelButton = {text : nl.t('Cancel'), onTap: function(e) {
            _selectedUsers = _ouUserSelector.getSelectedUsers(); 
            resolve(e);
        }};
        _dlg.show('view_controllers/assignment/send_assignment_dlg.html',
            [sendButton], cancelButton);
    }

    function _validateBeforeAssign() {
    	if (_dlg.scope.assignInfo.showDateField && !_dlg.scope.data.starttime) {
            nlDlg.popupAlert({title:'Please select', template: 'Start date is mandatory and it can not be empty. Please select the start date'});
            return false;
    	}
        if (Object.keys(_selectedUsers).length == 0) {
        	var templateMsg = _assignInfo.assigntype == 'training' 
        		? nl.t('Please select the users to nominate.') 
        		: nl.t('Please select the users to send the assignment to.');
            nlDlg.popupAlert({title:'Please select', template: templateMsg});
            return false;
        }
        return true;
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
    // On Send and afterwards code
    //---------------------------------------------------------------------------------------------
    function _onSendAssignment(e) {
        if(e) e.preventDefault(e);
        if (!_validateBeforeAssign(_dlg.scope.data)) return;
        
        var ouUserInfo = _getOusAndUser();
        var data = {
        	assigntype: _dlg.scope.assignInfo.assigntype == 'lesson' ? _nl.atypes.ATYPE_MODULE
        				: _dlg.scope.assignInfo.assigntype == 'course' ? _nl.atypes.ATYPE_COURSE
        				: _nl.atypes.ATYPE_TRAINING,
        	contentid: _dlg.scope.assignInfo.id,
        	assignid: _dlg.scope.assignInfo.assignid || 0,
            selectedusers: _getMinimalUserObjects(ouUserInfo.userids),
            oustr: _getOrgUnitStr(ouUserInfo.ous),
            remarks: _dlg.scope.data.remarks || '',
            forum: _dlg.scope.data.forum || false,
            sendemail: _dlg.scope.data.sendEmail || false,
            batchname: _dlg.scope.data.batchname || ''};
		
        if (data.assigntype == _nl.atypes.ATYPE_MODULE  || data.assigntype == _nl.atypes.ATYPE_COURSE) {
	        var starttime = _dlg.scope.data.starttime || '';
	        var endtime = _dlg.scope.data.endtime || '';
	        var maxduration = _dlg.scope.data.maxduration;
	        maxduration = maxduration ? parseInt(maxduration) : 0;
	        if (!_asertStartEndDurations(starttime, endtime, maxduration)) return;
	        if(starttime) starttime = nl.fmt.date2UtcStr(starttime, 'second');
	        if(endtime) endtime = nl.fmt.date2UtcStr(endtime, 'second');
            data.not_before = starttime;
            data.not_after = endtime;
            data.submissionAfterEndtime = _dlg.scope.data.submissionAfterEndtime || false;
            if (data.assigntype == _nl.atypes.ATYPE_MODULE){
 				data.learnmode = _dlg.scope.data.showAnswers.id;
				data.max_duration = maxduration || '';
			}
			if (_dlg.scope.assignInfo.blended && data.assigntype == _nl.atypes.ATYPE_COURSE) {
				data.blended = true;
				data.trainerName = _dlg.scope.data.trainerName || '';
				data.venue = _dlg.scope.data.venue || '';
				data.infrastructureCost = _dlg.scope.data.infrastructureCost || '';
				data.trainerCost = _dlg.scope.data.trainerCost || '';
				data.stsAndFoodCost = _dlg.scope.data.stsAndFoodCost || '';
				data.travelAndAccomodationCost = _dlg.scope.data.travelAndAccomodationCost || '';
				data.miscellaneousCost = _dlg.scope.data.miscellaneousCost || '';
			}
        }
        _confirmAndSend(data, ouUserInfo);
    }
    
    function _getOrgUnitStr(ous) {
    	var sorted = ous.sort();
        var ret = sorted.join(', ');
        if (ret.length <= 100) return ret;
        return ret.substring(0, 100) + '...';
    }

    function _asertStartEndDurations(starttime, endtime, maxduration) {
        if (!endtime) return true;
        
        var now = new Date();
        if (!starttime || starttime < now) starttime = now;

        var minutes = Math.floor((endtime - starttime)/60000);
        if (minutes >= maxduration) return true;
        
        if (maxduration == 0) {
            nlDlg.popupAlert({title:'Alert message', 
                template:'End date/time should be more than start and current date/time'});
            return false;
        }
        nlDlg.popupAlert({title:'Alert message', 
            template:nl.t('End date/time should be atleast {} minutes more than start and current date/time', maxduration)});
        return false;
    }

    function _confirmAndSend(data, ouUserInfo) {
        var confirmDlg = nlDlg.create(_parentScope);
        confirmDlg.setCssClass('nl-height-max nl-width-max');
        confirmDlg.scope.count = ouUserInfo.userids.length;
        confirmDlg.scope.infos = ouUserInfo.dispinfos;
        confirmDlg.scope.assignInfo = _assignInfo;
        var okButton = {text : nl.t('Send'), onTap : function(e) {
            nlDlg.showLoadingScreen();
            _sendInBatches(data).then(function(ctx) {
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
    function _sendInBatches(data) {
        var ctx = {data: data, sentUserCnt: 0, pendingUsers: [],
            totalUsersCnt: data.selectedusers.length};
        if (data.selectedusers.length > MAX_PER_BATCH) {
            ctx.pendingUsers = data.selectedusers.slice(MAX_PER_BATCH);
            ctx.data.selectedusers = data.selectedusers.slice(0, MAX_PER_BATCH);
        }

        return nl.q(function(resolve, reject) {
            nlServerApi.assignmentSend(ctx.data).then(function(assignId) {
                ctx.sentUserCnt += ctx.data.selectedusers.length;
                ctx.data.assignid = assignId;
                _sendNextBatch(ctx, resolve);
            });
        });
    }

    function _sendNextBatch(ctx, resolve) {
        var msg = nl.t('Sent assignment to {} of {}', ctx.sentUserCnt, ctx.totalUsersCnt);
        if (ctx.pendingUsers.length == 0) {
            nlDlg.popupStatus(msg);
            resolve(ctx);
            return;
        }
        nlDlg.popupStatus(msg, false);
        if (ctx.pendingUsers.length > MAX_PER_BATCH) {
            ctx.data.selectedusers = ctx.pendingUsers.slice(0, MAX_PER_BATCH);
            ctx.pendingUsers = ctx.pendingUsers.slice(MAX_PER_BATCH);
        } else {
            ctx.data.selectedusers = ctx.pendingUsers;
            ctx.pendingUsers = [];
        }
        nlServerApi.assignmentSend(ctx.data).then(function(status) {
            ctx.sentUserCnt += ctx.data.selectedusers.length;
            _sendNextBatch(ctx, resolve);
        });
    }

    function _showAfterAssignmentSentDlg(ctx) {
        if (_assignInfo.assigntype == 'training') {
        	var msg = nl.t('{} {} nominated for training.',  
        		ctx.sentUserCnt, 
        		ctx.sentUserCnt == 1 ? nl.t('user has been') : nl.t('users have been'));
        	nlDlg.popupAlert({title: nl.t('Training nominated'), template:msg}).then(function(){
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
				_dlg.close();
        }};
        afterAssignmentSentDlg.show('view_controllers/assignment/after_assignment_sent_dlg.html',
            [], cancelButton);
    }
}];
//-------------------------------------------------------------------------------------------------

module_init();
})();

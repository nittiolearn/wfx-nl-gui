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
        var assignInfo = {type: _type, id: _dbid, icon: null, 
            title: '', authorName: '', subjGrade: '', description: '', esttime: ''};
        if (_type == 'lesson') {
            var lesson = result.lesson;
            assignInfo.icon = nl.url.lessonIconUrl(lesson.image);
            assignInfo.title = lesson.name;
            assignInfo.authorName = lesson.authorname;
            assignInfo.subjGrade = nl.fmt2('{}, {}', lesson.subject, lesson.grade);
            assignInfo.description = lesson.description;
            assignInfo.esttime = lesson.esttime ? lesson.esttime : '';
        } else {
            assignInfo.icon = result.icon;
            assignInfo.title = result.name;
            assignInfo.authorName = result.authorname;
            assignInfo.description = result.description;
        }
        nlSendAssignmentSrv.show($scope, assignInfo).then(function(e) {
            // e is defined only when close button is clicked
            // When redirecting e is null
            if (e) nl.location.url('/home'); 
        });
    }
    
}];

//-------------------------------------------------------------------------------------------------
var SendAssignmentSrv = ['nl', 'nlDlg', 'nlServerApi', 'nlGroupInfo',  'nlTreeSelect',
function(nl, nlDlg, nlServerApi, nlGroupInfo, nlTreeSelect) {
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
    var _groupInfo = null;
    var _ouUserTree = {data: []};
    var _allUsers = {};

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
        _initDlgScope();
        nlDlg.showLoadingScreen();
        nlGroupInfo.init().then(function() {
            _groupInfo = nlGroupInfo.get();
            var ouToUsers = _getOuToUserDict();
            _formOuUserTree(_groupInfo.outree, ouToUsers, _ouUserTree.data);
            if(_assignInfo.training) _selectedUsers = {};
            nlTreeSelect.updateSelectionTree(_ouUserTree, _selectedUsers);
            _showDlg(resolve, reject);
        });
    }

    function _initDlgScope() {
        _ouUserTree = {data: []};
        _dlg.setCssClass('nl-height-max nl-width-max');
        var dlgScope = _dlg.scope;
        dlgScope.assignInfo = _assignInfo;
        dlgScope.options = {showAnswers: learningModeStrings};
        dlgScope.data = {
            ouUserTree: _ouUserTree,
            starttime: _assignInfo.starttime || '',
            endtime: _assignInfo.endtime || '',
            maxduration: parseInt(_assignInfo.esttime),
            showAnswers: learningModeStrings[1],
            remarks: _assignInfo.remarks || ''
        };
        dlgScope.onOuUserClick = function() {
            _showOuUserListDlg();                
        };
    }

    function _getOuToUserDict() {
        var ouToUsers = {};
        for(var uid in _groupInfo.users) {
            var user = nlGroupInfo.getUserObj(uid);
            if (!user.isActive()) continue;
            if (!(user.org_unit in ouToUsers)) ouToUsers[user.org_unit] = [];
            ouToUsers[user.org_unit].push(user);
        }
        return ouToUsers;
    }
    
    var ouIcon = 'ion-person-stalker fsh4 fyellow';
    var userIcon = 'ion-person fsh4 fgreen';
    function _formOuUserTree(outree, ouToUsers, ouUserTree) {
        for(var i=0; i<outree.length; i++) {
            var item = outree[i];
            ouUserTree.push({id: item.id, name: item.text,
                type: 'ou', icon: ouIcon, canSelect: false});
            if (item.children) _formOuUserTree(item.children, ouToUsers, ouUserTree);
            if (!(item.id in ouToUsers)) continue;
            var ouUsers = ouToUsers[item.id];
            for(var j=0; j < ouUsers.length; j++) {
                var user = ouUsers[j];
                if(_assignInfo.training && (_assignInfo.selectedUsers[user.id])) continue;
                var treeItem = {id: nl.fmt2('{}.{}', item.id, user.id),
                    name: user.name, type: 'user', icon: userIcon, 
                    userObj: user};
                ouUserTree.push(treeItem);
            }
        }
    }

    function _showDlg(resolve, reject) {
    	var sndButton = _assignInfo.training ? nl.t('Nominate User') : nl.t('Send Assignment');
        var sendButton = {text : sndButton, onTap : function(e) {
            _onSendAssignment(e);
        }};
        var cancelButton = {text : nl.t('Cancel'), onTap: function(e) {
            resolve(e);
        }};
        _dlg.show('view_controllers/assignment/send_assignment_dlg.html',
            [sendButton], cancelButton);
    }

    function _showOuUserListDlg() {
        var ouUserDlg = nlDlg.create(_parentScope);
        ouUserDlg.setCssClass('nl-height-max nl-width-max');   
        ouUserDlg.scope.data = {ouUserTree: _ouUserTree};
        
        var okButton = {text : nl.t('Select'), onTap : function(e) {
            _selectedUsers = nlTreeSelect.getSelectedIds(_ouUserTree);
            if (!_assertUserCount()) e.preventDefault();
        }};

        var cancelButton = {text : nl.t('Cancel')};
        ouUserDlg.show('view_controllers/assignment/ou_user_select_dlg.html',
            [okButton], cancelButton);
    }
    
    function _assertUserCount() {
        if (Object.keys(_selectedUsers).length == 0) {
        	var templateMsg = _assignInfo.training ? nl.t('Please select the users to nominate.') : nl.t('Please select the users to send the assignment to.');
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
        if (!_assertUserCount()) return;
        
        var ouUserInfo = _getOusAndUser();
        
        var starttime = _dlg.scope.data.starttime || '';
        var endtime = _dlg.scope.data.endtime || '';
        var maxduration = _dlg.scope.data.maxduration;
        maxduration = maxduration ? parseInt(maxduration) : 0;
        if (!_asertStartEndDurations(starttime, endtime, maxduration)) return;

        if(starttime) starttime = nl.fmt.date2UtcStr(starttime, 'second');
        if(endtime) endtime = nl.fmt.date2UtcStr(endtime, 'second');
    
        var learnmode = _dlg.scope.data.showAnswers.id;
        var data = {lessonid: _dlg.scope.assignInfo.id,
                    istraining: _dlg.scope.assignInfo.istraining || false, 
                    type : _dlg.scope.assignInfo.type,
                    orgunits:ouUserInfo.ous, 
                    selectedusers: ouUserInfo.userids,
                    not_before: starttime, 
                    not_after: endtime,
                    learnmode: learnmode,
                    forum: _dlg.scope.data.forum || false,
                    max_duration: maxduration || '',
                    remarks: _dlg.scope.data.remarks || ''};
        if ('assigntype' in _dlg.scope.assignInfo)
        	data.assigntype = _dlg.scope.assignInfo.assigntype;
        if ('trainingId' in _dlg.scope.assignInfo)
        	data.trainingId = _dlg.scope.assignInfo.trainingId;
        if ('trainingName' in _dlg.scope.assignInfo)
        	data.trainingName = _dlg.scope.assignInfo.trainingName;
        _confirmAndSend(data, ouUserInfo);
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
        if (_assignInfo.returnBackAfterSend) {
        	var msg = nl.t('{} {} nominated for training.',  
        		ctx.sentUserCnt, 
        		ctx.sentUserCnt == 1 ? nl.t('user has been') : nl.t('users have been'));
        	nlDlg.popupAlert({title: nl.t('Training nominated'), template:msg}).then(function(){
				_dlg.close();
			});    
	        return;
        }
        var afterAssignmentSentDlg = nlDlg.create(_parentScope);
        afterAssignmentSentDlg.scope.data = {};
        if(ctx.data.type == 'lesson') {
            afterAssignmentSentDlg.scope.data.url = nl.fmt2('/#/assignment_report?assignid={}', ctx.data.assignid);
            afterAssignmentSentDlg.scope.data.pageTitle = nl.t('Assignment sent');
        } else if (ctx.data.type == 'course') {
            afterAssignmentSentDlg.scope.data.url = nl.fmt2('#/course_report_list?assignid={}', ctx.data.assignid);
            afterAssignmentSentDlg.scope.data.pageTitle = nl.t('Course assigned');
        }
        var cancelButton = {text : nl.t('Close')};
            afterAssignmentSentDlg.show('view_controllers/assignment/after_assignment_sent_dlg.html',
                [], cancelButton);
    }
}];
//-------------------------------------------------------------------------------------------------

module_init();
})();

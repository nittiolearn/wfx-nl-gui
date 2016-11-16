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
    var _dlg = nlDlg.create($scope);

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
            })
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
var SendAssignmentSrv = ['nl', 'nlDlg', 'nlServerApi', 'nlGroupInfo',
function(nl, nlDlg, nlServerApi, nlGroupInfo) {
	var _ouList = []; // List (tree) of OUs in the group is fetched when the dialog is popped up
    var _ou2Users = {}; // Dict of ou to list of users
	var _selectedOuList = []; // List of OU ids (strings)
	var _selectedUserIds = [];
	var _selectedUserNames = [];
	
    var learningModeStrings = [{id: 1, name: 'on every page'}, // LEARNMODE_SELF
                               {id: 2, name: 'after submitting'}, // LEARNMODE_ASSIGNMENT
                               {id: 3, name: 'only when published'}]; // LEARNMODE_TEST

    //---------------------------------------------------------------------------------------------
    // Main Assignment Dialog
    //---------------------------------------------------------------------------------------------
    this.show = function(parentScope, assignInfo) {
        var sendAssignmentDlg = nlDlg.create(parentScope);

        function _do() {
            return nl.q(function(resolve, reject) {
                _initDlgScope();
                _initOuListAndShowDlg(resolve, reject);
            });
        }
        
        function _initDlgScope() {
            sendAssignmentDlg.setCssClass('nl-height-max nl-width-max');    
            sendAssignmentDlg.scope.assignInfo = assignInfo;
            sendAssignmentDlg.scope.data = {};
            sendAssignmentDlg.scope.options = {};
            sendAssignmentDlg.scope.options.showAnswers = learningModeStrings;
            sendAssignmentDlg.scope.data.showAnswers = learningModeStrings[1];
            sendAssignmentDlg.scope.data.visibleto  = nl.t('Please select');
            sendAssignmentDlg.scope.data.visibleToUsers = nl.t('Will be sent to all users by default');
            sendAssignmentDlg.scope.data.visibleToUsersLength = 0;
            sendAssignmentDlg.scope.data.visibleToGroupLength = 0;  
            sendAssignmentDlg.scope.data.datetimevalue = '';
            sendAssignmentDlg.scope.data.maxduration = assignInfo.esttime;
            sendAssignmentDlg.scope.data.starttime = '';
            sendAssignmentDlg.scope.data.endtime = '';
            sendAssignmentDlg.scope.data.remarks = '';
            sendAssignmentDlg.scope.onOuClick = function() {
                _showOuListDlg(parentScope, sendAssignmentDlg);                
            };
            sendAssignmentDlg.scope.onUserClick = function() {
                _showOuUserListDlg(parentScope, sendAssignmentDlg);
            };
            sendAssignmentDlg.scope.onClickOnVisibleTo = function(){
                _showSelectedList(_selectedOuList, nl.t('selected group/classes'));
            };
            
            sendAssignmentDlg.scope.onClickOnVisibleToUsers = function(){
                _showSelectedList(_selectedUserNames, nl.t('selected users'));
            };
        }

        function _initOuListAndShowDlg(resolve, reject) {
            nlDlg.showLoadingScreen();
            nlServerApi.groupGetInfo().then(function(groupInfo) {
                _ouList = groupInfo.outree;
                _onUserListRecieved(groupInfo);
                _showDlg(resolve, reject);
            });
        }
    
        function _showDlg(resolve, reject) {
            var sendButton = {text : nl.t('Send Assignment'), onTap : function(e) {
                _onSendAssignment(e, parentScope, sendAssignmentDlg);
            }};
            var cancelButton = {text : nl.t('Cancel'), onTap: function(e) {
                resolve(e);
            }};
            sendAssignmentDlg.show('view_controllers/assignment/send_assignment_dlg.html',
                [sendButton], cancelButton);
        }

        function _showSelectedList(selectedList, title) {
            var selectedListDlg = nlDlg.create(parentScope);
            selectedListDlg.scope.data = {};
            selectedListDlg.scope.data.pagetitle = title;
            selectedListDlg.scope.data.selectedlist = selectedList;
            var cancelButton = {text : nl.t('Cancel')};
            selectedListDlg.show('view_controllers/assignment/show_selected_users_dlg.html', 
                [], cancelButton);
        }
        
        function _onUserListRecieved(groupInfo) {
            _ou2Users = {};
            var userCnt = 0;
            for(var userid in groupInfo.users) {
                userCnt++;
                var user = groupInfo.users[userid];
                userid = parseInt(userid);
                var name = user[nlGroupInfo.NAME];
                var ou = user[nlGroupInfo.OU];
                if (!(ou in _ou2Users)) _ou2Users[ou] = [];
                _ou2Users[ou].push({id: userid, name: name});
            }
            nl.log.info('_onUserListRecieved', userCnt);
        }

        return _do();
	};

    //---------------------------------------------------------------------------------------------
    // OU Dialog
    //---------------------------------------------------------------------------------------------
    function _showOuListDlg(parentScope, sendAssignmentDlg) {
        var ouSelectionDlg = nlDlg.create(parentScope);
        ouSelectionDlg.setCssClass('nl-height-max nl-width-max');   
        ouSelectionDlg.scope.treeData = _ouList;
        ouSelectionDlg.scope.treeOptions = {
            defaultSelectedState: false,
            twistieExpandedTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('folder.png')),
            twistieCollapsedTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('folder_closed.png')),
            twistieLeafTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('file.png')),
            labelAttribute: 'text'
        };
        ouSelectionDlg.scope.onNodeClick = function(node, isSelected, tree) {};
        
        var okButton = {text : nl.t('Select'), onTap : function(e) {_onUgDlgOk(e);}};
        var cancelButton = {text : nl.t('Cancel')};
        ouSelectionDlg.show('view_controllers/assignment/ou_selection_dlg.html',
            [okButton], cancelButton);

        function _onUgDlgOk(e) {
            _selectedOuList = [];
            _updateSelectedOus(ouSelectionDlg.scope.treeData);
            if (!_assertUgCount()) {
                e.preventDefault();
                return;
            }
            _selectedUserIds = [];
            _updateSelectedUgsText(sendAssignmentDlg);
            _updateSelectedUsersText(sendAssignmentDlg);
        }
        
        function _updateSelectedOus(tree) {
            if (!tree) return;
            for (var i=0; i<tree.length; i++) {
                var node = tree[i];
                if (node.selected) _selectedOuList.push(node.id);
                _updateSelectedOus(node.children);
            }
        }
    }

    //---------------------------------------------------------------------------------------------
    // OU User Dialog
    //---------------------------------------------------------------------------------------------
    function _showOuUserListDlg(parentScope, sendAssignmentDlg) {
        if (!_assertUgCount()) return;
        var userTree = createUserTree();
        if (!userTree) return;
        var ouUserSelectionDlg = nlDlg.create(parentScope);
        ouUserSelectionDlg.setCssClass('nl-height-max nl-width-max');   
        ouUserSelectionDlg.scope.treeData = userTree;
        ouUserSelectionDlg.scope.data = {};
        ouUserSelectionDlg.scope.data.allselectedUsers = true;
        ouUserSelectionDlg.scope.treeOptions = {
            defaultSelectedState: false,
            twistieExpandedTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('folder.png')),
            twistieCollapsedTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('folder_closed.png')),
            twistieLeafTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('file.png')),
            labelAttribute: 'name'
        };
        ouUserSelectionDlg.scope.onNodeClick = function(node, isSelected, tree) {};

        var okButton = {text : nl.t('Select'), onTap : function(e) {_onUserDlgOk(e);}};
        var cancelButton = {text : nl.t('Cancel')};
        ouUserSelectionDlg.show('view_controllers/assignment/ou_user_selection_dlg.html',
            [okButton], cancelButton);

        function createUserTree() {
            var selectedUserIdDict = _arrayToDict(_selectedUserIds);
            var allUserCount = 0;
            var bGroupNode = false;
            var userTree = [];
            for (var i in _selectedOuList) {
                var ou = _selectedOuList[i];
                var ouUserCount = 0;
                var ouNode = {id: ou, name: ou, children: [], type: 'ou'};
                var ouUsers = _ou2Users[ou];
                for (var j=0; j<ouUsers.length; j++) {
                    var u = ouUsers[j];
                    var selected = (_selectedUserIds.length == 0 || u.id in selectedUserIdDict);
                    var userNode = {id: u.id, name: u.name, children: [], type: 'user', selected: selected};
                    ouNode.children.push(userNode);
                    ouUserCount++;
                }
                if (ouUserCount == 0) continue;
                userTree.push(ouNode);
                allUserCount += ouUserCount;
            }
            if(allUserCount == 0) return _alertWhenNoUsers();
            return userTree;
        }
        
        function _onUserDlgOk(e) {
            _selectedUserNames = [];
            _selectedUserIds = [];
            var allSelected = _updateSelectedIds(ouUserSelectionDlg.scope.treeData); 
             if (_selectedUserIds.length == 0) {
                 nlDlg.popupAlert({title: nl.t('Alert message'), 
                    template:nl.t('Please select atleast one user')});
                 e.preventDefault();
                 return;
             }
             if (allSelected) {
                _selectedUserNames = [];
                _selectedUserIds = [];
             }
            _updateSelectedUsersText(sendAssignmentDlg);
        }

        function _updateSelectedIds(tree) {
            var allSelected = true;
            for (var i in tree) {
                var node = tree[i];
                if (!node.selected) allSelected = false;
                else if (node.type == 'user') {
                    _selectedUserIds.push(node.id);
                    _selectedUserNames.push(node.name);
                }
                var allChildrenSelected = _updateSelectedIds(node.children);
                if (!allChildrenSelected) allSelected = false;
            }
            return allSelected;
        }
    }

    //---------------------------------------------------------------------------------------------
    // On Send and afterwards code
    //---------------------------------------------------------------------------------------------
    function _onSendAssignment(e, parentScope, sendAssignmentDlg) {
        function _onSendButtonClicked() {
            if(e) e.preventDefault(e); 
            if (!_assertUgCount()) return;
            var starttime = sendAssignmentDlg.scope.data.starttime || '';
            var endtime = sendAssignmentDlg.scope.data.endtime || '';
            var maxduration = sendAssignmentDlg.scope.data.maxduration;
            if (!_asertStartEndDurations(starttime, endtime, maxduration)) return;
            _updateSelectedUsers();
            if (_selectedUserIds.length == 0) return _alertWhenNoUsers();
    
            if(starttime) starttime = nl.fmt.date2UTCStr(starttime, 'second');
            if(endtime) endtime = nl.fmt.date2UTCStr(endtime, 'second');
        
        	var learnmode = sendAssignmentDlg.scope.data.showAnswers.id;
        	var data = {lessonid: sendAssignmentDlg.scope.assignInfo.id,
    					type : sendAssignmentDlg.scope.assignInfo.type,
    					orgunits:_selectedOuList, 
    					selectedusers: _selectedUserIds,
    					not_before: starttime, 
    					not_after: endtime,
    					learnmode: learnmode,
    					forum: sendAssignmentDlg.scope.data.forum || false,
    					max_duration: maxduration,
    					remarks: sendAssignmentDlg.scope.data.remarks || ''
    					};

			_confirmAndSend(data);
    	}
    	
        function _asertStartEndDurations(starttime, endtime, maxduration) {
            if (!endtime) return true;
            maxduration = maxduration ? parseInt(maxduration) : 0;
            
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

        function _updateSelectedUsers() {
            if (_selectedUserIds.length > 0) return;
            _selectedUserNames = [];
            for (var i=0; i<_selectedOuList.length; i++) {
                var ouUsers = _ou2Users[_selectedOuList[i]];
                for (var j=0; j<ouUsers.length; j++) {
                    var u = ouUsers[j];
                    _selectedUserIds.push(u.id);
                    _selectedUserNames.push(u.name);
                }
            }
        }
        
    	function _confirmAndSend(data) {
    		var sendAssignmentAfterConfirmDlg = nlDlg.create(parentScope);
			sendAssignmentAfterConfirmDlg.setCssClass('nl-height-max nl-width-max');
			sendAssignmentAfterConfirmDlg.scope.userList = _selectedUserNames;
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
			sendAssignmentAfterConfirmDlg.show('view_controllers/assignment/confirm_before_send_dlg.html',
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
            var afterAssignmentSentDlg = nlDlg.create(parentScope);
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

        _onSendButtonClicked();
    }

    //---------------------------------------------------------------------------------------------
    // Common utility functions
    //---------------------------------------------------------------------------------------------
    function _alertWhenNoUsers() {
        nlDlg.popupAlert({title:'Please select', template:nl.t('There are no users in the class(es)/ user group(s) you selected')});
        return false;
    }

    function _assertUgCount() {
        if(_selectedOuList.length > 0) return true;
        nlDlg.popupAlert({title:nl.t('Please select'),
            template:nl.t('You may choose to send assignment to subset of users once you select the class/user group. Please select the user group first.')});
        return false; 
    }

    function _updateSelectedUgsText(sendAssignmentDlg) {
        sendAssignmentDlg.scope.data.visibleToGroupLength = _selectedOuList.length; 
        if(_selectedOuList.length == 1) {
            sendAssignmentDlg.scope.data.visibleto = _selectedOuList[0];
        } else if (_selectedOuList.length > 1) {
            sendAssignmentDlg.scope.data.visibleto = nl.t('{} classes/user groups selected', _selectedOuList.length);
        }
    }

    function _updateSelectedUsersText(sendAssignmentDlg) {
        sendAssignmentDlg.scope.data.visibleToUsersLength = _selectedUserIds.length;
        if(_selectedUserIds.length == 0)
             sendAssignmentDlg.scope.data.visibleToUsers = nl.t('Will be sent to all users by default');
        if(_selectedUserIds.length == 1)
             sendAssignmentDlg.scope.data.visibleToUsers = _selectedUserNames[0];
        if(_selectedUserIds.length > 1)
             sendAssignmentDlg.scope.data.visibleToUsers = nl.t('{} users selected', _selectedUserNames.length);
    }

    function _arrayToDict(arr) {
        var ret = {};
        for(var i=0; i<arr.length; i++) {
            ret[arr[i]] = true;
        }
        return ret;
    }
}];
//-------------------------------------------------------------------------------------------------

module_init();
})();

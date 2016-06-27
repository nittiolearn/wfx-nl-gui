(function() {

//-------------------------------------------------------------------------------------------------
// forum.js:
// Forum module for experimentation
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.forum', [])
    .directive('nlForumToolbar', ForumToolbarDirective)
    .directive('nlForumInput', ForumInputDirective)
    .directive('nlForumMsg', ForumMsgDirective)
	.config(configFn).controller('nl.ForumCtrl', ForumCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.forum', {
		url : '^/forum',
		views : {
			'appContent' : {
				templateUrl : 'view_controllers/forum/forum.html',
				controller : 'nl.ForumCtrl'
			}
		}
	});
}];

//-------------------------------------------------------------------------------------------------
var ForumToolbarDirective = ['nl',
function(nl) {
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/forum/forum_toolbar.html',
        scope: true
    };
}];

//-------------------------------------------------------------------------------------------------
var ForumInputDirective = ['nl',
function(nl) {
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/forum/forum_input.html',
        scope: {
            pscope: '='
        }
    };
}];

//-------------------------------------------------------------------------------------------------
var ForumMsgDirective = ['nl',
function(nl) {
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/forum/forum_msg.html',
        scope: {
            msg: '='
        }
    };
}];

//-------------------------------------------------------------------------------------------------
var ForumCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlServerApi', 'nlMarkup', 'nlExporter',
function(nl, nlRouter, $scope, nlDlg, nlServerApi, nlMarkup, nlExporter) {
	var serverParams = {};
	var messageMgr = new MessageManager(nl, nlRouter, nlServerApi, nlMarkup);
    var forumInputDlg = new ForumInputDlg(nl, nlDlg, $scope);
	
    $scope.showingDetails = false;
    $scope.inputDlgScope = $scope;
    _updateShowDetailsIcon();
    
	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
			var params = nl.location.search();
			if (!('forumtype' in params) || !('refid' in params)) {
				resolve(false);
				return false;
			}
            $scope.canShowDetails = nlRouter.isPermitted(userInfo, 'forum_view_details');
            $scope.currentTopicId = 0;
            $scope.since = null;
            $scope.msgCount = 0;
            $scope.moreResults = true;

			serverParams = {forumtype: params.forumtype, refid: params.refid};
			if ('secid' in params) {
			    serverParams.secid = params.secid;
			} else if ('secid2' in params) {
                serverParams.secid2 = params.secid2;
			}
            $scope.canStartTopic = _canStartTopic(serverParams, userInfo);
            nl.pginfo.pageTitle = _getPageTitle(serverParams);
            $scope.mentorView = _isMentorView(serverParams);

            var extraParams = {};
            var serverFn = nlServerApi.forumGetMsgs;
            if (params.topic) {
                var text = nl.t('Discussion topic automatically created by the first user.');
                extraParams = {title: params.topic, text: text, parentid: -1};
                serverFn = nlServerApi.forumCreateOrModifyMsg;
            }
            
            _updateServer(serverFn, extraParams, true)
			.then(function() {
                $scope.currentTopicId = messageMgr.getTopicMsgId(params.topic);
                resolve(true);
			}, function(error) {
			    resolve(false);
			});
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    //-------------------------------------------------------------------------
    // Button handlers for the main view
    $scope.download = function() {
        _download();
    };
    
    $scope.showPostNewTopicDlg = function() {
        forumInputDlg.newTopic();
    };

    $scope.showPostNewMessageDlg = function() {
        var msg = messageMgr.getMsg($scope.currentTopicId);
        forumInputDlg.newMessage(msg);
    };
    
    $scope.showEditMsgDlg = function(msg) {
        forumInputDlg.editMessage(msg);
    }

    $scope.inputDlgCancel = function() {
        forumInputDlg.hide();
    };

    $scope.inputDlgOk = function() {
        if (!forumInputDlg.validate()) return;
        if ($scope.inputDlg.newTopic) {
            var extraParams = {title: $scope.data.title, text: $scope.data.text, parentid: 0};
            _updateServer(nlServerApi.forumCreateOrModifyMsg, extraParams);
        } else if ($scope.inputDlg.newMessage) {
            var extraParams = {title: '', text: $scope.data.text, parentid: $scope.inputDlg.msg.id};
            _updateServer(nlServerApi.forumCreateOrModifyMsg, extraParams);
        } else if ($scope.inputDlg.editMessage) {
            var extraParams = {title: $scope.data.title, text: $scope.data.text, msgid: $scope.inputDlg.msg.id};
            _updateServer(nlServerApi.forumCreateOrModifyMsg, extraParams);
        }
        forumInputDlg.hide();
    };
    
    $scope.getTopicName = function() {
        if (!$scope.currentTopicId) return nl.t('Discussion topics');
        var msg = messageMgr.getMsg($scope.currentTopicId);
        return msg.title;
    }
    
    $scope.collapseAll = function() {
        forumInputDlg.hide();
        $scope.currentTopicId = 0;
    };
    
    $scope.showHideMsgDetails = function() {
        $scope.showingDetails = !$scope.showingDetails;
        _updateShowDetailsIcon();
    }
    
    function _updateShowDetailsIcon() {
        if ($scope.showingDetails) {
            $scope.msgDetails = {title: nl.t('Hide message details'),
                icon: nl.url.resUrl('less.png')};
        } else {
            $scope.msgDetails = {title: nl.t('Show message details'),
                icon: nl.url.resUrl('more.png')};
        }
    }
    
    $scope.refreshDataFromServer = function() {
        _refreshDataFromServer();
    };

    $scope.loadOlderMessages = function() {
        _loadOlderMessages();
    };
    
    //-------------------------------------------------------------------------
    // Handlers for each message row
    $scope.expandCollapseMsg = function(msg) {
        var shouldExpand = ($scope.currentTopicId != msg.id);
        $scope.collapseAll();
        if (shouldExpand) {
            $scope.currentTopicId = msg.id;
        }
    };

    $scope.canReply = function(msgId) {
        var msg = messageMgr.getMsg(msgId);
        return msg ? msg.canReply : false;
    };

    $scope.deleteMsg = function(msg) {
        var template = '';
        if (msg.parentid == 0) {
            template = nl.t('Deleting a topic will delete all messages under the topic too. ');
        }
        template += nl.t('Are you sure you want to delete? This cannot be undone.');
        var txt = {title: nl.t('Please confirm'), 
                   template: template,
                   okText: nl.t('Delete')};
        nlDlg.popupConfirm(txt).then(function(result) {
            if (!result) return;
            _postDelete(msg);
        });
    };

    function _postDelete(msg) {
        _updateServer(nlServerApi.forumDeleteMsg, {msgid: msg.id});
    };

    //-------------------------------------------------------------------------
    function _updateForumData(forumInfo) {
        $scope.msgTree = messageMgr.updateMessages(forumInfo.msgs);
        $scope.since = messageMgr.range_since ? nl.fmt.date2Str(messageMgr.range_since) : '';
        $scope.msgCount = 0;
        for (var key in messageMgr.idToMsg) $scope.msgCount++;
        var msg = messageMgr.getMsg($scope.currentTopicId);
        if (!msg) $scope.currentTopicId = 0;
    }
    
    function _refreshDataFromServer() {
        _updateServer(nlServerApi.forumGetMsgs, {});
    }
    
    function _loadOlderMessages() {
        _updateServer(nlServerApi.forumGetMsgs, {till: messageMgr.range_since})
        .then(function(forumInfo) {
            $scope.moreResults = (forumInfo.moreResults == true);
        });
    }

    function _updateServer(nlServerApiFn, extraParams, noLoadingScreen) {
        var params = angular.copy(serverParams);
        for (var key in extraParams) {
            params[key] = extraParams[key];
        }
        if (messageMgr.range_till && !('till' in params)) params.since = messageMgr.range_till;
        if (!noLoadingScreen) nlDlg.showLoadingScreen();
        return nlServerApiFn(params).then(function(forumInfo) {
            if (!noLoadingScreen) nlDlg.hideLoadingScreen();
            _updateForumData(forumInfo);
            return forumInfo;
        });
    }
    
    var FT_MENTOR = 1;
    var FT_ASSIGNMENT = 2;
    var FT_COURSE_ASSIGNMENT = 3;
    
    function _canStartTopic(params, userInfo) {
        if (params.forumtype == FT_MENTOR) return params.refid != 0;
        return nlRouter.isPermitted(userInfo, 'forum_start_topic');
    }

    function _getPageTitle(params) {
        if (params.forumtype == FT_MENTOR) return nl.t('Mentor Desk');
        return nl.t('Discussion Forum');
    }
    
    function _isMentorView(params) {
        if (params.forumtype == FT_MENTOR) return params.refid == 0;
        
    }

    function _download() {
        var msgTree = $scope.msgTree;
        var arrayList = [['User name', 'Type', 'Created', 'Updated', 'Topic', 'Message']];
        for(var i=0; i<msgTree.length; i++) {
            var topic = msgTree[i];
            arrayList.push([topic.authorname, 'topic', topic.htmlCreated, topic.htmlUpdated, topic.title, topic.text]);
            var msgs  = topic.children;
            for(var j=0; j<msgs.length; j++) {
                var msg = msgs[j];
                arrayList.push([msg.authorname, 'message', msg.htmlCreated, msg.htmlUpdated, topic.title, msg.text]);
            }
        }
        var fileName = nl.fmt2('Forum-{}.csv', nl.fmt.date2Str(new Date(), 'date'));
        nlExporter.exportArrayTableToCsv(fileName, arrayList);
    }
}];

//-------------------------------------------------------------------------------------------------
function ForumInputDlg(nl, nlDlg, $scope) {
    
    function _initDlgScope() {
        $scope.error = {};
        $scope.data = {title: '', text: ''};
        $scope.inputDlg = {newTopic: false, newMessage: false, editMessage: false,
                           canShowTitle: true, okButtonName: nl.t('Send'), msg: null,
                           focusTitle: false, focusText: false};
    }
    _initDlgScope();
    
    this.hide = function() {
        _initDlgScope();
    }
    
    this.newTopic = function() {
        _initDlgScope();
        $scope.inputDlg.newTopic = true;
        $scope.inputDlg.focusTitle = true;
    }

    this.newMessage = function(msg) {
        _initDlgScope();
        $scope.inputDlg.newMessage = true;
        $scope.inputDlg.canShowTitle = false;
        $scope.inputDlg.msg = msg;
        $scope.inputDlg.focusText = true;
    }

    this.editMessage = function(msg) {
        _initDlgScope();
        $scope.inputDlg.editMessage = true;
        $scope.inputDlg.okButtonName = nl.t('Update');
        $scope.inputDlg.canShowTitle = (msg.parentid == 0);
        $scope.inputDlg.msg = msg;
        $scope.data = {title: msg.title, text: msg.text};
        $scope.inputDlg.focusText = true;
    }

    this.validate = function() {
        $scope.error = {};
        if ($scope.inputDlg.canShowTitle && $scope.data.title === '') {
            return nlDlg.setFieldError($scope, 'title',
                nl.t('Please enter the topic'));
        }
        if (!$scope.inputDlg.canShowTitle && $scope.data.text === '') {
            return nlDlg.setFieldError($scope, 'text',
                nl.t('Please enter some text'));
        }
        return true;
    }

};

//-------------------------------------------------------------------------------------------------
function MessageManager(nl, nlRouter, nlServerApi, nlMarkup) {

    function _initDataStructure(self) {
        self.idToMsg = {};
        self.msgTree = [];
        self.range_since = null;
        self.range_till = null;
        self.msgTopics = {};
    }
    _initDataStructure(this);
    
    this.updateMessages = function(msgs) {
        var userInfo = nlServerApi.getCurrentUserInfo();
        _updateMap(this, msgs, userInfo);
        this.msgTree = _getMsgTree(this);
        _sortMsgTreeAndUpdateTitles(this);
        return this.msgTree;
    };
    
    this.getMsg = function(msgid) {
        return (msgid in this.idToMsg ? this.idToMsg[msgid] : null);
    };

    this.getTopicMsgId = function(topic) {
        if (topic && topic in this.msgTopics) return this.msgTopics[topic];
        return 0;
    }

    function _updateMap(self, msgs, userInfo) {
        for (var i=0; i<msgs.length; i++) {
            var msg = msgs[i];
            _initAttributes(self, msg, userInfo);
            self.range_since = _minOf(self.range_since, msg.updated);
            self.range_till = _maxOf(self.range_till, msg.updated);
            if (msg.deleted) {
                delete self.idToMsg[msg.id];
                continue;
            }
            self.idToMsg[msg.id] = msg;
        }
        _deleteOrphans(self);
    }
    
    function _deleteOrphans(self) {
        var toDelete = [];
        for(var msgid in self.idToMsg) {
            var parentid = self.idToMsg[msgid].parentid;
            if (parentid == 0 || parentid in self.idToMsg) continue;
            toDelete.push(msgid);
        }
        for(var i=0; i<toDelete.length; i++) delete self.idToMsg[toDelete[i]];
    }
    
    function _getMsgTree(self) {
        var msgTree = [];
        for (var msgid in self.idToMsg) {
            var msg = self.idToMsg[msgid];
            msg.children = [];
        }
        for (var msgid in self.idToMsg) {
            var msg = self.idToMsg[msgid];
            if (msg.parentid == 0) {
                msgTree.push(msg);
            } else if (msg.parentid in self.idToMsg) {
                self.idToMsg[msg.parentid].children.push(msg);
            }
        }
        return msgTree;
    }

    function _sortMsgTreeAndUpdateTitles(self) {
        self.msgTree.sort(function(a, b) {
            return b.updated - a.updated;
        });
        self.msgTopics = {};
        for(var i=0; i<self.msgTree.length; i++) {
            var msg = self.msgTree[i];
            self.msgTopics[msg.title] = msg.id;
            msg.children.sort(function(a, b) {
                return a.created - b.created;
            });
        }
    }

    function _initAttributes(self, msg, userInfo) {
        msg.updated = nl.fmt.json2Date(msg.updated);
        msg.created = nl.fmt.json2Date(msg.created);
        
        msg.htmlCreated = nl.fmt.date2Str(msg.created);
        msg.htmlUpdated = nl.fmt.date2Str(msg.updated);

        msg.canReply = (msg.parentid == 0);
        msg.canEdit = (userInfo.userid == msg.author);
        msg.canDelete = nlRouter.isPermitted(userInfo, 'forum_delete_msg');
        msg.children = [];

        msg.userIcon = nl.url.resUrl('user.png');
        var retData = {lessPara: true};
        msg.htmlMarkup = nlMarkup.getHtml(msg.text, retData);
    }

    function _minOf(a, b) {
        return (a && a < b) ? a : b;
    }
    
    function _maxOf(a, b) {
        return (a && a > b) ? a : b;
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

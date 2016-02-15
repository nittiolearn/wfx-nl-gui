(function() {

//-------------------------------------------------------------------------------------------------
// forum.js:
// Forum module for experimentation
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.forum', [])
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
var ForumInputDirective = ['nl',
function(nl) {
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/forum/forum_input.html',
        scope: true
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
var DEFAULT_EXPANDED = true;

var ForumCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlServerApi', 'nlMarkup',
function(nl, nlRouter, $scope, nlDlg, nlServerApi, nlMarkup) {
	var serverParams = {};
	var messageMgr = new MessageManager(nl, nlServerApi, nlMarkup);
    var postNewDlg = new PostNewDialog(nl, $scope);
	
	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
			var params = nl.location.search();
			if (!('forumtype' in params) || !('refid' in params)) {
				resolve(false);
				return false;
			}
            $scope.expanded = DEFAULT_EXPANDED;
            _updateExpandAllButton();
            $scope.showingDetails = false;

			$scope.hidePostNewButton = (params.forumtype == 1 && params.refid == 0);

			serverParams = {forumtype: params.forumtype, refid: params.refid,
			    secid: ('secid' in params) ? params.secid : 0};
            nl.pginfo.pageTitle = _getPageTitle(serverParams);
			nlServerApi.forumGetMsgs(serverParams).then(function(forumInfo) {
			    _updateForumData(forumInfo);
				resolve(true);
			}, function(error) {
			    resolve(false);
			});
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    //-------------------------------------------------------------------------
    // Button handlers for the main view
    var postNewDlgShown = false;
    $scope.showPostNewDlg = function() {
        postNewDlgShown = !postNewDlgShown;
        if (postNewDlgShown) {
            postNewDlg.show(null);
        } else {
            postNewDlg.hide();
        }
    };

    $scope.expandCollapseAll = function() {
        _expandCollapseAll(!$scope.expanded);
    };
    
    function _expandCollapseAll(state) {
        $scope.expanded = state;
        _updateExpandAllButton();
        messageMgr.expandCollapseAll($scope.expanded);
    };

    $scope.showHideMsgDetails = function() {
        $scope.showingDetails = !$scope.showingDetails;
        if ($scope.showingDetails) _expandCollapseAll(true);
    }

    $scope.refreshDataFromServer = function() {
        _refreshDataFromServer();
    };

    //-------------------------------------------------------------------------
    // Button handlers for forum_input dialog
    $scope.postNewMessage = function() {
        if (!postNewDlg.validate()) return;
        _postNew($scope.postNewDlg.parentMsg);
        postNewDlg.hide();
    };
    
    $scope.hidePostNewDlg = function() {
        postNewDlg.hide();
    };
    
    //-------------------------------------------------------------------------
    // Handlers for each message row
    $scope.expandCollapseMsg = function(msg) {
        msg.expanded = !msg.expanded;
    };

    $scope.replyMsg = function(msg) {
        if (msg.replying) {
            postNewDlg.hide();
        } else {
            postNewDlg.show(msg);
        }
    };
    
    $scope.deleteMsg = function(msg) {
        var txt = {title: 'Please confirm', 
                   template: 'Are you sure you want to delete? This cannot be undone.',
                   okText: nl.t('Delete')};
        nlDlg.popupConfirm(txt).then(function(result) {
            if (!result) return;
            _postDelete(msg);
        });
    };

    var beforeEdit = {};
    $scope.editMsg = function(msg) {
        msg.editing = !msg.editing;
        if (msg.editing) {
            beforeEdit = {text: msg.text, title: msg.title};
        } else {
            msg.text = beforeEdit.text;
            msg.title = beforeEdit.title;
        }
    }

    //-------------------------------------------------------------------------
    // Button handlers for message edit dialog
    $scope.onEditMsgDone = function(msg) {
        if (beforeEdit.text == msg.text && beforeEdit.title == msg.title) {
            $scope.onEditMsgCancel(msg);
            return;
        }
        _postUpdate(msg);
        msg.editing = false;
    };

    $scope.onEditMsgCancel = function(msg) {
        if (!msg.editing) return;
        msg.text = beforeEdit.text;
        msg.title = beforeEdit.title;
        msg.editing = false;
    };

    //-------------------------------------------------------------------------
    function _updateExpandAllButton() {
        $scope.expandAllButton = $scope.expanded ? nl.url.resUrl('toolbar-edit/up.png') : nl.url.resUrl('toolbar-edit/down.png');
    }

    function _updateForumData(forumInfo) {
        $scope.msgTree = messageMgr.updateMessages(forumInfo.msgs);
    }
    
    function _postNew(msg) {
        var extraParams = {title: msg ?  '' : $scope.data.title, text: $scope.data.text, parentid: msg ? msg.id : 0};
        _updateServer(nlServerApi.forumCreateOrModifyMsg, extraParams);
	};
	
    function _postUpdate(msg) {
        var extraParams = {title: msg.title, text: msg.text, msgid: msg.id};
        _updateServer(nlServerApi.forumCreateOrModifyMsg, extraParams);
    };

    function _postDelete(msg) {
        _updateServer(nlServerApi.forumDeleteMsg, {msgid: msg.id});
    };

    function _refreshDataFromServer() {
        _updateServer(nlServerApi.forumGetMsgs, {});
    }

    function _updateServer(nlServerApiFn, extraParams) {
        var params = angular.copy(serverParams);
        for (var key in extraParams) {
            params[key] = extraParams[key];
        }
        params.since = messageMgr.range_till;
        $scope.hidePostNewDlg();
        nlDlg.showLoadingScreen();
        nlServerApiFn(params).then(function(forumInfo) {
            nlDlg.hideLoadingScreen();
            _updateForumData(forumInfo);
        });
    };
    
    var FT_MENTOR = 1;
    var FT_ASSIGNMENT = 2;
    var FT_COURSE_ASSIGNMENT = 3;
    
    function _getPageTitle(params) {
        if (params.forumtype == FT_MENTOR) return nl.t('Mentor Desk');
        return nl.t('Discussion Forum');
    }
}];

//-------------------------------------------------------------------------------------------------
function PostNewDialog(nl, $scope) {
    
    function _initDlgScope() {
        if (('postNewDlg' in $scope) && ('parentMsg' in $scope.postNewDlg)) {
            if ($scope.postNewDlg.parentMsg) $scope.postNewDlg.parentMsg.replying = false;
        }
        $scope.error = {};
        $scope.data = {title: '', text: ''};
        $scope.postNewDlg = {visible: false, canShowTitle: true, parentMsg: null, postButtonName: ''};
    }
    _initDlgScope();
    
    this.hide = function() {
        _initDlgScope();
    }
    
    this.show = function(parentMsg) {
        _initDlgScope();
        if (parentMsg) parentMsg.replying = true;
        $scope.postNewDlg.visible = true;
        $scope.postNewDlg.canShowTitle = (parentMsg == null);
        $scope.postNewDlg.parentMsg = parentMsg;
        $scope.postNewDlg.postButtonName = parentMsg ? nl.t('Post reply') : nl.t('Post message');
    }

    this.validate = function() {
        $scope.error = {};
        if (!$scope.postNewDlg.parentMsg && $scope.data.title === '') {
            return nlDlg.setFieldError($scope, 'title',
                nl.t('Please enter the title for your message'));
        }
        if ($scope.postNewDlg.parentMsg && $scope.data.text === '') {
            return nlDlg.setFieldError($scope, 'text',
                nl.t('Please enter some text'));
        }
        return true;
    }

};

//-------------------------------------------------------------------------------------------------
function MessageManager(nl, nlServerApi, nlMarkup) {

    function _initDataStructure(self) {
        self.idToMsg = {};
        self.msgTree = [];
        self.range_since = null;
        self.range_till = null;
    }
    _initDataStructure(this);
    
    this.updateMessages = function(msgs) {
        var userInfo = nlServerApi.getCurrentUserInfo();
        _updateMap(this, msgs, userInfo);
        this.msgTree = _getMsgTree(this);
        _sortMsgTree(this);
        return this.msgTree;
    };

    this.expandCollapseAll = function(bExpanded) {
        for(var i=0; i<this.msgTree.length; i++) {
            var msg = this.msgTree[i];
            msg.expanded = bExpanded;
        }
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
    }
    
    function _getMsgTree(self) {
        var msgTree = [];
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

    function _sortMsgTree(self) {
        self.msgTree.sort(function(a, b) {
            return b.updated - a.updated;
        });
        for(var i=0; i<self.msgTree.length; i++) {
            var msg = self.msgTree[i];
            msg.children.sort(function(a, b) {
                return a.created - b.created;
            });
        }
    }

    function _initAttributes(self, msg, userInfo) {
        var msgOld = (msg.id in self.idToMsg) ? self.idToMsg[msg.id] : null;

        msg.updated = nl.fmt.json2Date(msg.updated);
        msg.created = nl.fmt.json2Date(msg.created);
        
        msg.htmlCreated = nl.fmt.date2Str(msg.created);
        msg.htmlUpdated = nl.fmt.date2Str(msg.updated);
        msg.expanded = (msgOld != null) ? msgOld.expanded : DEFAULT_EXPANDED;
        msg.editing = false;
        msg.replying = false;

        msg.canReply = (msg.parentid == 0);
        msg.canEdit = (userInfo.userid == msg.author);
        msg.canDelete = msg.canEdit;
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

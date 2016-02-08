(function() {

//-------------------------------------------------------------------------------------------------
// forum.js:
// Forum module for experimentation
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.forum', [])
    .directive('nlForumInput', ForumInputDirective)
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
var ForumCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlServerApi', 'nlMarkup',
function(nl, nlRouter, $scope, nlDlg, nlServerApi, nlMarkup) {
	var serverParams = {};
	var messageMgr = new MessageManager(nl);
	
	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
			var params = nl.location.search();
			if (!('forumtype' in params) || !('refid' in params)) {
				resolve(false);
				return false;
			}
			$scope.hidePostNewButton = (params.forumtype == 1 && params.refid == 0);
            $scope.msgs = [];
            _initDlgScope();

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
    // Utility functions used in the view
	$scope.fmtDate = function(msgDate) {
		return nl.fmt.date2Str(msgDate);
	};

	$scope.getUserIcon = function(msg) {
		return nl.url.resUrl('user.png');
	};

    //-------------------------------------------------------------------------
    // Button handlers for the main view
    $scope.showPostNewDlg = function() {
        $scope.hidePostNewDlg();
        $scope.postNewDlg.visible = true;
    };

    $scope.showHideAllMessageDetails = function() {
        _showHideAllRows($scope.msgs, !$scope.expanded);
    };

    $scope.refreshDataFromServer = function() {
        _refreshDataFromServer();
    };

    //-------------------------------------------------------------------------
    // Button handlers for forum_input dialog
    $scope.postNewMessage = function() {
        if (!_validate($scope.postNewDlg.parentMsg)) return;
        _postNew($scope.postNewDlg.parentMsg);
    };
    
    $scope.hidePostNewDlg = function() {
        if ($scope.postNewDlg.parentMsg) $scope.postNewDlg.parentMsg.showReplyDlg = false;
        _initDlgScope();
    };
    
    //-------------------------------------------------------------------------
    // Handlers for each message row
    $scope.showHideMessageDetails = function(msg) {
        msg.hidden_text = !msg.hidden_text;
        var children = messageMgr.getChildren(msg.id);
        if (!children) return;
        for (var i=0; i < children.length; i++) {
            children[i].hidden_title = msg.hidden_text;
            children[i].hidden_text = msg.hidden_text;
        }
    };

    $scope.reply = function(msg) {
        $scope.hidePostNewDlg();
        msg.showReplyDlg = true;
        $scope.data.parentid = msg.id;
        $scope.postNewDlg.canShowTitle = false;
        $scope.postNewDlg.postButtonName = nl.t('Post reply');
        $scope.postNewDlg.parentMsg = msg;
    };

    //-------------------------------------------------------------------------
    // Private function
    function _updateForumData(forumInfo) {
        $scope.msgs = messageMgr.addMessages(forumInfo.msgs);
        _showHideAllRows($scope.msgs, true);
    }
    
    function _showHideAllRows(msgs, bShow) {
        for (var i=0; i<msgs.length; i++) {
            msgs[i].hidden_title = (msgs[i].indentationLevel) ? !bShow : false;
            msgs[i].hidden_text = !bShow;
            msgs[i].showReplyDlg = false;
            var retData = {lessPara: true};
            msgs[i].htmlMarkup = nlMarkup.getHtml(msgs[i].text, retData);
        }
        $scope.expanded = bShow;
        $scope.showHideAllButtonName = $scope.expanded ? nl.t('Collapse all') : nl.t('Expand all');
    }

    function _initDlgScope() {
        $scope.error = {};
        $scope.data = {title: '', text: '', parentid: 0};
        $scope.postNewDlg = {visible: false, canShowTitle: true, parentMsg: null, postButtonName: nl.t('Post message')};
    }

    function _validate(msg) {
        $scope.error = {};
        if (!msg && $scope.data.title === '') {
        	return nlDlg.setFieldError($scope, 'title',
            	nl.t('Please enter the title for your message'));
        }
        if (msg && $scope.data.text === '') {
        	return nlDlg.setFieldError($scope, 'text',
            	nl.t('Please enter your reply'));
        }
        return true;
    }
    
    function _postNew(msg) {
		var params = angular.copy(serverParams);
        params.title = msg ?  msg.title : $scope.data.title;
        params.text = $scope.data.text;
        params.parentid = $scope.data.parentid;
		$scope.hidePostNewDlg();
        nlDlg.showLoadingScreen();
		nlServerApi.forumCreateMsg(params).then(function(forumInfo) {
            nlDlg.hideLoadingScreen();
            _updateForumData(forumInfo);
		});
	};
	
	function _refreshDataFromServer() {
        nlDlg.showLoadingScreen();
        nlServerApi.forumGetMsgs(serverParams).then(function(forumInfo) {
            nlDlg.hideLoadingScreen();
            _updateForumData(forumInfo);
        });
	}

    var FT_MENTOR = 1;
    var FT_ASSIGNMENT = 2;
    var FT_COURSE_ASSIGNMENT = 3;
    
    function _getPageTitle(params) {
        if (params.forumtype == FT_MENTOR) return nl.t('Mentor Desk');
        return nl.t('Discussion Forum');
    }
}];

function MessageManager(nl) {
    
    this.addMessages = function(msgs) {
        _initMaps(this);
        _updateMaps(this, msgs);
        _updateSortKeys(this, 0);
        _sortMessages(this);
        return this.msgs;
    };
    
    this.getChildren = function(msgid) {
        if (msgid in this.pidToChildren) return this.pidToChildren[msgid];
        return null;
    };

    function _initMaps(self) {
        self.msgs = [];
        self.idToMsg = {};
        self.pidToChildren = {};
    }
    
    function _updateMaps(self, msgs) {
        self.msgs = msgs;
        for (var i=0; i<msgs.length; i++) {
            var msg = msgs[i];
            self.idToMsg[msg.id] = msg;
            if (!(msg.parentid in self.pidToChildren)) self.pidToChildren[msg.parentid] = [];
            self.pidToChildren[msg.parentid].push(msg);
            msg.indentationLevel = (msg.parentid == 0) ? 0 : 1;
            msg.updated = nl.fmt.json2Date(msg.updated);
            msg.sortKey = msg.updated;
        }
    }

    function _updateSortKeys(self, pid) {
        if (!(pid in self.pidToChildren)) return;
        var me = (pid in self.idToMsg) ? self.idToMsg[pid] : null;
        var children = self.pidToChildren[pid];
        
        for(var i=0; i < children.length; i++) {
            var child = children[i];
            _updateSortKeys(self, child.id);
            if (me && me.sortKey < child.sortKey) me.sortKey = child.sortKey;
        }
    }

    function _sortMessages(self) {
        self.msgs.sort(function(a, b) {
            var groupSort = _getGroupSortKey(self, b) - _getGroupSortKey(self, a);
            if (groupSort !== 0) return groupSort;
            var levelSort = a.indentationLevel - b.indentationLevel;
            if (levelSort !== 0) return levelSort;
            return (a.sortKey - b.sortKey);
        });
    }
    
    function _getGroupSortKey(self, node) {
        if (node.indentationLevel == 0) return node.sortKey;
        if (!(node.parentid in self.idToMsg)) return 0;
        return self.idToMsg[node.parentid].sortKey;
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

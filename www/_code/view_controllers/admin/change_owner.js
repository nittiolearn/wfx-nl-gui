(function() {
//-------------------------------------------------------------------------------------------------
// change_owner.js:
// change owner
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.changeowner', []).config(configFn)
	.controller('nl.ChangeOwnerCtrl', ChangeOwnerCtrl)
	.service('nlChangeOwner', ChangeOwnerSrv);
};

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.change_owner', {
		url : '^/change_owner',
		views : {
			'appContent' : {
				templateUrl : '',
				controller : 'nl.ChangeOwnerCtrl'
			}
		}
	});
}];

//-------------------------------------------------------------------------------------------------
var ChangeOwnerCtrl = ['nl', 'nlDlg', 'nlRouter', '$scope', 'nlServerApi', 'nlChangeOwner',
function(nl, nlDlg, nlRouter, $scope, nlServerApi, nlChangeOwner) {
	var _userInfo = null;
	var _scope = null;
	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		_scope = $scope;
		return nl.q(function (resolve, reject) {
        	$scope.data = {};
			var params = nl.location.search();
			var contentid = ('id' in params) ? parseInt(params.id) : null;
			var user = ('user' in params) ? params.user : null;
			var contenttype = params.type == 'course' ? 'course' :'lesson';
			nl.pginfo.pageTitle = nl.t('Change ownership of {}{}',
				contenttype == 'lesson' ? 'module' : 'course',
				contentid ? ' ' + contentid : 's');
			nlChangeOwner.show($scope, contentid, contenttype, _userInfo, true);
			resolve(true);
		});
	}	
	nlRouter.initContoller($scope, '', _onPageEnter);
}];

var ChangeOwnerSrv = ['nl', 'nlDlg', 'nlServerApi',
function(nl, nlDlg, nlServerApi) {
	var _parentScope = null;
	var _userInfo = null;

	this.show = function(parentScope, contentid, contenttype, userInfo, isBulkOpt) {
        _parentScope = parentScope;
        _userInfo = userInfo;
        _showChangeOwnerDlg(contentid, contenttype, isBulkOpt);
	};
	
	function _showChangeOwnerDlg(contentid, contenttype, isBulkOpt) {
        var dlg = nlDlg.create(_parentScope);
        dlg.setCssClass('nl-width-max');
        dlg.scope.error = {};
		dlg.scope.dlgTitle = nl.t('Change ownership of {}{}',
			contenttype == 'lesson' ? 'module' : (contenttype == 'course_assignment') ? 'course assignment' : (contenttype == 'assignment') ? 'module assignment' : 'course',
			contentid ? ' ' + contentid : 's');
        dlg.scope.isBulkOpt = isBulkOpt || false;
        dlg.scope.data = {};
        dlg.scope.help = _getHelp(contenttype);
		dlg.scope.data.contentid = contentid || null;
		dlg.scope.data.username = _userInfo.username;
		dlg.scope.data.contenttype = contenttype;
        var changeButton = {text: nl.t('Change owner'), onTap: function(e) {
        	if(!_validateInputs(dlg.scope)) {
	    		e.preventDefault();
        		return;
        	}
        	nlDlg.showLoadingScreen();
        	_onChangeOwner(dlg.scope);
        }};
		var cancelButton = {text: nl.t('Close'), onTap: function(e) {
			if(isBulkOpt) nl.window.location.href = '#/home';
		}};
		dlg.show('view_controllers/admin/change_owner_dlg.html', [changeButton], cancelButton, false);
	};
	
	function _getHelp(contenttype) {
		var title = contenttype == 'lesson' ? 'Module id' : 'Course id';
		return {
			contentid: {name: title, help: nl.t('Enter the comma seperated {} ids to change ownership.', contenttype == 'lesson' ? 'module': 'course')},
			username: {name: nl.t('User name'), help: nl.t('Enter the username of the user to whom the ownership has to be transfered to.')}
		};
	}
	
	function _validateInputs(dlgScope) {
        if (!dlgScope.data.contentid) return _validateFail(dlgScope, 'contentid', 'Please enter ids to change their ownership.');
        if (!dlgScope.data.username) return _validateFail(dlgScope, 'username', 'Please enter the new owner name to change the ownership of selected module.');
        return true;
    }
                    
    function _validateFail(scope, attr, errMsg) {
        return nlDlg.setFieldError(scope, attr, nl.t(errMsg));
    }
    
    function _onChangeOwner(dlgScope) {
        var idArray = [];
    	if(!dlgScope.isBulkOpt) {
    		idArray.push(dlgScope.data.contentid);
    	} else {
    		if(typeof dlgScope.data.contentid == 'number') {
    			idArray.push(dlgScope.data.contentid);
			} else {
		        var ids = dlgScope.data.contentid.split(',');
		        for(var i=0; i<ids.length; i++) {
		        	idArray.push(parseInt(ids[i]));
		        }
			}
    	};
    	var data = {contentids: idArray, owner: dlgScope.data.username, contenttype: dlgScope.data.contenttype};
    	nlServerApi.changeOwner(data).then(function(result) {
        	nlDlg.hideLoadingScreen();
    		if(result) {
    			var param = dlgScope.data.contenttype == 'lesson' ? 'lesson' : dlgScope.data.contenttype == 'course_assignment' ? 'course_assignment' : dlgScope.data.contenttype == 'assignment' ? 'module assignment' : 'course';
    			param += (idArray.length > 1) ? 's are' : ' '+'is';
    			var msg = {title: nl.t('Owner modified'), template: nl.t('The owner of selected {} modified to {}', param, result.owner)};
    			if(dlgScope.isBulkOpt) {
    				msg['okText'] = nl.t('Change again');
	    			nlDlg.popupConfirm(msg).then(function(res) {
	    				if(res) 
	    					_showChangeOwnerDlg('', dlgScope.data.contenttype, dlgScope.isBulkOpt);
	    				else
	    					nl.window.location.href = '#/home';
	    			});
    			} else {
	    			return nlDlg.popupAlert(msg).then(function() {
	    				nlDlg.showLoadingScreen();
	    				nl.window.location.reload();
	    			});
    			}
    		}
    	}, function(e) {
			_showChangeOwnerDlg(dlgScope.data.contentid, dlgScope.data.contenttype, dlgScope.isBulkOpt);
    	});
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

(function() {

//-------------------------------------------------------------------------------------------------
// module_review_dlg.js:
// module editor -> page properties dlg module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.nittiolesson.module_review', [])
	.service('NittioLessonModuleReviewDlg', NittioLessonModuleReviewSrv);
}

//-------------------------------------------------------------------------------------------------
var NittioLessonModuleReviewSrv = ['nl', 'nlDlg', 'nlGroupInfo', 'nlOuUserSelect', 'nlServerApi', 'nlRouter',
function(nl, nlDlg, nlGroupInfo, nlOuUserSelect, nlServerApi, nlRouter) {
	var _uiParams = null;
	var _oLesson = null;
	var _reviewerSelector = {};
	this.init = function(oLesson) {
		_oLesson = oLesson;
	    _uiParams = [{id: 'remarks', name: nl.t('Remarks'), type: 'textarea',
	                  help: nl.t('Remarks to reviewers.')},
	                 {id: 'reviewers', name: nl.t('Reviewers'), type: 'tree-select',
	    			  help: nl.t('Choose one or more reviewers to send the learning module for review.')}];
	};

	this.sendForReview = function(lessonId) {
		return nl.q(function(resolve, reject) {
			nlRouter.getUserInfo('', function(userInfo) {
				nlGroupInfo.onPageEnter(userInfo);
				nlGroupInfo.init2().then(function() {
					_sendForReview(lessonId, resolve);
				});
			});
		});	
	};
	
	function _sendForReview(lessonId, resolve) {
		nlGroupInfo.update();
		var dontShowUsers = nlGroupInfo.getAllUserIdsWithoutPerm('lesson_create');
		var parentScope = nl.rootScope;

        _reviewerSelector = nlOuUserSelect.getOuUserSelector(parentScope, 
            nlGroupInfo.get(), {}, dontShowUsers);
		var moduleReviewDlg = nlDlg.create(parentScope);
		moduleReviewDlg.setCssClass('nl-height-max nl-width-max');

		var dlgScope = moduleReviewDlg.scope;
		dlgScope.dlgTitle = nl.t('Invite for review');
		dlgScope.data = {};
		dlgScope.data.items = _uiParams;
        dlgScope.data.remarks = '';
        dlgScope.data.reviewers = '';
        dlgScope.error = {};
		dlgScope.data.canShow = function(condition, item) {
        	return true;
        };

        dlgScope.options = {reviewers: _reviewerSelector.getTreeSelect()};
        dlgScope.options.reviewers.fieldmodelid = 'reviewers';
        dlgScope.options.reviewers.treeIsShown = true;
        dlgScope.options.reviewers.multiSelect = true;
		var okButton = {text: nl.t('Invite'), onTap: function(e) {
			if(!_validateInputs(dlgScope)) {
				if(e) e.preventDefault();
				return;
			}
			nl.timeout(function() {
				nlDlg.showLoadingScreen();
				var data = {lessonid: lessonId, reviewers: _getSelectedReviewers(),
					remarks: dlgScope.data.remarks};
				nlServerApi.lessonInviteReview(data).then(function() {
					var template = nl.t('Module "{}" sent for review to {} users successfully.',
						_oLesson.name, data.reviewers.length);
					nlDlg.popupAlert({title: 'Sent for review', template: template}).then(function() {
						resolve(true);
					});
				}, function() {
					resolve(false);
				});
			});
		}};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
			resolve(false);
		}};
		moduleReviewDlg.show('lib_ui/dlg/dlgfieldsview.html', [okButton], cancelButton);
	}

	function _validateInputs(dlgScope) {
        if(Object.keys(_reviewerSelector.getSelectedUsers()).length == 0) return _validateFail(dlgScope, 'reviewers', 'Please select users from the list to inivite for review.');
		return true;
	};

    function _validateFail(scope, attr, errMsg) {
    	return nlDlg.setFieldError(scope, attr,
        	nl.t(errMsg));
    }

	function _getSelectedReviewers() {
		var reviewersDict = _reviewerSelector.getSelectedUsers();
		var ret = [];
		for(var i in reviewersDict) {
			var user = reviewersDict[i].userObj;
			ret.push({id: user.id, name: user.name});
		}
		return ret;
	}

}];
//-------------------------------------------------------------------------------------------------
module_init();
})();

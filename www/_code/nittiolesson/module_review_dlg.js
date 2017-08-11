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
var NittioLessonModuleReviewSrv = ['nl', 'nlDlg', 'nlTreeSelect', 'nlGroupInfo', 'nlOuUserSelect', 'nlServerApi',
function(nl, nlDlg, nlTreeSelect, nlGroupInfo, nlOuUserSelect, nlServerApi) {
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
			nlGroupInfo.init().then(function() {
				_sendForReview(lessonId, resolve);
			});
		});	
	};
	
	function _sendForReview(lessonId, resolve) {
		nlGroupInfo.update();
		var dontShowUsers = nlGroupInfo.getAllUserIdsWithoutPerm('lesson_create');
		var parentScope = nl.rootScope;

        _reviewerSelector = nlOuUserSelect.getOuUserSelector(parentScope, 
            nlGroupInfo.get(), {}, dontShowUsers);
        _reviewerSelector.treeIsShown = true;
        _reviewerSelector.multiSelect = true;

		var moduleReviewDlg = nlDlg.create(parentScope);
		moduleReviewDlg.setCssClass('nl-height-max nl-width-max');

		var dlgScope = moduleReviewDlg.scope;
		dlgScope.dlgTitle = nl.t('Invite for review');
		dlgScope.data = {};
		dlgScope.data.items = _uiParams;
        dlgScope.data.remarks = '';
        dlgScope.data.reviewers = null;
		dlgScope.data.canShow = function(condition, item) {
        	return true;
        };

        dlgScope.options = {reviewers: _reviewerSelector.getTreeSelect()};
        dlgScope.error = {};
        
		var okButton = {text: nl.t('Invite'), onTap: function(e) {
			nl.timeout(function() {
				nlDlg.showLoadingScreen();
				var data = {lessonid: lessonId, reviewers: _getSelectedReviewers(),
					remarks: dlgScope.data.remarks};
				nlServerApi.lessonInviteReview(data).then(function() {
					var template = nl.t('Module {} sent for review to {} users successfully.',
						_oLesson.name, data.reviewers.length);
					nlDlg.popupAlert({title: 'Sent for review', template: template}).then(function() {
						resolve(true);
					});
				}, function() {
					resolve(false);
				});
			});
			
			resolve({});
		}};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
			resolve(false);
		}};
		moduleReviewDlg.show('lib_ui/dlg/dlgfieldsview.html', [okButton], cancelButton);
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

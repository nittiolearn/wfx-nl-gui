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
var NittioLessonModuleReviewSrv = ['nl', 'nlDlg', 'nlTreeSelect', 'nlGroupInfo', 'nlOuUserSelect',
function(nl, nlDlg, nlTreeSelect, nlGroupInfo, nlOuUserSelect) {
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

	this.sendForReview = function() {
		return nl.q(function(resolve, reject) {
			nlGroupInfo.init().then(function() {
				_sendForReview(resolve);
			});
		});	
	};
	
	function _sendForReview(resolve) {
		nlGroupInfo.update();
		var dontShowUsers = nlGroupInfo.getAllUserIdsWithoutPerm('lesson_create');
        _reviewerSelector = nlOuUserSelect.getOuUserSelector(parentScope, 
            nlGroupInfo.get(), {}, dontShowUsers);
        _reviewerSelector.treeIsShown = true;
        _reviewerSelector.multiSelect = true;

		var parentScope = nl.rootScope;
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
			resolve({reviewers: _getSelectedReviewerIds(), 
				remarks: moduleReviewDlg.scope.data.remarks});
		}};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
			resolve(false);
		}};
		moduleReviewDlg.show('lib_ui/dlg/dlgfieldsview.html', [okButton], cancelButton);
	}

	function _getSelectedReviewerIds() {
		var reviewersDict = _reviewerSelector.getSelectedUsers();
		var ret = [];
		for(var i in reviewersDict) ret.push(reviewersDict[i].userObj.id);
		return ret;
	}

}];
//-------------------------------------------------------------------------------------------------
module_init();
})();

(function() {

//-------------------------------------------------------------------------------------------------
// nittiolesson.js:
// module editor parts ported to angular
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.nittiolesson', ['nl.nittiolesson.module_props', 'nl.nittiolesson.page_props',
	'nl.nittiolesson.change_look', 'nl.nittiolesson.module_review',
	'nl.nittiolesson.add_page'])
	.service('NittioLesson', NittioLessonSrv);
}

//-------------------------------------------------------------------------------------------------
var NittioLessonSrv = ['nl', 'NittioLessonModulePropsDlg', 'NittioLessonPagePropsDlg', 'NittioLessonChangeLookDlg',
'NittioLessonModuleReviewDlg', 'nlResourceAddModifySrv', 'NittioLessonAddPageDlg',
function(nl, NittioLessonModulePropsDlg, NittioLessonPagePropsDlg, NittioLessonChangeLookDlg, 
    NittioLessonModuleReviewDlg, nlResourceAddModifySrv, NittioLessonAddPageDlg) {
    var _moduleConfig = null;
	this.init = function(oLesson, moduleConfig, ptInfo) {
		NittioLessonModulePropsDlg.init(oLesson, moduleConfig);
		NittioLessonPagePropsDlg.init(moduleConfig);
		NittioLessonChangeLookDlg.init(oLesson, moduleConfig);
		NittioLessonModuleReviewDlg.init(oLesson);
		NittioLessonAddPageDlg.init(ptInfo);
		_moduleConfig = moduleConfig;
	};

	this.showModulePropertiesDlg = function(isCreate, bFromPdf) {
		return NittioLessonModulePropsDlg.showDlg(isCreate, bFromPdf);
	};
	
	this.showPagePropertiesDlg = function(oPage, defMaxScore) {
		return NittioLessonPagePropsDlg.showDlg(oPage, defMaxScore);
	};
	this.showChangeLookDlg = function(templateList, templateAnimations) {
		return NittioLessonChangeLookDlg.showDlg(templateList, templateAnimations);
	};
    this.showAddPageDlg = function(page, isPopup) {
        return NittioLessonAddPageDlg.showDlg(page, isPopup);
    };
	this.sendForReview = function(lessonId) {
		return NittioLessonModuleReviewDlg.sendForReview(lessonId);
	};
    this.insertOrUpdateResource = function(markupText) {
        return nlResourceAddModifySrv.insertOrUpdateResource(nl.rootScope, 
            _moduleConfig.restypes, markupText, true);
    };
}]; 

module_init();
})();

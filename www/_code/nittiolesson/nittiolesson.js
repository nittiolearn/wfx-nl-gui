(function() {

//-------------------------------------------------------------------------------------------------
// nittiolesson.js:
// module editor parts ported to angular
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.nittiolesson', ['nl.nittiolesson.module_props', 'nl.nittiolesson.page_props',
	'nl.nittiolesson.change_look', 'nl.nittiolesson.module_review'])
	.service('NittioLesson', NittioLessonSrv);
}

//-------------------------------------------------------------------------------------------------
var NittioLessonSrv = ['NittioLessonModulePropsDlg', 'NittioLessonPagePropsDlg', 'NittioLessonChangeLookDlg',
'NittioLessonModuleReviewDlg',
function(NittioLessonModulePropsDlg, NittioLessonPagePropsDlg, NittioLessonChangeLookDlg, NittioLessonModuleReviewDlg) {
	this.init = function(oLesson, moduleConfig) {
		NittioLessonModulePropsDlg.init(oLesson, moduleConfig);
		NittioLessonPagePropsDlg.init(moduleConfig);
		NittioLessonChangeLookDlg.init(oLesson, moduleConfig);
		NittioLessonModuleReviewDlg.init(oLesson);
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
	this.sendForReview = function(lessonId) {
		return NittioLessonModuleReviewDlg.sendForReview(lessonId);
	};
}]; 

module_init();
})();

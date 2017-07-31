(function() {

//-------------------------------------------------------------------------------------------------
// nittiolesson.js:
// module editor parts ported to angular
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.nittiolesson', ['nl.nittiolesson.module_props', 'nl.nittiolesson.page_props'])
	.service('NittioLesson', NittioLessonSrv);
}

//-------------------------------------------------------------------------------------------------
var NittioLessonSrv = ['NittioLessonModulePropsDlg', 'NittioLessonPagePropsDlg',
function(NittioLessonModulePropsDlg, NittioLessonPagePropsDlg) {
	this.init = function(oLesson, moduleConfig) {
		NittioLessonModulePropsDlg.init(oLesson, moduleConfig);
		NittioLessonPagePropsDlg.init(moduleConfig);
	};

	this.showModulePropertiesDlg = function(isCreate, bFromPdf) {
		return NittioLessonModulePropsDlg.showDlg(isCreate, bFromPdf);
	};
	
	this.showPagePropertiesDlg = function(oPage) {
		return NittioLessonPagePropsDlg.showDlg(oPage);
	};
}]; 

module_init();
})();

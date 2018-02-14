(function() {

//-------------------------------------------------------------------------------------------------
// nittiolesson.js:
// module editor parts ported to angular
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.nittiolesson', ['nl.nittiolesson.module_props', 'nl.nittiolesson.page_props',
	'nl.nittiolesson.module_review',
	'nl.nittiolesson.add_page', 'nl.nittiolesson.page_voice'])
	.service('NittioLesson', NittioLessonSrv);
}

//-------------------------------------------------------------------------------------------------
var NittioLessonSrv = ['nl', 'nlServerApi', 'NittioLessonModulePropsDlg', 'NittioLessonPagePropsDlg',
'NittioLessonModuleReviewDlg', 'nlResourceAddModifySrv', 'NittioLessonAddPageDlg', 'NittioLessonAddPageVoice',
function(nl, nlServerApi, NittioLessonModulePropsDlg, NittioLessonPagePropsDlg,  
    NittioLessonModuleReviewDlg, nlResourceAddModifySrv, NittioLessonAddPageDlg, NittioLessonAddPageVoice) {
    var _moduleConfig = null;
	this.init = function(oLesson, moduleConfig, ptInfo) {
		NittioLessonModulePropsDlg.init(oLesson, moduleConfig);
		NittioLessonPagePropsDlg.init(moduleConfig);
		NittioLessonModuleReviewDlg.init(oLesson);
		NittioLessonAddPageDlg.init(ptInfo);
		_moduleConfig = moduleConfig;
	};

    this.getResourceLibrary = function(templateids, lessonid) {
        return nlServerApi.lessonGetResourceLibrary(templateids, lessonid);
    };

	this.showModulePropertiesDlg = function(isCreate, bFromPdf, resourceList, templateAnimations, lessonId) {
		return NittioLessonModulePropsDlg.showDlg(isCreate, bFromPdf, resourceList, templateAnimations, lessonId);
	};
	
	this.showPagePropertiesDlg = function(oPage, defMaxScore, isPopup, resourceList, lessonId) {
		return NittioLessonPagePropsDlg.showDlg(oPage, defMaxScore, isPopup, resourceList, lessonId);
	};
    this.showAddPageDlg = function(cfg) {
        return NittioLessonAddPageDlg.showDlg(cfg);
    };
	this.sendForReview = function(lessonId) {
		return NittioLessonModuleReviewDlg.sendForReview(lessonId);
	};
    this.insertOrUpdateResource = function(markupText, resourceList, resourceFilter, lessonId) {
    	// resoureFilter = 'bg' | 'icon' | false
        return nlResourceAddModifySrv.insertOrUpdateResource(nl.rootScope, 
            _moduleConfig.restypes, markupText, true, resourceList, resourceFilter, lessonId);
    };
    this.showPageVoiceDlg = function(oPage) {
    	return NittioLessonAddPageVoice.showAddVoiceDlg(oPage, _moduleConfig.restypes);
    };
}]; 

module_init();
})();

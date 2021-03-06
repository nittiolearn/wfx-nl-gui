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
'NittioLessonModuleReviewDlg', 'nlResourceAddModifySrv', 'NittioLessonAddPageDlg', 'NittioLessonAddPageVoice', 'NittioLessonSectionDetailsDlg',
function(nl, nlServerApi, NittioLessonModulePropsDlg, NittioLessonPagePropsDlg,  
    NittioLessonModuleReviewDlg, nlResourceAddModifySrv, NittioLessonAddPageDlg, NittioLessonAddPageVoice, NittioLessonSectionDetailsDlg) {
    var _moduleConfig = null;
	this.init = function(oLesson, moduleConfig, ptInfo) {
		NittioLessonModulePropsDlg.init(oLesson, moduleConfig);
		NittioLessonPagePropsDlg.init(oLesson, moduleConfig);
		NittioLessonModuleReviewDlg.init(oLesson);
		NittioLessonAddPageDlg.init(ptInfo);
		NittioLessonAddPageVoice.init(oLesson, moduleConfig);
		_moduleConfig = moduleConfig;
	};

    this.getResourceLibrary = function(templateids, lessonid) {
        return nlServerApi.lessonGetResourceLibrary(templateids, lessonid);
    };

	this.showModulePropertiesDlg = function(isCreate, bFromPdf, resourceList, templateAnimations, lessonId) {
		return NittioLessonModulePropsDlg.showDlg(isCreate, bFromPdf, resourceList, templateAnimations, lessonId);
	};
	
	this.showPagePropertiesDlg = function(oPage, defMaxScore, isPopup, resourceList, lessonId, templateAnimations) {
		return NittioLessonPagePropsDlg.showDlg(oPage, defMaxScore, isPopup, resourceList, lessonId, templateAnimations);
	};
    this.showAddPageDlg = function(cfg) {
        return NittioLessonAddPageDlg.showDlg(cfg);
	};
    this.getBgInfo = function(page, isPopup, modulebgimg, modulebgshade, pagetype) {
        return NittioLessonAddPageDlg.getBgInfo(page, isPopup, modulebgimg, modulebgshade, pagetype);
	};
	this.sendForReview = function(lessonId) {
		return NittioLessonModuleReviewDlg.sendForReview(lessonId);
	};
    this.insertOrUpdateResource = function(markupText, resourceList, resourceFilter, lessonId, card) {
    	// resoureFilter = 'bg' | 'icon' | false
        return nlResourceAddModifySrv.insertOrUpdateResource(nl.rootScope, 
            _moduleConfig.restypes, markupText, true, resourceList, resourceFilter, lessonId, card);
    };
    this.showPageVoiceDlg = function(oPage, templateDict, templateDefaults, lessonId) {
    	return NittioLessonAddPageVoice.showAddVoiceDlg(oPage, _moduleConfig.restypes, templateDict, templateDefaults, lessonId);
	};
	this.showSectionDlg = function(dataObj) {
    	return NittioLessonSectionDetailsDlg.showDlg(dataObj);
	}
	this.getLessonContent = function(lessonId) {
		var data = {id: lessonId};
		return nl.q(function(resolve, reject) {
			nlServerApi.getPlayer(data).then(function(result) {
				resolve(result);
			});
		});
	};
}]; 

module_init();
})();

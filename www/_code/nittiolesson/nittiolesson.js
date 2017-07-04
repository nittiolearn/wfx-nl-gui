(function() {

//-------------------------------------------------------------------------------------------------
// nittiolesson.js:
// lesson list module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.nittiolesson', [])
	.service('NittioLesson', NittioLessonSrv);
}

//-------------------------------------------------------------------------------------------------
var NittioLessonSrv = ['nl', 'nlDlg',
function(nl, nlDlg) {
	var _oLesson = null;
	var _dropdownOptions = null;
	var _isPdf = false;
	this.init = function(oLesson, dropdownOptions) {
		_oLesson = oLesson;
		_dropdownOptions = dropdownOptions;
	};

	var moduleProps = [{id: 'name', name: nl.t('Name'), type: 'string', condition: 'isModule'},
					   {id: 'grade', name: nl.t('Grade'), type: 'select'},
					   {id: 'subject', name: nl.t('Subject'), type: 'select'},
					   {id: 'image', name: nl.t('Image'), type: 'select'},
					   {id: 'pdfUrl', name: nl.t('Pdf url'), type: 'string', condition: 'isPdf'},
					   {id: 'singlePage', name: nl.t('Pdf url'), type: 'check', condition: 'isPdf'},
					   {id: 'description', name: nl.t('Description'), type: 'textarea'},
					   {id: 'keywords', name: nl.t('Keywords'), type: 'string'},
					   {id: 'esttime', name: nl.t('Estimated time'), type: 'number'},
					   {id: 'content_type', name: nl.t('Module type'), type: 'select'},
					   {id: 'passScore', name: nl.t('Pass score %'), type: 'number'},
					   {id: 'allowed_max_score', name: nl.t('Score limit'), type: 'number', condition: 'isQuestionBank'},
					   {id: 'forumTopic', name: nl.t('Discussion topic'), type: 'string'},
					   {id: 'additional_attr', name: nl.t('Template attributes:'), type: 'group'},
					   {id: 'templateStylesCss', name: nl.t('Styles'), type: 'textarea', group:'additional_attr'},
					   {id: 'templateBgimgs', name: nl.t('Background images'), type: 'textarea', group:'additional_attr'},
					   {id: 'templatePageTypes', name: nl.t('Page types'), type: 'textarea', group:'additional_attr'},
					   {id: 'templateAnimations', name: nl.t('Animation schemes'), type: 'textarea', group:'additional_attr'},
					   {id: 'lessonState', name: nl.t('Status'), type: 'status', group:'additional_attr'}];
	
	var learningMode = [{id:'assesment', name:nl.t('Assesment module')},
						{id:'self', name: nl.t('Self learning module')}];

	var lessonStates = [{title: 'Private', icon : nl.url.resUrl('general/ball-grey.png'), cls : 'grey'},
                     	{title: 'Under review', icon : nl.url.resUrl('general/ball-yellow.png'), cls : 'yellow'},
                     	{title: 'Under revision', icon : nl.url.resUrl('general/ball-maroon.png'), cls : 'maroon'},
                     	{title: 'Approved', icon : nl.url.resUrl('general/ball-green.png'), cls : 'green'},
                     	{title: 'Approved, next update under revision', icon : nl.url.resUrl('general/ball-green.png'), cls : 'green'},
                     	{title: 'Approved, next update under review', icon : nl.url.resUrl('general/ball-green.png'), cls : 'green'}];

	var lessonStatusDesc = nl.t('<div><span><b>State of the module can be one of following:</b></span></div>' +
	 							'<div><ul><li><img src="{}"/> Private: Module created and not yet shared for review.</li>' + 
								'<li><img src="{}"/> Under review: Author has shared the module for review.</li>' +
								'<li><img src="{}"/> Under revision: Author is reworking on the module after review.</li>' + 
								'<li><img src="{}"/> Approved: Module is approved.</li>' + 
								'<li><img src="{}"/> Approved, next update under revision: Module is approved and the author is working on next update.</li>' +
								'<li><img src="{}"/> Approved, next update under review: Module is approved and the next update is shared for review.</li></ul></div>', 
								lessonStates[0].icon, lessonStates[1].icon, lessonStates[2].icon, lessonStates[3].icon, lessonStates[4].icon, lessonStates[5].icon);
	var moduleHelp = {
					  name: {desc: nl.t('<span>Mandatory - enter a name for your module.</span>')},
					  grade: {desc: nl.t('<span>Choose the grade for which this module is created.</span>')},
					  subject: {desc: nl.t('<span>Choose the subject for which this module is created.</span>')},
					  image: {desc: nl.t('<span><ul><li>Choose the icon that will be displayed when this module is searched. Try <b>Custom</b> when you are not satisfied with the provided options.</li>' + 
					  					 '<li>If you choose <b>"Custom"</b> in image field, you can enter URL (link) of the custom image. The URL could be an image uploaded within the system or a link to external source in internet</li></ul></span>')},
					  pdfUrl: {desc: nl.t('<span><b>Mandatory:</b> Enter the url uploaded pdf.')},
					  description: {desc: nl.t('<span>Write a description which will help others in the group to understand the purpose of this module.</span>')},
					  keywords: {desc: nl.t('<span>Some keywords to help in search. You could use this categorize your content.</span>')},
					  esttime: {desc: nl.t('<span>Estimated time in minutes (between 1 and 600) to complete this learning module. When this learning module is sent as an assignment, the assignment duration is per-filled with the estimated time if available.</span>')},
					  content_type: {desc: nl.t('<span>Selecting the module type to self learining module or assesment module.</span>')},
					  forumTopic: {desc: nl.t('<span>provide name of the discussion topic which should be displayed when the learner clicks on discussion forum icon from this lesson. This could be further change at page level. This field is the default at lesson level.</span>')},
					  passScore: {desc: nl.t('<span> Minimum pass score in percentage (between 0 and 100 - both inclusive) for passing this module. Set this to zero to consider any score as passed. Clean the value to go back to the default value.</span>')},
					  templateStylesCss: {desc: nl.t('<span>define custom CSS classes to be used in styling the module content.</span>')},
					  templateBgimgs: {desc: nl.t('<span>Provide a list of background images (to be displayed in change look dialog) as a JSON array of strings.</span>')},
					  templatePageTypes: {desc: nl.t('<span>Provide page types and layout as a JSON object.</span>')},
					  templateAnimations: {desc: nl.t('<span>Provide animation schemes as a JSON object.</span>')},
					  lessonState: {desc: lessonStatusDesc},
					  allowed_max_score: {desc: nl.t('This parameter is specific to question bank. When the question bank is distributed, a random subset of questions will be chosen from the bank. The total score of the chosen questions will be kept equal to the score limit. If the maximum scores are different for different pages, it is possible that the maximum score of chosen pages is slightly less than the score limit.')}
					 };	 

	this.showModulePropertiesDlg = function(isCreate, bFromPdf) {
		_isPdf = bFromPdf;
		var doneButtonText = isCreate ? nl.t('Create') : nl.t('Done');
		var parentScope = nl.rootScope;
		return nl.q(function(resolve, reject) {
			var editDlg = nlDlg.create(parentScope);
				editDlg.setCssClass('nl-height-max nl-width-max');
				_initEditDlg(editDlg);			
				editDlg.scope.dlgTitle = nl.t('Module properties');
				
				editDlg.scope.data.imageChange = function() {
					editDlg.scope.data.imageConvert = nl.url.lessonIconUrl(editDlg.scope.data.image.id);		
				};
			var okButton = {text: doneButtonText, onTap: function(e) {
				if(!_validateInputs(editDlg.scope)) {
					if (e) e.preventDefault();
					return;
				}
				_oLesson.grade = editDlg.scope.data.grade.id;
				_oLesson.subject = editDlg.scope.data.subject.id;
				_oLesson.pdfSinglePage = editDlg.scope.data.pdfSinglePage;
				if (editDlg.scope.data.image.id == "Custom") {
					_oLesson.image = "img:" + editDlg.scope.data.imageUrl;
				} else {
					_oLesson.image = editDlg.scope.data.image.id;
				};
				
				if(editDlg.scope.data.learningType.id == 'self') {
					_oLesson.selfLearningMode = true;
				} else {
					delete _oLesson.selfLearningMode;
				}
				resolve(true);
			}};
			var cancelButton = {text: nl.t('Close'), onTap: function() {
				resolve(false);
			}};
			editDlg.show('nittiolesson/module_props_dlg.html', [okButton], cancelButton);
		});
	};

    function _validateInputs(scope) {
    	scope.error = {};
    	var data = scope.data.lessonData;
        if(!data.name) return _validateFail(scope, 'name', 'Module name is mandatory');
        if(_isPdf && !data.pdfUrl) return _validateFail(scope, 'pdfUrl', 'Pdf url is mandatory');
        if(!_validateJsonField(data.templateBgimgs)) return _validateFail(scope, 'templateBgimgs', 'Error while parsing json');
        if(!_validateJsonField(data.templatePageTypes)) return _validateFail(scope, 'templatePageTypes', 'Error while parsing json');
        if(!_validateJsonField(data.templateAnimations)) return _validateFail(scope, 'templateAnimations', 'Error while parsing json');        
        
        return true;
    }

    function _validateJsonField(jsonData) {
    	if (!jsonData) return true;
        try {
            JSON.parse(jsonData);
        } catch (e) {
            return false;
        }
        return true;
    }

    function _validateFail(scope, attr, errMsg) {
    	return nlDlg.setFieldError(scope, attr,
        	nl.t(errMsg));
    }

	function _initEditDlg(editDlg) {
		editDlg.scope.data = {};
		editDlg.scope.data.moduleProps = moduleProps;
		editDlg.scope.data.isModule = true;
		editDlg.scope.data.isPdf = _isPdf;
		editDlg.scope.data.isQuestionBank = false;
		editDlg.scope.data.pdfSinglePage = _oLesson.pdfSinglePage ? true : false;
		editDlg.scope.data.showAdditional = {};
		editDlg.scope.data.moduleHelp = moduleHelp;
		_oLesson.esttime = parseInt(_oLesson.esttime);
		editDlg.scope.data.lessonData = _oLesson;
		editDlg.scope.options = {grade: _getDropDown(_dropdownOptions.grades), 
								 subject: _getDropDown(_dropdownOptions.subjects),
								 image: _dropdownOptions.icons,
								 learningMode: learningMode};
		editDlg.scope.data.grade = {id: _oLesson.grade, name: _oLesson.grade};
		editDlg.scope.data.subject = {id: _oLesson.subject, name: _oLesson.subject};						 
		editDlg.scope.data.image = _oLesson.image.indexOf('img:') == 0 ? {id: 'Custom', name: 'Custom'} : {id: _oLesson.image}; 
		editDlg.scope.data.imageUrl = _oLesson.image.indexOf('img:') == 0 ? _oLesson.image.slice(4, _oLesson.image.length+1) : '';
		editDlg.scope.data.imageConvert = nl.url.lessonIconUrl(_oLesson.image);
		editDlg.scope.data.lessonState = lessonStates[_oLesson.state];
		editDlg.scope.data.learningType = _oLesson.selfLearningMode || _oLesson.selfLearningMode == true ? learningMode[1] : learningMode[0]; 
	}

	function _getDropDown(arrayElem) {
		var arrayDict = [];
		for(var i=0; i<arrayElem.length; i++) {
			if(arrayElem[i].indexOf(".") > 0) {
				var getGroup = arrayElem[i].split(".");
				arrayDict.push({id: arrayElem[i], name: getGroup[1], group: getGroup[0]});
				continue;
			}
			arrayDict.push({id: arrayElem[i], name: arrayElem[i], group: ""});				
		}
		return arrayDict;
	}
}]; 

module_init();
})();

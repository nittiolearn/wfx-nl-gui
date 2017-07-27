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
var NittioLessonSrv = ['nl', 'nlDlg', 'nlTreeSelect', 'nlOuUserSelect',
function(nl, nlDlg, nlTreeSelect, nlOuUserSelect) {
	var _oLesson = null;
	var _moduleConfig = null;
	var _isPdf = false;
	var _bModify = false;
	var _lastStateOptional = null;
	var _lastStateAdditional = false;
	var _moduleProps = [];
	var _gradeInfo = {};
	var _subjectInfo = {};
	var _iconInfo = {};
	this.init = function(oLesson, moduleConfig) {
		_oLesson = oLesson;
		_moduleConfig = moduleConfig;
	    _moduleProps = [{id: 'name', name: nl.t('Name'), type: 'string', tabindex: 1},
	       {id: 'lessonState', name: nl.t('Status'), type: 'status'},
		   {id: 'optional_attr', name: nl.t('Optional properties'), type: 'group'},
		   {id: 'grade', name: nl.t('{}', moduleConfig.grpProps.gradelabel), type: 'treeSelect', group:'optional_attr'},
		   {id: 'subject', name: nl.t('{}', moduleConfig.grpProps.subjectlabel), type: 'treeSelect', group:'optional_attr'},
		   {id: 'image', name: nl.t('Image'), type: 'treeSelect', group:'optional_attr'},
		   {id: 'pdfUrl', name: nl.t('Pdf url'), type: 'string', condition: 'isPdf'},
		   {id: 'pdfSinglePage', name: nl.t('Single page'), type: 'check', condition: 'isPdf'},
		   {id: 'description', name: nl.t('Description'), type: 'textarea', group:'optional_attr'},
		   {id: 'esttime', name: nl.t('Estimated time'), type: 'number', group:'optional_attr', min: 1, max: 600},
		   {id: 'learningMode', name: nl.t('Module type'), type: 'select', group:'optional_attr', condition: 'isNotQuestionBank'},
		   {id: 'passScore', name: nl.t('Pass score %'), type: 'number', group:'optional_attr', condition:'isAssesment', min: 0, max: 100},
		   {id: 'allowed_max_score', name: nl.t('Score limit'), type: 'number', condition: 'isQuestionBank', group:'optional_attr', min: 1},
		   {id: 'forumTopic', name: nl.t('Discussion topic'), type: 'string', group:'optional_attr'},
		   {id: 'additional_attr', name: nl.t('Advanced properties'), type: 'group', condition: 'isBleedingEdge'},
		   {id: 'templateStylesCss', name: nl.t('Styles'), type: 'textarea', group:'additional_attr', condition: 'isBleedingEdge'},
		   {id: 'templateBgimgs', name: nl.t('Background images'), type: 'textarea', group:'additional_attr', condition: 'isBleedingEdge'},
		   {id: 'templatePageTypes', name: nl.t('Page types'), type: 'textarea', group:'additional_attr', condition: 'isBleedingEdge'},
		   {id: 'templateAnimations', name: nl.t('Animation schemes'), type: 'textarea', group:'additional_attr', condition: 'isBleedingEdge'}];
	};

	
	var learningMode = [{id:'assesment', name:nl.t('Assesment module')},
						{id:'self', name: nl.t('Self learning module')}];

	var lessonStates = [{title: 'Private', icon : 'ion-ios-circle-filled fgrey', cls : 'grey'},
                     	{title: 'Under review', icon : 'ion-ios-circle-filled fyellow', cls : 'yellow'},
                     	{title: 'Under revision', icon : 'ion-ios-circle-filled nl-revision-color', cls : 'maroon'},
                     	{title: 'Approved', icon : 'ion-ios-circle-filled fgreen', cls : 'green'},
                     	{title: 'Approved, next update under revision', icon : 'ion-ios-circle-filled fgreen', cls : 'green'},
                     	{title: 'Approved, next update under review', icon : 'ion-ios-circle-filled fgreen', cls : 'green'}];

	var lessonStatusDesc = nl.t('<div><span><b>State of the module can be one of following:</b></span></div>' +
	 							'<div><ul><li><i class="padding-mid icon nl-dlg-field-icon {}"></i> Private: Module created and not yet shared for review.</li>' + 
								'<li><i class="padding-mid icon nl-dlg-field-icon {}"></i> Under review: Author has shared the module for review.</li>' +
								'<li><i class="padding-mid icon nl-dlg-field-icon {}"></i> Under revision: Author is reworking on the module after review.</li>' + 
								'<li><i class="padding-mid icon nl-dlg-field-icon {}"></i> Approved: Module is approved.</li>' + 
								'<li><i class="padding-mid icon nl-dlg-field-icon {}"></i> Approved, next update under revision: Module is approved and the author is working on next update.</li>' +
								'<li><i class="padding-mid icon nl-dlg-field-icon {}"></i> Approved, next update under review: Module is approved and the next update is shared for review.</li></ul></div>', 
								lessonStates[0].icon, lessonStates[1].icon, lessonStates[2].icon, lessonStates[3].icon, lessonStates[4].icon, lessonStates[5].icon);

	var moduleHelp = {
					  name: {desc: nl.t('Mandatory - enter a name for your module.')},
					  grade: {desc: nl.t('This helps in classifying and searching the module.')},
					  subject: {desc: nl.t('This helps in classifying and searching the module.')},
					  image: {desc: nl.t('<ul><li>Choose the image that will be displayed when this module is searched. Try <b>Custom</b> for setting your own image.</li>' + 
					  					 '<li>If you choose <b>"Custom"</b> in image field, you can enter URL (link) of the custom image. The URL could be an image uploaded within the system or a link to external source from internet.</li></ul>')},
					  pdfUrl: {desc: nl.t('<b>Mandatory:</b> Enter the url uploaded pdf.')},
					  pdfSinglePage: {desc: nl.t('Check this to view the pdf in single page.')},
					  description: {desc: nl.t('Write a description which will help others in the group to understand the purpose of this module.')},
					  esttime: {desc: nl.t('Estimated time in minutes (between 1 and 600) to complete this learning module. When this learning module is sent as an assignment, the assignment duration is per-filled with the estimated time if available.')},
					  learningMode: {desc: nl.t('Self learining modules are not scored and hints are shown to the learner while learning. Assesment modules are scored and correct answers are shown only on completion of the module.')},
					  forumTopic: {desc: nl.t('provide name of the discussion topic which should be displayed when the learner clicks on discussion forum icon from this module. This could be further change at page level. This field is the default at module level.')},
					  passScore: {desc: nl.t(' Minimum pass score in percentage (between 0 and 100 - both inclusive) for passing this module. Set this to zero to consider any score as passed. Clean the value to go back to the default value.')},
					  additional_attr: {desc: nl.t('Advanced properties are typically set only in templates. Touch these attributes only if you know what you are doing.')},
					  templateStylesCss: {desc: nl.t('define custom CSS classes to be used in styling the module content.')},
					  templateBgimgs: {desc: nl.t('Provide a list of background images (to be displayed in change look dialog) as a JSON array of strings.')},
					  templatePageTypes: {desc: nl.t('Provide page types and layout as a JSON object.')},
					  templateAnimations: {desc: nl.t('Provide animation schemes as a JSON object.')},
					  lessonState: {desc: lessonStatusDesc},
					  allowed_max_score: {desc: nl.t('This parameter is specific to question bank. When the question bank is distributed, a random subset of questions will be chosen from the bank. The total score of the chosen questions will be kept equal to the score limit. If the maximum scores are different for different pages, it is possible that the maximum score of chosen pages is slightly less than the score limit.')}
					 };	 

	this.showModulePropertiesDlg = function(isCreate, bFromPdf) {
		_isPdf = bFromPdf;
		_bModify = isCreate ? false : true;
		var doneButtonText = isCreate ? nl.t('Create') : nl.t('Done');
		var parentScope = nl.rootScope;
		return nl.q(function(resolve, reject) {
			var editDlg = nlDlg.create(parentScope);
				editDlg.setCssClass('nl-height-max nl-width-max');
				_initEditDlg(editDlg);
			var okButton = {text: doneButtonText, onTap: function(e) {
				if(!_validateInputs(editDlg.scope)) {
					if (e) e.preventDefault();
					return;
				}
				_oLesson.grade = Object.keys(nlTreeSelect.getSelectedIds(_gradeInfo))[0];
				_oLesson.subject = Object.keys(nlTreeSelect.getSelectedIds(_subjectInfo))[0];;
				_oLesson.pdfSinglePage = editDlg.scope.data.pdfSinglePage;
				_lastStateOptional = editDlg.scope.data.showAdditional.optional_attr;
				_lastStateAdditional = editDlg.scope.data.showAdditional.additional_attr;
				if (editDlg.scope.data.image.id == "Custom") {
					_oLesson.image = "img:" + editDlg.scope.data.imageUrl;
				} else {
					var image = Object.keys(nlTreeSelect.getSelectedIds(_iconInfo))[0];
					var index = image.indexOf(".");
					_oLesson.image = image.slice(index+1, image.length) + ".png";
				};
				
				if(editDlg.scope.data.learningMode.id == 'self') {
					_oLesson.selfLearningMode = true;
				} else {
					delete _oLesson.selfLearningMode;
				}
				_updateLessonObj(editDlg.scope.data);
				resolve(true);
			}};
			var cancelButton = {text: nl.t('Close'), onTap: function() {
				_lastStateOptional = editDlg.scope.data.showAdditional.optional_attr;
				_lastStateAdditional = editDlg.scope.data.showAdditional.additional_attr;
				resolve(false);
			}};
			editDlg.show('nittiolesson/module_props_dlg.html', [okButton], cancelButton);
		});
	};

	function _updateLessonObj(data) {
		_oLesson.name = data.name;
		if(_isPdf) {
			_oLesson.pdfSinglePage = data.pdfSinglePage;
			_oLesson.pdfUrl = data.pdfUrl;
		}
		_oLesson.forumTopic = data.forumTopic;
		_oLesson.description = data.description;
		_oLesson.keywords = data.keywords; 
		_oLesson.esttime = data.esttime;
		_oLesson.passScore = data.passScore;
		if(data.allowed_max_score) {
			_oLesson.allowed_max_score;
		}
		_oLesson.templateStylesCss = data.templateStylesCss;
		_oLesson.templateBgimgs = data.templateBgimgs;
		_oLesson.templatePageTypes = data.templatePageTypes;
		_oLesson.templateAnimations = data.templateAnimations;
	}

    function _validateInputs(scope) {
    	scope.error = {};
    	var data = scope.data;
        if(!data.name) return _validateFail(scope, 'name', 'Module name is mandatory');
        if(Object.keys(nlTreeSelect.getSelectedIds(_gradeInfo)).length == 0) return _validateFail(scope, 'grade', 'Grade is mandatory for module');
        if(Object.keys(nlTreeSelect.getSelectedIds(_subjectInfo)).length == 0) return _validateFail(scope, 'subject', 'Subject is mandatory for module');
        if(Object.keys(nlTreeSelect.getSelectedIds(_iconInfo)).length == 0) return _validateFail(scope, 'image', 'Image is mandatory for module');
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
		editDlg.scope.dlgTitle = nl.t('Module properties');
				
		editDlg.scope.data = {};
		editDlg.scope.data.moduleProps = _moduleProps;
		editDlg.scope.data.isModule = true;
		editDlg.scope.data.name = _oLesson.name;
		editDlg.scope.data.forumTopic = _oLesson.forumTopic;
		editDlg.scope.data.description = _oLesson.description;
		editDlg.scope.data.keywords = _oLesson.keywords;
		editDlg.scope.data.esttime = parseInt(_oLesson.esttime);
		editDlg.scope.data.passScore = parseInt(_oLesson.passScore);
		editDlg.scope.data.showSearch = {};
		if(_oLesson.allowed_max_score) {
			editDlg.scope.data.allowed_max_score = parseInt(_oLesson.allowed_max_score);
		}
		editDlg.scope.data.templateStylesCss = _oLesson.templateStylesCss || '';
		editDlg.scope.data.templateBgimgs = _oLesson.templateBgimgs || '';
		editDlg.scope.data.templatePageTypes = _oLesson.templatePageTypes || '';
		editDlg.scope.data.templateAnimations = _oLesson.templateAnimations || '';
		editDlg.scope.data.pdfSinglePage = _oLesson.pdfSinglePage ? true : false;
		editDlg.scope.data.pdfUrl = null;
		editDlg.scope.data.showAdditional = {optional_attr: _lastStateOptional !== null ? _lastStateOptional : _bModify,
											 additional_attr: _lastStateAdditional};
		editDlg.scope.data.moduleHelp = moduleHelp;
		editDlg.scope.data.lessonData = _oLesson;
		var selectedGrade = {};
	    selectedGrade[_oLesson.grade] = true;
		var selectedSubject = {};
		selectedSubject[_oLesson.subject] = true;

        _gradeInfo = {data: nlTreeSelect.strArrayToTreeArray(_moduleConfig.grades || [])};
        nlTreeSelect.updateSelectionTree(_gradeInfo, selectedGrade);
        _gradeInfo.treeIsShown = false;
        _gradeInfo.multiSelect = false;
		_gradeInfo.showSearchField = true;
        
        _subjectInfo = {data: nlTreeSelect.strArrayToTreeArray(_moduleConfig.subjects || [])};
        nlTreeSelect.updateSelectionTree(_subjectInfo, selectedSubject);
        _subjectInfo.treeIsShown = false;
        _subjectInfo.multiSelect = false;
		_subjectInfo.showSearchField = true;

		var selectedImage = {};
		var selectedImg = null;
        var arrayParams = _getIconTree(_moduleConfig.icons, _oLesson.image);
		_iconInfo.data = arrayParams[0];
        nlTreeSelect.updateSelectionTree(_iconInfo, arrayParams[1]);
        _iconInfo.treeIsShown = false;
        _iconInfo.multiSelect = false;
		_iconInfo.showSearchField = true;
		editDlg.scope.options = {grade: _gradeInfo, 
								 subject: _subjectInfo,
								 image: _iconInfo,
								 learningMode: learningMode};
		editDlg.scope.data.grade = {id: _oLesson.grade, name: _oLesson.grade};
		editDlg.scope.data.subject = {id: _oLesson.subject, name: _oLesson.subject};						 
		editDlg.scope.data.image = _oLesson.image.indexOf('img:') === 0 ? {id: 'Custom', name: 'Custom'} : {id: nl.url.lessonIconUrl(_oLesson.image)}; 
		editDlg.scope.data.imageUrl = nl.url.lessonIconUrl(_oLesson.image);
		editDlg.scope.data.imageConvert = nl.url.lessonIconUrl(_oLesson.image);
		editDlg.scope.data.lessonState = lessonStates[_oLesson.state] || lessonStates[0];
		editDlg.scope.data.learningMode = _oLesson.selfLearningMode ? learningMode[1] : learningMode[0]; 

		editDlg.scope.data.canShow = function(condition, item) {
			if (item.group in editDlg.scope.data.showAdditional && !editDlg.scope.data.showAdditional[item.group]) return false;
			if (condition == 'isPdf') return _isPdf;
			if (condition == 'isQuestionBank') return "allowed_max_score" in _oLesson;
			if (condition == 'isNotQuestionBank') return "allowed_max_score" in _oLesson ? false : true;
			if (condition == 'isAssesment') return (editDlg.scope.data.learningMode.id == 'assesment');
			if (condition == 'isBleedingEdge') return (_moduleConfig.grpProps.isBleedingEdge);
			return true;
		};
		
		_iconInfo.onSelectChange = function() {
			var items = nlTreeSelect.getSelectedIds(_iconInfo);
			var item = null;
			for (var key in items) item = items[key];
			if (!item) return;
			editDlg.scope.data.image = item.id == "Custom" ? {id: 'Custom', name: 'Custom'} : '';
			editDlg.scope.data.imageConvert = item.image;
		};
	}

	function _getIconTree(icons, selectedId) {
        var insertedKeys = {};
        var insertedGroups = {};
        var selectedImageId = {};
        var treeArray = [];
        if (selectedId.indexOf('img:') == 0) selectedImageId = {'Custom': true};
        for(var i=0; i<icons.length; i++) {
            var itemObj = icons[i];
            _getIconNodeWithParents(itemObj, treeArray, insertedKeys, insertedGroups, selectedId, selectedImageId);
        }
        return [treeArray, selectedImageId];
    }

    function _getIconNodeWithParents(itemObj, treeArray, insertedKeys, insertedGroups, selectedId, selectedImageId) {
    	var splitedIds = itemObj.id.split('.');
        if (!(itemObj.group in insertedGroups) && itemObj.group !== ""){
        	insertedGroups[itemObj.group] = true;
        	treeArray.push({id: itemObj.group, name: itemObj.group});
        }
		if (selectedId == itemObj.id) {
			var index = itemObj.id.indexOf('.png');
			var imageObj = itemObj.group == "" ? itemObj.id.slice(0, index) : itemObj.group+'.'+itemObj.id.slice(0, index);
			selectedImageId[imageObj] = true;
		}
    	if (itemObj.group === "") {
    		if (itemObj.id == "Custom") treeArray.push({id: itemObj.id, name: itemObj.name});
    		if (itemObj.id !== "Custom") treeArray.push({id: splitedIds[0], name: itemObj.name, image: nl.url.lessonIconUrl(itemObj.id)});
    		return;
    	}
    	if(!(itemObj.id in insertedKeys)) {
	    	insertedKeys[itemObj.id] = true;
    	    treeArray.push({id: itemObj.group+'.'+splitedIds[0], name: itemObj.name, group:itemObj.group, suffix: splitedIds[1], image: nl.url.lessonIconUrl(itemObj.id)});
    	}
    }
    
	function _getDropDown(arrayElem) {
		var arrayDict = [];
		for(var i=0; i<arrayElem.length; i++) {
			if(arrayElem[i].indexOf(".") > 0) {
				var getGroup = arrayElem[i].split(".");
				arrayDict.push({id: arrayElem[i], name: getGroup[1], group: getGroup[0], image:nl.url.lessonIconUrl(arrayElem[i])});
				continue;
			}
			arrayDict.push({id: arrayElem[i], name: arrayElem[i], group: "", image:nl.url.lessonIconUrl(arrayElem[i])});				
		}
		return arrayDict;
	}
}]; 

module_init();
})();

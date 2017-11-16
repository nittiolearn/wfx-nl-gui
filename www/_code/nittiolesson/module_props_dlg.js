(function() {

//-------------------------------------------------------------------------------------------------
// module_props_dlg.js:
// module editor -> page properties dlg module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.nittiolesson.module_props', [])
	.service('NittioLessonModulePropsDlg', NittioLessonModulePropsDlgSrv);
}

//-------------------------------------------------------------------------------------------------
var NittioLessonModulePropsDlgSrv = ['nl', 'nlDlg', 'nlTreeSelect', 'nlOuUserSelect', 'nlModuleStatusInfo',
function(nl, nlDlg, nlTreeSelect, nlOuUserSelect, nlModuleStatusInfo) {
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
	    _moduleProps = [{id: 'name', name: nl.t('Name'), type: 'string'},
	       {id: 'lessonState', name: nl.t('Status'), type: 'div', desc: ''},
		   {id: 'optional_attr', name: nl.t('Optional properties'), type: 'group'},
		   {id: 'grade', name: nl.t('{}', moduleConfig.grpProps.gradelabel), type: 'tree-select', group:'optional_attr'},
		   {id: 'subject', name: nl.t('{}', moduleConfig.grpProps.subjectlabel), type: 'tree-select', group:'optional_attr'},
		   {id: 'image', name: nl.t('Image'), type: 'tree-select-img', group:'optional_attr'},
		   {id: 'pdfUrl', name: nl.t('Pdf url'), type: 'string', condition: 'isPdf'},
		   {id: 'pdfSinglePage', name: nl.t('Single page'), type: 'check', condition: 'isPdf', 
		   		title: nl.t('Select this option to create a single page module.')},
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
		_updateModuleProps(_moduleProps);
		
	};

	
	var learningMode = [{id:'assesment', name:nl.t('Assesment module')},
						{id:'self', name: nl.t('Self learning module')}];

	var lessonStates = {};
	var lessonStatusDesc = null;
	function _initLessonStates() {
		var infos = nlModuleStatusInfo.getStatusInfos();
		lessonStatusDesc = '<div><b>Status of the module can be one of following:</b></div>';
		for (var i=0; i<infos.length; i++) {
			lessonStates[infos[i].status] = infos[i];
			lessonStatusDesc += nl.fmt.fmt1('<div class="row row-center padding0 margin0"><i class="icon fsh4 {icon}"></i>' + 
				'<div class="col padding-mid"><b>{title}:</b> {help}</div></div>', infos[i]);
		}
	}

	_initLessonStates();
	var moduleHelp = {
		name: nl.t('Mandatory - enter a name for your module.'),
		grade: nl.t('This helps in classifying and searching the module.'),
		subject: nl.t('This helps in classifying and searching the module.'),
		image: nl.t('<ul><li>Choose the image that will be displayed when this module is searched. Try <b>Custom</b> for setting your own image.</li>' + 
					'<li>If you choose <b>"Custom"</b> in image field, you can enter URL (link) of the custom image. The URL could be an image uploaded within the system or a link to external source from internet.</li></ul>'),
		pdfUrl: nl.t('<b>Mandatory:</b> Enter the url uploaded pdf.'),
		pdfSinglePage: nl.t('When selected, all PDF pages are displyaed one below another in a single page module. Otherwise, one module page is created per PDF page.'),
		description: nl.t('Write a description which will help others in the group to understand the purpose of this module.'),
		esttime: nl.t('Estimated time in minutes (between 1 and 600) to complete this learning module. When this learning module is sent as an assignment, the assignment duration is per-filled with the estimated time if available.'),
		learningMode: nl.t('Self learining modules are not scored and hints are shown to the learner while learning. Assesment modules are scored and correct answers are shown only on completion of the module.'),
		forumTopic: nl.t('provide name of the discussion topic which should be displayed when the learner clicks on discussion forum icon from this module. This could be further change at page level. This field is the default at module level.'),
		passScore: nl.t(' Minimum pass score in percentage (between 0 and 100 - both inclusive) for passing this module. Set this to zero to consider any score as passed. Clean the value to go back to the default value.'),
		additional_attr: nl.t('Advanced properties are typically set only in templates. Touch these attributes only if you know what you are doing.'),
		templateStylesCss: nl.t('define custom CSS classes to be used in styling the module content.'),
		templateBgimgs: nl.t('Provide a list of background images (to be displayed in change look dialog) as a JSON array of strings.'),
		templatePageTypes: nl.t('Provide page types and layout as a JSON object.'),
		templateAnimations: nl.t('Provide animation schemes as a JSON object.'),
		lessonState: lessonStatusDesc,
		allowed_max_score: nl.t('This parameter is specific to question bank. When the question bank is distributed, a random subset of questions will be chosen from the bank. The total score of the chosen questions will be kept equal to the score limit. If the maximum scores are different for different pages, it is possible that the maximum score of chosen pages is slightly less than the score limit.')
	};
	
	function _updateModuleProps(_moduleProps) {
		for (var i=0; i<_moduleProps.length; i++) {
			var prop = _moduleProps[i];
			prop.help = moduleHelp[prop.id] || null;
		}
	}

	this.showDlg = function(isCreate, bFromPdf) {
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
				var selectedGrades = Object.keys(nlTreeSelect.getSelectedIds(_gradeInfo));
				var selectedSubjects = Object.keys(nlTreeSelect.getSelectedIds(_subjectInfo));
		        _oLesson.grade = selectedGrades.length == 0 ? _gradeInfo.data[0].id : selectedGrades[0];
		        _oLesson.subject = selectedSubjects.length == 0 ? _subjectInfo.data[0].id : selectedSubjects[0];

				_oLesson.pdfSinglePage = editDlg.scope.data.pdfSinglePage;
				_lastStateOptional = editDlg.scope.data.showGroup.optional_attr;
				_lastStateAdditional = editDlg.scope.data.showGroup.additional_attr;

				if (editDlg.scope.data.image.isCustomSelected) {
					_oLesson.image = "img:" + editDlg.scope.data.image.customUrl;
				} else {
					var selectedIcons = nlTreeSelect.getSelectedIds(_iconInfo);
					var selectedIconKeys = Object.keys(selectedIcons);
			        _oLesson.image = selectedIconKeys.length == 0 
			        	? _iconInfo.data[1].origId 
			        	: selectedIcons[selectedIconKeys[0]].origId;
				}
				
				if(editDlg.scope.data.learningMode.id == 'self') {
					_oLesson.selfLearningMode = true;
				} else {
					delete _oLesson.selfLearningMode;
				}
				_updateLessonObj(editDlg.scope.data);
				resolve(true);
			}};
			var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
				_lastStateOptional = editDlg.scope.data.showGroup.optional_attr;
				_lastStateAdditional = editDlg.scope.data.showGroup.additional_attr;
				if(_bModify) {
					resolve(false);
					return;					
				}
				if(e) e.preventDefault();
				nlDlg.popupConfirm({title: 'Confirm', template: 'Do you really want to cancel the operation?',
					okText: 'Yes', cancelText: 'No'}).then(function(res) {
					if (!res) return;
					editDlg.close(false);
					resolve(false);
				});
			}};
			editDlg.show('lib_ui/dlg/dlgfieldsview.html', [okButton], cancelButton);
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
        if(data.image.isCustomSelected && (!data.image.customUrl)) return _validateFail(scope, 'image', 'Custom url is mandatory, please enter custom url');
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
		editDlg.scope.data.items = _moduleProps;
		editDlg.scope.data.fixedHelp = 'Name is the only mandatory property. You may leave the rest of the properties to default. Properties could be changed anytime later.';
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
		editDlg.scope.data.showGroup = {optional_attr: _lastStateOptional !== null ? _lastStateOptional : _bModify,
											 additional_attr: _lastStateAdditional};
		editDlg.scope.data.lessonData = _oLesson;
		var selectedGrade = {};
	    selectedGrade[_oLesson.grade] = true;
		var selectedSubject = {};
		selectedSubject[_oLesson.subject] = true;

        _gradeInfo = {data: nlTreeSelect.strArrayToTreeArray(_moduleConfig.grades || [])};
        nlTreeSelect.updateSelectionTree(_gradeInfo, selectedGrade);
        _gradeInfo.treeIsShown = false;
        _gradeInfo.multiSelect = false;
		_gradeInfo.fieldmodelid = 'grade';
        
        _subjectInfo = {data: nlTreeSelect.strArrayToTreeArray(_moduleConfig.subjects || [])};
        nlTreeSelect.updateSelectionTree(_subjectInfo, selectedSubject);
        _subjectInfo.treeIsShown = false;
        _subjectInfo.multiSelect = false;
		_subjectInfo.fieldmodelid = 'subject';

		var selectedImage = {};
		var selectedImg = null;
        var arrayParams = _getIconTree(_moduleConfig.icons, _oLesson.image);
		_iconInfo.data = arrayParams[0];
        nlTreeSelect.updateSelectionTree(_iconInfo, arrayParams[1]);
        _iconInfo.treeIsShown = false;
        _iconInfo.multiSelect = false;
		_iconInfo.fieldmodelid = 'image';
		editDlg.scope.options = {grade: _gradeInfo, 
								 subject: _subjectInfo,
								 image: _iconInfo,
								 learningMode: learningMode};
		editDlg.scope.data.grade = {id: _oLesson.grade, name: _oLesson.grade};
		editDlg.scope.data.subject = {id: _oLesson.subject, name: _oLesson.subject};						 
		editDlg.scope.data.image = {url: nl.url.lessonIconUrl(_oLesson.image)};
		editDlg.scope.data.image.customUrl = _oLesson.image.indexOf('img:') == 0 ? editDlg.scope.data.image.url:  '';
		editDlg.scope.data.image.isCustomSelected = _oLesson.image.indexOf('img:') == 0;
		editDlg.scope.data.lessonState = lessonStates[_oLesson.state] || lessonStates[0];
		editDlg.scope.data.learningMode = _oLesson.selfLearningMode ? learningMode[1] : learningMode[0]; 

		editDlg.scope.data.canShow = function(condition, item) {
			if (item.group in editDlg.scope.data.showGroup && !editDlg.scope.data.showGroup[item.group]) return false;
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
			editDlg.scope.data.image.isCustomSelected = (item.id == "Custom");
			editDlg.scope.data.image.url = item.id == "Custom" ? editDlg.scope.data.image.customUrl : item.image;
		};
		
		editDlg.scope.data.onIconChange = function(){
			editDlg.scope.data.image.url = editDlg.scope.data.image.customUrl;
		};
	}

	function _getIconTree(icons, selectedId) {
        var insertedKeys = {};
        var selectedImageId = {};
        var treeArray = [];
        for(var i=0; i<icons.length; i++) {
            var itemObj = icons[i];
            _getIconNodeWithParents(itemObj, treeArray, insertedKeys, selectedId, selectedImageId);
        }
        return [treeArray, selectedImageId];
    }

    function _getIconNodeWithParents(itemObj, treeArray, insertedKeys, selectedId, selectedImageId) {
        if (itemObj.group && !insertedKeys[itemObj.group]) {
        	insertedKeys[itemObj.group] = true;
        	treeArray.push({id: itemObj.group, name: itemObj.group});
        }
        var itemId = _formatIconId(itemObj);
        if (insertedKeys[itemId]) return;
    	insertedKeys[itemId] = true;
        
        var customUrl = (itemObj.id == "Custom" && selectedId.indexOf('img:') == 0) 
        	?  nl.url.lessonIconUrl(selectedId) : '';
        var itemUrl = itemObj.id !== "Custom" ? nl.url.lessonIconUrl(itemObj.id) : customUrl;
 
        if (itemObj.id == selectedId || (itemObj.id == 'Custom' && selectedId.indexOf('img:') == 0))
        	selectedImageId[itemId] = true;
        
        treeArray.push({id: itemId, name: itemObj.name, image: itemUrl, origId: itemObj.id});
    }
    
    function _formatIconId(itemObj) {
    	var parts = itemObj.id.split('.');
    	var ret = parts.join('_');
    	if (itemObj.group) ret = itemObj.group + '.' + ret;
    	return ret;
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

//-------------------------------------------------------------------------------------------------
module_init();
})();

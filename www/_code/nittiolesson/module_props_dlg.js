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
var NittioLessonModulePropsDlgSrv = ['nl', 'nlDlg', 'nlTreeSelect', 'nlModuleStatusInfo', 'nlResourceAddModifySrv',
function(nl, nlDlg, nlTreeSelect, nlModuleStatusInfo, nlResourceAddModifySrv) {
	var _oLesson = null;
	var _moduleConfig = null;
	var _isPdf = false;
	var _bModify = false;
	var _lastStateOptional = null;
	var _lastStateAdditional = false;
	var _moduleProps = [];
	var _gradeInfo = {};
	var _subjectInfo = {};
	var _resourceDict = {};
	var _lessonId = null;
	var _parentScope = null;
	var _templateAnimations = null;
	this.init = function(oLesson, moduleConfig) {
		_oLesson = oLesson;
		_moduleConfig = moduleConfig;
	    _moduleProps = [{id: 'name', name: nl.t('Name'), type: 'string'},
	       {id: 'lessonState', name: nl.t('Status'), type: 'div', desc: ''},
		   {id: 'optional_attr', name: nl.t('Optional properties'), type: 'group'},
		   {id: 'grade', name: nl.t('{}', moduleConfig.grpProps.gradelabel), type: 'tree-select', group:'optional_attr'},
		   {id: 'subject', name: nl.t('{}', moduleConfig.grpProps.subjectlabel), type: 'tree-select', group:'optional_attr'},
		   {id: 'icon', name: nl.t('Icon'), type: 'image-select', group:'optional_attr'},
		   {id: 'background', name: nl.t('Background'), type: 'image-select', group:'optional_attr'},
		   {id: 'pdfUrl', name: nl.t('Pdf url'), type: 'string', condition: 'isPdf'},
		   {id: 'pdfSinglePage', name: nl.t('Single page'), type: 'check', condition: 'isPdf', 
		   		title: nl.t('Select this option to create a single page module.')},
		   {id: 'description', name: nl.t('Description'), type: 'textarea', group:'optional_attr'},
		   {id: 'esttime', name: nl.t('Estimated time'), type: 'number', group:'optional_attr', min: 1, max: 600},
		   {id: 'learningMode', name: nl.t('Module type'), type: 'select', group:'optional_attr'},
		   {id: 'passScore', name: nl.t('Pass score %'), type: 'number', group:'optional_attr', condition:'isQbOrAssessment', min: 0, max: 100},
		   {id: 'allowed_max_score', name: nl.t('Score limit'), type: 'number', condition: 'isQuestionBank', group:'optional_attr', min: 0},
		   {id: 'check_all_question_answered', name: nl.t('Ensure completion in learner mode'), type: 'check', group:'optional_attr',
				title: nl.t('Learner must complete the page to progress to next page.')},
			{id: 'check_all_question_on_browsing', name: nl.t('Ensure completion in browsing mode'), type: 'check', group:'optional_attr',
				title: nl.t('This parameter is applicable in the browse mode - example: when browsing through modules when assigning, when creating courses or when viewing modules during training. If this parameter is checked, trainer has to wait till voice over is played completely or the question on the page is answered before progressing to the next page.')},
		   {id: 'autoNavigate', name: nl.t('Auto move'), type: 'check', group:'optional_attr',
		   		title: nl.t('Page moves automatically to the next page.')},
		   {id: 'forumTopic', name: nl.t('Discussion topic'), type: 'string', group:'optional_attr'},
		   {id: 'blink_after', name: nl.t('Blink hotspot after'), type: 'number', group:'optional_attr', condition: 'isSelfLearningMode', min: 0},
		   {id: 'animScheme', name: nl.t('Animation scheme'), type:'select', condition: 'isAnimationShown', group:'optional_attr'},
		   {id: 'resetAnimation', name: nl.t('Reset page animations'), type: 'check', condition: 'isAnimationShown', group:'optional_attr', 
		   	title: nl.t('Selecting this checkbox will reset page level animations to currently selected animation scheme')},
		   {id: 'additional_attr', name: nl.t('Advanced properties'), type: 'group', condition: 'isBleedingEdge'}, 
		   {id: 'templateStylesCss', name: nl.t('Styles'), type: 'textarea', group:'additional_attr', condition: 'isBleedingEdge'},
		   {id: 'templateBgimgs', name: nl.t('Resource library'), type: 'textarea', group:'additional_attr', condition: 'isBleedingEdge'},
		   {id: 'templatePageTypes', name: nl.t('Page types'), type: 'textarea', group:'additional_attr', condition: 'isBleedingEdge'},
		   {id: 'templateAnimations', name: nl.t('Animation schemes'), type: 'textarea', group:'additional_attr', condition: 'isBleedingEdge'}];
		_updateModuleProps(_moduleProps);
		
	};

	
	var learningMode = [{id:'assesment', name:nl.t('Assesment module')},
						{id:'self', name: nl.t('Self learning module')},
						{id:'question', name: nl.t('Question bank module')}];

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
		icon: nl.t('<ul><li>Choose the image that will be displayed when this module is searched. Click on edit icon for setting your own image.</li></ul>'),
		background: nl.t('Choose the background template for the whole module from a rich set of options. Try "Custom" when you are not satisfied with the provided options.'),
		pdfUrl: nl.t('<b>Mandatory:</b> Enter the url uploaded pdf.'),
		pdfSinglePage: nl.t('When selected, all PDF pages are displyaed one below another in a single page module. Otherwise, one module page is created per PDF page.'),
		description: nl.t('Write a description which will help others in the group to understand the purpose of this module.'),
		esttime: nl.t('Estimated time in minutes (between 1 and 600) to complete this learning module. When this learning module is sent as an assignment, the assignment duration is pre-filled with the estimated time if available.'),
		learningMode: nl.t('Self learining modules are not scored and hints are shown to the learner while learning. Assesment modules are scored and correct answers are shown only on completion of the module.'),
		forumTopic: nl.t('provide name of the discussion topic which should be displayed when the learner clicks on discussion forum icon from this module. This could be further change at page level. This field is the default at module level.'),
		blink_after: nl.t('This attribute is only applicable for simulation pages. The hotspot in the simulation page by default is not visible to the learner. In self learning mode, you can define the number of attempts after which the blinker will be displayed. For guided simulations, set this value to 0 and the blinker will always be displayed to the learner. Set this value to a number more than 0 to display the blinker after that many wrong attempts. Do not set this value (empty) to never show the blinker during the learning session.'),
		passScore: nl.t(' Minimum pass score in percentage (between 0 and 100 - both inclusive) for passing this module. Set this to zero to consider any score as passed. Clean the value to go back to the default value.'),
		animScheme: nl.t('You could animate your content according to different available schemes. You can also change the animation scheme at page level too by setting the Page animation parameter in page properties dialog.'),
		resetAnimation: nl.t('You check this to reset animation set at page level to currently selected animation scheme.'),
		additional_attr: nl.t('Advanced properties are typically set only in templates. Touch these attributes only if you know what you are doing.'),
		templateStylesCss: nl.t('define custom CSS classes to be used in styling the module content.'),
		templateBgimgs: nl.t('Provide a list of images (to be displayed in resource library tab of Select Resouerce dialog) as a JSON array of strings.'),
		templatePageTypes: nl.t('Provide page types and layout as a JSON object.'),
		templateAnimations: nl.t('Provide animation schemes as a JSON object.'),
		lessonState: lessonStatusDesc,
		allowed_max_score: nl.t('This parameter is specific to question bank. When the question bank is distributed, each learner will get random subset of questions and in randomoized order. If "Score limit" is greater than 0, the total score of the chosen questions will be kept equal to the score limit. If "Score limit" is 0, all questions in the bank will be chosen but presented in random order. If the maximum scores are different for different pages, it is possible that the maximum score of chosen pages is slightly less than the score limit.'),
		check_all_question_answered: nl.t('If this parameter is checked, learner is forced to complete a page before progressing to the next page. In assement modules, the learner is allowed to navigate to next page only after answering all questions in the current page and in all popups of the current page. In self learning modules, additionally the progress is blocked till the answer provided is correct.'),
		check_all_question_on_browsing: nl.t('If this parameter is checked, trainer is forced to wait till voice over completely played and answer question on navigating to next page while bowsing through the module.'),
		autoNavigate: _getHelpForAutoNavigate()
	};
	
	function _getHelpForAutoNavigate() {
		var help = nl.t('<div>If this parameter is checked, automatic navigation to the next page happens after the page voice for the current page is played completely.</div>');
			help += nl.t('<div>Checking this parameter does not ensure completion of a page.</div>');
			help += nl.t('<div>Auto move is supported for below conditions.</div>');
			help += '<ul><li>Auto move works only for information and MCQ page types.</li>';
			help += '<li>If the MCQ page has voice over, then auto move happens only after the page voice has played completely and the learner has clicked on an option.</li>';
			help += '<li>If the MCQ page has no voice over then automove happens after an option is clicked.</li>';
			help += '<li>In self learning modules for MCQ pages, auto move happens only after the correct answer has been selected.</li>';
			help += '<li>The auto move functionality is also applicable across the popup pages.</li>';
			help += '<li>No auto movement happens for pages which have popups.</li></ul>';
		return help;
	}

	function _updateModuleProps(_moduleProps) {
		for (var i=0; i<_moduleProps.length; i++) {
			var prop = _moduleProps[i];
			prop.help = moduleHelp[prop.id] || null;
		}
	}

	this.showDlg = function(isCreate, bFromPdf, resourceDict, templateAnimations, lessonId) {
		_isPdf = bFromPdf;
		_bModify = isCreate ? false : true;
		_resourceDict = resourceDict;
		_lessonId = lessonId;
		_templateAnimations = templateAnimations;
		var doneButtonText = isCreate ? nl.t('Create') : nl.t('Done');
		_parentScope = nl.rootScope;
		return nl.q(function(resolve, reject) {
			var editDlg = nlDlg.create(_parentScope);
			editDlg.setCssClass('nl-height-max nl-width-max');
			_initEditDlg(editDlg);
			var okButton = {text: doneButtonText, onTap: function(e) {
				if(!_validateInputs(editDlg.scope)) {
					if (e) e.preventDefault();
					return;
				}
				_lastStateOptional = editDlg.scope.data.showGroup.optional_attr;
				_lastStateAdditional = editDlg.scope.data.showGroup.additional_attr;
				_updateLessonObj(editDlg.scope.data);
				resolve({background: editDlg.scope.data.background, bgShade: editDlg.scope.data.bgShade});
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
        var selectedGrades = Object.keys(nlTreeSelect.getSelectedIds(_gradeInfo));
        var selectedSubjects = Object.keys(nlTreeSelect.getSelectedIds(_subjectInfo));
        _oLesson.grade = selectedGrades.length == 0 ? _gradeInfo.data[0].id : selectedGrades[0];
        _oLesson.subject = selectedSubjects.length == 0 ? _subjectInfo.data[0].id : selectedSubjects[0];
        _oLesson.image = 'img:' + data.icon;
        _oLesson.template = nl.fmt2('img:{}[{}]', data.background, data.bgShade);
		_oLesson.blink_after = data.blink_after;
        if (!_oLesson.props) _oLesson.props = {};
        _oLesson.props.animationScheme = data.animScheme ? data.animScheme.id : '';
        if(data.learningMode.id == 'self') {
            _oLesson.selfLearningMode = true;
        } else {
            delete _oLesson.selfLearningMode;
        }
        
		if(_isPdf) {
			_oLesson.pdfSinglePage = data.pdfSinglePage;
			_oLesson.pdfUrl = data.pdfUrl;
		}
		_oLesson.forumTopic = data.forumTopic;
		_oLesson.description = data.description;
		_oLesson.keywords = data.keywords; 
		_oLesson.esttime = data.esttime;
		_oLesson.passScore = data.passScore;
		_oLesson.check_all_question_answered = data.check_all_question_answered || false;
		_oLesson.check_all_question_on_browsing = data.check_all_question_on_browsing || false;
		
		_oLesson.autoNavigate = data.autoNavigate || false;
		if(data.learningMode.id == 'question') {
			_oLesson.allowed_max_score = data.allowed_max_score || 0;
		}
		else{
			delete _oLesson.allowed_max_score;
		}
		_oLesson.templateStylesCss = data.templateStylesCss;
		_oLesson.templateBgimgs = data.templateBgimgs;
		_oLesson.templatePageTypes = data.templatePageTypes;
		_oLesson.templateAnimations = data.templateAnimations;
		if(data.resetAnimation) {
			_updatePageLevelAnimation();
		}
	}

	function _updatePageLevelAnimation() {
		for(var i=0; i<_oLesson.pages.length; i++) {
			_oLesson.pages[i].pageAnimation = "";
			_updatePageAnimation(_oLesson.pages[i]);
		}
	}

	function _updatePageAnimation(oPage) {
        for (var i=0; i<oPage.sections.length; i++) {
            var oSection = oPage.sections[i];
            if (!oSection.popups || !oSection.popups.onclick) continue;
            var oSubPages = oSection.popups.onclick;
            for (var j=0; j<oSubPages.length; j++) {
				oSubPages[j].pageAnimation = "";
                _updatePageAnimation(oSubPages[j]);
            }
        }
	}

    function _validateInputs(scope) {
    	scope.error = {};
    	var data = scope.data;
        if(!data.name) return _validateFail(scope, 'name', 'Module name is mandatory');
        if(!data.icon) return _validateFail(scope, 'icon', 'Module icon is mandatory, please enter module icon url');
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
		editDlg.scope.options = {};
		editDlg.scope.data.items = _moduleProps;
		editDlg.scope.data.fixedHelp = 'Name is the only mandatory property. You may leave the rest of the properties to default. Properties could be changed anytime later.';
		editDlg.scope.data.name = _oLesson.name;
		editDlg.scope.data.forumTopic = _oLesson.forumTopic;
		editDlg.scope.data.blink_after = _oLesson.blink_after;
		editDlg.scope.data.description = _oLesson.description;
		editDlg.scope.data.keywords = _oLesson.keywords;
		editDlg.scope.data.esttime = parseInt(_oLesson.esttime);
		editDlg.scope.data.passScore = parseInt(_oLesson.passScore);
		var animInfo = _getAnimationInfo();
		editDlg.scope.showAnimScheme =  animInfo.show;
        editDlg.scope.data.animScheme = animInfo.selected;
        editDlg.scope.data.resetAnimation = false;
		_updateSelectedBg(editDlg.scope.data);
		
		editDlg.scope.data.showSearch = {};
		editDlg.scope.data.check_all_question_answered = _oLesson.check_all_question_answered || false;
		editDlg.scope.data.check_all_question_on_browsing = _oLesson.check_all_question_on_browsing || false;
		
		editDlg.scope.data.autoNavigate = _oLesson.autoNavigate || false;
		if('allowed_max_score' in _oLesson) {
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

		editDlg.scope.options = {animScheme: animInfo.opts,
								 grade: _gradeInfo, 
								 subject: _subjectInfo,
								 learningMode: learningMode};
		editDlg.scope.data.grade = {id: _oLesson.grade, name: _oLesson.grade};
		editDlg.scope.data.subject = {id: _oLesson.subject, name: _oLesson.subject};						 
		editDlg.scope.data.icon = nl.url.lessonIconUrl(_oLesson.image || 'NittioSun.png');
		editDlg.scope.data.lessonState = lessonStates[_oLesson.state] || lessonStates[0];
		editDlg.scope.data.learningMode = ('allowed_max_score' in _oLesson) ? learningMode[2]
			: _oLesson.selfLearningMode ? learningMode[1] : learningMode[0];
		editDlg.scope.data.canShow = function(condition, item) {
			if (item.group in editDlg.scope.data.showGroup && !editDlg.scope.data.showGroup[item.group]) return false;
			if (condition == 'isPdf') return _isPdf;
			if (condition == 'isQuestionBank') return (editDlg.scope.data.learningMode.id == 'question');
			if (condition == 'isQbOrAssessment') return (editDlg.scope.data.learningMode.id == 'assesment')||(editDlg.scope.data.learningMode.id == 'question');
			if (condition == 'isBleedingEdge') return (_moduleConfig.grpProps.isBleedingEdge);
			if (condition == 'isAnimationShown') return editDlg.scope.showAnimScheme;
			if (condition == 'isSelfLearningMode') return (editDlg.scope.data.learningMode.id == 'self');
			return true;
		};
		
		editDlg.scope.onFieldClick = function(fieldId) {
			var resFilter = fieldId == 'background' ? 'bg' : 'icon';
			var selectedImgUrl = fieldId == 'background' ? (editDlg.scope.data.background || '') : (editDlg.scope.data.icon || '');
			var bgShade = fieldId == 'background' ? (editDlg.scope.data.bgShade || 'bglight') : '';
			var markupText = nl.fmt2('img:{}[{}]', selectedImgUrl, bgShade); 
			var promise = nlResourceAddModifySrv.insertOrUpdateResource(_parentScope, 
				            _moduleConfig.restypes, markupText, false, _resourceDict, resFilter, _lessonId);
    		promise.then(function(selected) {
    			if (!selected || !selected.url) return;
    			if(resFilter == 'bg') {
		            editDlg.scope.data.background = selected.url;
		            editDlg.scope.data.bgShade = selected.bgShade || 'bgdark';
    			} else if(resFilter == 'icon') {
		            editDlg.scope.data.icon = selected.url;
    			}
    		});
		};
	}

    function _getAnimationInfo() {
        var ret = {opts: [], selected: null, show: false};
        var lessonProps = _oLesson.props || {};
        var selectedId = lessonProps.animationScheme || null;
        for (var s in _templateAnimations) {
            if (s == 'customEffects') continue;
            ret.show = true;
            var opt = {id: s, name: _templateAnimations[s].name || s};
            ret.opts.push(opt);
            if (s == selectedId) ret.selected = opt;
        }
        return ret;
    }

	function _updateSelectedBg(sd) {
		var template = _oLesson.template || '';
		if (template.indexOf('img:') != 0) {
            var selectedRes = null;
            var _resourceList = _resourceDict.resourcelist;
            for(var i in _resourceList) {
                var item = _resourceList[i];
                if(item.id == template) {
                    selectedRes = item;
                    break;
                }
                if (!selectedRes && item.bgShade) selectedRes = item;
            }
            sd.background = selectedRes.background;
            sd.bgShade = selectedRes.bgShade;
            return;
		}
		
		var index = template.indexOf('[');
        var index2 = template.indexOf(']');
		sd.background = template.substring(4, index);
		// To workaround a code bug (caused in v114) which left the template with too many "["
		// Some modules might still have oLesson.template with values like img:url[[[[[bglight]
		var indexStartShade = template.lastIndexOf('['); 
		sd.bgShade = template.substring(indexStartShade+1, index2);
	}
}]; 

//-------------------------------------------------------------------------------------------------
module_init();
})();

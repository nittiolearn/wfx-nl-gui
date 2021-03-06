(function() {

//-------------------------------------------------------------------------------------------------
// course_edit.js:
// course_edit module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.course_edit', [])
    .service('nlCourseEditor', NlCourseEditorSrv)
    .directive('nlCourseEditor', CourseEditDirective())
    .directive('nlCourseEditorFields', EditorFieldsDirective());
}

//-------------------------------------------------------------------------------------------------
function CourseEditDirective() {
    var templateUrl = 'view_controllers/course/editor/course_editor.html';
    return _nl.elemDirective(templateUrl, true);
}

//-------------------------------------------------------------------------------------------------
function EditorFieldsDirective() {
    var scope = {
        attrs: '=',
        help: '=',
        values: '=',
		editor: '=',
		item: '='
    };
    var templateUrl = 'view_controllers/course/editor/course_editor_fields.html';
    return _nl.elemDirective(templateUrl, scope);
}

//-------------------------------------------------------------------------------------------------
var NlCourseEditorSrv = ['nl', 'nlDlg', 'nlServerApi', 'nlLessonSelect', 
'nlExportLevel', 'nlRouter', 'nlCourseCanvas', 'nlMarkup', 'nlTreeSelect', 'nlResourceAddModifySrv', 'nlGroupInfo', 'nlExpressionProcessor', 'nlOuUserSelect', 'nlLanguageTranslateSrv',
function(nl, nlDlg, nlServerApi, nlLessonSelect, nlExportLevel, nlRouter, nlCourseCanvas, nlMarkup, nlTreeSelect, nlResourceAddModifySrv, nlGroupInfo, nlExpressionProcessor, nlOuUserSelect, nlLanguageTranslateSrv) {

    var modeHandler = null;
    var $scope = null;
    var _allModules = [];
    var _debug = null;
	var _userInfo = null;
	var _groupInfo = null;
	var _etm = null;
	var _modes = null;
	var _languageTree = nlLanguageTranslateSrv.getTranslationLangs();

	this.init = function(_scope, _modeHandler, userInfo, modes) {
		var promise = nlGroupInfo.init1();
		promise.then(function() {
			nlGroupInfo.update();
			_groupInfo = nlGroupInfo.get();
			_initMilestoneDict();
			$scope.editor.treeOptions = _getTreeOptions();
		});
        $scope = _scope;
        modeHandler = _modeHandler;
		_userInfo = userInfo;
		_modes = modes;
		_etm = (_userInfo && _userInfo.groupinfo && _userInfo.groupinfo.features['etm']) || false;
		var params = nl.location.search();
        if ('debug' in params) _debug = true;
		_updateCourseAndModuleAttrOptions(userInfo);
        $scope.editor = {
        	jsonTempStore: {},
        	course_params: _getCourseParams(),
        	course_paramStore: {course: modeHandler.course, content: modeHandler.course.content, metadata: modeHandler.course.content.contentmetadata || {}},
            module_attributes: moduleAttrs,
            course: modeHandler.course,
			debug: _debug,
			etm: _etm,
            showGroup: {},
            onLaunch: _onLaunch,
            addModule: _addModule,
            deleteModule: _deleteModule,
            searchLesson: _searchLesson,
            organiseModules: _organiseModulesDlg,
            saveCourse: _saveCourse,
            onBooleanClick: _onBooleanClick,
            onAttrChange: _onAttrChange,
            validateTextField: _validateTextField,
			editAttribute: _editAttribute,
			showWikiMarkupPreview: _showWikiMarkupPreview,
			getDisplayValue: _getDisplayValue,
			treeOptions: _getTreeOptions(),
			getUrl: _getLaunchUrl,
			onFieldClick: _onFieldClick,
			getIntelliTextOptions: _getIntelliTextOptions,
			addLanguage: _showAddLanguageDlg,
			removeLanguage: _removeLanguage,
			onTargetLangChange: _onTargetLangChange,
			canShowLangSection: false,
			targetLang: 'en',
			targetLangName: 'English',
			canShowMultiLang: _isMultiLangEnabled
		};
		return promise;
	};

	function _isMultiLangEnabled() {
		return (_userInfo && _userInfo.groupinfo && _userInfo.groupinfo.features['multiLangCourse']) || false;
	}
	
	function _onTargetLangChange(e, selected) {
		$scope.editor.canShowLangSection = false;
        if(modeHandler.mode == _modes.EDIT && !_validateInputs(modeHandler.course, $scope.ext.item)) {
			if(e) e.preventDefault();
            return;
		}
		var lang = selected.lang;
		$scope.editor.targetLang = selected.lang; 
		$scope.editor.targetLangName = selected.name;
		var _course = modeHandler.course;
		if (lang == 'en') {
			nl.pginfo.pageTitle = modeHandler.course.name;
			if ($scope.ext.item.id != '_root')
				$scope.editorCb.onIconClick(e, $scope.ext.item);
			return;
		}
		if (!(lang in _course.content.languageInfo)) _course.content.languageInfo[lang] = {};
		var selectedLangInfo = _course.content.languageInfo[lang];
		if(!selectedLangInfo.name) selectedLangInfo.name = _course.name;
		if(!selectedLangInfo.description) selectedLangInfo.description = _course.description;
		var modules = _allModules;
		for(var i=0; i<modules.length; i++) {
			var cm = modules[i];

			if (!selectedLangInfo[cm.id]) selectedLangInfo[cm.id] = {};
			var itemInfo = selectedLangInfo[cm.id];
			itemInfo.id = cm.id;
			itemInfo.type = cm.type;
			if (!itemInfo.name) itemInfo.name = cm.name;
			if ((cm.type == 'lesson-assesment' || cm.type == 'lesson-self') && !itemInfo.refid) itemInfo.refid = '';
		}
		nl.pginfo.pageTitle = selectedLangInfo.name || _course.name;
		if ($scope.ext.item.id != '_root') $scope.editorCb.onIconClick(e, $scope.ext.item);
	}

	function _removeLanguage(pos) {
		var data = {title: 'Confirmation to remove', template: nl.t('Are you sure of removing this language?')};
		nlDlg.popupConfirm(data).then(function(result) {
			if(result) {
				var item = modeHandler.course.content.languages[pos];
				if(item.lang in modeHandler.course.content.languageInfo) delete modeHandler.course.content.languageInfo[item.lang];
				modeHandler.course.content.languages.splice(pos, 1);
			}
		});
	}

	function _showAddLanguageDlg(e) {
		var content = modeHandler.course.content;
		var langSelectionDlg = nlDlg.create($scope);
		var dlgScope = langSelectionDlg.scope;
		dlgScope.data = {};
		dlgScope.funcs = {};
		dlgScope.options = {};
		dlgScope.data.dlgTitle = nl.t('Update course languages');
		dlgScope.data.addedLangs = {};

		_updateAddedLanguages(content, dlgScope);
		_updateLanguageTree(dlgScope);

		var okButton = {text: nl.t('Change'), onTap: function(e) {
			e.preventDefault();
			var language = _getValidatedInputs(dlgScope.data);
			if(!language) return;
			modeHandler.course.content.languages.push(language);
			_onTargetLangChange(e, language);
			nlDlg.closeAll();
		}};

		var closeButton = {text: nl.t('Cancel')};
		langSelectionDlg.show('view_controllers/course/editor/language_selection_dlg.html', [okButton], closeButton);	
	}

	function _getValidatedInputs(data) {
		var selectedLang = null;
		var selectedLangs = nlTreeSelect.getSelectedIds(data.languageInfo);
		for (var key in selectedLangs) {
			selectedLang = selectedLangs[key];
		}
		if(!selectedLang) {
			nlDlg.popupAlert({title: 'Validation error', template: nl.t('Please select the language to add it as an course language')});
			return false;
		}	
		return {lang: selectedLang.origId, name: selectedLang.name};
	}

	function _updateAddedLanguages(content, dlgScope) {
		for(var i=0; i<content.languages.length; i++) {
			var language = content.languages[i];
			var langid = language.lang;
			dlgScope.data.addedLangs[langid] = true;
		}
	}

	function _updateLanguageTree(dlgScope) {
		var arrayParams = _getLanguageTree(dlgScope);
		var languageTreeInfo = {data: arrayParams[0] || []};
		var selectedIds = arrayParams[1]
		nlTreeSelect.updateSelectionTree(languageTreeInfo, {}, 2);
		languageTreeInfo.treeIsShown = true;
		languageTreeInfo.multiSelect = false;
		languageTreeInfo.fieldmodelid = 'languageTreeInfo';
		languageTreeInfo.sortLeafNodes = false;
		dlgScope.data.languageInfo =  languageTreeInfo; 
	}

	function _getLanguageTree(dlgScope) {
        var insertedKeys = {};
		var selectedLangId = {};
		var addedLangs = dlgScope.data.addedLangs;
		var treeArray = [];
        for(var i=0; i<_languageTree.length; i++) {
			var itemObj = _languageTree[i];
			if(itemObj.id in addedLangs) continue;
            _getIconNodeWithParents(itemObj, treeArray, insertedKeys, '', selectedLangId);
        }
        return [treeArray, selectedLangId];
    }

    function _getIconNodeWithParents(itemObj, treeArray, insertedKeys, _preSelectedLanguage, selectedLangId) {
        if (itemObj.group && !insertedKeys[itemObj.group]) {
        	insertedKeys[itemObj.group] = true;
        	treeArray.push({id: itemObj.group, name: itemObj.group, isOpen: true});
        }
        var itemId = itemObj.group ? itemObj.group + '.' + itemObj.id : itemObj.id;
        if(itemObj.id === _preSelectedLanguage) selectedLangId[itemId] = true;
        if (insertedKeys[itemId]) return;
    	insertedKeys[itemId] = true;        
        treeArray.push({id: itemId, name: itemObj.name, origId: itemObj.id});
    }
	
	function _getIntelliTextOptions(cm) {
		var ret = {
			'$':[
					{ "name": "$max - maximum of given items", "val": "$max{}", "cursor": -1 }, 
					{ "name": "$min - minimum of given items", "val": "$min{}", "cursor": -1 },
					{ "name": "$sum - sum of given items", "val": "$sum{}", "cursor": -1 },
					{ "name": "$avg - average of given items", "val": "$avg{}", "cursor": -1 },
					{ "name": "$avg_top - average of top 'n' items", "val": "$avg_top{}", "cursor": -1 },
					{ "name": "$nth_min - nth loweest of the given items", "val": "$nth_min{}", "cursor": -1 },
					{ "name": "$if - condition with values for true and false", "val": "$if{}", "cursor": -1 },
				],
			'_':[]
		};
        for(var i=0; i < _allModules.length; i++){
			var m = _allModules[i];
			if (m.type === 'module') continue;
			if (m.id === cm.id) break;
			var n = nl.fmt2('{} ({})', m.name, m.id);
			ret['_'].push({name: n, val: m.id, cursor: 0});
		}
		return ret;
	}

    this.getAllModules = function(bClear) {
    	if (bClear) _allModules = [];
    	return _allModules;
    };
    
	this.initSelectedItem = function(cm) {
		_updateDropdowns(cm);
		return _initEditorTempJson(cm);
	};

	this.validateInputs = function(cm) {
		return _validateInputs(modeHandler.course, cm);		
	};

	function _onFieldClick() {
		var resFilter = 'icon';
		var selectedImgUrl = modeHandler.course.icon != "icon:" ? modeHandler.course.icon : "icon:";
		var bgShade = '';
		var markupText = nl.fmt2('img:{}[{}]', selectedImgUrl, bgShade); 
		var promise = nlResourceAddModifySrv.insertOrUpdateResource($scope, 
						_userInfo.groupinfo.restypes, markupText, false, null, resFilter, modeHandler.course.id);
		promise.then(function(selected) {
			if (!selected || !selected.url) return;
			if(resFilter == 'icon') {
				modeHandler.course.icon = selected.url;
			}
		});
	}
	
    function _updateDropdowns(cm) {
    	var attrs = $scope.editor.module_attributes;
    	for(var i=0; i<attrs.length; i++) {
    		var attr = attrs[i];
    		if (!attr.updateDropdown) continue;
    		attr.updateDropdown(cm, attr);
    	}
    }
    
	function _updateTypeDropdown(cm, attr) {
		if (!_groupInfo) return;
		if (attr.valueNamesUpdated) return;
		attr.valueNamesUpdated = true;
		attr.valueNames = {'module': 'Folder', 'lesson-assesment': 'Assessment module', 'lesson-self': 'Self learning module',
			'link': 'Link', 'info': 'Information', 'certificate': 'Certificate',
			'iltsession': 'ILT session', 'milestone': 'Milestone', 'rating': 'Rating', 'gate': 'Gate'};
		attr.values = ['module', 'lesson-assesment', 'lesson-self', 'info', 'certificate'];
    	if (cm.type == 'link' || _debug)
		   attr.values.push('link');
		if (cm.type == 'iltsession' || (_groupInfo && _groupInfo.props.features['training'])) 
			attr.values.push('iltsession');
		if (cm.type == 'milestone' || (_etm && _groupInfo.props.milestones))
			attr.values.push('milestone');
		if (cm.type == 'rating' || (_etm && _groupInfo.props.ratings))
			attr.values.push('rating');
		if (cm.type == 'gate' || _etm) 
			attr.values.push('gate');
		return;
	}

	var _ratings = [];
	function _updateRatingDropdown(cm, attr) {
		if (!_etm || !_groupInfo) return;
		if (attr.valueNamesUpdated) return;
		_ratings = _groupInfo.props.ratings || [];
		attr.valueNames = {};
		attr.values = [];
		for (var i=0; i<_ratings.length; i++) {
			var r = _ratings[i];
			attr.values.push(r.id);
			attr.valueNames[r.id] = r.name;
		}
		return;
	}

	var _userStates = [];
	function _updateNewStatusDropdown(cm, attr) {
		if (!_etm || !_groupInfo) return;
		if (attr.valueNamesUpdated) return;
		_userStates = _groupInfo.props.etmUserStates || [];
		attr.valueNames = {'':' '};
		attr.values = [''];
		for (var i=0; i<_userStates.length; i++) {
			var r = _userStates[i];
			attr.values.push(r.id);
			attr.valueNames[r.id] = r.name;
		}
		return;
	}

	function _updateCertificateFormatDropdown(cm, attr) {
		if (attr.valueNamesUpdated) return;
		attr.valueNamesUpdated = true;
		attr.valueNames = {'default': 'Certificate with score if available',
			'no_score': 'Certificate without score'};
		attr.values = ['default', 'no_score'];
	}

	function _canShowNewState(attr) {
		return false;
		if (attr.name != 'customStatus') return true;
		return (_etm && _groupInfo && ('etmUserStates' in _groupInfo.props));
	}

	function _canShowNHT(attr) {
		if (attr.name != 'nht') return true;
		return _etm;
	}

	var _milestones = [];
	var _milestoneDict = {};
	function _initMilestoneDict() {
		_milestones = _groupInfo.props.milestones ? angular.copy(_groupInfo.props.milestones) : [];
		_milestoneDict = {};

		for(var i=0; i< _milestones.length; i++) {
			var item = _milestones[i];
			item.index = i;
			_milestoneDict[item.id] = item;
		}
	}

	function _updateMilestoneDropdown(cm, attr) {
		if (!_etm || !_groupInfo) return;
		if (attr.valueNamesUpdated) return;
		attr.valueNames = {};
		attr.values = [];

		var startIndex = 0;
		for(var i=0; i< _allModules.length; i++) {
			if(cm.id === _allModules[i].id) break;
			if(_allModules[i].type !== 'milestone' || !_allModules[i].milestone_type) continue;
			var milestoneItem = _milestoneDict[_allModules[i].milestone_type] || {};
			if (!('index' in milestoneItem)) continue;
			startIndex = milestoneItem.index + 1;
		}

		for (var i=startIndex; i<_milestones.length; i++) {
			var m = _milestones[i];
			attr.values.push(m.id);
			attr.valueNames[m.id] = m.name;
		}
		return;
	}

	function _updateSecondAttemptDropdown(cm, attr) {
		attr.valueNames = {'': ' '};
		attr.values = [''];
		for(var i=0; i< _allModules.length; i++) {
			var item = _allModules[i];
			if(cm.id === item.id) break;
			if (item.type != 'lesson-assesment') continue;
			attr.values.push(item.id);
			attr.valueNames[item.id] = item.name;
		}
		return;
	}

	function _canShowReattempt(attr) {
		if(attr.name != 'isReattempt') return true;
		return _etm;
	}

	function _canShowLearningCredits(attr) {
		return _userInfo.groupinfo.features['learningCredits'];
	}

	function _onBooleanClick(e, attr, item) {
		item[attr.name] = !item[attr.name];
        _onAttrChange(e, attr, item);
    }

    function _onAttrChange(e, attr, item) {
        if (attr.level == 'course' && attr.name == 'name') {
            var title = item.name;
            if(!title)
                nlDlg.popupAlert({title: nl.t('Name is mandatory'), 
                    template: nl.t('Name of the course cannot be empty.')});
            else if (title.length === 30)
                nlDlg.popupAlert({title: nl.t('Name too long'), 
                    template: nl.t('It is recommended to keep the course name under 30 characters.')});
            else
                nl.pginfo.pageTitle = title;
            return;
        } else if (attr.level == 'content' && attr.name == 'canvasview') {
            nlCourseCanvas.updateCanvasMode();
            return;
        } else if (attr.level == 'modules' && attr.name == 'type') {
			attr.updateDropdown(item, attr);
			if (attr.name == 'type') _onElementTypeChange(e, item, attr);
            return;
        } else if (attr.level == 'modules' && attr.name == 'milestone_type') {
			item.name = attr.valueNames[item.milestone_type];
			return;
		}
	}

	var _startAfterTypeToSuported = {
		'lesson-assesment': {'min_score': true, 'max_score': true},
		'lesson-self': {},
		'info': {},
		'link': {},
		'certificate': {},
		'iltsession': {'iltCondition' : true},
		'milestone': {},
		'rating': {'min_score': true, 'max_score': true},
		'gate': {'min_score': true, 'max_score': true}
	};

	function _pruneStartAfter(cm, cmidToCm) {
		cmidToCm[cm.id] = cm;
		var sa = cm.start_after;
		if (!sa || sa.length == 0) return;
		var newSa = [];
		cm.start_after = newSa;
		for(var i=0; i<sa.length; i++) {
			var saItem = sa[i];
			if (saItem.module == cm.id) continue;
			var saCm = cmidToCm[saItem.module];
			if (!saCm) continue;
			var typeSupported = _startAfterTypeToSuported[saCm.type];
			if (!typeSupported) continue;
			newSa.push(saItem);
			for (var key in saItem) {
				if(key == 'module') continue;
				if(!typeSupported[key]) delete saItem[key];
			}
		}
	}

	function _onElementTypeChange(e, cm, attr){
		var childrenElem = [];
		//For first time if gate or rating is selected showInReport param is set to true;
		var courseContent = modeHandler.course.content;
		cm.name = nl.t('{} {}', attr.valueNames[cm.type], courseContent.lastId);
		if((cm.type == 'gate' || cm.type == 'rating') && !('showInReport' in cm)) cm.showInReport = true;
        for(var i=0; i < _allModules.length; i++){
			if (_isDescendantOf(_allModules[i], cm)) childrenElem.push(i);
        }
		if(cm.type !== 'module' && childrenElem.length > 1){
			var msg = {title: 'Please confirm', 
				   template: nl.t('If you change type from folder to other, the children elements will be removed. Are you sure to proceed?'),
				   okText: nl.t('Yes')};
			nlDlg.popupConfirm(msg).then(function(result){
				if(!result) return cm['type'] = 'module';
				var indicesToRemove = [];
		        for(var i=0; i < _allModules.length; i++){
		        	if (_isDescendantOf(_allModules[i], cm)) indicesToRemove.push(i);
		        }
		        indicesToRemove.splice(0, 1);
		        _removeElements(indicesToRemove);
                $scope.editorCb.updateChildrenLinks(_allModules);               
				$scope.editorCb.showVisible(cm);
			});
		}
	}

	function _validateTextField(value, attr){
	    if (!attr.maxlen) return;
		if(value.length === attr.maxlen) {
			var msg = {
			    title: nl.t('{} is too long', attr.text||attr.name), 
			    template: nl.t('{} must be less than {} character.', attr.text||attr.name, attr.maxlen)};
			nlDlg.popupAlert(msg).then(function(res){
				if(res) return;
			});
		}
	}

	function _editAttribute(e, cm, attr) {
		if (attr.name == 'start_after') {
			var dlg = new StartAfterDlg(nl, nlDlg, $scope, _allModules, cm);
			dlg.show();
		}
		if (attr.name == 'trainer_notes') {
			var dlg = new TrainerNotesDlg(nl, nlDlg, $scope, _allModules, cm, nlLessonSelect, _userInfo);
			dlg.show();
		}
	}
	
	function _showWikiMarkupPreview(e, cm, attr) {
		attr.showPreview = !attr.showPreview;
		nl.resizeHandler.broadcast('nl-adjust-height');
        var retData = {lessPara: true};
    	cm.textHtml = cm.text ? nlMarkup.getHtml(cm.text, retData): '';
	}
	
	function _getDisplayValue(cm, attr) {
		if (cm.start_after && attr.name == 'start_after') {
			var cnt  = cm.start_after.length;
			var plural = cnt > 1 ? 'dependencies' : 'dependency';
			return nl.fmt2('{} {} specified', cnt, plural);
		} else if(cm.trainer_notes && attr.name == 'trainer_notes'){
			var cnt  = cm.trainer_notes.length;
			var plural = cnt > 1 ? 'trainer notes' : 'trainer note';
			return nl.fmt2('{} {} added', cnt, plural);
		}
		return '';
	}
	
	function _getCourseParams() {
		var courseAttributes = {};
		for(var k in _courseParams) courseAttributes[_courseParams[k].name] = true;
		if (!('grade' in courseAttributes)) _courseParams.splice(1, 0, {name: 'grade', stored_at: 'metadata', text: _userInfo.groupinfo.gradelabel, type: 'tree-select', help:nl.t('Add {} to course', _userInfo.groupinfo.gradelabel)});
		if (!('subject' in courseAttributes)) _courseParams.splice(2, 0, {name: 'subject', stored_at: 'metadata', text: _userInfo.groupinfo.subjectlabel, type: 'tree-select', help:nl.t('Add {} to course', _userInfo.groupinfo.subjectlabel)});
		return _courseParams;
	}
	
	function _getTreeOptions() {
		var selectedGrade = {};
		var selectedSubject = {};
		var selectedOus = {};
		if(!('contentmetadata' in modeHandler.course.content)) modeHandler.course.content.contentmetadata = {};
		if(modeHandler.course.content.contentmetadata.grade) {
			selectedGrade[modeHandler.course.content.contentmetadata.grade] = true;
		} else {
			selectedGrade[_userInfo.groupinfo.grades[0]] = true;
			modeHandler.course.content.contentmetadata.grade = _userInfo.groupinfo.grades[0];
		}
		if(modeHandler.course.content.contentmetadata.subject) {
			selectedSubject[modeHandler.course.content.contentmetadata.subject] = true;
		} else {
			selectedSubject[_userInfo.groupinfo.subjects[0]] = true;
			modeHandler.course.content.contentmetadata.subject = _userInfo.groupinfo.subjects[0];
		}

		var _gradeInfo = {data: nlTreeSelect.strArrayToTreeArray(_userInfo.groupinfo.grades || [])};
        nlTreeSelect.updateSelectionTree(_gradeInfo, selectedGrade);
        _gradeInfo.treeIsShown = false;
        _gradeInfo.multiSelect = false;
		_gradeInfo.fieldmodelid = 'grade';
		_gradeInfo.onSelectChange = function() {
			modeHandler.course.content.contentmetadata.grade = Object.keys(nlTreeSelect.getSelectedIds(_gradeInfo))[0];
		};
        
       	var _subjectInfo = {data: nlTreeSelect.strArrayToTreeArray(_userInfo.groupinfo.subjects || [])};
        nlTreeSelect.updateSelectionTree(_subjectInfo, selectedSubject);
        _subjectInfo.treeIsShown = false;
        _subjectInfo.multiSelect = false;
		_subjectInfo.fieldmodelid = 'subject';
		_subjectInfo.onSelectChange = function() {
			modeHandler.course.content.contentmetadata.subject = Object.keys(nlTreeSelect.getSelectedIds(_subjectInfo))[0];
		};
		var _ouList = {}
		if(_groupInfo) {
			if(modeHandler.course.content.oulist) {
				var oulist = modeHandler.course.content.oulist || [];
				for(var i=0; i<oulist.length; i++) selectedOus[oulist[i]] = true;
			}
			var outreeArray = _getOuTreeArray(_groupInfo.outree);
			_ouList = {data: nlTreeSelect.strArrayToTreeArray(outreeArray || [])};
			nlTreeSelect.updateSelectionTree(_ouList, selectedOus);
			_ouList.treeIsShown = false;
			_ouList.multiSelect = true;
			_ouList.fieldmodelid = 'oulist';
			_ouList.onSelectChange = function() {
				modeHandler.course.content.oulist = [];
				var selectedIds = nlTreeSelect.getSelectedIds(_ouList);
				for(var key in selectedIds) modeHandler.course.content.oulist.push(key);
			};
		}
		return {grade: _gradeInfo, subject: _subjectInfo, oulist: _ouList};
	}

	function _getOuTreeArray(outree) {
		var outreeArray = [];
		for(var i=0; i<outree.length; i++) {
			var ou = outree[i];
			outreeArray.push(ou.id);
			if(ou.children) _getChildreOuTreeArray(ou.children, outreeArray);
		}
		return outreeArray;
	}

	function _getChildreOuTreeArray(outree, outreeArray) {
		for(var i=0; i<outree.length; i++) {
			var ou = outree[i];
			outreeArray.push(ou.id);
			if(ou.children) _getChildreOuTreeArray(ou.children, outreeArray);
		}
	}

    var _courseParams = [
        {name: 'name', stored_at: 'course', text: 'Name', type: 'string', isTitle: true},
        {name: 'icon', stored_at: 'course', text: 'Image', type: 'icon', icon: true},
        {name: 'description', stored_at: 'course', text: 'Course description', type: 'text', maxlen: 100},
		{name: 'nht', stored_at: 'content', text: 'New hire training', type: 'boolean', desc: 'This is an NHT course',
			canShow: function(attr) {return _canShowNHT(attr);}
		},
        {name: 'grp_additionalAttrs', stored_at: 'content', type: 'group', text: 'Advanced properties'},
    	{name: 'planning', stored_at: 'content', text:'Schedule planning', desc: 'Enable schedule planning for this course', group: 'grp_additionalAttrs', type: 'boolean', debug: true},
     	{name: 'hide_answers', stored_at: 'content', text:'Hide answers', desc: 'Disallow learners to view completed modules', group: 'grp_additionalAttrs', type: 'boolean'},
		{name: 'oulist', stored_at: 'content', text: 'Publish for', type: 'tree-select', group: 'grp_additionalAttrs'},
		{name: 'certificate', stored_at: 'content', text: 'Certificate configuration', type: 'hidden', group: 'grp_additionalAttrs'},
    	{name: 'custtype', stored_at: 'content', text: 'Custom type', type: 'number', group: 'grp_additionalAttrs'},
        {name: 'exportLevel', stored_at: 'content', text: 'Visibility', type: 'list', values: [], valueNames: {}, group: 'grp_additionalAttrs'},
        {name: 'contentmetadata', stored_at: 'metadata', text: 'Metadata', type: 'object', group: 'grp_additionalAttrs', debug: true},
    	{name: 'lastId', stored_at: 'content', text: 'Last Id', type: 'readonly', group: 'grp_additionalAttrs', debug: true},
        {name: 'modules', stored_at: 'content', text: 'Modules', type: 'hidden', group: 'grp_additionalAttrs', debug: true},
        {name: 'contentVersion', stored_at: 'content', text: 'Content Version', type: 'hidden', group: 'grp_additionalAttrs', debug: true},
        {name: 'languages', stored_at: 'content', text: 'Content Version', type: 'hidden', group: 'grp_additionalAttrs', debug: true},
        {name: 'grp_canvasAttrs', stored_at: 'content', type: 'group', text: 'Canvas properties'},
        {name: 'canvasview', stored_at: 'content', type: 'boolean', text: 'Canvas mode', desc: 'View the course in a visual canvas mode', group: 'grp_canvasAttrs'},
        {name: 'bgimg', stored_at: 'content', type: 'string', text: 'Background image', group: 'grp_canvasAttrs'},
        {name: 'bgcolor', stored_at: 'content', type: 'string', text: 'Background color', group: 'grp_canvasAttrs'}
    ];
    
    var _courseParamsHelp = {
        name: 'Mandatory - enter a name for your course. It is recommended to keep the course name under 30 characters.',
        icon: 'Mandatory - enter a URL for the course icon that will be displayed when this course is searched. The default value is "icon:" which displays a default course icon.',
        description: 'Provide a short description which will help others in the group to understand the purpose of this course. It is recommended to keep the course description under 100 characters.',
        nht: 'NHT courses allow modelling of learner states. Only courses for which this flag is enabled are considered in the NHT report tab of the learning report. ',
    	planning: 'Start and end dates are considered only if schedule planning is enabled.',
    	hide_answers: 'Enable this attribute if this course is for assessment purpose and you would like to disallow the learners to see the correct answers.',
    	custtype: 'You can define a custom type to help in searchability.',
        exportLevel: 'This property is visible only if the group has option to export content to other groups.',
        contentmetadata: 'Metadata attributes.',
    	lastId: 'Internally used.',
        grp_canvasAttrs: 'Canvas mode is a visual represenation of course where laarning items are placed in the backdrop of an image. Learners will be able to navigate into the specific section in a more visual way.',
        canvasview: 'You can create a visual game like courses when you enable this mode. In this mode, learners will view the course items in a visual canvas instead of a structured tree. Each folder in the course will open into another canvas with the sub-items represented in the canvas.',
        bgimg: 'Select the background image to be displayed in the canvas.',
		bgcolor: 'The background image is resized to retain aspect ratio. This could result in horizontal or vertical bands. You can choose the color of the bands to align with the edge of the image.',
		oulist : 'By default, published courses are visible to all trainers. You may restrict the visibality to trainers belonging to specific org units.'
    };
    
    var moduleAttrs = [
		{name: 'type', stored_at: 'module', fields: ['module', 'lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate'], type: 'list', text: 'Element type',
			// possible values will be updated in _updateTypeDropdown
			valueNamesUpdated: false, valueNames: {}, values: [], 
            updateDropdown: _updateTypeDropdown},
		{name: 'refid', stored_at: 'module', fields: ['lesson-assesment', 'lesson-self'], type: 'lessonlink', contentType: 'integer', text: 'Module-id'},
		{name: 'rating_type', stored_at: 'module', fields: ['rating'], type: 'list', text: 'Rating type',
			// possible values will be updated in _updateRatingDropdown
			valueNamesUpdated: false, valueNames: {}, values: [], 
			updateDropdown: _updateRatingDropdown},
		{name: 'milestone_type', stored_at: 'module', fields: ['milestone'], type: 'list', text: 'Milestone type',
			// possible values will be updated in _updateMilestoneDropdown
			valueNamesUpdated: false, valueNames: {}, values: [], 
			updateDropdown: _updateMilestoneDropdown},
		{name: 'name', stored_at: 'module', fields: ['module', 'lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate'], type: 'string', text: 'Name'}, 
		{name: 'maxDuration', stored_at: 'module', fields: ['lesson-assesment', 'lesson-self'], type: 'string', contentType: 'integer', text: 'Time limit (minutes)'},
        {name: 'action', stored_at: 'module', fields: ['link'], type: 'lessonlink', text: 'Action'},
        {name: 'urlParams', stored_at: 'module', fields: ['link'], type: 'string', text: 'Url-Params'},
        {name: 'certificate_image', stored_at: 'module', fields: ['certificate'], type: 'string', text: 'Certificate image'},
		{name: 'certificate_format', stored_at: 'module', fields: ['certificate'], type: 'list', text: 'Certificate format',
			// possible values will be updated in _updateCertificateFormatDropdown
			valueNamesUpdated: false, valueNames: {}, values: [], 
            updateDropdown: _updateCertificateFormatDropdown},
		{name: 'certificate_expire_after', stored_at: 'module', fields: ['certificate'], type: 'number', text: 'Expire after'},
		{name: 'iltduration', stored_at: 'module', fields: ['iltsession'], text: 'Session duration (minutes)',type: 'number'},
        {name: 'trainer_notes', stored_at: 'module', fields: ['iltsession'], type: 'object_with_gui', contentType: 'object', text: 'Trainer notes'},
        {name: 'gateFormula', stored_at: 'module', fields: ['gate'], text: 'Formula',type: 'intellitext'},
        {name: 'gatePassscore', stored_at: 'module', fields: ['gate'], text: 'Gate pass score',type: 'number', min:0, max:100},
		{name: 'learningCredits', stored_at: 'module', fields: ['lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate'], text: 'Learning Credits',type: 'number', min:0, max:100,
			canShow: function(attr) {return _canShowLearningCredits(attr);}},
        {name: 'start_after', stored_at: 'module', fields: ['lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate'], type: 'object_with_gui', contentType: 'object', text: 'Start after'},
		{name: 'second_attempt', stored_at: 'module', fields: ['lesson-assesment'], type: 'list', text: 'Second attempt of',
				valueNames: {}, values: [], 
				updateDropdown: _updateSecondAttemptDropdown},
        {name: 'canMarkAttendance', stored_at: 'module', text: 'Learner can mark attendance', type:'hidden', fields: ['iltsession']},
        {name: 'grp_depAttrs', stored_at: 'module', fields: ['lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate'], type: 'group', text: 'Planning', debug: true},
        {name: 'start_date', stored_at: 'module', fields: ['lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate'], type: 'date', text: 'Start date', group: 'grp_depAttrs', debug: true},
        {name: 'planned_date', stored_at: 'module', fields: ['lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate'], type: 'date', text: 'Planned date', group: 'grp_depAttrs', debug: true},
        {name: 'grp_additionalAttrs', stored_at: 'module', fields: ['module', 'lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate'], type: 'group', text: 'Advanced properties'},
        {name: 'maxAttempts', stored_at: 'module', fields: ['lesson-assesment'], type: 'number', text: 'Maximum attempts', group: 'grp_additionalAttrs'},
        {name: 'exclude_quiz', stored_at: 'module', fields: ['lesson-assesment'], type: 'boolean', text: 'Exclude score',  desc: 'Exclude this score from course report average score', group: 'grp_additionalAttrs'},
        {name: 'hide_locked', stored_at: 'module', fields: ['lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate'], type: 'boolean', text: 'Hide if locked', desc: 'Hide this item in learner/report view if item state is locked.', group: 'grp_additionalAttrs'},
        {name: 'reopen_on_fail', stored_at: 'module', fields: ['lesson-assesment'], type: 'object', text: 'Reopen on fail', contentType: 'object',group: 'grp_additionalAttrs'},
        {name: 'showInReport', stored_at: 'module', fields: ['gate', 'rating'], text: 'Show in the report', desc: 'Show score in the report', type: 'boolean', group: 'grp_additionalAttrs'},
        {name: 'hide_remarks', stored_at: 'module', fields: ['info', 'link'], type: 'boolean', text: 'Disable remarks', group: 'grp_additionalAttrs'},
		{name: 'autocomplete', stored_at: 'module', fields: ['link'], type: 'boolean', text: 'Auto complete',  desc: 'Mark as completed when viewed the first time', group: 'grp_additionalAttrs'},
		{name: 'hide_answers', stored_at: 'module', fields: ['lesson-assesment', 'lesson-self'], type: 'boolean', text: 'Hide ',  desc: 'Disallow reviewing the completed reports for learner.', group: 'grp_additionalAttrs'},
		{name: 'icon', stored_at: 'module', fields: ['module', 'lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate'], type: 'string', text: 'Icon', group: 'grp_additionalAttrs'},
        {name: 'text', stored_at: 'module', fields: ['module', 'lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate'], type: 'wikitext', valueName: 'textHtml', text: 'Description', group: 'grp_additionalAttrs', debug: true},
		{name: 'customStatus', stored_at: 'module', fields: ['lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate'], text: 'New status',type: 'list', group: 'grp_additionalAttrs', 
			valueNamesUpdated: false, valueNames: {}, values: [], 
			updateDropdown: _updateNewStatusDropdown,
			canShow: function(attr){return _canShowNewState(attr)}},
		{name: 'isReattempt', stored_at: 'module', fields: ['lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate'], text: 'Mark as reattempt', desc: 'Mark this to indicate learner has reattempted', type: 'boolean', group: 'grp_additionalAttrs', 
			canShow: function(attr) {return _canShowReattempt(attr);}
		},
        {name: 'parentId', stored_at: 'module', fields: ['module', 'lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate'], type: 'readonly', debug: true, text: 'Parent ID', group: 'grp_additionalAttrs', readonly: true}, 
        {name: 'id', stored_at: 'module', fields: ['module', 'lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate'], type: 'readonly', text: 'Unique ID', group: 'grp_additionalAttrs', readonly: true}, 
        {name: 'dependencyType', stored_at: 'module', fields: ['module', 'lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate'], type: 'readonly', text: 'Dependency type', group: 'grp_additionalAttrs', debug: true, readonly: true}, 
    	{name: 'totalItems', stored_at: 'module', fields : ['module'], type: 'readonly', text: 'Total items', group: 'grp_additionalAttrs'},
        {name: 'grp_canvasAttrs', stored_at: 'module', type: 'group', text: 'Canvas properties', fields: ['module', 'lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate']},
        {name: 'posX', stored_at: 'module', type: 'number', text: 'X Position', group: 'grp_canvasAttrs', fields: ['module', 'lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate']},
        {name: 'posY', stored_at: 'module', type: 'number', text: 'Y Position', group: 'grp_canvasAttrs', fields: ['module', 'lesson-assesment', 'lesson-self', 'link', 'info', 'certificate', 'iltsession', 'milestone', 'rating', 'gate']},
        {name: 'bgimg', stored_at: 'module', type: 'string', text: 'Background image', group: 'grp_canvasAttrs', fields: ['module']},
        {name: 'bgcolor', stored_at: 'module', type: 'string', text: 'Background color', group: 'grp_canvasAttrs', fields: ['module']}
	];
    
    var _moduleAttrHelp = {
    	name: 'Name of the item to be displayed in the course tree.',
		type: 'Each item could be a Folder (containing other items), Module (a learning module/quiz), Certificate or Information (example a declaration).',
		milestone_type: 'Select the milestone type in the order available. You may skip a few types as well. On Selecting the Last available Milestone type, Milestone Type will be empty in further items in the same course to restrict the further usage of milestone' ,
    	refid: 'The id of the learning module/quiz to be launched. You could search for all approved modules by clicking on the search icon. Click on the link icon to preview the module.',
    	maxDuration: 'You may restrict the learner to complete the module within the specified time limit. This values is pre-filled with the estimated time of module if configured in the module. You could clear this field (or set it to 0) if you do not want any time limit set for the module.',
    	action: 'The action whose URL is used for the link. Click on the icon to view the link',
    	urlParams: 'The urlParams to append to the URL (see Dashboard create/modify dialog for more information).',
		certificate_image: 'Provide a background image for your certificates.',
		certificate_format: 'Choose the format that best suites your needs.',
		certificate_expire_after: 'Provide certificate expiry date in days. The certificate is shown as expired after so many days after the certificate is received by the learner.',
		grp_depAttrs: 'Enabling this would display planning properties such as "Start date" and "Planned date".',
    	start_date: 'Earliest planned start date. Is applicable only if "planning" is set to true for the course.',
    	planned_date: 'Expected planned completion date. Is applicable only if "planning" is set to true for the course.',
    	grp_additionalAttrs: 'Enabling this would display additional properties depeneding on the selected "Element type" of the module.',
    	trainer_notes: 'You could attach a set of approved modules as trainer notes for current item. These trainer notes are visible only for the trainer not for learners.',
		start_after: 'You could specify a set of prerequisite conditions that have to be met for current item. Only after all the specified conditions are met, the curent item is made available to the learner. If the prerequisites are not met, this current item is shown in a locked state to the learner.',
		hide_locked: 'By enabling this, course item will be hidden in learner/report view if state of item is locked.',
		exclude_quiz: 'By default, quiz scores are incldued while computing the average score that is shown in the course level report and in the certificate. Enable this check box if you would like this quiz to be excluded from average computation (e.g. this is a pre-quiz). You will still be able to see the score of this item in detailed course reports. This attribute has no effect on self learning modules as they do not have a score.',
    	reopen_on_fail: 'You could reopen a set of learning modules if the learner failed in the quiz. To do this, you need to configure this property on the quiz module. You can list the items (refered by their unique id) which have to be reopened if the learner failed to acheive minimum pass score in the current module. This property is a JSON string representing an array of strings: each string is unque id of the item that should be re-opened.<br> Example:<br></div><pre>["_id1", "_id2"]</pre></div>',
		icon: 'Icon to be displayed for this item in the course tree. If not provided, this is derived from the type. "quiz" is a predefined icon.',
		text: _getDescriptionHelp(),
		maxAttempts: 'Number of time the learner can do this module. Only the learning data from the last attempt is considered. 0 means infinite. 1 is the default.',
		hide_remarks: 'By default the learner will be shown a text field where the learner can add remarks. This behavior can be disabled by checking this flag.',
		autocomplete: 'If this flag is checked, the link is automatically marked completed when the learner views for the first time.',
		parentId: 'Defines the unique id of the folder item under which the current module is located.',
		id: 'Defines the unique id of the current item. This is automatically generated.',
		dependencyType: 'Defines the type of dependency selected. Either to unlock if atleast one or all items mentioned in dependencies to be completed.',
		totalItems: 'Displays the number of total modules the folders currently has.',
        grp_canvasAttrs: 'Canvas mode is a visual represenation of course where laarning items are placed in the backdrop of an image. Learners will be able to navigate into the specific section in a more visual way.',
        posX: 'Define the horizontal position of this item in the canvas as a percentage number. Left end of the screen is 0 and the right end is 100.',
        posY: 'Define the vertical position of this item in the canvas as a percentage number. Top end of the screen is 0 and the bottom end is 100.',
        bgimg: 'Select the background image to be displayed in the canvas when the folder is opened.',
        bgcolor: 'The background image is resized to retain aspect ratio. This could result in horizontal or vertical bands. You can choose the color of the bands to align with the edge of the image.',
        iltduration: 'The planned duration of the instructor led session in minutes.',
        customStatus: 'For long form courses with distinct phases, a simple "pending" -> "started" -> "completed" workflow may be insufficient. In that case, custom status strings may be defined in the course and these are shown in the course report. For example a state transition like "pending" -> "class room training" -> "on the job training" -> "undergoing certification" -> "certified" may be implemented by specifying this attribute for the appropreate course items. The course report will accordingly show this as the status if the learner reached till this item.',
		canMarkAttendance: 'Set this to allow learner to mark attendance.',
		gateFormula: _getGateFormulaHelp(),
		gatePassscore: 'Provide the pass score to mark status of item for learner.',
		learningCredits: 'Provide the learning credits a user would receive upon passing this gate.',
		showInReport: 'Enable this to show the score of this gate item in the overall learning report.',
		isReattempt: 'You could control if the learning report is marked as certified in first attempt or not with this attribute. If this attribute is enabled and the learner reached upto to this item, it means that the learner did not complete the course in first attempt. This is useful to set for the re-certification items within the course.',
		hide_answers: 'Enable this attribute to disallow the learners from opening the module report after submission. This restrict learner from verifying the correct answers.'
    };
    
    function _getDescriptionHelp() {
    	return('<p>Provide a description which is shown in the content area / details popup when the element is clicked. You insert images/videos and style the content using the same markup tags supported by module editor. Markup syntax is as below:</p>' +
    		   '<ul><li>Use <b>img:</b> to add an image. (example: img:imageUrl)</li>' + 
    		   '<li>Use <b>video:</b> to add a video. (example: video:videoUrl)</li>' +
    		   '<li>Use <b>link:</b> to add an external link. (example: link:https://www.xxxxx.com[text="link name"|popup=1])</li>' +
    		   '<li>Use <b>audio:</b> to add an audio. (example: audio:audioUrl)</li>' +
    		   '<li>Use <b>H1, H2, H3, H4, H5, H6</b> attributes to mark a header line. (example: H1 Hello world!)</li>' +
    		   '<li>Use <b>- and #</b> to have bulleted list or numbered list respectively (example: - Hello world!)</li></ul>');
	}
	
	function _getGateFormulaHelp() {
		return('<p>Insert formula to compute the gate value. The formula could be resulting in number (e.g. average rating) or a ' +
				'true/false condition (e.g. average rating greater than 75). The formula contains different predefined functions and the items available above the current gate item.</p>' + 
				'<p><b>As you type <i class="nl-fixed-width fblue2">$</i>, a dropdown list will be shown with list of predefined functions.</b></p>' +
				'<p><b>As you type <i class="nl-fixed-width fblue2">_</i>, a dropdown list will be shown with list of items above the current gate item.</b></p>' +
				'<p>Syntax for writing formula is given below:</p>' +
				'<ul>' + 
				'<li><b>$max{_id1, _id2, _id3}</b> In this case gate score is considered as max score obtained among the item with given Unique ids. </li>' +
				'<li><b>$min{_id1, _id2, _id3}</b> In this case gate score is considered as min score obtained among the item with given Unique ids. </li>' +
				'<li><b>$sum{_id1, _id2, _id3}</b> In this case gate score is considered as sum of score obtained by item with given Unique ids. </li>' +
				'<li><b>$avg{_id1, _id2, _id3}</b> In this case gate score is considered as average of score obtained by item with given Unique ids. </li>' +
				'<li><b>$avg_top{2, _id1, _id2, _id3}</b> In this case gate score is considered as average of highest top two score obtained by item with given Unique ids. </li>' +
				'<li><b>$avg_top{2, _id1, _id2, _id3} + _id6 </b> In this case gate score is considered as sum of average of highest top two score obtained by item with Unique id "_id1", "_id2", "_id3" and score of item with Unique id "_id6".</li></ul>' +
				'<li><b>$nth_min{2, _id1, _id2, _id3, _id4, _id5}</b> In this case gate score is considered as second lowest value of item with given Unique ids.</li>' +
				'<li><b>$if{_id2, 20, 30} </b> if(condition, value_on_true, value_on_false) similar to excel IF() function".</li></ul>' +
				
				'<div class="padding-mid"></div>'+
				'<p>The formula can also be a condition check which will return the boolean value. Syntax for writing the condition is as follow:</p>'+
				'<ul><li><b>not ($max{_id1,_id2} <= $avg_top{2, _id3, _id4, _id5} or _id6) and ($min{_id7, _id8} + $max{_id9, _id10} < $avg{_id11, _id12, _id13, _id14})</b></li>In this case it is a complicated formula.</ul>');
	}

	function _updateHelps(attrs, attrHelp, level) {
        for(var i=0; i<attrs.length; i++) {
            var attr = attrs[i];
            attr.level = level;
            attr.help = attrHelp[attr.name] || null;
        }
    }
    _updateHelps(_courseParams, _courseParamsHelp, 'course');
    _updateHelps(moduleAttrs, _moduleAttrHelp, 'modules');
    
    var allowedModuleAttrs = (function () {
    	var ret = {};
    	for(var i=0; i<moduleAttrs.length; i++) {
    		var attr = moduleAttrs[i];
    		for(var j=0;j< attr.fields.length; j++) {
    			var itemType = attr.fields[j];
    			if (!(itemType in ret)) ret[itemType] = {};
    			if(attr.name == 'totalItems') continue;
    			ret[itemType][attr.name] = {contentType: attr.contentType || 'string', 
    			 text: attr.text || attr.name, name: attr.name};
    		}
    	}
    	return ret;
    })();
    
    var allowedCourseAttrs = (function() {
        var ret = {};
        for(var i=0; i<_courseParams.length; i++) {
            var attr = _courseParams[i];
            if (attr.type == 'hidden') continue;
            ret[attr.name] = attr;
        }
        return ret;
    })();
    
    function _updateCourseAndModuleAttrOptions(userInfo) {
        var ginfo = userInfo ? userInfo.groupinfo || {} : {};
        var grpExportLevel = ginfo.exportLevel || nlExportLevel.EL_PRIVATE;
        if (grpExportLevel == nlExportLevel.EL_PUBLIC) grpExportLevel = nlExportLevel.EL_LOGEDIN;
        var info = nlExportLevel.getExportLevelInfo(grpExportLevel);
        
        var attr = allowedCourseAttrs.exportLevel;
        if (!attr) return;
        attr.values = info.elList;
        attr.valueNames = info.elDesc;
        if (grpExportLevel == nlExportLevel.EL_PRIVATE) {
            attr.type = 'hidden';
            delete allowedCourseAttrs.exportLevel;
        }
    }

    function _addModule(e, cm) {
        if(!_validateInputs(modeHandler.course, cm)) {
            if(e) e.preventDefault();
            return;
        }
    	var courseContent = modeHandler.course.content;
    	if (!('lastId' in courseContent)) courseContent.lastId = 0;
    	courseContent.lastId++;

        var newModule = {name: nl.t('Information {}', courseContent.lastId), type: 'info', id: '_id' + courseContent.lastId};
        if (!cm.parentId) {
        	// Current item is the root element: add as child of root element and at the top
        	newModule.parentId = '_root';
        	_allModules.splice(0, 0, newModule);
        } else if (cm.type == 'module' && cm.isOpen) {
        	// Current item is a folder and is open: add as first child of folder
        	newModule.parentId = cm.id;
        	var pos = _findPos(cm);
        	if (pos > -1) _allModules.splice(pos+1, 0, newModule);
        } else {
        	// Current item is closed folder or a leaf node: add as next sibling of current node
        	newModule.parentId = cm.parentId;
        	var pos = _findLastDescendantPos(cm);
        	if (pos > -1) _allModules.splice(pos+1, 0, newModule);
        }
		$scope.editorCb.initModule(newModule);
		newModule.isOpen = false;
		newModule.visible = true;
		$scope.editorCb.showVisible(newModule);
    }

    function _findPos(cm) {
    	for(var i=0; i<_allModules.length; i++) if (_allModules[i].id == cm.id) return i;
    	return -1;
    }

    function _findLastDescendantPos(cm) {
    	var lastPos = -1;
    	for(var i=0; i<_allModules.length; i++) {
    		if (_isDescendantOf(_allModules[i], cm)) lastPos = i;
    	}
    	return lastPos;
    }

    function _isDescendantOf(cm, parent) {
		while(cm) {
    		if (cm.id == parent.id) return true;
    		cm = $scope.editorCb.getParent(cm);
		}
    	return false;
    }

    function _deleteModule(e, cm) {
		var msg = {title: 'Please confirm', 
				   template: 'All dependencies on this item will be lost once you delete. This cannot be undone once you save. Are you sure you want to continue?',
				   okText: nl.t('Delete')};
		nlDlg.popupConfirm(msg).then(function(res) {
			if(!res) return;
	    	var indicesToRemove = [];
	        for(var i=0; i < _allModules.length; i++){
	        	if (_isDescendantOf(_allModules[i], cm)) indicesToRemove.push(i);
	        }
	        _removeElements(indicesToRemove);
            $scope.editorCb.updateChildrenLinks(_allModules);
			$scope.editorCb.showVisible(null);
		});
    }

	function _removeElements(indicesToRemove) {
        for (var j = indicesToRemove.length -1; j >= 0; j--){
		    _allModules.splice(indicesToRemove[j],1);
		}
	}
	
	function _saveCourse(e, bPublish, cm){
		cm = $scope.editorCb.getRootItem() || cm;
		if(!_validateInputs(modeHandler.course, cm, true, bPublish)) return;
		if (!bPublish) {
			_saveAfterValidateCourse(e, bPublish);
			return;
		}
		var features = _groupInfo.props.features || {};
		var checkList = features.courses ? features.courses.coursePublishChecklist : false;
		if (checkList) {
			var _checklistDlg = nlDlg.create($scope);
			_checklistDlg.scope.dlgTitle = nl.t('Publish course');
			_checklistDlg.scope.data = {checklist: getCheckList(checkList)};
			var okButton = {text: nl.t('Publish'), onTap: function(){
				var selectedChecklist = [];
				for (var i=0; i<_checklistDlg.scope.data.checklist.length; i++) {
					var item = _checklistDlg.scope.data.checklist[i];
					if(item.selected) selectedChecklist.push(item.name);
				}
				modeHandler.course.content.checklist = selectedChecklist;
				_saveAfterValidateCourse(e, bPublish);
			}};
			var closeButton = {text: nl.t('Cancel')};
			_checklistDlg.show('view_controllers/course/editor/course_check_list.html', [okButton], closeButton, false);
		} else {
			var templateMsg = nl.t('Are you sure you want to publish this course?');
			var msg = {title: 'Please confirm', 
					   template: templateMsg,
					   okText: nl.t('Publish')};
			nlDlg.popupConfirm(msg).then(function(res) {
				if(!res) return;
				_saveAfterValidateCourse(e, bPublish);
			});	
		}
	}

	function getCheckList(groupCheckList) {
		var publishedChecklist = modeHandler.course.content.checklist || [];
		var ret = [];
		for(var i=0; i<groupCheckList.length; i++) {
			var item = groupCheckList[i];
			var itemFound = false;
			for (var j=0; j<publishedChecklist.length; j++) {
				if (publishedChecklist[j] == item) {
					itemFound = true;
					break;
				}
			}
			if (itemFound)
				ret.push({selected: true, name: item});
			else
				ret.push({selected: false, name: item});
		}
		return ret;
	};

    function _saveAfterValidateCourse(e, bPublish) {
        modeHandler.course.content.modules = [];
		modeHandler.course.content.blended = false;

		var cmidToCm = {};
		var milestoneAdded = false;
		var ratingAdded = false;
		for(var i=0; i<_allModules.length; i++){
    	    var newModule = _getSavableModuleAttrs(_allModules[i]);
			_pruneStartAfter(newModule, cmidToCm);
			if (newModule.type == 'milestone') milestoneAdded = true;
			if (newModule.type == 'rating') ratingAdded = true;
			if (newModule.type == 'iltsession' && !modeHandler.course.content.blended) modeHandler.course.content.blended = true;
			if (newModule.type == 'lesson-assesment') newModule.isQuiz = true;
			if (newModule.type == 'lesson-self') newModule.isQuiz = false;
		    modeHandler.course.content.modules.push(newModule);
		}

		// After everything is over, change the the type to lesson
		for(var i=0; i<modeHandler.course.content.modules.length; i++){
    	    var m = modeHandler.course.content.modules[i];
			if (m.type == 'lesson-assesment' || m.type == 'lesson-self') m.type = 'lesson';
		}

		if (bPublish && _etm) {
			var msg = null;
			if (modeHandler.course.content.nht) {
				if(!milestoneAdded)
					msg = nl.t('This is an "NHT" Course. Please add milestone item before publishing.');
			} else {
				if (ratingAdded) 
					msg = nl.t('Course have rating items. Please enable "NHT" flag before publishing');
				else if (milestoneAdded) 
					msg = nl.t('Course have milestone items. Please enable "NHT" flag before publishing');
			}
			if(msg) {
				nlDlg.popupAlert({title: nl.t('Can not publish course'), template: msg})
				return;
			}
		}

		var oldLangInfo = _pruneLanguageInfo(cmidToCm);
		var contentJson = _objToJson(modeHandler.course.content);
		if (oldLangInfo) modeHandler.course.content.languageInfo = oldLangInfo;
        var modifiedData = {
			name: modeHandler.course.name, 
			icon: modeHandler.course.icon, 
			description: modeHandler.course.description,
			content: contentJson 
		};
        if(modeHandler.course.id) modifiedData.courseid = modeHandler.course.id;
        modifiedData.publish = bPublish;
        _modifyAndUpdateToServer(modifiedData);    
    }
    
	function _objToJson(obj) {
		if (!obj) return '';
		return angular.toJson(obj, 2);
	}
	
	function _jsonToObj(json, status) {
	    status.error = null;
		if (!json) return undefined;
		var ret = undefined;
		try {
		    ret = angular.fromJson(json);
		} catch(e) {
		    status.error = e;
		    return undefined;
		}
		return ret;
	}

	function _initEditorTempJson(cm) {
		$scope.editor.jsonTempStore = {};
    	if (!cm || cm.id == '_root') {
            _updateCourseAttrsInJsonTempStore(modeHandler.course.content);
	        return;
    	}
    	var allowedAttributes = allowedModuleAttrs[cm.type] || {};
    	var attrs = Object.keys(cm);
    	for(var i=0; i<attrs.length; i++) {
    		var attr = attrs[i];
    		var allowedAttr = allowedAttributes[attr];
            if (allowedAttr && allowedAttr.contentType != 'object') continue;
	    	$scope.editor.jsonTempStore[attr] = _objToJson(cm[attr]);
	    }
    }
    
    function _updateCourseAttrsInJsonTempStore(content) {
        for(var key in content) {
            if (!(key in allowedCourseAttrs)) continue;
            var attr =  allowedCourseAttrs[key];
            if (attr.type != 'object') continue;
            $scope.editor.jsonTempStore[key] = _objToJson(content[key]);
        }
    }
    
    function _updateObjectFromEditor(cm, errorLocation) {
        var allowedAttributes = allowedModuleAttrs[cm.type] || {};
    	var attrs = Object.keys(allowedAttributes);
    	for(var i=0; i<attrs.length; i++) {
    		var attr = attrs[i];
    		if (!(attr in allowedAttributes)) continue;
    		var allowedAttr = allowedAttributes[attr];
            if (allowedAttr.contentType == 'integer') {
                try {
                    cm[attr] = parseInt(cm[attr]);
                } catch (e) {
                    errorLocation.title = allowedAttr.text;
                    errorLocation.template = nl.t('Please enter a valid value for {}', allowedAttr.text);
                    return false;
                }
            } else if (allowedAttr.contentType == 'object') {
                var status = {};
            	cm[attr] = _jsonToObj($scope.editor.jsonTempStore[attr], status);
            	if (status.error !== null) {
                    errorLocation.title = allowedAttr.text;
                    errorLocation.template = nl.t('Please enter a valid JSON string for {}', allowedAttr.text);
            	    return false;
            	}
            }
    	}
    	return true;
    }
	
    function _getSavableModuleAttrs(cm) {
        var allowedAttributes = allowedModuleAttrs[cm.type] || {};
    	var attrs = Object.keys(allowedAttributes);
        var editedModule = {};
        for(var i=0; i<attrs.length; i++){
            var attr = attrs[i];
            if (!(attr in allowedAttributes)) continue;
            if(cm[attr] === null || cm[attr] === undefined || cm[attr] === '') continue;
            editedModule[attr] = cm[attr];
        }
		if(cm.type == 'certificate') {
            editedModule['action']= 'none'; 
            editedModule['hide_remarks']= true;
            editedModule['autocomplete']= true; 

            // Not /#/course_cert as same URL (/) will not be loaded 
            // in iframe by some browser
            editedModule['urlParams']= '/default/home/#/course_cert';
	    }
        return editedModule;
    }
	
    function _searchLesson(e, cm){
    	nlLessonSelect.showSelectDlg($scope, _userInfo).then(function(selectionList) {
    		if (selectionList.length != 1) return;
    		cm.refid = selectionList[0].lessonId;
    		cm.maxDuration = selectionList[0].esttime;
    		cm.name = selectionList[0].title;
    	});
    };

	function _organiseModulesDlg(e, cm){
		if(!_validateInputs(modeHandler.course, cm)) return;
		_organiseModules(e, cm);
	};

    function _validateInputs(data, cm, onSave, bPublish) {
		if(!onSave && $scope.editor.targetLang != 'en') return true;
        var errorLocation = {};
        var retData = {lessPara: true};
    	cm.textHtml = cm.text ? nlMarkup.getHtml(cm.text, retData): '';
		var ret = _validateInputsImpl(data, cm, errorLocation);
		if(bPublish) ret = ret && _validateLanguageInfoImpl(errorLocation);
		if(!errorLocation.cm) errorLocation.cm = $scope.editorCb.getRootItem();
        if (!ret) {
			$scope.ext.setCurrentItem(errorLocation.cm);
			nlDlg.popupAlert({title: nl.t('Error: {}', errorLocation.title), template:errorLocation.template});
        }
        return ret;
    }
	
	function _validateLanguageInfoImpl(errorLocation) {
		var languageInfo = modeHandler.course.content.languageInfo;
		if (!languageInfo) return true;
		for(var lang in languageInfo) {
			var langInfo = languageInfo[lang];
			for(var key in langInfo) {
				if(key == 'name' || key == 'description') continue;
				if (langInfo[key].type != 'lesson-assesment' && langInfo[key].type != 'lesson-self') continue;
				if (langInfo[key].refid) continue;
				var moduleName = _getLanguageName(lang);
				return _validateFail(errorLocation, 'languageInfo', nl.t('Module id is mandatory for {} for language {}', langInfo[key].name, moduleName));
			}
		}
		return true;
	}

	function _pruneLanguageInfo(cmidToCm) {
		var unprunedLangInfo = modeHandler.course.content.languageInfo;
		if (!unprunedLangInfo) return unprunedLangInfo;
		var prunedLangInfo = angular.copy(unprunedLangInfo);
		modeHandler.course.content.languageInfo = prunedLangInfo;

		for(var lang in unprunedLangInfo) {
			var langInfo = unprunedLangInfo[lang];
			for(var key in langInfo) {
				if(key == 'name' || key == 'description') {
					if(modeHandler.course[key] == langInfo[key]) delete prunedLangInfo[lang][key];
					continue;
				}
				var cm = cmidToCm[key];
				if (!cm) {
					delete prunedLangInfo[lang][key];
					continue;
				}
				var item = langInfo[key];
				if (!item.refid && (!cm.name || cm.name == item.name)) {
					delete prunedLangInfo[lang][key];
					continue;
				}

				prunedLangInfo[lang][key] = {};
				var prunedItem = prunedLangInfo[lang][key];
				if (item.refid) prunedItem.refid = item.refid;
				if(item.name && cm.name != item.name) prunedItem.name = item.name;
			}
		}
		return unprunedLangInfo;
	}

	function _getLanguageName(lang) {
		for(var i=0; i<modeHandler.course.content.languages.length; i++) {
			var language = modeHandler.course.content.languages[i];
			if (language.lang == lang) return language.name;
		}
	}

    function _validateInputsImpl(data, cm, errorLocation) {
        if(!data.content) return _validateFail(errorLocation, 'Content', 'Course content is mandatory');
    	if (!data.content.modules) return _validateFail(errorLocation, 'Content', '"modules" field is expected in content');

    	if (cm && cm.id != '_root') {
            if (!_updateObjectFromEditor(cm, errorLocation)) return false;
    	} else if (!_updateCourseAttrsFromJsonTempStore(data.content, errorLocation)) {
            return false;
    	}

    	if (cm && cm.id != '_root') return _validateModule(data, cm, errorLocation);

        if(!data.name) return _validateFail(errorLocation, 'Name', 'Course name is mandatory');
        if(!data.icon) return _validateFail(errorLocation, 'Icon', 'Course icon URL is mandatory');
        if(!_validateContent(data, errorLocation)) return false;            
        return true;
    }

    function _updateCourseAttrsFromJsonTempStore(content, errorLocation) {
        for(var key in allowedCourseAttrs) {
            if (!((key in content) || (key in $scope.editor.jsonTempStore))) continue;
            var attr =  allowedCourseAttrs[key];
            if (attr.type != 'object') continue;
			if (attr.name == 'contentmetadata') continue;

            var status = {};
            content[key] = _jsonToObj($scope.editor.jsonTempStore[key], status);
            if (status.error !== null) {
                errorLocation.title = attr.text||attr.name;
                errorLocation.template = nl.t('Please enter a valid JSON string for {}', 
                    errorLocation.title);
                return false;
            }
        }
        return true;
    }
    
    function _validateContent(data, errorLocation) {
    	var modules = _allModules; //data.content.modules was used, but it is not updated on deleting the item causes error in milestone computation
        if (modules.length < 1) return _validateFail(errorLocation, 'Error', 
            'Atleast one course module object is expected in the content');
        for(var i=0; i<modules.length; i++){
            var module = modules[i];
            if (!_validateModule(data, module, errorLocation)) return false;
        }
        return true;
    }

    function _validateModule(data, module, errorLocation) {
        if (!module.id) return _validateFail(errorLocation, 'Unique-id', 'Unique-id is mandatory', module);
        if (!module.name) return _validateFail(errorLocation, 'Name', 'Name is mandatory', module);
        if (!module.type) return _validateFail(errorLocation, 'Element type', 'Element type is mandatory', module);

        if (!_validateModuleType(errorLocation, module)) return false;
        if (!_validateModuleDate(errorLocation, module, 'planned_date')) return false;
        if (!_validateModuleDate(errorLocation, module, 'start_date')) return false;
        if (!_validateLessonModule(errorLocation, module)) return false;
        if (!_validateLinkModule(errorLocation, module)) return false;
        if (!_validateInfoModule(errorLocation, module)) return false;
		if (!_validateILTSessionModule(errorLocation, module)) return false;
		if (!_validateMilestoneModule(errorLocation, module)) return false;
		if (!_validateRatingModule(errorLocation, module)) return false;
		if (!_validateGateModule(errorLocation, module)) return false;
		return true;
    }
    
    function _validateModuleType(errorLocation, module) {
    	if(module.type in allowedModuleAttrs) return true;
    	var msg = 'Element type is not valid';
        return _validateFail(errorLocation, 'Element type', msg, module);
    }

    function _validateModuleDate(errorLocation, module, attr) {
    	if (!module[attr]) return true;
    	var d = nl.fmt.json2Date(module[attr]);
        if (!isNaN(d.valueOf())) return true;
    	return _validateFail(errorLocation, attr, nl.t('Incorrect {}', attr), module);
    }
    
    function _validateLessonModule(errorLocation, module) {
    	if(module.type != 'lesson-assesment' && module.type != 'lesson-self') return true;
        if(!module.refid) return _validateFail(errorLocation, 'Module-id', 'Module-id is mandatory', module);
        if(!angular.isNumber(module.refid)) return _validateFail(errorLocation, 'Module-id', 'Module-id seems incorrect', module);
        return true;
    }

    function _validateLinkModule(errorLocation, module) {
    	if(module.type != 'link') return true;
        if(!module.action) return _validateFail(errorLocation, 'Action', 'Action is mandatory', module);
        if(!module.urlParams) return _validateFail(errorLocation, 'Url-Params', 'Url-Params is mandatory', module);
        return true;
    }
    
    function _validateInfoModule(errorLocation, module) {
    	if(module.type != 'info') return true;
        return true;
    }
    
    function _validateILTSessionModule(errorLocation, module) {
    	if(module.type != 'iltsession') return true;
        if(!module.iltduration) return _validateFail(errorLocation, 'Session duration', 'Session duration is mandatory', module);
    	return true;
    }
    
    function _validateMilestoneModule(errorLocation, module) {
		if(module.type != 'milestone') return true;
		if(!module.milestone_type) return _validateFail(errorLocation, 'Milestone type', 'Milestone type is mandatory.', module);

		var moduleMilestoneIndex = module.milestone_type in _milestoneDict ? _milestoneDict[module.milestone_type].index : -1;
		if (moduleMilestoneIndex < 0) {
			return _validateFail(errorLocation, 'Milestone type', '"Milestone type" not defined.', module);
		}
		for(var i=0; i < _userInfo.groupinfo.milestones.length; i++) {
			if (module.milestone_type === _userInfo.groupinfo.milestones[i].id) {
				for(var j=0; j<_allModules.length; j++) {
					var item = _allModules[j];
					if(!item.milestone_type || item.type !== 'milestone') continue;
					if(module.id == item.id) break;
					var itemMilestoneIndex = _milestoneDict[item.milestone_type].index;
					if (itemMilestoneIndex < moduleMilestoneIndex) continue;
					return _validateFail(errorLocation, 'Milestone type', '"Milestone type" for this item should come after "Milestone Type" of earlier items.', module);
				}
				break;
			}
		}
    	return true;
    }
	
    function _validateRatingModule(errorLocation, module) {
    	if(module.type != 'rating') return true;
		if(!module.rating_type) return _validateFail(errorLocation, 'Rating type', 'Rating type is mandatory.', module);
    	return true;
	}

	function _validateGateModule(errorLocation, module) {
		if(module.type != 'gate') return true;
		if(!module.gateFormula) return _validateFail(errorLocation, 'Formula', 'Gate condition is mandatory.', module);
		var payload = {strExpression: module.gateFormula, dictAvps: _getAvpsForGate(module)};
		nlExpressionProcessor.process(payload);
		//payload.result will the value;
		if(payload.error) return _validateFail(errorLocation, 'Formula', payload.error, module);
		if(!module.gatePassscore) return _validateFail(errorLocation, 'Formula', 'Gate pass score is mandatory.', module);
    	return true;
	}

	function _getAvpsForGate(cm) {
        var ret = {};
        var modules = _allModules || [];
        for(var i=0; i<modules.length; i++) {
			var item = modules[i];
			if(item.type == 'module') continue;
            if(item.id == cm.id) break;
			ret[item.id] = null;
		}
        return ret;
	}

    function _validateFail(errorLocation, attr, errMsg, cm) {
        errorLocation.title = attr;
		errorLocation.cm = cm;
		errorLocation.template = nl.fmt2('<p><b>Error:</b> {}</p>', errMsg);
        if(cm) {
            errorLocation.template += nl.fmt2('<p><b>Item:</b> {}</p>', cm.name);
        }
    	return false;
    }

	function _getLaunchUrl(id) {
    	return nl.fmt2('/lesson/view/{}', id);
	}
	
    function _onLaunch($event, cm){
    	if(!_validateInputs(modeHandler.course, cm)) {
    		return;
    	} else {
			if (cm.type == 'lesson-assesment' || cm.type == 'lesson-self') {
				var tempCm = angular.copy(cm);
				tempCm.type = 'lesson';
				$scope.editorCb.launchModule($event, tempCm);
			}
    	}
    }
    
    function _organiseModules(e, cm){
    	var _organiseModuleDlg = nlDlg.create($scope);
		_organiseModuleDlg.setCssClass('nl-height-max nl-width-max');
		_organiseModuleDlg.scope.data = {};
		_organiseModuleDlg.scope.data.title = nl.t('Reorder the modules');
		_organiseModuleDlg.scope.data.modules = _allModules;
		_organiseModuleDlg.scope.moveItem = function(item, fromIndex, toIndex){
			_moveItem(item, fromIndex, toIndex);
		};
		var closeButton = {text : nl.t('Close'), onTap: function(e){
            $scope.editorCb.updateChildrenLinks(_allModules);
			$scope.editorCb.showVisible(null);
		}};
		_organiseModuleDlg.show('view_controllers/course/editor/course_organiser.html', [], closeButton, false);
	}
    
	function _moveItem(movedItem, fromIndex, toIndex) {
		$scope.editorCb.moveItem(movedItem, fromIndex, toIndex, _allModules);
		$scope.editorCb.showVisible(null);
	};
    
    function _modifyAndUpdateToServer(modifiedData){
        nlDlg.showLoadingScreen();
		var popupMsg = modifiedData.publish ? 'Published' : 'Saved';
		var icon = modifiedData.publish ? 'ion-checkmark-circled' : '';
        nlServerApi.courseModify(modifiedData).then(function(course) {
			nlDlg.hideLoadingScreen();
			nlDlg.popupStatus2({popdownTime: 2000, showClose: false, icon: icon,
			msg: popupMsg});

        });
    }
}];

//-------------------------------------------------------------------------------------------------
function TrainerNotesDlg(nl, nlDlg, $scope, _allModules, cm, nlLessonSelect, _userInfo) {
	var dlg = nlDlg.create($scope);

	this.show = function() {
		dlg.setCssClass('nl-height-max nl-width-max');
		dlg.scope.dlgTitle = nl.t('Configure trainer notes');
		dlg.scope.trainerNotesList = _getTrainerNotesListFromCm();
	    dlg.scope.searchLesson = function(e, $index){
	    	nlLessonSelect.showSelectDlg($scope, _userInfo).then(function(selectionList) {
	    		if (selectionList.length != 1) return;
	    		var ret = {id: selectionList[0].lessonId, name: selectionList[0].title};
	    		dlg.scope.trainerNotesList.splice($index, 1, ret);
	    	});
	    };
		var okButton = {text: nl.t('Ok'), onTap: function(e) {
			_onOk(e);
		}};
		var closeButton = {text: nl.t('Cancel')};
		dlg.show('view_controllers/course/editor/course_trainer_notes_configure.html', [okButton], closeButton);

	};

	function _getTrainerNotesListFromCm() {
		var ret = [];
		var items = cm.trainer_notes || [];
		for(var i=0; i<items.length; i++) {
			var item = items[i];
			ret.push({id: item.id, name:item.name, error: ''});
		}
		if(ret.length == 0) ret.push({});
		return ret;
	}

	function _onOk(e) {
		var modulesFromGui = dlg.scope.trainerNotesList;
		var modulesToStore = [];
		var foundModuleIds = {};
		_errorFound = false;
		for(var i=0; i<modulesFromGui.length; i++) {
			var item = modulesFromGui[i];
			if(item.id === undefined) continue;
			if(item.id in foundModuleIds) {
				_validateFail(item, 'This trainer note is already added.');
				continue;
			}
			foundModuleIds[item.id] = true;
			var moduleToStore = {id: item.id, name: item.name};
			_validateSuccess(item);
			modulesToStore.push(moduleToStore);
		}
		
		if (_errorFound) {
	        if(e) e.preventDefault();
	        return;
		}
		
		cm.trainer_notes = modulesToStore;
		if (modulesToStore.length == 0) delete cm.trainer_notes;
		$scope.editorCb.showVisible(cm);
	}

	function _validateSuccess(item) {
		item.error = null;
		return true;
	}

	var _errorFound = false;
	function _validateFail(item, msg) {
		item.error = msg;
		_errorFound = true;
	}
}

//-------------------------------------------------------------------------------------------------
function StartAfterDlg(nl, nlDlg, $scope, _allModules, cm) {

	var dlg = nlDlg.create($scope);
	var idsToTypeMapping = {};
	this.show = function() {
		dlg.setCssClass('nl-height-max nl-width-max');
		dlg.scope.dlgTitle = nl.t('Configure dependencies');
		dlg.scope.showMaxScore = true;
		dlg.scope.data = {};
		dlg.scope.moduleOptions = _getAvailableModules();
		dlg.scope.dependencyOptions = [{id: 'all', name: nl.t('Start after all the below conditions are satisfied')}, {id: 'atleastone', name: 'Start after at least one of the below conditions are satisfied'}];
		dlg.scope.data['dependency'] = cm.dependencyType == 'atleastone' ? dlg.scope.dependencyOptions[1] : dlg.scope.dependencyOptions[0];
		if(dlg.scope.moduleOptions.length == 0) {
			var msg = {title: nl.t('Error'), template: nl.t('It is not possible to configure start after for the first item.')};
			nlDlg.popupAlert(msg);
			return;
		}

		dlg.scope.moduleList = _getModuleListFromCm();

		dlg.scope.onModuleSelect = function(item) {
			item.canShowSelectBox = false;
			item.canShowMinScore = false;
			item.canShowMaxScore = false;
			if(!(item && item.module)) return;
			if(item.module.type == "lesson-assesment" || item.module.type == "rating" || item.module.type == "gate") {
				item.canShowMinScore = true;
				item.canShowMaxScore = true;
			}
			if(item.module.type == "iltsession") {
				item.canShowSelectBox = true;
				item.options = _getIltConditions();
				item.selectedOption = item.options[0];
			}
		};
		var okButton = {text: nl.t('Ok'), onTap: function(e) {
			_onOk(e);
		}};
		var closeButton = {text: nl.t('Cancel')};
		dlg.show('view_controllers/course/editor/course_start_after_configure.html', [okButton], closeButton);
	};

	function _getModuleListFromCm() {
		var ret = [];
		var items = cm.start_after || [];
		for(var i=0; i<items.length; i++) {
			var item = items[i];
			if(!(item.module in idsToTypeMapping)) continue;
			var dict = {module: {id: item.module, type: idsToTypeMapping[item.module].type, rating_type: idsToTypeMapping[item.module].rating_type}, min_score: item.min_score || '', 
						max_score: item.max_score || '', error: ''};
			if(idsToTypeMapping[item.module].type == 'lesson-assesment' || idsToTypeMapping[item.module].type == 'lesson-self' || idsToTypeMapping[item.module].type == 'rating' || idsToTypeMapping[item.module].type == 'gate'){
				dict.canShowMaxScore = true;
				dict.canShowMinScore = true;
			}
			if(item.iltCondition) {
				dict.canShowSelectBox = true;
				dict.options = _getIltConditions();
				dict['selectedOption'] = {id: item.iltCondition};
			} else if(idsToTypeMapping[item.module].type == 'iltsession'){
				dict.canShowSelectBox = true;
				dict.options = _getIltConditions();
				dict['iltCondition'] = {id: 'marked'};
			}
			ret.push(dict);
		}
		if(ret.length == 0) ret.push({});
		return ret;
	}

	function _onOk(e) {
		var modulesFromGui = dlg.scope.moduleList;
		var modulesToStore = [];
		var foundModuleIds = {};
		_errorFound = false;
		for(var i=0; i<modulesFromGui.length; i++) {
			var item = modulesFromGui[i];
			if(item.module === undefined) continue;
			if(item.module.id in foundModuleIds) {
				_validateFail(item, 'Dependency to this item is already set above');
				continue;
			}
			foundModuleIds[item.module.id] = true;
			var moduleToStore = {module: item.module.id};
			if (item.min_score) moduleToStore.min_score = parseInt(item.min_score);
			if (item.max_score) moduleToStore.max_score = parseInt(item.max_score);
			if (moduleToStore.min_score < 0 || moduleToStore.min_score > 100) {
				_validateFail(item, 'Minimum score % has to be between 0 and 100');
				continue;
			}
			if (moduleToStore.max_score < 0 || moduleToStore.max_score > 100) {
				_validateFail(item, 'Maximum score % has to be between 0 and 100');
				continue;
			}
			if (moduleToStore.max_score < moduleToStore.min_score) {
				_validateFail(item, 'Maximum score cannot be smaller than minimmum score');
				continue;
			}
			if(item.module.type == 'iltsession') moduleToStore['iltCondition'] = item.selectedOption.id;
			_validateSuccess(item);
			modulesToStore.push(moduleToStore);
		}
		if (_errorFound) {
	        if(e) e.preventDefault();
	        return;
		}
		cm.start_after = modulesToStore;
		cm.dependencyType = dlg.scope.data.dependency['id'];
		if (modulesToStore.length == 0) delete cm.start_after;
		$scope.editorCb.showVisible(cm);
	}
	
	var _errorFound = false;
	function _validateFail(item, msg) {
		item.error = msg;
		_errorFound = true;
	}

	function _validateSuccess(item) {
		item.error = null;
		return true;
	}
	
	function _getAvailableModules() {
		var availableIdsArray = [];
			idsToTypeMapping = {};
		for(var i=0; i<_allModules.length; i++) {
			var item = _allModules[i];
			if(item.id == cm.id) break;
			if(item.type == 'module') continue;
			idsToTypeMapping[item.id] = {type: item.type, rating_type: item.rating_type || null};
			var dict = {id: item.id, name:item.name, type: item.type, rating_type: item.rating_type};
			availableIdsArray.push(dict);
		}
		return availableIdsArray;
	}

	function _getIltConditions() {
		return [{id: 'attended', name: nl.t('Learner attended the session')},
				{id: 'not_attended', name: nl.t('Learner did not attend the session')},
				{id: 'marked', name: nl.t('Learner attended the session or not')}]
	}
}
	
//-------------------------------------------------------------------------------------------------
module_init();
})();
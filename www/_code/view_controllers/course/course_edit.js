(function() {

//-------------------------------------------------------------------------------------------------
// course_edit.js:
// course_edit module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.course_edit', [])
    .service('nlCourseEditor', NlCourseEditorSrv)
    .directive('nlCourseEditor', CourseEditDirective('course_editor'))
    .directive('nlCourseEditorFields', EditorFieldsDirective);
}

//-------------------------------------------------------------------------------------------------
var EditorFieldsDirective = ['nl', function(nl) {
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/course/course_editor_fields.html',
        scope: {
            attrs: '=',
            help: '=',
            values: '=',
            editor: '='
        }
    };
}];
//-------------------------------------------------------------------------------------------------
var NlCourseEditorSrv = ['nl', 'nlDlg', 'nlCourse', 'nlLessonSelect', 'nlExportLevel',
function(nl, nlDlg, nlCourse, nlLessonSelect, nlExportLevel) {

    var modeHandler = null;
    var $scope = null;
    var _allModules = [];
    var _debug = null;
	var _userInfo = null;
	
    this.init = function(_scope, _modeHandler, userInfo) {
        $scope = _scope;
        modeHandler = _modeHandler;
        _userInfo = userInfo;
		var params = nl.location.search();
        if ('debug' in params) _debug = true;
        _updateCourseAndModuleAttrOptions(userInfo);

        $scope.editor = {
        	jsonTempStore: {},
        	course_params: _courseParams,
        	course_paramsHelp: _courseParamsHelp,
            course_attributes: _getCourseAttributes(modeHandler.course),
            course_attrsHelp: _courseAttrHelp,
            module_attributes: moduleAttrs,
            module_attrHelp: moduleAttrHelp,
            course: modeHandler.course,
            debug: _debug,
            showHelp: false,
            showGroup: {},
            onLaunch: _onLaunch,
            addModule: _addModule,
            deleteModule: _deleteModule,
            searchLesson: _searchLesson,
            organiseModules: _organiseModulesDlg,
            saveCourse: _saveCourse,
            updateTitle: _updateTitle,
            onSelectChange: _onSelectChange,
            validateTextField: _validateTextField,
        };
    };

    this.getAllModules = function(bClear) {
    	if (bClear) _allModules = [];
    	return _allModules;
    };
    
	this.initSelectedItem = function(cm) {
		return _initEditorTempJson(cm);
	};

	this.validateInputs = function(cm) {
		return _validateInputs(modeHandler.course, cm);		
	};
	
	function _updateTitle(e){
		var title = modeHandler.course.name;
		if(title.length === 30) {
			var msg = {title: nl.t('Name is too long'), template: nl.t('Name of the course must be less than 30 character.')};
			nlDlg.popupAlert(msg).then(function(res){
				if(res) return;
			});
		}
        nl.pginfo.pageTitle = modeHandler.course.name;	
	}

    function _onSelectChange(e, cm, attr) {
        if (!cm || cm.id == '_root') return;
        if (attr.name == 'type') _onElementTypeChange(e, cm);
    }
    
	function _onElementTypeChange(e, cm){
        var childrenElem = [];
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
		        _romoveElements(indicesToRemove);
				$scope.editorCb.showVisible(cm);
				$scope.editorCb.updateChildrenLinks();				 
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
	
    function _getCourseAttributes(course) {
        var ret = angular.copy(courseAttrs);
        var knownAttributes = {};
        for (var i=0; i<ret.length; i++) {
        	knownAttributes[ret[i].name] = true;
        }
        
        for (var k in course.content) {
            if (k in knownAttributes) continue;
            ret.push({name: k, text: 'custom: ' + k, type: 'readonlyobj', debug: true, group: 'grp_additionalAttrs'});
        }
        return ret;
    }

    var courseAttrs = [
        {name: 'grp_additionalAttrs', type: 'group', text: 'Show advanced attributes'},
    	{name: 'planning', text:'Schedule planning', desc: 'Enable schedule planning for this course', group: 'grp_additionalAttrs', type: 'boolean'},
    	{name: 'certificate', text: 'Certificate configuration', type: 'object', group: 'grp_additionalAttrs'},
    	{name: 'custtype', text: 'Custom type', type: 'number', group: 'grp_additionalAttrs'},
        {name: 'exportLevel', text: 'Visibility', type: 'list', values: [], valueNames: {}, group: 'grp_additionalAttrs'},
        {name: 'contentmetadata', text: 'Metadata', type: 'object', group: 'grp_additionalAttrs', debug: true},
    	{name: 'lastId', text: 'Last Id', type: 'readonly', group: 'grp_additionalAttrs', debug: true},
        {name: 'modules', text: 'Modules', type: 'hidden', group: 'grp_additionalAttrs', debug: true}
    ];
    
    var _courseAttrHelp = {
    	grp_additionalAttrs: {name: 'Advanced attributes', desc: 'You will be able to enable planning dates, configure certificates and other less used parameters under advanced attributes.'},
    	planning: {desc: 'Start and end dates are considered only if schedule planning is enabled.'},
    	certificate: {desc: 'JSON string of below form: <pre>{"bg": "certificate_background_image_url"}</pre>'},
    	custtype: {desc: 'You can define a custom type to help in searchability.'},
        contentmetadata: {desc: 'Debug the metadata attributes.'},
    	lastId: {desc: 'Internally used.'},
    	modules: {desc: 'Debug the overall module list.'}
    };
    
    var _courseParams = [
    	{name: 'name', text: 'Name', type: 'string', title: true},
    	{name: 'icon', text: 'Image', type: 'icon', icon: true},
    	{name: 'description', text: 'Course description', type: 'text', maxlen: 100}
    ];
    
    var _courseParamsHelp = {
    		name: {desc: 'Mandatory - enter a name for your course. It is recommended to keep the course name under 30 characters.'},
    		icon: {desc: 'Mandatory - enter a URL for the course icon that will be displayed when this course is searched.'},
    		description: {desc: 'Provide a short description which will help others in the group to understand the purpose of this course. It is recommended to keep the course description under 100 characters.'}
    };
    
    var moduleAttrs = [
        {name: 'name', fields: ['module', 'lesson', 'link', 'info'], type: 'string', text: 'Name'}, 
        {name: 'type', fields: ['module', 'lesson', 'link', 'info'], type: 'list', text: 'Element type', values: ['module', 'lesson', 'info', 'link'],
            valueNames: {'module': 'Folder', 'lesson': 'Module', 'link': 'Link', 'info': 'Information'}},
        {name: 'refid', fields: ['lesson'], type: 'lessonlink', contentType: 'integer', text: 'Module-id'},
        {name: 'action', fields: ['link'], type: 'lessonlink', text: 'Action'},
        {name: 'urlParams', fields: ['link'], type: 'string', text: 'Url-Params'},
        {name: 'grp_depAttrs', fields: ['lesson', 'link', 'info'], type: 'group', text: 'Planning and dependencies'},
        {name: 'start_date', fields: ['lesson', 'link', 'info'], type: 'date', text: 'Start date', group: 'grp_depAttrs'},
        {name: 'planned_date', fields: ['lesson', 'link', 'info'], type: 'date', text: 'Planned date', group: 'grp_depAttrs'},
        {name: 'grp_additionalAttrs', fields: ['module', 'lesson', 'link', 'info'], type: 'group', text: 'Show advanced attributes'},
        {name: 'start_after', fields: ['lesson', 'link', 'info'], type: 'object', contentType: 'object', text: 'Start after', group: 'grp_additionalAttrs'},
        {name: 'reopen_on_fail', fields: ['lesson'], type: 'object', text: 'Reopen on fail', contentType: 'object',group: 'grp_additionalAttrs'},
        {name: 'icon', fields: ['module', 'lesson', 'link', 'info'], type: 'string', text: 'Module icon', group: 'grp_additionalAttrs'},
        {name: 'text', fields: ['module', 'lesson', 'link', 'info'], type: 'text', text: 'Description', group: 'grp_additionalAttrs'},
        {name: 'maxAttempts', fields: ['lesson'], type: 'number', text: 'Maximum attempts', group: 'grp_additionalAttrs'},
        {name: 'hide_remarks', fields: ['info', 'link'], type: 'boolean', text: 'Disable remarks', group: 'grp_additionalAttrs'},
        {name: 'autocomplete', fields: ['link'], type: 'boolean', text: 'Auto complete',  desc: 'Mark as completed when viewed the first time', group: 'grp_additionalAttrs'},
        {name: 'parentId', fields: ['module', 'lesson', 'link', 'info'], type: 'readonly', debug: true, text: 'Parent ID', group: 'grp_additionalAttrs', readonly: true}, 
        {name: 'id', fields: ['module', 'lesson', 'link', 'info'], type: 'readonly', text: 'Unique ID', group: 'grp_additionalAttrs', readonly: true}, 
    	{name: 'totalItems', fields : ['module'], type: 'readonly', text: 'Total items', group: 'grp_additionalAttrs'}
    ];
    
    var moduleAttrHelp = {
    	name: {desc: 'Name of the item to be displayed in the course tree.'},
    	type: {desc: 'Each item could be a Folder (containing other items) or a Module (a learning module/quiz) or Information or a Link (internal URL like certificate or external URL to be launched from the course).'},
    	refid: {desc: 'The id of the learning module/quiz to be launched. You could search for all approved modules by clicking on the search icon. Click on the link icon to preview the module.'},
    	action: {desc: 'The action whose URL is used for the link. Click on the icon to view the link'},
    	urlParams: {desc: 'The urlParams to append to the URL (see Dashboard create/modify dialog for more information).'},
    	grp_depAttrs: {desc: 'Enabling this would display planning attributes such as "Start date" and "Planned date".'},
    	start_date: {desc: 'Earliest planned start date. Is applicable only if "planning" is set to true for the course.'},
    	planned_date: {desc: 'Expected planned completion date. Is applicable only if "planning" is set to true for the course.'},
    	grp_additionalAttrs: {name: 'Advanced attributes', desc: 'Enabling this would display additional attributes depeneding on the selected "Element type" of the module.'},
    	start_after: {desc: 'You could provide a list of items the current item is dependant on. Till the listed items are completed by a learner, the current item will be in locked state and cannot be viewed by the learner. Further you could define minimum/maximum scores to be achieved in earlier items before this item is unlocked. This attribute is a JSON string. The id used for module attribute below is the unique id of that item.<br> Example:<br> <div><pre>[{"module": "_id1", "min_score": 70}, {"module": "_id2", "min_score": 70, "max_score": 90"}]</pre></div>'},
    	reopen_on_fail: {desc: 'You could reopen a set of learning modules if the lerner failed in the quiz. To do this, you need to configure this attribute on the quiz module. You can list the items (refered by their unique id) which have to be reopened if the learner failed to acheive minimum pass score in the current module. This attribute is a JSON string representing an array of strings: each string is unque id of the item that should be re-opened.<br> Example:<br></div><pre>["_id1", "_id2"]</pre></div>'},
		icon: {desc: 'Icon to be displayed for this item in the course tree. If not provided, this is derived from the type. "quiz" is a predefined icon.'},
		text: {desc: 'Provide a description which is shown in the content area / details popup when the element is clicked.'},
		maxAttempts: {desc: 'Number of time the lerner can do this lesson. Only the learning data from the last attempt is considered. 0 means infinite. 1 is the default.'},
		hide_remarks: {name: 'Remarks', desc: 'By default the learner will be shown a text field where the learner can add remarks. This behavior can be disabled by checking this flag.'},
		autocomplete: {desc: 'If this flag is checked, the link is automatically marked completed when the learner views for the first time.'},
		parentId: {desc: 'Defines the unique id of the folder item under which the current module is located.'},
		id: {desc: 'Defines the unique id of the current item. This is automatically generated.'},
		totalItems: {desc: 'Displays the number of total modules the folders currently has.'} 
    };
    
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
        for(var i=0; i<courseAttrs.length; i++) {
            var attr = courseAttrs[i];
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
        attr.values = info.elList;
        attr.valueNames = info.elDesc;
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
				   template: 'Are you sure you want to delete? This cannot be undone once you save.',
				   okText: nl.t('Delete')};
		nlDlg.popupConfirm(msg).then(function(res) {
			if(!res) return;
	    	var indicesToRemove = [];
	        for(var i=0; i < _allModules.length; i++){
	        	if (_isDescendantOf(_allModules[i], cm)) indicesToRemove.push(i);
	        }
	        _romoveElements(indicesToRemove);
			$scope.editorCb.showVisible(null);
			$scope.editorCb.updateChildrenLinks();
		});
    }

	function _romoveElements(indicesToRemove) {
        for (var j = indicesToRemove.length -1; j >= 0; j--){
		    _allModules.splice(indicesToRemove[j],1);
		}
	}
	
	function _saveCourse(e, bPublish, cm){
	    if(!_validateInputs(modeHandler.course, cm)) return;
		if (!bPublish) {
			_saveAfterValidateCourse(e, bPublish);
			return;
		}
		var templateMsg = nl.t('Are you sure you want to publish this course?');
		var msg = {title: 'Please confirm', 
				   template: templateMsg,
				   okText: nl.t('Publish')};
		nlDlg.popupConfirm(msg).then(function(res) {
			if(!res) return;
	    	_saveAfterValidateCourse(e, bPublish);
		});		
	}

    function _saveAfterValidateCourse(e, bPublish) {
        modeHandler.course.content.modules = [];
    	for(var i=0; i<_allModules.length; i++){
    	    var newModule = _getSavableModuleAttrs(_allModules[i]);
		        modeHandler.course.content.modules.push(newModule);	    	
		}
        var modifiedData = {
                        name: modeHandler.course.name, 
                        icon: modeHandler.course.icon, 
                        description: modeHandler.course.description,
                        content: _objToJson(modeHandler.course.content) 
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
        var allowedAttributes = allowedModuleAttrs[cm.type] || [];
    	var attrs = Object.keys(allowedAttributes);
        var editedModule = {};
        for(var i=0; i<attrs.length; i++){
    		var attr = attrs[i];
    		if (!(attr in allowedAttributes)) continue;
    		var allowedAttr = allowedAttributes[attr];
            if(cm[attr] === null || cm[attr] === undefined || cm[attr] === '') continue;
            editedModule[attr] = cm[attr];
        }
        return editedModule;
    }
	
    function _searchLesson(e, cm){
    	nlLessonSelect.showSelectDlg($scope, _userInfo).then(function(selectionList) {
    		if (selectionList.length != 1) return;
    		cm.refid = selectionList[0].lessonId;
    		cm.name = selectionList[0].title;
    	});
    };

	function _organiseModulesDlg(e, cm){
		if(!_validateInputs(modeHandler.course, cm)) return;
		_organiseModules(e, cm);
	};

    function _validateInputs(data, cm) {
        var errorLocation = {};
        var ret = _validateInputsImpl(data, cm, errorLocation);
        if (!ret) {
            nlDlg.popupAlert({title: nl.t('Error: {}', errorLocation.title), template:errorLocation.template});
            // TODO-MUNNI: process the error location
        }
        return ret;
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
    	var modules = data.content.modules;
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
    	if(module.type != 'lesson') return true;
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
    
    function _getParentId(idStr) {
        var parents = idStr.split('.');
        parents.pop(); // Remove the last entry
        return parents.join('.');
    }
    
    function _validateFail(errorLocation, attr, errMsg, cm) {
        errorLocation.title = attr;
        errorLocation.template = nl.fmt2('<p><b>Error:</b> {}</p>', errMsg);
        if (cm) {
            errorLocation.template += nl.fmt2('<p><b>Item:</b> {}</p>', cm.name);
        }
    	return false;
    }

    function _onLaunch($event, cm){
    	if(!_validateInputs(modeHandler.course, cm)) {
    		return;
    	} else {
	    	$scope.editorCb.launchModule($event, cm);			
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
			$scope.editorCb.showVisible(null);
			$scope.editorCb.updateChildrenLinks();
		}};
		_organiseModuleDlg.show('view_controllers/course/course_organiser.html', [], closeButton, false);
    		
    }
    
	function _moveItem(movedItem, fromIndex, toIndex) {
		$scope.editorCb.moveItem(movedItem, fromIndex, toIndex, _allModules);
		$scope.editorCb.showVisible(null);
	};

    
    function _modifyAndUpdateToServer(modifiedData){
        nlDlg.showLoadingScreen();
        nlCourse.courseModify(modifiedData).then(function(course) {
            nlDlg.hideLoadingScreen();
        });
    }
}];

//-------------------------------------------------------------------------------------------------
function CourseEditDirective(template) {
    return ['nl', function(nl) {
        return {
            restrict: 'E',
            templateUrl: nl.fmt2('view_controllers/course/{}.html', template),
            scope: true
        };
    }];
}

//-------------------------------------------------------------------------------------------------
module_init();
})();
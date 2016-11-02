(function() {

//-------------------------------------------------------------------------------------------------
// course_edit.js:
// course_edit module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.course_edit', [])
    .service('nlCourseEditor', NlCourseEditorSrv)
    .directive('nlCourseEditor', CourseEditDirective('course_editor'))
    .directive('nlCourseEditorFields', EditorFieldsDirective)
    .directive('nlObjectToJson', ObjectToJsonDirective);
}

//-------------------------------------------------------------------------------------------------
var EditorFieldsDirective = ['nl', function(nl) {
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/course/course_editor_fields.html',
        scope: {
            attrs: '=',
            values: '=',
            editor: '='
        }
    };
}];
//-------------------------------------------------------------------------------------------------
var NlCourseEditorSrv = ['nl', 'nlDlg', 'nlCourse',
function(nl, nlDlg, nlCourse) {

    var modeHandler = null;
    var $scope = null;
    var _allModules = [];
    var _debug = null;

    this.init = function(_scope, _modeHandler) {
        $scope = _scope;
        modeHandler = _modeHandler;
		var params = nl.location.search();
        if ('debug' in params) _debug = true;

        var course = modeHandler.course;
        $scope.editor = {
        	course_params: _courseParams,
            course_attributes: _getCourseAttributes(course),
            module_attributes: moduleAttrs,
            course: course,
            debug: _debug,
            typeNames: {'module': 'Folder', 'lesson': 'Module', 'link': 'Link', 'info': 'Information'},
            showHelp: false,
            showGroup: {},
            onLaunch: _onLaunch,
            addModule: _addModule,
            deleteModule: _deleteModule,
            searchLesson: _searchLesson,
            organiseModules: _organiseModules,
            saveCourse: _saveCourse
        };
    };

    this.getAllModules = function(bClear) {
    	if (bClear) _allModules = [];
    	return _allModules;
    };
	
    function _getCourseAttributes(course) {
        var ret = angular.copy(courseAttrs);
        var knownAttributes = {};
        for (var i=0; i<ret.length; i++) {
        	knownAttributes[ret[i].name] = true;
        }
        
        for (var k in course.content) {
            if (k in knownAttributes) continue;
            ret.push({name: k, text: k, type: 'string', help: 'Custom parameter'});
        }
        return ret;
    }

    var courseAttrs = [
        {name: 'grp_additionalAttrs', type: 'group', text: 'Show advanced attributes', help:'show/hide additional fields'},
    	{name: 'planning', text:'Schedule planning', desc: 'Enable schedule planning for this course', group: 'grp_additionalAttrs', type: 'boolean', help:'Start and end dates are considered only if schedule planning is enabled.'},
    	{name: 'certificate', text: 'Certificate configuration', type: 'object', group: 'grp_additionalAttrs', help: 'JSON string of form: {"bg": "certificate_background_image_url"}'},
    	{name: 'custtype', text: 'Custom type', type: 'number', group: 'grp_additionalAttrs', help:'You can define a custom type to help in searchability'},
    	{name: 'lastId', text: 'Last Id', type: 'readonly', group: 'grp_additionalAttrs', debug: true, help: 'Internally used'},
    	{name: 'modules', text: 'Modules', type: 'hidden', group: 'grp_additionalAttrs', debug: true, help: 'Debug the overall module list'}
    ];
    
    var _courseParams = [
    	{name: 'name', text: 'Name', type: 'string', help:'Mandatory - enter a name for your course.'},
    	{name: 'icon', text: 'Image', type: 'string', help:' Mandatory - enter a URL for the course icon that will be displayed when this course is searched.'},
    	{name: 'description', text: 'Course description', type: 'text', help:'Provide a short description which will help others in the group to understand the purpose of this course.'},
    ];
    
    var moduleAttrs = [
        {name: 'name', fields: ['module', 'lesson', 'link', 'info'], type: 'string', text: 'Name', help:'Name of the item to be displayed in the course tree.'}, 
        {name: 'type', fields: ['module', 'lesson', 'link', 'info'], type: 'list', text: 'Element type', values: ['module', 'lesson', 'info', 'link'], help:'Each item could be a Folder (containing other items) or a Module (a learning module/quiz) or Information or a Link (internal URL like certificate or external URL to be launched from the course).'},
        {name: 'refid', fields: ['lesson'], type: 'lessonlink', text: 'Module-id', help:'The id of the learning module/quiz to be launched. You could search for all approved modules by clicking on the search icon. Click on the link icon to preview the module.'},
        {name: 'action', fields: ['link'], type: 'lessonlink', text: 'Action', help:'The action whose URL is used for the link. Click on the icon to view the link'},
        {name: 'urlParams', fields: ['link'], type: 'string', text: 'Url-Params', help:'The urlParams to append to the URL (see Dashboard create/modify dialog for more information).'},
        {name: 'grp_depAttrs', fields: ['lesson', 'link', 'info'], type: 'group', text: 'Planning and dependecies', help:'show/hide planning and dependency related attributes'},
        {name: 'start_date', fields: ['lesson', 'link', 'info'], type: 'date', text: 'Start date', group: 'grp_depAttrs', help:'Earliest planned start date. Is applicable only if "planning" is set to true for the course.'},
        {name: 'planned_date', fields: ['lesson', 'link', 'info'], type: 'date', text: 'Planned date', group: 'grp_depAttrs', help:'Expected planned completion date. Is applicable only if "planning" is set to true for the course.'},
        {name: 'grp_additionalAttrs', fields: ['module', 'lesson', 'link', 'info'], type: 'group', text: 'Show advanced attributes', help:'show/hide additional fields'},
        {name: 'start_after', fields: ['lesson', 'link', 'info'], type: 'object', text: 'Start after', group: 'grp_additionalAttrs', help:'You could provide a list of items the current item is dependant on. Till the listed items are completed by a learner, the current item will be in locked state and cannot be viewed by the learner. Further you could define minimum/maximum scores to be achieved in earlier items before this item is unlocked. This attribute is a JSON string. The id used for module attribute below is the unique id of that item. Example: [{"module": "_id1", "min_score": 70}, {"module": "_id2", "min_score": 70, "max_score": 90"}]'},
        {name: 'reopen_on_fail', fields: ['lesson'], type: 'object', text: 'Reopen on fail', group: 'grp_additionalAttrs', help:'You could reopen a set of learning modules if the lerner failed in the quiz. To do this, you need to configure this attribute on the quiz module. You can list the items (refered by their unique id) which have to be reopened if the learner failed to acheive minimum pass score in the current module. This attribute is a JSON string representing an array of strings: each string is unque id of the item that should be re-opened. Example: ["_id1", "_id2"]'},
        {name: 'icon', fields: ['module', 'lesson', 'link', 'info'], type: 'string', text: 'Module icon', group: 'grp_additionalAttrs', help:'Icon to be displayed for this item in the course tree. If not provided, this is derived from the type. "quiz" is a predefined icon.'},
        {name: 'text', fields: ['module', 'lesson', 'link', 'info'], type: 'text', text: 'Description', group: 'grp_additionalAttrs', help:'Provide a description which is shown in the content area / details popup when the element is clicked.'},
        {name: 'max_attempts', fields: ['lesson'], type: 'number', text: 'Maximum attempts', group: 'grp_additionalAttrs', help:'Number of time the lerner can do this lesson. Only the learning data from the last attempt is considered. 0 means infinite. 1 is the default.'},
        {name: 'hide_remarks', fields: ['info', 'link'], type: 'boolean', text: 'Disable remarks', group: 'grp_additionalAttrs', help:'By default the learner will be shown a text field where the learner can add remarks. This behavior can be disabled by checking this flag.'},
        {name: 'autocomplete', fields: ['link'], type: 'boolean', text: 'Auto complete',  desc: 'Mark as completed when viewed the first time', group: 'grp_additionalAttrs', help:'If this flag is checked, the link is automatically marked completed when the learner views for the first time.'},
        {name: 'parentId', fields: ['module', 'lesson', 'link', 'info'], type: 'readonly', debug: true, text: 'Parent ID', group: 'grp_additionalAttrs', readonly: true, help: 'Defines the unique id of the folder item under which the current module is located.'}, 
        {name: 'id', fields: ['module', 'lesson', 'link', 'info'], type: 'readonly', text: 'Unique ID', group: 'grp_additionalAttrs', readonly: true, help: 'Defines the unique id of the current item. This is automatically generated.'}, 
    	{name: 'totalItems', fields : ['module'], type: 'readonly', text: 'Total items', group: 'grp_additionalAttrs', help: 'Displays the number of total modules the folders currently has.'}
    ];
    
    var allowedModuleAttrs = (function () {
    	var ret = {};
    	for(var i=0; i<moduleAttrs.length; i++) {
    		var attr = moduleAttrs[i];
    		for(var j=0;j< attr.fields.length; j++) {
    			var itemType = attr.fields[j];
    			if (!(itemType in ret)) ret[itemType] = [];
    			ret[itemType].push(attr.name);
    		}
    	}
    	return ret;
    })();
    
    
    function _addModule(e, cm) {
    	var courseContent = modeHandler.course.content;
    	if (!('lastId' in courseContent)) courseContent.lastId = 0;
    	courseContent.lastId++;


        var newModule = {name: nl.t('Folder {}', courseContent.lastId), type: 'module', id: '_id' + courseContent.lastId};
        if (!cm.parentId) {
        	// Current item is the root element: add as child of root element and at the top
        	newModule.parentId = '_root';
        	_allModules.splice(0, 0, newModule);
        } else if (cm.isOpen) {
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
		});
    }

	function _romoveElements(indicesToRemove) {
        for (var j = indicesToRemove.length -1; j >= 0; j--){
		    _allModules.splice(indicesToRemove[j],1);
		}
	}
	
	function _saveCourse(e, cm, bPublish){
	    if(!_validateInputs(modeHandler.course)) {
	        if(e) e.preventDefault();
	        return;
	    } else {
	    	_saveAfterValidateCourse(e, cm, bPublish);
	    }

	}

    function _saveAfterValidateCourse(e, cm, bPublish) {
    	modeHandler.course.content.modules = [];
    	for(var i=0; i<_allModules.length; i++) {
    		modeHandler.course.content.modules.push(_validate(_allModules[i]));
    	}
        var modifiedData = {
                        name: modeHandler.course.name, 
                        icon: modeHandler.course.icon, 
                        description: modeHandler.course.description,
                        content: angular.toJson(modeHandler.course.content) 
                    };
        if(modeHandler.course.id) modifiedData.courseid = modeHandler.course.id;
        modifiedData.publish = bPublish;
        _modifyAndUpdateToServer(modifiedData);    
    }
    
    function _validate(cm) {
        var allowedAttributes = allowedModuleAttrs[cm.type] || [];
        var editedModule = {};
        for(var i=0; i<allowedAttributes.length; i++){
            var attr = allowedAttributes[i];
            if(cm[attr] === null || cm[attr] === undefined || cm[attr] === '') continue;
            editedModule[attr] = cm[attr];
        }
        return editedModule;
    }
    
    function _searchLesson(){
    	nlDlg.showLoadingScreen();
        nlCourse.getApprovedList().then(function(data) {
        	nlDlg.hideLoadingScreen();
        	_showLessonSelectDlg(data);
        });    	
    };

    function _validateInputs(data) {
        if(!data.name) return _validateFail(data, 'name', 'Course name is mandatory');
        if(!data.icon) return _validateFail(data, 'icon', 'Course icon URL is mandatory');
        if(!data.content) return _validateFail(data, 'content', 'Course content is mandatory');

        try {
            var courseContent = angular.fromJson(data.content);
            return _validateContent(data, courseContent);            
        } catch (error) {
        	nlDlg.popupAlert({title: 'content', template: nl.t('<p>Error parsing JSON: {}. Try <a href="http://www.jsoneditoronline.org">www.jsoneditoronline.org</a> to debug more</p>', error.toString())});
        	return false;
        }
    }

    function _validateContent(data, courseContent) {
    	if (!courseContent.modules) return _validateFail(data, 'content', 
            '"modules" field is expected in content');
        var modules = courseContent.modules;
        if (!angular.isArray(modules)) return _validateFail(data, 'content', 
            '"modules" needs to be a JSON array []');
        if (modules.length < 1) return _validateFail(data, 'content', 
            'Atleast one course module object is expected in the content');

        var uniqueIds = {};
        for(var i=0; i<modules.length; i++){
            var module = modules[i];
            if (!module.id) return _validateModuleFail(data, module, '"id" is mandatory');
            if (!module.name) return _validateModuleFail(data, module, '"name" is mandatory');
            if (!module.type) return _validateModuleFail(data, module, '"type" is mandatory');
            if (module.id in uniqueIds) return _validateModuleFail(data, module, '"id" has to be unique');
            uniqueIds[module.id] = module.type;
            var parentId = _getParentId(module.id);
            if (parentId) {
                if (!(parentId in uniqueIds)) return _validateModuleFail(data, module, 'parent module needs to be above this module');
                if (uniqueIds[parentId] != 'module') return _validateModuleFail(data, module, 'parent needs to be of type "module"');
            }

            if (!_validateModuleType(data, module)) return false;
            if (!_validateModulePlan(data, module)) return false;

            if (!_validateLessonModule(data, module)) return false;
            if (!_validateLinkModule(data, module)) return false;
            if (!_validateInfoModule(data, module)) return false;
        }
        return true;
    }

    function _validateModuleType(data, module) {
    	var moduleTypes = {'module': true, 'lesson': true, 'link': true, 'info':true};
    	if(module.type in moduleTypes) return true;
    	var msg = '"type" has to be one of [' + Object.keys(moduleTypes).toString() + ']';
        return _validateModuleFail(data, module, msg);
    }

    function _validateModulePlan(data, module) {
    	if (!module.planned_date) return true;
    	var d = nl.fmt.json2Date(module.planned_date);
        if (!isNaN(d.valueOf())) return true;
    	return _validateModuleFail(data, module, 'Incorrect planned date: "YYYY-MM-DD" format expected');
    }
    
    function _validateLessonModule(data, module) {
    	if(module.type != 'lesson') return true;
        if(!module.refid) return _validateModuleFail(data, module, '"refid" is mandatory for "type": "lesson"');
        if(!angular.isNumber(module.refid)) return _validateModuleFail(data, module, '"refid" should be a number - not a string');
        return true;
    }

    function _validateLinkModule(scope, module) {
    	if(module.type != 'link') return true;
        if(!module.action) return _validateModuleFail(data, module, '"action" is mandatory for "type": "link"');
        if(!module.urlParams) return _validateModuleFail(data, module, '"urlParams" is mandatory for "type": "urlParams"');
        return true;
    }
    
    function _validateInfoModule(data, module) {
    	if(module.type != 'info') return true;
        return true;
    }
    
    function _getParentId(idStr) {
        var parents = idStr.split('.');
        parents.pop(); // Remove the last entry
        return parents.join('.');
    }
    
    function _validateModuleFail(data, module, errMsg) {
    	return nlDlg.setFieldError(data, 'content',
        	nl.t('{}: module - {}', nl.t(errMsg), angular.toJson(module)));
    }

    function _validateFail(data, attr, errMsg) {
    	nlDlg.popupAlert({title: attr, template:nl.t(errMsg)});
    	return false;
    }


    function _showLessonSelectDlg(data){
    	var _selectDlg = nlDlg.create($scope);
    		_selectDlg.setCssClass('nl-height-max nl-width-max');
			_selectDlg.scope.data = {};
			_selectDlg.scope.data.title = nl.t('Approved lessons information');
			_selectDlg.scope.data.lessonList = data;

		var closeButton = {text : nl.t('Close')};
		_selectDlg.show('view_controllers/course/course_lesson_select.html', [], closeButton, false);
    };
    
    function _onLaunch($event, value){
    	$scope.editorCb.launchModule($event, value);	
    }
    
    function _organiseModules(){
    	var _organiseModuleDlg = nlDlg.create($scope);
    		_organiseModuleDlg.setCssClass('nl-height-max nl-width-max');
			_organiseModuleDlg.scope.data = {};
			_organiseModuleDlg.scope.data.title = nl.t('Reorder the modules');
			_organiseModuleDlg.scope.data.modules = _allModules;
			_organiseModuleDlg.scope.moveItem = function(item, fromIndex, toIndex){
				_moveItem(item, fromIndex, toIndex);
			};
		var closeButton = {text : nl.t('Close'), onTap: function(e){
						//TODO : refresh all modules need to be implemented.
					}};
		_organiseModuleDlg.show('view_controllers/course/course_organiser.html', [], closeButton, false);
    		
    }
    
	function _moveItem(movedItem, fromIndex, toIndex) {
		console.log('_moveItem: TODO remove', toIndex, fromIndex, _allModules);
		var currentItem = _allModules[toIndex];
		movedItem.parentId = currentItem.parentId;
		_allModules.splice(fromIndex, 1);
		_allModules.splice(toIndex, 0, movedItem);
		$scope.editorCb.updateMovedItem(movedItem, fromIndex, toIndex);
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
function ObjectToJsonDirective() {
    return {
        restrict: 'A',
        require: 'ngModel',
        link: function($scope, elem, attr, ngModel) {            
          function into(input) {
            return angular.fromJson(input, 2);
          }
          function out(data) {
            return angular.toJson(data);
          }
          ngModel.$parsers.push(into);
          ngModel.$formatters.push(out);

        }
    };
};

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
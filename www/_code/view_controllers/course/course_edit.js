(function() {

//-------------------------------------------------------------------------------------------------
// course_edit.js:
// course_edit module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.course_edit', [])
    .service('nlCourseEditor', NlCourseEditorSrv)
    .directive('nlCourseEditor', CourseEditDirective('course_editor'))
    .directive('nlCourseEditorList', CourseEditDirective('course_editor_list'))
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
            course_attributes: _getCourseAttributes(course),
            module_attributes: moduleAttrs,
            course: course,
            debug: _debug,
            typeNames: {'module': 'Folder', 'lesson': 'Module', 'link': 'Link', 'info': 'Information'},
            showHelp: false,
            showGroup: {},
            addModule: _addModule,
            deleteModule: _deleteModule,
            searchLesson: _searchLesson,
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
    	{name: 'planning', text: 'Enable planning dates', type: 'boolean', help:'Start and end dates are considered only if planning is true'},
    	{name: 'certificate', text: 'Certificate configuration', type: 'object', help: 'JSON string of form: {"bg": "certificate_background_image_url"}'},
    	{name: 'custtype', text: 'Custom type', type: 'number', help:'You can define a custom type to help in searchability'},
    	{name: 'lastId', text: 'Last Id', type: 'readonly', debug: true, help: 'Internally used'},
    	{name: 'modules', text: 'Modules', type: 'hidden', debug: true, help: 'Debug the overall module list'}
    ];
    
    var moduleAttrs = [
        {name: 'name', fields: ['module', 'lesson', 'link', 'info'], type: 'string', text: 'Name', help:'Name of the module to be displayed in the course tree.'}, 
        {name: 'type', fields: ['module', 'lesson', 'link', 'info'], type: 'list', text: 'Element type', values: ['module', 'lesson', 'info', 'link'], help:'"module is a folder of info or a link", "lesson is a module", "info" or "link".'},
        {name: 'refid', fields: ['lesson'], type: 'lessonlink', text: 'Module-id', help:'The id of the lesson to be launched. Click on the link to view the module'},
        {name: 'action', fields: ['link'], type: 'lessonlink', text: 'Action', help:'The action whose URL is used for the link. Click on the icon to view the link'},
        {name: 'urlParams', fields: ['link'], type: 'string', text: 'Url-Params', help:'The urlParams to append to the URL (see Dashboard create/modify dialog for more information).'},
        {name: 'grp_depAttrs', fields: ['lesson', 'link', 'info'], type: 'group', text: 'Planning and dependecies', help:'show/hide planning and dependency related attributes'},
        {name: 'start_date', fields: ['lesson', 'link', 'info'], type: 'date', text: 'Start date', group: 'grp_depAttrs', help:'Earliest planned start date. Is applicable only if "planning" is set to true for the course.'},
        {name: 'planned_date', fields: ['lesson', 'link', 'info'], type: 'date', text: 'Planned date', group: 'grp_depAttrs', help:'Expected planned completion date. Is applicable only if "planning" is set to true for the course.'},
        {name: 'start_after', fields: ['lesson', 'link', 'info'], type: 'object', text: 'Start after', group: 'grp_depAttrs', help:'Array of objects: each object contains "module", "min_score" (optional) and "max_score" (optional) attributes.'},
        {name: 'reopen_on_fail', fields: ['lesson'], type: 'object', text: 'Reopen on fail', group: 'grp_depAttrs', help:'Array of strings: each string is module id of leaft modules that should be failed if the current module fails.'},
        {name: 'grp_additionalAttrs', fields: ['module', 'lesson', 'link', 'info'], type: 'group', text: 'Extended attributes', help:'show/hide additional fields'},
        {name: 'icon', fields: ['module', 'lesson', 'link', 'info'], type: 'string', text: 'Module icon', group: 'grp_additionalAttrs', help:'Icon to be displayed for this item in the course tree. If not provided, this is derived from the type. "quiz" is a predefined icon.'},
        {name: 'text', fields: ['module', 'lesson', 'link', 'info'], type: 'text', text: 'Description', group: 'grp_additionalAttrs', help:'some text string'},
        {name: 'max_attempts', fields: ['lesson'], type: 'number', text: 'Maximum attempts', group: 'grp_additionalAttrs', help:'Number of time the lerner can do this lesson. Only the learning data from the last attempt is considered. 0 means infinite. 1 is the default.'},
        {name: 'hide_remarks', fields: ['info', 'link'], type: 'boolean', text: 'Hide remarks', group: 'grp_additionalAttrs', help:'true/false. true = do not show remark field when marking the item as done. false is default.'},
        {name: 'autocomplete', fields: ['link'], type: 'boolean', text: 'Auto-complete', group: 'grp_additionalAttrs', help:'true/false. If true, the link is marked completed when viewed first time. The user will not have possibility to set the status here.'},
        {name: 'parentId', fields: ['module', 'lesson', 'link', 'info'], type: 'readonly', debug: true, text: 'Parent ID', group: 'grp_additionalAttrs', readonly: true, help: 'Defines the unique id of a course module. Parent-child relationship of course elements (tree structure) is derived from the id - id of the child element should always begin with the id of parent element and a ".".'}, 
        {name: 'id', fields: ['module', 'lesson', 'link', 'info'], type: 'readonly', text: 'Unique ID', group: 'grp_additionalAttrs', readonly: true, help: 'Defines the unique id of a course module. Parent-child relationship of course elements (tree structure) is derived from the id - id of the child element should always begin with the id of parent element and a ".".'}, 
    	{name: 'totalItems', fields : ['module'], type: 'readonly', text: 'Total items', group: 'grp_additionalAttrs', help: 'Displays the number of total modules the folders currently has.'}
    ];
    
    function _addModule(e, cm) {
    	var courseContent = modeHandler.course.content;
    	if (!('lastId' in courseContent)) courseContent.lastId = 0;
    	courseContent.lastId++;

        var newModule = {name: nl.t('Folder {}', courseContent.lastId), type: 'module', id: courseContent.lastId};
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
    	var indicesToRemove = [];
        for(var i=0; i < _allModules.length; i++){
        	if (_isDescendantOf(_allModules[i], cm)) indicesToRemove.push(i);
        }
        _romoveElements(indicesToRemove);
		$scope.editorCb.showVisible(null);
    }

	function _romoveElements(indicesToRemove) {
        for (var j = indicesToRemove.length -1; j >= 0; j--){
		    _allModules.splice(indicesToRemove[j],1);
		}
	}
	
    function _saveCourse(e, cm, bPublish) {
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
    
    function _validate(cm){
        var arr = null;
        var module = ['id', 'name', 'type', 'icon', 'text', 'parentId'];
        var lesson = ['id', 'name', 'type', 'icon', 'text', 'parentId', 'refid', 'start_date', 'planned_date', 'maxAttempts', 'start_after', 'reopen_on_fail'];
        var link = ['id', 'name', 'type', 'icon', 'text', 'parentId','action', 'urlParams', 'start_date', 'planned_date', 'hide_remarks', 'start_after', 'autocomplete'];
        var info = ['id', 'name', 'type', 'icon', 'text', 'parentId', 'start_date', 'planned_date', 'hide_remarks', 'start_after'];
        var editedModule = {};
        if(cm.type == 'module') {
            arr = module;
        } else if(cm.type == 'lesson'){
            arr = lesson;
        } else if(cm.type == 'link'){
            arr = link;
        } else if(cm.type == 'info'){
            arr = info;
        }
        for(var i in arr){
            var elem = arr[i];
            if(!((cm[elem] == null) || (cm[elem] == undefined)))  {
                editedModule[elem] = cm[elem];
            }
        }
        return editedModule;
    }
    
    function _searchLesson(){
        nlCourse.getApprovedList().then(function(data) {
        	_showLessonSelectDlg(data);
        });    	
    };
     
    function _showLessonSelectDlg(data){
    	var _selectDlg = nlDlg.create($scope);
    		_selectDlg.setCssClass('nl-height-max nl-width-max');
			_selectDlg.scope.data = {};
			_selectDlg.scope.data.title = nl.t('Approved lessons information');
			_selectDlg.scope.data.lessonList = data;

		var closeButton = {text : nl.t('Close')};
		_selectDlg.show('view_controllers/course/course_lesson_select.html', [], closeButton, false);
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
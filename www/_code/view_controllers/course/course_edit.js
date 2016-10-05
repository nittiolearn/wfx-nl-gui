(function() {

//-------------------------------------------------------------------------------------------------
// course_edit.js:
// course_edit module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.course_edit', [])
    .service('nlCourseEditor', NlCourseEditorSrv)
    .directive('nlObjectToJson', ObjectToJsonDirective);
}

//-------------------------------------------------------------------------------------------------
var NlCourseEditorSrv = ['nl', 'nlDlg', 'nlCourse',
function(nl, nlDlg, nlCourse) {

    var modeHandler = null;
    var $scope = null;

    this.init = function(_scope, _modeHandler, course) {
        modeHandler = _modeHandler;
        $scope = _scope;
        $scope.editor = {
            course_attributes: _getCourseAttributes(course),
            module_attributes: attrs,
            typeNames: {'module': 'Folder', 'lesson': 'Module', 'link': 'Link', 'info': 'Information'},
            showHelp: false,
            showGroup: {},
            addModule: _addModule,
            deleteModule: _deleteModule,
            saveCourse: _saveCourse
        };
    };

    function _getCourseAttributes(course) {
        var keys = Object.keys(course.content);
        var ret = [];
        for (var k in keys) {
            var key = keys[k];
            if (key == 'modules') continue;
            ret.push({key: key, val: course.content[key]});
        }
        return ret;
    }

    var attrs = [
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
        {name: 'max_attempts', fields: ['lesson'], type: 'string', text: 'Maximum attempts', group: 'grp_additionalAttrs', help:'Number of time the lerner can do this lesson. Only the learning data from the last attempt is considered. 0 means infinite. 1 is the default.'},
        {name: 'hide_remarks', fields: ['info', 'link'], type: 'boolean', text: 'Hide remarks', group: 'grp_additionalAttrs', help:'true/false. true = do not show remark field when marking the item as done. false is default.'},
        {name: 'autocomplete', fields: ['link'], type: 'boolean', text: 'Auto-complete', group: 'grp_additionalAttrs', help:'true/false. If true, the link is marked completed when viewed first time. The user will not have possibility to set the status here.'},
        {name: 'id', fields: ['module', 'lesson', 'link', 'info'], type: 'readonly', text: 'Unique ID', group: 'grp_additionalAttrs', readonly: true, help: 'Defines the unique id of a course module. Parent-child relationship of course elements (tree structure) is derived from the id - id of the child element should always begin with the id of parent element and a ".".'}, 
    ];
    
    function _addModule(e, cm) {
        // TODO
    }
            
    function _deleteModule(e, cm) {
        var modules = modeHandler.course.content.modules;
        var newModule = [];
        for(var i in modules){
            var card = modules[i];
            var str = card.id;
            if(!str.includes(cm.id)) {
                newModule.push(card);
            }
        }
        modeHandler.course.content.modules = newModule;
        var modifiedData = {
                        courseid: modeHandler.course.id,
                        name: modeHandler.course.name, 
                        icon: modeHandler.course.icon, 
                        description: modeHandler.course.description,
                        content: angular.toJson(modeHandler.course.content) 
                    };
        _modifyAndUpdateToServer(modifiedData);
    }

    function _saveCourse(e, cm) {
        var modules = modeHandler.course.content.modules;
        for(var i in modules){
            if(cm.id == modules[i].id) modeHandler.course.content.modules[i] = _validate(cm);
        }
        console.log(modeHandler.course.content.modules);        
        var modifiedData = {
                        courseid: modeHandler.course.id,
                        name: modeHandler.course.name, 
                        icon: modeHandler.course.icon, 
                        description: modeHandler.course.description,
                        content: angular.toJson(modeHandler.course.content) 
                    };
        _modifyAndUpdateToServer(modifiedData);    
    }
    
    function _validate(cm){
        console.log(cm);
        var arr = null;
        var module = ['id', 'name', 'type', 'icon', 'text'];
        var lesson = ['id', 'name', 'type', 'icon', 'text', 'refid', 'start_date', 'planned_date', 'maxAttempts', 'start_after', 'reopen_on_fail'];
        var link = ['id', 'name', 'type', 'icon', 'text','action', 'urlParams', 'start_date', 'planned_date', 'hide_remarks', 'start_after', 'autocomplete'];
        var info = ['id', 'name', 'type', 'icon', 'text', 'start_date', 'planned_date', 'hide_remarks', 'start_after'];
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
module_init();
})();
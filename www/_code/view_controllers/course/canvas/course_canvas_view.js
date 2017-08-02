(function() {

//-------------------------------------------------------------------------------------------------
// course_canvas_view.js:
// course_canvas_view module
//-------------------------------------------------------------------------------------------------
function module_init() {
    var templateUrl = 'view_controllers/course/canvas/course_canvas_view.html';
    angular.module('nl.course_canvas_view', [])
    .service('nlCourseCanvas', NlCourseCanvasSrv)
    .directive('nlCourseCanvasView', _nl.elemDirective(templateUrl, true));
}

//-------------------------------------------------------------------------------------------------
function CourseViewDirective(template) {
    return _nl.elemDirective('view_controllers/course/view/' + template 
        + '.html', true);
}

//-------------------------------------------------------------------------------------------------
var NlCourseCanvasSrv = ['nl',
function(nl) {
    
    var $scope = null;
    var _canvas = null;
    this.init = function(_scope, _modeHandler, userInfo) {
        $scope = _scope;
        $scope.canvas = {};
        _canvas = $scope.canvas;
    };
    
    function temp() {
        _canvas.bgimg = course.content.bgimg || course.icon || null;
        _canvas.bgcolor = course.content.bgcolor || 'rgba(255, 255, 255, 1)';
        _canvas.pins = [];
        var modules = course.content.modules || [];
        for (var i=0; i<modules.length; i++) {
            var m = modules[i];
            _canvas.pins.push({top: m.posY || 90, left: m.posX || 90, title: m.name});
        }

        _canvas.courseJson = angular.toJson(course, 2);
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();
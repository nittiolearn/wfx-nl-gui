(function() {

//-------------------------------------------------------------------------------------------------
// _course.js: Controllers for course related functions
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.course', ['nl.course_srv', 'nl.course_list', 
	    'nl.course_view', 'nl.course_cert', 'nl.course.charts',
	    'nl.course_edit', 'nl.course_summary_report', 'nl.course_canvas_view']);
}

//-------------------------------------------------------------------------------------------------
module_init();
}());

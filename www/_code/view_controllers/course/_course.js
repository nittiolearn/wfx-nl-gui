(function() {

//-------------------------------------------------------------------------------------------------
// auth.js: Controllers for authentication related functions
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.course', ['nl.course_srv', 'nl.course_list', 'nl.course_view', 'nl.course_cert']);
}

//-------------------------------------------------------------------------------------------------
module_init();
}());

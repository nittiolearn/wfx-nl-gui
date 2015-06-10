(function() {

//-------------------------------------------------------------------------------------------------
// _lesson_modules.js:
// Collection of all lesson modules
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.lesson', ['nl.lesson_list_ctrl', 'nl.lesson_ctrl', 'nl.lesson.player', 'nl.lesson.pagetypes', 'nl.lesson_helper']);
}

//-------------------------------------------------------------------------------------------------
module_init();
}());

(function() {

//-------------------------------------------------------------------------------------------------
// _view_controllers.js:
// All view controllers are listed here
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.view_controllers', ['nl.dashboard', 'nl.assign', 'nl.lesson', 'nl.user', 'nl.temp']);
}

//-------------------------------------------------------------------------------------------------
module_init();
}());

(function() {

//-------------------------------------------------------------------------------------------------
// _view_controllers.js:
// All view controllers are listed here
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.view_controllers', ['nl.auth', 'nl.dashboard', 'nl.course', 'nl.forum', 'nl.debug']);
}

//-------------------------------------------------------------------------------------------------
module_init();
}());

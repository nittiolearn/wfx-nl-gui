(function() {

//-------------------------------------------------------------------------------------------------
// _view_controllers.js:
// All view controllers are listed here
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.view_controllers', ['nl.auth', 'nl.home', 'nl.course', 'nl.forum', 
    	'nl.debug', 'nl.dashboard', 'nl.rno', 'nl.searchlist', 'nl.assignment']);
}

//-------------------------------------------------------------------------------------------------
module_init();
}());

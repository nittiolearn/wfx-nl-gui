(function() {

//-------------------------------------------------------------------------------------------------
// _view_controllers.js:
// All view controllers are listed here
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.view_controllers', 
    	['nl.welcome', 'nl.home', 'nl.auth', 'nl.course', 'nl.forum', 'nl.debug', 
    	 'nl.dashboard', 'nl.rno', 'nl.searchlist', 'nl.assignment', 'nl.lessonlist',
    	 'nl.player', 'nl.resource', 'nl.resource_list', 'nl.send_assignment_srv', 'nl.assignment_report']);
}

//-------------------------------------------------------------------------------------------------
module_init();
}());

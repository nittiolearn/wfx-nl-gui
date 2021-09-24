(function() {

//-------------------------------------------------------------------------------------------------
// _view_controllers.js:
// All view controllers are listed here
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.view_controllers', 
    	['nl.home', 'nl.auth', 'nl.course',
    	 'nl.sco', 'nl.lessonlist',
    	 'nl.resource', 'nl.resource_list',
		 'nl.lesson']);
}

//-------------------------------------------------------------------------------------------------
module_init();
}());

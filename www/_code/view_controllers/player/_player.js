(function() {

//-------------------------------------------------------------------------------------------------
// _view_controllers.js:
// All view controllers are listed here
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.player', 
    	['nl.playerctrl', 'nl.playerctx', 'nl.playerutils', 'nl.pagetype']);
}

//-------------------------------------------------------------------------------------------------
module_init();
}());

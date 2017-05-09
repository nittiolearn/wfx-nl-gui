(function() {

//-------------------------------------------------------------------------------------------------
// _lib.js: 
// Collection of all modules under lib folder
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.lib', ['nl.nl', 'nl.log', 'nl.router', 'nl.config', 
        'nl.exporter', 'nl.importer', 'nl.oldcodebridge']);
}

//-------------------------------------------------------------------------------------------------
module_init();
}());

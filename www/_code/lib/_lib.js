(function() {

//-------------------------------------------------------------------------------------------------
// _lib.js: 
// Collection of all modules under lib folder
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.lib', ['nl.nl', 'nl.log', 'nl.router', 'nl.group_info', 'nl.group_cache', 'nl.config',
        'nl.exporter', 'nl.importer', 'nl.oldcodebridge', 'nl.user_settings', 'nl.expression_processor',
        'nl.report_helper', 'nl.getmany_store', 'nl.mobileconnector']);
}

//-------------------------------------------------------------------------------------------------
module_init();
}());

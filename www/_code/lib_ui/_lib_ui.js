(function() {

//-------------------------------------------------------------------------------------------------
// _lib_ui.js:
// Module summarizing the list of modiles in lib_ui folder
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.lib_ui', ['nl.ui.dlg', 'nl.ui.cards', 'nl.ui.utils', 'nl.ui.markup', 'ivh.treeview']);
}

//-------------------------------------------------------------------------------------------------
module_init();
}());

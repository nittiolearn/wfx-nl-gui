(function() {

//-------------------------------------------------------------------------------------------------
// lr_helper.js: Assorted helpers used across modules in this folder
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.lr_helper', [])
	.config(configFn)
	.service('nlLrHelper', NlLrHelper);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
}];

//-------------------------------------------------------------------------------------------------
var NlLrHelper = ['nlGroupInfo', function NlLrHelper(nlGroupInfo) {
	var _majorMetaHeaders = null;
	var _allMetaHeaders = null;
    this.getMetaHeaders = function(bOnlyMajor) {
    	if (bOnlyMajor) {
    		if (!_majorMetaHeaders)
	    		_majorMetaHeaders = _getMetaHeaders(bOnlyMajor);
    		return _majorMetaHeaders;
    	} else {
    		if (!_allMetaHeaders)
	    		_allMetaHeaders = _getMetaHeaders(bOnlyMajor);
    		return _allMetaHeaders;
    	}
    };

	function _getMetaHeaders(bOnlyMajor) {
        var headers = [];
        var metadata = nlGroupInfo.getUserMetadata(null);
        for(var i=0; i<metadata.length; i++) {
            if (bOnlyMajor && !metadata[i].major) continue;
            headers.push({id: metadata[i].id, name: metadata[i].name});
        }
        return headers;
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

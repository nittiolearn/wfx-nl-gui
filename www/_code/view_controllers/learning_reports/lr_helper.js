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
    this.STATUS_PENDING = 0;
    this.STATUS_STARTED = 1;
    this.STATUS_DONE = 2;
    this.STATUS_PASSED = 3;
    this.STATUS_FAILED = 4;
    this.STATUS_CERTIFIED = 5;

    this.statusInfos = [
        {id: this.STATUS_PENDING, txt: 'pending', icon: 'ion-ios-circle-filled fgrey'},
        {id: this.STATUS_STARTED, txt: 'started', icon: 'ion-ios-circle-filled fgreen'},
        {id: this.STATUS_DONE, txt: 'done', icon: 'ion-checkmark-circled fgreen'},
        {id: this.STATUS_PASSED, txt: 'passed', icon: 'ion-checkmark-circled fgreen'},
        {id: this.STATUS_FAILED, txt: 'failed', icon: 'icon ion-close-circled forange'},
        {id: this.STATUS_CERTIFIED, txt: 'certified', icon: 'icon ion-android-star fgreen'}];
        
    this.isDone = function(statusInfo) {
        return statusInfo.id != this.STATUS_PENDING && statusInfo.id != this.STATUS_STARTED;
    };

    this.dictToList = function(d) {
        var ret = [];
        for(var k in d) ret.push(d[k]);
        return ret;
    };

    this.getMetadataDict = function(user) {
    	return _getMetadataDict(user);
    };

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

    function _getMetadataDict(user) {
    	return nlGroupInfo.getUserMetadataDict(user);
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

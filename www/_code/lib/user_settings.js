(function() {

//-------------------------------------------------------------------------------------------------
// user_settings.js: 
// Store user settings to it when ever required 
// directives and controllers
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.user_settings', [])
    .service('nlSettings', nlSettings);
}

var nlSettings = ['nlConfig', function(nlConfig) {
    this.userSettings = new userSettings(nlConfig);
}];

function userSettings(nlConfig){
    var _settings = null;
    var cacheKey = "USER_SETTINGS";
    nlConfig.loadFromDb("USER_SETTINGS", function(result) {
        _settings = result || {};
    });

    this.get = function(defaultVal) {
        nlConfig.loadFromDb("USER_SETTINGS", function(result) {
            _settings = result || {};
        });    
        if(!_settings) 
            return defaultVal;
        else
            return _settings;
    }

    this.put = function(settingName, val) {
        _settings[settingName] = val;
        nlConfig.saveToDb(cacheKey, _settings, function(res) {
        });
    }
}
//-------------------------------------------------------------------------------------------------
module_init();
})();

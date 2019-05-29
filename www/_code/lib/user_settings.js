(function() {

//-------------------------------------------------------------------------------------------------
// user_settings.js: 
// Store user settings to it when ever required 
// directives and controllers
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.user_settings', [])
    .service('nlUserSettings', UserSettings);
}

var UserSettings = ['nlConfig', function(nlConfig) {
    var _settings = null;
    var cacheKey = "USER_SETTINGS";

    this.init = function(resolve) {
        if (_settings !== null) return resolve();
        nlConfig.loadFromDb(cacheKey, function(result) {
            _settings = result || {};
            resolve();
        });
    };

    this.get = function(settingName, defaultVal) {
        if (!_settings || !(settingName in _settings)) return defaultVal;
        return _settings[settingName];
    };

    this.put = function(settingName, val) {
        if (!_settings) return;
        _settings[settingName] = val;
        nlConfig.saveToDb(cacheKey, _settings, function(res) {
        });
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

(function() {

//-------------------------------------------------------------------------------------------------
// server_api.js:
// All Server side interfaces are collected in a single service
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.config', [])
    .service('nlConfig', NlConfig);
}

//-------------------------------------------------------------------------------------------------
var NlConfig = ['nl',
function(nl) {
    
    this.saveToDb = function(key, data, resolve) {
        nl.db.put('config', data, key).then(function(key) {
            if (resolve) resolve(true);
        }, function(e) {
            if (resolve) resolve(false);
        });
    };

    this.loadFromDb = function(key, resolve) {
        nl.db.get('config', key).then(function(data) {
            if (data === undefined) {
                resolve(null);
                return;
            }
            resolve(data);
        }, function(e) {
            resolve(null);
        });
    };
}];

module_init();
})();

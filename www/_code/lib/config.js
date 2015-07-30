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
        try {
            var db = nl.db.get();
            db.put('config', data, key)
            .then(function(key) {
                nl.log.debug('saveToDb success: ', key);
                if (resolve) resolve();
            }, function(e) {
                nl.log.error('saveToDb failed: ', e);
                if (resolve) resolve();
            });
        } catch (e) {
            nl.log.error('_saveToDb exception: ', e);
            if (resolve) resolve();
        }
    };

    this.loadFromDb = function(key, resolve) {
        try {
            var db = nl.db.get();
            db.get('config', key)
            .then(function(data) {
                if (data === undefined) {
                    resolve(null);
                    return;
                }
                resolve(data);
            }, function(e) {
                nl.log.info('loadFromDb from db failed: ', e);
                resolve(null);
            });
        } catch (e) {
            nl.log.error('loadFromDb exception: ', e);
            resolve(null);
        }
    };
}];

module_init();
})();

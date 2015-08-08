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
            nl.log.debug('nlConfig.saveToDb enter: ', key);
            var db = nl.db.get();
            db.put('config', data, key)
            .then(function(key) {
                nl.log.debug('nlConfig.saveToDb success: ', key);
                if (resolve) resolve();
            }, function(e) {
                nl.log.error('nlConfig.saveToDb failed: ', e);
                if (resolve) resolve();
            });
        } catch (e) {
            nl.log.error('nlConfig.saveToDb exception: ', e);
            if (resolve) resolve();
        }
    };

    this.loadFromDb = function(key, resolve) {
        try {
            nl.log.debug('nlConfig.loadFromDb enter: ', key);
            var db = nl.db.get();
            nl.log.debug('nlConfig.loadFromDb before get: ', key);
            var result = db.get('config', key);
            nl.log.debug('nlConfig.loadFromDb after get: ', key);
            result.then(function(data) {
                if (data === undefined) {
                    nl.log.info('nlConfig.loadFromDb from db failed (returned undefined)');
                    resolve(null);
                    return;
                }
                nl.log.debug('nlConfig.loadFromDb success: ', key);
                resolve(data);
            }, function(e) {
                nl.log.warn('nlConfig.loadFromDb from db failed: ', e);
                resolve(null);
            });
        } catch (e) {
            nl.log.error('nlConfig.loadFromDb exception: ', e);
            resolve(null);
        }
        nl.log.debug('nlConfig.loadFromDb initiated: ', key);
    };
}];

module_init();
})();

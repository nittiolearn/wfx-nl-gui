(function() {

//-------------------------------------------------------------------------------------------------
// config.js:
// DB storage and configuration data
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.config', [])
    .service('nlGroupInfo', NlGroupInfo)
    .service('nlConfig', NlConfig);
}

//-------------------------------------------------------------------------------------------------
var NlGroupInfo = ['nl',
function(nl) {
    this.LOGINID = 0;
    this.NAME = 1;
    this.EMAIL = 2;
    this.USERTYPE = 3;
    this.OU = 4;
    this.SEC_OU = 5;
    this.UPDATED = 6;
}];

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

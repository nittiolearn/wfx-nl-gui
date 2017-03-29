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
var NlGroupInfo = ['nl', 'nlServerApi',
function(nl, nlServerApi) {
    this.LOGINID = 0;
    this.STATE = 1;
    this.EMAIL = 2;
    this.USERTYPE = 3;
    this.OU = 4;
    this.SEC_OU = 5;
    this.UPDATED = 6;
    this.CREATED = 7;
    this.FNAME = 8;
    this.LNAME = 9;
    this.BLEEDINGEDGE = 10;
    this.PERMOVERRIDE = 11;
    
    this.formatUserName = function(uInfo) {
        return uInfo[this.FNAME] + ' ' + uInfo[this.LNAME];
    };

    this.formatUserNameFromRecord = function(record, useridField, usernameField) {
        if (!useridField) useridField = 'student';
        if (!usernameField) usernameField = 'studentname';
        var users = _groupInfo ? _groupInfo.users : {};
        var uInfo = users[''+record[useridField]] || null;
        if (!uInfo) return record[usernameField] || '';
        return this.formatUserName(uInfo);
    };

    this.isActive = function(uInfo) {
        return uInfo[this.STATE] ? true : false;
    };
    
    this.get = function() {
        return _groupInfo;
    };
    
    var _groupInfo = null;
    this.init = function() {
        return nlServerApi.groupGetInfo().then(function(result) {
            _groupInfo = result;
        }, function(e) {
            return e;
        });
    };
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

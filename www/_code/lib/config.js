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
    var self = this;
    
    this.get = function(grpid) {
        return _groupInfos[grpid||''] || null;
    };
    
    var _groupInfos = {};
    this.init = function(reload, grpid, clean, max) {
        return nlServerApi.groupGetInfo(reload, grpid, clean, max).then(function(result) {
            _groupInfos[grpid || ''] = result;
        }, function(e) {
            return e;
        });
    };

    this.update = function(grpid) {
        _updateGroupInfo(grpid);
    };

    this.formatUserName = function(uInfo) {
        return uInfo[this.FIRST_NAME] + ' ' + uInfo[this.LAST_NAME];
    };

    this.formatUserNameFromRecord = function(record, useridField, usernameField) {
        if (!useridField) useridField = 'student';
        if (!usernameField) usernameField = 'studentname';
        var users = self.get() ? self.get().users : {};
        var uInfo = users[''+record[useridField]] || null;
        if (!uInfo) return record[usernameField] || '';
        return this.formatUserName(uInfo);
    };

    this.isActive = function(uInfo) {
        return uInfo[this.STATE] ? true : false;
    };
    
    this.getAllUserIdsWithoutPerm = function (permission) {
    	return _getAllUserIdsWithOrWihtoutPerm(permission, false);
    };
    
    function _getAllUserIdsWithOrWihtoutPerm(permission, withPerm) {
    	var ret = {};
        var groupInfo = self.get();
        var permissions = groupInfo.props.permissions;
        var users = groupInfo.derived.keyToUsers;
        for(var key in users) {
        	var user = users[key];
        	if (!user.isActive()) continue;
        	var permitted = self.checkPermissionOfUser(user, permission, permissions);
        	if (withPerm &&  !permitted || !withPerm && permitted) continue;
        	ret[user.id] = true;
        }
        return ret;
    };

    this.checkPermissionOfUser = function (user, permission, permissions) {
    	if (!permissions) permissions = self.get().props.permissions;
    	var permissionsObj = permissions[user.usertype]; 
    	return permissions[user.usertype][permission] || false;
    };

    // Admin specific stuff
    _initContants();
    
    this.getUserObj = function(uid, grpid) {
        if (!(uid in self.get(grpid).users)) return null;
        var uInfo = self.get(grpid).users[uid];
        var ret = {
            username: uInfo[this.USERNAME] || '',
            state: uInfo[this.STATE] || 0,
            email: uInfo[this.EMAIL] || '',
            usertype: uInfo[this.USERTYPE] || this.UT_STUDENT_ADVANCED,
            org_unit: uInfo[this.ORG_UNIT] || '',
            sec_ou_list: uInfo[this.SEC_OU_LIST] || '',
            supervisor: uInfo[this.SUPERVISOR] || '',
            doj: uInfo[this.DOJ] || '',
            updated: uInfo[this.UPDATED] || null,
            created: uInfo[this.CREATED] || null,
            first_name: uInfo[this.FIRST_NAME] || '',
            last_name: uInfo[this.LAST_NAME] || '',
            isBleedingEdge: uInfo[this.ISBLEEDINGEDGE] || false,
            perm_override: uInfo[this.PERM_OVERRIDE] || '',
            metadata: uInfo[this.METADATA] || ''
        };
        ret.id = parseInt(uid);
        ret.user_id = ret.username.substring(0, ret.username.indexOf('.'));
        ret.created = nl.fmt.json2Date(ret.created);
        ret.updated = nl.fmt.json2Date(ret.updated);
        ret.name = this.formatUserName(uInfo);
        ret.isActive = function() { return ret.state ? true : false};
        ret.getIcon = function() { return ret.state ? _getUtIcon(ret.usertype) : 
            nl.url.resUrl('ball-grey.png')};
        ret.getStateStr = function() { return ret.state ? nl.t('Active') : nl.t('Inactive')};
        ret.getUtStr = function() { return _getUtStr(ret.usertype, grpid);};
        return ret;
    };

    this.getUtStrToInt = function(utStr, grpid) {
        var tn = self.get(grpid).derived.typeNameToUt;
        if (utStr in tn) return tn[utStr];
        return null;
    };
    
    this.getUtOptions = function(grpid) {
        return _getUtOptions(grpid);
    };
    
    this.getStateOptions = function(grpid) {
        return _getStateOptions(grpid);
    };
    
    this.getUserMetadata = function(userObj, grpid) {
        var metadataValues = userObj && userObj.metadata ? angular.fromJson(userObj.metadata) : {};
        var props = self.get(grpid).props || {};
        var metadataFields = props.usermetadatafields ? angular.copy(props.usermetadatafields) : [];
        for (var i=0; i< metadataFields.length; i++) {
            var f = metadataFields[i];
            f.value = f.id in metadataValues ? metadataValues[f.id] : '';
        }
        return metadataFields;
    };
    
    function _getUtIcon(ut) {
        if (!(ut in self.utIcons)) ut = self.UT_STUDENT_ADVANCED;
        return nl.url.resUrl(self.utIcons[ut]);
    }
    
    function _getUtStr(ut, grpid) {
        var props = self.get(grpid).props || {};
        var typenames = props.usertypenames || {};
        return typenames[ut] || nl.t('Unknown:{}', ut);
    }
    
    function _getUtOptions(grpid) {
        var props = self.get(grpid).props || {};
        var types = props.usertypes|| [];
        var typenames = props.usertypenames || {};
        var ret = [];
        for(var i=0; i<types.length; i++) {
            ret.push({id: types[i], name: typenames[types[i]]});
        }
        return ret;
    }

    function _getStateOptions(grpid) {
        return [{id: 1, name: 'Active'}, {id: 0, name: 'Inactive'}];
    }
    
    function _initContants() {
        self.USERNAME = 0;
        self.STATE = 1;
        self.EMAIL = 2;
        self.USERTYPE = 3;
        self.ORG_UNIT = 4;
        self.SEC_OU_LIST = 5;
        self.UPDATED = 6;
        self.CREATED = 7;
        self.FIRST_NAME = 8;
        self.LAST_NAME = 9;
        self.ISBLEEDINGEDGE = 10;
        self.PERM_OVERRIDE = 11;
        self.METADATA = 12;
        self.SUPERVISOR = 13;
        self.DOJ = 14;

        // Generic user types    
        self.UT_NITTIOADMIN=10;
        self.UT_PADMIN=11;
        
        // Group defined user types can only be >=20 (10 to 19 are reserved for system defined user types)
        self.UT_MIN_CUSTOM=20;
        self.UT_ADMIN=self.UT_MIN_CUSTOM;
        self.UT_TEACHER_APPROVER=self.UT_MIN_CUSTOM+1;
        self.UT_STUDENT=self.UT_MIN_CUSTOM+2;
        self.UT_TEACHER=self.UT_MIN_CUSTOM+3;
        self.UT_STUDENT_ADVANCED=self.UT_MIN_CUSTOM+4;
        self.UT_TERMADMIN=self.UT_MIN_CUSTOM+5;
    
        self.utIcons = {};
        self.utIcons[self.UT_STUDENT] = 'dashboard/defstudent.png';
        self.utIcons[self.UT_STUDENT_ADVANCED] = 'dashboard/defstudent.png';
        self.utIcons[self.UT_TEACHER] = 'dashboard/defteacher.png';
        self.utIcons[self.UT_TEACHER_APPROVER] = 'dashboard/defteacher.png';
        self.utIcons[self.UT_ADMIN] = 'dashboard/defadmin.png'; 
        self.utIcons[self.UT_TERMADMIN] = 'dashboard/defadmin.png';
        self.utIcons[self.UT_PADMIN] = 'dashboard/defadmin.png'; 
        self.utIcons[self.UT_NITTIOADMIN] = 'dashboard/defadmin.png';
    }

    function _updateGroupInfo(grpid) {
        var groupInfo = self.get(grpid);
        groupInfo.derived = {};
        // Update type names
        var props = groupInfo.props || {};
        var typenames = props.usertypenames || {};
        groupInfo.derived.typeNameToUt = {};
        for (var ut in typenames) {
            groupInfo.derived.typeNameToUt[typenames[ut]] = parseInt(ut);
        }
        // Update login id to user dict
        var udict = {};
        for(var uid in groupInfo.users) {
            var user = self.getUserObj(uid, grpid);
            udict[user.username] = user;
        }
        groupInfo.derived.keyToUsers = udict;
        
        // Update ou ids to ous dict
        var ouDict = {};
        _getOusAsDict(groupInfo.outree, ouDict);
        groupInfo.derived.ouDict = ouDict;
    }

    function _getOusAsDict(ouTree, ouDict) {
        for (var i=0; i<ouTree.length; i++) {
            var item = ouTree[i];
            ouDict[item.id] = item;
            if (!item.children || item.children.length == 0) continue;
            _getOusAsDict(item.children, ouDict);
        }
    }
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

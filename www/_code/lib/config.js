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
var NlGroupInfo = ['nl', 'nlServerApi', 'nlImporter', 'nlGroupCache',
function(nl, nlServerApi, nlImporter, nlGroupCache) {
    var self = this;
    
    this.get = function(grpid) {
        return _groupInfos[grpid||''] || null;
    };
    
    var _groupInfos = {};
    this.init = function(reload, grpid, clean, max) {
	    var urlParams = nl.location.search();
    	if (urlParams.oldgrpinfo) return _initOld(reload, grpid, clean, max);
    	return nlGroupCache.get(reload, grpid, max).then(function(result) {
            _groupInfos[grpid || ''] = result;
        }, function(e) {
            return e;
        });
    };

	// TODO-LATER-124: remove this code
    function _initOld(reload, grpid, clean, max) {
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

    this.formatUserNameFromObj = function(user) {
        return user.first_name + ' ' + user.last_name;
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
    
    this.getMinimalUserObj = function(user) {
        if (!user || !user.state) return null;
        var userObj = {id: user.id, email: user.email, usertype: user.usertype, 
			org_unit: user.org_unit, name: user.name, username: user.username,
			first_name: user.first_name, last_name: user.last_name};
		if (user.supervisor) userObj.supervisor = user.supervisor;
		if (user.metadata) {
	        var mdVals = angular.fromJson(user.metadata);
	        if (mdVals.meta_location) userObj.meta_location = mdVals.meta_location;
		}
		return userObj;
    };
    
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
        ret.isActive = function() { return ret.state ? true : false;};
        ret.getIcon = function() { return ret.state ? _getUtIcon(ret.usertype) : 
            nl.url.resUrl('ball-grey.png');};
        ret.getStateStr = function() { return ret.state ? nl.t('Active') : nl.t('Inactive');};
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
    
    this.getUserMetadataDict = function(userObj) {
    	if (userObj && userObj.metadataObj) return userObj.metadataObj;
        return userObj && userObj.metadata ? angular.fromJson(userObj.metadata) : {};
    };

    this.getUserMetadata = function(userObj, grpid) {
        var metadataValues = this.getUserMetadataDict(userObj);
        var props = self.get(grpid).props || {};
        var metadataFields = props.usermetadatafields ? angular.copy(props.usermetadatafields) : [];
        for (var i=0; i< metadataFields.length; i++) {
            var f = metadataFields[i];
            f.value = f.id in metadataValues ? metadataValues[f.id] : '';
        }
        return metadataFields;
    };
    
    this.getDefaultUser = function(userid, groupInfo) {
    	if (!groupInfo) groupInfo = self.get();
    	var user = {user_id: userid, name: userid, first_name: userid, 
	    	gid: groupInfo.grpid, username: nl.fmt2('{}.{}', userid, groupInfo.grpid), 
	    	email: 'NA', state: 0, usertype: '', last_name: '', org_unit: '', id:0,
	    	supervisor: '', doj: '', sec_ou_list: '', metaObj: {}, metadata:''};
	    return user;
    };
    
    this.getUserTableAttrs = function() {
    	return _userTableAttrs;
    };
    
    this.isPastUserXlsConfigured = function(groupInfo) {
    	if (!groupInfo) groupInfo = self.get();
    	return groupInfo && groupInfo.props && groupInfo.props.augmentedUserInfoXls;
    };
    
    this.fetchPastUserXls = function(groupInfo) {
    	if (!groupInfo) groupInfo = self.get();
        return nl.q(function(resolve, reject) {
        	if (!self.isPastUserXlsConfigured(groupInfo)) {
        		resolve(false);
        		return;
        	}
        	nl.http.get(groupInfo.props.augmentedUserInfoXls, {responseType: "arraybuffer"})
        	.then(function(result) {
        		var xlscfg = {singleSheet: true, toJsonConfig: {header:1}};
        		nlImporter.readXlsFromArrayBuffer(result.data, xlscfg).then(function(result2) {
        			result2 = _xlsArrayToDict(groupInfo, result2);
        			resolve(result2);
        		}, function(e) {
		        	var msg = nl.t('Error reading past users xls: {}', e||'');
		        	nlDlg.popupAlert({title: 'Error', template: msg});
        			resolve(false);
        		});
        	}, function(e) {
	        	var msg = nl.t('Error fetching past users file: {}', e.data||'');
	        	nlDlg.popupAlert({title: 'Error', template: msg});
	        	resolve(false);
        	});
        });
    };

	var _userTableAttrs = [
	    {id: 'op', name: "Operation"},
	    {id: 'username', name: "Key", optional: true},
	    {id: 'user_id', name: "User Id"},
	    {id: 'gid', name: "Group Id", optional: true},
	    {id: 'usertype', name: "User Type"},
	    {id: 'first_name', name: "First name"},
	    {id: 'last_name', name: "Last name", optional: true},
	    {id: 'email', name: "Email"},
	    {id: 'state', name: "State", optional: true},
	    {id: 'org_unit', name: "OU", oldnames: ["Class / user group"]},
	    {id: 'supervisor', name: "Supervisor", optional: true},
	    {id: 'doj', name: "Joining date", optional: true},
	    {id: 'sec_ou_list', name: "Sec OUs", oldnames: ["Secondary user groups"], optional: true},
	    {id: 'created', name: "Created UTC Time", optional: true},
	    {id: 'updated', name: "Updated UTC Time", optional: true}
	];
	
    function _xlsArrayToDict(groupInfo, xlsArray) {
    	var userDict = {};
    	if (xlsArray.length < 1) return userDict;
	    var userHeaders = _arrayToDictNameToId(_userTableAttrs);
	    var metaHeaders = _arrayToDictNameToId((groupInfo.props || {}).usermetadatafields || []);
    	var headerRow = xlsArray[0];
    	var headerInfo = [];
    	for(var i=0; i<headerRow.length; i++) {
    		if (headerRow[i] in userHeaders) headerInfo.push({type: 'user', id: userHeaders[headerRow[i]]});
    		else if (headerRow[i] in metaHeaders) headerInfo.push({type: 'meta', id: metaHeaders[headerRow[i]]});
    		else headerInfo.push({type: 'other', id: headerRow[i]});
    	}

    	for (var i=1; i<xlsArray.length; i++) {
    		var row = xlsArray[i];
    		var user = {id: 0, metadataObj: {}, others: {}};
    		for (var j=0; j<row.length; j++) {
    			var info = headerInfo[j];
    			if (info.type == 'user') user[info.id] = row[j];
    			else if (info.type == 'meta') user.metadataObj[info.id] = row[j];
    			else user.others[info.id] = row[j];
    		}
    		if (!user.user_id) continue;
	        user.id = 0;
	        user.gid = groupInfo.grpid;
	        user.username = nl.fmt2('{}.{}', user.user_id, groupInfo.grpid);
	        if (!user.last_name) user.last_name = '';
	        if (!user.first_name) user.first_name = user.user_id;
	        user.name = self.formatUserNameFromObj(user);
	        if (!user.email) user.email = 'NA';
	        if (!user.state) user.state = 0;
	        if (!user.usertype) user.usertype = '';
	        if (!user.org_unit) user.org_unit = '';
	        if (!user.supervisor) user.supervisor = '';
	        if (!user.doj) user.doj = '';
	        if (!user.sec_ou_list) user.sec_ou_list = '';
    		userDict[user.user_id] = user;
    	}
    	
    	return userDict;
    }
    
    function _arrayToDictNameToId(arrayInput) {
    	var ret = {};
    	for(var i=0; i<arrayInput.length; i++) ret[arrayInput[i].name] = arrayInput[i].id;
    	return ret;
    }
    
    //##################################################################################################
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

(function() {

//-------------------------------------------------------------------------------------------------
// group_info.js: Get group info and if needed list of user info from server
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.group_info', [])
    .service('nlGroupInfo', NlGroupInfo);
}

//-------------------------------------------------------------------------------------------------
var NlGroupInfo = ['nl', 'nlDlg', 'nlImporter', 'nlGroupCache', 'nlGroupCache4',
function(nl, nlDlg, nlImporter, nlGroupCache, nlGroupCache4) {
    var self = this;
    
    this.get = function(grpid) {
        return _groupInfos[grpid||''] || null;
    };
    
    var _myNlGroupCache = nlGroupCache;
    this.onPageEnter = function(userInfo) {
        _myNlGroupCache = nlGroupCache4.isEnabled(userInfo) ? nlGroupCache4 : nlGroupCache;
    };

    var _groupInfos = {};
    this.init1 = function() {
        // Init only group data: least time consuming
        return _initImpl(true);
    };

    this.init2 = function() {
        // Init group data and user: time consuming
        return _initImpl(false);
    };

    this.init3 = function(grpid, max) {
        // Init group data and user with forced reload of group data: for admin usecase. 
        // Slightly more time consuming than init2
        return _initImpl(false, true, grpid, max);
    };

    function _initImpl(skipUsers, reload, grpid, max) {
    	return _myNlGroupCache.get(skipUsers, reload, grpid, max).then(function(result) {
            _groupInfos[grpid || ''] = result;
        }, function(e) {
            return e;
        });
    };

    this.update = function(grpid) {
        // Update the complete ou tree without checking for restrict_ou permission
        _updateBasedonPermAndGroupfeature(null, grpid); 
    };

    this.updateRestrictedOuTree = function(_userInfo, grpid) {
        // Update only parts of tree (or complete tree) based on permission as per restrict_ou feature 
        _updateBasedonPermAndGroupfeature(_userInfo, grpid);
    };

    this.getKeyToUsers = function(groupInfo, grpid) {
        _initUsernameDict(groupInfo, grpid);
        return groupInfo.derived.keyToUsers;
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
        var users = self.getKeyToUsers(groupInfo);
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
            first_name: user.first_name, last_name: user.last_name,
            mobile: user.mobile, seclogin: user.seclogin};
		if (user.supervisor) userObj.supervisor = user.supervisor;
		if (user.metadata) {
	        var mdVals = angular.fromJson(user.metadata);
	        if (mdVals.meta_location) userObj.meta_location = mdVals.meta_location;
		}
		return userObj;
    };

    this.getCachedUserObjWithMeta = function(uid, username, pastUserInfosFetcher) {
        var strUid = '' + uid;
        var groupInfo = self.get();
        if (!groupInfo.derived.uidToUsers) groupInfo.derived.uidToUsers = {};
        var userCache = groupInfo.derived.uidToUsers;
        if (strUid in userCache) return userCache[strUid];
        var user = self.getUserObj(strUid);
        if (!user) user = pastUserInfosFetcher.getUserObj(uid, username);
        if (!user && pastUserInfosFetcher.canFetchMore()) return null;
        if (!user) user = self.getDefaultUser(username || '');
        user.metadataObj = self.getUserMetadataDict(user);
        var subOrgMapping = groupInfo.derived.orgToSubOrgMapping;
        if (subOrgMapping) user.suborg = subOrgMapping[user.org_unit];
        _updateOrgByParts(user);
        user.usertypeStr = user.getUtStr ? user.getUtStr() : '';
        var customAttrs = groupInfo.derived.customAttrs;
        user.custom = customAttrs && customAttrs[user.username] ? customAttrs[user.username] : {};
        userCache[strUid] = user;
        return user;
    };

    this.updateCustomAttrsOfCachedUsers = function(customAttrs) {
        var groupInfo = self.get();
        groupInfo.derived.customAttrs = customAttrs;
        var cnt = 0;
        for(var key in groupInfo.derived.uidToUsers) {
            var user = groupInfo.derived.uidToUsers[key];
            if (!customAttrs[user.username]) user.custom = {};
            else {
                user.custom = customAttrs[user.username];
                cnt++;
            }
        }
        return cnt;
    };

    this.getUserObj = function(uid, grpid) {
        var groupInfo = self.get(grpid);
        if (!(uid in groupInfo.users)) return null;
        var uInfo = groupInfo.users[uid];
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
            metadata: uInfo[this.METADATA] || '',
            mobile: uInfo[this.MOBILE] || '',
            seclogin: uInfo[this.SECLOGIN] || '',
        };
        ret.seclogin = ret.seclogin ? 'id:' + ret.seclogin : '';
        ret.mobile = ret.mobile ? 'm:' + ret.mobile : '';
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
        ret.stateStr = ret.state ? 'active' : 'inactive';
        return ret;
    };

    this.getOrgToSubOrgDict = function(groupInfo) {
        return groupInfo.derived.orgToSubOrgMapping;
    };

    this.isSubOrgEnabled = function(grpid) {
        if(!grpid) grpid = '';
        var groupinfo = _groupInfos[grpid]; 
        return groupinfo.isSubOrgEnabled || false;
    }

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
    
    this.getDefaultUser = function(first_name, groupInfo) {
        if (!groupInfo) groupInfo = self.get();
        first_name = (first_name || '').trim();
        var userid = first_name.toLowerCase();
        userid = userid == '' ? 'deleted' : 'deleted_' + userid;
        first_name = first_name + (first_name == '' ? '(deleted) ' : ' (deleted)');
    	var user = {user_id: userid, name: first_name, first_name: first_name, 
	    	gid: groupInfo.grpid, username: nl.fmt2('{}.{}', userid, groupInfo.grpid), 
	    	email: 'NA', state: 0, usertype: '(unknown)', last_name: '', org_unit: 'Others', id:0,
            supervisor: '', doj: '', sec_ou_list: '', metaObj: {}, metadata:'',
            mobile: '', seclogin: ''};
	    return user;
    };
    
    this.DEFAULT_REPORT_PATH = '/static/others/report-templates/';
    this.DEFAULT_CUSTOM_TEMPLATE = this.DEFAULT_REPORT_PATH + 'custom_report.xlsm?v={}';
    this.getDefaultCustomReportTemplate = function() {
        return nl.fmt2(this.DEFAULT_CUSTOM_TEMPLATE, NL_SERVER_INFO.versions.script);
    };
    
    this.getCustomReportTemplate = function(groupInfo) {
    	if (!groupInfo) groupInfo = self.get();
        if (!groupInfo || !groupInfo.props) return '';
        return groupInfo.props.customReportTemplate || '';
    };
    
    this.getPastUserInfosFetcher = function() {
        return new PastUserInfosFetcher(nl, nlDlg, nlImporter, this);
    };

    this.getUserTableHeaders = function(grpid) {
        var headers = angular.copy(_userTableAttrs);
        var metadata = this.getUserMetadata(null, grpid);
        for(var i=0; i<metadata.length; i++)
            headers.splice(_insertMetadataAt+i, 0, {id: metadata[i].id, 
                name: metadata[i].name, optional: true, metadata: true});
        return headers;
    };
    
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
        self.MOBILE = 15;
        self.SECLOGIN = 16;

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

    function _updateBasedonPermAndGroupfeature(_userInfo, grpid) {
        var groupInfo = self.get(grpid);
        groupInfo.derived = {};
        var myOuList = null;
        //filter users in ou if restrict_ous flag is enabled in group properties and to users
        // without assignment manage perm
        if (_userInfo && _userInfo.groupinfo.features.restrict_ous && 
            !_userInfo.permissions['assignment_manage']) {
            var loggedInUser = self.getUserObj(''+_userInfo.userid);
            myOuList = _getMyOuList(loggedInUser);
        }
        groupInfo.derived.myOuList = myOuList;
        
        // Update type names
        var props = groupInfo.props || {};
        var typenames = props.usertypenames || {};
        groupInfo.derived.typeNameToUt = {};
        for (var ut in typenames) {
            groupInfo.derived.typeNameToUt[typenames[ut]] = parseInt(ut);
        }
        // Update ou ids to ous dict
        var ouDict = {};
        _getOusAsDict(groupInfo.outree, ouDict);
        groupInfo.derived.ouDict = ouDict;
        _initOrgToSubOrgMapping(groupInfo);
    }

    function _initUsernameDict(groupInfo, grpid) {
        if (groupInfo.derived.keyToUsers) return;
        // Update login id to user dict
        var udict = {};
        for(var uid in groupInfo.users) {
            var uInfo = groupInfo.users[uid];
            if (!uInfo) continue;
            var org_unit = uInfo[self.ORG_UNIT] || '';
            if (_canAddUser(org_unit, groupInfo.derived.myOuList)) {
                var user = self.getUserObj(uid, grpid);
                udict[user.username] = user;
            }
        }
        groupInfo.derived.keyToUsers = udict;
    }

    function _getMyOuList(loggedInUser) {
        var myOuList = (loggedInUser.sec_ou_list || '').split(',');
        myOuList.push(loggedInUser.org_unit);
        var myOuList2 = [];
        for (var i=0; i<myOuList.length; i++) {
            var ou = myOuList[i].trim();
            if (ou.length > 0) myOuList2.push(ou);
        }
        return myOuList2;
    }

    function _canAddUser(org_unit, myOuList) {
        if (!myOuList) return true;
        for (var i=0; i<myOuList.length; i++) {
            var ou = org_unit.trim();
            var myOu = myOuList[i];
            if (ou == myOu || ou.indexOf(myOu + '.') == 0) return true;
            }
        return false;
    }

    function _getOusAsDict(ouTree, ouDict) {
        for (var i=0; i<ouTree.length; i++) {
            var item = ouTree[i];
            ouDict[item.id] = item;
            if (!item.children || item.children.length == 0) continue;
            _getOusAsDict(item.children, ouDict);
        }
    }

    function _updateOrgByParts(user) {
        var parts = (user.org_unit || '').split('.');
        for(var i=0; i < 4; i++) {
            var p = ('' + parts[i]).trim();
            if (p && p.toUpperCase) p = p.toUpperCase();
            user['ou_part' + (i+1)] = (i < parts.length) ? p : '';
        }
    }

    //##################################################################################################
    // org to suborg mapping
    //##################################################################################################
    function _initOrgToSubOrgMapping(groupInfo) {
        var orgToSubOrgMapping = {};
        groupInfo.derived.orgToSubOrgMapping = orgToSubOrgMapping;
        for(var i=0; i<groupInfo.outree.length; i++) {
            var ou = groupInfo.outree[i];
            _addSubOrgTree(ou, orgToSubOrgMapping, groupInfo);
        }
    }

    function _addSubOrgTree(ou, orgToSubOrgMapping, groupinfo) {
        var suborg = ou.suborg || 0;
        if (suborg == 1) {
            groupinfo.isSubOrgEnabled = true;
            var suborgId = _getSubOrgLastPart(ou.id);
            _addSubTreeToSubOrg(ou, suborgId, orgToSubOrgMapping);
            return;
        }
        orgToSubOrgMapping[ou.id] = 'OTHERS';
        if (!ou.children) return;
        if (suborg != 2) {
            for(var i=0; i<ou.children.length; i++)
                _addSubOrgTree(ou.children[i], orgToSubOrgMapping, groupinfo);
            return;
        }

        groupinfo.isSubOrgEnabled = true;
        for(var i=0; i<ou.children.length; i++) {
            var child = ou.children[i];
            var suborgId = _getSubOrgLastPart(child.id);
            _addSubTreeToSubOrg(child, suborgId, orgToSubOrgMapping);
        }
    }

    function _getSubOrgLastPart(subOrgId) {
        var subOrgParts = subOrgId.split('.');
        return subOrgParts[subOrgParts.length -1];
    }

    function _addSubTreeToSubOrg(ou, suborgId, orgToSubOrgMapping) {
        suborgId = ('' + suborgId).trim();
        if (suborgId && suborgId.toUpperCase) suborgId = suborgId.toUpperCase();
        orgToSubOrgMapping[ou.id] = suborgId;
        if (!ou.children) return;
        for(var i=0; i<ou.children.length; i++)
            _addSubTreeToSubOrg(ou.children[i], suborgId, orgToSubOrgMapping);
    }

    this.getTrainingParams = function() {
        var defaultTrainingParams = [
            {id: 'iltTrainerName', name: 'Trainer name', help: nl.t('Provide trainer name to this training.')},
			{id: 'iltVenue', name: 'Venue', help: nl.t('Configure venue of this training.')},
			{id: 'iltCostInfra', name: 'Infrastructure cost', help: nl.t(' Configure the infrastructure cost.'), number: true},
			{id: 'iltCostTrainer', name: 'Trainer cost', help: nl.t(' Configure the trainer cost.'), number: true},
			{id: 'iltCostFoodSta', name: 'Stationary and Food cost', help: nl.t(' Configure the stationary and food cost.'), number: true},
			{id: 'iltCostTravelAco', name: 'Travel and Accomodation cost', help: nl.t(' Configure the travel and accomodation cost.'), number: true},
			{id: 'iltCostMisc', name: 'Miscellaneous cost', help: nl.t(' Configure the miscellaneous cost.'), number: true}
        ];
        var trainingParamsOverride = ((this.get().props || {}).features || {}).training;
        // This could be undefined, null, false, true or a dict
        // If dict, it will be of form:
        // {
        //      iltTrainerName: {name: 'Trainer name', help: 'Provide trainer name to this training.'},
        //      ...
        // }
        // If a key is missing, take the default. If key is present and name is empty, remove the element.
        if (!trainingParamsOverride || typeof trainingParamsOverride !== 'object') {
            trainingParamsOverride = {};
        }
        var trainingParams = [];
        for (var i=0; i<defaultTrainingParams.length; i++) {
            var param = defaultTrainingParams[i];
            var override = trainingParamsOverride[param.id];
            if (!override) {
                trainingParams.push(param);
                continue;
            }
            if (!override.name) continue; // Ignore this element
            param.name = override.name;
            param.help = override.help || nl.t(' Configure the "{}" parameter.', param.name);
            trainingParams.push(param);
        }
        return trainingParams;
    };
}];

//-------------------------------------------------------------------------------------------------
function PastUserInfosFetcher(nl, nlDlg, nlImporter, nlGroupInfo) {
    var _groupInfo = null;
    var _isArchivedUserExist = false;
    var _pastUsersIdToObj = {};
    var _pastUsersUserIdToObj = {}; // For imported users and if buildUserIdDict is set
    var _pendingArchived = [];
    var _pendingImported = [];
    var _buildUserIdDict = false;

    // groupInfo.props.pastUserInfos is None or {archived: [url1, url2, ...], imported: [url1, ...]}
    this.init = function(groupInfo, buildUserIdDict) {
        if (buildUserIdDict) _buildUserIdDict = true;
        _groupInfo = groupInfo || nlGroupInfo.get();
        _isArchivedUserExist = false;
        _pastUsersIdToObj = {};
        _pastUsersUserIdToObj = {};
        var pastUserInfos = _groupInfo.props.pastUserInfos || {};
        _pendingArchived = pastUserInfos.archived || [];
        _pendingImported = pastUserInfos.imported || [];
    };

    this.isArchivedUserExist = function() {
        return _isArchivedUserExist;
    };

    this.getUserObj = function(uid, user_id) {
        var ret = uid ? _pastUsersIdToObj[uid] || null : null;
        if (ret) return ret;
        return user_id ? _pastUsersUserIdToObj[user_id] || null : null;
    };

    this.canFetchMore = function(archivedOnly) {
        return _pendingArchived.length > 0 || (!archivedOnly && _pendingImported.length > 0);
    };

    this.fetchNextPastUsersFile = function(archivedOnly) {
        return nl.q(function(resolve, reject) {
            _fetchNextPastUsersFile(archivedOnly, resolve);
        });
    };

    this.fetchAllPastUsersFiles = function(archivedOnly) {
        return nl.q(function(resolve, reject) {
            _fetchRestOfPastUsersFiles(archivedOnly, true, resolve);
        });
    };

    function _fetchRestOfPastUsersFiles(archivedOnly, bMore, resolve) {
        if (!bMore) return resolve(false);
        _fetchNextPastUsersFile(archivedOnly, function(bMore2) {
            _fetchRestOfPastUsersFiles(archivedOnly, bMore2, resolve);
        });
    }

    function _fetchNextPastUsersFile(archivedOnly, resolve) {
        var pendingList = _pendingArchived;
        var isArchivedList = true;
        if (pendingList.length == 0 && !archivedOnly) {
            pendingList = _pendingImported;
            isArchivedList = false;
        }
        if (pendingList.length == 0) return resolve(false);
        var fName = pendingList.shift();
        var xlscfg = {singleSheet: true, toJsonConfig: {header:1}};
        nl.http.get(fName, {responseType: "arraybuffer"})
        .then(function(result) {
            nlImporter.readXlsFromArrayBuffer(result.data, xlscfg).then(function(rows) {
                _xlsArrayToDict(rows, isArchivedList);
                return resolve(true);
            }, function(e) {
                var msg = nl.t('Error reading past users file: {}', e||'');
                nlDlg.popupAlert({title: 'Error', template: msg});
                resolve(false);
            });
        }, function(e) {
            var msg = nl.t('Error fetching past users file: {}', e.data||'');
            nlDlg.popupAlert({title: 'Error', template: msg});
            resolve(false);
        });
    }
    
    function _xlsArrayToDict(xlsArray, isArchivedList) {
    	if (xlsArray.length < 1) return;
	    var userHeaders = _arrayToDictNameToId(_userTableAttrs);
	    var metaHeaders = _arrayToDictNameToId((_groupInfo.props || {}).usermetadatafields || []);
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
            if (isArchivedList) user.archived = true;
            else user.imported = true;
            if (user.archived && !user.id) continue;
            if (user.imported && (user.user_id in _pastUsersUserIdToObj)) continue;
            _updateUserId(user);

            if (user.archived) {
                _pastUsersIdToObj[user.id] = user;
                _isArchivedUserExist = true;
            }
            if ((user.imported || _buildUserIdDict) && !(user.user_id in _pastUsersUserIdToObj))
                _pastUsersUserIdToObj[user.user_id] = user;

            user.gid = _groupInfo.grpid;
	        user.username = nl.fmt2('{}.{}', user.user_id, _groupInfo.grpid);
	        if (!user.last_name) user.last_name = '';
	        if (!user.first_name) user.first_name = user.user_id;
	        user.name = nlGroupInfo.formatUserNameFromObj(user);
	        if (!user.email) user.email = 'NA';
	        if (!user.state) user.state = 0;
	        if (!user.usertype) user.usertype = '';
	        if (!user.org_unit) user.org_unit = '';
	        if (!user.supervisor) user.supervisor = '';
	        if (!user.doj) user.doj = '';
            if (!user.sec_ou_list) user.sec_ou_list = '';
            if (!user.mobile) user.mobile = '';
            if (!user.seclogin) user.seclogin = '';
    	}
    }
    
    function _arrayToDictNameToId(arrayInput) {
    	var ret = {};
    	for(var i=0; i<arrayInput.length; i++) ret[arrayInput[i].name] = arrayInput[i].id;
    	return ret;
    }
    
    function _updateUserId(user) {
        if (user.id && user.id.indexOf('id=') == 0) user.id = user.id.substring(3);
        if (user.id) user.id = parseInt(user.id);
        else user.id = 0;
    }

}

//-------------------------------------------------------------------------------------------------
var _insertMetadataAt = 10;
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
    {id: 'mobile', name: "Mobile", optional: true},
    {id: 'seclogin', name: "Secondary Login", optional: true},
    {id: 'supervisor', name: "Supervisor", optional: true},
    {id: 'doj', name: "Joining date", optional: true},
    {id: 'sec_ou_list', name: "Sec OUs", oldnames: ["Secondary user groups"], optional: true},
    {id: 'created', name: "Created UTC Time", optional: true},
    {id: 'updated', name: "Updated UTC Time", optional: true},
    {id: 'id', name: "Internal Id", optional: true},
];

//-------------------------------------------------------------------------------------------------
module_init();
})();

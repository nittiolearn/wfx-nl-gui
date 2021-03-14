(function() {

//-------------------------------------------------------------------------------------------------
// ouuserselect.js: 
// selection of users from ou tree including filters
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.ouuserselect', [])
    .service('nlOuUserSelect', OuUserSelectSrv);
}

//-------------------------------------------------------------------------------------------------
var OuUserSelectSrv = ['nl', 'nlDlg', 'nlGroupInfo', 'nlTreeSelect',
function(nl, nlDlg, nlGroupInfo, nlTreeSelect) {
    // selectedOus is an array of Strings
    var _dontShowUsers = {};
    this.getOuTree = function(groupInfo, selectedOus, treeIsShown, multiSelect, maxDepth) {
        var ouTree = new OuTree(nl, nlDlg, nlTreeSelect);
        return ouTree.get(groupInfo, selectedOus, treeIsShown, multiSelect, maxDepth);
    };

    this.getMetadataFilterTrees = function(selectedIds, treeIsShown, userListFilter) {
        return new MetadataFilterTrees(nl, nlDlg, nlTreeSelect, nlGroupInfo, 
            selectedIds, treeIsShown, userListFilter);
    };

    this.getOuUserSelector = function(parentScope, groupInfo, selectedUsers, dontShowUsers, userListFilter) {
        _dontShowUsers = dontShowUsers;
        return new OuUserSelector(nl, nlDlg, nlGroupInfo, nlTreeSelect, this, 
            parentScope, groupInfo, selectedUsers, dontShowUsers, userListFilter);
    };

    this.getAlreadySelectedUsers = function() {
        return _dontShowUsers;        
    }

}];

//-------------------------------------------------------------------------------------------------
function OuTree(nl, nlDlg, nlTreeSelect) {
    this.get = function(groupInfo, selectedOus, treeIsShown, multiSelect, maxDepth) {
        var selectedIds = _getIdDict(selectedOus);
        var treeInfo = {data: nlTreeSelect.treeToTreeArray(groupInfo.outree || [], maxDepth)};
        nlTreeSelect.updateSelectionTree(treeInfo, selectedIds);
        treeInfo.treeIsShown = treeIsShown;
        treeInfo.multiSelect = multiSelect;
        return treeInfo;
    };
    
    function _getIdDict(selectedOus) {
        var selectedIds = {};
        for (var i=0; i<selectedOus.length; i++) {
            selectedIds[selectedOus[i].trim()] = true;
        }
        return selectedIds;
    }
}
    
//-------------------------------------------------------------------------------------------------
function MetadataFilterTrees(nl, nlDlg, nlTreeSelect, nlGroupInfo, selectedIds, treeIsShown, userListFilter) {
    var self = this;
    var _filters = [];

    function _init() {
        var groupInfo = nlGroupInfo.get();
        var users = nlGroupInfo.getKeyToUsers(groupInfo);
        for(var username in users) {
            var user = users[username];
            if (!userListFilter && !user.isActive()) continue;
            if (userListFilter && !(user.id in userListFilter)) continue;
            _updateFilterValuesFromMetadata(user);
        }
        _initFilters(selectedIds, treeIsShown);
    }

    this.getFilters = function() {
        return _filters;
    };
    
    this.initFilters = function(selectedIds, treeIsShown) {
        return _initFilters(selectedIds, treeIsShown);
    };
    
    this.getSelectedFilters = function() {
        return _getSelectedFilters();
    };
    
    this.filterTreeData = function(fullTreeData) {
        return _filterTreeData(fullTreeData);
    };
    
    var _filterValues = {};
    function _updateFilterValuesFromMetadata(user) {
        var metaFields = nlGroupInfo.getUserMetadata(user);
        for(var i=0; i<metaFields.length; i++) {
            var mf = metaFields[i];
            if (!mf.filterable || !mf.value) continue;
            if (!_filterValues[mf.id]) _filterValues[mf.id] = {mf: mf, values: {}};
            _filterValues[mf.id].values[mf.value] = true;
        }
    }
    
    function _initFilters(selectedIds, treeIsShown) {
        if (!selectedIds) selectedIds= {};
        _filters.length = 0;
        for(var mfid in _filterValues) {
            var item = _filterValues[mfid];
            if (!item.mf.filterable) continue;
            var mfTree = [];
            for(var val in item.values) mfTree.push(val);
            mfTree.sort();
            mfTree = {data: nlTreeSelect.strArrayToTreeArray(mfTree), treeIsShown: treeIsShown};
            nlTreeSelect.updateSelectionTree(mfTree, selectedIds[item.mf.id] || {});
            _filters.push({name: item.mf.name, value: mfTree, mf: item.mf});
        }
    }

    function _filterTreeData(fullTreeData) {
        var filters = _getSelectedFilters();
        if (Object.keys(filters).length == 0) {
            return fullTreeData;
        }
        var filteredTreeData = [];
        for(var i=0; i<fullTreeData.length; i++) {
            var user = fullTreeData[i].userObj;
            if (!user) {
                filteredTreeData.push(fullTreeData[i]);
                continue;
            }
            if (!_checkFilters(user, filters)) continue;
            filteredTreeData.push(fullTreeData[i]);
        }
        return filteredTreeData;
    }
    
    function _getSelectedFilters() {
        var ret = {};
        for(var i=0; i<_filters.length; i++) {
            var filterValues = nlTreeSelect.getSelectedIds(_filters[i].value);
            if (!filterValues || Object.keys(filterValues).length == 0) continue;
            ret[_filters[i].mf.id] = filterValues;
        }
        return ret;
    }
    
    function _checkFilters(user, filters) {
        var metaFields = nlGroupInfo.getUserMetadata(user);
        for(var i=0; i<metaFields.length; i++) {
            var mf = metaFields[i];
            if (!(mf.id in filters)) continue;
            var filterValues = filters[mf.id];
            var bFound = false;
            for(var filter in filterValues) {
                if (mf.value != filter) continue;
                bFound = true;
                break;
            }
            if (!bFound) return false;
        }
        return true;
    }
    
    _init();
}

//-------------------------------------------------------------------------------------------------
function OuUserSelector(nl, nlDlg, nlGroupInfo, nlTreeSelect, nlOuUserSelect,
    parentScope, groupInfo, selectedUsers, dontShowUsers, userListFilter) {
    var self = this;
    var _ouUserTree = {data: [], treeIsShown: false, showCounts: true,
        removeEmptyFolders: true, folderType: 'ou'};
    if(parentScope.singleSelect) _ouUserTree['multiSelect'] = false;
    var _fullTreeData = [];
    var _filterTrees = null;
    
    function _init() {
        var ouToUsers = _getOuToUserDict();
        _filterTrees = nlOuUserSelect.getMetadataFilterTrees({}, true, userListFilter);
        _formOuUserTree(groupInfo.outree, ouToUsers, _fullTreeData, dontShowUsers);
        _updateSelectionTree(_fullTreeData, selectedUsers);
    }
    
    this.getTreeSelect = function() {
        return _ouUserTree;
    };
    
    this.getSelectedUsers = function() {
        return nlTreeSelect.getSelectedIds(_ouUserTree);
    };
    
    this.updateSelectedIds = function(selectedUsers) {
        nlTreeSelect.updateSelectedIds(_ouUserTree, selectedUsers);
    };
    
    function _updateSelectionTree(treeData, selectedIds) {
        _ouUserTree.data = treeData;
        nlTreeSelect.updateSelectionTree(_ouUserTree, selectedIds);
        if (_filterTrees.getFilters().length > 0) {
            _ouUserTree.onFilterClick = _onFilterClick;
            _updateFilterIcon();
        }
    }

    function _updateFilterIcon() {
        var filters = _filterTrees.getSelectedFilters();
        var empty = (Object.keys(filters).length == 0);
        _ouUserTree.filterIcon = 'ion-funnel';
        _ouUserTree.filterIconTitle = 'Filters users';
        if (!empty) {
            _ouUserTree.filterIcon += ' fyellow';
            _ouUserTree.filterIconTitle = 'Some filters are applied';
        }
    }
    var filterMode = [{id: 'filter', name:nl.t('Select based on user attributes')},
        			  {id: 'userids', name:nl.t('Select based on userids')}];
    var previousFilterMode = filterMode[0];
	var manuallySelectedIdStr = '';
	
    function _onFilterClick(e) {
        e.stopImmediatePropagation();
        e.preventDefault();
        var filterDlg = nlDlg.create(parentScope);
        filterDlg.setCssClass('nl-height-max nl-width-max');   
        filterDlg.scope.ouUserTree = _ouUserTree;
        filterDlg.scope.data = {};
        filterDlg.scope.data.selectedIds = manuallySelectedIdStr;
        filterDlg.scope.data.alreadySelectedUsers = _getSelectedUsersDict();
        filterDlg.scope.options = {filterBasedOn: filterMode};
        filterDlg.scope.data.filterBasedOn = previousFilterMode;
        filterDlg.scope.filters = _filterTrees.getFilters();
        var filterButton = {text : nl.t('Apply'), onTap : function(e){
                e.stopImmediatePropagation();
                e.preventDefault();
                if(!_validateInput(filterDlg))  {
                    return;
                }
                previousFilterMode = filterDlg.scope.data.filterBasedOn;
                manuallySelectedIdStr = filterDlg.scope.data.selectedIds;
        		_onFilterApply(e, filterDlg);
        	}};
        var resetButton = {text : nl.t('Reset'), onTap : function(){
        		_onFilterReset(e, filterDlg);
        	}};
        var cancelButton = {text : nl.t('Cancel')};
        filterDlg.show('lib_ui/ouuserselect/ouuserfilter_dlg.html',
            [filterButton, resetButton], cancelButton);
    }
        
    function _getSelectedUsersDict() {
        var selectedUsers = nlOuUserSelect.getAlreadySelectedUsers();
        var selectedUsersDict = {};
        for(var key in selectedUsers) selectedUsersDict[selectedUsers[key]] = true;
        return selectedUsersDict;
    }

    function _validateInput(filterDlg) {
        if (filterDlg.scope.data.filterBasedOn.id == 'filter') return true;
        var selectedIdTemp = angular.copy(filterDlg.scope.data.selectedIds.replace(/[\s\n\r]+/g, ","));
        var alreadySelectedUsers = filterDlg.scope.data.alreadySelectedUsers;
        selectedIdTemp = selectedIdTemp.split(',');
        var manualSelectedIds = {};
        var errorArray = [];
        for(var i=0; i<selectedIdTemp.length; i++) {
            var selectedId = selectedIdTemp[i].trim();
            selectedId = selectedId.split('.')[0];
            if(selectedId in manualSelectedIds) errorArray.push({id:selectedIdTemp[i].trim(), msg:'This userid is repeated.'})
            if (selectedId) manualSelectedIds[selectedId] = true;
        }
        
        var selectedIds = {};
        var properIds = {};
        for(var i=0; i<_fullTreeData.length; i++) {
            var treeItem = _fullTreeData[i];
            if(treeItem.userObj == undefined) continue;
            var userid = treeItem.userObj.username.split('.')[0];
            if (userid in manualSelectedIds) {
                properIds[userid] = true;
                selectedIds[treeItem.id] = treeItem;
            }
        }
        for(var key in manualSelectedIds) {
            if(key in alreadySelectedUsers) {
                errorArray.push({id: key, msg: 'Assignment is already assigned to this user.'});
                continue;
            }
            if(!(key in properIds)) errorArray.push({id: key, msg: 'The user id is unknown or inactive.'});
        }
        filterDlg.scope.data.validSelectedIds = selectedIds;
        if(errorArray.length == 0) return true;

        var msg = '<div class="fsh6" style="min-width: 40vw">Error in provided userids string</div><div><ul>';
        for(var i=0; i<errorArray.length; i++) msg += nl.t('<li class="padding-mid"><span style="font-weight:bold">{} : </span><span>{}</span>', errorArray[i].id, errorArray[i].msg); 
        msg += '</ul></div>';
        nlDlg.popupAlert({title: 'Error message', template: msg});
        return false;
    }

    function _onFilterApply(e, filterDlg) {
        var selectedIds = {};

        if(filterDlg.scope.data.filterBasedOn.id == 'filter') {
	        var filteredTreeData = _filterTrees.filterTreeData(_fullTreeData);
	        for(var i=0; i<filteredTreeData.length; i++) {
	        	var treeItem = filteredTreeData[i];
	        	if(treeItem.userObj == undefined) continue;
        		selectedIds[treeItem.id] = treeItem;
	        }
		}
        if(filterDlg.scope.data.filterBasedOn.id == 'userids') selectedIds = filterDlg.scope.data.validSelectedIds;
        _updateSelectionTree(_fullTreeData, selectedIds);
        filterDlg.scope.onCloseDlg();
    }

    function _onFilterReset(e, filterDlg) {
        _filterTrees.initFilters({}, true);
    	manuallySelectedIdStr = '';
        _updateSelectionTree(_fullTreeData, {});
    }
    
    function _getOuToUserDict() {
        var ouToUsers = {};
        var users = nlGroupInfo.getKeyToUsers(groupInfo);
        for(var username in users) {
            var user = users[username];
            if (!userListFilter && !user.isActive()) continue;
            if (userListFilter && !(user.id in userListFilter)) continue;
            if (!(user.org_unit in ouToUsers)) ouToUsers[user.org_unit] = [];
            ouToUsers[user.org_unit].push(user);
        }
        return ouToUsers;
    }

    var ouIcon = 'ion-person-stalker fsh4 fyellow';
    var userIcon = 'ion-person fsh4 fgreen';
    function _formOuUserTree(outree, ouToUsers, ouUserTree, dontShowUsers) {
        for(var i=0; i<outree.length; i++) {
            var item = outree[i];
            ouUserTree.push({id: item.id, name: item.text,
                type: 'ou', icon: ouIcon, canSelect: false});
            if (item.children) _formOuUserTree(item.children, ouToUsers, ouUserTree, dontShowUsers);
            if (!(item.id in ouToUsers)) continue;
            var ouUsers = ouToUsers[item.id];
            for(var j=0; j < ouUsers.length; j++) {
                var user = ouUsers[j];
                if(user.id in dontShowUsers) continue;
                var treeItem = {id: nl.fmt2('{}.{}', item.id, user.id),
                    name: user.name, type: 'user', icon: userIcon, 
                    userObj: user};
                ouUserTree.push(treeItem);
            }
        }
    }
    
    _init();
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

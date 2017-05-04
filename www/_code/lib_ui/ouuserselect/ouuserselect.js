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
    this.getOuUserSelector = function(parentScope, groupInfo, selectedUsers, dontShowUsers) {
        return new OuUserSelector(nl, nlDlg, nlGroupInfo, nlTreeSelect, 
            parentScope, groupInfo, selectedUsers, dontShowUsers);
    };
}];

//-------------------------------------------------------------------------------------------------
function OuUserSelector(nl, nlDlg, nlGroupInfo, nlTreeSelect, 
    parentScope, groupInfo, selectedUsers, dontShowUsers) {
    var self = this;
    var _ouUserTree = {data: [], treeIsShown: false, showCounts: true,
        removeEmptyFolders: true, folderType: 'ou'};
    var _fullTreeData = [];
    var _filters = null;
    
    function _init() {
        var ouToUsers = _getOuToUserDict();
        _filters = _initFilters();
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
        _ouUserTree.data = angular.copy(treeData);
        nlTreeSelect.updateSelectionTree(_ouUserTree, selectedIds);
        if (_filters.length > 0) {
            _ouUserTree.onFilterClick = _onFilterClick;
            _updateFilterIcon();
        }
    }

    function _updateFilterIcon() {
        var filters = _getFilters();
        var empty = (Object.keys(filters).length == 0);
        _ouUserTree.filterIcon = 'ion-funnel';
        _ouUserTree.filterIconTitle = 'Filters users';
        if (!empty) {
            _ouUserTree.filterIcon += ' fyellow';
            _ouUserTree.filterIconTitle = 'Some filters are applied';
        }
    }
    
    function _onFilterClick(e) {
        e.stopImmediatePropagation();
        e.preventDefault();
        var filterDlg = nlDlg.create(parentScope);
        filterDlg.setCssClass('nl-height-max nl-width-max');   
        filterDlg.scope.ouUserTree = _ouUserTree;
        filterDlg.scope.filters = _filters;
        var filterButton = {text : nl.t('Apply'), onTap : _onFilterApply};
        var resetButton = {text : nl.t('Reset'), onTap : _onFilterReset};
        var cancelButton = {text : nl.t('Cancel')};
        filterDlg.show('lib_ui/ouuserselect/ouuserfilter_dlg.html',
            [filterButton, resetButton], cancelButton);
    }
    
    function _onFilterApply(e) {
        var filteredTreeData = _filterTreeData(_fullTreeData);
        var selectedIds = nlTreeSelect.getSelectedIds(_ouUserTree);
        _updateSelectionTree(filteredTreeData, selectedIds);
    }

    function _onFilterReset(e) {
        _filters = _initFilters();
        _onFilterApply(e);
    }
    
    function _getOuToUserDict() {
        var ouToUsers = {};
        var users = groupInfo.derived.keyToUsers || {};
        for(var username in users) {
            var user = users[username];
            if (!user.isActive()) continue;
            _updateFilterValuesFromMetadata(user);
            if (!(user.org_unit in ouToUsers)) ouToUsers[user.org_unit] = [];
            ouToUsers[user.org_unit].push(user);
        }
        return ouToUsers;
    }

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
    
    function _initFilters() {
        var filters = [];
        for(var mfid in _filterValues) {
            var item = _filterValues[mfid];
            if (!item.mf.filterable) continue;
            var mfTree = [];
            for(var val in item.values) mfTree.push(val);
            mfTree.sort();
            mfTree = {data: nlTreeSelect.strArrayToTreeArray(mfTree)};
            nlTreeSelect.updateSelectionTree(mfTree, {});
            filters.push({name: item.mf.name, value: mfTree, mf: item.mf});
        }
        return filters;
    }

    function _getFilters() {
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
    
    function _filterTreeData(fullTreeData) {
        var filters = _getFilters();
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
    
    _init();
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

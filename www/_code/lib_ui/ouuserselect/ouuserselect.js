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
    this.getOuUserSelector = function(parentScope, groupInfo, dontShowUsers) {
        return new OuUserSelector(nl, nlDlg, nlGroupInfo, nlTreeSelect, 
            parentScope, groupInfo, dontShowUsers);
    };
}];

//-------------------------------------------------------------------------------------------------
function OuUserSelector(nl, nlDlg, nlGroupInfo, nlTreeSelect, 
    parentScope, groupInfo, dontShowUsers) {
    var self = this;
    var _ouUserTree = {data: []};
    var _fullTreeData = [];
    var _filters = null;
    
    function _init() {
        var ouToUsers = _getOuToUserDict();
        _filters = _initFilters();
        _filters = []; // TODO-MUNNI-NOW - remove to enable filters
        _formOuUserTree(groupInfo.outree, ouToUsers, _ouUserTree.data, dontShowUsers);
        nlTreeSelect.updateSelectionTree(_ouUserTree, {});

        _ouUserTree.treeIsShown = false;
        if (_filters.length > 0) {
            _ouUserTree.onFilterClick = _onFilterClick;
            _ouUserTree.filterIcon = _getFilterIcon();
        }
        _fullTreeData = _ouUserTree.data;
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
    
    function _getFilterIcon() {
        return 'ion-funnel fyellow';
    }
    
    function _onFilterClick(e) {
        e.stopImmediatePropagation();
        e.preventDefault();
        var filterDlg = nlDlg.create(parentScope);
        filterDlg.setCssClass('nl-height-max nl-width-max');   
        filterDlg.scope.ouUserTree = _ouUserTree;
        filterDlg.scope.filters = _filters;
        
        var filterButton = {text : nl.t('Apply'), onTap : function(e) {
            _filterTreeData();
        }};

        var resetButton = {text : nl.t('Reset'), onTap : function(e) {
            _filters = _initFilters();
            filterDlg.scope.filters = _filters;
            _filterTreeData();
        }};

        var cancelButton = {text : nl.t('Cancel')};
        filterDlg.show('lib_ui/ouuserselect/ouuserfilter_dlg.html',
            [filterButton, resetButton], cancelButton);
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
    
    function _filterTreeData() {
        var filters = _getFilters();
        if (Object.keys(filters).length == 0) {
            _ouUserTree.data = _fullTreeData;
            return;
        }
        var filteredTreeData = [];
        for(var i=0; i<_fullTreeData.length; i++) {
            var user = _fullTreeData[i].userObj;
            if (!user) {
                filteredTreeData.push(_fullTreeData[i]);
                continue;
            }
            if (!_checkFilters(user, filters)) continue;
            filteredTreeData.push(_fullTreeData[i]);
        }
        _ouUserTree.data = filteredTreeData;
    }
    
    _init();
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

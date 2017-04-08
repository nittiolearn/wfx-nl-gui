(function() {

//-------------------------------------------------------------------------------------------------
// treeselect.js: 
// selection box from a tree
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.treeselect', [])
    .service('nlTreeSelect', TreeSelectSrv)
    .directive('nlTreeSelect', TreeSelectDirective);
}

//-------------------------------------------------------------------------------------------------
var TreeSelectSrv = ['nl',
function(nl) {
    this.strArrayToTreeArray = function(strArray) {
        var insertedKeys = {};
        var treeArray = [];
        for(var i=0; i<strArray.length; i++) {
            var itemId = strArray[i];
            _insertParentAndItem(itemId, treeArray, insertedKeys);
        }
        return treeArray;
    };
    
    this.treeToTreeArray = function(tree) {
        var treeArray = [];
        _treeToTreeArray(tree, treeArray);
        return treeArray;
    };

    this.updateSelectionTree = function(treeSelectInfo, selectedIds) {
        var itemDict = {};
        var treeList = treeSelectInfo.data;
        treeSelectInfo.rootItems = {};
        for(var i=0; i<treeList.length; i++) {
            var item = treeList[i];
            itemDict[item.id] = item;
            item.pos = i;
            var idParts = item.id.split('.');
            if (!item.name) item.name = idParts[idParts.length -1];
            if (!('canSelect' in item)) item.canSelect = true;
            item.indentation = idParts.length - 1;
            item.isVisible = (item.indentation < 1);
            item.isOpen = false;
            item.isFolder = false;
            item.selected = (selectedIds && selectedIds[item.id]) ? true : false;
            idParts.pop();
            var parentId = idParts.join('.');
            if (parentId) {
                var parent = itemDict[parentId];
                parent.isFolder = true;
                if (!('children' in parent)) parent.children = {};
                parent.children[item.id] = item;
            } else {
                treeSelectInfo.rootItems[item.id] = item;
            }
        }
        treeSelectInfo.treeIsShown = true;
        treeSelectInfo.multiSelect = true;
        treeSelectInfo.selectedIds = {};
        if (selectedIds)
            for(var key in selectedIds)
                treeSelectInfo.selectedIds[key] = itemDict[key];
        treeSelectInfo.itemDict = itemDict;

        _updateAllFoldersStatus(treeSelectInfo.rootItems);
        _updateVisibleData(treeSelectInfo);
        _updateSelectionText(treeSelectInfo);
    };

    this.getSelectedIds = function(treeSelectInfo) {
        return treeSelectInfo.selectedIds;
    };
    
    // Mainly for the directive usage
    this.toggleFolder = function(folder, treeSelectInfo) {
        var treeList = treeSelectInfo.data;
        folder.isOpen = !folder.isOpen;
        if (folder.isOpen) _showAllChildren(folder);
        else _hideAllDecendants(folder, treeSelectInfo);
        _updateVisibleData(treeSelectInfo);
    };

    this.toggleSelection = function(curItem, treeSelectInfo) {
        if (!curItem.canSelect) return;
        if (!treeSelectInfo.multiSelect && !curItem.selected) {
            for(var key in treeSelectInfo.selectedIds) {
                var item = treeSelectInfo.selectedIds[key];
                _unselectItem(item, treeSelectInfo);
            }
        }
        if (!curItem.selected)
            _selectItem(curItem, treeSelectInfo);
        else
            _unselectItem(curItem, treeSelectInfo);
    };
    
    this.toggleSelectionOfFolder = function(folder, treeSelectInfo) {
        if (!treeSelectInfo.multiSelect) return;
        _updateSubTreeStatus(!folder.selected, folder, treeSelectInfo);
        _updateStatusAndCaccadeToParents(_getParentId(folder.id), treeSelectInfo);
        _updateSelectionText(treeSelectInfo);
    };

    function _updateVisibleData(treeSelectInfo) {
        treeSelectInfo.visibleData = [];
        for(var i=0; i<treeSelectInfo.data.length; i++) {
            var item = treeSelectInfo.data[i];
            if (item.isVisible) treeSelectInfo.visibleData.push(item);
        }
    };
    
    function _showAllChildren(folder) {
        if (!folder.children) return;
        for(var key in folder.children) {
            var child = folder.children[key];
            child.isVisible = true;
            if (child.isFolder) child.isOpen = false;
        }
    }
    
    function _hideAllDecendants(folder) {
        if (!folder.children) return;
        for(var key in folder.children) {
            var child = folder.children[key];
            child.isVisible = false;
            if (child.isFolder) child.isOpen = false;
            _hideAllDecendants(child);
        }
    }

    function _selectItem(curItem, treeSelectInfo) {
        curItem.selected = true;
        treeSelectInfo.selectedIds[curItem.id] = curItem;
        _updateStatusAndCaccadeToParents(_getParentId(curItem.id), treeSelectInfo);
        _updateSelectionText(treeSelectInfo);
    }
    
    function _unselectItem(curItem, treeSelectInfo) {
        curItem.selected = false;
        delete treeSelectInfo.selectedIds[curItem.id];
        _updateStatusAndCaccadeToParents(_getParentId(curItem.id), treeSelectInfo);
        _updateSelectionText(treeSelectInfo);
    }

    function _updateStatusAndCaccadeToParents(itemId, treeSelectInfo) {
        if (!itemId) return;
        var folder = treeSelectInfo.itemDict[itemId];
        if (!folder || !folder.children) return;
        
        var keys = Object.keys(folder.children);
        var selectedCount = 0;
        var childPartSelected = false;
        for (var key in folder.children)
            if (folder.children[key].selected === true) selectedCount++;
            else if (folder.children[key].selected === 'part') childPartSelected = true;
            
            
        if (selectedCount == 0 && !childPartSelected) folder.selected = false;
        else if (selectedCount < keys.length) folder.selected = 'part';
        else folder.selected = true;
        _updateStatusAndCaccadeToParents(_getParentId(folder.id), treeSelectInfo);
    }

    function _updateSubTreeStatus(selected, item, treeSelectInfo) {
        item.selected = selected;
        if (!item.isFolder) {
            if (!item.canSelect)
                item.selected = false;
            else if (selected)
                treeSelectInfo.selectedIds[item.id] = item;
            else
                delete treeSelectInfo.selectedIds[item.id];
        }
        if (!item.children) return;
        var keys = Object.keys(item.children);
        for (var key in item.children)
            _updateSubTreeStatus(selected, item.children[key], treeSelectInfo);
    }
        
    function _updateAllFoldersStatus(items) {
        for (var key in items) {
            var item = items[key];
            if (!item.children) continue;
            _updateAllFoldersStatus(item.children);
            var selectedCount = 0;
            var childPartSelected = false;
            for (var key in item.children)
                if (item.children[key].selected === true) selectedCount++;
                else if (item.children[key].selected === 'part') childPartSelected = true;
            var keys = Object.keys(item.children);
            if (selectedCount == 0 && !childPartSelected) item.selected = false;
            else if (selectedCount < keys.length) item.selected = 'part';
            else item.selected = true;
        }
    }
    
    function _updateSelectionText(treeSelectInfo) {
        treeSelectInfo.selectedText = '';
        var keys = Object.keys(treeSelectInfo.selectedIds);
        var count = keys.length;
        var dispText = '';
        var sep = '';
        for (var i=0; i<50 && i<count; i++) {
            dispText += sep + treeSelectInfo.selectedIds[keys[i]].name;
            sep = ', ';
        }
        if (count > 1) dispText = nl.t('{} selected: {}', count, dispText);
        treeSelectInfo.selectedText = dispText;
    }
    
    function _isDecendantOf(item, folder) {
        if (item.id == folder.id) return false;
        return (item.id.indexOf(folder.id) == 0);
    }
    
    function _treeToTreeArray(tree, treeArray) {
        for(var i=0; i<tree.length; i++) {
            var item = tree[i];
            treeArray.push({id: item.id});
            if (!item.children || item.children.length == 0) continue;
            _treeToTreeArray(item.children, treeArray);
        }
    }
    
    function _insertParentAndItem(itemId, treeArray, insertedKeys) {
        if (itemId in insertedKeys) return;
        insertedKeys[itemId] = true;
        var parentId = _getParentId(itemId);
        if (parentId) 
            _insertParentAndItem(parentId, treeArray, insertedKeys);
        treeArray.push({id: itemId});
    }
    
    function _getParentId(itemId) {
        var idParts = itemId.split('.');
        idParts.pop();
        return idParts.join('.');
    }
}];

//-------------------------------------------------------------------------------------------------
var TreeSelectDirective = ['nl', 'nlDlg', 'nlTreeSelect',
function(nl, nlDlg, nlTreeSelect) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'lib_ui/treeselect/treeselect.html',
        scope: {
            info: '=' // dict with array of: {id, name, indentation, isVisisble, isFolder, isOpen, selected} 
        },
        link: function($scope, iElem, iAttrs) {
            $scope.onClick = function(item, e) {
                if (item.isFolder) {
                    nlTreeSelect.toggleFolder(item, $scope.info);
                } else {
                    nlTreeSelect.toggleSelection(item, $scope.info);
                }
            };
            $scope.onCheckBoxSelect = function(item, e) {
                if (!item.isFolder || !$scope.info.multiSelect) return;
                e.stopImmediatePropagation();
                e.preventDefault();
                nlTreeSelect.toggleSelectionOfFolder(item, $scope.info);
            };
        }
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

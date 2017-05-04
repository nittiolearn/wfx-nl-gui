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
        _fillDefaut(treeSelectInfo, 'onFilterClick', null);
        _fillDefaut(treeSelectInfo, 'filterIcon', '');
        _fillDefaut(treeSelectInfo, 'filterIconTitle', 'Filter');
        _fillDefaut(treeSelectInfo, 'treeIsShown', true);
        _fillDefaut(treeSelectInfo, 'showCounts', false);
        _fillDefaut(treeSelectInfo, 'multiSelect', true);
        _fillDefaut(treeSelectInfo, 'removeEmptyFolders', false);
        _fillDefaut(treeSelectInfo, 'folderType', 'NOT_DEFINED');

        treeSelectInfo.selectedIds = {};
        if (selectedIds)
            for(var key in selectedIds)
                if (key in itemDict)
                    treeSelectInfo.selectedIds[key] = itemDict[key];
        treeSelectInfo.itemDict = itemDict;
        
        if (treeSelectInfo.removeEmptyFolders && treeSelectInfo.folderType)
            _removeEmptyItemsOfType(treeSelectInfo);

        _updateAllFoldersStatusAndCounts(treeSelectInfo.rootItems);
        _updateVisibleData(treeSelectInfo);
        _updateSelectionText(treeSelectInfo);
    };

    this.updateSelectedIds = function(treeSelectInfo, selectedIds) {
        treeSelectInfo.selectedIds = {};
        var itemDict = treeSelectInfo.itemDict;
        for(var key in itemDict) {
            var item = itemDict[key];
            item.selected = (key in selectedIds);
            if (item.selected) treeSelectInfo.selectedIds[key] = item;
        }
        _updateAllFoldersStatusAndCounts(treeSelectInfo.rootItems);
        _updateSelectionText(treeSelectInfo);
    };
    
    this.getSelectedIds = function(treeSelectInfo) {
        var ret = {};
        // Semi deep copy
        for(var key in treeSelectInfo.selectedIds)
            ret[key] = treeSelectInfo.selectedIds[key];
        return ret;
    };
    
    function _fillDefaut(obj, attr, defVal) {
        if (!(attr in obj)) obj[attr] = defVal;
    }
    
    function _removeEmptyItemsOfType(treeSelectInfo) {
        treeSelectInfo.rootItems = _removeEmptyItemsInDicsts(treeSelectInfo, 
            treeSelectInfo.rootItems, treeSelectInfo.folderType);
        var items = [];
        for(var i=0; i<treeSelectInfo.data.length; i++) {
            if (!(treeSelectInfo.data[i].id in treeSelectInfo.itemDict)) continue;
            items.push(treeSelectInfo.data[i]);
        }
        treeSelectInfo.data = items;
    }
    function _removeEmptyItemsInDicsts(treeSelectInfo, items, itemType) {
        var ret = {};
        for(var key in items) {
            var item = items[key];
            var empty = false;
            if (item.type === itemType) {
                if (item.children) 
                    item.children = _removeEmptyItemsInDicsts(treeSelectInfo, item.children, itemType);
                if (!item.children || Object.keys(item.children).length == 0)
                    empty = true;
            }
            if (empty)
                delete treeSelectInfo.itemDict[item.id];
            else
                ret[item.id] = item;
        }
        return ret;
    }

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
        _updateAllFoldersStatusAndCounts(treeSelectInfo.rootItems);
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
        _updateAllFoldersStatusAndCounts(treeSelectInfo.rootItems);
        _updateSelectionText(treeSelectInfo);
    }
    
    function _unselectItem(curItem, treeSelectInfo) {
        curItem.selected = false;
        delete treeSelectInfo.selectedIds[curItem.id];
        _updateAllFoldersStatusAndCounts(treeSelectInfo.rootItems);
        _updateSelectionText(treeSelectInfo);
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
        for (var key in item.children)
            _updateSubTreeStatus(selected, item.children[key], treeSelectInfo);
    }
        
    function _updateAllFoldersStatusAndCounts(items) {
        for (var key in items) {
            var item = items[key];
            if (!item.children) continue;
            _updateAllFoldersStatusAndCounts(item.children);
            item.childCount = 0;
            item.selectedCount = 0;
            for (var key1 in item.children) {
                var child = item.children[key1];
                item.childCount += child.isFolder ? child.childCount : 1;
                item.selectedCount += child.isFolder ? child.selectedCount : (child.selected ? 1 : 0);
            }
            item.selected = item.selectedCount == 0 ? false 
                : (item.selectedCount == item.childCount ? true : 'part');
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

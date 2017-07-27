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
	var self = this;
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
        _fillDefaut(treeSelectInfo, 'onSelectChange', null);
        _fillDefaut(treeSelectInfo, 'onFilterClick', null);
        _fillDefaut(treeSelectInfo, 'filterIcon', '');
        _fillDefaut(treeSelectInfo, 'filterIconTitle', 'Filter');
        _fillDefaut(treeSelectInfo, 'treeIsShown', true);
        _fillDefaut(treeSelectInfo, 'showCounts', false);
        _fillDefaut(treeSelectInfo, 'multiSelect', true);
        _fillDefaut(treeSelectInfo, 'showSearchField', false);
        _fillDefaut(treeSelectInfo, 'searchText', '');
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

    function _updateCurrentItem(treeSelectInfo, newPos) {
		if (newPos >= treeSelectInfo.visibleData.length || newPos < 0) return false; 
    	treeSelectInfo.currentItemPos = newPos;
		if (treeSelectInfo.multiSelect) return false;
		var item = treeSelectInfo.visibleData[treeSelectInfo.currentItemPos];
		if (item.isFolder || !item.canSelect ||item.selected) return false;
		self.toggleSelection(item, treeSelectInfo);
		return true;
    }
    
    this.onKeydown = function(e, treeSelectInfo) {
		if(e.which === 40) { // down arrow
			treeSelectInfo.treeIsShown = true;
			return _updateCurrentItem(treeSelectInfo, treeSelectInfo.currentItemPos+1);
		} else if(e.which === 35) { // end
			treeSelectInfo.treeIsShown = true;
			return _updateCurrentItem(treeSelectInfo, treeSelectInfo.visibleData.length-1);
		} else if(e.which === 38) { // up arrow
			if (treeSelectInfo.currentItemPos > 0) return _updateCurrentItem(treeSelectInfo, treeSelectInfo.currentItemPos-1);
			treeSelectInfo.currentItemPos = -1;
			treeSelectInfo.treeIsShown = false;
			return false;
		} else if(e.which === 36) { // home
			if (treeSelectInfo.currentItemPos > 0) return _updateCurrentItem(treeSelectInfo, 0);
			return false;
		} else if(e.which === 39) { // right arrow
			if (treeSelectInfo.currentItemPos < 0) return false;
			var item = treeSelectInfo.visibleData[treeSelectInfo.currentItemPos];
			if(!item.isFolder || item.isOpen) return false;
			this.toggleFolder(item, treeSelectInfo);
			return false;
		} else if(e.which === 37) { // left arrow
			if (treeSelectInfo.currentItemPos < 0) return false;
			var item = treeSelectInfo.visibleData[treeSelectInfo.currentItemPos];
			if(item.isFolder) {
				if (item.isOpen) this.toggleFolder(item, treeSelectInfo);
				return false;
			}
			var parentId = _getParentId(item.id);
			var parent = treeSelectInfo.itemDict[parentId];
			if (!parent) return false;
			this.toggleFolder(parent, treeSelectInfo);
			_setCurrentItemPos(treeSelectInfo, parent);
			return false;
		} else if(e.which === 13) { // enter button
			if (treeSelectInfo.currentItemPos < 0) {
				treeSelectInfo.treeIsShown = true;
				return _updateCurrentItem(treeSelectInfo, 0);
			}
			var item = treeSelectInfo.visibleData[treeSelectInfo.currentItemPos];
			if (item.isFolder) this.toggleSelectionOfFolder(item, treeSelectInfo);
            else this.toggleSelection(item, treeSelectInfo);
            return true;
		} else if(e.which === 9) {
			treeSelectInfo.treeIsShown = false;
            return true;
		}
        return false;
    };

	function _setCurrentItemPos(treeSelectInfo, currentItem) {
		for(var i=0; i<treeSelectInfo.visibleData.length; i++) {
			var item = treeSelectInfo.visibleData[i];
			if(item.id === currentItem.id) {
				treeSelectInfo.currentItemPos = i;
				break;
			}					
		}
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
        _updateAllFoldersStatusAndCounts(treeSelectInfo.rootItems);
        _updateSelectionText(treeSelectInfo);
    };

	this.updateVisibleData = function(treeSelectInfo) {
		_updateVisibleData(treeSelectInfo);
	};
	
    function _updateVisibleData(treeSelectInfo) {
        treeSelectInfo.visibleData = [];
        var folderDict = {};
        var searchText = treeSelectInfo.searchText.toLowerCase();

        for(var i=0; i<treeSelectInfo.data.length; i++) {
            var item = treeSelectInfo.data[i];
            if (!item.isVisible) continue;
            if (treeSelectInfo.searchText == "") {
            	treeSelectInfo.visibleData.push(item);
            	continue;
	        }
	        var name = item.name.toLowerCase();
            if(name.indexOf(searchText) == -1) continue;
    		treeSelectInfo.visibleData.push(item);

        	if(item.isFolder) folderDict[item.id] = true;
        	else _makeParentVisible(treeSelectInfo, item, folderDict);
        }
        if (treeSelectInfo.currentItemPos == undefined) treeSelectInfo.currentItemPos = -1;
        if (treeSelectInfo.currentItemPos >= treeSelectInfo.visibleData.length) treeSelectInfo.currentItemPos = -1;
    };

    function _makeParentVisible(treeSelectInfo, item, folderDict) {
		var parentId = _getParentId(item.id);
		if (!parentId || parentId in folderDict) return;
    	folderDict[parentId] = true;
		var parent = treeSelectInfo.itemDict[parentId];
		treeSelectInfo.visibleData.push(parent);
		_makeParentVisible(treeSelectInfo, parent, folderDict);
    }
    
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
        	var searchField = iElem[0].querySelector('.searchField');
        	var previousSelectedText = null;
            $scope.onClick = function(item, e, pos) {
            	$scope.info.currentItemPos = pos;
                if (item.isFolder) {
                    nlTreeSelect.toggleFolder(item, $scope.info);
                } else {
                    nlTreeSelect.toggleSelection(item, $scope.info);
                    if($scope.info.onSelectChange) $scope.info.onSelectChange();
                }
            };
            
            $scope.onKeydown = function(e) {
                if(!$scope.info.treeIsShown && (_isPrintableChar(e.keyCode) || e.keyCode == 40)) {
					nl.timeout(function() {
						searchField.focus();
					});
					if (e.keyCode != 40) $scope.info.searchText = e.key;
					$scope.info.treeIsShown = true;
	            	nlTreeSelect.updateVisibleData($scope.info);
            	}
            	if (nlTreeSelect.onKeydown(e, $scope.info)) {
	                if($scope.info.onSelectChange) $scope.info.onSelectChange();
	            }
           	};
           	
           	function _isPrintableChar(keycode) {
				var ret = 
					(keycode > 64 && keycode < 91)   || // letter keys
					(keycode > 47 && keycode < 58)   || // number keys
					(keycode > 95 && keycode < 112)  || // numpad keys
					keycode == 32					 || // spacebar
					(keycode > 185 && keycode < 193) || // ;=,-./` (in order)
					(keycode > 218 && keycode < 223);   // [\]' (in order)
				return ret;
           	}
            
            $scope.onCheckBoxSelect = function(item, e) {
                if (!item.isFolder || !$scope.info.multiSelect) return;
                e.stopImmediatePropagation();
                e.preventDefault();
                nlTreeSelect.toggleSelectionOfFolder(item, $scope.info);
            };
            
            $scope.onSearchTextChange = function(e) {
            	$scope.info.currentItemPos = 0;
            	nlTreeSelect.updateVisibleData($scope.info);
            };
        }
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

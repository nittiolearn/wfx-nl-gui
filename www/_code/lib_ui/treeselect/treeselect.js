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

    this.updateSelectionTree = function(treeSelectInfo, selectedIds, openUptoLevel, canSelectFolder) {
    	if (!openUptoLevel || openUptoLevel < 1) openUptoLevel = 1;
        var itemDict = {};
        var canSelectFolder = canSelectFolder || false;
        var treeList = treeSelectInfo.data;
        treeSelectInfo.rootItems = {};
        for(var i=0; i<treeList.length; i++) {
            var item = treeList[i];
            itemDict[item.id] = item;
            var idParts = item.id.split('.');
            if (!item.name) item.name = idParts[idParts.length -1];
            if (!('canSelect' in item)) item.canSelect = true;
            item.indentation = idParts.length - 1;
            item.isVisible = (item.indentation < openUptoLevel);
            item.isSearchVisible = true;
            item.isOpen = false;
            item.isFolder = false;
            item.selected = (selectedIds && selectedIds[item.id]) ? true : false;
            idParts.pop();
            var parentId = idParts.join('.');
            if (parentId && itemDict[parentId]) {
                var parent = itemDict[parentId];
                parent.isFolder = true;
                if (!('children' in parent)) parent.children = {};
                parent.children[item.id] = item;
            } else {
                treeSelectInfo.rootItems[item.id] = item;
            }
        }
        treeSelectInfo.showSearchField = treeList.length > 6 ? true : false;
        _fillDefaut(treeSelectInfo, 'fieldmodelid', null);
        _fillDefaut(treeSelectInfo, 'onSelectChange', null);
        _fillDefaut(treeSelectInfo, 'onFilterClick', null);
        _fillDefaut(treeSelectInfo, 'filterIcon', '');
        _fillDefaut(treeSelectInfo, 'filterIconTitle', 'Filter');
        _fillDefaut(treeSelectInfo, 'treeIsShown', true);
        _fillDefaut(treeSelectInfo, 'showCounts', false);
        _fillDefaut(treeSelectInfo, 'multiSelect', true);
        _fillDefaut(treeSelectInfo, 'canSelectFolder', canSelectFolder);
        _fillDefaut(treeSelectInfo, 'searchText', '');
        _fillDefaut(treeSelectInfo, 'removeEmptyFolders', false);
        _fillDefaut(treeSelectInfo, 'sortLeafNodes', true);
        _fillDefaut(treeSelectInfo, 'folderType', 'NOT_DEFINED');

        treeSelectInfo.selectedIds = {};
        if (selectedIds)
            for(var key in selectedIds)
                if (key in itemDict)
                    treeSelectInfo.selectedIds[key] = itemDict[key];
        treeSelectInfo.itemDict = itemDict;
        
        if (treeSelectInfo.removeEmptyFolders && treeSelectInfo.folderType)
            _removeEmptyItemsOfType(treeSelectInfo);

        _updateAllFoldersStatusAndCounts(treeSelectInfo.rootItems, treeSelectInfo);
        _updateVisibleData(treeSelectInfo);
        _updateSelectionText(treeSelectInfo);
		var sortedTreeList = [];
		var childElemList = [];
		var lastindentation = null;
		var parentid = '';
		for(var i=0; i<treeSelectInfo.data.length+1; i++) {
			var elem = treeSelectInfo.data[i] || {isFolder: true};
			if(!elem.isFolder && elem.id.indexOf(parentid) >= 0) {
				childElemList.push(elem);
			} else {
				if(childElemList.length > 0 && treeSelectInfo.sortLeafNodes) {
					childElemList.sort(function(a, b) {
						if(b.name.toLowerCase() < a.name.toLowerCase()) return 1;
						if(b.name.toLowerCase() > a.name.toLowerCase()) return -1;
						if(b.name.toLowerCase() == a.name.toLowerCase()) return 0;
					});
				}
				sortedTreeList = sortedTreeList.concat(childElemList);
				childElemList = [];					
				if(!elem.isFolder) {
					childElemList.push(elem);
				}
				if(i<treeSelectInfo.data.length && elem.isFolder) {
					parentid = elem.id;
					sortedTreeList.push(elem);
				}
			}
		}
		treeSelectInfo.data = sortedTreeList;
    };

    this.updateSelectedIds = function(treeSelectInfo, selectedIds) {
        treeSelectInfo.selectedIds = {};
        var itemDict = treeSelectInfo.itemDict;
        for(var key in itemDict) {
            var item = itemDict[key];
            item.selected = (key in selectedIds);
            if (item.selected) treeSelectInfo.selectedIds[key] = item;
        }
        _updateAllFoldersStatusAndCounts(treeSelectInfo.rootItems, treeSelectInfo);
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
    
    var _known = {13:true, 35:true, 36:true, 37:true, 38:true, 39:true, 40:true};
    this.onKeydown = function(e, treeSelectInfo) {
    	if (e.which in _known) {
	        e.stopImmediatePropagation();
	        e.preventDefault();
    	}

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
			if (!treeSelectInfo.treeIsShown) {
				treeSelectInfo.treeIsShown = true;
				if (treeSelectInfo.currentItemPos < 0) return _updateCurrentItem(treeSelectInfo, 0);
				return false;
			}
	        if (!treeSelectInfo.multiSelect && !treeSelectInfo.canSelectFolder) {
				treeSelectInfo.treeIsShown = false;
	        	return false;
	        }
			var item = treeSelectInfo.visibleData[treeSelectInfo.currentItemPos];
			if (item.isFolder) this.toggleSelectionOfFolder(item, treeSelectInfo);
            else this.toggleSelection(item, treeSelectInfo);
            return true;
		} else if(e.which === 9) { // Tab/shift-tab
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
        if (!treeSelectInfo.multiSelect && (!curItem.selected || curItem.selected == 'part')) {
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
        if (!treeSelectInfo.multiSelect && !treeSelectInfo.canSelectFolder) return;
        if (treeSelectInfo.canSelectFolder) {
			this.toggleSelection(folder, treeSelectInfo);
        } else {
	        _updateSubTreeStatus(!folder.selected, folder, treeSelectInfo);
	        _updateAllFoldersStatusAndCounts(treeSelectInfo.rootItems, treeSelectInfo);
	        _updateSelectionText(treeSelectInfo);        	
		}
    };

	this.updateSearchVisible = function(treeSelectInfo) {
		_updateSearchVisible(treeSelectInfo);
	};
	
	this.selectDeslectNodes = function(treeSelectInfo, bSelect) {
		for(var i=0; i<treeSelectInfo.data.length; i++) {
			var item = treeSelectInfo.data[i];
			if (item.isFolder || !item.isSearchVisible) continue;
			item.selected = bSelect;
			if (bSelect) treeSelectInfo.selectedIds[item.id] = item;
			else if (item.id in treeSelectInfo.selectedIds) delete treeSelectInfo.selectedIds[item.id];
		}
        _updateAllFoldersStatusAndCounts(treeSelectInfo.rootItems, treeSelectInfo);
        _updateSelectionText(treeSelectInfo);
	};

    function _updateVisibleData(treeSelectInfo) {
        treeSelectInfo.visibleData = [];
        for(var i=0; i<treeSelectInfo.data.length; i++) {
            var item = treeSelectInfo.data[i];
        	if(!item.isVisible || !item.isSearchVisible) continue;
        	treeSelectInfo.visibleData.push(item);
        }
        if (treeSelectInfo.currentItemPos == undefined) treeSelectInfo.currentItemPos = -1;
        if (treeSelectInfo.currentItemPos >= treeSelectInfo.visibleData.length) treeSelectInfo.currentItemPos = -1;
        _updateAllFoldersStatusAndCounts(treeSelectInfo.rootItems, treeSelectInfo);
        _updateSelectionText(treeSelectInfo);
    }
    
    function _updateSearchVisible(treeSelectInfo) {
        var searchText = treeSelectInfo.searchText.toLowerCase();
        for(var i=0; i<treeSelectInfo.data.length; i++) {
            var item = treeSelectInfo.data[i];
            if (searchText == "") {
            	item.isSearchVisible = true;
            	continue;
	        }

	        item.isSearchVisible = false; // Will be set to true when matched
        	// Will be made true later if child is searchVisible
        	if(item.isFolder) continue;
	        var name = item.name.toLowerCase();
            if(name.indexOf(searchText) == -1) continue;
        	_makeParentVisible(treeSelectInfo, item);
			item.isSearchVisible = true;
        }
        _updateVisibleData(treeSelectInfo);
    }

    function _makeParentVisible(treeSelectInfo, item) {
		var parentId = _getParentId(item.id);
		var parent = treeSelectInfo.itemDict[parentId];
		if (!parent) return;
		parent.isSearchVisible = true;
		_makeParentVisible(treeSelectInfo, parent);
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
        _updateAllFoldersStatusAndCounts(treeSelectInfo.rootItems, treeSelectInfo);
        _updateSelectionText(treeSelectInfo);
    }
    
    function _unselectItem(curItem, treeSelectInfo) {
        curItem.selected = false;
        delete treeSelectInfo.selectedIds[curItem.id];
        _updateAllFoldersStatusAndCounts(treeSelectInfo.rootItems, treeSelectInfo);
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
        
    function _updateAllFoldersStatusAndCounts(items, treeSelectInfo) {
        for (var key in items) {
            var item = items[key];
            if (!item.children) continue;
            _updateAllFoldersStatusAndCounts(item.children, treeSelectInfo);
            item.childCount = 0;
            item.selectedCount = 0;
            for (var key1 in item.children) {
                var child = item.children[key1];
                item.childCount += child.isFolder ? child.childCount : 1;
                item.selectedCount += child.isFolder ? child.selectedCount : (child.selected ? 1 : 0);
            }
            if(treeSelectInfo.canSelectFolder && item.isFolder && (item.id in treeSelectInfo.selectedIds)) {
            	continue;
            } else {
				item.selected = item.selectedCount == 0 ? false 
				: (item.selectedCount == item.childCount ? true : 'part');
            }
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
        	if ($scope.info.fieldmodelid) {
	            var treeSelectBox = iElem[0].querySelector('.nl-tree-select-box');
	            nlDlg.addField($scope.info.fieldmodelid, treeSelectBox);
        	}
        	var searchField = iElem[0].querySelector('.searchField');
        	var previousSelectedText = null;
            $scope.onClick = function(item, e, pos) {
            	$scope.info.currentItemPos = pos;
                if (item.isFolder) {
                    nlTreeSelect.toggleFolder(item, $scope.info);
                } else {
                    nlTreeSelect.toggleSelection(item, $scope.info);
                    if (item.selected && !$scope.info.multiSelect && !$scope.info.canSelectFolder)
						$scope.info.treeIsShown = false;
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
	            	nlTreeSelect.updateSearchVisible($scope.info);
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
            
            $scope.onCheckBoxSelect = function(item, e, pos) {
            	$scope.info.currentItemPos = pos;
                if (!item.isFolder || (!$scope.info.multiSelect && !$scope.info.canSelectFolder)) return;
                e.stopImmediatePropagation();
                e.preventDefault();
                nlTreeSelect.toggleSelectionOfFolder(item, $scope.info);
            };
            
            $scope.onSearchTextChange = function(e) {
            	nlTreeSelect.updateSearchVisible($scope.info);
            };
            $scope.selectDeselectAll = function(e, bSelect) {
            	nlTreeSelect.selectDeslectNodes($scope.info, bSelect);
            };
        }
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

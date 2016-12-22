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
    this.updateSelectionTree = function(treeSelectInfo, selectedIds) {
        var itemDict = {};
        var treeList = treeSelectInfo.data;
        for(var i=0; i<treeList.length; i++) {
            var item = treeList[i];
            itemDict[item.id] = item;
            var idParts = item.id.split('.');
            if (!item.name) item.name = idParts[idParts.length -1];
            item.indentation = idParts.length - 1;
            item.isVisible = (item.indentation < 1);
            item.isOpen = false;
            item.isFolder = false;
            item.selected = (selectedIds && item.id in selectedIds) ? selectedIds[item.id] : false;
            idParts.pop();
            var parentId = idParts.join('.');
            if (parentId) itemDict[parentId].isFolder = true;
        }
        this.updateFoldersAndCount(treeSelectInfo);
        treeSelectInfo.treeIsShown = true;
    };

    this.getSelectedIds = function(treeSelectInfo, leafOnly) {
        var treeList = treeSelectInfo.data;
        var ret = {};
        for(var i=0; i<treeList.length; i++) {
            var item = treeList[i];
            if (!item.selected) continue;
            if (item.isFolder && leafOnly) continue;
            ret[item.id] = item.selected;
        }
        return ret;
    };
    
    // Mainly for the directive usage
    this.toggleFolder = function(folder, treeSelectInfo) {
        var treeList = treeSelectInfo.data;
        folder.isOpen = !folder.isOpen;
        for(var i=0; i<treeList.length; i++) {
            var item = treeList[i];
            if (!_isDecendantOf(item, folder)) continue;
            if (folder.isOpen) {
                var parentId = _getParentId(item.id);
                if (parentId == folder.id) item.isVisible = true;
            } else {
                item.isVisible = false;
            }
        }
    };

    this.toggleSelection = function(curItem, treeSelectInfo) {
        curItem.selected = !curItem.selected;
        return this.updateFoldersAndCount(treeSelectInfo);
    };
    
    this.updateFoldersAndCount = function(treeSelectInfo) {
        var folders = {};
        var treeList = treeSelectInfo.data;
        for(var i=0; i<treeList.length; i++) {
            var item = treeList[i];
            var parentId = _getParentId(item.id);
            while (parentId) {
                if (!folders[parentId]) folders[parentId] = {count: 0, selected: 0};
                folders[parentId].count++;
                if (item.selected) folders[parentId].selected++;
                parentId = _getParentId(parentId);
            }
        }

        treeSelectInfo.selectCount = 0;
        for(var i=0; i<treeList.length; i++) {
            var item = treeList[i];
            var finfo = folders[item.id];
            if (finfo)
                item.selected = (finfo.selected == 0) ? false 
                    : (finfo.selected == finfo.count) ? true : 'part';
            if (item.selected === true) treeSelectInfo.selectCount++;
        }
    };

    this.toggleSelectionOfFolder = function(folder, treeSelectInfo) {
        var treeList = treeSelectInfo.data;
        for(var i=0; i<treeList.length; i++) {
            var item = treeList[i];
            if (!_isDecendantOf(item, folder)) continue;
            item.selected = !folder.selected;
        }
        return this.toggleSelection(folder, treeSelectInfo);
    };

    function _isDecendantOf(item, folder) {
        if (item.id == folder.id) return false;
        return (item.id.indexOf(folder.id) == 0);
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
                e.stopImmediatePropagation();
                e.preventDefault();
                if (item.isFolder) {
                    nlTreeSelect.toggleSelectionOfFolder(item, $scope.info);
                } else {
                    nlTreeSelect.toggleSelection(item, $scope.info);
                }
            };
        }
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

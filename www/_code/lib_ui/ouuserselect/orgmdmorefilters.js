(function() {

//-------------------------------------------------------------------------------------------------
// ouuserselect.js: 
// selection of users from ou tree including filters
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.orgmdmorefilters', [])
    .service('nlOrgMdMoreFilters', OrgMdMoreFiltersSrv)
    .directive('nlOrgMetadataMoreFilters', OrgMdMoreFiltersDirective());
}

//-------------------------------------------------------------------------------------------------
var OrgMdMoreFiltersSrv = ['nl', 'nlDlg', 'nlGroupInfo', 'nlTreeSelect', 'nlOuUserSelect',
function(nl, nlDlg, nlGroupInfo, nlTreeSelect, nlOuUserSelect) {

 	var _mdFilterTrees = null;

	var _selectedOrgUnits = [];
	var _selectedMds = {};
	var _selectedMores = {};
	
    this.getData = function(moreTree, moreTitle) {
		nlGroupInfo.init();
		nlGroupInfo.update();
        var groupInfo = nlGroupInfo.get();

        var filtersData = {};
        filtersData.org_unit = nlOuUserSelect.getOuTree(groupInfo, 
            _selectedOrgUnits, false, true);

        var filterDicts = _filterArrayToDict(nlGroupInfo.getUserMetadata(null) || {});
        _mdFilterTrees = nlOuUserSelect.getMetadataFilterTrees(filterDicts, false);
        _mdFilterTrees.initFilters(_selectedMds);
        filtersData.mdFilters = _mdFilterTrees.getFilters();
        
	    nlTreeSelect.updateSelectionTree(moreTree, _selectedMores);
	    moreTree.treeIsShown = false;
	    moreTree.multiSelect = true;
		moreTree.fieldmodelid = 'courseTree';

		filtersData.moreTree = moreTree;
		filtersData.moreTitle = moreTitle;
        return filtersData;
    };
	
	this.getSelectedOus = function(filterData) {
		_selectedOrgUnits = [];
        var selected = nlTreeSelect.getSelectedIds(filterData.org_unit);
        for(var key in selected) _selectedOrgUnits.push(key);
        return selected;
	};
	
	this.getSelectedMds = function(filterData) {
		_selectedMds = _mdFilterTrees.getSelectedFilters();
		return _selectedMds;
	};
	
	this.getSelectedMores = function(filterData) {
		_selectedMores = {};
		var selected = nlTreeSelect.getSelectedIds(filterData.moreTree);
		var ret = {};
		for(var key in selected) {
			var item = selected[key];
			_selectedMores[item.id] = true;
			var indexOfA = item.id.indexOf('A');
			var indexOfDot = item.id.indexOf('.');
			var parentId = item.id.slice(indexOfA + 1, indexOfDot);
			if(item.origId) ret[item.origId] = true;
			if(item.id.indexOf('.') > 0) ret[parentId] = true; 
			ret[item.id] = true;
		}
		return ret;
	};
	
	function _filterArrayToDict(filters) {
        var ret = {};
        for(var key in filters) {
            var values = filters[key];
            ret[key] = {};
            for (var i=0; i<values.length; i++) {
                ret[key][values[i]] = true;
            }
        }
        return ret;
    }

}];

//-------------------------------------------------------------------------------------------------
function OrgMdMoreFiltersDirective() {
 	var scope = {
        	data: '='
	};
    var templateUrl = 'lib_ui/ouuserselect/filterorgtree.html';
    return _nl.elemDirective(templateUrl, scope);	
}
//-------------------------------------------------------------------------------------------------
module_init();
})();


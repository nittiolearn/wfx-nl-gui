(function() {

//-------------------------------------------------------------------------------------------------
// table.js: 
// Models to show a table with multiple rows and columns
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.table', [])
    .directive('nlTable', TableDirective);
}

//-------------------------------------------------------------------------------------------------
var TableDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
    function _linkFn($scope, iElem, iAttrs) {
        /*
         * Sample info content:
            var info = {
                columns: [                                            // Mandatory
                    {id: xx,                                          // Mandatory
                     name: xx,                                           // Opt, default=id
                     smallScreen:false|true,                             // Opt, default=false
                     midScreen: true|false,                              // Opt, default=true
                     largeScreen: true|false,                            // Opt, default=true
                     searchable: true|false,                             // Opt, default=true
                     searchKey: xx,                                      // Opt, default=id
                     showInDetails: true|false                           // Opt, default=true
                     }, ...],
                search: {                                             // Opt, default=search
                    disable: false/true                                  // Opt, default=false
                    placeholder: 'Search',                               // Opt, default='Search'
                    filter: '',                                          // Opt, default=''
                },
                styles: {table: '', tr: '', td: '', th: ''},          // Opt, default='' for all
                maxVisible: 100,                                      // Opt, default=100
                onItemClick: undefined|null|fn                        // Opt, default=show detials, 
                                                                      //      null means no-onlick
                itemToolBar: [{id: xx, icon: xx, title: xx, fn: xx}, ...] // Opt list of item toolbar
                settingIcon: {                                        // Opt, default no setting icon
                    click: undefined|fn                                   // Opt, default=show details
                    icon: 
                    }
                
                // Function registered by directive to be called by controller
                // when ever there is cahnge in the records to be displayed.
                updateScope: fn(records)
                
                // Internal stuff maintained by directive
                _internal: {searcher: {}, recs: [], visibleRecs: []}
            }
         */
        _initData($scope.info);
    };
    
    function _initData(info) {
        if (!info) info = {};
        for (var i=0; i<info.columns.length; i++) {
            var col = info.columns[i];
            if (!col.name) col.name = col.id;
            if (!col.smallScreen) col.smallScreen = false;
            if (col.midScreen === undefined) col.midScreen = true;
            if (col.largeScreen === undefined) col.largeScreen = true;

            if (col.searchable === undefined) col.searchable = true;
            if (!col.searchKey) col.searchKey = col.id;
            if (col.showInDetails === undefined) col.showInDetails = true;
        }

        if (!info.search) info.search = {};
        if (!info.search.disabled) info.search.disabled = false;
        if (!info.search.placeholder) info.search.placeholder = 'Search';
        if (!info.search.filter) info.search.filer = '';
         
        if (!info.styles) info.styles = {};
        if (!info.styles.table) info.styles.table = '';
        if (!info.styles.tr) info.styles.tr = '';
        if (!info.styles.td) info.styles.td = '';
        if (!info.styles.th) info.styles.th = '';

        if (!info.maxVisible) info.maxVisible = 100;
        if (info.onItemClick === null) info.onItemClick = _showDetails;
        
        info._internal = {
            searcher: new Searcher(nl, info),
            recs: [],
            visibleRecs: []
        };

        info.updateScope = function(records) {
            _updateScope(info, records);
        };
    }
    
    fucntion _showDetails(record) {
    }
    
    function _updateScope(info, records) {
        // TODO-MUNNI-NOW
    }

    return {
        restrict: 'E', 
        transclude: true,
        templateUrl: 'lib_ui/table/table.html',
        scope: {
            info: '='
        },
        link: _linkFn};
}];

//-------------------------------------------------------------------------------------------------
function Searcher(nl, info) {
    this.infotxt = '';

    this.onKeyDown = function(event) {
        var MAX_KEYSEARCH_DELAY = 200;
        nl.debounce(this.onClick, MAX_KEYSEARCH_DELAY)(event);
    };

    this.onDetails = function(event) {
        var visible = info._internal.visibleRecs.length;
        var total = info._internal.recs.length;
        var text = nl.t('<p>Displaying <b>{}</b> of <b>{}</b> items.</p>', visible, total);
        nlDlg.popupAlert({title: '', template: text});
    };
    
    this.onClick = function(event) {
        var filter = _getFilter();
        var records = info._internal.recs;
        var max = records.length > info.maxVisible ? info.maxVisible: records.length;
        var visible = [];
        for (var i=0; i<records.length; i++) {
            if (visible.length >= max) break;
            if (_isFilterPass(records[i], filter)) visible.push(records[i]);
        }
        info._internal.visibleRecs = visible;
    };

    function _updateInfoTxt() {
        var visible = info._internal.visibleRecs.length;
        var total = info._internal.recs.length;
        var item = visible <= 1 ? 'item' : 'items'; 
        var plus = total > visible ? '+' :  '';
        this.infotxt = nl.t('{}{} {}', visible, plus, item);
    }

    function _getFilter() {
        if (!info.search.filter) return null;
        var filter = info.search.filter.toLowerCase();
        var pos = filter.indexOf(':');
        if (pos < 0) return {str: filter, attr: null};
        var filt = filter.substring(pos+1);
        filt = filt.trim();

        var attr = filter.substring(0, pos);
        if (attr in searchObj.filterAttrs) return {str: filt, attr: attr};
        return {str: filter, attr: null};
    }

    function _isFilterPass(record, filter) {
        if (!filter || !filter.str) return true;
        var fields = searchObj.getFilterFields(record);
        if (filter.attr)
            return (fields[filter.attr] || '').toLowerCase().indexOf(filter.str) >= 0;
        for (var f in fields) {
            if (fields[f].toLowerCase().indexOf(filter.str) >= 0) return true;
        }
        return false;
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

(function() {

//-------------------------------------------------------------------------------------------------
// table.js: 
// Models to show a table with multiple rows and columns
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.table', [])
    .directive('nlTable', TableDirective)
    .service('nlTable', TableSrv);
}

//-------------------------------------------------------------------------------------------------
var TableDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return {
        restrict: 'E', 
        transclude: true,
        templateUrl: 'lib_ui/table/table.html',
        scope: {
            info: '='
        },
        link: function($scope, iElem, iAttrs) {
            $scope.onItemClick = function(rec, action) {
                $scope.info.onItemClick($scope, rec, action);
            };
            $scope.checkOverflow = function() {
                var document = nl.window.document;
                var element = document.getElementsByClassName("nl-left-tabbed-content");
                var isOverflowing = element[0].clientWidth < element[0].scrollWidth;
                return isOverflowing;
            };
        }
    };
}];

//-------------------------------------------------------------------------------------------------
var TableSrv = ['nl', 'nlDlg', '$templateCache',
function(nl, nlDlg, $templateCache) {

    /* Sample content of table object which is passed to nlTable directive:
    <nl-table info='tableobject'> (transclude content) </nl-table>
    var info = {
        columns: [                                            // Mandatory
            {id: xx,                                          // Mandatory, attrid within record
             name: xx,                                           // Opt, default=id
             icon: xx,                                           // Opt, default=none
                                                                 // icon is attrid storing the icon
             iconType: ionicon|img,                              // Opt, default=ionicon
             smallScreen:false|true,                             // Opt, default=false
             mediumScreen: true|false,                           // Opt, default=true
             largeScreen: true|false,                            // Opt, default=true
             searchable: true|false,                             // Opt, default=true
             searchKey: undefined|null|xx,                       // Opt, default=name
             showInDetails: true|false                           // Opt, default=true
             styleTd: ''                                         // Opt, default=''
             }, ...],
        search: {                                             // Opt, default=search
            disable: false/true                                  // Opt, default=false
            placeholder: 'Search',                               // Opt, default available
            filter: '',                                          // Opt, default=''
        },
        getSummaryRow: undefined|fn                           // Opt, default= no summary
        styleTable: '',                                       // Opt, default=cozy
        styleHeader: '',                                      // Opt, default=header
        styleSummary: '',                                     // Opt, default=summary
        maxVisible: 100,                                      // Opt, default=100
        onRowClick: undefined=none|"expand"|"xxx"             // Opt, default=none
        detailsTemplate: undefined|"templateUrl"              // Opt, default=table_details.html
        clickHandler: undefined|fn                            // Opt, Called with action-type
        
        // Function registered by directive to be called by controller
        // when ever there is cahnge in the records to be displayed.
        updateScope: fn(records),
        
        // Internal stuff maintained by directive
        _internal: {searcher: {}, recs: [], visibleRecs: []}
    }
    */
    this.initTableObject = function(info) {
        if (!info) throw('table info object error');
        for (var i=0; i<info.columns.length; i++) {
            var col = info.columns[i];
            if (!col.id) throw('table info object error');
            if (!col.name) col.name = col.id;
            if (!col.iconType) col.iconType = 'ionicon';
            
            if (!col.smallScreen) col.smallScreen = false;
            if (col.mediumScreen === undefined) col.mediumScreen = true;
            if (col.largeScreen === undefined) col.largeScreen = true;

            if (col.searchable === undefined) col.searchable = true;
            if (!col.searchKey) col.searchKey = col.name;
            col.searchKey = col.searchable ? col.searchKey.toLowerCase() : null;
            if (col.showInDetails === undefined) col.showInDetails = true;

            if (!col.styleTd) col.styleTd = '';
        }

        if (!info.search) info.search = {};
        if (!info.search.disabled) info.search.disabled = false;
        if (!info.search.placeholder) info.search.placeholder = 'Start typing to search';
        if (!info.search.filter) info.search.filter = '';
         
        if (!info.styleTable) info.styleTable = 'nl-table-styled2 cozy';
        if (!info.styleHeader) info.styleHeader = 'header';
        if (!info.styleSummary) info.styleSummary = 'summary';

        if (!info.maxVisible) info.maxVisible = 100;
        if (!info.onRowClick) info.onRowClick = null;
        if (!info.detailsTemplate) info.detailsTemplate = 'lib_ui/table/table_details.html';
        if (!info.clickHandler) info.clickHandler = null;
        
        info._internal = {
            summaryRow: null,
            recs: [],
            visibleRecs: [],
        };
        info.onItemClick = _onItemClickHandler;
        
        info._internal.searcher = new Searcher(nl, nlDlg, info);
    };

    this.updateTableObject = function(info, records, startpos) {
        _updateTableColumns(info);
        info._internal.recs = records;
        info._internal.searcher.initStartPos(startpos);
        info._internal.searcher.onClick(null);
    };
    
    this.getSummaryRow = function(info) {
        return info._internal.summaryRow;
    };

    function _updateTableColumns(info) {
        info.columns = [];
        for (var i=0;i<info.origColumns.length; i++) {
            var column = info.origColumns[i];
            if (column.insertCols) {
                for (var j=0; j<column.children.length; j++) {
                    var key = nl.t('{}{}', column.id, j);
                    var defCols = angular.copy(column);
                    defCols.id = key;
                    defCols.name = column.children[j];
                    info.columns.push(defCols);
                }
            } else {
                info.columns.push(column);
            }
        }
    }

    function _onItemClickHandler($scope, rec, action) {
        if (!action) return;
        var info = $scope.info;
        if (!info.clickHandler) return;
        if (action != 'expand') return info.clickHandler(rec, action);
        
        rec.canShowDetails = !rec.canShowDetails;
        if (!rec.canShowDetails) return;
        
        rec.details = $templateCache.get(info.detailsTemplate);
        _defaultDetails(info, rec);
    }
    
    function _defaultDetails(info, record) {
        record.avps = [];

        for(var i=0; i<info.columns.length; i++) {
            var col = info.columns[i];
            if (!col.showInDetails) continue;
            var item = record[col.id] || {txt: ''};
            var icon = (item.icon && col.iconType == 'ionicon')
                 ? nl.fmt2("<i class='icon fsh4 {}'></i> ", item.icon)
                 : '';
            var txt = icon + item.txt;
            nl.fmt.addAvp(record.avps, col.name, txt);
        }
    }
}];

//-------------------------------------------------------------------------------------------------
function Searcher(nl, nlDlg, info) {
    var self = this;
    function _init() {
        self.infotxt = '';
        self.startpos = 0;
        self.searchAttrs = _getSearchAttrs();

        nl.resizeHandler.onResize(function() {
            _onResize();
        });
        _onResize();
    }

    self.initStartPos = function(startpos) {
        self.startpos = startpos || 0;
    };

    self.onKeyDown = function(event) {
        var MAX_KEYSEARCH_DELAY = 200;
        var timeout = (event.which === 13) ? 0 : MAX_KEYSEARCH_DELAY;
        self.onClick(timeout);
    };

    self.clickDebouncer = nl.CreateDeboucer();
    self.onClick = function(timeout) {
        self.clickDebouncer.debounce(timeout, _onClick)();
    };

    function _onClick(startpos) {
        var filter = _getFilter();
        var records = info._internal.recs;
        var max = records.length > info.maxVisible ? info.maxVisible: records.length;
        var visible = [];
        var startpos = self.startpos;
        for (var i=startpos; i<records.length; i++) {
             records[i].passesFilter = false;
            if (!_isFilterPass(records[i], filter)) continue;
            if (visible.length < max)
                visible.push(_getDisplayRecord(records[i]));
             records[i].passesFilter = true;
        }

        info._internal.visibleRecs = visible;
        info._internal.summaryRow = null;
        if (info.getSummaryRow)
            info._internal.summaryRow = info.getSummaryRow(records);
        _updateInfoTxt();
    }
    
    function _onResize() {
        var screenSize = nl.rootScope.screenSize;
        for(var i=0; i<info.columns.length; i++) {
            var col = info.columns[i];
            if ('allScreens' in col) continue;
            col.canShow = screenSize == 'small' ? col.smallScreen :
                screenSize == 'medium' ? col.mediumScreen : col.largeScreen;
        }
    }
    
    function _getDisplayRecord(record) {
        var ret = {_raw: record};
        for(var i=0; i<info.origColumns.length; i++) {
            var col = info.origColumns[i];
            if (col.insertCols) {
                var array = record[col.id] || [];
                var count = 0;
                for (var j=0; j<array.length; j++) {
                    var key1 = nl.t('{}{}', col.id, count);
                    ret[key1] = {txt: array[j].name};
                    count++;
                    var key2 = nl.t('{}{}', col.id, count);
                    ret[key2] = {txt: array[j].score};
                    count++;
                }
                continue;
            }
            ret[col.id] = {txt: self.getFieldValue(record, col.id), 
                icon: col.icon ? self.getFieldValue(record, col.icon) : ''};
        }
        return ret;
    }

    self.getFieldValue = function(record, fieldId) {
        if(!record) return '';
        var pos = fieldId.indexOf('.');
        if (pos < 0) return record[fieldId] ? record[fieldId] : record[fieldId] === 0 ? '0' : '';
        var left = fieldId.substring(0, pos);
        var right = fieldId.substring(pos+1);
        return self.getFieldValue(record[left], right);
    };

    function _updateInfoTxt() {
        var visible = info._internal.visibleRecs.length;
        var total = info._internal.recs.length;
        if (total == 0) {
            self.infotxt = nl.t('There are no items to display.');
            return;
        } 
        var match = (visible == 1) ? 'match' : 'matches';
        var item = (total == 1) ? 'item' : 'items';
        self.infotxt = nl.t('Found {} {} from {} {} searched.', visible, match, total, item);
    }

    function _getFilter() {
        if (!info.search.filter) return null;
        var filter = info.search.filter.toLowerCase();
        var pos = filter.indexOf(':');
        if (pos < 0) return {str: filter, attr: null};
        var filt = filter.substring(pos+1);
        filt = filt.trim();

        var attr = filter.substring(0, pos);
        if (attr in self.searchAttrs) return {str: filt, attr: attr};
        return {str: filter, attr: null};
    }

    function _isFilterPass(record, filter) {
        if (!filter || !filter.str) return true;
        var fields = _getSearchFields(record);
        if (filter.attr)
            return (fields[filter.attr] || '').toLowerCase().indexOf(filter.str) >= 0;
        for (var f in fields) {
            if (fields[f].toLowerCase().indexOf(filter.str) >= 0) return true;
        }
        return false;
    }
    
    function _getSearchAttrs() {
        var searchAttrs = {};
        for(var i=0; i<info.columns.length; i++) {
            var searchAttr = info.columns[i].searchKey;
            if (!searchAttr) continue;
            searchAttrs[searchAttr] = info.columns[i].id;
        }
        return searchAttrs;
    }

    function _getSearchFields(record) {
        var fields = [];
        for(var attr in self.searchAttrs) {
            fields[attr] = self.getFieldValue(record, self.searchAttrs[attr]);
        }
        return fields;
    }
    
    _init();
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

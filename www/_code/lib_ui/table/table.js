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
            $scope.sortRows = function(colid) {
                $scope.info.sortRows($scope, colid);
            };
        }
    };
}];

//-------------------------------------------------------------------------------------------------
var TableSrv = ['nl', 'nlDlg', '$templateCache',
function(nl, nlDlg, $templateCache) {

    /* Sample content of table object which is passed to nlTable directive:
    <nl-table info='tableobject'></nl-table>
    var info = {
        origColumns: [                                        // Mandatory
            {id: xx,                                          // Mandatory, attrid within record
             name: xx,                                        // Opt, default=id
             icon: xx,                                        // Opt, default=none
                                                              // icon is attrid storing the icon
             iconType: ionicon|img,                           // Opt, default=ionicon
             styleTd: ''                                      // Opt, default=''
             }, ...],
        search: {                                             // Opt, default=search
            disable: false/true                               // Opt, default=false
            placeholder: 'Search',                            // Opt, default available
            filter: '',                                       // Opt, default=''
        },
        styleTable: '',                                       // Opt, default=cozy
        styleHeader: '',                                      // Opt, default=header
        styleSummary: '',                                     // Opt, default=summary
        maxVisible: 100,                                      // Opt, default=100
        onRowClick: undefined=none|"expand"|"xxx"             // Opt, default=none
        detailsTemplate: "templateUrl"                        // Mandatory
        clickHandler: undefined|fn                            // Opt, Called with action-type
        
        // Function registered by directive to be called by controller
        // when ever there is cahnge in the records to be displayed.
        updateScope: fn(records),
        
        // Internal stuff maintained by directive
        _internal: {paginator: {}, recs: [], visibleRecs: []}
    }
    */

    var self = this;
    this.initTableObject = function(info) {
        if (!info) throw('table info object error');
        if (!info.styleTable) info.styleTable = 'nl-table-styled2 cozy';
        if (!info.styleHeader) info.styleHeader = 'header';
        if (!info.styleSummary) info.styleSummary = 'summary';
        if (!info.maxVisible) info.maxVisible = 100;
        if (!info.onRowClick) info.onRowClick = null;
        if (!info.clickHandler) info.clickHandler = null;
        
        info._internal = {
            recs: [],
            visibleRecs: [],
            paginator: new Paginator(nl, info)
        };
        info.onItemClick = _onItemClickHandler;
        info.sortRows = _sortRows;
    };

    this.resetCache = function(info) {
        info._internal.paginator.resetCache();
    };

    this.updateTableRecords = function(info, records) {
        _initSortObject(info);
        _updateTableColumns(info);
        info._internal.displayRecs = info._internal.paginator.getDisplayRecords(records);
        info._internal.paginator.showPage(0);
    };

    this.updateTableColumns = function(info) {
        _initSortObject(info);
        _updateTableColumns(info);
        info._internal.paginator.showPage(0);
    };

    this.updateTablePage = function(info, startpos) {
        info._internal.paginator.showPage(startpos);
    };

    // TODO-NOW: This has to be refactored
    this.getFieldValue = function(info, record, fieldId) {
        return info._internal.paginator.getFieldValue(record, fieldId);
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
    }
    
    function _initSortObject(info) {
        info.sort = {colid: null, ascending: true};
    }

    function _sortRows($scope, colid) {
        if(!(colid)) return;
        var info = $scope.info;
        var sortObj = info.sort;
        if (colid == sortObj.colid) {
            sortObj.ascending = sortObj.ascending ? false : true;
        } else {
            sortObj.colid = colid;
            sortObj.ascending = true;
        }
        var records = info._internal.displayRecs;
        records.sort(function(a, b) {
            var colid= sortObj.colid;
            var aVal = a[colid].txt;
            var bVal = b[colid].txt;
            if (sortObj.ascending) return _compare(aVal, bVal);
            else return _compare(bVal, aVal);
        });
        info._internal.paginator.showPage(0);
    }   

    function _compare(a,b) {
        if (a > b) return 1;
        else if (a < b) return -1;
        return 0;
    }
}];

//-------------------------------------------------------------------------------------------------
function Paginator(nl, info) {
    var self = this;
    function _init() {
        self.infotxt = '';
        self.startpos = 0;
        self.displayRecordCache = {};
    }

    self.resetCache = function() {
        self.displayRecordCache = {};
    }

    self.showPage = function(startpos) {
        self.startpos = startpos || 0;
        var records = info._internal.displayRecs;
        var visible = [];
        var startpos = self.startpos;
        for (var i=startpos; i < records.length && visible.length < info.maxVisible; i++) {
            visible.push(records[i]);
        }
        info._internal.visibleRecs = visible;
        _updateInfoTxt();
    };
    
    self.getDisplayRecords = function(records) {
        var ret = [];
        for(var i=0; i<records.length; i++)
            ret.push(_getDisplayRecord(records[i]));
        return ret;
    };

    function _getDisplayRecord(record) {
        var rid = record.raw_record.id;
        if (rid in self.displayRecordCache) return self.displayRecordCache[rid];
        var ret = {_raw: record};
        self.displayRecordCache[rid] = ret;
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
        var total = info._internal.displayRecs.length;
        if (total == 0) {
            self.infotxt = nl.t('There are no items to display.');
            return;
        } 
        var match = (visible == 1) ? 'match' : 'matches';
        var item = (total == 1) ? 'item' : 'items';
        self.infotxt = nl.t('Found {} {} from {} {} searched.', visible, match, total, item);
    }

    _init();
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

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
var TableSrv = ['nl', 'nlExpressionProcessor', '$templateCache',
function(nl, nlExpressionProcessor, $templateCache) {

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
        _internal: {paginator: {}, displayRecs: [], visibleRecs: []}
    }
    */

    var self = this;
    this.initTableObject = function(info, custColsDict, lookupTablesDict) {
        if (!info) throw('table info object error');
        if (!info.styleTable) info.styleTable = 'nl-table-styled2 cozy';
        if (!info.styleHeader) info.styleHeader = 'header';
        if (!info.styleSummary) info.styleSummary = 'summary';
        if (!info.maxVisible) info.maxVisible = 100;
        if (!info.onRowClick) info.onRowClick = null;
        if (!info.clickHandler) info.clickHandler = null;
        
        info._internal = {
            displayRecs: [],
            visibleRecs: [],
            custColsDict: custColsDict,
            lookupTablesDict: lookupTablesDict,
            paginator: new Paginator(nl, info, nlExpressionProcessor)
        };
        info.onItemClick = _onItemClickHandler;
        info.sortRows = _sortRows;
    };

    this.resetCache = function(info) {
        info._internal.paginator.resetCache();
    };

    this.updateTableRecords = function(info, records) {
        _initSortObject(info);
        info._internal.displayRecs = info._internal.paginator.getDisplayRecords(records);
        info._internal.paginator.showPage(0);
    };

    this.updateTableColumns = function(info, records, custColsDict, lookupTablesDict) {
        _initSortObject(info);
        info._internal.custColsDict = custColsDict;
        info._internal.lookupTablesDict = lookupTablesDict;
        info._internal.displayRecs = info._internal.paginator.getDisplayRecords(records);
        info._internal.paginator.showPage(0);
    };

    this.updateTablePage = function(info, startpos) {
        info._internal.paginator.showPage(startpos);
    };

    this.getFieldValue = function(info, record, fieldid) {
        return info._internal.paginator.getFieldValue(record, fieldid);
    };
    
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
            var colid= '_id.' + sortObj.colid;
            var aVal = a._avps[colid];
            var bVal = b._avps[colid];
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
function Paginator(nl, info, nlExpressionProcessor) {
    var self = this;
    function _init() {
        self.infotxt = '';
        self.startpos = 0;
        self.recordAvpCache = {};
    }

    self.resetCache = function() {
        self.recordAvpCache = {};
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
            ret.push(self.getDisplayRecord(records[i]));
        return ret;
    };

    self.getDisplayRecord = function(record) {
        var ret = {_raw: record, _avps: _getAvps(record)};

        for(var i=0; i<info.origColumns.length; i++) {
            var col = info.origColumns[i];
            self.getFieldValue(record, col.id, ret._avps);
            if (col.icon) self.getFieldValue(record, col.icon, ret._avps);
        }
        return ret;
    }

    self.getFieldValue = function(record, fieldId, avps) {
        if (!avps) avps = _getAvps(record);
        var key = '_id.' + fieldId;
        if (key in avps) return avps[key];
        avps[key] = _getFieldValue(record, fieldId, avps);
        return avps[key];
    };

    function _getAvps(record) {
        var rid = record.raw_record.id;
        if (!(rid in self.recordAvpCache)) self.recordAvpCache[rid] = {};
        return self.recordAvpCache[rid];
    }

    function _getFieldValue(record, fieldId, avps) {
        if(!record) return '';
        var ret = '';
        if (fieldId.indexOf('custom.') != 0) ret = _getFixedFieldValue(record, fieldId);
        else ret = _getCustomFieldValue(record, fieldId, avps);
        if (!ret && ret !== 0) ret = '';
        return ret;
    }

    function _getFixedFieldValue(record, fieldId) {
        if(!record) return '';
        var parts = fieldId.split('.');
        var obj = record;
        for(var i=0; i<parts.length; i++) obj = obj[parts[i]];
        return obj;
    }

    function _getCustomFieldValue(record, fieldId, avps) {
        var key = 'id.' + fieldId;
        var col = info._internal.custColsDict[fieldId];
        if (!col) return '';

        // Preload variables used in the formula
        var usedVars = nlExpressionProcessor.getUsedVars(col.formula);
        for (var key in usedVars) {
            var usedFieldId = key.substring(4); // omit "_id."
            self.getFieldValue(record, usedFieldId, avps);
        }

        // Now compute the formula
        var payload = {strExpression: col.formula, dictAvps: avps, 
            lookupTablesDict: info._internal.lookupTablesDict,
            sendAsVariableNames: true};
        nlExpressionProcessor.process(payload);
        return payload.error ? '' : payload.result;
    }

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

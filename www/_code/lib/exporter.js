(function() {

//-------------------------------------------------------------------------------------------------
// exporter.js: 
// Export to CSV and other data formats
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.exporter', [])
    .service('nlExporter', NlExporter);
}

//-------------------------------------------------------------------------------------------------
var NlExporter = ['nl',
function(nl) {
    var self = this;

    // itemArray should be array of objects; 
    // header is array of objects: {id: 'x', name: 'y'}
    // canAddFn is called for each item in data and if it returns true the
    // row is added to output array
    // returns array of array of strings which can then be exported
    // If startPos and endPos are given, only those records are fetched 
    // (including startPos and not including endPos).
    this.objToCsv = function(itemArray, headers, canAddFn, startPos, endPos) {
        var csvContent = self.getCsvHeader(headers);
        var lineDelim = '\n';
        if (!startPos || startPos < 0) startPos = 0;
        if (!endPos || endPos > itemArray.length) endPos = itemArray.length;
        for(var i=startPos; i<endPos; i++) {
            if(canAddFn && !canAddFn(itemArray[i])) continue;
            var row = lineDelim + self.getCsvRow(headers, itemArray[i]);
            csvContent += row;
        }
        return csvContent;
    };

    this.getCsvHeader = function(headers) {
        return _getCsvString(_getHeaderRow(headers));
    };
    
    this.getCsvRow = function(headers, row) {
        return _getCsvString(_getItemRow(headers, row));
    };

    // Data should be array of array of strings
    this.exportArrayTableToCsv = function(fileName, data) {
        var uri = 'data:text/csv;charset=utf-8,';
        var csvContent = '';
        var lineDelim = '';
        for(var i=0; i<data.length; i++) {
            var row = lineDelim + _getCsvString(data[i]);
            csvContent += row;
            lineDelim = '\n';
        }
        csvContent = uri + nl.fmt.encodeUri(csvContent);
        _saveFile(fileName, csvContent);
    };
    
    function _getCsvString(rowData) {
        var row = '';
        for(var i=0; i<rowData.length; i++) {
            var d = _quote(rowData[i]);
            row += i > 0 ? ',' + d : d;
        }
        return row;
    }

    this.exportTextFile = function(fileName, data) {
        var uri = 'data:text/plain;charset=utf-8,';
        data = uri + nl.fmt.encodeUri(data);
        _saveFile(fileName, data);
    };

    function _quote(data) {
        if (typeof(data) != 'string') return data;
        if (data.indexOf('"') < 0 && data.indexOf(',') < 0) return data;
        return '"' + data.replace(/\"/g, '""') + '"';
    }
    
    function _getHeaderRow(headers) {
        var row = [];
        for(var i=0; i<headers.length; i++) {
            row.push(headers[i].name);
        }
        return row;
    }

    function _getItemRow(headers, item) {
        var row = [];
        for(var i=0; i<headers.length; i++) {
            var attr = headers[i].id;
            var val = _fmtValue(item[attr], headers[i].fmt) || '';
            row.push(val);
        }
        return row;
    }

    function _fmtValue(val, fmt) {
        if (!val) return val;
        if (fmt == 'idstr') return 'id=' + val;
        if (fmt == 'date') return nl.fmt.date2Str(nl.fmt.json2Date(val), 'date');
        if (fmt == 'minute') return nl.fmt.date2Str(nl.fmt.json2Date(val), 'minute');
        return val;
    }

    function _saveFile(fileName, csvContent) {
        var link = document.createElement('a');
        link.setAttribute('href', csvContent);
        link.setAttribute('download', fileName);
        link.click();
    }
    
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

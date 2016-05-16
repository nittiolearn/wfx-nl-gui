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

    // itemArray should be array of objects; 
    // header is array of objects: {id: 'x', name: 'y'}
    // canAddFn is called for each item in data and if it returns true the
    // row is added to output array
    // returns array of array of strings which can then be exported
    this.objToTable = function(itemArray, headers, canAddFn) {
        if (!canAddFn) canAddFn = _defaultCanAddFn;
        var ret = [];
        ret.push(_getHeaderRow(headers));
        for(var i=0; i<itemArray.length; i++) {
            if(!canAddFn(itemArray[i])) continue;
            ret.push(_getItemRow(headers, itemArray[i]));
        }
        return ret;
    };
    
    // Data should be array of array of strings
    this.exportArrayTableToCsv = function(fileName, data) {
        var uri = 'data:text/csv;charset=utf-8,';
        var csvContent = '';
        for(var i=0; i<data.length; i++) {
            var rowData = data[i];
            var row = '';
            for(var j=0; j<rowData.length; j++) {
                var d = _quote(rowData[j]);
                row += j > 0 ? ',' + d : d;
            }
            csvContent += i > 0 ? '\n' + row : row;
        }
        csvContent = uri + nl.fmt.encodeUri(csvContent);
        _saveFile(fileName, csvContent);
    };

    this.exportArrayTableToXls = function(fileName, data) {
        var htmlTable = '<table>';
        for(var i=0; i<data.length; i++) {
            htmlTable += _toHtmlTds(data[i], i==0);
        }
        _exportHtmlToXls(fileName, htmlTable + '</table>');
    };

    this.exportDomTableToXls = function(fileName, domTableElementId) {
        var table = document.getElementById(domTableElementId);
        _exportHtmlToXls(fileName, table.innerHTML);
    };
    
    function _exportHtmlToXls(fileName, htmlTable) {
        var uri = 'data:application/vnd.ms-excel;base64,';
        var template = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>{worksheet}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table>{table}</table></body></html>';
        var ctx = {worksheet : fileName || 'Sheet 1', table : htmlTable};
        var xlsContent = uri + nl.fmt.utf8ToBase64(nl.fmt.fmt1(template, ctx));
        _saveFile(fileName, xlsContent);
    }
    
    function _quote(data) {
        if (data.indexOf('"') < 0 && data.indexOf(',') < 0) return data;
        return '"' + data.replace(/\"/g, '""') + '"';
    }
    
    function _toHtmlTds(row, isHeader) {
        var td = isHeader ? '<th>' : '<td>';
        var tdEnd = isHeader ? '</th>' : '</td>';
        var htmlRow = '<tr>';
        for(var i=0; i<row.length; i++) {
            htmlRow +=  td + row[i] + tdEnd;
        }
        return htmlRow + '</tr>';
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
            row.push(item[attr] || '');
        }
        return row;
    }

    function _defaultCanAddFn(item) {
        return true;
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

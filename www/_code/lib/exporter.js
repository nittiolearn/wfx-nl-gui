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
var NlExporter = ['nl', 'nlDlg',
function(nl, nlDlg) {
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

    this.getCsvString = function(row, attrName) {
        return _getCsvString(row, attrName);
    };

    this.MAX_RECORDS_PER_CSV = 50000;
    
    // Data should be array of array of strings
    this.exportArrayTableToCsv = function(fileName, data, pl, resolve, reject) {
        var zip = new JSZip();
        _exportArrayTableToCsv(0, zip, fileName, data, pl, resolve, reject);
    };

    function _exportArrayTableToCsv(chunkPos, zip, fileName, data, pl, resolve, reject) {
        var neededChunks = Math.ceil(data.length / self.MAX_RECORDS_PER_CSV);
        if (chunkPos >= neededChunks) {
            self.saveZip(zip, fileName+'.zip', pl, resolve, reject);
            return;
        }
        var startPos = chunkPos*self.MAX_RECORDS_PER_CSV;
        if (startPos == 0) startPos = 1;
        chunkPos++;
        var endPos = chunkPos*self.MAX_RECORDS_PER_CSV;
        if (endPos > data.length) endPos = data.length;
        var chunkFileName = nl.fmt2('{}-{}.csv', fileName, chunkPos);
        _msgOut(pl, nl.t('Processing {}: records {} to {}', 
            chunkFileName, startPos, endPos), false);
        nl.timeout(function() {
            var csvContent = _getCsvString(data[0]);
            var lineDelim = '\n';
            for(var i=startPos; i<endPos; i++) {
                var row = lineDelim + _getCsvString(data[i]);
                csvContent += row;
            }
            zip.file(chunkFileName, csvContent);
            _exportArrayTableToCsv(chunkPos, zip, fileName, data, pl, resolve, reject);
        });
    }
    
    this.saveZip = function(zip, fileName, pl, resolve, reject) {
        _msgOut(pl, nl.t('Creating zip file for download'), false);
        nl.timeout(function() {
            zip.generateAsync({type:'blob', compression: 'DEFLATE', 
                compressionOptions:{level:9}})
            .then(function (zipContent) {
                var size = Math.round(zipContent.size/1024);
                _msgOut(pl, nl.t('Download of {} ({} KB) initiated', fileName, size));
                saveAs(zipContent, fileName);
                if (resolve) resolve(size);
            }, function(e) {
                _msgErr(pl, nl.t('Error creating zip file: '), e);
                if (reject) reject(e);
            });
        });
    };
    
    function _msgOut(pl, msg, param) {
        if (pl) {
            pl.imp(msg);
        } else {
            nlDlg.popupStatus(msg, param);
        }
    }

    function _msgErr(pl, msg, e) {
        if (pl) {
            pl.error(msg, e);
        } else {
            nlDlg.popdownStatus(0);
            nlDlg.popupAlert({title: 'Error', content: msg + e});
        }
    }

    function _getCsvString(rowData, attrName) {
        var row = '';
        for(var i=0; i<rowData.length; i++) {
            var val = attrName ? rowData[i][attrName] : rowData[i];
            var d = _quote(val);
            row += i > 0 ? ',' + d : d;
        }
        return row;
    }

    this.exportTextFile = function(fileName, data, uri) {
        if(!uri) uri = 'data:text/plain;charset=utf-8,';
        data = uri + nl.fmt.encodeUri(data);
        _saveFile(fileName, data);
    };

    this.exportCsvFile = function(fileName, data) {
        var uri = 'data:text/csv;charset=utf-8,';
        this.exportTextFile(fileName, data, uri);
    };

    function _quote(data) {
        if (typeof(data) != 'string') return data;
        data = data.replace(/\n/g, ' ');
        data = data.replace(/^\-/, ' -');
        data = data.replace(/^\+/, ' +');
        data = data.replace(/^\=/, ' =');
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

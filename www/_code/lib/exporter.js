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
        return _getCsvString(this.getHeaderRow(headers));
    };
    
    this.getHeaderRow = function(headers) {
        var row = [];
        for(var i=0; i<headers.length; i++) {
            row.push(headers[i].name);
        }
        return row;
    };

    this.getCsvRow = function(headers, row) {
        return _getCsvString(this.getItemRow(headers, row));
    };

    this.getItemRow = function(headers, item) {
        var row = [];
        for(var i=0; i<headers.length; i++) {
            var attr = headers[i].id;
            var attrValue = item[attr];
            if(attr.indexOf('.') != -1) attrValue = _getAttrValue(attr.split('.'), item);
            var val = _fmtValue(attrValue, headers[i].fmt) || '';
            if (val > 0 && headers[i].addPercSym) val += ' %';
            row.push(val);
        }
        return row;
    };

    function  _getAttrValue(attrAsArray, item) {
        if (!item || attrAsArray.length == 0) return '';
        var attrValue = item[attrAsArray[0]];
        if(attrAsArray.length == 1) return attrValue;
        return _getAttrValue(attrAsArray.slice(1), attrValue);
    }

    this.getCsvString = function(row, attrName) {
        return _getCsvString(row, attrName);
    };

    this.quoteCsvString = function(str) {
        return _quote(str);
    };

    this.getXlsxUpdater = function() {
        return new XlsxUpdater(nl, nlDlg, this);
    };

    this.MAX_RECORDS_PER_CSV = 50000;
    this.MAX_RECORDS_PER_XLS = 50000;
    
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
        _msgOut(pl, nl.t('Creating zip file for download. This may take a while ...'), false);
        nl.timeout(function() {
            zip.generateAsync({type:'blob', compression: 'DEFLATE', 
                compressionOptions:{level:9}})
            .then(function (zipContent) {
                var size = Math.ceil(zipContent.size/1024);
                _msgOut(pl, nl.t('Download of {} ({} KB) initiated. This may take a while ...', fileName, size));
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
        if(!uri) uri = 'data:text/plain;charset=utf-8';
        _saveFile(fileName, data, uri);
    };

    this.exportCsvFile = function(fileName, data, addUtfBom) {
        var uri = 'data:text/csv;charset=utf-8';
        if (addUtfBom) {
	        var universalBOM = "\uFEFF";
	        data = universalBOM + data;
        }
        this.exportTextFile(fileName, data, uri);
    };

    var _CSV_DELIM = '\n';
    this.getUtfCsv = function(rows) {
        var universalBOM = "\uFEFF";
        return universalBOM + rows.join(_CSV_DELIM);
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
    
    function _fmtValue(val, fmt) {
        if (!val) return val;
        if (fmt == 'idstr') return 'id=' + val;
        if (fmt == 'date') return nl.fmt.date2Str(nl.fmt.json2Date(val), 'date');
        if (fmt == 'minute') return nl.fmt.date2Str(nl.fmt.json2Date(val), 'minute');
        return val;
    }

    function _saveFile(fileName, csvContent, uri) {
        var blob = new Blob([csvContent], {type: uri});
        saveAs(blob, fileName);
    }
    
}];

//-------------------------------------------------------------------------------------------------
function XlsxUpdater(nl, nlDlg, nlExporter) {
    var self = this;

    this.getContenFromUrl = function(inputXlsUrl) {
        return nl.q(function(resolve, reject) {
            JSZipUtils.getBinaryContent(srcTemplateUrl, function(e, binContent) {
                if (!e) return resolve(binContent);
                return _errorResolve(resolve, nl.fmt2('Error fetching xlsx template {}: {}', srcTemplateUrl, e));
            });
        });
    };

    this.loadXlsAsZip = function(fileObj) {
        return nl.q(function(resolve, reject) {
            JSZip.loadAsync(fileObj).then(function(zip) {
                return resolve(zip);
            }, function(e) {
                return _errorResolve(resolve, nl.fmt2('Error opening xlsx template: {}', e));
            });
        });
    };

    this.loadXlsAsObj = function(file) {
        return nl.q(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function (loadEvent) {
                var binContent = loadEvent.target.result;
                resolve(self.loadXlsBinaryAsObject(binContent));
            };
            reader.onerror = function (e) {
                return _errorResolve(resolve, nl.fmt2('Error loading xls file: {}', e));
            };
            reader.readAsArrayBuffer(file);
        });
    };

    this.loadXlsBinaryAsObject = function(binContent) {
        var wb = XLSX.read(ab2s(binContent), {type: 'binary', cellDates:true});
        return {sheets: wb.Sheets, sheetNames: wb.SheetNames};    
    };

    this.updateXlsxSheetAndDownload = function(xlsAsZip, positionOfSheetToUpdate, newContentOfSheet, downloadFileName) {
        return nl.q(function(resolve, reject) {
            var sheet = XLSX.utils.aoa_to_sheet(newContentOfSheet);
            var workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, sheet, 'sheet1');
            var wbout = XLSX.write(workbook, {bookType:'xlsx', type: 'binary', cellStyles: true});
            JSZip.loadAsync(wbout).then(function(zip2) {
                var f = zip2.file('xl/worksheets/sheet1.xml');
                f.async('arraybuffer').then(function(content) {
                    xlsAsZip.file(nl.fmt2('xl/worksheets/sheet{}.xml', positionOfSheetToUpdate), content);
                    if (!downloadFileName) return resolve(true);

                    nlExporter.saveZip(xlsAsZip, downloadFileName, null, function(sizeKb) {
                        return resolve(true);
                    }, function(e) {
                        return _errorResolve(resolve, nl.fmt2('Error saving xlsx: {}', e));
                    }); 
                }, function(e) {
                    return _errorResolve(resolve, nl.fmt2('Error getting content of new sheet: {}', e));
                });
            }, function(e) {
                return _errorResolve(resolve, nl.fmt2('Error loading new sheet xlsx: {}', e));
            });
        });
    };

    function ab2s(ab) {
            var bytes = new Uint8Array(ab);
            var bytelen = bytes.byteLength;
            var s = '';
            for (var i = 0; i < bytelen; ++i) s += String.fromCharCode(bytes[i]);
            return s;
    }

    function s2ab(s) {
        var buf = new ArrayBuffer(s.length);
        var view = new Uint8Array(buf);
        for (var i=0; i!=s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
        return buf;
    }

    function _errorResolve(resolve, msg) {
        if (msg) nlDlg.popupAlert({title: 'Error', template: msg});
        resolve(false);
        return false;
    }

}
//-------------------------------------------------------------------------------------------------
module_init();
})();

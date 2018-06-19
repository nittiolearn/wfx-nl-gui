(function() {

//-------------------------------------------------------------------------------------------------
// importer.js: 
// CSV reader + other utilities in future
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.importer', [])
    .service('nlImporter', NlImporter);
}

//-------------------------------------------------------------------------------------------------
var NlImporter = ['nl', 'nlDlg',
function(nl, nlDlg) {
    var self = this;

    this.readCsv = function(file, config) {
    	if (config === undefined) config = {};
        return nl.q(function(resolve, reject) {
            _readCsv(file, config, resolve, reject);
        });
    };
    
    this.readXls = function(file, config) {
    	if (config === undefined) config = {};
        return nl.q(function(resolve, reject) {
            _readXls(file, config, resolve, reject);
        });
    };
    
    this.readXlsFromArrayBuffer = function(content, config) {
    	if (config === undefined) config = {};
        return nl.q(function(resolve, reject) {
            _readXlsFromArrayBuffer(content, config, resolve, reject);
        });
    };

    function _readCsv(file, config, resolve, reject) {
        var reader = new FileReader();
        reader.onerror = function (e) {
            reject(e);
        };
        reader.onload = function (loadEvent) {
            var content = loadEvent.target.result;
            var rows = _splitIntoRows(content);
            var table = [];
            var error = false;
            var cols = null;
            for(var i=0; i<rows.length; i++) {
                var cells = _splitIntoCells(rows[i]);
                if (!cells) continue;
                if (cols === null) cols = cells.length;
                if (cols !== cells.length && !config.ignore_column_count) error = 'Not all rows have same number of columns';
                table.push(cells);
            }
            resolve({table:table, error:error, cols: cols});
        };
        reader.readAsText(file);
    }
    
    function _splitIntoRows(content) {
        content = content.replace(/\r/g, '');
        return content.split('\n');
    }
    
    function _splitIntoCells(row) {
        var cells = row.split(',');
        var ret = [];
        var bMergeNeeded = false;
        var mergeString = '';
        for (var i=0; i<cells.length; i++) {
            var cell = cells[i];
            cell = cell.replace(/^"(.*)"$/, '$1');
            var quoteStart = new RegExp('^"([^"]|"")');
            quoteStart = (quoteStart.test(cell) || cell == '"') ? true : false;
            var quoteEnd = new RegExp('([^"]|"")"$');
            quoteEnd = (quoteEnd.test(cell) || cell == '"') ? true : false;
            cell = cell.replace(/""/g, '"');
            if (quoteStart) cell = cell.replace(/^"/g, '');
            if (quoteEnd) cell = cell.replace(/"$/g, '');
            if (!bMergeNeeded && quoteStart) {
                bMergeNeeded = true;
                mergeString = cell;
                continue;
            } else if (bMergeNeeded) {
                if (quoteEnd) {
                    cell = mergeString + ',' + cell;
                    bMergeNeeded = false;
                    mergeString = '';
                } else {
                    mergeString += ',' + cell;
                    continue;
                }
            }
            ret.push(cell.trim());
        }
        if (bMergeNeeded) ret.push(mergeString.trim());
        var bEmpty = true;
        for (var i=0; i<ret.length; i++) {
            if (ret[i] != '') {
                bEmpty = false;
                break;
            }
        }
        if (bEmpty) return null;
        return ret;
    }

	//---------------------------------------------------------------------------------------------
    function _readXls(file, config, resolve, reject) {
        var reader = new FileReader();
        reader.onerror = function (e) {
            reject(e);
        };
        reader.onload = function (loadEvent) {
            var content = loadEvent.target.result;
			_readXlsFromArrayBuffer(content, config, resolve, reject);
        };
        reader.readAsArrayBuffer(file);
    }
    
	function _readXlsFromArrayBuffer(content, config, resolve, reject) {
    	if (!config.readParams) config.readParams = {type: 'array'};
		content = new Uint8Array(content);
		var wb = XLSX.read(content, config.readParams);
		var ret = {sheetNames: wb.SheetNames, sheets: {}};
		for (var i=0; i<wb.SheetNames.length; i++) {
			var sheetName = wb.SheetNames[i];
			var header = config.toJsonConfig || {header: 1};
			ret.sheets[sheetName] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], header);
			if (!config.singleSheet) continue;
			ret = ret.sheets[sheetName];
			break;
		}
        resolve(ret);
	}
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

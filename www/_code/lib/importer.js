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
        return nl.q(function(resolve, reject) {
            _readCsv(file, config, resolve, reject);
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
                if (cols !== cells.length) error = 'Not all rows have same number of columns';
                table.push(cells);
            }
            resolve({table:table, error:error, cols: cols});
        };
        reader.readAsText(file);
    }
    
    function _splitIntoRows(content) {
        content = content.replace(/[^\r]\n/g, ' '); // Multi line cells only have \n
        content = content.replace(/\r/g, '\n');
        content = content.replace(/\n\n/g, '\n');
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
            var quoteStart = new RegExp('^"[^"]');
            quoteStart = (quoteStart.test(cell) || cell == '"') ? true : false;
            var quoteEnd = new RegExp('[^"]"$');
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

}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

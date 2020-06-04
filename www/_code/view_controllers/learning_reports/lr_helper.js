(function() {

//-------------------------------------------------------------------------------------------------
// lr_helper.js: Assorted helpers used across modules in this folder
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.lr_helper', [])
	.config(configFn)
	.service('nlLrHelper', NlLrHelper);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
}];

//-------------------------------------------------------------------------------------------------
var NlLrHelper = ['nl', 'nlDlg', 'nlGroupInfo', 'nlImporter',
function NlLrHelper(nl, nlDlg, nlGroupInfo, nlImporter) {
	var _majorMetaHeaders = null;
	var _allMetaHeaders = null;
	var _userAttributeCols = null;
	var _groupInfo = null;
	var _customAttrDict = null;

	this.getUserAttrCols = function() {
		return _userAttributeCols;
	};

	this.getCustomAttrDict = function() {
		return _customAttrDict;
	};

	this.showImportUserAttrsDlg = function($scope) {
		_groupInfo = nlGroupInfo.get();
		return nl.q(function(resolve, reject) {
			var dlg = nlDlg.create($scope);
			dlg.setCssClass('nl-height-max nl-width-max');
			dlg.scope.error = {};
			dlg.scope.data = {filelist: []};
			dlg.scope.help = _getHelp();
			var importButton = {text: nl.t('Import'), onTap: function(e) {
				if(!_validateInputs(dlg.scope)) {
					e.preventDefault();
					return;
				}
				_onImport(e, resolve, dlg.scope);
			}};
			var cancelButton = {text: nl.t('Close'), onTap: function(e) {
			}};
			dlg.show('view_controllers/learning_reports/import_user_attrs_dlg.html', [importButton], cancelButton, false);
		});
	}
	function _getHelp() {
		return {
			filelist: {name: nl.t('Choose user attrs csv/xlsx'), help: _getCsvHelp(), isShown: true}
		};
	}

	function _getCsvHelp() {
		var help = '<div>';
		help += '<div class="padding-left"><ul><li class="padding-small">First row (header row) of spreadsheet is mandatory, Should have user attributes. </li>';
		help += '<li class="padding-small">First column should have user id.</li>';
		help += '</ul></div></div>';
		return help;
	}

	function _validateInputs(dlgScope) {
        if (dlgScope.data.filelist.length == 0) return _validateFail(dlgScope, 'filelist', 'Please select the spreadsheet to import.');
        return true;
    }

    function _onImport(e, resolve, dlgScope) {
    	nlDlg.showLoadingScreen();
        if (e) e.preventDefault();
        var csvFile = dlgScope.data.filelist[0].resource;
        var extn = dlgScope.data.filelist[0].extn;
        var importMethod = extn == '.csv' ? nlImporter.readCsv : nlImporter.readXls;
        importMethod(csvFile, {ignore_column_count: true}).then(function(result) {
            if (result.error) {
            	nlDlg.hideLoadingScreen();
                nlDlg.popupAlert({title:'Error message', template:nl.t('Error parsing CSV file: {}', result.error)});
                return;
            }
            var dataTable = extn == '.csv' ? result.table : result.sheets.Sheet1;
			var rows = _processCsvData(dataTable);
			nlDlg.hideLoadingScreen();
			nlDlg.closeAll();
			resolve(rows);
        }, function(e) {
            nlDlg.popupAlert({title:'Error message', template: nl.t('Error reading CSV file: {}', e)});
        });
    }

	function _processCsvData(table) {
		var data = {};
		var headerRow = _processHeaderRow(table[0]);
        for (var i=1; i<table.length; i++) {
			var row = _getRowObj(headerRow, table[i], i);
			data[table[i][0]] = row;
		}
		_customAttrDict = data;
    }

	function _processHeaderRow(row) {
		var ret = [];
			_userAttributeCols = [];
		   for (var i=0; i<row.length; i++) {
			var item = row[i];
				item = item.toLowerCase();
				item = item.replace(/ +/g, "");
			_userAttributeCols.push({id: 'cust'+item, name: row[i]});
			ret.push('cust'+item);
		}
		return ret;
	}
    function _getRowObj(header, row) {
		if(!row[0]) return null;
		var ret = {};
		for(var i=1; i<row.length; i++) ret[header[i]] = row[i];
		return ret;
	}

    this.getMetaHeaders = function(bOnlyMajor) {
    	if (bOnlyMajor) {
    		if (!_majorMetaHeaders)
	    		_majorMetaHeaders = _getMetaHeaders(bOnlyMajor);
    		return _majorMetaHeaders;
    	} else {
    		if (!_allMetaHeaders)
	    		_allMetaHeaders = _getMetaHeaders(bOnlyMajor);
    		return _allMetaHeaders;
    	}
    };

	function _getMetaHeaders(bOnlyMajor) {
        var headers = [];
        var metadata = nlGroupInfo.getUserMetadata(null);
        for(var i=0; i<metadata.length; i++) {
            if (bOnlyMajor && !metadata[i].major) continue;
            headers.push({id: metadata[i].id, name: metadata[i].name});
        }
        return headers;
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

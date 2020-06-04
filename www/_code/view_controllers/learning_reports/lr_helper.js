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
	var _userAttributeCols = [];

	this.getUserAttrCols = function() {
		return _userAttributeCols;
	};

	this.showImportUserAttrsDlg = function($scope) {
		return nl.q(function(resolve, reject) {
			var dlg = nlDlg.create($scope);
			dlg.setCssClass('nl-height-max nl-width-max');
			dlg.scope.error = {};
			dlg.scope.data = {filelist: []};
			dlg.scope.help = _getHelp();
			var importButton = {text: nl.t('Import'), onTap: function(e) {
				_onImport(e, resolve, dlg.scope);
			}};
			var cancelButton = {text: nl.t('Close'), onTap: function(e) {
			}};
			dlg.show('view_controllers/learning_reports/import_user_attrs_dlg.html', [importButton], cancelButton, false);
		});
	}
	function _getHelp() {
		return {
			filelist: {name: nl.t('Custom user attributes file'), help: _getCsvHelp(), isShown: true}
		};
	}

	function _getCsvHelp() {
		var help = 
		'<div>' + 
			'<div class="padding-mid">You may specify custom user attributes in a XLSX file and include those attributes in a custom view.</div>' +
			'<div class="padding-mid"><ul>' +
				'<li class="padding-small">First row (header row) of spreadsheet is mandatory.</li>' +
				'<li class="padding-small">First column should contain login user name.</li>' + 
				'<li class="padding-small">The rest of columns can be custom user attributes.</li>' + 
				'<li class="padding-small">Below is an example:</li>' + 
			'</ul></div>' +
			'<table class="nl-table nl-table-styled3 rowlines padding-mid">' +
				'<tr>' +
					'<th>User Id</th>' +
					'<th>Designation</th>' +
					'<th>Cost Center</th>' +
				'</tr>' +
				'<tr>' +
					'<td>empid1.mygrp</td>' +
					'<td>Associate L1</td>' +
					'<td>C2301</td>' +
				'</tr>' +
				'<tr>' +
					'<td>empid2.mygrp</td>' +
					'<td>Associate L1</td>' +
					'<td>C2301</td>' +
				'</tr>' +
				'<tr>' +
					'<td>empid3.mygrp</td>' +
					'<td>Manager M1</td>' +
					'<td>C2305</td>' +
				'</tr>' +
			'</table>' +
		'</div>';
		return help;
	}

    function _validateFail(scope, errMsg) {
		nl.timeout(function() {
			nlDlg.hideLoadingScreen();
		}, 100);
		return nlDlg.setFieldError(scope, 'filelist', errMsg);
    }

	function _onImport(e, resolve, dlgScope) {
    	nlDlg.showLoadingScreen();
        if (e) e.preventDefault();
		if (dlgScope.data.filelist.length == 0)
			return _validateFail(dlgScope, 'Please select the spreadsheet to import.');
        var inputFile = dlgScope.data.filelist[0].resource;
        var extn = dlgScope.data.filelist[0].extn;
        var importMethod = extn == '.csv' ? nlImporter.readCsv : nlImporter.readXls;
        importMethod(inputFile, {ignore_column_count: true}).then(function(result) {
            var dataTable = extn == '.csv' ? result.table : _getAoa(result);
			if (result.error || !dataTable)
				return _validateFail(dlgScope, nl.t('Error processing input file: {}.', result.error));
			if (!_processAoaData(dlgScope, dataTable)) return;
			resolve(true);
			nlDlg.hideLoadingScreen();
			nlDlg.closeAll();
        }, function(e) {
			dlgScope.data.filelist = [];
            _validateFail(dlgScope, nl.t('Error reading spreadsheet file: {}', e));
        });
    }

	function _getAoa(result) {
		if (!result.sheets || !result.sheetNames || !result.sheetNames.length) return null;
		return result.sheets[result.sheetNames[0]];
	}

	function _processAoaData(dlgScope, table) {
		if (table.length < 2)
			return _validateFail(dlgScope, nl.t('Header row and atleast 1 data row is expected in the spreadsheet.'));
		if (table[0].length < 2)
			return _validateFail(dlgScope, nl.t(' User Id column and atleast 1 custom user attribute column is expected in the spreadsheet.'));
		var data = {};
		var headerRow = _processHeaderRow(dlgScope, table[0]);
		if (!headerRow) return false;
        for (var i=1; i<table.length; i++) _getRowObj(table[i], headerRow, data);
		var cnt = nlGroupInfo.updateCustomAttrsOfCachedUsers(data);
		nlDlg.popupStatus(nl.t('Found custom attributes for {} users.', cnt));
		return true;
    }

	function _processHeaderRow(dlgScope, row) {
		var ret = [];
		_userAttributeCols = [];
		for (var i=1; i<row.length; i++) {
			var item = row[i] || '';
			item = item.trim();
			var key = item.toLowerCase();
			key = key.replace(/[^a-z0-9_]+/g, "_");
			if (!key) return _validateFail(dlgScope, nl.t('Invalid header in column {}', i+1));
			_userAttributeCols.push({id: 'user.custom.'+key, name: item});
			ret.push(key);
		}
		return ret;
	}

    function _getRowObj(row, header, data) {
		if(!row || row.length < 1 || !row[0]) return;
		var username = row[0].trim().toLowerCase();
		var userCustAttrs = {};
		for(var i=1; i<row.length && i<header.length+1; i++)
			userCustAttrs[header[i-1]] = (row[i] || '').trim();
		data[username] = userCustAttrs;
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

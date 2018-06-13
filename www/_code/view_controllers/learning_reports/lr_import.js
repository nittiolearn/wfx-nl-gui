(function() {

//-------------------------------------------------------------------------------------------------
// lr_import.js: Import learning records from external system
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.lr_import', [])
	.config(configFn)
	.controller('nl.LrImportCtrl', LrImportCtrl);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.lr_import', {
		url: '^/lr_import',
		views: {
			'appContent': {
				templateUrl: 'view_controllers/learning_reports/lr_import.html',
				controller: 'nl.LrImportCtrl'
			}
		}});
}];

var _SERVER_CHUNK_SIZE = 100;
var DEBUG_LOG = true;

var LrImportCtrl = ['nl', 'nlRouter', 'nlDlg', '$scope', 'nlGroupInfo', 'nlImporter', 'nlProgressLog',
function(nl, nlRouter, nlDlg, $scope, nlGroupInfo, nlImporter, nlProgressLog) {
	
	var _data = {};
	var _userInfo = null;
	
	function _init() {
	    $scope.error = {};
	    $scope.started = false;
	    $scope.running = false;
	    $scope.data = {filelist: [], validateOnly: true};
	    $scope.onImport = function(e) {
	        if (e) e.preventDefault();
	        _onImport();
	    };
	
	    _data.pl= nlProgressLog.create($scope);
	    _data.pl.showLogDetails(true);
	    if (!DEBUG_LOG) _data.pl.hideDebugAndInfoLogs();
	    _initImportOperation();
	}
	_init();

    function _initImportOperation() {
        _progressLevels = $scope.data.validateOnly ? _progressLevelsValidateOnly : _progressLevelsFull;
	    _data.pl.clear();
        _data.statusCnts = {total: 0, ignore: 0, process: 0, success: 0, error: 0};
        _data.records = [];
        _initHeaders();
    }
    
	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {
            nlGroupInfo.init().then(function() {
		        nlGroupInfo.update();
            	resolve(true);
            }, function(err) {
                resolve(false);
            });
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

	function _onImport() {
        _initImportOperation();
        if ($scope.data.filelist.length == 0) {
            $scope.error.filelist = 'Please select the CSV file';
            return;
        }
        _setProgress('start');
        $scope.started = true;
        $scope.running = true;
        var csvFile = $scope.data.filelist[0].resource;
        _data.pl.imp('Import started: ' + csvFile.name);
        nlImporter.readCsv(csvFile).then(function(result) {
            if (result.error)
            	return _error(nl.fmt2('Error parsing CSV file. {}', result.error));
            _data.pl.imp('Read successful', angular.toJson(result, 2));
            _setProgress('fileRead');
            if (!_processCsvRows(result.table)) return;
            if ($scope.data.validateOnly || _data.statusCnts.error > 0)
                return _done(true);
            _data.pl.imp(nl.fmt2('Processing CSV file successful - {} rows in CSV, {} unique learning records to be sent to server', 
                _data.statusCnts.total, _data.records.length), angular.toJson(_data.records, 2));
            _updateServer();
        }, function(e) {
            _error('Error reading CSV file', e);
        });
	}
	
	function _processCsvRows(rows) {
        var headers = _getHeaders(rows[0]);
        if (!headers) return false;
        
        var current = {key: null, records: []};
        for(var i=1; i<rows.length; i++) {
            _setProgress('processCsv', i, rows.length);
        	var row = _getRow(rows, i, headers);
        	if (!row) return false;
        	if (row.key == current.key) {
        		current.records.push(row);
		        if(_data.pl) _data.pl.debug(nl.fmt2('got row {}', i+1), angular.toJson(row, 2)); 
        		continue;
        	}
        	if (!_appendDbRecord(current)) return false;
        	current = {key: row.key, records: [row]};
	        if(_data.pl) _data.pl.debug(nl.fmt2('got row {}', i+1), angular.toJson(row, 2)); 
        }
    	if (!_appendDbRecord(current)) return false;
    	return true;
    }

	var _headerNameToInfo = {};
	
	function _initHeaders() {
		if (!_userInfo) return;
		_headerNameToInfo = {
			'Key': {id: 'key'},
			'User Id': {id: 'user_id', mandatory: true},
			'Type': {id: 'type', mandatory: true, vals: ['ILT', 'WBT']},
			'Course/Training Name': {id: 'name', mandatory: true},
			'Batch Name': {id: 'batchName'},
			'Instructor': {id: 'instructor'},
			'From': {id: 'from', type: 'date', mandatory: true},
			'Till': {id: 'till', type: 'date', mandatory: true},
			'Training Status': {id: 'status', mandatory: true, vals: ['pending', 'started', 'completed', 'passed', 'failed']},
			'Training Done Date': {id: 'doneDate', type: 'date'},
			'Module/Session Name': {id: 'moduleName'},
			'Module/Session Status': {id: 'moduleStatus', vals: ['pending', 'started', 'completed', 'passed', 'failed']},
			'Module/Session Done Date': {id: 'moduleDoneDate', type: 'date'},
			'Attempts': {id: 'attempts', type: 'int'},
			'Achieved %': {id: 'score', type: 'perc'},
			'Pass %': {id: 'passScore', type: 'perc'},
			'Time Spent (secs)': {id: 'timeInSecs', type: 'int'}
		};
		_headerNameToInfo[_userInfo.groupinfo.gradelabel] = {id: 'grade', mandatory: true, vals: _userInfo.groupinfo.grades};
		_headerNameToInfo[_userInfo.groupinfo.subjectlabel] = {id: 'subject', mandatory: true, vals: _userInfo.groupinfo.subjects};
		
	}
	
	function _getHeaders(row) {
		var headersDict = {};
		var headers = [];
		for(var i=0; i<row.length; i++) {
			var header = row[i] || '';
			if (!(header in _headerNameToInfo)) {
				headers.push(null);
				continue;
			}
			headersDict[header] = i;
			headers.push(_headerNameToInfo[header]);
		}
		for(var header in _headerNameToInfo) {
			_headerNameToInfo[header].name = header;
			if (header in headersDict) continue;
			return _error(nl.fmt2('Mandatory header {} missing', header));
		}
        if(_data.pl) _data.pl.debug('got headers', headers); 
		return headers;
	}

	function _getRow(rows, pos, headers) {
		var row = rows[pos];
		pos++;
        _data.statusCnts.total++;
        if (row.length != headers.length)
        	return _error(nl.fmt2('row {} has {} columns. {} expected.', pos, row.length, headers.length));

        var rowObj = {pos: pos};
		for(var i=0; i<row.length; i++) {
			var info = headers[i];
			if (!info) continue;
			var validated = _validateValue(row[i], info, pos);
			if (!validated) return null;
			rowObj[info.id] = validated.val;
		}
		return rowObj;
	}

	function _validateValue(cell, info, pos) {
		var val = cell || null;
		if (val == null) {
			if (!info.mandatory) return {val: null};
			return _error(nl.fmt2('row {}, mandatory attr {} missing', pos, info.name));
		}
		if (info.vals) {
			var bFound = false;
			for(var j=0; j<info.vals.length; j++) {
				if (val != info.vals[j]) continue;
				bFound = true;
				break;
			}
			if (!bFound)
				return _error(nl.fmt2('row {}, attr {} has a value that is not allowed: {}', pos, info.name, cell));
		}
		if (info.type == 'int' || info.type == 'perc') {
			val = parseInt(val);
			if (isNaN(val)) {
				return _error(nl.fmt2('row {}, attr {} integer value expected: {}', pos, info.name, cell));
			} else if (info.type == 'perc' && (val < 0 || val > 100)) {
				return _error(nl.fmt2('row {}, attr {} integer value expected: {}', pos, info.name, cell));
			}
		} else if (info.type == 'date') {
			if (val.indexOf('date:') == 0) val = val.substring(5);
			val = nl.fmt.json2Date(val);
		}
		return {val: val};
	}
	
	function _appendDbRecord(current) {
    	if (!current.key || current.records.length == 0) return true;
        if(_data.pl) _data.pl.debug('forming db record', angular.toJson(current, 2)); 
    	current.dbRec = {children: []};
    	var uniqueModuleNames = {};
    	for (var i=0; i<current.records.length; i++) {
			var rec = current.records[i];
    		if (!_updateAttrs(rec, current.dbRec, 
    			['user_id', 'type', 'name', 'batchName', 'instructor', 'from', 'till', 'grade', 'subject', 
    			 'status', 'doneDate'])) return false;
    		if (rec.moduleName in uniqueModuleNames)
    			return _error(nl.fmt2('Record {}: module name is not unique within same training', rec.pos));
    		current.dbRec.children.push({name: rec.moduleName, status: rec.moduleStatus, 
    			doneDate: rec.moduleDoneDate, attempts: rec.attempts, score: rec.score, passScore: rec.passScore,
    			timeInSecs: rec.timeInSecs});
    	}
		_data.records.push(current);
		return true;
	}

	function _updateAttrs(src, dst, attrs) {
		for(var i=0; i<attrs.length; i++) {
			var attr = attrs[i];
			if (!(attr in dst)) {
				dst[attr] = src[attr];
				continue;
			}
			if (_isEqual(src[attr], dst[attr])) continue;
			return _error(nl.fmt2('row {}, attr {}: value not same as above row', src.pos, attr));
		}
		return true;
	}

	function _isEqual(a, b) {
		if (a instanceof Date) return a.getTime() == b.getTime();
		return a== b;
	}

    function _updateServer(rows) {
        // TODO-NOW
        if(_data.pl) _data.pl.imp('TODO-NOW: updateServer: implementation pending', 
        	angular.toJson(_data.records, 2));
        _done();
    }
    
    function _error(msg, e) {
        _data.statusCnts.error++;
        _setProgress('done');
        if (e && e.message) msg += nl.fmt2(': {}', e.message);
        var data = e && e.obj ? e.obj : _data.statusCnts;
        if(_data.pl) _data.pl.imp('Status counts', angular.toJson(_data.statusCnts, 2));
        if(_data.pl) _data.pl.error(msg, angular.toJson(data, 2));
        $scope.running = false;
    	return null;
    }
    
    function _done(validateOnly) {
        _setProgress('done');
        if (validateOnly) {
        	var msg = 'Validation done - no upload done: total:{}, error: {}';
	        msg = nl.fmt2(msg, _data.statusCnts.total, _data.statusCnts.error);
        } else {
	        var msg = _data.statusCnts.error > 0 ? 'Import done with errors: ' : 'Import successful: ';
	        msg += ' total:{}, records sent to server: {}, success: {}, error: {}';
	        msg = nl.fmt2(msg, _data.statusCnts.total, _data.statusCnts.process,
	            _data.statusCnts.success, _data.statusCnts.error);
        }
	            	
        if (_data.statusCnts.error > 0) {
            if(_data.pl) _data.pl.error(msg, angular.toJson(_data.statusCnts, 2));
        } else {
            if(_data.pl) _data.pl.imp(msg, angular.toJson(_data.statusCnts, 2));
        }
        $scope.running = false;
        return true;
    }
    
    var _progressLevelsFull = {
        start: [0, 0],
        fileRead: [0, 2],
        processCsv: [2, 20],
        uploadToServer: [20, 99],
        done: [99, 100]
    };
    
    var _progressLevelsValidateOnly = {
        start: [0, 0],
        fileRead: [0, 2],
        processCsv: [2, 99],
        uploadToServer: [99, 99],
        done: [99, 100]
    };

    var _progressLevels = null;

    function _setProgress(currentAction, doneSubItems, maxSubItems) {
        if (!_data.pl) return;
        if (doneSubItems !== 0 && !doneSubItems) doneSubItems = 1;
        if (!maxSubItems) maxSubItems = 1;
        var levels = _progressLevels[currentAction];
        var p = levels[0] + (doneSubItems/maxSubItems)*(levels[1] - levels[0]);
        _data.pl.progress(p);
    };

}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

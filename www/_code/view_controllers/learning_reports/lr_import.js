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

var LrImportCtrl = ['nl', 'nlRouter', 'nlDlg', '$scope', 'nlGroupInfo', 'nlImporter', 'nlProgressLog', 'nlServerApi',
function(nl, nlRouter, nlDlg, $scope, nlGroupInfo, nlImporter, nlProgressLog, nlServerApi) {
	
	var _data = {};
	var _userInfo = null;
	var _groupInfo = null;
    var _SERVER_CHUNK_SIZE = 200;
    var _ENABLE_DEBUG = true; 
	
	function _init() {
	    $scope.error = {};
	    $scope.started = false;
	    $scope.running = false;
	    $scope.data = {filelist: [], validateOnly: true};
	    $scope.onImport = function(e) {
	        if (e) e.preventDefault();
	        _onImport();
	    };
	
		_data.pastUserInfo = null;
	    _data.pl= nlProgressLog.create($scope);
	    _data.pl.showLogDetails(true);
	    if (!_ENABLE_DEBUG) _data.pl.hideDebugAndInfoLogs();
	    
	    var params =  nl.location.search();
	    if (params.max) _SERVER_CHUNK_SIZE=parseInt(params.max);
	    if (params.debug) _ENABLE_DEBUG=true;
	    _initImportOperation();
	}
	_init();

    function _initImportOperation() {
        _progressLevels = $scope.data.validateOnly ? _progressLevelsValidateOnly : _progressLevelsFull;
	    _data.pl.clear();
        _data.statusCnts = {total: 0, ignore: 0, process: 0, success: 0, error: 0};
        _data.records = [];
        _data.results = [];
        _initHeaders();
    }
    
	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {
            nlGroupInfo.init().then(function() {
		        nlGroupInfo.update();
		        _groupInfo = nlGroupInfo.get();
		        if (!nlGroupInfo.isPastUserXlsConfigured(_groupInfo)) {
		        	resolve(true);
		        	return;
		        }
	        	nlDlg.popupStatus('Geting past user info ...', false);
	        	nlGroupInfo.fetchPastUserXls(_groupInfo).then(function(result) {
		        	nlDlg.popdownStatus(0);
		        	if (!result) {
		        		resolve(false);
		        		return;
		        	}
		        	_data.pastUserInfo = result;
		        	resolve(true);
	        	});
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
            _processCsvRows(result.table, function(result) {
            	if (!result) return _error('Processing failed');
	            _data.pl.imp(nl.fmt2('Processing CSV file successful - {} rows in CSV, {} unique learning records to be sent to server', 
	                _data.statusCnts.total, _data.records.length), angular.toJson(_data.records, 2));
	            if ($scope.data.validateOnly || _data.statusCnts.error > 0)
	                return _done(true);
	            _updateServer();
	            return true;
            });
        }, function(e) {
            _error('Error reading CSV file', e);
        });
	}
	
	function _processCsvRows(rows, onDone) {
        var headers = _getHeaders(rows[0]);
        if (!headers) return false;
        
        var current = {key: null, records: []};
        _processCsvRowChunk(rows, headers, current, 1, onDone);
   }

	function _processCsvRowChunk(rows, headers, current, start, onDone) {
		if (start >= rows.length) return onDone(true);
        for(var i=start; i<rows.length; i++) {
	        if (i - start == 100) {
	        	nl.timeout(function() {
	        		_processCsvRowChunk(rows, headers, current, i, onDone);
	        	});
	        	return true;
	        }
            _setProgress('processCsv', i, rows.length);
        	var row = _getRow(rows, i, headers);
        	if (!row) return onDone(false);
        	if (row.key == current.key) {
        		current.records.push(row);
		        if(_data.pl) _data.pl.debug(nl.fmt2('got row {}', i+1), angular.toJson(row, 2)); 
        		continue;
        	}
        	if (!_appendDbRecord(current)) return onDone(false);
        	current = {key: row.key, records: [row]};
	        if(_data.pl) _data.pl.debug(nl.fmt2('got row {}', i+1), angular.toJson(row, 2));
        }
    	if (!_appendDbRecord(current)) return onDone(false);
    	return onDone(true);
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
        	return _error2(nl.fmt2('row {} has {} columns. {} expected.', pos, row.length, headers.length));

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
			return _error2(nl.fmt2('row {}, mandatory attr {} missing', pos, info.name));
		}
		if (info.vals) {
			var bFound = false;
			for(var j=0; j<info.vals.length; j++) {
				if (val != info.vals[j]) continue;
				bFound = true;
				break;
			}
			if (!bFound)
				return _error2(nl.fmt2('row {}, attr {} has a value that is not allowed: {}', pos, info.name, cell));
		}
		if (info.type == 'int' || info.type == 'perc') {
			val = parseInt(val);
			if (isNaN(val)) {
				return _error2(nl.fmt2('row {}, attr {} integer value expected: {}', pos, info.name, cell));
			} else if (info.type == 'perc' && (val < 0 || val > 100)) {
				return _error2(nl.fmt2('row {}, attr {} integer value expected: {}', pos, info.name, cell));
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

        var keyParts = current.key.split(':');
        if (keyParts.length != 2 || keyParts[0] != 'id')
			return _error2(nl.fmt2('row: {}, key: {}: unexpected key format', current.records[0].pos, current.key));
		current.importid = parseInt(keyParts[1]);
		if (isNaN(current.importid)) return _error2(nl.fmt2('row: {}, key: {}: id part of key must be a number', current.records[0].pos, current.key));
        
    	var reportRecordInfo = {};
    	var modules = [];
    	var uniqueModuleNames = {};
    	for (var i=0; i<current.records.length; i++) {
			var rec = current.records[i];
    		if (!_updateAttrs(rec, reportRecordInfo, 
    			['user_id', 'type', 'name', 'batchName', 'instructor', 'from', 'till', 'grade', 'subject', 
    			 'status', 'doneDate'])) return false;
    		if (rec.moduleName in uniqueModuleNames)
    			return _error2(nl.fmt2('Record {}: module name is not unique within same training', rec.pos));
    		modules.push({name: rec.moduleName, status: rec.moduleStatus, 
    			doneDate: rec.moduleDoneDate, attempts: rec.attempts, score: rec.score, passScore: rec.passScore,
    			timeInSecs: rec.timeInSecs});
    	}

    	_getDbRecord(current, reportRecordInfo, modules);
    	if (!current.dbRec) return false;
		_data.records.push(current);
		return true;
	}

	var REPORT_SCHEMA_VERSION = 116;
	function _getDbRecord(current, reportRecordInfo, moduleInfos) {
		var username = reportRecordInfo.user_id + '.' + _groupInfo.grpid;
        var user = _groupInfo.derived.keyToUsers[username];
        if (!user) user = _data.pastUserInfo[reportRecordInfo.user_id];
        if (!user && _data.pl) _data.pl.warn(nl.fmt2('User {} not found.', reportRecordInfo.user_id));
		current.dbRec = {student: user ? user.id : 0, 
			created: reportRecordInfo.from, updated: reportRecordInfo.till, 
			completed: reportRecordInfo.status == 'completed', deleted: false, 
			assigntype: reportRecordInfo.type == 'WBT' ? _nl.atypes.ATYPE_COURSE : _nl.atypes.ATYPE_TRAINING,
			ctype: reportRecordInfo.type == 'WBT' ? _nl.ctypes.CTYPE_COURSE : _nl.ctypes.CTYPE_TRAINING,
			lesson_id: 0, assignment: 0, containerid: 0, assignor: 0, importid: current.importid, 
			schemaversion: REPORT_SCHEMA_VERSION};
		if(!_updateUserQueryFeildsInRecord(current.dbRec, user)) return false;
		
		if (reportRecordInfo.type == 'WBT') return _updateContentForCourse(current, reportRecordInfo, moduleInfos);
		return _updateContentForTraining(current, reportRecordInfo, moduleInfos);
	}
	
	function _updateContentForTraining(current, reportRecordInfo, moduleInfos) {
		current.dbRec.content = {sessions: [], trainingStatus: {},
			trainername: reportRecordInfo.instructor, studentname: reportRecordInfo.user_id, 
			kindName: reportRecordInfo.name, name: reportRecordInfo.batchName,
			start: reportRecordInfo.from, end: reportRecordInfo.till, desc: '', kindDesc: '',
			grade: reportRecordInfo.grade, subject: reportRecordInfo.subject, venue: '',
			costInfra: '', costTrainer: '', costFood: '', costTravel: '', costMisc: '',
			ctype: _nl.ctypes.CTYPE_MODULE, moduleid: 0, modulename: '', moduleicon: '',
			training_kind: 0};
		
		var ts = current.dbRec.content.trainingStatus;
		if (reportRecordInfo.status == 'pending') ts.overallStatus1 = 'pending';
		else if (reportRecordInfo.status == 'started') ts.overallStatus1 = 'partial';
		else ts.overallStatus1 = 'completed';
		ts.childReportId = null;
		ts.childStatus = null;
		ts.sessions = {}; // Not used in this case!
		ts.lessonReports = {};
		var sessions = current.dbRec.content.sessions;
		for(var i=0; i<moduleInfos.length; i++) {
			var moduleInfo = moduleInfos[i];
			sessions.push({type: 'lesson', name: moduleInfo.name || '', maxAttempts: 0});
			var lessonReport = {completed: moduleInfo.status && moduleInfo.status != 'pending' && moduleInfo.status != 'started',
				started: reportRecordInfo.from, ended: moduleInfo.doneDate, timeSpentSeconds: moduleInfo.timeInSecs,
				selfLearningMode: moduleInfo.passScore ? false : true};
			if (moduleInfo.attempts) lessonReport.attempt = moduleInfo.attempts;
			if (!lessonReport.selfLearningMode) {
				lessonReport.passScore = moduleInfo.passScore;
				lessonReport.maxScore = 100;
				lessonReport.score = moduleInfo.score;
			}
			ts.lessonReports[i] = lessonReport;
		}
		current.dbRec.content = angular.toJson(current.dbRec.content);
		return true;
	}
	
	function _updateContentForCourse(current, reportRecordInfo, moduleInfos) {
		current.dbRec.content = {lessonReports: {}, name: reportRecordInfo.name, remarks: reportRecordInfo.batchName,
			icon: 'icon:', from: reportRecordInfo.from, till: reportRecordInfo.till,
			sendername: reportRecordInfo.instructor, studentname: reportRecordInfo.user_id, 
			content: {modules: [], contentmetadata: {grade: reportRecordInfo.grade, subject: reportRecordInfo.subject}}};

		var modules = current.dbRec.content.content.modules;
		var lessonReports = current.dbRec.content.lessonReports;
		if (moduleInfos.length > 1 || moduleInfos[0].name) {
			for(var i=0; i<moduleInfos.length; i++) {
				var moduleInfo = moduleInfos[i];
				var moduleId = '_id' + i;
				modules.push({id: moduleId, type: 'lesson', parentId: '_root', name: moduleInfo.name,
					maxAttempts: 0});
				if (moduleInfo.status == 'pending') continue;
				var lessonReport = {attempt: moduleInfo.attempts, score: moduleInfo.score, maxScore: 100,
					passScore: moduleInfo.passScore, selfLearningMode: moduleInfo.passScore ? false : true,
					completed: moduleInfo.status != 'started', started: reportRecordInfo.from, ended: moduleInfo.doneDate, 
					timeSpentSeconds: moduleInfo.timeInSecs};
				lessonReports[moduleId] = lessonReport;
			}
		}
		var moduleId = '_id' + moduleInfos.length;
		modules.push({id: moduleId, type: 'lesson', parentId: '_root', name: 'Overall completion'});
		if (reportRecordInfo.status != 'pending') {
			var lessonReport = {attempt: 1, score: 0, maxScore: 100, passScore: 0, selfLearningMode: true,
				completed: reportRecordInfo.status != 'started', started: reportRecordInfo.from, 
				ended: reportRecordInfo.doneDate, timeSpentSeconds: moduleInfos[0].timeInSecs};
			lessonReports[moduleId] = lessonReport;
		}
		current.dbRec.content = angular.toJson(current.dbRec.content);
		return true;
	}
	
	function _updateUserQueryFeildsInRecord(record, user) {
		if (!user) return true;
	    var ou = user.org_unit || '';
	    _splitOnDotsAndStore(ou, record, 'ou');
	    var metadata = nlGroupInfo.getUserMetadataDict(user);
	    var location = metadata.meta_location || '';
	    _splitOnDotsAndStore(location, record, 'loc');
	    if (user.supervisor) record.supervisor = user.supervisor;
	    return true;
	}

	function _splitOnDotsAndStore(inputStr, outputObj, outputAttr) {
	    var splitArray = inputStr.split('.');
	    var maxLen = splitArray.length;
	    if (maxLen > 3) maxLen = 3;
	    for (var i=0; i<maxLen; i++)
	        outputObj[outputAttr + i] = splitArray[i];
	}
	
	function _updateAttrs(src, dst, attrs) {
		for(var i=0; i<attrs.length; i++) {
			var attr = attrs[i];
			if (!(attr in dst)) {
				dst[attr] = src[attr];
				continue;
			}
			if (_isEqual(src[attr], dst[attr])) continue;
			return _error2(nl.fmt2('row {}, attr {}: value not same as above row', src.pos, attr));
		}
		return true;
	}

	function _isEqual(a, b) {
		if (a instanceof Date) return a.getTime() == b.getTime();
		return a== b;
	}

    function _updateServer() {
        if(_data.pl) _data.pl.imp('Updating at server', 
        	angular.toJson(_data.records, 2));
        _updateChunkToServer(0);
    }

    function _updateChunkToServer(start) {
    	if (start >= _data.records.length) {
            if(_data.pl) _data.pl.imp(nl.fmt2('{} updates processed at server', _data.results.length), 
            	angular.toJson(_data.results, 2));
    		return _done();
    	}
		_setProgress('uploadToServer', start, _data.records.length);
    	var recordsToServer = [];
    	var chunkSize = _SERVER_CHUNK_SIZE;
    	if (start + chunkSize > _data.records.length) chunkSize = _data.records.length - start;
    	for(var i=start; i<start+chunkSize; i++) {
    		var r = _data.records[i];
    		recordsToServer.push({data: r.dbRec, pos: r.records[0].pos});    		
    	}
        if(_data.pl) _data.pl.debug(nl.fmt2('sending chunk {} to {} to server', start+1, start+chunkSize), 
        	angular.toJson(recordsToServer, 2));
        _data.statusCnts.process += chunkSize;
        nlServerApi.learningReportsImport({updates: recordsToServer})
        .then(function(result) {
	        for(var i=0; i<result.length; i++) {
	        	_data.results.push(result[i]);
	        	if (result[i].ok) _data.statusCnts.success++;
	        	else _data.statusCnts.error++;
	        }
	        _updateChunkToServer(start+chunkSize);
        }, function(e) {
	        _data.statusCnts.error += chunkSize;
	        for(var i=0; i<chunkSize; i++) _data.results.push({ok: false, msg: e});
        	_error(nl.fmt2('Error processing at server: {}', e));
        });
    }
    
    function _error2(msg, data) {
        _data.statusCnts.error++;
        if(_data.pl) _data.pl.error(msg, angular.toJson(data, 2));
    	return null;
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

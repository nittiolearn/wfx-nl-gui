(function() {

//-------------------------------------------------------------------------------------------------
// training_report.js:
// training module: reports for offline training
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.training_report', [])
	.config(configFn)
	.service('nlTrainingReport', nlTrainingReportSrv);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
}];

//-------------------------------------------------------------------------------------------------
var nlTrainingReportSrv = ['nl', 'nlDlg', 'nlRouter', 'nlServerApi', 'nlRangeSelectionDlg', 'nlGroupInfo', 'nlExporter',
function(nl, nlDlg, nlRouter, nlServerApi, nlRangeSelectionDlg, nlGroupInfo, nlExporter) {
	
	this.exportToCsv = function($scope, userInfo, kinds) {
		nlDlg.showLoadingScreen();
        if (_pageFetcher.fetchInProgress()) return _errorMsg('Processing is already in progress');
        nlRangeSelectionDlg.show($scope, true).then(function(filters) {
			_initFetchParams(userInfo, null, filters.updatedFrom, filters.updatedTill);
			_fetchRecords(false, function() {
				_exportToCsv(function() {
					nlDlg.hideLoadingScreen();
				}, function() {
					nlDlg.hideLoadingScreen();
				});
			});
		});
	};

	//---------------------------------------------------------------------------------------------
	var _params = null; 
	var _argv = null;
	var _records = [];
    var _pageFetcher = nlServerApi.getPageFetcher({defMax: 50, itemType: 'training record'});
    var _reportCsv = new ReportCsv(nl, nlGroupInfo, nlExporter);

    function _initFetchParams(userInfo, kindId, createdfrom, createdtill) {
        var params = nl.location.search();
    	_argv = {limit: ('limit' in params) ? parseInt(params.limit) : 5000, 
    		exportids: nlRouter.isPermitted(userInfo, 'nittio_support')};
		_params = {mode: nlRouter.isPermitted(userInfo, 'assignment_manage') ? 'all' :  'mine',
			filters: [{field: 'ctype', val: _nl.ctypes.CTYPE_TRAINING}]};
		if (kindId) _params.filters.append({field: 'lesson_id', val: kindId});
		if (createdfrom) _params.createdfrom = createdfrom;
		if (createdtill) _params.createdtill= createdtill;
    }
    
    function _fetchRecords(fetchMore, resolve) {
    	if (!fetchMore) {
    		_records = [];
    	}
        _pageFetcher.fetchBatchOfPages(nlServerApi.learningReportsGetList, _params, fetchMore, 
        function(results, batchDone, promiseHolder) {
            if (!results) {
                resolve(false);
                return;
            }
            for(var i=0; i<results.length; i++) {
            	_records.push(_processRecord(results[i]));
            }
            if (batchDone) resolve(true);
        }, _argv.limit);
    }
    
    function _processRecord(record) {
    	record.content = angular.fromJson(record.content);
    	record.content.start = nl.fmt.json2Date(record.content.start);
    	record.content.end = nl.fmt.json2Date(record.content.end);
        record.user = nlGroupInfo.getUserObj(''+record.student);
        record.usermd = _getMetadataDict(record.user);
        var ts = record.content.trainingStatus || {};
        var usessions = ts.sessions || {};
        if (!record.content.sessions) record.content.sessions = [];
        var sessions = record.content.sessions;
        record.stats = {timeSpent: 0, overallStatus: 'completed'};
        if (sessions.length == 0) {
        	record.stats.overallStatus = ts.overallStatus || 'pending';
        	return record;
        }
        var doneCnt = 0;
        for (var i=0; i<sessions.length; i++) {
        	var session = sessions[i];
        	session.status = usessions[''+i] || 'pending';
        	if (session.status != 'pending') {
        		session.timeSpent = session.duration;
        		record.stats.timeSpent += session.duration;
        		doneCnt++;
        	} else {
        		session.timeSpent = 0;
        	}
        }
		record.stats.overallStatus = (doneCnt == 0) ? 'pending' : (doneCnt == sessions.length) ? 'completed' : 'partial';
    	return record;
    }

    function _getMetadataDict(user) {
        var metadata = nlGroupInfo.getUserMetadata(user);
        var ret = {};
        for(var i=0; i<metadata.length; i++)
            ret[metadata[i].id] = metadata[i].value|| '';
        return ret;
    }

    function _exportToCsv(resolve, reject) {
        var zip = new JSZip();
        var header = _reportCsv.getCsvHeader(_argv.exportids);
        var rows = [];
        for(var i=0; i<_records.length; i++) {
        	var ret = _reportCsv.getCsvRows(_records[i], _argv.exportids);
        	for (var j=0; j<ret.length; j++)
	        	rows.push(ret[j]);
        }
        _addToZip(zip, header, rows);
        nlExporter.saveZip(zip, 'TrainingReport.zip', null, resolve, reject);
    }

    var _CSV_DELIM = '\n';
    function _addToZip(zip, header, rows) {
        var csvRows = [nlExporter.getCsvString(header)];
        for(var i=0; i<rows.length; i++)
	    	csvRows.push(nlExporter.getCsvString(rows[i]));
        var content = csvRows.join(_CSV_DELIM);
        console.log(content);
        zip.file('training-report.csv', content);
    }

	function _errorMsg(msg) {
		nlDlg.PopupAlert({title: 'Error', template: msg});
		return false;
	}
}];

function ReportCsv(nl, nlGroupInfo, nlExporter) {
	var self = this;

	var _userHeaders = 	['User Id', 'User Name', 'Email Id', 'Org'];
	var _trainingHeaders = ['Type', 'Training Name', 'Batch Name', 'From', 'Till', 'Session', 'Status', 'Time Spent (minutes)'];
	var _costHeaders = ['Infra Cost', 'Trainer Cost', 'Food Cost', 'Travel Cost', 'Misc Cost'];
	var _idHeaders = ['Training Report Id', 'Training Batch Id', 'Training Id'];
	
    this.getMetaHeaders = function(bOnlyMajor) {
        var headers = [];
        var metadata = nlGroupInfo.getUserMetadata(null);
        for(var i=0; i<metadata.length; i++) {
            if (bOnlyMajor && !metadata[i].major) continue;
            headers.push({id: metadata[i].id, name: metadata[i].name});
        }
        return headers;
    };

    this.getCsvHeader = function(exportIdTypes) {
        var headers = angular.copy(_userHeaders);
        var mh = this.getMetaHeaders(false);
        for(var i=0; i<mh.length; i++) headers.push(mh[i].name);
        headers = headers.concat(_trainingHeaders);
        headers = headers.concat(_costHeaders);
        if (exportIdTypes)
            headers = headers.concat(_idFields);
        return headers;
    };

    this.getCsvRows = function(record, exportIdTypes) {
    	var csvRows = [];
    	var csvRow = [];
    	csvRows.push(csvRow);
    	_fillUserFields(csvRow, record);
    	_fillTrainingFields(csvRow, record);
    	_fillCostFields(csvRow, record);
    	_fillIdFields(csvRow, exportIdTypes ? record : null);
    	for (var i=0; i<record.content.sessions.length; i++) {
    		var session = record.content.sessions[i];
    		var childRow = [];
    		csvRows.push(childRow);
	    	_fillUserFields(childRow, record);
	    	_fillTrainingFields(childRow, record, session);
	    	_fillCostFields(childRow, null);
	    	_fillIdFields(childRow, exportIdTypes ? record : null);
    	}
    	return csvRows;
    };
    
	function _fillUserFields(ret, record) {
        ret.push(record.user.user_id);
        ret.push(record.user.name);
        ret.push(record.user.email);
        ret.push(record.user.org_unit);
        var mh = self.getMetaHeaders(false);
        for(var i=0; i<mh.length; i++) ret.push(record.usermd[mh[i].id]);
	}

	function _fillTrainingFields(ret, record, session) {
        ret.push(session ? 'training session': 'training');
        ret.push(record.content.kindName || '');
        ret.push(record.content.name || '');
        ret.push(session ? '' : record.content.start ? nl.fmt.date2Str(record.content.start) : '');
        ret.push(session ? '' : record.content.end ? nl.fmt.date2Str(record.content.end): '');
        ret.push(session ? session.name || '' : 'All sessions');
        ret.push(session ?  session.status || 'pending' : record.stats.overallStatus || 'pending');
        ret.push(session ? session.timeSpent : record.stats.timeSpent);
	}

	function _fillCostFields(ret, record) {
        ret.push(record ? record.content.costInfra || '' : '');
        ret.push(record ? record.content.costTrainer || '' : '');
        ret.push(record ? record.content.costFood || '' : '');
        ret.push(record ? record.content.costTravel || '' : '');
        ret.push(record ? record.content.costMisc || '' : '');
	}

	function _fillIdFields(ret, record) {
        ret.push(record ? record.id : '');
        ret.push(record ? record.assignment : '');
        ret.push(record ? record.lesson_id : '');
	}

}

//-------------------------------------------------------------------------------------------------
module_init();
})();

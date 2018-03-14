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
var nlTrainingReportSrv = ['nl', 'nlDlg', 'nlRouter', 'nlServerApi', 'nlRangeSelectionDlg', 'nlExporter',
function(nl, nlDlg, nlRouter, nlServerApi, nlRangeSelectionDlg, nlExporter) {
	
	this.init = function(userInfo, nlGroupInfoService) {
		nlGroupInfo = nlGroupInfoService;
		_userInfo = userInfo;
    	_reportCsv = new ReportCsv(nl, nlGroupInfo, nlExporter);
        var params = nl.location.search();
    	_argv = {limit: ('limit' in params) ? parseInt(params.limit) : 5000, 
    		all: (params.type == 'all'),
    		exportids: nlRouter.isPermitted(_userInfo, 'nittio_support')};
	};
	
    this.processRecord = function(record) {
    	return _processRecord(record);
    };
    
    this.getStatusInfo = function(inputStatus) {
		return _getStatusInfo(inputStatus);
	};
		
	this.exportToCsv = function($scope, kinds) {
        if (_pageFetcher.fetchInProgress()) return _errorMsg('Processing is already in progress');
        nlRangeSelectionDlg.show($scope, true).then(function(filters) {
        	if (!filters) return;
			_initFetchParams(null, filters.updatedFrom, filters.updatedTill);
			nlDlg.showLoadingScreen();
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
	var nlGroupInfo = null;
	var _params = null; 
	var _argv = null;
	var _userInfo = null;
	var _records = [];
    var _pageFetcher = nlServerApi.getPageFetcher({defMax: 50, itemType: 'training record'});
    var _reportCsv = null;

    function _initFetchParams(kindId, createdfrom, createdtill) {
		_params = {mode: _argv.all ? 'all' :  'mine',
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
    	if (nlGroupInfo) {
	        record.user = nlGroupInfo.getUserObj(''+record.student);
	        record.usermd = _getMetadataDict(record.user);
    	}
		if (!('trainingStatus' in record.content))
			record.content['trainingStatus'] = {overallStatus: 'pending', childReportId: null, childStatus: null, sessions: {}};
        var ts = record.content.trainingStatus;
        if (!ts.overallStatus) ts.overallStatus = 'pending';
        if (!ts.sessions) ts.sessions = {};
        ts.timeSpent = 0;
        
        _updateStatusAndTimes(record, ts);
        record.statusInfo = _getStatusInfo(ts.overallStatus);
    	return record;
    }
    
    function _updateStatusAndTimes(record, ts) {
        var usessions = ts.sessions;
        if (!record.content.sessions) record.content.sessions = [];
        var sessions = record.content.sessions;
        if (sessions.length == 0) return;

        var doneCnt = 0;
        for (var i=0; i<sessions.length; i++) {
        	var session = sessions[i];
        	session.status = usessions[i] || 'pending';
        	session.statusInfo = _getStatusInfo(session.status);
        	if (session.status != 'pending') {
        		session.timeSpent = session.duration;
        		ts.timeSpent += session.duration;
        		doneCnt++;
        	} else {
        		session.timeSpent = 0;
        	}
        }
		ts.overallStatus = (doneCnt == 0) ? 'pending' : (doneCnt == sessions.length) ? 'completed' : 'partial';
    }

    function _getMetadataDict(user) {
    	if (!nlGroupInfo) return {};
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

    var _STATES = {
        pending: {icon: 'ion-ios-circle-filled fgrey', title: 'Pending'},
        partial: {icon: 'ion-checkmark-circled forange', title: 'Partially Done'},
        completed: {icon: 'ion-checkmark-circled fgreen', title: 'Done'}
    };

	function _getStatusInfo(inputStatus) {
		if (!(inputStatus in _STATES)) inputStatus = 'pending';
		var status = _STATES[inputStatus];
		var htmlFmt = '<div class="row row-center padding0 margin0"><i class="icon fsh4 padding-small {}"></i><span>{}</span></div>';
		return {icon: status.icon, title: status.title, html: nl.fmt2(htmlFmt, status.icon, status.title)};
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
    	if (!nlGroupInfo) return [];
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
        ret.push(session ?  session.status || 'pending' : record.content.trainingStatus.overallStatus || 'pending');
        ret.push(session ? session.timeSpent : record.content.trainingStatus.timeSpent);
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

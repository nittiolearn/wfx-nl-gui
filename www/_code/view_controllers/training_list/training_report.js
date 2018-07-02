(function() {

//-------------------------------------------------------------------------------------------------
// training_report.js:
// training module: reports for offline training
// TODO-LATER-123: Move this to /#/learning_reports
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
	
	this.init = function(userInfo, nlGroupInfoService, groupInfo) {
		nlGroupInfo = nlGroupInfoService;
		_groupInfo = groupInfo;
		_userInfo = userInfo;
    	_reportCsv = new ReportCsv(nl, nlGroupInfo, nlExporter, _groupInfo);
        var params = nl.location.search();
    	_argv = {limit: ('limit' in params) ? parseInt(params.limit) : 5000, 
    		all: (params.type == 'all'),
    		exportids: nlRouter.isPermitted(_userInfo, 'nittio_support'), 
    		max: 500};
    	if (!nlGroupInfo || !nlGroupInfo.isPastUserXlsConfigured()) _pastUserData = {};
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
				_postProcessRecordsIfNeeded().then(function() {
					_exportToCsv(function() {
						nlDlg.hideLoadingScreen();
					}, function() {
						nlDlg.hideLoadingScreen();
					});
				});
			});
		});
	};

	//---------------------------------------------------------------------------------------------
	var nlGroupInfo = null;
	var _groupInfo = null;
	var _params = null; 
	var _argv = null;
	var _userInfo = null;
	var _records = [];
    var _pageFetcher = nlServerApi.getPageFetcher({defMax: 50, itemType: 'training record'});
    var _reportCsv = null;
    var _pastUserData = null;
    var _pastUserDataFetchInitiated = false;
    var _postProcessRecords = [];

    function _initFetchParams(kindId, createdfrom, createdtill) {
        _params = {type: 'training_kind', objid: kindId || 0, learner: 'all',
        		   assignor: _argv.all ? 'all' : 'me', parentonly: true, filters: [],
        		   max: _argv.max};
		if (createdfrom) _params.createdfrom = createdfrom;
		if (createdtill) _params.createdtill = createdtill;
    }
    
    function _fetchRecords(fetchMore, resolve) {
    	if (!fetchMore) {
    		_records = [];
    	}
    	var dontHideLoading = true;
        _pageFetcher.fetchBatchOfPages(nlServerApi.learningReportsGetList, _params, fetchMore, 
        function(results, batchDone, promiseHolder) {
            if (!results) {
                resolve(false);
                return;
            }
            for(var i=0; i<results.length; i++) {
            	var record = _processRecord(results[i]);
            	if (record) _records.push(record);
            }
            if (batchDone) resolve(true);
        }, _argv.limit, dontHideLoading);
    }
    
    function _processRecord(record) {
    	record.content = angular.fromJson(record.content);
    	record.content.start = nl.fmt.json2Date(record.content.start);
    	record.content.end = nl.fmt.json2Date(record.content.end);
    	if (nlGroupInfo) {
	        record.user = nlGroupInfo.getUserObj(''+record.student);
	        if (!record.user && !_pastUserData) {
	        	_postProcessRecords.push(record);
	        	return null;
	        }
	        if (!record.user) record.user = _pastUserData[record.content.studentname];
	        if (!record.user) record.user = nlGroupInfo.getDefaultUser(record.content.studentname || '');
	        record.usermd = nlGroupInfo.getUserMetadataDict(record.user);
    	}
		if (!('trainingStatus' in record.content))
			record.content['trainingStatus'] = {overallStatus: 'pending', childReportId: null, childStatus: null, sessions: {}};
        var ts = record.content.trainingStatus;
        if (!ts.overallStatus) ts.overallStatus = 'pending';
        if (!ts.sessions) ts.sessions = {};
        if (!ts.lessonReports) ts.lessonReports = {};
        ts.timeSpent = 0;
        
        _updateStatusAndTimes(record, ts);
        record.statusInfo = _getStatusInfo(ts.overallStatus);
        record.feedbackhtml = _getFeedBackHtml(record.content.trainingStatus.childStatus);
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
        	var lessonReport = ts.lessonReports[i];
        	session.status =  (lessonReport && lessonReport.completed && usessions[i] != 'pending')
        		|| (!lessonReport && usessions[i] == 'completed')
        		? 'completed' : 'pending';
        	session.statusInfo = _getStatusInfo(session.status);
    		session.timeSpent = lessonReport ? lessonReport.timeSpentSeconds : 0;
        	if (usessions[i] && usessions[i] != 'pending') session.timeSpent += (session.duration || 0);
        	if (session.status == 'completed') doneCnt++;
    		ts.timeSpent += session.timeSpent;
    		if (!lessonReport) continue;
    		if (lessonReport.attempt) session.attempts = lessonReport.attempt;
    		if (lessonReport.passScore) {
	    		session.passScore = lessonReport.passScore;
	    		session.maxScore = lessonReport.maxScore;
	    		if (lessonReport.completed) session.score = lessonReport.score;
	    		if (lessonReport.completed && session.maxScore) session.perc = Math.round(session.score / session.maxScore);
	    	}
        }
        if (ts.overallStatus1) ts.overallStatus = ts.overallStatus1;
        else ts.overallStatus = (doneCnt == 0) ? 'pending' : (doneCnt == sessions.length) ? 'completed' : 'partial';
    }

    function _postProcessRecordsIfNeeded() {
    	return nl.q(function(resolve, reject) {
	    	if (_pastUserData || _postProcessRecords.length == 0 || _pastUserDataFetchInitiated) {
	    		resolve(true);
	    		return;
	    	}
	    	_pastUserDataFetchInitiated = true;
	    	nlDlg.popupStatus('Fetching additional user information ...', false);
	    	nlDlg.showLoadingScreen();
	    	nlGroupInfo.fetchPastUserXls().then(function(result) {
		    	nlDlg.hideLoadingScreen();
	        	_pastUserData = result || {};
	        	for (var i=0; i<_postProcessRecords.length; i++)
	            	_records.push(_processRecord(_postProcessRecords[i]));
	        	_postProcessRecords = [];
	            nlDlg.popdownStatus(0);
	        	resolve(true);
	    	});
    	});
    };

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
        zip.file('training-report.csv', content);
    }

    var _STATES = {
        pending: {icon: 'ion-ios-circle-filled fgrey', title: 'Not attended'},
        partial: {icon: 'ion-checkmark-circled forange', title: 'Partially attended'},
        completed: {icon: 'ion-checkmark-circled fgreen', title: 'Attended'}
    };

	function _getStatusInfo(inputStatus) {
		if (!(inputStatus in _STATES)) inputStatus = 'pending';
		var status = _STATES[inputStatus];
		var htmlFmt = '<div class="row row-center padding0 margin0"><i class="icon fsh4 padding-small {}"></i><span>{}</span></div>';
		return {icon: status.icon, title: status.title, html: nl.fmt2(htmlFmt, status.icon, status.title)};
	}

	function _getFeedBackHtml(feedback) {
		var htmlFmt = '<div class="row row-center padding0 margin0"><i class="icon fsh4 padding-small {}"></i><span>{}</span></div>';
		if(feedback == 'completed') {
			return nl.fmt2(htmlFmt, _STATES['completed'].icon, 'Feedback provided'); 
		} else {
			return nl.fmt2(htmlFmt, _STATES['pending'].icon, 'Feedback not provided');
		}		
	}

	function _errorMsg(msg) {
		nlDlg.PopupAlert({title: 'Error', template: msg});
		return false;
	}
}];

function ReportCsv(nl, nlGroupInfo, nlExporter, _groupInfo) {
	var self = this;
	var _gradelabel = _groupInfo ? _groupInfo.props.gradelabel : '';
	var _subjectlabel = _groupInfo ? _groupInfo.props.subjectlabel : '';

	var _userHeaders = 	['User Id', 'User Name'];
	var _trainingHeaders = ['Type', 'Training Name', _gradelabel, _subjectlabel, 'Batch Name', 'From', 'Till', 
		'Session', 'Status', 'Feedback Status', 'Quiz Attempts', 'Achieved %', 'Pass %', 'Maximum Score', 'Acheived Score', 'Time Spent (minutes)', 'Venue', 'Trainer Name'];
	var _costHeaders = ['Infra Cost', 'Trainer Cost', 'Food Cost', 'Travel Cost', 'Misc Cost'];
	var _userHeaders2 = 	['Email Id', 'Org'];
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
        headers = headers.concat(_trainingHeaders);
        headers = headers.concat(_costHeaders);
        headers = headers.concat(_userHeaders2);
        var mh = this.getMetaHeaders(false);
        for(var i=0; i<mh.length; i++) headers.push(mh[i].name);
        if (exportIdTypes)
            headers = headers.concat(_idHeaders);
        return headers;
    };

    this.getCsvRows = function(record, exportIdTypes) {
    	var csvRows = [];
    	var csvRow = [];
    	csvRows.push(csvRow);
    	_fillUserFields(csvRow, record);
    	_fillTrainingFields(csvRow, record);
    	_fillCostFields(csvRow, record);
    	_fillUserFields2(csvRow, record);
    	_fillIdFields(csvRow, exportIdTypes ? record : null);
    	for (var i=0; i<record.content.sessions.length; i++) {
    		var session = record.content.sessions[i];
    		var childRow = [];
    		csvRows.push(childRow);
	    	_fillUserFields(childRow, record);
	    	_fillTrainingFields(childRow, record, session);
	    	_fillCostFields(childRow, null);
	    	_fillUserFields2(childRow, record);
	    	_fillIdFields(childRow, exportIdTypes ? record : null);
    	}
    	return csvRows;
    };
    
	function _fillUserFields(ret, record) {
        ret.push(record.user.user_id);
        ret.push(record.user.name);
	}

	function _fillUserFields2(ret, record) {
        ret.push(record.user.email);
        ret.push(record.user.org_unit);
        var mh = self.getMetaHeaders(false);
        for(var i=0; i<mh.length; i++) ret.push(record.usermd[mh[i].id] || '');
	}

	function _fillTrainingFields(ret, record, session) {
        ret.push(session ? 'training session': 'training');
        ret.push(record.content.kindName || '');
        ret.push(record.content.grade || '');
        ret.push(record.content.subject || '');
        ret.push(record.content.name || '');
        ret.push(session ? '' : record.content.start ? nl.fmt.date2Str(record.content.start) : '');
        ret.push(session ? '' : record.content.end ? nl.fmt.date2Str(record.content.end): '');
        ret.push(session ? session.name || '' : 'All sessions');
        ret.push(session ?  session.status || 'pending' : record.content.trainingStatus.overallStatus || 'pending');
        ret.push(session ?  'NA' : record.content.trainingStatus.childStatus || 'pending');

        ret.push(session && session.attempts ? session.attempts : '');
        ret.push(session && session.passScore && session.status == 'completed' ? session.perc : '');
        ret.push(session && session.passScore ? session.passScore : '');
        ret.push(session && session.passScore && session.maxScore ? session.maxScore : '');
        ret.push(session && session.passScore && session.status == 'completed' ? session.score : '');
        
        ret.push((session ? session.timeSpent : record.content.trainingStatus.timeSpent) || '');
        ret.push(record.content.venue || '');
        ret.push(record.content.trainername || '');
	}

	function _fillCostFields(ret, record) {
        ret.push(record ? record.content.costInfra || '' : '');
        ret.push(record ? record.content.costTrainer || '' : '');
        ret.push(record ? record.content.costFood || '' : '');
        ret.push(record ? record.content.costTravel || '' : '');
        ret.push(record ? record.content.costMisc || '' : '');
	}

	function _fillIdFields(ret, record) {
        ret.push(record ? nl.fmt2('id={}', record.id) : '');
        ret.push(record ? nl.fmt2('id={}', record.assignment) : '');
        ret.push(record ? nl.fmt2('id={}', record.lesson_id) : '');
	}

}

//-------------------------------------------------------------------------------------------------
module_init();
})();

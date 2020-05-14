(function() {

//-------------------------------------------------------------------------------------------------
// lr_completed_modules.js: Fetch completed module lsit for active learner count
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.others.lr_completed_modules', [])
	.config(configFn)
	.controller('nl.LearningReportsCompletedModulesCtrl', LearningReportsCompletedModulesCtrl);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.learning_reports_completed_modules', {
		url: '^/learning_reports_completed_modules',
		views: {
			'appContent': {
				templateUrl: 'view_controllers/learning_reports/others/lr_completed_modules.html',
				controller: 'nl.LearningReportsCompletedModulesCtrl'
			}
		}});
}];

var LearningReportsCompletedModulesCtrl = ['$scope', 'nl', 'nlDlg', 'nlRouter', 'nlGroupInfo', 'nlLrFilter', 
'nlServerApi', 'nlExporter',
function($scope, nl, nlDlg, nlRouter, nlGroupInfo, nlLrFilter, nlServerApi, nlExporter) {
	
    var _pageFetcher = null;
    var _limit = null;
    var _debug = false;
    var _chunksize = 0;
    var _groupInfo = null;
    var _pastUserInfosFetcher = nlGroupInfo.getPastUserInfosFetcher();
    var _records = {};
    var _monthlyStats = {};
	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
			nlGroupInfo.init2().then(function() {
				nlGroupInfo.update();
                _groupInfo = nlGroupInfo.get();
                _pastUserInfosFetcher.init(_groupInfo);
                _init();
                resolve(true); // Has to be before next line for loading screen
				_showRangeSelection();
			}, function(err) {
				resolve(false);
			});
		});
	}
    nlRouter.initContoller($scope, '', _onPageEnter);

    function _init() {
        _pageFetcher = nlServerApi.getPageFetcher({defMax: 500, itemType: 'learning record'});
        var params = nl.location.search();
        _limit = ('limit' in params) ? parseInt(params.limit) : 100000;
        _debug =  ('debug' in params);
        _chunksize = ('chunksize' in params) ? parseInt(params.chunksize) : 0;
        $scope.toolbar = _getToolbar();

        $scope.monthlyCounts = []; // {month, count}
        _initFilterData();
    }

    function _getToolbar() {
		return [{
			title : 'Fetch more records in the currently selected date time range',
			icon : 'ion-refresh',
			id: 'tbfetchmore',
			onClick : _fetchMore
		}, {
			title : 'Modify the date/time range and fetch records',
			icon : 'ion-android-time',
			id: 'tbfilter',
			onClick : _showRangeSelection
		}, {
			title : 'Download report',
			icon : 'ion-ios-cloud-download',
			id: 'export',
			onClick : _onExport
		}];
	}

	$scope.canShowToolbarIcon = function(tbid) {
		if (_pageFetcher.fetchInProgress()) return false;
		if (tbid == 'tbfetchmore') return _pageFetcher.canFetchMore();
		return true;
    };
 
    var _filterData = {};
    function _initFilterData() {
        var day = 24*60*60*1000; // 1 in ms
        var now = new Date();
        var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        var offset = now.getTimezoneOffset()*60*1000; // in ms
        now = Math.floor(now.getTime()/day)*day + offset; // Today 00:00 Hrs in local time
        _filterData.createdfrom = monthStart;
        _filterData.createdtill = new Date(now + day);
		_filterData.timestamptype = 'updated';
    }

	function _showRangeSelection() {
		if (_pageFetcher.fetchInProgress()) return;
		nlLrFilter.showDialog($scope, _filterData).then(function(status) {
            if (!status) return;
            _records = {};
            _monthlyStats = {};
            _fetchReports(false);
        });
	}

    function _fetchMore() {
        _fetchReports(true);
    }

    function _fetchReports(fetchMore) {
        if (_pageFetcher.fetchInProgress()) return;
        var params = {updatedfrom: _filterData.createdfrom, updatedtill: _filterData.createdtill};
        if (_debug) params.debug = true;
        if (_chunksize) params.chunksize = _chunksize;
        params._jsMaxRetries = 3;
        _pageFetcher.fetchBatchOfPages(nlServerApi.learningReportsGetCompletedModuleList, params, fetchMore, 
        function(results, batchDone, promiseHolder) {
            if (!results) {
                nlDlg.popupAlert({title: 'Error', template: 'Error connecting to the server. Press the <i class="ion-refresh"></i> (fetch more) toolbar icon to resume fetching.'});
                return;
            }
            for (var i=0; i<results.length; i++) _addRecord(results[i]);
            _updateRecords();
        }, _limit);
    }

    function _addRecord(record) {
        record.updated = nl.fmt.json2Date(record.updated);
        record.created = nl.fmt.json2Date(record.created);
        if (record.id in _records && _records[record.id].updated > record.updated) return;
        _records[record.id] = record;
        record.month = _getMonth(record);
        if (!(record.month in _monthlyStats)) _monthlyStats[record.month] = {users: {}};
        var monthlyStat = _monthlyStats[record.month];
        monthlyStat.users[record.student] = true;
    }

    function _getMonth(record) {
        var month = '' + (record.updated.getMonth()+1);
        if (month.length < 2) month = '0' + month;
        return nl.fmt2('{}-{}', record.updated.getFullYear(), month);
    }

    function _updateRecords() {
        $scope.monthlyCounts = [];
        for (var month in _monthlyStats) {
            var count = Object.keys(_monthlyStats[month].users).length;
            $scope.monthlyCounts.push({month: month, count: count});
        }
        $scope.monthlyCounts.sort(function(a, b) {
            return (a.month > b.month);
        });
        $scope.recordCount = Object.keys(_records).length;
    }

    //-----------------------------------------------------------------------------------
    // fmtFunctions
    //-----------------------------------------------------------------------------------
    function _fmtUserId(record, attr) {
        return record.user.username;
    }

    function _fmtUserName(record, attr) {
        return record.user.name;
    }

    function _fmtRecordType(record, attr) {
        if (record.assigntype == _nl.atypes.ATYPE_SELF_MODULE) return 'module self assignment';
        if (record.assigntype == _nl.atypes.ATYPE_SELF_COURSE) return 'course self assignment';
        if (record.assigntype == _nl.atypes.ATYPE_COURSE) return 'course assignment';
        if (record.assigntype == _nl.atypes.ATYPE_TRAINING) return 'training';
        return 'module assignment';
    }

    function _fmtDate(record, attr) {
        return record[attr] ? nl.fmt.date2Str(record[attr]) : '';
    }

    function _fmtBoolean(record, attr) {
        return record[attr] ? 'Yes' : '';
    }

    function _fmtId(record, attr) {
        return record[attr] ? nl.fmt2('id:{}', record[attr]) : '';
    }
    //-----------------------------------------------------------------------------------
    function _onExport() {
        _updateUserInfoInReports(_records, _onExportImpl);
    }

    function _onExportImpl() {
        var zip = new JSZip();
        _addOverviewFile(zip);
        var headers = [
            {id: '', name: 'User Id', fmt: _fmtUserId}, 
            {id: '', name: 'User Name', fmt: _fmtUserName}, 
            {id: '', name: 'Record Type', fmt: _fmtRecordType},
            {id: 'created', name: 'Created', fmt: _fmtDate},
            {id: 'updated', name: 'Updated', fmt: _fmtDate},
            {id: 'deleted', name: 'Is Deleted', fmt: _fmtBoolean},
            {id: 'id', name: 'Report Id', fmt: _fmtId},
            {id: 'lesson_id', name: 'Module Id', fmt: _fmtId},
            {id: 'assignment', name: 'Assignment Id', fmt: _fmtId},
            {id: 'containerid', name: 'Course Report Id', fmt: _fmtId},
            {id: 'assignor', name: 'Assignor Id', fmt: _fmtId}
        ];
        var headerRow = [];
        for (var i=0; i<headers.length; i++) {
            headerRow.push(headers[i].name);
        }

        var chunkCount = 0;
        var recordInChunkCount = 0;
        var csvRows = [headerRow];

        for (var recid in _records) {
            var record = _records[recid];
            var row = [];
            for (var i=0; i<headers.length; i++) {
                var header = headers[i];
                var value = header.fmt(record, header.id);
                row.push(value);
            }

            csvRows.push(row);
            recordInChunkCount++;
            if (recordInChunkCount < nlExporter.MAX_RECORDS_PER_CSV) continue;
            chunkCount++;
            _addCsvFile(zip, nl.fmt2('completed-modules-{}.csv', chunkCount), csvRows);
            recordInChunkCount = 0;
            csvRows = [headerRow];
        }
        if (recordInChunkCount > 0) {
            chunkCount++;
            _addCsvFile(zip, nl.fmt2('completed-modules-{}.csv', chunkCount), csvRows);
        }
        nlExporter.saveZip(zip, 'completed_modules.zip');
    }

    function _updateUserInfoInReports(records, onDoneFn) {
        var pendingRecords = {};
        for (var recid in records) {
            var record = records[recid];
            if (record.isProcessed) continue;
            record.user = nlGroupInfo.getCachedUserObjWithMeta(record.student, nl.fmt2('id={}', record.student),
                _pastUserInfosFetcher);
            if (!record.user) pendingRecords[recid] = record;
            else record.isProcessed = true;
        }
        if (Object.keys(pendingRecords).length == 0) return onDoneFn();
        _pastUserInfosFetcher.fetchNextPastUsersFile().then(function(canFetchMore) {
            _updateUserInfoInReports(pendingRecords, onDoneFn);
        });

    }

    function _addOverviewFile(zip) {
        var tstypeStr = _filterData.timestamptype == 'updated' ? 'Updated' : 'Created';
        var rows = [
            [nl.fmt2('{} timestamp from:', tstypeStr), _fmtDate(_filterData, 'createdfrom')],
            [nl.fmt2('{} timestamp till:', tstypeStr), _fmtDate(_filterData, 'createdtill')],
            ['Count of completed modules:', $scope.recordCount],
            ['', ''],
            ['Number of unique learners who completed at least one module in a month:', ''],
            ['Month', 'Unique learners']
        ];
        
        for (var i=0; i<$scope.monthlyCounts.length; i++) {
            var item = $scope.monthlyCounts[i];
            rows.push([item.month, item.count]);
        }
        _addCsvFile(zip, 'overview.csv', rows);
    }

    var _CSV_DELIM = '\n';
    function _addCsvFile(zip, fileName, rows) {
        var csvRows = [];
        for (var i=0; i<rows.length; i++) csvRows.push(nlExporter.getCsvString(rows[i]));
        var content = csvRows.join(_CSV_DELIM);
        zip.file(fileName, content);
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

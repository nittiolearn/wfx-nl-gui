(function() {

//-------------------------------------------------------------------------------------------------
// course_summary_report.js: Display and export course reports
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.course_summary_report', [])
	.config(configFn)
	.controller('nl.CourseReportSummaryCtrl', CourseReportSummaryCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.course_summary_report', {
		url: '^/course_summary_report',
		views: {
			'appContent': {
				templateUrl: 'view_controllers/course/report/course_summary_report.html',
				controller: 'nl.CourseReportSummaryCtrl'
			}
		}});
}];

var MAX_LIST_SIZE = 100;

//-------------------------------------------------------------------------------------------------
var CourseReportSummaryCtrl = ['nl', 'nlDlg', 'nlRouter', '$scope', 'nlServerApi', 
'nlExporter', 'nlRangeSelectionDlg', 'nlGroupInfo', 'nlTable', 'nlCourse', 'nlTreeSelect', 
'nlOrgMdMoreFilters',
function(nl, nlDlg, nlRouter, $scope, nlServerApi, nlExporter, nlRangeSelectionDlg,
    nlGroupInfo, nlTable, nlCourse, nlTreeSelect, nlOrgMdMoreFilters) {
    var _data = {urlParams: {}, createdFrom: null, createdTill: null, 
        courseRecords: {}, reportRecords: {}, pendingCourseIds: {}};

    var _reportProcessor = new ReportProcessor(nl, nlGroupInfo, nlExporter, _data);
    var _summaryStats = new SummaryStats(nl, nlGroupInfo, _data, _reportProcessor, $scope);
    var _fetcher = new Fetcher(nl, nlDlg, nlServerApi, _data, _reportProcessor, _summaryStats, nlCourse);

	function _onPageEnter(userInfo) {
        nlRangeSelectionDlg.init();
		return nl.q(function(resolve, reject) {
            nlGroupInfo.init().then(function() {
                _data.urlParams.isAdmin = nlRouter.isPermitted(userInfo, 'admin_user');
                nl.pginfo.pageTitle = nl.t('Course report');
                _initParams();
                _initScope();
                _summaryStats.init();
                _fetcher.fetchCourse(function(result) {
                    if (!result) {
                        resolve(false);
                        return;
                    }
                    resolve(true);
                    _updateScope();
                    _showRangeSelection();
                });
            }, function(err) {
                resolve(false);
            });
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    var DEFAULT_MAX_LIMIT=5000;
    function _initParams() {
        var params = nl.location.search();
        _data.urlParams.limit = ('limit' in params) ? parseInt(params.limit) : DEFAULT_MAX_LIMIT;
        _data.urlParams.courseId = parseInt(params.courseid) || null;
        if (_data.urlParams.courseId)
            _data.pendingCourseIds[_data.urlParams.courseId] = true;
    }
    
    function _initScope() {
        $scope.toolbar = _getToolbar();
        $scope.courseid = _data.urlParams.courseId;
        $scope.metaHeaders = _reportProcessor.getMetaHeaders(true);
        $scope.ui = {showOrgCharts: true, showOrgs: true, showUsers: false};
        $scope.utable = {
            columns: _getUserColumns(),
            styleTable: 'nl-table-styled2 compact',
            onRowClick: 'expand',
            detailsTemplate: 'view_controllers/course/report/report_record_details.html',
            clickHandler: _userRowClickHandler,
            metas: _reportProcessor.getMetaHeaders(false)
        };
        nlTable.initTableObject($scope.utable);
        $scope.otable = {
            columns: _getOrgColumns(),
            styleTable: 'nl-table-styled2 compact',
            getSummaryRow: _getOrgSummaryRow
        };
        nlTable.initTableObject($scope.otable);
        _initChartData();
    }
    
    function _getUserColumns() {
        var columns = [];
        columns.push({id: 'user.user_id', name: 'User Id', smallScreen: true});
        columns.push({id: 'user.org_unit', name: 'Org'});
        var mh = _reportProcessor.getMetaHeaders(true);
        for(var i=0; i<mh.length; i++) {
            columns.push({id: 'usermd.' + mh[i].id, name: mh[i].name});
        }
        if (!_data.urlParams.courseId) {
            columns.push({id: 'course.name', name: 'Course', mediumScreen: false});
        }
        columns.push({id: 'stats.status.txt', name: 'Status', smallScreen: true, 
            icon: 'stats.status.icon'});
        columns.push({id: 'stats.percCompleteStr', name: 'Progress', mediumScreen: false,
            styleTd: 'text-right'});

        // Only search and details relevant columns
        columns.push({id: 'user.name', name: 'User Name', searchKey: 'username', 
            smallScreen: false, mediumScreen: false, largeScreen: false});
        columns.push({id: 'user.email', name: 'Email Id', searchKey: 'email', 
            smallScreen: false, mediumScreen: false, largeScreen: false});
        columns.push({id: 'user.username', name: 'Login Id', searchKey: 'login', 
            smallScreen: false, mediumScreen: false, largeScreen: false});
        return columns;
    }
    
    function _userRowClickHandler(rec, action) {
        if (action == 'delete') {
            return _deleteReport(rec);
        }
    }
    
    function _deleteReport(report) {
        var template = nl.t('Once deleted, you will not be able to recover this report. Are you sure you want to delete this report?');
        nlDlg.popupConfirm({title: 'Please confirm', template: template,
            okText : nl.t('Delete')}).then(function(res) {
            if (!res) return;
            var repid = report._raw.raw_record.id;
            nlDlg.showLoadingScreen();
            nlServerApi.courseReportDelete(repid).then(function(statusInfo) {
                nlDlg.hideLoadingScreen();
                if (repid in _data.reportRecords)
                    _summaryStats.removeFromStats(_data.reportRecords[repid]);
                delete _data.reportRecords[repid];
                _updateScope();
            });
        });
    }
            
    function _getOrgColumns() {
        var columns = [];
        var mh = _reportProcessor.getMetaHeaders(true);
        columns.push({id: 'org', name: 'Org', smallScreen: true});
        for(var i=0; i<mh.length; i++) {
            columns.push({id: mh[i].id, name: mh[i].name});
        }
        columns.push({id: 'percStr', name: 'Completion', smallScreen: true, searchable: false, styleTd: 'text-right'});
        columns.push({id: 'assigned', name: 'Assigned', searchable: false, styleTd: 'text-right'});
        columns.push({id: 'done', name: 'Done', searchable: false, styleTd: 'text-right'});
        columns.push({id: 'failed', name: 'Failed', searchable: false, styleTd: 'text-right'});
        columns.push({id: 'started', name: 'Started', searchable: false, styleTd: 'text-right'});
        columns.push({id: 'pending', name: 'Pending', searchable: false, styleTd: 'text-right'});
        return columns;
    }

    function _getOrgSummaryRow(records) {
        var summaryRecord = {'org': {txt: 'Overall'}};
        var assigned = 0;
        var done = 0;
        var failed = 0;
        var started = 0;
        var pending = 0;
        for (var i=0; i<records.length; i++) {
            var rec = records[i];
            if (!rec.passesFilter) continue;
            assigned += rec.assigned;
            done += rec.done;
            failed += rec.failed;
            started += rec.started;
            pending += rec.pending;
        }

        summaryRecord['percStr'] = {txt: assigned > 0 ? Math.round(done/assigned*100) + ' %': ''};
        summaryRecord['assigned'] = {txt: assigned};
        summaryRecord['done'] = {txt: done};
        summaryRecord['failed'] = {txt: failed};
        summaryRecord['started'] = {txt: started};
        summaryRecord['pending'] = {txt: pending};

        _updateChartData(summaryRecord);
        return summaryRecord;
    }

    function _getToolbar() {
        return [{
            title : 'Fetch more records in the currently selected date time range',
            icon : 'ion-refresh',
            id: 'fetchmore',
            onClick : _fetchMore
        }, {
            title : 'Modify the date/time range and fetch records',
            icon : 'ion-android-time',
            id: 'timerange',
            onClick : _showRangeSelection
        }, {
            title : 'Export report',
            icon : 'ion-ios-cloud-download',
            id: 'export',
            onClick : _onExport
        }];
    }
    
    $scope.canShowToolbarIcon = function(tbid) {
        if (_fetcher.fetchInProgress(true)) return false;
        if (tbid == 'fetchmore') return _fetcher.canFetchMore();
        return true;
    };
    
    function _showRangeSelection() {
        if (_fetcher.fetchInProgress()) return;
        nlRangeSelectionDlg.show($scope, true).then(function(dateRange) {
            if (!dateRange) return;
            _data.createdFrom = dateRange.updatedFrom;
            _data.createdTill = dateRange.updatedTill;
            _updateTimeRangeStr();

            _data.reportRecords = {};
            _summaryStats.reset();
            _getDataFromServer();
        });
    }
    
    function _updateTimeRangeStr() {
        $scope.timeRangeStr = nl.t('From {} till {}', 
            nl.fmt.fmtDateDelta(_data.createdFrom), 
            nl.fmt.fmtDateDelta(_data.createdTill));
    }
    
    function _fetchMore() {
        if (_fetcher.fetchInProgress()) return;
        _getDataFromServer(true);
    }

    function _getDataFromServer(fetchMore) {
        _fetcher.fetchReports(fetchMore, function(result) {
            _updateScope();
        });
    }
    
    function _updateScope() {
        var cn = _getCourseName();
        var title = nl.t('Course report');
        if (cn) title += ': ' + cn;
        nl.pginfo.pageTitle = title;
        
        $scope.fetchInProgress = _fetcher.fetchInProgress(true);
        $scope.canFetchMore = _fetcher.canFetchMore();
        
        var reportAsList = _getReportsAsList();
        $scope.noDataFound = (reportAsList.length == 0);
        nlTable.updateTableObject($scope.utable, reportAsList);
        nlTable.updateTableObject($scope.otable, _getSummaryAsList());
    }

    function _initChartData() {
        var labels =  ['done', 'failed', 'started', 'pending'];
        var colors = ['#007700', '#770000', '#FFCC00', '#A0A0C0'];

        $scope.charts = [{
            type: 'doughnut',
            title: 'Progress',
            data: [0, 0, 0, 0],
            labels: labels,
            colors: colors
        },
        {
            type: 'line',
            title: 'Updates over time',
            data: [[]],
            labels: [],
            series: ['S1'],
            colors: colors
        }];
    }
    
    function _updateChartData(summaryRecord) {
        _updateProgressChartData(summaryRecord);
        _updateTimeChartData();
        nl.timeout(function() {
            _updateProgressChartData(summaryRecord);
            _updateTimeChartData();
        });
    }
    
    function _updateProgressChartData(summaryRecord) {
        var c = $scope.charts[0];
        c.data = [summaryRecord.done.txt, summaryRecord.failed.txt, summaryRecord.started.txt, summaryRecord.pending.txt];
        c.title = nl.t('Progress: {} of {} done', summaryRecord.done.txt, summaryRecord.assigned.txt);
    }
        
    function _updateTimeChartData() {
        var c = $scope.charts[1];
        var ranges = _getRanges(_data.createdFrom, _data.createdTill, 10);
        
        for(var key in _data.reportRecords) {
            var rec = _data.reportRecords[key];
            var orgEntry = _summaryStats.getOrgEntry(rec);
            if (!orgEntry || !orgEntry.passesFilter) continue;
            for(var i=0; i<ranges.length; i++) {
                if (nl.fmt.json2Date(rec.raw_record.updated) >= ranges[i].end) continue;
                ranges[i].count++;
                break;
            }
        }
        
        c.labels = [];
        c.data = [[]];
        for (var i=0; i<ranges.length; i++) {
            var r = ranges[i];
            c.labels.push(r.label);
            c.data[0].push(r.count);
        }
    }
    
    function _getRanges(from, till, maxBuckets) {
        if (!from || !till) return [];

        var day = 24*60*60*1000; // 1 day in ms
        var now = new Date();

        var offset = now.getTimezoneOffset()*60*1000; // in ms
        var start = Math.floor((from.getTime()-offset)/day)*day + offset; // Today 00:00 Hrs in local time
        var till = till;
        
        var rangeSize = Math.ceil((till.getTime() - start)/day/maxBuckets);
        var multiDays = (rangeSize > 1);
        rangeSize *= day;
        
        var ranges = [];
        var lastTime = new Date(start);
        while (true) {
            if (lastTime >= till) break;
            var range = {start: lastTime, end: new Date(lastTime.getTime() + rangeSize),
                count: 0};
            var s = nl.fmt.fmtDateDelta(range.start, null, 'date-mini');
            var e = nl.fmt.fmtDateDelta(range.end, null, 'date-mini');
            range.label = multiDays ? nl.fmt2('{} - {}', s, e) : s;
            lastTime = range.end;
            ranges.push(range);
        }
        return ranges;
    }

    function _getCourseName() {
        if (!_data.urlParams.courseId) return '';
        if (!_data.courseRecords[_data.urlParams.courseId]) return '';
        return _data.courseRecords[_data.urlParams.courseId].name || '';
    }

    function _onExport() {
        if (_fetcher.fetchInProgress()) return;
        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-height-max nl-width-max');
        dlg.scope.export = {summary: true, user: true, module: false, ids: false,
            canShowIds: _data.urlParams.isAdmin};
        dlg.scope.data = {};
        nlGroupInfo.update();
		_setExportFilters(dlg);
		var filterData = dlg.scope.filtersData;
        var exportButton = {
            text : nl.t('Export'),
            onTap : function(e) {
                var exp = dlg.scope.export;
                var selected = exp.summary || exp.user || exp.module;
                if(!selected) {
                    dlg.scope.warn = 'Please select atleast one type of report to export';
                    if(e) e.preventDefault();
                    return null;
                }
                _data.urlParams.exportTypes = exp;
				_data.selectedOus = nlOrgMdMoreFilters.getSelectedOus(filterData);
				_data.selectedMds = nlOrgMdMoreFilters.getSelectedMds(filterData);
				_data.selectedCourses = nlOrgMdMoreFilters.getSelectedMores(filterData);

                nlDlg.showLoadingScreen();
                var promise = nl.q(function(resolve, reject) {
                    _export(resolve, reject);
                });
                promise.then(function() {
                    nl.timeout(function() {
                        nlDlg.hideLoadingScreen();
                    }, 2000);
                });
            }
        };
        var cancelButton = {text : nl.t('Cancel')};
        dlg.show('view_controllers/course/report/course_rep_export.html',
            [exportButton], cancelButton);
    }

	function _setExportFilters(dlg) {
		var records = _getReportsAsList();
		var courseTree = {data: _getCourseModuleTree(records) || []};
		dlg.scope.filtersData = nlOrgMdMoreFilters.getData(courseTree, 'Course and module');
	}

	function _getCourseModuleTree(records) {
        var insertedKeys = {};
        var treeArray = [];
        for(var i=0; i<records.length; i++) {
            var courseObj = records[i].course;
            for(var j=0; j<courseObj.lessons.length; j++) {
            	var lessonObj = courseObj.lessons[j];
	            _getIconNodeWithParents(courseObj, lessonObj, treeArray, insertedKeys);
            }
        }
        return treeArray;
    }

    function _getIconNodeWithParents(courseObj, lessonObj, treeArray, insertedKeys) {
    	if (!courseObj.id) return;
    	var courseKey = 'A'+courseObj.id;
        if (!insertedKeys[courseKey]) {
        	insertedKeys[courseKey] = true;
        	treeArray.push({id: courseKey, name: courseObj.name});
        }
    	var moduleKey = courseKey + '.' + lessonObj.id.split('.').join('_');
        if (insertedKeys[moduleKey]) return;
    	insertedKeys[moduleKey] = true;
        treeArray.push({id: moduleKey, name: lessonObj.name, origId: lessonObj.id});
    }

    var _CSV_DELIM = '\n';
    function _export(resolve, reject) {
        try {
            var zip = new JSZip();
            var moduleRows = _data.urlParams.exportTypes.module ? [] : null;

		    var expSummaryStats = new SummaryStats(nl, nlGroupInfo, _data, _reportProcessor, $scope);
				expSummaryStats.init();
            var records = _getReportsAsList();
            for(var start=0, i=1; start < records.length; i++) {
                var pending = records.length - start;
                pending = pending > nlExporter.MAX_RECORDS_PER_CSV ? nlExporter.MAX_RECORDS_PER_CSV : pending;
                var fileName = nl.fmt2('CourseUserReport-{}.csv', i);
            	_createUserCsv(records, zip, fileName, start, start+pending, moduleRows, expSummaryStats);	
                start += pending;
            }


            if (_data.urlParams.exportTypes.summary) {
                var records = _getSummaryAsList(expSummaryStats);
                for(var start=0, i=1; start < records.length; i++) {
                    var pending = records.length - start;
                    pending = pending > nlExporter.MAX_RECORDS_PER_CSV ? nlExporter.MAX_RECORDS_PER_CSV : pending;
                    var fileName = nl.fmt2('CourseSummaryReport-{}.csv', i);
                    _createSummaryCsv(records, zip, fileName, start, start+pending);
                    start += pending;
                }
            }

            if (_data.urlParams.exportTypes.module) {
                var records = moduleRows;
                for(var start=0, i=1; start < records.length; i++) {
                    var pending = records.length - start;
                    pending = pending > nlExporter.MAX_RECORDS_PER_CSV ? nlExporter.MAX_RECORDS_PER_CSV : pending;
                    var fileName = nl.fmt2('CourseUserModuleReport-{}.csv', i);
                    _createUserModuleCsv(records, zip, fileName, start, start+pending);
                    start += pending;
                }
            }

            nlExporter.saveZip(zip, 'CourseReport.zip', null, resolve, reject);
        } catch(e) {
            console.error('Error while exporting', e);
            nlDlg.popupAlert({title: 'Error while exporting', template: e});
            reject(e);
        }
    }

    function _getReportsAsList() {
        var ret = _dictToList(_data.reportRecords);
        ret.sort(function(a, b) {
            return (b.stats.status.id - a.stats.status.id);
        });
        return ret;
    }
    
    function _getSummaryAsList(summaryStats) {
    	if (!summaryStats) summaryStats = _summaryStats;
        var ret = _dictToList(summaryStats.getStatsData());
        ret.sort(function(a, b) {
            if (a.assigned == b.assigned) return (b.perc - a.perc);
            return (b.assigned - a.assigned);
        });
        return ret;
    }

    function _dictToList(d) {
        var ret = [];
        for(var k in d) ret.push(d[k]);
        return ret;
    }
    
    function _createUserModuleCsv(records, zip, fileName, start, end) {
        var header = _reportProcessor.getCsvModuleHeader();
        var rows = [nlExporter.getCsvString(header)];
        for (var i=start; i<end; i++) rows.push(records[i]);
        var content = rows.join(_CSV_DELIM);
        zip.file(fileName, content);
    }
    
    function _createUserCsv(records, zip, fileName, start, end, moduleRows, expSummaryStats) {
        var header = _reportProcessor.getCsvHeader();
        var rows = [nlExporter.getCsvString(header)];
        for (var i=start; i<end; i++) {
            var row = _reportProcessor.getCsvRow(records[i]);

			var selectedCourseId = _checkFilter(_data.selectedCourses, records[i].course.id);
			var selectedOus = _checkFilter(_data.selectedOus, records[i].user.org_unit);
 			
			var selectedMetaFields = true;
            for(var meta in _data.selectedMds) {
            	var selectedMetas = _data.selectedMds[meta];
            	if (_checkFilter(_data.selectedMds[meta], records[i].usermd[meta])) continue;
            	selectedMetaFields = false;
            	break;
            }

            if(selectedCourseId && selectedOus && selectedMetaFields) {
	            rows.push(nlExporter.getCsvString(row));
	            if (moduleRows) _reportProcessor.updateCsvModuleRows(records[i], moduleRows, _data);
                expSummaryStats.addToStats(records[i]);
            }
        }
        
        if (_data.urlParams.exportTypes.user) {
            var content = rows.join(_CSV_DELIM);
            zip.file(fileName, content);
        }
    }
    
    function _createSummaryCsv(summaryStats, zip, fileName, start, end) {
        var header = ['Org'];
        var metas = _reportProcessor.getMetaHeaders(false);
        for(var i=0; i<metas.length; i++) header.push(metas[i].name);
        header = header.concat(['Completion', 'Assigned', 'Done', 'Failed', 'Started', 'Pending']);
        var rows = [nlExporter.getCsvString(header)];
        for (var i=start; i<end; i++) {
            var record = summaryStats[i];
            var row = [record.org];
            for (var j=0; j<metas.length; j++) row.push(record[metas[j].id]);
            row = row.concat([record.perc ? record.perc+ '%' : '', record.assigned, record.done, record.failed, record.started, record.pending]);
            rows.push(nlExporter.getCsvString(row));
        }
        var content = rows.join(_CSV_DELIM);
        zip.file(fileName, content);
    }
}];

//-------------------------------------------------------------------------------------------------
function Fetcher(nl, nlDlg, nlServerApi, _data, _reportProcessor, _summaryStats, nlCourse) {
    var self = this;
    var _pageFetcher = nlServerApi.getPageFetcher({defMax: 50, itemType: 'course learning record'});
    
    this.canFetchMore = function() {
        return _pageFetcher.canFetchMore();
    };
    
    this.fetchInProgress = function(dontShowAlert) {
        if (!_pageFetcher.fetchInProgress()) return false;
        if (dontShowAlert) return true;
        nlDlg.popupAlert({title: 'Please wait', template: 'Currently feching data from server. You can initiate the next operation once the fetching is completed.'});
        return true;
    };

    this.fetchCourse = function(onDoneCallback) {
        return _fetchCourses(onDoneCallback);
    };
    
    this.fetchReports = function(fetchMore, onDoneCallback) {
        if (this.fetchInProgress()) {
            onDoneCallback(false);
            return;
        }
        _fetchReports(fetchMore, function(results) {
            if (!results) {
                onDoneCallback(false);
                return;
            }
            for (var i=0; i<results.length; i++) {
                var report = results[i];
                report = _reportProcessor.process(report);
                if (!report) continue;
                var rid = report.raw_record.id;
                if (rid in _data.reportRecords)
                    _summaryStats.removeFromStats(_data.reportRecords[rid]);
                _data.reportRecords[rid] = report;
                _summaryStats.addToStats(report);
            }
            onDoneCallback(results);
        });
    };
    
    //-----------------------------------------------------------------------------------
    function _fetchReports(fetchMore, onDoneCallback) {
        var params = {compact: true, createdfrom: _data.createdFrom,
            createdtill: _data.createdTill};
        if (_data.urlParams.courseId) params.courseid = _data.urlParams.courseId;
        
        _pageFetcher.fetchBatchOfPages(nlServerApi.courseGetAllReportList, params, fetchMore, 
        function(results, batchDone, promiseHolder) {
            if (!results) {
                onDoneCallback(false);
                return;
            }
            for(var i=0; i<results.length; i++) {
                var courseid = results[i].courseid;
                if (courseid in _data.courseRecords) continue;
                _data.pendingCourseIds[courseid] = true;
            }

            if (Object.keys(_data.pendingCourseIds).length > 0) {
                promiseHolder.promise = nl.q(function(resolve, reject) {
                    _fetchCourses(function(result2) {
                        if (!result2) {
                            resolve(false);
                            onDoneCallback(false);
                            return;
                        }
                        resolve(true);
                        onDoneCallback(results);
                    });
                });
            } else {
                nl.timeout(function() {
                    onDoneCallback(results);
                });
            }
        }, _data.urlParams.limit);
    }
    
    //-----------------------------------------------------------------------------------
    var _courseFetchErrors = [];
    function _showFetchErrors() {
    	if (_courseFetchErrors.length == 0) return nl.q(function(resolve, reject) {
    		resolve(true);
    	});
    	var msg = '<div class="padding-mid">There were errors featching the following courses referanced in some learning reports. The learning reports associated with these courses are ignored: </div>';
    	for(var i=0; i<_courseFetchErrors.length; i++) {
    		var e = _courseFetchErrors[i];
    		msg += nl.fmt2('<div class="padding-small">Course id {}: {}</div>', e.id, e.msg);
    	}
    	_courseFetchErrors = [];
    	return nlDlg.popupAlert({title: 'Error', template: msg});
    }
    
    function _fetchCourses(onDoneCallback) {
        var cids = [];
        for (var cid in _data.pendingCourseIds) cids.push(parseInt(cid));
        _fetchCoursesInBatchs(cids, 0, onDoneCallback);
    }

    var MAX_PER_BATCH = 50;
    var courseProcessor = new CourseProcessor(nlCourse);
    function _fetchCoursesInBatchs(cids, startPos, onDoneCallback) {
        var courseIds = [];
        var maxLen = cids.length < startPos + MAX_PER_BATCH ? cids.length : startPos + MAX_PER_BATCH;
        for(var i=startPos; i<maxLen; i++) courseIds.push(cids[i]);
        if (courseIds.length == 0) {
        	_showFetchErrors().then(function() {
	            onDoneCallback(true);
        	});
            return;
        }
        nlServerApi.courseGetMany(courseIds, true).then(function(results) {
            for(var cid in results) {
            	cid = parseInt(cid);
                var course = results[cid];
                if (course.error) {
                	_courseFetchErrors.push({id: cid, msg: course.error});
                }
                _data.courseRecords[cid] = course.error ? null : courseProcessor.process(course);
                delete _data.pendingCourseIds[cid];
            }
            startPos += results.length;
            _fetchCoursesInBatchs(cids, startPos, onDoneCallback);
        }, function(error) {
            onDoneCallback(false);
        });
    }
}

//-------------------------------------------------------------------------------------------------
function CourseProcessor(nlCourse) {

    var _idToFullName = {};
    
    this.process = function(course) {
		course = nlCourse.migrateCourse(course);
        _idToFullName = {};
        var ret = {id: course.id, name: course.name || '', created: course.created || null, 
            updated: course.updated || null, certificates: [], lessons: [], nonLessons: []};
        var modules = (course.content || {}).modules || [];
        for (var i=0; i<modules.length; i++) {
            var m = modules[i];
            if (!m.id) continue;
            _updateIdToFullName(m);
            if (m.type == 'lesson') ret.lessons.push({id: m.id, name:_idToFullName[m.id]});
            else if (m.type == 'certificate') ret.certificates.push(m.id);
            else if (m.type != 'module') ret.nonLessons.push(m.id);
        }
        return ret;
    };
    
    var _DELIM = '.';
    function _updateIdToFullName(m) {
        var pid = _getParentId(m);
        var prefix = pid && _idToFullName[pid] ? _idToFullName[pid] + _DELIM : '';
        var myName = prefix + (m.name || '');
        _idToFullName[m.id] = myName;
    }

    function _getParentId(m) {
        var parentId = m.parentId || '';
        if (parentId) return parentId;
        var parents = m.id.split(_DELIM);
        parents.pop();
        return (parents.length == 0) ? '' : parents.join(_DELIM);
    }
}

//-------------------------------------------------------------------------------------------------
function ReportProcessor(nl, nlGroupInfo, nlExporter, _data) {
    var self = this;
    this.STATUS_PENDING = 0;
    this.STATUS_STARTED = 1;
    this.STATUS_DONE = 2;
    this.STATUS_PASSED = 3;
    this.STATUS_FAILED = 4;
    this.STATUS_CERTIFIED = 5;
    
    var _statusInfos = [
        {id: this.STATUS_PENDING, txt: 'pending', icon: 'ion-ios-circle-filled fgrey'},
        {id: this.STATUS_STARTED, txt: 'started', icon: 'ion-ios-circle-filled fgreen'},
        {id: this.STATUS_DONE, txt: 'done', icon: 'ion-checkmark-circled fgreen'},
        {id: this.STATUS_PASSED, txt: 'passed', icon: 'ion-checkmark-circled fgreen'},
        {id: this.STATUS_FAILED, txt: 'failed', icon: 'icon ion-close-circled forange'},
        {id: this.STATUS_CERTIFIED, txt: 'certified', icon: 'icon ion-android-star fgreen'}];
        
    this.process = function(report) {
        var user = nlGroupInfo.getUserObj(''+report.student);
        if (!user) return null;
        var course = _data.courseRecords[report.courseid];
        if (!course) return null;

        var stats = {nLessons: 0, nLessonsPassed: 0, nLessonsFailed: 0, nQuiz: 0,
            timeSpentSeconds: 0, nAttempts: 0, nLessonsAttempted: 0, nScore: 0, nMaxScore: 0,
            nCerts: course.certificates.length};
            
        var statusinfo = report.statusinfo || {};
        var items = course.nonLessons;
        stats.nOthers = items.length;
        stats.nOthersDone = 0;
        for (var i=0; i<items.length; i++) {
            var cid = items[i];
            var sinfo = statusinfo[cid];
            if (sinfo && sinfo.status == 'done') stats.nOthersDone++;
        }

        var lessons = course.lessons;
        var lessonReps = report.lessonReports || {};
        for (var i=0; i<lessons.length; i++) {
            stats.nLessons++;
            var lid = lessons[i].id;
            var rep = lessonReps[lid];
            if (!rep) continue;
            if (!rep.selfLearningMode && rep.attempt) {
                stats.nAttempts += rep.attempt;
                stats.nLessonsAttempted++;
            }
            stats.timeSpentSeconds += rep.timeSpentSeconds || 0;
            if (!rep.completed) continue;
            if (rep.selfLearningMode) {
                rep.maxScore = 0;
                rep.score = 0;
            }
            if (rep.maxScore) {
                stats.nScore += rep.score;
                stats.nMaxScore += rep.maxScore;
                stats.nQuiz++;
            }
            var perc = rep.maxScore ? Math.round(rep.score / rep.maxScore * 100) : 100;
            if (!rep.passScore || perc >= rep.passScore) stats.nLessonsPassed++;
            else stats.nLessonsFailed++;
        }
        stats.nLessonsDone = stats.nLessonsPassed + stats.nLessonsFailed;
        var weightedProgressMax = stats.nLessons*10 + stats.nOthers;
        var weightedProgress = stats.nLessonsDone*10 + stats.nOthersDone;
        stats.percComplete = weightedProgressMax ? Math.round(weightedProgress/weightedProgressMax*100) : 100;
        stats.percCompleteStr = '' + stats.percComplete + ' %';
        
        var plural = stats.nLessons > 1 ? 'modules' : 'module';
        var modulesCompleted = stats.nLessons ? nl.fmt2('{} of {} {}', stats.nLessonsDone, stats.nLessons, plural) : '';
        plural = stats.nOthers > 1 ? 'other items' : 'other item';
        var othersCompleted = stats.nOthers ? nl.fmt2('{} of {} {}', stats.nOthersDone, stats.nOthers, plural) : '';
        var delim = modulesCompleted && othersCompleted ? ' and ' : '';
        stats.percCompleteDesc = nl.fmt2('{}{}{} completed', modulesCompleted, delim, othersCompleted);
        
        stats.avgAttempts = stats.nLessonsAttempted ? Math.round(stats.nAttempts/stats.nLessonsAttempted*10)/10 : '';
        stats.percScore = stats.nMaxScore ? Math.round(stats.nScore/stats.nMaxScore*100) : 0;
        stats.percScoreStr = stats.percScore ? '' + stats.percScore + ' %' :  '';

        stats.timeSpentStr = Math.ceil(stats.timeSpentSeconds/60);
        stats.timeSpentStr = stats.timeSpentStr > 1 ? stats.timeSpentStr + ' minutes' 
            : stats.timeSpentStr == 1 ? stats.timeSpentStr + ' minute' : '';

        stats.status = _statusInfos[_getStatusId(stats)];
        var ret = {raw_record: report, course: course, user: user,
            usermd: _getMetadataDict(user), stats: stats,
            created: nl.fmt.fmtDateDelta(report.created, null, 'date'), 
            updated: nl.fmt.fmtDateDelta(report.updated, null, 'date')};
        return ret;
    };
    
    function _getStatusId(stats) {
        if (stats.percComplete == 0) return self.STATUS_PENDING;
        if (stats.percComplete < 100) return self.STATUS_STARTED;
        if (stats.nLessonsFailed > 0) return self.STATUS_FAILED;
        if (stats.nCerts > 0) return self.STATUS_CERTIFIED;
        if (stats.nMaxScore == 0) return self.STATUS_DONE;
        return self.STATUS_PASSED;
    }

    this.getMetaHeaders = function(bOnlyMajor) {
        var headers = [];
        var metadata = nlGroupInfo.getUserMetadata(null);
        for(var i=0; i<metadata.length; i++) {
            if (bOnlyMajor && !metadata[i].major) continue;
            headers.push({id: metadata[i].id, name: metadata[i].name});
        }
        return headers;
    };

    function _getMetadataDict(user) {
        var metadata = nlGroupInfo.getUserMetadata(user);
        var ret = {};
        for(var i=0; i<metadata.length; i++)
            ret[metadata[i].id] = metadata[i].value|| '';
        return ret;
    }
    
    var _idFields = ['Report Id', 'Assign Id', 'Course Id'];
    this.getCsvHeader = function() {
        var mh = this.getMetaHeaders(false);
        var headers = ['User Id', 'User Name', 'Email Id', 'Org'];
        for(var i=0; i<mh.length; i++) headers.push(mh[i].name);
        headers = headers.concat(['Course Name', 'Assigned On', 'Last Updated On', 
            'Status', 'Progress', 'Progress Details', 'Quiz Attempts',
            'Achieved %', 'Maximum Score', 'Achieved Score', 'Time Spent (minutes)']);
        if (_data.urlParams.exportTypes.ids)
            headers = headers.concat(_idFields);
        return headers;
    };
    
    this.getCsvRow = function(report) {
        var mh = this.getMetaHeaders(false);
        var ret = [report.user.user_id, report.user.name, report.user.email, report.user.org_unit];
        for(var i=0; i<mh.length; i++) ret.push(report.usermd[mh[i].id]);
        ret = ret.concat([report.course.name, report.created, report.updated,
            report.stats.status.txt, '' + report.stats.percComplete + '%',
            report.stats.percCompleteDesc, report.stats.avgAttempts,
            report.stats.percScoreStr, report.stats.nMaxScore, report.stats.nScore,
            Math.ceil(report.stats.timeSpentSeconds/60)]);
        if (_data.urlParams.exportTypes.ids)
            ret = ret.concat(['id=' + report.raw_record.id, 'id=' + report.raw_record.assignid, 
                'id=' + report.raw_record.courseid]);
        return ret;
    };
    
    this.getCsvModuleHeader = function() {
        var mh = this.getMetaHeaders(false);
        var headers = ['User Id', 'User Name', 'Email Id', 'Org'];
        for(var i=0; i<mh.length; i++) headers.push(mh[i].name);
        headers = headers.concat(['Course Name', 'Module Name', 'Started', 'Ended', 
            'Status', 'Attempts', 'Achieved %', 'Maximum Score', 'Achieved Score', 'Pass %', 
            'Time Spent (minutes)']);
        if (_data.urlParams.exportTypes.ids)
            headers = headers.concat(_idFields);
        return headers;
    };

    this.updateCsvModuleRows = function(report, moduleRows, data) {
        var modules = report.course.lessons;
        var lessonReports = report.raw_record.lessonReports || {};
        var mh = this.getMetaHeaders(false);
        for(var m=0; m<modules.length; m++) {
            var module=modules[m];
            var moduleKey = 'A'+report.course.id + '.' + module.id.split('.').join('_');
        	if (!_checkFilter(_data.selectedCourses, moduleKey)) continue;
            var status = 'pending';
            var perc='';
            var score='';
            var maxScore='';
            var passScore = '';
            var started = '';
            var ended = '';
            var timeSpent='';
            var attempts = '';
            if (module.id in lessonReports) {
                var lrep = lessonReports[module.id];
                maxScore = lrep.selfLearningMode ? 0 : lrep.maxScore || 0;
                passScore = lrep.passScore || '';
                score = lrep.selfLearningMode ? 0 : lrep.score || 0;
                var percentage = maxScore > 0 ? Math.round(score*100/maxScore) : 100;
                var passed = (!lrep.passScore || percentage >= lrep.passScore);
                perc =  maxScore > 0 ? percentage + '%' : '';
                maxScore = maxScore || '';
                score = score || '';
                started = lrep.started || '';
                ended = lrep.ended || '';
                timeSpent = Math.ceil((lrep.timeSpentSeconds||0)/60);
                attempts = lrep.attempt || '';
                status = !lrep.completed ? 'started' :
                    !maxScore ? 'done' :
                    passed ? 'passed' : 'failed';
            }
            
            var ret = [report.user.user_id, report.user.name, report.user.email, report.user.org_unit];
            for(var i=0; i<mh.length; i++) ret.push(report.usermd[mh[i].id]);
            if (started) started = nl.fmt.date2Str(nl.fmt.json2Date(started));
            if (ended) ended = nl.fmt.date2Str(nl.fmt.json2Date(ended));
            ret = ret.concat([report.course.name, module.name, started, ended, status, attempts, perc, 
                maxScore, score, passScore ? passScore + '%' : '', timeSpent]);
            if (_data.urlParams.exportTypes.ids)
                ret = ret.concat(['id=' + report.raw_record.id, 
                    'id=' + report.raw_record.assignid, 'id=' + report.raw_record.courseid]);
            moduleRows.push(nlExporter.getCsvString(ret));
        }
    };
}

//-------------------------------------------------------------------------------------------------
function SummaryStats(nl, nlGroupInfo, _data, _reportProcessor, $scope) {
    
    var _metas = [];
    var _orgDict = {};
    
    this.init = function() {
        _metas = _reportProcessor.getMetaHeaders(false);
    };
    
    this.reset = function() {
        _orgDict = {};
    };
    
    this.removeFromStats = function(report) {
        var keys = _keys(report);
        var key = angular.toJson(keys);
        if (!(key in _orgDict)) _orgDict[key] = _initStatObj(keys);
        _updateStatsObj(report, _orgDict[key], -1);
    };

    this.addToStats = function(report) {
        var keys = _keys(report);
        var key = angular.toJson(keys);
        if (!(key in _orgDict)) _orgDict[key] = _initStatObj(keys);
        _updateStatsObj(report, _orgDict[key], +1);
    };
    
    this.getOrgEntry = function(report) {
        var keys = _keys(report);
        var key = angular.toJson(keys);
        return _orgDict[key] || null;
    };

    this.getStatsData = function() {
        return _orgDict;
    };
    
    function _keys(report) {
        var ret  = [{n: 'org', 'v': report.user.org_unit}];
        var usermeta = report.usermd;
        for(var i=0; i<_metas.length; i++)
            ret.push({n: [_metas[i].id], v:usermeta[_metas[i].id]});
        return ret;
    }
    
    function _initStatObj(keys) {
        var ret = {perc: '', assigned: 0, done: 0, failed: 0, started: 0, pending: 0};
        for (var i=0; i<keys.length; i++) ret[keys[i].n] = keys[i].v;
        return ret;
    }
    
    function _updateStatsObj(report, statsObj, delta) {
        statsObj.assigned += delta;
        var stats = report.stats;
        if (stats.status.id == _reportProcessor.STATUS_PENDING) statsObj.pending += delta;
        else if (stats.status.id == _reportProcessor.STATUS_STARTED) statsObj.started += delta;
        else if (stats.status.id == _reportProcessor.STATUS_FAILED) statsObj.failed += delta;
        else statsObj.done += delta;
        statsObj.perc = statsObj.assigned > 0 ? Math.round(statsObj.done/statsObj.assigned*100) : 0;
        statsObj.percStr = statsObj.perc > 0 ? statsObj.perc + ' %' : '';
    }
}

function _checkFilter(filterItems, userField) {
	return Object.keys(filterItems).length == 0 || (userField in filterItems);
}
		
//-------------------------------------------------------------------------------------------------
module_init();
})();

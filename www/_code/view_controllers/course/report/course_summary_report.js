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
'nlExporter', 'nlRangeSelectionDlg', 'nlGroupInfo', 'nlTable',
function(nl, nlDlg, nlRouter, $scope, nlServerApi, nlExporter, nlRangeSelectionDlg,
    nlGroupInfo, nlTable) {
    var _data = {urlParams: {}, fetchInProgress: false,
        createdFrom: null, createdTill: null, courseRecords: {},
        reportRecords: {}, pendingCourseIds: {},
        reportFetchStartPos: null};

    var _reportProcessor = new ReportProcessor(nl, nlGroupInfo, nlExporter, _data);
    var _summaryStats = new SummaryStats(nl, nlGroupInfo, _data, _reportProcessor, $scope);
    var _fetcher = new Fetcher(nl, nlDlg, nlServerApi, _data, _reportProcessor, _summaryStats);

	function _onPageEnter(userInfo) {
        nlRangeSelectionDlg.init();
		return nl.q(function(resolve, reject) {
            nlGroupInfo.init().then(function() {
                nl.pginfo.pageTitle = nl.t('Course report');
                _initParams();
                _initScope();
                _summaryStats.init();
                _fetcher.fetchCourse(function(result) {
                    if (result.isError) {
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
        _data.urlParams.max = ('max' in params) ? parseInt(params.max) : 50;
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
        columns.push({id: 'user.user_id', name: 'User', smallScreen: true});
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
        columns.push({id: 'user.name', name: 'User name', searchKey: 'username', 
            smallScreen: false, mediumScreen: false, largeScreen: false});
        columns.push({id: 'user.username', name: 'Login id', searchKey: 'login', 
            smallScreen: false, mediumScreen: false, largeScreen: false});
        return columns;
    }
    
    function _userRowClickHandler(rec, action) {
        console.log('_userRowClickHandler: ', rec, action);
        var raw = rec._raw;
        return null;
        return 'TODO: {{rec["user.org_unit"]}}';
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
        columns.push({id: 'started', name: 'Started', searchable: false, styleTd: 'text-right'});
        columns.push({id: 'pending', name: 'Pending', searchable: false, styleTd: 'text-right'});
        return columns;
    }

    function _getOrgSummaryRow(records) {
        var summaryRecord = {'org': {txt: 'Overall'}};
        var assigned = 0;
        var done = 0;
        var started = 0;
        var pending = 0;
        for (var i=0; i<records.length; i++) {
            var rec = records[i];
            if (!rec.passesFilter) continue;
            assigned += rec.assigned;
            done += rec.done;
            started += rec.started;
            pending += rec.pending;
        }

        summaryRecord['percStr'] = {txt: assigned > 0 ? Math.round(done/assigned*100) + ' %': ''};
        summaryRecord['assigned'] = {txt: assigned};
        summaryRecord['done'] = {txt: done};
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
        if (_data.fetchInProgress) return false;
        if (tbid != 'fetchmore') return true;
        return _data.reportFetchStartPos != null;
    };
    
    function _showRangeSelection() {
        if (_fetcher.isFetchInProgress()) return;
        nlRangeSelectionDlg.show($scope, true).then(function(dateRange) {
            if (!dateRange) return;
            _data.createdFrom = dateRange.updatedFrom;
            _data.createdTill = dateRange.updatedTill;

            _data.reportRecords = {};
            _summaryStats.reset();
            _data.reportFetchStartPos = null;

            _getDataFromServer();
        });
    }
    
    function _fetchMore() {
        if (_fetcher.isFetchInProgress()) return;
        _getDataFromServer();
    }

    function _getDataFromServer() {
        nlDlg.showLoadingScreen();
        _fetcher.fetchReports(function(result) {
            nlDlg.hideLoadingScreen();
            _updateScope();
        });
    }
    
    function _updateScope() {
        var cn = _getCourseName();
        var title = nl.t('Course report');
        if (cn) title += ': ' + cn;
        nl.pginfo.pageTitle = title;
        
        $scope.fetchInProgress = _data.fetchInProgress;
        $scope.canFetchMore = (_data.reportFetchStartPos != null);
        
        var reportAsList = _getReportsAsList();
        $scope.noDataFound = (reportAsList.length == 0);
        nlTable.updateTableObject($scope.utable, reportAsList);
        nlTable.updateTableObject($scope.otable, _getSummaryAsList());
    }

    function _initChartData() {
        var labels =  ['done', 'started', 'pending'];
        var colors = ['#007700', '#FFCC00', '#A0A0C0'];

        $scope.charts = [{
            type: 'doughnut',
            title: 'Progress',
            data: [0, 0, 0],
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
        c.data = [summaryRecord.done.txt, summaryRecord.started.txt, summaryRecord.pending.txt];
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
        console.log('ranges:', ranges);
        return ranges;
    }

    function _getCourseName() {
        if (!_data.urlParams.courseId) return '';
        if (!_data.courseRecords[_data.urlParams.courseId]) return '';
        return _data.courseRecords[_data.urlParams.courseId].name || '';
    }

    function _onExport() {
        if (_fetcher.isFetchInProgress()) return;
        var dlg = nlDlg.create($scope);
        dlg.scope.export = {summary: true, user: true, module: false};
        
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
        var cancelButton = {
            text : nl.t('Cancel')
        };
        dlg.show('view_controllers/course/report/course_rep_export.html',
            [exportButton], cancelButton);
    }

    var _CSV_DELIM = '\n';
    function _export(resolve, reject) {
        try {
            var zip = new JSZip();

            if (_data.urlParams.exportTypes.summary) {
                var records = _getSummaryAsList();
                for(var start=0, i=1; start < records.length; i++) {
                    var pending = records.length - start;
                    pending = pending > nlExporter.MAX_RECORDS_PER_CSV ? nlExporter.MAX_RECORDS_PER_CSV : pending;
                    var fileName = nl.fmt2('CourseSummaryReport-{}.csv', i);
                    _createSummaryCsv(records, zip, fileName, start, start+pending);
                    start += pending;
                }
            }

            var moduleRows = _data.urlParams.exportTypes.module ? [] : null;

            if (_data.urlParams.exportTypes.user || _data.urlParams.exportTypes.module) {
                var records = _getReportsAsList();
                for(var start=0, i=1; start < records.length; i++) {
                    var pending = records.length - start;
                    pending = pending > nlExporter.MAX_RECORDS_PER_CSV ? nlExporter.MAX_RECORDS_PER_CSV : pending;
                    var fileName = nl.fmt2('CourseUserReport-{}.csv', i);
                    _createUserCsv(records, zip, fileName, start, start+pending, moduleRows);
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
    
    function _getSummaryAsList() {
        var ret = _dictToList(_summaryStats.getStatsData());
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
    
    function _createUserCsv(records, zip, fileName, start, end, moduleRows) {
        var header = _reportProcessor.getCsvHeader();
        var rows = [nlExporter.getCsvString(header)];
        for (var i=start; i<end; i++) {
            var row = _reportProcessor.getCsvRow(records[i]);
            rows.push(nlExporter.getCsvString(row));
            if (moduleRows) _reportProcessor.updateCsvModuleRows(records[i], moduleRows);
        }
        if (_data.urlParams.exportTypes.user) {
            var content = rows.join(_CSV_DELIM);
            zip.file(fileName, content);
        }
    }
    
    function _createSummaryCsv(summaryStats, zip, fileName, start, end) {
        var header = ['Org'];
        var metas = _reportProcessor.getMetaHeaders(true);
        for(var i=0; i<metas.length; i++) header.push(metas[i].name);
        header = header.concat(['Completion', 'Assigned', 'Done', 'Started', 'Pending']);
        var rows = [nlExporter.getCsvString(header)];
        for (var i=start; i<end; i++) {
            var record = summaryStats[i];
            var row = [record.org];
            for (var j=0; j<metas.length; j++) row.push(record[metas[j].id]);
            row = row.concat([record.perc ? record.perc+ '%' : '', record.assigned, record.done, record.started, record.pending]);
            rows.push(nlExporter.getCsvString(row));
        }
        var content = rows.join(_CSV_DELIM);
        zip.file(fileName, content);
    }
}];

//-------------------------------------------------------------------------------------------------
function Fetcher(nl, nlDlg, nlServerApi, _data, _reportProcessor, _summaryStats) {
    var self = this;
    
    this.isFetchInProgress = function(dontShowAlert) {
        if (!_data.fetchInProgress) return false;
        if (dontShowAlert) return true;
        nlDlg.popupAlert({title: 'Please wait', template: 'Currently feching data from server. You can initiate the next operation once the fetching is completed.'});
        return true;
    };

    this.fetchCourse = function(onDoneCallback) {
        return _fetchCourses(onDoneCallback);
    };
    
    this.fetchReports = function(onDoneCallback) {
        if (this.isFetchInProgress()) {
            onDoneCallback({isError: true});
            return;
        }
        _data.fetchInProgress = true;
        _fetchReports(function(result) {
            if (result.isError) {
                _data.fetchInProgress = false;
                onDoneCallback(result);
                return;
            }
            if (result.fetchDone) _data.fetchInProgress = false;

            var records = result.resultset;
            for (var i=0; i<records.length; i++) {
                var report = records[i];
                report = _reportProcessor.process(report);
                if (!report) continue;
                var rid = report.raw_record.id;
                if (rid in _data.reportRecords)
                    _summaryStats.removeFromStats(_data.reportRecords[rid]);
                _data.reportRecords[rid] = report;
                _summaryStats.addToStats(report);
            }
            onDoneCallback(result);
        });
    };
    
    //-----------------------------------------------------------------------------------
    function _fetchReports(onDoneCallback) {
        var params = {compact: true, startpos: _data.reportFetchStartPos,
            max: _data.urlParams.max, createdfrom: _data.createdFrom,
            createdtill: _data.createdTill};
        if (_data.urlParams.courseId) params.courseid = _data.urlParams.courseId;
        
        nlServerApi.batchFetch(nlServerApi.courseGetAllReportList, params, function(result, promiseHolder) {
            if (result.isError) {
                onDoneCallback(result);
                return;
            }
            _data.reportFetchStartPos = result.canFetchMore ? result.nextStartPos : null;

            var records = result.resultset;
            for(var i=0; i<records.length; i++) {
                var courseid = records[i].courseid;
                if (courseid in _data.courseRecords) continue;
                _data.pendingCourseIds[courseid] = true;
            }

            if (Object.keys(_data.pendingCourseIds).length > 0) {
                promiseHolder.promise = nl.q(function(resolve, reject) {
                    _fetchCourses(function(result2) {
                        if (result2.isError) {
                            resolve(false);
                            onDoneCallback(result2);
                            return;
                        }
                        resolve(true);
                        onDoneCallback(result);
                    })
                });
            } else {
                nl.timeout(function() {
                    onDoneCallback(result);
                });
            }
        }, _data.urlParams.limit, 'course learning record');
    }
    
    //-----------------------------------------------------------------------------------
    function _fetchCourses(onDoneCallback) {
        var cids = [];
        for (var cid in _data.pendingCourseIds) cids.push(parseInt(cid));
        _fetchCoursesInBatchs(cids, 0, onDoneCallback);
    }

    var MAX_PER_BATCH = 50;
    var courseProcessor = new CourseProcessor();
    function _fetchCoursesInBatchs(cids, startPos, onDoneCallback) {
        var courseIds = [];
        var maxLen = cids.length < startPos + MAX_PER_BATCH ? cids.length : startPos + MAX_PER_BATCH;
        for(var i=startPos; i<maxLen; i++) courseIds.push(cids[i]);
        if (courseIds.length == 0) {
            onDoneCallback({isError: false, fetchDone: true});
            return;
        }
        nlServerApi.courseGetMany(courseIds, true).then(function(result) {
            for(var i=0; i<result.length; i++) {
                var course = result[i];
                _data.courseRecords[course.id] = courseProcessor.process(course);
                delete _data.pendingCourseIds[course.id];
            }
            startPos += result.length;
            _fetchCoursesInBatchs(cids, startPos, onDoneCallback);
        }, function(error) {
            onDoneCallback({isError: true, errorMsg: error});
        });
    }
}

//-------------------------------------------------------------------------------------------------
function CourseProcessor() {

    var _idToFullName = {};
    
    this.process = function(course) {
        _idToFullName = {};
        var ret = {id: course.id, name: course.name || '', created: course.created || null, 
            updated: course.updated || null, certificates: [], lessons: []};
        var modules = (course.content || {}).modules || [];
        for (var i=0; i<modules.length; i++) {
            var m = modules[i];
            if (!m.id) continue;
            _updateIdToFullName(m);
            if (m.type == 'lesson') {
                ret.lessons.push({id: m.id, name:_idToFullName[m.id]});
                continue;
            }
            if (m.type != 'link') continue;
            var urlParams = (m.urlParams || '').toLowerCase();
            if (urlParams.indexOf('course_cert') < 0) continue;
            ret.certificates.push(m.id);
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
    this.STATUS_PENDING = 0;
    this.STATUS_STARTED = 1;
    this.STATUS_DONE = 2;
    
    var _statusInfos = [
        {id: this.STATUS_PENDING, txt: 'pending', icon: 'ion-ios-circle-filled fgrey'},
        {id: this.STATUS_STARTED, txt: 'started', icon: 'ion-ios-circle-filled fgreen'},
        {id: this.STATUS_DONE, txt: 'done', icon: 'ion-checkmark-circled fgreen'}];
        
    this.process = function(report) {
        var user = nlGroupInfo.getUserObj(''+report.student);
        if (!user) return null;
        var course = _data.courseRecords[report.courseid];
        if (!course) return null;

        var lessons = course.lessons;
        var lessonReps = report.lessonReports || {};

        var nLessons = 0;
        var nLessonsDone = 0;
        var nAttempts = 0;
        var nLessonsAttempted = 0;
        for (var i=0; i<lessons.length; i++) {
            nLessons++;
            var lid = lessons[i].id;
            var rep = lessonReps[lid];
            if (!rep) continue;
            if (!rep.selfLearningMode && rep.attempt) {
                nAttempts += rep.attempt;
                nLessonsAttempted++;
            }
            if (!rep.completed) continue;
            if (rep.selfLearningMode) {
                rep.maxScore = 0;
                rep.score = 0;
            }
            var perc = rep.maxScore ? Math.round(rep.score / rep.maxScore * 100) : 100;
            if (!rep.passScore || perc >= rep.passScore) nLessonsDone++;
        }
        var percComplete = nLessons ? Math.round(nLessonsDone/nLessons*100) : 100;
        var avgAttempts = nLessonsAttempted ? Math.round(nAttempts/nLessonsAttempted*10)/10 : '';

        var nCerts = 0;
        var certs = course.certificates;
        var totalCerts = Object.keys(course.certificates).length;
        var statusinfo = report.statusinfo || {};
        for (var i=0; i<certs.length; i++) {
            var cid = certs[i];
            var sinfo = statusinfo[cid];
            if (sinfo && sinfo.status == 'done') nCerts++;
        }

        var statusId = (percComplete == 100 && nCerts == totalCerts) ? this.STATUS_DONE
            : (nAttempts == 0 && nCerts == 0) ? this.STATUS_PENDING : this.STATUS_STARTED;
        var status = _statusInfos[statusId];
        var stats = {status: status, percComplete: percComplete, percCompleteStr: '' + percComplete + ' %',
            nLessonsDone: nLessonsDone, nLessons: nLessons, avgAttempts: avgAttempts, 
            nAttempts: nAttempts, nLessonsAttempted: nLessonsAttempted,
            nCerts: nCerts, totalCerts: totalCerts};
        
        var ret = {raw_record: report, course: course, user: user,
            usermd: _getMetadataDict(user), stats: stats,
            created: nl.fmt.fmtDateDelta(report.created, null, 'date'), 
            updated: nl.fmt.fmtDateDelta(report.updated, null, 'date')};
        return ret;
    };
    
    this.getMetaHeaders = function(bOnlyMajor) {
        var headers = [];
        var metadata = nlGroupInfo.getUserMetadata(null);
        for(var i=0; i<metadata.length; i++) {
            if (bOnlyMajor && !metadata[i].major) continue;
            headers.push({id: metadata[i].id, name: metadata[i].name});
        }
        return headers;
    }

    function _getMetadataDict(user) {
        var metadata = nlGroupInfo.getUserMetadata(user);
        var ret = {};
        for(var i=0; i<metadata.length; i++)
            ret[metadata[i].id] = metadata[i].value|| '';
        return ret;
    }

    this.getCsvHeader = function() {
        var mh = this.getMetaHeaders(false);
        var headers = ['User', 'Org'];
        for(var i=0; i<mh.length; i++) headers.push(mh[i].name);
        headers = headers.concat(['Course', 'Status', 'Progress',
            'Average Attempts', 'Certificates', 'Assigned On', 'Last Updated On',
            'Report id', 'Assign id', 'Course id']);
        return headers;
    };
    
    this.getCsvRow = function(report) {
        var mh = this.getMetaHeaders(false);
        var ret = [report.user.user_id, report.user.org_unit];
        for(var i=0; i<mh.length; i++) ret.push(report.usermd[mh[i].id]);
        ret = ret.concat([report.course.name, report.stats.status.txt, '' + report.stats.percComplete + '%',
            report.stats.avgAttempts, report.stats.nCerts, report.created, report.updated,
            'id=' + report.raw_record.id, 'id=' + report.raw_record.assignid, 'id=' + report.raw_record.courseid]);
        return ret;
    };
    
    this.getCsvModuleHeader = function() {
        var mh = this.getMetaHeaders(false);
        var headers = ['User', 'Org'];
        for(var i=0; i<mh.length; i++) headers.push(mh[i].name);
        headers = headers.concat(['Course', 'Module', 'Status', 'Percentage', 
            'Score', 'Max score', 'Started', 'Ended', 'Time spent (mins)', 'Attempts',
            'Report id', 'Assign id', 'Course id']);
        return headers;
    };

    this.updateCsvModuleRows = function(report, moduleRows) {
        var modules = report.course.lessons;
        var lessonReports = report.raw_record.lessonReports || {};
        var mh = this.getMetaHeaders(false);
        
        for(var m=0; m<modules.length; m++) {
            var module=modules[m];
            var status = 'pending';
            var perc='';
            var score='';
            var maxScore='';
            var started = '';
            var ended = '';
            var timeSpent='';
            var attempts = '';
            if (module.id in lessonReports) {
                var lrep = lessonReports[module.id];
                maxScore = lrep.selfLearningMode ? 0 : lrep.maxScore || 0;
                score = lrep.selfLearningMode ? 0 : lrep.score || 0;
                perc = maxScore > 0 ? Math.round(score*100/maxScore) + '%' : '';
                maxScore = maxScore || '';
                score = score || '';
                started = lrep.started || '';
                ended = lrep.started || '';
                timeSpent = Math.ceil((lrep.timeSpentSeconds||0)/60);
                attempts = lrep.attempt || '';
                status = (lrep.completed ? 'done' : 'started');
            }
            
            var ret = [report.user.user_id, report.user.org_unit];
            for(var i=0; i<mh.length; i++) ret.push(report.usermd[mh[i].id]);
            ret = ret.concat([report.course.name, module.name, status, perc, 
                score, maxScore, started, ended, timeSpent, attempts,
                'id=' + report.raw_record.id, 
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
        _metas = _reportProcessor.getMetaHeaders(true);
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
    }
    
    function _keys(report) {
        var ret  = [{n: 'org', 'v': report.user.org_unit}];
        var usermeta = report.usermd;
        for(var i=0; i<_metas.length; i++)
            ret.push({n: [_metas[i].id], v:usermeta[_metas[i].id]});
        return ret;
    }
    
    function _initStatObj(keys) {
        var ret = {perc: '', assigned: 0, done: 0, started: 0, pending: 0};
        for (var i=0; i<keys.length; i++) ret[keys[i].n] = keys[i].v;
        return ret;
    }
    
    function _updateStatsObj(report, statsObj, delta) {
        statsObj.assigned += delta;
        var stats = report.stats;
        if (stats.status.id == _reportProcessor.STATUS_PENDING) statsObj.pending += delta;
        else if (stats.status.id == _reportProcessor.STATUS_STARTED) statsObj.started += delta;
        else statsObj.done += delta;
        statsObj.perc = statsObj.assigned > 0 ? Math.round(statsObj.done/statsObj.assigned*100) : 0;
        statsObj.percStr = statsObj.perc > 0 ? statsObj.perc + ' %' : '';
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

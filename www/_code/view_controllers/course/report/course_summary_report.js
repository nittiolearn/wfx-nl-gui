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
'nlExporter', 'nlRangeSelectionDlg', 'nlGroupInfo',
function(nl, nlDlg, nlRouter, $scope, nlServerApi, nlExporter, nlRangeSelectionDlg,
    nlGroupInfo) {
    var _data = {urlParams: {}, fetchInProgress: false,
        createdFrom: null, createdTill: null, courseRecords: {},
        reportRecords: [], pendingCourseIds: {},
        reportFetchStartPos: null};

    var _reportProcessor = new ReportProcessor(nl, nlGroupInfo, _data);
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
        $scope.ui = {showOrgs: true, showUsers: false};
        $scope.doughnut = {
            label: ["completed", "started", "pending"],
            color: ['#007700', '#FFCC00', '#A0A0C0'],
        };
        $scope.search = new Searcher(nl);
        $scope.usearch = {filter: '',  onClick: _filterUserList, 
            filterAttrs: _getUserFilterAttrs(), getFilterFields: _getUserFilterFields};
        $scope.osearch = {filter: '', onClick: _filterOrgList,
            filterAttrs: _getOrgFilterAttrs(), getFilterFields: _getOrgFilterFields};
    }
    
    $scope.canShow = function(tbid) {
        if (_data.fetchInProgress) return false;
        if (tbid != 'fetchmore') return true;
        return _data.reportFetchStartPos != null;
    };
    
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
    
    function _getUserFilterAttrs() {
        var filterAttrs = {'course': true, 'user': true, 'userid': true,
            'org': true, 'status': true};
        var mh = _reportProcessor.getMetaHeaders(true);
        for(var i=0; i<mh.length; i++) filterAttrs[mh[i].name.toLowerCase()] = true;
        return filterAttrs;
    }
    
    function _getUserFilterFields(record) {
        var fields = {'course': record.course.name, 'user': record.user.name, 
            'userid': record.user.username, 'org': record.user.org_unit,
            'status': record.stats.status.txt};
        var mh = _reportProcessor.getMetaHeaders(true);
        for(var i=0; i<mh.length; i++) fields[mh[i].name.toLowerCase()] = record.usermd[mh[i].id];
        return fields;
    }
    
    function _getOrgFilterAttrs() {
        var filterAttrs = {'org': true};
        var mh = _reportProcessor.getMetaHeaders(true);
        for(var i=0; i<mh.length; i++) filterAttrs[mh[i].name.toLowerCase()] = true;
        return filterAttrs;
    }
    
    function _getOrgFilterFields(record) {
        var mh = _reportProcessor.getMetaHeaders(true);
        if (record.keys.length != mh.length+1) return {};
        var fields = {'org': record.keys[mh.length].v};
        for(var i=0; i<mh.length; i++)
            fields[mh[i].name.toLowerCase()] = record.keys[i].v;
        return fields;
    }

    function _showRangeSelection() {
        if (_fetcher.isFetchInProgress()) return;
        nlRangeSelectionDlg.show($scope, true).then(function(dateRange) {
            if (!dateRange) return;
            _data.createdFrom = dateRange.updatedFrom;
            _data.createdTill = dateRange.updatedTill;

            _data.reportRecords = [];
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
        
        _filterUserList();
        _filterOrgList();
    }
    
    function _filterUserList() {
        var filter = $scope.search.getFilter($scope.usearch);
        var records = _data.reportRecords;
        $scope.actualRecordCnt = records.length;
        var max = records.length > MAX_LIST_SIZE ? MAX_LIST_SIZE: records.length;

        $scope.records = [];
        for (var i=0; i<records.length; i++) {
            if ($scope.records.length >= max) break;
            if ($scope.search.isFilterPass($scope.usearch, records[i], filter)) $scope.records.push(records[i]);
        }
        $scope.search.updateScope($scope.usearch, $scope.records.length, $scope.actualRecordCnt);
    }

    function _filterOrgList() {
        $scope.summaryStats = _summaryStats.getStatsData($scope.osearch.filter);
        _updateDoughnutData($scope.summaryStats.overall);
    }
    
    function _updateDoughnutData(statsObj) {
        if (!statsObj) return;
        $scope.doughnut.data = [statsObj.done, statsObj.started, statsObj.pending];
    }

    function _getCourseName() {
        if (!_data.urlParams.courseId) return '';
        if (!_data.courseRecords[_data.urlParams.courseId]) return '';
        return _data.courseRecords[_data.urlParams.courseId].name || '';
    }

    function _onExport() {
        if (_fetcher.isFetchInProgress()) return;
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

    var _CSV_DELIM = '\n';
    function _export(resolve, reject) {
        try {
            var zip = new JSZip();
            
            var records = _data.reportRecords;
            for(var start=0, i=1; start < records.length; i++) {
                var pending = records.length - start;
                pending = pending > nlExporter.MAX_RECORDS_PER_CSV ? nlExporter.MAX_RECORDS_PER_CSV : pending;
                var fileName = nl.fmt2('CourseUserReport-{}.csv', i);
                _createDetailedCsv(records, zip, fileName, start, start+pending);
                start += pending;
            }

            var summaryStats = _summaryStats.getStatsData();
            for(var start=0, i=1; start < summaryStats.orgs.length; i++) {
                var pending = summaryStats.orgs.length - start;
                pending = pending > nlExporter.MAX_RECORDS_PER_CSV ? nlExporter.MAX_RECORDS_PER_CSV : pending;
                var fileName = nl.fmt2('CourseSummaryReport-{}.csv', i);
                _createSummaryCsv(summaryStats, zip, fileName, start, start+pending);
                start += pending;
            }

            nlExporter.saveZip(zip, 'CourseReport.zip', null, resolve, reject);
        } catch(e) {
            console.error('Error while exporting', e);
            nlDlg.popupAlert({title: 'Error while exporting', template: e});
            reject(e);
        }
    }
    
    function _createDetailedCsv(records, zip, fileName, start, end) {
        var header = _reportProcessor.getCsvHeader();
        var rows = [nlExporter.getCsvString(header)];
        for (var i=start; i<end; i++) {
            var row = _reportProcessor.getCsvRow(records[i]);
            rows.push(nlExporter.getCsvString(row));
        }
        var content = rows.join(_CSV_DELIM);
        zip.file(fileName, content);
    }
    
    function _createSummaryCsv(summaryStats, zip, fileName, start, end) {
        var header = [];
        for(var i=0; i<summaryStats.metas.length; i++) header.push(summaryStats.metas[i].name);
        header = header.concat(['Organization', 'Assigned', 'Done', 'Started', 'Pending']);
        var rows = [nlExporter.getCsvString(header)];
        for (var i=start; i<end; i++) {
            var row = [];
            var record = summaryStats.orgs[i];
            for (var j=0; j<record.keys.length; j++) row.push(record.keys[j].v);
            row = row.concat([record.assigned, record.done, record.started, record.pending]);
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
                _data.reportRecords.push(report);
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
function ReportProcessor(nl, nlGroupInfo, _data) {
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
            if (rep.attempt) {
                nAttempts += rep.attempt;
                nLessonsAttempted++;
            }
            if (!rep.completed) continue;
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
        var stats = {status: status,
            percComplete: percComplete, nLessonsDone: nLessonsDone, nLessons: nLessons,
            avgAttempts: avgAttempts, nAttempts: nAttempts, nLessonsAttempted: nLessonsAttempted,
            nCerts: nCerts, totalCerts: totalCerts}
        
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
        var headers = [];
        for(var i=0; i<mh.length; i++) headers.push(mh[i].name);
        headers = headers.concat(['Organization', 'User', 'Course', 'Status', 
            'Average Attempts', 'Certificates', 'Assigned On', 'Last Updated On']);
        return headers;
    };
    
    this.getCsvRow = function(report) {
        var mh = this.getMetaHeaders(false);
        var ret = [];
        for(var i=0; i<mh.length; i++) ret.push(report.usermd[mh[i].id]);
        ret = ret.concat([report.user.org_unit, report.user.user_id, report.course.name, 
            report.stats.status.txt, report.stats.avgAttempts, report.stats.nCerts, 
            report.created, report.updated]);
        return ret;
    };
}

//-------------------------------------------------------------------------------------------------
function SummaryStats(nl, nlGroupInfo, _data, _reportProcessor, $scope) {
    
    var _metas = [];
    var _orgDict = {};
    var _overallStats = null;
    
    this.init = function() {
        _metas = _reportProcessor.getMetaHeaders(true);
    };
    
    this.reset = function() {
        _orgDict = {};
        _overallStats = _initStatObj(null);
    };
    
    this.addToStats = function(report) {
        var keys = _keys(report);
        var key = angular.toJson(keys);
        if (!(key in _orgDict)) _orgDict[key] = _initStatObj(keys);
        _updateStatsObj(report, _orgDict[key]);
        _updateStatsObj(report, _overallStats);
    };
    
    this.getStatsData = function() {
        var ret = {metas: _metas, overall: _overallStats};
        var records = [];
        for(var key in _orgDict)
            records.push(_orgDict[key]);
        ret.actualCnt = records.length;

        var filter = $scope.search.getFilter($scope.osearch);
        var max = records.length > MAX_LIST_SIZE ? MAX_LIST_SIZE: records.length;

        var filtered = [];
        for (var i=0; i<records.length; i++) {
            if (filtered.length >= max) break;
            if ($scope.search.isFilterPass($scope.osearch, records[i], filter)) filtered.push(records[i]);
        }
        filtered.sort(function(a, b) {
            return b.assigned - a.assigned;
        });
        ret.orgs = filtered;
        
        $scope.search.updateScope($scope.osearch, ret.orgs.length, ret.actualCnt);
        return ret;
    }
    
    function _keys(report) {
        var ret  = [];
        var usermeta = report.usermd;
        for(var i=0; i<_metas.length; i++) {
            ret.push({n: _metas[i].id, v:usermeta[_metas[i].id]});
        }
        ret.push({n: 'ou', v: report.user.org_unit});
        return ret;
    }
    
    function _initStatObj(keys) {
        return {keys: keys, assigned: 0, done: 0, started: 0, pending: 0};
    }
    
    function _updateStatsObj(report, statsObj) {
        statsObj.assigned++;
        var stats = report.stats;
        if (stats.status.id == _reportProcessor.STATUS_PENDING) statsObj.pending++;
        else if (stats.status.id == _reportProcessor.STATUS_STARTED) statsObj.started++;
        else statsObj.done++;
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

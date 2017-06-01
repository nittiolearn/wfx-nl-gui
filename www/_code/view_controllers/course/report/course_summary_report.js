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

//-------------------------------------------------------------------------------------------------
var CourseReportSummaryCtrl = ['nl', 'nlDlg', 'nlRouter', '$scope', 'nlServerApi', 
'nlExporter', 'nlRangeSelectionDlg', 'nlGroupInfo',
function(nl, nlDlg, nlRouter, $scope, nlServerApi, nlExporter, nlRangeSelectionDlg,
    nlGroupInfo) {
    var _data = {urlParams: {}, fetchInProgress: false, canFetchMore: false,
        updatedFrom: null, updatedTill: null,
        courseRecords: {}, reportRecords: [], pendingCourseIds: {}};
    var _fetcher = new Fetcher(nl, nlDlg, nlServerApi, _data);
    var _reportProcessor = new ReportProcessor(nl, nlGroupInfo, _data);

	function _onPageEnter(userInfo) {
        nlRangeSelectionDlg.init();
		return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Course summary report');
		    _initParams();
		    $scope.toolbar = _getToolbar();
            $scope.ui = {showDetails: true};
            $scope.data = _data;
            $scope.stats = {};
            nlGroupInfo.init().then(function() {
                resolve(true);
                _showRangeSelection();
            }, function(err) {
                resolve(false);
            });
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    function _initParams() {
        var params = nl.location.search();
        _data.urlParams.max = ('max' in params) ? parseInt(params.max) : 50;
        _data.urlParams.limit = ('limit' in params) ? parseInt(params.limit) : null;
        _data.urlParams.courseId = params.courseid || null;
    }

    function _getToolbar() {
        return [{
            title : 'Get reports for required date/time range',
            icon : 'ion-android-time',
            onClick : function() {
                _showRangeSelection();
            }
        }];
    }

    function _showRangeSelection() {
        if (_fetcher.isFetchInProgress()) return;
        nlRangeSelectionDlg.show($scope).then(function(dateRange) {
            if (!dateRange) return;
            _data.updatedFrom = dateRange.updatedFrom;
            _data.updatedTill = dateRange.updatedTill;
            $scope.csvHeader = _reportProcessor.getHeader();
            $scope.csvRows = [];
            _getDataFromServer();
        });
    }

    function _getDataFromServer() {
        nlDlg.showLoadingScreen();
        _fetcher.fetch(function(result) {
            nlDlg.hideLoadingScreen();
            _updateScope();
            if (!result.fetchDone) return;
            for (var i=0; i<_data.reportRecords.length; i++) {
                var report = _data.reportRecords[i];
                $scope.csvRows.push(_reportProcessor.process(report));
            }
        });
    }
    
    function _updateScope() {
        $scope.dataJson = angular.toJson(_data, 2);
        $scope.stats.repcount = _data.reportRecords.length;
        $scope.stats.courses = Object.keys(_data.courseRecords);
        $scope.stats.coursecount = $scope.stats.courses.length;
    }
}];

//-------------------------------------------------------------------------------------------------
function Fetcher(nl, nlDlg, nlServerApi, _data) {
    var self = this;
    
    this.isFetchInProgress = function() {
        if (!_data.fetchInProgress) return false;
        nlDlg.popupAlert('Already feching data from server. Please wait.');
        return true;
    };

    this.fetch = function(onDoneCallback) {
        if (this.isFetchInProgress()) {
            onDoneCallback({isError: true});
            return;
        }
        _data.fetchInProgress = true;

        _data.reportRecords = [];
        _data.pendingCourseIds = {};
        _data.reportFetchStartPos = null;

        _executeFunction(0, function(result) {
            if (result.isError) {
                _data.fetchInProgress = false;
                canFetchMore
                onDoneCallback(result);
                return;
            }
            if (result.fetchDone) _data.fetchInProgress = false;
            onDoneCallback(result);
        });
    };
    
    var functionList = [_fetchReports, _fetchCourses];
    function _executeFunction(pos, onDoneCallback) {
        functionList[pos](function(result) {
            if (result.isError) {
                onDoneCallback(result);
                return;
            }
            if (!result.fetchDone) {
                onDoneCallback(result);
                return;
            }
            pos++;
            if (pos < functionList.length) _executeFunction(pos, onDoneCallback);
            else onDoneCallback(result);
        });
    }

    //-----------------------------------------------------------------------------------
    function _fetchReports(onDoneCallback) {
        var params = {compact: true, startpos: _data.reportFetchStartPos,
            max: _data.urlParams.max, updatedfrom: _data.updatedFrom,
            updatedtill: _data.updatedTill};
        if (_data.urlParams.courseId) params.courseid = _data.urlParams.courseId;
        
        nlServerApi.batchFetch(nlServerApi.courseGetAllReportList, params, function(result) {
            if (result.isError) {
                onDoneCallback(result);
                return;
            }
            var records = result.resultset;
            for(var i=0; i<records.length; i++) {
                _data.reportRecords.push(records[i]);
                var courseid = records[i].courseid;
                if (courseid in _data.courseRecords) continue;
                _data.pendingCourseIds[courseid] = true;
            }

            onDoneCallback(result);
            if (!result.fetchDone) return;
            _data.canFetchMore = result.canFetchMore;
            _data.reportFetchStartPos = result.canFetchMore ? result.nextStartPos : null;
        }, _data.urlParams.limit, 'course learning record');
    }
    //-----------------------------------------------------------------------------------
    function _fetchCourses(onDoneCallback) {
        var cids = [];
        for (var cid in _data.pendingCourseIds) cids.push(parseInt(cid));
        _data.pendingCourseIds = {};
        _fetchCoursesInBatchs(cids, 0, onDoneCallback);
    }

    var MAX_PER_BATCH = 50;
    var courseProcessor = new CourseProcessor();
    function _fetchCoursesInBatchs(cids, startPos, onDoneCallback) {
        var courseIds = [];
        var maxLen = cids.length < startPos + MAX_PER_BATCH ? cids.length : startPos + MAX_PER_BATCH;
        for(var i=startPos; i<maxLen; i++) courseIds.push(cids[i]);
        if (courseIds.length == 0) {
            nlDlg.popupStatus('');
            onDoneCallback({isError: false, fetchDone: true});
            return;
        }
        nlServerApi.courseGetMany(courseIds, true).then(function(result) {
            for(var i=0; i<result.length; i++) {
                var course = result[i];
                _data.courseRecords[course.id] = courseProcessor.process(course);
            }
            startPos += result.length;
            nlDlg.popupStatus(nl.fmt2('Fetched {} of {} course objects from server.', startPos, cids.length), false);
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
    
    this.getHeader = function() {
        var headers = ['Organization', 'Username', 'Course', '%Complete', 
            'Average Attempts', 'Certificates', 'Assigned On', 'Last Updated On'];
        return headers;
    };

    this.process = function(report) {
        var user = nlGroupInfo.getUserObj(''+report.student);
        var course = _data.courseRecords[report.courseid];

        var lessons = course.lessons;
        var lessonReps = report.lessonReports || {};

        var nLessons = 0;
        var nLessonsDone = 0;
        var nAttempts = 0;
        var nLessonAttempts = 0;
        for (var i=0; i<lessons.length; i++) {
            nLessons++;
            var lid = lessons[i].id;
            var rep = lessonReps[lid];
            if (!rep) continue;
            if (rep.attempt) {
                nAttempts += rep.attempt;
                nLessonAttempts++;
            }
            if (!rep.completed) continue;
            var perc = rep.maxScore ? Math.round(rep.score / rep.maxScore * 100) : 100;
            if (!rep.passScore || perc >= rep.passScore) nLessonsDone++;
        }
        var percComplete = nLessons ? Math.round(nLessonsDone/nLessons*100) : 100;
        var avgAttempts = nLessonAttempts ? Math.round(nAttempts/nLessonAttempts*10)/10 : '';

        var nCerts = 0;
        var certs = course.certificates;
        var statusinfo = report.statusinfo || {};
        for (var i=0; i<certs.length; i++) {
            var cid = certs[i];
            var sinfo = statusinfo[cid];
            if (sinfo && sinfo.status == 'done') nCerts++;
        }
        
        var ret = [user.org_unit, user.user_id, course.name, percComplete+'%', avgAttempts,
            nCerts, nl.fmt.json2Date(report.created), nl.fmt.json2Date(report.updated)];
        return ret;
    };
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

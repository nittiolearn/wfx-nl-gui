(function() {

//-------------------------------------------------------------------------------------------------
// lr_report_records.js: Process and store a list of db.report records
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.learning_reports.lr_report_records', [])
    .config(configFn)
    .service('nlLrReportRecords', NlLrReportRecords);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
}];

//-------------------------------------------------------------------------------------------------
var NlLrReportRecords = ['nl', 'nlDlg', 'nlGroupInfo', 'nlLrHelper', 'nlLrCourseRecords', 'nlLrFilter', 'nlLrAssignmentRecords', 'nlCourse', 'nlExpressionProcessor', 'nlReportHelper',
function(nl, nlDlg, nlGroupInfo, nlLrHelper, nlLrCourseRecords, nlLrFilter, nlLrAssignmentRecords, nlCourse, nlExpressionProcessor, nlReportHelper) {
    var self = this;
    
    var _records = {};
    var _reminderDict = {};
    var _dates = {};
    var _pastUserData = null;
    var _pastUserDataFetchInitiated = false;
    var _postProcessRecords = [];
    var _userInfo = null;
    var _nominatedUsers = null;
    var _attendanceObj = {};
    this.init = function(userinfo) {
        _userInfo = userinfo;
        _records = {};
        _reminderDict = {};
        _nominatedUsers = {};
        _dates = {minUpdated: null, maxUpdated: null};
        _convertAttendanceArrayToObj(userinfo.groupinfo.attendance);
        if (!nlGroupInfo.isPastUserXlsConfigured()) _pastUserData = {};
    };
    
    this.getReminderDict = function() {
        return _reminderDict;
    };
    
    this.getNominatedUserDict = function() {
        return _nominatedUsers;
    };
    
    this.addRecord = function(report) {
        if (report.ctype == _nl.ctypes.CTYPE_COURSE)
            report = _processCourseReport(report);
        else if (report.ctype == _nl.ctypes.CTYPE_MODULE)
            report = _processModuleReport(report);
        if (!report) return null;
        var rid = report.raw_record.id;
        _records[rid] = report;
        if (!_dates.minUpdated || _dates.minUpdated > report.raw_record.updated) _dates.minUpdated = report.raw_record.updated;
        if (!_dates.maxUpdated || _dates.maxUpdated < report.raw_record.updated) _dates.maxUpdated = report.raw_record.updated;
        return report;
    };
    
    this.updateReportRecords = function() {
        var records = _records;
        this.reset();
        for(var cid in records) {
            var report = records[cid].raw_record;
            self.addRecord(report);
        }
    };

    this.removeRecord = function(repid) {
        if (!(repid in _records)) return;
        delete _records[repid];
    };

    this.reset = function() {
        _records = {};
        _reminderDict = {};
        _nominatedUsers = {};
    };
    
    this.getRecords = function() {
        return _records;
    };

    this.getAnyRecord = function() {
        for (var recid in _records) return _records[recid];
        return null;
    };

    this.asList = function() {
        var ret = nlLrHelper.dictToList(_records);
        ret.sort(function(a, b) {
            return (b.stats.status.id - a.stats.status.id);
        });
        return ret;
    };
    
    function _convertAttendanceArrayToObj(attendanceArray) {
        for(var i=0; i<attendanceArray.length; i++) {
            var att = attendanceArray[i];
            _attendanceObj[att.id] = att;
        }
    }

    function _getRangeStart(rangeEnd, rangeType, rangeSize) {
        if (rangeType == 'months') {
            var month = rangeEnd.getMonth();
            if (rangeEnd.getDate() == 1) month = month -1;
            var year = rangeEnd.getFullYear();
            if (month < 0) {
                year = year -1;
                month = 11;
            }
            return new Date(year, month, 1, 0, 0, 0, 0); 
        } else if (rangeType == 'weeks') {
            var diff = (rangeEnd.getDay() + 5) % 7 + 1; // Sunday = 0=>6, Monday = 1=>7, Tue = 2=>1, ... Sat = 6=>5
            return new Date(rangeEnd.getTime() - diff*24*3600*1000);
        } else if (rangeType == 'days') {
            return new Date(rangeEnd.getTime() - 24*3600*1000);
        }
        return new Date(rangeEnd.getTime() - rangeSize);
    }

    function _getRangeLabel(range, rangeType) {
        if (rangeType == 'months') return nl.fmt.fmtDateDelta(range.start, null, 'month-mini');
        var s = nl.fmt.fmtDateDelta(range.start, null, 'date-mini');
        if (range.end.getTime() - range.start.getTime() <= 24*3600*1000) return s;
        var e = nl.fmt.fmtDateDelta(new Date(range.end.getTime() - 24*3600*1000), null, 'date-mini');
        return nl.fmt2('{} - {}', s, e);
    }

    this.getTimeRanges = function(rangeType, maxBuckets) {
        if (!_dates.minUpdated || !_dates.maxUpdated) return [];
        if (!maxBuckets) maxBuckets = (rangeType == 'days') ? 31 : (rangeType == 'weeks') ? 15 : (rangeType == 'months') ? 15 : 8;

        var day = 24*60*60*1000; // 1 day in ms
        var now = new Date();
        var offset = now.getTimezoneOffset()*60*1000; // in ms
        var start = Math.floor((_dates.minUpdated.getTime()-offset)/day)*day + offset; // Today 00:00 Hrs in local time
        var end = Math.ceil((_dates.maxUpdated.getTime()-offset)/day)*day + offset; // Tomorrow 00:00 Hrs in local time
        var rangeSize = Math.ceil((end - start)/day/maxBuckets);
        rangeSize *= day;
        var ranges = [];
        var rangeEnd = new Date(end);
        for (var i=0; i<maxBuckets; i++) {
            if (rangeEnd.getTime() < start) break;
            var rangeStart = _getRangeStart(rangeEnd, rangeType, rangeSize);
            var range = {start: rangeStart, end: rangeEnd, count: 0, completed: 0};
            range.label = _getRangeLabel(range, rangeType);
            ranges.unshift(range);
            rangeEnd = rangeStart;
        }
        return ranges;
    };
    
    this.postProcessRecordsIfNeeded = function() {
        return nl.q(function(resolve, reject) {
            if (_pastUserData || _postProcessRecords.length == 0 || _pastUserDataFetchInitiated) {
                resolve(true);
                return;
            }
            _pastUserDataFetchInitiated = true;
            nlDlg.popupStatus('Fetching additional user information ...', false);
            nlDlg.showLoadingScreen();
            nlGroupInfo.fetchPastUserXls().then(function(result) {
                _pastUserData = result || {};
                for (var i=0; i<_postProcessRecords.length; i++)
                    self.addRecord(_postProcessRecords[i]);
                _postProcessRecords = [];
                nlDlg.popdownStatus(0);
                resolve(true);
            });
        });
    };
    
    function _getStudentFromReport(report, repcontent) {
        var user = nlGroupInfo.getUserObj(''+report.student);
        if (!user && !_pastUserData) {
            _postProcessRecords.push(report);
            return null;
        }

        if (!user) user = _pastUserData[repcontent.studentname];
        if (!user) user = nlGroupInfo.getDefaultUser(repcontent.studentname || '');
        return user;
    }
    
    function _processCourseReport(report) {
        var repcontent = _updateCommonParams(report, 'course');
        var user = _getStudentFromReport(report, repcontent);
        if (!user) return null;
        _nominatedUsers[user.id] = true;
        var course = nlLrCourseRecords.getRecord(report.lesson_id);
        if (!course) course = {};
        report.canReview = true;
        if(!course.is_published) report.canReview = false;
        var courseAssignment = nlLrAssignmentRecords.getRecord('course_assignment:'+report.assignment) || {};
        if (!courseAssignment.info) courseAssignment.info = {};
        var repHelper = nlReportHelper.getCourseStatusHelper(report, _userInfo.groupinfo, courseAssignment, course);
        var stainf = repHelper.getCourseStatus();

        var contentmetadata = 'contentmetadata' in course ? course.contentmetadata : {};
        report._grade = contentmetadata.grade || '';
        report.subject = contentmetadata.subject || ''; 
        
        var stats = {nLessonsAttempted: stainf.nPassedQuizes+stainf.nFailedQuizes,
            internalIdentifier:report.id,
            timeSpentSeconds: stainf.onlineTimeSpentSeconds, 
            iltTimeSpent: stainf.iltTimeSpent, 
            iltTotalTime: stainf.iltTotalTime,
            percCompleteStr: '' + stainf.progPerc + ' %',
            percCompleteDesc: stainf.progDesc,
            nScore: stainf.nTotalQuizScore, nMaxScore: stainf.nTotalQuizMaxScore,
        };
        stats.avgAttempts = stats.nLessonsAttempted ? Math.round(stainf.nQuizAttempts/stats.nLessonsAttempted*10)/10 : 0;
        stats.timeSpentStr = nl.fmt2('{} minutes online learning and {} minutes instructor led', 
            Math.ceil(stats.timeSpentSeconds/60), stats.iltTimeSpent);
        
        stats.percScore = stats.nMaxScore ? Math.round(100.0*stats.nScore / stats.nMaxScore) : 0;
        stats.percScoreStr = stats.percScore ? '' + stats.percScore + ' %' :  '';
        repcontent.statusinfo = stainf.itemIdToInfo;
 
        if(!nlReportHelper.isEndCourseState(stainf.status) && (nlLrFilter.getType() == 'course_assign')) {
            if(Object.keys(_reminderDict).length == 0) {
                _reminderDict['name'] = repcontent.name;
                _reminderDict['assigned_by'] = repcontent.sendername;
                _reminderDict['ctype'] = report.ctype;
                _reminderDict['users'] = [];
            }
            var currentDate = new Date();
            var endtime = repcontent.not_after && !repcontent.submissionAfterEndtime ? nl.fmt.json2Date(repcontent.not_after) : '';
            if(!endtime || currentDate <= endtime) {
                var minimalUser = nlGroupInfo.getMinimalUserObj(user);
                if (minimalUser) {
                    minimalUser.repid = report.id;
                    _reminderDict.users.push(minimalUser);
                }
            }
        }
        
        report.url = nl.fmt2('#/course_view?id={}&mode=report_view', report.id);
        report.urlTitle = nl.t('View report');
        stats.status = nlLrHelper.getStatusInfoFromStr(stainf.status);
        var ret = {raw_record: report, repcontent: repcontent, course: course, user: user,
            usermd: nlLrHelper.getMetadataDict(user), stats: stats,
            created: nl.fmt.fmtDateDelta(report.created, null, 'minute'),
            updated: nl.fmt.fmtDateDelta(report.updated, null, 'minute'),
            not_before: report.not_before ? nl.fmt.fmtDateDelta(report.not_before, null, 'minute') : '',
            not_after: report.not_after ? nl.fmt.fmtDateDelta(report.not_after, null, 'minute') : ''
        };
        return ret;
    }

    function _processModuleReport(report) {
        var repcontent = _updateCommonParams(report, 'module');
        var user = _getStudentFromReport(report, repcontent);
        if (!user) return null;
        _nominatedUsers[user.id] = true;
        report.showModuleProps = true;
        report.studentname = user.name;
        report._user_id = user.user_id;
        report._email = user.email;
        report._stateStr = user.state ? 'active': 'inactive';
        report.org_unit = user.org_unit;
        report.canReview = true;
        var metadata = nlGroupInfo.getUserMetadata(user);
        for(var j=0; j<metadata.length; j++)
            report[metadata[j].id] = metadata[j].value|| '';

        var stats = { nQuiz: 0,
            timeSpentSeconds: 0, nLessonsAttempted: 0, nScore: 0, nMaxScore: 0,
            internalIdentifier:report.id, done: 0, nQuiz: 0, avgAttempts: 0};
    
        if(!report.completed && (nlLrFilter.getType() == 'module_assign')) {
            if(Object.keys(_reminderDict).length == 0) {
                _reminderDict['name'] = repcontent.name;
                _reminderDict['assigned_by'] = repcontent.assigned_by;
                _reminderDict['ctype'] = report.ctype;
                _reminderDict['users'] = [];
            }
            var currentDate = new Date();
            var endtime = repcontent.not_after && !repcontent.submissionAfterEndtime ? nl.fmt.json2Date(repcontent.not_after) : '';
            if(!endtime || currentDate <= endtime) {
                var minimalUser = nlGroupInfo.getMinimalUserObj(user);
                if (minimalUser) {
                    minimalUser.repid = report.id;
                    _reminderDict.users.push(minimalUser);
                }
            }
        }
        
        if(repcontent.started) {
            stats.timeSpentSeconds = repcontent.timeSpentSeconds || 0;
            stats.nLessonsAttempted = 1;
            stats.nQuiz = 1;
            stats.avgAttempts = 1;
            stats.timeSpentStr = Math.ceil(stats.timeSpentSeconds/60) + 'minutes';
        }
        report.started = nl.fmt.json2Date(repcontent.started);
        report.ended = nl.fmt.json2Date(repcontent.ended);

        report.name = repcontent.name || '';
        report._treeId = nl.fmt2('{}.{}', report.org_unit, report.student);
        report._assignTypeStr = _getAssignTypeStr(report.assigntype, repcontent);
        report._courseName = (report.assigntype == _nl.atypes.ATYPE_TRAINING ? repcontent.trainingKindName : repcontent.courseName) || '';
        report._courseId = (report.assigntype == _nl.atypes.ATYPE_TRAINING ? repcontent.trainingKindId : repcontent.courseId ) || '';
        report._attempts = repcontent.started ? 1 : 0;
        report.containerid = report.containerid || '';
        report._grade = repcontent.grade || '';
        report.subject = repcontent.subject || '';
        report.assign_remarks = repcontent.assign_remarks || '';
        var maxScore = repcontent.selfLearningMode ? 0 : parseInt(repcontent.maxScore || 0);
        stats.nQuiz = maxScore ? 1 : 0;

        if (!report.completed) {
            report._percStr = '';
            report._statusStr = report.started ? 'started' : 'pending';
            stats.status = nlLrHelper.statusInfos[_getModuleStatus(stats, repcontent, report)];
        } else {
            var score = repcontent.selfLearningMode ? 0 : parseInt(repcontent.score || 0);
            if (score > maxScore) score = maxScore; // Some 3 year old bug where this happened - just for sake of old record!
            var passScore = maxScore ? parseInt(repcontent.passScore || 0) : 0;
            var perc = maxScore > 0 ? Math.round((score/maxScore)*100) : 100;
            report._score = score > 0 ? score : '';
            report._maxScore = maxScore > 0 ? maxScore : '';
            report._passScore = passScore > 0 ? passScore : '';
            report._passScoreStr = report._passScore ? '' + report._passScore + '%' : '';
            report._perc = perc;
            report._percStr = maxScore > 0 ? '' + perc + '%' : '';
            report._timeMins = repcontent.timeSpentSeconds ? Math.ceil(repcontent.timeSpentSeconds/60) : '';
            report._statusStr = (passScore == 0 || perc >= passScore) ? 'completed' : 'failed';
            stats.nScore = score;
            stats.nMaxScore = maxScore;
            stats.percScore = stats.nMaxScore ? Math.round(stats.nScore/stats.nMaxScore*100) : 0;
            stats.percScoreStr = stats.percScore ? '' + stats.percScore + ' %' :  '0%';
            stats.status = repcontent.selfLearningMode ? nlLrHelper.statusInfos[nlLrHelper.STATUS_DONE] : nlLrHelper.statusInfos[_getModuleStatus(stats, repcontent, report)];
            repcontent.maxScore = maxScore;
            repcontent.score = score;
            report.urlTitle = nl.t('View report');
            report.url = nl.fmt2('/lesson/review_report_assign/{}', report.id);
            if(nlLrFilter.getType() == 'module_assign') {
                report.urlTitle1 = nl.t('Update');
                report.url1 = nl.fmt2('/lesson/update_report_assign/{}', report.id);
            }
        }

        stats.percCompleteStr = stats.status.id == nlLrHelper.STATUS_PENDING ? '0%'
            : stats.status.id == nlLrHelper.STATUS_STARTED ? 'Started' : '100%';
        stats.percCompleteDesc = '';
        var ret = {raw_record: report, repcontent: repcontent, user: user,
            usermd: nlLrHelper.getMetadataDict(user), stats: stats,
            created: nl.fmt.fmtDateDelta(report.created, null, 'minute'), 
            updated: nl.fmt.fmtDateDelta(report.updated, null, 'minute'),
            not_before: report.not_before ? nl.fmt.fmtDateDelta(report.not_before, null, 'minute') : '',
            not_after: report.not_after ? nl.fmt.fmtDateDelta(report.not_after, null, 'minute') : ''
        };
        return ret;
    }

    function _updateCommonParams(report, ctypestr) {
        var repcontent = angular.fromJson(report.content);
        nlLrAssignmentRecords.overrideAssignmentParameterInReport(report, repcontent);
        report.gradeLabel = _userInfo.groupinfo.gradelabel;
        report.subjectLabel = _userInfo.groupinfo.subjectlabel;
        report.updated = nl.fmt.json2Date(report.updated);
        report.created = nl.fmt.json2Date(report.created);
        report._batchName = repcontent.batchname || '';
        report.assign_remarks = (report.ctype == _nl.ctypes.CTYPE_COURSE ? repcontent.remarks : repcontent.assign_remarks) || '';
        report.not_before = repcontent.not_before || '';
        report.not_after = repcontent.not_after || '';
        return repcontent;
    }
    
    function _getAssignTypeStr(assigntype, content) {
        if (assigntype == _nl.atypes.ATYPE_SELF_MODULE) return 'module self assignment';
        if (assigntype == _nl.atypes.ATYPE_SELF_COURSE) return 'course self assignment';
        if (assigntype == _nl.atypes.ATYPE_COURSE) return 'course assignment';
        if (assigntype == _nl.atypes.ATYPE_TRAINING) return 'training';
        return 'module assignment';
    }

    function _getModuleStatus(stats, rep, report) {
        var scorePerc = (rep.score/rep.maxScore)*100;
        if (!rep.started) return nlLrHelper.STATUS_PENDING;
        if (rep.started && !report.completed) return nlLrHelper.STATUS_STARTED;
        if (rep.passScore && scorePerc < rep.passScore) return nlLrHelper.STATUS_FAILED;
        if (report.completed) return nlLrHelper.STATUS_DONE;
        return nlLrHelper.STATUS_PASSED;
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();
    
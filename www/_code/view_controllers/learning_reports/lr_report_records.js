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
var NlLrReportRecords = ['nl', 'nlRouter', 'nlDlg', 'nlGroupInfo', 'nlLrHelper', 'nlLrFilter', 'nlGetManyStore', 'nlReportHelper',
function(nl, nlRouter, nlDlg, nlGroupInfo, nlLrHelper, nlLrFilter, nlGetManyStore, nlReportHelper) {
    var self = this;
    
    var _records = {};
    var _reminderDict = {};
    var _dates = {};
    var _pastUserInfosFetcher = nlGroupInfo.getPastUserInfosFetcher();
    var _postProcessRecords = [];
    var _userInfo = null;
    var _nominatedUsers = null;
    var _attendanceObj = {};
    var _isReattemptEnabled = false;
    var _customScoresHeaderArray = [];
    var _customScoresHeaderObj = {};
    var _canManage = false;
    var _canSend = false;
    var _canAddReportRecord = null;
    this.init = function(userinfo, groupInfo, canAddReportRecord) {
        _userInfo = userinfo;
        _records = {};
        _reminderDict = {};
        _nominatedUsers = {};
        _isReattemptEnabled = false;
        _customScoresHeaderArray = [];
        _customScoresHeaderObj = {};
        _dates = {minUpdated: null, maxUpdated: null};
        _convertAttendanceArrayToObj(userinfo.groupinfo.attendance);
        _canManage = nlRouter.isPermitted(_userInfo, 'assignment_manage');
        _canSend = nlRouter.isPermitted(_userInfo, 'assignment_send');
        _pastUserInfosFetcher.init(groupInfo);
        _canAddReportRecord = canAddReportRecord || function() {return true;};
    };
    
    this.isReattemptEnabled = function() {
        return _isReattemptEnabled;
    };

    this.getCustomScoresHeader = function() {
        return _customScoresHeaderArray;
    };

    this.getCustomScoresHeaderWithType = function() {
        return _customScoresHeaderObj;
    };

    this.getReminderDict = function() {
        return _reminderDict;
    };
    
    this.getNominatedUserDict = function() {
        return _nominatedUsers;
    };
    
    this.addRecord = function(report) {
        if (!_canProcess(report)) return false;
        if (report.ctype == _nl.ctypes.CTYPE_COURSE)
            report = _processCourseReport(report);
        else if (report.ctype == _nl.ctypes.CTYPE_MODULE)
            report = _processModuleReport(report);
        else 
            return null;
        if (!report) return null;
        if (!_canAddReportRecord(report)) return null;
        var rid = report.raw_record.id;
        _records[rid] = report;
        if (!_dates.minUpdated || _dates.minUpdated > report.raw_record.updated) _dates.minUpdated = report.raw_record.updated;
        if (!_dates.maxUpdated || _dates.maxUpdated < report.raw_record.updated) _dates.maxUpdated = report.raw_record.updated;
        return report;
    };
    
    function _canProcess(report) {
        var type = nlLrFilter.getType();
        var detailedReport = nlLrFilter.isDetailedReport();
        if (type != 'module' && !detailedReport) return true;
        var moduleid = nlLrFilter.getModuleId();
        var content = angular.fromJson(report.content);
        if (content.courseReportModuleId == moduleid) return true;
        return false;
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
        var ret = nl.utils.dictToList(_records);
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
            nlDlg.popupStatus('Fetching additional user information ...', false);
            nlDlg.showLoadingScreen();
            _fetchNextPastUsersFileAndPostProcess(resolve);
        });
    };

    function _fetchNextPastUsersFileAndPostProcess(resolve) {
        if (_postProcessRecords.length == 0 || !_pastUserInfosFetcher.canFetchMore()) {
            nlDlg.popdownStatus(0);
            return resolve(true);
        }
        _pastUserInfosFetcher.fetchNextPastUsersFile().then(function(canFetchMore) {
            var postProcessRecords = _postProcessRecords;
            _postProcessRecords = [];
            for (var i=0; i<postProcessRecords.length; i++) self.addRecord(postProcessRecords[i]);
            _fetchNextPastUsersFileAndPostProcess(resolve);
        });
    }
    
    function _getStudentFromReport(report, repcontent) {
        var user = nlGroupInfo.getUserObj(''+report.student);
        if (!user && _pastUserInfosFetcher.canFetchMore()) {
            _postProcessRecords.push(report);
            return null;
        }
        if (!user) user = _pastUserInfosFetcher.getUserObj(report.student, repcontent.studentname);
        if (!user) user = nlGroupInfo.getDefaultUser(repcontent.studentname || '');
        return user;
    }
    
    function _processCourseReport(report) {
        var repcontent = _updateCommonParams(report, 'course');
        var user = _getStudentFromReport(report, repcontent);
        if (!user) return null;
        _nominatedUsers[user.id] = user.user_id;
        var course = nlGetManyStore.getRecord(nlGetManyStore.getContentKeyFromReport(report));
        if (!course) {
            course = {};
        }
        if (course.content && course.content.nht) report.isNHT = true;
        report.canReview = true;
        if(!course.is_published) report.canReview = false;
        var courseAssignment = nlGetManyStore.getAssignmentRecordFromReport(report) || {};
        if (!courseAssignment.info) courseAssignment.info = {};
        var repHelper = nlReportHelper.getCourseStatusHelper(report, _userInfo.groupinfo, courseAssignment, course);
        var stainf = repHelper.getCourseStatus();
        var statusObj = nlReportHelper.getStatusInfoFromCourseStatsObj(stainf);
        var contentmetadata = 'contentmetadata' in course ? course.contentmetadata : {};
        report._grade = contentmetadata.grade || '';
        report.subject = contentmetadata.subject || ''; 
        
        var stats = {nLessonsAttempted: stainf.nPassedQuizes+stainf.nFailedQuizes,
            internalIdentifier:report.id,
            timeSpentSeconds: stainf.onlineTimeSpentSeconds, 
            timeSpentMinutes: Math.ceil(stainf.onlineTimeSpentSeconds/60),
            iltTimeSpent: stainf.iltTimeSpent, 
            iltTotalTime: stainf.iltTotalTime,
            percCompleteStr: '' + stainf.progPerc + ' %',
            percCompleteDesc: stainf.progDesc,
            nScore: stainf.nTotalQuizScore, nMaxScore: stainf.nTotalQuizMaxScore,
            feedbackScore: stainf.feedbackScore,
            progressPerc: stainf.progPerc,
            customScores: stainf.customScores,
            attritedAt: stainf.attritedAt,
            attritionStr: stainf.attritionStr,
            attritionType: stainf.attritionType,
            delayDays: Math.round(stainf.delayDays || 0),
            isCertified: stainf.isCertified,
            customScoreDict: stainf.customScoreDict,
            certid: stainf.certid
        };

        if (stainf.inductionDropOut) stats.inductionDropOut = true;
        if(stainf.customScores.length != 0) {
            for(var i=0; i<stainf.customScores.length; i++) {
                var item = stainf.customScores[i];
                if(!(item.name in _customScoresHeaderObj)) {
                    _customScoresHeaderObj[item.name] = item.type ? item.type : true;
                    _customScoresHeaderArray.push(item.name);
                    stats.customScoreDict[item.name] = item.score;
                }
            }
        }
        if('reattempt' in stainf) {
            _isReattemptEnabled = true;
            stats['reattempt'] = stainf['reattempt'];
        }
        stats.avgAttempts = stats.nLessonsAttempted ? Math.round(stainf.nQuizAttempts/stats.nLessonsAttempted*10)/10 : 0;
        stats.timeSpentStr = nl.fmt2('{} minutes online learning and {} minutes instructor led', 
            Math.ceil(stats.timeSpentSeconds/60), stats.iltTimeSpent);
        
        stats.percScore = stats.nMaxScore ? Math.round(100.0*stats.nScore/stats.nMaxScore) : 0;
        stats.percScoreStr = stats.percScore ? '' + stats.percScore + ' %' :  '';
        repcontent.statusinfo = stainf.itemIdToInfo;
        if(course.name) repcontent.name = course.name;
 
        if(!nlReportHelper.isEndStatusId(statusObj.id) && (nlLrFilter.getType() == 'course_assign')) {
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
        stats.status = nlReportHelper.getStatusInfoFromCourseStatsObj(stainf);

        if ((stainf.status == 'certified' || stainf.isCertified) && stats.certid) {
            var certInfo = stainf.itemIdToInfo[stats.certid];
            stats.certifiedOn = nl.fmt.fmtDateDelta(nl.fmt.json2Date(certInfo.updated), null, 'minute');
            if (certInfo.expire_after) {
                var expireDays = parseInt(certInfo.expire_after);
                var expireOn = new Date(certInfo.updated);
                expireOn.setDate(expireOn.getDate() + expireDays);
                stats.certValid = nl.fmt.fmtDateDelta(expireOn, null, 'minute');
                stats.expireOn = expireOn;
                if(new Date() > expireOn) {
                    stats.status = nlReportHelper.statusInfos[nlReportHelper.STATUS_FAILED];
                    stats.status.txt = 'Certificate expired';
                    stats.certExpired = true;
                }
            }
        }
        report.typeStr = 'Course';
        if (_canManage) {
            report.hideDeleteButton = false;
        } else if (_canSend && _userInfo.userid == repcontent.sender) {
            report.hideDeleteButton = false;
        } else {
            report.hideDeleteButton = true;
        }
        var usermd = nlLrHelper.getMetadataDict(user);
        if (user.mobile) {
            if (user.mobile.indexOf('m:') == 0) user.mobile = user.mobile.substring(2);
        } else if (usermd.meta_mobile) {
            user.mobile = usermd.meta_mobile;
        }
        var ret = {raw_record: report, repcontent: repcontent, course: course, user: user, orgparts: _updateOrgByParts(user),
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
        _nominatedUsers[user.id] = user.user_id;
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
            stats.timeSpentStr = Math.ceil(stats.timeSpentSeconds/60) + ' minutes';
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
            stats.status = nlReportHelper.statusInfos[_getModuleStatus(stats, repcontent, report)];
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
            stats.status = repcontent.selfLearningMode ? nlReportHelper.statusInfos[nlReportHelper.STATUS_DONE] : nlReportHelper.statusInfos[_getModuleStatus(stats, repcontent, report)];
            repcontent.maxScore = maxScore;
            repcontent.score = score;
            report.urlTitle = nl.t('View report');
            report.url = nl.fmt2('/lesson/review_report_assign/{}', report.id);
            if(nlLrFilter.getType() == 'module_assign' && _canManage && nlLrFilter.isDebugMode()) {
                report.urlTitle1 = nl.t('Update');
                report.url1 = nl.fmt2('/lesson/update_report_assign/{}', report.id);
            }
        }

        stats.percCompleteStr = stats.status.id == nlReportHelper.STATUS_PENDING ? '0 %'
            : stats.status.id == nlReportHelper.STATUS_STARTED ? 'Started' : '100 %';
        stats.percCompleteDesc = '';
        report.typeStr = 'Module';
        if (_canManage) {
            report.hideDeleteButton = false;
        } else if (_canSend && _userInfo.userid == report.assignor) {
            report.hideDeleteButton = false;
        } else {
            report.hideDeleteButton = true;
        }
        var usermd = nlLrHelper.getMetadataDict(user);
        if (user.mobile) {
            if (user.mobile.indexOf('m:') == 0) user.mobile = user.mobile.substring(2);
        } else if (usermd.meta_mobile) {
            user.mobile = usermd.meta_mobile;
        }
        var ret = {raw_record: report, repcontent: repcontent, user: user, orgparts: _updateOrgByParts(user),
            usermd: nlLrHelper.getMetadataDict(user), stats: stats,
            user_state: user.state ? 'active' : 'inactive',
            created: nl.fmt.fmtDateDelta(report.created, null, 'minute'), 
            updated: nl.fmt.fmtDateDelta(report.updated, null, 'minute'),
            not_before: report.not_before ? nl.fmt.fmtDateDelta(report.not_before, null, 'minute') : '',
            not_after: report.not_after ? nl.fmt.fmtDateDelta(report.not_after, null, 'minute') : ''
        };
        return ret;
    }

    function _updateOrgByParts(user) {
        var parts = (user.org_unit || '').split('.');
        var ret = {part1: '', part2: '', part3: '', part4: ''};
        for(var i=0; i<parts.length && i < 4; i++) 
            ret['part'+(i+1)] = parts[i];
        return ret;
    }

    function _updateCommonParams(report, ctypestr) {
        var repcontent = report._transformVersion ? report.repcontent : angular.fromJson(report.content);
        nlGetManyStore.overrideAssignmentParametersInRepContent(report, repcontent);
        report.gradeLabel = _userInfo.groupinfo.gradelabel;
        report.subjectLabel = _userInfo.groupinfo.subjectlabel;
        report.updated = nl.fmt.json2Date(report.updated);
        report.created = nl.fmt.json2Date(report.created);
        report._batchName = repcontent.batchname || '';
        if (repcontent.batchtype) report._batchtype = repcontent.batchtype;
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
        if (!rep.started) return nlReportHelper.STATUS_PENDING;
        if (rep.started && !report.completed) return nlReportHelper.STATUS_STARTED;
        if (rep.passScore && scorePerc < rep.passScore) return nlReportHelper.STATUS_FAILED;
        if (report.completed) return nlReportHelper.STATUS_DONE;
        return nlReportHelper.STATUS_PASSED;
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();
    

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
    var _customScoresHeaderArray = [];
    var _customScoresHeaderObj = {};
    var _canManage = false;
    var _canSend = false;
    var _canAddReportRecord = null;
    var _batchStatus = {};
    var _qsMaxLen = 0;
    this.init = function(userinfo, groupInfo, canAddReportRecord) {
        _userInfo = userinfo;
        _records = {};
        _reminderDict = {};
        _nominatedUsers = {};
        _customScoresHeaderArray = [];
        _customScoresHeaderObj = {};
        _dates = {minUpdated: null, maxUpdated: null};
        _convertAttendanceArrayToObj(userinfo.groupinfo.attendance);
        _canManage = nlRouter.isPermitted(_userInfo, 'assignment_manage');
        _canSend = nlRouter.isPermitted(_userInfo, 'assignment_send');
        _pastUserInfosFetcher.init(groupInfo);
        _canAddReportRecord = canAddReportRecord || function() {return true;};
        _batchStatus = {};
        _qsMaxLen = 0;
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
    
    this.getQsMaxLength = function() {
        return _qsMaxLen;
    };

    this.addRecord = function(report) {
        if (!_canProcess(report)) return null;
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
        if (!(type == 'module' && detailedReport)) return true;
        var moduleid = nlLrFilter.getModuleId();
        if (!moduleid) return true;
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

    this.getNhtBatchStatus = function() {
        return _batchStatus;
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
        var user = nlGroupInfo.getCachedUserObjWithMeta(report.student,repcontent.studentname,
             _pastUserInfosFetcher);
        if (!user) {
            _postProcessRecords.push(report);
            return null;
        }
        if (!user.mobile && user.metadataObj.meta_mobile)
            user.mobile = user.metadataObj.meta_mobile;
        if (user.mobile && user.mobile.indexOf('m:') == 0) user.mobile = user.mobile.substring(2);
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
        report.canReview = true;
        if(!course.is_published) report.canReview = false;
        var courseAssignment = nlGetManyStore.getAssignmentRecordFromReport(report) || {};
        repcontent.ldapid = courseAssignment.meta_ldap || '';
        if (!courseAssignment.info) courseAssignment.info = {};
        if (course.content && course.content.nht) {
            report.isNHT = true;
            var modules = course && course.content ? course.content.modules : repcontent.content.modules;
            nlGetManyStore.updateMilestoneBatchInfo(courseAssignment, modules);
        }

        var repHelper = nlReportHelper.getCourseStatusHelper(report, _userInfo.groupinfo, courseAssignment, course);
        var stainf = repHelper.getCourseStatus();
        var statusObj = nlReportHelper.getStatusInfoFromCourseStatsObj(stainf);
        var contentmetadata = 'contentmetadata' in course ? course.contentmetadata : {};
        report._grade = contentmetadata.grade || '';
        report.subject = contentmetadata.subject || ''; 
        
        var stats = {nLessonsAttempted: stainf.nPassedQuizes+stainf.nFailedQuizes,
            timeSpentSeconds: stainf.onlineTimeSpentSeconds, 
            timeSpentMinutes: Math.ceil(stainf.onlineTimeSpentSeconds/60),
            iltTimeSpent: stainf.iltTimeSpent, 
            iltTotalTime: stainf.iltTotalTime,
            nScore: stainf.nTotalQuizScore, nMaxScore: stainf.nTotalQuizMaxScore,
            feedbackScore: stainf.feedbackScore,
            customScores: stainf.customScores,
            attritedAt: stainf.attritedAt,
            attritionStr: stainf.attritionStr,
            delayDays: Math.round(stainf.delayDays || 0),
            isCertified: stainf.isCertified,
            customScoreDict: stainf.customScoreDict,
            certid: stainf.certid
        };
        var ncompleted = stainf.nCompletedItems;
        var nActual = stainf.cnttotal - (stainf.nlockedcnt + stainf.nhiddencnt);
        stats.progress = Math.round(100*ncompleted/nActual);
        stats.progressDesc = nl.t('{} of {} completed', ncompleted, nActual);
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
            stats['reattempt'] = stainf['reattempt'];
        }
        stats.totalQuizAttempts = stainf.nQuizAttempts;
        stats.timeSpentStr = nl.fmt2('{} minutes online learning and {} minutes instructor led', 
            Math.ceil(stats.timeSpentSeconds/60), stats.iltTimeSpent);
        
        stats.percScore = stats.nMaxScore ? Math.round(100.0*stats.nScore/stats.nMaxScore) : 0;
        stats.percScoreStr = stats.percScore ? '' + stats.percScore + ' %' :  '';
        repcontent.statusinfo = stainf.itemIdToInfo;
        if(course.name) repcontent.name = course.name;
 
        if(!nlReportHelper.isEndStatusId(statusObj.id) && (nlLrFilter.getType() == 'course_assign')) {
            _updateReminderDict(report, repcontent, user);
        }
        
        report.url = nl.fmt2('#/course_view?id={}&mode=report_view', report.id);
        report.urlTitle = nl.t('View report');
        stats._origstatus = stainf.status;
        if (report.isNHT && user.state == 0 && stainf.status.indexOf('attrition') != 0) {
            if (!nlReportHelper.isCourseCompleted(stainf)) stainf.status = nl.t('attrition-{}', stainf.status);   
        }
        stats.status = nlReportHelper.getStatusInfoFromCourseStatsObj(stainf);
        if (report.isNHT) {
            if(!(report.assignment in _batchStatus)) _batchStatus[report.assignment] = {};
            var statusTxt = stats.status.txt;
            if (user.state != 0) {
                if (stats.isCertified || stats.status.txt == 'failed') 
                    _batchStatus[report.assignment]['Closed'] = true;
                else if (statusTxt.indexOf('attrition') != 0)
                    _batchStatus[report.assignment][stats.status.txt] = true;
            }
        }

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
        _updateHideDeleteButton(report);
        var modules = course && course.content ? course.content.modules : repcontent.content.modules;
        var groupInfo = nlGroupInfo.get();
        if (groupInfo.props.etmAsd && groupInfo.props.etmAsd.length > 0) _updateMsDates(repcontent, modules, courseAssignment.info);
        if (_qsMaxLen < stainf.quizScoreLen) _qsMaxLen = stainf.quizScoreLen;
        var ret = {raw_record: report, repcontent: repcontent, course: course,
            user: user, usermd: user.metadataObj, stats: stats, quizscore: stainf.quizScore,
            created: nl.fmt.fmtDateDelta(report.created, null, 'minute'),
            updated: nl.fmt.fmtDateDelta(report.updated, null, 'minute'),
            custom: {}
        };
        return ret;
    }

    function _updateMsDates(repcontent, modules, assignInfo) {
        var statusinfo = repcontent.statusinfo;
        var plannedMsInfo = assignInfo ? assignInfo.msDates : null;
        if (!plannedMsInfo) return;
        for (var i=0; i<modules.length; i++) {
            var cm = modules[i];
            if (cm.type != 'milestone') continue;
            var mstype = cm.milestone_type;
            var actualMs = statusinfo[cm.id];
            var plannedMs = plannedMsInfo['milestone_'+cm.id] || '';
            repcontent[mstype+'_planned'] = nl.fmt.date2StrDDMMYY(nl.fmt.json2Date(plannedMs || '', 'date'));
            repcontent[mstype+'_actual'] = nl.fmt.date2StrDDMMYY(actualMs.reached || '');
        }
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
            done: 0, nQuiz: 0, totalQuizAttempts: 0};
    
        if(!report.completed && (nlLrFilter.getType() == 'module_assign')) {
            _updateReminderDict(report, repcontent, user);
        }
        
        if(repcontent.started) {
            stats.timeSpentSeconds = repcontent.timeSpentSeconds || 0;
            stats.nLessonsAttempted = 1;
            stats.nQuiz = 1;
            stats.totalQuizAttempts = 1;
            stats.timeSpentStr = Math.ceil(stats.timeSpentSeconds/60) + ' minutes';
        }
        report.started = nl.fmt.json2Date(repcontent.started);
        report.ended = nl.fmt.json2Date(repcontent.ended);

        report.name = repcontent.name || '';
        report._treeId = nl.fmt2('{}.{}', report.org_unit, report.student);
        report._assignTypeStr = _getAssignTypeStr(report.assigntype, repcontent);
        report._courseName = (report.assigntype == _nl.atypes.ATYPE_TRAINING ? repcontent.trainingKindName : repcontent.courseName) || '';
        report._courseId = (report.assigntype == _nl.atypes.ATYPE_TRAINING ? repcontent.trainingKindId : repcontent.courseId ) || '';
        report._attempts = repcontent.attempt|| '' ;
        report.containerid = report.containerid || '';
        report._grade = repcontent.grade || '';
        report.subject = repcontent.subject || '';
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

        report.typeStr = 'Module';
        _updateHideDeleteButton(report);
        report.versionId = repcontent.versionId || '';
        var ret = {raw_record: report, repcontent: repcontent,
            user: user, usermd: user.metadataObj, stats: stats,
            created: nl.fmt.fmtDateDelta(report.created, null, 'minute'), 
            updated: nl.fmt.fmtDateDelta(report.updated, null, 'minute'),
            custom: {}
        };
        return ret;
    }

    function _updateReminderDict(report, repcontent, user) {
        if(Object.keys(_reminderDict).length == 0) {
            _reminderDict['name'] = repcontent.name;
            _reminderDict['assigned_by'] = repcontent.assigned_by;
            _reminderDict['ctype'] = report.ctype;
            _reminderDict['users'] = [];
        }
        var currentDate = new Date();
        var endtime = repcontent.not_after && !repcontent.submissionAfterEndtime ? repcontent.not_after : '';
        if(!endtime || currentDate <= endtime) {
            _reminderDict.users.push({repid: report.id, user: user});
        }
    }

    function _updateHideDeleteButton(report) {
        if (_canManage) {
            report.hideDeleteButton = false;
        } else if (_canSend && _userInfo.userid == report.assignor) {
            report.hideDeleteButton = false;
        } else {
            report.hideDeleteButton = true;
        }
    }

    function _updateCommonParams(report, ctypestr) {
        var repcontent = angular.fromJson(report.content);
        var assignorInfo = nlGroupInfo.getUserObj(report.assignor) || {};
        nlGetManyStore.overrideAssignmentParametersInRepContent(report, repcontent);
        report.updated = nl.fmt.json2Date(report.updated);
        report.created = nl.fmt.json2Date(report.created);
        report._batchName = repcontent.batchname || '';
        repcontent.assign_remarks = repcontent.assign_remarks || repcontent.remarks || '';
        repcontent.assigned_by = repcontent.assigned_by || repcontent.sendername || '';
        repcontent.not_before_str = repcontent.not_before ? nl.fmt.fmtDateDelta(repcontent.not_before, null, 'minute') : '';
        repcontent.not_after_str = repcontent.not_after ? nl.fmt.fmtDateDelta(repcontent.not_after, null, 'minute') : '';
        repcontent.iltTrainerName = repcontent.iltTrainerName || repcontent.assigned_by;
        repcontent.senderName = assignorInfo.name || '';
        repcontent.senderID = assignorInfo.user_id || '';
        if (!repcontent.batchtype) repcontent.batchtype = '';
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
    
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
    var NlLrReportRecords = ['nl', 'nlDlg', 'nlGroupInfo', 'nlLrHelper', 'nlLrCourseRecords', 'nlLrFilter', 'nlLrAssignmentRecords',
    function(nl, nlDlg, nlGroupInfo, nlLrHelper, nlLrCourseRecords, nlLrFilter, nlLrAssignmentRecords) {
        var self = this;
        
        var _records = {};
        var _reminderDict = {};
        var _dates = {};
        var _pastUserData = null;
        var _pastUserDataFetchInitiated = false;
        var _postProcessRecords = [];
        var _userInfo = null;
        var _nominatedUsers = null;
        this.init = function(userinfo) {
            _userInfo = userinfo;
            _records = {};
            _reminderDict = {};
            _nominatedUsers = {};
            _dates = {minUpdated: null, maxUpdated: null};
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
            var courseAssignment = nlLrAssignmentRecords.getRecord('course_assignment:'+report.assignment);        
            if (!course) course = nlLrCourseRecords.getCourseInfoFromReport(report, repcontent);
            var contentmetadata = 'contentmetadata' in course ? course.contentmetadata : {};
            report._grade = contentmetadata.grade || '';
            report.subject = contentmetadata.subject || ''; 
            
            var stats = {nLessons: 0, nLessonsPassed: 0, nLessonsFailed: 0, nQuiz: 0,
                timeSpentSeconds: 0, nAttempts: 0, nLessonsAttempted: 0, nScore: 0, nMaxScore: 0,
                internalIdentifier:report.id, nCerts: course.certificates.length, iltTimeSpent: 0, iltTotalTime: 0};
                
            var started = false;
            if(course.content.blended) {
                var attendance = courseAssignment.attendance ? angular.fromJson(courseAssignment.attendance) : {};
                var notAttended = attendance.not_attended || {};
                for(var i=0; i<course.content.modules.length; i++) {
                    var elem = course.content.modules[i];
                    if(courseAssignment.info.modifiedILT && courseAssignment.info.modifiedILT[elem.id]) elem.iltduration = courseAssignment.info.modifiedILT[elem.id];
                    if(elem.type != 'iltsession') continue;
                    stats.iltTotalTime += elem.iltduration;
                    var userAttendance = attendance[report.id] || [];
                    var userNotAttended = notAttended[report.id] || [];
                    var userAttendanceFound = false;
                    for(var j=0; j<userAttendance.length; j++) {
                        if(userAttendance[j] == elem.id) {
                            userAttendanceFound = true;
                            if(!repcontent.statusinfo) repcontent.statusinfo = {};
                            if(!repcontent.statusinfo[elem.id]) repcontent.statusinfo[elem.id] = {};
                            repcontent.statusinfo[elem.id].status = 'done';
                            repcontent.statusinfo[elem.id].state = 'attended';
                            repcontent.statusinfo[elem.id].iltTotalTime = elem.iltduration;
                            stats.iltTimeSpent += elem.iltduration*60;
                        }
                    }
                    if(!userAttendanceFound) {
                        for(var j=0; j<userNotAttended.length; j++) {
                            if(userNotAttended[j] == elem.id) {
                                userAttendanceFound = true;
                                if(!repcontent.statusinfo) repcontent.statusinfo = {};
                                if(!repcontent.statusinfo[elem.id]) repcontent.statusinfo[elem.id] = {};
                                repcontent.statusinfo[elem.id].status = 'done';
                                repcontent.statusinfo[elem.id].state = 'not_attended';
                                repcontent.statusinfo[elem.id].iltTotalTime = elem.iltduration;
                            }
                        }    
                    }
                    if(!userAttendanceFound) {
                        if(!repcontent.statusinfo) repcontent.statusinfo = {};
                        if(!repcontent.statusinfo[elem.id]) repcontent.statusinfo[elem.id] = {};
                        repcontent.statusinfo[elem.id].state = 'pending';
                        repcontent.statusinfo[elem.id].iltTotalTime = elem.iltduration;
                    }
                }
            }

            var milestone = courseAssignment.milestone ? angular.fromJson(courseAssignment.milestone) : {};
            if(Object.keys(milestone).length > 0) {
                for(var key in milestone) {
                    if (!(milestone[key] && milestone[key].status == 'done')) continue;
                    if(!repcontent.statusinfo) repcontent.statusinfo = {};
                    if(!repcontent.statusinfo[key]) repcontent.statusinfo[key] = {};
                    repcontent.statusinfo[key].status = 'done';      
                }    
            }

            var statusinfo = repcontent.statusinfo || {};
            var items = course.nonLessons;
            stats.nOthers = items.length;
            stats.nOthersDone = 0;
            for (var i=0; i<items.length; i++) {
                var cid = items[i];
                var sinfo = statusinfo[cid];
                if (sinfo && sinfo.status == 'done') {
                    stats.nOthersDone++;
                    started = true;
                }
            }
    
            var lessons = course.lessons;
            if (!repcontent.lessonReports) repcontent.lessonReports = {};
            repcontent.latestLessonReports = angular.copy(repcontent.lessonReports);
            var lessonReps = repcontent.lessonReports;
            for (var i=0; i<lessons.length; i++) {
                stats.nLessons++;
                var lid = lessons[i].id;
                var rep = lessonReps[lid];
                if (!rep) continue;
                var pastLessonReport = (repcontent['pastLessonReports']) ? angular.copy(repcontent['pastLessonReports'][lid]) : null;
                if(pastLessonReport) {
                    rep = _getMaxScoredReport(rep, pastLessonReport);
                    lessonReps[lid] = rep; 
                }
                started = true;
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
            var RELATIVE_LESSON_WEIGHT=1;
            var weightedProgressMax = stats.nLessons*RELATIVE_LESSON_WEIGHT + stats.nOthers;
            var weightedProgress = stats.nLessonsDone*RELATIVE_LESSON_WEIGHT + stats.nOthersDone;
            var totalItems = stats.nLessons + stats.nOthers;
            var completedItems = stats.nLessonsDone + stats.nOthersDone;
            if((totalItems != completedItems) && (nlLrFilter.getType() == 'course_assign')) {
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
    
            stats.timeSpentStr = Math.ceil((stats.timeSpentSeconds+stats.iltTimeSpent)/60);
            stats.timeSpentStr = stats.timeSpentStr > 1 ? stats.timeSpentStr + ' minutes' 
                : stats.timeSpentStr == 1 ? stats.timeSpentStr + ' minute' : '';
    
            report.url = nl.fmt2('#/course_view?id={}&mode=report_view', report.id);
            report.urlTitle = nl.t('View report');
            stats.status = nlLrHelper.statusInfos[_getStatusId(stats, started)];
            var ret = {raw_record: report, repcontent: repcontent, course: course, user: user,
                usermd: nlLrHelper.getMetadataDict(user), stats: stats,
                created: nl.fmt.fmtDateDelta(report.created, null, 'minute'),
                updated: nl.fmt.fmtDateDelta(report.updated, null, 'minute'),
                not_before: report.not_before ? nl.fmt.fmtDateDelta(report.not_before, null, 'minute') : '',
                not_after: report.not_after ? nl.fmt.fmtDateDelta(report.not_after, null, 'minute') : ''
                };
            return ret;
        }
    
        function _getMaxScoredReport(rep, pastLessonReport) {
            var maxScoredReport = rep;
            var totalTimeSpent = 'timeSpentSeconds' in  rep ? rep['timeSpentSeconds'] : 0;
            for(var i=0; i<pastLessonReport.length; i++) {
                var pastRep = pastLessonReport[i];
                totalTimeSpent += pastRep['timeSpentSeconds'];
                if(pastRep.score < maxScoredReport.score) continue;
                maxScoredReport = pastRep;
            }
            maxScoredReport['timeSpentSeconds'] = totalTimeSpent;
            maxScoredReport['attempt'] = rep['attempt'];
            return maxScoredReport;
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
            var metadata = nlGroupInfo.getUserMetadata(user);
            for(var j=0; j<metadata.length; j++)
                report[metadata[j].id] = metadata[j].value|| '';
    
            var module = {type: 'module', id: report.id, nonLessons: [], lessons:[repcontent], name: repcontent.name, contentmetadata: repcontent.contentmetadata || {}};
    
            var stats = {nLessons: 0, nLessonsPassed: 0, nLessonsFailed: 0, nQuiz: 0,
                timeSpentSeconds: 0, nAttempts: 0, nLessonsAttempted: 0, nScore: 0, nMaxScore: 0,
                internalIdentifier:report.id, nCerts: 0, nLessonsDone: 0, done: 0};
    
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
            
                
            var lessons = module.lessons;
            var lessonReps = repcontent || {};
            stats.nLessons++;
            var lid = lessons[0].id;
            var rep = lessonReps;
            stats.percCompleteStr = 'Pending';
            if(repcontent.started) {
                stats.timeSpentSeconds = repcontent.timeSpentSeconds || 0;
                stats.percCompleteStr = 'Started';
                stats.percCompleteDesc = repcontent.started ? 'Module started' :  'Module pending';
                stats.nAttempts = 1;
                stats.nLessonsAttempted = 1;
                stats.nQuiz = 1;
                stats.avgAttempts = 1;
                stats.timeSpentStr = Math.ceil(stats.timeSpentSeconds/60);
                stats.timeSpentStr = stats.timeSpentStr > 1 ? stats.timeSpentStr + ' minutes' 
                    : stats.timeSpentStr == 1 ? stats.timeSpentStr + ' minute' : '';
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
                if (passScore == 0 || perc >= passScore) 
                    stats.nLessonsPassed++;
                else 
                    stats.nLessonsFailed++;
                stats.status = repcontent.selfLearningMode ? nlLrHelper.statusInfos[nlLrHelper.STATUS_DONE] : nlLrHelper.statusInfos[_getModuleStatus(stats, repcontent, report)];
                stats.percCompleteStr = 'Completed';
                stats.percCompleteDesc = 'Module completed';
                repcontent.maxScore = maxScore;
                repcontent.score = score;
                report.urlTitle = nl.t('View report');
                report.url = nl.fmt2('/lesson/review_report_assign/{}', report.id);
                if(nlLrFilter.getType() == 'module_assign') {
                    report.urlTitle1 = nl.t('Update');
                    report.url1 = nl.fmt2('/lesson/update_report_assign/{}', report.id);
                }
            }
    
            stats.nLessonsDone = stats.nLessonsPassed + stats.nLessonsFailed;
            var ret = {raw_record: report, repcontent: repcontent, course: module, user: user,
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
    
        function _getStatusId(stats, started) {
            if (stats.percComplete == 0 && !started) return nlLrHelper.STATUS_PENDING;
            if (stats.percComplete < 100) return nlLrHelper.STATUS_STARTED;
            if (stats.nLessonsFailed > 0) return nlLrHelper.STATUS_FAILED;
            if (stats.nCerts > 0) return nlLrHelper.STATUS_CERTIFIED;
            if (stats.nMaxScore == 0) return nlLrHelper.STATUS_DONE;
            return nlLrHelper.STATUS_PASSED;
        }
    }];
    
    //-------------------------------------------------------------------------------------------------
    module_init();
    })();
    
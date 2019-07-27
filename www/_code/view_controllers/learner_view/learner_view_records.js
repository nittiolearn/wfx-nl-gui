(function() {

    //-------------------------------------------------------------------------------------------------
    // learner_view_records.js: Process and store a list of learner assignment records
    //-------------------------------------------------------------------------------------------------
    function module_init() {
        angular.module('nl.learner_view_records', [])
        .config(configFn)
        .service('nlLearnerViewRecords', NlLearnerViewRecords);
    }
    
    var configFn = ['$stateProvider', '$urlRouterProvider',
    function($stateProvider, $urlRouterProvider) {
    }];
    
    //-------------------------------------------------------------------------------------------------
    var NlLearnerViewRecords = ['nl', 'nlLearverViewHelper', 'nlLearnerAssignment', 'nlLearnerCourseRecords',
    function(nl, nlLearverViewHelper, nlLearnerAssignment, nlLearnerCourseRecords) {
        var self = this;
        
        var _records = {};
        var _dates = {};
        var _userInfo = null;
        this.init = function(userinfo) {
            _userInfo = userinfo;
            _records = {};
            _dates = {minUpdated: null, maxUpdated: null};
        };
        
        this.addRecord = function(raw_record) {
            var report = null;
            if (raw_record.ctype == _nl.ctypes.CTYPE_COURSE)
                report = _processCourseReport(raw_record);
            else if (raw_record.ctype == _nl.ctypes.CTYPE_MODULE)
                report = _processModuleReport(raw_record);
            else 
                return null;
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
        };
        
        this.getRecords = function() {
            return _records;
        };
    
        this.getAnyRecord = function() {
            for (var recid in _records) return _records[recid];
            return null;
        };

        this.asList = function() {
            var ret = nlLearverViewHelper.dictToList(_records);
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
            // Kept to satisfy signature of fetcher
        };

        
        function _processCourseReport(raw_record) {
            var repcontent = _updateCommonParams(raw_record, 'course');
            if(!repcontent.content) return null;
            var user = _userInfo;
            var stats = {nLessons: 0, nLessonsPassed: 0, nLessonsFailed: 0, nQuiz: 0,
                timeSpentSeconds: 0, nAttempts: 0, nLessonsAttempted: 0, nScore: 0, nMaxScore: 0,
                internalIdentifier:raw_record.id, nCerts: 0, iltTimeSpent: 0, iltTotalTime: 0, isAttemptsAvailable: 0};
                
            var started = false;
            var isTrainerControlled = false;
            var latestMilestone = null;
            repcontent['id'] = raw_record.id;

            var statusinfo = repcontent.statusinfo || {};
            if (!repcontent.lessonReports) repcontent.lessonReports = {};
            var lessonReps = repcontent.lessonReports;
            repcontent.latestLessonReports = angular.copy(repcontent.lessonReports);

            stats.nOthers = 0;
            stats.nOthersDone = 0;
            var course = nlLearnerCourseRecords.getRecord(raw_record.lesson_id);
            raw_record.canReview = true;
            if(!course || !course.is_published) raw_record.canReview = false;
            var courseAssignment = nlLearnerAssignment.getRecord('course_assignment:'+raw_record.assignment) || {};
            if (!courseAssignment.info) courseAssignment.info = {};
            if (!course) course = nlLearnerCourseRecords.getCourseInfoFromReport(raw_record, repcontent);
            var contentmetadata = 'contentmetadata' in course ? course.contentmetadata : {};
            raw_record._grade = contentmetadata.grade || '';
            raw_record.subject = contentmetadata.subject || ''; 
            if(courseAssignment) {
                raw_record.not_after = courseAssignment.info['not_after'];
                raw_record.not_before = courseAssignment.info['not_before'];
                raw_record.submissionAfterEndtime = courseAssignment.info['submissionAfterEndtime'] || false;
                raw_record.assign_remarks = courseAssignment.info['remarks'];
                raw_record.assigned_to = courseAssignment.info['assigned_to'];
                raw_record.authorname = courseAssignment.info['courseauthor'];
            }
            var milestone = courseAssignment.milestone ? angular.fromJson(courseAssignment.milestone) : {};
            repcontent.content.modules = course.content.modules || [];
            for(var i=0; i<course.content.modules.length; i++) {
                var elem = course.content.modules[i];
                if(elem.type != 'milestone') continue;
                isTrainerControlled = true;
                if(elem.id in milestone) {
                    started = true;
                    latestMilestone = milestone[elem.id];
                    latestMilestone['perc'] = elem.completionPerc;
                    latestMilestone['name'] = elem.name;
                }
            }

            for (var i=0; i<repcontent.content.modules.length; i++) {
                var type = repcontent.content.modules[i].type;
                if(type == 'certificate' || type == 'module') continue;
                if(type == 'link' || type == 'info') {
                    stats.nOthers++;
                    var cid = repcontent.content.modules[i].id;
                    var sinfo = statusinfo[cid];
                    if (sinfo && sinfo.status == 'done') {
                        stats.nOthersDone++;
                        started = true;
                    }
                } else if(type == 'lesson'){
                    stats.nLessons++;
                    var lid = repcontent.content.modules[i].id;
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
            }

            stats.nLessonsDone = stats.nLessonsPassed + stats.nLessonsFailed;
            var RELATIVE_LESSON_WEIGHT=1;
            var weightedProgressMax = stats.nLessons*RELATIVE_LESSON_WEIGHT + stats.nOthers;
            var weightedProgress = stats.nLessonsDone*RELATIVE_LESSON_WEIGHT + stats.nOthersDone;

            if(isTrainerControlled) {
                if(latestMilestone) {
                    stats.percComplete = latestMilestone['perc'];
                    stats.percCompleteStr = '' + stats.percComplete + ' %';
                    stats.percCompleteDesc = nl.fmt2('{}', latestMilestone['name']);
                } else {
                    stats.percComplete = '';
                    stats.percCompleteStr = '';
                    stats.percCompleteDesc = nl.fmt2('Milestone is not marked');
                }
            } else {
                stats.percComplete = weightedProgressMax ? Math.round(weightedProgress/weightedProgressMax*100) : 100;
                stats.percCompleteStr = '' + stats.percComplete + ' %';
                
                var plural = stats.nLessons > 1 ? 'modules' : 'module';
                var modulesCompleted = stats.nLessons ? nl.fmt2('{} of {} {}', stats.nLessonsDone, stats.nLessons, plural) : '';
                plural = stats.nOthers > 1 ? 'other items' : 'other item';
                var othersCompleted = stats.nOthers ? nl.fmt2('{} of {} {}', stats.nOthersDone, stats.nOthers, plural) : '';
                var delim = modulesCompleted && othersCompleted ? ' and ' : '';
                stats.percCompleteDesc = nl.fmt2('{}{}{} completed', modulesCompleted, delim, othersCompleted);    
            }
            
            stats.avgAttempts = stats.nLessonsAttempted ? Math.round(stats.nAttempts/stats.nLessonsAttempted*10)/10 : '';
            stats.percScore = stats.nMaxScore ? Math.round(stats.nScore/stats.nMaxScore*100) : 0;
            stats.percScoreStr = stats.percScore ? '' + stats.percScore + ' %' :  '';
    
            stats.timeSpentStr = Math.ceil((stats.timeSpentSeconds+stats.iltTimeSpent)/60);
            stats.timeSpentStr = stats.timeSpentStr > 1 ? stats.timeSpentStr + ' minutes' 
                : stats.timeSpentStr == 1 ? stats.timeSpentStr + ' minute' : '';
            if(raw_record.completed) {
                raw_record.url = nl.fmt2('#/course_view?id={}&mode=report_view_my', raw_record.id);
            } else {
                raw_record.url = nl.fmt2('#/course_view?id={}&mode=do', raw_record.id);
            }
            var moduleLen = repcontent.content.modules.length;
            var lastItem = repcontent.content.modules[moduleLen - 1];
            if(lastItem && lastItem.type == 'certificate' && _isConditionMet(lastItem, repcontent)) {
                stats.status = nlLearverViewHelper.statusInfos[nlLearverViewHelper.STATUS_CERTIFIED];
            } else {
                stats.status = nlLearverViewHelper.statusInfos[_getStatusId(stats, started)];                
            }

            _updateDateFormats(raw_record);
            var ret = {raw_record: raw_record, repcontent: repcontent, user: user, stats: stats,
                recStateObj: _getRecordState(repcontent, raw_record, stats, 'course'),
                detailsavps : _getRecordAvps(repcontent, raw_record, 'course'), type: 'course'
                };
            return ret;
        }

        function _processModuleReport(raw_record) {
            var repcontent = _updateCommonParams(raw_record, 'module');
            repcontent.icon = nl.url.lessonIconUrl(repcontent.image);
            repcontent.id = raw_record.id;
            var user = _userInfo;
    
            var stats = {nLessons: 0, nLessonsPassed: 0, nLessonsFailed: 0, nQuiz: 0,
                timeSpentSeconds: 0, nAttempts: 0, nLessonsAttempted: 0, nScore: 0, nMaxScore: 0,
                internalIdentifier:raw_record.id, nCerts: 0, nLessonsDone: 0, done: 0};            

            var moduleAssignment = nlLearnerAssignment.getRecord('assignment:'+raw_record.assignment) || null;
            if(moduleAssignment) {
                raw_record.not_after = moduleAssignment['not_after'];
                raw_record.not_before = moduleAssignment['not_before'];
                raw_record.assign_remarks = moduleAssignment['assign_remarks'];
                raw_record.submissionAfterEndtime = moduleAssignment['submissionAfterEndtime'] || false;
                raw_record.assigned_to = moduleAssignment['assigned_to'];
                raw_record.authorname = moduleAssignment['authorname'];
            }
            stats.nLessons++;
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
            raw_record.started = nl.fmt.json2Date(repcontent.started);
            raw_record.ended = nl.fmt.json2Date(repcontent.ended);
    
            raw_record.name = repcontent.name || '';
            raw_record._treeId = nl.fmt2('{}.{}', raw_record.org_unit, raw_record.student);
            raw_record._courseName = (raw_record.assigntype == _nl.atypes.ATYPE_TRAINING ? repcontent.trainingKindName : repcontent.courseName) || '';
            raw_record._courseId = (raw_record.assigntype == _nl.atypes.ATYPE_TRAINING ? repcontent.trainingKindId : repcontent.courseId ) || '';
            raw_record._attempts = repcontent.started ? 1 : 0;
            raw_record.containerid = raw_record.containerid || '';
            raw_record._grade = repcontent.grade || '';
            raw_record.subject = repcontent.subject || '';
            raw_record.assign_remarks = repcontent.assign_remarks || '';
            var maxScore = repcontent.selfLearningMode ? 0 : parseInt(repcontent.maxScore || 0);
            stats.nQuiz = maxScore ? 1 : 0;

            if (!raw_record.completed) {
                raw_record._percStr = '';
                raw_record._statusStr = raw_record.started ? 'started' : 'pending';
                stats.status = nlLearverViewHelper.statusInfos[_getModuleStatus(stats, repcontent, raw_record)];
            } else {
                var score = repcontent.selfLearningMode ? 0 : parseInt(repcontent.score || 0);
                if (score > maxScore) score = maxScore; // Some 3 year old bug where this happened - just for sake of old record!
                var passScore = maxScore ? parseInt(repcontent.passScore || 0) : 0;
                var perc = maxScore > 0 ? Math.round((score/maxScore)*100) : 100;
                raw_record._score = score > 0 ? score : '';
                raw_record._maxScore = maxScore > 0 ? maxScore : '';
                raw_record._passScore = passScore > 0 ? passScore : '';
                raw_record._passScoreStr = raw_record._passScore ? '' + raw_record._passScore + '%' : '';
                raw_record._perc = perc;
                raw_record._percStr = maxScore > 0 ? '' + perc + '%' : '';
                raw_record._timeMins = repcontent.timeSpentSeconds ? Math.ceil(repcontent.timeSpentSeconds/60) : '';
                raw_record._statusStr = (passScore == 0 || perc >= passScore) ? 'completed' : 'failed';
                stats.nScore = score;
                stats.nMaxScore = maxScore;
                stats.percScore = stats.nMaxScore ? Math.round(stats.nScore/stats.nMaxScore*100) : 0;
                stats.percScoreStr = stats.percScore ? '' + stats.percScore + ' %' :  '0%';
                if (passScore == 0 || perc >= passScore) 
                    stats.nLessonsPassed++;
                else 
                    stats.nLessonsFailed++;
                stats.status = repcontent.selfLearningMode ? nlLearverViewHelper.statusInfos[nlLearverViewHelper.STATUS_DONE] : nlLearverViewHelper.statusInfos[_getModuleStatus(stats, repcontent, raw_record)];
                stats.percCompleteStr = 'Completed';
                stats.percCompleteDesc = 'Module completed';
                repcontent.maxScore = maxScore;
                repcontent.score = score;
                raw_record.urlTitle = nl.t('View report');
            }
    
            _updateDateFormats(raw_record);
            stats.nLessonsDone = stats.nLessonsPassed + stats.nLessonsFailed;
            var ret = {raw_record: raw_record, repcontent: repcontent, user: user, stats: stats,
                recStateObj: _getRecordState(repcontent, raw_record, stats, 'module'),
                detailsavps : _getRecordAvps(repcontent, raw_record, 'module'), type: 'module'};
            return ret;
        }

        function _getRecordState(repcontent, raw_record, stats, type) {
            var curDate = new Date();
            var not_before = raw_record.not_before;
            var not_after = raw_record.not_after;
            var submissionAfterEndtime = raw_record.submissionAfterEndtime;
            if(not_before && not_before > curDate) {
                return {type: "upcoming"};
            } else if(stats.status.txt == "certified" || stats.status.txt == "completed" || stats.status.txt == "failed" 
                    || stats.status.txt == "done" || stats.status.txt == "passed") {
                if(type == 'module') {
                    return {type: "past", button: "REVIEW", url: nl.fmt2('/lesson/view_report_assign/{}', repcontent.id)};
                } else {
                    var canRetry = _getCanRedoCourse(repcontent, stats);
                    if(canRetry) {
                        return {type: "past", button: "REWORK", url: nl.fmt2('#/course_view?id={}&mode=do', repcontent.id)};
                    } else {
                        return {type: "past", button: "REVIEW", url: nl.fmt2('#/course_view?id={}&mode=report_view_my', repcontent.id)};
                    }    
                }
            } else if(not_after && not_after < curDate && !submissionAfterEndtime){
                if(type == 'module') {
                    return {type: "past"};
                } else {
                    return {type: "past", button: "REVIEW", url: nl.fmt2('#/course_view?id={}&mode=report_view_my', repcontent.id)};
                }
            }else{
                if(type == 'module') {
                    return {type: "active", button: stats.status.txt == "started" ? "CONTINUE" : "START", url: nl.fmt2('/lesson/do_report_assign/{}', repcontent.id)};
                } else {
                    return {type: "active", button: stats.status.txt == "started" ? "CONTINUE" : "START", url: nl.fmt2('#/course_view?id={}&mode=do', repcontent.id)};
                }
            }
        }

        function _getCanRedoCourse(repcontent, stats) {
            var lessonReps = repcontent.lessonReports || {};
            var statusInfos = repcontent.statusinfo || {};
            var canRetry = false;
            for(var i=repcontent.content.modules.length-1; i>=0; i--) {
                var module = repcontent.content.modules[i];
                if(module.type != "lesson") continue;
                if(module.type == "lesson") {
                    if(module.maxAttempts == 0) {
                        canRetry = true;
                        break;
                    }
                    if(module.id in lessonReps) {
                        var rep = lessonReps[module.id];
                        if(rep.attempt < module.maxAttempts) {
                            canRetry = true;
                            break;
                        }
                    } else {
                        canRetry = true;
                        break;
                    }
                }
            }
            return canRetry;
        }

        function _isConditionMet(lastItem, repcontent) {
            var prereqs = lastItem.start_after || [];
            var lessonReports = repcontent.lessonReports || {};
            var statusinfo = repcontent.statusinfo || {};
            if(prereqs.length == 0) return true;
            for(var i=0; i<prereqs.length; i++) {
                var p = prereqs[i];
                var cmid = p.module;
                var prereqScore = null;
                if (cmid in lessonReports && lessonReports[cmid].completed) {
                    var lessonReport = lessonReports[cmid];
                    var scores = _getScores(lessonReport, true);
                    prereqScore = scores.maxScore > 0 ? Math.round((scores.score/scores.maxScore)*100) : 100;
                } else if (cmid in statusinfo && statusinfo[cmid].status == 'done') {
                    prereqScore = 100;
                }
                if (prereqScore === null) return false;
                var limitMin = p.min_score || null;
                var limitMax = p.max_score || null;
                if (limitMin && prereqScore < limitMin) return false;
                if (limitMax && prereqScore > limitMax) return false;
            }
            return true;
        }

        function _getScores(lessonReport, defaultZero) {
            var ret = {};
            var sl = lessonReport.selfLearningMode;
            if (defaultZero || 'maxScore' in lessonReport) ret.maxScore = parseInt(sl ? 0 : lessonReport.maxScore||0);
            if (defaultZero || 'score' in lessonReport) ret.score = parseInt(sl ? 0 : lessonReport.score||0);
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
    
        function _updateCommonParams(raw_record, ctypestr) {
            var repcontent = angular.fromJson(raw_record.content);
            raw_record.gradeLabel = _userInfo.groupinfo.gradelabel;
            raw_record.subjectLabel = _userInfo.groupinfo.subjectlabel;
            raw_record._batchName = repcontent.batchname || '';
            raw_record.assign_remarks = (raw_record.ctype == _nl.ctypes.CTYPE_COURSE ? repcontent.remarks : repcontent.assign_remarks) || '';
            raw_record.not_before = repcontent.not_before || '';
            raw_record.not_after = repcontent.not_after || '';
            raw_record.submissionAfterEndtime = repcontent.submissionAfterEndtime || false;
            return repcontent;
        }

        function _updateDateFormats(raw_record) {
            raw_record.updated = nl.fmt.json2Date(raw_record.updated) || null;
            raw_record.created = nl.fmt.json2Date(raw_record.created) || raw_record.updated;
            raw_record.not_before = nl.fmt.json2Date(raw_record.not_before) || raw_record.created;
            raw_record.not_after = nl.fmt.json2Date(raw_record.not_after) || null;
        }

        function _getRecordAvps(repcontent, raw_record, type) {
            var assignedTo = raw_record.assigned_to;
            var avps = [];
            var contentmetadata = repcontent.content && repcontent.content.contentmetadata ? repcontent.content.contentmetadata : {};
            nl.fmt.addAvp(avps, 'AUTHOR', raw_record.authorname);
            nl.fmt.addAvp(avps, 'ASSIGNED BY', type == 'module' ? repcontent.assigned_by : repcontent.sendername);
            nl.fmt.addAvp(avps, 'ASSIGNED TO', assignedTo);
            if(type == 'course') {
                nl.fmt.addAvp(avps, _userInfo.groupinfo.gradelabel.toUpperCase() , contentmetadata.grade || '-');
                nl.fmt.addAvp(avps, _userInfo.groupinfo.subjectlabel.toUpperCase() , contentmetadata.subject || '-');    
            } else {
                nl.fmt.addAvp(avps, _userInfo.groupinfo.gradelabel.toUpperCase() , repcontent.grade || '-');
                nl.fmt.addAvp(avps, _userInfo.groupinfo.subjectlabel.toUpperCase() , repcontent.subject || '-');
            }
            nl.fmt.addAvp(avps, 'BATCH NAME', repcontent.batchname);
            nl.fmt.addAvp(avps, 'ASSIGNED ON', raw_record.created, 'date');
            nl.fmt.addAvp(avps, 'UPDATED ON', raw_record.updated, 'date');    
            if(type == 'module') {
                nl.fmt.addAvp(avps, 'STARTED ON', raw_record.started, 'date');
                nl.fmt.addAvp(avps, 'ENDED ON', raw_record.ended, 'date');    
            }

            nl.fmt.addAvp(avps, 'FROM', raw_record.not_before || '', 'date');
            nl.fmt.addAvp(avps, 'TILL', raw_record.not_after || '', 'date');
            nl.fmt.addAvp(avps, 'SUBMISSION AFTER ENDTIME', raw_record.submissionAfterEndtime, 'boolean');
            nl.fmt.addAvp(avps, 'REMARKS', raw_record.assign_remarks);
            nl.fmt.addAvp(avps, 'INTERNAL IDENTIFIER', repcontent.id);
            return avps;
        }
        function _getModuleStatus(stats, rep, report) {
            var scorePerc = (rep.score/rep.maxScore)*100;
            if (!rep.started) return nlLearverViewHelper.STATUS_PENDING;
            if (rep.started && !report.completed) return nlLearverViewHelper.STATUS_STARTED;
            if (rep.passScore && scorePerc < rep.passScore) return nlLearverViewHelper.STATUS_FAILED;
            if (report.completed) return nlLearverViewHelper.STATUS_DONE;
            return nlLearverViewHelper.STATUS_PASSED;
        }
    
        function _getStatusId(stats, started) {
            if (stats.percComplete == 0 && !started) return nlLearverViewHelper.STATUS_PENDING;
            if (stats.percComplete < 100) return nlLearverViewHelper.STATUS_STARTED;
            if (stats.nLessonsFailed > 0) return nlLearverViewHelper.STATUS_FAILED;
            if (stats.nCerts > 0) return nlLearverViewHelper.STATUS_CERTIFIED;
            if (stats.nMaxScore == 0) return nlLearverViewHelper.STATUS_DONE;
            return nlLearverViewHelper.STATUS_PASSED;
        }

    }];
    
    //-------------------------------------------------------------------------------------------------
    module_init();
    })();
    
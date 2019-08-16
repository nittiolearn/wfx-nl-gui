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
    var NlLearnerViewRecords = ['nl', 'nlLearnerAssignment', 'nlLearnerCourseRecords', 'nlReportHelper',
    function(nl, nlLearnerAssignment, nlLearnerCourseRecords, nlReportHelper) {
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
            var ret = nl.utils.dictToList(_records);
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

        
        function _processCourseReport(report) {
            var repcontent = _updateCommonParams(report, 'course');
            if(!repcontent.content) repcontent.content = {};
            var user = _userInfo;

            var course = nlLearnerCourseRecords.getRecord(report.lesson_id);
            if (!course) course = {};
            report.canReview = true;
            if(!course.is_published) report.canReview = false;
            var courseAssignment = nlLearnerAssignment.getRecord('course_assignment:'+report.assignment) || {};
            if (!courseAssignment.info) courseAssignment.info = {};
            if(courseAssignment) {
                report.not_after = courseAssignment.info['not_after'];
                report.not_before = courseAssignment.info['not_before'];
                report.submissionAfterEndtime = courseAssignment.info['submissionAfterEndtime'] || false;
                report.assign_remarks = courseAssignment.info['remarks'];
                report.assigned_to = courseAssignment.info['assigned_to'];
                report.authorname = courseAssignment.info['courseauthor'];
            }
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
                feedbackScore: stainf.feedbackScore,
                progressPerc: stainf.progPerc
            };

    
            stats.timeSpentStr = Math.ceil((stats.timeSpentSeconds*60)+stats.iltTimeSpent);
            stats.timeSpentStr = stats.timeSpentStr > 1 ? stats.timeSpentStr + ' minutes' 
                : stats.timeSpentStr == 1 ? stats.timeSpentStr + ' minute' : '';

            stats.percScore = stats.nMaxScore ? Math.round(100.0*stats.nScore/stats.nMaxScore) : 0;
            stats.percScoreStr = stats.percScore ? '' + stats.percScore + ' %' :  '';
            repcontent.statusinfo = stainf.itemIdToInfo;

            stats.status = nlReportHelper.getStatusInfoFromStr(stainf.status);
            var _statusStr = stats.status.txt;
            if(stats.status.id == nlReportHelper.STATUS_STARTED) 
                stats.status.txt = 'started'; 
            else if (_statusStr.indexOf('attrition') == 0)
                stats.status.txt = 'failed'; 

            _updateDateFormats(report);
            var ret = {raw_record: report, repcontent: repcontent, user: user, stats: stats,
                recStateObj: _getRecordState(repcontent, report, stats, 'course'),
                detailsavps : _getRecordAvps(repcontent, report, 'course'), type: 'course'
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
                stats.status = nlReportHelper.statusInfos[_getModuleStatus(stats, repcontent, raw_record)];
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
                stats.status = repcontent.selfLearningMode ? nlReportHelper.statusInfos[nlReportHelper.STATUS_DONE] : nlReportHelper.statusInfos[_getModuleStatus(stats, repcontent, raw_record)];
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
            } else if(nlReportHelper.isEndCourseState(stats.status.txt)) {
                if(type == 'module') {
                    return {type: "past", button: "REVIEW", url: nl.fmt2('/lesson/view_report_assign/{}', raw_record.id)};
                } else {
                    var canRetry = _getCanRedoCourse(repcontent, stats);
                    if(canRetry) {
                        return {type: "past", button: "REWORK", url: nl.fmt2('#/course_view?id={}&mode=do', raw_record.id)};
                    } else {
                        return {type: "past", button: "REVIEW", url: nl.fmt2('#/course_view?id={}&mode=report_view_my', raw_record.id)};
                    }    
                }
            } else if(not_after && not_after < curDate && !submissionAfterEndtime){
                if(type == 'module') {
                    return {type: "past"};
                } else {
                    return {type: "past", button: "REVIEW", url: nl.fmt2('#/course_view?id={}&mode=report_view_my', raw_record.id)};
                }
            }else{
                if(type == 'module') {
                    return {type: "active", button: stats.status.id == nlReportHelper.STATUS_STARTED ? "CONTINUE" : "START", url: nl.fmt2('/lesson/do_report_assign/{}', raw_record.id)};
                } else {
                    return {type: "active", button: stats.status.id == nlReportHelper.STATUS_STARTED ? "CONTINUE" : "START", url: nl.fmt2('#/course_view?id={}&mode=do', raw_record.id)};
                }
            }
        }

        function _getCanRedoCourse(repcontent, stats) {
            var lessonReps = repcontent.lessonReports || {};
            var modules = repcontent.content.modules || [];
            var canRetry = false;
            for(var i=modules.length-1; i>=0; i--) {
                var module = modules[i];
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
            if (!rep.started) return nlReportHelper.STATUS_PENDING;
            if (rep.started && !report.completed) return nlReportHelper.STATUS_STARTED;
            if (rep.passScore && scorePerc < rep.passScore) return nlReportHelper.STATUS_FAILED;
            if (report.completed) return nlReportHelper.STATUS_DONE;
            return nlReportHelper.STATUS_PASSED;
        }
    
        function _getStatusId(stats, started) {
            if (stats.percComplete == 0 && !started) return nlReportHelper.STATUS_PENDING;
            if (stats.percComplete < 100) return nlReportHelper.STATUS_STARTED;
            if (stats.nLessonsFailed > 0) return nlReportHelper.STATUS_FAILED;
            if (stats.nCerts > 0) return nlReportHelper.STATUS_CERTIFIED;
            if (stats.nMaxScore == 0) return nlReportHelper.STATUS_DONE;
            return nlReportHelper.STATUS_PASSED;
        }

    }];
    
    //-------------------------------------------------------------------------------------------------
    module_init();
    })();
    
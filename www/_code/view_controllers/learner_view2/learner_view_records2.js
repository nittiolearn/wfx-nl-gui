(function() {

//-------------------------------------------------------------------------------------------------
// learner_view_records.js: Process and store a list of learner assignment records
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.learner_view_records2', [])
    .config(configFn)
    .service('nlLearnerViewRecords2', NlLearnerViewRecords2);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
}];

//-------------------------------------------------------------------------------------------------
var NlLearnerViewRecords2 = ['nl', 'nlGetManyStore', 'nlReportHelper', 'nlServerApi', 'nlConfig', 'nlDlg',
function(nl, nlGetManyStore, nlReportHelper, nlServerApi, nlConfig, nlDlg) {
    var _records = {};
    var _referredRecordTimestamps = {};
    var _tsForFetchMore = null;
    var _dates = {};
    var _userInfo = null;
    this.init = function(userinfo) {
		nlGetManyStore.init();
        _userInfo = userinfo;
        _records = {};
        _dates = {minUpdated: null, maxUpdated: null};
    };

    this.getRecords = function() {
        return _records;
    };

    function _updateReferredRecordsTimestamps(records){
        Object.keys(records).forEach(function(value){
            var record = records[value];
            _referredRecordTimestamps[value] = {'id': record.id, 'type': record.ctype == _nl.ctypes.CTYPE_COURSE ? "course" : record.ctype == _nl.ctypes.CTYPE_MODULE ? "module" : null, 'updated': record.updated};
        });
    };

    this.initFromCache = function(onInitDone) {
        nlConfig.loadFromDb('learner_records_cache',function(data) {
            if (data){
                _records = data.records ? data.records : {};
                _updateReferredRecordsTimestamps(data.records ? data.records : {});
                _dates.minUpdated = data.minUpdated;
                _dates.maxUpdated = data.maxUpdated;
                onInitDone(true);
            }else{
                onInitDone(false);
            };
        });
    };

    this.updateCachedRecords = function(onUpdateDone) {
        _initPagefetcher();
        var rawRecords = {};
        
        var updatedfrom = new Date(_dates.maxUpdated).toISOString();
        _getLearningRecordsFromServer(true, false, updatedfrom, null, rawRecords, function(canFetchMore) {
            _updateTimestamps(rawRecords, 1, false);
            _processFetchedRecords(rawRecords, canFetchMore, onUpdateDone);
            _initPagefetcher(); // Get past data in next iteration
        });
    };

    this.fetchLatestChunkFromServer = function(onFetchedMore) {
        var rawRecords = {};
        var updatedtill = new Date().toISOString();
        var updatedfrom = new Date("1998-03-27").toISOString();
        _getLearningRecordsFromServer(true, false, updatedfrom, updatedtill, rawRecords, function(canFetchMore) {
            _updateTimestamps(rawRecords, 0, false);
            _processFetchedRecords(rawRecords, true, onFetchedMore);
        });
    };

    this.fetchNextChunkFromServer = function(onFetchedMore) {
        var rawRecords = {};
        _tsForFetchMore = new Date(_dates.minUpdated).toISOString();
        _getLearningRecordsFromServer(false, true, null, _tsForFetchMore, rawRecords, function(canFetchMore) {
            _updateTimestamps(rawRecords, 2, false);
            _processFetchedRecords(rawRecords, canFetchMore, onFetchedMore);
        });
    };

    function _updateTimestamps(rawRecords, updateMaxOrMinOrBoth, postProcessForCache){
        if (postProcessForCache) delete _dates.maxUpdated;
        if (postProcessForCache) delete _dates.minUpdated;
        for(var rid in rawRecords) {
            var record = postProcessForCache ? rawRecords[rid].raw_record : rawRecords[rid];
            if ((updateMaxOrMinOrBoth === 1 || updateMaxOrMinOrBoth === 0) && (!_dates.maxUpdated || record.updated > _dates.maxUpdated)) _dates.maxUpdated = record.updated;
            if ((updateMaxOrMinOrBoth === 2 || updateMaxOrMinOrBoth === 0) && (!_dates.minUpdated || record.updated < _dates.minUpdated)) _dates.minUpdated = record.updated;
        };
    };

    function _sortAndSliceObjOfObjByKey(obj, key, limit){
        var recordsArray = Object.values(obj)
        recordsArray = recordsArray.sort(function(a,b){
            return a[key]<b[key] ? -1 : 1;
        });
        recordsArray = recordsArray.slice(-limit);
        var ret = {}
        recordsArray.forEach(function(value){
            ret[value.id] = value;
        });
        return ret;
    };

    function _saveToDb(){
        nlConfig.loadFromDb('learner_records_cache', function(data){
            data = data ? data : {};
            data.records = data.records ? data.records : {};
            data.referredRecordTimestamps = data.referredRecordTimestamps ? data.referredRecordTimestamps : {};
            data.records = Object.assign(data.records, _records);
            data.referredRecordTimestamps = Object.assign(data.referredRecordTimestamps, _referredRecordTimestamps);
            var _cacheLimit = 1500;
            if (Object.keys(data.records).length >= _cacheLimit){
                data.records = _sortAndSliceObjOfObjByKey(data.records, "updated", _cacheLimit);
                data.referredRecordTimestamps = _sortAndSliceObjOfObjByKey(data.referredRecordTimestamps, "updated", _cacheLimit);
                _updateTimestamps(data.records, 0, true);
            };
            _updateTimestamps(data.records, 0, true);
            data.maxUpdated = _dates.maxUpdated;
            data.minUpdated = _dates.minUpdated;
            nlConfig.saveToDb('learner_records_cache', data);
        });
    };

    function _processFetchedRecords(rawRecords, canFetchMore, onDone) {
        var rawRecordsArray = [];
        for (var rid in rawRecords) {
            rawRecordsArray.push(rawRecords[rid]);
        }
        nlGetManyStore.fetchReferredRecords(rawRecordsArray, false, function() {
            var dataChanged = false;
            for(var i=0; i<rawRecordsArray.length; i++) {
                var raw_record = rawRecordsArray[i];
                var record = _records[raw_record.id] || null;
                if (record && record.raw_record.updated >= raw_record.updated && !_isReferredUpdated(raw_record))
                continue;
                dataChanged = true;
                _addRecord(raw_record);
            };
            _updateReferredRecordsTimestamps(rawRecords ? rawRecords : {});
            _saveToDb();
            onDone(dataChanged, canFetchMore);
        });
    }

	var _fetchChunk = 100;
    var _pageFetcher = null;
    
    function _initPagefetcher() {
        _pageFetcher = nlServerApi.getPageFetcher({defMax: _fetchChunk, itemType: 'learning record'});
    }
	
    function _getLearningRecordsFromServer(hideLoadingScreen, fetchMore, updatedfrom, updatedtill, rawRecords, onDone) {
        _initPagefetcher()
        var fetchLimit = fetchMore ? null : undefined;
		nlDlg.popupStatus('Fetching learning records from server ...', false);
		var params = {containerid: 0, type: 'all', assignor: 'all', learner: 'me'};
        if (updatedfrom) params.updatedfrom = updatedfrom;
        if (updatedtill) params.updatedtill = updatedtill;
        _pageFetcher.fetchBatchOfPages(nlServerApi.learningReportsGetList, params, fetchMore, function(results, batchDone) {
			if (results) {
				for (var i=0; i<results.length; i++) rawRecords[results[i].id] = results[i];
			}
            if (!batchDone) return;

            var canFetchMore = fetchMore ? _pageFetcher.canFetchMore() : false;
            var msg = 'Fetched.';
            if (canFetchMore) msg += ' Press on the fetch more icon to fetch more from server.';
            nlDlg.popupStatus(msg);
			onDone(canFetchMore);
		}, fetchLimit, hideLoadingScreen);
	};

    function _isReferredUpdated(raw_record) {
        return _referredRecordTimestamps[raw_record.id] != undefined;
    };

    function _addRecord(raw_record) {
        var report = null;
        if (raw_record.ctype == _nl.ctypes.CTYPE_COURSE)
            report = _processCourseReport(raw_record);
        else if (raw_record.ctype == _nl.ctypes.CTYPE_MODULE)
            report = _processModuleReport(raw_record);
        else 
            return null;
        if (!report) return null;
        var rid = report.raw_record.id;
        report.id = rid;
        report.updated = report.raw_record.updated;
        _records[rid] = report;
        return report;
    };
    
    function _processCourseReport(report) {
        var repcontent = _updateCommonParams(report, 'course');
        if(!repcontent.content) repcontent.content = {};

        var course = nlGetManyStore.getRecord(nlGetManyStore.getContentKeyFromReport(report));
        if (!course) {
            course = {};
        } else {
            repcontent.content.modules = course.content.modules;
            repcontent.name = course.name;
            if (course.icon) repcontent.icon = course.icon;
        }
        report.canReview = true;
        if(!course.is_published) report.canReview = false;
        var courseAssignment = nlGetManyStore.getAssignmentRecordFromReport(report) || {};
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
            nScore: stainf.nTotalQuizScore, nMaxScore: stainf.nTotalQuizMaxScore,
            feedbackScore: stainf.feedbackScore,
        };

        stats.timeSpent = Math.ceil((stats.timeSpentSeconds*60)+stats.iltTimeSpent);
        stats.timeSpentStr = Math.ceil((stats.timeSpentSeconds*60)+stats.iltTimeSpent);
        stats.timeSpentStr = stats.timeSpentStr > 1 ? stats.timeSpentStr + ' minutes' 
            : stats.timeSpentStr == 1 ? stats.timeSpentStr + ' minute' : '';

        stats.percScore = stats.nMaxScore ? Math.round(100.0*stats.nScore/stats.nMaxScore) : 0;
        stats.percScoreStr = stats.percScore ? '' + stats.percScore + ' %' :  '';
        repcontent.statusinfo = stainf.itemIdToInfo;

        stats.status = nlReportHelper.getStatusInfoFromCourseStatsObj(stainf);
        var _statusStr = stats.status.txt;
        if(stats.status.id == nlReportHelper.STATUS_STARTED) 
            stats.status.txt = 'started'; 
        else if (_statusStr.indexOf('attrition') == 0)
            stats.status.txt = 'failed'; 

        _updateDateFormats(report);
        var recState = _getRecordStateLearnerRec(repcontent, report, stats, 'course');
        if (recState.type == 'progress' || recState.type == 'expired') {
            var total = stainf.cnttotal || 0;
            var completed = stainf.nCompletedItems || 0;
            stats.progressPerc = Math.round(100*completed/total);
        } 
        if (recState.type == 'completed') stats.progressPerc = 100;

        var ret = {raw_record: report, repcontent: repcontent, stats: stats,
            recStateObj: recState,
            detailsavps : _getRecordAvps(repcontent, report, 'course'), type: 'course'
            };
        return ret;
    }

    function _processModuleReport(raw_record) {
        var repcontent = _updateCommonParams(raw_record, 'module');
        repcontent.icon = nl.url.lessonIconUrl(repcontent.image);
        repcontent.id = raw_record.id;

        var stats = {nLessons: 0, nLessonsPassed: 0, nLessonsFailed: 0, nQuiz: 0,
            timeSpentSeconds: 0, nAttempts: 0, nLessonsAttempted: 0, nScore: 0, nMaxScore: 0,
            internalIdentifier:raw_record.id, nCerts: 0, nLessonsDone: 0, done: 0};            

        var moduleAssignment = nlGetManyStore.getAssignmentRecordFromReport(raw_record) || null;
        if(moduleAssignment) {
            raw_record.not_after = moduleAssignment['not_after'];
            raw_record.not_before = moduleAssignment['not_before'];
            raw_record.assign_remarks = moduleAssignment['assign_remarks'];
            raw_record.submissionAfterEndtime = moduleAssignment['submissionAfterEndtime'] || false;
            raw_record.assigned_to = moduleAssignment['assigned_to'];
            raw_record.authorname = moduleAssignment['authorname'];
        }
        stats.nLessons++;
        if(repcontent.started) {
            stats.timeSpentSeconds = repcontent.timeSpentSeconds || 0;
            stats.nAttempts = 1;
            stats.nLessonsAttempted = 1;
            stats.nQuiz = 1;
            stats.totalQuizAttempts = 1;
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
            repcontent.maxScore = maxScore;
            repcontent.score = score;
            raw_record.urlTitle = nl.t('View report');
        }

        _updateDateFormats(raw_record);
        stats.nLessonsDone = stats.nLessonsPassed + stats.nLessonsFailed;
        var recState = _getRecordStateLearnerRec(repcontent, raw_record, stats, 'module');
        if (recState.type == 'progress' || recState.type == 'expired') {
            var pages = repcontent.pagesFiltered ? repcontent.pagesFiltered.length : [];
            var notAnswered = repcontent.notAnswered ? repcontent.notAnswered.length : [];
            var answered = pages - notAnswered;
            stats.progressPerc = Math.round(100*answered/pages);
        } 

        if (recState.type == 'completed') stats.progressPerc = 100;
        var ret = {raw_record: raw_record, repcontent: repcontent, stats: stats,
            recStateObj: recState,
            detailsavps : _getRecordAvps(repcontent, raw_record, 'module'), type: 'module'};
        
        return ret;
    }

    //Various states of the module/courses
    // "progress": The module/course in started state
    // "pending" : Not started state, the module/course is not started yet
    // "upcoming": The module/courses can be accessed in future
    // "completed": The module/courses completed
    // "expired": The module/course endTime is < current time and submission after end is not enabled;
    function _getRecordStateLearnerRec(repcontent, raw_record, stats, type) {
        var curDate = new Date();
        var not_before = raw_record.not_before;
        var not_after = raw_record.not_after;
        var submissionAfterEndtime = raw_record.submissionAfterEndtime;
        if(not_before && not_before > curDate) {
            return {type: "upcoming", cardSize: 'S'};
        }
        if (stats.status.id == nlReportHelper.STATUS_PENDING) {
            if (submissionAfterEndtime || !not_after || (not_after && curDate < not_after)) {
                if(type == 'module') {
                    return {type: "pending", button: "START", url: nl.fmt2('/lesson/do_report_assign/{}', raw_record.id)};
                } else {
                    return {type: "pending", button: "START", url: nl.fmt2('#/course_view?id={}&mode=do', raw_record.id)};
                }    
            }
            if (not_after && not_after < curDate) {
                return {type: "expired", cardSize: 'S'};
            }    
        }
        if (stats.status.id == nlReportHelper.STATUS_STARTED) {
            if (submissionAfterEndtime || !not_after || (not_after && curDate < not_after)) {
                if(type == 'module') {
                    return {type: "progress", button: "CONTINUE", url: nl.fmt2('/lesson/do_report_assign/{}', raw_record.id)};
                } else {
                    return {type: "progress", button: "CONTINUE", url: nl.fmt2('#/course_view?id={}&mode=do', raw_record.id)};
                }
            }
            if (not_after && not_after < curDate) {
                return {type: "expired", cardSize: 'S'};
            }
        }

        if(nlReportHelper.isEndStatusId(stats.status.id)) {
            if(type == 'module') {
                return {type: "completed", button: "REVIEW", url: nl.fmt2('/lesson/view_report_assign/{}', raw_record.id)};
            } else {
                var canRetry = _getCanRedoCourse(repcontent, stats);
                if (canRetry && not_after) canRetry = not_after > curDate || submissionAfterEndtime;
                if(canRetry) {
                    return {type: "completed", button: "REWORK", url: nl.fmt2('#/course_view?id={}&mode=do', raw_record.id)};
                } else {
                    return {type: "completed", button: "REVIEW", url: nl.fmt2('#/course_view?id={}&mode=report_view_my', raw_record.id)};
                }    
            }
        }
    }

    function _getCanRedoCourse(repcontent, stats) {
        var lessonReps = repcontent.lessonReports || {};
        var modules = repcontent.content.modules || [];
        var statusinfo = repcontent.statusinfo || {};
        var canRetry = false;
        for(var i=modules.length-1; i>=0; i--) {
            var module = modules[i];
            var itemInfo = statusinfo[module.id] || {};
            if(module.type != "lesson") continue;
            if (itemInfo.status == 'started' || itemInfo.status == 'pending') {
                canRetry = true;
                break;
            }
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
        delete raw_record.content; // To save space
        raw_record._batchName = repcontent.batchname || '';
        raw_record.assign_remarks = (raw_record.ctype == _nl.ctypes.CTYPE_COURSE ? repcontent.remarks : repcontent.assign_remarks) || '';
        raw_record.not_before = repcontent.not_before || '';
        raw_record.not_after = repcontent.not_after || '';
        raw_record.submissionAfterEndtime = repcontent.submissionAfterEndtime || false;
        if (repcontent.batchtype) raw_record.batchtype = repcontent.batchtype;
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
        if (repcontent.batchtype) nl.fmt.addAvp(avps, 'BATCH TYPE', repcontent.batchtype);
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

    this.getTimeRanges = function(rangeType, maxBuckets) {
        if (!_dates.minUpdated || !_dates.maxUpdated) return [];
        if (!maxBuckets) maxBuckets = (rangeType == 'days') ? 31 : (rangeType == 'weeks') ? 15 : (rangeType == 'months') ? 15 : 8;

        var day = 24*60*60*1000; // 1 day in ms
        var now = new Date();
        var offset = now.getTimezoneOffset()*60*1000; // in ms
        var start = Math.floor((new Date(_dates.minUpdated).getTime()-offset)/day)*day + offset; // Today 00:00 Hrs in local time
        var end = Math.ceil((new Date(_dates.maxUpdated).getTime()-offset)/day)*day + offset; // Tomorrow 00:00 Hrs in local time
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

}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

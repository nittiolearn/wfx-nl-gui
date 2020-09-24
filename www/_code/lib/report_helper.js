(function() {

//-------------------------------------------------------------------------------------------------
// report_helper.js:
// Common code to process db.report record is placed here. This is used in learning_reports, 
// learner_view and course_view for status computation and processing the content of report
// records.
// To begin with the status computation of course reports are available here.
//
// Allowed itemInfo.rawStatus: pending, started, failed, success, partial_success
// Allowed item states: pending, started, failed, success, partial_success, waiting, delayed
// Allowed course states: pending, started, failed, certified, passed, done, attrition*, custom-states
// Attrition* are equivalent to failed
// CustomStates are equivalent to started
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.report_helper', [])
    .service('nlReportHelper', NlReportHelper);
}

//-------------------------------------------------------------------------------------------------
var NlReportHelper = ['nl', 'nlCourse', 'nlExpressionProcessor',
function(nl, nlCourse, nlExpressionProcessor) {
    this.STATUS_PENDING = 0;
    this.STATUS_STARTED = 1;
    this.STATUS_DONE = 2;
    this.STATUS_PASSED = 3;
    this.STATUS_FAILED = 4;
    this.STATUS_CERTIFIED = 5;

	this.statusInfos = [
		{id: this.STATUS_PENDING, txt: 'pending', icon: 'ion-ios-circle-filled fgrey'},
		{id: this.STATUS_STARTED, txt: 'started', icon: 'ion-ios-circle-filled fgreen'},
		{id: this.STATUS_DONE, txt: 'done', icon: 'ion-checkmark-circled fgreen'},
		{id: this.STATUS_PASSED, txt: 'passed', icon: 'ion-checkmark-circled fgreen'},
		{id: this.STATUS_FAILED, txt: 'failed', icon: 'icon ion-close-circled forange'},
        {id: this.STATUS_CERTIFIED, txt: 'certified', icon: 'icon ion-android-star fgreen'}];
        
    this.getStatusInfoFromCourseStatsObj = function(courseStatusObj) {
        var statusStr = courseStatusObj.status;
        if (!statusStr) return this.statusInfos[this.STATUS_PENDING];
        for (var i=0; i<this.statusInfos.length; i++) {
            var item = this.statusInfos[i];
            if (item.txt == statusStr) return item;
        }
        var statusId = statusStr.indexOf('attrition') == 0 ? this.STATUS_STARTED : this.STATUS_STARTED; //Curretly attrition is pending.
        if (courseStatusObj.isCertified) statusId = this.STATUS_CERTIFIED;
        var ret = angular.copy(this.statusInfos[statusId]);
        ret.txt = statusStr;
        if (statusStr.indexOf('attrition') == 0) ret.icon = 'icon ion-close-circled forange';
        return ret;
    }
        
    this.isDone = function(statusInfo) {
        return statusInfo.id != this.STATUS_PENDING && statusInfo.id != this.STATUS_STARTED;
    };

    this.getAsdUpdatedModules = function(modules, attendance) {
        var asdModules = new AsdModules();
        return asdModules.getAsdUpdatedModules(modules, attendance);
    };

    this.getAsdItem = function(asdItemFromDb, parentFixedSession) {
        var asdModules = new AsdModules();
        return asdModules.getAsdItem(asdItemFromDb, parentFixedSession);
    };

    this.getItemName = function(cm) {
        return _getItemName(cm);
    };

    this.getCourseStatusHelper = function(report, groupinfo, courseAssign, course, modules) {
        return new CourseStatusHelper(nl, nlCourse, nlExpressionProcessor, false, report, groupinfo, courseAssign, course, modules, 'trainer');
    };
    this.getCourseStatusHelperForCourseView = function(report, groupinfo, isLearnerMode) {
        return new CourseStatusHelper(nl, nlCourse, nlExpressionProcessor, true, report, groupinfo, null, null, null, isLearnerMode ? 'learner' : 'trainer');
    };

    this.isEndItemState = function(status) {
        return _isEndItemState(status);
    };

    this.isCourseCompleted = function(courseStatusObj) {
        return _isEndCourseState(courseStatusObj, true);
    };

    this.isEndStatusId = function(statusId) {
        return (statusId != this.STATUS_PENDING && statusId != this.STATUS_STARTED);
    };
}];

function CourseStatusHelper(nl, nlCourse, nlExpressionProcessor, isCourseView, report, groupinfo, courseAssign, course, modules, launchMode) {
    if (!report) report = {};
    _processCourseRecord(course);
    var _course = course || {};
    //--------------------------------------------------------------------------------
    // Public interfaces
    this.getCourseStatus = function() {
        _init();
        return _getCourseStatus();
    };

    //--------------------------------------------------------------------------------
    // Implementation
    var _launchMode = launchMode;
    var repcontent = isCourseView ? report : angular.fromJson(report.content || '{}');
    var _statusinfo = repcontent.statusinfo || {};
    var _lessonReports = repcontent.lessonReports || {};
    var _pastLessonReports = repcontent.pastLessonReports || {};
    var _modifiedILT = ((courseAssign ? courseAssign.info : repcontent) || {}).modifiedILT || {};
    _modifiedILT = nlCourse.migrateModifiedILT(_modifiedILT);
    var _msDates = courseAssign && courseAssign.info && courseAssign.info.msDates ? courseAssign.info.msDates : repcontent.msDates || {};

    for (var key in _msDates) {
        var d = _msDates[key];
        _msDates[key] = nl.fmt.json2Date(d);
    }
 
    var _modules = modules;
    var _fromDate = (courseAssign || {}).not_before ||  report.not_before || report.created;
    if (_fromDate) _fromDate = nl.fmt.json2Date(_fromDate);
    var _userAttendanceDict = {};
    var _userRatingDict = {};
    var _grpAttendanceDict = {};
    var _grpMilestoneDict = {};
    var _grpRatingDict = {};
    var _milestone = {};
    var _isNHT = false;

    function _init() {
        var attendance = {};
        var rating = {};
        if (courseAssign) {
            if (courseAssign.attendance) attendance = angular.fromJson(courseAssign.attendance);
            if (courseAssign.rating) rating = angular.fromJson(courseAssign.rating);
            if (courseAssign.milestone) _milestone = angular.fromJson(courseAssign.milestone);
        } else if (repcontent) {
            attendance = (repcontent.content || {}).attendance || {};
            rating = (repcontent.content || {}).rating || {};
            _milestone = (repcontent.content || {}).milestone || {};
        }
        attendance = nlCourse.migrateCourseAttendance(attendance);
        _userAttendanceDict = _arrayToDict(attendance[report.id]);
        _userRatingDict = _arrayToDict(rating[report.id]);
        _grpAttendanceDict = _arrayToDict((groupinfo || {}).attendance);
        _grpMilestoneDict = _arrayToDict((groupinfo || {}).milestones);
        _grpRatingDict = _arrayToDict((groupinfo || {}).ratings);
        if (!_modules) {
            _modules = angular.copy(((course || repcontent || {}).content || {}).modules || []); 
            var asdModules = new AsdModules();
            _modules = asdModules.getAsdUpdatedModules(_modules, attendance);
        }
        _isNHT = ((course || repcontent || {}).content || {}).nht ? true : false; 
    }

    function _arrayToDict(inputArray) {
        var ret = {};
        if (!inputArray) return ret;
        for (var i=0; i< inputArray.length; i++) {
            var item = inputArray[i];
            ret[item.id] = item;
        }
        return ret;
    }

    function _processCourseRecord(course) {
        if (!course) return course;
        course = nlCourse.migrateCourse(course);
        course.contentmetadata = (course.content || {}).contentmetadata || course.contentmetadata ||{};
    }

    var _ctx = {};
    var msInfoDict = {};
    function _getCourseStatus() {
        _ctx = {unlockNext: {}};
        msInfoDict = {latestMarkedMilestone: null, firstPendingMs: null}
        var ret = {status: 'pending', itemIdToInfo: {asdAddedSessions: {}}, delayDays: 0,
            nCompletedItems: 0,
            nQuizes: 0, nQuizAttempts: 0, nPassedQuizes: 0, nFailedQuizes: 0, 
            nTotalQuizScore: 0, nTotalQuizMaxScore: 0,
            onlineTimeSpentSeconds: 0, iltTimeSpent: 0, iltTotalTime: 0,
            feedbackScore: '', customScores: [], attritedAt: null, attritionStr: null,
            isCertified: false, certid: null,
            customScoreDict: {},
            inductionDropOut: null,
            quizScoreLen: 0,
            quizScore: {},
            nlockedcnt: 0,
            nhiddencnt: 0,
            ndelayedcnt: 0

            // Also may have has following:
            // reattempt: true/false
        };

        var itemIdToInfo = ret.itemIdToInfo; // id: {status: , score: , rawStatus: }
        if (_modules.length <= 0) {
            return ret;
        }

        var latestCustomStatus = '';
        var defaultCourseStatus = 'pending';
        var isAttrition = false;
        var earlierTrainerItems = {};
        ret.cnttotal = 0;
        for(var i=0; i<_modules.length; i++) {
            var cm = _modules[i];
            var itemInfo = {};
            if (cm.type != 'module' && cm.type != 'certificate') ret.cnttotal += 1;
            if (cm.isReattempt) ret['reattempt'] = false;
            itemIdToInfo[cm.id] = itemInfo;
            _getRawStatusOfItem(cm, itemInfo, itemIdToInfo);
            if (cm.type == 'lesson' && cm.isQuiz) _updateQuizScore(ret, cm, itemInfo);
            itemInfo.status = itemInfo.rawStatus;
            if (cm.type == 'iltsession') {
                if(itemInfo.stateStr == 'certified') {
                    ret.isCertified = true;
                    latestCustomStatus = 'certified';
                }
            }
            if (isAttrition) {
                itemInfo.status = 'waiting';
                // TODO-LATER: try using this across every place (course_view and course assign view - eye icon)
                // update lockedMsg correctly in different places
                // See the code that shows locked reason in course_view.js
                // var atritedCm = itemIdToInfo[ret.attritedAt];
                // itemInfo.lockedMsg = nl.fmt2('Marked as {} at {}', ret.attritionStr, _getItemName(atritedCm));
                itemInfo.isAttrition = true;
                if (cm.hide_locked) itemInfo.hideItem = true;
                if (cm.type != 'module' && cm.type != 'certificate') ret.nlockedcnt++;
                continue;
            }
            if (cm.isReattempt && itemInfo.rawStatus != 'pending') ret.reattempt = true;
            _updateStatusToWaitingIfNeeded(cm, itemInfo, itemIdToInfo);
            if (!(cm.hide_locked && itemInfo.status == 'waiting')) _updateItemToLocked(cm, itemInfo, earlierTrainerItems); 
            if((cm.hide_locked && itemInfo.status == 'waiting') || itemInfo.hideItem) {
                itemInfo.hideItem = true;
                if (cm.type != 'module' && cm.type != 'certificate') ret.nhiddencnt++;
                continue;
            }
            _updateUnlockedTimeStamp(cm, itemInfo, itemIdToInfo);
            _updateStatusToDelayedIfNeeded(cm, itemInfo); //Calculate delay of course based on
            if (cm.type == 'milestone' && _isNHT) _updateDelayDaysForMs(cm, itemInfo, itemIdToInfo, ret);
            if (cm.type != 'module' && cm.type != 'certificate') _updateStatistics(itemInfo, cm, ret);
            if (cm.type == 'certificate') {
                ret['certid'] = cm.id;
            }
            latestCustomStatus =  _updateCustomStatus(itemInfo, latestCustomStatus);
            if (itemInfo.inductionDropOut) ret.inductionDropOut = true;
            if (itemInfo.isAttrition) {
                isAttrition = true;
                ret.attritedAt = cm.id;
                ret.attritionStr = itemInfo.state;
                itemInfo.status = 'attrition';
                var suffix = itemInfo.customStatus ? '-' +  itemInfo.customStatus : '';
                defaultCourseStatus = 'attrition' + suffix;
            } else  if (itemInfo.status != 'waiting' && cm.type != 'module') {
                if (defaultCourseStatus == 'pending' && itemInfo.status != 'pending' && itemInfo.status != 'delayed') {
                    defaultCourseStatus ='started';
                }
                if (itemInfo.customStatus) defaultCourseStatus = itemInfo.customStatus;
                if (itemInfo.isModuleCompleted) defaultCourseStatus = itemInfo.isModuleCompleted;
            }
            if (cm.showInReport && _isEndItemState(itemInfo.status)) {
                var isCustomScoreNameUnique = true;
                for(var j=0; j<ret.customScores.length; j++) {
                    if(cm.name == ret.customScores[j].name) {
                        isCustomScoreNameUnique = false;
                        break;
                    }
                }
                if(isCustomScoreNameUnique) {
                    var score = itemInfo.score;
                    var customScoreType = null;
                    if(cm.rating_type == 'rag') {
                        score = itemInfo.rating;
                        customScoreType = 'rag';
                    }
                    var customScoreItemObj = {name: cm.name, score: score};
                    if(customScoreType) customScoreItemObj['type'] = customScoreType;
                    ret.customScores.push(customScoreItemObj);
                    ret.customScoreDict[cm.name] =  score;
                }
            }
        }

        _updateCourseLevelStatus(ret, isAttrition, defaultCourseStatus);
        if (!_isNHT) _updateCourseDelayForLMS(ret);
        if (_isNHT) _updateCourseDelayForNHT(ret);
        ret.feedbackScore = _getFeedbackScoreForCourse(_lessonReports);
        ret.feedbackScore = ret.feedbackScore ? '' + Math.round(ret.feedbackScore*10)/10 + '%' : '';
        return ret;
    }

    function _updateQuizScore(ret, cm, itemInfo) {
        if (ret.quizScoreLen >= 100) return;
        ret.quizScoreLen++;
        ret.quizScore[nl.fmt2('name{}', ret.quizScoreLen)] = cm.name;
        ret.quizScore[nl.fmt2('score{}', ret.quizScoreLen)] = itemInfo.selfLearningMode ? '' : itemInfo.score;
    }

    function _updateCourseDelayForNHT(ret) {
        var lastestMarkedMsDelay = 0;
        var firstPendingMsDelay = 0;
        ret.delayDays = 0;
        if (!msInfoDict.latestMarkedMilestone) return;
        if (msInfoDict.latestMarkedMilestone) lastestMarkedMsDelay = msInfoDict.latestMarkedMilestone.delayDays;
        if (msInfoDict.firstPendingMs) firstPendingMsDelay = msInfoDict.firstPendingMs.delayDays;
        ret.delayDays = lastestMarkedMsDelay > firstPendingMsDelay ? lastestMarkedMsDelay : firstPendingMsDelay;
    }

    function _updateDelayDaysForMs(cm, itemInfo) {
        if (msInfoDict.firstPendingMs) return;
        var msInfo = _milestone[cm.id] || {};
        var msid = 'milestone_' + cm.id;
        var msPlanned = null;
        var repid = report.id;
        if (msid in _msDates) msPlanned = _msDates[msid];
        var learnerMsInfo = msInfo.learnersDict ? msInfo.learnersDict[repid] : {};
        if (!learnerMsInfo) learnerMsInfo = {};
        if (msInfo.status && msInfo.status == 'done' && learnerMsInfo.marked == 'done') {
            var actualMarked = learnerMsInfo.reached ? new Date(learnerMsInfo.reached) : '';
            var msDelay = 0;
            if (msPlanned && actualMarked > msPlanned) {
                msDelay = 1.0*(actualMarked - msPlanned)/1000.0/3600.0/24;
                itemInfo.delayDays = msDelay;
            }
            msInfoDict.latestMarkedMilestone = {delayDays: Math.round(msDelay)};            
        }

        if ((!learnerMsInfo.marked || learnerMsInfo.marked != 'done') && !msInfoDict.firstPendingMs) {
            var msDelay = 0;
            var now = new Date();
            if (msPlanned && now > msPlanned) {
                msDelay = 1.0*(now - msPlanned)/1000.0/3600.0/24;
                itemInfo.delayDays = msDelay;
            }
            if (!msInfoDict.latestMarkedMilestone) msDelay = 0;

            msInfoDict.firstPendingMs = {delayDays: Math.round(msDelay)};
        }
    };
    
    function _updateItemToLocked(cm, itemInfo, earlierTrainerItems) {
        if (earlierTrainerItems.isMarkedCertified) itemInfo.isMarkedCertified = true;
        if(cm.type == 'iltsession') {
            _updateILTtoLocked(cm, itemInfo, earlierTrainerItems);
            if (itemInfo.attId == 'certified') earlierTrainerItems.isMarkedCertified = true;
        } else if(cm.type == 'rating') {
            _updateRatingtoLocked(cm, itemInfo, earlierTrainerItems);
            earlierTrainerItems.rating = itemInfo;
        } else if(cm.type == 'milestone') {
            _updateMilestonetoLocked(cm, itemInfo, earlierTrainerItems);
            earlierTrainerItems.milestone = itemInfo;
        }
    }

    function _pendingOrWaiting(itemInfo) {
        return  itemInfo && (itemInfo.rawStatus === 'pending' || itemInfo.status === 'waiting');
    }

    function _pendingOrWaitingIlt(earlierTrainerItems) {
        return  (earlierTrainerItems.asdCombinedStatus === 'pending' || earlierTrainerItems.asdCombinedStatus === 'waiting');
    }

    function _computeCombinedStatusAndTimePerc(cm, itemInfo, earlierTrainerItems) {
        var itemStatus = itemInfo.status;
        // var sessionDate = (cm.sessiondate ||itemInfo.attMarkedOn) ? nl.fmt.date2Str(
        //     nl.fmt.json2Date(cm.sessiondate || itemInfo.attMarkedOn || ''), 'date') : null;
        // if (sessionDate && (sessionDate in earlierTrainerItems.atdMarkedDates)) {
        //     itemStatus = 'notapplicable';
        // } else if (sessionDate && itemInfo.attId && itemInfo.attId != 'notapplicable') {
        //     earlierTrainerItems.atdMarkedDates[sessionDate] = true;
        // }
        if (!cm.asdSession) {
            // Fixed ILT Session
            earlierTrainerItems.asdCombinedStatus = itemStatus;
            earlierTrainerItems.maxTimePerc = itemInfo.maxTimePerc;
            return;
        }
        if (!earlierTrainerItems.asdCombinedStatus) {
            // ASD ILT Session which is above the first ILT session
            return;
        }

        // ASD ILT Session which is not above the first ILT session
        var currentIsMax = false;
        if (itemInfo.maxTimePerc > earlierTrainerItems.maxTimePerc) {
            earlierTrainerItems.maxTimePerc = itemInfo.maxTimePerc;
            currentIsMax = true;
        }
        itemInfo.maxTimePerc = earlierTrainerItems.maxTimePerc;
        if (earlierTrainerItems.asdCombinedStatus != 'locked' && currentIsMax)
            earlierTrainerItems.asdCombinedStatus = itemStatus;
    }

    function _updateILTtoLocked(cm, itemInfo, earlierTrainerItems) {
        if(_pendingOrWaiting(earlierTrainerItems.milestone) ||
            _pendingOrWaitingIlt(earlierTrainerItems)) {
            itemInfo.dependencyArray = [];
            itemInfo.status = 'waiting';
            if (_pendingOrWaiting(earlierTrainerItems.milestone)) {
                var str = nl.t('{} is marked.', earlierTrainerItems.milestone.name);
                itemInfo.dependencyArray.push(str);
            }
            if (_pendingOrWaitingIlt(earlierTrainerItems)) itemInfo.dependencyArray.push('Previous session is marked.');
        }
        //TODO:Naveen Check this whether these computation is needed or not
        _computeCombinedStatusAndTimePerc(cm, itemInfo, earlierTrainerItems);
    }

    function _updateRatingtoLocked(cm, itemInfo, earlierTrainerItems) {
        if(_pendingOrWaiting(earlierTrainerItems.milestone)) {
            itemInfo.status = 'waiting';
            var str = nl.t('{} is marked.', earlierTrainerItems.milestone.name);
            itemInfo.dependencyArray = [str];
            return;
        }
        if(cm.rating_type == 'rag') return;
        if (earlierTrainerItems.maxTimePerc == 0) {
            itemInfo.status = 'waiting';
            itemInfo.dependencyArray = ['Previous session is marked.'];
            return;
        }
    }

    function _updateMilestonetoLocked(cm, itemInfo, earlierTrainerItems) {
        itemInfo.dependencyArray = [];
        if(_pendingOrWaiting(earlierTrainerItems.milestone)) {
            itemInfo.status = 'waiting';
            var str = nl.t('{} is marked.', earlierTrainerItems.milestone.name);
            itemInfo.dependencyArray.push(str);
        } else if(_pendingOrWaitingIlt(earlierTrainerItems)) {
            itemInfo.status = 'waiting';
            itemInfo.dependencyArray.push('Previous session is marked.');
        } else if(_pendingOrWaiting(earlierTrainerItems.rating)) {
            itemInfo.status = 'waiting';
            var str = nl.t('{} is marked.', earlierTrainerItems.rating.name);
            itemInfo.dependencyArray.push(str);
        }
    }

    function _getRawStatusOfItem(cm, itemInfo, itemIdToInfo) {
        itemInfo.type = cm.type;
        itemInfo.name = cm.name;
        if (_isCertificate(cm)) {
            var sinfo = _statusinfo[cm.id] || {};
            itemInfo.rawStatus = 'success';
            itemInfo.updated = _getUpdatedTimestamp(sinfo);
            _ctx.unlockNext[cm.id] = itemInfo.updated;
            itemInfo.expire_after = cm.certificate_expire_after || null;
            itemInfo.score = 100;
        } else if (cm.type == 'info' || cm.type == 'link') {
            _getRawStatusOfInfo(cm, itemInfo);
        } else if (cm.type == 'lesson') {
            _getRawStatusOfLesson(cm, itemInfo);
        } else if (cm.type == 'iltsession') {
            _getRawStatusOfIltSession(cm, itemInfo);
            if (cm.asdSession) {
                if (!(cm.parentFixedSessionId in itemIdToInfo.asdAddedSessions)) itemIdToInfo.asdAddedSessions[cm.parentFixedSessionId] = [];
                itemIdToInfo.asdAddedSessions[cm.parentFixedSessionId].push(itemInfo);
        }
        } else if (cm.type == 'rating') {
            _getRawStatusOfRating(cm, itemInfo);
        } else if (cm.type == 'milestone') {
            _getRawStatusOfMilestone(cm, itemInfo);
        } else if (cm.type == 'gate') {
            _getRawStatusOfGate(cm, itemInfo, itemIdToInfo);
        } else {
            // type == module or new unknown ones!
            itemInfo.rawStatus = 'success';
            itemInfo.score = 100;
        }
    }

    function _getUpdatedTimestamp(sinfo) {
        return nl.fmt.json2Date(sinfo.timestamp || sinfo.date || '');
    }

    function _getRawStatusOfInfo(cm, itemInfo) {
        var sinfo = _statusinfo[cm.id] || {};
        itemInfo.rawStatus = sinfo.status == 'done' ? 'success' : 'pending';
        itemInfo.score = itemInfo.rawStatus == 'success' ? 100 : null;
        itemInfo.remarks = sinfo.remarks || '';
        itemInfo.updated = _getUpdatedTimestamp(sinfo);
        if (itemInfo.rawStatus == 'success') _ctx.unlockNext[cm.id] = itemInfo.updated;
    }
    
    function _checkStatusPastLessonReports(id, itemInfo) {
        var pastInfo = _pastLessonReports[id] || [];
        if(pastInfo.length == 0) return;
        for(var i=0; i< pastInfo.length; i++) {
            var pastRep= pastInfo[i];
            var score = 100*pastRep.score/pastRep.maxScore;
            if(score >= pastRep.passScore || pastRep.selfLearningMode) {
                itemInfo.isModuleCompleted = 'success';
                break;
            } else {
                itemInfo.isModuleCompleted = 'failed';
            }
        }
    }

    function _getRawStatusOfLesson(cm, itemInfo) {
        var linfo = _lessonReports[cm.id] || null;
        itemInfo.selfLearningMode = false;
        if (linfo === null) {
            itemInfo.rawStatus = 'pending';
            itemInfo.score = null;
            itemInfo.nAttempts = null;
            return;
        }
        itemInfo.nAttempts = linfo.attempt || null;
        itemInfo.timeSpentSeconds = linfo.timeSpentSeconds || 0;
        itemInfo.moduleRepId = linfo.reportId || null;
        itemInfo.selfLearningMode = linfo.selfLearningMode || false;
        if (!linfo.completed) {
            _checkStatusPastLessonReports(cm.id,itemInfo);
            itemInfo.rawStatus = 'started';
            itemInfo.score = null;
            return;
        }
        if (linfo.selfLearningMode) {
            itemInfo.rawStatus = 'success';
            itemInfo.score = 100;
            itemInfo.started = nl.fmt.json2Date(linfo.started || '');
            itemInfo.ended = nl.fmt.json2Date(linfo.ended || '');
            itemInfo.updated = nl.fmt.json2Date(linfo.updated || '');
            _ctx.unlockNext[cm.id] = itemInfo.ended || itemInfo.updated;
            itemInfo.feedbackScore = _getFeedbackScoreForModule(linfo.feedbackScore);
            itemInfo.feedbackScore = itemInfo.feedbackScore ? '' + Math.round(itemInfo.feedbackScore*10)/10 + '%' : '';
            return;
        }
        var pastInfo = _pastLessonReports[cm.id] || {};
        var maxPerc = _getPerc(linfo);
        var maxLinfo = linfo;
        var totalTimeSpent = linfo.timeSpentSeconds;
        for(var i=pastInfo.length-1; i>=0; i--) {
            var pastRep = pastInfo[i];
            if (!pastRep.completed || !pastRep.reportId) continue; // For data created by old bug (see #956)
            totalTimeSpent += pastRep.timeSpentSeconds;
            var pastPerc = _getPerc(pastRep);
            if(pastPerc <= maxPerc) continue;
            maxPerc = pastPerc;
            maxLinfo = pastRep;
        }
        itemInfo.targetLang = maxLinfo.targetLang || '';
        itemInfo.score = maxPerc;
        itemInfo.timeSpentSeconds = totalTimeSpent;
        itemInfo.maxScore = _getMaxScore(maxLinfo);
        itemInfo.rawScore = _getRawScore(maxLinfo);
        itemInfo.passScore = parseInt(maxLinfo.passScore || linfo.passScore || 0);
        itemInfo.started = nl.fmt.json2Date(maxLinfo.started || '');
        itemInfo.ended = nl.fmt.json2Date(maxLinfo.ended || '');
        itemInfo.updated = nl.fmt.json2Date(maxLinfo.updated || '');
        _ctx.unlockNext[cm.id] = itemInfo.ended || itemInfo.updated;
        itemInfo.moduleRepId = maxLinfo.reportId || null;
        itemInfo.rawStatus = (!itemInfo.maxScore) ? 'success' : (itemInfo.maxScore && (itemInfo.score >= itemInfo.passScore)) ? 'success' : 'failed';
        itemInfo.feedbackScore = _getFeedbackScoreForModule(maxLinfo.feedbackScore);
        itemInfo.feedbackScore = itemInfo.feedbackScore ? '' + Math.round(itemInfo.feedbackScore*10)/10 + '%' : '';
    }

    function _getMaxScore(linfoItem) {
        if (linfoItem.selfLearningMode) return null;
        if (!linfoItem.maxScore) return null;
        return linfoItem.maxScore;
    }

    function _getRawScore(linfoItem) {
        if (linfoItem.selfLearningMode) return null;
        if (!linfoItem.score || !linfoItem.maxScore) return null;
        return linfoItem.score;
    }

    function _getPerc(linfoItem) {
        if (linfoItem.selfLearningMode) return 0.0;
        if (!linfoItem.score || !linfoItem.maxScore) return 0.0;
        return Math.round(100.0*linfoItem.score/linfoItem.maxScore);
    }

    function _getRawStatusOfIltSession(cm, itemInfo) {
        var userCmAttendance = _userAttendanceDict[cm.id];
        itemInfo.attId = (userCmAttendance || {}).attId || null;
        var grpAttendanceObj = _grpAttendanceDict[itemInfo.attId];
        itemInfo.maxTimePerc = 0;
        var modifiedSession = _modifiedILT[cm.id] || {};
        cm.iltduration = modifiedSession.duration || cm.iltduration;
        itemInfo.start = nl.fmt.fmtDateDelta(modifiedSession.start || _fromDate, null, 'minute');
        itemInfo.notes = modifiedSession.notes || '';
        itemInfo.url = modifiedSession.url || null;
        var iltStatusInfo = _statusinfo[cm.id] || {};
        if (iltStatusInfo.joinTime) itemInfo.joinTime = nl.fmt.json2Date(iltStatusInfo.joinTime);

        if (!userCmAttendance || !grpAttendanceObj) {
            itemInfo.score = null;
            itemInfo.rawStatus = 'pending';
            itemInfo.iltTotalTime = cm.iltduration;
            return;
        }
        itemInfo.score = grpAttendanceObj.timePerc || 0;
        itemInfo.maxTimePerc = itemInfo.score; // Needed for computing max across additional sessions
        itemInfo.rawStatus = itemInfo.score == 100 ? 'success' : itemInfo.score == 0 ? 'failed' : 'partial_success';
        itemInfo.iltTotalTime = cm.iltduration;
        itemInfo.iltTimeSpent = ((grpAttendanceObj.timePerc/100)*cm.iltduration);
        itemInfo.state = grpAttendanceObj.name;
        itemInfo.stateStr = grpAttendanceObj.id;
        itemInfo.remarks = userCmAttendance.remarks || '';
        itemInfo.otherRemarks = userCmAttendance.otherRemarks || '';
        itemInfo.marked = nl.fmt.json2Date(userCmAttendance.marked || '');
        itemInfo.updated = nl.fmt.json2Date(userCmAttendance.updated || '');
        itemInfo.attMarkedOn = userCmAttendance.attMarkedOn || cm.sessiondate || '';
        itemInfo.shiftHrs = userCmAttendance.shiftHrs || cm.shiftHrs || '';
        itemInfo.shiftMins = userCmAttendance.shiftMins || cm.shiftMins || '';
        itemInfo.shiftEnd = userCmAttendance.shiftEnd || cm.shiftEnd || '';

        _ctx.unlockNext[cm.id] = itemInfo.marked;
        if (grpAttendanceObj.isAttrition) itemInfo.isAttrition = true;
        if (grpAttendanceObj.id == 'induction_dropout') itemInfo.inductionDropOut = true;
    }

    function _getRawStatusOfRating(cm, itemInfo) {
        var userCmRating = _userRatingDict[cm.id] || {};
        var grpRatingObj = _grpRatingDict[cm.rating_type];
        if(_launchMode == 'learner' && grpRatingObj.hideRating) itemInfo.hideItem = true;
        itemInfo.remarks = userCmRating.remarks || '';
        itemInfo.otherRemarks = userCmRating.otherRemarks || '';
        if (!grpRatingObj || !userCmRating || (!('attId' in userCmRating)) || userCmRating.attId === "" || userCmRating.attId === null) {
            itemInfo.score = null;
            itemInfo.rawStatus = 'pending';
            return;
        }
        itemInfo.score = userCmRating.attId;
        if(itemInfo.hideItem) {
            itemInfo.rawStatus = 'success';
        } else {
            itemInfo.rawStatus = (itemInfo.score <= grpRatingObj.lowPassScore) ? 'failed' :
                (itemInfo.score >= grpRatingObj.passScore) ? 'success' : 'partial_success';
        }
        itemInfo.passScore = grpRatingObj.passScore;
        itemInfo.marked = nl.fmt.json2Date(userCmRating.marked || '');
        itemInfo.updated = nl.fmt.json2Date(userCmRating.updated || '');
        itemInfo.rating = _computeRatingStringOnScore(grpRatingObj, itemInfo);
        itemInfo.ratingString = (grpRatingObj.type == 'select');
        _ctx.unlockNext[cm.id] = itemInfo.marked;
    }

    function _computeRatingStringOnScore(ratingObj, itemInfo) {
        var score = itemInfo.score;
        if(Object.keys(ratingObj).length == 0) return score;
        if(itemInfo.hideItem && _launchMode == 'learner') return 'Rating provided';
        if(ratingObj.type == 'number') return score;
        if(ratingObj.type == 'select') {
            for(var i=0; i<ratingObj.values.length; i++) {
                var val = ratingObj.values[i];
                if(val.p == score) return val.v;
            }
        }
    }

    function _getRawStatusOfMilestone(cm, itemInfo) {
        var _msKey = 'milestone__'+cm.id;
        var defMilestone = _grpMilestoneDict[cm.milestone_type];
        var repid = report.id;
        var markedMilestone = _milestone[cm.id] || {};
        if('learnersDict' in markedMilestone && markedMilestone.learnersDict[repid]) {
            var learnerDict = markedMilestone.learnersDict[repid] || {}
            itemInfo.rawStatus = learnerDict.marked == 'done' ? 'success' : 'pending';
            if (itemInfo.rawStatus == 'success' && defMilestone && defMilestone.batch_status) itemInfo.customStatus = defMilestone.batch_status;
            itemInfo.score = itemInfo.rawStatus == 'pending' ? null : 100;
            itemInfo.remarks = learnerDict.remarks || "";
            itemInfo.planned = _msDates[_msKey] || '';
            itemInfo.reached = (learnerDict.reached) ? nl.fmt.json2Date(learnerDict.reached) : "";
            itemInfo.updated = (learnerDict.updated) ? nl.fmt.json2Date(learnerDict.updated) : "";
            if (itemInfo.rawStatus == 'success') _ctx.unlockNext[cm.id] = itemInfo.reached;
            return
        }
        itemInfo.rawStatus = (cm.id in _milestone) && _milestone[cm.id].status == 'done' ?
            'success' : 'pending';
        if (itemInfo.rawStatus == 'success' && defMilestone && defMilestone.batch_status) itemInfo.customStatus = defMilestone.batch_status;
        itemInfo.score = itemInfo.rawStatus == 'pending' ? null : 100;
        itemInfo.remarks = (cm.id in _milestone) ? _milestone[cm.id].comment : "";
        itemInfo.planned = _msDates[_msKey] || '';
        itemInfo.reached = (_milestone[cm.id] && _milestone[cm.id].reached) ? nl.fmt.json2Date(_milestone[cm.id].reached) : "";
        itemInfo.updated = (_milestone[cm.id] && _milestone[cm.id].updated) ? nl.fmt.json2Date(_milestone[cm.id].updated) : "";
        if (itemInfo.rawStatus == 'success') _ctx.unlockNext[cm.id] = itemInfo.reached;
    }

    function _getRawStatusOfGate(cm, itemInfo, itemIdToInfo) {
        var dictAvps = {};
        for(var key in itemIdToInfo) dictAvps[key] = itemIdToInfo[key].score; 
		var payload = {strExpression: cm.gateFormula, dictAvps: dictAvps};
        nlExpressionProcessor.process(payload);
        itemInfo.score = payload.error ? null : payload.result;
        if (itemInfo.score) itemInfo.score = Math.round(itemInfo.score);
        if (!itemInfo.score && itemInfo.score !== null) itemInfo.score = 0;
        if (itemInfo.score === true) itemInfo.score = 100;
        itemInfo.rawStatus = itemInfo.score >= cm.gatePassscore ? 'success' : 'failed';
        if (itemInfo.rawStatus == 'failed' && payload.inputNotDefined) itemInfo.rawStatus = 'pending';
        if (itemInfo.rawStatus != 'pending') {
            var saDict = payload.formula_used_vars;
            var start_after =[];
            for(var cmid in saDict) start_after.push({module: cmid});
            var isAndCondition = true;
            _ctx.unlockNext[cm.id] = _findUnlockedTime(start_after, itemIdToInfo, isAndCondition);
        }
        itemInfo.passScore = cm.gatePassscore;
    }

    function _updateStatusToWaitingIfNeeded(cm, itemInfo, itemIdToInfo) {
        itemInfo.origScore = itemInfo.score;
        //This is to check if no dependancy is set for certificate show in locked state
        if (cm.type == 'certificate' && (!cm.start_after || cm.start_after.length == 0)) {
            itemInfo.status = 'waiting';
            itemInfo.score = null;
            itemInfo.prereqPending = true;
            return;
        }
        var today = new Date();
        if ((repcontent.content || {}).planning && cm.start_date && cm.start_date > today) {
            itemInfo.status = 'waiting';
            itemInfo.score = null;
            return;
        }
 
        var prereqs = cm.start_after || [];
        var condCnt = 0;
        var failCnt = 0;
        var pendCnt = 0;

        // We need to go through all elements in list to calculate pendCnt
        for(var i=0; i<prereqs.length; i++){
            var p = prereqs[i];
            var preItem = itemIdToInfo[p.module] || null;
            if (!preItem) continue;
            condCnt++;
            if (!_isEndItemState(preItem.status)) {
                if(preItem.isModuleCompleted == 'success') continue;
                pendCnt++;
                continue;
            }

            var isConditionFailed = false;
            if (p.iltCondition == 'marked') {
                if (!_isEndItemState(preItem.status)) isConditionFailed = true;
            } else if (p.iltCondition == 'attended') {
                if (preItem.status == 'failed') isConditionFailed = true;
            } else if (p.iltCondition == 'not_attended') {
                if (preItem.status != 'failed') isConditionFailed = true;
            } else if (p.min_score && preItem.score < p.min_score) {
                isConditionFailed = true;
            } else if (p.max_score && preItem.score >= p.max_score) {
                isConditionFailed = true;
            }
            if (preItem.type == "iltsession" && isConditionFailed) {
                var asdSessions = itemIdToInfo.asdAddedSessions[p.module] || [];
                var condPassedInAsd = false;
                for (var j=0; j<asdSessions.length; j++) {
                    preItem = asdSessions[j];
                    if (p.iltCondition == 'marked') {
                        if (_isEndItemState(preItem.status))  condPassedInAsd = true;
                    } else if (p.iltCondition == 'attended') {
                        if (preItem.status == 'success') condPassedInAsd = true;
                    } else if (p.iltCondition == 'not_attended') {
                        if (preItem.status != 'success') condPassedInAsd = true;
                    }
                    if (condPassedInAsd) {
                        isConditionFailed = false;
                        break;
                    }
                }    
            }
            if (isConditionFailed) failCnt++;
        }

        if (condCnt == 0) return;
        var errCnt = failCnt + pendCnt;
        var isAndCondition = (cm.dependencyType == 'all');
        if ((isAndCondition && errCnt == 0) || (!isAndCondition && errCnt < condCnt)) return;
        if (pendCnt > 0) itemInfo.prereqPending = true;
        itemInfo.status = 'waiting';
        itemInfo.score = null;
    }

    function _updateUnlockedTimeStamp(cm, itemInfo, itemIdToInfo) {
        if(itemInfo.status == 'waiting') {
            delete _ctx.unlockNext[cm.id];
            return;
        }
        var isAndCondition = (cm.dependencyType == 'all');
        if(!cm.start_after || cm.start_after.length == 0) {
            itemInfo.unlockedOn = _fromDate;
            return;
        }
        var unlockedTime = _findUnlockedTime(cm.start_after, itemIdToInfo, isAndCondition);
        if (unlockedTime) itemInfo.unlockedOn = unlockedTime;
        var minUnlockedTime = itemInfo.started || _ctx.unlockNext[cm.id] || null;
        if (minUnlockedTime && minUnlockedTime < itemInfo.unlockedOn) itemInfo.unlockedOn = minUnlockedTime;
        if (cm.type === 'gate' || cm.type === 'certificate' ) {
            itemInfo.updated = itemInfo.unlockedOn;
            _ctx.unlockNext[cm.id] = itemInfo.unlockedOn;
        }
    }

    function _findUnlockedTime(start_after, itemIdToInfo, isAndCondition) {
        var unlockedTime = null;
        for(var i=0; i<start_after.length; i++) {
            var p = start_after[i];
            var preItem = itemIdToInfo[p.module] || null;
            var preUnlockedTime = _ctx.unlockNext[p.module];
            if (!preItem || !preUnlockedTime) continue;
            if (!unlockedTime) {
                unlockedTime = preUnlockedTime;
                continue;
            }
            if (isAndCondition && preUnlockedTime > unlockedTime) unlockedTime = preUnlockedTime;
            if (!isAndCondition && preUnlockedTime < unlockedTime) unlockedTime = preUnlockedTime;
        }
        return unlockedTime;
    }

    function _updateStatusToDelayedIfNeeded(cm, itemInfo) {
        var now = _isEndItemState(itemInfo.status) ? itemInfo.updated : new Date();
        if (!now) return;
        var dueDate = new Date();

        if (cm.type == 'milestone') {
            var msid = 'milestone_' + cm.id;
            if (msid in _msDates) dueDate = _msDates[msid];
        } else if (((_course.content || {}).planning || (repcontent.content || {}).planning) && cm.planned_date) {
            dueDate = cm.planned_date;
        }
        if (dueDate) dueDate = new Date(dueDate);
        if (now) now = new Date(now);
        dueDate = dueDate.getTime();
        now = now.getTime();
        if(dueDate === now || dueDate > now) return;
        itemInfo.delayDays = 1.0*(now - dueDate)/1000.0/3600.0/24;
        if (itemInfo.status == 'pending') itemInfo.status = 'delayed';
    }

    function _updateStatistics(itemInfo, cm, ret) {
        var isEnded = _isEndItemState(itemInfo.status);
        if (isEnded) ret.nCompletedItems++;
        else if (itemInfo.status == 'waiting') ret.nlockedcnt++;
        else if (itemInfo.status == 'delayed') ret.ndelayedcnt++;
        _updateStatisticsOfQuiz(itemInfo, cm, ret, isEnded);
        _updateStatisticsOfTimeSpent(itemInfo, ret);
    }

    function _updateStatisticsOfQuiz(itemInfo, cm, ret, isEnded) {
        if (itemInfo.type != 'lesson' || itemInfo.selfLearningMode || !itemInfo.maxScore) return;
        if (cm.exclude_quiz) return;
        ret.nQuizes++;
        if (itemInfo.nAttempts) ret.nQuizAttempts += itemInfo.nAttempts;
        if (!isEnded) return;
        if (itemInfo.status == 'failed') ret.nFailedQuizes++;
        else ret.nPassedQuizes++;
        ret.nTotalQuizScore += itemInfo.rawScore;
        ret.nTotalQuizMaxScore += itemInfo.maxScore;
    }

    function _updateStatisticsOfTimeSpent(itemInfo, ret) {
        if (itemInfo.type == 'lesson') ret.onlineTimeSpentSeconds += (itemInfo.timeSpentSeconds || 0);
        if (itemInfo.type == 'iltsession') {
            ret.iltTimeSpent += (itemInfo.iltTimeSpent || 0);
            ret.iltTotalTime += (itemInfo.iltTotalTime || 0);
        }
    }

    function _updateCustomStatus(itemInfo, latestCustomStatus) {
        itemInfo.customStatus = itemInfo.customStatus || latestCustomStatus;
        return itemInfo.customStatus;
    }

    function _checkAndUpdateRecordStatus(ret) {
        var firstMilestoneItem = _getFirstMilestoneElem();
        if (!firstMilestoneItem) return;
        var groupMsObj = _grpMilestoneDict[firstMilestoneItem.milestone_type];
        if (groupMsObj && groupMsObj.batch_status) ret.status = groupMsObj.batch_status;
    }

    function _getFirstMilestoneElem() {
        for (var i=0; i<_modules.length; i++) {
            if (_modules[i].type == 'milestone') return _modules[i];
        }    
        return null;
    }

    function _updateCourseLevelStatus(ret, isAttrition, defaultCourseStatus) {
        if (isAttrition || (defaultCourseStatus == 'pending')) {
            ret.status = defaultCourseStatus;
            if (defaultCourseStatus == 'pending') _checkAndUpdateRecordStatus(ret, defaultCourseStatus);
            return; 
        }
        var cm = _modules[_modules.length -1];
        var itemInfo = ret.itemIdToInfo[cm.id];
        if (itemInfo.status == 'success' || itemInfo.status == 'partial_success') {
            ret.status = cm.type == 'certificate' ? 'certified' : 
                'passScore' in itemInfo ? 'passed' : 'done';
            if (ret.status == 'certified') ret.isCertified = true;
        } else if (itemInfo.status == 'failed') {
            ret.status = 'failed';
        } else if (itemInfo.status == 'waiting' && !itemInfo.prereqPending) {
            ret.status = 'failed';
        } else {
            ret.status = defaultCourseStatus;
        }
        if (!_isNHT) return; 
        if (defaultCourseStatus == 'started') {
            _checkAndUpdateRecordStatus(ret, defaultCourseStatus);
            return;
        }
        if (cm.type != 'certificate' && itemInfo.status == 'waiting') 
            ret.status = defaultCourseStatus;
        return;
        
        var etmUserStates = groupinfo.etmUserStates;
        var lastItem = etmUserStates[etmUserStates.length - 1];
        var tenures = lastItem.tenures || [];
        var diff = (new Date() - itemInfo.unlockedOn)/(24*60*60*1000);
        for(var i=0; i<tenures.length; i++) {
            var tenure = tenures[i];
            if (tenure.after < diff) ret.status = tenure.id;
        }
    }

    function _updateCourseDelayForLMS(ret) {
        ret.delayDays = 0;
        _updateCourseDelay(ret);
    }

    function _updateCourseDelay(ret) {
        var lastUpdated = null;
        for(var i=0; i<_modules.length; i++) {
            var cm = _modules[i];
            var itemInfo = ret.itemIdToInfo[cm.id];
            if (!itemInfo.updated) continue;
            if (!lastUpdated || itemInfo.updated > lastUpdated) {
                lastUpdated = itemInfo.updated;
            }
        }
        if (!lastUpdated) return;
        var courseEndTime = (courseAssign || {}).not_after ||  report.not_after || null;
        if (!courseEndTime || courseEndTime >= lastUpdated) return;
        ret.delayDays = 1.0*(lastUpdated - courseEndTime)/1000.0/3600.0/24;
    }
}

//-------------------------------------------------------------------------------------------------
function AsdModules() {
    this.getAsdUpdatedModules = function(modules, attendance) {
        if(!attendance) return modules;
        var _sessionInfos = attendance.sessionInfos || null;
        if (!_sessionInfos) return modules;
        var asdAddedModules = [];
        _addAsdItems(asdAddedModules, _sessionInfos['_root'], null);
        for(var i=0; i<modules.length; i++) {
            var cm = modules[i];
            asdAddedModules.push(cm);
            if (cm.type != 'iltsession') continue;
            cm.sessiondate = _sessionInfos && _sessionInfos[cm.id] ? _sessionInfos[cm.id].sessiondate : null;
            cm.shiftHrs = _sessionInfos && _sessionInfos[cm.id] ? _sessionInfos[cm.id].shiftHrs : null;
            cm.shiftMins = _sessionInfos && _sessionInfos[cm.id] ? _sessionInfos[cm.id].shiftMins : null;
            cm.shiftEnd = _sessionInfos && _sessionInfos[cm.id] ? _sessionInfos[cm.id].shiftEnd : null;
            _addAsdItems(asdAddedModules, _sessionInfos[cm.id], cm);
        }
        return asdAddedModules;
    };

    this.getAsdItem = function(asdItemFromDb, parentFixedSession) {
        return _getAsdItem(asdItemFromDb, parentFixedSession);
    };

    function _addAsdItems(modules, asdList, parentFixedSession) {
        if (!asdList || !asdList.asd) return;
        if (parentFixedSession) parentFixedSession.asdChildren = [];
        var asd = asdList.asd;
        for(var i=0; i<asd.length; i++) {
            var item = _getAsdItem(asd[i], parentFixedSession);
            modules.push(item);
        }
    }

    function _getAsdItem(asdItemFromDb, parentFixedSession) {
        var item = angular.copy(asdItemFromDb);
        item.type = 'iltsession';
        item.asdSession = true;
        item.name = _getItemName(item);
        item.iltduration = parentFixedSession ? parentFixedSession.iltduration : 480;
        item.parentId = parentFixedSession ? parentFixedSession.parentId : '_root';
        item.parentFixedSessionId = parentFixedSession ? parentFixedSession.id : '_root';
        item.hide_locked = parentFixedSession ? parentFixedSession.hide_locked : false;
        if (parentFixedSession && parentFixedSession.start_after)
            item.start_after = angular.copy(parentFixedSession.start_after);
        item.sessiondate = item.sessiondate || null;
        item.shiftHrs = item.shiftHrs || null;
        item.shiftMins = item.shiftMins || null;
        item.shiftEnd = item.shiftEnd || null;
        if(parentFixedSession) parentFixedSession.asdChildren.push(item);
        return item;
    }
}
//-------------------------------------------------------------------------------------------------
function _getItemName(cm) {
    if (!cm.asdSession) return cm.name || cm.id;
    if(!('reason' in cm)) return cm.name;
    return cm.reason.name + (cm.remarks ? ': ' + cm.remarks : '');
}

function _isCertificate(cm) {
    return (cm.type == 'certificate' ||
        (cm.type == 'link' && (cm.urlParams|| '').indexOf('course_cert') >= 0));
}

function _isEndItemState(status) {
    return status == 'failed' || status == 'success' || status == 'partial_success' || status.indexOf('attrition') == 0;
}

function _isEndCourseState(courseStatusObj, attritionIsEndState) {
    var status = courseStatusObj.status;
    if (attritionIsEndState && status.indexOf('attrition') == 0) return true;
    return courseStatusObj.isCertified || status == 'failed' || status == 'certified' || status == 'passed' || status == 'done';
}

function _getFeedbackScoreForModule(feedback) {
    if(!feedback || feedback.length == 0) return '';
    var score = 0;
    for(var i=0; i<feedback.length; i++) {
        score += feedback[i];
    }
    return (score/feedback.length);
}

function _getFeedbackScoreForCourse(reports) {
    var feedbackScore = 0;
    var nfeedbacks = 0;
    for(var id in reports) {
        var feedbackArray = reports[id].feedbackScore || [];
        if(feedbackArray.length == 0) continue;
        var feedback = _getFeedbackScoreForModule(feedbackArray);
        if(feedback) {
            feedbackScore += feedback;
            nfeedbacks += 1;
        }
    }
    if(nfeedbacks && feedbackScore) 
        return (feedbackScore/nfeedbacks);
    else 
        return '';
};

//-------------------------------------------------------------------------------------------------
module_init();
})();

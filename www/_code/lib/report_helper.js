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

    this.getCourseStatusHelper = function(report, groupinfo, courseAssign, course) {
        return new CourseStatusHelper(nl, nlCourse, nlExpressionProcessor, false, report, groupinfo, courseAssign, course, 'trainer');
    };
    this.getCourseStatusHelperForCourseView = function(report, groupinfo, isLearnerMode) {
        return new CourseStatusHelper(nl, nlCourse, nlExpressionProcessor, true, report, groupinfo, null, null, isLearnerMode ? 'learner' : 'trainer');
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

function CourseStatusHelper(nl, nlCourse, nlExpressionProcessor, isCourseView, report, groupinfo, courseAssign, course, launchMode) {
    if (!report) report = {};
    _processCourseRecord(course);

    //--------------------------------------------------------------------------------
    // Public interfaces
    this.getCourseStatus = function() {
        _init();
        return _getCourseStatus();
    };

    //--------------------------------------------------------------------------------
    // Implementation
    var _launchMode = launchMode;
    var repcontent = isCourseView ? report : angular.fromJson(report.content);
    var _statusinfo = repcontent.statusinfo || {};
    var _lessonReports = repcontent.lessonReports || {};
    var _pastLessonReports = repcontent.pastLessonReports || {};
    var _modifiedILT = ((courseAssign ? courseAssign.info : repcontent) || {}).modifiedILT || {};
    var _msDates = courseAssign && courseAssign.info && courseAssign.info.msDates ? courseAssign.info.msDates : {};

    for (var key in _msDates) {
        var d = _msDates[key];
        _msDates[key] = nl.fmt.json2Date(d);
    }
 
    var _modules = ((course || repcontent || {}).content || {}).modules || []; 
    var _fromDate = (courseAssign || {}).not_before ||  report.not_before || report.created;
    if (_fromDate) _fromDate = nl.fmt.json2Date(_fromDate);
    var _userAttendanceDict = {};
    var _userRatingDict = {};
    var _grpAttendanceDict = {};
    var _grpRatingDict = {};
    var _milestone = {};

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
        _grpRatingDict = _arrayToDict((groupinfo || {}).ratings);
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

    function _getCourseStatus() {
        var ret = {status: 'pending', progPerc: 0, progDesc: '', itemIdToInfo: {}, delayDays: 0,
            nItems: 0, nCompletedItems: 0,
            nQuizes: 0, nQuizAttempts: 0, nPassedQuizes: 0, nFailedQuizes: 0, 
            nTotalQuizScore: 0, nTotalQuizMaxScore: 0,
            onlineTimeSpentSeconds: 0, iltTimeSpent: 0, iltTotalTime: 0,
            feedbackScore: '', customScores: [], attritedAt: null, attritionStr: null,
            isCertified: false
        };

        var itemIdToInfo = ret.itemIdToInfo; // id: {status: , score: , rawStatus: }
        if (_modules.length <= 0) {
            return ret;
        }

        var latestCustomStatus = '';
        var defaultCourseStatus = 'pending';
        var isAttrition = false;
        for(var i=0; i<_modules.length; i++) {
            var cm = _modules[i];
            var itemInfo = {};
            if (cm.isReattempt) ret['reattempt'] = false;
            itemIdToInfo[cm.id] = itemInfo;
            _getRawStatusOfItem(cm, itemInfo, itemIdToInfo);
            itemInfo.status = itemInfo.rawStatus;
            if (isAttrition) {
                itemInfo.status = 'waiting';
                itemInfo.isAttrition = true;
                continue;
            }
            if (cm.isReattempt && itemInfo.rawStatus != 'pending') ret.reattempt = true;
            _updateStatusToWaitingIfNeeded(cm, itemInfo, itemIdToInfo);
            _updateUnlockedTimeStamp(cm, itemInfo, itemIdToInfo);
            _updateStatusToDelayedIfNeeded(cm, itemInfo);
            _updateStatistics(itemInfo, ret);
            latestCustomStatus =  _updateCustomStatus(itemInfo, latestCustomStatus);
            if (itemInfo.isAttrition) {
                isAttrition = true;
                ret.attritedAt = cm.id;
                ret.attritionStr = itemInfo.state;
                itemInfo.status = 'attrition';
                var suffix = itemInfo.customStatus ? '-' +  itemInfo.customStatus : '';
                defaultCourseStatus = 'attrition' + suffix;
            } else  if (itemInfo.status != 'waiting' && cm.type != 'module' && cm.type != 'milestone') {
                if (defaultCourseStatus == 'pending' && itemInfo.status != 'pending' && itemInfo.status != 'delayed') {
                    defaultCourseStatus ='started';
                }
                if (itemInfo.customStatus) defaultCourseStatus = itemInfo.customStatus;
            }
            if (cm.showInReport && _isEndItemState(itemInfo.status))
                ret.customScores.push({name: cm.name, score: itemInfo.score});
        }

        _updateCourseLevelStatus(ret, isAttrition, defaultCourseStatus);
        _updateCourseProgress(ret);
        _updateCourseDelay(ret);
        ret.feedbackScore = _getFeedbackScoreForCourse(_lessonReports);
        ret.feedbackScore = ret.feedbackScore ? '' + Math.round(ret.feedbackScore*10)/10 + '%' : '';
        return ret;
    }

    function _getRawStatusOfItem(cm, itemInfo, itemIdToInfo) {
        itemInfo.type = cm.type;
        itemInfo.name = cm.name;
        itemInfo.customStatus = cm.customStatus || null;
        itemInfo.completionPerc = cm.completionPerc || null;
        if (_isCertificate(cm)) {
            var sinfo = _statusinfo[cm.id] || {};
            itemInfo.rawStatus = 'success';
            itemInfo.updated = _getUpdatedTimestamp(sinfo);
            itemInfo.score = 100;
        } else if (cm.type == 'info' || cm.type == 'link') {
            _getRawStatusOfInfo(cm, itemInfo);
        } else if (cm.type == 'lesson') {
            _getRawStatusOfLesson(cm, itemInfo);
        } else if (cm.type == 'iltsession') {
            _getRawStatusOfIltSession(cm, itemInfo);
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
        itemInfo.selfLearningMode = linfo.selfLearningMode || false;
        if (!linfo.completed) {
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
            itemInfo.moduleRepId = linfo.reportId || null;
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
        itemInfo.score = maxPerc;
        itemInfo.timeSpentSeconds = totalTimeSpent;
        itemInfo.maxScore = _getMaxScore(maxLinfo);
        itemInfo.rawScore = _getRawScore(maxLinfo);
        itemInfo.passScore = parseInt(maxLinfo.passScore || linfo.passScore || 0);
        itemInfo.started = nl.fmt.json2Date(maxLinfo.started || '');
        itemInfo.ended = nl.fmt.json2Date(maxLinfo.ended || '');
        itemInfo.updated = nl.fmt.json2Date(maxLinfo.updated || '');
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
        var userCmAttendance = _userAttendanceDict[cm.id] || {};
        var grpAttendanceObj = _grpAttendanceDict[userCmAttendance.attId];
        cm.iltduration = (cm.id in _modifiedILT) ? _modifiedILT[cm.id] : cm.iltduration;
        if (!userCmAttendance || !grpAttendanceObj) {
            itemInfo.score = null;
            itemInfo.rawStatus = 'pending';
            itemInfo.iltTotalTime = cm.iltduration;
            return;
        }
        itemInfo.score = grpAttendanceObj.timePerc;
        itemInfo.rawStatus = itemInfo.score == 100 ? 'success' : itemInfo.score == 0 ? 'failed' : 'partial_success';
        itemInfo.iltTotalTime = cm.iltduration;
        itemInfo.iltTimeSpent = ((grpAttendanceObj.timePerc/100)*cm.iltduration);
        itemInfo.state = grpAttendanceObj.name;
        itemInfo.stateStr = grpAttendanceObj.id;
        itemInfo.remarks = userCmAttendance.remarks || '';
        itemInfo.marked = nl.fmt.json2Date(userCmAttendance.marked || '');
        itemInfo.updated = nl.fmt.json2Date(userCmAttendance.updated || '');
        if (grpAttendanceObj.isAttrition) itemInfo.isAttrition = true;
    }

    function _getRawStatusOfRating(cm, itemInfo) {
        var userCmRating = _userRatingDict[cm.id] || {};
        var grpRatingObj = _grpRatingDict[cm.rating_type];
        if(_launchMode == 'learner' && grpRatingObj.hideRating) itemInfo.hideItem = true;
        if (!grpRatingObj || !userCmRating || (!('attId' in userCmRating)) || userCmRating.attId === "") {
            itemInfo.score = null;
            itemInfo.rawStatus = 'pending';
            itemInfo.remarks = userCmRating.remarks || '';
            return;
        }
        itemInfo.score = userCmRating.attId;
        if(itemInfo.hideItem) {
            itemInfo.rawStatus = 'success';
            itemInfo.remarks = '';
           
        } else {
            itemInfo.rawStatus = (itemInfo.score <= grpRatingObj.lowPassScore) ? 'failed' :
                (itemInfo.score >= grpRatingObj.passScore) ? 'success' : 'partial_success';
            itemInfo.remarks = userCmRating.remarks || '';
        }
        itemInfo.passScore = grpRatingObj.passScore;
        itemInfo.marked = nl.fmt.json2Date(userCmRating.marked || '');
        itemInfo.updated = nl.fmt.json2Date(userCmRating.updated || '');
        itemInfo.rating = _computeRatingStringOnScore(grpRatingObj, itemInfo);
    }

    function _computeRatingStringOnScore(ratingObj, itemInfo) {
        var score = itemInfo.score;
        if(Object.keys(ratingObj).length == 0) return score;
        if(itemInfo.hideItem) return 'Rating provided';
        if(ratingObj.type == 'number') return score;
        if(ratingObj.type == 'status' || ratingObj.type == 'select') {
            for(var i=0; i<ratingObj.values.length; i++) {
                var val = ratingObj.values[i];
                if(val.p == score) return val.v;
            }
        }
    }

    function _getRawStatusOfMilestone(cm, itemInfo) {
        var _msKey = 'milestone__'+cm.id;
        itemInfo.rawStatus = (cm.id in _milestone) && _milestone[cm.id].status == 'done' ?
            'success' : 'pending';
        itemInfo.score = itemInfo.rawStatus == 'pending' ? null : 100;
        itemInfo.remarks = (cm.id in _milestone) ? _milestone[cm.id].comment : "";
        itemInfo.planned = _msDates[_msKey] || '';
        itemInfo.reached = (_milestone[cm.id] && _milestone[cm.id].reached) ? nl.fmt.json2Date(_milestone[cm.id].reached) : "";
        itemInfo.updated = (_milestone[cm.id] && _milestone[cm.id].updated) ? nl.fmt.json2Date(_milestone[cm.id].updated) : "";

    }

    function _getRawStatusOfGate(cm, itemInfo, itemIdToInfo) {
        var dictAvps = {};
        for(var key in itemIdToInfo) dictAvps[key] = itemIdToInfo[key].score; 
		var payload = {strExpression: cm.gateFormula, dictAvps: dictAvps};
        nlExpressionProcessor.process(payload);
        itemInfo.score = payload.error ? null : payload.result;
        if (!itemInfo.score && itemInfo.score !== null) itemInfo.score = 0;
        if (itemInfo.score === true) itemInfo.score = 100;
        itemInfo.rawStatus = itemInfo.score >= cm.gatePassscore ? 'success' : 'failed';
        if (itemInfo.rawStatus == 'failed' && payload.inputNotDefined) itemInfo.rawStatus = 'pending';
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
            } else if (p.max_score && preItem.score > p.max_score) {
                isConditionFailed = true;
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
        if(itemInfo.status == 'waiting') return;
        var isAndCondition = (cm.dependencyType == 'all');
        if(!cm.start_after || cm.start_after.length == 0) {
            itemInfo.unlockedOn = _fromDate;
            return;
        }
        var unlockedTime = null;
        for(var i=0; i<cm.start_after.length; i++) {
            var p = cm.start_after[i];
            var preItem = itemIdToInfo[p.module] || null;
            if (!preItem || !preItem.updated) continue;
            if (!unlockedTime) {
                unlockedTime = preItem.updated;
                continue;
            }
            if (isAndCondition && preItem.updated > unlockedTime) unlockedTime = preItem.updated;
            if (!isAndCondition && preItem.updated < unlockedTime) unlockedTime = preItem.updated;
        }
        if (unlockedTime) itemInfo.unlockedOn = unlockedTime;
        var minUnlockedTime = itemInfo.started || itemInfo.updated || null;
        if (minUnlockedTime && minUnlockedTime < itemInfo.unlockedOn) itemInfo.unlockedOn = minUnlockedTime;
        if (cm.type === 'gate' || cm.type === 'certificate' ) itemInfo.updated = itemInfo.unlockedOn;
    }

    function _updateStatusToDelayedIfNeeded(cm, itemInfo) {
        var dueDate = new Date();
        var now = _isEndItemState(itemInfo.status) ? itemInfo.updated : new Date();
        if (!now) return;

        if (cm.type == 'milestone') {
            var msid = 'milestone_' + cm.id;
            if (msid in _msDates) dueDate = _msDates[msid];
        } else if ((repcontent.content || {}).planning && cm.planned_date) {
            dueDate = cm.planned_date;
        }
        if(dueDate >= now) return;
        itemInfo.delayDays = 1.0*(now - dueDate)/1000.0/3600.0/24;
        if (itemInfo.status == 'pending') itemInfo.status = 'delayed';
    }

    function _updateStatistics(itemInfo, ret) {
        var isEnded = _isEndItemState(itemInfo.status);
        if (isEnded && itemInfo.completionPerc) ret.progPerc = itemInfo.completionPerc;
        var autoCompletingType = _isAutoCompletingType(itemInfo.type);
        if (!autoCompletingType) ret.nItems++;
        if (!autoCompletingType && isEnded) ret.nCompletedItems++;
        _updateStatisticsOfQuiz(itemInfo, ret, isEnded);
        _updateStatisticsOfTimeSpent(itemInfo, ret);
    }

    function _updateStatisticsOfQuiz(itemInfo, ret, isEnded) {
        if (itemInfo.type != 'lesson' || itemInfo.selfLearningMode || !itemInfo.maxScore) return;
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

    function _updateCourseLevelStatus(ret, isAttrition, defaultCourseStatus) {
        if (isAttrition || (defaultCourseStatus == 'pending')) {
            ret.status = defaultCourseStatus;
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
        if (!groupinfo.etmUserStates || groupinfo.etmUserStates.length === 0) return; 
        if (!_isEndItemState(itemInfo.status)) return;
        if (!itemInfo.unlockedOn) return;
        ret.status = defaultCourseStatus;

        var etmUserStates = groupinfo.etmUserStates;
        var lastItem = etmUserStates[etmUserStates.length - 1];
        var tenures = lastItem.tenures || [];
        var diff = (new Date() - itemInfo.unlockedOn)/(24*60*60*1000);
        for(var i=0; i<tenures.length; i++) {
            var tenure = tenures[i];
            if (tenure.after < diff) ret.status = tenure.id;
        }
   }
 
    function _updateCourseProgress(ret) {
        if (_isEndCourseState(ret)) {
            ret.progPerc = 100;
        } else if (ret.status == 'pending') {
            ret.progPerc = 0;
        } else if (!ret.progPerc && ret.nItems) {
            ret.progPerc = Math.round(100.0*ret.nCompletedItems/ret.nItems);
        } else {
            ret.progPerc = Math.round(ret.progPerc);
        }
        ret.progDesc = nl.fmt2('{} of {} items done', ret.nCompletedItems, ret.nItems);
    }

    function _updateCourseDelay(ret) {
        ret.delayDays = 0;
        if (_isEndCourseState(ret)) {
            _updateCourseDelayForCompleted(ret);
            return;
        }
        for(var i=0; i<_modules.length; i++) {
            var cm = _modules[i];
            var itemInfo = ret.itemIdToInfo[cm.id];
            if (itemInfo.delayDays && itemInfo.delayDays > ret.delayDays)
                ret.delayDays = itemInfo.delayDays;
        }
    }

    function _updateCourseDelayForCompleted(ret) {
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

        var maxCompleteBefore = null;
        for (var key in _msDates) {
            if (!maxCompleteBefore || _msDates[key] > maxCompleteBefore)
                maxCompleteBefore = _msDates[key];
        }
        var courseEndTime = (courseAssign || {}).not_after ||  report.not_after || null;
        if (!courseEndTime && maxCompleteBefore) {
            courseEndTime = maxCompleteBefore;
        }
        if (!courseEndTime || courseEndTime >= lastUpdated) return;
        ret.delayDays = 1.0*(lastUpdated - courseEndTime)/1000.0/3600.0/24;
    }
}

//-------------------------------------------------------------------------------------------------
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

function _isAutoCompletingType(itemType) {
    return (itemType == 'certificate' || itemType == 'gate' || itemType == 'module');
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

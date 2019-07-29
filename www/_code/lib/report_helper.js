(function() {

//-------------------------------------------------------------------------------------------------
// report_helper.js:
// Common code to process db.report record is placed here. This is used in learning_reports, 
// learner_view and course_view for status computation and processing the content of report
// records.
// To begin with the status computation of course reports are available here.
//
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.report_helper', [])
    .service('nlReportHelper', NlReportHelper);
}

//-------------------------------------------------------------------------------------------------
var NlReportHelper = ['nl', 'nlCourse', 'nlExpressionProcessor',
function(nl, nlCourse, nlExpressionProcessor) {
    this.getCourseStatusHelper = function(report, groupinfo, courseAssign, course) {
        return new CourseStatusHelper(nl, nlCourse, nlExpressionProcessor, false, report, groupinfo, courseAssign, course);
    };
    this.getCourseStatusHelperForCourseView = function(report, groupinfo) {
        return new CourseStatusHelper(nl, nlCourse, nlExpressionProcessor, true, report, groupinfo, null, null);
    };
}];

function CourseStatusHelper(nl, nlCourse, nlExpressionProcessor, isCourseView, report, groupinfo, courseAssign, course) {
    if (!report) report = {};

    //--------------------------------------------------------------------------------
    // Public interfaces
    this.getCourseStatus = function() {
        _init();
        return _getCourseStatus();
    };

    //--------------------------------------------------------------------------------
    // Implementation
    var repcontent = isCourseView ? report : angular.fromJson(report.content);
    var _statusinfo = repcontent.statusinfo || {};
    var _lessonReports = repcontent.lessonReports || {};
    var _pastLessonReports = repcontent.pastLessonReports || {};
    var _modifiedILT = ((isCourseView ? repcontent : (courseAssign || {}).info) || {}).modifiedILT || {};
 
    var _modules = ((course || courseAssign || repcontent || {}).content || {}).modules || []; 
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

    function _getCourseStatus() {
        var ret = {status: 'pending', percProgress: 0, itemIdToInfo: {}, delayDays: 0};
        var itemIdToInfo = ret.itemIdToInfo; // id: {status: , score: , rawStatus: }
        var startedCount = 0;
        if (_modules.length <= 0) {
            return ret;
        }

        var latestCustomStatus = '';
        var defaultCourseStatus = 'pending';
        var isAttrition = false;
        var percProgress = 0;
        for(var i=0; i<_modules.length; i++) {
            var cm = _modules[i];
            var itemInfo = {};
            itemIdToInfo[cm.id] = itemInfo;
            _getRawStatusOfItem(cm, itemInfo, itemIdToInfo);
            itemInfo.status = itemInfo.rawStatus;
            if (isAttrition) {
                itemInfo.status = 'waiting';
                continue;
            }
            _updateStatusToWaitingIfNeeded(cm, itemInfo, itemIdToInfo);
            _updateStatusToDelayedIfNeeded(cm, itemInfo, itemIdToInfo, ret);
            latestCustomStatus =  _updateCustomStatus(itemInfo, latestCustomStatus);
            if (itemInfo.isAttrition) {
                isAttrition = true;
                itemInfo.status = 'Attrition';
                var suffix = itemInfo.customStatus ? '-' +  itemInfo.customStatus : '';
                defaultCourseStatus = 'Attrition' + suffix;
            } else  if (_isStartedState(itemInfo.status)) {
                defaultCourseStatus = itemInfo.customStatus || 'started';
            }
            console.log(nl.fmt2('TODO-NOW: name={}, status={}, cust-status={}, score={}, dcs={}', cm.name, itemInfo.status, itemInfo.customStatus, itemInfo.score, defaultCourseStatus));
        }

        _updateCourseLevelStatus(ret, isAttrition, defaultCourseStatus);
        console.log(nl.fmt2('TODO-NOW: course-status={}, percProgress={}', ret.status, ret.percProgress));
        return ret;
    }

    function _getRawStatusOfItem(cm, itemInfo, itemIdToInfo) {
        itemInfo.customStatus = cm.customStatus || null;
        itemInfo.completionPerc = cm.completionPerc || null;
        if (_isCertificate(cm)) {
            itemInfo.rawStatus = 'success';
            itemInfo.score = 100;
        } else if (cm.type == 'info' || cm.type == 'link') {
            var sinfo = _statusinfo[cm.id] || {};
            itemInfo.rawStatus = sinfo.status == 'done' ? 'success' : 'pending';
            itemInfo.score = itemInfo.rawStatus == 'success' ? 100 : null;
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

    function _getRawStatusOfLesson(cm, itemInfo) {
        var linfo = _lessonReports[cm.id] || null;
        itemInfo.selfLearningMode = false;
        if (linfo === null) {
            itemInfo.rawStatus = 'pending';
            itemInfo.score = null;
            return;
        }
        itemInfo.nAttempts = linfo.attempt || null;
        if (!linfo.completed) {
            itemInfo.rawStatus = 'started';
            itemInfo.score = null;
            itemInfo.timeSpentSeconds = linfo.timeSpentSeconds || 0;
            itemInfo.selfLearningMode = linfo.selfLearningMode || false;
            return;
        }
        if (linfo.selfLearningMode) {
            itemInfo.rawStatus = 'success';
            itemInfo.score = 100;
            itemInfo.timeSpentSeconds = linfo.timeSpentSeconds || 0;
            itemInfo.selfLearningMode = true;
            itemInfo.started = linfo.started || null;
            itemInfo.ended = linfo.ended || null;
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
        itemInfo.passScore = parseInt(linfo.passScore || 0);
        itemInfo.started = maxLinfo.started || null;
        itemInfo.ended = maxLinfo.ended || null;
        itemInfo.rawStatus = (itemInfo.score >= itemInfo.passScore) ? 'success' : 'failed';
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
        return 100.0*linfoItem.score/linfoItem.maxScore;
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
        itemInfo.started = nl.fmt.json2Date(userCmAttendance.update || '');
        itemInfo.updated = nl.fmt.json2Date(userCmAttendance.updated || '');
        if (grpAttendanceObj.isAttrition) itemInfo.isAttrition = true;
    }

    function _getRawStatusOfRating(cm, itemInfo) {
        var userCmRating = _userRatingDict[cm.id] || {};
        var grpRatingObj = _grpRatingDict[cm.rating_type];
        if (!grpRatingObj || !userCmRating || (!userCmRating.attId && userCmRating.attId != 0)) {
            itemInfo.score = null;
            itemInfo.rawStatus = 'pending';
            return;
        }
        itemInfo.score = userCmRating.attId || 0;
        itemInfo.rawStatus = (itemInfo.score <= grpRatingObj.lowPassScore) ? 'failed' :
            (itemInfo.score >= grpRatingObj.passScore) ? 'success' : 'partial_success';
        itemInfo.passScore = grpRatingObj.passScore;
        itemInfo.remarks = userCmRating.remarks || '';
        itemInfo.started = nl.fmt.json2Date(userCmRating.update || '');
        itemInfo.updated = nl.fmt.json2Date(userCmRating.updated || '');
        itemInfo.stateStr = _setStatusOfRatingItem(grpRatingObj, userCmRating.attId)
        itemInfo.rating = _computeRatingStringOnScore(grpRatingObj, itemInfo.score);
    }

    function _computeRatingStringOnScore(ratingObj, score) {
        if(Object.keys(ratingObj).length == 0) return score;
        if(ratingObj.type == 'number') return score;
        if(ratingObj.type == 'status' || ratingObj.type == 'select') {
            for(var i=0; i<ratingObj.values.length; i++) {
                var val = ratingObj.values[i];
                if(val.p == score) return val.v;
            }
        }
    }

    function _setStatusOfRatingItem(selectedRating, ratingScore) {
        if(ratingScore <= selectedRating.lowPassScore)
            return 'failed';
        else if(selectedRating.lowPassScore < ratingScore && ratingScore < selectedRating.passScore)
            return 'partial_success';
        else 
            return 'completed';
    }

    function _getRawStatusOfMilestone(cm, itemInfo) {
        itemInfo.rawStatus = (cm.id in _milestone) && _milestone[cm.id].status == 'done' ?
            'success' : 'pending';
        itemInfo.score = itemInfo.rawStatus == 'pending' ? null : 100;
        itemInfo.completionPerc = cm.completionPerc;
        itemInfo.remarks = (cm.id in _milestone) ? _milestone[cm.id].comment : "";
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
        itemInfo.passScore = cm.gatePassscore;
    }

    function _updateStatusToWaitingIfNeeded(cm, itemInfo, itemIdToInfo) {
        itemInfo.origScore = itemInfo.score;
        var today = new Date();
        if (repcontent.planning && cm.start_date && cm.start_date > today) {
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
            if (!_isEndState(preItem.status)) {
                pendCnt++;
                continue;
            }

            var isConditionFailed = false;
            if (p.iltCondition == 'marked') {
                if (!_isEndState(p.status)) isConditionFailed = true;
            } else if (p.iltCondition == 'attended') {
                if (p.status == 'failed') isConditionFailed = true;
            } else if (p.iltCondition == 'not_attended') {
                if (p.status != 'failed') isConditionFailed = true;
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

    function _updateStatusToDelayedIfNeeded(cm, itemInfo, itemIdToInfo, ret) {
        if (_isEndState(itemInfo.status)) return;
        var dueDate = new Date();
        var now = new Date();
        if (cm.complete_before && _fromDate) {
            var complete_before = parseInt(cm.complete_before);
            dueDate.setDate(_fromDate.getDate() + complete_before);
        } else if (repcontent.planning && cm.planned_date) {
            dueDate = cm.planned_date;
        }
        if(dueDate >= now) return;
        itemInfo.delayDays = 1.0*(now - dueDate)/1000.0/3600.0/24;
        if (ret.delayDays < itemInfo.delayDays) ret.delayDays = itemInfo.delayDays;
        if (itemInfo.status == 'pending') itemInfo.status = 'delayed';
    }

    function _updateCustomStatus(itemInfo, latestCustomStatus) {
        itemInfo.customStatus = itemInfo.customStatus || latestCustomStatus;
        return itemInfo.customStatus;
    }

    function _updateCourseLevelStatus(ret, isAttrition, defaultCourseStatus) {
        if (isAttrition) return defaultCourseStatus;
        var cm = _modules[_modules.length -1];
        var itemInfo = ret.itemIdToInfo[cm.id];
        if (itemInfo.status == 'success') {
            ret.status = cm.type == 'certificate' ? 'certified' : 
                'passScore' in itemInfo ? 'passed' : 'done';
        } else if (itemInfo.status == 'failed' || itemInfo.status == 'partial_success') {
            ret.status = 'failed';
        } else if (itemInfo.status == 'waiting' && !itemInfo.prereqPending) {
            ret.status = 'failed';
        } else {
            ret.status = defaultCourseStatus;
        }
   }
 
    function _isCertificate(cm) {
        return (cm.type == 'certificate' ||
            (cm.type == 'link' && (cm.urlParams|| '').indexOf('course_cert') >= 0));
    }

    function _isEndState(status) {
        return status == 'failed' || status == 'success' || status == 'partial_success' || status.indexOf('Attrition') == 0;
    }

    function _isStartedState(status) {
        return status == 'started' || _isEndState(status);
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

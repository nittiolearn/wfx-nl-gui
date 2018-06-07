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
var NlLrReportRecords = ['nl', 'nlGroupInfo', 'nlLrHelper', 'nlLrCourseRecords',
function(nl, nlGroupInfo, nlLrHelper, nlLrCourseRecords) {
    var self = this;
    
    var _records = {};
    var _summaryStats = null;
    this.init = function(summaryStats) {
    	_records = {};
    	_summaryStats = summaryStats;
    };
    
    this.addRecord = function(report) {
    	report = _process(report);
        if (!report) return null;
        var rid = report.raw_record.id;
        if (rid in _records)
            _summaryStats.removeFromStats(_records[rid]);
        _records[rid] = report;
        _summaryStats.addToStats(report);
        return report;
	};
      
    this.removeRecord = function(repid) {
        if (repid in _records)
            _summaryStats.removeFromStats(_records[repid]);
        delete _records[repid];
	};

    this.reset = function() {
    	_records = {};
    	_summaryStats.reset();
    };
    
    this.getRecords = function() {
    	return _records;
    };

    this.asList = function() {
        var ret = nlLrHelper.dictToList(_records);
        ret.sort(function(a, b) {
            return (b.stats.status.id - a.stats.status.id);
        });
        return ret;
    };
    
    function _process(report) {
        var user = nlGroupInfo.getUserObj(''+report.student);
        if (!user) return null; // TODO-LATER-123: should not do this

        var repcontent = angular.fromJson(report.content); 
        var course = nlLrCourseRecords.getRecord(report.lesson_id);
        if (!course) course = nlLrCourseRecords.getCourseInfoFromReport(report, repcontent);

        var stats = {nLessons: 0, nLessonsPassed: 0, nLessonsFailed: 0, nQuiz: 0,
            timeSpentSeconds: 0, nAttempts: 0, nLessonsAttempted: 0, nScore: 0, nMaxScore: 0,
            internalIdentifier:report.id, nCerts: course.certificates.length};
            
        var statusinfo = repcontent.statusinfo || {};
        var items = course.nonLessons;
        stats.nOthers = items.length;
        stats.nOthersDone = 0;
        for (var i=0; i<items.length; i++) {
            var cid = items[i];
            var sinfo = statusinfo[cid];
            if (sinfo && sinfo.status == 'done') stats.nOthersDone++;
        }

        var lessons = course.lessons;
        var lessonReps = repcontent.lessonReports || {};
        for (var i=0; i<lessons.length; i++) {
            stats.nLessons++;
            var lid = lessons[i].id;
            var rep = lessonReps[lid];
            if (!rep) continue;
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
        var weightedProgressMax = stats.nLessons*10 + stats.nOthers;
        var weightedProgress = stats.nLessonsDone*10 + stats.nOthersDone;
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

        stats.timeSpentStr = Math.ceil(stats.timeSpentSeconds/60);
        stats.timeSpentStr = stats.timeSpentStr > 1 ? stats.timeSpentStr + ' minutes' 
            : stats.timeSpentStr == 1 ? stats.timeSpentStr + ' minute' : '';

        stats.status = nlLrHelper.statusInfos[_getStatusId(stats)];
        var ret = {raw_record: report, repcontent: repcontent, course: course, user: user,
            usermd: nlLrHelper.getMetadataDict(user), stats: stats,
            created: nl.fmt.fmtDateDelta(report.created, null, 'date'), 
            updated: nl.fmt.fmtDateDelta(report.updated, null, 'date')};
        return ret;
    }
    
    function _getStatusId(stats) {
        if (stats.percComplete == 0) return nlLrHelper.STATUS_PENDING;
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

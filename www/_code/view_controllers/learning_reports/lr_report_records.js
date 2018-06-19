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
var NlLrReportRecords = ['nl', 'nlDlg', 'nlGroupInfo', 'nlLrHelper', 'nlLrCourseRecords',
function(nl, nlDlg, nlGroupInfo, nlLrHelper, nlLrCourseRecords) {
    var self = this;
    
    var _records = {};
    var _summaryStats = null;
    var _dates = {};
    var _pastUserData = null;
    var _pastUserDataFetchInitiated = false;
    var _postProcessRecords = [];
    this.init = function(summaryStats) {
    	_records = {};
    	_dates = {minUpdated: null, maxUpdated: null};
    	_summaryStats = summaryStats;
    	if (!nlGroupInfo.isPastUserXlsConfigured()) _pastUserData = {};
    };
    
    this.addRecord = function(report) {
    	report = _process(report);
        if (!report) return null;
        var rid = report.raw_record.id;
        if (rid in _records)
            _summaryStats.removeFromStats(_records[rid]);
        _records[rid] = report;
        _summaryStats.addToStats(report);
        if (!_dates.minUpdated || _dates.minUpdated > report.raw_record.updated) _dates.minUpdated = report.raw_record.updated;
        if (!_dates.maxUpdated || _dates.maxUpdated < report.raw_record.updated) _dates.maxUpdated = report.raw_record.updated;
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
    
    this.getTimeRanges = function(maxBuckets) {
    	if (!maxBuckets) maxBuckets = 8;
        if (!_dates.minUpdated || !_dates.maxUpdated) return [];

        var day = 24*60*60*1000; // 1 day in ms
        var now = new Date();
        var offset = now.getTimezoneOffset()*60*1000; // in ms
        var start = Math.floor((_dates.minUpdated.getTime()-offset)/day)*day + offset; // Today 00:00 Hrs in local time
        var end = Math.ceil((_dates.maxUpdated.getTime()-offset)/day)*day + offset; // Tomorrow 00:00 Hrs in local time
        
        var rangeSize = Math.ceil((end - start)/day/maxBuckets);
        var multiDays = (rangeSize > 1);
        rangeSize *= day;
        var nRanges = Math.ceil((end-start)/rangeSize) + 2;
        
        var ranges = [];
        var nextStartTime = new Date(start - rangeSize);
        for(var i=0; i<nRanges; i++) {
            var range = {start: nextStartTime, end: new Date(nextStartTime.getTime() + rangeSize),
                count: 0};
            var s = nl.fmt.fmtDateDelta(range.start, null, 'date-mini');
            var e = nl.fmt.fmtDateDelta(range.end, null, 'date-mini');
            range.label = multiDays ? nl.fmt2('{} - {}', s, e) : s;
            nextStartTime = range.end;
            ranges.push(range);
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

    function _process(report) {
        var user = nlGroupInfo.getUserObj(''+report.student);
        if (!user && !_pastUserData) {
        	_postProcessRecords.push(report);
        	return null;
        }
        var repcontent = angular.fromJson(report.content); 
        if (!user) user = _pastUserData[repcontent.studentname];
        if (!user) user = nlGroupInfo.getDefaultUser(repcontent.studentname || '');

        var course = nlLrCourseRecords.getRecord(report.lesson_id);
        if (!course) course = nlLrCourseRecords.getCourseInfoFromReport(report, repcontent);

        var stats = {nLessons: 0, nLessonsPassed: 0, nLessonsFailed: 0, nQuiz: 0,
            timeSpentSeconds: 0, nAttempts: 0, nLessonsAttempted: 0, nScore: 0, nMaxScore: 0,
            internalIdentifier:report.id, nCerts: course.certificates.length};
            
        var started = false;
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
        var lessonReps = repcontent.lessonReports || {};
        for (var i=0; i<lessons.length; i++) {
            stats.nLessons++;
            var lid = lessons[i].id;
            var rep = lessonReps[lid];
            if (!rep) continue;
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

		report.updated = nl.fmt.json2Date(report.updated);
		report.created = nl.fmt.json2Date(report.created);
        stats.status = nlLrHelper.statusInfos[_getStatusId(stats, started)];
        var ret = {raw_record: report, repcontent: repcontent, course: course, user: user,
            usermd: nlLrHelper.getMetadataDict(user), stats: stats,
            created: nl.fmt.fmtDateDelta(report.created, null, 'date'), 
            updated: nl.fmt.fmtDateDelta(report.updated, null, 'date')};
        return ret;
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

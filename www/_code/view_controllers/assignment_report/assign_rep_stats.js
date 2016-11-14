(function() {

//-------------------------------------------------------------------------------------------------
// assign_rep_stats.js:
// Service to compute statistics and export assignment report records
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.assign_rep_stats', [])
    .service('NlAssignReportStats', NlAssignReportStats);
}
   
//-------------------------------------------------------------------------------------------------
var NlAssignReportStats = ['nl', 'nlDlg', 'nlExporter', 'nlProgressLog',
function(nl, nlDlg, nlExporter, nlProgressLog) {
    
    var self = this;
    var ctx = null;
    
    this.createReportStats = function() {
        return new ReportStats(nl);
    }

    this.export = function($scope, reports, _userInfo) {
        if (ctx) {
            ctx.pl.warn('Export running: displaying the current progress');
            var dlg = _showDlg($scope);
            dlg.scope.progressLog = ctx.pl.progressLog;
            return;
        }
        _initExportHeaders(_userInfo);
        var dlg = _showDlg($scope);
        ctx = {pl: nlProgressLog.create(dlg.scope), zip: new JSZip(), reports: reports,
            pageCnt: 0,
            overviewRows: [nlExporter.getCsvHeader(_hOverview)], overviewFiles: 0,
            pScoreRows: [nlExporter.getCsvHeader(_hPageScores)], pScoreFiles: 0,
            feedbackRows: [nlExporter.getCsvHeader(_hFeedback)], feedbackFiles: 0};

        ctx.pl.showLogDetails(true);
        ctx.pl.clear();
        _setProgress('start');

        _q(_exportReports)()
        .then(_q(_createZip))
        .then(function() {
            _setProgress('done');
            ctx.pl.imp(nl.fmt2('Export file generated: {} learning records, {} page level records, {} KB',
                ctx.reports.length, ctx.pageCnt, ctx.savedSize));
            ctx = null;
        }, function() {
            _setProgress('done');
            ctx.pl.error('Export failed');
            ctx = null;
        });
    };
    
    function _exportReports(resolve, reject, pos) {
        if (pos === undefined) pos = 0;
        var len = ctx.reports.length;
        if (pos >= len) {
            ctx.pl.info(nl.fmt2('Processed {} records', len));
            _storeFilesInZip(true);
            resolve(true);
            return;
        }

        ctx.pl.imp(nl.fmt2('Processing record {} of {}', pos, len));
        _setProgress('process', pos, len);
        nl.timeout(function() {
            try {
                _processReportRecord(pos);
            } catch (e) {
                ctx.pl.warn(nl.fmt2('Error processing record {} of {} - {}', pos, len, e),
                    angular.toJson(ctx.reports[pos]));
            }
            if (pos % 100 == 0) _storeFilesInZip(false);
            _exportReports(resolve, reject, pos+1);
        });
    }
    
    function _storeFilesInZip(bForce) {
        _storeFilesInZipImpl(bForce, 'overviewRows', 'overviewFiles', 'report-overview', _hOverview);
        _storeFilesInZipImpl(bForce, 'pScoreRows', 'pScoreFiles', 'page-scores', _hPageScores);
        _storeFilesInZipImpl(bForce, 'feedbackRows', 'feedbackFiles', 'feedback', _hFeedback);
    }

    function _storeFilesInZipImpl(bForce, rowsAttrName, fileCntAttrName, prefix, headers) {
        if (!bForce && ctx[rowsAttrName].length < nlExporter.MAX_RECORDS_PER_CSV) return;
        if (ctx[rowsAttrName].length < 2) return;
        ctx[fileCntAttrName]++;
        var fileName = nl.fmt2('{}-{}.csv', prefix, ctx[fileCntAttrName]);
        var content = ctx[rowsAttrName].join('\n');
        ctx.zip.file(fileName, content);
        ctx[rowsAttrName] = [nlExporter.getCsvHeader(headers)];
        ctx.pl.info(nl.fmt2('Added {} to the zip file', fileName));
    }

    function _createZip(resolve, reject) {
        nlExporter.saveZip(ctx.zip, 'reports.zip', ctx.pl, function(sizeKb) {
            ctx.savedSize = sizeKb || 0;
            _setProgress('createZip');
            resolve(true);
        }, function(e) {
            reject(e);
        });
    }

    var _hOverview = [];
    var _hPageScores = [];
    var _hFeedback = [];

    function _initExportHeaders(_userInfo) {
        _hOverview = [{id: 'studentname', name:'user'},
            {id: 'name', name:'name'},
            {id: '_statusStr', name:'status'},
            {id: '_percStr', name:'%'},
            {id: '_score', name:'score'},
            {id: '_maxScore', name:'maxScore'},
            {id: '_passScore', name:'passScore'},
            {id: '_timeMins', name:'time spent'},
            {id: 'created', name:'created', fmt: 'minute'},
            {id: 'started', name:'started', fmt: 'minute'},
            {id: 'ended', name:'ended', fmt: 'minute'},
            {id: 'updated', name:'updated', fmt: 'minute'},
            {id: 'student', name:'userid', fmt: 'idstr'},
            {id: 'id', name:'uniqueid', fmt: 'idstr'},
            {id: 'assignment', name:'assignid', fmt: 'idstr'},
            {id: 'lesson_id', name:'moduleid', fmt: 'idstr'},
            {id: 'org_unit', name:'org'},
            {id: 'subject', name:_userInfo.groupinfo.subjectlabel},
            {id: '_grade', name:_userInfo.groupinfo.gradelabel}];
    
        _hPageScores = [{id: 'pos', name: '#'},
            {id: 'studentname', name:'user'},
            {id: 'name', name:'name'},
            {id: 'updated', name:'updated', fmt: 'minute'},
            {id: 'student', name:'userid', fmt: 'idstr'},
            {id: 'id', name:'uniqueid', fmt: 'idstr'},
            {id: 'org_unit', name:'org'},
            {id: 'page', name:'page'},
            {id: 'title', name:'title'},
            {id: 'score', name:'score'},
            {id: 'maxScore', name:'maxScore'}];
    
        _hFeedback = [{id: 'pos', name: '#'},
            {id: 'studentname', name:'user'},
            {id: 'name', name:'name'},
            {id: 'updated', name:'updated', fmt: 'minute'},
            {id: 'student', name:'userid', fmt: 'idstr'},
            {id: 'id', name:'uniqueid', fmt: 'idstr'},
            {id: 'org_unit', name:'org'},
            {id: 'page', name:'page'},
            {id: 'title', name:'title'},
            {id: 'score', name:'score'},
            {id: 'maxScore', name:'maxScore'}];
    }

    function _processReportRecord(pos) {
        var rep = ctx.reports[pos];
        ctx.overviewRows.push(nlExporter.getCsvRow(_hOverview, rep));
        var content = angular.fromJson(rep.content);
        if (!content.learningData && !content.pages) return;

        var currentPageRecord = {studentname: rep.studentname, name: rep.name,
            updated: rep.updated, student: rep.student, id: rep.id, org_unit: rep.org_unit, 
            page: null, title: '', score: 0, maxScore: 0, pos: 0};
        
        if (content.learningData) {
            var pagesDict = content.learningData.pages || {};
            for (var i in pagesDict) {
                pages.push(pageDict[i]);
            }
            pages.sort(function(a, b) {
                return a.pageNo - b.pageNo;
            });
            for(var i=0; i<pages.length; i++) {
                var page = pages[i];
                currentPageRecord.page = page.pageNo;
                currentPageRecord.title = page.title || '';
                currentPageRecord.score = page.score || 0;
                currentPageRecord.maxScore = page.maxScore || 0;
                ctx.pageCnt++;
                currentPageRecord.pos = ctx.pageCnt;
                ctx.pScoreRows.push(nlExporter.getCsvRow(_hPageScores, currentPageRecord));
                // TODO-MUNNI-NOW: collecting feedback from questionnaire page is pending
            }
        } else {
            // old format!
            for(var i=0; i<content.pages.length; i++) {
                var page = content.pages[i];
                currentPageRecord.page = i+1;
                currentPageRecord.title = page.sections && page.sections[0] ? page.sections[0].text : '';
                var index = currentPageRecord.title.indexOf('\n');
                if (index > -1) currentPageRecord.title = currentPageRecord.title.substring(0, index);
                
                currentPageRecord.score = page.score || 0;
                currentPageRecord.maxScore = page.maxScore || 0;
                ctx.pageCnt++;
                currentPageRecord.pos = ctx.pageCnt;
                ctx.pScoreRows.push(nlExporter.getCsvRow(_hPageScores, currentPageRecord));
                // collecting feedback from questionnaire page not supported in old format
            }
        }
    }
    
    function _showDlg($scope) {
        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-height-max nl-width-max');
        var cancelButton = {text: nl.t('Close')};
        dlg.show('view_controllers/assignment_report/assign_rep_exp_dlg.html', [], cancelButton);
        return dlg;
    }

    var _progressLevels = {
        start: [0, 0],
        process: [0, 95],
        createZip: [95, 98],
        done: [98, 100]
    };
    
    function _setProgress(currentAction, doneSubItems, maxSubItems) {
        if (!doneSubItems) doneSubItems = 1;
        if (!maxSubItems) maxSubItems = 1;
        var levels = _progressLevels[currentAction];
        var p = levels[0] + (doneSubItems/maxSubItems)*(levels[1] - levels[0]);
        ctx.pl.progress(p);
    }

    function _q(fn) {
        return function(param) {
            return nl.q(function(resolve, reject) {
                fn(resolve, reject, param);
            });
        };
    }
}];

//-------------------------------------------------------------------------------------------------
function ReportStats(nl) {
    var self = this;
    var _lst = [];
    var _stats = {students: 0, passed: 0, failed: 0, totalScore: 0, totalMaxScore: 0, 
        avgPerc: 0, belowAvgCnt: 0, hundredPercentCnt: 0};
    var _percentages = [];
    var _leaderBoard = [];
    
    this.STATUS_PENDING = -1;
    this.STATUS_FAILED = 0;
    this.STATUS_PASSED = 1;
    
    this.getRecords = function() {
        return _lst;
    };

    this.getStats = function() {
        return _stats;
    };

    this.getPercentages = function() {
        return _percentages;
    };

    this.getLeaderBoard = function() {
        return _leaderBoard;
    };

    this.updateStats = function(reports) {
        for(var i=0; i<reports.length; i++) {
            var rep = reports[i];
            _lst.push(rep);
            _stats.students++;
            var content = angular.fromJson(rep.content);
            rep._grade = content.grade || '';
            if (!rep.completed) {
                rep._percStr = '';
                rep._statusStr = 'pending';
                _leaderBoard.push({name: rep.studentname, id: rep.id, perc: -1, status: self.STATUS_PENDING});
                continue;
            }
            var score = (content.score || 0);
            var maxScore = (content.maxScore || 0);
            var passScore = maxScore ? (content.passScore || 70) : 0;
            var perc = maxScore > 0 ? Math.round((score/maxScore)*100) : 100;

            rep._score = score > 0 ? score : '';
            rep._maxScore = maxScore > 0 ? maxScore : '';
            rep._passScore = passScore > 0 ? passScore : '';
            rep._percStr = maxScore > 0 ? '' + perc + '%' : '';
            rep._timeMins = content.timeSpentSeconds ? Math.round(content.timeSpentSeconds/60) : '';

            var status = '';
            if (passScore == 0 || perc >= passScore) {
                status = self.STATUS_PASSED;
                _stats.passed++;
                rep._statusStr = 'completed';
            } else {
                status = self.STATUS_FAILED;
                _stats.failed++;
                rep._statusStr = 'failed';
            }
                
            if (perc === 100) _stats.hundredPercentCnt++;
            _stats.totalScore += score;
            _stats.totalMaxScore += maxScore;
            if (perc !== -1) _percentages.push(perc);
            _leaderBoard.push({name: rep.studentname, id: rep.id, perc: perc, status: status});
        }
        _stats.avgPerc = _stats.totalMaxScore > 0 ? Math.round((_stats.totalScore / _stats.totalMaxScore)*100) : 0;
        for(var i=0; i<_leaderBoard.length; i++) {
            if (_leaderBoard.perc !== null && _leaderBoard.perc < _stats.avgPerc) _stats.belowAvgCnt++;
        }
        _leaderBoard.sort(function(a, b) {
            return b.perc - a.perc;
        });
    };
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

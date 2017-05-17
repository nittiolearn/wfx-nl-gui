(function() {

//-------------------------------------------------------------------------------------------------
// assign_rep_stats.js:
// Service to compute statistics and export assignment report records
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.assign_rep_stats', [])
    .service('NlAssignReportStats', NlAssignReportStats)
    .directive('nlLeaderboardAssign', SimpleDirective('leaderboard_assign'))
    .directive('nlLeaderboardGroup', SimpleDirective('leaderboard_group'))
    .directive('nlLeaderboardUser', SimpleDirective('leaderboard_user'))
    .directive('nlRepStatus', NlRepStatus)
    .directive('nlRepDetails', NlRepDetails);
}

//-------------------------------------------------------------------------------------------------
function SimpleDirective(template) {
    return ['nl', function(nl) {
        return {
            restrict: 'E',
            templateUrl: nl.fmt2('view_controllers/assignment_report/{}.html', template),
            scope: true
        };
    }];
}

//-------------------------------------------------------------------------------------------------
var _statusInfo = {
    'pending' : {icon: 'ion-ios-circle-filled fgrey', txt: 'Pending'},
    'failed' : {icon: 'ion-alert-circled fyellow', txt: 'Scored low'},
    'completed' : {icon: 'ion-checkmark-circled fgreen', txt: 'Completed'}
};

var NlRepStatus = ['nl', 
function(nl) {
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/assignment_report/rep_status_dir.html',
        scope: {
            rep: '='
        },
        link: function($scope, iElem, iAttrs) {
            $scope.status = _statusInfo[$scope.rep._statusStr];
        }
    };
}];

var NlRepDetails = ['nl', 
function(nl) {
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/assignment_report/rep_details_dir.html',
        scope: {
            rep: '=',
            stats: '='
        },
        link: function($scope, iElem, iAttrs) {
            $scope.avps = $scope.stats.getReportAvps($scope.rep);
            if ($scope.rep.completed) {
                $scope.onClick = function() {
                    var fn = ($scope.stats.reptype == 'user') ? 'view' : 'review';
                    nl.window.location.href = nl.fmt2('/lesson/{}_report_assign/{}', fn, $scope.rep.id);
                };
            }
        }
    };
}];

//-------------------------------------------------------------------------------------------------
var NlAssignReportStats = ['nl', 'nlDlg', 'nlExporter', 'nlProgressLog', 
'nlServerApi', 'nlGroupInfo', '$templateCache', 'nlTreeSelect', 'nlOuUserSelect',
function(nl, nlDlg, nlExporter, nlProgressLog, nlServerApi, nlGroupInfo, $templateCache, 
    nlTreeSelect, nlOuUserSelect) {
    var self = this;
    var ctx = null;
    var dlg = null;
    var scopeData = {inProgress: false, exportPageScore: false, exportFeedback: false};
    
    this.createReportStats = function(reptype, parentScope) {
        return new ReportStats(reptype, nl, nlDlg, nlServerApi, nlGroupInfo, 
            nlTreeSelect, nlOuUserSelect, parentScope);
    };

    this.export = function($scope, reports, _userInfo) {
        if (!ctx) {
            _initExportHeaders(_userInfo);
            ctx = {pl: nlProgressLog.create($scope),
                overviewRows: [nlExporter.getCsvHeader(_hOverview)],
                pScoreRows: [nlExporter.getCsvHeader(_hPageScores)],
                feedbackRows: [nlExporter.getCsvHeader(_hFeedback)]};
            ctx.pl.showLogDetails(true);
        }
        dlg = _showDlg($scope, reports);
    };
    
    function _onExport(reports) {
        _initCtx(reports);
        scopeData.inProgress = true;
        _setProgress('start');

        _q(_exportReports)()
        .then(_q(_createZip))
        .then(function() {
            _setProgress('done');
            ctx.pl.imp(nl.fmt2('Export file generated: {} learning records, {} page level records, {} KB',
                ctx.reports.length, ctx.pageCnt, ctx.savedSize));
            scopeData.inProgress = false;
        }, function() {
            _setProgress('done');
            ctx.pl.error('Export failed');
            scopeData.inProgress = false;
        });
    }
    
    function _exportReports(resolve, reject, pos) {
        if (pos === undefined) pos = 0;
        var len = ctx.reports.length;
        if (pos >= len) {
            ctx.pl.info(nl.fmt2('Processed {} records', len));
            _storeFilesInZip(true);
            resolve(true);
            return;
        }

        ctx.pl.imp(nl.fmt2('Processing record {} of {}', pos+1, len));
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
        var helpHtml = $templateCache.get('view_controllers/assignment_report/assign_rep_export_help.html');
        ctx.zip.file('_help.html', helpHtml);
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
        _hOverview = [
            {id: '_loginid', name:'user loginid'},
            {id: 'studentname', name:'user name'},
            {id: 'name', name:'module name'},

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

            {id: '_email', name:'email'},
            {id: 'org_unit', name:'org'},
            {id: 'subject', name:_userInfo.groupinfo.subjectlabel},
            {id: '_grade', name:_userInfo.groupinfo.gradelabel},
            {id: '_assignTypeStr', name:'assign type'},
            
            {id: 'id', name:'recordid', fmt: 'idstr'},
            {id: 'student', name:'userid', fmt: 'idstr'},
            {id: 'assignment', name:'assignid', fmt: 'idstr'},
            {id: 'lesson_id', name:'moduleid', fmt: 'idstr'},
            {id: '_courseName', name:'course'},
            {id: '_courseId', name:'courseid', fmt: 'idstr'},
            {id: '_courseAssignId', name:'courseassignid', fmt: 'idstr'},
            {id: '_courseReportId', name:'courserepid', fmt: 'idstr'},
            {id: 'assign_remarks', name:'remarks'}];
    
        _hPageScores = [
            {id: 'pos', name: '#'},
            {id: '_loginid', name:'user loginid'},
            {id: 'studentname', name:'user name'},
            {id: 'name', name:'module name'},

            {id: 'page', name:'page no'},
            {id: 'title', name:'page title'},
            {id: 'score', name:'score'},
            {id: 'maxScore', name:'maxScore'},
            
            {id: '_email', name:'email'},
            {id: 'org_unit', name:'org'},
            {id: 'subject', name:_userInfo.groupinfo.subjectlabel},
            {id: '_grade', name:_userInfo.groupinfo.gradelabel},

            {id: 'id', name:'recordid', fmt: 'idstr'},
            {id: 'student', name:'userid', fmt: 'idstr'},
            {id: 'assignment', name:'assignid', fmt: 'idstr'},
            {id: 'lesson_id', name:'moduleid', fmt: 'idstr'}];
    
        _hFeedback = [
            {id: 'pos', name: '#'},
            {id: '_loginid', name:'user loginid'},
            {id: 'studentname', name:'user name'},
            {id: 'name', name:'module name'},

            {id: 'page', name:'page no'},
            {id: 'title', name:'page title'},
            {id: 'question', name:'question'},
            {id: 'response', name:'response'},
                        
            {id: '_email', name:'email'},
            {id: 'org_unit', name:'org'},
            {id: 'subject', name:_userInfo.groupinfo.subjectlabel},
            {id: '_grade', name:_userInfo.groupinfo.gradelabel},

            {id: 'id', name:'recordid', fmt: 'idstr'},
            {id: 'student', name:'userid', fmt: 'idstr'},
            {id: 'assignment', name:'assignid', fmt: 'idstr'},
            {id: 'lesson_id', name:'moduleid', fmt: 'idstr'}];
    }

    function _processReportRecord(pos) {
        var rep = ctx.reports[pos];
        ctx.overviewRows.push(nlExporter.getCsvRow(_hOverview, rep));
        if (!scopeData.exportPageScore && !scopeData.exportFeedback) return;
        var content = angular.fromJson(rep.content);
        if (!content.learningData && !content.pages) return;

        var currentPageRecord = {pos: 0, _loginid: rep._loginid, 
            studentname: nlGroupInfo.formatUserNameFromRecord(rep), name: rep.name,
            page: null, title: '', score: 0, maxScore: 0, 
            org_unit: rep.org_unit, subject: rep.subject, _grade: rep._grade,
            id: rep.id, student: rep.student, assignment: rep.assignment,
            lesson_id: rep.lesson_id, _email: rep._email};
        
        if (content.learningData) {
            _processReportRecordPageData(currentPageRecord, content);
        } else {
            _processReportRecordPageDataOld(currentPageRecord, content);
        }
    }

    function _processReportRecordPageData(currentPageRecord, content) {
        var pagesDict = content.learningData.pages || {};
        var pages = [];
        for (var i in pagesDict) {
            pages.push(pagesDict[i]);
        }
        pages.sort(function(a, b) {
            return a.pageNo - b.pageNo;
        });
        for(var i=0; i<pages.length; i++) {
            var page = pages[i];
            currentPageRecord.page = page.pageNo;
            currentPageRecord.title = page.title || '';
            if (scopeData.exportPageScore) {
                currentPageRecord.score = page.score || 0;
                currentPageRecord.maxScore = page.maxScore || 0;
                ctx.pageCnt++;
                currentPageRecord.pos = ctx.pageCnt;
                ctx.pScoreRows.push(nlExporter.getCsvRow(_hPageScores, currentPageRecord));
            }
            _processReportRecordDescriptiveData(currentPageRecord, page);
            if (scopeData.exportFeedback) {
                _processReportRecordFeedbackData(currentPageRecord, page);
            }
        }
    }

    function _processReportRecordDescriptiveData(currentPageRecord, page) {
        if (!page.sections) return;
        // sections, sections[i].correctanswer and sections[i].answer are only defined
        // for descriptive and fib page types.
        for(var i=0; i<page.sections.length; i++) {
            var section = page.sections[i];
            if (!section.correctanswer || !section.answer) continue;
            var a = section.answer;
            if (a[a.length-1] == ':') a = a.substring(0, a.length-1);
            
            ctx.feedbackCnt++;
            currentPageRecord.pos = ctx.feedbackCnt;
            currentPageRecord.question = '';
            currentPageRecord.response = a;
            ctx.feedbackRows.push(nlExporter.getCsvRow(_hFeedback, currentPageRecord));
        }
    }
    
    function _processReportRecordFeedbackData(currentPageRecord, page) {
        if (!page.feedback) return;
        for(var i=0; i<page.feedback.length; i++) {
            var fb = page.feedback[i];
            ctx.feedbackCnt++;
            currentPageRecord.pos = ctx.feedbackCnt;
            currentPageRecord.question = fb.question;
            currentPageRecord.response = fb.response;
            ctx.feedbackRows.push(nlExporter.getCsvRow(_hFeedback, currentPageRecord));
        }
    }
    
    // old format! - can be removed after migrating all report records
    function _processReportRecordPageDataOld(currentPageRecord, content) {
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

    function _initCtx(reports) {
        ctx.pl.clear();
        ctx.reports = reports;
        ctx.zip = new JSZip();
        ctx.pageCnt = 0;
        ctx.feedbackCnt = 0;
        ctx.overviewFiles = 0;
        ctx.pScoreFiles = 0;
        ctx.feedbackFiles = 0;
    }
    
    function _showDlg($scope, reports) {
        var dlg = nlDlg.create($scope);
        dlg.scope.progressLog = ctx.pl.progressLog;
        dlg.scope.scopeData = scopeData;
        dlg.scope.onExport = function() {
            _onExport(reports);
        };
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
function ReportStats(reptype, nl, nlDlg, nlServerApi, nlGroupInfo, 
    nlTreeSelect, nlOuUserSelect, parentScope) {
    var self = this;
    var _lst = [];
    var _stats = {reptype: reptype};

    var _usersFilter = {};
    var _grades = {};
    var _subjects = {};

    this.STATUS_PENDING = -1;
    this.STATUS_FAILED = 0;
    this.STATUS_PASSED = 1;
    
    this.getRecords = function() {
        return _lst;
    };

    this.getStats = function() {
        return _stats;
    };

    this.getFilteredStats = function(filters) {
        var stats = {reptype: reptype};
        _updateStats(stats, filters);
        return stats;
    };

    this.getFilterOptions = function(filters) {
        if (!filters) filters = {};
        var ouUserSelector = nlOuUserSelect.getOuUserSelector(parentScope, 
            nlGroupInfo.get(), filters.ouUsers, {}, _usersFilter);
        return {
            ouUserTree: ouUserSelector.getTreeSelect(),
            gradeTree: _dictToTreeList(_grades, filters.grades),
            subjectTree: _dictToTreeList(_subjects, filters.subjects)
        };
    };
    
    this.getSelectedFilters = function(filterOptions) {
        return {ouUsers: nlTreeSelect.getSelectedIds(filterOptions.ouUserTree),
            grades: nlTreeSelect.getSelectedIds(filterOptions.gradeTree),
            subjects: nlTreeSelect.getSelectedIds(filterOptions.subjectTree)};
    };
    
    this.isFilterPresent = function(filters) {
        if (!filters) return false;
        if (Object.keys(filters.ouUsers).length > 0) return true;
        if (Object.keys(filters.grades).length > 0) return true;
        if (Object.keys(filters.subjects).length > 0) return true;
        return false;
    };

    function _doesItPassTheFilter(rep, filters) {
        if (!filters) return true;
        if (!_doesItPassTheFilterForAttr(filters.ouUsers, rep._treeId)) return false;
        if (!_doesItPassTheFilterForAttr(filters.grades, rep._grade)) return false;
        if (!_doesItPassTheFilterForAttr(filters.subjects, rep.subject)) return false;
        return true;
    }
    
    function _doesItPassTheFilterForAttr(filter, repAttr) {
        if (Object.keys(filter).length == 0) return true;
        if (repAttr in filter) return true;
        return false;
    }
    
    function _updateStats(stats, filters, lst) {
        stats.getGroupLBIcon = function(lbRecord) {
            return _getGroupLBIcon(stats, lbRecord);
        };
        
        stats.onGroupLBClick = function(lbRecord) {
            return _onGroupLBClick(stats, lbRecord);
        };
        
        stats.getReportAvps = function(rep) {
            return self.getReportAvps(rep);
        };

        if(!lst || !stats.students) stats.students = 0;
        if(!lst || !stats.passed) stats.passed = 0;
        if(!lst || !stats.failed) stats.failed = 0;
        if(!lst || !stats.totalScore) stats.totalScore = 0;
        if(!lst || !stats.totalMaxScore) stats.totalMaxScore = 0;
        if(!lst || !stats.avgPerc) stats.avgPerc = 0;
        if(!lst || !stats.percentages) stats.percentages = [];
        if(!lst || !self.leaderBoard) self.leaderBoard = {};
        
        if(!lst) lst = _lst;
        for(var i=0; i<lst.length; i++) {
            var rep = lst[i];
            if (!_doesItPassTheFilter(rep, filters)) continue;
            stats.students++;
            _usersFilter[rep.student] = true;
            _grades[rep._grade] = true;
            _subjects[rep.subject] = true;
            if (!rep.completed) {
                _addToLeaderBoard(rep, self.STATUS_PENDING);
                continue;
            }
            var status = '';
            if (!rep._passScore || rep._perc >= rep._passScore) {
                status = self.STATUS_PASSED;
                stats.passed++;
            } else {
                status = self.STATUS_FAILED;
                stats.failed++;
            }
                
            stats.totalScore += rep._score || 0;
            stats.totalMaxScore += rep._maxScore || 0;
            stats.percentages.push(rep._perc);
            _addToLeaderBoard(rep, status);
        }
        stats.avgPerc = stats.totalMaxScore > 0 ? Math.round((stats.totalScore / stats.totalMaxScore)*100) : 0;
        stats.leaderBoard = _getLeaderBoardList();
        stats.leaderBoardLen = stats.leaderBoard.length;
        var MAX_LIST_SIZE = 500;
        if (stats.leaderBoardLen > MAX_LIST_SIZE) {
            var removeCount = stats.leaderBoardLen - MAX_LIST_SIZE;
            stats.leaderBoard.splice(MAX_LIST_SIZE, removeCount);
        }
    };
    
    this.updateReports = function(reports) {
        var groupInfo = nlGroupInfo.get();
        for(var i=0; i<reports.length; i++) {
            var rep = reports[i];
            _lst.push(rep);
            var content = angular.fromJson(rep.content);
            rep.updated = nl.fmt.json2Date(rep.updated);
            rep.created = nl.fmt.json2Date(rep.created);
            if (rep.started) rep.started = nl.fmt.json2Date(rep.started);
            if (rep.ended) rep.ended = nl.fmt.json2Date(rep.ended);
            rep._loginid = '';
            rep._email = '';
            if (groupInfo && groupInfo.users[''+rep.student]) {
                var userInfo = groupInfo.users[''+rep.student];
                rep.studentname = nlGroupInfo.formatUserName(userInfo);
                rep._loginid = userInfo[nlGroupInfo.USERNAME];
                rep._email = userInfo[nlGroupInfo.EMAIL];
                rep.org_unit = userInfo[nlGroupInfo.ORG_UNIT];
            }
            rep._treeId = nl.fmt2('{}.{}', rep.org_unit, rep.student);
            rep._assignTypeStr = _getAssignTypeStr(rep.assigntype);
            rep._courseName = content.courseName || '';
            rep._courseId = content.courseId || '';
            rep._courseAssignId = content.courseAssignId || '';
            rep._courseReportId = content.courseReportId || '';
            rep._grade = content.grade || '';
            if (!rep.completed) {
                rep._percStr = '';
                rep._statusStr = 'pending';
                continue;
            }
            var maxScore = parseInt(content.maxScore || 0);
            var score = parseInt(content.score || 0);
            if (score > maxScore) score = maxScore; // Some 3 year old bug where this happened - just for sake of old record!
            var passScore = maxScore ? parseInt(content.passScore || 0) : 0;
            var perc = maxScore > 0 ? Math.round((score/maxScore)*100) : 100;

            rep._score = score > 0 ? score : '';
            rep._maxScore = maxScore > 0 ? maxScore : '';
            rep._passScore = passScore > 0 ? passScore : '';
            rep._perc = perc;
            rep._percStr = maxScore > 0 ? '' + perc + '%' : '';
            rep._timeMins = content.timeSpentSeconds ? Math.round(content.timeSpentSeconds/60) : '';
            rep._statusStr = (passScore == 0 || perc >= passScore) ? 'completed' : 'failed';
        }
        _lst.sort(function(a, b) {
            return (b.updated - a.updated);
        });
        _updateStats(_stats, null, reports);
    };
    
    function _addToLeaderBoard(rep, status) {
        var student = rep.student;
        if (!self.leaderBoard[student]) self.leaderBoard[student] = {id: student, 
            name: rep.studentname, repid: null, total: 0, done: 0, score: 0, maxScore: 0, repList: []};
        var lbRecord = self.leaderBoard[student];
        lbRecord.repList.push(rep);
        lbRecord.total++;
        if (status == self.STATUS_PENDING) return;
        lbRecord.done++;
        lbRecord.score += rep._score || 0;
        lbRecord.maxScore += rep._maxScore || 0;
        lbRecord.repid = rep.id;
    }
    
    function _getLeaderBoardList() {
        var ret = [];
        for(var student in self.leaderBoard) {
            var rec = self.leaderBoard[student];
            rec.perc = rec.maxScore ? Math.round(rec.score/rec.maxScore*100) : 
                rec.done > 0 && rec.done == rec.total ? -1 :
                rec.done > 0 ? -2 : -3;
            rec.compl = Math.round(rec.done/rec.total*100);
            if (reptype != 'assignment' || rec.total > 1) rec.repid = null;
            ret.push(rec);
        }
        ret.sort(function(a, b) {
            // Least pending, then most score, then most completed
            var aPending = a.total - a.done;
            var bPending = b.total - b.done;
            if (aPending != bPending) return aPending - bPending;
            if (a.perc != b.perc) return b.perc - a.perc;
            return b.done - a.done;
        });
        return ret;
    }
    
    function _getAssignTypeStr(assigntype) {
        if (assigntype == 1) return 'self assignment';
        if (assigntype == 2) return 'course assignment';
        return 'module assignment';
    }

    function _dictToTreeList(d, selectedIds) {
        // Add missing parents!
        for(var key in d) _addParentIfMissing(d, key);
        
        var ret = [];
        for(var key in d) {
            ret.push({id: key});
        }
        ret.sort(function(a, b) {
           if (a.id == b.id) return 0;
           if (a.id > b.id) return 1;
           return -1;
        });
        ret = {data: ret};
        nlTreeSelect.updateSelectionTree(ret, selectedIds);
        return ret;
    }

    function _addParentIfMissing(d, key) {
        var idParts = key.split('.');
        idParts.pop();
        var parentId = idParts.join('.');
        if (!parentId) return;
        d[parentId] = true;
        _addParentIfMissing(d, parentId);
    }
    
    this.getStatusInfo = function() {
        return _statusInfo;
    };

    this.getReportAvps = function(report) {
        var now = new Date();
        var avps = [];
        nl.fmt.addAvp(avps, 'Learner', report.studentname);
        nl.fmt.addAvp(avps, 'Module', report.name);
        if (report.completed && report._maxScore > 0) {
            nl.fmt.addAvp(avps, 'Score', nl.fmt2('{} ({} of {})', report._percStr, report.score || 0, report._maxScore));
            nl.fmt.addAvp(avps, 'Pass Score', nl.fmt2('{}%', report._passScore));
        }
        nl.fmt.addAvp(avps, 'Created on', nl.fmt.fmtDateDelta(report.created, now));
        nl.fmt.addAvp(avps, 'Last updated on', nl.fmt.fmtDateDelta(report.updated, now));
        if (report._timeMins) nl.fmt.addAvp(avps, 'Time spent', nl.fmt2('{} minutes', report._timeMins));
        this.populateCommonAvps(report, avps);
        return avps;
    };

    this.populateCommonAvps = function(report, avps) {
        nl.fmt.addAvp(avps, 'Remarks', report.assign_remarks);
        nl.fmt.addAvp(avps, 'Assigned By', report.assigned_by);
        nl.fmt.addAvp(avps, 'Assigned To', report.assigned_to);
        nl.fmt.addAvp(avps, 'Assigned On ', report.assigned_on, 'date');
        nl.fmt.addAvp(avps, 'Subject', report.subject);
        nl.fmt.addAvp(avps, 'Author', report.authorname);
        nl.fmt.addAvp(avps, 'Module description', report.descMore);
        nl.fmt.addAvp(avps, 'Earliest start time', report.not_before, 'date');
        nl.fmt.addAvp(avps, 'Latest end time', report.not_after, 'date');
        nl.fmt.addAvp(avps, 'Max duration', report.max_duration, 'minutes');
        nl.fmt.addAvp(avps, 'Show answers', _learnmodeString(report.learnmode));
        nl.fmt.addAvp(avps, 'Is published?', report.published, 'boolean');
    };
    
    function _learnmodeString(learnmode) {
        if (learnmode == 1)
            return nl.fmt.t(['on every page']);
        if (learnmode == 2)
            return nl.fmt.t(['after submitting']);
        if (learnmode == 3)
            return nl.fmt.t(['only when published']);
        return '';
    }

    function _getGroupLBIcon(stats, lbRecord) {
        if (lbRecord.done == lbRecord.total) return _statusInfo['completed'].icon;
        if (lbRecord.done > 0) return _statusInfo['failed'].icon;
        return _statusInfo['pending'].icon;
    }

    function _onGroupLBClick(stats, lbRecord) {
        var dlg = nlDlg.create(parentScope);
        dlg.scope.reps = lbRecord.repList;
        dlg.scope.stats = stats;
        dlg.scope.dlgTitle = nl.fmt2('Learning records: {}', lbRecord.repList[0].studentname);
        dlg.setCssClass('nl-height-max nl-width-max');
        var cancelButton = {text: nl.t('Close')};
        dlg.show('view_controllers/assignment_report/leaderboard_record_dlg.html', [], cancelButton);
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

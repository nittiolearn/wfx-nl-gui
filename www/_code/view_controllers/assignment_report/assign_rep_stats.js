(function() {

//-------------------------------------------------------------------------------------------------
// assign_rep_stats.js:
// Service to compute statistics and export assignment report records
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.assign_rep_stats', [])
    .service('nlAssignReportStats', NlAssignReportStats)
    .directive('nlLeaderboardAssign', SimpleDirective('leaderboard_assign'))
    .directive('nlLeaderboardGroup', SimpleDirective('leaderboard_group'))
    .directive('nlLeaderboardUser', SimpleDirective('leaderboard_user'))
    .directive('nlRepStatus', NlRepStatus)
    .directive('nlRepDetails', NlRepDetails);
}

//-------------------------------------------------------------------------------------------------
function SimpleDirective(template) {
    return _nl.elemDirective('view_controllers/assignment_report/' + template 
        + '.html', true);
}

//-------------------------------------------------------------------------------------------------
var _statusInfo = {
    'pending' : {icon: 'ion-ios-circle-filled fgrey', txt: 'Pending', order: 1},
    'failed' : {icon: 'ion-alert-circled fyellow', txt: 'Scored low', order: 2},
    'completed' : {icon: 'ion-checkmark-circled fgreen', txt: 'Completed', order: 3}
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
'nlGroupInfo', '$templateCache', 'nlTreeSelect', 'nlOuUserSelect', 'nlRouter', 'nlOrgMdMoreFilters',
function(nl, nlDlg, nlExporter, nlProgressLog, nlGroupInfo, $templateCache, 
    nlTreeSelect, nlOuUserSelect, nlRouter, nlOrgMdMoreFilters) {
    var self = this;
    var ctx = null;
    var dlg = null;
    var _metaFields = null;
    var scopeData = {showProgressLog: false, inProgress: false, exportPageScore: false, exportFeedback: false,
        exportIds: false, canShowIds: false};
    
    this.createReportStats = function(reptype, parentScope) {
    	scopeData.reptype = reptype;
        var reportStats = new ReportStats(reptype, nl, nlDlg, nlGroupInfo, 
            nlTreeSelect, nlOuUserSelect, parentScope);
        _metaFields = reportStats.getMetaHeaders();
        return reportStats;
    };

    this.export = function($scope, reports, _userInfo) {
		if (_checkInProgress()) return;
        scopeData.canShowIds = nlRouter.isPermitted(_userInfo, 'admin_user');
        ctx = {pl: nlProgressLog.create($scope)};
        dlg = _showDlg($scope, reports, _userInfo);
    };
    
    function _onExport(reports, _userInfo) {
    	scopeData.showProgressLog = true;
        _initCtx(reports, _userInfo);

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
    var _commonFields1 = [
            {id: '_user_id', name:'User Id'},
            {id: 'studentname', name:'User Name'},
            {id: '_email', name:'Email Id'},
            {id: 'org_unit', name:'Org'}];
            
    var _commonFields2 = [
            {id: '_courseName', name:'Course/Training Name'},
            {id: '_batchName', name:'Training Batch Name'},
            {id: 'name', name:'Module Name'}];

    var _idFields = [
            {id: 'id', name:'Report Id', fmt: 'idstr'},
            {id: 'assignment', name:'Assign Id', fmt: 'idstr'},
            {id: 'lesson_id', name:'Module Id', fmt: 'idstr'},
            {id: '_courseId', name:'Course/Training Id', fmt: 'idstr'},
            {id: 'containerid', name:'Course/Training Report Id', fmt: 'idstr'}
    ];
    
    var _h1Overview = [
            {id: 'created', name:'Assigned On', fmt: 'minute'},
            {id: 'started', name:'Started On', fmt: 'minute'},
            {id: 'ended', name:'Ended On', fmt: 'minute'},
            {id: 'updated', name:'Last Updated On', fmt: 'minute'},

            {id: '_statusStr', name:'Status'},
            {id: '_percStr', name:'Achieved %'},
            {id: '_maxScore', name:'Maximum Score'},
            {id: '_score', name:'Achieved Score'},
            {id: '_passScoreStr', name:'Pass %'},
            {id: '_timeMins', name:'Time Spent (minutes)'}];
    var _h1PageScores = [
            {id: 'page', name:'Page No'},
            {id: 'title', name:'Page Title'},
            {id: 'maxScore', name:'Maximum Score'},
            {id: 'score', name:'Acheived Score'}];
    var _h1Feedback = [
            {id: 'page', name:'Page No'},
            {id: 'title', name:'Page Title'},
            {id: 'question', name:'Question'},
            {id: 'response', name:'Response'}];
            
    function _initExportHeaders(_userInfo, exportIds) {
        var _commonFields3 = [
                {id: 'subject', name:_userInfo.groupinfo.subjectlabel},
                {id: '_grade', name:_userInfo.groupinfo.gradelabel},
                {id: '_assignTypeStr', name:'Assign Type'},
                {id: 'assign_remarks', name:'Remarks'}];

        _hOverview = _commonFields1.concat(_metaFields, _commonFields2, _h1Overview, _commonFields3,
                exportIds ? _idFields :  []);
        _hPageScores = _commonFields1.concat(_metaFields, _commonFields2, _h1PageScores, _commonFields3,
                exportIds ? _idFields :  []);
        _hFeedback = _commonFields1.concat(_metaFields, _commonFields2, _h1Feedback, _commonFields3,
                exportIds ? _idFields :  []);
    
    }

    function _processReportRecord(pos) {
        var rep = ctx.reports[pos];
        ctx.overviewRows.push(nlExporter.getCsvRow(_hOverview, rep));
        if (!scopeData.exportPageScore && !scopeData.exportFeedback) return;
        var content = angular.fromJson(rep.content);
        if (!content.learningData && !content.pages) return;

        var currentPageRecord = {pos: 0, _user_id: rep._user_id, 
            studentname: nlGroupInfo.formatUserNameFromRecord(rep), name: rep.name,
            page: null, title: '', score: 0, maxScore: 0, 
            org_unit: rep.org_unit, subject: rep.subject, _grade: rep._grade,
            id: rep.id, student: rep.student, lesson_id: rep.lesson_id, 
            _email: rep._email, _courseName: rep._courseName, _batchName: rep._batchName,
            _assignTypeStr: rep._assignTypeStr, assign_remarks: rep.assign_remarks,
            _courseId: rep._courseId, containerid: rep.containerid};
            
        for(var i=0; i<_metaFields.length; i++)
            currentPageRecord[_metaFields[i].id] = rep[_metaFields[i].id];

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

    function _initCtx(reports, _userInfo) {
        _initExportHeaders(_userInfo, scopeData.exportIds);
        ctx.overviewRows = [nlExporter.getCsvHeader(_hOverview)];
        ctx.pScoreRows = [nlExporter.getCsvHeader(_hPageScores)];
        ctx.feedbackRows = [nlExporter.getCsvHeader(_hFeedback)];
        ctx.pl.showLogDetails(true);
        ctx.pl.clear();
        ctx.reports = reports;
        ctx.zip = new JSZip();
        ctx.pageCnt = 0;
        ctx.feedbackCnt = 0;
        ctx.overviewFiles = 0;
        ctx.pScoreFiles = 0;
        ctx.feedbackFiles = 0;
    }
    
    function _checkInProgress() {
        if (scopeData.inProgress) {
        	nlDlg.popupAlert({title: 'Please wait', template: 'Export is in progress. Please wait till it is complete'});
        	return true;
        }
        return false;
    }
    
    function _showDlg($scope, reports, _userInfo) {
    	scopeData.showProgressLog = false;
        var dlg = nlDlg.create($scope);
        dlg.scope.progressLog = ctx.pl.progressLog;
        dlg.scope.scopeData = scopeData;
        _setFiltersAndTree(dlg, reports);
        var filterData = dlg.scope.filtersData;
        dlg.setCssClass('nl-height-max nl-width-max');
        var exportButton = {text: nl.t('Export'), onTap: function(e) {
            if(e) e.preventDefault();
	    	if (_checkInProgress()) return;
    		var selectedOus = nlOrgMdMoreFilters.getSelectedOus(filterData);
			var selectedMds = nlOrgMdMoreFilters.getSelectedMds(filterData);
			var selectedCourses = nlOrgMdMoreFilters.getSelectedMores(filterData);
			_filterAndExportReports(reports, _userInfo, selectedOus, selectedMds, selectedCourses);
        }};
        var cancelButton = {text: nl.t('Close')};
        dlg.show('view_controllers/assignment_report/assign_rep_exp_dlg.html', [exportButton], cancelButton);
        return dlg;
    }

	function _setFiltersAndTree(dlg, reports) {
		var courseTree = {data: _getCourseModuleTree(reports) || []};
		dlg.scope.filtersData = nlOrgMdMoreFilters.getData(courseTree, 'Module');
	}

	function _getCourseModuleTree(reports) {
		var treeArray = [];
		var insertedKeys = {};
		for(var i=0; i<reports.length; i++) {
			var module = reports[i];
			var moduleKey = null;
			var courseKey = null;
			var moduleKey = 'A'+module.lesson_id;
			if(moduleKey in insertedKeys) continue;
			insertedKeys[moduleKey] = true;
			treeArray.push({id:moduleKey, name:module.name, origId: module.lesson_id});
		}
		return treeArray;
	}
	
	function _filterAndExportReports(reports, _userInfo, _selectedOus, selectedMds, selectedCourses) {
		var filteredReports = [];
		for(var i=0; i<reports.length; i++) {
			var selectedOus = _checkFilter(_selectedOus, reports[i].org_unit);
			var lesson_id = 'A'+reports[i].lesson_id;
			var selectedCourseId = _checkFilter(selectedCourses, lesson_id);
			
			var selectedMetaFields = true;
	        for(var meta in selectedMds) {
	        	var selectedMetas = selectedMds[meta];
	        	var rep = reports[i];
	        	if (_checkFilter(selectedMds[meta], rep[meta])) continue;
	        	selectedMetaFields = false;
	        	break;
	        }
            if(selectedCourseId && selectedOus && selectedMetaFields) {
	            filteredReports.push(reports[i]);
            }
		}
        _onExport(filteredReports, _userInfo);
	}

	function _checkFilter(filterItems, userField) {
		return Object.keys(filterItems).length == 0 || (userField in filterItems);
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
function ReportStats(reptype, nl, nlDlg, nlGroupInfo, 
    nlTreeSelect, nlOuUserSelect, parentScope) {
    var self = this;
    var _lst = [];
    var _stats = {reptype: reptype};
    var _metaFields = _getMetaHeaders();

    var _usersFilter = {};
    var _grades = {};
    var _subjects = {};

    this.STATUS_PENDING = -1;
    this.STATUS_FAILED = 0;
    this.STATUS_PASSED = 1;
    
    this.getMetaHeaders = function() {
        return _metaFields;
    };
    
    function _getMetaHeaders(bOnlyMajor) {
        var headers = [];
        var metadata = nlGroupInfo.getUserMetadata(null);
        for(var i=0; i<metadata.length; i++) {
            if (bOnlyMajor && !metadata[i].major) continue;
            headers.push({id: metadata[i].id, name: metadata[i].name});
        }
        return headers;
    }

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
        var ret = [];
        for(var i=0; i<reports.length; i++) {
            var rep = reports[i];
            if (rep.ctype != _nl.ctypes.CTYPE_MODULE) continue;
            ret.push(rep);
            _lst.push(rep);
            var user = nlGroupInfo.getUserObj(''+rep.student);
            if (user) {
	            rep.studentname = user.name;
	            rep._user_id = user.user_id;
	            rep._email = user.email;
	            rep.org_unit = user.org_unit;
	            var metadata = nlGroupInfo.getUserMetadata(user);
	            for(var j=0; j<metadata.length; j++)
	                rep[metadata[j].id] = metadata[j].value|| '';
            } else {
	            rep.studentname = '';
	            rep._user_id = '';
	            rep._email = '';
	            rep.org_unit = '';
            }
            var content = angular.fromJson(rep.content);
            rep.name = content.name || '';
            rep.updated = nl.fmt.json2Date(rep.updated);
            rep.created = nl.fmt.json2Date(rep.created);
            if (content.started) rep.started = nl.fmt.json2Date(content.started);
            if (content.ended) rep.ended = nl.fmt.json2Date(content.ended);
            rep._treeId = nl.fmt2('{}.{}', rep.org_unit, rep.student);
            rep._assignTypeStr = _getAssignTypeStr(rep.assigntype, content);
            rep._courseName = (rep.assigntype == _nl.atypes.ATYPE_TRAINING ? content.trainingKindName : content.courseName) || '';
            rep._batchName = (rep.assigntype == _nl.atypes.ATYPE_TRAINING ? content.trainingName || content.name : '') || '';
            rep._courseId = (rep.assigntype == _nl.atypes.ATYPE_TRAINING ? content.trainingKindId : content.courseId ) || '';
            rep.containerid = rep.containerid || '';
            rep._grade = content.grade || '';
            rep.subject = content.subject || '';
            if (!rep.completed) {
                rep._percStr = '';
                rep._statusStr = 'pending';
                continue;
            }
            var maxScore = content.selfLearningMode ? 0 : parseInt(content.maxScore || 0);
            var score = content.selfLearningMode ? 0 : parseInt(content.score || 0);
            if (score > maxScore) score = maxScore; // Some 3 year old bug where this happened - just for sake of old record!
            var passScore = maxScore ? parseInt(content.passScore || 0) : 0;
            var perc = maxScore > 0 ? Math.round((score/maxScore)*100) : 100;

            rep._score = score > 0 ? score : '';
            rep._maxScore = maxScore > 0 ? maxScore : '';
            rep._passScore = passScore > 0 ? passScore : '';
            rep._passScoreStr = rep._passScore ? '' + rep._passScore + '%' : '';
            rep._perc = perc;
            rep._percStr = maxScore > 0 ? '' + perc + '%' : '';
            rep._timeMins = content.timeSpentSeconds ? Math.round(content.timeSpentSeconds/60) : '';
            rep._statusStr = (passScore == 0 || perc >= passScore) ? 'completed' : 'failed';
        }
        _lst.sort(function(a, b) {
            return (b.updated - a.updated);
        });
        _updateStats(_stats, null, ret);
        return ret;
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

    this.getReportAvps = function(report, reptype) {
        var avps = [];
        nl.fmt.addAvp(avps, 'Learner', report.studentname);
        nl.fmt.addAvp(avps, 'Module', report.name);
        if (report.completed && report._maxScore > 0) {
            nl.fmt.addAvp(avps, 'Score', nl.fmt2('{} ({} of {})', report._percStr, report._score || 0, report._maxScore || 0));
            nl.fmt.addAvp(avps, 'Pass Score', report._passScore ? nl.fmt2('{}%', report._passScore) : '-');
        }
        nl.fmt.addAvp(avps, 'Created on', report.created, 'date');
        nl.fmt.addAvp(avps, 'Last updated on', report.updated, 'date');
        if (report._timeMins) nl.fmt.addAvp(avps, 'Time spent', nl.fmt2('{} minutes', report._timeMins));
        this.populateCommonAvps(report, avps, reptype);
        return avps;
    };

    this.populateCommonAvps = function(report, avps, reptype) {
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
        if(reptype != 'user') nl.fmt.addAvp(avps, 'Internal identifier', report.id);
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
function _getAssignTypeStr(assigntype, content) {
    if (assigntype == _nl.atypes.ATYPE_SELF_MODULE) return 'module self assignment';
    if (assigntype == _nl.atypes.ATYPE_SELF_COURSE) return 'course self assignment';
    if (assigntype == _nl.atypes.ATYPE_COURSE) return 'course assignment';
    if (assigntype == _nl.atypes.ATYPE_TRAINING) return 'training';
    return 'module assignment';
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

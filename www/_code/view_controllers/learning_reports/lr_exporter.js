(function() {

//-------------------------------------------------------------------------------------------------
// lr_exporter.js: Export learning report (single instance)
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.lr_exporter', [])
	.config(configFn)
	.service('nlLrExporter', NlLrExporter);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
}];

var NlLrExporter = ['nl', 'nlDlg', 'nlRouter', 'nlExporter', 'nlOrgMdMoreFilters', 'nlLrHelper', 'nlLrSummaryStats', 'nlGroupInfo', 'nlLrFilter',
function(nl, nlDlg, nlRouter, nlExporter, nlOrgMdMoreFilters, nlLrHelper, nlLrSummaryStats, nlGroupInfo, nlLrFilter) {
	var self = this;
	
    var _gradelabel = '';
    var _subjectlabel = '';

    var ctx = {};
	var _userInfo = null;
    var _metaFields = null;

    function _getMetaHeaders(bOnlyMajor) {
        var headers = [];
        var metadata = nlGroupInfo.getUserMetadata(null);
        for(var i=0; i<metadata.length; i++) {
            if (bOnlyMajor && !metadata[i].major) continue;
            headers.push({id: metadata[i].id, name: metadata[i].name});
        }
        return headers;
    }

	this.init = function(userInfo) {
    	_metaFields = _getMetaHeaders();
    	_userInfo = userInfo;
    	_gradelabel = userInfo.groupinfo.gradelabel;
    	_subjectlabel = userInfo.groupinfo.subjectlabel;
	};
	
    this.export = function($scope, reportRecords, isAdmin) {
        var dlg = nlDlg.create($scope);
        ctx = {};
		dlg.scope.reptype = nlLrFilter.getType();
        dlg.setCssClass('nl-height-max nl-width-max');
        dlg.scope.export = {summary: true, user: true, module: (dlg.scope.reptype == 'module' || dlg.scope.reptype == 'module_assign') ? true : false, ids: false,
            canShowIds: isAdmin, pageScore: false, feedback: false, session: false};
        dlg.scope.data = {};
		_setExportFilters(dlg, reportRecords);
		var filterData = dlg.scope.filtersData;
        var exportButton = {
            text : nl.t('Export'),
            onTap : function(e) {
                var exp = dlg.scope.export;
                var selected = exp.summary || exp.user || exp.module;
                if(!selected) {
                    dlg.scope.warn = 'Please select atleast one type of report to export';
                    if(e) e.preventDefault();
                    return null;
                }
                var filter = {};
                filter.reptype = dlg.scope.reptype;
                filter.exportTypes = exp;
				filter.selectedOus = nlOrgMdMoreFilters.getSelectedOus(filterData);
				filter.selectedMds = nlOrgMdMoreFilters.getSelectedMds(filterData);
				filter.selectedCourses = nlOrgMdMoreFilters.getSelectedMores(filterData);
                var promise = nl.q(function(resolve, reject) {
	                nlDlg.showLoadingScreen();
			        nlDlg.popupStatus('Initiating export. This may take a while ...', false);
                    nl.timeout(function() {
	        	        _initCtx(reportRecords, _userInfo, filter);
	                    _export(resolve, reject, filter, reportRecords);
                    }); // Seems needed for loadingScreen to appear properly.
                });
                promise.then(function() {
                    nl.timeout(function() {
                        nlDlg.hideLoadingScreen();
                    }, 2000);
                });
            }
        };
        var cancelButton = {text : nl.t('Cancel')};
        dlg.show('view_controllers/learning_reports/lr_exporter_dlg.html',
            [exportButton], cancelButton);
    };
    
	function _setExportFilters(dlg, reportRecords) {
    	var type = nlLrFilter.getType();
    	if(type == 'module' || type == 'module_assign') {
			var tree = {data: _getModuleTree(reportRecords) || []};
			dlg.scope.filtersData = nlOrgMdMoreFilters.getData(tree, 'Module');
    	} else {
			var tree = {data: _getCourseModuleTree(reportRecords) || []};
			dlg.scope.filtersData = nlOrgMdMoreFilters.getData(tree, 'Course and module');
    	}
	}

	function _getModuleTree(reportRecords) {
        var insertedKeys = {};
        var treeArray = [];
        for(var i=0; i<reportRecords.length; i++) {
        	var lesson = reportRecords[i];
			var lessonKey = 'A'+lesson.raw_record.lesson_id || 'A'+lesson.course.lessons[0].lesson_id;
		    if (!insertedKeys[lessonKey]) {
		    	insertedKeys[lessonKey] = true;
		    	treeArray.push({id: lessonKey, name: lesson.raw_record.name, origId: lesson.raw_record.lesson_id});
		    }
        }
        return treeArray;
	}

	function _getCourseModuleTree(reportRecords) {
        var insertedKeys = {};
        var treeArray = [];
        for(var i=0; i<reportRecords.length; i++) {
            var courseObj = reportRecords[i].course;
            if(courseObj.lessons.length == 0) {
		    	var courseKey = 'A'+courseObj.id;
		        if (!insertedKeys[courseKey]) {
		        	insertedKeys[courseKey] = true;
		        	treeArray.push({id: courseKey, name: courseObj.name});
		        }
            } else {
	            for(var j=0; j<courseObj.lessons.length; j++) {
	            	var lessonObj = courseObj.lessons[j];
		            _getIconNodeWithParents(courseObj, lessonObj, treeArray, insertedKeys);
	            }
            }
        }
        return treeArray;
    }

    function _getIconNodeWithParents(courseObj, lessonObj, treeArray, insertedKeys) {
    	if (!courseObj.id) return;
    	var courseKey = 'A'+courseObj.id;
        if (!insertedKeys[courseKey]) {
        	insertedKeys[courseKey] = true;
        	treeArray.push({id: courseKey, name: courseObj.name});
        }
        var moduleKey = courseKey + '.' + lessonObj.id.split('.').join('_');
    		moduleKey = moduleKey.indexOf('.') > 0 ? moduleKey : courseKey;
        if (insertedKeys[moduleKey]) return;
    	insertedKeys[moduleKey] = true;
        treeArray.push({id: moduleKey, name: lessonObj.name, origId: lessonObj.id});
    }

    var _CSV_DELIM = '\n';
    function _export(resolve, reject, filter, reportRecords) {
        try {
            var zip = new JSZip();

		    var expSummaryStats = nlLrSummaryStats.getSummaryStats();
            for(var start=0, i=1; start < reportRecords.length; i++) {
                var pending = reportRecords.length - start;
                pending = pending > nlExporter.MAX_RECORDS_PER_CSV ? nlExporter.MAX_RECORDS_PER_CSV : pending;
                var fileName = nl.fmt2('course-reports-{}.csv', i);
            	_createUserCsv(filter, reportRecords, zip, fileName, start, start+pending, expSummaryStats);
                start += pending;
            }


            if (filter.exportTypes.summary) {
                var records = expSummaryStats.asList();
                for(var start=0, i=1; start < records.length; i++) {
                    var pending = records.length - start;
                    pending = pending > nlExporter.MAX_RECORDS_PER_CSV ? nlExporter.MAX_RECORDS_PER_CSV : pending;
                    var fileName = nl.fmt2('stats-{}.csv', i);
                    _createSummaryCsv(records, zip, fileName, start, start+pending);
                    start += pending;
                }
            }

            if (filter.exportTypes.module) {
                for(var start=0, i=1; start < ctx.moduleRows.length; i++) {
                    var pending = ctx.moduleRows.length - start;
                    pending = pending > nlExporter.MAX_RECORDS_PER_CSV ? nlExporter.MAX_RECORDS_PER_CSV : pending;
                    var fileName = nl.fmt2('module-reports-{}.csv', i);
                    _createCsv(filter, ctx.moduleRows, zip, fileName, start, start+pending);
                    start += pending;
                }
            }

            if (filter.exportTypes.pageScore) {
                for(var start=0, i=1; start < ctx.pScoreRows.length; i++) {
                    var pending = ctx.pScoreRows.length - start;
                    pending = pending > nlExporter.MAX_RECORDS_PER_CSV ? nlExporter.MAX_RECORDS_PER_CSV : pending;
                    var fileName = nl.fmt2('page-reports-{}.csv', i);
                    _createCsv(filter, ctx.pScoreRows, zip, fileName, start, start+pending);
                    start += pending;
                }
            }
			
			if (filter.exportTypes.session) {
                for(var start=0, i=1; start < ctx.sessionRows.length; i++) {
                    var pending = ctx.sessionRows.length - start;
                    pending = pending > nlExporter.MAX_RECORDS_PER_CSV ? nlExporter.MAX_RECORDS_PER_CSV : pending;
                    var fileName = nl.fmt2('ilt-session-reports-{}.csv', i);
                    _createCsv(filter, ctx.sessionRows, zip, fileName, start, start+pending);
                    start += pending;
                }
			} 

            if (filter.exportTypes.feedback && ctx.feedbackRows.length > 1) {
                for(var start=0, i=1; start < ctx.feedbackRows.length; i++) {
                    var pending = ctx.feedbackRows.length - start;
                    pending = pending > nlExporter.MAX_RECORDS_PER_CSV ? nlExporter.MAX_RECORDS_PER_CSV : pending;
                    var fileName = nl.fmt2('feedback-reports-{}.csv', i);
                    _createCsv(filter, ctx.feedbackRows, zip, fileName, start, start+pending);
                    start += pending;
                }
            }
            nlExporter.saveZip(zip, 'report.zip', null, resolve, reject);
        } catch(e) {
            console.error('Error while exporting', e);
            nlDlg.popupAlert({title: 'Error while exporting', template: e});
            reject(e);
        }
    }

    function _createCsv(filter, records, zip, fileName, start, end) {
        var rows = [];
        for (var i=start; i<end; i++) rows.push(records[i]);
        var content = rows.join(_CSV_DELIM);
        zip.file(fileName, content);
    }
    
    function _createUserCsv(filter, records, zip, fileName, start, end, expSummaryStats) {
        var header = _getCsvHeader(filter);
        var rows = [nlExporter.getCsvString(header)];
        var type = nlLrFilter.getType();
        for (var i=start; i<end; i++) {
            var row = null;
            if(records[i].raw_record.ctype == _nl.ctypes.CTYPE_MODULE) {
	            row = _getModuleCsvRow(filter, records[i]);
            } else {
                row = _getCsvRow(filter, records[i]);
            }

			var selectedCourseId = false;
			if (type == 'module' || type == 'module_assign') {
	            var moduleKey = 'A'+records[i].raw_record.lesson_id;
				selectedCourseId = _checkFilter(filter.selectedCourses, moduleKey);
			} else {
	            var courseKey = records[i].course.id;
				selectedCourseId = _checkFilter(filter.selectedCourses, courseKey);
			}
			var selectedOus = _checkFilter(filter.selectedOus, records[i].user.org_unit);
 			
			var selectedMetaFields = true;
            for(var meta in filter.selectedMds) {
            	var selectedMetas = filter.selectedMds[meta];
            	if (_checkFilter(filter.selectedMds[meta], records[i].usermd[meta])) continue;
            	selectedMetaFields = false;
            	break;
            }

            if(selectedCourseId && selectedOus && selectedMetaFields) {
	            rows.push(nlExporter.getCsvString(row));
	            if (records[i].raw_record.ctype == _nl.ctypes.CTYPE_MODULE) {
	            	_exportIndividualPageScore(filter, records[i]);
	            } else if(records[i].raw_record.ctype == _nl.ctypes.CTYPE_COURSE){
	            	if(filter.exportTypes.session) _updateCsvSessionRows(filter, records[i]);
	            	_updateCsvModuleRows(filter, records[i]);
	            }
                expSummaryStats.addToStats(records[i]);
            }
        }
        
        if (filter.exportTypes.user && (filter.reptype == 'course' || filter.reptype == 'course_assign')) {
            var content = rows.join(_CSV_DELIM);
            zip.file(fileName, content);
        }
    }
    
    function _createSummaryCsv(summaryStats, zip, fileName, start, end) {
        var header = ['Org'];
        var metas = nlLrHelper.getMetaHeaders(true);
        for(var i=0; i<metas.length; i++) header.push(metas[i].name);
        header = header.concat(['Completion', 'Assigned', 'Done', 'Failed', 'Started', 'Pending']);
        var rows = [nlExporter.getCsvString(header)];
        for (var i=start; i<end; i++) {
            var record = summaryStats[i];
            var row = [record.org];
            for (var j=0; j<metas.length; j++) row.push(record[metas[j].id]);
            row = row.concat([record.perc ? record.perc+ '%' : '', record.assigned, record.done, record.failed, record.started, record.pending]);
            rows.push(nlExporter.getCsvString(row));
        }
        var content = rows.join(_CSV_DELIM);
        zip.file(fileName, content);
    }

    var _idFields = ['Report Id', 'Assign Id', 'Course Id'];
    function _getCsvHeader(filter) {
        var mh = nlLrHelper.getMetaHeaders(false);
        var headers = ['User Id', 'User Name'];
        headers = headers.concat(['Course Name', 'Batch name', _gradelabel, _subjectlabel, 'Assigned On', 'Last Updated On', 
            'From', 'Till', 'Status', 'Progress', 'Progress Details', 'Quiz Attempts',
            'Achieved %', 'Maximum Score', 'Achieved Score', 'Feedback score', 'Time Spent (minutes)', 'ILT time spent(minutes)', 'ILT total time(minutes)', 'Venue', 'Trainer name',]);
    	headers = headers.concat([ 'Infra Cost', 'Trainer Cost', 'Food Cost', 'Travel Cost', 'Misc Cost']);
        headers = headers.concat(['User state', 'Email Id', 'Org']);
        for(var i=0; i<mh.length; i++) headers.push(mh[i].name);
        if (filter.exportTypes.ids)
            headers = headers.concat(_idFields);
        return headers;
    };
    
    function _getCsvRow(filter, report) {
    	var feedbackScore = _getFeedbackForCourses(report.repcontent.lessonReports);
		if(feedbackScore) feedbackScore = nl.fmt2('{}%', Math.round(feedbackScore*10)/10);
        var mh = nlLrHelper.getMetaHeaders(false);
        var ret = [report.user.user_id, report.user.name];
        ret = ret.concat([report.course.name, report.raw_record._batchName || '', report.course.contentmetadata.grade || '',
        	report.course.contentmetadata.subject || '', nl.fmt.date2Str(report.raw_record.created), nl.fmt.date2Str(report.raw_record.updated),
        	nl.fmt.date2Str(nl.fmt.json2Date(report.raw_record.not_before)) || '', nl.fmt.date2Str(nl.fmt.json2Date(report.raw_record.not_after)) || '', 
            report.stats.status.txt, '' + report.stats.percComplete + '%',
            report.stats.percCompleteDesc, report.stats.avgAttempts,
            report.stats.percScoreStr, report.stats.nMaxScore, report.stats.nScore, feedbackScore,
            Math.ceil(report.stats.timeSpentSeconds/60), Math.ceil(report.stats.iltTimeSpent/60), report.stats.iltTotalTime]);
        ret = ret.concat([report.repcontent.iltVenue || '', report.repcontent.iltTrainerName || '', report.repcontent.iltCostInfra || '', report.repcontent.iltCostTrainer || '',
        			report.repcontent.iltCostFoodSta || '', report.repcontent.iltCostTravelAco || '', report.repcontent.iltCostMisc || '']);
        ret.push(report.user.state ? 'active' : 'inactive');        
        ret.push(report.user.email);
        ret.push(report.user.org_unit);
        for(var i=0; i<mh.length; i++) ret.push(report.usermd[mh[i].id] || '');
        if (filter.exportTypes.ids)
            ret = ret.concat(['id=' + report.raw_record.id, 'id=' + report.raw_record.assignment, 
                'id=' + report.raw_record.lesson_id]);
        return ret;
    }
    
    function _getFeedbackForCourses(reports) {
    	var feedbackScore = 0;
    	var nfeedbacks = 0;
    	for(var id in reports) {
    		var feedbackArray = reports[id].feedbackScore || [];
    		if(feedbackArray.length == 0) continue;
    		var feedback = _getFeedbackScores(feedbackArray);
    		if(feedback) {
    			feedbackScore += feedback;
    			nfeedbacks += 1;
    		}
    	}
    	if(feedbackScore) 
    		return (feedbackScore/nfeedbacks);
    	else 
    		return '';
    };
    
    function  _getModuleCsvRow(filter, report) {
        var mh = nlLrHelper.getMetaHeaders(false);
        var ret = [report.user.user_id, report.user.name];
        ret = ret.concat([report.course.name, report.raw_record._batchName, report.raw_record.grade || '',
        	report.raw_record.subject || '', nl.fmt.date2Str(report.raw_record.created), nl.fmt.date2Str(report.raw_record.updated),
        	report.raw_record.started || '-', report.raw_record.ended || '-',
        	nl.fmt.json2Date(report.raw_record.not_before) || '', nl.fmt.json2Date(report.raw_record.not_after) || '', 
            report.stats.status.txt, report.raw_record.completed ? '' + 100 + '%' : 0+'%',
            report.stats.percCompleteDesc, report.raw_record.completed ? 1 : 0,
            report.stats.percScoreStr, report.stats.nMaxScore, report.stats.nScore,
            Math.ceil(report.stats.timeSpentSeconds/60)]);
        ret.push(report.user.state ? 'active' : 'inactive');
        ret.push(report.user.email);
        ret.push(report.user.org_unit);
        for(var i=0; i<mh.length; i++) ret.push(report.usermd[mh[i].id] || '');
        if (filter.exportTypes.ids)
            ret = ret.concat(['id=' + report.raw_record.id, 'id=' + report.raw_record.assignment, 
                'id=' + report.raw_record.lesson_id]);
        return ret;
    }
    
    function _initCtx(reports, _userInfo, filter) {
        _initExportHeaders(_userInfo, filter.exportTypes.ids);
        ctx.moduleRows = [nlExporter.getCsvHeader(_hModuleRow)];
        ctx.pScoreRows = [nlExporter.getCsvHeader(_hPageScores)];
        ctx.feedbackRows = [nlExporter.getCsvHeader(_hFeedback)];
        ctx.sessionRows = [nlExporter.getCsvHeader(_hSessionRow)];
        ctx.reports = reports;
        ctx.zip = new JSZip();
        ctx.pageCnt = 0;
        ctx.feedbackCnt = 0;
        ctx.overviewFiles = 0;
        ctx.pScoreFiles = 0;
        ctx.feedbackFiles = 0;
    }
    

    var _hModuleRow = [];
    var _hPageScores = [];
    var _hFeedback = [];
    var _hSessionRow = [];
    var _userFields1 = [
            {id: '_user_id', name:'User Id'},
            {id: 'studentname', name:'User Name'}];
            
    var _userFields2 = [
            {id: '_stateStr', name:'User state'},
            {id: '_email', name:'Email Id'},
            {id: 'org_unit', name:'Org'}];

    var _commonFields = [
            {id: '_assignTypeStr', name:'Record Type'},
            {id: '_courseName', name:'Course/Training Name'},
            {id: '_batchName', name:'Batch Name'},
            {id: 'name', name:'Module Name'}];

    var _idFields1 = [
            {id: 'id', name:'Report Id', fmt: 'idstr'},
            {id: 'assignment', name:'Assign Id', fmt: 'idstr'},
            {id: 'lesson_id', name:'Module Id', fmt: 'idstr'},
            {id: '_courseId', name:'Course/Training Id', fmt: 'idstr'},
            {id: 'containerid', name:'Course/Training Report Id', fmt: 'idstr'}
    ];
    
    var _h1ModuleRow = [
            {id: 'created', name:'Assigned On', fmt: 'minute'},
            {id: 'started', name:'Started On', fmt: 'minute'},
            {id: 'ended', name:'Ended On', fmt: 'minute'},
            {id: 'updated', name:'Last Updated On', fmt: 'minute'},
			{id: 'not_before', name: 'From', fmt: 'minute'},
			{id: 'not_after', name: 'Till', fmt: 'minute'},

            {id: '_statusStr', name:'Status'},
            {id: '_attempts', name:'Attempts'},
            
            {id: '_percStr', name:'Achieved %'},
            {id: '_maxScore', name:'Maximum Score'},
            {id: '_score', name:'Achieved Score'},
            {id: '_passScoreStr', name:'Pass %'},
            {id: 'feedbackScore', name:'Feedback score'},
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

	var _h1sessionElems1 = [
            {id: '_assignTypeStr', name:'Record Type'},
            {id: '_courseName', name:'course Name'},
            {id: '_batchName', name:'Batch Name'},
            {id: 'session', name:'Session name'}];
            
    var _h1sessionElems2 = [        
			{id: 'not_before', name: 'From', fmt: 'minute'},
			{id: 'not_after', name: 'Till', fmt: 'minute'},
			{id: 'status', name: 'Status'},
            {id: '_timeMins', name:'ILT Time Spent(minutes)'},
            {id: '_timeTotalMins', name:'ILT Total Time(minutes)'},
            {id: 'iltVenue', name: 'Venue'},
            {id: 'iltTrainerName', name: 'Trainer name'},
            {id: 'iltCostInfra', name: 'Infra cost'},
            {id: 'iltCostTrainer', name: 'Trainer cost'},
            {id: 'iltCostFoodSta', name: 'Food cost'},
            {id: 'iltCostTravelAco', name: 'travel cost'},
            {id: 'iltCostMisc', name: 'Misc cost'}];
      var idSessionIdFields = [
			{id: 'repid', name: 'Report Id'},
			{id: 'assignid', name: 'Assign Id'}, 
			{id: 'courseid', name: 'Course Id'}      
			];
    function _initExportHeaders(_userInfo, exportIds) {
        var _commonFieldsPre = [
                {id: 'subject', name:_userInfo.groupinfo.subjectlabel},
                {id: '_grade', name:_userInfo.groupinfo.gradelabel}];
        var _commonFieldsPost = [
                {id: 'assign_remarks', name:'Remarks'}];

        _hModuleRow = _userFields1.concat(_commonFields, _commonFieldsPre, _h1ModuleRow, _commonFieldsPost, _userFields2, _metaFields,
                exportIds ? _idFields1 :  []);
        _hPageScores = _userFields1.concat(_commonFields, _commonFieldsPre, _h1PageScores, _commonFieldsPost, _userFields2, _metaFields,
                exportIds ? _idFields1 :  []);
        _hFeedback = _userFields1.concat(_commonFields, _commonFieldsPre, _h1Feedback, _commonFieldsPost, _userFields2, _metaFields,
                exportIds ? _idFields1 :  []);
    	_hSessionRow = _userFields1.concat(_h1sessionElems1, _commonFieldsPre, _h1sessionElems2, _userFields2, _metaFields, 
    			exportIds ? idSessionIdFields :  []);
    }

	function _updateCsvSessionRows(filter, rep) {
        if(!rep.course.content.blended) return;
        var mh = nlLrHelper.getMetaHeaders(false);
        var record = {_user_id: rep.user.user_id, studentname: rep.repcontent.studentname, 
        				_assignTypeStr: 'Course', _courseName: rep.repcontent.name, _batchName: rep.repcontent.batchname,
        				session: '', subject: rep.course.contentmetadata.subject,  _grade: rep.course.contentmetadata.grade, 
                        not_before: rep.repcontent.not_before, not_after: rep.repcontent.not_after, status: '-', 
                        _timeMins: (rep.stats.iltTimeSpent+rep.stats.timeSpentSeconds)/60, 
        				iltVenue: rep.repcontent.iltVenue, iltTrainerName: rep.repcontent.iltTrainerName, iltCostInfra : rep.repcontent.iltCostInfra,
        				iltCostTrainer: rep.repcontent.iltCostTrainer, iltCostFoodSta: rep.repcontent.iltCostFoodSta, iltCostTravelAco: rep.repcontent.iltCostTravelAco,
        				iltCostMisc: rep.repcontent.iltCostMisc, _stateStr: rep.user.state ? 'active' : 'inactive', _email: rep.user.email, org_unit: rep.user.org_unit};
        for(var i=0; i<mh.length; i++) record[mh[i].id] = rep.usermd[mh[i].id];
        if (filter.exportTypes.ids) {
            record['repid'] =  rep.raw_record.id;
            record['assignid'] = rep.raw_record.assignment;
            record['courseid'] = rep.repcontent.courseid; 
        }
        for(var i=0; i<rep.course.content.modules.length; i++) {
        	var session = rep.course.content.modules[i];
        	if(session.type != 'iltsession' || session.type == 'module') continue;
        	record['session'] = session.name;
        	record['_assignTypeStr'] = session.type;
        	if(rep.repcontent.statusinfo && rep.repcontent.statusinfo[session.id]) {
	        	record['status'] = rep.repcontent.statusinfo[session.id].status == 'done' ? (rep.repcontent.statusinfo[session.id].state == 'attended' ? 'Attended' : 'Not attended') : 'pending';
	        	record['_timeMins'] = rep.repcontent.statusinfo[session.id].state == 'attended' ? rep.repcontent.statusinfo[session.id].iltTotalTime : '';
                record['_timeTotalMins'] = rep.repcontent.statusinfo[session.id].iltTotalTime;
        	} else {
        		record['status'] = 'Pending';
                record['_timeMins'] = '';
                record['_timeTotalMins'] = '';
            }
	        ctx.sessionRows.push(nlExporter.getCsvRow(_hSessionRow, record));
        }
	}


    function _exportIndividualPageScore(filter, report) {
        var rep = report.raw_record;
        var mh = nlLrHelper.getMetaHeaders(false);
        var content = angular.fromJson(report.raw_record.content);
        var feedbackScore = _getFeedbackScores(content.feedbackScore || []);
		if(feedbackScore) feedbackScore = nl.fmt2('{}%', Math.round(feedbackScore*10)/10);
        rep.feedbackScore = feedbackScore;
        rep.not_before = report.repcontent.not_before ? nl.fmt.json2Date(report.repcontent.not_before) : '';
        rep.not_after = report.repcontent.not_after ? nl.fmt.json2Date(report.repcontent.not_after) : '';
        ctx.moduleRows.push(nlExporter.getCsvRow(_hModuleRow, rep));
        if (!filter.exportTypes.pageScore && !filter.exportTypes.feedback) return;
        if (!content.learningData && !content.pages) return;
        var user = report.user;
        var currentPageRecord = {pos: 0, _user_id: rep._user_id, 
            studentname: nlGroupInfo.formatUserNameFromRecord(rep), name: rep.name,
            page: null, title: '', score: 0, maxScore: 0, 
            org_unit: rep.org_unit, _stateStr: rep._stateStr, 
            subject: rep.subject, _grade: rep._grade,
            id: rep.id, student: rep.student, lesson_id: rep.lesson_id, 
            _email: rep._email, _assignTypeStr: rep._assignTypeStr, 
            _courseName: rep._courseName, _batchName: rep._batchName,
            assign_remarks: rep.assign_remarks, assignment: rep.assignment,
            _courseId: rep._courseId, containerid: rep.containerid, _attempts : rep._attempts};
            
        for(var i=0; i<mh.length; i++)
            currentPageRecord[mh[i].id] = rep[mh[i].id];

        if (content.learningData) {
            _processReportRecordPageData(currentPageRecord, content, filter);
        } else {
            _processReportRecordPageDataOld(currentPageRecord, content, filter);
        }    	
	}
	
    function _getFeedbackScores(feedback) {
    	if(feedback.length == 0) return '';
    	var score = 0;
    	for(var i=0; i<feedback.length; i++) {
    		score += feedback[i];
    	}
    	return (score/feedback.length);
    }

    function _processReportRecordPageData(currentPageRecord, content, filter, rep) {
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
            if (filter.exportTypes.pageScore) {  
                currentPageRecord.score = page.score || 0;
                currentPageRecord.maxScore = page.maxScore || 0;
                ctx.pageCnt++;
                currentPageRecord.pos = ctx.pageCnt;
                ctx.pScoreRows.push(nlExporter.getCsvRow(_hPageScores, currentPageRecord));
            }
            _processReportRecordDescriptiveData(currentPageRecord, page);
            if (filter.exportTypes.feedback) {
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

    function _updateCsvModuleRows(filter, report) {
        var modules = report.course.lessons;
        var lessonReports = report.repcontent.lessonReports || {};
        var mh = nlLrHelper.getMetaHeaders(false);
        var not_before = report.raw_record.not_before ? nl.fmt.date2Str(nl.fmt.json2Date(report.raw_record.not_before)) : '';
        var not_after = report.raw_record.not_after ? nl.fmt.date2Str(nl.fmt.json2Date(report.raw_record.not_after)) : '';
        for(var m=0; m<modules.length; m++) {
            var module=modules[m];
            var moduleKey = 'A'+report.course.id + '.' + module.id.split('.').join('_');
        	if (!_checkFilter(filter.selectedCourses, moduleKey)) continue;
            var status = 'pending';
            var perc='';
            var score='';
            var maxScore='';
            var passScore = '';
            var started = '';
            var ended = '';
            var timeSpent='';
            var attempts = '';
            var feedbackScore = '';
            if (module.id in lessonReports) {
                var lrep = lessonReports[module.id];
                maxScore = lrep.selfLearningMode ? 0 : lrep.maxScore || 0;
                passScore = lrep.passScore || '';
                score = lrep.selfLearningMode ? 0 : lrep.score || 0;
                var percentage = maxScore > 0 ? Math.round(score*100/maxScore) : 100;
                var passed = (!lrep.passScore || percentage >= lrep.passScore);
                perc =  maxScore > 0 ? percentage + '%' : '';
                maxScore = maxScore || '';
                score = score || '';
                started = lrep.started || '';
                ended = lrep.ended || '';
                timeSpent = Math.ceil((lrep.timeSpentSeconds||0)/60);
                attempts = lrep.attempt || '';
                status = !lrep.completed ? 'started' :
                    !maxScore ? 'done' :
                    passed ? 'passed' : 'failed';
		        feedbackScore = _getFeedbackScores(lrep.feedbackScore || []);
            }
            
			if(feedbackScore) feedbackScore = nl.fmt2('{}%', Math.round(feedbackScore*10)/10);
            var ret = [report.user.user_id, report.user.name];
            if (started) started = nl.fmt.date2Str(nl.fmt.json2Date(started));
            if (ended) ended = nl.fmt.date2Str(nl.fmt.json2Date(ended));
            ret = ret.concat(['Module inside course', report.course.name, report.raw_record._batchName, module.name, report.course.contentmetadata.grade || '',
	        	report.course.contentmetadata.subject || '', nl.fmt.date2Str(report.raw_record.created), started, ended, nl.fmt.date2Str(report.raw_record.updated), not_before, not_after, status,
	        	attempts, perc, maxScore, score, passScore ? passScore + '%' : '', feedbackScore, timeSpent, report.repcontent.remarks]);
			ret.push(report.user.state ? 'active': 'inactive');
	        ret.push(report.user.email);
	        ret.push(report.user.org_unit);
            for(var i=0; i<mh.length; i++) ret.push(report.usermd[mh[i].id] || '');
            if (filter.exportTypes.ids)
                ret = ret.concat(['id=' + report.raw_record.id, 
                    'id=' + report.raw_record.assignment, 'id=' + report.raw_record.lesson_id, 'id=' + report.course.id, 'id=' + report.raw_record.containerid]);
            ctx.moduleRows.push(nlExporter.getCsvString(ret));
        }
    }

	function _checkFilter(filterItems, userField) {
		return Object.keys(filterItems).length == 0 || (userField in filterItems);
	}
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

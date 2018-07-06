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

var NlLrExporter = ['nl', 'nlDlg', 'nlRouter', 'nlExporter', 'nlOrgMdMoreFilters', 'nlLrHelper', 'nlLrSummaryStats',
function(nl, nlDlg, nlRouter, nlExporter, nlOrgMdMoreFilters, nlLrHelper, nlLrSummaryStats) {
	var self = this;
	
    var _gradelabel = '';
    var _subjectlabel = '';
	this.init = function(userInfo) {
    	_gradelabel = userInfo.groupinfo.gradelabel;
    	_subjectlabel = userInfo.groupinfo.subjectlabel;
	};
	
    this.export = function($scope, reportRecords, isAdmin) {
        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-height-max nl-width-max');
        dlg.scope.export = {summary: true, user: true, module: false, ids: false,
            canShowIds: isAdmin};
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
                filter.exportTypes = exp;
				filter.selectedOus = nlOrgMdMoreFilters.getSelectedOus(filterData);
				filter.selectedMds = nlOrgMdMoreFilters.getSelectedMds(filterData);
				filter.selectedCourses = nlOrgMdMoreFilters.getSelectedMores(filterData);

                nlDlg.showLoadingScreen();
                var promise = nl.q(function(resolve, reject) {
                    _export(resolve, reject, filter, reportRecords);
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
		var courseTree = {data: _getCourseModuleTree(reportRecords) || []};
		dlg.scope.filtersData = nlOrgMdMoreFilters.getData(courseTree, 'Course and module');
	}

	function _getCourseModuleTree(reportRecords) {
        var insertedKeys = {};
        var treeArray = [];
        for(var i=0; i<reportRecords.length; i++) {
            var courseObj = reportRecords[i].course;
            for(var j=0; j<courseObj.lessons.length; j++) {
            	var lessonObj = courseObj.lessons[j];
	            _getIconNodeWithParents(courseObj, lessonObj, treeArray, insertedKeys);
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
        if (insertedKeys[moduleKey]) return;
    	insertedKeys[moduleKey] = true;
        treeArray.push({id: moduleKey, name: lessonObj.name, origId: lessonObj.id});
    }

    var _CSV_DELIM = '\n';
    function _export(resolve, reject, filter, reportRecords) {
        try {
            var zip = new JSZip();
            var moduleRows = filter.exportTypes.module ? [] : null;

		    var expSummaryStats = nlLrSummaryStats.getSummaryStats();
            for(var start=0, i=1; start < reportRecords.length; i++) {
                var pending = reportRecords.length - start;
                pending = pending > nlExporter.MAX_RECORDS_PER_CSV ? nlExporter.MAX_RECORDS_PER_CSV : pending;
                var fileName = nl.fmt2('CourseUserReport-{}.csv', i);
            	_createUserCsv(filter, reportRecords, zip, fileName, start, start+pending, moduleRows, expSummaryStats);	
                start += pending;
            }


            if (filter.exportTypes.summary) {
                var records = expSummaryStats.asList();
                for(var start=0, i=1; start < records.length; i++) {
                    var pending = records.length - start;
                    pending = pending > nlExporter.MAX_RECORDS_PER_CSV ? nlExporter.MAX_RECORDS_PER_CSV : pending;
                    var fileName = nl.fmt2('CourseSummaryReport-{}.csv', i);
                    _createSummaryCsv(records, zip, fileName, start, start+pending);
                    start += pending;
                }
            }

            if (filter.exportTypes.module) {
                var records = moduleRows;
                for(var start=0, i=1; start < records.length; i++) {
                    var pending = records.length - start;
                    pending = pending > nlExporter.MAX_RECORDS_PER_CSV ? nlExporter.MAX_RECORDS_PER_CSV : pending;
                    var fileName = nl.fmt2('CourseUserModuleReport-{}.csv', i);
                    _createUserModuleCsv(filter, records, zip, fileName, start, start+pending);
                    start += pending;
                }
            }

            nlExporter.saveZip(zip, 'CourseReport.zip', null, resolve, reject);
        } catch(e) {
            console.error('Error while exporting', e);
            nlDlg.popupAlert({title: 'Error while exporting', template: e});
            reject(e);
        }
    }

    function _createUserModuleCsv(filter, records, zip, fileName, start, end) {
        var header = _getCsvModuleHeader(filter);
        var rows = [nlExporter.getCsvString(header)];
        for (var i=start; i<end; i++) rows.push(records[i]);
        var content = rows.join(_CSV_DELIM);
        zip.file(fileName, content);
    }
    
    function _createUserCsv(filter, records, zip, fileName, start, end, moduleRows, expSummaryStats) {
        var header = _getCsvHeader(filter);
        var rows = [nlExporter.getCsvString(header)];
        for (var i=start; i<end; i++) {
            var row = _getCsvRow(filter, records[i]);

			var selectedCourseId = _checkFilter(filter.selectedCourses, records[i].course.id);
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
	            if (moduleRows) _updateCsvModuleRows(filter, records[i], moduleRows);
                expSummaryStats.addToStats(records[i]);
            }
        }
        
        if (filter.exportTypes.user) {
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
        headers = headers.concat(['Course Name', _gradelabel, _subjectlabel, 'Assigned On', 'Last Updated On', 
            'From', 'Till', 'Status', 'Progress', 'Progress Details', 'Quiz Attempts',
            'Achieved %', 'Maximum Score', 'Achieved Score', 'Time Spent (minutes)']);
        headers = headers.concat(['Email Id', 'Org']);
        for(var i=0; i<mh.length; i++) headers.push(mh[i].name);
        if (filter.exportTypes.ids)
            headers = headers.concat(_idFields);
        return headers;
    };
    
    function _getCsvRow(filter, report) {
        var mh = nlLrHelper.getMetaHeaders(false);
        var ret = [report.user.user_id, report.user.name];
        ret = ret.concat([report.course.name, report.course.contentmetadata.grade || '',
        	report.course.contentmetadata.subject || '', report.created, report.updated,
        	report.not_before, report.not_after, 
            report.stats.status.txt, '' + report.stats.percComplete + '%',
            report.stats.percCompleteDesc, report.stats.avgAttempts,
            report.stats.percScoreStr, report.stats.nMaxScore, report.stats.nScore,
            Math.ceil(report.stats.timeSpentSeconds/60)]);
        ret.push(report.user.email);
        ret.push(report.user.org_unit);
        for(var i=0; i<mh.length; i++) ret.push(report.usermd[mh[i].id] || '');
        if (filter.exportTypes.ids)
            ret = ret.concat(['id=' + report.raw_record.id, 'id=' + report.raw_record.assignment, 
                'id=' + report.raw_record.lesson_id]);
        return ret;
    }
    
    function _getCsvModuleHeader(filter) {
        var mh = nlLrHelper.getMetaHeaders(false);
        var headers = ['User Id', 'User Name'];
        headers = headers.concat(['Course Name', _gradelabel, _subjectlabel, 'Module Name', 'Started', 'Ended', 
            'Status', 'Attempts', 'Achieved %', 'Maximum Score', 'Achieved Score', 'Pass %', 
            'Time Spent (minutes)']);
        headers = headers.concat(['Email Id', 'Org']);
        for(var i=0; i<mh.length; i++) headers.push(mh[i].name);
        if (filter.exportTypes.ids)
            headers = headers.concat(_idFields);
        return headers;
    }

    function _updateCsvModuleRows(filter, report, moduleRows) {
        var modules = report.course.lessons;
        //
        var lessonReports = report.repcontent.lessonReports || {};
        var mh = nlLrHelper.getMetaHeaders(false);
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
            }
            
            var ret = [report.user.user_id, report.user.name];
            if (started) started = nl.fmt.date2Str(nl.fmt.json2Date(started));
            if (ended) ended = nl.fmt.date2Str(nl.fmt.json2Date(ended));
            ret = ret.concat([report.course.name, report.course.contentmetadata.grade || '',
	        	report.course.contentmetadata.subject || '', module.name, started, ended, status,
	        	attempts, perc, maxScore, score, passScore ? passScore + '%' : '', timeSpent]);
	        ret.push(report.user.email);
	        ret.push(report.user.org_unit);
            for(var i=0; i<mh.length; i++) ret.push(report.usermd[mh[i].id] || '');
            if (filter.exportTypes.ids)
                ret = ret.concat(['id=' + report.raw_record.id, 
                    'id=' + report.raw_record.assignment, 'id=' + report.raw_record.lesson_id]);
            moduleRows.push(nlExporter.getCsvString(ret));
        }
    }

	function _checkFilter(filterItems, userField) {
		return Object.keys(filterItems).length == 0 || (userField in filterItems);
	}
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

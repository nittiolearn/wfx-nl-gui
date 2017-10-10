(function() {

//-------------------------------------------------------------------------------------------------
// course_charts.js:
// Export and charts for course and course reports
// Used in SMHS usecase - exporting syllabus scheduler status
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.course.charts', [])
	.config(configFn)
	.controller('nl.CourseExportCtrl', CourseExportCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.course_charts', {
		url: '^/course_charts',
		views: {
			'appContent': {
				templateUrl: 'view_controllers/course/charts/course_charts.html',
				controller: 'nl.CourseExportCtrl'
			}
		}});
}];

//-------------------------------------------------------------------------------------------------
var CourseExportCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlProgressLog', 'nlExporter',
function(nl, nlRouter, $scope, nlServerApi, nlProgressLog, nlExporter) {
    var pl = nlProgressLog.create($scope);
    pl.showLogDetails(true);
    var exporter = new Exporter(nl, nlServerApi, nlExporter, pl, $scope);

	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
            resolve(true);
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    $scope.onExport = function() {
        var courseAssignIds = $scope.taContent.split(',');
        for(var i in courseAssignIds) {
            courseAssignIds[i] = parseInt(courseAssignIds[i]);
        }
        $scope.started = true;
        exporter.export(courseAssignIds);
    };
}];

//-------------------------------------------------------------------------------------------------
function Exporter(nl, nlServerApi, nlExporter, pl, $scope) {
    
    var self = this;
    self.courseAssignIds = {};
    self.courseIds = {};
    self.reports = {};
    self.courses = {};
    
    this.export = function(courseAssignIds) {
        pl.clear();
        self.courseAssignIds = courseAssignIds;
    	self.courseIds = {};
        self.setProgress('start');
        _q(_getCourseReports)()
        .then(_q(_getCourseData))
        .then(_q(_createExportChart))
        .then(function() {
            self.setProgress('done');
            pl.imp('Export completed');
        }, function() {
            self.setProgress('done');
            pl.error('Export failed');
        });
    };

    function _q(fn) {
        return function(param) {
            return nl.q(function(resolve, reject) {
                fn(resolve, reject, param);
            });
        };
    }
    
    this.setProgress = function(currentAction, doneSubItems, maxSubItems) {
        if (!doneSubItems) doneSubItems = 1;
        if (!maxSubItems) maxSubItems = 1;
        var levels = _progressLevels[currentAction];
        var p = levels[0] + (doneSubItems/maxSubItems)*(levels[1] - levels[0]);
        pl.progress(p);
    };

    var _progressLevels = {
        start: [0, 0],
        step1: [0, 60],
        step2: [60, 90],
        step3: [90, 98],
        done: [98, 100]
    };
    
    function _getCourseReports(resolve, reject) {
        pl.imp(nl.fmt2('Getting course assignment reports for {} assignments', 
            self.courseAssignIds.length), angular.toJson(self.courseAssignIds, 2));
        var assignIdReportCounts = _initAssignIdDict(self.courseAssignIds);
    	nlServerApi.courseExportReports(self.courseAssignIds)
    	.then(function(reports){
    		self.reports = reports;
	        pl.debug(nl.fmt2('Got {} course assignment reports', 
	           self.reports.length), angular.toJson(self.reports, 2));
	        for(var i=0; i<reports.length; i++){
	        	self.courseIds[reports[i].courseid] = true;
	        	assignIdReportCounts[reports[i].assignid]++;
	        }
	        _checkAssignDict(assignIdReportCounts);
	        self.setProgress('step1');
	        resolve(true);
        }, function(error){
        	pl.error('courseExportReports failed', error);
        	reject();
        });
    }
    
    function _initAssignIdDict(courseAssignIds) {
        var ret = {};
        for(var i in courseAssignIds) ret[courseAssignIds[i]] = 0;
        return ret;
    }
    
    function _checkAssignDict(assignIdReportCounts) {
        var nMissingCnt = 0;
        for(var assignid in assignIdReportCounts) {
            if (assignIdReportCounts[assignid] == 0) nMissingCnt++;
        }
        if (nMissingCnt > 0) pl.error(nl.fmt2('Reports missing for {} assignments', 
            nMissingCnt), angular.toJson(assignIdReportCounts, 2));
        else pl.debug('Report counts per assignment id', 
            angular.toJson(assignIdReportCounts, 2));
    }

    function _getCourseData(resolve, reject) {
        pl.imp(nl.fmt2('Getting course data for {} courses', 
            Object.keys(self.courseIds).length), angular.toJson(self.courseIds, 2));
        if (Object.keys(self.courseIds).length == 0) {
            pl.error("No course found to export");
            reject();
            return;
        }
        nlServerApi.courseExportCourses(self.courseIds).then(function(courses){
	        self.courses = courses;
	        pl.debug(nl.fmt2('Got course data for {} courses', 
	           Object.keys(self.courses).length), angular.toJson(self.courses, 2));
	        self.setProgress('step2');
	        resolve(true);        
        }, function(error){
        	pl.error("courseExportCourses failed", error);
        	reject();
        });
    }
    
    function _createExportChart(resolve, reject){
        pl.imp('Exporting chart data'); 
    	var data = [];
    	data.push(['Assignment id', 'Course id', 'Assignment remark', 'Userid', 'Username',
    	           'Course name', 'Course item name', 'Course item Id', 'Type', 'Planned date', 
    			   'Status', 'Start date', 'Completion Date', 
    			   'Score', 'Max Score', 'Time spent in sec', 'Remarks']);
    	for(var i=0; i<self.reports.length; i++){
    		var report = self.reports[i];
    		var statusinfo = report.statusinfo || {};
    		var lessonReports = report.lessonReports || {};
    		var courseForReport = self.courses[self.reports[i].courseid];
    		var courseItems = courseForReport['content']['modules'];
    		for (var j=0; j < courseItems.length; j++){
    			var courseItem=courseItems[j];
    			var sinfo = statusinfo[courseItem['id']] || {};
    			var linfo = lessonReports[courseItem['id']] || {};
				data.push(_addStatusRowForCourseItem(courseForReport, courseItem, report, sinfo, linfo));
    		}
    	}
    	var fileName = nl.fmt2('CourseReport-{}', nl.fmt.date2Str(new Date(), 'date'));
		nlExporter.exportArrayTableToCsv(fileName, data, pl, function(size) {
            pl.imp(nl.fmt2('Exported {} chart data records', data.length)); 
            self.setProgress('step3');
            resolve(true);
		}, function(e) {
		    reject(e);
		});
    }    
    
    function _addStatusRowForCourseItem(courseForReport, courseItem, report, statusinfo, lessonReport, data){
    	var itemDetails = {};
    	
    	var status = lessonReport.completed ? 'done' : (statusinfo.status || '');
    	var startedon = lessonReport.started || '';
    	var completedon = lessonReport.ended  || statusinfo.date || '';
    	var score = lessonReport.score || '';
    	var maxScore = lessonReport.maxScore || '';
    	var timeSpentSeconds = lessonReport.timeSpentSeconds || '';
    	var remarks = statusinfo.remarks || '';
    	return ['id=' + report.assignid, 'id=' + report.courseid, report.assignmentremark, 
    	   'id=' + report.userid, report.username, courseForReport.name, courseItem.name, courseItem.id, 
    	   courseItem.type, courseItem.planned_date || '', status, startedon, completedon,
    	   score, maxScore, timeSpentSeconds, remarks];
    }
}
//-------------------------------------------------------------------------------------------------
module_init();
})();

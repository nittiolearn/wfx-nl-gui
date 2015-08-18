(function() {

//-------------------------------------------------------------------------------------------------
// course_view.js:
// course_view module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.course_view', [])
	.config(configFn).controller('nl.CourseViewCtrl', NlCourseViewCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.course_view', {
		url : '/course_view',
		views : {
			'appContent' : {
				templateUrl : 'view_controllers/course/course_view.html',
				controller : 'nl.CourseViewCtrl'
			}
		}
	});
}];

function ModeHandler(nl, nlCourse) {
	var MODES = {PRIVATE: 0, PUBLISHED: 1, REPORT_VIEW: 2, DO: 3};
	var MODE_NAMES = {'private': 0, 'published': 1, 'report_view': 2, 'do': 3};
	this.mode = MODES.PRIVATE;
	this.courseId = null;
	this.initMode = function() {
		var params = nl.location.search();
		if (!('mode' in params) || !(params.mode in MODE_NAMES)) return false;
		this.mode = MODE_NAMES[params.mode];
		if (!('id' in params)) return false;
		this.courseId = parseInt(params.id);
		return true;
	};

	this.initTitle = function(course) {
        nl.pginfo.pageTitle = course.name;
		if (this.mode === MODES.PRIVATE) {
	        nl.pginfo.pageSubTitle = nl.t('(private)');
		} else if (this.mode === MODES.PUBLISHED) {
	        nl.pginfo.pageSubTitle = nl.t('(published)');
		} else if (this.mode === MODES.REPORT_VIEW) {
	        nl.pginfo.pageSubTitle = nl.t('({})', course.studentname);		} else if (this.mode === MODES.DO) {
	        nl.pginfo.pageSubTitle = nl.t('({})', course.studentname);
		} 
	};
	
	this.getCourse = function(course) {
		if (this.mode === MODES.PRIVATE || this.mode === MODES.PUBLISHED) {
			return nlCourse.courseGet(this.courseId);
		}
		if (this.mode === MODES.REPORT_VIEW) {
			return nlCourse.courseGetReport(this.courseId, false);
		}
		return nlCourse.courseGetReport(this.courseId, true);
	};
	
	this.getContent = function(course) {
		if (this.mode === MODES.PRIVATE) return course.content;
		return course.published_content;
	};

	this.getLessonLink = function(refid) {
		if (this.mode === MODES.PRIVATE || this.mode === MODES.PUBLISHED) {
			return nl.fmt2('/lesson/view/{}', refid);
		}
		if (this.mode === MODES.REPORT_VIEW) {
			return nl.fmt2('/lesson/view_report_assign/{}', refid);
		}
		return nl.fmt2('/lesson/do_report_assign/{}', refid);
	};

	this.shallShowScore = function() {
		return (this.mode === MODES.REPORT_VIEW || this.mode === MODES.DO);
	};

	this.shallCreateLessonReport = function(course) {
		return (this.mode === MODES.DO);
	};
}

//-------------------------------------------------------------------------------------------------
var NlCourseViewCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCourse',
function(nl, nlRouter, $scope, nlDlg, nlCourse) {
	var modeHandler = new ModeHandler(nl, nlCourse);
	function _onPageEnter(courseInfo) {
		return nl.q(function(resolve, reject) {
			var params = nl.location.search();
			if (!('id' in params) || !modeHandler.initMode()) {
				nlDlg.popupStatus(nl.t('Invalid url'));
				resolve(false);
				return;
			}
			$scope.showScore = modeHandler.shallShowScore();
			var courseId = parseInt(params.id);
			modeHandler.getCourse().then(function(course) {
				modeHandler.initTitle(course);
				var content = modeHandler.getContent(course);
				for(var i=0; i<content.length; i++) {
					_initModule(modeHandler, course, content[i]);
				}
				$scope.content = content;
				resolve(true);
			});
		});
	}

	nlRouter.initContoller($scope, '', _onPageEnter);

	$scope.getIcon = function(cm) {
		var icon = ('icon' in cm) ? cm.icon : cm.type;
		if (icon in _icons) return _icons[icon];
		return icon;
	};
	
	$scope.onClick = function(cm) {
		if (cm.type === 'lesson') {
            nl.window.location.href = nl.fmt2('/lesson/view/{}', cm.refid);
		}
		else if(cm.type === 'quiz') {
			nl.window.location.href = nl.fmt2('/quiz/view/{}');
		}
		else if(cm.type === 'module') {
			_toggleModule(cm);	
		}
	};
	
	var _icons = {
		'module': nl.url.resUrl('general/cm-module.png'),
		'lesson': nl.url.resUrl('general/cm-lesson.png'),
		'quiz': nl.url.resUrl('general/cm-quiz.png')
	};

	function _initModule(modeHandler, course, cm) {
		var idParts = cm.id.split('.');
		cm.indent = [];
		for (var j=0; j<idParts.length-1; j++) {
			cm.indent.push(j);
		}
		cm.isOpen = (cm.indent.length === 0);
		cm.visible = (cm.indent.length <= 1);
		cm.statusIcon = null;
		cm.scoreText = '-';
		
		if (!modeHandler.shallShowScore()) return;
		if (cm.type !== 'lesson' || !('refid' in cm) || !('lessonReports' in course)) return;
		var refid = cm.refid.toString();
		if (!(refid in course.lessonReports)) return;
		var lessonReport = course.lessonReports[refid];
		var completed = 'completed' in lessonReport ? lessonReport.completed : false;
		var maxScore = 'maxScore' in lessonReport ? parseInt(lessonReport.maxScore) : 0;
		if (!completed || maxScore === 0) return;
		
		cm.statusIcon = nl.url.resUrl('general/tick.png');
		var score = 'score' in lessonReport ? lessonReport.score : 0;
		var perc = Math.round(score/maxScore*100);
		cm.scoreText = nl.fmt2('{}% ({}/{})', perc, score, maxScore);
	}
	 
	function _toggleModule(cm) {
		var bOpen = !cm.isOpen;
		for (var i=0; i<$scope.content.length; i++) {
			var m = $scope.content[i];
			if (m.id.indexOf(cm.id) !== 0) continue;
			
			if (m.id === cm.id) {
				m.isOpen = bOpen;
				m.visible = true;
				continue;
			} 
			
			if (m.indent.length === cm.indent.length + 1) {
				m.isOpen = false;
				m.visible = bOpen;
				continue;
			}
			m.isOpen = false;
			m.visible = false;
		}
	}
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();
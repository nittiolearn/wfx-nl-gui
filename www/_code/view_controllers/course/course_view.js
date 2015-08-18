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

//-------------------------------------------------------------------------------------------------
var NlCourseViewCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCourse',
function(nl, nlRouter, $scope, nlDlg, nlCourse) {
	function _onPageEnter(courseInfo) {
		return nl.q(function(resolve, reject) {
			var params = nl.location.search();
			if (!('id' in params)) {
				nlDlg.popupStatus('Invalid url');
				resolve(false);
				return;
			}
			var courseId = parseInt(params.id);
			var published = ('published' in params) ? (parseInt(params.published) == 1) : false;
			nlCourse.courseGet(courseId).then(function(course) {
				var content = published ? course.published_content : course.content;
				for(var i=0; i<content.length; i++) {
					_initModule(content[i]);
				}
				nl.pginfo.pageTitle = nl.t('Course View: {} ', course.name);
				$scope.content = content;
				var lessons = [];
				$scope.lessons=[{"refid":"123","score":"100", "maxscore":"100"},
					{"refid":"124", "score":"100", "maxscore":"100"},
					{"refid":"125", "score":"80", "maxscore":"100"},
					{"refid":"126", "score":"70", "maxscore":"100"},
					{"refid":"127", "score":"50", "maxscore":"100"}
				];
				var statusIcon={};
				$scope.statusIcon={
					'stIcon': nl.url.resUrl('general/tick.png')
				};
				resolve(true);
			});
		});
	}

	nlRouter.initContoller($scope, '', _onPageEnter);

	var _icons = {
		'module': nl.url.resUrl('general/cm-module.png'),
		'lesson': nl.url.resUrl('general/cm-lesson.png'),
		'quiz': nl.url.resUrl('general/cm-quiz.png')
	};

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
	
	function _initModule(cm) {
		var idParts = cm.id.split('.');
		cm.indent = [];
		for (var j=0; j<idParts.length-1; j++) {
			cm.indent.push(j);
		}
		cm.isOpen = (cm.indent.length === 0);
		cm.visible = (cm.indent.length <= 1);
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
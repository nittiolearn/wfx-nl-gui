(function() {

//-------------------------------------------------------------------------------------------------
// course_view.js:
// course_view module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.course_view', [])
	.config(configFn).controller('nl.courseViewCtrl', NlCourseViewCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.course_view', {
		url : '/course_view',
		views : {
			'appContent' : {
				templateUrl : 'view_controllers/course/course_view.html',
				controller : 'nl.courseViewCtrl'
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
				nl.pginfo.pageTitle = nl.t('Course View: {}', course.name);
				$scope.content = content;
				resolve(true);
			});
		});
	}

	nlRouter.initContoller($scope, '', _onPageEnter);

	var _icons = {
		//'module': nl.url.resUrl('general/cm-module.png'),
		'module': 'http://www.clker.com/cliparts/e/9/1/5/11949844541225832782box_with_folders_nicu_bu_01.svg.thumb.png',
		'lesson': 'http://www.clker.com/cliparts/e/3/0/f/11949896971812381266light_bulb_karl_bartel_01.svg.thumb.png',
		'quiz': 'http://www.clker.com/cliparts/9/9/f/4/119498595413718994help-books-aj.svg_aj_ash_01.svg.thumb.png'
	};

	$scope.getIcon = function(cm) {
		var icon = ('icon' in cm) ? cm.icon : cm.type;
		if (icon in _icons) return _icons[icon];
		return icon;
	};
	
	$scope.onClick = function(cm) {
		if (cm.type === 'lesson') {
            nl.window.location.href = nl.fmt2('/lesson/view/{}', cm.refid);
			return;
		}
		_toggleModule(cm);
	};
	
	function _initModule(cm) {
		var idParts = cm.id.split('.');
		cm.indent = [];
		for (var j=0; j<idParts.length-1; j++) {
			cm.indent.push(j);
		}
		cm.visible = (cm.indent.length <= 1);
	}
	
	function _toggleModule(cm) {
		var myId = cm.id;
		for (var i=0; i<$scope.content.length; i++) {
			var m = $scope.content[i];
			if (m.id.indexOf(myId) !== 0 || m.id === myId) continue;
			m.visible = !m.visible;
		}
	}
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

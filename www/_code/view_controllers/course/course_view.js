(function() {

//-------------------------------------------------------------------------------------------------
// course_view.js:
// course_view module for experimentation
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
var NlCourseViewCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlServerApi',
function(nl, nlRouter, $scope, nlDlg, nlServerApi) {
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
			$scope.courseInfo = nlServerApi.courseGet(courseId);
			var content = published ? $scope.courseInfo.published_content : $scope.courseInfo.content;
			for(var i=0; i<content.length; i++) {
				var module = content[i];
				_initModule(module);
			}
			nl.pginfo.pageTitle = nl.t('Course View: {}', $scope.courseInfo.name);
			resolve(true);
		});
	}

	nlRouter.initContoller($scope, '', _onPageEnter);

	var _icons = {
		'module': 'http://www.clker.com/cliparts/e/9/1/5/11949844541225832782box_with_folders_nicu_bu_01.svg.thumb.png',
		'lesson': 'http://www.clker.com/cliparts/e/3/0/f/11949896971812381266light_bulb_karl_bartel_01.svg.thumb.png',
		'quiz': 'http://www.clker.com/cliparts/9/9/f/4/119498595413718994help-books-aj.svg_aj_ash_01.svg.thumb.png'
	};

	$scope.getIcon = function(module) {
		var icon = ('icon' in module) ? module.icon : module.type;
		if (icon in _icons) return _icons[icon];
		return icon;
	};
	
	$scope.onClick = function(module) {
		if (module.type !== 'module') {
			nlDlg.popupStatus('TODO: Lesson Item clicked');
			return;
		}
		nlDlg.popupStatus('TODO: Module Item clicked ??');
		_toggleModule(module);
	};
	
	function _initModule(module) {
		var idParts = module.id.split('.');
		module.indent = [];
		for (var j=0; j<idParts.length-1; j++) {
			module.indent.push(j);
		}
		module.visible = (module.indent.length <= 1);
	}
	
	function _toggleModule(module) {
		var myId = module.id;
		for (var i=0; i<$scope.courseInfo.content.length; i++) {
			var m = $scope.courseInfo.content[i];
			if (m.id.indexOf(myId) !== 0 || m.id === myId) continue;
			m.visible = !m.visible;
		}
	}
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

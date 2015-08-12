(function() {

//-------------------------------------------------------------------------------------------------
// course_list.js:
// course module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.course_list', [])
	.config(configFn)
	.controller('nl.CourseListCtrl', CourseListCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.course_list', {
		url : '/course_list',
		views : {
			'appContent' : {
				templateUrl : 'lib_ui/cards/cardsview.html',
				controller : 'nl.CourseListCtrl'
			}
		}});
}];

var CourseListCtrl = ['nl', 'nlRouter', '$scope', 'nlCourse', 'nlDlg',
function(nl, nlRouter, $scope, nlCourse, nlDlg) {
	var courseDict = {};
	var my = false;
	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
			nl.pginfo.pageTitle = nl.t('Courses');
			courseDict = {};

	        var params = nl.location.search();
	        my = ('my' in params) ? parseInt(params.my) == 1: false;

			nlCourse.courseGetList(my).then(function(courseList) {
				nl.log.debug('Got courses: ', courseList.length);
				$scope.cards = _getCourseCards(courseList);
				resolve(true);
			}, function(reason) {
                resolve(false);
			});
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    $scope.onCardInternalUrlClicked = function(internalUrl) {
		if (internalUrl === 'course_create') {
			_createOrModifyCourse(null);
		}
    };

	$scope.onCardLinkClicked = function(card, linkid) {
		if (linkid === 'course_modify') {
			_createOrModifyCourse(card.courseId);
		} else if (linkid === 'course_delete') {
			_deleteCourse(card.courseId);
		}
	};
	$scope.select = ['hello', 'hai', 'naveen'];
	function _getCourseCards(courseList) {
		var cards = [];
		_addStaticCard(cards);
		_addCreatedCard(cards);
		for (var i = 0; i < courseList.length; i++) {
			var course = courseList[i];
			courseDict[course.id] = course;
			var url = nl.fmt2('#/app/course_view?id={}', course.id);
			if (!my) url += '&published=1';
			var card = {courseId: course.id,
						title: course.name, 
						icon: course.icon, 
						url: url,
						help: course.description,
						content: course.content, 
						children: []};
			card.details = {help: card.help, avps: _getAvps(course)};
			card.links = [{id: 'course_modify', text: nl.t('modify')},
						  {id: 'course_delete', text: nl.t('delete')},
						  {id: 'details', text: nl.t('details')}];
			cards.push(card);
		}
		return cards;
	}
	
	function _getAvps(course) {
		var avps = [];
		avps.push({attr: nl.t('Name'), val: course.name});
		avps.push({attr: nl.t('Author'), val: course.authorname});
		avps.push({attr: nl.t('Group'), val: course.grpname});
		avps.push({attr: nl.t('Updated by'), val: course.updated_by_name});
		avps.push({attr: nl.t('Created on'),  val: _formatDate(course.created)});
		avps.push({attr: nl.t('Updated on'), val: _formatDate(course.updated)});
		avps.push({attr: nl.t('Published on'), val: _formatDate(course.published)});
		avps.push({attr: nl.t('Is published?'), val: course.is_published});
		avps.push({attr: nl.t('Description'), val: course.description});
		return avps;
	}

	function _formatDate(jsonDate) {
		if (jsonDate) return nl.fmt.jsonDate2Str(jsonDate);
		return '-';
	}

	function _addStaticCard(cards) {
		var card = {title: nl.t('Create'), 
					icon: 'http://www.clker.com/cliparts/0/o/y/h/1/H/folder-new-th.png', 
					internalUrl: 'course_create',
					help: nl.t('You can create a new course by clicking on this card'), 
					children: [], style: 'nl-bg-blue'};
		card.links = [];
		cards.push(card);
	}

	function _addCreatedCard(cards) {
	}

	function _deleteCourse(courseId) {
		nlDlg.showLoadingScreen();
		nlCourse.courseDelete(courseId).then(function(status) {
			nlDlg.hideLoadingScreen();
			nlDlg.popupAlert({title:'TODO', template:'Actual adjusting of cards to be implemented'});
		});	
	}
	
	function _createOrModifyCourse(courseId) {
		var modifyDlg = nlDlg.create($scope);
		if (courseId !== null) {
			var course = courseDict[courseId];
			$scope.dlgTitle = nl.t('Modify course');
			modifyDlg.scope.data = {name: course.name, icon: course.icon, 
									description: course.description, content: angular.toJson(course.content, 2)};
		} else {
			$scope.dlgTitle = nl.t('Create a new course');
			modifyDlg.scope.data = {name: '', icon: '', 
									description: '', content: ''};
		}
		
		var buttons = [];
		var saveName = (courseId !== null) ? nl.t('Save') : nl.t('Create');
		var saveButton = {
			text : saveName,
			onTap : function(e) {
				_onCourseSave(modifyDlg, courseId, false);
			}
		};
		buttons.push(saveButton);
		
		if (courseId !== null) {
			var publishButton = {
				text : nl.t('Publish'),
				onTap : function(e) {
					_onCourseSave(modifyDlg, courseId, true);
				}
			};
			buttons.push(publishButton);
		}

		var cancelButton = {
			text : nl.t('Cancel')
		};
		modifyDlg.show('view_controllers/course/coursecreatedlg.html',
			buttons, cancelButton, false);
	}

	function _onCourseSave(modifyDlg, courseId, bPublish) {
		nlDlg.showLoadingScreen();

		var data = {
			name: modifyDlg.scope.data.name, 
			icon: modifyDlg.scope.data.icon, 
			description: modifyDlg.scope.data.description,
			content: modifyDlg.scope.data.content 
		};
		
		if (courseId != null) data.courseid = courseId;
		if (bPublish) data.publish = true;
		var crModFn = (courseId != null) ? nlCourse.courseModify: nlCourse.courseCreate;
		crModFn(data).then(function(courseId) {
			nlDlg.hideLoadingScreen();
			nlDlg.popupAlert({title:'TODO', template:'Actual adjusting of cards to be implemented'});
        });
	}

}];

module_init();
})();

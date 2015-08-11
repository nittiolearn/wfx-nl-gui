(function() {

//-------------------------------------------------------------------------------------------------
// course_admin.js:
// course module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.course_admin', [])
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

var CourseListCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg',
function(nl, nlRouter, $scope, nlServerApi, nlDlg) {
	var courseDict = {};
	var my = false;
	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
			nl.pginfo.pageTitle = nl.t('Courses');
			courseDict = {};

	        var params = nl.location.search();
	        my = ('my' in params) ? parseInt(params.my) == 1: false;

			nlServerApi.courseGetList().then(function(courseList) {
				nl.log.debug('Got courses: ', courseList.length);
				$scope.cards = _getCourseCards(courseList);
				resolve(true);
			});
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    $scope.onCardInternalUrlClicked = function(internalUrl) {
		if (internalUrl === 'course_create') {
			_createCourse();
		}
    };

	$scope.onCardLinkClicked = function(card, linkid) {
		if (linkid === 'course_modify') {
			_modifyCourse(card.courseId);
		} else if (linkid === 'course_delete') {
			_deleteCourse(card.courseId);
		}
	};
	
	function _getCourseCards(courseList) {
		var cards = [];
		_addStaticCard(cards);
		_addCreatedCard(cards);
		for (var i = 0; i < courseList.length; i++) {
			var course = courseList[i];
			courseDict[course.id] = course;
			var card = {courseId: course.id,
						title: course.name, 
						icon: course.icon, 
						url: nl.fmt2('#/app/course_view?id={}', course.id),
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
		avps.push({attr: nl.t('Created on'), val: course.created});
		avps.push({attr: nl.t('Updated on'), val: course.updated});
		avps.push({attr: nl.t('Published on'), val: course.published});
		avps.push({attr: nl.t('Is published?'), val: course.is_published});
		avps.push({attr: nl.t('Description'), val: course.description});
		return avps;
	}

	function _addStaticCard(cards) {
		var card = {title: nl.t('Create'), 
					icon: 'http://www.clker.com/cliparts/0/o/y/h/1/H/folder-new-th.png', 
					urlInternal: 'course_create',
					help: nl.t('You can create a new course by clicking on this card'), 
					children: [], style: 'nl-bg-blue'};
		card.links = [];
		cards.push(card);
	}

	function _createCourse() {
		// Show the create form
		// onTap of create button: call server api
		// then of serverapi - _addCreatedCard
		nlDlg.popupAlert({title:'TODO', template:'Create to be implemented'});
	}
	
	function _addCreatedCard(cards) {
		// add element to cards as well as courseDict
		var card = {title: nl.t('Create'), 
					icon: 'http://www.clker.com/cliparts/0/o/y/h/1/H/folder-new-th.png', 
					urlInternal: 'course_create',
					help: nl.t('You can create a new course by clicking on this card'), 
					children: [], style: 'nl-bg-blue'};
		card.links = [];
		cards.push(card);		
	}

	function _deleteCourse(courseId) {
		nlDlg.popupAlert({title:nl.fmt2('TODO: delete {}', courseId), 
						template:'Delete to be implemented'});
	}
	
	function _modifyCourse(courseId) {
		var course = courseDict[courseId];
		var modifyDlg = nlDlg.create($scope);
		modifyDlg.scope.data = {name: course.name, icon: course.icon, 
								description: course.description, content: course.content};
		var saveButton = {
			text : nl.t('Save'),
			onTap : function(e) {
				nlDlg.popupAlert({title:'TODO', template:'Actual save to be implemented'});
			}
		};
		
		var publishButton = {
			text : nl.t('Publish'),
			onTap : function(e) {
				e.preventDefault();
				modifyDlg.close(false);
				nlDlg.popupAlert({title:'TODO', tempate:'Actual publish to be implemented'});
			}
		};

		var cancelButton = {
			text : nl.t('Cancel')
		};
		modifyDlg.show('view_controllers/course/coursecreatedlg.html',
		[saveButton, publishButton], cancelButton,  false);
	}
}];

module_init();
})();

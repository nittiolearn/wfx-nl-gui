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
	var serverApi = _getServerApi(nlServerApi, nl);
	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
			nl.pginfo.pageTitle = nl.t('Courses');
			var courseCards = serverApi.getCourseList();
			// var card = [];
			// for(var key in courseCards) {
				// card.push({id: courseCards.id, title: courseCards.name, icon: courseCards.icon, url: courseCards.url,
				// children : courseCards.children, style : courseCards.style});
			// }
			// console.log(card);
			console.log(courseCards);
			$scope.cards = _getCourseCards(courseCards);
			resolve(true);
		});
	}

	nlRouter.initContoller($scope, '', _onPageEnter);

	function _getCourseCards(courseCards) {
		var ret = {
			columnNames : [],
			cardlist : courseCards
		};
		_updateDetails(ret.cardlist);
		return ret;
	}

	function _updateDetails(cardlist) {
		for (var i = 1; i < cardlist.length; i++) {
			var card = cardlist[i];
			card.details = {
				help : card.help,
				links : card.children,
				multiLineLinks : false,
				columnValues : []
			};
			card.modify = {
				help : card.help,
				links : card.children,
				multiLineLinks : true,
				columnValues : []
			};
			card.delet = {
				help : card.help,
				links : card.children,
				multiLineLinks : true,
				columnValues : []
			};

			card.links = [ nl.t('modify'), nl.t('details'), nl.t('delete')];
		}
	}

	$scope.onLinkClicked = function(card, link) {
		if (link == 'modify') {
			var modifyDlg = nlDlg.create($scope);
			modifyDlg.scope.card = card;
			var createButton = {
				text : nl.t('Create'),
				onTap : function(e) {
					e.preventDefault();
					modifyDlg.close(false);
					nlDlg.showLoadingScreen(1000);
				}
			};
			var cancelButton = {
				text : nl.t('Cancel')
			};
			modifyDlg.show('view_controllers/course/coursecreatedlg.html',
			[createButton], cancelButton,  false);
		}
	};
}];

function _getServerApi(nlServerApi, nl) {
	return new nlDummyServerApi(nl);
	//return nlServerApi();
}

function nlDummyServerApi(nl) {
	this.getCourseList = function() {
		var courseCards = [{
			"id" : "1",
			"title" : "Create",
			"url" : "#/app/course_create",
			"icon" : "http://www.clker.com/cliparts/0/o/y/h/1/H/folder-new-th.png",
			"children" : [{
				"id" : "",
				"title" : "Create a new course",
				"url" : "#/app/course_create",
				"icon" : "http://www.clker.com/cliparts/b/0/2/7/1348606952503171588New%20Folder%20Icon.svg.med.png",
				"children" : []
			}],
			"style" : "nl-bg-blue"
		}, {
			"id" : "",
			"title" : "Course1",
			"description" : "this is my first course",
			"content" : "content",
			"owner" : "naveen.headstart",
			"ownerName" : "Naveen Kumar",
			"groupName" : "Head Start",
			"updatedBy" : "sachin.headstart",
			"updatedByName" : "sachin",
			"created" : "8/8/2015",
			"updated" : "9/8/2015",		
			"url" : "#/app/course1",
			"icon" : "http://www.clker.com/cliparts/0/2/9/6/1194985788390709558hotel_icon_golf_course_g_01.svg.thumb.png",
			"children" : []
		}, {
			"id" : "",
			"title" : "Course2",
			"description" : "this is my first course",
			"content" : "content",
			"owner" : "naveen.headstart",
			"ownerName" : "Naveen",
			"groupName" : "jumbo kids",
			"updatedBy" : "sachin.jumbo",
			"updatedByName" : "sachin",
			"created" : "8/8/2015",
			"updated" : "9/8/2015",		
			"url" : "#/app/course2",
			"icon" : "http://www.clker.com/cliparts/3/d/H/b/r/G/free-course-th.png",
			"children" : []
		}, {
			"id" : "",
			"title" : "Course3",
			"description" : "this is my first course",
			"content" : "content",
			"owner" : "naveen.headstart",
			"ownerName" : "Naveen Kumar",
			"groupName" : "Nittio Learn",
			"updatedBy" : "sachin.nittio",
			"updatedByName" : "sachin",
			"created" : "8/8/2015",
			"updated" : "9/8/2015",		
			"url" : "#/app/course3",
			"icon" : "http://www.clker.com/cliparts/3/f/a/e/12588368191287315303laurenth2_ozone_troposph_rique.svg.thumb.png",
			"children" : []
		}, {
			"id" : "",
			"title" : "Course4",
			"description" : "this is my first course",
			"content" : "content",
			"owner" : "naveen.headstart",
			"ownerName" : "Naveen Kumar",
			"groupName" : "Ever green",
			"updatedBy" : "sachin.evergreen",
			"updatedByName" : "Bunna",
			"created" : "8/8/2015",
			"updated" : "9/8/2015",		
			"url" : "#/app/course4",
			"icon" : "http://www.clker.com/cliparts/d/E/O/T/F/Q/globe-th.png",
			"children" : []
		}];
		return courseCards;
	};
};

var CourseCreateCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg',
function(nl, nlRouter, $scope, nlServerApi, nlDlg) {
	var createCourseDlg = nlDlg.create($scope);

	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
			nl.pginfo.pageTitle = nl.t('Create a new course');
			createCourseDlg.scope.data = {
				name : 'naveen',
				icon : '',
				description : 'hi',
				structure : ''
			};
			resolve(true);
			_showCourseCreateDlg();
		});
	}

	function _onPageLeave() {
		createCourseDlg.close(false);
	}


	nlRouter.initContoller($scope, '', _onPageEnter, _onPageLeave);

	function _showCourseCreateDlg() {
		var createButton = {
			text : nl.t('Create'),
			onTap : function(e) {
				e.preventDefault();
				createCourseDlg.close(false);
				nlDlg.showLoadingScreen(1000);
			}
		};
		var cancelButton = {
			text : nl.t('Cancel')
			// onTap : function(e) {
				// e.preventDefault();
				// createCourseDlg.destroy();
                // nl.window.location.href = '/';			
			//}
		};
		createCourseDlg.show('view_controllers/course/coursecreatedlg.html', 
			[createButton], cancelButton, false);
	}
}];
var CourseModifyCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg',
	function(nl, nlRouter, $scope, nlServerApi, nlDlg) {
		
	}];
module_init();
})();

(function() {

//-------------------------------------------------------------------------------------------------
// course_list.js:
// course module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.course_list', [])
	.config(configFn)
	.controller('nl.CourseListCtrl', CourseListCtrl)
	.controller('nl.CourseAssignListCtrl', CourseAssignListCtrl)
	.controller('nl.CourseReportListCtrl', CourseReportListCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.course_list', {
		url: '/course_list',
		views: {
			'appContent': {
				templateUrl: 'lib_ui/cards/cardsview.html',
				controller: 'nl.CourseListCtrl'
			}
		}});
	$stateProvider.state('app.course_assign_list', {
		url: '/course_assign_list',
		views: {
			'appContent': {
				templateUrl: 'lib_ui/cards/cardsview.html',
				controller: 'nl.CourseAssignListCtrl'
			}
		}});
	$stateProvider.state('app.course_report_list', {
		url: '/course_report_list',
		views: {
			'appContent': {
				templateUrl: 'lib_ui/cards/cardsview.html',
				controller: 'nl.CourseReportListCtrl'
			}
		}});
}];

var CourseListCtrl = ['nl', 'nlRouter', '$scope', 'nlCourse', 'nlDlg',
function(nl, nlRouter, $scope, nlCourse, nlDlg) {
	_listCtrlImpl('course', nl, nlRouter, $scope, nlCourse, nlDlg);
}];

var CourseAssignListCtrl = ['nl', 'nlRouter', '$scope', 'nlCourse', 'nlDlg',
function(nl, nlRouter, $scope, nlCourse, nlDlg) {
	_listCtrlImpl('assign', nl, nlRouter, $scope, nlCourse, nlDlg);
}];

var CourseReportListCtrl = ['nl', 'nlRouter', '$scope', 'nlCourse', 'nlDlg',
function(nl, nlRouter, $scope, nlCourse, nlDlg) {
	_listCtrlImpl('report', nl, nlRouter, $scope, nlCourse, nlDlg);
}];

function _listCtrlImpl(type, nl, nlRouter, $scope, nlCourse, nlDlg) {
	/* 
	 * URLs handled
	 * 'View published' : /app/course_list?type=course&my=0
	 * 'Edit my' : /app/course_list?type=course&my=1
	 * 'Assigned courses' : /app/course_list?type=assign
	 * 'Report of assignment' : /app/course_list?type=report&assignid=xx
	 * 'Report of user' : /app/course_list?type=report
	 */
	
	var courseDict = {};
	var my = false;
	var assignId = 0;

	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
			_initParams();
			nl.pginfo.pageTitle = _getPageTitle();
			_listingFunction().then(function(resultList) {
				nl.log.debug('Got result: ', resultList.length);
				$scope.cards = _getCards(userInfo, resultList);
				resolve(true);
			}, function(reason) {
                resolve(false);
			});
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    $scope.onCardInternalUrlClicked = function(internalUrl) {
		if (internalUrl === 'course_create') {
			_createOrModifyCourse($scope, null);
		}
    };

	$scope.onCardLinkClicked = function(card, linkid) {
		if (linkid === 'course_modify') {
			_createOrModifyCourse($scope, card.courseId);
		} else if (linkid === 'course_delete') {
			_deleteCourse($scope, card.courseId);
		} else if (linkid === 'course_assign'){
			_assignCourse(card.courseId);
		}
	};

	function _initParams() {
		courseDict = {};
        var params = nl.location.search();
        my = ('my' in params) ? parseInt(params.my) == 1: false;
        assignId = ('assignid' in params) ? parseInt(params.assignid) : 0;
	}

	function _getPageTitle() {
		if (type === 'course') {
			return 	(my == true) ? nl.t('Edit courses'): nl.t('Published courses');
		}
		if (type === 'assign') {
			return 	nl.t('Assignd courses');
		}
		if (type === 'report') {
			return 	(assignId == 0) ? nl.t('My courses'): nl.t('Course reports');
		}
	}

	function _listingFunction() {
		if (type === 'course') {
			return nlCourse.courseGetList(my);
		}
		if (type === 'assign') {
			return nlCourse.courseGetAssignmentList(false);
		}
		if (type === 'report' && assignId !== 0) {
			return nlCourse.courseGetAssignmentReportList(assignId);
		}
		return nlCourse.courseGetMyReportList();
	}
	
	function _getCards(userInfo, resultList) {
		var cards = [];
		if (type === 'course' && my) _addStaticCard(cards);
		for (var i = 0; i < resultList.length; i++) {
			var card = _createCard(resultList[i], userInfo);
			cards.push(card);
		}
		return cards;
	}
	
	function _createCard(cardInfo, userInfo) {
		if (type === 'course') return _createCourseCard(cardInfo, userInfo);
		if (type === 'assign') return _createReportCard(cardInfo, false);
		return _createReportCard(cardInfo, true);
	}
	
	function _createCourseCard(course, userInfo) {
		courseDict[course.id] = course;
		var mode = my ? 'private' : 'published';
		var url = nl.fmt2('#/app/course_view?id={}&mode={}', course.id, mode);
	    var card = {courseId: course.id,
	    			title: course.name, 
					icon: course.icon, 
					url: url,
					help: course.description,
					children: []};
		card.details = {help: card.help, avps: _getCourseAvps(course)};
		card.links = [];
		if (my) { 
			card.links.push({id: 'course_modify', text: nl.t('modify')});
			card.links.push({id: 'course_delete', text: nl.t('delete')});
		} else if(nlRouter.isPermitted(userInfo, 'course_assign')) {
			card.links.push({id: 'course_assign', text: nl.t('assign')});	
		}
		card.links.push({id: 'details', text: nl.t('details')});
		return card;
	}
	
	function  _getCourseAvps(course) {
		var avps = [];
		_addAvp(avps, 'Name', course.name);
		_addAvp(avps, 'Author', course.authorname);
		_addAvp(avps, 'Group', course.grpname);
		_addAvp(avps, 'Updated by', course.updated_by_name);
		_addAvp(avps, 'Created on', course.created, 'date');
		_addAvp(avps, 'Updated on', course.updated, 'date');
		_addAvp(avps, 'Published on', course.published, 'date');
		_addAvp(avps, 'Is published?', course.is_published, 'boolean');
		_addAvp(avps, 'Description', course.description);
		return avps;
	}

	function _createReportCard(report, isReport) {
		var url = nl.fmt2('#/app/course_report_list?assignid={}', report.id);
		var title = report.name;
		if (isReport) {
			title = (assignId === 0) ? report.name : report.studentname;
			var mode = (assignId === 0) ? 'do' : 'report_view';
			var url = nl.fmt2('#/app/course_view?id={}&mode={}', 
						report.id, mode);
		}
	    var card = {
				title: title, 
				icon: report.icon, 
				url: url,
				help: report.remarks,
				children: []};
		card.details = {help: card.help, avps: _getReportAvps(report)};
		card.links = [{id: 'details', text: nl.t('details')}];
		return card;
	}

	function  _getReportAvps(report, isReport) {
		var assignedTo = report.assigned_to;
		if (isReport) {
			assignedTo = nl.fmt2('{} - {}', report.studentname, report.assigned_to);
		}
		var avps = [];
		_addAvp(avps, 'Name', report.name);
		_addAvp(avps, 'Course Author', report.courseauthor);
		_addAvp(avps, 'Assigned by', report.sendername);
		_addAvp(avps, 'Assigned to', assignedTo);
		_addAvp(avps, 'Group', report.grpname);
		_addAvp(avps, 'Created on', report.created, 'date');
		_addAvp(avps, 'Updated on', report.updated, 'date');
		_addAvp(avps, 'Is published?', report.is_published, 'boolean');
		_addAvp(avps, 'Remarks', report.remarks);
		_addAvp(avps, 'Start time', report.not_before, 'date');
		_addAvp(avps, 'End time', report.not_after, 'date');
		_addAvp(avps, 'Max duration', report.max_duration);
		return avps;
	}

	function _addAvp(avps, fieldName, fieldValue, fmtType) {
		if (fmtType == 'date') fieldValue = _formatDate(fieldValue);
		if (fmtType == 'boolean') fieldValue = fieldValue ? nl.t('Yes') : nl.t('No');
		if (!fieldValue) fieldValue = '-';
		avps.push({attr: nl.t(fieldName), val: fieldValue});
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

	function _assignCourse(courseId) {
		nlDlg.showLoadingScreen();
		var url = nl.fmt2('/assignment/create2/{}/course', courseId);
		nl.window.location.href = url;
	}

	function _deleteCourse($scope, courseId) {
		var msg = {title: 'Please confirm', 
				   template: 'Are you sure you want to delete? This cannot be undone.',
				   okText: nl.t('Delete')};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;
			nlDlg.showLoadingScreen();
			nlCourse.courseDelete(courseId).then(function(status) {
				nlDlg.hideLoadingScreen();
				if (courseId in courseDict) delete courseDict[courseId];
				for (var i in $scope.cards) {
					var card = $scope.cards[i];
					if (card.courseId !== courseId) continue;
					$scope.cards.splice(i, 1);
				}
			});	
		});
	}
	
	function _createOrModifyCourse($scope, courseId) {
		var modifyDlg = nlDlg.create($scope);
        modifyDlg.scope.error = {};
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
				_onCourseSave($scope, modifyDlg, courseId, false);
			}
		};
		buttons.push(saveButton);
		
		if (courseId !== null) {
			var publishButton = {
				text : nl.t('Publish'),
				onTap : function(e) {
					_onCourseSave($scope, modifyDlg, courseId, true);
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
	
	function _onCourseSave($scope, modifyDlg, courseId, bPublish) {
		nlDlg.showLoadingScreen();
		var modifiedData = {
			name: modifyDlg.scope.data.name, 
			icon: modifyDlg.scope.data.icon, 
			description: modifyDlg.scope.data.description,
			content: modifyDlg.scope.data.content 
		};
		if (courseId !== null) modifiedData.courseId = courseId;
		if (bPublish) modifiedData.publish = true;
		var crModFn = (courseId != null) ? nlCourse.courseModify: nlCourse.courseCreate;
		crModFn(modifiedData).then(function(course) {
			nlDlg.hideLoadingScreen();
		    _updateCourseForTesting(course, modifiedData);
		    var card = _createCourseCard(course);
			var pos = (courseId === null) ? 1 : _getCardPosition(course.courseId);
			var delLen = (courseId === null) ? 0 : 1;
			$scope.cards.splice(pos, delLen, card);			
		});
	}

	var uniqueId = 100;
	function _updateCourseForTesting(course, modifiedData) {
		if (NL_SERVER_INFO.serverType !== 'local') return;
		if ('courseId' in modifiedData) {
			course.courseId = modifiedData.courseId;
		} else {
			course.courseId = uniqueId++;
		}
		course.name  = modifiedData.name;
		course.icon  = modifiedData.icon;
		course.description  = modifiedData.description;
		course.content  = modifiedData.content;
	}

	function _getCardPosition(courseId) {
		for(var i in $scope.cards) {
			var card = $scope.cards[i];
			if(card.courseId === courseId) return i;
		}
		nl.log.error('Cannot find modified card', courseId);
		return 0;
	}
}

module_init();
})();

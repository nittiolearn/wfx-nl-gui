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

var CourseListCtrl = ['nl', 'nlRouter', '$scope', 'nlCourse', 'nlDlg', 'nlCardsSrv',
function(nl, nlRouter, $scope, nlCourse, nlDlg, nlCardsSrv) {
	_listCtrlImpl('course', nl, nlRouter, $scope, nlCourse, nlDlg, nlCardsSrv);
}];

var CourseAssignListCtrl = ['nl', 'nlRouter', '$scope', 'nlCourse', 'nlDlg', 'nlCardsSrv',
function(nl, nlRouter, $scope, nlCourse, nlDlg, nlCardsSrv) {
	_listCtrlImpl('assign', nl, nlRouter, $scope, nlCourse, nlDlg, nlCardsSrv);
}];

var CourseReportListCtrl = ['nl', 'nlRouter', '$scope', 'nlCourse', 'nlDlg', 'nlCardsSrv',
function(nl, nlRouter, $scope, nlCourse, nlDlg, nlCardsSrv) {
	_listCtrlImpl('report', nl, nlRouter, $scope, nlCourse, nlDlg, nlCardsSrv);
}];

function _listCtrlImpl(type, nl, nlRouter, $scope, nlCourse, nlDlg, nlCardsSrv) {
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
	var assignDict = {};
	var publishDict = {};

	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
			_initParams();
			nl.pginfo.pageTitle = _getPageTitle();
			_listingFunction().then(function(resultList) {
				if (resultList.length === 1 && type === 'report' && assignId === 0) {
					var url = nl.fmt2('/app/course_view?id={}&mode=do', resultList[0].id);
					nl.location.url(url);
                    nl.location.replace();
					return;
				}
				nl.log.debug('Got result: ', resultList.length);
				$scope.cards = {};
				$scope.cards.cardlist = _getCards(userInfo, resultList, nlCardsSrv);
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
		} else if (linkid === 'assignment_delete'){
			_deleteAssignment($scope, card.courseId);
		} else if (linkid === 'course_unpublish'){
			_unpublishCourse($scope, card.courseId);
		}
	};

	function _initParams() {
		courseDict = {};
		assignDict = {};
		publishDict = {};
        var params = nl.location.search();
        my = ('my' in params) ? parseInt(params.my) == 1: false;
        assignId = ('assignid' in params) ? parseInt(params.assignid) : 0;
	}

	function _getPageTitle() {
		if (type === 'course') {
			return 	(my == true) ? nl.t('Create and edit courses'): nl.t('Published courses');
		}
		if (type === 'assign') {
			return 	nl.t('Assigned courses');
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
	
	function _getCards(userInfo, resultList, nlCardsSrv) {
		var cards = [];
		if (type === 'course' && my) _addStaticCard(cards);
		for (var i = 0; i < resultList.length; i++) {
			var card = _createCard(resultList[i], userInfo);
			cards.push(card);
		}
        if (cards.length === 0) {
            return [_getEmptyCard(nlCardsSrv)];
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
			card.links.push({id: 'course_assign', text: nl.t('assign')}, {id: 'course_unpublish', text: nl.t('unpublish')});
		}
		card.links.push({id: 'details', text: nl.t('details')});
		return card;
	}
	
	function  _getCourseAvps(course) {
		var avps = [];
		nl.fmt.addAvp(avps, 'Name', course.name);
		nl.fmt.addAvp(avps, 'Author', course.authorname);
		nl.fmt.addAvp(avps, 'Group', course.grpname);
		nl.fmt.addAvp(avps, 'Updated by', course.updated_by_name);
		nl.fmt.addAvp(avps, 'Created on', course.created, 'date');
		nl.fmt.addAvp(avps, 'Updated on', course.updated, 'date');
		nl.fmt.addAvp(avps, 'Published on', course.published, 'date');
		nl.fmt.addAvp(avps, 'Is published?', course.is_published, 'boolean');
		nl.fmt.addAvp(avps, 'Description', course.description);
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
		card.details = {help: card.help, avps: _getReportAvps(report, isReport)};
		card.links = [{id: 'details', text: nl.t('details')},{id:'assignment_delete', text: nl.t('delete')}];
		return card;
	}

	function  _getReportAvps(report, isReport) {
		var assignedTo = report.assigned_to;
		var avps = [];
		nl.fmt.addAvp(avps, 'Name', report.name);
		nl.fmt.addAvp(avps, 'Course Author', report.courseauthor);
		nl.fmt.addAvp(avps, 'Assigned by', report.sendername);
		nl.fmt.addAvp(avps, 'Assigned to', assignedTo);
		if (isReport) nl.fmt.addAvp(avps, 'Report of', report.studentname);
		nl.fmt.addAvp(avps, 'Group', report.grpname);
		nl.fmt.addAvp(avps, 'Created on', report.created, 'date');
		nl.fmt.addAvp(avps, 'Updated on', report.updated, 'date');
		nl.fmt.addAvp(avps, 'Report published?', report.published, 'boolean');
		nl.fmt.addAvp(avps, 'Remarks', report.remarks);
		nl.fmt.addAvp(avps, 'Start time', report.not_before, 'date');
		nl.fmt.addAvp(avps, 'End time', report.not_after, 'date');
        nl.fmt.addAvp(avps, 'Max duration', report.max_duration);
        nl.fmt.addAvp(avps, 'Discussion forum', report.forum, 'boolean');
		return avps;
	}

	function _addStaticCard(cards) {
		var card = {title: nl.t('Create'), 
					icon: nl.url.resUrl('dashboard/course_create.png'), 
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
				for (var i in $scope.cards.cardlist) {
					var card = $scope.cards.cardlist[i];
					if (card.courseId !== courseId) continue;
					$scope.cards.cardlist.splice(i, 1);
				}
			});	
		});
	}
	
	function _deleteAssignment($scope, courseId) {
		var msg = {title: 'Please confirm', 
				   template: 'Are you sure you want to delete? This cannot be undone.',
				   okText: nl.t('Delete')};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;
			nlDlg.showLoadingScreen();
			nlCourse.assignmentDelete(courseId).then(function(status) {
				nlDlg.hideLoadingScreen();
				if (courseId in assignDict) delete assignDict[courseId];
				for (var i in $scope.cards.cardlist) {
					var card = $scope.cards.cardlist[i];
					if (card.courseId !== courseId) continue;
					$scope.cards.cardlist.splice(i, 1);
				}
			});	
		});
	}
	
	function _unpublishCourse($scope, courseId) {
		var msg = {title: 'Please confirm', 
				   template: 'Are you sure you want to unpublish? This cannot be undone.',
				   okText: nl.t('Unpublish')};
		nlDlg.popupConfirm(msg).then(function(result) {
			console.log(publishDict);
			if (!result) return;
			nlDlg.showLoadingScreen();
			nlCourse.courseUnpublish(courseId).then(function(status) {
				nlDlg.hideLoadingScreen();
				if (courseId in publishDict) delete publishDict[courseId];
				for (var i in $scope.cards.cardlist) {
					var card = $scope.cards.cardlist[i];
					if (card.courseId !== courseId) continue;
					$scope.cards.cardlist.splice(i, 1);
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
				_onCourseSave(e, $scope, modifyDlg, courseId, false);
			}
		};
		buttons.push(saveButton);
		
		if (courseId !== null) {
			var publishButton = {
				text : nl.t('Publish'),
				onTap : function(e) {
					publishDict[course.id]=course;
					_onCourseSave(e, $scope, modifyDlg, courseId, true);
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
	
	function _onCourseSave(e, $scope, modifyDlg, courseId, bPublish) {
	    if(!_validateInputs(modifyDlg.scope)) {
	        if(e) e.preventDefault();
	        return;
	    }
		nlDlg.showLoadingScreen();
		var modifiedData = {
			name: modifyDlg.scope.data.name, 
			icon: modifyDlg.scope.data.icon, 
			description: modifyDlg.scope.data.description,
			content: modifyDlg.scope.data.content 
		};
		if (courseId !== null) modifiedData.courseid = courseId;
		if (bPublish) modifiedData.publish = true;
		var crModFn = (courseId != null) ? nlCourse.courseModify: nlCourse.courseCreate;
		crModFn(modifiedData).then(function(course) {
			nlDlg.hideLoadingScreen();
		    _updateCourseForTesting(course, modifiedData);
		    var card = _createCourseCard(course);
		    if (courseId !== null) {
                var pos = _getCardPosition(course.id);
                $scope.cards.cardlist.splice(pos, 1);
		    }
			$scope.cards.cardlist.splice(1, 0, card);			
		});
	}

    function _validateInputs(scope) {
        scope.error = {};
        if(!scope.data.name) return _validateFail(scope, 'name', 'Course name is mandatory');
        if(!scope.data.icon) return _validateFail(scope, 'icon', 'Course icon URL is mandatory');
        if(!scope.data.content) return _validateFail(scope, 'content', 'Course content is mandatory');

        try {
            var courseContent = angular.fromJson(scope.data.content);
            return _validateContent(scope, courseContent);            
        } catch (error) {
            scope.error.content = nl.t('Error parsing JSON: {}. Try http://www.jsoneditoronline.org to debug more', error.toString());
            return false;
        }
    }

    function _validateContent(scope, courseContent) {
        if (!angular.isArray(courseContent)) return _validateFail(scope, 'content', 
            'Course content needs to be a JSON array []');
        if (courseContent.length < 1) return _validateFail(scope, 'content', 
            'Atleast one course module object is expected in the content');

        var uniqueIds = {};
        for(var i=0; i<courseContent.length; i++){
            var module = courseContent[i];
            if (!module.id) return _validateModuleFail(scope, module, '"id" is mandatory');
            if (!module.name) return _validateModuleFail(scope, module, '"name" is mandatory');
            if (!module.type) return _validateModuleFail(scope, module, '"type" is mandatory');
            if (module.id in uniqueIds) return _validateModuleFail(scope, module, '"id" has to be unique');
            uniqueIds[module.id] = module.type;
            var parentId = _getParentId(module.id);
            if (parentId) {
                if (!(parentId in uniqueIds)) return _validateModuleFail(scope, module, 'parent module needs to be above this module');
                if (uniqueIds[parentId] != 'module') return _validateModuleFail(scope, module, 'parent needs to be of type "module"');
            }

            if(module.type == 'module') continue;
            if(module.type !== 'lesson') return _validateModuleFail(scope, module, '"type" has to be "module" or "lesson".');
            if(!module.refid) return _validateModuleFail(scope, module, '"refid" is mandatory for "type": "lesson"');
            if(!module.refid) return _validateModuleFail(scope, module, '"refid" is mandatory for "type": "lesson"');
            if(!angular.isNumber(module.refid)) return _validateModuleFail(scope, module, '"refid" should be a number - not a string');
        }
        return true;
    }
    
    function _getParentId(idStr) {
        var parents = idStr.split('.');
        parents.pop(); // Remove the last entry
        return parents.join('.');
    }
    
    function _validateModuleFail(scope, module, errMsg) {
        scope.error['content'] = nl.t('{}: module - {}', nl.t(errMsg), angular.toJson(module));
        return false;
    }

    function _validateFail(scope, attr, errMsg) {
        scope.error[attr] = nl.t(errMsg);
        return false;
    }
    
	var uniqueId = 100;
	function _updateCourseForTesting(course, modifiedData) {
		if (NL_SERVER_INFO.serverType !== 'local') return;
		if ('courseid' in modifiedData) {
			course.id = modifiedData.courseid;
		} else {
			course.id = uniqueId++;
		}
		course.name  = modifiedData.name;
		course.icon  = modifiedData.icon;
		course.description  = modifiedData.description;
		course.content  = angular.fromJson(modifiedData.content);
	}

	function _getCardPosition(courseId) {
		for(var i in $scope.cards.cardlist) {
			var card = $scope.cards.cardlist[i];
			if(card.courseId === courseId) return i;
		}
		nl.log.error('Cannot find modified card', courseId);
		return 0;
	}
	
	function _getEmptyCard(nlCardsSrv) {
		var help = null;
		if (type === 'course' && !my) {
			help = nl.t('There are no courses published yet.');
		}
		if (type === 'assign') {
			help = nl.t('There are no course assignments yet.');
		}
		if (type === 'report' && assignId === 0) {
			help = nl.t('There are no courses assigned to you yet.');
		}
	    return nlCardsSrv.getEmptyCard({help:help});
	}
}

module_init();
})();

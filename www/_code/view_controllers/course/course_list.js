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
		url: '^/course_list',
		views: {
			'appContent': {
				templateUrl: 'lib_ui/cards/cardsview.html',
				controller: 'nl.CourseListCtrl'
			}
		}});
	$stateProvider.state('app.course_assign_list', {
		url: '^/course_assign_list',
		views: {
			'appContent': {
				templateUrl: 'lib_ui/cards/cardsview.html',
				controller: 'nl.CourseAssignListCtrl'
			}
		}});
	$stateProvider.state('app.course_report_list', {
		url: '^/course_report_list',
		views: {
			'appContent': {
				templateUrl: 'lib_ui/cards/cardsview.html',
				controller: 'nl.CourseReportListCtrl'
			}
		}});
}];

var CourseListCtrl = ['nl', 'nlRouter', '$scope', 'nlCourse', 'nlDlg', 'nlCardsSrv', 'nlSendAssignmentSrv', 'nlMetaDlg',
function(nl, nlRouter, $scope, nlCourse, nlDlg, nlCardsSrv, nlSendAssignmentSrv, nlMetaDlg) {
	_listCtrlImpl('course', nl, nlRouter, $scope, nlCourse, nlDlg, nlCardsSrv, nlSendAssignmentSrv, nlMetaDlg);
}];

var CourseAssignListCtrl = ['nl', 'nlRouter', '$scope', 'nlCourse', 'nlDlg', 'nlCardsSrv', 'nlSendAssignmentSrv', 'nlMetaDlg',
function(nl, nlRouter, $scope, nlCourse, nlDlg, nlCardsSrv, nlSendAssignmentSrv, nlMetaDlg) {
	_listCtrlImpl('assign', nl, nlRouter, $scope, nlCourse, nlDlg, nlCardsSrv, nlSendAssignmentSrv, nlMetaDlg);
}];

var CourseReportListCtrl = ['nl', 'nlRouter', '$scope', 'nlCourse', 'nlDlg', 'nlCardsSrv', 'nlSendAssignmentSrv', 'nlMetaDlg',
function(nl, nlRouter, $scope, nlCourse, nlDlg, nlCardsSrv, nlSendAssignmentSrv, nlMetaDlg) {
	_listCtrlImpl('report', nl, nlRouter, $scope, nlCourse, nlDlg, nlCardsSrv, nlSendAssignmentSrv, nlMetaDlg);
}];

function _listCtrlImpl(type, nl, nlRouter, $scope, nlCourse, nlDlg, nlCardsSrv, nlSendAssignmentSrv, nlMetaDlg) {
	/* 
	 * URLs handled
	 * 'View published' : /course_list?type=course&my=0
	 * 'Edit my' : /course_list?type=course&my=1
	 * 'Assigned courses' : /course_list?type=assign
	 * 'Report of assignment' : /course_list?type=report&assignid=xx
	 * 'Report of user' : /course_list?type=report
	 */
	
	var courseDict = {};
	var my = false;
	var assignId = 0;
	var _userInfo = null;
	var _searchFilterInUrl = '';
	var _custtypeInUrl = null;
    var _metadataEnabled = false;
    var _searchMetadata = null;
    var _start_at = 0;
    var _max = 50;
    var _canFetchMore = true;
    var _resultList = [];

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {
			_initParams();
			nl.pginfo.pageTitle = _getPageTitle();
			$scope.cards = {};
			$scope.cards.staticlist = _getStaticCards();
			$scope.cards.emptycard = _getEmptyCard(nlCardsSrv);
			_getDataFromServer(_searchFilterInUrl, false, resolve, reject);
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    $scope.onCardInternalUrlClicked = function(card, internalUrl) {
    	$scope.onCardLinkClicked(card, internalUrl);
    };

	$scope.onCardLinkClicked = function(card, linkid) {
		if (linkid === 'course_create') {
			_createCourse($scope);
		} else if (linkid === 'course_modify') {
			_modifyCourse($scope, card.courseId);
		} else if (linkid === 'course_delete') {
			_deleteCourse($scope, card.courseId);
		} else if (linkid === 'course_unpublish'){
			_unpublishCourse($scope, card.courseId);
        } else if (linkid === 'course_metadata') {
            _metadataCourse($scope, card.courseId, card);
        } else if (linkid === 'fetch_more') {
            _fetchMore();
		} else if (linkid === 'course_assign'){
			var assignInfo = {type: 'course', id: card.courseId, icon: card.icon, 
				title: card.title, authorName: card.authorName, subjGrade: '',
				description: card.help, esttime: ''};
			nlSendAssignmentSrv.show($scope, assignInfo);
		} else if (linkid === 'course_assign_delete'){
			_deleteAssignment($scope, card.reportId);
        } else if (linkid === 'course_report_list'){
            _showCourseReportList($scope, card.reportId);
		}
	};

	function _initParams() {
		courseDict = {};
        var params = nl.location.search();
        my = ('my' in params) ? parseInt(params.my) == 1: false;
        assignId = ('assignid' in params) ? parseInt(params.assignid) : 0;
        _searchFilterInUrl = ('search' in params) ? params.search : '';
        _custtypeInUrl = ('custtype' in params) ? parseInt(params.custtype) : null;
        _metadataEnabled = ('enablemeta' in params) && (type == 'course') && !my;
        _searchMetadata = nlMetaDlg.getMetadataFromUrl();
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

	function _addSearchInfo(cards) {
		cards.search = {placeholder: nl.t('Enter course name/description'),
		                maxLimit: _max};
		cards.search.onSearch = _onSearch;
        if (_metadataEnabled) cards.canFetchMore = _canFetchMore;
	}
	
	function _onSearch(filter, grade, onSearchParamChange) {
	    _searchFilterInUrl = filter;
        if (!_metadataEnabled) {
            _onSearchImpl();
            return;
        }
        _searchMetadata.search = _searchFilterInUrl;
        nlMetaDlg.showAdvancedSearchDlg($scope, _userInfo, 'course', _searchMetadata)
        .then(function(result) {
            _searchFilterInUrl = result.metadata.search || '';
            _searchMetadata = result.metadata;
            onSearchParamChange(_searchFilterInUrl, grade);
            _onSearchImpl();
        });
    }

    function _fetchMore() {
        _onSearchImpl(true);
    }
    
    function _onSearchImpl(fetchMore) {
		nlDlg.showLoadingScreen();
		var promise = nl.q(function(resolve, reject) {
			_getDataFromServer(_searchFilterInUrl, fetchMore, resolve, reject);
		});
		promise.then(function(res) {
			nlDlg.hideLoadingScreen();
		});
	}

	function _getDataFromServer(filter, fetchMore, resolve, reject) {
		_listingFunction(filter, fetchMore).then(function(resultList) {
		    resultList = _getFullResultList(resultList);
			if (resultList.length === 1 && type === 'report' && assignId === 0) {
				var url = nl.fmt2('/course_view?id={}&mode=do', resultList[0].id);
				nl.location.url(url);
                nl.location.replace();
				return;
			}
			nl.log.debug('Got result: ', resultList.length);
			$scope.cards.cardlist = _getCards(_userInfo, resultList, nlCardsSrv);
			_addSearchInfo($scope.cards);
			resolve(true);
		}, function(reason) {
            resolve(false);
		});
	}
	
    function _getFullResultList(results) {
        _resultList = _resultList.concat(results);
        _canFetchMore = (results.length > _max);
        _start_at += results.length;
        return _resultList;
    };

	function _listingFunction(filter, fetchMore) {
        if (!_canFetchMore || !fetchMore) {
            _start_at = 0;
            _canFetchMore = true;
            _resultList = [];
        }
	    var params = {search: filter, start_at: _start_at, max: _max};
        if (_metadataEnabled) params.metadata = _searchMetadata;
	    if (_custtypeInUrl !== null) params.custtype = _custtypeInUrl;
		if (type === 'course') {
		    params.mine = my;
			return nlCourse.courseGetList(params);
		}
		if (type === 'assign') {
            params.mine = false;
			return nlCourse.courseGetAssignmentList(params);
		}
		if (type === 'report' && assignId !== 0) {
            params.assignid = assignId;
			return nlCourse.courseGetAssignmentReportList(params);
		}
		return nlCourse.courseGetMyReportList(params);
	}
	
	function _getStaticCards() {
		var ret = [];
		if (type !== 'course' || !my) return ret;
		var card = {title: nl.t('Create'), 
					icon: nl.url.resUrl('dashboard/course_create.png'), 
					internalUrl: 'course_create',
					help: nl.t('You can create a new course by clicking on this card'), 
					children: [], style: 'nl-bg-blue'};
		card.links = [];
		ret.push(card);
		return ret;
	}

	function _getCards(userInfo, resultList, nlCardsSrv) {
		var cards = [];
		for (var i = 0; i < resultList.length; i++) {
			var card = _createCard(resultList[i], userInfo);
			cards.push(card);
		}
		return cards;
	}
	
	function _createCard(cardInfo, userInfo) {
		if (type === 'course') return _createCourseCard(cardInfo, userInfo);
		if (type === 'assign') return _createReportCard(cardInfo, userInfo, false);
		return _createReportCard(cardInfo, userInfo, true);
	}
	
	function _createCourseCard(course, userInfo) {
		courseDict[course.id] = course;
		var mode = my ? 'edit' : 'published';
		var url = nl.fmt2('#/course_view?id={}&mode={}', course.id, mode);
	    var card = {courseId: course.id,
	    			title: course.name, 
					url: url,
					authorName: course.authorname,
					help: course.description,
					json: angular.toJson(course, 0),
					grp: course.grp,
					children: []};
		if (course.icon && course.icon.indexOf('icon:') == 0) {
			var icon2 = course.icon.substring(5);
			if (!icon2) icon2='ion-ios-bookmarks fblue';
			card.icon2 = icon2;
		} else {
			card.icon = course.icon;
		}

		card.details = {help: card.help, avps: _getCourseAvps(course)};
		card.links = [];
		if (my) { 
			card.links.push({id: 'course_modify', text: nl.t('modify')});
			card.links.push({id: 'course_delete', text: nl.t('delete')});
			if (course.is_published)
				card.links.push({id: 'course_unpublish', text: nl.t('unpublish')});
		} else if(nlRouter.isPermitted(userInfo, 'course_assign')) {
			card.links.push({id: 'course_assign', text: nl.t('assign')});
		}
		_addMetadataLink(card);
		card.links.push({id: 'details', text: nl.t('details')});
		return card;
	}
	
    function _addMetadataLink(card) {
        if (!_metadataEnabled) return;
        card.links.push({id : 'course_metadata', text : nl.t('metadata')});
    }

    function _addMetadataLinkToDetails(linkAvp) {
        if (!_metadataEnabled) return;
        nl.fmt.addLinkToAvp(linkAvp, 'metadata', null, 'course_metadata');
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

	function _createReportCard(report, userInfo, isReport) {
		var url = nl.fmt2('#/course_view?mode=reports_summary_view&id={}', report.id);
		var title = report.name;
		if (isReport) {
			title = (assignId === 0) ? report.name : report.studentname;
			var mode = (assignId === 0) ? 'do' : 'report_view';
			var url = nl.fmt2('#/course_view?id={}&mode={}', 
						report.id, mode);
		}
	    var card = {reportId: report.id,
	    			title: title, 
	    			icon: report.icon, 
	    			url: url,
	    			help: report.remarks,
	    			children: []};
		card.details = {help: card.help, avps: _getReportAvps(report, isReport)};
		card.links = [];
        if (!isReport)
            card.links.push({id:'course_report_list', text: nl.t('reports')});
		if (!isReport && nlRouter.isPermitted(userInfo, 'course_assign'))
			card.links.push({id:'course_assign_delete', text: nl.t('delete')});
		card.links.push({id: 'details', text: nl.t('details')});
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

    function _metadataCourse($scope, courseId, card) {
        nlMetaDlg.showMetadata($scope, _userInfo, 'course', courseId, card)
        .then(function() {
            _onSearchImpl();
        });
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
	
	function _deleteAssignment($scope, assignId) {
		var msg = {title: 'Please confirm', 
				   template: 'Are you sure you want to delete? This cannot be undone.',
				   okText: nl.t('Delete')};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;
			nlDlg.showLoadingScreen();
			nlCourse.courseAssignmentDelete(assignId).then(function(status) {
				nlDlg.hideLoadingScreen();
				for (var i in $scope.cards.cardlist) {
					var card = $scope.cards.cardlist[i];
					if (card.reportId !== assignId) continue;
					$scope.cards.cardlist.splice(i, 1);
				}
			});	
		});
	}

    function _showCourseReportList($scope, assignId) {
        var url = nl.fmt2('/course_report_list?assignid={}', assignId);
        nl.location.url(url);
    }
	
	function _unpublishCourse($scope, courseId) {
		var msg = {title: 'Please confirm', 
				   template: 'Are you sure you want to unpublish?',
				   okText: nl.t('Unpublish')};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;
			nlDlg.showLoadingScreen();
			var courseData = courseDict[courseId]; 
			var modifiedData = {
				name: courseData.name, 
				icon: courseData.icon, 
				description: courseData.description
			};
			nlCourse.courseUnpublish(courseId).then(function(course) {
				_onModifyDone(course, courseId, modifiedData, $scope);
			});	
		});
	}
	
	function _createCourse($scope) {
		var courseContent = {"lastId": 0, "modules": [{"name": "Your first item", "type" : "info", "id": "_id0"}]};
		var dlgScope = {error: {}, data: {
			name: nl.t('New course'),
			icon: 'icon:',
			description: nl.t(''),
			content: angular.toJson(courseContent, 2)	
		}};
		var promise = _onCourseSave(null, $scope, dlgScope, null, false);
		if (promise) promise.then(function(courseId) {
			var url = nl.fmt2('/course_view?id={}&mode=edit', courseId);
			nl.location.url(url);
		});
	}
	
	function _modifyCourse($scope, courseId) {
		var modifyDlg = nlDlg.create($scope);
		modifyDlg.setCssClass('nl-height-max nl-width-max');
        modifyDlg.scope.error = {};
		var course = courseDict[courseId];
		$scope.dlgTitle = nl.t('Modify course');
		modifyDlg.scope.data = {name: course.name, icon: course.icon, 
								description: course.description, content: angular.toJson(course.content, 2)};
		
		var buttons = [];
		var saveButton = {
			text : nl.t('Save'),
			onTap : function(e) {
				_onCourseSave(e, $scope, modifyDlg.scope, courseId, false);
			}
		};
		buttons.push(saveButton);
		var publishButton = {
			text : nl.t('Publish'),
			onTap : function(e) {
				_onCourseSave(e, $scope, modifyDlg.scope, courseId, true);
			}
		};
		buttons.push(publishButton);

		var cancelButton = {
			text : nl.t('Cancel')
		};
		modifyDlg.show('view_controllers/course/course_create_dlg.html',
			buttons, cancelButton, false);
	}
	
	function _onCourseSave(e, $scope, dlgScope, courseId, bPublish) {
	    if(!_validateInputs(dlgScope)) {
	        if(e) e.preventDefault();
	        return null;
	    }
		nlDlg.showLoadingScreen();
		var modifiedData = {
			name: dlgScope.data.name, 
			icon: dlgScope.data.icon, 
			description: dlgScope.data.description,
			content: dlgScope.data.content 
		};
		if (courseId !== null) modifiedData.courseid = courseId;
		if (bPublish) modifiedData.publish = true;
		var crModFn = (courseId != null) ? nlCourse.courseModify: nlCourse.courseCreate;
		return crModFn(modifiedData).then(function(course) {
			_onModifyDone(course, courseId, modifiedData, $scope);
			return course.id;
		});
	}

    function _onModifyDone(course, courseId, modifiedData, $scope) {
		nlDlg.hideLoadingScreen();
	    _updateCourseForTesting(course, modifiedData);
	    var card = _createCourseCard(course);
	    if (courseId !== null) {
            var pos = _getCardPosition(course.id);
            $scope.cards.cardlist.splice(pos, 1);
	    }
		$scope.cards.cardlist.splice(0, 0, card);			
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
        	return nlDlg.setFieldError(scope, 'content',
				nl.t('Error parsing JSON: {}. Try http://www.jsoneditoronline.org to debug more', error.toString()));
        }
    }

    function _validateContent(scope, courseContent) {
    	if (!courseContent.modules) return _validateFail(scope, 'content', 
            '"modules" field is expected in content');
        var modules = courseContent.modules;
        if (!angular.isArray(modules)) return _validateFail(scope, 'content', 
            '"modules" needs to be a JSON array []');
        if (modules.length < 1) return _validateFail(scope, 'content', 
            'Atleast one course module object is expected in the content');

        var uniqueIds = {};
        for(var i=0; i<modules.length; i++){
            var module = modules[i];
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

            if (!_validateModuleType(scope, module)) return false;
            if (!_validateModulePlan(scope, module)) return false;

            if (!_validateLessonModule(scope, module)) return false;
            if (!_validateLinkModule(scope, module)) return false;
            if (!_validateInfoModule(scope, module)) return false;
        }
        return true;
    }

    function _validateModuleType(scope, module) {
    	var moduleTypes = {'module': true, 'lesson': true, 'link': true, 'info':true};
    	if(module.type in moduleTypes) return true;
    	var msg = '"type" has to be one of [' + Object.keys(moduleTypes).toString() + ']';
        return _validateModuleFail(scope, module, msg);
    }

    function _validateModulePlan(scope, module) {
    	if (!module.planned_date) return true;
    	var d = nl.fmt.json2Date(module.planned_date);
        if (!isNaN(d.valueOf())) return true;
    	return _validateModuleFail(scope, module, 'Incorrect planned date: "YYYY-MM-DD" format expected');
    }
    
    function _validateLessonModule(scope, module) {
    	if(module.type != 'lesson') return true;
        if(!module.refid) return _validateModuleFail(scope, module, '"refid" is mandatory for "type": "lesson"');
        if(!angular.isNumber(module.refid)) return _validateModuleFail(scope, module, '"refid" should be a number - not a string');
        return true;
    }

    function _validateLinkModule(scope, module) {
    	if(module.type != 'link') return true;
        if(!module.action) return _validateModuleFail(scope, module, '"action" is mandatory for "type": "link"');
        if(!module.urlParams) return _validateModuleFail(scope, module, '"urlParams" is mandatory for "type": "urlParams"');
        return true;
    }
    
    function _validateInfoModule(scope, module) {
    	if(module.type != 'info') return true;
        return true;
    }
    
    function _getParentId(idStr) {
        var parents = idStr.split('.');
        parents.pop(); // Remove the last entry
        return parents.join('.');
    }
    
    function _validateModuleFail(scope, module, errMsg) {
    	return nlDlg.setFieldError(scope, 'content',
        	nl.t('{}: module - {}', nl.t(errMsg), angular.toJson(module)));
    }

    function _validateFail(scope, attr, errMsg) {
    	return nlDlg.setFieldError(scope, attr,
        	nl.t(errMsg));
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
		if ('content' in modifiedData)
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

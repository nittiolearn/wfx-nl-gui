(function() {

//-------------------------------------------------------------------------------------------------
// course_view.js:
// course_view module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.course_view', [])
    .directive('nlCourseViewToolbar', CourseViewDirective('course_view_toolbar'))
    .directive('nlCourseViewList', CourseViewDirective('course_view_list'))
    .directive('nlCourseViewContentActive', CourseViewDirective('course_view_content_active'))
    .directive('nlCourseViewContentStatic', CourseViewDirective('course_view_content_static'))
    .directive('nlCourseViewContentEditor', CourseViewDirective('course_view_editor'))
    .directive('nlCourseViewFrame', CourseViewDirective('course_view_frame'))
    .directive('nlCourseJsonText', CourseJsonToTextDirective)
    .service('nlCourseAttributes', NlCourseAttributesSrv)
    .config(configFn).controller('nl.CourseViewCtrl', NlCourseViewCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.course_view', {
        url : '^/course_view',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/course/course_view.html',
                controller : 'nl.CourseViewCtrl'
            }
        }
    });
}];

var MODES = {PRIVATE: 0, PUBLISHED: 1, REPORT_VIEW: 2, DO: 3, EDIT: 4, REPORTS_SUMMARY_VIEW: 5};
var MODE_NAMES = {'private': 0, 'published': 1, 'report_view': 2, 'do': 3, 'edit': 4, 'reports_summary_view': 5};

function ModeHandler(nl, nlCourse, nlDlg, $scope) {
    this.mode = MODES.PRIVATE;
    this.courseId = null;
    this.course = null;
    this.initMode = function() {
        var params = nl.location.search();
        if (!('mode' in params) || !(params.mode in MODE_NAMES)) return false;
        this.mode = MODE_NAMES[params.mode];
        if (!('id' in params)) return false;
        this.courseId = parseInt(params.id);
        return true;
    };

    this.initTitle = function(course) {
        this.course = course;
        nl.pginfo.pageTitle = course.name;
        if (this.mode === MODES.PRIVATE) {
            nl.pginfo.pageSubTitle = nl.t('(private)');
        } else if (this.mode === MODES.EDIT) {
            nl.pginfo.pageSubTitle = nl.t('(editor)');
        } else if (this.mode === MODES.PUBLISHED) {
            nl.pginfo.pageSubTitle = nl.t('(published)');
        } else if (this.mode === MODES.REPORTS_SUMMARY_VIEW) {
            nl.pginfo.pageSubTitle = nl.t('(assignment reports)');
        } else if (this.mode === MODES.REPORT_VIEW) {
            nl.pginfo.pageSubTitle = nl.t('({})', course.studentname);
        } else if (this.mode === MODES.DO) {
            nl.pginfo.pageSubTitle = nl.t('({})', course.studentname);
        } 
    };
    
    this.getCourse = function() {
        if (this.mode === MODES.PRIVATE || this.mode === MODES.EDIT || this.mode === MODES.PUBLISHED) {
            return nlCourse.courseGet(this.courseId, this.mode === MODES.PUBLISHED);
        }
        if (this.mode === MODES.REPORTS_SUMMARY_VIEW) {
            return nlCourse.courseGetAssignmentReportSummary({assignid: this.courseId});
        }
        if (this.mode === MODES.REPORT_VIEW) {
            return nlCourse.courseGetReport(this.courseId, false);
        }
        return nlCourse.courseGetReport(this.courseId, true);
    };
    
    this.handleLink = function(cm, newTab, scope) {
        var url = nlCourse.getActionUrl(cm.action, cm.urlParams);
        _updateLinkStatusIfNeeded(this, cm, scope);
        return _redirectTo('{}', url, newTab);
    };
    
    this.handleLessonLink = function(cm, newTab, scope) {
        var self = this;
        if (!('refid' in cm)) return _popupAlert('Error', 'Link to the learning module is not specified');
        var refid = cm.refid;
        if (this.mode === MODES.PRIVATE || this.mode === MODES.EDIT || this.mode === MODES.PUBLISHED) {
            var urlFmt = '/lesson/view/{}';
            return _redirectTo(urlFmt, refid, newTab);
        }

        var reportInfo = (cm.id in self.course.lessonReports) ? self.course.lessonReports[cm.id] : null;
        if (this.mode === MODES.REPORTS_SUMMARY_VIEW || this.mode === MODES.REPORT_VIEW) {
            if (!reportInfo || !reportInfo.completed) return _popupAlert('Not completed', 
                'This learning module is not yet completed. You may view the report once it is completed.');
            return _redirectTo('/lesson/review_report_assign/{}', reportInfo.reportId, newTab);
        }
        
        // do mode
        if (_redirectToLessonReport(reportInfo, newTab)) return true;
        
        cm.attempt++;
        nlDlg.showLoadingScreen();
        nlCourse.courseCreateLessonReport(self.course.id, refid, cm.id, cm.attempt).then(function(updatedCourseReport) {
            nlDlg.hideLoadingScreen();
            self.course = updatedCourseReport;
            scope.updateAllItemData();
            reportInfo = self.course.lessonReports[cm.id];
            _redirectToLessonReport(reportInfo, newTab);
        });
        
        return true;
    };
    
    this.shallShowScore = function() {
        return (this.mode === MODES.REPORTS_SUMMARY_VIEW || this.mode === MODES.REPORT_VIEW || this.mode === MODES.DO);
    };

    this.canStart = function(cm, scope, treeList) {
        return _startDateOk(cm, scope) && _prereqsOk(this, cm, treeList);
    };

    this.show = function(url, newTab) {
        _redirectTo('{}', url, newTab);
    };
    
    // Private functions
    function _startDateOk(cm, scope) {
        var today = new Date();
        if (scope.planning && cm.start_date && cm.start_date > today) return false;
        return true;
    }
            
    function _prereqsOk(self, cm, treeList) {
        var prereqs = cm.start_after || [];
        var lessonReports = self.course.lessonReports || {};
        var statusinfo = self.course.statusinfo || {};
        for(var i=0; i<prereqs.length; i++){
            var p = prereqs[i];
            var cmid = p.module;
            var item = treeList.getItem(cmid);
            if (item && item.state.status == 'waiting') return false;
            var prereqScore = null;
            if (cmid in lessonReports && lessonReports[cmid].completed) {
                var lessonReport = lessonReports[cmid];
                var maxScore = ('maxScore' in lessonReport) ? parseInt(lessonReport.maxScore) : 0;
                var score = ('score' in lessonReport) ? parseInt(lessonReport.score) : 0;
                prereqScore = maxScore > 0 ? Math.round((score/maxScore)*100) : 100;
            } else if (cmid in statusinfo && statusinfo[cmid].status == 'done') {
                prereqScore = 100;
            }
            if (prereqScore === null) return false;
            var limitMin = p.min_score || null;
            var limitMax = p.max_score || null;
            if (limitMin && prereqScore < limitMin) return false;
            if (limitMax && prereqScore >= limitMax) return false;
        }
        return true;
    }
    
    function _updateLinkStatusIfNeeded(self, cm, scope) {
        if (self.mode != MODES.DO || !cm.autocomplete) return;
        var statusinfos = self.course.statusinfo || {};
        var statusinfo = statusinfos[cm.id] || {};
        if (statusinfo.status == 'done') return;
        scope.ext.updateStatus(true, true);
    }
    
    function _popupAlert(title, template) {
        nlDlg.popupAlert({title: nl.t(title), template: nl.t(template)});
        return true;
    }

    function _redirectTo(urlFmt, objId, newTab) {
        var url = nl.fmt2(urlFmt, objId);
        if (newTab) {
            var msg = 'Do you want to open the link in a new tab? After completing, you may close the tab and come back to this tab.';
            nlDlg.popupConfirm({title: nl.t('Please confirm'), 
                              template: nl.t(msg),
                              okText: nl.t('Open in a new tab')
                              })
            .then(function(res) {
                if (res) nl.window.open(url,'_blank');
            });
        } else {
            nl.timeout(function() {
                url += url.indexOf('?') >= 0 ? '&' : '?';
                url += 'embedded=true';
                $scope.iframeUrl = url;
                $scope.iframeModule = $scope.ext.item.id;
            });
        }
        return true;
    }

    function _redirectToLessonReport(reportInfo, newTab) {
        if (!reportInfo) return false;
        var urlFmt = reportInfo.completed ?  '/lesson/view_report_assign/{}' : '/lesson/do_report_assign/{}';
        return _redirectTo(urlFmt, reportInfo.reportId, newTab);
    }
}

//-------------------------------------------------------------------------------------------------
var NlCourseAttributesSrv = ['nl',
function(nl, nlRouter, $scope, nlDlg, nlCourse, nlIframeDlg, nlExporter) {
	this.getCourseAttributes = function(course) {
        var keys = Object.keys(course.content);
        var ret = [];
        for (var k in keys) {
            var key = keys[k];
            if (key == 'modules') continue;
            ret.push({key: key, val: course.content[key]});
        }
        return ret;
	};

	this.getModuleAttributes = function() {
        return attrs;
	};
	
	this.getAdditinalAttributes = function(){
		return additionalAttrs;
	};

	// TODO
    var attrs = [
    	{name: 'id', fields: "all", type: 'readonly', text: 'Unique ID', readonly: true, help: 'Defines the unique id of a course module. Parent-child relationship of course elements (tree structure) is derived from the id - id of the child element should always begin with the id of parent element and a ".".'}, 
    	{name: 'name', fields: "all", type: 'string', text: 'Name', help:'Name of the module to be displayed in the course tree.'}, 
    	{name: 'type', fields: "all", type: 'list', text: 'Element type', values: ['module', 'lesson', 'info', 'link'], help:'"module is a folder of info or a link", "lesson is a module", "info" or "link".'},
        {name: 'refid', fields: "lesson", type: 'lessonlink', text: 'Module-id', help:'The id of the lesson to be launched. Click on the link to view the module'},
        {name: 'action', fields: "link", type: 'lessonlink', text: 'Action', help:'The action whose URL is used for the link. Click on the icon to view the link'},
        {name: 'urlParams', fields: "link", type: 'string', text: 'Url-Params', help:'The urlParams to append to the URL (see Dashboard create/modify dialog for more information).'},
		{name: 'icon', type: 'additional', text: 'Module icon', help:'Icon to be displayed for this item in the course tree. If not provided, this is derived from the type. "quiz" is a predefined icon.'},
		{name: 'text', type: 'additional', text: 'Description', help:'some text string'}, 
        {name: 'start_date', fields: "not_module", type: 'date', text: 'Start date', help:'Earliest planned start date. Is applicable only if "planning" is set to true for the course.'},
        {name: 'planned_date', fields: "not_module", type: 'date', text: 'Planned date', help:'Expected planned completion date. Is applicable only if "planning" is set to true for the course.'},
        {name: 'max_attempts', fields: "lesson", type: 'string', text: 'Maximum attempts', help:'Number of time the lerner can do this lesson. Only the learning data from the last attempt is considered. 0 means infinite. 1 is the default.'},
        {name: 'hide_remarks', fields: "infolink", type: 'string', text: 'Hide remarks', help:'true/false. true = do not show remark field when marking the item as done. false is default.'},
        {name: 'start_after', fields: "not_module", type: 'object', text: 'Start after', help:'Array of objects: each object contains "module", "min_score" (optional) and "max_score" (optional) attributes.'},
        {name: 'reopen_on_fail', fields: "lesson", type: 'object', text: 'Reopen on fail', help:'Array of strings: each string is module id of leaft modules that should be failed if the current module fails.'},
        {name: 'autocomplete', fields: "link", type: 'string', text: 'Auto-complete', help:'true/false. If true, the link is marked completed when viewed first time. The user will not have possibility to set the status here.'}
    ];
    
    var additionalAttrs = [
				    		{name: 'icon', type: 'additional', text: 'Module icon', help:'Icon to be displayed for this item in the course tree. If not provided, this is derived from the type. "quiz" is a predefined icon.'},
							{name: 'text', type: 'additional', text: 'Description', help:'some text string'} 
						  ];
}];

//-------------------------------------------------------------------------------------------------
var NlCourseViewCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCourse', 'nlIframeDlg', 'nlExporter',
'nlCourseAttributes',
function(nl, nlRouter, $scope, nlDlg, nlCourse, nlIframeDlg, nlExporter, nlCourseAttributes) {
    var modeHandler = new ModeHandler(nl, nlCourse, nlDlg, $scope);
    var nlContainer = new NlContainer(nl, $scope, modeHandler);
    nlContainer.setContainerInWindow();
    var treeList = new TreeList(nl);
    var courseReportSummarizer = new CourseReportSummarizer($scope);
    var _userInfo = null;
    var _allModules = [];
    $scope.MODES = MODES;
    var folderStats = new FolderStats($scope);
    $scope.ext = new ScopeExtensions(nl, modeHandler, nlContainer, folderStats);

    function _onPageEnter(userInfo) {
        _userInfo = userInfo;
        return nl.q(function(resolve, reject) {
            $scope.ext.setUpdateStatusFn(_updatedStatusinfo);
            treeList.clear();
            $scope.params = nl.location.search();
            if (!('id' in $scope.params) || !modeHandler.initMode()) {
                nlDlg.popupStatus(nl.t('Invalid url'));
                resolve(false);
                return;
            }
            $scope.mode = modeHandler.mode;
            $scope.showStatusIcon = modeHandler.shallShowScore();
            var courseId = parseInt($scope.params.id);
            modeHandler.getCourse().then(function(course) {
                _onCourseRead(course);
                _showVisible();
                resolve(true);
            }, function(error) {
                resolve(false);
            });
        });
    }

    function _onPageLeave() {
        if (!_isDirty()) return true;
        var msg = nl.t('Warning: There are some unsaved changes in this page. Press ok to try saving the changes. Press cancel to discard the changes and leave the page.');
        var ret = confirm(msg);
        if (!ret) return true;
        _updatedStatusinfoAtServer(true);
        return false;
    }
    
    nlRouter.initContoller($scope, '', _onPageEnter, _onPageLeave);

    function _onCourseRead(course) {
        _initAttributesDicts(course);
        courseReportSummarizer.updateUserReports(course);
        modeHandler.initTitle(course);
        $scope.planning = course.content.planning;
        if ('forumRefid' in course) {
            $scope.forumInfo = {refid: course.forumRefid, secid: course.id};
        } else {
            $scope.forumInfo = {refid: 0};
        }
        var modules = course.content.modules;
        _allModules = [];
        for(var i=0; i<modules.length; i++) {
            var module = angular.copy(modules[i]);
            var userRecords = courseReportSummarizer.getUserRecords(course, module);
            _initModule(module);
            _allModules.push(module);
            for(var j=0; j<userRecords.length; j++) {
                _initModule(userRecords[j]);
                _allModules.push(userRecords[j]);
            }
        }
        nl.timeout(function() {
            _updateAllItemData();
            $scope.ext.setCurrentItem(treeList.getRootItem());
        });
    }

    function _initAttributesDicts(course) {
        if (!$scope.ext.isStaticMode()) return;
        $scope.course_attributes = nlCourseAttributes.getCourseAttributes(course);
        $scope.module_attributes = nlCourseAttributes.getModuleAttributes();
        $scope.additional_Attributes = nlCourseAttributes.getAdditinalAttributes();
    }

    function _initExpandedView() {
        $scope.expandedView = (nl.rootScope.screenSize != 'small'); 
        $scope.showExpandedViewIcon = $scope.expandedView;
        _updateExpandViewIcon();
    }
    
    nl.resizeHandler.onResize(function() {
        _initExpandedView();
    });
    _initExpandedView();

    function _showVisible() {
        $scope.modules = [];
        for(var i=0; i<_allModules.length; i++) {
            var cm=_allModules[i];
            if (!cm.visible) continue;
            $scope.modules.push(cm);
        }
    }

    $scope.download = function() {
        _download();
    };
    
    $scope.collapseAll = function() {
        function _impl() {
            treeList.collapseAll();
            _showVisible();
            $scope.ext.setCurrentItem(treeList.getRootItem());
        }
        _confirmIframeClose(null, _impl);
    };
    
    function _confirmIframeClose(newItem, nextFn) {
        if (!$scope.iframeUrl || newItem && ($scope.iframeModule == newItem.id)) {
            nextFn();
            return;
        }
        if ($scope.ext.isStaticMode()) {
            $scope.iframeUrl = null;
            $scope.iframeModule = null;
            nextFn();
            return;
        }
        nlDlg.popupConfirm({title: nl.t('Please confirm'), 
            template: nl.t('Do you want to navigate away from current module?')})
            .then(function(res) {
                if (!res) return;
                $scope.iframeUrl = null;
                $scope.iframeModule = null;
                nextFn();
            });
    }
    
    $scope.expandViewClick = function() {
        function _impl() {
            $scope.expandedView = !$scope.expandedView;
            _updateExpandViewIcon();
        }
        _confirmIframeClose(null, _impl);
    };
    
    $scope.popupView = false;
    function _popout(bPopout) {
        nl.pginfo.isMenuShown = !bPopout;
        $scope.popupView = bPopout;
    }

	$scope.showAddInfo = function(e, cm){
		if($scope.showAddInform) {
			_showAddInfo(false);
		} else {
			_showAddInfo(true);			
		}
	};

	$scope.showAddInform = false;
    function _showAddInfo(showAdd) {
        $scope.showAddInform = showAdd;
	}
	
    $scope.showPopup = function(e, cm, bReset) {
        e.stopImmediatePropagation();
        e.preventDefault();
        function _impl() {
            $scope.ext.setCurrentItem(cm);
            _popout(true);
        }
        if (bReset) _confirmIframeClose(null, _impl);
        else _impl();
    };
    
    $scope.hidePopup = function(bClose) {
        function _impl() {
            _popout(false);
        }
        _confirmIframeClose(!bClose ? $scope.ext.item : null, _impl);
    };
    
    $scope.closeIFrame = function() {
        nl.timeout(function() {
            $scope.iframeUrl = null;
            $scope.iframeModule = null;
            if($scope.popupView) _popout(false);
        });
    };
    
    $scope.updateAllItemData = function() {
        nl.timeout(function() {
            _updateAllItemData();
        });
    };

    function _updateExpandViewIcon() {
        if ($scope.expandedView) {
            $scope.expandViewText = nl.t('Expand list and hide content');
            $scope.expandViewIcon = 'ion-arrow-expand';
            return;
        }
        $scope.expandViewText = nl.t('Shrink list to show content');
        $scope.expandViewIcon = 'ion-arrow-shrink';
    }
    
    var forumDlg = null;
    $scope.launchForum = function() {
        if (!forumDlg) {
            // FireFox and IE do not show the iFrame if the URL is same as launching URL
            // So as a workaround we need some different string in server part of URL
            var randqs = (new Date()).getTime();
            var url = nl.fmt2('/?randqs={}#/forum?forumtype=3&refid={}&secid2={}&hidemenu', 
                              randqs, $scope.forumInfo.refid, $scope.forumInfo.secid);
            forumDlg = nlIframeDlg.create($scope, url, nl.t('Discussion forum'));
        }
        forumDlg.show();
    };

    $scope.onIconClick = function(e, cm) {
        e.stopImmediatePropagation();
        e.preventDefault();
        function _impl() {
            $scope.ext.setCurrentItem(cm);
            if (!$scope.expandedView) _popout(true);
        }
        _confirmIframeClose(null, _impl);
    }

    $scope.onClick = function(e, cm) {
        e.stopImmediatePropagation();
        e.preventDefault();
        function _impl() {
            $scope.ext.setCurrentItem(cm);
            if(cm.type === 'module') {
                treeList.toggleItem(cm);
                _showVisible();
            } else {
                if (!$scope.expandedView) _popout(true);
                
                var openModule = $scope.ext.isStaticMode() || (cm.state.status == 'delayed') || 
                    (cm.state.status == 'pending') || (cm.state.status == 'started');
                openModule = openModule && (cm.type == 'lesson' || cm.type == 'link');
                if (openModule) _onLaunchImpl(cm);
            }
        }
        _confirmIframeClose(null, _impl);
    };

    $scope.onSaveModule = function(e, cm){
		var modules = modeHandler.course.content.modules;
		for(var i in modules){
			var element = modules[i];
			if(cm.id == element.id) modeHandler.course.content.modules[i] = cm;
		}
		var modifiedData = {
						courseid: modeHandler.course.id,
						name: modeHandler.course.name, 
						icon: modeHandler.course.icon, 
						description: modeHandler.course.description,
						content: angular.toJson(modeHandler.course.content) 
					};
		nlDlg.showLoadingScreen();
		nlCourse.courseModify(modifiedData).then(function(course) {
			nlDlg.hideLoadingScreen();
		});
    };
    
    
    $scope.onLaunch = function(e, cm) {
        e.stopImmediatePropagation();
        e.preventDefault();
        _confirmIframeClose(cm, function() {
            _onLaunchImpl(cm)
        });
    };
    
    function _onLaunchImpl(cm) {
        if (cm.type === 'lesson') modeHandler.handleLessonLink(cm, false, $scope);
        else if(cm.type === 'link') modeHandler.handleLink(cm, false, $scope);
    }

    $scope.onReattempt = function(e, cm) {
        var template = 'Current learing history for this module will be lost if you attempt this module once more. Do you want to continue?';
        nlDlg.popupConfirm({title: 'Confirm', template: template})
        .then(function(res) {
            if (!res) return;
            var lessonReports = modeHandler.course.lessonReports || {};
            if (cm.id in lessonReports) delete lessonReports[cm.id];
            function _impl() {
                $scope.ext.setCurrentItem(cm);
                if (cm.type === 'lesson') modeHandler.handleLessonLink(cm, false, $scope);
                if (!$scope.expandedView) _popout(true);
            }
            _confirmIframeClose(null, _impl);
        });
    };
    
    var _CM_STATES = {
        hidden:  {title: 'Hidden'}, // TODO-MUNNI - not handled yet!
        none:    {icon: 'ion-information-circled fblue', title: ''},
        waiting: {icon: 'ion-locked fgrey', title: 'Locked'},
        delayed: {icon: 'ion-alert-circled forange', title: 'Delayed'},
        pending: {icon: 'ion-ios-circle-filled fyellow', title: 'Pending'},
        started: {icon: 'ion-ios-circle-filled fgreen', title: 'Started'},
        failed:  {icon: 'icon ion-close-circled forange', title: 'Failed'},
        success: {icon: 'ion-checkmark-circled fgreen', title: 'Done'},
        partial_success: {icon: 'ion-checkmark-circled forange', title: 'Partially Done'} // Only folder status
    }

    function _updateState(cm, state) {
        // statusIcon, statusText, statusShortText
        cm.state = angular.copy(_CM_STATES[state] || _CM_STATES.hidden);
        cm.state.status = state;
    }
    
    function _initModule(cm) {
        treeList.addItem(cm);
        _updateState(cm, 'none');
        cm.planned_date = cm.planned_date ? nl.fmt.json2Date(cm.planned_date) : null;
        cm.start_date = cm.start_date ? nl.fmt.json2Date(cm.start_date) : null;
        if (!('maxAttempts' in cm) && cm.type == 'lesson') cm.maxAttempts = 1;
    }

    function _updateAllItemData() {
        var today = new Date();
        folderStats.clear();
        var reopener = new Reopener(modeHandler, treeList, _userInfo, nl, nlDlg, 
            nlCourse, _updatedStatusinfoAtServer);
        reopener.reopenIfNeeded().then(function() {
            _updateItemData(treeList.getRootItem(), today);
        });
    }

    function _updateItemData(cm, today) {
        if (cm.type === 'module') {
            _updateModuleData(cm, today);
        } else if (cm.type === 'info' || cm.type === 'link') {
            _updateLinkData(cm, today);
        } else {
            _updateLessonData(cm, today);
        }
    }

    function _updateModuleData(cm, today) {
        var folderStat = folderStats.get(cm.id);
        var children = treeList.getChildren(cm);
        for (var i=0; i<children.length; i++) {
            var child = children[i];
            _updateItemData(child, today);
            if (child.type == 'module') folderStats.updateForModule(folderStat, child);
            else folderStats.updateForLeaf(folderStat, child);
        }
        folderStats.updateTotals(folderStat);
        var status = 'success';
        if (folderStat.waiting == folderStat.total) status = 'waiting';
        else if (folderStat.success == folderStat.total) status = 'success';
        else if (folderStat.failed == folderStat.total) status = 'failed';
        else if (folderStat.success + folderStat.failed == folderStat.total) status = 'partial_success';
        else if (folderStat.delayed > 0) status = 'delayed';
        else if (folderStat.started + folderStat.failed + folderStat.success > 0) status = 'started';
        else status = 'pending';
        _updateState(cm, status);
    }
    
    function _updateLinkData(cm, today) {
        cm.score = null;
        cm.time = null;
        var status = 'none';
        
        var statusinfos = modeHandler.course.statusinfo || {};
        var statusinfo = statusinfos[cm.id] || {};
        if (statusinfo.status == 'done') status = 'success';
        else if ($scope.planning && cm.planned_date && cm.planned_date < today) status = 'delayed';
        else status = 'pending';
        if (!modeHandler.canStart(cm, $scope, treeList)) status = 'waiting';
        _updateState(cm, status);
    }
    
    function _updateLessonData(cm, today) {
        cm.score = null;
        cm.maxScore = null;
        cm.perc = null;
        cm.started = null;
        cm.ended = null;
        cm.time = null;
        var status = 'none';

        var lessonReports = modeHandler.course.lessonReports || {};
        var lessonReport = lessonReports[cm.id] || {};
        
        cm.attempt = lessonReport.attempt || 0;
        if ('started' in lessonReport) {
            cm.started = nl.fmt.json2Date(lessonReport.started);
            if (cm.attempt == 0) cm.attempt = 1;
        }
        
        if ('ended' in lessonReport) cm.ended = nl.fmt.json2Date(lessonReport.ended);
        if ('timeSpentSeconds' in lessonReport) {
            cm.time = parseInt(lessonReport.timeSpentSeconds);
            cm.timeMins = Math.round(cm.time/60);
        }

        cm.passScore = parseInt(lessonReport.passScore || 0);
        if ('maxScore' in lessonReport) cm.maxScore = parseInt(lessonReport.maxScore);

        if (lessonReport.completed && 'score' in lessonReport) {
            cm.score = parseInt(lessonReport.score);
            cm.perc = cm.maxScore ? Math.round((cm.score/cm.maxScore)*100) : 0;
            status = cm.perc >= cm.passScore ? 'success' : 'failed';
        }
        else if ($scope.planning && cm.planned_date && cm.planned_date < today) status = 'delayed';
        else if (cm.started) status = 'started';
        else status = 'pending';
        if (!modeHandler.canStart(cm, $scope, treeList)) status = 'waiting';
        _updateState(cm, status);
    }

    function _updatedStatusinfo(cm, status, remarks, dontHide) {
        // TODO: Keep status as boolean; data as javascript Date object
        if (!('statusinfo' in modeHandler.course)) modeHandler.course.statusinfo = {};
        modeHandler.course.statusinfo[cm.id] = {
            status: status ? 'done' : '',
            date: nl.fmt.date2Str(new Date(), 'date'), 
            username: _userInfo.username,
            remarks: remarks
        };
        _updatedStatusinfoAtServer(false);
        _updateAllItemData();
        if (!dontHide) $scope.hidePopup(true);
    }
    
    var _saveAttemptNumber = 0;
    var _saveDoneNumber = 0;
    function _isDirty() {
        return (_saveAttemptNumber != _saveDoneNumber);
    }

    function _updatedStatusinfoAtServer(bBlockUI) {
        if (bBlockUI) nlDlg.showLoadingScreen();
        _saveAttemptNumber++;
        var currentSaveNumber = _saveAttemptNumber;
        var repid = parseInt($scope.params.id);
        nlCourse.courseReportUpdateStatus(repid, JSON.stringify(modeHandler.course.statusinfo))
        .then(function(courseReport) {
            if (currentSaveNumber > _saveDoneNumber)
                _saveDoneNumber = currentSaveNumber;
            if (bBlockUI) nlDlg.hideLoadingScreen();
        });
    }
    
    function _download() {
        if ($scope.mode != MODES.REPORTS_SUMMARY_VIEW) return;
        var data = [];
        data.push(['User name', 'Module', 'Type', 'Status', 'Time spent', 'Score', 'Max score', 'Percentage', 'Location']);
        for(var i=0; i<_allModules.length; i++) {
            var cm = _allModules[i];
            if (cm.type == 'module') continue;
            var parent = treeList.getItem(cm.parentId);
            if (!parent) continue; // This is a must in REPORTS_SUMMARY_VIEW

            var row = [cm.name, parent.name, cm.type, cm.state.status, 
                cm.timeMins || '', cm.score || '',  cm.maxScore || '', 
                cm.perc ? cm.perc + '%' : '', parent.location];
            data.push(row);
        }
        
        var fileName = nl.fmt2('Report-{}.csv', nl.fmt.date2Str(new Date(), 'date'));
        nlExporter.exportArrayTableToCsv(fileName, data);
    }
}];

//-------------------------------------------------------------------------------------------------
function FolderStats($scope) {

    var _folderStats = {};
    this.clear = function() {
        _folderStats = {};
    };
    
    this.get = function(cmid) {
        if (cmid in _folderStats) return _folderStats[cmid];
        var folderStat = {success: 0, failed: 0, 
            started: 0, pending: 0, delayed: 0, waiting: 0,
            scoreCount: 0, score: 0, maxScore: 0, perc: 0,
            timeCount: 0, time: 0};
        _folderStats[cmid] = folderStat;
        return folderStat;
    };
    
    this.updateForModule = function(folderStat, cm) {
        var childStat = this.get(cm.id);
        folderStat.success += childStat.success;
        folderStat.failed += childStat.failed;
        folderStat.started += childStat.started;
        folderStat.pending += childStat.pending;
        folderStat.delayed += childStat.delayed;
        folderStat.waiting += childStat.waiting;
        folderStat.scoreCount += childStat.scoreCount;
        folderStat.score += childStat.score;
        folderStat.maxScore += childStat.maxScore;
        folderStat.timeCount += childStat.timeCount;
        folderStat.time += childStat.time;
    };

    this.updateForLeaf = function(folderStat, cm) {
        if (cm.state.status == 'waiting') folderStat.waiting += 1;
        else if (cm.state.status == 'delayed') folderStat.delayed += 1;
        else if (cm.state.status == 'pending') folderStat.pending += 1;
        else if (cm.state.status == 'started') folderStat.started += 1;
        else if (cm.state.status == 'failed') folderStat.failed += 1;
        else if (cm.state.status == 'success') folderStat.success += 1;

        if (cm.score !== null) {
            folderStat.scoreCount += 1;
            folderStat.score += cm.score;
            folderStat.maxScore += (cm.maxScore || 0);
        }

        if (cm.time !== null) {
            folderStat.timeCount += 1;
            folderStat.time += cm.time;
        }
    };
    
    this.updateTotals = function(folderStat) {
        folderStat.total = folderStat.success + folderStat.failed + folderStat.started 
            + folderStat.pending + folderStat.delayed + folderStat.waiting;
        folderStat.perc = folderStat.maxScore > 0 ? Math.round((folderStat.score/folderStat.maxScore)*100) : 0;
        folderStat.avgTime = folderStat.timeCount > 0 ? Math.round(folderStat.time/60) : 0;
        _updateChartInfo(folderStat);
    };

    var _chartLabels = ['Done', 'Failed', 'Pending', 'Delayed'];
    var _chartColours = ['#007700', '#F54B22', '#FFCC00', '#770000'];
    function _updateChartInfo(folderStat) {
        var ret = {labels: _chartLabels, colours: _chartColours};
        ret.data = [folderStat.success, folderStat.failed, 
            folderStat.started + folderStat.pending + folderStat.waiting,
            folderStat.delayed];
        folderStat.chartInfo = ret;
    }
}

//-------------------------------------------------------------------------------------------------
function ScopeExtensions(nl, modeHandler, nlContainer, folderStats) {
    
    this.item = null;
    this.stats = null;
    this.pastAttemptData = [];
    this.data = {remarks: ''}; 
	
    this.setCurrentItem = function(cm) {
        this.item = cm;
        this.stats = (cm.type == 'module') ? folderStats.get(cm.id) : null;
        var statusinfo = modeHandler.course.statusinfo;
        this.data.remarks = (statusinfo && cm.id in statusinfo) ? statusinfo[cm.id].remarks || '' : '';
        this.updatePastAttemptData();
        nlContainer.onSave(function(lessonReportInfo) {
            modeHandler.course.lessonReports[cm.id] = lessonReportInfo;
        });
    };
    
    var _updateStatusFn = null;
    this.setUpdateStatusFn = function(fn) {
        _updateStatusFn = fn;
    };

    this.isStaticMode = function() {
        return (modeHandler.mode == MODES.PRIVATE || modeHandler.mode == MODES.PUBLISHED ||
        	modeHandler.mode == MODES.EDIT);
    };

    this.isEditorMode = function() {
        return (modeHandler.mode == MODES.EDIT);
    };
    
    this.canShowRemarks = function() {
        if (!this.item) return false;
        if (this.isStaticMode()) return false;
        if (this.item.hide_remarks) return false;
        return (this.item.type == 'link' || this.item.type == 'info');
    };
    
    this.canUpdateStatus = function() {
        if (!this.item) return false;
        if (modeHandler.mode != MODES.DO) return false;
        if (this.item.type != 'link' && this.item.type != 'info') return false;
        if (this.item.type == 'link' && this.item.autocomplete) return false;
        return (this.item.state.status == 'pending' 
            || this.item.state.status == 'delayed' || this.item.state.status == 'success');
    };

    this.updateStatus = function(isDone, dontHide) {
        if (_updateStatusFn) _updateStatusFn(this.item, isDone, this.data.remarks, dontHide);
    };

    this.canReattempt = function() {
        if (!this.item || this.item.type != 'lesson' || modeHandler.mode != MODES.DO) return false;
        if (this.item.state.status != 'failed' && this.item.state.status != 'success') return false;
        return (this.item.maxAttempts == 0 || this.item.attempt < this.item.maxAttempts);
    };

    this.canLaunch = function() {
        if (!this.item || (this.item.type != 'lesson' && this.item.type != 'link')) return false;
        if (this.isStaticMode()) return true;        
        if (modeHandler.mode == MODES.DO) return (this.item.state.status != 'waiting');
        return (this.item.state.status == 'success' || this.item.state.status == 'failed');
    };

    this.getLaunchString = function() {
        if (this.isStaticMode()|| this.item.type =='link') return 'Open';
        if (this.item.state.status == 'success' || this.item.state.status == 'failed') return 'View report';
        return 'Open';
    };

    this.updatePastAttemptData = function() {
        this.showPastAttempts = false;
        this.pastAttemptData = [];
        if (!this.item || this.item.type != 'lesson') return;
        if (!modeHandler.course.lessonReports) return;
        if (!modeHandler.course.pastLessonReports || 
            !(this.item.id in modeHandler.course.pastLessonReports)) return;
        var pastLessonReport = modeHandler.course.pastLessonReports[this.item.id];

        for(var i in pastLessonReport) {
            var rep = pastLessonReport[i];
            if (!rep.completed || !rep.reportId) continue;
            if (rep.started) rep.started = nl.fmt.json2Date(rep.started);
            if (rep.ended) rep.ended = nl.fmt.json2Date(rep.ended);
            this.pastAttemptData.push(rep);
        }
    };
    
    this.showPastReport = function(rep) {
        var url = nl.fmt2('/lesson/review_report_assign/{}', rep.reportId);
        modeHandler.show(url);
    };

    this.isIconImg = function(cm) {
        if (!cm) return false;
        var icon = ('icon' in cm) ? cm.icon : cm.type;
        if (icon in _icons) return false;
        return true;
    };

    this.getIconCls = function(cm) {
        if (!cm) return '';
        var icon = ('icon' in cm) ? cm.icon : cm.type;
        if (icon in _icons) return _icons[icon];
        return icon;
    };
    
    var _icons = {
        'module': 'ion-ios-folder fblue',
        'lesson': 'ion-document-text fblue',
        'quiz': 'ion-ios-help fblue',
        'info': 'ion-information-circled fblue',
        'link': 'ion-document fblue',
        'user': 'ion-person forange2'
    };
}

//-------------------------------------------------------------------------------------------------
function TreeList(nl, ID_ATTR, DELIM, VISIBLE_ON_OPEN) {
    if (ID_ATTR === undefined) ID_ATTR = 'id';
    if (DELIM === undefined) DELIM = '.';
    if (VISIBLE_ON_OPEN === undefined) VISIBLE_ON_OPEN = 1; // Only top level visible by default
    
    var rootItem = {type: 'module', name: 'Summary', id: '_root'};

    this.clear = function() {
        this.items = {};
        this.children = {};
        this.addItem(rootItem);
    };
    
    this.addItem = function(item) {
        var itemId = item[ID_ATTR];
        this.items[itemId] = item;

        var parents = itemId.split(DELIM);
        parents.pop(); // Remove the last entry
        
        item.indentationLevel = parents.length;
        item.indentationStyle = {'paddingLeft': item.indentationLevel + 'em'};
        item.parentId = parents.join(DELIM);
        
        item.isOpen = (item.indentationLevel < VISIBLE_ON_OPEN-1);
        item.visible = (item.indentationLevel < VISIBLE_ON_OPEN);
        
        if (item.indentationLevel == 0) {
            if (item.id == '_root') {
                item.location = '';
                return;
            }
            item.parentId = '_root';
        }
        var parent = this.getParent(item);
        if (!parent) return;
        this.getChildren(parent).push(item);
        item.location = parent.location == '' ? parent.name : parent.location + '.' + parent.name;
    };
    
    this.getItem = function(itemId) {
        return this.items[itemId] || null;
    };
    
    this.getRootItem = function() {
        return rootItem;
    };

    this.collapseAll = function() {
        for (var itemId in this.items) {
            this.showHideItem(this.items[itemId], false);
        }
    };
    
    this.showHideItem = function(item, bShow) {
        item.isOpen = bShow;
        item.visible = bShow || (item.indentationLevel < 1);
    };

    this.getParent = function(item) {
        if (item.parentId === '') return null;
        return this.items[item.parentId];
    };
    
    this.getChildren = function(item) {
        var itemId = item[ID_ATTR];
        if (!(itemId in this.children)) this.children[itemId] = [];
        return this.children[itemId];
    };
    
    this.toggleItem = function(item) {
        var bOpen = !item.isOpen;
        item.isOpen = bOpen;
        item.visible = true;
        var children = this.getChildren(item);
        for (var i=0; i<children.length; i++) {
            var child = children[i];
            child.isOpen = false;
            child.visible = bOpen;
            this._closeChildren(child);
        }
    };

    this._closeChildren = function(item) {
        var children = this.getChildren(item);
        for (var i=0; i<children.length; i++) {
            var child = children[i];
            child.isOpen = false;
            child.visible = false;
            this._closeChildren(child);
        }
    };
    
    this.clear();
}

//-------------------------------------------------------------------------------------------------
function CourseReportSummarizer($scope) {

    var folderAttrs = {'id': true, 'name': true, 'type': true, 'icon': true};
    this.getUserRecords = function(course, cm) {
        if ($scope.mode != MODES.REPORTS_SUMMARY_VIEW || cm.type == 'module') {
            return [];
        }
        var ret = [];
        var userReports = course.userReports;
        for (var i=0; i<userReports.length; i++) {
            var userReport = userReports[i];
            var module = angular.copy(cm);
            module.id = _getModuleId(cm.id, userReport.id);
            module.name = userReport.studentname;
            module.icon = 'user';
            var start_after = module.start_after || [];
            for(var j in start_after) {
                var sa = start_after[j];
                sa.module = _getModuleId(sa.module, userReport.id);
            }
            ret.push(module);
        }

        // Now change the cm as folder and remove unwanted attributes
        if (!('icon' in cm)) cm.icon = cm.type;
        cm.type = 'module';
        for (var key in cm) {
            if (key in folderAttrs) continue;
            delete cm[key];
        }
        return ret;
    };
    
    this.updateUserReports = function(course) {
        if ($scope.mode != MODES.REPORTS_SUMMARY_VIEW) return;
        var userReports = course.userReports;
        course.userReports = [];
        for (var u in userReports) {
            course.userReports.push(userReports[u]);
        }
        course.userReports = course.userReports.sort(function(a, b) {
            if (a.studentname < b.studentname) return -1;
            // They being equal is very unlikely in our case!
            return 1;
        });
    };

    function _getModuleId(parentId, reportId) {
        return parentId + '.' + reportId;
    }
    
}

//-------------------------------------------------------------------------------------------------
function Reopener(modeHandler, treeList, _userInfo, nl, nlDlg, nlCourse, _updatedStatusinfoAtServer) {

    this.reopenIfNeeded = function() {
        return nl.q(function(resolve, reject) {
            if (modeHandler.mode != MODES.DO) {
                resolve(true);
                return;
            }

            var changeInfo = {updated: false, reopenList:[], failList:[], reopenDict:{}};
            _init();
            _reopenItem(treeList.getRootItem(), changeInfo);
            if (changeInfo.statusUpdated) _updatedStatusinfoAtServer(false);
            if (changeInfo.failList.length == 0) {
                resolve(true);
                return;
            }

            var template ='<p></p><p>Your score is below the pass level in the following modules:</p><ul>';
            for (var i in changeInfo.failList) {
                template += nl.fmt2('<li>{}</li>', changeInfo.failList[i].name);
            }
            template += '</ul><p></p><p>The following modules have to be redone. Their status and learning records will be reset:</p><ul>';
            for (var i in changeInfo.reopenList) {
                template += nl.fmt2('<li>{}</li>', changeInfo.reopenList[i].name);
            }
            template += '</ul><p></p>';
            nlDlg.popupAlert({title: 'Warning', template: template}).then(function() {
                _updateLessonReports(changeInfo.reopenList, resolve);
            });

        });
    };
    
    var lessonReports = null;
    var statusinfos = null;
    function _init() {
        if (!modeHandler.course.lessonReports) modeHandler.course.lessonReports = {};
        lessonReports = modeHandler.course.lessonReports;
        if (!modeHandler.course.statusinfo) modeHandler.course.statusinfo = {};
        statusinfos = modeHandler.course.statusinfo;
    }

    function _reopenItem(cm, changeInfo) {
        if (cm.type == 'module') {
            var children = treeList.getChildren(cm);
            for (var i=0; i<children.length; i++) {
                var child = children[i];
                _reopenItem(child, changeInfo);
            }
            return;
        }
        if (cm.type != 'lesson' || !cm.reopen_on_fail) return;
        if (!(cm.id in lessonReports)) return;
        if (!lessonReports[cm.id].completed) return;
        var lessonReport = lessonReports[cm.id];
        var passScore = parseInt(lessonReport.passScore || 0);
        var score = parseInt(lessonReport.score || 0);
        var maxScore = parseInt(lessonReport.maxScore || 0);
        var perc = maxScore ? Math.round((score/maxScore)*100) : 100;
        if (perc >= passScore) return;
 
        cm.attempt = lessonReport.attempt || 0;
        
        for (var i in cm.reopen_on_fail) {
            var depModule = treeList.getItem(cm.reopen_on_fail[i]);
            if (!depModule) continue;
            if (depModule.type == 'info' || depModule.type == 'link') {
                if (!(depModule.id in statusinfos)) continue;
                statusinfos[depModule.id] = {status: '',
                    date: nl.fmt.date2Str(new Date(), 'date'), 
                    username: _userInfo.username,
                    remarks: ''
                };
                changeInfo.statusUpdated = true;
                continue;
            }
            if (!(depModule.id in lessonReports)) continue;
            var lessonReport = lessonReports[depModule.id];
            if (!lessonReport.completed) continue;
            depModule.attempt = lessonReport.attempt || 0;
            if (!(depModule.id in changeInfo.reopenDict)) changeInfo.reopenList.push(depModule);
            changeInfo.reopenDict[depModule.id] = depModule;
        }

        changeInfo.failList.push(cm);
        if (!(cm.id in changeInfo.reopenDict)) changeInfo.reopenList.push(cm);
        changeInfo.reopenDict[cm.id] = cm;
    }

    function _updateLessonReports(reopenLessons, resolve) {
        if (reopenLessons.length == 0) {
            resolve(true);
            return;
        }
        nlDlg.showLoadingScreen();
        _createLessonReport(reopenLessons, 0, resolve);
    }

    function _createLessonReport(reopenLessons, pos, resolve) {
        if (pos >= reopenLessons.length) {
            nlDlg.hideLoadingScreen();
            resolve(true);
            return;
        }

        var cm = reopenLessons[pos];
        cm.attempt++;
        nlCourse.courseCreateLessonReport(modeHandler.course.id, cm.refid, cm.id, cm.attempt)
        .then(function(updatedCourseReport) {
            modeHandler.course = updatedCourseReport;
            _createLessonReport(reopenLessons, pos+1, resolve);
        }, function(err) {
            nlDlg.hideLoadingScreen();
            resolve(false);
        });
    }
}

//-------------------------------------------------------------------------------------------------
function NlContainer(nl, $scope, modeHandler) {
    this.setContainerInWindow = function() {
        nl.log.debug('setContainerInWindow called');
        nl.window.NITTIO_LEARN_CONTAINER = this;
    };
    
    var _onSaveHandler = null;
    this.onSave = function(fn) {
        _onSaveHandler = fn;
    }
    
    this.log = nl.log;

    this.init = function(data) {
        nl.log.debug('NlContainer.init: ', data);
    };
    
    this.getCourse = function() {
        return modeHandler.course;
    };
    
    this.getCurrentModule = function() {
        return $scope.ext.item;
    };
    
    this.save = function(reportId, lesson, bDone) {
        if (modeHandler.mode != MODES.DO) return;
        var completed = lesson.completed || bDone;
        var lessonReportInfo = {reportId: reportId, completed: completed, 
                            score: lesson.score, maxScore: lesson.maxScore};
        lessonReportInfo.attempt = lesson.attempt || 1;
        if (lesson.started)  lessonReportInfo.started = lesson.started;
        if (lesson.ended) lessonReportInfo.ended = lesson.ended;
        if (lesson.timeSpentSeconds) lessonReportInfo.timeSpentSeconds = lesson.timeSpentSeconds;
        if (lesson.passScore)  lessonReportInfo.passScore = lesson.passScore;
        if (_onSaveHandler) _onSaveHandler(lessonReportInfo);
        $scope.updateAllItemData();
    }

    this.close = function() {
        $scope.closeIFrame();
    }
}

//-------------------------------------------------------------------------------------------------
function CourseViewDirective(template) {
    return ['nl', function(nl) {
        return {
            restrict: 'E',
            templateUrl: nl.fmt2('view_controllers/course/{}.html', template),
            scope: true
        };
    }];
}

//-------------------------------------------------------------------------------------------------
function CourseJsonToTextDirective() {
    return {
        restrict: 'A',
        require: 'ngModel',
        link: function($scope, elem, attr, ngModel) {            
          function into(input) {
            return JSON.parse(input);
          }
          function out(data) {
            return JSON.stringify(data);
          }
          ngModel.$parsers.push(into);
          ngModel.$formatters.push(out);

        }
    };
};

//-------------------------------------------------------------------------------------------------
module_init();
})();
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
    .directive('nlCourseViewFrame', CourseViewDirective('course_view_frame'))
    .directive('nlCourseViewIcon', CourseViewDirective('course_view_icon', 
        {cm: '=', ext: '=', cls: '@'}))
    .config(configFn).controller('nl.CourseViewCtrl', NlCourseViewCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.course_view', {
        url : '^/course_view',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/course/view/course_view.html',
                controller : 'nl.CourseViewCtrl'
            }
        }
    });
}];

var MODES = {PRIVATE: 0, PUBLISHED: 1, REPORT_VIEW: 2, DO: 3, EDIT: 4, REPORTS_SUMMARY_VIEW: 5};
var MODE_NAMES = {'private': 0, 'published': 1, 'report_view': 2, 'do': 3, 'edit': 4, 'reports_summary_view': 5};

function ModeHandler(nl, nlCourse, nlServerApi, nlDlg, nlGroupInfo, $scope) {
    var self=this;
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
            nl.pginfo.pageSubTitle = nl.t('({})', nlGroupInfo.formatUserNameFromRecord(course));
        } else if (this.mode === MODES.DO) {
            nl.pginfo.pageSubTitle = nl.t('({})', nl.pginfo.username);
        } 
    };
    
    this.getCourse = function() {
        if (this.mode === MODES.PRIVATE || this.mode === MODES.EDIT || this.mode === MODES.PUBLISHED) {
            return nlServerApi.courseGet(this.courseId, this.mode === MODES.PUBLISHED);
        }
        if (this.mode === MODES.REPORTS_SUMMARY_VIEW) {
            return nlGroupInfo.init().then(function() {
                return nlServerApi.courseGetAssignmentReportSummary({assignid: self.courseId});
            });
        }
        if (this.mode === MODES.REPORT_VIEW) {
            return nlGroupInfo.init().then(function() {
                return nlServerApi.courseGetReport(self.courseId, false);
            });
        }
        return nlServerApi.courseGetReport(this.courseId, true);
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
        nlServerApi.courseCreateLessonReport(self.course.id, refid, cm.id, cm.attempt).then(function(updatedCourseReport) {
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
                var scores = _getScores(lessonReport, true);
                prereqScore = scores.maxScore > 0 ? Math.round((scores.score/scores.maxScore)*100) : 100;
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
                $scope.updateVisiblePanes();
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
var NlCourseViewCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCourse', 'nlIframeDlg', 'nlExporter',
'nlCourseEditor', 'nlCourseCanvas', 'nlServerApi', 'nlGroupInfo', 'nlSendAssignmentSrv', 'nlMarkup',
function(nl, nlRouter, $scope, nlDlg, nlCourse, nlIframeDlg, nlExporter,
    nlCourseEditor, nlCourseCanvas, nlServerApi, nlGroupInfo, nlSendAssignmentSrv, nlMarkup) {
    var modeHandler = new ModeHandler(nl, nlCourse, nlServerApi, nlDlg, nlGroupInfo, $scope);
    var nlContainer = new NlContainer(nl, $scope, modeHandler);
    nlContainer.setContainerInWindow();
    var treeList = new TreeList(nl);
    var courseReportSummarizer = new CourseReportSummarizer(nlGroupInfo, $scope);
    var _userInfo = null;
    $scope.MODES = MODES;
    var folderStats = new FolderStats($scope);
    $scope.ext = new ScopeExtensions(nl, modeHandler, nlContainer, nlCourseEditor, nlCourseCanvas, folderStats);

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
            $scope.canSendAssignment = $scope.mode == MODES.PUBLISHED &&
                nlRouter.isPermitted(userInfo, 'course_assign');
            $scope.showStatusIcon = modeHandler.shallShowScore();
            var courseId = parseInt($scope.params.id);
            modeHandler.getCourse().then(function(course) {
                _onCourseRead(course);
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
		course = nlCourse.migrateCourse(course);
        modeHandler.initTitle(course);
        nlCourseCanvas.init($scope, modeHandler, treeList, _userInfo);
        _initAttributesDicts(course);
        courseReportSummarizer.updateUserReports(course);
        $scope.courseContent = course.content;
        $scope.planning = course.content.planning;
        if ('forumRefid' in course) {
            $scope.forumInfo = {refid: course.forumRefid, secid: course.id};
        } else {
            $scope.forumInfo = {refid: 0};
        }
        var modules = course.content.modules;
	    var allModules = nlCourseEditor.getAllModules(true);
        for(var i=0; i<modules.length; i++) {
            var module = angular.copy(modules[i]);
            var userRecords = courseReportSummarizer.getUserRecords(course, module);
            _initModule(module);
            allModules.push(module);
            for(var j=0; j<userRecords.length; j++) {
                _initModule(userRecords[j]);
                allModules.push(userRecords[j]);
            }
        }
        nl.timeout(function() {
            _updateAllItemData();
            $scope.ext.setCurrentItem(treeList.getRootItem());
            _showVisible();
        });
    }

	function _moveItem(movedItem, fromIndex, toIndex, allModules) {
		var currentItem = allModules[toIndex];
		var isMoveDown = fromIndex < toIndex ? true : false;
		_moveItemAndChildrenPos(movedItem, {from: fromIndex, to: toIndex}, allModules);
		if (isMoveDown && currentItem.type === 'module') {
			movedItem.parentId = currentItem.id;
			_updateItemAndChildrenAttrs(movedItem, allModules);
		} else {
			movedItem.parentId = currentItem.parentId;
			_updateItemAndChildrenAttrs(movedItem, allModules);			
		}
    }

	function _moveItemAndChildrenPos(item, indices, allModules) {
		allModules.splice(indices.from, 1);
		allModules.splice(indices.to, 0, item);
    	indices.from++;
    	indices.to++;
	    var children = treeList.getChildren(item);
	    for(var i=0; i<children.length; i++) {
	    	_moveItemAndChildrenPos(children[i], indices, allModules);
	    }
	}
	
	function _updateItemAndChildrenAttrs(item, allModules) {
		var parent = treeList.getParent(item);
        item.indentationLevel = parent ? parent.indentationLevel+1 : -1;
        item.indentationStyle = {'paddingLeft': item.indentationLevel + 'em'};
        item.location = (parent && parent.location) ? parent.location + '.' + parent.name :
            parent ? parent.name : '';
	    var children = treeList.getChildren(item);
	    for(var i=0; i<children.length; i++) {
	    	_updateItemAndChildrenAttrs(children[i], allModules);
	    }
	}

    function _initAttributesDicts() {
        if (!$scope.ext.isStaticMode()) return;
        $scope.editorCb = {
        	initModule: function(cm) {
                _initModule(cm);
        	},
        	getParent: function(cm) {
        		return treeList.getParent(cm);
        	},
        	showVisible: function(cm) {
        	    $scope.showVisible(cm);
        	},
        	moveItem: function(movedItem, fromIndex, toIndex, allModules){
        		return _moveItem(movedItem, fromIndex, toIndex, allModules);
        	},
        	updateChildrenLinks: function(allModules) {
        		return treeList.updateChildrenLinks(allModules);
        	},
        	launchModule: function(e, cm){
        	        e.stopImmediatePropagation();
			        e.preventDefault();
        			_confirmIframeClose(cm, function() {
            		_onLaunchImpl(cm);
        		});
        	}
        };
        nlCourseEditor.init($scope, modeHandler, _userInfo);
    }

    // One or more of the below panes could be visible at any time
    // t = tree, c = canvas, d = details, i = iframe. c/d/i are part of
    // content area.
    $scope.vp = {}; // Finally whatever is visible currently in a dict
    $scope.iframeUrl = null;     // true if content area contains iframe.
    $scope.iframeModule = null;
    $scope.canvasMode = false;    // true if content has canvas enabled.
    $scope.canvasShown = false;  // true if content area contains canvas.
    $scope.popupView = false;    // true if content area is popped out.
    $scope.expandedView = false; // true if tree + content area is shown

    $scope.updateVisiblePanes = function() {
        var oldExpandedView = $scope.expandedView;
        $scope.expandedView = (nl.rootScope.screenSize != 'small');
        if (oldExpandedView && !$scope.expandedView && $scope.iframeUrl) {
            $scope.popupView = true;
        }

        $scope.vp = {};
        var vp = $scope.vp;
        if ($scope.canvasMode && !$scope.ext.isEditorMode()) {
            // canvas mode non-editor
            if ($scope.iframeUrl) vp.i = true;
            else if ($scope.canvasShown) vp.c = true;
            else vp.d = true;
        } else {
            // canvas mode editor, structured mode editor/non-editor
            if (!$scope.popupView) vp.t = true;
            if ($scope.iframeUrl) vp.i = true;
            else if ($scope.popupView || $scope.expandedView) {
                if ($scope.canvasShown) vp.c = true;
                else vp.d = true;
            }
        }
        nlRouter.updateBodyClass('iframeActive', vp.i);
    };
    
    nl.resizeHandler.onResize(function() {
        $scope.updateVisiblePanes();
    });

    function _popout(bPopout) {
        nl.pginfo.isMenuShown = !bPopout;
        $scope.popupView = bPopout;
        $scope.updateVisiblePanes();
    }

    $scope.updateCanvasShown = function(e, shown) {
        if (!$scope.canvasMode) return;

        $scope.canvasShown = shown;
        if ($scope.canvasShown) nlCourseCanvas.update();
        if(!$scope.expandedView) _popout(true);
        else $scope.updateVisiblePanes();
    };

    $scope.showVisible = function(cm) {
        if (cm) $scope.ext.setCurrentItem(cm);
        else $scope.ext.setCurrentItem(treeList.getRootItem());
        _showVisible();
    };
    
    function _showVisible() {
        $scope.modules = [];
	    var allModules = nlCourseEditor.getAllModules();
        for(var i=0; i<allModules.length; i++) {
            var cm=allModules[i];
            if (!cm.visible) continue;
            $scope.modules.push(cm);
        }
        $scope.updateVisiblePanes();
    }

    $scope.download = function() {
        _download();
    };

    $scope.sendAssignment = function() {
        _sendAssignment();
    };

    $scope.collapseAll = function(bShowCanvas) {
        function _impl() {
	        if($scope.ext.isEditorMode()){
		        if(!nlCourseEditor.validateInputs($scope.ext.item)) return;    	
	        }
            if(!$scope.ext.isEditorMode() && $scope.canvasMode) {
                $scope.canvasShown = bShowCanvas;
                if ($scope.canvasShown) nlCourseCanvas.update();
            }
            treeList.collapseAll();
            _showVisible();
            $scope.ext.setCurrentItem(treeList.getRootItem());
            if(!$scope.expandedView) _popout(true);
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
            $scope.updateVisiblePanes();
            nextFn();
            return;
        }
        nlDlg.popupConfirm({title: nl.t('Please confirm'), 
            template: nl.t('Do you want to navigate away from current module?')})
            .then(function(res) {
                if (!res) return;
                $scope.iframeUrl = null;
                $scope.iframeModule = null;
                $scope.updateVisiblePanes();
                nextFn();
            });
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
        if($scope.ext.isEditorMode() && bClose){
        	if(!nlCourseEditor.validateInputs($scope.ext.item)) return;
        	_confirmIframeClose(!bClose ? $scope.ext.item : null, _impl);
        } else {
	        _confirmIframeClose(!bClose ? $scope.ext.item : null, _impl);    	
        }
    };
    
    $scope.closeIFrame = function() {
        nl.timeout(function() {
            $scope.iframeUrl = null;
            $scope.iframeModule = null;
            $scope.updateVisiblePanes();
            if($scope.popupView) _popout(false);
        });
    };
    
    $scope.updateAllItemData = function() {
        nl.timeout(function() {
            _updateAllItemData();
        });
    };

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
    };

    $scope.onClick = function(e, cm) {
        e.stopImmediatePropagation();
        e.preventDefault();
        if($scope.ext.isEditorMode()){
	        if(!nlCourseEditor.validateInputs($scope.ext.item)) return;    	
        }
        function _impl() {
            $scope.ext.setCurrentItem(cm);
            if(cm.type === 'module') {
                treeList.toggleItem(cm);
                _showVisible();
                return;
            }
            if (!$scope.expandedView) _popout(true);
            if($scope.ext.isEditorMode()) return;
            var openModule = $scope.ext.isStaticMode() || (cm.state.status == 'delayed') || 
                (cm.state.status == 'pending') || (cm.state.status == 'started');
        	openModule = openModule && (cm.type == 'lesson' || cm.type == 'link' || cm.type == 'certificate');
            if (openModule) _onLaunchImpl(cm);            	                	
        }
        _confirmIframeClose(null, _impl);
    };

    $scope.onLaunch = function(e, cm) {
        e.stopImmediatePropagation();
        e.preventDefault();
        _confirmIframeClose(cm, function() {
            _onLaunchImpl(cm);
        });
    };
    
    function _onLaunchImpl(cm) {
        if (cm.type === 'lesson') modeHandler.handleLessonLink(cm, false, $scope);
        else if(cm.type === 'link' || cm.type === 'certificate') modeHandler.handleLink(cm, false, $scope);
    }

    $scope.onReattempt = function(e, cm) {
        var template = 'Current learning history for this module will be lost if you attempt this module once more. Do you want to continue?';
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
    };

    function _updateState(cm, state) {
        // statusIcon, statusText, statusShortText
        cm.state = angular.copy(_CM_STATES[state] || _CM_STATES.hidden);
        cm.state.status = state;
    }
    
    function _initModule(cm) {
        treeList.addItem(cm);
        _updateState(cm, 'none');
        var retData = {lessPara: true};
    	cm.textHtml = cm.text ? nlMarkup.getHtml(cm.text, retData): '';
        cm.planned_date = cm.planned_date ? nl.fmt.json2Date(cm.planned_date) : null;
        cm.start_date = cm.start_date ? nl.fmt.json2Date(cm.start_date) : null;
        if (!('maxAttempts' in cm) && cm.type == 'lesson') cm.maxAttempts = 1;
    }

    function _updateAllItemData() {
        var today = new Date();
        folderStats.clear();
        var reopener = new Reopener(modeHandler, treeList, _userInfo, nl, nlDlg, 
            nlServerApi, _updatedStatusinfoAtServer);
        reopener.reopenIfNeeded().then(function() {
            _updateItemData(treeList.getRootItem(), today);
        });
    }

    function _updateItemData(cm, today) {
        if (cm.type === 'module') {
            _updateModuleData(cm, today);
        } else if (cm.type === 'info' || cm.type === 'link' || cm.type === 'certificate') {
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
        cm.totalItems = folderStat.total;
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

        var scores = _getScores(lessonReport);
        if ('maxScore' in scores) cm.maxScore = scores.maxScore;
        cm.passScore = cm.maxScore ? parseInt(lessonReport.passScore || 0) : 0;

        if (lessonReport.completed && 'score' in scores) {
            cm.score = scores.score;
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
        nlServerApi.courseReportUpdateStatus(repid, JSON.stringify(modeHandler.course.statusinfo))
        .then(function(courseReport) {
            if (currentSaveNumber > _saveDoneNumber)
                _saveDoneNumber = currentSaveNumber;
            if (bBlockUI) nlDlg.hideLoadingScreen();
        });
    }
    
    function _download() {
        if ($scope.mode != MODES.REPORTS_SUMMARY_VIEW) return;

        nlDlg.showLoadingScreen();
        return nlGroupInfo.init().then(function() {
            nlDlg.hideLoadingScreen();
            _downloadImpl(nlGroupInfo.get());
        }, function(e) {
            return e;
        });
    }
        
    function _sendAssignment() {
        if (!$scope.canSendAssignment) return;
        var c = modeHandler.course;
        var assignInfo = {type: 'course', id: c.id, icon: c.icon, 
            title: c.name, authorName: c.authorName, subjGrade: '',
            description: c.description, esttime: ''};
        nlSendAssignmentSrv.show($scope, assignInfo);
    }
    
    function _downloadImpl(_groupInfo) {
        var data = [];
        data.push(['User name', 'Module', 'Type', 'Status', 'Time spent', 'Score', 'Max score', 'Percentage', 'Location', 'User id', 'User loginid', 'Started', 'Ended', 'Attempt']);
	    var allModules = nlCourseEditor.getAllModules();
        var pos=0;
        for(var i=0; i<allModules.length; i++) {
            var cm = allModules[i];
            if (cm.type == 'module') continue;
            var parent = treeList.getItem(cm.parentId);
            if (!parent) continue; // This is a must in REPORTS_SUMMARY_VIEW
            var loginid = '';
            if (_groupInfo && _groupInfo.users[''+cm.userid]) {
                var userInfo = _groupInfo.users[''+cm.userid];
                loginid = userInfo[nlGroupInfo.USERNAME];
            }

            var row = [cm.name, parent.name, cm.type, cm.state.status, 
                cm.timeMins !== undefined ? cm.timeMins : '',
                cm.score || '',  cm.maxScore || '', 
                cm.perc ? cm.perc + '%' : '', parent.location,
                'id='+cm.userid, loginid, 
                cm.started ? nl.fmt.date2Str(nl.fmt.json2Date(cm.started), 'minute') : '', 
                cm.ended ? nl.fmt.date2Str(nl.fmt.json2Date(cm.ended), 'minute') : '', 
                cm.attempt || ''];
            data.push(row);
        }
        
        var fileName = nl.fmt2('CourseAssignmentReport-{}', nl.fmt.date2Str(new Date(), 'date'));
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
function ScopeExtensions(nl, modeHandler, nlContainer, nlCourseEditor, nlCourseCanvas, folderStats) {
    
    this.item = null;
    this.stats = null;
    this.pastAttemptData = [];
    this.data = {remarks: ''}; 
	
    this.setCurrentItem = function(cm) {
        this.item = cm;
		if (this.isEditorMode()) nlCourseEditor.initSelectedItem(this.item);
        this.stats = (cm.type == 'module') ? folderStats.get(cm.id) : null;
        var statusinfo = modeHandler.course.statusinfo;
        this.data.remarks = (statusinfo && cm.id in statusinfo) ? statusinfo[cm.id].remarks || '' : '';
        this.updatePastAttemptData();
        nlContainer.onSave(function(lessonReportInfo) {
            modeHandler.course.lessonReports[cm.id] = lessonReportInfo;
        });
        nlCourseCanvas.update();
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
        return (this.item.type == 'link' || this.item.type == 'info' || this.item.type == 'certificate');
    };
    
    this.canUpdateStatus = function() {
        if (!this.item) return false;
        if (modeHandler.mode != MODES.DO) return false;
        if (this.item.type != 'link' && this.item.type != 'info') return false;
        if (this.item.type == 'link' && this.item.autocomplete) return false;
        if (this.item.type == 'certificate' && this.item.autocomplete) return false;
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
        if (!this.item || (this.item.type != 'lesson' && this.item.type != 'link' && this.item.type != 'certificate')) return false;
        if (this.isStaticMode()) return true;        
        if (modeHandler.mode == MODES.DO) return (this.item.state.status != 'waiting');
        return (this.item.state.status == 'success' || this.item.state.status == 'failed');
    };

    this.getLaunchString = function() {
        if (!this.item) return '';
        if (this.isStaticMode()|| this.item.type =='link' || this.item.type =='certificate') return 'Open';
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
        var icon = cm.icon || cm.type;
        if (icon in _icons) return false;
        return true;
    };

    this.getIconCls = function(cm) {
        if (!cm) return '';
        var icon = cm.icon || cm.type;
        if (icon in _icons) return _icons[icon];
        return icon;
    };
    
    var _icons = {
        'module': 'ion-ios-folder fblue',
        'lesson': 'ion-document-text fblue',
        'quiz': 'ion-ios-help fblue',
        'info': 'ion-information-circled fblue',
        'certificate': 'ion-android-star fblue',
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
        
        if (itemId == '_root') {
            item.parentId =  '';
        } else if (!item.parentId) {
            var parents = itemId.split(DELIM);
            parents.pop(); // Remove the last entry
            item.parentId = (parents.length == 0) ? '_root' : parents.join(DELIM);
        }
        var parent = this.getParent(item);
        item.indentationLevel = parent ? parent.indentationLevel+1 : -1;
        item.indentationStyle = {'paddingLeft': item.indentationLevel + 'em'};
        item.isOpen = (item.indentationLevel < VISIBLE_ON_OPEN-1);
        item.visible = (item.indentationLevel < VISIBLE_ON_OPEN);
        item.location = (item.id == '_root') ? '' : 
            (parent && parent.location) ? parent.location + '.' + parent.name :
            parent ? parent.name : '';
        
        if (parent) this.getChildren(parent).push(item);
    };
    
    this.updateItem = function(item, oldPos, newPos, allModules) {
        var parent = this.getParent(item);
        item.indentationLevel = parent ? parent.indentationLevel+1 : -1;
        item.indentationStyle = {'paddingLeft': item.indentationLevel + 'em'};
        item.location = (item.id == '_root') ? '' : 
            (parent && parent.location) ? parent.location + '.' + parent.name :
            parent ? parent.name : '';
	    var children = this.getChildren(parent);
	    if(children.length !== 0){
		    for(var i=0; i<children.length; i++){
		    	newPos++;
		    	allModules.splice(newPos, 0, children[i]);
		    }
	    }
	    _updateAllItemData();
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
        if (!item.parentId || !(item.parentId in this.items)) return null;
        return this.items[item.parentId];
    };
    
    this.getChildren = function(item) {
        var itemId = item[ID_ATTR];
        if (!(itemId in this.children)) this.children[itemId] = [];
        return this.children[itemId];
    };
    
    this.updateChildrenLinks = function(allModules) {
        this.clear();
        for(var i=0; i<allModules.length; i++) {
            var item = allModules[i];
            var itemId = item[ID_ATTR];
            this.items[itemId] = item;
            var parent = this.getParent(item);
            if (parent) this.getChildren(parent).push(item);
        }
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
function CourseReportSummarizer(nlGroupInfo, $scope) {

    var folderAttrs = {'id': true, 'name': true, 'type': true, 'icon': true, 'parentId': true};
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
            module.parentId = cm.id;
            module.name = nlGroupInfo.formatUserNameFromRecord(userReport);
            module.userid = userReport.student;
            module.icon = 'user';
            if ('posX' in module) delete module.posX;
            if ('posY' in module) delete module.posY;
            
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
            if (nlGroupInfo.formatUserNameFromRecord(a) < 
                nlGroupInfo.formatUserNameFromRecord(b)) return -1;
            // They being equal is very unlikely in our case!
            return 1;
        });
    };

    function _getModuleId(parentId, reportId) {
        return parentId + '.' + reportId;
    }
    
}

//-------------------------------------------------------------------------------------------------
function Reopener(modeHandler, treeList, _userInfo, nl, nlDlg, nlServerApi, _updatedStatusinfoAtServer) {

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
        var scores = _getScores(lessonReport, true);
        var passScore = scores.maxScore ? parseInt(lessonReport.passScore || 0) : 0;
        var perc = scores.maxScore ? Math.round((scores.score/scores.maxScore)*100) : 100;
        if (perc >= passScore) return;
 
        cm.attempt = lessonReport.attempt || 0;
        
        for (var i in cm.reopen_on_fail) {
            var depModule = treeList.getItem(cm.reopen_on_fail[i]);
            if (!depModule) continue;
            if (depModule.type == 'info' || depModule.type == 'link' || depModule.type == 'certificate') {
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
        nlServerApi.courseCreateLessonReport(modeHandler.course.id, cm.refid, cm.id, cm.attempt)
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
    };
    
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
        if (lesson.selfLearningMode)  lessonReportInfo.selfLearningMode = lesson.selfLearningMode;
        if (_onSaveHandler) _onSaveHandler(lessonReportInfo);
        $scope.updateAllItemData();
    };

    this.close = function() {
        $scope.closeIFrame();
    };
}

//-------------------------------------------------------------------------------------------------
function CourseViewDirective(template, scope) {
    if (scope === undefined) scope = true;
    return _nl.elemDirective('view_controllers/course/view/' + template 
        + '.html', scope);
}

//-------------------------------------------------------------------------------------------------
// General global function
function _getScores(lessonReport, defaultZero) {
    var ret = {};
    var sl = lessonReport.selfLearningMode;
    if (defaultZero || 'maxScore' in lessonReport) ret.maxScore = parseInt(sl ? 0 : lessonReport.maxScore||0);
    if (defaultZero || 'score' in lessonReport) ret.score = parseInt(sl ? 0 : lessonReport.score||0);
    return ret;
}
    

//-------------------------------------------------------------------------------------------------
module_init();
})();
(function() {

//-------------------------------------------------------------------------------------------------
// course_view.js:
// course_view module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.course_view', [])
    .service('nlTreeListSrv', TreeListSrv)
    .directive('nlCourseViewToolbar', CourseViewDirective('course_view_toolbar'))
    .directive('nlCourseViewList', CourseViewDirective('course_view_list'))
    .directive('nlCourseViewContentActive', CourseViewDirective('course_view_content_active'))
    .directive('nlCourseViewContentStatic', CourseViewDirective('course_view_content_static'))
    .directive('nlCourseViewLargeScreen', CourseDoReviewDirective('course_active_ls'))
    .directive('nlCourseViewSmallScreen', CourseDoReviewDirective('course_active_ss'))
    .directive('nlCourseViewActiveToolbar', CourseDoReviewDirective('course_active_toolbar'))
    .directive('nlCourseViewSummary', CourseDoReviewDirective('course_active_summary'))
    .directive('nlCourseLargeScreenDetails', CourseDoReviewDirective('course_details_ls'))
    .directive('nlCourseSmallScreenDetails', CourseDoReviewDirective('course_details_ss'))
    .directive('nlCoursePastAttemptData', CourseDoReviewDirective('course_past_attempt_table'))
    .directive('nlCourseNumberOfAttempts', CourseDoReviewDirective('course_past_attempt'))
    .directive('nlCourseReviewRemarks', CourseDoReviewDirective('course_review_remarks'))
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

var MODES = {PRIVATE: 0, PUBLISHED: 1, REPORT_VIEW: 2, DO: 3, EDIT: 4};
var MODE_NAMES = {'private': 0, 'published': 1, 'report_view': 2, 'do': 3, 'edit': 4};

function ModeHandler(nl, nlCourse, nlServerApi, nlDlg, nlGroupInfo, $scope) {
    var self=this;
    this.mode = MODES.PRIVATE;
    this.courseId = null;
    this.course = null;
    this.debug = false;
    this.initMode = function() {
        var params = nl.location.search();
        if ('debug' in params) this.debug = true;
        if (!('mode' in params) || !(params.mode in MODE_NAMES)) return false;
        this.mode = MODE_NAMES[params.mode];
        if (!('id' in params)) return false;
        this.courseId = parseInt(params.id);
        return true;
    };
    
    this.getModeName = function() {
    	for(var modeName in MODE_NAMES)
    		if (MODE_NAMES[modeName] == this.mode) return modeName;
    	return 'private';
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
        if (this.mode === MODES.REPORT_VIEW) {
            return nlGroupInfo.init().then(function() {
                return nlServerApi.courseGetReport(self.courseId, false);
            });
        }
        return nlServerApi.courseGetReport(this.courseId, true);
    };
    
    this.handleLink = function(cm, newTab, scope) {
    	cm.action = cm.action || 'none'; 
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
        if(reportInfo) {
            if ((cm.state.status == 'success' || cm.state.status == 'failed')
                && $scope.ext.pastAttemptData.length > 1) {
                return nl.q(function(resolve, reject) {
                    var dlg = nlDlg.create($scope);
                    dlg.setCssClass('nl-width-max');
                    dlg.scope.ext = {};
                    dlg.scope.ext.pastAttemptData = $scope.ext.pastAttemptData;
                    dlg.scope.ext.hideReviewButton = function() {
                        return $scope.ext.hideReviewButton($scope.ext.item);
                    }
                    dlg.scope.ext.getRoundedPercentage = function(score, maxScore, attempt) {
                        return $scope.ext.getRoundedPercentage(score, maxScore, attempt);
                    }
                    dlg.scope.ext.showPastReport = function(rep) {
                        nlDlg.closeAll();
                        _lessonReview(rep, cm, newTab, false, scope);
                    }
                    var cancelButton = {text : nl.t('Cancel')};
                    dlg.show('view_controllers/course/view_active/course_past_attempt_table_dlg.html', [], cancelButton);
                });
            } else {
                _lessonReview(reportInfo, cm, newTab, reportInfo.completed ? false : true, scope);
            }
            return true;
        }
        
        // do mode
        nlDlg.showLoadingScreen();
        nlServerApi.courseCreateLessonReport(self.course.id, refid, cm.id, cm.attempt+1, cm.maxDuration||0, self.course.not_before||'', self.course.not_after||'', true)
        .then(function(updatedCourseReport) {
            nlDlg.hideLoadingScreen();
            cm.attempt++;
            self.course = updatedCourseReport;
            scope.updateAllItemData();
            reportInfo = self.course.lessonReports[cm.id];
            _redirectToLessonReport(reportInfo, newTab, cm, false, scope);
        });
        return true;
    };

    this.shallShowScore = function() {
        return (this.mode === MODES.REPORT_VIEW || this.mode === MODES.DO);
    };

    this.canStart = function(cm, scope, nlTreeListSrv) {
        return _startDateOk(cm, scope, nlTreeListSrv) && _prereqsOk(this, cm, nlTreeListSrv);
    };

    this.show = function(url, newTab) {
        _redirectTo('{}', url, newTab);
    };

    this.getMaxScoredLessonReport = function(lessonReport, pastLessonReport) {
        var maxScoredReport = angular.copy(lessonReport);
        var maxPerc = _getPerc(maxScoredReport);
        var totalTimeSpent = lessonReport['timeSpentSeconds'] || 0;
        for(var i=pastLessonReport.length-1; i>=0; i--) {
            var pastRep = pastLessonReport[i];
            if (!pastRep.completed || !pastRep.reportId) continue; // For data created by old bug (see #956)
            totalTimeSpent += pastRep['timeSpentSeconds'];
            var pastPerc = _getPerc(pastRep);
            if(pastPerc <= maxPerc) continue;
            maxScoredReport = pastRep;
            maxPerc = pastPerc;
        }
        maxScoredReport['timeSpentSeconds'] = totalTimeSpent;
        return maxScoredReport;
    }

    function _getPerc(report) {
        if (report.selfLearningMode) return 0.0;
        if (!report.score || !report.maxScore) return 0.0;
        return 100.0*report.score/report.maxScore;
    }
    
    // Private functions
    function _lessonReview(rep, cm, newTab, bUpdate, scope) {
        if (self.mode === MODES.REPORT_VIEW) {
            if (!rep || !rep.completed) return _popupAlert('Not completed', 
                'This learning module is not yet completed. You may view the report once it is completed.');
            return _redirectTo('/lesson/review_report_assign/{}', rep.reportId, newTab);
        }
        if (_redirectToLessonReport(rep, newTab, cm, bUpdate, scope)) return true;
    }

    function _startDateOk(cm, scope, nlTreeListSrv) {
        var today = new Date();
        if (scope.planning && cm.start_date && cm.start_date > today) {
            _setDependencyArray(cm, cm.start_after || [], nlTreeListSrv, cm.start_date);
            return false;
        }
        return true;
    }
            
    function _prereqsOk(self, cm, nlTreeListSrv) {
        var prereqs = cm.start_after || [];
        var lessonReports = self.course.lessonReports || {};
        var statusinfo = self.course.statusinfo || {};
        _setDependencyArray(cm, prereqs, nlTreeListSrv, null);
        for(var i=0; i<prereqs.length; i++){
            var p = prereqs[i];
            var cmid = p.module;
            var item = nlTreeListSrv.getItem(cmid);
            if (!item) continue; // ignore
            if (item.state.status == 'waiting') return false;
            if (item.type == 'certificate' || item.type == 'milestone') {
            	if (!(item.state.status == 'success' || item.state.status == 'failed')) return false;
            	continue;
            }
            if(item.type == 'iltsession') {
                if(!p.iltCondition) p['iltCondition'] = 'marked';  //iltCondition is new dependency introduced. This line to handle already present conditions
                if(!_iltConditionSatisfied(p.iltCondition, item)) return false;
            	continue;
            }
            if(item.type == 'rating') {
                if(!_ratingSatisfied(p, item, cm)) return false;
                continue;
            }
            var prereqScore = null;
            if (cmid in lessonReports && lessonReports[cmid].completed) {
                var lessonReport = lessonReports[cmid];
                var pastLessonReport = self.course['pastLessonReports'] ? angular.copy(self.course.pastLessonReports[cmid]) : null;
                if(lessonReport && lessonReport.completed && pastLessonReport) {
                    lessonReport = self.getMaxScoredLessonReport(lessonReport, pastLessonReport);
                }
                var scores = _getScores(lessonReport, true);
                prereqScore = scores.maxScore > 0 ? Math.round((scores.score/scores.maxScore)*100) : 100;
            } else if (cmid in statusinfo && statusinfo[cmid].status == 'done') {
                prereqScore = 100;
            }
            if (prereqScore === null) return false;
            var limitMin = p.min_score || null;
            var limitMax = p.max_score || null;
            if (limitMin && prereqScore < limitMin) return false;
            if (limitMax && prereqScore > limitMax) return false;
        }
        return true;
    }
    
    function _iltConditionSatisfied(condition, item) {
        if(condition == "marked" && !(item.state.status == 'success' || item.state.status == 'failed')) return false 
        if(condition == "attended" && item.state.status != 'success') return false 
        if(condition == "not_attended" && item.state.status != 'failed') return false 
        return true;
    }

    function _ratingSatisfied(p, item, cm) {
        var min_score = p.min_score || null;
        var max_score = p.max_score || null;
        var prereqScore = item.ratingScore || null;
        if(!prereqScore) return false;
        if(min_score && item.ratingScore < min_score) return false;
        if(max_score && item.ratingScore > max_score) return false;
        return true;
    }

    function _setDependencyArray(cm, prereqs, nlTreeListSrv, startDate) {
        cm['dependencyArray'] = [];
        if (startDate) {
            var str = nl.t('"{}" allowed to access only after {}', cm.name, nl.fmt.fmtDateDelta(startDate, new Date(), 'date'));
            cm['dependencyArray'].push(str);
        }
        for(var i=0; i<prereqs.length; i++){
            var p = prereqs[i];
            var cmid = p.module;
            var item = nlTreeListSrv.getItem(cmid);
            if(!item) continue;
            var str = '';
            if(item.type == "lesson" || item.type == 'rating') {
                if(p.min_score && !p.max_score) 
                    str = nl.t('Complete "{}" with a score of {}% or above.', item.name, p.min_score)
                else if(!p.min_score && p.max_score) 
                    str = nl.t('Complete "{}" with a score {}% or below.', item.name, p.max_score)
                else if(p.min_score && p.max_score) 
                    str = nl.t('Complete "{}" with a score between {}% and {}%.', item.name, p.min_score, p.max_score)
                else 
                    str = nl.t('Complete "{}".', item.name);
                cm.dependencyArray.push(str);
            } else if(item.type == 'iltsession') {
                if(!p.iltCondition) p['iltCondition'] = 'marked';
                if(p.iltCondition == 'marked') str = nl.t('Trainer completed the session and marked attandance for "{}".', item.name);
                if(p.iltCondition == 'attended') str = nl.t('Trainer marked you "attended" for "{}".', item.name);
                if(p.iltCondition == 'not_attended') str = nl.t('Trainer marked you "not attended" for "{}".', item.name);
                cm.dependencyArray.push(str);
            } else {
                str = nl.t('Complete "{}" element.', item.name);
                cm.dependencyArray.push(str);
            }
        }
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
                $scope.iframebgclass = 'bgclear';
                $scope.iframeModule = $scope.ext.item.id;
                $scope.updateVisiblePanes();
            });
        }
        return true;
    }

    function _redirectToLessonReport(reportInfo, newTab, cm, bUpdate, scope) {
        if (!reportInfo) return false;
        return nl.q(function(resolve, reject) {
	        var urlFmt = reportInfo.completed ?  '/lesson/view_report_assign/{}' : '/lesson/do_report_assign/{}';
        	if (!bUpdate || (reportInfo.not_after == self.course.not_after) && (reportInfo.not_before == self.course.not_before)) {
		        return _redirectTo(urlFmt, reportInfo.reportId, newTab);
        	}
	        reportInfo.not_before = self.course.not_before || '';
	        reportInfo.not_after = self.course.not_after || '';
            reportInfo.maxDuration = cm.maxDuration||0;
	    	nlDlg.showLoadingScreen();
			nlServerApi.courseUpdateLessonReportTimes(self.course.id, cm.id, reportInfo).then(function(lessonReportInfo) {
		    	nlDlg.hideLoadingScreen();
                self.course.lessonReports[cm.id] = lessonReportInfo
                scope.updateAllItemData();
                return _redirectTo(urlFmt, reportInfo.reportId, newTab);
	        });
        });
    }    
}

//-------------------------------------------------------------------------------------------------
var NlCourseViewCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCourse', 'nlIframeDlg',
'nlCourseEditor', 'nlCourseCanvas', 'nlServerApi', 'nlGroupInfo', 'nlSendAssignmentSrv',
'nlMarkup', 'nlTreeListSrv', 'nlTopbarSrv',
function(nl, nlRouter, $scope, nlDlg, nlCourse, nlIframeDlg, nlCourseEditor, nlCourseCanvas, 
    nlServerApi, nlGroupInfo, nlSendAssignmentSrv, nlMarkup, nlTreeListSrv, nlTopbarSrv) {
    var modeHandler = new ModeHandler(nl, nlCourse, nlServerApi, nlDlg, nlGroupInfo, $scope);
    var nlContainer = new NlContainer(nl, $scope, modeHandler);
    nlContainer.setContainerInWindow();
    var _userInfo = null;
    var _attendanceObj = {};
    $scope.MODES = MODES;
    var folderStats = new FolderStats($scope, modeHandler);
    $scope.ext = new ScopeExtensions(nl, modeHandler, nlContainer, nlCourseEditor, nlCourseCanvas, folderStats);
	$scope.rootStat = folderStats.get(nlTreeListSrv.getRootItem().id);
	nl.registerIFrameLoaded('course_view_frame', function() {
		$scope.iframebgclass = 'bgwhite';
	});
    function _onPageEnter(userInfo) {
        _userInfo = userInfo;
        _convertAttendanceArrayToObj(_userInfo.groupinfo.attendance);
        return nl.q(function(resolve, reject) {
            $scope.ext.setUpdateStatusFn(_updatedStatusinfo);
			nlTreeListSrv.init(nl);
            nlTreeListSrv.clear();
            $scope.params = nl.location.search();
            if (!('id' in $scope.params) || !modeHandler.initMode()) {
                nlDlg.popupStatus(nl.t('Invalid url'));
                resolve(false);
                return;
            }
            $scope.mode = modeHandler.mode;
            $scope.canSendAssignment = $scope.mode == MODES.PUBLISHED &&
                nlRouter.isPermitted(userInfo, 'assignment_send');
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

    function _convertAttendanceArrayToObj(attendanceArray) {
        for(var i=0; i<attendanceArray.length; i++) {
            var att = attendanceArray[i];
            _attendanceObj[att.id] = att;
        }
    }

    function _onPageLeave() {
        // if(modeHandler.mode == MODES.EDIT) {
        //     var msg = nl.t('Warning: There are some unsaved changes in this page. Press ok to try saving the changes. Press cancel to discard the changes and leave the page.');
        //     var ret = confirm(msg);
        //     if (!ret) return true;
        //     _updatedStatusinfoAtServer(true);
        //     return false;
        // }
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
        nlCourseCanvas.init($scope, modeHandler, nlTreeListSrv, _userInfo);
        _initAttributesDicts(course);
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
            var userRecords = [];
            _initModule(module);
            allModules.push(module);
            for(var j=0; j<userRecords.length; j++) {
                _initModule(userRecords[j]);
                allModules.push(userRecords[j]);
            }
        }
        nl.timeout(function() {
            _updateAllItemData();
            $scope.ext.setCurrentItem(nlTreeListSrv.getRootItem());
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
	    var children = nlTreeListSrv.getChildren(item);
	    for(var i=0; i<children.length; i++) {
	    	_moveItemAndChildrenPos(children[i], indices, allModules);
	    }
	}
	
	function _updateItemAndChildrenAttrs(item, allModules) {
		var parent = nlTreeListSrv.getParent(item);
        item.indentationLevel = parent ? parent.indentationLevel+1 : -1;
        item.indentationStyle = {'paddingLeft': item.indentationLevel + 'em'};
        item.location = (parent && parent.location) ? parent.location + '.' + parent.name :
            parent ? parent.name : '';
	    var children = nlTreeListSrv.getChildren(item);
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
        		return nlTreeListSrv.getParent(cm);
        	},
        	showVisible: function(cm) {
        	    $scope.showVisible(cm);
        	},
        	moveItem: function(movedItem, fromIndex, toIndex, allModules){
        		return _moveItem(movedItem, fromIndex, toIndex, allModules);
        	},
        	updateChildrenLinks: function(allModules) {
        		return nlTreeListSrv.updateChildrenLinks(allModules);
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
	$scope.toggleSummaryBox = false;
	$scope.toggleText = 'Show summary';
	if (nl.rootScope.screenSize != 'small') _openSummaryBox();
	else _closeSummaryBox();
	$scope.currentTreeState = false;
	$scope.currentStateText = 'Expand all';

	function _closeSummaryBox() {
		$scope.toggleSummaryBox = false;
		$scope.toggleText = 'Show summary';
	}
	function _openSummaryBox() {
		$scope.toggleSummaryBox = true;
		$scope.toggleText = 'Hide summary';
	}

	$scope.onToggleSummaryBox = function() {
		if($scope.toggleSummaryBox) _closeSummaryBox();
		else _openSummaryBox();
	};

	$scope.onExpandOrCollapseAll = function() {
		if($scope.currentTreeState) {
			nlTreeListSrv.collapseAll();
            _showVisible();
			$scope.currentTreeState = false;
			$scope.currentStateText = 'Expand all';
		} else {
			_expandAll();			
			$scope.currentTreeState = true;
			$scope.currentStateText = 'Collapse all';
		}
	};
	
    $scope.updateVisiblePanes = function() {
        $scope.expandedView = (nl.rootScope.screenSize != 'small');
        if (!$scope.expandedView && $scope.iframeUrl) {
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
        vp.tb = (vp.i || $scope.canvasMode || $scope.forumInfo.refid);
        nlRouter.updateBodyClass('iframeActive', vp.i);
    };
    
    nl.resizeHandler.onResize(function() {
        $scope.updateVisiblePanes();
    });

    function _popout(bPopout) {
        nlTopbarSrv.showTopbar(!bPopout);
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
        else $scope.ext.setCurrentItem(nlTreeListSrv.getRootItem());
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

    function _expandAll() {
        $scope.modules = [];
	    var allModules = nlCourseEditor.getAllModules();
        for(var i=0; i<allModules.length; i++) {
            var cm=allModules[i];
            if (cm.type == 'module') {
            	cm.isOpen = true;
            }
        	cm.visible = true;
            $scope.modules.push(cm);
        }
        $scope.updateVisiblePanes();
    }

    $scope.sendAssignment = function(e) {
        e.stopImmediatePropagation();
        e.preventDefault();
        _sendAssignment();
    };

    $scope.collapseAll = function(bShowCanvas) {
        $scope.isDetailsShown = false;
        function _impl() {
	        if($scope.ext.isEditorMode()){
		        if(!nlCourseEditor.validateInputs($scope.ext.item)) return;    	
	        }
            if(!$scope.ext.isEditorMode() && $scope.canvasMode) {
                $scope.canvasShown = bShowCanvas;
                if ($scope.canvasShown) nlCourseCanvas.update();
            }
            nlTreeListSrv.collapseAll();
            _showVisible();
            $scope.ext.setCurrentItem(nlTreeListSrv.getRootItem());
            if(!$scope.expandedView) _popout(false);
        }
        _confirmIframeClose(null, _impl);
    };
    
    function _confirmIframeClose(newItem, nextFn, dontUpdate) {
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
        // If iframe has swf object in wmode=window, it will appear on top of rest of element. It has to be hidden.
        nlDlg.popupConfirm({title: nl.t('Please confirm'), 
            template: nl.t('Do you want to navigate away from current module?')})
            .then(function(res) {
                if (!res) return;
                $scope.iframeUrl = null;
                $scope.iframeModule = null;
                if(!dontUpdate) $scope.updateVisiblePanes();
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
            $scope.ext.updateLastSubmittedItem($scope.ext.item);
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
                nlTreeListSrv.toggleItem(cm);
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

	$scope.isDetailsShown = false;
	$scope.pastSelectedItem = null;
	$scope.onRowClick = function(e, cm) {
		_checkDateTimeRange();
		if(cm.type == "certificate") return;
		if(cm.type == "module") {
			$scope.pastSelectedItem = cm;
			$scope.onClick(e, cm);
		} else {
			 if ($scope.vp.i) {
				$scope.pastSelectedItem = cm;
				$scope.onIconClick(e, cm);				
			} else if($scope.pastSelectedItem && $scope.pastSelectedItem.id == cm.id) {
				$scope.isDetailsShown = !$scope.isDetailsShown;
				$scope.pastSelectedItem = cm;
	            $scope.ext.setCurrentItem(cm);
			} else {
				$scope.pastSelectedItem = cm;
				$scope.isDetailsShown = true;
	            $scope.ext.setCurrentItem(cm);
			}
		}
	};

	$scope.getFormatedDesc = function(descType) {
		if (descType == 'average') {
			return nl.t('(from {} {})', $scope.rootStat.nQuiz, $scope.rootStat.nQuiz == 1 ? 'quiz' : 'quizzes');
		}
	};
	
	$scope.getCompletionStatus = function() {
		var rootStat = $scope.rootStat;
		if (rootStat.completedItems == 0) return 0;
        var nLessonsDone = rootStat.scoreCount;
        var weightedProgressMax = rootStat.totalLessons*10 + ((rootStat.total-rootStat.nCert)-rootStat.totalLessons);
        var weightedProgress = rootStat.scoreCount*10 + ((rootStat.completedItems-rootStat.completedCert)-rootStat.scoreCount);
        var perc = weightedProgressMax ? Math.round(weightedProgress/weightedProgressMax*100) : 100;
		return perc;
	};
	
	$scope.getLaunchButtonState = function(cm) {
        if (!cm) return '';
        if ($scope.ext.isStaticMode()) return 'dark';
        if (cm.state.status == 'waiting') return 'light';
        if (cm.type =='certificate') return 'dark';
        if (cm.type =='link' && cm.state.status == 'pending') return 'dark';
        if (modeHandler.mode == MODES.DO && cm.state.status == 'started') return 'dark';
        if (cm.state.status == 'success' || cm.state.status == 'failed') return 'light';
        return 'dark';
	};

    $scope.onLaunch = function(e, cm) {
        e.stopImmediatePropagation();
        e.preventDefault();
        _checkDateTimeRange();
        $scope.ext.setCurrentItem(cm);
        if(cm.state.status == 'waiting') {
            var dependencyArray = cm.dependencyArray || [];
            if(cm.type == 'module') cm.dependencyArray = ['All items inside the folder are locked.'];
            var str = '<div class="padding-mid" style="font-size:120%; font-weight:bold">This element is currently locked. It will be unlocked after following condition(s) are met</div>';
                str += '<div class="padding-mid"><ul>';
            for(var i=0; i<cm.dependencyArray.length; i++) str += nl.t('<li style="line-height:24px">{}</li>', cm.dependencyArray[i]);
            str += '</ul></div>'
            return nlDlg.popupAlert({title: cm.name, template: str});
        }
        var dontUpdate = true;
        _confirmIframeClose(cm, function() {
            if(nl.rootScope.screenSize == 'small') _popout(true);
            _onLaunchImpl(cm);
        }, dontUpdate);
    };
    
    $scope.onClickOnAttended = function(cm) {
    	if(!(cm.id in modeHandler.course.statusinfo))
    		modeHandler.course.statusinfo[cm.id] = {};
    	modeHandler.course.statusinfo[cm.id]['isAttendanceMarked'] = true;
    	_updatedStatusinfoAtServer(true);
    };
    
    function _onLaunchImpl(cm) {
        if (cm.type === 'lesson') modeHandler.handleLessonLink(cm, false, $scope);
        else if(cm.type === 'link' || cm.type === 'certificate') modeHandler.handleLink(cm, false, $scope);
    }

    $scope.onReattempt = function(e, cm) {
    	_checkDateTimeRange();
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
    
    function _checkDateTimeRange() {
    	if (modeHandler.mode != MODES.DO) return;
    	return; // TODO - might need to reconsider such a check later
    	var course = modeHandler.course;
		var currentDate = new Date();
	    var starttime = course['not_before'] && course['not_before'] != '' ? nl.fmt.json2Date(course.not_before) : '';
	    var endtime = course['not_after'] && course['not_after'] != '' ? nl.fmt.json2Date(course.not_after) : '';
	    if (endtime && (currentDate > endtime) && !course.submissionAfterEndtime){
	        nlDlg.popupAlert({title: 'Alert text', template: 'Current time is greater than end time and mentioned for this course.'}).then(function(res) {
				if(res) nl.window.location.href = '#/course_report_list';
			});
	    }
    }

    var _CM_STATES = {
        hidden:  {title: 'Hidden'}, // TODO-LATER - not handled yet!
        none:    {icon: 'ion-information-circled fblue', title: ''},
        waiting: {icon: 'ion-locked fgrey', title: 'Locked'},
        delayed: {icon: 'ion-alert-circled forange', title: 'Delayed'},
        pending: {icon: 'ion-ios-circle-filled fyellow', title: 'Pending'},
        started: {icon: 'ion-ios-circle-filled fgreen', title: 'Started'},
        failed:  {icon: 'icon ion-close-circled forange', title: 'Failed'},
        success: {icon: 'ion-checkmark-circled fgreen', title: 'Done'},
        partial_success: {icon: 'ion-checkmark-circled fyellow', title: 'Partially Done'} // Only folder status
    };

    function _updateState(cm, state) {
        // statusIcon, statusText, statusShortText
        cm.state = angular.copy(_CM_STATES[state] || _CM_STATES.hidden);
        cm.state.status = state;
    }
    
    function _initModule(cm) {
        nlTreeListSrv.addItem(cm);
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
        var reopener = new Reopener(modeHandler, nlTreeListSrv, _userInfo, nl, nlDlg, 
            nlServerApi, _updatedStatusinfoAtServer);
        reopener.reopenIfNeeded().then(function() {
            _updateItemData(nlTreeListSrv.getRootItem(), today);
			$scope.rootStat = folderStats.get(nlTreeListSrv.getRootItem().id);
        });
    }

    function _updateItemData(cm, today) {
        if (cm.type === 'module') {
            _updateModuleData(cm, today);
        } else if (cm.type === 'info' || cm.type === 'link' || cm.type === 'certificate') {
            _updateLinkData(cm, today);
        } else if (cm.type === 'iltsession') {
			_updateILTData(cm, today);
        } else if (cm.type === 'milestone') {
			_updateMilestoneData(cm, today);
        } else if (cm.type === 'rating') {
			_updateRatingData(cm, today);
        } else {
            _updateLessonData(cm, today);
        }
    }

    function _updateModuleData(cm, today) {
        var folderStat = folderStats.get(cm.id);
        var children = nlTreeListSrv.getChildren(cm);
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
        cm.completedItems = folderStat.completedItems;
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
        if (!modeHandler.canStart(cm, $scope, nlTreeListSrv)) status = 'waiting';
        else if (cm.type == 'certificate') status = 'success';
        _updateState(cm, status);
    }
    
    function _updateILTData(cm, today) {
        var status = 'pending';
		if(cm.type == 'iltsession') {
			var attendance = 'attendance' in modeHandler.course.content ? modeHandler.course.content.attendance || {} : {}; 
                attendance = nlCourse.migrateCourseAttendance(attendance);
            var attended = attendance[modeHandler.courseId] || [];
            var modifiedILT = 'modifiedILT' in modeHandler.course ? modeHandler.course.modifiedILT : {};
			for(var i=0; i<attended.length; i++) {
                var attend = angular.copy(attended[i]);
                if(cm.id != attend.id) continue;
                cm.remarks = attend.remarks;
                var attend = (attend.attId in _attendanceObj) ? _attendanceObj[attend.attId] : {};
                if(attend.id) {
                    if(attend.timePerc == 100) 
                        status = 'success';
                    else if(attend.timePerc < 100 && attend.timePerc > 0 ) 
                        status = 'partial_success';
                    else 
                        status = 'failed';
                    var time = cm.id in modifiedILT ? modifiedILT[cm.id] : cm.iltduration;
                    cm.timeMins = attend.timePerc ? (attend.timePerc/100)*time : '-';
                }
			}
		}
        if (!(status == 'success' || status == 'failed') && !modeHandler.canStart(cm, $scope, nlTreeListSrv)) status = 'waiting';
        _updateState(cm, status);
    }
 
    function _updateRatingData(cm, today) {
        var status = 'pending';
        var rating = 'rating' in modeHandler.course.content ? modeHandler.course.content.rating || {} : {}; 
        var ratedReport = rating[modeHandler.courseId] || [];
        var israted = false;
        for(var i=0; i<ratedReport.length; i++) {
            var rated = angular.copy(ratedReport[i]);
            if(cm.id != rated.id) continue;
            israted = true;
            cm.ratingScore = rated.attId;
            cm.remarks = rated.remarks || '';
        }
        if (!modeHandler.canStart(cm, $scope, nlTreeListSrv)) {
            status = 'waiting';
        } else if(israted) {
            status = _setStatusOfRatingItem(status, cm);
        }
        _updateState(cm, status);
    }

    function _setStatusOfRatingItem(status, cm) {
        var ratings = _userInfo.groupinfo.ratings || [];
        var selectedRating = null;
        for(var i=0; i<ratings.length; i++) {
            if(ratings[i].id == cm.rating_type) {
                selectedRating = ratings[i];
                break;
            }
        }

        if(selectedRating.type == 'number') {
            cm.ratingStr = cm.ratingScore+'%';
        } else {
            for(var i=0; i<selectedRating.values.length; i++) {
                var item = selectedRating.values[i];
                if(cm.ratingScore === item.p) cm.ratingStr = item.v            }
        }

        if(cm.ratingScore <= selectedRating.lowPassScore)
            return 'failed';
        else if(selectedRating.lowPassScore < cm.ratingScore && cm.ratingScore < selectedRating.passScore)
            return 'partial_success';
        else 
            return'success';
    }

    function _updateMilestoneData(cm, today) {
        var status = 'pending';
        var milestone = 'milestone' in modeHandler.course.content ? modeHandler.course.content.milestone || {} : {}; 
        if((cm.id in milestone) && milestone[cm.id].status == 'done') {
            status = 'success';
        }
        if (!(status == 'success') && !modeHandler.canStart(cm, $scope, nlTreeListSrv)) status = 'waiting';
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
        var pastLessonReport = modeHandler.course['pastLessonReports'] ? angular.copy(modeHandler.course.pastLessonReports[cm.id]) : null;
        var maxScoredLessonReport = lessonReport;
        if (lessonReport && pastLessonReport) {
            maxScoredLessonReport = modeHandler.getMaxScoredLessonReport(lessonReport, pastLessonReport);
        }
        if (lessonReport.completed) {
            lessonReport = maxScoredLessonReport;
        }
        if ('started' in lessonReport) {
            cm.started = nl.fmt.json2Date(lessonReport.started);
            if (cm.attempt == 0) cm.attempt = 1;
        }
        
        if ('ended' in lessonReport) cm.ended = nl.fmt.json2Date(lessonReport.ended);
        if (maxScoredLessonReport && ('timeSpentSeconds' in maxScoredLessonReport)) {
            cm.time = parseInt(maxScoredLessonReport.timeSpentSeconds);
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
        if (!modeHandler.canStart(cm, $scope, nlTreeListSrv)) status = 'waiting';
        _updateState(cm, status);
    }
    
    function _updatedStatusinfo(cm, status, remarks, dontHide) {
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
        _saveAttemptNumber++;
        _updatedStatusinfoAtServerImpl(bBlockUI, _saveAttemptNumber);
    }

    function _updatedStatusinfoAtServerImpl(bBlockUI, currentSaveNumber) {
        if (bBlockUI) nlDlg.showLoadingScreen();
        var repid = parseInt($scope.params.id);
        nlServerApi.courseReportUpdateStatus(repid, JSON.stringify(modeHandler.course.statusinfo))
        .then(function(courseReport) {
            if (currentSaveNumber > _saveDoneNumber)
                _saveDoneNumber = currentSaveNumber;
            if (bBlockUI) nlDlg.hideLoadingScreen();
        });
    }
    
    function _sendAssignment() {
        if (!$scope.canSendAssignment) return;
        var c = modeHandler.course;
        var assignInfo = {assigntype: 'course', id: c.id, icon: c.icon, 
            title: c.name, authorName: c.authorname, description: c.description, 
            showDateField: true, enableSubmissionAfterEndtime: false, blended: c.content.blended, course: c};
        nlSendAssignmentSrv.show($scope, assignInfo, _userInfo);
    }
}];

//-------------------------------------------------------------------------------------------------
function FolderStats($scope, modeHandler) {

    var _folderStats = {};
    this.clear = function() {
        _folderStats = {};
    };
    
    this.get = function(cmid) {
        if (cmid in _folderStats) return _folderStats[cmid];
        var folderStat = {success: 0, failed: 0, 
            started: 0, pending: 0, delayed: 0, waiting: 0,
            scoreCount: 0, score: 0, maxScore: 0, perc: 0,
            timeCount: 0, time: 0, totalLessons: 0,
            completedItems: 0, nQuiz:0, folderCount: 0, nCert: 0, completedCert: 0};
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
        folderStat.totalLessons += childStat.totalLessons;
        folderStat.score += childStat.score;
        folderStat.maxScore += childStat.maxScore;
        folderStat.timeCount += childStat.timeCount;
        folderStat.time += childStat.time;
        folderStat.nQuiz += childStat.nQuiz;
        folderStat.nCert += childStat.nCert;
        folderStat.completedCert += childStat.completedCert;
        folderStat.folderCount += cm.type == "module" ? 1 : 0;
    };

    this.updateForLeaf = function(folderStat, cm) {
        if (cm.state.status == 'waiting') folderStat.waiting += 1;
        else if (cm.state.status == 'delayed') folderStat.delayed += 1;
        else if (cm.state.status == 'pending') folderStat.pending += 1;
        else if (cm.state.status == 'started') folderStat.started += 1;
        else if (cm.state.status == 'failed') folderStat.failed += 1;
        else if (cm.state.status == 'success') folderStat.success += 1;

		if (cm.type == 'lesson') {
			folderStat.totalLessons += 1; 
		}
		if (cm.maxScore && (cm.state.status == 'success' || cm.state.status == 'failed')) {
			folderStat.nQuiz += 1;
		}
		if (cm.type == 'certificate') {
			folderStat.nCert += 1;
			if(cm.state.status == 'success') {
				folderStat.completedCert += 1;			
			}
		}
        if (cm.score !== null && cm.type != 'iltsession' && cm.type != 'milestone' && cm.type != 'rating') {
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
        folderStat.completedItems = folderStat.success+ folderStat.failed;
        _updateChartInfo(folderStat);
    };

    var _chartLabels = ['Done', 'Failed', 'Pending', 'Delayed'];
    var _chartColours = [_nl.colorsCodes.done, _nl.colorsCodes.failed, _nl.colorsCodes.pending, _nl.colorsCodes.delayed];
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
    var self = this;
    this.item = null;
    this.stats = null;
    this.pastAttemptData = [];
    this.currentAttemptStatus = 'pending';
    this.data = {remarks: ''}; 
    this.lastSubmittedRecord = {};
    this.updateLastSubmittedItem = function(cm) {
        this.lastSubmittedRecord = cm;
    };

    this.setCurrentItem = function(cm) {
        this.item = cm;
		if (this.isEditorMode()) nlCourseEditor.initSelectedItem(this.item);
        this.stats = (cm.type == 'module') ? folderStats.get(cm.id) : null;
        var statusinfo = modeHandler.course.statusinfo;
        this.data.remarks = (statusinfo && cm.id in statusinfo) ? statusinfo[cm.id].remarks || '' : cm.remarks || '';
        this.updatePastAttemptData();
        nlContainer.onSave(function(lessonReportInfo) {
            modeHandler.course.lessonReports[cm.id] = lessonReportInfo;
	        if (!('ended' in lessonReportInfo) && lessonReportInfo.completed) lessonReportInfo.ended = new Date();
	        self.updatePastAttemptData();
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
        return (this.item.type == 'link' || this.item.type == 'info' || this.item.type == 'certificate' 
                || this.item.type == 'iltsession' || this.item.type == 'rating');
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
        if (modeHandler.mode == MODES.DO) return true; //return (this.item.state.status != 'waiting');
        return (this.item.state.status == 'success' || this.item.state.status == 'failed');
    };

    this.canHighlightReviewButton = function(cm) {
        if(cm.type != 'lesson' || (cm.id != this.lastSubmittedRecord.id)) return false;
        if((cm.state.status == 'success' || cm.state.status == 'failed') && cm.maxScore)
            return true;
        return false;
    }

    this.getLaunchString = function(cm) {
        if (!cm) {
	        if (!this.item) return '';
	        return 'Open';
        }
        if (cm.state.status == 'waiting') return 'Know more';
        if (this.isStaticMode() || cm.type =='link' || cm.type =='certificate') return 'View';
        if (modeHandler.mode == MODES.DO && cm.state.status == 'started') return 'Continue';
        if (cm.state.status == 'success' || cm.state.status == 'failed') return 'Review';
        return 'Start';
    };

	this.canShowLaunch = function(cm) {
        if (cm && cm.state.status == "waiting") return true;
        if (!cm || (cm.type != 'lesson' && cm.type != 'link' && cm.type != 'certificate')) return false;
        if (this.isStaticMode()) return true;
        if (this.hideReviewButton(cm)) return false;
        if (modeHandler.mode == MODES.DO) return true;
        return (cm.state.status == 'success' || cm.state.status == 'failed');
	};
	
	this.hideReviewButton = function(cm) {
        if (!cm) return true;
        if (this.canShowTryAgain(cm)) return true;
        if (!modeHandler.course.content.hide_answers || modeHandler.mode != MODES.DO) return false;
        return (cm.type == 'lesson' && (cm.state.status == 'success' || cm.state.status == 'failed'));
	};

	this.canShowTryAgain = function(cm) {
        if (!cm || cm.type != 'lesson' || modeHandler.mode != MODES.DO) return false;
        if (cm.state.status  == 'success') return false;
        return ((cm.state.status  == 'failed') && (cm.maxAttempts == 0 || cm.attempt < cm.maxAttempts));
    }

    this.getRoundedPercentage = function(completed, total, rep) {
        if(rep && rep.selfLearningMode) return '-';
		if(completed == 0 ) return 0;
		return Math.round(completed/total*100)+'%';
	};
    
    this.isLessonInProgress = function(cm) {
        if(cm.state.status == 'started' && modeHandler.mode == MODES.DO) return true;
        return false;
    };

    this.updatePastAttemptData = function() {
        this.showPastAttempts = false;
        this.pastAttemptData = [];
        this.currentAttemptStatus = 'pending';
        if (!this.item || this.item.type != 'lesson') return;
        if (!modeHandler.course.lessonReports) return;
        if (!modeHandler.course.pastLessonReports && 
        	!(this.item.id in modeHandler.course.lessonReports)) return;
        var pastLessonReport = modeHandler.course.pastLessonReports ? modeHandler.course.pastLessonReports[this.item.id] || [] : [];
        var timeSpent = 0;
        for(var i in pastLessonReport) {
            var rep = pastLessonReport[i];
            if (!rep.completed || !rep.reportId) continue;
            if (rep.started) rep.started = nl.fmt.json2Date(rep.started);
            if (rep.ended) rep.ended = nl.fmt.json2Date(rep.ended);
            timeSpent += rep.timeSpentSeconds;

            this.pastAttemptData.push(rep);
        }
        var rep = modeHandler.course.lessonReports[this.item.id];
        if (!rep) return;
        if(rep.timeSpentSeconds) timeSpent += rep.timeSpentSeconds;
        this.item.time = parseInt(timeSpent);
        this.item.timeMins = Math.round(timeSpent/60);

        if(rep.completed) {
            this.currentAttemptStatus = 'completed';
            if (rep.started) rep.started = nl.fmt.json2Date(rep.started);
            if (rep.ended) rep.ended = nl.fmt.json2Date(rep.ended);
	        this.pastAttemptData.push(rep);
		} else if(rep.started){
            this.currentAttemptStatus = 'started';
        } else {
            this.currentAttemptStatus = 'completed';
        }
    };
    
    this.showPastReport = function(rep) {
        if (this.hideReviewButton(this.item) || this.isLessonInProgress(this.item)) return;
        var func = (modeHandler.mode === MODES.REPORT_VIEW) ? 'review_report_assign' : 'view_report_assign';
        var url = nl.fmt2('/lesson/{}/{}', func, rep.reportId);
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
        'iltsession': 'ion-map fblue',
        'milestone': 'ion-arrow-graph-up-right fblue',
        'lesson': 'ion-document-text fblue',
        'quiz': 'ion-help-circled fblue',
        'info': 'ion-information-circled fblue',
        'certificate': 'ion-android-star fblue',
        'link': 'ion-document fblue',
        'user': 'ion-person forange2'
    };
}

//-------------------------------------------------------------------------------------------------
// TreeList class changed to treeList Service
//-------------------------------------------------------------------------------------------------
var TreeListSrv = ['nl', function(nl) {
	var ID_ATTR = 'id';
	var DELIM = '.';
	var VISIBLE_ON_OPEN = 1;
    var rootItem = {type: 'module', name: 'Summary', id: '_root'};

	this.init = function(nl, ID_ATTR, DELIM, VISIBLE_ON_OPEN) {
	    if (ID_ATTR === undefined) ID_ATTR = 'id';
	    if (DELIM === undefined) DELIM = '.';
	    if (VISIBLE_ON_OPEN === undefined) VISIBLE_ON_OPEN = 1; // Only top level visible by default
	};

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
}];

//-------------------------------------------------------------------------------------------------
function Reopener(modeHandler, nlTreeListSrv, _userInfo, nl, nlDlg, nlServerApi, _updatedStatusinfoAtServer) {

    this.reopenIfNeeded = function() {
        return nl.q(function(resolve, reject) {
            if (modeHandler.mode != MODES.DO) {
                resolve(true);
                return;
            }

            var changeInfo = {updated: false, reopenList:[], failList:[], reopenDict:{}};
            _init();
            _reopenItem(nlTreeListSrv.getRootItem(), changeInfo);
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
            var children = nlTreeListSrv.getChildren(cm);
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
            var depModule = nlTreeListSrv.getItem(cm.reopen_on_fail[i]);
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
        nlServerApi.courseCreateLessonReport(modeHandler.course.id, cm.refid, cm.id, cm.attempt+1, cm.maxDuration||0, modeHandler.course.not_before||'', modeHandler.course.not_after||'', false)
        .then(function(updatedCourseReport) {
            cm.attempt++;
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
    
    this.getMode = function() {
    	return modeHandler.getModeName();
    };
    
    this.save = function(reportId, lesson, bDone) {
        if (modeHandler.mode != MODES.DO) return;
        var completed = lesson.completed || bDone;
        var lessonReportInfo = {reportId: reportId, completed: completed, 
                            score: lesson.score, maxScore: lesson.maxScore};
        lessonReportInfo.attempt = lesson.attempt || 1;
        if (lesson.started)  lessonReportInfo.started = lesson.started;
        if (lesson.ended) lessonReportInfo.ended = lesson.ended;
        if (lesson.not_after)  lessonReportInfo.not_after = lesson.not_after || '';
        if (lesson.not_before) lessonReportInfo.not_before = lesson.not_before || '';
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
function CourseDoReviewDirective(template, scope) {
    if (scope === undefined) scope = true;
    return _nl.elemDirective('view_controllers/course/view_active/' + template 
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
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

//-------------------------------------------------------------------------------------------------
var _statusInfo = {};
var _userInfo = null;

//-------------------------------------------------------------------------------------------------
var MODES = {PRIVATE: 0, PUBLISHED: 1, REPORT_VIEW: 2, DO: 3, EDIT: 4};
var MODE_NAMES = {'private': 0, 'published': 1, 'report_view': 2, 'do': 3, 'edit': 4};

function ModeHandler(nl, nlCourse, nlServerApi, nlDlg, nlGroupInfo, $scope, nlReportHelper, nlMobileConnector) {
    var self=this;
    this.mode = MODES.PRIVATE;
    this.urlModeStr = '';
    this.courseId = null;
    this.course = null;
    this.debug = false;
    this.userInfo = null;
    this.restoreid = null;
    this.initMode = function(userInfo) {
        this.userInfo = userInfo;
        var params = nl.location.search();
        if ('debug' in params) this.debug = true;
        this.urlModeStr = params.mode;
        var modeStr = this.urlModeStr;
        if (modeStr == 'report_view_my') modeStr = 'report_view';
        if (!modeStr || !(modeStr in MODE_NAMES)) return false;
        this.mode = MODE_NAMES[modeStr];
        if (!('id' in params)) return false;
        this.courseId = parseInt(params.id);
        if ('restoreid' in params) this.restoreid = parseInt(params.restoreid);
        return true;
    };
    
    this.getModeName = function() {
    	for(var modeName in MODE_NAMES)
    		if (MODE_NAMES[modeName] == this.mode) return modeName;
    	return 'private';
    };

    this.initTitle = function(course) {
        this.course = course;
        if(!course.content.languages) course.content.languages = [{lang: 'en', name: 'English'}];
        if(!course.content.languageInfo) course.content.languageInfo = {};
        nl.pginfo.pageTitle = course.name;
        if (course.content.targetLang && course.content.targetLang != 'en' ) {
            nl.pginfo.pageTitle = course.content.languageInfo[course.content.targetLang].name || course.name;
        }

        
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
            return nlServerApi.courseGet(this.courseId, this.mode === MODES.PUBLISHED, this.restoreid);
        }

        if (this.mode === MODES.REPORT_VIEW && this.urlModeStr != 'report_view_my') {
            return nlGroupInfo.init1().then(function() {
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
    
    this.handleILTLink = function(cm, newTab, scope, _updatedStatusinfoAtServer) {
        var msg = '<h4>Would you like to join the online meeting?</h4>';
        if (cm.notes) msg = msg + '<p>Meeting Login notes: </p>' + 
            nl.t('<p><b>{}</b>.</p>', cm.notes);
        nlDlg.popupConfirm({title: nl.t('Join meeting'), template: msg, okText: nl.t('Join')}).then(function(res) {
            if (!res) return;
            var iltStatus = self.course.statusinfo && cm.id in self.course.statusinfo ? self.course.statusinfo[cm.id] : {};
            var canJoin = self.canJoinMeeting(cm);
            if (!canJoin) {
                nlDlg.popupAlert({title: 'Session expired', template: 'Session has expired you cannot join the session now'});
                return;
            }
            if (!iltStatus.joinTime) {
                self.course.statusinfo[cm.id] = {joinTime: nl.fmt.date2UtcStr(new Date(), 'second')};
                _updatedStatusinfoAtServer(false);
            }
            nlMobileConnector.launchLinkInNewTab(cm.url);
        });
    };

    this.canJoinMeeting = function(cm) {
        if (!cm.start) return true;
        var currentTime = new Date();
        var startTime = angular.copy(cm.start);
            startTime = new Date(startTime);
        var actualMeetingStart = new Date (startTime.getTime() - (30*60000));
        var actualMeetingEnd = new Date(startTime.getTime()+((cm.duration+30)*60000));
        if (currentTime > actualMeetingStart && currentTime < actualMeetingEnd) return true;
        return false;
    }

    this.handleLessonLink = function(cm, newTab, scope) {
        var self = this;
        if (!('refid' in cm)) return _popupAlert('Error', 'Link to the learning module is not specified');
        var refid = cm.refid;
        if (this.mode === MODES.PRIVATE || this.mode === MODES.EDIT || this.mode === MODES.PUBLISHED) {
            var targetLang = $scope.editor.targetLang;
            var languageInfo = $scope.editor.course.content.languageInfo[targetLang] || {};
            if (targetLang != 'en' && languageInfo[cm.id] && languageInfo[cm.id].refid) refid = languageInfo[cm.id].refid;
            var urlFmt = '/lesson/view/{}';
            return _redirectTo(urlFmt, refid, newTab);
        } else {
            var targetLang = $scope.courseContent.targetLang || 'en';
            var languageInfo = $scope.courseContent.languageInfo[targetLang] || {};
            if (targetLang != 'en' && languageInfo[cm.id] && languageInfo[cm.id].refid) refid = languageInfo[cm.id].refid;
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
        var targetLang = $scope.courseContent.targetLang || 'en'; 
        nlServerApi.courseCreateLessonReport(self.course.id, refid, cm.id, cm.attempt+1, cm.maxDuration||0, self.course.not_before||'', self.course.not_after||'', true, targetLang)
        .then(function(ret) {
            nlDlg.hideLoadingScreen();
            cm.attempt++;
            self.course.lessonReports = ret.lessonReports;
            self.course.pastLessonReports = ret.pastLessonReports;
            scope.updateAllItemData();
            reportInfo = self.course.lessonReports[cm.id];
            _redirectToLessonReport(reportInfo, newTab, cm, false, scope);
        });
        return true;
    };

    this.shallShowScore = function() {
        return (this.mode === MODES.REPORT_VIEW || this.mode === MODES.DO);
    };

    this.show = function(url, newTab) {
        _redirectTo('{}', url, newTab);
    };

    this.setDependencyArray = function(cm, prereqs, nlTreeListSrv) {
        cm.dependencyArray = cm.dependencyArrayFromRepHelper || [];
        for(var i=0; i<prereqs.length; i++){
            var p = prereqs[i];
            var cmid = p.module;
            var item = nlTreeListSrv.getItem(cmid);
            if(!item) continue;
            var str = '';
            if(item.type == "lesson" || item.type == 'rating' || item.type == 'gate') {
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
    };

    this.updateStatusInfo = function() {
        var isLearnerView = self.mode == MODES.DO || self.urlModeStr == 'report_view_my';
        var repHelper = nlReportHelper.getCourseStatusHelperForCourseView(self.course, _userInfo.groupinfo, isLearnerView);
        _statusInfo = repHelper.getCourseStatus();
    };

    this.isCourseCompleted = function() {
        return nlReportHelper.isCourseCompleted(_statusInfo);
    };

    // Private functions
    function _lessonReview(rep, cm, newTab, bUpdate, scope) {
        if (self.mode === MODES.REPORT_VIEW) {
            if (!rep || !rep.completed) return _popupAlert('Not completed', 
                'This learning module is not yet completed. You may view the report once it is completed.');
            var func = self.urlModeStr != 'report_view_my' ? 'review_report_assign' : 'view_report_assign';
            return _redirectTo('/lesson/' + func + '/{}', rep.reportId, newTab);
        }
        if (_redirectToLessonReport(rep, newTab, cm, bUpdate, scope)) return true;
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
	        var urlFmt = reportInfo.completed ?  '/lesson/view_report_assign/{}' : '/lesson/do_report_assign/{}'+nl.t('?moduleid={}', cm.id);
        	if (!bUpdate || (reportInfo.not_after == self.course.not_after) && (reportInfo.not_before == self.course.not_before)) {
		        return _redirectTo(urlFmt, reportInfo.reportId, newTab);
        	}
	        reportInfo.not_before = self.course.not_before || '';
	        reportInfo.not_after = self.course.not_after || '';
            reportInfo.maxDuration = cm.maxDuration||0;
	    	nlDlg.showLoadingScreen();
			nlServerApi.courseUpdateLessonReportTimes(self.course.id, cm.id, reportInfo, self.course.completed).then(function(lessonReportInfo) {
		    	nlDlg.hideLoadingScreen();
                self.course.lessonReports[cm.id] = lessonReportInfo;
                scope.updateAllItemData();
                return _redirectTo(urlFmt, reportInfo.reportId, newTab);
	        });
        });
    }    
}

//-------------------------------------------------------------------------------------------------
var NlCourseViewCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCourse', 'nlIframeDlg',
'nlCourseEditor', 'nlCourseCanvas', 'nlServerApi', 'nlGroupInfo', 'nlSendAssignmentSrv',
'nlMarkup', 'nlTreeListSrv', 'nlTopbarSrv', 'nlReportHelper', 'nlMobileConnector',
function(nl, nlRouter, $scope, nlDlg, nlCourse, nlIframeDlg, nlCourseEditor, nlCourseCanvas, 
    nlServerApi, nlGroupInfo, nlSendAssignmentSrv, nlMarkup, nlTreeListSrv, nlTopbarSrv, nlReportHelper, nlMobileConnector) {
    var modeHandler = new ModeHandler(nl, nlCourse, nlServerApi, nlDlg, nlGroupInfo, $scope, nlReportHelper, nlMobileConnector);
    var nlContainer = new NlContainer(nl, nlDlg, nlServerApi, $scope, modeHandler);
    nlContainer.setContainerInWindow();
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
            nlTreeListSrv.clear();
            $scope.params = nl.location.search();
            if (!('id' in $scope.params) || !modeHandler.initMode(userInfo)) {
                nlDlg.popupStatus(nl.t('Invalid url'));
                resolve(false);
                return;
            }
            $scope.mode = modeHandler.mode;
            $scope.canShowLangSection = false;
            $scope.canSendAssignment = $scope.mode == MODES.PUBLISHED &&
                nlRouter.isPermitted(userInfo, 'assignment_send');
            $scope.showStatusIcon = modeHandler.shallShowScore();
            var courseId = parseInt($scope.params.id);
            modeHandler.getCourse().then(function(course) {
                var possiblePromise = _onCourseRead(course);
                if (possiblePromise) {
                    // Will be the flow in course editor/published mode where
                    // editor service does nlGroupInfo.init1
                    possiblePromise.then(function() {
                        resolve(true);
                    }, function() {
                        resolve(false);
                    });
                } else resolve(true);
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
        var possiblePromise = _initAttributesDicts(course);
        $scope.courseContent = course.content;
        $scope.canShowSaveAndPublish = modeHandler.restoreid ? false : true;
        $scope.planning = course.content.planning;
        if (modeHandler.mode == MODES.DO && $scope.courseContent.languages.length > 1) {
            if (!$scope.courseContent.targetLang) {
                // First time
                _showDefaultLangSelectionDlg();
            } else {
                for (var i=0; i<$scope.courseContent.languages.length; i++) {
                    var language = $scope.courseContent.languages[i];
                    if (language.lang == $scope.courseContent.targetLang)
                        $scope.targetLangName = language.name;
                }
            }
        } 
        if ('forumRefid' in course) {
            $scope.forumInfo = {refid: course.forumRefid, secid: course.id};
        } else {
            $scope.forumInfo = {refid: 0};
        }
        var modules = angular.copy(course.content.modules);
        var allModules = nlCourseEditor.getAllModules(true);
        if (modeHandler.mode == MODES.DO || modeHandler.mode == MODES.REPORT_VIEW) {
            var courseAssignment = modeHandler.course;
            var _attendance = courseAssignment.content.attendance ? angular.fromJson(courseAssignment.content.attendance) : {};
                _attendance = nlCourse.migrateCourseAttendance(_attendance);
                modules = nlReportHelper.getAsdUpdatedModules(modules || [], _attendance);
        }
        for(var i=0; i<modules.length; i++) {
            var module = angular.copy(modules[i]);
            var userRecords = [];
            _initModule(module);
            if (module.type == 'lesson' && modeHandler.mode == MODES.EDIT)
                module.type = module.isQuiz ? 'lesson-assesment': 'lesson-self';
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
        return possiblePromise;
    }

    function _canChangeLanguage() {
        var modules = $scope.modules;
        for(var i=0; i<modules.length; i++) {
            var cm = modules[i];
            if (cm.type != 'lesson') continue;
            if (cm.state.status == 'started') 
                return {error: 'You can change the language only after completing the modules you have already started. You may press the “try again” button on a module to view it in the newly selected language', name: cm.name};
        }
        return {state: true};
    }
    
    function _showDefaultLangSelectionDlg() {
        var _dlg = nlDlg.create($scope);
        _dlg.scope.data = {languages: $scope.courseContent.languages};
        _dlg.scope.onLangSelected = function(selected) {
            nlDlg.closeAll();
            _updateReportLanguage(selected);
        }
        var selectButton = {text: nl.t('Select'), onTap: function(e){
            e.preventDefault()
            _dlg.scope.error = 'Please select language from below list'
            return;
        }};
        _dlg.show('view_controllers/course/view/course_default_language_selection.html', [selectButton], null);
    }

    function _updateReportLanguage(selected) {
        nlDlg.showLoadingScreen();
        nlServerApi.courseUpdateReportLanguage(modeHandler.course.id, selected.lang).then(function(result) {
            nlDlg.hideLoadingScreen();
            $scope.courseContent.targetLang = selected.lang;
            $scope.targetLangName = selected.name;
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
        if (!$scope.ext.isStaticMode()) return null;
        $scope.editorCb = {
        	initModule: function(cm) {
                _initModule(cm);
        	},
        	getParent: function(cm) {
        		return nlTreeListSrv.getParent(cm);
            },
            getRootItem: function() {
                return nlTreeListSrv.getRootItem();
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
            },
            onClick: function(e, cm) {
        	    $scope.onClick(e, cm);
        	},
            onIconClick: function(e, cm) {
        	    $scope.onIconClick(e, cm);
            }
        };
        return nlCourseEditor.init($scope, modeHandler, _userInfo, MODES);
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
    $scope.computedData = {};
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

    $scope.onLanguageChange = function(selected) {
        var lang = selected.lang;
        if(lang != 'en' && $scope.courseContent.languageInfo[lang].name) 
            nl.pginfo.pageTitle = $scope.courseContent.languageInfo[lang].name || $scope.courseContent.name;
        if (modeHandler.mode != MODES.DO) return;
        var ret = _canChangeLanguage();
        if (ret.error) {
            return nlDlg.popupAlert({title: "Warning message", template: nl.t('{}', ret.error)} );
        }
        _updateReportLanguage(selected);
    };

    $scope.canShowMultiLang = function() {
        if(modeHandler.mode != MODES.DO) return false;
		return (_userInfo && _userInfo.groupinfo && _userInfo.groupinfo.features['multiLangCourse']) || false;
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
        vp.tb = (vp.i || $scope.canvasMode || ($scope.forumInfo||{}).refid);
        nlRouter.updateBodyClass('iframeActive', vp.i);
    };
    
    nl.resizeHandler.onResize(function() {
        $scope.updateVisiblePanes();
    });

    $scope.popout = function(bPopout) {
        _popout(bPopout);
    };

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
            else nlTopbarSrv.showTopbar(true);
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
            var nQuizzes = _statusInfo ? _statusInfo.nPassedQuizes + _statusInfo.nFailedQuizes : 0;
			return nl.t('(from {} {})', nQuizzes, nQuizzes == 1 ? 'quiz' : 'quizzes');
		}
	};
	
	$scope.getCompletionStatus = function() {
        if (!_statusInfo) return 0;
        var ncompleted = _statusInfo.nCompletedItems;
        var nActual = _statusInfo.cnttotal - (_statusInfo.nlockedcnt + _statusInfo.nhiddencnt);
        return Math.round((100*ncompleted/nActual));
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
            var str = '';
            var today = new Date();
            if(cm.type == 'module') {
                str = '<div class="padding-mid" style="font-size:120%; font-weight:bold">All items inside the folder are locked.</div>';
            } else if (cm.isAttrition) { 
                str = '<div class="padding-mid" style="font-size:120%; font-weight:bold">Learner has been marked as attrited. Further items cannot be accessed.</div>';
            } else if (cm.start_date && cm.start_date > today) {
                str = nl.t('<div class="padding-mid" style="font-size:120%; font-weight:bold">"{}" can be accessed only after {}</div>', 
                    cm.name, nl.fmt.fmtDateDelta(cm.start_date, today, 'date'));
            } else if (dependencyArray.length == 0) {
                str = '<div class="padding-mid" style="font-size:120%; font-weight:bold">Course dependency is incorrectly configured. Please check with your administrator.</div>';
            } else {
                str = cm.dependencyType == 'atleastone'
                    ? '<div class="padding-mid" style="font-size:120%; font-weight:bold">This element is currently locked. It will be unlocked after atleast one of the following condition(s) are met</div>'
                    : '<div class="padding-mid" style="font-size:120%; font-weight:bold">This element is currently locked. It will be unlocked after all the following condition(s) are met</div>';
                str += '<div class="padding-mid"><ul>';
                for(var i=0; i<dependencyArray.length; i++) str += nl.t('<li style="line-height:24px">{}</li>', dependencyArray[i]);
                str += '</ul></div>'
            }
            return nlDlg.popupAlert({title: cm.name, template: str});
        }
        var dontUpdate = true;
        _confirmIframeClose(cm, function() {
            if(nl.rootScope.screenSize == 'small') _popout(true);
            _onLaunchImpl(cm);
        }, dontUpdate);
    };
    
    function _onLaunchImpl(cm) {
        if (cm.type === 'lesson') modeHandler.handleLessonLink(cm, false, $scope);
        else if(cm.type === 'link' || cm.type === 'certificate') modeHandler.handleLink(cm, false, $scope);
        else if (cm.type === 'iltsession') modeHandler.handleILTLink(cm, false, $scope, _updatedStatusinfoAtServer);
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
				if(res) nl.window.location.href = '#/';
			});
	    }
    }

    var _CM_STATES = {
        hidden:  {title: 'Hidden'}, // TODO-LATER - not handled yet!
        none:    {icon: 'ion-information-circled fblue', title: ''},
        waiting: {icon: 'ion-locked fgrey', title: 'waiting'},
        delayed: {icon: 'ion-alert-circled forange', title: 'delayed'},
        pending: {icon: 'ion-ios-circle-filled fyellow', title: 'pending'},
        started: {icon: 'ion-ios-circle-filled fgreen2', title: 'started'},
        failed:  {icon: 'icon ion-close-circled forange', title: 'failed'},
        expired:  {icon: 'icon ion-close-circled forange', title: 'certificate expired'},
        success: {icon: 'ion-checkmark-circled fgreen', title: 'done'},
        partial_success: {icon: 'ion-checkmark-circled fyellow', title: 'partially done'} // Only folder status
    };

    function _updateState(cm, state) {
        // statusIcon, statusText, statusShortText
        if (cm.type == 'iltsession' && state == 'failed') {
            cm.state = {icon: 'ion-ios-circle-filled fgrey'};
            cm.state.title = cm.statusStr;  
        } else {
            if (state in _CM_STATES) {
                cm.state = angular.copy(_CM_STATES[state] || _CM_STATES.hidden);
                if (cm.type == 'iltsession') cm.state.title = cm.statusStr;
            } else if (state.toLowerCase().indexOf('attrition') == 0) {
                cm.state = {icon: 'ion-ios-circle-filled fgrey'};
                cm.state.title = cm.statusStr;
            } else {
                cm.state = angular.copy(_CM_STATES.started);
                cm.state.title = state;
            }    
        }
        cm.state.status = state;
        if (state != 'waiting') return;
        modeHandler.setDependencyArray(cm, cm.start_after || [], nlTreeListSrv, cm.start_date);
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
        folderStats.clear();
        var reopener = new Reopener(modeHandler, nlTreeListSrv, _userInfo, nl, nlDlg, 
            nlServerApi, _updatedStatusinfoAtServer);
        reopener.reopenIfNeeded().then(function() {
            modeHandler.updateStatusInfo();
            if(modeHandler.mode == MODES.DO) {
                var oldCompletedState = modeHandler.course.completed;
                var newCompletedState = modeHandler.isCourseCompleted();
                if(newCompletedState != oldCompletedState) {
                    nlServerApi.courseUpdateStatus(modeHandler.course.id, newCompletedState).then(function(result) {
                        modeHandler.course.completed = newCompletedState;
                    })
                }
            }
            if(_statusInfo.nTotalQuizMaxScore) $scope.computedData['avgQuizScore'] = Math.round(100*_statusInfo.nTotalQuizScore/_statusInfo.nTotalQuizMaxScore);
            _updateItemData(nlTreeListSrv.getRootItem(), _statusInfo.itemIdToInfo);
			$scope.rootStat = folderStats.get(nlTreeListSrv.getRootItem().id);
        });
    }

    function _updateItemData(cm, itemIdToInfo) {
        if (cm.type === 'module') {
            _updateModuleData(cm, itemIdToInfo);
            return;
        }
        var itemInfo = itemIdToInfo[cm.id] || {};
        cm.hideItem = (modeHandler.mode == MODES.DO || modeHandler.mode == MODES.REPORT_VIEW) && itemInfo.hideItem;
        if (itemInfo.dependencyArray) cm.dependencyArrayFromRepHelper = itemInfo.dependencyArray || [];
        if (cm.type === 'info' || cm.type === 'link') {
            _updateLinkData(cm, itemInfo);
        } else if (cm.type === 'certificate') {
            _updateCertificateData(cm, itemInfo);
        } else if (cm.type === 'iltsession') {
			_updateILTData(cm, itemInfo);
        } else if (cm.type === 'milestone') {
			_updateMilestoneData(cm, itemInfo);
        } else if (cm.type === 'rating') {
            _updateRatingData(cm, itemInfo);
        } else if (cm.type === 'gate') {
            _updateGateData(cm, itemInfo);        
        } else {
            _updateLessonData(cm, itemInfo);
        }

        cm.isAttrition = itemInfo.isAttrition || false;
        var status = itemInfo.status || 'pending';
        _updateState(cm, status);
    }

    function _updateLinkData(cm, itemInfo) {
        cm.score = null;
        cm.time = null;
        cm.updated = itemInfo.updated;
    }
    
    function _updateCertificateData(cm, itemInfo) {
        cm.score = null;
        cm.time = null;
        cm.updated = itemInfo.updated;
        var stainf = _statusInfo;
        if ((stainf.status == 'certified' || stainf.isCertified) && stainf.certid) {
            var certInfo = stainf.itemIdToInfo[stainf.certid];
            cm.certifiedOn = nl.fmt.fmtDateDelta(nl.fmt.json2Date(certInfo.updated), null, 'minute');
            if (certInfo.expire_after && cm.certifiedOn) {
                var expireDays = parseInt(certInfo.expire_after);
                var expireOn = new Date(certInfo.updated);
                expireOn.setDate(expireOn.getDate() + expireDays);
                if(new Date() < expireOn) 
                    cm.certValid = nl.fmt.fmtDateDelta(expireOn, null, 'minute');
                else 
                    itemInfo.status = 'expired';
            }
        }
    }

    function _updateILTData(cm, itemInfo) {
        cm.remarks = itemInfo.remarks || '';
        cm.duration = itemInfo.iltTotalTime;
        cm.timeMins = itemInfo.iltTimeSpent || '-';
        cm.marked = itemInfo.marked || '-';
        cm.start = itemInfo.start;
        cm.url = itemInfo.url;
        cm.notes = itemInfo.notes;
        cm.statusStr = itemInfo.state || '';
    }
 
    function _updateGateData(cm, itemInfo) {
        cm.gateScore = itemInfo.score;
        cm.passScore = itemInfo.passScore;
    }

    function _updateRatingData(cm, itemInfo) {
        cm.ratingScore = itemInfo.score;
        cm.ratingStr = itemInfo.rating;
        cm.remarks = itemInfo.remarks || '';
        cm.marked = itemInfo.marked || '-';
    }

    function _updateMilestoneData(cm, itemInfo) {
        cm.remarks = itemInfo.remarks;
    }

    function _updateLessonData(cm, itemInfo) {
        cm.time = itemInfo.timeSpentSeconds || null;
        cm.passScore = itemInfo.passScore || null;
        cm.attempt = itemInfo.nAttempts || null;
        cm.started = itemInfo.started || null;
        var isEnded = nlReportHelper.isEndItemState(itemInfo.status);
        cm.ended = isEnded ? itemInfo.ended || null : null;
        cm.score = isEnded ? itemInfo.rawScore || null : null;
        cm.maxScore = isEnded ? itemInfo.maxScore || null : null;
        cm.perc = isEnded ? itemInfo.score || null : null;
    }
    
    function _updateModuleData(cm, itemIdToInfo) {
        var folderStat = folderStats.get(cm.id);
        var children = nlTreeListSrv.getChildren(cm);
        for (var i=0; i<children.length; i++) {
            var child = children[i];
            _updateItemData(child, itemIdToInfo);
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
        cm.hideItem = (modeHandler.mode == MODES.DO || modeHandler.mode == MODES.REPORT_VIEW) && (folderStat.total == 0); //Hide the empty folder in do and report_view
        cm.totalItems = folderStat.total;
        cm.completedItems = folderStat.completedItems;
    }
    
    function _updatedStatusinfo(cm, status, remarks, dontHide) {
        if (!('statusinfo' in modeHandler.course)) modeHandler.course.statusinfo = {};
        var timestamp = new Date(); 
        modeHandler.course.statusinfo[cm.id] = {
            status: status ? 'done' : '',
            timestamp: timestamp,
            date: nl.fmt.date2Str(timestamp, 'date'),
            username: _userInfo.username,
            remarks: remarks
        };
        if(cm.type != 'certificate') _updatedStatusinfoAtServer(false);
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
        modeHandler.updateStatusInfo();
        var completed = modeHandler.isCourseCompleted();
        nlDlg.showLoadingScreen();
        nlServerApi.courseReportUpdateStatus(repid, JSON.stringify(modeHandler.course.statusinfo), completed)
        .then(function(status) {
            nlDlg.hideLoadingScreen();
            if(!status) return;
            _updateAllItemData();
            modeHandler.course.completed = completed;
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
            showDateField: true, enableSubmissionAfterEndtime: true, blended: c.content.blended, course: c};
        var features = _userInfo.groupinfo.features;
        var grpChecklist = features.courses && features.courses.coursePublishChecklist ? features.courses.coursePublishChecklist : [];
        if (grpChecklist && grpChecklist.length > 0) {
            var checklist = c.content.checklist || [];
            var msg = nlCourse.getCheckListDialogParams(grpChecklist, checklist);
            if (msg) {
                nlDlg.popupConfirm({title: 'Warning', template: msg, okText: 'Continue'}).then(function(res) {
                    if (!res) return;
                    nlSendAssignmentSrv.show($scope, assignInfo, _userInfo);						
                });    
            } else {
                nlSendAssignmentSrv.show($scope, assignInfo, _userInfo);
            }
        } else {
            nlSendAssignmentSrv.show($scope, assignInfo, _userInfo);						
        }
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
            started: 0, pending: 0, delayed: 0, waiting: 0, hidden: 0,
            scoreCount: 0, score: 0, maxScore: 0, perc: 0,
            time: 0,
            completedItems: 0, folderCount: 0};
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
        folderStat.hidden += childStat.hidden;
        folderStat.scoreCount += childStat.scoreCount;
        folderStat.score += childStat.score;
        folderStat.maxScore += childStat.maxScore;
        folderStat.time += childStat.time;
        folderStat.folderCount += cm.type == "module" ? 1 : 0;
    };

    this.updateForLeaf = function(folderStat, cm) {
        if (cm.hideItem) folderStat.hidden += 1;
        else if (cm.state.status == 'waiting') folderStat.waiting += 1;
        else if (cm.state.status == 'delayed') folderStat.delayed += 1;
        else if (cm.state.status == 'pending') folderStat.pending += 1;
        else if (cm.state.status == 'started') folderStat.started += 1;
        else if (cm.state.status == 'failed') folderStat.failed += 1;
        else if (cm.state.status == 'success') folderStat.success += 1;
        else if (cm.state.status == 'partial_success') folderStat.success += 1;

        if (cm.type == 'lesson' && cm.maxScore && cm.score !== null) {
            folderStat.scoreCount += 1;
            folderStat.score += cm.score;
            folderStat.maxScore += (cm.maxScore || 0);
        }
        if (cm.time !== null) {
            folderStat.time += cm.time;
        }
    };
    
    this.updateTotals = function(folderStat) {
        folderStat.total = folderStat.success + folderStat.failed + folderStat.started 
            + folderStat.pending + folderStat.delayed + folderStat.waiting;
        folderStat.perc = folderStat.maxScore > 0 ? Math.round((folderStat.score/folderStat.maxScore)*100) : 0;
        folderStat.completedItems = folderStat.success + folderStat.failed;
        _updateChartInfo(folderStat);
    };

    var _chartLabels = ['done', 'failed', 'started', 'delayed', 'pending', 'waiting'];
    var _chartColours = [_nl.colorsCodes.done, _nl.colorsCodes.failed, _nl.colorsCodes.started, _nl.colorsCodes.delayed, _nl.colorsCodes.pending, _nl.colorsCodes.waiting];
    function _updateChartInfo(folderStat) {
        var ret = {labels: _chartLabels, colours: _chartColours, options: {maintainAspectRatio: false}};
        ret.data = [folderStat.success, folderStat.failed, 
            folderStat.started, folderStat.delayed, folderStat.pending, folderStat.waiting
        ];
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
                || this.item.type == 'iltsession' || this.item.type == 'rating' || this.item.type == 'milestone');
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
        if (modeHandler.mode == MODES.DO && cm.type == 'iltsession' && cm.state.status == 'pending') return 'Join';
        if (modeHandler.mode == MODES.DO && cm.state.status == 'started') return 'Continue';
        if (cm.state.status == 'success' || cm.state.status == 'failed') return 'Review';
        return 'Start';
    };

	this.canShowLaunch = function(cm) {
        if (cm && cm.state.status == "waiting") return true;
        if (!cm || (cm.type != 'lesson' && cm.type != 'link' && cm.type != 'certificate' && cm.type != 'iltsession')) return false;
        if (cm.type == 'iltsession') {
            if (modeHandler.mode == MODES.DO && cm.url && modeHandler.canJoinMeeting(cm))  return true;
            return false;
        }
        if (this.isStaticMode()) return true;
        if (this.hideReviewButton(cm)) return false;
        if (modeHandler.mode == MODES.DO && cm.type == 'certificate' && cm.state.status == 'expired') return false;
        if (modeHandler.mode == MODES.DO) return true;
        return (cm.state.status == 'success' || cm.state.status == 'failed');
	};
	
	this.hideReviewButton = function(cm) {
        if (!cm) return true;
        if (this.canShowTryAgain(cm)) return true;
        if (!(modeHandler.course.content.hide_answers || cm.hide_answers) || modeHandler.mode != MODES.DO) return false; 
        return (cm.type == 'lesson' && (cm.state.status == 'success' || cm.state.status == 'failed'));
	};

	this.canShowTryAgain = function(cm) {
        if (!cm || cm.type != 'lesson' || modeHandler.mode != MODES.DO) return false;
        if (cm.state.status  == 'success') return false;
        return ((cm.state.status  == 'failed') && (cm.maxAttempts == 0 || cm.attempt < cm.maxAttempts));
    }

    this.getRoundedPercentage = function(completed, total, rep) {
        if(total == 0 || rep && rep.selfLearningMode) return '-';
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
        var func = (modeHandler.mode === MODES.REPORT_VIEW && modeHandler.urlModeStr != 'report_view_my') 
        ? 'review_report_assign' : 'view_report_assign';
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
        'milestone': 'ion-flag fblue',
        'lesson': 'ion-document-text fblue',
        'lesson-assesment': 'ion-document-text fblue',
        'lesson-self': 'ion-document-text fblue',
        'quiz': 'ion-help-circled fblue',
        'info': 'ion-information-circled fblue',
        'certificate': 'ion-android-star fblue',
        'link': 'ion-document fblue',
        'rating': 'ion-speedometer fblue',
        'gate': 'ion-calculator fblue',
        'user': 'ion-person forange2'
    };
}

//-------------------------------------------------------------------------------------------------
// TreeList class changed to treeList Service
//-------------------------------------------------------------------------------------------------
var TreeListSrv = [function() {
	var ID_ATTR = 'id';
	var DELIM = '.';
	var VISIBLE_ON_OPEN = 1; // Only top level visible by default
    var rootItem = {type: 'module', name: 'Summary', id: '_root'};

    this.createNew = function() {
        // The service is one global having the state stored in the
        // service oject itself and is useful for course_view.js usage.
        // For usage in dialog boxes, create a new object of this kind!
        return new TreeListSrv[0]();
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
        var targetLang = modeHandler.course.content.targetLang || 'en';
        var refid = cm.refid;
        if (targetLang != 'en') {
            var languageInfo = modeHandler.course.content.languageInfo[targetLang] || {};
            if (languageInfo[cm.id] && languageInfo[cm.id].refid) refid = languageInfo[cm.id].refid;
        }
        nlServerApi.courseCreateLessonReport(modeHandler.course.id, refid, cm.id, cm.attempt+1, cm.maxDuration||0, modeHandler.course.not_before||'', modeHandler.course.not_after||'', false, targetLang)
        .then(function(ret) {
            cm.attempt++;
            modeHandler.course.lessonReports = ret.lessonReports;
            modeHandler.course.pastLessonReports = ret.pastLessonReports;
            _createLessonReport(reopenLessons, pos+1, resolve);
        }, function(err) {
            nlDlg.hideLoadingScreen();
            resolve(false);
        });
    }
}

//-------------------------------------------------------------------------------------------------
function NlContainer(nl, nlDlg, nlServerApi, $scope, modeHandler) {
    var self = this;
    this.setContainerInWindow = function() {
        nl.log.debug('setContainerInWindow called');
        nl.window.NITTIO_LEARN_CONTAINER = this;
    };
    
    var _onSaveHandler = null;
    this.onSave = function(fn) {
        _onSaveHandler = fn;
    };

    this.setMaxModeFlag = function(flag) {
        nl.timeout(function() {
            if (flag) $scope.popout(true);
            $scope.ext.maxMode = flag;
        });
    };
    
    this.log = nl.log;

    this.init = function(data) {
        nl.log.debug('NlContainer.init: ', data);
    };
    
    this.getComputedData = function() {
        return $scope.computedData;
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
    
    var _saveOngoing = false;
    var _pendingSaveData = null;
    var _closePending = false;
    this.save = function(reportId, lesson, prunedContent, bDone) {
        if (modeHandler.mode != MODES.DO) return;
        if (_saveOngoing) {
            _pendingSaveData = {reportId: reportId, lesson: lesson, prunedContent: prunedContent, bDone: bDone};
            return;
        }
        _saveOngoing = true;

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
        lessonReportInfo.targetLang = $scope.courseContent.targetLang;
        if (_onSaveHandler) _onSaveHandler(lessonReportInfo);
        modeHandler.updateStatusInfo();
        var data = {lessonId: reportId, bSubmit: bDone, content: prunedContent, 
            completed: modeHandler.isCourseCompleted()};
        nlServerApi.courseSaveOrSubmitLessonReport(data).then(function(result) {
            if(!result) return;
            modeHandler.course.completed = data.completed;
            $scope.updateAllItemData();
            _completePendingOperations();
        }, function(err) {
            _completePendingOperations();
        });
    };

    this.close = function() {
        if (_saveOngoing) {
            _closePending = true;
            return;
        }
        $scope.closeIFrame();
    };

    function _completePendingOperations() {
        _saveOngoing = false;
        if (_pendingSaveData) {
            var data = _pendingSaveData;
            _pendingSaveData = null;
            self.save(data.reportId, data.lesson, data.prunedContent, data.bDone);
        } else if (_closePending) {
            _closePending = false;
            self.close();
        }
    }
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
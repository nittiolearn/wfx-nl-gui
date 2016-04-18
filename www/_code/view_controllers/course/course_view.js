(function() {

//-------------------------------------------------------------------------------------------------
// course_view.js:
// course_view module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.course_view', [])
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

function ModeHandler(nl, nlCourse, nlDlg) {
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
            nl.pginfo.pageSubTitle = nl.t('(edit)');
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
    
    this.getCourse = function(course) {
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
        if (!_canStart(cm, scope)) return true;
        var url = nlCourse.getActionUrl(cm.action, cm.urlParams);
        return _redirectTo('{}', url, newTab);
    };
    
    this.handleLessonLink = function(cm, newTab, scope) {
        var self = this;
        if (!('refid' in cm)) return _popupAlert('Error', 'Link to the learning module is not specified');
        var refid = cm.refid;
        if (this.mode === MODES.PRIVATE || this.mode === MODES.EDIT || this.mode === MODES.PUBLISHED) {
            return _redirectTo('/lesson/view/{}', refid, newTab);
        }

        var reportInfo = (cm.id in self.course.lessonReports) ? self.course.lessonReports[cm.id] : null;
        if (this.mode === MODES.REPORTS_SUMMARY_VIEW || this.mode === MODES.REPORT_VIEW) {
            if (!reportInfo || !reportInfo.completed) return _popupAlert('Not completed', 
                'This learning module is not yet completed. You may view the report once it is completed.');
            return _redirectTo('/lesson/review_report_assign/{}', reportInfo.reportId, newTab);
        }
        
        // do mode
        if (!_canStart(cm, scope)) return true;
        if (_redirectToLessonReport(reportInfo, newTab)) return true;
        
        nlDlg.showLoadingScreen();
        nlCourse.courseCreateLessonReport(self.course.id, refid, cm.id).then(function(updatedCourseReport) {
            // nlDlg.hideLoadingScreen(); not required here
            self.course = updatedCourseReport;
            reportInfo = self.course.lessonReports[cm.id];
            _redirectToLessonReport(reportInfo, newTab);
        });
        
        return true;
    };
    
    this.shallShowScore = function() {
        return (this.mode === MODES.REPORTS_SUMMARY_VIEW || this.mode === MODES.REPORT_VIEW || this.mode === MODES.DO);
    };

    // Private functions
    function _popupAlert(title, template) {
        nlDlg.popupAlert({title: nl.t(title), template: nl.t(template)});
        return true;
    }

    function _canStart(cm, scope) {
        var today = new Date();
        if (scope.planning && cm.start_date && cm.start_date > today) {
            _popupAlert('Error', nl.fmt2('Cannot be started before {}', cm.start_date_str));
            return false;
        }
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
            nlDlg.showLoadingScreen();
            nl.window.location.href = url;
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
var NlCourseViewCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCourse', 'nlIframeDlg',
function(nl, nlRouter, $scope, nlDlg, nlCourse, nlIframeDlg) {
    var modeHandler = new ModeHandler(nl, nlCourse, nlDlg);
    var treeList = new TreeList(nl);
    var courseReportSummarizer = new CourseReportSummarizer($scope);
    var _userInfo = null;
    var _allModules = [];
    $scope.MODES = MODES;
    function _onPageEnter(userInfo) {
        _userInfo = userInfo;
        return nl.q(function(resolve, reject) {
            treeList.clear();
            $scope.params = nl.location.search();
            $scope.expandedView = (nl.rootScope.screenSize != 'small'); 
            _updateExpandViewIcon();
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

    function _onCourseRead(course) {
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
        _updateAllItemData(modeHandler);
    }

    function _showVisible() {
        $scope.modules = [];
        for(var i=0; i<_allModules.length; i++) {
            var cm=_allModules[i];
            if (!cm.visible) continue;
            $scope.modules.push(cm);
        }
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

    $scope.isTreeCollapsed = true;
    $scope.collapseAll = function() {
        treeList.collapseAll();
        $scope.isTreeCollapsed = true;
        _showVisible();
    };
    
    $scope.expandViewClick = function() {
        $scope.expandedView = !$scope.expandedView;
        $scope.expandviewtext = _updateExpandViewIcon();
    };
    
    function _updateExpandViewIcon() {
        if ($scope.expandedView) {
            $scope.expandViewText = nl.t('Show less');
            $scope.expandViewIcon = nl.url.resUrl('less.png');
            return;
        }
        $scope.expandViewText = nl.t('Show more');
        $scope.expandViewIcon = nl.url.resUrl('more.png');
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

    $scope.addContent = function() {
        var newDlg = nlDlg.create($scope);
		newDlg.setCssClass('nl-height-max nl-width-max');
		newDlg.scope.dlgTitle = nl.t('Add course module');
        newDlg.scope.error = {};
		newDlg.scope.data = {
			type:{id:null}, id:'', name: '', planned_date: '', start_date: '',
			icon: '', urlParams: '', action: '', refid: ''
		};
		newDlg.scope.options = {'type': [
			{name: '', id: null},
			{name: 'Folder', id: 'module'},
			{name: 'Module', id: 'lesson'},
			{name: 'Information', id: 'info'},
			{name: 'Link', id: 'link'}
		]};

		var buttons = [];
		var saveName = nl.t('Save');
		var saveButton = {
			text : saveName,
			onTap : function(e) {
				_onContentSave(e, $scope, newDlg.scope.data, modeHandler.courseId);
			}
		};
		buttons.push(saveButton);
		var cancelButton = {
			text : nl.t('Cancel')
		};
		newDlg.show('view_controllers/course/course_content_dlg.html',
			buttons, cancelButton, false);
    };
    
    function _onContentSave(e, $scope, data, courseId) {
    	// TODO: bring the validation code from course_list.js
        _updateCourseModules(data);
		var modifiedData = {
			name: modeHandler.course.name, 
			icon: modeHandler.course.icon, 
			description: modeHandler.course.description,
			content: angular.toJson(modeHandler.course.content),
			courseid: courseId,
			publish: false
		};
		nlDlg.showLoadingScreen();
		nlCourse.courseModify(modifiedData).then(function(course) {
			nlDlg.hideLoadingScreen();
        	_onCourseRead(course);
		});
    }
    
    function _updateCourseModules(data) {
		var type = data.type.id;
		var module = {type: type, id: data.id, name: data.name, 
			icon: data.icon, planned_date: data.planned_date, start_date: data.start_date};
		if(type == 'lesson') {
			module.refid = data.refid;
		} 
		if(type == 'link') {
			module.urlParams = data.urlParams;
			module.action = data.action;
		}
        var modules = modeHandler.course.content.modules;
        var pos = modules.length - 1;
        for(var i=0; i< modules.length; i++) {
        	var mod = modules[i];
			if(data.posId == mod.id) {
				pos = i;
				break;
        	}
        }
		modules.splice(pos+1, 0, module);
	}
	
    $scope.onClick = function(e, cm, newTab) {
        if (cm.type === 'lesson') {
            modeHandler.handleLessonLink(cm, newTab, $scope);
        } else if(cm.type === 'module') {
            treeList.toggleItem(cm);
            $scope.isTreeCollapsed = treeList.isTreeCollapsed();
            _showVisible();
        } else if(cm.type === 'link') {
            modeHandler.handleLink(cm, newTab, $scope);
        }
        e.stopImmediatePropagation();
        e.preventDefault();
        return false;
    };
    
    $scope.getIcon = function(cm) {
        var icon = ('icon' in cm) ? cm.icon : cm.type;
        if (icon in _icons) return _icons[icon];
        return icon;
    };
    
    $scope.getNewTabIcon = function(getNewTabIcon) {
        return _icons['newtab'];
    };

    var _icons = {
        'newtab': nl.url.resUrl('launch.png'),
        'module': nl.url.resUrl('folder.png'),
        'lesson': nl.url.resUrl('lesson2.png'),
        'quiz': nl.url.resUrl('quiz.png'),
        'info': nl.url.resUrl('info.png'),
        'link': nl.url.resUrl('file.png'),
        'user': nl.url.resUrl('user.png'),
        'grey': nl.url.resUrl('ball-grey.png'),
        'red': nl.url.resUrl('ball-red.png'),
        'yellow': nl.url.resUrl('ball-yellow.png'),
        'green': nl.url.resUrl('ball-green.png')
    };
    
    var _moduleProps = {
        module: {clickable: true, launchable: false},
        lesson: {clickable: true, launchable: true},
        link: {clickable: true, launchable: true},
        info: {clickable: false, launchable: false}
    };
    
    var _defModuleProps = {clickable: false, launchable: false};

    function _initModule(cm) {
        treeList.addItem(cm);
        cm.statusIcon = null;
        cm.statusText = '';
        cm.statusShortText = '';
        var props = (cm.type in _moduleProps) ? _moduleProps[cm.type] : _defModuleProps;
        cm.clickable = props.clickable;
        cm.launchable = props.launchable;
        cm.planned_date = cm.planned_date ? nl.fmt.json2Date(cm.planned_date) : null;
        cm.start_date = cm.start_date ? nl.fmt.json2Date(cm.start_date) : null;
    }

    function _updateAllItemData(modeHandler) {
        var today = new Date();
        var rootItems = treeList.getRootItems();
        for(var i=0; i<rootItems.length; i++) {
            _updateItemData(modeHandler, modeHandler.course, rootItems[i], today);
        }
    }

    function _updateItemData(modeHandler, course, cm, today) {
        if (cm.type === 'module') {
            _updateModuleData(modeHandler, course, cm, today);
        } else if (cm.type === 'info' || cm.type === 'link') {
            _updateLinkData(modeHandler, course, cm, today);
        } else {
            _updateLessonData(modeHandler, course, cm, today);
        }
        cm.planned_date_str = cm.planned_date ? nl.fmt.date2Str(cm.planned_date, 'date') : '';
        cm.start_date_str = cm.start_date ? nl.fmt.date2Str(cm.start_date, 'date') : '';
        _updateStatusInfo(modeHandler, cm, today);
    }

    function _updateModuleData(modeHandler, course, cm, today) {
        cm.totalCount = 0;
        cm.completedCount = 0;
        cm.delayedCount = 0;
        cm.score = 0;
        cm.maxScore = 0;
        cm.scoreAvailableCount = 0;
        cm.planned_date = null;
        cm.start_date = null;
        cm.timeSpentCount = 0;
        cm.timeSpentSeconds = 0;

        var children = treeList.getChildren(cm);
        for (var i=0; i<children.length; i++) {
            var child = children[i];
            _updateItemData(modeHandler, course, child, today);
            cm.totalCount += child.totalCount;
            cm.completedCount += child.completedCount;
            cm.delayedCount += child.delayedCount;
            cm.score += child.score;
            cm.maxScore += child.maxScore;
            cm.scoreAvailableCount += child.scoreAvailableCount;
            cm.timeSpentCount += child.timeSpentCount;
            cm.timeSpentSeconds += child.timeSpentSeconds;
            if (!cm.planned_date || child.planned_date > cm.planned_date) {
                cm.planned_date = child.planned_date;
            }   
            if (!cm.start_date || child.start_date < cm.start_date) {
                cm.start_date = child.start_date;
            }   
        }
    }
    
    function _updateLinkData(modeHandler, course, cm, today) {
        cm.totalCount = 1;
        cm.completedCount = 0;
        cm.scoreAvailableCount = 0;
        cm.delayedCount = ($scope.planning && cm.planned_date && cm.planned_date < today) ? 1 : 0;
        cm.score = 0;
        cm.maxScore = 0;
        cm.timeSpentCount = 0;
        cm.timeSpentSeconds = 0;
        if (!course.statusinfo || !(cm.id in course.statusinfo)) return;

        var statusinfo = course.statusinfo[cm.id];
        if (statusinfo.status != 'done') return;
        cm.completedCount = 1;
        cm.delayedCount = 0;
    }
    
    function _updateLessonData(modeHandler, course, cm, today) {
        cm.totalCount = 1;
        cm.completedCount = 0;
        cm.scoreAvailableCount = 0;
        cm.delayedCount = ($scope.planning && cm.planned_date && cm.planned_date < today) ? 1 : 0;
        cm.score = 0;
        cm.maxScore = 0;
        cm.timeSpentCount = 0;
        cm.timeSpentSeconds = 0;

        if (!('refid' in cm) || !('lessonReports' in course)) return;
        if (!(cm.id in course.lessonReports)) return;
        var lessonReport = course.lessonReports[cm.id];
        var completed = 'completed' in lessonReport ? lessonReport.completed : false;
        if ('started' in lessonReport) cm.started = lessonReport.started;
        if ('timeSpentSeconds' in lessonReport) {
            cm.timeSpentSeconds = parseInt(lessonReport.timeSpentSeconds);
            cm.timeSpentCount = 1;
        }
        if (!completed) return;
        cm.completedCount = 1;
        cm.delayedCount = 0;

        if ('maxScore' in lessonReport) cm.maxScore = parseInt(lessonReport.maxScore);
        if ('score' in lessonReport) cm.score = parseInt(lessonReport.score);
        if ('ended' in lessonReport) cm.ended = lessonReport.ended;
        if (cm.maxScore > 0) cm.scoreAvailableCount = 1;
    }
    
    function _updateStatusInfo(modeHandler, cm, today) {
        if (!modeHandler.shallShowScore()) {
            if (cm.type !== 'module') return;
            if (cm.totalCount > 1) {
                cm.statusText = nl.t('{} items', cm.totalCount);
            } else if (cm.totalCount > 0) {
                cm.statusText = nl.t('{} item', cm.totalCount);
            }
            return;
        }
        if (cm.type !== 'module') {
            _updateStatusInfoForLeaf(modeHandler, cm, today);
            return;
        }
        _updateStatusInfoForContainer(modeHandler, cm, today);
        return;
    }

    function _updateStatusInfoForLeaf(modeHandler, cm, today) {
        var timeSpentStr = '';
        if (cm.timeSpentSeconds) {
            timeSpentStr = nl.fmt2(' ({} minutes)', Math.round(cm.timeSpentSeconds/60));
        }
        if (cm.delayedCount > 0) {
            cm.statusIcon = _icons['red'];
            cm.statusShortText = nl.t('delayed');
            cm.statusText = nl.t('delayed{}', timeSpentStr);
            return;
        }
        if (cm.completedCount > 0) {
            cm.statusIcon = _icons['green'];
            cm.statusShortText = nl.t('done');
            if (cm.maxScore === 0) {
                cm.statusText = nl.t('done{}', timeSpentStr);
                return;
            }
            var perc = Math.round((cm.score/cm.maxScore)*100);
            cm.statusText = (cm.score > 0) ? nl.t('done ({}%){}', perc, timeSpentStr) : nl.t('done{}', timeSpentStr);
            return;
        }
        if ($scope.planning && cm.start_date) {
            if (cm.start_date > today) {
                cm.statusIcon = _icons['grey'];
                cm.statusShortText = nl.t('planned');
                cm.statusText = nl.t('planned');
                return;
            }
        }
        cm.statusIcon = _icons['yellow'];
        cm.statusShortText = nl.t('pending');
        cm.statusText = nl.t('pending{}', timeSpentStr);
    }
    
    function _updateStatusInfoForContainer(modeHandler, cm, today) {
        if (cm.totalCount == 0) return;
        var timeSpentStr = '';
        if (cm.timeSpentSeconds && cm.timeSpentCount) {
            timeSpentStr = nl.fmt2(' (average {} minutes)', Math.round(cm.timeSpentSeconds/60/cm.timeSpentCount));
        }
        var scoreStr = '';
        if (cm.maxScore > 0 && cm.score > 0) {
            var perc = Math.round(cm.score/cm.maxScore*100);
            scoreStr = cm.scoreAvailableCount > 1 ? nl.t('({}% from {} items)', perc, cm.scoreAvailableCount): nl.t('({}% from {} item)', perc, cm.scoreAvailableCount); 
        }
        if (cm.delayedCount > 0) {
            cm.statusIcon = _icons['red'];
            cm.statusShortText = nl.t('delayed');
            cm.statusText = nl.t('{} of {} delayed {}{}', cm.delayedCount, cm.totalCount, scoreStr, timeSpentStr);
            return;
        }
        if (cm.completedCount < cm.totalCount) {
            if ($scope.planning && cm.start_date && cm.start_date > today) {
                cm.statusIcon = _icons['grey'];
                cm.statusShortText = nl.t('planned');
            } else {
                cm.statusIcon = _icons['yellow'];
                cm.statusShortText = nl.t('pending');
            }
            var pending = cm.totalCount - cm.completedCount;
            cm.statusText = nl.t('{} of {} pending {}{}', pending, cm.totalCount, scoreStr, timeSpentStr);
            return;
        }

        cm.statusIcon = _icons['green'];
        cm.statusShortText = nl.t('done');
        cm.statusText = cm.totalCount > 1 
            ? nl.t('all {} done {}{}', cm.totalCount, scoreStr, timeSpentStr) 
            : nl.t('{} of {} done {}{}', cm.completedCount, cm.totalCount, scoreStr, timeSpentStr);
    }

    $scope.onClickOnSummary = function(cm) {
        var today = new Date();
        _showModuleDetails(cm, _icons, today);
        return;
    };
    
    function _updatedStatusinfo(cm, status) {
        // TODO: Keep status as boolean; data as javascript Date object
        modeHandler.course.statusinfo[cm.id] = {
            status: status ? 'done' : '',
            date: nl.fmt.date2Str(new Date(), 'date'), 
            username: _userInfo.username
        };
        _updatedStatusinfoAtServer(false);
        _updateAllItemData(modeHandler);
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
    
    var templateDone = nl.t('This is currently marked as completed. You may mark this as not completed by clicking the Undo button.');
    var templateNotDone = nl.t('You may mark this as as completed by clicking Done button.');
    function _showModuleDetails(cm, _icons, today) {
        var card = {};
        card.title = nl.t('Summary');
        var icon = ('icon' in cm) ? cm.icon : cm.type;
        if(icon in _icons) card.icon = _icons[icon];
        card.details = {avps: _getModuleAvps(cm)};

        var cancelButton = {text : nl.t('Close')};
        var buttons = [];
        var warningMsg = '';
        var canUpdateStatus = ($scope.mode == MODES.DO) && (cm.type == 'link' || cm.type == 'info');
        if (canUpdateStatus && $scope.planning && cm.start_date) {
            canUpdateStatus = (cm.start_date <= today);
        }
        if(canUpdateStatus) {
            if(!modeHandler.course.statusinfo) modeHandler.course.statusinfo = {};
            var statusinfo = modeHandler.course.statusinfo;
            var isDone = (cm.id in statusinfo) && (statusinfo[cm.id].status == 'done');
            card.title = isDone ? nl.t('Confirm undo operation'): nl.t('Mark as done');
            warningMsg = (isDone ? templateDone : templateNotDone);
            cancelButton = {text : nl.t('Cancel')};
            var updateButton = {
                text : isDone ? nl.t('Undo'): nl.t('Done'),
                onTap : function(e) {
                    _updatedStatusinfo(cm, !isDone);
                }
            };
            buttons.push(updateButton);
        }
        card.details.help = nl.fmt2("<h3>{}</h3><b>{}</b>", cm.name, warningMsg); 
        var detailsDlg = nlDlg.create($scope);
        detailsDlg.scope.card = card;
        detailsDlg.setCssClass('nl-height-max nl-width-max');
        detailsDlg.show('lib_ui/cards/details_dlg.html', buttons, cancelButton);
    }
    
    function _getModuleAvps(cm) {
        var avps = [];
        nl.fmt.addAvp(avps, 'Status', cm.statusShortText, 'text', '-', cm.statusIcon);
        if(cm.type == 'module') {
            nl.fmt.addAvp(avps, 'Total items', cm.totalCount);
            if ($scope.planning) {
                if(cm.start_date_str) nl.fmt.addAvp(avps, 'Earliest planned start date', cm.start_date_str);
                if(cm.planned_date_str) nl.fmt.addAvp(avps, 'Latest planned end date', cm.planned_date_str);
                nl.fmt.addAvp(avps, 'Delayed items', cm.delayedCount);
            }
            nl.fmt.addAvp(avps, 'Pending items', cm.totalCount-cm.completedCount-cm.delayedCount);
            nl.fmt.addAvp(avps, 'Completed items', cm.completedCount);
            nl.fmt.addAvp(avps, 'Started items', cm.startedCount);
            if(cm.scoreAvailableCount > 0) nl.fmt.addAvp(avps, 'Score avaialble for', cm.scoreAvailableCount);
            if(cm.maxScore > 0 && cm.score > 0) {
                nl.fmt.addAvp(avps, 'Score', nl.t("{}% ({}/{})",Math.round(cm.score/cm.maxScore*100), cm.score, cm.maxScore));
            }
            else nl.fmt.addAvp(avps, 'Score', "-");
            if(cm.timeSpentSeconds && cm.timeSpentCount) {
                var tsTotal = Math.round(cm.timeSpentSeconds/60);
                var tsAvg = Math.round(cm.timeSpentSeconds/60/cm.timeSpentCount);
                nl.fmt.addAvp(avps, 'Items with time log', cm.timeSpentCount);
                nl.fmt.addAvp(avps, 'Average time spent', tsAvg, 'minutes');
                nl.fmt.addAvp(avps, 'Total time spent', tsTotal, 'minutes');
            }
        } else {
            if ($scope.planning) {
                nl.fmt.addAvp(avps, 'Planned start date', cm.start_date_str);
                nl.fmt.addAvp(avps, 'Planned end date', cm.planned_date_str);
            }
            if(cm.type == 'lesson'){
                if(cm.maxScore == 0 || cm.score == 0) nl.fmt.addAvp(avps, 'Score', "-");
                else if(cm.score > 0) {
                    nl.fmt.addAvp(avps, 'Score', nl.t("{}% ({}/{})",Math.round(cm.score/cm.maxScore*100), cm.score, cm.maxScore));
                }
                if ('started' in cm) nl.fmt.addAvp(avps, 'Started', cm.started, 'date');
                if ('ended' in cm) nl.fmt.addAvp(avps, 'Ended', cm.ended, 'date');
                if ('timeSpentSeconds' in cm) nl.fmt.addAvp(avps, 'Time spent', Math.round(cm.timeSpentSeconds/60), 'minutes');
            }
        }
        return avps;
    }
}];

function TreeList(nl, ID_ATTR, DELIM, VISIBLE_ON_OPEN) {
    if (ID_ATTR === undefined) ID_ATTR = 'id';
    if (DELIM === undefined) DELIM = '.';
    if (VISIBLE_ON_OPEN === undefined) VISIBLE_ON_OPEN = 1; // Only top level visible by default
    
    this.clear = function() {
        this.items = {};
        this.rootItems = [];
        this.children = {};
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
            this.rootItems.push(item);
            return;
        }
        var parent = this.getParent(item);
        if (parent) this.getChildren(parent).push(item);
    };
    
    this.getRootItems = function() {
        return this.rootItems;
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

    this.isTreeCollapsed = function() {
        var rootItems = this.rootItems;
        for (var i=0; i<rootItems.length; i++)
            if (rootItems[i].isOpen) return false;
        return true;
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
    
    this.items = {};
    this.rootItems = [];
    this.children = {};
}

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
    }
    
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
    }

    function _getModuleId(parentId, reportId) {
        return parentId + '.' + reportId;
    }
    
}

//-------------------------------------------------------------------------------------------------
module_init();
})();
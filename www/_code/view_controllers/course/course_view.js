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
		url : '/course_view',
		views : {
			'appContent' : {
				templateUrl : 'view_controllers/course/course_view.html',
				controller : 'nl.CourseViewCtrl'
			}
		}
	});
}];

function ModeHandler(nl, nlCourse, nlDlg) {
	var MODES = {PRIVATE: 0, PUBLISHED: 1, REPORT_VIEW: 2, DO: 3};
	var MODE_NAMES = {'private': 0, 'published': 1, 'report_view': 2, 'do': 3};
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
		} else if (this.mode === MODES.PUBLISHED) {
	        nl.pginfo.pageSubTitle = nl.t('(published)');
		} else if (this.mode === MODES.REPORT_VIEW) {
	        nl.pginfo.pageSubTitle = nl.t('({})', course.studentname);		} else if (this.mode === MODES.DO) {
	        nl.pginfo.pageSubTitle = nl.t('({})', course.studentname);
		} 
	};
	
	this.getCourse = function(course) {
		if (this.mode === MODES.PRIVATE || this.mode === MODES.PUBLISHED) {
			return nlCourse.courseGet(this.courseId, this.mode === MODES.PUBLISHED);
		}
		if (this.mode === MODES.REPORT_VIEW) {
			return nlCourse.courseGetReport(this.courseId, false);
		}
		return nlCourse.courseGetReport(this.courseId, true);
	};
	
    this.handleLink = function(cm, newTab) {
        var url = nlCourse.getActionUrl(cm.action, cm.urlParams);
        return _redirectTo('{}', url, newTab);
    };
    
	this.handleLessonLink = function(cm, newTab) {
	    var self = this;
        if (!('refid' in cm)) return _popupAlert('Error', 'Link to the learning module is not specified');
        var refid = cm.refid;
        if (this.mode === MODES.PRIVATE || this.mode === MODES.PUBLISHED) {
            return _redirectTo('/lesson/view/{}', refid, newTab);
        }

        var refidStr = refid.toString();
        var reportInfo = (refidStr in self.course.lessonReports) ? self.course.lessonReports[refidStr] : null;
        if (this.mode === MODES.REPORT_VIEW) {
            if (!reportInfo || !reportInfo.completed) return _popupAlert('Not completed', 
                'This learning module is not yet completed. You may view the report once it is completed.');
            return _redirectTo('/lesson/review_report_assign/{}', reportInfo.reportId, newTab);
        }
        
        // do mode
        if (_redirectToLessonReport(reportInfo, newTab)) return true;
        
        nlDlg.showLoadingScreen();
        nlCourse.courseCreateLessonReport(self.course.id, refid).then(function(updatedCourseReport) {
            // nlDlg.hideLoadingScreen(); not required here
            self.course = updatedCourseReport;
            reportInfo = self.course.lessonReports[refidStr];
            _redirectToLessonReport(reportInfo, newTab);
        });
        
        return true;
	};
	
	this.shallShowScore = function() {
		return (this.mode === MODES.REPORT_VIEW || this.mode === MODES.DO);
	};

    // Private functions
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
var NlCourseViewCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCourse',
function(nl, nlRouter, $scope, nlDlg, nlCourse) {
	var modeHandler = new ModeHandler(nl, nlCourse, nlDlg);
	var treeList = new TreeList(nl);
	var _userInfo = null;
	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {
		    treeList.clear();
			$scope.params = nl.location.search();
			if (!('id' in $scope.params) || !modeHandler.initMode()) {
				nlDlg.popupStatus(nl.t('Invalid url'));
				resolve(false);
				return;
			}
			$scope.mode = modeHandler.mode;
			$scope.expandedView = true;
			$scope.showStatusIcon = modeHandler.shallShowScore();
			var courseId = parseInt($scope.params.id);
			modeHandler.getCourse().then(function(course) {
				modeHandler.initTitle(course);
				$scope.planning = course.content.planning;
				var modules = course.content.modules;
				for(var i=0; i<modules.length; i++) {
					_initModule(modules[i]);
				}
				_updateAllItemData(modeHandler);
                $scope.modules = modules;
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

	$scope.showHideAllButtonName = treeList.showHideAllButtonName();
	$scope.showHideAll = function() {
		treeList.showHideAll();
		$scope.showHideAllButtonName = treeList.showHideAllButtonName();
    };
	
	$scope.expandedView = true;	
	$scope.expandviewtext = _updateExpandviewtext();
	$scope.expandViewClick = function() {
		$scope.expandedView = !$scope.expandedView;
		$scope.expandviewtext = _updateExpandviewtext();
	};
	
	function _updateExpandviewtext() {
		if ($scope.expandedView) return nl.t("Show less");
		return nl.t("Show more");
	}

	$scope.onClick = function(e, cm, newTab) {
		if (cm.type === 'lesson') {
		    modeHandler.handleLessonLink(cm, newTab);
		} else if(cm.type === 'module') {
			treeList.toggleItem(cm);	
		} else if(cm.type === 'link') {
			modeHandler.handleLink(cm, newTab);
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
	}

    function _updateAllItemData(modeHandler) {
		var rootItems = treeList.getRootItems();
        for(var i=0; i<rootItems.length; i++) {
            _updateItemData(modeHandler, modeHandler.course, rootItems[i]);
        }
    }

    function _updateItemData(modeHandler, course, cm) {
        if (cm.type === 'module') {
		    _updateModuleData(modeHandler, course, cm);
        } else if (cm.type === 'info' || cm.type === 'link') {
		    _updateLinkData(modeHandler, course, cm);
        } else {
		    _updateLessonData(modeHandler, course, cm);
        }
        cm.planned_date_str = cm.planned_date ? nl.fmt.date2Str(cm.planned_date, 'date') : '';
        _updateStatusInfo(modeHandler, cm);
    }

    function _updateModuleData(modeHandler, course, cm) {
        cm.totalCount = 0;
        cm.completedCount = 0;
        cm.delayedCount = 0;
        cm.score = 0;
        cm.maxScore = 0;
        cm.scoreAvailableCount = 0;
        cm.planned_date = null;

        var children = treeList.getChildren(cm);
        for (var i=0; i<children.length; i++) {
            var child = children[i];
            _updateItemData(modeHandler, course, child);
            cm.totalCount += child.totalCount;
            cm.completedCount += child.completedCount;
            cm.delayedCount += child.delayedCount;
            cm.score += child.score;
            cm.maxScore += child.maxScore;
	        cm.scoreAvailableCount += child.scoreAvailableCount;
        	if (!cm.planned_date || child.planned_date > cm.planned_date) {
        		cm.planned_date = child.planned_date;
        	}	
        }
    }
    
    function _updateLinkData(modeHandler, course, cm) {
    	var today = new Date();
        cm.totalCount = 1;
        cm.completedCount = 0;
        cm.scoreAvailableCount = 0;
        cm.delayedCount = ($scope.planning && cm.planned_date && cm.planned_date < today) ? 1 : 0;
        cm.score = 0;
        cm.maxScore = 0;
        if (!course.statusinfo || !(cm.id in course.statusinfo)) return;

    	var statusinfo = course.statusinfo[cm.id];
    	if (statusinfo.status != 'done') return;
        cm.completedCount = 1;
        cm.delayedCount = 0;
    }
    
    function _updateLessonData(modeHandler, course, cm) {
    	var today = new Date();
        cm.totalCount = 1;
        cm.completedCount = 0;
        cm.scoreAvailableCount = 0;
    	cm.delayedCount = ($scope.planning && cm.planned_date && cm.planned_date <= today) ? 1 : 0;
        cm.score = 0;
        cm.maxScore = 0;

        if (!('refid' in cm) || !('lessonReports' in course)) return;
        var refid = cm.refid.toString();
        if (!(refid in course.lessonReports)) return;
        var lessonReport = course.lessonReports[refid];
        var completed = 'completed' in lessonReport ? lessonReport.completed : false;
        if (!completed) return;
        cm.completedCount = 1;
        cm.delayedCount = 0;

        if ('maxScore' in lessonReport) cm.maxScore = parseInt(lessonReport.maxScore);
        if ('score' in lessonReport) cm.score = parseInt(lessonReport.score);
        if (cm.maxScore > 0) cm.scoreAvailableCount = 1;
    }
    
    function _updateStatusInfo(modeHandler, cm) {
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
		    _updateStatusInfoForLeaf(modeHandler, cm);
		    return;
        }
	    _updateStatusInfoForContainer(modeHandler, cm);
	    return;
    }

    function _updateStatusInfoForLeaf(modeHandler, cm) {
        if (cm.delayedCount > 0) {
            cm.statusIcon = _icons['red'];
            cm.statusShortText = nl.t('delayed');
            cm.statusText = nl.t('delayed');
            return;
        }
        if (cm.completedCount > 0) {
            cm.statusIcon = _icons['green'];
            cm.statusShortText = nl.t('done');
            if (cm.maxScore === 0) {
	            cm.statusText = nl.t('done');
	            return;
            }
            var perc = Math.round((cm.score/cm.maxScore)*100);
            cm.statusText = (cm.score > 0) ? nl.t('done ({}%)', perc) : nl.t('done');
            return;
        }
        cm.statusIcon = _icons['yellow'];
        cm.statusShortText = nl.t('pending');
        cm.statusText = nl.t('pending');
    }
    
    function _updateStatusInfoForContainer(modeHandler, cm) {
    	if (cm.totalCount == 0) return;
    	var scoreStr = '';
    	if (cm.maxScore > 0 && cm.score > 0) {
            var perc = Math.round(cm.score/cm.maxScore*100);
    		scoreStr = cm.scoreAvailableCount > 1 ? nl.t('({}% from {} items)', perc, cm.scoreAvailableCount): nl.t('({}% from {} item)', perc, cm.scoreAvailableCount); 
    	}
        if (cm.delayedCount > 0) {
            cm.statusIcon = _icons['red'];
            cm.statusShortText = nl.t('delayed');
            cm.statusText = nl.t('{} of {} delayed {}', cm.delayedCount, cm.totalCount, scoreStr);
            return;
        }
        if (cm.completedCount < cm.totalCount) {
            cm.statusIcon = _icons['yellow'];
            cm.statusShortText = nl.t('pending');
            var pending = cm.totalCount - cm.completedCount;
            cm.statusText = nl.t('{} of {} pending {}', pending, cm.totalCount, scoreStr);
            return;
        }

        cm.statusIcon = _icons['green'];
        cm.statusShortText = nl.t('done');
        cm.statusText = cm.totalCount > 1 
        	? nl.t('all {} done {}', cm.totalCount, scoreStr) 
        	: nl.t('{} of {} done {}', cm.completedCount, cm.totalCount, scoreStr);
    }

	$scope.onClickOnSummary = function(cm) {
		if($scope.mode != 3 || (cm.type != 'link' && cm.type != 'info')) {
			_getModuleDetails(cm, _icons);
			return;
		}

		if(!modeHandler.course.statusinfo) modeHandler.course.statusinfo = {};
		var statusinfo = modeHandler.course.statusinfo;
		var isDone = (cm.id in statusinfo) && (statusinfo[cm.id].status == 'done');
		var data = {
			title: isDone ? nl.t('Confirm undo operation'): nl.t('Mark as done'),
			template: isDone ? nl.t('This is currently marked as completed. You may mark this as not completed by clicking the Undo button.'):nl.t('You may mark this as as completed by clicking Done button.'),
		   	okText: isDone ? nl.t('Undo'): nl.t('Done')};
		nlDlg.popupConfirm(data).then(function(result) {
			if (!result) return;
			_updatedStatusinfo(cm, !isDone);
		});
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
	
	function _getModuleDetails(cm, _icons) {
		var card = {};
		card.title = nl.t('Summary');
		var icon = ('icon' in cm) ? cm.icon : cm.type;
		if(icon in _icons) card.icon = _icons[icon];
		card.help = cm.name;
		card.details = {help: card.help, avps: _getModuleAvps(cm)};
    	var detailsDlg = nlDlg.create($scope);
    	detailsDlg.scope.card = card;
		detailsDlg.setCssClass('nl-height-max nl-width-max');
    	detailsDlg.show('lib_ui/cards/details_dlg.html');
	}
	
	function _getModuleAvps(cm) {
		var avps = [];
		nl.fmt.addAvp(avps, 'Status', cm.statusShortText, 'text', '-', cm.statusIcon);
		if(cm.type == 'module') {
			nl.fmt.addAvp(avps, 'Total items', cm.totalCount);
			if ($scope.planning) {
				if(cm.planned_date_str) nl.fmt.addAvp(avps, 'Maximum planned date', cm.planned_date_str);
				nl.fmt.addAvp(avps, 'Delayed items', cm.delayedCount);
			}
			nl.fmt.addAvp(avps, 'Pending items', cm.totalCount-cm.completedCount-cm.delayedCount);
			nl.fmt.addAvp(avps, 'Completed items', cm.completedCount);
			if(cm.scoreAvailableCount > 0) nl.fmt.addAvp(avps, 'Score avaialble for', cm.scoreAvailableCount);
			if(cm.maxScore > 0 && cm.score > 0) {
				nl.fmt.addAvp(avps, 'Score', nl.t("{}% ({}/{})",Math.round(cm.score/cm.maxScore*100), cm.score, cm.maxScore));
			}
			else nl.fmt.addAvp(avps, 'Score', "-");
		} else {
			if ($scope.planning) {
				nl.fmt.addAvp(avps, 'Planned date', cm.planned_date_str);
			}
			if(cm.type == 'lesson'){
				if(cm.maxScore == 0 || cm.score == 0) nl.fmt.addAvp(avps, 'Score', "-");
	 			else if(cm.score > 0) {
	 				nl.fmt.addAvp(avps, 'Score', nl.t("{}% ({}/{})",Math.round(cm.score/cm.maxScore*100), cm.score, cm.maxScore));
	 			}
			}
		}
		return avps;
	}
}];

function TreeList(nl, ID_ATTR, DELIM, VISIBLE_ON_OPEN) {
    if (ID_ATTR === undefined) ID_ATTR = 'id';
    if (DELIM === undefined) DELIM = '.';
    if (VISIBLE_ON_OPEN === undefined) VISIBLE_ON_OPEN = 10000; // Practically all levels are visible
    
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

	this.bExpanded = true;
    this.showHideAllButtonName = function() {
    	if (this.bExpanded) return nl.t('Collapse all');
    	return nl.t('Expand all');
    };
    
    this.showHideAll = function() {
    	this.bExpanded = !this.bExpanded;
    	for (var itemId in this.items) {
    		this.showHideItem(this.items[itemId], this.bExpanded);
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
    
    this.items = {};
    this.rootItems = [];
    this.children = {};
}

//-------------------------------------------------------------------------------------------------
module_init();
})();
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
	function _onPageEnter(courseInfo) {
		return nl.q(function(resolve, reject) {
		    treeList.clear();
			var params = nl.location.search();
			if (!('id' in params) || !modeHandler.initMode()) {
				nlDlg.popupStatus(nl.t('Invalid url'));
				resolve(false);
				return;
			}
			$scope.showStatusIcon = modeHandler.shallShowScore();
			var courseId = parseInt(params.id);
			modeHandler.getCourse().then(function(course) {
				modeHandler.initTitle(course);
				var content = course.content;
				for(var i=0; i<content.length; i++) {
					_initModule(content[i]);
				}
     			var rootItems = treeList.getRootItems();
                for(var i=0; i<rootItems.length; i++) {
                    _initModuleScores(modeHandler, course, rootItems[i]);
                }
     			$scope.content = content;
				resolve(true);
			}, function(error) {
			    resolve(false);
			});
		});
	}

	nlRouter.initContoller($scope, '', _onPageEnter);

	$scope.showHideAllButtonName = treeList.showHideAllButtonName();
	$scope.showHideAll = function() {
		treeList.showHideAll();
		$scope.showHideAllButtonName = treeList.showHideAllButtonName();
    };
	
    $scope.getIndentation = function(cm) {
        var ret = [];
        for (var i=0; i<cm.indentationLevel; i++) ret.push(i);
        return ret;
    };
    
	$scope.getIcon = function(cm) {
		var icon = ('icon' in cm) ? cm.icon : cm.type;
		if (icon in _icons) return _icons[icon];
		return icon;
	};
	
    $scope.getNewTabIcon = function(getNewTabIcon) {
        return _icons['newtab'];
    };

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
	
	var _icons = {
        'newtab': nl.url.resUrl('launch.png'),
        'module': nl.url.resUrl('folder.png'),
		'lesson': nl.url.resUrl('lesson2.png'),
		'quiz': nl.url.resUrl('quiz.png'),
		'info': nl.url.resUrl('info.png'),
		'link': nl.url.resUrl('file.png')
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
		var props = (cm.type in _moduleProps) ? _moduleProps[cm.type] : _defModuleProps;
		cm.clickable = props.clickable;
        cm.launchable = props.launchable;
	}

    function _initModuleScores(modeHandler, course, cm) {
        if (cm.type === 'module') {
            cm.totalCount = 0;
            cm.completedCount = 0;
            cm.score = 0;
            cm.maxScore = 0;

            var children = treeList.getChildren(cm);
            for (var i=0; i<children.length; i++) {
                var child = children[i];
                _initModuleScores(modeHandler, course, child);
                cm.totalCount += child.totalCount;
                cm.completedCount += child.completedCount;
                cm.score += child.score;
                cm.maxScore += child.maxScore;
            }
            _updateStatusIcomAndScoreText(modeHandler, cm);
            return;
        }
        
        cm.totalCount = 1;
        cm.completedCount = 0;
        cm.score = 0;
        cm.maxScore = 0;

        if (!('refid' in cm) || !('lessonReports' in course)) return;
        var refid = cm.refid.toString();
        if (!(refid in course.lessonReports)) return;
        var lessonReport = course.lessonReports[refid];
        var completed = 'completed' in lessonReport ? lessonReport.completed : false;
        if (!completed) return;
        cm.completedCount = 1;

        if ('maxScore' in lessonReport) cm.maxScore = parseInt(lessonReport.maxScore);
        if ('score' in lessonReport) cm.score = parseInt(lessonReport.score);
        _updateStatusIcomAndScoreText(modeHandler, cm);
    }

    function _updateStatusIcomAndScoreText(modeHandler, cm) {
        if (!modeHandler.shallShowScore()) {
            cm.statusIcon = null;
            cm.statusText = nl.t('Contains {} learning modules.', cm.totalCount);
            return;
        }
        if (cm.totalCount > 0) {
            if (cm.completedCount > 0) cm.statusIcon = nl.url.resUrl('general/partial.png');
            if (cm.completedCount == cm.totalCount) cm.statusIcon = nl.url.resUrl('general/tick.png');
        }
        cm.statusText = '';
        if (cm.totalCount > 0 && cm.type === 'module') {
            cm.statusText = nl.t('{} of {} completed. ', cm.completedCount, cm.totalCount);
        }
        if (cm.completedCount > 0 && cm.maxScore > 0) {
            var perc = Math.round(cm.score/cm.maxScore*100);
            cm.statusText += nl.t('{}% (Score: {} out of {}).', perc, cm.score, cm.maxScore);
        }
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
    	if (this.bExpanded) return nl.t('Collapse All');
    	return nl.t('Expand All');
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
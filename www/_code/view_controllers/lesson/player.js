(function() {

//-------------------------------------------------------------------------------------------------
// player.js:
// Lesson player module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.lesson.player', [])
    .directive('nlPlayer', PlayerDirective);
}

//-------------------------------------------------------------------------------------------------
var PlayerDirective = ['nl', 'nlScrollbarSrv', 'nlServerApi', 'nlLessonHelperSrv',
function(nl, nlScrollbarSrv, nlServerApi, nlLessonHelperSrv) {
    return {
        restrict: 'E',
        transclude: true,
        scope : {
            lessonId: '=',
            launchCtx: '@',
            pgInfo: '='
        },
        templateUrl: 'view_controllers/lesson/player_directive.html',
        link: function($scope, iElem, iAttrs) {
            _initMenus(nl, $scope.$parent, $scope);
            $scope.lesson = null;
            $scope.bgImgUrl = null;
            nlServerApi.getLesson($scope.lessonId).then(function(oLesson) {
                nl.log.debug('Got the lesson', oLesson);

                $scope.lesson = new Lesson(oLesson, $scope.launchCtx);
                
                var bgInfo = nlLessonHelperSrv.getBackgroundUrlInfo(oLesson.template);
                iElem.addClass(bgInfo.bgShade);
                $scope.bgImgUrl = bgInfo.url;

                nlScrollbarSrv.setTotal($scope.lesson.pages.length);
                nlScrollbarSrv.gotoPage(1);
            });

            $scope.onLoaded = function() {
                // TODO - is this needed?
            };
            nl.router.onViewEnter($scope.$parent, function() {
                nl.log.debug('PlayerDirective: view enter');
                if ($scope.lesson == null) return;
                nlScrollbarSrv.setTotal($scope.lesson.pages.length);
                nlScrollbarSrv.gotoPage(1);
            });
            
         }
    };
}];

function _initMenus(nl, $scope, $dirScope) {
    nl.menu.onViewEnter($scope, function() {
        nl.menu.addViewMenuItem('Change to preview mode (Alt+T)', 'toolbar-edit/toggle.png', function() {
            // TODO
            $dirScope.lesson.changeMode();
        });
        nl.menu.addViewMenuItem('Add Page (Alt+Insert)', 'toolbar-edit/addpage.png', function() {
            // TODO
        });
        nl.menu.addViewMenuItem('Delete/Cut Page (Alt+Del)', 'toolbar-edit/delpage.png', function() {
            // TODO
        });
        nl.menu.addViewMenuItem('Change Page type', 'toolbar-edit/changepagetype.png', function() {
            // TODO
        });
        nl.menu.addViewMenuItem('Page Properties (Alt-P)', 'toolbar-edit/pageprops.png', function() {
            // TODO
        });
        nl.menu.addViewMenuItem('Page Organizer (Alt+O)', 'toolbar-edit/pageorg.png', function() {
            // TODO
        });
        nl.menu.addViewMenuItem('Lesson Properties', 'toolbar-edit/props.png', function() {
            // TODO
        });
        nl.menu.addViewMenuItem('Change Look', 'toolbar-edit/look.png', function() {
            // TODO
        });
        nl.menu.addViewMenuItem('Save (Ctrl+S)', 'toolbar-edit/save.png', function() {
            // TODO
        });
        nl.menu.addViewMenuItem('Manage Comments', 'toolbar-edit/comments1.png', function() {
            // TODO
        });
        nl.menu.addViewMenuItem('Invite for Review', 'toolbar-edit/revinvite.png', function() {
            // TODO
        });
        nl.menu.addViewMenuItem('Approve', 'toolbar-edit/approve.png', function() {
            // TODO
        });
        nl.menu.addViewMenuItem('Insert Image', 'toolbar-edit/addimage.png', function() {
            // TODO
        });
        nl.menu.addViewMenuItem('Raw Edit', 'toolbar-edit/raw.png', function() {
            // TODO
        });
    });
}

//-------------------------------------------------------------------------------------------------
// Helpers
function _launchMode(lesson, checkValues) {
    for(var i=0; i<checkValues; i++) {
        if (checkValues[i] == lesson.launchCtx) return true;
    }
    return false;
}

//-------------------------------------------------------------------------------------------------
function Lesson(oLesson, launchCtx) {
    _Lesson_init(this, oLesson, launchCtx);
    this.changeMode = _Lesson_changeMode;
}

function _Lesson_init(self, oLesson, launchCtx) {
    self.oLesson = oLesson;
    self.launchCtx = launchCtx;
    self.pages = [];
    
    for (var i = 0; i < self.oLesson.pages.length; i++) {
        self.pages.push(new Page(self, self.oLesson.pages[i]));
    }

    self.showView = true;
    self.showText = false;
}

function _Lesson_changeMode() {
    var self = this;
    self.showText = self.showView;
    self.showView = !self.showView;
}

//-------------------------------------------------------------------------------------------------
function Page(lesson, oPage) {
    _Page_init(this, lesson, oPage);
}

function _Page_init(self, lesson, oPage) {
    self.lesson = lesson;
    self.oPage = oPage;
    self.pt = new PageTypeDummy(lesson, oPage);
    self.sections = [];
    
    var len = self.oPage.sections.length;
    var neededLen = self.pt.getSectionCount();

    // add sections if needed
    for (var i = len; i < neededLen; i++) {
        self.oPage.sections.push({type: 'txt', text:''});
    }

    // remove extra sections if present
    if (len > neededLen) {
        self.oPage.sections.splice(neededLen, len - neededLen);
    }
    
    self.sectionCreateOrder = _randSet(neededLen, self.pt.getRandomizableElems());
    for (var i = 0; i < neededLen; i++) {
        var so = new Section(self.lesson, self, self.oPage.sections[i], i, self.sectionCreateOrder[i]);
        self.sections.push(so);
    }
}

function _randSet(nSize, randPosArray) {
    var ret = [];
    for (var i = 0; i < nSize; i++) {
        ret.push(i);
    }

    var randLen = randPosArray.length;
    for (var pos = 0; pos < randLen; pos++) {
        var i = randPosArray[pos];
        var j = randPosArray[Math.floor(Math.random() * randLen)];
        var temp = ret[j];
        ret[j] = ret[i];
        ret[i] = temp;
    }

    return ret;
}

//-------------------------------------------------------------------------------------------------
function Section(lesson, page, oSection, secNo, secPosShuffled) {
    _Section_init(this, lesson, page, oSection, secNo, secPosShuffled);
}

function _Section_init(self, lesson, page, oSection, secNo, secPosShuffled) {
    self.lesson = lesson;
    self.page = page;
    self.oSection = oSection;

    // No shuffle in edit and report mode
    if (_launchMode(self.lesson, ['report', 'edit'])) secPosShuffled = secNo;
    
    self.secNo = secNo; // Original position
    self.secPosShuffled = secPosShuffled; // Position after randomizing
    self.styleAlign = self.page.pt.getSectionHalign(self.secNo);
    self.styleTextPos = self.page.pt.getSectionPos(self.secNo);
    self.styleViewPos = self.page.pt.getSectionPos(self.secPosShuffled);
}

//-------------------------------------------------------------------------------------------------
function PageTypeDummy(lesson, oPage) {

    this.getSectionCount = function() {
        return layout.length;
    };

    this.getRandomizableElems = function() {
        return [1,2,3,4];
    };

    this.getSectionHalign = function(secNo) {
        return _align('left');
    };
    
    this.getSectionPos = function(secNo) {
        if (secNo >= layout.length) return _posNone();
        var secInfo = layout[secNo];
        return _pos(secInfo['t'], secInfo['l'], secInfo['h'], secInfo['w']);
    };

    var layout = [{'t':   0, 'l':   0, 'h':  18, 'w': 100},
                  {'t':  22, 'l':   0, 'h':  37, 'w':  32},
                  {'t':  22, 'l':  68, 'h':  37, 'w':  32},
                  {'t':  63, 'l':   0, 'h':  37, 'w':  32},
                  {'t':  63, 'l':  68, 'h':  37, 'w':  32},
                  {'t':  22, 'l':  34, 'h':  78, 'w':  32}];

    function _align(alignment) {
        return {'text-align' : alignment};
    }

    function _pos(t, l, h, w) {
        return {top: t + '%', left: l + '%', height: h + '%', width: w + '%'};
    }
    
    function _posNone() {
        return {display: 'none'};
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
}());

(function() {

//-------------------------------------------------------------------------------------------------
// Lesson module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.lesson', [])
    .config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
        config($stateProvider, $urlRouterProvider);
    }])
    .controller('nl.LessonListCtrl', LessonListCtrl)
    .controller('nl.LessonCreateCtrl', LessonCreateCtrl)
    .controller('nl.LessonCtrl', LessonCtrl)
    .directive('nlLesson', LessonDirective);
}

//-------------------------------------------------------------------------------------------------
function config($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.lesson_create', {
        url : "/lesson_create",
        views : {
            'appContent' : {
                templateUrl : "controllers/lesson/lesson_create.html",
                controller : 'nl.LessonCreateCtrl'
            }
        }
    });
    $stateProvider.state('app.lesson_approved', {
        url : "/lesson/:listtype",
        views : {
            'appContent' : {
                templateUrl : "ui/cardsview.html",
                controller : 'nl.LessonListCtrl'
            }
        }
    });
    $stateProvider.state('app.lesson_view', {
        url : "/lesson_view/:lessonId",
        views : {
            'appContent' : {
                templateUrl : "controllers/lesson/lesson_view.html",
                controller : 'nl.LessonCtrl'
            }
        }
    });
}

//-------------------------------------------------------------------------------------------------
var LessonListCtrl = ['nlLog', 'nlRes', 'nlDb', '$scope', 
function(nlLog, nlRes, nlDb, $scope) {
    $scope.title = 'View Approved Lessons';
    $scope.cards = [];
    for(var key=0; key<10; key++) {
        var card = {title:'Lesson ' + key, icon: nlRes.dashboardIcon('lesson.png'), url:'#/app/lesson_view/' + key};
        card.desc = 'Description of lesson ' + key;
        $scope.cards.push(card);
    }

    var db = nlDb.get();
    var q = db.keys('lesson').then(function(keys) {
        $scope.$apply(function() {
            console.log('keys', keys);
            
            for(var i=0; i<keys.length; i++) {
                var key = keys[i];
                var card = {title:'Lesson ' + key, icon: nlRes.dashboardIcon('lesson.png'), url:'#/app/lesson_view/' + key};
                card.desc = 'Description of lesson ' + key;
                $scope.cards.push(card);
            }
        });
    }); 
}];

//-------------------------------------------------------------------------------------------------
var LessonCreateCtrl = ['nlLog', 'nlRes', 'nlDb', '$scope', 
function(nlLog, nlRes, nlDb, $scope) {
    $scope.lessonId = 0;
    
    $scope.content = getSampleContent();
    $scope.message = '';
    $scope.create = function() {
        var lessonId = this.lessonId;
        var content = this.content;
        $scope.message = 'Writing to db ' + lessonId;
        var db = nlDb.get();
        db.put('lesson', {id:lessonId, updated: 'right now!!', content: content}, lessonId)
        .then(function(key) {
            $scope.message = 'wrote to db ' + key;         
        }, function(e) {
            $scope.message = 'error writing to db ' +  e.stack;         
        });
    };
}];

function getSampleContent() {
    var l={};
    l.name = 'Lesson Name';
    l.image = 'http://www.clker.com/cliparts/e/a/5/b/11949846051211496895blacksmiti_ganson.svg.med.png';
    l.subject = "Subject 1";
    l.description = 'Lesson description';
    l.pages = [];
    for(var i=0; i<10; i++) {
        l.pages.push({pageId:i, type:'2S50', sections:[{type:'txt', text: 'section text'}, {type:'txt', text: 'section text'}, {type:'txt', text: 'section text'}]});
    }
    return angular.toJson(l);
}

//-------------------------------------------------------------------------------------------------
var LessonCtrl = ['nlLog', 'nlRes', 'nlDb', '$scope', '$stateParams',
function(nlLog, nlRes, nlDb, $scope, $stateParams) {
    var id = parseInt($stateParams.lessonId);
    nlLog.debug('Enter LessonCtrl: ' + id);
    $scope.content = null;

    var db = nlDb.get();
    db.get('lesson', id).then(function(record) {
        if (record !== undefined) {
            $scope.content = angular.fromJson(record.content);
            console.log(record.content);
        } else {
            $scope.content = 'Loading failed.';
        }
    }, function(e) {
        $scope.content = 'Error reading db: ' +  e.stack;
   });
}];

//-------------------------------------------------------------------------------------------------
var LessonDirective = ['$timeout', 'nlUtils', 'nlPageNoSrv', 'nlScrollbarSrv',
function($timeout, nlUtils, nlPageNoSrv, nlScrollbarSrv) {
    return {
        restrict: 'E',
        transclude: true,
        scope : {
            content: '=',
            pageNoData: '='
        },
        templateUrl: 'controllers/lesson/lesson_directive.html',
        link: function($scope, iElem, iAttrs) {
            $scope.onLoaded = function() {
                console.log('onLoaded called');
                nlScrollbarSrv.setTotal($scope.content.pages.length);
                nlScrollbarSrv.gotoPage(1);
            };
            nlUtils.onViewEnter($scope.$parent, function() {
                console.log('view enter');
                if ($scope.content == null) return;
                nlScrollbarSrv.setTotal($scope.content.pages.length);
                nlScrollbarSrv.gotoPage(1);
            });
         }
    };
}];

var LessonDirectiveController = ['nlLog', '$scope', 
function(nlLog, $scope) {
    $scope.player = new LessonPlayer($scope, nlLog);
    $scope.onClick = function(index) {
        nlLog.debug('nl-lesson directive: $scope.onClick - ' + index);
    };
    $scope.onKeyDown = function($event) {
        nlLog.debug('nl-lesson directive: Key press: ' + $event.keyCode);
        if ($event.keyCode === 38) $scope.player.pageUp();
        if ($event.keyCode === 40) $scope.player.pageDown();
        $event.stopImmediatePropagation();
    };
}];

function LessonPlayer($scope, nlLog) {
    this.currentPage = 0;
    
    this.pageUp = function() {
        this.moveToPage(this.currentPage-1);
    };
    
    this.pageDown = function() {
        this.moveToPage(this.currentPage+1);
    };
    
    this.moveToPage = function(pageNo) {
        if (!$scope.content) return;
        if (pageNo < 0 || pageNo >= $scope.content.pages.length) return;
        this.currentPage = pageNo;
        nlLog.debug('moveToPage: ' + this.currentPage);
    };
}

//-------------------------------------------------------------------------------------------------
module_init();
}());

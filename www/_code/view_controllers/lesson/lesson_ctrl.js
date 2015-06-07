(function() {

//-------------------------------------------------------------------------------------------------
// lesson_ctrl.js:
// Controllers at lesson level
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.lesson_ctrl', [])
    .config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
        config($stateProvider, $urlRouterProvider);
    }])
    .controller('nl.LessonCreateCtrl', LessonCreateCtrl)
    .controller('nl.LessonCtrl', LessonCtrl);
}

//-------------------------------------------------------------------------------------------------
function config($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.lesson_create', {
        url : '/lesson_create',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/lesson/lesson_create.html',
                controller : 'nl.LessonCreateCtrl'
            }
        }
    });
    $stateProvider.state('app.lesson_view', {
        url : '/lesson_view/:lessonId',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/lesson/player.html',
                controller : 'nl.LessonCtrl'
            }
        }
    });
}

//-------------------------------------------------------------------------------------------------
var LessonCreateCtrl = ['nl', '$scope', '$rootScope', 'nlDummy',
function(nl, $scope, $rootScope, nlDummy) {
    nl.pginfo.pageTitle = nl.t('Create new lesson');
    $scope.lessonId = 0;
    
    $scope.content = angular.toJson(nlDummy.getSampleContent(0));
    $scope.message = '';
    $scope.create = function() {
        var lessonId = this.lessonId;
        var content = angular.fromJson(this.content);
        $scope.message = 'Writing to db ' + lessonId;
        var db = nl.db.get();
        db.put('lesson', content, lessonId)
        .then(function(key) {
            $scope.message = 'wrote to db ' + key;         
        }, function(e) {
            $scope.message = 'error writing to db ' +  e.stack;         
        });
    };
}];

//-------------------------------------------------------------------------------------------------
var LessonCtrl = ['nl', '$scope', '$rootScope', '$stateParams',
function(nl, $scope, $rootScope, $stateParams) {
    nl.pginfo.pageTitle = nl.t('View lesson');
    $scope.lessonId = parseInt($stateParams.lessonId);
    nl.log.debug('Enter LessonCtrl: ' + $scope.lessonId);

    nl.menu.onViewEnter($scope, function() {
        nl.menu.addViewMenuItem('Change to preview mode (Alt+T)', 'toolbar-edit/toggle.png', function() {
            // TODO
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



}];

//-------------------------------------------------------------------------------------------------
module_init();
}());

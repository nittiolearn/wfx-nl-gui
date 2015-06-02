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
    $rootScope.pageTitle = nl.t('Create new lesson');
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
    $rootScope.pageTitle = nl.t('View lesson');
    $scope.lessonId = parseInt($stateParams.lessonId);
    nl.log.debug('Enter LessonCtrl: ' + $scope.lessonId);
}];

//-------------------------------------------------------------------------------------------------
module_init();
}());

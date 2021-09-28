(function() {

//-------------------------------------------------------------------------------------------------
// module.js:
// player html module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.module', []).config(configFn)
    .controller('nl.LessonPlayer', LessonPlayerCtrl)
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.module', {
        url : '^/module',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/module/player.html',
                controller : 'nl.LessonPlayer'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var LessonPlayerCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi',
function(nl, nlRouter, $scope, nlServerApi) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            var params = nl.location.search();
            var plType = ('type' in params) ? params.type : null;
            var lessonid = ('id' in params) ? params.id : null;
            nl.pginfo.pageTitle = nl.t('Home Dashboard');
            var data = {type: plType, id: lessonid};
            nlServerApi.getPlayer(data).then(function(lesson) {
                nl.pginfo.pageSubTitle = '';
                $scope.result = lesson;
                resolve(true);
            });
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
}];
//-------------------------------------------------------------------------------------------------
module_init();
})();

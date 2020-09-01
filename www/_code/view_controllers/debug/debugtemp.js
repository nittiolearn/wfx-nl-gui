(function() {

//-------------------------------------------------------------------------------------------------
// debugtemp.js:
// Temp module for experimentation
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.debugtemp', [])
    .config(configFn)
    .controller('nl.DebugTempCtrl', DebugTempCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider',
function($stateProvider) {
    $stateProvider.state('app.debugtemp', {
        url : '^/debugtemp',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/debug/debugtemp.html',
                controller : 'nl.DebugTempCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var DebugTempCtrl = ['nl', 'nlRouter', '$scope',
function(nl, nlRouter, $scope) {
    var _userInfo = null;

    function _onPageEnter(userInfo) {
        _userInfo = userInfo;
        return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Debug Temp');
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);

}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

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
var DebugTempCtrl = ['nl', 'nlDlg', 'nlRouter', '$scope',
function(nl, nlDlg, nlRouter, $scope) {
    var _userInfo = null;

    function _onPageEnter(userInfo) {
        _userInfo = userInfo;
        return nl.q(function(resolve, reject) {
        $scope.labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        $scope.type = 'StackedBar';
        $scope.series = ['2015', '2016'];
        $scope.options = {
          scales: {
            xAxes: [{
              stacked: true,
              gridLines: {
                display: true ,
                color: "#FFFFFF"
              }
            }],
            yAxes: [{
              stacked: true,
              gridLines: {
                display: true ,
                color: "#FFFFFF"
              }
            }]
          }
        };
    
        $scope.data = [
          [65, 59, 90, 81, 56, 55, 40],
          [28, 48, 40, 19, 96, 27, 100]
        ];
        resolve(true);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);

}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

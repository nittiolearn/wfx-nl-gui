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
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
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
var DebugTempCtrl = ['nl', 'nlRouter', '$scope', '$ionicLoading', 'nlExpressionProcessor',
function(nl, nlRouter, $scope, $ionicLoading, nlExpressionProcessor) {
    $scope.exp_test_attrs = nlExpressionProcessor.getTestAttrs();
    $scope.exp_test_data = nlExpressionProcessor.test();
    var spinners = ["ios", "ios-small", "lines", "ripple", "spiral", "bubbles", "circles", "crescent", "dots"];
    
    function _updateSpinnerSelect() {
        $scope.options = {spinner: []};
        for (var i=0; i<spinners.length; i++) {
            $scope.options.spinner.push({id: spinners[i], name: spinners[i]});
        }
        $scope.data = {spinner: {id: spinners[0]}};
        $scope.data.duration = 5000;
    };
    
    var chartInfo = new ChartInfo(nl);
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Debug Temp');
            chartInfo.setChartInfo($scope);
            _updateSpinnerSelect();
            resolve(true);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
    $scope.showLoading = function() {
        var template = '<div class="nl-spinner"></div>';
        $ionicLoading.show({template: template, hideOnStateChange: false});
        nl.timeout(function() {
            $ionicLoading.hide();
        }, $scope.data.duration);
    };

}];

function ChartInfo(nl) {
    this.setChartInfo = function($scope) {
        var ret = {};
        ret.labels = ["January", "February", "March", "April", "May", "June", "July"];
        ret.series = ['Series A', 'Series B'];
        ret.data = this.getRandomData();
        var self = this;
        ret.onClick = function (points, evt) {
            console.log(points, evt);
            nl.timeout(function () {
                $scope.chartInfo.data = self.getRandomData();
            }, 0);
        };
        $scope.chartInfo = ret;
    };
    
    this.getRandomData = function() {
        return [
                this.getRandomArray(20, 90, 7),
                this.getRandomArray(30, 70, 7)
            ];
    };

    this.getRandomArray = function(min, max, count) {
        var ret = [];
        for(var i=0; i<count; i++) {
            var rand = _getRandom(min, max);
            ret.push(rand);
        }
        return ret;
    };
    
}

function _getRandom(min, max) {
    return Math.floor((Math.random() * (max - min + 1)) + min);
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

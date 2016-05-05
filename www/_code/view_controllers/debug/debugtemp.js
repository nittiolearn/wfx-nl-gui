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
var configFn = ['$stateProvider', '$urlRouterProvider', 'ChartJsProvider',
function($stateProvider, $urlRouterProvider, ChartJsProvider) {
    $stateProvider.state('app.debugtemp', {
        url : '^/debugtemp',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/debug/debugtemp.html',
                controller : 'nl.DebugTempCtrl'
            }
        }
    });
    _chartInfoInit(ChartJsProvider);
}];

//-------------------------------------------------------------------------------------------------
var DebugTempCtrl = ['nl', 'nlRouter', '$scope',
function(nl, nlRouter, $scope) {
    var chartInfo = new ChartInfo(nl);
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Debug Temp');
            chartInfo.setChartInfo($scope);
            resolve(true);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
}];

function _chartInfoInit(ChartJsProvider) {
    ChartJsProvider.setOptions({
      colours: ['#FF5252', '#FF8A80'],
      responsive: false
    });
    // Configure all line charts
    ChartJsProvider.setOptions('Line', {
      datasetFill: false
    });
}

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
            var rand = Math.floor((Math.random() * (max - min + 1)) + min);
            ret.push(rand);
        }
        return ret;
    };
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

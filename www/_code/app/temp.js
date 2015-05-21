(function() {

//-------------------------------------------------------------------------------------------------
// UI collection module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.temp', [])
    .config(configFn)
    .controller('nl.TempCtrl', TempCtrl)
    .directive('nlT1', T1Directive)
    .directive('nlTemp1', createTempDirective('nlTemp1'))
    .directive('nlTemp2', createTempDirective('nlTemp2'))
    .directive('nlTemp3', createTempDirective('nlTemp3'));
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.temp', {
        url : "/temp",
        views : {
            'appContent' : {
                templateUrl : "app/temp.html",
                controller : 'nl.TempCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var TempCtrl = ['nlLog', 'nlRes', '$scope', '$stateParams', '$location', 
function(nlLog, nlRes, $scope, $stateParams, $location) {
    $scope.count = [1,2,3];
}];

//-------------------------------------------------------------------------------------------------
var T1Directive = ['$window',
function($window) {
    return {
        restrict: 'A',
        transclude: true,
        templateUrl: 'ui/pagescroll.html',
        link: function(scope, iElem, iAttrs) {
            angular.element($window).on('resize', function() {
                console.log('div resized');
            });
            console.log('nl-t1 scope:', scope.count);
        }
    };
}];

//-------------------------------------------------------------------------------------------------
function createTempDirective(name) {
    return function() {
        return {
            restrict : 'E',
            link : function(scope, iElem, iAttrs) {
                console.log(name + ': post link');
            }
        };
    };
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

(function() {

//-------------------------------------------------------------------------------------------------
// ui_utils.js:
// Collection of assorted ui utilities
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.utils', ['nl.ui.keyboard'])
    .directive('nlLoading', LoadingDirective)
    .directive('nlNoCtxMenu', NoCtxMenuDirective)
    .directive('nlRetainAr', RetainArDirective);
}

//-------------------------------------------------------------------------------------------------
var LoadingDirective = ['nl', '$window', '$ionicLoading', '$parse',
function(nl, $window, $ionicLoading, $parse) {
    return {
        restrict: 'A',
        scope: {
            'nlLoading': '=',
            'nlLoadDone': '='
        },
        link: function($scope, iElem, iAttrs) {
            nl.log.debug('link of LoadingDirective');
            if (!$scope.nlLoading) {
                $ionicLoading.show({
                    templateUrl : 'lib_ui/utils/waiting.html'
                });
            }
            var unregister = $scope.$watch('nlLoading', function(newVal, oldVal) {
                nl.log.debug('Watch success: ', newVal, oldVal);
                if (newVal) {
                    $ionicLoading.hide();
                    unregister();
                    $parse($scope.nlLoadDone)();
                }
            });
            
        }
    };
}];

//-------------------------------------------------------------------------------------------------
var NoCtxMenuDirective = ['nl', '$window',
function(nl, $window) {
    return {
        restrict: 'A',
        link: function(scope, iElem, iAttrs) {
            iElem.off('contextmenu');
            iElem.on('contextmenu', function(event) {
                event.preventDefault();
                return false;
            });
        }
    };
}];

//-------------------------------------------------------------------------------------------------
var RetainArDirective = ['nl', '$window',
function(nl, $window) {
    return {
        restrict: 'A',
        transclude: true,
        link: function(scope, iElem, iAttrs) {
        }
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

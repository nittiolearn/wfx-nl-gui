(function() {

//-------------------------------------------------------------------------------------------------
// ui_utils.js:
// Collection of assorted ui utilities
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.utils', ['nl.ui.keyboard'])
    .service('nlUi', UIService)
    .directive('nlLoading', LoadingDirective)
    .directive('nlNoCtxMenu', NoCtxMenuDirective)
    .directive('nlRetainAr', RetainArDirective)
    .directive('nlFocusMe', FocusMeDirective);
}

//-------------------------------------------------------------------------------------------------
var UIService = ['nl', '$window', 'nlDlg', '$parse',
function(nl, $window, nlDlg, $parse) {
}];

//-------------------------------------------------------------------------------------------------
var LoadingDirective = ['nl', '$window', 'nlDlg', '$parse',
function(nl, $window, nlDlg, $parse) {
    return {
        restrict: 'A',
        scope: {
            'nlLoading': '=',
            'nlLoadDone': '='
        },
        link: function($scope, iElem, iAttrs) {
            nl.log.debug('link of LoadingDirective');
            if (!$scope.nlLoading) {
                nlDlg.showLoadingScreen();
            }
            var unregister = $scope.$watch('nlLoading', function(newVal, oldVal) {
                nl.log.debug('Watch success: ', newVal, oldVal);
                if (newVal) {
                    nlDlg.hideLoadingScreen();
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
                if (event) event.preventDefault();
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
var FocusMeDirective = ['nl',
function(nl) {
    return {
        restrict: 'A',
        link: function(scope, iElem, iAttrs) {
          scope.$watch(iAttrs.nlFocusMe, function(value) {
              if(value === true) {
                  console.log('nl-focusme: value=',value);
                  nl.timeout(function() {
                      iElem[0].focus();
                      scope[iAttrs.focusMe] = false;
                  });
            }
          });
        }
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

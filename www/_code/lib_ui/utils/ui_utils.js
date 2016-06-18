(function() {

//-------------------------------------------------------------------------------------------------
// ui_utils.js:
// Collection of assorted ui utilities
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.utils', ['nl.ui.keyboard'])
	.directive('nlCompile', Compile)
    .directive('nlLoading', LoadingDirective)
    .directive('nlNoCtxMenu', NoCtxMenuDirective)
    .directive('nlRetainAr', RetainArDirective)
    .directive('nlFocusMe', FocusMeDirective)
    .directive('nlProgressLog', ProgressLogDirective)
    .service('nlProgressLog', ProgressLogSrv);
}

//-------------------------------------------------------------------------------------------------
var Compile = ['nl', '$compile',
function(nl, $compile) {
    return function(scope, element, attrs) {
        scope.$watch(
            function(scope) {
                // watch the 'compile' expression for changes
                return scope.$eval(attrs.nlCompile);
            },
            function(value) {
                // when the 'compile' expression changes
                // assign it into the current DOM
                element.html(value);

                // compile the new DOM and link it to the current
                // scope.
                // NOTE: we only compile .childNodes so that
                // we don't get into infinite loop compiling ourselves
                $compile(element.contents())(scope);
            }
        );
    };
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
var ProgressLogDirective = ['nl',
function(nl) {
    return {
        restrict: 'E',
        templateUrl: 'lib_ui/utils/progress_log.html'
    };
}];

var ProgressLogSrv = ['nl',
function(nl) {
    this.create = function(parentScope) {
        var pl = new ProgressLog(nl);
        parentScope.progressLog = pl.progressLog;
        return pl;
    };
}];

//-------------------------------------------------------------------------------------------------
function ProgressLog(nl) {
    this.progressLog = {logs: [], currentMessage: '', details: false};

    this.showLogDetails = function(bDetails) {
        this.progressLog.details = bDetails;
    };

    this.error = function(title, details) {
        this._log('error', title, details);
    };

    this.info = function(title, details) {
        this._log('info', title, details);
    };

    this.debug = function(title, details) {
        this._log('debug', title, details);
    };

    this._log = function(status, title, details) {
        if (!details) details ='';
        var ts = nl.fmt.date2Str(new Date(), 'milli');
        this.progressLog.logs.push({status:status, ts:ts, title:title, details:details, expanded:false});
        this.progressLog.currentMessage = title;
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();
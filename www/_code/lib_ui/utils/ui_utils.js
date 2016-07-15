(function() {

//-------------------------------------------------------------------------------------------------
// ui_utils.js:
// Collection of assorted ui utilities
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.utils', ['nl.ui.keyboard'])
    .filter('nlDateStr', NlDateStr)
	.directive('nlCompile', Compile)
    .directive('nlLoading', LoadingDirective)
    .directive('nlNoCtxMenu', NoCtxMenuDirective)
    .directive('nlRetainAr', RetainArDirective)
    .directive('nlFocusMe', FocusMeDirective)
    .directive('nlProgressLog', ProgressLogDirective)
    .service('nlProgressLog', ProgressLogSrv);
}

//-------------------------------------------------------------------------------------------------
var NlDateStr = ['nl', '$filter',
function(nl, $filter) {
    function _fmtDateStr(dateStr, format, timezone) {
        var newDate = nl.fmt.json2Date(dateStr);
        var ret = $filter('date')(newDate, format, timezone);
        return ret;
    }
    return _fmtDateStr;
}];

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

var ProgressLogSrv = ['nl', '$filter', 'nlExporter',
function(nl, $filter, nlExporter) {
    this.create = function(parentScope) {
        var pl = new ProgressLog(nl, $filter, nlExporter);
        parentScope.progressLog = pl.progressLog;
        return pl;
    };
}];

//-------------------------------------------------------------------------------------------------
function ProgressLog(nl, $filter, nlExporter) {
    var searchLevels = ['error', 'imp', 'warn', 'info', 'debug'];
    var searchLevelsPrio = {error: 5, imp: 4, warn: 3, info: 2, debug: 1};
        
    var search = {filter: '', level: 'debug', levels: searchLevels};
    this.progressLog = {progress: 0, logs: [], currentMessage: '', showLogs: false, search: search};
    var self = this;
    
    this.progressLog.canShow = function(log) {
        var logLevel = searchLevelsPrio[log.status];
        var searchLevel = searchLevelsPrio[self.progressLog.search.level];
        if (logLevel < searchLevel) return false;
        if (!self.progressLog.search.filter) return true;
        if (log.title.indexOf(self.progressLog.search.filter) >= 0) return true;
        if (log.details.indexOf(self.progressLog.search.filter) >= 0) return true;
        return false;
    };
    
    this.progressLog.expandAll = function(log) {
        var logs = self.progressLog.logs;
        for(var l in logs) 
            if (logs[l].details) logs[l].expand = true;
    };
    
    this.progressLog.collapseAll = function(log) {
        var logs = self.progressLog.logs;
        for(var l in logs) 
            logs[l].expand = false;
    };
    
    this.progressLog.onLogSave = function() {
        var ret = '';
        for(var l in self.progressLog.logs) {
            var log = self.progressLog.logs[l];
            var row = nl.fmt2('{}, {}, {}\r\n', log.status, log.ts, log.title);
            if (log.details) row += nl.fmt2('{}\r\n', log.details);
            ret += row;
        }
        nlExporter.exportTextFile("progress-log.txt", ret);
    };
    
    this.showLogDetails = function(bShowLogs) {
        this.progressLog.showLogs = bShowLogs;
    };

    this.getSearchInfo = function() {
        return this.progressLog.serch;
    };

    this.progress = function(perc) {
        perc = Math.round(perc);
        this.progressLog.progress = perc;
    };
    
    this.error = function(title, details) {
        this._log('error', title, details);
    };

    this.imp = function(title, details) {
        this._log('imp', title, details);
    };

    this.warn = function(title, details) {
        this._log('warn', title, details);
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
        this.progressLog.logs.push({status:status, ts:ts, title:title, 
            details:details, expand:false});
        if (status != 'error' && status != 'imp') return;
        this.progressLog.currentMessage = title;
        this.progressLog.currentStatus = status;
    };
    
    this.clear = function() {
        this.progressLog.logs = [];
        this.progressLog.currentMessage = '';
        this.progressLog.currentStatus = '';
    }
    
}

//-------------------------------------------------------------------------------------------------
module_init();
})();
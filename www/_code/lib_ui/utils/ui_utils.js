(function() {

    //-------------------------------------------------------------------------------------------------
    // ui_utils.js:
    // Collection of assorted ui utilities
    //-------------------------------------------------------------------------------------------------
    function module_init() {
        angular.module('nl.ui.utils', ['nl.ui.keyboard'])
        .filter('nlDateTimeFormat', NlDateTimeFormat) // Usage: {{someDateJson | nlDateTimeFormat:"date|minute(default)"}}
        .filter('nlConvert', NlConvert) // Usage: {{someStr | nlConvert:convertDict}}
        .service('nlPrinter', PrinterSrv)
        .directive('nlCompile', Compile)
        .directive('nlLoading', LoadingDirective)
        .directive('nlNoCtxMenu', NoCtxMenuDirective)
        .directive('nlRetainAr', RetainArDirective)
        .directive('nlWaitOnClick', WaitOnClickDirective)
        .directive('nlFocusMe', FocusMeDirective)
        .directive('nlProgressLog', ProgressLogDirective)
        .directive('nlInlineHelp', InlineHelpDirective)
        .directive('nlProgressBar', ProgressBarDirective)
        .directive('nlSummaryBox', SummaryBoxDirective)
        .directive('nlSummaryBox2', SummaryBox2Directive)
        .directive('nlSummaryBox3', SummaryBox3Directive)
        .directive('nlSummaryBoxLarge', SummaryBoxLargeDirective)
        .directive('nlSummaryBoxLarge1', SummaryBoxLarge1Directive)
        .directive('nlIntelliTextarea', IntelliTextareaDirective)
        .filter('nlTrustUrl', TrustUrlFilter)
        .service('nlProgressLog', ProgressLogSrv);
    }
    
    //-------------------------------------------------------------------------------------------------
    var NlDateTimeFormat = ['nl',
    function(nl) {
        return function(dateJson, accuracy) {
            return nl.fmt.fmtDateDelta(dateJson, undefined, accuracy);
        };
    }];
    
    //-------------------------------------------------------------------------------------------------
    var NlConvert = ['nl',
    function(nl) {
        function _convert(input, convertDict) {
            if (input in convertDict) return convertDict[input];
            return input;
        }
        return _convert;
    }];
    
    //-------------------------------------------------------------------------------------------------
    var PrinterSrv = ['nl',
    function(nl) {
        this.print = function(title) {
            nl.pginfo.isPrintable = true;
            var oldWindowTitle = nl.pginfo.windowTitle;
            if (title) nl.pginfo.windowTitle = title;
            nl.timeout(function() {
                nl.window.print();
                nl.pginfo.isPrintable = false;
                nl.pginfo.windowTitle = oldWindowTitle;
            }, 500);
        };
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
    var WaitOnClickDirective = ['nl', 'nlDlg',
    function(nl, nlDlg) {
        return {
            restrict: 'A',
            link: function(scope, iElem, iAttrs) {
                iElem.bind('click', function(e) {
                    nlDlg.showLoadingScreen();
                });
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
    var InlineHelpDirective = ['nl',
    function(nl) {
        return {
            restrict: 'E',
            transclude: true,
            templateUrl: 'lib_ui/utils/inline_help.html'
        };
    }];
    
    //-------------------------------------------------------------------------------------------------
    var ProgressBarDirective =  [
    function () {
        return {
            restrict: 'E',
            scope: {
                percval: '@'
            },
            templateUrl: 'lib_ui/utils/progress_bar.html' 
       };
    }];
    
    //-------------------------------------------------------------------------------------------------
    var SummaryBoxDirective =  [
    function () {
        return {
            restrict: 'E',
            transclude: true,
            scope: {
                number: '=',
                title: '=',
                desc: '=',
                showperc: '=',
                boxclass: '=',
                custom: '='
            },
            templateUrl: 'lib_ui/utils/summary_box.html'
       };
    }];
    
    //-------------------------------------------------------------------------------------------------
    var SummaryBox2Directive =  [
    function () {
        return {
            restrict: 'E',
            transclude: true,
            scope: {
                data: '='
            },
            templateUrl: 'lib_ui/utils/summary_box2.html'
        };
    }];

    //-------------------------------------------------------------------------------------------------
    var SummaryBox3Directive =  [
    function () {
        return {
            restrict: 'E',
            transclude: true,
            scope: {
                data: '='
            },
            templateUrl: 'lib_ui/utils/summary_box3.html'
        };
    }];

    //-------------------------------------------------------------------------------------------------
    var SummaryBoxLargeDirective =  [
    function () {
        return {
            restrict: 'E',
            transclude: true,
            scope: {
                data: '=',
            },
            templateUrl: 'lib_ui/utils/summary_box_large.html'
        };
    }];

    //-------------------------------------------------------------------------------------------------
    var SummaryBoxLarge1Directive =  [
    function () {
        return {
            restrict: 'E',
            transclude: true,
            scope: {
                data: '=',
            },
            templateUrl: 'lib_ui/utils/summary_box_large1.html'
        };
    }];
    //-------------------------------------------------------------------------------------------------
    var TrustUrlFilter = ['$sce',
    function($sce) {
        return function(url) {
            return $sce.trustAsResourceUrl(url);
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
        self._hideDebugAndInfoLogs = false;
        
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
            var zip = new JSZip();
            var ret = '';
            for(var i=0; i<self.progressLog.logs.length; i++) {
                var log = self.progressLog.logs[i];
                var row = nl.fmt2('{}, {}, {}\r\n', log.status, log.ts, log.title);
                if (log.details) row += nl.fmt2('{}\r\n', log.details);
                ret += row;
            }
            zip.file('progress-log.txt', ret);
            nlExporter.saveZip(zip, 'progress-log.zip', null, function(sizeKb) {
            }, function(e) {
            });
        };
        
        this.progressLog.onClearLogs = function() {
            self.clear();
        };
        
        this.showLogDetails = function(bShowLogs) {
            this.progressLog.showLogs = bShowLogs;
        };
    
        this.hideDebugAndInfoLogs = function() {
            self._hideDebugAndInfoLogs = true;
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
            if (self._hideDebugAndInfoLogs) return;
            this._log('info', title, details);
        };
    
        this.debug = function(title, details) {
            if (self._hideDebugAndInfoLogs) return;
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
        };
        
    }

    //-------------------------------------------------------------------------------------------------
    var IntelliTextareaDirective = ['nl',
    function(nl) {
        return {
            restrict: 'E',
            scope: {
                getoptions: '=',
                getoptionsdata: '=',
                    model: '=',
            },
            templateUrl: 'lib_ui/utils/intelli_textarea.html',
            link: function(scope, iElem, iAttrs) {
                scope.selectBoxIsShown = false;
                scope.options = scope.getoptions(scope.getoptionsdata);
                scope.onTextAreaKeyDown = function(event) {
                    var keyPressed = event.key;
                    if (!(keyPressed in scope.options)) return;
                    scope.intellisenseOptions = scope.options[keyPressed];
                    var elem = document.getElementById('intelliSelect');
                    scope.selectBoxIsShown = true;
                    nl.timeout(function () { elem.focus(); }, 0);
                };
            
                scope.onSelectEvent = function(event, evttype) {
                    if (evttype == 'keydown') {
                        //27: escape, 8: backspace, 46: delete, 13: enter
                        if (event.keyCode == 27 || event.keyCode == 8 || event.keyCode == 46){
                            scope.selectBoxIsShown = false;
                            _focusTextarea();
                            return;        
                        }
                        scope.ignoreChangeEvent = event.keyCode !== 13;
                    } else if (evttype == 'mousedown') scope.ignoreChangeEvent = false;
                    if(!scope.ignoreChangeEvent) _onSelectChanged(scope);
                }

                function _onSelectChanged(scope) {
                    if(scope.ignoreChangeEvent){
                        scope.ignoreChangeEvent = false;
                        return;
                    }
                    if (!scope.intelliSelect) return;
        
                    var textareaElement = document.getElementById('nlIntellisenseTextarea');
                    var startPosition = textareaElement.selectionStart;
                    var endPosition = textareaElement.selectionEnd;
                    var valueText = scope.model;
                    var removeChar = 1;
                    if (!(valueText[startPosition-1] in scope.options)) removeChar = 0;
                    scope.model = valueText.substring(0, startPosition - removeChar) + scope.intelliSelect.val + valueText.substring(endPosition, valueText.length);
                    
                    var newCursorPosition = startPosition + scope.intelliSelect.val.length -removeChar;
                    if (scope.intelliSelect.cursor) { newCursorPosition += scope.intelliSelect.cursor; }
                    scope.selectBoxIsShown = false;
                    scope.intelliSelect = undefined;
                    _focusTextarea(newCursorPosition);
                }
            
                function _focusTextarea(newCursorPosition) {
                    var elem = document.getElementById('nlIntellisenseTextarea');
                    elem.focus();
                    if(!newCursorPosition) return;
                    nl.timeout(function () { elem.setSelectionRange(newCursorPosition, newCursorPosition);}, 0);
                }
            }
        };    
    }];
    
    //-------------------------------------------------------------------------------------------------
    module_init();
    })();
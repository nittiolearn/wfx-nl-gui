(function() {

//-------------------------------------------------------------------------------------------------
// nl.js: 
// Colection of many utilities which are required in different services, 
// directives and controllers
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.log', [])
    .service('nlLog', NlLog)
    .service('nlLogViewer', NlLogViewer);
}

// Shared between nlLog and nlLogViewer service
var logImpl = new LogImpl();

//-------------------------------------------------------------------------------------------------
var NlLog = ['$log',
function($log) {
    
    // Can be generously sprayed around during initial testing - but remember to remove them
    // after initial development
    this.debug = function() {
        logImpl.log(logImpl.LOG_LEVEL.DEBUG, $log.debug, arguments);
    };

    // Aroud entry / exit of different views
    this.info = function() {
        logImpl.log(logImpl.LOG_LEVEL.INFO, $log.info, arguments);
    };

    // Some failures which can be expected during operations
    this.warn = function() {
        logImpl.log(logImpl.LOG_LEVEL.WARN, $log.warn, arguments);
    };

    // Some failures which indicates likely code errors
    this.error = function() {
        logImpl.log(logImpl.LOG_LEVEL.ERROR, $log.error, arguments);
    };
}];
    
//-------------------------------------------------------------------------------------------------
var NlLogViewer = ['nlDlg',
function(nlDlg) {
    // Used by Log GUI only
    this.show = function($scope) {
        logImpl.showLogViewer(nlDlg, $scope);
    };
    
}];

//-------------------------------------------------------------------------------------------------
// nlLog implementation
function LogImpl() {
    
    //---------------------------------------------------------------------------------------------
    // Configuration data
    this.LOG_LEVEL = {DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3};
    this.LOG_LEVEL_TEXTS = ['debug', 'info', 'warn', 'error'];
    this.storeLogs = true;
    this.maxLogCount = 1000;
    this.lowWaterMark = 800;
    
    //---------------------------------------------------------------------------------------------
    // Runtime data
    this.logId = 0;
    this.recentLogs = [];
    this.currentLogLevel = this.LOG_LEVEL.DEBUG;

    //---------------------------------------------------------------------------------------------
    // Log viewer related data
    this.showLogConfig = false;
    this.showHideLable = '';
    
    //---------------------------------------------------------------------------------------------
    // Logging related methods
    this.log = function (level, logFn, args) {
        var self = this;
        if (level < self.currentLogLevel) return;
    
        var msg = args[0];
        var logArgs = _sliceArguments(args, 1); 
        if (logArgs.length > 0) {
            logFn(msg, logArgs);
        } else {
            logFn(msg);
        }
    
        if (!self.storeLogs) return;
        self.logId++;
    
        var argsJson = '';
        try {
            argsJson = angular.toJson(logArgs);
        } catch (e) {
            argsJson = 'angular.toJson() failed: ' + e.message;
        }
        self.recentLogs.push({pos: self.logId, logtime: new Date(), level:self.LOG_LEVEL_TEXTS[level], msg:msg, args:argsJson});
        if (self.recentLogs.length < self.maxLogCount) return;
        var toRemove = self.maxLogCount - self.lowWaterMark;
        self.recentLogs.splice(0, toRemove);
    };

    function _sliceArguments(args, startPos) {
        var ret = [];
        for(var i=startPos; i < args.length; i++) ret.push(args[i]);
        return ret;
    }

    //---------------------------------------------------------------------------------------------
    // Log GUI related methods
    this.showLogViewer = function(nlDlg, $scope) {
        var logViewerDlg = nlDlg.create($scope);
        logViewerDlg.scope.logConfig = this;
        logViewerDlg.show('lib/logviewer.html');
    };

    this.clearLogs = function() {
        this.recentLogs = [];
    };
    
    this.toggleLogConfig = function() {
        this.showLogConfig = !this.showLogConfig;
        this.updateShowHideLable();
    };

    this.updateShowHideLable = function() {
        this.showHideLable = this.showLogConfig ? 'Hide log config': 'Show log config';
    };

    //---------------------------------------------------------------------------------------------
    // Initialization code
    this.updateShowHideLable();
    
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

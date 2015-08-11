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
var NlLog = ['$log', '$location',
function($log, $location) {
    
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
    
    logImpl.initDebugUrl($location);
}];
    
//-------------------------------------------------------------------------------------------------
var NlLogViewer = ['nl', 'nlDlg', 'nlServerApi', 
function(nl, nlDlg, nlServerApi) {
    this.show = function($scope) {
        _showLogViewer(nl, nlDlg, nlServerApi, $scope);
    };
    
    this.showOnStartupIfRequired = function($scope) {
        _showLogViewerOnStartupIfRequired(nl, nlDlg, nlServerApi, $scope);
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
    this.currentLogLevel = this.LOG_LEVEL.ERROR;

    //---------------------------------------------------------------------------------------------
    // Log viewer related data
    this.showLogConfig = false;
    this.showHideLable = '';
    this.showOnStartup = false;
    this.startupTimeout = 10*1000;
    
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
    // Log GUI related init method
    this.initDebugUrl = function($location) {
        var params = $location.search();
        if (!('loglevel' in params)) return;
        this.currentLogLevel= parseInt(params.loglevel);
        this.showOnStartup = true;
        if ('logtimeout' in params) this.startupTimeout = parseInt(params.logtimeout);
    };

    this.updateShowHideLable = function() {
        this.showHideLable = this.showLogConfig ? 'Hide log config': 'Show log config';
    };

    //---------------------------------------------------------------------------------------------
    // Initialization code
    this.updateShowHideLable();
    
}

function _showLogViewer(nl, nlDlg, nlServerApi, $scope) {
    var logViewerDlg = nlDlg.create($scope);
    logViewerDlg.scope.logConfig = logImpl;

    logViewerDlg.scope.toggleLogConfig = function() {
        logImpl.showLogConfig = !logImpl.showLogConfig;
        logImpl.updateShowHideLable();
    };

    logViewerDlg.scope.clearLogs = function() {
        logImpl.recentLogs = [];
    };

    logViewerDlg.scope.sendMail = function() {
        nlDlg.popupAlert({title:'Send Mail', template:'TODO'});
    };
    logViewerDlg.scope.exportToCsv = function() {
        nlDlg.popupAlert({title:'Export to CSV', template:'TODO'});
    };

    logViewerDlg.show('lib/logviewer.html');
}

function _showLogViewerOnStartupIfRequired(nl, nlDlg, nlServerApi, $scope) {
    if (!logImpl.showOnStartup) return;
    logImpl.showOnStartup = false;
    nl.timeout(function() {
        _showLogViewer(nl, nlDlg, nlServerApi, $scope);
    }, logImpl.startupTimeout); // 10 seconds by default
}
    

//-------------------------------------------------------------------------------------------------
module_init();
})();

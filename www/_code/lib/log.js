(function() {

//-------------------------------------------------------------------------------------------------
// log.js: 
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

    // Put only for testing issues. Don't checkin with this code!
    this.test = function() {
        logImpl.log(logImpl.LOG_LEVEL.TEST, $log.info, arguments);
    };
}];
    
//-------------------------------------------------------------------------------------------------
var NlLogViewer = ['nl', 'nlDlg', 'nlServerApi', 'nlConfig',
function(nl, nlDlg, nlServerApi, nlConfig) {
    this.show = function($scope) {
        _showLogViewer(nl, nlDlg, nlServerApi, $scope);
    };

    this.isEnabled = function() {
        return logImpl.isEnabled();
    };

    this.getLogMenuItem = function($scope) {
        var self = this;
        return {id: 'nl_logviewer_show', type: 'menu', name: nl.t(' Debug Log'),
            onClick: function() { self.show($scope); },
            canShow: function() {return logImpl.isEnabled();}
        };
    };

    logImpl.initLogViewer(nl, nlConfig);
}];

//-------------------------------------------------------------------------------------------------
// nlLog implementation
function LogImpl() {
    
    //---------------------------------------------------------------------------------------------
    // Configuration data
    this.LOG_LEVEL = {DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, TEST: 4};
    this.LOG_LEVEL_TEXTS = ['debug', 'info', 'warn', 'error', 'test'];
    this.maxLogCount = 50;
    this.lowWaterMark = 40;
    this.nlConfig = null;
    this.STORAGE_KEY ='NL_LOGVIEWER_DATA';
    
    this.enabled = undefined; // Will later be set to true or false;
    this.isEnabled = function() {
        return this.enabled;
    };

    //---------------------------------------------------------------------------------------------
    // Runtime data
    this.logId = 0;
    this.recentLogs = [];
    this.currentLogLevel = this.LOG_LEVEL.TEST;
    this.resultFromDB = null;

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
    
        self.logId++;
        var argsJson = '';
        try {
            argsJson = angular.toJson(logArgs);
        } catch (e) {
            argsJson = 'angular.toJson() failed: ' + e.message;
        }
        self.recentLogs.push({pos: self.logId, logtime: new Date(), level:self.LOG_LEVEL_TEXTS[level], msg:msg, args:argsJson});
        self.storeLogs();
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
    this.updateShowHideLable = function() {
        this.showHideLable = this.showLogConfig ? 'Hide log config': 'Show log config';
    };

    //---------------------------------------------------------------------------------------------
    // Initialization code
    this.updateShowHideLable();

    this.initLogViewer = function(nl, nlConfig) {
        var params = nl.window.location.search;
        if (params.indexOf('mobile_debug') > 0) this.enabled = true;
        this.nlConfig = nlConfig;
        var self = this;
        this.nlConfig.loadFromDb(this.STORAGE_KEY, function(result) {
            if (!result) result = {recentLogs: []};
            self.resultFromDB = result;
            if (self.recentLogs.length > 0) {
                for(var i=0; i<self.recentLogs.length; i++) {
                    result.recentLogs.push(self.recentLogs[i]);
                }
            }
            self.recentLogs = result.recentLogs;
            if (self.enabled === undefined) self.enabled = result.enabled;
            if (result.currentLogLevel !== undefined) self.currentLogLevel = result.currentLogLevel;
            if (result.maxLogCount !== undefined) self.maxLogCount = result.maxLogCount;
            if (result.lowWaterMark !== undefined) self.lowWaterMark = result.lowWaterMark;
            self.storeLogs();
        });
    };

    this.storeLogs = function() {
        if (!this.resultFromDB || !this.enabled) return;
        var data = {recentLogs: this.recentLogs, enabled: this.enabled, currentLogLevel: this.currentLogLevel,
            maxLogCount: this.maxLogCount, lowWaterMark: this.lowWaterMark};
        this.nlConfig.saveToDb(this.STORAGE_KEY, data, function(res) {
        });
    };
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
        _save();
    };

    logViewerDlg.scope.saveNow = function() {
        _save();
    };

    function _save() {
        logImpl.storeLogs();
        nlDlg.popupAlert({title:'Saved', template:'Sved to local DB'});
    }

    logViewerDlg.show('lib/logviewer.html');
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

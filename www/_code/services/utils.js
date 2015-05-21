(function() {

//-------------------------------------------------------------------------------------------------
// All Server side interfaces are collected in a single service
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.utils', [])
    .service('nlLog', NlLog)
    .service('nlRes', NlRes)
    .service('nlUtils', NlUtils);
}

//-------------------------------------------------------------------------------------------------
var NlLog = ['$log',
function($log) {

    this.DEBUG = 1;
    this.INFO = 2;
    this.WARNING = 3;
    this.ERROR = 4;
    this._logLevel = this.DEBUG;
    
    this.setLogLevel = function(logLevel) {
        this._logLevel = logLevel;
    };

    this.error = function(msg) {
        this._impl(msg, "ERROR", this.ERROR);
    };
    
    this.warning = function(msg) {
        this._impl(msg, "WARN", this.WARNING);
    };
    
    this.info = function(msg) {
        this._impl(msg, "INFO", this.INFO);
    };
    
    this.debug = function(msg) {
        this._impl(msg, "DEBUG", this.DEBUG);
    };
    
    this._impl = function(msg, prefix, level) {
        if (this._logLevel > level) return;
        $log.info(prefix + ': ' + msg);
    };
}];

//-------------------------------------------------------------------------------------------------
var NlRes = [
function() {
    this.menuIcon = function(iconName) {
        return 'img/menubar/' + iconName;
    };

    this.dashboardIcon = function(iconName) {
        return 'img/dashboard/' + iconName;
    };
}];

//-------------------------------------------------------------------------------------------------
var NlUtils = ['nlLog', '$timeout',
function(nlLog, $timeout) {

    var recentlyExecuted = {};
    
    this.onViewEnter = function($scope, fn) {
        $scope.$on('$ionicView.afterEnter', fn);
    };

    this.onViewLeave = function($scope, fn) {
        $scope.$on('$ionicView.beforeLeave', fn);
    };

    // Call this to execute a function atmost once in a given timeframe. Is useful for event handler
    // functions which are triggred too often.
    // uniqueId is a string: all functions with the same uniqueId will be executed only once in the
    // given timeframe.
    this.executeOnceIn = function(timeout, uniqueId, Fn) {
        if (uniqueId in recentlyExecuted) return;
        recentlyExecuted[uniqueId] = true;
        Fn();
        $timeout(function() {
            delete recentlyExecuted[uniqueId];
        }, timeout);
    };
}];

module_init();
})();

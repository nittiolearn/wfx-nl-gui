(function() {

//-------------------------------------------------------------------------------------------------
// nl.js: 
// Colection of many utilities which are required in different services, 
// directives and controllers
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.nl', [])
    .service('nl', Nl);
}

//-------------------------------------------------------------------------------------------------
var Nl = ['$log', '$http', '$timeout',
function($log, $http, $timeout) {
    //---------------------------------------------------------------------------------------------
    // All logging calls within nittioapp is made via nl.log
    this.log = $log;

    //---------------------------------------------------------------------------------------------
    // All http calls within nittioapp is made via nl.http
    this.http = $http;

    //---------------------------------------------------------------------------------------------
    // All timeout calls within nittioapp is made via nl.timeout
    this.timeout = $timeout;

    //---------------------------------------------------------------------------------------------
    // All URL getters
    this.url = new NlUrl();
    
    //---------------------------------------------------------------------------------------------
    // All DB access
    this.db = new NlDb();

    //---------------------------------------------------------------------------------------------
    // View enter exit handlers
    this.router = new NlRouter();
    
    //---------------------------------------------------------------------------------------------
    // Page number data related to current view.
    this.pgno = new NlPgNo();

    //---------------------------------------------------------------------------------------------
    // Translator to translate all string
    this.t = function() {
        return _t(arguments);
    };
    
    //---------------------------------------------------------------------------------------------
    // Other Utilities
    this.fmt1 = function(strFmt, args) {
        return _fmt1(strFmt, args);
    };
    
    this.fmt2 = function() {
        return _fmt2(arguments);
    };

    this.escape = function(input) {
        return _escape(input);
    };
}];

//-------------------------------------------------------------------------------------------------
function NlUrl() {
    this.menuIcon = function(iconName) {
        return 'img/menubar/' + iconName;
    };

    this.dashboardIcon = function(iconName) {
        return 'img/dashboard/' + iconName;
    };

    this.lessonIcon = function(iconName) {
        return 'img/nittio_icon_v41/' + iconName;
    };
}

//-------------------------------------------------------------------------------------------------
function NlDb() {
    var lessonSchema = {
      name: 'lesson',
      key: 'id',
      autoIncrement: false
    };
    var schema = {stores: [lessonSchema], version: 1};
    var db = new ydn.db.Storage('nl_db', schema);
    
    this.get = function() {
        return db;
    };
    
    this.clearDb = function() {
        console.log('db.clear');
        db.clear();
    };
}
    
//-------------------------------------------------------------------------------------------------
function NlRouter() {
    this.onViewEnter = function($scope, fn) {
        $scope.$on('$ionicView.afterEnter', fn);
    };

    this.onViewLeave = function($scope, fn) {
        $scope.$on('$ionicView.beforeLeave', fn);
    };
}

//-------------------------------------------------------------------------------------------------
function NlPgNo() {
    this.totalPages = 1;
    this.currentPage = 1;
    this.thumbHeight = 100;
    this.thumbTop = 0;
    this.pageAnim = 'nl-anim-pg-same';
}

//-------------------------------------------------------------------------------------------------
function _t(args) {
    // TODO-MUNNI - actual translation needed
    var strFmt = args[0].toUpperCase();
    var ret = _fmt2Impl(strFmt, _getArgs(args));
    return ret;
}

function _fmt1(strFmt, args) {
    return strFmt.replace(/{([^{}]*)}/g, function(match, dictKey) {
        return typeof args[dictKey] === 'undefined' ? match : args[dictKey];
    });
}

function _fmt2(args) {
    return _fmt2Impl(args[0], _getArgs(args));
}

function _getArgs(args) {
    var args1 = [];
    for(var i=1; i<args.length; i++) args1.push(args[i]); 
    return args1;
}

function _fmt2Impl(strFmt, args) {
    var i = 0;
    return strFmt.replace(/{}/g, function() {
        return typeof args[i] != 'undefined' ? args[i++] : '';
    });
}

function _escape(input) {
    return String(input).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

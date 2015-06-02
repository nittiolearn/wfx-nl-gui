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
var Nl = ['$log', '$http', '$timeout', '$location',
function($log, $http, $timeout, $location) {
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
    // All $location calls within nittioapp is made via nl.location
    this.location = $location;

    //---------------------------------------------------------------------------------------------
    // Formatting and translating Utilities
    var formatter = new Formatter();
    this.t = function() {
        return formatter.t(arguments);
    };

    this.fmt1 = function(strFmt, args) {
        return formatter.fmt1(strFmt, args);
    };
    
    this.fmt2 = function() {
        return formatter.fmt2(arguments);
    };

    this.escape = function(input) {
        return formatter.escape(input);
    };

    //---------------------------------------------------------------------------------------------
    // All URL getters
    this.url = new NlUrl(this);
    
    //---------------------------------------------------------------------------------------------
    // All DB access
    this.db = new NlDb();

    //---------------------------------------------------------------------------------------------
    // View enter exit handlers
    this.router = new NlRouter();
    
    //---------------------------------------------------------------------------------------------
    // Page number data related to current view.
    this.pgno = new NlPgNo();
}];

//-------------------------------------------------------------------------------------------------
function Formatter() {
    this.t = function(args) {
        // TODO-MUNNI - actual translation needed
        var strFmt = args[0];
        var ret = _fmt2Impl(strFmt, _getArgs(args));
        return ret;
    };
    
    this.fmt1 = function(strFmt, args) {
        return strFmt.replace(/{([^{}]*)}/g, function(match, dictKey) {
            return typeof args[dictKey] === 'undefined' ? match : args[dictKey];
        });
    };
    
    this.fmt2 = function(args) {
        return _fmt2Impl(args[0], _getArgs(args));
    };
    
    this.escape = function(input) {
        return String(input).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };

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
}

//-------------------------------------------------------------------------------------------------
function NlUrl(nl) {
    this.resUrl = function(iconName) {
        return resFolder('res', iconName);
    };

    this.lessonIconUrl = function(iconName) {
        return resFolder('icon', iconName);
    };

    this.bgImgUrl = function(iconName) {
        return resFolder('template', iconName);
    };

    function resFolder(folder, iconName) {
        var ret = nl.fmt2('{}nittio_{}_{}/{}',
                          NL_SERVER_INFO.url, NL_SERVER_INFO.basePath, 
                          folder,
                          NL_SERVER_INFO.versions[folder], iconName);
        console.log('resFolder:', ret);
        return ret;
    }
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
module_init();
})();

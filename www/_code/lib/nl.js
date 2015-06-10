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
var Nl = ['$log', '$http', '$timeout', '$location', '$window',
function($log, $http, $timeout, $location, $window) {
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
    // All $window calls within nittioapp is made via nl.window
    this.window = $window;
    
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
    // Page title, window title and page number related information pertaining to the current view.
    this.pginfo = new NlPageInfo();

    //---------------------------------------------------------------------------------------------
    // Menu bar for the current view
    this.menu = new NlMenu(this);
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
        var ret = nl.fmt2('{}{}nittio_{}_{}/{}',
                          NL_SERVER_INFO.url, NL_SERVER_INFO.basePath, 
                          folder, NL_SERVER_INFO.versions[folder], iconName);
        console.log('resFolder:', ret);
        return ret;
    }

    this.getCachedUrl = function(url) {
        return new Promise(function(resolve, reject) {
            var db = nl.db.get();
            db.get('resource', url)
            .then(function(resource) {
                if (resource !== undefined) {
                    resolveResource(resource, resolve, nl);
                    return;
                }
                loadResouceUrl(url, db, resolve, reject);
            }, function(e) {
                console.log('getCachedUrl from db failed', e);
                loadResouceUrl(url, db, resolve, reject);
            });
        });
    }

    function loadResouceUrl(url, db, resolve, reject) {
        nl.http.get(url, {cache: false, responseType: 'blob'})
        .success(function(data, status, headers, config) {
            console.log('loadResouceUrl success: ', url, data, status, headers, config);
            var resource = {id:url, res:data};
            db.put('resource', resource, url)
            .then(function(key) {
                resolveResource(resource, resolve, nl);           
            }, function(e) {
                console.log('loadResouceUrl db.put failed', e);
                resolveResource(resource, resolve, nl);           
            });
        }).error(function(data, status, headers, config) {
            console.log('loadResouceUrl failed: ', url, data, status, headers, config);
            reject(data);
        });
    }

    function resolveResource(resource, resolve, nl) {
        var URL = window.URL || window.webkitURL;
        var localUrl = URL.createObjectURL(resource.res);
        // When will revokeObjectURL be called?
        resolve(localUrl);
    }
}

//-------------------------------------------------------------------------------------------------
function NlDb() {
    var lessonSchema = { name: 'lesson', key: 'id', autoIncrement: false};
    var resourceSchema = { name: 'resource', key: 'id', autoIncrement: false};
    var schema = {stores: [lessonSchema, resourceSchema], version: 1};
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
function NlPageInfo() {
    this.totalPages = 1;
    this.currentPage = 1;
    this.thumbHeight = 100;
    this.thumbTop = 0;
    this.pageAnim = 'nl-anim-pg-same';
    
    this.pageSubTitle ='';
    this.pageTitle ='';

    this.isMenuShown = true;
}

//-------------------------------------------------------------------------------------------------
function NlMenu(nl) {
    var appmenu = [];
    var viewmenu = [];

    this.getMenuItems = function() {
        return appmenu.concat(viewmenu);
    };

    this.onViewEnter = function($scope, fn) {
        var self = this;
        nl.router.onViewEnter($scope, fn);
    
        nl.router.onViewLeave($scope, function() {
            self.clearViewMenu();
        });
    };

    this.clearAppMenu = function() {
        appmenu = [];
    };
    
    this.clearViewMenu = function() {
        viewmenu = [];
    };
    
    this.addAppMenuItem = function(title, img, handler) {
        addMenuItem(appmenu, title, img, handler);
    };

    this.addViewMenuItem = function(title, img, handler) {
        addMenuItem(viewmenu, title, img, handler);
    };
    
    function addMenuItem(menu, title, img, handler) {
        title = nl.t(title);
        img = nl.url.resUrl(img);
        menu.push({img:img, title:title, handler:handler});
    }
    
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

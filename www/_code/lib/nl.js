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
var Nl = ['$log', '$http', '$timeout', '$location', '$window', '$rootScope',
function($log, $http, $timeout, $location, $window, $rootScope) {
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
    // Cache Factory
    this.createCache = function(cacheMaxSize, onRemoveFn) {
        return new LruCache(cacheMaxSize, onRemoveFn);
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
    this.menu = new NlMenu(this, $rootScope);
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
// Intention is to implement a LRU. For now this cleanup 80% of random entries when the maxSize
// is reached! When a entry is cleaned up, onRemoveFn is called with key and value of entry being
// removed from Cache.
function LruCache(maxSize, onRemoveFn) {
    
    this.entryDict = {};

    this.put = function(key, value) {
        this.reduceIfNeeded();
        this.entryDict[key] = value;
    };
    
    this.get = function(key) {
        if (!(key in this.entryDict)) return undefined;
        return this.entryDict[key];
    };

    this.reduceIfNeeded = function() {
        var entryDictKeys = Object.keys(this.entryDict);
        if (entryDictKeys.length < maxSize) return;
        var toRemove = Math.round(maxSize*0.8);
        for (var k in this.entryDict) {
            if (toRemove <= 0) break;
            toRemove--;
            var v = this.entryDict[k];
            if (onRemoveFn !== undefined) onRemoveFn(k, v);
            delete this.entryDict[k];
        }
    };
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
        return ret;
    }

    var urlCache = nl.createCache(1000, function(k, v) {
        var localUrl = URL.revokeObjectURL(v);
    });

    this.getCachedUrl = function(url) {
        return new Promise(function(resolve, reject) {
            
            // TODO-MUNNI
            //resolve(url);
            //return;
            
            var localUrl = urlCache.get(url);
            if (localUrl !== undefined) {
                resolve(localUrl);
                return;
            }
            var db = nl.db.get();
            db.get('resource', url)
            .then(function(resource) {
                if (resource !== undefined) {
                    resolveResource(url, resource, resolve, nl);
                    return;
                }
                loadResouceUrl(url, db, resolve);
            }, function(e) {
                console.log('getCachedUrl from db failed', e);
                loadResouceUrl(url, db, resolve);
            });
        });
    };

    function loadResouceUrl(url, db, resolve) {
        nl.http.get(url, {cache: false, responseType: 'blob'})
        .success(function(data, status, headers, config) {
            console.log('loadResouceUrl success: ', url, data, status, headers, config);
            var resource = {id:url, res:data};
            db.put('resource', resource, url)
            .then(function(key) {
                resolveResource(url, resource, resolve, nl);           
            }, function(e) {
                console.log('loadResouceUrl db.put failed', e);
                resolveResource(url, resource, resolve, nl);           
            });
        }).error(function(data, status, headers, config) {
            console.error('loadResouceUrl failed: ', url, data, status, headers, config);
            resolveUncachedResource(url, resolve);
        });
    }

    function resolveResource(url, resource, resolve, nl) {
        var URL = window.URL || window.webkitURL;
        var localUrl = URL.createObjectURL(resource.res);
        urlCache.put(url, localUrl);
        resolve(localUrl);
    }

    function resolveUncachedResource(url, resolve) {
        resolve(url);
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
function NlMenu(nl, $rootScope) {
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
        var menuItem = {title:nl.t(title), handler:handler};
        nl.url.getCachedUrl(nl.url.resUrl(img)).then(function(url) {
            $rootScope.$apply(function() {
                menuItem.img = url;
            });
        });
        menu.push(menuItem);
    }
    
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

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
var Nl = ['nlLog', '$http', '$q', '$timeout', '$location', '$window', '$rootScope',
function(nlLog, $http, $q, $timeout, $location, $window, $rootScope) {
    //---------------------------------------------------------------------------------------------
    // All logging calls within nittioapp is made via nl.log
    this.log = nlLog;

    //---------------------------------------------------------------------------------------------
    // All http calls within nittioapp is made via nl.http
    this.http = $http;

    //---------------------------------------------------------------------------------------------
    // All $q/promise calls within nittioapp is made via nl.q
    this.q = $q;

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
    // All $window calls within nittioapp is made via nl.window
    this.rootScope = $rootScope;

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
    this.createCache = function(cacheMaxSize, cacheLowWaterMark, onRemoveFn) {
        return new LruCache(cacheMaxSize, cacheLowWaterMark, onRemoveFn);
    };
    
    //---------------------------------------------------------------------------------------------
    // All URL getters
    this.url = new NlUrl(this);
    
    //---------------------------------------------------------------------------------------------
    // All DB access
    this.db = new NlDb(this);

    //---------------------------------------------------------------------------------------------
    // View enter exit handlers
    this.router = new NlRouter();
    
    //---------------------------------------------------------------------------------------------
    // Page title, window title and menushown pertaining to the current view.
    this.pginfo = new NlPageInfo();

    //---------------------------------------------------------------------------------------------
    // Menu bar for the current view
    this.menu = new NlMenu(this);
}];

//-------------------------------------------------------------------------------------------------
function _sliceArguments(args, startPos) {
    var ret = [];
    for(var i=startPos; i < args.length; i++) ret.push(args[i]);
    return ret;
}

function Formatter() {
    this.t = function(args) {
        // TODO-MUNNI - actual translation needed
        var strFmt = args[0];
        var ret = _fmt2Impl(strFmt, _sliceArguments(args, 1));
        return ret;
    };
    
    this.fmt1 = function(strFmt, args) {
        return strFmt.replace(/{([^{}]*)}/g, function(match, dictKey) {
            return typeof args[dictKey] === 'undefined' ? match : args[dictKey];
        });
    };
    
    this.fmt2 = function(args) {
        return _fmt2Impl(args[0], _sliceArguments(args, 1));
    };
    
    this.escape = function(input) {
        return String(input).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };

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
function LruCache(maxSize, lowWaterMark, onRemoveFn) {
    
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
        var toRemove = maxSize - lowWaterMark;
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
        return clientResFolder('res', iconName);
    };

    this.lessonIconUrl = function(iconName) {
        return serverResFolder('icon', iconName);
    };

    this.bgImgUrl = function(iconName) {
        return serverResFolder('template', iconName);
    };

    function clientResFolder(folder, iconName) {
        return resFolder(folder, iconName, '/');
    }

    function serverResFolder(folder, iconName) {
        return resFolder(folder, iconName, NL_SERVER_INFO.url);
    }
    
    function resFolder(folder, iconName, serverUrl) {
        var ret = nl.fmt2('{}{}nittio_{}_{}/{}',
                          serverUrl, NL_SERVER_INFO.basePath, 
                          folder, NL_SERVER_INFO.versions[folder], iconName);
        return ret;
    }

    var urlCache = nl.createCache(1000, 500, function(k, v) {
        URL.revokeObjectURL(v);
    });

    this.getCachedUrl = function(url) {
        return nl.q(function(resolve, reject) {
            var localUrl = urlCache.get(url);
            if (localUrl !== undefined) {
                nl.log.debug('getCachedUrl found in urlCache: ', url, localUrl);
                resolve(localUrl);
                return;
            }
            var db = nl.db.get();
            db.get('resource', url)
            .then(function(resource) {
                if (resource !== undefined) {
                    nl.log.debug('getCachedUrl found resource in db: ', url);
                    resolveResource(url, resource, resolve, nl);
                    return;
                }
                nl.log.debug('getCachedUrl not found resource in db: ', url);
                loadResouceUrl(url, db, resolve);
            }, function(e) {
                nl.log.debug('getCachedUrl getting resource from db failed: ', url, e);
                loadResouceUrl(url, db, resolve);
            });
            nl.log.debug('getCachedUrl fired db.get', url);
        });
    };

    function loadResouceUrl(url, db, resolve) {
        nl.http.get(url, {cache: false, responseType: 'blob'})
        .success(function(data, status, headers, config) {
            nl.log.debug('loadResouceUrl success: ', url, status, headers, config);
            var resource = {id:url, res:data};
            try {
                db.put('resource', resource, url)
                .then(function(key) {
                    nl.log.debug('loadResouceUrl store in DB success: ', key);
                    resolveResource(url, resource, resolve, nl);           
                }, function(e) {
                    nl.log.warn('loadResouceUrl store in DB failed: ', e);
                    resolveResource(url, resource, resolve, nl);           
                });
            } catch (e) {
                nl.log.error('loadResouceUrl store in DB failed with exception: ', e);
                resolveResource(url, resource, resolve, nl);           
            }
            nl.log.debug('loadResouceUrl initiated put', url);
        }).error(function(data, status, headers, config) {
            nl.log.warn('loadResouceUrl failed: ', url, data, status, headers, config);
            resolveUncachedResource(url, resolve);
        });
    }

    function resolveResource(url, resource, resolve, nl) {
        nl.log.debug('resolveResource enter: ', url);
        var URL = window.URL || window.webkitURL;
        nl.log.debug('resolveResource before 2 createObjectURL: ', URL);
        var localUrl = null;
        try {
            localUrl = URL.createObjectURL(resource.res);
        } catch (e) {
            nl.log.error('resolveResource createObjectURL exception: ', e);
            resolve(url);
            return;
        }
        nl.log.debug('resolveResource success: ', url, localUrl);
        
        var oldLocalUrl = urlCache.get(url);
        if (oldLocalUrl !== undefined) URL.revokeObjectURL(oldLocalUrl);
        urlCache.put(url, localUrl);
        resolve(localUrl);
    }

    function resolveUncachedResource(url, resolve) {
        nl.log.debug('resolveUncachedResource: ', url);
        resolve(url);
    }
}

//-------------------------------------------------------------------------------------------------
function NlDb(nl) {
    var lessonSchema = { name: 'lesson', key: 'id', autoIncrement: false};
    var resourceSchema = { name: 'resource', key: 'id', autoIncrement: false};
    var schema = {stores: [lessonSchema, resourceSchema], version: 2};
    var db = new ydn.db.Storage('nl_db', schema);
    
    this.get = function() {
        return db;
    };
    
    this.clearDb = function() {
        nl.log.warn('db.clear');
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
        var menuItem = {title:nl.t(title), handler:handler, img:nl.url.resUrl(img)};
        menu.push(menuItem);
    }
    
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

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
    // All $q/promise calls within nittioapp is made via nl.q
    this.q = $q;

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
    // All $window calls within nittioapp is made via nl.window
    this.rootScope = $rootScope;

    //---------------------------------------------------------------------------------------------
    // Formatting and translating Utilities
    this.fmt = new Formatter();

    this.t = function() {
        return this.fmt.t(arguments);
    };

    this.fmt2 = function() {
        return this.fmt.fmt2(arguments);
    };

    //---------------------------------------------------------------------------------------------
    // Cache Factory
    this.createCache = function(cacheMaxSize, cacheLowWaterMark, onRemoveFn) {
        return new LruCache(cacheMaxSize, cacheLowWaterMark, onRemoveFn);
    };
    
    //---------------------------------------------------------------------------------------------
    // All DB access
    this.db = new NlDb(this);

    //---------------------------------------------------------------------------------------------
    // All URL getters
    this.url = new NlUrl(this);
    
    //---------------------------------------------------------------------------------------------
    // Page title, window title and menushown pertaining to the current view.
    this.pginfo = new NlPageInfo();

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

    this.json2Date = function(dateStr) {
        // Convert date to iso 8061 format if needed (e.g. "2014-04-28 23:09:00" ==> "2014-04-28T23:09:00Z")
        if(dateStr.indexOf('Z')==-1) dateStr=dateStr.replace(' ','T')+'Z';
        return new Date(dateStr);
    };
    
    this.date2Str = function(d, accurate) {
        var ret = _fmt2Impl('{}-{}-{} {}:{}', [d.getFullYear(), _pad2(d.getMonth()+1), _pad2(d.getDate()), 
                    _pad2(d.getHours()), _pad2(d.getMinutes())]);
        if (!accurate) return ret;
        ret += _fmt2Impl(':{}.{}', [_pad2(d.getSeconds()), _pad3(d.getMilliseconds())]);
        return ret;
    };

    this.jsonDate2Str = function(dateStr, accurate) {
        var d = this.json2Date(dateStr);
        if (isNaN(d.valueOf())) return dateStr;
        return this.date2Str(d, accurate);
    };
    
    function _fmt2Impl(strFmt, args) {
        var i = 0;
        return strFmt.replace(/{}/g, function() {
            return typeof args[i] != 'undefined' ? args[i++] : '';
        });
    }
    
    function _pad2(num) {
        var s = "00" + num;
        return s.substr(s.length-2);
    }

    function _pad3(num) {
        var s = "000" + num;
        return s.substr(s.length-3);
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
function NlDb(nl) {
    var configSchema = { name: 'config', key: 'id', autoIncrement: false};
    var schema = {stores: [configSchema], version: 4};
    var ydnDb = new ydn.db.Storage('nl_db', schema);
    var db = null;
    
    this.get = function(storeName, dbId) {
        var traceData = nl.fmt2('get {}.{}', storeName, dbId);
        return _connectAndExecute(traceData, function() {
            return db.get(storeName, dbId);
        });
    };

    this.put = function(storeName, value, dbId) {
        var traceData = nl.fmt2('put {}.{}', storeName, dbId);
        return _connectAndExecute(traceData, function() {
            return db.put(storeName, value, dbId);
        });
    };

    this.clear = function() {
        return _connectAndExecute('clear', function() {
            return db.clear();
        });
    };
    
    function _connectAndExecute(traceData, dbFn) {
        return nl.q(function(resolve, reject) {
            if (db !== null) return _execute(traceData, dbFn, resolve, reject);
            ydnDb.onReady(function(e) {
                if (db !== null) return _execute(traceData, dbFn, resolve, reject);
                if (!e) {
                    nl.log.info('NlDB DB is ready');
                    db = ydnDb;
                    return _execute(traceData, dbFn, resolve, reject);
                }
                if (e.target.error) nl.log.error('NlDB Error: ' + e.target.error.name + ' ' + e.target.error.message);
                nl.log.error('NlDB Error: ', e);
                db = new DbDummy();
                return _execute(traceData, dbFn, resolve, reject);
            });
        });
    };

    function _execute(traceData, dbFn, resolve, reject) {
        try {
            nl.log.debug('nlDb._execute enter: ', traceData);
            dbFn().then(function(result) {
                if (result === undefined) {
                    nl.log.info('nlDb._execute returned undefined: ', traceData);
                } else {
                    nl.log.debug('nlDb._execute done: ', traceData);
                }
                resolve(result);
            }, function(e) {
                nl.log.warn('nlDb._execute error: ', traceData, e);
                reject(e);
            });
        } catch (e) {
            nl.log.error('nlDb._execute exception: ', traceData, e);
            reject(e);
        }
        nl.log.debug('nlDb._execute initiated: ', traceData);
        return true;
    }
    
    // For devices where YDN-DB is not supported!
    function DbDummy() {
        var dbStore = {};
        this.get = function(storeName, dbId) {
            return nl.q(function(resolve, reject) {
                var key = nl.fmt2('{}.{}', storeName, dbId);
                if (!(key in dbStore)) {
                    resolve(undefined);
                    return;
                }
                resolve(dbStore[key]);
            });
        };

        this.put = function(storeName, value, dbId) {
            return nl.q(function(resolve, reject) {
                var key = nl.fmt2('{}.{}', storeName, dbId);
                dbStore[key] = value;
                resolve(true);
            });
        };

        this.clear = function() {
            return nl.q(function(resolve, reject) {
                dbStore = {};
                resolve(true);
            });
        };
    }
}
    
//-------------------------------------------------------------------------------------------------
function NlUrl(nl) {
    
    this.getAppUrl = function() {
        if (NL_SERVER_INFO.serverType == 'local') return '/';
        return '/nittioapp';
    };

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
        var ret = nl.fmt2('{}static/nittio_{}_{}/{}',
                          serverUrl, folder, NL_SERVER_INFO.versions[folder], iconName);
        return ret;
    }
    
    this.ajaxUrl = function(ajaxPath) {
        return nl.fmt2('{}{}', NL_SERVER_INFO.url, ajaxPath);
    };

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
            nl.db.get('resource', url).then(function(resource) {
                if (resource !== undefined) {
                    resolveResource(url, resource, resolve, nl);
                    return;
                }
                loadResouceUrl(url, resolve);
            }, function(e) {
                loadResouceUrl(url, resolve);
            });
            nl.log.debug('getCachedUrl fired db.get', url);
        });
    };

    function loadResouceUrl(url, resolve) {
        nl.http.get(url, {cache: false, responseType: 'blob'})
        .success(function(data, status, headers, config) {
            nl.log.debug('loadResouceUrl success: ', url, status, headers, config);
            var resource = {id:url, res:data};
            nl.db.put('resource', resource, url)
            .then(function(key) {
                resolveResource(url, resource, resolve, nl);           
            }, function(e) {
                resolveResource(url, resource, resolve, nl);           
            });
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
function NlPageInfo() {
    this.totalPages = 1;
    this.currentPage = 1;
    this.thumbHeight = 100;
    this.thumbTop = 0;
    this.pageAnim = 'nl-anim-pg-same';
    
    this.username ='';
    this.pageTitle ='';
    this.pageSubTitle ='';
    this.windowTitle ='Nittio Learn';
    this.isMenuShown = true;
    this.isPageShown = false;
    
    this.statusPopup = false;
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

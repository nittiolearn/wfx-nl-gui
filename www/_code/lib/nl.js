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
    this.pginfo = new NlPageInfo(this);
    
    this.resizeHandler = new ResizeHalder();

}];

//-------------------------------------------------------------------------------------------------
function ResizeHalder() {
    this.handlers = [];
    this.broadcast = function() {
        for(var i=0; i< this.handlers.length; i++) {
            this.handlers[i]();
        }
    };
    
    this.onResize = function(fn) {
        this.handlers.push(fn);
    };
}
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
        // Check first if this is a string!
        if (typeof dateStr != 'string' && !(dateStr instanceof String)) return dateStr;
        // Convert date to iso 8061 format if needed
        // (e.g.1: "2014-04-28" ==> "2014-04-28T00:00:00Z")
        // (e.g.2: "2014-04-28 23:09:00" ==> "2014-04-28T23:09:00Z")
        if(dateStr.indexOf('Z') == -1) {
            if (dateStr.length == 10)
                dateStr=dateStr +'T00:00:00Z';
            else
                dateStr=dateStr.replace(' ','T')+'Z';
        }
        return new Date(dateStr);
    };
    
    this.date2Str = function(d, accuracy) {
    	if (accuracy === undefined) accuracy = 'minute';
        var ret = _fmt2Impl('{}-{}-{}', [d.getFullYear(), _pad2(d.getMonth()+1), _pad2(d.getDate())]);
        if (accuracy === 'date') return ret;
        ret += _fmt2Impl(' {}:{}', [_pad2(d.getHours()), _pad2(d.getMinutes())]);
        if (accuracy === 'minute') return ret;
        ret += _fmt2Impl(':{}', [_pad2(d.getSeconds())]);
        if (accuracy === 'second') return ret;
        ret += _fmt2Impl('.{}', [_pad3(d.getMilliseconds())]);
        return ret;
    };

    this.jsonDate2Str = function(dateStr, accuracy) {
        if (!dateStr) return '-';
        var d = this.json2Date(dateStr);
        if (isNaN(d.valueOf())) return dateStr;
        return this.date2Str(d, accuracy);
    };
    
    this.getPastDate = function() {
        return new Date(2000, 0);
    }
    
    this.encodeUri = function(input) {
        return encodeURIComponent(input);
    };
    
    this.utf8ToBase64 = function(input) {
        return window.btoa(unescape(encodeURIComponent(input)));
    };
    
	this.addAvp = function(avps, fieldName, fieldValue, fmtType, fieldDefault, iconUrl, iconClass) {
		if (iconClass === undefined) iconClass = 'nl-24';
		if (iconUrl) {
			fieldValue = _fmt2Impl("<img src='{}' class='{}'> {}", [iconUrl, iconClass, fieldValue]);
		}
        if (fmtType == 'date') fieldValue = fieldValue ? this.jsonDate2Str(fieldValue)+' '+'Hrs' : '-';
        if (fmtType == 'date2') fieldValue = fieldValue ? this.date2Str(fieldValue, 'date') : '-';
		if (fmtType == 'boolean') fieldValue = fieldValue ? this.t(['Yes']) : this.t(['No']);
		if (fmtType == 'minutes') fieldValue = fieldValue ? (fieldValue > 1 ? this.t(['{} minutes', fieldValue]) : this.t(['{} minute', fieldValue])) : this.t('-');
		if (!fieldValue) fieldValue = fieldDefault || '-';
		avps.push({attr: this.t([fieldName]), val: fieldValue});
	};
	
	this.addLinksAvp = function(avps, fieldName) {
		var avp = {attr: this.t([fieldName]), val: [], type:'links'};
		avps.push(avp);
		return avp;
	};
	
	this.addLinkToAvp = function(avp, linkName, url, linkid) {
		var link  = {val: this.t([linkName])};
		if (url) link.url = url;
		if (linkid) link.linkid = linkid;
		avp.val.push(link);
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
    
    this.resUrl = function(iconName) {
        return clientResFolder('res', iconName);
    };

    this.lessonIconUrl = function(iconName) {
        return (iconName.indexOf('img:') == 0) 
        		? iconName.substring(4) 
        		: serverResFolder('icon', iconName);
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
function NlPageInfo(nl) {
    this.totalPages = 1;
    this.currentPage = 1;
    this.thumbHeight = 100;
    this.thumbTop = 0;
    this.pageAnim = 'nl-anim-pg-same';
    
    this.username ='';
    this.pageTitle ='';
    this.pageSubTitle ='';
    this.windowTitle ='Nittio Learn';
    this.windowDescription = 'Nittio Learn';
    this.isMenuShown = true;
    this.isPageShown = false;
    
    this.statusPopup = false;
    this.isMobileOrTab = _isMobileOrTab(nl);
}

function _isMobileOrTab(nl) {
    var check = false;
    var ua = nl.window.navigator.userAgent|| nl.window.navigator.vendor|| nl.window.opera;
    if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(ua) ||
       /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(ua.substr(0,4)))
        check = true;
    return check;
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

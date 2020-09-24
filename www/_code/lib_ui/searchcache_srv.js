(function() {

//-------------------------------------------------------------------------------------------------
// searchcache_srv.js: Service that get search cache data froms server
// Usage:
// On start of controller: nlSearchCacheSrv.init();
// When fetching contents from server first time or on fetchMore: 
// nlSearchCacheSrv.getItems('published_course').then(function(courseDict, canFetchMore) {
//      // courseDict is courseId to courseInfo dict.
//      // calling this function multiple times will fetch further chunks each time
//      // If all chunks are fetched, it will return the same dict
//      // canFetchMore is true or false. Depending on this the search more can be
//      // shown in the GUI.
//      // One JSON file can hold over 1000 courses and so only one fetch will be needed
//      // for most groups.
// });
// 
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.searchcache_srv', [])
    .service('nlSearchCacheSrv', NlSearchCacheSrv);
}

//-------------------------------------------------------------------------------------------------
var NlSearchCacheSrv = ['nl', 'nlDlg', 'nlServerApi', '$http',
function(nl, nlDlg, nlServerApi, $http) {
    //---------------------------------------------------------------------------------------------
    // Reset the cache on start of a controller
    this.init = function() {
        _caches = {
                    published_course: {cachetype: 'published_course'},
                    course_assignment: {cachetype : 'course_assignment'}
                };
        var params = nl.location.search();
        _rebuild = (params.rebuild == '1'); 

    };

    //---------------------------------------------------------------------------------------------
    // Get the caches items. Fetch from server if needed
    this.getItems = function(cachetype) {
        return nl.q(function(resolve, reject) {
            _getItems(cachetype, resolve);
        });
    };

    this.canFetchMore = function(cachetype) {
        var cache = _getCache(cachetype);
        if (!cache) return false;
        return cache.fetchDone ? false : true;
    };

    var _caches = null;
    var _rebuild = false;
    function _getCache(cachetype) {
        if (!_caches) return null;
        return _caches[cachetype] || null;
    }

    function _getItems(cachetype, resolve, statusMsg) {
        if (!statusMsg) statusMsg = 'Fetching data from server ...';
        var cache = _getCache(cachetype);
        if (!cache) return resolve({}, false);
        _initCache(cache);
        if (cache.fetchDone) return resolve(cache.itemsDict, false);
        nlDlg.popupStatus(statusMsg, false);
        nlDlg.showLoadingScreen();
        _getCacheInfoFromServer(cache, function(status) {
            if (!status) return _ret(cache, resolve);
            _processNextCacheJson(cache, resolve);
        });
    }

    var _rebuildCount = 0;
    function _ret(cache, resolve) {
        nlDlg.popdownStatus(0);
        nlDlg.hideLoadingScreen();
        var dirty = cache.searchCacheInfo.dirty;
        if (!_rebuild || !dirty) return resolve(cache.itemsDict, !cache.fetchDone);
        // cache is not fully built and we need to rebuild
        _rebuildCount++;
        var scInfo = (cache.searchCacheInfo || {}).info || {};
        var fileInfos = scInfo.file_infos || [];
        var debugInfo = (scInfo.internal || {}).debug || {};
        var itemsProcessed = debugInfo.objReadFromDb || 0;
        var itemsCached = 0;
        for (var i=0; i<fileInfos.length; i++) itemsCached += (fileInfos[i].count || 0);
        var statusMsg = nl.fmt2('Rebuilding cache: {} scanned and {} cached in {} calls ...', 
            itemsProcessed, itemsCached, _rebuildCount);
        console.log('Rebuilding cache', debugInfo);
        _getItems(cache.cachetype, resolve, statusMsg);
    }

    function _initCache(cache) {
        if (cache.itemsDict) return;
        cache.itemsDict = {};
        cache.searchCacheInfo = null;
        cache.fetchDone = false;
        cache.jsonsFetched = {};
        cache.deleted_ids = {};
    }

    function _getCacheInfoFromServer(cache, onDone) {
        if (cache.searchCacheInfo && !cache.searchCacheInfo.dirty && !cache.searchCacheInfo.tryAfterDelay) return onDone(true);
        nlServerApi.searchCacheGetInfo({cachetype: cache.cachetype}).then(function(data) {
            cache.searchCacheInfo = data;
            if (data.tryAfterDelay) {
                nl.timeout(function() {
                    _getCacheInfoFromServer(cache, onDone);
                }, 5000);
                return;
            }
            onDone(true);
        }, function(err) {
            cache.searchCacheInfo = {};
            onDone(false);
        });
    }

    function _processNextCacheJson(cache, resolve) {
        _getNextCacheJsonFromServer(cache, function(status, jsonContent, fileInfoId) {
            if (!status) return _ret(cache, resolve);
            cache.fetchDone = !cache.searchCacheInfo.dirty && !cache.searchCacheInfo.tryAfterDelay && !_getNextFileInfo(cache);
            _updatedDeletedIds(cache, jsonContent, fileInfoId);
            _updateItemsDict(cache, jsonContent.items || {}, fileInfoId);
            var fileInfos = ((cache.searchCacheInfo || {}).info || {}).file_infos || [];
            if (fileInfos.length > 1 && Object.keys(cache.jsonsFetched).length < 2) { 
                // Initially fecth upto 2 files
                return _processNextCacheJson(cache, resolve);
            }
            return _ret(cache, resolve);
        });
    }

    function _getNextCacheJsonFromServer(cache, onDone) {
        var fileInfo = _getNextFileInfo(cache);
        if (!fileInfo) {
            return onDone(true, {});
        }
        nlServerApi.searchCacheGetJson(cache.cachetype, fileInfo.id).then(function(data) {
            cache.jsonsFetched[fileInfo.id] = fileInfo.versionstamp;
            onDone(true, (data || {}).data, fileInfo.id);
        }, function() {
            onDone(false, {}, fileInfo.id);
        });
    }

    function _getNextFileInfo(cache) {
        var fileInfos = ((cache.searchCacheInfo || {}).info || {}).file_infos || [];
        for (var i=0; i< fileInfos.length; i++) {
            var fileInfo = fileInfos[i];
            if (fileInfo.id in cache.jsonsFetched && 
                cache.jsonsFetched[fileInfo.id] == fileInfo.versionstamp) continue;
            return fileInfo;
        }
        return null;
    }

    function _updateItemsDict(cache, itemsInJson, fileInfoId) {
        for(var itemId in itemsInJson) {
            var item = itemsInJson[itemId];
            item.fileInfoId = fileInfoId;
            var itemInCache = cache.itemsDict[itemId] || {};
            if (!itemInCache) {
                cache.itemsDict[itemId] = item;
                continue;
            }
            var updated = nl.fmt.json2Date(item.updated);
            var updatedInCache = nl.fmt.json2Date(itemInCache.updated);
            if (updated < updatedInCache) continue;
            cache.itemsDict[itemId] = item;
        }
        for(var itemId in cache.deleted_ids) {
            if(!(itemId in cache.itemsDict)) continue;
            var fileInfoId = cache.deleted_ids[itemId];
            if (cache.itemsDict[itemId].fileInfoId > fileInfoId) continue;
            delete cache.itemsDict[itemId];
        }
    }

    function _updatedDeletedIds(cache, jsonContent, fileInfoId) {
        var deletedIds = cache.deleted_ids;
        cache.deleted_ids = {};
        for (var objid in deletedIds) {
            if (deletedIds[objid] != fileInfoId) cache.deleted_ids[objid] = deletedIds[objid];
        }
        deletedIds = jsonContent.deleted_ids || {};
        for (var objid in deletedIds) {
            cache.deleted_ids[objid] = fileInfoId;
        }
    }

}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

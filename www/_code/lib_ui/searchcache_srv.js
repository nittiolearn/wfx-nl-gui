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
        _caches = {published_course: {cachetype: 'published_course'}};
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
    function _getCache(cachetype) {
        if (!_caches) return null;
        return _caches[cachetype] || null;
    }

    function _getItems(cachetype, resolve) {
        var cache = _getCache(cachetype);
        if (!cache) return resolve({}, false);
        _initCache(cache);
        if (cache.fetchDone) return resolve(cache.itemsDict, false);
        nlDlg.popupStatus('Fetching data from server ...', false);
        nlDlg.showLoadingScreen();
        _getCacheInfoFromServer(cache, function(status, searchCacheInfo) {
            if (!status) return _ret(cache, resolve);
            _getCacheJsonFromServer(cache, searchCacheInfo, function(status, jsonContent) {
                if (!status) return _ret(cache, resolve);
                if (jsonContent.deleted_ids) cache.deleted_ids = jsonContent.deleted_ids;
                _updateItemsDict(cache, jsonContent.items || {});
                return _ret(cache, resolve);
            });
        });
    }
    function _ret(cache, resolve) {
        nlDlg.popdownStatus(0);
        nlDlg.hideLoadingScreen();
        return resolve(cache.itemsDict, !cache.fetchDone);
}

    function _initCache(cache) {
        if (cache.itemsDict) return;
        cache.itemsDict = {};
        cache.fetchDone = false;
        cache.jsonsFetched = {};
        cache.deleted_ids = {};
    }

    function _getCacheInfoFromServer(cache, onDone) {
        nlServerApi.searchCacheGetInfo({cachetype: cache.cachetype}).then(function(data) {
            if (data.tryAfterDelay) {
                nl.timeout(function() {
                    _getCacheInfoFromServer(cache, resolve);
                }, 5000);
            }
            cache.fetchDone = data.dirty ? false : true;
            onDone(true, data);
        }, function(err) {
            onDone(false, {});
        });
    }

    function _getCacheJsonFromServer(cache, searchCacheInfo, onDone) {
        var fileInfos = (searchCacheInfo.info || {}).file_infos || [];
        for (var i=0; i<fileInfos.length; i++) {
            var fileInfo = fileInfos[i];
            if (fileInfo.id in cache.jsonsFetched && 
                cache.jsonsFetched[fileInfo.id] == fileInfo.versionstamp) continue;
            nlServerApi.searchCacheGetJson(cache.cachetype, fileInfo.id)
            .then(function(data) {
                onDone(true, (data || {}).data);
            }, function() {
                onDone(false, {});
            });
            return;
        }
        // Checked all the items and nothing more to fetch!
        onDone(false, {});
    }

    function _updateItemsDict(cache, itemsInJson) {
        for(var itemId in itemsInJson) {
            var item = itemsInJson[itemId];
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
    }

}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

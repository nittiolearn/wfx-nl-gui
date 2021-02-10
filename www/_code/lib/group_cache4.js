(function() {

//-------------------------------------------------------------------------------------------------
// group_cache4.js: Fetches and caches all group info and users of group using group_cache4
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.group_cache4', [])
    .service('nlGroupCache4', NlGroupCache4);
}

//-------------------------------------------------------------------------------------------------
var NlGroupCache4 = ['nl', 'nlServerApi', 'nlConfig', 'nlDlg',
function(nl, nlServerApi, nlConfig, nlDlg) {
	var progressTracker = new ProgressTracker(nl, nlDlg);
	var context = null;

    this.get = function(skipUsers, reload, grpid) {
		context = {skipUsers: skipUsers, reload: reload, grpid: grpid, grpCache: _defGrpCache()};
    	return nl.q(function(resolve, reject) {
			_loadFromDb(function(data) {
				context.grpCache = data || _defGrpCache();
				_fetchFromServerIfNeeded(function() {
					progressTracker.done();
					resolve(_getConsolidatedData(context.grpCache));
				});
			});
		});
    };

	//--------------------------------------------------------------------------------
	// Async Functions called from get()
	function _fetchFromServerIfNeeded(resolve) {
		var grpCache = context.grpCache;
		if (context.reload || _shallGetCacheRecord(grpCache)) {
			_getGroupCache4Record(context.grpid, function(gc4) {
				if (!gc4) return resolve();
				grpCache.gc4 = gc4;
				_fetchCacheFilesIfNeeded(resolve);
			});
			return;
		}
		_fetchCacheFilesIfNeeded(resolve);
	}

	function _getGroupCache4Record(grpid, resolve) {
		progressTracker.serverCall();
		nlServerApi.jsonCacheGet({cache_type: 'group_cache4', grpid: grpid}).then(function(ret) {
			if (!ret) return resolve(null);
			_jsonToDictAttrs(ret, ['info', 'delta_info'], 'dict');
			_jsonToDictAttrs(ret, ['created', 'updated'], 'date');
			_touch(context.grpCache);
			resolve(ret);
		}, function(error) {
			resolve(null);
		});
	}

	function _fetchCacheFilesIfNeeded(resolve) {
		if (context.skipUsers) return resolve();
		var grpCache = context.grpCache;

		var allFileInfos = _getAllFileInfosAsDict(grpCache.gc4);
		if (_shallClearCache(grpCache.fetchedCacheFiles, allFileInfos)) {
			grpCache.fetchedCacheFiles = {};
			grpCache.users = {};
		}

		var pendingFetches = [];
		for (var vstamp in allFileInfos) {
			var finfo = allFileInfos[vstamp];
			if (vstamp in grpCache.fetchedCacheFiles) continue;
			pendingFetches.push(finfo);
		}

		_fetchCacheFilesFromPos(0, pendingFetches, resolve);
	}

	function _fetchCacheFilesFromPos(pos, pendingFetches, resolve) {
		if (pos >= pendingFetches.length) return resolve();
		progressTracker.serverCall(pos, pendingFetches.length);

		var finfo = pendingFetches[pos];
		var data = {table: 'group_cache4', recid: finfo.genid, field: nl.fmt2('id{}.json', finfo.id)};
		nlServerApi.jsonFieldStream(data).then(function(users) {
			if (!users) {
				_fetchCacheFilesFromPos(pos+1, pendingFetches, resolve);
				return;
			}
			users = angular.fromJson(users);
			_mergeUsers(context.grpCache.users, users);
			context.grpCache.fetchedCacheFiles[finfo.vstamp] = true;
			_saveToDb(function() {
				_fetchCacheFilesFromPos(pos+1, pendingFetches, resolve);
			});
		}, function(error) {
			_fetchCacheFilesFromPos(pos+1, pendingFetches, resolve);
		});
	}

	//--------------------------------------------------------------------------------
	// Sync Functions 
	function _defGrpCache() {
    	return {gc4: null, users: {}, fetchedCacheFiles: {}, clientUpdated: null};
    }

	function _loadFromDb(resolve) {
		nlConfig.loadFromDb(_dbkey(context.grpid), resolve);
	}
    
	function _saveToDb(resolve) {
		nlConfig.saveToDb(_dbkey(context.grpid), context.grpCache, resolve);
	}

	function _dbkey(grpid) {
		var dbkey = 'group_cache4';
		if (grpid) dbkey += '.' + grpid;
		return dbkey;
	}

	var _CACHE_TTL_MS = 30*60*1000;
	function _shallGetCacheRecord(grpCache) {
		if (!grpCache.clientUpdated) return true;
		if ((new Date()).getTime() - grpCache.clientUpdated > _CACHE_TTL_MS) return true;
		var gc4 = grpCache.gc4;
		if (!gc4 || !gc4.info || !gc4.delta_info) return true;
		return false;
	}

	function _getAllFileInfosAsDict(gc4) {
		var allFileInfos = {};
		_addFileInfosToDict(gc4.delta_info.fileinfos, allFileInfos);
		_addFileInfosToDict(gc4.info.active, allFileInfos);
		_addFileInfosToDict(gc4.info.inactive, allFileInfos);
		return allFileInfos;
	}

	function _addFileInfosToDict(finfos, allFileInfos) {
		if (!finfos) finfos = [];
		for (var i=0; i<finfos.length; i++) {
			var finfo = finfos[i];
			allFileInfos[finfo.id] = finfo;
		}
	}

	function _shallClearCache(fetchedCacheFiles, allFileInfos) {
		for (var vstamp in fetchedCacheFiles) {
			if (!(vstamp in allFileInfos)) return true;
		}
		return false;

	}
	
	function _getConsolidatedData(grpCache) {
		var ret = (grpCache.gc4.delta_info || {}).grpinfo || {};
		ret['users'] = grpCache.users;
		return ret;
	}

	function _touch(grpCache) {
		grpCache.clientUpdated = (new Date()).getTime();
	}

	var UPDATED_COL_POS = 6;
	function _mergeUsers(allUsers, users) {
		for (var userId in users) {
			var user = users[userId];
			user[UPDATED_COL_POS] = nl.fmt.json2Date(user[UPDATED_COL_POS]);
			if (userId in allUsers && allUsers[userId][UPDATED_COL_POS] > 
				user[UPDATED_COL_POS]) continue;
			allUsers[userId] = user;
		}
	}

	function _jsonToDictAttrs(inputDict, attrs, convertTo) {
        if (!inputDict) return;
        for (var i=0; i<attrs.length; i++) {
			var attr = attrs[i];
			if (!inputDict[attr]) continue;
			if (convertTo == 'dict') {
				inputDict[attr] = angular.fromJson(inputDict[attr]);
			} else if (convertTo == 'date') {
				inputDict[attr] = nl.fmt.json2Date(inputDict[attr]);
			}
		}
	}
}];

//-------------------------------------------------------------------------------------------------
function ProgressTracker(nl, nlDlg) {
	var _popupPresent = false;
	
	this.serverCall = function(pos, total) {
		if (!pos || !total) {
			nlDlg.popupStatus('Fetching user list ...', false);
			_popupPresent = true;
			return;
		}
		var perc = Math.round(pos/total*100);
		if (perc == 100) return;
		nlDlg.popupStatus(nl.fmt2('Fetching user list ({}% done) ...', perc), false);
		_popupPresent = true;
	};

	this.done = function() {
		if (_popupPresent) nlDlg.popdownStatus(0);
	};
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

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

    this.isEnabled = function(userInfo) {
		var grpGc4 = ((userInfo.groupinfo || {}).features || {}).gc4;
		var params = nl.location.search();
		return grpGc4 == 'enabled' && params.gc4 != 'disabled'|| grpGc4 == 'test' && params.gc4 == 'enabled';
	};

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

	this.getDeletedCacheFiles = function() {
		var gc4 = context.grpCache.gc4;
		var fileInfos = gc4.info.fileInfos.deleted || [];
		return fileInfos;
	};

	this.getUsersFromDeletedCacheFile = function(finfo, resolve) {
		if (finfo.vstamp in context.grpCache.fetchedCacheFiles) {
			return resolve(context.grpCache.fetchedCacheFiles[finfo.vstamp]);
		}
		var grpObj = _getGroupInfo(context.grpCache);
		var data = {grpid: grpObj.grpid, table: 'group_cache4', recid: finfo.genid, field: nl.fmt2('id{}.json', finfo.id)};
		nlServerApi.jsonFieldStream(data).then(function(resp) {
			if (!resp || !resp.data) {
				return resolve({});
			}
			var users = resp.data;
			context.grpCache.fetchedCacheFiles[finfo.vstamp] = users;
			_saveToDb(function() {
				resolve(users);
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
		if (_shallClearCache(grpCache)) {
			grpCache.fetchedCacheFiles = {};
			grpCache.users = {};
		}

		var grpObj = _getGroupInfo(context.grpCache);
		var fetchPromises = [];
		for (var vstamp in allFileInfos) {
			var finfo = allFileInfos[vstamp];
			if (vstamp in grpCache.fetchedCacheFiles) continue;

			var data = {grpid: grpObj.grpid, table: 'group_cache4', recid: finfo.genid, field: nl.fmt2('id{}.json', finfo.id)};
			var fetchPromise = nlServerApi.jsonFieldStream(data);
			fetchPromises.push({promise: fetchPromise, vstamp: finfo.vstamp});
		}
		_waitForPromisesFromPos(0, fetchPromises, grpObj.grpid, resolve);
	}

	function _waitForPromisesFromPos(pos, fetchPromises, grpid, resolve) {
		if (pos >= fetchPromises.length) return resolve();
		progressTracker.serverCall(pos, fetchPromises.length);

		var fetchPromise = fetchPromises[pos];
		fetchPromise.promise.then(function(resp) {
			if (!resp || !resp.data) {
				_waitForPromisesFromPos(pos+1, fetchPromises, grpid, resolve);
				return;
			}
			var users = resp.data;
			_mergeUsers(context.grpCache.users, context.grpCache.deletedUsers, users);
			context.grpCache.fetchedCacheFiles[fetchPromise.vstamp] = true;
			_saveToDb(function() {
				_waitForPromisesFromPos(pos+1, fetchPromises, grpid, resolve);
			});
		}, function(error) {
			_waitForPromisesFromPos(pos+1, fetchPromises, grpid, resolve);
		});
	}

	//--------------------------------------------------------------------------------
	// Sync Functions 
	function _defGrpCache() {
    	return {gc4: null, users: {}, deletedUsers: {}, 
				fetchedCacheFiles: {}, // Dict vstamp -> true/false (or dict user in case of deleted users)
				clientUpdated: null, currentGenerationId: 0, data_version: 0};
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
		_addFileInfosToDict(gc4.delta_info.fileInfos, allFileInfos);
		_addFileInfosToDict(gc4.info.fileInfos.active, allFileInfos);
		_addFileInfosToDict(gc4.info.fileInfos.inactive, allFileInfos);
		return allFileInfos;
	}

	function _addFileInfosToDict(finfos, allFileInfos) {
		if (!finfos) finfos = [];
		for (var i=0; i<finfos.length; i++) {
			var finfo = finfos[i];
			allFileInfos[finfo.vstamp] = finfo;
		}
	}

	function _shallClearCache(grpCache) {
		var info = grpCache.gc4.info || {};
		if (grpCache.currentGenerationId == info.currentGenerationId &&
			grpCache.data_version == info.data_version) {
			return false;
		}
		grpCache.currentGenerationId = info.currentGenerationId;
		grpCache.data_version = info.data_version;
		return true;
	}
	
	function _getGroupInfo(grpCache) {
		if (!grpCache.gc4) return {};
		var ret = (grpCache.gc4.delta_info || {}).grpinfo || {};
		_unpruneOuTree(null, ret.outree || []);
		return ret;
	}

	function _unpruneOuTree(parentId, outree) {
		outree.forEach(function(item){
			if (!("id" in item)) {
				item.id = parentId ? parentId + "." + item.text : item.text;
			};
			if ("children" in item) {
				_unpruneOuTree(item.id, item.children);
			};
		});
	}

	function _getConsolidatedData(grpCache) {
		for (var userId in grpCache.deletedUsers) {
			var user = grpCache.deletedUsers[userId];
			if (!(userId in grpCache.users) || 
				grpCache.users[UPDATED_COL_POS] > user[UPDATED_COL_POS])
				continue;
			delete grpCache.users[userId];
		}
		var ret = _getGroupInfo(grpCache);
		ret['users'] = grpCache.users;
		return ret;
	}

	function _touch(grpCache) {
		grpCache.clientUpdated = (new Date()).getTime();
	}

	var UPDATED_COL_POS = 6;
	var DELETED_COL_POS = 17;
	function _mergeUsers(allUsers, deletedUsers, users) {
		for (var userId in users) {
			var user = users[userId];
			userId = '' + userId;
			user[UPDATED_COL_POS] = nl.fmt.json2Date(user[UPDATED_COL_POS]);
			var masterDict = user[DELETED_COL_POS] ? deletedUsers : allUsers;
			if (userId in masterDict && masterDict[userId][UPDATED_COL_POS] > 
				user[UPDATED_COL_POS]) continue;
			masterDict[userId] = user;
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

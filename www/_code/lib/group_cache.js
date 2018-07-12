(function() {

//-------------------------------------------------------------------------------------------------
// group_cache.js: Fetches and caches all group info and users of group
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.group_cache', [])
    .service('nlGroupCache', NlGroupCache);
}

//-------------------------------------------------------------------------------------------------
var NlGroupCache = ['nl', 'nlServerApi', 'nlConfig', 'nlDlg',
function(nl, nlServerApi, nlConfig, nlDlg) {
	var self = this;
	var progressTracker = new ProgressTracker(nl, nlDlg);

    this.get = function(reload, grpid, max) {
    	var context = {grpid: grpid, max: max, dbkey: _dbkey(grpid), grpCache: _defGrpCache()};
    	return nl.q(function(resolve, reject) {
			nlConfig.loadFromDb(context.dbkey, function(data) {
				context.grpCache = data || _defGrpCache();
				if (!reload && _isUptodate(context.grpCache)) {
					return resolve(_getConsolidatedData(context.grpCache));
				}
	    		_fetchFromServer(context, function(grpCache) {
		    		grpCache = _getConsolidatedData(grpCache);
	    			progressTracker.done();
		    		resolve(grpCache);
	    		}, function(error) {
	    			progressTracker.done();
		    		reject(error);
	    		});
			});
    	});
    };
    
    function _defGrpCache() {
    	return {versionstamps: {}, dataReceived: {}};
    }

	function _fetchFromServer(context, resolve, reject) {
		progressTracker.serverCall(context.grpCache);
		var data = {versionstamps: context.grpCache.versionstamps, max: context.max};
		if (context.grpid) data.grpid = context.grpid;
		nlServerApi.groupGetInfo3(data).then(function(serverResult) {
			_mergeGrpCache(context, serverResult, function() {
				if (_isUptodate(context.grpCache)) return resolve(context.grpCache);
				_fetchFromServer(context, resolve, reject);
			});
		}, function(error) {
			reject(false);
		});
	}

	function _mergeGrpCache(context, serverResult, resolve) {
		var grpCache = context.grpCache;
		_touch(grpCache);
		grpCache.cacheTtlMills = serverResult.cacheTtlMills;
		for(var bucketid in grpCache.versionstamps) {
			var svstamp = serverResult.versionstamps[bucketid];
			var cvstamp = grpCache.versionstamps[bucketid];
			if (svstamp && svstamp == cvstamp) continue;
			grpCache.dataReceived[bucketid] = null;
		}
		grpCache.versionstamps = serverResult.versionstamps;
		for(var bucketid in serverResult.jsons) {
			grpCache.dataReceived[bucketid] = angular.fromJson(serverResult.jsons[bucketid]);
		}
		for(var bucketid in grpCache.versionstamps) {
			if (grpCache.dataReceived[bucketid]) continue;
			grpCache.versionstamps[bucketid] = '';
		}
		nlConfig.saveToDb(context.dbkey, grpCache, function() {
			resolve(true);
		});
	}
			
	function _touch(grpCache) {
		grpCache.clientUpdated = (new Date()).getTime();
	}

	function _isUptodate(grpCache) {
		if (!grpCache.cacheTtlMills || !grpCache.clientUpdated) return false;
		if ((new Date()).getTime() - grpCache.clientUpdated > grpCache.cacheTtlMills) return false;
		var versionstamps = grpCache.versionstamps || {};
		var dataReceived = grpCache.dataReceived || {};
		if (Object.keys(versionstamps).length < 2) return false;
		for (var k in versionstamps) {
			if (!versionstamps[k] || !dataReceived[k]) return false;
		}
		return true;
	}
	
	function _getConsolidatedData(grpCache) {
		if (! 'b0' in grpCache.dataReceived) return {};
		var ret = grpCache.dataReceived['b0'];
		ret['users'] = {};
		var nBuckets = Object.keys(grpCache.versionstamps).length;
		for (var b=1; b<nBuckets; b++) {
			var bucketid = 'b' + b;
			if (! bucketid in grpCache.dataReceived) return {};
			var bucketUsers = grpCache.dataReceived[bucketid].users;
			_consolidateUsers(ret['users'], bucketUsers);			
		}
		return ret;
	}

	function _consolidateUsers(consolidated, delta) {
		for (var userid in delta) {
			var deltaUser = delta[userid];
			if (userid in consolidated && _isDeltaOlder(consolidated[userid], deltaUser)) continue;
			consolidated[userid] = deltaUser;
		}
	}

	var UPDATED_COL_POS = 6;
	function _isDeltaOlder(cUser, deltaUser) {
        var cUpdated = nl.fmt.json2Date(cUser[UPDATED_COL_POS]);
        var deltaUpdated = nl.fmt.json2Date(deltaUser[UPDATED_COL_POS]);
        return deltaUpdated > cUpdated;
	}
	
	function _dbkey(grpid) {
		var dbkey = 'group_cache3';
		if (grpid) dbkey += '.' + grpid;
		return dbkey;
	}

}];

//-------------------------------------------------------------------------------------------------
function ProgressTracker(nl, nlDlg) {
	var _popupPresent = false;
	
	this.serverCall = function(grpCache) {
		var versionstamps = grpCache.versionstamps || {};
		var dataReceived = grpCache.dataReceived || {};
		var total = Object.keys(versionstamps).length;
		if (total < 2) return;
		var totalDone = 0;
		for (var k in versionstamps) {
			if (!versionstamps[k] || !dataReceived[k]) continue;
			totalDone++;
		}
		var perc = Math.round((totalDone-1)/(total-1)*100);
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

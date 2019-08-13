(function() {
//-------------------------------------------------------------------------------------------------
// lr_drilldown.js; nlLrDrillDownSrv; nl-lr-drilldown (all content of the tab)
// move status counts directive to drilldown.js
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.lr_drilldown', [])
    .service('nlLrDrilldown', NlLrDrilldownSrv)
    .directive('nlLrDrilldownTab', NlLrDrilldownDirective);
}
//-------------------------------------------------------------------------------------------------

var NlLrDrilldownSrv = ['nlLrHelper',
function(nlLrHelper) {
    var _orgToSubOrgDict = {};
    var _attritionObj = {};
    var _customStartedStatusObj = {};
    var _isSubOrgEnabled = false;
    var StatsCount = new StatsCounts();

    this.init = function(nlGroupInfo) {
		_orgToSubOrgDict = nlGroupInfo.getOrgToSubOrgDict();
        _isSubOrgEnabled = nlGroupInfo.isSubOrgEnabled();
    };

    this.clearStatusCountTree = function() {
            _attritionObj = {};
            _customStartedStatusObj = {};
            StatsCount.clear();
    };

    this.getStatsCountDict = function() {
        return StatsCount.statsCountDict();
    };

    this.getAttritionObj = function() {
        var array = _getSortedArrayFromObj(_attritionObj);
        return array;
    }

    this.getCustomStatusObj = function() {
        var array = _getSortedArrayFromObj(_customStartedStatusObj);
        return array;
    }

    this.addCount = function(record) {
        var contentid = record.raw_record.lesson_id;
        var ou = record.user.org_unit;
        var subOrg = _isSubOrgEnabled ? _orgToSubOrgDict[ou] : ou;
        if(!subOrg) subOrg = "Others";
        var statusCntObj = _getStatusCountObj(record);
        _addCount(contentid, subOrg, _isSubOrgEnabled ? ou : '', statusCntObj, record.repcontent.name);
    }

    function _getSortedArrayFromObj(dict) {
        var items = Object.keys(dict).map(function(key) {
                return [key, dict[key]];
            });
          
        items.sort(function(first, second) {
            return first[1] - second[1];
        });
        var ret = [];
        for(var i=0; i<items.length; i++) {
            var array = items[i];
            ret.push(array[0]);
        }
        return ret;
    }

    function _addCount(cid, subOrg, ou, statusObj, name) {
        StatsCount.updateRootCount(0, statusObj);
        StatsCount.updateRootCount(cid, statusObj, name);
        StatsCount.updateSuborgCount(0, subOrg, statusObj, _isSubOrgEnabled);
        StatsCount.updateSuborgCount(cid, subOrg, statusObj, _isSubOrgEnabled);
        if(_isSubOrgEnabled) {
            StatsCount.updateOuCount(0, subOrg, ou, statusObj)
            StatsCount.updateOuCount(cid, subOrg, ou, statusObj)
        }
    }

    function _getStatusCountObj(record) {
        var statsCountObj = {};
		statsCountObj['cntTotal'] = 1;
         if(record.user.state == 0) {
            _updateInactiveUserData(record, statsCountObj);
        } else {
            _updateActiveUserData(record, statsCountObj);
        }
        return statsCountObj;
    }

    function _updateInactiveUserData(record, statsCountObj) {
       statsCountObj['cntInactive'] = 1;
        var status = record.stats.status;
        var statusStr = status['txt'];
        if(statusStr.indexOf('attrition') == 0) {
            statsCountObj['attrition'] = 1;
            statsCountObj[statusStr] = 1;
            if(!(statusStr in _attritionObj))  
                _attritionObj[statusStr] = 1;
            else 
                _attritionObj[statusStr] += 1;
            return;
        }
        if(status.id == nlLrHelper.STATUS_PENDING || status.id == nlLrHelper.STATUS_STARTED) {
			statsCountObj['pendingInactive'] = 1;
            return;
        }
        statsCountObj['doneInactive'] = 1;
	}

	function _updateActiveUserData(record, statsCountObj) {
        var status = record.stats.status;
        var statusStr = status['txt'];
		statsCountObj['cntActive'] = 1;
        statsCountObj['timeSpent'] = record.stats.timeSpentSeconds;
        if(status.id == nlLrHelper.STATUS_PENDING || statusStr == 'started') {
            statsCountObj['pending'] = 1;
            return;
        }
        if(status.id == nlLrHelper.STATUS_STARTED) {
            statsCountObj[statusStr] = 1;
            statsCountObj['started'] = 1;
            if(statusStr !== 'started') {
                if(!(statusStr in _customStartedStatusObj)) 
                    _customStartedStatusObj[statusStr] = 1;
                else
                    _customStartedStatusObj[statusStr] += 1;
            }
            return;
        } else if(statusStr.indexOf('attrition') == 0) {
            statsCountObj[statusStr] = 1;
            statsCountObj['attrition'] = 1;
            statsCountObj['cntActive'] = 0;
            statsCountObj['cntInactive'] = 1;
            if(!(statusStr in _attritionObj))  
                _attritionObj[statusStr] = 1;
            else 
                _attritionObj[statusStr] += 1;
            return;
        }
        statsCountObj['completed'] = 1;
        statsCountObj['percScore'] = record.stats.percScore;
        if(status.id == nlLrHelper.STATUS_FAILED) {
            statsCountObj['failed'] = 1;
            return;
        }

		statsCountObj['certified'] = 1;
		if(record.stats.avgAttempts == 1) {
			statsCountObj['certInFirstAttempt'] = 1;
		} else if(record.stats.avgAttempts > 1 && record.stats.avgAttempts <= 2) {
			statsCountObj['certInSecondAttempt'] = 1;
		} else {
			statsCountObj['certInMoreAttempt'] = 1;
		}
	}
}];

//-------------------------------------------------------------------------------------------------
// NlLrDrilldown directive to display drill down tab
//-------------------------------------------------------------------------------------------------

var NlLrDrilldownDirective = [
function() {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/learning_reports/lr_drilldown_tab.html',
        scope: {
            drilldown: '='
        },
        link: function($scope, iElem, iAttrs) {
            $scope.generateDrillDownArray = function(item) {
                $scope.$parent.$parent.generateDrillDownArray(item);
            };

            $scope.onDetailsClick = function(e, item, columns) {
                $scope.$parent.$parent.onDetailsClick(e, item, columns);
            };
        }
    }
}];
//-------------------------------------------------------------------------------------------------
// StatsCount constructer which get update on each record read
//-------------------------------------------------------------------------------------------------

function StatsCounts(nl) {
    var _statusCountTree = {}; //Is an object {0: {cnt: {}, children:{subgorg1: {cnt: {}, children: {ou1: {cnt: {}}}}}}}
    var self = this;

    var statsCountItem = {cntTotal: 0, cntActive: 0, cntInactive: 0, doneInactive: 0, percActive: 0, percInactive: 0, pendingInactive: 0, 
                          completed: 0, certified: 0, pending: 0, failed: 0, percCompleted: 0, percCertified: 0, percPending: 0, percFailed: 0, 
                          certInFirstAttempt: 0, certInSecondAttempt: 0, certInMoreAttempt:0, 
                          percCertInFirstAttempt: 0, percCertInSecondAttempt: 0, percCertInMoreAttempt: 0,
                          percScore: 0, avgScore: 0, timeSpent: 0, isOpen: false, started: 0, percAttrition: 0, percTotal: 100};
    
    this.clear = function() {
        _statusCountTree = {};
    };

    this.statsCountDict = function() {
        return _statusCountTree;
    }

    this.getRoot = function(rootId, name) {
        if (rootId in _statusCountTree) return _statusCountTree[rootId].cnt;
        var stats = angular.copy(statsCountItem)
            stats['isFolder'] = true;
            stats['name'] = rootId == 0 ? 'All' : name;
        _statusCountTree[rootId] = {cnt: stats, children: {}};
        return _statusCountTree[rootId].cnt;
    };

    this.getSuborg = function(rootId, subOrgId, isFolder) {
        var  suborgs = _statusCountTree[rootId].children;
        if (subOrgId in suborgs) return suborgs[subOrgId].cnt;
        var stats = angular.copy(statsCountItem)
        stats['isFolder'] = isFolder;
        stats['indentation'] = 24;
        stats['name'] = subOrgId;
        suborgs[subOrgId] = {cnt: stats};
        if(isFolder) suborgs[subOrgId]['children'] = {}
        return suborgs[subOrgId].cnt;
    }

    this.getOu = function(rootId, subOrgId, ouid) {
        var  ous = _statusCountTree[rootId].children[subOrgId].children;
        if (ouid in ous) return ous[ouid].cnt;
        var stats = angular.copy(statsCountItem)
        stats['indentation'] = 44;
        stats['name'] = ouid;
        ous[ouid] = {cnt: angular.copy(stats)};
        return ous[ouid].cnt;        
    }

    this.updateRootCount = function(contentid, statusCnt, name) {
        //contentid = 0 for updating all item in the _statusCountTree. contentid = courseid/lesson_id for all other records.
        var updatedStats = self.getRoot(contentid, name);
        _updateStatsCount(updatedStats, statusCnt);
    }

    this.updateSuborgCount = function(contentid, subOrgId, statusCnt, isFolder) {
        //isFolder is false, then there is no suborg enabled for group. This object is considered as ou.
        var updatedStats = self.getSuborg(contentid, subOrgId, isFolder);
        _updateStatsCount(updatedStats, statusCnt);
    }

    this.updateOuCount = function(contentid, subOrgId, ouid, statusCnt) {
        //This happens only if the suborg is enabled for group.
        var updatedStats = self.getOu(contentid, subOrgId, ouid);
        _updateStatsCount(updatedStats, statusCnt);
    } 

    function _updateStatsCount(updatedStats, statusCnt) { 
        //updatedStats is object fetched from _statusCountTree. Value from statusCnt object are added to updatedStats
        for(var key in statusCnt) {
            if(!(key in updatedStats)) updatedStats[key] = 0;
            updatedStats[key] += statusCnt[key];
        }
        _updateStatsPercs(updatedStats);
    }

    function _updateStatsPercs(updatedStats) {
        updatedStats.percActive = Math.round(updatedStats.cntActive*100/updatedStats.cntTotal);
        updatedStats.percInactive = Math.round(updatedStats.cntInactive*100/updatedStats.cntTotal);
        updatedStats.percAttrition = Math.round(updatedStats.attrition*100/updatedStats.cntTotal)
        if(updatedStats.cntTotal > 0) {
            updatedStats.percCompleted = Math.round(updatedStats.completed*100/updatedStats.cntTotal);
            updatedStats.percCertified = Math.round(updatedStats.certified*100/updatedStats.cntTotal);
            updatedStats.percFailed = Math.round(updatedStats.failed*100/updatedStats.cntTotal);
            updatedStats.percPending = Math.round(updatedStats.pending*100/updatedStats.cntTotal);
            updatedStats.percStarted = Math.round(updatedStats.started*100/updatedStats.cntTotal);
            updatedStats.avgScore = (updatedStats.percScore != 0 && updatedStats.completed != 0) ? Math.round(updatedStats.percScore/updatedStats.completed) : 0;
            updatedStats.percCertInFirstAttempt = Math.round(updatedStats.certInFirstAttempt/updatedStats.cntTotal);
            updatedStats.percCertInSecondAttempt = Math.round(updatedStats.certInSecondAttempt/updatedStats.cntTotal);
            updatedStats.percCertInMoreAttempt = Math.round(updatedStats.certInMoreAttempt/updatedStats.cntTotal);
            updatedStats.timeSpentInMins = Math.round(updatedStats.timeSpent/60);
        }
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

(function() {
//-------------------------------------------------------------------------------------------------
// lr_nht.js; NlLrNhtSrv; nl-lr-nht-tab (all content of the tab)
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.learning_reports.lr_nht_srv', [])
    .service('nlLrNht', NlLrNhtSrv);
}
//-------------------------------------------------------------------------------------------------

var NlLrNhtSrv = ['nl','nlReportHelper',
function(nl, nlReportHelper) {
    var _orgToSubOrgDict = {};
    var _customStartedStatusObj = {};
    var _isSubOrgEnabled = false;
    var nhtCounts = new NhtCounts(nl);
    var _batchCount = {};
    this.init = function(nlGroupInfo) {
        _orgToSubOrgDict = nlGroupInfo.getOrgToSubOrgDict();
        _isSubOrgEnabled = nlGroupInfo.isSubOrgEnabled();
    };

    this.clearStatusCountTree = function() {
        _customStartedStatusObj = {};
        _batchCount = {};
        nhtCounts.clear();
    };

    this.getStatsCountDict = function() {
        return nhtCounts.statsCountDict();
    };

    this.addCount = function(record) {
        var assignment = record.raw_record.assignment;
        var ou = record.user.org_unit;
        var subOrg = _isSubOrgEnabled ? _orgToSubOrgDict[ou] : ou;
        if(!subOrg) subOrg = "Others";
        var statusCntObj = _getStatusCountObj(record);
        _addCount(assignment, subOrg, _isSubOrgEnabled ? ou : '', statusCntObj, record.repcontent.name);
    }

    function _addCount(assignment, subOrg, ou, statusObj, name) {
        nhtCounts.updateRootCount(0, statusObj);
        nhtCounts.updateSuborgCount(0, subOrg, statusObj);
        if(_isSubOrgEnabled) {
            nhtCounts.updateOuCount(0, subOrg, ou, statusObj);
        }
        nhtCounts.updateBatchCount(0, subOrg, _isSubOrgEnabled ? ou : null, assignment, statusObj, name);
    }

    function _getStatusCountObj(record) {
        var statsCountObj = {};
        statsCountObj['cntTotal'] = 1;
        statsCountObj['batchid'] = record.raw_record.assignment;
        if(record.user.state == 0) {
            statsCountObj['cntInactive'] = 1;
        } else {
            _updateActiveStatusCounts(record, statsCountObj);
        }
        statsCountObj['delayDays'] = record.stats.delayDays || 0;
        return statsCountObj;
    }

    function _updateActiveStatusCounts(record, statsCountObj) {
        var stats = record.stats;
        var status = stats.status;
        var statusStr = status['txt'];
        statsCountObj['cntActive'] = 1;
        if(status.id == nlReportHelper.STATUS_PENDING) {
            statsCountObj['pending'] = 1;
            return;
        }
        statsCountObj[statusStr] = 1;
    }
}];

//-------------------------------------------------------------------------------------------------
// NhtCounts constructer which get update on each record read
//-------------------------------------------------------------------------------------------------

function NhtCounts(nl) {
    var _statusCountTree = {}; //Is an object {0: {cnt: {}, children:{subgorg1: {cnt: {}, children: {ou1: {cnt: {}}}}}}}
    var self = this;

    var statsCountItem = {cntTotal: 0, batchIdDict: {}, batchTotal:0, delayDays: 0, pending:0, isOpen: false};

    this.clear = function() {
        _statusCountTree = {};
    };

    this.statsCountDict = function() {
        _updateStatsCountTree(_statusCountTree);
        return _statusCountTree;
    };

    this.getRoot = function(rootId, name) {
        if (rootId in _statusCountTree) return _statusCountTree[rootId].cnt;
        var stats = angular.copy(statsCountItem);
            stats['isFolder'] = true;
            stats['name'] = rootId == 0 ? 'All' : name;
        _statusCountTree[rootId] = {cnt: stats, children: {}};
        return _statusCountTree[rootId].cnt;
    };

    this.getSuborg = function(rootId, subOrgId, isFolder) {
        var  suborgs = _statusCountTree[rootId].children;
        if (subOrgId in suborgs) return suborgs[subOrgId].cnt;
        var stats = angular.copy(statsCountItem);
        stats['isFolder'] = true;
        stats['indentation'] = 24;
        stats['name'] = subOrgId;
        suborgs[subOrgId] = {cnt: stats, children: {}};
        return suborgs[subOrgId].cnt;
    };

    this.getOu = function(rootId, subOrgId, ouid, isName, isFolder) {
        var  ous = _statusCountTree[rootId].children[subOrgId].children;
        if (ouid in ous) return ous[ouid].cnt;
        var stats = angular.copy(statsCountItem);
        stats['isFolder'] = isFolder;
        stats['indentation'] = 44;
        stats['name'] = isName ? isName : ouid;
        ous[ouid] = {cnt: angular.copy(stats), children: {}};
        return ous[ouid].cnt;  
    };

    this.getBatch = function(rootId, subOrgId, ouid, batchid, name) {
        var batch = _statusCountTree[rootId].children[subOrgId].children[ouid].children;
        if (batchid in batch) return batch[batchid].cnt;
        var stats = angular.copy(statsCountItem);
        stats['indentation'] = 66;
        stats['name'] = name;
        batch[batchid] = {cnt: angular.copy(stats)};
        return batch[batchid].cnt; 
    };

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
        var updatedStats = self.getOu(contentid, subOrgId, ouid, null, true);
        _updateStatsCount(updatedStats, statusCnt);
    } 

    this.updateBatchCount = function(contentid, subOrgId, ouid, batchid, statusCnt, name) {
        var updatedStats = null;
        if(ouid)
            updatedStats = self.getBatch(contentid, subOrgId, ouid, batchid, name);
        else 
            updatedStats = self.getOu(contentid, subOrgId, batchid, name, false);
        _updateStatsCount(updatedStats, statusCnt);
    }

    function _updateStatsCount(updatedStats, statusCnt) { 
        //updatedStats is object fetched from _statusCountTree. Value from statusCnt object are added to updatedStats
        for(var key in statusCnt) {
            if(key == 'batchid') {
                if(!(statusCnt[key] in updatedStats.batchIdDict)) {
                    updatedStats.batchIdDict[statusCnt[key]] = true
                    updatedStats['batchTotal'] += 1;
                }
                continue;
            }
            if(!(key in updatedStats)) updatedStats[key] = 0;
            updatedStats[key] += statusCnt[key];
        }
    }

    function _updateStatsCountTree(rowObjs) {
        for(var key in rowObjs) {
            var row = rowObjs[key];
            var statsObj = row.cnt;
            _updateStatsPercs(statsObj);
            if(row.children) _updateStatsCountTree(row.children);
        }
    }

    function _updateStatsPercs(updatedStats) {
        if(updatedStats.cntTotal > 0) {
            updatedStats['avgDelay'] = Math.round(updatedStats.delayDays/updatedStats.cntTotal);
        }
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();
    
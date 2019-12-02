(function() {
//-------------------------------------------------------------------------------------------------
// lr_nht.js; NlLrNhtSrv; nl-lr-nht-tab (all content of the tab)
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.learning_reports.lr_nht_srv', [])
    .service('nlLrNht', NlLrNhtSrv);
}
//-------------------------------------------------------------------------------------------------

var NlLrNhtSrv = ['nl','nlReportHelper', 'nlGetManyStore',
function(nl, nlReportHelper, nlGetManyStore) {
    var _orgToSubOrgDict = {};
    var _customStartedStatusObj = {};
    var _isSubOrgEnabled = false;
    var nhtCounts = new NhtCounts(nl, nlGetManyStore);
    var _attritionObj = {};
    this.init = function(nlGroupInfo) {
        _orgToSubOrgDict = nlGroupInfo.getOrgToSubOrgDict();
        _isSubOrgEnabled = nlGroupInfo.isSubOrgEnabled();
    };

    this.clearStatusCountTree = function() {
        _customStartedStatusObj = {};
        _attritionObj = {};
        nhtCounts.clear();
    };

    this.getStatsCountDict = function() {
        return nhtCounts.statsCountDict();
    };

    this.getAttritionArray = function() {
        var array = _getSortedArrayFromObj(_attritionObj);
        return array;
    }

    this.addCount = function(record) {
        var assignment = record.raw_record.assignment;
        var ou = record.user.org_unit;
        var subOrg = _isSubOrgEnabled ? _orgToSubOrgDict[ou] : ou;
        if(!subOrg) subOrg = "Others";
        var statusCntObj = _getStatusCountObj(record);
        nhtCounts.updateBatch(assignment, record)
        _addCount(assignment, subOrg, _isSubOrgEnabled ? ou : '', statusCntObj, record.repcontent.batchname || record.repcontent.name);
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
        statsCountObj['customScores'] = record.stats.customScores || [];
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
        if(statusStr.indexOf('attrition') == 0) {
            statsCountObj[statusStr] = 1;
            statsCountObj['attrition'] = 1;
            if(!(statusStr in _attritionObj))
                _attritionObj[statusStr] = record.stats.progressPerc;
            return;
        }
        if (status.id != nlReportHelper.STATUS_STARTED) {
            statsCountObj['completed'] = 1;
            statsCountObj['percScore'] = record.stats.percScore;
            if(status.id == nlReportHelper.STATUS_FAILED) {
                statsCountObj['failed'] = 1;
                return;
            }
        }
        statsCountObj[statusStr] = 1;
    }

    function _getSortedArrayFromObj(dict) {
        var items = Object.keys(dict).map(function(key) {
                return [key, dict[key]];
            });
          
        items.sort(function(first, second) {
            if(first[1] < second[1]) return 1;
            if(first[1] > second[1]) return -1;
            if(first[1] == second[1]) return 0;
        });
        var ret = [];
        for(var i=0; i<items.length; i++) {
            var array = items[i];
            ret.push(array[0]);
        }
        return ret;
    }
}];

//-------------------------------------------------------------------------------------------------
// NhtCounts constructer which get update on each record read
//-------------------------------------------------------------------------------------------------

function NhtCounts(nl, nlGetManyStore) {
    var _statusCountTree = {}; //Is an object {0: {cnt: {}, children:{subgorg1: {cnt: {}, children: {ou1: {cnt: {}}}}}}}
    var self = this;

    var statsCountItem = {cntTotal: 0, batchIdDict: {}, batchTotal:0, delayDays: 0, pending:0, failed: 0,
        completed: 0, percScore: 0, isOpen: false};
    var _customScores = {};
    var _customScoresArray = [];
    var batches = {};

    this.clear = function() {
        _statusCountTree = {};
        _customScores = {};
        _customScoresArray = [];
    };

    this.updateBatch = function(batchid, report) {
        if(batchid in batches) return;
        batches[batchid] = report;
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
        _updateBatchInfo(updatedStats, batchid);
        _updateStatsCount(updatedStats, statusCnt);
    }

    function _updateBatchInfo(updatedStats, batchid) { 
        if (updatedStats.propertiesUpdated) return;
        var report = batches[batchid];
        var courseAssignment = nlGetManyStore.getAssignmentRecordFromReport(report.raw_record) || {};
        var course = nlGetManyStore.getRecord(nlGetManyStore.getContentKeyFromReport(report.raw_record));
        var actualMsInfo = angular.fromJson(courseAssignment.milestone) || {};
        var plannedMsInfo = courseAssignment.info.msDates || {};
        var modules = course.content.modules || [];
        updatedStats['start'] = report.not_before;
        updatedStats['end'] = report.not_after;
        for(var i=0; i<modules.length; i++) {
            var item = modules[i]
            if(item.type != 'milestone') continue;
            var mstype = item.milestone_type;
            if(!mstype) continue;
            var plannedMs = plannedMsInfo['milestone_'+item.id] || '';
            var actualMs = actualMsInfo[item.id] || {};
            updatedStats[mstype+'planned'] = nl.fmt.fmtDateDelta(plannedMs, null, 'minutes');
            updatedStats[mstype+'actual'] = nl.fmt.fmtDateDelta(actualMs.reached || '', null, 'minutes');
        }
        updatedStats.propertiesUpdated = true;
        return;
    }

    function _updateStatsCount(updatedStats, statusCnt) { 
        //updatedStats is object fetched from _statusCountTree. Value from statusCnt object are added to updatedStats
        for(var key in statusCnt) {
            if(key == 'batchid') {
                if(!(statusCnt[key] in updatedStats.batchIdDict)) {
                    updatedStats.batchIdDict[statusCnt[key]] = true;
                    updatedStats['batchTotal'] += 1;
                }
                continue;
            }
            if(key == 'customScores') {
                var customScores = statusCnt[key];
                for(var i=0; i<customScores.length; i++) {
                    var item = customScores[i];
                    var cntid = item.name+'count';
                    if(!(item.name in _customScores)) {
                        _customScores[item.name] = true;
                        _customScoresArray.push(item.name);
                    }
                    if(!(item.name in updatedStats)) {
                        updatedStats[item.name] = item.score;
                        updatedStats[cntid] = 1;
                    } else {
                        updatedStats[item.name] += item.score;
                        updatedStats[cntid] += 1;
                    }
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
            updatedStats['avgScore'] = (updatedStats.percScore != 0 && updatedStats.completed != 0) ? Math.round(updatedStats.percScore/updatedStats.completed)+' %' : 0;
        }
        for(var i=0; i<_customScoresArray.length; i++) {
            var itemName = _customScoresArray[i];
            if(!(itemName in updatedStats)) continue;
            var percid = 'perc'+itemName;
            var count = itemName+'count';
            updatedStats[percid] = Math.round(updatedStats[itemName]/updatedStats[count])+' %';
        }
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();
    
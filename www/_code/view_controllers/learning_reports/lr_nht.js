(function() {
//-------------------------------------------------------------------------------------------------
// lr_nht.js; NlLrNhtSrv; nl-lr-nht-tab (all content of the tab)
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.learning_reports.lr_nht_srv', [])
    .service('nlLrNht', NlLrNhtSrv)
    .directive('nlLrNhtTab', NlLrNhtDirective);
}
//-------------------------------------------------------------------------------------------------
var _isSubOrgEnabled = false;
var NlLrNhtSrv = ['nl','nlReportHelper', 'nlGetManyStore',
function(nl, nlReportHelper, nlGetManyStore) {
    var _orgToSubOrgDict = {};
    var nhtCounts = null;
    var _attritionObj = {};
    this.init = function(nlGroupInfo) {
        nhtCounts = new NhtCounts(nl, nlGetManyStore, nlGroupInfo);
        _orgToSubOrgDict = nlGroupInfo.getOrgToSubOrgDict();
        _isSubOrgEnabled = nlGroupInfo.isSubOrgEnabled();
    };

    this.clearStatusCountTree = function() {
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
        var batchInfo = _getNhtBatchInfo(record);
        var statusCntObj = _getStatusCountObj(record);
        nhtCounts.updateBatch(assignment, record);
        _addCount(batchInfo, statusCntObj);
    }

    function _getNhtBatchInfo(record) {
        var ou = record.user.org_unit;
        var subOrg = _orgToSubOrgDict[ou] || 'Others';
        var part2 = ou;
        if (ou == subOrg) part2 = 'Others';
        else if (ou.indexOf(subOrg) == 0) part2 = ou.substring(subOrg.length+1);
        var subOrgParts = subOrg.split('.');
        return {partner: subOrgParts[subOrgParts.length -1], lob: part2,
            batchName: record.repcontent.batchname || record.repcontent.name,
            batchType: record.repcontent.batchtype || '',
            batchId: record.raw_record.assignment};
    }

    function _addCount(batchInfo, statusObj) {
        nhtCounts.updateRootCount(statusObj);
        if (_isSubOrgEnabled) nhtCounts.updateSuborgCount(batchInfo, statusObj);
        nhtCounts.updateOuCount(batchInfo, statusObj);
        nhtCounts.updateBatchCount(batchInfo, statusObj);
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
// NlLrNht directive to display Nht tab
//-------------------------------------------------------------------------------------------------
var NlLrNhtDirective = [
function() {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/learning_reports/lr_nht_tab.html',
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
// NhtCounts constructer which get update on each record read
//-------------------------------------------------------------------------------------------------

function NhtCounts(nl, nlGetManyStore, nlGroupInfo) {
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

    this.getRoot = function() {
        var rootId = 0;
        if (rootId in _statusCountTree) return _statusCountTree[rootId].cnt;
        var stats = angular.copy(statsCountItem);
        stats['isFolder'] = true;
        stats['name'] = 'All';
        stats['partner'] = 'All';
        stats['lob'] = '';
        stats['batchName'] = '';
        _statusCountTree[rootId] = {cnt: stats, children: {}};
        return _statusCountTree[rootId].cnt;
    };

    var INDENDATION = 12;
    this.getSuborg = function(batchInfo) {
        var rootItem = _statusCountTree[0];
        var suborgs = rootItem.children;
        var subOrgId = batchInfo.partner;
        if (subOrgId in suborgs) return suborgs[subOrgId].cnt;
        var stats = angular.copy(statsCountItem);
        stats['isFolder'] = true;
        stats['indentation'] = INDENDATION;
        stats['name'] = batchInfo.partner;
        stats['partner'] = batchInfo.partner;
        stats['lob'] = '';
        stats['batchName'] = '';
        suborgs[subOrgId] = {cnt: stats, children: {}};
        return suborgs[subOrgId].cnt;
    };

    this.getOu = function(batchInfo) {
        var rootItem = _statusCountTree[0];
        var ous = rootItem.children;
        if (_isSubOrgEnabled) ous = ous[batchInfo.partner].children;
        if (batchInfo.lob in ous) return ous[batchInfo.lob].cnt;
        var stats = angular.copy(statsCountItem);
        stats['isFolder'] = true;
        stats['indentation'] = (_isSubOrgEnabled ? 2 : 1)*INDENDATION;
        stats['name'] = batchInfo.lob;
        stats['partner'] = batchInfo.partner;
        stats['lob'] = batchInfo.lob;
        stats['batchName'] = '';
        stats['batchtype'] = '';
        ous[batchInfo.lob] = {cnt: angular.copy(stats), children: {}};
        return ous[batchInfo.lob].cnt;
    };

    this.getBatch = function(batchInfo) {
        var rootItem = _statusCountTree[0];
        var ous = rootItem.children;
        if (_isSubOrgEnabled) ous = ous[batchInfo.partner].children;
        var batches = ous[batchInfo.lob].children;
        if (batchInfo.batchId in batches) return batches[batchInfo.batchId].cnt;
        var stats = angular.copy(statsCountItem);
        stats['isFolder'] = false;
        stats['indentation'] = (_isSubOrgEnabled ? 3 : 2)*INDENDATION;
        stats['name'] = batchInfo.batchName;
        stats['partner'] = batchInfo.partner;
        stats['lob'] = batchInfo.lob;
        stats['batchName'] = batchInfo.batchName;
        stats['batchtype'] = batchInfo.batchType || '';
        batches[batchInfo.batchId] = {cnt: angular.copy(stats)};
        return batches[batchInfo.batchId].cnt; 
    };

    this.updateRootCount = function(statusCnt) {
        var updatedStats = self.getRoot();
        _updateStatsCount(updatedStats, statusCnt);
    }

    this.updateSuborgCount = function(batchInfo, statusCnt) {
        var updatedStats = self.getSuborg(batchInfo);
        _updateStatsCount(updatedStats, statusCnt);
    }

    this.updateOuCount = function(batchInfo, statusCnt) {
        var updatedStats = self.getOu(batchInfo);
        _updateStatsCount(updatedStats, statusCnt);
    } 

    this.updateBatchCount = function(batchInfo, statusCnt) {
        var updatedStats = self.getBatch(batchInfo);
        _updateBatchInfo(updatedStats, batchInfo.batchId);
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
        updatedStats['trainer'] = report.repcontent.iltTrainerName || report.repcontent.sendername; 
        updatedStats.batchStatus = '';
        var grpMilestoneDict = _getGroupMilestonesAsDict();
        var allMilestonesReached = true;
        for(var i=0; i<modules.length; i++) {
            var item = modules[i]
            if(item.type != 'milestone') continue;
            var mstype = item.milestone_type;
            if(!mstype) continue;
            var plannedMs = plannedMsInfo['milestone_'+item.id] || '';
            var actualMs = actualMsInfo[item.id] || {};
            updatedStats[mstype+'planned'] = nl.fmt.fmtDateDelta(plannedMs, null, 'minutes');
            updatedStats[mstype+'actual'] = nl.fmt.fmtDateDelta(actualMs.reached || '', null, 'minutes');
            if (!actualMs.reached) allMilestonesReached = false;
            var grpMileStoneObj = grpMilestoneDict[mstype];
            if (actualMs.reached && grpMileStoneObj && grpMileStoneObj.batch_status)
                updatedStats.batchStatus = grpMileStoneObj.batch_status;
        }
        if (allMilestonesReached) updatedStats.batchStatus = 'Closed';
        updatedStats.propertiesUpdated = true;
        return;
    }

    function  _getGroupMilestonesAsDict() {
        var groupInfo = nlGroupInfo.get();
        var milestones = groupInfo.props.milestones || [];
        var ret = {};
        for(var i=0; i<milestones.length; i++) ret[milestones[i].id] = milestones[i];
        return ret;
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
        if (!updatedStats.batchName) updatedStats.batchName = updatedStats.batchTotal;
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
    
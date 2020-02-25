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
    this.init = function(nlGroupInfo) {
        nhtCounts = new NhtCounts(nl, nlGetManyStore, nlGroupInfo);
        _orgToSubOrgDict = nlGroupInfo.getOrgToSubOrgDict();
        _isSubOrgEnabled = nlGroupInfo.isSubOrgEnabled();
    };

    this.clearStatusCountTree = function() {
        nhtCounts.clear();
    };

    this.getStatsCountDict = function() {
        return nhtCounts.statsCountDict();
    };

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
        var subOrgParts = subOrg.split('.');
        return {partner: subOrgParts[subOrgParts.length -1], lob: record.course.contentmetadata.subject,
            batchName: record.repcontent.batchname || record.repcontent.name,
            batchType: record.repcontent.batchtype || '',
            batchId: record.raw_record.assignment};
    }

    function _addCount(batchInfo, statusObj) {
        nhtCounts.updateBatchCount(batchInfo, statusObj);
        nhtCounts.updateRootCount(statusObj);
        if (_isSubOrgEnabled) nhtCounts.updateSuborgCount(batchInfo, statusObj);
        nhtCounts.updateOuCount(batchInfo, statusObj);
    }

    function _getStatusCountObj(record) {
        var statsCountObj = {};
        var stats = record.stats;
        statsCountObj['batchid'] = record.raw_record.assignment;
        statsCountObj['delayDays'] = stats.delayDays || 0;
        statsCountObj['customScores'] = stats.customScores || [];
        if (stats.inductionDropOut) {
                statsCountObj['inductionDropOut'] = 1;
            return statsCountObj;
        }
        statsCountObj['cntTotal'] = 1;
        _updateActiveStatusCounts(record, statsCountObj);
        return statsCountObj;
    }

    function _updateActiveStatusCounts(record, statsCountObj) {
        var stats = record.stats;
        var status = stats.status;
        var statusStr = status['txt'];
        statsCountObj['cntActive'] = 1;

        if(status.id == nlReportHelper.STATUS_PENDING) {
            if(record.user.state != 0) statsCountObj['pending'] = 1;
            else statsCountObj['attrition'] = 1; 
            return;
        }
        if(statusStr.indexOf('attrition') == 0) {
            statsCountObj[statusStr] = 1;
            statsCountObj['attrition'] = 1;
            return;
        }
        if (status.id != nlReportHelper.STATUS_STARTED) {
            statsCountObj['percScore'] = record.stats.percScore;
            statsCountObj['completed'] = 1;
            if(status.id == nlReportHelper.STATUS_FAILED) {
                statsCountObj['failed'] = 1;
                if(record.user.state == 0) statsCountObj['attrition'] = 1;
                return;
            }
        }
        if (stats.isCertified) {
            statsCountObj['certified'] = 1;
            if (stats.reattempt) statsCountObj['certifiedSecondAttempt'] = 1;
            else statsCountObj['certifiedFirstAttempt'] = 1;
        }
        statsCountObj[statusStr] = 1;
        if(record.user.state == 0) statsCountObj['attrition'] = 1;
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
            nht: '='
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

    var statsCountItem = {cntTotal: 0, cntCompletedTotal: 0, batchIdDict: {}, batchTotal:0, delayDays: 0, pending:0, failed: 0,
        completed: 0, certifiedFirstAttempt: 0, certifiedSecondAttempt: 0, certified: 0, 
        percScore: 0, isOpen: false};
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
        return _getRootItem().cnt;
    };

    this.getSuborg = function(batchInfo) {
        return _getSuborgItem(batchInfo).cnt;
    };

    this.getOu = function(batchInfo) {
        return _getOuItem(batchInfo).cnt;
    };

    this.getBatch = function(batchInfo) {
        return _getBatchItem(batchInfo).cnt;
    };

    function _getRootItem() {
            var rootId = 0;
        if (rootId in _statusCountTree) return _statusCountTree[rootId];
        var stats = angular.copy(statsCountItem);
        stats['isFolder'] = true;
        stats['name'] = 'All';
        stats['partner'] = 'All';
        stats['lob'] = '';
        stats['batchName'] = '';
        _statusCountTree[rootId] = {cnt: stats, children: {}};
        return _statusCountTree[rootId];
    }

    var INDENDATION = 12;
    function _getSuborgItem(batchInfo) {
        var parent = _getRootItem();
        var suborgs = parent.children;
        var subOrgId = batchInfo.partner;
        if (subOrgId in suborgs) return suborgs[subOrgId];
        var stats = angular.copy(statsCountItem);
        stats['isFolder'] = true;
        stats['indentation'] = INDENDATION;
        stats['name'] = batchInfo.partner;
        stats['partner'] = batchInfo.partner;
        stats['lob'] = '';
        stats['batchName'] = '';
        suborgs[subOrgId] = {cnt: stats, children: {}};
        return suborgs[subOrgId];
    };

    function _getOuItem(batchInfo) {
        var parent = _isSubOrgEnabled ? _getSuborgItem(batchInfo) : _getRootItem();
        var ous = parent.children;
        if (batchInfo.lob in ous) return ous[batchInfo.lob];
        var stats = angular.copy(statsCountItem);
        stats['isFolder'] = true;
        stats['indentation'] = (_isSubOrgEnabled ? 2 : 1)*INDENDATION;
        stats['name'] = batchInfo.lob;
        stats['partner'] = batchInfo.partner;
        stats['lob'] = batchInfo.lob;
        stats['batchName'] = '';
        stats['batchtype'] = '';
        ous[batchInfo.lob] = {cnt: angular.copy(stats), children: {}};
        return ous[batchInfo.lob];
    };
    
    function _getBatchItem(batchInfo) {
        var parent = _getOuItem(batchInfo);
        var batches = parent.children;
        if (batchInfo.batchId in batches) return batches[batchInfo.batchId];
        var stats = angular.copy(statsCountItem);
        stats['isFolder'] = false;
        stats['indentation'] = (_isSubOrgEnabled ? 3 : 2)*INDENDATION;
        stats['name'] = batchInfo.batchName;
        stats['partner'] = batchInfo.partner;
        stats['lob'] = batchInfo.lob;
        stats['batchName'] = batchInfo.batchName;
        stats['batchtype'] = batchInfo.batchType || '';
        batches[batchInfo.batchId] = {cnt: angular.copy(stats)};
        return batches[batchInfo.batchId]; 
    };

    this.updateRootCount = function(statusCnt) {
        var updatedStats = self.getRoot();
        _updateStatsCount(updatedStats, statusCnt);
    };

    this.updateSuborgCount = function(batchInfo, statusCnt) {
        var updatedStats = self.getSuborg(batchInfo);
        _updateStatsCount(updatedStats, statusCnt);
    };

    this.updateOuCount = function(batchInfo, statusCnt) {
        var updatedStats = self.getOu(batchInfo);
        _updateStatsCount(updatedStats, statusCnt);
    };

    this.updateBatchCount = function(batchInfo, statusCnt) {
        var updatedStats = self.getBatch(batchInfo);
        _updateBatchInfo(updatedStats, batchInfo.batchId, statusCnt);
        if (updatedStats.batchStatus == 'Closed') statusCnt['cntCompletedTotal'] = 1;
        _updateStatsCount(updatedStats, statusCnt);
    };

    function _updateBatchInfo(updatedStats, batchid) { 
        if (updatedStats.propertiesUpdated) return;
        updatedStats.propertiesUpdated = true;
        var report = batches[batchid];
        var msInfo = nlGetManyStore.getBatchMilestoneInfo(report.raw_record);
        for (var key in msInfo) updatedStats[key] = msInfo[key];
        updatedStats['start'] = report.not_before;
        updatedStats['end'] = report.not_after;
        var firstPlanned = msInfo.firstPlanned;
        var lastPlanned = msInfo.lastPlanned;
        var firstActual = msInfo.firstActual;
        var lastActual = msInfo.lastActual;
        if (firstPlanned && lastPlanned) {
            var first = new Date(firstPlanned);
            var last = new Date(lastPlanned);
            var diffTime = last - first;
            updatedStats['plannedCycle'] = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        }
        if (firstActual && lastActual) {
            var first = new Date(firstActual);
            var last = new Date(lastActual);
            var diffTime = last - first;
            updatedStats['actualCycle'] = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        }
        updatedStats['trainer'] = report.repcontent.iltTrainerName || report.repcontent.sendername; 
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

    function _getReachedCertification(updatedStats) {
        var ret = 0;
        // TODO: hardcoding in the state names!!!
        var attrs = ['certified', 'failed', 'attrition-certification', 'attrition-recertification'];
        for(var i=0; i<attrs.length; i++) {
            if (!(attrs[i] in updatedStats)) continue;
            ret += updatedStats[attrs[i]];
        }
        return ret;
    }

    function _updateStatsPercs(updatedStats) {
        if (!updatedStats.batchName) updatedStats.batchName = updatedStats.batchTotal;
        if (updatedStats['cntCompletedTotal'])
            updatedStats['batchThroughput'] = '' + Math.round(100*updatedStats['certified']/updatedStats['cntCompletedTotal']) + ' %';
        var reachedCertification = _getReachedCertification(updatedStats);
        var notCertified = reachedCertification - (updatedStats['certifiedFirstAttempt'] + updatedStats['certifiedSecondAttempt']);
        if (reachedCertification) {
            updatedStats['batchFirstPass'] = '' + Math.round(100*updatedStats['certifiedFirstAttempt']/reachedCertification) + ' %';
            updatedStats['certificationThroughput'] = '' + Math.round(100*(updatedStats['certifiedFirstAttempt']+updatedStats['certifiedSecondAttempt'])/reachedCertification) + ' %';
            updatedStats['notCertified'] = '' + Math.round(100*notCertified/reachedCertification) + ' %';
        }

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
    
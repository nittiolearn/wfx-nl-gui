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
var NlLrNhtSrv = ['nl','nlReportHelper', 'nlGetManyStore',
function(nl, nlReportHelper, nlGetManyStore) {
    var nhtCounts = null;
    this.init = function(nlGroupInfo) {
        nhtCounts = new NhtCounts(nl, nlGetManyStore, nlGroupInfo);
    };

    // batchType = nhtrunning or nhtclosed or ''
	this.getStatsCountDict = function(batchType, records, getNhtRecords) {
        var reportDict = {};
		var transferedOut = {};
		for (var i=0; i<records.length; i++) {
			var record = records[i];
            if (!record.raw_record.isNHT) continue;
			var oldUserRecord = reportDict[record.user.user_id] || null;
			if (oldUserRecord && oldUserRecord.raw_record.updated > record.raw_record.updated) continue;

            if (record.stats.attritionStr == 'Transfer-Out') {
                var oldUserRecord = transferedOut[record.user.user_id] || null;
                if (oldUserRecord && oldUserRecord.raw_record.updated > record.raw_record.updated) continue;
				transferedOut[record.user.user_id] = record;
				continue;
			}
			reportDict[record.user.user_id] = record;
		}
		for (var transferid in transferedOut) {
			if (transferid in reportDict) continue;
			reportDict[transferid] = transferedOut[transferid];
        }
        if (getNhtRecords) return reportDict;
        nhtCounts.clear();
        for(var key in reportDict) {
            var msInfo = nlGetManyStore.getBatchInfo(reportDict[key].raw_record) || {};
            if (batchType) {
                if(batchType == 'nhtrunning' && msInfo.batchStatus == 'Closed' ||
                    batchType == 'nhtclosed' && msInfo.batchStatus != 'Closed') {
                    continue;
                }
            }
            _addNhtRecord(reportDict[key], msInfo);
        }
        return nhtCounts.statsCountDict();
    };
        
    function _addNhtRecord(record, msInfo) {
        var assignment = record.raw_record.assignment;
        var batchInfo = _getNhtBatchInfo(record, msInfo);
        var statusCntObj = _getStatusCountObj(record);
        nhtCounts.updateBatch(assignment, record);
        _addCount(batchInfo, statusCntObj);
    }

    function _getNhtBatchInfo(record, msInfo) {
        return {suborg: record.user.suborg, subject: record.raw_record.subject,
            batchName: record.raw_record._batchName || record.repcontent.name,
            batchType: record.repcontent.batchtype || '',
            batchId: record.raw_record.assignment, 
            batchStatus: msInfo.batchStatus};
    }

    function _addCount(batchInfo, statusObj) {
        nhtCounts.updateBatchCount(batchInfo, statusObj);
        nhtCounts.updateRootCount(statusObj);
    }

    function _getStatusCountObj(record) {
        var statsCountObj = {};
        var stats = record.stats;
        statsCountObj['batchid'] = record.raw_record.assignment;
        statsCountObj['delayDays'] = stats.delayDays || 0;
        statsCountObj['customScores'] = stats.customScores || [];
        if (stats.inductionDropOut) {
            statsCountObj['inductionDropOut'] = 1;
            statsCountObj['dontCountAttrition'] = true;
            return statsCountObj;
        }
        if (stats.attritionStr == 'Attrition-Involuntary' || stats.attritionStr == 'Transfer-Out') {
            if (stats.attritionStr == 'Attrition-Involuntary') statsCountObj['attritionInvoluntary'] = 1;
            if (stats.attritionStr == 'Transfer-Out') statsCountObj['transferOut'] = 1;
            statsCountObj['dontCountAttrition'] = true;
        }
        _updateActiveStatusCounts(record, statsCountObj);
        return statsCountObj;
    }

    function _updateActiveStatusCounts(record, statsCountObj) {
        var stats = record.stats;
        var status = stats.status;
        var statusStr = status['txt'];
        statsCountObj['cntTotal'] = 1;

        if(statusStr.indexOf('attrition') == 0) {
            statsCountObj[statusStr] = 1;
            statsCountObj['attrition'] = 1;
            statsCountObj['cntTotalAttrition'] = 1;
            return;
        }
        if(status.id == nlReportHelper.STATUS_PENDING) {
            if(record.user.state != 0) statsCountObj['pending'] = 1;
            else statsCountObj['attrition'] = 1; 
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
            if (!statsCountObj['dontCountAttrition']) statsCountObj['certified'] = 1;
            if (stats.reattempt) statsCountObj['certifiedSecondAttempt'] = 1;
            else statsCountObj['certifiedFirstAttempt'] = 1;
            statsCountObj[statusStr] = 1;
            return;
        }
        if(record.user.state == 0) statsCountObj['attrition'] = 1;
        else statsCountObj[statusStr] = 1;
    }
}];

//-------------------------------------------------------------------------------------------------
// NlLrNht directive to display Nht tab
//-------------------------------------------------------------------------------------------------
var NlLrNhtDirective = ['nl',
function(nl) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/learning_reports/lr_nht_tab.html',
        scope: {
            nht: '='
        },
        link: function($scope, iElem, iAttrs) {
            $scope.canShow = function(col) {
                var nht = $scope.nht;
                return (nht.isRunning && col.showIn != 'closed' || !nht.isRunning && col.showIn != 'running');
            };
            $scope.isGrpAdmin = function() {
                return nl.utils.getFnFromParentOrGrandParent($scope, 'grpAdmin');
            };
            $scope.onDetailsClick = function(e, item, columns) {
                nl.utils.getFnFromParentOrGrandParent($scope, 'onDetailsClick')(e, item, columns);
            };
            $scope.onLinkClicked = function(e, item, col) {
                nl.utils.getFnFromParentOrGrandParent($scope, 'onLinkClicked')(e, item, col);
            };
            $scope.sortRows = function(colid) {
                nl.utils.getFnFromParentOrGrandParent($scope, 'sortNhtRows')(colid);
            };

            $scope.canSort = function() {
                return false;
            }
            $scope.getVisibleString = function(nht) {
                if (!nht) return;
                var posStr = '';
                var rows = nht && nht.allRows || [];
                var startpos = nht.currentpos + 1;
                if (rows.length > nht.MAX_VISIBLE_NHT) {
                    var endpos = nht.currentpos + nht.rows.length - 1;
                    return nl.t('{} - {} of {}', startpos, endpos, rows.length);
                }
                return nl.t('{} - {} of {}', startpos, rows.length, rows.length);
            };
        
            $scope.canShowPrev = function(nht) {
                if (!nht) return;
                if (nht.currentpos > 0) return true;
                return false;
            };
        
            $scope.canShowNext = function(nht) {
                if (!nht) return;
                var rows = nht && nht.allRows || [];
                if (nht.currentpos + nht.MAX_VISIBLE_NHT < rows.length) return true;
                return false;
            };
        
            $scope.onClickOnNext = function (nht) {
                if (!nht) return;
                var rows = nht.allRows || [];
                var MAX_VISIBLE = nht.MAX_VISIBLE_NHT;
                if (nht.currentpos + MAX_VISIBLE > rows.length) return;
                if (nht.currentpos < rows.length) {
                    nht.currentpos += MAX_VISIBLE;
                }
                nht.rows = nht.allRows.slice(nht.currentpos, nht.currentpos + MAX_VISIBLE);
                if (nht.summaryRow) nht.rows.splice(0, 0, nht.summaryRow)
            };

            $scope.onClickOnPrev = function (nht) {
                if (!nht) return;
                var MAX_VISIBLE = nht.MAX_VISIBLE_NHT;
                if (nht.currentpos == 0) return;
                if (nht.currentpos >= MAX_VISIBLE) {
                    nht.currentpos -= MAX_VISIBLE;
                }
                nht.rows = nht.allRows.slice(nht.currentpos, nht.currentpos + MAX_VISIBLE);
                if (nht.summaryRow) nht.rows.splice(0, 0, nht.summaryRow)
            }                
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
        completed: 0, certifiedFirstAttempt: 0, certifiedSecondAttempt: 0, certified: 0, certifiedInClosed: 0, 
        percScore: 0, isOpen: false, cntTotalAttrition: 0, attritionInvoluntary: 0, transferOut: 0, inductionDropOut:0};
    var _customScores = {};
    var _customScoresArray = [];
    var batches = {};

    this.clear = function() {
        _statusCountTree = {};
        _customScores = {};
        _customScoresArray = [];
        _getRootItem(); // Create the root item by default
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

    this.getBatch = function(batchInfo) {
        return _getBatchItem(batchInfo).cnt;
    };

    function _getRootItem() {
        var rootId = 0;
        if (rootId in _statusCountTree) return _statusCountTree[rootId];
        var stats = angular.copy(statsCountItem);
        stats['name'] = 'All';
        stats['suborg'] = 'All';
        stats['subject'] = '';
        stats['batchName'] = '';
        _statusCountTree[rootId] = {cnt: stats, children: {}};
        return _statusCountTree[rootId];
    }

    function _getBatchItem(batchInfo) {
        var parent = _getRootItem();
        var batches = parent.children;
        if (batchInfo.batchId in batches) return batches[batchInfo.batchId];
        var stats = angular.copy(statsCountItem);
        stats['name'] = batchInfo.batchName;
        stats['suborg'] = batchInfo.suborg;
        stats['subject'] = batchInfo.subject;
        stats['batchName'] = batchInfo.batchName;
        stats['batchtype'] = batchInfo.batchType || '';
        batches[batchInfo.batchId] = {cnt: angular.copy(stats)};
        return batches[batchInfo.batchId]; 
    };

    this.updateRootCount = function(statusCnt) {
        var updatedStats = self.getRoot();
        _updateStatsCount(updatedStats, statusCnt);
    };

    this.updateBatchCount = function(batchInfo, statusCnt) {
        var updatedStats = self.getBatch(batchInfo);
        _updateBatchInfo(updatedStats, batchInfo.batchId, statusCnt);
        if (batchInfo.batchStatus == 'Closed' && _isReportCompleted(statusCnt)) {
            if (statusCnt['certified'] > 0) statusCnt['certifiedInClosed'] = 1;
            statusCnt['cntCompletedTotal'] = 1;
        }
        _updateStatsCount(updatedStats, statusCnt);
    };

    function _isReportCompleted(stats) {
        if (stats.dontCountAttrition) return false;
        if (stats['attrition'] > 0) return true;
        if (stats['certified'] > 0) return true;
        if (stats['failed'] > 0) return true;
        if (stats['Re-certification'] > 0) return true;
        return false;
    }

    function _updateBatchInfo(updatedStats, batchid) { 
        if (updatedStats.propertiesUpdated) return;
        updatedStats.propertiesUpdated = true;
        var report = batches[batchid];
        var msInfo = nlGetManyStore.getBatchInfo(report.raw_record) || {};
        for (var key in msInfo) updatedStats[key] = msInfo[key];
        updatedStats['start'] = nl.fmt.fmtDateDelta(report.repcontent.not_before, null, 'date');
        updatedStats['end'] =nl.fmt.fmtDateDelta(report.repcontent.not_after, null, 'date');
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
        updatedStats['trainer'] = report.repcontent.iltTrainerName; 
        return;
    }

    var certifiedStats = {'certified': true, 'failed': true, 'attrition-certification' : true, 
                          'attrition-recertification': true, 'customScores': true}
    function _updateStatsCount(updatedStats, statusCnt) { 
        //updatedStats is object fetched from _statusCountTree. Value from statusCnt object are added to updatedStats
        for(var key in statusCnt) {
            if(key == 'batchid') {
                if(!(statusCnt[key] in updatedStats.batchIdDict)) {
                    updatedStats.batchIdDict[statusCnt[key]] = true;
                    updatedStats['batchid'] = statusCnt[key];
                    updatedStats['batchTotal'] += 1;
                }
                continue;
            }
            if (('dontCountAttrition' in statusCnt) && (key in certifiedStats)) continue;
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

    function _getReachedCertification(updatedStats, addArray) {
        var ret = 0;
        // TODO: hardcoding in the state names!!!
        //certified = people certified in first or second attempt
        //failed = people failed in recertification
        //Re-cetification = failed in certification gate going through recertification
        //attrition-certification|attrition-Re-certification = attrited during certifcation and recertification phases.
        var attrs = ['certified', 'failed', 'Re-certification', 'attrition-Re-certification', ];
        for(var i=0; i<attrs.length; i++) {
            if (!(attrs[i] in updatedStats)) continue;
            ret += updatedStats[attrs[i]];
        }
        return ret;
    }

    function _updateStatsPercs(updatedStats) {
        if (!updatedStats.batchName) updatedStats.batchName = updatedStats.batchTotal;

        if (updatedStats['cntCompletedTotal'] > 0) 
            updatedStats['batchThroughput'] = '' + Math.round(100*updatedStats['certifiedInClosed']/updatedStats['cntCompletedTotal']) + ' %';

        var attemptedCertification = _getReachedCertification(updatedStats);
        var notCertified = attemptedCertification - (updatedStats['certifiedFirstAttempt'] + updatedStats['certifiedSecondAttempt']);
        if (attemptedCertification > 0) {
            updatedStats['batchFirstPass'] = '' + Math.round(100*updatedStats['certifiedFirstAttempt']/attemptedCertification) + ' %';
            updatedStats['certificationThroughput'] = '' + Math.round(100*(updatedStats['certifiedFirstAttempt']+updatedStats['certifiedSecondAttempt'])/attemptedCertification) + ' %';
            updatedStats['notCertified'] = '' + Math.round(100*notCertified/attemptedCertification) + ' %';
        }

        if(updatedStats.cntTotal > 0) {
            updatedStats['avgDelay'] = Math.round(updatedStats.delayDays/updatedStats.cntTotal);
            updatedStats['avgScore'] = (updatedStats.percScore != 0 && updatedStats.completed != 0) ? Math.round(updatedStats.percScore/updatedStats.completed)+' %' : 0;
            var numerator = updatedStats['cntTotal'] - updatedStats['cntTotalAttrition'];
            var denominator = updatedStats['cntTotal'] - updatedStats['attritionInvoluntary'] - updatedStats['transferOut'];
            updatedStats['runningThroughput'] = Math.round(100*numerator/denominator);
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
    
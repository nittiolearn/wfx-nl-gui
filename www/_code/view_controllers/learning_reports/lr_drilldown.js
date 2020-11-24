(function() {
//-------------------------------------------------------------------------------------------------
// lr_drilldown.js; nlLrDrillDownSrv; nl-lr-drilldown (all content of the tab)
// Provides a 2 level drilldown of summarized counts. By default level1 = suborg; level2 = ou
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.lr_drilldown', [])
    .service('nlLrDrilldown', NlLrDrilldownSrv)
    .directive('nlLrDrilldownTab', NlLrDrilldownDirective);
}
//-------------------------------------------------------------------------------------------------

var NlLrDrilldownSrv = ['nlReportHelper', 'nlTable',
function(nlReportHelper, nlTable) {
    var _attritionObj = {};
    var _customStartedStatusObj = {};
    var _pivotLevel1Field = null;
    var _pivotLevel2Field = null;
    var _pivotIndividualCourses = true;
    var _scope = null;
    var StatsCount = new StatsCounts();

    this.init = function($scope) {
        _scope = $scope;
        _pivotLevel1Field = $scope.pivotConfig.level1Field;
        _pivotLevel2Field = $scope.pivotConfig.level2Field;
        _pivotIndividualCourses = $scope.pivotConfig.pivotIndividualCourses;
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
        var level1FieldInfo = _getFieldValue(record, _pivotLevel1Field);
        var level2FieldInfo = _pivotLevel2Field.id ? _getFieldValue(record, _pivotLevel2Field) : null;
        var statusCntObj = _getStatusCountObj(record);
        _addCount(record.raw_record.lesson_id, record.repcontent.name, 
            level1FieldInfo, level2FieldInfo, statusCntObj);
    }

    function _getFieldValue(record, field) {
        var ret = {id: nlTable.getFieldValue(_scope.utable, record, field.id)};
        ret.name = (field.valueFieldId) ? nlTable.getFieldValue(_scope.utable, record, field.valueFieldId) : ret.id;
        return ret;
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

    function _addCount(cid, coureName, level1FieldInfo, level2FieldInfo, statusObj) {
        StatsCount.updateRootCount(0, "All", statusObj);
        if (_pivotIndividualCourses) StatsCount.updateRootCount(cid, coureName, statusObj);
        StatsCount.updateLevel1Count(0, level1FieldInfo, level2FieldInfo != null, statusObj);
        if (_pivotIndividualCourses) StatsCount.updateLevel1Count(cid, level1FieldInfo, level2FieldInfo != null, statusObj);
        if (!level2FieldInfo) return;
        StatsCount.updateLevel2Count(0, level1FieldInfo, level2FieldInfo, statusObj);
        if (_pivotIndividualCourses) StatsCount.updateLevel2Count(cid, level1FieldInfo, level2FieldInfo, statusObj);
    }

    function _getStatusCountObj(record) {
        var statsCountObj = {};
        statsCountObj['cntTotal'] = 1;
        if(record.user.state == 0) {
            _updateInactiveStatusCounts(record, statsCountObj);
        } else {
            _updateActiveStatusCounts(record, statsCountObj);
        }
        _updateCommonCountsData(record, statsCountObj);
        return statsCountObj;
    }

    function _updateInactiveStatusCounts(record, statsCountObj) {
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
        if(status.id == nlReportHelper.STATUS_PENDING || status.id == nlReportHelper.STATUS_STARTED) {
			statsCountObj['pendingInactive'] = 1;
            return;
        }
        statsCountObj['doneInactive'] = 1;
        statsCountObj['percScore'] = record.stats.percScore;
	}

	function _updateActiveStatusCounts(record, statsCountObj) {
        var stats = record.stats;
        var status = stats.status;
        var statusStr = status['txt'];
		statsCountObj['cntActive'] = 1;
        if(status.id == nlReportHelper.STATUS_PENDING) {
            statsCountObj['pending'] = 1;
            statsCountObj['notcompleted'] = 1;
            return;
        }
        if(statusStr.indexOf('attrition') == 0) {
            statsCountObj[statusStr] = 1;
            statsCountObj['attrition'] = 1;
            statsCountObj['cntActive'] = 0;
            statsCountObj['cntInactive'] = 1;
            if(!(statusStr in _attritionObj))
                _attritionObj[statusStr] = record.stats.progress;
            return;
        }
        if(status.id == nlReportHelper.STATUS_STARTED) {
            statsCountObj[statusStr] = 1;
            statsCountObj['started'] = 1;
            statsCountObj['notcompleted'] = 1;
            if(statusStr !== 'started') {
                if(!(statusStr in _customStartedStatusObj)) 
                    _customStartedStatusObj[statusStr] = record.stats.progress;
            }
            return;
        } 
        statsCountObj['completed'] = 1;
        statsCountObj['percScore'] = record.stats.percScore;
        if(status.id == nlReportHelper.STATUS_FAILED) {
            statsCountObj['failed'] = 1;
            return;
        }
        statsCountObj['certified'] = 1;
	}

    function _updateCommonCountsData(record, statsCountObj) {
        statsCountObj['timeSpent'] = record.stats.timeSpentSeconds;
        statsCountObj['customScores'] = record.stats.customScores || [];
        statsCountObj['delayDays'] = record.stats.delayDays || 0;
    }
}];

//-------------------------------------------------------------------------------------------------
// NlLrDrilldown directive to display drill down tab
//-------------------------------------------------------------------------------------------------

var NlLrDrilldownDirective = ['nl',
function(nl) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/learning_reports/lr_drilldown_tab.html',
        scope: {
            drilldown: '='
        },
        link: function($scope, iElem, iAttrs) {
            $scope.showCharts = true;
            $scope.generateDrillDownArray = function(item) {
                nl.utils.getFnFromParentOrGrandParent($scope, 'generateDrillDownArray')(item);
            };

            $scope.updatePivotTable = function(item) {
                nl.utils.getFnFromParentOrGrandParent($scope, 'updatePivotTable')(item);
            };

            $scope.onDetailsClick = function(e, item, columns) {
                nl.utils.getFnFromParentOrGrandParent($scope, 'onDetailsClick')(e, item, columns);
            };

            $scope.toggleDrilldownCharts = function() {
                $scope.showCharts = !$scope.showCharts;
            }
        }
    }
}];
//-------------------------------------------------------------------------------------------------
// StatsCount constructer which get update on each record read
//-------------------------------------------------------------------------------------------------

function StatsCounts(nl) {
    var _statusCountTree = {}; //Is an object {0: {cnt: {}, children:{subgorg1: {cnt: {}, children: {ou1: {cnt: {}}}}}}}
    var self = this;

    var statsCountItem = {cntTotal: 0, cntActive: 0, cntInactive: 0, doneInactive: 0, pendingInactive: 0, 
                          completed: 0, certified: 0, failed: 0, notcompleted: 0, pending:0, started: 0,
                          percScore: 0, avgScore: 0, delayDays: 0, timeSpent: 0, isOpen: false};
    var defaultStates = angular.copy(statsCountItem);
    var _dynamicStates = {};
    var _customScores = {};
    var _customScoresArray = [];

    this.clear = function() {
        _statusCountTree = {};
        _dynamicStates = {};
        _customScores = {};
        _customScoresArray = [];
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

    this.getLevel1Node = function(rootId, itemInfo, isFolder) {
        var siblings = _statusCountTree[rootId].children;
        var itemId = itemInfo.id;
        if (itemId in siblings) return siblings[itemId].cnt;
        var stats = angular.copy(statsCountItem);
        stats['isFolder'] = isFolder;
        stats['indentation'] = 24;
        stats['name'] = itemInfo.name;
        siblings[itemId] = {cnt: stats};
        if(isFolder) siblings[itemId]['children'] = {}
        return siblings[itemId].cnt;
    };

    this.getLevel2Node = function(rootId, parentInfo, itemInfo) {
        var siblings = _statusCountTree[rootId].children[parentInfo.id].children;
        var itemId = itemInfo.id;
        if (itemId in siblings) return siblings[itemId].cnt;
        var stats = angular.copy(statsCountItem);
        stats['indentation'] = 44;
        stats['name'] = itemInfo.name;
        siblings[itemId] = {cnt: stats};
        return siblings[itemId].cnt;
    };

    this.updateRootCount = function(rootId, name, statusCnt) {
        // contentid = 0 for updating all item in the _statusCountTree. 
        // contentid = courseid/lesson_id for all other records.
        var updatedStats = self.getRoot(rootId, name);
        _updateStatsCount(updatedStats, statusCnt);
    }

    this.updateLevel1Count = function(rootId, level1Info, isFolder, statusCnt) {
        var updatedStats = self.getLevel1Node(rootId, level1Info, isFolder);
        _updateStatsCount(updatedStats, statusCnt);
    }

    this.updateLevel2Count = function(rootId, level1Info, level2Info, statusCnt) {
        var updatedStats = self.getLevel2Node(rootId, level1Info, level2Info);
        _updateStatsCount(updatedStats, statusCnt);
    } 

    function _updateStatsCount(updatedStats, statusCnt) { 
        //updatedStats is object fetched from _statusCountTree. Value from statusCnt object are added to updatedStats
        for(var key in statusCnt) {
            if(key == 'customScores') {
                var customScores = statusCnt[key]
                for(var i=0; i<customScores.length; i++) {
                    var item = customScores[i];
                    var cntid = item.name+'count';
                    if(!(item.name in _customScores)) {
                        _customScores[item.name] = true;
                        _customScoresArray.push(item.name)
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
            if(!(key in updatedStats)) {
                _dynamicStates[key] = true;
                updatedStats[key] = 0;
            }
            updatedStats[key] += statusCnt[key];
        }
    }

    function _updateStatsCountTree(rowObjs) {
        for(var key in rowObjs) {
            var row = rowObjs[key];
            var statsObj = row.cnt;
            _updateStatsPercs(statsObj)
            if(row.children) _updateStatsCountTree(row.children);
        }
    }

    function _updateStatsPercs(updatedStats) {
        if(updatedStats.cntTotal > 0) {
            updatedStats['percTotal'] = Math.round(updatedStats.cntTotal*100/updatedStats.cntTotal);
            updatedStats['percActive'] = Math.round(updatedStats.cntActive*100/updatedStats.cntTotal);
            updatedStats['percInactive'] = Math.round(updatedStats.cntInactive*100/updatedStats.cntTotal);
            updatedStats['percDoneInactive'] = Math.round(updatedStats.doneInactive*100/updatedStats.cntTotal);
            updatedStats['percPendingInactive'] = Math.round(updatedStats.pendingInactive*100/updatedStats.cntTotal);
            updatedStats['percCompleted'] = Math.round(updatedStats.completed*100/updatedStats.cntTotal);
            updatedStats['percCertified'] = Math.round(updatedStats.certified*100/updatedStats.cntTotal);
            updatedStats['percFailed'] = Math.round(updatedStats.failed*100/updatedStats.cntTotal);
            updatedStats['percNotcompleted'] = Math.round(updatedStats.notcompleted*100/updatedStats.cntTotal);
            updatedStats['percPending'] = Math.round(updatedStats.pending*100/updatedStats.cntTotal);
            updatedStats['percStarted'] = Math.round(updatedStats.started*100/updatedStats.cntTotal);
            updatedStats['avgScore'] = (updatedStats.percScore != 0 && (updatedStats.completed != 0 || updatedStats.doneInactive != 0)) ? Math.round(updatedStats.percScore/(updatedStats.completed + updatedStats.doneInactive))+' %' : 0;
            updatedStats['avgDelay'] = Math.round(updatedStats.delayDays/updatedStats.cntTotal);
            updatedStats['timeSpentInMins'] = Math.round(updatedStats.timeSpent/60);
            if(updatedStats.attrition) updatedStats['percAttrition'] = Math.round(updatedStats.attrition*100/updatedStats.cntTotal)
        }

        for(var key in _dynamicStates) {
            if(!(key in defaultStates)) {
                var attr = 'perc'+key;
                updatedStats[attr] = Math.round(updatedStats[key]*100/updatedStats.cntTotal);
            }
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

(function() {
//-------------------------------------------------------------------------------------------------
// lr_batch.js: nlLrBatchSrv; nl-lr-batch (all content of the tab)
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.lr_batch', [])
    .service('nlLrBatch', NlLrBatchSrv)
    .directive('nlLrBatchTab', NlLrBatchDirective);
}
//-------------------------------------------------------------------------------------------------

var NlLrBatchSrv = ['nl', 'nlLrHelper',
function(nl, nlLrHelper) {
    var _orgToSubOrgDict = null;
    var _isSubOrgEnabled = null;
    var BatchCount = new BatchCountCls();

    this.init = function(nlGroupInfo) {
		_orgToSubOrgDict = nlGroupInfo.getOrgToSubOrgDict();
        _isSubOrgEnabled = nlGroupInfo.isSubOrgEnabled();
    };

    this.clearBatchCountObj = function() {
        BatchCount.clear();
    };

    this.getBatchDataDict = function() {
        return BatchCount.batchCountDict();
    };

    this.addCount = function(record) {
        var contentid = record.raw_record.assignment;
        var ou = record.user.org_unit;
        var subOrg = _isSubOrgEnabled ? _orgToSubOrgDict[ou] : record.user.org_unit;
        if(!ou && _isSubOrgEnabled) {
            subOrg = "Others";
        }
        if(!subOrg) subOrg = "Others";

        var statusCntObj = _getBatchCountObj(record);
        _addCount(contentid, subOrg, _isSubOrgEnabled ? ou : '', statusCntObj, record.repcontent.name);
    }

    function _addCount(assignment, subOrg, ou, statusObj, name) {
        //BatchCount.updateSuborgCount(0, statusObj); 
        BatchCount.updateSuborgCount(subOrg, statusObj);
        if(_isSubOrgEnabled) {
            //StatsCount.updateOuCount(0, ou, statusObj, _isSubOrgEnabled);
            BatchCount.updateOuCount(subOrg, ou, statusObj, _isSubOrgEnabled);
        }
        //StatsCount.updateAssignObjCount(0, ou, statusObj);
        BatchCount.updateAssignObjCount(subOrg, ou, assignment, statusObj, name);
    }

    function _getBatchCountObj(record) {
        var batchItemCnt = {};
        var status = record.stats.status;
        if(record.user.state == 0) {
            batchItemCnt['cntInactive'] = 1;
        } else {
            batchItemCnt['cntActive'] = 1;
        }
        batchItemCnt['status'] = status;
        return batchItemCnt;
    }

    function _updateDummyData(lst) {
        var total = lst[0].count;
        var sum = 0;
        for (var i=0; i<lst.length; i++) {
            var item = lst[i];
            if (i < lst.length - 1 && i > 0) {
                sum += item.count;
            } else if (i == lst.length - 1) {
                item.count = total - sum;
            }
            item.perc = Math.round(item.count/total*100);
       }
    }
}];
//-------------------------------------------------------------------------------------------------
// Batch data constructer which get updated on each record read
//-------------------------------------------------------------------------------------------------

function BatchCountCls(nl) {
    var _statusCountTree = {}; //Is an object {0: {cnt: {}, children:{subgorg1: {cnt: {}, children: {ou1: {cnt: {}}}}}}}
    var self = this;

    var statsCountItem = {pending:0, started: 0, failed:0, certified:0, passed:0, done:0, attrition: 0};
    
    this.clear = function() {
        _statusCountTree = {};
    };

    this.batchCountDict = function() {
        return _statusCountTree;
    };

    this.getSuborgRoot = function(subOrgId) {
        if (subOrgId in _statusCountTree) return _statusCountTree[subOrgId].cnt;
        var stats = angular.copy(statsCountItem)
            stats['isFolder'] = true;
            stats['name'] = subOrgId == 0 ? 'All' : subOrgId;
        _statusCountTree[subOrgId] = {cnt: stats, children: {}};
        return _statusCountTree[subOrgId].cnt;
    };

    this.getOu = function(subOrgId, ouid, isFolder) {
        var  ous = _statusCountTree[subOrgId].children;
        if (ouid in ous) return ous[ouid].cnt;
        var stats = angular.copy(statsCountItem)
        stats['isFolder'] = isFolder;
        stats['indentation'] = 24;
        stats['name'] = ouid;
        ous[ouid] = {cnt: stats};
        if(isFolder) ous[ouid]['children'] = {}
        return ous[ouid].cnt;
    }

    this.getAssignObj = function(subOrgId, ouid, assignid, name) {
        var  assignments = _statusCountTree[subOrgId].children[ouid].children;
        if (assignid in assignments) return assignments[assignid].cnt;
        var stats = angular.copy(statsCountItem)
        stats['indentation'] = 44;
        stats['name'] = name;
        assignments[assignid] = {cnt: angular.copy(stats)};
        return assignments[assignid].cnt;        
    }

    this.updateSuborgCount = function(subOrgId, statusObj) {
        //suborg = 0 for updating all item in the _statusCountTree. suborg = suborg/ou id for all other records.
        var updatedStats = self.getSuborgRoot(subOrgId);
        _updateStatsCount(updatedStats, statusObj);
    }

    this.updateOuCount = function(subOrgId, ouid, statusObj, isFolder) {
        //isFolder is false, then there is no suborg enabled for group. This object is considered as ou.
        var updatedStats = self.getOu(subOrgId, ouid, isFolder);
        _updateStatsCount(updatedStats, statusObj);
    }

    this.updateAssignObjCount = function(subOrgId, ouid, assignid, statusObj, name) {
        //This happens only if the suborg is enabled for group.
        var updatedStats = self.getAssignObj(subOrgId, ouid, assignid, name);
        _updateStatsCount(updatedStats, statusObj);
    } 

    function _updateStatsCount(updatedStats, statusObj) { 
        //updatedStats is object fetched from _statusCountTree. Value from statusCnt object are added to updatedStats
        var status = statusObj.status;
        var statusStr = status.txt;
        if(statusStr.indexOf('attrition') == 0) 
            updatedStats.attrition += 1;
        else
            updatedStats[statusStr] += 1;
    }
}

//-------------------------------------------------------------------------------------------------
// NlLrBatch directive to display drill down tab
//-------------------------------------------------------------------------------------------------

var NlLrBatchDirective = [
function() {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/learning_reports/lr_batch_tab.html',
        scope: {
            batchinfo: '='
        },
        link: function($scope, iElem, iAttrs) {
            $scope.generateBatchDataArray = function(item) {
                $scope.$parent.$parent.generateBatchDataArray(item);
            };

            $scope.onDetailsClick = function(e, item) {
                $scope.$parent.$parent.onDetailsClick(e, item);
            };
        }
    }
}];

module_init();
})();

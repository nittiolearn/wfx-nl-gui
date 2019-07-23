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

var NlLrBatchSrv = ['nlLrHelper',
function(nlLrHelper) {
    this.init = function(nlGroupInfo) {
    };

    this.getBatchInfo = function(_groupInfo, records) {
        var ret = {batchCounts: [
            {name: 'Total', count: 728, cls: 'fblue2'},
            {name: 'Completed', count: 321, cls: 'fgreen'},
            {name: 'OJT Done', count: 12, cls: 'fblue2'},
            {name: 'Process Training Done', count: 15, cls: 'fblue2'},
            {name: 'Preprocess Training Done', count: 18, cls: 'fblue2'},
            {name: 'Started', count: 13, cls: 'fblue2'},
            {name: 'Planned', count: 0, cls: 'fdarkgrey2'}
        ], learnerCounts: [
            {name: 'Total', count: 5234, cls: 'fblue2'},
            {name: 'Certified', count: 3002, cls: 'fgreen'},
            {name: 'Failed', count: 103, cls: 'forange'},
            {name: 'No show', count: 102, cls: 'fdarkgrey2'},
            {name: 'Dropped', count: 221, cls: 'fdarkgrey2'},
            {name: 'Red', count: 51, cls: 'forange'},
            {name: 'Amber', count: 221, cls: 'forange2'},
            {name: 'Green', count: 182, cls: 'fgreen'},
            {name: 'Pending', count: 0, cls: 'fdarkgrey2'}
        ]};

        _updateDummyData(ret.batchCounts);
        _updateDummyData(ret.learnerCounts);
        return ret;
    };

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
            $scope.generateDrillDownArray = function(item) {
                $scope.$parent.$parent.generateDrillDownArray(item);
            };

            $scope.onDetailsClick = function(e, item) {
                $scope.$parent.$parent.onDetailsClick(e, item);
            };
        }
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

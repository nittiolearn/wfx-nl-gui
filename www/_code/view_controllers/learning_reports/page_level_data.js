(function() {
//-------------------------------------------------------------------------------------------------
// lr_drilldown.js; nlLrDrillDownSrv; nl-lr-drilldown (all content of the tab)
// Provides a 2 level drilldown of summarized counts. By default level1 = suborg; level2 = ou
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.learning_reports.lr_pagelevelscore', [])
    .directive('nlPageLevelScore', NlPageLevelScoreDirective);
}
//-------------------------------------------------------------------------------------------------
var NlPageLevelScoreDirective = ['nl',
function(nl) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/learning_reports/page_level_data.html',
        scope: {
            pageleveldata: '='
        },
        link: function($scope, iElem, iAttrs) {
            $scope.showCharts = true;
            $scope.onClickOnShowMore = function(item) {
                nl.utils.getFnFromParentOrGrandParent($scope, 'onClickOnShowMore')(item);

            };
            $scope.canSort = function(selectedItem) {
                return false;
            }
            $scope.getVisibleString = function(selectedItem) {
                if (!selectedItem) return '';
                return $scope.pageleveldata.charts.getVisibleStringFn(selectedItem);
            };

            $scope.canShowPrev = function(selectedItem) {
                if (!selectedItem) return;
                if (selectedItem.currentpos > 0) return true;
                return false;
            };
        
            $scope.canShowNext = function(selectedItem) {
                if (!selectedItem) return;
                return $scope.pageleveldata.charts.canShowNext(selectedItem);
            };
        
            $scope.onClickOnNext = function (selectedItem) {
                return $scope.pageleveldata.charts.onClickOnNext(selectedItem, 'page');
            };
        
            $scope.onClickOnPrev = function (selectedItem) {
                return $scope.pageleveldata.charts.onClickOnPrev(selectedItem, 'page');
            }            
        }
    }
}];
//-------------------------------------------------------------------------------------------------
module_init();
})();

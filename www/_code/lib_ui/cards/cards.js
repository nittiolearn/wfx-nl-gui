(function() {

//-------------------------------------------------------------------------------------------------
// cards.js: 
// Models a list of cards (e.g. dashboard view, view approved lessons, ...)
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.cards', [])
    .directive('nlCards', CardsDirective);
}

//-------------------------------------------------------------------------------------------------
var CardsDirective = ['nl', '$window',
function(nl, $window) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'lib_ui/cards/cards.html',
        scope: {
            cards: '='
        },
        link: function($scope, iElem, iAttrs) {
            nl.timeout(function() {
                _updateCardDimensions($scope, iElem);
            }); // 0 timeout - just executes after DOM rendering is complete
            
            angular.element($window).on('resize', function() {
                $scope.$apply(function() {
                    _updateCardDimensions($scope, iElem);
                });
            });
         }
    };
}];

function _updateCardDimensions($scope, cardsContainer) {
    var w = _getCardWidth(cardsContainer);
    $scope.w = w;
    $scope.h = _defCardAr*w;
    $scope.fs = w/_defCardWidth*100;
    
    var cardsPerRow = Math.floor(cardsContainer[0].offsetWidth / w);
    var margins = cardsPerRow+1;
    $scope.ml = (cardsContainer[0].offsetWidth - w*cardsPerRow) / margins;
}

var _defCardWidth = 300;
var _defCardAr = 2/3;
function _getCardWidth(cardsContainer) {
    var w = _defCardWidth;

    var contWidth = cardsContainer[0].offsetWidth;
    var contHeight = cardsContainer[0].offsetHeight;

    if (contWidth < w) w = contWidth;
    if (contHeight < _defCardAr*w) w = contHeight/_defCardAr;
    
    return w;
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

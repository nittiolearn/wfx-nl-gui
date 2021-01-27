(function() {

//-------------------------------------------------------------------------------------------------
// cards2.js: 
// Models a list of cards (e.g. dashboard view, view approved lessons, ...)
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.cards2', [])
    .directive('nlCards2', Cards2Directive) 
}

//-------------------------------------------------------------------------------------------------
var Cards2Directive = ['nl', 'nlDlg', '$filter', 'nlCardsSrv', 'nlExporter',
function(nl, nlDlg, $filter, nlCardsSrv, nlExporter) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'lib_ui/cards/cards2.html',
        scope: {
            type: '=',
            cards: '='
        },
        link: function($scope, iElem, iAttrs) {
            nl.timeout(function() {
                _updateCardDimensions(nl, $scope, iElem);
            }); // 0 timeout - just executes after DOM rendering is complete

            angular.element(nl.window).on('resize', function() {
                $scope.$apply(function() {
                    _updateCardDimensions(nl, $scope, iElem);
                });
            });

        }
    }

}];
var SCROLL_WIDTH = 8;
var _defCardWidth = 280;
var _defCardAr = 1.4;
var _minMarginX = 32; // px
var _cardsSize = {"L": {cardWidth: 500, cardHeight: 500},
                  "M": {cardWidth: 400, cardHeight: 400},
                  "S": {cardWidth: 260, cardHeight: 300}}
function _updateCardDimensions(nl, $scope, cardsContainer) {
    if ($scope.cards && $scope.cards.size) {
        var size = $scope.cards.size;
        var cardHWDict = _cardsSize[size];
        // var w = _getCardWidth(cardsContainer);
        var w = cardHWDict.cardWidth;
        $scope.w = w;
        $scope.h = cardHWDict.cardHeight;
        $scope.fs = 100;
        
        $scope.ml = 16;    

    } else {
        var w = _getCardWidth(cardsContainer);
        $scope.w = w;
        $scope.h = _defCardAr*w;
        $scope.fs = w/_defCardWidth*100;
        
        $scope.ml = 16;    
    }
}

function _getCardWidth(cardsContainer) {
    var w = _defCardWidth;
    return w;
}

function _canCoverImg(url) {
	var info = _imgInfo[url];
	if (!info) return false;
	if ('canCover' in info) return info.canCover;
    var ar = info.w ? info.h/info.w : 0;
    info.canCover = (ar > 0.51 && ar < 0.77);
    return info.canCover;
}


//-------------------------------------------------------------------------------------------------
module_init();
})();

(function() {

//-------------------------------------------------------------------------------------------------
// cards.js: 
// Models a list of cards (e.g. dashboard view, view approved lessons, ...)
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.cards', [])
    .service('nlCardsSrv', CardsSrv)
    .directive('nlCards', CardsDirective)
    .directive('nlCard', CardDirective);
}

//-------------------------------------------------------------------------------------------------
var CardsSrv = ['nl',
function(nl) {
	this.getEmptyCard = function(emptyCard) {
		var card = (emptyCard) ? emptyCard : {};
		if (!card.title) card.title = nl.t('Nothing to display');
		if (!card.help) card.help = nl.t('There is no data to display');
		if (!card.icon) card.icon = nl.url.resUrl('dashboard/empty_list.png');
		card.links = [];
		card.style = 'nl-bg-blue';
		card.children = [];
		return card;
	};
}];

var CardsDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
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
            
            angular.element(nl.window).on('resize', function() {
                $scope.$apply(function() {
                    _updateCardDimensions($scope, iElem);
                });
            });
            
            $scope.onCardInternalUrlClicked = function(internalUrl) {
				$scope.$parent.onCardInternalUrlClicked(internalUrl);
            };

            $scope.onCardLinkClicked = function(card, linkid) {
				$scope.$parent.onCardLinkClicked(card, linkid);
            };
         }
    };
}];

var SCROLL_WIDTH = 8;
function _updateCardDimensions($scope, cardsContainer) {
    var w = _getCardWidth(cardsContainer);
    $scope.w = w;
    $scope.h = _defCardAr*w;
    $scope.fs = w/_defCardWidth*100;
    
    // It seems indeterminstic when scroll bar width is computed.
    // So clientWidth is not a solution here. offsetWidth - scrollBarWidth is used here.
    var contWidth = cardsContainer[0].offsetWidth - SCROLL_WIDTH;
    var cardsPerRow = Math.floor(contWidth / w);
    var margins = cardsPerRow+1;
    $scope.ml = (contWidth - w*cardsPerRow) / margins;
}

var _defCardWidth = 360;
var _defCardAr = 2/3;
function _getCardWidth(cardsContainer) {
    var w = _defCardWidth;

    var contWidth = cardsContainer[0].offsetWidth - SCROLL_WIDTH;
    var contHeight = cardsContainer[0].offsetHeight;

    if (contWidth < w) w = contWidth;
    if (contHeight < _defCardAr*w) w = contHeight/_defCardAr;
    
    return w;
}

var CardDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'lib_ui/cards/card.html',
        scope: {
            card: '='
        },
        link: function($scope, iElem, iAttrs) {
            $scope.onCardInternalUrlClicked = function(internalUrl) {
            	$scope.$parent.onCardInternalUrlClicked(internalUrl);
            };

            $scope.onCardLinkClicked = function(card, linkid) {
				if (linkid !== 'details') {
	            	$scope.$parent.onCardLinkClicked(card, linkid);
					return;
				}
                var detailsDlg = nlDlg.create($scope);
                detailsDlg.scope.card = card;
                detailsDlg.show('lib_ui/cards/details_dlg.html');
            };
         }
    };
}];
//-------------------------------------------------------------------------------------------------
module_init();
})();

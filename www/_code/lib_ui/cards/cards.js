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
var CardsDirective = ['nl', '$window', 'nlScrollbarSrv',
function(nl, $window, nlScrollbarSrv) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'lib_ui/cards/cards.html',
        scope: {
            cards: '=',
            pgInfo: '='
        },
        link: function($scope, iElem, iAttrs) {
            $scope.pages = [];
            nl.timeout(function() {
                // TODO - might not be needed if all callers call repaginate!
                $scope.$parent.reInitCards();
            }); // 0 timeout - just executes after DOM rendering is complete
            
            nl.router.onViewEnter($scope.$parent, function() {
                nl.log.debug('CardsDirective: view enter');
                nlScrollbarSrv.setTotal($scope.pages.length);
                nlScrollbarSrv.gotoPage(1);
            });
            
            $scope.$parent.reInitCards = function() {
                _cacheCardsIcons($scope, nl);
                _repaginateCards();
            };
            
            angular.element($window).on('resize', function() {
                $scope.$apply(function() {
                    _repaginateCards();
                });
            });

            function _repaginateCards() {
                _paginateCards(nl, $scope, iElem, nlScrollbarSrv);
            }
         }
    };
}];

function _cacheCardsIcons($scope, nl) {
    for(var i=0; i<$scope.cards.length; i++) {
        var card = $scope.cards[i];
        _cacheCardIcon($scope, card, nl);
    }
}

function _cacheCardIcon($scope, card, nl) {
    nl.url.getCachedUrl(card.icon)
    .then(function(imgUrl) {
        card.iconUrl = imgUrl;
    });
}

function _paginateCards(nl, $scope, cardsContainer, nlScrollbarSrv) {
    nl.log.debug('_paginateCards called');
    var dimension = _getCardDimension(cardsContainer);
    var cardsPerRow = Math.max(1, Math.floor(cardsContainer[0].offsetWidth / dimension.w));
    var rowsPerPage = Math.max(1, Math.floor(cardsContainer[0].offsetHeight / dimension.h));
    var cardsPerPage = cardsPerRow*rowsPerPage;

    var pageCount = Math.max(1, Math.ceil($scope.cards.length/cardsPerPage));

    $scope.w = dimension.w;
    $scope.h = dimension.h;
    $scope.fs = dimension.fs;
    
    $scope.pages = [];
    for(var p=0; p<pageCount; p++) {
        var page = [];
        $scope.pages.push(page);
        for (var r=0; r<rowsPerPage; r++) {
            var begin = p*cardsPerPage + r*cardsPerRow;
            if (begin >= $scope.cards.length) {
                page.push(_dummyRow(cardsPerRow));
                continue;
            }
            var end = begin + cardsPerRow;
            if (end > $scope.cards.length) end = $scope.cards.length;
            var row = $scope.cards.slice(begin, end);
            if (end - begin < cardsPerRow) {
                for (var d=end-begin; d<cardsPerRow; d++) row.push(_dummyCard());
            }
            page.push(row);
        }
    }
    nlScrollbarSrv.setTotal(pageCount);
    if (nl.pginfo.currentPage > pageCount) {
        nlScrollbarSrv.gotoPage(pageCount);
    }
}

function _dummyCard() {
    return {dummy:true};
}

function _dummyRow(nCards) {
    var row = [];
    for (var i=0; i<nCards; i++) row.push(_dummyCard());
    return row;
}

var _defCardWidth = 300;
var _defCardAr = 2/3;
function _getCardDimension(cardsContainer) {
    var w = _defCardWidth;
    var contWidth = cardsContainer[0].offsetWidth;
    if (contWidth < w) w = contWidth;
    var h = _defCardAr*w;
    var contHeight = cardsContainer[0].offsetHeight;
    if (contHeight < h) {
        h = contHeight;
        w = contHeight/_defCardAr;
    }
    
    var perc = w/_defCardWidth*100;
    return {w:w, h:h, fs:perc};
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

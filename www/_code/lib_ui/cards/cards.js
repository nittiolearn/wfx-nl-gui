(function() {

//-------------------------------------------------------------------------------------------------
// cards.js: 
// Models a list of cards (e.g. dashboard view, view approved lessons, ...)
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.cards', [])
    .service('nlCardsSrv', CardsSrv)
    .filter('nlFilter', NlFilter)
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
		if (!card.icon) card.icon = nl.url.resUrl('empty.png');
		card.links = [];
		card.style = 'nl-bg-blue';
		card.children = [];
		return card;
	};
	
	this.updateGrades = function(cards, grades) {
		cards.grades = ['All'].concat(grades);
	};
}];

var discardSearchWords = { "content_include": true};
var NlFilter = ['nl', '$filter',
function(nl, $filter) {
	return function(inputArray, filterString, filterGrade) {
		var filteredInput = inputArray;
		if (filterGrade && filterGrade != 'All') {
			filteredInput = [];
	    	for (var i=0; i < inputArray.length; i++) {
	    		var card = inputArray[i];
	    		if (card.grade != filterGrade) continue;
		    	filteredInput.push(card);
	    	}
	    }
		filterString = filterString.replace(/"/g, "");
		var filterStrings = filterString.split(" ");
		for (var i=0; i<filterStrings.length; i++) {
		    if (filterStrings[i] in discardSearchWords) continue;
            filteredInput = $filter('filter')(filteredInput, filterStrings[i]);
		}
    	return filteredInput;
	};
}];

var CardsDirective = ['nl', 'nlDlg', '$filter', 'nlCardsSrv',
function(nl, nlDlg, $filter, nlCardsSrv) {
    var defaultEmptyCard = nlCardsSrv.getEmptyCard();
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
            
            $scope.getCards = function() {
            	if (!$scope.cards || !$scope.cards.cardlist) return [];
            	var staticlist = $scope.cards.staticlist || [];
            	var filteredData = $filter('nlFilter')($scope.cards.cardlist,
            										 $scope.search.filter, $scope.search.grade);
            	var ret = staticlist.concat(filteredData);

            	if (ret.length > 0) return ret;
            	var emptyCard = $scope.cards.emptycard || defaultEmptyCard;
            	ret.push(emptyCard);
            	return ret;
            };

            $scope.onCardInternalUrlClicked = function(card, internalUrl) {
				$scope.$parent.onCardInternalUrlClicked(card, internalUrl);
            };

            $scope.onCardLinkClicked = function(card, linkid) {
				$scope.$parent.onCardLinkClicked(card, linkid);
            };
            var params = nl.location.search();
			var searchParam = ('search' in params) ? params.search : '';
			var grade = ('grade' in params) ? params.grade : 'All';
            $scope.search = {filter: searchParam, img: nl.url.resUrl('search.png'), grade: grade};
            $scope.search.onSearch = function() {
            	if (!('onSearch' in $scope.cards.search)) return;
            	var grade = $scope.search.grade == 'All' ? null : $scope.search.grade;
            	return $scope.cards.search.onSearch($scope.search.filter, grade);
            };
			$scope.searchKeyHandler = function(keyevent) {
				if(keyevent.which === 13) {
					return $scope.search.onSearch($scope.search.filter, $scope.search.grade);
				}				
			};
            $scope.search.getResultsStr = function() {
                if ($scope.cards && $scope.cards.search && $scope.cards.search.img)
                    $scope.search.img = $scope.cards.search.img;

            	var len = 0;
            	if ($scope.cards && $scope.cards.cardlist) {
	            	var filteredData = $filter('nlFilter')($scope.cards.cardlist,
	            										 $scope.search.filter, $scope.search.grade);
					len = filteredData.length;
            	}
            	var maxLimit = 50;
            	if ($scope.cards && $scope.cards.search && $scope.cards.search.maxLimit) 
            	   maxLimit = $scope.cards.search.maxLimit; 
            	if (len <= 1) return nl.t('{} result', len);
            	if (len > maxLimit) return nl.t('{}+ results', maxLimit);
            	return nl.t('{} results', len);
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
            $scope.onCardInternalUrlClicked = function(card, internalUrl) {
            	$scope.$parent.onCardInternalUrlClicked(card, internalUrl);
            };

            $scope.onCardLinkClicked = function(card, linkid) {
				if (linkid !== 'details') {
	            	$scope.$parent.onCardLinkClicked(card, linkid);
					return;
				}
                var detailsDlg = nlDlg.create($scope);
				detailsDlg.setCssClass('nl-width-max');
                detailsDlg.scope.card = card;
                detailsDlg.show('lib_ui/cards/details_dlg.html');
            };
         }
    };
}];
//-------------------------------------------------------------------------------------------------
module_init();
})();

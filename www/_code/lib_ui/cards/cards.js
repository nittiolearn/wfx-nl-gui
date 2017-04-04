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
    .directive('nlCard', CardDirective)
    .directive('nlCardTitle', CardTitleDirective)
    .directive('nlCardImage', CardImageDirective)
    .directive('nlCardDesc', CardDescDirective);
}

//-------------------------------------------------------------------------------------------------
var CardsSrv = ['nl',
function(nl) {
	this.getEmptyCard = function(emptyCard) {
		var card = (emptyCard) ? emptyCard : {};
		if (!card.title) card.title = nl.t('Nothing to display');
		if (!card.help) card.help = nl.t('There is no data to display.');
		if (!card.icon && !card.icon2) card.icon2 = 'ion-minus-circled fblue';
		card.links = [];
		card.style = 'nl-bg-blue';
		card.children = [];
		return card;
	};
	
	this.updateGrades = function(cards, grades) {
		cards.grades = [{id: null, desc: 'All', grp: ''}].concat(grades);
	};
}];

var discardSearchWords = { "content_include": true};
var NlFilter = ['nl', '$filter',
function(nl, $filter) {
	return function(inputArray, filterString, filterGrade) {
		var filteredInput = inputArray;
		if (filterGrade.id) {
			filteredInput = [];
	    	for (var i=0; i < inputArray.length; i++) {
	    		var card = inputArray[i];
	    		if (card.grade != filterGrade.id) continue;
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
    var fetchMoreCard = {
        title : nl.t('Fetch More'),
        icon2 : 'ion-refresh fblue',
        internalUrl : 'show_results_details',
        help : nl.t('Did not find what you were looking for? Fetch more items from the server.'),
        children : [],
        style : 'nl-bg-blue'};
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
            
            $scope.showResultDetails = function() {
                if (!$scope.cards || !$scope.cards.search) return;
                var results = $scope.search.results || 0;
                var total = $scope.cards.cardlist.length;
                var text = nl.t('<p>Displaying <b>{}</b> of <b>{}</b> items.</p>', results, total);
                if (!$scope.cards.canFetchMore) {
                    nlDlg.popupAlert({title: '', template: text});
                    return;
                }
                text += nl.t('<p>You may <b>Featch more</b> items from the server if you are not finding what you are looking for.</p>');
                nlDlg.popupConfirm({title: '', template: text, okText: 'Featch more', cancelText: 'Close'})
                .then(function(res) {
                    if (!res) return;
                    $scope.$parent.onCardInternalUrlClicked(fetchMoreCard, 'fetch_more');
                });
            };

            var defMaxLimit = 50;
            var cacheAbove = 200;
            
            $scope.getCards = function(rebuildCache) {
            	if (!$scope.cards || !$scope.cards.cardlist) return [];
            	rebuildCache = rebuildCache || $scope.cards.rebuildCache;
            	$scope.cards.rebuildCache = false;
            	if (!rebuildCache 
            	    && $scope.cards.cardlist.length > cacheAbove && $scope.cachedList) {
            	    return $scope.cachedList;
            	}
                var ret = $scope.cards.staticlist || [];
            	var filteredData = $filter('nlFilter')($scope.cards.cardlist,
            										 $scope.search.filter, $scope.search.grade);
                var search = $scope.cards.search || {};
                if (search.img) $scope.search.img = search.img;
                var len = filteredData.length;
                var maxLimit = search.maxLimit || defMaxLimit;
                if (len > maxLimit) len = maxLimit;
            	ret = ret.concat(filteredData.slice(0, len));
                if ($scope.cards.canFetchMore) ret.push(fetchMoreCard);

                $scope.search.resultsStr
                    = len <= 1 ? nl.t('{} result', len)
                    : filteredData.length > maxLimit ? nl.t('{}+ results', maxLimit)
                    : nl.t('{} results', len);
                $scope.search.results = len;
                
                $scope.cachedList = ret;
            	if (ret.length > 0) return ret;
            	var emptyCard = $scope.cards.emptycard || defaultEmptyCard;
            	ret.push(emptyCard);
            	return ret;
            };

            $scope.onCardInternalUrlClicked = function(card, internalUrl) {
                if (internalUrl == 'show_results_details') {
                    $scope.showResultDetails();
                    return;
                }
                $scope.$parent.onCardInternalUrlClicked(card, internalUrl);
            };

            $scope.onCardLinkClicked = function(card, linkid) {
				$scope.$parent.onCardLinkClicked(card, linkid);
            };
            var params = nl.location.search();
			var searchParam = ('search' in params) ? params.search : '';
			var grade = ('grade' in params) ? params.grade : null;
            $scope.search = {filter: searchParam, img: nl.url.resUrl('search.png'), grade: {id: grade}};
            $scope.search.onSearch = function() {
                $scope.getCards(true); // Rebuild cache
            	if (!('onSearch' in $scope.cards.search)) return;
            	return $scope.cards.search.onSearch($scope.search.filter, $scope.search.grade.id, _onSearchParamChange);
            };
			$scope.searchKeyHandler = function(keyevent) {
				if(keyevent.which === 13) {
					return $scope.search.onSearch($scope.search.filter, $scope.search.grade.id, _onSearchParamChange);
				}				
			};
			function _onSearchParamChange(filter, grade) {
                $scope.search.filter = filter;
                $scope.search.grade = {id: grade};
			}
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
var CardTitleDirective = [
function() { return {restrict: 'E', templateUrl: 'lib_ui/cards/card-title.html'}; }];

var CardImageDirective = [
function() { return {restrict: 'E', templateUrl: 'lib_ui/cards/card-image.html'}; }];

var CardDescDirective = [
function() { return {restrict: 'E', templateUrl: 'lib_ui/cards/card-desc.html'}; }];

//-------------------------------------------------------------------------------------------------
module_init();
})();

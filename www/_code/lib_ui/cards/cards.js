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
    .directive('nlListview', ListviewDirective)
    .directive('nlCard', CardDirective)
    .directive('nlCardTitle', CardTitleDirective)
    .directive('nlCardImage', CardImageDirective)
    .directive('nlCardDesc', CardDescDirective);
}

//-------------------------------------------------------------------------------------------------
var CardsSrv = ['nl', '$filter', 
function(nl, $filter) {
    var self = this;

    // Just for documentation    
    var _knownAttrs = {
        'toolbar': 1, 
        'search': 1, 
        'staticlist': 1,
        'searchCategories': 1, // Currently used only in RNO code

        'cardlist': 1, 
        'canFetchMore': 1,
        'listConfig': 1
    };

    this.initCards = function(cards, params) {
        var params = nl.location.search();
        var searchParam = ('search' in params) ? params.search : '';
        var category = ('category' in params) ? params.category : null;
        cards._internal = {visibleCards: [], clickDebouncer: nl.CreateDeboucer(),
            search: {filter: searchParam, category: {id: category}, infotxt: ''}
        };
        this.updateCards(cards, params);
    };

    this.updateCards = function(cards, params) {
        if (!params) params = {};
        for(var attr in params) cards[attr] = params[attr];
        if (!cards.staticlist) cards.staticlist = [];
        if (!cards.cardlist) cards.cardlist = [];
        if ('searchCategories' in cards)
            cards.searchDropdown = [{id: null, desc: 'All', grp: ''}].concat(cards.searchCategories);
        if (cards.search) {
            if(!cards.search.placeholder)
                cards.search.placeholder = 'Start typing to search';            
            if (!cards.search.icon) cards.search.icon = 'ion-ios-search';
        } 
        _updateInternal(cards);
    };
    
    this.updateInternal = function(cards, timeout) {
        cards._internal.clickDebouncer.debounce(timeout, _updateInternal)(cards);
    };

    var _MAX_VISIBLE = 100;
    function _updateInternal(cards) {
        var filteredCards = cards.cardlist;
        if (cards.search) {
            var search = cards._internal.search;
            filteredCards = $filter('nlFilter')(filteredCards, search.filter, search.category);
        }
        var len = filteredCards.length > _MAX_VISIBLE ? _MAX_VISIBLE : filteredCards.length;
        var recs = cards.staticlist.concat(filteredCards.slice(0, len));
        cards._internal.search.visible = len;
        _updateInfotext(cards.cardlist.length, len, cards);
        cards._internal.visibleCards = recs;
    }

    function _animateInfotext(cards, oldInfotxt) {
        if (oldInfotxt == cards._internal.search.infotxt) return;
        cards._internal.search.clsAnimate = 'anim-highlight-on';
        nl.timeout(function() {
            cards._internal.search.clsAnimate = '';
        }, 800);
    }
    
    function _updateInfotext(total, visible, cards) {
        var oldInfotxt = cards._internal.search.infotxt;
        var msg1 = nl.t('There are no items to display.');
        cards._internal.search.cls = 'fgrey2';
        cards._internal.search.showDetails = false;
        if (total == 0) {
            cards._internal.search.infotxt = nl.fmt2('<i class="padding-mid icon ion-alert-circled"></i>{}', 
                msg1);
            cards._internal.search.infotxt2 = msg1;
            cards._internal.search.cls = 'forange fsh4 nl-link-text';
            return _animateInfotext(cards, oldInfotxt);
        }
        var item = (total == 1) ? 'item' : 'items';
        msg1 = nl.t('Displaying <b>{}</b> of <b>{}</b> {}.', visible, total, item);
        if (!cards.canFetchMore) {
            cards._internal.search.infotxt = msg1;
            cards._internal.search.infotxt2 = msg1;
            return _animateInfotext(cards, oldInfotxt);
        }
        cards._internal.search.cls = 'fgrey2 nl-link-text';
        cards._internal.search.showDetails = true;
        cards._internal.search.infotxt = nl.t('{} <b>Fetch more <i class="icon ion-refresh"></i></b>', msg1);
        cards._internal.search.infotxt2 = nl.t('{} Do you want to fetch more items from server?', msg1);
        return _animateInfotext(cards, oldInfotxt);
    }
}];

var discardSearchWords = {};
var NlFilter = ['nl', '$filter',
function(nl, $filter) {
	return function(inputArray, filterString, filterCateogry) {
		var filteredInput = inputArray;
		if (filterCateogry.id) {
			filteredInput = [];
	    	for (var i=0; i < inputArray.length; i++) {
	    		var card = inputArray[i];
	    		if (card.category != filterCateogry.id) continue;
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

//-------------------------------------------------------------------------------------------------
var ListviewDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return {
        restrict: 'E',
        templateUrl: 'lib_ui/cards/listview.html',
    };
}];

//-------------------------------------------------------------------------------------------------
var CardsDirective = ['nl', 'nlDlg', '$filter', 'nlCardsSrv',
function(nl, nlDlg, $filter, nlCardsSrv) {
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
                if (!$scope.cards || !$scope.cards._internal) return;
                if (!$scope.cards._internal.search.showDetails) return;
                var text = $scope.cards._internal.search.infotxt2;
                if (!$scope.cards.canFetchMore) {
                    nlDlg.popupAlert({title: '', template: text});
                    return;
                }
                nlDlg.popupConfirm({title: '', template: text, okText: 'Fetch more', cancelText: 'Close'})
                .then(function(res) {
                    if (!res) return;
                    $scope.$parent.onCardInternalUrlClicked({}, 'fetch_more');
                });
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

            $scope.onSearchButton = function() {
                nlCardsSrv.updateInternal($scope.cards, 0);
                if (!('onSearch' in $scope.cards.search)) return;
                var search = $scope.cards._internal.search;
            	return $scope.cards.search.onSearch(search.filter, search.category.id, _onSearchParamChange);
            };

			$scope.searchKeyHandler = function(event) {
                var MAX_KEYSEARCH_DELAY = 200;
                var timeout = (event.which === 13) ? 0 : MAX_KEYSEARCH_DELAY;
                nlCardsSrv.updateInternal($scope.cards, timeout);
			};

			function _onSearchParamChange(filter, category) {
                $scope.cards._internal.search.filter = filter || '';
                $scope.cards._internal.search.category = {id: category || null};
			}
         }
    };
}];

var SCROLL_WIDTH = 8;
var _defCardWidth = 360;
var _defCardAr = 2/3;
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

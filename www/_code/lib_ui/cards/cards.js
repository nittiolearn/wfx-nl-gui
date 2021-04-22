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
    .directive('nlCards2', Cards2Directive)
    .directive('nlListview', ListviewDirective)
    .directive('nlCard', CardDirective)
    .directive('nlCard2', Card2Directive)
    .directive('nlComputeImgInfo', ComputeImgInfoDirective)
    .directive('nlCardTitle', CardTitleDirective)
    .directive('nlCardImage', CardImageDirective)
    .directive('nlCardImage2', CardImageDirective2)
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
        'fetchInProgress': 1,
        'listConfig': 1
    };

    this.initCards = function(cards, params) {
        var urlParams = nl.location.search();
        var searchParam = ('search' in urlParams) ? urlParams.search : '';
        var category = ('category' in urlParams) ? urlParams.category : null;
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
        if ('searchCategories' in cards) {
            cards.searchDropdown = [{id: null, desc: 'All', grp: ''}];
            for (var i=0; i<cards.searchCategories.length; i++) {
                var c = cards.searchCategories[i];
                cards.searchDropdown.push({id: c, desc: c, grp: ''});
            }
        }
        if (cards.search) {
            if(!cards.search.placeholder)
                cards.search.placeholder = 'Start typing to search';            
            if (!cards.search.icon) cards.search.icon = cards.search.onSearch ? 'ion-funnel' : '';
        } 
        if (cards.savejson && cards.savejson.show) {
            if (!cards.savejson.icon) cards.savejson.icon = 'ion-archive';
        }
        _updateInternal2(cards);
    };
    
    this.updateInternal = function(cards, timeout, justShowHint) {
        cards._internal.clickDebouncer.debounce(timeout, _updateInternal)(cards, justShowHint);
    };

    function _updateInternal(cards, justShowHint) {
        var search = cards._internal.search;
        if (justShowHint && search.filter) {
            cards._internal.search.usageHint = 'Press enter to search.';
            return;
        }
        cards._internal.search.usageHint = '';
        cards._internal.search.infotxt = 'Searching ...';
        nl.timeout(function() {
            if (!cards.search || !cards.search.customSearch) return _updateInternal2(cards);
            cards.search.customSearch(search.filter, search.category);
        }, 100);
    }

    var _MAX_VISIBLE = 500;
    function _updateInternal2(cards) {
        var filteredCards = cards.cardlist;
        if (cards.search) {
            var search = cards._internal.search;
            if (!cards.search.customSearch)
                filteredCards = $filter('nlFilter')(filteredCards, search.filter, search.category);
        }
        var matchedLen = filteredCards.length;
        if (cards.max_visible) _MAX_VISIBLE = cards.max_visible;
        var len = filteredCards.length > _MAX_VISIBLE ? _MAX_VISIBLE : filteredCards.length;
        if (cards.createCardFn) {
            for (var i=0; i<len; i++) {
                if (!filteredCards[i]._createPending) continue;
                filteredCards[i] = cards.createCardFn(filteredCards[i]._createPending);
            }    
        }
        var recs = cards.staticlist.concat(filteredCards.slice(0, len));
        cards._internal.search.visible = len;
        _updateInfotext(cards.cardlist.length, matchedLen, len, cards);
        cards._internal.visibleCards = recs;
    }

    function _animateInfotext(cards, oldInfotxt) {
        if (oldInfotxt == cards._internal.search.infotxt) return;
        cards._internal.search.clsAnimate = 'anim-highlight-on';
        nl.timeout(function() {
            cards._internal.search.clsAnimate = '';
        }, cards.largeData ? 10: 800);
    }
    
    function _updateInfotext(total, matched, visible, cards) {
        var oldInfotxt = cards._internal.search.infotxt;
        var msg1 = nl.t('There are no items to display.');
        cards._internal.search.cls = 'fgrey';
        cards._internal.search.showDetails = false;
        cards._internal.search.usageHint = '';
        var item = (total == 1) ? 'item' : 'items';
        if (total == 0) {
            msg1 = nl.fmt2('<i class="padding-mid icon ion-alert-circled"></i>{}', msg1);
            cards._internal.search.cls = 'forange fsh4';
        } else if (!cards._internal.search.filter) {
            if (visible < total) {
                msg1 = nl.t('Showing <b>{}</b> of <b>{}</b> {}.', visible, total, item);
            } else {
                msg1 = nl.t('Showing <b>{}</b> {}.', visible, item);
            }
        } else {
            var match = (visible == 1) ? 'match' : 'matches';
            var plus = matched > visible ? '+' : '';
            msg1 = nl.t('Found <b>{}{}</b> {} from <b>{}</b> {} searched.', 
                visible, plus, match, total, item);
        }
        if (!cards.canFetchMore) {
            cards._internal.search.infotxt = cards.fetchInProgress 
                ? nl.t('{} Fetching more.', msg1) 
                : nl.t('{} {}.', msg1, cards._internal.search.filter ? 'Search complete' : 'Fetch complete');
            cards._internal.search.infotxt2 = msg1;
            return _animateInfotext(cards, oldInfotxt);
        }
        cards._internal.search.cls += ' nl-link-text';
        cards._internal.search.showDetails = true;
        if(cards._internal.search.filter) 
            cards._internal.search.infotxt = nl.t('{} <b>Search more <i class="icon ion-refresh"></i></b>.', msg1);
        else 
            cards._internal.search.infotxt = nl.t('{} <b>Fetch more <i class="icon ion-refresh"></i></b>.', msg1);

        cards._internal.search.infotxt2 = nl.t('{} Not found what you are looking for? Do you want to fetch more items from the server?', msg1);
        return _animateInfotext(cards, oldInfotxt);
    }
}];

var _keywords = {'grp': true};
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
		    var pos = filterStrings[i].indexOf(':');
		    var keyword = pos > 0 ? filterStrings[i].substring(0, pos) : null;
		    if (keyword in _keywords) continue;
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
var CardsDirective = ['nl', 'nlDlg', '$filter', 'nlCardsSrv', 'nlExporter',
function(nl, nlDlg, $filter, nlCardsSrv, nlExporter) {
    return _cardsDirectiveImpl(nl, nlDlg, $filter, nlCardsSrv, nlExporter,
        'lib_ui/cards/cards.html');
}];

//-------------------------------------------------------------------------------------------------
var Cards2Directive = ['nl', 'nlDlg', '$filter', 'nlCardsSrv', 'nlExporter',
function(nl, nlDlg, $filter, nlCardsSrv, nlExporter) {
    return _cardsDirectiveImpl(nl, nlDlg, $filter, nlCardsSrv, nlExporter,
        'lib_ui/cards/cards2.html');
}];

//-------------------------------------------------------------------------------------------------
function _cardsDirectiveImpl(nl, nlDlg, $filter, nlCardsSrv, nlExporter, templateUrl) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: templateUrl,
        scope: {
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
            
            $scope.showResultDetails = function() {
                if (!$scope.cards || !$scope.cards._internal) return;
                if (!$scope.cards._internal.search.showDetails) return;
                var text = $scope.cards._internal.search.infotxt2;
                if (!$scope.cards.canFetchMore) {
                    nlDlg.popupAlert({title: '', template: text});
                    return;
                }
                $scope.$parent.onCardInternalUrlClicked({}, 'fetch_more');
            };

            $scope.onCardInternalUrlClicked = function(card, internalUrl) {
                if (!internalUrl) return;
                if (internalUrl == 'show_results_details') {
                    $scope.showResultDetails();
                    return;
                }
                $scope.$parent.onCardInternalUrlClicked(card, internalUrl);
            };

            $scope.onCardLinkClicked = function(card, linkid) {
                if ($scope.$parent.onCardLinkClicked) $scope.$parent.onCardLinkClicked(card, linkid);
                else if ($scope.$parent.$parent.onCardLinkClicked) $scope.$parent.$parent.onCardLinkClicked(card, linkid)
                else if ($scope.$parent.$parent.$parent.onCardLinkClicked) $scope.$parent.$parent.$parent.onCardLinkClicked(card, linkid)
            };

            $scope.onSearchButton = function() {
                nlCardsSrv.updateInternal($scope.cards, 0);
                if (!$scope.cards.search.onSearch) {
                    $scope.showResultDetails();
                    return;
                }
                var search = $scope.cards._internal.search;
            	return $scope.cards.search.onSearch(search.filter, search.category.id, _onSearchParamChange);
            };

            $scope.saveJsonButton = function() {
                var jsonToSave = angular.toJson($scope.cards.cardlist, 2);
                _saveJSON(jsonToSave);
            }

            $scope.getContTabHeight = function() {
                var document = nl.window.document;
                var bodyElement = document.getElementsByClassName("nl-learning-report-body")
                var topElem = document.getElementsByClassName("nl-topsection");
                return (bodyElement[0].clientHeight - topElem[0].clientHeight-18);
            };

			$scope.searchKeyHandler = function(event) {
                if (!$scope.cards.largeData && event.which === 13) {
                    $scope.showResultDetails();
                    return;
                }
                var MAX_KEYSEARCH_DELAY = 200;
                var justShowHint = $scope.cards.largeData && event.which !== 13;
                nlCardsSrv.updateInternal($scope.cards, MAX_KEYSEARCH_DELAY, justShowHint);
			};

            $scope.canShowNext = function(cards) {
                cards.canShowNext(cards)
            };

            $scope.canShowPrev = function(cards) {
                cards.canShowPrev(cards);
            };

            $scope.onClickOnNext = function(cards) {
                cards.onClickOnNextFn(cards, $scope)
            };

            $scope.onClickOnPrev = function(cards) {
                cards.onClickOnPrevFn(cards, $scope);
            };

            function _onSearchParamChange(filter, category) {
                $scope.cards._internal.search.filter = filter || '';
                $scope.cards._internal.search.category = {id: category || null};
            }
            
            function _saveJSON(data) {
                if(!data) {
                    nlDlg.popupAlert({title: 'Save Error', template: 'No data to save in the json file'});
                    return;
                }
                nlExporter.exportTextFile('cards.json', data);
            }
         }
    };
};

var SCROLL_WIDTH = 8;
var _HZ_SCREEN = 36;
var _defCardWidth = 280;
var _defCardAr = 1.4;
var _minMarginX = 32; // px
var _cardsSize = {"L": {cardWidth: 225, cardHeight: 270, ar: 1.3},
                  "M": {cardWidth: 225, cardHeight: 270, ar: 1.3},
                  "S": {cardWidth: 225, cardHeight: 225, ar: 1.25}}

function _updateCardDimensions(nl, $scope, cardsContainer) {
    if ($scope.cards && $scope.cards.card2) {
        var size = $scope.cards.size;
        var cardHWDict = _cardsSize[size];
        var ar = cardHWDict.ar;
        var w = _getCardForCard2Width(nl, cardHWDict);
        $scope.w = w;
        $scope.h = ar*w;
        $scope.fs = 100;
        $scope.mr = 2;
    } else {
        var w = _getCardWidth(cardsContainer);
        $scope.w = w;
        $scope.h = _defCardAr*w;
        $scope.fs = w/_defCardWidth*100;
        
        // It seems indeterminstic when scroll bar width is computed.
        // So clientWidth is not a solution here. offsetWidth - scrollBarWidth is used here.
        var contWidth = cardsContainer[0].offsetWidth - SCROLL_WIDTH;
        var cardsPerRow = Math.floor(contWidth/(w+_minMarginX));
        if (cardsPerRow == 0) cardsPerRow = 1;
        var margins = cardsPerRow+1;
        $scope.ml = (contWidth - w*cardsPerRow) / margins;    
    }
}

function _getCardForCard2Width(nl, cardSizeDict) {
    var w = cardSizeDict.cardWidth;
    var screenW = nl.rootScope.screenWidth;
    var contWidth = screenW - _HZ_SCREEN;
    if (contWidth < w) w = contWidth;
    return w;
}

function _getCardWidth(cardsContainer) {
    var w = _defCardWidth;

    var contWidth = cardsContainer[0].offsetWidth - SCROLL_WIDTH;
    var contHeight = cardsContainer[0].offsetHeight;

    if (contWidth < w) w = contWidth;
    return w;
}

function _canCoverImg(url, isCard2) {
	var info = _imgInfo[url];
	if (!info) return false;
    if ('canCover' in info) return info.canCover;
    if (isCard2) {
        var ar = info.w ? info.h/info.w : 0;
        info.canCover = (ar < 1);
        return info.canCover;
    }
    var ar = info.w ? info.h/info.w : 0;
    info.canCover = (ar < 1);
    return info.canCover;
}

//-------------------------------------------------------------------------------------------------
var _imgInfo = {};

var ComputeImgInfoDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return {
        restrict: 'A',
        link: function($scope, iElem, iAttrs) {
                iElem.bind('load', function(params) {
                    nl.timeout(function() {
                        var w = iElem[0].offsetWidth;
                        var h = iElem[0].offsetHeight;
                    _imgInfo[iAttrs.src] = {w:w, h:h};
                    });
                });
            }
        };
    }   
];

//-------------------------------------------------------------------------------------------------
var CardDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return _cardDirectiveImpl(nl, nlDlg, 'lib_ui/cards/card.html');
}];

//-------------------------------------------------------------------------------------------------
var Card2Directive = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return _cardDirectiveImpl(nl, nlDlg, 'lib_ui/cards/card2.html');
}];

//-------------------------------------------------------------------------------------------------
function _cardDirectiveImpl(nl, nlDlg, templateUrl) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: templateUrl,
        scope: {
            card: '='
        },
        link: function($scope, iElem, iAttrs) {
        	$scope.canCover = function(e, isCard2) {
        		if (!$scope.card || !$scope.card.icon) return false;
        		return _canCoverImg($scope.card.icon, isCard2);
            };
            
            $scope.getComputedHeightStyle = function(card) {
                if (!card) return;
                if (card.size == 'L') return 55;
                if (card.size == 'M') return 55;
                if (card.size == 'S') return 50;
            };

            $scope.getTextAreaHeight = function(card) {
                if (!card) return;
                if (card.size == 'L') return 65;
                if (card.size == 'M') return 65;
                if (card.size == 'S') return 60;
            };
            
            $scope.getProgressBarTop = function() {
                if (!card) return;
                if (card.size == 'L') return 60;
                if (card.size == 'M') return 55;
                if (card.size == 'S') return 50;
            };

            $scope.noPropogate = function(e) {
				e.stopImmediatePropagation();
            };
            
            $scope.onCardInternalUrlClicked = function(e, card, internalUrl) {
            	e.preventDefault();
                e.stopImmediatePropagation();
                if (card.type == 'expired') internalUrl = 'details';
            	$scope.$parent.onCardInternalUrlClicked(card, internalUrl);
            };

            $scope.onCardLinkClicked = function(e, card, linkid) {
            	e.preventDefault();
				e.stopImmediatePropagation();
				if (linkid !== 'details') {
	            	$scope.$parent.onCardLinkClicked(card, linkid);
					return;
				}
                var detailsDlg = nlDlg.create($scope);
				detailsDlg.setCssClass('nl-width-max');
                detailsDlg.scope.card = card;
                detailsDlg.show('lib_ui/cards/details_dlg.html');
            };

            $scope.getLaunchIconClass = function(card) {
                if (card.type == 'progress' || card.type == 'pending') {
                    return "fsh1";
                } else if (card.type == 'completed') {
                    return "fsh3"
                } else if (card.type == 'expired') {
                    return "fsh3"
                }

            }

            $scope.getLaunchIcon = function(card) {
                if (card.type == 'progress' || card.type == 'pending') {
                    return "play_circle_outline";
                } else if (card.type == 'completed') {
                    return "arrow_back_ios";
                } else if (card.type == 'expired') {
                    return "info";
                }

            }
         }
    };
};

//-------------------------------------------------------------------------------------------------
var CardTitleDirective = [
function() { return {restrict: 'E', templateUrl: 'lib_ui/cards/card-title.html'}; }];

var CardImageDirective = [
function() { return {restrict: 'E', templateUrl: 'lib_ui/cards/card-image.html'}; }];

var CardImageDirective2 = [
function() { 
    return {
        restrict: 'E', 
        transclude: true,
        templateUrl: 'lib_ui/cards/card-image2.html',
        scope: {
            card: '='
        },
        link: function($scope, iElem, iAttrs) {
            $scope.getImgMaxHeight = function(card) {
                if(card.size == 'L') return 260;
                if(card.size == 'M') return 200;
                if(card.size == 'S') return 150;
            };
        }
    }    
}];
    
var CardDescDirective = [
function() { return {restrict: 'E', templateUrl: 'lib_ui/cards/card-desc.html'}; }];

//-------------------------------------------------------------------------------------------------
module_init();
})();

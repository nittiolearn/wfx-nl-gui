(function() {

//-------------------------------------------------------------------------------------------------
// UI collection module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui', [])
    .directive('nlLoading', LoadingDirective)
    .directive('nlInternalScroll', InternalScrollDirective)
    .directive('nlNoCtxMenu', NoCtxMenuDirective)
    .directive('nlCards', CardsDirective)
    .service('nlKeyboardHandler', KeyboardHandler)
    .service('nlPageNoSrv', PageNoSrv)
    .service('nlScrollbarSrv', ScrollbarSrv)
    .directive('nlScrollbar', ScrollbarDirective)
    .directive('nlRetainAr', RetainArDirective);
}

//-------------------------------------------------------------------------------------------------
var LoadingDirective = ['$window', '$timeout', '$ionicLoading', '$parse',
function($window, $timeout, $ionicLoading, $parse) {
    return {
        restrict: 'A',
        scope: {
            'nlLoading': '=',
            'nlLoadDone': '='
        },
        link: function($scope, iElem, iAttrs) {
            console.log('link of LoadingDirective');
            if (!$scope.nlLoading) {
                $ionicLoading.show({
                    template : 'Loading...'
                });
            }
            var unregister = $scope.$watch('nlLoading', function(newVal, oldVal) {
                console.log('Watch success: ', newVal, oldVal);
                if (newVal) {
                    $ionicLoading.hide();
                    unregister();
                    $parse($scope.nlLoadDone)();
                }
            });
            
        }
    };
}];

//-------------------------------------------------------------------------------------------------
var InternalScrollDirective = ['$window', '$timeout', 'nlUtils', 'nlPageNoSrv', 'nlScrollbarSrv',
function($window, $timeout, nlUtils, nlPageNoSrv, nlScrollbarSrv) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'ui/internal_scroll.html',
        scope: {
            pageNoData: '='
        },
        link: function($scope, iElem, iAttrs) {
            console.log('link of InternalScrollDirective');
            if (!$scope.pageNoData) return;
            console.log('link of InternalScrollDirective of outer most');
            nlScrollbarSrv.setTotal(1);
            nlScrollbarSrv.gotoPage(1);
            nlUtils.onViewEnter($scope.$parent, function() {
                console.log('view enter');
                nlScrollbarSrv.setTotal(1);
                nlScrollbarSrv.gotoPage(1);
            });
        }
    };
}];

//-------------------------------------------------------------------------------------------------
var NoCtxMenuDirective = ['$window', '$timeout',
function($window, $timeout) {
    return {
        restrict: 'A',
        link: function(scope, iElem, iAttrs) {
            iElem.off('contextmenu');
            iElem.on('contextmenu', function(event) {
                event.preventDefault();
                return false;
            });
        }
    };
}];

//-------------------------------------------------------------------------------------------------
var CardsDirective = ['$window', '$timeout', 'nlUtils', 'nlPageNoSrv', 'nlScrollbarSrv',
function($window, $timeout, nlUtils, nlPageNoSrv, nlScrollbarSrv) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'ui/cards.html',
        scope: {
            cards: '=',
            pageNoData: '='
        },
        link: function($scope, iElem, iAttrs) {
            $scope.pages = [];
            angular.element($window).on('resize', function() {
                $scope.$apply(function() {
                    _paginateCards($scope, iElem, nlPageNoSrv, nlScrollbarSrv);
                });
            });
            $timeout(function() {
                _paginateCards($scope, iElem, nlPageNoSrv, nlScrollbarSrv);
            }); // 0 timeout - just executes after DOM rendering is complete
            
            nlUtils.onViewEnter($scope.$parent, function() {
                console.log('view enter');
                nlScrollbarSrv.setTotal($scope.pages.length);
                nlScrollbarSrv.gotoPage(1);
            });
         }
    };
}];

function _paginateCards($scope, cardsContainer, nlPageNoSrv, nlScrollbarSrv) {
    console.log('_paginateCards called');
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
    if (nlPageNoSrv.currentPage > pageCount) {
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
// Just contains the data part of Scrollbar service so as to enable embeding in scope and making 
// accessible to the view. Use it as readonly. Make changes via ScrollbarSrv.
var KeyboardHandler = ['nlLog', 
function(nlLog) {
    
    this.CHECK = function($event, key, modifiers) {
        if (modifiers !== undefined) {
            if ('ctrl' in modifiers && modifiers.ctrl && !$event.ctrlKey) return false;
            if ('shift' in modifiers && modifiers.shift && !$event.shiftKey) return false;
            if ('alt' in modifiers && modifiers.alt && !$event.altKey) return false;
        }
        return $event.keyCode == key;
    };
    
    this.ESC = function($event, modifiers) { return this.CHECK($event, 27, modifiers);};
    this.UP = function($event, modifiers) { return this.CHECK($event, 38, modifiers);};
    this.DOWN = function($event, modifiers) { return this.CHECK($event, 40, modifiers);};
    this.PAGEUP = function($event, modifiers) { return this.CHECK($event, 33, modifiers);};
    this.PAGEDOWN = function($event, modifiers) { return this.CHECK($event, 34, modifiers);};
    this.HOME = function($event, modifiers) { return this.CHECK($event, 36, modifiers);};
    this.END = function($event, modifiers) { return this.CHECK($event, 35, modifiers);};

    var keyHandler = null;
    var swipeHandler = null;
    this.setKeyHandler = function(fn) {
        keyHandler = fn;
    };
    
    this.setSwipeHandler = function(fn) {
        swipeHandler = fn;
    };
    
    this.onKeyDown = function($event) {
        if (keyHandler) keyHandler($event);
        $event.stopImmediatePropagation();
    };

    this.onSwipe = function($event) {
        if (swipeHandler) swipeHandler($event);
        $event.stopImmediatePropagation();
    };
}];

//-------------------------------------------------------------------------------------------------
// Scroll thumb dimensions in percentages
var SCROLL_DIMS = {min: 5, max: 100};

//-------------------------------------------------------------------------------------------------
// Just contains the data part of Scrollbar service so as to enable embeding in scope and making 
// accessible to the view. Use it as readonly. Make changes via ScrollbarSrv.
var PageNoSrv = [
function() {
    this.totalPages = 1;
    this.currentPage = 1;
    this.thumbHeight = SCROLL_DIMS.max;
    this.thumbTop = 0;
    this.pageAnim = 'nl-anim-pg-same';
}];

//-------------------------------------------------------------------------------------------------
var ScrollbarSrv = ['nlLog', 'nlPageNoSrv', '$timeout',
function(nlLog, nlPageNoSrv, $timeout) {

    this.setTotal = function(total) {
        if (total < 1) total = 1;
        nlPageNoSrv.totalPages = total;
        updateThumbHeight();
    };

    this.gotoPage = function(newPage) {
        console.log('gotoPage: ' + newPage);
        if (newPage < 1) newPage=1;
        else if (newPage > nlPageNoSrv.totalPages) {
            newPage=nlPageNoSrv.totalPages;
        }
        nlPageNoSrv.pageAnim = _getAnimation(nlPageNoSrv.currentPage, newPage);
        var self = this;
        $timeout(function() {
            nlPageNoSrv.currentPage=newPage;
            self.updateThumbTop(nlPageNoSrv.currentPage);
        }); // 0 timeout - first the ng-class needs to be updated; in next cycle update page number

    };

    this.updateThumbTop = function(currentPage) {
        var numSlots = nlPageNoSrv.totalPages <= 1 ? nlPageNoSrv.totalPages : nlPageNoSrv.totalPages -1;
        var mySlot = currentPage - 1;
        var deltaPerSlot = SCROLL_DIMS.max-nlPageNoSrv.thumbHeight;
        var thumbTop = mySlot/numSlots*deltaPerSlot;
        if (thumbTop + nlPageNoSrv.thumbHeight > 100) thumbTop = 100 - nlPageNoSrv.thumbHeight;
        nlPageNoSrv.thumbTop = thumbTop;
    };
    
    function updateThumbHeight() {
        var thumbHeight = SCROLL_DIMS.max/nlPageNoSrv.totalPages;
        if (thumbHeight < SCROLL_DIMS.min) thumbHeight = SCROLL_DIMS.min;
        nlPageNoSrv.thumbHeight = thumbHeight;
    };
}];

function _getAnimation(oldPage, newPage) {
    if (oldPage == newPage) return 'nl-anim-pg-same';
    if (oldPage > newPage) return 'nl-anim-pg-up';
    return 'nl-anim-pg-down';
}


//-------------------------------------------------------------------------------------------------
var ScrollbarDirective = ['nlScrollbarSrv', 'nlPageNoSrv', 'nlKeyboardHandler',
function(nlScrollbarSrv, nlPageNoSrv, nlKeyboardHandler) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'ui/scrollbar.html',
        scope: {
          pageNoData: '=',
          isMenuShown: '='
        },
        link: function($scope, scrollBarElem, scrollBarAttrs) {

            var children = scrollBarElem.children();
            var scrollArea = angular.element(children[1]);
            var scrollElems = scrollArea.children();
            var pageNo = angular.element(children[3]);
            
            var scrollUp = angular.element(scrollElems[0]);
            var scrollThumb = angular.element(scrollElems[1]);
            var scrollDown = angular.element(scrollElems[2]);
            var scrollHint = angular.element(scrollThumb.children()[0]);
            
            $scope.scrollUp = function($event) {
                nlScrollbarSrv.gotoPage(nlPageNoSrv.currentPage-1);
            };
            
            $scope.scrollDown = function($event) {
                nlScrollbarSrv.gotoPage(nlPageNoSrv.currentPage+1);
            };
            
            nlKeyboardHandler.setKeyHandler(function ($event) {
                console.log('TODO: scroller.onKeyDown: ', $event.keyCode, $event.ctrlKey, $event.altKey, $event.shiftKey);
                if (nlKeyboardHandler.UP($event) || nlKeyboardHandler.PAGEUP($event)) {
                    nlScrollbarSrv.gotoPage(nlPageNoSrv.currentPage-1);
                } else if (nlKeyboardHandler.DOWN($event) || nlKeyboardHandler.PAGEDOWN($event)) {
                    nlScrollbarSrv.gotoPage(nlPageNoSrv.currentPage+1);
                } else if (nlKeyboardHandler.HOME($event)) {
                    nlScrollbarSrv.gotoPage(1);
                } else if (nlKeyboardHandler.END($event)) {
                    nlScrollbarSrv.gotoPage(nlPageNoSrv.totalPages);
                }
            });

            nlKeyboardHandler.setSwipeHandler(function ($event) {
                if ($event.gesture.direction === 'up') {
                    nlScrollbarSrv.gotoPage(nlPageNoSrv.currentPage+1);
                } else if ($event.gesture.direction === 'down') {
                    nlScrollbarSrv.gotoPage(nlPageNoSrv.currentPage-1);
                }
                console.log('TODO: scroller.swipeHandler: ', $event);
            });
            
            var scrollOngoing = false;
            var pxDeltaPerPage = 0;
            $scope.scrollingPageNo = 1;

            $scope.onTouch = function($event) {
                $scope.scrollingPageNo = nlPageNoSrv.currentPage;
                scrollHint.css({display: 'block'});
                
                var pxMaxDelta = scrollArea[0].offsetHeight - scrollThumb[0].offsetHeight;
                pxDeltaPerPage = pxMaxDelta/nlPageNoSrv.totalPages;
                console.log(pxMaxDelta, pxDeltaPerPage);
            };
            
            $scope.onScroll = function($event) {
                scrollOngoing = true;
                var deltaPages = Math.round($event.gesture.deltaY/pxDeltaPerPage);

                var pageNo = nlPageNoSrv.currentPage + deltaPages;
                console.log($event.gesture.deltaY, pxDeltaPerPage, deltaPages, nlPageNoSrv.currentPage, pageNo);
                if (pageNo > nlPageNoSrv.totalPages) pageNo = nlPageNoSrv.totalPages;
                if (pageNo < 1) pageNo = 1;
                $scope.scrollingPageNo = pageNo;
                nlScrollbarSrv.updateThumbTop($scope.scrollingPageNo);
            };
            
            $scope.onRelease = function($event) {
                scrollHint.css({display: 'none'});
                if (!scrollOngoing) return;
                scrollOngoing = false;
                nlScrollbarSrv.gotoPage($scope.scrollingPageNo);
            };
            
        }
    };
}];

//-------------------------------------------------------------------------------------------------
var RetainArDirective = ['$window', 'nlUtils',
function($window, nlUtils) {
    return {
        restrict: 'A',
        transclude: true,
        link: function(scope, iElem, iAttrs) {
        }
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

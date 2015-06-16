(function() {

//-------------------------------------------------------------------------------------------------
// scroll.js:
// Implements scroll bar UI, internal scrollbars and keboard handlers
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.scroll', [])
    .service('nlKeyboardHandler', KeyboardHandler)
    .directive('nlInternalScroll', InternalScrollDirective)
    .service('nlScrollbarSrv', ScrollbarSrv)
    .directive('nlScrollbar', ScrollbarDirective);
}

//-------------------------------------------------------------------------------------------------
// Just contains the data part of Scrollbar service so as to enable embeding in scope and making 
// accessible to the view. Use it as readonly. Make changes via ScrollbarSrv.
var KeyboardHandler = ['nl', 
function(nl) {
    
    this.CHECK = function($event, key, modifiers) {
        if (modifiers !== undefined) {
            if ('ctrl' in modifiers && modifiers.ctrl && !$event.ctrlKey) return false;
            if ('shift' in modifiers && modifiers.shift && !$event.shiftKey) return false;
            if ('alt' in modifiers && modifiers.alt && !$event.altKey) return false;
        }
        return $event.keyCode == key;
    };
    
    this.F1 = function($event, modifiers) { return this.CHECK($event, 112, modifiers);};
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
var InternalScrollDirective = ['nl', '$window', 'nlScrollbarSrv',
function(nl, $window, nlScrollbarSrv) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'lib_ui/scroll/internal_scroll.html',
        scope: {
            pgInfo: '='
        },
        link: function($scope, iElem, iAttrs) {
            nl.log.debug('link of InternalScrollDirective');
            if (!$scope.pgInfo) return;
            nl.log.debug('link of InternalScrollDirective of outer most');
            nlScrollbarSrv.setTotal(1);
            nlScrollbarSrv.gotoPage(1);
            nl.router.onViewEnter($scope.$parent, function() {
                nl.log.debug('InternalScrollDirective: view enter');
                nlScrollbarSrv.setTotal(1);
                nlScrollbarSrv.gotoPage(1);
            });
        }
    };
}];

//-------------------------------------------------------------------------------------------------
// Scroll thumb dimensions in percentages
var SCROLL_DIMS = {min: 5, max: 100};

//-------------------------------------------------------------------------------------------------
var ScrollbarSrv = ['nl', 
function(nl) {

    this.setTotal = function(total) {
        if (total < 1) total = 1;
        nl.pginfo.totalPages = total;
        updateThumbHeight();
    };

    this.gotoPage = function(newPage, bAnimation) {
        nl.log.debug('gotoPage: ' + newPage);
        if (bAnimation === undefined) bAnimation = false;
        if (newPage < 1) newPage=1;
        else if (newPage > nl.pginfo.totalPages) {
            newPage=nl.pginfo.totalPages;
        }
        nl.pginfo.pageAnim = _getAnimation(nl.pginfo.currentPage, newPage, bAnimation);
        var self = this;
        nl.timeout(function() {
            nl.pginfo.currentPage=newPage;
            self.updateThumbTop(nl.pginfo.currentPage);
            nl.log.debug('nl.pginfo: ', nl.pginfo);
        }); // 0 timeout - first the ng-class needs to be updated; in next cycle update page number

    };

    this.updateThumbTop = function(currentPage) {
        var numSlots = nl.pginfo.totalPages <= 1 ? nl.pginfo.totalPages : nl.pginfo.totalPages -1;
        var mySlot = currentPage - 1;
        var deltaPerSlot = SCROLL_DIMS.max-nl.pginfo.thumbHeight;
        var thumbTop = mySlot/numSlots*deltaPerSlot;
        if (thumbTop + nl.pginfo.thumbHeight > 100) thumbTop = 100 - nl.pginfo.thumbHeight;
        nl.pginfo.thumbTop = thumbTop;
    };
    
    function updateThumbHeight() {
        var thumbHeight = SCROLL_DIMS.max/nl.pginfo.totalPages;
        if (thumbHeight < SCROLL_DIMS.min) thumbHeight = SCROLL_DIMS.min;
        nl.pginfo.thumbHeight = thumbHeight;
    };
}];

function _getAnimation(oldPage, newPage, bAnimation) {
    if (!bAnimation || oldPage === newPage) return 'nl-anim-pg-same';
    if (oldPage > newPage) return 'nl-anim-pg-up';
    return 'nl-anim-pg-down';
}


//-------------------------------------------------------------------------------------------------
var ScrollbarDirective = ['nl', 'nlScrollbarSrv', 'nlKeyboardHandler',
function(nl, nlScrollbarSrv, nlKeyboardHandler) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'lib_ui/scroll/scrollbar.html',
        scope: {
          pgInfo: '='
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
                nlScrollbarSrv.gotoPage(nl.pginfo.currentPage-1, true);
            };
            
            $scope.scrollDown = function($event) {
                nlScrollbarSrv.gotoPage(nl.pginfo.currentPage+1, true);
            };
            
            nlKeyboardHandler.setKeyHandler(function ($event) {
                nl.log.debug('TODO: scroller.onKeyDown: ', $event.keyCode, $event.ctrlKey, $event.altKey, $event.shiftKey);
                nl.log.info('TODO: scroller.onKeyDown: ', $event.keyCode, $event.ctrlKey, $event.altKey, $event.shiftKey);
                nl.log.warn('TODO: scroller.onKeyDown: ', $event.keyCode, $event.ctrlKey, $event.altKey, $event.shiftKey);
                nl.log.error('TODO: scroller.onKeyDown: ', $event.keyCode, $event.ctrlKey, $event.altKey, $event.shiftKey);
                if (nlKeyboardHandler.UP($event) || nlKeyboardHandler.PAGEUP($event)) {
                    nlScrollbarSrv.gotoPage(nl.pginfo.currentPage-1);
                } else if (nlKeyboardHandler.DOWN($event) || nlKeyboardHandler.PAGEDOWN($event)) {
                    nlScrollbarSrv.gotoPage(nl.pginfo.currentPage+1);
                } else if (nlKeyboardHandler.HOME($event)) {
                    nlScrollbarSrv.gotoPage(1, true);
                } else if (nlKeyboardHandler.END($event)) {
                    nlScrollbarSrv.gotoPage(nl.pginfo.totalPages, true);
                }
            });

            nlKeyboardHandler.setSwipeHandler(function ($event) {
                if ($event.gesture.direction === 'up') {
                    nlScrollbarSrv.gotoPage(nl.pginfo.currentPage+1, true);
                } else if ($event.gesture.direction === 'down') {
                    nlScrollbarSrv.gotoPage(nl.pginfo.currentPage-1, true);
                }
                nl.log.debug('TODO: scroller.swipeHandler: ', $event);
            });
            
            var scrollOngoing = false;
            var pxDeltaPerPage = 0;
            $scope.scrollingPageNo = 1;

            $scope.onTouch = function($event) {
                $scope.scrollingPageNo = nl.pginfo.currentPage;
                scrollHint.css({display: 'block'});
                
                var pxMaxDelta = scrollArea[0].offsetHeight - scrollThumb[0].offsetHeight;
                pxDeltaPerPage = pxMaxDelta/nl.pginfo.totalPages;
                nl.log.debug(pxMaxDelta, pxDeltaPerPage);
            };
            
            $scope.onScroll = function($event) {
                scrollOngoing = true;
                var deltaPages = Math.round($event.gesture.deltaY/pxDeltaPerPage);

                var pageNo = nl.pginfo.currentPage + deltaPages;
                nl.log.debug($event.gesture.deltaY, pxDeltaPerPage, deltaPages, nl.pginfo.currentPage, pageNo);
                if (pageNo > nl.pginfo.totalPages) pageNo = nl.pginfo.totalPages;
                if (pageNo < 1) pageNo = 1;
                $scope.scrollingPageNo = pageNo;
                nlScrollbarSrv.updateThumbTop($scope.scrollingPageNo);
            };
            
            $scope.onRelease = function($event) {
                scrollHint.css({display: 'none'});
                if (!scrollOngoing) return;
                scrollOngoing = false;
                nlScrollbarSrv.gotoPage($scope.scrollingPageNo, true);
            };
            
        }
    };
}];

//-------------------------------------------------------------------------------------------------
var RetainArDirective = ['nl', '$window',
function(nl, $window) {
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

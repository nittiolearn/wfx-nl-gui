(function() {

//-------------------------------------------------------------------------------------------------
// keyboard.js:
// Implements keyboard handlers
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.keyboard', [])
    .service('nlKeyboardHandler', KeyboardHandler);
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
        if ($event) $event.stopImmediatePropagation();
    };

    this.onSwipe = function($event) {
        if (swipeHandler) swipeHandler($event);
        if ($event) $event.stopImmediatePropagation();
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

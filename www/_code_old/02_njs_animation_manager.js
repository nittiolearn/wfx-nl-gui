njs_animate = function() {

var _animationManager = null;
function getAnimationManager() {
    if (!_animationManager) _animationManager = new AnimationManager();
    return _animationManager;
}

function AnimationManager() {
	var self =this;
	
	this.hidePage = function(page) {
		_hide(page.hPageHolder);
	};
	
	this.setupAnimation = function(page) {
		_hide(page.hPageHolder);
		self.clearAnimations();
		var notFoundSections = _hideEachSection(page);
		_show(page.hPageHolder);
		_initAnimQueue(page, notFoundSections);
		_addNotFoundItemsToAnimQueue(notFoundSections);
		_processAnimationQueue(page);
	};

	this.clearAnimations = function() {
		if (_currentAnimObjs) {
			for (var key in _currentAnimObjs) {
				_hide(_currentAnimObjs[key]);
			}
		}
		_currentAnimObjs = {};
		_htmlObjsToAnimate = {};
		_animQueue = [];
	};

	function _hideEachSection(page) {
		var allSections = {};
		for (var i=0; i<page.sections.length; i++) {
			var pos = page.sectionCreateOrder[i];
			_htmlObjsToAnimate[pos] = page.sections[pos].pgSecView;
			allSections[pos] = true;
			_hide(_htmlObjsToAnimate[pos]);
		}
		return allSections;
	}
	
	function _initAnimQueue(page, notFoundSections) {
		var nSections = page.sections.length;
		var anims = page.getPageAnimations();
		_animQueue = [];
		for(var i=0; i<anims.length; i++) {
			_animQueue.push([]);
			for(var j=0; j<anims[i].length; j++) {
				var pos = parseInt(anims[i][j].id||0);
				if (pos < 0 || pos >= nSections) continue;
				_animQueue[i].push(anims[i][j]);
				delete notFoundSections[pos];
			}
		}
	}
	
	function _addNotFoundItemsToAnimQueue(notFoundSections) {
		var pending = Object.keys(notFoundSections);
		if (pending.length == 0) return;
		_animQueue.unshift([]);
		var queueTop = _animQueue[0];
		for(var i=0; i<pending.length; i++) {
			queueTop.push({id: ''+pending[i]});
		}
	}

	var _animQueue = [];
	var _htmlObjsToAnimate = {};
	var _currentAnimObjs = {};
	
	function _processAnimationQueue(page) {
		if (_animQueue.length == 0) return;
		if (Object.keys(_currentAnimObjs).length > 0) return;
		
		var animItems = _animQueue.shift();
		for(var i=0; i<animItems.length; i++) {
			_startAnimation(animItems[i], page);
		}
	}

	function _startAnimation(animItem, page) {
		var	props = _effects[animItem.effect || 'appear']();
		var opts = {};
		opts.easing = animItem.easing || 'easeOutQuad';
		opts.duration = animItem.duration || 500;
		
		opts.complete = function() {
			delete _currentAnimObjs[animItem.id];
			_processAnimationQueue();
		};

		var hObj = _htmlObjsToAnimate[animItem.id];
		_currentAnimObjs[animItem.id] = hObj;
		hObj.velocity('finish').velocity(props, opts);
	}

	function _hide(hobj) {
		_animateNow(hobj, 'hide');
	};
	
	function _show(hobj) {
		_animateNow(hobj, 'show');
	};

	function _animateNow(hobj, effect) {
		var	props = _effects[effect]();
        var opts = {duration: 0, delay: 0, easing:'easeOutQuad'};
		hobj.velocity('finish').velocity(props, opts);
	}
};

var ZINDEX_HIDE = -100;
var ZINDEX_SHOW = 0;

var _effects = {

	'hide': function() {
	return {opacity: 0, 'z-index': ZINDEX_HIDE};},
	
	'show': function() {
	return {opacity: 1, 'z-index': ZINDEX_SHOW};},
	
	'appear': function() {
	return {translateX: [0, 0], translateY: [0, 0], rotateY: [0, 0], skewY: [0, 0], opacity: [1, 0], 'z-index': [ZINDEX_SHOW, ZINDEX_SHOW]};},
	
	'linear': function() {
	return {translateX: [0, '-200%'], translateY: [0, 0], rotateY: [0, 360], skewY: [0, 45], opacity: [1, 0], 'z-index': [ZINDEX_SHOW, ZINDEX_SHOW]};},

	'linearReverse': function() {
	return {translateX: [0, '200%'], translateY: [0, 0], rotateY: [0, 360], skewY: [0, 45], opacity: [1, 0], 'z-index': [ZINDEX_SHOW, ZINDEX_SHOW]};},

	'cubic': function() {
	return {translateX: [0, '-200%'], translateY: [0, 0], rotateY: [0, 90], skewY: [0, 90], opacity: [1, 0], 'z-index': ZINDEX_SHOW};},
	
	'fade': function() {
	return {translateX: [0, 0], translateY: [0, 0], rotateY: [0, 0], skewY: [0, 0], opacity: [1, 0], 'z-index': ZINDEX_SHOW};},
	
	'dropdown': function() {
	return {translateX: [0, 0], translateY: [0, '-200%'], rotateY: [0, 0], skewY: [0, 0], opacity: [1, 0], 'z-index': ZINDEX_SHOW};}

};

return { 
	getAnimationManager: getAnimationManager
};}();
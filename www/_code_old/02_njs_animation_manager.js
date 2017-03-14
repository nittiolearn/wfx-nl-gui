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
		_secPosToLines = {};
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
				var section = page.sections[pos];
				var lines = _getSectionLines(section.pgSecView);
				if (anims[i][j].level == 'content' && lines.length !== 0) {
					_hideSectionLines(page, pos);						
				} else {
					delete notFoundSections[pos];
				}
			}
		}
	}
	
	function _getSectionLines(pgSecView) {
		return jQuery(pgSecView).find('.njsFlexList');
	}
	
	function _hideSectionLines(page, pos) {
		var section = page.sections[pos];
		var lines = _getSectionLines(section.pgSecView);
		var lines2 = [];
		for (var i=0; i<lines.length; i++) {
			var lineObj = jQuery(lines[i]);
			lines2.push(lineObj);
			_hide(lineObj);
		}
		_secPosToLines[pos] = lines2;
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
	var _secPosToLines = {};
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
		var hObjs = [];
		if (animItem.level == 'content' && _secPosToLines[animItem.id]) {
			var pos = parseInt(animItem.id||0);
			hObjs = _secPosToLines[pos];
		} else {
			hObjs.push(_htmlObjsToAnimate[animItem.id]);
		}
		_animatenOfSectionLine(animItem, page, hObjs, 0);
	}

	function _animatenOfSectionLine(animItem, page, hObjs, pos) {
		var objId = njs_helper.fmt2('{}.{}', animItem.id, pos);
		var	props = _effects[animItem.effect || 'appear']();
		var opts = {};
		opts.easing = animItem.easing || 'easeOutQuad';
		opts.duration = animItem.duration || 500;

		opts.complete = function() {
			delete _currentAnimObjs[objId];
			if (pos < hObjs.length-1) {
				_animatenOfSectionLine(animItem, page, hObjs, pos+1);
			} else {
				_processAnimationQueue(page);
			}
		};
		var hObj = hObjs[pos];
		_currentAnimObjs[objId] = hObj;
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

	'linearreverse': function() {
	return {translateX: [0, '200%'], translateY: [0, 0], rotateY: [0, 360], skewY: [0, 45], opacity: [1, 0], 'z-index': [ZINDEX_SHOW, ZINDEX_SHOW]};},

	'flowright': function(){
	return {translateX: [0, '-200%'], translateY: [0, 0], rotateY: [0, 0], skewY: [0, 0], opacity: [1, 0], 'z-index': [ZINDEX_SHOW, ZINDEX_SHOW]};},

	'flydiagonal': function(){
	return {translateX: [0, '-200%'], translateY: [0, '-500%'], rotateY: [0, 0], skewY: [0, 0], opacity: [1, 0], 'z-index': [ZINDEX_SHOW, ZINDEX_SHOW]};},

	'flowleft': function() {
	return {translateX: [0, '200%'], translateY: [0, 0], rotateY: [0, 0], skewY: [0, 0], opacity: [1, 0], 'z-index': [ZINDEX_SHOW, ZINDEX_SHOW]};},
	
	'cubic': function() {
	return {translateX: [0, '-200%'], translateY: [0, 0], rotateY: [0, 90], skewY: [0, 90], opacity: [1, 0], 'z-index': ZINDEX_SHOW};},
	
	'fade': function() {
	return {translateX: [0, 0], translateY: [0, 0], rotateY: [0, 0], skewY: [0, 0], opacity: [1, 0], 'z-index': ZINDEX_SHOW};},
	
	'dropdown': function() {
	return {translateX: [0, 0], translateY: [0, '-200%'], rotateY: [0, 0], skewY: [0, 0], opacity: [1, 0], 'z-index': ZINDEX_SHOW, backgroundColor:'#ff0000'};},

	'flyup': function() {
	return {translateX: [0, 0], translateY: [0, '200%'], rotateY: [0, 0], skewY: [0, 0], opacity: [1, 0], 'z-index': ZINDEX_SHOW};}

};

return { 
	getAnimationManager: getAnimationManager
};}();
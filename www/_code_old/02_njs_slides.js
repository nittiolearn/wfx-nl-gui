/**
 * Basic nittioslides js utilities
 * -------------------------------
 **/
njs_slides = function() {
	
	var activeSlideSet = null;
	
	function getActive() {
		return activeSlideSet;
	}
	
	var ZINDEX_HIDE = -100;
	var ZINDEX_SHOW = 0;
	var ANIM_DURATION = 600;

	//----------------------------------------------------------------------------------
	// SlideSet class
	//----------------------------------------------------------------------------------
	function SlideSet(slideSetDom, pageNo, navLeft, navRight) {
		// Public Methods
		this.reinit = SlideSet_reinit;
		this.activate = SlideSet_activate;
		this.deactivate = SlideSet_deactivate;
		this.prev = SlideSet_prev;
		this.next = SlideSet_next;
		this.gotoPage = SlideSet_gotoPage;
		this.gotoPagePost = SlideSet_gotoPagePost;
		this.mediaStop = SlideSet_mediaStop;
		this.mediaAutoPlay = SlideSet_mediaAutoPlay;
		this.getPageCount = SlideSet_getPageCount;
		this.getCurPageNo = SlideSet_getCurPageNo;
		this.onSlideChange = SlideSet_onSlideChange;
		
		// Actual constructor initialization
		SlideSet_oneTimeInit();
		SlideSet_init(this, slideSetDom, pageNo, navLeft, navRight);
	}

	//----------------------------------------------------------------------------------
	// SlideSet Private Methods		
	//----------------------------------------------------------------------------------
	var oneTimeInitDone = false;
	function SlideSet_oneTimeInit() {
		if (oneTimeInitDone) return;
		oneTimeInitDone = true;

		window.addEventListener('hashchange', function(event) {
			getActive().activate(window.location.hash);
		}, false);

		// Setup keboard handlers
		jQuery(document).keydown(function(e) {
			if (activeSlideSet == null) return;
			
			var ae = document.activeElement;
			var ignore = ae && (ae.type || ae.href || ae.contentEditable !== 'inherit');
			ignore = ignore || (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey);
			if (ignore) return;
			
			if (e.which == 37) { // Left arrow
				activeSlideSet.prev();
			} else if (e.which == 39) { // Right arrow
				activeSlideSet.next();
			} else if (e.which == 36) { // Home
				activeSlideSet.gotoPage(0);
			} else if (e.which == 35) { // End
				activeSlideSet.gotoPage(activeSlideSet.pages.length-1);
			}
		});
	}

	function SlideSet_init(me, slideSetDom, pageNo, navLeft, navRight) {
		me.slideChangeHandlers = [];
		me.slideSetDom = slideSetDom; 
		me.pageNo = pageNo; 
		me.navLeft = navLeft;
		me.navRight = navRight;
		me.pages = [];
		me.curPage = 0;
		me.pageTransition = new PageTransition(me, 'default');

        if (me.pageNo) me.pageNo.show();
        if (me.navLeft) {
            me.navLeft.click(function() { me.prev(); });
            me.navLeft.show();
        }
        if (me.navRight) {
    		me.navRight.click(function() { me.next(); });
            me.navRight.show();
        }
		me.reinit();
	}
	
	function SlideSet_hidePage(page) {
	    var props = {translateX: [-10000, 0], opacity: 0, 'z-index': ZINDEX_HIDE};
        page.velocity('stop', true).velocity(props, 0);
	}

	//----------------------------------------------------------------------------------
	// SlideSet Public Methods		
	//----------------------------------------------------------------------------------
	function SlideSet_reinit() {
		var me = this;
		me.pages = [];
		me.pageIdToPageNo = {};
		me.slideSetDom.find('section').each(function() {
			var pageDom = jQuery(this);
			me.pages.push(pageDom);
			var pageNo = me.pages.length - 1;
			var pageId = pageDom.attr('id');
			if (pageId !== undefined && pageId !== null && pageId !== '') {
				me.pageIdToPageNo[pageId] = pageNo;
			}
			SlideSet_hidePage(me.pages[pageNo]);
		});
	}

	function SlideSet_activate(urlHash) {
		if (activeSlideSet != null) activeSlideSet.deactivate();
		activeSlideSet = this;
		var p = SlideSet_getPageNumberFromUrl(this, urlHash, this.curPage);
		this.gotoPage(p);
	}

	function SlideSet_getPageNumberFromUrl(me, urlHash, defPageNo) {
		if (urlHash === undefined || urlHash === null) return defPageNo;
		var pageId = urlHash.replace( /#|\//gi, '' );
		var pageNo = parseInt(pageId);
		if (!isNaN(pageNo)) return (pageNo-1);
		if (pageId in me.pageIdToPageNo) return me.pageIdToPageNo[pageId];
		return defPageNo;
	}

	function SlideSet_deactivate() {
		SlideSet_hidePage(this.pages[this.curPage]);
		activeSlideSet = null;
	}

	function SlideSet_prev() {
		this.gotoPage(this.curPage-1);
	}

	function SlideSet_next() {
		this.gotoPage(this.curPage+1);
	}

	// samePageAnimation: -1: page comes from left; 0: pages fades in; 1: page comes form right
	// 					  default is 0
	function SlideSet_gotoPage(p, samePageAnimation) {
		if (p < 0 || p >= this.pages.length) return;

		if (this.curPage >= this.pages.length) this.curPage = this.pages.length-1;

		var oldPage = this.pages[this.curPage];
		var newPage = this.pages[p];

		this.mediaStop();
		
		var me = this;
		var postAnimationFn = function() {
		    me.gotoPagePost();
		};
		
		if (p == this.curPage) {
			if (samePageAnimation !== 1 && samePageAnimation !== -1) samePageAnimation = 0;
			this.pageTransition.showPage(newPage, samePageAnimation, postAnimationFn);
		} else if (this.curPage < p) {
			this.pageTransition.moveNext(oldPage, newPage, postAnimationFn);
		} else {
			this.pageTransition.movePrev(oldPage, newPage, postAnimationFn);
		}
		this.curPage = p;
	}
	
	function SlideSet_gotoPagePost() {
	    var inactiveButtonCls = 'nl-nav-inactive';
		if (this.pageNo) this.pageNo.html(this.curPage+1);
		if (this.navLeft) {
			if (this.curPage == 0) {
				this.navLeft.addClass(inactiveButtonCls);
                this.navLeft.attr('title', 'No more items');
			} else {
                this.navLeft.removeClass(inactiveButtonCls);
                this.navLeft.attr('title', 'Previous');
			}
		}
		if (this.navRight) {
			if (this.curPage == this.pages.length - 1) {
                this.navRight.addClass(inactiveButtonCls);
                this.navRight.attr('title', 'No more items');
			} else {
                this.navRight.removeClass(inactiveButtonCls);
                this.navRight.attr('title', 'Next');
			}
		}

		for(var i in this.slideChangeHandlers) {
			this.slideChangeHandlers[i](this);
		}
		this.mediaAutoPlay();
	}

	function SlideSet_mediaStop() {
		var page = this.pages[this.curPage];
		page.find('video, audio').each(function() {
		    this.pause();
		});
		page.find('iframe[data-njsYouTube]').each(function() {
		    var iframe = jQuery(this)[0].contentWindow;
		    iframe.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
		});
	}
	
	function SlideSet_mediaAutoPlay(domElem) {
		var page = this.pages[this.curPage];
		page.find('video[data-njsAutoPlay], audio[data-njsAutoPlay]').each(function() {
			this.play();
		});
	}

	function SlideSet_getPageCount() {
		return this.pages.length;
	}
	
	function SlideSet_getCurPageNo() {
		return this.curPage;
	}
	
	function SlideSet_onSlideChange(handler) {
		this.slideChangeHandlers.push(handler);
	}
	
	//----------------------------------------------------------------------------------
	// PageTransition class
	//----------------------------------------------------------------------------------
	function PageTransition(slideSet, effect) {
		// Public Methods
		this.showPage = PageTransition_showPage;
		this.moveNext = PageTransition_moveNext;
		this.movePrev = PageTransition_movePrev;
		
		// Private Methods
		this.transitionPages = PageTransition_transitionPages;

		// Constructor
		this.slideSet = slideSet;
		this.effect = (effect in _effects) ? effect : 'default';
	}

	function PageTransition_showPage(newPage, samePageAnimation, postAnimationFn) {
		var props = _effects[this.effect](this);

		var velProps = {translateX: [0, 0], opacity: [1, 0], 'z-index': ZINDEX_SHOW};
		if (samePageAnimation == -1) {
			velProps = props.new_prev;
		} else if (samePageAnimation == 1) {
			velProps = props.new_next;
		}

		this.transitionPages(null, newPage, null, velProps, postAnimationFn);
	}

	function PageTransition_moveNext(oldPage, newPage, postAnimationFn) {
		var props = _effects[this.effect](this);
		this.transitionPages(oldPage, newPage, props.old_next, props.new_next, postAnimationFn);
	}

	function PageTransition_movePrev(oldPage, newPage, postAnimationFn) {
		var props = _effects[this.effect](this);
		this.transitionPages(oldPage, newPage, props.old_prev, props.new_prev, postAnimationFn);
	}

    var g_transitionId=0;
	function PageTransition_transitionPages(oldPage, newPage, oldProps, newProps, postAnimationFn) {
	    g_transitionId++;
	    var myTransitionId = g_transitionId;
	    function postAnim() {
	        if (myTransitionId != g_transitionId) return;
	        postAnimationFn();
	    }
	    
		if (oldPage != null) {
            var opts = {duration: ANIM_DURATION, easing: 'easeOutQuad'};
			oldPage.velocity('finish').velocity(oldProps, opts);
		}
        var opts2 = {duration: ANIM_DURATION, easing: 'easeOutQuad', complete: postAnim};
		newPage.velocity('finish').velocity(newProps, opts2);
	}
	
	//----------------------------------------------------------------------------------
	// Different supported transitions
	//----------------------------------------------------------------------------------
	var _effects = {
	
	'default': function(ptObj) {
	var w = ptObj.slideSet.slideSetDom.width();
	var h = ptObj.slideSet.slideSetDom.height();
	return {
	old_next: {translateX: [-2*w, 0], opacity: [0, 1], 'z-index': ZINDEX_HIDE},
	new_next: {translateX: [0, 2*w], opacity: [1, 0], 'z-index': ZINDEX_SHOW},
	old_prev: {translateX: [2*w, 0], opacity: [0, 1], 'z-index': ZINDEX_HIDE},
	new_prev: {translateX: [0, -2*w], opacity: [1, 0], 'z-index': ZINDEX_SHOW}
	};},

	'linear': function(ptObj) {
	var w = ptObj.slideSet.slideSetDom.width();
	var h = ptObj.slideSet.slideSetDom.height();
	return {
	old_next: {translateX: [-2*w, 0], translateY: [0, 0], rotateY: [0, 0], skewY: [0, 0], opacity: [0, 1], 'z-index': ZINDEX_HIDE},
	new_next: {translateX: [0, 2*w], translateY: [0, 0], rotateY: [0, 0], skewY: [0, 0], opacity: [1, 0], 'z-index': ZINDEX_SHOW},
	old_prev: {translateX: [2*w, 0], translateY: [0, 0], rotateY: [0, 0], skewY: [0, 0], opacity: [0, 1], 'z-index': ZINDEX_HIDE},
	new_prev: {translateX: [0, -2*w], translateY: [0, 0], rotateY: [0, 0], skewY: [0, 0], opacity: [1, 0], 'z-index': ZINDEX_SHOW}
	};},

	'cubic': function(ptObj) {
	var w = ptObj.slideSet.slideSetDom.width();
	var h = ptObj.slideSet.slideSetDom.height();
	return {
	old_next: {translateX: [-2*w, 0], translateY: [-h, 0], rotateY: [90, 0], skewY: [90, 0], opacity: [0, 1], 'z-index': ZINDEX_HIDE},
	new_next: {translateX: [0, 2*w], translateY: [0, -h], rotateY: [0, -90], skewY: [0, -90], opacity: [1, 0], 'z-index': ZINDEX_SHOW},
	old_prev: {translateX: [2*w, 0], translateY: [-h, 0], rotateY: [-90, 0], skewY: [-90, 0], opacity: [0, 1], 'z-index': ZINDEX_HIDE},
	new_prev: {translateX: [0, -2*w], translateY: [0, -h], rotateY: [0, 90], skewY: [0, 90], opacity: [1, 0], 'z-index': ZINDEX_SHOW}
	};},
	
	'fade': function(ptObj) {
	var w = ptObj.slideSet.slideSetDom.width();
	var h = ptObj.slideSet.slideSetDom.height();
	return {
	old_next: {translateX: [0, 0], translateY: [0, 0], rotateY: [0, 0], skewY: [0, 0], opacity: [0, 1], 'z-index': ZINDEX_HIDE},
	new_next: {translateX: [0, 0], translateY: [0, 0], rotateY: [0, 0], skewY: [0, 0], opacity: [1, 0], 'z-index': ZINDEX_SHOW},
	old_prev: {translateX: [0, 0], translateY: [0, 0], rotateY: [0, 0], skewY: [0, 0], opacity: [0, 1], 'z-index': ZINDEX_HIDE},
	new_prev: {translateX: [0, 0], translateY: [0, 0], rotateY: [0, 0], skewY: [0, 0], opacity: [1, 0], 'z-index': ZINDEX_SHOW}
	};}
	
	};
	
	return {
		SlideSet: SlideSet,
		getActive: getActive
	};
}();

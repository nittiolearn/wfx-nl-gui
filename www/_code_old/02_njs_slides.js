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
		this.showHideNavBar = SlideSet_showHideNavBar;
		this.activate = SlideSet_activate;
		this.deactivate = SlideSet_deactivate;
		this.prev = SlideSet_prev;
		this.next = SlideSet_next;
		this.gotoPage = SlideSet_gotoPage;
		this.gotoPagePre = SlideSet_gotoPagePre;
		this.gotoPagePost = SlideSet_gotoPagePost;
		this.mediaStop = SlideSet_mediaStop;
		this.mediaAutoPlay = SlideSet_mediaAutoPlay;
		this.getPageCount = SlideSet_getPageCount;
		this.getCurPageNo = SlideSet_getCurPageNo;
		this.onSlideBeforeChange = SlideSet_onSlideBeforeChange;
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
			if (window.nlapp.nlDlg.isDlgOpen()) return;
			
			var ae = document.activeElement;
			var ignore = ae && (ae.type || ae.href || ae.contentEditable !== 'inherit');
			ignore = ignore || (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey);
			if (ignore) return;
			
			if (e.which == 37) { // Left arrow
				activeSlideSet.prev();
			} else if (e.which == 39) { // Right arrow
				activeSlideSet.next();
			} else if (e.which == 36 && activeSlideSet.curPage != 0) { // Home
				activeSlideSet.gotoPage(0);
			} else if (e.which == 35 && activeSlideSet.curPage != activeSlideSet.pages.length-1) { // End
				activeSlideSet.gotoPage(activeSlideSet.pages.length-1);
			}
		});

		// Setup swipe event handlers and Zoom event handler
		window.nlapp.nl.rootScope.onSwipeLeft = function(event) {
			if (_zoomer.isZoomed()) return;
			activeSlideSet.next();
		};
		window.nlapp.nl.rootScope.onSwipeRight = function(event) {
			if (_zoomer.isZoomed()) return;
			activeSlideSet.prev();
		};
	}

	function SlideSet_init(me, slideSetDom, pageNo, navLeft, navRight) {
		me.slideChangeHandlers = [];
		me.slidePreChangeHandlers = [];
		me.slideSetDom = slideSetDom; 
		me.pageNo = pageNo; 
		me.navLeft = navLeft;
		me.navRight = navRight;
		me.pages = [];
		me.curPage = 0;
		me.pageTransition = new PageTransition(me, 'default');
		me.reinit();
	}
	
	function SlideSet_hidePage(page) {
	    var props = {translateX: [-10000, 0], opacity: 0, 'z-index': ZINDEX_HIDE};
        page.velocity('finish', true).velocity(props, 0);
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
		me.showHideNavBar();
	}

    function SlideSet_showHideNavBar() {
        var me = this;
        if (me.getPageCount() <= 1) {
            if (me.pageNo) me.pageNo.hide();
            if (me.navLeft) me.navLeft.hide();
            if (me.navRight) me.navRight.hide();
            return;
        }

        var inactiveButtonCls = 'nl-nav-inactive';
        if (me.pageNo) {
            me.pageNo.html(this.curPage+1);
            me.pageNo.show();
        }
        if (me.navLeft) {
            me.navLeft.off('click');
            me.navLeft.on('click', function() { me.prev(); });
            me.navLeft.show();
            if (me.curPage == 0) {
                me.navLeft.addClass(inactiveButtonCls);
                me.navLeft.attr('title', 'No more items');
            } else {
                me.navLeft.removeClass(inactiveButtonCls);
                me.navLeft.attr('title', 'Previous');
            }
        }
        if (me.navRight) {
            me.navRight.off('click');
            me.navRight.on('click', function() { me.next(); });
            me.navRight.show();
            if (me.curPage == me.pages.length - 1) {
                me.navRight.addClass(inactiveButtonCls);
                me.navRight.attr('title', 'No more items');
            } else {
                me.navRight.removeClass(inactiveButtonCls);
                me.navRight.attr('title', 'Next');
            }
        }
    }

	function SlideSet_activate(urlHash, bDontGoToPage) {
		activeSlideSet = this;
		var p = SlideSet_getPageNumberFromUrl(this, urlHash, this.curPage);
		if (!bDontGoToPage) this.gotoPage(p, {noPagePreCheck:true});
		else this.showHideNavBar();
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

	function SlideSet_prev(userOptions) {
		this.gotoPage(this.curPage-1, userOptions);
	}

	function SlideSet_next(userOptions) {
		this.gotoPage(this.curPage+1, userOptions);
	}

	// samePageAnimation: -1: page comes from left; 0: pages fades in; 1: page comes form right
	function SlideSet_gotoPage(p, userOptions) {
		if (!userOptions) userOptions = {};
		if (userOptions.samePageAnimation ===undefined) userOptions.samePageAnimation = 0;
		if (userOptions.noPagePreCheck ===undefined) userOptions.noPagePreCheck = false;
		if (userOptions.preventTransitionAnimation === undefined) userOptions.preventTransitionAnimation = false;
		if (p < 0 || p >= this.pages.length) return;

		if (this.curPage >= this.pages.length) this.curPage = this.pages.length-1;

		var oldPage = this.pages[this.curPage];
		var newPage = this.pages[p];

		var me = this;
	    if (!userOptions.noPagePreCheck && !me.gotoPagePre(this.curPage, p)) return;
		var postAnimationFn = function() {
		    me.gotoPagePost();
		};
		
		if (p == this.curPage) {
			this.pageTransition.showPage(newPage, postAnimationFn, userOptions);
		} else if (this.curPage < p) {
			this.pageTransition.moveNext(oldPage, newPage, postAnimationFn, userOptions);
		} else {
			this.pageTransition.movePrev(oldPage, newPage, postAnimationFn, userOptions);
		}
		this.curPage = p;
	}
	
	function SlideSet_gotoPagePre(curPgNo, newPgNo) {
		for(var i in this.slidePreChangeHandlers) {
		    if (!this.slidePreChangeHandlers[i](curPgNo, newPgNo)) return false;
		}
		this.mediaStop();
		return true;
	}

	function SlideSet_gotoPagePost() {
		this.showHideNavBar();

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
	
	function SlideSet_onSlideBeforeChange(handler) {
		this.slidePreChangeHandlers.push(handler);
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

	function PageTransition_showPage(newPage, postAnimationFn, userOptions) {
		var props = _effects[this.effect](this);

		var velProps = {translateX: [0, 0], opacity: [1, 0], 'z-index': ZINDEX_SHOW};
		if (userOptions.samePageAnimation == -1) {
			velProps = props.new_prev;
		} else if (userOptions.samePageAnimation == 1) {
			velProps = props.new_next;
		}

		this.transitionPages(null, newPage, null, velProps, postAnimationFn, userOptions);
	}

	function PageTransition_moveNext(oldPage, newPage, postAnimationFn, userOptions) {
		var props = _effects[this.effect](this);
		this.transitionPages(oldPage, newPage, props.old_next, props.new_next, postAnimationFn, userOptions);
	}

	function PageTransition_movePrev(oldPage, newPage, postAnimationFn, userOptions) {
		var props = _effects[this.effect](this);
		this.transitionPages(oldPage, newPage, props.old_prev, props.new_prev, postAnimationFn, userOptions);
	}

    var g_transitionId=0;
	function PageTransition_transitionPages(oldPage, newPage, oldProps, newProps, postAnimationFn, userOptions) {
	    g_transitionId++;
	    var myTransitionId = g_transitionId;
	    function postAnim() {
	        if (myTransitionId != g_transitionId) return;
            newPage.css({transform: 'none'});
	        postAnimationFn();
	    }
	    if (userOptions.preventTransitionAnimation) {
			var props = _effects['fade'](this);
            var opts = {duration: 0, easing: 'linear'};
			oldPage.velocity('finish').velocity(props.old_prev, opts);
	        var opts2 = {duration: 0, easing: 'linear', complete: postAnim};
			newPage.velocity('finish').velocity(props.new_prev, opts2);
			return;
	    } else if (oldPage != null) {
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

	function Zoomer() {

		var _zoomChangeFn = null;
		this.onZoomChange = function(zoomChangeFn) {
			_zoomChangeFn = zoomChangeFn;
			window.nlapp.nl.rootScope.zoomer = this;
		};

		var _isZoomed = false;
		var _zoomLevel = 0;
		var _zoomVal = ["zoom-100", "zoom-125", "zoom-150", "zoom-200", "zoom-250", "zoom-300"];
		var _zoomPercs = ["100%", "125%", "150%", "200%", "250%", "300%"];
		var _allZoomClasses = _zoomVal.join(' ');

		this.isZoomed = function() {
			return _isZoomed;
		};

		this.zoomEnter = function() {
			jQuery(".toolBar").hide(200, 'swing');
			jQuery("#nl-zoombar").show(300, 'swing');
			jQuery(".body").addClass("nl-zoom-body");
			jQuery(".nl-topbar, #pageNoArea, #popupPageNoArea").addClass('hideOnZoom');
			_isZoomed = true;
			if (_zoomLevel == 0) _zoomLevel = 1;
			_setZoomLevel();
			if (_zoomChangeFn) _zoomChangeFn();
		};

		this.zoomExit = function() {
			_clearZoomLevel();
			jQuery("#nl-zoombar").hide();
			jQuery(".toolBar").show(300, 'swing');
			jQuery(".body").removeClass("nl-zoom-body");
			jQuery(".nl-topbar, #pageNoArea, #popupPageNoArea").removeClass('hideOnZoom');
			_isZoomed = false;
			if (_zoomChangeFn) _zoomChangeFn();
		};

		this.zoomIn = function() {
			if (_zoomLevel >= _zoomVal.length -1) return;
			_zoomLevel += 1;
			_setZoomLevel();
			if (_zoomChangeFn) _zoomChangeFn();
		};

		this.zoomOut = function() {
			if (_zoomLevel <= 0) return;
			_zoomLevel -= 1;
			_setZoomLevel();
			if (_zoomChangeFn) _zoomChangeFn();
		}

		function _setZoomLevel() {
			_clearZoomLevel();
			jQuery(".inner_body, #module_popup").addClass(_zoomVal[_zoomLevel]);
			jQuery("#zoomPerc").text(_zoomPercs[_zoomLevel]);
			if (_zoomLevel == _zoomVal.length -1) {
				jQuery("#zoomIn").addClass('fgrey');
			} else {
				jQuery("#zoomIn").removeClass('fgrey');
			}
			if (_zoomLevel == 0) {
				jQuery("#zoomOut").addClass('fgrey');
			} else {
				jQuery("#zoomOut").removeClass('fgrey');
			}
		}

		function _clearZoomLevel() {
			jQuery(".inner_body, #module_popup").removeClass(_allZoomClasses);
		}
	}

	var _zoomer = new Zoomer();
	function getZoomer() {
		return _zoomer;
	}

	return {
		SlideSet: SlideSet,
		getActive: getActive,
		getZoomer: getZoomer,
	};
}();

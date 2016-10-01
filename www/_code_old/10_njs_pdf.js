/**
 * Basic nittio pdf js utilities
 * -----------------------------
 **/
njs_pdf = function() {
	
//###########################################################################################
// Class Pdf - Models a PDF file - once file is loaded it gives you a callback. You can
// either get the PdfDoc object or the page count.
//###########################################################################################
function Pdf(url) {
	//---------------------------------------------------------------------------------------
	// Private data members - convention is to start the name with _
	// (All defined in init method)
	//---------------------------------------------------------------------------------------
	
	//---------------------------------------------------------------------------------------
	// Public Methods
	//---------------------------------------------------------------------------------------
	this.getPageCount = Pdf_getPageCount;
	this.getDocument = Pdf_getDocument;
	this.onLoadDone = Pdf_onLoadDone;

	//---------------------------------------------------------------------------------------
	// Constructor code
	//---------------------------------------------------------------------------------------
	_Pdf_init(this, url);
}

//-------------------------------------------------------------------------------------------
// Pdf Methods
//-------------------------------------------------------------------------------------------
var _bOneTimeInitDone = false;
function _Pdf_init(self, url) {
	self._url = url;
	self._pdfDoc = null;
	self._isLoadProgress = true;
	self._errorInfo = {issuccess: true, msg: null, exception: null};
	self._onLoadDoneFns = [];
	
	if (!_bOneTimeInitDone) {
		_bOneTimeInitDone = true;
	    // Disable workers to avoid yet another cross-origin issue (workers need the URL of
	    // the script to be loaded, and currently do not allow cross-origin scripts)
	    PDFJS.disableWorker = true;
	}
	
	 // Asynchronously downloads PDF.
	PDFJS.getDocument(self._url).then(function(pdfDoc) {
		self._isLoadProgress = false;
		self._pdfDoc = pdfDoc;
		_Pdf_callOnLoadDone(self);
	}, function(errorMsg, exception) {
		self._isLoadProgress = false;
		self._errorInfo = {issuccess: false, msg: errorMsg, exception: exception};
		_Pdf_callOnLoadDone(self);
	});
}
	
function _Pdf_callOnLoadDone(self) {
	for (var i=0; i<self._onLoadDoneFns.length; i++) {
		self._onLoadDoneFns[i](self._errorInfo.issuccess, self._errorInfo.msg, self._errorInfo.exception);
	}
	self._onLoadDoneFns = [];
}

function Pdf_onLoadDone(onLoadDoneFn) {
	this._onLoadDoneFns.push(onLoadDoneFn);
	if (this._isLoadProgress) return;
	_Pdf_callOnLoadDone(this);
}
	
function Pdf_getPageCount() {
	return this._pdfDoc.numPages;
}

function Pdf_getDocument() {
	return this._pdfDoc;
}

//-------------------------------------------------------------------------------------------
// Pdf Static Methods
//-------------------------------------------------------------------------------------------
var _pdfObjects = {};
Pdf.get = function(url) {
	if (url in _pdfObjects) return _pdfObjects[url];
	var pdfObject = new Pdf(url);
	_pdfObjects[url] = pdfObject;
	return pdfObject;
};

//###########################################################################################
// Class RenderQueue - all pdf elements to be rendered in one section are placed in one queue
//###########################################################################################
function RenderQueue(container, onRenderDoneFn) {
	//---------------------------------------------------------------------------------------
	// Private data members - convention is to start the name with _
	//---------------------------------------------------------------------------------------
	this._queue = [];
	this._pendingRenders = [];
	this._renderedPages = {};
	this._renderOngoing = false;
	this._lastPageNo = 0;
	this._container = container;
	this._isInline = false;
	
	//---------------------------------------------------------------------------------------
	// Public Methods
	//---------------------------------------------------------------------------------------
	this.clear = RenderQueue_clear;

	//---------------------------------------------------------------------------------------
	// Constructor code
	//---------------------------------------------------------------------------------------
	_RenderQueue_init(this, container, onRenderDoneFn);
}

RenderQueue._pagesPerScroll = 3;
RenderQueue._pagesToKeep = 10;

//-------------------------------------------------------------------------------------------
// RenderQueue Methods
//-------------------------------------------------------------------------------------------
function _RenderQueue_init(self, container, onRenderDoneFn) {
	self._onRenderDoneFn = onRenderDoneFn;
	self._heightEstimateDone = false;
	container.find('.njs_pdf_holder').each(function() {
		self._isInline = jQuery(this).hasClass('inline_obj');
		var renderer = new PageRenderer(container, jQuery(this), self._isInline,
		function() { // onRenderDoneFn
			_RenderQueue_onRenderDone(self);
            if (self._onRenderDoneFn) self._onRenderDoneFn();
		},
		function(height) { // onHeightEstimateFn
			_RenderQueue_onHeightEstimate(self, height);
		});
		self._queue.push(renderer);
	});
	
	if (self._queue.length <= 0) return;
	container.off('scroll.njs_pdf_event');
	container.on('scroll.njs_pdf_event', nittio.debounce(200, function(event) {
        _RenderQueue_onscroll(self);
	}));
	_RenderQueue_renderAroundPage(self);
    window.setTimeout(function() {
        _RenderQueue_onscroll(self);
    }, 0);
}

function RenderQueue_clear() {
	var self = this;
	for(var i=0; i < self._queue.length; i++) {
		self._queue[i].clear();
	}
	self._pendingRenders = [];
	self._renderedPages = {};
}

function _RenderQueue_onscroll(self) {
	/* 
	 * onscroll: aifferent algorithms on finding the current element visible was
	 * of each element was done but failed. The current one is the best available.
	 * 
	 */
	var scrollTop = self._container.scrollTop();
	var totalHeight = self._container[0].scrollHeight;
	var containerHeight = self._container.height();
	var scrollMid = scrollTop + Math.floor(containerHeight/2);
	var pageNo = Math.floor(scrollMid / totalHeight * self._queue.length);
	self._lastPageNo = _RenderQueue_findVisiblElementNearby(self, pageNo, containerHeight);
	_RenderQueue_renderAroundPage(self);
}

var errorMargin = 10;
function _RenderQueue_findVisiblElementNearby(self, pageNo, containerHeight) {
    var low = 0 - errorMargin;
    var high = containerHeight + errorMargin;
    var pos = _RenderQueue_getElemPos(self, pageNo, low, high);
    if (pos == 0) return pageNo;
    if (pos > 0) {
        var i=pageNo-1;
        while(i > 0) {
            var pos = _RenderQueue_getElemPos(self, i, low, high);
            if (pos <= 0) return i; // <0 is overshot condition (no page in visible range)
            i--;
        }
        return i;
    }
    var i=pageNo+1;
    while(i < self._queue.length-1) {
        var pos = _RenderQueue_getElemPos(self, i, low, high);
        if (pos >= 0) return i; // >0 is overshot condition (no page in visible range)
        i++;
    }
    return i;
}

function _RenderQueue_getElemPos(self, pageNo, low, high) {
    var pageRenderer = self._queue[pageNo];
    var top = pageRenderer._holder.position().top;
    if (top < low) return -1;
    if (top > high) return 1;
    return 0;
}

function _RenderQueue_renderAroundPage(self) {
	_RenderQueue_cleanupOtherPagesIfRequired(self);
	
	var minBound = self._lastPageNo - Math.ceil(RenderQueue._pagesPerScroll/2);
	if (minBound < 0) minBound = 0;
	var maxBound = minBound + RenderQueue._pagesPerScroll;
	if (maxBound >= self._queue.length) maxBound = self._queue.length - 1;

	for(var i=minBound; i<=maxBound; i++) {
		_RenderQueue_addToPendingQueue(self, i);
	}
	if (self._renderOngoing) return;
	_RenderQueue_renderPendingItems(self);
}

function _RenderQueue_addToPendingQueue(self, pageNo) {
	if (pageNo < 0 || pageNo >= self._queue.length) return;
	var pageRenderer = self._queue[pageNo];
	if (!pageRenderer.isRenderPending()) return;
	pageRenderer.prepare();
	self._pendingRenders.push(pageNo);
}

function _RenderQueue_renderPendingItems(self) {
	if (self._pendingRenders.length <= 0) {
		self._renderOngoing = false;
		return;
	}
	self._renderOngoing = true;
	var pageNo = self._pendingRenders.shift();
	var pageRenderer = self._queue[pageNo];
	self._renderedPages[pageNo] = true;
	pageRenderer.render();
}

function _RenderQueue_cleanupOtherPagesIfRequired(self) {
	if (Object.keys(self._renderedPages).length < RenderQueue._pagesToKeep) return;

	// Clear the pending stuff. They have to be rebuilt according to current position
	for (var i=0; i<self._pendingRenders.length; i++) {
		var pageNo = self._pendingRenders[i];
		self._queue[pageNo].clear();
	}
	self._pendingRenders = [];

	// result in 50% of needed level. The loaded pages keeps moving between 50% and 100%.
	// 25% before and 25% after current page
	var reduceToLevel = Math.ceil(RenderQueue._pagesToKeep/4);
	var minBound = self._lastPageNo - reduceToLevel;
	if (minBound < 0) minBound = 0;
	var maxBound = minBound + 2*reduceToLevel;
	if (maxBound >= self._queue.length) maxBound = self._queue.length - 1;
	
	var retainedRenderedPages = {};
	for (var i in self._renderedPages) {
		if (i < minBound || i > maxBound) {
			self._queue[i].clear();
		} else {
			retainedRenderedPages[i] = true;
		}
	}
	self._renderedPages = retainedRenderedPages;
}

function _RenderQueue_onRenderDone(self) {
	_RenderQueue_renderPendingItems(self);
}

function _RenderQueue_onHeightEstimate(self, height) {
	if (!self._isInline || self._heightEstimateDone) return;
	self._heightEstimateDone = true;
	for (var i=0; i<self._queue.length; i++) {
		self._queue[i]._holder.css({'min-height': height});
	}
}

//###########################################################################################
// Class PageRenderer - renders one page of a pdf file inside a pdfHolder DOM element
//###########################################################################################
function PageRenderer(container, pdfHolder, isInline, onRenderDoneFn, onHeightEstimateFn) {
	//---------------------------------------------------------------------------------------
	// Private data members - convention is to start the name with _
	// (All defined in init method)
	//---------------------------------------------------------------------------------------
	
	//---------------------------------------------------------------------------------------
	// Public Methods
	//---------------------------------------------------------------------------------------
	this.isRenderPending = PageRenderer_isRenderPending;
	this.prepare = PageRenderer_prepare;
	this.render = PageRenderer_render;
	this.clear = PageRenderer_clear;
	this.callOnRenderDone = PageRenderer_callOnRenderDone;

	//---------------------------------------------------------------------------------------
	// Constructor code
	//---------------------------------------------------------------------------------------
	_PageRenderer_init(this, container, pdfHolder, isInline, onRenderDoneFn, onHeightEstimateFn);
}

PageRenderer.STATE_INIT = 0;
PageRenderer.STATE_PREPARED = 1;
PageRenderer.STATE_RENDERING = 2;
PageRenderer.STATE_RENDERED = 3;
PageRenderer.STATE_CLEAR_WAITING = 4;

//-------------------------------------------------------------------------------------------
// PageRenderer Methods
//-------------------------------------------------------------------------------------------
function _PageRenderer_init(self, container, pdfHolder, isInline, onRenderDoneFn, onHeightEstimateFn) {
    self._container = container;
    self._holder = pdfHolder;
    self._isInline = isInline;
	self._neededWidth = pdfHolder.width();
    self._url = pdfHolder.attr('njsPdfUrl');
    self._pageNum = parseInt(pdfHolder.attr('njsPdfPage'));
    self._scale = parseFloat(pdfHolder.attr('njsPdfScale'));
	self._pdfObject = njs_pdf.Pdf.get(self._url);
	
	self._onRenderDoneFn = onRenderDoneFn;
	self._onHeightEstimateFn = onHeightEstimateFn;
	self._state = PageRenderer.STATE_INIT;
}

function PageRenderer_isRenderPending() {
	return (this._state == PageRenderer.STATE_INIT || this._state == PageRenderer.STATE_CLEAR_WAITING);
}

function PageRenderer_prepare() {
	// Create the elements inside the pdf_holder
	var self = this;
	self._holder.empty();
	var waiting = '<div class="njs_pdf_waiting"><div class="njs_pdf_waiting_msg"></div><img class="njs_pdf_progress_bar" src="{}/general/waiting1.gif"/></div>';
	waiting = jQuery(njs_helper.fmt2(waiting, nittio.getStaticResFolder()));
	waiting.hide(); 
	self._holder.append(waiting);
	self._state = PageRenderer.STATE_PREPARED;
}

function PageRenderer_render() {
	var self = this;
	if (self._state == PageRenderer.STATE_RENDERING) return;
	if (self._state == PageRenderer.STATE_CLEAR_WAITING) {
		self._state = PageRenderer.STATE_RENDERING;
		return;
	}
	self._state = PageRenderer.STATE_RENDERING;
	var statusBar =  new PdfStatusBar(self._holder);
	statusBar.progressMsg('');
	
	self._pdfObject.onLoadDone(function(bSuccess, errorMsg, exception) {
		if (!bSuccess) {
			statusBar.errorMsg('Error loading the PDF file');
			self.callOnRenderDone();
			return;
		}
        _PageRenderer_renderImpl(self, statusBar);
	});
}

function _PageRenderer_renderImpl(self, statusBar) {
	var scrollSize = 30.0;
	var pageCount = self._pdfObject.getPageCount();
	if (self._pageNum < 1 || self._pageNum > pageCount) {
		var msg = njs_helper.fmt2('<div>Error: cannot display page {} from a PDF containing {} pages</div>', 
								self._pageNum, pageCount);
		statusBar.errorMsg(msg);
		self.callOnRenderDone();
		return;
	}
	self._pdfObject.getDocument().getPage(self._pageNum).then(function(page) {
		var w = (self._neededWidth > scrollSize) ? self._neededWidth - scrollSize: self._neededWidth;
		var viewport1 = page.getViewport(1.0);
		var scaleAutoWidth = w / viewport1.width * self._scale * 0.94;
		
        var viewport = page.getViewport(scaleAutoWidth);
		var canvas = jQuery('<canvas class="njs_pdf_canvas"/>');
        
        canvas.attr('height', viewport.height);
        canvas.attr('width', viewport.width);
		njs_helper.switchoffContenxtMenu(canvas);
		statusBar.done();

        self._holder.find('.njs_pdf_canvas').remove();
		self._holder.append(canvas);
		self._onHeightEstimateFn(viewport.height);
		if (self._isInline) self._holder.css({'min-height': viewport.height});
        
        // Render PDF page into canvas context
        var renderTask = page.render({canvasContext: canvas.get(0).getContext('2d'), viewport: viewport});
        
        // Wait for rendering to finish
        renderTask.promise.then(function () {
			self.callOnRenderDone();
        });
	});
}

function PageRenderer_callOnRenderDone() {
	var self = this;
	setTimeout(function() { // SetTimeout to break the sync call
		var oldState = self._state;
		self._state = PageRenderer.STATE_RENDERED;
		if (oldState ==  PageRenderer.STATE_CLEAR_WAITING) self.clear();
		if (self._onRenderDoneFn) self._onRenderDoneFn();
	}, 0);
}

function PageRenderer_clear() {
	// Clear the rendered data
	if (this._state == PageRenderer.STATE_RENDERED) {
		this._holder.empty();
		this._state = PageRenderer.STATE_INIT;
		return true; // data was cleared
	}

	// Clear un rendered data
	if (this._state == PageRenderer.STATE_INIT || this._state == PageRenderer.STATE_PREPARED) {
		this._holder.empty();
		this._state = PageRenderer.STATE_INIT;
		return false; // There was not much data to clear
	}
	
	// Render is ongoing. Just indicate the other thread to clear the render once the render
	// completes
	if (this._state == PageRenderer.STATE_RENDERING) {
		this._state = PageRenderer.STATE_CLEAR_WAITING;
		return true;
	}

	// Render is ongoing but already notified - nothing to do (state == STATE_CLEAR_WAITING).
	return false;
}

//###########################################################################################
// Class PdfStatusBar - show/hide/update the progress status bar
//###########################################################################################
function PdfStatusBar(pdfHolder) {
	//---------------------------------------------------------------------------------------
	// Private data members - convention is to start the name with _
	// (All defined in init method)
	//---------------------------------------------------------------------------------------
	
	//---------------------------------------------------------------------------------------
	// Public Methods
	//---------------------------------------------------------------------------------------
	this.errorMsg = PdfStatusBar_errorMsg;
	this.progressMsg = PdfStatusBar_progressMsg;
	this.done = PdfStatusBar_done;

	//---------------------------------------------------------------------------------------
	// Constructor code
	//---------------------------------------------------------------------------------------
	_PdfStatusBar_init(this, pdfHolder);
}

//-------------------------------------------------------------------------------------------
// PageRenderer Methods
//-------------------------------------------------------------------------------------------
function _PdfStatusBar_init(self, pdfHolder){
	self._pdfWaitingDiv = pdfHolder.find('.njs_pdf_waiting');
	self._pdfProgressBar = self._pdfWaitingDiv.find('.njs_pdf_progress_bar');
	self._pdfStatusMsg = self._pdfWaitingDiv.find('.njs_pdf_waiting_msg');
}

function PdfStatusBar_errorMsg(msg) {
	this._pdfStatusMsg.html(msg);
	this._pdfProgressBar.hide();
	this._pdfWaitingDiv.show();
}

function PdfStatusBar_progressMsg(msg) {
	this._pdfStatusMsg.html(msg);
	this._pdfProgressBar.show();
	this._pdfWaitingDiv.show();
}

function PdfStatusBar_done() {
	this._pdfWaitingDiv.hide();
}

return {
	Pdf: Pdf,
	RenderQueue: RenderQueue
};
}();

njs_helper = function() {

//#############################################################################################
// Assorted helper methods used in other javacripts
//#############################################################################################
var CONSTANTS = {SELECT2_MIN_SEARCH: 8}; 

//-------------------------------------------------------------------------------------------
// Formating helpers
//-------------------------------------------------------------------------------------------
// Similar to python string.format
function fmt1(strFmt, args) {
	return strFmt.replace(/{([^{}]*)}/g, function(match, dictKey) {
		return typeof args[dictKey] === 'undefined' ? match : args[dictKey];
	});
}

function fmt2() {
	var i = 1, args = arguments, strFmt = args[0];
	return strFmt.replace(/{}/g, function() {
		return typeof args[i] != 'undefined' ? args[i++] : '';
	});
}

function escape(input) {
	return String(input).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// jQuery object from html string
function jobj(htmlString) {
	return jQuery('<div/>').html(htmlString).contents();
}

var g_logEnabled = false;
function log_init(bEnable) {
	g_logEnabled = (bEnable && window.console && window.console.log) ? true : false;
}

function log() {
	if (!g_logEnabled) return;
	console.log(arguments);
}

function copyToClipboard(text) {
  window.prompt("Copy to clipboard: Press Ctrl+C and Enter", text);
}
	
function stopPropagation(event) {
	if(event == '') return;
	event.stopPropagation();
	event.preventDefault();
}

//-------------------------------------------------------------------------------------------
// Helper used for resizing the text inside a section
//-------------------------------------------------------------------------------------------
function valignMiddle(obj) {
	var outerHeight = obj.innerHeight();
	var vAlignHolder = obj.find('.vAlignHolder');
	var innerHeight = vAlignHolder.innerHeight();
	var heightDiff = (outerHeight - innerHeight) / 2;
	vAlignHolder.css('top', heightDiff);
}

//-------------------------------------------------------------------------------------------
// Helper used for resizing the text inside a section
//-------------------------------------------------------------------------------------------
var ERROR_MARGIN = 3; // Number of pixel error margin
var MIN_TEXT_SIZE = 30;
var OVERFLOW_DEF = 'visible';
function findMinFontSizeOfGroup(pgSecView, textSizes, fmtgroup) {
	var maxSize=(fmtgroup in textSizes) ? textSizes[fmtgroup] : 100;
	var fitChecker = new TextFitmentChecker(pgSecView);
	var textSize = fitChecker.findBestFit(MIN_TEXT_SIZE, maxSize);

	fitChecker.cleanup();
	textSizes[fmtgroup] = textSize;
} 

function resizeText(section, textSize) {
	var pgSecView = section.pgSecView;
	var fsz = '' + textSize + '%';
	var overflow = OVERFLOW_DEF;
	if (textSize <= MIN_TEXT_SIZE) {
		var fitChecker = new TextFitmentChecker(pgSecView);
		if (!fitChecker.doesItFit(textSize)) {
			overflow = 'scroll';
			section.valignMiddle = false;
		}
		fitChecker.cleanup();
	}
	pgSecView.find('.inline_obj').each(function() {
		overflow = 'scroll';
		section.valignMiddle = false;
	});
	pgSecView.css({'font-size': fsz, 'line-height': '110%', 'overflow-y': overflow});
} 

function clearTextResizing(pgSecView) {
	pgSecView.css({'font-size': '100%', 'line-height': '110%', 'overflow-y': OVERFLOW_DEF});
} 

function TextFitmentChecker(pgSecView) {
	// Constructor
	var shadow = pgSecView.clone();
	shadow.css({'z-index' : -10, 'opacity' : 0, 'bottom': 'auto', 'height': 'auto'}).appendTo(pgSecView.parent());
	var hOrig = pgSecView.css({'font-size' : '100%'}).height();
	var wOrig = pgSecView.width();
	
	// Public Methods
	this.doesItFit = function(textSize) {
		var fsz = '' + textSize + '%';
		var hNew = shadow.css({'font-size': fsz, 'line-height': '110%'}).height();
		if (hNew > hOrig) return false;
		
		var wNew = _getChildMaxWidth(shadow);
		if (wNew > wOrig + ERROR_MARGIN) return false;
		return true;
	};
	
	this.findBestFit = function(minSize, maxSize) {
		if (this.doesItFit(maxSize)) return maxSize;
		if (!this.doesItFit(minSize)) return minSize;
		if (maxSize - minSize <= 1) return minSize;
		
		var midSize = Math.floor((minSize+maxSize)/2);
		var textSize = this.findBestFit(midSize, maxSize);
		if (textSize > midSize) return textSize;

		return this.findBestFit(minSize, midSize);
	};

	this.cleanup = function() {
		shadow.remove();
	};

	// Private Methods
	var _getChildMaxWidth = function(obj) {
		var maxWidth = 0;
		obj.find('*').each(function() {
			if (jQuery(this).hasClass('not_inside')) return;
			var w = jQuery(this).width();
			if (w > maxWidth) {
				maxWidth = w;
			}
		});
		return maxWidth;
	};
};

//-------------------------------------------------------------------------------------------
// Helper used for randomizing sections in a lesson page
//-------------------------------------------------------------------------------------------
// generate a set with nSize elements;
// Elements in randPos position are intercahnged randomly, rest of array[i] = i
// E.g. MCQ will be randSet(6, [1,2,3,4]);
function randSet(nSize, randPosArray) {
	var ret = [];
	for (var i = 0; i < nSize; i++) {
		ret.push(i);
	}

	randLen = randPosArray.length;
	for (var pos = 0; pos < randLen; pos++) {
		var i = randPosArray[pos];
		var j = randPosArray[Math.floor(Math.random() * randLen)];
		var temp = ret[j];
		ret[j] = ret[i];
		ret[i] = temp;
	}

	return ret;
}

//-------------------------------------------------------------------------------------------
// Context Menu off
//-------------------------------------------------------------------------------------------
function switchoffContenxtMenu(jqElems) {
	jqElems.off('contextmenu');
	jqElems.on('contextmenu', function(event) {
		event.preventDefault();
		return false;
	});
}


function dialogPopup(title, msg, nextFn) {
		var cancelButton = {id: 'cancel', text: 'Close', fn: function() {
		njs_helper.Dialog.popdown();
		if (nextFn !== undefined) nextFn();
	}};
	njs_helper.Dialog.popup(title, njs_helper.fmt2('<div>{}</div>', msg), [], cancelButton);
}

function defaultErrorHandler(errorMessage, nextFn) {
	dialogPopup('Error', errorMessage, nextFn);
}


//-------------------------------------------------------------------------------------------
// AsyncFunctionChain - If you want set of async functions to be chained one after another, 
// this class can be used to chain them to gether. Each Async fucntion has to take the 'chain'
// as parameter and trigger the next method of the chain.
//-------------------------------------------------------------------------------------------
function AsyncFunctionChain(onErrorFn) {

	//---------------------------------------------------------------------------------------
	// Private Members
	//---------------------------------------------------------------------------------------
	var _queue = [];
	var _offset = 0;
	var _bExecutionInProgress = false;
	var _lastFunctionResult = null;
	var _bErrorInExecution = false;
	var _onErrorFunction = (onErrorFn !== undefined) ? onErrorFn : function(errorMessage) {
		defaultErrorHandler(errorMessage);
	};
	
	//---------------------------------------------------------------------------------------
	// Public Methods
	//---------------------------------------------------------------------------------------	
	// Add an Async Function to the chain. This will be executed only if 
	// no other function in the chain is currently in execution.
	this.add = function(asyncFn) {
		if (_bErrorInExecution) return;
		_enqueue(asyncFn);
		if (_bExecutionInProgress) return;
		_executeNext();
	};
	
	// Called by the Async Function after the function completes successful execution
	// The return vale from the function is passed in the done function.
	this.done = function(value) {
		_lastFunctionResult = value;
		_executeNext();
	};

	// Called by the Async Function after the function completes successful execution
	// The return vale from the function is passed in the done function.
	this.error = function(errorMsg) {
		_bExecutionInProgress = false;
		_bErrorInExecution = true;
		_lastFunctionResult = null;
		_clear();
		_onErrorFunction(errorMsg);
	};

	// Gets the result stored by last function.
	this.getLastResult = function() {
		return _lastFunctionResult;
	};

	//---------------------------------------------------------------------------------------
	// Private methods
	//---------------------------------------------------------------------------------------
	function _executeNext() {
		if (_queue.length == 0) {
			_bExecutionInProgress = false;
			return;			
		}
		
		_bExecutionInProgress = true;
		var nextFn = _dequeue();
		nextFn();
	}
  
	function _enqueue(item){
		_queue.push(item);
	}
	
	function _dequeue(){
		// if the queue is empty, return immediately
		if (_queue.length == 0) return undefined;
		
		// store the item at the front of the queue
		var item = _queue[_offset];
		
		// increment the offset and remove the free space if necessary
		if (++ _offset * 2 >= _queue.length){
			_queue  = _queue.slice(_offset);
			_offset = 0;
		}
	
		// return the dequeued item
	    return item;
	}

	function _clear() {
		_queue = [];
		_offset = 0;
	}
}

//-------------------------------------------------------------------------------------------
// Ajax Request with a simple callback
//-------------------------------------------------------------------------------------------
function Ajax(cb, retryAfterLogin, showErrorMsg) {
	
	if (retryAfterLogin === undefined) retryAfterLogin = true;
	if (showErrorMsg === undefined) showErrorMsg = true;

	var cbInternal = cb;
	
	if (showErrorMsg) {
		cbInternal = function(data, errorType, errorMsg) {
			if (errorType != Ajax.ERROR_NONE) {
				defaultErrorHandler(errorMsg, function() {
					cb(data, errorType, errorMsg);
				});
			} else {
				cb(data, errorType, errorMsg);
			}
		};
	}

	//---------------------------------------------------------------------------------------
	// Private Methods
	//---------------------------------------------------------------------------------------	
	var _formData = new FormData();

	//---------------------------------------------------------------------------------------
	// Public Methods
	//---------------------------------------------------------------------------------------	
	this.send = function(url, params, contentType, processData, onProgress) {
		var ajaxParams = {type : "POST", url : url, data : params, async : true};
		if (contentType !== undefined) ajaxParams.contentType = contentType;
		if (processData !== undefined) ajaxParams.processData = processData;
		if (onProgress !== undefined) ajaxParams.xhrFields = {onprogress: onProgress};

		var self = this;
		ajaxParams.success = function(data, textStatus, jqXHR) {
			if ('NOT_LOGGED_IN' in data) {
				if (retryAfterLogin) {
					self.retryLogin(url, params, contentType, processData, onProgress);
				} else {
					cbInternal(null, Ajax.ERROR_LOGIN, data.error);
				}
			} else if ('error' in data) {
				cbInternal(null, Ajax.ERROR_APP, data.error);
			} else {
				cbInternal(data.result, Ajax.ERROR_NONE, null);
			}
		};
		ajaxParams.error = function(jqXHR, textStatus, errorThrown) {
			cbInternal(null, Ajax.ERROR_NETWORK, 'Error connecting to the server');
		};
		jQuery.ajax(ajaxParams);
	};

	this.retryLogin = function(url, params, contentType, processData, onProgress) {
		var self = this;
		var chain = new njs_helper.AsyncFunctionChain(function(errorMessage2) {
			cbInternal(null, Ajax.ERROR_LOGIN, 'Sigin in failed. Please sign in to perform this operation.');
		});
		var dlg = new njs_helper.LoginDlg(chain);
		chain.add(function() {
			dlg.show();
		});
		chain.add(function() {
			dlg.loginAjax();
		});
		chain.add(function() {
			self.send(url, params, contentType, processData, onProgress);
			chain.done();
		});
	};
	
	this.addFormData = function(fieldName, field) {
		_formData.append(fieldName, field);
	};

	this.sendForm = function(url) {
		this.send(url, _formData, contentType=false, processData=false, onProgress = function(progress) {
			if (progress.lengthComputable) {
				njs_helper.log(njs_helper.fmt2('progress: loaded={}, total={}', progress.loaded, progress.total));
			} else {
				njs_helper.log(njs_helper.fmt2('progress: length not computable'));
			}
		});
	};
}

Ajax.ERROR_NONE = 0;
Ajax.ERROR_LOGIN = 1;
Ajax.ERROR_NETWORK = 2;
Ajax.ERROR_APP = 3;

//-------------------------------------------------------------------------------------------
// Ajax Request in a chain(AsyncFunctionChain)
//-------------------------------------------------------------------------------------------
function AjaxInChain(chain, retryAfterLogin) {

	//---------------------------------------------------------------------------------------
	// Private Methods
	//---------------------------------------------------------------------------------------
	var cb = function(data, errorType, errorMsg) {
		if (errorType != Ajax.ERROR_NONE) {
			chain.error(errorMsg);
		}
		else {
			chain.done(data);
		}
	};
	
	var _ajax = new njs_helper.Ajax(cb, retryAfterLogin, false);

	//---------------------------------------------------------------------------------------
	// Public Methods
	//---------------------------------------------------------------------------------------	
	// send has to be added to the chain - not called directly!
	this.send = function(url, params, contentType, processData, onProgress) {
		_ajax.send(url, params, contentType, processData, onProgress);
	};

	// addFormData has to be added to the chain - not called directly!
	this.addFormData = function(fieldName, field) {
		_ajax.addFormData(fieldName, field);
	};

	// sendForm has to be added to the chain - not called directly!
	this.sendForm = function(url) {
		_ajax.sendForm(url);
	};
}

//#############################################################################################
// SyncManager - Class to send async ajax requests in sequence 
// (Example: Used for lesson save/upload resources)
//#############################################################################################
function SyncManager() {
	this.syncInProgress = SyncManager_syncInProgress;
	this.onSyncDone = SyncManager_onSyncDone;
	this.postToServer = SyncManager_postToServer;
	
	_SyncManager_init(this);
}

var g_syncManager = null;
SyncManager.get = function() {
	if (g_syncManager == null) g_syncManager = new SyncManager();
	return g_syncManager;
};

//#############################################################################################
// SyncManager - public methods
//#############################################################################################
function SyncManager_syncInProgress () {
	return this.syncInProgress;	
}

function SyncManager_onSyncDone(onDoneFn) {
	this.onDoneFns.push(onDoneFn);
	_SyncManager_doNext(this);
}

function SyncManager_postToServer(ajaxUrl, ajaxParams, bReplace, onCompleteFn) {
	var req = {ajaxUrl:ajaxUrl, ajaxParams:ajaxParams, onCompleteFn:onCompleteFn};
	_SyncManager_removeDuplicates(this, bReplace, ajaxUrl);
	this.pendingRequests.push(req);
	_SyncManager_doNext(this);
}

function _SyncManager_removeDuplicates(self, bReplace, ajaxUrl) {
	if (!bReplace) return;
	var pendingRequests = self.pendingRequests;
	self.pendingRequests = [];
	for(var i=0; i<pendingRequests.length; i++) {
		if (pendingRequests[i].ajaxUrl == ajaxUrl) continue;
		self.pendingRequests.push(pendingRequests[i]);
	}
}

//#############################################################################################
// SyncManager - private methods
//#############################################################################################
function _SyncManager_init(self) {
	self.syncInProgress = false;
	self.pendingRequests = [];
	self.onDoneFns = [];
	self.error = false;
}

function _SyncManager_doNext(self) {
	if (self.syncInProgress) return;
	if (self.pendingRequests.length == 0) {
		for (var i=0; i<self.onDoneFns.length; i++) {
			self.onDoneFns[i]();
		}
		self.onDoneFns = [];
		var msg = self.error ? 'Failure during save' : 'Saved';
		self.error = false;
		njs_helper.Dialog.popdownFixedStatus(msg);
		return;
	}

	njs_helper.Dialog.popupFixedStatus('Saving data to the server ...');
	self.syncInProgress = true;
	self.error = false;
	
	var currentReq = self.pendingRequests[0];
	self.pendingRequests.splice(0, 1);

	var cb = function(data, errorType, errorMsg) {
		if (errorType == njs_helper.Ajax.ERROR_NONE) {
			currentReq.onCompleteFn(data, false);
			_SyncManager_doNextOnComplete(self);
			return;			
		}
		var cancelButton = {id: 'cancel', text: 'Close', fn: function() {
			njs_helper.Dialog.popdown();
			currentReq.onCompleteFn(null, true);
			self.error = true;
			_SyncManager_doNextOnComplete(self);
		}};
		var retryButton = {id: 'retry', text: 'Retry', fn: function() {
			njs_helper.Dialog.popdown();
			self.pendingRequests.unshift(currentReq); // add to top of queue
			_SyncManager_doNextOnComplete(self);
		}};
		njs_helper.Dialog.popup('Error', njs_helper.fmt2('<div>{}</div>', errorMsg), [retryButton], cancelButton);
	};
	
	var ajax = new njs_helper.Ajax(cb, true, false);
	for(var key in currentReq.ajaxParams) {
		ajax.addFormData(key, currentReq.ajaxParams[key]);
	}
	ajax.sendForm(currentReq.ajaxUrl);
	return;
}

function _SyncManager_doNextOnComplete(self) {
	self.syncInProgress = false;
	_SyncManager_doNext(self);
}

//-------------------------------------------------------------------------------------------
// ClientSideTemplate - get the template based on the template name; used dust.js to replace
// template to actual value
//-------------------------------------------------------------------------------------------
var _compiledTemplates = {}; // Static member

function ClientSideTemplate(templateName, chain) {
	_getAndCompileTemplate();
	
	//---------------------------------------------------------------------------------------
	// Public Methods
	//---------------------------------------------------------------------------------------	
	// render has to be added to the chain - not called directly!
	this.render = function(jsonModel) {
		dust.render(templateName, jsonModel, function(err, out) {
			if (err) {
				chain.error(err);
				return;
			}
			chain.done(out);
		});
	};

	//---------------------------------------------------------------------------------------
	// Private Methods
	//---------------------------------------------------------------------------------------	
	function _getAndCompileTemplate() {
		if (templateName in _compiledTemplates) return;
		chain.add(function() {
			_getTemplate();
		});
		chain.add(function() {
			_compileTemplate();
		});
	}
	
	function _getTemplate() {
		var ajax = new njs_helper.AjaxInChain(chain);
		var url = fmt2('/default/client_templ.json/{}/{}', nittio.getStaticVersion(), templateName);
		ajax.send(url, {});
	}
	
	function _compileTemplate() {
		var templateContent = chain.getLastResult();
		var compiled = dust.compile(templateContent, templateName);
		dust.loadSource(compiled);
		_compiledTemplates[templateName] = true;
		chain.done();
	}
}

//-------------------------------------------------------------------------------------------
// Show or hide BlankScreen and '.body' DOM element without affecting the display
//-------------------------------------------------------------------------------------------
function BlankScreen() {
}

BlankScreen.ZINDEX_HIDE = -100;
BlankScreen.ZINDEX_SHOW = 20;
BlankScreen.ANIM_TIME = 300;

BlankScreen._isShown = false;

BlankScreen.isVisible = function() {
	return BlankScreen._isShown;
};

BlankScreen.show = function() {
	if (BlankScreen._isShown) return;
	BlankScreen._isShown = true;
	
	var bs = jQuery('#blankScreen');
	var progressBar = bs.find('img');
	var body = jQuery('.body');
	bs.velocity({'z-index': BlankScreen.ZINDEX_SHOW, opacity: 0.8}, BlankScreen.ANIM_TIME);
	progressBar.velocity({opacity: 1}, BlankScreen.ANIM_TIME);
	body.velocity({translateX: -100000, translateY: -100000, 'z-index': BlankScreen.ZINDEX_HIDE, opacity: 0}, 0);
};

BlankScreen.hide = function() {
	if (!BlankScreen._isShown) return;
	BlankScreen._isShown = false;

	var bs = jQuery('#blankScreen');
	var progressBar = bs.find('img');
	var body = jQuery('.body');
	progressBar.velocity({opacity: 0}, 0);
	bs.velocity({'z-index': BlankScreen.ZINDEX_HIDE, opacity: 0}, BlankScreen.ANIM_TIME);
	body.velocity({translateX: [0, 0], translateY: [0, 0], 'z-index': 0, opacity: 1}, 0);
};

//-------------------------------------------------------------------------------------------
// Dialog - models a dialog box
//-------------------------------------------------------------------------------------------
function Dialog() {
	
	//---------------------------------------------------------------------------------------
	// Private Members
	//---------------------------------------------------------------------------------------
	var _dlgId = null; 
	var _oldValues = {}; // Stores the old values to be restored in case the dialog is cancelled.
	var _cancelFn = null;
	var _startPoint = null;
	var _onShowDoneFn = null;
	var _isShown = false;
	var _closeOnEscape = true;

	//---------------------------------------------------------------------------------------
	// Public Methods
	//---------------------------------------------------------------------------------------
	this.create = function(dialogId, dlgFields, buttons, cancelButton) {
		_dlgId = dialogId;
		var me = this;
		if (dlgFields == null) dlgFields = jQuery('#' + _dlgId).remove();
		if (cancelButton === undefined) cancelButton = {id: 'cancel', text: 'Cancel'};
		if (!('fn' in cancelButton)) cancelButton.fn = function() { me.cancel();}; // me needed for reseting this in callback
		_dlgCreate('.pagecanvas', dlgFields, buttons, cancelButton);
	};
	
	this.update = function(title, content, buttons, cancelButton) {
		var me = this;
		if (buttons === undefined) buttons = [];
		if (cancelButton === undefined) cancelButton = {id: 'close', text: 'Close'};
		if (!('fn' in cancelButton)) cancelButton.fn = function() { me.cancel();}; // me needed for reseting this in callback
		_dlgUpdate(title, content, buttons, cancelButton);
	};
	
    this.updateBodyWithIframe = function(iframeUrl) {
        var dlgBody = jQuery('#' + _dlgId);
        dlgBody.html('');
        var newBody = jQuery(njs_helper.fmt2("<iframe src='{}' class='full-iframe'/>", iframeUrl));
        dlgBody.append(newBody);
    };
    
	this.closeOnEscape = function(bCloseOnEscape) {
		_closeOnEscape = bCloseOnEscape;
	};
	
	this.isCloseOnEscape = function() {
		return _closeOnEscape;
	};
	
	this.onShowDone = function(onShowDoneFn) {
		_onShowDoneFn = onShowDoneFn;
	};
	
	this.show = function(boxSize, startPoint) {
		_startPoint = startPoint;
		if (_startPoint === undefined) _startPoint = {x: '50%', y: '50%'};
		if (boxSize === undefined) boxSize = Dialog.sizeLarge();
		boxSize.top = [boxSize.top, _startPoint.y];
		boxSize.left = [boxSize.left, _startPoint.x];
		boxSize.right = [boxSize.right, _startPoint.x];
		boxSize.bottom = [boxSize.bottom, _startPoint.y];
		boxSize.opacity = 1;

		var dlg = _dlgObj();

		dlg.find('.dlgField .field').each(function() {
			_oldValues[jQuery(this).attr('id')] = jQuery(this).val();
		});

		dlg.show().velocity(boxSize, BlankScreen.ANIM_TIME, function() {
			if (_onShowDoneFn != null) _onShowDoneFn();
		});
		
		_isShown = true;
		Dialog.moveBack(this);
	};

	this.isVisible = function() {
		var dlg = _dlgObj();
		return (_isShown && !dlg.hasClass('moveBehindBlankScreen'));
	};

	this.validate = function() {
		var dlg = _dlgObj();
		return njs_helper.Dialog.validate(dlg);
	};
	
	this.resetValues = function() {
		// Reset the old values
		var dlg = _dlgObj();
		dlg.find('.dlgField .field').each(function() {
			jQuery(this).val(_oldValues[jQuery(this).attr('id')]);
			if (!jQuery(this).attr('readonly')) {
				jQuery(this).css({'background-color' : '#FFFFFF'});			
			}
		});
	};
	
	this.customCancel = function(onCloseDone) {
		_cancelFn(onCloseDone);
	};
	
	this.cancel = function(onCloseDone) {
		this.resetValues();
		this.close(onCloseDone);
	};

	this.close = function(onCloseDone) {
		var dlg = _dlgObj();
		Dialog.moveFront();
		var params = {top : _startPoint.y, left : _startPoint.x, right: _startPoint.x, bottom: _startPoint.y, opacity: 0};
		dlg.velocity(params, BlankScreen.ANIM_TIME, function() {
			dlg.hide();
			_isShown = false;
			if (onCloseDone !== undefined) onCloseDone();
		});
	};
	
	this.getDlgObj = function() {
		return _dlgObj();
	};

	this.remove = function() {
		var dlg = _dlgObj();
		dlg.remove();
	};
	
	//---------------------------------------------------------------------------------------
	// Private Methods
	//---------------------------------------------------------------------------------------
	function _dlgCreate(formParent, dlgFields, buttons, cancelButton) {

		dlgFields.addClass('njsDialogFields');
		dlgFields.attr('id', _dlgId);
		var dlgClass = (formParent === '.pagecanvas') ? 'njsDialog' : 'njsForm';
		var dlg = jQuery(njs_helper.fmt2("<div class='{}' id='{}_dlg'></div>", dlgClass, _dlgId));
		_cancelFn = cancelButton.fn;
		dlg.append(_dlgGetTitleBar(dlgFields, cancelButton.fn));
		dlg.append(dlgFields);
		
		var dlgButtons = jQuery(njs_helper.fmt2("<div class='njsDialogButtons' id='{}_buttons'/>", _dlgId));
		_addButtons(_dlgId, dlgButtons, buttons, cancelButton);
		dlg.append(dlgButtons);

		jQuery(formParent).append(dlg);
		
		_setTabOrder();
		dlg.find('.dlgField select.field').each(function() {
			jQuery(this).select2({minimumResultsForSearch: CONSTANTS.SELECT2_MIN_SEARCH});
		});
	}
	
	function _dlgGetTitleBar(dlgFields, cancelFn) {
		// Create title bar
		var titleStr = dlgFields.attr('njsTitle');
		var title = jQuery(njs_helper.fmt2("<div class='njsDialogTitle'><div id='{}_title'>{}</div></div>", _dlgId, titleStr));
		
		var staticResFolder = nittio.getStaticResFolder();
		var closeButton = jQuery(njs_helper.fmt2("<img src='{}/quick-links/close.png'/>", staticResFolder));
		closeButton.on('click', cancelFn);
		closeButton.attr('id', njs_helper.fmt2('{}_top_close_button', _dlgId));
		title.append(closeButton);
		
		// Add help button if help is available
		var help = _dlgGetHelp(dlgFields);
		if (help == '') return title;
		
		var helpButton = jQuery(njs_helper.fmt2("<img src='{}/quick-links/help.png' onclick=\"nittio.toggleElem('#{}_help');\"/>", staticResFolder, _dlgId));
		title.append(helpButton);

		var dlgHelp = njs_helper.fmt2("<div id='{}_help' class='njsDialogHelp njspopup'><div class='callout'>{}</div></div>", _dlgId, help);
		dlgFields.prepend(dlgHelp);
		
		return title;
	}

	function _dlgGetHelp(dlgFields) {
		var help = '';
		dlgFields.children('.njsHelp').each(function() {
			help = jQuery(this).remove().html();
		});
		if (help == '') {
			help = dlgFields.attr('njsHelp') || '';
		}
		return help;
	}

	function _dlgUpdate(title, content, buttons, cancelButton) {
		var dlg = _dlgObj();
		
		// Set title
		var dlgTitle = dlg.find(njs_helper.fmt2('#{}_title', _dlgId));
		dlgTitle.html(title);
		
		// Set content
		var dlgContent = dlg.find(njs_helper.fmt2('#{}_content', _dlgId));
		dlgContent.html(content);

		// Set cancel button
		var dlgTopCloseButton = dlg.find(njs_helper.fmt2('#{}_top_close_button', _dlgId));
		_cancelFn = cancelButton.fn;
		dlgTopCloseButton.off('click').on('click', _cancelFn);
		
		
		// Set all buttons 
		var dlgButtons = dlg.find('.njsDialogButtons');
		dlgButtons.html('');
		_addButtons(_dlgId, dlgButtons, buttons, cancelButton);

		_setTabOrder();
		dlg.find('.dlgField select.field').each(function() {
			jQuery(this).select2({minimumResultsForSearch: CONSTANTS.SELECT2_MIN_SEARCH});
		});
	}
	
	function _setTabOrder() {
		var dlg = _dlgObj();
		dlg.find('.njsDialogFields .dlgTabStop').each(function() {
			jQuery(this).attr('tabindex', 1);
		});
		dlg.find('.njsDialogButtons button').each(function() {
			jQuery(this).attr('tabindex', 1);
		});
	};
	
	function _dlgObj() {
		return jQuery(njs_helper.fmt2('#{}_dlg', _dlgId));
	}
}

// Dialog class - static member and methods
Dialog._waitingDialogsStack = []; 
Dialog._activeDialog = null;
Dialog._cancelAllowed = true;

//---------------------------------------------------------------------------------------
// Static method	
//---------------------------------------------------------------------------------------
Dialog.validate = function(dlg) {
	var bRet = true;
	dlg.find('.dlgField input').each(function (){
		var obj = jQuery(this);
		// Ignore the input fields under select2
		if (obj.parents('.select2-container').length > 0) return;
		bRet = _checkMandatory(obj, bRet);
		bRet = _checkNumber(obj, bRet);
	});
	return bRet;
};

function _checkMandatory(field, bRet) {
	if (!field.parent().hasClass('mand')) return bRet;
	var bValid = (field.val() != '');
	_markFieldValidity(field, bValid, bRet);
	return bRet && bValid;
}

function _checkNumber(field, bRet) {
	if (field.attr('type') != 'number') return bRet;
	var val = field.val();
	if (val === '') return bRet;
	val = parseInt(val);
	
	var min = field.attr('min');
	var max = field.attr('max');
	var bValid = (!isNaN(val) && 
				(min === undefined || val >= parseInt(min)) && 
				(max === undefined || val <= parseInt(max)));
	_markFieldValidity(field, bValid, bRet);
	return bRet && bValid;
}

function _markFieldValidity(field, bValid, bFocus) {
	if (bValid) {
		field.css({'background-color' : '#FFFFFF'});
		return;
	}
	field.css({'background-color' : '#FFAAAA'});
	if (bFocus) field.focus();
};

Dialog.cancelActive = function(event) {
	if (!Dialog._cancelAllowed) return false;
	if (Dialog._activeDialog != null) {
		if(!Dialog._activeDialog.isCloseOnEscape()) return true;
		Dialog._activeDialog.customCancel();
		return true;
	}
	return Dialog.moveFront();
};

Dialog.moveBack = function(newActive) {
	if (newActive === undefined) {
		newActive = null;
		Dialog._cancelAllowed = false;
	} else {
		Dialog._cancelAllowed = true;
	}
	if (Dialog._activeDialog == null) {
		Dialog._activeDialog = newActive;
		BlankScreen.show();
		return;
	}
	Dialog._waitingDialogsStack.push(Dialog._activeDialog);
	var dlg = Dialog._activeDialog.getDlgObj();
	dlg.addClass('moveBehindBlankScreen');
	Dialog._activeDialog = newActive;
};

Dialog.moveFront = function() {
	Dialog._cancelAllowed = true;
	if (Dialog._waitingDialogsStack.length == 0) {
		Dialog._activeDialog = null;
		BlankScreen.hide();
		return false;
	}
	Dialog._activeDialog = Dialog._waitingDialogsStack.pop();
	var dlg = Dialog._activeDialog.getDlgObj();
	dlg.removeClass('moveBehindBlankScreen');
	return true;
};

Dialog.sizeSmall = function() {
	return {top: '30%', left: '30%', right: '30%', bottom: '30%'};
};

Dialog.sizeLarge = function() {
	return {top : 40, left : 30, right: 30, bottom: 30};
};

Dialog._defaultPopupDlg = null;
Dialog.popup = function(title, content, buttons, cancelButton, sizes) {
	if (sizes === undefined) sizes = Dialog.sizeSmall();

	var dlgId = 'defaultPopupDlg';
	if (Dialog._defaultPopupDlg === null) {
		Dialog._defaultPopupDlg = new Dialog();
		Dialog._defaultPopupDlg.create(dlgId, jQuery(njs_helper.fmt2("<div><div id='{}_content'/></div>", dlgId)), []);
	}
	
	if (Dialog._defaultPopupDlg.isVisible()) {
		Dialog.popdown(function() {
			_popupImpl(title, content, buttons, cancelButton, sizes);
		});
	} else {
		_popupImpl(title, content, buttons, cancelButton, sizes);
	}

};

function _popupImpl(title, content, buttons, cancelButton, sizes) {
	Dialog._defaultPopupDlg.update(title, content, buttons, cancelButton);
	Dialog._defaultPopupDlg.show(sizes);
}

Dialog.popdown = function(onCloseDone) {
	if (Dialog._defaultPopupDlg == null) {
		if (onCloseDone === undefined) return;
		onCloseDone();
		return;
	}
	Dialog._defaultPopupDlg.cancel(onCloseDone);
};

Dialog.popupStatus = function(content, nextFn) {
	var box = jQuery('#statusBox');
	box.children('.content').html(content);
	if (nextFn === undefined) nextFn = function() {};

	box.show().velocity({height: ['2em', 0], opacity: [1, 0]}, BlankScreen.ANIM_TIME);
	setTimeout(function() {
		box.velocity({height : 0, opacity : 0}, BlankScreen.ANIM_TIME, function() {
			box.hide();
			nextFn();
		});
	}, 2000);
};

Dialog.popupFixedStatus = function(content) {
	var box = jQuery('#statusBoxFixed');
	box.children('.content').html(content);
	box.show().velocity({height: ['2em', 0], opacity: [1, 0]}, BlankScreen.ANIM_TIME);
};

Dialog.popdownFixedStatus = function(content) {
	var box = jQuery('#statusBoxFixed');
	box.children('.content').html(content);
	window.setTimeout(function() {
		box.velocity({height: [0, '2em'], opacity: [0, 1]}, BlankScreen.ANIM_TIME, function() {
			box.hide();
		});
	}, 2000);
};

function _addButtons(dlgId, dlgButtons, buttons, cancelButton) {
	for (var i = 0; i < buttons.length; i++) {
		dlgButtons.append(_createButton(dlgId, buttons[i]));
	}
	dlgButtons.append(_createButton(dlgId, cancelButton));
}

function _createButton(dlgId, buttonInfo) {
	var id = njs_helper.fmt2('{}_{}', dlgId, buttonInfo.id);
	var text = ('text' in buttonInfo) ? buttonInfo.text : buttonInfo.id;
	var ret = jQuery(njs_helper.fmt2("<button id='{}', name='{}'>{}</button>", id, id, text));
	ret.click(buttonInfo.fn);
	return ret;
}
	
//-------------------------------------------------------------------------------------------
// AddResourceDlg - Add a resource dialog (if resInfo.resid, modify the resource)
//-------------------------------------------------------------------------------------------
function AddResourceDlg(inputChain, resInfo) {

	//---------------------------------------------------------------------------------------
	// Constructor code (part 1)
	//---------------------------------------------------------------------------------------
	Dialog.moveBack();

	//---------------------------------------------------------------------------------------
	// Private members
	//---------------------------------------------------------------------------------------
	var _chain = (inputChain !== undefined) ? inputChain : new AsyncFunctionChain();
	var _template = new ClientSideTemplate('add_res_dialog.html', _chain);
	var _restypeWidget = null;
	var _resourceWidget = null;
	var _compressionWidget = null;
	var _file = null;
	var _dlg = new njs_helper.Dialog();
	var _uploadUrl = null;
	
	var _restypeToMaxFileSize = {
		Image: 1*1024*1024, 
		PDF: 10*1024*1024, 
		Audio: 10*1024*1024, 
		Video: 30*1024*1024,
		Attachment: 10*1024*1024
	}; 

	var _restypeToExtension = {
		Image: ['.jpg', '.png', '.gif', '.svg', '.bmp'], 
		PDF: ['.pdf'] , 
		Audio: ['.m4a'] , 
		Video: ['.mp4'],
		Attachment: []
	}; 

	//---------------------------------------------------------------------------------------
	// Constructor code
	//---------------------------------------------------------------------------------------
	var ajax = new njs_helper.AjaxInChain(_chain);
	_chain.add(function() {
		ajax.send('/resource/get_res_types_and_upload_url.json', {});
	});
	_chain.add(function() {
		var ret = _chain.getLastResult();
		_uploadUrl = ret.uploadUrl;
		njs_helper.log(njs_helper.fmt2('uploadUrl: {}', _uploadUrl));
		var title = resInfo ? 'Modify resource' : 'Upload resource';
		_template.render({title: title, restypes: ret.restypes});
	});

	//----------------------------------------------------------------------------------------
	
	_chain.add(function() {
		var dlgFields = jQuery(_chain.getLastResult());
		var buttonName = resInfo ? 'Modify' : 'Upload';
		var addButton = {id: 'add', text: buttonName, fn: _on_addResource_add};
		var cancelButton = {id: 'cancel', text: 'Cancel', fn: _on_addResource_cancel};
		_dlg.create('addResource', dlgFields, [addButton], cancelButton);
		_restypeWidget = jQuery('#addResource #restype');
		_resourceWidget = jQuery('#addResource #resource');
		_compressionWidget = jQuery('#addResource #compression');
		
		if (resInfo) {
            _restypeWidget.select2('val', resInfo.restype);
            jQuery('#addResource #keywords').val(resInfo.keywords);
            _restypeWidget.attr('disabled', 'disabled');
		}
		
		_onRestypeChange();
		_restypeWidget.change(_onRestypeChange);
		_resourceWidget.change(function() {
			if (this.files.length == 0) {
				_file = null;
			} else {
				_file = this.files[0];
			}
		});
		_chain.done();
	});

	//---------------------------------------------------------------------------------------
	// Public methods
	//---------------------------------------------------------------------------------------
	// upload has to be called inside a chain
	this.upload = function() {
		_dlg.show();
		_restypeWidget.select2('focus');
		// _chain.done(); not needed here. Will be done when the dialog box closes
	};

	//---------------------------------------------------------------------------------------
	// Private methods
	//---------------------------------------------------------------------------------------
	function _onRestypeChange() {
		var restype = _restypeWidget.val();
		if (restype === 'Image') {
			_compressionWidget.select2('val', 'medium');
			_compressionWidget.removeAttr('disabled');
		} else {
			_compressionWidget.select2('val', 'no');
			_compressionWidget.attr('disabled', 'disabled');
		}
		if (!(restype in _restypeToExtension)) {
			_resourceWidget.attr('disabled', 'disabled');
			return;
		}
		var extlist = _restypeToExtension[restype];
		if (extlist.length > 0) {
			_resourceWidget.attr('accept', extlist.join(','));
		} else {
			_resourceWidget.removeAttr('accept');
		}
		_resourceWidget.removeAttr('disabled');
	}
	
	function _on_addResource_cancel() {
		_dlg.cancel(function() {
			_dlg.remove();
			_chain.done('');
		});
	}

	function _on_addResource_add() {
		var fileExtn = _validateBeforeShrinking();
		if (!fileExtn) return;
        Dialog.moveBack();
		var shrinker = new ImageShrinker();
		var bImg = (_restypeWidget.val() === 'Image');
		var compressionLevel = _compressionWidget.val();
		shrinker.getShrinkedFile(_file, fileExtn, _on_shrinkDone, bImg, compressionLevel);
	}

	function _on_shrinkDone(shrinkedFile, compInfo) {
        njs_helper.log('Compression info:', compInfo);
		if (shrinkedFile == null) shrinkedFile = _file;
		if (!_validateAfterShrinkingDone(shrinkedFile)) return;
		var chain2 = new njs_helper.AsyncFunctionChain(function(errorMessage) {
			Dialog.moveFront();
			_dlg.cancel(function() {
				_dlg.remove();
				_chain.error(errorMessage);
			});
		});
		var ajax2 = new njs_helper.AjaxInChain(chain2);
		chain2.add(function() {
			var restype = _restypeWidget.val();
			var keywords = jQuery('#addResource #keywords').val();
			if (resInfo) ajax2.addFormData('resid', resInfo.resid);
			ajax2.addFormData('restype', restype);
			ajax2.addFormData('resource', shrinkedFile);
			ajax2.addFormData('keywords', keywords);
			ajax2.addFormData('info', JSON.stringify(compInfo));
			ajax2.sendForm(_uploadUrl);
		});
		chain2.add(function() {
			Dialog.moveFront();
			_dlg.close(function() {
				_dlg.remove();
				_chain.done(chain2.getLastResult());
			});
		});
	}

	function _validateBeforeShrinking() {
		var restype = _restypeWidget.val();
		if (!(restype in _restypeToExtension) || _file == null) {
			Dialog.popup('Input missing', 'Please choose the resource Type, followed by file');
			return null;
		}
		if (_file.size == 0) {
			Dialog.popup('Empty File', 'Empty file cannot be uploaded');
			return null;
		}
		var extlist = _restypeToExtension[restype];

        var fileExtn = null;
		var fileNameLower = _file.name.toLowerCase();
		for (var i in extlist) {
			var ext = extlist[i];
			if (fileNameLower.indexOf(ext, fileNameLower.length - ext.length) !== -1) {
				fileExtn = ext;
				break;
			}			
		}
		if (extlist.length >0 && !fileExtn) {
			Dialog.popup('Wrong file type', njs_helper.fmt2('For resource type {}, only one of the extension(s) "{}" is allowed.', restype, extlist.join(',')));
			return null;
		}
		return fileExtn;	
	}

	function _validateAfterShrinkingDone(shrinkedFile) {
		var restype = _restypeWidget.val();
		if (shrinkedFile.size > _restypeToMaxFileSize[restype]) {
			Dialog.popup('File too large', njs_helper.fmt2('You cannot upload a {} file greater than {} MB. You may try using "High compression" and upload your image.', restype,(_restypeToMaxFileSize[restype]/1024/1024)));
			return false;
		}
		return true;
	}
}

//---------------------------------------------------------------------------------------
//resize the image
//---------------------------------------------------------------------------------------
function ImageShrinker() {
	
	var COMPRESSION_LEVEL = {
        'high': {w: 720, h: 720},
        'medium': {w: 1080, h: 1080},
        'low': {w: 1280, h: 1280}
    };
    var SHRINK_QUALITY = {low: 0.7, medium: 0.8, high: 0.9, uhigh: 1.0};

    this.getShrinkedFile = function(_file, fileExtn, onDone, bImg, compressionLevel) {
        try {
            _readAsDataUrl(_file, fileExtn, onDone, bImg, compressionLevel);
        } catch(e) {
            njs_helper.log('ImageShrinker - reader.readAsDataURL exception: ', e);
            compInfo.status = 'Compression failed: readAsDataURL error';
            onDone(null, compInfo);
        }
    };

    function _readAsDataUrl(_file, fileExtn, onDone, bImg, compressionLevel) {
        var shrinkSize = null;
        var compInfo = {compression: compressionLevel, origName: _file.name, origSize: _file.size};
        if (compressionLevel in COMPRESSION_LEVEL) {
            shrinkSize = COMPRESSION_LEVEL[compressionLevel];
        }
    	var reader = new FileReader();
        reader.onerror = function (e) {
        	njs_helper.log('ImageShrinker - FileReader onerror: ', e);
        	compInfo.status = 'Compression failed: FileReader error';
        	onDone(null, compInfo);
        };
        reader.onload = function (loadEvent) {
	        var origUrl = loadEvent.target.result;
	        if(!bImg || !shrinkSize) {
                compInfo.status = 'No compression done';
	        	onDone(_file, compInfo);
	        	return;
	        }
	        _shrinkImage(origUrl, shrinkSize, compInfo, function(shrinkedUrl) {
	            if (!shrinkedUrl) {
	                onDone(_file, compInfo);
	                return;
	            }
	            var newFileName = _file.name.replace(fileExtn, '.png');
		        var shrinkedFile = _dataUrlToImgFile(shrinkedUrl, newFileName);
                compInfo.compressedName = shrinkedFile.name;
                compInfo.compressedSize = shrinkedFile.size;
		        if (shrinkedFile.size > _file.size) {
                    compInfo.status = 'Compression not used as compressed size is larger';
                    onDone(_file, compInfo);
                    return;
		        }
                compInfo.status = 'Compression done';
			    onDone(shrinkedFile, compInfo);
	        });
        };
	    reader.readAsDataURL(_file);
	}
    
    function _shrinkImage(imgUrl, shrinkSize, compInfo, onDone) {
        var document = window.document;
        var img = document.createElement('img');
        img.onerror = function (e) {
        	njs_helper.log('ImageShrinker - Image load error: ', e);
            compInfo.status = 'Compression failed: Image load error';
        	onDone(null);
        };
        img.onload = function (data) {
	        var imgSize = _getNewImgSize(img, shrinkSize, compInfo);
            compInfo.compressedWidth = imgSize.w;
            compInfo.compressedHeight = imgSize.h;
	        var canvas = document.createElement('canvas');
	        canvas.width = imgSize.w;
	        canvas.height = imgSize.h;
	        var ctx = canvas.getContext('2d');
	        ctx.drawImage(img, 0, 0, imgSize.w, imgSize.h);
	        var shrinkedUrl = canvas.toDataURL('image/png');
	        if (!shrinkedUrl) compInfo.status = 'Compression failed: toDataURL error';
	        onDone(shrinkedUrl);
        };
        img.src = imgUrl;
    }

    function _getNewImgSize(img, shrinkSize, compInfo) {
        var ret = {w: img.width, h: img.height};
        compInfo.origWidth = ret.w;
        compInfo.origHeight = ret.h;
        if (ret.w <= shrinkSize.w && ret.h <= shrinkSize.h) return ret;
        
        if (ret.w > ret.h) {
            return {w: shrinkSize.w, h: ret.h*shrinkSize.w/ret.w};
        }
        return {w: ret.w*shrinkSize.h/ret.h, h: shrinkSize.h};
    }    

	function _dataUrlToImgFile(dataUrl, fileName) {
	    var BASE64_MARKER = ';base64,';
	    if (dataUrl.indexOf(BASE64_MARKER) == -1) {
	        var parts = dataUrl.split(',');
	        var contentType = parts[0].split(':')[1];
	        var raw = parts[1];
	        return new Blob([raw], {type: contentType});
	    }
	
	    var parts = dataUrl.split(BASE64_MARKER);
	    var contentType = parts[0].split(':')[1];
	    var raw = window.atob(parts[1]);
	    var rawLength = raw.length;
	    var uInt8Array = new Uint8Array(rawLength);
	    for (var i = 0; i < rawLength; ++i) {
	        uInt8Array[i] = raw.charCodeAt(i);
	    }
	    return new File([uInt8Array], fileName, {type: contentType});
	}
}

//---------------------------------------------------------------------------------------
// Static method	
//---------------------------------------------------------------------------------------
AddResourceDlg.uploadResource = function(resInfo, onUploadedFn) {
	var chain = new njs_helper.AsyncFunctionChain(function(errorMessage) {
		cancelButton={id: 'close', text: 'Close', fn: function(){
			njs_helper.Dialog.popdown();
			onUploadedFn('');
		}};
		njs_helper.Dialog.popup('Error', errorMessage, cancelButton=cancelButton);
	});
	var dlg = new njs_helper.AddResourceDlg(chain, resInfo);
	chain.add(function() {
		dlg.upload();
	});
	chain.add(function() {
		onUploadedFn(chain.getLastResult());
		chain.done();
	});
};

//-------------------------------------------------------------------------------------------
// TextEditorDlg - Popup a text editor
//-------------------------------------------------------------------------------------------
function TextEditorDlg(inputChain, content) {

	//---------------------------------------------------------------------------------------
	// Constructor code (part 1)
	//---------------------------------------------------------------------------------------
	Dialog.moveBack();
	
	//---------------------------------------------------------------------------------------
	// Private members
	//---------------------------------------------------------------------------------------
	var _chain = (inputChain !== undefined) ? inputChain : new AsyncFunctionChain();
	var _template = new ClientSideTemplate('text_editor_dialog.html', _chain);
	var _dlg = new njs_helper.Dialog();
	var _textField = null;

	//---------------------------------------------------------------------------------------
	// Constructor code
	//---------------------------------------------------------------------------------------
	_chain.add(function() {
		var staticResFolder = nittio.getStaticResFolder();
		_template.render({staticResFolder: staticResFolder});
	});
	_chain.add(function() {
		var dlgFields = jQuery(_chain.getLastResult());
		var doneButton = {id: 'done', text: 'Done', fn: _on_textEditor_done};
		var cancelButton = {id: 'cancel', text: 'Cancel', fn: _on_textEditor_cancel};
		_dlg.create('textEditor', dlgFields, [doneButton], cancelButton);
		
		// Setup toolbar icon functions:
		_textField = jQuery('#textEditor_edit');
		_textField.val(content);
		var insertResourceIcon = jQuery('#textEditor_tool_addres');
		insertResourceIcon.click(_onInsertIcon);
		_chain.done();
	});
	
	//---------------------------------------------------------------------------------------
	// Public methods
	//---------------------------------------------------------------------------------------
	// show has to be called inside a chain
	this.show = function() {
		_dlg.show();
		_textField.focus();
		_bindHotkeys();
		// _chain.done(); not needed here. Will be done when the dialog box closes
	};

	//---------------------------------------------------------------------------------------
	// Private methods
	//---------------------------------------------------------------------------------------
	function _onInsertIcon() {
		njs_helper.AddResourceDlg.uploadResource(null, function(resUrl) {
			if (resUrl !== '') _textField.val(_textField.val() + '\r\n' + resUrl);
			_textField.focus();
		});
	}

	function _on_textEditor_cancel() {
		_unbindHotkeys();
		_dlg.cancel(function() {
			_dlg.remove();
			_chain.done(content);
		});
	}

	function _on_textEditor_done() {
		_unbindHotkeys();
		_dlg.close(function() {
			_dlg.remove();
			_chain.done(_textField.val());
		});
	}
	
	function _bindHotkeys() {
		nittio.bindHotkey('body', 'textEditor', 'Ctrl+i', _onInsertIcon);
	}

	function _unbindHotkeys() {
		nittio.unbindHotkeys('body', 'textEditor');
	}
}

//---------------------------------------------------------------------------------------
// Static method	
//---------------------------------------------------------------------------------------
TextEditorDlg.show = function(content, onDoneFn) {
	var chain = new njs_helper.AsyncFunctionChain(function(errorMessage) {
		cancelButton={id: 'close', text: 'Close', fn: function(){
			njs_helper.Dialog.popdown();
			onDoneFn(content);
		}};
		njs_helper.Dialog.popup('Error', errorMessage, cancelButton=cancelButton);
	});
	var dlg = new njs_helper.TextEditorDlg(chain, content);
	chain.add(function() {
		dlg.show();
	});
	chain.add(function() {
		onDoneFn(chain.getLastResult());
		chain.done();
	});
};

//-------------------------------------------------------------------------------------------
// LoginDlg - Popup a login dialog box
//-------------------------------------------------------------------------------------------
function LoginDlg(inputChain, titleMsg) {

	//---------------------------------------------------------------------------------------
	// Constructor code (part 1)
	//---------------------------------------------------------------------------------------
	if (titleMsg === undefined) titleMsg = 'Please sign in to perform this operation';
	
	//---------------------------------------------------------------------------------------
	// Private members
	//---------------------------------------------------------------------------------------
	var _chain = inputChain;
	var _template = new ClientSideTemplate('login_dialog.html', _chain);
	var _dlg = new njs_helper.Dialog();
	var _uidField = null;
	var _pwdField = null;
	var _rememberField = null;
	var _restoreBlankScreen = njs_helper.BlankScreen.isVisible();

	//---------------------------------------------------------------------------------------
	// Constructor code
	//---------------------------------------------------------------------------------------
	_chain.add(function() {
		var staticResFolder = nittio.getStaticResFolder();
		_template.render({staticResFolder: staticResFolder, titleMsg: titleMsg});
		// _chain.done(); not needed here. Will be done when template is rendered
	});
	_chain.add(function() {
		var dlgFields = jQuery(_chain.getLastResult());
		var loginButton = {id: 'login', text: 'Sign in', fn: _onLogin};
		var cancelButton = {id: 'cancel', text: 'Cancel', fn: _onCancel};
		_dlg.create('loginDlg', dlgFields, [loginButton], cancelButton);
		var dlgObj = _dlg.getDlgObj();
		_uidField = dlgObj.find('#loginDialogUid');
		_pwdField = dlgObj.find('#loginDialogPwd');
		_rememberField = dlgObj.find('#loginDialogRemember');
		_dlg.onShowDone(function() {
			var username = nittio.getUsername();
			if (username != '') {
				_uidField.val(username);
				_pwdField.focus();
			} else {
				_uidField.focus();
			}
		});
		_chain.done();
	});
	
	//---------------------------------------------------------------------------------------
	// Public methods
	//---------------------------------------------------------------------------------------
	// show has to be called inside a chain
	this.show = function() {
		_dlg.show();
		// _chain.done(); not needed here. Will be done when the dialog box closes
	};

	// loginAjax has to be called inside a chain
	this.loginAjax = function() {
		var ajax = new njs_helper.AjaxInChain(_chain, false);
		var params = _chain.getLastResult();
		ajax.send('/auth/login_ajax.json/', params);
		// _chain.done(); not needed here. Will be done when the send completes
	};

	//---------------------------------------------------------------------------------------
	// Private methods
	//---------------------------------------------------------------------------------------
	function _onCancel() {
		_dlg.cancel(function() {
			_dlg.remove();
			if (_restoreBlankScreen) njs_helper.Dialog.moveBack();
			_chain.error('Login cancelled');
		});
	}

	function _onLogin() {
		var uid = _uidField.val();
		var pwd = _pwdField.val();
		var remember = _rememberField[0].checked ? 1 : 0;
		_dlg.close(function() {
			_dlg.remove();
			if (_restoreBlankScreen) njs_helper.Dialog.moveBack();
			_chain.done({uid:uid, pwd:pwd, remember:remember});
		});
	}
}

//-------------------------------------------------------------------------------------------
// Assignment helpers
//-------------------------------------------------------------------------------------------
var assignHelpers = {
	onDelete: function(assignId) {
		nittio.closePopupsAndDlgs('');
		var msg  = 'Deleting an assignment will delete all reports behind this assignment. This cannot be undone. Are you sure you want to delete?';
		var delButton = {id: 'delete', text: 'Delete', fn: function() {
			assignHelpers.onDeleteConfirm(assignId);
		}};
		njs_helper.Dialog.popup('Please confirm', msg, [delButton]);
	},

	onDeleteConfirm: function(assignId) {
		var ajaxPath = '/assignment/delete.json/' + assignId;

		var _ajax = new njs_helper.Ajax(function(data, errorType, errorMsg) {
			if (errorType != njs_helper.Ajax.ERROR_NONE) return;
			njs_helper.Dialog.popupStatus('Assignment deleted', function() {
				nittio.redir("self");
			});
		});
		_ajax.send(ajaxPath, {});
	},

	onPublish: function(assignId) {
		nittio.closePopupsAndDlgs('');
		var msg  = 'Publishing an assignment publishes the assignment reports to the respective learners. This cannot be undone. Are you sure you want to publish?';
		var pubButton = {id: 'publish', text: 'Publish', fn: function() {
			assignHelpers.onPublishConfirm(assignId);
		}};
		njs_helper.Dialog.popup('Please confirm', msg, [pubButton]);
	},

	onPublishConfirm: function(assignId) {
		var ajaxPath = '/assignment/publish.json/' + assignId;
		var _ajax = new njs_helper.Ajax(function(data, errorType, errorMsg) {
			if (errorType != njs_helper.Ajax.ERROR_NONE) return;
			njs_helper.Dialog.popupStatus('Assignment reports published', function() {
				nittio.redir("self");
			});
		});
		_ajax.send(ajaxPath, {});
	},

	onExport: function(assignId) {
		var d = new Date();
		var redirUrl = fmt2('/assignment/export/{}/{}', assignId, d.getTimezoneOffset());
		nittio.redir(redirUrl);
	}		
};

//-------------------------------------------------------------------------------------------
// Exposed methods
//-------------------------------------------------------------------------------------------
return {
	fmt1: fmt1,
	fmt2: fmt2,
	escape: escape,
	jobj: jobj,
	log_init: log_init,
	log: log,
	copyToClipboard: copyToClipboard,
	stopPropagation: stopPropagation,
	valignMiddle: valignMiddle,
	findMinFontSizeOfGroup: findMinFontSizeOfGroup,
	resizeText: resizeText,
	clearTextResizing: clearTextResizing,
	randSet: randSet,
	switchoffContenxtMenu: switchoffContenxtMenu,
	AsyncFunctionChain: AsyncFunctionChain,
	Ajax: Ajax,
	AjaxInChain: AjaxInChain,
	SyncManager: SyncManager,
	ClientSideTemplate: ClientSideTemplate,
	BlankScreen: BlankScreen,
	Dialog: Dialog,
	AddResourceDlg: AddResourceDlg,
	TextEditorDlg: TextEditorDlg,
	LoginDlg: LoginDlg,
	assignHelpers: assignHelpers,
	dialogPopup:dialogPopup
};

}();
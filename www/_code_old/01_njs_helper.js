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
var g_serverLog = null;
function log_init(bEnable) {
	g_logEnabled = (bEnable && window.console && window.console.log) ? true : false;
	// TODO - uncomment below line when you have a tricky client side issue
	// g_serverLog = new ServerLog();
}

function log() {
    if (g_serverLog) g_serverLog.log(arguments);
	if (!g_logEnabled) return;
	console.log(arguments);
}

function ServerLog() {
    msgs = [];

    this.log = function(args) {
        var msg = {msg:_fmtArray(args, false), ts: (new Date()).toString()};
        msgs.push(msg);
    };
    
    setInterval(_timerFn, 1000);
    function _timerFn() {
        if (msgs.length == 0) return;
        var localMsgs = [];
        while (msgs.length > 0) {
            localMsgs.push(msgs.shift());
        }
        
        var _ajax = new njs_helper.Ajax(function(result) {
        }, false, false);
        var logInfo = {username: _pageParams.username};
        _ajax.send('/default/client_log_data.json', {
            loginfo: JSON.stringify(logInfo),
            logdata: JSON.stringify(localMsgs)
        });

        for(var i=0; i<localMsgs.length; i++) {
            var m = localMsgs[i];
            console.log(m.ts, m.msg);
        }
    }
    
    function _fmtObj(obj) {
        if (obj.constructor === Array) return _fmtArray(obj);
        if (obj !== null && typeof obj === 'object') return _fmtDict(obj);
        return obj.toString();
    }

    function _fmtArray(obj, bBraces) {
        if (bBraces === undefined) bBraces = true;
        var msg = bBraces ? '[' : '';
        for (var i=0; i<obj.length; i++) {
            var delim = (i == obj.length-1) ? '' : ', ';
            msg += _fmtObj(obj[i]) + delim;
        }
        return msg + (bBraces ? ']' : '');
    }
    
    function _fmtDict(obj) {
        var msg = '{';
        var keys = Object.keys(obj);
        for (var i=0; i<keys.length; i++) {
            var delim = (i == keys.length-1) ? '' : ', ';
            var key = keys[i];
            msg += key + ':' + _fmtObj(obj[key]) + delim;
        }
        return msg + '}';
    }

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
function valignMiddleAndSetScroll(section, valignMiddle, isTxt) {
    var outerHeight = section.pgSecView.innerHeight();
    section.secViewContent.css({height: 'auto'});
    var innerHeight = section.secViewContent.innerHeight();
    var heightDiff = Math.round((outerHeight - innerHeight) / 2);

    var overflow = heightDiff < -2 && isTxt ? 'scroll' : 'visible';
    section.pgSecView.css('overflow-y', overflow);
    
    var cssProp  = {};
    cssProp.top = (valignMiddle && overflow != 'scroll') ? heightDiff : 0;
    cssProp.height = (cssProp.top == 0 && overflow != 'scroll') ? '100%' : 'auto';
    cssProp.position = (section.secViewContent.find('.njs_pdf_holder').length > 0) ? 'static' : 'absolute';
    section.secViewContent.css(cssProp);
}

var ERROR_MARGIN = 3; // Number of pixel error margin
function findMinFontSizeOfGroup(section, textSizes, fmtgroup, minTextSize) {
	var maxSize=(fmtgroup in textSizes) ? textSizes[fmtgroup] : 100;
	var fitChecker = new TextFitmentChecker(section);
	var textSize = fitChecker.findBestFit(minTextSize, maxSize);
	textSizes[fmtgroup] = textSize;
	fitChecker.cleanup();
} 

function resizeText(section, textSize, minTextSize) {
	var fsz = '' + textSize + '%';
	if (textSize <= minTextSize) {
		var fitChecker = new TextFitmentChecker(section);
		if (!fitChecker.doesItFit(textSize)) {
			section.valignMiddle = false;
		}
        fitChecker.cleanup();
	}
	section.secViewContent.find('.inline_obj').each(function() {
		section.valignMiddle = false;
	});
	section.secViewContent.css({'font-size': fsz});
}

function clearTextResizing(section) {
	section.secViewContent.css({'font-size': '100%'});
} 

function TextFitmentChecker(section) {
	// Constructor
	var hOrig = section.pgSecView.height();
	var wOrig = section.pgSecView.width();

	// Public Methods
	this.doesItFit = function(textSize) {
		var fsz = '' + textSize + '%';
		section.secViewContent.css({'font-size': fsz, 'height': 'auto'});
		var hNew = section.secViewContent.outerHeight();
		if (hNew > hOrig) return false;
		
		var wNew = _getChildMaxWidth(section.secViewContent);
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
    };
    
	// Private Methods
	var _getChildMaxWidth = function(obj) {
		var maxWidth = 0;
		obj.find('*').each(function() {
			if (jQuery(this).hasClass('not_inside')) return;
			var w = jQuery(this).outerWidth();
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
	var AJAX_TIMEOUT = 3*60*1000; // 3 mins timeout
	this.send = function(url, params, contentType, processData, onProgress) {
	    var ajaxRequestType = params._ajaxRequestType || "POST";
        if (params._ajaxRequestType) delete params._ajaxRequestType;
		var ajaxParams = {type : ajaxRequestType, url : url, data : params, async : true};
		if (contentType !== undefined) ajaxParams.contentType = contentType;
		if (processData !== undefined) ajaxParams.processData = processData;
		if (onProgress !== undefined) ajaxParams.xhrFields = {onprogress: onProgress};
		ajaxParams.timeout = AJAX_TIMEOUT;

		var self = this;
		ajaxParams.success = function(data, textStatus, jqXHR) {
		    if (typeof data === 'string' || data instanceof String) data = jQuery.parseJSON(data);
			if ('NOT_LOGGED_IN' in data) {
				if (retryAfterLogin) {
					var url = '/#/login_now';
					var msg='<b>You are not logged in. </b> ';
					msg += njs_helper.fmt2('<a href="{}" target="_blank"><b>Click here</b></a>', url);
					msg += ' to login in a new tab. Once logged in from another tab, you could come back to this tab to continue operations.';
					cbInternal(null, Ajax.ERROR_LOGIN, msg);
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
function SyncManager_postToServer(ajaxUrl, ajaxParams, bReplace, backgroundTask, onCompleteFn) {
	var req = {ajaxUrl:ajaxUrl, ajaxParams:ajaxParams, 
	           backgroundTask: backgroundTask, onCompleteFn:onCompleteFn};
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
	self.error = false;
}

function _SyncManager_doNext(self) {
	if (self.syncInProgress) return;
	if (self.pendingRequests.length == 0) {
		var msg = self.error ? 'Failure during save' : 'Saved';
		self.error = false;
		njs_helper.Dialog.popupStatus(msg);
		return;
	}

	njs_helper.Dialog.popupStatus('Saving data to the server ...', false);
	self.syncInProgress = true;
	self.error = false;
	
	var currentReq = self.pendingRequests.shift();
	var cb = function(data, errorType, errorMsg) {
		if (errorType == njs_helper.Ajax.ERROR_NONE) {
			return _SyncManager_doNextOnComplete(self, currentReq, data, false);
		}
		if (currentReq.backgroundTask) {
		    // No retry or error window for background tasks
            return _SyncManager_doNextOnComplete(self, currentReq, null, true);
		}
		var cancelButton = {id: 'cancel', text: 'Close', fn: function() {
			njs_helper.Dialog.popdown();
			_SyncManager_doNextOnComplete(self, currentReq, null, true);
		}};
		var retryButton = {id: 'retry', text: 'Retry', fn: function() {
			njs_helper.Dialog.popdown();
			self.pendingRequests.unshift(currentReq); // add to top of queue
			_SyncManager_doNextOnComplete(self, null, null, false);
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

function _SyncManager_doNextOnComplete(self, currentReq, data, isError) {
    self.error = isError;
    if (currentReq) currentReq.onCompleteFn(data, isError);
    self.syncInProgress = false;
	_SyncManager_doNext(self);
	return true;
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
		var params = {};
		if (njs_scorm.nlPlayerType() == 'sco') {
		    var tname = templateName.split('.')[0];
            url = fmt2('res/static/html/{}.json', tname);
            params._ajaxRequestType = "GET";
		}
		ajax.send(url, params);
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

BlankScreen.ANIM_TIME = 300;
BlankScreen._isShown = false;

BlankScreen.isVisible = function() {
	return BlankScreen._isShown;
};

BlankScreen.showAndExec = function(fn) {
    var nl = window.nlapp.nl;
    var nlDlg = window.nlapp.nlDlg;
    nl.rootScope.$apply(function() {
        nlDlg.showLoadingScreen();
    });
    nl.timeout(fn);
};

BlankScreen.show = function() {
	if (BlankScreen._isShown) return;
	BlankScreen._isShown = true;
    var nl = window.nlapp.nl;
    var nlDlg = window.nlapp.nlDlg;
    nl.rootScope.$apply(function() {
        nlDlg.showLoadingScreen();
    });
};

BlankScreen.hide = function() {
	if (!BlankScreen._isShown) return;
	BlankScreen._isShown = false;
    var nl = window.nlapp.nl;
    var nlDlg = window.nlapp.nlDlg;
    nl.rootScope.$apply(function() {
        nlDlg.hideLoadingScreen();
    });
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

    this.addClass = function(cls) {
        var dlg = _dlgObj();
        dlg.addClass(cls);
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
		var buttons = jQuery('<nav class="nl-dlg-title-buttons nl-white-icons"></nav>');
		title.append(buttons);
		
		var closeButton = jQuery('<i class="ion-ios-close-outline"></i>');
		closeButton.on('click', cancelFn);
		closeButton.attr('id', njs_helper.fmt2('{}_top_close_button', _dlgId));
		buttons.append(closeButton);
		
		// Add help button if help is available
		var help = _dlgGetHelp(dlgFields);
		if (help == '') return title;
		
		var helpButton = jQuery(njs_helper.fmt2(
		    "<i class='ion-ios-help-outline' onclick=\"nittio.toggleElem('#{}_help');\"/></i>", 
		    _dlgId));
		buttons.prepend(helpButton);

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

Dialog.popupStatus = function(msg, popdownTime) {
	Dialog.popupStatus2({msg: msg, popdownTime: popdownTime});
};

Dialog.popupStatus2 = function(params) {
    var nl = window.nlapp.nl;
    var nlDlg = window.nlapp.nlDlg;
    nl.timeout(function() {
        nlDlg.popupStatus2(params);
    });
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
// Exposed methods
//-------------------------------------------------------------------------------------------
return {
    CONSTANTS: CONSTANTS,
	fmt1: fmt1,
	fmt2: fmt2,
	escape: escape,
	jobj: jobj,
	log_init: log_init,
	log: log,
	copyToClipboard: copyToClipboard,
	stopPropagation: stopPropagation,
    valignMiddleAndSetScroll: valignMiddleAndSetScroll,
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
	LoginDlg: LoginDlg,
	dialogPopup:dialogPopup
};

}();
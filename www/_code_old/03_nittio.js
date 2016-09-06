/**
 * Basic nittio js utilities
 * -------------------------
 * 1. Blank Screen - show and hide
 * 2. Footer drawer for social drawers
 * 3. Dialog boxes
 * 4. Status and Warning message boxes
 * 5. redirect helpers
 *
 * 5. Popup menu
 * 6. Dirty/save realted methods
 *
 * Conventions used:
 * -----------------
 * 1. Implements the yahoo module pattern to minimize pollution of namespace
 *    all variables/functions exposed out of this .js file are available under
 *    namespace "nittio".
 * 2. All functions exposesed out of the module are accessible by nittio.xxx
 *    (see the list of exposed symbols at the end of the file)
 **/
nittio = function() {

	//-----------------------------------------------------------------------------
	// General utilities
	//-----------------------------------------------------------------------------

	// input is UTC json string from server side; output is local string formating of date
	function dateToString(dateStr) {
		// Convert date to iso 8061 format if needed (e.g. "2014-04-28 23:09:00" ==> "2014-04-28T23:09:00Z")
		if(dateStr.indexOf('Z')==-1) dateStr=dateStr.replace(' ','T')+'Z';
		var d = new Date(dateStr);
		if (isNaN(d.valueOf())) return dateStr;
	 	return njs_helper.fmt2('{}-{}-{} {}:{} Hrs', d.getFullYear(), _pad2(d.getMonth()+1), _pad2(d.getDate()), 
	 				_pad2(d.getHours()), _pad2(d.getMinutes()));
	}
	
	function _fmtMinutes(min) {
		var hr = parseInt(min/60);
		min -= hr*60;
		var day = parseInt(hr/24);
		hr -= day*24;
		var ret = '';
		if (day > 0) ret += _fmtTime(day, 'day') + ' ';
		if (hr > 0) ret += _fmtTime(hr, 'hour') + ' ';
		if (min > 0 || ret=='') ret += _fmtTime(min, 'minute');
		return ret;
	}

	function _fmtTime(num, unit) {
		if (num == 0) return '';
		if (num > 1) unit += 's';
		return njs_helper.fmt2('{} {}', num, unit);
	}
	
	
	function _pad2(num) {
		var s = "00" + num;
		return s.substr(s.length-2);
	}
	
	function convertDates() {
		jQuery('.njsDateConvert').each(function () {
			var me = jQuery(this);
			me.html(dateToString(me.html()));
		});
	}
	
	function secondsToHmsString(seconds) {
	    var hours   = Math.floor(seconds/3600);
	    seconds -= hours*3600;
	    var minutes = Math.floor(seconds/60);
	    seconds -= minutes*60;
	
	    if (hours   < 10) {hours   = "0"+hours;}
	    if (minutes < 10) {minutes = "0"+minutes;}
	    if (seconds < 10) {seconds = "0"+seconds;}
	    return hours + ':' + minutes + ':' + seconds;
	}	

	function areArraysEqual(array1, array2, arrayElementCompareFunction) {
		if (array1.length != array2.length) return false;
		for(var i=0; i<array1.length; i++) {
			if (!arrayElementCompareFunction(array1[i], array2[i])) return false;
		}
		return true;
	}

	//-----------------------------------------------------------------------------
	// DateTimePicker
	//
	// There are many variants of Bootstrap-datetimepicker. The one used here is
	// http://tarruda.github.io/bootstrap-datetimepicker/
	//-----------------------------------------------------------------------------
	function DateTimePicker(args) {
		this.validate = DateTimePickerMethods.validate;
		this.getDateJson = DateTimePickerMethods.getDateJson;
		
		this.params = {from: null, till: null, defFrom: null, defTill: null, pickTime: true, minDate: null, maxDate: null};
		DateTimePickerMethods.createFromAndTill(this.params, args);
	}

	var DateTimePickerMethods = {
		
		/*
		 * defFrom, defTill, minDate and maxDate can be either a number or Date object. If number is provided, 
		 * current date + or - that number of days is used.
		 */
		createFromAndTill: function(params, args) {
			jQuery.extend(params, args);
			params.minDate = DateTimePickerMethods.adustDateIfNeeded(params.minDate, params.pickTime);
			params.defFrom = DateTimePickerMethods.adustDateIfNeeded(params.defFrom, params.pickTime);
			params.defTill = DateTimePickerMethods.adustDateIfNeeded(params.defTill, params.pickTime);
			params.maxDate = DateTimePickerMethods.adustDateIfNeeded(params.maxDate, params.pickTime);
	
			var from = jQuery(params.from);
			var till = jQuery(params.till);
			DateTimePickerMethods.createDateTimePicker(from, params.defFrom, params);
			DateTimePickerMethods.createDateTimePicker(till, params.defTill, params);
		},
		
		adustDateIfNeeded: function(inputDate, pickTime) {
			if (inputDate == null || inputDate.constructor !== Number) return inputDate;
			var ret = new Date();
			ret.setDate(ret.getDate() + inputDate);
			if (pickTime) {
				ret.setSeconds(0, 0);
			} else {
				ret.setHours(0, 0, 0, 0);
			}
			return ret;
		},
		
		createDateTimePicker: function(obj, defaultDate, params) {
			var templ = '<INPUT data-format="{}" type="text"></INPUT><SPAN class="add-on"><I data-time-icon="icon-time" data-date-icon="icon-calendar"></I></SPAN>';
			var dateFmt = params.pickTime ? 'yyyy-MM-dd hh:mm' : 'yyyy-MM-dd';
			obj.html(njs_helper.fmt2(templ, dateFmt));
			obj.addClass('input-append');
			obj.addClass('date');
			obj.datetimepicker({language: 'en', pickTime: params.pickTime, maskInput: false, pickSeconds: false, 
								startDate: params.minDate, endDate: params.maxDate, pick12HourFormat: false});
			var elem = obj.data('datetimepicker');
			elem.setLocalDate(defaultDate);
		},

		validate: function(args) {
			/*
			 * minDelta and maxDelta are in minutes
			 */
			var params = {fromMand: false, tillMand: false, minDelta: null, maxDelta: null};
			jQuery.extend(params, args);

			DateTimePickerMethods.resetTimePart(this.params.from, this.params.pickTime);
			DateTimePickerMethods.resetTimePart(this.params.till, this.params.pickTime);

			var fromDate = DateTimePickerMethods.getDate(this.params.from);
			var tillDate = DateTimePickerMethods.getDate(this.params.till);
			if (params.fromMand && fromDate == null) {
				jQuery(this.params.from).focus();
				alert('Start date/time is mandatory');
				return false;
			}
			if (params.tillMand && tillDate == null) {
				jQuery(this.params.till).focus();
				alert('End date/time is mandatory');
				return false;
			}

			if (this.params.minDate != null) {
				if (fromDate != null && fromDate < this.params.minDate) {
					jQuery(this.params.from).focus();
					alert(njs_helper.fmt2('Start date/time is before earliest allowed date: {}', this.params.minDate));
					return false;
				}
				if (tillDate != null && tillDate < this.params.minDate) {
					jQuery(this.params.till).focus();
					alert(njs_helper.fmt2('End date/time is before earliest allowed date: {}', this.params.minDate));
					return false;
				}
			}
			if (this.params.maxDate != null) {
				if (fromDate != null && fromDate > this.params.maxDate) {
					jQuery(this.params.from).focus();
					alert(njs_helper.fmt2('Start date/time is after latest allowed date: {}', this.params.maxDate));
					return false;
				}
				if (tillDate != null && tillDate > this.params.maxDate) {
					jQuery(this.params.till).focus();
					alert(njs_helper.fmt2('End date/time is after latest allowed date: {}', this.params.maxDate));
					return false;
				}
			}
			
			if (fromDate == null || tillDate == null) return true;
			if (tillDate < fromDate) {
				jQuery(this.params.till).focus();
				alert('End date/time should not be before start date/time');
				return false;
			}
			
			var minDelta = params.minDelta != null ? params.minDelta*1000*60 : null;
			var maxDelta = params.maxDelta != null ? params.maxDelta*1000*60 : null;
			var delta = tillDate - fromDate;
			if (minDelta != null && delta < minDelta) {
				jQuery(this.params.till).focus();
				alert(njs_helper.fmt2('End date/time should be atleast {} more than start date/time', _fmtMinutes(params.minDelta)));
				return false;
			}
			if (maxDelta != null && delta > maxDelta) {
				jQuery(this.params.till).focus();
				alert(njs_helper.fmt2('End date/time should be within {} from start date/time', _fmtMinutes(params.maxDelta)));
				return false;
			}
			return true;
		},

		getDateJson: function(name) {
			var d = DateTimePickerMethods.getDate(name);
			if (d == null) return '';
			return njs_helper.fmt2('{}-{}-{} {}:{}:{}', d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
		},

		getDate: function(name) {
			return jQuery(name).data('datetimepicker').getLocalDate();
		},

		setDate: function(name, val) {
			jQuery(name).data('datetimepicker').setLocalDate(val);
		},
		
		resetTimePart: function(name, pickTime) {
			var d = DateTimePickerMethods.getDate(name);
			if (d == null) return;
			if (pickTime) {
				d.setSeconds(0, 0);
			} else {
				d.setHours(0, 0, 0, 0);
			}
			DateTimePickerMethods.setDate(name, d);
		}

	};

	//-----------------------------------------------------------------------------
	// Footer Drawers implementation is removed. If needed take from "share.js" 
	// or code see version 331
	//-----------------------------------------------------------------------------

	//-----------------------------------------------------------------------------
	// Button state management
	//-----------------------------------------------------------------------------
	var g_buttonStates = {};
	function enableButton(buttonId, state) {
		var button = jQuery('#' + buttonId);
		if (state) {
			button.css({opacity:1, cursor:'pointer'});
		} else {
			button.css({opacity:0.4, cursor:'default'});
		}
		g_buttonStates[buttonId] = state;
	}
	
	function isButtonEnabled(buttonId) {
		return (buttonId in g_buttonStates) ? g_buttonStates[buttonId] : false;
	}
		
	//-----------------------------------------------------------------------------
	// Quick links and help
	//-----------------------------------------------------------------------------
	var _moreviewDlg = new njs_helper.Dialog();
	var _logviewDlg = new njs_helper.Dialog();
	var _bShowLogview = false;

	function _initMoreAndLogView() {
		_moreviewDlg.create('moreview', jQuery('#moreview').remove(), []);

		var logview = jQuery('#logview').remove();
		var logListJson = jQuery('#logData').val();
		var logList = jQuery.parseJSON(logListJson);
		for(var i=0; i<logList.length; i++) {
			_bShowLogview = true;
			logview.append(jQuery(njs_helper.fmt2('<div>{}</div>', logList[i])));
		}
		_logviewDlg.create('logview', logview, []);
	}
	
	//-----------------------------------------------------------------------------
	// ToggleMenu
	//-----------------------------------------------------------------------------
	var lastPopup = '';
	function toggleElem(menuName) {
		var menuObj = jQuery(menuName);
		if (!menuObj.is(':visible')) {
			lastPopup = menuObj;
		}
	}
	
	//-----------------------------------------------------------------------------
	// Right Click Menu
	//-----------------------------------------------------------------------------
	function hidePopups() {
		var bRet = false;
		jQuery('.njspopup').each(function() {
			if (jQuery(this).is(':visible')) bRet = true;
			jQuery(this).hide();
		});

		if (lastPopup != '') {
			lastPopup.toggle('fast');
			lastPopup = '';
		}
		return bRet;
	}
	
	//-----------------------------------------------------------------------------
	// Keyboard bindings
	//-----------------------------------------------------------------------------
	function bindHotkey(bindOn, bindFilter, hotkey, hotkeyFn, propogate) {
		if ( typeof propogate !== "boolean") propogate = false;
		
		jQuery(bindOn).bind(_getKeyEvent(bindFilter), hotkey, function(event) { 
			if (!propogate) event.preventDefault();
			setTimeout(function() {
				hotkeyFn(event);
			}, 0); // Needed because of a firefox bug
			return propogate;
		});
	}

	function unbindHotkeys(bindOn, bindFilter) {
		jQuery(bindOn).unbind(_getKeyEvent(bindFilter)); 
	}

	function _getKeyEvent(bindFilter) {
		var event = 'keydown';
		if (bindFilter != '') {
			event += '.' + bindFilter;
		}
		return event;
	}
	
	//-----------------------------------------------------------------------------
	// Keyboard functions
	//-----------------------------------------------------------------------------
	function onHome() {
		return nittio.redir('/');
	}
	
	function onHelp() {
		return nittio.redir('/info/training');
	}
			
	function initMenus() {
		jQuery('body').click(function(e) {
			hidePopups();
		});
		bindHotkey('body', '', 'esc', function(e) {
			closePopupsAndDlgs(e);
		}, true);
	}

	function closePopupsAndDlgs(event) {
		var ret = __closePopupsAndDlgsImpl(event);
		if (ret > 0) njs_helper.stopPropagation(event);
	}
	
	function __closePopupsAndDlgsImpl(event) {
		if (hidePopups()) return 1;
		if (hideBox('#statusBox', event)) return 2;
		if (njs_helper.Dialog.cancelActive(event)) return 3;
		if (callOnEscapeHandlers(event)) return 4;
		return 0;
	}

	function hideBox(boxname, event) {
		var box = jQuery(boxname);
		if (!box.is(':visible')) {
			return false;
		}
		box.hide();
		return true;
	}
		
	//-----------------------------------------------------------------------------
	// Own redirect
	//-----------------------------------------------------------------------------
	var g_onLeaveCheck = false;
	function setOnLeaveCheck(bCheck) {
		g_onLeaveCheck = bCheck;
	}

	function getOnLeaveCheck() {
		return g_onLeaveCheck;
	}

	function redirDelay(nextUrl, delay, disableLeaveCheck) {
		var bSelf = false;
		if (nextUrl == 'self') {
			nextUrl = window.location.href;
			bSelf = true;
		} else if (nextUrl == 'self_first_page') { // reload works only on timeout
			var myUrl = window.location.href;
			var hashPos = myUrl.lastIndexOf('#');
			nextUrl = hashPos >=0 ? myUrl.substring(0, hashPos+2) : myUrl;
			window.location.href = nextUrl; // Go to start page now!. Will reload on timeout
			bSelf = true;
		}
		if (disableLeaveCheck) {
			setOnLeaveCheck(false);
		}
		if (delay <= 0) {
			redirDelayImpl(nextUrl, bSelf);
		} else {
			window.setTimeout(function() {
				redirDelayImpl(nextUrl, bSelf);
			}, delay);
		}
		return true;
	}
	
	function redirLink(url, text) {
	    return njs_helper.fmt2("<SPAN onclick='return nittio.redirDelay(\"{}\");' class='njsLink'>{}</SPAN>", url, text);
	}
	
	function redirDelayImpl(nextUrl, bSelf) {
		if (bSelf) {
			window.location.reload(true);				
		} else {
			window.location.href = nextUrl;
		}
	}

	function redir(nextUrl) {
		return redirDelay(nextUrl, 0, false);
	}
	
	function redirConfirm(nextUrl, confirmMsg) {
		if (confirmMsg != '' && !confirm(confirmMsg)) {
			return false;
		}
		return redirDelay(nextUrl, 0, false);
	}

	//-----------------------------------------------------------------------------
	// Input field validators
	//-----------------------------------------------------------------------------
	function initValidators() {
		jQuery('input[type=number]').each(function() {
			var me = jQuery(this);
			me.blur(function() {
				validateNumberField(me);
			});
		});
	}
	
	function validateNumberField(me) {
		var val = parseInt(me.val());
		if (isNaN(val)) {
			me.val('');
			return;
		}
		var max = me.attr('max');
		var min = me.attr('min');
		if (max !== undefined && val > parseInt(max)) val = parseInt(max);
		if (min !== undefined && val < parseInt(min)) val = parseInt(min);
		me.val(val);
	}

	//-----------------------------------------------------------------------------
	// Rendering elements class njsPagedList in multiple pages
	//-----------------------------------------------------------------------------
	function renderPageLists() {
		jQuery('.njsPagedList').each(function() {
			renderAsPagedList(jQuery(this));
		});
	}

	function renderAsPagedList(listData) {
		var pagePos = 0;
		var iconDims = initIconDims(listData);
		var itemsPerRow = getItemsPerRow(listData);
		var itemsPerPage = itemsPerRow * getItemsRows(listData);

		var bgImg = listData.attr('njsbgimg');

		var sections = jQuery('<div class="njsSlides"></div>');
		var curSection;
		var curRow;
		listData.find('.njsPagedItem').each(function() {
			if (jQuery(this).hasClass('njsPagedItemDummy')) {
				return;
			}
			if (pagePos == 0) {
				var temp = jQuery('<section></section>');
				curSection = jQuery('<table></table>');
				temp.append(curSection);
				if (bgImg != '') {
					temp.append('<img class="bgimg" src="' + bgImg + '" />');
				}
				sections.append(temp);
			}
			if (pagePos % itemsPerRow == 0) {
				curRow = jQuery('<tr></tr>');
				curSection.append(curRow);
			}

			var pagedItem = jQuery(this).detach();
			pagedItem.find('.iconview').attr('style', iconDims);
			var curCell = jQuery('<td></td>');
			curCell.append(pagedItem);
			curRow.append(curCell);

			pagePos++;
			if (pagePos == itemsPerPage) {
				pagePos = 0;
			}
		});

		// Add empty elements to the end
		while (pagePos != 0) {
			if (pagePos % itemsPerRow == 0) {
				curRow = jQuery('<tr></tr>');
				curSection.append(curRow);
			}
			var curCell = jQuery('<td><div class="njsPagedItem njsPagedItemDummy"><div class="iconview dummy"></div></div></td>');
			curRow.append(curCell);
			pagePos++;
			if (pagePos == itemsPerPage) {
				pagePos = 0;
			}
		}

		listData.append(sections);
	}

	var pixelW = 320;
	var pixelH = 220;

	function initIconDims(container) {
		var iconW = 300;
		var iconH = 200;
		if (container.width() < iconW) {
			iconW = Math.floor(container.width()*0.95);
			iconH = Math.floor(iconW*2/3);
		}
		if (container.height() < iconH) {
			iconH = Math.floor(container.height()*0.95);
			iconW = Math.floor(iconH*3/2);
		}
		return njs_helper.fmt2("width: {}px; height: {}px;", iconW, iconH);			
	}

	function getItemsPerRow(container) {
		return Math.max(1, Math.floor(container.width() / pixelW));
	}

	function getItemsRows(container) {
		return Math.max(1, Math.floor(container.height() / pixelH));
	}

	function showMore(moreButton) {
		var moreData = moreButton.parents('.njsPagedItem').find('.moreview');
		jQuery('#moreview').html(moreData.html());
		jQuery('#moreview_title').html(moreData.attr('njsTitle'));
		_moreviewDlg.show();
	}

	function showLog() {
		if (_bShowLogview) _logviewDlg.show();
	}
	
	//-----------------------------------------------------------------------------
	// Readjust the overall area to have a standard aspect ratio in all browsers
	//-----------------------------------------------------------------------------
	function initSizes(retainAspect) {
		if (retainAspect == 0) {
			jQuery('.inner_body').css({left: '3%', right: '3%', top: '1%', bottom: '1%'});
			jQuery('body').css({opacity: 1});
			return;
		}
		var ar_req = retainAspect;

		var body = jQuery('.body');
		var wBody = body.width(); 
		var hBody = body.height();
		var widthMargin = 0;
		var bottomMargin = 0;
		var topMargin = 0;
		if (wBody > hBody*ar_req) {
			widthMargin = (wBody - hBody*ar_req)/2;
		} else {
			var heightMargin = (hBody - wBody/ar_req);
			topMargin = (heightMargin < 40) ? heightMargin : 40;
			bottomMargin = heightMargin - topMargin;
		}

		jQuery('.inner_body').css({left: widthMargin + 'px', right: widthMargin + 'px', top: topMargin + 'px', bottom: bottomMargin + 'px'});
		jQuery('.navigator').css({top: topMargin + 'px', bottom: bottomMargin + 'px'});
		jQuery('#pgNo').css({bottom: bottomMargin + 'px'});
		return;
	}

	function resizeImagesToAspectRatio(elem) {
		if (elem.hasClass('aspect_wrt')) _cleanupBackgroundAndStyling(elem);
		elem.find('.aspect_wrt').each(function() {
			_cleanupBackgroundAndStyling(jQuery(this));
		});
		elem.find('img.retain_aspect_ratio').each(function() {
			var imgObj = jQuery(this);
			var parent = imgObj.parents('.aspect_wrt');
			var imgUrl = imgObj.attr('src');
			if (imgUrl === undefined || imgUrl === null || imgUrl === '') return;
			if (!imgUrl.match('%')) imgUrl = encodeURI(imgUrl); // Encode only if not already encoded
			parent.css({'background-image': 'url("' + imgUrl + '")'});
			var parentLink = imgObj.parents('A');
			if (parentLink.length == 1) {
				parent.addClass('aspect_wrt_with_imglink');
			}
			imgObj.hide();
		});
		
		// Resize Videos
		elem.find('.reset_height').each(function() {
			var resObj = jQuery(this);
			var parent = resObj.parents('.aspect_wrt');
			resObj.css({height: parent.height()});
		});
	}

	function _cleanupBackgroundAndStyling(elem) {
			elem.css({'background-image': 'none'});
			elem.find('.aspect_wrt_with_imglink').each(function() {
				jQuery(this).removeClass('aspect_wrt_with_imglink');
			});
	}

	//-----------------------------------------------------------------------------
	// Slides initializations
	//-----------------------------------------------------------------------------
	var g_slides = null;
	function getSlidesObj() {
		return g_slides;
	}
	
	function initSlides() {
		var slides = jQuery('.njsSlides');
		var pgNo = jQuery('#pgNo');
		var navLeft = jQuery('#navigate_left');
		var navRight = jQuery('#navigate_right');
		if (slides.length < 1 || pgNo.length < 1 || navLeft.length < 1 || navRight.length < 1) return;

		g_slides = new njs_slides.SlideSet(slides, pgNo, navLeft, navRight);
		g_slides.onSlideChange(callOnSlideChangedHandlers);
		callAfterInitHandlers();
	}

	var onSlideChangedFunctionArray = [];
	function onSlideChanged(fn) {
		onSlideChangedFunctionArray.push(fn);
	}

	function callOnSlideChangedHandlers(event) {
		for (var i = 0; i < onSlideChangedFunctionArray.length; i++) {
			onSlideChangedFunctionArray[i](event);
		}
	}

	var onEscapeFunctionArray = [];
	function onEscape(fn) {
		onEscapeFunctionArray.push(fn);
	}

	function callOnEscapeHandlers(event) {
		var ret = false;
		for (var i = 0; i < onEscapeFunctionArray.length; i++) {
			var ret1 = onEscapeFunctionArray[i](event);
			ret = ret || ret1;
		}
		return ret;
	}

	//-----------------------------------------------------------------------------
	// Overall intialization
	//-----------------------------------------------------------------------------
	var g_transition = 'default';
    var g_staticResFolder = '';
    var g_staticTemplFolder = '';
    var g_staticIconFolder = '';
	var g_staticVersion = '';

	var g_bleedingEdge = false;
	function setBleedingEdge(bleedingEdge) {
		g_bleedingEdge = bleedingEdge;
	}

	function isBleedingEdge() {
		return g_bleedingEdge;
	}

	var g_username = '';
	function getUsername() {
		return g_username;
	}
	
	var g_userdispname = '';
	function getUserdispname() {
	    return g_userdispname;
	}
	
    function SoftKeyChecker() {
        var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.isSoftKeyOn = function() {
            if (!isMobile) return false;
            var elem = jQuery('input:focus, textarea:focus');
            return (elem.length > 0);
        };
    }

    var _isPageLesson = false;    
    function pageIsLesson() {
        _isPageLesson = true;
    }

    function initPage(bDebug, retainAspect, transition, staticResFolder, staticTemplFolder, staticIconFolder, staticVersion, bPrint, username, userdispname) {
        g_transition = transition;
        g_staticResFolder = staticResFolder;
        g_staticTemplFolder = staticTemplFolder;
        g_staticIconFolder = staticIconFolder;
        g_staticVersion = staticVersion;
        g_username = username;
        g_userdispname = userdispname;
        njs_helper.log_init(bDebug);
        if (_isPageLesson) {
            njs_scorm.afterInit(function() {
                _initPage(retainAspect, bPrint);
            });
        } else {
            _initPage(retainAspect, bPrint);
        }
    }
    
    function _initPage(retainAspect, bPrint) {
		// Do the rest on completion of page load
		jQuery(function() {
			if (!bPrint) {
				initSizes(retainAspect);
				var skChecker = new SoftKeyChecker();
				jQuery(window).resize(function() {
    				initSizes(retainAspect);
                    if (skChecker.isSoftKeyOn()) return;
				    callOnResizeHandlers();
				});
				initMenus();
				initValidators();
			}

			convertDates();
			if (window.location.protocol.toLowerCase().indexOf('file') >= 0) {
				jQuery('.pagecanvas').hide();
			}
			renderPageLists();
			resizeImagesToAspectRatio(jQuery('body'));
			
			if (bPrint) {
				callPrintHandlers();
				MathJax.Hub.Queue(function() {
					jQuery('.body').css({opacity: 1});
					window.print();
				});	
				return;				
			}

			initSlides();
			jQuery('.body').css({opacity: 1});
			if (g_slides != null) g_slides.activate(window.location.hash);

			_initMoreAndLogView();
		});
	}

	var afterInitFunctionArray = [];
	function afterInit(fn) {
		afterInitFunctionArray.push(fn);
	}

	function callAfterInitHandlers() {
		for (var i = 0; i < afterInitFunctionArray.length; i++) {
			afterInitFunctionArray[i]();
		}
	}

    var onResizeFunctionArray = [];
    function onResize(fn) {
        onResizeFunctionArray.push(fn);
    }

    function callOnResizeHandlers() {
        for (var i = 0; i < onResizeFunctionArray.length; i++) {
            onResizeFunctionArray[i]();
        }
    }

	function getStaticResFolder() {
		return g_staticResFolder;
	}
	
    function getStaticTemplFolder() {
        return g_staticTemplFolder;
    }
    
    function getStaticIconFolder() {
        return g_staticIconFolder;
    }
    
	function getStaticVersion() {
		return g_staticVersion;
	}
	
	var printCallbackArray = [];
	function printHandler(fn){
		printCallbackArray.push(fn);
	}
	
	function callPrintHandlers() {
		for (var i = 0; i < printCallbackArray.length; i++) {
			printCallbackArray[i]();
		}
	}
	
	function onPrint(event) {
		var search = window.location.search;
		if (!search) {
			search = '?njs_print=true';
		} else {
			search += '&njs_print=true';
		}
		var newUrl = window.location.protocol + '//' + window.location.host + 
					 window.location.pathname + search + window.location.hash;
		
		var redirButton = {id:'redirect', text: 'Redirect', fn: function() {
				window.location.href = newUrl;
			}};
		njs_helper.Dialog.popup('Please confirm', 'Are you sure you want to redirect to print page?',
								[redirButton]);
	}

	return {

		// Basic Utilities
		dateToString : dateToString,
		secondsToHmsString: secondsToHmsString,
		areArraysEqual : areArraysEqual,
		DateTimePicker : DateTimePicker,

		// Page initializations
		setBleedingEdge : setBleedingEdge,
		isBleedingEdge : isBleedingEdge,
		pageIsLesson: pageIsLesson,
		initPage : initPage,
        afterInit : afterInit,
        onResize : onResize,
		onSlideChanged : onSlideChanged,
		callOnSlideChangedHandlers : callOnSlideChangedHandlers,
		onEscape : onEscape,
        getStaticResFolder : getStaticResFolder,
        getStaticTemplFolder : getStaticTemplFolder,
        getStaticIconFolder : getStaticIconFolder,
		getStaticVersion : getStaticVersion,
        getUsername : getUsername,
        getUserdispname : getUserdispname,
		getSlidesObj : getSlidesObj,

		// Keyboard shortcuts
		bindHotkey: bindHotkey,
		unbindHotkeys: unbindHotkeys,
		onHome: onHome,
		onHelp: onHelp,

		// More dialog Box
		showMore : showMore,
		showLog : showLog,

		// Button state management
		enableButton: enableButton,
		isButtonEnabled: isButtonEnabled,
		
		// Popup handling
		toggleElem : toggleElem,
		closePopupsAndDlgs : closePopupsAndDlgs,

		resizeImagesToAspectRatio : resizeImagesToAspectRatio,

		//Print
		onPrint: onPrint,
		printHandler: printHandler,

		// Redirect to URL
		setOnLeaveCheck : setOnLeaveCheck,
		getOnLeaveCheck : getOnLeaveCheck,
		redir : redir,
		redirDelay : redirDelay,
		redirConfirm : redirConfirm,
		redirLink : redirLink
	};
}();

//------------------------------------------------------------------------
// web2py spoofs
//------------------------------------------------------------------------
function web2py_validate_entropy(myfield, req_entropy) {
}

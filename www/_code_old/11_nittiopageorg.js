njsPageOrg = function() {

	var g_onDoneFn = '';
	var _pageOrgDlg = new njs_helper.Dialog();
	var _pageOrgCopyPasteField = null;

	// All index are 0-based. Index -1 refers to header row
	function showOrganizer(isPopup, onDoneFn) {
		g_onDoneFn = onDoneFn;
		var lesson = nlesson.theLesson;
		lesson.updateContent();
		var lessonDict = {
			pageData : _createPageRows()
		};

		var pageDlgTemplate = jQuery('#njsPageOrganizer').val();
		var dlgStr = njs_helper.fmt1(pageDlgTemplate, lessonDict).trim();
		var dlg = njs_helper.jobj(dlgStr);
		_pageOrgCopyPasteField = dlg.find('#page_org_copy_paste_field');

		_pageOrgDlg.remove();
		var cancelButton = {id: 'cancel', text: 'Close', fn: function() {
			_closeOrganizer();
		}};
		_pageOrgDlg.create('page_org', dlg, [], cancelButton);
		_reinitRows(lesson, 0, -1, lesson.getCurrentPageNo());
        var title = jQuery('#page_org_title');
        title.html(njs_helper.fmt2('Organize {}Pages', isPopup ? 'Popup ' : ''));
		_pageOrgDlg.show();
		_setCopyPasteFieldListeners(dlg);
		_ensureFocusOfCopyPasteField();
		bindHotkeys();
	}
	
	// Focus till it is done!
	var _focuserHandle = null;
	var _retriesDone = 0;
	function _ensureFocusOfCopyPasteField() {
		if (_focuserHandle) clearInterval(_focuserHandle);
		_retriesDone = 0;
		_pageOrgCopyPasteField.focus();
		var MAX_RETRIES = 6;
		_focuserHandle = setInterval(function() {
			_pageOrgCopyPasteField.focus();
			_retriesDone++;
			if (_retriesDone < MAX_RETRIES) return;
			clearInterval(_focuserHandle);
			_focuserHandle = null;
		}, 500);
	}

	function _setCopyPasteFieldListeners() {
		_pageOrgCopyPasteField.on('focus', function() {
			_pageOrgCopyPasteField.select();
		});
	
		_pageOrgCopyPasteField.on('copy',function(e) {
			_pageOrgCopyPasteField.val(_getSelectedContent());
			_ensureFocusOfCopyPasteField();
		});

		_pageOrgCopyPasteField.on('cut',function(e) {
			_pageOrgCopyPasteField.val(_getSelectedContent());
			onCut();
			_ensureFocusOfCopyPasteField();
		});

		_pageOrgCopyPasteField.on('paste',function(e) {
            var clipboard = e.clipboardData || window.clipboardData || e.originalEvent.clipboardData;
			var clip = clipboard && clipboard.getData('text/plain') || null;
			clip = JSON.parse(clip);
			onPaste(clip);
		});
	}

	function _getSelectedContent() {
		var copiedObj = {};
		for(var key in g_pageOverViewPageNoDict) {
			copiedObj[key] = nlesson.theLesson.pages[key].copyContent();
		}
		return JSON.stringify(copiedObj);
	}
	
	function _closeOrganizer() {
		_pageOrgDlg.close();
		unbindHotkeys();
		g_pageOverViewPageNoDict = {};
		nlesson.theLesson.reinitSlides();
		g_onDoneFn();
		g_onDoneFn = '';
		return true;
	}

	function onKeyUp() {
		onKeyUpDown(g_pageOverviewPageNo - 1);
	}

	function onKeyDown() {
		onKeyUpDown(g_pageOverviewPageNo + 1);
	}

	function onKeyPageUp() {
		onKeyUpDown(g_pageOverviewPageNo - 10);
	}

	function onKeyPageDown() {
		onKeyUpDown(g_pageOverviewPageNo + 10);
	}

	function onKeyHome() {
		onKeyUpDown(0);
	}

	function onKeyEnd() {
		onKeyUpDown(nlesson.theLesson.pages.length);
	}

	function onKeyUpDown(pageNo) {
		var lesson = nlesson.theLesson;
		if (pageNo < 0) {
			pageNo = 0;
		} else if (pageNo > lesson.pages.length - 1) {
			pageNo = lesson.pages.length - 1;
		}
		clickRow(pageNo);
	}

	function onKeyCtrlUp() {
		onSwap(true);
	}

	function onKeyCtrlDown() {
		onSwap(false);
	}

	function bindHotkeys() {
		nittio.bindHotkey('body', 'pageOrg', 'up', onKeyUp);
		nittio.bindHotkey('body', 'pageOrg', 'down', onKeyDown);
		nittio.bindHotkey('body', 'pageOrg', 'pageup', onKeyPageUp);
		nittio.bindHotkey('body', 'pageOrg', 'pagedown', onKeyPageDown);
		nittio.bindHotkey('body', 'pageOrg', 'home', onKeyHome);
		nittio.bindHotkey('body', 'pageOrg', 'end', onKeyEnd);
		nittio.bindHotkey('body', 'pageOrg', 'Ctrl+up', onKeyCtrlUp);
		nittio.bindHotkey('body', 'pageOrg', 'Ctrl+down', onKeyCtrlDown);
		nittio.bindHotkey('body', 'pageOrg', 'return', onNavigateToPage);
	}

	function unbindHotkeys() {
		nittio.unbindHotkeys('body', 'pageOrg');
	}

	function _createPageRows() {
		var ret = '';
		var lesson = nlesson.theLesson;
		for (var i = 0; i < lesson.pages.length; i++) {
			ret += _createPageRow(lesson.pages, i);
		}
		return ret;
	}

	function _createPageRowObject(pages, i) {
		return njs_helper.jobj(_createPageRow(pages, i));
	}

	function _createPageRow(pages, i) {
		var templ = 
			'<tr class="clickable" id="page_org_row_{pageNo}" onclick="njsPageOrg.onRowClick({pageNo});">'
				+ '<td><input type="checkbox" id="page_org_row_sel_{pageNo}" onclick="njsPageOrg.onCheckBoxClick({pageNo}, event);"></input></td>'
				+ '<td class="text-right">{page}</td>'
				+ '<td class="text-right">{maxScore}</td>'
				+ '<td class="more">{more}</td>'
			+ '</tr>';
		var rowDetails = {};
		rowDetails.pageNo = i;
		rowDetails.page = _makePageNoLink(i);
		rowDetails.maxScore = pages[i].getMaxScore() + pages[i].getPopupMaxScore();
		rowDetails.more = _makeMoreLink(i, pages[i].sections[0].oSection.text);
		return njs_helper.fmt1(templ, rowDetails);
	}

	function _makePageNoLink(pageNo) {
		return njs_helper.fmt2('<span class="njsLink" onclick="njsPageOrg.onPageClick({}, event);">{}</span>', pageNo, pageNo + 1);
	}

	function _makeMoreLink(pageNo, str) {
		str = _escapeAndTrim(str);
		return njs_helper.fmt2('<span class="njsLink" onclick="njsPageOrg.onPageClick({}, event);">{}</span>', pageNo, str);
	}

	function _escapeAndTrim(str) {
		var trimLen = 100;
		var ret = str.length > trimLen ? str.substring(0, trimLen - 3) + '...' : str;
		return njs_helper.escape(ret);
	}

	var g_pageOverviewPageNo = -1;
	var g_pageOverViewPageNoDict = {};

	function onCheckBoxClick(pageNo, event) {
		var bChecked = (pageNo >= 0 && jQuery('#page_org_row_sel_' + pageNo).is(":checked"));
		if (event) event.stopImmediatePropagation();
		if (!bChecked) {
			jQuery('#page_org_row_' + pageNo).removeClass('selected');
			jQuery('#page_org_row_sel_' + pageNo).prop('checked', false);
			if (pageNo in g_pageOverViewPageNoDict) delete g_pageOverViewPageNoDict[pageNo];
			if (g_pageOverviewPageNo == -1) {
				g_pageOverviewPageNo = -1;
				_enableButtonsPerState(g_pageOverviewPageNo);
				return;
			} 	
		} else {
			g_pageOverviewPageNo = pageNo;
			g_pageOverViewPageNoDict[pageNo] = true;
			_getPageRow(pageNo).addClass('selected');
			jQuery('#page_org_row_sel_' + pageNo).prop('checked', true);	
		}
		_ensureFocusOfCopyPasteField();
		_enableButtonsPerState(pageNo);
	}

	function onRowClick(pageNo) {
		if (g_pageOverviewPageNo >= 0) {
			jQuery('#page_org_row_' + g_pageOverviewPageNo).removeClass('selected');
			jQuery('#page_org_row_sel_' + g_pageOverviewPageNo).prop('checked', false);
		}
		if (Object.keys(g_pageOverViewPageNoDict).length > 0) {
			for(var key in g_pageOverViewPageNoDict) {
				jQuery('#page_org_row_' + key).removeClass('selected');
				jQuery('#page_org_row_sel_' + key).prop('checked', false);	
			}
			g_pageOverViewPageNoDict = {};
		}

		g_pageOverviewPageNo = pageNo;
		g_pageOverViewPageNoDict[pageNo] = true;
		_getPageRow(pageNo).addClass('selected');
		jQuery('#page_org_row_sel_' + g_pageOverviewPageNo).prop('checked', true);
		_ensureFocusOfCopyPasteField();
		_enableButtonsPerState(g_pageOverviewPageNo);
	}
	

	function scrollToElem(elem, parent, smooth) {
		var scrollTop = parent.scrollTop();
		var elemHeight = elem.outerHeight(true);
		var margin = elemHeight * 2;
		var offsetTop = elem.offset().top - parent.offset().top + scrollTop - margin;
		var offsetBottom = offsetTop + elemHeight + margin;
		var visibleHeight = parent.height();

		if (offsetBottom > visibleHeight + scrollTop) {
			scrollTop = offsetTop;
		} else if (offsetTop < scrollTop) {
			scrollTop = offsetTop - visibleHeight + margin;
		}

		//alert(njs_helper.fmt2('offsetTop: {}, offsetBottom: {}, visibleHeight: {}, scrollTop: {}', offsetTop, offsetBottom, visibleHeight, scrollTop));

		if (smooth) {
			parent.animate({
				'scrollTop' : scrollTop
			}, 'slow', 'swing');
		} else {
			parent.scrollTop(scrollTop);
		}
	}

	function clickRow(pageNo) {
		if (pageNo >= 0) {
			var elem = jQuery('#page_org_row_sel_' + pageNo);
			var parent = jQuery('#page_org_body');
			scrollToElem(elem, parent);
			elem.prop('checked', true);
		}
		onRowClick(pageNo);
	}

	function _enableButtonsPerState(pageNo) {
		var buttonStates = {
			page_org_icon_up : false,
			page_org_icon_down : false,
		};
		jQuery("#page_org_icon_up").hide();
		jQuery("#page_org_icon_down").hide();
		if (Object.keys(g_pageOverViewPageNoDict).length > 1 || Object.keys(g_pageOverViewPageNoDict).length == 0) {
			_enableButtons(buttonStates);
			return;
		}
		if (pageNo < 0) {
			return _enableButtons(buttonStates);
		}

		var lesson = nlesson.theLesson;
		if (pageNo > 0) {
			jQuery("#page_org_icon_up").show();
			buttonStates['page_org_icon_up'] = true;
		}
		if (pageNo < lesson.pages.length - 1) {
			jQuery("#page_org_icon_down").show();
			buttonStates['page_org_icon_down'] = true;
		}
		return _enableButtons(buttonStates);
	}

	function _enableButtons(buttonStates) {
		for (var button in buttonStates) {
			nittio.enableButton(button, buttonStates[button]);
		}
		return true;
	}

	function onNavigateToPage() {
		if (g_pageOverviewPageNo < 0)
			return true;
		return onPageClick(g_pageOverviewPageNo);
	}

	function onPageClick(pageNo, event) {
		var lesson = nlesson.theLesson;
		_closeOrganizer();
		if (pageNo != lesson.globals.slides.getCurPageNo()) lesson.globals.slides.gotoPage(pageNo);
		if (event) event.stopImmediatePropagation();
		return true;
	}

	function onSwap(moveUp) {
		var butId = moveUp ? 'page_org_icon_up' : 'page_org_icon_down';
		if (!nittio.isButtonEnabled(butId)) {
			return false;
		}
		var lesson = nlesson.theLesson;

		var swapStart = g_pageOverviewPageNo;
		if (moveUp) {
			swapStart -= 1;
		}
		if (swapStart < 0 || swapStart >= lesson.pages.length - 1) {
			return false;
		}

		lesson.swapPage(swapStart);
		var selectedPage = moveUp ? swapStart : swapStart + 1;
		_reinitRows(lesson, swapStart, swapStart + 1, selectedPage);
	}

	function onCut() {
		var lesson = nlesson.theLesson;
		cutPage(lesson);

		var selectedPage = g_pageOverviewPageNo;
		if (selectedPage >= lesson.pages.length) {
			selectedPage = lesson.pages.length - 1;
		}
		_reinitRows(lesson, 0, lesson.pages.length + Object.keys(g_pageOverViewPageNoDict).length, selectedPage, 'cut');
	}

	function cutPage(lesson, curPos) {
		if (lesson.pages.length <= 1) {
			alert('Sorry, you cannot delete/cut the last page');
			return false;
		}
		if (lesson.pages.length == Object.keys(g_pageOverViewPageNoDict).length) {
			alert('Sorry, you cannot delete/cut all the pages');
			return false;
		}
		
		if (!confirm(njs_helper.fmt2('Are you sure you want to delete/cut page selected pages?'))) return false;
		if(Number.isInteger(curPos)) {
            lesson.cutPage(curPos);
        } else {
            var cutItems = 0;
            for(var key in g_pageOverViewPageNoDict) {
                var key = parseInt(key);
                    key = key-cutItems;
                lesson.cutPage(key);
                cutItems++;
            }   
        }
		lesson.updateContent();
	}

	function selectDeselectAll(canMark) {
		var pages = nlesson.theLesson.pages;
		var bChecked = canMark;
		for (var i=0; i<pages.length; i++) {
			var pageNo = i;
			if (!bChecked) {
				jQuery('#page_org_row_' + pageNo).removeClass('selected');
				jQuery('#page_org_row_sel_' + pageNo).prop('checked', false);
				if (pageNo in g_pageOverViewPageNoDict) delete g_pageOverViewPageNoDict[pageNo];
			} else {
				g_pageOverviewPageNo = pageNo;
				g_pageOverViewPageNoDict[pageNo] = true;
				_getPageRow(pageNo).addClass('selected');
				jQuery('#page_org_row_sel_' + pageNo).prop('checked', true);	
			}	
		}
		_ensureFocusOfCopyPasteField();
		_enableButtonsPerState();
	}

	function onPaste(clip) {
		var lesson = nlesson.theLesson;
		if (Object.keys(g_pageOverViewPageNoDict).length == 0 || Object.keys(clip).length == 0) {
			alert('Please cut or copy a page before pasting it.');
			return false;
		}
		var pageNo = g_pageOverviewPageNo;
		for(var key in clip) {
			if (!lesson.pastePage(pageNo, clip[key])) {
				alert('Please cut or copy a page before pasting it.');
				return false;
			}
			pageNo = pageNo + 1;
		}
		var selectedPage = g_pageOverviewPageNo + 1;
		lesson.updateContent();
		_reinitRows(lesson, selectedPage, lesson.pages.length - 1, selectedPage, 'paste');
	}

	function _reinitRows(lesson, start, end, selectedPage, type) {
		if(type == 'cut') {
			var before = _getPageRow(-1);
			for (var key in g_pageOverViewPageNoDict) _getPageRow(key).remove();
			for (var i = start; i <= end; i++) {
				// if (i in g_pageOverViewPageNoDict)
				_getPageRow(i).remove();
				if (i >= lesson.pages.length)
					continue;
				var current = _createPageRowObject(lesson.pages, i);
				current.insertAfter(before);
				before = current;
			}	
			
		} else {
			for (var i = start; i <= end; i++) {
				_getPageRow(i).remove();
				if (i >= lesson.pages.length)
					continue;
				var before = _getPageRow(i - 1);
				var current = _createPageRowObject(lesson.pages, i);
				current.insertAfter(before);
			}	
		}
		if (type != 'paste') {
			g_pageOverViewPageNoDict = {};
			clickRow(selectedPage);
		}

		jQuery('#page_org_pages').html(lesson.pages.length);
		jQuery('#page_org_maxscore').html(lesson.oLesson.maxScore);
	}

	function _getPageRow(pageNo) {
		return jQuery(njs_helper.fmt2('#page_org_row_{}', pageNo));
	}

	return {
		showOrganizer : showOrganizer,
		onRowClick : onRowClick,
		onCheckBoxClick : onCheckBoxClick,
		onPageClick : onPageClick,
		onSwap : onSwap,
		cutPage : cutPage,
		selectDeselectAll : selectDeselectAll,
	};
}();

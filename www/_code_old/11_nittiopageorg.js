njsPageOrg = function() {

	var g_onDoneFn = '';
	var _pageOrgDlg = new njs_helper.Dialog();

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

		_pageOrgDlg.remove();
		var cancelButton = {id: 'cancel', text: 'Close', fn: function() {
			_closeOrganizer();
		}};
		_pageOrgDlg.create('page_org', dlg, [], cancelButton);
		_reinitRows(lesson, 0, -1, lesson.getCurrentPageNo());
        var title = jQuery('#page_org_title');
        title.html(njs_helper.fmt2('Organize {}Pages', isPopup ? 'Popup ' : ''));
		_pageOrgDlg.show();

		bindHotkeys();
	}

	function _closeOrganizer() {
		_pageOrgDlg.close();
		unbindHotkeys();
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
		nittio.bindHotkey('body', 'pageOrg', 'Ctrl+x', onCut);
		nittio.bindHotkey('body', 'pageOrg', 'Ctrl+c', onCopy);
		nittio.bindHotkey('body', 'pageOrg', 'Ctrl+v', onPaste);
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
		var templ = '<tr class="normal" id="page_org_row_{pageNo}"><td><input type="checkbox" id="page_org_row_sel_{pageNo}" onclick="njsPageOrg.onRowClick({pageNo});"></input></td><td>{page}</td><td class="score">{maxScore}</td><td class="more">{more}</td></tr>';
		var rowDetails = {};
		rowDetails.pageNo = i;
		rowDetails.page = _makePageNoLink(i);
		rowDetails.maxScore = pages[i].getMaxScore() + pages[i].getPopupMaxScore();
		rowDetails.more = _makeMoreLink(i, pages[i].sections[0].oSection.text);
		return njs_helper.fmt1(templ, rowDetails);
	}

	function _makePageNoLink(pageNo) {
		return njs_helper.fmt2('<span class="njsLink" onclick="njsPageOrg.onPageClick({});">{}</span>', pageNo, pageNo + 1);
	}

	function _makeMoreLink(pageNo, str) {
		str = _escapeAndTrim(str);
		return njs_helper.fmt2('<span class="njsLink" onclick="njsPageOrg.onPageClick({});">{}</span>', pageNo, str);
	}

	function _escapeAndTrim(str) {
		var trimLen = 100;
		var ret = str.length > trimLen ? str.substring(0, trimLen - 3) + '...' : str;
		return njs_helper.escape(ret);
	}

	var g_pageOverviewPageNo = -1;

	function onRowClick(pageNo) {
		var bChecked = (pageNo >= 0 && jQuery('#page_org_row_sel_' + pageNo).is(":checked"));

		if (g_pageOverviewPageNo >= 0) {
			jQuery('#page_org_row_' + g_pageOverviewPageNo).removeClass('selected');
			jQuery('#page_org_row_sel_' + g_pageOverviewPageNo).prop('checked', false);
		}

		if (!bChecked) {
			g_pageOverviewPageNo = -1;
			_enableButtonsPerState(g_pageOverviewPageNo);
			return;
		}

		g_pageOverviewPageNo = pageNo;
		_getPageRow(pageNo).addClass('selected');
		jQuery('#page_org_row_sel_' + g_pageOverviewPageNo).prop('checked', true);
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
			page_org_icon_cut : false,
			page_org_icon_copy : false,
			page_org_icon_paste : false
		};

		if (pageNo < 0) {
			return _enableButtons(buttonStates);
		}

		var lesson = nlesson.theLesson;
		if (pageNo > 0) {
			buttonStates['page_org_icon_up'] = true;
		}
		if (pageNo < lesson.pages.length - 1) {
			buttonStates['page_org_icon_down'] = true;
		}
		buttonStates['page_org_icon_cut'] = true;
		buttonStates['page_org_icon_copy'] = true;
		if (lesson.isPastable()) {
			buttonStates['page_org_icon_paste'] = true;
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

	function onPageClick(pageNo) {
		var lesson = nlesson.theLesson;
		_closeOrganizer();
		if (pageNo != lesson.globals.slides.getCurPageNo()) lesson.globals.slides.gotoPage(pageNo);
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
		var butId = 'page_org_icon_cut';
		if (!nittio.isButtonEnabled(butId)) {
			return false;
		}
		var lesson = nlesson.theLesson;
		var curPos = g_pageOverviewPageNo;
		cutPage(lesson, curPos);

		var selectedPage = g_pageOverviewPageNo;
		if (selectedPage > lesson.pages.length - 1) {
			selectedPage--;
		}
		_reinitRows(lesson, curPos, lesson.pages.length, selectedPage);
	}

	function cutPage(lesson, curPos) {

		if (lesson.pages.length <= 1) {
			alert('Sorry, you cannot delete/cut the last page');
			return false;
		}

		if (!confirm(njs_helper.fmt2('Are you sure you want to delete/cut page {}?', curPos + 1))) {
			return false;
		}

		lesson.cutPage(curPos);
		lesson.updateContent();
	}

	function onCopy() {
		var butId = 'page_org_icon_copy';
		if (!nittio.isButtonEnabled(butId)) {
			return false;
		}
		var lesson = nlesson.theLesson;
		lesson.copyPage(g_pageOverviewPageNo);
		_reinitRows(lesson, 0, -1, g_pageOverviewPageNo);
	}

	function onPaste() {
		var butId = 'page_org_icon_paste';
		if (!nittio.isButtonEnabled(butId)) {
			return false;
		}
		var lesson = nlesson.theLesson;
		if (!lesson.pastePage(g_pageOverviewPageNo)) {
			alert('Please cut or copy before pasting');
			return false;
		}
		var selectedPage = g_pageOverviewPageNo + 1;
		lesson.updateContent();
		_reinitRows(lesson, selectedPage, lesson.pages.length - 1, selectedPage);
	}

	function _reinitRows(lesson, start, end, selectedPage) {
		for (var i = start; i <= end; i++) {
			_getPageRow(i).remove();
			if (i >= lesson.pages.length)
				continue;
			var before = _getPageRow(i - 1);
			var current = _createPageRowObject(lesson.pages, i);
			current.insertAfter(before);
		}
		clickRow(selectedPage);

		jQuery('#page_org_pages').html(lesson.pages.length);
		jQuery('#page_org_maxscore').html(lesson.oLesson.maxScore);
	}

	function _getPageRow(pageNo) {
		return jQuery(njs_helper.fmt2('#page_org_row_{}', pageNo));
	}

	return {
		showOrganizer : showOrganizer,
		onRowClick : onRowClick,
		onPageClick : onPageClick,
		onSwap : onSwap,
		cutPage : cutPage,
		onCut : onCut,
		onCopy : onCopy,
		onPaste : onPaste
	};
}();

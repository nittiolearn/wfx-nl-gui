njs_lesson_helper = function() {
//#############################################################################################
// Set of helpers used within the njs_lesson.js script
//#############################################################################################

function PendingTimer() {
	this.timerId = null;

	this.updateIfNeeded = function(lesson) {
		if (lesson.renderCtx.launchCtx() != 'do_assign') return this.hideCounters();
        lesson.sessionStartTime = new Date();

		var timeLimitSeconds = lesson.oLesson['timeLimitSeconds'];
		if (timeLimitSeconds == null) return this.hideCounters();

		jQuery('#countdown_timer').removeClass('hide_counter');

		lesson.end_time = new Date(lesson.sessionStartTime.valueOf() + timeLimitSeconds*1000);
		
		this.checkEndTime(lesson);
		var me = this;
		this.timerId = setInterval(function() {
			me.checkEndTime(lesson);
		}, 500);
	};

	this.hideCounters = function() {
		jQuery('#toggle_timer_icon').hide();
		return false;
	};
	
	this.checkEndTime = function(lesson) {
		var now = new Date();
		var pending = parseInt((lesson.end_time.valueOf() - now.valueOf())/1000);
		if (pending < 1) {
			jQuery('#countdown_timer').html('Time over!');
			if (this.timerId != null) {
				clearTimeout(this.timerId);
				this.timerId = null;
			}
			njs_helper.BlankScreen.show();
			lesson.submitAssignReport();
		} else if (pending < 60) {
			jQuery('#countdown_timer').html('Little time left, please submit: ' + nittio.secondsToHmsString(pending));
			jQuery('#countdown_timer').addClass('countdown_timer_warning');
		} else {
			jQuery('#countdown_timer').html('Time left: ' + nittio.secondsToHmsString(pending));
		}
	};
}

//#############################################################################################
// RenderingContext - Helper class to decide how to render the lesson, page and section. The 
// following terms are necessry to understand when reading this code:
//---------------------------------------------------------------------------------------------
// context (ctx) vs mode: 
//---------------------------------------------------------------------------------------------
// Context is the specific term which determines the exact usecase. e.g: 
// "launched from view approved", "lesson in editor preview mode", "page in learner zodi pressed
// mode", "section in editor and is read-only section", ...
//
// Mode is a more generic term which determines overall type of rendering needed in the given
// context. 3 generic modes of rendering is possible:
// "edit" (render for editing a lesson), 
// "do" (render for learning a lesson),
// "report" (render as a report indicating correct/wrong answers).
// 
// Mode is always rerived from the context - fixed mapping from context to mode. Most of the
// rendering code only checks the mode to determine the needed redering. Only in few places 
// the exact context is used for determining the behaviour.
//
//---------------------------------------------------------------------------------------------
// context and mode are applied at different levels: launch/lesson/page: 
//---------------------------------------------------------------------------------------------
// Context (and subsequently mode) can be defined at load of the lesson or changed during run time.
//
// launchCtx/launchMode: The context in which the rendering was initiated (at page load time).
// e.g. edit a lesson, self-learn a lesson, do assignment, view lesson report, ...
//
// lessonCtx/lessonMode: It is possible that the context/mode is changed for the whole lesson
// during runtime - e.g. change from "edit" to "preview" in editor. In such a case, the lesson
// context is changed. Lesson mode is derived from lesson context.
//
// pageCtx/pageMode: It is possible that the context/mode is changed for just one page:
// e.g. you press "ask-zodi" while self learnig: only the page where zodi was pressed have to be
// in report mode while the rest of the pages should be in "do" mode.
//
//---------------------------------------------------------------------------------------------
// summarizing the possible values of launch/lesson/page contexts:
//---------------------------------------------------------------------------------------------
// launchCtx             | lessonCtx         | addtional pageCtx         |
// 'edit'                | 'edit', 'edit_pv' | 'edit_gra'                |
// 'edit_templ'          |-- same as above --|------ same as above ------|
//                       |                   |                           |
// 'do'                  | 'do', 'do_pv'     | 'do_zodi'                 | 
// 'do_withrep'          |-- same as above --|------ same as above ------|
// 'view'                |-- same as above --|------ same as above ------|
// 'do_assign'           |-- same as above --|------ same as above ------|
// 'do_update'           |-- same as above --|------ same as above ------|
// 'do_review'           |-- same as above --|------ same as above ------|
//                       |                   |                           |
// 'report_assign_my'    | 'report'          |                           | 
// 'report_assign_review'|-- same as above --|------ same as above ------|
// 'report_assign_shared'|-- same as above --|------ same as above ------|
// 'report_lesson'       |-- same as above --|------ same as above ------|
//#############################################################################################
function RenderingContext() {
	this.init = RenderingContext_init;

	// Generic getters - used most often
	this.launchMode = RenderingContext_launchMode;
	this.lessonMode = RenderingContext_lessonMode;
	this.pageMode = RenderingContext_pageMode;
	
	// Specialized getters - used less often
	this.launchCtx = RenderingContext_launchCtx;
	this.lessonCtx = RenderingContext_lessonCtx;
	this.pageCtx = RenderingContext_pageCtx;
	
	// Specialized setters - used when rendering mode is changed during runtime: 
	// e.g. toggle to preview mode in editor)
	this.setLessonCtx = RenderingContext_setLessonCtx;
	this.editorToggleEditAndPreview = RenderingContext_editorToggleEditAndPreview;
	this.playerToggleDoAndPreview = RenderingContext_playerToggleDoAndPreview;
	this.editorPageToggleEditAndGraEdit = RenderingContext_editorPageToggleEditAndGraEdit;
	this.playerPageChangeToZodi = RenderingContext_playerPageChangeToZodi;
	this.playerGetZodiChangesPages = RenderingContext_playerGetZodiChangesPages;
	
	// Specific checks based on launchCtx used in notes-dlg
	this.studentNotesState = RenderingContext_studentNotesState; // "editable" or "read-only"
	this.teacherRemarksState = RenderingContext_teacherRemarksState; // "editable" or "read-only" or "hidden"
	this.canShowScore = RenderingContext_canShowScore; // true/false

	this.data = {};
}

var LAUNCH_CONTEXTS_TO_MODE = {
	'edit_templ':'edit', 'edit':'edit',
	'do':'do', 'do_withrep':'do', 'view':'do', 'do_assign':'do', 'do_update':'do', 'do_review':'do', 
	'report_assign_my': 'report', 'report_assign_review': 'report', 
	'report_assign_shared': 'report', 'report_lesson': 'report'};
	
var RUNTIME_CONTEXTS_TO_MODE = {
	'edit': 'edit', 'edit_gra': 'edit', 'edit_templ': 'edit', 'edit_pv': 'do',
	'do': 'do', 'do_pv': 'report', 'do_zodi': 'report', 'report': 'report'};

function RenderingContext_init(launchContext) {
	if (!(launchContext in LAUNCH_CONTEXTS_TO_MODE)) throw njs_helper.fmt2('Unsupported launch context: {}', launchContext);
	this.data.launchCtx = launchContext;
	this.data.launchMode = LAUNCH_CONTEXTS_TO_MODE[launchContext];
	this.data.lessonCtx = this.data.launchMode;
}

function RenderingContext_launchMode() {
	return this.data.launchMode;
}

function RenderingContext_lessonMode() {
	return _contextToMode(this.lessonCtx());
}

function RenderingContext_pageMode(page) {
	return _contextToMode(this.pageCtx(page));
}

function _contextToMode(context) {
	return RUNTIME_CONTEXTS_TO_MODE[context];
}

function RenderingContext_launchCtx() {
	return this.data.launchCtx;
}

function RenderingContext_lessonCtx() {
	return this.data.lessonCtx;
}

function RenderingContext_pageCtx(page) {
	if('currentRenderCtx' in page) {
		if (page.currentRenderCtx == 'edit_gra') {
			if (this.lessonCtx() == 'edit_pv') return 'edit_pv';
			return page.currentRenderCtx;
		}
		return page.currentRenderCtx;
	}
	if('do_pv' in this.data && page.pagetype.isDoToggleSupported()) return 'do_pv';
	return this.lessonCtx();
}

var _editorToggleStates = {
	'edit': {
		'edit' : {newState: 'edit_pv', newIcon: 'ion-ios-compose', newTitle: ' Change to edit mode (Alt+T)'},
		'edit_pv' : {newState: 'edit', newIcon: 'ion-ios-eye', newTitle: ' Change to preview mode (Alt+T)'}
		},
	'edit_templ': {
		'edit_templ' : {newState: 'edit', newIcon: 'ion-ios-eye', newTitle: ' Change to preview mode (Alt+T)'},
		'edit' : {newState: 'edit_pv', newIcon: 'ion-edit', newTitle: ' Change to edit template mode (Alt+T)'},
		'edit_pv' : {newState: 'edit_templ', newIcon: 'ion-ios-compose', newTitle: ' Change to edit mode (Alt+T)'}
		}
};

function RenderingContext_setLessonCtx(lessonCtx) {
	this.data.lessonCtx = lessonCtx;
}

function RenderingContext_editorToggleEditAndPreview() {
	if (this.launchMode() != 'edit') {
		throw njs_helper.fmt2('Cannot toggle in current context: {}', this.data.launchCtx);
	}
	var toggleStateKey = nittio.isBleedingEdge() ? this.launchCtx() : 'edit';
	var newStateInfo = _editorToggleStates[toggleStateKey][this.data.lessonCtx];
	this.data.lessonCtx = newStateInfo.newState;
	return newStateInfo;
}

function RenderingContext_playerToggleDoAndPreview() {
	if (this.launchMode() != 'do') {
		throw njs_helper.fmt2('Cannot toggle in current context: {}', this.data.launchCtx);
	}
	
	ret = 'do_pv';
	if ('do_pv' in this.data) {
		delete this.data.do_pv;
		ret = 'do';
	} else {
		this.data.do_pv = true;
	}

	return ret;
}

function RenderingContext_editorPageToggleEditAndGraEdit(page) {
	if (this.launchMode() != 'edit') {
		throw njs_helper.fmt2('Cannot toggle in current context: {}', this.data.launchCtx);
	}
	
	var curCtx = 'currentRenderCtx' in page ? page.currentRenderCtx : 'edit';
	if (curCtx == 'edit') {
		page.currentRenderCtx = 'edit_gra';
	} else {
		delete page.currentRenderCtx;
	}
	
	return page.currentRenderCtx;
}

function RenderingContext_playerPageChangeToZodi(page) {
	if (this.launchMode() != 'do') {
		throw njs_helper.fmt2('Cannot toggle in current context: {}', this.data.launchCtx);
	}
	
	page.currentRenderCtx = 'do_zodi';
	if (!('zodiCompletedPages' in page.lesson.oLesson)) {
		page.lesson.oLesson.zodiCompletedPages = {};
	}
	page.lesson.oLesson.zodiCompletedPages[page.getPageId()] = true;
	return page.currentRenderCtx;
}

function RenderingContext_playerGetZodiChangesPages(lesson) {
	var ret = {};
	
	// Zodi pages are to be remembered only when we opening a pre-saved assignment
	if (this.launchMode() != 'do' || this.launchCtx() == 'do_update') return ret;

	if (!('zodiCompletedPages' in lesson.oLesson)) return ret;
	for (key in lesson.oLesson.zodiCompletedPages) {
		ret[key] = true;
	}
	
	return ret;
}

function RenderingContext_canShowScore() {
	return (this.launchCtx() == 'do_update' || this.launchCtx() == 'report_assign_review');
}

function RenderingContext_studentNotesState() {
	if (this.launchMode() == 'do') return 'editable';
	return 'readonly';
}

function RenderingContext_teacherRemarksState() {
	if (this.canShowScore()) return 'editable';
	if (this.launchCtx() == 'report_assign_my' || 
		this.launchCtx() == 'report_assign_shared') return 'readonly';
	return 'hidden';
}

//#############################################################################################
// SubmitAndScoreDialog - Class modelling assignment submit and assignment score overview dlg
//#############################################################################################
function SubmitAndScoreDialog() {
}

SubmitAndScoreDialog.showReportOverview = function(lesson) {
	lesson.updateScore();
	var canScore = lesson.renderCtx.canShowScore();
	_SubmitAndScoreDialog_showWindow(lesson, 'score_dlg.html', 
		_SubmitAndScoreDialog_getShowReportParameters, [], canScore, null);
};

SubmitAndScoreDialog.showSubmitWindow = function(lesson, submitMethod) {
	var canScore = false;
	var submitButton = {id: 'submit', text: 'Submit', fn: function() {
		njs_helper.Dialog.moveBack();
		if (submitMethod == 'submit_assign')
			return lesson.submitAssignReport();
		return lesson.submitLessonReport();
	}};
	_SubmitAndScoreDialog_showWindow(lesson, 'submit_dlg.html', 
		_SubmitAndScoreDialog_getSubmitWindowParameters, [submitButton], canScore, submitMethod);
};

SubmitAndScoreDialog.onPageClick = function(pageNo) {
	var lesson = nlesson.theLesson;
	_SubmitAndScoreDialog_closeScoreWindow(lesson);
	if (pageNo != lesson.globals.slides.getCurPageNo()) lesson.globals.slides.gotoPage(pageNo);
};

//#############################################################################################
// SubmitAndScoreDialog - private methods
//#############################################################################################
var _SubmitAndScoreDialog_reportDlg = new njs_helper.Dialog();

function _SubmitAndScoreDialog_showWindow(lesson, templateName, getDlgParamsFn, buttons, 
										  canScore, submitMethod) {
	var _chain = new njs_helper.AsyncFunctionChain();
	var _template = new njs_helper.ClientSideTemplate(templateName, _chain);
	var _dialogParams = {};
	getDlgParamsFn(lesson, _dialogParams, submitMethod);

	_chain.add(function() {
		_template.render(_dialogParams);
	});
	
	_chain.add(function() {
		var dlg = njs_helper.jobj(_chain.getLastResult());
		_SubmitAndScoreDialog_reportDlg.remove();

		var cancelButton = {id: 'cancel', text: 'Close', fn: function() {
			_SubmitAndScoreDialog_closeScoreWindow(lesson);
		}};
		_SubmitAndScoreDialog_reportDlg.create('report_score', dlg, buttons, cancelButton);

		if (canScore) jQuery('#report_score .score').show();
		_SubmitAndScoreDialog_reportDlg.show();
	});
}

function _SubmitAndScoreDialog_getShowReportParameters(lesson, dialogParams) {
	dialogParams.staticResFolder = nittio.getStaticResFolder();

	var l = lesson.oLesson;
	dialogParams.score = l.score;
	dialogParams.maxScore = l.maxScore;
	var reportversion = ('reportversion' in l) ? l.reportversion : 0;

	dialogParams.perc = 0;
	if (l.maxScore > 0) {
        dialogParams.perc = (100*l.score/l.maxScore).toFixed(0);
	}
	
	dialogParams.correct = _SubmitAndScoreDialog_isCorrect(l.score, l.maxScore);
	dialogParams.overallinfo = '';
	if (reportversion > 1) {
		dialogParams.overallinfo = njs_helper.fmt2('{} - started <br/>{} - ended', 
			nittio.dateToString(l.started), nittio.dateToString(l.ended));
	}
	// Computed substitution at lesson level
	var pageRowTempl = '<tr class="{htmlClass}"><td>{page}</td><td class="done"><img src="{staticResFolder}/general/{correct}.png"></td><td class="score">{score}</td><td class="score">{maxScore}</td><td class="more">{more}</td></tr>';
	dialogParams.pageScoreDetails = '';

	for (var i=0; i<lesson.pages.length; i++) {				
		var page = lesson.pages[i];
		var rowDetails = {};
		rowDetails.page = _SubmitAndScoreDialog_makePageNoLink(i); 
		rowDetails.score = page.getScore(); 
		rowDetails.maxScore = page.getMaxScore(); 
		rowDetails.correct = _SubmitAndScoreDialog_isCorrect(rowDetails.score, rowDetails.maxScore);
		if (rowDetails.maxScore == 0) {
			rowDetails.maxScore = '-';
		}
		rowDetails.more = _SubmitAndScoreDialog_makeMoreLink(i, page.sections[0].oSection.text); 
		rowDetails.htmlClass = 'normal';
		rowDetails.staticResFolder = nittio.getStaticResFolder();
		dialogParams.pageScoreDetails += njs_helper.fmt1(pageRowTempl, rowDetails);
	}
}

function _SubmitAndScoreDialog_getSubmitWindowParameters(lesson, dialogParams, submitMethod) {
	dialogParams.reportExists = '';
    dialogParams.warning = '';

	if (lesson.renderCtx.launchCtx() == 'do_withrep') {
		dialogParams.reportExists = 'Report already exists. If you proceed, the existing report will be replaced.';
	}

	var l = lesson.oLesson;
	var pendingPages = l.notAnswered.length + l.partAnswered.length;
    var totalPages = pendingPages + l.answered.length;
    dialogParams.centerMsg = 'text-align: center'; 

	if (pendingPages > 0) {
	    var fmt = 'You have not completed {} out of {} question/interaction(s).';
        dialogParams.warning = njs_helper.fmt2(fmt,
            l.notAnswered.length+l.partAnswered.length, totalPages);
        dialogParams.centerMsg = ''; 
	}

	// Detailed rows
	var pageRowTempl = '<tr class="{cls}"><td>{page}</td><td class="more">{more}</td></tr>';
	var pageScoreDetails = '';

	for (var i=0; i<lesson.pages.length; i++) {				
		var page = lesson.pages[i];
		var rowDetails = {cls: 'normal'};
		if (_SubmitAndScoreDialog_isCompleted(i, l)) continue;
		rowDetails.page = _SubmitAndScoreDialog_makePageNoLink(i); 
		rowDetails.more = _SubmitAndScoreDialog_makeMoreLink(i, page.sections[0].oSection.text); 
		pageScoreDetails += njs_helper.fmt1(pageRowTempl, rowDetails);
	}
	if (pageScoreDetails) {
        var rowDetails = {cls: 'bold', page: 'Page', more: 'Title'};
        pageScoreDetails = njs_helper.fmt1(pageRowTempl, rowDetails) + pageScoreDetails;
	}
	dialogParams.pageScoreDetails = pageScoreDetails;
}

function _SubmitAndScoreDialog_isCompleted(pageNo, oLesson) {
	if (oLesson.notAnswered.indexOf(pageNo) > -1 ||
	   'partAnswered' in oLesson && oLesson.partAnswered.indexOf(pageNo) > -1) {
		return false;
	}
	return true;
}

function _SubmitAndScoreDialog_isCorrect(score, maxScore) {
	if (maxScore <= 0) {
		return 'na';
	} else if (score == 0) {
		return 'cross';
	} else if (score == maxScore) {
		return 'tick';
	}
	return 'partial';
}

function _SubmitAndScoreDialog_makePageNoLink(pageNo) {
	var pageNoTxt = pageNo + 1;
	return njs_helper.fmt2('<span class="njsLink" onclick="njs_lesson_helper.SubmitAndScoreDialog.onPageClick({});">{}</span>', pageNo, pageNoTxt);
}

function _SubmitAndScoreDialog_makeMoreLink(pageNo, str) {
    var retData = {lessPara: true};
    str = njs_lesson_markup.markupToHtml(str, retData);
    str = _SubmitAndScoreDialog_trim(str);
	return njs_helper.fmt2('<div onclick="njs_lesson_helper.SubmitAndScoreDialog.onPageClick({});"> <span class="njsLink">{}</span></div>', pageNo, str);
}

function _SubmitAndScoreDialog_trim(str) {
    str = str.replace(/<(?:.|\n)*?>/gm, ''); // Remove html tags
	var trimLen = 100;
	return str.length > trimLen ? str.substring(0, trimLen -3) + '...' : str;
}

function _SubmitAndScoreDialog_closeScoreWindow(lesson) {
	_SubmitAndScoreDialog_reportDlg.close(function() {
		lesson.postRender();
	});
	return true;
}

//#############################################################################################
// LessonDlgs - Namespace for Lesson dialog box objects
//#############################################################################################
function LessonDlgs() {
}

LessonDlgs.contentsDlg = new njs_helper.Dialog();
LessonDlgs.propsDlg = new njs_helper.Dialog();
LessonDlgs.pageTypeDlg = new njs_helper.Dialog();
LessonDlgs.pagePropsDlg = new njs_helper.Dialog();
LessonDlgs.changeLookDlg = new njs_helper.Dialog();
LessonDlgs.searchBoxDlg = new njs_helper.Dialog();
LessonDlgs.notesDlg = new njs_helper.Dialog();

LessonDlgs.createDlg = function(dlg, dlgId, bId, bName, bFunc, cFunc) {
	var button = {id: bId, text: bName, fn: bFunc};
	var cancelButton = {id: 'cancel', text: 'Cancel'};
	if (cFunc !== undefined) cancelButton.fn = cFunc; 
	dlg.create(dlgId, jQuery('#' + dlgId).remove(), [button], cancelButton);
};


//#############################################################################################
// SectionTemplate - Class parsing section template string
//#############################################################################################
function SectionTemplate(templString, errAlert) {
	// Generic getters - used most often
	this.init = SectionTemplate_init;
	this.isError = SectionTemplate_isError;
	this.getMode = SectionTemplate_getMode;
	this.getHelp = SectionTemplate_getHelp;
	this.getValue = SectionTemplate_getValue;
	this.getReportId = SectionTemplate_getReportId;
	this.getChoices = SectionTemplate_getChoices;

	this.isSpecialText = SectionTemplate_isSpecialText;
	this.isEditorButton = SectionTemplate_isEditorButton;
	this.getOptionsType = SectionTemplate_getOptionsType;
	this.getOptionsMin = SectionTemplate_getOptionsMin;
	this.getOptionsMax = SectionTemplate_getOptionsMax;
	this.getOptionsRegex = SectionTemplate_getOptionsRegex;

	this.getViewHtml = SectionTemplate_getViewHtml;
	this.getEditorText = SectionTemplate_getEditorText;
	
	this.init(templString, errAlert);
}

SectionTemplate.getDefaultString = function() {
	return 'mode:text\r\nvalue:';
};

SectionTemplate.getFieldHelp = function() {
	return 'mode:text(default) or readonly or select or multi-select\r\noptions:editor=1\r\nreportid:optional-string\r\nhelp:optional-multi-line-string\r\nmore-lines-of-help-if-needed\r\nvalue:optional-multi-line-string\r\nmore-lines-of-value-if-needed';
};

SectionTemplate.usage = function() {
	var div1 = jQuery('<div>');

	div1.append('<br/><p><b>Usage</b></p>');
	div1.append(jQuery('<p>mode:text or readonly or select or multi-select</p>'));
	div1.append(jQuery('<p>help:multi-line text which appears as editor help</p>'));
	div1.append(jQuery('<p>reportid:unique text which identifies this parameter in the reports</p>'));
	div1.append(jQuery('<p>value:applicable for readonly/select/multi-select modes</p>'));
	div1.append(jQuery('<p>options:editor=1|type=text or number or tel or email|min=x|max=y</p>'));

	div1.append('<br/><p><b>Example: creating a text field with editor button</b></p>');
	div1.append(jQuery('<p>mode:text</p>'));
	div1.append(jQuery('<p>help:Please enter a text</p>'));
	div1.append(jQuery('<p>Second line of help text</p>'));
	div1.append(jQuery('<p>reportid:text input 1</p>'));
	div1.append(jQuery('<p>options:editor=1</p>'));

	div1.append('<br/><p><b>Example: creating a numeric field</b></p></b></p>');
	div1.append(jQuery('<p>mode:text</p>'));
	div1.append(jQuery('<p>help:Please enter a number between 0 and 10</p>'));
	div1.append(jQuery('<p>reportid:number input 1</p>'));
	div1.append(jQuery('<p>options:type=number|min=0|max=10</p>'));

	div1.append('<br/><p><b>Example: creating a telephone number field </b></p></b></p>');
	div1.append(jQuery('<p>mode:text</p>'));
	div1.append(jQuery('<p>help:Please enter a telephone number in format +91nnnnnnnnnn</p>'));
	div1.append(jQuery('<p>reportid:mobile number 1</p>'));
	div1.append(jQuery('<p>options:type=tel</p>'));

	div1.append('<br/><p><b>Example: creating a email id field</b></p></b></p>');
	div1.append(jQuery('<p>mode:text</p>'));
	div1.append(jQuery('<p>help:Please enter email id</p>'));
	div1.append(jQuery('<p>reportid:email id 1</p>'));
	div1.append(jQuery('<p>options:type=email</p>'));

	div1.append('<br/><p><b>Example: creating a readonly field</b></p>');
	div1.append(jQuery('<p>mode:readonly</p>'));
	div1.append(jQuery('<p>value:readonly content</p>'));

	div1.append('<br/><p><b>Example: creating a dropdown field</b></p>');
	div1.append(jQuery('<p>mode:select</p>'));
	div1.append(jQuery('<p>reportid:select field</p>'));
	div1.append(jQuery('<p>value:option1</p>'));
	div1.append(jQuery('<p>option2</p>'));
	div1.append(jQuery('<p>option3</p>'));

	div1.append('<br/><p><b>Example: creating a multiselect field</b></p>');
	div1.append(jQuery('<p>mode:multi-select</p>'));
	div1.append(jQuery('<p>reportid:multiselect field</p>'));
	div1.append(jQuery('<p>value:option1</p>'));
	div1.append(jQuery('<p>option2</p>'));
	div1.append(jQuery('<p>option3</p>'));
	
	return div1;
};

var _SectionTemplate_attrs = {'mode': 'single', 'options': 'single', 'help': 'multi', 'value': 'multi', 'reportid': 'single'};
var _SectionTemplate_modes = ['text', 'readonly', 'select', 'multi-select'];

function SectionTemplate_init(templString, section) {
	this.error = [];
	_SectionTemplate_reset(this, null);

	var currentAttr = null;
	lines = templString.split('\n');

	for(var i=0; i<lines.length; i++) {
		var line = lines[i].trim();
		var pos = line.indexOf(':');
		var attr = (pos < 0) ? '' : line.substring(0, pos).toLowerCase();
		var val = (pos <0) ? '' : line.substring(pos+1);
		
		if (attr in _SectionTemplate_attrs) {
			currentAttr = attr;
			_SectionTemplate_addToAttribute(this, currentAttr, val, i+1);
		} else {
			_SectionTemplate_addToAttribute(this, currentAttr, line, i+1);
		}
	}
	
	if (this.mode == null) {
		this.mode = 'text';
		this.defMode = true;
	}
	this.mode = this.mode.trim().toLowerCase();
	if (_SectionTemplate_validateObject(this, section)) return;
	
	_SectionTemplate_reset(this, 'readonly');
}

function _SectionTemplate_reset(me, mode) {
	me.mode = mode;
	me.defMode = false;
	me.help = null;
	me.value = (mode == 'readonly') ? '' : null;
	me.options = null;
	me.choices = [];
	me.optionsParsed = {};
	me.reportid = null;
}

function _SectionTemplate_setError(me, lineNo, msg) {
	lineNo = (lineNo == '') ? '' : 'lineNo: ' + lineNo + '- ';
	me.error.push(njs_helper.fmt2('{}{}', lineNo, msg));
}

function _SectionTemplate_addToAttribute(me, attrName, val, lineNo) {
	if (attrName == 'value') {
		var choice = val.trim();
		if (choice != '') me.choices.push(choice);
	} else if (attrName == 'options') {
		var options = val.trim().split('|');
		for (var i in options) {
			var avpair = options[i].split('=');
			if (avpair.length != 2) continue;
			me.optionsParsed[avpair[0].trim()] = avpair[1].trim();
		}
	} else if (attrName == 'reportid') {
		val = val.trim();
	}

	if (!(attrName in _SectionTemplate_attrs) && (val != '')) {
		if (attrName == null) {
			_SectionTemplate_setError(me, lineNo, 'Unsupported attribute');
		} else {
			_SectionTemplate_setError(me, lineNo, 'Unsupported attribute: ' + attrName);
		}
		return;
	}
	
	if (me[attrName] == null) {
		me[attrName] = val;
	} else if (_SectionTemplate_attrs[attrName] == 'multi') {
		me[attrName] += '\n' + val;
	} else {
		_SectionTemplate_setError(me, lineNo, 
			njs_helper.fmt2('data for attribute "{}" cannot span multiple lines', attrName));
	}
}

function _SectionTemplate_validateObject(me, section) {
	if (section.lesson.renderCtx.launchCtx() != 'edit_templ') return true;
	
	if (me.mode == 'text') {
		_SectionTemplate_ensureAbsent(me, 'value');
		if (!me.defMode) _SectionTemplate_ensurePresent(me, 'reportid');
	} else if (me.mode == 'readonly') {
		_SectionTemplate_ensurePresent(me, 'value');
		_SectionTemplate_ensureAbsent(me, 'options');
	} else if (me.mode == 'select' || me.mode == 'multi-select') {
		if (me.choices.length < 2) {
			_SectionTemplate_setError(me, '', njs_helper.fmt2('Atleast 2 choices expected for mode "{}"', me.mode));
		}
		_SectionTemplate_ensureAbsent(me, 'options');
		_SectionTemplate_ensurePresent(me, 'reportid');
	} else {
		_SectionTemplate_setError(me, '', 'Unsuported mode: ' + me.mode);
	}
	_SectionTemplate_ensureUniqueReportId(me, section);
	return !me.isError();
}

function _SectionTemplate_ensurePresent(me, attrName) {
	if (me[attrName] != null) return;
	_SectionTemplate_setError(me, '', njs_helper.fmt2('"{}" expected for mode "{}"', attrName, me.mode));
}

function _SectionTemplate_ensureAbsent(me, attrName) {
	if (me[attrName] == null) return;
	_SectionTemplate_setError(me, '', njs_helper.fmt2('"{}" not expected for mode "{}"', attrName, me.mode));
}

var _SectionTemplate_reportIdToSecInfo = {};
function _SectionTemplate_ensureUniqueReportId(me, section) {
	if (me['reportid'] == null) return;
	var mySecInfo = {pageId: section.page.getPageId(), secNo: section.secNo};
	
	if (me['reportid'] in _SectionTemplate_reportIdToSecInfo) {
		var secInfo = _SectionTemplate_reportIdToSecInfo[me['reportid']];
		if (secInfo.pageId != mySecInfo.pageId || secInfo.secNo != mySecInfo.secNo) {
			var pageNo = section.lesson.getPageNoFromPageId(secInfo.pageId);
			_SectionTemplate_setError(me, '', njs_helper.fmt2('"reportid" already in use: page {}, section {}', 
				pageNo+1, secInfo.secNo+1));
			return;
		}
	}
	_SectionTemplate_reportIdToSecInfo[me['reportid']] = mySecInfo;
}

function SectionTemplate_isError() {
	return (this.error.length > 0);
}

function _SectionTemplate_getErrorString(me) {
	var ret = jQuery('<div>');
	ret.append(jQuery('<p><b>Error</b></p>'));
	for (var i=0; i<me.error.length; i++) {
		ret.append(jQuery(njs_helper.fmt2('<p style="color:red">{}</p>', me.error[i])));
	}
	ret.append(SectionTemplate.usage());
	return ret;
}

function SectionTemplate_getMode() {
	return this.mode;
}

function SectionTemplate_getHelp() {
	return this.help;
}

function SectionTemplate_getValue() {
	return this.value;
}

function SectionTemplate_getChoices() {
	return this.choices;
}

function SectionTemplate_getReportId() {
	return this.reportid;
}

function SectionTemplate_isSpecialText() {
	return (this.isEditorButton() || this.getOptionsType() != null);
}

function SectionTemplate_isEditorButton() {
	return ('editor' in this.optionsParsed) && (this.optionsParsed.editor === '1');
}

function SectionTemplate_getOptionsType() {
	if ('type' in this.optionsParsed) return this.optionsParsed.type;
	return null;
}

function SectionTemplate_getOptionsMin() {
	if ('min' in this.optionsParsed) return this.optionsParsed.min;
	return null;
}

function SectionTemplate_getOptionsMax() {
	if ('max' in this.optionsParsed) return this.optionsParsed.max;
	return null;
}

function SectionTemplate_getOptionsRegex() {
	if ('regex' in this.optionsParsed) return this.optionsParsed.regex;
	return null;
}

var _SectionTemplate_cls = 'pgSecText';
function SectionTemplate_getViewHtml(section, defaultHelp) {
	if (this.isError()) {
		var ret = jQuery('<button type="button" class="template_error_button">Template Error</button>');
		var msg = _SectionTemplate_getErrorString(this);
		ret.click(function() {
			njs_helper.Dialog.popup('Template Error', msg, undefined, undefined, sizes=njs_helper.Dialog.sizeLarge());
		});
		return {html: ret, isMarkup: false};
	}
	
	if (this.mode == 'readonly')  return {html: this.value, isMarkup: true};

	var ans = this.getEditorText(section);
	var pageMode = section.lesson.renderCtx.pageMode(section.page);

	if (this.mode == 'text')  {
		if (pageMode == 'edit' && this.isEditorButton()) {
			var ret = EditBoxHelper.createTextBox(ans, true, section, 
				_SectionTemplate_cls, defaultHelp);
			return {html: ret, isMarkup: false};
		}
		var optionsType = this.getOptionsType();
		if (pageMode == 'edit' && optionsType != null) {
			var ret = EditBoxHelper.createInputBox(ans, this, section, _SectionTemplate_cls, defaultHelp);
			return {html: ret, isMarkup: false};
			
		}
		section.pgSecText.attr('placeholder', defaultHelp);
		section.pgSecText.attr('title', defaultHelp);
		return {html: ans, isMarkup: true};
	}

	var answers = SelectHelper.getAnswersAsList(this.mode, ans);
	if (pageMode == 'edit') {
		return {html: SelectHelper.createSelectBox(this.mode, 
			this.choices, [], answers, section.page, _SectionTemplate_cls, defaultHelp), isMarkup: false};
	}
	return {html: SelectHelper.getSelectionAsText(this.choices, answers), isMarkup: true};
}

function SectionTemplate_getEditorText(section) {
	if (this.mode == 'readonly')  return '';
	if (this.mode == 'text' && !this.isSpecialText()) return section.getText();
	
	var elem = section.pgSecView.find('.' + _SectionTemplate_cls);
	if (elem.length > 0 && !elem.hasClass('report')) return elem.val();
	
	return section.oSection.text;
}

//#############################################################################################
// EditBoxHelper - Class getting the html for text: (with or without detailed editor icon)
//#############################################################################################
function EditBoxHelper() {
	// EditBoxHelper.createInputBox(initialVal, secTemplate, section, cls, defaultHelp)
	// EditBoxHelper.createTextBox(initialVal, isEditorButton, section, cls, defaultHelp)
	// EditBoxHelper.checkInputBox(inputBox, secTemplate)
};

EditBoxHelper.checkInputBox = function(inputBox, secTemplate) {
	var type = secTemplate.getOptionsType();
	if (type == 'number') return _EditBoxHelper_checkNumber(inputBox, secTemplate);
	if (type == 'text') return _EditBoxHelper_checkText(inputBox, secTemplate);
	if (type == 'tel') return _EditBoxHelper_checkTel(inputBox, secTemplate);
	if (type == 'email') return _EditBoxHelper_checkEmail(inputBox, secTemplate);
	return true;
};

function _EditBoxHelper_checkNumber(inputBox, secTemplate) {
	var max = secTemplate.getOptionsMax();
	var min = secTemplate.getOptionsMin();
	var val = inputBox.val();
	val = parseInt(val);
	if (min != null && val < min) val = '';
	if (max != null && val > max) val = '';
	inputBox.val(val);
	return true;
}

function _EditBoxHelper_checkText(inputBox, secTemplate) {
	var regex = secTemplate.getOptionsRegex();
	if (regex == null) return true;
	return _EditBoxHelper_checkRegex(inputBox, regex);
}

function _EditBoxHelper_checkTel(inputBox, secTemplate) {
	var val = inputBox.val();
	val = val.replace(/\s+/g,'');
	val = val.replace(/\-+/g,'');
	inputBox.val(val);
	return _EditBoxHelper_checkRegex(inputBox, '^\\+[0-9]{12}$');
}

function _EditBoxHelper_checkEmail(inputBox, secTemplate) {
	var val = inputBox.val();
	var val = val.replace(/\s+/g,'');
	inputBox.val(val);
	return _EditBoxHelper_checkRegex(inputBox, '\\@');
}

function _EditBoxHelper_checkRegex(inputBox, regex) {
	var re = new RegExp(regex);
	var val = inputBox.val();
	if (val.match(re) !== null) return true;
	inputBox.val('');
	return true;
}

EditBoxHelper.createInputBox = function(initialVal, secTemplate, section, cls, defaultHelp) {
	var inputType = secTemplate.getOptionsType();
	var regex = null;
	
	var ret = jQuery('<div/>');
	var ta = jQuery(njs_helper.fmt2('<INPUT type="{}" class="{}"/>', inputType, cls));
	if (inputType == 'number') {
		var min = secTemplate.getOptionsMin();
		var max = secTemplate.getOptionsMax();
		if (min != null) ta.attr('min', min);
		if (max != null) ta.attr('max', max);
	}
	ta.val(initialVal);
	ta.blur(function() {
		EditBoxHelper.checkInputBox(ta, secTemplate);
	});
	EditBoxHelper.checkInputBox(ta, secTemplate);
	ta.show();
	ta.attr('placeholder', defaultHelp);
	ta.attr('title', defaultHelp);
	section.page.setNextTabIndex(ta);
	ret.append(ta);
	return ret;
};

EditBoxHelper.createTextBox = function(initialVal, isEditorButton, section, cls, defaultHelp) {
	var ret = jQuery('<div/>');
	var ta = jQuery(njs_helper.fmt2('<TEXTAREA class="{}"/>', cls));
	ta.val(initialVal);
	ta.show();
	ta.attr('placeholder', defaultHelp);
	ta.attr('title', defaultHelp);
	section.page.setNextTabIndex(ta);
	ret.append(ta);
	if (!isEditorButton) return ret;

	var editButton = jQuery(njs_helper.fmt2('<img class="sectiontoolIcon" src="{}/toolbar-edit/edit.png" title="Edit"/>', nittio.getStaticResFolder()));
	_EditBoxHelper_setClickHandler(editButton, function(e) {
		_EditBoxHelper_onButtonClick(section, cls);
	});
	ret.append(jQuery('<span class="sectiontoolbarIcon"/>').append(editButton));
	return ret;
};

//#############################################################################################
// EditBoxHelper - private methods
//#############################################################################################
function _EditBoxHelper_setClickHandler(domObj, handlerFn) {
	domObj.on('click', function(e) {
        e.preventDefault();
		handlerFn(e);
	});
	domObj.on('keypress', function(e) {
		var code = (e.keyCode ? e.keyCode : e.which);
		if (code != 13) return;
		e.preventDefault();
		handlerFn(e);
	});
}
	
function _EditBoxHelper_onButtonClick(section, cls) {
	cls = '.' + cls;
	var ta = section.pgSecView.find(cls);
	var ans = (ta.length > 0) ? ta.val() : '';
	if (ans === undefined || ans === null) ans = '';
	njs_helper.TextEditorDlg.show(ans, function(content) {
		section.pgSecView.find(cls).focus();
		if (content === ans) return;
		ta.val(content);
	});
}
	
//#############################################################################################
// SelectHelper - Class getting the html for select: / multi-select: boxes
//#############################################################################################
function SelectHelper() {
	// SelectHelper.getAnswersAsList(mode, ans)
	// SelectHelper.createSelectBox(mode, choices, correct, answers, page, cls, defaultHelp)
	// SelectHelper.getSelectionAsText(choices, answers)
	// SelectHelper.createDivBox(mode, choices, correct, answers, page, cls)
	// SelectHelper.setupOnReportClick(mode, choices, correct, answers, page, reportDiv)
};

SelectHelper.getAnswersAsList = function(mode, ans) {
	var answers = [];
	if (ans == '' || ans == null) return answers;
	if (mode == 'select') {
		answers.push(parseInt(ans));
		return answers;
	}
	for(var i=0; i<ans.length; i++) {
		answers.push(parseInt(ans[i]));
	}
	return answers;
};

SelectHelper.createSelectBox = function(mode, choices, correct, answers, page, cls, defaultHelp) {
	var multi = (mode == 'multi-select') ? 'multiple' : '';
	var select = jQuery(njs_helper.fmt2('<select class="{} {}" {}/>', cls, multi, multi));
	page.setNextTabIndex(select);
	if (mode == 'select') select.append('<option value="-1"></option>');
	var randomPos = _SelectHelper_getRandomPos(choices, correct, page);
	for (var pos=0; pos<choices.length; pos++) {
		var i = randomPos[pos];
		var selected = (answers != null && answers.indexOf(i) >= 0) ? 'selected' : '';
		select.append(njs_helper.fmt2('<option value="{}" {}>{}</option>', i, selected, choices[i]));
	}
	select.attr('title', defaultHelp);
	return select;
};

SelectHelper.getSelectionAsText = function(choices, answers) {
	var ret = '';
	var selectedAnswers = [];
	for (var i=0; i<choices.length; i++) {
		if (answers.indexOf(i) >= 0) selectedAnswers.push(choices[i]);
	}
	selectedAnswers.sort();
	var lineBreak = '';
	for (var i=0; i<selectedAnswers.length; i++) {
		ret += lineBreak + selectedAnswers[i];
		lineBreak = '\r\n';
	}
	return ret;
};

SelectHelper.createDivBox = function(mode, choices, correct, answers, page, cls) {
	var fmtStr = answers.length > 1  ? '<p>{}</p>' : '{}';
	var ret = jQuery(njs_helper.fmt2('<div class="{} report"/>', cls));
	var selectedAnswers = [];
	for (var i=0; i<choices.length; i++) {
		if (answers.indexOf(i) >= 0) selectedAnswers.push(choices[i]);
	}
	selectedAnswers.sort();
	for (var i=0; i<selectedAnswers.length; i++) {
		ret.append(njs_helper.fmt2(fmtStr, selectedAnswers[i]));
	}
	SelectHelper.setupOnReportClick(mode, choices, correct, answers, page, ret);
	return ret;
};

SelectHelper.setupOnReportClick = function(mode, choices, correct, answers, page, reportDiv) {
	if (page.lesson.renderCtx.pageMode(page) != 'report') return;
	if (correct.length == 0) return;
	reportDiv.click(function() {
		var answer = _SelectHelper_answersAsString(_SelectHelper_stringsOfPos(mode, choices, answers));
		var canswer = _SelectHelper_answersAsString(correct);
		njs_helper.Dialog.popup('Answer for the chosen section', 
							njs_helper.fmt2('<p><b>Correct Answer: </b>{}</p><p><b>Your Answer: </b>{}</p>', 
										njs_helper.escape(canswer), njs_helper.escape(answer)));
	});
};

//#############################################################################################
// SelectHelper - private methods
//#############################################################################################
function _SelectHelper_getRandomPos(choices, correct, page) {
	var len = choices.length;
	var randomize = (page.lesson.renderCtx.launchMode() == 'do' && (correct.length > 0)); 
	var randPosArray = [];
	for (var i=0; i < len; i++) randPosArray.push(i);
	if (!randomize) return randPosArray;
	return njs_helper.randSet(len, randPosArray);
}

function _SelectHelper_answersAsString(answers) {
	answers.sort();
	var ret ='';
	for(var i=0; i<answers.length; i++) {
		var delim = (i == 0) ? '' : ', ';
		ret += delim + answers[i];
	}
	return ret;
}

function _SelectHelper_stringsOfPos(mode, choices, answers) {
	if (mode != 'select' && mode != 'multi-select') return answers;
	var ret =[];
	for(var i=0; i<answers.length; i++) {
		ret.push(choices[answers[i]]);
	}
	return ret;
}

//#############################################################################################
// Exported classes
//#############################################################################################
return { 
	PendingTimer: PendingTimer,
	RenderingContext: RenderingContext,
	SubmitAndScoreDialog: SubmitAndScoreDialog,
	LessonDlgs: LessonDlgs,
	SectionTemplate: SectionTemplate,
	EditBoxHelper: EditBoxHelper,
	SelectHelper: SelectHelper
};}(); // njs_lesson_helper

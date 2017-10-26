nlesson = function() {
	//#############################################################################################
	// Lesson - 	models one lesson. 
	// Page - 		models one page in a lesson
	// Section - 	models one section in a page
	//
	// Naming conventions:
	// 		o prefix is used for Java script object from Lesson JSON string and
	// 		j prefix is used for JSON string representation
	// 		h prefix is used for JQuery DOM element
	//
	// Related important concepts (in order of importance to understand the flow):
	// Different modes in which the lesson is rendered: njs_lesson_helper.RenderingContext
	// Different pagetypes specific behaviour: njttiopagetypes.js
	// Markup handling: njs_lesson_markup.js
	//#############################################################################################

	//#############################################################################################
	// Class modelling a Lesson
	//#############################################################################################
	function Lesson() {

		// Getters for basic properties
		this.getCurrentPageNo = Lesson_getCurrentPageNo;
		this.getCurrentPageId = Lesson_getCurrentPageId;
		this.getPageNoFromPageId = Lesson_getPageNoFromPageId;
		this.getCurrentPageUrl = Lesson_getCurrentPageUrl;
		this.getExistingPageIds = Lesson_getExistingPageIds;
        this.getMinTextSize = Lesson_getMinTextSize;
        this.updateOLessonFromTempl = Lesson_updateOLessonFromTempl;

		// Initialize and render
		this.initDom = Lesson_initDom;					// init
		this.postInitDom = Lesson_postInitDom;          // createHtmlDom: after scorm init
		this.updateTemplateCustomizations = Lesson_updateTemplateCustomizations;
		this.editorToggleEditAndPreview = Lesson_editorToggleEditAndPreview; 
		this.reRender = Lesson_reRender; 				// Invalidates all pages - on next page change they will be rendered
														// edit (edit-gra) <-> view
		this.reRenderAsReport = Lesson_reRenderAsReport; // called on clicking zodi in view mode (view->report)
		this.doModeToggle = Lesson_doModeToggle;		// called on clicking "edit->preview" button
		this.updatePagePropertiesDom = Lesson_updatePagePropertiesDom; // update page properties in editor
        this.minifyLearningData = Lesson_minifyLearningData;
        this.unminifyLearningData = Lesson_unminifyLearningData;
		
		this.showForum = Lesson_showForum;

		// Initialize and render - internal methods
		// Lesson, Page and Section objects support the following internal methods wrt 
		// init and rendering:
		// init 			-	initialize the object. Create needed sub-objects. Html DOM elements
		//						are not created in this method. This is called after the html page 
		//						is loaded (nittio.beforeInit)
		// createHtmlDom 	- 	create the needed HTML DOM elements; attach them to the HTML page.
		//						This is called right after init method.
		// updateHtmlDom 	- 	This is called after all DOM elements are created. This is needed
		//						when page mode is changed as well. But this is called at page level - on page change
		// adjustHtmlDom 	- 	This is called after all DOM elements are updated. This is needed
		//						when page mode is changed as well. But this is called at page level - on page change
		this.createHtmlDom = Lesson_createHtmlDom;		// create the html element
		this.onEscape = Lesson_onEscape;
		this.preRender = Lesson_preRender;			// (onSlideBeforeChange)
		this.postRender = Lesson_postRender;			// (onSlideChange)
	
		// Save
		this.updateState = Lesson_updateState;
		this.saveLesson = Lesson_saveLesson;
		this.saveLessonRaw = Lesson_saveLessonRaw;
		this.saveComments = Lesson_saveComments;
		this.saveAssignReport = Lesson_saveAssignReport;
		this.submitAssignReport = Lesson_submitAssignReport;

		this.stopAudio = Lesson_stopAudio;
		this.setupOnLeavePage = Lesson_setupOnLeavePage;
		this.updateContent = Lesson_updateContent;
		this.getContent = Lesson_getContent;

		this.addPage = Lesson_addPage;
		this.changePageType = Lesson_changePageType;
		this.swapPage = Lesson_swapPage;
		this.cutPage = Lesson_cutPage;
		this.copyPage = Lesson_copyPage;
		this.pastePage = Lesson_pastePage;
		this.isPastable = Lesson_isPastable;
		this.reinitSlides = Lesson_reinitSlides;

		this.updateScore = Lesson_updateScore;
		this.updateScoreDo = Lesson_updateScoreDo;
		this.updateScoreReport = Lesson_updateScoreReport;
		this.submitReport = Lesson_submitReport;
		this.getPageStudentNotes = Lesson_getPageStudentNotes;
		this.setPageStudentNotes = Lesson_setPageStudentNotes;
		this.getPageTeacherRemarks = Lesson_getPageTeacherRemarks;
		this.setPageTeacherRemarks = Lesson_setPageTeacherRemarks;
		this.isPageScoreEditable = Lesson_isPageScoreEditable;
		this.getPageMaxScore = Lesson_getPageMaxScore;
		this.getPageScore = Lesson_getPageScore;
		this.setPageScore = Lesson_setPageScore;
	
		this.showOrHideZodiIcon = Lesson_showOrHideZodiIcon;
		this.showOrHideDoToggleIcon = Lesson_showOrHideDoToggleIcon;
		this.showPageReport = Lesson_showPageReport;

		this.search = Lesson_search;
		
		// Actual object initialization
		this.globals = {};
		this.renderCtx = new njs_lesson_helper.RenderingContext();
		
		this.globals.slides = null;
		this.globals.templateCssClass = '';
        this.globals.autoVoice = njs_autovoice.getAutoVoice();
        this.globals.audioManager = njs_autovoice.getAudioManager();
		this.globals.animationManager = njs_animate.getAnimationManager();
        this.globals.pageTimer = new njs_lesson_helper.PageTimer(this);
        this.globals.selectionHandler = new SectionSelectionHandler(this);
	}

	//--------------------------------------------------------------------------------------------
	// Lesson Methods - Getters for basic properties
	//--------------------------------------------------------------------------------------------
	function Lesson_getCurrentPageNo() {
		return this.globals.slides.getCurPageNo();
	}
	
	function Lesson_getCurrentPageId() {
		return this.pages[this.getCurrentPageNo()].getPageId();		
	}
	
	function Lesson_getPageNoFromPageId(pageId) {
		for (var i=0; i<this.pages.length; i++) {
			if (this.pages[i].getPageId() == pageId) return i;
		}
		return -1;
	}

	function Lesson_getCurrentPageUrl() {
		var url = window.location.href.replace(/\#.*/, ''); // remove # anchors
		url = url.replace(/\?.*/, ''); // remove query strings
		return url + '#/' + this.pages[this.getCurrentPageNo()].getPageIdStr();
	}
	
	function Lesson_getExistingPageIds() {
		var pageIdList = [];
		for(var i =0, len= this.pages.length; i < len; i++){
			pageIdList.push(this.pages[i].getPageId());
		}
		return pageIdList;	
	}
	
	function Lesson_getMinTextSize() {
	    if (this.minTextSizeComputed !== undefined) return this.minTextSizeComputed;
	    if (this.oLesson.minTextSize) {
	        this.minTextSizeComputed = this.oLesson.minTextSize;
	        return this.minTextSizeComputed;
	    }
        var td = this.parentTemplateContents.templateDefaults;
        this.minTextSizeComputed = td.minTextSize || 30;
        return this.minTextSizeComputed;
	}
	
	function Lesson_updateOLessonFromTempl() {
        var oLesson = this.oLesson;
        var td = this.parentTemplateContents.templateDefaults;
        var pauseCount = oLesson.autovoiceStartPause || td.autovoiceStartPause || 0;
        this.globals.autoVoice.setStartPause(pauseCount);

        if( this.renderCtx.launchMode() != 'do') return;

	    if (oLesson.passScoreFromTempl) {
	        oLesson.passScore = td.passScore;
	        return;
	    }
	    if ('passScore' in oLesson) return;
        oLesson.passScore = td.passScore;
        oLesson.passScoreFromTempl = true;
	}
	
	//--------------------------------------------------------------------------------------------
	// Lesson Methods - Initialize and render
	//--------------------------------------------------------------------------------------------
	function Lesson_initDom() {
	    jQuery('.toolBar').hide(); // shown later as needed!
	    var self = this;
        var jLesson = jQuery('#l_content').val();
        self.oLesson = jQuery.parseJSON(jLesson);
        self.parentTemplateContents = self.oLesson.parentTemplateContents || {};
        delete self.oLesson.parentTemplateContents;
        self.updateOLessonFromTempl();
        _initPageTypes(self);
        self.bgimg = jQuery('#l_pageData .bgimg');
        self.postRenderingQueue = new PostRenderingQueue(self);
        njs_scorm.onInitLesson(self, g_nlPlayerType, g_nlEmbedType,
            nittio.getUsername(), nittio.getUserdispname());
        window.nlapp.nlMarkup.setGid((g_nlPlayerType == 'sco') ? 0 : nittio.getGid());
        var moduleConfig = jQuery('#module_config').val();
        moduleConfig = jQuery.parseJSON(moduleConfig);
        window.nlapp.NittioLesson.init(self.oLesson, moduleConfig);
    }

    function Lesson_postInitDom() {
        var self = this;
        if (njs_scorm.nlPlayerType() == 'sco') {
            var ctx = self.renderCtx.launchCtx();
            if (ctx != 'do_assign') {
                // hide some toolbar icons
                jQuery('#do_toggle_icon').hide();        
                jQuery('#lesson_save_icon').hide();        
                jQuery('#lesson_submit_icon').hide();        
            } else if (!this.oLesson.selfLearningMode) {
                jQuery('#ask_zodi_icon').remove();
            }
            jQuery('.toolBar').show();
        } else {
            var scormMode = njs_scorm.getScormLmsLessonMode();
            var hideOuterNavigator = (scormMode !== null);
            if (hideOuterNavigator) jQuery('.pagecanvas').addClass('scormlms');
            var hideOuterToolbar = hideOuterNavigator || (self.renderCtx.launchMode() == 'edit');
            if (!hideOuterToolbar) jQuery('.toolBar').show();
        }


        nittio.setOnLeaveCheck(self.renderCtx.launchCtx() != 'view' &&
          njs_scorm.nlPlayerType() != 'embedded' && scormMode === null);

        _Lesson_updateOLessonFromLearningData(self);
        _Lesson_filterPages(self);
        self.pages = [];
        for (var i = 0; i < self.oLesson.pages.length; i++) {
            var po = new Page(self);
            po.init(self.oLesson.pages[i], self.bgimg);
            self.pages.push(po);
        }

		if (self.renderCtx.launchCtx() == 'do_assign') {
			var submit = '<span onclick="javascript:submitReportAssign()" class="nl-link-img" style="padding: 8px" style="display:inline-block"><i class="ion-ios-checkmark icon"></i> submit</span>';
			submit = njs_helper.fmt2('<div style="font-size:150%; line-height:1.5em">This is the end of this module. Click on the {} button if you have completed.</div>',
				submit);
			var oPage = {type: 'text', sections: [{text: submit}]};
			var po = new Page(self);
			po.init(oPage, self.bgimg);
	        self.pages.push(po);
	     }
	        	
        self.pendingTimer = new njs_lesson_helper.PendingTimer();
        self.pendingTimer.updateIfNeeded(self);
        _Lesson_setupAutoSave(self);
		
		// Clearup Zodi flag and remember to reRenderAsReport the ones cleared in do mode
		self.postRenderingQueue.initZodi();
		self.createHtmlDom();
        self.setupOnLeavePage();
        if (self.renderCtx.launchMode() == 'report' && njs_scorm.nlPlayerType() != 'sco')
            njs_lesson_helper.SubmitAndScoreDialog.showReportOverview(self);

        self.updateTemplateCustomizations();
	}

    var oldXXXDefault = 'SOME JUNK VALUE';
    var oldTemplateStylesCss = oldXXXDefault;
    var oldTemplateBgimgs = oldXXXDefault;
    var oldTemplateIcons = oldXXXDefault;
    var oldTemplatePageTypes = oldXXXDefault;
    var oldTemplateAnimations = oldXXXDefault;
    function Lesson_updateTemplateCustomizations() {
        if (oldTemplateStylesCss != this.oLesson.templateStylesCss) {
            oldTemplateStylesCss = this.oLesson.templateStylesCss;
            jQuery('#l_html').find('#templateStylesCss').remove();
            var stylesCss = this.parentTemplateContents.templateStylesCss;
            stylesCss += this.oLesson.templateStylesCss;
            if (stylesCss) {
                var styleElem = njs_helper.fmt2('<style id="templateStylesCss">{}</style>', stylesCss);
                jQuery('#l_html').prepend(styleElem);
            }
        }
        if (oldTemplateBgimgs != this.oLesson.templateBgimgs) {
            oldTemplateBgimgs = this.oLesson.templateBgimgs;
            g_templateDict = {};
        }
        if (oldTemplateIcons != this.oLesson.templateIcons) {
            oldTemplateIcons = this.oLesson.templateIcons;
            // TODO-MUNNI: implement in next release
        }
        if (oldTemplatePageTypes != this.oLesson.templatePageTypes) {
            oldTemplatePageTypes = this.oLesson.templatePageTypes;
            _initPageTypes(this);
        }
        if (oldTemplateAnimations != this.oLesson.templateAnimations) {
            oldTemplateAnimations = this.oLesson.templateAnimations;
            _updateTemplateAnimations(this);
        }
    }

    function _updateTemplateAnimations(lesson) {
        var parentAnimations = lesson.parentTemplateContents.templateAnimations || {};
		var myAnimations = lesson.oLesson.templateAnimations ? JSON.parse(lesson.oLesson.templateAnimations) : {};
		lesson.templateAnimations = {};
		for(var k in parentAnimations) lesson.templateAnimations[k] = parentAnimations[k];
		for(var k in myAnimations) lesson.templateAnimations[k] = myAnimations[k];
    }
    
    function _initPageTypes(lesson) {
        var parentPageTypes = lesson.parentTemplateContents.templatePageTypes;
        var templatePageTypes = lesson.oLesson.templatePageTypes ? JSON.parse(lesson.oLesson.templatePageTypes) : [];
        templatePageTypes = _mergeArrayAttrs(parentPageTypes, templatePageTypes);
        for (var i=0; i<templatePageTypes.length; i++) {
            templatePageTypes[i].sortorder = templatePageTypes[i].sortorder || 0;
            templatePageTypes[i].sortorder2 = i;
        }
        templatePageTypes.sort(function(a, b) {
            if (a.sortorder == b.sortorder) return a.sortorder2 - b.sortorder2;
            return a.sortorder - b.sortorder; 
        });
        npagetypes.init(templatePageTypes);
    }
    
    function _mergeArrayAttrs(existingData, newData) {
        var consolidated = [];
        var uniqueItems = {};
        for (i=newData.length-1; i>=0; i--) {
            var d = newData[i];
            uniqueItems[d['id']] = i;
        }
            
        for (i=0; i<newData.length; i++) {
            var d = newData[i];
            if (uniqueItems[d['id']] == i) consolidated.push(d);
        }
            
        for (i=0; i<existingData.length; i++) {
            var d = existingData[i];
            if (!(d['id'] in uniqueItems)) consolidated.push(d);
        }
        return consolidated;
    }
    
	function Lesson_editorToggleEditAndPreview() {
		var ret = g_lesson.renderCtx.editorToggleEditAndPreview();
		this.reRender(false);
		return ret;
	}

	function Lesson_reRender(bDontUpdate) {
	    this.postRenderingQueue.initQueue(bDontUpdate); // Cleanup so that pages are rendered on slide change
		this.postRender();
	}

	function Lesson_reRenderAsReport(pageNo) {
		if( this.renderCtx.launchMode() != 'do') return;

		this.updateScore();
		var curPage = this.pages[pageNo];
		this.renderCtx.playerPageChangeToZodi(curPage);
		curPage.reRender(true);
	}

	function Lesson_doModeToggle() {
		var ctx= this.renderCtx.playerToggleDoAndPreview();
		
        var iconSpan = jQuery('#do_toggle_icon');
        var icon = iconSpan.find('I');
        icon.removeClass();
        icon.removeAttr('class'); // Remove all classes not working sometime?
		if (ctx == 'do_pv') {
            icon.addClass('icon ion-ios-compose');
			iconSpan.attr('title', " Change to edit mode");
		} else {
            icon.addClass('icon ion-ios-eye');
			iconSpan.attr('title', " Change to preview mode");
		}

		this.reRenderedList = {};
		var curPage = this.pages[this.getCurrentPageNo()];
		curPage.reRenderDoMode(false);
	}
	
	function Lesson_updatePagePropertiesDom() {
		var curPage = this.pages[this.getCurrentPageNo()];
		curPage.updatePagePropertiesDom(this.getCurrentPageNo());
	}

    var forumDlg = null;
    function Lesson_showForum(forumType, forumRefid) {
        var curPage = this.pages[this.getCurrentPageNo()];
        if (forumType == '') return;
        if (forumDlg === null) {
            forumDlg = new njs_helper.Dialog();
            forumDlg.create('forumDlg', null, [], {id: 'cancel', text: 'Close'});
            forumDlg.addClass('nl-max');
        }
        var topic = curPage.oPage.forumTopic || this.oLesson.forumTopic || '';
        topic = topic.replace(/'/g, " ");
        topic = window.encodeURIComponent(topic);
        var lessonId = jQuery('#l_lessonId').val();
        var fmt = '/#/forum?forumtype={}&refid={}&secid={}&topic={}&hidemenu';
        var forumUrl = njs_helper.fmt2(fmt, forumType, forumRefid, lessonId, topic);
        forumDlg.updateBodyWithIframe(forumUrl);
        var dlgSize = {top : '0.5%', left : '0.5%', right: '0.5%', bottom: '0.5%'};
        forumDlg.show(dlgSize);
    }

	//--------------------------------------------------------------------------------------------
	// Lesson Methods - Initialize and render - internal methods
	//--------------------------------------------------------------------------------------------
	function Lesson_createHtmlDom() {
		var hPages = jQuery(njs_helper.fmt2("<div class='njsSlides mode_{}'></div>", 
							this.renderCtx.launchMode()));
		for (var i = 0; i < this.pages.length; i++) {
			hPages.append(this.pages[i].createHtmlDom());
		}
		jQuery('#l_html').append(hPages);
	}
	
	function Lesson_onEscape() {
		var pgNo = this.getCurrentPageNo();
		var curPage = this.pages[pgNo];
		if (!curPage) return false;
		return curPage.onEscape();
	}

	function Lesson_preRender(newPgNo) {
        var newPage = this.postRenderingQueue.adjustAndUpdate(newPgNo);
        if (!newPage) return;
        if (this.renderCtx.lessonMode() == 'edit') return;
		this.globals.animationManager.hidePage(newPage);
        this.stopAudio();
        this.globals.audioManager.play(newPage.getPageId());
        if (newPage.autoVoiceButton) newPage.autoVoiceButton.play();
	}

	function Lesson_postRender() {
		var pgNo = this.getCurrentPageNo();
		this.postRenderingQueue.postRenderPage(pgNo);
		this.showOrHideZodiIcon();
		this.showOrHideDoToggleIcon();
		showCommentIndicator();
		_showOrHideToolbar();
	}

    function _showOrHideToolbar() {
        var tb = jQuery('.toolBar');
        if (tb.width() > 20)
            tb.css({opacity: 1}); // Toolbar not empty
        else
            tb.css({opacity: 0});
    }

    //#############################################################################################
    // Class lesson post rendering que
    //#############################################################################################
    function PostRenderingQueue(lesson) {

        this.renderedPages = {};
        this.updatedPages = {};
        this.zodiCompletedPages = {};

        this.initZodi = function() {
            this.zodiCompletedPages = lesson.renderCtx.playerGetZodiChangesPages(lesson);
        };

        this.initQueue = function(bDontUpdate) {
            this.renderedPages = {};
            if (bDontUpdate) return;
            this.updatedPages = {};
        };

        this.markFroRedraw = function(pageId) {
            if (pageId in this.renderedPages) {
                delete this.renderedPages[this.pageId];
            }
            if (pageId in this.updatedPages) {
                delete this.updatedPages[this.pageId];
            }
        };
        
        this.adjustAndUpdate = function(pgNo) {
            return _adjustAndUpdate(this, pgNo);
        };

        var _debouncePreloadPagesCookie = {};
        this.postRenderPage = function(pgNo) {
            if (pgNo < 0 || pgNo >= lesson.pages.length) return;
            var curPage = lesson.pages[pgNo];
            curPage.postRender();
            var self = this;
            nittio.debounce(500, function() {
                _preLoadOtherPages(self, pgNo);
            }, _debouncePreloadPagesCookie)();
        };

        function _preLoadOtherPages(self, pgNo) {
            var pgStart = pgNo - 4;
            if (pgStart < 0) pgStart = 0;
            var pgEnd = pgStart + 10;
            if (pgEnd >= lesson.pages.length) pgEnd = lesson.pages.length;
            for (var i=pgStart; i<pgEnd; i++) {
                var curPage = lesson.pages[i];
                var pageId = curPage.getPageId();
                if (pageId in self.renderedPages) continue;
                _adjustAndUpdateInQueue(self, i);
            }
        }
        
        function _adjustAndUpdateInQueue(self, pgNo) {
            MathJax.Hub.Queue(function(){
                _adjustAndUpdate(self, pgNo);
            });
        }
        
        function _adjustAndUpdate(self, pgNo) {
            if (pgNo < 0 || pgNo >= lesson.pages.length) return null;
            var curPage = lesson.pages[pgNo];
            var pageId = curPage.getPageId();
            if (pageId in self.renderedPages) return curPage;

            if (pageId in self.zodiCompletedPages) {
                lesson.reRenderAsReport(pgNo);
                delete self.zodiCompletedPages[pageId];
            } else {
                if (!(pageId in self.updatedPages)) curPage.updateHtmlDom();
                curPage.adjustHtmlDom();
            }
            self.updatedPages[pageId] = true;
            self.renderedPages[pageId] = true;
            return curPage;
        };
    }
    
	//--------------------------------------------------------------------------------------------
	// Lesson Methods - Zodi related
	//--------------------------------------------------------------------------------------------
	function Lesson_showOrHideZodiIcon() {
		if (this.renderCtx.launchMode() == 'edit') return;
		
		if (_shallShowZodi(this)) {
			jQuery('#ask_zodi_icon').show();
		} else {
			jQuery('#ask_zodi_icon').hide();		
		}
	}
	
	function _shallShowZodi(lesson) {
		var curPage = lesson.pages[lesson.getCurrentPageNo()];
		if ('hint' in curPage.oPage && curPage.oPage.hint != '') return true;
		if (curPage.getMaxScore() > 0) return true;
		return false;
	}

	function Lesson_showOrHideDoToggleIcon() {
		if (this.renderCtx.launchMode() != 'do') return;
		
		var curPage = this.pages[this.getCurrentPageNo()];
		if (this.renderCtx.pageCtx(curPage) != 'do_zodi' && curPage.pagetype.isDoToggleSupported()) {
			curPage.reRenderDoMode();
			jQuery('#do_toggle_icon').show();
		} else {
			jQuery('#do_toggle_icon').hide();		
		}
	}
	
	function Lesson_showPageReport(bFeedback) {
        this.updateScore();
		if(bFeedback){
			var pageNo  = this.getCurrentPageNo();
			var curPage = this.pages[pageNo];
			var score = curPage.getScore();
			var maxScore = curPage.getMaxScore();
			if (maxScore > 0 && score == maxScore)
				this.reRenderAsReport(this.getCurrentPageNo());
		}		
		_showPageHint(this);		
	}

    var _zodiIcons = {
        'wrong': 'ion-close-circled forange',
        'warn': 'ion-alert-circled forange',
        'partial': 'ion-ios-circle-filled fyellow',
        'correct': 'ion-checkmark-circled fgreen'
    };
    
	function _showPageHint(lesson) {
		var ret = _getZodiData(lesson);
        var content = ret.icon ? njs_helper.fmt2('<i class="icon fsh4 {}"></i><span class="padding-mid"></span>',
            _zodiIcons[ret.icon]) : '';
        content = njs_helper.fmt2('<div class="padding-bottom">{}<span class="fsh6">{}</span></div>', content, ret.help);
        if (ret.hint)
            content += njs_helper.fmt2('<div>{}</div>', ret.hint);
        content = njs_helper.fmt2('<div class="padding">{}</div>', content);
		njs_helper.Dialog.popup(ret.title, content, undefined, undefined, njs_helper.Dialog.sizeLarge());
	}

	function _getZodiData(lesson) {
		var oLesson = lesson.oLesson;
		var pageNo = lesson.getCurrentPageNo();
		var curPage = lesson.pages[pageNo];
		var isDoMode = lesson.renderCtx.launchMode() == 'do';

		var ret = {help: '', icon: ''};
		
		var tempData = {lessPara: true};
		ret.hint = ('hint' in curPage.oPage) ? njs_lesson_markup.markupToHtml(curPage.oPage.hint, tempData) : '';
		var score = curPage.getScore();
		var maxScore = curPage.getMaxScore();
		
		if (maxScore <= 0) {
			ret.title = 'Know more';
			return ret;
		}

		if (lesson.oLesson.notAnswered.indexOf(pageNo) > -1) {
            ret.icon = 'warn';
			ret.title = 'Not answered';
            ret.help = isDoMode ? 'You have not answered. Please choose an answer and check again.'
                : 'No answer was provided';
            if (isDoMode) ret.hint = '';
			return ret;
		}
			
		if (score == 0) {
			ret.icon = 'wrong';
			ret.title = 'Incorrect';
            ret.help = isDoMode ? 'Oops - that is not right. Please try again.'
                : 'Answer chosen was not correct.';
			return ret;
		}

		if (score == maxScore)  {
			ret.icon = 'correct';
			ret.title = 'Correct';
			ret.help = isDoMode ? 'Well done. You got it right.'
                : 'Answer chosen was correct.';
			return ret;
		}

		ret.icon = 'partial';
        ret.title = 'Partially correct';
		ret.help = isDoMode ? 'You got some parts correct. Please try again.'
            : 'Answer chosen was partially correct.';
		return ret;
	}
	
	function Lesson_updateContent() {
		this.oLesson.maxScore = 0;
		for (var i = 0; i < this.pages.length; i++) {
			this.oLesson.maxScore += this.pages[i].getMaxScore();
		}

		if (this.renderCtx.launchMode() != 'edit') {
			return;
		}

		// Update all section texts first
		for (var i = 0; i < this.pages.length; i++) {
			this.pages[i].updateContent();
		}

        if (this.oLesson.passScore === '') delete this.oLesson.passScore;
        else {
            this.oLesson.passScore = parseInt(this.oLesson.passScore);
            if (isNaN(this.oLesson.passScore) || this.oLesson.passScore < 0 || 
                this.oLesson.passScore > 100) delete this.oLesson.passScore;
            var td = this.parentTemplateContents.templateDefaults;
            if (td.passScore == this.oLesson.passScore) delete this.oLesson.passScore;
        }
	}
	
	function Lesson_getContent() {
		this.updateContent();
		this.updateScore();
        _Lesson_updateLearningData(this);
		var ret = JSON.stringify(this.oLesson);
		return ret;
	}
	
    function _Lesson_getPrunedContent(lesson, jContent) {
        var content = jQuery.parseJSON(jContent);
        if (!lesson.oLesson.storePrunedReport) return jContent;
        if (njs_scorm.getScormLmsLessonMode() !== null) {
            _Lesson_updateLearningData(lesson);
            content.learningData = lesson.oLesson.learningData;
        }
        delete content.pages;
        delete content.templatePageTypes;
        delete content.templateAnimations;
        delete content.templateStylesCss;
        delete content.templateBgimgs;
        delete content.templateIcons;
        return JSON.stringify(content);
    }

    var _ldAttrList = [
        {name: 'currentPageNo'}, 
        {name: 'started'}, 
        {name: 'ended'}, 
        {name: 'timeSpentSeconds'}, 
        {name: 'score'}, 
        {name: 'passScore', noCopyBack: true}, // Not needed to copy back
        {name: 'maxScore', noCopyBack: true}, // Not needed to copy back
        {name: 'answered', noMinify: true}, 
        {name: 'partAnswered', noMinify: true}, 
        {name: 'notAnswered', noMinify: true}, 
        {name: 'pagesFiltered'}];

    var _ldPageAttrList = [
        {name: 'pageNo', noCopyBack: true, noCopyFrom: true, noMinify: true}, 
        {name: 'title', noCopyBack: true, noCopyFrom: true, noMinify: true}, 
        {name: 'score', noMinify: true}, 
        {name: 'scoreOverride', noMinify: true},
        {name: 'maxScore', noCopyBack: true, noMinify: true},
        {name: 'pageMaxScore', noCopyBack: true, noMinify: true},
        {name: 'answered', noMinify: true},
        {name: 'remarks', noMinify: true},
        {name: 'notes', noMinify: true},
        {name: 'feedback', noMinify: true}];
        
    var _ldSectionAttrList = [
        {name: 'sectionNumber', noCopyBack: true, noCopyFrom: true},
        {name: 'answer'}, 
        {name: 'correctanswer'}];

    function Lesson_minifyLearningData(ld) {
        var minifiedLd = {};
        for(var i=0; i<_ldAttrList.length; i++) {
            if (_ldAttrList[i].noMinify) continue;
            _copyIf(ld, minifiedLd, _ldAttrList[i].name, ''+i);
        }
        minifiedLd['' + _ldAttrList.length] = {};
        var pages = minifiedLd['' + _ldAttrList.length];
        var ldPages = ld.pages || {};
        for(var p in ldPages) {
            var ldPage = ldPages[p];
            pages[p] = {};
            var page = pages[p];
            for(var i=0; i<_ldPageAttrList.length; i++) {
                if (_ldPageAttrList[i].noMinify) continue;
                _copyIf(ldPage, page, _ldPageAttrList[i].name, ''+i);
            }
            var sections = [];
            var ldSections = ldPage.sections || [];
            for(var i=0; i<ldSections.length; i++) {
                var ldSection = ldSections[i];
                var section = {};
                for(var j=0; j<_ldSectionAttrList.length; j++) {
                    _copyIf(ldSection, section, _ldSectionAttrList[j].name, ''+j);
                }
                sections.push(section);
            }
            if (sections.length > 0) page['' + _ldPageAttrList.length] = sections;
        }
        var minified = JSON.stringify(minifiedLd);
        return minified;
    }
    
    function Lesson_unminifyLearningData(minified) {
        var minifiedLd = jQuery.parseJSON(minified);
        var ld = {};

        for(var i=0; i<_ldAttrList.length; i++) {
            _copyIf(minifiedLd, ld, ''+i, _ldAttrList[i].name);
        }
        var minPages = minifiedLd['' + _ldAttrList.length] || {};
        ld.pages = {};
        for(var p in minPages) {
            var minPage = minPages[p];
            ld.pages[p] = {};
            var page = ld.pages[p];
            for(var i=0; i<_ldPageAttrList.length; i++) {
                _copyIf(minPage, page, ''+i, _ldPageAttrList[i].name);
            }
            page.sections = [];
            var sections = page.sections;
            var minSections = minPage['' + _ldPageAttrList.length] || [];
            for(var i=0; i<minSections.length; i++) {
                var minSection = minSections[i];
                var section = {};
                for(var j=0; j<_ldSectionAttrList.length; j++) {
                    _copyIf(minSection, section, ''+j, _ldSectionAttrList[j].name);
                }
                sections.push(section);
            }
        }
        return ld;
    }

	function _Lesson_updateLearningData(lesson) {
        if (!lesson.oLesson.learningData) lesson.oLesson.learningData = {};
        var ld = lesson.oLesson.learningData;
        
        if (lesson.renderCtx.launchMode() != 'do' && 
            !lesson.renderCtx.canEditScore()) return;
        
        for(var i=0; i<_ldAttrList.length; i++) {
            if (_ldAttrList[i].noCopyFrom) continue;
            _copyIf(lesson.oLesson, ld, _ldAttrList[i].name);
        }
        
        if (!ld.pages) ld.pages = {};
        for(var i=0; i<lesson.pages.length; i++) {
            var oPage = lesson.pages[i].oPage;
            var title = oPage.sections && oPage.sections[0] ? oPage.sections[0].text : '';
            title = njs_lesson_helper.formatTitle(title);
            if (!ld.pages[oPage.pageId]) ld.pages[oPage.pageId] = {};
            var pld = ld.pages[oPage.pageId];
            pld.pageNo = i+1;
            pld.title = title;
            pld.sections = [];

            for(var j=0; j<_ldPageAttrList.length; j++) {
                if (_ldPageAttrList[j].noCopyFrom) continue;
                _copyIf(oPage, pld, _ldPageAttrList[j].name);
            }
            for(var j=0; j < oPage.sections.length; j++) {
                var sld = {};
                var oSection = oPage.sections[j];
                var shallAdd = false;
                for(var k=0; k<_ldSectionAttrList.length; k++) {
                    if (_ldSectionAttrList[k].noCopyFrom) continue;
                    if (!oSection[_ldSectionAttrList[k].name]) continue;
                    shallAdd = true;
                    _copyIf(oSection, sld, _ldSectionAttrList[k].name);
                }
                if (!shallAdd) continue;
                sld.sectionNumber = j;
                pld.sections.push(sld);
            }
        }
	}

    function _Lesson_updateOLessonFromLearningData(lesson) {
        var ld = lesson.oLesson.learningData;
        if (!ld) return;

        for(var i=0; i<_ldAttrList.length; i++) {
            if (_ldAttrList[i].noCopyBack) continue;
            _copyIf(ld, lesson.oLesson, _ldAttrList[i].name);
        }
    }
    
    function _Lesson_updateOPageFromLearningData(oPage, lesson) {
        var ld = lesson.oLesson.learningData;
        if (!ld || !ld.pages) return;
        var pld = ld.pages[oPage.pageId];
        if (!pld) return;
        for(var i=0; i<_ldPageAttrList.length; i++) {
            if (_ldPageAttrList[i].noCopyBack) continue;
            _copyIf(pld, oPage, _ldPageAttrList[i].name);
        }
        if (!pld.sections) return;
        for(var i=0; i<pld.sections.length; i++) {
            var sectionNumber = pld.sections[i].sectionNumber || i;
            if (sectionNumber >= oPage.sections.length) break;
            for(var j=0; j<_ldSectionAttrList.length; j++) {
                if (_ldSectionAttrList[j].noCopyBack) continue;
                _copyIf(pld.sections[i], oPage.sections[sectionNumber], _ldSectionAttrList[j].name);
            }
        }
    }
    
    function _copyIf(src, dest, attr, destAttr) {
        if (!destAttr) destAttr = attr;
        if (attr in src) dest[destAttr] = src[attr];
    }

	function Lesson_updateScore() {
		if (this.renderCtx.launchMode() == 'do') {
			this.updateScoreDo();
		} else if (this.renderCtx.canShowScore()) {
			this.updateScoreReport();
		}
	}

	function Lesson_updateScoreReport() {
		this.oLesson.score = 0;
		for (var i = 0; i < this.pages.length; i++) {
			var pageScore = ('score' in this.oLesson.pages[i]) ? this.oLesson.pages[i].score : 0;
			this.oLesson.score += pageScore;
		}
	}
	
	function Lesson_updateScoreDo() {		
        if (njs_scorm.getScormLmsLessonMode() !== null) return;
		this.oLesson.maxScore = 0;
		this.oLesson.score = 0;
		this.oLesson.answered = [];
		this.oLesson.notAnswered = [];
        this.oLesson.partAnswered = [];
		for (var i = 0; i < this.pages.length; i++) {
			var pageMaxScore = this.pages[i].getMaxScore();
			this.oLesson.maxScore += pageMaxScore;
			var pageScoreInfo = this.pages[i].computeScore();
			if (pageMaxScore != 0) {
				if ('scoreOverride' in this.oLesson.pages[i]) pageScoreInfo[1] = this.oLesson.pages[i].scoreOverride;
				this.oLesson.pages[i].score = pageScoreInfo[1];
				this.oLesson.score += pageScoreInfo[1];
			}
			if (pageScoreInfo[0] == npagetypes.ANSWERED_YES) {
				this.oLesson.answered.push(i);
			} else if (pageScoreInfo[0] == npagetypes.ANSWERED_PART) {
				this.oLesson.partAnswered.push(i);
			} else if (pageScoreInfo[0] == npagetypes.ANSWERED_NO) {
				this.oLesson.notAnswered.push(i);
			}
		}
	}
		
	function Lesson_submitReport() {
		this.updateScore();
		njs_lesson_helper.SubmitAndScoreDialog.showSubmitWindow(this);
	}

    function Lesson_stopAudio() {
        this.globals.audioManager.pauseAll();
		this.globals.autoVoice.stop();
    }
    
	function Lesson_setupOnLeavePage() {
		jQuery('#l_content').val(this.getContent());
		this.lastSavedContent = jQuery('#l_content').val();
		var lesson = this;
		window.onbeforeunload = function(e) {
			var lessonId = jQuery('#l_lessonId').val();
			if (nittio.getOnLeaveCheck() && lessonId != "0") {
				lesson.stopAudio();
		        lesson.globals.animationManager.clearAnimations();
				if ((lesson.renderCtx.launchCtx() != 'do_review') && (lesson.lastSavedContent != lesson.getContent())) {
					return "Warning: there are some un-saved data in this page.";
				}
				if (njsCommentEditor.isValid() && njsCommentEditor.theLessonComment.isModified()) {
					return "Warning: there are some un-saved comments in this page.";
				}
			}
		};
		return true;
	}

    function Lesson_updateState(newState) {
        this.oLesson.state = newState;
        this.lastSavedContent = this.getContent();
    }
    
	function Lesson_saveLesson(onCompleteFn) {
		_Lesson_saveInternal(this, '/lesson/save.json/', onCompleteFn, false, false);
	}
	
	function Lesson_saveLessonRaw(onCompleteFn) {
		_Lesson_saveInternal(this, '/lesson/save.json/', onCompleteFn, true, false);
	}
	
	function Lesson_saveComments(onCompleteFn) {
		_Lesson_saveInternal(this, '/lesson/lessoncomment_save.json/', onCompleteFn, false, false);
	}
	
	function Lesson_saveAssignReport(backgroundTask) {
		_Lesson_saveInternal(this, '/lesson/save_report_assign.json/', null, 
		                            false, false, backgroundTask);
	}
	
	function Lesson_submitAssignReport() {
		var redirUrl = njs_helper.fmt2('/lesson/view_report_assign/{}#/', jQuery('#l_lessonId').val());
		if ('learnmode' in this.oLesson && this.oLesson.learnmode == 3) {
			// LEARNMODE_TEST - do not open the report; go to home page
			redirUrl = '/';
		}
		_Lesson_saveInternal(this, '/lesson/submit_report_assign.json/', function(data, isError) {
			if (isError) return;
			if (njs_scorm.getScormLmsLessonMode() !== null) return;
            if (njs_scorm.nlPlayerType() == 'sco') {
			    nittio.redirDelay('res/static/html/done.html', 0, true);
			    return;
			} else if (njs_scorm.nlPlayerType() == 'embedded') {
			    njs_scorm.postSubmitLesson();
			    return;
			}
			nittio.redirDelay(redirUrl, 1000, true);
		}, false, true);
	}

    var AUTOSAVE_TIMEOUT = 60; // Auto save every one minute	
    function _Lesson_setupAutoSave(lesson) {
        // Autosave only when doing assignments
        if (lesson.renderCtx.launchCtx() != 'do_assign') return;
        if (njs_scorm.getScormLmsLessonMode() !== null) return;

        var onCompleteFn = null;
        window.setInterval(function() {
            var idleMonitor = window.nlapp.nl.idleMonitor;
            if (idleMonitor.getIdleSeconds() > AUTOSAVE_TIMEOUT + 5) {
                // No activity for more that one autosave period
                lesson.sessionStartTime = new Date(); // For timeSpentCalculations
                return;
            }
            lesson.saveAssignReport(true);
        }, AUTOSAVE_TIMEOUT*1000);
    }

	function _Lesson_saveInternal(lesson, ajaxUrl, onCompleteFn, bRaw, bForce, backgroundTask) {
	    var _onComplete = function(data, isError) {
	        if (onCompleteFn) onCompleteFn(data, isError);
	        return isError;
	    };
	    
        var syncManager = njs_helper.SyncManager.get();
        var _saveToServer = function(ajaxParams) {
            var unPrundedContent = ajaxParams.content;
            ajaxParams.content = _Lesson_getPrunedContent(lesson, unPrundedContent);
            syncManager.postToServer(ajaxUrl, ajaxParams, true, backgroundTask,
                function(data, isError) {
                if (!isError) {
                    lesson.lastSavedContent = unPrundedContent;
                    if (njsCommentEditor.isValid()) njsCommentEditor.on_comment_save(data);
                }
                _onComplete(data, isError);
            });
        };

        var ajaxParams = {content: '', lessonId: jQuery('#l_lessonId').val(), 
                          comments: '', responses: ''};
        var bComment = _Lesson_saveUpdateCommentData(ajaxParams);
	    if (bRaw) {
	        ajaxParams.content = jQuery('#l_content').val();
	        _saveToServer(ajaxParams);
	        return false;
	    }

        if (lesson.renderCtx.launchMode() == 'do') {
            _Lesson_saveUpdatePgNo(lesson);
            _Lesson_saveUpdateTime(lesson);
        }
		ajaxParams.content = lesson.getContent();
		jQuery('#l_content').val(ajaxParams.content);
        if (!bForce && !bComment && lesson.lastSavedContent == ajaxParams.content) {
            if(!syncManager.syncInProgress && !backgroundTask) {
                njs_helper.Dialog.popupStatus('There are no changes to save');
            }
            return _onComplete(null, false);
		}

        if (lesson.renderCtx.lessonMode() == 'edit') {
            _Lesson_saveUpdateVersion(lesson);
            ajaxParams.content = lesson.getContent();
        }
		
		if (njs_scorm.saveLesson(ajaxUrl, ajaxParams)) {
            lesson.lastSavedContent = ajaxParams.content;
            return _onComplete(null, false);
		}
        _saveToServer(ajaxParams);
		return false;
	}

    function _Lesson_saveUpdatePgNo(lesson) {
        var pgNo = lesson.getCurrentPageNo();
        lesson.oLesson.currentPageNo = pgNo;
    }
    
    function _Lesson_saveUpdateTime(lesson) {
        var pgNo = lesson.getCurrentPageNo();
        lesson.globals.pageTimer.canChangeSlides(pgNo);
        if (!('sessionStartTime' in lesson)) return;
        var now = new Date();
        var timeSpentSeconds = parseInt((now.valueOf() - lesson.sessionStartTime.valueOf())/1000);
        lesson.sessionStartTime = now;
        if ('timeSpentSeconds' in lesson.oLesson) lesson.oLesson.timeSpentSeconds += timeSpentSeconds;
    }

    function _Lesson_saveUpdateVersion(lesson) {
        var saveVersion = lesson.oLesson.saveVersion || 0;
        lesson.oLesson.saveVersion = saveVersion+1;
    }

    function _Lesson_saveUpdateCommentData(ajaxParams) {
        if(!njsCommentEditor.isValid()) return false;
        var commentsData = njsCommentEditor.theLessonComment.getDataForSave();
        ajaxParams.comments = JSON.stringify(commentsData.comments);
        ajaxParams.responses = JSON.stringify(commentsData.responses);
        return commentsData.modified;
    }
            
	function __setCustomLayout(oPage, layout) {
		if (layout.length == 0) {
			if ('sectionLayout' in oPage) delete oPage.sectionLayout;
		} else {
			oPage.sectionLayout = jQuery.parseJSON(JSON.stringify(layout)); // Deep copy
		}
	}

	function Lesson_addPage(pageType, customLayout) {
		var curPos = this.getCurrentPageNo();
		var hCurPage = this.pages[curPos].hPage;

		var newPage = new Page(this);
		var oPage = newPage.createOPage(pageType);
		__setCustomLayout(oPage, customLayout);
		var hNewPage = newPage.initDom(oPage, this.bgimg);

		hNewPage.insertAfter(hCurPage);
		this.pages.splice(curPos + 1, 0, newPage);
		this.oLesson.pages.splice(curPos + 1, 0, newPage.oPage);
		
		this.globals.slides.reinit();
		this.globals.slides.next();
		return true;
	}

	function Lesson_changePageType(pageType, customLayout) {
		var pageNo = this.getCurrentPageNo();
		var curPage = this.pages[pageNo];
		var hCurPage = curPage.hPage;

		curPage.updateContent();
		curPage.oPage.type = pageType;
		__setCustomLayout(curPage.oPage, customLayout);
		var hNewPage = curPage.initDom(curPage.oPage, curPage.bgimg);
		
		hNewPage.insertAfter(hCurPage);
		hCurPage.remove();
		
		this.globals.slides.reinit();
		this.globals.slides.gotoPage(pageNo);
		return true;
	}

	function Lesson_reinitSlides(samePageAnimation) {
		this.globals.slides.reinit();
		var pageCount = this.globals.slides.getPageCount();

		var pageNo = this.globals.slides.getCurPageNo();
		if (pageNo > pageCount - 1) {
			pageNo = pageCount - 1;
			samePageAnimation = -1;
		}
		if (pageNo < 0) pageNo = 0;

		this.globals.slides.gotoPage(pageNo, samePageAnimation);
	}

	function Lesson_swapPage(swapStart) {
		var hPg1 = this.pages[swapStart].hPage.remove();
		var hPg2 = this.pages[swapStart+1].hPage;
		hPg1.insertAfter(hPg2);

		_swap(this.pages, swapStart, swapStart+1);
		_swap(this.oLesson.pages, swapStart, swapStart+1);

		return true;
	}

	function _swap(lst, a, b) {
		var temp = lst[a];
		lst[a] = lst[b];
		lst[b] = temp;
	}
	
	var clipBoard = '';
	function Lesson_cutPage(pageNo) {
		clipBoard = this.pages[pageNo].getContent();
		this.pages[pageNo].hPage.remove();
		this.oLesson.pages.splice(pageNo, 1);
		this.pages.splice(pageNo, 1);

		this.reinitSlides(1);
		return true;
	}
	
	function Lesson_copyPage(pageNo) {
		clipBoard = this.pages[pageNo].copyContent();
		return true;
	}

	function Lesson_pastePage(pageNo) {
		if (clipBoard === '') {
			return false;
		}
		var oNewPage = jQuery.parseJSON(clipBoard);
		var newPage = new Page(this);
		var hNewPage = newPage.initDom(oNewPage, this.bgimg);

		var hCurPage = this.pages[pageNo].hPage;
		hNewPage.insertAfter(hCurPage);
		this.pages.splice(pageNo + 1, 0, newPage);
		this.oLesson.pages.splice(pageNo + 1, 0, newPage.oPage);
		return true;
	}

	function Lesson_isPastable() {
		return clipBoard !== '';
	}

	function Lesson_getPageStudentNotes() {
		var oPage = this.pages[this.getCurrentPageNo()].oPage;
		if ('notes' in oPage) {
			return oPage.notes;
		}
		return '';
	}

	function Lesson_setPageStudentNotes(notes) {
		var oPage = this.pages[this.getCurrentPageNo()].oPage;
		oPage.notes = notes;
	}

	function Lesson_getPageTeacherRemarks() {
		var oPage = this.pages[this.getCurrentPageNo()].oPage;		
		if ('remarks' in oPage) {
			return oPage.remarks;			
		}
		return '';
	}

	function Lesson_setPageTeacherRemarks(remarks) {
		var oPage = this.pages[this.getCurrentPageNo()].oPage;		
		oPage.remarks = remarks;
	}
	
	function Lesson_isPageScoreEditable() {
		var page = this.pages[this.getCurrentPageNo()];
		return page.pagetype.isScoreEditable(page);
	}

	function Lesson_getPageMaxScore() {
		var page = this.pages[this.getCurrentPageNo()];
		return page.getMaxScore();
	}

	function Lesson_getPageScore() {
		var page = this.pages[this.getCurrentPageNo()];
		return page.getScore();
	}

	function Lesson_setPageScore(score) {
		var oPage = this.pages[this.getCurrentPageNo()].oPage;
		oPage.score = Number(score);
		oPage.scoreOverride = oPage.score;
	}

	function Lesson_search(searchStr) {
		if (searchStr == '') return false;
		for (var pageNo in this.pages) {
			var p = parseInt(pageNo);
			var pageJson = JSON.stringify(this.pages[p].oPage);
			if (pageJson.indexOf(searchStr) == -1) continue;
			if (this.getCurrentPageNo() == p) return true;
			this.globals.slides.gotoPage(p, 0, true);
			njs_helper.Dialog.popupStatus(njs_helper.fmt2('"{}" found in page {}', searchStr, p+1));
			return true;
		}
		return false;
	}

    function _Lesson_filterPages(self) {
        if (self.oLesson.pagesFiltered) {
            var pages = self.oLesson.pages;
            var pageIdDict = {};
            for(var i=0; i<pages.length; i++) {
                pageIdDict[pages[i].pageId] = pages[i];
            }
            var newPages = [];
            var filtered = self.oLesson.pagesFiltered;
            for(var i=0; i<filtered.length; i++) {
                newPages.push(pageIdDict[filtered[i]]);
            }
            self.oLesson.pages = newPages;
            return;
        }
        // Filter out question bank extra pages and "editor's notes" pages
        if (self.renderCtx.launchCtx() != 'do_assign') return;
        var oLesson = self.oLesson;
        var pages = oLesson.pages;
        var allowedMaxScore = parseInt(oLesson.allowed_max_score);
        var pageInfos = [];
        var randPosArray = [];
        
        for(var i in pages) {
            var p = pages[i];
            if (p.visibility == 'editor') {
                pageInfos.push({pos: i, maxScore: 0, newPos: -1});
                continue;
            }
            if (!allowedMaxScore) {
                pageInfos.push({pos: i, maxScore: 0, newPos: i});
                continue;
            }
            var maxScore = ('pageMaxScore' in p) ? p.pageMaxScore
                : ('maxScore' in p) ? p.maxScore
                : npagetypes.getPageTypeAttribute(p.type, 'score', 0);
            if (!maxScore) {
                pageInfos.push({pos: i, maxScore: 0, newPos: i});
                continue;
            }
            randPosArray.push(i);
            pageInfos.push({pos: i, maxScore: maxScore, shallFilter: true});
        }
        
        var positions = njs_helper.randSet(pages.length, randPosArray);
        for(var i in pageInfos) {
            if ('newPos' in pageInfos[i]) continue;
            pageInfos[i].newPos = positions[i];
        }
        pageInfos.sort(function(a, b) {
            return (a.newPos - b.newPos);
        });
        var newPages = [];
        var maxScore = 0;
        if (!self.oLesson.pagesFiltered) self.oLesson.pagesFiltered = [];
        for(var i in pageInfos) {
            if (pageInfos[i].newPos < 0) continue;
            var newMaxScore = maxScore + pageInfos[i].maxScore;
            if (pageInfos[i].shallFilter && newMaxScore > allowedMaxScore) {
                continue;
            }
            maxScore += pageInfos[i].maxScore;
            var oPage = pages[pageInfos[i].pos];
            newPages.push(oPage);
            self.oLesson.pagesFiltered.push(oPage.pageId);
        }
        self.oLesson.pages = newPages;
    }
	//#############################################################################################
	// Class modelling a Page in lesson
	//#############################################################################################
	function Page(lesson) {
		this.lesson = lesson;

		// Getters for basic properties
		this.getPageId = Page_getPageId;		
		this.getPageIdStr = Page_getPageIdStr;
		this.getPageAnimations = Page_getPageAnimations;
		this.setNextTabIndex = Page_setNextTabIndex;
		
		// Initialize and render
		this.initDom = Page_initDom;
		this.reRenderDoMode = Page_reRenderDoMode;
		this.reRender = Page_reRender;
		this.updatePagePropertiesDom = Page_updatePagePropertiesDom;
		this.init = Page_init;
		this.createHtmlDom = Page_createHtmlDom;

		this.updateHtmlDom = Page_updateHtmlDom;
        this.updateAudio = Page_updateAudio;
        this.updateBgImg = Page_updateBgImg;
		this.adjustHtmlDom = Page_adjustHtmlDom;
		this.markFroRedraw = Page_markFroRedraw;

		this.updateContent = Page_updateContent;
		this.getContent = Page_getContent;
		this.copyContent = Page_copyContent;

		this.updateFontSizes = Page_updateFontSizes;
		this.onEscape = Page_onEscape;
		this.postRender = Page_postRender;
		this.getMaxScore = Page_getMaxScore;
		this.getScore = Page_getScore;
		this.computeScore = Page_computeScore;

		// Utilities and internally used methods
		this.initPageTypeObject = Page_initPageTypeObject;
		this.createOPage = Page_createOPage;
		this.createOSection = Page_createOSection;
	}

	//---------------------------------------------------------------------------------------------
	// Getters for basic properties
	//---------------------------------------------------------------------------------------------
	function Page_getPageId() {
		return JSON.stringify(this.pageId);
	}

	function Page_getPageIdStr() {
		return njs_helper.fmt2('id{}', this.pageId);
	}
	
	function Page_getPageAnimations(){
		if (this.oPage.animations) return this.oPage.animations;
		var animScheme = this.lesson.globals.animationManager.getAnimationScheme(this.lesson) || {};
		return animScheme[this.oPage.type] || [];
	}
	
	function Page_setNextTabIndex(domElem) {
		domElem.attr('tabindex', 1);
	}

	//---------------------------------------------------------------------------------------------
	// Initialize and render
	//---------------------------------------------------------------------------------------------
	function Page_initDom(oPage, bgimg) {
		this.init(oPage, bgimg);
		var ret = this.createHtmlDom();
		return ret;
	}
	
	function Page_reRenderDoMode() {
		if (!('reRenderedList' in this.lesson)) return;
		if (this.pageId in this.lesson.reRenderedList) return;

		if (this.lesson.renderCtx.pageCtx(this) == 'do_pv') {
			this.pagetype.getScoreFn()(this); // score it to update results
		}

		this.reRender(false);
		this.lesson.reRenderedList[this.pageId] = true;
	}
	
	function Page_reRender(bAsReport) {
		for (var i=0; i<this.sections.length; i++) {
			this.sections[i].reRender(bAsReport);
		}
		this.adjustHtmlDom();
	}

	function Page_updatePagePropertiesDom(pgNo) {
		this.markFroRedraw();
        this.updateAudio();
        this.updateBgImg();
        this.lesson.preRender(pgNo);
        this.lesson.postRender();
	}
	
	//---------------------------------------------------------------------------------------------
	// Initialize and render - internal methods
	//---------------------------------------------------------------------------------------------
	function Page_init(oPage, bgimg) {
        _Lesson_updateOPageFromLearningData(oPage, this.lesson);
		this.oPage = oPage;
		this.bgimg = bgimg;
		this.sections = [];		
		this.initPageTypeObject();
		this.pageId = Page_allocatePageId(oPage, this.lesson);
		this.markFroRedraw();

		this.oPage.maxScore = this.getMaxScore();
		var len = this.oPage.sections.length;
		var neededLen = this.pagetype.getSectionCount();

		// add sections if needed
		for (var i = len; i < neededLen; i++) {
			this.oPage.sections.push(this.createOSection());
		}

		// remove extra sections if present
		if (len > neededLen) {
			this.oPage.sections.splice(neededLen, len - neededLen);
		}

		this.sectionCreateOrder = njs_helper.randSet(neededLen, this.pagetype.getRandomizableElems());
		for (var i = 0; i < neededLen; i++) {
			var so = new Section(this, this.lesson);
			so.init(this.oPage.sections[i], i, this.sectionCreateOrder[i]);
			this.sections.push(so);
		}
	}

	function Page_createHtmlDom() {
		var hPage = njs_helper.jobj(njs_helper.fmt2('<section id="{}" class="{}"/>', 
            this.getPageIdStr(), g_lesson.globals.templateCssClass));
        this.hPage = hPage;
        var newBg = this.updateBgImg();
		this.setNextTabIndex(newBg);

		var hPageHolder = njs_helper.jobj('<div class="pgHolder" />');
		this.hPageHolder = hPageHolder;
		//this.lesson.globals.animationManager.hidePage(this);
		hPage.append(hPageHolder);
		for (var i = 0; i < this.sections.length; i++) {
			hPageHolder.append(this.sections[i].createHtmlDom());
		}
		
		this.propAudio = njs_helper.jobj('<div class="pgPropAudio" />');
		hPage.append(this.propAudio);
		return hPage;
	}
	
	function Page_updateHtmlDom() {
		this.updateContent();
		for (var i = 0; i < this.sections.length; i++) {
			var pos = this.sectionCreateOrder[i];
			this.sections[pos].updateHtmlDom();
		}
		this.updateAudio();
	}

    function Page_updateAudio() {
        if(this.lesson.renderCtx.pageMode(this) == 'edit') {
            this.propAudio.html('');
            this.autoVoiceButton = null;
            this.lesson.stopAudio();
            return;
        }

        this.autoVoiceButton = null;
        if('audioUrl' in this.oPage && this.oPage.audioUrl) {
            var audioUrl = this.oPage.audioUrl;
            audioUrl = audioUrl.replace(/audio\:/, '');
            audioUrl = audioUrl.replace(/\[.*\]/, '');
            var audioHtml = '';
            var validUrl = audioUrl.indexOf('/');
            if( validUrl != -1) {
                audioHtml = this.lesson.globals.audioManager.getButton(audioUrl, this.getPageId());
            }
            this.propAudio.html(audioHtml);         
        } else if (this.oPage.autoVoice) {
            this.autoVoiceButton = this.lesson.globals.autoVoice.getVoiceButton(this.oPage.autoVoice);
            this.propAudio.html(this.autoVoiceButton ? this.autoVoiceButton.html : '');
        } else {
            this.propAudio.html('');
        }
    }
    
    function _removeAllTemplateStyles(elem) {
        var classList = (elem.attr('class') || '').split(/\s+/);
        var delCnt = 0;
        for(var i=0; i<classList.length; i++) {
            if (!classList[i]) {
                delCnt++;
                continue;
            }
            if (classList[i] != 'bglight' && classList[i] != 'bgdark' 
                && classList[i].indexOf('look') != 0) continue;
            delCnt++;
            elem.removeClass(classList[i]);
        }
        if (delCnt == classList.length) {
            elem.removeAttr('class');
        }
    }
	
    function Page_updateBgImg() {
        this.hPage.find('.bgimg').remove();
        var newBg = null;
        var cssClass = '';
        if (this.oPage.bgimg) {
            newBg = jQuery(njs_helper.fmt2('<img class="bgimg bgimgcustom" src="{}">', this.oPage.bgimg));
            cssClass = this.oPage.bgshade;
        } else {
            newBg = this.bgimg.clone();
            cssClass = this.lesson.globals.templateCssClass;
        }
        _removeAllTemplateStyles(this.hPage);
        this.hPage.addClass(cssClass);
        this.hPage.prepend(newBg);
        return newBg;
    }

	function Page_adjustHtmlDom() {
		var me = this;
		MathJax.Hub.Queue(['Typeset', MathJax.Hub, this.hPage.get(0)]);
		MathJax.Hub.Queue(function(){
			for (var i=0; i<me.sections.length; i++) {
				var pos = me.sectionCreateOrder[i];
                me.sections[pos].preAdjustHtmlDom();
				nittio.resizeImagesToAspectRatio(me.sections[pos].pgSecView);
			}
			me.updateFontSizes(me.lesson.getMinTextSize());
			for (var i=0; i<me.sections.length; i++) {
				var pos = me.sectionCreateOrder[i];
				me.sections[pos].adjustHtmlDom();
			}
		});
	}
	
	function Page_onEscape() {
		var bRet = false;
		this.hPage.find('.bgimg').each(function() {
			bRet = true;
			jQuery(this).focus();
		});
		return bRet;
	}
	
	function Page_postRender() {
		var me = this;
		MathJax.Hub.Queue(function() {
            if (me.lesson.renderCtx.lessonMode() != 'edit')
		        me.lesson.globals.animationManager.setupAnimation(me);
			me.onEscape();
		});
	}

	function Page_updateFontSizes(minTextSize) {
		var textSizes = {};
		for (var i=0; i<this.sections.length; i++) {
			if (!this.sections[i].adjustFontSize) continue;
			var fmtgroup = this.pagetype.getFromatGroup(i);
			njs_helper.findMinFontSizeOfGroup(this.sections[i], 
			    textSizes, fmtgroup, minTextSize);		
		}
		for (var i=0; i<this.sections.length; i++) {
			if (!this.sections[i].adjustFontSize) {
				njs_helper.clearTextResizing(this.sections[i]);
				continue;
			}
			var fmtgroup = this.pagetype.getFromatGroup(i);
			njs_helper.resizeText(this.sections[i], textSizes[fmtgroup], minTextSize);
		}
	}
	
	function Page_markFroRedraw() {
	    this.lesson.postRenderingQueue.markFroRedraw(this.pageId);
	}

	//---------------------------------------------------------------------------------------------
	// Save related
	//---------------------------------------------------------------------------------------------
	function Page_updateContent() {
		for (var j = 0; j < this.sections.length; j++) {
			var section = this.sections[j];
			section.updateContent();
		}
	}
	
	function Page_getContent() {
		this.updateContent();
		var ret = JSON.stringify(this.oPage);		
		return ret;
	}
	
	function Page_copyContent() {
		this.updateContent();
		filterFn = function(key, value){
			if(key == 'pageId') return undefined;
			return value;
		};
		var ret = JSON.stringify(this.oPage, filterFn);		
		return ret;
	}

	function Page_getMaxScore() {
		var maxScore = ('pageMaxScore' in this.oPage) ? this.oPage.pageMaxScore: this.pagetype.getMaxScore(this);
		this.oPage.maxScore = maxScore;
		return maxScore;
	}

	function Page_computeScore() {
		var fn = this.pagetype.getScoreFn();
		return fn(this);
	}
	
	function Page_getScore() {
		if ('score' in this.oPage) {
			return this.oPage.score;
		}
		return '-';
	}
	
	//---------------------------------------------------------------------------------------------
	// Utilities for Page class
	//---------------------------------------------------------------------------------------------
	function Page_allocatePageId(oPage, lesson){
		if ('pageId' in oPage) return oPage.pageId;
		if (!('newPageId' in lesson.oLesson)) lesson.oLesson.newPageId = 0;
		oPage.pageId = lesson.oLesson.newPageId++;		
		return oPage.pageId;
	}

	function Page_initPageTypeObject() {
		this.pagetype = new npagetypes.PageType();
		this.pagetype.init(this.oPage);
	}

	function Page_createOPage(pageType) {
		oPage = new Object();
		oPage.type = pageType;
		oPage.sections = [];
		return oPage;
	}
	
	function Page_createOSection() {
		ret = new Object();
		ret.type = 'txt';
		ret.text = '';
		return ret;
	}

	//#############################################################################################
	// Base class of All Section Objects
	//#############################################################################################
	function Section(page, lesson) {
		this.page = page;
		this.lesson = lesson;
		
		this.getText = Section_getText;
		this.getTemplateFromEditor = Section_getTemplateFromEditor;
		this.getTemplateFromObj = Section_getTemplateFromObj;
		this.updateContent = Section_updateContent;
		
		this.init = Section_init;
		this.createHtmlDom = Section_createHtmlDom;
		this.updateHtmlDom = Section_updateHtmlDom;
		this.getViewHtml = Section_getViewHtml;
		this.setViewHtml = Section_setViewHtml;
        this.preAdjustHtmlDom = Section_preAdjustHtmlDom;
        this.adjustHtmlDom = Section_adjustHtmlDom;
		
		this.reRender = Section_reRender;
	}
	
	function Section_getText() {
		var getSecTextFn = this.page.pagetype.getSectionTextFn();
		return getSecTextFn(this);
	}

	function Section_getTemplateFromEditor() {
		if (this.lesson.renderCtx.launchCtx() == 'edit_templ') return this.pgSecTemplate.val();
		return this.getTemplateFromObj();
	}

	function Section_getTemplateFromObj() {
		if ('template' in this.oSection && this.oSection.template != '') {
			return this.oSection.template;
		}
		return '';
	}
	
	function Section_updateContent() {
		if (this.lesson.renderCtx.launchMode() != 'edit') {
			this.getText(); // TODO: needed for side effect of cleanup in questionnaire page type. To be removed
			return;
		}

		var template = this.getTemplateFromEditor();
		var sectionTemplate = new njs_lesson_helper.SectionTemplate(template, this);
		this.oSection.text = sectionTemplate.getEditorText(this);

		if (template === '') {
			delete this.oSection.template;
		} else {
			this.oSection.template = template; 
		}
	}
	
	//---------------------------------------------------------------------------------------------
	// Section Base Methods
	//---------------------------------------------------------------------------------------------
	function Section_init(oSection, secNo, secPosShuffled) {
		// No shuffle in edit and report mode
		if (this.lesson.renderCtx.launchMode() == 'report' || this.lesson.renderCtx.launchMode() == 'edit') {
			secPosShuffled = secNo;
		}
		
		this.oSection = oSection;
		this.secNo = secNo; // Original position
		this.secPosShuffled = secPosShuffled; // Position after randomizing
	}

	function Section_createHtmlDom() {
		var pagetype = this.page.pagetype;

		// Create the pgSec DOM object
		var pgSec = njs_helper.jobj('<div class="pgSec" />');
		pgSec.css(pagetype.getSectionHalign(this.secNo));
		this.pgSec = pgSec;

		// Create the pgSecLineContainer DOM object (used in page types which have a line)
		this.pgSecLineContainer = jQuery('<div class="pgSecLineContainer"/>');
		pgSec.append(this.pgSecLineContainer);
		
		// Create the pgSecView DOM object (used in view mode)
		var secBehaviourCls = pagetype.getBehClass(this.secNo);
		if (secBehaviourCls != '') secBehaviourCls =  ' ' + secBehaviourCls;
		var aspectWrt = pagetype.getAspectWrt(this.secNo) ? ' aspect_wrt' : '';
		
        var secString = njs_helper.fmt2('<div class="pgSecView{}{}" secNo="{}"/>', aspectWrt, secBehaviourCls, this.secNo);
		this.pgSecView = njs_helper.jobj(secString);
		this.pgSecSticker = njs_helper.jobj('<div class="pgSecSticker"></div>');
		this.pgSecSticker.hide();
		this.pgSecView.append(this.pgSecSticker);
		this.secViewContent = njs_helper.jobj('<div class="secViewContent"/>');
        this.pgSecView.append(this.secViewContent);
		
		var help;
		if (this.lesson.renderCtx.launchMode() == 'report') {
			help = pagetype.getSectionHelpReport(this.secNo);
		} else {
			help = pagetype.getSectionHelpView(this.secPosShuffled);			
		}
		this.pgSecView.attr('placeholder', help);
		this.pgSecView.attr('title', help);
		this.pgSecView.attr('answer', 0);
		this.pgSecView.css(pagetype.getSectionPos(this.secPosShuffled));
        this.pgSecView.addClass(pagetype.getSectionStyle(this.secPosShuffled));
		pgSec.append(this.pgSecView);

		var template = this.getTemplateFromObj();
		
		if (this.lesson.renderCtx.launchCtx() == 'edit_templ') {
			var templHelp = njs_lesson_helper.SectionTemplate.getFieldHelp();
			this.pgSecTemplate = njs_helper.jobj('<TEXTAREA class="pgSecText"/>');
			this.pgSecTemplate.val(template);
			this.pgSecTemplate.attr('placeholder', templHelp);
			this.pgSecTemplate.attr('title', templHelp);		
			this.pgSecTemplate.css(pagetype.getSectionPos(this.secNo));
			this.pgSecTemplate.css({'text-align': 'left'});
			pgSec.append(this.pgSecTemplate);	
			this.page.setNextTabIndex(this.pgSecTemplate);
		}

		var help = pagetype.getSectionHelpEdit(this.secNo);
		
		// Create the pgSecText DOM object (used in edit mode)
		this.pgSecText = njs_helper.jobj('<TEXTAREA class="pgSecText"/>');
		this.pgSecText.val(this.oSection.text);
		this.pgSecText.attr('placeholder', help);
		this.pgSecText.attr('title', help);		
		this.pgSecText.css(pagetype.getSectionPos(this.secNo));
		pgSec.append(this.pgSecText);	
		this.page.setNextTabIndex(this.pgSecText);
		this.lesson.globals.selectionHandler.setFocusHandlers(this.page, this.secNo, this.pgSecText);
		
		var onCreateFn = this.page.pagetype.getSectionOnCreateFn(this.secNo);
		onCreateFn(this);
		return pgSec;
	}

	function Section_getViewHtml() {
		var template = this.getTemplateFromEditor();
		var sectionTemplate = new njs_lesson_helper.SectionTemplate(template, this);
		var defaultHelp = sectionTemplate.getHelp();
		if (defaultHelp === null) defaultHelp = this.pgSecText.attr('placeholder');
		var ret = sectionTemplate.getViewHtml(this, defaultHelp);
		return ret;
	}

	function Section_setViewHtml(htmlOrMarkup, bMarkup) {
		this.valignMiddle = this.page.pagetype.isSectionValignMiddle(this.secNo);		
		this.adjustFontSize = true;
        this.isTxt = false;

		var retData = {};
		var secHtml = bMarkup ? njs_lesson_markup.markupToHtml(htmlOrMarkup, retData) : htmlOrMarkup;
		if (!bMarkup || !retData.isTxt) {
			this.valignMiddle = false;
            this.adjustFontSize = false;
		}
        this.isTxt = retData.isTxt;
		this.secViewContent.html(secHtml);
	}
	
	function Section_updateHtmlDom() {
		var viewHtml = this.getViewHtml();		
		this.setViewHtml(viewHtml.html, viewHtml.isMarkup);
		var onRenderFn = this.page.pagetype.getSectionOnRenderFn();
		onRenderFn(this);

		// All section level readjustments is done here 
		njs_helper.switchoffContenxtMenu(jQuery(this.pgSecView.find('.njs_img')));
		njs_helper.switchoffContenxtMenu(jQuery(this.pgSecView.find('.njs_audio')));
		njs_helper.switchoffContenxtMenu(jQuery(this.pgSecView.find('.njs_video')));

        // Needed to workaround ionic issues
		this.secViewContent.find('select.questionnaire, select.pgSecText').each(function() {
		    var elem = jQuery(this);
            elem.off('touchstart');
            elem.on('touchstart', function(e) {
                e.stopPropagation();
            });
        });
	}

    function Section_preAdjustHtmlDom() {
        var pagetype = this.page.pagetype;
        this.pgSecView.css(pagetype.getSectionPos(this.secPosShuffled));
        this.pgSecText.css(pagetype.getSectionPos(this.secNo));
        if (this.lesson.renderCtx.launchCtx() == 'edit_templ')
            this.pgSecTemplate.css(pagetype.getSectionPos(this.secNo));
    }
    
	function Section_adjustHtmlDom() {
        njs_helper.valignMiddleAndSetScroll(this, this.valignMiddle, this.isTxt); // needed even in edit mode (for edit-gra mode)
        var self = this;
		if (this.lesson.renderCtx.lessonMode() != 'edit') {
			if (this.pdfRenderQueue !== undefined) this.pdfRenderQueue.clear();
			this.pdfRenderQueue = new njs_pdf.RenderQueue(this.pgSecView, function() {
                njs_helper.valignMiddleAndSetScroll(self, self.valignMiddle, self.isTxt);
			});
		}
		var adjustHtmlFn = this.page.pagetype.getSectionAdjustHtmlFn();
		adjustHtmlFn(this);
	}
	
	function Section_reRender(bAsReport) {
		var pagetype = this.page.pagetype;
		if (bAsReport && this.lesson.renderCtx.pageMode(this.page) == 'report'){			
			var help = pagetype.getSectionHelpReport(this.secNo);
			this.pgSecView.attr('placeholder', help);
			this.pgSecView.attr('title', help);
			this.pgSecView.css(pagetype.getSectionPos(this.secNo));
			this.pgSecView.css({'opacity':'0.4', 'cursor':'auto'});
			this.pgSecView.addClass('bright');
		}

		var onReInitFn = pagetype.getSectionOnReInitFn();
		onReInitFn(this);
		var onCreateFn = pagetype.getSectionOnCreateFn(this.secNo);
		onCreateFn(this);
		this.updateHtmlDom();
	}

	function showCommentIndicator() {
		if(g_lesson.renderCtx.launchMode() != 'edit'){
			return;
		}
		var pageId = g_lesson.getCurrentPageId();
		var clist = njsCommentEditor.theLessonComment.getOpenComments(pageId);
		
		
		var newIcon = clist.length > 0 ? 'ion-ios-chatbubble forange' : 'ion-ios-chatbubble-outline';
        njs_toolbelt.Toolbelt.updateTool('edit_icon_comment', null, newIcon, null);
	}
	
	function on_loadcomment() {			
		showCommentIndicator();
		nittio.enableButton('edit_icon_comment',true);						
	}

    //#############################################################################################
    // Section Selection Handler
    //#############################################################################################
    function SectionSelectionHandler(lesson) {
        
        var _focusedSection = {}; 
        this.setFocusHandlers = function(page, secNo, pgSecText) {
            pgSecText.focus(function() {
                _focusedSection = {page: page, secNo: secNo, pgSecText: pgSecText}; 
                console.warn('focus', _focusedSection);
            });
        };
        
        this.refocus = function() {
            if (!_isSectionSelected()) return;
            setTimeout(function() {
                _focusedSection.pgSecText.focus();
            });
        };
        
        this.getSelectedText = function(flags) {
            if (!flags) flags = {};
            if (!_isSectionSelected()) {
                if (flags.warnMsg) 
                    njs_helper.Dialog.popup('Warning', flags.warnMsg, undefined, undefined, sizes=njs_helper.Dialog.sizeSmall());
                return null;
            }
            var selected = _focusedSection.pgSecText[0];
            var selectedText = selected.value.substring(selected.selectionStart, selected.selectionEnd);
            if (flags.refocus) this.refocus();
            return selectedText;
        };
        
        this.updateSelectedText = function(newText) {
            if (!_isSectionSelected()) {
                njs_helper.Dialog.popupStatus('Sorry, no section selected');
                return;
            }
            var selected = _focusedSection.pgSecText[0];
            var newStart = selected.selectionStart;
            var newEnd = newStart + newText.length;
            newText = selected.value.substring(0, selected.selectionStart) + 
                newText + selected.value.substring(selected.selectionEnd);
            selected.value = newText;
            selected.selectionStart = newStart;
            selected.selectionEnd = newEnd;
            this.refocus();
        };
        
        function _isSectionSelected() {
            var currentPage = lesson.pages[lesson.getCurrentPageNo()];
            return (_focusedSection.pgSecText !== null && _focusedSection.secNo !== null &&
                _focusedSection.page == currentPage);
        }
    
    };

	//---------------------------------------------------------------------------------------------
	// Exposed Functions
	//---------------------------------------------------------------------------------------------
	var g_lesson = new Lesson();

	//---------------------------------------------------------------------------------------------
	// Possible launchContext values: see njs_lesson_helper.RenderingContext
	//---------------------------------------------------------------------------------------------
	var g_nlPlayerType = 'normal';
	var g_nlEmbedType = '';
    function init(launchContext, templateCssClass, nlPlayerType, nlEmbedType) {
        g_nlPlayerType = nlPlayerType;
        g_nlEmbedType = nlEmbedType;
		g_lesson.renderCtx.init(launchContext, g_lesson);
		g_lesson.globals.templateCssClass = templateCssClass;

        njs_scorm.afterInit(function() {
            g_lesson.postInitDom();
        });
		
		jQuery(function() {
			g_lesson.initDom();
		});
		
		nittio.onEscape(function() {
			return g_lesson.onEscape();
		});
		
        nittio.onResize(function() {
            if (njs_scorm.getScormLmsLessonMode() === null) g_lesson.reRender(true);
        });
        
		nittio.afterInit(function(){
			g_lesson.globals.slides = nittio.getSlidesObj();
			g_lesson.globals.slides.onSlideBeforeChange(function(curPgNo, newPgNo) {
			    if (!g_lesson.globals.pageTimer.canChangeSlides(curPgNo, newPgNo)) return false;
				g_lesson.preRender(newPgNo);
				return true;
			});
			g_lesson.globals.slides.onSlideChange(function() {
				g_lesson.postRender();
			});
            
			window.setTimeout(function() {
			    if (g_lesson.oLesson.currentPageNo && 
                    g_lesson.renderCtx.launchMode() == 'do') {
                    g_lesson.globals.slides.gotoPage(g_lesson.oLesson.currentPageNo);
                    return;
                }
				var initialSearch = jQuery('#initial_search').val();
				g_lesson.search(initialSearch);
			}, 1000);
			if(g_lesson.renderCtx.launchMode() != 'edit') return;
			nittio.enableButton('edit_icon_comment',false);
			njsCommentEditor.initCommentEditor(on_loadcomment,true);
		});
		
		nittio.printHandler(function() {
			for(var i = 0; i < g_lesson.pages.length; i++){
				g_lesson.postRenderingQueue.postRenderPage(i);
			}
		});
	}

	var g_templateDict = {};
    var g_templateList = [];
	function loadTemplateInfos(onLoadComplete) {
		if (Object.keys(g_templateDict).length > 0) {
			onLoadComplete(g_templateList);
			return;
		}

        var parentBgimgs = g_lesson.parentTemplateContents.templateBgimgs;
        var templateBgimgs = g_lesson.oLesson.templateBgimgs ? JSON.parse(g_lesson.oLesson.templateBgimgs) : [];
        templateBgimgs = _mergeArrayAttrs(parentBgimgs, templateBgimgs);
		if (templateBgimgs.length > 0) {
            templateBgimgs.sort(function(a, b) {
                if (a.group != b.group) return a.group < b.group ? -1 : 1;
                if (a.name == b.name) return 0;
                return (a.name < b.name) ? -1 : 1;
            });
		    g_templateList = templateBgimgs;
            _onTemplateInfos(true);
            onLoadComplete(g_templateList);
            return;
        }

		var _ajax = new njs_helper.Ajax(function(data, errorType, errorMsg) {
			if (errorType != njs_helper.Ajax.ERROR_NONE) return;
			g_templateList = data;
			_onTemplateInfos(false);
			onLoadComplete(g_templateList);
		});
		_ajax.send('/lesson/template_infos.json', {});
	}

	function _onTemplateInfos(bCustomList) {
        g_templateDict = {};
	    for(var i=0; i<g_templateList.length; i++) {
            var item = g_templateList[i];
            item.cssClass = njs_helper.fmt2('{} look{}', item.bgShade, item.id);
            if (item.id == 'Custom') {
                item.bgImg = '';
            } else if (bCustomList) {
                item.bgImg = item.background;
            } else {
                item.bgImg = njs_helper.fmt2("{}/{}",
                    nittio.getStaticTemplFolder(), item.background);
            }
            g_templateDict[item.id] = item;
	    }
	}

	function getTemplateInfo(templateName) {
	    if (templateName in g_templateDict) return g_templateDict[templateName];
	    if (g_templateList.length > 1) return g_templateList[1];
	    return g_templateList[0];
	}

	function updateTemplate(cssClass, bgImg) {
		jQuery('.bgimg').each(function() {
		    var elem = jQuery(this);
		    if (!elem.hasClass('bgimgcustom')) {
		        elem.attr('src', bgImg);
                _removeAllTemplateStyles(elem.parent());
		        elem.parent().addClass(cssClass);
		    }
		});
		g_lesson.bgimg = jQuery('#l_pageData .bgimg');
        g_lesson.globals.templateCssClass = cssClass;
	}
	
	function doModeToggle() {
		g_lesson.doModeToggle();
	}

	//--------------------------------------------------------------------------------------------------	

	return {
		init : init,
		loadTemplateInfos: loadTemplateInfos,
		getTemplateInfo : getTemplateInfo,
		updateTemplate : updateTemplate,
		theLesson : g_lesson,
		showCommentIndicator : showCommentIndicator,
		doModeToggle : doModeToggle
	};
}(); 

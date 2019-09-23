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
        this.getCurrentPage = Lesson_getCurrentPage;
        this.getCurrentPageId = Lesson_getCurrentPageId;
		this.getPageNoFromPageId = Lesson_getPageNoFromPageId;
		this.getCurrentPageUrl = Lesson_getCurrentPageUrl;
		this.getExistingPageIds = Lesson_getExistingPageIds;
        this.cloneBgImgForPage = Lesson_cloneBgImgForPage;
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
		this.pastePage = Lesson_pastePage;
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
        this.globals.slideChangeChecker = new njs_lesson_helper.SlideChangeChecker(this);
        this.globals.selectionHandler = new SectionSelectionHandler(this);
        this.globals.isPollyEnabled = false;
	}

	//--------------------------------------------------------------------------------------------
	// Lesson Methods - Getters for basic properties
	//--------------------------------------------------------------------------------------------
	function Lesson_getCurrentPageNo() {
		return this.globals.slides.getCurPageNo();
	}
	
    function Lesson_getCurrentPage() {
        return this.pages[this.getCurrentPageNo()];     
    }

	function Lesson_getCurrentPageId() {
		return this.getCurrentPage().getPageId();		
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
		return url + '#/' + this.getCurrentPage().getPageIdStr();
	}
	
	function Lesson_getExistingPageIds() {
		var pageIdList = [];
		for(var i =0, len= this.pages.length; i < len; i++){
			pageIdList.push(this.pages[i].getPageId());
		}
		return pageIdList;	
	}
	
    function Lesson_cloneBgImgForPage(page) {
        var ret = window.nlapp.NittioLesson.getBgInfo(page, modulePopup.isPopupOpen(), 
            this.bgimg.attr('src'), this.globals.templateCssClass, page.pagetype.getPt());
        if (ret.imgtype == 'default_popup_bg') {
            ret.bgimg = jQuery('<div class="bgimg module_popup_img"></div>');
        } else if (ret.imgtype == 'default_module_bg') {
            ret.bgimg = this.bgimg.clone();
        } else {
            ret.bgimg = jQuery(njs_helper.fmt2('<img class="bgimg bgimgcustom" src="{}">', ret.bgimg));
        }
        return ret;
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
        self.globals.isPollyEnabled = (self.oLesson.autoVoiceProvider == 'polly');
        window.nlapp.NittioLesson.init(self.oLesson, moduleConfig,
            npagetypes.getInteractionsAndLayouts());
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

        if (self.globals.isPollyEnabled) {
            // Only forward migration from "non polly" ==> "polly"
            _Lesson_migrateToAutoVoiceProvider(self.oLesson.pages, self.globals.isPollyEnabled);
        }
        _Lesson_updateOLessonFromLearningData(self);
        _Lesson_filterPages(self);
        self.pages = [];
        for (var i = 0; i < self.oLesson.pages.length; i++) {
            var po = new Page(self);
            if(self.oLesson.pages[i] == undefined) continue;
            po.init(self.oLesson.pages[i], self.bgimg);
            self.pages.push(po);
        }

		if (self.renderCtx.launchCtx() == 'do_assign') {
            var submit = '<div class="row row-center margin0 padding0 nl-link-img nl-button" onclick="javascript:submitReportAssign()" style="width:fit-content;margin:auto;padding: 15px 25px; border-radius: 5px;">'
                        +'<div><i class="ion-ios-checkmark icon" style="padding-right:16px"></i></div>'
                        +'<div class="col">click here to submit</div></div>';
			submit = njs_helper.fmt2('<div style="font-size:150%; line-height:1.5em">{}</div>',
				submit);
			var oPage = {type: 'text', sections: [{text: submit}]};
			var po = new Page(self);
			po.init(oPage, self.bgimg);
	        self.pages.push(po);
	    }
        
        self.pendingTimer = new njs_lesson_helper.PendingTimer();
        self.pendingTimer.updateIfNeeded(self);
        self.globals.slideChangeChecker.init();
        _Lesson_setupAutoSave(self);
		
		// Clearup Zodi flag and remember to reRenderAsReport the ones cleared in do mode
		self.postRenderingQueue.initZodi();
		self.createHtmlDom();
        self.setupOnLeavePage();
        self.updateTemplateCustomizations();
        if((njs_scorm.getScormLmsLessonMode()  === null) && (self.renderCtx.launchCtx() == 'report_assign_my' || self.renderCtx.launchCtx() == 'report_assign_review')) {
            njs_lesson_helper.SubmitAndScoreDialog.showReportOverview(self);
        }
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
            jQuery('#templateStyleHolder').find('#templateStylesCss').remove();
            var stylesCss = this.parentTemplateContents.templateStylesCss;
            stylesCss += this.oLesson.templateStylesCss;
            if (stylesCss) {
                var styleElem = njs_helper.fmt2('<style id="templateStylesCss">{}</style>', stylesCss);
                jQuery('#templateStyleHolder').prepend(styleElem);
            }
        }
        if (oldTemplateBgimgs != this.oLesson.templateBgimgs) {
            oldTemplateBgimgs = this.oLesson.templateBgimgs;
            g_templateList = [];
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
        for (var i=newData.length-1; i>=0; i--) {
            var d = newData[i];
            uniqueItems[d['id']] = i;
        }
            
        for (var i=0; i<newData.length; i++) {
            var d = newData[i];
            if (uniqueItems[d['id']] == i) consolidated.push(d);
        }
            
        for (var i=0; i<existingData.length; i++) {
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
		var curPage = this.getCurrentPage();
		curPage.reRenderDoMode(false);
	}
	
	function Lesson_updatePagePropertiesDom() {
		var curPage = this.getCurrentPage();
		curPage.updatePagePropertiesDom(this.getCurrentPageNo());
	}

    var forumDlg = null;
    function Lesson_showForum(forumType, forumRefid) {
        var curPage = this.getCurrentPage();
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
	function Lesson_createHtmlDom(parent) {
		var hPages = jQuery(njs_helper.fmt2("<div class='njsSlides mode_{}'></div>", 
							this.renderCtx.launchMode()));
		for (var i = 0; i < this.pages.length; i++) {
			hPages.append(this.pages[i].createHtmlDom());
		}
		if (!parent) parent = jQuery('#l_html');
		parent.append(hPages);
		return hPages;
	}
	
	function Lesson_onEscape() {
	    this.globals.selectionHandler.unselectSection();
		var curPage = this.getCurrentPage();
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

        var _loadingPages = {};
        this.preLoadAllPages = function(onDoneFn) {
            var self = this;
            if (_onPreLoadDoneFn) _onPreLoadDoneFn(false);
            _onPreLoadDoneFn = onDoneFn;
            for (var i=0; i<lesson.pages.length; i++) {
                var curPage = lesson.pages[i];
                var pageId = curPage.getPageId();
                if (pageId in self.renderedPages) continue;
                _loadingPages[pageId] = true;
                _adjustAndUpdateInQueue(self, i);
            }
            self.onPreLoadDone(null);
        };

        var _onPreLoadDoneFn = null;
        this.onPreLoadDone = function(pageId) {
            if (pageId in _loadingPages) delete _loadingPages[pageId];
            if (!_onPreLoadDoneFn || Object.keys(_loadingPages).length > 0) return;
            _onPreLoadDoneFn(true);
            _onPreLoadDoneFn = null;
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
		var curPage = lesson.getCurrentPage();
		if ('hint' in curPage.oPage && curPage.oPage.hint != '') return true;
		//if (curPage.getMaxScore() > 0) return true;
		return false;
	}

	function Lesson_showOrHideDoToggleIcon() {
		if (this.renderCtx.launchMode() != 'do') return;
		
		var curPage = this.getCurrentPage();
		if (this.renderCtx.pageCtx(curPage) != 'do_zodi' && curPage.pagetype.isDoToggleSupported()) {
			curPage.reRenderDoMode();
			jQuery('#do_toggle_icon').show();
		} else {
			jQuery('#do_toggle_icon').hide();		
		}
		var curPageNo = this.getCurrentPageNo();
		var pages = this.pages;
		if((pages.length - curPageNo) <=2 && !modulePopup.isPopupOpen()) {
		    jQuery('#lesson_submit_icon').show();
		} else {
		    jQuery('#lesson_submit_icon').hide();
		}
	}
	
	function Lesson_showPageReport(bFeedback) {
        this.updateScore();
		if(bFeedback){
			var curPage = this.getCurrentPage();
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
		var curPage = lesson.getCurrentPage();
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
            this.oLesson.maxScore += this.pages[i].getPopupMaxScore();
		}

		if (this.renderCtx.launchMode() != 'edit') {
			return;
		}

		// Update all section texts first
		modulePopup.updateContent();
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
        {name: 'pagesFiltered'},
        {name: 'feedbackScore'}];

    var _ldPageAttrList = [
        {name: 'pageNo', noCopyBack: true, noCopyFrom: true, noMinify: true}, 
        {name: 'title', noCopyBack: true, noCopyFrom: true, noMinify: true}, 
        {name: 'score', noMinify: true}, 
        {name: 'scoreOverride', noMinify: true},
        {name: 'maxScore', noCopyBack: true, noMinify: true},
        {name: 'pageMaxScore', noCopyBack: true, noMinify: true},
        {name: 'answerStatus', noMinify: true}, 
        {name: 'popupScore', noMinify: true}, 
        {name: 'popupMaxScore', noMinify: true}, 
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
        _Lesson_updateLearningDataFromOPages(ld.pages, lesson.oLesson.pages);
	}

    function _Lesson_updateLearningDataFromOPages(ldPages, oPages) {
        for(var i=0; i<oPages.length; i++) {
            var oPage = oPages[i];
            if(oPages[i] == undefined) continue;
            var title = oPage.sections && oPage.sections[0] ? oPage.sections[0].text : '';
            title = njs_lesson_helper.formatTitle(title);
            if (!ldPages[oPage.pageId]) ldPages[oPage.pageId] = {};
            var pld = ldPages[oPage.pageId];
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
                if (oSection.popups && oSection.popups.onclick) {
                    _Lesson_updateLearningDataFromOPages(ldPages, oSection.popups.onclick);
                }
                if (!shallAdd) continue;
                sld.sectionNumber = j;
                pld.sections.push(sld);
            }
        }
    }

    function _Lesson_migrateToAutoVoiceProvider(pages) {
        for(var i=0; i<pages.length; i++) {
            _Page_migrateToAutoVoiceProvider(pages[i]);
            for (var j=0; j<pages[i].sections.length; j++) {
                var popupPages = (pages[i].sections[j].popups || {}).onclick || [];
                _Lesson_migrateToAutoVoiceProvider(popupPages);
            }
        }
    }

    function _Page_migrateToAutoVoiceProvider(oPage) {
        if (oPage.autoVoicePolly) return; // already migrated
        if (!oPage.autoVoice && !oPage.audioUrl) return; // nothing to migrate
        oPage.autoVoicePolly = [{mp3: oPage.audioUrl || '', delay: 0, lang: 'en-IN', voice: 'Aditi',
                        text: oPage.autoVoice, type: oPage.audioUrl ? 'audio' : 'autovoice' }];
    }

    function _Lesson_updateOLessonFromLearningData(lesson) {
        var ld = lesson.oLesson.learningData;
        if (!ld) return;

        for(var i=0; i<_ldAttrList.length; i++) {
            if (_ldAttrList[i].noCopyBack) continue;
            _copyIf(ld, lesson.oLesson, _ldAttrList[i].name);
        }
        _Lesson_updateOPagesFromLearningData(lesson.oLesson.pages, lesson);
    }
    
    function _Lesson_updateOPagesFromLearningData(oPages, lesson) {
        for(var i=0; i<oPages.length; i++) {
            _Lesson_updateOPageFromLearningData(oPages[i], lesson)
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
        for(var i=0; i<oPage.sections.length; i++) {
            var popupPages = (oPage.sections[i].popups || {}).onclick || [];
            _Lesson_updateOPagesFromLearningData(popupPages, lesson);
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
		var pagesList = modulePopup.getPagesListFromStack();
	    var pages = pagesList[0];
        for (var i = 0; i < pages.length; i++) {
            this.oLesson.score += (pages[i].oPage.score || 0);
            this.oLesson.score += (pages[i].oPage.popupScore || 0);
        }
	}
	
	function Lesson_updateScoreDo() {		
        if (njs_scorm.getScormLmsLessonMode() !== null) return;
        var pagesList = modulePopup.getPagesListFromStack();
        for(var p=pagesList.length-1; p>=0; p--) {
            var pages = pagesList[p];
            var oLesson = (p == 0) ? this.oLesson : {};
            _Lesson_updateScoreDoImpl(oLesson, pages);
        }
    }

    function _Lesson_updateScoreDoImpl(oLesson, pages) {       
		oLesson.maxScore = 0;
		oLesson.score = 0;
		oLesson.answered = [];
		oLesson.notAnswered = [];
        oLesson.partAnswered = [];
        oLesson.feedbackScore = [];
		for (var i = 0; i < pages.length; i++) {
            pages[i].computeScore();
            var oPage =  pages[i].oPage;
			oLesson.maxScore += (oPage.maxScore + oPage.popupMaxScore);
            oLesson.score += (oPage.score + oPage.popupScore);
            if(oPage.feedbackScore) oLesson.feedbackScore = oLesson.feedbackScore.concat(oPage.feedbackScore);

            if (oPage.answerStatus == npagetypes.ANSWERED_YES) {
                oLesson.answered.push(i);
            } else if (oPage.answerStatus == npagetypes.ANSWERED_PART) {
                oLesson.partAnswered.push(i);
            } else if (oPage.answerStatus == npagetypes.ANSWERED_NO) {
                oLesson.notAnswered.push(i);
            }
		}
	}
	
	function Lesson_submitReport() {
        if (modulePopup.isPopupOpen()) {
            njs_helper.Dialog.popup('Warning', 
                'Please close all popups before submitting.', 
                undefined, undefined, sizes=njs_helper.Dialog.sizeSmall());
            return;
            
        }
	    
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
		var redirUrl = '/';
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
    var AUTOSAVE_TIMEOUT2 = 300; // Save if there is mouse event in last 5 minutes
    function _Lesson_setupAutoSave(lesson) {
        // Autosave only when doing assignments
        if (lesson.renderCtx.launchCtx() != 'do_assign') return;
        if (njs_scorm.getScormLmsLessonMode() !== null) return;

        var onCompleteFn = null;
        window.setInterval(function() {
            var idleMonitor = window.nlapp.nl.idleMonitor;
            var screenIdleTimeInSeconds = idleMonitor.getIdleSeconds();
            if (screenIdleTimeInSeconds > AUTOSAVE_TIMEOUT + 5) {
                if(screenIdleTimeInSeconds > AUTOSAVE_TIMEOUT2 + 5) 
                    lesson.sessionStartTime = new Date(); // For timeSpentCalculations reset it only if the screen is idle for greater than five minutes
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
        lesson.oLesson.currentPageNo = modulePopup.getMainPageNo();
    }
    
    function _Lesson_saveUpdateTime(lesson) {
        var pgNo = lesson.getCurrentPageNo();
        lesson.globals.slideChangeChecker.updatePageTimeInLearningData(lesson.pages[pgNo]);
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
		if (!modulePopup.isPopupOpen())
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
		var hNewPage = curPage.initDom(curPage.oPage, curPage.bgimg, true);
		
		hNewPage.insertAfter(hCurPage);
		hCurPage.remove();
		
		this.globals.slides.reinit();
		this.globals.slides.gotoPage(pageNo);
        this.reRender(false);
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

		this.globals.slides.gotoPage(pageNo, {samePageAnimation: samePageAnimation});
	}

	function Lesson_swapPage(swapStart) {
		var hPg1 = this.pages[swapStart].hPage.detach();
		var hPg2 = this.pages[swapStart+1].hPage;
		hPg1.insertAfter(hPg2);

		_swap(this.pages, swapStart, swapStart+1);
        if (!modulePopup.isPopupOpen())
    		_swap(this.oLesson.pages, swapStart, swapStart+1);

		return true;
	}

	function _swap(lst, a, b) {
		var temp = lst[a];
		lst[a] = lst[b];
		lst[b] = temp;
	}
	
	function Lesson_cutPage(pageNo) {
		this.pages[pageNo].hPage.remove();
        if (!modulePopup.isPopupOpen())
    		this.oLesson.pages.splice(pageNo, 1);
		this.pages.splice(pageNo, 1);
		this.reinitSlides(1);
		return true;
	}
	
	function Lesson_pastePage(pageNo, clip) {
		if(!clip) return false;
		var oNewPage = null;
	    try {
  			oNewPage = jQuery.parseJSON(clip);
  		} catch(e) {
  			return false;
  		}
  		if (!oNewPage.sections || oNewPage.sections.length < 1) return false;
		var newPage = new Page(this);
		var hNewPage = newPage.initDom(oNewPage, this.bgimg);

		var hCurPage = this.pages[pageNo].hPage;
		hNewPage.insertAfter(hCurPage);
		this.pages.splice(pageNo + 1, 0, newPage);
        if (!modulePopup.isPopupOpen())
    		this.oLesson.pages.splice(pageNo + 1, 0, newPage.oPage);
		return true;
	}

	function Lesson_getPageStudentNotes() {
		var oPage = this.getCurrentPage().oPage;
		if ('notes' in oPage) {
			return oPage.notes;
		}
		return '';
	}

	function Lesson_setPageStudentNotes(notes) {
		var oPage = this.getCurrentPage().oPage;
		oPage.notes = notes;
	}

	function Lesson_getPageTeacherRemarks() {
		var oPage = this.getCurrentPage().oPage;		
		if ('remarks' in oPage) {
			return oPage.remarks;			
		}
		return '';
	}

	function Lesson_setPageTeacherRemarks(remarks) {
		var oPage = this.getCurrentPage().oPage;		
		oPage.remarks = remarks;
	}
	
	function Lesson_isPageScoreEditable() {
		var page = this.getCurrentPage();
		return page.pagetype.isScoreEditable(page);
	}

	function Lesson_getPageMaxScore() {
		var page = this.getCurrentPage();
		return page.getMaxScore();
	}

	function Lesson_getPageScore() {
		var page = this.getCurrentPage();
		return page.getScore();
	}

	function Lesson_setPageScore(score) {
		var oPage = this.getCurrentPage().oPage;
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
			this.globals.slides.gotoPage(p, {noPagePreCheck: true});
			njs_helper.Dialog.popupStatus(njs_helper.fmt2('"{}" found in page {}', searchStr, p+1));
			return true;
		}
		return false;
	}

    function _Lesson_filterPages(self) {
        if (self.oLesson.pagesFiltered) {
            var pages = self.oLesson.pages;
    		// Null ids Can happen with very old (pre 2015) modules
        	if (self.oLesson.pagesFiltered.length > 0 && 
        		(self.oLesson.pagesFiltered[0] === undefined ||
        		 self.oLesson.pagesFiltered[0] === null)) return;
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
        var allowedMaxScore = 'allowed_max_score' in oLesson ? parseInt(oLesson.allowed_max_score) : null;
        var pageInfos = [];
        var randPosArray = [];
        
        for(var i in pages) {
            var p = pages[i];
            if (p.visibility == 'editor') {
                pageInfos.push({pos: i, maxScore: 0, newPos: -1});
                continue;
            }
            if (allowedMaxScore === null) {
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
            if (pageInfos[i].shallFilter && (allowedMaxScore !== 0) && newMaxScore > allowedMaxScore) {
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
        this.pauseAudio = Page_pauseAudio;
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
		this.getPopupScore = Page_getPopupScore;
        this.getPopupMaxScore = Page_getPopupMaxScore;

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
	function Page_initDom(oPage, bgimg, isChangePage) {
		this.init(oPage, bgimg, isChangePage);
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
	function Page_init(oPage, bgimg, isChangePage) {
		this.oPage = oPage;
		this.bgimg = bgimg;
		this.sections = [];		
		this.initPageTypeObject();
		this.pageId = Page_allocatePageId(oPage, this.lesson);
		this.markFroRedraw();

		this.oPage.maxScore = this.getMaxScore();
		
		var layout = this.oPage.sectionLayout || this.pagetype.getLayout();
		var len = this.oPage.sections.length;
		var neededLen = layout.length;
		
		if (isChangePage) {
			for (var i = 0; i < len; i++) {
				if (i >= neededLen) break;
				this.oPage.sections[i] = this.createOSection(layout[i], this.oPage.sections[i]);
			}
		}
		for (var i = len; i < neededLen; i++) {
			this.oPage.sections.push(this.createOSection(layout[i], null));
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
        var mp3List = this.lesson.globals.isPollyEnabled ? this.oPage.autoVoicePolly || [] : null;
        if (!mp3List && this.oPage.audioUrl) mp3List = [{mp3: this.oPage.audioUrl, delay: 0}];
        var audioHtml = '';
        if(mp3List) {
            audioHtml = this.lesson.globals.audioManager.getButton(mp3List, this.getPageId());
        } else if (this.oPage.autoVoice) {
            this.autoVoiceButton = this.lesson.globals.autoVoice.getVoiceButton(this.oPage.autoVoice);
            if (this.autoVoiceButton) audioHtml = this.autoVoiceButton.html;
        }
        this.propAudio.html(audioHtml || ''); 
    }
    
    function Page_pauseAudio() {
        this.lesson.globals.audioManager.pause(this.getPageId());
        if (this.autoVoiceButton) this.autoVoiceButton.pause();
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
        _removeAllTemplateStyles(this.hPage);
        var bginfo = this.lesson.cloneBgImgForPage(this);
        this.hPage.addClass(bginfo.bgshade);
        this.hPage.prepend(bginfo.bgimg);
        return bginfo.bgimg;
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
            me.lesson.postRenderingQueue.onPreLoadDone(me.getPageId());
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
        me.pageAnimationDone = true;
		MathJax.Hub.Queue(function() {
            if (me.lesson.renderCtx.lessonMode() != 'edit') {
                me.pageAnimationDone = false;
                me.lesson.globals.animationManager.setupAnimation(me, function() {
                    me.pageAnimationDone = true;
                });
            }
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
        _Page_updateMaxScores(this.oPage, this);
        return this.oPage.maxScore;
	}

    function Page_getPopupMaxScore() {
        return this.oPage.popupMaxScore;
    }
    
    function _Page_updateMaxScores(oPage, page) {
        oPage.maxScore = ('pageMaxScore' in oPage) ? oPage.pageMaxScore
            : page ? page.pagetype.getMaxScore(page) : oPage.maxScore;
        if (!oPage.maxScore) oPage.maxScore = 0;
        oPage.popupMaxScore = 0;

        var maxSections = oPage.sections.length;
        var layout = oPage.sectionLayout || (page ? page.pagetype.getLayout() : null);
        if (layout && layout.length < maxSections) maxSections = layout.length;
        for (var i=0; i<maxSections; i++) {
            var oSection = oPage.sections[i];
            if (!oSection.popups || !oSection.popups.onclick) continue;

            var oSubPages = oSection.popups.onclick;
            for (var j=0; j<oSubPages.length; j++) {
                _Page_updateMaxScores(oSubPages[j]);
                oPage.popupMaxScore += (oSubPages[j].maxScore + oSubPages[j].popupMaxScore);
            }
        }
        return oPage.popupMaxScore;
    }

	function Page_computeScore() {
	    var oPage = this.oPage;
        this.getMaxScore(); // For side effect of setting maxScore and popupMaxScore
        var scoreInfo = this.pagetype.getScoreFn()(this);
        oPage.answerStatus = scoreInfo[0];
	    oPage.score = 'scoreOverride' in oPage ? oPage.scoreOverride : scoreInfo[1];
        oPage.popupScore = 0;

        for (var i=0; i<this.sections.length; i++) {
            if (this.pagetype.isInteractive(this.sections[i])) continue;
            var oSection = this.sections[i].oSection;
            if (!oSection.popups || !oSection.popups.onclick) continue;
            var oSubPages = oSection.popups.onclick;
            for (var j=0; j<oSubPages.length; j++) {
                if (!oSubPages[j].maxScore && !oSubPages[j].popupMaxScore) continue;
                oPage.popupScore += (oSubPages[j].maxScore && oSubPages[j].score ? oSubPages[j].score : 0);
                oPage.popupScore += (oSubPages[j].popupMaxScore && oSubPages[j].popupScore ? oSubPages[j].popupScore : 0);
                oPage.answerStatus = npagetypes.mergeAnswerStatus(oSubPages[j].answerStatus, oPage.answerStatus);
            }
        }
	}
	
	function Page_getScore() {
		return this.oPage.score || 0;
	}

    function Page_getPopupScore() {
        return this.oPage.popupScore || 0;
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
	
	function Page_createOSection(section, oldSection) {
		ret = new Object();
		var content = section.content || {};
		ret.type = 'txt';
		ret.text = content.text ? content.text : oldSection ?  oldSection.text : '';
		if(content.template) ret.template = content.template;
		if (!oldSection) oldSection = {};
		if(oldSection.popups || content.popups)
			ret.popups = oldSection.popups ? oldSection.popups : content.popups;
		if(oldSection.simuBox) ret.simuBox = oldSection.simuBox;
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
		this.pgSecPopupSticker = njs_helper.jobj('<div class="pgSecPopupSticker"></div>');
		this.pgSecPopupSticker.hide();
		this.pgSecView.append(this.pgSecPopupSticker);
		this.secViewContent = njs_helper.jobj('<div class="secViewContent"/>');
        this.pgSecView.append(this.secViewContent);
		
		var help;
		if (this.oSection.popups && !this.page.pagetype.isInteractive(this)) {
			modulePopup.showPopupSticker(this);
		}
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
		_bindPasteToTextrea(this.pgSecText);
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

	function _isPastedContentImage(e) {
		if(!e.originalEvent || 
			!e.originalEvent.clipboardData ||
			!e.originalEvent.clipboardData.files ||
			e.originalEvent.clipboardData.files.length == 0 ||
			!e.originalEvent.clipboardData.types) return false;
		if ((e.originalEvent.clipboardData.files[0].type || '').indexOf('image') != 0) return false;
		for(var i=0; i<e.originalEvent.clipboardData.types.length; i++)
			if (e.originalEvent.clipboardData.types[i].indexOf('text/rtf') == 0) return false;
		return true;
	}
	
	function _bindPasteToTextrea(pageTextarea) {
		jQuery(pageTextarea).on('paste', function(e) {
			if (!_isPastedContentImage(e)) return;
			e.preventDefault();
			e.stopImmediatePropagation();
	        var selector = nlesson.theLesson.globals.selectionHandler;
			var data = {isPasteAndUpload: true, resource: e.originalEvent.clipboardData.files};
			njs_helper.BlankScreen.show();
			nlesson.loadTemplateInfos(function(templateDict) {
		        var promise = window.nlapp.NittioLesson.insertOrUpdateResource('img:', templateDict, 'Images', jQuery('#l_lessonId').val(), data);
		        promise.then(function(result) {
		            if (result === null) return;
		            selector.updateSelectedText(result.markupUrl);
		        });
			});
		});
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
        _Section_setupOnclick(this, pagetype);
    }
    
    function _Section_setupOnclick(section, pagetype) {
        if (!section.oSection.popups || !section.oSection.popups.onclick) {
            if (!pagetype.isInteractive(section))
                section.pgSecView.removeClass('beh_interactive');
            return;
        }
        section.pgSecView.addClass('beh_interactive');
        if (section.pgSecView.modulePopupSetup) return;
        section.pgSecView.modulePopupSetup = true;
        section.pgSecView.on('click', function() {
            modulePopup.show(section);
        });
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
    var self = this;
    this.setFocusHandlers = function(page, secNo, pgSecText) {
        if (lesson.renderCtx.launchMode() != 'edit') return;
        pgSecText.focus(function() {
            _focusedSection = {page: page, secNo: secNo, pgSecText: pgSecText}; 
            self.updateToolbelt();
        });
    };

    this.unselectSection = function() {
        if (lesson.renderCtx.launchMode() != 'edit') return;
        _focusedSection = {}; 
        self.updateToolbelt();
    };
    
    this.refocus = function() {
        if (!_isSectionSelected()) return;
        setTimeout(function() {
            _focusedSection.pgSecText.focus();
        });
    };
    
    this.getSelectedSectionInfo = function(flags) {
        if (!_isSectionSelected()) {
            if (flags && flags.warnMsg) 
                njs_helper.Dialog.popup('Warning', flags.warnMsg, undefined, undefined, sizes=njs_helper.Dialog.sizeSmall());
            return null;
        }
        return _focusedSection;
    };
    
    this.getSelectedSectionObj = function(flags) {
        this.getSelectedSectionInfo(flags);
        return _getSection();
    };
    
    this.getSelectedText = function(flags) {
        if (!this.getSelectedSectionInfo()) return null;
        var selected = _focusedSection.pgSecText[0];
        var selectedText = selected.value.substring(selected.selectionStart, selected.selectionEnd);
        if (flags && flags.refocus) this.refocus();
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

    var _allTools = [];        
    this.setupToolbelt = function(lessonId, canApprove, isRaw) {
        if (lesson.renderCtx.launchMode() != 'edit') return;

        _allTools.push({id: 'edit_icon_change_mode', grpid: 'module', grp: 'Module', icon: 'ion-ios-eye', name:'Preview', shortcut: ' (Alt+T)', onclick: _fn(on_changemode)});
        _allTools.push({id: 'edit_icon_props', grpid: 'module', grp: 'Module', icon:'ion-ios-gear', name: 'Module Properties', title:'Update module name and other module level properties', onclick: on_props});
        _allTools.push({id: 'edit_icon_save', grpid: 'module', grp: 'Module', icon: 'save', font:'material', font:'material-icons', name:'Save', shortcut: ' (Ctrl+S)', onclick: on_save});
        if (canApprove && lessonId > 0)
            _allTools.push({id: 'edit_icon_approve', grpid: 'module', grp: 'Module', icon:'ion-ios-checkmark',  name:'Approve',  title:'Approve the module and make it available to other authors', onclick: _fn(on_approve, lessonId)});

        _allTools.push({id: 'edit_icon_addpage', grpid: 'pages', grp: 'Page', icon:'ion-ios-plus', name:'Add Page', title:'Add a new page', shortcut: ' (Alt+Insert)', onclick: on_addpage});
        _allTools.push({id: 'edit_icon_delpage', grpid: 'pages', grp: 'Page', icon:'ion-ios-trash', name:'Delete Page', title:'Delete this page', shortcut: ' (Alt+Del)', onclick: on_delpage});
        _allTools.push({id: 'edit_icon_changepagetype', grpid: 'pages', grp: 'Page', icon:'view_quilt', name:'Change Format', title:'Change the layout and styling of this page', font:'material-icons', onclick: on_changepagetype});
        _allTools.push({id: 'edit_icon_pageprops', grpid: 'pages', grp: 'Page', icon:'ion-ios-settings-strong', name:'Page Properties', title:'Update page properties', shortcut: ' (Alt-P)', onclick: on_pageProps});
        _allTools.push({id: 'edit_icon_pageorg', grpid: 'pages', grp: 'Page', icon:'ion-shuffle', name:'Page Organizer', title:'Organize the pages', shortcut: ' (Alt+O)', onclick: on_pageorganizer});
        _allTools.push({id: 'edit_icon_pagevoice', grpid: 'pages', grp: 'Page', icon: 'ion-mic-c', name:'Page Voice', title:'Add page voice', onclick: on_pagevoice});

        _allTools.push({id: 'edit_icon_img', grpid: 'media', grp: 'Section Media', icon:'ion-aperture', name:'Insert Image', onclick: on_insert_img});
        _allTools.push({id: 'edit_icon_video', grpid: 'media', grp: 'Section Media', icon:'ion-social-youtube', name:'Insert Video', onclick: on_insert_video});
        _allTools.push({id: 'edit_icon_link', grpid: 'media', grp: 'Section Media', icon:'ion-link', name:'Insert Link', onclick: on_insert_link});
        _allTools.push({id: 'edit_icon_media', grpid: 'media', grp: 'Section Media', icon:'ion-ios-photos', name:'Update Media', onclick: on_update_media});

        _allTools.push({id: 'edit_icon_popup_edit', grpid: 'popup', grp: 'Section Popup', icon:'ion-ios-pricetag', name:'Create Popup', onclick: on_popup_edit});
        _allTools.push({id: 'edit_icon_popup_delete', grpid: 'popup', grp: 'Section Popup', icon:'ion-backspace', name:'Delete Popup', onclick: on_popup_delete});

        _allTools.push({id: 'edit_icon_comment', grpid: 'review', grp: 'Module Review', icon:'ion-ios-chatbubble-outline', title:'Manage Comments', name:'Comments', onclick: on_managecomment});
        if (lessonId > 0)
            _allTools.push({id: 'edit_icon_review', grpid: 'review', grp: 'Module Review', icon:'ion-ios-glasses', name:'Invite for Review', onclick: on_sendforreview});
        if (isRaw)
            _allTools.push({id: 'edit_icon_raw', grpid: 'advanced', grp: 'Advanced', icon:'ion-settings', name:'Raw Edit', onclick: on_rawedit});

        njs_toolbelt.Toolbelt.setup(_allTools);     
    };
    
    this.updateToolbelt = function() {
        if (lesson.renderCtx.launchMode() != 'edit') return;
        
        if (modulePopup.isPopupOpen()) {
            njs_toolbelt.Toolbelt.updateToolGrp('pages', 'Popup Page');
        } else {
            njs_toolbelt.Toolbelt.updateToolGrp('pages', 'Page');
        }

        if (!_isSectionSelected() || lesson.renderCtx.lessonMode() != 'edit') {
            njs_toolbelt.Toolbelt.toggleToolGroup('Media', false);
            njs_toolbelt.Toolbelt.toggleToolGroup('Popup', false);
        } else {
            njs_toolbelt.Toolbelt.toggleToolGroup('Media', true);
            var sec = _getSection();
            var pagetype = sec.page.pagetype;
            njs_toolbelt.Toolbelt.toggleToolGroup('Popup', true);
            var osec = sec.oSection;
            if (osec && osec.popups) {
                njs_toolbelt.Toolbelt.updateTool('edit_icon_popup_edit', 'Edit Popup', null, 'Edit the popup of the selected section');
                njs_toolbelt.Toolbelt.toggleTool('edit_icon_popup_delete', true);
            } else {
                njs_toolbelt.Toolbelt.updateTool('edit_icon_popup_edit', 'Create Popup', null, 'Create a popup for the selected section');
                njs_toolbelt.Toolbelt.toggleTool('edit_icon_popup_delete', false);
            }
        }
    };
    
    function _isSectionSelected() {
        var currentPage = lesson.getCurrentPage();
        return (_focusedSection.pgSecText !== null && _focusedSection.secNo !== null &&
            _focusedSection.page == currentPage);
    }

    function _getSection() {
        return _focusedSection ? _focusedSection.page.sections[_focusedSection.secNo] : null;
    }
}

//---------------------------------------------------------------------------------------------
// Module Popup Handler
//---------------------------------------------------------------------------------------------
function ModulePopupHadler() {
    var _stack = [];
    var _mainPages = null;
    var _mainPageNo = 0;
    var self = this;

    this.isPopupOpen = function() {
        return (_stack.length > 0);
    };
    
    this.getPagesListFromStack = function() {
        var pagesList = [];
        for(var i=0; i< _stack.length; i++) pagesList.push(_stack[i].pages);
        pagesList.push(g_lesson.pages);
        return pagesList;
    };
    
    this.getMainPageNo = function() {
        return this.isPopupOpen() ? _mainPageNo : g_lesson.getCurrentPageNo();
    };

    this.deletePopup = function(section) {
        var msg = 'Are you sure you want to delete the popup defined for this section?';
        var cancelButton = {id: 'cancel', text: 'Cancel'};
        var okButton = {id: 'ok', text: 'Delete Popup', fn: function() {
            njs_helper.Dialog.popdown();
            self.hidePopupSticker(section);
            if (section.oSection.popups) delete section.oSection.popups;
            g_lesson.globals.selectionHandler.unselectSection();
        }};
        njs_helper.Dialog.popup('Please Confirm', msg, [okButton], cancelButton);
    };
    
    this.createPopup = function(section) {
        if (!section.oSection.popups) section.oSection.popups = {};
        if(!section.page.pagetype.isInteractive(section)) this.showPopupSticker(section);
        if (section.oSection.popups.onclick) return true;
        section.oSection.popups.onclick = [];
        var pages = section.oSection.popups.onclick;
        var pt = 'S4';
        var ptInfo = npagetypes.getInteractionsAndLayouts();
        if (!(pt in ptInfo.ptMap)) {
            pt = ptInfo.interactionToLayouts[ptInfo.interactions[0].id][0].pagetype_id;
        }
        pages.push({type: pt, sections: [{type: 'txt', text: ''}]});
        return true;
    };
    
    this.show = function(section) {
        if (!_canShowPopup(section)) return;
        if (!section.page.pageAnimationDone) {
            njs_helper.Dialog.popupStatus('Please wait till the page is played completely.');
            return;
        }
        var context = {section: section, 
            postRenderingQueue: g_lesson.postRenderingQueue,
            pages: g_lesson.pages,
            slides: g_lesson.globals.slides,
            lessonCtx: g_lesson.renderCtx.lessonCtx()};
        if (_stack.length == 0) {
            _mainPages = g_lesson.pages;
            _mainPageNo = g_lesson.getCurrentPageNo();
            g_lesson.pages[_mainPageNo].propAudio.hide();
        }
        _stack.push(context);
        g_lesson.getCurrentPage().pauseAudio();
        
        var holder = jQuery('#module_popup_holder');
        holder.show();
        jQuery('#pageNoArea').hide();

        g_lesson.postRenderingQueue = new PostRenderingQueue(g_lesson);

        var pages = section.oSection.popups.onclick;
        var content = jQuery('#module_popup_content');
        g_lesson.pages = [];
        for (var i = 0; i < pages.length; i++) {
            var po = new Page(g_lesson);
            po.init(pages[i], g_lesson.bgimg);
            g_lesson.pages.push(po);
        }
        context.hPages = g_lesson.createHtmlDom(content);

        var pgNo = holder.find('#module_popup_pgNo');
        var navLeft = holder.find('#module_popup_navigate_left');
        var navRight = holder.find('#module_popup_navigate_right');
        var slides = new njs_slides.SlideSet(context.hPages, pgNo, navLeft, navRight);
        slides.onSlideBeforeChange(function(curPgNo, newPgNo) {
		    if (!g_lesson.globals.slideChangeChecker.canChangeSlides(curPgNo, newPgNo)) return false;
            g_lesson.preRender(newPgNo);
            return true;
        });
        slides.onSlideChange(function() {
            g_lesson.postRender();
            g_lesson.onEscape();
        });
        g_lesson.preRender(0);
        slides.activate();
        content.css({opacity: 1});
        g_lesson.globals.slides = slides;
    };
    
    this.close = function() {
        if (_stack.length == 0) return false;
        g_lesson.getCurrentPage().pauseAudio();
        this.updateContent();
        g_lesson.updateScore();

        var top = _stack.pop();
        top.hPages.remove();
        g_lesson.globals.slides = top.slides;

        g_lesson.postRenderingQueue = top.postRenderingQueue;
        g_lesson.pages = top.pages;
        g_lesson.globals.slides = top.slides;
        g_lesson.globals.slides.activate(null, true);
        g_lesson.showOrHideZodiIcon();
        if (g_lesson.renderCtx.lessonCtx() != top.lessonCtx) {
            g_lesson.reRender(false);
        }
        
        if (_stack.length > 0) return true;

        jQuery('#pageNoArea').show();
        var holder = jQuery('#module_popup_holder');
        var content = jQuery('#module_popup_content');
        content.css({opacity: 0});
        holder.hide();
        g_lesson.pages[_mainPageNo].propAudio.show();
        g_lesson.globals.selectionHandler.updateToolbelt();
        return true;
    };
    
    this.updateContent = function() {
        var oPages = _updateContent(g_lesson.pages);
        for(var i=_stack.length-1; i>=0; i--) {
            _stack[i].section.oSection.popups.onclick = oPages;
            oPages = _updateContent(_stack[i].pages);
        }
    };
    
    this.showPopupSticker = function(section) {
		section.pgSecPopupSticker.show();
		var html = njs_helper.fmt2('<i title="{}" class="icon {}"></i>', 'Click on section to view', 'ion-ios-information fsh3');
		section.pgSecPopupSticker.html(html);
    };

	this.hidePopupSticker =  function(section) {
		section.pgSecPopupSticker.hide();		
	};
	
    function _updateContent(pages) {
        var oPages = [];
        for(var i=0; i<pages.length; i++) {
            pages[i].updateContent();
            oPages.push(pages[i].oPage);
        }
        return oPages;
    }

    function _canShowPopup(section) {
    	if (!section.oSection.popups) return false;
        if (g_lesson.renderCtx.launchCtx() != 'do_assign') return true;
        if (!section.page.pagetype.isInteractive(section)) return true;
        if (g_lesson.oLesson.selfLearningMode) return true;
        return false;
    }
}
var modulePopup = new ModulePopupHadler();

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
            _initFloaterTrnsparency();
		});
		
        var g_lessonId = null;
		nittio.onEscape(function() {
		    if (g_lessonId == 0) return;
			return g_lesson.onEscape();
		});
		
        nittio.onResize(function() {
            if (g_lessonId == 0) return;
            if (njs_scorm.getScormLmsLessonMode() === null) g_lesson.reRender(true);
        });
        
		nittio.afterInit(function(){
			g_lesson.globals.slides = nittio.getSlidesObj();
			g_lesson.globals.slides.onSlideBeforeChange(function(curPgNo, newPgNo) {
			    if (!g_lesson.globals.slideChangeChecker.canChangeSlides(curPgNo, newPgNo)) return false;
				g_lesson.preRender(newPgNo);
				return true;
			});
            g_lessonId = parseInt(jQuery('#l_lessonId').val());
            if (g_lessonId != 0) {
                g_lesson.globals.slides.onSlideChange(function() {
                    g_lesson.postRender();
                    g_lesson.onEscape();
                });
            }
            
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
            njs_helper.Dialog.moveBack();
            njs_helper.Dialog.popupStatus('Preparing to print - please wait ...', false);
            g_lesson.postRenderingQueue.preLoadAllPages(function(status) {
		        if (!status) return;
		        njs_helper.Dialog.popupStatus('', 0);
		        setTimeout(function() {
	                window.print();
	                njs_helper.Dialog.moveFront();
                }, 100);
            });
		});
	}

    var g_templateList = [];
    var g_templateDict = {};
	function loadTemplateInfos(onLoadComplete) {
		if (g_templateList.length > 0) {
			onLoadComplete(g_templateDict);
			return;
		}
		
		var templateids = g_lesson.oLesson.parentTemplates || [];
        var lessonId = jQuery('#l_lessonId').val();
		var promise = window.nlapp.NittioLesson.getResourceLibrary(templateids, lessonId);
		promise.then(function(resourceDict) {
            var templateBgimgs = g_lesson.oLesson.templateBgimgs ? JSON.parse(g_lesson.oLesson.templateBgimgs) : [];			
            g_templateList = _mergeArrayAttrs(resourceDict.resourcelist, templateBgimgs);
            g_templateDict = {resourcelist: g_templateList};
            onLoadComplete(g_templateDict);
		}, function () {
		    onLoadComplete({});
		});
	}

	function updateTemplate(bgShade, bgImg) {
		jQuery('img.bgimg').each(function() {
		    var elem = jQuery(this);
		    if (!elem.hasClass('bgimgcustom')) {
		        elem.attr('src', bgImg);
                _removeAllTemplateStyles(elem.parent());
		        elem.parent().addClass(bgShade);
		    }
		});
		g_lesson.bgimg = jQuery('#l_pageData .bgimg');
        g_lesson.globals.templateCssClass = bgShade;
	}
	
	function doModeToggle() {
		g_lesson.doModeToggle();
    }

    function onPageNumberClick() {
        _toggleFloaterTransparancy();
    }

    var _transparentFloaters = false;
    function _toggleFloaterTransparancy() {
        _setFloaterTransparency(!_transparentFloaters);
    }

    function _setFloaterTransparency(newState) {
        _transparentFloaters = newState;
        var clsName = 'nl-transparent-floaters';
        var elem = jQuery('body');
        if (_transparentFloaters) elem.addClass(clsName);
        else elem.removeClass(clsName);
    }

    function _initFloaterTrnsparency() {
        var elem = jQuery('body');
        var trans = elem.hasClass('nl-screen-small');
        _setFloaterTransparency(trans);
    }
    //--------------------------------------------------------------------------------------------------	

	return {
		init : init,
		loadTemplateInfos: loadTemplateInfos,
		updateTemplate : updateTemplate,
		theLesson : g_lesson,
		showCommentIndicator : showCommentIndicator,
		doModeToggle : doModeToggle,
        modulePopup: modulePopup,
        onPageNumberClick: onPageNumberClick
	};
}(); 

npagetypes = function() {
	//#############################################################################################
	// Implements the yahoo module pattern to minimize pollution of namespace all variables/
	// functions exposed out of this .js file are available under namespace "npagetypes".
	// Naming conventions:
	// Beh*       - Behaviour classes for different page types
	// Inteaction - Interactions supported by a page
	// Layout     - Layout of section with in the page
	// PageType   - Combination of Layout and interaction
	//#############################################################################################

	//#############################################################################################
	// exported functions and variables
	//#############################################################################################
	var ANSWERED_NA = -1;
	var ANSWERED_NO = 0;
	var ANSWERED_PART = 1;
	var ANSWERED_YES = 2;

    function mergeAnswerStatus(a, b) {
        if (a == ANSWERED_NA) return b;
        if (b == ANSWERED_NA) return a;
        if (a == ANSWERED_PART || b == ANSWERED_PART) return ANSWERED_PART;
        if (a == ANSWERED_YES && b == ANSWERED_YES) return ANSWERED_YES;
        if (a == ANSWERED_NO && b == ANSWERED_NO) return ANSWERED_NO;
        return ANSWERED_PART;
    }


	//#############################################################################################
	// Called once at page load to initialize some variables
	//#############################################################################################
	function init(templatePageTypes) {
	    var data = templatePageTypes.length > 0 ? templatePageTypes : defaultPageTypes;
		_initStaticListsAndMaps(data);
	}

    var defaultPageType = 'H';
	function _initStaticListsAndMaps(PageTypes) {
        PageTypeMap = {};
        PageInteractionTypes = [];
        PageInteractionTypeMap = {};
        InteractionToLayouts = {};

        // Add the default interactions in the map
        for (var i = 0; i < defaultPageInteractionTypes.length; i++) {
            var obj = defaultPageInteractionTypes[i];
            PageInteractionTypeMap[obj.id] = obj;
        }
        
		for (var i = 0; i < PageTypes.length; i++) {
			var pt = PageTypes[i];
			if (pt.id in PageTypeMap) {
				var msg= 'Error: redundant page type id specified: ' + pt.id;
				alert(msg);
				throw(msg);
			}
			if(i == 0) defaultPageType = pt.id;
			PageTypeMap[pt.id] = pt;

			if (!(pt.interaction in InteractionToLayouts)) {
                var obj = PageInteractionTypeMap[pt.interaction];
                if (!obj) {
                    var msg= 'Error: unknown interaction specified: ' + pt.interaction;
                    alert(msg);
                    throw(msg);
                }
                PageInteractionTypes.push(obj);
				InteractionToLayouts[pt.interaction] = [];
			}
			InteractionToLayouts[pt.interaction].push({'pagetype_id': pt.id, 'desc': pt.layoutName});
		}

        // Add the default page types in the map
        for (var i = 0; i < defaultPageTypes.length; i++) {
            var pt = defaultPageTypes[i];
            if (pt.id in PageTypeMap) continue;
            PageTypeMap[pt.id] = pt;
        }
	}
	
	//-----------------------------------------------------------------------------------------
	function pageSelectionDone(ptInfo, bInsert) {
		var pt = new PageType();
		pt.initInternal(ptInfo.pt);
		if(_isEqualLayouts(ptInfo.layout, pt.getLayout())) {
			ptInfo.layout = [];
		}
		if (bInsert) nlesson.theLesson.addPage(ptInfo.pt, ptInfo.layout);
		else nlesson.theLesson.changePageType(ptInfo.pt, ptInfo.layout);
	}

	var ATTRINFO = {
		// When comparing if the layout is same as in template or customized,
		// every attributed is by default compared for equality. This works
		// for int and string attributs. Sets and objects have to be specially
		// handled and this object defines which ones are set or object.

		// content style attribute is comma seperated unordered set of strings 
		style: 'set',

		// content attribute is an object and all the sub-attributes under it are int or string
		content: {},
		
		// pginfo attribute if present means the objects are different
		pginfo: 'not_equal'
	};

	function _isEqualLayouts(layout1, layout2) {
		if (layout1.length != layout2.length) return false;
		for (var i=0; i<layout1.length; i++) {
			var lhs = layout1[i];
			var rhs = layout2[i];
			if (!_isObjEqual(lhs, rhs, ATTRINFO)) return false;
		}
		return true;
	}
	
	function _isObjEqual(lhs, rhs, attrInfo) {
		var checkedAttrs = {};
		for (var a in lhs) {
			checkedAttrs[a] = true;
			if (!(a in attrInfo)) {
				if (lhs[a] != rhs[a]) return false;
				continue;
			}
			if (attrInfo[a] == 'not_equal') {
				return false;
			} else if (attrInfo[a] == 'set') {
				if (!_isSameSet(lhs[a] || '', rhs[a] || '')) return false;
			} else {
				if (!_isObjEqual(lhs[a] || {}, rhs[a] || {}, attrInfo[a])) return false;
			}
		}
		for (var a in rhs) {
			if (!(a in checkedAttrs)) return false;
		}
		return true;
	}

	function _isSameSet(lhs, rhs) {
		var lhsStyleArray = lhs.split(' ');
		var lhsStyleDict = {};
		for(var i=0; i<lhsStyleArray.length; i++) {
			var item = lhsStyleArray[i].trim();
			if (item == "") continue;
			lhsStyleDict[item] = false;
		}
		var rhsStyleArray = rhs.split(' ');
		for (var i=0; i<rhsStyleArray.length; i++) {
			var item = rhsStyleArray[i].trim();
			if (item == "") continue;
			if (!(item in lhsStyleDict)) return false;
			lhsStyleDict[item] = true;
		}		
		for (var item in lhsStyleDict) if (!lhsStyleDict[item]) return false;
		return true;
	}

	//#############################################################################################
	// PageType is the externally exported class which abstracts the functionality of this
	// Java script. With each page in a lesson, a PageType object will be created and attached.
	//#############################################################################################
	function PageType() {
		// Externally used methods
		this.init = PageType_init;
		this.initInternal = PageType_initInternal;

		this.getSectionCount = PageType_getSectionCount;
        this.getSectionPos = PageType_getSectionPos;
        this.getSectionStyle = PageType_getSectionStyle;
		this.getLayout = PageType_getLayout;
		this.getPt = PageType_getPt;

		this.getSectionHalign = PageType_getSectionHalign;
		this.isSectionValignMiddle = PageType_isSectionValignMiddle;

		this.getRandomizableElems = PageType_getRandomizableElems;
		this.getFromatGroup = PageType_getFromatGroup;

		this.getSectionHelpEdit = PageType_getSectionHelpEdit;
		this.getSectionHelpView = PageType_getSectionHelpView;
		this.getSectionHelpReport = PageType_getSectionHelpReport;

		this.getBehClass = PageType_getBehClass;
		this.getAspectWrt = PageType_getAspectWrt;
		this.getScoreFn = PageType_getScoreFn;
		this.getSectionOnReInitFn = PageType_getSectionOnReInitFn;
		this.getSectionOnCreateFn = PageType_getSectionOnCreateFn;
		this.getSectionOnRenderFn = PageType_getSectionOnRenderFn;
		this.getSectionAdjustHtmlFn = PageType_getSectionAdjustHtmlFn;
		this.getSectionTextFn = PageType_getSectionTextFn;

		this.getMaxScore = PageType_getMaxScore;
		this.isScoreEditable = PageType_isScoreEditable;
		this.isDoToggleSupported = PageType_isDoToggleSupported;
		this.isInteractive = PageType_isInteractive;
		this.isCorrect = PageType_isCorrect;
	}

	function PageType_init(oPage) {
		var sectionLayout;
		if ('sectionLayout' in oPage) {
			sectionLayout = oPage.sectionLayout;
		}
		this.initInternal(oPage.type, sectionLayout);
	}
	
	function PageType_initInternal(type, sectionLayout) {
		if (!(type in PageTypeMap)) type = defaultPageType;
		this.pt = PageTypeMap[type];
		this.interaction = PageInteractionTypeMap[this.pt.interaction];

		if (typeof sectionLayout === 'undefined') {
			this.layout = this.pt.layout;
		} else {
			this.layout = sectionLayout;
		}

		var randAttrName = _executeBehFunction(this.interaction, 'getRandomAttrName', 0, 0);
		this.randomizedElems = [];
		for (var i=0; i<this.layout.length; i++) {
			if (_getLayoutAttribute(this.layout, i, randAttrName, false)) {
				this.randomizedElems.push(i);
			}
		}
	}

	function PageType_getSectionCount() {
		return this.layout.length;
	}
	
	function PageType_getSectionPos(secNo) {
		if (secNo >= this.layout.length) return _posNone();
		var secInfo = this.layout[secNo];
		var isLong = !nittio.isAspectRaioWide();
		return _pos(_getParam(isLong, secInfo, 't'), _getParam(isLong, secInfo, 'l'),
		  _getParam(isLong, secInfo, 'h'), _getParam(isLong, secInfo, 'w'));
	}
	
    function PageType_getSectionStyle(secNo) {
        if (secNo >= this.layout.length) return '';
        var secInfo = this.layout[secNo];
        return secInfo['style'];
    }
    
	function PageType_getLayout() {
		return this.layout;
	}
    
	function PageType_getPt() {
		return this.pt;
	}

    function _getParam(isLong, secInfo, param) {
        var p1 = param + '1';
        return isLong && p1 in secInfo ? secInfo[p1] : secInfo[param];
    }
    
	function _pos(t, l, h, w) {
		return {
		    //'background-color' : 'blue', 
			'position' : 'absolute',
			'top' : t + '%',
			'left' : l + '%',
			'height' : h + '%',
			'width' : w + '%'
		};
	}

	function _posNone() {
		return {
			'display' : 'none'
		};
	}

	function PageType_getSectionHalign(secNo) {
		var aligntype = _getAlignType(this, secNo);
		if (aligntype == 'title' || aligntype == 'option') return _align('center');
		return _align('left');
	}

	function PageType_isSectionValignMiddle(secNo) {
		var aligntype = _getAlignType(this, secNo);
		if (aligntype == 'title' || aligntype == 'option') return true;
		return false;
	}

	function _getAlignType(pt, secNo) {
		var defaligntype = _getInteractionAttribute(pt.interaction, 'default_aligntype', 'content');
		return _getLayoutAttribute(pt.layout, secNo, 'aligntype', defaligntype);
	}

	function _align(alignment) {
		return {
			'text-align' : alignment
		};
	}

	function PageType_getRandomizableElems() {
		return this.randomizedElems;
	}
	
	function PageType_getFromatGroup(secNo) {
		return _getLayoutAttribute(this.layout, secNo, 'fmtgroup', 0);
	}

	function _executeBehFunction(interaction, fnName, layout, secNo) {
		var functionPointer = _getBehaviourFn(interaction, fnName);
		return functionPointer(layout, secNo);
	}
	
	function PageType_getSectionHelpEdit(secNo) {
		return _executeBehFunction(this.interaction, 'editHelp', this.layout, secNo);
	}

	function PageType_getSectionHelpView(secNo) {
		return _executeBehFunction(this.interaction, 'viewHelp', this.layout, secNo);
	}

	function PageType_getSectionHelpReport(secNo) {
		return _executeBehFunction(this.interaction, 'reportHelp', this.layout, secNo);
	}

	function PageType_getBehClass(secNo) {
		return _executeBehFunction(this.interaction, 'cssClass', this.layout, secNo);
	}
	
	function PageType_getAspectWrt(secNo) {
		return _executeBehFunction(this.interaction, 'aspect_wrt', this.layout, secNo);
	}
	
	function PageType_getScoreFn() {
		return _getBehaviourFn(this.interaction, 'onScore');
	}

	function PageType_getSectionOnCreateFn(secNo) {
		return _getBehaviourFn(this.interaction, 'onCreate');
	}
	
	function PageType_getSectionOnReInitFn() {
		return _getBehaviourFn(this.interaction, 'onReInitialize');
	}

	function PageType_getSectionOnRenderFn() {
		return _getBehaviourFn(this.interaction, 'onRender');
	}

	function PageType_getSectionAdjustHtmlFn() {
		return _getBehaviourFn(this.interaction, 'adjustHtml');
	}

	function PageType_getSectionTextFn() {
		return _getBehaviourFn(this.interaction, 'getSectionText');
	}

	function PageType_getMaxScore(page) {
		var maxScoreFn = _getBehaviourFn(this.interaction, 'maxScore');
		return maxScoreFn(page);
	}

	function PageType_isScoreEditable(page) {
		var functionPointer = _getBehaviourFn(this.interaction, 'is_score_editable');
		return functionPointer(page);
	}
	
	function PageType_isInteractive(section) {
        return _isInteractive(_getLayoutOfSec(section), section.secNo);
	}

	function PageType_isCorrect(section) {
		var layout = _getLayoutOfSec(section);
		var secNo = section.secNo;
		return _isCorrect(layout, secNo);
	};

	function PageType_isDoToggleSupported(page) {
		var functionPointer = _getBehaviourFn(this.interaction, 'is_do_toggle_supported');
		return functionPointer(page);
	}

	//#############################################################################################
	// Helper functions for PageType class and the behaviour classes
	//#############################################################################################
	function _getPageMode(page) {
		return page.lesson.renderCtx.pageMode(page);
	}
	
	function _getPageCtx(page) {
		return page.lesson.renderCtx.pageCtx(page);
	}

	function _getLayoutOfPage(page) {
		return page.pagetype.layout;
	}

	function _getLayoutOfSec(section) {
		return _getLayoutOfPage(section.page);
	}
	
    function getPageTypeAttribute(pagetype, attrName, defaultValue) {
	    return _getPageTypeAttribute(PageTypeMap[pagetype], attrName, defaultValue);
	}
        
	function _getPageTypeAttribute(pagetype, attrName, defaultValue) {
		if (!(attrName in pagetype)) return defaultValue;
		return pagetype[attrName];
	}

	function _getInteractionAttribute(interaction, attrName, defaultValue) {
		if (!(attrName in interaction)) return defaultValue;
		return interaction[attrName];
	}

	function _getBaseClass(beh) {
		return ('baseClass' in beh) ? beh.baseClass() : BehDefault;
	}

	function _getBehaviourFnFromClass(beh, fnName) {
		while (!(fnName in beh)) {
			beh = _getBaseClass(beh);
		}
		return beh[fnName];
	}

	function _getBehaviourFnFromBaseClass(beh, fnName) {
		return _getBehaviourFnFromClass(_getBaseClass(beh), fnName);
	}

	function _getBehaviourFn(interaction, fnName) {
		var beh = ('beh' in interaction) ? interaction.beh : BehDefault;
		return _getBehaviourFnFromClass(beh, fnName);
	}

	function _getLayoutAttribute(layout, secNo, attrName, defaultValue) {
		if (layout.length <= secNo) return defaultValue;
		if (!(attrName in layout[secNo])) return defaultValue;
		return layout[secNo][attrName];
	}

	function _isAnswer(layout, secNo) {
		return _getLayoutAttribute(layout, secNo, 'ans', false);
	}
	
	function _isCorrect(layout, secNo) {
		return _getLayoutAttribute(layout, secNo, 'correct', false);
	}

	function _isInteractive(layout, secNo) {
		if (_isAnswer(layout, secNo) || _isCorrect(layout, secNo)) return true;
		return false;
	}
	
	function _cssClass(layout, secNo, specificClass) {
		if (!_isInteractive(layout, secNo)) return '';
		var clsName = 'beh_interactive';
		if (typeof specificClass === 'string') {
			clsName += ' ' + specificClass;
		}
		return clsName;
	}

	function _getSiblings(pgSecView) {
		return pgSecView.parents('.pgHolder').find('.pgSecView');
	}
	
	function _getAnswerCount(page) {
		var count = 0;
		var layout = _getLayoutOfPage(page);
		for (var i = 0; i < page.sections.length; i++) {
			if (_isAnswer(layout, i)) count++;
		}
		return count;
	}

	function _hideSticker(section) {
		section.pgSecSticker.hide();
	}
	
	function _showStickerCorrect(section) {
		_showSticker(section, 'fgreen ion-checkmark-round');
	}
		
	function _showStickerWrong(section) {
		_showSticker(section, 'forange ion-close-round');
	}

	function _showStickerPart(section) {
		_showSticker(section, 'fgrey ion-information-circled');
	}

	function _showStickerHint(section) {
		_showSticker(section, 'ion-arrow-graph-down-left');
	}

	function _showSticker(section, icon) {
		section.pgSecSticker.show();
		var html = njs_helper.fmt2('<i class="icon {}"></i>', icon);
		section.pgSecSticker.html(html);
	}
	
	function _popupStatusTick() {
		_popupStatus({msg: '', icon: 'ion-checkmark', cls: 'border_less_green'});
	}

	function _popupStatusCross(msg) {
		if (!msg)  msg = 'Try again';
		_popupStatus({msg: msg, icon: 'ion-close-circled', cls: 'red'});
	}

	function _popupStatus(params) {
		if (!params.showClose) params.showClose = false;
		params.popdownTime = params.showClose ? false : 2000;
		njs_helper.Dialog.popupStatus2(params);
	}
		
	//#############################################################################################
	// Behaviour classes
	//#############################################################################################
	
	function _showPgSecView(section) {
		if ('pgSecTemplate' in section) section.pgSecTemplate.hide();
		section.pgSecText.hide();
		section.pgSecView.css({visibility: 'visible'}).show();
		section.pgSecLineContainer.css({visibility: 'visible'});
	}

	function _showPgSecText(section) {
		var pageCtx = _getPageCtx(section.page);
		if (pageCtx == 'edit_templ') {
			section.pgSecView.css({visibility: 'hidden'}).show();
			section.pgSecLineContainer.css({visibility: 'hidden'});
			section.pgSecText.hide();
			section.pgSecTemplate.show();
			return;
		}
		if ('pgSecTemplate' in section) section.pgSecTemplate.hide();
		
		var template = section.getTemplateFromEditor();
		var sectionTemplate = new njs_lesson_helper.SectionTemplate(template, section);
		if (sectionTemplate.getMode() == 'text' && !sectionTemplate.isSpecialText()) {
			section.pgSecView.css({visibility: 'hidden'}).show();
			section.pgSecLineContainer.css({visibility: 'hidden'});
			section.pgSecText.show();
		} else {
			section.pgSecText.hide();
			section.pgSecView.css({visibility: 'visible'}).show();
			section.pgSecLineContainer.css({visibility: 'visible'});
		}
	}

	function _showPgSecTextAndLines(section) {
		if ('pgSecTemplate' in section) section.pgSecTemplate.hide();
		section.pgSecView.css({visibility: 'hidden'}).show();
		section.pgSecLineContainer.css({visibility: 'visible'});
		section.pgSecText.show();
	}

	//----------------------------------------------------------------------------------------
	// BehDefault
	//----------------------------------------------------------------------------------------
	var BehDefault = {
		'baseClass' : function() {
			return BehDefault;
		},
		'viewHelp' : function(layout, secNo) {
			return '';
		},
		'reportHelp' : function(layout, secNo) {
			return '';
		},
		'editHelp' : function(layout, secNo) {
			return 'You could enter text, image or embed video in each section of informational pages';
		},
		'cssClass': function(layout, secNo) {
			return '';
		},
		'aspect_wrt': function(layout, secNo) {
			return true;
		},
		'getRandomAttrName': function() {
			return 'ans';
		},
		'is_score_editable': function(page) {
			return false;
		},
		'is_do_toggle_supported': function(page) {
			return false;
		},
		'onCreate' : function(section) {
		},
		'onReInitialize' : function(section) {
			section.pgSecView.off();
            section.pgSecView.modulePopupSetup = false;
			section.pgSecView.removeClass('answer_right');
			section.pgSecView.removeClass('answer_wrong');
			
		},
		'maxScore' : function(page) {
			return _getPageTypeAttribute(page.pagetype.pt, 'score', 0);
		},
		'onScore' : function(page) {
			return [ANSWERED_NA, 0];
		},
		'onRender' : function(section) {
			var pageMode = _getPageMode(section.page);
			if (pageMode == 'do' || pageMode == 'report') {
				_showPgSecView(section);
				return;
			}
			
			_showPgSecText(section);
		},
		'adjustHtml' : function(section) {
		},
		'getSectionText' : function(section) {
			return section.pgSecText.val();
		}
	};
	
	//----------------------------------------------------------------------------------------
	// BehMcq
	//----------------------------------------------------------------------------------------
	function _BehMcq_onClick(pgSecView, layout, secNo) {
		var siblings = _getSiblings(pgSecView);
		siblings.each(function() {
			jQuery(this).removeClass('selected');
		});
		pgSecView.addClass('selected');
		var lesson = nlesson.theLesson;
		if (lesson.renderCtx.launchMode() == 'edit') return;
		var curPage = lesson.getCurrentPage();
		if (lesson.oLesson.autoNavigate) {
			var voiceDefined = curPage.oPage.isVoiceButton;
			if (voiceDefined && !curPage.oPage.voiceEnded) return;		
			if(lesson.oLesson.selfLearningMode && !_isCorrect(layout, secNo)) return;
			if(_lastPage()) return;
			lesson.globals.slides.next();
		}
	}

	function _lastPage() {
        var lesson = nlesson.theLesson;
        var pages = lesson.pages;
        var curPageNo = lesson.getCurrentPageNo();
        if((pages.length - curPageNo) <= 1 && !nlesson.modulePopup.isPopupOpen()) return true;
        return false;
    }

	//----------------------------------------------------------------------------------------				
	var BehMcq = {
		'viewHelp' : function(layout, secNo) {
			if (_isAnswer(layout, secNo)) {
				return 'Click on one of the choices';
			}
			return '';
		},
		'reportHelp' : function(layout, secNo) {
			if (_isCorrect(layout, secNo)) {
				return 'Correct Answer. Green color indicates this option was chosen';
			} else if (_isAnswer(layout, secNo)) {
				return 'Wrong Answer. Red color indicates this option was chosen';
			}
			return '';
		},
		'editHelp' : function(layout, secNo) {
			if (secNo == 0) {
				return 'Enter the question / title here. You can use 2-choice layout for True/False or any question with 2 choices.';
			} else if (_isCorrect(layout, secNo)) {
				return 'Enter the correct choice - when presented, the position of choices will be jumbled.';
			} else if (_isAnswer(layout, secNo)) {
				return 'Enter the wrong choice. Each choice could be text or image.';
			}
			return 'You could optionally enter an image or some helpful text here';
		},
		'cssClass': function(layout, secNo) {
			return _cssClass(layout, secNo);
		},
		'onCreate' : function(section) {
			var layout = _getLayoutOfSec(section);
			var secNo = section.secNo;
			if (_getPageMode(section.page) == 'report') return;
			if (!_isAnswer(layout, secNo)) return;

			var pgSecView = section.pgSecView;
			pgSecView.click(function() {
				if(section.lesson.oLesson.selfLearningMode) {
					if(_isCorrect(layout, secNo)) _popupStatusTick();
					else _popupStatusCross();
				}
				_BehMcq_onClick(pgSecView, layout, secNo);
			});
			
			if ('answer' in section.oSection && section.oSection.answer == 1) {
				pgSecView.addClass('selected');
			}
		},
		'onScore' : function(page) {
			var answered = ANSWERED_NO;
			var score = 0;
			var answersArray = [];
			for (var i = 0; i < page.sections.length; i++) {
				var pgSecView = page.sections[i].pgSecView;
				var oSection = page.sections[i].oSection;
				if (!pgSecView.hasClass('selected')) {
					oSection.answer = 0;
					continue;
				}
				
				answered = ANSWERED_YES;
				oSection.answer = 1;
				answersArray.push(oSection.text);
				if (i == 1) score = page.getMaxScore();
			}
			return [answered, score, answersArray];
		},
		'adjustHtml' : function(section) {
			_hideSticker(section);
			if (_getPageMode(section.page) != 'report') return;
			var layout = _getLayoutOfSec(section);
			var secNo = section.secNo;
			if (section.oSection.answer != 1) {
				if (_isCorrect(layout, secNo)) _showStickerHint(section);
				return;
			}
			if (_isCorrect(layout, secNo)) {
				section.pgSecView.addClass('answer_right');
				_showStickerCorrect(section);
			} else {
				section.pgSecView.addClass('answer_wrong');
				_showStickerWrong(section);
			}
		}
	};
	
	//----------------------------------------------------------------------------------------
	// BehMatch
	//----------------------------------------------------------------------------------------
	function _BehMatch_onClickFrom(section) {
		var pgSecView = section.pgSecView;
		pgSecView.parents('.pgHolder').find('.last_selected').removeClass('last_selected');
		pgSecView.addClass('last_selected');

		var partnerSecNo = pgSecView.attr('answer');
		if (typeof partnerSecNo === 'undefined' || partnerSecNo === false) {
			return;
		}			

		var partnerView = section.page.sections[parseInt(partnerSecNo)].pgSecView;
		pgSecView.removeAttr('answer').removeClass('selected');
		partnerView.removeAttr('answer').removeClass('selected');

		section.pgSecLineContainer.children('.line').remove();
	}

	function _BehMatch_onClickTo(section, pageOrientation) {
		var pgSecView = section.pgSecView;
		var selected = pgSecView.parents('.pgHolder').find('.last_selected');
		if (selected.length < 1) {
			return;
		}
		var oldPartnerSecNo = pgSecView.attr('answer');
		if (typeof oldPartnerSecNo !== 'undefined' && oldPartnerSecNo !== false) {
			var oldPartnerSec = section.page.sections[parseInt(oldPartnerSecNo)];
			oldPartnerSec.pgSecView.removeAttr('answer').removeClass('selected');
			oldPartnerSec.pgSecLineContainer.children('.line').remove();
		}
		selected.attr('answer', pgSecView.attr('secNo')).addClass('selected').removeClass('last_selected');
		pgSecView.attr('answer', selected.attr('secNo')).addClass('selected');
		
		var fromSec = section.page.sections[parseInt(selected.attr('secNo'))];
		_BehMatch_drawLine(fromSec.pgSecLineContainer, selected, pgSecView, pageOrientation);
	}

	function _BehMatch_drawLine(lineContainer, pgSecView1, pgSecView2, pageOrientation) {
		var secNo = parseInt(pgSecView1.attr('secNo'));

		var points = _BehMatch_getLinePoints(pgSecView1, pgSecView2, pageOrientation);
		_drawLineInt(lineContainer, secNo, points[0], points[1], points[2], points[3], pageOrientation);
	}

	function _BehMatch_getLinePoints(box1, box2, pageOrientation) {
		var b1=box1.offset();
		var b2=box2.offset();
		var x1 = b1.left + box1.outerWidth()/2;
		var y1 = b1.top + box1.outerHeight();
		var x2 = b2.left + box2.outerWidth()/2;
		var y2 = b2.top;

		if (pageOrientation == 'vertical') {
			x1 = b1.left + box1.outerWidth();
			y1 = b1.top + box1.outerHeight()/2;
			x2 = b2.left;
			y2 = b2.top + box2.outerHeight()/2;
		}
		return [x1, y1, x2, y2];
	}

    var maxColors = 6;
	function _drawLineInt(lineContainer, lineId, x1, y1, x2, y2, pageOrientation) {
		lineContainer.children('.line').remove();
		var angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
		var transform = 'rotate(' + angle + 'deg)';

		var length = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
		var oleft = x1 < x2 ? x1 : x2;
		var otop  = y1 < y2 ? y1 : y2;
		
		var divStr = njs_helper.fmt2('<div class="line not_inside lineColor{}">',
            lineId % maxColors);
		jQuery(divStr).appendTo(lineContainer).attr('id', lineId)
			.css({transform: transform})
			.width(length).offset({left: oleft, top: otop});
	}

	function _BehMatch_IsMatching(fromSection, toSection, totalPairs) {
		var s1 = Number(fromSection);
		var s2 = Number(toSection);
		if (s2-s1 == totalPairs) return true;
		return false;
	}

	//----------------------------------------------------------------------------------------
	var BehMatch = {
		'viewHelp' : function(layout, secNo) {
			if (_isCorrect(layout, secNo)) {
				return 'Click on one of these choices and then click on the matching choice';
			} else if (_isAnswer(layout, secNo)) {
				return 'First click on one of the choices from the other list and then click on the matching choice from this list';
			}
			return '';
		},
		'reportHelp' : function(layout, secNo) {
			if (_isCorrect(layout, secNo)) {
				return 'If this is colored green, it means the answer was right. Red indicates the answer was wrong. You can see the correct answer to the right.';
			}
			return '';
		},
		'editHelp' : function(layout, secNo) {
			if (secNo == 0) {
				return 'Enter the page title here';
			} else if (_isCorrect(layout, secNo)) {
				return '<Item to be Matched>';
			} else if (_isAnswer(layout, secNo)) {
				return '<Matching Item>';
			}
			return 'You could optionally enter an image or some helpful text here';
		},
		'cssClass': function(layout, secNo) {
			return _cssClass(layout, secNo);
		},
		'onCreate' : function(section) {
			var layout = _getLayoutOfSec(section);
			var secNo = section.secNo;
			if (_getPageMode(section.page) == 'report') return;
			if (!_isInteractive(layout, secNo)) return;

			var pgSecView = section.pgSecView;
			pgSecView.click(function() {
				if (_isCorrect(layout, secNo)) {
					_BehMatch_onClickFrom(section);
				} else {
					_BehMatch_onClickTo(section, _getPageTypeAttribute(section.page.pagetype.pt, 'orientation', 'horizontal'));
				}
			});
			if (_isCorrect(layout, secNo)) {
				if (!('answer' in section.oSection)) return;
				pgSecView.attr('answer', section.oSection.answer);
				pgSecView.addClass('selected');
				var answer = parseInt(section.oSection.answer);			
				var partner = section.page.sections[answer];
				partner.partner = secNo;
			} else if (_isAnswer(layout, secNo)) {
				if (!('partner' in section)) return;
				pgSecView.attr('answer', section.partner);
				pgSecView.addClass('selected');
			}
		},
		'onScore' : function(page) {
			var nOptions = _getAnswerCount(page);
			var nEmptyOptions = 0;
			var score = 0;
			var answered = 0;
	
			var layout = _getLayoutOfPage(page);
			for (var i = 0; i < page.sections.length; i++) {
				var section = page.sections[i];
				var secNo = section.secNo;
				if (!_isCorrect(layout, secNo)) continue;
				if (section.oSection.text == "") {
					nEmptyOptions++;
					continue;
				}
				
				var answer = section.pgSecView.attr('answer');
				if (typeof answer === 'undefined' || answer === false || answer === '0') {
					if ('answer' in section.oSection) delete section.oSection.answer;
					continue;
				}
				
				section.oSection.answer = answer;
				answered += 1;
				
				if (_BehMatch_IsMatching(i, answer, nOptions)) score += 1;				
			}
			if(nOptions != nEmptyOptions) {
				nOptions = nOptions - nEmptyOptions;
			}
			if (answered == nOptions) {
				answered = ANSWERED_YES;
			} else if (answered > 0) {
				answered = ANSWERED_PART;
			} else {
				answered = ANSWERED_NO;
			}
	
			var maxScore = page.getMaxScore();
			score = Math.round(maxScore/nOptions*score);
			return [answered, score];
		},
		'adjustHtml' : function(section) {
			_hideSticker(section);
			var nOptions = _getAnswerCount(section.page);
			if (_getPageMode(section.page) == 'edit') return;
			if (!_isCorrect(_getLayoutOfSec(section), section.secNo)) return;

			var answer;
			if (section.oSection.text == "") {
				section.pgSecView.css({visibility: 'hidden'});
				return;
			}
			
			if (_getPageMode(section.page) == 'report') {
				answer = parseInt(section.oSection.answer);			
			} else {
				answer = parseInt(section.pgSecView.attr('answer'));
			}
			
			if (!answer || answer >= section.page.sections.length) return;
			var partner = section.page.sections[answer];
	
			if (_getPageMode(section.page) == 'report') {
				if (_BehMatch_IsMatching(section.secNo, answer, nOptions)) {
					section.pgSecView.addClass('answer_right');
					_showStickerCorrect(section);
					partner.pgSecView.addClass('answer_right');
				} else {
					section.pgSecView.addClass('answer_wrong');
					_showStickerWrong(section);			
					partner.pgSecView.addClass('answer_wrong');			
				}
			}
	
			_BehMatch_drawLine(section.pgSecLineContainer, section.pgSecView, partner.pgSecView, _getPageTypeAttribute(section.page.pagetype.pt, 'orientation', 'horizontal'));			
		}
	};

	//----------------------------------------------------------------------------------------
	// BehOrder
	//----------------------------------------------------------------------------------------
	var BehOrder = {
		'viewHelp' : function(layout, secNo) {
			if (_isAnswer(layout, secNo))
				return 'click on two such choices to swap them';
			return '';
		},
		'reportHelp' : function(layout, secNo) {
			if (_isAnswer(layout, secNo))
				return 'If this is colored green, it means the answer was right. Red indicates the answer was wrong. Items are presented in the right order.';
			return '';
		},
		'editHelp' : function(layout, secNo) {
			if (secNo == 0) {
				return 'Enter the page title here';
			} else if (_isAnswer(layout, secNo)) {
				return '<Item to be ordered>';
			}
			return 'You could optionally enter an image or some helpful text here';
		},
		'cssClass': function(layout, secNo) {
			return _cssClass(layout, secNo);
		},
		'onCreate' : function(section) {
			var layout = _getLayoutOfSec(section);
			var secNo = section.secNo;
			if (_getPageMode(section.page) == 'report') return;
			if (!_isAnswer(layout, secNo)) return;

			var pgSecView = section.pgSecView;
			
			if ('answered' in section.page.oPage) section.page.answered = section.page.oPage.answered;
			if ('answer' in section.oSection) {
				section.secPosShuffled = parseInt(section.oSection.answer);
				var pt = section.page.pagetype;
				section.pgSecView.css(pt.getSectionPos(section.secPosShuffled));
				pgSecView.attr('answer', section.secPosShuffled);
				pgSecView.children('.positionInOrder').html(section.secPosShuffled);
			}
			
			pgSecView.click(function() {
	
				var partnerPgSecView = pgSecView.parents('.pgHolder').find('.last_selected');
				if (partnerPgSecView.length < 1) {
					pgSecView.addClass('last_selected');
					return;
				} 
				partnerPgSecView.removeClass('last_selected');
	
				// last_selected exists, do the swapping.
				// Find the last selected pageSecView using the stored secNo.
				var partner = section.page.sections[parseInt(partnerPgSecView.attr('secNo'))];
	
				var tempSecNo = partner.secPosShuffled;
				partner.secPosShuffled = section.secPosShuffled;
				section.secPosShuffled = tempSecNo;
				
				var pt = section.page.pagetype;
                var opts = {duration: 1000, easing: 'easeOutQuad'};
                
				section.pgSecView.velocity('finish', true).velocity(
				    pt.getSectionPos(section.secPosShuffled), opts);
				partner.pgSecView.velocity('finish', true).velocity(
				    pt.getSectionPos(partner.secPosShuffled), opts);
	
				pgSecView.attr('answer', section.secPosShuffled);
				partnerPgSecView.attr('answer', partner.secPosShuffled);
				
				pgSecView.children('.positionInOrder').html(section.secPosShuffled);
				partnerPgSecView.children('.positionInOrder').html(partner.secPosShuffled);
				
				section.page.answered = true;
				
			});
		},
		'onScore' : function(page) {
			var nOptions = 0;
			var answered = ('answered' in page && page.answered) ?  ANSWERED_YES : ANSWERED_NO;
			page.oPage.answered = answered;
			var score = 0;

			var layout = _getLayoutOfPage(page);
			for (var i = 0; i < page.sections.length; i++) {
				if (!_isAnswer(layout, i)) continue;
				nOptions++;

				var answer = page.sections[i].pgSecView.attr('answer');
				if (typeof answer === 'undefined' || answer === '0') {
					//Some data may be already in the correct order position.
					// In that case User may not touch it.
					answer = page.sections[i].secPosShuffled;
				}
				
				page.sections[i].oSection.answer = answer;
				if (parseInt(answer) === parseInt(i)) {
					// If answer is same as the section number then it is correct answer.
					score++;
				}
			}
			var maxScore = page.getMaxScore();
			score = Math.round(maxScore/nOptions*score);
			return [answered, score];
		},
		'adjustHtml' : function(section) {
			_hideSticker(section);
			var layout = _getLayoutOfSec(section);
			var secPos = section.secNo;
			if (!_isAnswer(layout, secPos)) return;

			var posStr;
			if (_getPageMode(section.page) != 'report') {
				posStr = section.secPosShuffled;
			} else {
				posStr = section.oSection.answer;
				if (posStr == section.secNo) {
					section.pgSecView.addClass('answer_right');
					_showStickerCorrect(section);
				} else {
					section.pgSecView.addClass('answer_wrong');
					_showStickerWrong(section);
				}
			}
			section.pgSecView.children('.positionInOrder').remove();
			section.pgSecView.append(njs_helper.fmt2("<div class='positionInOrder'>{}</div>", posStr));
		}
	};

	//----------------------------------------------------------------------------------------
	// BehFib
	//----------------------------------------------------------------------------------------
	function _BehFib_IsMatching(answer, correctanswer) {
		var a = answer.toLowerCase().trim();
		var c = correctanswer.toLowerCase().trim();

		if (a == '') return false;
		if (c == '' || a == c) return true;
		return false;
	}

	// There are lot of unnecessary addition of ":" and stuff like that.
	// This is due to supporting lessons and reports created with not so great old code
	// Also 0 is needed to be checked in correctanswer for support lessons created with old code
	function _BehFib_moveoutCorrectAnswer(section) {
		var oSection = section.oSection;
		var txt = _BehFib_Report_getAnswer(section);
		if (txt != '') {
			// Partially saved assignment is opened with some answer filled here
			section.pgSecText.val(txt);
			return;
		}
		txt = _BehFib_Report_getCorrectAnswer(section);
		if (txt != '') {
			// lesson was saved in view mode and opened first time in viewer
			// or partially saved lesson is opened with this FIB entry empty last time
			section.pgSecText.val('');
			return;
		}

		// Transition from editor to viewer
		var secText = section.pgSecText.val().toString();
		section.oSection.correctanswer = ':' + secText;
		section.pgSecText.val('');
	}
	
	function _BehFib_moveinCorrectAnswer(section) {
		var oSection = section.oSection;
		var secText = ('correctanswer' in oSection) ? oSection.correctanswer.toString() : '' ;
		if (secText == '' || secText == '0') return;
		
		secText = secText.substring(secText.indexOf(":")+1);
		section.pgSecText.val(secText);
		oSection.correctanswer = '0';
	}
	
	function _BehFib_Report_getAnswer(section) {
		var answer = section.oSection.answer;
		if (typeof answer !== 'string') answer = '';
		return answer.substring(0, answer.lastIndexOf(":"));
	}

	function _BehFib_Report_getCorrectAnswer(section) {
		var canswer = section.oSection.correctanswer;
		if (typeof canswer !== 'string') canswer = '';
		var index = canswer.indexOf(":");
		return (index >= 0) ? canswer.substring(index+1) : '';
	}

	function _BehFib_SetupOnReportClick(section) {
		section.pgSecView.click(function() {
			var answer = _BehFib_Report_getAnswer(section);
			var canswer = _BehFib_Report_getCorrectAnswer(section);
			if (canswer == '') canswer = '<Not specified>';
			njs_helper.Dialog.popup('Answer for the chosen blank', 
								njs_helper.fmt2('<p><b>Correct Answer: </b>{}</p><p><b>Your Answer: </b>{}</p>', 
											njs_helper.escape(canswer), njs_helper.escape(answer)));
		});
	}

	function _BehFib_onCreate(section, bReportClick) {
		if (!_isAnswer(_getLayoutOfSec(section), section.secNo)) return;

		var pageMode = _getPageMode(section.page);
		if (pageMode == 'do') {
			_BehFib_moveoutCorrectAnswer(section);
		} else if (pageMode == 'edit') {
			_BehFib_moveinCorrectAnswer(section);
		} else if (bReportClick && pageMode == 'report') {
			_BehFib_SetupOnReportClick(section);
		}
	}
	
	var _enterTheAnswer = 'Enter the answer here';

	var BehFib = {
		'viewHelp' : function(layout, secNo) {
			// Is not called
			return '';
		},
		'reportHelp' : function(layout, secNo) {
			if (_isAnswer(layout, secNo))
				return 'If this is colored green, it means the answer was right. Red indicates the answer was wrong. Click to see the correct answer';
			return '';
		},
		'editHelp' : function(layout, secNo) {
			if (secNo == 0) {
				return 'Enter the question/title here';
			} else if (_isAnswer(layout, secNo)) {
				return _enterTheAnswer;
			}
			return 'You could optionally enter an image or some helpful text here';
		},
		'cssClass': function(layout, secNo) {
			return _cssClass(layout, secNo, 'beh_fill');
		},
		'getRandomAttrName': function() {
			// None of the sections are randomized in this case. The default 'ans' attr should
			// not be taken as random indicator. So a non-existent attribure name is returned
			return 'randomizedSection';
		},
		'is_score_editable': function(page) {
			return true;
		},
		'onCreate' : function(section) {
			_BehFib_onCreate(section, true);
		},
		'onScore' : function(page) {
			var maxAnswers = 0;
			var answered = 0;
			var score = 0;
			var answersArray = [];
			var layout = _getLayoutOfPage(page);
			for (var i = 0; i < page.sections.length; i++) {
				if (!_isAnswer(layout, i)) continue;

				maxAnswers++;
				var answer = page.sections[i].pgSecText.val();
				answersArray.push(answer);
				if (typeof answer !== 'string') continue;

				if (answer != '') answered++;
				page.sections[i].oSection.answer = answer + ':';
				var canswer = _BehFib_Report_getCorrectAnswer(page.sections[i]);
				if (_BehFib_IsMatching(answer, canswer)) score++;
			}
					
			if (answered == maxAnswers) {
				answered = ANSWERED_YES;
			} else if (answered > 0){
				answered = ANSWERED_PART;
			} else {
				answered = ANSWERED_NO;
			}
			var maxScore = page.getMaxScore();
			score = Math.round(maxScore/maxAnswers*score);
			return [answered, score, answersArray];
		},
		'onRender' : function(section) {
			var layout = _getLayoutOfSec(section);
			var secNo = section.secNo;
			if (!_isInteractive(layout, secNo)) {
				return _getBehaviourFnFromBaseClass(BehFib, 'onRender')(section);
			}
			if (!_isAnswer(layout, secNo)) return;

			var pageMode = _getPageMode(section.page);
			if (pageMode == 'do') {
				_BehFib_moveoutCorrectAnswer(section);
				_showPgSecText(section);
				return;
			}
			if (pageMode == 'report') {
				var answer = _BehFib_Report_getAnswer(section);
				section.setViewHtml(answer, true);
				_showPgSecView(section);
				return;
			}
			_BehFib_moveinCorrectAnswer(section);
			_showPgSecText(section);
		},
		'adjustHtml' : function(section) {
			_hideSticker(section);
			if (!_isAnswer(_getLayoutOfSec(section), section.secNo)) return;
			if (_getPageMode(section.page) != 'report') return;

			var answer = _BehFib_Report_getAnswer(section);
			var canswer = _BehFib_Report_getCorrectAnswer(section);

			if (_BehFib_IsMatching(answer, canswer)) {
				section.pgSecView.addClass('answer_right');
				_showStickerCorrect(section);
			} else if (answer.toLowerCase().trim() != ''){
				section.pgSecView.addClass('answer_wrong');
				_showStickerWrong(section);
			} else {
				_showStickerHint(section);
			}
		},
		'getSectionText' : function(section) {
			if (section.lesson.renderCtx.launchMode() != 'edit') return section.pgSecText.val();
			var layout = _getLayoutOfSec(section);
			var secNo = section.secNo;
			if (!_isAnswer(layout, secNo)) return section.pgSecText.val();
			var pageMode = _getPageMode(section.page);
			if (pageMode == 'edit') return section.pgSecText.val();
			var secText = _BehFib_Report_getCorrectAnswer(section);
			if (secText == '0' || secText == '') return section.pgSecText.val();
			return secText;
		}
	};

	//----------------------------------------------------------------------------------------
	// BehDesc
	//----------------------------------------------------------------------------------------
	var BehDesc = {
		'baseClass' : function() {
			return BehFib;
		},
		'reportHelp' : function(layout, secNo) {
			if (_isAnswer(layout, secNo))
				return 'Descriptive answer provided by the learner';
			return '';
		},
		'editHelp' : function(layout, secNo) {
			if (secNo == 0) {
				return 'Enter the question/title here';
			} else if (_isAnswer(layout, secNo)) {
				return 'Learner to provide answer here';
			}
			return 'You could optionally enter an image or some helpful text here';
		},
		'cssClass': function(layout, secNo) {
			return _cssClass(layout, secNo, 'beh_desc');
		},
		'aspect_wrt': function(layout, secNo) {
			if (_isAnswer(layout, secNo)) return false;
			return true;
		},
		'onCreate' : function(section) {
			_BehFib_onCreate(section, false);
		},
		'onRender' : function(section) {
			if (_isAnswer(_getLayoutOfSec(section), section.secNo) && _getPageMode(section.page) == 'edit') {
				section.pgSecText.attr('disabled', 'disabled');
			} else {
				section.pgSecText.removeAttr('disabled');
			}
			return _getBehaviourFnFromBaseClass(BehDesc, 'onRender')(section);
		},
		'adjustHtml' : function(section) {
			_hideSticker(section);
		}
	};

	//----------------------------------------------------------------------------------------
	// BehSimulation
	//----------------------------------------------------------------------------------------
	var BehSimulation = {
		// help on pgSecView (viewHelp/reportHelp) is set in adjustHtml
		'viewHelp' : function(layout, secNo) {
			return '';
		},
		'reportHelp' : function(layout, secNo) {
			return '';
		},
		'editHelp' : function(layout, secNo) {
			if (!_isCorrect(layout, secNo)) return '';
			var ret = 	'Step 1: Insert or copy/paste an image.' + 
						' Step 2: View the image by pressing the section preview button at top left of this box (not whole page preview).' +
						' Step 3: Move and resize the translucent black box to the needed position and size.';
			
			return ret;
		},
		'cssClass': function(layout, secNo) {
			return _cssClass(layout, secNo);
		},
		'onRender' : function(section) {
			_getBehaviourFnFromBaseClass(BehSimulation, 'onRender')(section);
			var layout = _getLayoutOfSec(section);
			var secNo = section.secNo;
			if (!_isInteractive(layout, secNo)) return;

			if(!section.oSection.simuBox) section.oSection.simuBox = {t: 45, l: 45, w: 10, h: 10};
			var pageMode = _getPageMode(section.page);
			if (pageMode == 'do') {
				_showPgSecView(section);
				return;
			}
			
			if (pageMode == 'report') {
				_showPgSecView(section);
				return;
			}
			
			var pgCtx = _getPageCtx(section.page);
			_BehFibParts_createToggleSectionButton(section, pgCtx, true);
			if (pgCtx == 'edit_gra') {
				// pageMode == 'edit', pageCtx = 'edit_gra'
				_showPgSecView(section);
				return;
			} 
			// pageMode == 'edit', pageCtx = 'edit'
			_showPgSecText(section);
		},
		'adjustHtml' : function(section) {
			_getBehaviourFnFromBaseClass(BehSimulation, 'adjustHtml')(section);
			var layout = _getLayoutOfSec(section);
			if (!_isInteractive(layout, section.secNo)) return;
			var pageMode = _getPageMode(section.page);
			var pgCtx = _getPageCtx(section.page);
			if (pageMode == 'edit' && pgCtx != 'edit_gra') return;
			_Simulation_createSimuBox(section, pageMode);
		},
		'onScore' : function(page) {
			var answered = ANSWERED_NO;
			var score = 0;
			for (var i = 0; i < page.sections.length; i++) {
				var section = page.sections[i];
				var layout = _getLayoutOfSec(section);
				if (!_isInteractive(layout, section.secNo)) continue;
				var pgSecView = section.pgSecView;
				if (pgSecView.answerStatus !== undefined) 
					section.oSection.answer = pgSecView.answerStatus ? 'correct' : 'wrong';
				if (section.oSection.answer === undefined) continue;
				answered = ANSWERED_YES;
				if (section.oSection.answer == 'correct') score = page.getMaxScore();
			}
			return [answered, score];
		},
	};

	//----------------------------------------------------------------------------------------
	// Simulation
	//----------------------------------------------------------------------------------------
	function _Simulation_createSimuBox(section, pageMode) {
		var pgSecView = section.pgSecView;
		pgSecView.find(".simuBox").remove();
		_Simulation_updatePsvAttrs(section.pgSec, pgSecView, pageMode);
		var imgElem = pgSecView.find('.njs_img');
		if (imgElem.length == 0) return _Simulation_error();
		var imgUrl = imgElem.attr('src');
		if (!imgUrl) return _Simulation_error();
		_showPageSpinner(section.page);
		jQuery('<img/>').on('load', function() {
			_hidePageSpinner(section.page);
			_onImageLoaded({w: this.width, h: this.height}, pgSecView, section, pageMode);
		}).on('error', function() {
			_hidePageSpinner(section.page);
			if (_isPageVisible(section.page)) _Simulation_error(true);
		}).attr('src', imgUrl);
	}
	
	function _isPageVisible(page) {
		return page.lesson.getCurrentPageId() == page.getPageId();
	}

	function _Simulation_error(urlDefined) {
		var msg = urlDefined ? 'Error loading simulation image.'
			: 'Insert an image in the simulation section.';
		njs_helper.Dialog.popupStatus2({msg: msg, cls: 'highlight red', popdownTime: 5000, showClose: true});
	}
	
	function _showPageSpinner(page) {
		var pgSpinner = page.hPage.find('.pgSpinner');
		if (pgSpinner.length == 0) {
			pgSpinner = jQuery('<div class="pgSpinner row row-center"><div class="col"></div><div class="nl-spinner"></div><div class="col"></div></div>');
			page.hPage.append(pgSpinner);
		}
		pgSpinner.show();
	}

	function _hidePageSpinner(page) {
		var pgSpinner = page.hPage.find('.pgSpinner');
		if (pgSpinner) pgSpinner.hide();
	}
	
	function _Simulation_updatePsvAttrs(pgSec, pgSecView, pageMode) {
		var title = '';
		var interactive = true;
		if (pageMode == 'edit') {
			title = 'Move and resize the translucent black box to the needed position and size.';
			interactive = false;
		} else if (pageMode == 'do') {
			title = 'Please click in the correct location within the provided image.';
		} else {
			title = 'The translucent box shows the correct location that needs to be clicked. The box color indicates if the learner clicked in the correct location or not.';
		}
		var secTbIcon = pgSec.find('.sectiontoolbarIcon');

		pgSecView.attr('title', title);
		if (interactive) {
			pgSecView.addClass('beh_interactive');
			secTbIcon.addClass('hide');
		} else {
			pgSecView.removeClass('beh_interactive');
			secTbIcon.removeClass('hide');
		}
	}
	
	function _onImageLoaded(imgSize, pgSecView, section, pageMode) {
		var rects = _Simulation_getRects(pgSecView, imgSize, section.page.hPage);
		var boxCssPos = _Simulation_jsonPosToCssPos(rects, section.oSection.simuBox);
		var simuBox = jQuery('<div class="simuBox">');
		_Simulation_setBoxCssPos(simuBox, boxCssPos);
		pgSecView.append(simuBox);
		var nclicks = 0;
		if (pageMode == 'edit') {
			simuBox.addClass('edit_gra');
			simuBox.draggable({containment : [rects.psv.l + rects.img.l, rects.psv.t + rects.img.t, 
				rects.psv.l + rects.img.r - boxCssPos.w, rects.psv.t + rects.img.b - boxCssPos.h], 
				start: _onDragStart, stop: _onDragDone});
			simuBox.resizable({stop: _onResize});
			pgSecView.unbind('click');
		} else if (pageMode == 'do') {
			if(section.lesson.oLesson.selfLearningMode && (section.lesson.oLesson.blink_after == 0)) simuBox.addClass('answer_shown');
			simuBox.bind('click', function(e) {
				_onClickDoMode(e, section, true);
			});
			pgSecView.unbind('click');
			pgSecView.bind('click', function(e) {
				nclicks += 1;
				if(section.lesson.oLesson.selfLearningMode && section.lesson.oLesson.blink_after > 0 && nclicks >= section.lesson.oLesson.blink_after) simuBox.addClass('answer_shown');
				_onClickDoMode(e, section, false, nclicks);
			});
		} else if (pageMode == 'report') {
			pgSecView.unbind('click');
			pgSecView.bind('click', function(e) { _onClickReportMode(e, section);});
			if (section.oSection.answer == 'correct') simuBox.addClass('answer_right');
			else if (section.oSection.answer == 'wrong') simuBox.addClass('answer_wrong');
		}
		
		function _onClickReportMode(e, section) {
			e.preventDefault();
			e.stopImmediatePropagation();
			var params = {msg: 'No answer was clicked (shaded area is the correct location).', icon: 'ion-alert', cls: 'red'};
			if (section.oSection.answer == 'correct') {
				params.msg = 'Learner clicked on the correct location (green shaded area).';
				params.icon = 'ion-checkmark-circled';
				params.cls = 'green';
			} else if (section.oSection.answer == 'wrong') {
				params.msg = 'Learner clicked outside the correct location (red shaded area is the correct location).';
				params.icon = 'ion-close-circled';
			}
			_popupStatus(params);
		}
		
		function _onClickDoMode(e, section, correct, nclicks) {
			e.preventDefault();
			e.stopImmediatePropagation();
			section.pgSecView.answerStatus = correct;
			var slm = section.lesson.oLesson.selfLearningMode;
			if (slm) {
				if (correct) _popupStatusTick();
				else _popupStatusCross();
			}
			var moveNext = correct || !slm;
			if (!moveNext || (nclicks <= section.lesson.oLesson.blink_after && section.lesson.oLesson.selfLearningMode)) return;
			var lesson = section.page.lesson;
			var pageNo = lesson.getCurrentPageNo();
			if (pageNo >= lesson.pages.length-1) return;
			var userOptions = {preventTransitionAnimation: lesson.pages[pageNo + 1].pagetype.interaction.id == 'SIMULATE'};
			section.lesson.globals.slides.next(userOptions);
		}

		var _dragOffset = {x:0, y:0};
		function _onDragStart(e, ui) {
			_dragOffset = {x:e.offsetX, y:e.offsetY};
		}

		var simuBoxBorderWidth = 2;
		var minSize = 20;
		function _onDragDone(e, ui) {
			boxCssPos.l = e.pageX - _dragOffset.x - rects.psv.l - simuBoxBorderWidth;
			boxCssPos.t = e.pageY - _dragOffset.y - rects.psv.t - simuBoxBorderWidth;
			if (boxCssPos.l + boxCssPos.w > rects.img.r) boxCssPos.l = rects.img.r - boxCssPos.w;
			if (boxCssPos.t + boxCssPos.h > rects.img.b) boxCssPos.t = rects.img.b - boxCssPos.h;
			if (boxCssPos.l < rects.img.l) boxCssPos.l = rects.img.l;
			if (boxCssPos.t < rects.img.t) boxCssPos.t = rects.img.t;
			_Simulation_setBoxCssPos(simuBox, boxCssPos);
			section.oSection.simuBox = _Simulation_cssPosToJsonPos(rects, boxCssPos);
		}

		function _onResize(event) {
			boxCssPos.w = simuBox.width() + 2*simuBoxBorderWidth;
			boxCssPos.h = simuBox.height() + 2*simuBoxBorderWidth;
			if (boxCssPos.l + boxCssPos.w > rects.img.r) boxCssPos.w = rects.img.r - boxCssPos.l;
			if (boxCssPos.t + boxCssPos.h > rects.img.b) boxCssPos.h = rects.img.b - boxCssPos.t;
			if (boxCssPos.w < minSize) boxCssPos.w = minSize;
			if (boxCssPos.h < minSize) boxCssPos.h = minSize;

			_Simulation_setBoxCssPos(simuBox, boxCssPos);
			section.oSection.simuBox = _Simulation_cssPosToJsonPos(rects, boxCssPos);
			return;
		}
	}

	function _Simulation_getRects(pgSecView, imgSize, hPage) {
		// If this page is not visible page, the left of the section might will be
		// in-correct as the section is transform-translated to left or right.
		var pageOffset = hPage.offset();
		var bodyOffset = jQuery('.inner_body').offset();
		var leftDelta = pageOffset.left - bodyOffset.left; 
		

		var secOffset = pgSecView.offset();
		var ret = {psv: {l: secOffset.left - leftDelta, t: secOffset.top,
						 w: pgSecView.width(), h: pgSecView.height()},
				   img: {w: imgSize.w, h: imgSize.h}};
		if (ret.psv.h && ret.img.h) {
			var psvAr = ret.psv.w / ret.psv.h;
			var imgAr = ret.img.w / ret.img.h;
			if (psvAr > imgAr) {
				ret.img.h = ret.psv.h;
				ret.img.w = ret.img.h*imgAr;
			} else {
				ret.img.w = ret.psv.w;
				ret.img.h = ret.img.w/imgAr;
			}
		}
		if (ret.img.w > ret.psv.w) ret.img.w = ret.psv.w;
		if (ret.img.h > ret.psv.h) ret.img.h = ret.psv.h;
		ret.img.l = (ret.psv.w-ret.img.w)/2;
		ret.img.t = (ret.psv.h-ret.img.h)/2;
		if (ret.img.l < 0) ret.img.l = 0;
		if (ret.img.t < 0) ret.img.t = 0;
		ret.img.r = ret.img.l+ret.img.w;
		ret.img.b = ret.img.t+ret.img.h;
		return ret;
	}
	
	function _Simulation_jsonPosToCssPos(rects, jsonPos) {
		return {l: (jsonPos.l/100*rects.img.w + rects.img.l),
				t: (jsonPos.t/100*rects.img.h + rects.img.t),
				w: jsonPos.w/100*rects.img.w,
				h: jsonPos.h/100*rects.img.h};
	}
	
	function _Simulation_cssPosToJsonPos(rects, cssPos) {
		return {l: (cssPos.l - rects.img.l)/rects.img.w*100,
				t: (cssPos.t - rects.img.t)/rects.img.h*100,
				w: cssPos.w/rects.img.w*100,
				h: cssPos.h/rects.img.h*100};
	}

	function _Simulation_setBoxCssPos(simuBox, cssPos) {
		simuBox.css({left: cssPos.l, top: cssPos.t, width: cssPos.w, height: cssPos.h});
	}

	//----------------------------------------------------------------------------------------
	// BehFibParts
	//----------------------------------------------------------------------------------------
	function _BehFibParts_onClickFrom(section) {
		if (_getPageCtx(section.page) != 'edit_gra') return;
		
		var pgSecView = section.pgSecView;
		_BehFibParts_ClearSelection(pgSecView);
		pgSecView.addClass('last_selected');
	}
	
	function _BehFibParts_ClearSelection(pgSecView) {
		pgSecView.parents('.pgHolder').find('.last_selected').removeClass('last_selected');
	}

	function _BehFibParts_onClickTo(section, e) {
		if (_getPageCtx(section.page) != 'edit_gra') return;

		var pgSecView = section.pgSecView;
		var selectedPgSecView = pgSecView.parents('.pgHolder').find('.last_selected');
		if (selectedPgSecView.length < 1) return;
		
		var selectedSection = section.page.sections[parseInt(selectedPgSecView.attr('secNo'))];
		
		selectedSection.oSection.lineTo = _BehFibParts_serializeCoordinate(e.pageX, e.pageY, section);
		_BehFibParts_drawLine(selectedSection);
	}

	function _BehFibParts_serializeCoordinate(ptx, pty, wrtSection) {
		var box = wrtSection.pgSecView;
		var offset = box.offset();
		return {x: (ptx - offset.left)/box.width(), y: (pty - offset.top)/box.height(), secNo: wrtSection.secNo};
	}
	
	function _BehFibParts_deserializeCoordinate(lineToObj, page) {
		var box = page.sections[lineToObj.secNo].pgSecView;
		var offset = box.offset();
		return {x: lineToObj.x*box.width() + offset.left, y: lineToObj.y*box.height() + offset.top};
	}
	
	function _BehFibParts_drawLine(selectedSection) {
		var pgSecView = selectedSection.pgSecView;
		var container = selectedSection.pgSecLineContainer;

		if (!('lineTo' in selectedSection.oSection)) return;

		var point = _BehFibParts_deserializeCoordinate(selectedSection.oSection.lineTo, selectedSection.page);
		var points = _BehFibParts_getLinePoints(pgSecView, point.x, point.y);

		var secNo = parseInt(pgSecView.attr('secNo'));
		_drawLineInt(container, secNo, points[0], points[1], points[2], points[3], 'vertical');
	}

	function _BehFibParts_getLinePoints(box, x, y) {
		var b=box.offset();
		var yb = b.top + box.height()/2;
		var xb1 = b.left;
		var xb2 = b.left + box.width();
		if (xb2 < x) return [xb2, yb, x, y];
		return [x, y, xb1, yb];
	}

	function _BehFibParts_createToggleSectionButton(section, mode, isSimulationType) {
		var img = njs_helper.jobj(njs_helper.fmt2('<img src="{}" title="{}"/>', 
			_BehFibParts_getToggleSectionIcon(mode), 
			_BehFibParts_getToggleSectionTitle(mode, isSimulationType)));
		img.click(function(e) {
			e.preventDefault();
			e.stopImmediatePropagation();
			_BehFibParts_onImgSectionToggle(section);
		});
		var button = njs_helper.jobj('<span class="sectiontoolbarIcon visible toggleSection"></span>');
		button.append(img);
		var layout = _getLayoutOfSec(section);
		var psvTop = layout[section.secNo].t;
		var psvRight = 100 - layout[section.secNo].l - layout[section.secNo].w;
		button.css({top: psvTop + '%', right: psvRight + '%'});
        section.pgSec.find('.toggleSection').remove();
		section.pgSec.append(button);
	}
	
	function _BehFibParts_getToggleSectionIcon(mode) {
		var fmt = nittio.getStaticResFolder() + '/toolbar-edit/toggle{}.png';
		if (mode != 'edit') return njs_helper.fmt2(fmt, '2');
		return njs_helper.fmt2(fmt, '');
	}
	
	function _BehFibParts_getToggleSectionTitle(mode, isSimulationType) {
		if (mode != 'edit') return 'Edit image URL';
		if (isSimulationType) return 'Preview image and view/edit hotspot';
		return 'Preview image and update marker lines';
	}

	function _BehFibParts_onImgSectionToggle(section) {
		_BehFibParts_ClearSelection(section.pgSecView);
		section.lesson.renderCtx.editorPageToggleEditAndGraEdit(section.page);
		section.lesson.reRender();
	}

	var BehFibParts = {
		'baseClass' : function() {
			return BehFib;
		},
		'viewHelp' : function(layout, secNo) {
			if (_isAnswer(layout, secNo))
				return njs_helper.fmt2('type the answer for blank number {}', secNo);
			return '';
		},
		'reportHelp' : function(layout, secNo) {
			if (_isAnswer(layout, secNo))
				return 'If this is colored green, it means the answer was right. Red indicates the answer was wrong. Click to see the correct answer';
			return '';
		},
		'editHelp' : function(layout, secNo) {
			if (secNo == 0) {
				return 'Enter the question/title here';
			} else if (_isAnswer(layout, secNo)) {
				return _enterTheAnswer;
			}
			var ret = 	'Step 1: Enter an image (img:...). ' + 
						'Step 2: View the image by pressing the section preview button at top right of this box (not whole page preview). ' +
						'Step 3: To draw a marker line, click on one of the answer boxes first and then click on a point in the image. ';
			
			return ret;
		},
		'cssClass': function(layout, secNo) {
			return _cssClass(layout, secNo);
		},
		'onRender' : function(section) {
			_getBehaviourFnFromBaseClass(BehFibParts, 'onRender')(section);

			var layout = _getLayoutOfSec(section);
			var secNo = section.secNo;
			if (!_isInteractive(layout, secNo)) return;
            if (_isCorrect(layout, secNo))
                section.pgSecView.find('.toggleSection').remove();

			var pageMode = _getPageMode(section.page);
			if (pageMode == 'do') {
				if (_isAnswer(layout, secNo)) {
					_showPgSecTextAndLines(section);
				} else {
					_showPgSecView(section);
				}
				return;
			}
			
			if (pageMode == 'report') {
				_showPgSecView(section);
				return;
			}
			
			var pgCtx = _getPageCtx(section.page);

			if (pgCtx == 'edit_gra') {
				// pageMode == 'edit', pageCtx = 'edit_gra'
				if (_isAnswer(layout, secNo)) {
					_showPgSecTextAndLines(section);
					section.pgSecText.click(function() {_BehFibParts_onClickFrom(section);});
				} else {
					_BehFibParts_createToggleSectionButton(section, pgCtx);
					_showPgSecView(section);
					section.pgSecView.click(function(e) {_BehFibParts_onClickTo(section, e);});
				}
				return;
			} 
			// pageMode == 'edit', pageCtx = 'edit'
			_showPgSecText(section);
			if (_isCorrect(layout, secNo)) _BehFibParts_createToggleSectionButton(section, pgCtx);
		},
		'adjustHtml' : function(section) {
			_getBehaviourFnFromBaseClass(BehFibParts, 'adjustHtml')(section);
			if (!_isAnswer(_getLayoutOfSec(section), section.secNo)) return;

			if (_getPageCtx(section.page) == 'edit') return;
			_BehFibParts_drawLine(section);
		}
	};

	//----------------------------------------------------------------------------------------
	// BehQuestionnaire
	//----------------------------------------------------------------------------------------
	function _BehQuestionnaire_parseText(section) {
		var fn = _getBehaviourFn(section.page.pagetype.interaction, 'privateParseText');
		return fn(section);
	}

	function _BehQuestionnaire_privateParseText(section) {
		var str = section.pgSecText.val().toString();
		var parsed = njs_lesson_markup.breakWikiMarkup(str);
		parsed.isScorable = false;
		parsed.feedbackMaxScore = 0;
		parsed.correct = [];
		if (parsed.type == 'text') parsed.choices = [];
		if (parsed.type != 'text' && parsed.type != 'select' && parsed.type != 'multi-select') parsed.type = '';
		if (parsed.type != 'select') return parsed;

		for(var i=0; i<parsed.choices.length; i++) {
			var score = parseInt(parsed.choices[i]);
			if(!Number.isInteger(score))  return parsed;
			if (score > parsed.feedbackMaxScore) parsed.feedbackMaxScore = score;
		}
		if (parsed.feedbackMaxScore > 0) parsed.isScorable = true;
		return parsed;
	}

	function _BehQuestionnaire_getViewHelp(section) {
		var fn = _getBehaviourFn(section.page.pagetype.interaction, 'privateGetViewHelp');
		return fn(section);
	}

	var _BehQuestionnaire_help = 'Provide your input';
	function _BehQuestionnaire_privateGetViewHelp(section) {
		return _BehQuestionnaire_help;
	}

	function _BehQuestionnaire_getViewHtml(section, answerData) {
		var ans = ('answer' in section.oSection) ? section.oSection.answer : '';
		var help = _BehQuestionnaire_getViewHelp(section);
		if (answerData.type == '') return '<div/>';
		if (answerData.type == 'text') {
			return njs_lesson_helper.EditBoxHelper.createTextBox(ans, section, 
				'questionnaire', help);
		}
		var answers = njs_lesson_helper.SelectHelper.getAnswersAsList(answerData.type, ans);
		return njs_lesson_helper.SelectHelper.createSelectBox(answerData.type, 
			answerData.choices, answerData.correct, answers, section.page, 
			'questionnaire', help, section);
	}

	function _BehQuestionnaire_getReportHtml(section, answerData) {
		var ans = ('answer' in section.oSection) ? section.oSection.answer : '';
		
		if (answerData.type == '') return '<div/>';
		if (answerData.type == 'text') {
			var ret = jQuery('<div class="questionnaire report"></div>');
			var tempData = {lessPara: true};
			var ansFormatted = njs_lesson_markup.markupToHtml(ans, tempData);
			ret.append(ansFormatted);
			njs_lesson_helper.SelectHelper.setupOnReportClick(answerData.type, 
				answerData.choices, answerData.correct, [ans], section.page, ret);
			return ret;
		}
		var answers = njs_lesson_helper.SelectHelper.getAnswersAsList(answerData.type, ans);
		return njs_lesson_helper.SelectHelper.createDivBox(answerData.type, answerData.choices,
			answerData.correct, answers, section.page, 'questionnaire');
	}

	function _BehQuestionnaire_isValidAnswer(elemVal, answerData) {
		if (elemVal === undefined) return false; // Initial condition
		if (answerData.type == 'text' && elemVal === '') return false;
		if (answerData.type == 'select' && elemVal === '-1') return false; // Blank choice in select box
		if (answerData.type == 'multi-select' && elemVal === null) return false;
		return true;
	}

	function _BehQuestionnaire_updateAnswers(page) {
	    page.oPage.feedback = [];
		page.oPage.feedbackScore = [];
		page.oPage.answersArray = [];
	    var isQuestionnaire = (page.pagetype.interaction.id == 'QUESTIONNAIRE');
		for (var i = 0; i < page.sections.length; i++) {
			var section = page.sections[i];
			var layout = _getLayoutOfSec(section);
			var secNo = section.secNo;
			if (!_isAnswer(layout, secNo)) continue;

			var answerData = _BehQuestionnaire_parseText(section);
			if (answerData.type == '') {
				if ('answer' in section.oSection) delete section.oSection.answer;
				continue;
			}

			var elem = section.pgSecView.find('.questionnaire');
			// page has not be rendered yet in view mode or we are in report mode or this is text: in view mode
			if (elem.length == 0 || elem.hasClass('report')) continue;

            var elemVal = elem.val();
            if(answerData.type == 'multi-select') {
            	if(section.multiselectAnswers) {
	            	elemVal = [];
	            	for(var key in section.multiselectAnswers) {
	            		if(section.multiselectAnswers[key]) elemVal.push(key);
	            	}
            	}
            }
			var answerText = _BehQuestionnaire_getAnswerText(elemVal, answerData);
			page.oPage.answersArray.push(answerText);

            var question = secNo > 0 ? page.sections[secNo-1].oSection.text : '';
            question = njs_lesson_helper.formatTitle(question);
            if (answerData.type == 'text' || isQuestionnaire) {
                page.oPage.feedback.push({question: question, response: answerText});
            }
            if(answerData.isScorable && isQuestionnaire) {
				var score = parseInt(answerText);
				if(Number.isInteger(score)) {
					page.oPage.feedbackScore.push(score / answerData.feedbackMaxScore * 100);
				}
            }
            
			if (!_BehQuestionnaire_isValidAnswer(elemVal, answerData)) {
				if ('answer' in section.oSection) delete section.oSection.answer;
				continue;
			}

			section.oSection.answer = elemVal;
		}
	}

    function _BehQuestionnaire_getAnswerText(elemVal, answerData) {
        if (!elemVal) return '';
        if (answerData.type == 'text') return elemVal;
        if (answerData.type == 'select') return getChoiceStr(elemVal, answerData);
        var ret = '';
        var delim = '';
        for(var i=0; i<elemVal.length; i++) {
            ret += delim + getChoiceStr(elemVal[i], answerData);
            delim = ' ,';
        }
        return ret;
    }

    function getChoiceStr(data, answerData) {
        var pos = parseInt(data);
        if (pos < 0 || pos >= answerData.choices.length) return '';
        return answerData.choices[pos];
    }
    
	function _BehQuestionnaire_onScore(page) {
		var nMaxAnswers = 0;
		var nAnswers = 0;
		var nScore = 0;
		for (var i = 0; i < page.sections.length; i++) {
			var section = page.sections[i];
			var layout = _getLayoutOfSec(section);
			var secNo = section.secNo;
			if (!_isAnswer(layout, secNo)) continue;

			var answerData = _BehQuestionnaire_parseText(section);
			if (answerData.type == '') continue;

			nMaxAnswers++;
			
			if (!('answer' in section.oSection)) continue; 

			nAnswers++;
			var nSecScore = _BehManyQuestions_checkAnswer(section, answerData);
			if (nSecScore > 0) nScore += nSecScore;
		}
		if (nMaxAnswers == 0) return [ANSWERED_NA, 0];
		
		var maxScore = page.getMaxScore();
		nScore = Math.round(nScore/nMaxAnswers*maxScore*100)/100; // Roundoff to 2 decimals
		if (nScore > 0.95 && nScore < 1) nScore = 1; //Needed for Multi-select computaion else it will compute value as 0.99
		var answered = (nAnswers == 0) ? ANSWERED_NO : (nMaxAnswers == nAnswers) ? ANSWERED_YES : ANSWERED_PART;
		return [answered, nScore];
	}

	var BehQuestionnaire = {
		'viewHelp' : function(layout, secNo) {
			if (!_isAnswer(layout, secNo)) return '';
			return _BehQuestionnaire_help; 
		},
		'reportHelp' : function(layout, secNo) {
			if (!_isAnswer(layout, secNo)) return '';
			return 'User input is displayed';
		},
		'editHelp' : function(layout, secNo) {
			if (secNo == 0) {
				return 'Enter the title here';
			} else if (_isAnswer(layout, secNo)) {
				return 'For displaying a text field write "text:". If you want a users to select from a list, provide choices in format "select:choice1,choice2". If multiple choices can be chosen, please write "multi-select:choice1,choice2"';
			}
			return 'Enter the question here';
		},
		'cssClass': function(layout, secNo) {
			return _cssClass(layout, secNo, 'no_shadow');
		},
		'getRandomAttrName': function() {
			// None of the sections are randomized in this case. The default 'ans' attr should
			// not be taken as random indicator. So a non-existent attribure name is returned
			return 'randomizedSection';
		},
		'is_do_toggle_supported': function(page) {
			return true;
		},
		'onRender' : function(section) {
			var layout = _getLayoutOfSec(section);
			var secNo = section.secNo;
			var pageMode = _getPageMode(section.page);
			if (!_isAnswer(layout, secNo) || pageMode == 'edit') {
				return _getBehaviourFnFromBaseClass(BehQuestionnaire, 'onRender')(section);
			}

			var answerData = _BehQuestionnaire_parseText(section);
			if (pageMode == 'do') {
				section.setViewHtml(_BehQuestionnaire_getViewHtml(section, answerData), false);
			} else if (pageMode == 'report') {
				section.setViewHtml(_BehQuestionnaire_getReportHtml(section, answerData), false);
			}
			_showPgSecView(section);
		},
		'adjustHtml' : function(section) {
			_hideSticker(section);
		},
		'onScore' : function(page) {
			_BehQuestionnaire_updateAnswers(page);
			return _BehQuestionnaire_onScore(page);
		},
		'getSectionText' : function(section) {
			if (section.lesson.renderCtx.launchMode() == 'edit' && 'answer' in section.oSection) delete section.oSection.answer;
			return section.pgSecText.val();
		},
		
		'privateParseText': _BehQuestionnaire_privateParseText,
		'privateGetViewHelp': _BehQuestionnaire_privateGetViewHelp 
	};
	
	//----------------------------------------------------------------------------------------
	// BehManyQuestions
	//----------------------------------------------------------------------------------------
	var BehManyQuestions = {
		'baseClass' : function() {
			return BehQuestionnaire;
		},
		'viewHelp' : function(layout, secNo) {
			if (!_isAnswer(layout, secNo)) return '';
			return _enterTheAnswer;
		},
		'reportHelp' : function(layout, secNo) {
			if (!_isAnswer(layout, secNo)) return '';
			return 'If this is colored green, it means the answer was right.\r\nRed indicates the answer was wrong.\r\nClick to see the correct answer.';
		},
		'editHelp' : function(layout, secNo) {
			if (secNo == 0) {
				return 'Enter the title here';
			} else if (_isAnswer(layout, secNo)) {
				return 'text:correct1,correct2,...\r\nselect:correct,wrong1,wrong2....\r\nmulti-select1:correct,w1,w2,..\r\nmulti-select2:correct1,correct2,w1,w2,...\r\nupto multi-select6\r\nOptions will be automatically jumbled for the learner';
			}
			return 'Enter the question here';
		},
		'is_do_toggle_supported': function(page) {
			return false;
		},
		'adjustHtml' : function(section) {
			_hideSticker(section);
			if (!_isAnswer(_getLayoutOfSec(section), section.secNo)) return;
			if (_getPageMode(section.page) != 'report') return;
			
			var answerData = _BehManyQuestions_privateParseText(section);
			var score = _BehManyQuestions_checkAnswer(section, answerData);
			if (score == 1) {
				section.pgSecView.addClass('answer_right');
				_showStickerCorrect(section);
			} else if (score > 0) {
				section.pgSecView.addClass('answer_part');
				_showStickerPart(section);
			} else if (score == 0){
				section.pgSecView.addClass('answer_wrong');
				_showStickerWrong(section);
			}
		},
		'maxScore' : function(page) {
			return 	_BehManyQuestions_getMaxScore(page);
		},
		'privateParseText': _BehManyQuestions_privateParseText,
		'privateGetViewHelp': _BehManyQuestions_privateGetViewHelp 
	};

	function _BehManyQuestions_privateGetViewHelp(section) {
		return _enterTheAnswer;
	}

	function _BehManyQuestions_privateParseText(section) {
		var str = section.pgSecText.val().toString();
		var parsed = njs_lesson_markup.breakWikiMarkup(str);

		if (parsed.type == 'text') {
			parsed.correct = parsed.choices;
			parsed.choices = [];
		} else if (parsed.type == 'select') {
			parsed.correct = parsed.choices.slice(0, 1);
		} else if (parsed.type == 'multi-select1') {
			parsed.correct = parsed.choices.slice(0, 1);
			parsed.type = 'multi-select';
		} else if (parsed.type == 'multi-select2') {
			parsed.correct = parsed.choices.slice(0, 2);
			parsed.type = 'multi-select';
		} else if (parsed.type == 'multi-select3') {
			parsed.correct = parsed.choices.slice(0, 3);
			parsed.type = 'multi-select';
		} else if (parsed.type == 'multi-select4') {
			parsed.correct = parsed.choices.slice(0, 4);
			parsed.type = 'multi-select';
		} else if (parsed.type == 'multi-select5') {
			parsed.correct = parsed.choices.slice(0, 5);
			parsed.type = 'multi-select';
		} else if (parsed.type == 'multi-select6') {
			parsed.correct = parsed.choices.slice(0, 6);
			parsed.type = 'multi-select';
		} else {
			parsed.type = '';
		}
		return parsed;
	}

	function _BehManyQuestions_getMaxScore(page) {
		var maxScore = 0;
		for(var i=0; i<page.sections.length; i++) {
			var section = page.sections[i];
			if (!_isAnswer(_getLayoutOfSec(section), section.secNo)) continue;
			var answerData = _BehManyQuestions_privateParseText(section);
			if (answerData.type == '') continue;
			maxScore += 1;
		}
		return maxScore;
	}
	
	// Returns -2 if section not scorable
	// Returns -1 if answer is empty
	// Returns 0 if answer is wrong
	// Returns 1 if answer is correct
	function _BehManyQuestions_checkAnswer(section, answerData) {
		if (answerData.type == '') return -2;
		if (answerData.correct.length == 0) return -2;
		if (!('answer' in section.oSection)) return -1;
		
		
		var answer = section.oSection.answer;
		if (answerData.type == 'text') {
			return _BehManyQuestions_checkTextAnswer(answerData, answer);
		}

		if (answerData.type == 'select' && answerData.correct.length == 1) {
			return _BehManyQuestions_checkSelectAnswer(answerData, answer);
		}
		
		if (answerData.type == 'multi-select') {
			return _BehManyQuestions_checkMultiSelectAnswer(answerData, answer);
		}
		
		return -2;
	}

	function _BehManyQuestions_checkTextAnswer(answerData, answer) {
		var ans = answer.toLowerCase().trim();
		for (var i=0; i<answerData.correct.length; i++) {
			var ca = answerData.correct[i].toLowerCase().trim();
			if (ans == ca) return 1;
		}
		return 0;
	}
	
	function _BehManyQuestions_checkSelectAnswer(answerData, answer) {
		var ans = njs_lesson_helper.SelectHelper.getAnswersAsList(answerData.type, answer);
		if (ans[0] == 0) return 1;
		return 0;
	}
	
	function _BehManyQuestions_checkMultiSelectAnswer(answerData, answer) {
		var ans = njs_lesson_helper.SelectHelper.getAnswersAsList(answerData.type, answer);
		var maxRight = answerData.correct.length;
		//if (ans.length != answerData.correct.length) return 0;
		var selectedCorrectAns = 0;
		var selectedWrongAns = 0;
		for (var i=0; i<ans.length; i++) {
			if (ans[i] < maxRight) {
				selectedCorrectAns++;
			} else {
				selectedWrongAns++;
			}
		}
		if (selectedCorrectAns == 0 || ans.length == answerData.choices.length) return 0;
		if (selectedWrongAns == 0 && (selectedCorrectAns == maxRight)) return 1;
		var correctAnswerRatio = selectedCorrectAns*1/maxRight;
		var wrongAnswerRatio = selectedWrongAns*1/maxRight;
		var score = correctAnswerRatio - wrongAnswerRatio;
		score = parseFloat(score.toFixed(2));
		if (score < 0) return 0;
		return score;
	}
	
	//#############################################################################################
	// Dictionaries for quick access - filled during init
	//#############################################################################################
	var PageTypeMap = {};
    var PageInteractionTypes = [];
	var PageInteractionTypeMap = {};
	var InteractionToLayouts = {};
	
    function getInteractionsAndLayouts() {
        var interactions = [];
        var bleedingEdgeUser = nittio.isBleedingEdge();
        for (var i = 0; i < PageInteractionTypes.length; i++) {
            var intr = PageInteractionTypes[i];
            var bleedingEdgePage = _getInteractionAttribute(intr, 'bleedingEdge', false);
            if (bleedingEdgeUser || !bleedingEdgePage) {
                interactions.push(intr);
            }
        }
        
        return {interactions: interactions, interactionToLayouts: InteractionToLayouts,
            ptMap: PageTypeMap};
    }
    
	//#############################################################################################
	// PageInteractionType: Defines the type of interaction a page offers/exhibits. This is a
	// combination of the behaviour of the page and static data which defines the interaction.
	//#############################################################################################
	var defaultPageInteractionTypes = [
		{'id' : 'TITLE', 'desc' : 'Title', 'default_aligntype' : 'title'},
        {'id' : 'INFOS', 'desc' : 'Information - Compact *', 'default_aligntype' : 'title'},
		{'id' : 'INFO', 'desc' : 'Information - Detailed', 'default_aligntype' : 'content'},
		{'id' : 'INFO2', 'desc' : 'Information - Detailed segmented', 'default_aligntype' : 'content'},
		{'id' : 'MCQ', 'desc' : 'Question - Multiple Choice, True False', 'default_aligntype' : 'option', 'beh' : BehMcq},
		{'id' : 'MATCH', 'desc' : 'Question - Matching', 'default_aligntype' : 'option', 'beh' : BehMatch},
		{'id' : 'ORDER', 'desc' : 'Question - Ordering', 'default_aligntype' : 'option', 'beh' : BehOrder},
		{'id' : 'FILL', 'desc' : 'Question - Fill in the blanks', 'default_aligntype' : 'option', 'beh' : BehFib},
		{'id' : 'DESC', 'desc' : 'Question - Descriptive', 'default_aligntype' : 'option', 'beh' : BehDesc},
		{'id' : 'PARTFILL', 'desc' : 'Question - Mark the parts of image', 'default_aligntype' : 'option', 'beh' : BehFibParts},
		{'id' : 'SIMULATE', 'desc' : 'Simulations', 'default_aligntype' : 'option', 'beh' : BehSimulation},
        {'id' : 'MANYQUESTIONS', 'bleedingEdge' : false, 'desc' : 'Question - Many questions', 'default_aligntype' : 'content', 'beh' : BehManyQuestions},
		{'id' : 'QUESTIONNAIRE', 'desc' : 'Feedback', 'default_aligntype' : 'content', 'beh' : BehQuestionnaire}
	];

	//#############################################################################################
	// class PageTypes: defines the page layout for a given interaction
	// Note: if max score of any page type is changed, please review the __pageTypeToMaxScores dict
	// in mlesson.py
	//#############################################################################################
	var defaultPageTypes = [
		{'id': 'H', 'interaction': 'TITLE', 'layoutName': 'Title', 
		 'layout': [{'t':   0, 'l':   0, 'h': 100, 'w': 100, 'aligntype' : 'title'}]},

		{'id': 'H2', 'interaction': 'TITLE', 'layoutName': 'Title and sub-titles', 
		 'layout': [{'t':   0, 'l':   0, 'h':  48, 'w': 100, 'aligntype' : 'title'},
					{'t':  52, 'l':   0, 'h':  48, 'w': 100, 'fmtgroup' : 1}]},

		{'id': 'S', 'interaction': 'INFO', 'layoutName': 'Title and content', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  78, 'w': 100, 'fmtgroup' : 1}]},

		{'id': 'S2', 'interaction': 'INFO', 'layoutName': 'Title, content and bottom bar', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
		 			{'t':  22, 'l':   0, 'h':  56, 'w': 100, 'fmtgroup' : 1},
					{'t':  82, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'}]},

		{'id': 'S3', 'interaction': 'INFO', 'layoutName': 'Content and bottom bar', 
		 'layout': [{'t':   0, 'l':   0, 'h':  78, 'w': 100, 'fmtgroup' : 1},
					{'t':  82, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'}]},

		{'id': 'S4', 'interaction': 'INFO', 'layoutName': 'Full content', 
		 'layout': [{'t':   0, 'l':   0, 'h':  100, 'w': 100, 'fmtgroup' : 1}]},

		{'id': '2C30', 'interaction': 'INFO', 'layoutName': 'Two columns (30:70) - no title', 
		 'layout': [{'t':   0, 'l':   0, 'h': 100, 'w':  29, 'fmtgroup' : 1},
					{'t':   0, 'l':  31, 'h': 100, 'w':  69, 'fmtgroup' : 1}]},

		{'id': '2C70', 'interaction': 'INFO', 'layoutName': 'Two columns (70:30) - no title', 
		 'layout': [{'t':   0, 'l':   0, 'h': 100, 'w':  69, 'fmtgroup' : 1},
					{'t':   0, 'l':  71, 'h': 100, 'w':  29, 'fmtgroup' : 1}]},

		{'id': '2C50', 'interaction': 'INFO', 'layoutName': 'Two columns (50:50) - no title', 
		 'layout': [{'t':   0, 'l':   0, 'h': 100, 'w':  49, 'fmtgroup' : 1},
					{'t':   0, 'l':  51, 'h': 100, 'w':  49, 'fmtgroup' : 1}]},

		{'id': '2C503', 'interaction': 'INFO', 'layoutName': 'Two columns with 3 rows - no title', 
		 'layout': [{'t':   0, 'l':   0, 'h': 31, 'w':  49, 'fmtgroup' : 1},
					{'t':   0, 'l':  51, 'h': 31, 'w':  49, 'fmtgroup' : 1},
					{'t':34.5, 'l':   0, 'h': 31, 'w':  49, 'fmtgroup' : 1},
					{'t':34.5, 'l':  51, 'h': 31, 'w':  49, 'fmtgroup' : 1},
					{'t':  69, 'l':   0, 'h': 31, 'w':  49, 'fmtgroup' : 1},
					{'t':  69, 'l':  51, 'h': 31, 'w':  49, 'fmtgroup' : 1}]},

		{'id': '2S30', 'interaction': 'INFO', 'layoutName': 'Title and two columns (30:70)', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  78, 'w':  29, 'fmtgroup' : 1},
					{'t':  22, 'l':  31, 'h':  78, 'w':  69, 'fmtgroup' : 1}]},
		 
		{'id': '2S70', 'interaction': 'INFO', 'layoutName': 'Title and two columns (70:30)', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  78, 'w':  69, 'fmtgroup' : 1},
					{'t':  22, 'l':  71, 'h':  78, 'w':  29, 'fmtgroup' : 1}]},

		{'id': '2S50', 'interaction': 'INFO', 'layoutName': 'Title and two columns (50:50)', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  78, 'w':  49, 'fmtgroup' : 1},
					{'t':  22, 'l':  51, 'h':  78, 'w':  49, 'fmtgroup' : 1}]},

		{'id': '2S503', 'interaction': 'INFO', 'layoutName': 'Title and two columns with 3 rows', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  24, 'w':  49, 'fmtgroup' : 1},
					{'t':  22, 'l':  51, 'h':  24, 'w':  49, 'fmtgroup' : 1},
					{'t':  49, 'l':   0, 'h':  24, 'w':  49, 'fmtgroup' : 1},
					{'t':  49, 'l':  51, 'h':  24, 'w':  49, 'fmtgroup' : 1},
					{'t':  76, 'l':   0, 'h':  24, 'w':  49, 'fmtgroup' : 1},
					{'t':  76, 'l':  51, 'h':  24, 'w':  49, 'fmtgroup' : 1}]},

		{'id': '2T2C', 'interaction': 'INFO', 'layoutName': 'Two columns with bottom bar', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
				    {'t':  22, 'l':   0, 'h':  56, 'w':  49, 'fmtgroup' : 1},
				    {'t':  22, 'l':  51, 'h':  56, 'w':  49, 'fmtgroup' : 1},
				    {'t':  82, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'}]},

		{'id': 'FP', 'interaction': 'INFO', 'layoutName': 'Full Page', 
		 'layout': [{'t':   -7.0, 'l':   -4.3, 'h': 116.3, 'w': 108.7}]},


		{'id': '3C', 'interaction': 'INFO2', 'layoutName': 'Three columns - no title', 
		 'layout': [{'t':   0, 'l':   0, 'h': 100, 'w':  32, 'fmtgroup' : 1},
				    {'t':   0, 'l':  34, 'h': 100, 'w':  32, 'fmtgroup' : 1},
				    {'t':   0, 'l':  68, 'h': 100, 'w':  32, 'fmtgroup' : 1}]},

		{'id': 'T3C', 'interaction': 'INFO2', 'layoutName': 'Three columns with title', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
				    {'t':  22, 'l':   0, 'h':  78, 'w':  32, 'fmtgroup' : 1},
				    {'t':  22, 'l':  34, 'h':  78, 'w':  32, 'fmtgroup' : 1},
				    {'t':  22, 'l':  68, 'h':  78, 'w':  32, 'fmtgroup' : 1}]},

		{'id': '2T3C', 'interaction': 'INFO2', 'layoutName': 'Three columns with title and bottom bar', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
				    {'t':  22, 'l':   0, 'h':  56, 'w':  32, 'fmtgroup' : 1},
				    {'t':  22, 'l':  34, 'h':  56, 'w':  32, 'fmtgroup' : 1},
				    {'t':  22, 'l':  68, 'h':  56, 'w':  32, 'fmtgroup' : 1},
				    {'t':  82, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'}]},
		{'id': '4C', 'interaction': 'INFO2', 'layoutName': 'Four columns - no title', 
		 'layout': [{'t':   0, 'l':   0, 'h': 100, 'w':23.5, 'fmtgroup' : 1},
				    {'t':   0, 'l':25.5, 'h': 100, 'w':23.5, 'fmtgroup' : 1},
				    {'t':   0, 'l':  51, 'h': 100, 'w':23.5, 'fmtgroup' : 1},
				    {'t':   0, 'l':76.5, 'h': 100, 'w':23.5, 'fmtgroup' : 1}]},

		{'id': 'T4C', 'interaction': 'INFO2', 'layoutName': 'Four columns with title', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
				    {'t':  22, 'l':   0, 'h':  78, 'w':23.5, 'fmtgroup' : 1},
				    {'t':  22, 'l':25.5, 'h':  78, 'w':23.5, 'fmtgroup' : 1},
				    {'t':  22, 'l':  51, 'h':  78, 'w':23.5, 'fmtgroup' : 1},
				    {'t':  22, 'l':76.5, 'h':  78, 'w':23.5, 'fmtgroup' : 1}]},

		{'id': '2T4C', 'interaction': 'INFO2', 'layoutName': 'Four columns with title and bottom bar', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
				    {'t':  22, 'l':   0, 'h':  56, 'w':23.5, 'fmtgroup' : 1},
				    {'t':  22, 'l':25.5, 'h':  56, 'w':23.5, 'fmtgroup' : 1},
				    {'t':  22, 'l':  51, 'h':  56, 'w':23.5, 'fmtgroup' : 1},
				    {'t':  22, 'l':76.5, 'h':  56, 'w':23.5, 'fmtgroup' : 1},
				    {'t':  82, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'}]},

		{'id': '4B', 'interaction': 'INFO2', 'layoutName': 'Four boxes', 
		 'layout': [{'t':   0, 'l':   0, 'h':  48, 'w':  49, 'fmtgroup' : 1},
					{'t':   0, 'l':  51, 'h':  48, 'w':  49, 'fmtgroup' : 1},
					{'t':  52, 'l':   0, 'h':  48, 'w':  49, 'fmtgroup' : 1},
					{'t':  52, 'l':  51, 'h':  48, 'w':  49, 'fmtgroup' : 1}]},

		{'id': '4BT', 'interaction': 'INFO2', 'layoutName': 'Four boxes with title', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  37, 'w':  49, 'fmtgroup' : 1},
					{'t':  22, 'l':  51, 'h':  37, 'w':  49, 'fmtgroup' : 1},
					{'t':  63, 'l':   0, 'h':  37, 'w':  49, 'fmtgroup' : 1},
					{'t':  63, 'l':  51, 'h':  37, 'w':  49, 'fmtgroup' : 1}]},

		{'id': '6B', 'interaction': 'INFO2', 'layoutName': 'Six boxes', 
		 'layout': [{'t':   0, 'l':   0, 'h':  48, 'w':  32, 'fmtgroup' : 1},
					{'t':   0, 'l':  34, 'h':  48, 'w':  32, 'fmtgroup' : 1},
					{'t':   0, 'l':  68, 'h':  48, 'w':  32, 'fmtgroup' : 1},
					{'t':  52, 'l':   0, 'h':  48, 'w':  32, 'fmtgroup' : 1},
					{'t':  52, 'l':  34, 'h':  48, 'w':  32, 'fmtgroup' : 1},
					{'t':  52, 'l':  68, 'h':  48, 'w':  32, 'fmtgroup' : 1}]},

		{'id': '6BT', 'interaction': 'INFO2', 'layoutName': 'Six boxes with title', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  37, 'w':  32, 'fmtgroup' : 1},
					{'t':  22, 'l':  34, 'h':  37, 'w':  32, 'fmtgroup' : 1},
					{'t':  22, 'l':  68, 'h':  37, 'w':  32, 'fmtgroup' : 1},
					{'t':  63, 'l':   0, 'h':  37, 'w':  32, 'fmtgroup' : 1},
					{'t':  63, 'l':  34, 'h':  37, 'w':  32, 'fmtgroup' : 1},
					{'t':  63, 'l':  68, 'h':  37, 'w':  32, 'fmtgroup' : 1}]},

		{'id': 'H4C', 'interaction': 'INFO2', 'layoutName': 'Highlight and four captions', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
				    {'t':  22, 'l':  34, 'h':  78, 'w':  32, 'fmtgroup' : 2},
				    {'t':  22, 'l':   0, 'h':  37, 'w':  32, 'fmtgroup' : 1},
				    {'t':  22, 'l':  68, 'h':  37, 'w':  32, 'fmtgroup' : 1},
				    {'t':  63, 'l':   0, 'h':  37, 'w':  32, 'fmtgroup' : 1},
				    {'t':  63, 'l':  68, 'h':  37, 'w':  32, 'fmtgroup' : 1}]},

		{'id': 'H6C', 'interaction': 'INFO2', 'layoutName': 'Highlight and six captions', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
				    {'t':  22, 'l':  34, 'h':  78, 'w':  32, 'fmtgroup' : 2},
				    {'t':  22, 'l':   0, 'h':  23, 'w':  32, 'fmtgroup' : 1},
				    {'t':  22, 'l':  68, 'h':  23, 'w':  32, 'fmtgroup' : 1},
				    {'t':  49, 'l':   0, 'h':  24, 'w':  32, 'fmtgroup' : 1},
				    {'t':  49, 'l':  68, 'h':  24, 'w':  32, 'fmtgroup' : 1},
				    {'t':  77, 'l':   0, 'h':  23, 'w':  32, 'fmtgroup' : 1},
				    {'t':  77, 'l':  68, 'h':  23, 'w':  32, 'fmtgroup' : 1}]},

		{'id': 'MCQ_2_1', 'interaction': 'MCQ', 'layoutName': '2 choices', 'score' : 1,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
				    {'t':  22, 'l':   0, 'h':  78, 'w':  32, 'ans': true, 'correct': true, 'fmtgroup' : 1},
				    {'t':  22, 'l':  68, 'h':  78, 'w':  32, 'ans': true, 'fmtgroup' : 1},
				    {'t':  22, 'l':  34, 'h':  78, 'w':  32, 'fmtgroup' : 2}]},

		{'id': 'MCQ_2_1B', 'interaction': 'MCQ', 'layoutName': '2 choices with broad header', 'score' : 1,
		 'layout': [{'t':   0, 'l':   0, 'h':  48, 'w': 100, 'aligntype' : 'title'},
				    {'t':  52, 'l':   0, 'h':  48, 'w':  32, 'ans': true, 'correct': true, 'fmtgroup' : 1},
				    {'t':  52, 'l':  68, 'h':  48, 'w':  32, 'ans': true, 'fmtgroup' : 1},
				    {'t':  52, 'l':  34, 'h':  48, 'w':  32, 'fmtgroup' : 2}]},

		{'id': 'MCQ_4_1', 'interaction': 'MCQ', 'layoutName': '4 choices', 'score' : 2,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
				    {'t':  22, 'l':   0, 'h':  37, 'w':  32, 'ans': true, 'correct': true, 'fmtgroup' : 1},
				    {'t':  22, 'l':  68, 'h':  37, 'w':  32, 'ans': true, 'fmtgroup' : 1},
				    {'t':  63, 'l':   0, 'h':  37, 'w':  32, 'ans': true, 'fmtgroup' : 1},
				    {'t':  63, 'l':  68, 'h':  37, 'w':  32, 'ans': true, 'fmtgroup' : 1},
				    {'t':  22, 'l':  34, 'h':  78, 'w':  32, 'fmtgroup' : 2}]},

		{'id': 'MCQ_4_1B', 'interaction': 'MCQ', 'layoutName': '4 choices with broad header', 'score' : 2,
		 'layout': [{'t':   0, 'l':   0, 'h':  38, 'w': 100, 'aligntype' : 'title'},
				    {'t':  42, 'l':   0, 'h':  27, 'w':  32, 'ans': true, 'correct': true, 'fmtgroup' : 1},
				    {'t':  42, 'l':  68, 'h':  27, 'w':  32, 'ans': true, 'fmtgroup' : 1},
				    {'t':  73, 'l':   0, 'h':  27, 'w':  32, 'ans': true, 'fmtgroup' : 1},
				    {'t':  73, 'l':  68, 'h':  27, 'w':  32, 'ans': true, 'fmtgroup' : 1},
				    {'t':  42, 'l':  34, 'h':  58, 'w':  32, 'fmtgroup' : 2}]},


		{'id': 'MATCH3', 'interaction': 'MATCH', 'layoutName': '3 pairs, Horizontal', 'score' : 2,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  32, 'w':  32, 'correct': true, 'fmtgroup' : 1},
					{'t':  22, 'l':  34, 'h':  32, 'w':  32, 'correct': true, 'fmtgroup' : 1},
					{'t':  22, 'l':  68, 'h':  32, 'w':  32, 'correct': true, 'fmtgroup' : 1},
					{'t':  68, 'l':   0, 'h':  32, 'w':  32, 'ans': true, 'fmtgroup' : 1},
					{'t':  68, 'l':  34, 'h':  32, 'w':  32, 'ans': true, 'fmtgroup' : 1},
					{'t':  68, 'l':  68, 'h':  32, 'w':  32, 'ans': true, 'fmtgroup' : 1}]},

		{'id': 'MATCH', 'interaction': 'MATCH', 'layoutName': '3 pairs, Vertical', 'score' : 2, 'orientation': 'vertical', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  24, 'w':  40, 'correct': true, 'fmtgroup' : 1},
					{'t':  49, 'l':   0, 'h':  24, 'w':  40, 'correct': true, 'fmtgroup' : 1},
					{'t':  76, 'l':   0, 'h':  24, 'w':  40, 'correct': true, 'fmtgroup' : 1},
					{'t':  22, 'l':  60, 'h':  24, 'w':  40, 'ans': true, 'fmtgroup' : 1},
					{'t':  49, 'l':  60, 'h':  24, 'w':  40, 'ans': true, 'fmtgroup' : 1},
					{'t':  76, 'l':  60, 'h':  24, 'w':  40, 'ans': true, 'fmtgroup' : 1}]},

		{'id': 'MATCH4', 'interaction': 'MATCH', 'layoutName': '4 pairs, Horizontal', 'score' : 2,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  32, 'w':23.5, 'correct': true, 'fmtgroup' : 1},
					{'t':  22, 'l':25.5, 'h':  32, 'w':23.5, 'correct': true, 'fmtgroup' : 1},
					{'t':  22, 'l':  51, 'h':  32, 'w':23.5, 'correct': true, 'fmtgroup' : 1},
					{'t':  22, 'l':76.5, 'h':  32, 'w':23.5, 'correct': true, 'fmtgroup' : 1},
					{'t':  68, 'l':   0, 'h':  32, 'w':23.5, 'ans': true, 'fmtgroup' : 1},
					{'t':  68, 'l':25.5, 'h':  32, 'w':23.5, 'ans': true, 'fmtgroup' : 1},
					{'t':  68, 'l':  51, 'h':  32, 'w':23.5, 'ans': true, 'fmtgroup' : 1},
					{'t':  68, 'l':76.5, 'h':  32, 'w':23.5, 'ans': true, 'fmtgroup' : 1}]},

		{'id': 'MATCH5', 'interaction': 'MATCH', 'layoutName': '5 pairs, Vertical', 'score' : 3, 'orientation': 'vertical', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  23, 'l':   0, 'h':  12, 'w':  40, 'correct': true, 'fmtgroup' : 1},
					{'t':  39, 'l':   0, 'h':  12, 'w':  40, 'correct': true, 'fmtgroup' : 1},
					{'t':  55, 'l':   0, 'h':  12, 'w':  40, 'correct': true, 'fmtgroup' : 1},
					{'t':  71, 'l':   0, 'h':  12, 'w':  40, 'correct': true, 'fmtgroup' : 1},
					{'t':  87, 'l':   0, 'h':  12, 'w':  40, 'correct': true, 'fmtgroup' : 1},
					{'t':  23, 'l':  60, 'h':  12, 'w':  40, 'ans': true, 'fmtgroup' : 1},
					{'t':  39, 'l':  60, 'h':  12, 'w':  40, 'ans': true, 'fmtgroup' : 1},
					{'t':  55, 'l':  60, 'h':  12, 'w':  40, 'ans': true, 'fmtgroup' : 1},
					{'t':  71, 'l':  60, 'h':  12, 'w':  40, 'ans': true, 'fmtgroup' : 1},
					{'t':  87, 'l':  60, 'h':  12, 'w':  40, 'ans': true, 'fmtgroup' : 1}]},

		{'id': 'MATCH6', 'interaction': 'MATCH', 'layoutName': '6 pairs, Horizontal', 'score' : 3,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  32, 'w':  15, 'correct': true, 'fmtgroup' : 1},
					{'t':  22, 'l':  17, 'h':  32, 'w':  15, 'correct': true, 'fmtgroup' : 1},
					{'t':  22, 'l':  34, 'h':  32, 'w':  15, 'correct': true, 'fmtgroup' : 1},
					{'t':  22, 'l':  51, 'h':  32, 'w':  15, 'correct': true, 'fmtgroup' : 1},
					{'t':  22, 'l':  68, 'h':  32, 'w':  15, 'correct': true, 'fmtgroup' : 1},
					{'t':  22, 'l':  85, 'h':  32, 'w':  15, 'correct': true, 'fmtgroup' : 1},
					{'t':  68, 'l':   0, 'h':  32, 'w':  15, 'ans': true, 'fmtgroup' : 1},
					{'t':  68, 'l':  17, 'h':  32, 'w':  15, 'ans': true, 'fmtgroup' : 1},
					{'t':  68, 'l':  34, 'h':  32, 'w':  15, 'ans': true, 'fmtgroup' : 1},
					{'t':  68, 'l':  51, 'h':  32, 'w':  15, 'ans': true, 'fmtgroup' : 1},
					{'t':  68, 'l':  68, 'h':  32, 'w':  15, 'ans': true, 'fmtgroup' : 1},
					{'t':  68, 'l':  85, 'h':  32, 'w':  15, 'ans': true, 'fmtgroup' : 1}]},


		{'id': 'ORDER_4', 'interaction': 'ORDER', 'layoutName': '4 items', 'score' : 2,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  37, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  22, 'l':  51, 'h':  37, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  63, 'l':   0, 'h':  37, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  63, 'l':  51, 'h':  37, 'w':  49, 'ans': true, 'fmtgroup' : 1}]},

		{'id': 'ORDER_4B', 'interaction': 'ORDER', 'layoutName': '4 items with broad header', 'score' : 2,
		 'layout': [{'t':   0, 'l':   0, 'h':  38, 'w': 100, 'aligntype' : 'title'},
					{'t':  42, 'l':   0, 'h':  27, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  42, 'l':  51, 'h':  27, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  73, 'l':   0, 'h':  27, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  73, 'l':  51, 'h':  27, 'w':  49, 'ans': true, 'fmtgroup' : 1}]},

		{'id': 'ORDER_6', 'interaction': 'ORDER', 'layoutName': '6 items', 'score' : 3,
		 'layout': [{'t':  0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t': 22, 'l':   0, 'h':  37, 'w':  32, 'ans': true, 'fmtgroup' : 1},
					{'t': 22, 'l':  34, 'h':  37, 'w':  32, 'ans': true, 'fmtgroup' : 1},
					{'t': 22, 'l':  68, 'h':  37, 'w':  32, 'ans': true, 'fmtgroup' : 1},
					{'t': 63, 'l':   0, 'h':  37, 'w':  32, 'ans': true, 'fmtgroup' : 1},
					{'t': 63, 'l':  34, 'h':  37, 'w':  32, 'ans': true, 'fmtgroup' : 1},
					{'t': 63, 'l':  68, 'h':  37, 'w':  32, 'ans': true, 'fmtgroup' : 1}]},

		{'id': 'ORDER_6B', 'interaction': 'ORDER', 'layoutName': '6 items with broad header', 'score' : 3,
		 'layout': [{'t':  0, 'l':   0, 'h':  38, 'w': 100, 'aligntype' : 'title'},
					{'t': 42, 'l':   0, 'h':  27, 'w':  32, 'ans': true, 'fmtgroup' : 1},
					{'t': 42, 'l':  34, 'h':  27, 'w':  32, 'ans': true, 'fmtgroup' : 1},
					{'t': 42, 'l':  68, 'h':  27, 'w':  32, 'ans': true, 'fmtgroup' : 1},
					{'t': 73, 'l':   0, 'h':  27, 'w':  32, 'ans': true, 'fmtgroup' : 1},
					{'t': 73, 'l':  34, 'h':  27, 'w':  32, 'ans': true, 'fmtgroup' : 1},
					{'t': 73, 'l':  68, 'h':  27, 'w':  32, 'ans': true, 'fmtgroup' : 1}]},

		{'id': 'ORDER_8', 'interaction': 'ORDER', 'layoutName': '8 items', 'score' : 4,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  37, 'w':23.5, 'ans': true, 'fmtgroup' : 1},
					{'t':  22, 'l':25.5, 'h':  37, 'w':23.5, 'ans': true, 'fmtgroup' : 1},
					{'t':  22, 'l':  51, 'h':  37, 'w':23.5, 'ans': true, 'fmtgroup' : 1},
					{'t':  22, 'l':76.5, 'h':  37, 'w':23.5, 'ans': true, 'fmtgroup' : 1},
					{'t':  63, 'l':   0, 'h':  37, 'w':23.5, 'ans': true, 'fmtgroup' : 1},
					{'t':  63, 'l':25.5, 'h':  37, 'w':23.5, 'ans': true, 'fmtgroup' : 1},
					{'t':  63, 'l':  51, 'h':  37, 'w':23.5, 'ans': true, 'fmtgroup' : 1},
					{'t':  63, 'l':76.5, 'h':  37, 'w':23.5, 'ans': true, 'fmtgroup' : 1}]},

		{'id': 'ORDER_8B', 'interaction': 'ORDER', 'layoutName': '8 items with broad header', 'score' : 4,
		 'layout': [{'t':   0, 'l':   0, 'h':  38, 'w': 100, 'aligntype' : 'title'},
					{'t':  42, 'l':   0, 'h':  27, 'w':23.5, 'ans': true, 'fmtgroup' : 1},
					{'t':  42, 'l':25.5, 'h':  27, 'w':23.5, 'ans': true, 'fmtgroup' : 1},
					{'t':  42, 'l':  51, 'h':  27, 'w':23.5, 'ans': true, 'fmtgroup' : 1},
					{'t':  42, 'l':76.5, 'h':  27, 'w':23.5, 'ans': true, 'fmtgroup' : 1},
					{'t':  73, 'l':   0, 'h':  27, 'w':23.5, 'ans': true, 'fmtgroup' : 1},
					{'t':  73, 'l':25.5, 'h':  27, 'w':23.5, 'ans': true, 'fmtgroup' : 1},
					{'t':  73, 'l':  51, 'h':  27, 'w':23.5, 'ans': true, 'fmtgroup' : 1},
					{'t':  73, 'l':76.5, 'h':  27, 'w':23.5, 'ans': true, 'fmtgroup' : 1}]},

		{'id': 'FILL_1', 'interaction': 'FILL', 'layoutName': 'One blank', 'score' : 2,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  78, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  22, 'l':  51, 'h':  78, 'w':  49, 'aligntype' : 'content', 'fmtgroup' : 2}]},

		{'id': 'FILL_1L', 'interaction': 'FILL', 'layoutName': 'One blank with broad header', 'score' : 2,
		 'layout': [{'t':   0, 'l':   0, 'h':  38, 'w': 100, 'aligntype' : 'title'},
					{'t':  42, 'l':   0, 'h':  58, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  42, 'l':  51, 'h':  58, 'w':  49, 'aligntype' : 'content', 'fmtgroup' : 2}]},

		{'id': 'FILL_2', 'interaction': 'FILL', 'layoutName': 'Two blanks', 'score' : 4,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  37, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  63, 'l':   0, 'h':  37, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  22, 'l':  51, 'h':  78, 'w':  49, 'aligntype' : 'content', 'fmtgroup' : 2}]},

		{'id': 'FILL_2I', 'interaction': 'FILL', 'layoutName': 'Two blanks with individual hints', 'score' : 4,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  37, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  63, 'l':   0, 'h':  37, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  22, 'l':  51, 'h':  37, 'w':  49, 'aligntype' : 'content', 'fmtgroup' : 2},
					{'t':  63, 'l':  51, 'h':  37, 'w':  49, 'aligntype' : 'content', 'fmtgroup' : 2}]},

		{'id': 'FILL_2L', 'interaction': 'FILL', 'layoutName': 'Two blanks with broad header', 'score' : 4,
		 'layout': [{'t':   0, 'l':   0, 'h':  38, 'w': 100, 'aligntype' : 'title'},
					{'t':  42, 'l':   0, 'h':  27, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  73, 'l':   0, 'h':  27, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  42, 'l':  51, 'h':  58, 'w':  49, 'aligntype' : 'content', 'fmtgroup' : 2}]},

		{'id': 'FILL_3', 'interaction': 'FILL', 'layoutName': 'Three blanks', 'score' : 6,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  24, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  49, 'l':   0, 'h':  24, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  76, 'l':   0, 'h':  24, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  22, 'l':  51, 'h':  78, 'w':  49, 'aligntype' : 'content', 'fmtgroup' : 2}]},

		{'id': 'FILL_3I', 'interaction': 'FILL', 'layoutName': 'Three blanks with individual hints', 'score' : 6,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  24, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  49, 'l':   0, 'h':  24, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  76, 'l':   0, 'h':  24, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  22, 'l':  51, 'h':  24, 'w':  49, 'aligntype' : 'content', 'fmtgroup' : 2},
					{'t':  49, 'l':  51, 'h':  24, 'w':  49, 'aligntype' : 'content', 'fmtgroup' : 2},
					{'t':  76, 'l':  51, 'h':  24, 'w':  49, 'aligntype' : 'content', 'fmtgroup' : 2}]},

		{'id': 'FILL_3L', 'interaction': 'FILL', 'layoutName': 'Three blanks with broad header', 'score' : 6,
		 'layout': [{'t':   0, 'l':   0, 'h':  38, 'w': 100, 'aligntype' : 'title'},
					{'t':  42, 'l':   0, 'h':  17, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  63, 'l':   0, 'h':  16, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  83, 'l':   0, 'h':  17, 'w':  49, 'ans': true, 'fmtgroup' : 1},
					{'t':  42, 'l':  51, 'h':  58, 'w':  49, 'aligntype' : 'content', 'fmtgroup' : 2}]},
					
		{'id': 'DESC', 'interaction': 'DESC', 'layoutName': 'Descriptive - simple', 'score' : 10,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  78, 'w': 100, 'ans': true, 'aligntype' : 'content', 'fmtgroup' : 1}]}, 

		{'id': 'DESC2', 'interaction': 'DESC', 'layoutName': 'Descriptive - with image or hints', 'score' : 10, 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  78, 'w':  49, 'ans': true, 'aligntype' : 'content', 'fmtgroup' : 1},
					{'t':  22, 'l':  51, 'h':  78, 'w':  49, 'fmtgroup' : 2}]}, 


		{'id': 'PARTFILL3', 'interaction': 'PARTFILL', 'layoutName': '3 parts', 'score' : 3,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  78, 'w':  70, 'correct': true, 'fmtgroup' : 2},
					{'t':  22, 'l':  72, 'h':  23, 'w':  28, 'ans': true, 'fmtgroup' : 1},
					{'t':  49, 'l':  72, 'h':  24, 'w':  28, 'ans': true, 'fmtgroup' : 1},
					{'t':  77, 'l':  72, 'h':  23, 'w':  28, 'ans': true, 'fmtgroup' : 1}]},
		{'id': 'PARTFILL4', 'interaction': 'PARTFILL', 'layoutName': '4 parts', 'score' : 4,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  78, 'w':  70, 'correct': true, 'fmtgroup' : 2},
					{'t':  22, 'l':  72, 'h':16.5, 'w':  28, 'ans': true, 'fmtgroup' : 1},
					{'t':42.5, 'l':  72, 'h':16.5, 'w':  28, 'ans': true, 'fmtgroup' : 1},
					{'t':  63, 'l':  72, 'h':16.5, 'w':  28, 'ans': true, 'fmtgroup' : 1},
					{'t':83.5, 'l':  72, 'h':16.5, 'w':  28, 'ans': true, 'fmtgroup' : 1}]},
		{'id': 'PARTFILL5', 'interaction': 'PARTFILL', 'layoutName': '5 parts', 'score' : 5,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':   0, 'h':  78, 'w':  70, 'correct': true, 'fmtgroup' : 2},
					{'t':  22, 'l':  72, 'h':12.4, 'w':  28, 'ans': true, 'fmtgroup' : 1},
					{'t':38.4, 'l':  72, 'h':12.4, 'w':  28, 'ans': true, 'fmtgroup' : 1},
					{'t':54.8, 'l':  72, 'h':12.4, 'w':  28, 'ans': true, 'fmtgroup' : 1},
					{'t':71.2, 'l':  72, 'h':12.4, 'w':  28, 'ans': true, 'fmtgroup' : 1},
					{'t':87.6, 'l':  72, 'h':12.4, 'w':  28, 'ans': true, 'fmtgroup' : 1}]},
		{'id': 'PARTFILL6', 'interaction': 'PARTFILL', 'layoutName': '6 parts', 'score' : 6,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  22, 'l':  30, 'h':  78, 'w':  40, 'correct': true, 'fmtgroup' : 2},
					{'t':  22, 'l':   0, 'h':  24, 'w':  28, 'ans': true, 'fmtgroup' : 1},
					{'t':  49, 'l':   0, 'h':  24, 'w':  28, 'ans': true, 'fmtgroup' : 1},
					{'t':  76, 'l':   0, 'h':  24, 'w':  28, 'ans': true, 'fmtgroup' : 1},
					{'t':  22, 'l':  72, 'h':  24, 'w':  28, 'ans': true, 'fmtgroup' : 1},
					{'t':  49, 'l':  72, 'h':  24, 'w':  28, 'ans': true, 'fmtgroup' : 1},
					{'t':  76, 'l':  72, 'h':  24, 'w':  28, 'ans': true, 'fmtgroup' : 1}]},
					
		{'id' : 'SIMULATE1', 'interaction': 'SIMULATE', 'layoutName': 'With title', 'score' : 1,
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  21, 'l':   0, 'h':  79, 'w': 100, 'correct': true, 'fmtgroup' : 2}]},

		{'id': 'QUEST1', 'interaction': 'QUESTIONNAIRE', 'layoutName': 'Title and 1 question', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  21, 'l':   0, 'h':  79, 'w': 100, 'fmtgroup' : 1, 'ans': true}]},
		{'id': 'QUEST3', 'interaction': 'QUESTIONNAIRE', 'layoutName': 'Title and 3 questions', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  21, 'l':   0, 'h':   8, 'w':  23, 'fmtgroup' : 1},
					{'t':  21, 'l':  25, 'h':   8, 'w':  24, 'fmtgroup' : 2, 'ans': true},
					{'t':  21, 'l':  51, 'h':   8, 'w':  23, 'fmtgroup' : 1},
					{'t':  21, 'l':  76, 'h':   8, 'w':  24, 'fmtgroup' : 2, 'ans': true},
					{'t':  32, 'l':   0, 'h':  68, 'w':  23, 'fmtgroup' : 1},
					{'t':  32, 'l':  25, 'h':  68, 'w':  75, 'fmtgroup' : 2, 'ans': true}]},
		{'id': 'QUEST7', 'interaction': 'QUESTIONNAIRE', 'layoutName': 'Title and 7 questions', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  21, 'l':   0, 'h':   8, 'w':  70, 'fmtgroup' : 1},
					{'t':  21, 'l':  72, 'h':   8, 'w':  28, 'fmtgroup' : 2, 'ans': true},
					{'t':  32, 'l':   0, 'h':   8, 'w':  70, 'fmtgroup' : 1},
					{'t':  32, 'l':  72, 'h':   8, 'w':  28, 'fmtgroup' : 2, 'ans': true},
					{'t':  43, 'l':   0, 'h':   8, 'w':  70, 'fmtgroup' : 1},
					{'t':  43, 'l':  72, 'h':   8, 'w':  28, 'fmtgroup' : 2, 'ans': true},
					{'t':  54, 'l':   0, 'h':   8, 'w':  70, 'fmtgroup' : 1},
					{'t':  54, 'l':  72, 'h':   8, 'w':  28, 'fmtgroup' : 2, 'ans': true},
					{'t':  65, 'l':   0, 'h':   8, 'w':  70, 'fmtgroup' : 1},
					{'t':  65, 'l':  72, 'h':   8, 'w':  28, 'fmtgroup' : 2, 'ans': true},
					{'t':  76, 'l':   0, 'h':   8, 'w':  70, 'fmtgroup' : 1},
					{'t':  76, 'l':  72, 'h':   8, 'w':  28, 'fmtgroup' : 2, 'ans': true},
					{'t':  87, 'l':   0, 'h':   8, 'w':  70, 'fmtgroup' : 1},
					{'t':  87, 'l':  72, 'h':   8, 'w':  28, 'fmtgroup' : 2, 'ans': true}]},
		{'id': 'QUEST11', 'interaction': 'QUESTIONNAIRE', 'layoutName': 'Title and 11 questions', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  21, 'l':   0, 'h':   8, 'w':  23, 'fmtgroup' : 1},
					{'t':  21, 'l':  25, 'h':   8, 'w':  24, 'fmtgroup' : 2, 'ans': true},
					{'t':  21, 'l':  51, 'h':   8, 'w':  23, 'fmtgroup' : 1},
					{'t':  21, 'l':  76, 'h':   8, 'w':  24, 'fmtgroup' : 2, 'ans': true},
					{'t':  32, 'l':   0, 'h':   8, 'w':  23, 'fmtgroup' : 1},
					{'t':  32, 'l':  25, 'h':   8, 'w':  24, 'fmtgroup' : 2, 'ans': true},
					{'t':  32, 'l':  51, 'h':   8, 'w':  23, 'fmtgroup' : 1},
					{'t':  32, 'l':  76, 'h':   8, 'w':  24, 'fmtgroup' : 2, 'ans': true},
					{'t':  43, 'l':   0, 'h':   8, 'w':  23, 'fmtgroup' : 1},
					{'t':  43, 'l':  25, 'h':   8, 'w':  24, 'fmtgroup' : 2, 'ans': true},
					{'t':  43, 'l':  51, 'h':   8, 'w':  23, 'fmtgroup' : 1},
					{'t':  43, 'l':  76, 'h':   8, 'w':  24, 'fmtgroup' : 2, 'ans': true},
					{'t':  54, 'l':   0, 'h':   8, 'w':  23, 'fmtgroup' : 1},
					{'t':  54, 'l':  25, 'h':   8, 'w':  24, 'fmtgroup' : 2, 'ans': true},
					{'t':  54, 'l':  51, 'h':   8, 'w':  23, 'fmtgroup' : 1},
					{'t':  54, 'l':  76, 'h':   8, 'w':  24, 'fmtgroup' : 2, 'ans': true},
					{'t':  65, 'l':   0, 'h':   8, 'w':  23, 'fmtgroup' : 1},
					{'t':  65, 'l':  25, 'h':   8, 'w':  24, 'fmtgroup' : 2, 'ans': true},
					{'t':  65, 'l':  51, 'h':   8, 'w':  23, 'fmtgroup' : 1},
					{'t':  65, 'l':  76, 'h':   8, 'w':  24, 'fmtgroup' : 2, 'ans': true},
					{'t':  76, 'l':   0, 'h':   8, 'w':  23, 'fmtgroup' : 1},
					{'t':  76, 'l':  25, 'h':  24, 'w':  75, 'fmtgroup' : 2, 'ans': true}]},
		{'id': 'MQ3', 'interaction': 'MANYQUESTIONS', 'layoutName': 'Many questions: title and 3 questions (70:30)', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  21, 'l':   0, 'h':  23, 'w':  70, 'fmtgroup' : 1},
					{'t':  21, 'l':  72, 'h':  23, 'w':  28, 'fmtgroup' : 2, 'ans': true},
					{'t':  47, 'l':   0, 'h':  23, 'w':  70, 'fmtgroup' : 1},
					{'t':  47, 'l':  72, 'h':  23, 'w':  28, 'fmtgroup' : 2, 'ans': true},
					{'t':  73, 'l':   0, 'h':  23, 'w':  70, 'fmtgroup' : 1},
					{'t':  73, 'l':  72, 'h':  23, 'w':  28, 'fmtgroup' : 2, 'ans': true}]},
		{'id': 'MQ3A', 'interaction': 'MANYQUESTIONS', 'layoutName': 'Many questions: title and 3 questions (50:50)', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  21, 'l':   0, 'h':  23, 'w':  50, 'fmtgroup' : 1},
					{'t':  21, 'l':  52, 'h':  23, 'w':  48, 'fmtgroup' : 2, 'ans': true},
					{'t':  47, 'l':   0, 'h':  23, 'w':  50, 'fmtgroup' : 1},
					{'t':  47, 'l':  52, 'h':  23, 'w':  48, 'fmtgroup' : 2, 'ans': true},
					{'t':  73, 'l':   0, 'h':  23, 'w':  50, 'fmtgroup' : 1},
					{'t':  73, 'l':  52, 'h':  23, 'w':  48, 'fmtgroup' : 2, 'ans': true}]},
		{'id': 'MQ7', 'interaction': 'MANYQUESTIONS', 'layoutName': 'Many questions: title and 7 questions (70:30)', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  21, 'l':   0, 'h':   8, 'w':  70, 'fmtgroup' : 1},
					{'t':  21, 'l':  72, 'h':   8, 'w':  28, 'fmtgroup' : 2, 'ans': true},
					{'t':  32, 'l':   0, 'h':   8, 'w':  70, 'fmtgroup' : 1},
					{'t':  32, 'l':  72, 'h':   8, 'w':  28, 'fmtgroup' : 2, 'ans': true},
					{'t':  43, 'l':   0, 'h':   8, 'w':  70, 'fmtgroup' : 1},
					{'t':  43, 'l':  72, 'h':   8, 'w':  28, 'fmtgroup' : 2, 'ans': true},
					{'t':  54, 'l':   0, 'h':   8, 'w':  70, 'fmtgroup' : 1},
					{'t':  54, 'l':  72, 'h':   8, 'w':  28, 'fmtgroup' : 2, 'ans': true},
					{'t':  65, 'l':   0, 'h':   8, 'w':  70, 'fmtgroup' : 1},
					{'t':  65, 'l':  72, 'h':   8, 'w':  28, 'fmtgroup' : 2, 'ans': true},
					{'t':  76, 'l':   0, 'h':   8, 'w':  70, 'fmtgroup' : 1},
					{'t':  76, 'l':  72, 'h':   8, 'w':  28, 'fmtgroup' : 2, 'ans': true},
					{'t':  87, 'l':   0, 'h':   8, 'w':  70, 'fmtgroup' : 1},
					{'t':  87, 'l':  72, 'h':   8, 'w':  28, 'fmtgroup' : 2, 'ans': true}]},
		{'id': 'MQ7A', 'interaction': 'MANYQUESTIONS', 'layoutName': 'Many questions: title and 7 questions (50:50)', 
		 'layout': [{'t':   0, 'l':   0, 'h':  18, 'w': 100, 'aligntype' : 'title'},
					{'t':  21, 'l':   0, 'h':   8, 'w':  50, 'fmtgroup' : 1},
					{'t':  21, 'l':  52, 'h':   8, 'w':  48, 'fmtgroup' : 2, 'ans': true},
					{'t':  32, 'l':   0, 'h':   8, 'w':  50, 'fmtgroup' : 1},
					{'t':  32, 'l':  52, 'h':   8, 'w':  48, 'fmtgroup' : 2, 'ans': true},
					{'t':  43, 'l':   0, 'h':   8, 'w':  50, 'fmtgroup' : 1},
					{'t':  43, 'l':  52, 'h':   8, 'w':  48, 'fmtgroup' : 2, 'ans': true},
					{'t':  54, 'l':   0, 'h':   8, 'w':  50, 'fmtgroup' : 1},
					{'t':  54, 'l':  52, 'h':   8, 'w':  48, 'fmtgroup' : 2, 'ans': true},
					{'t':  65, 'l':   0, 'h':   8, 'w':  50, 'fmtgroup' : 1},
					{'t':  65, 'l':  52, 'h':   8, 'w':  48, 'fmtgroup' : 2, 'ans': true},
					{'t':  76, 'l':   0, 'h':   8, 'w':  50, 'fmtgroup' : 1},
					{'t':  76, 'l':  52, 'h':   8, 'w':  48, 'fmtgroup' : 2, 'ans': true},
					{'t':  87, 'l':   0, 'h':   8, 'w':  50, 'fmtgroup' : 1},
					{'t':  87, 'l':  52, 'h':   8, 'w':  48, 'fmtgroup' : 2, 'ans': true}]}
	];
	
	//---------------------------------------------------------------------------------------------
	// Exposed Functions
	//---------------------------------------------------------------------------------------------
	return {
		init : init,
		pageSelectionDone : pageSelectionDone,
		PageType: PageType,
		getPageTypeAttribute: getPageTypeAttribute,
		getInteractionsAndLayouts: getInteractionsAndLayouts,

		ANSWERED_NA: ANSWERED_NA,
		ANSWERED_NO: ANSWERED_NO,
		ANSWERED_PART: ANSWERED_PART,
		ANSWERED_YES: ANSWERED_YES,
		mergeAnswerStatus: mergeAnswerStatus
	};
}(); 
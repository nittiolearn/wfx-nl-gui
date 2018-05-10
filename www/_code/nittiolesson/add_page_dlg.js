(function() {

//-------------------------------------------------------------------------------------------------
// add_page_dlg.js:
// add_page_dlg for adding/modify page/popup page
// Used from Module Editor/Viewer via nittiolesson.js 
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.nittiolesson.add_page', [])
	.service('NittioLessonAddPageDlg', NittioLessonAddPageDlg);
}

//-------------------------------------------------------------------------------------------------
var NittioLessonAddPageDlg = ['nl', 'nlDlg',
function(nl, nlDlg) {
    var _dlg = null;
    this.init = function(ptInfo) {
        _dlg = new AddPageDlg(ptInfo, nl, nlDlg);
    };
    
    this.showDlg = function(cfg) {
    	cfg.mode = cfg.page ? 'changeformat' : 'addpage';
        return _dlg.show(cfg);
    };
}];
    
//-------------------------------------------------------------------------------------------------
function AddPageDlg(ptInfo, nl, nlDlg) {
    var _lastSelectedPageType = null;
    var self = this;
    var _cfg = null;
	this.show = function(cfg) {
		_cfg = cfg;
		return nl.q(function(resolve, reject) {
            var parentScope = nl.rootScope;
            var dlg = nlDlg.create(parentScope);
            dlg.setCssClass('nl-height-max nl-width-max');
            _initDlgScope(dlg.scope, cfg);
			_showDlg(dlg, resolve, cfg.page);
		});
	};
	
    function _initDlgScope(dlgScope, cfg) {
    	var page = cfg.page;
        dlgScope.showHelp = '0';
        dlgScope.showClose = '1';
        dlgScope.dlgTitle = nl.fmt2(cfg.mode == 'changeformat' ?  'Change {}Page Format' 
        							: cfg.mode == 'changelayout' ? 'Change {}Page Layout'
        							: 'Add {}Page', (cfg.isPopup ? 'Popup ': ''));
        var params = nl.window.location.search;
        dlgScope.isRaw = params.indexOf('rawedit') > 0 ? true : false;
        dlgScope.mode = cfg.mode;
        dlgScope.data = {section: null};
    	dlgScope.data.toolTab = {attr: 'style'};
        dlgScope.options = {};
        dlgScope.help = _getHelp();
        _updatePreviewPositions(dlgScope);

        if (page && page.oPage.bgimg) {
            dlgScope.data.bgImg = page.oPage.bgimg;
            dlgScope.data.bgshade = page.oPage.bgshade;
        } else if (cfg.isPopup || cfg.mode != 'changeformat') {
            dlgScope.data.bgImg = 'module_popup_img';
            dlgScope.data.bgshade = 'bglight';
        } else {
        	dlgScope.data.bgImg = cfg.modulebgimg;
            dlgScope.data.bgshade = cfg.modulebgshade;
        }

        var defPt = page ? page.pagetype.pt : _lastSelectedPageType;
        var defSectionLayout = page ? page.pagetype.layout : null;
        dlgScope.options.pagetype = _pageTypes;
        dlgScope.data.pagetype = defPt ? {id: defPt.interaction} : dlgScope.options.pagetype[0];
        dlgScope.page = page;
        if(cfg.mode != 'changeformat') {
	        _onPtChange(dlgScope, defPt);
        } else {
        	dlgScope.data.layout = defPt;
        	_onEditPageProps(dlgScope, defSectionLayout);
        }

        dlgScope.onSectionSelect = function(e, section) {
            dlgScope.data.section = section;
            if (!section) return;
            if (e) e.stopImmediatePropagation();
            _updatePreviewPositions(dlgScope);
            _initStyleOptions(dlgScope, cfg.templateDefaults);
            _updateStyles(dlgScope, section);
        };
        
        dlgScope.editLayoutDone = function() {
            dlgScope.data.showLayoutEdit = false;
            _onLayoutEditDone(dlgScope);
        };

        dlgScope.onClick = function(fieldId, param) {
            if (fieldId == 'pagetype') _onPtChange(dlgScope, param);
            else if (fieldId == 'layout') _onLayoutSelect(dlgScope, param);
        };
        
        dlgScope.onFieldChange = function(fieldId) {
        	if(fieldId == "pagetype") {
        		_onPtChange(dlgScope, dlgScope.data.pagetype);
        	} else {
	        	_onSectionPropChange(dlgScope);
        	}
        };

        dlgScope.onChangePageType = function() {
        	_cfg.mode = 'changelayout';
			self.show(_cfg).then(function(result) {
				if(!result) return;
				_cfg.page.pagetype.pt = result;
				_cfg.page.pagetype.layout = result.layout;
				_cfg.mode = 'changeformat';
				_initDlgScope(dlgScope, _cfg);	        	
			});
		};        
        
        dlgScope.onSectionPropChange = function() {
        	_onSectionPropChange(dlgScope);
        };
        
        dlgScope.changeTab = function(tabName) {
            dlgScope.data.toolTab.attr = tabName;
            _updatePreviewPositions(dlgScope);
        };
        
        nl.resizeHandler.onResize(function() {
            _updatePreviewPositions(dlgScope);
        });
    }

    function _updatePreviewPositions(dlgScope) {
        var w = nl.rootScope.screenWidth*0.42;
        var h = w*9/16;
        
        if (dlgScope.data.toolTab.attr == "mobPosition") {
            h = nl.rootScope.screenHeight*0.65;
            w = h*9/16;
        }
        dlgScope.previewPositions = {height: Math.round(h) + 'px', width: Math.round(w) + 'px'};
        
        var sec = dlgScope.data.section;
        if (!sec) return;
        var isMobile = dlgScope.data.toolTab.attr == "mobPosition";
        var t = (isMobile ? sec.t1 : sec.t);
        if (t < 0) t=0;
        var r = (isMobile ? sec.l1+sec.w1 : sec.l+sec.w);
        if (r > 100) r=100;
        dlgScope.markerPositions = {top: (t-5) + '%', left: (r) + '%'};
    }

	function _showDlg(dlg, resolve, page) {
        var okButton = {text: nl.t('OK'), onTap: function(e) {
            if (e) e.preventDefault();
	        var sd = dlg.scope.data;
	        if(!sd.layout) {
	    		var msg = {title: 'Alert message', 
	        			   template: 'Please select the page type.'};
		        return nlDlg.popupAlert(msg).then(function(confirm) {
	    		    if (!confirm) return;
	    		});
	        }
        	if(dlg.scope.mode == 'addpage') {
                _lastSelectedPageType = _layoutDict[sd.layout.id];
	            resolve({pt:sd.layout.id, layout: _getLayouts(sd)});
    		    dlg.close();
    		    return;
        	} else if(dlg.scope.mode == 'changelayout') {
	    		var msg = {title: 'Please confirm', 
	        			   template: 'Changing page type may result in loss of data. Do you want to proceed?'};
		        nlDlg.popupConfirm(msg).then(function(confirm) {
	    		    if (!confirm) return;
	                _lastSelectedPageType = _layoutDict[sd.layout.id];
		            resolve(sd.layout);
	    		    dlg.close();
	    		    return;
				});
        	} else {
    		    _lastSelectedPageType = _layoutDict[sd.layout.id];
    		    resolve({pt:sd.layout.id, layout: _getLayouts(sd)});
    		    dlg.close();
        	}
        }};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
			resolve(false);
		}};
		dlg.show('nittiolesson/add_page_dlg.html', [okButton], cancelButton);
	}

	function _getLayouts(sd) {
        var layout = _layoutsFromBeautyString(sd.sectionLayout);
        for(var i=0; i<layout.length; i++) {
        	if(!sd.layout.layout[i].content) continue;
        	layout[i].content = sd.layout.layout[i].content || {};
        }
		return layout;
	}	

    function _getHelp() {
        return {
            pagetype: {name: nl.t('Page Type'), help: nl.t('specifies the purpose of the page - some of the page types are for presenting information(text, images and videos) while others are for providing various interactions with the learner.')},
            layout: {name: nl.t('Layout'), help: nl.t('specifies the number of sections in the page and their positions within the page.')}
        };  
    }
    
    var _pageTypes = [];    
    var _layouts = {};
    var _layoutDict = {};
    function _initPageTypesAndLayouts() {
        for(var i=0; i<ptInfo.interactions.length; i++) {
            var inter = ptInfo.interactions[i];
            _pageTypes.push({id: inter.id, name: inter.desc});
            var layouts = ptInfo.interactionToLayouts[inter.id] || [];
            _layouts[inter.id] = [];
            for(var j=0; j<layouts.length; j++) {
                _layouts[inter.id].push({id: layouts[j].pagetype_id, name: layouts[j].desc});
                _layoutDict[layouts[j].pagetype_id] = {id: layouts[j].pagetype_id, interaction:inter.id};
            }
        }
    }

    function _onPtChange(dlgScope, defPt) {
    	dlgScope.data.section = null;
    	var selectedPageType = defPt || {id: 'TITLE'};
        var layouts = _layouts[selectedPageType.interaction] || _layouts[selectedPageType.id];
        for(var i=0; i<dlgScope.options.pagetype.length; i++) {
        	var pagetype = dlgScope.options.pagetype[i];
        	if(pagetype.id == selectedPageType.interaction || pagetype.id == selectedPageType.id){
        		dlgScope.options.pagetype[i].selected = true;
        		dlgScope.data.pagetype = dlgScope.options.pagetype[i];
        	} else {
        		dlgScope.options.pagetype[i].selected = false;
        	}
        }
        dlgScope.options.layouts = [];
        for(var i=0; i<layouts.length; i++) {
        	var layout = layouts[i];
	        var pt = ptInfo.ptMap[layout.id];
	        var layoutObj = pt.layout;
	        dlgScope.data.sectionLayout = _beautyStringifyLayouts(layoutObj);
			pt.layout = _getLayoutSections(dlgScope, layoutObj);
			dlgScope.options.layouts.push(pt);
        }
    }

	function _onEditPageProps(dlgScope, defSectionLayout) {
        dlgScope.data.sectionLayout = _beautyStringifyLayouts(defSectionLayout);
		_formSections(dlgScope, defSectionLayout); 
    }
    
    function _formSections(dlgScope, pagelayout) {
        dlgScope.sections = [];
        for(var i=0; i<pagelayout.length; i++) {
            var section = angular.copy(pagelayout[i]);
            section.pos = i+1;
            if (!section.aligntype) section.aligntype = 
            	dlgScope.page && dlgScope.page.pagetype.isSectionValignMiddle(i) 
            	? 'title' : 'content';
            _cleanupPositions(section);
            dlgScope.sections.push(section);
        }
    }


    function _getLayoutSections(dlgScope, pagelayout) {
        var layout = [];
        for(var i=0; i<pagelayout.length; i++) {
            var section = angular.copy(pagelayout[i]);
            section.pos = i+1;
            _cleanupPositions(section);
            layout.push(section);
        }
        return layout;
    }

    function _onLayoutSelect(dlgScope, pt) {
    	dlgScope.data.section = null;
    	dlgScope.data.layout = pt;
        var layoutObj = pt.layout;
        dlgScope.data.sectionLayout = _beautyStringifyLayouts(layoutObj);
    }

    function _initStyleOptions(dlgScope, templateDefaults) {
        dlgScope.options.colors = _getBackgroundColors(templateDefaults);
        dlgScope.options.shapes = _getSectionShapes();
        dlgScope.options.shadow = _getSectionShadow();
        dlgScope.options.fontsize = _getSectionSize();
    }

    function _getBackgroundColors(templateDefaults) {
        if (templateDefaults && templateDefaults.styles && templateDefaults.styles.colors)
            return templateDefaults.styles.colors;
        return [{"id": "", "name": "None"},
            {"id": "bg-light1", "name": "Translucent White", "group": "Light colors"},
            {"id": "bg-light2", "name": "Light Blue", "group": "Light colors"},
            {"id": "bg-light3", "name": "Light Green", "group": "Light colors"},
            {"id": "bg-light4", "name": "Light Red", "group": "Light colors"},
            {"id": "bg-light5", "name": "Light Yellow", "group": "Light colors"},
            {"id": "bg-pastel1", "name": "Light Turquoise", "group": "Pastel colors"},
            {"id": "bg-pastel2", "name": "Light Yellow Green", "group": "Pastel colors"},
            {"id": "bg-pastel3", "name": "Dark Cyan", "group": "Pastel colors"},
            {"id": "bg-pastel4", "name": "Olive Green", "group": "Pastel colors"},
            {"id": "bg-pastel5", "name": "Steel Blue", "group": "Pastel colors"},
            {"id": "bg-dark1", "name": "Translucent Dark Grey", "group": "Dark colors"},
            {"id": "bg-dark2", "name": "Dark Blue", "group": "Dark colors"},
            {"id": "bg-dark3", "name": "Dark Green", "group": "Dark colors"},
            {"id": "bg-dark4", "name": "Dark Red", "group": "Dark colors"},
            {"id": "bg-dark5", "name": "Dark Yellow", "group": "Dark colors"},
            {"id": "bg-bright1", "name": "Blue", "group": "Bright colors"},
            {"id": "bg-bright2", "name": "Green", "group": "Bright colors"},
            {"id": "bg-bright3", "name": "Red", "group": "Bright colors"},
            {"id": "bg-bright4", "name": "Yellow", "group": "Bright colors"},
            {"id": "bg-bright5", "name": "Orange", "group": "Bright colors"}];
    }

    function _getSectionShapes() {
        return [{id:'', name: nl.t('Rectangle')},
                {id:'shape-rounded-small', name: nl.t('Small rounded rectangle')},
                {id:'shape-rounded-h', name: nl.t('Rounded horizontal')},
                {id:'shape-rounded-v', name: nl.t('Rounded vertical')},
                {id:'shape-oval', name: nl.t('Circular or Oval')},
                {id:'shape-leaf1', name: nl.t('Leaf Left')},
                {id:'shape-leaf2', name: nl.t('Leaf Right')}];
    }
    
    function _getSectionShadow() {
        return [{id:'', name: 'No shadow'},
                {id:'shadow-1', name: 'Light Shadow'},
                {id:'shadow-2', name: 'Medium Shadow'},
                {id:'shadow-3', name: 'Heavy Shadow'}];
    }
    
    function _getSectionSize() {
        return [{id: '', name: nl.t('Normal')},
                {id: 'size-title1', name: nl.t('Title 1')},
                {id: 'size-title2', name: nl.t('Title 2')},
                {id: 'size-title3', name: nl.t('Title 3')},
                {id: 'size-title4', name: nl.t('Title 4')}];
    }
            
    function _updateStyles(dlgScope, section) {
        dlgScope.data.styles = {vAlignTop: (section.aligntype == 'content'), 
            hAlign: '',
            bold: false, underline: false, italic: false};

        dlgScope.data.colors = dlgScope.options.colors[0];
        dlgScope.data.shapes = dlgScope.options.shapes[0];
        dlgScope.data.shadow = dlgScope.options.shadow[0];
        dlgScope.data.fontsize = dlgScope.options.fontsize[0];

        var styles = section.style ? section.style.split(' ') : "";
        for(var i=0; i<styles.length; i++) {
            var style = styles[i].trim();
            if (!style) continue;
            if (style.indexOf('bg-') == 0) _updateStyleOption(dlgScope, style, 'colors');
            if (style.indexOf('shape-') == 0) _updateStyleOption(dlgScope, style, 'shapes');
            if (style.indexOf('size-') == 0) _updateStyleOption(dlgScope, style, 'fontsize');
            if (style.indexOf('shadow-') == 0) _updateStyleOption(dlgScope, style, 'shadow');

            if (style.indexOf('align-') == 0) dlgScope.data.styles.hAlign = style;
            if (style.indexOf('font-bold') == 0) dlgScope.data.styles.bold = true;
            if (style.indexOf('font-underline') == 0) dlgScope.data.styles.underline = true;
            if (style.indexOf('font-italic') == 0) dlgScope.data.styles.italic = true;
        }
        dlgScope.data.styles.hAlign = _updateHAlign(dlgScope.data.styles);
    }
    
    function _updateStyleOption(dlgScope, style, attr) {
        var opts = dlgScope.options[attr];
        for(var i=0; i<opts.length; i++) {
            if(opts[i].id == style) {
                dlgScope.data[attr] = opts[i];
                return;
            }
        }
        dlgScope.data[attr] = opts[0];
    }

    var _hAlignList = {'align-justify': true, 'align-center': true, 'align-left': true, 'align-right': true};
    function _updateHAlign(styles) {
        if(styles.hAlign in _hAlignList) return styles.hAlign;
        return styles.vAlignTop ? 'align-left' : 'align-center';
    }

    function _cleanupPositions(section) {
        if(section.t === undefined) section.t = 0;
        if(section.l === undefined) section.l = 0;
        if(section.h === undefined) section.h = 100;
        if(section.w === undefined) section.w = 100;

        if(section.t1 === undefined) section.t1 = section.t;
        if(section.l1 === undefined) section.l1 = section.l;
        if(section.h1 === undefined) section.h1 = section.h;
        if(section.w1 === undefined) section.w1 = section.w;
    }
    
    function _onSectionPropChange(dlgScope) {
        var section = angular.copy(dlgScope.data.section);
        _cleanupPositions(section);

        var vAlignTop = dlgScope.data.styles.vAlignTop;
        var hAlign = dlgScope.data.styles.hAlign;

        if (vAlignTop) section.aligntype = 'content';
        else if (section.aligntype == 'content') section.aligntype = 'title';
        if (vAlignTop && hAlign == 'align-left') hAlign = '';
        if (!vAlignTop && hAlign == 'align-center') hAlign = '';
        
        section.style = '';
        _appendToStyle(section, dlgScope.data.colors.id);
        _appendToStyle(section, dlgScope.data.shapes.id);
        _appendToStyle(section, dlgScope.data.shadow.id);
        _appendToStyle(section, dlgScope.data.fontsize.id);
        _appendToStyle(section, hAlign);
        if(dlgScope.data.styles.bold) _appendToStyle(section, 'font-bold');
        if(dlgScope.data.styles.italic) _appendToStyle(section, 'font-italic');
        if(dlgScope.data.styles.underline) _appendToStyle(section, 'font-underline');

        var sectionLayout = _layoutsFromBeautyString(dlgScope.data.sectionLayout);
        for(var i=0; i<sectionLayout.length; i++) {
            if(section.pos === i+1) sectionLayout.splice(i, 1, section);
        }
        dlgScope.data.sectionLayout = _beautyStringifyLayouts(sectionLayout);
        _onLayoutEditDone(dlgScope);
    }

    function _appendToStyle(section, style) {
    	if (!style) return;
    	if (section.style) section.style += ' ';
    	section.style += style;
    }

    function _onLayoutEditDone(dlgScope) {
        dlgScope.data.sectionLayout = _layoutsFromBeautyString(dlgScope.data.sectionLayout);     
		_formSections(dlgScope, dlgScope.data.sectionLayout);
        dlgScope.data.sectionLayout = _beautyStringifyLayouts(dlgScope.data.sectionLayout);     
    }

	function _layoutsFromBeautyString(beautyStr) {
		var layoutsObj = angular.fromJson('[' + beautyStr + ']');
		for (var i=0; i<layoutsObj.length; i++) {
			var secLayout = layoutsObj[i];
			if ('pos' in secLayout) delete secLayout.pos;
            if (secLayout.t == secLayout.t1) delete secLayout.t1;
            if (secLayout.h == secLayout.h1) delete secLayout.h1;
            if (secLayout.l == secLayout.l1) delete secLayout.l1;
            if (secLayout.w == secLayout.w1) delete secLayout.w1;
		}
		return layoutsObj;
	}
	
	function _beautyStringifyLayouts(layoutsObj) {
		var jsonStr = '';
		for (var i=0; i<layoutsObj.length; i++) {
			var secLayout = layoutsObj[i];
			jsonStr += _beautyStringifyLayout(secLayout, i);
			if (i <layoutsObj.length -1) {
				jsonStr += ',\r\n';
			}
		}
		return jsonStr;
	}

	var LAYOUT_ORDER = ['pos', 't', 'h', 'l', 'w'];
	var LAYOUT_COLLEN = {'pos': 2, 't': 5, 'h': 5, 'l': 5, 'w': 5};
	var LAYOUT_ORDER_OTHER = ['t1', 'h1', 'l1', 'w1', 'aligntype', 'style', 'fmtgroup', 'ans', 'correct', 'mode', 'content'];
    var LAYOUT_ATTR_TYPE = {'t1': 'int', 'h1': 'int', 'l1': 'int', 'w1': 'int', 'content': 'object'};
	function _beautyStringifyLayout(secLayout, i) {
		secLayout.pos = i+1;
		var ret = '{';
		var bCommaNeeded = false;
		for (var i in LAYOUT_ORDER) {
			var attr = LAYOUT_ORDER[i];
			var valLen = LAYOUT_COLLEN[attr];
			var val = secLayout[attr];
			if (bCommaNeeded) ret += ', ';
			ret += '"' + attr + '":' + _fillLeadingBlanks(''+val, valLen);
			bCommaNeeded = true;
		}
		for (var i in LAYOUT_ORDER_OTHER) {
			var attr = LAYOUT_ORDER_OTHER[i];
			if (!(attr in secLayout)) continue;
			if (attr in LAYOUT_ATTR_TYPE && LAYOUT_ATTR_TYPE[attr] == 'object') continue;
			var quote = (attr in LAYOUT_ATTR_TYPE && LAYOUT_ATTR_TYPE[attr] == 'int') ? '' : '"';
			ret += ', "' + attr + '":' + quote + secLayout[attr] + quote;
		}
		for (var i in secLayout) {
			if (LAYOUT_ORDER.indexOf(i) != -1) continue;
			if (LAYOUT_ORDER_OTHER.indexOf(i) != -1) continue;
			throw 'Unknown attribute type: ' +  i;
		}
		delete secLayout.pos;
		return ret + '}';
	}

	function _fillLeadingBlanks(str, requiredLen) {
		if (str.length >= requiredLen) return str;
		var blankLen = requiredLen - str.length;
		var blank = '';
		for (var b=0; b<blankLen; b++) {
			blank += ' ';
		}
		return blank + str;
	}
	
    function _init() {
        _initPageTypesAndLayouts();
    }
    _init();
}

//-------------------------------------------------------------------------------------------------
module_init();
})();


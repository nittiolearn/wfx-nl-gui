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
    
    this.showDlg = function(page, isPopup, bgImgUrl) {
        return _dlg.show(page, isPopup, bgImgUrl);
    };
}];
    
//-------------------------------------------------------------------------------------------------
function AddPageDlg(ptInfo, nl, nlDlg) {
    
    var _lastSelectedPageType = null;
	this.show = function(page, isPopup, bgImgUrl) {
		return nl.q(function(resolve, reject) {
            var parentScope = nl.rootScope;
            var dlg = nlDlg.create(parentScope);
            dlg.setCssClass('nl-height-max nl-width-max');
            _initDlgScope(dlg.scope, page, isPopup, bgImgUrl);
			_showDlg(dlg, resolve, page);
		});
	};
	
    function _initDlgScope(dlgScope, page, isPopup, bgImgUrl) {
        dlgScope.showHelp = '0';
        dlgScope.showClose = '1';
        dlgScope.dlgTitle = nl.fmt2(page ?  'Change {}Page Layout' : 'Add {}Page', (isPopup ? 'Popup ': ''));
        var params = nl.window.location.search;
        dlgScope.isRaw = params.indexOf('rawedit') > 0 ? true : false;
        dlgScope.data = {};
        dlgScope.data.showStyles = true;
        dlgScope.options = {};
        dlgScope.help = _getHelp();

        if (page && page.oPage.bgimg) {
            dlgScope.data.bgImg = page.oPage.bgimg;
            dlgScope.data.bgshade = page.oPage.bgshade;
        } else if (isPopup) {
            dlgScope.data.bgImg = "module_popup_img";
            dlgScope.data.bgshade = 'bglight';
        } else {
        	dlgScope.data.bgImg = bgImgUrl;
            dlgScope.data.bgshade = 'bglight';
        }

        var defPt = page ? page.pagetype.pt : _lastSelectedPageType;
        var defSectionLayout = page ? page.pagetype.layout : null;
        dlgScope.options.pagetype = _pageTypes;
        dlgScope.data.pagetype = defPt ? {id: defPt.interaction} : dlgScope.options.pagetype[0];
        _onPtChange(dlgScope, defPt, defSectionLayout);

        dlgScope.onFieldChange = function(fieldId) {
            if (fieldId == 'pagetype') _onPtChange(dlgScope);
            else if (fieldId == 'layout') _onLayoutChange(dlgScope);
			else if (fieldId == 'aligntype') dlgScope.onClickOnDone();
			else if (fieldId == 'style') dlgScope.onClickOnDone();
			else if (fieldId == 'colors') dlgScope.onClickOnDone();
			else if (fieldId == 'shapes') dlgScope.onClickOnDone();
			else if (fieldId == 'shadow') dlgScope.onClickOnDone();
			else if (fieldId == 'hozAlignment') dlgScope.onClickOnDone();
			else if (fieldId == 'fontsize') dlgScope.onClickOnDone();
			else {
	        	dlgScope.data.onSectionClick = false;
	        	dlgScope.data.section = {};
			}
        };
        
        dlgScope.editLayoutDone = function() {
        	dlgScope.data.showLayoutEdit = false;
        	_onLayoutEditDone(dlgScope);
        };
        
        dlgScope.data.isPopup = function() {
        	return isPopup;
        };
        
        dlgScope.onClickOnSection = function(section) {
        	dlgScope.data.onSectionClick = true;
        	dlgScope.data.section = {pos: section.pos, l: section.l, t: section.t, h:section.h, w:section.w,
        		l1: section.l1, t1: section.t1, h1:section.h1, w1:section.w1, 
        		style: section.style, fmtgroup: section.fmtgroup};

        	dlgScope.options.aligntype = [{id: 'content', name: nl.t('Top')}, {id: 'title', name: nl.t('Middle')}];
			dlgScope.data.aligntype =  section.aligntype == 'content' ? dlgScope.options.aligntype[0] : dlgScope.options.aligntype[1];

			_initOptionsFromTemplate(dlgScope.options);
        	_updateStyles(section);
        	
        };
        
        function _getHorizontalAlignments() {
        	return [{id: 'align-center', name: nl.t('Center')},
        			{id: 'align-justify', name: nl.t('Justify')},
        			{id: 'align-left', name: nl.t('Left')},
        			{id: 'align-right', name: nl.t('Right')}];
        }
        
        function _updateStyles(section) {
        	var styles = section.style ? section.style.split(' ') : "";
        	var ret = {color: '', shape: '', shadow: '', halign: '', size: '', underline: false, bold: false, italic: false};
        	for(var i=0; i<styles.length; i++) {
        		var style = styles[i].trim();
        		if (!style) continue;
        		if (style.indexOf('bg-') == 0) ret.color = style;
        		if (style.indexOf('shape-') == 0) ret.shape = style;
        		if (style.indexOf('size-') == 0) ret.size = style;
        		if (style.indexOf('shadow-') == 0) ret.shadow = style;
        		if (style.indexOf('align-') == 0) ret.halign = style;

        		if (style.indexOf('font-bold') == 0) ret.bold = true;
        		if (style.indexOf('font-underline') == 0) ret.underline = true;
        		if (style.indexOf('font-italic') == 0) ret.italic = true;
        	}
        	
			dlgScope.data.hozAlignment = _getHozAlign(ret);
        	dlgScope.data.colors = _updateSectionStyle(dlgScope.options.colors, ret, 'color');
        	dlgScope.data.shapes = _updateSectionStyle(dlgScope.options.shapes, ret, 'shape');
        	dlgScope.data.shadow = _updateSectionStyle(dlgScope.options.shadow, ret, 'shadow');
        	dlgScope.data.fontsize = _updateSectionStyle(dlgScope.options.fontsize, ret, 'size');
        	dlgScope.data.underline = ret.underline;
        	dlgScope.data.bold = ret.underline;
        	dlgScope.data.italic = ret.underline;
        }
        
        function _getHozAlign(ret) {
        	if(ret.halign == '') {
        		if(dlgScope.data.aligntype.id == 'title') return dlgScope.options.hozAlignment[0];
        		if(dlgScope.data.aligntype.id == 'content') return dlgScope.options.hozAlignment[2];
        	} else {
        		for(var i=0; i<dlgScope.options.hozAlignment.length; i++) {
        			var dict = dlgScope.options.hozAlignment[i];
        			if(ret.halign == dict.id) return dict;
        		}
        	}
        }

        function _updateSectionStyle(stylesArray, style, elem) {
        	if(style[elem] == '') return stylesArray[0];
        	for(var i=0; i<stylesArray.length; i++) {
        		var dict = stylesArray[i];
        		if(dict.id == style[elem]) return dict;
        	}
        	return stylesArray[0];
        }
        
        function _initOptionsFromTemplate() {
       		dlgScope.options.hozAlignment = _getHorizontalAlignments();
			dlgScope.options.colors = _getBackgroundColors();
        	dlgScope.options.shapes = _getSectionShapes();
        	dlgScope.options.shadow = _getSectionShadow();
        	dlgScope.options.fontsize = _getSectionSize();
 
        }

        function _getBackgroundColors() {
        	return [{id:'', name:nl.t('Default')},
        			{id:'bg-light1', name: nl.t('Light background1')},
        			{id:'bg-light2', name: nl.t('Light background2')},
        			{id:'bg-light3', name: nl.t('Light background3')},
        			{id:'bg-light4', name: nl.t('Light background4')},
        			{id:'bg-light5', name: nl.t('Light background5')},
        			{id:'bg-dark1', name: nl.t('Dark background1')},
        			{id:'bg-dark2', name: nl.t('Dark background2')},
        			{id:'bg-dark3', name: nl.t('Dark background3')},
        			{id:'bg-dark4', name: nl.t('Dark background4')},
        			{id:'bg-dark5', name: nl.t('Dark background5')},
        			{id:'bg-bright1', name: nl.t('Bright1')},
        			{id:'bg-bright2', name: nl.t('Bright2')},
        			{id:'bg-bright3', name: nl.t('Red')},
        			{id:'bg-bright4', name: nl.t('Bright4')},
        			{id:'bg-bright5', name: nl.t('Bright5')},
        			{id:'bg-pastel1', name: nl.t('Pastel1')},
        			{id:'bg-pastel2', name: nl.t('Pastel2')},
        			{id:'bg-pastel3', name: nl.t('Cyan')},
        			{id:'bg-pastel4', name: nl.t('Pastel4')},
        			{id:'bg-pastel5', name: nl.t('Aquamarine')}];	
        }
        
        function _getSectionShapes() {
        	return [{id:'', name: nl.t('Rectangle')},
        			{id:'shape-rounded-small', name: nl.t('Small rounded rectangle')},
        			{id:'shape-rounded-h', name: nl.t('Rounded horizontal')},
        			{id:'shape-rounded-v', name: nl.t('Rounded vertical')},
        			{id:'shape-oval', name: nl.t('Oval')},
        			{id:'shape-leaf1', name: nl.t('Leaf1')},
        			{id:'shape-leaf2', name: nl.t('Leaf2')}];
        }
        
        function _getSectionShadow() {
        	return [{id:'no', name:nl.t('No shadow')},
        			{id:'shadow-1', name: nl.t('Shadow-1')},
        			{id:'shadow-2', name: nl.t('Shadow-2')},
        			{id:'shadow-3', name: nl.t('Shadow-3')}];
        }
        
        function _getSectionSize() {
        	return [{id: 'size-title1', name: nl.t('Title1')},
        			{id: 'size-title2', name: nl.t('Title2')},
        			{id: 'size-title3', name: nl.t('Title3')},
        			{id: 'size-title4', name: nl.t('Title4')}];
        }
                
        dlgScope.onClickOnDone = function() {
        	var section = dlgScope.data.section;
        	var newObj = angular.copy(section);
        	if ('pos' in newObj) delete newObj.pos;
        	newObj.aligntype = dlgScope.data.aligntype.id;
        	newObj.style = nl.t('{} {} {} {} {} {} {} {}', dlgScope.data.colors.id, dlgScope.data.shapes.id, dlgScope.data.shadow.id,
        						 dlgScope.data.hozAlignment.id, dlgScope.data.fontsize.id, dlgScope.data.underline ? 'font-underline' : '',
        						 dlgScope.data.bold ? 'font-bold' : '', dlgScope.data.italic ? 'font-italic' : '');

        	var sectionLayout = _layoutsFromBeautyString(dlgScope.data.sectionLayout);
        	for(var i=0; i<sectionLayout.length; i++) {
        		if(section.pos === i+1) sectionLayout.splice(i, 1, newObj);
        	}
        	dlgScope.data.sectionLayout = _beautyStringifyLayouts(sectionLayout);
        	_onLayoutEditDone(dlgScope);
        };
        
        dlgScope.onEditLayoutClose = function() {
        	dlgScope.data.onSectionClick = false;
	        dlgScope.onClickOnDone();
        };
    }

	function _showDlg(dlg, resolve, page) {
        var sd = dlg.scope.data;
        var okButton = {text: nl.t('OK'), onTap: function(e) {
            if (e) e.preventDefault();
        	if(!page) {
                _lastSelectedPageType = _layoutDict[sd.layout.id];
	            resolve({pt:sd.layout.id, layout: _layoutsFromBeautyString(sd.sectionLayout)});
    		    console.log(_layoutsFromBeautyString(sd.sectionLayout));
    		    dlg.close();
    		    return;
        	}
        	
    		var msg = {title: 'Please confirm', 
        			   template: 'Changing page type may result in loss of data. Do you want to proceed?'};
	        nlDlg.popupConfirm(msg).then(function(confirm) {
    		    if (!confirm) return;
    		    _lastSelectedPageType = _layoutDict[sd.layout.id];
    		    resolve({pt:sd.layout.id, layout: _layoutsFromBeautyString(sd.sectionLayout)});
    		    dlg.close();
    		});
        }};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
			resolve(false);
		}};
		dlg.show('nittiolesson/add_page_dlg.html', [okButton], cancelButton);
	}
	
    function _getHelp() {
        return {
            pagetype: {name: nl.t('Page Type'), help: nl.t('specifies the purpose of the page - some of the page types are for presenting information(text, images and videos) while others are for providing various interactions with the learner.')},
            layout: {name: nl.t('Layout'), help: nl.t('specifies the number of sections in the page and their positions within the page.')},
        	aligntype: {name: nl.t('Vertical')},
        	hozAlignment: {name: nl.t('Horizontal')},
        	colors: {name: nl.t('Color')},
        	shapes: {name: nl.t('Shape')},
        	shadow: {name: nl.t('Shadow')},
        	fontsize: {name: nl.t('Font size')}
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

    function _onPtChange(dlgScope, defPt, defSectionLayout) {
        dlgScope.options.layout = _layouts[dlgScope.data.pagetype.id];
        dlgScope.data.layout = defPt ? {id: defPt.id} : dlgScope.options.layout[0];
        _onLayoutChange(dlgScope, defPt, defSectionLayout);
    }

    function _onLayoutChange(dlgScope, defPt, defSectionLayout) {
        var pt = ptInfo.ptMap[dlgScope.data.layout.id];
        var layoutObj = defSectionLayout ? defSectionLayout : pt.layout;
        dlgScope.data.sectionLayout = _beautyStringifyLayouts(layoutObj);
		_formSections(dlgScope, layoutObj); 
    }
    
    function _onLayoutEditDone(dlgScope) {
        dlgScope.data.sectionLayout = _layoutsFromBeautyString(dlgScope.data.sectionLayout);     
		_formSections(dlgScope, dlgScope.data.sectionLayout);
        dlgScope.data.sectionLayout = _beautyStringifyLayouts(dlgScope.data.sectionLayout);     
    }

	function _formSections(dlgScope, pagelayout) {
        dlgScope.sections = [];
        for(var i=0; i<pagelayout.length; i++) {
            var layout = pagelayout[i];
            dlgScope.sections.push({pos: i+1, t:layout.t, l:layout.l, h:layout.h, w:layout.w, 
            	t1:layout.t1, l1:layout.l1, h1:layout.h1, w1:layout.w1, 
				aligntype: layout.aligntype, fmtgroup: layout.fmtgroup, style: layout.style});
        }
	}
    
	function _layoutsFromBeautyString(beautyStr) {
		var layoutsObj = angular.fromJson('[' + beautyStr + ']');
		for (var i=0; i<layoutsObj.length; i++) {
			var secLayout = layoutsObj[i];
			if ('pos' in secLayout) delete secLayout.pos;
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
	var LAYOUT_ORDER_OTHER = ['t1', 'h1', 'l1', 'w1', 'aligntype', 'style', 'fmtgroup', 'ans', 'correct', 'mode'];
    var LAYOUT_ATTR_TYPE = {'t1': 'int', 'h1': 'int', 'l1': 'int', 'w1': 'int'};
	function _beautyStringifyLayout(secLayout, i) {
		secLayout.pos = i+1;
		var ret = '{';
		var bCommaNeeded = false;
		for (var i in LAYOUT_ORDER) {
			var attr = LAYOUT_ORDER[i];
			var valLen = LAYOUT_COLLEN[attr];
			var val = secLayout[attr];
			if (bCommaNeeded) ret += ', ';
			ret += '"' + attr + '":' + _FillLeadingBlanks(''+val, valLen);
			bCommaNeeded = true;
		}
		for (var i in LAYOUT_ORDER_OTHER) {
			var attr = LAYOUT_ORDER_OTHER[i];
			if (!(attr in secLayout)) continue;
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

	function _FillLeadingBlanks(str, requiredLen) {
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


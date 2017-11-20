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
    
	this.show = function(page, isPopup, bgImgUrl) {
		return nl.q(function(resolve, reject) {
            var parentScope = nl.rootScope;
            var dlg = nlDlg.create(parentScope);
            dlg.setCssClass('nl-height-max nl-width-max');
            _initDlgScope(dlg.scope, page, isPopup, bgImgUrl);
			_showPopupDlg(dlg, resolve, page);
		});
	};
	
    function _initDlgScope(dlgScope, page, isPopup, bgImgUrl) {
        dlgScope.showHelp = '0';
        dlgScope.showClose = '1';
        dlgScope.dlgTitle = nl.fmt2(page ?  'Change {}Page Layout' : 'Add {}Page', (isPopup ? 'Popup ': ''));
        var params = nl.window.location.search;
        dlgScope.isRaw = params.indexOf('rawedit') > 0 ? true : false;
        dlgScope.data = {};
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

        var defPt = page ? page.pagetype : null;
        dlgScope.options.pagetype = _pageTypes;
        dlgScope.data.pagetype = defPt ? {id: defPt.pt.interaction} : dlgScope.options.pagetype[0];
        _onPtChange(dlgScope, defPt);

        dlgScope.onFieldChange = function(fieldId) {
            if (fieldId == 'pagetype') _onPtChange(dlgScope);
            else if (fieldId == 'layout') _onLayoutChange(dlgScope);
			else if (fieldId == 'aligntype') return;
			else if (fieldId == 'style') dlgScope.onClickOnDone();
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
        							 style: section.style, fmtgroup: section.fmtgroup};
        	dlgScope.options.aligntype = [{id: 'content', name: nl.t('Top')}, {id: 'title', name: nl.t('Middle')}, {id: 'option', name: nl.t('Options')}];
			dlgScope.data.aligntype =  section.aligntype == 'title' ? dlgScope.options.aligntype[1] : dlgScope.options.aligntype[0];
			dlgScope.options.hozAlignment = _getHorizontalAlignments();
			dlgScope.data.hozAlignment = dlgScope.options.hozAlignment[0];
			dlgScope.data.style = section.style;
        };
        
        function _getHorizontalAlignments() {
        	return [{id: 'center', name: nl.t('Center')},
        			{id: 'justify', name: nl.t('Justify')},
        			{id: 'left', name: nl.t('Left')},
        			{id: 'right', name: nl.t('Right')}];
        }
        
        dlgScope.onClickOnDone = function() {
        	var section = dlgScope.data.section;
        	var newObj = angular.copy(section);
        	if ('pos' in newObj) delete newObj.pos;
        	newObj.aligntype = dlgScope.data.aligntype.id;
        	newObj.style = dlgScope.data.style;

        	var sectionLayout = _layoutsFromBeautyString(dlgScope.data.sectionLayout);
        	for(var i=0; i<sectionLayout.length; i++) {
        		if(section.pos === i) sectionLayout.splice(i, 1, newObj);
        	}
        	dlgScope.data.sectionLayout = _beautyStringifyLayouts(sectionLayout);
        	_onLayoutEditDone(dlgScope);
        };
        
        dlgScope.onEditLayoutClose = function() {
        	dlgScope.data.onSectionClick = false;
        };
    }

	function _showPopupDlg(dlg, resolve, page) {
        var sd = dlg.scope.data;
        var okButton = {text: nl.t('OK'), onTap: function(e) {
            if (e) e.preventDefault();
        	if(!page) {
	            resolve({pt:sd.layout.id, layout: _layoutsFromBeautyString(sd.sectionLayout)});
    		    dlg.close();
    		    return;
        	}
        	
    		var msg = {title: 'Please confirm', 
        			   template: 'Changing page type may result in loss of data. Do you want to proceed?'};
	        nlDlg.popupConfirm(msg).then(function(confirm) {
    		    if (!confirm) return;
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
        	aligntype: {name: nl.t('Aligntype'), help: nl.t('specifies the section alignment either left aligned or middle aligned')},
        	style: {name: nl.t('Style'), help:nl.t('specifies section styles')},
        	hozAlignment: {name:nl.t('Horizontal alignment'), help:nl.t('Set the horizontal alignment of the section')}
        };  
    }
    
    var _pageTypes = [];    
    var _layouts = {};
    function _initPageTypesAndLayouts() {
        for(var i=0; i<ptInfo.interactions.length; i++) {
            var inter = ptInfo.interactions[i];
            _pageTypes.push({id: inter.id, name: inter.desc});
            var layouts = ptInfo.interactionToLayouts[inter.id] || [];
            _layouts[inter.id] = [];
            for(var j=0; j<layouts.length; j++) {
                _layouts[inter.id].push({id: layouts[j].pagetype_id, name: layouts[j].desc});
            }
        }
    }

    function _onPtChange(dlgScope, defPt) {
        dlgScope.options.layout = _layouts[dlgScope.data.pagetype.id];
        dlgScope.data.layout = defPt ? {id: defPt.pt.id} : dlgScope.options.layout[0];
        _onLayoutChange(dlgScope, defPt);
    }

    function _onLayoutChange(dlgScope, defPt) {
        var pt = ptInfo.ptMap[dlgScope.data.layout.id];
        var layoutObj = defPt ? defPt.layout : pt.layout;
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
            dlgScope.sections.push({t:layout.t, l:layout.l, h:layout.h, w:layout.w, 
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


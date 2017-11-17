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
    
    this.showDlg = function(page, isPopup) {
        return _dlg.show(page, isPopup);
    };
}];
    
//-------------------------------------------------------------------------------------------------
function AddPageDlg(ptInfo, nl, nlDlg) {
    
    var _lastSelectedPageType = null;
	this.show = function(page, isPopup) {
		return nl.q(function(resolve, reject) {
            var parentScope = nl.rootScope;
            var dlg = nlDlg.create(parentScope);
            dlg.setCssClass('nl-height-max nl-width-max');
            _initDlgScope(dlg.scope, page, isPopup);
			_showDlg(dlg, resolve, page);
		});
	};
	
    function _initDlgScope(dlgScope, page, isPopup) {
        dlgScope.showHelp = '0';
        dlgScope.showClose = '1';
        dlgScope.dlgTitle = nl.fmt2(page ?  'Change {}Page Layout' : 'Add {}Page', (isPopup ? 'Popup ': ''));

        dlgScope.data = {};
        dlgScope.options = {};
        dlgScope.help = _getHelp();

        var defPt = page ? page.pagetype.pt : _lastSelectedPageType;
        var defSectionLayout = page ? page.pagetype.layout : null;

        dlgScope.options.pagetype = _pageTypes;
        dlgScope.data.pagetype = defPt ? {id: defPt.interaction} : dlgScope.options.pagetype[0];
        _onPtChange(dlgScope, defPt, defSectionLayout);

        dlgScope.onFieldChange = function(fieldId) {
            if (fieldId == 'pagetype') _onPtChange(dlgScope);
            else if (fieldId == 'layout') _onLayoutChange(dlgScope);
        };
        
        dlgScope.editLayoutDone = function() {
        	dlgScope.data.showLayoutEdit = false;
        	_onLayoutEditDone(dlgScope);
        };
    }

	function _showDlg(dlg, resolve, page) {
        var sd = dlg.scope.data;
        var okButton = {text: nl.t('OK'), onTap: function(e) {
            if (e) e.preventDefault();
        	if(!page) {
                _lastSelectedPageType = _layoutDict[sd.layout.id];
	            resolve({pt:sd.layout.id, layout: _layoutsFromBeautyString(sd.sectionLayout)});
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
            dlgScope.sections.push({t:layout.t, l:layout.l, h:layout.h, w:layout.w});
        }
	}
    
	function _layoutsFromBeautyString(beautyStr) {
		return angular.fromJson('[' + beautyStr + ']');
	}
	
	function _beautyStringifyLayouts(layoutsObj) {
		var jsonStr = '';
		for (var i=0; i<layoutsObj.length; i++) {
			var secLayout = layoutsObj[i];
			jsonStr += _BeautyStringifyLayout(secLayout, i);
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
	function _BeautyStringifyLayout(secLayout, i) {
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


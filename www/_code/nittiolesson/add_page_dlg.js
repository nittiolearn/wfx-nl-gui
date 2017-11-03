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
    
	this.show = function(page, isPopup) {
		return nl.q(function(resolve, reject) {
            var parentScope = nl.rootScope;
            var dlg = nlDlg.create(parentScope);
            dlg.setCssClass('nl-height-max nl-width-max');
            _initDlgScope(dlg.scope, page, isPopup);
			_showPopupDlg(dlg, resolve, page);
		});
	};
	
    function _initDlgScope(dlgScope, page, isPopup) {
        dlgScope.showHelp = '0';
        dlgScope.showClose = '1';
        dlgScope.dlgTitle = nl.fmt2(page ?  'Change {}Page Layout' : 'Add {}Page', (isPopup ? 'Popup ': ''));

        dlgScope.data = {};
        dlgScope.options = {};
        dlgScope.help = _getHelp();

        var defPt = page ? page.type : null;
        defPt = defPt ? ptInfo.ptMap[defPt] : null;

        dlgScope.options.pagetype = _pageTypes;
        dlgScope.data.pagetype = defPt ? {id: defPt.interaction} : dlgScope.options.pagetype[0];
        _onPtChange(dlgScope, defPt);

        dlgScope.onFieldChange = function(fieldId) {
            if (fieldId == 'pagetype') _onPtChange(dlgScope);
            else if (fieldId == 'layout') _onLayoutChange(dlgScope);
        };
    }

	function _showPopupDlg(dlg, resolve, page) {
        var sd = dlg.scope.data;
        var okButton = {text: nl.t('OK'), onTap: function(e) {
            resolve({pt:sd.layout.id});
        }};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
			resolve(false);
		}};
		dlg.show('nittiolesson/add_page_dlg.html', [okButton], cancelButton);
	}
	
    function _getHelp() {
        return {
            pagetype: {name: nl.t('Page Type'), help: nl.t('Page type')},
            layout: {name: nl.t('Layout'), help: nl.t('Layout')}
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
        dlgScope.data.layout = defPt ? {id: defPt.id} : dlgScope.options.layout[0];
        _onLayoutChange(dlgScope);
    }

    function _onLayoutChange(dlgScope) {
        var pt = ptInfo.ptMap[dlgScope.data.layout.id];
        dlgScope.sections = [];
        for(var i=0; i<pt.layout.length; i++) {
            var layout = pt.layout[i];
            dlgScope.sections.push({t:layout.t, l:layout.l, h:layout.h, w:layout.w});
        }
    }
    
    function _init() {
        _initPageTypesAndLayouts();
    }
    _init();
}

//-------------------------------------------------------------------------------------------------
module_init();
})();


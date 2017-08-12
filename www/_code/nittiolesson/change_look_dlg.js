(function() {

//-------------------------------------------------------------------------------------------------
// change_look_dlg.js:
// change look -> page properties dlg module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.nittiolesson.change_look', [])
	.service('NittioLessonChangeLookDlg', NittioLessonChangeLookSrv);
}

//-------------------------------------------------------------------------------------------------
var NittioLessonChangeLookSrv = ['nl', 'nlDlg',
function(nl, nlDlg) {
	var _oLesson = null;
	var _templateList = null;
	var _customBgShade = [{id: 'bglight', name: 'Dark text color for lighter background'},
		{id: 'bgdark', name: 'Light text color for darker background'}];
	this.init = function(oLesson, moduleConfig) {
		_oLesson = oLesson;
	};
	
	this.showDlg = function(templateList) {
		_templateList = templateList;
		return nl.q(function(resolve, reject) {
			 _showDlg(resolve);
		});
	};
	
	function _showDlg(resolve) {
		var parentScope = nl.rootScope;
		var changeLookDlg = nlDlg.create(parentScope);
		changeLookDlg.setCssClass('nl-height-max nl-width-max');
		var dlgScope = changeLookDlg.scope;
		dlgScope.dlgTitle = nl.t('Change look');

		var selected = _getSelected();
		dlgScope.data = {};
		dlgScope.data.showHelp = {};
		dlgScope.options = {templateList: _templateList, customBgShade: _customBgShade};
		dlgScope.data.templateList = selected;
		dlgScope.data.customBgShade = selected.bgShade == "bgdark" ? _customBgShade[1] : _customBgShade[0];
		dlgScope.data.customUrl = selected.id == 'Custom' ? selected.bgImg : ''; 

		dlgScope.templateList = {id: 'templateList', name: 'Background', type: 'select',
			help: 'Choose the background template for the whole module from a rich set of options. Try "Custom" when you are not satisfied with the provided options.'};
		dlgScope.customUrl = {id: 'customUrl', name: 'Image URL', type: 'string',
			help: 'If you select "Custom" background, you can enter the URL (link) of the custom image. The URL could be an image uploaded within the system or a link to external source in internet.'};
		dlgScope.customBgShade = {id: 'customBgShade', name: 'Text Color', type: 'select',
			help: 'Depending on whether your image is dark or light, you can set the text color to one which is clearly visible in the background. With this, you can control the colors used for different types of text (normal, heading, link, ...)'};

		dlgScope.onFieldChange = function(fieldModel) {
			console.log('onFieldChange', fieldModel);
			if(fieldModel == 'customBgShade') return _onCustomChange();
			if(fieldModel == 'customUrl') return _onCustomChange();
		};
		
		function _onCustomChange() {
			var custom = _templateList[0];
			custom.bgImg = dlgScope.data.customUrl;
			custom.bgShade = dlgScope.data.customBgShade.id;
		};

		var okButton = {text: nl.t('Change'), onTap: function(e) {
			var selected = dlgScope.data.templateList;
			selected.cssClass = nl.fmt2('{} look{}', selected.bgShade, selected.id);
        	_oLesson.template = (selected.id == 'Custom') ?  nl.fmt2('img:{}[{}]', selected.bgImg, selected.bgShade) : selected.id;
			resolve(selected);
		}};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
			resolve(false);
		}};
		changeLookDlg.show('nittiolesson/change_look_dlg.html', [okButton], cancelButton);
	}

	function _getSelected() {
		var selected = _oLesson.template || '';
		if (selected.indexOf('img:') == 0) {
			var ret = _templateList[0];
			var index = selected.indexOf('[');
	        ret.bgImg = selected.substring(4, index);
	        ret.bgShade = selected.substring(index+1, selected.length-1);
	        return ret;			
		}
		for(var i in _templateList) {
			var item = _templateList[i];
			if(item.id == selected) return item;
		}
		return _templateList[1];
	}
}];
//-------------------------------------------------------------------------------------------------
module_init();
})();
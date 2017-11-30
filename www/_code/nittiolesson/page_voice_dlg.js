(function() {

//-------------------------------------------------------------------------------------------------
// page_voice_dlg.js:
// page_voice_dlg for adding/modify page voice
// Used from Module Editor/Viewer via nittiolesson.js 
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.nittiolesson.page_voice', [])
	.service('NittioLessonAddPageVoice', NittioLessonAddPageVoiceDlg);
}

//-------------------------------------------------------------------------------------------------
var NittioLessonAddPageVoiceDlg = ['nl', 'nlDlg', 'nlResourceAddModifySrv',
function(nl, nlDlg, nlResourceAddModifySrv) {
	var _restypes = null;
	this.showAddVoiceDlg = function(oPage, restypes) {
		_restypes = restypes;
		return nl.q(function(resolve, reject) {
			 _showDlg(oPage, resolve);
		});
	};

	function _showDlg(oPage, resolve) {
		var parentScope = nl.rootScope;
		var pageVoiceDlg = nlDlg.create(parentScope);
		pageVoiceDlg.setCssClass('nl-height-max nl-width-max');
		var dlgScope = pageVoiceDlg.scope;
		dlgScope.data = {};
		dlgScope.data.dlgTitle = nl.t('Page voice');
		dlgScope.data.audioUrl = oPage.audioUrl ? oPage.audioUrl : '';
		dlgScope.data.autoVoice = oPage.autoVoice ? oPage.autoVoice : '';

        dlgScope.help = _getHelp();
		
		dlgScope.clickOnMoreOptions = function() {
			nlResourceAddModifySrv.insertOrUpdateResource(parentScope, 
            _restypes, 'audio:' + dlgScope.data.audioUrl, false).then(function(url) {
            	if(url) dlgScope.data.audioUrl = url;
            });
		};
		
		var okButton = {text: nl.t('Change'), onTap: function(e) {
				oPage.audioUrl = dlgScope.data.audioUrl;
				oPage.autoVoice = dlgScope.data.autoVoice;
				resolve(oPage);
			}
		};
		
		var cancelButton = {text: nl.t('Close')};
		pageVoiceDlg.show('nittiolesson/page_voice_dlg.html', [okButton], cancelButton);
	}

    function _getHelp() {
        return {
            audioUrl: {name: nl.t('Page Audio URL'), help: nl.t('Provide background audio to play when the page is displayed')},
            autoVoice: {name: nl.t('Page Voice Script'), 
            	help: nl.t('<p>Provide text that should be played as audio when the page is displayed.</p>'
                + '<p>Keep each line short. Use ",", "." and new line to control the pauses.</p>'
                + '<p>You can also control the voice, language, rate, and pitch using the "@voice()" command. For example, type in the below line as first line in your text to get male, UK English voice spoken in lower pitch and faster rate:</p>'
                + '<p class="fblack">@voice( male,UK,lang=en,rate=2,pitch=0.6)</p>'
                + '<p><b>lang:</b> "en" is "English", "hi" is "Hindi", "zh" is "Chinese". Actual languages supported depends on the browser.</p>'
                + '<p><b>rate:</b> Any number between 0.1 and 10 (1 is normal speed)</p>'
                + '<p><b>pitch:</b> Any number between 0 and 2 (1 is normal pitch)</p>')}
        };  
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

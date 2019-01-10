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
var NittioLessonAddPageVoiceDlg = ['nl', 'nlDlg', 'nlResourceAddModifySrv', 'nlTreeSelect', 'nlServerApi',
function(nl, nlDlg, nlResourceAddModifySrv, nlTreeSelect, nlServerApi) {
	var _restypes = null;
	var _lessonId = null;
	var _resourceDict = {};
	var _oLesson = null;
	var _oPage = null;
	var _languageArrayParams = []
	var _amazonPollyVoicesInfo = [];
	var _amazonPollyVoices = [{id:'cmn-CN_Zhiyu', name:'Female: Zhiyu', group:'Chinese, Mandarin'},
		{id:'da-DK_Naja', name:'Female: Naja', group:'Danish'},
		{id:'da-DK_Mads', name:'Male: Mads', group:'Danish'},
		{id:'nl-NL_Lotte', name:'Female: Lotte', group:'Dutch'},
		{id:'nl-NL_Ruben', name:'Male: Ruben', group:'Dutch'},
		{id:'en-AU_Nicole', name:'Female: Nicole', group:'English, Australian'},
		{id:'en-AU_Russell', name:'Male: Russell', group:'English, Australian'},
		{id:'en-GB_Amy', name:'Female: Amy', group:'English, British'},
		{id:'en-GB_Emma', name:'Female: Emma', group:'English, British'},
		{id:'en-GB_Brian', name:'Male: Brian', group:'English, British'},
		{id:'en-IN_Aditi', name:'Female: Aditi (bilingual with Hindi)', group:'English, Indian'},
		{id:'en-IN_Raveena', name:'Female: Raveena', group:'English, Indian'},
		{id:'en-US_Ivy', name:'Female: Ivy', group:'English, US'},
		{id:'en-US_Joanna', name:'Female: Joanna', group:'English, US'},
		{id:'en-US_Kendra', name:'Female: Kendra', group:'English, US'},
		{id:'en-US_Kimberly', name:'Female: Kimberly', group:'English, US'},
		{id:'en-US_Salli', name:'Female: salli', group:'English, US'},
		{id:'en-US_Joey', name:'Male: Joey', group:'English, US'},
		{id:'en-US_Justin', name:'Male: Justin', group:'English, US'},
		{id:'en-US_Matthew', name:'Male: Matthew', group:'English, US'},
		{id:'en-GB-WLS_Geraint', name:'Male: Geraint', group:'English, Welsh'},
		{id:'fr-FR_Céline', name:'Female: Céline', group:'French'},
		{id:'fr-FR_Léa', name:'Female: Léa', group:'French'},
		{id:'fr-FR_Mathieu', name:'Male: Mathieu', group:'French'},
		{id:'fr-CA_Chantal', name:'Female: Chantal', group:'French, Canadian'},
		{id:'de-DE_Marlene', name:'Female: Marlene', group:'German'},
		{id:'de-DE_Vicki', name:'Female: Vicki', group:'German'},
		{id:'de-DE_Hans', name:'Male: Hans', group:'German'},
		{id:'hi-IN_Aditi', name:'Female: Aditi (bilingual with Indian English)', group:'Hindi'},
		{id:'is-IS_Dóra', name:'Female: Dóra/Dora', group:'Icelandic'},
		{id:'is-IS_Karl', name:'Male: Karl', group:'Icelandic'},
		{id:'it-IT_Carla', name:'Female: Carla', group:'Italian'},
		{id:'it-IT_Bianca', name:'Female: Bianca', group:'Italian'},
		{id:'it-IT_Giorgio', name:'Male: Giorgio', group:'Italian'},
		{id:'ja-JP_Mizuki', name:'Female: Mizuki', group:'Japanese'},
		{id:'ja-JP_Takumi', name:'Male: Takumi', group:'Japanese'},
		{id:'ko-KR_Seoyeon', name:'Female: Seoyeon', group:'Korean'},
		{id:'nb-NO_Liv', name:'Female: Liv', group:'Norwegian'},
		{id:'pl-PL_Ewa', name:'Female: Ewa', group:'Polish'},
		{id:'pl-PL_Maja', name:'Female: Maja', group:'Polish'},
		{id:'pl-PL_Jacek', name:'Male: Jacek', group:'Polish'},
		{id:'pl-PL_Jan', name:'Male: Jan', group:'Polish'},
		{id:'pt-BR_Vitória', name:'Female: Vitória/Vitoria', group:'Portuguese, Brazilian'},
		{id:'pt-BR_Ricardo', name:'Male: Ricardo', group:'Portuguese, Brazilian'},
		{id:'pt-PT_Inês', name:'Female: Inês/Ines', group:'Portuguese, European'},
		{id:'pt-PT_Cristiano', name:'Male: Cristiano', group:'Portuguese, European'},
		{id:'ro-RO_Carmen', name:'Female: Inês/Ines', group:'Romanian'},
		{id:'ru-RU_Tatyana', name:'Female: Tatyana', group:'Russian'},
		{id:'ru-RU_Maxim', name:'Male: Maxim', group:'Russian'},
		{id:'es-ES_Conchita', name:'Female: Conchita', group:'Spanish, European'},
		{id:'es-ES_Lucia', name:'Female: Lucia', group:'Spanish, European'},
		{id:'es-ES_Enrique', name:'Male: Enrique', group:'Spanish, European'},
		{id:'es-MX_Mia', name:'Female: Mia', group:'Spanish, Mexican'},
		{id:'es-US_Penélope', name:'Female: Penélope/Penelope', group:'Spanish, US'},
		{id:'es-US_Miguel', name:'Male: Miguel', group:'Spanish, US'},
		{id:'sv-SE_Astrid', name:'Female: Astrid', group:'Swedish'},
		{id:'tr-TR_Filiz', name:'Female: Filiz', group:'Turkish'},
		{id:'cy-GB_Gwyneth', name:'Female: Gwyneth', group:'Welsh'}
	]

	this.init = function(oLesson) {
		_oLesson = oLesson;
	}

	this.showAddVoiceDlg = function(oPage, restypes, resourceDict, lessonId) {
		_restypes = restypes;
		_lessonId = lessonId;
		_resourceDict = resourceDict;
		_oPage = oPage;
		_languageArrayParams = _getLanguageTree('');
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
		dlgScope._amazonPollyVoicesInfo = _amazonPollyVoicesInfo;
		dlgScope.options = {amazonpollyvoices: _amazonPollyVoicesInfo};
		dlgScope.autoVoiceProvider = false;
		dlgScope.help = _getHelp();
		if(oPage.autoVoicePolly && oPage.autoVoicePolly.length > 0) {
			dlgScope.data.autoVoicePolly = [];
			_updateAutoVoicePolly(dlgScope);
		} else {
			var _amazonPollyVoicesInfo = {data: _languageArrayParams[0] || []};
			nlTreeSelect.updateSelectionTree(_amazonPollyVoicesInfo, {}, 0);
			_amazonPollyVoicesInfo.treeIsShown = false;
			_amazonPollyVoicesInfo.multiSelect = false;
			dlgScope.data.autoVoicePolly = [{voiceLanguageInfo: _amazonPollyVoicesInfo, type: {id: 'autovoice'}, text: '', lang: '', voice: '', delay: 0, mp3: '', options: [{id: 'audio', name:'Audio url'}, {id: 'autovoice', name: 'Automatic voice generation'}]}]
		}
		if(_oLesson.autoVoiceProvider && (_oLesson.autoVoiceProvider == 'polly')) {
			dlgScope.autoVoiceProvider = true;
			dlgScope.options['pageAudioType'] = [{id: 'audio', name:'Audio url'}, {id: 'autovoice', name: 'Automatic voice generation'}];
			dlgScope.data.pageAudioType = dlgScope.options.pageAudioType[1];
		} else {
			dlgScope.data.audioUrl = oPage.audioUrl ? oPage.audioUrl : '';
			dlgScope.data.autoVoice = oPage.autoVoice ? oPage.autoVoice : '';			
			dlgScope.clickOnMoreOptions = function() {
				nlResourceAddModifySrv.insertOrUpdateResource(parentScope, 
				_restypes, 'audio:' + dlgScope.data.audioUrl, false, _resourceDict, false, _lessonId).then(function(result) {
					if(result && result.url) dlgScope.data.audioUrl = result.url;
				});
			};
		}	
		//Auto voice using amazon poly related code goes from here

		dlgScope.data.addPollyVoiceField = function() {
			if(dlgScope.data.autoVoicePolly.length == 0) {
				dlgScope.data.autoVoicePolly.push({voiceLanguageInfo: angular.copy(_amazonPollyVoicesInfo), type:{id: 'autovoice'}, text: '', lang: '', voice: '', delay: 0, mp3: '', options: [{id: 'audio', name:'Audio url'}, {id: 'autovoice', name: 'Automatic voice generation'}]});
				return;
			}
			var lastSelected = dlgScope.data.autoVoicePolly[dlgScope.data.autoVoicePolly.length - 1];
			var voiceSelected = Object.keys(nlTreeSelect.getSelectedIds(lastSelected.voiceLanguageInfo))[0];
			if(lastSelected.type.id == "voice" && !voiceSelected) 
				return nlDlg.popupAlert({title: 'Error message', template: 'Please select language to be played.'});

			if(lastSelected.type.id == "audio" && !lastSelected.mp3) 
				return nlDlg.popupAlert({title: 'Error message', template: 'Please add the mp3 for current fragment'});

			if(lastSelected.type.id == "voice" && !lastSelected.text) 
				return nlDlg.popupAlert({title: 'Error message', template: 'Please add the text for autovoice'});
			dlgScope.data.autoVoicePolly.push({voiceLanguageInfo: angular.copy(lastSelected.voiceLanguageInfo), type:{id: 'autovoice'}, text: '', lang: '', voice: '', delay: 0, mp3: '', options:[{id: 'audio', name:'Audio url'}, {id: 'autovoice', name: 'Automatic voice generation'}]});
		};

		dlgScope.selectAudioUrl = function(index) {
			var selectedItem = dlgScope.data.autoVoicePolly[index];
			if(selectedItem.type.id == 'autovoice') return;
			nlResourceAddModifySrv.insertOrUpdateResource(parentScope, 
				_restypes, 'audio:' + dlgScope.data.audioUrl, false, _resourceDict, false, _lessonId).then(function(result) {
				if(result && result.url) {
					dlgScope.data.audioUrl = result.url;
					selectedItem['type'] = {id: 'audio'};
					selectedItem['mp3'] = result.url;
				} else {
					if(!selectedItem['mp3']) {
						selectedItem['type'] = {id: 'autovoice'};
					}
				}
			});
		}
		var okButton = {text: nl.t('Change'), onTap: function(e) {
				e.preventDefault();
				if(dlgScope.autoVoiceProvider) {
					if(!_validateInputs(dlgScope.data)) {
						return;
					}
					oPage.autoVoicePolly = [];
					nlDlg.showLoadingScreen();
					var currentPos = 0;
					_getAudioUrlFromServer(newAutovoiceArray, currentPos, oPage, resolve);
				} else {
					oPage.audioUrl = dlgScope.data.audioUrl;
					oPage.autoVoice = dlgScope.data.autoVoice;
					resolve(oPage);
					nlDlg.closeAll();
				}
			}
		};
		
		var cancelButton = {text: nl.t('Close')};
		pageVoiceDlg.show('nittiolesson/page_voice_dlg.html', [okButton], cancelButton);
	}
	
	function _getAudioUrlFromServer(newAutovoiceArray, currentPos, oPage, resolve) {
		if(currentPos >= newAutovoiceArray.length) {
			nlDlg.hideLoadingScreen();
			resolve(oPage);
			nlDlg.closeAll();
			return;
		}
		var fragment = newAutovoiceArray[currentPos];
		if(fragment.type == 'audio') {
			oPage.autoVoicePolly.push(fragment);
			_getAudioUrlFromServer(newAutovoiceArray, currentPos+1, oPage, resolve);
			return;
		}
		var data = {text: fragment.text, voice_lang: fragment.lang, voice_id: fragment.voice};
		nlServerApi.getAudioUrl(data).then(function(result) {
			fragment['mp3'] = result.url;
			oPage.autoVoicePolly.push(fragment);
			_getAudioUrlFromServer(newAutovoiceArray, currentPos+1, oPage, resolve);
			return;
		});
	}

	function _updateAutoVoicePolly(dlgScope) {
		for(var i=0; i< _oPage.autoVoicePolly.length; i++) {
			var fragment = _oPage.autoVoicePolly[i];
			var arrayParams = angular.copy(_languageArrayParams);
			var _amazonPollyVoicesInfo = {data: arrayParams[0] || []};
			var selectedIds = {};
			if(fragment.type == 'autovoice') {
				var selectedId = fragment.lang+'_'+fragment.voice ;
				selectedIds = _getLeafNodeIds(selectedId);
			}
			nlTreeSelect.updateSelectionTree(_amazonPollyVoicesInfo, selectedIds, 0);
			_amazonPollyVoicesInfo.treeIsShown = false;
			_amazonPollyVoicesInfo.multiSelect = false;
			dlgScope.data.autoVoicePolly.push({voiceLanguageInfo: _amazonPollyVoicesInfo, delay: fragment.delay || 0, type: {id: fragment.type}, text: fragment.text || '', lang: fragment.lang || '', voice: fragment.voice || '', mp3: fragment.mp3, options: [{id: 'audio', name:'Audio url'}, {id: 'autovoice', name: 'Automatic voice generation'}]});
		}
	}

	function _getLeafNodeIds(selectedId) {
		for(var key in itemIdDict) {
			if(key.indexOf(selectedId) > 0) {
				var dict = {}
				dict[key] = true
				return dict;
			}
		}
	}

	var newAutovoiceArray = [];
	function _validateInputs(data) {
		newAutovoiceArray = [];
		for(var i=0; i<data.autoVoicePolly.length; i++) {
			var fragment = data.autoVoicePolly[i];
			var selectedVoice = null;
			if(fragment.type.id == 'audio') {
				if(!fragment.mp3) {
					nlDlg.popupAlert({title: 'Validation error', template: nl.t('The mp3 is missing in fragment {}', i)});
					return false;
				}
			}
			if(fragment.type.id == 'autovoice') {
				if(!fragment.text) {
					nlDlg.popupAlert({title: 'Validation error', template: nl.t('The auto voice text is missing in fragment {}', i)});
					return false;
				}
				selectedVoice = Object.keys(nlTreeSelect.getSelectedIds(fragment.voiceLanguageInfo))[0];
				if(!selectedVoice) {
					nlDlg.popupAlert({title: 'Validation error', template: nl.t('The auto voice language type is missing in fragment {}', i)});
					return false;
				}
			}
			var selectedLang = null;
			if(selectedVoice) {
				selectedVoice = selectedVoice.split('.');
				selectedLang = selectedVoice[1].split('_');
			}
			newAutovoiceArray.push({type: fragment.type.id, text: fragment.text || '', lang: selectedLang ? selectedLang[0] : '', voice: selectedLang ? selectedLang[1] : '', mp3:fragment.mp3 || '', delay: fragment.delay || 0});
		}
		return true;
	}

	var itemIdDict = {};
	function _getLanguageTree() {
        var insertedKeys = {};
        var selectedLangId = {};
        var treeArray = [];
        for(var i=0; i<_amazonPollyVoices.length; i++) {
            var itemObj = _amazonPollyVoices[i];
            _getIconNodeWithParents(itemObj, treeArray, insertedKeys);
        }
        return [treeArray, selectedLangId];
    }

    function _getIconNodeWithParents(itemObj, treeArray, insertedKeys) {
        if (itemObj.group && !insertedKeys[itemObj.group]) {
        	insertedKeys[itemObj.group] = true;
        	treeArray.push({id: itemObj.group, name: itemObj.group, isOpen: true});
		}
		var itemId = itemObj.group ? itemObj.group + '.' + itemObj.id : itemObj.id;
		itemIdDict[itemId] = true;
        if (insertedKeys[itemId]) return;
    	insertedKeys[itemId] = true;        
        treeArray.push({id: itemId, name: itemObj.name, origId: itemObj.id});
    }

    function _getHelp() {
        return {
			pageAudioType: {name: nl.t('Play audio from'), help: nl.t('Please select the mode of audio to be added to this page.'), isShown: false},
			languageInfo: {name: nl.t('Select the language'), help: nl.t('Please select the mode of audio to be added to this page.'), isShown: false},
			audioUrl: {name: nl.t('Page Audio URL'), help: nl.t('Provide background audio to play when the page is displayed')},
			voicetext: {name: nl.t('Autovoice text'), help: nl.t('Provide the autovoice to play for the page.'), isShown: false},
			delay: {name: nl.t('Voice delay(seconds)'), help: nl.t('Delay before the voice is played.'), isShown: false},
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
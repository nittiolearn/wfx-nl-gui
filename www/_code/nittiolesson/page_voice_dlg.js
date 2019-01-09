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
	var _amazonPollyVoices = [{id:'cmn-CN_Zhiyu', name:'Zhiyu', group:'Chinese, Mandarin', subgroup: 'Female'},
		{id:'da-DK_Naja', name:'Naja', group:'Danish', subgroup: 'Female'},
		{id:'da-DK_Mads', name:'Mads', group:'Danish', subgroup: 'Male'},
		{id:'nl-NL_Lotte', name:'Lotte', group:'Dutch', subgroup: 'Female'},
		{id:'nl-NL_Ruben', name:'Ruben', group:'Dutch', subgroup: 'Male'},
		{id:'en-AU_Nicole', name:'Nicole', group:'English, Australian', subgroup: 'Female'},
		{id:'en-AU_Russell', name:'Russell', group:'English, Australian', subgroup: 'Male'},
		{id:'en-GB_Amy', name:'Amy', group:'English, British', subgroup: 'Female'},
		{id:'en-GB_Emma', name:'Emma', group:'English, British', subgroup: 'Female'},
		{id:'en-GB_Brian', name:'Brian', group:'English, British', subgroup: 'Male'},
		{id:'en-IN_Aditi', name:'Aditi (bilingual with Hindi)', group:'English, Indian', subgroup: 'Female'},
		{id:'en-IN_Raveena', name:'Raveena', group:'English, Indian', subgroup: 'Female'},
		{id:'en-US_Ivy', name:'Ivy', group:'English, US', subgroup: 'Female'},
		{id:'en-US_Joanna', name:'Joanna', group:'English, US', subgroup: 'Female'},
		{id:'en-US_Kendra', name:'Kendra', group:'English, US', subgroup: 'Female'},
		{id:'en-US_Kimberly', name:'Kimberly', group:'English, US', subgroup: 'Female'},
		{id:'en-US_Salli', name:'salli', group:'English, US', subgroup: 'Female'},
		{id:'en-US_Joey', name:'Joey', group:'English, US', subgroup: 'Male'},
		{id:'en-US_Justin', name:'Justin', group:'English, US', subgroup: 'Male'},
		{id:'en-US_Matthew', name:'Matthew', group:'English, US', subgroup: 'Male'},
		{id:'en-GB-WLS_Geraint', name:'Geraint', group:'English, Welsh', subgroup: 'Male'},
		{id:'fr-FR_Céline', name:'Céline', group:'French', subgroup: 'Female'},
		{id:'fr-FR_Léa', name:'Léa', group:'French', subgroup: 'Female'},
		{id:'fr-FR_Mathieu', name:'Mathieu', group:'French', subgroup: 'Male'},
		{id:'fr-CA_Chantal', name:'Chantal', group:'French, Canadian', subgroup: 'Female'},
		{id:'de-DE_Marlene', name:'Marlene', group:'German', subgroup: 'Female'},
		{id:'de-DE_Vicki', name:'Vicki', group:'German', subgroup: 'Female'},
		{id:'de-DE_Hans', name:'Hans', group:'German', subgroup: 'Male'},
		{id:'hi-IN_Aditi', name:'Aditi (bilingual with Indian English)', group:'Hindi', subgroup: 'Female'},
		{id:'is-IS_Dóra', name:'Dóra/Dora', group:'Icelandic', subgroup: 'Female'},
		{id:'is-IS_Karl', name:'Karl', group:'Icelandic', subgroup: 'Male'},
		{id:'it-IT_Carla', name:'Carla', group:'Italian', subgroup: 'Female'},
		{id:'it-IT_Bianca', name:'Bianca', group:'Italian', subgroup: 'Female'},
		{id:'it-IT_Giorgio', name:'Giorgio', group:'Italian', subgroup: 'Male'},
		{id:'ja-JP_Mizuki', name:'Mizuki', group:'Japanese', subgroup: 'Female'},
		{id:'ja-JP_Takumi', name:'Takumi', group:'Japanese', subgroup: 'Male'},
		{id:'ko-KR_Seoyeon', name:'Seoyeon', group:'Korean', subgroup: 'Female'},
		{id:'nb-NO_Liv', name:'Liv', group:'Norwegian', subgroup: 'Female'},
		{id:'pl-PL_Ewa', name:'Ewa', group:'Polish', subgroup: 'Female'},
		{id:'pl-PL_Maja', name:'Maja', group:'Polish', subgroup: 'Female'},
		{id:'pl-PL_Jacek', name:'Jacek', group:'Polish', subgroup: 'Male'},
		{id:'pl-PL_Jan', name:'Jan', group:'Polish', subgroup: 'Male'},
		{id:'pt-BR_Vitória', name:'Vitória/Vitoria', group:'Portuguese, Brazilian', subgroup: 'Female'},
		{id:'pt-BR_Ricardo', name:'Ricardo', group:'Portuguese, Brazilian', subgroup: 'Male'},
		{id:'pt-PT_Inês', name:'Inês/Ines', group:'Portuguese, European', subgroup: 'Female'},
		{id:'pt-PT_Cristiano', name:'Cristiano', group:'Portuguese, European', subgroup: 'Male'},
		{id:'ro-RO_Carmen', name:'Inês/Ines', group:'Romanian', subgroup: 'Female'},
		{id:'ru-RU_Tatyana', name:'Tatyana', group:'Russian', subgroup: 'Female'},
		{id:'ru-RU_Maxim', name:'Maxim', group:'Russian', subgroup: 'Male'},
		{id:'es-ES_Conchita', name:'Conchita', group:'Spanish, European', subgroup: 'Female'},
		{id:'es-ES_Lucia', name:'Lucia', group:'Spanish, European', subgroup: 'Female'},
		{id:'es-ES_Enrique', name:'Enrique', group:'Spanish, European', subgroup: 'Male'},
		{id:'es-MX_Mia', name:'Mia', group:'Spanish, Mexican', subgroup: 'Female'},
		{id:'es-US_Penélope', name:'Penélope/Penelope', group:'Spanish, US', subgroup: 'Female'},
		{id:'es-US_Miguel', name:'Miguel', group:'Spanish, US', subgroup: 'Male'},
		{id:'sv-SE_Astrid', name:'Astrid', group:'Swedish', subgroup: 'Female'},
		{id:'tr-TR_Filiz', name:'Filiz', group:'Turkish', subgroup: 'Female'},
		{id:'cy-GB_Gwyneth', name:'Gwyneth', group:'Welsh', subgroup: 'Female'}
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
			dlgScope.data.autoVoicePolly = [{voiceLanguageInfo: _amazonPollyVoicesInfo, type: {id: 'autovoice'}, text: '', lang: '', voice: '', delay: 0, mp3: '', options: [{id: 'audio', name:'Audio url'}, {id: 'autovoice', name: 'Auto voice'}]}]
		}
		if(_oLesson.autoVoiceProvider && (_oLesson.autoVoiceProvider == 'polly')) {
			dlgScope.autoVoiceProvider = true;
			dlgScope.options['pageAudioType'] = [{id: 'audio', name:'Audio url'}, {id: 'autovoice', name: 'Auto voice'}];
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
				dlgScope.data.autoVoicePolly.push({voiceLanguageInfo: angular.copy(_amazonPollyVoicesInfo), type:{id: 'autovoice'}, text: '', lang: '', voice: '', delay: 0, mp3: '', options: [{id: 'audio', name:'Audio url'}, {id: 'autovoice', name: 'Auto voice'}]});
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
			dlgScope.data.autoVoicePolly.push({voiceLanguageInfo: angular.copy(_amazonPollyVoicesInfo), type:{id: 'autovoice'}, text: '', lang: '', voice: '', delay: 0, mp3: '', options:[{id: 'audio', name:'Audio url'}, {id: 'autovoice', name: 'Auto voice'}]});
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
			if(fragment.type == 'autovoice') {
				var selectedId = fragment.lang+'_'+fragment.voice ;
				var selectedIds = _getLeafNodeIds(selectedId);
				nlTreeSelect.updateSelectionTree(_amazonPollyVoicesInfo, selectedIds, 0);
				_amazonPollyVoicesInfo.treeIsShown = false;
				_amazonPollyVoicesInfo.multiSelect = false;
				dlgScope.data.autoVoicePolly.push({voiceLanguageInfo: _amazonPollyVoicesInfo, delay: fragment.delay, type: {id: 'autovoice'}, text: fragment.text, lang: fragment.lang, voice: fragment.voice, mp3: fragment.mp3, options: [{id: 'audio', name:'Audio url'}, {id: 'autovoice', name: 'Auto voice'}]});
			} else {
				nlTreeSelect.updateSelectionTree(_amazonPollyVoicesInfo, {}, 0);
				_amazonPollyVoicesInfo.treeIsShown = false;
				_amazonPollyVoicesInfo.multiSelect = false;
				dlgScope.data.autoVoicePolly.push({voiceLanguageInfo: _amazonPollyVoicesInfo, delay: fragment.delay, type: {id: 'audio'}, text: fragment.text, lang: fragment.lang || '', voice: fragment.voice || '', mp3: fragment.mp3, options: [{id: 'audio', name:'Audio url'}, {id: 'autovoice', name: 'Auto voice'}]});
			}
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
				selectedVoice = selectedVoice.split('_');
				selectedLang = selectedVoice[0].split('.');
			}
			newAutovoiceArray.push({type: fragment.type.id, text: fragment.text || '', lang: selectedLang ? selectedLang[2] : '', voice: selectedVoice ? selectedVoice[1] : '', mp3:fragment.mp3 || '', delay: fragment.delay || 0});
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
		var subgroupid = itemObj.group+'.'+itemObj.subgroup;
        if (itemObj.group && !insertedKeys[itemObj.group]) {
        	insertedKeys[itemObj.group] = true;
        	treeArray.push({id: itemObj.group, name: itemObj.group, isOpen: true});
		}
		if (itemObj.subgroup && !insertedKeys[subgroupid]) {
        	insertedKeys[subgroupid] = true;
        	treeArray.push({id: subgroupid, name: itemObj.subgroup, isOpen: true});
		}
		var itemId = (itemObj.group && itemObj.subgroup) ? subgroupid + '.' + itemObj.id : itemObj.id;
		itemIdDict[itemId] = true;
        if (insertedKeys[itemId]) return;
    	insertedKeys[itemId] = true;        
        treeArray.push({id: itemId, name: itemObj.name, origId: itemObj.id});
    }

    function _getHelp() {
        return {
			pageAudioType: {name: nl.t('Play audio from'), help: nl.t('Please select the mode of audio to be added to this page.')},
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
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
	var _isPollyEnabled = false;
	var _defaultPollyVoice = 'en-IN_Aditi';
	var _amazonPollyVoices = [
		{id:'hi-IN_Aditi', name:'Hindi Female voice with bilingual Indian English: Aditi'},
		{id:'en-IN_Aditi', name:'English (Indian accent) Female voice with bilingual with Hindi: Aditi'},
		{id:'en-IN_Raveena', name:'English (Indian accent) Female voice: Raveena'},
		{id:'en-US_Ivy', name:'English (US accent) Female voice: Ivy'},
		{id:'en-US_Joanna', name:'English (US accent) Female voice: Joanna'},
		{id:'en-US_Kendra', name:'English (US accent) Female voice: Kendra'},
		{id:'en-US_Kimberly', name:'English (US accent) Female voice: Kimberly'},
		{id:'en-US_Salli', name:'English (US accent) Female voice: Salli'},
		{id:'en-US_Joey', name:'English (US accent) Male voice: Joey'},
		{id:'en-US_Justin', name:'English (US accent) Male voice: Justin'},
		{id:'en-US_Matthew', name:'English (US accent) Male voice: Mathew'},
		{id:'en-GB_Amy', name:'English (British accent) Female voice: Amy'},
		{id:'en-GB_Emma', name:'English (British accent) Female voice: Emma'},
		{id:'en-GB_Brian', name:'English (British accent) Male voice: Brian'},
		{id:'en-GB-WLS_Geraint', name:'English (Welsh accent) Male voice: Geraint'},
		{id:'en-AU_Nicole', name:'English (Australian accent) Female voice: Nicole'},
		{id:'en-AU_Russell', name:'English (Australian accent) Male voice: Russell'},
		{id:'cmn-CN_Zhiyu', name:'Chinese (Mandarin) Female voice: Zhiyu'},
		{id:'da-DK_Naja', name:'Danish Female voice: Naja'},
		{id:'da-DK_Mads', name:'Danish Male voice: Mads'},
		{id:'nl-NL_Lotte', name:'Dutch Female voice: Lotte'},
		{id:'nl-NL_Ruben', name:'Dutch Male voice: Ruben'},
		{id:'fr-FR_Céline', name:'French Female voice: Céline'},
		{id:'fr-FR_Léa', name:'French Female voice: Léa'},
		{id:'fr-FR_Mathieu', name:'French Male voice: Mathieu'},
		{id:'fr-CA_Chantal', name:'French, Canadian Female voice: Chantal'},
		{id:'de-DE_Marlene', name:'German Female voice: Marlene'},
		{id:'de-DE_Vicki', name:'German Female voice: Vicki'},
		{id:'de-DE_Hans', name:'German Male voice: Hans'},
		{id:'is-IS_Dóra', name:'Icelandic Female voice: Dóra/Dora'},
		{id:'is-IS_Karl', name:'Icelandic Male voice: Karl'},
		{id:'it-IT_Carla', name:'Italian Female voice: Carla'},
		{id:'it-IT_Bianca', name:'Italian Female voice: Bianca'},
		{id:'it-IT_Giorgio', name:'Italian Male voice: Giorgio'},
		{id:'ja-JP_Mizuki', name:'Japanese Female voice: Mizuki'},
		{id:'ja-JP_Takumi', name:'Japanese Male voice: Takumi'},
		{id:'ko-KR_Seoyeon', name:'Korean Female voice: Seoyeon'},
		{id:'nb-NO_Liv', name:'Norwegian Female voice: Liv'},
		{id:'pl-PL_Ewa', name:'Polish Female voice: Ewa'},
		{id:'pl-PL_Maja', name:'Polish Female voice: Maja'},
		{id:'pl-PL_Jacek', name:'Polish Male voice: Jacek'},
		{id:'pl-PL_Jan', name:'Polish Male voice: Jan'},
		{id:'pt-BR_Vitória', name:'Portuguese, Brazilian Female voice: Vitória/Vitoria'},
		{id:'pt-BR_Ricardo', name:'Portuguese, Brazilian Male voice: Ricardo'},
		{id:'pt-PT_Inês', name:'Portuguese, European Female voice: Inês/Ines'},
		{id:'pt-PT_Cristiano', name:'Portuguese, European Male voice: Cristiano'},
		{id:'ro-RO_Carmen', name:'Romanian Female voice: Inês/Ines'},
		{id:'ru-RU_Tatyana', name:'Russian Female voice: Tatyana'},
		{id:'ru-RU_Maxim', name:'Russian Male voice: Maxim'},
		{id:'es-ES_Conchita', name:'Spanish, European Female voice: Conchita'},
		{id:'es-ES_Lucia', name:'Spanish, European Female voice: Lucia'},
		{id:'es-ES_Enrique', name:'Spanish, European Male voice: Enrique'},
		{id:'es-MX_Mia', name:'Spanish, Mexican Female voice: Mia'},
		{id:'es-US_Penélope', name:'Spanish, US Female voice: Penélope/Penelope'},
		{id:'es-US_Miguel', name:'Spanish, US Male voice: Miguel'},
		{id:'sv-SE_Astrid', name:'Swedish Female voice: Astrid'},
		{id:'tr-TR_Filiz', name:'Turkish Female voice: Filiz'},
		{id:'cy-GB_Gwyneth', name:'Welsh Female voice: Gwyneth'}
	]

	this.init = function(oLesson, moduleConfig) {
        _isPollyEnabled = (oLesson.autoVoiceProvider == 'polly');
	}

	this.showAddVoiceDlg = function(oPage, restypes, resourceDict, lessonId) {
		_restypes = restypes;
		_lessonId = lessonId;
		_resourceDict = resourceDict;
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
		dlgScope.funcs = {};
		dlgScope.options = {};
		dlgScope.help = _getHelp();
		dlgScope.autoVoiceProvider = false;
		dlgScope.data.dlgTitle = nl.t('Page voice');
		dlgScope.data.autoVoicePolly = [];
		dlgScope.options['pollyAudioType'] = [{id: 'audio', name:'Audio url'}, {id: 'autovoice', name: 'Automatic voice generation'}];

		if(_isPollyEnabled) {
			dlgScope.autoVoiceProvider = true;
			_updateAutoVoicePolly(oPage, dlgScope);
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
		dlgScope.funcs.addFragment = function() {
			_addFragment(dlgScope);
		};

		dlgScope.funcs.removeFragment = function(pos) {
			dlgScope.data.autoVoicePolly.splice(pos, 1);
		};

		dlgScope.funcs.moveUpFragment = function(pos) {
			var arr = dlgScope.data.autoVoicePolly;
			var prev = arr[pos-1];
			arr[pos-1] = arr[pos];
			arr[pos] = prev;
		};

		dlgScope.funcs.selectAudioUrl = function(index) {
			var selectedItem = dlgScope.data.autoVoicePolly[index];
			if(selectedItem.type.id == 'autovoice') return;
			nlResourceAddModifySrv.insertOrUpdateResource(parentScope, 
				_restypes, 'audio:', false, _resourceDict, false, _lessonId).then(function(result) {
				if(!result || !result.url) return;
				selectedItem['mp3'] = result.url;
			});
		}
		var okButton = {text: nl.t('Update'), onTap: function(e) {
			e.preventDefault();
			if(dlgScope.autoVoiceProvider) {
				var fragments = _getValidatedInputs(dlgScope.data);
				if(!fragments) return;
				if (fragments.length == 0) {
					if ('autoVoicePolly' in oPage) delete oPage.autoVoicePolly;
					resolve(oPage);
					nlDlg.closeAll();
					return;
				}
				oPage.autoVoicePolly = [];
				nlDlg.showLoadingScreen();
				var currentPos = 0;
				_getAudioUrlFromServer(fragments, currentPos, oPage, resolve);
			} else {
				oPage.audioUrl = dlgScope.data.audioUrl;
				oPage.autoVoice = dlgScope.data.autoVoice;
				resolve(oPage);
				nlDlg.closeAll();
			}
		}};
		
		var cancelButton = {text: nl.t('Cancel')};
		pageVoiceDlg.show('nittiolesson/page_voice_dlg.html', [okButton], cancelButton);
	}
	
	function _getAudioUrlFromServer(fragments, currentPos, oPage, resolve) {
		// TODO-NOW: Rate and pitch are missing
		//
		// TODO-NOW: API Key is to be generated from hello@nittio.com acnt
		if(currentPos >= fragments.length) {
			var msg = nl.fmt2('Processed {} audio fragments', fragments.length);
			nlDlg.popupStatus(msg);
			nlDlg.hideLoadingScreen();
			resolve(oPage);
			nlDlg.closeAll();
			return;
		}
		var fragment = fragments[currentPos];
		currentPos = currentPos+1;
		var msg = nl.fmt2('Processing audio fragment {} of {}', currentPos, fragments.length);
		nlDlg.popupStatus(msg, false);
		if(fragment.type == 'audio') {
			oPage.autoVoicePolly.push(fragment);
			_getAudioUrlFromServer(fragments, currentPos, oPage, resolve);
			return;
		}
		var data = {text: fragment.text, voice_lang: fragment.lang, voice_id: fragment.voice};
		nlServerApi.getAudioUrl(data).then(function(result) {
			fragment['mp3'] = result.url;
			oPage.autoVoicePolly.push(fragment);
			_getAudioUrlFromServer(fragments, currentPos, oPage, resolve);
			return;
		}, function(err) {
			nlDlg.popdownStatus(0);
		});
	}

	function _updateAutoVoicePolly(oPage, dlgScope) {
		if (!oPage.autoVoicePolly || oPage.autoVoicePolly.length == 0) {
			_addFragment(dlgScope);
			return;
		}
		for(var i=0; i<oPage.autoVoicePolly.length; i++) {
			var fragment = oPage.autoVoicePolly[i];
			_addFragment(dlgScope, fragment);
		}
	}

	function _addFragment(dlgScope, fragment) {
		if (!fragment) fragment = {type: 'autovoice'};
		var pollyVoiceTreeInfo = {data: _getPollyVoiceTree()};
		var selectedIds = {};
		if(fragment.type == 'autovoice') {
			var selectedId = (fragment.lang && fragment.voice) ? fragment.lang+'_'+fragment.voice : _defaultPollyVoice;
			selectedIds[selectedId] = true;
		}
		nlTreeSelect.updateSelectionTree(pollyVoiceTreeInfo, selectedIds, 0);
		pollyVoiceTreeInfo.treeIsShown = false;
		pollyVoiceTreeInfo.multiSelect = false;
		pollyVoiceTreeInfo.sortLeafNodes = false;
		dlgScope.data.autoVoicePolly.push({voiceLanguageInfo: pollyVoiceTreeInfo, delay: fragment.delay || 0, 
			type: {id: fragment.type}, text: fragment.text || '', 
			lang: fragment.lang || '', voice: fragment.voice || '',
			mp3: fragment.mp3 || '', 
			options: [{id: 'audio', name:'Audio url'}, {id: 'autovoice', name: 'Automatic voice generation'}]});
}

	function _getValidatedInputs(data) {
		var ret = [];
		for(var i=0; i<data.autoVoicePolly.length; i++) {
			var fragment = data.autoVoicePolly[i];
			var selectedVoice = null;
			if(fragment.type.id == 'audio') {
				if(!fragment.mp3) {
					nlDlg.popupAlert({title: 'Validation error', template: nl.t('The mp3 is missing in fragment {}', i+1)});
					return false;
				}
			} else {
				if(!fragment.text) {
					nlDlg.popupAlert({title: 'Validation error', template: nl.t('The voice script is missing in fragment {}', i+1)});
					return false;
				}
				if (fragment.text.length > 2800) {
					nlDlg.popupAlert({title: 'Validation error', template: nl.t('The voice script too long in fragment {}. Text length is {} and maximum allowed is 2800. Split longer text into multiple fragments.', i+1, fragment.text.length)});
					return false;
				}
				var selectedVoices = Object.keys(nlTreeSelect.getSelectedIds(fragment.voiceLanguageInfo));
				if (selectedVoices.length == 1) selectedVoice = selectedVoices[0];
				if(!selectedVoice) {
					nlDlg.popupAlert({title: 'Validation error', template: nl.t('The language and voice selection is missing in fragment {}', i+1)});
					return false;
				}
			}
			var langVoice = selectedVoice ? selectedVoice.split('_') : ['', ''];
			ret.push({type: fragment.type.id, text: fragment.text || '', lang: langVoice[0], voice: langVoice[1],
				mp3: fragment.mp3 || '', delay: fragment.delay || 0});
		}
		return ret;
	}

	function _getPollyVoiceTree() {
        var treeArray = [];
        for(var i=0; i<_amazonPollyVoices.length; i++) {
            var itemObj = _amazonPollyVoices[i];
			treeArray.push({id: itemObj.id, name: itemObj.name, origId: itemObj.id});
		}
        return treeArray;
    }

    function _getHelp() {
        return {
			pollyAudioType: {name: nl.t('Play audio from'), help: nl.t('You may either automatically convert text to voice or choose to play a recorded audio.')},
			pollyDelay: {name: nl.t('Delay before start (seconds)'), help: nl.t('You may pause for a few seconds before playing this fragment.')},
			pollyAudioUrl: {name: nl.t('Page Audio URL'), help: nl.t('Select the audio file to play.')},
			pollyLangTree: {name: nl.t('Language and voice'), help: nl.t('Please select the language and voice to automatically generate speach fragment.')},
			pollyVoiceText: {name: nl.t('Voice script'), help: nl.t('Provide the text and we will convert it to voice.')},

			audioUrl: {name: nl.t('Page Audio URL'), help: nl.t('Select the audio file to play.')},
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
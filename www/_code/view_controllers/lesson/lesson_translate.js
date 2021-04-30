(function() {

//-------------------------------------------------------------------------------------------------
// lesson_translate.js:
// lesson translate module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.lessontranslate', []).config(configFn)
    .service('nlLanguageTranslateSrv', LanguageTranslateSrv)
    .service('nlLanguageVoiceSrv', LanguageVoiceSrv)
	.controller('nl.LessonTranslateCtrl', LessonTranslateCtrl);
};

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.lesson_translate', {
		url : '^/lesson_translate',
		views : {
			'appContent' : {
				templateUrl : 'view_controllers/lesson/lesson_translate_dlg.html',
				controller : 'nl.LessonTranslateCtrl'
			}
		}
	});
}];
//-------------------------------------------------------------------------------------------------
var LanguageTranslateSrv = ['nl', 'nlDlg',
function(nl, nlDlg) {
    this.getTranslationLangs = function () {
        return [{id:'hi', name:'हिन्दी (Hindi)', group:'Indian languages'},
        {id:'bn', name:'বাঙালি (Bengali)', group:'Indian languages'},
		{id:'gu', name:'ગુજરાતી (Gujarati)', group:'Indian languages'},
		{id:'kn', name:'ಕನ್ನಡ (Kannada)', group:'Indian languages'},
		{id:'ml', name:'മലയാളം (Malayalam)', group:'Indian languages'},
		{id:'mr', name:'मराठी (Marathi)', group:'Indian languages'},
		{id:'pa', name:'ਪੰਜਾਬੀ (Punjabi)', group:'Indian languages'},
		{id:'sd', name:'سنڌي (Sindhi)', group:'Indian languages'},
		{id:'ta', name:'தமிழ் (Tamil)', group:'Indian languages'},
		{id:'te', name:'తెలుగు (Telugu)', group:'Indian languages'},
		{id:'ur', name:'اردو (Urdu)', group:'Indian languages'},
		{id:'af', name:'Afrikaans'},
		{id:'sq', name:'Albanian'},
		{id:'am', name:'Amharic'},
		{id:'ar', name:'Arabic'},
		{id:'hy', name:'Armenian'},
		{id:'az', name:'Azeerbaijani'},
		{id:'eu', name:'Basque'},
		{id:'be', name:'Belarusian'},
		{id:'bs', name:'Bosnian'},
		{id:'bg', name:'Bulgarian'},
		{id:'ca', name:'Catalan'},
		{id:'ceb', name:'Cebuano'},
		{id:'zh-CN', name:'Chinese (Simplified)'},
		{id:'zh-TW', name:'Chinese (Traditional)'},
		{id:'co', name:'Corsican'},
		{id:'hr', name:'Croatian'},
		{id:'cs', name:'Czech'},
		{id:'da', name:'Danish'},
		{id:'nl', name:'Dutch'},
		{id:'en', name:'English'},
		{id:'eo', name:'Esperanto'},
		{id:'et', name:'Estonian'},
		{id:'fi', name:'Finnish'},
		{id:'fr', name:'French'},
		{id:'fy', name:'Frisian'},
		{id:'gl', name:'Galician'},
		{id:'ka', name:'Georgian'},
		{id:'de', name:'German'},
		{id:'el', name:'Greek'},
		{id:'ht', name:'Haitian Creole'},
		{id:'ha', name:'Hausa'},
		{id:'haw', name:'Hawaiian'},
		{id:'iw', name:'Hebrew'},
		{id:'hmm', name:'Hmong'},
		{id:'hu', name:'Hungarian'},
		{id:'is', name:'Icelandic'},
		{id:'ig', name:'Igbo'},
		{id:'id', name:'Indonesian'},
		{id:'ga', name:'Irish'},
		{id:'it', name:'Italian'},
		{id:'ja', name:'Japanese'},
		{id:'jw', name:'Javanese'},
		{id:'kk', name:'Kazakh'},
		{id:'km', name:'Khmer'},
		{id:'ko', name:'Korean'},
		{id:'ku', name:'Kurdish'},
		{id:'ky', name:'kyrgyz'},
		{id:'lo', name:'Lao'},
		{id:'la', name:'Latin'},
		{id:'lv', name:'Latvian'},
		{id:'lt', name:'Lithuanian'},
		{id:'lb', name:'Luxembourgish'},
		{id:'mk', name:'Macedonian'},
		{id:'mg', name:'Malagasy'},
		{id:'ms', name:'Malay'},
		{id:'mi', name:'Maori'},
		{id:'mn', name:'Mongolian'},
		{id:'my', name:'Myanmar (Burmese)'},
		{id:'ne', name:'Nepali'},
		{id:'no', name:'Norwegian'},
		{id:'ny', name:'Nyanja (Chichewa)'},
		{id:'ps', name:'Pashto'},
		{id:'fa', name:'Persian'},
		{id:'pl', name:'Polish'},
		{id:'pt', name:'Portuguese'},
		{id:'pa', name:'Punjabhi'},
		{id:'ro', name:'Romanian'},
		{id:'ru', name:'Russian'},
		{id:'sm', name:'Samoan'},
		{id:'gd', name:'Scots Gaelic'},
		{id:'sr', name:'Serbian'},
		{id:'st', name:'Sesotho'},
		{id:'sn', name:'Shona'},
		{id:'si', name:'Sinhala (Sinhalese)'},
		{id:'sk', name:'Slovak'},
		{id:'sl', name:'Slovenian'},
		{id:'so', name:'Somali'},
		{id:'es', name:'Spanish'},
		{id:'su', name:'Sundanese'},
		{id:'sw', name:'Swahili'},
		{id:'sv', name:'Swedish'},
		{id:'tl', name:'Tagalog (Filipino)'},
		{id:'tg', name:'Tajik'},
		{id:'th', name:'Thai'},
		{id:'tr', name:'Turkish'},
		{id:'uk', name:'Ukrainian'},
		{id:'uz', name:'Uzbek'},
		{id:'vi', name:'Vietnamese'},
		{id:'cy', name:'Welsh'},
		{id:'xh', name:'Xhosa'},
		{id:'yi', name:'Yiddish'},
		{id:'yo', name:'Yorubha'},
		{id:'zu', name:'Zulu'}];
    }
}];

var LanguageVoiceSrv = ['nl', 'nlDlg',
function(nl, nlDlg) {
    this.getLangsVoice = function () {
        return {
            "hi": [
                {
                    "id": "hi-IN_Aditi",
                    "name": "Hindi Female voice with bilingual Indian English: Aditi"
                },
                {
                    "id": "goog:hi-IN_hi-IN-Wavenet-A",
                    "name": "Hindi Female voice with bilingual Indian English: Pallavi"
                },
                {
                    "id": "goog:hi-IN_hi-IN-Wavenet-B",
                    "name": "Hindi Male voice with bilingual Indian English: Arjun"
                },
                {
                    "id": "goog:hi-IN_hi-IN-Wavenet-C",
                    "name": "Hindi Male voice with bilingual Indian English: Rohan"
                }
            ],
            "bn": [
                {
                    "id": "goog:bn-IN_bn-IN-Wavenet-A",
                    "name": "Bengali Female voice: Tanushree"
                },
                {
                    "id": "goog:bn-IN_bn-IN-Wavenet-B",
                    "name": "Bengali Male voice: Soumitra"
                }
            ],
            "gu": [
                {
                    "id": "goog:gu-IN_gu-IN-Wavenet-A",
                    "name": "Gujarati Female voice: Mallika"
                },
                {
                    "id": "goog:gu-IN_gu-IN-Wavenet-B",
                    "name": "Gujarati Male voice: Vipul"
                }
            ],
            "kn": [
                {
                    "id": "goog:kn-IN_kn-IN-Wavenet-A",
                    "name": "Kannada Female voice: Lahiri"
                },
                {
                    "id": "goog:kn-IN_kn-IN-Wavenet-B",
                    "name": "Kannada Male voice: Naveen"
                }
            ],
            "ml": [
                {
                    "id": "goog:ml-IN_ml-IN-Wavenet-A",
                    "name": "Malayalam Female voice: Nithya"
                },
                {
                    "id": "goog:ml-IN_ml-IN-Wavenet-B",
                    "name": "Malayalam Male voice: Jayaram"
                }
            ],
            "ta": [
                {
                    "id": "goog:ta-IN_ta-IN-Wavenet-A",
                    "name": "Tamil Female voice: Nandhini"
                },
                {
                    "id": "goog:ta-IN_ta-IN-Wavenet-B",
                    "name": "Tamil Male voice: Karthik"
                }
            ],
            "te": [
                {
                    "id": "goog:te-IN_te-IN-Standard-A",
                    "name": "Telugu Female voice: Soundarya"
                },
                {
                    "id": "goog:te-IN_te-IN-Standard-B",
                    "name": "Telugu Male voice: Ravi"
                }
            ],
            "da": [
                {
                    "id": "da-DK_Naja",
                    "name": "Danish Female voice: Naja"
                },
                {
                    "id": "da-DK_Mads",
                    "name": "Danish Male voice: Mads"
                }
            ],
            "nl": [
                {
                    "id": "nl-NL_Lotte",
                    "name": "Dutch Female voice: Lotte"
                },
                {
                    "id": "nl-NL_Ruben",
                    "name": "Dutch Male voice: Ruben"
                }
            ],
            "en": [
                {
                    "id": "en-IN_Aditi",
                    "name": "English (Indian accent) Female voice with bilingual with Hindi: Aditi"
                },
                {
                    "id": "en-IN_Raveena",
                    "name": "English (Indian accent) Female voice: Raveena"
                },
                {
                    "id": "goog:en-IN_en-IN-Wavenet-B",
                    "name": "English (Indian accent) Male voice: Amar"
                },
                {
                    "id": "goog:en-IN_en-IN-Wavenet-C",
                    "name": "English (Indian accent) Male voice: Rajeev"
                },
                {
                    "id": "en-US_Ivy",
                    "name": "English (US accent) Female voice: Ivy"
                },
                {
                    "id": "en-US_Joanna",
                    "name": "English (US accent) Female voice: Joanna"
                },
                {
                    "id": "en-US_Kendra",
                    "name": "English (US accent) Female voice: Kendra"
                },
                {
                    "id": "en-US_Kimberly",
                    "name": "English (US accent) Female voice: Kimberly"
                },
                {
                    "id": "en-US_Salli",
                    "name": "English (US accent) Female voice: Salli"
                },
                {
                    "id": "en-US_Joey",
                    "name": "English (US accent) Male voice: Joey"
                },
                {
                    "id": "en-US_Justin",
                    "name": "English (US accent) Male voice: Justin"
                },
                {
                    "id": "en-US_Matthew",
                    "name": "English (US accent) Male voice: Mathew"
                },
                {
                    "id": "en-GB_Amy",
                    "name": "English (British accent) Female voice: Amy"
                },
                {
                    "id": "en-GB_Emma",
                    "name": "English (British accent) Female voice: Emma"
                },
                {
                    "id": "en-GB_Brian",
                    "name": "English (British accent) Male voice: Brian"
                },
                {
                    "id": "en-GB-WLS_Geraint",
                    "name": "English (Welsh accent) Male voice: Geraint"
                },
                {
                    "id": "en-AU_Nicole",
                    "name": "English (Australian accent) Female voice: Nicole"
                },
                {
                    "id": "en-AU_Russell",
                    "name": "English (Australian accent) Male voice: Russell"
                }
            ],
            "fr": [
                {
                    "id": "fr-FR_Celine",
                    "name": "French Female voice: Céline"
                },
                {
                    "id": "fr-FR_Lea",
                    "name": "French Female voice: Léa"
                },
                {
                    "id": "fr-FR_Mathieu",
                    "name": "French Male voice: Mathieu"
                },
                {
                    "id": "fr-CA_Chantal",
                    "name": "French, Canadian Female voice: Chantal"
                }
            ],
            "de": [
                {
                    "id": "de-DE_Marlene",
                    "name": "German Female voice: Marlene"
                },
                {
                    "id": "de-DE_Vicki",
                    "name": "German Female voice: Vicki"
                },
                {
                    "id": "de-DE_Hans",
                    "name": "German Male voice: Hans"
                }
            ],
            "is": [
                {
                    "id": "is-IS_Dora",
                    "name": "Icelandic Female voice: Dóra/Dora"
                },
                {
                    "id": "is-IS_Karl",
                    "name": "Icelandic Male voice: Karl"
                }
            ],
            "it": [
                {
                    "id": "it-IT_Carla",
                    "name": "Italian Female voice: Carla"
                },
                {
                    "id": "it-IT_Bianca",
                    "name": "Italian Female voice: Bianca"
                },
                {
                    "id": "it-IT_Giorgio",
                    "name": "Italian Male voice: Giorgio"
                }
            ],
            "ja": [
                {
                    "id": "ja-JP_Mizuki",
                    "name": "Japanese Female voice: Mizuki"
                },
                {
                    "id": "ja-JP_Takumi",
                    "name": "Japanese Male voice: Takumi"
                }
            ],
            "ko": [
                {
                    "id": "ko-KR_Seoyeon",
                    "name": "Korean Female voice: Seoyeon"
                }
            ],
            "pl": [
                {
                    "id": "pl-PL_Ewa",
                    "name": "Polish Female voice: Ewa"
                },
                {
                    "id": "pl-PL_Maja",
                    "name": "Polish Female voice: Maja"
                },
                {
                    "id": "pl-PL_Jacek",
                    "name": "Polish Male voice: Jacek"
                },
                {
                    "id": "pl-PL_Jan",
                    "name": "Polish Male voice: Jan"
                }
            ],
            "pt": [
                {
                    "id": "pt-BR_Vitoria",
                    "name": "Portuguese, Brazilian Female voice: Vitória/Vitoria"
                },
                {
                    "id": "pt-BR_Ricardo",
                    "name": "Portuguese, Brazilian Male voice: Ricardo"
                },
                {
                    "id": "pt-PT_Ines",
                    "name": "Portuguese, European Female voice: Inês/Ines"
                },
                {
                    "id": "pt-PT_Cristiano",
                    "name": "Portuguese, European Male voice: Cristiano"
                }
            ],
            "ro": [
                {
                    "id": "ro-RO_Carmen",
                    "name": "Romanian Female voice: Carmen"
                }
            ],
            "ru": [
                {
                    "id": "ru-RU_Tatyana",
                    "name": "Russian Female voice: Tatyana"
                },
                {
                    "id": "ru-RU_Maxim",
                    "name": "Russian Male voice: Maxim"
                }
            ],
            "es": [
                {
                    "id": "es-ES_Conchita",
                    "name": "Spanish, European Female voice: Conchita"
                },
                {
                    "id": "es-ES_Lucia",
                    "name": "Spanish, European Female voice: Lucia"
                },
                {
                    "id": "es-ES_Enrique",
                    "name": "Spanish, European Male voice: Enrique"
                },
                {
                    "id": "es-MX_Mia",
                    "name": "Spanish, Mexican Female voice: Mia"
                },
                {
                    "id": "es-US_Penelope",
                    "name": "Spanish, US Female voice: Penélope/Penelope"
                },
                {
                    "id": "es-US_Miguel",
                    "name": "Spanish, US Male voice: Miguel"
                }
            ],
            "sv": [
                {
                    "id": "sv-SE_Astrid",
                    "name": "Swedish Female voice: Astrid"
                }
            ],
            "tr": [
                {
                    "id": "tr-TR_Filiz",
                    "name": "Turkish Female voice: Filiz"
                }
            ],
            "cy": [
                {
                    "id": "cy-GB_Gwyneth",
                    "name": "Welsh Female voice: Gwyneth"
                }
            ]
        };
    }
}];

//-------------------------------------------------------------------------------------------------
var LessonTranslateCtrl = ['nl', 'nlDlg', 'nlRouter', '$scope', 'nlCardsSrv', 'nlLessonSelect', 'nlTreeSelect', 'nlServerApi', 'nlLanguageTranslateSrv', 'nlLanguageVoiceSrv',
function(nl, nlDlg, nlRouter, $scope, nlCardsSrv, nlLessonSelect, nlTreeSelect, nlServerApi, nlLanguageTranslateSrv, nlLanguageVoiceSrv) {
    var params = nl.location.search();
    $scope.debug = 'debug' in params;
    var markupSplitter = new MarkupSplitter(nl);
	var _userInfo = null;
	var _languageInfo = [];
    var _voiceInfo = [];
    var _selectedLang = null;
	var _scope = null;
	var _translateDict = {};
	var _translateArray = [];
    var _isApi3Possible = false;
	var _preSelectedLessonId = null;
    var _preSelectedLanguage = null;
    var _trFlags = null; // What all will be translated
    // var _languageFlags = {hi: {lang: 'en-IN', voice: 'Aditi'}};  //Which languages will be generated aldo after translating them TODO-NOW
	var _traslateLangTree = nlLanguageTranslateSrv.getTranslationLangs();
    var _langsVoiceTree = nlLanguageVoiceSrv.getLangsVoice();
	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function (resolve, reject) {
			$scope.userinfo = _userInfo;
            $scope.data = {showHelp: {}, showVoice: false};
            $scope.data.contentType = $scope.options.contentType[0];
			nl.pginfo.pageTitle = nl.t('Translate module');
            nlServerApi.isApi3PossibleWithUrl("auto_voice").then(function(isPossible){ 
                _isApi3Possible = isPossible;
            });
			if (_preSelectedLessonId) {
				_getContent(_preSelectedLessonId).then(function(oLesson) {
			        $scope.data.selectedModule = {lessonId:_preSelectedLessonId, title: oLesson.name};
					if(resolve) resolve(true);	
				});
			} else {
				if(resolve) resolve(true);	
			}
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);
	
    var arrayParams = _getLanguageTree('');
    _languageInfo = {data: arrayParams[0] || []};
    nlTreeSelect.updateSelectionTree(_languageInfo, arrayParams[1], 2);
    _languageInfo.treeIsShown = false;
    _languageInfo.multiSelect = false;
    _languageInfo.fieldmodelid = 'language';
    _languageInfo.onSelectChange = function() {
        var _selectedLangId = Object.keys(nlTreeSelect.getSelectedIds(_languageInfo))[0];
        _selectedLang = _selectedLangId.indexOf(".") > 0 ? _selectedLangId.split(".")[1] : _selectedLangId;
        var voiceArrayParams = _getLanguageVoiceTree(_selectedLang);
        if (voiceArrayParams[0].length > 0){
            _voiceInfo = {data: voiceArrayParams[0] || []};
            nlTreeSelect.updateSelectionTree(_voiceInfo, {}, 1);
            _voiceInfo.treeIsShown = false;
            _voiceInfo.multiSelect = false;
            _voiceInfo.fieldmodelid = 'voice';
            $scope.options.voice = _voiceInfo;
            $scope.data.showVoice = true;
        } else {
            $scope.data.showVoice = false;
        };
    };

    $scope.options = {  language: _languageInfo,
                        contentType: [  
                            {id: 'textvoice', name: 'Both Text and Voice'},
                            {id: 'textonly', name: 'Text Only'},
                            {id: 'voiceonly', name: 'Voice Only'}
                        ]
                    };

	function _getContent(lessonId) {
		return nl.q(function(resolve, reject) {
			nlServerApi.lessonGetContent(lessonId, 'view').then(function(result) {
				resolve(result.lesson);
			});
		});
	}
	
	function _getLanguageTree() {
	    var params = nl.location.search();
        _preSelectedLessonId = ('id' in params) ? parseInt(params.id) : '';
		_preSelectedLanguage = ('lang' in params) ? params.lang : null;
        var insertedKeys = {};
        var selectedLangId = {};
        var treeArray = [];
        for(var i=0; i<_traslateLangTree.length; i++) {
            var itemObj = _traslateLangTree[i];
            _getIconNodeWithParents(itemObj, treeArray, insertedKeys, _preSelectedLanguage, selectedLangId);
        }
        return [treeArray, selectedLangId];
    }

    function _getLanguageVoiceTree(langId) {
	    var treeArray = _langsVoiceTree[langId];
        if (!treeArray){
            return [[],{}];
        };
        var treeArrayWithoutApi3Voices = []
        treeArray.forEach(function(value){
            value.origId = value.id;
            if (!value.id.startsWith("goog")){
                if (!_isApi3Possible){
                    treeArrayWithoutApi3Voices.push(value);
                };   
            };
        });
        return _isApi3Possible ? [treeArray, {}] : [treeArrayWithoutApi3Voices, {}];
    }

    function _getIconNodeWithParents(itemObj, treeArray, insertedKeys, _preSelectedLanguage, selectedLangId) {
        if (itemObj.group && !insertedKeys[itemObj.group]) {
        	insertedKeys[itemObj.group] = true;
        	treeArray.push({id: itemObj.group, name: itemObj.group, isOpen: true});
        }
        var itemId = itemObj.group ? itemObj.group + '.' + itemObj.id : itemObj.id;
        if(itemObj.id === _preSelectedLanguage) selectedLangId[itemId] = true;
        if (insertedKeys[itemId]) return;
    	insertedKeys[itemId] = true;        
        treeArray.push({id: itemId, name: itemObj.name, origId: itemObj.id});
    }

    var targetLang = '';
    var targetVoice = '';
	$scope.onTranslate = function() {
		if(!$scope.data.selectedModule) return _errorMessage(nl.t('Please select the module to translate')); 
		var lessonId = $scope.data.selectedModule.lessonId;
		targetLang = '';
		var selectedLangs = nlTreeSelect.getSelectedIds(_languageInfo);
		for (var key in selectedLangs) targetLang = selectedLangs[key].origId;
        if(!targetLang) return _errorMessage(nl.t('Please select the target language'));
        
        targetVoice = '';
        var selectedVoice = nlTreeSelect.getSelectedIds(_voiceInfo);
		for (var key in selectedVoice) targetVoice = selectedVoice[key].origId;
        if($scope.data.showVoice && !targetVoice) return _errorMessage(nl.t('Please select the target voice'));

        if(!$scope.data.contentType) return _errorMessage(nl.t('Please select the contentType to translate')); 
        _initTranslationFlags($scope.data.contentType);

        nlDlg.popupStatus('Getting the module content ...', false);
		nlDlg.showLoadingScreen();
		_getContent(lessonId).then(function(oLesson) {
            nlDlg.popupStatus('Analyzing the items requiring translation ...', false);
            nl.timeout(function() {
                _prepareAndTranslate(oLesson, targetLang, targetVoice);
            });
		});
    };
    
    function _initTranslationFlags(contenttype) {
        var userSelected = contenttype['id'];
        _trFlags = {
			'module.name': (userSelected != 'voiceonly'),
			'module.description': (userSelected != 'voiceonly'),
            'module.forumTopic': (userSelected != 'voiceonly'),
            'page.forumTopic': (userSelected != 'voiceonly'),
			'page.hint': (userSelected != 'voiceonly'),
            'section.text': (userSelected != 'voiceonly'),
            
            'page.pollyAutoVoice': (userSelected != 'textonly'),
            'page.autoVoice': (userSelected != 'textonly')
        };
    }
	
    function _prepareAndTranslate(oLesson, targetLang, targetVoice) {
        _createTranslationArrayFromLessonContent(oLesson, targetLang, targetVoice);
        _translateTexts(targetLang).then(function(translations) {
            _updateModule(translations);
            oLesson.lang = targetLang;
            var pollyVoiceArray = _createVoiceAndUpdateLesson(oLesson);
            getPollyVoiceAndCreateLesson(pollyVoiceArray, 0, oLesson, targetLang, targetVoice);
        });
    }

    function _createVoiceAndUpdateLesson(oLesson) {
        var pollyVoiceArray = [];
        for (var i=0; i< oLesson.pages.length; i++) {
            if (oLesson.pages[i].autoVoicePolly) {
                for(var j=0; j< oLesson.pages[i].autoVoicePolly.length; j++) {
                    var pollyVoiceFragment = {
                        "fragment": oLesson.pages[i].autoVoicePolly[j]
                    };
                    if(pollyVoiceFragment.fragment.lang && pollyVoiceFragment.fragment.text) {
                        pollyVoiceArray.push(pollyVoiceFragment);
                    }
                }
            }
        }
        return pollyVoiceArray;
    }

    function getPollyVoiceAndCreateLesson(pollyVoiceArray, currentPos, oLesson) {
        if(currentPos >= pollyVoiceArray.length) {
            var data = {content:angular.toJson(oLesson), createNew: true};
            nlServerApi.lessonSave(data).then(function(newLessonId) {
                $scope.newLessonId = newLessonId;
                $scope.isApproved = false;
                var copyLessonDlg = nlDlg.create($scope);
                copyLessonDlg.scope.error = {};
                copyLessonDlg.scope.dlgTitle = nl.t('Module translated');
                var closeButton = {text : nl.t('Close')};
                copyLessonDlg.show('view_controllers/lesson_list/copy_lesson.html', [], closeButton);
                nlDlg.hideLoadingScreen();
            });
        } else {
            var fragment = pollyVoiceArray[currentPos].fragment;
            currentPos = currentPos+1;
            var data = {text: fragment.text, voice_lang: fragment.lang, voice_id: fragment.voice,
                rate: fragment.rate, pitch: fragment.pitch};
            nlServerApi.getAudioUrl(data).then(function(result) {
                fragment['mp3'] = result.url;
                getPollyVoiceAndCreateLesson(pollyVoiceArray, currentPos, oLesson);
                return;
            }, function(err) {
                nlDlg.popdownStatus(0);
            });
        }
    }

    
    var _translations = [];
    var _MAX_CHARS_PER_SERVER_TRANSLATE_CALL = 10000;
    var _MAX_ITEMS_PER_SERVER_TRANSLATE_CALL = 100;
	function _translateTexts(targetLang) {
        return nl.q(function (resolve, reject) {
            _translations = [];
            _translateTextsImpl(targetLang, 0, resolve, reject);
        });
    }
    
    function _translateTextsImpl(targetLang, startAt, resolve, reject) {
        if (startAt >= _translateArray.length) {
            nlDlg.popdownStatus(0);
            resolve(_translations);
            return;
        }
        var toServerArray = [];
        var nChars = 0;
        for (var i=startAt; i<_translateArray.length; i++) {
            toServerArray.push(_translateArray[i]);
            nChars += _translateArray[i].length;
            if (nChars >= _MAX_CHARS_PER_SERVER_TRANSLATE_CALL) break;
            if (toServerArray.length >= _MAX_ITEMS_PER_SERVER_TRANSLATE_CALL) break;
        }
        var newStartAt = startAt+toServerArray.length;
        
        nlDlg.popupStatus(nl.fmt2('Translating {} of {} items', newStartAt, _translateArray.length), false);
        var data = {target: targetLang, inputs: toServerArray};
        if (startAt != 0) data.disablereqcnt = true;
        nlServerApi.translateTexts(data).then(function(translatedModule) {
            var translations = translatedModule.translations;
            for(var i=0; i<translations.length; i++)
                _translations.push(translations[i]);
            _translateTextsImpl(targetLang, newStartAt, resolve, reject);
        }, function() {
            nlDlg.popdownStatus(0);
            reject();
        });
	}
	  	
	function _errorMessage(msg) {
		nlDlg.popupAlert({title: 'Alert message', template: msg});
	}
	
	function _addTxtToArrayAndDict(txt, typename, targetObjInfo, pos) {
        if (!_trFlags[typename]) return;
		var info = {type: typename, targetObjInfo: targetObjInfo, pos: pos};
		_translateDict[_translateArray.length]= info;
		_translateArray.push(txt);
	}
	
    function _addMarkupsToArrayAndDict(markup, typename, targetObjInfo) {
        if (!_trFlags[typename]) return;
        targetObjInfo.splitArray = markupSplitter.split(markup);
        targetObjInfo.lastTranslatedPosition = -1;
        for(var i=0; i<targetObjInfo.splitArray.length; i++) {
            var elem = targetObjInfo.splitArray[i];
            if (!elem.translate) continue;
            _addTxtToArrayAndDict(elem.txt, typename, targetObjInfo, i);
            targetObjInfo.lastTranslatedPosition = i;
        }
    }

    function _getTranslatedMarkup(translated, elem) {
        elem.targetObjInfo.splitArray[elem.pos].txt = translated;
        if (elem.pos != elem.targetObjInfo.lastTranslatedPosition) return null;
        var markup = '';
        for(var i=0; i<elem.targetObjInfo.splitArray.length; i++)
            markup += elem.targetObjInfo.splitArray[i].txt;
        return markup;
    }

	function _createTranslationArrayFromLessonContent(oLesson, targetLang, targetVoice) {
        _translateDict = {};
        _translateArray = [];
        _addTxtToArrayAndDict(oLesson.name, 'module.name', {obj: oLesson});
		if(oLesson.description)
			_addTxtToArrayAndDict(oLesson.description, 'module.description', {obj: oLesson});
        if(oLesson.forumTopic)
            _addTxtToArrayAndDict(oLesson.forumTopic, 'module.forumTopic', {obj: oLesson});
	    _createTranslationArrayFromPages(oLesson, oLesson.pages, targetLang, targetVoice);
	}

    function _createTranslationArrayFromPages(oLesson, pages, targetLang, targetVoice) {
        for(var i=0; i<pages.length; i++)
            _createTranslationArrayFromPage(oLesson, pages[i], targetLang, targetVoice);
    }

    function _createTranslationArrayFromPage(oLesson, page, targetLang, targetVoice) {
        if(page.forumTopic)
            _addTxtToArrayAndDict(page.forumTopic, 'page.forumTopic', {obj: page});
        if(page.autoVoice)
            _addMarkupsToArrayAndDict(page.autoVoice, 'page.autoVoice', {obj: page});
        if(page.autoVoicePolly) {
            var fragments = page.autoVoicePolly;
            for(var i=0; i<fragments.length; i++) {
                var fragment = fragments[i];
                if(fragment.text == "") continue;
                if(fragment.type != 'audio') {
                    if (targetVoice){
                        fragment.lang = targetVoice.split("_")[0];
                        fragment.type = 'autovoice';
                        fragment.voice = targetVoice.split("_")[1];
                    }
                    else {
                        fragment.lang = 'en-IN';
                        fragment.type = 'ignore';
                        fragment.voice = 'Aditi';
                    }
                    fragment.pitch = fragment.pitch || 100;
                    fragment.rate = fragment.rate || 100;
                }
                _addMarkupsToArrayAndDict(fragment.text, 'page.pollyAutoVoice', {obj: fragment});
            }
        }
		if(page.hint)
			_addMarkupsToArrayAndDict(page.hint, 'page.hint', {obj: page});
		for(var i=0; i<page.sections.length; i++) {
			var section = page.sections[i];
			if(section.text == "") continue;
			_addMarkupsToArrayAndDict(section.text, 'section.text', {obj: section});
            if (!section.popups || !section.popups.onclick) continue;
            _createTranslationArrayFromPages(oLesson, section.popups.onclick);
		}
	}

	function _updateModule(translatedArray) {
		for(var i=0; i<translatedArray.length; i++) {
			var elem = _translateDict[i];
			if (!elem) continue;
            var translated = _unquote(translatedArray[i].translatedText);
            var targetObj = elem.targetObjInfo.obj;
			switch (elem.type) {
			case 'module.name':
				targetObj.name = translated;
				break;
			case 'module.description':
				targetObj.description = translated;
				break;
            case 'module.forumTopic':
                targetObj.forumTopic = translated;
                break;
            case 'page.forumTopic':
                targetObj.forumTopic = translated;
                break;
            case 'page.pollyAutoVoice':
			    var markup = _getTranslatedMarkup(translated, elem);
			    if (markup !== null) targetObj.text = markup;
                break;
			case 'page.autoVoice':
                var markup = _getTranslatedMarkup(translated, elem);
                if (markup !== null) targetObj.autoVoice = "@voice(ignore)\n" + markup; 
				break;
			case 'page.hint':
                var markup = _getTranslatedMarkup(translated, elem);
                if (markup !== null) targetObj.hint = markup;
				break;
			case 'section.text':
                var markup = _getTranslatedMarkup(translated, elem);
                if (markup !== null) targetObj.text = markup;
                if ('correctanswer' in targetObj) delete targetObj.correctanswer;
				break;
            }
		}
	}
	
    function _unquote(input) {
        return input.replace(/&quot;/g, '\\"');
    }
	
	$scope.onCancel = function() {
		nl.location.url('/home');
	};
	
}];

function MarkupSplitter(nl) {
    this.split = function(txt) {
        var splitArray = [];
        _splitMathMl(txt, splitArray);
        splitArray = _reduceArray(splitArray);
        return splitArray;
    };
    
    function _reduceArray(splitArray) {
        var ret = [];
        for(var i=0; i<splitArray.length; i++) {
            var elem = splitArray[i];
            if (elem.txt.trim() == '') elem.translate = false;
            if (ret.length == 0 || ret[ret.length -1].translate != elem.translate) ret.push(elem);
            else ret[ret.length -1].txt += elem.txt; 
        }
        return ret;
    }

    function _splitMathMl(txt, splitArray) {
        var pos1 = txt.indexOf('`');
        var pos2 = pos1 >= 0 ? txt.indexOf('`', pos1+1) : -1;
        if (pos2 < 0) return _splitLines(txt, splitArray);
        if (pos1 > 0) _splitLines(txt.substring(0, pos1), splitArray);
        splitArray.push({txt: txt.substring(pos1, pos2+1), translate: false});
        if (pos2 < txt.length - 1) _splitMathMl(txt.substring(pos2+1), splitArray);
    }

    function _splitLines(txt, splitArray) {
        var lines = txt.split('\n');
        for(var i=0; i<lines.length; i++) {
            _splitLine(lines[i], splitArray);
            if (i < lines.length - 1) splitArray.push({txt: '\n', translate: false});
        }
    }

    function _splitLine(txt, splitArray) {
        if (!txt) return;
        for(var i=0; i<_lineStartMarkups.length; i++) {
            var markup = _lineStartMarkups[i];
            var pos = txt.indexOf(markup.keyword);
            if (pos != 0) continue;
            if (!markup.handler) {
                splitArray.push({txt: txt, translate: false});
                return;
            }
            splitArray.push({txt: txt.substring(0, markup.keyword.length), translate: false});
            markup.handler(txt.substring(markup.keyword.length), splitArray, markup);
            return;
        }
        _splitNumberedMarkups(txt, splitArray);
    }
    
    function _splitNumberedMarkups(txt, splitArray) {
        for(var i=0; i<_numberedMarkups.length; i++) {
            var markup = _numberedMarkups[i];
            var pos = txt.indexOf(markup.keyword);
            if (pos != 0) continue;
            splitArray.push({txt: txt.substring(0, markup.keyword.length), translate: false});
            markup.handler(txt.substring(markup.keyword.length), splitArray, markup);
            return;
        }
        _splitInlineMarkups(txt, splitArray);
    }

    function _splitInlineMarkups(txt, splitArray) {
        if (!txt) return;
        for(var i=0; i<_inlineMarkups.length; i++) {
            var markup = _inlineMarkups[i];
            var pos = txt.indexOf(markup.keyword);
            if (pos < 0) continue;
            if (pos > 0) {
                splitArray.push({txt: txt.substring(0, pos), translate: true});
                txt = txt.substring(pos);
            }

            pos = txt.indexOf('[');
            if (pos >= 0) {
                var pos2 = txt.indexOf(']');
                if (pos2 < 0) pos2 = txt.length;
                else pos2++;
                var inlineMarkup = txt.substring(0, pos2);
                markup.handler(inlineMarkup, splitArray, markup);
                txt = (pos2 < txt.length-1) ? txt.substring(pos2) : '';
                _splitInlineMarkups(txt, splitArray);
                return;
            }
            pos = txt.indexOf(' ');
            if (pos < 0) pos = txt.length;
            splitArray.push({txt: txt.substring(0, pos), translate: false});
            if (pos < txt.length) _splitInlineMarkups(txt.substring(pos), splitArray);
            return;
        }
        splitArray.push({txt: txt, translate: true});
    }
    
    function _splitAttr(txt, splitArray, markupInfo) {
        var pos = txt.indexOf('[');
        if (pos < 0) {
            splitArray.push({txt: txt, translate: false});
            return;
        }

        splitArray.push({txt: txt.substring(0, pos+1), translate: false});
        txt = txt.substring(pos+1);
        while(true) {
            if (!txt) return;
            pos = txt.indexOf('=');
            if (pos < 0) {
                splitArray.push({txt: txt, translate: false});
                return;
            }
            var attr = txt.substring(0, pos);
            if (attr in markupInfo.attrs) {
                splitArray.push({txt: txt.substring(0, pos+1), translate: false});
                txt = txt.substring(pos+1);
                var pos2 = txt.indexOf('|');
                if (pos2 < 0) pos2 = txt.indexOf(']');
                if (pos2 < 0) pos2 = txt.length;
                splitArray.push({txt: txt.substring(0, pos2), translate: true});
                txt = pos2 < txt.length ? txt.substring(pos2) : '';
            } else {
                var pos2 = txt.indexOf('|');
                if (pos2 < 0) pos2 = txt.indexOf(']');
                splitArray.push({txt: (pos2 < 0) ? txt : txt.substring(0, pos2+1), translate: false});
                txt = pos2 >= 0 ? txt.substring(pos2+1) : '';
            }
        }
    }
    
    function _splitComma(txt, splitArray, markupInfo) {
        while(true) {
            var pos = txt.indexOf(',');
            if (pos < 0) {
                splitArray.push({txt: txt, translate: true});
                return;
            }
            if (pos > 0) splitArray.push({txt: txt.substring(0, pos), translate: true});
            splitArray.push({txt: ',', translate: false});
            txt = txt.substring(pos+1);
        }
    }
    
    var _lineStartMarkups = [
        {keyword: 'H1', handler: _splitInlineMarkups},
        {keyword: 'H2', handler: _splitInlineMarkups},
        {keyword: 'H3', handler: _splitInlineMarkups},
        {keyword: 'H4', handler: _splitInlineMarkups},
        {keyword: 'H5', handler: _splitInlineMarkups},
        {keyword: 'H6', handler: _splitInlineMarkups},

        {keyword: 'video:'}, 
        {keyword: 'embed:'}, 
        {keyword: 'pdf:'}, 
        {keyword: 'iframe:'},
        {keyword: 'img:'}, 
        {keyword: 'audio:', handler: _splitAttr, attrs: {'text': true}}, 

        {keyword: '@voice('}, 

        {keyword: 'text:', handler: _splitComma}, 
        {keyword: 'select:', handler: _splitComma}, 
        {keyword: 'multi-select:', handler: _splitComma}, 
        {keyword: 'multi-select1:', handler: _splitComma}, 
        {keyword: 'multi-select2:', handler: _splitComma}, 
        {keyword: 'multi-select3:', handler: _splitComma}, 
        {keyword: 'multi-select4:', handler: _splitComma}, 
        {keyword: 'multi-select5:', handler: _splitComma}, 
        {keyword: 'multi-select6:', handler: _splitComma}
    ];

    var _numberedMarkups = [
        {keyword: '-', handler: _splitNumberedMarkups},
        {keyword: '#', handler: _splitNumberedMarkups}
    ];

    var _inlineMarkups = [
        {keyword: 'link:', handler: _splitAttr, attrs: {'text': true}}];

    // This is provided as a testcase for this whole class
    this.testCase = function() {
        var data = [
        '`Some mathml content',
        'spanning across lines` and this is ok `',
        'mathml done`',
        'H1 some thing',
        'H2 some thing',
        ' H6 some thing with space before',
        '- first bullet',
        '-- second bullet',
        '# first numbered',
        '## second numbered',
        '--### bullet numbered',
        'link:this_is_link_url',
        'link:this_is_link_url[text=link text] link:this_is_link_url link:this_is_link_url[text=link text]',
        'link:this_is_link_url[text=link text|b=b]',
        'link:this_is_link_url[a=a|text=link text]',
        'link:this_is_link_url[a=a|text=link text|b=b]',
        'link:this_is_link_url[a=a|b=b]',
        '--### link:this_is_link_url[a=a|b=b]',
        'img:imgurl.com/a.png',
        'img:imgurl.com/a.png[cover=1]',
        'img:imgurl.com/a.png[cover=1|link=img link title]',
        'video:videourl',
        'audio:videourl[text=abc]',
        'video:videourl[stop=1|text=abc|start=0]',
        'video:videourl[start=1|stop=10]',
        '@voice(en)',
        'multi-select5:a,b,c,d'
        ];
        data = data.join('\n');
        console.warn('before split:', data);
        var split = this.split(data);
        console.warn('after split:', split);
    };
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

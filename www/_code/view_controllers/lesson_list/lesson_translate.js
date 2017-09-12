(function() {

//-------------------------------------------------------------------------------------------------
// lesson_list.js:
// lesson list module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.lessontranslate', []).config(configFn)
	.controller('nl.LessonTranslateCtrl', LessonTranslateCtrl);
};

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.lesson_translate', {
		url : '^/lesson_translate',
		views : {
			'appContent' : {
				templateUrl : 'view_controllers/lesson_list/lesson_translate_dlg.html',
				controller : 'nl.LessonTranslateCtrl'
			}
		}
	});
}];

//-------------------------------------------------------------------------------------------------
var LessonTranslateCtrl = ['nl', 'nlDlg', 'nlRouter', '$scope', 'nlCardsSrv', 'nlLessonSelect', 'nlTreeSelect', 'nlServerApi',
function(nl, nlDlg, nlRouter, $scope, nlCardsSrv, nlLessonSelect, nlTreeSelect, nlServerApi) {
	var _userInfo = null;
	var _languageInfo = [];
	var _scope = null;
	var _translateDict = {};
	var _translateArray = [];
	var _preSelectedLessonId = null;
	var _preSelectedLanguage = null;
	var _traslateLangTree = [{id:'bn', name:'Bengali', group:'Indian languages'},
		{id:'gu', name:'Gujarati', group:'Indian languages'},
		{id:'hi', name:'Hindi', group:'Indian languages'},
		{id:'kn', name:'Kannada', group:'Indian languages'},
		{id:'ml', name:'Malayalam', group:'Indian languages'},
		{id:'mr', name:'Marathi', group:'Indian languages'},
		{id:'pa', name:'Punjabi', group:'Indian languages'},
		{id:'sd', name:'Sindhi', group:'Indian languages'},
		{id:'ta', name:'Tamil', group:'Indian languages'},
		{id:'te', name:'Telugu', group:'Indian languages'},
		{id:'ur', name:'Urdu', group:'Indian languages'},
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

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function (resolve, reject) {
			$scope.userinfo = _userInfo;
	        $scope.data = {showHelp: {}};
			nl.pginfo.pageTitle = nl.t('Translate module');
	
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
	_languageInfo.showSearchField = true;
	_languageInfo.fieldmodelid = 'language';

	$scope.options = {language: _languageInfo};

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

	$scope.onTranslate = function() {
		if(!$scope.data.selectedModule) return _errorMessage(nl.t('Please select the module to translate')); 
		var lessonId = $scope.data.selectedModule.lessonId;

		var targetLang = '';
		var selectedLangs = nlTreeSelect.getSelectedIds(_languageInfo);
		for (var key in selectedLangs) targetLang = selectedLangs[key].origId;
		if(!targetLang) return _errorMessage(nl.t('Please select the target language'));

		
		nlDlg.showLoadingScreen();
		_getContent(lessonId).then(function(oLesson) {
			_translateLessonContentToArray(oLesson);
			nlServerApi.translateTexts({target: targetLang, inputs: _translateArray})
			.then(function(translatedModule) {
				_updateModule(oLesson, translatedModule.translations);
				oLesson.lang = targetLang;

				var data = {content:angular.toJson(oLesson), createNew: true};
				nlServerApi.lessonSave(data).then(function(newLessonId) {
					$scope.newLessonId = newLessonId;
					$scope.isApproved = false;
					var copyLessonDlg = nlDlg.create($scope);
					copyLessonDlg.scope.error = {};
					var closeButton = {text : nl.t('Close')};
					copyLessonDlg.show('view_controllers/lesson_list/copy_lesson.html', [], closeButton);
					nlDlg.hideLoadingScreen();
				});
			});
		});
	};
	  	
	function _errorMessage(msg) {
		nlDlg.popupAlert({title: 'Alert message', template: msg});
	}
	
	function _addToArrayAndDict(value, typename, page, section, prefix) {
		var info = {type: typename};
		if (page !== undefined) info.page = page;
		if (section !== undefined) info.section = section;
		if (prefix != undefined) info.prefix = prefix;
		_translateDict[_translateArray.length]= info;
		_translateArray.push(value);
	}
	
	var wikiMarkups = {img: true, audio: true, video: true, link: true, pdf: true, embed: true, iframe: true};
	// TODO: currently not translating link: text.
	function _translateLessonContentToArray(oLesson, newLessonid) {
        _translateDict = {};
        _translateArray = [];
		_addToArrayAndDict(oLesson.name, 'module.name');
		if(oLesson.description)
			_addToArrayAndDict(oLesson.description, 'module.description');
		for(var i=0; i<oLesson.pages.length; i++) {
			var page = oLesson.pages[i];
			if(page.autoVoice)
				_addToArrayAndDict(page.autoVoice, 'page.autoVoice', i);
			if(page.hint)
				_addToArrayAndDict(page.hint, 'page.hint', i);
			for(var j=0; j<page.sections.length; j++) {
				var section = page.sections[j];
				if(section.text == "") continue;
				var splitedText = section.text.split(':');
				if (splitedText[0] in wikiMarkups) continue;
				if (splitedText[0] == 'text' || splitedText[0] == 'select' || splitedText[0].indexOf('multi-select') == 0) {
					_addToArrayAndDict(splitedText[1], 'section.text', i, j, splitedText[0]);					
					continue;
				}
				_addToArrayAndDict(section.text, 'section.text', i, j);
			}
		}
	};
	
	function _updateModule(oLesson, translatedArray) {
		for(var i=0; i<translatedArray.length; i++) {
			var elem = _translateDict[i];
			if (!elem) continue;
			switch (elem.type) {
			case 'module.name':
				oLesson.name = translatedArray[i].translatedText;
				break;
			case 'module.description':
				oLesson.description = translatedArray[i].translatedText;
				break;
			case 'page.autoVoice':
				oLesson.pages[elem.page].autoVoice = "@voice(ignore)\n" + translatedArray[i].translatedText;
				break;
			case 'page.hint':
				oLesson.pages[elem.page].hint = translatedArray[i].translatedText;				
				break;
			case 'section.text':
				oLesson.pages[elem.page].sections[elem.section].text = elem.prefix ? elem.prefix +":"+ translatedArray[i].translatedText : translatedArray[i].translatedText;
				break;
			}
		}
	}
	
	$scope.onCancel = function() {
		nl.location.url('/home');
	};
	
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

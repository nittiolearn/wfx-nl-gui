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
	var _traslateLangTree = [{id:'bn', name:'Bengali', group:'Indian languages'},
		{id:'gu', name:'Gujarathi', group:'Indian languages'},
		{id:'hi', name:'Hindhi', group:'Indian languages'},
		{id:'kn', name:'Kannada', group:'Indian languages'},
		{id:'ml', name:'Malayalam', group:'Indian languages'},
		{id:'mr', name:'Marathi', group:'Indian languages'},
		{id:'bn', name:'Bengali', group:'Indian languages'},
		{id:'pa', name:'Punjabi', group:'Indian languages'},
		{id:'sd', name:'Sindhi', group:'Indian languages'},
		{id:'ta', name:'Tamil', group:'Indian languages'},
		{id:'te', name:'Telugu', group:'Indian languages'},
		{id:'ur', name:'Urdu', group:'Indian languages'},
		{id:'af', name:'Afrikaans'},
		{id:'sq', name:'Albanian'},
		{id:'am', name:'Amharic'},
		{id:'ar', name:'Arabic'},
		{id:'hy', name:'Armanian'},
		{id:'eu', name:'Basque'},
		{id:'be', name:'Belarusian'},
		{id:'bs', name:'Bosnian'},
		{id:'bg', name:'Bulgarian'},
		{id:'ca', name:'Catalan'},
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
		{id:'gl', name:'galician'},
		{id:'ka', name:'Georgian'},
		{id:'de', name:'German'},
		{id:'el', name:'Greek'},
		{id:'ht', name:'Haitian creole'},
		{id:'ha', name:'Hausa'},
		{id:'haw', name:'Hawaiian'},
		{id:'iw', name:'Hebrew'},
		{id:'hmm', name:'Hmong'},
		{id:'hu', name:'Hungarian'},
		{id:'is', name:'Icelandic'},
		{id:'ig', name:'Igbo'},
		{id:'id', name:'Indonasian'},
		{id:'ga', name:'Irish'},
		{id:'it', name:'Italian'},
		{id:'ja', name:'Japanese'},
		{id:'jw', name:'Jawanese'},
		{id:'kk', name:'Kazakh'},
		{id:'km', name:'Khmer'},
		{id:'ko', name:'Korean'},
		{id:'ku', name:'Kurdish'},
		{id:'ky', name:'krygyz'},
		{id:'lo', name:'Lao'},
		{id:'la', name:'Latin'},
		{id:'lv', name:'Latvian'},
		{id:'lt', name:'Lithuanian'},
		{id:'lb', name:'Luxembourgish'},
		{id:'mk', name:'Mecedonian'},
		{id:'mg', name:'Malagasy'},
		{id:'ms', name:'Malay'},
		{id:'mi', name:'Maori'},
		{id:'mn', name:'Mangolian'},
		{id:'my', name:'Myanmar'},
		{id:'ne', name:'Nepali'},
		{id:'no', name:'Norwegian'},
		{id:'ny', name:'Nyanja'},
		{id:'ps', name:'Pashto'},
		{id:'fa', name:'Persian'},
		{id:'pl', name:'Polish'},
		{id:'pt', name:'Portuguese'},
		{id:'pa', name:'Punjabhi'},
		{id:'ro', name:'Romanian'},
		{id:'ru', name:'Russian'},
		{id:'sm', name:'Somoan'},
		{id:'gd', name:'Scots Gaelic'},
		{id:'sr', name:'Serbian'},
		{id:'st', name:'Sesotho'},
		{id:'sn', name:'Shona'},
		{id:'si', name:'Sinhala'},
		{id:'sk', name:'Slovak'},
		{id:'sl', name:'Slovanian'},
		{id:'so', name:'Somali'},
		{id:'es', name:'Spanish'},
		{id:'su', name:'Sundanese'},
		{id:'sw', name:'Swahili'},
		{id:'sv', name:'Swedish'},
		{id:'tl', name:'Tagalog'},
		{id:'tg', name:'Tajik'},
		{id:'th', name:'Thai'},
		{id:'tr', name:'Turkish'},
		{id:'uk', name:'Ukranian'},
		{id:'uz', name:'Uzbek'},
		{id:'vi', name:'Vietnamese'},
		{id:'cy', name:'Welsh'},
		{id:'xh', name:'Xhosa'},
		{id:'yi', name:'Yiddhish'},
		{id:'yo', name:'Yorubha'}];

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		$scope.userinfo = _userInfo;
		return nl.q(function(resolve, reject) {
			nl.pginfo.pageTitle = nl.t('Translate module');
            $scope.data = {showHelp: {}};
			if(resolve) resolve(true);	
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    var arrayParams = _getLanguageTree('');
    _languageInfo = {data: arrayParams[0] || []};
    nlTreeSelect.updateSelectionTree(_languageInfo, {});
    _languageInfo.treeIsShown = false;
    _languageInfo.multiSelect = false;
	_languageInfo.showSearchField = true;
	_languageInfo.fieldmodelid = 'language';

	$scope.options = {language: _languageInfo};

	function _getLanguageTree(selectedId) {
        var insertedKeys = {};
        var selectedImageId = {};
        var treeArray = [];
        for(var i=0; i<_traslateLangTree.length; i++) {
            var itemObj = _traslateLangTree[i];
            _getIconNodeWithParents(itemObj, treeArray, insertedKeys, selectedId);
        }
        return [treeArray, selectedImageId];
    }

    function _getIconNodeWithParents(itemObj, treeArray, insertedKeys, selectedId, selectedImageId) {
        if (itemObj.group && !insertedKeys[itemObj.group]) {
        	insertedKeys[itemObj.group] = true;
        	treeArray.push({id: itemObj.group, name: itemObj.group});
        }
        var itemId = itemObj.group ? itemObj.group + '.' + itemObj.id : itemObj.id;
        
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
		nlServerApi.lessonGetContent(lessonId, 'view').then(function(result) {
			var oLesson = result.lesson;
			_translateLessonContentToArray(oLesson);
			nlServerApi.translateTexts({target: targetLang, inputs: _translateArray})
			.then(function(translatedModule) {
				_updateModule(oLesson, translatedModule.translations);
				oLesson.lang = targetLang;

				var data = {content:angular.toJson(oLesson), createNew: true};
				nlServerApi.lessonSave(data).then(function(newLessonId) {
					nlDlg.hideLoadingScreen();
				});
			});
		});
	};
	  	
	function _errorMessage(msg) {
		nlDlg.popupAlert({title: 'Alert message', template: msg});
	}
	
	function _addToArrayAndDict(value, typename, page, section) {
		var info = {type: typename};
		if (page !== undefined) info.page = page;
		if (section !== undefined) info.section = section;
		_translateDict[_translateArray.length]= info;
		_translateArray.push(value);
	}
	
	function _translateLessonContentToArray(oLesson, newLessonid) {
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
				oLesson.pages[elem.page].autoVoice = translatedArray[i].translatedText;
				break;
			case 'page.hint':
				oLesson.pages[elem.page].hint = translatedArray[i].translatedText;				
				break;
			case 'section.text':
				oLesson.pages[elem.page].sections[elem.section].text = translatedArray[i].translatedText;
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

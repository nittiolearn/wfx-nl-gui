(function() {

//-------------------------------------------------------------------------------------------------
// page_props_dlg.js:
// module editor -> page properties dlg module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.nittiolesson.page_props', [])
	.service('NittioLessonPagePropsDlg', NittioLessonPagePropsDlgSrv);
}

//-------------------------------------------------------------------------------------------------
var NittioLessonPagePropsDlgSrv = ['nl', 'nlDlg',
function(nl, nlDlg) {
	var _pageProps = [];
	var _moduleConfig = null;
	var _pagePropsHelp = {};
	var _oPage = null;
	var _defMaxScore = null;
    var _isPopup = false;
	this.init = function(moduleConfig) {
		_moduleConfig = moduleConfig;
		_pageProps = [{id:'pageId', name: nl.t('Page id'), type:'div'},
			{id:'maxScore', name: nl.t('Maximum score'), type:'number', condition: 'isMaxScore'},
			{id:'minPageTime', name: nl.t('Minimum time'), type:'number', min: 0},
			{id:'forumTopic', name: nl.t('Discussion topic'), type:'string', condition: 'notPopup'},
			{id:'audioUrl', name: nl.t('Audio url'), type:'string'},
			{id:'autoVoice', name: nl.t('Audio script'), type:'textarea'},
			{id:'hint', name: nl.t('Page hint'), type:'textarea', condition: 'notPopup'},
            {id:'bgimg', name: nl.t('Background image'), type:'string'},
            {id:'bgshade', name: nl.t('Text Color'), type:'select', condition: 'isBgimg'},
			{id:'visibility', name: nl.t('Visibility'), type: 'select', condition: 'isBleedingEdge'}];
			
		_updatePageProps(_pageProps);
	};

	var _pagePropsHelp = {
			pageId : nl.t('You can directly access this page by adding the page id to end of this learning modules URL'),
			maxScore :nl.t('Define the maximum score of the page. To switch back to default value, just clear the field.'),
            minPageTime : nl.t('Provide minimum time in seconds that the learner has to spend in this page before moving forward. If not provided, this value is assumed to be 0 - i.e. no restriction.'),
            forumTopic : nl.t('Provide name of the discussion topic which should be displayed when the learner clicks on discussion forum icon from this page.'),
            audioUrl : nl.t('Provide background audio to play when the page is displayed'),
            autoVoice : nl.t('<p>Provide text that should be played as audio when the page is displayed.</p>'
                + '<p>Keep each line short. Use ",", "." and new line to control the pauses.</p>'
                + '<p>You can also control the voice, language, rate, and pitch using the "@voice()" command. For example, type in the below line as first line in your text to get male, UK English voice spoken in lower pitch and faster rate:</p>'
                + '<p class="fblack">@voice( male,UK,lang=en,rate=2,pitch=0.6)</p>'
                + '<p><b>lang:</b> "en" is "English", "hi" is "Hindi", "zh" is "Chinese". Actual languages supported depends on the browser.</p>'
                + '<p><b>rate:</b> Any number between 0.1 and 10 (1 is normal speed)</p>'
                + '<p><b>pitch:</b> Any number between 0 and 2 (1 is normal pitch)</p>'),
            hint : nl.t('Provide addtional hints to the learner which will be displayed to the learner in report mode'),
            bgimg : nl.t('Provide URL of the background image for this page. If not specified, the module background image will be taken'),
            bgshade : nl.t('Valid only if background image is set for the page. Depending on whether your image is dark or light, you can set the text color to one which is clearly visible in the background. With this, you can control the colors used for different types of text (normal, heading, link, ...)'),
            visibility : nl.t('Should the page be visible in learning mode (assignments) or just as a note to editor (i.e. hidden page). By default a page is visible in all modes.')
	};
	
	var visibilityOpt = [{id:'always', name:nl.t('Always')},
						{id:'editor', name: nl.t("Editor's note")}];

    var bgshades = [{id: 'bglight', name: 'Dark text color for lighter background'},
                    {id: 'bgdark', name: 'Light text color for darker background'}];
	function _updatePageProps(_pageProps) {
		for (var i=0; i<_pageProps.length; i++) {
			var prop = _pageProps[i];
			prop.help = _pagePropsHelp[prop.id] || null;
		}
	}
	
	this.showDlg = function(oPage, defMaxScore, isPopup) {
		_oPage = oPage;
		_defMaxScore = defMaxScore;
		_isPopup = isPopup;
		var parentScope = nl.rootScope;
		return nl.q(function(resolve, reject) {
			var pagePropsDlg = nlDlg.create(parentScope);
				pagePropsDlg.setCssClass('nl-height-max nl-width-max');
				_initPagePropsDlg(pagePropsDlg);
			var okButton = {text: nl.t('Done'), onTap: function(e) {
				_updateOpageProps(pagePropsDlg.scope.data);	
				resolve(true);
			}};
			var cancelButton = {text: nl.t('Cancel'), onTap: function() {
				resolve(false);
			}};
			pagePropsDlg.show('lib_ui/dlg/dlgfieldsview.html', [okButton], cancelButton);
		});
	};
	
	function _initPagePropsDlg(pagePropsDlg) {
		pagePropsDlg.scope.dlgTitle = nl.t('{}Page Properties', _isPopup ? 'Popup ' : '');

		pagePropsDlg.scope.data = {};
		pagePropsDlg.scope.data.items = _pageProps;
		pagePropsDlg.scope.data.pageId = {title: nl.t('<span class="fsh6">#/id{}</span>', _oPage.pageId)};
		pagePropsDlg.scope.data.maxScore = 'pageMaxScore' in _oPage ? _oPage.pageMaxScore : '';
		pagePropsDlg.scope.data.minPageTime = parseInt(_oPage.minPageTime || 0);
		pagePropsDlg.scope.data.forumTopic = _oPage.forumTopic;
		pagePropsDlg.scope.data.audioUrl = _oPage.audioUrl;
		pagePropsDlg.scope.data.autoVoice = _oPage.autoVoice;
		pagePropsDlg.scope.data.hint = _oPage.hint;
        pagePropsDlg.scope.data.bgimg = _oPage.bgimg || '';
        pagePropsDlg.scope.data.bgshade = _oPage.bgshade == "bgdark" ? bgshades[1] : bgshades[0];
		pagePropsDlg.scope.options = {visibility: visibilityOpt, bgshade: bgshades};
		pagePropsDlg.scope.data.visibility = _oPage.visibility === 'editor' ? visibilityOpt[1] : visibilityOpt[0];
		pagePropsDlg.scope.data.canShow = function(condition, item) {
			if (condition == 'isBleedingEdge') return (_moduleConfig.grpProps.isBleedingEdge);
			if (condition == 'isMaxScore') return (_defMaxScore > 0);
            if (condition == 'isBgimg') return (pagePropsDlg.scope.data.bgimg != '');
            if (condition == 'notPopup') return (!_isPopup);
			return true;
		};
		
		pagePropsDlg.scope.data.getPlaceHolder = function (item) {
			if(item.id == 'maxScore') return nl.t('Default: {}', _defMaxScore);
			return item.placeholder || ""; 
		};
	};
	
    var MINIMUM_MAXSCORE = 1;
	function _updateOpageProps(data) {
	    if (data.maxScore !== '' && data.maxScore >= MINIMUM_MAXSCORE) {
	        _oPage.pageMaxScore = data.maxScore;
            _oPage.maxScore = data.maxScore;
	    } else {
	        delete _oPage.pageMaxScore;
            _oPage.maxScore = _defMaxScore;
	    }
		_oPage.minPageTime = data.minPageTime;
		_oPage.forumTopic = data.forumTopic;
		_oPage.audioUrl = data.audioUrl;
		_oPage.autoVoice = data.autoVoice;
		_oPage.hint = data.hint;
        _oPage.bgimg = data.bgimg;
        _oPage.bgshade = data.bgshade.id;
		_oPage.visibility = data.visibility.id;
	}
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

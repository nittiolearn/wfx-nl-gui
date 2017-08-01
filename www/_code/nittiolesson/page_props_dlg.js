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
	this.init = function(moduleConfig) {
		_moduleConfig = moduleConfig;
		_pageProps = [{id:'pageId', name: nl.t('Page id'), type:'div'},
			{id:'maxScore', name: nl.t('Maximum score'), type:'number', condition: 'isMaxScore'},
			{id:'minPageTime', name: nl.t('Minimum time'), type:'number', min: 0},
			{id:'forumTopic', name: nl.t('Discussion topic'), type:'string'},
			{id:'audioUrl', name: nl.t('Audio url'), type:'string'},
			{id:'autoVoice', name: nl.t('Audio script'), type:'textarea'},
			{id:'hint', name: nl.t('Page hint'), type:'textarea'},
			{id:'visibility', name: nl.t('Visibility'), type: 'select', condition: 'isBleedingEdge'}];
			
		_updatePageProps(_pageProps);
	};

	var _pagePropsHelp = {
			pageId : nl.t('You can directly access this page by adding the page id to end of this learning modules URL'),
			maxScore :nl.t('Define the maximum score of the page. To switch back to default value, just clear the field.'),
            minPageTime : nl.t('Provide minimum time in seconds that the learner has to spend in this page before moving forward. If not provided, this value is assumed to be 0 - i.e. no restriction.'),
            forumTopic : nl.t('Provide name of the discussion topic which should be displayed when the learner clicks on discussion forum icon from this page.'),
            audioUrl : nl.t('Provide background audio to play when the page is displayed'),
            autoVoice : nl.t('Provide text that should be played as audio when the page is displayed'),
            hint : nl.t('Provide addtional hints to the learner which will be displayed to the learner in report mode'),
            visibility : nl.t('Should the page be visible in learning mode (assignments) or just as a note to editor (i.e. hidden page). By default a page is visible in all modes.')
	};
	
	var visibilityOpt = [{id:'always', name:nl.t('Always')},
						{id:'editor', name: nl.t("Editor's note")}];

	
	function _updatePageProps(_pageProps) {
		for (var i=0; i<_pageProps.length; i++) {
			var prop = _pageProps[i];
			prop.help = _pagePropsHelp[prop.id] || null;
		}
	}
		
	this.showDlg = function(oPage, defMaxScore) {
		_oPage = oPage;
		_defMaxScore = defMaxScore;
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
		pagePropsDlg.scope.dlgTitle = nl.t('Page properties');

		pagePropsDlg.scope.data = {};
		pagePropsDlg.scope.data.items = _pageProps;
		pagePropsDlg.scope.data.pageId = {title: nl.t('<span class="fsh6">#/id{}</span>', _oPage.pageId)};
		pagePropsDlg.scope.data.maxScore = 'pageMaxScore' in _oPage ? _oPage.pageMaxScore : '';
		pagePropsDlg.scope.data.minPageTime = parseInt(_oPage.minPageTime || 0);
		pagePropsDlg.scope.data.forumTopic = _oPage.forumTopic;
		pagePropsDlg.scope.data.audioUrl = _oPage.audioUrl;
		pagePropsDlg.scope.data.autoVoice = _oPage.autoVoice;
		pagePropsDlg.scope.data.hint = _oPage.hint;
		pagePropsDlg.scope.options = {visibility: visibilityOpt};
		pagePropsDlg.scope.data.visibility = _oPage.visibility === 'editor' ? visibilityOpt[1] : visibilityOpt[0];
		pagePropsDlg.scope.data.canShow = function(condition, item) {
			if (condition == 'isBleedingEdge') return (_moduleConfig.grpProps.isBleedingEdge);
			if (condition == 'isMaxScore') return (_defMaxScore > 0);
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
		_oPage.visibility = data.visibility.id;
	}
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

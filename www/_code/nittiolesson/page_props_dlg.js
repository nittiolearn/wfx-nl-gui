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
	this.init = function(moduleConfig) {
		_moduleConfig = moduleConfig;
		_pageProps = [{id:'pageId', name: nl.t('Page id'), type:'readonly'},
			{id:'maxScore', name: nl.t('Score'), type:'number'},
			{id:'minPageTime', name: nl.t('Minimum time'), type:'number'},
			{id:'forumTopic', name: nl.t('Discussion topic'), type:'string'},
			{id:'audioUrl', name: nl.t('Audio url'), type:'string'},
			{id:'autoVoice', name: nl.t('Audio script'), type:'textarea'},
			{id:'hint', name: nl.t('Page hint'), type:'textarea'},
			{id:'visibility', name: nl.t('Visibility'), type: 'select'}];
			
		_updatePageProps(_pageProps);
	};

	var _pagePropsHelp = {
			PageId : nl.t('You can directly access this page by adding the page id to end of this learning modules URL'),
			maxScore :nl.t('Define the maximum score of the page. To switch back to default value, just clear the field.'),
            minPageTime : nl.t('provide minimum time in seconds that the learner has to spend in this page before moving forward. If not provided, this value is assumed to be 0 - i.e. no restriction.'),
            forumTopic : nl.t('provide name of the discussion topic which should be displayed when the learner clicks on discussion forum icon from this page.'),
            audioUrl : nl.t('provide background audio to play when the page is displayed'),
            autoVoice : nl.t('provide text that should be played as audio when the page is displayed'),
            hint : nl.t('provide addtional hints to the learner which will be displayed to the learner in report mode'),
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
		
	this.showDlg = function(oPage) {
		console.log(oPage);
		var parentScope = nl.rootScope;
		return nl.q(function(resolve, reject) {
			var pagePropsDlg = nlDlg.create(parentScope);
				pagePropsDlg.setCssClass('nl-height-max nl-width-max');
				_initPagePropsDlg(pagePropsDlg, oPage);
			var okButton = {text: nl.t('Done'), onTap: function(e) {
				resolve(true);
			}};
			var cancelButton = {text: nl.t('Cancel'), onTap: function() {
				resolve(false);
			}};
			pagePropsDlg.show('nittiolesson/module_props_dlg.html', [okButton], cancelButton);
		});
	};
	
	function _initPagePropsDlg(pagePropsDlg, oPage) {
		pagePropsDlg.scope.data = {};
		pagePropsDlg.scope.data.moduleProps = _pageProps;
		pagePropsDlg.scope.data.pageId = oPage.pageId;
		pagePropsDlg.scope.data.maxScore = oPage.maxScore;
		pagePropsDlg.scope.data.minPageTime = parseInt(oPage.minPageTime || '');
		pagePropsDlg.scope.data.forumTopic = oPage.forumTopic;
		pagePropsDlg.scope.data.audioUrl = oPage.audioUrl;
		pagePropsDlg.scope.data.autoVoice = oPage.autoVoice;
		pagePropsDlg.scope.data.hint = oPage.hint;
		pagePropsDlg.scope.options = {visibility: visibilityOpt};
		pagePropsDlg.scope.data.visibility = oPage.visibility === 'always' ? visibilityOpt[0] : visibilityOpt[1];
		pagePropsDlg.scope.data.canShow = function(condition, item) {
			return true;
		};
	};
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

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
var NittioLessonPagePropsDlgSrv = ['nl', 'nlDlg', 'nlResourceAddModifySrv',
function(nl, nlDlg, nlResourceAddModifySrv) {
	var _pageProps = [];
	var _moduleConfig = null;
	var _pagePropsHelp = {};
	var _oPage = null;
	var _defMaxScore = null;
    var _isPopup = false;
    var _parentScope = null;
    var _resourceDict = {};
    var _lessonId = null;
	this.init = function(moduleConfig) {
		_moduleConfig = moduleConfig;
		_pageProps = [{id:'pageId', name: nl.t('Page id'), type:'div'},
			{id:'maxScore', name: nl.t('Maximum score'), type:'number', condition: 'isMaxScore'},
			{id:'minPageTime', name: nl.t('Minimum time'), type:'number', min: 0},
			{id:'forumTopic', name: nl.t('Discussion topic'), type:'string', condition: 'notPopup'},
			{id:'hint', name: nl.t('Page hint'), type:'textarea', condition: 'notPopup'},
            {id:'bgimg', name: nl.t('Background image'), type:'image-select', canClear: true},
			{id:'visibility', name: nl.t('Visibility'), type: 'select', condition: 'isBleedingEdge'}];
			
		_updatePageProps(_pageProps);
	};

	var _pagePropsHelp = {
			pageId : nl.t('You can directly access this page by adding the page id to end of this learning modules URL'),
			maxScore :nl.t('Define the maximum score of the page. To switch back to default value, just clear the field.'),
            minPageTime : nl.t('Provide minimum time in seconds that the learner has to spend in this page before moving forward. If not provided, this value is assumed to be 0 - i.e. no restriction.'),
            forumTopic : nl.t('Provide name of the discussion topic which should be displayed when the learner clicks on discussion forum icon from this page.'),
            hint : nl.t('Provide addtional hints to the learner which will be displayed to the learner in report mode'),
            bgimg : nl.t('Provide URL of the background image for this page. If not specified, the module background image will be taken'),
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
	
	this.showDlg = function(oPage, defMaxScore, isPopup, resourceDict, lessonId) {
		_oPage = oPage;
		_defMaxScore = defMaxScore;
		_isPopup = isPopup;
		_parentScope = nl.rootScope;
		_resourceDict = resourceDict;
		_lessonId = lessonId;
		return nl.q(function(resolve, reject) {
			var pagePropsDlg = nlDlg.create(_parentScope);
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
		pagePropsDlg.scope.data.hint = _oPage.hint;
        pagePropsDlg.scope.data.bgimg = _oPage.bgimg || '';
        pagePropsDlg.scope.data.bgshade = _oPage.bgshade || 'bglight';
		pagePropsDlg.scope.options = {visibility: visibilityOpt};
		pagePropsDlg.scope.data.visibility = _oPage.visibility === 'editor' ? visibilityOpt[1] : visibilityOpt[0];
		pagePropsDlg.scope.data.canShow = function(condition, item) {
			if (condition == 'isBleedingEdge') return (_moduleConfig.grpProps.isBleedingEdge);
			if (condition == 'isMaxScore') return (_defMaxScore > 0);
            if (condition == 'notPopup') return (!_isPopup);
			return true;
		};
		
		pagePropsDlg.scope.data.getPlaceHolder = function (item) {
			if(item.id == 'maxScore') return nl.t('Default: {}', _defMaxScore);
			return item.placeholder || ""; 
		};
		pagePropsDlg.scope.onFieldClick = function(fieldmodel) {
			if (fieldmodel != 'bgimg') return;
			var markupText = nl.fmt2('img:{}[{}]', pagePropsDlg.scope.data.bgimg, pagePropsDlg.scope.data.bgshade);
			var promise = nlResourceAddModifySrv.insertOrUpdateResource(_parentScope, 
				            _moduleConfig.restypes, markupText, false, _resourceDict, 'bg', _lessonId);
    		promise.then(function(result) {
    			if (!result || !result.url || !result.bgShade) return;
	            pagePropsDlg.scope.data.bgimg = result.url;
	            pagePropsDlg.scope.data.bgshade = result.bgShade;
    		});
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
		_oPage.hint = data.hint;
        _oPage.bgimg = data.bgimg;
        _oPage.bgshade = data.bgshade;
		_oPage.visibility = data.visibility.id;
	}
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

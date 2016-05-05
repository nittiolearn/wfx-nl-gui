(function() {

//-------------------------------------------------------------------------------------------------
// playerutils.js:
// Utilities used by player
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.playerutils', [])
    .service('nlPlayerUtils', PlayerUtilsSrv)
    .directive("nlMathjaxBind", MathjaxBindDirective);
}

//-------------------------------------------------------------------------------------------------
var PlayerUtilsSrv = ['nl', 'nlPageType', 'nlMarkup',
function(nl,nlPageType, nlMarkup) {
    this.getBgTemplate = function(template, bgTempls) {
        return new BgTemplate(nl, template, bgTempls);
    };

    this.getPageTypeHandler = function(lesson, pagetypes) {
        return nlPageType.getPageTypeHandler(lesson, pagetypes);
    };
    
    this.getSectionTextHandler = function(lesson) {
        return new SectionTextHandler(nl, nlMarkup, lesson);
    }
}];

//-------------------------------------------------------------------------------------------------
function BgTemplate(nl, template, bgTempls) {

    //---------------------------------------------------------------------------------------------
    function _init(self) {
        var bgTemplDict = _getBgTemplateDict(bgTempls);
        var isCustom = (template.indexOf('img:') == 0);
        var templateId = isCustom ? 'Custom' : template;
        var t = bgTemplDict[templateId];
    
        self.template = t.id;
        self.templateFullName = template;
        self.displayName = t.name;
        if (!isCustom) {
            self.fontStyle = t.bgShade;
            self.imgUrl = nl.url.bgImgUrl(t.background);
            return;
        }
        
        self.imgUrl = template.substring(4);
        var paramPos = self.imgUrl.indexOf('[');
        self.fontStyle = self.imgUrl.substring(paramPos+1, self.imgUrl.length-1);
        self.imgUrl = self.imgUrl.substring(0, paramPos);
    }
    function _getBgTemplateDict(bgTempls) {
        var ret = {};
        for (var i=0; i<bgTempls.length; i++) {
            ret[bgTempls[i]['id']] = bgTempls[i];
        }
        return ret;
    }

    //---------------------------------------------------------------------------------------------
    _init(this);
}

var _bgFontStyles = [
               {'id' : 'bgdark', 'name' : 'Classic Light'}, 
               {'id' : 'bglight', 'name' : 'Classic Dark'}
];

//-------------------------------------------------------------------------------------------------
function SectionTextHandler(nl, nlMarkup, lesson) {

    //---------------------------------------------------------------------------------------------
    function _init(self) {
        self.secTexts = {};
        for(var p=0; p<lesson.pages.length; p++) {
            var page = lesson.pages[p];
            self.secTexts[page.pageId] = _getSectionMarkups(self, page);
        }
    }
    
    function _getSectionMarkups(self, page) {
        var ret = [];
        for(var s=0; s<page.sections.length; s++) {
            var section = page.sections[s];
            var retData = {lessPara: true};
            var markup = nlMarkup.getHtml(section.text || '', retData);
            ret.push(markup);
        }
        return ret;
    }

    //---------------------------------------------------------------------------------------------
    _init(this);
}

//-------------------------------------------------------------------------------------------------
var MathjaxBindDirective = ['nl',
function(nl) {

    function postLink($scope, iElem, iAttrs) {
        MathJax.Hub.Queue(function() {
            console.log('Typeset starting');
        });
        MathJax.Hub.Queue(["Typeset", MathJax.Hub, iElem[0]]);
        MathJax.Hub.Queue(function() {
            console.log('Typeset done');
        });
    }
    
    return {
        restrict: "A",
        link: postLink
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

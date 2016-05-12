(function() {

//-------------------------------------------------------------------------------------------------
// playerutils.js:
// Utilities used by player
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.playerutils', [])
    .service('nlPlayerUtils', PlayerUtilsSrv);
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
    
    this.getSectionHtml = function(section) {
        var retData = {lessPara: true};
        // TODO-MUNNI-PLAYER: || '' code is for questionnaire/... page types e.g. select box
        return nlMarkup.getHtml(section.text || '', retData);
    };

    this.getFontSize = function(iElem) {
        return _getFontSize(iElem);
    };
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
function _getFontSize(pgSecView) {
    var ERROR_MARGIN = 3; // Number of pixel error margin
    
    pgSecView.css({'font-size' : '100%'});
    var elem = pgSecView.clone();
    elem.css({'z-index' : '-10', 'opacity' : '0', 'width': 'auto', 'height': 'auto'});
    pgSecView.parent().append(elem);
    var hOrig = pgSecView[0].clientHeight;
    var wOrig = pgSecView[0].clientWidth*1;
    
    function _findBestFit(minSize, maxSize) {
        if (_doesItFit(maxSize)) return maxSize;
        if (!_doesItFit(minSize)) return minSize;
        if (maxSize - minSize <= 1) return minSize;
        
        var midSize = Math.floor((minSize+maxSize)/2);
        var textSize = _findBestFit(midSize, maxSize);
        if (textSize > midSize) return textSize;

        return _findBestFit(minSize, midSize);
    }

    function _doesItFit(textSize) {
        var fsz = '' + textSize + '%';
        elem.css({'font-size': fsz, 'line-height': '110%'});
        var hNew = elem[0].clientHeight;
        if (hNew > hOrig) return false;
        
        var wNew = _getChildMaxWidth(elem[0], 0);
        if (wNew > wOrig + ERROR_MARGIN) return false;
        return true;
    }
    
    function _getChildMaxWidth(e, maxWidth) {
        if (e.clientWidth > maxWidth) maxWidth = e.clientWidth;
        var children = angular.element(e).children();
        for(var i=0; i<children.length; i++) {
            maxWidth = _getChildMaxWidth(children[i], maxWidth);
        }
        return maxWidth;
    }
    
    var textSize = _findBestFit(30, 100);
    elem.remove();
    return textSize;
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

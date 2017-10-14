(function() {

//-------------------------------------------------------------------------------------------------
// markup service markup.js:
// wiki markup processor
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.ui.markup', [])
	.filter('nlMarkupToHtml', NlMarkupToHtml)
    .service('nlMarkup', NlMarkupSrv)
    .directive('nlAdjustHeight', AdjustHeightDirective);
}

//-------------------------------------------------------------------------------------------------
var NlMarkupToHtml = ['nlMarkup', 
function (nlMarkup) {
    function _markupToHtml(textMarkup) {
        var retData = {lessPara: true};
        return nlMarkup.getHtml(textMarkup, retData);
    }
    return _markupToHtml;
}];

//-------------------------------------------------------------------------------------------------
var NlMarkupSrv = ['nl', function (nl) {

var parentStack = new ParentStack();
var _gid = 0;

//-----------------------------------------------------------------------------------
// Public methods
//-----------------------------------------------------------------------------------
this.setGid = function(gid) {
    _gid = gid;
};

this.getHtml = function(markupStr, retData) {
    return _markupToHtml(markupStr, retData);
};

this.parseWikiMarker = function(line, marker, fn, dontConvertUrl) {
    return _parseWikiMarker(line, marker, fn, dontConvertUrl);
};

this.breakWikiMarkup = function(line) {
    return _breakWikiMarkup(line);
};

//-----------------------------------------------------------------------------------
// Private methods
//-----------------------------------------------------------------------------------    
function _markupToHtml(markupStr, retData) {
    var lines = markupStr.split('\n');
    var lessPara = (retData.lessPara == true) && (lines.length <= 1);
    retData.isTxt = (lines.length > 1);
    
    parentStack.init();
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        _markupToHtmlLine(line, lessPara, retData);
    }
    parentStack.resetLevels();
    return parentStack.getText();
}

function _markupToHtmlLine(line, lessPara, retData) {
    if (_markupToHtmlHeading(line)) {
        retData.isTxt = true;
        return;
    } else if (_markupToFlexHtmlLists(line, 0)) {
        retData.isTxt = true;
        return;
    } else if (_markupToHtmlXxxInline(line, _markupToHtmlImg, retData.isTxt)) {
        return;
    } else if (_markupToHtmlXxxInline(line, _markupToHtmlAudio, retData.isTxt)) {
        return;
    } else if (_markupToHtmlXxxInline(line, _markupToHtmlVideo, retData.isTxt)) {
        return;
    } else if (_markupToHtmlXxxInline(line, _markupToIframe, retData.isTxt)) {
        return;
    } else if (_markupToHtmlXxxInline(line, _markupToHtmlPdf, retData.isTxt)) {
        return;
    }

    parentStack.resetLevels();
    var lineHtml = _lineWikiToHtml(line);
    if (!lessPara) lineHtml = '<p>' + lineHtml + '</p>';
    if (!lessPara && line == '') {
        lineHtml = '<br/>';
    }
    parentStack.apendToTop(lineHtml);
    retData.isTxt = true;
}

function _markupToHtmlXxxInline(line, xxxFn, bInline) {
    var lineHtml = xxxFn(line, bInline);
    if (lineHtml == '') return false;
    parentStack.resetLevels();
    parentStack.apendToTop(lineHtml);
    return true;
}

function _checkMarkup(str, markup) {
    var re = new RegExp(nl.fmt2('^\\s*{}', markup));
    if (str.match(re)) return true;
    return false;
}

function _markupToHtmlImg(str, bInline) {
    if (!_checkMarkup(str, 'img:')) return '';
    var cls = bInline ? 'inline_obj' : 'retain_aspect_ratio';
    return _parseWikiMarker(str, 'img:', function(imgUrl, avpairs) {
        if (imgUrl == '') return '';
        cls += 'cover' in avpairs && avpairs['cover'] == "1" ? ' bgcover' : '';
        var html = nl.fmt2('<img class="{} njs_img" src="{}" />', cls, imgUrl);
        var newTab = 'popup' in avpairs && avpairs['popup'] == "1" ? ' target="_blank"' : '';
        if ('link' in avpairs) html = nl.fmt2('<a{} href="{}">{}</a>', newTab, avpairs['link'], html);
        return html;
    });
}

function _markupToHtmlPdf(str, bInline) {
    if (!_checkMarkup(str, 'pdf:')) return '';
    var cls = bInline ? 'inline_obj' : '';
    return _parseWikiMarker(str, 'pdf:', function(link, avpairs) {
        if (link == '') return '';
        var page = ('page' in avpairs) ? parseInt(avpairs['page']) : 1;
        var scale = ('scale' in avpairs) ? parseFloat(avpairs['scale']) : 1.0;
        var attrs = nl.fmt2('njsPdfUrl="{}" njsPdfPage="{}" njsPdfScale="{}"', link, page, scale);
        return nl.fmt2('<div class="njs_pdf_holder {}" {}></div>', cls, attrs);
    });
}

function _markupToHtmlAudio(str, bInline) {
    if (!_checkMarkup(str, 'audio:')) return '';
    return _parseWikiMarker(str, 'audio:', function(link, avpairs) {
        if (link == '') return '';
        var title = '';
        if ('text' in avpairs) title = nl.fmt2('<div>{}</div>',"avpairs['text']");
        
        var pos = ('start' in avpairs) || ('end' in avpairs) ? '#t=' : '';
        pos += 'start' in avpairs ? nl.fmt2('{}', avpairs['start']) : '';
        pos += 'end' in avpairs ? nl.fmt2(',{}', avpairs['end']) : '';          
        return nl.fmt2('{}<audio preload controls class="njs_audio" src="{}{}" />',title,link,pos); 
    });
}

var adjustHeightDirStr = ' nl-adjust-height="0.5625"';
function _markupToHtmlVideo(str, bInline) {
    if (!_checkMarkup(str, 'embed:') && !_checkMarkup(str, 'video:')) return '';
    if(_checkMarkup(str, 'video:')) str = str.replace('video:','embed:');
    return _parseWikiMarker(str, 'embed:', function(link, avpairs) {
    	var adjustHeightDir = nl.pginfo.isOldCode ? ' ' : adjustHeightDirStr;
        if (link == '') return '';
        if (link.indexOf('www.youtube.com') >= 0) {
            if (link.indexOf('watch?v=') < 0) {
                return '<div>Error: copy youtube url from the browser addressbar - needs to be of form "www.youtube.com/watch?v=..." </div>';                   
            }
            var url = link.replace('watch?v=', 'embed/');
            url = url.replace(/\#.*/, ''); // Remove anchors if any
            var protocol = '';
            if (url.indexOf('http://') != 0 && url.indexOf('https://') != 0) {
                protocol = 'http://';           
            }
            var pos = 'start' in avpairs ? nl.fmt2('&start={}', avpairs['start']) : '';
            pos += 'end' in avpairs ? nl.fmt2('&end={}', avpairs['end']) : '';
            return nl.fmt2('<iframe{} data-njsYouTube src="{}{}?modestBranding=1&rel=0&html5=1&enablejsapi=1{}" class="reset_height" allowfullscreen></iframe>', adjustHeightDir, protocol, url, pos);     
        }
        var pos = ('start' in avpairs) || ('end' in avpairs) ? '#t=' : '';
        pos += 'start' in avpairs ? nl.fmt2('{}', avpairs['start']) : '';
        pos += 'end' in avpairs ? nl.fmt2(',{}', avpairs['end']) : '';          
        return nl.fmt2('<video{} preload controls class="njs_video reset_height"><source src="{}{}"/></video>', adjustHeightDir, link, pos);
    });
}

function _markupToIframe(str, bInline) {
    if (!_checkMarkup(str, 'iframe:') && !_checkMarkup(str, 'scorm:')) return '';
    if(_checkMarkup(str, 'scorm:')) str = str.replace('scorm:','iframe:');
    return _parseWikiMarker(str, 'iframe:', function(link, avpairs) {
    	var adjustHeightDir = nl.pginfo.isOldCode ? ' ' : adjustHeightDirStr;
        if (link == '') return '';
        return nl.fmt2('<iframe{} src="{}" class="reset_height"></iframe>', adjustHeightDir, link);
    });
}

function _markupToHtmlHeading(line) {
    var lineHtml;
    if (line.indexOf('H1') == 0) {
        lineHtml = '<h1>' + _lineWikiToHtml(line.substring(2)) + '</h1>';
    } else if (line.indexOf('H2') == 0) {
        lineHtml = '<h2>' + _lineWikiToHtml(line.substring(2)) + '</h2>';
    } else if (line.indexOf('H3') == 0) {
        lineHtml = '<h3>' + _lineWikiToHtml(line.substring(2)) + '</h3>';
    } else if (line.indexOf('H4') == 0) {
        lineHtml = '<h4>' + _lineWikiToHtml(line.substring(2)) + '</h4>';
    } else if (line.indexOf('H5') == 0) {
        lineHtml = '<h5>' + _lineWikiToHtml(line.substring(2)) + '</h5>';
    } else if (line.indexOf('H6') == 0) {
        lineHtml = '<h6>' + _lineWikiToHtml(line.substring(2)) + '</h6>';
    } else {
        return false;
    }

    parentStack.resetLevels();
    parentStack.apendToTop(lineHtml);
    return true;
}

function _markupToFlexHtmlLists(line, level) {
    if (line.indexOf('-') != 0 && line.indexOf('#') != 0) return false;
    if (_markupToFlexHtmlLists(line.substring(1), level + 1)) return true;

    var isBullet = (line.indexOf('-') == 0);
    parentStack.resetNumberingAboveLevel(level);
    var lineHtml = _getFlexHtmlListRow(line, level, isBullet);
    parentStack.apendToTop(lineHtml);
    return true;
}

function _getFlexHtmlListRow(line, level, isBullet) {
    var cls= isBullet ? 'njsFlexListBullet' : 'njsFlexListNumber';
    cls += ' level-' + (level+1);
    var content= isBullet ? '' : '' + parentStack.getCurrentNumber(level);
    var ret = '<div class="njsFlexList">';
    for(var i=0; i<level; i++)
        ret += '<div class="njsFlexListBulletHolder"></div>';
    ret += nl.fmt2('<div class="njsFlexListBulletHolder"><div class="{}">{}</div></div>', cls, content);
    return ret + '<div class="njsFlexListText">' 
        + _lineWikiToHtml(line.substring(1)) + '</div></div>';
}

function _lineWikiToHtml(line) {
    line = _handleSpace(line);
    return _handleLink(line);
}

function _handleSpace(line) {
    return line.replace(/\s\s/g, ' &nbsp;');
}

function _handleLink(line) {
    return _parseWikiMarker(line, 'link:', function(link, avpairs) {
        if (link == '') return '';
        var title = 'text' in avpairs ? avpairs['text'] : link;
        var newTab = 'popup' in avpairs && avpairs['popup'] == "1" ? ' target="_blank"' : '';
        return nl.fmt2('<a{} href="{}">{}</a>', newTab, link, title);
    });
}

function _breakWikiMarkup(line) {
    var ret = {};
    _parseWikiMarker(line, '.*\\:', function(link, avpairs, marker) {
        ret.link = link;
        ret.type = marker.replace(':', '');
        ret.choices = [];
        var choices = link.split(/\,/);
        for(var i=0; i<choices.length; i++) ret.choices.push(choices[i].trim());
        for (var attr in avpairs) ret['_' + attr] = avpairs[attr];
        return '';
    });
    return ret;
}

function _parseWikiMarker(line, marker, fn, dontConvertUrl) {
    var regex=new RegExp(nl.fmt2('({})([^\\[]*)(\\[.*?\\])?', marker), 'g');
    return line.replace(regex, function(match, mark, link, param, offset, allstr) {
        param = (typeof param === 'string' && param !== '') ? param.substring(1, param.length-1) : '';
        link = (typeof link !== 'string') ? '' : link;
        var params = param.split('|');
        var avpairs = {};
        for (var i in params) {
            var avpair = params[i].split('=');
            if (avpair.length != 2) continue;
            avpairs[avpair[0]] = avpair[1];
        }
        if (!dontConvertUrl) link = _convertUrl(link);
        return fn(link, avpairs, mark);
    });
}

var _d='1262923201347'; // Some kind of fixed string in URL as a distractor
var _v='03';
function _convertUrl(link) {
    if (link.indexOf('/resource/resview/') < 0) return link;
    if (!_gid) return link;
    return nl.fmt2('{}?_d={}&_v={}&_g={}', link, _d, _v, _gid);
}

}];

//-------------------------------------------------------------------------------------------------
function ParentStack() {
    this.items = [{text: ''}];
    this.currentNumber = {};
    
    this.init = function() {
        this.items = [{text: ''}];
        this.currentNumber = {};
    };

    this.getCurrentNumber = function(level) {
        if (!this.currentNumber[level]) this.currentNumber[level] = 0;
        this.currentNumber[level]++;
        return this.currentNumber[level];
    };
    
    this.getText = function() {
        return this.items[0].text;
    };

    this.apendToTop = function(text) {
        this.items[this.items.length - 1].text += text;
    };
    
    this.resetLevels = function() {
        this.nestToLevel(0, '');
        this.resetNumberingAboveLevel(-1);
    };
    
    this.resetNumberingAboveLevel = function(level) {
        for(var l in this.currentNumber) {
            if (l > level) this.currentNumber[l] = 0;
        }
    };

    this.nestToLevel = function(level, text) {
        var curLevel = this.items.length - 1;
        if (curLevel == level) {
            return;
        } else if (curLevel > level) {
            for (var i = curLevel; i > level; i--) {
                var elem = this.items.pop();
                if (elem.text.indexOf('<ul>') == 0) {
                    elem.text += '</ul>';
                } else if (elem.text.indexOf('<ol>') == 0) {
                    elem.text += '</ol>';
                }
                this.apendToTop(elem.text);
            }
        } else {
            for (var i = curLevel; i < level; i++) {
                this.items.push({text:text});
            }
        }
    };
}

//-------------------------------------------------------------------------------------------------
var AdjustHeightDirective = ['nl',
function(nl) {
	function _updateHeight(element, factor) {
    	nl.timeout(function() {
        	var width = element[0].getBoundingClientRect().width;
        	element.css({height: (width > 0 ? width*factor : 400) + 'px'});
    	});
	}

	function _postLink(scope, element, attrs) {
		var factor = parseFloat(attrs.nlAdjustHeight||0.5625);
		_updateHeight(element, factor);
	    nl.resizeHandler.onResize(function() {
			_updateHeight(element, factor);
	    });
	    nl.resizeHandler.onEvent('nl_adjust_height', function() {
			_updateHeight(element, factor);
	    });
	}
	
	return {restrict: "A", link: _postLink}; 
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

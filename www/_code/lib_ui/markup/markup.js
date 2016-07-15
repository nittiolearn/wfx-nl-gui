(function() {

//-------------------------------------------------------------------------------------------------
// markup service markup.js:
// Common functionality used in all the course controllers
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.ui.markup', [])
	.filter('nlMarkupToHtml', NlMarkupToHtml)
    .service('nlMarkup', NlMarkupSrv);
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
var NlMarkupSrv = ['nl', 
    function (nl) {
//-----------------------------------------------------------------------------------
//convert Html text to plain text.
//-----------------------------------------------------------------------------------    
this.getHtml = function (markupStr, retData) {
	var lines = markupStr.split('\n');
	var lessPara = retData.lessPara;
	if (!lessPara || lines.length > 1) lessPara = false;
	retData.isTxt = (lines.length > 1);
	
	var parentStack = [''];
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];
		_textToHtmlLine(line, parentStack, lessPara, retData);
	}
	_nestToLevel(parentStack, 0, '');
	return parentStack[0];
};

//-------------------------------------------------------------------------------------------------
// To be deep checked
function _textToHtmlLine(line, parentStack, lessPara, retData) {
	if (_textToHtmlHeading(line, parentStack)) {
		retData.isTxt = true;
		return;
	} else if (_textToHtmlLists(line, parentStack, 0)) {
		retData.isTxt = true;
		return;
	} else if (_textToHtmlXxxInline(line, parentStack, _textToHtmlImg, retData.isTxt)) {
		return;
	}

	_nestToLevel(parentStack, 0, '');
	var lineHtml = _lineWikiToHtml(line);
	if (!lessPara) lineHtml = '<p>' + lineHtml + '</p>';
	if (!lessPara && line == '') {
		lineHtml = '<br/>';
	}
	_apendToTopElem(parentStack, lineHtml);
	retData.isTxt = true;
}

function _textToHtmlHeading(line, parentStack) {
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

	_nestToLevel(parentStack, 0, '');
	_apendToTopElem(parentStack, lineHtml);
	return true;
}

function _textToHtmlLists(line, parentStack, level) {
	if (line.indexOf('-') != 0 && line.indexOf('#') != 0) {
		return false;
	}

	if (_textToHtmlLists(line.substring(1), parentStack, level + 1)) {
		return true;
	}

	if (line.indexOf('-') == 0) {
		_nestToLevel(parentStack, level + 1, '<ul>');
	} else {
		_nestToLevel(parentStack, level + 1, '<ol>');
	}

	var lineHtml = '<li>' + _lineWikiToHtml(line.substring(1)) + '</li>';
	_apendToTopElem(parentStack, lineHtml);
	return true;
}

function _textToHtmlXxxInline(line, parentStack, xxxFn, bInline) {
	var lineHtml = xxxFn(line, bInline);
	if (lineHtml == '') return false;
	_nestToLevel(parentStack, 0, '');
	_apendToTopElem(parentStack, lineHtml);
	return true;
}

function _textToHtmlImg(str, bInline) {
	if (!_checkMarkup(str, 'img:')) return '';
	var cls = bInline ? 'inline_obj' : 'retain_aspect_ratio';
	return _parseWikiMarker(str, 'img:', function(imgUrl, avpairs) {
		if (imgUrl == '') return '';
		var html = nl.fmt2('<img class="{} njs_img" src="{}" />', cls, imgUrl);
		if ('link' in avpairs) html = n.fmt2('<a href="{}">{}</a>', avpairs['link'], html);
		return html;
	});
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
		var newTab = 'popup' in avpairs && avpairs['popup'] == "1" ? 'target="_blank"' : '';
		return nl.fmt2('<a {} href="{}">{}</a>', newTab, link, title);
	});
}

function _checkMarkup(str, markup) {
	var re = new RegExp(nl.fmt2('^\\s*{}', markup));
	if (str.match(re)) return true;
	return false;
}

function _apendToTopElem(parentStack, line) {
	return parentStack[parentStack.length - 1] += line;
}

function _nestToLevel(parentStack, level, parentItem) {
	var curLevel = parentStack.length - 1;
	if (curLevel == level) {
		return;
	} else if (curLevel > level) {
		for (var i = curLevel; i > level; i--) {
			var elem = parentStack.pop();
			if (elem.indexOf('<ul>') == 0) {
				elem += '</ul>';
			} else if (elem.indexOf('<ol>') == 0) {
				elem += '</ol>';
			}
			_apendToTopElem(parentStack, elem);
		}
	} else {
		for (var i = curLevel; i < level; i++) {
			parentStack.push(parentItem);
		}
	}
}

function _parseWikiMarker(line, marker, fn) {
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
		return fn(link, avpairs, mark);
	});
}

}];

module_init();
})();

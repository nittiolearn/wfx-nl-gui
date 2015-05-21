njs_lesson_markup = function() {

//#############################################################################################
// Conversion methods for all nittio-wiki-markups inside lesson content to html fragment
//#############################################################################################
function markupToHtml(markupStr, retData) {
	var lines = markupStr.split('\n');
	var lessPara = retData.lessPara;
	if (!lessPara || lines.length > 1) lessPara = false;
	retData.isTxt = (lines.length > 1);
	
	var parentStack = [''];
	for (var i = 0; i < lines.length; i++) {
		line = lines[i];
		_markupToHtmlLine(line, parentStack, lessPara, retData);
	}
	_nestToLevel(parentStack, 0, '');
	return parentStack[0];
}

function _markupToHtmlLine(line, parentStack, lessPara, retData) {
	if (_markupToHtmlHeading(line, parentStack)) {
		retData.isTxt = true;
		return;
	} else if (_markupToHtmlLists(line, parentStack, 0)) {
		retData.isTxt = true;
		return;
	} else if (_markupToHtmlXxxInline(line, parentStack, _markupToHtmlImg, retData.isTxt)) {
		return;
	} else if (_markupToHtmlXxxInline(line, parentStack, _markupToHtmlAudio, retData.isTxt)) {
		return;
	} else if (_markupToHtmlXxxInline(line, parentStack, _markupToHtmlVideo, retData.isTxt)) {
		return;
	} else if (_markupToHtmlXxxInline(line, parentStack, _markupToHtmlPdf, retData.isTxt)) {
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

function _markupToHtmlXxxInline(line, parentStack, xxxFn, bInline) {
	var lineHtml = xxxFn(line, bInline);
	if (lineHtml == '') return false;
	_nestToLevel(parentStack, 0, '');
	_apendToTopElem(parentStack, lineHtml);
	return true;
}

function _checkMarkup(str, markup) {
	var re = new RegExp(njs_helper.fmt2('^\\s*{}', markup));
	if (str.match(re)) return true;
	return false;
}

function _markupToHtmlImg(str, bInline) {
	if (!_checkMarkup(str, 'img:')) return '';
	var cls = bInline ? 'inline_obj' : 'retain_aspect_ratio';
	return _parseWikiMarker(str, 'img:', function(imgUrl, avpairs) {
		if (imgUrl == '') return '';
		var html = njs_helper.fmt2('<img class="{} njs_img" src="{}" />', cls, imgUrl);
		if ('link' in avpairs) html = njs_helper.fmt2('<a href="{}">{}</a>', avpairs['link'], html);
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
		var attrs = njs_helper.fmt2('njsPdfUrl="{}" njsPdfPage="{}" njsPdfScale="{}"', link, page, scale);
		return njs_helper.fmt2('<div class="njs_pdf_holder {}" {}></div>', cls, attrs);
	});
}

function _markupToHtmlAudio(str, bInline) {
	if (!_checkMarkup(str, 'audio:')) return '';
	return _parseWikiMarker(str, 'audio:', function(link, avpairs) {
		if (link == '') return '';
		var title = '';
		if ('text' in avpairs) title = njs_helper.fmt2('<div>{}</div>',"avpairs['text']");
		
		var pos = ('start' in avpairs) || ('end' in avpairs) ? '#t=' : '';
		pos += 'start' in avpairs ? njs_helper.fmt2('{}', avpairs['start']) : '';
		pos += 'end' in avpairs ? njs_helper.fmt2(',{}', avpairs['end']) : '';			
		return njs_helper.fmt2('{}<audio preload controls class="njs_audio" src="{}{}" />',title,link,pos); 
	});
}

function _markupToHtmlVideo(str, bInline) {
	if (!_checkMarkup(str, 'embed:') && !_checkMarkup(str, 'video:')) return '';
	if(_checkMarkup(str, 'video:')) str = str.replace('video:','embed:');
	return _parseWikiMarker(str, 'embed:', function(link, avpairs) {
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
			var pos = 'start' in avpairs ? njs_helper.fmt2('&start={}', avpairs['start']) : '';
			pos += 'end' in avpairs ? njs_helper.fmt2('&end={}', avpairs['end']) : '';
			return njs_helper.fmt2('<iframe data-njsYouTube src="{}{}?modestBranding=1&rel=0&html5=1&enablejsapi=1{}" class="reset_height" allowfullscreen></iframe>', protocol, url, pos);		
		}
		var pos = ('start' in avpairs) || ('end' in avpairs) ? '#t=' : '';
		pos += 'start' in avpairs ? njs_helper.fmt2('{}', avpairs['start']) : '';
		pos += 'end' in avpairs ? njs_helper.fmt2(',{}', avpairs['end']) : '';			
		return njs_helper.fmt2('<video preload controls class="njs_video reset_height"><source src="{}{}"/></video>',link,pos);
	});
}

function _markupToHtmlHeading(line, parentStack) {
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

function _markupToHtmlLists(line, parentStack, level) {
	if (line.indexOf('-') != 0 && line.indexOf('#') != 0) {
		return false;
	}

	if (_markupToHtmlLists(line.substring(1), parentStack, level + 1)) {
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
		return njs_helper.fmt2('<a {} href="{}">{}</a>', newTab, link, title);
	});
}

function breakWikiMarkup(line) {
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

function parseWikiMarker(line, marker, fn) {
	return _parseWikiMarker(line, marker, fn);
}

function _parseWikiMarker(line, marker, fn) {
	var regex=new RegExp(njs_helper.fmt2('({})([^\\[]*)(\\[.*?\\])?', marker), 'g');
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

function _apendToTopElem(parentStack, line) {
	parentStack[parentStack.length - 1] += line;
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

return {
	markupToHtml : markupToHtml,
	breakWikiMarkup: breakWikiMarkup,
	parseWikiMarker: parseWikiMarker
};

}();
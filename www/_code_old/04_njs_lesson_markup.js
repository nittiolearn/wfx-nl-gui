njs_lesson_markup = function() {

//#############################################################################################
// Whole code is moved to new infrastructure
//#############################################################################################
function markupToHtml(markupStr, retData) {
    return window.nlapp.nlMarkup.getHtml(markupStr, retData);
}

function breakWikiMarkup(line) {
    return window.nlapp.nlMarkup.breakWikiMarkup(line);
}

function parseWikiMarker(line, marker, fn) {
    return window.nlapp.nlMarkup.parseWikiMarker(line, marker, fn);
}

return {
	markupToHtml : markupToHtml,
	breakWikiMarkup: breakWikiMarkup,
	parseWikiMarker: parseWikiMarker
};

}();
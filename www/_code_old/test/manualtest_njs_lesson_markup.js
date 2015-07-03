var njs_test_dummy = function() {

//-------------------------------------------------------------------------------------------
// QUnit manual testcases 
//-------------------------------------------------------------------------------------------

//-------------------------------------------------------------------------------------------
QUnit.module( "njs_lesson_markup.markupToHtml");
//-------------------------------------------------------------------------------------------
QUnit.asyncTest('njs_lesson_markup.markupToHtml Manual', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 1);
	var tcdata = {url: 'http://cdn.mozilla.net/pdfjs/tracemonkey.pdf', automatic: false};

	var content = 'H1 PDF Page 0 - error expected\r\n';
	content += njs_helper.fmt2('pdf:{}[page=0|scale=1]\r\n', tcdata.url);
	content += 'H1 PDF Page 1 on junk - error expected\r\n';
	content += njs_helper.fmt2('pdf:{}.junk[page=1|scale=1]\r\n', tcdata.url);
	content += 'H1 PDF Page 2 - success\r\n';
	content += njs_helper.fmt2('pdf:{}[page=2|scale=1]\r\n', tcdata.url);
	content += 'H1 PDF Page 3 - success\r\n';
	content += njs_helper.fmt2('pdf:{}[page=3]\r\n', tcdata.url);
	content += 'H1 PDF Page 1 - success\r\n';
	content += njs_helper.fmt2('pdf:{}\r\n', tcdata.url);
	content += 'H1 PDF Page 1 again - success\r\n';
	content += njs_helper.fmt2('pdf:{}[scale=1]\r\n', tcdata.url);
	content += 'H1 Image - success\r\n';
	content += njs_helper.fmt2('img:http://www.clker.com/cliparts/M/e/M/l/h/X/grey-mouse-with-cheese-md.png\r\n');
	content += 'H1 Youtube - success\r\n';
	content += njs_helper.fmt2('video:http://www.youtube.com/watch?v=htOtW0pD92Y[start=30|end=60]\r\n');

	tcdata.content = content;
	tc.execute(njs_test.TestFunctions.markupToHtmlTester, tcdata);
});


}(); // test_njs_dummy
var njs_test_dummy = function() {

//-------------------------------------------------------------------------------------------
// QUnit automated testcases 
//-------------------------------------------------------------------------------------------

//-------------------------------------------------------------------------------------------
QUnit.module( "njs_pdf.PDF");
//-------------------------------------------------------------------------------------------

QUnit.asyncTest('PDF - success opening', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 1);
	var tcdata = {url: 'http://cdn.mozilla.net/pdfjs/tracemonkey.pdf', result: true};
	tc.execute(_PdfOpen, tcdata);
});

QUnit.asyncTest('PDF - error opening', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 1);
	var tcdata = {url: 'http://cdn.mozilla.net/pdfjs/tracemonkey1.pdf', result: false};
	tc.execute(_PdfOpen, tcdata);
});

function _PdfOpen(na, qRestarter, tcdata) {
	na.setExpectedAssertions(1);
	var pdfObj = njs_pdf.Pdf.get(tcdata.url);
	pdfObj.onLoadDone(function(bSuccess, errorMsg, exception) {
		if (!bSuccess) {
			na.assert(tcdata.result == bSuccess, 
					njs_helper.fmt2('PDF loading failed: error={}, exception={}', errorMsg, exception));
			na.checkExpectedAssertions();
			qRestarter.chainDone();
			return;
		}
		na.assert(true, njs_helper.fmt2('PDF loaded. Page count: {}', pdfObj.getPageCount()));
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	});
}

//-------------------------------------------------------------------------------------------
QUnit.module( "njs_pdf.RenderQueue");
//-------------------------------------------------------------------------------------------
QUnit.asyncTest('PDF RenderQueue', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 1);
	var tcdata = {url: 'http://cdn.mozilla.net/pdfjs/tracemonkey.pdf', automatic: true};

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

	tcdata.content = content;
	tc.execute(njs_test.TestFunctions.markupToHtmlTester, tcdata);
});

function _PdfRenderQueue(na, qRestarter, tcdata) {
	na.setExpectedAssertions(4);

	var _dlg = new njs_helper.Dialog();
	var cls = 'inline_obj';
	var container = jQuery("<div id='PdfRenderQueueTestDialog' njsTitle='Pdf RenderQueue Test Dialog'/>");
	for(var i=0; i<10; i++) {
		// First 2 pages should come as error
		var url = (i == 1) ? tcdata.url + '.junk' : tcdata.url;
		var attrs = njs_helper.fmt2('njsPdfUrl="{}" njsPdfPage="{}" njsPdfScale="{}"', url, i, 1.0);
		var holder = njs_helper.fmt2('<div class="njs_pdf_holder {}" {}></div>', cls, attrs);
		container.append(njs_helper.fmt2("<div><h1>Page {}</h1></div>", i));
		container.append(holder);
	}
	_dlg.create('PdfRenderQueueTestDialog', container, []);
	container = jQuery('#PdfRenderQueueTestDialog');
	na.assert(true, 'dlg.create done');

	var chain = new njs_helper.AsyncFunctionChain(function(errorMessage) {
		na.assert(false, 'Unexpected error message thrown: ' + errorMessage);
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	});

	chain.add(function() {
		_dlg.onShowDone(function() {
			na.assert(true, 'dlg.show done');
			chain.done();
		});
		_dlg.show();
	});
	
	var renderQueue = null;
	chain.add(function() {
		var renderQueue = njs_pdf.RenderQueue(container, function() {
			na.assert(true, 'render complete');
			_dlg.close(function() {
				na.assert(true, 'Dialog box closed');
				na.checkExpectedAssertions();
				qRestarter.chainDone();
			});
		});
	});
}

}(); // test_njs_dummy
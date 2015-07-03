var njs_test_dummy = function() {

//-------------------------------------------------------------------------------------------
// QUnit manual testcases 
//-------------------------------------------------------------------------------------------

//-------------------------------------------------------------------------------------------
QUnit.module( "njs_helper.AddResourceDlg");
//-------------------------------------------------------------------------------------------

QUnit.asyncTest('AddResourceDlg.upload', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 1);
	tc.execute(_AddResourceDlg);
});

function _AddResourceDlg(na, qRestarter) {
	na.setExpectedAssertions(1);
	njs_helper.AddResourceDlg.uploadResource(function(resUrl) {
		na.assert(true, 'Got resUrl: ' + resUrl);
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	});
}

//-------------------------------------------------------------------------------------------
QUnit.module( "njs_helper.TextEditorDlg");
//-------------------------------------------------------------------------------------------

QUnit.asyncTest('TextEditorDlg.show', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 1);
	tc.execute(_TextEditorDlg);
});

function _TextEditorDlg(na, qRestarter) {
	na.setExpectedAssertions(1);
	njs_helper.TextEditorDlg.show('initial content', function(newcontent) {
		na.assert(true, 'Got new content: ' + newcontent);
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	});
}

//-------------------------------------------------------------------------------------------
QUnit.module( "njs_helper.LoginDlg");
//-------------------------------------------------------------------------------------------

QUnit.asyncTest('LoginDlg', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 1);
	tc.execute(_LoginDlg);
});


function _LoginDlg(na, qRestarter) {
	na.setExpectedAssertions(4);

	var chain = new njs_helper.AsyncFunctionChain(function(errorMessage) {
		na.assert(false, 'Login failed: ' + errorMessage);
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	});

	var dlg = new njs_helper.LoginDlg(chain);
	na.assert(true, 'Login box created');
	chain.add(function() {
		dlg.show();
		na.assert(true, 'Login box shown');
	});
	chain.add(function() {
		dlg.loginAjax();
		na.assert(true, 'Login initiated');
	});
	chain.add(function() {
		na.assert(true, 'Login successful');
		na.checkExpectedAssertions();
		qRestarter.chainDone();
		chain.done();
	});
}

}(); // test_njs_dummy
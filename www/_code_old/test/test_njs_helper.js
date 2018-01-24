var njs_test_dummy = function() {

//-------------------------------------------------------------------------------------------
// QUnit automated testcases 
//-------------------------------------------------------------------------------------------

//-------------------------------------------------------------------------------------------
QUnit.module( "njs_helper.AsyncFunctionChain");
//-------------------------------------------------------------------------------------------

QUnit.asyncTest('AsyncFunctionChain', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 1);
	tc.execute(_AsyncFunctionChain);
});

QUnit.asyncTest('AsyncFunctionChain - Parallel 10', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 10);
	tc.execute(_AsyncFunctionChain);
});

function _AsyncFunctionChain(na, qRestarter) {
	na.setExpectedAssertions(10);

	var chain = new njs_helper.AsyncFunctionChain(function(errorMessage) {
		na.assert(true, 'Error message thrown as expected: ' + errorMessage);
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	});

	chain.add(function() {
		na.assert(true, 'Enter & Exit function 1');
		chain.done(1);
	});
	na.assert(true, 'Added function 1');

	chain.add(function() {
		na.assert(chain.getLastResult() == 1, 'Enter function 2');
		setTimeout(function() {
			na.assert(chain.getLastResult() == 1, 'Exit function 2');
			chain.done(2);
		}, 100);
	});
	na.assert(true, 'Added function 2');
	
	chain.add(function() {
		na.assert(chain.getLastResult() == 2, 'Enter function 3');
		setTimeout(function() {
			na.assert(chain.getLastResult() == 2, 'Exit function 3');
			chain.error('Function 3 throws exception');
		}, 100);
	});
	na.assert(true, 'Added function 3');

	chain.add(function() {
		na.assert(false, 'Enter function 4 - WATCH - this message should not come');
		chain.done(4);
	});
	na.assert(true, 'Added function 4');
}

//-------------------------------------------------------------------------------------------
QUnit.module( "njs_helper.Dialog");
//-------------------------------------------------------------------------------------------

QUnit.asyncTest('Dialog popup', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 1);
	tc.execute(_Dialog2);
});

QUnit.asyncTest('Dialog popupStatus', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 1);
	tc.execute(_Dialog4);
});

var _delay = 500;

function _Dialog2(na, qRestarter) {
	na.setExpectedAssertions(4);
	var content = '<h1>Start Content H1</h1>';
	content += '<ul>';
	content += '<li>Bullet point 1</li>';
	content += '<li>Bullet point 2</li>';
	content += '<li>Bullet point 3</li>';
	content += '<li>Bullet point 4</li>';
	content += '</ul>';
	content += '<h2>End of content H2</h2>';

	var chain = new njs_helper.AsyncFunctionChain(function(errorMessage) {
		na.assert(false, 'Unexpected error message thrown: ' + errorMessage);
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	});

	chain.add(function() {
		njs_helper.Dialog.popup('Warning Title', content);
		chain.done();
	});

	chain.add(function() {
		setTimeout(function() {
			jQuery('#defaultPopupDlg_top_close_button').click();
			na.assert(true, 'Warning Box closed');
			chain.done();
		}, _delay);
	});

	var okButton = {id: 'ok', text: 'Ok', fn: function() {
		njs_helper.Dialog.popdown();
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	}};
	var cancelButton = {id: 'cancel', text: 'Cancel', fn: function() {
		njs_helper.Dialog.popdown();
	}};

	var sizes = {top: '10%', left: '10%', width: '80%', height: '80%'};

	chain.add(function() {
		setTimeout(function() {
			njs_helper.Dialog.popup('Popup Title', content, [okButton], cancelButton);
			chain.done();
		}, _delay);
	});

	chain.add(function() {
		setTimeout(function() {
			jQuery('#defaultPopupDlg_top_close_button').click();
			na.assert(true, 'Popup Box closed with top button');
			chain.done();
		}, _delay);
	});

	chain.add(function() {
		setTimeout(function() {
			njs_helper.Dialog.popup('Popup Title', content, [okButton], cancelButton, sizes);
			chain.done();
		}, _delay);
	});

	chain.add(function() {
		setTimeout(function() {
			jQuery('#defaultPopupDlg_cancel').click();
			na.assert(true, 'Popup Box closed with cancel button');
			chain.done();
		}, _delay);
	});

	chain.add(function() {
		setTimeout(function() {
			njs_helper.Dialog.popup('Popup Title', content, [okButton], cancelButton, sizes);
			chain.done();
		}, _delay);
	});

	chain.add(function() {
		setTimeout(function() {
			na.assert(true, 'Popup Box closing with ok button');
			jQuery('#defaultPopupDlg_ok').click();
			chain.done();
		}, _delay);
	});
}

function _Dialog4(na, qRestarter) {
	na.setExpectedAssertions(1);
	njs_helper.Dialog.popupStatus('This is a popupStatus message. Please wait ...');
	na.assert(true, 'popupStatus done');
	na.checkExpectedAssertions();
	qRestarter.chainDone();
}

}(); // test_njs_dummy
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
QUnit.module( "njs_helper.AjaxInChain");
//-------------------------------------------------------------------------------------------

QUnit.asyncTest('Ajax', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 1);
	tc.execute(_Ajax1);
});

QUnit.asyncTest('Ajax - Parallel 5', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 5);
	tc.execute(_Ajax3);
});

function _Ajax1(na, qRestarter) {
	na.setExpectedAssertions(3);

	var chain = new njs_helper.AsyncFunctionChain(function(errorMessage) {
		na.assert(true, 'Error message thrown as expected: ' + errorMessage);
		_Ajax2(na, qRestarter);
	});

	var ajax = new njs_helper.AjaxInChain(chain);
	chain.add(function() {
		var url = njs_helper.fmt2('/default/client_templ.json/{}/{}', nittio.getStaticVersion(), 'add_res_dialog.html');
		ajax.send(url, {});
	});

	chain.add(function() {
		na.assert(true, 'Successful ajax: content of add_res_dialog.html:' + chain.getLastResult());
		chain.done();
	});

	chain.add(function() {
		var url = njs_helper.fmt2('/default/client_templ.json/{}/{}', nittio.getStaticVersion(), 'not_existing_template.html');
		ajax.send(url, {});
	});
}

function _Ajax2(na, qRestarter) {
	var chain = new njs_helper.AsyncFunctionChain(function(errorMessage) {
		na.assert(true, 'Error message thrown as expected: ' + errorMessage);
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	});

	var ajax = new njs_helper.AjaxInChain(chain);
	chain.add(function() {
		var url = njs_helper.fmt2('/not_existing_url/{}', nittio.getStaticVersion());
		ajax.send(url, {});
	});
}

function _Ajax3(na, qRestarter) {
	na.setExpectedAssertions(1);

	var chain = new njs_helper.AsyncFunctionChain(function(errorMessage) {
		na.assert(true, 'Unexpected error message thrown: ' + errorMessage);
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	});

	var ajax = new njs_helper.AjaxInChain(chain);
	chain.add(function() {
		ajax.send('/resource/get_res_types_and_upload_url.json', {});
	});

	chain.add(function() {
		var ret = chain.getLastResult();
		na.assert(true, 'Successful ajax: restypes:' + ret.restypes + ', uploadUrl:' + ret.uploadUrl);
		chain.done();
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	});
}

//-------------------------------------------------------------------------------------------
QUnit.module( "njs_helper.ClientSideTemplate");
//-------------------------------------------------------------------------------------------

QUnit.asyncTest('ClientSideTemplate', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 1);
	tc.execute(_ClientSideTemplate);
});

QUnit.asyncTest('ClientSideTemplate - parallel 10', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 10);
	tc.execute(_ClientSideTemplate);
});

function _ClientSideTemplate(na, qRestarter) {
	na.setExpectedAssertions(2);

	var chain = new njs_helper.AsyncFunctionChain(function(errorMessage) {
		na.assert(false, 'Unexpected error message thrown: ' + errorMessage);
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	});
	var template = new njs_helper.ClientSideTemplate('add_res_dialog.html', chain);
	chain.add(function() {
		template.render({restypes: ['PDF', 'Image']});
	});
	chain.add(function() {
		na.assert(true, 'Got result1: ' + chain.getLastResult());
		chain.done();
	});
	chain.add(function() {
		template.render({restypes: ['Image', 'Audio']});
	});
	chain.add(function() {
		na.assert(true, 'Got result2: ' + chain.getLastResult());
		chain.done();
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	});
}

//-------------------------------------------------------------------------------------------
QUnit.module( "njs_helper.Dialog");
//-------------------------------------------------------------------------------------------

QUnit.asyncTest('Dialog', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 1);
	tc.execute(_Dialog1);
});

QUnit.asyncTest('Dialog popup', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 1);
	tc.execute(_Dialog2);
});

QUnit.asyncTest('Dialog Multiple', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 1);
	tc.execute(_Dialog3);
});

QUnit.asyncTest('Dialog popupStatus', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 1);
	tc.execute(_Dialog4);
});

var _delay = 500;

function _Dialog1(na, qRestarter) {
	na.setExpectedAssertions(8);
	njs_helper.Dialog.popupStatus('This is automated test. Please do not click');
	
	var _dlg = new njs_helper.Dialog();

	var chain = new njs_helper.AsyncFunctionChain(function(errorMessage) {
		na.assert(false, 'Unexpected error message thrown: ' + errorMessage);
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	});

	var template = new njs_helper.ClientSideTemplate('add_res_dialog.html', chain);
	chain.add(function() {
		template.render({restypes: ['PDF', 'Image']});
	});
	chain.add(function() {
		var dlgFields = jQuery(chain.getLastResult());
		_dlg.create('addResource', dlgFields, [{id: 'add', text: 'Add', fn: on_button_click}]);
		na.assert(true, 'Dialog box is created');
		chain.done();
	});

	chain.add(function() {
		setTimeout(function() {
			_dlg.show();
			na.assert(true, 'Dialog box is displayed now');
			chain.done();
		}, _delay);
	});

	chain.add(function() {
		setTimeout(function() {
			njs_helper.Dialog.moveBack();
			na.assert(true, 'Dialog box is moved back');
			chain.done();
		}, _delay);
	});

	chain.add(function() {
		setTimeout(function() {
			njs_helper.Dialog.moveFront();
			na.assert(true, 'Dialog box is moved front');
			chain.done();
		}, _delay);
	});

	chain.add(function() {
		setTimeout(function() {
			_dlg.cancel();
			na.assert(true, 'Dialog box is cancelled');
			chain.done();
		}, _delay);
	});

	chain.add(function() {
		setTimeout(function() {
			_dlg.show();
			na.assert(true, 'Dialog box is shown again');
			chain.done();
		}, _delay);
	});

	chain.add(function() {
		setTimeout(function() {
			na.assert(true, 'Dialog box add button is clicked');
			jQuery('#addResource_add').click();
			chain.done();
		}, _delay);
	});

	function on_button_click() {
		na.assert(true, 'on_button_click called');
		_dlg.close(function() {
			_dlg.remove();
		});
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	}
}

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

function _Dialog3(na, qRestarter) {
	na.setExpectedAssertions(9);
	njs_helper.Dialog.popupStatus('This is automated test. Please do not click');
	
	var chain = new njs_helper.AsyncFunctionChain(function(errorMessage) {
		na.assert(false, 'Unexpected error message thrown: ' + errorMessage);
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	});

	var _dlgFieldsText = null;
	var _template = new njs_helper.ClientSideTemplate('add_res_dialog.html', chain);
	chain.add(function() {
		_template.render({restypes: ['PDF', 'Image']});
	});
	chain.add(function() {
		_dlgFieldsText = chain.getLastResult();
		chain.done();
	});

	var _dlg1 = new njs_helper.Dialog();
	var _dlg2 = new njs_helper.Dialog();
	var _dlg3 = new njs_helper.Dialog();

	chain.add(function() {
		_dlg1.create('addResource1', jQuery(_dlgFieldsText), [{id: 'add', text: 'Add 1', fn: on_dlg1_click}]);
		_dlg2.create('addResource2', jQuery(_dlgFieldsText), [{id: 'add', text: 'Add 2', fn: on_dlg2_click}]);
		_dlg3.create('addResource3', jQuery(_dlgFieldsText), [{id: 'add', text: 'Add 3', fn: on_dlg3_click}]);
		_dlg1.show();
		na.assert(true, 'Dialog boxes is created - first one shown');
		chain.done();
	});

	chain.add(function() {
		setTimeout(function() {
			_dlg2.show({top: '10%', left: '55%', width: '40%', height: '80%'});
			na.assert(true, 'Dialog 2 shown');
			chain.done();
		}, _delay);
	});

	chain.add(function() {
		setTimeout(function() {
			_dlg3.show({top: '10%', left: '5%', width: '40%', height: '80%'});
			na.assert(true, 'Dialog 3 shown');
			chain.done();
		}, _delay);
	});

	chain.add(function() {
		setTimeout(function() {
			njs_helper.Dialog.popup('Warning Title', 'Warning Text');
			na.assert(true, 'Warning Box shown');
			chain.done();
		}, _delay);
	});

	chain.add(function() {
		setTimeout(function() {
			jQuery('#defaultPopupDlg_top_close_button').click();
			na.assert(true, 'Warning Box closed');
			chain.done();
		}, _delay);
	});

	chain.add(function() {
		setTimeout(function() {
			jQuery('#addResource3_cancel').click();
			na.assert(true, 'Dialog 3 cancelled');
			chain.done();
		}, _delay);
	});

	chain.add(function() {
		setTimeout(function() {
			jQuery('#addResource2_top_close_button').click();
			na.assert(true, 'Dialog 2 cancelled');
			chain.done();
		}, _delay);
	});

	chain.add(function() {
		setTimeout(function() {
			na.assert(true, 'Dialog 1 closing');
			jQuery('#addResource1_add').click();
			chain.done();
		}, _delay);
	});

	function on_dlg3_click() {
		na.assert(false, 'UNEXPECTED: on_dlg3_click called');
		_dlg3.close();
	}

	function on_dlg2_click() {
		na.assert(false, 'UNEXPECTED: on_dlg2_click called');
		_dlg2.close();
	}

	function on_dlg1_click() {
		na.assert(true, 'on_dlg1_click called');
		_dlg1.close(function() {
			_dlg3.remove();
			_dlg2.remove();
			_dlg1.remove();
		});
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	}
}

function _Dialog4(na, qRestarter) {
	na.setExpectedAssertions(1);
	njs_helper.Dialog.popupStatus('This is a popupStatus message. Please wait ...');
	na.assert(true, 'popupStatus done');
	na.checkExpectedAssertions();
	qRestarter.chainDone();
}

//-------------------------------------------------------------------------------------------
QUnit.module( "njs_helper.AddResourceDlg");
//-------------------------------------------------------------------------------------------

QUnit.asyncTest('AddResourceDlg', function(assert) {
	var tc = new njs_test.ParallelTestCases(assert, 1);
	tc.execute(_AddResourceDlg);
});

function _AddResourceDlg(na, qRestarter) {
	na.setExpectedAssertions(4);
	njs_helper.Dialog.popupStatus('This is automated test. Please do not click');
	
	var chain = new njs_helper.AsyncFunctionChain(function(errorMessage) {
		na.assert(false, 'Unexpected error message thrown: ' + errorMessage);
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	});
	
	var _dlg = new njs_helper.AddResourceDlg(chain);
	chain.add(function() {
		setTimeout(function() {
			na.assert(true, 'Pressing add in the dialog box without filling data');
			jQuery('#addResource_add').click();
	
			setTimeout(function() {
				na.assert(true, 'Clearing the warning box');
				jQuery('#defaultPopupDlg_top_close_button').click();
	
				setTimeout(function() {
					na.assert(true, 'Pressing close button in the dialog box without filling data');
					jQuery('#addResource_top_close_button').click();
				}, _delay);
	
			}, _delay);
	
		}, 1000);
		chain.done();
	});

	chain.add(function() {
		_dlg.upload();
	});

	chain.add(function() {
		var fileName = chain.getLastResult();
		na.assert(true, 'Got File Name ' + fileName);
		na.checkExpectedAssertions();
		qRestarter.chainDone();
		chain.done();
	});
}

}(); // test_njs_dummy
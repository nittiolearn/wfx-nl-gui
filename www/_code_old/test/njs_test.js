njs_test = function() {
//#############################################################################################
// Assorted helper methods for QUnit testcases and commonly resued test functions
//#############################################################################################

// Helper to insert prefix for all asserts - also has a method to check if expected number
// of assertion was called (to ensure all expected parts of code got executed!)
function NamedAssert(assert, prefix) {
	if (prefix === undefined) {
		prefix = '';
	} else {
		prefix = prefix + ': ';
	}
	
	this.assert = function(assertion, msg) {
		assert.ok(assertion, prefix + msg);
		_actualAssertions++;
	};

	// Optional feature - can setExpectedAssertions and checkExpectedAssertions at end
	var _expectedAssertions = null;
	var _actualAssertions = 0;
	this.setExpectedAssertions = function(expectedAssertions) {
		_expectedAssertions = expectedAssertions;
	};
	
	this.checkExpectedAssertions = function() {
		if (_expectedAssertions === null) return;
		this.assert(_expectedAssertions === _actualAssertions, 'Assertion counts: expected=' + _expectedAssertions + ', actual=' + _actualAssertions);
	};

}

// Helper to restart QUnit exeuction. This is called from QUint.asyncTest testcases. Create
// a new QUnitRestarter with max parallel running chain. Each chain should call chainDone()
// at end of chain execution to restart the testcase execution.
function QUnitRestarter(parallelChainCount) {
	this.runningChains = parallelChainCount;
	this.chainDone = function() {
		this.runningChains--;
		if (this.runningChains == 0) QUnit.start();
	};
}

// Helper to Execute multiple asyncTest cases in parallel.
function ParallelTestCases(assert, parallelChains) {
	this.execute = function(tescaseFunction, tcData) {
		var qRestarter = new njs_test.QUnitRestarter(parallelChains);
		for(var i=0; i<parallelChains; i++) {
			var na = new njs_test.NamedAssert(assert, 'Chain ' + (i+1));
			tescaseFunction(na, qRestarter, tcData);
		}
	};
}

//#############################################################################################
// Commonly resued test functions
//#############################################################################################
function TestFunctions() {
	
}

TestFunctions.markupToHtmlTester = function(na, qRestarter, tcdata) {
	na.setExpectedAssertions(4);

	var dlgFields = jQuery("<div id='MarkupToHtmlTestDlg' njsTitle='Markup to Html Test Dialog'/>");
	dlgFields.append(jQuery("<textarea class='ta' style='position: absolute; top: 1%; left: 1%; width:95%; height: 25%;'/>"));
	dlgFields.append(jQuery("<div style='position: absolute; top: 27%; left: 1%; width:95%; height: 3%;'><button class='but'>Update</button></div>"));
	dlgFields.append(jQuery("<div class='cont' style='position: absolute; top: 33%; left: 1%; width:95%; height: 56%; overflow:auto;'/>"));

	var dlg = new njs_helper.Dialog();

	var cancelButton = {id:'close', text: 'Inspect output and manually press close', fn: function() {
		dlg.close(function() {
			dlg.remove();
			na.assert(true, 'Dialog box closed');
			na.checkExpectedAssertions();
			qRestarter.chainDone();
		});
	}};

	dlg.create('MarkupToHtmlTestDlg', dlgFields, [], cancelButton);
	na.assert(true, 'dlg.create done');

	var container = jQuery('#MarkupToHtmlTestDlg .cont');
	var button = jQuery('#MarkupToHtmlTestDlg .but');
	var textarea = jQuery('#MarkupToHtmlTestDlg .ta');
	
	textarea.val(tcdata.content);
	
	var renderQueue = null;
	button.click(function() {
		var val = textarea.val();
		var temp ={};
		var markup = njs_lesson_markup.markupToHtml(val, temp);
		container.html(markup);
		if (renderQueue) renderQueue.clear();
		renderQueue = njs_pdf.RenderQueue(container, function() {
			if (!tcdata.automatic) return;
			jQuery('#MarkupToHtmlTestDlg_close').click();
		});
	});

	na.assert(true, 'fields setup done');
	
	var chain = new njs_helper.AsyncFunctionChain(function(errorMessage) {
		na.assert(false, 'Unexpected error message thrown: ' + errorMessage);
		na.checkExpectedAssertions();
		qRestarter.chainDone();
	});

	chain.add(function() {
		dlg.onShowDone(function() {
			na.assert(true, 'dlg.show done');
			if(tcdata.automatic) button.click();
			chain.done();
		});
		dlg.show();
	});
	
	chain.add(function() {
		// In automatic test, click the button here
	});
};

//-------------------------------------------------------------------------------------------
// Exposed methods
//-------------------------------------------------------------------------------------------
return {
	NamedAssert: NamedAssert,
	QUnitRestarter: QUnitRestarter,
	ParallelTestCases: ParallelTestCases,
	TestFunctions: TestFunctions
};

}();
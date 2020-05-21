(function() {

//-------------------------------------------------------------------------------------------------
// expression_processor.js:
// Utilities for processing expressions used in Course Gate items. May be used in
// other places. Current code has some security concerns as the expression is 
// evaluated (eval statement) and could contain dangerous code!
//
// ExpressionProcessor_process is the entry point
// payload is a dict containing input and output arguments for the function.
// input: 'strExpression' and 'dictAvps'
// output: 'error' and 'result'. If call is successful, 'result' has the value and
//         'error' is empty string. If call fails, 'error' has th error message and
//         'result' is None. 
// Look at the test code for usage of API.
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.expression_processor', [])
    .service('nlExpressionProcessor', nlExpressionProcessor);
}
//-------------------------------------------------------------------------------------------------
var nlExpressionProcessor = ['nl',
function(nl) {
    var self = this;
    //-------------------------------------------------------------------------------------------------
    this.process = function(payload) {
        return _process(payload);
    };

    this.getUsedVars = function(inputStr) {
        return _getUsedVars(inputStr);
    };

    //-------------------------------------------------------------------------------------------------
    // Test code: Uncomment the call this method in the end of this module for testing
    this.test = function() {
        var dictAvps = {};
        for(var i=0; i<100; i++) dictAvps[nl.fmt2('_id{}', i)] = i > 50 ? null : i;
        var testcases = [
            // Error Test Cases
            [null, '$max1{1}'],
            [null, '$max{_id400}'],
            [null, 'Munni+34'],

            // Success Testcases
            [6, '_id6'],
            [19, '_id6+_id6+_id7'],
            [2, '$cnt{_id6, _id12}'],
            [false, 'not $max{_id6, _id7}'],
            [17, '$max{_id3, _id4, _id5,_id17,_id3}'],
            [3, '$min{_id3, _id4, _id5,_id17,_id3}'],
            [32, '$sum{_id3, _id4, _id5,_id17,_id3}'],
            [6.4, '$avg{_id3, _id4, _id5,_id17,_id3}'],
            [11.5, '$avg_top{2, _id3, _id4, _id6,_id17,_id3}'],
            [10.5, '$avg_top{2,_id3, _id4, _id5} + _id6'],
            [6, '$nth_min{3, _id3, _id6, _id4, _id17, _id11}'],
            [4, '$nth_min{2, _id0, _id6, _id4,_id17, _id11}'],
            [0, '$nth_min{2, _id0, _id0, _id4,_id17, _id11}'],
            [7.5, '$if{$nth_min{2, _id1, _id2, _id3, _id4, _id5} > 0, $avg{_id6, _id7, _id8, _id9}, 0}'],
            [0, '$if{$nth_min{3, _id1, _id2, _id3, _id4, _id5} > 3, $avg{_id6, _id7, _id8, _id9}, 0}'],
            [2, '$if{_id55, 1, 2}'],
            [false, '($max{_id1,_id2} <= $avg_top{2, _id3, _id4, _id5} or _id6) and ($min{_id7, _id8} + $max{_id9, _id10} < $avg{_id11, _id12, _id13, _id14})'],

            [false, '$max{_id51,_id52} < $avg_top{2, _id53, _id54, _id55} or _id56 or ($cnt{_id56, _id57} + $sum{_id56, _id57} < 0)'],
            [7, '$max{_id51,_id2,_id53,_id4} + $avg_top{3, _id53, _id54, _id55, _id3, _id6}'],
        ];

        var ret = {succ: 0, payloads: []};
        var failCount = 0;
        for(var i=0; i<testcases.length; i++) {
            var tc = testcases[i];
            var payload = _testcase(tc[1], tc[0], dictAvps);
            ret.payloads.push(payload);
            if (payload['status']) ret.succ += 1;
            else {
                failCount++;
                console.log(nl.fmt2('Testcase-{}: failed', i), payload);
            }
        }
        console.log(nl.fmt2('Test Summary: {} executed, {} failed.', testcases.length, failCount));
        return ret;
    };

    this.getTestAttrs = function() {
        return ['strExpression', 'bracesReplaced1', 'bracesReplaced2', 'varsReplaced', 'funcsReplaced', 'error', 'result', 'expected', 'testResult'];
    };
    
    function _testcase(strExpression, expected, dictAvps) {
        var payload = {'strExpression': strExpression, 'dictAvps': dictAvps};
        self.process(payload);
        if (payload['error'] != '' && expected !== null) payload['testResult'] = 'Testcase failed: see error message';
        else if (payload['result'] != expected) payload['testResult'] = 'Testcase failed: result not expected';
        else if (expected === null) payload['testResult'] = 'Testcase Success: Check if error is as expected';
        else payload['testResult'] = 'Testcase Success';
        payload['expected'] = expected;
        payload['status'] = payload['result'] == expected;
        return payload;
    }

    //-------------------------------------------------------------------------------------------------
    // Actual code
    //-------------------------------------------------------------------------------------------------
    function _process(payload) {
        payload['error'] = '';
        payload['result'] = null;
        payload['inputNotDefined'] = false;
        payload['gate_start_after'] = {};
        
        payload['bracesReplaced1'] = _replaceAll(payload['strExpression'], '{', '([');
        payload['bracesReplaced2'] = _replaceAll(payload['bracesReplaced1'], '}', '])');
        payload['varsReplaced'] = _replaceVars(payload['bracesReplaced2'], payload);
        if (payload['error'] != '') return false;

        payload['funcsReplaced'] = payload['varsReplaced'];
        for (var f in self._functions) {
            payload['funcsReplaced'] = _replaceAll(payload['funcsReplaced'], f, self._functions[f]);
        }
        var pos = payload['funcsReplaced'].indexOf('$');
        if (pos >= 0) {
            var endPos = payload['funcsReplaced'].indexOf('(', pos);
            payload['error'] = nl.fmt2('Function {} is not defined', payload['funcsReplaced'].substring(pos, endPos));
            return false;
        }
    
        if (!_processJS(payload)) return false;
        try {
            payload['result'] = eval(payload['funcsReplaced']);
        } catch (e) {
            payload['error'] = nl.fmt2('Error evaluating expression: {}', e);
        }
        return true;
    }

    function _getUsedVars(inputStr) {
        var usedVars = {};
        inputStr.replace(/_id[\.\_a-zA-Z0-9]+/g, function(varName) {
            userVars[varName] = true;
        });
        return usedVars;
    }

    function _replaceVars(inputStr, payload) {
        return inputStr.replace(/_id[\.\_a-zA-Z0-9]+/g, function(varName) {
            if (varName in payload['dictAvps']) {
                var varVal = payload['dictAvps'][varName];
                if (varVal === null) payload['inputNotDefined'] = true;
                payload['gate_start_after'][varName] = true;
                return varVal;
            }
            if (payload['error'] == '') payload['error'] = nl.fmt2('{} is not found. Please use unique ids of items above the current item.', varName);
            return varName;
        });
    }

    function _replaceAll(inputStr, searchFor, replaceWith) {
        var arr = inputStr.split(searchFor);
        return arr.join(replaceWith);
    }

    function _processJS(payload) {
        // In JS side replace and, or and not by &&, || and !
        payload['funcsReplaced'] = _replaceAll(payload['funcsReplaced'], ' and ', ' && ');
        payload['funcsReplaced'] = _replaceAll(payload['funcsReplaced'], ' or ', ' || ');
        payload['funcsReplaced'] = _replaceAll(payload['funcsReplaced'], 'not ', '! ');
        return true;
    }

    self._functions = { 
        '$min(': '_ExpressionProcessor_min(',
        '$max(': '_ExpressionProcessor_max(',
        '$sum(': '_ExpressionProcessor_sum(',
        '$cnt(': '_ExpressionProcessor_cnt(',
        '$avg(': '_ExpressionProcessor_avg(',
        '$avg_top(': '_ExpressionProcessor_avg_top(',
        '$nth_min(': '_ExpressionProcessor_nth_min(',
        '$if(': '_ExpressionProcessor_if(',
        '$date_format(': '_ExpressionProcessor_date_format(',
    };

    function _ExpressionProcessor_min(inputArgs) {
        _ExpressionProcessor_check(inputArgs, 'min');
        var ret = inputArgs[0] || 0;
        for (var i=0; i<inputArgs.length; i++)
            if ((inputArgs[i] || 0) < ret) ret = inputArgs[i];
        return ret;
    }

    function _ExpressionProcessor_max(inputArgs) {
        _ExpressionProcessor_check(inputArgs, 'max');
        var ret = inputArgs[0] || 0;
        for (var i=0; i<inputArgs.length; i++)
            if ((inputArgs[i] || 0) > ret) ret = inputArgs[i];
        return ret;
    }

    function _ExpressionProcessor_sum(inputArgs, dontCheck) {
        if (!dontCheck) _ExpressionProcessor_check(inputArgs, 'sum');
        var ret = 0;
        for (var i=0; i<inputArgs.length; i++)
            ret += (inputArgs[i] || 0);
        return ret;
    }

    function _ExpressionProcessor_cnt(inputArgs, dontCheck) {
        if (!dontCheck) _ExpressionProcessor_check(inputArgs, 'cnt');
        var ret = 0;
        for (var i=0; i<inputArgs.length; i++)
            ret += 1;
        return ret;
    }

    function _ExpressionProcessor_avg(inputArgs, dontCheck) {
        if (!dontCheck) _ExpressionProcessor_check(inputArgs, 'avg');
        var cnt =  _ExpressionProcessor_cnt(inputArgs, true);
        if (cnt == 0) return 0;
        var sum =  _ExpressionProcessor_sum(inputArgs, true);
        var ret = (1.0 * sum) / cnt;
        return ret;
    }

    function _ExpressionProcessor_avg_top(inputArgs) {
        _ExpressionProcessor_check(inputArgs, 'avg_top');
        var nElems = inputArgs[0];
        if (nElems < 2) throw(nl.fmt2('$avg_top first argument should be at least 2, {} given.', nElems));
        if (inputArgs.length < nElems+1) throw(nl.fmt2('$avg_top({}, ...) function takes atleast {} argument, {} given.', nElems, nElems+1, inputArgs.length));

        inputArgs.splice(0, 1);
        inputArgs.sort(function(a, b) {
            return (b || 0) - (a || 0);
        });
        var newArray = [];
        for(var i=0; i<nElems; i++) {
            newArray.push(inputArgs[i]);
        }
        return _ExpressionProcessor_avg(newArray, true);
    }

    function _ExpressionProcessor_nth_min(inputArgs) {
        _ExpressionProcessor_check(inputArgs, 'nth_min');
        var nElems = inputArgs[0];
        if (nElems < 2) throw(nl.fmt2('$nth_min first argument should be at least 2, {} given.', nElems));
        if (inputArgs.length < nElems+1) throw(nl.fmt2('$nth_min({}, ...) function takes atleast {} argument, {} given.', nElems, nElems+1, inputArgs.length));

        inputArgs.splice(0, 1);
        inputArgs.sort(function(a, b) {
            return (a || 0) - (b || 0);
        });
        return inputArgs[nElems-1] || 0;
    }

    function _ExpressionProcessor_if(inputArgs) {
        _ExpressionProcessor_check(inputArgs, 'if');
        if (inputArgs.length != 3) throw(nl.fmt2('$if(...) function takes 3 arguments, {} given.', inputArgs.length));
        return inputArgs[0] ? inputArgs[1] : inputArgs[2];
    }

    // TODO-NOW: Implement custom formula functions for reports
    function _ExpressionProcessor_date_format(inputArgs) {
        _ExpressionProcessor_check(inputArgs, 'date_format');
        var ret = inputArgs[0] || 0;
        return ret;
    }

    function _ExpressionProcessor_check(inputArgs, fn) {
        if (inputArgs.length < 2) throw(nl.fmt2('{} function takes atleast 2 argument, {} given.', fn, inputArgs.length));
    }

    // console.log('Test details: ', this.test());
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

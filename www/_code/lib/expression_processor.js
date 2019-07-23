(function() {

//-------------------------------------------------------------------------------------------------
// expression_processor.js:
// Remember to update nexpression_processor.py when ever updating this.
//
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

    //-------------------------------------------------------------------------------------------------
    // Test code
    this.test = function() {
        var dictAvps = {};
        for(var i=0; i<100; i++) dictAvps[nl.fmt2('id{}', i)] = i > 50 ? null : i;
        var testcases = [
            // Error Test Cases
            [null, '$val1[1]'],
            [null, '$val1[{xyz}]'],
            [null, 'Munni+34'],

            // Success Testcases
            [6, '$val[{id6}]'],
            [2, '$cnt[{id6}, {id12}]'],
            [false, 'not $val[{id6}]'],
            [17, '$max[{id3}, {id4}, {id5}, {id17}, {id3}]'],
            [3, '$min[{id3}, {id4}, {id5}, {id17}, {id3}]'],
            [32, '$sum[{id3}, {id4}, {id5}, {id17}, {id3}]'],
            [6.4, '$avg[{id3}, {id4}, {id5}, {id17}, {id3}]'],
            [4.5, '$avg_top[2, {id3}, {id4}, {id5}]'],
            [10.5, '$avg_top[2, {id3}, {id4}, {id5}] + $val[{id6}]'],
            [false, '($max[{id1},{id2}] <= $avg_top[2, {id3}, {id4}, {id5}] or $val[{id6}]) and ($min[{id7}, {id8}] + $max[{id9}, {id10}] < $avg[{id11}, {id12}, {id13}, {id14}])'],

            [false, '$max[{id51},{id52}] < $avg_top[2, {id53}, {id54}, {id55}] or $val[{id56}] or ($cnt[{id56}, {id57}] + $sum[{id56}, {id57}] < 0)'],
            [9.5, '$max[{id51},{id2},{id53},{id4}] + $avg_top[3, {id53}, {id54}, {id55}, {id5}, {id6}]'],
        ];
    
        var ret = {succ: 0, payloads: []};
        for(var i=0; i<testcases.length; i++) {
            var tc = testcases[i];
            var payload = _testcase(tc[1], tc[0], dictAvps);
            ret.payloads.push(payload);
            if (payload['status']) ret.succ += 1;
        }
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
        
        payload['bracesReplaced1'] = _replaceAll(payload['strExpression'], '[', '([');
        payload['bracesReplaced2'] = _replaceAll(payload['bracesReplaced1'], ']', '])');
        payload['varsReplaced'] = nl.fmt.fmt1(payload['bracesReplaced2'], payload['dictAvps']);
        var pos = payload['varsReplaced'].indexOf('{');
        if (pos >= 0) {
            var endPos = payload['varsReplaced'].indexOf('}', pos);
            payload['error'] = nl.fmt2('Unknown item id used: {}', payload['varsReplaced'].substring(pos+1, endPos));
            return false;
        }

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
        '$val(': '_ExpressionProcessor_val(',
        '$min(': '_ExpressionProcessor_min(',
        '$max(': '_ExpressionProcessor_max(',
        '$sum(': '_ExpressionProcessor_sum(',
        '$cnt(': '_ExpressionProcessor_cnt(',
        '$avg(': '_ExpressionProcessor_avg(',
        '$avg_top(': '_ExpressionProcessor_avg_top(',
    };

    function _ExpressionProcessor_val(inputArgs) {
        if (inputArgs.length != 1) throw(nl.fmt2('$val function takes 1 argument, {} given.', inputArgs.length));
        return inputArgs[0] !== null ? inputArgs[0] : 0;
    }

    function _ExpressionProcessor_min(inputArgs) {
        _ExpressionProcessor_check(inputArgs, 'min');
        var ret = inputArgs[0] || 0;
        for (var i=0; i<inputArgs.length; i++)
            if (inputArgs[i] !== null && inputArgs[i] < ret) ret = inputArgs[i];
        return ret;
    }

    function _ExpressionProcessor_max(inputArgs) {
        _ExpressionProcessor_check(inputArgs, 'max');
        var ret = inputArgs[0] || 0;
        for (var i=0; i<inputArgs.length; i++)
            if (inputArgs[i] !== null && inputArgs[i] > ret) ret = inputArgs[i];
        return ret;
    }

    function _ExpressionProcessor_sum(inputArgs, dontCheck) {
        if (!dontCheck) _ExpressionProcessor_check(inputArgs, 'sum');
        var ret = 0;
        for (var i=0; i<inputArgs.length; i++)
            if (inputArgs[i] !== null) ret += inputArgs[i];
        return ret;
    }

    function _ExpressionProcessor_cnt(inputArgs, dontCheck) {
        if (!dontCheck) _ExpressionProcessor_check(inputArgs, 'cnt');
        var ret = 0;
        for (var i=0; i<inputArgs.length; i++)
            if (inputArgs[i] !== null) ret += 1;
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
        if (inputArgs.length < nElems+1) throw(nl.fmt2('$avg_top({}, ...) function takes atleast {} argument, {} given.', nElems, nElems+1, len(inputArgs)));

        inputArgs.splice(0, 1);
        inputArgs.sort(function(a, b) {
            return (b === null ? -1 : b) - (a == null ? -1 : a);
        });
        var newArray = [];
        for(var i=0; i<nElems; i++) {
            newArray.push(inputArgs[i]);
        }
        return _ExpressionProcessor_avg(newArray, true);
    }

    function _ExpressionProcessor_check(inputArgs, fn) {
        if (inputArgs.length < 2) throw(nl.fmt2('{} function takes atleast 2 argument, {} given.', fn, len(inputArgs)));
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

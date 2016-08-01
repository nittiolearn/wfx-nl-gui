var scorm = null; // Needs to be in global space for ScoBot
njs_scorm = function() {

//#############################################################################################
// Functionality around scorm (standalone) player and embedded player
//#############################################################################################
var g_nlPlayerType = 'normal'; // 'normal' || 'sco' || 'embedded'
var g_lesson = null;
var g_scormlms = null; // valid only when isScormLms() is true (i.e. running as LMS for SCORM content)
var g_SB = null; // valid only for 'sco' (i.e. code running in external LMS as a SCORM content)
var g_nlContainer = null; // valid only for 'embedded' (i.e. launched from course)

//#############################################################################################
function onInitLesson(lesson, nlPlayerType) {
    g_lesson = lesson;
    g_nlPlayerType = nlPlayerType;

    var l = g_lesson.oLesson;
    if (nlPlayerType == 'sco') {
        _initScoBot(l);
        return;
    }

    if (l.scormlms && g_lesson.renderCtx.launchMode() != 'edit') {
        g_scormlms = new ScormLms(g_lesson, l.scormlms);
        g_scormlms._internalInit();
        window.API = g_scormlms;
    }

    if (g_nlPlayerType == 'embedded') _initEmbeddedPlayer(l);
    window.setTimeout(function() {
        // Put inside a timeout just to ensure that the flow is similar to
        // 'sco' excution - bug if any are caught right away.
        _callAfterInitFns();
    });
}

var afterInitLessonFns = [];
function afterInit(fn) {
    afterInitLessonFns.push(fn);
}
function _callAfterInitFns() {
    for(var i in afterInitLessonFns) {
        afterInitLessonFns[i]();
    }
}

function _initScoBot(l) {
    var passScore = l.passScore ? l.passScore/100: 0.7;
    scorm = new SCOBotBase({                   // in 4.x.x
        debug         : true,                  // true or false
        time_type     : "UTC",                 // UTC, GMT or ""
        preferred_API : "findAPI",             // findAPI, findSCORM12, findSCORM2004  ** new in 4.0.9 **
        exit_type     : 'suspend',             // suspend, finish
        use_standalone : false,
        success_status: 'passed'             // passed, failed, unknown
        //cmi           : your_own_runtime_data  // optional way to pass in a customize runtime object for non-LMS
    });
    g_SB = new SCOBot({
        interaction_mode      : 'journaled',      // state (single interaction) or journaled (history of interactions)
        scaled_passing_score  : passScore,        // uses cmi.score.scaled to equate cmi.success_status
        completion_threshold  : '1',          // uses cmi.progress_measure to equate cmi.completion_status
        initiate_timer        : false,        // if max_time_allowed, you can set the timer vs. SCOBot
        scorm_strict          : true,         // Setting this to false will turn off the attempts to truncate data that exceeds the SPM's commonly supported by LMS's.
        // New in 4.0.3 -
        base64                : true,    // Set to false if you manage suspend data or do not wish for it to be encoded (v4.0.3 option)
        happyEnding           : true,         // Set to false if you want to disable this method (v4.0.5)
        useJSONSuspendData    : true,         // Set to false if you manage suspend data (v4.0.3 option)
        // New in 4.0.9 -
        doNotStatusUntilFinish: true,        // Set to true if you don't want to update the score until finished. (4.0.9 option)
        sequencing: {                         // New in 4.1.1 : Sequence and Navigation options
            nav: {request: '_none_'}          // Change to continue, previous, choice{target=ID}, exit, exitAll, abandon, abandonAll, suspendAll for more options to auto-navigate after Termination.
           }
    });
    SCOBotUtil.addEvent(g_SB, 'load', function(e) {         // in 4.x.x
        if (g_SB.getMode() == 'normal') {
            g_lesson.renderCtx.init('do_assign');
            g_SB.setTotals({totalInteractions: '0', totalObjectives: '1', scoreMin: '0', scoreMax: '' + (l.maxScore||0)});
            var obj = {id: '_overall', progress_measure: '0', completion_status: 'incomplete',
                success_status: 'unknown',
                description: l.name, score: {min: '0', max: '' + l.maxScore||0}};
            g_SB.setObjective(obj);
            if (!l.started) l.started = _date2Str(new Date());
        } else {
            g_lesson.renderCtx.init('report_assign_my');
        }
        try {
            var content = g_SB.getSuspendDataByPageID('_overall');
            if (content !== 'false') _updateLearningData(l, content);
        } catch(e) {
            console.log('Exception in getSuspendDataByPageID', e);
        }
        _callAfterInitFns();
    });
}

function _date2Str(d) {
    var ret = '' + d.getFullYear() + '-' + _pad2(d.getMonth()+1) + '-' + _pad2(d.getDate());
    ret +=  ' ' + _pad2(d.getHours()) + ':' + _pad2(d.getMinutes()) + ':' + _pad2(d.getSeconds());
    return ret;
}

function _pad2(num) {
    var s = "00" + num;
    return s.substr(s.length-2);
}

function _initEmbeddedPlayer(l) {
    jQuery(function() {
        g_nlContainer = _discoverNlContainer();
        if (g_nlContainer) return;
        g_nlContainer.init({version: 0, lesson: l});
    });
}

function _discoverNlContainer() {
    var win = window;
    for(var tries=0; tries<10; tries++) {
        if (win.NITTIO_LEARN_CONTAINER) return win.NITTIO_LEARN_CONTAINER;
        if (win.parent == null || win.parent == win) return null;
        win = win.parent;
    }
    return null;
}

//#############################################################################################
function nlPlayerType() {
    return g_nlPlayerType;
}

function isScormLms() {
    return g_scormlms != null;
}

//#############################################################################################
var bDone = false;
function saveLesson(url, params) {
    console.log('Save called: ', url);
    if (bDone) return true;
    if (url.indexOf('submit_report_') > 0) bDone = true;

    if (g_nlPlayerType == 'normal') return false;
    if (g_nlPlayerType == 'embedded') return _saveLessonEmbedded(bDone);
    if (g_nlPlayerType == 'sco') return _saveLessonSco(bDone);
}

function _saveLessonEmbedded(bDone) {
    g_nlContainer.save(parseInt(jQuery('#l_lessonId').val()), g_lesson.oLesson, bDone);
    return false;
}

function postSubmitLesson() {
    g_nlContainer.close();
}

function _saveLessonSco(bDone) {
    var l = g_lesson.oLesson;
    if (bDone) {
        if (!l.ended) l.ended = _date2Str(new Date());
        var obj = {id: '_overall', progress_measure: '1', completion_status: 'completed',
            score: {raw: '' + l.score}};
        
        var pass = l.maxScore && l.passScore &&
            (Math.round((l.score/l.maxScore)*100) > l.passScore);
        obj.success_status = pass ? 'passed' : 'failed';
        g_SB.setObjective(obj);
    }
    try {
        g_SB.setSuspendDataByPageID('_overall', 'overall', _getLearningData(l));
    } catch(e) {
        console.log('Exception in setObjective/setSuspendDataByPageID', e);
    }
    g_SB.commit();
    if (!bDone) return true;
    g_SB.finish();
    return true;
}

function _getLearningData(l) {
    var ret = {started: l.started || null, ended: l.ended || null, 
        timeSpentSeconds: l.timeSpentSeconds || null, 
        score: l.score || null, passScore: l.passScore || null,
        maxScore: l.maxScore || null,
        currentPageNo: l.currentPageNo || 0,
        answers: {}, correctanswers: {},
        scores: {}, maxScores: {}
        };
    for(var i in l.pages) {
        var p = l.pages[i];
        for(var j in p.sections) {
            var s = p.sections[j];
            var key = p.pageId + '-' + j;
            if (s.answer) ret.answers[key] = s.answer;
            if (s.correctanswer) ret.correctanswers[key] = s.correctanswer;
            if (s.score) ret.scores[key] = s.score;
            if (s.maxScore) ret.maxScores[key] = s.maxScore;
        }
    }
    return ret;
}

function _updateLearningData(l, data) {
    if (data.currentPageNo) l.currentPageNo = data.currentPageNo;
    if (data.started) l.started = data.started;
    if (data.ended) l.ended = data.ended;
    if (data.timeSpentSeconds) l.timeSpentSeconds = data.timeSpentSeconds;

    if (data.score) l.score = data.score;
    if (data.passScore) l.passScore = data.passScore;
    if (data.maxScore) l.maxScore = data.maxScore;

    for(var i in l.pages) {
        var p = l.pages[i];
        for(var j in p.sections) {
            var s = p.sections[j];
            var key = p.pageId + '-' + j;
            if (key in data.answers) s.answer = data.answers[key];
            if (key in data.correctanswers) s.correctanswer = data.correctanswers[key];
            if (key in data.scores) s.score = data.scores[key];
            if (key in data.maxScores) s.maxScore = data.maxScores[key];
        }
    }
}

//#############################################################################################
function ScormLms(g_lesson, g_version) {
    var self = this;

    this._internalInit = function() {
        var launchMode = g_lesson.renderCtx.launchMode();
        var bFirst = _updateDataModel();
        var entry = (launchMode == 'report') ? '' : bFirst ? 'ab-initio' : 'resume';
        self.LMSSetValue('cmi.core.entry', entry);
        var lesson_mode = (launchMode == 'report') ? 'review' : 'normal';
        self.LMSSetValue('cmi.core.lesson_mode', lesson_mode);

    };
    
    //-------------------------------------------------------------------------
    // SCORM v1.2 methods
    //-------------------------------------------------------------------------
    this.lastError = '0';
    this.LMSInitialize = function(param) {
        this.lastError = '0';
        console.log('ScormLms:LMSInitialize', param);
        return 'true';
    };

    this.LMSFinish = function(param) {
        this.lastError = '0';
        console.log('ScormLms:LMSFinish', param);
        return 'true';
    };

    this.LMSGetValue = function(param) {
        this.lastError = '0';
        for(var i in _unsupportedAttributes) {
            if (param.indexOf(_unsupportedAttributes[i]) == 0) {
                console.log('ScormLms:LMSGetValue(', param, '): unsupported');
                this.lastError = '401';
                return '';
            }
        }
        var ret = g_lesson.oLesson.scormDataModel[param] || '';
        console.log('ScormLms:LMSGetValue(', param, ') => ', ret);
        return ret;
    };

    this.LMSSetValue = function(param, val) {
        this.lastError = '0';
        g_lesson.oLesson.scormDataModel[param] = val;
        for (var i in _arrayAttributes) {
            if (param.indexOf(_arrayAttributes[i]) != 0) continue;
            _updateArrayCount(_arrayAttributes[i], param);
            break;
        }
        console.log('ScormLms:LMSSetValue(', param, ', ', val, ')');
        return 'true';
    };

    function _updateArrayCount(arrayAttr, param) {
        var dm = g_lesson.oLesson.scormDataModel;
        var arraySize = parseInt(dm[arrayAttr + '._count']);
        var rest = param.substring(arrayAttr.length+1);
        var pos = rest.indexOf('.');
        if (pos < 0) return;
        rest = rest.substring(0, pos);
        rest = parseInt(rest) + 1;
        if (rest > arraySize) dm[arrayAttr + '._count'] = '' + rest;
    }
    
    var _saveWaiting = false;
    var _submitDone = false;
    this.LMSCommit = function(param) {
        this.lastError = '0';
        var dm = g_lesson.oLesson.scormDataModel;
        console.log('ScormLms:LMSCommit', param, dm);

        if (_saveWaiting) return 'true';
        _saveWaiting = true;
        window.setTimeout(function() {
            _saveWaiting = false;
            if (_submitDone) {
                console.log('ScormLms:LMSCommit: submit already done!', dm);
                return;
            }
            if (g_lesson.renderCtx.launchMode() != 'do' ||
                g_lesson.oLesson.completed) return 'true';
    
            var isDone = _updateScoreAndCompletion(dm);
            if (isDone) _submitDone = true;
    
            if (g_lesson.renderCtx.launchCtx() == 'do_assign')
                if(isDone) g_lesson.submitAssignReport();
                else g_lesson.saveAssignReport(true);
            else if (isDone) g_lesson.submitLessonReport();
        }, 1000);
        return 'true';
    };

    this.LMSGetLastError = function() {
        return this.lastError;
    };

    this._errorStrings = {
        '0': 'No error',
        '401': 'Not implemented error'
    };
    
    this.LMSGetErrorString = function(param) {
        return this._errorStrings[this.lastError] || 'Unknown error id';
    };

    this.LMSGetDiagnostic = function(param) {
        return this._errorStrings[this.lastError] || 'Unknown error id';
    };

    //-------------------------------------------------------------------------
    // Private
    //-------------------------------------------------------------------------
    var _defaultDataModel = {
        'cmi.core._children': 'student_id,student_name,lesson_mode,lesson_status,lesson_location,entry,exit,credit,score,total_time,session_time', 

        'cmi.core.student_id': 'student.id',
        'cmi.core.student_name': '',

        'cmi.core.lesson_mode': 'normal',
        'cmi.core.lesson_status': 'not attempted',
        'cmi.core.lesson_location': '',
        'cmi.core.entry': '',
        'cmi.core.exit': '', // 'time-out', 'suspend', 'logout'
        'cmi.core.credit': 'credit',

        'cmi.core.score._children': 'raw,min,max',
        'cmi.core.score.raw': '0',
        'cmi.core.score.min': '0',
        'cmi.core.score.max': '100',

        'cmi.core.total_time': '',
        'cmi.core.session_time': '',

        'cmi.suspend_data': '',
        'cmi.launch_data': '',

        'cmi.objectives._children': 'id,score,status',
        'cmi.objectives._count': '0'
    };
    
    var _unsupportedAttributes = [
        'cmi.student_data',
        'cmi.student_preference'
    ];
    
    var _arrayAttributes = [
        'cmi.objectives'
    ];
    
    function _updateDataModel() {
        if (!g_lesson.oLesson.scormDataModel) {
            g_lesson.oLesson.scormDataModel = _defaultDataModel;
            return true;
        }
        var dm = g_lesson.oLesson.scormDataModel;
        var keys = Object.keys(_defaultDataModel);
        for(var i in keys) {
            var k = keys[i];
            if (k in dm) continue;
            dm[k] = _defaultDataModel[k];
        }
        return false;
    }
    
    function _updateScoreAndCompletion(dm) {
        var l = g_lesson.oLesson;
        var p = l.pages[0];

        var c = dm['cmi.core.lesson_status'];
        var isDone = (c == 'passed' || c == 'completed' || c == 'failed');

        var min = parseInt(dm['cmi.core.score.min'] || 0);
        var max = parseInt(dm['cmi.core.score.max'] || 100) - min;
        var score = parseInt(dm['cmi.core.score.raw'] || 0);
        if (score > min) score = score - min;
        
        p.pageMaxScore = max;
        p.maxScore = max;
        l.maxScore = max;
        
        p.score = score;
        l.score = score;
        
        l.answered = [];
        l.partAnswered = [];
        l.notAnswered = [];
        if (isDone) l.answered.push(0);
        else if (score > 0) l.partAnswered.push(0);
        else l.notAnswered.push(0);
        return isDone;
    }
}

return {
    onInitLesson: onInitLesson,
    afterInit: afterInit,
    nlPlayerType: nlPlayerType,
    isScormLms: isScormLms,

    saveLesson: saveLesson,
    postSubmitLesson: postSubmitLesson
};

}();
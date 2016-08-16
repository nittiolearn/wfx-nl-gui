var scorm = null; // Needs to be in global space for ScoBot
njs_scorm = function() {

//#############################################################################################
// Functionality around scorm (standalone) player and embedded player
//#############################################################################################
var g_nlPlayerType = 'normal'; // 'normal' || 'sco' || 'embedded'
var g_lesson = null;
var g_scormlms = null; // valid only when e. running as LMS for SCORM content
var g_SB = null; // valid only for 'sco' (i.e. code running in external LMS as a SCORM content)
var g_nlContainer = null; // valid only for 'embedded' (i.e. launched from course)

//#############################################################################################
function onInitLesson(lesson, nlPlayerType, username, userdispname) {
    g_lesson = lesson;
    g_nlPlayerType = nlPlayerType;

    var l = g_lesson.oLesson;
    if (nlPlayerType == 'sco') {
        _initScoBot(l);
        return;
    }

    if (l.scormlms) {
        g_scormlms = new ScormLms(g_lesson, l.scormlms);
        g_scormlms._internalInit(username, userdispname);
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
        } else if (g_SB.getMode() == 'review') {
            g_lesson.renderCtx.init('report_assign_review');
        } else {
            g_lesson.renderCtx.init('view');
        }
        try {
            var content = g_SB.getSuspendDataByPageID('_overall');
            if (content !== 'false') _updateLearningData(l, content);
            var studentname = g_SB.getvalue('cmi.core.student_name');
            var studentid = g_SB.getvalue('cmi.core.student_id');
            console.log('Student info: ', studentname, studentid);
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

function getScormLmsLessonMode() {
    return g_scormlms ? g_scormlms.lessonMode : null;
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
    if (g_nlContainer) g_nlContainer.close();
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
function _copyAttr(src, dest, attrSrc, attrDest) {
    if (!attrDest) attrDest = attrSrc;
    if (attrSrc in src) dest[attrDest] = src[attrSrc];
}

function _getLearningData(l) {
    var ret = {answers: {}, correctanswers: {}, scores: {}, maxScores: {}};
    _copyAttr(l, ret, 'currentPageNo');

    _copyAttr(l, ret, 'started');
    _copyAttr(l, ret, 'ended');
    _copyAttr(l, ret, 'timeSpentSeconds');

    _copyAttr(l, ret, 'score');
    _copyAttr(l, ret, 'passScore');
    _copyAttr(l, ret, 'maxScore');

    _copyAttr(l, ret, 'answered');
    _copyAttr(l, ret, 'partAnswered');
    _copyAttr(l, ret, 'notAnswered');

    _copyAttr(l, ret, 'pagesFiltered');
    
    for(var i in l.pages) {
        var p = l.pages[i];
        var key = p.pageId;
        _copyAttr(p, ret.scores, 'score', key);
        _copyAttr(p, ret.maxScores, 'maxScore', key);
        for(var j in p.sections) {
            var s = p.sections[j];
            var key = p.pageId + '-' + j;
            _copyAttr(s, ret.answers, 'answer', key);
            _copyAttr(s, ret.correctanswers, 'correctanswer', key);
        }
    }
    return ret;
}

function _updateLearningData(l, data) {
    if (data.currentPageNo) l.currentPageNo = data.currentPageNo;
    _copyAttr(data, l, 'currentPageNo');

    _copyAttr(data, l, 'started');
    _copyAttr(data, l, 'ended');
    _copyAttr(data, l, 'timeSpentSeconds');

    _copyAttr(data, l, 'score');
    _copyAttr(data, l, 'passScore');
    _copyAttr(data, l, 'maxScore');

    _copyAttr(data, l, 'answered');
    _copyAttr(data, l, 'partAnswered');
    _copyAttr(data, l, 'notAnswered');

    _copyAttr(data, l, 'pagesFiltered');
    
    for(var i in l.pages) {
        var p = l.pages[i];
        var key = p.pageId;
        _copyAttr(data.scores, p, key, 'score');
        _copyAttr(data.maxScores, p, key, 'maxScore');
        for(var j in p.sections) {
            var s = p.sections[j];
            var key = p.pageId + '-' + j;
            _copyAttr(data.answers, s, key, 'answer');
            _copyAttr(data.correctanswers, s, key, 'correctanswer');
        }
    }
}

//#############################################################################################
function ScormLms(g_lesson, g_version) {
    var self = this;
    
    this._internalInit = function(username, userdispname) {
        var launchCtx = g_lesson.renderCtx.launchCtx();
        self.lessonMode = _launchCtx2LessonMode[launchCtx] || 'browse';
        var bFirst = _updateDataModel(username, userdispname);

        var entry = (self.lessonMode != 'normal') ? '' : bFirst ? 'ab-initio' : 'resume';
        self.LMSSetValue('cmi.core.entry', entry);
        self.LMSSetValue('cmi.core.lesson_mode', self.lessonMode);

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
        window.setTimeout(function() {
            postSubmitLesson();
        }, 1000);
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
        var ret = self.scormDataModel[param] || '';
        console.log('ScormLms:LMSGetValue(', param, ') => ', ret);
        return ret;
    };

    this.LMSSetValue = function(param, val) {
        this.lastError = '0';
        self.scormDataModel[param] = val;
        for (var i in _arrayAttributes) {
            if (param.indexOf(_arrayAttributes[i]) != 0) continue;
            _updateArrayCount(_arrayAttributes[i], param);
            break;
        }
        console.log('ScormLms:LMSSetValue(', param, ', ', val, ')');
        return 'true';
    };

    function _updateArrayCount(arrayAttr, param) {
        var dm = self.scormDataModel;
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
        if (self.lessonMode != 'normal') {
            console.log('ScormLms:LMSCommit: not possible in current mode', self.lessonMode);
            return 'true';
        }
        var dm = self.scormDataModel;
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
            g_lesson.oLesson.scormDataModel = _deepCopy(self.scormDataModel);
    
            if (g_lesson.renderCtx.launchCtx() == 'do_assign')
                if(isDone) g_lesson.submitAssignReport();
                else g_lesson.saveAssignReport(true);
            else if (isDone) g_lesson.submitLessonReport();
        }, 200);
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
    var _launchCtx2LessonMode = {
        do_assign: 'normal',
        report_assign_my: 'review', 
        report_assign_review: 'review',
        report_assign_shared: 'review',
        report_lesson: 'review'
    };

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
    
    function _updateDataModel(username, userdispname) {
        if (!g_lesson.oLesson.scormDataModel) {
            _defaultDataModel['cmi.core.student_id'] = username;
            _defaultDataModel['cmi.core.student_name'] = userdispname;
            self.scormDataModel = _defaultDataModel;
            return true;
        }
        self.scormDataModel = _deepCopy(g_lesson.oLesson.scormDataModel);
        var dm = self.scormDataModel;
        var keys = Object.keys(_defaultDataModel);
        for(var i in keys) {
            var k = keys[i];
            if (k in dm) continue;
            dm[k] = _defaultDataModel[k];
        }
        return false;
    }

    function _deepCopy(input) {
        var json = JSON.stringify(input);
        return jQuery.parseJSON(json);
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
    getScormLmsLessonMode: getScormLmsLessonMode,

    saveLesson: saveLesson,
    postSubmitLesson: postSubmitLesson
};

}();
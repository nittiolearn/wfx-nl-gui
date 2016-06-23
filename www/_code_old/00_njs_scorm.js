var scorm = null; // Needs to be in global space for ScoBot
njs_scorm = function() {

//#############################################################################################
// Functionality around scorm (standalone) player and embedded player
//#############################################################################################
var g_standalone_player = false;
var g_embedded_player = false;
var _SB = null;

function initPage(standalone_player, embedded_player) {
    g_standalone_player = standalone_player;
    g_embedded_player = embedded_player;
    _initScoBot();
}

function isStandalone() {
    return g_standalone_player;
}

function isEmbedded() {
    return g_embedded_player;
}

function _initScoBot() {
    if (!g_standalone_player) return;
    scorm = new SCOBotBase({                   // in 4.x.x
        debug         : true,                  // true or false
        time_type     : "UTC",                 // UTC, GMT or ""
        preferred_API : "findAPI",             // findAPI, findSCORM12, findSCORM2004  ** new in 4.0.9 **
        exit_type     : 'suspend',             // suspend, finish
        success_status: 'unknown'             // passed, failed, unknown
        //cmi           : your_own_runtime_data  // optional way to pass in a customize runtime object for non-LMS
    });
    _SB = new SCOBot({
        interaction_mode      : 'journaled',      // state (single interaction) or journaled (history of interactions)
        scaled_passing_score  : '0.7',        // uses cmi.score.scaled to equate cmi.success_status
        completion_threshold  : '1',          // uses cmi.progress_measure to equate cmi.completion_status
        initiate_timer        : false,        // if max_time_allowed, you can set the timer vs. SCOBot
        scorm_strict          : true,         // Setting this to false will turn off the attempts to truncate data that exceeds the SPM's commonly supported by LMS's.
        // New in 4.0.3 -
        base64                : true,    // Set to false if you manage suspend data or do not wish for it to be encoded (v4.0.3 option)
        happyEnding           : true,         // Set to false if you want to disable this method (v4.0.5)
        useJSONSuspendData    : true,         // Set to false if you manage suspend data (v4.0.3 option)
        // New in 4.0.9 -
        doNotStatusUntilFinish: false,        // Set to true if you don't want to update the score until finished. (4.0.9 option)
        sequencing: {                         // New in 4.1.1 : Sequence and Navigation options
            nav: {request: '_none_'}          // Change to continue, previous, choice{target=ID}, exit, exitAll, abandon, abandonAll, suspendAll for more options to auto-navigate after Termination.
           }
    });
    SCOBotUtil.addEvent(_SB, 'load', function(e) {         // in 4.x.x
        _onStart();
    });
}

function _onStart() {
    var jLesson = _getContentFromHtml();
    var _lesson = jQuery.parseJSON(jLesson);
    var score = _lesson.score || 0;

    var scaled = _lesson.maxScore > 0 ? score/_lesson.maxScore : '';
    _SB.setTotals({totalInteractions: '0', totalObjectives: '1', scoreMin: '0', scoreMax: '' + _lesson.maxScore});
    _SB.setObjective({id: '_overall', success_status: 'unknown', completion_status: 'incomplete',
        score: {scaled: '' + scaled, raw: '' + score,  min: '0', max: '' + _lesson.maxScore},
        progress_measure: '0', description: _lesson.name});
    var content = _SB.getSuspendDataByPageID('_overall');
    if (content !== 'false') _setContentInHtml(content);
    _callOnInitHandlers();
}

function _getContentFromHtml() {
    return jQuery('#l_content').val();
}

function _setContentInHtml(content) {
    jQuery('#l_content').val(content);
}

var onInitHandlers = [];
function onInit(fn) {
    if (!g_standalone_player) {
        fn();
        return;
    }
    onInitHandlers.push(fn);
}

function _callOnInitHandlers(ctx) {
    for (var i = 0; i < onInitHandlers.length; i++) {
        onInitHandlers[i](ctx);
    }
}

var bDone = false;
function saveLesson(url, params) {
    console.log('Save called: ', url);
    if (!g_standalone_player) return false;
    if (bDone) return true;

    var content = _getContentFromHtml();
    var l = jQuery.parseJSON(content);
    var obj = {id: '_overall', score: {raw: '' + l.score}};
    if (url.indexOf('submit_report_assign.json') > 0) {
        bDone = true;
        obj.progress_measure =  '1';
        obj.completion_status = 'completed';
    }
    _SB.setObjective(obj);
    _SB.setSuspendDataByPageID('_overall', 'overall', content);
    _SB.commit();
    if (!bDone) return true;
    _SB.finish();
    return true;
}

return {
    initPage: initPage,
    isStandalone: isStandalone,
    isEmbedded: isEmbedded,
    onInit: onInit,
    saveLesson: saveLesson
};

}();
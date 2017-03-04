(function() {

//-------------------------------------------------------------------------------------------------
// playerctx.js:
// Launch and page level context of the player
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.playerctx', [])
    .service('nlPlayerCtx', PlayerCtxSrv);
}

//#############################################################################################
// RenderingContext - Helper class to decide how to render the lesson, page and section. The 
// following terms are necessry to understand when reading this code:
//---------------------------------------------------------------------------------------------
// context (ctx) vs mode: 
//---------------------------------------------------------------------------------------------
// Context is the specific term which determines the exact usecase. e.g: 
// "launched from view approved", "lesson in editor preview mode", "page in learner zodi pressed
// mode", "section in editor and is read-only section", ...
//
// Mode is a more generic term which determines overall type of rendering needed in the given
// context. 3 generic modes of rendering is possible:
// "edit" (render for editing a lesson), 
// "do" (render for learning a lesson),
// "report" (render as a report indicating correct/wrong answers).
// 
// Mode is always rerived from the context - fixed mapping from context to mode. Most of the
// rendering code only checks the mode to determine the needed redering. Only in few places 
// the exact context is used for determining the behaviour.
//
//---------------------------------------------------------------------------------------------
// context and mode are applied at different levels: launch/lesson/page: 
//---------------------------------------------------------------------------------------------
// Context (and subsequently mode) can be defined at load of the lesson or changed during run time.
//
// launchCtx/launchMode: The context in which the rendering was initiated (at page load time).
// e.g. edit a lesson, self-learn a lesson, do assignment, view lesson report, ...
//
// lessonCtx/lessonMode: It is possible that the context/mode is changed for the whole lesson
// during runtime - e.g. change from "edit" to "preview" in editor. In such a case, the lesson
// context is changed. Lesson mode is derived from lesson context.
//
// pageCtx/pageMode: It is possible that the context/mode is changed for just one page:
// e.g. you press "ask-zodi" while self learnig: only the page where zodi was pressed have to be
// in report mode while the rest of the pages should be in "do" mode.
//
//---------------------------------------------------------------------------------------------
// summarizing the possible values of launch/lesson/page contexts:
//---------------------------------------------------------------------------------------------
// launchCtx             | lessonCtx         | addtional pageCtx         |
// 'edit'                | 'edit', 'edit_pv' | 'edit_gra'                |
// 'edit_templ'          |-- same as above --|------ same as above ------|
//                       |                   |                           |
// 'do'                  | 'do', 'do_pv'     | 'do_zodi'                 | 
// 'view'                |-- same as above --|------ same as above ------|
// 'do_assign'           |-- same as above --|------ same as above ------|
// 'do_update'           |-- same as above --|------ same as above ------|
// 'do_review'           |-- same as above --|------ same as above ------|
//                       |                   |                           |
// 'report_assign_my'    | 'report'          |                           | 
// 'report_assign_review'|-- same as above --|------ same as above ------|
// 'report_assign_shared'|-- same as above --|------ same as above ------|
//#############################################################################################

//-------------------------------------------------------------------------------------------------
// This structure is shared between client (playerctx.js) and server (nlesson.py). 
// Please change this consistently.
var _launchCtxToInfo = {
    //edit_templ: not required - edit of template

    // old URL=/lesson/edit/lessonid (edit a lesson; create a new lesson when lesson id is 0)
    edit: {mode: 'edit'},

    // old URL=/lesson/view_priv/lessonid
    view_priv: {mode: 'do', canSubmit: false},
    
    // old URL=/lesson/view/lessonid (without login - named lessons viewing)
    view: {mode: 'do', canSubmit: false},

    // old URL=/lesson/view/lessonid (Click on lesson from view approved - self learning)
    'do': {mode: 'do', canSubmit: true},
    
    // old URL=/lesson/view_review/lessonid (Review lesson)
    do_review: {mode: 'do', canSubmit: false},

    // old URL=/lesson/view_assign/assignid (View contents of assignment)
    view_assign: {mode: 'do', canSubmit: false}, 

    // old URL=/lesson/do_report_assign/reprotid (Do my assignment)
    do_assign: {mode: 'do', canSubmit: true}, 

    // old URL=/lesson/view_report_assign/reportid (View my completed assignment)
    report_assign_my: {mode: 'report'}, 

    // old URL=/lesson/review_report_assign/reportid (View my learners completed assignment report)
    report_assign_review: {mode: 'report'}, 

    // old URL=/lesson/update_report_assign/reportid (Update an assignment report - done by a person with manage-assignment previleges)
    do_update: {mode: 'report'}, 

    // old URL=/lesson/view_shared_report_assign/reportid (view assignment report shared with me)
    report_assign_shared: {mode: 'report'}
};

function _initLaunchCtxToInfo() {
    for(var ctx in _launchCtxToInfo) _launchCtxToInfo[ctx].name = ctx;
}
_initLaunchCtxToInfo();

var _lessonCtxToMode = {
    edit: 'edit', edit_gra: 'edit', edit_templ: 'edit', edit_pv: 'do',
    'do': 'do', do_pv: 'report', do_zodi: 'report', report: 'report'
};

//-------------------------------------------------------------------------------------------------
function PlayerCtx(nl, nlServerApi, nlDlg, userInfo, ctx, dbid) {
    this.load = function() {
        var self = this;
        return nlServerApi.lessonGetContent(dbid, ctx.name)
        .then(function(info) {
            self.lesson = info.lesson;
            self.pagetypes = info.pagetypes;
            self.bgtemplates = info.bgtemplates;
            self.icons = info.icons;
            self.actions = info.actions;
        });
    };
    
    this.getLaunchMode = function() {
        return ctx.mode;
    };

    this.getLaunchCtx = function() {
        return ctx.name;
    };
}

//-------------------------------------------------------------------------------------------------
var PlayerCtxSrv = ['nl', 'nlServerApi', 'nlDlg',
function(nl, nlServerApi, nlDlg) {
    this.init = function(userInfo, ctx, dbid) {
        if (! (ctx in _launchCtxToInfo)) return null;
        if (!dbid) return null;
        return new PlayerCtx(nl, nlServerApi, nlDlg, userInfo, _launchCtxToInfo[ctx], dbid);
   };
}];

module_init();
})();

(function() {

//-------------------------------------------------------------------------------------------------
// oldcodebridge.js: 
// Expose some of the services to old (non-angular) code
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.oldcodebridge', [])
    .service('nlOldCodeBridge', NlOldCodeBridge);
}

//-------------------------------------------------------------------------------------------------
var NlOldCodeBridge = ['nl', 'nlDlg', 'nlServerApi', 'nlApproveDlg', 'nlMarkup', 
'$compile', 'NittioLesson', 'nlLogViewer',
function(nl, nlDlg, nlServerApi, nlApproveDlg, nlMarkup, $compile, NittioLesson, nlLogViewer) {
    var self = this;
    this.expose = function() {
        if (!nl.window.setupNlAppInGlobal) {
            // This is not our old code
            return;
        }
        nl.pginfo.isOldCode = true;
        self.bridge = {
            nl: nl,
            nlDlg: nlDlg,
            nlMarkup: nlMarkup,
            nlApproveDlg: nlApproveDlg,
            NittioLesson: NittioLesson,
            scope: nl.rootScope.$new(),
            compile: _compile,
            nlLogViewer: nlLogViewer
        };
        nl.window.setupNlAppInGlobal(self.bridge);
    };
    
    function _compile(htmlDom) {
        return $compile(htmlDom)(self.bridge.scope);
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

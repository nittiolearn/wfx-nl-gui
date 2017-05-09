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
var NlOldCodeBridge = ['nl', 'nlDlg', 'nlApproveDlg',
function(nl, nlDlg, nlApproveDlg) {
    this.bridge = null;
    this.expose = function() {
        if (!nl.window.setupNlAppInGlobal) {
            // This is not our old code
            return;
        }
        self.bridge = {
            nl: nl,
            nlDlg: nlDlg,
            nlApproveDlg: nlApproveDlg
        };
        nl.window.setupNlAppInGlobal(self.bridge);
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

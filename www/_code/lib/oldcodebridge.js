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
'$compile',
function(nl, nlDlg, nlServerApi, nlApproveDlg, nlMarkup, $compile) {
    var self = this;
    this.expose = function() {
        if (!nl.window.setupNlAppInGlobal) {
            // This is not our old code
            return;
        }
        nlServerApi.getUserInfoFromCache().then(function(userInfo) {
            nlMarkup.setUserInfo(userInfo);
            self.bridge = {
                nl: nl,
                nlDlg: nlDlg,
                nlMarkup: nlMarkup,
                nlApproveDlg: nlApproveDlg,
                scope: nl.rootScope.$new(),
                compile: _compile,
                userInfo: userInfo
            };
            nl.window.setupNlAppInGlobal(self.bridge);
        });
    };
    
    function _compile(htmlDom) {
        return $compile(htmlDom)(self.bridge.scope);
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

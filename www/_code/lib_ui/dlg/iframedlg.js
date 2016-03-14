(function() {

//-------------------------------------------------------------------------------------------------
// iframedlg.js:
// Launch a URL as a iframe within the dialog window
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.iframedlg', [])
    .service('nlIframeDlg', IframeDlgSrv);
}

//-------------------------------------------------------------------------------------------------
// Usage:
// var dlg = nlIframeDlg.create($scope);
// dlg.show(parentScope, url, title).then(function() {
//     nl.log('Dialog Box closed'); 
// });
var IframeDlgSrv = ['nl', 'nlDlg', '$sce',
function(nl, nlDlg, $sce) {
    this.create = function(parentScope, url, title) {
        return new IFrameDlg(nl, nlDlg, $sce, parentScope, url, title);
    };
}];

function IFrameDlg(nl, nlDlg, $sce, parentScope, url, title) {
    this.iframeDlg = nlDlg.create(parentScope);
    this.iframeDlg.setCssClass('nl-max');
    this.iframeDlg.scope.iframeUrl = $sce.trustAsResourceUrl(url);
    this.iframeDlg.scope.dlgTitle = title;
    
    this.show = function() {
        return this.iframeDlg.show('lib_ui/dlg/iframedlg.html',
                                   [], null, false);
    };
    
    this.close = function(callCloseFn) {
        this.iframeDlg.close(callCloseFn);
    };
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

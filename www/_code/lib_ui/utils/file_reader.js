(function() {

//-------------------------------------------------------------------------------------------------
// file_reader.js:
// Module to read a local json file
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.file_reader', [])
    .service('nlFileReader', NlFileReader);
}

var NlFileReader = ['nl', 'nlDlg', '$rootScope', 
function(nl, nlDlg, $rootScope) {
    this.loadAndReadFile = function() {
        return nl.q(function(resolve, reject) {
            _loadAndReadFile($rootScope, resolve);
        });
    };

    function _loadAndReadFile($scope, resolve) {
        var dlg = nlDlg.create($scope);
        //dlg.setCssClass('nl-height-max nl-width-max');
        dlg.scope.data = {resource: null};
        dlg.scope.error = {};
        var okButton = { text : nl.t('Continue'), onTap : function(e) {
            _onFileOpened(dlg.scope, resolve);
        }};
        var cancelButton = {text : nl.t('Cancel'), onTap : function() {
            resolve(null);
        }};
        dlg.show('lib_ui/utils/file_reader.html', [okButton], cancelButton);
    }

    function _onFileOpened(dlgScope, resolve) {
        if (!dlgScope.data.resource || !dlgScope.data.resource[0]) {
            return resolve(null);
        }
        var res = dlgScope.data.resource[0].resource;
        var reader = new FileReader();
        reader.onerror = function (e) {
            resolve(null);
        };
        reader.onload = function(loadEvent) {
            var ret = {data: loadEvent.target.result};
            resolve(ret);
        }
        reader.readAsText(res);
    }

}];

//-------------------------------------------------------------------------------------------------
module_init();
}());

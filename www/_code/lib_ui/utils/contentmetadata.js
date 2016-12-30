(function() {

//-------------------------------------------------------------------------------------------------
// contentmetadata.js: Content metadata related service
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.contentmetadata', [])
    .service('nlMetaDlg', MetaDlg);
}

//-------------------------------------------------------------------------------------------------
var MetaDlg = ['nl', 'nlDlg', 'nlServerApi',
function(nl, nlDlg, nlServerApi) {
    this.show = function($scope, _userInfo, cid, ctype, card) {
        var params = {$scope: $scope, _userInfo: _userInfo, cid: cid, ctype: ctype, card: card};
        params.dlg = nlDlg.create($scope);
        params.dlg.setCssClass('nl-height-max nl-width-max');
        $scope.dlgTitle = nl.t('Metadata: {}', card.title);
        params.dlg.scope.data = {};
        
        nlDlg.showLoadingScreen();
        var promise1 = nlServerApi.cmGetFields();
        var promise2 = nlServerApi.cmGet(params.cid, params.ctype);
        promise1.then(function(cmFields) {
            promise2.then(function(metadata) {
                nlDlg.hideLoadingScreen();
                _showDlg(params, cmFields, metadata);
            });
        });
        
    };
    
    function _showDlg(params, cmFields, metadata) {
        var data = params.dlg.scope.data;
        data.cmFields = angular.toJson(cmFields, 2);
        data.metadata = angular.toJson(metadata, 2);

        var buttons = [];
        if (params._userInfo.groupinfo.id == params.card.grp && 
            params._userInfo.permissions.lesson_approve) {
            buttons.push({ text : nl.t('Update'), onTap : function(e) {
                _onUpdate(e, params);
            }});
        }
        var cancelButton = {text : nl.t('Close')};
        params.dlg.show('lib_ui/utils/contentmetadata_dlg.html', buttons, cancelButton);
    }
    
    function _onUpdate(e, params) {
        var data = params.dlg.scope.data;
        var metadata = angular.fromJson(data.metadata);
        nlDlg.showLoadingScreen();
        nlServerApi.cmSet(params.cid, params.ctype, metadata).then(function() {
            nlDlg.hideLoadingScreen();
        });
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();
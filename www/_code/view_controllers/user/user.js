(function() {

//-------------------------------------------------------------------------------------------------
// lesson_ctrl.js:
// Controllers at lesson level
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.user', [])
    .service('nlUserDlg', UserDlg);
}

//-------------------------------------------------------------------------------------------------
var UserDlg = ['nlDlg',
function(nlDlg) {
    this.getLoggedInUser = function() {
        
    };

    // Used by Log GUI only
    this.show = function($scope) {
        var userDlg = nlDlg.create($scope);
        userDlg.show('view_controllers/user/logindlg.html');
    };
    
}];

//-------------------------------------------------------------------------------------------------
module_init();
}());

(function() {

//-------------------------------------------------------------------------------------------------
// dlg.js:
// Dialog class
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.dlg', [])
    .service('nlDlg', DlgSrv)
    .directive('nlDlg', DlgDirective);
}

//-------------------------------------------------------------------------------------------------
var DlgSrv = ['nl', '$ionicPopup',
function(nl, $ionicPopup) {
    this.create = function($scope, template) {
        return new Dialog(nl, $ionicPopup, $scope, template);
    };
}];

function Dialog(nl, $ionicPopup, $scope, template) {
    this.show = function(otherButtons, closeButton) {
        var myscope = $scope.$new();

        if (otherButtons === undefined) otherButtons = [];
        if (closeButton === undefined) closeButton = {text: 'Close'};
        otherButtons.push(closeButton);
        var mypopup = $ionicPopup.show({
            title: '', subTitle: '', cssClass: 'nl-dlg',
            templateUrl: template,
            scope: myscope,
            buttons: otherButtons
        });

        myscope.onCloseDlg = function($event) {
            mypopup.close();
        };

        mypopup.then(function(result) {
            myscope.$destroy();
        });
        
        return mypopup;
    };
}

//-------------------------------------------------------------------------------------------------
var DlgDirective = ['nl', '$window', 'nlScrollbarSrv', 'nlKeyboardHandler',
function(nl, $window, nlScrollbarSrv, nlKeyboardHandler) {
    return {
        restrict: 'E',
        transclude: true,
        //priority: -1000, // should be post linked after ng-show which runs in priority level 0
        templateUrl: 'lib_ui/dlg/dlg.html',
        scope: {
            title: '@'
        },
        link: function($scope, iElem, iAttrs) {
            $scope.helpHidden = true;
            $scope.imgBasePath = nl.rootScope.imgBasePath;
            $scope.onHelp = function() {
                $scope.helpHidden = !$scope.helpHidden;
            };

            iElem.attr('tabindex', '0');
            iElem.bind('keyup', function($event) {
                if (nlKeyboardHandler.ESC($event)) {
                    $scope.$parent.onCloseDlg($event);
                    return false;
                } else if (nlKeyboardHandler.F1($event, {ctrl: true})) {
                    console.log('F1:', $event);
                    $scope.$apply(function() {
                        $scope.onHelp();
                    });
                    return false;
                }
                return true;
            });
            nl.log.debug('DlgDirective linked');
        }
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

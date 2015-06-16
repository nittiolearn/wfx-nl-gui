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
            $scope.showHelp = false;
            $scope.imgBasePath = nl.rootScope.imgBasePath;
            var iTrans = iElem.find('ng-transclude');
            var oldHelpElem = _findChildWithClass(iTrans, 'nl-dlg-help');
            var oldContentElem = _findChildWithClass(iTrans, 'nl-dlg-content');
            var newHelpElem = _findChildWithClass(iElem, 'nl-dlg-help');
            if (oldHelpElem) {
                oldHelpElem.remove();
                newHelpElem.append(oldHelpElem.children());
            }
            var newBody = angular.element('<div class="nl-dlg-body"/>');
            newBody.append(newHelpElem);
            newBody.append(oldContentElem);
            iTrans.html('');
            iTrans.append(newBody);
            $scope.onHelp = function() {
                $scope.showHelp = !$scope.showHelp;
            };
            
            newBody.attr('tabindex', 0);
            newBody.bind('keydown', function($event) {
                if (!nlKeyboardHandler.ESC($event)) return true;
                nl.log.debug('escaping ...');
                $scope.$parent.onCloseDlg($event);
                return false;
            });
            nl.log.debug('DlgDirective linked');
        }
    };
}];

function _findChildWithClass(elem, cls) {
    var children = elem.children();
    for (var i=0; i<children.length; i++) {
        var child = angular.element(children[i]);
        if (child.hasClass(cls)) return child;
    }
    return null;
}
//-------------------------------------------------------------------------------------------------
module_init();
})();

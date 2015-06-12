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
var DlgSrv = ['nl', '$ionicPopup', '$ionicPopover', '$ionicLoading',
function(nl, $ionicPopup, $ionicPopover, $ionicLoading) {
    this.create = function($scope, template) {
        return new Dialog(nl, $ionicPopup, $ionicLoading, $scope, template);
        $scope.onClose = function() {
        };
    };
}];

function Dialog(nl, $ionicPopup, $ionicLoading, $scope, template) {
    var self = this;
    self.dlg = null;
    
    $scope.onHelp = function() {
        nl.log.debug('Dialog: onHelp() clicked');
    };
    
    $scope.$on('$destroy', function() {
        nl.log.debug('Dialog: $scope.$on($destroy)');
        self.dlg.remove();
        self.dlg = null;
    });

    self.show = function(otherButtons, closeButton) {
        if (otherButtons === undefined) otherButtons = [];
        if (closeButton === undefined) closeButton = {text: 'Close'};
        otherButtons.push(closeButton);
        self.dlg = $ionicPopup.show({
            title: '', subTitle: '', cssClass: 'nl-dlg',
            templateUrl: template,
            scope: $scope,
            buttons: otherButtons
        });
    };

    self.close = function() {
        self.dlg.close();
    };
}

//-------------------------------------------------------------------------------------------------
var DlgDirective = ['nl', '$window', 'nlScrollbarSrv',
function(nl, $window, nlScrollbarSrv) {
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
            $scope.onClose = function($event) {
                $scope.$parent.onClose();
            };
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

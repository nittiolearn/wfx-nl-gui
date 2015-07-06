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
// Usage:
// var dlg = nlDlg.create($scope);
// dlg.scope.whatEverVarableReferedInTemplate = 'WhatEverValue';
// dlg.show().then(function() {
//     nl.log('Dialog Box closed'); 
// });
// Always create local variable and call show together! Cannot call show multiple times on same object!
var DlgSrv = ['nl', '$ionicPopup',
function(nl, $ionicPopup) {
    this.create = function(parentScope) {
        return new Dialog(nl, $ionicPopup, parentScope);
    };
}];

function Dialog(nl, $ionicPopup, parentScope) {
    this.scope = parentScope.$new();
    this.scope.nlDlgForms = {};

    this.show = function(template, otherButtons, closeButton) {
        if (otherButtons === undefined) otherButtons = [];
        if (closeButton === undefined) closeButton = {text: 'Close'};
        otherButtons.push(closeButton);
        var mypopup = $ionicPopup.show({
            title: '', subTitle: '', cssClass: 'nl-dlg',
            templateUrl: template,
            scope: this.scope,
            buttons: otherButtons
        });

        this.scope.onCloseDlg = function($event) {
            mypopup.close();
        };

        self = this;
        mypopup.then(function(result) {
            self.scope.$destroy();
            self.scope = null;
        });
        
        return mypopup;
    };
    
    this.isValid = function() {
        for(var i in this.scope.nlDlgForms) {
            if (this.scope.nlDlgForms[i].$valid) continue;
            return false;
        }
        return true;
    }
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

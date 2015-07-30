(function() {

//-------------------------------------------------------------------------------------------------
// dlg.js:
// Dialog class
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.dlg', [])
    .service('nlDlg', DlgSrv)
    .directive('nlDlg', DlgDirective)
    .directive('nlFormInput', FormInputDirective);
}

//-------------------------------------------------------------------------------------------------
// Usage:
// var dlg = nlDlg.create($scope);
// dlg.scope.whatEverVarableReferedInTemplate = 'WhatEverValue';
// dlg.show().then(function() {
//     nl.log('Dialog Box closed'); 
// });
// Always create local variable and call show together! Cannot call show multiple times on same object!
var DlgSrv = ['nl', '$ionicPopup', '$ionicLoading',
function(nl, $ionicPopup, $ionicLoading) {
    this.create = function(parentScope) {
        return new Dialog(nl, $ionicPopup, parentScope, this);
    };
    
    var statusTimeoutPromise = null;
    this.popupStatus = function(msg) {
        nl.pginfo.statusPopup = msg;
        if (statusTimeoutPromise) nl.timeout.cancel(statusTimeoutPromise);
        statusTimeoutPromise = nl.timeout(function() {
            statusTimeoutPromise = null;
            nl.pginfo.statusPopup = false;
        }, 2000);
    };

    this.popupAlert = function(data) {
        data.cssClass = 'nl-dlg';
        if (!('okText' in data)) data.okText = nl.t('Close');
        this.hideLoadingScreen();
        return $ionicPopup.alert(data);        
    };

    this.popupConfirm = function(data) {
        data.cssClass = 'nl-dlg';
        this.hideLoadingScreen();
        return $ionicPopup.confirm(data);        
    };
    
    var loadingTimeoutPromise = null;
    this.showLoadingScreen = function(timeout) {
        if (timeout === undefined) timeout=0;
        if (loadingTimeoutPromise) nl.timeout.cancel(loadingTimeoutPromise);
        loadingTimeoutPromise = nl.timeout(function() {
            loadingTimeoutPromise = null;
            $ionicLoading.show({templateUrl : 'lib_ui/utils/waiting.html'});
        }, timeout);
    };

    this.hideLoadingScreen = function() {
        if (loadingTimeoutPromise) nl.timeout.cancel(loadingTimeoutPromise);
        loadingTimeoutPromise = null;
        $ionicLoading.hide();
    };
}];

function Dialog(nl, $ionicPopup, parentScope, nlDlg) {
    this.scope = parentScope.$new();
    
    this.show = function(template, otherButtons, closeButton, destroyAfterShow) {
        if (destroyAfterShow === undefined) destroyAfterShow = true;
        var self = this;
        
        if (otherButtons === undefined) otherButtons = [];
        if (closeButton === undefined) closeButton = {text: nl.t('Close')};
        otherButtons.push(closeButton);
        nlDlg.hideLoadingScreen();
        var mypopup = $ionicPopup.show({
            title: '', subTitle: '', cssClass: 'nl-dlg',
            templateUrl: template,
            scope: this.scope,
            buttons: otherButtons
        });
        
        self.scope.onCloseDlg = function(e, callCloseFn) {
            if (mypopup == null) return;
            mypopup.close();
            mypopup = null;
            
            if (callCloseFn === undefined) callCloseFn = true;
            if (!callCloseFn) return;
            
            var closeFn = ('onTap' in closeButton) ? closeButton.onTap : undefined;
            if (closeFn) closeFn(e);
        };

        mypopup.then(function(result) {
            if (!destroyAfterShow) return;
            self.destroy();
        });
        
        return mypopup;
    };
    
    this.destroy = function() {
        if (this.scope == null) return;
        this.scope.$destroy();
        this.scope = null;
    };

    this.close = function(callCloseFn) {
        if (this.scope == null) return;
        this.scope.onCloseDlg(null, callCloseFn);
    };
    
}

//-------------------------------------------------------------------------------------------------
var DlgDirective = ['nl', '$window', 'nlKeyboardHandler',
function(nl, $window, nlKeyboardHandler) {
    return {
        restrict: 'E',
        transclude: true,
        //priority: -1000, // should be post linked after ng-show which runs in priority level 0
        templateUrl: 'lib_ui/dlg/dlg.html',
        scope: {
            title: '@'
        },
        link: function($scope, iElem, iAttrs) {
            var children = iElem.children();
            var title = nl.fmt2("<span class='nl-dlg-title'>{}</span>", $scope.title);
            title += nl.fmt2("<img src='{}general/help.png' class='nl-dlg-title-help' onclick='onHelp()'/>", nl.rootScope.imgBasePath);
            $scope.$parent.title = $scope.title;
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
var FormInputDirective = ['nl',
function(nl) {
    return {
        restrict: 'A',
        templateUrl: 'lib_ui/dlg/forminput.html',
        scope: {
            fieldname: '@',
            fieldmodel: '@',
            fieldtype: '@',
            tabindex: '@'
        }
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

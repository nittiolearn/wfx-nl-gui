(function() {

//-------------------------------------------------------------------------------------------------
// dlg.js:
// Dialog class
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.dlg', [])
    .service('nlDlg', DlgSrv)
    .directive('nlDlg', DlgDirective)
    .directive('nlInput', InputDirective)
    .directive('nlTextarea', TextareaDirective)
    .directive('nlSelect', SelectDirective)
    .directive('nlFormInput', FormInputDirective)
    .directive('nlFormSelect', FormSelectDirective)
    .directive('nlFormTextarea', FormTextareaDirective)
    .directive('nlElastic', ElasticTextareaDirective);
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
    this.popupStatus = function(msg, popdownTime) {
        nl.log.debug('Dialog.popupStatus: ', msg);
        nl.pginfo.statusPopup = msg;
        if (popdownTime === undefined) popdownTime = 2000;
        if (popdownTime === false) popdownTime = 1000*3600*24;
        if (statusTimeoutPromise) nl.timeout.cancel(statusTimeoutPromise);
        statusTimeoutPromise = nl.timeout(function() {
            statusTimeoutPromise = null;
            nl.pginfo.statusPopup = false;
        }, popdownTime);
    };

    this.popdownStatus = function(popdownTime) {
        if (!statusTimeoutPromise) return;
        if (popdownTime === undefined) popdownTime = 2000;
        statusTimeoutPromise = nl.timeout(function() {
            statusTimeoutPromise = null;
            nl.pginfo.statusPopup = false;
        }, popdownTime);
    };
    
    this.popupAlert = function(data) {
        nl.log.debug('Dialog.popupAlert: ', data.title);
        data.cssClass = _addDlgCssClass(data.cssClass);
        if (!('okText' in data)) data.okText = nl.t('Close');
        this.hideLoadingScreen();
        return $ionicPopup.alert(data);        
    };

    this.popupConfirm = function(data) {
        nl.log.debug('Dialog.popupConfirm: ', data.title);
        data.cssClass = _addDlgCssClass(data.cssClass);
        var okText = 'okText' in data ? data.okText : nl.t('OK');
        var okButton = {text: okText, onTap: function(e) {
        	return true;
        }};
        var cancelText = 'cancelText' in data ? data.cancelText : nl.t('Cancel');
        var cancelButton = {text: cancelText, onTap: function(e) {
        	return false;
        }};
        data.buttons = [okButton, cancelButton];
        this.hideLoadingScreen();
        return $ionicPopup.show(data);
    };
    
    this.popupPrompt = function(data) {
        nl.log.debug('Dialog.popupPrompt: ', data.title);
        data.cssClass = _addDlgCssClass(data.cssClass);
        if (!('okText' in data)) data.okText = nl.t('Close');
        this.hideLoadingScreen();
        return $ionicPopup.prompt(data);        
    };

    this.showLoadingScreen = function(delay) {
        nl.log.debug('Dialog.showLoadingScreen: ', delay);
        var loadingInfo = {templateUrl : 'lib_ui/utils/waiting.html', hideOnStateChange: false};
        if (delay !== undefined) loadingInfo.delay = delay;
        $ionicLoading.show(loadingInfo);
    };

    this.hideLoadingScreen = function() {
        nl.log.debug('Dialog.hideLoadingScreen');
        $ionicLoading.hide();
    };

    var _dlgList = {};
    this.closeAll = function() {
        for(var dlgId in _dlgList) {
            _dlgList[dlgId].close();
        }
        _dlgList = {};
    };
    
    this.addVisibleDlg = function(dlgId, dlg) {
        _dlgList[dlgId] = dlg;
    };

    this.removeVisibleDlg = function(dlgId) {
        if (dlgId in _dlgList) delete _dlgList[dlgId];
    };
    
    this.dlgFields = {};
    this.addField = function(fieldModel, field) {
    	this.dlgFields[fieldModel] = field;
    };

    this.getField = function(fieldModel) {
    	return this.dlgFields[fieldModel];
    };

    this.setFieldError = function(scope, fieldModel, msg) {
        scope.error[fieldModel] = msg;
        var field = this.getField(fieldModel);
        if (field) field.focus();
    	return false;
    };
}];

var _uniqueId = 0;
function Dialog(nl, $ionicPopup, parentScope, nlDlg) {
    this.scope = parentScope.$new();
    this.uniqueId = _uniqueId++;
    this.cssClass = '';
    
    this.setCssClass = function(cssClass) {
    	this.cssClass = cssClass;
    };
    
    this.show = function(template, otherButtons, closeButton, destroyAfterShow) {
        nl.log.debug('Dialog.show enter: ', template);
        if (destroyAfterShow === undefined) destroyAfterShow = true;
        var self = this;
        
        if (otherButtons === undefined) otherButtons = [];
        if (closeButton === undefined) closeButton = {text: nl.t('Close')};
        if (closeButton !== null) otherButtons.push(closeButton);
        nlDlg.hideLoadingScreen();
        nlDlg.addVisibleDlg(self.uniqueId, self);
        var mypopup = $ionicPopup.show({
            title: '', subTitle: '', cssClass: _addDlgCssClass(this.cssClass),
            templateUrl: template,
            scope: this.scope,
            buttons: otherButtons
        });
        
        self.scope.onCloseDlg = function(e, callCloseFn) {
            if (mypopup == null) return;
            if (callCloseFn === undefined) callCloseFn = true;
            var closeFn = (closeButton && 'onTap' in closeButton) ? closeButton.onTap : undefined;
            if (callCloseFn && closeFn) closeFn(e);
            if (self.scope.dontClose) return;
            mypopup.close();
            mypopup = null;
        };

        mypopup.then(function(result) {
            nlDlg.removeVisibleDlg(self.uniqueId);
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

function _addDlgCssClass(cssClass) {
	if (cssClass) return 'nl-dlg ' + cssClass;
	return 'nl-dlg';
}

//-------------------------------------------------------------------------------------------------
var DlgDirective = ['nl', '$window', 'nlKeyboardHandler',
function(nl, $window, nlKeyboardHandler) {

	function postLink($scope, iElem, iAttrs) {
        $scope.canShowHelp = ($scope.showHelp !== '0'); // By default show help
        $scope.canShowClose = ($scope.showClose === '1'); // By default don't show help
        $scope.$parent.title = $scope.title;
        $scope.helpHidden = true;
        $scope.imgBasePath = nl.rootScope.imgBasePath;
        $scope.onHelp = function() {
            $scope.helpHidden = !$scope.helpHidden;
        };
        $scope.onClose = function($event) {
            $scope.$parent.onCloseDlg($event);
        };

        iElem.attr('tabindex', '0');
        iElem.bind('keyup', function($event) {
            if (nlKeyboardHandler.ESC($event)) {
                $scope.$parent.onCloseDlg($event);
                return false;
            } else if (nlKeyboardHandler.F1($event, {ctrl: true})) {
                nl.log.debug('F1:', $event);
                $scope.$apply(function() {
                    $scope.onHelp();
                });
                return false;
            }
            return true;
        });
	}
    return {
        restrict: 'E',
        transclude: true,
        //priority: -1000, // should be post linked after ng-show which runs in priority level 0
        templateUrl: 'lib_ui/dlg/dlg.html',
        scope: {
            title: '@',
            showHelp: '@',
            showClose: '@'
        },
        link: postLink
    };
}];

//-------------------------------------------------------------------------------------------------
var InputDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return _formFieldDirectiveImpl(nl, nlDlg, 'input',
        'lib_ui/dlg/input.html', true);
}];

var SelectDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return _formFieldDirectiveImpl(nl, nlDlg, 'input',
        'lib_ui/dlg/select.html');
}];

var TextareaDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return _formFieldDirectiveImpl(nl, nlDlg, 'textarea',
        'lib_ui/dlg/textarea.html');
}];

var FormInputDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return _formFieldDirectiveImpl(nl, nlDlg, 'input',
        'lib_ui/dlg/forminput.html', true);
}];

var FormSelectDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return _formFieldDirectiveImpl(nl, nlDlg, 'select',
        'lib_ui/dlg/formselect.html');
}];

var FormTextareaDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
    return _formFieldDirectiveImpl(nl, nlDlg, 'textarea',
        'lib_ui/dlg/formtextarea.html');
}];

function _formFieldDirectiveImpl(nl, nlDlg, tagName, templateUrl, transclude) {
    if (transclude === undefined) transclude = false;
    return {
        restrict: 'EA',
        templateUrl: templateUrl,
        transclude: transclude,
        scope: {
            fieldname: '@',
            fieldmodel: '@',
            fieldtype: '@',
            fieldcls: '@',
            tabindex: '@',
            placeholder: '@'
        },
        link: function($scope, iElem, iAttrs) {
            nl.log.debug('linking field: ', $scope.fieldmodel);
            var field = iElem.find(tagName)[0];
            nlDlg.addField($scope.fieldmodel, field);
            $scope.onFieldChange = function(fieldModel) {
            	if (!('onFieldChange' in $scope.$parent)) return;
            	$scope.$parent.onFieldChange(fieldModel);
            };
        }
    };
}

//-------------------------------------------------------------------------------------------------
var ElasticTextareaDirective =  ['nl',
function(nl) {
    return {
        restrict: 'A',
        link: function($scope, iElem, iAttrs) {
            if (iAttrs['class'].indexOf('nl-not-elastic') >= 0) return;
            var elem = iElem[0];
            $scope.initialHeight = elem.style.height;
            function onResize() {
                elem.style.height = $scope.initialHeight;
                elem.style.height = "" + elem.scrollHeight + "px";
            };
            iElem.on("input change", onResize);
            nl.timeout(onResize, 0);
        }
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

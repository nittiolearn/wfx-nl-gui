(function() {

//-------------------------------------------------------------------------------------------------
// mobileconnector.js:
// This service handles messages from nittio-mobile to nittioapp as well as the reverse message
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.mobileconnector', [])
    .service('nlMobileConnector', NlMobileConnector);
}

//-------------------------------------------------------------------------------------------------
/*********************Features and modification in multifarious app version:***********************

versionCode = 1
Feature: use of iframe, ionic 1,

versionCode = 200
Feature: use of IAB instead of iframe, disable zoom, ionic 4+, hardware back btn, initial loading time of app.

versionCode = 210
Feature: Push Notification
nittio_mobile_msginfo is introduced which sends 'appversion' to the client when notification was received by the mobile.

versionCode = 211
Bugfix: Sometimes nittio launching link was getting opened in browser instead of App because of unavailability of fcm token. Corrected

versionCode = 22000
Feature: Can open playstore link in playstore, 
         Addition of launch link,
         2 way communication between nittio-mobile inappbrowser and nittioapp
         Send an initMessage to nittioapp from nittio-mobile once the app is loaded. The data which is send as message is :-
            data = { 
                nittio_mobile_msginfo: {apptype: 'android', 
                appversion: 22000},
                notif_type: 'init_mobile_app'
            };

versionCode = 22010
Feature: Sceenshot, Use of iframe instead of IAB. IAB is still in use for launching of links to native system browser and corresponding apps.


'msgtype' supported from nittioapp to nittiomoble: 
In appversion(22000) : 'launch_link'
In appversion(22010) : 'nl_enable_screenshot', 'nl_disable_screenshot', 'nl_take_screenshot', 'nl_exitapp_with_back_btn'

***************************************************************************************************/
//-------------------------------------------------------------------------------------------------
var NlMobileConnector = ['nl', 'nlConfig', 
function(nl, nlConfig) {

    var _handlerFns = {};
    var _lastMessage = null;
    var _mobileAppInfo = {};
    var _knownNotifTypes = {'init_mobile_app': true, 'navigate_to_lr': true, 'screenshot_success': true};
    
    // nittio-mobile to nittioapp: different callbacks for different message types are listed here
    this.onNavigateToLrMsgFromNittioMobile = function(handlerFn) {
        _handlerFns['navigate_to_lr'] = handlerFn;
        if (_lastMessage) handlerFn(_lastMessage);
        _lastMessage = null;
    };

    var self = this;

    var previousExitStatus = true;
    var screenshotFlagForEnableAndDisable = false;      // The flag is used to run the enable or disable only once
    var _canShowPrint = false;
    this.setScreenshotFlag = function(flag) {
        screenshotFlagForEnableAndDisable = flag;
    };

    this.exitFromAppMessageIfRequired = function() {
        var exitApps = {
            '/home': true,
            '/login_now': true
        }
        var activeUrlPath = nl.location.path();
        if ((activeUrlPath in exitApps) && (previousExitStatus != true)) {
            previousExitStatus = true;
            if (_appVersionFeatureMarkup('nl_exitapp_with_back_btn')) _sendMsgToNittioMobile('nl_exitapp_with_back_btn', {exitStatus: true});
            return;
        } else if (!(activeUrlPath in exitApps) && (previousExitStatus == true)) {
            previousExitStatus = false;
            if (_appVersionFeatureMarkup('nl_exitapp_with_back_btn')) _sendMsgToNittioMobile('nl_exitapp_with_back_btn', {exitStatus: false});   
        }
    };

    this.isMarkupMobileApp = function() {
        if (!_mobileAppInfo.appversion) return false;
        return true;
    };

    this.launchLinkInNewTab = function(url) {
        if (_appVersionFeatureMarkup('launch_link')) _sendMsgToNittioMobile('launch_link', {url: url});
        else nl.window.open(url,'_blank');
    };

    this.enableScreenshot = function() {
        if(screenshotFlagForEnableAndDisable) return;
        screenshotFlagForEnableAndDisable = true;
        if (_appVersionFeatureMarkup('nl_enable_screenshot')) _sendMsgToNittioMobile('nl_enable_screenshot');
        return;
    };
    this.disableScreenshot = function() {
        if(screenshotFlagForEnableAndDisable) return;
        screenshotFlagForEnableAndDisable = true;
        if (_appVersionFeatureMarkup('nl_disable_screenshot')) _sendMsgToNittioMobile('nl_disable_screenshot');
        return;
    };

    this._canShowPrintScreenBtn = function() {
        if(_appVersionFeatureMarkup('nl_take_screenshot')) return true;
    };

    this.takeScreenshot = function() {
        if (_appVersionFeatureMarkup('nl_take_screenshot')) _sendMsgToNittioMobile('nl_take_screenshot');
    };

    function _appVersionFeatureMarkup(featurename) {
        // 'nl_iframe_embed_ionic4' represents iframe is used in ionic 4+ for postmessages.
        var appVersionFeatureMarkup = {
            'launch_link'               : '22000',
            'nl_iframe_embed_ionic4'    : '22010',
            'nl_enable_screenshot'      : '22010',
            'nl_disable_screenshot'     : '22010',
            'nl_take_screenshot'        : '22010',
            'nl_exitapp_with_back_btn'  : '22010'
        };
        if (!self.isMarkupMobileApp()) return false;
        if (appVersionFeatureMarkup[featurename] > _mobileAppInfo.appversion) return false;
        return true;
    }

    function _sendMsgToNittioMobile(msgtype, payload) {
        var msg = {msgtype: msgtype, payload: payload, nittioapp_msginfo: {}};
        if (_appVersionFeatureMarkup('nl_iframe_embed_ionic4')) {
            window.parent.postMessage(msg, "*");
        } else {
            var iab = ((webkit || {}).messageHandlers || {}).cordova_iab;
            if (!iab) return;
            msg = JSON.stringify(msg);
            iab.postMessage(msg);
        }
    }

    function _onMsgFromNittioMobile(event) {
        if (!event || !event.data) return;
        var data = null;
        try {
            data = angular.fromJson(event.data);
        } catch(e) {
            return;
        }
        if (!data.nittio_mobile_msginfo) return;
        var notif_type = data.notif_type;
        if (!(notif_type in _knownNotifTypes)) return;
        var handlerFn = _handlerFns[data.notif_type];
        if (!handlerFn) {
            _lastMessage = data;
            return;
        }
        handlerFn(data);
    }
    
    function _screenshotSuccessFromNittioMobile(data) {
        _canShowPrint = true;
    }

    var cacheKey = "MOBILE_APP_INFO";
    function _onInitMobileFromNittioMobile(data) {
        _mobileAppInfo = data.nittio_mobile_msginfo;
        nlConfig.saveToDb(cacheKey, _mobileAppInfo, function(res) {
        });
    }

    function _init() {
        nlConfig.loadFromDb(cacheKey, function(result) {
            if(!(_mobileAppInfo)) _mobileAppInfo = result || {};
        });
        _handlerFns.init_mobile_app = _onInitMobileFromNittioMobile;
        _handlerFns.screenshot_success = _screenshotSuccessFromNittioMobile;
        window.addEventListener('message', _onMsgFromNittioMobile);
    }
    _init();

}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

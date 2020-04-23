(function() {

//-------------------------------------------------------------------------------------------------
// mobileconnector.js:
// This service handles messages from nittio-mobile to nittioapp as well as the reverse message
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.mobileconnector', [])
    .service('nlMobileConnector', NlMobileConnector);
}

var g_appVersionFeatureMarkup = {

    // versionCode = 1
    // Feature: use of iframe, ionic 1,
    
    // versionCode = 200
    // Feature: use of IAB instead of iframe, disable zoom, ionic 4+, hardware back btn, initial loading time of app.
    
    // versionCode = 210
    // Feature: Push Notification
    // nittio_mobile_msginfo is introduced which sends 'appversion' to the client when notification was received by the mobile.
    
    // versionCode = 211
    // Bugfix: Sometimes nittio launching link was getting opened in browser instead of App because of unavailability of fcm token. Corrected

    // versionCode = 22000: introduced #1170
    // Feature: Can open playstore link in playstore, 
    // Addition of launch link,
    // 2 way communication between nittio-mobile inappbrowser and nittioapp
    // Send an initMessage to nittioapp from nittio-mobile once the app is loaded. The data which is send as message is :-
    //    data = { 
    //        nittio_mobile_msginfo: {apptype: 'android', 
    //        appversion: 22000},
    //        notif_type: 'init_mobile_app'
    //    };
    'launch_link'               : '22000', // #1170 Launch link in system browser

    // 22010: introduced #1191, #1190 (regresion test issue)
    // Feature: Sceenshot, Use of iframe instead of IAB. IAB is still in use for launching of links to native system browser and corresponding apps.
    'nl_iframe_embed_ionic4'    : '22010', // nittio_mobile uses iframe instead of IAB (so call postmessages instead of IAB method).
    'nl_enable_screenshot'      : '22010', // see issue #1191
    'nl_disable_screenshot'     : '22010', // see issue #1191
    'nl_take_screenshot'        : '22010', // see issue #1191
    'nl_exitapp_with_back_btn'  : '22010'  // To inform nittio_mobile to exit or not on back button
};

//-------------------------------------------------------------------------------------------------
// 'msgtype' supported from nittioapp to nittiomoble: 
// In appversion(22000) : 'launch_link'
// In appversion(22010) : Additionally: 'nl_enable_screenshot', 'nl_disable_screenshot', 'nl_take_screenshot', 'nl_exitapp_with_back_btn'
//-------------------------------------------------------------------------------------------------

//-------------------------------------------------------------------------------------------------
var NlMobileConnector = ['nl', 'nlConfig', 
function(nl, nlConfig) {

    var _handlerFns = {};
    var _lastMessage = null;
    var _defMobileAppInfo = {};
    var _windowContext = window;
    _windowContext.nittioMobileAppInfo = _defMobileAppInfo;
    var _knownNotifTypes = {'init_mobile_app': true, 'navigate_to_lr': true, 'screenshot_success': true};
    
    // nittio-mobile to nittioapp: different callbacks for different message types are listed here
    this.onNavigateToLrMsgFromNittioMobile = function(handlerFn) {
        _handlerFns['navigate_to_lr'] = handlerFn;
        if (_lastMessage) handlerFn(_lastMessage);
        _lastMessage = null;
    };

    var _screenCaptureEnabled = null;      // The flag is used to run the enable or disable only on change
    var _canShowPrintScreenBtn = true;
    var _onScreenshotDoneFn = null;

    this.initWindowContext = function(parentsToSkip) {
        if (!parentsToSkip) parentsToSkip = 0;
        _windowContext = window;
        for(var i=0; i<parentsToSkip; i++) _windowContext = _windowContext.parent;
    };

    this.exitFromAppMessageIfRequired = function() {
        if (!_appVersionFeatureMarkup('nl_exitapp_with_back_btn')) return;
        var exitApps = {
            '/home': true,
            '/login_now': true
        }
        var activeUrlPath = nl.location.path();
        var payload = {exitStatus: (activeUrlPath in exitApps)};
        _sendMsgToNittioMobile('nl_exitapp_with_back_btn', payload);
    };

    this.isMarkupSupportedByMobileApp = function() {
        return _appVersionFeatureMarkup('launch_link');
    };

    this.launchLinkInNewTab = function(url) {
        if (_appVersionFeatureMarkup('launch_link')) _sendMsgToNittioMobile('launch_link', {url: url});
        else nl.window.open(url,'_blank');
    };

    this.enableScreenshot = function() {
        if(_screenCaptureEnabled === true) return;
        _screenCaptureEnabled = true;
        if (_appVersionFeatureMarkup('nl_enable_screenshot')) _sendMsgToNittioMobile('nl_enable_screenshot');
        return;
    };
    this.disableScreenshot = function() {
        if(_screenCaptureEnabled === false) return;
        _screenCaptureEnabled = false;
        if (_appVersionFeatureMarkup('nl_disable_screenshot')) _sendMsgToNittioMobile('nl_disable_screenshot');
        return;
    };

    this.canShowPrintScreenBtn = function() {
        return _appVersionFeatureMarkup('nl_take_screenshot') && _canShowPrintScreenBtn;
    };

    this.takeScreenshot = function(name, onDoneFn) {
        if (_onScreenshotDoneFn) return;
        _canShowPrintScreenBtn = false;
        _onScreenshotDoneFn = onDoneFn;
        if (_appVersionFeatureMarkup('nl_take_screenshot')) {
            _sendMsgToNittioMobile('nl_take_screenshot', {fname: name});
        }
    };

    function _screenshotSuccessFromNittioMobile(data) {
        _canShowPrintScreenBtn = true;
        if (_onScreenshotDoneFn) _onScreenshotDoneFn();
        _onScreenshotDoneFn = null;
    }

    function _appVersionFeatureMarkup(featurename) {
        var mobileAppInfo = _windowContext.nittioMobileAppInfo;
        if (!mobileAppInfo.appversion) return false;
        if (g_appVersionFeatureMarkup[featurename] > mobileAppInfo.appversion) return false;
        return true;
    }

    function _sendMsgToNittioMobile(msgtype, payload) {
        if (!payload) payload = null;
        var msg = {msgtype: msgtype, payload: payload, nittioapp_msginfo: {}};
        if (_appVersionFeatureMarkup('nl_iframe_embed_ionic4')) {
            var parent = _windowContext.parent;
            parent.postMessage(msg, "*");
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
    
    var cacheKey = "MOBILE_APP_INFO";
    function _onInitMobileFromNittioMobile(data) {
        _windowContext.nittioMobileAppInfo = data.nittio_mobile_msginfo;
        nlConfig.saveToDb(cacheKey, _windowContext.nittioMobileAppInfo, function(res) {
        });
    }

    function _init(self) {
        nlConfig.loadFromDb(cacheKey, function(result) {
            if(!(_windowContext.nittioMobileAppInfo)) _windowContext.nittioMobileAppInfo = result || _defMobileAppInfo;
        });
        _handlerFns.init_mobile_app = _onInitMobileFromNittioMobile;
        _handlerFns.screenshot_success = _screenshotSuccessFromNittioMobile;
        window.addEventListener('message', _onMsgFromNittioMobile);
        self.exitFromAppMessageIfRequired();
    }
    _init(this);

}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

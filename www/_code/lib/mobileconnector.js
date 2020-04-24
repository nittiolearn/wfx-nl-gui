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
    'nl_push_notification'         : '210',
    
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
var NlMobileConnector = ['nl', 'nlConfig', 'nlDlg',
function(nl, nlConfig, nlDlg) {

    var _handlerFns = {};
    var _lastMessage = null;

    var _windowContext = window;
    _windowContext.nittioMobileAppInfo = {};
    function _initCtx() {
        var ctx = _windowContext.nittioMobileAppInfo;
        ctx.canShowPrintScreenBtn = true;
        ctx.onScreenshotDoneFn = null;
    }
    _initCtx();

    var _knownNotifTypes = {'init_mobile_app': true, 'navigate_to_lr': true, 
        'screenshot_success': true, 'screenshot_failure': true};
    
    // nittio-mobile to nittioapp: different callbacks for different message types are listed here
    this.onNavigateToLrMsgFromNittioMobile = function(handlerFn) {
        _handlerFns['navigate_to_lr'] = handlerFn;
        if (_lastMessage) handlerFn(_lastMessage);
        _lastMessage = null;
    };

    var _screenCaptureEnabled = null;      // The flag is used to run the enable or disable only on change

    this.initAppVersion = function(userInfo) {
        var ctx = _windowContext.nittioMobileAppInfo;
        ctx.apptype = userInfo.appType;
        ctx.appversion = userInfo.appVersion;
    };

    this.initWindowContext = function(parentsToSkip) {
        _windowContext = window;
        if (!parentsToSkip) return;
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
        var ctx = _windowContext.nittioMobileAppInfo;
        return _appVersionFeatureMarkup('nl_take_screenshot') && ctx.canShowPrintScreenBtn;
    };

    this.takeScreenshot = function(name, onDoneFn) {
        var ctx = _windowContext.nittioMobileAppInfo;
        if (ctx.onScreenshotDoneFn) return;
        ctx.canShowPrintScreenBtn = false;
        ctx.onScreenshotDoneFn = onDoneFn;
        if (_appVersionFeatureMarkup('nl_take_screenshot')) {
            _sendMsgToNittioMobile('nl_take_screenshot', {name: name});
        }
    };

    this.showAppUpdateMessageIfNeeded = function(bAppNotification, bScreenCaptureDisable) {
        var ctx = _windowContext.nittioMobileAppInfo;
        if (ctx.apptype != 'android') return true;
        var askForUpdate = false;
        if (bAppNotification) askForUpdate = !_appVersionFeatureMarkup('nl_push_notification');
        if (bScreenCaptureDisable && !askForUpdate) askForUpdate = !_appVersionFeatureMarkup('nl_disable_screenshot');
        if (!askForUpdate) return true;
        _showAppUpdateMessage();
        return false;
    }

    var _informedAppUpdateAt = null;
    function _showAppUpdateMessage() {
        var now = (new Date()).getTime();
        if (_informedAppUpdateAt && (now - _informedAppUpdateAt) < 30000) return;
        _informedAppUpdateAt = now;
        var playstoreUrl = _appVersionFeatureMarkup('launch_link') ? 'market://details?id=com.nittiolearn.live' :  null;
        var urlStr = playstoreUrl ? nl.fmt2('<a href="{}">Click here</a> to', playstoreUrl) : 'Please ';
        var msg = nl.fmt2('A major version update of the app is available. {} update the app from playstore.', urlStr);
        var data = {title: 'Update the App', template: msg};
        nlDlg.popupAlert(data).then(function() {
            if (playstoreUrl) nl.window.open(playstoreUrl,'_blank');
        });
    }

    function _screenshotSuccessFromNittioMobile() {
        _screenshotDone(true);
    }

    function _screenshotFailedFromNittioMobile() {
        _screenshotDone(false);
    }

    function _screenshotDone(status) {
        var ctx = _windowContext.nittioMobileAppInfo;
        ctx.canShowPrintScreenBtn = true;
        if (ctx.onScreenshotDoneFn) ctx.onScreenshotDoneFn(status);
        ctx.onScreenshotDoneFn = null;
    }

    function _appVersionFeatureMarkup(featurename) {
        var ctx = _windowContext.nittioMobileAppInfo;
        if (!ctx.appversion) return false;
        if (g_appVersionFeatureMarkup[featurename] > ctx.appversion) return false;
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
        var ctx = _windowContext.nittioMobileAppInfo;
        ctx.apptype = data.nittio_mobile_msginfo.apptype;
        ctx.appversion = data.nittio_mobile_msginfo.appversion;
        nlConfig.saveToDb(cacheKey, ctx, function(res) {
        });
    }

    function _init(self) {
        nlConfig.loadFromDb(cacheKey, function(result) {
            if (!result || !result.apptype) return;
            var ctx = _windowContext.nittioMobileAppInfo;
            if (!ctx.apptype) {
                ctx.apptype = result.apptype;
                ctx.appversion = result.appversion;
            }
            self.exitFromAppMessageIfRequired();
        });
        _handlerFns.init_mobile_app = _onInitMobileFromNittioMobile;
        _handlerFns.screenshot_success = _screenshotSuccessFromNittioMobile;
        _handlerFns.screenshot_failure = _screenshotFailedFromNittioMobile;
        window.addEventListener('message', _onMsgFromNittioMobile);
    }
    _init(this);

}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

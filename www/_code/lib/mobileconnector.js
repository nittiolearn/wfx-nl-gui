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
var NlMobileConnector = ['nl', 'nlConfig',
function(nl, nlConfig) {
    
    // nittio-mobile to nittioapp: different callbacks for different message types are listed here
    this.onNavigateToLrMsgFromNittioMobile = function(handlerFn) {
        _handlerFns['navigate_to_lr'] = handlerFn;
        if (_lastMessage) handlerFn(_lastMessage);
        _lastMessage = null;
    };

    this.isRunningUnderMobileApp = function() {
        if (!_mobileAppInfo.appversion) return false;
        var iab = ((webkit || {}).messageHandlers || {}).cordova_iab;
        return iab;
    };

    this.launchLinkInNewTab = function(url) {
        if (this.isRunningUnderMobileApp())
            _sendMsgToNittioMobile('launch_link', {url: url});
        else {
            nl.window.open(url,'_blank');            
        }
    };

    // msgtype supported: 'launch_link'
    function _sendMsgToNittioMobile(msgtype, payload) {
        var iab = ((webkit || {}).messageHandlers || {}).cordova_iab;
        if (!iab) return;
        var msg = {msgtype: msgtype, payload: payload, nittioapp_msginfo: {}};
        msg = JSON.stringify(msg);
        iab.postMessage(msg);
    };

    //---------------------------------------------------------------------------------------------
    var _handlerFns = {};
    var _lastMessage = null;
    var _mobileAppInfo = {};
    var _knownNotifTypes = {'init_mobile_app': true, 'navigate_to_lr': true};

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
        _mobileAppInfo = data.nittio_mobile_msginfo;
        nlConfig.saveToDb(cacheKey, _mobileAppInfo, function(res) {
        });
    }

    function _init() {
        nlConfig.loadFromDb(cacheKey, function(result) {
            if(!(_mobileAppInfo)) _mobileAppInfo = result || {};
        });
        _handlerFns.init_mobile_app = _onInitMobileFromNittioMobile;
        window.addEventListener('message', _onMsgFromNittioMobile);
    }
    _init();

}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

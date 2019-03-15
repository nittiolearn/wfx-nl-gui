(function() {

//-------------------------------------------------------------------------------------------------
// website.js: 
// website static pages controller and directives used across all static pages
//-------------------------------------------------------------------------------------------------
function module_init() {
    var m = angular.module('nl.website', [])
    .config(configFn)
    .service('nlAnchorScroll', AnchorScrollSrv)
    .controller('nl.WelcomeCtrl', WelcomeCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.welcome', {
        url : '^/welcome',
        views : {
            'appContent' : {
                template: '',
                controller : 'nl.WelcomeCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var AnchorScrollSrv = ['nl', '$anchorScroll',
function(nl, $anchorScroll) {
    var self = this;
    this.setAnchorHandler = function($scope) {
        $scope.gotoAnchor = self.gotoAnchor;
        nl.timeout(function() {
            $anchorScroll();
        });
    };
    
    this.gotoAnchor = function(anchor, pageUrl) {
        if (pageUrl) nl.location.url(pageUrl);
        if (anchor) nl.location.hash(anchor);
        $anchorScroll();
    };
}];

//-------------------------------------------------------------------------------------------------
var WelcomeCtrl = ['nl', 'nlDlg', 'nlServerApi', 'nlRouter', '$scope', 'nlAnchorScroll',
function(nl, nlDlg, nlServerApi, nlRouter, $scope, nlAnchorScroll) {
    nl.window.location.href = '/';
    /* 
    // TODO-LATER: Remove all server code related to about-, wesite* and client code around website*
    // Relook at apphome
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            _updateWebsiteScope(nl, nlDlg, nlServerApi, nlRouter, nlAnchorScroll, userInfo);
            resolve(true);
        });
    };
    nlRouter.initContoller($scope, '', _onPageEnter);
     */
}];

//-------------------------------------------------------------------------------------------------
function _updateWebsiteScope(nl, nlDlg, nlServerApi, nlRouter, nlAnchorScroll, userInfo) {
    function _impl() {
        nl.pginfo.hidemenu = true;
        nl.pginfo.pageTitle = g_landingPageTitle;
        nl.pginfo.pageSubTitle = '';
        nlRouter.setWindowDescription(g_landingPageDesc);
        nl.rootScope.bodyClass = 'showbody welcomepage';
        nl.rootScope.website = {};
        var website = nl.rootScope.website;
        website.menu_shown = false;
        var bLoggedIn = (userInfo.username != '');
        website.homeUrl = (bLoggedIn) ? '/#/home' : '/#/welcome#home';

        website.toggleMenu = function(e) {
            website.menu_shown = !website.menu_shown;
            e.stopImmediatePropagation();
        };

        website.onEscape = function(e) {
            website.menu_shown = false;
            e.stopImmediatePropagation();
        };

        website.landingPageName = g_landingPageName;
        website.showVideoUrl = null;
        website.vm = new VisitorManager(nl, nlDlg, nlServerApi,
            nlRouter, website, userInfo);
        nlAnchorScroll.setAnchorHandler(website.vm);
        website.vm.visit();
        _setupTicker(website);
    }

    function _setupTicker(website) {
        website.landingTickerPos = -1;
        var tickers = g_landingPageTickers;
        if (!tickers || tickers.length == 0) return;
        _onTicker(website, tickers, 1000);
    }
    
    function _onTicker(website, tickers, duration) {
        if (!duration) duration = 6000;
        nl.timeout(function() {
            website.landingTickerPos++;
            if (website.landingTickerPos >= tickers.length) website.landingTickerPos = 0;
            var t = tickers[website.landingTickerPos];
            website.landingTickerTxt = t.txt;
            website.landingTickerCls = t.cls || '';
            _onTicker(website, tickers, t.duration);
        }, duration);
    }

    _impl();
}

//-------------------------------------------------------------------------------------------------
function VisitorManager(nl, nlDlg, nlServerApi, nlRouter, $scope, userInfo) {
    var videoTime = null;
    var videoName = null;
    var videoIds = {intro: 'WAYhqED7FXQ', 'lithium-testimonial': 'Llh0SL5ICxE'};
    // unused now - old-intro-video: 4Ofz01dGFm8
    
    this.visit = function() {
        var url = nl.fmt2('/visitor_start/{}', $scope.landingPageName);
        nlRouter.sendGoogleAnalytics(userInfo, url);
    };
    
    this.watchVideo = function(event, videoNameInput) {
        videoTime = new Date();
        videoName = videoNameInput;
        var videoId = videoIds[videoName] || null;
        if (!videoId) return;
        var url = nl.fmt2('/visitor_videoStart/{}/{}', videoName, $scope.landingPageName);
        nlRouter.sendGoogleAnalytics(userInfo, url);
        $scope.showVideoUrl = nl.fmt2('https://www.youtube.com/embed/{}?modestBranding=1&rel=0&autoplay=1',
            videoId);
    };
    
    this.closeVideo = function() {
        var delta = parseInt((new Date() - videoTime)/1000);
        var url = nl.fmt2('/visitor_videoEnd/{}/{}/{}', videoName, $scope.landingPageName,
            delta);
        nlRouter.sendGoogleAnalytics(userInfo, url);
        $scope.showVideoUrl = null;
    };

    this.exploreMore = function() {
        var url = nl.fmt2('/visitor_explore/{}', $scope.landingPageName);
        nlRouter.sendGoogleAnalytics(userInfo, url);
        this.gotoAnchor('page2');
    };
    
    this.navigateTo = function(e, location) {
        var url = nl.fmt2('/visitor_navigate/{}/{}', $scope.landingPageName, location);
        nlRouter.sendGoogleAnalytics(userInfo, url);
    };

    this.demoRequest = function() {
        var requestDlg = nlDlg.create(nl.rootScope);
        requestDlg.scope.error = {};
        requestDlg.scope.data = {name: '', landingpage: $scope.landingPageName};
        
        var okButton = {
            text : 'Request a demo',
            onTap : function(e) {
                if(!_validateInputs(requestDlg.scope)) {
                    if(e) e.preventDefault();
                    return;
                }
                nlDlg.showLoadingScreen();
                nlServerApi.authDemoRequest(requestDlg.scope.data)
                .then(function() {
                    var url = nl.fmt2('/visitor_demoReqEnd/{}', $scope.landingPageName);
                    nlRouter.sendGoogleAnalytics(userInfo, url);
                    _sendConversionCode();
                    var msg = 'Thanks. You will hear from us shortly.';
                    nlDlg.popupAlert({title: '', template: nl.t(msg)}).then(function() {
                        nlDlg.hideLoadingScreen();
                    });
                });
            }
        };
        var url = nl.fmt2('/visitor_demoReqStart/{}', $scope.landingPageName);
        nlRouter.sendGoogleAnalytics(userInfo, url);
        requestDlg.show('view_controllers/website/demo-request-form.html', [okButton], null);
    };
    
    function _validateInputs(scope) {
        var deepValidate = $scope.landingPageName == 'welcome';
        scope.error = {};
        var ret = true;
        if(!scope.data.name) ret = _validateFail(scope, 'name', 'Please provide your name.');
        if(!scope.data.phone) ret = _validateFail(scope, 'phone', 'We need your number to call you back.');
        if(!scope.data.website && deepValidate) ret = _validateFail(scope, 'website', 'Please provide your company webiste.');
        if(!scope.data.email || (deepValidate && _isPrivateEmail(scope.data.email))) {
            ret = _validateFail(scope, 'email', 'Please provide your work/business email id.');
        }
        return ret;
    }
    
    var privateEmails = ['gmail\\.com', 'hotmail\\..*', 'yahoo\\..*', 'outlook\\.com', 
        'msn\\.com', 'facebook\\..*', 'mail\\.com', 'live\\.com', 'rocketmail\\.com'];

    function _isPrivateEmail(email) {
        email = email.toLowerCase();
        var pos = email.indexOf('@');
        if (pos < 0) return true;
        email = email.substring(pos);
        for(var i=0; i<privateEmails.length; i++) {
            if (email.search(privateEmails[i]) >= 0) return true;
        }
        return false;
    }

    function _validateFail(scope, attr, errMsg) {
        return nlDlg.setFieldError(scope, attr,
            nl.t(errMsg));
    }
    
    function _sendConversionCode() {
        if (!nl.url.isLiveInstance()) return;
        var conversionId = '997300900';
        var conversionLabel = 'tPSmCNPQiGwQpLXG2wM';
        var url = '//www.googleadservices.com/pagead/conversion/{}/?label={}&amp;guid=ON&amp;script=0';
        var image = new Image(1, 1); 
        image.src = nl.fmt2(url, conversionId, conversionLabel);
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();
(function() {

//-------------------------------------------------------------------------------------------------
// welcome.js: 
// welcome static pages + controller and directives used across all static pages
//-------------------------------------------------------------------------------------------------
function module_init() {
    var m = angular.module('nl.welcome', [])
    .config(configFn)
    // Direcives used across all static pages
    .directive('nlSp', _ElemDirective('sp.html', true))
    .directive('nlSpMenu', _ElemDirective('sp-menu.html', false))
    .directive('nlSpFooter', _ElemDirective('sp-footer.html', false))
    .directive('nlSpCopyright', _ElemDirective('sp-copyright.html', false))
    // Services
    .service('nlAnchorScroll', AnchorScrollSrv)
    // Controller
    .controller('nl.WelcomeCtrl', WelcomeCtrl)
    .controller('nl.SchoolCtrl', SchoolCtrl)
    .controller('nl.TeamCtrl', TeamCtrl);
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
    $stateProvider.state('app.school', {
        url : '^/school',
        views : {
            'appContent' : {
                templateUrl: 'view_controllers/welcome/school.html',
                controller : 'nl.SchoolCtrl'
            }
        }
    });
    $stateProvider.state('app.team', {
        url : '^/team',
        views : {
            'appContent' : {
                templateUrl: 'view_controllers/welcome/team.html',
                controller : 'nl.TeamCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
function _ElemDirective(templateFile, transclude) {
    return [function() {
        return {
            restrict: 'E',
            transclude: transclude,
            templateUrl: 'view_controllers/welcome/' + templateFile
        };
    }];
}

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
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nlAnchorScroll.setAnchorHandler($scope);
            _updateWebsiteScope(nl, nlDlg, nlServerApi, nlRouter, userInfo);
            resolve(true);
        });
    };
    nlRouter.initContoller($scope, '', _onPageEnter);
}];

//-------------------------------------------------------------------------------------------------
var SchoolCtrl = ['nl', 'nlRouter', '$scope', 'nlAnchorScroll',
function(nl, nlRouter, $scope, nlAnchorScroll) {
    var schoolConfig = {
        // Required in the controller
        title: nl.t('Your teaching quality partner.'),
        desc: 'Looking to improve the teaching quality in your school? Use Nittio Learn for continuous teacher training, structured lesson planning, program of work tracking and classroom observations.',
        pageUrl: 'school',
        
        // Required in the specific view template
        content: {
            msg: nl.t('Measure and improve the most important aspect of your school, the “Teaching quality”.'),
            msg2: nl.t('Structure all aspects of teaching. Set your goals, engage your teachers and leap ahead.')
        }
    };
    _staticPageCtrl(schoolConfig, nl, nlRouter, $scope, nlAnchorScroll);
}];

//-------------------------------------------------------------------------------------------------
var TeamCtrl = ['nl', 'nlRouter', '$scope', 'nlAnchorScroll',
function(nl, nlRouter, $scope, nlAnchorScroll) {
    var teamConfig = {
        // Required in the controller
        title: nl.t('our team'),
        desc: 'Nittio Learn team.',
        pageUrl: 'team',
        
        // Required in the specific view template
        content: {
            msg: '',
            firstPageClass: 'bgdark',
            profiles: [
                { id: 'gagan2', name: 'Gagandeep Josan', role: 'Co-founder & CEO', desc: [
                    "Gagan leads the work on company growth strategy. A polymath, he contributes to all aspects of the company - from acquiring new customers to developing great new features in the product.",
                    "With more than 17 years of experience, a bulk of it managing products for  companies like Nokia and Amazon, Gagan brings in a mix of business and technology expertise. In his free time, Gagan likes listening to a variety of podcasts and catching up on popular American crime drama TV series.",
                    "Gagan has an engineering degree from Thapar Institute of Engineering and Technology."
                ]},
                { id: 'ritu2', name: 'Ritu Josan', role: 'Co-founder and Chief Evangelizer', desc: [
                    "A great product still needs a messenger who can connect it to its potential users through simple messaging. For Nittio Learn, that messenger is Ritu. Ritu leads Nittio's customer acquisition and growth. Ritu wears the customer hat in all internal discussions to ensure that our customers derive the maximum value from using Nittio Learn.",
                    "Ritu got her engineering degree from NIT Jamshedpur but found her calling in marketing strategy. Ritu has over fourteen years of sales and marketing experience across industries and geographies. As a marketing  consultant, she provided digital marketing strategy to brands like Citibank, Wipro.",
                    "Ritu unwinds by spending her spare time with her children, Aarav and Anika and by watching English comedies."
                ]},
                { id: 'aravind2', name: 'Aravindan RS', role: 'Co-founder & CTO', desc: [
                    "Aravind breaths technology and lives processes. Throw an ill-defined, complex problem, technical or non-technical at him and he hands you back clarity in problem definition along with well structured multiple solutions. Aravind strives for functional simplicity in everything that he does. No wonder that the Nittio Learn content creation and learning management capabilities often get complimented as being the simplest ones around.",
                    "An alumni of IIT Kharagpur with 20 years of large scale software architecture experience at Nokia Networks under his belt, Aravind loves spending his free time playing football with his two children, Shishir and Nila."
                ]},
                { id: 'ruchi2', name: 'Ruchita Gupta', role: 'Customer Success Lead', desc: [
                    "Ruchi's speed at work would put flash to shame. Whether it is rolling out a new project or handling a customer request, Ruchi\'s responsiveness combined with her meticulousness has delighted Nittio Learn customers time and again.",
                    "Ruchi has the distinciton of launching India's first  podcast, www.podmasti.com in 2005. Ruchi loves tutoring her son Tanish and takes out time everyday for it."
                ]},
                { id: 'puneet2', name: 'Puneet Kamboj', role: 'Product Verification Lead', desc: [
                    "The software verification expert intent on needling the development team by finding bugs, Puneet also loves creating beautiful content. Judicious in her use of words, Puneet lets her work do the talking instead. Throw any challenge at her and she comes out trumps.",
                    "After completing her Masters in Chemistry, Puneet taught at schools before joining Nittio. Her education experience combined with her knack for technology has helped build Nittio Learn into a highly effective learning environment."
                ]},
                { id: 'sarada2', name: 'Sarada Veerabhatla', role: 'Content Lead', desc: [
                    "The simplicity of Nittio Learn self-learning content can easily deceive a person about the complexity of the content creation work. With Masters degree from IIT Delhi under her belt, Sarada leads the content development charge at Nittio. Sarada's ability to break down any problem given to her and come up with an execution plan has helped Nittio continuously better both technology and content."
                ]},
                { id: 'varsha2', name: 'Varsha Shrote', role: 'Customer Success Lead', desc: [
                    "Varsha works as part of the Customer Success team ensuring that there is no hitch in their experience while using Nittio Learn.",
                    "Varsha has an Electrical Engineering degree from Nagpur University and a Post Graduate Diploma in Advanced Computing from Centre for Development of Advanced Computing (C-DAC), Bangalore.",
                    "She is passionate about travelling and reading.  In her free time she likes to experiment with new recipes from different regions."
                ]},
                { id: 'naveen2', name: 'Naveen Kumar', role: 'Software Developer', desc: [
                    "Naveen is part of our technology team. He works on the latest product features.",
                    "Naveen has an engineering degree in electronics and communication. In his free time Naveen loves to work at his silk worm farm."
                ]}
            ]
        }
    };
    _staticPageCtrl(teamConfig, nl, nlRouter, $scope, nlAnchorScroll);
}];

//-------------------------------------------------------------------------------------------------
var _commonMsg1 = 'Take your trainings online,';
var _commonMsg2 = 'the ones that really matter for your business.';
function _staticPageCtrl(config, nl, nlRouter, $scope, nlAnchorScroll) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.pginfo.hidemenu = true;
            nl.pginfo.pageTitle = config.title;
            nl.pginfo.pageSubTitle = '';
            nlRouter.setWindowDescription(config.desc);
    
            $scope.homeUrl = userInfo.username ? '/#/home' : '/#/welcome';
            $scope.baseResUrl = nl.url.resUrl() + 'welcome';
            $scope.pageResUrl = $scope.baseResUrl;
            if (config.pageUrl) $scope.pageResUrl += '/' + config.pageUrl;
            
            $scope.content = config.content;
            $scope.content.commonMsg = nl.t('{} {}', _commonMsg1, _commonMsg2);
            $scope.content.title1 = config.title1;
            $scope.content.title2 = config.title2;
            $scope.content.desc = config.desc;
            nl.rootScope.pgBgimg = null;
            resolve(true);
            
            $scope.callFn = function(fnName) {
                if (!(fnName in $scope.content)) {
                    return;
                }
                return $scope.content[fnName]($scope);
            };
        });
    }
	$scope.menu_shown = false;

    $scope.toggleMenu = function(e) {
    	$scope.menu_shown = !$scope.menu_shown;
        e.stopImmediatePropagation();
    };

    $scope.onEscape = function(e, anchor, pageUrl) {
    	$scope.menu_shown = false;
        e.stopImmediatePropagation();
    };
    nlAnchorScroll.setAnchorHandler($scope);
    nlRouter.initContoller($scope, '', _onPageEnter);
}

//-------------------------------------------------------------------------------------------------
function _updateWebsiteScope(nl, nlDlg, nlServerApi, nlRouter, userInfo) {
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
        website.homeUrl = (bLoggedIn) ? '/#/home' : '/#/welcome';

        website.toggleMenu = function(e) {
            website.menu_shown = !website.menu_shown;
            e.stopImmediatePropagation();
        };

        website.onEscape = function(e) {
            website.menu_shown = false;
            e.stopImmediatePropagation();
        };

        website.landingPageName = g_landingPageName;
        website.showVideo = false;
        website.vm = new VisitorManager(nl, nlDlg, nlServerApi,
            nlRouter, website, userInfo);
        website.vm.visit();
        _setupTicker(website);
    }

    function _setupTicker(website) {
        website.landingTickerPos = -1;
        var tickers = g_landingPageTickers;
        if (!tickers || tickers.length == 0) return;
        _onTicker(website, tickers);
    }
    
    function _onTicker(website, tickers, duration) {
        if (!duration) duration = 6000;
        nl.timeout(function() {
            website.landingTickerPos++;
            if (website.landingTickerPos >= tickers.length) website.landingTickerPos = 0;
            var t = tickers[website.landingTickerPos];
            website.landingTickerCls = t.cls || '';
            _onTicker(website, tickers, t.duration);
        }, duration);
    }

    _impl();
}

//-------------------------------------------------------------------------------------------------
function VisitorManager(nl, nlDlg, nlServerApi, nlRouter, $scope, userInfo) {
    var videoTime = null;
    this.visit = function() {
        var url = nl.fmt2('/visitor_start/{}', $scope.landingPageName);
        nlRouter.sendGoogleAnalytics(userInfo, url);
    };
    
    this.watchVideo = function() {
        videoTime = new Date();
        var url = nl.fmt2('/visitor_videoStart/{}', $scope.landingPageName);
        nlRouter.sendGoogleAnalytics(userInfo, url);
        $scope.showVideo = true;
    };
    
    this.closeVideo = function() {
        var delta = parseInt((new Date() - videoTime)/1000);
        var url = nl.fmt2('/visitor_videoEnd/{}/{}', $scope.landingPageName,
            delta);
        nlRouter.sendGoogleAnalytics(userInfo, url);
        $scope.showVideo = false;
    };

    this.exploreMore = function() {
        var url = nl.fmt2('/visitor_explore/{}', $scope.landingPageName);
        nlRouter.sendGoogleAnalytics(userInfo, url);
        $scope.gotoAnchor('page2', 'welcome');
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
                console.log('demo requesting: scope.data:', requestDlg.scope.data);
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
        requestDlg.show('view_controllers/welcome/demo-request-form.html', [okButton], null);
    };
    
    function _validateInputs(scope) {
        console.log('scope.data:', scope.data);
        scope.error = {};
        var ret = true;
        if(!scope.data.name) ret = _validateFail(scope, 'name', 'Please provide your name.');
        if(!scope.data.phone) ret = _validateFail(scope, 'phone', 'We need your number to call you back.');
        if(!scope.data.website) ret = _validateFail(scope, 'website', 'Please provide your company webiste.');
        if(!scope.data.email || _isPrivateEmail(scope.data.email)) {
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
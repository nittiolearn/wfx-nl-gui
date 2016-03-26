(function() {

//-------------------------------------------------------------------------------------------------
// welcome.js: 
// welcome static pages + controller and directives used across all static pages
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.welcome', [])
    .config(configFn)
    // Direcives used across all static pages
    .directive('nlSp', SpDirective)
    .directive('nlSpPage1', Page1Directive)
    .directive('nlSpFooter', FooterDirective)
    .directive('nlSpCopyright', CopyrightDirective)
    .service('nlAnchorScroll', AnchorScrollSrv)
    .directive('nlSpBusinessPricing', BusinessPricingDirective)
    // Controller
    .controller('nl.WelcomeCtrl', WelcomeCtrl)
    .controller('nl.SchoolCtrl', SchoolCtrl)
    .controller('nl.BusinessCtrl', BusinessCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.welcome', {
        url : '^/welcome',
        views : {
            'appContent' : {
                templateUrl: 'view_controllers/welcome/welcome.html',
                controller : 'nl.WelcomeCtrl'
            }
        }
    });
    $stateProvider.state('app.business', {
        url : '^/business',
        views : {
            'appContent' : {
                templateUrl: 'view_controllers/welcome/business.html',
                controller : 'nl.BusinessCtrl'
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
}];

//-------------------------------------------------------------------------------------------------
var SpDirective = [
function() {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/welcome/sp.html'
    };
}];

//-------------------------------------------------------------------------------------------------
var Page1Directive = [
function() {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/welcome/sp-page1.html'
    };
}];

//-------------------------------------------------------------------------------------------------
var FooterDirective = [
function() {
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/welcome/sp-footer.html'
    };
}];

//-------------------------------------------------------------------------------------------------
var CopyrightDirective = [
function() {
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/welcome/sp-copyright.html'
    };
}];

//-------------------------------------------------------------------------------------------------
var BusinessPricingDirective = [
function() {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/welcome/business-pricing.html'
    };
}];

//-------------------------------------------------------------------------------------------------
var AnchorScrollSrv = ['nl', '$anchorScroll',
function(nl, $anchorScroll) {
    this.setAnchorHandler = function($scope) {
        $scope.gotoAnchor = function(anchor) {
            console.log('gotoAnchor', anchor);
            if (nl.location.hash() != anchor) {
                nl.location.hash(anchor);
            } else {
                $anchorScroll();
            }
        }
    }
}];

//-------------------------------------------------------------------------------------------------
var _commonMsg = 'Much more than a Learning Management System.';
var _schoolMsg = 'Measure and improve the most important aspect of your school, the “Teaching quality”.';
var _businessMsg = 'Manage your internal training with ease.';

var WelcomeCtrl = ['nl', 'nlRouter', '$scope', 'nlAnchorScroll', 
function(nl, nlRouter, $scope, nlAnchorScroll) {
    var welcomeConfig = {
        // Required in the controller
        title: nl.t(_commonMsg),
        desc: 'Online training software for businesses. Teaching Quality Management solutions for schools.',
        pageUrl: null,
        bgImg: 'background.jpg',
        menus: [],
        
        // Required in the specific view template
        content: {
            schoolMsg: _schoolMsg,
            businessMsg: _businessMsg
        }
    };
    _staticPageCtrl(welcomeConfig, nl, nlRouter, $scope, nlAnchorScroll);
}];

//-------------------------------------------------------------------------------------------------
var SchoolCtrl = ['nl', 'nlRouter', '$scope', 'nlAnchorScroll', 
function(nl, nlRouter, $scope, nlAnchorScroll) {
    var schoolConfig = {
        // Required in the controller
        title: nl.t('Your teaching quality partner.'),
        desc: 'Looking to improve the teaching quality in your school? Use Nittio Learn for continuous teacher training, structured lesson planning, program of work tracking and classroom observations.',
        pageUrl: 'school',
        bgImg: 'background.jpg',
        menus: [{name: 'Solutions', anchor: 'solutions'}, {name: 'Contact us', anchor: 'contact_us'}],
        
        // Required in the specific view template
        content: {
            msg: nl.t(_schoolMsg),
            msg2: nl.t('Structure all aspects of teaching. Set your goals, engage your teachers and leap ahead.')
        }
    };
    _staticPageCtrl(schoolConfig, nl, nlRouter, $scope, nlAnchorScroll);
}];

//-------------------------------------------------------------------------------------------------
var BusinessCtrl = ['nl', 'nlRouter', '$scope', 'nlAnchorScroll', 
function(nl, nlRouter, $scope, nlAnchorScroll) {
    var businessConfig = {
        // Required in the controller
        title: nl.t('Online Training Management Software.'),
        desc: 'Online software for training everyone in your company. Reduce your training costs, measure results and stay on top of learning needs of your organization.',
        pageUrl: 'business',
        bgImg: 'background.jpg',
        menus: [{name: 'Features', anchor: 'features'}, {name: 'Pricing', anchor: 'pricing'}, {name: 'Request a demo', anchor: 'contact_us'}],
        
        // Required in the specific view template
        content: {
            msg: nl.t(_businessMsg),
            pricing_attrs: ['Unlimited course content', 'Quizzes', 
                'Surveys, feedback', 'User management', 'Duration tracking', 
                'Customized dashboards', 'Custom landing page', 'Sell courses', 
                'Reporting', 'Support', 'Custom contracts', 'Migration services'],
            pricing_slabs: [
            {name: 'Basic', price: 'USD 124 per month', billing: '(Billed annually)', 
                users: '50', attrs: ['tick', 'tick', 'tick', 'tick', '', '', '', '', 'tick', "Email", '', '']},
            {name: 'Advanced', price: 'USD 211 per month', billing: '(Billed annually)',
                users: '100', attrs: ['tick', 'tick', 'tick', 'tick', 'tick', 'tick', '', '', 'tick', "Email, Phone", '', '']},
            {name: 'Professional', price: 'USD 622 per month', billing: '(Billed annually)', 
                users: '500', attrs: ['tick', 'tick', 'tick', 'tick', 'tick', 'tick', 'tick', 'tick', "Custom reports", "Email, Phone", '', '']},
            {name: 'Enterprise', price: 'Contact us for pricing', billing: ' ',
                users: '500+', attrs: ['tick', 'tick', 'tick', 'tick', 'tick', 'tick', 'tick', 'tick', "Custom reports", "Named account manager", 'tick', 'tick']}
            ],
            slabSlider: new SlabSlider(nl, 4),
            slabSlideDown: function($scope) {
                $scope.content.slabSlider.slideDown();
            },
            slabSlideUp: function($scope) {
                $scope.content.slabSlider.slideUp();
            }
        }
    };
    _staticPageCtrl(businessConfig, nl, nlRouter, $scope, nlAnchorScroll);
}];

//-------------------------------------------------------------------------------------------------
function _staticPageCtrl(config, nl, nlRouter, $scope, nlAnchorScroll) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.pginfo.hidemenu = true;
            nl.pginfo.pageTitle = config.title;
            nl.pginfo.pageSubTitle = '';
            nlRouter.setWindowDescription(config.desc);
    
            $scope.homeUrl = userInfo.username ? '#/home' : '#/welcome';
            $scope.baseResUrl = nl.url.resUrl() + 'welcome';
            $scope.pageResUrl = $scope.baseResUrl;
            if (config.pageUrl) $scope.pageResUrl += '/' + config.pageUrl;
            
            $scope.content = config.content;
            $scope.content.commonMsg = _commonMsg;
            $scope.content.title = config.title;
            $scope.content.desc = config.desc;
            $scope.menus = config.menus;
            $scope.bgImg = config.bgImg ? $scope.pageResUrl + '/' + config.bgImg : null;
            
            resolve(true);
            
            $scope.callFn = function(fnName) {
                if (!(fnName in $scope.content)) {
                    console.log("not found", fnName);
                    return
                }
                $scope.content[fnName]($scope);
            }
        });
    }
    nlAnchorScroll.setAnchorHandler($scope);
    nlRouter.initContoller($scope, '', _onPageEnter);
}

//-------------------------------------------------------------------------------------------------
function SlabSlider(nl, max) {
    this.start = 0;
    this.shown = [];
    for(var i=0; i<max; i++) {
        this.shown.push(true);
    }
    _updateShown(this);
    
    var self = this;
    nl.resizeHandler.onResize(function() {
         _updateShown(self);
    });
    
    this.slideDown = function() {
        if (!this.canSlideDown) return;
        this.start--;
        _updateShown(this);
    };

    this.slideUp = function() {
        if (!this.canSlideUp) return;
        this.start++;
        _updateShown(this);
    };
    
    function _updateShown(self) {
        self.len = max;
        if (nl.rootScope.screenSize == 'medium') self.len = 2;
        if (nl.rootScope.screenSize == 'small') self.len = 1;
        var maxStart = max - self.len;
        if (self.start > maxStart) self.start = 0;
        self.canSlideDown = self.start > 0; 
        self.canSlideUp = self.start < maxStart; 
        for(var i=0; i< self.shown.length; i++) {
            self.shown[i] = (self.start <= i && i < self.start + self.len);
        }
    }
}

module_init();
})();
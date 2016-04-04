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
    .directive('nlSpStructuredData', StructuredDataDirective)
    .directive('nlSpPage1', Page1Directive)
    .directive('nlSpFooter', FooterDirective)
    .directive('nlSpCopyright', CopyrightDirective)
    .service('nlAnchorScroll', AnchorScrollSrv)
    .directive('nlSpBusinessPricing', BusinessPricingDirective)
    // Controller
    .controller('nl.WelcomeCtrl', WelcomeCtrl)
    .controller('nl.SchoolCtrl', SchoolCtrl)
    .controller('nl.BusinessCtrl', BusinessCtrl)
    .controller('nl.TeamCtrl', TeamCtrl);
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
    $stateProvider.state('app.school', {
        url : '^/school',
        views : {
            'appContent' : {
                templateUrl: 'view_controllers/welcome/school.html',
                controller : 'nl.SchoolCtrl'
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
var SpDirective = [
function() {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/welcome/sp.html'
    };
}];

//-------------------------------------------------------------------------------------------------
var StructuredDataDirective = [
function() {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/welcome/sp-structured-data.html'
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
    var self = this;
    this.setAnchorHandler = function($scope) {
        $scope.gotoAnchor = self.gotoAnchor;
    };
    
    this.gotoAnchor = function(anchor) {
        if (anchor !== undefined && nl.location.hash() != anchor) {
            nl.location.hash(anchor);
        } else {
            $anchorScroll();
        }
    };
}];

//-------------------------------------------------------------------------------------------------
var _commonMsg = 'Much more than a Learning Management System.';
var _schoolMsg = 'Measure and improve the most important aspect of your school, the “Teaching quality”.';
var _businessMsg = 'Manage your training with ease.';

var WelcomeCtrl = ['nl', 'nlRouter', '$scope', 'nlAnchorScroll', 
function(nl, nlRouter, $scope, nlAnchorScroll) {
    var welcomeConfig = {
        // Required in the controller
        title: nl.t(_commonMsg),
        desc: 'Online training software for businesses. Teaching Quality Management solutions for schools.',
        pageUrl: null,
        bgImg: 'background2.jpg',
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
        bgImg: 'schoolbackground2.jpg',
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
        bgImg: 'businessbackground2.jpg',
        menus: [{name: 'Features', anchor: 'features'}, {name: 'Pricing', anchor: 'pricing'}, {name: 'Request a demo', anchor: 'contact_us'}],
        
        // Required in the specific view template
        content: {
            msg: nl.t(_businessMsg),
            pricing_attrs: ['Unlimited course content', 'Quizzes', 
                'Surveys, feedback', 'User management', 'Duration tracking', 
                'Customized dashboards', 'Custom landing page', 'Sell courses', 
                'Reporting', 'Support', 'Custom contracts', 'Migration services'],
            pricing_slabs: [
            {name: 'Basic', price: 'USD 125 per month', billing: '(Billed annually)', 
                users: '50', attrs: ['tick', 'tick', 'tick', 'tick', '', '', '', '', 'tick', "Email", '', '']},
            {name: 'Advanced', price: 'USD 225 per month', billing: '(Billed annually)',
                users: '100', attrs: ['tick', 'tick', 'tick', 'tick', 'tick', 'tick', '', '', 'tick', "Email, Phone", '', '']},
            {name: 'Professional', price: 'USD 625 per month', billing: '(Billed annually)', 
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
var TeamCtrl = ['nl', 'nlRouter', '$scope', 'nlAnchorScroll', 
function(nl, nlRouter, $scope, nlAnchorScroll) {
    var teamConfig = {
        // Required in the controller
        title: nl.t('our team'),
        desc: 'Nittio Learn team.',
        pageUrl: 'team',
        bgImg: null,
        menus: [],
        
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
            
            nl.rootScope.pgBgimg = null;
            resolve(true);
            
            $scope.callFn = function(fnName) {
                if (!(fnName in $scope.content)) {
                    return;
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
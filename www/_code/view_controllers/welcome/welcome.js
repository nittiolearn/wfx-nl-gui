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
    .directive('nlSpMenu', MenuDirective)
    .directive('nlSpFooter', FooterDirective)
    .directive('nlSpCopyright', CopyrightDirective)
    .service('nlAnchorScroll', AnchorScrollSrv)
    .directive('nlSpBusinessPricing', BusinessPricingDirective)
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
var MenuDirective = [
function() {
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/welcome/sp-menu.html'
    };
}];

//-------------------------------------------------------------------------------------------------
var PageOneDirective = [
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
var _commonMsg1 = 'Take your trainings online,';
var _commonMsg2 = 'the ones that really matter for your business.';
					   
var WelcomeCtrl = ['nl', 'nlDlg', 'nlServerApi', 'nlRouter', '$scope', 'nlAnchorScroll', 
function(nl, nlDlg, nlServerApi, nlRouter, $scope, nlAnchorScroll) {
	var _cards = null;
	var _lastScreenSize = '';
    var cards = {
        title1: {title: 'Great content that anyone can make', cls:'fsh5'},
        title2: {title: 'Engaging learning environment', cls: 'fsh5'},
		card1: {type: 'card',  cls: 'sp-card bgwhite', icon: 'visual1.png', title: 'Visual', text: 'Create the content that pleases the eyes with completely flexible layouts and visual elements.'},
		card2: {type: 'card',  cls: 'sp-card bgwhite', icon: 'interactive1.png', title: 'Interactive', text: 'Build a multitude of great looking learner interactions in a jiffy.'},
		card3: {type: 'card',  cls: 'sp-card bgwhite', icon: 'voiceover1.png', title: 'Voiceovers', text: 'Make your content speak in accent of your choice with automatic text to speech or recorded human voice.'},
		card4: {type: 'card',  cls: 'sp-card bgwhite', icon: 'slicedvideo1.png', title: 'Video slicing', text: 'No cumbersome editing. Just define time interval to embed part of a video.'},
		card5: {type: 'card',  cls: 'sp-card bgwhite', icon: 'responsive1.png', title: 'Responsive', text: 'Everything you create, including images and videos automatically fits to all device sizes.'},
		card6: {type: 'card',  cls: 'sp-card bgdark', icon: 'learnerled1.png', title: 'Learner led', text: 'Allow learners to choose what to learn, or guide them with a pre-set course.'},
		card7: {type: 'card',  cls: 'sp-card bgdark', icon: 'branched1.png', title: 'Branched learning', text: 'Trigger new or repeat learning activity based on rules.'},
		card8: {type: 'card',  cls: 'sp-card bgdark', icon: 'social1.png', title: 'Social learning', text: 'Blend topic specific discussion forum to learning, with a click of a button.'},
		card9: {type: 'card',  cls: 'sp-card bgdark', icon: 'leaderboard1.png', title: 'Leaderboard', text: 'Instill healthy competition with customized leaderboards.'},
		card10: {type: 'card',  cls: 'sp-card bgdark', icon: 'responsive1.png', title: 'Device independent', text: 'Give freedom to your learners to learn on any device.'},
		empty: {type: 'card',  cls: ''}
    };

    function _getFeatureCards() {
    	var screenSize = nl.rootScope.screenSize;
    	if (_cards && _lastScreenSize == screenSize) return _cards;
    	
    	_cards = [];
    	_lastScreenSize = screenSize;
        var names = _getFeatureCardNames(screenSize);
        
        var titleCol = (screenSize == 'small') ? 'w100' : 'col col-50';
        var cardCol = (screenSize == 'small') ? 'w100' : (screenSize == 'medium') ? 'col col-50' : 'col col-25';
        for(var i in names) {
        	var card = angular.copy(cards[names[i]]);
        	card.cls += ' ' + (card.type == 'card' ? cardCol : titleCol);
        	_cards.push(card);
        }
        return _cards;
    }

    function _getFeatureCardNames(screenSize) {
        if (screenSize == 'large')
	        return ['title1', 'title2', 'card1', 'card2', 'card6', 'card7', 'card3', 'card4', 'card8', 'card9', 'empty', 'card5', 'card10'];
        if (screenSize == 'medium')
	        return ['title1', 'title2', 'card1', 'card6', 'card2', 'card7', 'card3', 'card8', 'card4', 'card9', 'card5', 'card10'];
        if (screenSize == 'small')
	        return ['title1', 'card1', 'card2', 'card3', 'card4', 'card5', 'title2', 'card6', 'card7', 'card8', 'card9', 'card10'];
       return [];
	}

    var welcomeConfig = {
        // Required in the controller
        title: nl.t('{} {}', _commonMsg1, _commonMsg2),
        title1: nl.t(_commonMsg1),
        title2: nl.t(_commonMsg2),
        desc: 'Nittio Learn is a complete eLearning solution for trainings that are core to your business. It is designed to ensure that your employees are continuously learning about the things that are most critical for your business.',
        pageUrl: null,
        menus: [{name: 'Our school solution', anchor: 'school'}],
        // Required in the specific view template
        content: {
	        getFeatureCards: _getFeatureCards,

            pricing_attrs: ['Unlimited course content', 'Quizzes', 
                'Surveys, feedback', 'User management', 'Duration tracking', 
                'Customized dashboards', 'Custom landing page',  
                'Reporting', 'Support', 'Custom contracts', 'Migration services'],
            pricing_slabs: [
            {name: 'Starter', price: 'INR 25,000/- per month', billing: '(Billed annually)', 
                users: '50', attrs: ['tick', 'tick', 'tick', 'tick', '', '', '', 'tick', "Email", '', '']},
            {name: 'Small', price: 'INR 45,000/- per month', billing: '(Billed annually)',
                users: '100', attrs: ['tick', 'tick', 'tick', 'tick', 'tick', 'tick', '', 'tick', "Email, Phone", '', '']},
            {name: 'Medium', price: 'INR 1,25,000/- per month', billing: '(Billed half-yearly)', 
                users: '500', attrs: ['tick', 'tick', 'tick', 'tick', 'tick', 'tick', 'tick', "Custom reports", "Email, Phone", '', '']},
            {name: 'Enterprise', price: 'Contact us for pricing', billing: ' ',
                users: '500+', attrs: ['tick', 'tick', 'tick', 'tick', 'tick', 'tick', 'tick', "Custom reports", "Named account manager", 'tick', 'tick']}
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
    _staticPageCtrl(welcomeConfig, nl, nlDlg, nlServerApi, nlRouter, $scope, nlAnchorScroll);
}];

//-------------------------------------------------------------------------------------------------
var SchoolCtrl = ['nl', 'nlDlg', 'nlServerApi', 'nlRouter', '$scope', 'nlAnchorScroll', 
function(nl, nlDlg, nlServerApi, nlRouter, $scope, nlAnchorScroll) {
    var schoolConfig = {
        // Required in the controller
        title: nl.t('Your teaching quality partner.'),
        desc: 'Looking to improve the teaching quality in your school? Use Nittio Learn for continuous teacher training, structured lesson planning, program of work tracking and classroom observations.',
        pageUrl: 'school',
        menus: [{name: 'Solutions', anchor: 'solutions'}, {name: 'Contact us', anchor: 'contact_us'}],
        
        // Required in the specific view template
        content: {
            msg: nl.t('Measure and improve the most important aspect of your school, the “Teaching quality”.'),
            msg2: nl.t('Structure all aspects of teaching. Set your goals, engage your teachers and leap ahead.')
        }
    };
    _staticPageCtrl(schoolConfig, nl, nlDlg, nlServerApi, nlRouter, $scope, nlAnchorScroll);
}];

//-------------------------------------------------------------------------------------------------
var TeamCtrl = ['nl', 'nlDlg', 'nlServerApi', 'nlRouter', '$scope', 'nlAnchorScroll', 
function(nl, nlDlg, nlServerApi, nlRouter, $scope, nlAnchorScroll) {
    var teamConfig = {
        // Required in the controller
        title: nl.t('our team'),
        desc: 'Nittio Learn team.',
        pageUrl: 'team',
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
    _staticPageCtrl(teamConfig, nl, nlDlg, nlServerApi, nlRouter, $scope, nlAnchorScroll);
}];

//-------------------------------------------------------------------------------------------------
function _staticPageCtrl(config, nl, nlDlg, nlServerApi, nlRouter, $scope, nlAnchorScroll) {
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
            $scope.content.commonMsg = nl.t('{} {}', _commonMsg1, _commonMsg2);
            $scope.content.title1 = config.title1;
            $scope.content.title2 = config.title2;
            $scope.content.desc = config.desc;
            $scope.menus = config.menus;
            $scope.registration = new Registration(nl, nlDlg, nlServerApi, $scope);
            nl.rootScope.pgBgimg = null;
            resolve(true);
            
            $scope.callFn = function(fnName) {
                if (!(fnName in $scope.content)) {
                    return;
                }
                $scope.content[fnName]($scope);
            };
        });
    }
	$scope.menu_shown = false;

    $scope.toggleMenu = function(e) {
    	$scope.menu_shown = !$scope.menu_shown;
        e.stopImmediatePropagation();
    };

    $scope.onEscape = function(e) {
    	$scope.menu_shown = false;
        e.stopImmediatePropagation();
    };
    
    nlAnchorScroll.setAnchorHandler($scope);
    nlRouter.initContoller($scope, '', _onPageEnter);
}

//-------------------------------------------------------------------------------------------------
function Registration(nl, nlDlg, nlServerApi, $scope) {
	this.demoRequest = function() {
		var requestDlg = nlDlg.create($scope);
        requestDlg.scope.error = {};
		requestDlg.scope.data = {name: ''};
		
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
                    _sendConversionCode();
			        var msg = 'Thanks. You will hear from us shortly.';
			        nlDlg.popupAlert({title: '', template: nl.t(msg)}).then(function() {
                        nlDlg.hideLoadingScreen();
			        });
			    });
			}
		};
		requestDlg.show('view_controllers/welcome/demo-request-form.html', [okButton], null);
	};
	
    function _validateInputs(scope) {
    	console.log('scope.data:', scope.data);
        scope.error = {};
        var ret = true;
        if(!scope.data.name) ret = _validateFail(scope, 'name', 'Name is mandatory');
        if(!scope.data.email) {
            ret = _validateFail(scope, 'email', 'Please provide a valid email id');
        }
        return ret;
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
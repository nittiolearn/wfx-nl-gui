(function() {

//-------------------------------------------------------------------------------------------------
// assign.js:
// Assignment module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.assign', [])
    .config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
        config($stateProvider, $urlRouterProvider);
    }])
    .controller('nl.AssignListCtrl', AssignListCtrl)
    .controller('nl.AssignDoCtrl', AssignDoCtrl);
}

//-------------------------------------------------------------------------------------------------
function config($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.assign', {
        url : '/assign/:assigntype',
        views : {
            'appContent' : {
                templateUrl : 'lib_ui/cards/cardsview.html',
                controller : 'nl.AssignListCtrl'
            }
        }
    });
    $stateProvider.state('app.assign_new', {
        url : '/assign_new/:assignid',
        views : {
            'appContent' : {
                templateUrl : 'lib_ui/utils/todo.html',
                controller : 'nl.AssignDoCtrl'
            }
        }
    });
    $stateProvider.state('app.assign_past', {
        url : '/assign_past/:assignid',
        views : {
            'appContent' : {
                templateUrl : 'lib_ui/utils/todo.html',
                controller : 'nl.AssignDoCtrl'
            }
        }
    });
}

var pageTitles = {'new': 'New Assignments', 'past': 'Past Assignments'};

//-------------------------------------------------------------------------------------------------
var AssignListCtrl = ['nl', '$scope', '$stateParams',
function(nl, $scope, $stateParams) {
    var assigntype = $stateParams.assigntype;
    if (!(assigntype in pageTitles)) assigntype = 'new';
    $scope.title = pageTitles[assigntype];
    if (assigntype !== 'new') {
        $scope.cards = [];
        for(var i=0; i<100; i++) {
            var card = {title:'Past assignment ' + i, icon: nl.url.resUrl('dashboard/assign.png'), url:'#/app/assign_past/' + i};
            card.desc ='Remarks of assignment ' + i;
            $scope.cards.push(card);
        }
    } else {
        $scope.cards = [];
        for(var i=0; i<100; i++) {
            var card = {title:'New assignment ' + i, icon: nl.url.resUrl('dashboard/assign.png'), url:'#/app/assign_new/' + i};
            card.desc ='Remarks of assignment ' + i;
            $scope.cards.push(card);
        }
    }
}];

//-------------------------------------------------------------------------------------------------
var AssignDoCtrl = ['nl', '$scope', '$stateParams',
function(nl, $scope, $stateParams) {
    var assignid = parseInt($stateParams.assignid);
    $scope.title = 'Do assignment: ' + assignid;
}];

module_init();
})();

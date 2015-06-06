(function() {

//-------------------------------------------------------------------------------------------------
// lesson_list_ctrl.js:
// Controllers at lesson list level
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.lesson_list_ctrl', [])
    .config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
        config($stateProvider, $urlRouterProvider);
    }])
    .controller('nl.LessonListCtrl', LessonListCtrl);
}

//-------------------------------------------------------------------------------------------------
function config($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.lesson_approved', {
        url : '/lesson/:listtype',
        views : {
            'appContent' : {
                templateUrl : 'lib_ui/cards/cardsview.html',
                controller : 'nl.LessonListCtrl'
            }
        }
    });
}

//-------------------------------------------------------------------------------------------------
var LessonListCtrl = ['nl', 'nlServerApi', '$scope', '$rootScope',
function(nl, nlServerApi, $scope, $rootScope) {
    nl.pginfo.pageTitle = nl.t('View approved lessons');
    $scope.cards = [];

    nlServerApi.getLessonList('approved', null).then(function(result) {
        console.log('getLessonList success:', result);
        _updateCards($scope.cards, result, nl);
        $scope.onCardsRepaginate();
    }, function(error) {
        console.log('getLessonList failed:', error);
    });
}];

function _updateCards(cards, lessons, nl) {
    for(var i=0; i<lessons.length; i++) {
        var l = lessons[i];
        var card = {title:l.name, icon: nl.url.lessonIconUrl(l.image), url:'#/app/lesson_view/' + l.id};
        card.desc = l.description;
        cards.push(card);
    }    
}


//-------------------------------------------------------------------------------------------------
module_init();
}());

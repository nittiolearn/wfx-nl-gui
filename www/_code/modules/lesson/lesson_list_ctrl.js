(function() {

//-------------------------------------------------------------------------------------------------
// Lesson module
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
                templateUrl : 'lib_ui/cardsview.html',
                controller : 'nl.LessonListCtrl'
            }
        }
    });
}

//-------------------------------------------------------------------------------------------------
var LessonListCtrl = ['nlLog', 'nlRes', 'nlServerApi', '$scope', 
function(nlLog, nlRes, nlServerApi, $scope) {
    $scope.title = 'View Approved Lessons';
    $scope.cards = [];

    nlServerApi.getLessonList('approved', null).then(function(result) {
        console.log('getLessonList success:', result);
        _updateCards($scope.cards, result, nlRes);
        $scope.onCardsRepaginate();
    }, function(error) {
        console.log('getLessonList failed:', error);
    });
}];

function _updateCards(cards, lessons, nlRes) {
    for(var i=0; i<lessons.length; i++) {
        var l = lessons[i];
        var card = {title:l.name, icon: nlRes.lessonIcon(l.image), url:'#/app/lesson_view/' + l.id};
        card.desc = l.description;
        cards.push(card);
    }    
}


//-------------------------------------------------------------------------------------------------
module_init();
}());

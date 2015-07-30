(function() {

//-------------------------------------------------------------------------------------------------
// temp.js:
// Temp module for experimentation
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.forum', [])
    .config(configFn)
    .controller('nl.ForumCtrl', ForumCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.forum', {
        url : '/forum',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/forum/forum.html',
                controller : 'nl.ForumCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var ForumCtrl = ['nl', 'nlRouter', '$scope', '$stateParams', '$location', 'nlDlg', 'nlLogViewer',
function(nl, nlRouter, $scope) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Forum');
            $scope.msgs = [];
            var nMsgs = getRand(10, 15);
            var d = new Date();
            var timestamp = d.getTime() - 5*24*3600*1000; // 5 days ago
            for(var i=0; i<nMsgs; i++) {
                $scope.msgs.push(getRandomMessage(timestamp + (nMsgs-i)*1000*3600 + 1000*getRand(0, 3000)));
            }
            $scope.newContent ='';
            resolve(true);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);

    $scope.fmtDate = function(d) {
        return nl.fmtDate(d);
    };
    
    $scope.getUserIcon = function(msg) {
        return nl.url.resUrl('general/top-logedin.png');
    };

    $scope.postNew = function() {
        if ($scope.newContent === '') return;
        var msg = {userName: 'Me', timestamp: new Date(), text: $scope.newContent};
        $scope.msgs.splice(0, 0, msg);
        $scope.newContent ='';
    };

    $scope.syncMessages = function() {
        var msg = {userName: 'Admin', timestamp: new Date(), text: 'Sync is not implemented yet'};
        $scope.msgs.splice(0, 0, msg);
    };
    
}];

var userNames = ['Uma Sivaji', 'Fadena Fransis', 'Priya K', 'Partha Roy', 'AK Singh', 'Srikamala', 'Ritu Chabra'];
var texts = ['Possitive reinforcement methods have worked much more effectively in my class for most of the students. For some however, I needed to use some mild punishments.',
'Power is of two kinds. One is obtained by the fear of punishment and the other by acts of love. Power based on love is a thousand times more effective and permanent then the one derived from fear of punishment.', 
'If people are good only because they fear punishment, and hope for reward, then we are a sorry lot indeed.', 
'Behavior management is used when an individual tries to stop problem behavior from another individual. Behavior modification and behavior therapy are two ways to help with behavior management.',
'Positive reinforcement, negative reinforcement, positive and negative punishment are all forms of Operant Conditioning. Reinforcements are when you try to increase behavior, either positively or negatively.',
'Abraham Maslow is a very well-known humanist psychologist with his work for hierarchy needs, in this he describes that humans have basic needs, and they are not met, that individual will not desire anything else.',
'The highest point on Maslow’s pyramid is self-actualization which Maslow argues is the goal in which we do not reach.',
'I prefer the carrot and stick approach.'
];

function getRandomMessage(timestamp) {
    return {
        userName: getRandFromArray(userNames), 
        timestamp: new Date(timestamp), 
        text: getRandFromArray(texts)
    };
}

function getRandFromArray(arr) {
    return arr[getRand(0, arr.length-1)];
}

function getRand(min, max) {
    return min + Math.floor(Math.random()*(max-min+1));
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

(function() {

//-------------------------------------------------------------------------------------------------
// All Server side interfaces are collected in a single service
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.remoteservices', [])
    .service('nlRemoteService', NlRemoteService);
}

//-------------------------------------------------------------------------------------------------
var NlRemoteService = ['nlLog', 'nlRes', '$http',
function(nlLog, nlRes, $http) {
    this.login = function(userName, password) {
        nlLog.warning('TODO Login done: ' + userName);
    };
    this.logout = function(onCompleteFn) {
        nlLog.warning('TODO Logout done');
    };
    this.getDashboardCards = function() {
        nlLog.warning('TODO getDashboardCards');
        return [{title: 'Content Corner', icon: nlRes.dashboardIcon('lesson.png'), 
                         url: '#/app/lesson/approved', 
                         desc: 'View list of approved lessons'},
                        {title: 'Create Lesson', icon: nlRes.dashboardIcon('lesson.png'), 
                         url: '#/app/lesson_create', 
                         desc: 'Create a new lessons'},
                        {title: 'New Assignments', icon: nlRes.dashboardIcon('new_assign.png'), 
                         url: '#/app/assign/new', 
                         desc: 'View list of new assignments'},
                        {title: 'Past Assignments', icon: nlRes.dashboardIcon('past_assign.png'), 
                         url: '#/app/assign/past', 
                         desc: 'View list of past assignments'},
                        {title: 'Home', icon: nlRes.dashboardIcon('home.png'), 
                         url: '#/app/home', 
                         desc: 'Home'},
                        {title: 'Temp Playground', icon: nlRes.dashboardIcon('home.png'), 
                         url: '#/app/temp', 
                         desc: 'Temp'},
                        {title: 'No Url', icon: nlRes.dashboardIcon('past_assign.png'), 
                         url: '', 
                         desc: 'Temp'}
                    ];
    };
}];

module_init();
})();

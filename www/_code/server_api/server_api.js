(function() {

//-------------------------------------------------------------------------------------------------
// All Server side interfaces are collected in a single service
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.server_api', [])
    .service('nlServerApi', NlServerApi);
}

//-------------------------------------------------------------------------------------------------
var NlServerApi = ['nlLog', 'nlRes', '$http', 'nlDb',
function(nlLog, nlRes, $http, nlDb) {
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
    
    //----------------------------------------------------------------------------------------------
    this.getLessonList = function(type, filter) {
        return new Promise(function(resolve, reject) {
            if (type !== 'approved') {
                reject('type !== approved');
                return;
            }
            var lessons = [];
            var db = nlDb.get();
            var key_range = ydn.db.KeyRange.lowerBound(0);
            var q = db.values('lesson', key_range, 100).then(function(dbLessons) {
                console.log('getLessonList: got result', dbLessons);
                if (dbLessons === undefined) {
                    reject('dbLessons === undefined');
                    return;
                }
                for (var i=0; i<dbLessons.length; i++) {
                    lessons.push(dbLessons[i]);
                }
                resolve(lessons);
            });
        });
    };

    //----------------------------------------------------------------------------------------------
    this.getLesson = function(lessonId) {
        return new Promise(function(resolve, reject) {
            var db = nlDb.get();
            db.get('lesson', lessonId).then(function(lesson) {
                if (lesson === undefined) {
                    reject('getLesson failed: lesson === undefined');
                    return;                    
                }
                resolve(lesson);
            }, function(e) {
                reject('getLesson failed', e);
            });
        });
    };
}];

module_init();
})();

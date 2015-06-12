(function() {

//-------------------------------------------------------------------------------------------------
// server_api.js:
// All Server side interfaces are collected in a single service
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.server_api', [])
    .service('nlServerApi', NlServerApi);
}

//-------------------------------------------------------------------------------------------------
var NlServerApi = ['nl',
function(nl) {
    this.login = function(userName, password) {
        nl.log.warn('TODO Login done: ' + userName);
    };
    this.logout = function(onCompleteFn) {
        nl.log.warn('TODO Logout done');
    };
    this.getDashboardCards = function() {
        nl.log.warn('TODO getDashboardCards');
        return [{title: 'Content Corner', icon: nl.url.resUrl('dashboard/wsheet.png'), 
                         url: '#/app/lesson/approved', 
                         desc: 'View list of approved lessons'},
                        {title: 'Create Lesson', icon: nl.url.resUrl('dashboard/wsheet.png'), 
                         url: '#/app/lesson_create', 
                         desc: 'Create a new lessons'},
                        {title: 'New Assignments', icon: nl.url.resUrl('dashboard/assign.png'), 
                         url: '#/app/assign/new', 
                         desc: 'View list of new assignments'},
                        {title: 'Past Assignments', icon: nl.url.resUrl('dashboard/assign.png'), 
                         url: '#/app/assign/past', 
                         desc: 'View list of past assignments'},
                        {title: 'Home', icon: nl.url.resUrl('dashboard/home.png'), 
                         url: '#/app/home', 
                         desc: 'Home'},
                        {title: 'Temp Playground', icon: nl.url.resUrl('dashboard/admin.png'), 
                         url: '#/app/temp', 
                         desc: 'Temp'},
                        {title: 'No Url', icon: nl.url.resUrl('dashboard/warning.png'), 
                         url: '', 
                         desc: 'Temp'}
                    ];
    };
    
    //----------------------------------------------------------------------------------------------
    this.getLessonList = function(type, filter) {
        return nl.q(function(resolve, reject) {
            if (type !== 'approved') {
                reject('type !== approved');
                return;
            }
            var lessons = [];
            var db = nl.db.get();
            var key_range = ydn.db.KeyRange.lowerBound(0);
            var q = db.values('lesson', key_range, 100).then(function(dbLessons) {
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
        return nl.q(function(resolve, reject) {
            var db = nl.db.get();
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

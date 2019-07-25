(function() {
	// learner_view_assignments.js: This is to store the assignment content and course content

function module_init() {
    angular.module('nl.learner_view_assignments', [])
    .config(configFn)
    .service('nlLearnerAssignment', NlLearnerAssignment)
    .service('nlLearnerCourseRecords', NlLearnerCourseRecords);
    
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
}];

var NlLearnerAssignment = ['nl', 'nlCourse',
function(nl, nlCourse) {

    var _records = {};

    this.wasFetched = function(key) {
        return (key in _records) ? true : false;
    };
    
    this.addRecord = function(assign, key) {
        _records[key] = assign;
    };
    
    this.getRecord = function(key) {
        return _records[key];
    };
}];

var NlLearnerCourseRecords = ['nl', 'nlCourse',
function(nl, nlCourse) {
    var _records = {};
    
    this.wasFetched = function(cid) {
    	return (cid in _records) ? true : false;
    };
    
    this.addRecord = function(course, cid) {
    	_records[cid] = _process(course);
    };
    
    // this.getContentOfCourseAssignment = function() {
    // 	if(nlLrFilter.getType() != 'course_assign') return null;
    // 	for (var cid in _records) return _records[cid].content;
    // 	return null;
    // };
    
    this.getRecord = function(cid) {
    	return _records[cid];
    };
    
    this.getCourseInfoFromReport = function(report, repcontent) {
    	var course = {id: report.lesson_id, name: repcontent.name, content: repcontent.content};
    	return _process(course);
	};

    function _process(course) {
		course = nlCourse.migrateCourse(course);
        var idToFullName = {};
        var ret = {id: course.id, name: course.name || '',
            certificates: [], lessons: [], nonLessons: [],
            content: course.content, is_published: course.is_published || false};
        ret.contentmetadata = course.content && course.content.contentmetadata ? course.content.contentmetadata : {};
        var modules = (course.content || {}).modules || [];
        for (var i=0; i<modules.length; i++) {
            var m = modules[i];
            if (!m.id) continue;
            _updateIdToFullName(m, idToFullName);
            if (m.type == 'lesson') ret.lessons.push({id: m.id, name:idToFullName[m.id]});
            else if (m.type == 'certificate') ret.certificates.push(m.id);
            else if (m.type != 'module') ret.nonLessons.push(m.id);
        }
        if (modules.length == 0) {
        	// Can happen only if course is not found and report does not have content.
        	// In this case, the status is pending. This will force it to such a status.
        	ret.nonLessons.push('dummy'); 
        }
        return ret;
    }
    
    var _DELIM = '.';
    function _updateIdToFullName(m, idToFullName) {
        var pid = _getParentId(m);
        var prefix = pid && idToFullName[pid] ? idToFullName[pid] + _DELIM : '';
        var myName = prefix + (m.name || '');
        idToFullName[m.id] = myName;
    }

    function _getParentId(m) {
        var parentId = m.parentId || '';
        if (parentId) return parentId;
        var parents = m.id.split(_DELIM);
        parents.pop();
        return (parents.length == 0) ? '' : parents.join(_DELIM);
    } 
}]
module_init();
})();
    
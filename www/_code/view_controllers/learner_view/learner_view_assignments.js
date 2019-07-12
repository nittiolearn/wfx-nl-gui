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
    this.init = function() {
        _records = {};
    };

    this.wasFetched = function(key) {
        return (key in _records) ? true : false;
    };
    
    this.addRecord = function(assign, key) {
        _records[key] = assign;
    };
    
    this.getRecord = function(key) {
        return _records[key];
    };
    
    // Same is available in server side too (needs to be updated in the same way) - see ncourse.overrideAssignmentParameterInReport
    this.overrideAssignmentParameterInReport = function(report, repcontent) {
        var table = report.ctype == _nl.ctypes.CTYPE_COURSE ? 'course_assignment:' : 'assignment:';
        var assignInfo = this.getRecord(table+report.assignment);
        if (!assignInfo) return;
        if (report.ctype == _nl.ctypes.CTYPE_COURSE) assignInfo = assignInfo.info;
        if (!assignInfo) return;

        repcontent.batchname = (report.assigntype == _nl.atypes.ATYPE_TRAINING ? repcontent.trainingName : 
            assignInfo ? assignInfo.batchname : repcontent.batchname) || '';
        repcontent.not_before = assignInfo.not_before;
        repcontent.not_after = assignInfo.not_after || '';
        repcontent.submissionAfterEndtime = assignInfo.submissionAfterEndtime;
            
        if (report.ctype == _nl.ctypes.CTYPE_COURSE) {
            _copyAttrsIf(assignInfo, repcontent, ['remarks'], ['']);
            if (assignInfo.blended) _copyAttrsIf(assignInfo, repcontent, ['iltTrainerName', 'iltVenue', 'iltCostInfra', 'iltCostTrainer',
                'iltCostFoodSta', 'iltCostTravelAco', 'iltCostMisc'], ['', '', '', '', '', '', '']);
        } else {
            _copyAttrsIf(assignInfo, repcontent, ['assign_remarks', 'max_duration', 'learnmode'], ['', undefined, undefined]);
        }
        return repcontent;
    };
    
    function _copyAttrsIf(src, dest, attrs, defVals) {
        for (var i=0; i<attrs.length; i++) {
            var attr = attrs[i];
            if (attr in src) dest[attr] = src[attr];
            else if (defVals[i] !== undefined) dest[attr] = defVals[i];
        }
    }
}];

var NlLearnerCourseRecords = ['nl', 'nlCourse',
function(nl, nlCourse) {
    var _records = {};
    
	this.init = function() {
		_records = {};
	};

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
        var ret = {id: course.id, name: course.name || '', created: course.created || null, 
            updated: course.updated || null, certificates: [], lessons: [], nonLessons: [],
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
    
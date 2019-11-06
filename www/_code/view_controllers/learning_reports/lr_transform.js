(function() {

//-------------------------------------------------------------------------------------------------
// lr_transform.js: Transform learning_report as a array to object form
// This is in sync with nlr_transform.py
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.lr_transform', [])
	.config(configFn)
	.service('nlLrTransform', NlLrTransform);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
}];

//-------------------------------------------------------------------------------------------------
var NlLrTransform = ['nl', function(nl) {
	this.lrArrayToObj = function(lrArray) {
		if (lrArray.updated) return lrArray; // This is not an array but a report object
		var lrObj = {'repcontent': {}};
		if (!_validate(lrArray)) return lrObj;
		var offset = 0;
		_lrArrayToObjAttrs(_common_attrs, offset, lrArray, lrObj);
		offset += _common_attrs.length;
		if (lrArray.length <= offset) return lrObj;
		_lrArrayToObjAttrs(_module_attrs, offset, lrArray, lrObj);
		return lrObj;
	};

	function _validate(lrArray) {
		if (lrArray.length < 1) return false;
		var versions = lrArray[0].split('.');
		// Needs improvement when next transform version is supproted.
		if (versions.length != 2 || versions[0] != TRANSFORMER_VERSION) return false;
		var expectedLen = _common_attrs.length;
		if (versions[1] == WITH_CONTENT) expectedLen += _module_attrs.length;
		if (lrArray.length != expectedLen) return false;
		return true;
	}

	function _lrArrayToObjAttrs(attrs, offset, lrArray, lrObj) {
		for (var i=0; i<attrs.length; i++) {
			var attrInfo = attrs[i];
			if (attrInfo['type'] == 'version' || attrInfo['type'] == 'report'|| attrInfo['type'] == 'subitem') {
				lrObj[attrInfo['attr']] = lrArray[offset+i];
			} else if (attrInfo['type'] == 'repcontent' ) {
				lrObj['repcontent'][attrInfo['attr']] = lrArray[offset+i];
			} else if (attrInfo['type'] == '_pageQuizScores') {
				_lrSubArrayToObjArray(lrObj['repcontent'], '_pageQuizScores', lrArray[offset+i])
			} else if (attrInfo['type'] == '_pageFeedbacks') {
				_lrSubArrayToObjArray(lrObj['repcontent'], '_pageFeedbacks', lrArray[offset+i])
			}
		}
	}

	function _lrSubArrayToObjArray(repcontent, attr, lrSubArray) {
		repcontent[attr] = [];
		var attrs = _sub_item_arrays[attr];
		for (var i=0; i<lrSubArray.length; i++) {
			var subItem = lrSubArray[i];
			var lrSubObj = {};
			_lrArrayToObjAttrs(attrs, 0, lrSubArray[i], lrSubObj);
			repcontent[attr].push(lrSubObj);
		}
	}

}];

var TRANSFORMER_VERSION='1';
var WITH_CONTENT='content=y';
var WITHOUT_CONTENT='content=n';
var _common_attrs = [
    {'attr': '_transformVersion', 'type': 'version', 'fromVersion': 1},
    {'attr': 'id', 'type': 'report', 'fromVersion': 1},
    {'attr': 'student', 'type': 'report', 'fromVersion': 1},
    {'attr': 'deleted', 'type': 'report', 'fromVersion': 1},
    {'attr': 'assigntype', 'type': 'report', 'fromVersion': 1},
    {'attr': 'ctype', 'type': 'report', 'fromVersion': 1},
    {'attr': 'assignment', 'type': 'report', 'fromVersion': 1},
    {'attr': 'lesson_id', 'type': 'report', 'fromVersion': 1},
    {'attr': 'containerid', 'type': 'report', 'fromVersion': 1},
    {'attr': 'assignor', 'type': 'report', 'fromVersion': 1},
    {'attr': 'completed', 'type': 'report', 'fromVersion': 1},
    {'attr': 'created', 'type': 'report', 'fromVersion': 1},
    {'attr': 'updated', 'type': 'report', 'fromVersion': 1},
];

var _module_attrs = [
    {'attr': 'started', 'type': 'repcontent', 'fromVersion': 1},
    {'attr': 'ended', 'type': 'repcontent', 'fromVersion': 1},
    {'attr': 'score', 'type': 'repcontent', 'fromVersion': 1},
    {'attr': 'maxScore', 'type': 'repcontent', 'fromVersion': 1},
    {'attr': 'passScore', 'type': 'repcontent', 'fromVersion': 1},
    {'attr': 'timeSpentSeconds', 'type': 'repcontent', 'fromVersion': 1},
    {'attr': 'selfLearningMode', 'type': 'repcontent', 'fromVersion': 1},
    {'attr': 'feedbackScore', 'type': 'repcontent', 'fromVersion': 1},

    {'attr': 'name', 'type': 'repcontent', 'fromVersion': 1},
    {'attr': 'assigned_by', 'type': 'repcontent', 'fromVersion': 1},
    {'attr': 'grade', 'type': 'repcontent', 'fromVersion': 1},
    {'attr': 'subject', 'type': 'repcontent', 'fromVersion': 1},
    {'attr': 'courseName', 'type': 'repcontent', 'fromVersion': 1},
    {'attr': 'courseId', 'type': 'repcontent', 'fromVersion': 1},
    {'attr': 'description', 'type': 'repcontent', 'fromVersion': 1},
    {'attr': 'studentname', 'type': 'repcontent', 'fromVersion': 1},

    {'attr': '_pageQuizScores', 'type': '_pageQuizScores', 'fromVersion': 1}, // [[pgNo, title, maxScore, score], ...]
    {'attr': '_pageFeedbacks', 'type': '_pageFeedbacks', 'fromVersion': 1} // [[pgNo, title, question, response], ...]
];

var _sub_item_arrays = {
	'_pageQuizScores' : [
		{'attr': 'pgNo', 'type': 'subitem', 'fromVersion': 1},
		{'attr': 'title', 'type': 'subitem', 'fromVersion': 1},
		{'attr': 'maxScore', 'type': 'subitem', 'fromVersion': 1},
		{'attr': 'score', 'type': 'subitem', 'fromVersion': 1}
	],
	'_pageFeedbacks' : [
		{'attr': 'pgNo', 'type': 'subitem', 'fromVersion': 1},
		{'attr': 'title', 'type': 'subitem', 'fromVersion': 1},
		{'attr': 'question', 'type': 'subitem', 'fromVersion': 1},
		{'attr': 'response', 'type': 'subitem', 'fromVersion': 1}
	]
};

//-------------------------------------------------------------------------------------------------
module_init();
})();

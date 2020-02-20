(function() {

//-------------------------------------------------------------------------------------------------
// lr_trainer_dlgs.js: Attendance marking dialog for the trainer.
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.lr_trainer_dlgs', [])
	.service('nlLrTrainerDlgs', NlLrTrainerDlgs);
}

var NlLrTrainerDlgs = ['nl', 'nlDlg', 'nlTreeListSrv', 'nlCourse', 'nlReportHelper', 'nlLrCourseAssignView',
function(nl, nlDlg, nlTreeListSrv, nlCourse, nlReportHelper, nlLrCourseAssignView) {

this.getCourseAssignView = function() {
	return nlLrCourseAssignView;
};

this.showUpdateTrainingBatchDlg = function($scope, courseAssignment, modules, learningRecords, groupInfo) {
	var ctx = _getContext(courseAssignment, modules, learningRecords, groupInfo);
	var dlg = new UpdateTrainingBatchDlg($scope, ctx);
	dlg.show();
}

function _getContext(courseAssignment, modules, learningRecords, groupInfo) {
	var ctx = {learningRecords: learningRecords, groupInfo: groupInfo};
	ctx.dbAttendance = new DbAttendanceObject(courseAssignment, ctx);
	ctx.dbRating = new DbRatingObject(courseAssignment, ctx);
	ctx.dbMilestone = new DbMilestoneObject(courseAssignment, ctx);

	ctx.addModule = function(cm, addAfterCm) {
		var posToAdd = 0;
		if (addAfterCm) {
			for(var i=0; i<ctx.modules.length; i++) {
				if (addAfterCm.id != ctx.modules[i].id) continue;
				posToAdd = i+1;
				break;
			}
		}
		ctx.modules.splice(posToAdd, 0, cm);
		_addLearningRecordsToCm(cm);
	};

	ctx.deleteModule = function(cm) {
		var posToDel = -1;
		for(var i=0; i<ctx.modules.length; i++) {
			if (cm.id != ctx.modules[i].id) continue;
			posToDel = i;
			break;
		}
		if (posToDel < 0) return;
		ctx.modules.splice(posToDel, 1);
	};

	function _updateCtxModules() {
		ctx.trainerItemTypes = {};
		ctx.lrArray = [];
		for (var repid in ctx.learningRecords) {
			var lr = ctx.learningRecords[repid];
			if (!lr || !lr.raw_record) continue;
			ctx.lrArray.push(lr);
		}
		ctx.lrArray.sort(function(a, b) {
			var aName = a.user.name.toLowerCase();
			var bName = b.user.name.toLowerCase();
			if(aName > bName) return 1;
			if(aName < bName) return -1;
			return 0;
		});
	
		// Entry to help GUI easily represent bulk entry
		var bulkEntry = {bulkEntry: true, user: {name: 'All', user_id: ''}, raw_record: {id: -1}};
		ctx.lrArray.splice(0, 0, bulkEntry);
	
		var modules = ctx.modules;
		ctx.modules = [];
		for (var i=0; i<modules.length; i++) {
			var cm = modules[i];
			if (cm.type != 'module' && cm.type != 'iltsession' && cm.type != 'rating' && cm.type != 'milestone') continue;
			if (cm.type == 'folder') {
				ctx.modules.push(cm);
				continue;
			}
			_addLearningRecordsToCm(cm);
			if (cm.type == 'iltsession') {
				ctx.dbAttendance.updateItem(cm);
			} else if (cm.type == 'rating') {
				ctx.dbRating.updateItem(cm);
			} else if (cm.type == 'milestone') {
				ctx.dbMilestone.updateItem(cm);
			}
			if (modules[i].deleteItem) continue;
			ctx.trainerItemTypes[cm.type] = true;
			ctx.modules.push(cm);
		}
	}

	function _addLearningRecordsToCm(cm) {
		cm.learningRecords = [];
		for (var j=0; j<ctx.lrArray.length; j++) {
			var lr = ctx.lrArray[j];
			var report = {id: lr.raw_record.id, learnername: lr.user.name, learnerid: lr.user.user_id};
			if (lr.bulkEntry) report.bulkEntry = true;
			cm.learningRecords.push(report);
		}
	}

	ctx.modules = angular.copy(nlReportHelper.getAsdUpdatedModules(modules || [], ctx.dbAttendance.getDbObj()));
	_updateCtxModules();
	ctx.oldModules = angular.copy(ctx.modules);

	return ctx;
}

//-------------------------------------------------------------------------------------------------
function DbAttendanceObject(courseAssignment, ctx) {

	this.getEtmAsd = function() {
		return _etmAsd;
	};

	this.getDbObj = function() {
		return _dbobj;
	};

	this.getFirstSessionId = function() {
		for(var i=0; i<ctx.modules.length; i++) {
			var cm  = ctx.modules[i];
			if (cm.type == 'iltsession') return cm.id;
		}
		return null;
	};

	this.updateItem = function(cm) {
		if (_etmAsd.length > 0) {
			var sessionInfo = _sessionInfos[cm.id] || {};
			cm.sessiondate = nl.fmt.json2Date(sessionInfo.sessiondate || '');
		}
		cm.attendanceOptions = cm.asdSession ? _attendanceOptionsAsd : _attendanceOptions;
		cm.attendanceRemarksOptions = _remOptions;
		for (var i=0; i<ctx.lrArray.length; i++) {
			var lr = ctx.lrArray[i];
			var itemLr = cm.learningRecords[i];
			var itemInfo = lr.bulkEntry ? {} : lr.repcontent.statusinfo[cm.id] || {};
			itemLr.attendance = {id: itemInfo.attId || ''};
			itemLr.remarks = {id: itemInfo.remarks || ''};
		}
	};

	this.addAsdSession = function(parentFixedSession) {
		if (_etmAsd.length == 0) return;
		_lastAsdId++;
		var item = {id: '_asdsession' + _lastAsdId, reason: _etmAsd[0], remarks: ''};
		item = nlReportHelper.getAsdItem(item);
		ctx.addModule(item, parentFixedSession);
		this.updateItem(item);
		return item;
	};

	this.removeAsdSession = function(cm) {
		if (_etmAsd.length == 0) return;
		ctx.deleteModule(cm);
	};

	this.copyFrom = function(srcLr, destLr, cm) {
		destLr.attendance = srcLr.attendance;
		destLr.remarks = srcLr.remarks;
	};

	this.validateLr = function(lr, cm, prevOfLr) {
		var attendanceConfig = _attendanceOptionsDict[lr.attendance.id] || {};
		if (!lr.attendance.id) {
			cm.isMarkingComplete = false;
			return;
		}
		if (attendanceConfig.isAttrition || attendanceConfig.id == 'certified')
			lr.cantProceedMessage = nl.fmt2('Marked {} at {}', attendanceConfig.name, nlReportHelper.getItemName(cm));
		if (!lr.attendance.id || lr.remarks.id || attendanceConfig.remarksOptional) 
			return;
		lr.validationErrorMsg = 'Remarks mandatory';
		if (!cm.validationErrorMsg) cm.validationErrorMsg = nl.fmt2('{}: Remarks mandatory', nlReportHelper.getItemName(cm));
	};

	this.isPartiallyPresent = function(lr) {
		var attendanceConfig = _attendanceOptionsDict[lr.attendance.id] || {};
		return attendanceConfig.timePerc ? true : false;
	};

	this.validateDates = function() {
		// TODO-NOW: Validate session dates when update button is pressed
		// if etmAsd:
		// 		date should be marked
		// 		date should be > above fixed ilts
		// 		date should be < below fixed ilts if !asdSession

		// TODO-NOW: Also allow text field remarks for others
	};

	this.updateCmChanges = function(cm, oldCm, cmChanges) {
		if (!_etmAsd) return null;
		if (nl.fmt.date2Str(cm.sessiondate, 'date')  != nl.fmt.date2Str(oldCm.sessiondate, 'date')) {
			cmChanges.push({attr: 'Date', val: nl.fmt.date2StrDDMMYY(cm.sessiondate)});
		}
		if (!cm.asdSession) return;
		if (cm.reason.id != oldCm.reason.id) {
			cmChanges.push({attr: 'Session Reason', val: cm.reason.name});
		}
		if (cm.remarks != oldCm.remarks) {
			cmChanges.push({attr: 'Session Remarks', val: cm.remarks});
		}
	};

	this.updateLrChanges = function(lr, oldLr, lrChanges) {
		if (lr.attendance.id == oldLr.attendance.id && lr.remarks.id == oldLr.remarks.id) return;
		lrChanges.push({lr: lr});
	};

	this.getObjectForSavingToDb = function() {
		_sessionInfos = _dbobj.sessionInfos || {};
		_lastAsdId = _dbobj.lastAsdId || 0;
		_initAttendanceOptions();
		_remOptions =_getAttendanceRemarksOptions();
		// TODO-NOW: May not be needed
		_userAttendaces = _getAttendaceAsDictOfDict();
	}


	// Private data
	var _etmAsd = [];
	var _dbobj = {};
	var _sessionInfos = {}; // Part of _dbobj
	var _lastAsdId = 0;
	var _attendanceOptions = [];
	var _attendanceOptionsAsd = [];
	var _attendanceOptionsDict = {};
	var _remOptions = null;
	var _userAttendaces = {};
	var _fixed_keys_in_db_obj = {
		'attendance_version' : true,
		'sessionInfos' : true,
		'lastAsdId' : true		
	};

	// private functions
	function _init() {
		_etmAsd = ctx.groupInfo.props.etmAsd || [];
		_dbobj = courseAssignment.attendance ? angular.fromJson(courseAssignment.attendance) : {};
		_dbobj = nlCourse.migrateCourseAttendance(_dbobj);
		_sessionInfos = _dbobj.sessionInfos || {};
		_lastAsdId = _dbobj.lastAsdId || 0;
		_initAttendanceOptions();
		_remOptions =_getAttendanceRemarksOptions();
		// TODO-NOW: May not be needed
		_userAttendaces = _getAttendaceAsDictOfDict();
	}

	function _initAttendanceOptions() {
		_attendanceOptionsAsd = ctx.groupInfo.props.attendance || []; 
		for (var i=0; i<_attendanceOptionsAsd.length; i++) {
			var item = _attendanceOptionsAsd[i];
			_attendanceOptionsDict[item.id] = item;
			if (item.id === 'notapplicable') continue;
			_attendanceOptions.push(item);
		}
	}

	function _getAttendanceRemarksOptions() {
		var opts = ctx.groupInfo.props.attendanceRemarks;
		if (!opts || opts.length == 0) return null;
		var ret = [];
		ret.push({id: '', name: ''});
		for(var i=0; i<opts.length; i++) ret.push({id: opts[i], name: opts[i]});
		return ret;
	}

	function _getAttendaceAsDictOfDict() {
		// returns {repid1: {cmid1: {}, cmid2: {}}, repid2: }
		var ret = {};
		for (var repid in _dbobj) {
			if (repid in _fixed_keys_in_db_obj) continue;
			ret[repid] = {};
			for (var i=0; i<_dbobj[repid].length; i++) {
				var userSessionAttendance = _dbobj[repid][i];
				ret[repid][userSessionAttendance.id] = userSessionAttendance;
			}
		}
		return ret;
	}

	_init();
}

//-------------------------------------------------------------------------------------------------
function DbRatingObject(courseAssignment, ctx) {

	function _init() {
		_dbobj = courseAssignment.rating ? angular.fromJson(courseAssignment.rating) : {};
		var ratings = ctx.groupInfo.props.ratings;
		if (!ratings) return;
		_ratingDict = {};
		for(var i=0; i<ratings.length; i++) {
			var r = angular.copy(ratings[i]);
			_ratingDict[r.id] = r;
			if (r.values && r.values.length > 0) {
				// 'status' && 'select'
				r.ratingOptions = [];
				for(var j=0; j<r.values.length; j++) {
					r.ratingOptions.push({id: r.values[j]['p'], name: r.values[j]['v']});
				}
			}

			if (r.remarks && r.remarks.length > 0) {
				r.remarkOptions = [];
				for (var j=0; j<r.remarks.length; j++) {
					var remark = r.remarks[j];
					r.remarkOptions.push({id:remark, name:remark, selected:false});
				}
			}
		}

	}

	this.updateItem = function(cm) {
		if (!_ratingDict || !cm.rating_type || !_ratingDict[cm.rating_type]) {
			cm.deleteItem = true;
			return;
		}
		var ratingConfig = _ratingDict[cm.rating_type];
		cm.ratingType = ratingConfig.type == 'number' ? 'input' : 'select';
		cm.ratingOptions = ratingConfig.ratingOptions;

		for (var i=0; i<ctx.lrArray.length; i++) {
			var lr = ctx.lrArray[i];
			var itemLr = cm.learningRecords[i];
			var itemInfo = lr.bulkEntry ? {} : lr.repcontent.statusinfo[cm.id] || {};
			itemLr.rating = {id: itemInfo.score};
			itemLr.remarks = Array.isArray(itemInfo.remarks || '') ? itemInfo.remarks : [itemInfo.remarks||''];
			itemLr.otherRemarks = itemInfo.otherRemarks;
			_initRemarksOptions(itemLr, ratingConfig);
		}
	};

	this.copyFrom = function(srcLr, destLr, cm) {
		destLr.rating = srcLr.rating;
		var ratingConfig = _ratingDict[cm.rating_type];
		_updateRemarks(srcLr, ratingConfig);
		destLr.remarks = srcLr.remarks;
		destLr.otherRemarks = srcLr.otherRemarks;
		_initRemarksOptions(destLr, ratingConfig);
	};

	function _updateRemarks(lr, ratingConfig) {
		if (ratingConfig.remarkOptions) return;
		lr.remarks = [lr.remarksStr];
	}

	function _initRemarksOptions(report, ratingConfig) {
		report.remarksStr = nl.fmt.arrayToString(report.remarks);
		report.showOtherRemarks = false;
		if (!ratingConfig.remarkOptions) return;
		report.ratingRemarksOptions = angular.copy(ratingConfig.remarkOptions);
		var remarksDict = {};
		for(var i=0; i<report.remarks.length; i++) remarksDict[report.remarks[i]] = true;
		
		for(var i=0; i<report.ratingRemarksOptions.length; i++) {
			var opt = report.ratingRemarksOptions[i];
			opt.selected = (opt.name in remarksDict);
			if (opt.name == 'Other') report.showOtherRemarks = opt.selected;
		}
	};

	this.updateRemarksOptionsAndStr = function(report, selectedOption) {
		selectedOption.selected = !selectedOption.selected;

		report.showOtherRemarks = false;
		report.remarks = [];
		for(var i=0; i<report.ratingRemarksOptions.length; i++) {
			var opt = report.ratingRemarksOptions[i];
			if(opt.selected) report.remarks.push(opt.name);
			if (opt.name == 'Other') report.showOtherRemarks = opt.selected;
		}
		report.remarksStr = nl.fmt.arrayToString(report.remarks);
	};

	this.validateLr = function(lr, cm, prevOfLr) {
		var ratingConfig = _ratingDict[cm.rating_type];
		_lockRatingOnAbsent(lr, prevOfLr, ratingConfig);
		if (!lr.rating.id && lr.rating.id !== 0) {
			cm.isMarkingComplete = false;
			return;
		}
		if (ratingConfig.id != 'rag') return;
		if (parseInt(lr.rating.id) == 100) return;
		if (!lr.remarksStr) {
			lr.validationErrorMsg = 'Remarks mandatory';
			if (!cm.validationErrorMsg) cm.validationErrorMsg = nl.fmt2('{}: Remarks mandatory', nlReportHelper.getItemName(cm));
		} else if (lr.showOtherRemarks && !lr.otherRemarks) {
			lr.validationErrorMsg = 'Additional remarks mandatory for selection "Other"';
			if (!cm.validationErrorMsg) cm.validationErrorMsg = nl.fmt2('{}: {}',
				nlReportHelper.getItemName(cm), lr.validationErrorMsg);
		}
	};

	this.updateCmChanges = function(cm, oldCm, cmChanges) {
		return; // Nothing to check here
	};

	this.updateLrChanges = function(lr, oldLr, lrChanges) {
		if (lr.rating.id == oldLr.rating.id && lr.remarksStr == oldLr.remarksStr &&
			(!lr.showOtherRemarks || lr.otherRemarks == oldLr.otherRemarks)) return;
		lrChanges.push({lr: lr});
	};

	function _lockRatingOnAbsent(lr, prevOfLr, ratingConfig) {
		if (ratingConfig.id == 'rag') return;
		if (!prevOfLr.atd) return;
		var partiallyPresent = ctx.dbAttendance.isPartiallyPresent(prevOfLr.atd);
		for(var i=0; i< prevOfLr.atdAsd.length; i++) {
			if (partiallyPresent) break;
			partiallyPresent = ctx.dbAttendance.isPartiallyPresent(prevOfLr.atdAsd[i]);
		}
		if (partiallyPresent) return;
		lr.lockedMessage = 'Not present in earlier session';
	}

	// Private members
	var _dbobj = {};
	var _ratingDict = null;
	_init();
}

//-------------------------------------------------------------------------------------------------
function DbMilestoneObject(courseAssignment, ctx) {

	function _init() {
		_dbobj = courseAssignment.milestone ? angular.fromJson(courseAssignment.milestone) : {};
	}

	this.updateItem = function(cm) {
		var milestoneInfo = _dbobj[cm.id] || {};
		cm.comment = milestoneInfo.comment || '';
		cm.milestoneMarked = milestoneInfo.status == 'done' ? true : false
		for (var i=0; i<ctx.lrArray.length; i++) {
			var lr = ctx.lrArray[i];
			var itemLr = cm.learningRecords[i];
			var itemInfo = lr.bulkEntry ? {} : lr.repcontent.statusinfo[cm.id] || {};
			itemLr.remarks = itemInfo.remarks == cm.comment ? '' : itemInfo.remarks;
			itemLr.milestoneMarked = itemInfo.reached ? true : false;
		}
	};

	this.markAll = function(cm, checked) {
		for (var i=1; i<ctx.lrArray.length; i++) {
			var itemLr = cm.learningRecords[i];
			itemLr.milestoneMarked = checked;
		}
	};

	this.validateLr = function(lr, cm, prevOfLr) {
		cm.isMarkingComplete = cm.milestoneMarked;
		if (!cm.isMarkingComplete) return;
		if (lr.milestoneMarked) return;
		lr.cantProceedMessage = nl.fmt2('{} not reached', nlReportHelper.getItemName(cm));
	};

	this.updateCmChanges = function(cm, oldCm, cmChanges) {
		if (cm.comment != oldCm.comment) {
			cmChanges.push({attr: 'Milestone Reamrks', val: cm.comment});
		}
		if (cm.milestoneMarked != oldCm.milestoneMarked) {
			cmChanges.push({attr: 'Milestone Status', val: cm.milestoneMarked ? 'Reached' : 'Not Reached'});
		}
	};

	this.updateLrChanges = function(lr, oldLr, lrChanges) {
		if (lr.remarks == oldLr.remarks) return;
		lrChanges.push({lr: lr});
	};

	// Private members
	var _dbobj = {};
	_init();
}

//-------------------------------------------------------------------------------------------------
function Validator(ctx) {

	// Error related attributes:
	// cm.lockedOnItem: edit form is not shown for the cm till lockedOnItem is updated fully
	// cm.isMarkingComplete: true/false. lockedOnItem for below entries is computed based on this.
	// cm.validationErrorMsg: First validation error in the edit form of this cm
	// cm.lr[i].lockedMessage: user report is locked due to this reason
	// cm.lr[i].cantProceedMessage: current item is not locked but next onwards has to be locked
	// cm.lr[i].validationErrorMsg: Validation error in this item
	this.validate = function() {
		var prevCms = {atd: null, rtg: null, ms: null};
		var prevReps = {}; // {uid1: {atd: lr, rtg: lr, ms: lr}, uid2: {...}, ...};
		var firstInvalidCm = null;
		for(var i=0; i<ctx.modules.length; i++) {
			var cm = ctx.modules[i];
			if (!cm || cm.type == 'module') continue;
			cm.lockedOnItem = null;
			cm.validationErrorMsg = null;
			cm.isMarkingComplete = true;

			_validateCm(cm, prevCms, prevReps);

			if (cm.lockedOnItem) {
				cm.validationErrorMsg = null;
				cm.isMarkingComplete = false;
			}

			// Store the previous item
			if (cm.type == 'iltsession' && !cm.asdSession) prevCms.atd = cm;
			else if (cm.type == 'rating') prevCms.rtg = cm;
			else if (cm.type == 'milestone') prevCms.ms = cm;

			if (!firstInvalidCm && cm.validationErrorMsg) firstInvalidCm = cm;
		}
		var firstCmWithInvalidDates = ctx.dbAttendance.validateDates();
		return firstInvalidCm || firstCmWithInvalidDates;
	};

	function _validateCm(cm, prevCms, prevReps) {
		// Is one of earlier items already locked or incomplete?
		// First check earlier milestone
		if (prevCms.ms && prevCms.ms.lockedOnItem) {
			cm.lockedOnItem = prevCms.ms.lockedOnItem;
		} else if (prevCms.ms && !prevCms.ms.isMarkingComplete) {
			cm.lockedOnItem = prevCms.ms;

		// Then check earlier attendance
		} if (prevCms.atd && prevCms.atd.lockedOnItem) {
			cm.lockedOnItem = prevCms.atd.lockedOnItem;
		} else if (prevCms.atd && !prevCms.atd.isMarkingComplete) {
			cm.lockedOnItem = prevCms.atd;

		// Then check earlier rating if the current item is milestone
		} else if (cm.type == 'milestone' && prevCms.rtg && prevCms.rtg.lockedOnItem) {
			cm.lockedOnItem = prevCms.rtg.lockedOnItem;
		} else if (cm.type == 'milestone' && prevCms.rtg && !prevCms.rtg.isMarkingComplete) {
			cm.lockedOnItem = prevCms.rtg;

		// Current item is not locked. Now update its user report level details.
		} else {
			_validateLrsInCm(cm, prevReps);
		}
	}

	function _validateLrsInCm(cm, prevReps) {
		for(var i=0; i<cm.learningRecords.length; i++) {
			var lr = cm.learningRecords[i];
			if (lr.bulkEntry) continue;
			lr.lockedMessage = null;
			lr.cantProceedMessage = null;
			lr.validationErrorMsg = null;
			if (!prevReps[lr.id]) prevReps[lr.id] = {atd: null, rtg: null, ms: null, atdAsd: []};
			var prevOfLr = prevReps[lr.id];
			_updateLockedStateOfLr(lr, prevOfLr);
			if (!lr.lockedMessage) {
				if (cm.type == 'iltsession') ctx.dbAttendance.validateLr(lr, cm, prevOfLr);
				else if (cm.type == 'rating') ctx.dbRating.validateLr(lr, cm, prevOfLr);
				else if (cm.type == 'milestone') ctx.dbMilestone.validateLr(lr, cm, prevOfLr);
			}
			_updatePrevReps(lr, cm, prevOfLr);
		}
	}

	function _updateLockedStateOfLr(lr, prevOfLr) {
		// Is one of earlier items already locked or incomplete?
		// First check earlier milestone
		if (prevOfLr.ms && prevOfLr.ms.lockedMessage) {
			lr.lockedMessage = prevOfLr.ms.lockedMessage;
		} else if (prevOfLr.ms && prevOfLr.ms.cantProceedMessage) {
			lr.lockedMessage = prevOfLr.ms.cantProceedMessage;

		// Then check earlier attendance
		} else if (prevOfLr.atd && prevOfLr.atd.lockedMessage) {
			lr.lockedMessage = prevOfLr.atd.lockedMessage;
		} else if (prevOfLr.atd && prevOfLr.atd.cantProceedMessage) {
			lr.lockedMessage = prevOfLr.atd.cantProceedMessage;

		// Then check earlier rating if the current item is milestone
		// Currently: check if next 2 lines have to be commented to allow ms marking if rating is diabled
		} else if (lr.type == 'milestone' && prevOfLr.rtg && prevOfLr.rtg.lockedMessage) {
			lr.lockedMessage = prevOfLr.rtg.lockedMessage;
		} else if (lr.type == 'milestone' && prevOfLr.rtg && prevOfLr.rtg.cantProceedMessage) {
			lr.lockedMessage = prevOfLr.rtg.cantProceedMessage;
		}
	}

	function _updatePrevReps(lr, cm, prevOfLr) {
		// Store the previous item
		if (cm.type == 'iltsession' && !cm.asdSession) {
			prevOfLr.atd = lr;
			prevOfLr.atdAsd = [];
		} else if (cm.type == 'iltsession' && cm.asdSession) prevOfLr.atdAsd.push(lr);
		else if (cm.type == 'rating') prevOfLr.rtg = lr;
		else if (cm.type == 'milestone') prevOfLr.ms = lr;
	}
}

//-------------------------------------------------------------------------------------------------
function UpdateTrainingBatchDlg($scope, ctx) {
	var _myTreeListSrv = nlTreeListSrv.createNew();
	var _validator = new Validator(ctx);

	this.show = function() {
		var batchDlg = nlDlg.create($scope);
		batchDlg.setCssClass('nl-height-max nl-width-max nl-no-vscroll');
		_initScope(batchDlg.scope);
		var okButton = {text: nl.t('Update'), onTap: function(e) {
			_onUpdateButtonClick(e, batchDlg.scope);
		}};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
			_onCancel(e, batchDlg.scope);
		}};
		batchDlg.show('view_controllers/learning_reports/update_training_batch_dlg.html',
		[okButton], cancelButton);

	};

	function _initScope(dlgScope) {
		var dlgtypeOpts = [];
		if (Object.keys(ctx.trainerItemTypes).length > 1) dlgtypeOpts.push({id: 'all', name: 'All trainer items'});
		if (ctx.trainerItemTypes.iltsession) dlgtypeOpts.push({id: 'iltsession', name: 'Attendance items'});
		if (ctx.trainerItemTypes.rating) dlgtypeOpts.push({id: 'rating', name: 'Rating items'});
		if (ctx.trainerItemTypes.milestone) dlgtypeOpts.push({id: 'milestone', name: 'Milestone items'});
		dlgScope.options = {dlgtype: dlgtypeOpts, modulesSearch: '', 
			reason: ctx.dbAttendance.getEtmAsd()};
		dlgScope.data = {dlgtype: dlgScope.options.dlgtype[0]};
		dlgScope.isEtmAsd = ctx.dbAttendance.getEtmAsd().length > 0;
		dlgScope.firstSessionId = ctx.dbAttendance.getFirstSessionId();
		dlgScope.bulkMarker = {showAttendance: false, showRating: false};
		dlgScope.showConfirmationPage = false;
		_initScopeFunctions(dlgScope);
		_onDlgTypeChange(dlgScope);
		_validator.validate();
	}

	function _initScopeFunctions(dlgScope) {
		// Used in multiple html templates
		dlgScope.getItemName = function(cm) {
			return nlReportHelper.getItemName(cm);
		};

		// Used in update_training_batch_dlg.html
		dlgScope.onDlgTypeChange = function(e) {
			_onDlgTypeChange(dlgScope);
		};
		dlgScope.onLeftPaneItemClick = function(e, cm) {
			_onLeftPaneItemClick(dlgScope, cm);
		};

		// Used in update_attendance_tab.html
		dlgScope.addAsdSession = function(e, cm) {
			_addAsdSession(dlgScope, cm);
		};
		dlgScope.removeAsdSession = function(e, cm) {
			_removeAsdSession(dlgScope, cm);
			dlgScope.selectedModule = dlgScope.modules.length > 0 ? dlgScope.modules[0] : null;			
		};
		dlgScope.showBulkAttendanceMarker = function(e) {
			_showBulkMarker(dlgScope, 'showAttendance');
		};
		dlgScope.hideBulkAttendanceMarker = function(e) {
			_hideBulkMarker(dlgScope, 'showAttendance');
		};
		dlgScope.bulkAttendanceMarker = function(e) {
			_bulkMarker(dlgScope, 'showAttendance');
		};

		// Used in update_rating_tab.html
		dlgScope.showBulkRatingMarker = function(e) {
			_showBulkMarker(dlgScope, 'showRating');
		};
		dlgScope.hideBulkRatingMarker = function(e) {
			_hideBulkMarker(dlgScope, 'showRating');
		};
		dlgScope.bulkRatingMarker = function(e) {
			_bulkMarker(dlgScope, 'showRating');
		};
		dlgScope.onRatingRemarksClick = function(e, report, opt) {
			ctx.dbRating.updateRemarksOptionsAndStr(report, opt);
		};

		// Used in update_milestone_tab.html
		dlgScope.milestoneMarkAll = function(e, selectedModule) {
			ctx.dbMilestone.markAll(selectedModule, true);
		};
		dlgScope.milestoneUnmarkAll = function(e, selectedModule) {
			ctx.dbMilestone.markAll(selectedModule, false);
		};
	}

	function _onDlgTypeChange(dlgScope, newCm) {
		var dlgtype = dlgScope.data.dlgtype.id;
		_myTreeListSrv.clear();
		dlgScope.selectedModule = newCm || null;
		for(var i=0; i<ctx.modules.length; i++) {
			var cm = ctx.modules[i];
			cm.canShowInModuleList = (cm.type == dlgtype)
				|| (dlgtype == 'all' && (cm.type == 'module' || cm.type in ctx.trainerItemTypes));
			if (cm.canShowInModuleList && !_isModuleSearchPass(dlgScope, cm)) cm.canShowInModuleList = false;
			if (!cm.canShowInModuleList) continue;
			_myTreeListSrv.addItem(cm);
		}
		_showVisible(dlgScope);
		if (!dlgScope.selectedModule && dlgScope.modules.length > 0) dlgScope.selectedModule = dlgScope.modules[0];
	}

	function _isModuleSearchPass(dlgScope, cm) {
		if (!dlgScope.data.modulesSearch) return true;
		var search = dlgScope.data.modulesSearch.toLowerCase();
		return cm.name.toLowerCase().indexOf(search) >= 0;
	}

	function _onLeftPaneItemClick(dlgScope, cm) {
		if (!cm) return;
		_validateItems(dlgScope);
		dlgScope.selectedModule = cm;
		if(cm.type !== 'module') return;
		_myTreeListSrv.toggleItem(cm);
		_showVisible(dlgScope);
	}

	function _showVisible(dlgScope) {
		dlgScope.modules = [];
		for(var i=0; i<ctx.modules.length; i++) {
			var cm = ctx.modules[i];
			if (!cm.canShowInModuleList || !cm.visible) continue;
			if (cm.type == 'module' && _myTreeListSrv.getChildren(cm).length == 0) continue;
			dlgScope.modules.push(cm);
		}
	}

	function _addAsdSession(dlgScope, cm) {
		var newCm = ctx.dbAttendance.addAsdSession(cm);
		newCm.canShowInModuleList = true;
		_myTreeListSrv.addItem(newCm);
		dlgScope.firstSessionId = ctx.dbAttendance.getFirstSessionId();
		_showVisible(dlgScope);
	}

	function _removeAsdSession(dlgScope, cm) {
		ctx.dbAttendance.removeAsdSession(cm);
		dlgScope.firstSessionId = ctx.dbAttendance.getFirstSessionId();
		_showVisible(dlgScope);
	}

	function _showBulkMarker(dlgScope, markerType) {
		var cm = dlgScope.selectedModule;
		if (!cm) return;
		var bulkItem = cm.learningRecords[0];
		bulkItem.error = '';
		dlgScope.bulkMarker[markerType] = true;
	}

	function _hideBulkMarker(dlgScope, markerType) {
		dlgScope.bulkMarker[markerType] = false;
	}

	function _bulkMarker(dlgScope, markerType) {
		var cm = dlgScope.selectedModule;
		if (!cm) return;
		var bulkItem = cm.learningRecords[0];
		bulkItem.error = '';
		if (!bulkItem[markerType == 'showAttendance' ? 'attendance' : 'rating'].id) {
			bulkItem.error = 'Please select a value to mark all.';
			return;
		}
		for(var i=1; i<cm.learningRecords.length; i++) {
			var lr = cm.learningRecords[i];
			ctx[markerType == 'showAttendance' ? 'dbAttendance' : 'dbRating'].copyFrom(bulkItem, lr, cm);
		}
		dlgScope.bulkMarker[markerType] = false;
	}

	function _onCancel(e, dlgScope) {
		if (dlgScope.showConfirmationPage) {
			e.preventDefault();
			dlgScope.showConfirmationPage = false;
			return;
		}
	}

	function _onUpdateButtonClick(e, dlgScope) {
		if (dlgScope.showConfirmationPage) {
			_onUpdateButtonClickAfterConfirm(e, dlgScope)
			return;
		}
		e.preventDefault();
		var firstInvalidCm = _validateItems(dlgScope);
		if (firstInvalidCm) {
			dlgScope.data.dlgtype = dlgScope.options.dlgtype[0];
			_onDlgTypeChange(dlgScope, firstInvalidCm);
			return;			
		}
		dlgScope.changes = _findChanges();
		if (dlgScope.changes.length == 0) {
			nlDlg.popupAlert({title: 'No change', template: 'There are no changes to update.'});
			return;
		}
		dlgScope.showConfirmationPage = true;
	}

	function _validateItems(dlgScope) {
		var firstInvalidCm = _validator.validate();
		if (firstInvalidCm) {
			nlDlg.popupStatus2({msg: firstInvalidCm.validationErrorMsg, cls: 'red', popdownTime: 2000});
			return firstInvalidCm;
		}
		return null;
	}

	function _findChanges() {
		var changes = [];
		var oldModules = nl.utils.arrayToDictById(ctx.oldModules);
		for (var i=0; i<ctx.modules.length; i++) {
			var cm = ctx.modules[i];
			var oldCm = oldModules[cm.id];
			if (!oldCm) {
				changes.push({cm: cm, type: 'New session added'});
				continue;
			}

			var cmChanges = [];
			var lrChanges = [];
			if (cm.type == 'iltsession') ctx.dbAttendance.updateCmChanges(cm, oldCm, cmChanges);
			else if (cm.type == 'rating') ctx.dbRating.updateCmChanges(cm, oldCm, cmChanges);
			else if (cm.type == 'miestone') ctx.dbMilestone.updateCmChanges(cm, oldCm, cmChanges);

			var oldLrs = nl.utils.arrayToDictById(oldCm.learningRecords);
			for (var j=0; j<cm.learningRecords.length; j++) {
				var lr = cm.learningRecords[j];
				if (lr.bulkEntry) continue;
				var oldLr = oldLrs[lr.id];
				if (cm.type == 'iltsession') ctx.dbAttendance.updateLrChanges(lr, oldLr, lrChanges);
				else if (cm.type == 'rating') ctx.dbRating.updateLrChanges(lr, oldLr, lrChanges);
				else if (cm.type == 'miestone') ctx.dbMilestone.updateLrChanges(lr, oldLr, lrChanges);
			}
			
			if (cmChanges.length > 0 || lrChanges.length > 0) {
				var typeStr = 'Session modified';
				if (cm.type == 'rating') typeStr = 'Rating item modified';
				else if (cm.type == 'milestone') typeStr = 'Milestone item modified';
				var change = {cm: cm, type: typeStr};
				if (cmChanges.length > 0) change.cmChanges = cmChanges;
				if (lrChanges.length > 0) change.lrChanges = lrChanges;
				changes.push(change);
			}
			delete oldModules[cm.id];
		}
		for (var cmid in oldModules) {
			changes.push({cm: oldModules[cmid], type: 'Session deleted'});
		}
		return changes;

	}

	function _onUpdateButtonClickAfterConfirm(e, dlgScope) {
		// TODO-NOW: DB save to be done
	}

}

}];



//-------------------------------------------------------------------------------------------------
module_init();
})();
		

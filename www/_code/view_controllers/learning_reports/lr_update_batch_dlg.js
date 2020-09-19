(function() {

//-------------------------------------------------------------------------------------------------
// lr_update_batch_dlg.js: Attendance/Rating/Milestone marking dialog for the trainer.
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.lr_update_batch_dlg', [])
	.service('nlLrUpdateBatchDlg', NlLrUpdateBatchDlg);
}

var NlLrUpdateBatchDlg = ['nl', 'nlDlg', 'nlTreeListSrv', 'nlCourse', 'nlReportHelper', 'nlLrCourseAssignView',
function(nl, nlDlg, nlTreeListSrv, nlCourse, nlReportHelper, nlLrCourseAssignView) {

this.getCourseAssignView = function() {
	return nlLrCourseAssignView;
};

this.showUpdateTrainingBatchDlg = function($scope, courseAssignment, modules, learningRecords, groupInfo, launchType) {
	var ctx = _getContext(courseAssignment, modules, learningRecords, groupInfo);
	return nl.q(function(resolve, reject) {
		var dlg = new UpdateTrainingBatchDlg($scope, ctx, resolve);
		dlg.show(launchType);
	});
};

this.getTrainerItemInfos = function(courseAssignment, modules, learningRecords, groupInfo) {
	var ctx = _getContext(courseAssignment, modules, learningRecords, groupInfo);
	var ret = {};
	for(var i=0; i<ctx.modules.length; i++) {
		var cm = ctx.modules[i];
		ret[cm.id] = cm;
	}
	ret.allModules = nlReportHelper.getAsdUpdatedModules(modules || [], ctx.dbAttendance.getDbObj());
	return ret;
};

function _getContext(courseAssignment, modules, learningRecords, groupInfo) {
	if (!courseAssignment) courseAssignment = {};
	if (!modules) modules = [];
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
		_addLearningRecordsToCm(cm, addAfterCm);
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
		ctx.folders = {};
		for (var i=0; i<modules.length; i++) {
			var cm = modules[i];
			if (cm.type == 'module') ctx.folders[cm.id] = cm;
			if (cm.type != 'iltsession' && cm.type != 'rating' && cm.type != 'milestone') continue;
			if (cm.type == 'module') {
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
		var isEtmAsd = ctx.dbAttendance.getEtmAsd().length > 0;
		if (!isEtmAsd) return;
		var _ratingDict = ctx.dbRating.getRatingDict();
		var setOfRatings = [];
		ctx.trainerItemTypes['multipleRating'] = true;
		var parentId = null;
		for (var i=0; i< ctx.modules.length; i++) {
			var cm = ctx.modules[i];
			if (cm.type != 'rating') {
				_updateMultipleRating (setOfRatings, i, parentId);
				setOfRatings = [];
				continue;
			}
			if (!(cm.parentId in ctx.folders)) {
				_updateMultipleRating (setOfRatings, i, parentId);
				setOfRatings = [];
				continue;
			}
			var ratingConfig = _ratingDict[cm.rating_type];
			if (ratingConfig.type != 'number') {
				_updateMultipleRating (setOfRatings, i, parentId);
				setOfRatings = [];
				continue;
			}
			setOfRatings.push(ctx.modules[i]);
			parentId = cm.parentId;
		}
	}
	
	var uniqueId = 10000;
	function _updateMultipleRating (setOfRatings, i, parentId) {
		if (setOfRatings.length > 1) {
			for (var k=0; k<setOfRatings.length; k++) setOfRatings[k].hideRatingInGui = true; 
			var lr = setOfRatings[0].learningRecords;
			var userlist = [];
			for (var j=0; j<lr.length; j++) {
				if (lr[j].bulkEntry) continue;
				var dict = {learnername: lr[j].learnername, learnerid: lr[j].learnerid, pos: j, lockedMessage: lr[j].lockedMessage};
				userlist.push(dict);
			}
			var folder = ctx.folders[parentId];
			ctx.modules.splice (i, 0, {id: '_id'+uniqueId, parnetId: parentId, name: nl.t('{} : scores',folder.name), type: 'multipleRating', userlist: userlist, allRating: setOfRatings});
			uniqueId++;
		}
	}

	function _addLearningRecordsToCm(cm, addAfterCm) {
		cm.learningRecords = [];
		for (var j=0; j<ctx.lrArray.length; j++) {
			var lr = ctx.lrArray[j];
			var report = {id: lr.raw_record.id, learnername: lr.user.name, learnerid: lr.user.user_id, inactive: lr.user.state == 0 ? true : false};
			if (addAfterCm) {
				if ('locked_waiting' in addAfterCm) report.locked_waiting = addAfterCm.locked_waiting;
			} else {
				var itemInfo = lr.bulkEntry ? {} : lr.repcontent.statusinfo[cm.id] || {};
				if (cm.type == 'iltsession' && itemInfo.joinTime) report.joinTime = itemInfo.joinTime;
				if (itemInfo.status == 'waiting') report.locked_waiting = true;
			}
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

	this.getAttendanceOptions = function() {
		return _attendanceOptionsDict;
	};

	this.getEtmAsd = function() {
		return _etmAsd;
	};

	this.getDontShowOptions = function() {
		return _dontShowOptions;
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
		cm.attendanceOptions = cm.asdSession ? _attendanceOptionsAsd : _attendanceOptions;
		cm.attendanceRemarksOptions = _remOptions;
		for (var i=0; i<ctx.lrArray.length; i++) {
			var lr = ctx.lrArray[i];
			var itemLr = cm.learningRecords[i];
			if (lr.bulkEntry) {
				itemLr.attendance = _attendanceOptions.length > 0 ? _attendanceOptions[0] : {id: ''};
				itemLr.remarks = {id: ''};
				if (_etmAsd.length > 0) {
					itemLr.attMarkedOn = "";
					itemLr.shiftHrs = {id: ''};
					itemLr.shiftMins = {id: ''};
					itemLr.shiftEnd = "";	
				}
			} else {
				var itemInfo = lr.repcontent.statusinfo[cm.id] || {};
				var sessionInfo = _sessionInfos[cm.id] || {};
				var sessiondate = sessionInfo.sessiondate || '';
					sessiondate = nl.fmt.json2Date(sessiondate || '');
	
				itemLr.attendance = _attendanceOptionsDict[itemInfo.attId] || {id: itemInfo.attId || ''};
				itemLr.remarks = {id: itemInfo.remarks || ''};
				itemLr.otherRemarks = itemInfo.otherRemarks;
				itemLr.updated = itemInfo.updated || null;
				itemLr.marked = itemInfo.marked || null;
				if (_etmAsd.length > 0) {
					itemLr.attMarkedOn = nl.fmt.json2Date(itemInfo.attMarkedOn || sessiondate || '');
					if (cm.asdSession) {
						itemLr.shiftHrs = {id: itemInfo.shiftHrs || cm.shiftHrs || ''};
						itemLr.shiftMins = {id: itemInfo.shiftMins || cm.shiftMins || ''};
					} else {
						itemLr.shiftHrs = {id: itemInfo.shiftHrs || sessionInfo.shiftHrs || ''};
						itemLr.shiftMins = {id: itemInfo.shiftMins || sessionInfo.shiftMins || ''};	
					}
					if (itemLr.shiftHrs.id && itemLr.shiftMins.id) {
						var shiftEndHrs = parseInt(itemLr.shiftHrs.id) + 9;
						if (shiftEndHrs && shiftEndHrs > 23) {
							shiftEndHrs = shiftEndHrs % 24;
						}
						itemLr.shiftEnd = itemInfo.shiftEnd || nl.t('{}:{}', shiftEndHrs, itemLr.shiftMins.id ? itemLr.shiftMins.id : '');
					}
				}
			}
		}
	};

	this.addAsdSession = function(addAfterCm) {
		if (_etmAsd.length == 0) return;
		_lastAsdId++;
		var item = {id: '_asdsession' + _lastAsdId, reason: _etmAsd[0], remarks: ''};
		item = nlReportHelper.getAsdItem(item);
		item.parentId = addAfterCm ? addAfterCm.parentId : '_root';
		item.parentFixedSessionId = !addAfterCm ? '_root'
			: !addAfterCm.asdSession ? addAfterCm.id : addAfterCm.parentFixedSessionId;
		ctx.addModule(item, addAfterCm);
		this.updateItem(item);
		this.changeSessionReason(item, addAfterCm);
		return item;
	};

	this.removeAsdSession = function(cm) {
		if (_etmAsd.length == 0) return;
		ctx.deleteModule(cm);
	};

	this.changeSessionReason = function(cm, previousIlt) {
		if (_etmAsd.length == 0 || !cm.reason.id) return;
		var reasonInfo = null;
		for (var i=0; i<_etmAsd.length; i++) {
			if (_etmAsd[i].id != cm.reason.id) continue;
			reasonInfo =_etmAsd[i];
			break;
		}
		if (!reasonInfo || !reasonInfo.defaultAttendance) return;
		var newAtd = _attendanceOptionsDict[reasonInfo.defaultAttendance];
		if (!newAtd) return;
		var previousItemLrRecords = previousIlt ? previousIlt.learningRecords : [];
		for (var i=0; i<cm.learningRecords.length; i++) {
			var lr = cm.learningRecords[i];
			var oldLr = previousItemLrRecords[i];
			if (oldLr && oldLr.lockedMessage) {
				lr.lockedMessage = oldLr.lockedMessage;
				continue;
			}
			if (lr.inactive) {
				lr.lockedMessage = nl.fmt2('Learner is inactive');
				continue;
			}
			lr.attendance = newAtd;
		}
	};

	this.changeSessionShiftTime = function(lr) {
		if (!lr.shiftHrs || !lr.shiftHrs.id || !lr.shiftMins) return;
		var shiftEndHrs = parseInt(lr.shiftHrs.id) + 9;
		if (shiftEndHrs && shiftEndHrs > 23) {
			shiftEndHrs = shiftEndHrs % 24;
		}
		lr.shiftEnd = nl.t('{}:{}', shiftEndHrs, lr.shiftMins.id ? lr.shiftMins.id : "");
	};

	this.copyFrom = function(srcLr, destLr) {
		destLr.attendance = angular.copy(srcLr.attendance);
		if (_etmAsd.length > 0 && srcLr.attendance.id != 'notapplicable') {
			destLr.attMarkedOn = angular.copy(srcLr.attMarkedOn);
			destLr.shiftHrs = angular.copy(srcLr.shiftHrs);
			destLr.shiftMins = angular.copy(srcLr.shiftMins);
			destLr.shiftEnd = angular.copy(srcLr.shiftEnd);	
		}
		destLr.remarks = angular.copy(srcLr.remarks);
		destLr.otherRemarks = angular.copy(srcLr.otherRemarks);
	};

	this.validateCm = function(cm, cmValidationCtx) {
		cm.someAtdFilled = false;
		cm.dateValidationError = null;
		cm.dateValidationErrorIfSomeAtdFilled = null;
		cm.canShowAutoFillButton = _isOnlineSession(cm);
	}

	function _isOnlineSession(cm) {
		var modifiedILT = ctx.modifiedILT;
		var modifiedParams = modifiedILT[cm.id] || {};
		if (!modifiedParams.url) return false;
		if (!modifiedParams.start) return true;
		var iltduration = modifiedParams.duration || cm.iltduration;
		var starttime = angular.copy(modifiedParams.start);
			starttime = new Date(starttime);
		var actualMeetingEnd = new Date(starttime.getTime()+(iltduration*60000));
		var current = new Date();
		if (current > actualMeetingEnd) return true;
		return false;
	}

	this.validateLr = function(lr, cm, lrBlocker) {
		var attendanceConfig = _attendanceOptionsDict[lr.attendance.id] || {};
		if (!cm.asdSession) lrBlocker.lastSessionAttended = false;
		if (lr.inactive && !lr.attendance.id) {
			lr.lockedMessage = nl.fmt2('Learner is inactive');
			if (!lrBlocker.all) lrBlocker.all = lr;
			return;
		}
		if (!lr.lockedMessage && !lr.attendance.id) {
			lr.cantProceedMessage = nl.fmt2('{} is not marked', cm.name);
			if (!lrBlocker.all) lrBlocker.all = lr;
			cm.isMarkingComplete = false;
		}
		if (lr.attendance.id) cm.anyMarkingDone = true
		if (!lr.attendance.id) cm.isMarkingComplete = false;
		else cm.someAtdFilled = true;
		if (lr.attendance.id && lr.attendance.id == 'notapplicable') {
			return;
		}
		if (_etmAsd.length > 0 && lr.attendance.id) {
			if (!lr.attMarkedOn) {
				lr.validationErrorMsg = 'Session date mandatory';
				if (!lr.validationErrorMsg) lr.validationErrorMsg = nl.fmt2('{}: Session date mandatory for learner {}', nlReportHelper.getItemName(cm), lr.name);
				if (!cm.validationErrorMsg) cm.validationErrorMsg = lr.validationErrorMsg;
				return
			}
			var myDate = nl.fmt.date2Str(lr.attMarkedOn, 'date');
			var lastDate = lrBlocker.lastDate || null;
			var newDate = new Date();
			if (lr.attMarkedOn > newDate) {
				lr.validationErrorMsg = nl.fmt2('Date cannot be in future: {}', nlReportHelper.getItemName(cm));
				if (!cm.validationErrorMsg) cm.validationErrorMsg = lr.validationErrorMsg;
				return;
			}
			if (lastDate && myDate <= lastDate) {
				lr.validationErrorMsg = nl.fmt2('Date must be later than date specified in earlier sessions: {}', nlReportHelper.getItemName(cm));
				if (!cm.validationErrorMsg) cm.validationErrorMsg = lr.validationErrorMsg;
				return;
			}
			lrBlocker.lastDate =  nl.fmt.date2Str(lr.attMarkedOn, 'date');

			if (!lr.shiftHrs.id) {
				lr.validationErrorMsg = nl.fmt2('Shift time hrs is mandatory: {}', nlReportHelper.getItemName(cm));
				if (!cm.validationErrorMsg) cm.validationErrorMsg = lr.validationErrorMsg;
				return;
			}
			if (!lr.shiftMins.id) {
				lr.validationErrorMsg = nl.fmt2('Shift time minutes is mandatory: {}', nlReportHelper.getItemName(cm));
				if (!cm.validationErrorMsg) cm.validationErrorMsg = lr.validationErrorMsg;
				return;
			}
		}

		if (attendanceConfig.isAttrition || attendanceConfig.id == 'certified') {
			lr.cantProceedMessage = nl.fmt2('Marked {} at {}', attendanceConfig.name, nlReportHelper.getItemName(cm));
			if (!lrBlocker.all) lrBlocker.all = lr;
		}

		if (lr.attendance.id && !lr.remarks.id && !attendanceConfig.remarksOptional) {
			lr.validationErrorMsg = 'Remarks mandatory';
			if (!cm.validationErrorMsg) cm.validationErrorMsg = nl.fmt2('{}: Remarks mandatory', nlReportHelper.getItemName(cm));
		} else if (_isOtherRemarksOption(lr) && !lr.otherRemarks) {
			lr.validationErrorMsg = 'Additional remarks mandatory for selection "Other"';
			if (!cm.validationErrorMsg) cm.validationErrorMsg = nl.fmt2('{}: {}',
				nlReportHelper.getItemName(cm), lr.validationErrorMsg);
		}

		if (!lrBlocker.lastSessionAttended)
			lrBlocker.lastSessionAttended = (attendanceConfig.timePerc || 0) > 0;
	};

	function _isOtherRemarksOption(lr) {
		return _remOptions && lr.remarks.id == 'Other';
	}

	this.postValidateCm = function(cm, cmValidationCtx) {
		if (!cm.someAtdFilled) cm.dateValidationErrorIfSomeAtdFilled = null;
		if (!cm.dateValidationErrorIfSomeAtdFilled) return;
		cm.dateValidationError = cm.dateValidationErrorIfSomeAtdFilled;
		cm.validationErrorMsg = nl.fmt2('{}: {}', nlReportHelper.getItemName(cm), cm.dateValidationError);
	}
	
	this.updateCmChanges = function(cm, oldCm, cmChanges) {
		if (cm.lockedOnItem) return;
		cm.etmAsd = _etmAsd.length > 0;
		if (_etmAsd.length == 0) return null;
		if (!cm.asdSession) return;
		if (cm.reason.id != oldCm.reason.id) {
			cmChanges.push({attr: 'Session Reason', val: cm.reason.name});
		}
		if (cm.remarks != oldCm.remarks) {
			cmChanges.push({attr: 'Session Remarks', val: cm.remarks});
		}
	};

	this.updateLrChanges = function(lr, oldLr, lrChanges) {
		lr.updated = oldLr.updated;
		lr.marked = oldLr.marked;
		var oldDate = oldLr.attMarkedOn ? nl.fmt.date2Str(oldLr.attMarkedOn, 'date') : '';
		var newDate = lr.attMarkedOn ? nl.fmt.date2Str(lr.attMarkedOn, 'date') : '';
		if (!_isOtherRemarksOption(lr)) lr.otherRemarks = null;
		if (lr.attendance.id == oldLr.attendance.id && lr.remarks.id == oldLr.remarks.id &&
			(!_isOtherRemarksOption(lr) || lr.otherRemarks == oldLr.otherRemarks) && 
			(newDate == oldDate)) return;
		lr.updated = new Date();
		if (lr.attendance.id != oldLr.attendance.id) lr.marked = lr.updated;
		if (_etmAsd.length > 0 && (newDate || newDate != oldDate)) lr.attMarkedOnStr = newDate;
		lrChanges.push({lr: lr});
	};

	this.getObjToSave = function() {
		var objToSave = {attendance_version: nlCourse.getAttendanceVersion()};
		if (_etmAsd.length > 0) {
			objToSave.sessionInfos = {};
			objToSave.lastAsdId = _lastAsdId;
		}
		var sessionInfos = objToSave.sessionInfos;
		for (var i = 0; i < ctx.modulesToSave.length; i++) {
			var cm = ctx.modulesToSave[i];
			if (cm.type != 'iltsession') continue;
			if (_etmAsd.length > 0 && cm.asdSession) _updateSessionInfos(sessionInfos, cm);
			_updateLrs(objToSave, cm);
		}
		return objToSave;
	};

	function _updateSessionInfos(sessionInfos, cm) {
		var key = cm.asdSession ? cm.parentFixedSessionId : cm.id;
		if (!(key in sessionInfos)) sessionInfos[key] = {};
		var sessionInfo = sessionInfos[key];
		if (!('asd' in sessionInfo)) sessionInfo.asd = [];
		sessionInfo.asd.push({
			reason: cm.reason || {id: ''},
			remarks: cm.remarks || '',
			id: cm.id,
			sessionName: cm.name,
			name: nlReportHelper.getItemName(cm)
		});
	}

	function _updateLrs(objToSave, cm) {
		for (var i = 0; i < cm.learningRecords.length; i++) {
			var lr = cm.learningRecords[i];
			if (lr.bulkEntry) continue;
			if (!(lr.id in objToSave)) objToSave[lr.id] = [];
			var lrInDb = objToSave[lr.id];
			var dbItem = {id: cm.id, updated: lr.updated || null, marked: lr.marked || null,
				attId: lr.attendance.id, remarks: lr.remarks.id, otherRemarks: lr.otherRemarks || null}
			if (_etmAsd.length > 0) {
				dbItem.attMarkedOn = lr.attMarkedOn;
				dbItem.shiftHrs = lr.shiftHrs.id;
				dbItem.shiftMins = lr.shiftMins.id; 
				dbItem.shiftEnd = lr.shiftEnd;
			}
			lrInDb.push(dbItem);
		}
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
	var _dontShowOptions = {};
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
		var modifiedILT = (courseAssignment && courseAssignment.info) ? courseAssignment.info.modifiedILT : {};
		ctx.modifiedILT = nlCourse.migrateModifiedILT(modifiedILT);
		_sessionInfos = _dbobj.sessionInfos || {};
		_lastAsdId = _dbobj.lastAsdId || 0;
		_initAttendanceOptions();
		_remOptions =_getAttendanceRemarksOptions();
	}

	function _initAttendanceOptions() {
		ctx.firstPresentOption = null;
		ctx.firstAbsentOption = null;	
		var grpAttendance = ctx.groupInfo.props.attendance || [];
		for (var i=0; i<grpAttendance.length;i++) {
			var item = grpAttendance[i];
			_attendanceOptionsDict[item.id] = item;
			if (item.dontShow) {
				_dontShowOptions[item.id] = true;
				continue;
			}
			_attendanceOptionsAsd.push(item);
		}
		for (var i=0; i<_attendanceOptionsAsd.length; i++) {
			var item = _attendanceOptionsAsd[i];
			if (item.id === 'notapplicable') continue;
			if (!ctx.firstPresentOption && item.timePerc == 100) ctx.firstPresentOption = item;
			if (!ctx.firstAbsentOption && !item.isAttrition && item.timePerc == 0) ctx.firstAbsentOption = item;
			_attendanceOptions.push(item);
		}
	}

	function _getAttendanceRemarksOptions() {
		var opts = ctx.groupInfo.props.attendanceRemarks;
		if (!opts || opts.length == 0) return null;
		var ret = [];
		ret.push({id: '', name: ''});
		for(var i=0; i<opts.length; i++) {
			if (opts[i] == 'Other') ctx.otherOptionConfigured = true;
			ret.push({id: opts[i], name: opts[i]});
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
			r.ratingOptionsDict  = {};
			if (r.values && r.values.length > 0) {
				// 'status' && 'select'
				r.ratingOptions = [];
				for(var j=0; j<r.values.length; j++) {
					var opt = {id: r.values[j]['p'], name: r.values[j]['v']};
					r.ratingOptionsDict[opt.id] = opt;
					r.ratingOptions.push(opt);
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

	this.getRatingDict = function() {
		return _ratingDict;
	};

	this.updateItem = function(cm) {
		var isEtmAsd = ctx.dbAttendance.getEtmAsd().length > 0;
		if (!_ratingDict || !cm.rating_type || !_ratingDict[cm.rating_type]) {
			cm.deleteItem = true;
			return;
		}
		var ratingConfig = _ratingDict[cm.rating_type];
		cm.ratingType = ratingConfig.type == 'number' ? 'input' : 'select';
		if (isEtmAsd && ratingConfig.type == 'number') cm.hideRemarks = true;
		cm.ratingOptions = ratingConfig.ratingOptions;

		for (var i=0; i<ctx.lrArray.length; i++) {
			var lr = ctx.lrArray[i];
			var itemLr = cm.learningRecords[i];
			var itemInfo = lr.bulkEntry ? {} : lr.repcontent.statusinfo[cm.id] || {};
			itemLr.rating = ratingConfig.ratingOptionsDict[itemInfo.score] || {id: itemInfo.score};
			itemLr.remarks = Array.isArray(itemInfo.remarks || '') ? itemInfo.remarks : [itemInfo.remarks||''];
			itemLr.otherRemarks = itemInfo.otherRemarks;
			_initRemarksOptions(itemLr, ratingConfig);
			itemLr.updated = itemInfo.updated || null;
			itemLr.marked = itemInfo.marked || null;
		}
	};

	this.copyFrom = function(srcLr, destLr, cm) {
		destLr.rating = angular.copy(srcLr.rating);
		var ratingConfig = _ratingDict[cm.rating_type];
		_updateRemarks(srcLr, ratingConfig);
		destLr.remarks = angular.copy(srcLr.remarks);
		destLr.otherRemarks = angular.copy(srcLr.otherRemarks);
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

	this.validateLr = function(lr, cm, lrBlocker) {
		var ratingConfig = _ratingDict[cm.rating_type];
		if (lr.inactive) {
			if (!lr.rating.id && lr.rating.id !== 0) {
				lr.lockedMessage = nl.fmt2('Learner is inactive');
				if (!lrBlocker.ms) lrBlocker.ms = lr;
			}
			return;
		}

		if (ratingConfig.id != 'rag' && lrBlocker.lastSessionAttended === false) {
			// === to distinguesh null (where there was no earlie session) and false (absent)
			lr.lockedMessage = 'Not present in earlier session';
			lr.cantProceedMessage = nl.fmt2('{} not marked', nlReportHelper.getItemName(cm));
			if (!lrBlocker.ms) lrBlocker.ms = lr;
			return;
		}
		if (lr.rating.id) cm.anyMarkingDone = true;
		if (!lr.rating.id && lr.rating.id !== 0) {
			cm.isMarkingComplete = false;
			lr.cantProceedMessage = nl.fmt2('{} not marked', nlReportHelper.getItemName(cm));
			if (!lrBlocker.ms) lrBlocker.ms = lr;
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
		if (cm.lockedOnItem) return;
		return; // Nothing to check here
	};

	this.updateLrChanges = function(lr, oldLr, lrChanges) {
		lr.updated = oldLr.updated;
		lr.marked = oldLr.marked;
		if (!lr.showOtherRemarks) lr.otherRemarks = null;
		if (lr.rating.id == oldLr.rating.id && lr.remarksStr == oldLr.remarksStr &&
			(!lr.showOtherRemarks || lr.otherRemarks == oldLr.otherRemarks)) return;

		lr.updated = new Date();
		if (lr.rating.id != oldLr.rating.id) lr.marked = lr.updated;
		lrChanges.push({lr: lr});
	};

	this.getObjToSave = function() {
		var objToSave = {};
		for (var i = 0; i < ctx.modulesToSave.length; i++) {
			var cm = ctx.modulesToSave[i];
			if (cm.type != 'rating') continue;
			_updateLrs(objToSave, cm);
		}
		return objToSave;
	};

	function _updateLrs(objToSave, cm) {
		for (var i = 0; i < cm.learningRecords.length; i++) {
			var lr = cm.learningRecords[i];
			if (lr.bulkEntry) continue;
			if (!(lr.id in objToSave)) objToSave[lr.id] = [];
			var lrInDb = objToSave[lr.id];
			var remarks = lr.ratingRemarksOptions ? lr.remarks : lr.remarksStr;
			var dbItem = {id: cm.id, updated: lr.updated || null, marked: lr.marked || null,
				attId: lr.rating.id, remarks: remarks || null, otherRemarks: lr.otherRemarks || null};
			lrInDb.push(dbItem);
		}
	}
	
	// Private members
	var _dbobj = {};
	var _ratingDict = null;
	_init();
}

//-------------------------------------------------------------------------------------------------
function DbMilestoneObject(courseAssignment, ctx) {
	var lastMilestonesAchieved = {};
	function _init() {
		_dbobj = courseAssignment.milestone ? angular.fromJson(courseAssignment.milestone) : {};
	}

	this.initLastAchecivedDict = function() {
		lastMilestonesAchieved = {};
	};

	this.updateItem = function(cm) {
		var milestoneInfo = _dbobj[cm.id] || {};
		cm.comment = milestoneInfo.comment || '';
		var msInfoFromDb = _dbobj[cm.id] || {};
		cm.updated = nl.fmt.json2Date(msInfoFromDb.updated);
		cm.reached = nl.fmt.json2Date(msInfoFromDb.reached);
		for (var i=0; i<ctx.lrArray.length; i++) {
			var lr = ctx.lrArray[i];
			var itemLr = cm.learningRecords[i];
			var itemInfo = lr.bulkEntry ? {} : lr.repcontent.statusinfo[cm.id] || {};
			itemLr.remarks = itemInfo.remarks == cm.comment ? '' : itemInfo.remarks;
			itemLr.updated = itemInfo.updated || null;
			itemLr.reached = itemInfo.reached || null;
			itemLr.milestoneMarked = itemInfo.reached ? true : false;
		}
	};

	this.markAll = function(cm, checked, date) {
		for (var i=1; i<ctx.lrArray.length; i++) {
			var itemLr = cm.learningRecords[i];
			if (itemLr.lockedMessage || !itemLr.selectedLr) continue;
			itemLr.milestoneMarked = checked;
			if (checked && date) itemLr.reached = date;
		}
	};

	this.validateCm = function(cm, cmValidationCtx) {
		return;
		for (var i=0; i<ctx.lrArray.length; i++) {
			var itemLr = cm.learningRecords[i];
			if (itemLr.bulkEntry) continue;
			if (!itemLr.milestoneMarked && !itemLr.lockedMessage) {
				cm.isMarkingComplete = false;
				break;
			} else {
				cm.isMarkingComplete = true;				
			}
		}
	}

	this.validateLr = function(lr, cm, lrBlocker) {
		var isEtmAsd = ctx.dbAttendance.getEtmAsd().length > 0;
		if (lr.inactive && !lr.reached) {
			lr.lockedMessage = nl.fmt2('Learner is inactive');
			if (!lrBlocker.all) lrBlocker.all = lr;
			return;
		}
		if (lr.milestoneMarked) cm.anyMarkingDone = true;

		if (!lr.milestoneMarked && !lr.lockedMessage) {
			lr.cantProceedMessage = nl.fmt2('{} is not marked', cm.name);
			if (!lrBlocker.all) lrBlocker.all = lr;
			cm.isMarkingComplete = false;
		}
		if (!isEtmAsd && lr.milestoneMarked) return;
		if (!lr.milestoneMarked &&  !lr.reached) return;
		if (lr.milestoneMarked && !lr.reached) {
			lr.validationErrorMsg = nl.fmt2('Achieved on date mandatory for {}', lr.learnername);
			if (!cm.validationErrorMsg) cm.validationErrorMsg = lr.validationErrorMsg || null;
			return;
		}
		if (lr.reached && lr.reached > new Date()) {
			lr.validationErrorMsg = nl.fmt2('Date cannot be in future');
			if (!cm.validationErrorMsg) cm.validationErrorMsg = lr.validationErrorMsg || null;
			return;
		}
		if (lr.reached && lr.reached < lastMilestonesAchieved[lr.learnerid]) {
			lr.validationErrorMsg = nl.fmt2('Milestone achieved on date should be greater than earlier marked date for {}', lr.learnername);
			if (!cm.validationErrorMsg) cm.validationErrorMsg = lr.validationErrorMsg || null;
			return;
		}
		if (isEtmAsd && lr.reached) lastMilestonesAchieved[lr.learnerid] = lr.reached;
		if (lr.milestoneMarked) return;
		lr.cantProceedMessage = nl.fmt2('{} not reached', nlReportHelper.getItemName(cm));
		if (!lrBlocker.all) lrBlocker.all = lr;
	};

	this.updateCmChanges = function(cm, oldCm, cmChanges) {
		var isEtmAsd = ctx.dbAttendance.getEtmAsd().length > 0;
		if (cm.type == 'milestone') cm.etmAsd = isEtmAsd;
		cm.updated = oldCm.updated;
		cm.reached = oldCm.reached;
		if (cm.comment != oldCm.comment) {
			cmChanges.push({attr: 'Milestone Reamrks', val: cm.comment});
			cm.updated = new Date();
		}
	};

	this.updateLrChanges = function(lr, oldLr, lrChanges) {
		var isEtmAsd = ctx.dbAttendance.getEtmAsd().length > 0;
		lr.updated = oldLr.updated;
		if (!isEtmAsd) lr.reached = oldLr.reached;
		var newReached = lr.reached ? nl.fmt.date2Str(lr.reached, 'minutes') : '';
		var oldReached = oldLr.reached ? nl.fmt.date2Str(oldLr.reached, 'minutes') : '';
		lr.marked = lr.milestoneMarked ? 'done' : 'pending';
		if (lr.milestoneMarked == oldLr.milestoneMarked && lr.remarks == oldLr.remarks && newReached == oldReached) return;
		lr.updated = new Date();
		if (lr.milestoneMarked != oldLr.milestoneMarked) {
			if (!isEtmAsd) lr.reached = lr.milestoneMarked ? lr.updated : null;
			lr.marked = lr.milestoneMarked ? 'done' : 'pending';
		}
		if (isEtmAsd) {
			lr.reachedStr = lr.milestoneMarked ? nl.fmt.date2StrDDMMYY(lr.reached, null, 'date') : null;
			lr.reached = lr.milestoneMarked ? lr.reached : null;
		}
		lrChanges.push({lr: lr});
	};

	this.getObjToSave = function() {
		var objToSave = {};
		for (var i = 0; i < ctx.modulesToSave.length; i++) {
			var cm = ctx.modulesToSave[i];
			if (cm.type != 'milestone') continue;
			var msInfo =  {
				comment: cm.comment,
				updated: cm.updated || null,
				reached: cm.reached || null,
				learnersDict: {}
			};
			objToSave[cm.id] = msInfo;
			_updateLrs(msInfo.learnersDict, cm);
		}
		return objToSave;
	};

	function _updateLrs(learnersDict, cm) {
		for (var i = 0; i < cm.learningRecords.length; i++) {
			var lr = cm.learningRecords[i];
			if (lr.bulkEntry) continue;
			var dbItem = {updated: lr.updated || null, marked: lr.marked || 'pending',
				remarks: lr.remarks || '', reached: lr.reached || null};
			learnersDict[lr.id] = dbItem;
		}
	}

	// Private members
	var _dbobj = {};
	_init();
}

//-------------------------------------------------------------------------------------------------
function Validator(ctx) {

	// Error related attributes:
	// cm.lockedOnItem: edit form is not shown for the cm till lockedOnItem is updated fully
	// cm.isMarkingComplete: true/false.
	// cm.validationErrorMsg: First validation error in the edit form of this cm
	// 
	// cm.lockFurtherItems: true/false computed based on isMarkingComplete (all below trainer items will be locked)
	// cm.lockFurtherMsItems: true/false computed based on isMarkingComplete (all below trainer items will be locked)
	//
	// cm.lr[i].lockedMessage: user report is locked due to this reason
	// cm.lr[i].cantProceedMessage: current item is not locked but next onwards has to be locked
	// cm.lr[i].validationErrorMsg: Validation error in this item
	this.validate = function() {
		// cm which results' in locking of further items
		var blockers = {all: null, // cm which blocks all types of items (these can be iltsession or milestone)
			ms: null, // cm which blocks only milestone items (thse can only be rating elements)
		}; 
		var cmValidationCtx = {};
			ctx.dbMilestone.initLastAchecivedDict();
		var lrBlockers = {}; // {uid1: {all: lr, ms: lr, lastSessionAttended: null/true/false, atdMarkedDates: {date, true}, lastDate: null}, uid2: {...}, ...};
		var firstInvalidCm = null;
		for(var i=0; i<ctx.modules.length; i++) {
			var cm = ctx.modules[i];
				cm.anyMarkingDone = false;
			if (!cm || cm.type == 'module') continue;
			if (cm.type == 'multipleRating') {
				var allMarked = true;
				cm.lockedOnItem = null;
				for (var k=0; k<cm.allRating.length; k++) {
					var child = cm.allRating[k];
					if (child.lockedOnItem) cm.lockedOnItem = child.lockedOnItem
					if (!child.isMarkingComplete) {
						allMarked = false;
					}
				}
				if (allMarked) cm.isMarkingComplete = true;
				else cm.isMarkingComplete = false;
				continue;
			}
			cm.pos = i;

			var msEarliest = (blockers.all && blockers.ms) ? (blockers.all.pos > blockers.ms.pos ? blockers.all : blockers.ms)
				: blockers.all ? blockers.all : blockers.ms;
			cm.lockedOnItem = cm.type == 'milestone' ? msEarliest : blockers.all; 
			cm.validationErrorMsg = null;
			if (!cm.lockedOnItem) {
				cm.isMarkingComplete = true;
				_validateCm(cm, cmValidationCtx);
				_validateLrsInCm(cm, lrBlockers);
				_postValidateCm(cm, cmValidationCtx);
			} else {
				cm.isMarkingComplete = false;
			}

			if (!firstInvalidCm && cm.validationErrorMsg) firstInvalidCm = cm;
			if (cm.isMarkingComplete || cm.anyMarkingDone) continue;
			if (!blockers.all && (cm.type == 'milestone' ||
				cm.type == 'iltsession' && !cm.asdSession)) blockers.all = cm;
			if (!blockers.ms && cm.type == 'rating') blockers.ms = cm;
		}
		return firstInvalidCm;
	};

	function _validateCm(cm, cmValidationCtx) {
		if (cm.type == 'iltsession') ctx.dbAttendance.validateCm(cm, cmValidationCtx);
		else if (cm.type == 'milestone') ctx.dbMilestone.validateCm(cm, cmValidationCtx);
	}

	function _validateLrsInCm(cm, lrBlockers) {
		cm.allLrsLocked = true;
		for(var i=0; i<cm.learningRecords.length; i++) {
			var lr = cm.learningRecords[i];
			if (lr.bulkEntry) continue;
			lr.lockedMessage = null;
			lr.cantProceedMessage = null;
			lr.validationErrorMsg = null;

			if (!lrBlockers[lr.id]) lrBlockers[lr.id] = {all: null, ms: null,
				lastSessionAttended: null, atdMarkedDates: {}, lastDate: null};
			var lrBlocker = lrBlockers[lr.id];
			if (lrBlocker.all) {
				lr.lockedMessage = lrBlocker.all.cantProceedMessage;
			} else if (cm.type == 'milestone' && lrBlocker.ms) {
				lr.lockedMessage = lrBlocker.ms.cantProceedMessage;
				if (!lrBlocker.all) lrBlocker.all = lrBlocker.ms;
			}
			if (!lr.lockedMessage && lr.locked_waiting) {
				lr.lockedMessage = 'Not applicable';
				cm.anyMarkingDone = true;
			}
			if (lr.lockedMessage) continue;
			cm.allLrsLocked = false;

			if (cm.type == 'iltsession') ctx.dbAttendance.validateLr(lr, cm, lrBlocker);
			else if (cm.type == 'rating') ctx.dbRating.validateLr(lr, cm, lrBlocker);
			else if (cm.type == 'milestone') ctx.dbMilestone.validateLr(lr, cm, lrBlocker);
		}
	}

	function _postValidateCm(cm, cmValidationCtx) {
		if (cm.type == 'iltsession') ctx.dbAttendance.postValidateCm(cm, cmValidationCtx);
	}
}

//-------------------------------------------------------------------------------------------------
function UpdateTrainingBatchDlg($scope, ctx, resolve) {
	var _myTreeListSrv = nlTreeListSrv.createNew();
	var _validator = new Validator(ctx);

	this.show = function(launchType) {
		var batchDlg = nlDlg.create($scope);
		batchDlg.setCssClass('nl-height-max nl-width-max nl-no-vscroll');
		_initScope(batchDlg.scope, launchType);
		var okButton = {text: nl.t('Update'), onTap: function(e) {
			_onUpdateButtonClick(e, batchDlg.scope);
		}};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
			_onCancel(e, batchDlg.scope);
		}};
		batchDlg.show('view_controllers/learning_reports/lr_update_batch_dlg.html',
		[okButton], cancelButton);

	};

	function _initScope(dlgScope, launchType) {
		var dlgtypeOptsDict = {
			'iltsession': 'Attendance items',
			'rating': 'Rating items',
			'milestone': 'Milestone items'
		};
		var dlgtypeOpts = [];
		var dlgtypeDefault = null;

		if (Object.keys(ctx.trainerItemTypes).length > 1) dlgtypeOpts.push({id: 'all', name: 'All trainer items'});
		var supportedCmType = ['iltsession', 'rating', 'milestone'];
		for(var i=0; i<supportedCmType.length; i++) {
			var cmtype = supportedCmType[i];
			if (!ctx.trainerItemTypes[cmtype]) continue;
			var item = {id: cmtype, name: dlgtypeOptsDict[cmtype]};
			dlgtypeOpts.push(item);
			if (launchType == cmtype) dlgtypeDefault = item;
		}
		dlgScope.options = {dlgtype: dlgtypeOpts, modulesSearch: '', 
			reason: ctx.dbAttendance.getEtmAsd()};
		dlgScope.data = {dlgtype: dlgtypeDefault || dlgScope.options.dlgtype[0]};
		dlgScope.isEtmAsd = ctx.dbAttendance.getEtmAsd().length > 0;
		dlgScope.dontShowOptions = ctx.dbAttendance.getDontShowOptions();
		if (dlgScope.isEtmAsd) {
			dlgScope.options.shiftHrs = getShiftHrsOptions();
			dlgScope.options.shiftMins = [{id: '00'}, {id: '15'}, {id: '30'}, {id: '45'}];
		}
		dlgScope.firstSessionId = ctx.dbAttendance.getFirstSessionId();
		dlgScope.bulkMarker = {showAttendance: false, showRating: false};
		dlgScope.showConfirmationPage = false;
		_initScopeFunctions(dlgScope);
		_onDlgTypeChange(dlgScope);
		_validator.validate();
	}

	function getShiftHrsOptions() {
		return [{id: '00'}, {id: '01'}, {id: '02'}, {id: '03'}, {id: '04'}, {id: '05'}, {id: '06'}, {id: '07'}, {id: '08'}, {id: '09'}, {id: '10'}, {id: '11'},
				{id: '12'}, {id: '13'}, {id: '14'}, {id: '15'}, {id: '16'}, {id: '17'}, {id: '18'}, {id: '19'}, {id: '20'}, {id: '21'}, {id: '22'}, {id: '23'}];
	}

	function _initScopeFunctions(dlgScope) {
		// Used in multiple html templates
		dlgScope.getItemName = function(cm) {
			return nlReportHelper.getItemName(cm);
		};

		// Used in lr_update_batch_dlg.html
		dlgScope.onDlgTypeChange = function(e) {
			_onDlgTypeChange(dlgScope);
		};
		dlgScope.onLeftPaneItemClick = function(e, cm) {
			_onLeftPaneItemClick(dlgScope, cm);
		};

		// Used in lr_update_batch_attendance.html
		dlgScope.addAsdSession = function(e, addAfterCm) {
			_addAsdSession(dlgScope, addAfterCm);
		};
		dlgScope.removeAsdSession = function(e, cm) {
			_removeAsdSession(dlgScope, cm);
			dlgScope.selectedModule = dlgScope.modules.length > 0 ? dlgScope.modules[0] : null;			
		};
		dlgScope.changeSessionReason = function(e, cm) {
			ctx.dbAttendance.changeSessionReason(cm);
		};
		dlgScope.changeSessionShiftTime = function(e, lr) {
			ctx.dbAttendance.changeSessionShiftTime(lr);
		};

		dlgScope.attendanceMarkAll = function(e, selectedModule) {
			var attBulkMarkDlg = nlDlg.create($scope);
			attBulkMarkDlg.setCssClass('nl-height-max nl-width-max')
			attBulkMarkDlg.scope.dlgTitle = 'Bulk update attendance';
			var bulkItem = selectedModule.learningRecords[0];
			attBulkMarkDlg.scope.data = {attMarkedOn: bulkItem.attMarkedOn || '', attendance: bulkItem.attendance || {id: ''}, shiftHrs: bulkItem.shiftHrs || {id: ''}, 
										 shiftMins: bulkItem.shiftMins || {id: ''}, shiftEnd: bulkItem.shiftEnd || '', remarks: bulkItem.remarks || {id: ''}, 
										 otherRemarks: bulkItem.otherRemarks || ''};
			if (dlgScope.isEtmAsd) {
				attBulkMarkDlg.scope.data.attMarkedOn = bulkItem.attMarkedOn || ''; 
				attBulkMarkDlg.scope.data.shiftHrs = bulkItem.shiftHrs || {id: ''};
				attBulkMarkDlg.scope.data.shiftMins = bulkItem.shiftMins || {id: ''};
				attBulkMarkDlg.scope.data.shiftEnd = bulkItem.shiftEnd || '';
			}

			attBulkMarkDlg.scope.options = {shiftHrs: angular.copy(dlgScope.options.shiftHrs),
											shiftMins: angular.copy(dlgScope.options.shiftMins),
											attendanceOptions: angular.copy(selectedModule.attendanceOptions),
											attendanceRemarksOptions: angular.copy(selectedModule.attendanceRemarksOptions)};

			attBulkMarkDlg.scope.data.selectedModule = selectedModule;
			attBulkMarkDlg.scope.isEtmAsd = dlgScope.isEtmAsd;

			attBulkMarkDlg.scope.onChangeTime = function (data) {
				if (!data.shiftHrs || !data.shiftHrs.id || !data.shiftMins) return;
				var shiftEndHrs = parseInt(data.shiftHrs.id) + 9;
				if (shiftEndHrs && shiftEndHrs > 23) {
					shiftEndHrs = shiftEndHrs % 24;
				}
				data.shiftEnd = nl.t('{}:{}', shiftEndHrs, data.shiftMins.id ? data.shiftMins.id : "");		
			};
			
			attBulkMarkDlg.scope.selectOn = function(e, selectedModule, type) {
				var lrRecords = selectedModule.learningRecords;
				for(var i=0; i<lrRecords.length; i++) {
					var lr = lrRecords[i];
					if (lr.lockedMessage) continue;
					if (type == 'selectall') 
						lr.selectedLr = true;
					else if (type == 'pending' && !lr.attendance.id) 
						lr.selectedLr = true;
					else 
						lr.selectedLr = false;
				}
		
			}
			attBulkMarkDlg.scope.getFormattedDate = function(date) {
				if (!date) return "";
				return nl.fmt.date2StrDDMMYY(nl.fmt.json2Date(date) || '', null, 'date');
			}

			var okButton = {text: nl.t('Update'), onTap: function(e) {
				attBulkMarkDlg.scope.data.errorMsg = null;
				if (!_validateInputsAttd(e, attBulkMarkDlg)) return;
				var srcData = attBulkMarkDlg.scope.data;
				var sourceLr = {attMarkedOn: srcData.attMarkedOn, attendance: srcData.attendance, 
								shiftHrs: srcData.shiftHrs, shiftMins: srcData.shiftMins,
								shiftEnd: srcData.shiftEnd, remarks: srcData.remarks, otherRemarks: srcData.otherRemarks}
				_copyFrom(selectedModule.learningRecords[0], sourceLr);
				_bulkMarkAttendance(selectedModule);	
			}};
			var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
			}};
			attBulkMarkDlg.show('view_controllers/learning_reports/lr_bulk_marker_dlg.html',
				[okButton], cancelButton);
		}
		function _copyFrom(src, dst) {
			for (var key in dst) src[key] = dst[key];
		}

		function _validateInputsAttd(e, attBulkMarkDlg) {
			var data = attBulkMarkDlg.scope.data;
			if (!data.attMarkedOn) {
				e.preventDefault();
				attBulkMarkDlg.scope.data.errorMsg = 'Please select the date';
				return false;
			}
			if (data.attMarkedOn && data.attMarkedOn > new Date()) {
				e.preventDefault();
				attBulkMarkDlg.scope.data.errorMsg = 'Selected date cannot be in future';
				return false;
			}
			if (!data.shiftHrs.id) {
				e.preventDefault();
				attBulkMarkDlg.scope.data.errorMsg = 'Shift Hrs is mandatory';
				return false;
			}
			if (!data.shiftMins.id) {
				e.preventDefault();
				attBulkMarkDlg.scope.data.errorMsg = 'Shift Mins is mandatory';
				return false;
			}
			var attendanceOption = ctx.dbAttendance.getAttendanceOptions();
			var attendanceConfig = attendanceOption[data.attendance.id] || {};

			if (!data.attendance.id) {
				e.preventDefault();
				attBulkMarkDlg.scope.data.errorMsg = 'Please select attendance status to update';
				return false;
			}

			if (data.attendance.id && !data.remarks.id && !attendanceConfig.remarksOptional) {
				e.preventDefault();
				attBulkMarkDlg.scope.data.errorMsg = 'Remarks mandatory';
				return false;
			}
			var lrRecords = data.selectedModule.learningRecords;
			var selectedLr = false;
			attBulkMarkDlg.scope.data.errorMsg = null;
			for(var i=0; i<lrRecords.length; i++) {
				if (lrRecords[i].selectedLr) {
					selectedLr = true;
					break;
				}
			}
			if (!selectedLr) {
				e.preventDefault();
				attBulkMarkDlg.scope.data.errorMsg = 'Please select the learners to update the attendance for';
				return false;
			}
			return true;
		}
		//TODO-NOW:Naveen remove this code later
		// dlgScope.showBulkAttendanceMarker = function(e) {
		// 	_showBulkMarker(dlgScope, 'showAttendance');
		// };
		// dlgScope.hideBulkAttendanceMarker = function(e) {
		// 	_hideBulkMarker(dlgScope, 'showAttendance');
		// };
		// dlgScope.bulkAttendanceMarker = function(e) {
		// 	_bulkMarker(dlgScope, 'showAttendance');
		// };
		// dlgScope.canShowMarkSelected = function(selectedModule) {
		// 	for(var i=0; i<selectedModule.learningRecords.length; i++) {
		// 		if(selectedModule.learningRecords[i].selectedLr) return true;
		// 	}
		// 	return false;
		// };
		// dlgScope.markSelectedAttendance = function(e) {
		// 	_bulkMarker(dlgScope, 'showAttendance', true);
		// };

		// Auto fill attendance based on the joinTime for online sessions
		dlgScope.onAutoFillAttendance = function(cm) {
			_autoFillAttendance(dlgScope);
		}

		// Used in lr_update_batch_rating.html
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

		dlgScope.bulkMarkMultipleRating = function(selectedModule) {
			var cm = selectedModule;
			var bulkDlg = nlDlg.create($scope);
			bulkDlg.scope.dlgTitle = 'Provide rating';
			bulkDlg.scope.data = {inputval: '', inputField: true};			
			var okButton = {text: nl.t('Mark all'), onTap: function(e) {
				bulkDlg.scope.data.errorMsg = null;
				if (!bulkDlg.scope.data.inputval) {
					e.preventDefault();
					bulkDlg.scope.data.errorMsg = 'Please provide rating and try mark all';
					return;
				}
				var ratingDict = {id: bulkDlg.scope.data.inputval};
				for(var i=0; i<cm.learningRecords.length; i++) {
					var lr = cm.learningRecords[i];
					if (lr.bulkEntry || lr.lockedMessage) continue;
					lr.rating = angular.copy(ratingDict);
				}	
			}};
			var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
			}};
			bulkDlg.show('view_controllers/learning_reports/lr_bulk_marker_dlg.html',
				[okButton], cancelButton);	
		};
		// Used in lr_update_batch_milestone.html
		dlgScope.milestoneMarkAll = function(e, selectedModule) {
			if (dlgScope.isEtmAsd) {
				var msBulkMarkDlg = nlDlg.create($scope);
				msBulkMarkDlg.setCssClass('nl-height-max nl-width-max')
				msBulkMarkDlg.scope.dlgTitle = 'Bulk update milestone';
				msBulkMarkDlg.scope.data = {reached: null, milestone: true};
				msBulkMarkDlg.scope.data.selectedModule = selectedModule;
				msBulkMarkDlg.scope.selectOn = function(e, selectedModule, type) {
					var lrRecords = selectedModule.learningRecords;
					for(var i=0; i<lrRecords.length; i++) {
						var lr = lrRecords[i];
						if (lr.lockedMessage) continue;
						if (type == 'selectall') 
							lr.selectedLr = true;
						else if (type == 'pending' && !lr.milestoneMarked) 
							lr.selectedLr = true;
						else 
							lr.selectedLr = false;
					}
			
				}
				msBulkMarkDlg.scope.getFormattedDate = function(date) {
					if (!date) return "";
					return nl.fmt.date2StrDDMMYY(nl.fmt.json2Date(date) || '', null, 'date');
				}
				var okButton = {text: nl.t('Update'), onTap: function(e) {
					msBulkMarkDlg.scope.data.errorMsg = null;
					if (!_validateInputs(e, msBulkMarkDlg)) return;
					ctx.dbMilestone.markAll(selectedModule, true, msBulkMarkDlg.scope.data.reached);
				}};
				var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
				}};
				msBulkMarkDlg.show('view_controllers/learning_reports/lr_bulk_marker_dlg.html',
					[okButton], cancelButton);	
			} else {
				ctx.dbMilestone.markAll(selectedModule, true);
			}
		};
		dlgScope.milestoneUnmarkAll = function(e, selectedModule) {
			ctx.dbMilestone.markAll(selectedModule, false);
		};
	}

	function _validateInputs(e, msBulkMarkDlg) {
		if (!msBulkMarkDlg.scope.data.reached) {
			e.preventDefault();
			msBulkMarkDlg.scope.data.errorMsg = 'Please select the milestone date';
			return false;
		}
		if (msBulkMarkDlg.scope.data.reached && msBulkMarkDlg.scope.data.reached > new Date()) {
			e.preventDefault();
			msBulkMarkDlg.scope.data.errorMsg = 'Selected date cannot be in future';
			return false;
		}
		var lrRecords = msBulkMarkDlg.scope.data.selectedModule.learningRecords;
		var selectedLr = false;
		msBulkMarkDlg.scope.data.errorMsg = null;
		for(var i=0; i<lrRecords.length; i++) {
			if (lrRecords[i].selectedLr) {
				selectedLr = true;
				break;
			}
		}
		if (!selectedLr) {
			e.preventDefault();
			msBulkMarkDlg.scope.data.errorMsg = 'Please select the learners to update the milestone for';
			return false;
		}
		return true;
	}

	function _autoFillAttendance(dlgScope) {
		var cm = dlgScope.selectedModule;
		if (!cm) return;
		for(var i=0; i<cm.learningRecords.length; i++) {
			var lr = cm.learningRecords[i];
			if (lr.bulkEntry || lr.lockedMessage) continue;
			if (lr.joinTime) {
				var jointime = nl.fmt.fmtDateDelta(lr.joinTime, null, 'minute')
				lr.attendance = ctx.firstPresentOption;
				if (ctx.otherOptionConfigured) {
					lr.remarks = {id: 'Other', name: nl.t('Other')};
					lr.otherRemarks = nl.t('Joined online meeting at {}', jointime);	
				} else {
					lr.remarks = {id: nl.t('Joined online meeting at {}', jointime)};
				}
			} else {
				lr.attendance = ctx.firstAbsentOption;
				if (ctx.otherOptionConfigured) {
					lr.remarks = {id: 'Other', name: nl.t('Other')};
					lr.otherRemarks = nl.t('Did not join the meeting');	
				} else {
					lr.remarks = {id: 'Did not join the meeting'};
				}
			}
		}
	}

	function _onDlgTypeChange(dlgScope, newCm) {
		var dlgtype = dlgScope.data.dlgtype.id;
		_myTreeListSrv.clear();
		dlgScope.selectedModule = newCm || null;
		for(var i=0; i<ctx.modules.length; i++) {
			var cm = ctx.modules[i];
			cm.canShowInModuleList = (cm.type == dlgtype || (dlgtype == 'rating' && cm.type == 'multipleRating'))
				|| (dlgtype == 'all' && (cm.type == 'module' || cm.type in ctx.trainerItemTypes));
			if (cm.canShowInModuleList && !_isModuleSearchPass(dlgScope, cm)) cm.canShowInModuleList = false;
			if (!cm.canShowInModuleList) continue;
			if (cm.hideRatingInGui) continue;
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
		var selectedId = dlgScope.selectedModule ? dlgScope.selectedModule.id : null;
		for(var i=0; i<ctx.modules.length; i++) {
			var cm = ctx.modules[i];
			if (cm.id === selectedId) _makeVisible(cm);
			if (!cm.canShowInModuleList || !cm.visible) continue;
			if (cm.type == 'module' && _myTreeListSrv.getChildren(cm).length == 0) continue;
			dlgScope.modules.push(cm);
		}
	}

	function _makeVisible(cm, isOpen) {
		cm.visible = true;
		if (isOpen) cm.isOpen = true;
		var parent = _myTreeListSrv.getParent(cm);
		if (!parent) return;
		_makeVisible(parent, true);
	}

	function _addAsdSession(dlgScope, addAfterCm) {
		var newCm = ctx.dbAttendance.addAsdSession(addAfterCm);
		newCm.canShowInModuleList = true;
		_myTreeListSrv.addItem(newCm);
		newCm.visible = true;
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

	function _bulkMarkAttendance(selectedModule) {
		var cm = selectedModule;
		var sourceLr = selectedModule.learningRecords[0];
		for(var i=0; i<cm.learningRecords.length; i++) {
			var lr = cm.learningRecords[i];
			if (lr.bulkEntry || lr.lockedMessage || !lr.selectedLr) continue;
			ctx['dbAttendance'].copyFrom(sourceLr, lr);
		}
	}

	function _bulkMarker(dlgScope, markerType, markSelected) {
		var cm = dlgScope.selectedModule;
		if (!cm) return;
		var bulkItem = cm.learningRecords[0];
		bulkItem.error = '';
		var selected = bulkItem[markerType == 'showAttendance' ? 'attendance' : 'rating'].id;
		if (!selected && selected !== 0) {
			bulkItem.error = 'Please select a value to mark all.';
			return;
		}
		for(var i=0; i<cm.learningRecords.length; i++) {
			var lr = cm.learningRecords[i];
			if (lr.bulkEntry || lr.lockedMessage) continue;
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
		resolve(null);
	}

	function _onUpdateButtonClick(e, dlgScope) {
		if (dlgScope.showConfirmationPage) {
			_onUpdateButtonClickAfterConfirm(e, dlgScope);
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
		ctx.modulesToSave = [];
		var oldModules = nl.utils.arrayToDictById(ctx.oldModules);
		for (var i=0; i<ctx.modules.length; i++) {
			var cm = ctx.modules[i];
			if (cm.type == 'multipleRating') {
				delete oldModules[cm.id];
				continue;
			}
			var oldCm = oldModules[cm.id];
			if (!oldCm) {
				changes.push({cm: cm, type: 'New session added'});
				ctx.modulesToSave.push(cm);
				continue;
			}

			var cmChanges = [];
			var lrChanges = [];
			if (cm.type == 'iltsession') ctx.dbAttendance.updateCmChanges(cm, oldCm, cmChanges);
			else if (cm.type == 'rating') ctx.dbRating.updateCmChanges(cm, oldCm, cmChanges);
			else if (cm.type == 'milestone') ctx.dbMilestone.updateCmChanges(cm, oldCm, cmChanges);

			if (!cm.lockedOnItem && !cm.allLrsLocked) {
				var oldLrs = nl.utils.arrayToDictById(oldCm.learningRecords);
				for (var j=0; j<cm.learningRecords.length; j++) {
					var lr = cm.learningRecords[j];
					if (lr.bulkEntry || lr.lockedMessage) continue;
					var oldLr = oldLrs[lr.id];
					if (cm.type == 'iltsession') ctx.dbAttendance.updateLrChanges(lr, oldLr, lrChanges);
					else if (cm.type == 'rating') ctx.dbRating.updateLrChanges(lr, oldLr, lrChanges);
					else if (cm.type == 'milestone') ctx.dbMilestone.updateLrChanges(lr, oldLr, lrChanges);
				}
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
			cm.lockedOnItem ? ctx.modulesToSave.push(oldCm) : ctx.modulesToSave.push(cm);
			delete oldModules[cm.id];
		}
		for (var cmid in oldModules) changes.push({cm: oldModules[cmid], type: 'Session deleted'});
		return changes;
	}

	function _onUpdateButtonClickAfterConfirm(e, dlgScope) {
		var ret = {
			attendance: ctx.dbAttendance.getObjToSave(),
			rating: ctx.dbRating.getObjToSave(),
			milestone: ctx.dbMilestone.getObjToSave()
		};
		resolve(ret);
	}

}

}];



//-------------------------------------------------------------------------------------------------
module_init();
})();
		

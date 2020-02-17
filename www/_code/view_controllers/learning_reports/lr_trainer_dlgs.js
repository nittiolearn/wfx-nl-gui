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

	ctx.modules = angular.copy(nlReportHelper.getAsdUpdatedModules(modules || [], ctx.attendance));
	_updateCtxModules(ctx);

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

	return ctx;
}

function _updateCtxModules(ctx) {
	ctx.trainerItemTypes = {};
	for (var i=0; i<ctx.modules.length; i++) {
		var cm = ctx.modules[i];
		if (cm.type == 'iltsession') {
			ctx.trainerItemTypes['iltsession'] = true;
			ctx.dbAttendance.updateItem(cm);
		} else if (cm.type == 'rating') {
			ctx.trainerItemTypes['rating'] = true;
			ctx.dbRating.updateItem(cm);
		} else if (cm.type == 'milestone') {
			ctx.trainerItemTypes['milestone'] = true;
			ctx.dbMilestone.updateItem(cm);
		}
	}
}

//-------------------------------------------------------------------------------------------------
function DbAttendanceObject(courseAssignment, ctx) {

	function _init() {
		_etmAsd = ctx.groupInfo.props.etmAsd || [];
		_dbobj = courseAssignment.attendance ? angular.fromJson(courseAssignment.attendance) : {};
		_dbobj = nlCourse.migrateCourseAttendance(_dbobj);
		_userAttendaces = _getAttandaceAsDictOfDitc();
		_sessionInfos = _dbobj.sessionInfos || {};
		_lastAsdId = _dbobj.lastAsdId || 0;
	}

	var fixed_keys = {
		'attendance_version' : true,
		'sessionInfos' : true,
		'lastAsdId' : true		
	};

	function _getAttandaceAsDictOfDitc() {
		// returns {repid1: {cmid1: {}, cmid2: {}}, repid2: }
		var ret = {};
		for (var repid in _dbobj) {
			if (repid in fixed_keys) continue;
			ret[repid] = {};
			for (var i=0; i<_dbobj[repid].length; i++) {
				var userSessionAttendance = dbobj[repid][i];
				ret[repid][userSessionAttendance.id] = userSessionAttendance;
			}
		}
		return ret;
	}

	this.getEtmAsd = function() {
		return _etmAsd;
	};

	this.getFirstSessionId = function() {
		for(var i=0; i<ctx.modules.length; i++) {
			var cm  = ctx.modules[i];
			if (cm.type == 'iltsession') return cm.id;
		}
		return null;
	};

	this.updateItem = function(cm) {
		if (_etmAsd.length == 0) return;
		var sessionInfo = _sessionInfos[cm.id] || {};
		cm.sessiondate = nl.fmt.json2Date(sessionInfo.sessiondate || '');
		cm.learningRecords = [];
		for (var i=0; i<ctx.learningRecords.length; i++) {
			var lr = ctx.learningRecords[i];
			var statusinfo = lr.repcontent.statusinfo;
			// TODO-NOW: Try getting this too from report helper!
			var userSessionAttendance = (_userAttendaces[lr.id] || {})[cm.id] || {};
			var report = {learnername: lr.user.name, learnerid: lr.user.user_id, 
				attendance: {id: userSessionAttendance.attId} , remarks: {id: userSessionAttendance.remarks}};
			cm.learningRecords.push(report);
		}
	};

	this.addAsdSession = function(parentFixedSession) {
		if (_etmAsd.length == 0) return;
		_lastAsdId++;
		var item = {id: '_asdsession' + _lastAsdId, reason: _etmAsd[0], remarks: ''};
		// TODO-NOW: move this to report helper
		item.name = item.reason.name + (item.remarks ? ': ' + item.remarks : '');
		item.type = 'iltsession';
		item.asdSession = true;
		item.iltduration = parentFixedSession ? parentFixedSession.iltduration : 480;
		item.parentId = parentFixedSession ? parentFixedSession.parentId : '_root';
		item.hide_locked = parentFixedSession ? parentFixedSession.hide_locked : false;
		if (parentFixedSession && parentFixedSession.start_after)
			item.start_after = angular.copy(parentFixedSession.start_after);

		ctx.addModule(item, parentFixedSession);
		this.updateItem(item);
		return item;
	};

	this.removeAsdSession = function(cm) {
		if (_etmAsd.length == 0) return;
		ctx.deleteModule(cm);
	};

	// Private members
	var _etmAsd = [];
	var _dbobj = {};
	var _sessionInfos = {}; // Part of _dbobj
	var _lastAsdId = 0;
	_init();
}

//-------------------------------------------------------------------------------------------------
function DbRatingObject(courseAssignment, ctx) {

	function _init() {
		_dbobj = courseAssignment.rating ? angular.fromJson(courseAssignment.rating) : {};
	}

	this.updateItem = function(cm) {
	};

	// Private members
	var _dbobj = {};
	_init();
}

//-------------------------------------------------------------------------------------------------
function DbMilestoneObject(courseAssignment, ctx) {

	function _init() {
		_dbobj = courseAssignment.milestone ? angular.fromJson(courseAssignment.milestone) : {};
	}

	this.updateItem = function(cm) {
	};

	// Private members
	var _dbobj = {};
	_init();
}

//-------------------------------------------------------------------------------------------------
function UpdateTrainingBatchDlg($scope, ctx) {
	var _myTreeListSrv = nlTreeListSrv.createNew();

	this.show = function() {
		var batchDlg = nlDlg.create($scope);
		batchDlg.setCssClass('nl-height-max nl-width-max nl-no-vscroll');
		_initScope(batchDlg.scope);
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
		}};
		batchDlg.show('view_controllers/learning_reports/update_training_batch_dlg.html',
		[], cancelButton);

	};

	function _initScope(dlgScope) {
		var dlgtypeOpts = [];
		if (Object.keys(ctx.trainerItemTypes).length > 1) dlgtypeOpts.push({id: 'all', name: 'All trainer items'});
		if (ctx.trainerItemTypes.iltsession) dlgtypeOpts.push({id: 'iltsession', name: 'Attendance session items'});
		if (ctx.trainerItemTypes.rating) dlgtypeOpts.push({id: 'rating', name: 'Rating items'});
		if (ctx.trainerItemTypes.milestone) dlgtypeOpts.push({id: 'milestone', name: 'Milestone items'});
		dlgScope.options = {dlgtype: dlgtypeOpts, modulesSearch: '', reason: ctx.dbAttendance.getEtmAsd()};
		dlgScope.data = {dlgtype: dlgScope.options.dlgtype[0]};
		dlgScope.isEtmAsd = ctx.dbAttendance.getEtmAsd().length > 0;
		dlgScope.firstSessionId = ctx.dbAttendance.getFirstSessionId();
		_onDlgTypeChange(dlgScope);
		_initScopeFunctions(dlgScope);
	}

	function _initScopeFunctions(dlgScope) {
		dlgScope.onDlgTypeChange = function(e) {
			_onDlgTypeChange(dlgScope);
		};
		dlgScope.onLeftPaneItemClick = function(e, cm) {
			_onLeftPaneItemClick(dlgScope, cm);
		};
		dlgScope.addAsdSession = function(e, cm) {
			_addAsdSession(dlgScope, cm);
		};
		dlgScope.removeAsdSession = function(e, cm) {
			_removeAsdSession(dlgScope, cm);
		};
	}

	function _onDlgTypeChange(dlgScope) {
		var dlgtype = dlgScope.data.dlgtype.id;
		_myTreeListSrv.clear();
		dlgScope.selectedModule = null;
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
		// TODO-NOW: Validate changes in old selected item
		// TODO-NOW: update editingLockedMsg of an item if the item is to be not edited
		var lastSelectedModule = dlgScope.selectedModule;
		dlgScope.selectedModule = cm;
		if(cm.type === 'module') {
			_myTreeListSrv.toggleItem(cm);
			_showVisible(dlgScope);
			return;
		}
		if (lastSelectedModule && lastSelectedModule.id == cm.id) return;
		// TODO-NOW: Some code around changing the modules
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

	/*
	function _lockItemsAsNeeded(dlgScope) {
		var lastMarkableItem = null;
		var firstLockedItem = null;
		for(var i=0; i<ctx.modules.length; i++) {
			var cm = ctx.modules[i];
			if (firstLockedItem || cm.type == 'module') continue;
			if (!lastMarkableItem || !_isMarkingPending(lastMarkableItem)) {
				lastMarkableItem = cm;
				continue;
			}

			if (cm.type == 'iltsession') {
				_isPending()
			} else if (cm.type == 'rating') {
			} else if (cm.type == 'milestone') {
			}
		}
	}

	fuction _isMarkingPending(cm) {
		if (cm.type == 'iltsession')		
	}
	*/

}

}];



//-------------------------------------------------------------------------------------------------
module_init();
})();
		

(function() {

//-------------------------------------------------------------------------------------------------
// lr_filter.js: Show learning report filter dialog and get the filter params towards the server (single instance)
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.lr_filter', [])
	.config(configFn)
	.service('nlLrFilter', NlLrFilter);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
}];

//-------------------------------------------------------------------------------------------------
var NlLrFilter = ['nl', 'nlDlg', 'nlRouter', 'nlOuUserSelect', function(nl, nlDlg, nlRouter, nlOuUserSelect) {
	var _dataDefaults = {
		type: 'course',		// all|module|course|trainig_kind|module_assign|course_assign|module_self_assign|training_batch|user
		timestamptype: 'created', // created|updated
		myou: false,		// Filter records to my ou level
		myoulevel: null,	// null|1|2|3. For example assume myou = A.B.C.D.E;
							// If null (default) all records with OU equal to or under A.B.C.D.E are shown
							// If 1 all records with OU equal to or under A are shown
							// If 2 all records with OU equal to or under A.B are shown
							// If 3 all records with OU equal to or under A.B.C are shown
		myoufilter: 3,		// 0|1|2|3. This decides the maximum filters applied to fetch records from
							// server. 0 - least filtering; 3 highest filtering.
		assignor: 'all',	// all|me, will auomatically change to 'me' if assignment_manage permission is not there and myou is false
		parentonly: true,	// fetch only parent records or also records part containing course/training
		repsubtype: '',		// may be provided in the URL
		objid: null, 		// depending on type, will be interpretted as moduleid, courseid, ...
		title: null,		// Title for the page
		showfilters: true,	// Should the initial fetch filter dialog be shown
		showfilterjson: false, // Should json for additional filters be shown
		debug: false, //only for testing in debug mode
		chunksize: 50,
		userSelection: false,
		dontZip: false
	};
	var _data = null;
	var _groupInfo = null;
	var _userInfo = null;
	var _myou = null;
	
    this.init = function(settings, userInfo, groupInfo) {
		_data = {};
		_groupInfo = groupInfo;
		_userInfo = userInfo;
        var urlParams = nl.location.search();
		_fillAttrs(_data, ['type'], [settings, urlParams, _dataDefaults]);
        if (!_oneOf(_data.type, ['all', 'module', 'course', 'training_kind', 'module_assign', 'course_assign', 'module_self_assign', 'training_batch', 'user']))
        	_data.type = 'course';
		_fillAttrs(_data, ['timestamptype', 'myou', 'myoulevel', 'myoufilter', 'assignor', 'parentonly',
			'repsubtype', 'objid', 'title', 'showfilters', 'showfilterjson', 'debug', 'chunksize', 'dontZip'], 
        	[settings, urlParams, _dataDefaults]);
        if (_oneOf(_data.type, ['module_assign', 'course_assign', 'training_batch', 'user']))
			_data.showfilters = false;
			
		if (_oneOf(_data.type, ['user'])) _data.userSelection = true;
        if(_data.type == 'module') _data.parentonly = false;
        _toBool(_data, 'parentonly');
		if(_data.type != 'user') _toInt(_data, 'objid');
		
		_toBool(_data, 'myou');
		_toInt(_data, 'myoulevel');
		_toInt(_data, 'myoufilter');
        _toBool(_data, 'showfilters');
        _toBool(_data, 'userSelection');
		_toBool(_data, 'debug');
		_toInt(_data, 'chunksize');
        _toBool(_data, 'dontZip');
        if (!_data.myou && !nlRouter.isPermitted(userInfo, 'assignment_manage')) _data.assignor = 'me';
    	_initDates();
    };
    
	this.getTitle = function() {
		if (_data.title) return filter.title;
		if (_data.type == 'module') return 'Module report';
		else if (_data.type == 'course') return 'Course report';
		else if (_data.type == 'training_kind') return 'Training report';
		else if (_data.type == 'module_assign') return 'Module assignment report';
		else if (_data.type == 'course_assign') return 'Course assignment report';
		else if (_data.type == 'module_self_assign') return 'Exploratory learning report';
		else if (_data.type == 'training_batch') return 'Traning batch report';
		else if (_data.type == 'user') return 'User reports';
		else return 'Learning report';
	};
	
    this.getType = function() {
    	return _data.type;
	};

	this.canZip = function() {
		return !_data.dontZip;
	};

	this.getTimestampType = function() {
		return _data.timestamptype;
	}
	
	this.isDebugMode = function() {
    	return _data.debug;
	}
    
    this.getObjectId = function() {
    	return _data.objid;
    };
    
    this.isFilterShown = function() {
    	return _data.showfilters;
    };

	this.showUserSelection = function() {
		return _data.userSelection;
	};

	this.getMyOu = function() {
		return _myou;
	};

    var _ouUserSelector = null;

	this.show = function($scope) {
    	if (!(_data.showfilters || _data.userSelection)) {
    		return nl.q(function(resolve, reject) {
    			resolve(true);
    		});
		}
		return this.showDialog($scope, _data);
	};

	// This can be called independantly without init
	this.showDialog = function($scope, dataParam) {
		var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-height-max nl-width-max');
		dlg.scope.options = {
			timestamptype: [
				{id: 'created', name: 'Creation timestamp of the learning record'},
				{id: 'updated', name: 'Last updated timestamp of the learning record'}
			],
			repsubtype: [
				{id: '', name: 'All'},
				{id: 'nht', name: 'NHT'},
				{id: 'lms', name: 'LMS'}
			]
		};
		var defaultFilterjson = '[{"field": "completed", "val": true}]';
		dlg.scope.help = {
			timestamptype: {name: 'Fetch based on', help: '<div class="padding-mid">If you are unsure, stick to the defaults.</div>'
				+ '<ul><li class="padding-small">You may fetch based on <b>creation timestamp</b> if would like to see what happened to assignments sent during a timeframe. This will include lerning records that were assigned within the timerange and got updated during or after the given timerange.</li>'
				+ '<li class="padding-small">You may fetch based on <b>last updated timestamp</b> if would like to view the learning activities during a timeframe. This include learning records that were assigned before or within the timerange but were updated within the timerange. </li></ul>'},
			createdfrom: {name: 'From', help: 'Select the start of the timerange to fetch reports.'},
			createdtill: {name: 'Till', help: 'Select the end of the timerange to fetch reports.'},
			repsubtype: {name: 'Report Type', help: '<div>Select the report type.</div>'},
			filterjson: {name: 'Additional filters', help: '<div>Provide additional filters as a json string. For example:</div>'
					+ '<pre>' +  defaultFilterjson + '</pre>'},
			ouUserTree: {name: 'Select user', help: nl.t('Select the specific learner to fetch reports.')}
		};
		if (dataParam.showfilterjson && dataParam.filterjson === undefined) dataParam.filterjson = defaultFilterjson;
		dlg.scope.showfilterjson = dataParam.showfilterjson;

		if(dataParam.userSelection) {
			dlg.scope.singleSelect = true;
			var selectedUsers = {};
			if(dataParam.type == 'user' && dataParam.objid) {
				var userObj = _groupInfo.derived.keyToUsers[dataParam.objid];
				var selected = userObj.org_unit+'.'+userObj.id;
					selectedUsers[selected] = true;	
			}
			_ouUserSelector = nlOuUserSelect.getOuUserSelector(dlg.scope, 
				_groupInfo, {}, {});
			if(Object.keys(selectedUsers).length != 0) _ouUserSelector.updateSelectedIds(selectedUsers)
		}
		
		dlg.scope.data = {timestamptype: {id: dataParam.timestamptype}, createdfrom: dataParam.createdfrom, createdtill: dataParam.createdtill, filterjson: dataParam.filterjson};
		if(dataParam.type == 'course' && !_groupInfo.props.features.etm) {
			dlg.scope.data.repsubtype = {id: dataParam.repsubtype || ''};
			dlg.scope.showReportType = true;
		}
		dlg.scope.error = {};
		dlg.scope.userSelection = dataParam.userSelection;
		dlg.scope.dlgTitle = nl.t('Filter reports');
		if(_ouUserSelector) {
			dlg.scope.data['ouUserTree'] = _ouUserSelector.getTreeSelect();
		}
        var button = {text: nl.t('Fetch'), onTap: function(e){
            if (!_validateInputs(dlg.scope, dataParam)) {
                if (e) e.preventDefault();
                return;
            }
			var sd = dlg.scope.data;
			if(dataParam.type == 'user') {
				var selectedUsers = _ouUserSelector.getSelectedUsers();
				var userObj = null;
				for(var key in selectedUsers) {
					userObj = selectedUsers[key].userObj;
				}
				dataParam.objid = userObj.username;
				dataParam.userid = userObj.id;
			} else {
				dataParam.timestamptype = sd.timestamptype.id;
				dataParam.createdtill = sd.createdtill;
				dataParam.createdfrom = sd.createdfrom;
				dataParam.repsubtype = sd.repsubtype ? sd.repsubtype.id : sd.repsubtype;
				dataParam.filterjson = sd.filterjson;	
			}
			return true;
        }};
        var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
            return false;
        }};
        return dlg.show('view_controllers/learning_reports/lr_filter_dlg.html', [button], cancelButton, false);
    };

 	this.getServerParams = function() {
		var ret = {type: _data.type, assignor: _data.assignor, parentonly: _data.parentonly,
			myou: _data.myou};
		if (_data.type != 'all' && _data.objid) ret.objid = _data.objid;
		if (_data.type == 'user') ret.userid = _data.userid;
		if (_data.showfilters) {
			if (_data.timestamptype == 'created') {
				ret.createdtill = _data.createdtill;
				ret.createdfrom = _data.createdfrom;
			} else {
				ret.updatedtill = _data.createdtill;
				ret.updatedfrom = _data.createdfrom;
			}
		}
		if (_data.debug) ret.debug = true;
		if (_data.chunksize) ret.chunksize = _data.chunksize;
		ret.filters = _getOusPlusRepSubTypePlusCustomFilters();
		return ret;
	};

    this.getFilterStr = function() {
		if (!_data.showfilters) return '';
		var tsStr = (_data.timestamptype == 'created') ? 'Created' : 'Updated';
		return nl.t('{} from {} till {}', 
			tsStr,
            nl.fmt.fmtDateDelta(_data.createdfrom), 
            nl.fmt.fmtDateDelta(_data.createdtill));
	};

	function _getOusPlusRepSubTypePlusCustomFilters() {
		var ret = [];
		var custFilters = _data.filterobj || [];
		for (var i=0; i<custFilters.length; i++) ret.push(custFilters[i]);
		if (_data.repsubtype) ret.push({field: 'repsubtype', val: _data.repsubtype});
		if (!_data.myou) return ret;
		var me = (_groupInfo.derived.keyToUsers || {})[_userInfo.username];
		_myou = me.org_unit;
		var ouParts = (me.org_unit || '').split('.');
		if (_data.myoulevel !== null) {
			if (_data.myoulevel > ouParts.length) _data.myoulevel = ouParts.length;
			var ouParts1 = ouParts;
			ouParts = [];
			for (var i=0; i<_data.myoulevel; i++) ouParts.push(ouParts1[i]);
			_myou = ouParts.join('.');
			if (_data.myoufilter > _data.myoulevel) _data.myoufilter = _data.myoulevel;
		}
		if (_data.myoufilter > 3) _data.myoufilter = 3;
		for (var i=0; i<ouParts.length && i<_data.myoufilter; i++) {
			ret.push({field: 'ou' + i, val: ouParts[i]});
		}
		return ret;
	}

	function _initDates(){
        var day = 24*60*60*1000; // 1 in ms
        var now = new Date();
        var offset = now.getTimezoneOffset()*60*1000; // in ms
        now = Math.floor(now.getTime()/day)*day + offset; // Today 00:00 Hrs in local time
        _data.createdtill = new Date(now + day);
        _data.createdfrom = new Date(now - (6 * day));
    }

    function _validateInputs(scope, dataParam) {
		dataParam.filterobj = null;
		scope.error = {};
		if (dataParam.type == 'user') {
			var selectedUsers = _ouUserSelector ? _ouUserSelector.getSelectedUsers() : {};
			if (Object.keys(selectedUsers).length == 0) {
				nlDlg.popupAlert({title: 'Please select user', template: 'Please select learner to fetch records'});
				return false;
			}
			return true;
		}
        if (!scope.data.createdfrom) return _validateFail(scope, 'createdfrom', 'From date is mandatory');
        if (!scope.data.createdtill) return _validateFail(scope, 'createdtill', 'Till date is mandatory');
		if (scope.data.createdfrom >= scope.data.createdtill) return _validateFail(scope, 'createdtill', 'Till date should be later than from date');
		if (dataParam.showfilterjson && scope.data.filterjson) {
			try {
				dataParam.filterobj = angular.fromJson(scope.data.filterjson);
			}
			catch (e) {
				return _validateFail(scope, 'filterjson', 'JSON parse failed');
			}
		}
        return true;
    }
                    
    function _validateFail(scope, attr, errMsg) {
        return nlDlg.setFieldError(scope, attr, nl.t(errMsg));
    }

	function _oneOf(item, arr) {
		for (var i=0; i<arr.length; i++) {
			if (item == arr[i]) return true;
		}
		return false;
	}
	
	function _fillAttrs(dest, attrs, sources) {
		for (var i=0; i<attrs.length; i++) {
			var attr = attrs[i];
			for (var j=0; j<sources.length; j++) {
				var src = sources[j];
				if (!(attr in src)) continue;
				dest[attr] = src[attr];
				break;
			}
		}
	}

	function _toInt(dictObj, attr) {
		if (! attr in dictObj) return false;
		if (typeof dictObj[attr] != 'string' && !(dictObj[attr] instanceof String)) return false;
		dictObj[attr] = parseInt(dictObj[attr]);
		return true;
	}
	
	function _toBool(dictObj, attr) {
		if (!_toInt(dictObj, attr)) return;
		dictObj[attr] = dictObj[attr] == 1 ? true : false;
	}
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

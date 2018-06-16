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
var NlLrFilter = ['nl', 'nlDlg', 'nlRouter', 'nlGroupInfo', function(nl, nlDlg, nlRouter, nlGroupInfo) {
	var self = this;
	// TODO-LATER-123: 'type' default should be 'all'
	var _dataDefaults = {
		type: 'course',		// all|module|course|trainig_kind|module_assign|course_assign|training_batch
		assignor: 'all',	// all|me, will auomatically change to 'me' if assignment_manage permission is not there
		parentonly: true,	// fetch only parent records or also records part containing course/training
		objid: null, 		// depending on type, will be interpretted as moduleid, courseid, ...
		title: null,		// Title for the page
		objname: null,		// Used for subtitle if objid was passed as input
		showfilters: true
	};
	var _data = null;
	
    this.init = function(settings, userInfo) {
		_data = {};
        var urlParams = nl.location.search();
        _fillAttrs(_data, ['type'], [settings, urlParams, _dataDefaults]);
        if (!_oneOf(_data.type, ['all', 'module', 'course', 'training_kind', 'module_assign', 'course_assign', 'training_batch']))
        	_data.type = 'course'; // TODO-LATER-123: should be 'all'
        _fillAttrs(_data, ['assignor', 'parentonly', 'objid', 'title', 'objname', 'showfilters'], 
        	[settings, urlParams, _dataDefaults]);
        if (_oneOf(_data.type, ['module_assign', 'course_assign', 'training_batch']))
        	_data.showfilters = false;
        _toBool(_data, 'parentonly');
        _toInt(_data, 'objid');
        _toBool(_data, 'showfilters');
        if (!nlRouter.isPermitted(userInfo, 'assignment_manage')) _data.assignor = 'me';
    	_initDates();
    };
    
    // Set the course/course assignment/module/... name if objid is defined.
    this.setObjectName = function(objname) {
    	if (!_data.objid) return;
    	_data.objname = objname;
    };
    
	this.getTitle = function() {
		if (_data.title) return filter.title;
		if (_data.type == 'module') return 'Module report';
		else if (_data.type == 'course') return 'Course report';
		else if (_data.type == 'training_kind') return 'Training report';
		else if (_data.type == 'module_assign') return 'Module assignment report';
		else if (_data.type == 'course_assign') return 'Course assignment report';
		else if (_data.type == 'training_batch') return 'Traning batch report';
		else return 'Learning report';
	};
	
    this.getSubTitle = function(objname) {
    	return _data.objname || '';
    };
    
    this.getType = function() {
    	return _data.type;
    };
    
    this.getObjectId = function() {
    	return _data.objid;
    };
    
    this.isFilterShown = function() {
    	return _data.showfilters;
    };

    this.show = function($scope) {
    	if (!_data.showfilters) {
    		return nl.q(function(resolve, reject) {
    			resolve(true);
    		});
    	}
        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-height-max nl-width-max');
        dlg.scope.data = {createdfrom: _data.createdfrom, createdtill: _data.createdtill};
        dlg.scope.error = {};
        dlg.scope.dlgTitle = nl.t('Assignment sent time range');
        var button = {text: nl.t('Fetch'), onTap: function(e){
            if (!_validateInputs(dlg.scope)) {
                if (e) e.preventDefault();
                return;
            }
            var sd = dlg.scope.data;
            _data.createdtill = sd.createdtill;
            _data.createdfrom = sd.createdfrom;
            return true;
        }};
        var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
            return false;
        }};
        return dlg.show('view_controllers/learning_reports/lr_filter_dlg.html', [button], cancelButton, false);
    };

 	this.getServerParams = function() {
		var ret = {type: _data.type, assignor: _data.assignor, parentonly: _data.parentonly};
		if (_data.type != 'all' && _data.objid) ret.objid = _data.objid; 
		if (_data.showfilters) {
			ret.createdtill = _data.createdtill;
			ret.createdfrom = _data.createdfrom;
		}
		return ret;
	};

    this.getFilterStr = function() {
		if (!_data.showfilters) return '';
        return nl.t('From {} till {}', 
            nl.fmt.fmtDateDelta(_data.createdfrom), 
            nl.fmt.fmtDateDelta(_data.createdtill));
    };

   function _initDates(){
        var day = 24*60*60*1000; // 1 in ms
        var now = new Date();
        var offset = now.getTimezoneOffset()*60*1000; // in ms
        now = Math.floor(now.getTime()/day)*day + offset; // Today 00:00 Hrs in local time
        _data.createdtill = new Date(now + day);
        _data.createdfrom = new Date(now - (6 * day));
    }

    function _validateInputs(scope){
        scope.error = {};
        if (!scope.data.createdfrom) return _validateFail(scope, 'createdfrom', 'From date is mandatory');
        if (!scope.data.createdtill) return _validateFail(scope, 'createdtill', 'Till date is mandatory');
        if (scope.data.createdfrom >= scope.data.createdtill) return _validateFail(scope, 'createdtill', 'Till date should be later than from date');
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

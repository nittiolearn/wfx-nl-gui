(function() {
//-------------------------------------------------------------------------------------------------
// lr_course_assign_view.js; View content of course assignment (eye icon)
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.lr_course_assign_view', [])
    .service('nlLrCourseAssignView', NlLrCourseAssignView);
}
//-------------------------------------------------------------------------------------------------

var NlLrCourseAssignView = ['nl', 'nlDlg', 'nlTreeListSrv',
function(nl, nlDlg, nlTreeListSrv) {

    this.show = function($scope, modules, courseAssignment, getModuleInfoFn) {
        modules = angular.copy(modules);
		for(var i=0; i<modules.length; i++) {
            nlTreeListSrv.addItem(modules[i]);
		}
        var dlg = nlDlg.create($scope);
		dlg.setCssClass('nl-height-max nl-width-max');
		dlg.scope.dlgTitle = courseAssignment.info.name;
        _showVisible(dlg, modules);
        dlg.scope.search = '';
		dlg.scope.selectedModule = null; //dlg.scope.modules[0];
        _udpateSelectedModuleInfo(dlg, getModuleInfoFn);
		dlg.scope.onClick = function(e, cm) {
			dlg.scope.selectedModule = cm;
			if(cm.type === 'module') {
				nlTreeListSrv.toggleItem(cm);
				_showVisible(dlg, modules);
				return;
            }
            _udpateSelectedModuleInfo(dlg, getModuleInfoFn);
		};
		var cancelButton = {text: nl.t('Close')};
		dlg.show('view_controllers/learning_reports/lr_course_assign_view.html',
			[], cancelButton);
    };

    var MAX_LIST_SIZE =  5; // TODO-NOW
    function _udpateSelectedModuleInfo(dlg, getModuleInfoFn) {
        dlg.scope.visibleUsers = [];
        dlg.scope.chartInfo = null;
        dlg.scope.chartData = [];
        dlg.scope.chartTotal = 0;
        dlg.scope.moreAvailable = false;

        var cm = dlg.scope.selectedModule;
        var moduleInfo = getModuleInfoFn(cm);
        if (!cm || !moduleInfo) return;
        var statusCounts = {};
        var users = moduleInfo.records;
        for (var i=0; i<users.length; i++) {
            var user = users[i];
            if (!_isSearchPass(user, dlg.scope.search)) continue;
            if (dlg.scope.visibleUsers.length < MAX_LIST_SIZE)
                dlg.scope.visibleUsers.push(user);
            else dlg.scope.moreAvailable = true;
            var statusStr = user.statusStr;
            if (!(statusStr in statusCounts)) statusCounts[statusStr] = 0;
            statusCounts[statusStr]++;
            dlg.scope.chartTotal++;
        }
        if (!dlg.scope.chartTotal) return;
        _updateChartInfoAndData(dlg, statusCounts, moduleInfo.internalStatusToStatusStrs);
    }

    function _isSearchPass(user, search) {
        if (!search) return true;
        var search = search.toLowerCase();
        if (_searchInAttrs(user, search.toLowerCase(), ['name', 'status', 'remarks'])) return true;
        return false;
    }

    function _searchInAttrs(obj, search, attrs) {
        for (var i=0; i<attrs.length; i++) {
            var attr = attrs[i];
            if (!obj[attr]) continue;
            if (obj[attr].toLowerCase().indexOf(search) >= 0) return true;
        }
        return false;
    }

    var _allowedStatus = [
        {attr:'success', color:_nl.colorsCodes.done}, 
        {attr:'partial_success', color: _nl.colorsCodes.started},
        {attr:'failed', color: _nl.colorsCodes.failed},
        {attr:'started', color: _nl.colorsCodes.started},
        {attr:'pending', color: _nl.colorsCodes.pending},
        {attr:'waiting', color: _nl.colorsCodes.waiting},
        {attr:'attrition', color: _nl.colorsCodes.waiting}
    ];

    function _updateChartInfoAndData(dlg, statusCounts, internalStatusDict) {
        dlg.scope.chartInfo = {labels: [], colours: [], data: []};
        dlg.scope.chartData = [];
        for(var i=0; i<_allowedStatus.length; i++) {
            var statusInfo = _allowedStatus[i];
            var statusStrs = internalStatusDict[statusInfo.attr] || [];
            for (var j=0; j<statusStrs.length; j++) {
                var statusStr = statusStrs[j];
                if (!statusCounts[statusStr]) continue;
                dlg.scope.chartData.push({name: statusStr, val: statusCounts[statusStr]});
                dlg.scope.chartInfo.labels.push(statusStr);
                dlg.scope.chartInfo.colours.push(statusInfo.color);
                dlg.scope.chartInfo.data.push(statusCounts[statusStr]);
            }
        }
    }

	function _showVisible(dlg, modules) {
		dlg.scope.modules = [];
		for(var i=0; i<modules.length; i++) {
			var cm=modules[i];
			if (!cm.visible) continue;
			dlg.scope.modules.push(cm);
		}
	}
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

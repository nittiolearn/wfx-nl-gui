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
        dlg.scope.search = {searchStr: ''};
		dlg.scope.selectedModule = null; //dlg.scope.modules[0];
        _udpateSelectedModuleInfo(dlg, getModuleInfoFn);
		dlg.scope.onClick = function(e, cm) {
            if (!cm) return;
            var lastSelectedModule = dlg.scope.selectedModule;
			dlg.scope.selectedModule = cm;
			if(cm.type === 'module') {
                _initScope(dlg);
				nlTreeListSrv.toggleItem(cm);
				_showVisible(dlg, modules);
				return;
            }
            if (lastSelectedModule && lastSelectedModule.id == cm.id) return;
            _udpateSelectedModuleInfo(dlg, getModuleInfoFn);
        };
        dlg.scope.getUrl = function(lessonId) {
			return nl.fmt2('/lesson/view/{}', lessonId);
		};
        
        dlg.scope.onSearchKey = function(event) {
            if (event && event.which === 13) {
                dlg.scope.onSearch(event);
            }
        };

        dlg.scope.onSearch = function(event) {
            _udpateSelectedModuleInfoWithSearch(dlg);
        };

        var cancelButton = {text: nl.t('Close')};
		dlg.show('view_controllers/learning_reports/lr_course_assign_view.html',
			[], cancelButton);
    };

    function _initScope(dlg) {
        dlg.scope.visibleUsers = [];
        dlg.scope.chartInfo = null;
        dlg.scope.chartData = [];
        dlg.scope.chartTotal = 0;
        dlg.scope.moreAvailable = false;
        dlg.scope.totalUserCount = 0;
    }

    var _moduleInfo = null;
    var MAX_LIST_SIZE = 100;
    // TODO-NOW:
    // Make sure the status strings are specific to item type (change mainly in lesson_reports.js)
    // Milestone date and remarks are not coming properly (selectedModule.itemDict in html not correct)
    // Show score for lessons with score (maxScore > 0) by setting showScore and filling the values in lesson_reports.js
    // Show remarks for ilt, rating, info, link by setting showRemarks and filling the values in lesson_reports.js
    function _udpateSelectedModuleInfo(dlg, getModuleInfoFn) {
        _moduleInfo = getModuleInfoFn(dlg.scope.selectedModule);
        _udpateSelectedModuleInfoWithSearch(dlg);
    }

    function _udpateSelectedModuleInfoWithSearch(dlg) {
        _initScope(dlg);
        if (!_moduleInfo) return;
        var statusCounts = {};
        var users = _moduleInfo.records;
        dlg.scope.totalUserCount =  users.length;
        for (var i=0; i<users.length; i++) {
            var user = users[i];
            if (!_isSearchPass(user, dlg.scope.search.searchStr)) continue;
            if (dlg.scope.visibleUsers.length < MAX_LIST_SIZE)
                dlg.scope.visibleUsers.push(user);
            else dlg.scope.moreAvailable = true;
            var statusStr = user.statusStr;
            if (!(statusStr in statusCounts)) statusCounts[statusStr] = 0;
            statusCounts[statusStr]++;
            dlg.scope.chartTotal++;
        }
        if (!dlg.scope.chartTotal) return;
        _updateChartInfoAndData(dlg, statusCounts, _moduleInfo.internalStatusToStatusStrs);
    }

    function _isSearchPass(user, search) {
        if (!search) return true;
        var search = search.toLowerCase();
        if (_searchInAttrs(user, search.toLowerCase(), ['name', 'id', 'statusStr', 'remarks'])) return true;
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

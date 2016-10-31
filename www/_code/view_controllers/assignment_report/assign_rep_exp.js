(function() {

//-------------------------------------------------------------------------------------------------
// assign_rep_exp.js:
// Service to export assignment report records
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.assign_rep_exp', [])
    .service('NlAssignReportExport', NlAssignReportExport);
}
   
//-------------------------------------------------------------------------------------------------
var NlAssignReportExport = ['nl', 'nlDlg', 'nlServerApi', 'nlProgressLog',
function(nl, nlDlg, nlServerApi, nlProgressLog) {
    
    var self = this;
    var pl = null;
    var dlg = null;

    this.export = function($scope, assignid) {
        if (!pl) pl = nlProgressLog.create($scope);
        pl.showLogDetails(true);
        pl.clear();
        _setProgress('start');
        dlg = _showDlg($scope);
        _q(_getDataFromServer())
        .then(function() {
            _setProgress('done');
            pl.imp('Export completed');
        }, function() {
            _setProgress('done');
            pl.error('Export failed');
        });
    };

    function _showDlg($scope) {
        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-height-max nl-width-max');
        var cancelButton = {text: nl.t('Close')};
        dlg.show('view_controllers/assignment_report/assign_rep_exp_dlg.html', [], cancelButton);
        return dlg;
    }

	function _getDataFromServer(resolve, reject) {
		nlServerApi.assignmentReport(filter).then(function(resultList) {
            pl.imp('Got assignment reports' + resultList.length);
			resolve(true);
		}, function(reason) {
		    var msg = 'Downloading from server failed assignment reports';
            pl.error(msg, reason);
			reject(msg);
		});
	}

    var _progressLevels = {
        start: [0, 0],
        download: [0, 80],
        process: [80, 95],
        export: [95, 98],
        done: [98, 100]
    };
    
    function _setProgress(currentAction, doneSubItems, maxSubItems) {
        if (!doneSubItems) doneSubItems = 1;
        if (!maxSubItems) maxSubItems = 1;
        var levels = _progressLevels[currentAction];
        var p = levels[0] + (doneSubItems/maxSubItems)*(levels[1] - levels[0]);
        pl.progress(p);
    }

    function _q(fn) {
        return function(param) {
            return nl.q(function(resolve, reject) {
                fn(resolve, reject, param);
            });
        };
    }
}];


//-------------------------------------------------------------------------------------------------
module_init();
})();

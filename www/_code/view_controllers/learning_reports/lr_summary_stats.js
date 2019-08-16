(function() {

//-------------------------------------------------------------------------------------------------
// lr_summary_stats.js: Maintain summary statistics of received reports
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.learning_reports.lr_summary_stats', [])
	.config(configFn)
	.service('nlLrSummaryStats', NlLrSummaryStats);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
}];

var NlLrSummaryStats = ['nl', 'nlLrHelper', 'nlReportHelper',
function(nl, nlLrHelper, nlReportHelper) {
	this.getSummaryStats = function() {
		return new SummaryStats(nl, nlLrHelper, nlReportHelper);
	};
}];

//-------------------------------------------------------------------------------------------------
function SummaryStats(nl, nlLrHelper, nlReportHelper) {
    
    var _metas = nlLrHelper.getMetaHeaders(true);
    var _orgDict = {};
    
    this.reset = function() {
        _orgDict = {};
    };
    
    this.removeFromStats = function(report) {
        _updateStatsObj(report, -1);
    };

    this.addToStats = function(report) {
        _updateStatsObj(report, +1);
    };
    
    this.getOrgEntry = function(report) {
        var keys = _keys(report);
        var key = angular.toJson(keys);
        return _orgDict[key] || null;
    };

    this.getStatsData = function() {
        return _orgDict;
    };
    
    this.asList = function() {
        var ret = nl.utils.dictToList(this.getStatsData());
        ret.sort(function(a, b) {
            if (a.assigned == b.assigned) return (b.perc - a.perc);
            return (b.assigned - a.assigned);
        });
        return ret;
    };

    function _keys(report) {
        var ret  = [{n: 'org', 'v': report.user.org_unit}];
        var usermeta = report.usermd;
        for(var i=0; i<_metas.length; i++)
            ret.push({n: [_metas[i].id], v:usermeta[_metas[i].id]||''});
        return ret;
    }
    
    function _initStatObj(keys) {
        var ret = {perc: '', assigned: 0, done: 0, failed: 0, started: 0, pending: 0};
        for (var i=0; i<keys.length; i++) ret[keys[i].n] = keys[i].v;
        return ret;
    }
    
    function _updateStatsObj(report, delta) {
        var keys = _keys(report);
        var key = angular.toJson(keys);
        if (!(key in _orgDict)) _orgDict[key] = _initStatObj(keys);
        var statsObj = _orgDict[key];

        statsObj.assigned += delta;
        var stats = report.stats;
        if (stats.status.id == nlReportHelper.STATUS_PENDING) statsObj.pending += delta;
        else if (stats.status.id == nlReportHelper.STATUS_STARTED) statsObj.started += delta;
        else if (stats.status.id == nlReportHelper.STATUS_FAILED) statsObj.failed += delta;
        else statsObj.done += delta;
        statsObj.perc = statsObj.assigned > 0 ? Math.round(statsObj.done/statsObj.assigned*100) : 0;
        statsObj.percStr = statsObj.assigned > 0 ? statsObj.perc + ' %' : '';    	
   }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

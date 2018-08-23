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

var NlLrSummaryStats = ['nl', 'nlLrHelper',
function(nl, nlLrHelper) {
	this.getSummaryStats = function() {
		return new SummaryStats(nl, nlLrHelper);
	};
}];

//-------------------------------------------------------------------------------------------------
function SummaryStats(nl, nlLrHelper) {
    
    var _metas = nlLrHelper.getMetaHeaders(true);
    var _orgDict = {};
    
    this.reset = function() {
        _orgDict = {};
    };
    
    this.removeFromStats = function(report) {
        var keys = _keys(report);
        var key = angular.toJson(keys);
        if (!(key in _orgDict)) _orgDict[key] = _initStatObj(keys);
        _updateStatsObj(report, _orgDict[key], -1);
    };

    this.addToStats = function(report) {
        var keys = _keys(report);
        var key = angular.toJson(keys);
        if (!(key in _orgDict)) _orgDict[key] = _initStatObj(keys);
        _updateStatsObj(report, _orgDict[key], +1);
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
        var ret = nlLrHelper.dictToList(this.getStatsData());
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
    
    function _updateStatsObj(report, statsObj, delta) {
        statsObj.assigned += delta;
        if (report.raw_record.ctype == _nl.ctypes.CTYPE_COURSE) _updateStatsForCourseObj(report, statsObj, delta);
        else if (report.raw_record.ctype == _nl.ctypes.CTYPE_MODULE) _updateStatsForModuleObj(report, statsObj, delta);
        statsObj.perc = statsObj.assigned > 0 ? Math.round(statsObj.done/statsObj.assigned*100) : 0;
        statsObj.percStr = statsObj.assigned > 0 ? statsObj.perc + ' %' : '';    	
       }

    function _updateStatsForCourseObj(report, statsObj, delta) {
        var stats = report.stats;
        if (stats.status.id == nlLrHelper.STATUS_PENDING) statsObj.pending += delta;
        else if (stats.status.id == nlLrHelper.STATUS_STARTED) statsObj.started += delta;
        else if (stats.status.id == nlLrHelper.STATUS_FAILED) statsObj.failed += delta;
        else statsObj.done += delta;
    }
    
    function _updateStatsForModuleObj(report, statsObj, delta) {
        var stats = report.repcontent;
        if (!stats.started) statsObj.pending += delta;
        else if (stats.started && !stats.ended) statsObj.started += delta;
        else if (stats.status.id == nlLrHelper.STATUS_FAILED) statsObj.failed += delta;
        else statsObj.done += delta;
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

(function() {

//-------------------------------------------------------------------------------------------------
// rno.js:
// rno - Rating and observation module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.rno_stats', [])
    .directive('rnoStatsObservation', RnoStatsDir('obs'))
    .directive('rnoStatsObservationTable', RnoStatsDir('obs_table'))
    .directive('rnoStatsReport', RnoStatsDir('rep'))
    .directive('rnoStatsReportTable', RnoStatsDir('rep_table'))
    .directive('rnoStatsRating', RnoStatsDir('rating'))
    .directive('rnoStatsRatingTable', RnoStatsDir('rating_table'))
    .service('nlRnoStats', RnoStatsSrv);
}

//-------------------------------------------------------------------------------------------------
function RnoStatsDir(name) {
    return function() {
        return {
            restrict: 'E',
            templateUrl: 'view_controllers/rno/rno_stats_' + name + '.html'
        };
    };
}

//-------------------------------------------------------------------------------------------------
var RnoStatsSrv = ['nl', 'nlServerApi', 'nlDlg', 'nlExporter',
function(nl, nlServerApi, nlDlg, nlExporter) {
    /* 
     * RnoStatsCtrl in rno.js delegates the implementation to this file.
     */
    
    var _pageGlobals = null;
    var $scope = null;
    var _impl = null;
    var _ratingInfo = null;
    var _fetchedDataCount = 0;
    var _loadedCentres = {};
    var self = this;

    this.init = function(pageGlobals, scope) {
        _pageGlobals = pageGlobals;
        var centreOptions = _pageGlobals.metadata.user_model.centre ?
            _pageGlobals.metadata.user_model.centre.values : ['NA'];
        var centres = [];
        for (var i=0; i<centreOptions.length; i++)
            centres.push({id: centreOptions[i], name: centreOptions[i]});

        $scope = scope;
        $scope.viewSummary = _viewSummary;
        $scope.download = _download;
        $scope.onCentreChange = _onCentreChange;
        $scope.onClsChange = _onClsChange;
        $scope.onClsChange = _onClsChange;
        $scope.onNameChange = _onNameChange;
        $scope.onMonthChange = _onMonthChange;
        $scope.data = {centre: centres[0], cls: {id: ''}, name: {id: ''}, month: null};
        $scope.options = {centre: centres, cls: null, name: null, month: null};
        $scope.showFilter = false;
        $scope.showHelp = false;
        $scope.role = _pageGlobals.role;
        $scope.loadingInProgress = false;

        $scope.rnoCount = 0;
        $scope.obsCount = 0;
        $scope.repCount = 0;
        _loadedCentres = {};

        _ratingInfo = new RnoRatingInfo(nl, _pageGlobals.metadata);
        _impl = new RnoStatsImpl(nl, nlDlg, nlExporter, _ratingInfo);
        _impl.init($scope);
        _viewSummary();
    };

    this.loadData = function() {
        if (_pageGlobals.role =='admin') {
            nlDlg.popupStatus('Please select the centre to proceed ...', false);
            return;
        }
        _fetchedDataCount = 0;
        _loadData();
    };

    function _loadData(centreName) {
        $scope.loadingInProgress = true;
        var msg = _fetchedDataCount > 0 ? 
            nl.t('Fetched data of {} students. Fetching more ...', _fetchedDataCount) :
            nl.t('Fetching data ...');
        nlDlg.popupStatus(msg, false);
        var params = {metadata: _pageGlobals.metadataIdParent, 
            search: '', user_type: '', section: '', role: _pageGlobals.role, 
            max: _pageGlobals.max, start_at: _fetchedDataCount};
        if (_pageGlobals.metadataIdParent != _pageGlobals.metadataId) {
            params.metadata2 = _pageGlobals.metadataId;
        }
        if (centreName) params.centre = centreName;
        nlServerApi.rnoGetDataList(params).then(function(resultList) {
            _fetchedDataCount += resultList.length;
            _impl.processRnoList(resultList, $scope);
            $scope.options.cls = _impl.getClasses();
            $scope.options.name = _impl.getNames($scope.data.cls.id);
            _impl.updateStatistics($scope, $scope.data.cls.id, $scope.data.name.id);
            if (resultList.length > _pageGlobals.max) {
                _loadData(centreName);
            } else {
                $scope.loadingInProgress = false;
                if (centreName) _loadedCentres[centreName] = true;
                var msg = nl.t('Fetched data of {} students.', _fetchedDataCount);
                nlDlg.popupStatus(msg);
                // TODO-MUNNI: Remove load dummy data code after initial stabilizations
                // are done.
                //_loadDummyData();
            }
        });
    }

    function _loadDummyData() {
        var recordsPerChunk = 1000;
        var maxChunks = 10;
        var timeBetweenChunks = 3000;
        _loadDummyDataInChunks(0);
        
        function _loadDummyDataInChunks(chunkNumber) {
            if (chunkNumber >= maxChunks) {
                nlDlg.popupStatus('Loaded dummy chunks: ' + maxChunks);
                return;
            }
            nlDlg.popupStatus('Loading dummy chunk: ' + (chunkNumber+1), false);
            nl.timeout(function() {
                var resultList = _getDummyData(recordsPerChunk, chunkNumber*recordsPerChunk);
                _impl.processRnoList(resultList, $scope);
                $scope.options.cls = _impl.getClasses();
                $scope.options.name = _impl.getNames($scope.data.cls.id);
                _impl.updateStatistics($scope, $scope.data.cls.id, $scope.data.name.id);
                chunkNumber++;
                _loadDummyDataInChunks(chunkNumber);
            }, timeBetweenChunks);
        }

        function _getDummyData(cnt, startId) {
            var resultList = [];
            for(var i=0; i<cnt; i++) {
                var id = 10000+i+startId;
                var cfg = {first_name: 'Simulated', last_name: '' + id, 
                    centre: 'Centre 1', user_type: 'Toddler', section: 'Section A'};
                var data = {observations: [], reportsSent: {}};
                for(var j=0; j<12; j++) {
                    for(var k=0; k<4; k++) {
                        data.observations.push(_dummyObservation(j, k));
                        data.reportsSent['report/'+j+'/'+k] = _dummyReportSent(j, k);
                    }
                }
                var rno = {id: id, config: angular.toJson(cfg), data: angular.toJson(data)};
                resultList.push(rno);
            }
            return resultList;
        }

        function _dummyObservation(monthIndex, dateIndex) {
            var d1=new Date();
            d1.setMonth(d1.getMonth() - monthIndex);
            d1.setDate(d1.getDate() - dateIndex);
            return {created: d1, sent: {sent_on: d1}, ratings: {
                '101': 'emerging',
                '102': 'emerging',
                '103': 'emerging',
                '104': 'emerging'
            }};
        }

        function _dummyReportSent(monthIndex, dateIndex) {
            var d1=new Date();
            d1.setMonth(d1.getMonth() - monthIndex);
            d1.setDate(d1.getDate() - dateIndex);
            return {sent_on: d1, type: 'report'};
        }
    }
    
    function _viewSummary() {
        $scope.showObservationStats = false;
        $scope.showObservationTable = false;
        $scope.showReportStats = false;
        $scope.showReportTable = false;
    }
    
    function _download() {
        _impl.onDownload($scope);
    }

    function _onCentreChange(bFetch) {
        if ($scope.data.centre.id in _loadedCentres || !bFetch) {
            _onNameChange();
            return;
        }
        if ($scope.loadingInProgress) return;
        _fetchedDataCount = 0;
        _loadData($scope.data.centre.id);
    }

    function _onClsChange() {
        $scope.data.name = {id: ''};
        $scope.options.name = _impl.getNames($scope.data.cls.id);
        _onNameChange();
    }
    
    function _onNameChange() {
        _impl.updateStatistics($scope, $scope.data.cls.id, $scope.data.name.id);
    }
    
    function _onMonthChange() {
        _impl.onMonthChange($scope);
    }
    
}];

//-------------------------------------------------------------------------------------------------
function RnoStatsImpl(nl, nlDlg, nlExporter, _ratingInfo) {
    var _rnoList = [];
    var _obsList = [];
    var _repList = [];
    var _ratingList = [];
    var _classes = {};
    var _dateToStats = {};
    var _monthToStats = {};
    var _userToStats = {};
    
    //---------------------------------------------------------------------------------------------
    // public interfaces
    //---------------------------------------------------------------------------------------------
    this.init = function($scope) {
        _init($scope);
    };
    
    this.processRnoList = function(rnoList, $scope) {
        _processRnoList(rnoList, $scope);
    };
    
    this.getClasses = function() {
        return _formOption(_classes, '(All classes)');
    };
    
    this.getNames = function(cls) {
        var defName = '(All students)';
        if (cls in _classes) return _formOption(_classes[cls], defName);
        var overall = {};
        for(var cls in _classes)
            for(var name in _classes[cls])
                overall[name] = true;
        return _formOption(overall, defName);
    };

    this.updateStatistics = function($scope, clsFilter, nameFilter) {
        _updateStatistics($scope, clsFilter, nameFilter);
    };

    this.onMonthChange = function($scope) {
        _onMonthChange($scope);
    };

    this.onDownload = function($scope) {
        _onDownload($scope);
    };

    //---------------------------------------------------------------------------------------------
    // on-init code: called once at start of the controller
    //---------------------------------------------------------------------------------------------
    function _init($scope) {
        _rnoList = [];
        _obsList = [];
        _repList = [];
        _ratingList = [];
        _classes = {};
        _updateStaticData($scope);
    }

    function _updateStaticData($scope) {
        $scope.chartColors = ['#000077', '#007700', '#CC7700'];
        $scope.chartMonthlyLabels = _getMonthlyChartLabels($scope);
        $scope.chartMonthlyOnClick = function(elems) {
            _onMontlyChartClicked($scope, elems);
        };
        $scope.chartDailyLabels = _getDailyChartLabels($scope);
        $scope.chartData = {};
        
        $scope.obsCounters = ['Observations done', 'Observations sent', 'Milestones rated'];
        $scope.obsSelectedCounters = [];
        $scope.obsShow = [true, true, false];
        $scope.obsShowHide = [
            function() {_obsShowHide($scope, 0);}, 
            function() {_obsShowHide($scope, 1);}, 
            function() {_obsShowHide($scope, 2);}
        ];

        $scope.repCounters = ['Reports sent'];
    }

    function _obsShowHide($scope, pos) {
        $scope.obsShow[pos] = !$scope.obsShow[pos];
        var atleastOneTrue = false;
        for(var i=0; i<$scope.obsShow.length; i++)
            if ($scope.obsShow[i]) {
                atleastOneTrue = true;
                break;
            }
        if (!atleastOneTrue) {
            nlDlg.popupStatus('Enable atleast one counter to view');
            $scope.obsShow[pos] = !$scope.obsShow[pos];
            return;
        }
        _updateChartsAndTables($scope);
    }
            
    function _getMonthlyChartLabels($scope) {
        var startMonth = new Date();
        $scope.data.month = {id: nl.fmt.date2Str(startMonth, 'month')};
        startMonth.setMonth(startMonth.getMonth() - 11);

        var ret = [];
        $scope.options.month = [];
        for(var i=0; i<12; i++) {
            var curMonth = angular.copy(startMonth);
            curMonth.setMonth(startMonth.getMonth()+i);
            var monthStr = nl.fmt.date2Str(curMonth, 'month');
            ret.push(monthStr);
            $scope.options.month.push({id: monthStr, name: monthStr});
        }
        return ret;
    }
    
    function _getDailyChartLabels($scope) {
        var today = new Date();
        var startDate = new Date($scope.data.month.id);

        var ret = [];
        for(var i=1; i<=31; i++) {
            var curDate = angular.copy(startDate);
            curDate.setDate(i);
            if (curDate > today || curDate.getMonth() != startDate.getMonth()) break;
            ret.push(nl.fmt.date2Str(curDate, 'date'));
        }
        return ret;
    }
    
    function _onMontlyChartClicked($scope, elems) {
        if (!elems || !elems[0] || !elems[0].label) return;
        $scope.data.month = {id: elems[0].label};
        _onMonthChange($scope);
    }

    function _onMonthChange($scope) {
        $scope.chartDailyLabels = _getDailyChartLabels($scope);
        _updateChart($scope, 'obs', 'date');
        _updateChart($scope, 'rep', 'date');
        _updateTables($scope);
    }

    //---------------------------------------------------------------------------------------------
    // _processRnoList code: called everytime RnoData is received from server
    //---------------------------------------------------------------------------------------------
    function _processRnoList(rnoList, $scope) {
        _rnoList = _rnoList.concat(rnoList);
        for(var i=0; i<rnoList.length; i++) {
            var rno = rnoList[i];
            rno.config = rno.config ? angular.fromJson(rno.config) : {};
            rno.data = rno.data ? angular.fromJson(rno.data) : {};
            rno.name = _getName(rno);
            rno.cls = _getUtSec(rno);
            if (!(rno.cls in _classes)) _classes[rno.cls]= {};
            if (!(rno.name in _classes[rno.cls])) _classes[rno.cls][rno.name] = true;
            _updateObservationCount(rno, $scope);
            _updateReportCount(rno, $scope);
            _updateRatingCount(rno, $scope);
        }
        $scope.rnoCount = _rnoList.length;
        $scope.obsCount = _obsList.length;
        $scope.repCount = _repList.length;
    }

    function _getName(rno) {
        if (!rno.config.first_name) return rno.config.last_name || '';
        if (!rno.config.last_name) return rno.config.first_name || '';
        return nl.fmt2('{} {}', rno.config.first_name, rno.config.last_name);
    }

    function _getUtSec(rno) {
        if (!rno.config.section) return rno.config.user_type || '';
        if (!rno.config.user_type) return rno.config.section || '';
        return rno.config.user_type + '.' + rno.config.section;
    }

    function _updateObservationCount(rno, $scope) {
        var observations = rno.data.observations || [];
        for(var j=0; j<observations.length; j++) {
            var o = observations[j];
            var created = nl.fmt.json2Date(o.created);
            var sent = (o.sent && o.sent.sent_on) ? nl.fmt.json2Date(o.sent.sent_on) : '';
            var ratingsDone = o.ratings ? Object.keys(o.ratings).length : 0;
            _obsList.push({id: rno.id, centre: rno.config.centre,
                cls: rno.cls, name: rno.name, created: created, sent: sent, 
                ratingsDone: ratingsDone});
        }
    }

    function _updateReportCount(rno, $scope) {
        var reportsSent = rno.data.reportsSent || {};
        for(var key in reportsSent) {
            var report = reportsSent[key];
            if (report.type != 'report') continue;
            var sent = report.sent_on ? nl.fmt.json2Date(report.sent_on) : '';
            _repList.push({id: rno.id, centre: rno.config.centre,
                cls: rno.cls, name: rno.name, sent: sent});
        }
    }

    function _updateRatingCount(rno, $scope) {
        var obsRating = {};
        var observations = rno.data.observations || {};
        for(var i=observations.length-1; i>=0; i--) {
            var o = observations[i];
            var updated = nl.fmt.json2Date(o.updated);
            for(var r in o.ratings) {
                if (!(r in obsRating) || obsRating[r].updated < updated) {
                    obsRating[r] = {updated: updated, ratingLevel: o.ratings[r]};
                }
                var rinfo = _ratingInfo.get(r);
                _ratingList.push({id: rno.id, centre: rno.config.centre,
                    cls: rno.cls, name: rno.name, updated: updated,
                    ratingId: r, ratingName: rinfo.name, 
                    group2: rinfo.group2, group1: rinfo.group1,
                    ratingLevel: o.ratings[r],
                    ratingWt: _ratingInfo.getWt(o.ratings[r]),
                    src: 'observation'});
            }
        }

        var ratings = rno.data.ratings || {};
        var ratingsUpdatedOn = rno.data.ratingsUpdatedOn ? 
            nl.fmt.json2Date(rno.data.ratingsUpdatedOn) : nl.fmt.getPastDate();
        for(var r in ratings) {
            var ratingLevel = ratings[r];
            if (r in obsRating && ratingLevel == obsRating[r].ratingLevel) continue;
            var rinfo = _ratingInfo.get(r);
            _ratingList.push({id: rno.id, centre: rno.config.centre,
                cls: rno.cls, name: rno.name, updated: ratingsUpdatedOn,
                ratingId: r, ratingName: rinfo.name, 
                group2: rinfo.group2, group1: rinfo.group1,
                ratingLevel: ratingLevel,
                ratingWt: _ratingInfo.getWt(ratingLevel),
                src: 'report'});
        }
    }
    
    //---------------------------------------------------------------------------------------------
    // _updateStatistics code: called each time class/username filters change
    //---------------------------------------------------------------------------------------------
    function _updateStatistics($scope, clsFilter, nameFilter) {
        _monthToStats = {};
        _dateToStats = {};
        _userToStats = {};
        _updateStatisticsFromList(_obsList, $scope, clsFilter, nameFilter, 
            function(o, frequency) {
                if (frequency == 'month') _updateUserStats(o, 'obs');
                if (!o.created) return;
                var stats = _getDateToStats(o.created, frequency);
                stats.obsDone++;
                stats.ratingsDone += o.ratingsDone;
                if (!o.sent) return;
                stats = _getDateToStats(o.sent, frequency);
                stats.obsSent++;
            });
        _updateStatisticsFromList(_repList, $scope, clsFilter, nameFilter, 
            function(o, frequency) {
                if (frequency == 'month') _updateUserStats(o, 'rep');
                if (!o.sent) return;
                var stats = _getDateToStats(o.sent, frequency);
                stats.reportsSent++;
            });
        _updateChartsAndTables($scope);
        _updateRatingsChartAndTable($scope, clsFilter, nameFilter);
    }

    function _updateStatisticsFromList(lst, $scope, clsFilter, nameFilter, updateFn) {
        for(var i=0; i<lst.length; i++) {
            var o = lst[i];
            if ($scope.role == 'admin' && $scope.data.centre.id != o.centre) continue;
            if (clsFilter && clsFilter != o.cls) continue;
            if (nameFilter && nameFilter != o.name) continue;
            updateFn(o, 'month');
            updateFn(o, 'date');
        }
    }
    
    function _updateUserStats(o, type) {
        if (o.created) {
            var stats = _getUserToStats(o.created);
            stats.obs.push(o);
        }
        if (!o.sent) return;
        if (o.created && nl.fmt.date2Str(o.created, 'month') == nl.fmt.date2Str(o.sent, 'month')) return;
        var stats = _getUserToStats(o.sent);
        if (type == 'obs')
            stats.obs.push(o);
        else
            stats.rep.push(o);
    }

    function _getUserToStats(d) {
        var dateStr = nl.fmt.date2Str(d, 'month');
        if (!(dateStr in _userToStats)) _userToStats[dateStr] = {obs: [], rep: []};
        return _userToStats[dateStr];
    }

    function _getDateToStats(d, frequency) {
        var statsDict = (frequency == 'date') ? _dateToStats : _monthToStats;
        var dateStr = nl.fmt.date2Str(d, frequency);
        return _getDateToStatsImpl(dateStr, statsDict);
    }
    
    function _getDateToStatsImpl(dateStr, statsDict) {
        if (dateStr in statsDict) return statsDict[dateStr];
        statsDict[dateStr] = {obsDone: 0, ratingsDone: 0, obsSent: 0, reportsSent: 0};
        return statsDict[dateStr];
    }

    //---------------------------------------------------------------------------------------------
    // _updateChartsAndTables code: called each time class/username filters change or obs counters change
    //---------------------------------------------------------------------------------------------
    function _updateChartsAndTables($scope) {
        // Special case for multiple counter chart
        $scope.obsSelectedCounters = [];
        $scope.obsSelectedColors = [];
        for(var i=0; i<$scope.obsCounters.length; i++) {
            if (!$scope.obsShow[i]) continue;
            $scope.obsSelectedCounters.push($scope.obsCounters[i]);
            $scope.obsSelectedColors.push($scope.chartColors[i]);
        }
        _updateChart($scope, 'obs', 'month');
        _updateChart($scope, 'obs', 'date');
        _updateChart($scope, 'rep', 'month');
        _updateChart($scope, 'rep', 'date');
        _updateTables($scope);
    }

    function _updateChart($scope, type, frequency) {
        var labels = $scope.chartDailyLabels;
        var statsDict = _dateToStats;
        if (frequency == 'month') {
            labels = $scope.chartMonthlyLabels;
            statsDict = _monthToStats;
        }

        var data = [];
        if (type == 'obs') {
            for(var i=0; i<$scope.obsShow.length; i++)
                if ($scope.obsShow[i]) data.push([]);
        } else {
            data.push([]);
        }
        
        for(var i=0; i<labels.length; i++) {
            var d = _getDateToStatsImpl(labels[i], statsDict);
            _updateDataItem($scope, type, d, data);
        }
        nl.timeout(function() {
            $scope.chartData[type + '-' + frequency] = data;
        });
    }
    
    function _updateDataItem($scope, type, d, data) {
        if (type == 'rep') {
            data[0].push(d.reportsSent);
            return;
        }
        var pos = 0;
        if ($scope.obsShow[0]) {
            data[pos].push(d.obsDone);
            pos++;
        }
        if ($scope.obsShow[1]) {
            data[pos].push(d.obsSent);
            pos++;
        }
        if ($scope.obsShow[2]) {
            data[pos].push(d.ratingsDone);
            pos++;
        }
    }

    function _updateTables($scope) {
        $scope.statsObj = _monthToStats[$scope.data.month.id];
        $scope.obsList = [];
        $scope.repList = [];
        $scope.obsListIsHuge = false;
        $scope.repListIsHuge = false;

        var userStats = _userToStats[$scope.data.month.id];
        if (!userStats) return;
        if (userStats.obs.length > 500) {
            $scope.obsListIsHuge = true;
        } else {
            userStats.obs.sort(function(a, b) {
                return (a.created - b.created);
            });
            $scope.obsList = userStats.obs;
        }

        if (userStats.rep.length > 500) {
            $scope.repListIsHuge = true;
        } else {
            userStats.rep.sort(function(a, b) {
                return (a.sent - b.sent);
            });
            $scope.repList = userStats.rep;
        }
    }
    
    function _updateRatingsChartGroup1($scope) {
        var ratingInfo = $scope.ratingInfo;
        var currentGroup1 = ratingInfo.currentGroup1.id;
        
        var col=0;
        var chartData = [];
        var chartColumns = [];
        for(var i=1; i<ratingInfo.group1.length; i++) {
            var g1 = ratingInfo.group1[i];
            var show = !currentGroup1 || (currentGroup1 == g1.id);
            var maxCol = col + g1.colspan;
            while(col < maxCol) {
                ratingInfo.columnShown[col] = show;
                if (show) {
                    chartColumns.push(_trim(ratingInfo.columns[col], 40));
                    chartData.push(ratingInfo.ratingAvgs[col]);
                }
                col++;
            }
        }
        ratingInfo.chartData = [chartData];
        ratingInfo.chartColumns = chartColumns;
        ratingInfo.chartOptions = {scaleOverride: true, scaleStartValue: 0, 
            scaleStepWidth: 1, scaleSteps: _ratingInfo.getMaxRatings()};
    }
    
    function _updateRatingsList($scope, record, column) {
        var ratingInfo = $scope.ratingInfo;
        ratingInfo.ratingList = record.ratingLists[column];
    }

    function _updateRatingsChartAndTable($scope, clsFilter, nameFilter) {
        var columns = _ratingInfo.getGroup2();
        var ratingInfo = {
            columns: columns,
            onGroup1Change: function() {
                _updateRatingsChartGroup1($scope);
            },
            getColor: function(v) {
                return _ratingInfo.getColor(v);
            },
            onRecordClick: function(record, column) {
                _updateRatingsList($scope, record, column);
            },
            currentGroup1: {id: ''},
            levels: _ratingInfo.getLevels(),
            group1: _ratingInfo.getGroup1(),
            columnShown: _createArray(columns.length),
            ratingCounts: _createArray(columns.length),
            ratingSums: _createArray(columns.length),
            ratingAvgs: _createArray(columns.length),
            ratingList: [],
            chartCounters: ['Development Areas'],
            chartData: [],
            chartColumns: [],
            records: null
        };
        
        var records = {};
        for(var i=0; i<_ratingList.length; i++) {
            var r = _ratingList[i];
            if ($scope.role == 'admin' && $scope.data.centre.id != r.centre) continue;
            if (clsFilter && clsFilter != r.cls) continue;
            if (nameFilter && nameFilter != r.name) continue;
            
            if (!(r.id in records)) records[r.id] = {id: r.id, name: r.name, 
                ratingCounts: _createArray(columns.length), 
                ratingSums: _createArray(columns.length), 
                ratingAvgs: _createArray(columns.length),
                showDetails: _createArray(columns.length),
                ratingLists: _createArray(columns.length, 'array')};
            var record = records[r.id];
            for(var j=0; j<columns.length; j++) {
                var column = columns[j];
                if (r.group2 != columns[j]) continue;
                record.ratingCounts[j]++;
                record.ratingSums[j] += r.ratingWt;
                record.ratingLists[j].push(r);
                ratingInfo.ratingCounts[j]++;
                ratingInfo.ratingSums[j] += r.ratingWt;
            }
        }
        var recordList = [];
        for(var key in records) {
            var r = records[key];
            _computeAverages(r, columns);
            recordList.push(r);
        }
        recordList.sort(function(a, b) {
            return (a.name > b.name);
        });
        ratingInfo.records = recordList;
        _computeAverages(ratingInfo, columns);

        $scope.ratingInfo = ratingInfo;
        $scope.ratingListIsHuge = (ratingInfo.records.length > 500);
        _updateRatingsChartGroup1($scope);
    }

    function _createArray(count, type) {
        var ret = [];
        for(var i=0; i<count; i++) ret.push(type == 'array' ? [] : 0);
        return ret;
    }
    
    function _computeAverages(r, columns) {
        for(var i=0; i<columns.length; i++) {
            if (!r.ratingCounts[i]) continue;
            r.ratingAvgs[i] = Math.round(r.ratingSums[i] / r.ratingCounts[i] *10)/10;
        }
    }
    

    //---------------------------------------------------------------------------------------------
    // _onDownload code
    //---------------------------------------------------------------------------------------------
    function _onDownload($scope) {
        var zip = new JSZip();
        _createObsCsv(zip, 0);
    }
    
    var MAX_RECORDS_PER_CSV = 50000;
    
    function _createObsCsv(zip, chunkPos) {
        var neededChunks = Math.ceil(_obsList.length / MAX_RECORDS_PER_CSV);
        var msg = nl.fmt2('Creating observation list ({} of {}) for download', 
            chunkPos+1, neededChunks);
        nlDlg.popupStatus(msg, false);
        nl.timeout(function() {
            var obsHeaders = [
                {id: 'id', name: 'Id'},
                {id: 'centre', name: 'Centre'},
                {id: 'cls', name: 'Class'},
                {id: 'name', name: 'Name'},
                {id: 'created', name: 'Observed on', fmt: 'date'},
                {id: 'sent', name: 'Observation sent on', fmt: 'date'},
                {id: 'ratingsDone', name: 'Ratings done'}
            ];
            var startPos = chunkPos*MAX_RECORDS_PER_CSV;
            chunkPos++;
            var endPos = chunkPos*MAX_RECORDS_PER_CSV;
            var csvContent = nlExporter.objToCsv(_obsList, obsHeaders, null, startPos, endPos);
            zip.file(nl.fmt2('observations-{}.csv', chunkPos), csvContent);

            if (chunkPos < neededChunks) {
                _createObsCsv(zip, chunkPos);
            } else {
                _createRepCsv(zip, 0);
            }
        });
    }

    function _createRepCsv(zip, chunkPos) {
        var neededChunks = Math.ceil(_repList.length / MAX_RECORDS_PER_CSV);
        var msg = nl.fmt2('Creating report list ({} of {}) for download', 
            chunkPos+1, neededChunks);
        nlDlg.popupStatus(msg, false);
        nl.timeout(function() {
            var repHeaders = [
                {id: 'id', name: 'Id'},
                {id: 'centre', name: 'Centre'},
                {id: 'cls', name: 'Class'},
                {id: 'name', name: 'Name'},
                {id: 'sent', name: 'Report sent on', fmt: 'date'}
            ];
            var startPos = chunkPos*MAX_RECORDS_PER_CSV;
            chunkPos++;
            var endPos = chunkPos*MAX_RECORDS_PER_CSV;
            var csvContent = nlExporter.objToCsv(_repList, repHeaders, null, startPos, endPos);
            zip.file(nl.fmt2('reports-{}.csv', chunkPos), csvContent);

            if (chunkPos < neededChunks) {
                _createRepCsv(zip, chunkPos);
            } else {
                _createRatingCsv(zip, 0);
            }
        });
    }

    function _createRatingCsv(zip, chunkPos) {
        var neededChunks = Math.ceil(_ratingList.length / MAX_RECORDS_PER_CSV);
        var msg = nl.fmt2('Creating ratings list ({} of {}) for download', 
            chunkPos+1, neededChunks);
        nlDlg.popupStatus(msg, false);
        nl.timeout(function() {
            var ratingHeaders = [
                {id: 'id', name: 'Id'},
                {id: 'centre', name: 'Centre'},
                {id: 'cls', name: 'Class'},
                {id: 'name', name: 'Name'},
                {id: 'group1', name: 'Area'},
                {id: 'group2', name: 'Sub-area'},
                {id: 'ratingId', name: 'Milestone Id'},
                {id: 'ratingName', name: 'Milestone'},
                {id: 'ratingWt', name: 'Rating Number'},
                {id: 'ratingLevel', name: 'Rating'},
                {id: 'updated', name: 'Rated on', fmt: 'date'},
                {id: 'src', name: 'Rated In'}
            ];
            var startPos = chunkPos*MAX_RECORDS_PER_CSV;
            chunkPos++;
            var endPos = chunkPos*MAX_RECORDS_PER_CSV;
            var csvContent = nlExporter.objToCsv(_ratingList, ratingHeaders, null, startPos, endPos);
            zip.file(nl.fmt2('ratings-{}.csv', chunkPos), csvContent);

            if (chunkPos < neededChunks) {
                _createRatingCsv(zip, chunkPos);
            } else {
                _createZip(zip);
            }
        });
    }

    function _createZip(zip) {
        nlDlg.popupStatus('Creating zip file for download', false);
        nl.timeout(function() {
            zip.generateAsync({type:'blob', compression: 'DEFLATE', 
                compressionOptions:{level:9}})
            .then(function (zipContent) {
                nlDlg.popupStatus('Download initiated');
                saveAs(zipContent, 'stats.zip');
            }, function(e) {
                nlDlg.popdownStatus(0);
                nlDlg.popupAlert({title: 'Error', content: 'Error creating zip file: ' + e});
            });
        });
    }
}

//-------------------------------------------------------------------------------------------------
function RnoRatingInfo(nl, metadata) {
    var weights = {};
    var maxRatings = 0;
    var milestones = {};
    var levels = [];
    var group1 = [{name: 'All', id: '', colspan: 0}];
    var group2 = [];
    
    this.get = function(ratingId) {
        return milestones[ratingId] ||
            {id: ratingId, name: '', group1: '', group2: '', usertype: ''};
    };
    
    this.getWt = function(ratingLevel) {
        return weights[ratingLevel] || 0;
    };

    this.getLevels = function() {
        return levels;
    };
    
    this.getGroup1 = function() {
        return group1;
    };
    
    this.getGroup2 = function() {
        return group2;
    };
    
    var _colors = {
        0: 'rgba(128, 128, 128, 0.6)',
        1: 'rgba(200, 50, 0, 0.6)',
        2: 'rgba(200, 50, 0, 0.6)',
        3: 'rgba(200, 50, 0, 0.6)',
        4: 'rgba(200, 200, 0, 0.6)',
        5: 'rgba(200, 200, 0, 0.6)',
        6: 'rgba(200, 200, 0, 0.6)',
        7: 'rgba(50, 200, 0, 0.6)',
        8: 'rgba(50, 200, 0, 0.6)',
        9: 'rgba(50, 200, 0, 0.6)',
        10: 'rgba(0, 128, 0, 0.8)'
    };
    
    this.getColor = function(v) {
        if (!v) v = 0;
        if (v > maxRatings) v = maxRatings;
        var index = Math.round(v / maxRatings * 10);
        return _colors[index];
    };

    this.getMaxRatings = function(v) {
        return maxRatings;
    };
    
    function _init() {
        var mratings = metadata.ratings || [];
        for(var i=0; i<mratings.length; i++) {
            weights[mratings[i].id] = i+1;
            levels.push({wt: i+1, name: mratings[i].name});
        }
        maxRatings = mratings.length;
        var mmilestones = metadata.milestones || [];
        var g1Dict = {};
        var g2Dict = {};
        for(var i=0; i<mmilestones.length; i++) {
            var m = mmilestones[i];
            milestones[m.id] = m;

            var g1Item = null;
            if (!(m.group1 in g1Dict)) {
                g1Item = {name: m.group1, colspan: 0, id: m.group1};
                g1Dict[m.group1] = g1Item;
                group1.push(g1Item);
            } else {
                g1Item = g1Dict[m.group1];
            }

            var g2Item = null;
            if (!(m.group2 in g2Dict)) {
                g2Dict[m.group2] = true;
                g1Item.colspan++;
                group2.push(m.group2);
            }
        }
    }
    _init();
    
}

//-------------------------------------------------------------------------------------------------
function _formOption(options, defName) {
    options = Object.keys(options).sort();
    var ret = [];
    if (defName) ret.push({id: '', name: defName});
    for (var i=0; i<options.length; i++)
        ret.push({id: options[i], name: options[i]});
    return ret;
}

function _trim(str1, maxLen) {
    if (str1.length < maxLen) return str1;
    return str1.substring(0, maxLen-4) + ' ...';
}

module_init();
})();
(function() {

//-------------------------------------------------------------------------------------------------
// lr_completed_modules.js: Fetch completed module lsit for active learner count
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.learning_reports.others.lr_tms_view', [])
    .config(configFn)
    .controller('nl.TmsViewCtrl', TmsViewCtrl)
    .service('nlTmsView', TmsViewSrv);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.nht_report', {
        url: '^/nht_report',
        views: {
            'appContent': {
                templateUrl: 'view_controllers/learning_reports/others/lr_tms_view.html',
                controller: 'nl.TmsViewCtrl'
            }
        }});
}];

var TmsViewCtrl = ['$scope', 'nl', 'nlDlg', 'nlRouter', 'nlGroupInfo', 
'nlServerApi', 'nlExporter', 'nlTmsView', 'nlFileReader',
function($scope, nl, nlDlg, nlRouter, nlGroupInfo, nlServerApi, nlExporter, nlTmsView, nlFileReader) {
    var _groupInfo = null;
    var jsonObj = null;
    var _pastUserInfosFetcher = nlGroupInfo.getPastUserInfosFetcher();
    var _readFromFile = false;
    function _onPageEnter(userInfo) {
      return nl.q(function(resolve, reject) {
        nl.pginfo.pageTitle = nl.t('NHT batches');
        var params = nl.location.search();
        _readFromFile = (params.fromfile == '1'); 
        $scope.showFilterAndView = (params.debug == '1'); 
        nlGroupInfo.init2().then(function() {
          nlGroupInfo.update();
                  _groupInfo = nlGroupInfo.get();
                  _pastUserInfosFetcher.init(_groupInfo);
                  _init();
                  _fetchDataFromServer(resolve);
        }, function(err) {
          resolve(false);
        });
      });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);

    $scope.generateTmsArray = function(item) {
      if(!item.isFolder) return;
      item.isOpen = !item.isOpen;
      var allRow = $scope.nhtInfo.info.allRows[0];
      for (var i=0; i<allRow.children.length; i++) {
        var cntItem = allRow.children[i];
        if (cntItem.name == item.name) continue;
        cntItem.isOpen = false;
      }
      _updateVisibleTmsRows($scope.nhtInfo.info);  
    }

    $scope.onClickOnShowMore = function(item) {
      item.cnt.visible += $scope.nhtInfo.info.defMaxVisible;
      _updateVisibleTmsRows($scope.nhtInfo.info);  
    };
  
    $scope.onClickOnBatch = function(rec) {
      if (!rec.batchid) return;
      var url = nl.fmt2('#/learning_reports?type=course_assign&objid={}', rec.batchid);
      nl.window.open(url,'_blank');
    };

    $scope.getTmsContTabHeight = function() {
		var document = nl.window.document;
		var bodyElement = document.getElementsByClassName("nl-lr-tms-report-body")
        var topElem = document.getElementsByClassName("nl-lr-tms-top-section");
        var filterElem = document.getElementsByClassName("nl-lr-filter-section");
        var headerElem = document.getElementsByClassName("nl-lr-header-section");
        if (!filterElem[0]) filterElem = [{clientHeight: 0}];
		return (bodyElement[0].clientHeight - topElem[0].clientHeight - filterElem[0].clientHeight - headerElem[0].clientHeight - 18);
    };

    var ctx = {};
    var headers = null;
    $scope.exportTmsData = function() {
        nl.q(function(resolve, reject) {
            ctx = {};
            headers = null;
            headers = _getDefaultCols();
            headers = headers.concat(_getTmsCols());
            ctx.rows = [nlExporter.getCsvHeader(headers)];
            _export();
        });
    };

    $scope.onClickOnSearch = function(event) {
        _onSearch(event);
    };

    $scope.onClickOnClear = function(event) {
        $scope.searchObj.start = null;
        $scope.searchObj.end = null;
        $scope.searchObj.laststart = null;
        $scope.searchObj.lastend = null;
        _computeNhtTable();
    };

    $scope.getSelectedView = function() {
        if (!$scope.tableSelector) return '';
        var str = '';
        var selectedCount = 0;
        for (var i=0;i<$scope.tableSelector.length; i++) {
            if ($scope.tableSelector[i].selected) { 
                if (selectedCount > 0) str += ', ';
                str += $scope.tableSelector[i].name;
                selectedCount++;
            }
        }
        return str;
    }

    $scope.changeColumns = function() {
        var selected = false;
        for (var i=0; i<$scope.tableSelector.length; i++) {
            if ($scope.tableSelector[i].selected) selected = true;
        }
        if (!selected) {
            return nlDlg.popupAlert({title: 'Please select', template: 'Please select at least once default tab to view the table'});
        }
        $scope.toggleTableSelector = false;
        $scope.nhtInfo.info.columns = _getTmsCols();
    };

    function _getDefaultCols() {
        return [{id: 'all', name: 'Overall'}, {id: 'suborg', name: 'Sub-Org name'}, {id: 'batchname', name: 'Batch name'}];
    }

    function _export(resolve, reject) {
        try {
              var zip = new JSZip();
              _updateTmsRow();
              var fileName = nl.fmt2('tms-stats.csv');
              var content = nlExporter.getUtfCsv(ctx.rows);
              zip.file(fileName, content);
              nlExporter.saveZip(zip, 'tmsStats.zip', null, resolve, reject);      
            } catch(e) {
              console.error('Error while downloading', e);
              nlDlg.popupAlert({title: 'Error while downloading', template: e});
              reject(e);
        }
    }
    function _updateTmsRow() {
        var nhtStats = $scope.nhtStatusDict;
        for(var key in nhtStats) {
            var row = nhtStats[key];
            row.cnt['all'] = row.cnt.name;
            row.cnt['suborg'] = '';
            row.cnt['batchname'] = '';
            ctx.rows.push(nlExporter.getCsvRow(headers, row.cnt));
            if(row.children) _updateLevel1Rows(row.children);   
        }
    }

    function _updateLevel1Rows(level1Rows) {
        for(var key in level1Rows) {
            var row = level1Rows[key];
            row.cnt['all'] = '';
            row.cnt['suborg'] = row.cnt.name;
            row.cnt['batchname'] = '';
            ctx.rows.push(nlExporter.getCsvRow(headers, row.cnt));
            if(row.children) _updateLevel2Rows(row.children, row.cnt.name);
        }
    }

    function _updateLevel2Rows(level2Rows, subOrg) {
        for(var key in level2Rows) {
            var row = level2Rows[key];
            row.cnt['all'] = '';
            row.cnt['suborg'] = subOrg;
            row.cnt['batchname'] = row.cnt.name;
            ctx.rows.push(nlExporter.getCsvRow(headers, row.cnt));
        }
    }

    function _init() {
        jsonObj = null;
        $scope.searchObj = {start: null, end: null, placeHolder: 'Search based on Batch name/BatchId', laststart: '', lastend: '', canShow: false};
        $scope.tableSelector = [{id: 'default', name: 'Overview', selected: true}, {id: 'customScores', name: 'Custom scores', selected: true}];
    }


    function _onSearch() {
        if ($scope.searchObj.laststart == $scope.searchObj.start &&
            $scope.searchObj.lastend == $scope.searchObj.end) return;
        $scope.searchObj.laststart = $scope.searchObj.start;
        $scope.searchObj.lastend = $scope.searchObj.end;
        _computeNhtTable();
    }
    

    function _fetchDataFromServer(resolve) {
        $scope.nhtInfo = {};
        var data = {grpid: _groupInfo.grpid, table: 'lr_report', recid: 0, field:'nhtinfo.json'};
        var fetchFn = _readFromFile ? nlFileReader.loadAndReadFile : nlServerApi.jsonFieldStream;
        fetchFn(data).then(function(resp) {
            if (!resp || !resp.data) {
                resolve();
            }
            jsonObj = resp.data;
            jsonObj = angular.fromJson(jsonObj);
            $scope.headerTextStr = nl.t('Generated on {}', nl.fmt.date2StrDDMMYY(nl.fmt.json2Date(jsonObj.generatedOn),null, 'date'));
            _computeNhtTable();
            resolve(true);
        });
    }
    
    function _computeNhtTable() {
        nlTmsView.updateCounts(jsonObj.report, jsonObj.assignment, jsonObj.course, $scope.searchObj);
        $scope.nhtStatusDict = nlTmsView.getStatusCount();
        var allRows = _generateTmsArray();
        $scope.nhtInfo.info = {columns: _getTmsCols(), rows: [], allRows: allRows, defMaxVisible: 100};
        _updateVisibleTmsRows($scope.nhtInfo.info);
    }

    function _updateVisibleTmsRows(nhtInfo) {
      var _rows = [];
      nhtInfo.shown = 0;
      for(var i=0; i<nhtInfo.allRows.length; i++) {
        var row = nhtInfo.allRows[i];
        _rows.push(row);
        if (row.isOpen && row.children) 
            _addChildrenToRow(_rows, row);
        nhtInfo.shown += 1;
        if (!nhtInfo.visible) nhtInfo.visible = nhtInfo.defMaxVisible;
        if (nhtInfo.shown < nhtInfo.visible) continue;
        if (nhtInfo.visible < nhtInfo.allRows.length) {
            _rows.push({cnt: nhtInfo, showMoreLink: true});
            break;
        }
      }
      nhtInfo.rows = _rows;
    }
  
    function _addChildrenToRow(_rows, row) {
        var children = row.children || [];
        row.shown = 0;
        for(var i=0; i<children.length; i++) {
            var child = children[i];
            _rows.push(child);
            if (child.isOpen && child.children) {
                _addChildrenToRow(_rows, child);
            }
            row.shown += 1;
            if(!row.visible) row.visible = $scope.nhtInfo.info.defMaxVisible;
            if(row.shown < row.visible) continue;
            if (row.visible < row.children.length) {
                _rows.push({cnt: row, showMoreLink: true});
                break;
            }
        }
    }
  
    function _getTmsCols() {
        var columns = [];
        var customScores = nlTmsView.getCustomScores();
        columns.push({id: 'batchCount', name: 'Batch count', table: true, percid:'percTotal', smallScreen: true, background: 'bggrey', showAlways: true, hidePerc:true, type: 'all'});
        columns.push({id: 'cntTotal', name: 'Head count', table: true, percid:'percTotal', smallScreen: true, background: 'bggrey', showAlways: true, hidePerc:true, type: 'all'});
        columns.push({id: 'Training', name: 'Training', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'OJT', name: 'OJT', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'Certification', name: 'Certification', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'Re-certification', name: 'Re-certification', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'certified', name: 'Certified', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'Closed', name: 'Closed', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'failed', name: 'Failed', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'attrition', name: 'Attrition', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'nQuizzes', name: 'Number of applicable modules', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'nQuizzesCompleted', name: 'Number of completed modules', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'percCompletedLesson', name: 'Completion %', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'percAvgQuizScore', name: 'Assessment scores (Average of attempts)', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        for (var i=0; i<customScores.length; i++) {
            columns.push({id: 'perc'+customScores[i], name: customScores[i], table: true, background: 'nl-bg-blue', hidePerc:true, type: 'customScores'});
        }
        var defaultDict = {};
        for (var i=0; i<$scope.tableSelector.length; i++) {
            if ($scope.tableSelector[i].selected) defaultDict[$scope.tableSelector[i].id] = true;
        }
        var selectedCols = [];
        for (var i=0;i<columns.length; i++) {
            if (columns[i].type == 'all') selectedCols.push(columns[i]);
            if (columns[i].type in defaultDict) selectedCols.push(columns[i]);
        }
      return selectedCols;
    }

    function _generateTmsArray() {
        var nhtArray = [];
        var statusDict = $scope.nhtStatusDict;
        for(var key in statusDict) {
            var root = statusDict[key];
            if(key == 0) {
                root.cnt.style = 'nl-bg-dark-blue';
                root.cnt['sortkey'] = 0+root.cnt.name;
                root.cnt.isSummaryRow = true;
            }
      
            nhtArray.push(root.cnt);
            root.cnt.childCount = 0;
            root.cnt.isOpen = true;
            root.cnt.shown = 0;
            root.cnt.children = [];
            if (root.children) _addSuborgOrOusToDrilldownArray(root.cnt, nhtArray, root.children, root.cnt.sortkey, null);
        }
        nhtArray.sort(function(a, b) {
            if(b.sortkey.toLowerCase() < a.sortkey.toLowerCase()) return 1;
            if(b.sortkey.toLowerCase() > a.sortkey.toLowerCase()) return -1;
            if(b.sortkey.toLowerCase() == a.sortkey.toLowerCase()) return 0;				
        });
        return nhtArray;
    };
  
    function _addSuborgOrOusToDrilldownArray(folderitem, nhtArray, subOrgDict, sortkey) {
        for(var key in subOrgDict) {
            folderitem.childCount++;
            var org = subOrgDict[key];
                org.cnt['sortkey'] = sortkey+'.aa'+org.cnt.name;
                folderitem.children.push(org.cnt);
            if(org.children) {
                org.cnt.childCount = 0;
                org.cnt.shown = 0;
                org.cnt.children = [];
                org.cnt.isOpen = false;
                _addSuborgOrOusToDrilldownArray(org.cnt, nhtArray, org.children, org.cnt.sortkey);
            }
        }
    }
}];
//-------------------------------------------------------------------------------------------------
// StatsCount constructer which get update on each record read
//-------------------------------------------------------------------------------------------------

var TmsViewSrv = ['nl',
function(nl) {
    var tmsStats = new TmsStatsCounts();
    var self = this;

    this.getStatusCount = function() {
        return tmsStats.statsCountDict();     
    };

    this.getCustomScores = function() {
      return tmsStats.getCustomScores();
    }

    this.updateCounts = function(records, assignments, courses, searchObj) {
        tmsStats.clear();
        for (var suborg in records) {
            var subOrgObj = records[suborg];
            for (var batch in subOrgObj) {
                var batchObj = subOrgObj[batch];
                for (var rec in batchObj) {
                    var recObj = batchObj[rec];
                    var assignment = assignments[batch];
                    var level1Info = {id: suborg, name: suborg};
                    var level2Info = {id: batch, name: assignment.batchname};
                    if (!_doesPassFilter(assignment, searchObj)) continue;
                    self.addCount(recObj, level1Info, level2Info);
                }
            }
        }
    }

    function _doesPassFilter(assignment, searchObj) {
        if (!(searchObj.start || searchObj.end)) return true;
        var created = nl.fmt.json2Date(assignment.created);
        if (searchObj.start && searchObj.end && created >= searchObj.start && created <= searchObj.end) return true;
        if (!searchObj.start && searchObj.end && created <= searchObj.end) return true;
        if (!searchObj.end && searchObj.start && created >= searchObj.start) return true;
        return false;
    }

    this.addCount = function(record, level1Info, level2Info) {
        var statusCntObj = _getStatusCountObj(record);
        statusCntObj.assignment = level2Info.id;
        _addCount(level1Info, level2Info, statusCntObj);

    };

    function _addCount(level1Info, level2Info, statusObj) {
        tmsStats.updateRootCount(0, "All", statusObj);
        tmsStats.updateLevel1Count(0, level1Info, true, statusObj);
        tmsStats.updateLevel2Count(0, level1Info, level2Info, statusObj);
    }

    function _getStatusCountObj(rec) {
        var status = rec.status;
        var statsObj = {cntTotal: 1};
        if ('customScore' in rec) {
          var customScore = rec.customScore;
          for (var key in customScore) {
            if (customScore[key] == 'Green' || customScore[key] == 'Red' || customScore[key] == 'Amber') delete customScore[key];
          }
          statsObj['customScores'] = customScore;
        }
        if(status.indexOf('attrition') == 0) 
            statsObj['attrition'] = 1;
        else  
            statsObj[status] = 1;
        var quizSCoreDict = rec.qSD || {};
        statsObj['nQuizzes'] = quizSCoreDict.nQ || 0;
        statsObj['nQuizzesCompleted'] = quizSCoreDict.nQC || 0;
        if (quizSCoreDict.nQP === 0 || quizSCoreDict.nQP > 0) statsObj['nQuizScorePerc'] = quizSCoreDict.nQP || 0;
        return statsObj;
    }
}];

function TmsStatsCounts(nl) {
    var _statusCountTree = {};
    var self = this;
    var statsCountItem = {'cntTotal': 0, 'Training': 0, 'OJT': 0, 'Certification': 0, 'Re-certification': 0, 
                          'certified': 0, 'Closed': 0, 'isOpen': false, 'attrition': 0, 'failed': 0, 'nQuizzes': 0, 'nQuizzesCompleted': 0, 
                          'nQuizScorePerc': 0, 'nQuizPercScoreCount' : 0, batchCounted: {}, batchCount: 0};
    var defaultStates = angular.copy(statsCountItem);
    var _dynamicStates = {};
    var _customScores = {};
    var _customScoresArray = [];

    this.clear = function() {
        _statusCountTree = {};
        _dynamicStates = {};
        _customScores = {};
        _customScoresArray = [];
    };

    this.statsCountDict = function() {
        _updateStatsCountTree(null, _statusCountTree);
        var allRow = _statusCountTree[0];
        allRow.cnt.contPercQS = 0;
        allRow.cnt.percQS = 0;

        for (var child in allRow.children) {
            var suborg = allRow.children[child]
            var cnt = suborg.cnt;
            var percScore = Math.round(cnt.percQS/cnt.contPercQS);
            if (percScore >= 0) {
                allRow.cnt.contPercQS += 1;
                allRow.cnt.percQS += percScore;
            }
        }
        var perc = Math.round(allRow.cnt.percQS/allRow.cnt.contPercQS);
        allRow.cnt['percAvgQuizScore'] =  perc >= 0 ? perc+'%' : '-';
        return _statusCountTree;
    };

    this.getCustomScores = function() {
        return _customScoresArray;
    };
    this.getRoot = function(rootId, name) {
        if (rootId in _statusCountTree) return _statusCountTree[rootId].cnt;
        var stats = angular.copy(statsCountItem);
        stats['isFolder'] = true;
        stats['name'] = rootId == 0 ? 'All' : name;
        _statusCountTree[rootId] = {cnt: stats, children: {}};
        return _statusCountTree[rootId].cnt;
    };

    this.getLevel1Node = function(rootId, itemInfo, isFolder) {
        var siblings = _statusCountTree[rootId].children;
        var itemId = itemInfo.id;
        if (itemId in siblings) return siblings[itemId].cnt;
        var stats = angular.copy(statsCountItem);
        stats['isFolder'] = isFolder;
        stats['indentation'] = 24;
        stats['name'] = itemInfo.name;
        siblings[itemId] = {cnt: stats};
        if(isFolder) siblings[itemId]['children'] = {}
        return siblings[itemId].cnt;
    };

    this.getLevel2Node = function(rootId, parentInfo, itemInfo) {
        var siblings = _statusCountTree[rootId].children[parentInfo.id].children;
        var itemId = itemInfo.id;
        if (itemId in siblings) return siblings[itemId].cnt;
        var stats = angular.copy(statsCountItem);
        stats['indentation'] = 44;
        stats['name'] = itemInfo.name;
        stats['batchid'] = itemId;
        siblings[itemId] = {cnt: stats};
        return siblings[itemId].cnt;
    };

    this.updateRootCount = function(rootId, name, statusCnt) {
        var updatedStats = self.getRoot(rootId, name);
        _updateStatsCount(updatedStats, statusCnt);
    }

    this.updateLevel1Count = function(rootId, level1Info, isFolder, statusCnt) {
        var updatedStats = self.getLevel1Node(rootId, level1Info, isFolder);
        _updateStatsCount(updatedStats, statusCnt);
    }

    this.updateLevel2Count = function(rootId, level1Info, level2Info, statusCnt) {
        var updatedStats = self.getLevel2Node(rootId, level1Info, level2Info);
        _updateStatsCount(updatedStats, statusCnt);
    } 

    function _updateStatsCount(updatedStats, statusCnt) { 
        for(var key in statusCnt) {
            if (key == 'assignment') {
                if (statusCnt[key] in updatedStats.batchCounted) continue;
                updatedStats.batchCount += 1;
                updatedStats.batchCounted[statusCnt[key]] = true;
            }
            if(key == 'customScores') {
                var customScores = statusCnt[key]
                for(var cust in customScores) {
                    var item = {name: cust, score: customScores[cust]};
                    var cntid = item.name+'count';
                    if(!(item.name in _customScores)) {
                        _customScores[item.name] = true;
                        _customScoresArray.push(item.name)
                    }
                    if(!(item.name in updatedStats)) {
                        updatedStats[item.name] = item.score;
                        updatedStats[cntid] = 1;
                    } else {
                        updatedStats[item.name] += item.score;
                        updatedStats[cntid] += 1;
                    }
                }
                continue;
            }
            if(!(key in updatedStats)) {
                _dynamicStates[key] = true;
                updatedStats[key] = 0;
            }
            updatedStats[key] += statusCnt[key];
            if (key == 'nQuizScorePerc') updatedStats['nQuizPercScoreCount'] += 1;
        }
    }

    function _updateStatsCountTree(parentRow, rowObjs) {
        for(var key in rowObjs) {
            var row = rowObjs[key];
            var statsObj = row.cnt;
            _updateStatsPercs(parentRow, statsObj)
            if(row.children) _updateStatsCountTree(row.cnt, row.children);
        }
    }

    function _updateStatsPercs(parentRow, updatedStats) {
        updatedStats['percCompletedLesson'] = updatedStats['nQuizzes'] > 0 ? Math.round(updatedStats['nQuizzesCompleted']*100/updatedStats['nQuizzes'])+'%' : '-';
        var percScore = -1;
        if (updatedStats['nQuizPercScoreCount'] > 0) {
            percScore = Math.round(updatedStats['nQuizScorePerc']/updatedStats['nQuizPercScoreCount']);         
        }
        if (parentRow && percScore >= 0) {
            if (!parentRow.contPercQS) parentRow.contPercQS = 0;
            if (!parentRow.percQS) parentRow.percQS = 0;
            parentRow.contPercQS += 1;
            parentRow.percQS += percScore;
            var percQS = Math.round(parentRow.percQS/parentRow.contPercQS);
            parentRow['percAvgQuizScore'] = percQS >= 0 ? percQS+'%' : '-';
        }
        updatedStats['percAvgQuizScore'] = percScore >= 0 ? percScore+'%' : '-';
        for(var key in _dynamicStates) {
                if(!(key in defaultStates)) {
                    var attr = 'perc'+key;
                    updatedStats[attr] = Math.round(updatedStats[key]*100/updatedStats.cntTotal);
                }
            }

        for(var i=0; i<_customScoresArray.length; i++) {
            var itemName = _customScoresArray[i];
            if(!(itemName in updatedStats)) continue;
            var percid = 'perc'+itemName;
            var count = itemName+'count';
            updatedStats[percid] = Math.round(updatedStats[itemName]/updatedStats[count])+' %';
        }
    }
}
//-------------------------------------------------------------------------------------------------
module_init();
})();

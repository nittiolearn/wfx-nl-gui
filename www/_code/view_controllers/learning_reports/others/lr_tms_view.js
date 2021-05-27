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
'nlServerApi', 'nlExporter', 'nlTmsView',
function($scope, nl, nlDlg, nlRouter, nlGroupInfo, nlServerApi, nlExporter, nlTmsView) {
    var _groupInfo = null;
    var jsonObj = null;
    var _pastUserInfosFetcher = nlGroupInfo.getPastUserInfosFetcher();
    function _onPageEnter(userInfo) {
      return nl.q(function(resolve, reject) {
        nl.pginfo.pageTitle = nl.t('NHT batches');
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
        $scope.tableSelector = [{id: 'default', name: 'Overview', selected: true}, {id: 'customScores', name: 'Custom scores', selected: false}];
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
        // nlServerApi.jsonFieldStream(data).then(function(resp) {
        //     if (!resp || !resp.data) {
        //         resolve();
        //     }
          jsonObj = _fetchDataFrom || resp.data;
          jsonObj = angular.fromJson(jsonObj);
          $scope.headerTextStr = nl.t('Generated on {}', nl.fmt.date2StrDDMMYY(nl.fmt.json2Date(jsonObj.generatedOn),null, 'date'));
          _computeNhtTable();
          resolve(true);
        // });
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
        _updateStatsCountTree(_statusCountTree);
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

    function _updateStatsCountTree(rowObjs) {
        for(var key in rowObjs) {
            var row = rowObjs[key];
            var statsObj = row.cnt;
            _updateStatsPercs(statsObj)
            if(row.children) _updateStatsCountTree(row.children);
        }
    }

    function _updateStatsPercs(updatedStats) {
      updatedStats['percCompletedLesson'] = updatedStats['nQuizzes'] > 0 ? Math.round(updatedStats['nQuizzesCompleted']*100/updatedStats['nQuizzes'])+'%' : '-';
      updatedStats['percAvgQuizScore'] = updatedStats['nQuizPercScoreCount'] > 0 ? Math.round(updatedStats['nQuizScorePerc']/updatedStats['nQuizPercScoreCount'])+'%' : '-';
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
var _fetchDataFrom = {"report": {"INHOUSE": {"5088817193156608": {"6034555267973120": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "hannahwright"}, "4697549128597504": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "richardsteward"}, "5964186523795456": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "preethi"}, "5260499082018816": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "johnwilson"}, "6386398988861440": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "marknelson"}, "4979024105308160": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "patriciascott"}, "5823449035440128": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "jamesjohnson"}, "4838286616952832": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "donnaevans"}, "5190130337841152": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "helenturner"}, "6667873965572096": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "catherineedwards"}, "6245661500506112": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "laura"}, "5541974058729472": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "sarahmorgan"}, "6527136477216768": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "kennethbailey"}, "5401236570374144": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "jeffparker"}, "4627180384419840": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "elizabeth"}, "4908655361130496": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "susanrodriguez"}, "6104924012150784": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "sharonmorris"}, "6316030244683776": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "deborahward"}, "5471605314551808": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "janewalker"}, "5753080291262464": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "sarahbrooks"}, "6597505221394432": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "ruthstewart"}, "4767917872775168": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5088817193156608, "cid": 4754005232189440, "sid": "193a"}}, "5740357104959488": {"4606979827826688": {"qSD": {"nQ": 2, "nQC": 1, "nQP": 100}, "customScore": {"RAG Rating 1": "Green", "PCD Score : OJT Day 3": 76, "4C Score : OJT Day 3": 87, "PCD Score  : OJT Day 4": 88, "4C Score : OJT Day 4": 84, "PCD Score : OJT Day 5": 71, "4C Score : OJT Day 5": 89, "PCD Score : OJT Day 6": 78, "4C Score : OJT Day 6": 89, "PCD Score : OJT Day 7": 76, "4C Score : OJT Day 7": 73, "Gate : OJT Passed": 81}, "status": "certified", "aid": 5740357104959488, "cid": 6275388261007360, "sid": "shama"}, "4888454804537344": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score : OJT Day 3": 76, "4C Score : OJT Day 3": 87, "PCD Score  : OJT Day 4": 88, "4C Score : OJT Day 4": 84, "PCD Score : OJT Day 5": 71, "4C Score : OJT Day 5": 89, "PCD Score : OJT Day 6": 78, "4C Score : OJT Day 6": 89, "PCD Score : OJT Day 7": 76, "4C Score : OJT Day 7": 73, "Gate : OJT Passed": 81}, "status": "Certification", "aid": 5740357104959488, "cid": 6275388261007360, "sid": "samuelmiller"}, "4958823548715008": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Red", "PCD Score : OJT Day 3": 76, "4C Score : OJT Day 3": 87, "PCD Score  : OJT Day 4": 88, "4C Score : OJT Day 4": 84, "PCD Score : OJT Day 5": 71, "4C Score : OJT Day 5": 89, "PCD Score : OJT Day 6": 78, "4C Score : OJT Day 6": 89, "PCD Score : OJT Day 7": 76, "4C Score : OJT Day 7": 73, "Gate : OJT Passed": 81}, "status": "Certification", "aid": 5740357104959488, "cid": 6275388261007360, "sid": "srilakshmi"}, "5169929781248000": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "certified", "aid": 5740357104959488, "cid": 6275388261007360, "sid": "trina"}, "6366198432268288": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score : OJT Day 3": 76, "4C Score : OJT Day 3": 87, "PCD Score  : OJT Day 4": 88, "4C Score : OJT Day 4": 84, "PCD Score : OJT Day 5": 71, "4C Score : OJT Day 5": 89, "PCD Score : OJT Day 6": 78, "4C Score : OJT Day 6": 89, "PCD Score : OJT Day 7": 76, "4C Score : OJT Day 7": 73, "Gate : OJT Passed": 81}, "status": "Certification", "aid": 5740357104959488, "cid": 6275388261007360, "sid": "nithya"}, "6647673408978944": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score : OJT Day 3": 76, "4C Score : OJT Day 3": 87, "PCD Score  : OJT Day 4": 88, "4C Score : OJT Day 4": 84, "PCD Score : OJT Day 5": 71, "4C Score : OJT Day 5": 89, "PCD Score : OJT Day 6": 78, "4C Score : OJT Day 6": 89, "PCD Score : OJT Day 7": 76, "4C Score : OJT Day 7": 73, "Gate : OJT Passed": 81}, "status": "Certification", "aid": 5740357104959488, "cid": 6275388261007360, "sid": "nancyparker"}}, "5727630831648768": {"6669078670344192": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 88, "PCD Score : Call 1": 0, "4C Score: Call 1": 87, "PCD Score: Call 2": 0, "4C Score : Call 2": 88, "PCD Score: Call 3": 87, "4C Score: Call 3": 86, "PCD Score : Call 4": 85, "4C Score : Call 4": 89, "PCD Score : Call 5": 90, "4C Score : Call 5": 87, "Certification score": 0, "PCD Score : Call 1 recer": 0, "4C Score : Call 1 recer": 89, "PCD Score : Call 2 recer": 0, "4C Score : Call 2 recer": 88, "PCD Score : Call 3 recer": 88, "4C Score : Call 3 recer": 88, "PCD Score: Call 4 recer": 99, "4C Score: Call 4 recer": 98, "PCD Score : Call 5 recer": 99, "4C Score : Call 5 recer": 98, "Re-certification Score": 0}, "status": "failed", "aid": 5727630831648768, "cid": 5221323890491392, "sid": "annbell"}, "5754284996034560": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 88, "PCD Score : Call 1": 0, "4C Score: Call 1": 87, "PCD Score: Call 2": 0, "4C Score : Call 2": 88, "PCD Score: Call 3": 87, "4C Score: Call 3": 86, "PCD Score : Call 4": 85, "4C Score : Call 4": 89, "PCD Score : Call 5": 90, "4C Score : Call 5": 87, "Certification score": 0, "PCD Score : Call 1 recer": 8, "4C Score : Call 1 recer": 89, "PCD Score : Call 2 recer": 8, "4C Score : Call 2 recer": 88, "PCD Score : Call 3 recer": 88, "4C Score : Call 3 recer": 88, "PCD Score: Call 4 recer": 99, "4C Score: Call 4 recer": 98, "PCD Score : Call 5 recer": 99, "4C Score : Call 5 recer": 98, "Re-certification Score": 92}, "status": "certified", "aid": 5727630831648768, "cid": 5221323890491392, "sid": "charlesbarnes"}, "4980228810080256": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 88, "PCD Score : Call 1": 87, "4C Score: Call 1": 87, "PCD Score: Call 2": 90, "4C Score : Call 2": 88, "PCD Score: Call 3": 87, "4C Score: Call 3": 86, "PCD Score : Call 4": 85, "4C Score : Call 4": 89, "PCD Score : Call 5": 90, "4C Score : Call 5": 87, "Certification score": 87}, "status": "certified", "aid": 5727630831648768, "cid": 5221323890491392, "sid": "danielmiller"}, "4628385089191936": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 88, "PCD Score : Call 1": 87, "4C Score: Call 1": 87, "PCD Score: Call 2": 90, "4C Score : Call 2": 88, "PCD Score: Call 3": 87, "4C Score: Call 3": 86, "PCD Score : Call 4": 85, "4C Score : Call 4": 89, "PCD Score : Call 5": 90, "4C Score : Call 5": 87, "Certification score": 87}, "status": "certified", "aid": 5727630831648768, "cid": 5221323890491392, "sid": "henrywilliams"}, "5824653740212224": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Red", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 88, "PCD Score : Call 1": 87, "4C Score: Call 1": 87, "PCD Score: Call 2": 90, "4C Score : Call 2": 88, "PCD Score: Call 3": 87, "4C Score: Call 3": 86, "PCD Score : Call 4": 85, "4C Score : Call 4": 89, "PCD Score : Call 5": 90, "4C Score : Call 5": 87, "Certification score": 87}, "status": "certified", "aid": 5727630831648768, "cid": 5221323890491392, "sid": "kimberlymurphy"}, "6387603693633536": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 88, "PCD Score : Call 1": 87, "4C Score: Call 1": 87, "PCD Score: Call 2": 90, "4C Score : Call 2": 88, "PCD Score: Call 3": 87, "4C Score: Call 3": 86, "PCD Score : Call 4": 85, "4C Score : Call 4": 89, "PCD Score : Call 5": 90, "4C Score : Call 5": 87, "Certification score": 87}, "status": "certified", "aid": 5727630831648768, "cid": 5221323890491392, "sid": "jasonmiller"}, "5191335042613248": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Amber"}, "status": "attrition-OJT", "aid": 5727630831648768, "cid": 5221323890491392, "sid": "lindagreen"}, "5543178763501568": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 88, "PCD Score : Call 1": 87, "4C Score: Call 1": 87, "PCD Score: Call 2": 90, "4C Score : Call 2": 88, "PCD Score: Call 3": 87, "4C Score: Call 3": 86, "PCD Score : Call 4": 85, "4C Score : Call 4": 89, "PCD Score : Call 5": 90, "4C Score : Call 5": 87, "Certification score": 87}, "status": "certified", "aid": 5727630831648768, "cid": 5221323890491392, "sid": "kevinyoung"}, "5261703786790912": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 88, "PCD Score : Call 1": 87, "4C Score: Call 1": 87, "PCD Score: Call 2": 90, "4C Score : Call 2": 88, "PCD Score: Call 3": 87, "4C Score: Call 3": 86, "PCD Score : Call 4": 85, "4C Score : Call 4": 89, "PCD Score : Call 5": 90, "4C Score : Call 5": 87, "Certification score": 87}, "status": "certified", "aid": 5727630831648768, "cid": 5221323890491392, "sid": "karenmartinez"}, "6317234949455872": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 88, "PCD Score : Call 1": 87, "4C Score: Call 1": 87, "PCD Score: Call 2": 90, "4C Score : Call 2": 88, "PCD Score: Call 3": 87, "4C Score: Call 3": 86, "PCD Score : Call 4": 85, "4C Score : Call 4": 89, "PCD Score : Call 5": 90, "4C Score : Call 5": 87, "Certification score": 87}, "status": "certified", "aid": 5727630831648768, "cid": 5221323890491392, "sid": "georgebrown"}}, "4861601830141952": {"5592965219090432": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 4861601830141952, "cid": 6275388261007360, "sid": "susanallen"}}, "5714560843513856": {"4808370794004480": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"PCD Score 1": 76}, "status": "Training", "aid": 5714560843513856, "cid": 4754005232189440, "sid": "eveeta1"}, "5371320747425792": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5714560843513856, "cid": 4754005232189440, "sid": "mariagarcia"}, "5934270700847104": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5714560843513856, "cid": 4754005232189440, "sid": "henrywilson"}}, "5664957511237632": {"5640745639739392": {"qSD": {"nQ": 2, "nQC": 1, "nQP": 100}, "customScore": {"RAG Rating 1": "Green", "PCD Score : OJT Day 3": 76, "4C Score : OJT Day 3": 78, "PCD Score  : OJT Day 4": 70, "4C Score : OJT Day 4": 70, "PCD Score : OJT Day 5": 67, "4C Score : OJT Day 5": 56, "PCD Score : OJT Day 6": 67, "4C Score : OJT Day 6": 64, "PCD Score : OJT Day 7": 63, "4C Score : OJT Day 7": 56, "Gate : OJT Passed": 64, "PCD Score : Repeat OJT Day 1": 76, "4C Score : Repeat OJT Day 1": 77, "PCD Score : Repeat OJT Day 2": 77, "4C Score : Repeat OJT Day 2": 78, "Gate : Repeat OJT passed": 77}, "status": "certified", "aid": 5664957511237632, "cid": 6275388261007360, "sid": "paulking"}}, "5845518936702976": {"4574923064344576": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green"}, "status": "OJT", "aid": 5845518936702976, "cid": 5221323890491392, "sid": "richa"}, "4926766785232896": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 89, "4C Score : OJT Day 1": 88, "PCD Score : Call 1": 89, "4C Score: Call 1": 89, "PCD Score: Call 2": 2, "4C Score : Call 2": 89, "PCD Score: Call 3": 7, "4C Score: Call 3": 67, "PCD Score : Call 4": 7, "4C Score : Call 4": 98, "PCD Score : Call 5": 8, "4C Score : Call 5": 98, "Certification score": 88}, "status": "certified", "aid": 5845518936702976, "cid": 5221323890491392, "sid": "radhika"}, "5137873017765888": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green"}, "status": "attrition-OJT", "aid": 5845518936702976, "cid": 5221323890491392, "sid": "shoba"}, "5489716738654208": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Red", "PCD Score: OJT Day 1": 45, "4C Score : OJT Day 1": 24, "PCD Score : Call 1": 0, "4C Score: Call 1": 89, "PCD Score: Call 2": 0, "4C Score : Call 2": 89, "PCD Score: Call 3": 7, "4C Score: Call 3": 67, "PCD Score : Call 4": 7, "4C Score : Call 4": 98, "PCD Score : Call 5": 8, "4C Score : Call 5": 98, "Certification score": 0, "PCD Score : Call 1 recer": 0, "4C Score : Call 1 recer": 67, "PCD Score : Call 2 recer": 0, "4C Score : Call 2 recer": 88, "PCD Score : Call 3 recer": 7, "4C Score : Call 3 recer": 89, "PCD Score: Call 4 recer": 6, "4C Score: Call 4 recer": 89, "PCD Score : Call 5 recer": 6, "4C Score : Call 5 recer": 78, "Re-certification Score": 0}, "status": "failed", "aid": 5845518936702976, "cid": 5221323890491392, "sid": "krithika"}, "6052666692075520": {"qSD": {"nQ": 5, "nQC": 3, "nQP": 20}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 89, "4C Score : OJT Day 1": 88, "PCD Score : Call 1": 89, "4C Score: Call 1": 89, "PCD Score: Call 2": 2, "4C Score : Call 2": 89, "PCD Score: Call 3": 7, "4C Score: Call 3": 67, "PCD Score : Call 4": 7, "4C Score : Call 4": 98, "PCD Score : Call 5": 8, "4C Score : Call 5": 98, "Certification score": 88}, "status": "certified", "aid": 5845518936702976, "cid": 5221323890491392, "sid": "shweta"}, "6263772924608512": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 89, "4C Score : OJT Day 1": 88, "PCD Score : Call 1": 0, "4C Score: Call 1": 89, "PCD Score: Call 2": 0, "4C Score : Call 2": 89, "PCD Score: Call 3": 7, "4C Score: Call 3": 67, "PCD Score : Call 4": 7, "4C Score : Call 4": 98, "PCD Score : Call 5": 8, "4C Score : Call 5": 98, "Certification score": 0, "PCD Score : Call 1 recer": 8, "4C Score : Call 1 recer": 89, "PCD Score : Call 2 recer": 89, "4C Score : Call 2 recer": 88, "PCD Score : Call 3 recer": 7, "4C Score : Call 3 recer": 89, "PCD Score: Call 4 recer": 6, "4C Score: Call 4 recer": 89, "PCD Score : Call 5 recer": 6, "4C Score : Call 5 recer": 78, "Re-certification Score": 87}, "status": "certified", "aid": 5845518936702976, "cid": 5221323890491392, "sid": "priya"}, "6334141668786176": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Amber"}, "status": "Training", "aid": 5845518936702976, "cid": 5221323890491392, "sid": "arpita"}, "6615616645496832": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green"}, "status": "Training", "aid": 5845518936702976, "cid": 5221323890491392, "sid": "pramod"}}, "4743752960704512": {"5184937957261312": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 4743752960704512, "cid": 5681008005349376, "sid": "georgebrown1"}}}, "LOCATION 3": {"4923714640543744": {"5286630250250240": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 87, "PCD Score : Call 1": 89, "4C Score: Call 1": 90, "PCD Score: Call 2": 89, "4C Score : Call 2": 87, "PCD Score: Call 3": 86, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 84, "PCD Score : Call 5": 86, "4C Score : Call 5": 82, "Certification score": 86}, "status": "certified", "aid": 4923714640543744, "cid": 5221323890491392, "sid": "ishvari"}, "6236608296648704": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 87, "PCD Score : Call 1": 89, "4C Score: Call 1": 90, "PCD Score: Call 2": 89, "4C Score : Call 2": 87, "PCD Score: Call 3": 86, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 84, "PCD Score : Call 5": 86, "4C Score : Call 5": 82, "Certification score": 86}, "status": "certified", "aid": 4923714640543744, "cid": 5221323890491392, "sid": "arjun2"}, "5990317692026880": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 87, "PCD Score : Call 1": 89, "4C Score: Call 1": 90, "PCD Score: Call 2": 89, "4C Score : Call 2": 87, "PCD Score: Call 3": 86, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 84, "PCD Score : Call 5": 86, "4C Score : Call 5": 82, "Certification score": 86}, "status": "certified", "aid": 4923714640543744, "cid": 5221323890491392, "sid": "avinash"}, "5568105226960896": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 87, "PCD Score : Call 1": 89, "4C Score: Call 1": 90, "PCD Score: Call 2": 89, "4C Score : Call 2": 87, "PCD Score: Call 3": 86, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 84, "PCD Score : Call 5": 86, "4C Score : Call 5": 82, "Certification score": 86}, "status": "certified", "aid": 4923714640543744, "cid": 5221323890491392, "sid": "ishika"}, "5673658343227392": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 87, "PCD Score : Call 1": 89, "4C Score: Call 1": 90, "PCD Score: Call 2": 89, "4C Score : Call 2": 87, "PCD Score: Call 3": 86, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 84, "PCD Score : Call 5": 86, "4C Score : Call 5": 82, "Certification score": 86}, "status": "certified", "aid": 4923714640543744, "cid": 5221323890491392, "sid": "meenakshi"}, "4829233413095424": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Red"}, "status": "attrition-OJT", "aid": 4923714640543744, "cid": 5221323890491392, "sid": "ritisha"}, "6553267645448192": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 87, "PCD Score : Call 1": 0, "4C Score: Call 1": 90, "PCD Score: Call 2": 0, "4C Score : Call 2": 87, "PCD Score: Call 3": 86, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 84, "PCD Score : Call 5": 86, "4C Score : Call 5": 82, "Certification score": 0, "PCD Score : Call 1 recer": 80, "4C Score : Call 1 recer": 89, "PCD Score : Call 2 recer": 8, "4C Score : Call 2 recer": 78, "PCD Score : Call 3 recer": 98, "4C Score : Call 3 recer": 87, "PCD Score: Call 4 recer": 82, "4C Score: Call 4 recer": 84, "PCD Score : Call 5 recer": 82, "4C Score : Call 5 recer": 81, "Re-certification Score": 84}, "status": "certified", "aid": 4923714640543744, "cid": 5221323890491392, "sid": "anvi"}, "4723680296828928": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 87, "PCD Score : Call 1": 89, "4C Score: Call 1": 90, "PCD Score: Call 2": 89, "4C Score : Call 2": 87, "PCD Score: Call 3": 86, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 84, "PCD Score : Call 5": 86, "4C Score : Call 5": 82, "Certification score": 86}, "status": "certified", "aid": 4923714640543744, "cid": 5221323890491392, "sid": "mehak2"}, "5955133319938048": {"qSD": {"nQ": 6, "nQC": 6, "nQP": 10}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 87, "PCD Score : Call 1": 89, "4C Score: Call 1": 90, "PCD Score: Call 2": 89, "4C Score : Call 2": 87, "PCD Score: Call 3": 86, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 84, "PCD Score : Call 5": 86, "4C Score : Call 5": 82, "Certification score": 86}, "status": "certified", "aid": 4923714640543744, "cid": 5221323890491392, "sid": "naren"}, "4547758436384768": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 87, "PCD Score : Call 1": 0, "4C Score: Call 1": 90, "PCD Score: Call 2": 0, "4C Score : Call 2": 87, "PCD Score: Call 3": 86, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 84, "PCD Score : Call 5": 86, "4C Score : Call 5": 82, "Certification score": 0, "PCD Score : Call 1 recer": 0, "4C Score : Call 1 recer": 89, "PCD Score : Call 2 recer": 0, "4C Score : Call 2 recer": 78, "PCD Score : Call 3 recer": 98, "4C Score : Call 3 recer": 87, "PCD Score: Call 4 recer": 82, "4C Score: Call 4 recer": 84, "PCD Score : Call 5 recer": 82, "4C Score : Call 5 recer": 81, "Re-certification Score": 0}, "status": "failed", "aid": 4923714640543744, "cid": 5221323890491392, "sid": "aaron"}, "6694005133803520": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 87, "PCD Score : Call 1": 89, "4C Score: Call 1": 90, "PCD Score: Call 2": 89, "4C Score : Call 2": 87, "PCD Score: Call 3": 86, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 84, "PCD Score : Call 5": 86, "4C Score : Call 5": 82, "Certification score": 86}, "status": "certified", "aid": 4923714640543744, "cid": 5221323890491392, "sid": "mehek"}, "5849580203671552": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 87, "PCD Score : Call 1": 89, "4C Score: Call 1": 90, "PCD Score: Call 2": 89, "4C Score : Call 2": 87, "PCD Score: Call 3": 86, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 84, "PCD Score : Call 5": 86, "4C Score : Call 5": 82, "Certification score": 86}, "status": "certified", "aid": 4923714640543744, "cid": 5221323890491392, "sid": "dhruv"}, "5005155273539584": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 87, "PCD Score : Call 1": 89, "4C Score: Call 1": 90, "PCD Score: Call 2": 89, "4C Score : Call 2": 87, "PCD Score: Call 3": 86, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 84, "PCD Score : Call 5": 86, "4C Score : Call 5": 82, "Certification score": 86}, "status": "certified", "aid": 4923714640543744, "cid": 5221323890491392, "sid": "karthik"}, "6131055180382208": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 87, "PCD Score : Call 1": 89, "4C Score: Call 1": 90, "PCD Score: Call 2": 89, "4C Score : Call 2": 87, "PCD Score: Call 3": 86, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 84, "PCD Score : Call 5": 86, "4C Score : Call 5": 82, "Certification score": 86}, "status": "certified", "aid": 4923714640543744, "cid": 5221323890491392, "sid": "nakshatra"}, "5427367738605568": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 87, "PCD Score : Call 1": 89, "4C Score: Call 1": 90, "PCD Score: Call 2": 89, "4C Score : Call 2": 87, "PCD Score: Call 3": 86, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 84, "PCD Score : Call 5": 86, "4C Score : Call 5": 82, "Certification score": 86}, "status": "certified", "aid": 4923714640543744, "cid": 5221323890491392, "sid": "devrath"}, "5110708389806080": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 87, "PCD Score : Call 1": 89, "4C Score: Call 1": 90, "PCD Score: Call 2": 89, "4C Score : Call 2": 87, "PCD Score: Call 3": 86, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 84, "PCD Score : Call 5": 86, "4C Score : Call 5": 82, "Certification score": 86}, "status": "certified", "aid": 4923714640543744, "cid": 5221323890491392, "sid": "avanti"}, "6412530157092864": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 87, "PCD Score : Call 1": 89, "4C Score: Call 1": 90, "PCD Score: Call 2": 89, "4C Score : Call 2": 87, "PCD Score: Call 3": 86, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 84, "PCD Score : Call 5": 86, "4C Score : Call 5": 82, "Certification score": 86}, "status": "certified", "aid": 4923714640543744, "cid": 5221323890491392, "sid": "bharath2"}}, "4871647540543488": {"5005681591582720": {"qSD": {"nQ": 2, "nQC": 2, "nQP": 90}, "customScore": {"RAG Rating 1": "Green", "PCD Score : OJT Day 3": 89, "4C Score : OJT Day 3": 98, "PCD Score  : OJT Day 4": 87, "4C Score : OJT Day 4": 88, "PCD Score : OJT Day 5": 86, "4C Score : OJT Day 5": 84, "PCD Score : OJT Day 6": 89, "4C Score : OJT Day 6": 88, "PCD Score : OJT Day 7": 87, "4C Score : OJT Day 7": 86, "Gate : OJT Passed": 87}, "status": "certified", "aid": 4871647540543488, "cid": 6275388261007360, "sid": "arushi"}, "5850106521714688": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score : OJT Day 3": 89, "4C Score : OJT Day 3": 98, "PCD Score  : OJT Day 4": 87, "4C Score : OJT Day 4": 88, "PCD Score : OJT Day 5": 86, "4C Score : OJT Day 5": 84, "PCD Score : OJT Day 6": 89, "4C Score : OJT Day 6": 88, "PCD Score : OJT Day 7": 87, "4C Score : OJT Day 7": 86, "Gate : OJT Passed": 87}, "status": "Certification", "aid": 4871647540543488, "cid": 6275388261007360, "sid": "preksha"}, "4724206614872064": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score : OJT Day 3": 89, "4C Score : OJT Day 3": 98, "PCD Score  : OJT Day 4": 87, "4C Score : OJT Day 4": 88, "PCD Score : OJT Day 5": 86, "4C Score : OJT Day 5": 84, "PCD Score : OJT Day 6": 89, "4C Score : OJT Day 6": 88, "PCD Score : OJT Day 7": 87, "4C Score : OJT Day 7": 86, "Gate : OJT Passed": 87}, "status": "Certification", "aid": 4871647540543488, "cid": 6275388261007360, "sid": "gautam"}, "5287156568293376": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score : OJT Day 3": 89, "4C Score : OJT Day 3": 98, "PCD Score  : OJT Day 4": 87, "4C Score : OJT Day 4": 88, "PCD Score : OJT Day 5": 86, "4C Score : OJT Day 5": 84, "PCD Score : OJT Day 6": 89, "4C Score : OJT Day 6": 88, "PCD Score : OJT Day 7": 87, "4C Score : OJT Day 7": 86, "Gate : OJT Passed": 87}, "status": "Certification", "aid": 4871647540543488, "cid": 6275388261007360, "sid": "rangan"}, "6413056475136000": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score : OJT Day 3": 89, "4C Score : OJT Day 3": 98, "PCD Score  : OJT Day 4": 87, "4C Score : OJT Day 4": 88, "PCD Score : OJT Day 5": 86, "4C Score : OJT Day 5": 84, "PCD Score : OJT Day 6": 89, "4C Score : OJT Day 6": 88, "PCD Score : OJT Day 7": 87, "4C Score : OJT Day 7": 86, "Gate : OJT Passed": 87}, "status": "Certification", "aid": 4871647540543488, "cid": 6275388261007360, "sid": "rahil"}, "6131581498425344": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score : OJT Day 3": 89, "4C Score : OJT Day 3": 98, "PCD Score  : OJT Day 4": 87, "4C Score : OJT Day 4": 88, "PCD Score : OJT Day 5": 86, "4C Score : OJT Day 5": 84, "PCD Score : OJT Day 6": 89, "4C Score : OJT Day 6": 88, "PCD Score : OJT Day 7": 87, "4C Score : OJT Day 7": 86, "Gate : OJT Passed": 87}, "status": "Certification", "aid": 4871647540543488, "cid": 6275388261007360, "sid": "nikita2"}, "5568631545004032": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score : OJT Day 3": 89, "4C Score : OJT Day 3": 98, "PCD Score  : OJT Day 4": 87, "4C Score : OJT Day 4": 88, "PCD Score : OJT Day 5": 86, "4C Score : OJT Day 5": 84, "PCD Score : OJT Day 6": 89, "4C Score : OJT Day 6": 88, "PCD Score : OJT Day 7": 87, "4C Score : OJT Day 7": 86, "Gate : OJT Passed": 87}, "status": "Certification", "aid": 4871647540543488, "cid": 6275388261007360, "sid": "naveen"}, "6694531451846656": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score : OJT Day 3": 89, "4C Score : OJT Day 3": 98, "PCD Score  : OJT Day 4": 87, "4C Score : OJT Day 4": 88, "PCD Score : OJT Day 5": 86, "4C Score : OJT Day 5": 84, "PCD Score : OJT Day 6": 89, "4C Score : OJT Day 6": 88, "PCD Score : OJT Day 7": 87, "4C Score : OJT Day 7": 86, "Gate : OJT Passed": 87}, "status": "Certification", "aid": 4871647540543488, "cid": 6275388261007360, "sid": "darshan2"}, "6553793963491328": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score : OJT Day 3": 89, "4C Score : OJT Day 3": 98, "PCD Score  : OJT Day 4": 87, "4C Score : OJT Day 4": 88, "PCD Score : OJT Day 5": 86, "4C Score : OJT Day 5": 84, "PCD Score : OJT Day 6": 89, "4C Score : OJT Day 6": 88, "PCD Score : OJT Day 7": 87, "4C Score : OJT Day 7": 86, "Gate : OJT Passed": 87}, "status": "Certification", "aid": 4871647540543488, "cid": 6275388261007360, "sid": "test194"}}, "5685530673020928": {"4819082190782464": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "attrition-Training", "aid": 5685530673020928, "cid": 6275388261007360, "sid": "vedaant"}, "5100557167493120": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "attrition-Training", "aid": 5685530673020928, "cid": 6275388261007360, "sid": "tara2"}}, "5103152703471616": {"5073590040920064": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "attrition-Training", "aid": 5103152703471616, "cid": 6275388261007360, "sid": "rhea2"}, "5214327529275392": {"qSD": {"nQ": 0, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "attrition-Training", "aid": 5103152703471616, "cid": 6275388261007360, "sid": "riddhanya"}}}, "LOCATION 2": {"5635537387913216": {"6563204656267264": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 77, "PCD Score : Call 1": 0, "4C Score: Call 1": 87, "PCD Score: Call 2": 0, "4C Score : Call 2": 78, "PCD Score: Call 3": 88, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 87, "PCD Score : Call 5": 78, "4C Score : Call 5": 77, "Certification score": 0, "PCD Score : Call 1 recer": 88, "4C Score : Call 1 recer": 88, "PCD Score : Call 2 recer": 77, "4C Score : Call 2 recer": 99, "PCD Score : Call 3 recer": 98, "4C Score : Call 3 recer": 97, "PCD Score: Call 4 recer": 96, "4C Score: Call 4 recer": 95, "PCD Score : Call 5 recer": 94, "Re-certification Score": 76}, "status": "certified", "aid": 5635537387913216, "cid": 5221323890491392, "sid": "anam"}, "6281729679556608": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Red"}, "status": "certified", "aid": 5635537387913216, "cid": 5221323890491392, "sid": "tanvi1"}, "5859517214490624": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 77, "PCD Score : Call 1": 0, "4C Score: Call 1": 87, "PCD Score: Call 2": 0, "4C Score : Call 2": 78, "PCD Score: Call 3": 88, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 87, "PCD Score : Call 5": 78, "4C Score : Call 5": 77, "Certification score": 0, "PCD Score : Call 1 recer": 88, "4C Score : Call 1 recer": 88, "PCD Score : Call 2 recer": 77, "4C Score : Call 2 recer": 99, "PCD Score : Call 3 recer": 98, "4C Score : Call 3 recer": 97, "PCD Score: Call 4 recer": 96, "4C Score: Call 4 recer": 95, "PCD Score : Call 5 recer": 94, "Re-certification Score": 76}, "status": "certified", "aid": 5635537387913216, "cid": 5221323890491392, "sid": "annika"}, "6000254702845952": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 77, "PCD Score : Call 1": 78, "4C Score: Call 1": 87, "PCD Score: Call 2": 76, "4C Score : Call 2": 78, "PCD Score: Call 3": 88, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 87, "PCD Score : Call 5": 78, "4C Score : Call 5": 77, "Certification score": 83}, "status": "certified", "aid": 5635537387913216, "cid": 5221323890491392, "sid": "anvita"}, "4733617307648000": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 77, "PCD Score : Call 1": 78, "4C Score: Call 1": 87, "PCD Score: Call 2": 76, "4C Score : Call 2": 78, "PCD Score: Call 3": 88, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 87, "PCD Score : Call 5": 78, "4C Score : Call 5": 77, "Certification score": 83}, "status": "certified", "aid": 5635537387913216, "cid": 5221323890491392, "sid": "mishika"}, "4874354796003328": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green"}, "status": "attrition-OJT", "aid": 5635537387913216, "cid": 5221323890491392, "sid": "nikita1"}, "5155829772713984": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 77, "PCD Score : Call 1": 78, "4C Score: Call 1": 87, "PCD Score: Call 2": 76, "4C Score : Call 2": 78, "PCD Score: Call 3": 88, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 87, "PCD Score : Call 5": 78, "4C Score : Call 5": 77, "Certification score": 83}, "status": "certified", "aid": 5635537387913216, "cid": 5221323890491392, "sid": "nethra"}, "5437304749424640": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score: OJT Day 1": 87, "4C Score : OJT Day 1": 77, "PCD Score : Call 1": 78, "4C Score: Call 1": 87, "PCD Score: Call 2": 76, "4C Score : Call 2": 78, "PCD Score: Call 3": 88, "4C Score: Call 3": 87, "PCD Score : Call 4": 88, "4C Score : Call 4": 87, "PCD Score : Call 5": 78, "4C Score : Call 5": 77, "Certification score": 83}, "status": "certified", "aid": 5635537387913216, "cid": 5221323890491392, "sid": "anshika"}}, "5192781456736256": {"6659037791780864": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5192781456736256, "cid": 5221323890491392, "sid": "sloka"}, "6518300303425536": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5192781456736256, "cid": 5221323890491392, "sid": "tanya"}, "6377562815070208": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5192781456736256, "cid": 5221323890491392, "sid": "anirudha"}, "5814612861648896": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5192781456736256, "cid": 5221323890491392, "sid": "karan2"}, "6096087838359552": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5192781456736256, "cid": 5221323890491392, "sid": "tanay"}, "5955350350004224": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5192781456736256, "cid": 5221323890491392, "sid": "yuvna"}, "5533137884938240": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5192781456736256, "cid": 5221323890491392, "sid": "capucine"}, "4688712954806272": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5192781456736256, "cid": 5221323890491392, "sid": "anna"}, "4970187931516928": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5192781456736256, "cid": 5221323890491392, "sid": "safia"}, "4829450443161600": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5192781456736256, "cid": 5221323890491392, "sid": "tvisha"}, "5392400396582912": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5192781456736256, "cid": 5221323890491392, "sid": "talin"}, "5251662908227584": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5192781456736256, "cid": 5221323890491392, "sid": "vachan"}}, "6344644642209792": {"5297120808534016": {"qSD": {"nQ": 2, "nQC": 1, "nQP": 100}, "customScore": {"RAG Rating 1": "Green", "PCD Score : OJT Day 3": 87, "4C Score : OJT Day 3": 89, "PCD Score  : OJT Day 4": 71, "4C Score : OJT Day 4": 72, "PCD Score : OJT Day 5": 73, "4C Score : OJT Day 5": 74, "PCD Score : OJT Day 6": 89, "4C Score : OJT Day 6": 87, "PCD Score : OJT Day 7": 78, "4C Score : OJT Day 7": 76, "Gate : OJT Passed": 78}, "status": "certified", "aid": 6344644642209792, "cid": 6275388261007360, "sid": "nihal"}}}, "LOCATION 1": {"6475251812663296": {"4658680932859904": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green"}, "status": "OJT", "aid": 6475251812663296, "cid": 6275388261007360, "sid": "hamza"}, "4940155909570560": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green"}, "status": "OJT", "aid": 6475251812663296, "cid": 6275388261007360, "sid": "anokhi"}, "5221630886281216": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green"}, "status": "OJT", "aid": 6475251812663296, "cid": 6275388261007360, "sid": "sai2"}, "5362368374636544": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green"}, "status": "OJT", "aid": 6475251812663296, "cid": 6275388261007360, "sid": "suneil"}, "5503105862991872": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green"}, "status": "OJT", "aid": 6475251812663296, "cid": 6275388261007360, "sid": "marc"}, "5784580839702528": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green"}, "status": "OJT", "aid": 6475251812663296, "cid": 6275388261007360, "sid": "shiv1"}, "5925318328057856": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green"}, "status": "OJT", "aid": 6475251812663296, "cid": 6275388261007360, "sid": "shwetha"}, "6066055816413184": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green"}, "status": "OJT", "aid": 6475251812663296, "cid": 6275388261007360, "sid": "navkrut"}, "6347530793123840": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green"}, "status": "OJT", "aid": 6475251812663296, "cid": 6275388261007360, "sid": "prithvi"}, "6488268281479168": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green"}, "status": "OJT", "aid": 6475251812663296, "cid": 6275388261007360, "sid": "ananya2"}}, "5714560843513856": {"5841919911395328": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"PCD Score 1": 89, "PCD Score 2": 99, "PCD Score 3": 91, "4C Score 1": 89, "4C Score 2": 99, "4C Score 3": 98, "Gate 286": 99, "Gate": 99, "Gate Ayesha": 100}, "status": "certified", "aid": 5714560843513856, "cid": 4754005232189440, "sid": "skandhaa"}, "6545607353171968": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"PCD Score 1": 89, "PCD Score 2": 99, "PCD Score 3": 91, "4C Score 1": 89, "4C Score 2": 99, "4C Score 3": 98, "Gate 286": 99, "Gate": 99, "Gate Ayesha": 100}, "status": "certified", "aid": 5714560843513856, "cid": 4754005232189440, "sid": "eman"}, "4716020004552704": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"PCD Score 1": 0, "PCD Score 2": 0, "PCD Score 3": 0, "4C Score 1": 45, "4C Score 2": 12, "4C Score 3": 33, "Gate 286": 0, "Gate": 0, "Gate Ayesha": 0}, "status": "failed", "aid": 5714560843513856, "cid": 4754005232189440, "sid": "aaditya"}, "5982657399750656": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"PCD Score 1": 89, "PCD Score 2": 99, "PCD Score 3": 91, "4C Score 1": 89, "4C Score 2": 99, "4C Score 3": 98, "Gate 286": 99, "Gate": 99, "Gate Ayesha": 100}, "status": "certified", "aid": 5714560843513856, "cid": 4754005232189440, "sid": "saarthak"}, "4997494981263360": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"PCD Score 1": 89, "PCD Score 2": 99, "PCD Score 3": 91, "4C Score 1": 89, "4C Score 2": 99, "4C Score 3": 98, "Gate 286": 99, "Gate": 99, "Gate Ayesha": 100}, "status": "certified", "aid": 5714560843513856, "cid": 4754005232189440, "sid": "anthonymartin"}, "5278969957974016": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"PCD Score 1": 89, "PCD Score 2": 99, "PCD Score 3": 91, "4C Score 1": 89, "4C Score 2": 99, "4C Score 3": 98, "Gate 286": 99, "Gate": 99, "Gate Ayesha": 100}, "status": "certified", "aid": 5714560843513856, "cid": 4754005232189440, "sid": "meher"}, "5419707446329344": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"PCD Score 1": 0, "PCD Score 2": 0, "PCD Score 3": 0, "4C Score 1": 34, "4C Score 2": 33, "4C Score 3": 33, "Gate 286": 0, "Gate": 0, "Gate Ayesha": 0}, "status": "failed", "aid": 5714560843513856, "cid": 4754005232189440, "sid": "aditya2"}, "6123394888105984": {"qSD": {"nQ": 2, "nQC": 2, "nQP": 0}, "customScore": {"PCD Score 1": 89, "PCD Score 2": 99, "PCD Score 3": 91, "4C Score 1": 89, "4C Score 2": 99, "4C Score 3": 98, "Gate 286": 99, "Gate": 99, "Gate Ayesha": 100}, "status": "certified", "aid": 5714560843513856, "cid": 4754005232189440, "sid": "akshath"}, "6404869864816640": {"qSD": {"nQ": 2, "nQC": 2, "nQP": 50}, "customScore": {"PCD Score 1": 89, "PCD Score 2": 99, "PCD Score 3": 91, "4C Score 1": 89, "4C Score 2": 99, "4C Score 3": 98, "Gate 286": 99, "Gate": 99, "Gate Ayesha": 100}, "status": "certified", "aid": 5714560843513856, "cid": 4754005232189440, "sid": "tanisha1"}}, "5271007776473088": {"6365731549609984": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green"}, "status": "attrition-Training", "aid": 5271007776473088, "cid": 5221323890491392, "sid": "sunaina"}}, "5152013392281600": {"4579246150254592": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5152013392281600, "cid": 5221323890491392, "sid": "ashni"}, "5705146057097216": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5152013392281600, "cid": 5221323890491392, "sid": "vidushi"}, "6056989777985536": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5152013392281600, "cid": 5221323890491392, "sid": "arnav2"}, "4860721126965248": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5152013392281600, "cid": 5221323890491392, "sid": "nishanth"}, "4931089871142912": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5152013392281600, "cid": 5221323890491392, "sid": "arnab"}, "6338464754696192": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5152013392281600, "cid": 5221323890491392, "sid": "veda"}, "5142196103675904": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5152013392281600, "cid": 5221323890491392, "sid": "maya1"}, "6268096010518528": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5152013392281600, "cid": 5221323890491392, "sid": "anoshka"}, "6619939731406848": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5152013392281600, "cid": 5221323890491392, "sid": "tanisha2"}, "5494039824564224": {"qSD": {"nQ": 4, "nQC": 0, "nQP": ""}, "customScore": {}, "status": "Training", "aid": 5152013392281600, "cid": 5221323890491392, "sid": "kavya2"}}}, "OTHERS": {"5676426986520576": {"5741008060940288": {"qSD": {"nQ": 2, "nQC": 0, "nQP": ""}, "customScore": {"RAG Rating 1": "Green", "PCD Score : OJT Day 3": 78, "4C Score : OJT Day 3": 75, "PCD Score  : OJT Day 4": 80, "4C Score : OJT Day 4": 82, "PCD Score : OJT Day 5": 86, "4C Score : OJT Day 5": 87, "PCD Score : OJT Day 6": 87, "4C Score : OJT Day 6": 88, "PCD Score : OJT Day 7": 86, "4C Score : OJT Day 7": 87, "Gate : OJT Passed": 85}, "status": "Certification", "aid": 5676426986520576, "cid": 6275388261007360, "sid": "admin"}}}}, "assignment": {"5088817193156608": {"batchname": "2021-04-29 - Batch", "created": "2021-04-29 10:01:16", "start": "2021-04-29 09:59:00", "end": "2021-05-29 09:59:00"}, "4923714640543744": {"batchname": "2021-03-12 - Batch", "created": "2021-03-12 12:58:47", "start": "2021-02-11 12:57:00", "end": "2021-03-31 12:57:00"}, "5635537387913216": {"batchname": "2020-12-04 - Batch", "created": "2020-12-04 10:30:12", "start": "2020-11-03 10:29:00", "end": "2020-12-30 10:29:00"}, "5740357104959488": {"batchname": "2020-11-05 - Batch", "created": "2020-11-05 09:24:31", "start": "2020-10-05 09:22:00", "end": "2020-11-30 09:22:00"}, "4871647540543488": {"batchname": "Test for Discussion forum", "created": "2021-04-09 09:51:44", "start": "2021-02-09 09:49:00", "end": "2021-04-30 09:49:00"}, "5192781456736256": {"batchname": "2021-02-19 - Batch", "created": "2021-02-19 12:49:32", "start": "2021-01-01 12:48:00", "end": "2021-02-28 12:48:00"}, "5727630831648768": {"batchname": "2021-04-02 - Batch", "created": "2021-04-02 12:02:51", "start": "2021-03-02 12:00:00", "end": "2021-04-30 12:00:00"}, "6475251812663296": {"batchname": "2020-12-15 - Batch", "created": "2020-12-15 06:08:35", "start": "2020-11-01 06:05:00", "end": "2020-12-31 06:05:00"}, "5714560843513856": {"batchname": "2021-03-18 - Batch", "created": "2021-03-18 10:21:04", "start": "2021-03-01 10:20:00", "end": "2021-03-23 10:20:00"}, "5685530673020928": {"batchname": "2020-09-18 - Batch", "created": "2020-09-18 06:04:00", "start": "2020-08-01 06:01:00", "end": "2020-09-30 06:01:00"}, "4861601830141952": {"batchname": "2021-02-18 - Batch", "created": "2021-02-18 12:58:42", "start": "2020-12-01 12:57:00", "end": "2021-02-28 12:57:00"}, "5103152703471616": {"batchname": "2020-09-21 - Batch", "created": "2020-09-21 06:36:32", "start": "2020-09-01 06:35:00", "end": "2020-09-27 06:35:00"}, "5271007776473088": {"batchname": "2020-09-23 - Batch", "created": "2020-09-23 11:17:55", "start": "2020-09-01 11:16:00", "end": "2020-09-30 11:16:00"}, "6344644642209792": {"batchname": "2020-12-04 - Batch", "created": "2020-12-04 09:19:31", "start": "2020-11-01 09:16:00", "end": "2020-12-31 09:16:00"}, "5664957511237632": {"batchname": "2020-09-19 - Batch", "created": "2020-09-19 10:23:45", "start": "2020-08-01 10:21:00", "end": "2020-10-01 10:21:00"}, "5676426986520576": {"batchname": "2021-01-22 - Batch", "created": "2021-01-22 05:01:08", "start": "2021-01-01 04:59:00", "end": "2021-01-31 04:59:00"}, "5845518936702976": {"batchname": "2020-06-16 - Batch", "created": "2020-06-16 10:44:26", "start": "2020-04-30 09:42:00", "end": "2020-06-23 10:42:00"}, "5152013392281600": {"batchname": "2020-10-09 - Batch", "created": "2020-10-09 05:50:38", "start": "2020-09-09 05:40:00", "end": "2020-10-30 05:40:00"}, "4743752960704512": {"batchname": "2021-03-11 - Batch", "created": "2021-03-11 07:36:37", "start": "2021-03-11 07:36:00", "end": "2021-03-27 07:36:00"}}, "course": {"4754005232189440": {"name": "Gate formula-Nada"}, "5221323890491392": {"name": "FK Plus (Small) - TMS"}, "6275388261007360": {"name": "Mark the attendance date at individual user level"}, "5681008005349376": {"name": "173"}}, "version": "v196", "generatedOn": "2021-05-27 08:52:14"}
module_init();
})();

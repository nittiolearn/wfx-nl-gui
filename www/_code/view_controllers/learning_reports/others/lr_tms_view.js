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
    var _userInfo = null;
    var _subOrg = null;
    function _onPageEnter(userInfo) {
        _userInfo = userInfo;
        return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('NHT batches');
            var params = nl.location.search();
            _readFromFile = (params.fromfile == '1'); 
            $scope.debug = params.debug == '1';
            nlGroupInfo.init2().then(function() {
                nlGroupInfo.update();
                _groupInfo = nlGroupInfo.get();
                _pastUserInfosFetcher.init(_groupInfo);          
                var suborgDict = nlGroupInfo.getOrgToSubOrgDict(_groupInfo) || {};
                var orgunit = _userInfo.org_unit;
                _subOrg = suborgDict[orgunit];
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
		var bodyElement = document.getElementsByClassName("nl-lr-tms-report-body");
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
        $scope.data.toggleTableSelector = false;
        $scope.nhtInfo.info.columns = _getTmsCols();
    };

	$scope.onDetailsClick = function(e, item, columns) {
		e.stopImmediatePropagation();
		e.preventDefault();
		var detailsDlg = nlDlg.create($scope);
		detailsDlg.setCssClass('nl-heigth-max nl-width-max');
		detailsDlg.scope.item = item;
		detailsDlg.scope.columns = columns;
		detailsDlg.scope.getRoundedPerc = function(divider, dividend) {
			return Math.round((divider*100)/dividend);
		}
		var cancelButton = {text: nl.t('Close')};
		detailsDlg.show('view_controllers/learning_reports/lr_courses_tab_details.html',
			[], cancelButton);
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
        $scope.tableSelector = [{id: 'default', name: 'Overview', selected: true}, 
                                {id: 'customScores', name: 'Custom scores', selected: false}, 
                                {id: 'quiz', name: 'Quiz scores', selected: false},
                                {id: 'attrition', name: 'Attrition details', selected: false},
                                {id: 'daywise', name: 'Daywise module count', selected: false}
                            ];
        $scope.data = {toggleTableSelector: false};
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
        var data = {grpid: _groupInfo.grpid, table: 'lr_report', recid: 0, field:'nhtinfo-v2.json'};
        var fetchFn = _readFromFile ? nlFileReader.loadAndReadFile : nlServerApi.jsonFieldStream;
        fetchFn(data).then(function(resp) {
            if (!resp || !resp.data) {
                resolve();
            }
            jsonObj = resp.data;
            jsonObj = angular.fromJson(jsonObj);
            $scope.headerTextStr = nl.t('Generated on {}', nl.fmt.date2StrDDMMYY(nl.fmt.json2Date(jsonObj.generatedOn),null, 'date'));
            nlTmsView.init(_userInfo, _subOrg);
            _computeNhtTable();
            resolve(true);
        });
    }
    
    function _computeNhtTable() {
        nlTmsView.updateCounts(jsonObj.batches, jsonObj.courses, $scope.searchObj);
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
      _rows.sort(function(a, b) {
        if(b.sortkey.toLowerCase() < a.sortkey.toLowerCase()) return 1;
        if(b.sortkey.toLowerCase() > a.sortkey.toLowerCase()) return -1;
        if(b.sortkey.toLowerCase() == a.sortkey.toLowerCase()) return 0;				
    });

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
        var maxQuiz = nlTmsView.getMaxQuizCount();
        var showOtherCol = nlTmsView.showOtherQuizCol();
        var maxDaywise = nlTmsView.getMaxDaywiseCount();
        columns.push({id: 'batchCount', name: 'Batch count', table: true, percid:'percTotal', smallScreen: true, background: 'bggrey', showAlways: true, hidePerc:true, type: 'all'});
        columns.push({id: 'cntTotal', name: 'Head count', table: true, percid:'percTotal', smallScreen: true, background: 'bggrey', showAlways: true, hidePerc:true, type: 'all'});
        columns.push({id: 'Training', name: 'Training', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'OJT', name: 'OJT', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'Certification', name: 'Certification', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'Re-certification', name: 'Re-certification', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'certified', name: 'Certified', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'Closed', name: 'Closed', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'failed', name: 'Failed', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'attrition', name: 'Total Attrition', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default|attrition'});
        columns.push({id: 'attrition-Training', name: 'Attrition during Training', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'attrition'});
        columns.push({id: 'attrition-OJT', name: 'Attrition during OJT', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'attrition'});
        columns.push({id: 'attrition-Certification', name: 'Attrition during Certification', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'attrition'});
        columns.push({id: 'attrition-Re-certification', name: 'Attrition during Re-certification', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'attrition'});
        columns.push({id: 'inductionDropOut', name: 'Induction drop out', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        columns.push({id: 'otherRecords', name: 'Added in later batches', table: false, background: 'nl-bg-blue', showAlways: true, background: 'bggrey', hidePerc:true, type: 'default'});
        columns.push({id: 'nQuizzes', name: 'Number of applicable modules', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default|daywise'});
        columns.push({id: 'nQuizzesCompleted', name: 'Number of completed modules', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default|daywise'});
        columns.push({id: 'percCompletedLesson', name: 'Applicable modules completion %', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default|daywise'});
        columns.push({id: 'percAvgQuizScore', name: 'Assessment scores (Average of attempts)', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default|quiz'});
        columns.push({id: 'onlineTimeSpent', name: 'Online active time spent (Mins)', table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'default'});
        for (var i=0; i<customScores.length; i++) {
            columns.push({id: 'perc'+customScores[i], name: customScores[i], table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'customScores'});
        }
        if (showOtherCol) maxDaywise -= 1;
        for (var i=1; i<=maxDaywise; i++) {
            var dwKey = 'dayw'+i;
            columns.push({id: dwKey+'total', name: nl.t('Day {} applicable modules', i), table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'daywise'});
            columns.push({id: dwKey+'completed', name: nl.t('Day {} completed modules', i), table: true, background: 'nl-bg-blue', showAlways: true, hidePerc:true, type: 'daywise'});
        } 
        if (showOtherCol) {
            columns.push({id: 'daywOtherTotal', name: nl.t('Other applicable modules'), table: true, background: 'nl-bg-blue', hidePerc:true, showAlways: true, type: 'daywise'});
            columns.push({id: 'daywOtherCompleted', name: nl.t('Other completed modules'), table: true, background: 'nl-bg-blue', hidePerc:true, showAlways: true, type: 'daywise'});
        }
        for (var i=1; i<=maxQuiz; i++) {
            columns.push({id: 'quizname'+i, name: nl.t('Quiz {} name', i), table: true, background: 'nl-bg-blue', hidePerc:true, type: 'quiz'});
            columns.push({id: 'quizscore'+i+'perc', name: nl.t('Quiz {} score', i), table: true, background: 'nl-bg-blue', hidePerc:true, type: 'quiz'});
        }
        columns.push({id: 'batchid', name: 'Batch Id', table: false, background: 'nl-bg-blue', showAlways: true, background: 'bggrey', hidePerc:true, type: 'all', fmt: 'idstr', widthCls: 'w175'});
        if ($scope.debug) {
            columns.push({id: 'repids', name: 'Unique reportIds', table: false, background: 'nl-bg-blue', showAlways: true, background: 'bggrey', hidePerc:true, type: 'all', fmt: 'idstr', widthCls: 'w196'});
            columns.push({id: 'userids', name: 'Unique userIds', table: false, background: 'nl-bg-blue', showAlways: true, background: 'bggrey', hidePerc:true, type: 'all', fmt: 'idstr', widthCls: 'w196'});
        }
        var defaultDict = {};
        for (var i=0; i<$scope.tableSelector.length; i++) {
            if ($scope.tableSelector[i].selected) defaultDict[$scope.tableSelector[i].id] = true;
        }
        var selectedCols = [];
        for (var i=0;i<columns.length; i++) {
            var colType = columns[i].type;
            if (colType == 'all') {
                selectedCols.push(columns[i]);
                continue;
            }
            var tableTypeObj = _toObject(colType.split('|'));
            for (var key in tableTypeObj) {
                if (key in defaultDict) {
                    selectedCols.push(columns[i]);
                    break;
                }
            }
        }
      return selectedCols;
    }

    function _toObject(arr) {
        var ret = {};
        for (var i=0; i<arr.length; i++) {
            ret[arr[i]] = true;
        }
        return ret;
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
    var _userInfo = null;
    var _suborg = null;
    this.init = function(userInfo, suborg) {
        _userInfo = userInfo;
        _suborg = suborg;
    };

    this.getMaxQuizCount = function() {
        return tmsStats.getMaxQuizCount();
    }
    this.showOtherQuizCol = function() {
        return tmsStats.showOtherQuiz();
    }
    this.getMaxDaywiseCount = function() {
        return tmsStats.getMaxDaywiseCount();
    }
    this.getStatusCount = function() {
        return tmsStats.statsCountDict();     
    };

    this.getCustomScores = function() {
      return tmsStats.getCustomScores();
    }

    this.updateCounts = function(batches, courses, searchObj) {
        tmsStats.clear();
        for (var batchid in batches) {
            var batch = batches[batchid];
            var suborg = batch.suborg;
            if (batch.total) {
                var level1Info = {id: suborg, name: suborg};
                var level2Info = {id: batchid, name: batch.batchname, otherRecs: batch.otherRecords || 0};
                if (!_doesPassFilter(batch, searchObj)) continue;
                self.addCount(batch, level1Info, level2Info, true);
            } else {
                var level1Info = {id: suborg, name: suborg};
                var level2Info = {id: batchid, name: batch.batchname, otherRecs: batch.otherRecords || 0};
                if (!_doesPassFilter(batch, searchObj)) continue;
                self.addCount(batch, level1Info, level2Info, false);
            }
        }
    }

    function _doesPassFilter(assignment, searchObj) {
        if (!_checkRecordBelongsTo(assignment)) return false;
        if (!(searchObj.start || searchObj.end)) return true;
        var created = nl.fmt.json2Date(assignment.created);
        if (searchObj.start && searchObj.end && created >= searchObj.start && created <= searchObj.end) return true;
        if (!searchObj.start && searchObj.end && created <= searchObj.end) return true;
        if (!searchObj.end && searchObj.start && created >= searchObj.start) return true;
        return false;
    }

    function _checkRecordBelongsTo(assignment) {
        var permissions = _userInfo.permissions || {};
        var assignManagePerm = permissions.assignment_manage || false;
        var restrictOus = permissions.restrict_to_my_ou || false;
        var assignmentSend = permissions.assignment_send || false;
        if (assignManagePerm && !restrictOus) return true;
        if (assignManagePerm && restrictOus) {
            if (assignment.suborg == _suborg) return true;
            return false
        }
        if (assignManagePerm && restrictOus) {
            if (assignment.suborg == _suborg) return true;
            return false
        }
        if (!assignManagePerm && assignmentSend) {
            if (assignment.assignor == _userInfo.userid) return true;
            return false
        }
        return true;
    }

    this.addCount = function(record, level1Info, level2Info, getStatus) {
        var statusCntObj = getStatus ? _getStatusCountObj(record) : {};
        statusCntObj.assignment = level2Info.id;
        statusCntObj.otherRecs = level2Info.otherRecs;
        if (!getStatus) statusCntObj.dontIncludeInBatchCount = true;
        _addCount(level1Info, level2Info, statusCntObj);

    };

    function _addCount(level1Info, level2Info, statusObj) {
        tmsStats.updateRootCount(0, "All", statusObj);
        tmsStats.updateLevel1Count(0, level1Info, true, statusObj);
        tmsStats.updateLevel2Count(0, level1Info, level2Info, statusObj);
    }

    function _getStatusCountObj(batch) {
        var statsObj = {cntTotal: batch.total || 0};
            statsObj.inductionDropOut = batch.inductionDropOut;
        if (!batch.total || batch.total == 0) return;
        if (batch.onlineTSInMins && batch.onlineTSInMins > 0) statsObj.onlineTimeSpent = batch.onlineTSInMins;
        if ('customScore' in batch) {
          var customScore = batch.customScore;
          statsObj['customScores'] = customScore;
        }
        if(batch.status) statsObj.status = batch.status;
        var applicableModuleDict = batch.applicableModuleDict || {};
        if (batch.repids) statsObj['repid'] = batch.repids;
        if (batch.studentids) statsObj['userid'] = batch.studentids;
        statsObj['nQuizzes'] = applicableModuleDict.applicableLesson || 0;
        statsObj['nQuizzesCompleted'] = applicableModuleDict.completedLesson || 0;
        if (applicableModuleDict.quizPercScore > 0) statsObj['nQuizScorePerc'] = applicableModuleDict.quizPercScore || 0;
        if (applicableModuleDict.quizScoreDict) statsObj['quizScore'] = applicableModuleDict.quizScoreDict;
        if (applicableModuleDict.daywiseCompletion) statsObj['daywiseCompletion'] = applicableModuleDict.daywiseCompletion;
        return statsObj;
    }
}];

function TmsStatsCounts(nl) {
    var _statusCountTree = {};
    var self = this;
    var statsCountItem = {'cntTotal': 0, 'Training': 0, 'OJT': 0, 'Certification': 0, 'Re-certification': 0, 
                          'certified': 0, 'Closed': 0, 'isOpen': false, 'attrition': 0, 'failed': 0, 'nQuizzes': 0, 'nQuizzesCompleted': 0, 
                          'nQuizScorePerc': 0, 'nQuizPercScoreCount' : 0, 'batchCounted': {}, 'batchCount': 0,
                          'otherRecords': 0, 'inductionDropOut': 0, 'scoreCount': 0, 'recCount': 0,
                          'onlineTimeSpent': 0, 'repids': [], 'userids': []};
    var defaultStates = angular.copy(statsCountItem);
    var _dynamicStates = {};
    var _customScores = {};
    var _customScoresArray = [];
    var _maxQuizColumns = 0;
    var _maxDaywise = 0;
    var _otherQuizzes = false;
    this.clear = function() {
        _statusCountTree = {};
        _dynamicStates = {};
        _customScores = {};
        _customScoresArray = [];
        _maxQuizColumns = 0;
        _maxDaywise = 0;
        _otherQuizzes = false;
    };

    this.getMaxQuizCount = function() {
        return _maxQuizColumns;
    };

    this.showOtherQuiz = function() {
        return _otherQuizzes;
    };
    this.getMaxDaywiseCount = function() {
        return _maxDaywise;
    };

    this.statsCountDict = function() {
        _updateStatsCountTree(null, _statusCountTree);
        var allRow = _statusCountTree[0];
        if (!allRow) return {};
        if (!allRow.cnt) allRow.cnt = {};
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
        stats['type'] = 'overview';
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
        stats['type'] = 'suborg';
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
        stats['type'] = 'batch';
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
            if (key == 'otherRecs' || key == 'dontIncludeInBatchCount') continue;
            if (key == 'repid' && updatedStats.type == 'batch') updatedStats.repids = updatedStats.repids.concat(statusCnt[key]);
            if (key == 'userid' && updatedStats.type == 'batch') updatedStats.userids = updatedStats.userids.concat(statusCnt[key]);
            if (key == 'assignment') {
                if (statusCnt[key] in updatedStats.batchCounted) continue;
                updatedStats.otherRecords += statusCnt.otherRecs || 0;
                if (statusCnt.dontIncludeInBatchCount) continue;
                updatedStats.batchCount += 1;
                updatedStats.batchCounted[statusCnt[key]] = true;    
            }
            if (key == 'status') {
                _updateStatsDictForStatus(updatedStats, statusCnt[key]);
                continue;
            }
            if (key == 'quizScore') {
                var quizDict = statusCnt.quizScore;
                var count = 0;
                updatedStats.recCount += 1
                for (var key in quizDict) {
                    if (key.indexOf('cnt') > 0) continue;
                    var qsKey = 'quiz'+key;
                    if (key.indexOf('score') == 0) {
                        count += 1;
                        if (quizDict[key] > 0) {
                            var cntKey = key+'cnt';
                            if (!(qsKey in updatedStats)) updatedStats[qsKey] = 0;
                            updatedStats[qsKey] += quizDict[key]/quizDict[cntKey];
                            var countkey = qsKey+'count';
                            if (!(countkey in updatedStats)) updatedStats[countkey] = 0;
                            updatedStats[countkey] += 1;
                        }
                    } else {
                        updatedStats[qsKey] = quizDict[key];
                    }
                }
                if (updatedStats.scoreCount < count) updatedStats.scoreCount = count;
                if (_maxQuizColumns < count) _maxQuizColumns = count;
                continue;
            }
            if (key == 'daywiseCompletion') {
                var daywiseCompArray = statusCnt['daywiseCompletion'] || [];
                var firstItem = daywiseCompArray[0];
                if (firstItem.name == 'Other_lesson_count') {
                    daywiseCompArray = daywiseCompArray.slice(1, daywiseCompArray.length);
                    daywiseCompArray.push(firstItem);
                }
                for (var i=1; i<=daywiseCompArray.length; i++) {
                    var dwKey = 'dayw'+i;
                    var singleDayData = daywiseCompArray[i-1] || {};
                    if (singleDayData.name == 'Other_lesson_count') {
                        _otherQuizzes = true;
                        if (!('daywOtherTotal' in updatedStats)) updatedStats['daywOtherTotal'] = 0;
                        if (!('daywOtherCompleted' in updatedStats)) updatedStats['daywOtherCompleted'] = 0;
                        updatedStats['daywOtherTotal'] += singleDayData.nApplicableLesson;
                        updatedStats['daywOtherCompleted'] += singleDayData.nCompletedLesson;
                        continue;
                    }
                    if (updatedStats.type == 'batch') {
                        var nameKey = dwKey+'name';
                        updatedStats[nameKey] = singleDayData.name;
                    }
                    var totalKey = dwKey+'total';
                    var compKey = dwKey+'completed';
                    if (!(totalKey in updatedStats)) updatedStats[totalKey] = 0;
                    if (singleDayData.nApplicableLesson && singleDayData.nApplicableLesson > 0)
                        updatedStats[totalKey] += singleDayData.nApplicableLesson;
                    if (!(compKey in updatedStats)) updatedStats[compKey] = 0;
                    if (singleDayData.nCompletedLesson && singleDayData.nCompletedLesson > 0)
                        updatedStats[compKey] += singleDayData.nCompletedLesson;
                }
                if (_maxDaywise < daywiseCompArray.length) _maxDaywise = daywiseCompArray.length;
            }
            if(key == 'customScores') {
                var customScores = statusCnt[key]
                for(var custObj in customScores) {
                    var cust = customScores[custObj]
                    var _score = 0;
                    if (cust.score && cust.score > 0) {
                        _score = cust.score/cust.cnt;
                    }
                    var item = {name: cust.name, score: _score};
                    var cntid = item.name+'count';
                    if(!(item.name in _customScores)) {
                        _customScores[item.name] = true;
                        _customScoresArray.push(item.name)
                    }
                    if(!(item.name in updatedStats)) {
                        updatedStats[item.name] = item.score;
                        updatedStats[cntid] = 0;
                        if (item.score > 0)
                            updatedStats[cntid] = 1;
                    } else {
                        updatedStats[item.name] += item.score;
                        if (item.score > 0)
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

    function _updateStatsDictForStatus(src, dest) {
        for (var key in dest) {
            if (!(key in src)) src[key] = 0;
            if (key.indexOf('attrition') >= 0) src['attrition'] += src[key];
            src[key] += 1;
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
        if (updatedStats['nQuizPercScoreCount'] > 0) 
            percScore = Math.round(updatedStats['nQuizScorePerc']/updatedStats['nQuizPercScoreCount']);         

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
            updatedStats[percid] = updatedStats[count] > 0 ? Math.round(updatedStats[itemName]/updatedStats[count])+' %' : '-';
        }
        var count = updatedStats.scoreCount;
        for (var i=1; i<=count; i++) {
            var totalQuizPerc = -1;
            var scoreKey = 'quizscore'+i;
            var countKey = 'quizscore'+i+'count';
            var percKey = scoreKey+'perc';
            if (updatedStats[countKey] > 0)
                totalQuizPerc = Math.round(updatedStats[scoreKey]/updatedStats[countKey]);
            updatedStats[percKey] = totalQuizPerc >= 0 ? totalQuizPerc+'%' : '-';
            if (parentRow && totalQuizPerc >= 0) {
                var parentScoreKey = countKey+'count';
                var parentTotalKey = countKey+'total';
                if (!parentRow[parentScoreKey]) parentRow[parentScoreKey] = 0;
                if (!parentRow[parentTotalKey]) parentRow[parentTotalKey] = 0;
                parentRow[parentTotalKey] += 1;
                parentRow[parentScoreKey] += totalQuizPerc;
                var percQS = Math.round(parentRow[parentScoreKey]/parentRow[parentTotalKey]);
                parentRow[percKey] = percQS >= 0 ? percQS+'%' : '-';
            }
        }

    }
}
//-------------------------------------------------------------------------------------------------
module_init();
})();

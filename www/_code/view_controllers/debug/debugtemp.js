(function() {

//-------------------------------------------------------------------------------------------------
// debugtemp.js:
// Temp module for experimentation
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.debugtemp', [])
    .config(configFn)
    .controller('nl.DebugTempCtrl', DebugTempCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider',
function($stateProvider) {
    $stateProvider.state('app.debugtemp', {
        url : '^/debugtemp',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/debug/debugtemp.html',
                controller : 'nl.DebugTempCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var DebugTempCtrl = ['nl', 'nlRouter', '$scope',
function(nl, nlRouter, $scope) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Debug Temp');
            _initScope(userInfo);
            resolve(true);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);

    function _onFilterClick() {
        console.log('TODO: onFilterClick');
    }

    function _getNhtOverViewArrayRow1() {
        return [
            {perc: 80, title: 'Nht title1', desc: '', showperc: false}, 
            {perc: 80, title: 'Nht title2', desc: '', showperc: false}, 
            {perc: 80, title: 'Nht title3', desc: '', showperc: false}
        ];
    }
    function _getNhtOverViewArrayRow2() {
        return [
            {perc: 80, title: 'Nht title1', desc: '', showperc: false}, 
            {perc: 80, title: 'Nht title2', desc: '', showperc: false}, 
            {perc: 80, title: 'Nht title3', desc: '', showperc: false}
        ];
    }
    function _getNhtOverViewArrayRow3() {
        return [
            {perc: 80, title: 'Nht title1', desc: '', showperc: false}, 
            {perc: 80, title: 'Nht title2', desc: '', showperc: false}, 
            {perc: 80, title: 'Nht title3', desc: '', showperc: false}
        ];
    }
    function _getNhtOverViewArrayRow4() {
        return [
            {perc: 80, title: 'Nht title1', desc: '', showperc: false}, 
            {perc: 80, title: 'Nht title2', desc: '', showperc: false}, 
            {perc: 80, title: 'Nht title3', desc: '', showperc: false}
        ];
    }

    function _initScope(userInfo) {
        $scope.toolbar = [
            {id: 'filter', title: 'Filter', icon: 'ion-filter', onClick: _onFilterClick}
        ];
        $scope.columns = _mergeColumns(_getOptionalColumns());
        //$scope.data = _generateRandomData($scope.columns);
        $scope.data = {};
        $scope.data.nhtOverViewArrayRow1 = _getNhtOverViewArrayRow1();
        $scope.data.nhtOverViewArrayRow2 = _getNhtOverViewArrayRow2();
        $scope.data.nhtOverViewArrayRow3 = _getNhtOverViewArrayRow3();
        $scope.data.nhtOverViewArrayRow4 = _getNhtOverViewArrayRow4();
        $scope.data.chartData = [{type: 'doughnut', data: [12, 34, 35, 20, 10], labels: ['Training', 'OJT', 'Certification', 'Re-certification', 'Closed'], 
                                  colors:[_nl.colorsCodes.started, _nl.colorsCodes.pending, _nl.colorsCodes.done, _nl.colorsCodes.pending, _nl.colorsCodes.pending], series: [], options: []}];
        $scope.hideColsGui = true;
    }

    function _mergeColumns(columns) {
        var ret = _getFixedColumns();
        for(var i=0; i<columns.length; i++) ret.push(columns[i]);
        return ret;
    }

    function _getFixedColumns() {
        var ret = [{id: 'location', name: 'Location', fixed: true},
            {id: 'lob', name: 'LOB', fixed: true},
            {id: 'batch', name: 'Batch', fixed: true}
        ];
        return ret;
    }

    function _getOptionalColumns() {
        var ret = [];
        for(var i=0; i<50; i++) ret.push({id: 'col' + i, name: 'Column ' + i});
        return ret;
    }

    function _generateRandomData(columns) {
        var data = [];
        for (var i=0; i<100; i++) {
            var row = {};
            data.push(row);
            for (var j=0; j<columns.length; j++) {
                row[columns[j].id] = '' + columns[j].id + '-' + i;
            }
        }
        return data;
    }

}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

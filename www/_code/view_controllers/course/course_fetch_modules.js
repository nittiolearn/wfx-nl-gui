(function() {

//-------------------------------------------------------------------------------------------------
// course_fetch_modules.js:
// fetch all modules inside the course
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.course_fetch_modules', []).config(configFn)
    .controller('nl.CourseFetchModules', CourseFetchModulesCtrl);
};

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.course_modules', {
        url : '^/course_modules',
        views : {
            'appContent' : {
                templateUrl : '',
                controller : 'nl.CourseFetchModules'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var CourseFetchModulesCtrl = ['nl', 'nlDlg', 'nlRouter', '$scope', 'nlCardsSrv', 'nlLessonSelect', 'nlServerApi', 'nlImporter', 'nlExporter', '$templateCache',
function(nl, nlDlg, nlRouter, $scope, nlCardsSrv, nlLessonSelect, nlServerApi, nlImporter, nlExporter, $templateCache) {
    var _userInfo = null;
    function _onPageEnter(userInfo) {
        _userInfo = userInfo;
        return nl.q(function (resolve, reject) {
            $scope.userinfo = _userInfo;
            $scope.data = {};
            nl.pginfo.pageTitle = nl.t('Modules inside the course');
            _createModulesFetcherDlg();
            resolve(true);	
        });
    }
    
    nlRouter.initContoller($scope, '', _onPageEnter);

    function _createModulesFetcherDlg() {
        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-height-max nl-width-max');
        dlg.scope.error = {};
        dlg.scope.dlgtitle = nl.t('Fetch modules inside the course')
        dlg.scope.userinfo = _userInfo;
        dlg.scope.data = {};
        dlg.scope.help = _getHelp();
        var fetchButton = {text: nl.t('Fetch modules'), onTap: function(e) {
            if(!_validateInputs(dlg.scope)) {
                e.preventDefault();
                return;
            }
            _onFetchModules(e, dlg.scope);
        }};
        var cancelButton = {text: nl.t('Close'), onTap: function(e) {
            nl.window.location.href = '#/home';
        }};
        dlg.show('view_controllers/course/course_module_fetch_dlg.html', [fetchButton], cancelButton, false);
    }
    
    function _getHelp() {
        return {
            filelist: {name: nl.t('Choose spreadsheet'), help: nl.t('Select the spread sheet. The first row should be header and next rows containing course ids.')},
            moduleids: {name: nl.t('Modules ids'), help: nl.t('Module ids inside the used inside the course.')}
        };
    }
    
    function _validateInputs(dlgScope) {
        if (dlgScope.data.filelist.length == 0) return _validateFail(dlgScope, 'filelist', 'Please select the csv/xls file');
        return true;
    }
                    
    function _validateFail(scope, attr, errMsg) {
        return nlDlg.setFieldError(scope, attr, nl.t(errMsg));
    }

    function _onFetchModules(e, dlgScope) {
        nlDlg.showLoadingScreen();
        if (e) e.preventDefault();
        var csvFile = dlgScope.data.filelist[0].resource;
        var extn = dlgScope.data.filelist[0].extn;
        var importMethod = extn == '.csv' ? nlImporter.readCsv : nlImporter.readXls;
        importMethod(csvFile, {ignore_column_count: true}).then(function(result) {
            if (result.error) {
                nlDlg.hideLoadingScreen();
                nlDlg.popupAlert({title:'Error message', template:nl.t('Error parsing CSV file: {}', result.error)});
                return;
            }
            var dataTable = extn == '.csv' ? result.table : result.sheets.Sheet1;
            var rows = _processCsvFile(dataTable);
            nlServerApi.courseOrAssignGetMany(rows).then(function(result) {
                nlDlg.hideLoadingScreen();
                _moduleList(dlgScope, result);
            });
        }, function(e) {
            nlDlg.popupAlert({title:'Error message', template: nl.t('Error reading CSV file: {}', e)});
        });    
    }

    function _processCsvFile(table) {
        var data = [];
        for (var i=1; i<table.length; i++) {
            var row = _getRowObj(table[i], i);
            if (row !== null) data.push(row);
        }
        return data;
    }

    function _getRowObj(row) {
        if(!row[0]) return null;
        var ret = {id: parseInt(row[0]), table: 'course'};
        return ret;
    } 
    var moduleIds = {}
    function _moduleList(dlgScope, result) {
        dlgScope.data.moduleList = [];
        for(var i=0; i<result.length; i++) {
            if(result[i].error) continue;
            var modules = result[i].content.modules;
            for(var j=0; j<modules.length; j++) {
                var item = modules[j];
                if(item.type != 'lesson') continue;
                if(item.refid in moduleIds) continue;
                moduleIds[item.refid] = true;
                dlgScope.data.moduleList.push(item.refid);
            }
        }
    }

}];

//-------------------------------------------------------------------------------------------------
module_init();
})();
    
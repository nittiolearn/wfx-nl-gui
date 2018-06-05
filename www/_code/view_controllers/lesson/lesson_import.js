(function() {

//-------------------------------------------------------------------------------------------------
// lesson_import.js:
// lesson import module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.lessonimport', []).config(configFn)
	.controller('nl.LessonImportCtrl', LessonImportCtrl);
};

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.lesson_import', {
		url : '^/lesson_import',
		views : {
			'appContent' : {
				templateUrl : '',
				controller : 'nl.LessonImportCtrl'
			}
		}
	});
}];

//-------------------------------------------------------------------------------------------------
var LessonImportCtrl = ['nl', 'nlDlg', 'nlRouter', '$scope', 'nlCardsSrv', 'nlLessonSelect', 'nlServerApi', 'nlImporter', 'nlExporter', '$templateCache',
function(nl, nlDlg, nlRouter, $scope, nlCardsSrv, nlLessonSelect, nlServerApi, nlImporter, nlExporter, $templateCache) {
	var _userInfo = null;
	var _scope = null;
	var _templateId = null;
	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		_scope = $scope;
		return nl.q(function (resolve, reject) {
			$scope.userinfo = _userInfo;
        	$scope.data = {};
			nl.pginfo.pageTitle = nl.t('Lesson import');
			var params = nl.location.search();
			_templateId = ('id' in params) ? parseInt(params.id) : null;
			_createLessonImportDlg();
			resolve(true);	
		});
	}
	
	nlRouter.initContoller($scope, '', _onPageEnter);

	function _createLessonImportDlg() {
        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-height-max nl-width-max');
        dlg.scope.error = {};
        dlg.scope.userinfo = _userInfo;
        dlg.scope.data = {filelist: []};
        dlg.scope.help = _getHelp();
        if(_templateId) {
        	dlg.scope.isTemplateDefined = true;
        	dlg.scope.data.selectedModule = {lessonId: _templateId, title: _templateId};
        }
        dlg.scope.onClickHandler = function(handlerName) {
	        var csvString = $templateCache.get('view_controllers/lesson/csv_import_sample.csv.html');
	        nlExporter.exportCsvFile('ImportTemplate.csv', csvString, true);
        };
        
        var importButton = {text: nl.t('Import'), onTap: function(e) {
        	if(!_validateInputs(dlg.scope)) {
	    		e.preventDefault();
        		return;
        	}
            _onImport(e, dlg.scope);
        }};
		var cancelButton = {text: nl.t('Close'), onTap: function(e) {
			nl.window.location.href = '#/home';
		}};
		dlg.show('view_controllers/lesson/lesson_import_dlg.html', [importButton], cancelButton, false);
	}
	
	function _getHelp() {
		return {
			moduleName: {name: nl.t('Module name'), help: nl.t('Name of the module create by importing the csv file.') },
			selectedModule: {name: nl.t('Select module'), help: nl.t('Select the default template based on which the imported module is created.')},
			filelist: {name: nl.t('Choose CSV file'), help: _getCsvHelp(), isShown: true}
		};
	}
	
	function _getCsvHelp() {
		var clickHandler = "onClickHandler('downloadCsv')";
		var help = '<div>';
		help += nl.fmt2('<span class="padding-small">Download <span class="nl-link-text" ng-click="{}">sample csv file</span> to better understand the CSV file format to be imported. You could just edit the file and get going.</span>', clickHandler);
		help += '<div class="padding-left"><ul><li class="padding-small">First row (header row) of CSV file is mandatory. This is just provided as a help to the user. Please do not change the values in this column.</li>';
		help += '<li class="padding-small">Each row starting from second row of the CSV file is converted into one page in the module.</li>';
		help += '<li class="padding-small">The first column specifies the "page type" of the page created. Page type defines the question type (MCQ, Matching, ...), number of options and the layout for the page. The sample csv file provided above has some sample page types that could be used.</li>';
		help += '<li class="padding-small">The second column specifies maximum score for the question. Leave this empty or specify the value 0 if you want to use the default maximum score for the page.</li>';
		help += '<li class="padding-small">Third column onwards specify content in different sections of the page. For example</li>';
		help += '<div class="padding-left"><ul><li class="padding-small">for 4 option MCQ question, the third column is where you provide the question, fourth column with the correct answer, fifth, sixth and seventh columns have the wrong answer and the eighth column could have a hint or some instruction.</li>';
		help += '<li class="padding-small">for 2 option MCQ question, the third column is where you provide the question, fourth column with the correct answer, fifth column has the wrong answer and the sixth column could have a hint or some instruction.</li></ul></div>';
		help += '</ul></div></div>';
		return help;
	}
	function _validateInputs(dlgScope) {
		if (!dlgScope.data.moduleName) return _validateFail(dlgScope, 'moduleName', 'Please enter the name for the imported module');
        if (!dlgScope.data.selectedModule) return _validateFail(dlgScope, 'selectedModule', 'Please select the default template for importing csv based on it.');
        if (dlgScope.data.filelist.length == 0) return _validateFail(dlgScope, 'filelist', 'Please select the csv file to import.');
        return true;
    }
                    
    function _validateFail(scope, attr, errMsg) {
        return nlDlg.setFieldError(scope, attr, nl.t(errMsg));
    }

    function _onImport(e, dlgScope) {
    	nlDlg.showLoadingScreen();
        if (e) e.preventDefault();
        var csvFile = dlgScope.data.filelist[0].resource;
        nlImporter.readCsv(csvFile, {ignore_column_count: true}).then(function(result) {
            if (result.error) {
            	nlDlg.hideLoadingScreen();
                nlDlg.popupAlert({title:'Error message', template:nl.t('Error parsing CSV file: {}', result.error)});
                return;
            }
            var rows = _processCsvFile(result.table);
            var lessonid = dlgScope.data.selectedModule.lessonId;
            nlServerApi.lessonGetContent(lessonid).then(function(result) {
            	_createLessonFromCsvRows(rows, result.lesson, dlgScope.data.moduleName);
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
        var ret = {pagetype: row[0], sections: []};
        if(row[1]) ret['maxScore'] = parseInt(row[1]);
        for(var i=2; i<row.length; i++) ret.sections.push(row[i]);
        return ret;
	}
	
	function _createLessonFromCsvRows(rows, lesson, name) {
		lesson.name = name;
		lesson.ltype = 0;
		for(var i=0; i<rows.length; i++) {
			var row = rows[i];
			var page = {type:row.pagetype, sections:[], pageId: lesson.newPageId++};
			if(row.maxScore) page['pageMaxScore'] = row.maxScore;  
			for(var j=0; j<row.sections.length; j++) {
				page.sections.push({text: row.sections[j], type: "txt"});
			}
			lesson.pages.push(page);
		}
		_saveAndCreateNewLesson(lesson);
	}
	
	function _saveAndCreateNewLesson(oLesson) {
        var data = {content:angular.toJson(oLesson), createNew: true};
        nlServerApi.lessonSave(data).then(function(newLessonId) {
            $scope.newLessonId = newLessonId;
            $scope.isApproved = false;
            $scope.isLessonImport = true;
            var copyLessonDlg = nlDlg.create($scope);
            copyLessonDlg.scope.error = {};
            copyLessonDlg.scope.dlgTitle = nl.t('Module created');
            copyLessonDlg.scope.clickOnImportAgain = function(e) {
            	copyLessonDlg.close(false);
            };
            var closeButton = {text : nl.t('Close'), onTap: function(e) {
				nl.window.location.href = '#/home';
            }};
            copyLessonDlg.show('view_controllers/lesson_list/copy_lesson.html', [], closeButton);
            nlDlg.hideLoadingScreen();
        });		
	}
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

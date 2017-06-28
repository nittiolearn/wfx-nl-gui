(function() {

//-------------------------------------------------------------------------------------------------
// nittiolesson.js:
// lesson list module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.nittiolesson', [])
	.service('NittioLesson', NittioLessonSrv);
}

//-------------------------------------------------------------------------------------------------
var NittioLessonSrv = ['nl', 'nlDlg', 'nlServerApi',
function(nl, nlDlg, nlServerApi) {
	var _oLesson = null;
	var _dropdownOptions = null;
	
	this.init = function(oLesson, dropdownOptions) {
		_oLesson = _oLesson;
		_dropdownOptions = dropdownOptions;
	};
		 
	this.showModulePropertiesDlg = function(isCreate) {
		var doneButtonText = isCreate ? 'Create' : 'Done';
		return nl.q(function(resolve, reject) {
			nlDlg.popupStatus('TODO');
			resolve(false);
		});
	};

	var moduleProps = [{id: 'name', name: nl.t('Name'), type: 'string'},
					   {id: 'grade', name: nl.t('Grade'), type: 'select'},
					   {id: 'subject', name: nl.t('Subject'), type: 'select'},
					   {id: 'image', name: nl.t('Image'), type: 'select'},
					   {id: 'description', name: nl.t('Description'), type: 'textarea'},
					   {id: 'keywords', name: nl.t('Keywords'), type: 'string'},
					   {id: 'esttime', name: nl.t('Estimated time'), type: 'number'},
					   {id: 'custtype', name: nl.t('Content type'), type: 'select'},
					   {id: 'forumTopic', name: nl.t('Discussion topic'), type: 'string'},
					   {id: 'additional_attr', name: nl.t('Template attributes:'), type:'additional'},
					   {id: 'templateStylesCss', name: nl.t('Styles'), type: 'textarea'},
					   {id: 'templateBgimgs', name: nl.t('Background images'), type: 'textarea'},
					   {id: 'templatePageTypes', name: nl.t('Page types'), type: 'textarea'},
					   {id: 'templateAnimations', name: nl.t('Animation schemes'), type: 'textarea'}];
	
	var learningMode = [{id:'assesment', name:nl.t('Assesment module')},
						{id:'self', name: nl.t('Self learning module')}];
	this.show = function(parentScope, lesson) {
		return nl.q(function(resolve, reject){
			console.log(lesson);
			var editDlg = nlDlg.create(parentScope);
			editDlg.setCssClass('nl-height-max nl-width-max');
			_initEditDlg(editDlg, lesson);			
			editDlg.scope.dlgTitle = nl.t('Module properties');
			var okButton = {text: nl.t('Done'), onTap: function(e, lesson) {
				// if(!_validateInputs(editDlg.scope)) {
					// return;
				// }
				editDlg.scope.data.lessonData.grade = editDlg.scope.data.grade.id;
				editDlg.scope.data.lessonData.subject = editDlg.scope.data.subject.id;
				if(editDlg.scope.data.learningType.id == 'self') {
					editDlg.scope.data.lessonData.selfLearningMode = true;
				} else {
					editDlg.scope.data.lessonData.selfLearningMode = false;
				}
				console.log(editDlg.scope.data.lessonData);
				resolve(editDlg.scope.data.lessonData);
			}};
			var cancelButton = {text: nl.t('Close'), onTap: function() {
				resolve(false);
			}};
			editDlg.show('view_controllers/old_code_transform/edit_module_properties/edit_module_dlg.html', [okButton], cancelButton);
		});
	};

    function _validateInputs(scope) {
    	scope.error = {};
    	var data = scope.data.lessonData;
        if(!data.name) return _validateFail(scope, 'name', 'Module name is mandatory');
        return true;
    }

    function _validateFail(scope, attr, errMsg) {
    	return nlDlg.setFieldError(scope, attr,
        	nl.t(errMsg));
    }

	function _initEditDlg(editDlg, lesson) {
		nlServerApi.getUserInfoFromCacheOrServer().then(function(userInfo){
			_userInfo = userInfo;
			console.log(userInfo);
			editDlg.scope.data = {};
			editDlg.scope.data.moduleProps = moduleProps;
			lesson.esttime = parseInt(lesson.esttime);
			editDlg.scope.data.lessonData = lesson;
			editDlg.scope.options = {grade: _getDropDown(_userInfo.groupinfo.grades), 
									 subject: _getDropDown(_userInfo.groupinfo.subjects),
									 learningMode: learningMode};
			editDlg.scope.data.grade = {id: lesson.grade, name: lesson.grade};
			editDlg.scope.data.subject = {id: lesson.subject, name: lesson.subject};						 
			editDlg.scope.data.learningType = lesson.selfLearningMode || lesson.selfLearningMode == true ? learningMode[1] : learningMode[0]; 
		});
	}
	
	function _getDropDown(arrayElem) {
		var arrayDict = [];		
		for(var i=0; i<arrayElem.length; i++) {
			arrayDict.push({id: arrayElem[i], name: arrayElem[i]});
		}
		return arrayDict;
	};
}]; 

module_init();
})();

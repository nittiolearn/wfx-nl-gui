(function() {

//-------------------------------------------------------------------------------------------------
// course_edit.js:
// course_edit module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.course_edit', [])
    .service('nlCourseEditor', NlCourseEditorSrv)
    .directive('nlCourseEditor', CourseEditDirective())
    .directive('nlCourseEditorFields', EditorFieldsDirective());
}

//-------------------------------------------------------------------------------------------------
function CourseEditDirective() {
    var templateUrl = 'view_controllers/course/editor/course_editor.html';
    return _nl.elemDirective(templateUrl, true);
}

//-------------------------------------------------------------------------------------------------
function EditorFieldsDirective() {
    var scope = {
        attrs: '=',
        help: '=',
        values: '=',
        editor: '='
    };
    var templateUrl = 'view_controllers/course/editor/course_editor_fields.html';
    return _nl.elemDirective(templateUrl, scope);
}

//-------------------------------------------------------------------------------------------------
var NlCourseEditorSrv = ['nl', 'nlDlg', 'nlServerApi', 'nlLessonSelect', 
'nlExportLevel', 'nlRouter', 'nlCourseCanvas', 'nlMarkup', 'nlTreeSelect', 'nlResourceAddModifySrv', 'NittioLesson', 'nlGroupInfo',
function(nl, nlDlg, nlServerApi, nlLessonSelect, nlExportLevel, nlRouter, nlCourseCanvas, nlMarkup, nlTreeSelect, nlResourceAddModifySrv, NittioLesson, nlGroupInfo) {

    var modeHandler = null;
    var $scope = null;
    var _allModules = [];
    var _debug = null;
	var _userInfo = null;
	var _resourceDict = {};
	var _groupInfo = null;
    this.init = function(_scope, _modeHandler, userInfo) {
		nlGroupInfo.init().then(function() {
			_groupInfo = nlGroupInfo.get();
		});
        $scope = _scope;
        modeHandler = _modeHandler;
        _userInfo = userInfo;
		var params = nl.location.search();
        if ('debug' in params) _debug = true;
        _updateCourseAndModuleAttrOptions(userInfo);
        $scope.editor = {
        	jsonTempStore: {},
        	course_params: _getCourseParams(),
        	course_paramStore: {course: modeHandler.course, content: modeHandler.course.content, metadata: modeHandler.course.content.contentmetadata || {}},
            module_attributes: moduleAttrs,
            course: modeHandler.course,
            debug: _debug,
            showGroup: {},
            onLaunch: _onLaunch,
            addModule: _addModule,
            deleteModule: _deleteModule,
            searchLesson: _searchLesson,
            organiseModules: _organiseModulesDlg,
            saveCourse: _saveCourse,
            onBooleanClick: _onBooleanClick,
            onAttrChange: _onAttrChange,
            validateTextField: _validateTextField,
			editAttribute: _editAttribute,
			showWikiMarkupPreview: _showWikiMarkupPreview,
			getDisplayValue: _getDisplayValue,
			treeOptions: _getTreeOptions(),
			getUrl: _getLaunchUrl,
			onFieldClick: _onFieldClick,
        };
    };

    this.getAllModules = function(bClear) {
    	if (bClear) _allModules = [];
    	return _allModules;
    };
    
	this.initSelectedItem = function(cm) {
		_updateDropdowns(cm);
		return _initEditorTempJson(cm);
	};

	this.validateInputs = function(cm) {
		return _validateInputs(modeHandler.course, cm);		
	};

	function _onFieldClick() {
		var resFilter = 'icon';
		var selectedImgUrl = modeHandler.course.icon != "icon:" ? '' : modeHandler.course.icon;
		var bgShade = '';
		var markupText = nl.fmt2('img:{}[{}]', selectedImgUrl, bgShade); 
		NittioLesson.getResourceLibrary().then(function(resourceDict) {
			_resourceDict = resourceDict;
			var promise = nlResourceAddModifySrv.insertOrUpdateResource($scope, 
				            _userInfo.groupinfo.restypes, markupText, false, _resourceDict, resFilter, modeHandler.course.id);
			promise.then(function(selected) {
				if (!selected || !selected.url) return;
				if(resFilter == 'icon') {
		            modeHandler.course.icon = selected.url;
				}
			});
		});
	}
	
    function _updateDropdowns(cm) {
    	var attrs = $scope.editor.module_attributes;
    	for(var i=0; i<attrs.length; i++) {
    		var attr = attrs[i];
    		if (!attr.updateDropdown) continue;
    		attr.updateDropdown(cm, attr);
    	}
    }
    
	function _updateTypeDropdown(cm, attr) {
		attr.values = ['module', 'lesson', 'info', 'certificate'];
    	if (cm.type == 'link' || nlRouter.isPermitted(_userInfo, 'admin_user'))
		   attr.values.push('link');
		if (cm.type == 'iltsession' || (_groupInfo && _groupInfo.props.features['training'])) 
			attr.values.push('iltsession');
		if (cm.type == 'milestone' || (_groupInfo && _groupInfo.props.features['etm'])) 
			attr.values.push('milestone');
		return;
	}

    function _onBooleanClick(e, attr, item) {
        item[attr.name] = !item[attr.name];
        _onAttrChange(e, attr, item);
    }

    function _onAttrChange(e, attr, item) {
        if (attr.level == 'course' && attr.name == 'name') {
            var title = item.name;
            if(!title)
                nlDlg.popupAlert({title: nl.t('Name is mandatory'), 
                    template: nl.t('Name of the course cannot be empty.')});
            else if (title.length === 30)
                nlDlg.popupAlert({title: nl.t('Name too long'), 
                    template: nl.t('It is recommended to keep the course name under 30 characters.')});
            else
                nl.pginfo.pageTitle = title;
            return;
        } else if (attr.level == 'content' && attr.name == 'canvasview') {
            nlCourseCanvas.updateCanvasMode();
            return;
        } else if (attr.level == 'modules' && attr.name == 'type') {
            attr.updateDropdown(item, attr);
            if (attr.name == 'type') _onElementTypeChange(e, item);
            return;
        }
    }

	function _onElementTypeChange(e, cm){
        var childrenElem = [];
        for(var i=0; i < _allModules.length; i++){
        	if (_isDescendantOf(_allModules[i], cm)) childrenElem.push(i);
        }
		if(cm.type !== 'module' && childrenElem.length > 1){
			var msg = {title: 'Please confirm', 
				   template: nl.t('If you change type from folder to other, the children elements will be removed. Are you sure to proceed?'),
				   okText: nl.t('Yes')};
			nlDlg.popupConfirm(msg).then(function(result){
				if(!result) return cm['type'] = 'module';
				var indicesToRemove = [];
		        for(var i=0; i < _allModules.length; i++){
		        	if (_isDescendantOf(_allModules[i], cm)) indicesToRemove.push(i);
		        }
		        indicesToRemove.splice(0, 1);
		        _removeElements(indicesToRemove);
                $scope.editorCb.updateChildrenLinks(_allModules);               
				$scope.editorCb.showVisible(cm);
			});
		}
	}

	function _validateTextField(value, attr){
	    if (!attr.maxlen) return;
		if(value.length === attr.maxlen) {
			var msg = {
			    title: nl.t('{} is too long', attr.text||attr.name), 
			    template: nl.t('{} must be less than {} character.', attr.text||attr.name, attr.maxlen)};
			nlDlg.popupAlert(msg).then(function(res){
				if(res) return;
			});
		}
	}

	function _editAttribute(e, cm, attr) {
		if (attr.name == 'start_after') {
			var dlg = new StartAfterDlg(nl, nlDlg, $scope, _allModules, cm);
			dlg.show();
		}
		if (attr.name == 'trainer_notes') {
			var dlg = new TrainerNotesDlg(nl, nlDlg, $scope, _allModules, cm, nlLessonSelect, _userInfo);
			dlg.show();
		}
	}
	
	function _showWikiMarkupPreview(e, cm, attr) {
		attr.showPreview = !attr.showPreview;
		nl.resizeHandler.broadcast('nl-adjust-height');
        var retData = {lessPara: true};
    	cm.textHtml = cm.text ? nlMarkup.getHtml(cm.text, retData): '';
	}
	
	function _getDisplayValue(cm, attr) {
		if (cm.start_after && attr.name == 'start_after') {
			var cnt  = cm.start_after.length;
			var plural = cnt > 1 ? 'dependencies' : 'dependency';
			return nl.fmt2('{} {} specified', cnt, plural);
		} else if(cm.trainer_notes && attr.name == 'trainer_notes'){
			var cnt  = cm.trainer_notes.length;
			var plural = cnt > 1 ? 'trainer notes' : 'trainer note';
			return nl.fmt2('{} {} added', cnt, plural);
		}
		return '';
	}
	
	function _getCourseParams() {
		var courseAttributes = {};
		for(var k in _courseParams) courseAttributes[_courseParams[k].name] = true;
		if (!('grade' in courseAttributes)) _courseParams.splice(1, 0, {name: 'grade', stored_at: 'metadata', text: _userInfo.groupinfo.gradelabel, type: 'tree-select', help:nl.t('Add {} to course', _userInfo.groupinfo.gradelabel)});
		if (!('subject' in courseAttributes)) _courseParams.splice(2, 0, {name: 'subject', stored_at: 'metadata', text: _userInfo.groupinfo.subjectlabel, type: 'tree-select', help:nl.t('Add {} to course', _userInfo.groupinfo.subjectlabel)});
		return _courseParams;
	}
	
	function _getTreeOptions() {
		var selectedGrade = {};
		var selectedSubject = {};
		if(!('contentmetadata' in modeHandler.course.content)) modeHandler.course.content.contentmetadata = {};
		if(modeHandler.course.content.contentmetadata.grade) {
			selectedGrade[modeHandler.course.content.contentmetadata.grade] = true;
		} else {
			selectedGrade[_userInfo.groupinfo.grades[0]] = true;
			modeHandler.course.content.contentmetadata.grade = _userInfo.groupinfo.grades[0];
		}
		if(modeHandler.course.content.contentmetadata.subject) {
			selectedSubject[modeHandler.course.content.contentmetadata.subject] = true;
		} else {
			selectedSubject[_userInfo.groupinfo.subjects[0]] = true;
			modeHandler.course.content.contentmetadata.subject = _userInfo.groupinfo.subjects[0];
		}
       	var _gradeInfo = {data: nlTreeSelect.strArrayToTreeArray(_userInfo.groupinfo.grades || [])};
        nlTreeSelect.updateSelectionTree(_gradeInfo, selectedGrade);
        _gradeInfo.treeIsShown = false;
        _gradeInfo.multiSelect = false;
		_gradeInfo.fieldmodelid = 'grade';
		_gradeInfo.onSelectChange = function() {
			modeHandler.course.content.contentmetadata.grade = Object.keys(nlTreeSelect.getSelectedIds(_gradeInfo))[0];
		};
        
       	var _subjectInfo = {data: nlTreeSelect.strArrayToTreeArray(_userInfo.groupinfo.subjects || [])};
        nlTreeSelect.updateSelectionTree(_subjectInfo, selectedSubject);
        _subjectInfo.treeIsShown = false;
        _subjectInfo.multiSelect = false;
		_subjectInfo.fieldmodelid = 'subject';
		_subjectInfo.onSelectChange = function() {
			modeHandler.course.content.contentmetadata.subject = Object.keys(nlTreeSelect.getSelectedIds(_subjectInfo))[0];
		};
		return {grade: _gradeInfo, subject: _subjectInfo};
	}

    var _courseParams = [
        {name: 'name', stored_at: 'course', text: 'Name', type: 'string', isTitle: true},
        {name: 'icon', stored_at: 'course', text: 'Image', type: 'icon', icon: true},
        {name: 'description', stored_at: 'course', text: 'Course description', type: 'text', maxlen: 100},
        {name: 'grp_additionalAttrs', stored_at: 'content', type: 'group', text: 'Advanced properties'},
    	{name: 'planning', stored_at: 'content', text:'Schedule planning', desc: 'Enable schedule planning for this course', group: 'grp_additionalAttrs', type: 'boolean'},
     	{name: 'hide_answers', stored_at: 'content', text:'Hide answers', desc: 'Disallow learners to view completed modules', group: 'grp_additionalAttrs', type: 'boolean'},
 	  	{name: 'certificate', stored_at: 'content', text: 'Certificate configuration', type: 'hidden', group: 'grp_additionalAttrs'},
    	{name: 'custtype', stored_at: 'content', text: 'Custom type', type: 'number', group: 'grp_additionalAttrs'},
        {name: 'exportLevel', stored_at: 'content', text: 'Visibility', type: 'list', values: [], valueNames: {}, group: 'grp_additionalAttrs'},
        {name: 'contentmetadata', stored_at: 'metadata', text: 'Metadata', type: 'object', group: 'grp_additionalAttrs', debug: true},
    	{name: 'lastId', stored_at: 'content', text: 'Last Id', type: 'readonly', group: 'grp_additionalAttrs', debug: true},
        {name: 'modules', stored_at: 'content', text: 'Modules', type: 'hidden', group: 'grp_additionalAttrs', debug: true},
        {name: 'contentVersion', stored_at: 'content', text: 'Content Version', type: 'hidden', group: 'grp_additionalAttrs', debug: true},
        {name: 'grp_canvasAttrs', stored_at: 'content', type: 'group', text: 'Canvas properties'},
        {name: 'canvasview', stored_at: 'content', type: 'boolean', text: 'Canvas mode', desc: 'View the course in a visual canvas mode', group: 'grp_canvasAttrs'},
        {name: 'bgimg', stored_at: 'content', type: 'string', text: 'Background image', group: 'grp_canvasAttrs'},
        {name: 'bgcolor', stored_at: 'content', type: 'string', text: 'Background color', group: 'grp_canvasAttrs'}
    ];
    
    var _courseParamsHelp = {
        name: 'Mandatory - enter a name for your course. It is recommended to keep the course name under 30 characters.',
        icon: 'Mandatory - enter a URL for the course icon that will be displayed when this course is searched. The default value is "icon:" which displays a default course icon.',
        description: 'Provide a short description which will help others in the group to understand the purpose of this course. It is recommended to keep the course description under 100 characters.',
    	planning: 'Start and end dates are considered only if schedule planning is enabled.',
    	hide_answers: 'Enable this attribute if this course is for assessment purpose and you would like to disallow the learners to see the correct answers.',
    	custtype: 'You can define a custom type to help in searchability.',
        exportLevel: 'This property is visible only if the group has option to export content to other groups.',
        contentmetadata: 'Metadata attributes.',
    	lastId: 'Internally used.',
        grp_canvasAttrs: 'Canvas mode is a visual represenation of course where laarning items are placed in the backdrop of an image. Learners will be able to navigate into the specific section in a more visual way.',
        canvasview: 'You can create a visual game like courses when you enable this mode. In this mode, learners will view the course items in a visual canvas instead of a structured tree. Each folder in the course will open into another canvas with the sub-items represented in the canvas.',
        bgimg: 'Select the background image to be displayed in the canvas.',
        bgcolor: 'The background image is resized to retain aspect ratio. This could result in horizontal or vertical bands. You can choose the color of the bands to align with the edge of the image.'
    };
    
    var moduleAttrs = [
        {name: 'name', stored_at: 'module', fields: ['module', 'lesson', 'link', 'info', 'certificate', 'iltsession', 'milestone'], type: 'string', text: 'Name'}, 
        {name: 'type', stored_at: 'module', fields: ['module', 'lesson', 'link', 'info', 'certificate', 'iltsession', 'milestone'], type: 'list', text: 'Element type', values: ['module', 'lesson', 'certificate', 'info', 'link', 'iltsession', 'milestone'],
            valueNames: {'module': 'Folder', 'lesson': 'Module', 'link': 'Link', 'info': 'Information', 'certificate': 'Certificate', 'iltsession': 'ILT session', 'milestone': 'Milestone'},
            updateDropdown: _updateTypeDropdown},
        {name: 'completionPerc', stored_at: 'module', fields: ['milestone'], text: 'Completion percentage',type: 'number', max:100},
        {name: 'refid', stored_at: 'module', fields: ['lesson'], type: 'lessonlink', contentType: 'integer', text: 'Module-id'},
		{name: 'maxDuration', stored_at: 'module', fields: ['lesson'], type: 'string', contentType: 'integer', text: 'Time limit (minutes)'},
        {name: 'action', stored_at: 'module', fields: ['link'], type: 'lessonlink', text: 'Action'},
        {name: 'urlParams', stored_at: 'module', fields: ['link'], type: 'string', text: 'Url-Params'},
        {name: 'certificate_image', stored_at: 'module', fields: ['certificate'], type: 'string', text: 'Certificate image'},
        {name: 'trainer_notes', stored_at: 'module', fields: ['iltsession'], type: 'object_with_gui', contentType: 'object', text: 'Trainer notes'},
        {name: 'start_after', stored_at: 'module', fields: ['lesson', 'link', 'info', 'certificate', 'iltsession', 'milestone'], type: 'object_with_gui', contentType: 'object', text: 'Start after'},
        {name: 'canMarkAttendance', stored_at: 'module', text: 'Learner can mark attendance', type:'hidden', fields: ['iltsession']},
        {name: 'iltduration', stored_at: 'module', fields: ['iltsession'], text: 'Session duration (minutes)',type: 'number'},
        {name: 'grp_depAttrs', stored_at: 'module', fields: ['lesson', 'link', 'info'], type: 'group', text: 'Planning'},
        {name: 'start_date', stored_at: 'module', fields: ['lesson', 'link', 'info'], type: 'date', text: 'Start date', group: 'grp_depAttrs'},
        {name: 'planned_date', stored_at: 'module', fields: ['lesson', 'link', 'info'], type: 'date', text: 'Planned date', group: 'grp_depAttrs'},
        {name: 'grp_additionalAttrs', stored_at: 'module', fields: ['module', 'lesson', 'link', 'info', 'certificate', 'iltsession', 'milestone'], type: 'group', text: 'Advanced properties'},
        {name: 'reopen_on_fail', stored_at: 'module', fields: ['lesson'], type: 'object', text: 'Reopen on fail', contentType: 'object',group: 'grp_additionalAttrs'},
        {name: 'icon', stored_at: 'module', fields: ['module', 'lesson', 'link', 'info', 'certificate', 'iltsession'], type: 'string', text: 'Icon', group: 'grp_additionalAttrs'},
        {name: 'text', stored_at: 'module', fields: ['module', 'lesson', 'link', 'info', 'certificate', 'iltsession'], type: 'wikitext', valueName: 'textHtml', text: 'Description', group: 'grp_additionalAttrs'},
        {name: 'maxAttempts', stored_at: 'module', fields: ['lesson'], type: 'number', text: 'Maximum attempts', group: 'grp_additionalAttrs'},
        {name: 'hide_remarks', stored_at: 'module', fields: ['info', 'link'], type: 'boolean', text: 'Disable remarks', group: 'grp_additionalAttrs'},
        {name: 'autocomplete', stored_at: 'module', fields: ['link'], type: 'boolean', text: 'Auto complete',  desc: 'Mark as completed when viewed the first time', group: 'grp_additionalAttrs'},
        {name: 'parentId', stored_at: 'module', fields: ['module', 'lesson', 'link', 'info', 'certificate', 'iltsession'], type: 'readonly', debug: true, text: 'Parent ID', group: 'grp_additionalAttrs', readonly: true}, 
        {name: 'id', stored_at: 'module', fields: ['module', 'lesson', 'link', 'info', 'certificate', 'iltsession', 'milestone'], type: 'readonly', text: 'Unique ID', group: 'grp_additionalAttrs', readonly: true}, 
    	{name: 'totalItems', stored_at: 'module', fields : ['module'], type: 'readonly', text: 'Total items', group: 'grp_additionalAttrs'},
        {name: 'grp_canvasAttrs', stored_at: 'module', type: 'group', text: 'Canvas properties', fields: ['module', 'lesson', 'link', 'info', 'certificate', 'iltsession']},
        {name: 'posX', stored_at: 'module', type: 'number', text: 'X Position', group: 'grp_canvasAttrs', fields: ['module', 'lesson', 'link', 'info', 'certificate', 'iltsession']},
        {name: 'posY', stored_at: 'module', type: 'number', text: 'Y Position', group: 'grp_canvasAttrs', fields: ['module', 'lesson', 'link', 'info', 'certificate', 'iltsession']},
        {name: 'bgimg', stored_at: 'module', type: 'string', text: 'Background image', group: 'grp_canvasAttrs', fields: ['module']},
        {name: 'bgcolor', stored_at: 'module', type: 'string', text: 'Background color', group: 'grp_canvasAttrs', fields: ['module']}
    ];
    
    var _moduleAttrHelp = {
    	name: 'Name of the item to be displayed in the course tree.',
    	type: 'Each item could be a Folder (containing other items), Module (a learning module/quiz), Certificate or Information (example a declaration).',
    	refid: 'The id of the learning module/quiz to be launched. You could search for all approved modules by clicking on the search icon. Click on the link icon to preview the module.',
    	maxDuration: 'You may restrict the learner to complete the module within the specified time limit. This values is pre-filled with the estimated time of module if configured in the module. You could clear this field (or set it to 0) if you do not want any time limit set for the module.',
    	action: 'The action whose URL is used for the link. Click on the icon to view the link',
    	urlParams: 'The urlParams to append to the URL (see Dashboard create/modify dialog for more information).',
    	certificate_image: 'Provide a background image for your certificates.',
    	grp_depAttrs: 'Enabling this would display planning properties such as "Start date" and "Planned date".',
    	start_date: 'Earliest planned start date. Is applicable only if "planning" is set to true for the course.',
    	planned_date: 'Expected planned completion date. Is applicable only if "planning" is set to true for the course.',
    	grp_additionalAttrs: 'Enabling this would display additional properties depeneding on the selected "Element type" of the module.',
    	trainer_notes: 'You could attach a set of approved modules as trainer notes for current item. These trainer notes are visible only for the trainer not for learners.',
    	start_after: 'You could specify a set of prerequisite conditions that have to be met for current item. Only after all the specified conditions are met, the curent item is made available to the learner. If the prerequisites are not met, this current item is shown in a locked state to the learner.',
    	reopen_on_fail: 'You could reopen a set of learning modules if the learner failed in the quiz. To do this, you need to configure this property on the quiz module. You can list the items (refered by their unique id) which have to be reopened if the learner failed to acheive minimum pass score in the current module. This property is a JSON string representing an array of strings: each string is unque id of the item that should be re-opened.<br> Example:<br></div><pre>["_id1", "_id2"]</pre></div>',
		icon: 'Icon to be displayed for this item in the course tree. If not provided, this is derived from the type. "quiz" is a predefined icon.',
		text: _getDescriptionHelp(),
		maxAttempts: 'Number of time the learner can do this module. Only the learning data from the last attempt is considered. 0 means infinite. 1 is the default.',
		hide_remarks: 'By default the learner will be shown a text field where the learner can add remarks. This behavior can be disabled by checking this flag.',
		autocomplete: 'If this flag is checked, the link is automatically marked completed when the learner views for the first time.',
		parentId: 'Defines the unique id of the folder item under which the current module is located.',
		id: 'Defines the unique id of the current item. This is automatically generated.',
		totalItems: 'Displays the number of total modules the folders currently has.',
        grp_canvasAttrs: 'Canvas mode is a visual represenation of course where laarning items are placed in the backdrop of an image. Learners will be able to navigate into the specific section in a more visual way.',
        posX: 'Define the horizontal position of this item in the canvas as a percentage number. Left end of the screen is 0 and the right end is 100.',
        posY: 'Define the vertical position of this item in the canvas as a percentage number. Top end of the screen is 0 and the bottom end is 100.',
        bgimg: 'Select the background image to be displayed in the canvas when the folder is opened.',
        bgcolor: 'The background image is resized to retain aspect ratio. This could result in horizontal or vertical bands. You can choose the color of the bands to align with the edge of the image.',
        iltduration: 'The planned duration of the instructor led session in minutes.',
        completionPerc: 'You could let the trainer assess the progress of the course by setting completion percentage for milestone items. If milestone items are present, the completion for a course report is based on the latest milestone reached.',
        canMarkAttendance: 'Set this to allow learner to mark attendance'
    };
    
    function _getDescriptionHelp() {
    	return('<p>Provide a description which is shown in the content area / details popup when the element is clicked. You insert images/videos and style the content using the same markup tags supported by module editor. Markup syntax is as below:</p>' +
    		   '<ul><li>Use <b>img:</b> to add an image. (example: img:imageUrl)</li>' + 
    		   '<li>Use <b>video:</b> to add a video. (example: video:videoUrl)</li>' +
    		   '<li>Use <b>link:</b> to add an external link. (example: link:https://www.xxxxx.com[text="link name"|popup=1])</li>' +
    		   '<li>Use <b>audio:</b> to add an audio. (example: audio:audioUrl)</li>' +
    		   '<li>Use <b>H1, H2, H3, H4, H5, H6</b> attributes to mark a header line. (example: H1 Hello world!)</li>' +
    		   '<li>Use <b>- and #</b> to have bulleted list or numbered list respectively (example: - Hello world!)</li></ul>');
    }
    function _updateHelps(attrs, attrHelp, level) {
        for(var i=0; i<attrs.length; i++) {
            var attr = attrs[i];
            attr.level = level;
            attr.help = attrHelp[attr.name] || null;
        }
    }
    _updateHelps(_courseParams, _courseParamsHelp, 'course');
    _updateHelps(moduleAttrs, _moduleAttrHelp, 'modules');
    
    var allowedModuleAttrs = (function () {
    	var ret = {};
    	for(var i=0; i<moduleAttrs.length; i++) {
    		var attr = moduleAttrs[i];
    		for(var j=0;j< attr.fields.length; j++) {
    			var itemType = attr.fields[j];
    			if (!(itemType in ret)) ret[itemType] = {};
    			if(attr.name == 'totalItems') continue;
    			ret[itemType][attr.name] = {contentType: attr.contentType || 'string', 
    			 text: attr.text || attr.name, name: attr.name};
    		}
    	}
    	return ret;
    })();
    
    var allowedCourseAttrs = (function() {
        var ret = {};
        for(var i=0; i<_courseParams.length; i++) {
            var attr = _courseParams[i];
            if (attr.type == 'hidden') continue;
            ret[attr.name] = attr;
        }
        return ret;
    })();
    
    function _updateCourseAndModuleAttrOptions(userInfo) {
        var ginfo = userInfo ? userInfo.groupinfo || {} : {};
        var grpExportLevel = ginfo.exportLevel || nlExportLevel.EL_PRIVATE;
        if (grpExportLevel == nlExportLevel.EL_PUBLIC) grpExportLevel = nlExportLevel.EL_LOGEDIN;
        var info = nlExportLevel.getExportLevelInfo(grpExportLevel);
        
        var attr = allowedCourseAttrs.exportLevel;
        if (!attr) return;
        attr.values = info.elList;
        attr.valueNames = info.elDesc;
        if (grpExportLevel == nlExportLevel.EL_PRIVATE) {
            attr.type = 'hidden';
            delete allowedCourseAttrs.exportLevel;
        }
    }

    function _addModule(e, cm) {
        if(!_validateInputs(modeHandler.course, cm)) {
            if(e) e.preventDefault();
            return;
        }
    	var courseContent = modeHandler.course.content;
    	if (!('lastId' in courseContent)) courseContent.lastId = 0;
    	courseContent.lastId++;

        var newModule = {name: nl.t('Information {}', courseContent.lastId), type: 'info', id: '_id' + courseContent.lastId};
        if (!cm.parentId) {
        	// Current item is the root element: add as child of root element and at the top
        	newModule.parentId = '_root';
        	_allModules.splice(0, 0, newModule);
        } else if (cm.type == 'module' && cm.isOpen) {
        	// Current item is a folder and is open: add as first child of folder
        	newModule.parentId = cm.id;
        	var pos = _findPos(cm);
        	if (pos > -1) _allModules.splice(pos+1, 0, newModule);
        } else {
        	// Current item is closed folder or a leaf node: add as next sibling of current node
        	newModule.parentId = cm.parentId;
        	var pos = _findLastDescendantPos(cm);
        	if (pos > -1) _allModules.splice(pos+1, 0, newModule);
        }
		$scope.editorCb.initModule(newModule);
		newModule.isOpen = false;
		newModule.visible = true;
		$scope.editorCb.showVisible(newModule);
    }

    function _findPos(cm) {
    	for(var i=0; i<_allModules.length; i++) if (_allModules[i].id == cm.id) return i;
    	return -1;
    }

    function _findLastDescendantPos(cm) {
    	var lastPos = -1;
    	for(var i=0; i<_allModules.length; i++) {
    		if (_isDescendantOf(_allModules[i], cm)) lastPos = i;
    	}
    	return lastPos;
    }

    function _isDescendantOf(cm, parent) {
		while(cm) {
    		if (cm.id == parent.id) return true;
    		cm = $scope.editorCb.getParent(cm);
		}
    	return false;
    }

    function _deleteModule(e, cm) {
		var msg = {title: 'Please confirm', 
				   template: 'Are you sure you want to delete? This cannot be undone once you save.',
				   okText: nl.t('Delete')};
		nlDlg.popupConfirm(msg).then(function(res) {
			if(!res) return;
	    	var indicesToRemove = [];
	        for(var i=0; i < _allModules.length; i++){
	        	if (_isDescendantOf(_allModules[i], cm)) indicesToRemove.push(i);
	        }
	        _removeElements(indicesToRemove);
            $scope.editorCb.updateChildrenLinks(_allModules);
			$scope.editorCb.showVisible(null);
		});
    }

	function _removeElements(indicesToRemove) {
        for (var j = indicesToRemove.length -1; j >= 0; j--){
		    _allModules.splice(indicesToRemove[j],1);
		}
	}
	
	function _saveCourse(e, bPublish, cm){
	    if(!_validateInputs(modeHandler.course, cm)) return;
		if (!bPublish) {
			_saveAfterValidateCourse(e, bPublish);
			return;
		}
		var templateMsg = nl.t('Are you sure you want to publish this course?');
		var msg = {title: 'Please confirm', 
				   template: templateMsg,
				   okText: nl.t('Publish')};
		nlDlg.popupConfirm(msg).then(function(res) {
			if(!res) return;
	    	_saveAfterValidateCourse(e, bPublish);
		});		
	}

    function _saveAfterValidateCourse(e, bPublish) {
        modeHandler.course.content.modules = [];
        modeHandler.course.content.blended = false;
    	for(var i=0; i<_allModules.length; i++){
    	    var newModule = _getSavableModuleAttrs(_allModules[i]);
    	    if (newModule.type == 'iltsession' && !modeHandler.course.content.blended) modeHandler.course.content.blended = true;
		    modeHandler.course.content.modules.push(newModule);
		}
        var modifiedData = {
                        name: modeHandler.course.name, 
                        icon: modeHandler.course.icon, 
                        description: modeHandler.course.description,
                        content: _objToJson(modeHandler.course.content) 
                    };
        if(modeHandler.course.id) modifiedData.courseid = modeHandler.course.id;
        modifiedData.publish = bPublish;
        _modifyAndUpdateToServer(modifiedData);    
    }
    
	function _objToJson(obj) {
		if (!obj) return '';
		return angular.toJson(obj, 2);
	}
	
	function _jsonToObj(json, status) {
	    status.error = null;
		if (!json) return undefined;
		var ret = undefined;
		try {
		    ret = angular.fromJson(json);
		} catch(e) {
		    status.error = e;
		    return undefined;
		}
		return ret;
	}

	function _initEditorTempJson(cm) {
		$scope.editor.jsonTempStore = {};
    	if (!cm || cm.id == '_root') {
            _updateCourseAttrsInJsonTempStore(modeHandler.course.content);
	        return;
    	}
    	var allowedAttributes = allowedModuleAttrs[cm.type] || {};
    	var attrs = Object.keys(cm);
    	for(var i=0; i<attrs.length; i++) {
    		var attr = attrs[i];
    		var allowedAttr = allowedAttributes[attr];
            if (allowedAttr && allowedAttr.contentType != 'object') continue;
	    	$scope.editor.jsonTempStore[attr] = _objToJson(cm[attr]);
	    }
    }
    
    function _updateCourseAttrsInJsonTempStore(content) {
        for(var key in content) {
            if (!(key in allowedCourseAttrs)) continue;
            var attr =  allowedCourseAttrs[key];
            if (attr.type != 'object') continue;
            $scope.editor.jsonTempStore[key] = _objToJson(content[key]);
        }
    }
    
    function _updateObjectFromEditor(cm, errorLocation) {
        var allowedAttributes = allowedModuleAttrs[cm.type] || {};
    	var attrs = Object.keys(allowedAttributes);
    	for(var i=0; i<attrs.length; i++) {
    		var attr = attrs[i];
    		if (!(attr in allowedAttributes)) continue;
    		var allowedAttr = allowedAttributes[attr];
            if (allowedAttr.contentType == 'integer') {
                try {
                    cm[attr] = parseInt(cm[attr]);
                } catch (e) {
                    errorLocation.title = allowedAttr.text;
                    errorLocation.template = nl.t('Please enter a valid value for {}', allowedAttr.text);
                    return false;
                }
            } else if (allowedAttr.contentType == 'object') {
                var status = {};
            	cm[attr] = _jsonToObj($scope.editor.jsonTempStore[attr], status);
            	if (status.error !== null) {
                    errorLocation.title = allowedAttr.text;
                    errorLocation.template = nl.t('Please enter a valid JSON string for {}', allowedAttr.text);
            	    return false;
            	}
            }
    	}
    	return true;
    }
	
    function _getSavableModuleAttrs(cm) {
        var allowedAttributes = allowedModuleAttrs[cm.type] || [];
    	var attrs = Object.keys(allowedAttributes);
        var editedModule = {};
        for(var i=0; i<attrs.length; i++){
            var attr = attrs[i];
            if (!(attr in allowedAttributes)) continue;
            var allowedAttr = allowedAttributes[attr];
            if(cm[attr] === null || cm[attr] === undefined || cm[attr] === '') continue;
            editedModule[attr] = cm[attr];
        }
		if(cm.type == 'certificate') {
            editedModule['action']= 'none'; 
            editedModule['hide_remarks']= true;
            editedModule['autocomplete']= true; 

            // Not /#/course_cert as same URL (/) will not be loaded 
            // in iframe by some browser
            editedModule['urlParams']= '/default/home/#/course_cert';
	    }
        return editedModule;
    }
	
    function _searchLesson(e, cm){
    	nlLessonSelect.showSelectDlg($scope, _userInfo).then(function(selectionList) {
    		if (selectionList.length != 1) return;
    		cm.refid = selectionList[0].lessonId;
    		cm.maxDuration = selectionList[0].esttime;
    		cm.name = selectionList[0].title;
    	});
    };

	function _organiseModulesDlg(e, cm){
		if(!_validateInputs(modeHandler.course, cm)) return;
		_organiseModules(e, cm);
	};

    function _validateInputs(data, cm) {
        var errorLocation = {};
        var retData = {lessPara: true};
    	cm.textHtml = cm.text ? nlMarkup.getHtml(cm.text, retData): '';
        var ret = _validateInputsImpl(data, cm, errorLocation);
        if (!ret) {
            nlDlg.popupAlert({title: nl.t('Error: {}', errorLocation.title), template:errorLocation.template});
        }
        return ret;
    }
    
    function _validateInputsImpl(data, cm, errorLocation) {
        if(!data.content) return _validateFail(errorLocation, 'Content', 'Course content is mandatory');
    	if (!data.content.modules) return _validateFail(errorLocation, 'Content', '"modules" field is expected in content');

    	if (cm && cm.id != '_root') {
            if (!_updateObjectFromEditor(cm, errorLocation)) return false;
    	} else if (!_updateCourseAttrsFromJsonTempStore(data.content, errorLocation)) {
            return false;
    	}

    	if (cm && cm.id != '_root') return _validateModule(data, cm, errorLocation);

        if(!data.name) return _validateFail(errorLocation, 'Name', 'Course name is mandatory');
        if(!data.icon) return _validateFail(errorLocation, 'Icon', 'Course icon URL is mandatory');
        if(!_validateContent(data, errorLocation)) return false;            
        return true;
    }

    function _updateCourseAttrsFromJsonTempStore(content, errorLocation) {
        for(var key in allowedCourseAttrs) {
            if (!((key in content) || (key in $scope.editor.jsonTempStore))) continue;
            var attr =  allowedCourseAttrs[key];
            if (attr.type != 'object') continue;
			if (attr.name == 'contentmetadata') continue;

            var status = {};
            content[key] = _jsonToObj($scope.editor.jsonTempStore[key], status);
            if (status.error !== null) {
                errorLocation.title = attr.text||attr.name;
                errorLocation.template = nl.t('Please enter a valid JSON string for {}', 
                    errorLocation.title);
                return false;
            }
        }
        return true;
    }
    
    function _validateContent(data, errorLocation) {
    	var modules = _allModules; //data.content.modules was used, but it is not updated on deleting the item causes error in milestone computation
        if (modules.length < 1) return _validateFail(errorLocation, 'Error', 
            'Atleast one course module object is expected in the content');
        for(var i=0; i<modules.length; i++){
            var module = modules[i];
            if (!_validateModule(data, module, errorLocation)) return false;
        }
        return true;
    }

    function _validateModule(data, module, errorLocation) {
        if (!module.id) return _validateFail(errorLocation, 'Unique-id', 'Unique-id is mandatory', module);
        if (!module.name) return _validateFail(errorLocation, 'Name', 'Name is mandatory', module);
        if (!module.type) return _validateFail(errorLocation, 'Element type', 'Element type is mandatory', module);

        if (!_validateModuleType(errorLocation, module)) return false;
        if (!_validateModuleDate(errorLocation, module, 'planned_date')) return false;
        if (!_validateModuleDate(errorLocation, module, 'start_date')) return false;
        if (!_validateLessonModule(errorLocation, module)) return false;
        if (!_validateLinkModule(errorLocation, module)) return false;
        if (!_validateInfoModule(errorLocation, module)) return false;
		if (!_validateILTSessionModule(errorLocation, module)) return false;
		if (!_validateMilestoneModule(errorLocation, module)) return false;
        return true;
    }
    
    function _validateModuleType(errorLocation, module) {
    	if(module.type in allowedModuleAttrs) return true;
    	var msg = 'Element type is not valid';
        return _validateFail(errorLocation, 'Element type', msg, module);
    }

    function _validateModuleDate(errorLocation, module, attr) {
    	if (!module[attr]) return true;
    	var d = nl.fmt.json2Date(module[attr]);
        if (!isNaN(d.valueOf())) return true;
    	return _validateFail(errorLocation, attr, nl.t('Incorrect {}', attr), module);
    }
    
    function _validateLessonModule(errorLocation, module) {
    	if(module.type != 'lesson') return true;
        if(!module.refid) return _validateFail(errorLocation, 'Module-id', 'Module-id is mandatory', module);
        if(!angular.isNumber(module.refid)) return _validateFail(errorLocation, 'Module-id', 'Module-id seems incorrect', module);
        return true;
    }

    function _validateLinkModule(errorLocation, module) {
    	if(module.type != 'link') return true;
        if(!module.action) return _validateFail(errorLocation, 'Action', 'Action is mandatory', module);
        if(!module.urlParams) return _validateFail(errorLocation, 'Url-Params', 'Url-Params is mandatory', module);
        return true;
    }
    
    function _validateInfoModule(errorLocation, module) {
    	if(module.type != 'info') return true;
        return true;
    }
    
    function _validateILTSessionModule(errorLocation, module) {
    	if(module.type != 'iltsession') return true;
        if(!module.iltduration) return _validateFail(errorLocation, 'Session duration', 'Session duration is mandatory', module);
    	return true;
    }
    
    function _validateMilestoneModule(errorLocation, module) {
    	if(module.type != 'milestone') return true;
		if(!module.completionPerc) return _validateFail(errorLocation, 'Completion percentage', 'Completion percentage is mandatory.', module);
		if(!_checkMilestonePercentage(module)) return _validateFail(errorLocation, 'Completion percentage', 'Completion percentage for this milestone should be greater than completion percentage of earlier milestone item.', module);
    	return true;
    }
	
	function _checkMilestonePercentage(module) {
		for(var i=0; i<_allModules.length; i++) {
			var item = _allModules[i];
			if(item.type != 'milestone') continue;
			if(module.id == item.id) break;
			if(item.completionPerc >= module.completionPerc) return false;
		}
		return true;
	}

    function _getParentId(idStr) {
        var parents = idStr.split('.');
        parents.pop(); // Remove the last entry
        return parents.join('.');
    }
    
    function _validateFail(errorLocation, attr, errMsg, cm) {
        errorLocation.title = attr;
        errorLocation.template = nl.fmt2('<p><b>Error:</b> {}</p>', errMsg);
        if(cm) {
            errorLocation.template += nl.fmt2('<p><b>Item:</b> {}</p>', cm.name);
        }
    	return false;
    }

	function _getLaunchUrl(id) {
    	return nl.fmt2('/lesson/view/{}', id);
	}
	
    function _onLaunch($event, cm){
    	if(!_validateInputs(modeHandler.course, cm)) {
    		return;
    	} else {
	    	$scope.editorCb.launchModule($event, cm);			
    	}
    }
    
    function _organiseModules(e, cm){
    	var _organiseModuleDlg = nlDlg.create($scope);
		_organiseModuleDlg.setCssClass('nl-height-max nl-width-max');
		_organiseModuleDlg.scope.data = {};
		_organiseModuleDlg.scope.data.title = nl.t('Reorder the modules');
		_organiseModuleDlg.scope.data.modules = _allModules;
		_organiseModuleDlg.scope.moveItem = function(item, fromIndex, toIndex){
			_moveItem(item, fromIndex, toIndex);
		};
		var closeButton = {text : nl.t('Close'), onTap: function(e){
            $scope.editorCb.updateChildrenLinks(_allModules);
			$scope.editorCb.showVisible(null);
		}};
		_organiseModuleDlg.show('view_controllers/course/editor/course_organiser.html', [], closeButton, false);
    }
    
	function _moveItem(movedItem, fromIndex, toIndex) {
		$scope.editorCb.moveItem(movedItem, fromIndex, toIndex, _allModules);
		$scope.editorCb.showVisible(null);
	};

    
    function _modifyAndUpdateToServer(modifiedData){
        nlDlg.showLoadingScreen();
		var popupMsg = modifiedData.publish ? 'Published' : 'Course saved';
		var icon = modifiedData.publish ? 'ion-checkmark-circled' : '';
        nlServerApi.courseModify(modifiedData).then(function(course) {
			nlDlg.hideLoadingScreen();
			nlDlg.popupStatus2({popdownTime: 2000, showClose: false, icon: icon,
			msg: popupMsg});

        });
    }
}];

//-------------------------------------------------------------------------------------------------
function TrainerNotesDlg(nl, nlDlg, $scope, _allModules, cm, nlLessonSelect, _userInfo) {
	var dlg = nlDlg.create($scope);

	this.show = function() {
		dlg.setCssClass('nl-height-max nl-width-max');
		dlg.scope.dlgTitle = nl.t('Configure trainer notes');
		dlg.scope.trainerNotesList = _getTrainerNotesListFromCm();
	    dlg.scope.searchLesson = function(e, $index){
	    	nlLessonSelect.showSelectDlg($scope, _userInfo).then(function(selectionList) {
	    		if (selectionList.length != 1) return;
	    		var ret = {id: selectionList[0].lessonId, name: selectionList[0].title};
	    		dlg.scope.trainerNotesList.splice($index, 1, ret);
	    	});
	    };
		var okButton = {text: nl.t('Ok'), onTap: function(e) {
			_onOk(e);
		}};
		var closeButton = {text: nl.t('Cancel')};
		dlg.show('view_controllers/course/editor/course_trainer_notes_configure.html', [okButton], closeButton);

	};

	function _getTrainerNotesListFromCm() {
		var ret = [];
		var items = cm.trainer_notes || [];
		for(var i=0; i<items.length; i++) {
			var item = items[i];
			ret.push({id: item.id, name:item.name, error: ''});
		}
		if(ret.length == 0) ret.push({});
		return ret;
	}

	function _onOk(e) {
		var modulesFromGui = dlg.scope.trainerNotesList;
		var modulesToStore = [];
		var foundModuleIds = {};
		_errorFound = false;
		for(var i=0; i<modulesFromGui.length; i++) {
			var item = modulesFromGui[i];
			if(item.id === undefined) continue;
			if(item.id in foundModuleIds) {
				_validateFail(item, 'This trainer note is already added.');
				continue;
			}
			foundModuleIds[item.id] = true;
			var moduleToStore = {id: item.id, name: item.name};
			_validateSuccess(item);
			modulesToStore.push(moduleToStore);
		}
		
		if (_errorFound) {
	        if(e) e.preventDefault();
	        return;
		}
		
		cm.trainer_notes = modulesToStore;
		if (modulesToStore.length == 0) delete cm.trainer_notes;
		$scope.editorCb.showVisible(cm);
	}

	function _validateSuccess(item) {
		item.error = null;
		return true;
	}

	var _errorFound = false;
	function _validateFail(item, msg) {
		item.error = msg;
		_errorFound = true;
	}
}

//-------------------------------------------------------------------------------------------------
function StartAfterDlg(nl, nlDlg, $scope, _allModules, cm) {

	var dlg = nlDlg.create($scope);

	this.show = function() {
		dlg.setCssClass('nl-height-max nl-width-max');
		dlg.scope.dlgTitle = nl.t('Configure dependencies');
		dlg.scope.showMaxScore = true;
		dlg.scope.moduleOptions = _getAvailableModules();
		if(dlg.scope.moduleOptions.length == 0) {
			var msg = {title: nl.t('Error'), template: nl.t('It is not possible to configure start after for the first item.')};
			nlDlg.popupAlert(msg);
			return;
		}
		dlg.scope.moduleList = _getModuleListFromCm();
		var okButton = {text: nl.t('Ok'), onTap: function(e) {
			_onOk(e);
		}};
		var closeButton = {text: nl.t('Cancel')};
		dlg.show('view_controllers/course/editor/course_start_after_configure.html', [okButton], closeButton);
	};

	function _getModuleListFromCm() {
		var ret = [];
		var items = cm.start_after || [];
		for(var i=0; i<items.length; i++) {
			var item = items[i];
			ret.push({module: {id: item.module}, min_score: item.min_score || '', max_score: item.max_score || '', error: ''});
		}
		if(ret.length == 0) ret.push({});
		return ret;
	}

	function _onOk(e) {
		var modulesFromGui = dlg.scope.moduleList;
		var modulesToStore = [];
		var foundModuleIds = {};
		_errorFound = false;
		for(var i=0; i<modulesFromGui.length; i++) {
			var item = modulesFromGui[i];
			if(item.module === undefined) continue;
			if(item.module.id in foundModuleIds) {
				_validateFail(item, 'Dependency to this item is already set above');
				continue;
			}
			foundModuleIds[item.module.id] = true;
			var moduleToStore = {module: item.module.id};
			if (item.min_score) moduleToStore.min_score = parseInt(item.min_score);
			if (item.max_score) moduleToStore.max_score = parseInt(item.max_score);
			if (moduleToStore.min_score < 0 || moduleToStore.min_score > 100) {
				_validateFail(item, 'Minimum score % has to be between 0 and 100');
				continue;
			}
			if (moduleToStore.max_score < 0 || moduleToStore.max_score > 100) {
				_validateFail(item, 'Maximum score % has to be between 0 and 100');
				continue;
			}
			if (moduleToStore.max_score < moduleToStore.min_score) {
				_validateFail(item, 'Maximum score cannot be smaller than minimmum score');
				continue;
			}
			_validateSuccess(item);
			modulesToStore.push(moduleToStore);
		}
		if (_errorFound) {
	        if(e) e.preventDefault();
	        return;
		}
		cm.start_after = modulesToStore;
		if (modulesToStore.length == 0) delete cm.start_after;
		$scope.editorCb.showVisible(cm);
	}
	
	var _errorFound = false;
	function _validateFail(item, msg) {
		item.error = msg;
		_errorFound = true;
	}

	function _validateSuccess(item) {
		item.error = null;
		return true;
	}
	
	function _getAvailableModules() {
		var availableIdsArray = [];
		for(var i=0; i<_allModules.length; i++) {
			var item = _allModules[i];
			if(item.id == cm.id) break;
			if(item.type == 'module') continue;
			var dict = {id: item.id, name:item.name};
			availableIdsArray.push(dict);
		}
		return availableIdsArray;
	}
}
	
//-------------------------------------------------------------------------------------------------
module_init();
})();
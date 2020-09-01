(function() {

//-------------------------------------------------------------------------------------------------
// folder_view.js:
// Folder view course module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.folder_view', [])
    .config(configFn)
    .controller('nl.FolderViewCtrl', FolderViewCtrl)
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.folder_view', {
        url: '^/folder_view',
        views: {
            'appContent': {
                templateUrl: 'lib_ui/cards/cardsview.html',
                controller: 'nl.FolderViewCtrl'
            }
        }});
}];

var FolderViewCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlGetManyStore', 'nlDlg', 'nlCardsSrv', 'nlSendAssignmentSrv', 'nlMetaDlg', 'nlCourse', 'nlExpressionProcessor', 'nlChangeOwner',
function(nl, nlRouter, $scope, nlServerApi, nlGetManyStore, nlDlg, nlCardsSrv, nlSendAssignmentSrv, nlMetaDlg, nlCourse, nlExpressionProcessor, nlChangeOwner) {
    
    /* 
        * URLs handled
        * 'View published' : /folder_view?type=published_course&folder=grade or subject
        */
    
    var courseDict = {};
    var _type= null;
    var _folder = null;
    var _userInfo = null;
    var _searchMetadata = null;
    var _canManage = false;
    var _resultList = [];

    function _onPageEnter(userInfo) {
        _userInfo = userInfo;
        _canManage = nlRouter.isPermitted(_userInfo, 'assignment_manage');
        _initMilestoneDict();
        return nl.q(function(resolve, reject) {
            nlGetManyStore.init();
            _initParams();
            nl.pginfo.pageTitle = nl.t('Published courses');
            nl.pginfo.pageSubTitle = _getPageSubTitle();
            $scope.cards = {
                staticlist: [], 
                search: {onSearch: _onSearch, 
                    placeholder: nl.t('Enter course name/description')}
            };
            nlCardsSrv.initCards($scope.cards);
            _getDataFromServer(resolve);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);

    $scope.onCardInternalUrlClicked = function(card, internalUrl) {
        $scope.onCardLinkClicked(card, internalUrl);
    };

    $scope.onCardLinkClicked = function(card, linkid) {
        if (linkid === 'course_modify') {
            _modifyCourse($scope, card.courseId);
        } else if (linkid === 'course_metadata') {
            _metadataCourse($scope, card.courseId, card);
        } else if (linkid === 'fetch_more') {
            _fetchMore();
        } else if (linkid === 'course_assign'){
            var assignInfo = {assigntype: 'course', id: card.courseId, icon : card.icon2 ? 'icon:' : card.icon, 
                title: card.title, authorName: card.authorName, description: card.help,
                showDateField: true, enableSubmissionAfterEndtime: false, blended: card.blended};
                nlDlg.showLoadingScreen();
                nlServerApi.courseGet(card.courseId, true).then(function(course) {
                    nlDlg.hideLoadingScreen();
                    assignInfo['course'] = course;
                    var features = _userInfo.groupinfo.features;
                    var grpChecklist = features.courses && features.courses.coursePublishChecklist ? features.courses.coursePublishChecklist : [];
                    if (grpChecklist && grpChecklist.length > 0) {
                        var checklist = course.content.checklist || [];
                        var msg = nlCourse.getCheckListDialogParams(grpChecklist, checklist);
                        if (msg) {
                            nlDlg.popupConfirm({title: 'Warning', template: msg, okText: 'Continue'}).then(function(res) {
                                if (!res) return;
                                nlSendAssignmentSrv.show($scope, assignInfo, _userInfo);						
                            });	
                        } else {
                            nlSendAssignmentSrv.show($scope, assignInfo, _userInfo);
                        }
                    } else {
                        nlSendAssignmentSrv.show($scope, assignInfo, _userInfo);						
                    }
                });
        } else if (linkid === 'course_report') {
            _showCourseReport(card.courseId);
        } else if (linkid == 'course_copy') {
            _copyCourse($scope, card);
        } else if (linkid == 'change_owner') {
            if(card.isAssignment)
                nlChangeOwner.show($scope, card.reportId, 'course_assignment', _userInfo); //For assignments reportId is assignment id
            else
                nlChangeOwner.show($scope, card.courseId, 'course', _userInfo);
        }
    };

    function _initParams() {
        courseDict = {};
        var params = nl.location.search();
        _type = params.type || 'published_course';
        _folder = params.folder || 'grade';
    }

    function _getPageSubTitle() {
        return nl.t('({})', nl.pginfo.username);
    }

    function _onSearch(filter, searchCategory, onSearchParamChange) {
        _searchMetadata.search = filter;
        var cmConfig = {canFetchMore: $scope.cards.canFetchMore,
            banner: $scope.cards._internal.search.infotxt2};
        nlMetaDlg.showAdvancedSearchDlg($scope, _userInfo, 'course', _searchMetadata, cmConfig)
        .then(function(result) {
            if (result.canFetchMore) return _fetchMore();
            onSearchParamChange(result.metadata.search || '', searchCategory);
            _searchMetadata = result.metadata;
            _getDataFromServer();
        });
    }
    
    function _fetchMore() {
        _getDataFromServer(null, true);
    }
    
    var _pageFetcher = nlServerApi.getPageFetcher();
    function _getDataFromServer(resolve, fetchMore) {
        if (!fetchMore) _resultList = [];
        var params = {metadata: _searchMetadata};
        if(fetchMore) params['max'] = _max2;        //TODO-NOW
        var listingFn = _getListFnAndUpdateParams(params);
        _pageFetcher.fetchPage(listingFn, params, fetchMore, function(results) {
            if (!results) {
                if (resolve) resolve(false);
                return;
            }
            _afterSubFetching(results, resolve);
        });
    }

    function _afterSubFetching(updatedResults, resolve) {
        _resultList = _resultList.concat(updatedResults);
        nlCardsSrv.updateCards($scope.cards, {
            cardlist: _getCards(_resultList, nlCardsSrv),
            canFetchMore: _pageFetcher.canFetchMore()
        });
        if (resolve) resolve(true);
    }

    function _getListFnAndUpdateParams(params) {
        var listingFn = null;
        if (_type === 'published_course') {
            params.mine = false;
            listingFn = nlServerApi.courseGetList;
        }
        return listingFn;
    }

    function _getCards(resultList, nlCardsSrv) {
        var cards = [];
        for (var i = 0; i < resultList.length; i++) {
            var card = _createCard(resultList[i]);
            cards.push(card);
        }
        return cards;
    }
    
    function _createCard(cardInfo) {
        if (_type === 'published_course') return _createCourseCard(cardInfo);
    }
    
    function _createCourseCard(course) {
        courseDict[course.id] = course;
        var mode = 'published';
        var url = nl.fmt2('#/course_view?id={}&mode={}', course.id, mode);
        var card = {courseId: course.id,
                    title: course.name, 
                    url: url,
                    authorName: course.authorname,
                    blended: course.blended || false,
                    help: course.description,
                    json: angular.toJson(course, 0),
                    grp: course.grp,
                    children: []};
        if (course.icon && course.icon.indexOf('icon:') == 0) {
            var icon2 = course.icon.substring(5);
            if (!icon2) icon2='ion-ios-bookmarks fblue';
            card.icon2 = icon2;
        } else {
            card.icon = course.icon;
        }

        card.details = {help: card.help, avps: _getCourseAvps(course)};
        card.links = [];
        card.links.push({id: 'course_assign', text: nl.t('assign')});
        card.links.push({id: 'course_report', text: nl.t('report')});
        card.links.push({id: 'details', text: nl.t('details')});
        return card;
    }

    function  _getCourseAvps(course) {
        var avps = [];
        _populateLinks(avps);
        nl.fmt.addAvp(avps, 'Name', course.name);
        nl.fmt.addAvp(avps, 'Author', course.authorname);
        nl.fmt.addAvp(avps, 'Group', course.grpname);
        nl.fmt.addAvp(avps, _userInfo.groupinfo.gradelabel, course.grade);
        nl.fmt.addAvp(avps, _userInfo.groupinfo.subjectlabel, course.subject);
        nl.fmt.addAvp(avps, 'Updated by', course.updated_by_name);
        nl.fmt.addAvp(avps, 'Created on', course.created, 'date');
        nl.fmt.addAvp(avps, 'Updated on', course.updated, 'date');
        nl.fmt.addAvp(avps, 'Published on', course.published, 'date');
        nl.fmt.addAvp(avps, 'Is published?', course.is_published, 'boolean');
        nl.fmt.addAvp(avps, 'Description', course.description);
        nl.fmt.addAvp(avps, 'Internal identifier', course.id);
        return avps;
    }

    function _populateLinks(avps) {
        var isAdmin = nlRouter.isPermitted(_userInfo, 'admin_user');
        var isApproverInPublished = _userInfo.permissions.lesson_approve ? true : false;
        if (!isAdmin && !isApproverInPublished) return;
        var linkAvp = nl.fmt.addLinksAvp(avps, 'Operation(s)');
        nl.fmt.addLinkToAvp(linkAvp, 'copy', null, 'course_copy');
        if(isApproverInPublished) nl.fmt.addLinkToAvp(linkAvp, 'change owner', null, 'change_owner');
        if (isAdmin) nl.fmt.addLinkToAvp(linkAvp, 'course modify', null, 'course_modify');
        if(_canManage) nl.fmt.addLinkToAvp(linkAvp, 'metadata', null, 'course_metadata');
    }

    function _metadataCourse($scope, courseId, card) {
        nlMetaDlg.showMetadata($scope, _userInfo, 'course', courseId, card)
        .then(function() {
            _getDataFromServer();
        });
    }

    function _showCourseReport(courseId) {
        var url = nl.fmt2('/learning_reports?type=course&objid={}', courseId);
        nl.location.url(url);
    }

    function _copyCourse($scope, card) {
        var msg = {
            title : 'Copy course',
            template : nl.t('Are you sure you want to make a private copy of this course?'),
            okText : nl.t('Copy')
        };
        nlDlg.popupConfirm(msg).then(function(result) {
            if (!result) return;
            nlDlg.showLoadingScreen();
            nlServerApi.courseGet(card.courseId, true).then(function(course) {
                var courseName = course.name; 
                courseName = (courseName.indexOf("Copy of") == 0) ? courseName : nl.t('Copy of {}', courseName);
                var dlgScope = {error: {}, data: {
                    name: courseName,
                    icon: course.icon,
                    description: course.description,
                    content: angular.toJson(course.content, 2)  
                }};
                _onCourseSave(null, $scope, dlgScope, null, false, true);
            });
        });

    }
    
    function _modifyCourse($scope, courseId) {
        nlDlg.showLoadingScreen();
        nlServerApi.courseGet(courseId, false).then(function(course) {
            nlDlg.hideLoadingScreen();
            var modifyDlg = nlDlg.create($scope);
            modifyDlg.setCssClass('nl-height-max nl-width-max');
            modifyDlg.scope.error = {};
            $scope.dlgTitle = nl.t('Modify course');
            modifyDlg.scope.data = {name: course.name, icon: course.icon, 
                                    description: course.description, content: angular.toJson(course.content, 2)};
            
            var saveButton = {text : nl.t('Save'), onTap : function(e) {
                _onCourseSave(e, $scope, modifyDlg.scope, courseId, false);
            }};
            var publishButton = {text : nl.t('Publish'), onTap : function(e) {
                _onCourseSave(e, $scope, modifyDlg.scope, courseId, true);
            }};
            var cancelButton = {text : nl.t('Cancel')};
            modifyDlg.show('view_controllers/course/course_modify_dlg.html',
                [saveButton, publishButton], cancelButton);
        });
    }
    
    function _onCourseSave(e, $scope, dlgScope, courseId, bPublish, isCopy) {
        if(!_validateInputs(dlgScope, bPublish)) {
            if(e) e.preventDefault();
            return null;
        }
        nlDlg.showLoadingScreen();
        var modifiedData = {
            name: dlgScope.data.name, 
            icon: dlgScope.data.icon, 
            description: dlgScope.data.description,
            content: dlgScope.data.content 
        };
        if (courseId !== null) modifiedData.courseid = courseId;
        if (bPublish) modifiedData.publish = true;
        var crModFn = (courseId != null) ? nlServerApi.courseModify: nlServerApi.courseCreate;
        return crModFn(modifiedData).then(function(course) {
            _onModifyDone(course, courseId, modifiedData, $scope, isCopy);
            return course.id;
        });
    }

    function _onModifyDone(course, courseId, modifiedData, $scope, isCopy) {
        nlDlg.hideLoadingScreen();
        _updateCourseForTesting(course, modifiedData);
        if(isCopy) {
            var copyCourseDlg = nlDlg.create($scope);
            copyCourseDlg.scope.error = {};
            copyCourseDlg.scope.dlgTitle = nl.t('Course copied');
            copyCourseDlg.scope.courseid = course.id;
            copyCourseDlg.scope.isPublishedMode = true;
            copyCourseDlg.scope.editCourse = function() {
                nlDlg.closeAll();
                var url = nl.fmt2('/course_view?id={}&mode=edit', course.id);
                nl.location.url(url);
            }
            copyCourseDlg.scope.gotoMyCourses = function() {
                nlDlg.closeAll();
                var url = nl.fmt2('/course_list?my={}', 1);
                nl.location.url(url);
            }
            var closeButton = {text : nl.t('Close'), onTap : function(e) {
            }};
            copyCourseDlg.show('view_controllers/course/course_copy.html', [], closeButton, true);	
        }
        if(isCopy) return;
        var card = _createCourseCard(course);
        if (courseId !== null) {
            var pos = _getCardPosition(course.id);
            $scope.cards.cardlist.splice(pos, 1);
        }
        $scope.cards.cardlist.splice(0, 0, card);			
        nlCardsSrv.updateCards($scope.cards);	
    }

    function _validateInputs(scope, bPublish) {
        scope.error = {};
        if(!scope.data.name) return _validateFail(scope, 'name', 'Course name is mandatory');
        if(!scope.data.icon) return _validateFail(scope, 'icon', 'Course icon URL is mandatory');
        if(!scope.data.content) return _validateFail(scope, 'content', 'Course content is mandatory');

        try {
            var courseContent = angular.fromJson(scope.data.content);
            return _validateContent(scope, courseContent, bPublish);            
        } catch (error) {
            return nlDlg.setFieldError(scope, 'content',
                nl.t('Error parsing JSON: {}. Try http://www.jsoneditoronline.org to debug more', error.toString()));
        }
    }

    function _validateContent(scope, courseContent, bPublish) {
        if (!courseContent.modules) return _validateFail(scope, 'content', 
            '"modules" field is expected in content');
        var modules = courseContent.modules;
        if (!angular.isArray(modules)) return _validateFail(scope, 'content', 
            '"modules" needs to be a JSON array []');
        if (modules.length < 1) return _validateFail(scope, 'content', 
            'Atleast one course module object is expected in the content');

        var uniqueIds = {};
        uniqueIds['_root'] = 'module';
        var ratingAdded = false;
        var milestoneAdded = false;
        for(var i=0; i<modules.length; i++){
            var module = modules[i];
            if (!module.id) return _validateModuleFail(scope, module, '"id" is mandatory');
            if (!module.name) return _validateModuleFail(scope, module, '"name" is mandatory');
            if (!module.type) return _validateModuleFail(scope, module, '"type" is mandatory');
            if (module.id in uniqueIds) return _validateModuleFail(scope, module, '"id" has to be unique');
            if(uniqueIds[module.parentId] !== 'module') return _validateModuleFail(scope, module, 'parentId is invalid');
            if (module.type == 'milestone') milestoneAdded = true;
            if (module.type == 'rating') ratingAdded = true;

            if (!_validateModuleType(scope, module)) return false;
            if (!_validateModulePlan(scope, module)) return false;

            if (!_validateLessonModule(scope, module)) return false;
            if (!_validateLinkModule(scope, module)) return false;
            if (!_validateInfoModule(scope, module)) return false;
            if (!_validateILTSession(scope, module)) return false;
            if (!_validateMilestone(scope, module, modules)) return false;
            if (!_validateRatingModule(scope, module)) return false;
            if (!_validateGate(scope, module, uniqueIds)) return false;

            uniqueIds[module.id] = module.type;
        }
        var _etm = _userInfo.groupinfo.features.etm || false;
        if (bPublish && _etm) {
            var msg = null;
            if (courseContent.nht) {
                if(!milestoneAdded)
                    msg = nl.t('This is an "NHT" Course. Please add milestone item before publishing.');
            } else {
                if (ratingAdded) 
                    msg = nl.t('Course have rating items. Please enable "NHT" flag before publishing');
                else if (milestoneAdded) 
                    msg = nl.t('Course have milestone items. Please enable "NHT" flag before publishing');
            }
            if(msg) return _validateFail(scope, 'content', msg);
        }

        return true;
    }

    function _validateModuleType(scope, module) {
        var moduleTypes = {'module': true, 'lesson': true, 'link': true, 'info':true, 'certificate': true, 'iltsession': true, 'milestone': true, 'rating': true, 'gate': true};
        if(module.type in moduleTypes) return true;
        var msg = '"type" has to be one of [' + Object.keys(moduleTypes).toString() + ']';
        return _validateModuleFail(scope, module, msg);
    }

    function _validateModulePlan(scope, module) {
        if (!module.planned_date) return true;
        var d = nl.fmt.json2Date(module.planned_date);
        if (!isNaN(d.valueOf())) return true;
        return _validateModuleFail(scope, module, 'Incorrect planned date: "YYYY-MM-DD" format expected');
    }
    
    function _validateLessonModule(scope, module) {
        if(module.type != 'lesson') return true;
        if(!module.refid) return _validateModuleFail(scope, module, '"refid" is mandatory for "type": "lesson"');
        if(!angular.isNumber(module.refid)) return _validateModuleFail(scope, module, '"refid" should be a number - not a string');
        return true;
    }

    function _validateLinkModule(scope, module) {
        if(module.type != 'link') return true;
        if(!module.action) return _validateModuleFail(scope, module, '"action" is mandatory for "type": "link"');
        if(!module.urlParams) return _validateModuleFail(scope, module, '"urlParams" is mandatory for "type": "urlParams"');
        return true;
    }
    
    function _validateInfoModule(scope, module) {
        if(module.type != 'info') return true;
        return true;
    }
    
    function _validateILTSession(scope, module) {
        if(module.type != 'iltsession') return true;
        if(!module.iltduration) return _validateModuleFail(scope, module, '"iltduration" is mandatory for "type": "iltsession"');
        return true;
    }
    
    
    var _milestoneDict = {};
    function _initMilestoneDict() {
        _milestoneDict = {};
        var _milestones = _userInfo.groupinfo.milestones ? _userInfo.groupinfo.milestones : [];
        for(var i=0; i<  _milestones.length; i++) {
            var item = angular.copy( _milestones[i]);
            item.index = i;
            _milestoneDict[item.id] = item;
        }
    }

    function _validateMilestone(scope, module, modules) {
        if(module.type != 'milestone') return true;
        if(!module.milestone_type) return _validateModuleFail(scope, module, '"milestone_type" is mandatory for "type": "milestone"');
        var _allModules = modules || [];
        var flag = false;

        var moduleMilestoneIndex = (_milestoneDict[module.milestone_type] || {}).index || -1;

        for(var i=0; i < _userInfo.groupinfo.milestones.length; i++) {
            if (module.milestone_type === _userInfo.groupinfo.milestones[i].id) {
                for(var j=0; j<_allModules.length; j++) {
                    var item = _allModules[j];
                    if(!item.milestone_type) continue;
                    if(module.id == item.id) break;
                    var itemMilestoneIndex = _milestoneDict[item.milestone_type].index;
                    if (itemMilestoneIndex < moduleMilestoneIndex) continue;
                    return _validateModuleFail(scope, module, 'Milestone Type for this item should come after Milestone Type of earlier items.', module);
                }
                flag = true;
                break;
            }
        }
        if(!flag) return _validateModuleFail(scope, module, '"milestone_type" is not valid');	
        return true;
    }
    
    function _validateRatingModule(scope, module) {
        if(module.type != 'rating') return true;
        if(!module.rating_type) return _validateModuleFail(scope, module, '"rating_type" is mandatory for "type": "rating"');
        
        var flag = false;
        for(var i=0; i < _userInfo.groupinfo.ratings.length; i++) {
            if (module.rating_type === _userInfo.groupinfo.ratings[i].id) {
                flag = true;
                break;
            }
        }
        if(!flag) return _validateModuleFail(scope, module, '"rating_type" is not valid');
        return true;
    }

    function _validateGate(scope, module, idsAboveGate) {
        if(module.type != 'gate') return true;
        if(!module.gateFormula) return _validateModuleFail(scope, module, '"gateFormula" is mandatory for "type": "gate"');
        if(!module.gatePassscore) return _validateModuleFail(scope, module, '"gatePassscore" is mandatory for "type": "gate"');

        var idsAboveGateCopy = {};
        for(var key in idsAboveGate) {
            if (idsAboveGate[key] !== 'module') idsAboveGateCopy[key]= null; 
        }

        var payload = {strExpression: module.gateFormula, dictAvps: idsAboveGateCopy};
        nlExpressionProcessor.process(payload);
        if(payload.error) return _validateModuleFail(scope, module, payload.error);
        return true;
    }
    
    function _validateModuleFail(scope, module, errMsg) {
        return nlDlg.setFieldError(scope, 'content',
            nl.t('{}: module - {}', nl.t(errMsg), angular.toJson(module)));
    }

    function _validateFail(scope, attr, errMsg) {
        return nlDlg.setFieldError(scope, attr,
            nl.t(errMsg));
    }
    
    var uniqueId = 100;
    function _updateCourseForTesting(course, modifiedData) {
        if (NL_SERVER_INFO.serverType !== 'local') return;
        if ('courseid' in modifiedData) {
            course.id = modifiedData.courseid;
        } else {
            course.id = uniqueId++;
        }
        course.name  = modifiedData.name;
        course.icon  = modifiedData.icon;
        course.description  = modifiedData.description;
        if ('content' in modifiedData)
            course.content  = angular.fromJson(modifiedData.content);
    }

    function _getCardPosition(courseId) {
        for(var i in $scope.cards.cardlist) {
            var card = $scope.cards.cardlist[i];
            if(card.courseId === courseId) return i;
        }
        nl.log.error('Cannot find modified card', courseId);
        return 0;
    }
}];

module_init();
})();

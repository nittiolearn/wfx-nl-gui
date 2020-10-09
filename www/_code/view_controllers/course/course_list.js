(function() {

//-------------------------------------------------------------------------------------------------
// course_list.js:
// course module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.course_list', [])
	.config(configFn)
	.controller('nl.CourseListCtrl', CourseListCtrl)
	.controller('nl.CourseAssignListCtrl', CourseAssignListCtrl)
	.controller('nl.CourseAssignMyListCtrl', CourseAssignMyListCtrl)
	.controller('nl.CourseReportListCtrl', CourseReportListCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.course_list', {
		url: '^/course_list',
		views: {
			'appContent': {
				templateUrl: 'view_controllers/course/course_list.html',
				controller: 'nl.CourseListCtrl'
			}
		}});
	$stateProvider.state('app.course_assign_list', {
		url: '^/course_assign_list',
		views: {
			'appContent': {
				templateUrl: 'lib_ui/cards/cardsview.html',
				controller: 'nl.CourseAssignListCtrl'
			}
		}});
	$stateProvider.state('app.course_assign_my_list', {
		url: '^/course_assign_my_list',
		views: {
			'appContent': {
				templateUrl: 'lib_ui/cards/cardsview.html',
				controller: 'nl.CourseAssignMyListCtrl'
			}
		}});
	$stateProvider.state('app.course_report_list', {
		url: '^/course_report_list',
		views: {
			'appContent': {
				templateUrl: 'lib_ui/cards/cardsview.html',
				controller: 'nl.CourseReportListCtrl'
			}
		}});
}];

var CourseListCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlGetManyStore', 'nlDlg', 'nlCardsSrv', 'nlSendAssignmentSrv', 'nlMetaDlg', 'nlCourse', 'nlExpressionProcessor', 'nlChangeOwner', 'nlSearchCacheSrv', '$filter',
function(nl, nlRouter, $scope, nlServerApi, nlGetManyStore, nlDlg, nlCardsSrv, nlSendAssignmentSrv, nlMetaDlg, nlCourse, nlExpressionProcessor, nlChangeOwner, nlSearchCacheSrv, $filter) {
	_listCtrlImpl('course', nl, nlRouter, $scope, nlServerApi, nlGetManyStore, nlDlg, nlCardsSrv, nlSendAssignmentSrv, nlMetaDlg, nlCourse, nlExpressionProcessor, nlChangeOwner, nlSearchCacheSrv, $filter);
}];

var CourseAssignListCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlGetManyStore', 'nlDlg', 'nlCardsSrv', 'nlSendAssignmentSrv', 'nlMetaDlg', 'nlCourse', 'nlExpressionProcessor', 'nlChangeOwner', 'nlSearchCacheSrv', '$filter',
function(nl, nlRouter, $scope, nlServerApi, nlGetManyStore, nlDlg, nlCardsSrv, nlSendAssignmentSrv, nlMetaDlg, nlCourse, nlExpressionProcessor, nlChangeOwner, nlSearchCacheSrv, $filter) {
	_listCtrlImpl('assign', nl, nlRouter, $scope, nlServerApi, nlGetManyStore, nlDlg, nlCardsSrv, nlSendAssignmentSrv, nlMetaDlg, nlCourse, nlExpressionProcessor, nlChangeOwner, nlSearchCacheSrv, $filter);
}];

var CourseAssignMyListCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlGetManyStore', 'nlDlg', 'nlCardsSrv', 'nlSendAssignmentSrv', 'nlMetaDlg', 'nlCourse', 'nlExpressionProcessor', 'nlChangeOwner', 'nlSearchCacheSrv', '$filter',
function(nl, nlRouter, $scope, nlServerApi, nlGetManyStore, nlDlg, nlCardsSrv, nlSendAssignmentSrv, nlMetaDlg, nlCourse, nlExpressionProcessor, nlChangeOwner, nlSearchCacheSrv, $filter) {
	_listCtrlImpl('assign_my', nl, nlRouter, $scope, nlServerApi, nlGetManyStore, nlDlg, nlCardsSrv, nlSendAssignmentSrv, nlMetaDlg, nlCourse, nlExpressionProcessor, nlChangeOwner, nlSearchCacheSrv, $filter);
}];

var CourseReportListCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlGetManyStore', 'nlDlg', 'nlCardsSrv', 'nlSendAssignmentSrv', 'nlMetaDlg', 'nlCourse', 'nlExpressionProcessor', 'nlChangeOwner', 'nlSearchCacheSrv', '$filter',
function(nl, nlRouter, $scope, nlServerApi, nlGetManyStore, nlDlg, nlCardsSrv, nlSendAssignmentSrv, nlMetaDlg, nlCourse, nlExpressionProcessor, nlChangeOwner, nlSearchCacheSrv, $filter) {
	_listCtrlImpl('report', nl, nlRouter, $scope, nlServerApi, nlGetManyStore, nlDlg, nlCardsSrv, nlSendAssignmentSrv, nlMetaDlg, nlCourse, nlExpressionProcessor, nlChangeOwner, nlSearchCacheSrv, $filter);
}];

function _listCtrlImpl(type, nl, nlRouter, $scope, nlServerApi, nlGetManyStore, nlDlg, nlCardsSrv, nlSendAssignmentSrv, nlMetaDlg, nlCourse, nlExpressionProcessor, nlChangeOwner, nlSearchCacheSrv, $filter) {
	/* 
	 * URLs handled
	 * 'View published' : /course_list?type=course&my=0
	 * 'View published grid view' : /course_list?type=course&folder=grade|subject
	 * 'Edit my' : /course_list?type=course&my=1
	 * 'Assigned courses (sent by all)' : /course_assign_list
	 * 'Assigned courses (sent by me)' : /course_assign_my_list
	 * 'Report of user' : /course_list?type=report
	 */
	
	var my = false;
	var _userInfo = null;
	var _maxDelete = 50;
	var _max2 = 500;
    var _metadataEnabled = false;
    var _searchMetadata = null;
    var _canManage = false;
	var _resultList = [];
	var _isSaveJson = false;
	var _autoFetchAll = false;
	
	// All Global data needed folder view
	var _searchCache = {
		enabled: false,			// Set to true if url contains folder.
		folder: null, 			// This is derived from URL and not changed later.
								// grade|subject|authorname|anythingelse (from URL). If defined, 
								// searchcache is used to get cached data from server. The folder
					  			// view itself is shown only when folderLabel is not null
		folderLabel: null,		// This is initialzed on startup.
								// If folder is a supported attribute, folderLabel is set to the
								// display name. For example: grade => gradelabel. Only if this
								// is set, the folderview is shown.
		tree: {}, 				// Folder structure
		itemsDict: {},			// list of course/ course assignmenet items fetched from search cache
		currentFolder: null,	// Currently displayed folder
		currentPath: [],		// Path shown in breadcrumps
		searchStr: '',			// For custom searching in folder view
		searchCategory: '',			// For custom searching in folder view
	}; 
	$scope.folderView = _searchCache;

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		_canManage = nlRouter.isPermitted(_userInfo, 'assignment_manage');
		_initMilestoneDict();
		return nl.q(function(resolve, reject) {
			nlGetManyStore.init();
			_initParams();
			nl.pginfo.pageTitle = _getPageTitle();
			if(_searchCache.enabled) nlSearchCacheSrv.init();
			$scope.cards = {
				staticlist: _getStaticCards(), 
				largeData: _searchCache.enabled,
				search: {customSearch: _searchCache.folderLabel ? _onFolderViewSearch: null,
					onSearch: _metadataEnabled ? _onSearch: null, 
                    placeholder: nl.t('Enter course name/description')}
			};
			if(_isSaveJson)	$scope.cards.savejson = { show : _isSaveJson};
			nlCardsSrv.initCards($scope.cards);
			_getDataFromServer(resolve);
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    $scope.onCardInternalUrlClicked = function(card, internalUrl) {
    	$scope.onCardLinkClicked(card, internalUrl);
    };

	$scope.onCardLinkClicked = function(card, linkid) {
		if (linkid === 'course_create') {
			_createCourse($scope);
		} else if (linkid === 'folder_click') {
			_onFolderClick(card);
		} else if (linkid === 'course_modify') {
			_modifyCourse($scope, card.courseId);
		} else if (linkid === 'course_delete') {
			_deleteCourse($scope, card.courseId);
		} else if (linkid === 'course_unpublish'){
			_unpublishCourse($scope, card.courseId);
        } else if (linkid === 'course_metadata') {
            _metadataCourse($scope, card.courseId, card);
        } else if (linkid === 'fetch_more') {
            _fetchMore();
		} else if (linkid === 'course_assign'){
			var assignInfo = {assigntype: 'course', id: card.courseId, icon : card.icon2 ? 'icon:' : card.icon, 
				title: card.title, authorName: card.authorName, description: card.help,
				showDateField: true, enableSubmissionAfterEndtime: true, blended: card.blended};
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
		} else if (linkid === 'course_assign_delete'){
			_deleteAssignment($scope, card.reportId);
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
		var params = nl.location.search();
		_isSaveJson = params.savejson == '1' ? true : false;
		_autoFetchAll = params.autofetchall == '1' ? true : false;
		_searchCache.folder = params.folder || null;
		_searchCache.enabled = _searchCache.folder ? true : false;
		_searchCache.cacheType = type ==='course' ? 'published_course' : 'course_assignment';
        my = ('my' in params && !_searchCache.enabled) ? parseInt(params.my) == 1: false;
        _metadataEnabled = (type == 'course') && !my;
		_searchMetadata = nlMetaDlg.getMetadataFromUrl();
		_maxDelete = params.max_delete || 50;
		_max2 = ('max2' in params) ? parseInt(params.max2) : 500;

		if (_searchCache.folder == 'grade') {
			_searchCache.folderLabel = _userInfo.groupinfo.gradelabel;
		} else if (_searchCache.folder == 'subject') {
			_searchCache.folderLabel = _userInfo.groupinfo.subjectlabel;
		} else if (_searchCache.folder == 'authorname') {
			_searchCache.folderLabel = 'Author:';
		}
	}

	function _getPageTitle() {
		if (type === 'course') {
			return 	(my == true) ? nl.t('Create and edit courses'): nl.t('Published courses');
		}
		if (type === 'assign') {
			return 	nl.t('Assigned courses');
		}
		if (type === 'assign_my') {
			return 	nl.t('Courses assigned by me');
		}
		if (type === 'report') {
			return 	nl.t('My courses');
		}
	}

	function _getPageSubTitle(reports) {
		return nl.t('({})', nl.pginfo.username);
	}

	function _onSearch(filter, searchCategory, onSearchParamChange) {
        if (!_metadataEnabled) return;
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
	
	function _getCacheDataFromServer(resolve) {
		nlSearchCacheSrv.getItems(_searchCache.cacheType).then(function(itemsDict, canFetchMore) {
			_filterOutDisallowedItems(itemsDict);
			_updateSearchCachedCards();
			if (resolve) resolve(true);
		});
		
	}

    function _filterOutDisallowedItems(itemsDict) {
		_searchCache.itemsDict = {};
		for (var itemId in itemsDict) {
			var item = itemsDict[itemId];
			if (type === 'course' && !_isOuAllowed(item)) continue;
			if (type === 'assign_my' && _userInfo.userid != itemsDict[itemId]['sender']) continue;
			_searchCache.itemsDict[item.id] = item;
		}
	}

	var _myOus = null;
	function _isOuAllowed(courseItem) {
		var allowedOus = courseItem['oulist'] || [];
		if (allowedOus.length == 0 || _userInfo.permissions.nittio_support) return true;
		if (!_myOus) {
			_myOus = [];
			var ou = _userInfo.org_unit || '';
			if (ou) _myOus.push(ou);
			var secOus = (_userInfo.sec_ou_list || '').split(',');
			for(var i=0; i<secOus.length; i++) {
				var secOu = secOus[i].trim();
				if (secOu) _myOus.push(secOu);
			}
		}
        for (var i=0; i<allowedOus.length; i++) {
			for (var j=0; j<_myOus.length; j++) {
				if (_myOus[j].indexOf(allowedOus[i]) == 0) return true;
			}
		}
		return false;
	}

    function _updateSearchCachedCards() {
		if (_searchCache.folderLabel) return _updateCardsInFolderView();
		var cards = [];
		for (var itemId in _searchCache.itemsDict) {
			var card = _createCard(_searchCache.itemsDict[itemId]);
			if (!card) continue;
			cards.push(card);
		}
		cards.sort(function(a, b) {
			return ((b.updated || 0) - (a.updated || 0));
		});
		nlCardsSrv.updateCards($scope.cards, {
			cardlist: cards,
			canFetchMore: nlSearchCacheSrv.canFetchMore(_searchCache.cacheType)
		});
	}

    function _updateCardsInFolderView() {
		_searchCache.tree = {};
		for (var itemId in _searchCache.itemsDict) {
			var courseItem = _searchCache.itemsDict[itemId];
			var itemVisible = _isMetadataPresent(courseItem);
			if (itemVisible) {
				var card = _createCard(courseItem);
				var result = $filter('nlFilter')([card], _searchCache.searchStr, _searchCache.searchCategory);
				itemVisible = result.length > 0 ? true : false;
			}
			_addToFolders(courseItem, itemVisible);
		}
		_updateCounts(_searchCache.tree['_root']);
		_addCurrentFolderCards();
	}

	function _isMetadataPresent(courseItem) {
		for(var key in _searchMetadata) {
			var contentmetadata = courseItem.contentmetadata || {};
			if (_searchMetadata[key] != contentmetadata[key]) return false;
		}
		return true;
	}

	function _onFolderViewSearch(searchStr, searchCategory) {
		_searchCache.searchStr = searchStr;
		_searchCache.searchCategory = searchCategory;
		_updateCardsInFolderView();
	}

	function _addToFolders(courseItem, itemVisible) {
		var folder = courseItem[_searchCache.folder] || 'Others';
		_addItemToParentFolder(folder, courseItem, itemVisible ? 'item' : 'ignore');
	}

	function _addItemToParentFolder(folder, item, itemType) {
		if (!_searchCache.tree[folder]) _searchCache.tree[folder] = {folders: {}, items: {}, folderName: folder, count: 0};
		var fs = _searchCache.tree[folder];
		if (itemType == 'folder') {
			fs.folders[item.folderName] = item;
		} else if (itemType == 'item') {
			fs.items[item.id] = item;
		}
		if (folder == '_root') return;
		var parts = folder.split('.');
		if (parts.length == 1) {
			_addItemToParentFolder('_root', fs, 'folder');
			return;
		}
		parts.splice(parts.length-1, 1);
		var parent = parts.join('.');
		_addItemToParentFolder(parent, fs, 'folder');
	}

	function _updateCounts(fs) {
		if(fs) fs.count = fs.items ? Object.keys(fs.items).length : 0;
		for(var key in fs.folders) {
			var child = fs.folders[key];
			_updateCounts(child);
			fs.count += child.count;
		}
	}

	function _createFolderCard(fs) {
		var icon2 = fs.count ? 'ion-ios-folder forange3' : 'ion-ios-folder fgrey';
		var cardStyle = fs.count ? 'bgblue3' : 'bgdefault nl-opacity-5';
		var card = {title: nl.fmt2('{} ({})', fs.folderName, fs.count),
					icon2: icon2,
					fs: fs, 
					internalUrl: 'folder_click',
					children: [],
					style: cardStyle};
		return card;
	}

	function _onFolderClick(card) {
		_updateFolderPath(card.fs.folderName);
		_addCurrentFolderCards();
	}

	$scope.onClickBreadCrumb = function(pathId) {
		_updateFolderPath(pathId);
		_addCurrentFolderCards();
	};

	function _updateFolderPath(pathId) {
		if (_searchCache.currentFolder == pathId) return;
		if(!pathId) {
			_searchCache.currentFolder = null; 
			return;
		}
		_searchCache.currentFolder = pathId;
		_searchCache.currentPath = [{name: _searchCache.folderLabel, id: null}];
		var parts = pathId.split('.');
		for(var i=0; i<parts.length; i++) {
			_searchCache.currentPath.push({ name: parts[i], id:parts.slice(0,i+1).join('.') });
		}
	}
	
	function _addCurrentFolderCards() {
		var cards = [];

		var folderKey = _searchCache.currentFolder || '_root';
		var fs = _searchCache.tree[folderKey];
		if (!fs) fs = _searchCache.tree['_root'];
		for(var key in fs.folders) {
			var card = _createFolderCard(fs.folders[key]);
			cards.push(card);
		}
		cards.sort(function(a, b) {
			if(b.title.toLowerCase() < a.title.toLowerCase()) return 1;
			if(b.title.toLowerCase() > a.title.toLowerCase()) return -1;
			return 0;
		});

		for(var key in fs.items) {
			var card = _createCard(fs.items[key]);
			cards.push(card);
		}
		cards.sort(function(a, b) {
			if (a.fs || b.fs) return 0;
			return ((b.updated || 0) - (a.updated || 0));
		});

		nlCardsSrv.updateCards($scope.cards, {
			cardlist: cards,
			canFetchMore: nlSearchCacheSrv.canFetchMore(_searchCache.cacheType)
		});
	}

    var _pageFetcher = nlServerApi.getPageFetcher();
	function _getDataFromServer(resolve, fetchMore) {
		if(_searchCache.enabled) return _getCacheDataFromServer(resolve);
        if (!fetchMore) _resultList = [];
        var params = {metadata: _searchMetadata};
		if(fetchMore) params['max'] = _max2;
        var listingFn = _getListFnAndUpdateParams(params);
        _pageFetcher.fetchPage(listingFn, params, fetchMore, function(results, batchDone, rawResult) {
            if (!results) {
                if (resolve) resolve(false);
                return;
            }
			if (type !== 'report') {
				_afterSubFetching(results, resolve);
				if (_autoFetchAll && rawResult && rawResult.more) _getDataFromServer(resolve, true);
			} else {
				_subfetchAndOverride(results, resolve);
			}
		});
	}
	
	function _subfetchAndOverride(results, resolve) {
        var reportRecords = [];
        for (var i=0; i<results.length; i++) reportRecords.push(_getReportRecord(results[i]));
        nlGetManyStore.fetchReferredRecords(reportRecords, true, function() {
            for(var i=0; i<results.length; i++) {
                nlGetManyStore.overrideAssignmentParametersInRepContent(reportRecords[i], results[i]);
            }
            _afterSubFetching(results, resolve);
        });
	}

    function _getReportRecord(repObj) {
    	return {ctype: _nl.ctypes.CTYPE_COURSE, assigntype: _nl.atypes.ATYPE_COURSE,
			assignment: repObj.assignid, lesson_id: repObj.courseid};
    }

	function _afterSubFetching(updatedResults, resolve) {
		_resultList = _resultList.concat(updatedResults);
		if (_resultList.length === 1 && type === 'report') {
			var url = nl.fmt2('/course_view?id={}&mode=do', _resultList[0].id);
			nl.location.url(url);
			nl.location.replace();
			return;
		}
		nlCardsSrv.updateCards($scope.cards, {
			cardlist: _getCards(_resultList, nlCardsSrv),
			canFetchMore: _pageFetcher.canFetchMore()
		});
		if (resolve) resolve(true);
	}

	function _getListFnAndUpdateParams(params) {
        var listingFn = null;
		if (type === 'course') {
		    params.mine = my;
			listingFn = nlServerApi.courseGetList;
		} else if (type === 'assign') {
		    params.mine = false;
			listingFn = nlServerApi.courseGetAssignmentList;
		} else if (type === 'assign_my') {
		    params.mine = true;
			listingFn = nlServerApi.courseGetAssignmentList;
		} else {
            listingFn = nlServerApi.courseGetMyReportList;
		}
		return listingFn;
	}
	
	function _getStaticCards() {
		var ret = [];
		if (type !== 'course' || !my) return ret;
		var card = {title: nl.t('Create'), 
					icon2: 'ion-ios-bookmarks-outline fblue', 
                    iconBr: 'fsh3 ion-plus-round fwhite bgblue round padding-small-h', 
					internalUrl: 'course_create',
					help: nl.t('You can create a new course by clicking on this card'), 
					children: [], style: 'nl-bg-blue', links: []};
		ret.push(card);
		return ret;
	}

	function _getCards(resultList, nlCardsSrv) {
		var cards = [];
		for (var i = 0; i < resultList.length; i++) {
			var card = _createCard(resultList[i]);
			cards.push(card);
		}
		nl.pginfo.pageSubTitle = _getPageSubTitle(resultList);
		return cards;
	}
	
	function _createCard(cardInfo) {
		if (type === 'course') return _createCourseCard(cardInfo);
		if (type === 'assign' || type === 'assign_my') return _createReportCard(cardInfo, false);
		return _createReportCard(cardInfo, true);
	}
	
	function _createCourseCard(course) {
		var mode = my ? 'edit' : 'published';
		var url = nl.fmt2('#/course_view?id={}&mode={}', course.id, mode);
	    var card = {courseId: course.id,
	    			title: course.name, 
					url: url,
					authorName: course.authorname,
					blended: course.blended || false,
					help: course.description,
					json: angular.toJson(course, 0),
					grp: course.grp,
					updated: nl.fmt.json2Date(course.updated),
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
		if (my) { 
			card.links.push({id: 'course_copy', text: nl.t('copy')});
			card.links.push({id: 'course_delete', text: nl.t('delete')});
			if (course.is_published)
				card.links.push({id: 'course_unpublish', text: nl.t('unpublish')});
		} else {
            card.links.push({id: 'course_assign', text: nl.t('assign')});
            card.links.push({id: 'course_report', text: nl.t('report')});
		}
		card.links.push({id: 'details', text: nl.t('details')});
		return card;
	}

    function _addMetadataLinkToDetails(linkAvp) {
        if (!_metadataEnabled) return;
        nl.fmt.addLinkToAvp(linkAvp, 'metadata', null, 'course_metadata');
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
		var isApproverInPublished = _userInfo.permissions.lesson_approve && !my;
		if (!isAdmin && !isApproverInPublished) return;
		var linkAvp = nl.fmt.addLinksAvp(avps, 'Operation(s)');
		if(!my) nl.fmt.addLinkToAvp(linkAvp, 'copy', null, 'course_copy');
		if(isApproverInPublished) nl.fmt.addLinkToAvp(linkAvp, 'change owner', null, 'change_owner');
		if (isAdmin) nl.fmt.addLinkToAvp(linkAvp, 'course modify', null, 'course_modify');
		if(_metadataEnabled && _canManage) _addMetadataLinkToDetails(linkAvp);
	}

	function _createReportCard(report, isReport) {
		var url = nl.fmt2('#/learning_reports?type=course_assign&objid={}', report.id);
		var title = report.name;
		var help = '';
		if (isReport) {
			var course = nlGetManyStore.getRecord(nlGetManyStore.getContentKeyFromReport(report));
			if (course && !course.error) {
				report.content = course.content;
			}
			title = report.name;
			var mode = 'do';
			var url = nl.fmt2('#/course_view?id={}&mode={}', 
						report.id, mode);
			help = '<div class="row row-center padding0 margin0"><i class="icon fsh4 padding-small {}"></i><span>{}</span></div>';
			if(nlCourse.isCourseReportCompleted(report)) {
				help = nl.fmt2(help, 'ion-checkmark-circled fgreen', 'Completed'); 
			} else {
				help = nl.fmt2(help, 'ion-ios-circle-filled fgrey', 'Pending');
			}		
		}

		help = nl.fmt2('<div>{}<div>{}</div></div>', help, report.remarks);
	    var card = {reportId: report.id,
	    			title: title, 
	    			url: url,
	    			children: []};
		if(!isReport) card['isAssignment'] = true;
		if(!isReport && report.updated) card['updated'] = nl.fmt.json2Date(report.updated);
		var descFmt = '';
		if(report.batchname)
			descFmt += nl.t("<div><b>{}</b></div>", report.batchname);
		if(report.not_before)
			descFmt += nl.t("<div>From {}", nl.fmt.date2Str(nl.fmt.json2Date(report.not_before), 'date'));

		if(report.not_after) 
			descFmt += nl.t(" till {}</div>", nl.fmt.date2Str(nl.fmt.json2Date(report.not_after), 'date'));
		else
			descFmt += '</div>';
		if(report.remarks) 
			descFmt +=  nl.t("<div>{}</div>", report.remarks);
		
		card['help'] = descFmt;

	    if (report.icon && report.icon.indexOf('icon:') == 0) {
			var icon2 = report.icon.substring(5);
			if (!icon2) icon2='ion-ios-bookmarks fblue';
			card.icon2 = icon2;
		} else {
			card.icon = report.icon;
		}
		card.details = {help: card.help, avps: _getReportAvps(report, isReport)};
		card.links = [];
		card.links.push({id: 'details', text: nl.t('details')});
		return card;
	}

	function  _getReportAvps(report, isReport) {
		var assignedTo = report.assigned_to;
		var avps = [];
		if(!isReport && _canManage) {
			var linkAvp = nl.fmt.addLinksAvp(avps, 'Operation(s)');
			nl.fmt.addLinkToAvp(linkAvp, 'change owner', null, 'change_owner');
			nl.fmt.addLinkToAvp(linkAvp, 'delete', null, 'course_assign_delete');	
		}
		var contentmetadata = report.content && report.content.contentmetadata ? report.content.contentmetadata : {};
		nl.fmt.addAvp(avps, 'Name', report.name);
		nl.fmt.addAvp(avps, 'Course Author', report.courseauthor);
		nl.fmt.addAvp(avps, 'Assigned by', report.sendername);
		nl.fmt.addAvp(avps, 'Assigned to', assignedTo);
		if (isReport) nl.fmt.addAvp(avps, 'Report of', report.studentname);
		nl.fmt.addAvp(avps, 'Group', report.grpname);
		nl.fmt.addAvp(avps, _userInfo.groupinfo.gradelabel, contentmetadata.grade || '-');
		nl.fmt.addAvp(avps, _userInfo.groupinfo.subjectlabel, contentmetadata.subject || '-');
		nl.fmt.addAvp(avps, 'Batch name', report.batchname);
		nl.fmt.addAvp(avps, 'Created on', report.created, 'date');
		nl.fmt.addAvp(avps, 'Updated on', report.updated, 'date');
		nl.fmt.addAvp(avps, 'From', report.not_before || '', 'date');
		nl.fmt.addAvp(avps, 'Till', report.not_after || '', 'date');
		nl.fmt.addAvp(avps, 'Submit after end time', report.submissionAfterEndtime || false, 'boolean');		
		nl.fmt.addAvp(avps, 'Remarks', report.remarks);
        nl.fmt.addAvp(avps, 'Discussion forum', report.forum, 'boolean');
        if(type != 'report') nl.fmt.addAvp(avps, 'Internal identifier', report.id);
		return avps;
	}
	
    function _metadataCourse($scope, courseId, card) {
        nlMetaDlg.showMetadata($scope, _userInfo, 'course', courseId, card)
        .then(function() {
            _getDataFromServer();
        });
    }

	function _deleteCourse($scope, courseId) {
		var msg = {title: 'Please confirm', 
				   template: 'Are you sure you want to delete? This cannot be undone.',
				   okText: nl.t('Delete')};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;
			nlDlg.showLoadingScreen();
			nlServerApi.courseDelete(courseId).then(function(status) {
				nlDlg.hideLoadingScreen();
				if (_searchCache.enabled) {
					if(courseId in _searchCache.itemsDict) delete _searchCache.itemsDict[courseId];
					return _updateSearchCachedCards();
				}
				for (var i in $scope.cards.cardlist) {
					var card = $scope.cards.cardlist[i];
					if (card.courseId !== courseId) continue;
					$scope.cards.cardlist.splice(i, 1);
				}
                nlCardsSrv.updateCards($scope.cards);
			});	
		});
	}

	function _deleteAssignment($scope, assignId) {
		var msg = {title: 'Please confirm', 
				   template: 'Are you sure you want to delete? This cannot be undone.',
				   okText: nl.t('Delete')};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;
			nlDlg.popupStatus('Deletion in progress ...', false);
			nlDlg.showLoadingScreen();
			_deleteAssignmentInLoop(assignId, 0, function() {
				nlDlg.hideLoadingScreen();
				if (_searchCache.enabled) {
					if(assignId in _searchCache.itemsDict) delete _searchCache.itemsDict[assignId];
					return _updateSearchCachedCards();
				}
				for (var i in $scope.cards.cardlist) {
					var card = $scope.cards.cardlist[i];
					if (card.reportId !== assignId) continue;
					$scope.cards.cardlist.splice(i, 1);
				}
                nlCardsSrv.updateCards($scope.cards);
			});	
		});
	}

	function _deleteAssignmentInLoop(assignId, deletedCount, callBack) {
		nlServerApi.courseAssignmentDelete(assignId, _maxDelete).then(function(status) {
			deletedCount += status.deleted_count;
			var msg = nl.fmt2('Deleted {} reports.', !deletedCount ? 'all' : deletedCount);
			if (status.more) msg += ' Deletion in progress ...';
			nlDlg.popupStatus(msg, status.more ? false : 2000);
			if (status.more) {
				_deleteAssignmentInLoop(assignId, deletedCount, callBack);
			} else {
				callBack();
			}
		}, function() {
			nlDlg.popdownStatus();
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
            nlServerApi.courseGet(card.courseId, !my).then(function(course) {
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
	
	function _unpublishCourse($scope, courseId) {
		var msg = {title: 'Please confirm', 
				   template: 'Are you sure you want to unpublish?',
				   okText: nl.t('Unpublish')};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;
			nlDlg.showLoadingScreen();
			nlServerApi.courseUnpublish(courseId).then(function(course) {
				_onModifyDone(course, courseId, $scope);
			});	
		});
	}
	
	function _createCourse($scope) {
		var courseContent = {"lastId": 0, "modules": [{"name": "Your first item", "type" : "info", "id": "_id0", "parentId": "_root"}]};
		var dlgScope = {error: {}, data: {
			name: nl.t('New course'),
			icon: 'icon:',
			description: nl.t(''),
			content: angular.toJson(courseContent, 2)	
		}};
		var promise = _onCourseSave(null, $scope, dlgScope, null, false);
		if (promise) promise.then(function(courseId) {
			var url = nl.fmt2('/course_view?id={}&mode=edit', courseId);
			nl.location.url(url);
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
			_onModifyDone(course, courseId, $scope, isCopy);
			return course.id;
		});
	}

    function _onModifyDone(course, courseId, $scope, isCopy) {
		nlDlg.hideLoadingScreen();
		if(isCopy) {
			var copyCourseDlg = nlDlg.create($scope);
			copyCourseDlg.scope.error = {};
			copyCourseDlg.scope.dlgTitle = nl.t('Course copied');
			copyCourseDlg.scope.courseid = course.id;
			copyCourseDlg.scope.isPublishedMode = !my;
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
		if(isCopy && !my) return;
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

	function _getCardPosition(courseId) {
		for(var i in $scope.cards.cardlist) {
			var card = $scope.cards.cardlist[i];
			if(card.courseId === courseId) return i;
		}
		nl.log.error('Cannot find modified card', courseId);
		return 0;
	}
}

module_init();
})();

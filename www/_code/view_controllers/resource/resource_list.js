(function() {

//-------------------------------------------------------------------------------------------------
// resource_list.js:
// resource - Resource upload dialogs and controllers
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.resource_list', [])
    .config(configFn)
    .controller('nl.ResourceListCtrl', ResourceListCtrl)
	.service('nlResourceAddModifySrv', ResourceAddModifySrv)
    .directive('nlSelectall', SelectallDirective);
}


//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.resource_list', {
        url: '^/resource_list',
        views: {
            'appContent': {
                templateUrl : 'lib_ui/cards/cardsview.html',
                controller: 'nl.ResourceListCtrl'
            }
        }});
    $stateProvider.state('app.resource_upload', {
        url: '^/resource_upload',
        views: {
            'appContent': {
                templateUrl : '',
                controller: 'nl.ResourceUploadCtrl'
            }
        }});
}];
//-------------------------------------------------------------------------------------------------
var ResourceListCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi', 'nlResourceUploader', 'nlResourceAddModifySrv',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, nlResourceUploader, nlResourceAddModifySrv) {

	var _userInfo = null;
	var _allCardsForReview = [];
	var _type = 'my';
	var search = null;
	var _bFirstLoadInitiated = false;
	
	function _isMine(_type) {
		return (_type == 'my' || _type == 'upload');
	}
	
	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {
			var params = nl.location.search();
			_type = params.type || 'my'; // can be my, all or upload
			search = ('search' in params) ? params.search : null;
			nl.pginfo.pageTitle = _updatePageTitle(); 
			$scope.cards = {};
			$scope.cards.staticlist = _getStaticCard();
			$scope.cards.emptycard = _getEmptyCard(nlCardsSrv);
			if (_type == 'upload') {
				_addModifyResource($scope, null);
				resolve(true);
			} else {
				_getDataFromServer(resolve, reject);
			}
		});
	}

	nlRouter.initContoller($scope, '', _onPageEnter);
	
	function _updatePageTitle(){
		return _isMine(_type) ? nl.t('My resources') : nl.t('All resources');
	}
	
	function _getEmptyCard(nlCardsSrv) {
		var help = help = nl.t('There are no assignments to display.');
		return nlCardsSrv.getEmptyCard({
			help : help
		});
	}
	
	function _getStaticCard() {
		var ret = [];
		var card = {};
		if (!_isMine(_type)) return;
		card = {title: nl.t('Upload'), 
				icon: nl.url.resUrl('dashboard/crresource.png'), 
				help: nl.t('You can upload new resource by clicking on this card'), 
				internalUrl: "resource_upload",
				children: [],
				style: 'nl-bg-blue'
				};
		ret.push(card);
		return ret;
	} 

    $scope.onCardInternalUrlClicked = function(card, internalUrl) {
    	var resid = card.Id || 0;
    	if (internalUrl === 'resource_delete') _deleteResource($scope, resid);
    	if (internalUrl === 'resource_upload') _addModifyResource($scope, null);
    	if(internalUrl === 'resource_copy') _showLinkCopyDlg($scope, card);
		if(internalUrl === 'resource_modify')  _addModifyResource($scope, card);
    };

	$scope.onCardLinkClicked = function(card, linkId){
		var resid = card.Id;
		if(linkId == 'resource_modify'){
			_addModifyResource($scope, card);
		} else if(linkId == 'resource_delete'){
			_deleteResource($scope, resid);
		}
	};

	function _updateDataFromServer() {
		return nl.q(function(resolve, reject) {
			nlDlg.showLoadingScreen();
			_getDataFromServer(resolve, reject);
		}).then(function() {
			nlDlg.hideLoadingScreen();
		});
	}
	
	function _getDataFromServer(resolve, reject) {
		_bFirstLoadInitiated = true;
		var data = {mine: _isMine(_type)};
		if (search) data.search = search;
		nlServerApi.resourceGetList(data).then(function(resultList) {
			$scope.cards.cardlist = _getResourceCards(_userInfo, resultList);
			_addSearchInfo($scope.cards);
			resolve(true);
		}, function(reason) {
			resolve(false);
		});
	}

	
	function _getResourceCards(userInfo, resultList) {
		var cards = [];
		for (var i = 0; i < resultList.length; i++) {
			var card = _createResourceCard(resultList[i], userInfo);
			cards.push(card);
		}
		return cards;
	}

	function _createResourceCard(resource, userInfo) {
		var url = null;
		var image = null;
		var internalUrl = 'resource_copy';
		if(resource.restype == "PDF") {
			image = nl.url.resUrl('dashboard/pdf.png');
			url = nl.fmt2('pdf:/resource/resview/{}[scale=1|page=1]', resource.resid);
		} else if(resource.restype == "Video") {
			image = nl.url.resUrl('dashboard/video1.png');
			url = nl.fmt2('video:/resource/resview/{}', resource.resid);
		} else if(resource.restype == "Audio") {
			image = nl.url.resUrl('dashboard/audio.png');
			url = nl.fmt2('audio:/resource/resview/{}', resource.resid);
		} else if(resource.restype == "Attachment") {
			image = nl.url.resUrl('dashboard/attach.png');
			url = nl.fmt2('link:/resource/resview/{}[text=click here]', resource.resid);
		} else if(resource.restype == "Image") {
			image = nl.t('/resource/resview/{}', resource.resid);
			url = nl.fmt2('img:/resource/resview/{}', resource.resid);
		}
		var card = {
			restype: resource.restype,
			keywords: resource.keywords,
			info: resource.info,
			Id: resource.resid,
			title : resource.name,
			icon : image,
			internalUrl : internalUrl,
			link : url,
			authorName: resource.authorname,
			description: resource.description,
			children : []
		};
		card.details = {
			help : resource.description,
			avps : _getResourceListAvps(resource)
		};
		if (_isMine(_type) && userInfo.permissions.admin_user) {
			card.links = [{id : 'resource_modify', text : nl.t('modify')},
						  {id : 'resource_delete', text : nl.t('delete')},
					  	  {id : 'details', text : nl.t('details')}];
		} else if(_isMine(_type)){
			card.links = [{id : 'resource_delete', text : nl.t('delete')},
					  	  {id : 'details', text : nl.t('details')}];
		} else if(!_isMine(_type)){
			card.links = [{id : 'details', text : nl.t('details')}];		
		}
		card['help'] = nl.t('<span class="nl-card-description"><b>By: {}</b></span><br><span>Keywords: {}</span>', resource.authorname, resource.keywords);
		return card;
	}
	
	function _getResourceListAvps(resource){
		var avps = [];
		var data = angular.fromJson(resource.info||'{}');
		var linkAvp = nl.fmt.addLinksAvp(avps, 'Operation(s)');
		_populateLinks(linkAvp, resource.id, resource);
		nl.fmt.addAvp(avps, 'Name', resource.name);
		if(resource.restype == 'Image') nl.fmt.addAvp(avps, 'Link', nl.t('img:resource/resview/{}', resource.resid));
		if(resource.restype == 'PDF') nl.fmt.addAvp(avps, 'Link', nl.t('pdf:resource/resview/{}', resource.resid));
		if(resource.restype == 'Video') nl.fmt.addAvp(avps, 'Link', nl.t('video:resource/resview/{}', resource.resid));
		if(resource.restype == 'Attachment') nl.fmt.addAvp(avps, 'Link', nl.t('link:resource/resview/{}', resource.resid));
		if(resource.restype == 'Audio') nl.fmt.addAvp(avps, 'Link', nl.t('audio:resource/resview/{}', resource.resid));
		nl.fmt.addAvp(avps, 'Keywords', resource.keywords);
		nl.fmt.addAvp(avps, 'Type', resource.restype);
		nl.fmt.addAvp(avps, 'File Type', resource.mimetype);
		nl.fmt.addAvp(avps, 'Size', resource.size);
		nl.fmt.addAvp(avps, 'Inserted from', nl.t('<a href={}>{}', resource.insertfrom, resource.insertfrom));
		nl.fmt.addAvp(avps, 'Update on', resource.updated);
		nl.fmt.addAvp(avps, 'Author', resource.authorname);
		nl.fmt.addAvp(avps, 'Group', resource.grpname);
		if(resource.restype !== 'Image') {
			nl.fmt.addAvp(avps, 'Additional Info', nl.t('<div><ul><li class="sep4"><b>Compression: </b>{}</li><li class="sep4"><b>Status: </b>{}</li><li class="sep4"><b>OrigName: </b>{}</li><li class="sep4"><b>OrigSize: </b>{}</li></ul></div>',
													 data.compression, data.status, data.origName, data.origSize));
		} else {
				nl.fmt.addAvp(avps, 'Additional Info', nl.t('<div><ul><li class="sep4"><b>Compression: </b>{}</li><li class="sep4"><b>Status: </b>{}</li><li class="sep4"><b>OrigName: </b>{}</li><li class="sep4"><b>OrigSize: </b>{}</li><li class="sep4"><b>origWidth: </b>{}</li><li class="sep4"><b>origHeight: </b>{}</li><li class="sep4"><b>compressedName: </b>{}</li><li class="sep4"><b>compressedSize: </b>{}</li><li class="sep4"><b>compressedWidth: </b>{}</li><li class="sep4"><b>compressedHeight: </b>{}</li></ul></div>',
													 data.compression, data.status, data.origName, data.origSize, data.origWidth, data.origHeight, data.compressedName, data.compressedSize, data.compressedWidth, data.compressedHeight));
		}
		return avps;
	}
	
	function _populateLinks(linkAvp, resid, lesson) {
		nl.fmt.addLinkToAvp(linkAvp, 'copy_link', null, 'resource_copy');
		if (_isMine(_type)) {
			nl.fmt.addLinkToAvp(linkAvp, 'modify', null, 'resource_modify');
			nl.fmt.addLinkToAvp(linkAvp, 'delete', null, 'resource_delete');
		}
	}
	
	function _addSearchInfo(cards) {
		cards.search = {
			placeholder : nl.t('Name/Subject/Remarks/Keyword'),
			maxLimit: 20
		};
		cards.search.onSearch = _onSearch;
	};

	function _onSearch(filter) {
		search = filter;
		_updateDataFromServer();
	}

	function _addModifyResource($scope, card){
		nlResourceAddModifySrv.show($scope, card, _userInfo.groupinfo.restypes)
		.then(function(resInfos) {
			if (_bFirstLoadInitiated && resInfos.length == 0) return;
			_updateDataFromServer();
		});
	}

	function _showLinkCopyDlg($scope, card){
		var copyLinkDlg = nlDlg.create($scope);
			copyLinkDlg.scope.data = {};
			copyLinkDlg.scope.data.link = card.link;
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
            if (e) e.preventDefault();
            copyLinkDlg.close(false);
            copyLinkDlg.destroy();
        }};
        copyLinkDlg.show('view_controllers/resource/resource_copy_link_dlg.html', 
                        [], cancelButton, false);
	}
	
	function _deleteResource($scope, resid){
		var msg = {title: 'Please confirm', 
		   template: nl.t('If the resource is used in a lesson or worksheet, they will be lost. Are you sure you want to continue?'),
		   okText: nl.t('Delete')};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;
			nlDlg.showLoadingScreen();
			nlServerApi.resourceDelete(resid).then(function(status) {
				nlDlg.hideLoadingScreen();
				nlDlg.closeAll();
				_updateDataFromServer();
			});	
		});
	}
}];

//-------------------------------------------------------------------------------------------------
var ResourceAddModifySrv = ['nl', 'nlServerApi', 'nlDlg', 'Upload', 'nlProgressFn', 'nlResourceUploader',
function(nl, nlServerApi, nlDlg, Upload, nlProgressFn, nlResourceUploader){
	var COMPRESSIONLEVEL = [{id: 'no', name: 'No compression'},
						{id: 'low', name:'Low compression'},
						{id: 'medium', name:'Medium compression'},
						{id: 'high', name:'High compression'}];

	this.show = function($scope, card, restypes, onlyOnce) {
		return nl.q(function(resolve, reject) {
			var addModifyResourceDlg = nlDlg.create($scope);
			_initResourceDlg(addModifyResourceDlg, card, restypes);
            addModifyResourceDlg.resolveAfterOnce = function () {
                if (!onlyOnce) return false;
                addModifyResourceDlg.resolve();
                return true;
            }; 
            addModifyResourceDlg.resolve = function () {
                addModifyResourceDlg.close();
                // Avoid multiple callbacks which are comming due to "close" call
                if (addModifyResourceDlg.resolvedCalled) return;
                addModifyResourceDlg.resolvedCalled = true;
                resolve(addModifyResourceDlg.resInfos);
            }; 
			_showDlg(addModifyResourceDlg, card, $scope, restypes);
		});
	};

	function _showDlg(addModifyResourceDlg, card, $scope, restypes){
		var buttonName = (card === null) ? nl.t('Upload') : nl.t('Modify');
        var modifyButton = {text: buttonName, onTap: function(e) {
        	if(e) e.preventDefault();
        	_onUploadOrModify(e, addModifyResourceDlg, card, $scope);
        }};
        	
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
            addModifyResourceDlg.resolve();
		}};
        addModifyResourceDlg.show('view_controllers/resource/resource_add_dlg.html', 
        [modifyButton], cancelButton, false);
	}

	function _initResourceDlg(addModifyResourceDlg, card, restypes) {
		addModifyResourceDlg.resInfos = [];
	    addModifyResourceDlg.setCssClass('nl-height-max nl-width-max');
		addModifyResourceDlg.scope.data = {};
	    addModifyResourceDlg.scope.error = {};
		addModifyResourceDlg.scope.options = {};
		addModifyResourceDlg.scope.data.card = card;
        addModifyResourceDlg.scope.data.restype = {};
		addModifyResourceDlg.scope.options.compressionlevel = COMPRESSIONLEVEL;	
		addModifyResourceDlg.scope.data.compressionlevel = {id: 'high'};		
		addModifyResourceDlg.scope.options.restype = _getRestypeList(restypes);

		if (!card) {
			addModifyResourceDlg.scope.data.restype.id = addModifyResourceDlg.scope.options.restype[0].name;
			addModifyResourceDlg.scope.data.pagetitle = nl.t('Upload resource');
			return;
		}

        addModifyResourceDlg.scope.data.keywords = card.keywords;
		addModifyResourceDlg.scope.data.restype.id = card.restype;	
		addModifyResourceDlg.scope.data.pagetitle = nl.t('Modify resource');
	}

	function _getRestypeList(restypes) {
		var data = [];
		for(var i in restypes){
			var restype = restypes[i];
			data.push({id: restype, name: restype});
		}
		return data;
	}

	function _onUploadOrModify(e, addModifyResourceDlg, card, $scope) {
		
		var resourceList = addModifyResourceDlg.scope.data.resource;
		var compressionlevel = addModifyResourceDlg.scope.data.compressionlevel.id;
		var keyword = addModifyResourceDlg.scope.data.keywords || '';
		var resid =  (card !== null) ? addModifyResourceDlg.scope.data.card.Id : null;
	    if(resourceList.length == 0) {
		    if (e) e.preventDefault();
	    	addModifyResourceDlg.scope.error.resource = 'Please select the resource to upload';
	    	return;
		}
		nlDlg.showLoadingScreen();
		nlResourceUploader.uploadInSequence(resourceList, keyword, compressionlevel, resid)
		.then(function(resInfos) {
		    for (var i=0; i<resInfos.length; i++) {
		        addModifyResourceDlg.resInfos.push(resInfos[i]);
		    }
			nlDlg.hideLoadingScreen();
            nlDlg.popdownStatus(0);
            if (addModifyResourceDlg.resolveAfterOnce()) return;
			_postUpload(addModifyResourceDlg, $scope);
        }, function(msg) {
			nlDlg.hideLoadingScreen();
            nlDlg.popdownStatus(0);
            nlDlg.popupAlert({title: nl.t('Error'), template: msg})
            .then(function() {
                addModifyResourceDlg.resolveAfterOnce();
            });
        });
	}

	function _postUpload(addModifyResourceDlg, $scope) {
		var uploadAgainDlg = nlDlg.create($scope);
		uploadAgainDlg.scope.resinfos = addModifyResourceDlg.resInfos;
		var cancelButton = {text: nl.t('Close'), onTap: function(e) {
			uploadAgainDlg.close();
			return addModifyResourceDlg.resInfos;
		}};
        uploadAgainDlg.show('view_controllers/resource/upload_done_dlg.html', [], cancelButton, false);
	}
}];

//-------------------------------------------------------------------------------------------------
var SelectallDirective = ['nl', function (nl) {
	function _selectAll(elem) {
        if (!nl.window.getSelection().toString()) {
            // Required for mobile Safari
            elem.setSelectionRange(0, elem.value.length);
        }
	}

    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
        	nl.timeout(function () {
        		_selectAll(element[0]);
        	});
            element.on('click', function () {
        		_selectAll(element[0]);
            });
        }
    };
}];

module_init();
})();

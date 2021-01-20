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
	var _bFirstLoadInitiated = false;
	var _rawedit = false;
	function _isMine(_type) {
		return (_type == 'my' || _type == 'upload');
	}
	
	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {
			var params = nl.location.search();
			_type = params.type || 'my'; // can be my, all or upload
			_rawedit = params.rawedit ? true : false;
			nl.pginfo.pageTitle = _updatePageTitle(); 
			$scope.cards = {
			    staticlist: _getStaticCard(),
		        search: {}
		    };
            nlCardsSrv.initCards($scope.cards);
			if (_type == 'upload') {
				_addModifyResource($scope, null);
				resolve(true);
			} else {
				_getDataFromServer(resolve);
			}
		});
	}

	nlRouter.initContoller($scope, '', _onPageEnter);
	
	function _updatePageTitle(){
		return _isMine(_type) ? nl.t('My resources') : nl.t('All resources');
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
    	if (internalUrl === 'resource_copy') _showLinkCopyDlg($scope, card);
		if (internalUrl === 'resource_modify') _addModifyResource($scope, card);
        if (internalUrl === 'fetch_more') _getDataFromServer(null, true);
    };

	$scope.onCardLinkClicked = function(card, linkId) {
	    $scope.onCardInternalUrlClicked(card, linkId);
	};

    var _pageFetcher = nlServerApi.getPageFetcher({defMax: 20});
	function _getDataFromServer(resolve, fetchMore) {
		_bFirstLoadInitiated = true;
		var data = {mine: _isMine(_type)};
		_pageFetcher.fetchPage(nlServerApi.resourceGetList, 
		    data, fetchMore, function(resultList) {
	        if(!resultList) {
	            if (resolve) resolve(false);
	            return;
	        }
	        $scope.cards.canFetchMore = _pageFetcher.canFetchMore();
            if (!fetchMore) $scope.cards.cardlist = [];
            _updateResourceCards(resultList, $scope.cards.cardlist);
            nlCardsSrv.updateCards($scope.cards);
			if (resolve) resolve(true);
		});
	}

	function _updateResourceCards(resultList, cards) {
		for (var i = 0; i < resultList.length; i++) {
			var card = _createResourceCard(resultList[i]);
			cards.push(card);
		}
		return cards;
	}

	function _createResourceCard(resource) {
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
		card.links = [];
		if (_isMine(_type) && _userInfo.permissions.admin_user) {
			card.links.push({id : 'resource_modify', text : nl.t('modify')});
			if(_rawedit) card.links.push({id : 'resource_delete', text : nl.t('delete')});		
			card.links.push({id : 'details', text : nl.t('details')});
		} else if(_isMine(_type)){
			if(_rawedit) card.links.push({id : 'resource_delete', text : nl.t('delete')});		
			card.links.push({id : 'details', text : nl.t('details')});
		} else if(!_isMine(_type)){
			card.links.push({id : 'details', text : nl.t('details')});
		}
		card['help'] = nl.t('<b>By: {}</b></span><br><span>Keywords: {}', resource.authorname, resource.keywords);
		return card;
	}
	
	function fromJson(str) {
		try {
			return angular.fromJson(resource.info||'{}');
		} catch (e) {
			return {};
		}
	}

	function _getResourceListAvps(resource){
		var avps = [];
		var data = fromJson(resource.info);
		var linkAvp = nl.fmt.addLinksAvp(avps, 'Operation(s)');
		_populateLinks(linkAvp, resource.id, resource);
		nl.fmt.addAvp(avps, 'Name', resource.name);
		if(resource.restype == 'Image') nl.fmt.addAvp(avps, 'Link', nl.t('img:/resource/resview/{}', resource.resid));
		if(resource.restype == 'PDF') nl.fmt.addAvp(avps, 'Link', nl.t('pdf:/resource/resview/{}', resource.resid));
		if(resource.restype == 'Video') nl.fmt.addAvp(avps, 'Link', nl.t('video:/resource/resview/{}', resource.resid));
		if(resource.restype == 'Attachment') nl.fmt.addAvp(avps, 'Link', nl.t('link:/resource/resview/{}', resource.resid));
		if(resource.restype == 'Audio') nl.fmt.addAvp(avps, 'Link', nl.t('audio:/resource/resview/{}', resource.resid));
        if (resource.reskey) nl.fmt.addAvp(avps, 'Resouce Key', resource.reskey);
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
			if(_rawedit) nl.fmt.addLinkToAvp(linkAvp, 'delete', null, 'resource_delete');
		}
	}
	
	function _addModifyResource($scope, card){
		nlResourceAddModifySrv.show($scope, card, _userInfo.groupinfo.restypes)
		.then(function(resInfos) {
			if (_bFirstLoadInitiated && resInfos.length == 0) return;
			_getDataFromServer();
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
                nlDlg.closeAll();
				_getDataFromServer();
			});	
		});
	}
}];

//-------------------------------------------------------------------------------------------------
var _updatedResourceList = [];
var ResourceAddModifySrv = ['nl', 'nlServerApi', 'nlDlg', 'Upload', 'nlProgressFn', 'nlResourceUploader',
function(nl, nlServerApi, nlDlg, Upload, nlProgressFn, nlResourceUploader){
	var COMPRESSIONLEVEL = [{id: 'no', name: 'No compression'},
						{id: 'low', name:'Low compression'},
						{id: 'medium', name:'Medium compression'},
						{id: 'high', name:'High compression'}];
	var _resourceLibrary = new ResourceLibrary(nl, nlDlg, nlServerApi, nlResourceUploader);
	_updatedResourceList = [];
	var params= nl.location.search();
	var maxResults = ('max' in params) ? parseInt(params['max']) : 50;
	var self = this;
	this.show = function($scope, card, restypes, onlyOnce, markupHandler) {
	    if (!markupHandler) markupHandler = new MarkupHandler(nl, nlDlg);
		return nl.q(function(resolve, reject) {
			nlServerApi.getUserInfoFromCacheOrServer().then(function(userInfo) {
				var addModifyResourceDlg = nlDlg.create($scope);
	            addModifyResourceDlg.resolve = function (afterFirstOk, beforeShow) {
	                // Avoid multiple callbacks which are comming due to "close" call
	                if (addModifyResourceDlg.resolvedCalled) return;
	                addModifyResourceDlg.resolvedCalled = true;
	                if (!beforeShow) addModifyResourceDlg.close();
	                resolve(_processResults(addModifyResourceDlg, markupHandler, afterFirstOk));
	            }; 
	            addModifyResourceDlg.resolveAfterOnce = function () {
	                if (!onlyOnce) return false;
	                addModifyResourceDlg.resolve(true);
	                return true;
	            }; 
	            _initResourceDlg(addModifyResourceDlg, card, restypes);
	            if(!markupHandler.initScope(addModifyResourceDlg.scope)) {
	                addModifyResourceDlg.resolve(false, true);
	                return false;
	            }
		        _resourceLibrary.initScope(addModifyResourceDlg.scope, userInfo);
				_showDlg(addModifyResourceDlg, card, $scope, restypes, markupHandler);
			});
		});
	};

    function _processResults(addModifyResourceDlg, markupHandler, afterFirstOk) {
        if (!addModifyResourceDlg.scope.markupInfo.insertOrUpdateResource)
        	return addModifyResourceDlg.resInfos;
        if (!afterFirstOk) return null;

        var sd = addModifyResourceDlg.scope.data;
        var tab = sd.selectedTab;

        var ret = {};
        if (tab == 'library') {
        	ret = _resourceLibrary.getSelectedUrlInfo();
        } else if (tab == 'upload' || tab == 'record') {
	    	if (addModifyResourceDlg.resInfos.length != 1) return null;
        	ret.url = addModifyResourceDlg.resInfos[0].url;
        	ret.bgShade = sd.bgShade.id;
	    	var resource = addModifyResourceDlg.resInfos[0];
        	var newRes = {group: sd.resourceFilter == 'bg' ? 'Backgrounds' : 'Images', owner: 'self', 
        				  name: resource.name, background: resource.url, restype:resource.restype, 
        				  id: '_db_'+resource.resid, info: resource.info, shared: sd.shared, 
        				  resid: resource.resid, tags: resource.keywords};
			if(sd.resourceFilter == 'bg') newRes['bgShade'] = sd.bgShade.id;
        	if(sd.animated) newRes['animated'] = 1;
        	_updatedResourceList.unshift(newRes);
        } else if (tab == 'url') {
        	ret.url = sd.url;
        	ret.bgShade = sd.bgShade.id;
        }

        ret.markupUrl = markupHandler.getMarkupUrl(addModifyResourceDlg.scope.data, ret.url);
        return ret;
    }

	function _showDlg(addModifyResourceDlg, card, $scope, restypes, markupHandler) {
		var buttonName = addModifyResourceDlg.scope.data.buttonname;
        var modifyButton = {text: buttonName, onTap: function(e) {
        	if(e) e.preventDefault();
            if(!_validate(addModifyResourceDlg.scope)) return;
            
        	if (addModifyResourceDlg.scope.data.selectedTab != 'upload'
        	   && addModifyResourceDlg.scope.data.selectedTab != 'record') {
                addModifyResourceDlg.resolve(true);
                return;
        	}
        	_onUploadOrModify(e, addModifyResourceDlg, card, $scope);
        }};
        	
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
            addModifyResourceDlg.resolve(false);
		}};
        addModifyResourceDlg.show('view_controllers/resource/resource_add_dlg.html', 
		[modifyButton], cancelButton, false);		
		addModifyResourceDlg.scope.imageEditor = function(imagesrc) {
			var imageEditor;
			var imageEditorDlg=nlDlg.create($scope)
			imageEditorDlg.scope.data = {};
			imageEditorDlg.scope.data.imgsrc=imagesrc;
			imageEditorDlg.scope.intializeEditor=function(id){
				imageEditor = new tui.ImageEditor('#'+id , {
                    includeUI: {
                        loadImage: {
                            path: imageEditorDlg.scope.data.imgsrc,
                            name: 'edited-image'
                        },
                        initMenu: 'filter',
						menuBarPosition: 'bottom',
                    },
                    cssMaxWidth: 700,
                    cssMaxHeight: 500,
                    usageStatistics: false
                });
                window.onresize = function() {
                    imageEditor.ui.resizeEditor();
                }
			}
			imageEditorDlg.scope.data.imagesrc=imagesrc;
			var cancelImageEditor={text: nl.t('Cancel'), onTap: function(e) {
			}};
			var saveimageEditor= {text: 'OK', onTap: function(e) {				
				var editedImagesrc= imageEditor.toDataURL();
				var blobfile= nlResourceUploader.dataURItoBlob(editedImagesrc);
				var extn = nlResourceUploader.getValidExtension(blobfile, 'Image');
				var restype = nlResourceUploader.getRestypeFromExt(extn);            
				var fileInfo = {resource: blobfile, restype: restype, extn: extn, name: ''};
				Upload.dataUrl(blobfile).then(function(url) {
					fileInfo.resimg = url;
				});
				addModifyResourceDlg.scope.data.resource = [fileInfo];
				imageEditorDlg.close(false);
			}};
			imageEditorDlg.show('view_controllers/resource/image_editor.html', 
			[saveimageEditor], cancelImageEditor, false)
			
		}
	}

	function _initResourceDlg(addModifyResourceDlg, card, restypes) {
		addModifyResourceDlg.resInfos = [];
	    addModifyResourceDlg.setCssClass('nl-height-max nl-width-max');
		addModifyResourceDlg.scope.data = {recordingName: 'NittioRecording'};
	    addModifyResourceDlg.scope.error = {};
		addModifyResourceDlg.scope.options = {};
		addModifyResourceDlg.scope.data.card = card;
        addModifyResourceDlg.scope.data.restype = {};
        if(card && card.isPasteAndUpload) {
        	addModifyResourceDlg.scope.data.isPasteAndUpload = true;
            addModifyResourceDlg.scope.data.restype.id = 'Image';
        	card.resource = card.resource[0];
        	var extn = nlResourceUploader.getValidExtension(card.resource, 'Image');
            var restype = nlResourceUploader.getRestypeFromExt(extn);            
            var fileInfo = {resource: card.resource, restype: restype, extn: extn, name: ''};
	        Upload.dataUrl(card.resource).then(function(url) {
	            fileInfo.resimg = url;
	        });
		    addModifyResourceDlg.scope.data.resource = [fileInfo];
        }
		addModifyResourceDlg.scope.options.compressionlevel = COMPRESSIONLEVEL;	
		addModifyResourceDlg.scope.data.compressionlevel = {id: 'high'};		
		addModifyResourceDlg.scope.options.restype = _getRestypeList(restypes);
        addModifyResourceDlg.scope.options.bgShade = [
            {id: 'bgdark', name: 'Light text color for darker background'},
            {id: 'bglight', name: 'Dark text color for lighter background'}];

		if (!card || card.resource) {
			addModifyResourceDlg.scope.data.restype.id = addModifyResourceDlg.scope.options.restype[0].id;
			addModifyResourceDlg.scope.data.pagetitle = nl.t('Upload resource');
		} else {
            addModifyResourceDlg.scope.data.keywords = card.keywords;
            addModifyResourceDlg.scope.data.restype.id = card.restype;  
            addModifyResourceDlg.scope.data.pagetitle = nl.t('Modify resource');
		}

		addModifyResourceDlg.scope.changeTab = function(tabName) {
            if(tabName == "adv_options") {
            	addModifyResourceDlg.scope.data.advOptions = true;
	        } else {
	            addModifyResourceDlg.scope.data.selectedTab = tabName;
	            addModifyResourceDlg.scope.data.advOptions = false;
	        }
        };
	}

	function _getRestypeList(restypes) {
		var data = [];
		for(var i in restypes){
			var restype = restypes[i];
			data.push({id: restype, name: restype});
		}
		return data;
	}

    function _validate(scope) {
    	scope.data.advOptions = false;
        if (scope.data.selectedTab == 'url' && !scope.data.url)
            return _validateFail(scope, 'url', 'Please specify a valid URL');
        if (scope.data.selectedTab == 'library' && !_resourceLibrary.getSelectedUrlInfo().url)
            return _validateFail(scope, 'libError', 'Please select an item from the library');
        if (scope.data.selectedTab == 'upload' && scope.data.resource.length == 0)
            return _validateFail(scope, 'resource', 'Please select the resource to upload');
        if (scope.data.selectedTab == 'record' && !scope.recorder.recordedBlob)
            return _validateFail(scope, 'recordingName', 'Before uploading, please click on the "record button" and record your voice/video');
        return true;
    }

    function _validateFail(scope, attr, errMsg) {
        return nlDlg.setFieldError(scope, attr,
            nl.t(errMsg));
    }

	function _onUploadOrModify(e, addModifyResourceDlg, card, $scope) {
	    var sd = addModifyResourceDlg.scope.data;
	    var recorder = addModifyResourceDlg.scope.recorder;
		var resourceList = sd.selectedTab == 'record' ? recorder.getResourceList(sd) : sd.resource;
		var compressionlevel = sd.compressionlevel.id;
		var keyword = sd.keywords || '';
		var resid =  (card !== null) ? sd.card.Id : null;
		var resourceInfoDict = {shared: sd.shared};
		if (sd.restype.id == 'Image') resourceInfoDict['animated'] = sd.animated;
		if (sd.resourceFilter == 'bg') resourceInfoDict['bgShade'] = sd.bgShade.id;
	    resourceInfoDict['insertfrom'] = sd.lessonid ? nl.t('/lesson/edit/{}/', sd.lessonid) : '/';
	    
	    if(sd.isPasteAndUpload) {
	    	resourceInfoDict['name'] = sd.filename;
	    	resourceInfoDict['filename'] = nl.t('{}{}', sd.filename, resourceList[0].extn) || resourceList[0].resource.name;
	    }
	    if(resourceList.length == 0) {
		    if (e) e.preventDefault();
		    if (sd.selectedTab == 'record') {
                addModifyResourceDlg.scope.error.selectedTab = 'Please record before uploading.';
		    } else {
                addModifyResourceDlg.scope.error.resource = 'Please select the resource to upload';
		    }
	    	return;
		}
		nlDlg.showLoadingScreen();
		nlResourceUploader.uploadInSequence(resourceList, keyword, compressionlevel, resid, resourceInfoDict)
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
		}};
        uploadAgainDlg.show('view_controllers/resource/upload_done_dlg.html', [], cancelButton);
	}

    this.insertOrUpdateResource = function($scope, restypes, markupText, showMarkupOptions, resourceDict, resourceFilter, lessonId, card) {
    	// resoureFilter = 'bg' | 'icon' | undefined
		nlDlg.hideLoadingScreen();
		if(!resourceDict && _updatedResourceList.length == 0) {
			return nl.q(function(resolve, reject) {
				nlDlg.showLoadingScreen();
				nlServerApi.lessonGetResourceLibrary().then(function(_resourceDict) {
					nlDlg.hideLoadingScreen();
					resourceDict = _resourceDict;
					var promise = initResources($scope, restypes, markupText, showMarkupOptions, resourceDict, resourceFilter, lessonId, card);
					promise.then(function(selected) {
						resolve(selected);
					});
				});
			})
		} else {
			return initResources($scope, restypes, markupText, showMarkupOptions, resourceDict, resourceFilter, lessonId, card);
		}
	};
	
	function initResources($scope, restypes, markupText, showMarkupOptions, resourceDict, resourceFilter, lessonId, card) {
    	var restype = markupText.substring(0, markupText.indexOf(':'));
    	if(_updatedResourceList.length == 0) _updatedResourceList = resourceDict.resourcelist  ? resourceDict.resourcelist : [];
    	_resourceLibrary.init(_updatedResourceList, resourceFilter, restype, resourceDict, lessonId, maxResults);
        var markupHandler = new MarkupHandler(nl, nlDlg, true, markupText, showMarkupOptions);
        return self.show($scope, card || null, restypes, true, markupHandler);
	}
}];

function MarkupHandler(nl, nlDlg, insertOrUpdateResource, markupText, showMarkupOptions) {
    var _scope =  null;
    this.initScope = function(scope) {
        _scope = scope;
        _scope.markupInfo = {};
         
        _scope.help = _getHelp();
        _scope.data.buttonname = insertOrUpdateResource ? 'OK' : _scope.data.card ? 'Modify' : 'Upload';
        _scope.data.url = '';

        if (!insertOrUpdateResource) return true;
        var markupInfo = _scope.markupInfo;
        markupInfo.insertOrUpdateResource = true;
        markupInfo.showMarkupOptions = showMarkupOptions;
        markupInfo.restypeInfo = _getRestypeInfoFromMarkup(markupText);
        if (!markupInfo.restypeInfo) {
            nlDlg.popupAlert({title: 'Error', template: nl.t('Invalid markup text is selected: <b>{}</b>', markupText)});
            return false;
        }
        _scope.data.restype.id = markupInfo.restypeInfo.type;
        _scope.recorder = new NlMediaRecorder(nl, nlDlg);
        var params = nl.window.location.search;
        var isRaw = params.indexOf('rawedit') > 0 ? true : false;
        if (isRaw && _scope.recorder.canRecordMedia()) {
            if (_scope.data.restype.id == 'Audio') {
            	_scope.data.enableAudioRecord = true;
           	} else if (_scope.data.restype.id == 'Video') {
            	_scope.data.enableVideoRecord = true;
        	}
        }
        _scope.data.pagetitle = 'Insert ' + markupInfo.restypeInfo.title;
        return _initMarkupParams(markupInfo.restypeInfo);
    };
    
    function _getHelp() {
        return {
            source: {name: nl.t('Source'), help: nl.t('You can directly provide a URL or upload a file from your device to the server.')},
            restype: {name: nl.t('Media type'), help: nl.t('Select the type of file (image, video, ...).')},
            url: {name: nl.t('URL'), help: nl.t('Copy and paste or type in the URL.')},
            resource: {name: nl.t('Choose file'), help: nl.t('Choose a file from your device to upload. On mobile devices, you will be able to use your camera or recorder to capture images, record videos and audios directly from here.')},
            recordingName: {name: nl.t('Name'), help: nl.t('Provide a name for your recording.')},
            keywords: {name: nl.t('Remarks'), help: nl.t('Provide some remarks while uploading. This will help you later search this resource.')},
            compressionlevel: {name: nl.t('Compression'), help: nl.t('This is supported only for images. By default medium compression level is chosen which is good enough for high definition screen viewing. Do not compress animated GIFs. It is recommended to not alter this value otherwise.')},
            markupCover: {name: nl.t('Cover'), help: nl.t('If you show the complete area, you might see empty spaces in the top and bottom or on the sides depending on the image size. If you choose to cover the complete area, some portions of the image may not be visible depending on the available area dimension.')},
            markupLink: {name: nl.t('Link URL'), help: nl.t('You may optionally make your image a clickable link.')},
            markupText: {name: nl.t('Link title'), help: nl.t('Enter the text to be displayed for the link.')},
            markupPopup: {name: nl.t(''), help: nl.t('External links are best suited to be opened in a new window.')},
            markupPage: {name: nl.t('Page number'), help: nl.t('Select the page number of the PDF to be displayed.')},           
            markupScale: {name: nl.t('Scale ratio'), help: nl.t('You could scale the PDF viewing area with respect to width of the section. Use scale 1.0 to scale the PDF to use 100% of width. Using a scale of 1.2 will use 120% of width of the container resulting in a horizontal scroll bar. If you want to avoid a vertical scroll bar, you could try using a smaller scale like 0.8.')},
            markupStart: {name: nl.t('Start from'), help: nl.t('Play your video or audio starting from the given time (in minutes and seconds).')},
            markupEnd: {name: nl.t(' End at'), help: nl.t('End playing your video or audio at the given time (in minutes and seconds).')},
        	bgShade: {name: nl.t('Text color'), help: nl.t('Depending on whether your image is dark or light, you can set the text color to one which is clearly visible in the background. With this, you can control the colors used for different types of text (normal, heading, link, ...)')},
        	shared: {name: nl.t('Shared resource'), help: nl.t('Selecting this will allow other users in your group to use this resource within the the modules they create.')},
        	selectedImage: {name: nl.t('Image to upload'), help:nl.t('This image will be uploaded to the server.')},
        	filename: {name: nl.t('Provide name for resource'), help: nl.t('Name of the resource while stored to server')},
        	animated: {name: nl.t('Animated image'), help: nl.t('Select this only if you are uploading an animated image (animated GIF).')}
        };  
    }

    var _markupToInfo = {
        'img:': {type: 'Image', prefix: 'img:', title: 'image'},
        'pdf:': {type: 'PDF', prefix: 'pdf:', title: 'PDF'},
        'audio:': {type: 'Audio', prefix: 'audio:', title: 'audio'},
        'video:': {type: 'Video', prefix: 'video:', title: 'video'},
        'embed:': {type: 'Video', prefix: 'video:', title: 'video'},
        'link:': {type: 'Attachment', prefix: 'link:', title: 'link'}
    };

    var _restypeToMarkup = {};
    function _initRestypeToMarkup() {
        for(var markup in _markupToInfo) {
            var info = _markupToInfo[markup];
            _restypeToMarkup[info.type] = info;
        }
    }
    _initRestypeToMarkup();

    function _getRestypeInfoFromMarkup(markupText) {
        if (markupText) markupText = markupText.trim();
        var pos = markupText ? markupText.indexOf(':') : -1;
        if (pos < 0) return null;
        var type = markupText.substring(0, pos+1);
        var ret = type in _markupToInfo ? angular.copy(_markupToInfo[type]) : null;
        if (!ret) return null;
        ret.params = {};

        markupText = markupText.substring(pos+1);
        pos = markupText.indexOf('[');
        ret.url = pos < 0 ? markupText: markupText.substring(0, pos);
        if (pos < 0) return ret;

        markupText = markupText.substring(pos+1);
        pos = markupText.indexOf(']');
        if (pos < 0) return null;
        markupText = markupText.substring(0, pos);
        var params = markupText.split('|');
        for(var i=0; i<params.length; i++) {
            var param = params[i];
            pos = param.indexOf('=');
            var attr = param.substring(0, pos);
            ret.params[attr] = param.substring(pos+1);
        }
        return ret;
    }

    function _initMarkupParams(restypeInfo) {
        if (!restypeInfo) restypeInfo = {params: {}};
        var sd = _scope.data;
        sd.url = restypeInfo.url || '';
        sd.bgShade = {id: restypeInfo.params.bgdark ? 'bgdark' : 'bglight'};

        _scope.options.markupCover = [
            {id: 'retain_ar', name: nl.t('Show the complete image')},
            {id: 'stretch', name: nl.t('Cover the complete area')}];
        sd.markupCover = ('cover' in restypeInfo.params && restypeInfo.params.cover == '1')
            ? _scope.options.markupCover[1] : _scope.options.markupCover[0];
        sd.markupLink = restypeInfo.params.link || '';
        sd.markupText = restypeInfo.params.text || '';
        sd.markupPopup = ('popup' in restypeInfo.params) ? (restypeInfo.params.popup == '1') : true;

        sd.markupPage = ('page' in restypeInfo.params) ? parseInt(restypeInfo.params.page) : 1;
        sd.markupScale = restypeInfo.params.scale || '1.0';
		sd.markupStart = parseInt(restypeInfo.params.start) || 0;
		sd.markupEnd = parseInt(restypeInfo.params.end) || 0;
        if('start' in restypeInfo.params) {
        	var start = parseInt(restypeInfo.params.start);
			sd.markupStartMins = Math.floor(start/60);
			sd.markupStartSecs = start % 60;
        }
        if('end' in restypeInfo.params) {
        	var end = parseInt(restypeInfo.params.end);
			sd.markupEndMins = Math.floor(end/60);
			sd.markupEndSecs = end % 60;
        }
        return true;
    }
    
    this.getMarkupUrl = function(sd, url) {
        if (!showMarkupOptions) return url;
        var prefix = '';
        var params = [];
        if (!(sd.restype.id in _restypeToMarkup)) return '';
        var markupInfo = _restypeToMarkup[sd.restype.id];
        if (sd.restype.id == 'Image') {
            prefix = 'img:';
            _addMarkupParam(params, 'cover', sd.markupCover.id, 'retain_ar', {stretch: 1});
            var isLink = _addMarkupParam(params, 'link', sd.markupLink, '');
            if (isLink) _addMarkupParamBool(params, 'popup', sd.markupPopup, false);
        } else if (sd.restype.id == 'Attachment') {
            prefix = 'link:';
            _addMarkupParam(params, 'text', sd.markupText, '');
            _addMarkupParamBool(params, 'popup', sd.markupPopup, false);
        } else if (sd.restype.id == 'PDF') {
            prefix = 'pdf:';
            _addMarkupParam(params, 'page', sd.markupPage, 1);
            _addMarkupParam(params, 'scale', sd.markupScale, '1.0');
        } else if (sd.restype.id == 'Audio') {
            prefix = 'audio:';
            var start = (sd.markupStartMins || 0)*60 + (sd.markupStartSecs || 0);
            var end = (sd.markupEndMins || 0)*60 + (sd.markupEndSecs || 0);
            _addMarkupParam(params, 'start', start, 0);
            _addMarkupParam(params, 'end', end, 0);
        } else if (sd.restype.id == 'Video') {
            prefix = 'video:';
            var start = (sd.markupStartMins || 0)*60 + (sd.markupStartSecs || 0);
            var end = (sd.markupEndMins || 0)*60 + (sd.markupEndSecs || 0);
            _addMarkupParam(params, 'start', start, 0);
            _addMarkupParam(params, 'end', end, 0);
        }
        params = params.join('|');
        url = prefix + url;
        if (params) url = nl.fmt2('{}[{}]', url, params);
        return url;
    };

    function _addMarkupParam(params, param, dlgVal, defVal, convertDict) {
        if (!convertDict) convertDict = {};
        if (dlgVal === defVal) return false;
        var val = dlgVal in convertDict ? convertDict[dlgVal] : dlgVal;
        params.push(nl.fmt2('{}={}', param, val));
        return true;
    }
    
    function _addMarkupParamBool(params, param, dlgVal, defVal) {
        _addMarkupParam(params, param, dlgVal ? '1' : '0', defVal ? '1' : '0');
    }
}

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

//-------------------------------------------------------------------------------------------------
function NlMediaRecorder(nl, nlDlg) {
    self = this;
    var _recorder = null;
    var _stream = null;
    this.recordedUrl = null;
    this.recordedBlob = null;
    this.recordingStartTime = null;
    this.state = 'pending';
    this.statusMsg = _getStatusMsg();
    
    this.canRecordMedia = function() {
        if (!navigator.mediaDevices) return false;
        if (!MediaRecorder) return false;
        var mimes = [
            'video/webm', 
            'video/webm;codecs=vp8',
            'video/webm;codecs=vp9',
            'video/webm;codecs=h264',
            'video/webm;codecs=avc1',
            'video/webm;codecs=daala', 
            'video/x-matroska;codecs=avc1',
            'video/mpeg',

            'audio/webm',
            'audio/webm;codecs=opus',
            'audio/mp3',
            'audio/m4a',
        ];

        var ret=false;
        for (var i=0; i<mimes.length; i++) { 
            var mimetypeSupported = MediaRecorder.isTypeSupported(mimes[i]);
            if (mimetypeSupported) ret = true;
            console.log('Mimetype support:', mimes[i], mimetypeSupported); 
        }
        return ret;
    };
    
    this.toggle = function(sd) {
        if (this.state == 'recording') this.stop(sd);
        else this.record(sd);
    };
    
    this.record = function(sd) {
        this.recordedBlob = null;
        this.state = 'starting';
        this.statusMsg = _getStatusMsg();
        this.recordedUrl = null;
        this.recordingStartTime = null;
        this.isVideo = (sd.restype.id == 'Video');
        var cfg= {audio: true, video: this.isVideo};
        navigator.mediaDevices.getUserMedia(cfg).then(_onGotMedia);
    };

    this.stop = function(sd) {
        if (!_recorder || this.state != 'recording') return;
        this.state = 'stopping';
        this.statusMsg = _getStatusMsg();
        nlDlg.showLoadingScreen();
        setTimeout(function() {
            _recorder.stop();
        }, 0);
    };
    
    this.getResourceList = function(sd) {
        if (!this.recordedBlob) return [];
        var file = new File([this.recordedBlob], self.getRecordedFileName(sd), 
            {type: self.getMimeType()});
        var ret = {resource: file, restype: sd.restype.id, extn: self.getExtn()};
        return [ret];
    };

    this.getMimeType = function() {
        return self.isVideo ? 'video/webm' : 'audio/webm';
    };

    this.getExtn = function() {
        return self.isVideo ? '.webm' : '.webm';
    };

    this.getRecordedFileName = function(sd) {
        return _toIdName(sd.recordingName) + self.getExtn();
    };
    
    function _toIdName(input) {
        input = input.toLowerCase();
        input = input.replace(/[^a-z0-9_-]/g, function(x) {
            return '-';
        });
        return input;
    }

    function _onGotMedia(stream) {
        _stream = stream;
        var preview = document.getElementById("res_add_dlg_recorder_preview");
        preview.srcObject = stream;
        preview.captureStream = preview.captureStream || preview.mozCaptureStream;
        preview.onplaying = _startPreRecording;
    }
    
    function _startPreRecording() {
        var preview = document.getElementById("res_add_dlg_recorder_preview");
        var stream = preview.captureStream();
        var opts = {
            //audioBitsPerSecond : 128000,
            //videoBitsPerSecond : 2500000,
            mimeType : self.getMimeType()};
        _recorder = new MediaRecorder(stream, opts);
        var data = [];
        _recorder.ondataavailable = function(event) {
            data.push(event.data);
        };
        _recorder.onstop = function() {
            _onRecordingDone(data);
        };

        self.state = 'prerecording';
        self.statusMsg = _getStatusMsg();
        self.recordingStartTime = (new Date()).getTime();
        _executeCheckingLoop();
    }

    var maxRecordingTimeMS = 10*60*1000;
    var preRecordingTimeMS = 5000;
    var checkingLoopCounter = 0;
    function _executeCheckingLoop() {
        nl.timeout(function() {
            var diff = ((new Date()).getTime() - self.recordingStartTime);
            if (self.state == 'prerecording') {
                if (diff >= preRecordingTimeMS) {
                    _recorder.start();                    
                    self.state = 'recording';
                    self.recordingStartTime = (new Date()).getTime();
                    checkingLoopCounter = 0;
                }
                self.statusMsg = _getStatusMsg();
                _executeCheckingLoop();
            } else if (self.state == 'recording') {
                if (diff >= maxRecordingTimeMS) {
                    self.recordingStartTime = null;
                    self.stop();
                } else {
                    self.statusMsg = _getStatusMsg();
                    checkingLoopCounter++;
                    if (checkingLoopCounter % 50 == 0) _recorder.requestData();
                    _executeCheckingLoop();
                }
            }
        }, 100);
    }

    function _onRecordingDone(recordedChunks) {
        self.recordedBlob = new Blob(recordedChunks, {type: self.getMimeType()});
        self.recordedUrl = URL.createObjectURL(self.recordedBlob);
        var preview2 = document.getElementById("res_add_dlg_recorder_preview2");
        preview2.src = self.recordedUrl;
        self.state = 'done';
        self.statusMsg = _getStatusMsg();

        _stopRecording();
        nlDlg.hideLoadingScreen();
    }

    function _stopRecording() {
        var tracks = _stream.getTracks();
        for(var i=0; i<tracks.length; i++) tracks[i].stop();
    }

    function _getStatusMsg() {
        if (self.state == 'pending') return 'Press record to start recording.';
        if (self.state == 'starting' || self.state == 'stopping') return 'Please wait ...';
        if (self.state == 'done') return 'Recording done.';
        
        if (!self.recordingStartTime) return '';
        var diff = (new Date()).getTime() - self.recordingStartTime;
        if (self.state == 'prerecording') {
            diff = preRecordingTimeMS - diff;
            diff = diff >= 0 ? Math.round(diff/1000) : 0;
            return nl.t('Recording will start in {} seconds.', diff);
        }
        return nl.t('Recording: {} seconds.', Math.round(diff/1000));
    }
}

//-------------------------------------------------------------------------------------------------
function ResourceLibrary(nl, nlDlg, nlServerApi, nlResourceUploader) {

	var _resourceList = [];	
	var _selectedResource = null;
	var _resourceFilter = '';
	var _resourceIds = {};
	var _restypeToImage = {
	    Image: 'dashboard/resource.png', 
	    PDF: 'dashboard/pdf.png' , 
	    Audio: 'dashboard/audio.png' , 
	    Video: 'dashboard/video1.png',
	    Attachment: 'dashboard/attach.png',
	};
	var _isInitialised = false;
 
 	var _groupNextStartPos = null;
	var _selfNextStartPos = null;
	var _canFetchMoreSelf = true;
	var _canFetchMoreGroup = true;

	var _restype = null;
	var _lessonId = null;
	var _maxResults = 50;
	var _selfFirstFetch = true;
	var _groupFirstFetch = true;
	this.init = function(resourceList, resourceFilter, restype, resourceDict, lessonId, maxResults) {
		_maxResults = maxResults || 50;
		_init(resourceList, resourceFilter, restype, resourceDict, lessonId);
	};	
	
	function _init(resourceList, resourceFilter, restype, resourceDict, lessonId, scope) {
		_selectedResource = _selectedResource || null;
		_resourceFilter = resourceFilter;
		_resourceList = [];
		_lessonId = lessonId;
		_restype = restype;
		_resourceIds = {};
		if (restype == 'img') {
			if (resourceFilter != 'bg') {
				for(var i=0; i<resourceList.length; i++) {
		            var res = resourceList[i];
		            if (res.restype == 'Image' || !res.restype) {
		            	if(res.id in _resourceIds) continue;
		            	_resourceIds[res.id] = true;
		            	_resourceList.push(resourceList[i]);		            	
		            }
				}
			} else if(resourceFilter == 'bg') {
				_resourceList = [];
				for(var i=0; i<resourceList.length; i++) {
					var res = resourceList[i];
					if (res.restype == 'Image' || !res.restype) {
		            	if(res.id in _resourceIds) continue;
						if ('bgShade' in res) {
			            	_resourceIds[res.id] = true;
							_resourceList.push(res);							
						}
					}
				}
			}
		} else if (restype == 'video' || restype == 'embed') {
			_updateResourceList(resourceList, 'Video');
		} else if (restype == 'link') {
			_updateResourceList(resourceList, 'Attachment');
		} else if (restype == 'audio') {
			_updateResourceList(resourceList, 'Audio');			
		} else if (restype == 'pdf') {
			_updateResourceList(resourceList, 'PDF');
		}
		if(scope) {
	    	_updateSelected(scope);
	    	scope.data.resourceList = _getFilteredList(scope, scope.data.resourceLibraryDropDown.id, scope.data.animFilter, scope.data.librarySearchText);
		}
	};

	this.initScope = function(scope, userInfo) {
        scope.data.resourceFilter = _resourceFilter;
		scope.data.librarySearchText = '';

		var grpname = ((userInfo || {}).groupinfo || {}).name || 'Group';
		scope.options.resourceLibraryDropDown = [{id: '', name:'All libraries'}, {id: 'common', name: 'Nittio library'},
												 {id: 'group', name:nl.t('{} library', grpname)}, {id:'self', name:'Module library'}];
		scope.data.resourceLibraryDropDown = scope.options.resourceLibraryDropDown[1];
        scope.data.animFilter = false;
        scope.data.shared = true;
        scope.data.lessonid = _lessonId;
        scope.data.animated = false;
        scope.data.search = {};

        _updateSelected(scope);
    	scope.data.resourceList = _getFilteredList(scope, scope.data.resourceLibraryDropDown.id, scope.data.animFilter, scope.data.librarySearchText);
		
		scope.onLibraryResourceSelect = function(resource) {
			scope.data.librarySelectedUrl = resource.background;
			_selectedResource = resource;
		};
		
		scope.onFieldChange = function(fieldId) {
			if(fieldId == 'animated') scope.data.compressionlevel =  scope.data.animated ? {id: 'no'} : {id: 'high'};
			if(fieldId == 'resourceLibraryDropDown' && scope.data.resourceLibraryDropDown.id == 'self' && _selfFirstFetch) {
				_selfFirstFetch = false;
				_onSelectingFetchMore(scope, true);
			} else if(fieldId == 'resourceLibraryDropDown' && scope.data.resourceLibraryDropDown.id == 'group' && _groupFirstFetch) {
				_groupFirstFetch = false;
				_onSelectingFetchMore(scope, false);
			} else {
				if(fieldId != 'resourceLibraryDropDown' 
					&& fieldId != 'librarySearchText' 
					&& fieldId != 'animFilter') return;
				var libFilter = scope.data.resourceLibraryDropDown.id;
				var libSearchtext = scope.data.librarySearchText;
				var animFilter = scope.data.animFilter;
				scope.data.resourceList = _getFilteredList(scope, libFilter, animFilter, libSearchtext);
			}
		};
			
		scope.fetchMoreResources = function() {
            if (!scope.data.search.showDetails) return;
            var dropdownId = scope.data.resourceLibraryDropDown.id;
			var isSelf = _canFetchMoreSelf && (dropdownId == 'self' || dropdownId == '');
			if (!isSelf && !_canFetchMoreGroup) return;
			if (isSelf) _selfFirstFetch = false;
			if (!isSelf) _groupFirstFetch = false;
            _onSelectingFetchMore(scope, isSelf);
		};
		scope.onResourceModify = function(resource) {
			_showResourceModify(scope, resource);
		};
 		_updateTabSelection(scope);
	};
	
	this.getSelectedUrlInfo = function() {
		if (!_selectedResource) return {};
    	return {url: _selectedResource.background, bgShade: _selectedResource.bgShade || 'bgdark'};
	};

	function _onSelectingFetchMore(scope, isSelf) {
		var data = {lessonid: _lessonId, owner: isSelf ? 'self' : 'group', max: _maxResults};
		if (isSelf && _selfNextStartPos) data.startpos = _selfNextStartPos;
		if (!isSelf && _groupNextStartPos) data.startpos = _groupNextStartPos;
		_fetchMoreResources(scope, data, isSelf);		
	};
	
	function _updateSelected(scope) {
		var urlToResource = {};	
		for(var i=0; i<_resourceList.length; i++)
			urlToResource[_resourceList[i].background] = _resourceList[i];	
        var inputUrl = scope.markupInfo.restypeInfo ? scope.markupInfo.restypeInfo.url : '';
        _selectedResource = urlToResource[inputUrl] || null;
        if (_selectedResource) scope.data.librarySelectedUrl = _selectedResource.background;
        if (!_selectedResource) return;
        for(var i=0; i<scope.options.resourceLibraryDropDown.length; i++) {
        	if(scope.options.resourceLibraryDropDown[i].id == _selectedResource.owner) {
        		scope.data.resourceLibraryDropDown = scope.options.resourceLibraryDropDown[i];
        	}
        }
	}
	
	function _fetchMoreResources(scope, data, isSelf) {
		nlDlg.showLoadingScreen();
		nlServerApi.lessonUpdateResourceLibrary(data).then(function(resourceDict) {
            nlDlg.hideLoadingScreen();
            if(Object.keys(resourceDict).length == 0) return;
            if(isSelf) {
				_canFetchMoreSelf = resourceDict.more;
				_selfNextStartPos = resourceDict.nextstartpos;            	
            } else {
				_canFetchMoreGroup = resourceDict.more;
				_groupNextStartPos = resourceDict.nextstartpos;    	
            }
			_updatedResourceList = resourceDict.resourcelist.concat(_updatedResourceList);
			_init(_updatedResourceList, _resourceFilter, _restype, {}, _lessonId, scope);
		});
	}
	
	function _showResourceModify(scope, resource) {
		var _resourceModifyDlg = nlDlg.create(scope);
			_resourceModifyDlg.setCssClass('nl-height-max nl-width-max');
			
			_resourceModifyDlg.scope.data = {};
			_resourceModifyDlg.scope.options = {};
			_resourceModifyDlg.scope.dlgTitle = nl.t('Modify resource');
			_resourceModifyDlg.scope.data.restype = resource.restype;
			_resourceModifyDlg.scope.data.title = resource.name;
			_resourceModifyDlg.scope.data.shared = resource.shared;
			_resourceModifyDlg.scope.data.keywords = resource.tags;
			_resourceModifyDlg.scope.data.resid = resource.resid;
			_resourceModifyDlg.scope.data.info = angular.fromJson(resource.info);
			if(resource.restype == 'Image') {
				_resourceModifyDlg.scope.data.animated = _resourceModifyDlg.scope.data.info.animated ? true : false;
				_resourceModifyDlg.scope.options.bgShade = [
						{id: 'none', name: 'Not an background image'},
			            {id: 'bgdark', name: 'Light text color for darker background'},
			            {id: 'bglight', name: 'Dark text color for lighter background'}];				
				if(!_resourceModifyDlg.scope.data.info.bgShade) {
					_resourceModifyDlg.scope.data.bgShade = _resourceModifyDlg.scope.options.bgShade[0];
				} else {
				    _resourceModifyDlg.scope.data.bgShade = resource.bgShade == 'bglight' ? _resourceModifyDlg.scope.options.bgShade[2] : 
			    										_resourceModifyDlg.scope.options.bgShade[1];
				}
			}

			_resourceModifyDlg.scope.help = _getResourceHelp();
		var modifyButton = {text: nl.t('Modify'), onTap: function(e) {
			_onModifyResource(scope, _resourceModifyDlg.scope.data);
		}};
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
            if (e) e.preventDefault();
            _resourceModifyDlg.close(false);
        }};
		_resourceModifyDlg.show('view_controllers/resource/resource_modify_dlg.html', 
                        [modifyButton], cancelButton, false);
	}
	
	function _getResourceHelp() {
		return {
			title:{name: nl.t('Name'), help: nl.t('You can edit name of the selected resource.')},
            keywords: {name: nl.t('Remarks'), help: nl.t('Provide some remarks while uploading. This will help you later search this resource.')},
        	bgShade: {name: nl.t('Text color'), help: nl.t('Depending on whether your image is dark or light, you can set the text color to one which is clearly visible in the background. With this, you can control the colors used for different types of text (normal, heading, link, ...)')},
        	shared: {name: nl.t('Shared resource'), help: nl.t('Selecting this will allow other users in your group to use this resource within the the modules they create.')},
        	animated: {name: nl.t('Animated image'), help: nl.t('Select this only if you are uploading an animated image (animated GIF).')}
		};
	}

	function _onModifyResource(scope, data) {
		var resourceList = [];
		if(data.restype == 'Image') {
			if(data.animated) 
				data.info['animated'] = 1;
			else
				delete data.info['animated'];
			
			if(data.bgShade.id != 'none') 
				data.info['bgShade'] = data.bgShade.id;
			else
				delete data.info['bgShade'];			
		}

        var data = {name: data.title,
					keywords: data.keywords, 
					info: angular.toJson(data.info, 2),
					resid: data.resid,
					shared: data.shared
                   };

		nlDlg.showLoadingScreen();
        nlServerApi.resourceModifyAttrs(data).then(function success(updatedRes) {
			nlDlg.hideLoadingScreen();
            for(var i=0; i<_updatedResourceList.length; i++) {
            	if(updatedRes.id != _updatedResourceList[i].id) continue;
            	_updatedResourceList.splice(i, 1);
	        	_updatedResourceList.unshift(updatedRes);
            	break;
            }
			_init(_updatedResourceList, _resourceFilter, _restype, {}, _lessonId, scope);
		});
	}
	
	function _updateResourceList(resourceList, restype) {
		for(var i=0; i<resourceList.length; i++) {
			var res = resourceList[i];
	        res.resimg = nl.url.resUrl(_restypeToImage[restype]);
			if (res.restype == restype) {
				if(res.id in _resourceIds) continue;
				_resourceIds[res.id] = true;
				_resourceList.push(res);
			}
		}
		return;
	}
	
	function _updateTabSelection(scope) {
    	if(!scope.markupInfo.insertOrUpdateResource || (scope.data.card && scope.data.card.isPasteAndUpload)) {
    		scope.data.selectedTab = 'upload';
    		return;
    	}
    	if(scope.data.card && card.resource)
		scope.data.url = scope.markupInfo.restypeInfo.url;
    	if (scope.data.url && !_selectedResource) {
    		scope.data.selectedTab = 'url';
    		return;
    	}
		scope.data.selectedTab = 'library';
	}
	
	var MAX_VISIBLE=1000;
	function _getFilteredList(scope, libFilter, animFilter, searchText) {
		var ret = [];
		var totalResCount = 0; 
		var selectedUrl = _selectedResource ? _selectedResource.background : null;
		for(var i=0; i<_resourceList.length; i++) {
			var res = _resourceList[i];
			res.searchWeight = 0;
			if (libFilter == 'common' && res.owner) continue;
			if (libFilter == 'group' && res.owner != 'group') continue;
			if (libFilter == 'self' && res.owner != 'self') continue;
			totalResCount++; 
			if (animFilter && !res.animated) continue;
			var searchWeight = _getSearchWeight(res, searchText);
			if (searchWeight == 0) continue;
            res.searchWeight = searchWeight;
			if (selectedUrl && res.background == selectedUrl) continue; // Add to list top later
			ret.push(res);
		}
		if (searchText)
    		ret = ret.sort(function(a, b) {
    			if (a.searchWeight == b.searchWeight) return 0;
    			return (a.searchWeight > b.searchWeight) ? -1 : 1;
    		});

    	if (_selectedResource && _selectedResource.searchWeight) {
			ret.unshift(_selectedResource);
    	}
		var canSearchMore = (_canFetchMoreSelf || _canFetchMoreGroup);
		if (libFilter == 'common') canSearchMore = false;
		if (libFilter == 'group') canSearchMore = _canFetchMoreGroup;
		if (libFilter == 'self') canSearchMore = _canFetchMoreSelf;
		_updateInfotext(scope, totalResCount, ret.length, canSearchMore);    		
		return ret.slice(0, MAX_VISIBLE);
	}

	function _getSearchWeight(res, searchText) {
		if (!searchText) return 1;
		var searchWeight = 0;
		var words = searchText.split(' ');
		for (var i=0; i<words.length; i++) {
			var word = words[i].toLowerCase();
			var tags = (res.tags || '') + (res.colors || '') + (res.types || '')
				+ (res.animated ? 'animated' : '');

			if (_isFound(word, res.name)) searchWeight += 10;
			else if (_isFound(word, res.group)) searchWeight += 8;
			else if (_isFound(word, tags)) searchWeight += 5;
			else if (_isFound(word, res.background)) searchWeight += 1;
			else return 0;
		}
		return searchWeight;
	}
	
	function _isFound(word, within) {
		return (within && within.toLowerCase().indexOf(word) >= 0);
	}

	function _updateInfotext(scope, total, matched, canSearchMore) {
		var visible = matched > MAX_VISIBLE ? MAX_VISIBLE : matched;
        var oldInfotxt = scope.data.search.infotxt || '';
        var msg1 = nl.t('There are no items to display.');
        scope.data.search.cls = 'fgrey';
        scope.data.search.showDetails = false;
        scope.data.search.clsAnimate = 'anim-highlight-on';
        if (visible == 0) {
            scope.data.search.infotxt = nl.fmt2('<i class="padding-mid icon ion-alert-circled"></i>{}', 
                msg1);
            scope.data.search.infotxt2 = msg1;
            scope.data.search.cls = 'fgrey';
            return;
	    }
        var item = (visible == 1) ? 'item' : 'items';
        msg1 = nl.t('Displaying <b>{}</b> {}.', visible, item);
        if (!canSearchMore) {
            scope.data.search.infotxt = nl.t('{} Fetch complete.', msg1);
            scope.data.search.infotxt2 = msg1;
	        return;
        }
        scope.data.search.cls = 'fgrey nl-link-text';
        scope.data.search.showDetails = true;
        scope.data.search.infotxt = nl.t('{} <b>Fetch more <i class="icon ion-refresh"></i></b>.', msg1);
        scope.data.search.infotxt2 = nl.t('Not found what you are looking for? Do you want to fetch more items from the server?');
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

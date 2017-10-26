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
	
	function _isMine(_type) {
		return (_type == 'my' || _type == 'upload');
	}
	
	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {
			var params = nl.location.search();
			_type = params.type || 'my'; // can be my, all or upload
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
		if (_isMine(_type) && _userInfo.permissions.admin_user) {
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
			nl.fmt.addLinkToAvp(linkAvp, 'delete', null, 'resource_delete');
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
var ResourceAddModifySrv = ['nl', 'nlServerApi', 'nlDlg', 'Upload', 'nlProgressFn', 'nlResourceUploader',
function(nl, nlServerApi, nlDlg, Upload, nlProgressFn, nlResourceUploader){
	var COMPRESSIONLEVEL = [{id: 'no', name: 'No compression'},
						{id: 'low', name:'Low compression'},
						{id: 'medium', name:'Medium compression'},
						{id: 'high', name:'High compression'}];

	this.show = function($scope, card, restypes, onlyOnce, markupHandler) {
	    if (!markupHandler) markupHandler = new MarkupHandler(nl, nlDlg);
		return nl.q(function(resolve, reject) {
			var addModifyResourceDlg = nlDlg.create($scope);
			_initResourceDlg(addModifyResourceDlg, card, restypes);
            markupHandler.initScope(addModifyResourceDlg.scope);
            addModifyResourceDlg.resolveAfterOnce = function () {
                if (!onlyOnce) return false;
                addModifyResourceDlg.resolve(true);
                return true;
            }; 
            addModifyResourceDlg.resolve = function (afterFirstOk) {
                // Avoid multiple callbacks which are comming due to "close" call
                if (addModifyResourceDlg.resolvedCalled) return;
                addModifyResourceDlg.resolvedCalled = true;
                addModifyResourceDlg.close();
                resolve(markupHandler.processResults(addModifyResourceDlg, afterFirstOk));
            }; 
			_showDlg(addModifyResourceDlg, card, $scope, restypes, markupHandler);
		});
	};

	function _showDlg(addModifyResourceDlg, card, $scope, restypes, markupHandler) {
		var buttonName = addModifyResourceDlg.scope.data.buttonname;
        var modifyButton = {text: buttonName, onTap: function(e) {
        	if(e) e.preventDefault();
        	if (addModifyResourceDlg.scope.data.source.id != 'upload') {
                if(!markupHandler.validate()) return;
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
			addModifyResourceDlg.scope.data.restype.id = addModifyResourceDlg.scope.options.restype[0].id;
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
		}};
        uploadAgainDlg.show('view_controllers/resource/upload_done_dlg.html', [], cancelButton);
	}

    this.insertOrUpdateResource = function($scope, restypes, markupText, showMarkupOptions) {
        var markupHandler = new MarkupHandler(nl, nlDlg, true, markupText, showMarkupOptions);
        var opt = {onlyOnce: true, insertOrUpdateResource: true, markupText: markupText};
        return this.show($scope, null, restypes, true, markupHandler);
    };

}];

function MarkupHandler(nl, nlDlg, insertOrUpdateResource, markupText, showMarkupOptions) {
    var _scope =  null;
    this.initScope = function(scope) {
        _scope = scope;
        _scope.markupInfo = {};
         
         _scope.data.buttonname =  insertOrUpdateResource ? 'OK' : _scope.card ? 'Modify' : 'Upload';

        _scope.options.source = [
            {id: 'url', name: nl.t('Provide a URL from internet')},
            {id: 'upload', name: nl.t('Upload from your device to the server')}];
        _scope.data.source = _scope.options.source[0];
        _scope.data.url = '';

        if (!insertOrUpdateResource) return;
        var markupInfo = _scope.markupInfo;
        markupInfo.insertOrUpdateResource = true;
        markupInfo.showMarkupOptions = showMarkupOptions;
        markupInfo.restypeInfo = _getRestypeInfoFromMarkup(markupText);
        if (markupInfo.restypeInfo) {
            _scope.data.restype.id = markupInfo.restypeInfo.type;
            _scope.data.pagetitle = 'Insert ' + markupInfo.restypeInfo.title;
        } else {
            _scope.data.pagetitle = 'Insert media';
        }
        _initMarkupParams(markupInfo.restypeInfo);
    }
    
    this.validate = function() {
        if (_scope.data.source.id == 'url' && !_scope.data.url)
            return _validateFail(_scope, 'url', 
            'Please specify a valid URL');
        return true;
    }

    function _validateFail(scope, attr, errMsg) {
        return nlDlg.setFieldError(scope, attr,
            nl.t(errMsg));
    }

    this.processResults = function(addModifyResourceDlg, afterFirstOk) {
        if (!insertOrUpdateResource) return addModifyResourceDlg.resInfos;
        if (!afterFirstOk) return null;
        var sd = _scope.data;
        var resInfo = sd.source.id == 'upload' && addModifyResourceDlg.resInfos.length == 1 ?
            addModifyResourceDlg.resInfos[0] : null;
        var url = sd.source.id == 'url' ? sd.url : resInfo ? resInfo.url : '';
        if (!url) return null;
        if (!showMarkupOptions) return url;
        return _getMarkupUrl(sd, url);
    }

    var _markupToInfo = {
        'img:': {type: 'Image', prefix: 'img:', title: 'image'},
        'pdf:': {type: 'PDF', prefix: 'pdf:', title: 'PDF'},
        'audio:': {type: 'Audio', prefix: 'audio:', title: 'audio'},
        'video:': {type: 'Video', prefix: 'video:', title: 'video'},
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
        if (pos < 0) return ret;
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

        _scope.options.markupCover = [
            {id: 'retain_ar', name: nl.t('Retain the aspect ratio of the image')},
            {id: 'stretch', name: nl.t('Stretch the image to occupy the complete area')}];
        sd.markupCover = restypeInfo.params.cover || _scope.options.markupCover[0];
        sd.markupLink = restypeInfo.params.link || '';
        sd.markupText = restypeInfo.params.text || '';
        sd.markupPopup = ('popup' in restypeInfo.params) ? (restypeInfo.params.popup == '1') : true;

        sd.markupPage = ('page' in restypeInfo.params) ? parseInt(restypeInfo.params.page) : 1;
        sd.markupScale = restypeInfo.params.scale || '1.0';

        sd.markupStart = ('start' in restypeInfo.params) ? parseInt(restypeInfo.params.start) : 0;
        sd.markupEnd = ('end' in restypeInfo.params) ? parseInt(restypeInfo.params.end) : 0;
    }
    
    function _getMarkupUrl(sd, url) {
        var prefix = '';
        var params = [];
        if (!(sd.restype.id in _restypeToMarkup)) return ret;
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
            _addMarkupParam(params, 'start', sd.markupStart, 0);
            _addMarkupParam(params, 'stop', sd.markupStop, 0);
        } else if (sd.restype.id == 'Vedio') {
            prefix = 'video:';
            _addMarkupParam(params, 'start', sd.markupStart, 0);
            _addMarkupParam(params, 'stop', sd.markupStop, 0);
        }
        params = params.join('|');
        url = prefix + url;
        if (params) url = nl.fmt2('{}[{}]', url, params);
        return url;
    }

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

module_init();
})();

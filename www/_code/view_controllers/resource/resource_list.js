(function() {

//-------------------------------------------------------------------------------------------------
// resource_list.js:
// resource - Resource upload dialogs and controllers
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.resource_list', [])
    .config(configFn)
    .controller('nl.ResourceListCtrl', ResourceListCtrl)
    .controller('nl.ResourceUploadCtrl', ResourceUploadCtrl)
	.service('nlResourceModifySrv', ResourceModifySrv)
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
var TYPES = {
	MY : 1,
	ALL : 0
};

var COMPRESSIONLEVEL = [{id: 'no', name: 'No compression'},
						{id: 'low', name:'Low compression'},
						{id: 'medium', name:'Medium compression'},
						{id: 'high', name:'High compression'}];
//-------------------------------------------------------------------------------------------------
var ResourceListCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi', 'nlResourceUploader', 'nlResourceModifySrv',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, nlResourceUploader, nlResourceModifySrv) {

	var _userInfo = null;
	var _allCardsForReview = [];
	var my = 0;
	var search = null;
	
	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {
		var params = nl.location.search();
		my = ('mine' in params) ? parseInt(params.mine) : 0;
		search = ('search' in params) ? params.search : null;
		nl.pginfo.pageTitle = _updatePageTitle(); 
		$scope.cards = {};
		$scope.cards.staticlist = _getStaticCard();
		$scope.cards.emptycard = _getEmptyCard(nlCardsSrv);
		_getDataFromServer(resolve, reject);
		});
	}


	nlRouter.initContoller($scope, '', _onPageEnter);
	
	function _updatePageTitle(){
		if(my == TYPES.MY) return nl.t('My resources');
		if(my == TYPES.ALL) return nl.t('All resources');
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
		if(my == TYPES.ALL) return;	 
		card = {title: nl.t('Upload'), 
				icon: nl.url.resUrl('dashboard/crresource.png'), 
				help: nl.t('You can create a new course by clicking on this card'), 
				url: "/#/resource_upload",
				children: [{
							help: "Upload a new resource by clicking on this link",
							title: "upload a new resource",
							url: "/#/resource_upload",
							children: []
							}],
							style: 'nl-bg-blue'
				};
		ret.push(card);
		return ret;
	} 

    $scope.onCardInternalUrlClicked = function(card, internalUrl) {
    	var lessonId = card.lessonId;
    	if (internalUrl === 'resource_delete') _deleteResource($scope, lessonId);
    	if (internalUrl === 'resource_upload') _resourceUpload($scope,card);
    	if(internalUrl === 'resource_copy') _showLinkCopyDlg($scope, card);
		if(internalUrl === 'resource_modify') _modifyResource($scope, card);
    };

	$scope.onCardLinkClicked = function(card, linkId){
		var resid = card.Id;
		if(linkId == 'resource_modify'){
			_modifyResource($scope, card);
		} else if(linkId == 'resource_delete'){
			_deleteResource($scope, resid);
		}
	};

	function _getDataFromServer(resolve, reject) {
		if(my == TYPES.MY) my = true;
		if(my == TYPES.ALL) my = false;
		var data = {mine: my, searchFilter: search};
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
		console.log(resource);
		var image = null;
		var internalUrl = 'resource_copy';
		if(resource.restype == "PDF") {
			image = nl.url.resUrl('/dashboard/pdf.png');
			url = nl.fmt2('pdf:/resource/resview/{}', resource.resid);
		} else if(resource.restype == "Video") {
			image = nl.url.resUrl('/dashboard/video1.png');
			url = nl.fmt2('video:/resource/resview/{}', resource.resid);
		} else if(resource.restype == "Audio") {
			image = nl.url.resUrl('/dashboard/audio.png');
			url = nl.fmt2('audio:/resource/resview/{}', resource.resid);
		} else if(resource.restype == "Attachment") {
			image = nl.url.resUrl('/dashboard/attach.png');
			url = nl.fmt2('link:/resource/resview/{}', resource.resid);
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
		if (my == TYPES.ALL) card.links = [{id : 'details', text : nl.t('details')}];
		if (my == TYPES.MY) card.links = [{id : 'resource_modify', text : nl.t('modify')},
													{id : 'resource_delete', text : nl.t('delete')},
					  						  		{id : 'details', text : nl.t('details')}];
		card['help'] = nl.t('<span class="nl-card-description"><b>By: {}</b></span><br><span>Keywords: {}</span>', resource.authorname, resource.keywords);
		return card;
	}
	
	function _getResourceListAvps(resource){
		var avps = [];
		var data = JSON.parse(resource.info);
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
		if (my == TYPES.MY) {
			nl.fmt.addLinkToAvp(linkAvp, 'modify', null, 'resource_modify');
			nl.fmt.addLinkToAvp(linkAvp, 'delete', null, 'resource_delete');
		}
	}
	
	function _addSearchInfo(cards) {
		cards.search = {
			placeholder : nl.t('Name/Subject/Remarks/Keyword')
		};
	}

	
	function _modifyResource($scope, card){
		nlResourceModifySrv.show($scope, card);
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
				_updateCardlist($scope, resid);
			});	
		});
	}

	function _updateCardlist($scope, resid){
		for (var i in $scope.cards.cardlist) {
			var card = $scope.cards.cardlist[i];
			if (card.Id !== resid) continue;
			$scope.cards.cardlist.splice(i, 1);
		}
	}
}];
//-------------------------------------------------------------------------------------------------

var ResourceUploadCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'Upload', 'nlProgressFn', 'nlResourceUploader',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, Upload, nlProgressFn, nlResourceUploader) {
    var _template = 0;
    var resourceUploadDlg = nlDlg.create($scope);
    resourceUploadDlg.setCssClass('nl-height-max nl-width-max');

    resourceUploadDlg.scope.options = {};
    resourceUploadDlg.scope.data = {};
    resourceUploadDlg.scope.error = {};

    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            var params = nl.location.search();

            nl.pginfo.pageTitle = nl.t('Upload your content');
			resourceUploadDlg.scope.options.restypes = _getRestypesList();
            resourceUploadDlg.scope.data.keywords = '';
			resourceUploadDlg.scope.data.restypes = {id: 'Image', name: 'Image', restype: 'image'};	
			resourceUploadDlg.scope.options.compressionlevel = COMPRESSIONLEVEL;	
			resourceUploadDlg.scope.data.compressionlevel = {id: 'medium', name: 'medium compression'};
            resolve(true);
            nl.timeout(function() {
                _resourceUploadDlg();
            });
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
    
    //---------------------------------------------------------------------------------------------
	var restype = ['image', 'pdf', 'audio', 'video','attachment'];
		
	function _getRestypesList(){
		var restypeDict = nlResourceUploader.getRestypeToExtDict();
		var count = 0;
		var restypeArray = [];
		for(var i in restypeDict){
			restypeArray.push({id: i, name: i, restype: restype[count]});
			count++;
		}	
		return restypeArray;

	}

    function _resourceUploadDlg() {
    	var resourceList = [];
	        var uploadButton = {text: nl.t('Upload'), onTap: function(e) {
	        	nlDlg.showLoadingScreen();
    		if(resourceUploadDlg.scope.data.restypes.id == 'Image'){
    			resourceList = 	resourceUploadDlg.scope.data.image;
    		} else if (resourceUploadDlg.scope.data.restypes.id == 'PDF'){
    			resourceList = 	resourceUploadDlg.scope.data.pdf;
    		} else if (resourceUploadDlg.scope.data.restypes.id == 'Audio'){
    			resourceList = 	resourceUploadDlg.scope.data.audio;
    		} else if (resourceUploadDlg.scope.data.restypes.id == 'Video'){
    			resourceList = 	resourceUploadDlg.scope.data.video;
    		} else if (resourceUploadDlg.scope.data.restypes.id == 'Attachment'){
    			resourceList = 	resourceUploadDlg.scope.data.attachment;
    		}
    		var compressionlevel = resourceUploadDlg.scope.data.compressionlevel.id;
    		var keyword = resourceUploadDlg.scope.data.keywords;
            if (e) e.preventDefault();
            if(resourceList.length == 0) 
            	return nlDlg.popupAlert({title: nl.t('Please Select'),
            		template: nl.t('Plase select the resource to upload.')});
			nlResourceUploader.uploadInSequence(resourceList, keyword, compressionlevel, null);
			nlDlg.hideLoadingScreen();
			_uploadAgainDlg(e,$scope);
		}};        
		var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
            if (e) e.preventDefault();
            resourceUploadDlg.close(false);
            resourceUploadDlg.destroy();
            nl.location.url('/home');
        }};
        resourceUploadDlg.show('view_controllers/resource/resource_add_dlg.html', 
                        [uploadButton], cancelButton, false);
    }

	function _uploadAgainDlg(e, $scope){
		e.preventDefault();
		var uploadAgainDlg = nlDlg.create($scope);
		    uploadAgainDlg.setCssClass('nl-height-min nl-width-min');
			uploadAgainDlg.scope.data = {};
			uploadAgainDlg.scope.data.url = nl.fmt2('#/lesson_list');
		
		uploadAgainDlg.scope.onClickOnUploadAgain = function(){
            nl.window.location.reload();
		};
		
		uploadAgainDlg.scope.onClickOnViewResourceRepository = function() {
            console.log('hello');
            var url = nl.fmt2('#/lesson_list');
            nl.location.url(url);
		};
		
		var cancelButton = {text: nl.t('Cancel')};
        uploadAgainDlg.show('view_controllers/resource/upload_again_dlg.html', 
                [], cancelButton, false);

	}
}];

//-------------------------------------------------------------------------------------------------
var ResourceModifySrv = ['nl', 'nlServerApi', 'nlDlg', 'Upload', 'nlProgressFn', 'nlResourceUploader',
	function(nl, nlServerApi, nlDlg, Upload, nlProgressFn, nlResourceUploader){

		this.show = function($scope, card){
			var compression = angular.fromJson(card.info);
			console.log(compression);
			var modifyResourceDlg = nlDlg.create($scope);
			_initModifyResourceDlg(modifyResourceDlg, card);
 			
	        var modifyButton = {text: nl.t('Modify'), onTap: function(e) {
	        	nlDlg.showLoadingScreen();
	        	var resourceList = [];
	    		if(modifyResourceDlg.scope.data.restype == 'Image'){
	    			resourceList = 	modifyResourceDlg.scope.data.image;
	    		} else if (modifyResourceDlg.scope.data.restype == 'PDF'){
	    			resourceList = 	modifyResourceDlg.scope.data.pdf;
	    		} else if (modifyResourceDlg.scope.data.restype == 'Audio'){
	    			resourceList = 	modifyResourceDlg.scope.data.audio;
	    		} else if (modifyResourceDlg.scope.data.restype == 'Video'){
	    			resourceList = 	modifyResourceDlg.scope.data.video;
	    		} else if (modifyResourceDlg.scope.data.restype == 'Attachment'){
	    			resourceList = 	modifyResourceDlg.scope.data.attachment;
	    		}
	    		var compressionlevel = modifyResourceDlg.scope.data.compressionlevel.id;
	    		var keyword = modifyResourceDlg.scope.data.keywords;
	    		var resid = modifyResourceDlg.scope.data.card.Id;
	            if (e) e.preventDefault();
	            if(resourceList.length == 0) 
	            	return nlDlg.popupAlert({title: nl.t('Please Select'), 
	            		template: nl.t('Plase select the resource to upload.')});
				nlResourceUploader.uploadInSequence(resourceList, keyword, compressionlevel, resid);
				nlDlg.hideLoadingScreen();
				nl.window.location.reload();
	            modifyResourceDlg.close(false);
	            modifyResourceDlg.destroy();
			}};        

			var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
	            if (e) e.preventDefault();
	            modifyResourceDlg.close(false);
	            modifyResourceDlg.destroy();
	        }};
	        modifyResourceDlg.show('view_controllers/resource/resource_modify_dlg.html', 
	                [modifyButton], cancelButton, false);
				
		};

	function _initModifyResourceDlg(modifyResourceDlg, card) {
	    modifyResourceDlg.setCssClass('nl-height-max nl-width-max');
		modifyResourceDlg.scope.data = {};
	    modifyResourceDlg.scope.error = {};
		modifyResourceDlg.scope.options = {};
		modifyResourceDlg.scope.data.card = card;
        modifyResourceDlg.scope.data.keywords = card.keywords;
		modifyResourceDlg.scope.data.restype = card.restype;	
		modifyResourceDlg.scope.options.compressionlevel = COMPRESSIONLEVEL;	
		modifyResourceDlg.scope.data.compressionlevel = {id: 'medium', name: 'medium compression'};
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

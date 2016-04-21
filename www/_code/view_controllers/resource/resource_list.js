(function() {

//-------------------------------------------------------------------------------------------------
// resource_list.js:
// resource - Resource upload dialogs and controllers
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.resource_list', [])
    .config(configFn)
    .controller('nl.ResourceListCtrl', ResourceListCtrl);
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
}];
//-------------------------------------------------------------------------------------------------
var TYPES = {
	MY : 1,
	ALL : 0
};
//-------------------------------------------------------------------------------------------------
var ResourceListCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi) {

	var _userInfo = null;
	var _allCardsForReview = [];
	var my = 0;
	var search = null;
	
	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {
		var params = nl.location.search();
		my = ('mine' in params) ? parseInt(params.mine) : 0;
		console.log(my);
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
				internalUrl: "resource_upload",
				children: [{
							help: "Upload a new resource by clicking on this link",
							title: "upload a new resource",
							internalUrl: "resource_upload",
							children: []
							}],
							style: 'nl-bg-blue'
				};
		ret.push(card);
		return ret;
	} 

    $scope.onCardInternalUrlClicked = function(card, internalUrl) {
    	var lessonId = card.lessonId;
    	if (internalUrl === 'resource_delete') _deleteLesson($scope, lessonId);
    	if (internalUrl === 'resource_upload') nl.window.location.href=nl.fmt2('/resource/resadd/');
    	if(internalUrl === 'resource_url') _showLinkCopyDlg($scope, card);
    };

	$scope.onCardLinkClicked = function(card, linkId){
		var resid = card.cardId;
		if(linkId == 'resource_modify'){
			_modifyResource($scope, resid);
		} else if(linkId == 'resource_delete'){
			_deleteResource($scope, resid);
		}
	};

	function _getDataFromServer(resolve, reject) {
		if(my == TYPES.MY) my = true;
		if(my == TYPES.ALL) my = false;
		var data = {mine: my, searchFilter: search};
		nlServerApi.resourceGetList(data).then(function(resultList) {
			$scope.cards.cardlist = _getLessonCards(_userInfo, resultList);
			_addSearchInfo($scope.cards);
			resolve(true);
		}, function(reason) {
			resolve(false);
		});
	}

	
	function _getLessonCards(userInfo, resultList) {
		var cards = [];
		for (var i = 0; i < resultList.length; i++) {
			var card = _createLessonCard(resultList[i], userInfo);
			cards.push(card);
		}
		return cards;
	}

	function _createLessonCard(resource, userInfo) {
		var url = null;
		console.log(resource);
		var image = null;
		var internalUrl = 'resource_url';
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
			cardId: resource.resid,
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
			avps : _getLessonListAvps(resource)
		};
		if (my == TYPES.ALL) card.links = [{id : 'details', text : nl.t('details')}];
		if (my == TYPES.MY) card.links = [{id : 'resource_modify', text : nl.t('modify')},
													{id : 'resource_delete', text : nl.t('delete')},
					  						  		{id : 'details', text : nl.t('details')}];
		card['help'] = nl.t('<span class="nl-card-description"><b>By: {}</b></span><br><span>Keywords: {}</span>', resource.authorname, resource.keywords);
		return card;
	}
	
	function _getLessonListAvps(resource){
		var avps = [];
		var data = JSON.parse(resource.info);
		console.log(data);
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
	
	function _populateLinks(linkAvp, lessonId, lesson) {
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

	function _uploadResource($scope){
		var uploadResourceDlg = nlDlg.create($scope);
		_initUploadResourceDlg();
		var uploadButton = {text : nl.t('Upload'), onTap : function(e) { 
			 if(e) e.preventDefault(e);
			}};
		var cancelButton = {text : nl.t('Cancel')};
		uploadResourceDlg.show('view_controllers/resource/resource_upload_dlg.html',
			[uploadButton], cancelButton, false);
		
		function _initUploadResourceDlg(){
			//TODO
		}
	}
	
	function _modifyResource($scope, resid){
		//TODO
	}

	function _showLinkCopyDlg($scope, card){
		nlDlg.popupAlert({title: nl.t('Copy url'), template: nl.t('<p><b>Please selct and copy below shown url and add in your lesson.</b><p><div>{}</div>', card.link)});
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
			if (card.cardId !== resid) continue;
			$scope.cards.cardlist.splice(i, 1);
		}
	}

}];
//-------------------------------------------------------------------------------------------------

module_init();
})();

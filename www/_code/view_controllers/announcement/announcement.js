(function() {

//-------------------------------------------------------------------------------------------------
// announcement.js:
// group announcements module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.announcement', [])
    .config(configFn)
    .service('nlAnnouncementSrv', AnnouncementSrv)
    .directive('nlAnnouncement', AnnouncementDirective)
    .controller('nl.AnnouncementCtrl', AnnouncementCtrl);
};

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.announcement', {
        url : '^/announcement',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/announcement/announcement.html',
                controller : 'nl.AnnouncementCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var AnnouncementDirective = ['nl', 'nlDlg', 'nlAnnouncementSrv',
function(nl, nlDlg, nlAnnouncementSrv) {
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'view_controllers/announcement/announcement_pane.html',
        scope: {
            pane: '=',
            data: '=',
        },
        link: function($scope, iElem, iAttrs) {
            $scope.onClickOnUpdate = function(announcement) {
                nlAnnouncementSrv.onClickOnUpdate(announcement);
            }
            $scope.onClickOnDelete = function(announcement) {
                nlAnnouncementSrv.onClickOnDelete(announcement);
            }
            $scope.clickOnCloseAnnouncement = function() {
                nlAnnouncementSrv.showAnnouncementPane(false);
            }
        }
    }
}];

//-------------------------------------------------------------------------------------------------
var AnnouncementCtrl = ['$scope', 'nlAnnouncementSrv',
function($scope, nlAnnouncementSrv) {
    $scope.pane = false;
    nlAnnouncementSrv.show($scope);
}];
//-------------------------------------------------------------------------------------------------
var _announcementList = [];
var AnnouncementSrv = ['nl', 'nlDlg', 'nlRouter', 'nlServerApi', 'nlResourceAddModifySrv',
function(nl, nlDlg, nlRouter, nlServerApi, nlResourceAddModifySrv) {    
    var _userInfo = null;
    var _canFetchMore = true;
    var $scope = null;



    
    nl.rootScope.hideAnnounement = true;


    this.show = function(scope) {
        $scope = scope;
        if($scope.pane) {
            return nl.q(function(resolve, reject) {
                nlRouter.getUserInfo('').then(function(userInfo) {
                resolve(_onPageEnter(userInfo));
            })
        })
        } else {
            nlRouter.initContoller($scope, '', _onPageEnter);
        }
    };

    this.getList = function() {
        if(_announcementList.length != 0) {
            return {announcementList: _announcementList};
        } else {
            return false;
        }
    };

    this.onClickOnDelete = function(announcement) {
        var data = {id: announcement.id};
        nlDlg.showLoadingScreen();
        nlServerApi.deleteAnnouncement(data).then(function(status) {
            nlDlg.hideLoadingScreen();
            if(status) {
                _updateAnnouncementList(announcement, false);
            }
        })
    }

    this.onClickOnUpdate = function(announcement) {
        _showCreateOrUpdateAnnouncementDlg(announcement);
    }

    function _onPageEnter(userInfo) {
        _userInfo = userInfo;
        return nl.q(function (resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Announcements');
            $scope.announcementData = {announcementList: []};
            if(!$scope.pane) {
                $scope.announcementData.toolbar = _getToolbar();
                $scope.announcementData.canshowToolbar = _userInfo.permissions['lesson_approve'] || false;    
            }
            _getDataFromServer(resolve, false);
        });
    }

    function _updateAnnouncementList(announcement, bmodify) {
        for(var i=0; i<$scope.announcementData.announcementList.length; i++) {
            if(announcement.id == $scope.data.announcementList[i].id) {
                $scope.announcementData.announcementList.splice(i, 1);
                _announcementList = angular.copy($scope.announcementData.announcementList);
                break;
            }
        }
        if(bmodify) {
            $scope.announcementData.announcementList.splice(0, 0, announcement);
            _announcementList = angular.copy($scope.announcementData.announcementList);
        }
    }

	function _getToolbar() {
		return [{
			title : 'Create a new announcement',
			icon : 'ion-android-add-circle',
			onClick : _createNewAnnouncement
        }]
    }
    
    function _createNewAnnouncement() {
        _showCreateOrUpdateAnnouncementDlg();
    }

    var _restypes = ["Image", "Video"]
    function _showCreateOrUpdateAnnouncementDlg(announcement) {
        var dlg = nlDlg.create($scope);
        var update = announcement ? true : false;
        dlg.setCssClass('nl-width-max nl-height-max');
        var dropdown = [{id:'img', name: 'Image'}, {id:'video', name: 'Video'}]
        dlg.scope.help = _getHelp();
        dlg.scope.options = {type: dropdown}
        dlg.scope.dlgtitle = update ? nl.t('Update  announcement') : nl.t('Create announcement');
        dlg.scope.data = {title: '', desc: '', resources: [{type: dropdown[0], url: '', restype: dropdown}]}
        if(update) {
            dlg.scope.data = {title: announcement.title, desc: announcement.desc, id: announcement.id, resources: []};
            for(var i=0; i<announcement.resources.length; i++) {
                var res = announcement.resources[i]
                var ret = {url: res.url, restype: dropdown}
                ret['type'] = (res.type == 'img') ? dropdown[0] : dropdown[1];
                dlg.scope.data.resources.push(ret)
            }
            if(dlg.scope.data.resources.length == 0) {
                dlg.scope.data.resources = [{type: dropdown[0], url: '', restype: dropdown}];
            }
        }

        dlg.scope.selectResource = function(index) {
			var selectedItem = dlg.scope.data.resources[index];
            var resurl = selectedItem['url'] || '';
            if(selectedItem.type.id == 'img')
                resurl = 'img:' + resurl;
            else
                resurl = 'video:' + resurl;

            nlResourceAddModifySrv.insertOrUpdateResource($scope, 
				_restypes, resurl, false, {}, false).then(function(result) {
				if(!result || !result.url) return;
                selectedItem['url'] = result.url;			
            });

        }

        var crOrUpBtn = {text: update ? 'Update' : 'Create', onTap: function(e){
            e.preventDefault();
            if(!_validateParams(dlg)) return;
            _createOrUpdateAnnouncement(dlg.scope.data, update);
        }};
        var cancelButton = {text: nl.t('Cancel')}
        dlg.show('view_controllers/announcement/create_or_update_announcement.html', [crOrUpBtn], cancelButton)
    }

    function _createOrUpdateAnnouncement(data, isUpdate) {
        var serverFn = isUpdate ? nlServerApi.updateAnnouncement : nlServerApi.createAnnouncement;
        var params = {title: data.title, desc: data.desc, resources: _getMinimalResourceArray(data)}
        if(isUpdate) params['id'] = data.id;
        nlDlg.showLoadingScreen();
        serverFn(params).then(function(record) {
            nlDlg.hideLoadingScreen();
            nlDlg.closeAll();
            if(isUpdate) 
                _updateAnnouncementList(record, true);
            else
                $scope.announcementData.announcementList.splice(0, 0, record);
        })
    }

    function _getMinimalResourceArray(data) {
        var ret = [];
        for(var i=0; i<data.resources.length; i++) {
            var res = data.resources[i];
            ret.push({type: res.type.id, url: res.url})
        }
        return ret;
    }

    function _getHelp() {
        return {
            title: {name: 'Title', help:nl.t('Is an header for announcement to help viewer to understand better baout this announcement')},
            desc: {name: 'Description', help: nl.t('Is an some description about this annoucement')},
            resource: {name: 'Resources', help: nl.t('Provide image url or video url')}
        }
    }

    function _validateParams(dlg) {
        var data = dlg.scope.data;
        if(!data.title) {
            nlDlg.popupAlert({title: 'Title mandatory', template: nl.t('Please enter the title for announcement. Since title is mandatory')})
            return false;
        } else if (!data.desc) {
            nlDlg.popupAlert({title: 'Description mandatory', template: nl.t('Please enter the description for announcement. Since description is mandatory')})
            return false
        } else if(!data.resources) {
            nlDlg.popupAlert({title: 'Resource mandatory', template: nl.t('Please enter the title for announcement. Since title is mandatory')})
            return false;
        }
        return true;
    }

	function _getDataFromServer(resolve, fetchMore) {
        var _pageFetcher = nlServerApi.getPageFetcher();
        _pageFetcher.fetchPage(nlServerApi.getAnnouncementList, {}, fetchMore, function(results) {
            if (!results) {
                if (resolve) resolve(false);
                return;
            }
            _createAnnouncement(results);
            _canFetchMore = _pageFetcher.canFetchMore()
            if (resolve) resolve(true);
		});
	}

	function _createAnnouncement(resultList) {
		for (var i = 0; i < resultList.length; i++) {
            var item = resultList[i];
            _announcementList.push(item);
        }
        $scope.announcementData.announcementList = _announcementList;
	}
}];
//-------------------------------------------------------------------------------------------------
module_init();
})();
        
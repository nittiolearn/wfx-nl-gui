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
        templateUrl: 'view_controllers/announcement/announcement_dir.html',
        scope: {
        },
        link: function($scope, iElem, iAttrs) {
            $scope.canShowButtons = function() {
                return nlAnnouncementSrv.isAdmin();
            };
            $scope.updateAnnouncement = function(announcement) {
                nlAnnouncementSrv.updateAnnouncement(announcement);
            };
            $scope.deleteAnnouncement = function(announcement) {
                nlAnnouncementSrv.deleteAnnouncement(announcement);
            };

            $scope.checkOverflow = function(textstr) {
                if(!textstr || nl.rootScope.announcement.mode != "pane") return false;
                return (textstr.length > 60)
            }

            $scope.clickOnShowMore = function(announcement) {
                announcement.showMore = !announcement.showMore;
            }

            $scope.showAnnouncementPopup = function(announcement) {
                nlAnnouncementSrv.showAnnouncementPopup(announcement)
            }
        }
    }
}];

//-------------------------------------------------------------------------------------------------
var AnnouncementCtrl = ['$scope', 'nl', 'nlAnnouncementSrv', 'nlRouter',
function($scope, nl, nlAnnouncementSrv, nlRouter) {
	function _onPageEnter(userInfo) {
        nl.pginfo.pageTitle = 'Announcements';
        return nlAnnouncementSrv.onPageEnter(userInfo, $scope, 'full');
	}
	nlRouter.initContoller($scope, '', _onPageEnter);
}];

//-------------------------------------------------------------------------------------------------
var AnnouncementSrv = ['nl', 'nlDlg', 'nlServerApi', 'nlResourceAddModifySrv', 'nlUserSettings', 'nlMarkup',
function(nl, nlDlg, nlServerApi, nlResourceAddModifySrv, nlUserSettings, nlMarkup) {
    var _data = {mode: 'none', isAdmin: false, toolBar:[], items:null, 
        canFetchMore: false, featureEnabled: false, pageAllowsPaneMode: false};
    var _scope = null;
    var _userInfo = null;
    var self = this;

    this.initAnnouncements = function(userInfo, scope) {
        _data.pageAllowsPaneMode = false;
        _initAnnouncements(userInfo, scope, 'none');
    };

    this.onPageEnter = function(userInfo, scope, mode) {
        if (mode == 'pane') _data.pageAllowsPaneMode = true;
        return nl.q(function(resolve, reject) {
            nlUserSettings.init(function() {
                _initAnnouncements(userInfo, scope, mode);
                if (!_data.userClosedPaneTime && _data.mode == 'none') return resolve(true);
                if (_data.items) return resolve(true);
                _data.items = [];
                _getDataFromServer(resolve, false);
            });
        });
    };

    this.isFeatureEnabled = function() {
        return _data.featureEnabled;
    };

    this.updateAnnouncement = function(announcement) {
        return _onUpdate(announcement);
    };

    this.deleteAnnouncement = function(announcement) {
        return _onDelete(announcement);
    };

    this.isAdmin = function() {
        return _data.mode == 'full' && _data.isAdmin;
    };

    this.canShowAnnouncement = function() {
        return _data.pageAllowsPaneMode && _data.featureEnabled;
    };

    this.onAnnoucementIconClick = function() {
        if (!this.canShowAnnouncement()) return;
        if (_data.mode == 'pane') _onClose();
        else _onOpen();
    };

    this.showAnnouncementPopup = function(announcement) {
        var popupDlg = nlDlg.create(_scope);
        popupDlg.setCssClass('nl-height-max nl-width-max');
        popupDlg.scope.dlgTitle = nl.t('{}', announcement.title);
        popupDlg.scope.announcement = announcement;
        
        var cancelButton = {text: nl.t('Close')};
        popupDlg.show('view_controllers/announcement/show_announcement_popup.html', [], cancelButton, false);
    }
    var _oldScreenState = null;
    function _resizeHandler() {
        if (!_data.pageAllowsPaneMode || !_data.featureEnabled) return;
        if (_oldScreenState == nl.rootScope.screenSize) return;
        if (_oldScreenState != 'small' && nl.rootScope.screenSize != 'small') return;
        self.onPageEnter(_userInfo, _scope, 'pane').then(function() {
        });    
    }

    nl.resizeHandler.onResize(function() {
        _resizeHandler();
    });
    
    function _setFeatureEnabled(forceDisable) {
        if(!forceDisable && _userInfo.groupinfo && ('features' in _userInfo.groupinfo) &&
            _userInfo.groupinfo.features['announcement']) {
            _data.featureEnabled = _userInfo.groupinfo.features['announcement'] == "admin_only" 
                ? _data.isAdmin : true;
        } else {
            _data.featureEnabled = false;
        }
        if(!_data.featureEnabled) _data.mode = 'none';
    }

    function _initAnnouncements(userInfo, scope, mode) {
        _scope = scope;
        _userInfo = userInfo;
        nl.rootScope.announcement = _data;
        _data.userClosedPaneTime = false;
        _data.mode = mode;  // none|pane|full
        _data.isAdmin = userInfo.permissions && userInfo.permissions.announcement_manage;
        _setFeatureEnabled();
        if (nl.rootScope.screenSize == 'small' && _data.mode == 'pane') _data.mode = 'none';
        _oldScreenState = nl.rootScope.screenSize;
        if (_data.mode == 'none') return;
        _initToolBar();
        var userClosedPane = nlUserSettings.get('announcement_pane_closed', false);
        if (!userClosedPane || _data.mode != 'pane') return;
        _data.mode = 'none';
        var past = new Date('2010-01-01T00:00:00');
        _data.userClosedPaneTime = nlUserSettings.get('announcement_pane_closed_time', past);
    }

    function _initToolBar() {
        _data.toolBar = [];
        if (_data.mode == 'full' && _data.isAdmin) {
            _data.toolBar.push({
                title : 'Create a new announcement',
                icon : 'ion-android-add-circle',
                onClick : _onCreate,
                canShow: function() {
                    return true;
                }
            });
        }
        if (_data.mode == 'full') {
            _data.toolBar.push({
                title : 'Fetch more items',
                icon : 'ion-refresh',
                onClick : _onFetchMore,
                canShow: function() {
                    return _data.canFetchMore;
                }
            });
        }
        if (_data.mode == 'pane') {
            _data.toolBar.push({
                title : 'Open announcement in new tab',
                icon : 'ion-android-open',
                onClick : _onNewTab,
                canShow: function() {
                    return true;
                }
            });
            _data.toolBar.push({
                title : 'Close',
                icon : 'ion-close-circled',
                onClick : _onClose,
                canShow: function() {
                    return true;
                }
            });
        }
    }

	function _onFetchMore() {
        nlDlg.showLoadingScreen();
        _getDataFromServer(function() {
            nlDlg.hideLoadingScreen();
        }, true);
    }

    var _pageFetcher = nlServerApi.getPageFetcher();
	function _getDataFromServer(resolve, fetchMore) {
        _pageFetcher.fetchPage(nlServerApi.getAnnouncementList, {}, fetchMore, function(results) {
            if (!results) {
                if (resolve) resolve(false);
                _setFeatureEnabled(true);
                return;
            }
            _data.canFetchMore = _pageFetcher.canFetchMore();
            for (var i = 0; i < results.length; i++) {
                results[i].updated_ts = nl.fmt.json2Date(results[i].updated);
                results[i].updated = nl.fmt.fmtDateDelta(results[i].updated, null, 'date');
                _data.items.push(results[i]);
            }

            if (_data.userClosedPaneTime && _data.items.length > 0) {
                var item = _data.items[0];
                if (item.updated_ts > _data.userClosedPaneTime) {
                    nlUserSettings.put('announcement_pane_closed', false);
                    _data.mode = 'pane';
                }
            }
            if (resolve) resolve(true);
		});
	}

    function _onCreate() {
        _onUpdate(null);
    }

    function _onDelete(announcement) {
		var msg = {title: 'Please confirm', 
				   template: 'Are you sure you want to delete this announcement?',
				   okText: nl.t('Delete')};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;
            var data = {id: announcement.id};
            nlDlg.showLoadingScreen();
            nlServerApi.deleteAnnouncement(data).then(function(status) {
                nlDlg.hideLoadingScreen();
                if(status) _removeAnnoucementItem(announcement.id);
            });
        });
    }
    var _restypes = ["Image", "Video"]
    function _onUpdate(announcement) {
        var dlg = nlDlg.create(_scope);
        var update = announcement ? true : false;
        dlg.setCssClass('nl-width-max nl-height-max');
        dlg.scope.help = _getHelp();
        dlg.scope.dlgtitle = update ? nl.t('Update  announcement') : nl.t('Create announcement');
        dlg.scope.data = {title: '', desc: '', resources: []}
        if(update) {
            dlg.scope.data = {title: announcement.title, desc: announcement.desc, id: announcement.id, resources: announcement.resources};
        }

        dlg.scope.addNewResource = function(type) {
            var resurl = null;
            if(type == 'img')
                resurl = 'img:';
            else
                resurl = 'video:';
            _showResourceAddModifyDlg(dlg, resurl, type);
        }

        dlg.scope.onRemoveResource = function(pos) {
            dlg.scope.data.resources.splice(pos, 1);            
        }

        dlg.scope.getResurl = function() {
            return nl.url.resUrl('dashboard/video1.png');
        };

        var crOrUpBtn = {text: update ? 'Update' : 'Create', onTap: function(e){
            e.preventDefault();
            if(!_validateParams(dlg)) return;
            _createOrUpdateAnnouncement(dlg.scope.data, update);
        }};
        var cancelButton = {text: nl.t('Cancel')}
        dlg.show('view_controllers/announcement/announcement_create_dlg.html', [crOrUpBtn], cancelButton)
    }

    function _showResourceAddModifyDlg(dlg, resurl, type) {
        nlResourceAddModifySrv.insertOrUpdateResource(dlg.scope, 
            _userInfo.groupinfo.restypes, resurl, false, null, false).then(function(result) {
            if(!result || !result.url) return;
            dlg.scope.data.resources.push({type: type, url: result.url});
        });
    }

    function _createOrUpdateAnnouncement(data, isUpdate) {
        var serverFn = isUpdate ? nlServerApi.updateAnnouncement : nlServerApi.createAnnouncement;
        var params = {title: data.title, desc: data.desc, resources:[]}
        for(var i=0; i<data.resources.length; i++) {
            var res = data.resources[i];
            if(res.type == "img") {
                params.resources.push(res);
            } else {
                if(res.markUpurl) {
                    params.resources.push(res);
                } else {
                    var markupStr = 'video:'+res.url;
                    var retData = {lessPara: true};
                    var markUpurl = nlMarkup.getHtml(markupStr, retData);
                    params.resources.push({type: res.type, url: res.url, markUpurl: markUpurl});    
                }
            }
        }
        if(isUpdate) params['id'] = data.id;
        nlDlg.showLoadingScreen();
        serverFn(params).then(function(record) {
            nlDlg.hideLoadingScreen();
            nlDlg.closeAll();
            if(isUpdate) _removeAnnoucementItem(record.id);
            _addAnnoucementItem(record);
        })
    }

    function _getHelp() {
        return {
            title: {name: 'Title', help:nl.t('Provide an proper title for the announcement to capture viewer attention.')},
            desc: {name: 'Description', help: nl.t('Provide the description about the annoucement')},
            resource: {name: 'Resources', help: nl.t('You can add image or video on clicking on the section provided. Click on image section to add image, click on video section to add video. Clicking on close provided will remove resource')}
        }
    }

    function _validateParams(dlg) {
        var data = dlg.scope.data;
        if(!data.title) {
            nlDlg.popupAlert({title: 'Title mandatory', template: nl.t('Please enter the title for announcement. Since title is mandatory')})
            return false;
        }
        return true;
    }

    function _addAnnoucementItem(announcement) {
        announcement['updated'] = nl.fmt.fmtDateDelta(announcement.updated, null, 'date')
        _data.items.splice(0, 0, announcement);
    }

    function _removeAnnoucementItem(announcementId) {
        for(var i=0; i<_data.items.length; i++) {
            if (announcementId != _data.items[i].id) continue;
            _data.items.splice(i, 1);
            break;
        }
    }

    function _onNewTab() {
        nl.window.open('/#/announcement','_blank');
    }

    function _onClose() {
        _data.mode = 'none';
        nlUserSettings.put('announcement_pane_closed', true);
        nlUserSettings.put('announcement_pane_closed_time', new Date());
    }

    function _onOpen() {
        nlUserSettings.put('announcement_pane_closed', false);
        if (nl.rootScope.screenSize == 'small') return _onNewTab();
        nlDlg.showLoadingScreen();
        self.onPageEnter(_userInfo, _scope, 'pane').then(function(result) {
            nlDlg.hideLoadingScreen();
        });
    }

}];
//-------------------------------------------------------------------------------------------------
module_init();
})();
        
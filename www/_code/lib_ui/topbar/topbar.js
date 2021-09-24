(function() {

//-------------------------------------------------------------------------------------------------
// topbar.js: 
// The top bar that appears on every page of the application.
// <nl-topbar> directive is used inside applayout. This presents the top bar based on data stored
// in rootScope.topbar. The content of rootScope.topbar is managed by nlTopbarSrv. nlTopbarSrv 
// provides methods to control the the tabs and menu items that appear in the top bar.
// - app.js adds the menu items common to all apages (addCommonMenu)
// - while each page controller may add futher menu items (addPageMenu)
// Page menu items are shown on top, then the app menu items.
// A manu item could have a url or onclick handler. The menu could also be positioned as tabs.
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.topbar', [])
    .directive('nlTopbar', TopbarDirective)
    .service('nlTopbarSrv', TopbarSrv);
}

//-------------------------------------------------------------------------------------------------
var TopbarDirective = ['nl', 'nlDlg', 'nlTopbarSrv',
function(nl, nlDlg, nlTopbarSrv) {
    return {
        restrict: 'E', 
        transclude: true,
        templateUrl: 'lib_ui/topbar/topbar.html',
        link: function($scope, iElem, iAttrs) {
            $scope.isTabSelected = function(tab) {
                return (tab.id == nlTopbarSrv.getSelectedTabId());
            };
            $scope.onTabOrMenuClick = function(item) {
                return nlTopbarSrv.onTabOrMenuClick(item);
            };
            $scope.canShow = function(item) {
                if (!('canShow' in item)) return true;
                if (typeof(item.canShow) === 'boolean') return item.canShow;
                return item.canShow();
            };
            $scope.onUserMenu = function(e) {
                nl.rootScope.topbar.showUserMenu = !nl.rootScope.topbar.showUserMenu;
                if (e) e.stopImmediatePropagation();
                return false;
            };
            $scope.canShowAnnouncement = function(e) {
                //Naveen TODO
                return false;
            };
            $scope.onAnnoucementIconClick = function(e) {
                //Naveen TODO
                return false;
            };
        }
    };
}];

//-------------------------------------------------------------------------------------------------
// Topbar controls the menu items and tabs that appear in the top bar.
// app.js adds the menus common to all apages (addCommonMenu) while each page on enter could
// add further menus items.

var TopbarSrv = ['nl', 'nlDlg',
function(nl, nlDlg) {

    var _commonMenus = [];
    var _pageMenus = [];
    var _isShown = true;
    var _selectedTabId = null;

    // Called from app.js
    this.setCommonMenus = function(menus) {
        _commonMenus = menus;
        _selectedTabId = null;
        _pageMenus = [];
    };

    // Called from page controllers who have page level menus
    // menu: {id: '', name: '', title: '' (optional), 
    // type: 'tab'/'menu'/'seperator' (optional, default is 'menu')}
    // iconCls: '' (optional), iconContent: '' (optional), 
    // onClick: fn, url: xxx (one of onClick or url is required)
    // canShow: optional (default: true; otherwise a boolean value or a function is to be provided)
    this.setPageMenus = function(menus, selectedTabId) {
        _pageMenus = menus;
        _selectedTabId = selectedTabId || null;
    };

    // Called fomr router.js (after page controller) and on resize to update menu items, tabs and icon layouts
    // Can also be called by pages to show/hide topbar
    this.showTopbar = function(isShown) {
        _isShown = isShown;
        _updateTopbarUI();
    };

    this.onTabOrMenuClick = function(item) {
        if (item.type == 'tab') _selectedTabId = item.id;
        return item.onClick(item);
    };

    this.getSelectedTabId = function() {
        return _selectedTabId;
    };

    nl.resizeHandler.onResize(function() {
        _updateTopbarUI();
    });

    var MAX_TAB_ITEMS = 4;
    function _updateTopbarUI() {
        var scopeData = {menus: [], tabs: [], isShown: _isShown, showUserMenu: false};
        for (var i=0; i<_pageMenus.length; i++) {
            var item = _pageMenus[i];
            if (item.type == 'tab' && scopeData.tabs.length < MAX_TAB_ITEMS) scopeData.tabs.push(item);
            else scopeData.menus.push(item);
        }
        if (scopeData.menus.length > 0) scopeData.menus.push({type: 'seperator'});
        for (var i=0; i<_commonMenus.length; i++) {
            var item = _commonMenus[i];
            scopeData.menus.push(item);
        }
        nl.rootScope.topbar = scopeData;
    }

    nl.resizeHandler.onEvent('ESC', function() {
        nl.rootScope.topbar.showUserMenu = false;
    });
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

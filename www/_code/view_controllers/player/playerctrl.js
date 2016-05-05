(function() {

//-------------------------------------------------------------------------------------------------
// playerctrl.js:
// lesson editor/viewer controller and overall service module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.playerctrl', [])
	.config(configFn)
	.controller('nl.PlayerCtrl', PlayerCtrl)
    .service('nlPlayer', PlayerSrv)
    .directive('nlPlayer', PlayerDirective);
}

//-------------------------------------------------------------------------------------------------
function Player(nl, nlRouter, nlDlg, nlServerApi, nlPlayerUtils, ctx) {
    
    this.ctx = ctx;
    
    this.load = function() {
        return ctx.load();
    };

    this.initConfig = function(playerCfg) {
        playerCfg.lesson = ctx.lesson;
        playerCfg.bgTemplate = nlPlayerUtils.getBgTemplate(ctx.lesson.template, ctx.bgtemplates);

        var pth = nlPlayerUtils.getPageTypeHandler(ctx.lesson, ctx.pagetypes);
        playerCfg.layout = pth.layout;

        var sth = nlPlayerUtils.getSectionTextHandler(ctx.lesson);
        playerCfg.secTexts = sth.secTexts;

        playerCfg.launchMode = ctx.getLaunchMode();
        playerCfg.lessonJson = angular.toJson(ctx.lesson, 2); // TODO-MUNNI-PLAYER - for debugging

        var fmt = (playerCfg.launchMode == 'do') ? '{}' : (playerCfg.launchMode == 'edit') ? 'Editor: {}' : 'Report: {}';
        nl.pginfo.pageTitle = nl.t(fmt, ctx.lesson.name);
        nl.pginfo.pageSubTitle = '';
        nlRouter.setWindowDescription(ctx.lesson.description);
    }
}
    
//-------------------------------------------------------------------------------------------------
var PlayerSrv = ['nl', 'nlRouter', 'nlDlg', 'nlServerApi', 'nlPlayerUtils', 'nlPlayerCtx',
function(nl, nlRouter, nlDlg, nlServerApi, nlPlayerUtils, nlPlayerCtx) {
    this.initFromUrl = function(userInfo) {
        var params = nl.location.search();
        var ctxName = params.ctx ? params.ctx.toLowerCase() : '';
        var dbid = params.id ? parseInt(params.id) : null;
        return this.init(userInfo, ctxName, dbid);
    };
    
    this.init = function(userInfo, ctxName, dbid) {
        var ctx = nlPlayerCtx.init(userInfo, ctxName, dbid);
        if (!ctx) {
            nlDlg.popupStatus('Incorrect URL: ctx or id param missing or not supported');
            return null;
        }
        return new Player(nl, nlRouter, nlDlg, nlServerApi, nlPlayerUtils, ctx);
   };
}];

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.player', {
        url : '^/player',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/player/playerctrl.html',
                controller : 'nl.PlayerCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var PlayerCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlPlayer',
function(nl, nlRouter, $scope, nlDlg, nlPlayer) {
    var _player = null;
    $scope.playerCfg = {};
    
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            _player = nlPlayer.initFromUrl(userInfo);
            if (!_player) {
                resolve(false);
                return;
            }
            _player.load().then(function res() {
                _player.initConfig($scope.playerCfg);
                resolve(true);
            }, function rej() {
                resolve(false);
            });
        });
    }
    
    nlRouter.initContoller($scope, '', _onPageEnter);
}];

//-------------------------------------------------------------------------------------------------
var PlayerDirective = ['nl', 'nlDlg', 'nlServerApi',
function(nl, nlDlg, nlServerApi) {
    
    function postLink($scope, iElem, iAttrs) {
    }
    
    return {
        restrict: 'E',
        //transclude: true,
        templateUrl: 'view_controllers/player/player.html',
        scope: {
            cfg: '='
        },
        link: postLink
    };
}];

module_init();
})();

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
    .directive('nlPlayer', PlayerDirective)
    .directive('nlBindElem', BindDomElemDirective)
}

//-------------------------------------------------------------------------------------------------
var _playerNextId = 0;

function Player(nl, nlRouter, nlDlg, nlServerApi, nlPlayerUtils, ctx) {

    this.playerId = _playerNextId;
    _playerNextId++;
    this.ctx = ctx;
    
    this.load = function() {
        return ctx.load();
    };

    this.initConfig = function(playerCfg) {
        this.ptHandler = nlPlayerUtils.getPageTypeHandler(ctx.pagetypes);

        _initDebugging(playerCfg, ctx.lesson); // TODO-MUNNI-PLAYER: remove later
        playerCfg.launchMode = ctx.getLaunchMode();
        playerCfg.htmlLesson = _getHtmlLesson(this);

        var fmt = (playerCfg.launchMode == 'do') ? '{}' : (playerCfg.launchMode == 'edit') ? 'Editor: {}' : 'Report: {}';
        nl.pginfo.pageTitle = nl.t(fmt, ctx.lesson.name);
        nl.pginfo.pageSubTitle = '';
        nlRouter.setWindowDescription(ctx.lesson.description);
        nl.timeout(function() {
            _postRender(playerCfg.htmlLesson, false);
        });
        nl.resizeHandler.onResize(function() {
            _postRender(playerCfg.htmlLesson, true);
        });
    };
    
    //---------------------------------------------------------------------------------------------
    function _initDebugging(playerCfg, lesson) {
        playerCfg.debugging = true;
        playerCfg.lessonJson = angular.toJson(lesson, 2);
    }

    function _getHtmlLesson(self) {
        var ret = {
            bgTemplate: nlPlayerUtils.getBgTemplate(self.ctx.lesson.template, self.ctx.bgtemplates),
            uid: '' + self.playerId,
            pages: []
        };
        for(var i=0; i<self.ctx.lesson.pages.length; i++) {
            ret.pages.push(_getHtmlPage(self, self.ctx.lesson.pages[i], i));
        }
        return ret;
    }

    function _getHtmlPage(self, page, pos) {
        var ret = {pageNumber: pos+1, 
                   uid: nl.fmt2('{}.{}', self.playerId, page.pageId), 
                   sections: []};
        var pt = self.ptHandler.getPageType(page);
        _alignLengths(page.sections, pt.layout);

        for(var i=0; i<page.sections.length; i++) {
            ret.sections.push(_getHtmlSection(self, page, page.sections[i], i, pt));
        }
        return ret;
    }
    
    function _alignLengths(sections, layout) {
        while (sections.length > layout.length) sections.pop();
        while (sections.length < layout.length) sections.push({text: ''});
    }

    function _getHtmlSection(self, page, section, pos, pt) {
        var ret = {uid: nl.fmt2('{}.{}.{}', self.playerId, page.pageId, pos), 
                   secHtml: ''};
        var l = pt.getSectionLayout(pos);
        ret.secStyle = {top: l.t + '%', left: l.l + '%', height: l.h + '%', width: l.w + '%'};
        ret.secHtml = nlPlayerUtils.getSectionHtml(section);

        // TODO-MUNNI-PLAYER: font resizing and v alignment pending
        ret.secViewStyle = {'text-align': pt.getHAlign(pos), 'font-size': '100%', 'margin-top': 0, 'height': '100%'};
        return ret;
    }

    function _postRender(htmlLesson, isResize) {
        for(var i=0; i<htmlLesson.pages.length; i++) {
            _postRenderPage(htmlLesson.pages[i], isResize);
        }
    }
    
    function _postRenderPage(page, isResize) {
        var domInfo = _playerDomElements.getDomInfo(page.uid);
        var iElem = domInfo.elem;
        if(!isResize) MathJax.Hub.Queue(["Typeset", MathJax.Hub, iElem[0]]);
        for(var i=0; i<page.sections.length; i++) {
            _postRenderSection(page.sections[i], isResize);
        }
    }

    function _postRenderSection(section, isResize) {
        var domInfo = _playerDomElements.getDomInfo(section.uid);
        var iElem = domInfo.elem;
        var fs = nlPlayerUtils.getFontSize(iElem);
        iElem.css({'font-size': '' + fs + '%'});
        console.log('resizing font done: ', domInfo.attrs.nlBindElem);
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
        var x={scope: $scope, elem: iElem, attrs: iAttrs, pages: []}
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


//-------------------------------------------------------------------------------------------------
function PlayerDomElements() {
    var _domInfos = {};

    this.getDomInfo = function(uid) {
        var ids = uid.split('.');
        var playerId = ids[0];
        var pageId = ids.length > 1 ? ids[1] : null;
        var sectionId = ids.length > 2 ? ids[2]: null;

        if (!(playerId in _domInfos)) return null;
        var playerInfo = _domInfos[playerId];
        if (pageId === null) return playerInfo;
        
        if (!(pageId in playerInfo.pages)) return null;
        var pageInfo = playerInfo.pages[pageId];
        if (sectionId === null) return pageInfo;
        
        return pageInfo.sections[sectionId] || null;
    };
    
    this.storeDomElement = function($scope, iElem, iAttrs) {
        var ids = iAttrs.nlBindElem.split('.');
        var playerId = ids[0];
        var pageId = ids.length > 1 ? ids[1] : null;
        var sectionId = ids.length > 2 ? ids[2]: null;
        
        if (!(playerId in _domInfos)) 
            _domInfos[playerId] = {pages: {}};
        var playerInfo = _domInfos[playerId];
        if (pageId === null)
            return _storeDomElementInInfo(playerInfo, $scope, iElem, iAttrs);

        if (!(pageId in playerInfo.pages))
            playerInfo.pages[pageId] = {sections: {}};
        var pageInfo = playerInfo.pages[pageId];
        if (sectionId === null)
            return _storeDomElementInInfo(pageInfo, $scope, iElem, iAttrs);
        
        if (!(sectionId in pageInfo.sections))
            pageInfo.sections[sectionId] = {};
        var secInfo = pageInfo.sections[sectionId];
        return _storeDomElementInInfo(secInfo, $scope, iElem, iAttrs);
    };
    
    this.removeDomElement = function($scope, iElem, iAttrs) {
        var ids = iAttrs.nlBindElem.split('.');
        var playerId = ids[0];
        var pageId = ids.length > 1 ? ids[1] : null;
        var sectionId = ids.length > 2 ? ids[2]: null;
        
        if (!(playerId in _domInfos)) return;
        if (pageId === null) {
            delete _domInfos[playerId];
            return true;
        }

        var playerInfo = _domInfos[playerId];
        if (!(pageId in playerInfo.pages)) return;
        if (sectionId === null) {
            delete playerInfo.pages[pageId];
            return true;
        }
        
        var pageInfo = playerInfo.pages[pageId];
        if (!(sectionId in pageInfo.sections)) return;
        delete pageInfo.sections[sectionId];
        return true;
    };
    
    function _storeDomElementInInfo(info, $scope, iElem, iAttrs) {
        info.scope = $scope;
        info.elem = iElem;
        info.attrs = iAttrs;
        return true;
    }
}
var _playerDomElements = new PlayerDomElements();

//-------------------------------------------------------------------------------------------------
var BindDomElemDirective = ['nl',
function(nl) {
    
    function postLink($scope, iElem, iAttrs) {
        _playerDomElements.storeDomElement($scope, iElem, iAttrs);
        $scope.$on("$destroy", function handleDestroy() {
            _playerDomElements.removeDomElement($scope, iElem, iAttrs);
        });
    }
    
    return {
        restrict: 'A',
        link: postLink
    };
}];

module_init();
})();

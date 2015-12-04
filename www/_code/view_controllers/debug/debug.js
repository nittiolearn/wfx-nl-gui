(function() {

//-------------------------------------------------------------------------------------------------
// debug.js:
// Temp module for experimentation
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.debug', [])
    .config(configFn)
    .controller('nl.DebugCtrl', DebugCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.debug', {
        url : '^/debug',
        views : {
            'appContent' : {
                templateUrl: 'lib_ui/cards/cardsview.html',
                controller : 'nl.DebugCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var DebugCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlLogViewer', 'nlServerApi', 'nlCardsSrv',
function(nl, nlRouter, $scope, nlDlg, nlLogViewer, nlServerApi, nlCardsSrv) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Debug utilities');
            nl.pginfo.pageSubTitle = nl.fmt2('({})', userInfo.displayname);
            $scope.cards = {};
            $scope.cards.staticlist = [];
            $scope.cards.emptycard = nlCardsSrv.getEmptyCard();
            $scope.cards.cardlist = _getCards();
            nl.log.debug('DebugCtrl:onPageEnter - done');
            resolve(true);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);

    function _getCards() {
        var cards = [];

        var card = {title: nl.t('Reload'), 
            icon: nl.url.resUrl('alerts.png'), 
            internalUrl: 'debug_reload',
            help: nl.t('Reload page'), 
            children: [], links: []};
        cards.push(card);

        card = {title: nl.t('Change server'), 
            icon: nl.url.resUrl('alerts.png'), 
            internalUrl: 'debug_change_server',
            help: nl.t('Change Server URL'), 
            children: [], links: []};
        cards.push(card);

        card = {title: nl.t('View logs'), 
            icon: nl.url.resUrl('alerts.png'), 
            internalUrl: 'debug_logviewer',
            help: nl.t('View logs, configure log levels'), 
            children: [], links: []};
        cards.push(card);

        card = {title: nl.t('Clear Cache'), 
            icon: nl.url.resUrl('alerts.png'), 
            internalUrl: 'debug_clearcache',
            help: nl.t('Clear local cache'), 
            children: [], links: []};
        cards.push(card);
        
        card = {title: nl.t('Execute Rest API'), 
            icon: nl.url.resUrl('alerts.png'), 
            internalUrl: 'debug_restapi',
            help: nl.t('Execute a REST API on the server'), 
            children: [], links: []};
        cards.push(card);

        return cards;
    }

    $scope.onCardInternalUrlClicked = function(card, internalUrl) {
        if (internalUrl === 'debug_logviewer') {
            nlLogViewer.show($scope);
        } else if (internalUrl === 'debug_clearcache') {
            nlServerApi.clearCache().then(function(res) {
                nlDlg.popupStatus('Local cache cleared');
            });
        } else if (internalUrl === 'debug_restapi') {
            var restApi = new RestApi(nl, nlDlg, nlServerApi);
            restApi.showDlg($scope);
        } else if (internalUrl === 'debug_reload') {
            nl.window.location.reload(true);
        } else if (internalUrl === 'debug_change_server') {
            nlDlg.popupPrompt({
                title: 'Server Url',
                template: 'Enter server url',
                inputType: 'text',
                inputPlaceholder: 'https://www.nittiolearn.com',
                okText: 'Change Server'
            }).then(function(res) {
                nl.log.debug('Url is ', res);
                if (!res) return;
                nl.window.location.href = res;
            });
        }
    };
}];

function _createDlgAndShow(nl, nlDlg, $scope, data, template, buttonName, onButtonFn) {
    var dlg = nlDlg.create($scope);
    dlg.setCssClass('nl-height-max nl-width-max');
    dlg.scope.data = data;
    dlg.scope.error = {};
    var dlgButton = {text: nl.t(buttonName), onTap: function(e) {
        if (e) e.preventDefault();
        onButtonFn(e, dlg.scope);
    }};
    dlg.show(template, [dlgButton]);
    return dlg;
}

function RestApi(nl, nlDlg, nlServerApi) {
    this.showDlg = function($scope) {
        var data = {url: '_serverapi/course_get_list.json', params: '{}'};
        var template = 'view_controllers/debug/restapi_dlg.html';
        var dlg = _createDlgAndShow(nl, nlDlg, $scope, data, template, 'Execute', function(e, scope) {
            _onExecute(e, scope);
        });
        dlg.scope.view = 'req';
        dlg.scope.result = {json: '', fmt: ''};
        dlg.scope.onUrlEnter = function(e) {
            if (e.which !== 13) return;
            _onExecute(e, dlg.scope);
        };
        dlg.scope.onSave = function() {
            _saveAsCsv(dlg.scope);
        };
    };
    
    function _saveAsCsv(scope) {
        var csv = _writeCsvLine(scope.result.fmt.header, false);
        var rows = scope.result.fmt.rows;
        for (var i=0; i<rows.length; i++) {
            csv += _writeCsvLine(rows[i], true);
        }
        csv = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        window.open(csv);
    }

    function _writeCsvLine(row, bNewLine) {
        var ret = bNewLine ? '\n' : '';
        for (var i=0; i<row.length; i++) {
            if (i>0) ret += ',';
            ret += _csvEscape(row[i]);
        }
        return ret;
    }

    function _csvEscape(elem) {
        return '"' + elem + '"';
    }

    function _onExecute(e, scope) {
        var params = _validateInputs(scope);
        if (!params) return;
        nlDlg.showLoadingScreen();
        nlServerApi.executeRestApi(scope.data.url, params).then(function(result) {
            nlDlg.hideLoadingScreen();
            scope.view = 'fmt_res';
            scope.result.json = angular.toJson(result, 2);
            scope.result.fmt = _formatResult(result);
            if (scope.result.fmt === null) {
                scope.view = 'json_res';
                scope.result.fmt = {error: _formatError};
            }
        });
    }
    
    function _validateInputs(scope) {
        scope.error = {};
        if(!scope.data.url) return nlDlg.setFieldError(scope, 'url', nl.t('url expected: e.g. _serverapi/ping.json'));
        if(!scope.data.params) return nlDlg.setFieldError(scope, 'params', nl.t('params expected: e.g. {}', '{}'));

        try {
            return angular.fromJson(scope.data.params);
        } catch (error) {
            return nlDlg.setFieldError(scope, 'params',
                nl.t('Error parsing params JSON: {}. Try http://www.jsoneditoronline.org to debug more', error.toString()));
        }
    }

    var _formatError = nl.t('Sorry, only array of objects can be formatted.');
    function _formatResult(result) {
        if (!angular.isArray(result)) return null;
        if (result.length > 0 && angular.isArray(result[0]))
            return _formatTable(result);
        return _formatArray(result);
    }

    function _formatTable(items) {
        var headers = items.splice(0, 1);
        var header = (headers.length == 1) ? headers[0] : []; 
        return {header: header, rows: items};
    }
    
    function _formatArray(items) {
        var headers = _getColumnHeaders(items);
        if (headers === null) return null;
        
        var rows = [];
        for (var i=0; i<items.length; i++) {
            var cols = _objToArray(items[i], headers);
            rows.push(cols);
        }
        return {header: headers, rows: rows};
    }

    function _getColumnHeaders(items) {
        var headers = [];
        var headerDict = {};
        for (var i=0; i<items.length; i++) {
            var item = items[i];
            if (!angular.isObject(item) || angular.isArray(item)) return null;
            for (var k in item) {
                if (k in headerDict) continue;
                headerDict[k] = true;
                headers.push(k);
            }
        }
        return headers;
    }

    function _objToArray(item, headers) {
        var cols = [];
        for(var i=0; i<headers.length; i++) {
            var k = headers[i];
            var v = (k in item) ? item[k] : '';
            cols.push(v);
        }
        return cols;
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

(function() {

//-------------------------------------------------------------------------------------------------
// debug.js:
// Debugging utilities
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.debug', ['nl.debugtemp', 'nl.nittio_mobile_sim'])
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
var DebugCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlLogViewer', 'nlServerApi', 'nlCardsSrv', 'nlExporter',
function(nl, nlRouter, $scope, nlDlg, nlLogViewer, nlServerApi, nlCardsSrv, nlExporter) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Debug utilities');
            nl.pginfo.pageSubTitle = nl.fmt2('({})', userInfo.displayname);
            $scope.cards = {cardlist: _getCards()};
            nlCardsSrv.initCards($scope.cards);
            nl.log.debug('DebugCtrl:onPageEnter - done');
            resolve(true);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);

    function _getCards() {
        var cards = [];

        var card = {title: nl.t('Reload'),
            icon2: 'ion-ios-refresh fblue', 
            internalUrl: 'debug_reload',
            help: nl.t('Reload page'), 
            children: [], links: []};
        cards.push(card);

        card = {title: nl.t('Change server'), 
            icon2: 'ion-shuffle fblue', 
            internalUrl: 'debug_change_server',
            help: nl.t('Change Server URL'), 
            children: [], links: []};
        cards.push(card);

        card = {title: nl.t('View logs'), 
            icon2: 'ion-document-text fblue', 
            internalUrl: 'debug_logviewer',
            help: nl.t('View logs, configure log levels'), 
            children: [], links: []};
        cards.push(card);

        card = {title: nl.t('Clear Cache'), 
            icon2: 'ion-ipad fblue', 
            internalUrl: 'debug_clearcache',
            help: nl.t('Clear local cache'), 
            children: [], links: []};
        cards.push(card);
        
        card = {title: nl.t('Execute Rest API'), 
            icon2: 'ion-arrow-swap fblue', 
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
            var restApi = new RestApi(nl, nlDlg, nlServerApi, nlExporter);
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

function _createDlgAndShow(nl, nlDlg, $scope, data, options, template, buttonName, onButtonFn) {
    var dlg = nlDlg.create($scope);
    dlg.setCssClass('nl-height-max nl-width-max');
    dlg.scope.data = data;
    dlg.scope.options = options;
    dlg.scope.data.paused = false;
    dlg.scope.error = {};
    var dlgButton = {text: nl.t(buttonName), onTap: function(e) {
        if (e) e.preventDefault();
        onButtonFn(e, dlg.scope);
    }};
    dlg.show(template, [dlgButton]);
    return dlg;
}

function RestApi(nl, nlDlg, nlServerApi, nlExporter) {
    this.showDlg = function($scope) {
        var data = {url: '_serverapi/course_get_list.json', params: '{}', loop: false, serverType: {id: 'default'}};
        var options = {serverType: [{id: 'default', name: 'Default'}, {id: 'api3', name: 'API 3'}]};
        var template = 'view_controllers/debug/restapi_dlg.html';
        var dlg = _createDlgAndShow(nl, nlDlg, $scope, data, options, template, 'Execute', function(e, scope) {
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
    	if (!scope.result.fmt || !scope.result.fmt.rows || scope.result.fmt.rows.length == 0) {
    		nlDlg.popupStatus('Nothing to export');
    		return;
    	}
    	
        nlDlg.showLoadingScreen();
        nl.timeout(function() {
            var csv = _writeCsvLine(nlExporter, scope.result.fmt.header, false);
            var rows = scope.result.fmt.rows;
            for (var i=0; i<rows.length; i++) {
                csv += _writeCsvLine(nlExporter, rows[i], true);
            }
            nlExporter.exportCsvFile('download.csv', csv);
            nl.timeout(function() {
                nlDlg.hideLoadingScreen();
            }, 2000);
        });
    }

    function _writeCsvLine(nlExporter, row, bNewLine) {
        var ret = bNewLine ? '\n' : '';
        for (var i=0; i<row.length; i++) {
            if (i>0) ret += ',';
            ret += nlExporter.quoteCsvString(row[i]);
        }
        return ret;
    }

	function _saveAsCsvIfNeeded(scope) {
		return nl.q(function(resolve, reject) {
			var rows = scope.result.fmt.rows;
			if (!rows || rows.length < 20000) {
	            resolve(true);
	            return;
	        }
        	_saveAsCsv(scope);
        	nl.timeout(function() {
	            scope.result.fmt = _formatError();
        		resolve(true);
        	});
		});
	}

    function _onExecute(e, scope) {
        var params = _validateInputs(scope);
        if (!params) return;

        if (scope.data.loop) {
            scope.result.json = '';
            scope.result.fmt = _formatError();
            _onExecuteLoop(e, scope, params, 0);
            return;
        }
        nlDlg.showLoadingScreen();
        _executeRestApi(scope, params).then(function(result) {
            nlDlg.hideLoadingScreen();
            scope.view = 'fmt_res';
            scope.result.json = angular.toJson(result, 2);
            scope.result.fmt = _formatResult(result);
            if (scope.result.fmt.error) {
                scope.view = 'json_res';
            }
        });
    }

    function _executeRestApi(scope, params) {
        var reloadUserInfo = false;
        var noPopup = false;
        var serverType = scope.data.serverType.id;
        return nlServerApi.executeRestApi(scope.data.url, params, reloadUserInfo, noPopup, serverType);
    }

    function _statusMsg(scope, msg, param) {
        var d = new Date();
        scope.result.json += nl.fmt2('{}: {}{}\n', nl.fmt.date2Str(d, 'milli'), msg, param);
    }

    function _onExecuteLoop(e, scope, params, chunk) {
        if (scope.data.paused) {
            nl.timeout(function() {
                _onExecuteLoop(e, scope, params, chunk);
            }, 2000);
            return;
        }
        chunk++;
        _statusMsg(scope, 'Executing chunk: ', chunk);
        _executeRestApi(scope, params).then(function(result) {
        	_saveAsCsvIfNeeded(scope).then(function() {
	            scope.result.fmt = _formatResult(result.resultset, scope.result.fmt.header, scope.result.fmt.rows);
	            _statusMsg(scope, angular.toJson(result, 2), '\n');
	            if (!result.more) {
	                _statusMsg(scope, 'All actions completed: ', chunk);
	                return;
	            }
	            params.startpos = result.nextstartpos;
	            nl.timeout(function() {
	                _onExecuteLoop(e, scope, params, chunk);
	            }, 100);
        	});
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

    function _formatError() {
    	return {error: 'Sorry, only array of objects can be formatted.'};
    }
    	
    function _formatResult(result, oldHeaders, oldRows) {
        if (!angular.isArray(result)) {
            if (!angular.isObject(result)) return _formatError();
            result = result.resultset;
            if (!result || !angular.isArray(result)) return _formatError();
        }
        if (result.length > 0 && angular.isArray(result[0]))
            return _formatTable(result);
        return _formatArray(result, oldHeaders, oldRows);
    }

    function _formatTable(items) {
        var headers = items.splice(0, 1);
        var header = (headers.length == 1) ? headers[0] : []; 
        return {header: header, rows: items};
    }
    
    function _formatArray(items, oldHeaders, oldRows) {
        var headers = _getColumnHeaders(items, oldHeaders);
        if (headers === null) return _formatError();
        
        var rows = oldRows || [];
        for (var i=0; i<items.length; i++) {
            var cols = _objToArray(items[i], headers);
            rows.push(cols);
        }
        return {header: headers, rows: rows};
    }

    function _getColumnHeaders(items, oldHeaders) {
        var headers = oldHeaders || [];
        var headerDict = {};
        for (var i=0; i<headers.length; i++) headerDict[headers[i]] = true;

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

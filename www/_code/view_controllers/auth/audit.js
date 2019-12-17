(function() {

//-------------------------------------------------------------------------------------------------
// audit.js: Controllers for audit view
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.auth.audit', [])
    .config(configFn)
    .controller('nl.auth.AuditCtrl', AuditCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider',
function($stateProvider) {
    $stateProvider.state('app.audit', {
        url : '^/audit',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/auth/audit.html',
                controller : 'nl.auth.AuditCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
// Same object is defined in server side. Please update in both places.
var AUDIT_TYPES = {1: 'LOGIN', 2: 'LOGIN_FAILED', 3: 'LOGOUT', 4: 'IMPERSONATE', 5: 'IMPERSONATE_FAILED',
    6: 'IMPERSONATE_END', 7: 'LOGIN_USER_DISABLED', 8: 'LOGIN_GROUP_DISABLED', 9: 'LOGIN_IP_RESTRICTED',
    10: 'LOGIN_TERM_RESTRICTED', 11: 'LOGIN_PW_EXPIRED'};

var AuditCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlExporter',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlExporter) {
    var urlParams = {};
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            $scope.grpAdmin = userInfo.permissions.nittio_support || false;
            $scope.toolbar = _getToolbar();
            $scope.search = {
                placeholder: 'Start typing to search',
                filter: '',
            };
            $scope.showInFilterDlg = {username: true, clientip: true, type: true};
            $scope.tableColumnHeaders = [];
            $scope.tableColumnHeaders.push({id: 'username', name: 'User Name'});
            $scope.tableColumnHeaders.push({id: 'updated', name: 'Event Time'});
            $scope.tableColumnHeaders.push({id: 'clientip', name: 'Client IP'});
            if ($scope.grpAdmin) $scope.tableColumnHeaders.push({id: 'sessionid', name: 'Session Id'});
            $scope.tableColumnHeaders.push({id: 'type', name: 'Type'});
            $scope.tableColumnHeaders.push({id: 'description', name: 'Description'});

            var params = nl.location.search();
            if (params.username) {
                urlParams.username = params.username;
                $scope.showInFilterDlg.username = false;
            }
            if (params.clientip) {
                urlParams.clientip = params.clientip;
                $scope.showInFilterDlg.clientip = false;
            }
            if (params.type) {
                urlParams.type = params.type;
                $scope.showInFilterDlg.type = false;
            }
            if (params.sessionid) urlParams.sessionid = params.sessionid;
            nl.log.debug('AuditCtrl:onPageEnter - enter');
            nl.pginfo.pageTitle = nl.t('Audit records');
            _getAuditData(false, resolve);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
    
    var _pageFetcher = nlServerApi.getPageFetcher();
    var _records = [];
    function _getAuditData(fetchMore, resolve) {
        if (!fetchMore) _records = [];
        _pageFetcher.fetchPage(nlServerApi.authGetAuditData, urlParams, fetchMore, function(data) {
            $scope.canFetchMore = _pageFetcher.canFetchMore();
            if (!data) {
                if (resolve) resolve(false);
                return;
            }
            for (var i=0; i<data.length; i++) {
                if (!$scope.grpAdmin && _isImpersonateRecord(data[i])) continue;
                data[i].updated = nl.fmt.jsonDate2Str(data[i].updated, 'millisecond');
                if (data[i].type in AUDIT_TYPES) data[i].type = AUDIT_TYPES[data[i].type];
                _records.push(data[i]);
            }
            _updateDisplayRecords();
            if (resolve) resolve(true);
        });
    }

    function _isImpersonateRecord(record) {
        // 4: 'IMPERSONATE', 5: 'IMPERSONATE_FAILED', 6: 'IMPERSONATE_END'
        if (record.type == 4 || record.type == 5 || record.type == 6) return true;
        // Old logout records also had impersonator related information.
        if (record.description.toLowerCase().indexOf('impersonator') > 0) return true;
        return false;
    }

    function _updateDisplayRecords() {
        $scope.displayRecords = [];
        var searchStr = $scope.search.filter ? $scope.search.filter.toLowerCase() : '';
        for(var i=0; i<_records.length; i++) {
            if (!_isSearchMatching(_records[i], searchStr)) continue;
            $scope.displayRecords.push(_records[i]);
        }
        $scope.displayRecords = $scope.displayRecords.sort(function(a, b) {
            // Reverse sorting
            return (a.updated < b.updated ? 1 : -1);
        });
    }

    function _isSearchMatching(record, searchStr) {
        if (!searchStr) return true;
        if (_searchInFields(record, searchStr, ['username', 'updated', 'clientip', 'sessionid', 'type', 'description'])) return true;
        return false;
    }

    function _searchInFields(record, searchStr, fields) {
        for (var i=0; i<fields.length; i++) {
            if (fields[i] in record && record[fields[i]].toLowerCase().indexOf(searchStr) >= 0) return true;
        }
        return false;
    }

    $scope.searchKeyHandler = function(event) {
		nl.timeout(function() {
            _updateDisplayRecords();
            if (event.which === 13 && $scope.canFetchMore) _fetchMore();
        });
    };

    function _fetchMore() {
        _getAuditData(true);
    }

    var _isFilterSet = false;
    function _showFilter() {
        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-height-max nl-width-max');
        dlg.scope.options = {
            type: []
        };
        dlg.scope.options.type.push({id: '0', name: 'All events'});
        dlg.scope.options.type.push({id: '1', name: 'Only LOGIN success events'});
        dlg.scope.options.type.push({id: '2', name: 'Only LOGIN_FAILED (password error) events'});
        dlg.scope.options.type.push({id: '3', name: 'Only LOGOUT events'});
        if ($scope.grpAdmin) {
            dlg.scope.options.type.push({id: '4', name: 'IMPERSONATE'});
            dlg.scope.options.type.push({id: '5', name: 'IMPERSONATE_FAILED'});
            dlg.scope.options.type.push({id: '6', name: 'IMPERSONATE_END'});
            dlg.scope.options.type.push({id: '8', name: 'LOGIN_GROUP_DISABLED'});
        }
        dlg.scope.options.type.push({id: '7', name: 'LOGIN_USER_DISABLED'});
        dlg.scope.options.type.push({id: '9', name: 'LOGIN_IP_RESTRICTED'});
        dlg.scope.options.type.push({id: '10', name: 'LOGIN_TERM_RESTRICTED'});
        dlg.scope.options.type.push({id: '11', name: 'LOGIN_PW_EXPIRED'});

        dlg.scope.show = $scope.showInFilterDlg;
        dlg.scope.help = {
            updatedTill: {name: 'Events Till', help: 'Fetch event that happened before this time stamp. If not provided, latest events are fetched.'},
            type: {name: 'Event Type', help: 'Filter based on event type'},
            username: {name: 'Username', help: 'Filter based on login user name (exact match)'},
            clientip: {name: 'IP Address', help: 'Filter based on IP address from which the access was made (exact match)'}
        };
        
        dlg.scope.data = {updatedTill: urlParams.updatedTill || null,
            type: {id: '' + (urlParams.type || 0)}, 
            username: urlParams.username || '', clientip: urlParams.clientip || ''};
        dlg.scope.error = {};
        var button = {text: nl.t('Fetch'), onTap: function(e){
            var sd = dlg.scope.data;
            _isFilterSet = false;

            urlParams.updatedTill = sd.updatedTill;
            if (!urlParams.updatedTill) delete urlParams.updatedTill;
            else _isFilterSet = true;

            urlParams.type = parseInt(sd.type.id);
            if (!urlParams.type) delete urlParams.type;
            else _isFilterSet = true;
            
            urlParams.username = sd.username;
            if (!urlParams.username) delete urlParams.username;
            else _isFilterSet = true;

            urlParams.clientip = sd.clientip;
            if (!urlParams.clientip) delete urlParams.clientip;
            else _isFilterSet = true;

            _getAuditData(false);
        }};
        var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
            return false;
        }};
        return dlg.show('view_controllers/auth/audit_filter.html', [button], cancelButton, false);
    }

    function _onExport() {
        nlDlg.popupStatus('Exporting ...', false);
        nlDlg.showLoadingScreen();
        nl.timeout(function() {
            var strData = nlExporter.objToCsv(_records, $scope.tableColumnHeaders);
            nlExporter.exportCsvFile('auditlog.csv', strData, true);
            nl.timeout(function() {
                nlDlg.popdownStatus(0);
                nlDlg.hideLoadingScreen();
            }, 1000);
        });
    }

	function _getToolbar() {
		return [{
			title : 'Fetch more records',
			icon : 'ion-refresh',
			id: 'tbfetchmore',
			onClick : _fetchMore
		}, {
			title : 'Filter and fetch records',
            icon : 'ion-funnel',
			id: 'tbfilter',
			onClick : _showFilter
		}, {
			title : 'Download report',
			icon : 'ion-ios-cloud-download',
			id: 'export',
			onClick : _onExport
		}];
	}    

    $scope.canShowToolBar = function(tb) {
        if (_pageFetcher.fetchInProgress()) return false;
        if (tb.id == 'tbfetchmore') return $scope.canFetchMore;
        return true;
    };

    $scope.getToolbarCls = function(tb) {
        if (tb.id == 'tbfilter' && _isFilterSet) return 'forange';
        return '';
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
}());

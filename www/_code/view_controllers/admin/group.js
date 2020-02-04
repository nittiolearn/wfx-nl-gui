(function() {

//-------------------------------------------------------------------------------------------------
// group.js:
// group administration module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.group', [])
	.config(configFn)
	.controller('nl.AdminGroupCtrl', AdminGroupCtrl);
}

var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.admin_group', {
		url: '^/admin_group',
		views: {
			'appContent': {
                templateUrl : 'lib_ui/cards/cardsview.html',
				controller: 'nl.AdminGroupCtrl'
			}
		}});
}];

var AdminGroupCtrl = ['nl', 'nlRouter', 'nlDlg', '$scope', 'nlServerApi', 'nlExporter', 'nlCardsSrv',
function(nl, nlRouter, nlDlg, $scope, nlServerApi, nlExporter, nlCardsSrv) {
    var _records = [];
    var _fetchDone = false;

    var _pageFetcher = nlServerApi.getPageFetcher();
	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Group bulk export');
            $scope.cards = {
                toolbar : _getToolbar(),
                search: {placeholder : nl.t('Enter group id/name/description')}
            };
            nlCardsSrv.initCards($scope.cards);
            _pageFetcher.fetchBatchOfPages(nlServerApi.groupGetList, {}, false, function(results, batchDone) {
                if (!results) {
                    resolve(false);
                    return;
                }
                resolve(true);
                for (var i=0; i<results.length; i++) _records.push(results[i]);
                _updateCards();
                _fetchDone = batchDone;
            }, null);
		});
	}

	nlRouter.initContoller($scope, '', _onPageEnter);
	
    function _getToolbar() {
        return [{
            title: 'Create group',
            icon: 'ion-ios-plus',
            onClick: _onCreate
        }, {
            title: 'Export group data',
            icon: 'ion-ios-cloud-download',
            onClick: _onExport
        }, {
            title: 'Import group data',
            icon: 'ion-ios-cloud-upload',
            onClick: _onImport
        }];
    }

    function _updateCards() {
        var cardlist = [];
        for (var i = 0; i < _records.length; i++) {
            var card = _createCard(_records[i]);
            cardlist.push(card);
        }
        nlCardsSrv.updateCards($scope.cards, {cardlist: cardlist});
    }

    function _createCard(item) {
        var card = {
            title: item.name,
            help: _getDesc(item),
            content: angular.toJson(item),
            icon: item.iconurl,
            children: [],
            links: []
        };
        card.details = {help: card.help, avps: _getAvps(item)};
        card.links.push({id: 'details', text: nl.t('details')});
        return card;
    }
    
    function _getDesc(item) {
        var ret = nl.fmt2('<div class="padding-small">group id: {}</div>', item.grpid);
        if (item.disabled)
            ret += '<div class="padding-small">status: <i class="forange fsh3 icon ion-close-circled"></i></div>';
        else
            ret += '<div class="padding-small">status: <i class="fgreen fsh3 icon ion-checkmark-circled"></i></div>';
        return ret;
    }

    function _getAvps(item) {
        var avps = [];

        var linkAvp = nl.fmt.addLinksAvp(avps, 'Operation(s)');
        nl.fmt.addLinkToAvp(linkAvp, 'modify', nl.fmt2('/admin_group/group_mod//{}', item.id));
        nl.fmt.addLinkToAvp(linkAvp, 'users', nl.fmt2('/#/admin_user?grpid={}', item.grpid));
        nl.fmt.addAvp(avps, 'Description', item.description);
        nl.fmt.addAvp(avps, 'Primary Admin Email', item.padminemail);
        nl.fmt.addAvp(avps, 'Org Tree', item.org_tree);
        nl.fmt.addAvp(avps, 'Properties', item.props);
        nl.fmt.addAvp(avps, 'Created', item.created, 'date');
        nl.fmt.addAvp(avps, 'Updated', item.updated, 'date');
        nl.fmt.addAvp(avps, 'Internal identifier', item.id);
        return avps;
    }
    
    function _onExport() {
	    if (!_fetchDone) {
	        nlDlg.popupAlert({title: 'Please wait', template: 'Data is still being fetched from server. You will be able to export the data to a file once all the data is fetched from server'});
	        return;
	    }
        var promise = nl.q(function(resolve, reject) {
            nlDlg.showLoadingScreen();
            _export(resolve, reject);
        });
        promise.then(function() {
            nl.timeout(function() {
                nlDlg.hideLoadingScreen();
            }, 2000);
        });
    }
    
    var _headers = ['Operation', 'Key', 'Group Id', 'Group Name', 
        'Primary Admin Email', 'Status', 'Deleted',
        'Description', 'Icon', 'Org Tree', 
        'Properties', 'Created UTC Time', 'Updated UTC Time'];

    var DELIM = '\n';
    function _export(resolve, reject) {
        try {
            var csv = nlExporter.getCsvString(_headers);
            for(var i=0; i<_records.length; i++) {
                var record = _records[i];
                var row = ['i', record.grpid, record.grpid, record.name,
                    record.padminemail || '', record.disabled ? 0 : 1, record.deleted || '',
                    record.description || '', record.icon || '', record.org_tree || '',
                    record.props || '', record.created || '', record.updated || ''];
                csv += DELIM + nlExporter.getCsvString(row);
            }
            nlExporter.exportCsvFile('NittioGroupData.csv', csv);
            resolve(true);
        } catch(e) {
            console.error('Error while exporting', e);
            nlDlg.popupAlert({title: 'Error while exporting', template: e});
            reject(e);
        }
    }

    function _onImport() {
        nl.window.open('/admin_group/group_bulkupdate?import');
    }

    function _onCreate() {
        nl.window.open('/admin_group/group_create');
    }

}];

module_init();
})();

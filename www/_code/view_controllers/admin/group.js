(function() {

//-------------------------------------------------------------------------------------------------
// user.js:
// user administration module
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

var AdminGroupCtrl = ['nl', 'nlRouter', 'nlDlg', '$scope', 'nlServerApi', 'nlExporter',
function(nl, nlRouter, nlDlg, $scope, nlServerApi, nlExporter) {
    var _records = [];
    var _fetchDone = false;

	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Group bulk export');
            $scope.cards = {toolbar : _getToolbar()};
            _addSearchInfo($scope.cards);
            
            nlServerApi.batchFetch(nlServerApi.groupGetList, {}, function(result) {
                if (result.isError) {
                    resolve(false);
                    return;
                }
                resolve(true);
                var records = result.resultset;
                for (var i=0; i<records.length; i++) _records.push(records[i]);
                _updateCards();
                _fetchDone = result.fetchDone;
            }, null);
		});
	}

	nlRouter.initContoller($scope, '', _onPageEnter);
	
    function _getToolbar() {
        return [{
            title : 'Export group data',
            icon : 'ion-ios-cloud-download',
            onClick : _onExport
        }];
    }

    function _addSearchInfo(cards) {
        cards.search = {
            placeholder : nl.t('Enter group id/name/description')
        };
    }

    function _updateCards() {
        $scope.cards.cardlist = [];
        for (var i = 0; i < _records.length; i++) {
            var card = _createCard(_records[i]);
            $scope.cards.cardlist.push(card);
        }
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
        nl.fmt.addAvp(avps, 'Description', item.description);
        nl.fmt.addAvp(avps, 'Primary Admin Email', item.padminemail);
        nl.fmt.addAvp(avps, 'Parent Group', item.parentGrp);
        nl.fmt.addAvp(avps, 'Org Tree', item.org_tree);
        nl.fmt.addAvp(avps, 'Properties', item.props);
        nl.fmt.addAvp(avps, 'Created', item.created, 'date');
        nl.fmt.addAvp(avps, 'Updated', item.updated, 'date');
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
        'Primary Admin Email', 'Parent Group', 'Status', 
        'Description', 'Icon', 'Org Tree', 
        'Properties', 'Created UTC Time', 'Updated UTC Time']

    var DELIM = '\n';
    function _export(resolve, reject) {
        try {
            var csv = nlExporter.getCsvString(_headers);
            for(var i=0; i<_records.length; i++) {
                var record = _records[i];
                var row = ['i', record.grpid, record.grpid, record.name,
                    record.padminemail || '', record.parentGrp || '', record.disabled ? 0 : 1, 
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
}];

module_init();
})();

(function() {

//-------------------------------------------------------------------------------------------------
// user.js:
// user administration module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.user', [])
	.config(configFn)
	.controller('nl.AdminUserCtrl', AdminUserCtrl)
    .directive('adminUserCsvFormat', AdminUserCsvFormatDir);
}

//-------------------------------------------------------------------------------------------------
var AdminUserCsvFormatDir = [function() {
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/admin/user_csv_format.html',
        scope: true
    };
}];


var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.admin_user', {
		url: '^/admin_user',
		views: {
			'appContent': {
				templateUrl: 'lib_ui/cards/cardsview.html',
				controller: 'nl.AdminUserCtrl'
			}
		}});
}];

var AdminUserCtrl = ['nl', 'nlRouter', 'nlDlg', '$scope', 'nlCardsSrv',
'nlGroupInfo', 'nlAdminUserExport', 'nlAdminUserImport', 'nlTreeSelect',
function(nl, nlRouter, nlDlg, $scope, nlCardsSrv, nlGroupInfo,
nlAdminUserExport, nlAdminUserImport, nlTreeSelect) {
	var _userInfo = null;
	var _groupInfo = null;
	var _grpid = null;
	var _chunksize = 100; // Number of records to send to server for updating in one chunk
	var _debuglog = false;

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {

            $scope.cards = {};
            $scope.cards.staticlist = _getStaticCards();
            $scope.cards.search = {placeholder: nl.t('Search user name/email/loginid')};

            var params = nl.location.search();
            _grpid = params.grpid || null;
            var clean = ('clean' in params);
            var max = ('max' in params) ? parseInt(params.max) : null;
            if ('chunksize' in params) _chunksize = parseInt(params.chunksize);
            if ('debuglog' in params) _debuglog = true;
            if (_grpid && !nlRouter.isPermitted(_userInfo, 'admin_group')) {
                nlDlg.popupAlert({title: 'Not allowed', template: 'You are not allowed to view this information.'})
                .then(function() {
                    resolve(false);
                });
                return;
            }

		    nlGroupInfo.init(true, _grpid, clean, max).then(function() {
		        nlGroupInfo.update(_grpid);
		        _groupInfo = nlGroupInfo.get(_grpid);
		        if (_groupInfo.cacheDirty) {
		            var userCnt = Object.keys(_groupInfo.derived.keyToUsers).length;
		            var msg = 'Cache building is in progress. ';
		            msg += 'You may not be seeing the complete list of users. ';
		            msg += 'Currently <b>{}</b> users are loaded.';
		            nlDlg.popupAlert({title: 'Warning', template: nl.fmt2(msg, userCnt)});
		        }
                nlAdminUserImport.init(_groupInfo, _userInfo, _grpid);
                nl.pginfo.pageTitle = nl.t('User administration: {}', _groupInfo.name);
                _updateCards();
                resolve(true);
            }, function(err) {
                resolve(false);
            });
		});
	}

	nlRouter.initContoller($scope, '', _onPageEnter);

    $scope.onCardInternalUrlClicked = function(card, internalUrl) {
    	$scope.onCardLinkClicked(card, internalUrl);
    };

	$scope.onCardLinkClicked = function(card, linkid) {
		if (linkid === 'adminuser_create') {
			_createOrModify(null);
		} else if (linkid === 'adminuser_modify') {
            _createOrModify(card);
        } else if (linkid === 'adminuser_export') {
            _export();
        } else if (linkid === 'adminuser_import') {
            _import();
		}
	};
	
	function _getStaticCards() {
		var ret = [];
		var card = {title: nl.t('User Administration'), 
					icon: nl.url.resUrl('dashboard/cruser.png'), 
					internalUrl: 'adminuser_create',
					help: nl.t('You add a new user by clicking on this card'), 
					children: [], link: [], style: 'nl-bg-blue'};
        ret.push(card);

        card.children.push({title: nl.t('Create user'), internalUrl: 'adminuser_create',
            children: [], link: [], style: 'nl-bg-blue'});
        if (!nlRouter.isPermitted(_userInfo, 'admin_user_bulk')) return ret;

        card.children.push({title: nl.t('Export'), internalUrl: 'adminuser_export',
            children: [], link: [], style: 'nl-bg-blue'});
        card.children.push({title: nl.t('Import'), internalUrl: 'adminuser_import',
            children: [], link: [], style: 'nl-bg-blue'});
		return ret;
	}

	function _updateCards() {
		var cards = [];
		var users = _groupInfo.derived.keyToUsers || {};
		for (var key in users) {
			var card = _createCard(users[key]);
			cards.push(card);
		}
        cards.sort(function(a, b) {
            return ((b.updated || 0) - (a.updated || 0));
        });
		$scope.cards.rebuildCache = true;
		$scope.cards.cardlist = cards;
	}
	
	function _createCard(user) {
	    var stateIcon = user.isActive() ? 'fgreen' : 'fgrey';
	    stateIcon = nl.fmt2('<i class="ion-record {}"></i>', stateIcon);
	    var desc = '<div>{}<b class="padding-mid">{}</b></div>';
	    desc += '<div>{}</div>';
	    desc += '<div>{}</div>';
	    desc += '<div><b>ou:</b>{}</div>';
	    desc = nl.fmt2(desc, stateIcon, user.getUtStr(), user.username, user.email, user.org_unit);
	    
	    var card = {id: user.id,
	        username: user.username,
            updated: user.updated || 0,
            title: user.name,
            internalUrl: 'adminuser_modify',
            icon: user.getIcon(),
			help: desc,
			children: []};

		card.details = {help: '', avps: _getAvps(user)};
		card.links = [];
		card.links.push({id: 'details', text: nl.t('details')});
		return card;
	}
	
	function  _getAvps(user) {
		var avps = [];
        nl.fmt.addAvp(avps, 'First name', user.first_name);
        nl.fmt.addAvp(avps, 'Last name', user.last_name);
		nl.fmt.addAvp(avps, 'Login id', user.username);
        nl.fmt.addAvp(avps, 'Status', user.getStateStr());
		nl.fmt.addAvp(avps, 'Email', user.email);
        nl.fmt.addAvp(avps, 'User type', user.getUtStr());
        nl.fmt.addAvp(avps, 'OU', user.org_unit);
        nl.fmt.addAvp(avps, 'Secondary OUs', user.sec_ou_list);
		nl.fmt.addAvp(avps, 'Created on', user.created, 'date');
		nl.fmt.addAvp(avps, 'Updated on', user.updated, 'date');
		return avps;
	}

    function _createOrModify(card) {
        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-height-max nl-width-max');
        dlg.scope.error = {};
        dlg.scope.options = {
            usertype: nlGroupInfo.getUtOptions(_grpid),
            state: nlGroupInfo.getStateOptions(_grpid)};

        dlg.scope.data = {usertype: dlg.scope.options.usertype[0], 
            user_id: '',
            first_name: '',
            last_name: '',
            email: '',
            state: dlg.scope.options.state[0]};
        var user = null;

        if (card) {
            var users = _groupInfo.derived.keyToUsers || {};
            user = users[card.username];
            dlg.scope.dlgTitle = nl.t('Modify user: {}', user.username);
            dlg.scope.isModify = true;

            dlg.scope.data.usertype = {id: user.usertype, name: user.getUtStr()};
            dlg.scope.data.user_id = user.user_id;
            dlg.scope.data.first_name = user.first_name;
            dlg.scope.data.last_name = user.last_name;
            dlg.scope.data.email = user.email;
            dlg.scope.data.state = {id: user.state, name: user.getStateStr()};
            dlg.scope.data.org_unit = _getTreeInfo(user.org_unit, true, false);
            dlg.scope.data.sec_ou_list = _getTreeInfo(user.sec_ou_list, false, true);
        } else {
            dlg.scope.dlgTitle = nl.t('New user');
            dlg.scope.isModify = false;
            dlg.scope.data.org_unit = _getTreeInfo('', true, false);
            dlg.scope.data.sec_ou_list = _getTreeInfo('', false, true);
        }

        var button = {
            text : card ? nl.t('Modify') : nl.t('Create'),
            onTap : function(e) {
                _onCreateModify(e, dlg.scope, user);
            }
        };
        var cancelButton = {
            text : nl.t('Cancel')
        };
        dlg.show('view_controllers/admin/user_create_dlg.html', [button], cancelButton, false);
    }

    function _getTreeInfo(itemList, treeIsShown, multiSelect) {
        var selectedIds = _getIdDict(itemList);
        var treeInfo = {data: nlTreeSelect.treeToTreeArray(_groupInfo.outree || [])};
        nlTreeSelect.updateSelectionTree(treeInfo, selectedIds);
        treeInfo.treeIsShown = treeIsShown;
        treeInfo.multiSelect = multiSelect;
        return treeInfo;
    }
    
    function _getIdDict(itemList) {
        var selectedIds = {};
        if (itemList == '') return selectedIds;
        var items = itemList.split(',');
        for (var i=0; i<items.length; i++) {
            selectedIds[items[i].trim()] = true;
        }
        return selectedIds;
    }
    
    function _getTreeSelection(treeInfo) {
        var selected = nlTreeSelect.getSelectedIds(treeInfo);
        var ret = '';
        var DELIM = '';
        for(var key in selected) {
            ret += DELIM + key;
            DELIM = ',';
        }
        return ret;
    }
    
    function _onCreateModify(event, dlgScope, user) {
        var d = dlgScope.data;
        var username = user ? user.username : nl.fmt2('{}.{}', d.user_id, _groupInfo.grpid);
        var row = {op: user ? 'u' : 'c', username: username,
            user_id: d.user_id, usertype: d.usertype.name, state: d.state.id,
            first_name: d.first_name, last_name: d.last_name, email: d.email, 
            org_unit: _getTreeSelection(d.org_unit), 
            sec_ou_list: _getTreeSelection(d.sec_ou_list)
        };
        dlgScope.error = {};
        nlAdminUserImport.initImportOperation();
        if (!_validate(dlgScope, row)) {
            if (event) event.preventDefault();
            return;
        }
        if (row.ignore) {
            nlDlg.popupStatus('No changes to update');
            return;
        }
        nlDlg.showLoadingScreen();
        nlAdminUserImport.updateServer([row]).then(function(errorCnt) {
            nlDlg.hideLoadingScreen();
            if (errorCnt > 0) {
                nlDlg.popupAlert({title: 'Processing Error', template: 'Server encountered error processing the request'});
                return;
            }
            _groupInfo = nlGroupInfo.get(_grpid);
            _updateCards();
        });
    }
    
    function _validate(dlgScope, row) {
        if(!_validateField(nlAdminUserImport.validateOp, row, dlgScope, '')) return false;
        if(!_validateField(nlAdminUserImport.validateGroup, row, dlgScope, '')) return false;
        if(!_validateField(nlAdminUserImport.validateKeyColumns, row, dlgScope, 'user_id')) return false;
        if(!_validateField(nlAdminUserImport.validateUserType, row, dlgScope, 'usertype')) return false;
        if(!_validateField(nlAdminUserImport.validateState, row, dlgScope, 'state')) return false;
        if(!_validateField(nlAdminUserImport.validateNames, row, dlgScope, 'first_name')) return false;
        if(!_validateField(nlAdminUserImport.validateEmail, row, dlgScope, 'email')) return false;
        if(!_validateField(nlAdminUserImport.validateMobile, row, dlgScope, '')) return false;
        if(!_validateField(nlAdminUserImport.validateOu, row, dlgScope, 'org_unit')) return false;
        if(!_validateField(nlAdminUserImport.validateSecOu, row, dlgScope, 'sec_ou_list')) return false;
        if(!_validateField(nlAdminUserImport.validateManagers, row, dlgScope, '')) return false;
        if(!_validateField(nlAdminUserImport.deleteUnwanted, row, dlgScope, '')) return false;
        if(!_validateField(nlAdminUserImport.validateDuplicates, row, dlgScope, '')) return false;
        return true;
    }
    
    function _validateField(fn, record, dlgScope, attr) {
        try {
            fn(record);
        } catch (e) {
            if (dlgScope && attr) dlgScope.error[attr] = e.message;
            return false;
        }
        return true;
    }
    
    function _export() {
        nlDlg.showLoadingScreen();
        nlAdminUserExport.exportUsers(_groupInfo).then(function() {
            nl.timeout(function() {
                nlDlg.hideLoadingScreen();
            }, 2000);
        });
    }

    function _import() {
        nlAdminUserImport.importUsers($scope, _chunksize, _debuglog).then(function() {
            _groupInfo = nlGroupInfo.get(_grpid);
            _updateCards();
        }, function(msg) {
            nlDlg.popupStatus('Import ongoing');
        });
    }
}];

module_init();
})();

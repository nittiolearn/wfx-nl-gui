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
'nlOuUserSelect', 'nlServerApi',
function(nl, nlRouter, nlDlg, $scope, nlCardsSrv, nlGroupInfo,
nlAdminUserExport, nlAdminUserImport, nlTreeSelect, nlOuUserSelect, nlServerApi) {
	var _userInfo = null;
	var _groupInfo = null;
	var _grpid = null;
	var _chunksize = 100; // Number of records to send to server for updating in one chunk
	var _debuglog = false;

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {

            $scope.cards = {staticlist: _getStaticCards(), 
                largeData: true,
                search:{placeholder: nl.t('Search user name/email/loginid')}};
            nlCardsSrv.initCards($scope.cards);

            var params = nl.location.search();
            _grpid = params.grpid || null;
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

		    nlGroupInfo.init3(_grpid, max).then(function() {
		        nlGroupInfo.update(_grpid);
		        _groupInfo = nlGroupInfo.get(_grpid);
		        if (_groupInfo.cacheDirty) {
		            var userCnt = Object.keys(nlGroupInfo.getKeyToUsers(_groupInfo, _grpid)).length;
		            var msg = 'Cache building is in progress. ';
		            msg += 'You may not be seeing the complete list of users. ';
		            msg += 'Currently <b>{}</b> users are loaded.';
		            nlDlg.popupAlert({title: 'Warning', template: nl.fmt2(msg, userCnt)});
		        }
                nlAdminUserImport.init(_groupInfo, _userInfo, _grpid).then(function(doesPastUserExist){
                    nl.pginfo.pageTitle = nl.t('User administration: {}', _groupInfo.name);
                    _updateCards();
                    resolve(true);
                });
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
        } else if (linkid === 'adminuser_resetpw') {
            _resetPw(card);
        } else if (linkid === 'adminuser_advancedProp') {
            advancedProp(card);
        } else if (linkid === 'adminuser_unarchive') {
            _unarchive();
        }
    };

    function advancedProp(card) {
        var advancedPropDlg = nlDlg.create($scope);
        advancedPropDlg.setCssClass('nl-height-max nl-width-max');
        advancedPropDlg.scope.error = {};
        advancedPropDlg.scope.dlgTitle = nl.t('Modify Advanced User Properties');
        
        advancedPropDlg.scope.data = {isBleedingEdge: card.isBleedingEdge, permOverride: card.perm_override};
        var submitButton = {text : nl.t('Submit'), onTap : function(e) {
            var rows = [{'op': 'u', 'user_id': card.user_id, 
                        'username': card.username, 'isBleedingEdge': advancedPropDlg.scope.data.isBleedingEdge,
                        'perm_override': advancedPropDlg.scope.data.permOverride}];
            nlDlg.showLoadingScreen();
            nlServerApi.groupUpdateUsers(_groupInfo.id, rows).then(function(result) {
                _onChangeDone();
            }, function(e) {
                nlDlg.popupStatus('Internal Error.');
            })
        }};
        var cancelButton = {text : nl.t('Cancel')};
        advancedPropDlg.show('view_controllers/admin/user_advanced_prop_dlg.html',
                [submitButton], cancelButton);

    }
    
    function _resetPw(card) {
        var msg = {title: 'Please confirm user password reset', 
                   template: 'Are you sure you want to reset the password of the user to same as the login id?'};
        nlDlg.popupConfirm(msg).then(function(confirm) {
            if (!confirm) return;
            var rows = [{'op': 'E', 'user_id': card.user_id, 'username': card.username}];
            nlDlg.showLoadingScreen();
            nlServerApi.groupUpdateUsers(_groupInfo.id, rows).then(function() {
                nlDlg.hideLoadingScreen();
                _onChangeDone();
            }, function(e) {
                nlDlg.popupStatus('Internal Error. Not able to reset password. Please try later.');
            });
        });
    }

    function _onChangeDone() {
        nlGroupInfo.init3(_grpid).then(function() {
            nlGroupInfo.update(_grpid);
            _groupInfo = nlGroupInfo.get(_grpid);
            _updateCards();
            nlDlg.hideLoadingScreen();
        });
    }

	function _getStaticCards() {
		var ret = [];
		var card = {title: nl.t('User Administration'), 
					icon: nl.url.resUrl('dashboard/cruser.png'), 
					internalUrl: 'adminuser_create',
					help: nl.t('Add a new user by clicking on this card'), 
					children: [], link: [], style: 'nl-bg-blue'};
        ret.push(card);

        card.children.push({title: nl.t('Create user'), internalUrl: 'adminuser_create',
            children: [], link: [], style: 'nl-bg-blue'});

        card.children.push({title: nl.t('Export'), internalUrl: 'adminuser_export',
            children: [], link: [], style: 'nl-bg-blue'});
        card.children.push({title: nl.t('Import'), internalUrl: 'adminuser_import',
            children: [], link: [], style: 'nl-bg-blue'});
        if(doesPastUserExist) {
            card.children.push({title: nl.t('Unarchive'), internalUrl: 'adminuser_unarchive',
            children: [], link: [], style: 'nl-bg-blue'});
        }
		return ret;
	}

	function _updateCards() {
		var cards = [];
        var users = nlGroupInfo.getKeyToUsers(_groupInfo, _grpid);
		for (var key in users) {
			var card = _createCard(users[key]);
			cards.push(card);
		}
        cards.sort(function(a, b) {
            return ((b.updated || 0) - (a.updated || 0));
        });
        nlCardsSrv.updateCards($scope.cards, {cardlist: cards, staticlist: _getStaticCards()});
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
            children: [],
            user_id: user.user_id,
            isBleedingEdge: user.isBleedingEdge,
            perm_override: user.perm_override};

		card.details = {help: '', avps: _getAvps(user)};
		card.links = [];
		card.links.push({id: 'details', text: nl.t('details')});
		return card;
	}
	
	function  _getAvps(user) {
        var avps = [];
        _populateLinks(avps);
        nl.fmt.addAvp(avps, 'First name', user.first_name);
        nl.fmt.addAvp(avps, 'Last name', user.last_name);
		nl.fmt.addAvp(avps, 'Login id', user.username);
        nl.fmt.addAvp(avps, 'Status', user.getStateStr());
		nl.fmt.addAvp(avps, 'Email', user.email);
        nl.fmt.addAvp(avps, 'User type', user.getUtStr());
        nl.fmt.addAvp(avps, 'OU', user.org_unit);
        nl.fmt.addAvp(avps, 'Secondary OUs', user.sec_ou_list);
        nl.fmt.addAvp(avps, 'Supervisor', user.supervisor);
        nl.fmt.addAvp(avps, 'Mobile', user.mobile);
        nl.fmt.addAvp(avps, 'Secondary Login', user.seclogin);
        nl.fmt.addAvp(avps, 'Date of joining', user.doj);
        var metadata = nlGroupInfo.getUserMetadata(user, _grpid);
        for(var i=0; i<metadata.length; i++) {
            nl.fmt.addAvp(avps, metadata[i].name, metadata[i].value);
        }
		nl.fmt.addAvp(avps, 'Created on', user.created, 'date');
		nl.fmt.addAvp(avps, 'Updated on', user.updated, 'date');
        nl.fmt.addAvp(avps, 'Internal identifier', user.id);
		return avps;
    }
    
    function _populateLinks(avps) {
        var linkAvp = nl.fmt.addLinksAvp(avps, 'Operation(s)');
        nl.fmt.addLinkToAvp(linkAvp, 'reset password', null, 'adminuser_resetpw');
        var isAdminGroup = nlRouter.isPermitted(_userInfo, 'admin_group');
        if(!isAdminGroup) return;
        nl.fmt.addLinkToAvp(linkAvp, 'advanced properties', null, 'adminuser_advancedProp');
    }


    function _unarchive() {
        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-height-max nl-width-max');
        dlg.scope.error = {};
        dlg.scope.dlgTitle = nl.t('Unarchive the users');
        var selectedUserIds = [];
        dlg.scope.data = {
            selectedIds : ''
        };
        var unarchiveButton = {text : 'Unarchive', onTap : function(e) {
            e.stopImmediatePropagation();
            e.preventDefault();
            selectedUserIds = getSelectedIdsObj(dlg.scope.data.selectedIds);
            if(!selectedUserIds) return;
            nlDlg.showLoadingScreen();
            return nl.q(function(resolve, reject) {
                _onUnarchive(selectedUserIds, resolve, reject);
            });
        }};
        var cancelButton = {text : nl.t('Cancel')};
        dlg.show('view_controllers/admin/user_unarchive.html',
            [unarchiveButton], cancelButton, false);
    }

    function getSelectedIdsObj(selectedIds) {
        var selectedIdTemp = angular.copy(selectedIds.replace(/[\s\n\r]+/g, ","));
        selectedIdTemp = selectedIdTemp.split(',');
        var finalSelectedIds = {};
        var errorArray = [];
        var limitError = false;
        var usersIds = [];
        for(var i=0; i<selectedIdTemp.length; i++) {
            var selectedId = selectedIdTemp[i].trim();
            if(!selectedId) continue;
            selectedId = selectedId.split('.')[0];
            if(selectedId in finalSelectedIds) errorArray.push({id:selectedIdTemp[i].trim(), msg:'This userid is repeated.'})
            if (selectedId) finalSelectedIds[selectedId] = true;
            usersIds.push(selectedId + '.' + _groupInfo.grpid);
        }
        if(usersIds.length > 100) limitError = true;
        if(errorArray.length == 0 && !limitError) return usersIds;
        
        var msg = '<div class="fsh6" style="min-width: 40vw">Error in provided userids string</div><div><ul>';
        for(var i=0; i<errorArray.length; i++) msg += nl.t('<li class="padding-mid"><span style="font-weight:bold">{} : </span><span>{}</span>', errorArray[i].id, errorArray[i].msg); 
        msg += '</ul></div>';
        if(limitError) msg += nl.t('<div class="fsh6">Maximum number of user_id\'s can be 100 for unarchiving. {} given. </div>', usersIds.length);
        nlDlg.popupAlert({title: 'Error message', template: msg});        
        return false;
    }

    function _onUnarchive(selectedUserIds, resolve, reject) {
        var data = {"deleted": false, "max": 100, "update_cache": true, "users" : selectedUserIds || []};
        nlServerApi.groupUpdateDeletedAttrOfUsers(data).then(function(result) {
            nlDlg.hideLoadingScreen();
            _updateStatusMessage(selectedUserIds, result.resultset, resolve);
        }, function(err) {
            nlDlg.hideLoadingScreen();
            reject();
        })
    }

    function _updateStatusMessage(selectedUserIds, updatedUsers, resolve) {
        var msg = '<div class="fsh6" style="min-width: 50vw">Update with the following userid\'s </div><div><ul>';
        var updatedUsersId = [];
        for(var i=0; i< updatedUsers.length; i++) updatedUsersId.push(updatedUsers[i].username);
        for(var i=0; i<selectedUserIds.length; i++) {
            if(updatedUsersId.indexOf(selectedUserIds[i]) < 0) {
                msg += nl.t('<li class="padding-mid"><span style="font-weight:bold">{} : </span><span>Invalid UserId</span>', selectedUserIds[i]);
                continue;
            }
            msg += nl.t('<li class="padding-mid"><span style="font-weight:bold">{} : </span><span>Unarchived</span>', selectedUserIds[i]);
        }

        msg += '</ul></div>';
        nlDlg.popupAlert({title: 'Update Status', template: msg}).then(function() {
            resolve();
            nlDlg.closeAll();
            nl.window.location.reload();
        });
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
            mobile: '',
            seclogin: '',
            state: dlg.scope.options.state[0]};
            
        var user = null;

        if (card) {
            var users = nlGroupInfo.getKeyToUsers(_groupInfo, _grpid);
            user = users[card.username];
            dlg.scope.dlgTitle = nl.t('Modify user: {}', user.username);
            dlg.scope.isModify = true;

            dlg.scope.data.usertype = {id: user.usertype, name: user.getUtStr()};
            dlg.scope.data.user_id = user.user_id;
            dlg.scope.data.first_name = user.first_name;
            dlg.scope.data.last_name = user.last_name;
            dlg.scope.data.email = user.email;
            dlg.scope.data.state = {id: user.state, name: user.getStateStr()};
            dlg.scope.data.org_unit = _getOuTree(user.org_unit, false, false);
            dlg.scope.data.sec_ou_list = _getOuTree(user.sec_ou_list, false, true);
            dlg.scope.data.mobile = user.mobile;
            dlg.scope.data.seclogin = user.seclogin;
            dlg.scope.data.supervisor = user.supervisor;
            try {
	            dlg.scope.data.doj = user.doj ? nl.fmt.json2Date(user.doj) : null;
            } catch (e) {
 	            dlg.scope.data.doj = null;
            }
        } else {
            dlg.scope.dlgTitle = nl.t('New user');
            dlg.scope.isModify = false;
            dlg.scope.data.org_unit = _getOuTree('', false, false);
            dlg.scope.data.sec_ou_list = _getOuTree('', false, true);
        }

        var metadata = nlGroupInfo.getUserMetadata(user, _grpid);
        dlg.scope.data.metadata = metadata;
        for(var i=0; i<metadata.length; i++) {
            var mid = metadata[i].id;
            dlg.scope.data[mid] = metadata[i].value;
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

    function _getOuTree(selectedOus, treeIsShown, multiSelect) {
        var selectedOusArray = selectedOus == '' ? [] : selectedOus.split(',');
        var ret = nlOuUserSelect.getOuTree(_groupInfo, selectedOusArray, treeIsShown, multiSelect);
        ret.canSelectFolder = true;
        return ret;
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
    
    function _getMetadataJson(dlgScope) {
        var mdValues = {};
        var metadata = dlgScope.data.metadata;
        for (var i=0; i<metadata.length; i++) {
            var m = metadata[i];
            if (dlgScope.data[m.id] !== '') mdValues[m.id] = dlgScope.data[m.id];
        }
        return angular.toJson(mdValues);
    }

    function _onCreateModify(event, dlgScope, user) {
        var d = dlgScope.data;
        var username = user ? user.username : nl.fmt2('{}.{}', d.user_id, _groupInfo.grpid);
        var row = {op: user ? 'u' : 'c', username: username,
            user_id: d.user_id, usertype: d.usertype.name, state: d.state.id,
            first_name: d.first_name, last_name: d.last_name, email: d.email, 
            org_unit: _getTreeSelection(d.org_unit), 
            sec_ou_list: _getTreeSelection(d.sec_ou_list),
            seclogin: d.seclogin,
            mobile: d.mobile,
            supervisor: d.supervisor,
            doj: d.doj ? nl.fmt.date2Str(d.doj, 'date') : '',
            metadata: _getMetadataJson(dlgScope)
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
        var lstUidChange = [];
        if(user && dlgScope.data.user_id != user.user_id) {
            var newUserId = dlgScope.data.user_id;
            var oldUserId = user.user_id;
            lstUidChange.push({newUserId:newUserId, oldUserId:oldUserId});
        }
        nlDlg.showLoadingScreen();
        nlAdminUserImport.updateServerAfterConfirmIfNeeded(lstUidChange, [row]).then(function(errorCnt) {
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
        if(!_validateField(nlAdminUserImport.validateMobile, row, dlgScope, 'mobile')) return false;
        if(!_validateField(nlAdminUserImport.validateSeclogin, row, dlgScope, 'seclogin')) return false;
        if(!_validateField(nlAdminUserImport.validateOu, row, dlgScope, 'org_unit')) return false;
        if(!_validateField(nlAdminUserImport.validateSecOu, row, dlgScope, 'sec_ou_list')) return false;
        if(!_validateField(nlAdminUserImport.validateManagers, row, dlgScope, 'supervisor')) return false;
        if(!_validateField(nlAdminUserImport.validateDoj, row, dlgScope, 'doj')) return false;
        if(!_validateField(nlAdminUserImport.deleteUnwanted, row, dlgScope, '')) return false;
        if(!_validateField(nlAdminUserImport.validateRealChange, row, dlgScope, '')) return false;
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
        nlAdminUserExport.exportUsers(_groupInfo, _grpid).then(function() {
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

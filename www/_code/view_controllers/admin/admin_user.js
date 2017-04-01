(function() {

//-------------------------------------------------------------------------------------------------
// admin_user.js:
// user administration module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.admin_user', [])
	.config(configFn)
	.controller('nl.AdminUserCtrl', AdminUserCtrl)
    .directive('adminUserCsvFormat', AdminUserCsvFormatDir);
}

//-------------------------------------------------------------------------------------------------
var AdminUserCsvFormatDir = [function() {
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/admin/admin_user_csv_format.html',
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
'nlGroupInfo', 'nlAdminUserImport',
function(nl, nlRouter, nlDlg, $scope, nlCardsSrv, nlGroupInfo, nlAdminUserImport) {
	var _userInfo = null;
	var _groupInfo = null;
	var _grpid = null;

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {

            $scope.cards = {};
            $scope.cards.staticlist = _getStaticCards();
            $scope.cards.search = {placeholder: nl.t('Search user name/email/loginid')};

            var params = nl.location.search();
            _grpid = params.grpid || null;
            if (_grpid && !nlRouter.isPermitted(_userInfo, 'admin_group')) {
                nlDlg.popupAlert({title: 'Not allowed', template: 'You are not allowed to view this information.'})
                .then(function() {
                    resolve(false);
                });
                return;
            }

		    nlGroupInfo.init(true, _grpid).then(function() {
		        nlGroupInfo.update(_grpid);
		        _groupInfo = nlGroupInfo.get(_grpid);
                nl.pginfo.pageTitle = nl.t('User administration: {}', _groupInfo.name);
                $scope.cards.cardlist = _getCards();
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

	function _getCards() {
		var cards = [];
		var users = _groupInfo.derived.keyToUsers || {};
		for (var key in users) {
			var card = _createCard(users[key]);
			cards.push(card);
		}
        cards.sort(function(a, b) {
            return ((b.updated || 0) - (a.updated || 0));
        });
		return cards;
	}
	
	function _createCard(user) {
	    var stateIcon = user.isActive() ? 'fgreen' : 'fgrey';
	    stateIcon = nl.fmt2('<i class="ion-record {}"></i>', stateIcon);
	    var desc = '<div>{}<b class="padding-mid">{}</b></div>';
	    desc += '<div>{}</div>';
	    desc += '<div>{}</div>';
	    desc += '<div><b>ou:</b>{}</div>';
	    desc = nl.fmt2(desc, stateIcon, user.getUtStr(), user.loginid, user.email, user.ou);
	    
	    var card = {id: user.id,
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
        nl.fmt.addAvp(avps, 'First name', user.fname);
        nl.fmt.addAvp(avps, 'Last name', user.lname);
		nl.fmt.addAvp(avps, 'Login id', user.loginid);
        nl.fmt.addAvp(avps, 'Status', user.getStateStr());
		nl.fmt.addAvp(avps, 'Email', user.email);
        nl.fmt.addAvp(avps, 'User type', user.getUtStr());
        nl.fmt.addAvp(avps, 'OU', user.ou);
        nl.fmt.addAvp(avps, 'Secondary OUs', user.secOus);
		nl.fmt.addAvp(avps, 'Created on', user.created, 'date');
		nl.fmt.addAvp(avps, 'Updated on', user.updated, 'date');
		return avps;
	}

    function _createOrModify(card) {
        nlDlg.popupAlert({title: 'TODO', template: nl.fmt2('_createOrModify: {}', card ? 'modify' : 'create')});
    }

    function _export() {
        nlDlg.popupAlert({title: 'TODO', template: 'Export'});
    }

    function _import() {
        nlAdminUserImport.importUsers($scope, _grpid, _groupInfo, _userInfo).then(function() {
            _groupInfo = nlGroupInfo.get(_grpid);
            $scope.cards.cardlist = _getCards();
        });
    }
}];

module_init();
})();

(function() {

//-------------------------------------------------------------------------------------------------
// dashboard.js: custom dashboard
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.dashboard', [])
	.config(configFn)
	.controller('nl.DashboardCtrl', DashboardCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider',
function($stateProvider) {
	$stateProvider.state('app.dashboard', {
		cache : true,
		url : '/dashboard',
		views : {
			'appContent' : {
				templateUrl : 'lib_ui/cards/cardsview.html',
				controller : 'nl.DashboardCtrl'
			}
		}
	});
}];

//-------------------------------------------------------------------------------------------------
var DashboardCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg',
function(nl, nlRouter, $scope, nlServerApi, nlDlg) {
	var cardDict = {};
	var my = false;
	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
			nl.pginfo.pageTitle = nl.t('Custom Dashboards');
	        var params = nl.location.search();
	        my = ('my' in params) ? parseInt(params.my) == 1: false;
        	$scope.cards = {};
			$scope.cards.staticlist = _getStaticCards();
            var data = nlServerApi.dashboardGetList(my);
            data.then(function(resultList){
            	$scope.cards.cardlist = _getCustomDashboardCards(resultList);
            	resolve(true);	
            }, function(error) {
                resolve(false);
            });
		});
	}

	nlRouter.initContoller($scope, '', _onPageEnter);
	
	$scope.onCardInternalUrlClicked = function(internalUrl) {
		if (internalUrl === 'dashboard_create') {
			_createOrModifyDashboard($scope, null, false);
		}
    };
	
	$scope.onCardLinkClicked = function(card, linkid) {
		if (linkid === 'dashboard_modify') {
			_createOrModifyDashboard($scope, card.dashboardId, false);
		} else if (linkid === 'dashboard_content') {
            _createOrModifyDashboard($scope, card.dashboardId, true);
        } else if (linkid === 'dashboard_delete') {
            _deleteDashboard($scope, card.dashboardId);
        }
	};

	function _getCustomDashboardCards(resultList) {
		var cards = [];
		for(var i=0; i<resultList.length; i++){
			var card = _createCustomDashboardCard(resultList[i]);
			cards.push(card);
		}
		return cards;
	}
	
	function _createCustomDashboardCard(dashboard){
		cardDict[dashboard.id] = dashboard;
        var url = nl.fmt2('#/app/dashboard_view?dbid={}&published={}', dashboard.id, my ? 0: 1);
		var createList = {
			dashboardId : dashboard.id,
			title : dashboard.description,
			url: url,
			icon : nl.url.resUrl('dashboard/defgroup.png'),
			help : nl.t('<P>Author: {}</P><P>Group:{}</P>', dashboard.authorname, dashboard.grpname),
			children :[]
		};
		createList.details = {help: dashboard.description, avps: _getDashboardAvps(dashboard)};
		createList.links = [];
		if (my) {
			createList.links.push({id: "dashboard_modify", text: nl.t('modify')});
			createList.links.push({id: "dashboard_delete", text: nl.t('delete')});
		} else {
            createList.links.push({id: "dashboard_content", text: nl.t('content')});
		}
		createList.links.push({id: 'details', text: nl.t('details')}); 
		return createList;
	}
	
	function  _getDashboardAvps(dashboard) {
		var avps = [];
        nl.fmt.addAvp(avps, 'ID', dashboard.id);
        nl.fmt.addAvp(avps, 'Author', dashboard.authorname);
		nl.fmt.addAvp(avps, 'Group', dashboard.grpname);
		nl.fmt.addAvp(avps, 'Updated by', dashboard.updated_by_name);
		nl.fmt.addAvp(avps, 'Created on', dashboard.created, 'date');
		nl.fmt.addAvp(avps, 'Updated on', dashboard.updated, 'date');
		nl.fmt.addAvp(avps, 'Published on', dashboard.published, 'date');
		nl.fmt.addAvp(avps, 'Is published?', dashboard.is_published, 'boolean');
		return avps;
	}

	function _getStaticCards() {
		var ret = [];
		if (!my) return ret;
		var card = {title: nl.t('Create'), 
					icon: nl.url.resUrl('dashboard/crgroup.png'), 
					internalUrl: 'dashboard_create',
					help: nl.t('You can create a new custom dashboard by clicking on this card'), 
					children: [], style: 'nl-bg-blue'};
		card.links = [];
		ret.push(card);
		return ret;
	}
	
	function _createOrModifyDashboard($scope, dashboardId, readonly) {
		var modifyDlg = nlDlg.create($scope);
		modifyDlg.setCssClass('nl-height-max nl-width-max');
        modifyDlg.scope.error = {};
		if (dashboardId !== null) {
			var dashboard = cardDict[dashboardId];
			$scope.dlgTitle = readonly? nl.t('View dashboard content') : nl.t('Modify dashboard');
			modifyDlg.scope.data = {description: dashboard.description, content: angular.toJson(dashboard.content, 2), readonly: readonly};
		} else {
			$scope.dlgTitle = nl.t('Create a new dashboard');
			modifyDlg.scope.data = {description: '', content: '', readonly: readonly};
		}
		
		var buttons = [];
		var saveName = (dashboardId !== null) ? nl.t('Save') : nl.t('Create');
		if (!readonly) {
            var saveButton = {
                text : saveName,
                onTap : function(e) {
                    _onDashboardSave(e, $scope, modifyDlg, dashboardId, false);
                }
            };
            buttons.push(saveButton);
		}
		
		if (!readonly && dashboardId !== null) {
			var publishButton = {
				text : nl.t('Publish'),
				onTap : function(e) {
					_onDashboardSave(e, $scope, modifyDlg, dashboardId, true);
				}
			};
			buttons.push(publishButton);
		}

		var cancelButton = {
			text : readonly ? nl.t('Close') : nl.t('Cancel')
		};
		modifyDlg.show('view_controllers/dashboard/dashboard_create_dlg.html',
			buttons, cancelButton, false);
	}
	
	function _onDashboardSave(e, $scope, modifyDlg, dashboardId, bPublish) {
	    if(!_validateInputs(modifyDlg.scope)) {
	        if(e) e.preventDefault();
	        return;
	    }
		var modifiedData = {
			description: modifyDlg.scope.data.description,
			content: modifyDlg.scope.data.content,
			publish: bPublish 
		};
		if (dashboardId !== null) modifiedData.dbid = dashboardId;
		var crModFn = (dashboardId != null) ? nlServerApi.dashboardModify: nlServerApi.dashboardCreate;
		crModFn(modifiedData).then(function(dashboard) {
			nlDlg.hideLoadingScreen();
		    _updateDashboardForTesting(dashboard, modifiedData);
		    var card = _createCustomDashboardCard(dashboard);
		    if (dashboardId !== null) {
                var pos = _getCardPosition(dashboardId);
                $scope.cards.cardlist.splice(pos, 1);
		    }
			$scope.cards.cardlist.splice(1, 0, card);			
		});
	}
	
    function _validateInputs(scope) {
        scope.error = {};
        if(!scope.data.description) return _validateFail(scope, 'description', 'Dashboard description is mandatory');
        if(!scope.data.content) return _validateFail(scope, 'content', 'Dashboard content is mandatory');

        try {
            var content = angular.fromJson(scope.data.content);
            return _validateContent(scope, content);            
        } catch (error) {
            scope.error.content = nl.t('Error parsing JSON: {}. Try http://www.jsoneditoronline.org to debug more', error.toString());
            return false;
        }
    }

    function _validateContent(scope, courseContent) {
        if (!angular.isArray(courseContent)) return _validateFail(scope, 'content', 
            'Dashboard content needs to be a JSON array []');
        var uniqueIds = {};
        for(var i=0; i<courseContent.length; i++){
            var module = courseContent[i];
            if (!module.linkid) return _validateModuleFail(scope, module, '"linkid" is mandatory');
            if (!module.action) return _validateModuleFail(scope, module, '"action" is mandatory');
            if (!module.title) return _validateModuleFail(scope, module, '"title" is mandatory');
            if (module.linkid in uniqueIds) return _validateModuleFail(scope, module, '"linkid" has to be unique');
            uniqueIds[module.linkid] = true;
            var parentId = _getParentId(module.linkid);
            if (parentId && !(parentId in uniqueIds)) return _validateModuleFail(scope, module, 
            	'parent card needs to be above the link');
        }
        return true;
    }

    function _getParentId(idStr) {
        var parents = idStr.split('.');
        parents.pop(); // Remove the last entry
        return parents.join('.');
    }
    
    function _validateModuleFail(scope, module, errMsg) {
        scope.error['content'] = nl.t('{}: element - {}', nl.t(errMsg), angular.toJson(module));
        return false;
    }

    function _validateFail(scope, attr, errMsg) {
        scope.error[attr] = nl.t(errMsg);
        return false;
    }
    
	function _getCardPosition(dashboardId) {
		for(var i in $scope.cards.cardlist) {
			var card = $scope.cards.cardlist[i];
			if(card.dashboardId === dashboardId) return i;
		}
		nl.log.error('Cannot find modified card', dashboardId);
		return 0;
	}
	
	var uniqueId = 100;
	function _updateDashboardForTesting(dashboard, modifiedData) {
		if (NL_SERVER_INFO.serverType !== 'local') return;
		if ('dbid' in modifiedData) {
			dashboard.id = modifiedData.dbid;
		} else {
			dashboard.id = uniqueId++;
		}
		dashboard.updated = (new Date()).toJSON();
		if (modifiedData.publish) {
			dashboard.is_published = true;
			dashboard.published = dashboard.updated;
		} else {
			dashboard.is_published = false;
			dashboard.published = null;
		}
		dashboard.description  = modifiedData.description;
		dashboard.content  = angular.fromJson(modifiedData.content);
	}

	function _deleteDashboard($scope, dashboardId) {
		var msg = {title: 'Please confirm', 
				   template: 'Are you sure you want to delete? This cannot be undone.',
				   okText: nl.t('Delete')};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;
			nlDlg.showLoadingScreen();
			nlServerApi.dashboardDelete(dashboardId).then(function(status) {
				nlDlg.hideLoadingScreen();
				if (dashboardId in cardDict) delete cardDict[dashboardId];
				for (var i in $scope.cards.cardlist) {
					var card = $scope.cards.cardlist[i];
					if (card.dashboardId !== dashboardId) continue;
					$scope.cards.cardlist.splice(i, 1);
				}
			});	
		});
	}
	
}];
module_init();
})();
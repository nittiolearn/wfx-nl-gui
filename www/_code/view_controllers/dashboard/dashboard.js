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
		url : '^/dashboard',
		views : {
			'appContent' : {
				templateUrl : 'lib_ui/cards/cardsview.html',
				controller : 'nl.DashboardCtrl'
			}
		}
	});
}];

//-------------------------------------------------------------------------------------------------
var DashboardCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlCardsSrv',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlCardsSrv) {
	var cardDict = {};
	var my = false;
	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
			nl.pginfo.pageTitle = nl.t('Custom Dashboards');
	        var params = nl.location.search();
	        my = ('my' in params) ? parseInt(params.my) == 1: false;
        	$scope.cards = {
        	    staticlist: _getStaticCards(),
        	    search: {placeholder: nl.t('Enter dashboard name/description')}
        	};
            nlCardsSrv.initCards($scope.cards);
			_getDataFromServer(resolve);
		});
	}

	nlRouter.initContoller($scope, '', _onPageEnter);
	
	$scope.onCardInternalUrlClicked = function(card, internalUrl) {
		if (internalUrl === 'dashboard_create') {
			_createOrModifyDashboard($scope, null, false);
		} else if (internalUrl === 'dashboard_modify') {
            _createOrModifyDashboard($scope, card.dashboardId, false);
        } else if (internalUrl === 'dashboard_content') {
            _createOrModifyDashboard($scope, card.dashboardId, true);
        } else if (internalUrl === 'dashboard_delete') {
            _deleteDashboard($scope, card.dashboardId);
        } else if (internalUrl === 'fetch_more') _getDataFromServer(null, true);
    };
	
	$scope.onCardLinkClicked = function(card, linkId) {
        $scope.onCardInternalUrlClicked(card, linkId);
	};

	function _updateCustomDashboardCards(resultList, cards) {
		for(var i=0; i<resultList.length; i++){
			var card = _createCustomDashboardCard(resultList[i]);
			cards.push(card);
		}
	}
	
	function _createCustomDashboardCard(dashboard){
		cardDict[dashboard.id] = dashboard;
        var url = nl.fmt2('#/dashboard_view?dbid={}&published={}', dashboard.id, my ? 0: 1);
		var createList = {
			dashboardId : dashboard.id,
			title : dashboard.description,
			url: url,
			icon : nl.url.resUrl('dashboard/defgroup.png'),
			help : nl.t('<P>Author: {}</P><P>Group:{}</P>', dashboard.authorname, dashboard.grpname),
			json : dashboard.contentjson, 
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
					children: [], style: 'nl-create-card'};
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
		    var card = _createCustomDashboardCard(dashboard);
		    if (dashboardId !== null) {
                var pos = _getCardPosition(dashboardId);
                $scope.cards.cardlist.splice(pos, 1);
		    }
			$scope.cards.cardlist.splice(0, 0, card);			
            nlCardsSrv.updateCards($scope.cards);
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
        	return nlDlg.setFieldError(scope, 'content',
            	nl.t('Error parsing JSON: {}. Try http://www.jsoneditoronline.org to debug more', error.toString()));
        }
    }

    function _validateContent(scope, courseContent) {
        if (!angular.isArray(courseContent)) return _validateFail(scope, 'content', 
            'Dashboard content needs to be a JSON array []');
        var uniqueIds = {};
        for(var i=0; i<courseContent.length; i++){
            var module = courseContent[i];
            if (!module.linkid) return _validateModuleFail(scope, module, '"linkid" is mandatory');
            if (i == 0 && module.linkid == '_properties') {
                if(!_validateDashboardProperties(scope, module)) return false;
                continue;
            }
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

    function _validateDashboardProperties(scope, module) {
        return true;
    }

    function _getParentId(idStr) {
        var parents = idStr.split('.');
        parents.pop(); // Remove the last entry
        return parents.join('.');
    }
    
    function _validateModuleFail(scope, module, errMsg) {
    	return nlDlg.setFieldError(scope, 'content',
        	nl.t('{}: element - {}', nl.t(errMsg), angular.toJson(module)));
    }

    function _validateFail(scope, attr, errMsg) {
    	return nlDlg.setFieldError(scope, attr,
        	nl.t(errMsg));
    }
    
	function _getCardPosition(dashboardId) {
		for(var i in $scope.cards.cardlist) {
			var card = $scope.cards.cardlist[i];
			if(card.dashboardId === dashboardId) return i;
		}
		nl.log.error('Cannot find modified card', dashboardId);
		return 0;
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
                nlCardsSrv.updateCards($scope.cards);
			});	
		});
	}

    var _pageFetcher = nlServerApi.getPageFetcher();
	function _getDataFromServer(resolve, fetchMore) {
		var params = {mine: my};
        _pageFetcher.fetchPage(nlServerApi.dashboardGetList, 
            params, fetchMore, function(resultList) {
            if(!resultList) {
                if (resolve) resolve(false);
                return;
            }
            $scope.cards.canFetchMore = _pageFetcher.canFetchMore();
            if (!fetchMore) $scope.cards.cardlist = [];
            _updateCustomDashboardCards(resultList, $scope.cards.cardlist);
            nlCardsSrv.updateCards($scope.cards);
            if (resolve) resolve(true);
        });
     }
	
}];
module_init();
})();
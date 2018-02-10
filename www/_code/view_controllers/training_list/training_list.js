(function() {

//-------------------------------------------------------------------------------------------------
// training_list.js:
// training module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.training_list', []).config(configFn).directive('nlTrainingDetails', TrainingDetailsDirective).controller('nl.TrainingListCtrl', TrainingListCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.training_list', {
		url : '^/training_list',
		views : {
			'appContent' : {
				templateUrl : 'lib_ui/cards/cardsview.html',
				controller : 'nl.TrainingListCtrl'
			}
		}
	});
}];

//-------------------------------------------------------------------------------------------------
var TrainingListCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi', 'nlSendAssignmentSrv', 'nlGroupInfo',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, nlSendAssignmentSrv, nlGroupInfo) {

	var _userInfo = null;
	var trainingListDict = {};
	var _scope = null;
    var _canShowDelete = false;

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		trainingListDict = {};
		return nl.q(function(resolve, reject) {
            nlGroupInfo.init().then(function() {
                nlGroupInfo.update();
				nl.pginfo.pageTitle = nl.t('Trainings');
				_scope = $scope;
	            var params = nl.location.search();
	            _canShowDelete = ('debug' in params) &&
	                nlRouter.isPermitted(userInfo, 'admin_user');
				$scope.cards = {
				    toolbar: _getToolbar(),
	                search: {placeholder: nl.t('Enter training name/description')},
				    listConfig: {
	            		columns : _getTableColumns(),
	            		canShowDetils : true,
	            		smallColumns : 1
	            	}
	            };
	            nlCardsSrv.initCards($scope.cards);
				_getDataFromServer(resolve);
			});
		});
	}


	nlRouter.initContoller($scope, '', _onPageEnter);

	function _getToolbar() {
		return [{
			title : 'Publish new training',
			icon : 'ion-android-add-circle',
			onClick : _publishNewTraining
		}];
	}

	function _getTableColumns() {
		return [{
			attr : 'title',
			name : 'Training',
			type : 'text',
			showInSmallScreen : true,
			cls : ''
		}, {
			attr : 'start_date',
			name : 'From',
			type : 'date',
			showInSmallScreen : false,
			cls : 'fsmall1'
		}, {
			attr : 'end_date',
			name : 'Till',
			type : 'date',
			showInSmallScreen : false,
			cls : 'fsmall1'
		}];
	}

    function _fetchMore() {
        _getDataFromServer(null, true);
    }

    var _pageFetcher = nlServerApi.getPageFetcher();
	function _getDataFromServer(resolve, fetchMore) {
        if (!fetchMore) {
            nlCardsSrv.updateCards($scope.cards, {cardlist: []});
        }
        var params = {};
        _pageFetcher.fetchPage(nlServerApi.getTrainingList, params, fetchMore, function(results) {
            if (!results) {
                if (resolve) resolve(false);
                return;
            }
			_updateTrainingCards(results);
            nlCardsSrv.updateCards($scope.cards, 
                {canFetchMore: _pageFetcher.canFetchMore()});
            if (resolve) resolve(true);
		});
	}

	function _updateTrainingCards(trainingList) {
		for (var i = 0; i < trainingList.length; i++) {
			var card = _createCard(trainingList[i]);
			$scope.cards.cardlist.push(card);
		}
	}

	function _splitMultilineString(desc) {
		desc = desc.split('\n');
		var ret = '';
		for (var i = 0; i < desc.length; i++) {
			ret += nl.fmt2('<div class="padding1-mid-v">{}</div>', desc[i]);
		}
		return ret;
	}

	function _createCard(item) {
		trainingListDict[item.id] = item;
		item.descMulti = _splitMultilineString(item.desc);
		var canShowEdit = _userInfo.userid == item.publisher;
		var card = {
			id : item.id,
			canShowDelete: _canShowDelete,
            canShowEdit: canShowEdit,
			training : item,
			title : item.name,
			module : {
				lessonId : item.moduleid,
				title : item.modulename,
				icon : item.moduleicon
			},
			start_date : item.start,
			end_date : item.end,
			description : item.desc,
			children : [],
			details : {},
			links : [],
			listDetails : '<nl-training-details card="card"></nl-training-details>'
		};
		card.training.created = item.created;
		card.training.updated = item.updated;
		return card;
	}

	function _publishNewTraining() {
		_editTrainingModule(null, null);
	}


    $scope.onCardInternalUrlClicked = function(card, internalUrl) {
        $scope.onCardLinkClicked(card, internalUrl);
    };
    
    $scope.onCardLinkClicked = function(card, internalUrl) {
        if (internalUrl == 'training_assign' || internalUrl =='training_report') {
            _trainingReportView(card, internalUrl);
        } else if (internalUrl == 'training_edit') {
            _editTrainingModule(card, card.id);
        } else if (internalUrl == 'training_delete') {
            _deleteTrainingModule(card, card.id);
        } else if (internalUrl === 'fetch_more') {
            _fetchMore();
        }
    };

    var _reportFetcher = nlServerApi.getPageFetcher({defMax: 500, blockTillDone: true});
	function _trainingReportView(card, linkid) {
		var data = {trainingid: card.id};
        var fetchMore = false;
        var reports = {};
        _reportFetcher.fetchBatchOfPages(nlServerApi.getTrainingReportList, 
            data, fetchMore, function(results, batchDone, promiseHolder) {
            if (!results) return;
            _updateReportsDict(results, reports);
            if(batchDone) _gotNominatedList(card, linkid, reports);
        }, null);
    }

	function _updateReportsDict(results, reports) {
		for (var i = 0; i < results.length; i++) {
            var user = nlGroupInfo.getUserObj(''+results[i].student);
            if (!user) continue;
			var rep = _getNominationInfo(results[i], user);
			var oldRep = reports[rep.student] || null;
			if (!oldRep) {
				reports[rep.student] = rep;
				continue;
			}
			if (rep.updated < oldRep.updated) continue;
			reports[rep.student] = rep;
		}
	}	

	function _getNominationInfo(report, user) {
		return {
			student : report.student,
			repid : report.id,
			name : nlGroupInfo.formatUserNameFromObj(user),
			completed : report.completed,
			updated : nl.fmt.json2Date(report.updated),
			orgunit : user.org_unit
		};
	}

	function _gotNominatedList(card, linkid, reports){
		if(linkid == 'training_report') _checkBeforeShowNominations(card, reports);
		if(linkid == 'training_assign') _assignTrainingModule(card, reports);
	}

	function _checkBeforeShowNominations(card, reports){
		var alertDlg = {
			title : nl.t('Alert message'),
			template : nl.t('There are no nominated users for this training module.')
		};

		if (Object.keys(reports).length == 0) return nlDlg.popupAlert(alertDlg);
		_showNominatedUserList(card, reports);
	}

    function _deleteTrainingModule(card, id) {
        var template = nl.t('Once deleted, you will not be able to recover this training. Are you sure you want to delete this training?');
        nlDlg.popupConfirm({title: 'Please confirm', template: template,
            okText : nl.t('Delete')}).then(function(res) {
            if (!res) return;
            nlDlg.showLoadingScreen();
            nlServerApi.trainingDelete(id).then(function(statusInfo) {
                nlDlg.hideLoadingScreen();
                var pos = _getCardPosition(card.id);
                $scope.cards.cardlist.splice(pos, 1);
            });
            nlCardsSrv.updateCards($scope.cards);
        });
    }
    
	function _editTrainingModule(card, id) {
		var _showTrainingEditDlg = nlDlg.create($scope);
		_showTrainingEditDlg.setCssClass('nl-height-max nl-width-max');
		_showTrainingEditDlg.scope.error = {};
		_showTrainingEditDlg.scope.data = {};
		_showTrainingEditDlg.scope.dlgTitle = card ? nl.t('Edit training module') : nl.t('Create new training');
		_showTrainingEditDlg.scope.data = (card !== null) ? card : {
			title : '',
			description : '',
			start_date : '',
			end_date : ''
		};
		_showTrainingEditDlg.scope.data.module = card ? card.module || '' : '';
		_showTrainingEditDlg.scope.userinfo = _userInfo;
		var button = {text : id ? nl.t('Update'): nl.t('Create'), onTap : function(e) {
			_onModuleEdit(e, $scope, _showTrainingEditDlg.scope, id ? card : null, id || null);
		}};
		var cancelButton = {text: nl.t('Cancel')};
		_showTrainingEditDlg.show('view_controllers/training_list/training_edit_dlg.html', [button], cancelButton);
	}

	function _onModuleEdit(e, $scope, dlgScope, card, id) {
		if (!_validateInputs(dlgScope)) {
			if (e)
				e.preventDefault();
			return null;
		}

		var serverFunction = (id !== null) ? nlServerApi.trainingModify : nlServerApi.trainingCreate;

		var data = {
			name : dlgScope.data.title,
			desc : dlgScope.data.description,
			nomination : "self",
			type : "external",
			id : (id !== null) ? dlgScope.data.id : 0,
			moduleid : dlgScope.data.module.lessonId,
			modulename : dlgScope.data.module.title,
			moduleicon : dlgScope.data.module.icon,
			start : nl.fmt.json2Date(new Date(dlgScope.data.start_date), 'second'),
			end : nl.fmt.json2Date(new Date(dlgScope.data.end_date), 'second')	
		};
		nlDlg.showLoadingScreen();
		serverFunction(data).then(function(module) {
			nlDlg.hideLoadingScreen();
			_onModifyDone(module, $scope, id);
		});
	}

	function _onModifyDone(card, $scope, id) {
		card = _createCard(card);
		card['showDetails'] = true;
		for(var i in $scope.cards.cardlist){
			$scope.cards.cardlist[i].showDetails = false;
		}
		if (id !== null) {
			var pos = _getCardPosition(card.id);
			$scope.cards.cardlist.splice(pos, 1);
		}
		$scope.cards.cardlist.splice(0, 0, card);
        nlCardsSrv.updateCards($scope.cards);
	}

	function _getCardPosition(trainigId) {
		for (var i in $scope.cards.cardlist) {
			var card = $scope.cards.cardlist[i];
			if (card.id === trainigId)
				return i;
		}
		nl.log.error('Cannot find modified card', courseId);
		return 0;
	}

	function _validateInputs(scope) {
		scope.error = {};
		if (!scope.data.title)
			return _validateFail(scope, 'title', 'Name is mandatory');
		if (!scope.data.module)
			return _validateFail(scope, 'module', 'Please choose a feedback form or a learning module');
		if (!scope.data.start_date)
			return _validateFail(scope, 'start_date', 'Start date is mandatory');
		if (!scope.data.end_date)
			return _validateFail(scope, 'end_date', 'End date is mandatory');
		return true;
	}

	function _validateFail(scope, attr, errMsg) {
		return nlDlg.setFieldError(scope, attr, nl.t(errMsg));
	}

	function _showNominatedUserList(card, userDict) {
        var _showNominatedUserDlg = nlDlg.create($scope);
        _showNominatedUserDlg.setCssClass('nl-height-max nl-width-max');
        _showNominatedUserDlg.scope.data = {};
        var sd = _showNominatedUserDlg.scope.data;
        sd.card = card;
        _getSortedList(userDict, sd);
        sd.headerCol =[{attr : 'name', name : nl.t('Username')},
            {attr : 'orgunit', name : nl.t('Organization')},
        	{attr : 'completed', name : nl.t('Status')}];
        sd.title = nl.t('Nominated users');
        sd.toggleSelectAll = function() {
            sd.selectAll = !sd.selectAll;
            sd.selectedCnt = 0;
            for(var i=0; i<sd.userList.length; i++) {
                sd.userList[i].selected = sd.selectAll;
                if (sd.selectAll && !sd.userList[i].completed) sd.selectedCnt++;
            }
        };
        sd.toggleSelect = function(pos) {
            var user = sd.userList[pos];
            user.selected = !user.selected;
            if (user.selected) sd.selectedCnt++;
            else sd.selectedCnt--;
        };
        
        var markAsDone = {text: nl.t('Mark as completed'), onTap: function(e) {
            _confirmBeforeMarkAsDone(e, sd.userList);
        }};
        var cancelButton = {text : nl.t('Close')};
        _showNominatedUserDlg.show('view_controllers/training_list/nominated_user_dlg.html', 
            [markAsDone], cancelButton);
	}

	function _getSortedList(userDict, sd) {
		var ret = [];
        sd.selectedCnt = 0;
		sd.completedCnt = 0;
		for (var key in userDict) {
		    var report = userDict[key];
		    if (report.completed) sd.completedCnt++;
		    report.selected = false;
		    ret.push(report);
		}
		sd.userList = ret.sort(function(a, b) {
			if (a.completed != b.completed) return a.completed ? -1 : 1;
			if (a.orgunit != b.orgunit) return a.orgunit > b.orgunit ? 1 : -1;
			if (a.name != b.name) return a.name > b.name ? 1 : -1;
			return 0;
		});
	};
	
	function _confirmBeforeMarkAsDone(e, userList) {
        var users = [];
        for(var i=0; i<userList.length; i++) {
            var user = userList[i];
            if (!user.completed && user.selected) users.push(user);
        }
        if (users.length == 0) {
            nlDlg.popupAlert({title: 'Please select', template: 'Please select one or more items to mark as completed.'});
            if (e) e.preventDefault();
            return;
        }
        var dlg = nlDlg.create($scope);
        //dlg.setCssClass('nl-height-max nl-width-max');
        dlg.scope.users = users;
        var markAsDone = {text: nl.t('Mark as completed'), onTap: function(e) {
            nlDlg.showLoadingScreen();
            _markAsDone(users, 0);
        }};
        var cancelButton = {text : nl.t('Cancel')};
        nl.timeout(function() {
            // Showing this dialog has to be done in next angular cycle to avoid
            // backdrop becoming invisible
            dlg.show('view_controllers/training_list/confirm_completion_dlg.html', 
                [markAsDone], cancelButton);
        });
	}

    var BATCH_SIZE = 50;
    function _markAsDone(users, startPos) {
        if (startPos >= users.length) {
            nlDlg.hideLoadingScreen();
            nlDlg.popupStatus(nl.fmt2('{} item(s) marked as completed.', users.length));
            return;
        }
        nlDlg.popupStatus(nl.fmt2('{} of {} item(s) marked as completed.', startPos, users.length), false);
        var endPos = startPos+BATCH_SIZE;
        if (endPos > users.length) endPos = users.length;
        var repids = [];
        for(var i=startPos; i<endPos; i++) {
            repids.push(users[i].repid);
        }
        nlServerApi.assignmentCloseReports(repids).then(function(resp) {
            if (resp.fail > 0) {
                nlDlg.popdownStatus(0);
                nlDlg.popupAlert({title: 'Error', template: 
                    'Server encountered some errors while processing the request'});
                    return;
            }
            _markAsDone(users, startPos + resp.processed);
        });
    }
    
	function _getRemarks(training) {
		var d1 = nl.fmt.fmtDateDelta(training.start);
		var d2 = nl.fmt.fmtDateDelta(training.end);
		return nl.fmt2('Open from {} till {} - {}', d1, d2, training.desc);
	}

	function _assignTrainingModule(trainingModule, nominations) {
		var trainingInfo = {
			type : 'lesson',
			id : trainingModule.training.moduleid,
			trainingId : trainingModule.id,
			trainingName : trainingModule.title,
			remarks : _getRemarks(trainingModule.training),
			returnBackAfterSend : true,

			dlgTitle : nl.t('Nominate users for training: {}', trainingModule.title),

			esttime : '',
			starttime : '',
			endtime : '',

			title : trainingModule.title,
			icon : trainingModule.training.moduleicon,
			description : trainingModule.description,
			authorName : _userInfo.displayname,

			hideTimes : true,
			selectedUsers : nominations,
			training : true
		};
		nlSendAssignmentSrv.show(_scope, trainingInfo).then(function(e) {
		});
	};

	function _getUserDict(list) {
		var userDict = {};
		for (var i = 0; i < list.length; i++) {
			var user = list[i];
			userDict[user.id] = user.name;
		}
		return userDict;
	}
}];

var TrainingDetailsDirective = ['nl', 'nlDlg',
function(nl, nlDlg) {
	return {
		restrict : 'E',
		transclude : true,
		templateUrl : 'view_controllers/training_list/training_details.html',
		scope : {
			card : '='
		},
		link : function($scope, iElem, iAttrs) {
			$scope.onCardInternalUrlClicked = function(card, internalUrl) {
				$scope.$parent.onCardInternalUrlClicked(card, internalUrl);
			};
		}
	};
}];

module_init();
})();

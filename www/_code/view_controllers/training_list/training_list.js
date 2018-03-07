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
var TrainingListCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi', 'nlSendAssignmentSrv', 'nlGroupInfo', 'nlTreeSelect',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, nlSendAssignmentSrv, nlGroupInfo, nlTreeSelect) {

	var _userInfo = null;
	var trainingListDict = {};
	var _scope = null;
    var _canShowDelete = false;
	var _groupInfo = null;
	var _trainingkind = null; 	
	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		trainingListDict = {};
		return nl.q(function(resolve, reject) {
            nlGroupInfo.init().then(function() {
                nlGroupInfo.update();
                _groupInfo = nlGroupInfo.get();
				nl.pginfo.pageTitle = nl.t('Offline training batches');
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
			title : 'Create a new training batch',
			icon : 'ion-android-add-circle',
			onClick : _createNewTraining
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
			grade: item.grade,
			subject: item.subject,
			perParticipantCost: item.perParticipantCost,
			module : {
				lessonId : item.moduleid,
				title : item.modulename,
				icon : item.moduleicon
			},
			start_date : item.start,
			end_date : item.end,
			description : item.desc,
			sessions: item.sessions,
			ctype: item.ctype,
			training_kind: item.training_kind,
			kindName: item.kindName,
			kindDesc: item.kindDesc,
			children : [],
			details : {},
			links : [],
			listDetails : '<nl-training-details card="card"></nl-training-details>'
		};
		card.training.created = item.created;
		card.training.updated = item.updated;
		return card;
	}

	function _createNewTraining() {
		nlServerApi.getTrainingkindList().then(function(result) {
			_trainingkind = result.resultset;
			_createNewTrainingModule(null, 'create_batch');			
		});
	}


    $scope.onCardInternalUrlClicked = function(card, internalUrl) {
        $scope.onCardLinkClicked(card, internalUrl);
    };
    
    $scope.onCardLinkClicked = function(card, internalUrl) {
        if (internalUrl == 'training_assign' || internalUrl =='training_report') {
            _trainingReportView(card, internalUrl);
        } else if (internalUrl == 'training_edit') {
            _createNewTrainingModule(card, 'edit_batch');
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
    
    function _createNewTrainingModule(card, mode) {
    	var _createOrEditBatchTraining = nlDlg.create($scope);
		_createOrEditBatchTraining.setCssClass('nl-height-max nl-width-max');
		_createOrEditBatchTraining.scope.dlgTitle = mode == 'create_batch' ? nl.t('Create a new training batch') : nl.t('Update training batch');
		_initBatchTrainingDlg(_createOrEditBatchTraining.scope, card, mode);
		_showBatchTrainingDlg(_createOrEditBatchTraining);		
    };

	function _initBatchTrainingDlg(scope, card, mode, showDropDown) {
		var card = card;
		scope.error = {};
		scope.mode = mode;
		scope.showDropDown = showDropDown;
		scope.data = {};
		scope.help = _getTraininghelp();
		scope.options = {trainingkind: _getTrainingkind(_trainingkind)};

		if(mode == 'edit_batch') {
			_updateView();
		}
		
		scope.clickOnCreateNewTraining = function() {
			_createTrainingkindModule(scope);
		};

		scope.onFieldChange = function(fieldId) {
			if(fieldId == 'trainingkind') {
				card = scope.data.trainingkind;
				_updateView();
			}
		};
		
		function _updateView() {
			scope.trainigKindSelected = true;
			scope.data = card;
			scope.data.trainingkind = card;
			scope.data.module = card.module || '';
			scope.help = _getTraininghelp();			
		}
	}
		
	function _showBatchTrainingDlg(dlg){
		var button = {text : dlg.scope.mode == 'create_batch' ? nl.t('Create'): nl.t('Update'), onTap : function(e) {
			_onModuleEdit(e, $scope, dlg.scope, dlg.scope.data, dlg.scope.mode);
		}};
		var cancelButton = {text: nl.t('Cancel')};
		dlg.show('view_controllers/training_list/training_batch_dlg.html', [button], cancelButton);
	}		
	
    function _getTrainingkind(training) {
    	if(training.length == 0) return [];
    	var ret = [];
    	for(var i=0; i<training.length; i++) {
			var item = training[i];
			var card = {id: item.id, training_kind: item.id, name:item.kindName,  title: item.title, grade: item.grade, subject: item.subject,
						module: {lessonId: item.moduleid, title: item.modulename, icon: item.moduleicon }, desc: item.desc,  
						kindName: item.kindName, kindDesc: item.kindDesc, sessions: item.sessions, perParticipantCost: item.perParticipantCost};
    		ret.push(card);
    	}
    	return ret;
    }

	function _createTrainingkindModule(scope) {
		var _gradeInfo = {};
		var _subjectInfo = {};
		var _dlg = nlDlg.create($scope);
		_dlg.setCssClass('nl-height-max nl-width-max');
		_dlg.scope.error = {};
		_dlg.scope.data = {};
		_dlg.scope.help = _getTraininghelp();
		_dlg.scope.dlgTitle = nl.t('Create a training');
		_dlg.scope.data = {
							kindName : '',
							kindDesc : '',
							perParticipantCost: ''
						  };

		_dlg.scope.data.gradelabel = _groupInfo.props.gradelabel;
		_dlg.scope.data.subjectlabel = _groupInfo.props.subjectlabel;
		_dlg.scope.data.sessions = [{name: 1, duration: 30}];

        _gradeInfo = {data: nlTreeSelect.strArrayToTreeArray(_groupInfo.props.grades || [])};
        nlTreeSelect.updateSelectionTree(_gradeInfo, {});
        _gradeInfo.treeIsShown = false;
        _gradeInfo.multiSelect = false;
		_gradeInfo.fieldmodelid = 'grade';
        
        _subjectInfo = {data: nlTreeSelect.strArrayToTreeArray(_groupInfo.props.subjects || [])};
        nlTreeSelect.updateSelectionTree(_subjectInfo, {});
        _subjectInfo.treeIsShown = false;
        _subjectInfo.multiSelect = false;
		_subjectInfo.fieldmodelid = 'subject';

		_dlg.scope.options = {grade: _gradeInfo, subject: _subjectInfo};

		_dlg.scope.data.module = '';
		_dlg.scope.userinfo = _userInfo;
		_dlg.scope.onClickOnEdit = function(session) {
			var sessions = _dlg.scope.data.sessions;
			for(var i=0; i<sessions.length; i++) {
				if(sessions[i].id == session.id) {
					_dlg.scope.data.sessions.splice(i, 1);
				}
			}
			_dlg.scope.data.session = session;
		};

		_dlg.scope.onClickOnAddSession = function() {
			_dlg.scope.data.sessions.push({name: '', duration: ''});
		};

		_dlg.scope.onClickOnDeleteSession = function(session) {
			var sessions = _dlg.scope.data.sessions;
			for(var i=0; i<sessions.length; i++) {
				if(sessions[i].name == session.name){
					_dlg.scope.data.sessions.splice(i, 1);
				}
			}
		};
		var button = {text : nl.t('Create'), onTap : function(e) {
			_onTrainingkindEdit(e, $scope, _dlg.scope, null, _gradeInfo, _subjectInfo, scope);
		}};
		
		var cancelButton = {text: nl.t('Cancel')};
		_dlg.show('view_controllers/training_list/trainingkind_create_dlg.html', [button], cancelButton);
	}

	function _onTrainingkindEdit(e, $scope, dlgScope, card, _gradeInfo, _subjectInfo, scope) {
		if (!_validateTrainingkindInputs(dlgScope, _gradeInfo, _subjectInfo)) {
			if (e)
				e.preventDefault();
			return null;
		}

		var info = {
				kindName : dlgScope.data.kindName,
				kindDesc : dlgScope.data.kindDesc,
				ctype: 'CTYPE_MODULE',
				moduleid : dlgScope.data.module.lessonId,
				modulename : dlgScope.data.module.title,
				moduleicon : dlgScope.data.module.icon,
				grade: Object.keys(nlTreeSelect.getSelectedIds(_gradeInfo))[0],
				subject: Object.keys(nlTreeSelect.getSelectedIds(_subjectInfo))[0],
				sessions : dlgScope.data.sessions,
				perParticipantCost: dlgScope.data.perParticipantCost,
		};
		var data = {info: angular.toJson(info)};
		nlDlg.showLoadingScreen();
		nlServerApi.createTrainingkind(data).then(function(result) {
			nlDlg.hideLoadingScreen();
			_trainingkind.push(result);
			var ret = [];
			ret.push(result);
			var card = _getTrainingkind(ret);
			_initBatchTrainingDlg(scope, card[0], 'edit_batch');
		});		
	}
	
	function _onModuleEdit(e, $scope, dlgScope, card, mode) {
		if (!_validateInputs(dlgScope)) {
			if (e)
				e.preventDefault();
			return null;
		}
		var serverFunction = (mode == 'edit_batch') ? nlServerApi.trainingModify : nlServerApi.trainingCreate;
		var info = {
				kindName : card.kindName,
				kindDesc : card.kindDesc,
				ctype: card.ctype || 'CTYPE_MODULE',
				moduleid : card.module.lessonId,
				modulename : card.module.title,
				moduleicon : card.module.icon,
				grade: card.grade,
				subject: card.subject,
				sessions : card.sessions,
				perParticipantCost: card.perParticipantCost,
				name : dlgScope.data.title,
				desc : dlgScope.data.description || ''
		};

		var data = {
			name : dlgScope.data.title,
			desc : dlgScope.data.description || '',
			start : nl.fmt.json2Date(new Date(dlgScope.data.start_date), 'second'),
			end : nl.fmt.json2Date(new Date(dlgScope.data.end_date), 'second'),
			info: angular.toJson(info),
			moduleid: card.module.lessonId,
			training_kind: card.training_kind,
			id : (mode == 'edit_batch') ? card.id : 0
		};
		nlDlg.showLoadingScreen();
		serverFunction(data).then(function(module) {
			nlDlg.hideLoadingScreen();
			_onModifyDone(module, $scope, mode == 'create_batch' ? null : module.id);
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
		nl.log.error('Cannot find modified card', trainigId);
		return 0;
	}

	function _getTraininghelp() {
		return {
			trainingkind: {name: nl.t('Training'), help: nl.t('Can select the training available from the dropdown'), isShown: true},			
			title: {name: nl.t('Batch title'), help: nl.t('Mandatory - enter a title for your training.')},
			start_date: {name: nl.t('From'), help: nl.t('Mandatory - select the start date for your training')},
			end_date: {name: nl.t('Till'), help: nl.t('Mandatory - select the end date for your training.')},
			module: {name: nl.t('Feedback form or module'), help: nl.t('Mandatory - Select the feedback form or the learning module for your training by clicking on the search icon.')},
			description: {name: nl.t('Batch description'), help: nl.t('Provide a short description which will help others in the group to understand the purpose of this training.')},
			grade: {name: _groupInfo.props.gradelabel, help: nl.t('Please select the {}', _groupInfo.props.gradelabel)},
			subject: {name: _groupInfo.props.subjectlabel, help: nl.t('Please select the {}', _groupInfo.props.subjectlabel)},
			icon: {name: nl.t('Icon'), help: nl.t('Please select the icon')},
			sessions: {name: nl.t('Sessions'), help: nl.t('Configure the sessions and durations')},
			kindName: {name: nl.t('Training name'), help: nl.t('This is the training name')},
			kindDesc: {name: nl.t('Training description'), help:('Short description provided on training')},
			perParticipantCost: {name: nl.t('Per participant cost'), help: nl.t('Configure the per participant cost')}
		};
	};

	function _validateTrainingkindInputs(scope, _gradeInfo, _subjectInfo) {
		scope.error = {};
		if (!scope.data.kindName)
			return _validateFail(scope, 'title', 'Name is mandatory');
		if (Object.keys(nlTreeSelect.getSelectedIds(_gradeInfo)).length == 0)
			return _validateFail(scope, 'grade', nl.t('Please choose a {}', _groupInfo.props.gradelabel));
		if (Object.keys(nlTreeSelect.getSelectedIds(_subjectInfo)).length == 0)
			return _validateFail(scope, 'subject', nl.t('Please choose a {}', _groupInfo.props.subjectlabel));
		if (!scope.data.module)
			return _validateFail(scope, 'module', 'Please choose a feedback form or a learning module');
		if (!scope.data.perParticipantCost)
			return _validateFail(scope, 'perParticipantCost', 'Mandatory - Please choose a per participant cost');	
		if (scope.data.sessions.length == 0) 
			return _validateFail(scope, 'sessions', 'Mandatory - Please add the sessions in the training');			
		return true;
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
        var repinfos = [];
        for(var i=startPos; i<endPos; i++) {
        	var repinfo = {repid: users[i].repid, completed: true, trainingStatus: {attended: true, sessions_attended: {}}};
            repinfos.push(repinfo);
        }
        nlServerApi.assignmentCloseReports(repinfos).then(function(resp) {
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
		var trainingBatch = trainingModule.training;
		var trainingData = angular.copy(trainingBatch);
		trainingData.trainingStatus = {};

		var assignInfo = {
			// Stuff needed for functionality of client side
			assigntype : 'training',
			dontShowUsers : nominations,

			// Stuff needed for server side
			assignid : trainingBatch.id,
			id : trainingBatch.contentid || 0, //trainingModule.training.moduleid,
			remarks : _getRemarks(trainingBatch),
			trainingData : angular.toJson(trainingData),

			// Stuff needed in GUI side
			title : trainingBatch.name,
			authorName : _userInfo.displayname,
			description : trainingBatch.desc,
			dlgTitle : nl.t('Nominate users for training: {}', trainingBatch.name)			
		};
		nlSendAssignmentSrv.show(_scope, assignInfo);
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

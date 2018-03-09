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
	var _scope = null;
    var _canShowDelete = false;
	var _groupInfo = null;
	var _trainingkinds = null;

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
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
			onClick : _createTrainingBatch
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

    $scope.onCardInternalUrlClicked = function(card, internalUrl) {
        $scope.onCardLinkClicked(card, internalUrl);
    };
    
    $scope.onCardLinkClicked = function(card, internalUrl) {
        if (internalUrl == 'training_assign' || internalUrl =='training_report') {
            _trainingReportView(card, internalUrl);
        } else if (internalUrl == 'training_edit') {
            _createOrEditTrainingBatch(card);
        } else if (internalUrl == 'training_delete') {
            _deleteTrainingModule(card, card.id);
        } else if (internalUrl === 'fetch_more') {
            _fetchMore();
        }
    };

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

	function _splitMultilineString(desc, desctype) {
		desc = desc.split('\n');
		var ret = nl.t('<div ng-class="resp2Col20"><b>{}: </b></div>', desctype);
		var descObj = '<div ng-class="resp2Col80">';
		for (var i = 0; i < desc.length; i++) {
			descObj += nl.fmt2('<div class="padding1-mid-v padding-left"><span>{}</span></div>',  desc[i]);
		}
		descObj += '</div>';
		return nl.fmt2('<div class="row row-wrap row-top padding0 margin0">{}{}</div>', ret, descObj);
	}

	function _createCard(item) {
		var card = item;
		card.training = angular.copy(item);
		card.descMultiBatch = _splitMultilineString(item.desc, 'Batch description');
		if(item.kindDesc) {
			card.descMultiKind = _splitMultilineString(item.kindDesc, 'Training description');
		}
		var canShowEdit = _userInfo.userid == item.publisher;
		card.canShowDelete =  _canShowDelete;
        card.canShowEdit = canShowEdit;
        card.title = item.kindName ? nl.t('{} : {}', item.kindName, item.name) : item.name;
        card.batchTitle = item.name;
		card.start_date = item.start;
		card.end_date = item.end;
		card.description = item.desc;
		card.children = [];
		card.details = {};
		card.links = [];
		card.listDetails = '<nl-training-details card="card"></nl-training-details>';
		return card;
	}

	//--------------------------------------------------------------------------------------------------
	function _initTrainingKinds() {
		if (_trainingkinds !== null) {
			return nl.q(function(resolve, reject) {
				resolve(true);
			});
		}
        nlDlg.showLoadingScreen();
		return nlServerApi.getTrainingkindList().then(function(result) {
            nlDlg.hideLoadingScreen();
			_updateTrainingKinds(result.resultset);
			return true;
		});
	}

	function _updateTrainingKinds(newKinds) {
		if (!_trainingkinds) _trainingkinds = [];
    	for(var i=0; i<newKinds.length; i++)
    		_trainingkinds.push(_updateTrainingKindObject(newKinds[i]));
		_trainingkinds.sort(function(a, b) {
			return a.kindName == b.kindName ? 0 : a.kindName > b.kindName;
		});
	}

	function _updateTrainingKindObject(item) {
		item.training_kind = item.id;
		item.name = item.kindName;
		return item;
	}
	
	function _createTrainingKind(batchDlgScope) {
		var _dlg = nlDlg.create($scope);
		_dlg.setCssClass('nl-height-max nl-width-max');
		_dlg.scope.error = {};
		_dlg.scope.help = batchDlgScope.help;
		_dlg.scope.dlgTitle = nl.t('Create a training');
		_dlg.scope.data = {kindName : '', kindDesc : '',
			gradelabel: _groupInfo.props.gradelabel,
			subjectlabel: _groupInfo.props.subjectlabel,
			sessions: [{name: 'Session 1', duration:{id: 60}}]};

        var _gradeInfo = {data: nlTreeSelect.strArrayToTreeArray(_groupInfo.props.grades || [])};
        nlTreeSelect.updateSelectionTree(_gradeInfo, {});
        _gradeInfo.treeIsShown = false;
        _gradeInfo.multiSelect = false;
		_gradeInfo.fieldmodelid = 'grade';
        
        var _subjectInfo = {data: nlTreeSelect.strArrayToTreeArray(_groupInfo.props.subjects || [])};
        nlTreeSelect.updateSelectionTree(_subjectInfo, {});
        _subjectInfo.treeIsShown = false;
        _subjectInfo.multiSelect = false;
		_subjectInfo.fieldmodelid = 'subject';

		_dlg.scope.options = {grade: _gradeInfo, subject: _subjectInfo, duration: _getDurationStats(true)};
		_dlg.scope.data.defDurationName = _getDurationStats(false);
		_dlg.scope.data.module = '';
		_dlg.scope.userinfo = _userInfo;

		_dlg.scope.onClickOnAddSession = function() {
			var name = nl.t('Session {}', _dlg.scope.data.sessions.length+1);
			_dlg.scope.data.sessions.push({name: name, duration: {id: 60}});
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
			_onTrainingKindCreate(e, $scope, _dlg.scope, null, _gradeInfo, _subjectInfo, batchDlgScope);
		}};
		
		var cancelButton = {text: nl.t('Cancel')};
		_dlg.show('view_controllers/training_list/trainingkind_create_dlg.html', [button], cancelButton);
	}

	function _onTrainingKindCreate(e, $scope, dlgScope, card, _gradeInfo, _subjectInfo, batchDlgScope) {
		if (!_validateTrainingkindInputs(dlgScope, _gradeInfo, _subjectInfo)) {
			if (e)
				e.preventDefault();
			return null;
		}

		var trainingSessions = [];
		for(var i=0; i<dlgScope.data.sessions.length; i++) {
			var item  = dlgScope.data.sessions[i];
			trainingSessions.push({name: item.name, duration: item.duration.id});
		}

		var info = {
				kindName : dlgScope.data.kindName,
				kindDesc : dlgScope.data.kindDesc,
				ctype: _nl.ctypes.CTYPE_MODULE,
				moduleid : dlgScope.data.module.lessonId,
				modulename : dlgScope.data.module.title,
				moduleicon : dlgScope.data.module.icon,
				grade: Object.keys(nlTreeSelect.getSelectedIds(_gradeInfo))[0],
				subject: Object.keys(nlTreeSelect.getSelectedIds(_subjectInfo))[0],
				sessions : trainingSessions,
				perParticipantCost: '',
		};
		var data = {info: angular.toJson(info)};
		nlDlg.showLoadingScreen();
		nlServerApi.createTrainingkind(data).then(function(result) {
			nlDlg.hideLoadingScreen();
			_updateTrainingKindObject(result);
			_updateTrainingKinds([result]);
			_onTrainingKindChange(batchDlgScope, result);
		});		
	}
	
	//--------------------------------------------------------------------------------------------------
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
    
	//--------------------------------------------------------------------------------------------------
	function _createTrainingBatch() {
		_initTrainingKinds().then(function(result) {
			_createOrEditTrainingBatch(null);			
		});
	}

    function _createOrEditTrainingBatch(batchCard) {
    	var batchDlg = nlDlg.create($scope);
		batchDlg.setCssClass('nl-height-max nl-width-max');
		batchDlg.scope.isAssignmentManage = _userInfo.permissions['assignment_manage'];
		batchDlg.scope.dlgTitle = batchCard ? nl.t('Update the training batch') : nl.t('Create a new training batch');
		_initTrainingBatchDlg(batchDlg.scope, batchCard);
		_showTrainingBatchDlg(batchDlg);		
    }

	function _initTrainingBatchDlg(scope, batchCard) {
		scope.isCreate = (batchCard == null);
		scope.error = {};
		scope.data = {};
		scope.help = _getTraininghelp();
		scope.options = {trainingkind: _trainingkinds};
			
		if(batchCard) _onTrainingKindChange(scope, batchCard);

		scope.onCreateTrainingKind = function() {
			_createTrainingKind(scope);
		};

		scope.onFieldChange = function(fieldId) {
			if(fieldId != 'trainingkind') return;
			_onTrainingKindChange(scope, scope.data.trainingkind);
		};
	}
		
	function _onTrainingKindChange(scope, batchOrKindItem) {
		scope.help.trainingkind.isShown = false;
		scope.trainigKindSelected = true;
		scope.data = batchOrKindItem;
		scope.data.trainingkind = batchOrKindItem;
		scope.data.modulename = batchOrKindItem.modulename || '';
		scope.data.defDurationName = _getDurationStats(false);
	}

	function _showTrainingBatchDlg(dlg){
		var button = {text : dlg.scope.isCreate ? nl.t('Create'): nl.t('Update'), onTap : function(e) {
			_onCreateOrEditBatch(e, $scope, dlg.scope);
		}};
		var cancelButton = {text: nl.t('Cancel')};
		dlg.show('view_controllers/training_list/training_batch_dlg.html', [button], cancelButton);
	}		
	
	function _getDurationStats(isDuration) {
		var ret = [];
		var retDict = {};
		var min = 0;
		var hours = 0;
		var i=1;
		while (i < 21) {
			if(i%2 == 1) {
				min += 30;
				var dict = {id: min, name: nl.t('{} {} 30 minutes', hours > 0 ? hours : '', hours > 0 ? 'hour' : '')};
				ret.push(dict);
				retDict[min] = dict;
			} else if(i%2 == 0){
				hours += 1;
				min += 30;
				var dict = {id: min, name: nl.t('{} {}', hours, hours == 1 ? 'hour' : 'hours')}; 
				ret.push(dict);
				retDict[min] = dict;
			}
		    i++;
		}
		if(isDuration) {
			return ret;
		} else {
			return retDict;
		}
	};
	
	function _onCreateOrEditBatch(e, $scope, dlgScope) {
		var card = dlgScope.data;
		if (!_validateInputs(dlgScope)) {
			if (e)
				e.preventDefault();
			return null;
		}
		var serverFunction = dlgScope.isCreate ? nlServerApi.trainingCreate : nlServerApi.trainingModify;
		var info = {
				kindName : card.kindName || '',
				kindDesc : card.kindDesc || '',
				ctype: card.ctype || _nl.ctypes.CTYPE_MODULE,
				moduleid : card.moduleid,
				modulename : card.modulename,
				moduleicon : card.moduleicon,
				grade: card.grade || '',
				subject: card.subject || '',
				sessions : card.sessions || [],
				perParticipantCost: dlgScope.data.perParticipantCost || '',
				name : dlgScope.data.batchTitle,
				desc : dlgScope.data.desc || ''
		};

		var data = {
			name : dlgScope.data.batchTitle,
			desc : dlgScope.data.desc|| '',
			start : nl.fmt.json2Date(new Date(dlgScope.data.start_date), 'second'),
			end : nl.fmt.json2Date(new Date(dlgScope.data.end_date), 'second'),
			info: angular.toJson(info),
			moduleid: card.moduleid,
			perParticipantCost: dlgScope.data.perParticipantCost || '',
			training_kind: card.training_kind || 0,
			id : dlgScope.isCreate ? 0 : card.id
		};
		nlDlg.showLoadingScreen();
		serverFunction(data).then(function(module) {
			nlDlg.hideLoadingScreen();
			_onModifyDone(module, $scope, dlgScope.isCreate ? null : module.id);
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
			trainingkind: {name: nl.t('Training'), help: nl.t('This shows available trainings. Select a training and create a training batch based on it.'), isShown: true},			
			batchTitle: {name: nl.t('Batch title'), help: nl.t('Mandatory - Name of the training batch.')},
			start_date: {name: nl.t('From'), help: nl.t('Mandatory - select the start date for your training batch')},
			end_date: {name: nl.t('Till'), help: nl.t('Mandatory - select the end date for your training batch.')},
			module: {name: nl.t('Feedback form or module'), help: nl.t('Mandatory - Select the feedback form or the learning module for your training by clicking on the search icon.')},
			modulename: {name: nl.t('Feedback form or module'), help: nl.t('Mandatory - Select the feedback form or the learning module for your training by clicking on the search icon.')},
			desc: {name: nl.t('Batch description'), help: nl.t('Provide a short description which will help others in the group to understand about this training batch.')},
			grade: {name: _groupInfo.props.gradelabel, help: nl.t('Mandatory - this will create the training based selected {} .', _groupInfo.props.gradelabel)},
			subject: {name: _groupInfo.props.subjectlabel, help: nl.t('Mandatory - this will create the training based selected {}', _groupInfo.props.subjectlabel)},
			sessions: {name: nl.t('Sessions'), help: nl.t('Configure the session and durations to create multiple sessions training')},
			kindName: {name: nl.t('Training name'), help: nl.t('Mandatory - this is the training name')},
			kindDesc: {name: nl.t('Training description'), help:('Provide a short description which will help others in the group to understand about this training')},
			perParticipantCost: {name: nl.t('Per participant cost'), help: nl.t('Configure the per participant cost')}
		};
	};

	function _validateTrainingkindInputs(scope, _gradeInfo, _subjectInfo) {
		scope.error = {};
		if (!scope.data.kindName)
			return _validateFail(scope, 'kindName', 'Training name is mandatory');
		if (Object.keys(nlTreeSelect.getSelectedIds(_gradeInfo)).length == 0)
			return _validateFail(scope, 'grade', nl.t('Please choose a {}', _groupInfo.props.gradelabel));
		if (Object.keys(nlTreeSelect.getSelectedIds(_subjectInfo)).length == 0)
			return _validateFail(scope, 'subject', nl.t('Please choose a {}', _groupInfo.props.subjectlabel));
		if (!scope.data.module)
			return _validateFail(scope, 'module', 'Please choose a feedback form or a learning module');
		return true;
	}

	function _validateInputs(scope) {
		scope.error = {};
		if (!scope.data.batchTitle)
			return _validateFail(scope, 'batchTitle', 'Name is mandatory');
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
        _showNominatedUserDlg.scope.options = {};
        var sd = _showNominatedUserDlg.scope.data;
        sd.card = card;
        if(card.sessions && card.sessions.length != 0) {
        	_showNominatedUserDlg.scope.options.sessions = _getSessions(card.sessions);
        }
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

	function _getSessions(sessions) {
		var ret = [];
		for(var i=0; i<sessions.length; i++) {
			ret.push({id: i, name: nl.t('{}', sessions[i].name), duration: sessions[i].duration});
		};
		return ret;
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
        	var repinfo = {repid: users[i].repid, overallStatus: 'completed', sessions: {}};
            repinfos.push(repinfo);
        }
        nlServerApi.trainingUpdateAttendance(repinfos).then(function(resp) {
            _markAsDone(users, startPos + resp.processed);
        }, function() {
            nlDlg.popdownStatus(0);
        });
    }
    
	function _getRemarks(training) {
		var d1 = nl.fmt.fmtDateDelta(training.start);
		var d2 = nl.fmt.fmtDateDelta(training.end);
		return nl.fmt2('Open from {} till {} - {}', d1, d2, training.desc);
	}

	function _assignTrainingModule(trainingModule, nominations) {
		var trainingBatch = trainingModule.training;

		var assignInfo = {
			// Stuff needed for functionality of client side
			assigntype : 'training',
			dontShowUsers : nominations,

			// Stuff needed for server side
			assignid : trainingBatch.id,
			id : trainingBatch.contentid || 0, //trainingModule.training.moduleid,
			remarks : _getRemarks(trainingBatch),

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

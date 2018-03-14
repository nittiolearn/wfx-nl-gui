(function() {

//-------------------------------------------------------------------------------------------------
// training_list.js:
// training module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.training_list', [])
	.config(configFn)
	.directive('nlTrainingDetails', TrainingDetailsDirective)
	.controller('nl.TrainingListCtrl', TrainingListCtrl);
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
var TrainingListCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi', 'nlSendAssignmentSrv', 'nlGroupInfo', 'nlTreeSelect', 'nlTrainingReport',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, nlSendAssignmentSrv, nlGroupInfo, nlTreeSelect, nlTrainingReport) {

	var _userInfo = null;
	var _scope = null;
    var _canShowDelete = false;
    var _canManage = false;
	var _groupInfo = null;
	var _trainingkinds = null;
	var _allrecords = false;

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {
            nlGroupInfo.init().then(function() {
                nlGroupInfo.update();
                _groupInfo = nlGroupInfo.get();
                nlTrainingReport.init(_userInfo, nlGroupInfo);
				nl.pginfo.pageTitle = nl.t('Offline training batches');
				_scope = $scope;
	            var params = nl.location.search();
	            _canShowDelete = ('debug' in params) &&
	                nlRouter.isPermitted(userInfo, 'admin_user');
                _canManage = nlRouter.isPermitted(userInfo, 'assignment_manage');
	            _allrecords = params.type == 'all' ? true : false;
	            if (_allrecords && !_canManage) {
	            	nlDlg.popupStatus('Not permitted');
	            	resolve(false);
	            	return;
	            }
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
		}, {
            title : 'Export report',
            icon : 'ion-ios-cloud-download',
            id: 'export',
            onClick : _onExport
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
        var params = {allrecords: _allrecords};
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

	function _createCard(item) {
		var card = item;

		card.training = angular.copy(item);
		card.descMultiBatch = nl.fmt.multiLineHtml(item.desc);
		if(item.kindDesc) {
			card.descMultiKind = nl.fmt.multiLineHtml(item.kindDesc);
		}
		var canShowEdit = _userInfo.userid == item.publisher;
		card.canShowDelete =  _canShowDelete;
        card.canShowEdit = canShowEdit;
        card.title = item.kindName ? nl.t('{} : {}', item.kindName, item.name) : item.name;
        card.batchTitle = item.name;
		card.start_date = item.start;
		card.end_date = item.end;
		card.description = item.desc;
		card.gradelabel = _groupInfo.props.gradelabel;
		card.subjectlabel = _groupInfo.props.subjectlabel;
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
		item.descMultiKind = nl.fmt.multiLineHtml(item.kindDesc);
		return item;
	}
	
	function _createOrEditTrainingKind(batchDlgScope, card) {
		var _dlg = nlDlg.create($scope);
		_dlg.setCssClass('nl-height-max nl-width-max');
		_dlg.scope.error = {};
		_dlg.scope.help = batchDlgScope.help;
		_dlg.scope.dlgTitle = card ? nl.t('Update training') : nl.t('Create a training');
		var defaultData = {kindName : '', kindDesc : '',
			gradelabel: _groupInfo.props.gradelabel,
			subjectlabel: _groupInfo.props.subjectlabel,
			sessions: [{name: 'Session 1', duration:{id: 60}}]};
		_dlg.scope.data = card ? card : defaultData;
		_dlg.scope.data.origCard = angular.copy(card);
		_dlg.scope.data.module = '';
		var selectedGrade = {};
		var selectedSubject = {};
		if(card) {
			selectedGrade[card.grade] = true;
			selectedSubject[card.subject] = true;
			_dlg.scope.data.module = {lessonId: card.moduleid, title: card.modulename, icon: card.moduleicon};
			_dlg.scope.data.sessions = _getUpdatedSessions(card.sessions);
		}
        var _gradeInfo = {data: nlTreeSelect.strArrayToTreeArray(_groupInfo.props.grades || [])};
        nlTreeSelect.updateSelectionTree(_gradeInfo, selectedGrade);
        _gradeInfo.treeIsShown = false;
        _gradeInfo.multiSelect = false;
		_gradeInfo.fieldmodelid = 'grade';
        
        var _subjectInfo = {data: nlTreeSelect.strArrayToTreeArray(_groupInfo.props.subjects || [])};
        nlTreeSelect.updateSelectionTree(_subjectInfo, selectedSubject);
        _subjectInfo.treeIsShown = false;
        _subjectInfo.multiSelect = false;
		_subjectInfo.fieldmodelid = 'subject';

		_dlg.scope.options = {grade: _gradeInfo, subject: _subjectInfo, duration: _getDurationStats(true)};
		_dlg.scope.data.defDurationName = _getDurationStats(false);
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

		var button = {text : card ? nl.t('Update') : nl.t('Create'), onTap : function(e) {
			_onTrainingKindCreateOrEdit(e, $scope, _dlg.scope, card ? card : null, _gradeInfo, _subjectInfo, batchDlgScope);
		}};
		
		var cancelButton = {text: nl.t('Cancel'), onTap: function() {
			_dlg.scope.data.sessions = _dlg.scope.data.origCard.sessions;
			_dlg.scope.data.kindName = _dlg.scope.data.origCard.kindName;
		}};
		_dlg.show('view_controllers/training_list/trainingkind_create_dlg.html', [button], cancelButton);
	}

	function _getUpdatedSessions(sessions) {
		var ret = [];
		for(var i=0; i<sessions.length; i++) {
			ret.push({name: sessions[i].name, duration:{id: sessions[i].duration}});
		}
		return ret;
	}
	
	function _onTrainingKindCreateOrEdit(e, $scope, dlgScope, card, _gradeInfo, _subjectInfo, batchDlgScope) {
		if (!_validateTrainingkindInputs(dlgScope, _gradeInfo, _subjectInfo)) {
			if (e)
				e.preventDefault();
			return null;
		}
		var serverFunction = card ? nlServerApi.modifyTrainingkind : nlServerApi.createTrainingkind;
		var trainingSessions = [];
		for(var i=0; i<dlgScope.data.sessions.length; i++) {
			var item  = dlgScope.data.sessions[i];
			trainingSessions.push({name: item.name, duration: item.duration.id});
		}

		var info = {
				kindName : dlgScope.data.kindName,
				kindDesc : dlgScope.data.kindDesc,
				ctype: _nl.ctypes.CTYPE_MODULE,
				moduleid : dlgScope.data.module.lessonId || card.moduleid,
				modulename : dlgScope.data.module.title,
				moduleicon : dlgScope.data.module.icon,
				grade: Object.keys(nlTreeSelect.getSelectedIds(_gradeInfo))[0],
				subject: Object.keys(nlTreeSelect.getSelectedIds(_subjectInfo))[0],
				sessions : trainingSessions
		};
		var data = {info: angular.toJson(info), id : card ? card.training_kind : 0};
		nlDlg.showLoadingScreen();
		serverFunction(data).then(function(result) {
			nlDlg.hideLoadingScreen();
			if(card) {
				_onModifyTrainingKind(card, result, batchDlgScope);
			} else {
				_updateTrainingKindObject(result);
				_updateTrainingKinds([result]);
				_onTrainingKindChange(batchDlgScope, result);
			}
		});
	}

	function _onModifyTrainingKind(card, result, batchDlgScope) {
		if(_trainingkinds !== null) {
			for(var i=0; i<_trainingkinds.length; i++) {
				if(result.id == _trainingkinds[i].id) {
					_trainingkinds.splice(i, 1);
					break;
				}
			}
			_updateTrainingKinds([result]);
		}
		_updateTrainingKindObject(result);		
		for(var key in result) {
			card[key] = result[key];
		}
		_onCreateOrModifyTrainingkindDone(card, batchDlgScope);
	};
	
	function _onCreateOrModifyTrainingkindDone(result, batchDlgScope){
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
		var content = angular.fromJson(report.content);
		var sessions = content.trainingStatus.sessions;
		return {
			student : report.student,
			repid : report.id,
			name : nlGroupInfo.formatUserNameFromObj(user),
			completed : report.completed,
			updated : nl.fmt.json2Date(report.updated),
			orgunit : user.org_unit,
			content : content,
			sessions : sessions
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
		batchDlg.scope.isAssignmentManage = _canManage;
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
			_createOrEditTrainingKind(scope);
		};

		scope.onFieldChange = function(fieldId) {
			if(fieldId != 'trainingkind') return;
			_onTrainingKindChange(scope, scope.data.trainingkind, scope.data.showTrainingAttrs);
		};
		
		scope.onClickOnEditTrainingKind = function(fieldId) {
			_createOrEditTrainingKind(scope, scope.data.trainingkind);
		};
	}
		
	function _onTrainingKindChange(scope, batchOrKindItem, isShowDetails) {
		scope.help.trainingkind.isShown = false;
		scope.trainigKindSelected = true;
		scope.data = batchOrKindItem;
		scope.data.showTrainingAttrs = isShowDetails;
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
				costInfra: dlgScope.data.costInfra || '',
				costTrainer: dlgScope.data.costTrainer || '',
				costFood: dlgScope.data.costFood || '',
				costTravel: dlgScope.data.costTravel || '',
				costMisc: dlgScope.data.costMisc || '',
				name : dlgScope.data.batchTitle,
				desc : dlgScope.data.desc || '',
				trainername :  dlgScope.data.trainername || '',
				venue: dlgScope.data.venue || ''
		};

		var data = {
			name : dlgScope.data.batchTitle,
			desc : dlgScope.data.desc|| '',
			start : nl.fmt.json2Date(new Date(dlgScope.data.start_date), 'second'),
			end : nl.fmt.json2Date(new Date(dlgScope.data.end_date), 'second'),
			info: angular.toJson(info),
			moduleid: card.moduleid,
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
			costInfra: {name: nl.t('Infrastructure cost'), help: nl.t('Configure the infrastructure cost')},
			costTrainer: {name: nl.t('Trainer cost'), help: nl.t('Configure the trainer cost')},
			costFood: {name: nl.t('Stationary and food cost'), help: nl.t('Configure the stationary and food cost')},
			costTravel: {name: nl.t('Travel and Accomodation cost'), help: nl.t('Configure the travel and accomodation cost')},
			costMisc: {name: nl.t('Miscellaneous cost'), help: nl.t('Configure the miscellaneous cost')},
			trainername: {name: nl.t('Trainer name'), help: nl.t('Provide trainer name to this training')},
			venue: {name: nl.t('Venue'), help: nl.t('Configure venue of this training')}
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
        _showNominatedUserDlg.scope.options.sessions = [];
		_showNominatedUserDlg.scope.data.userDict = angular.copy(userDict);

        var sd = _showNominatedUserDlg.scope.data;
        sd.card = card;
        
        if(card.sessions && card.sessions.length != 0) {
        	_showNominatedUserDlg.scope.options.sessions = _formSessionsDropDown(card.sessions);
        	_showNominatedUserDlg.scope.data.sessions = _showNominatedUserDlg.scope.options.sessions[0];
        }
		_updateUserDict(_showNominatedUserDlg.scope);

        _getSortedList(userDict, sd, _showNominatedUserDlg.scope);
        sd.headerCol =[{attr : 'name', name : nl.t('Username')},
            {attr : 'orgunit', name : nl.t('Organization')},
        	{attr : 'completed', name : nl.t('Status')}];
        sd.title = nl.t('Nominated users');
        sd.toggleSelectAll = function() {
            sd.selectAll = !sd.selectAll;
            sd.selectedCnt = 0; 
            var sessions = sd.sessions || null;
            for(var i=0; i<sd.userList.length; i++) {
                sd.userList[i].selected = sd.selectAll;
	            if(sessions) {
	            	if(sd.userDict[sd.userList[i].id].sessions[sd.sessions.id] == 'completed') continue;
	                sd.userList[i].sessions[sd.sessions.id] =  sd.selectAll ? 'completed' : 'pending';
	                if(sd.selectAll) {
	                	sd.selectedCnt++;
	                }
	            } else {
	                if(sd.selectAll && !sd.userList[i].completed) sd.selectedCnt++;
	            }
            }
        };
        sd.toggleSelect = function(pos) {
            var user = sd.userList[pos];
            var sessions = _showNominatedUserDlg.scope.data.sessions || {};
            user.selected = !user.selected;
            if(Object.keys(sessions).length != 0) {
	    		user.sessions[sessions.id] = user.selected ? 'completed' : 'pending';
            }
            if (user.selected) sd.selectedCnt++;
            else sd.selectedCnt--;
        };
        
        _showNominatedUserDlg.scope.onFieldChange = function(fieldId) {
	        _getSortedList(userDict, sd, _showNominatedUserDlg.scope);
        };
        
        var markAsDone = {text: nl.t('Mark as completed'), onTap: function(e) {
            _confirmBeforeMarkAsDone(e, sd.userList, _showNominatedUserDlg.scope);
        }};
        var cancelButton = {text : nl.t('Close')};
        _showNominatedUserDlg.show('view_controllers/training_list/nominated_user_dlg.html', 
            [markAsDone], cancelButton);
	}

	function _updateUserDict(scope) {
		var userDict = scope.data.userDict;
		var completedCnts = {};
		for(var i in scope.options.sessions) completedCnts[scope.options.sessions[i].id] = 0;
		for(var key in userDict) {
			var user = userDict[key];
			for(var i=0; i<scope.options.sessions.length; i++) {
				var session = scope.options.sessions[i];
				var countValue = 1;
				if (user.sessions[session.id] == 'completed') {
					completedCnts[session.id] += 1;
				} 
			}
		}
		scope.data.userDict['completed'] = completedCnts;
	}
	
	function _formSessionsDropDown(sessions) {
		var ret = [];
		for(var i=0; i<sessions.length; i++) {
			ret.push({id: i, name: nl.t('{}', sessions[i].name), duration: sessions[i].duration});
		};
		return ret;
	}
	
	function _getSortedList(userDict, sd, scope) {
		var ret = [];
		sd.selectAll = false;
        sd.selectedCnt = 0;
		sd.completedCnt = 0;
		for (var key in userDict) {
		    var report = userDict[key];
		    report.id = key;
		    if (report.completed && !(sd.card.sessions && sd.card.sessions.length != 0)) sd.completedCnt++;
		    var trainingStats = report.content.trainingStatus;
		    var sessions = report.sessions || {};
		    report.sessions = sessions;
		    sd.alreadySelected = {};
		    if(sd.card.sessions && sd.card.sessions.length != 0) {
			    for (var i=0; i<scope.options.sessions.length; i++) {
			    	var id = scope.options.sessions[i].id;
			    	if(Object.keys(sessions).length == 0) 
			    		report.sessions[id] = 'pending';
			    	else
			    		report.sessions[id] = sessions[id] == 'completed' ? 'completed' : 'pending';
			    }
			    report.overallStatus = trainingStats.overallStatus;
		    }
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
	
	function _confirmBeforeMarkAsDone(e, userList, nominationDlgScope) {
        var users = [];
        for(var i=0; i<userList.length; i++) {
            var user = userList[i];
            if (nominationDlgScope.options.sessions.length == 0) {
	            if (!user.completed && user.selected) users.push(user);
            } else {
	        	var canAddElem = false;
	        	for(var j=0; j<nominationDlgScope.options.sessions.length; j++) {
	        		var sessionid = nominationDlgScope.options.sessions[j].id;
	            	if(nominationDlgScope.data.userDict[user.id].sessions[sessionid] == 'completed') continue;
	        		if(user.sessions[sessionid] == 'completed') canAddElem = true;
	        	}
	        	if(canAddElem) users.push(user);
	        }
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
            _markAsDone(users, 0, nominationDlgScope);
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
    function _markAsDone(users, startPos, nominationDlgScope) {
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
        	var repinfo = {repid: users[i].repid, overallStatus: _getOverAllStatus(nominationDlgScope, users[i]), sessions: users[i].sessions || {}};
            repinfos.push(repinfo);
        }
        nlServerApi.trainingUpdateAttendance({repinfos: repinfos}).then(function(resp) {
            _markAsDone(users, startPos + BATCH_SIZE, nominationDlgScope);
        }, function() {
            nlDlg.popdownStatus(0);
        });
    }
    
    function _getOverAllStatus(nominationDlgScope, user) {
    	var completedCnt = 0;
    	var pendingCnt = 0;
    	var trainingSessions = nominationDlgScope.options.sessions;
    	if (!trainingSessions) {
    		if(user.selected) return 'completed';
    		return 'pending';
    	}
    	for(var i=0; i<trainingSessions.length; i++) {
    		var id = trainingSessions[i].id;
    		if(user.sessions[id] == 'completed') completedCnt++;
    		if(user.sessions[id] == 'pending') pendingCnt++;
    	}
    	if(nominationDlgScope.options.sessions.length == completedCnt) return 'completed';
    	if(nominationDlgScope.options.sessions.length > completedCnt) return 'partial';
    	if(completedCnt == 0) return 'pending';
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
	//--------------------------------------------------------------------------------------------------
    function _onExport() {
    	nlTrainingReport.exportToCsv($scope, _trainingkinds);
    }
}];

//--------------------------------------------------------------------------------------------------
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

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

	var TrainingListCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlServerApi', 'nlMetaDlg', 'nlSendAssignmentSrv', 'nlLessonSelect',
	function(nl, nlRouter, $scope, nlDlg, nlServerApi, nlMetaDlg, nlSendAssignmentSrv, nlLessonSelect) {

		var _userInfo = null;
		var trainingListDict = {};
		var _scope = null;
		function _onPageEnter(userInfo) {
			_userInfo = userInfo;
			trainingListDict = {};
			return nl.q(function(resolve, reject) {
				nl.pginfo.pageTitle = nl.t('Trainings');
				_scope = $scope;
				$scope.cards = {
					toolbar : _getToolbar()
				};
				$scope.cards.listConfig = {
					columns : _getTableColumns(),
					canShowDetils : true,
					smallColumns : 1
				};
				_getDataFromServer(false, resolve, reject);
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

		function _getDataFromServer(fetchMore, resolve, reject) {
			nlServerApi.getTrainingList().then(function(trainingList) {
				_addSearchInfo($scope.cards);
				_updateTrainingCards(trainingList);
				resolve(true);
			}, function(reason) {
				resolve(false);
			});
		}

		function _addSearchInfo(cards) {
			cards.search = {
				placeholder : nl.t('Enter course name/description')
			};
		}

		function _updateTrainingCards(trainingList) {
			$scope.cards.cardlist = [];
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
			var card = {
				id : item.id,
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
			return card;
		}

		function _publishNewTraining() {
			_editTrainingModule(null, null);
		}


		$scope.onCardInternalUrlClicked = function(card, internalUrl) {
			if (internalUrl == 'training_assign') {
				_assignTrainingModule(card);
			} else if (internalUrl == 'training_report') {
				_trainingReportView(card);
			} else if (internalUrl == 'training_edit') {
				_editTrainingModule(card, card.id);
			}
		};

		function _trainingReportView(card) {
			_getNominations(card.id).then(function(nominations) {
				var alertDlg = {
					title : nl.t('Alert message'),
					template : nl.t('There are no nominated users for this training module.')
				};
				if (Object.keys(nominations).length == 0)
					return nlDlg.popupAlert(alertDlg);
				_showNominatedUserList(card, nominations);
			});
		}

		function _getNominations(trainingId) {
			nlDlg.showLoadingScreen();
			return nlServerApi.getTrainingReportList(trainingId).then(function(reports) {
				nlDlg.hideLoadingScreen();
				var ret = {};
				for (var i = 0; i < reports.length; i++) {
					var rep = _getNominationInfo(reports[i]);
					var oldRep = ret[rep.student];
					if (!oldRep) {
						ret[rep.student] = rep;
						continue;
					}
					if (rep.updated < oldRep.updated)
						continue;
					ret[rep.student] = rep;
				}
				return ret;
			});
		}

		function _getNominationInfo(report) {
			return {
				student : report.student,
				repid : report.id,
				name : report.studentname,
				completed : report.completed,
				updated : nl.fmt.json2Date(report.updated),
				orgunit : report.org_unit
			};
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

			var publishNewButton = {
				text : nl.t('Create'),
				onTap : function(e) {
					_onModuleEdit(e, $scope, _showTrainingEditDlg.scope, null, null);
				}
			};

			var editButton = {
				text : nl.t('Update'),
				onTap : function(e) {
					_onModuleEdit(e, $scope, _showTrainingEditDlg.scope, card, id);
				}
			};
			var cancelButton = {
				text : nl.t('Cancel')
			};

			var buttonName = id ? editButton : publishNewButton;
			_showTrainingEditDlg.show('view_controllers/training_list/training_edit_dlg.html', [buttonName], cancelButton);
		}

		function _onModuleEdit(e, $scope, dlgScope, card, id) {
			if (!_validateInputs(dlgScope)) {
				if (e)
					e.preventDefault();
				return null;
			}

			nlDlg.showLoadingScreen();
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
				start : nl.fmt.json2Date(dlgScope.data.start_date),
				end : nl.fmt.json2Date(dlgScope.data.end_date)
			};
			serverFunction(data).then(function(module) {
				_onModifyDone(module, $scope, id);
			});
		}

		function _onModifyDone(card, $scope, id) {
			nlDlg.hideLoadingScreen();
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
			_showNominatedUserDlg.scope.data.card = card;
			var sortedList = _getSortedList(userDict);
			_showNominatedUserDlg.scope.data.userList = sortedList;
			_showNominatedUserDlg.scope.data.headerCol = [{
				attr : 'name',
				name : nl.t('Username')
			}, {
				attr : 'orgunit',
				name : nl.t('Department')
			}, {
				attr : 'completed',
				name : nl.t('Status')
			}];
			_showNominatedUserDlg.scope.data.title = nl.t('Nominated users');
			var cancelButton = {
				text : nl.t('Cancel')
			};
			_showNominatedUserDlg.show('view_controllers/training_list/nominated_user_dlg.html', [], cancelButton);
		}

		function _getSortedList(userDict) {
			var ret = [];
			for (var key in userDict) ret.push(userDict[key]);
			return ret.sort(function(a, b) {
				if (a.completed != b.completed) return a.completed ? -1 : 1;
				if (a.orgunit != b.orgunit) return a.orgunit > b.orgunit ? 1 : -1;
				if (a.name != b.name) return a.name > b.name ? 1 : -1;
				return 0;
			});
		};

		function _getRemarks(training) {
			var d1 = nl.fmt.date2Str(nl.fmt.json2Date(training.start), 'minute');
			var d2 = nl.fmt.date2Str(nl.fmt.json2Date(training.end), 'minute');
			return nl.fmt2('Open from {} till {} - {}', d1, d2, training.desc);
		}

		function _assignTrainingModule(trainingModule) {
			_getNominations(trainingModule.id).then(function(nominations) {
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
					if (e)
						nl.location.url('/training_list');
				});
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

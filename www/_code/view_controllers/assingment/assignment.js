(function() {

	//-------------------------------------------------------------------------------------------------
	// assignment.js:
	// assignment module
	//-------------------------------------------------------------------------------------------------
	function module_init() {
		angular.module('nl.assignment', []).config(configFn).controller('nl.AssignmentDeskCtrl', AssignmentDeskCtrl);
	}

	//-------------------------------------------------------------------------------------------------
	var configFn = ['$stateProvider', '$urlRouterProvider',
	function($stateProvider, $urlRouterProvider) {
		$stateProvider.state('app.assignment', {
			url : '/assignment',
			views : {
				'appContent' : {
					templateUrl : 'lib_ui/cards/cardsview.html',
					controller : 'nl.AssignmentDeskCtrl'
				}
			}
		});
	}];

	//-------------------------------------------------------------------------------------------------
	var TYPES = {
		NEW : 0,
		PAST : 1,
		SHARED : 2,
		MANAGE : 3,
		SENT : 4
	};
	var TYPENAMES = {
		'new' : 0,
		'past' : 1,
		'shared' : 2,
		'manage' : 3,
		'sent' : 4
	};

	function TypeHandler(nl, nlServerApi) {
		this.type = TYPES.NEW;
		this.custtype = null;

		this.initFromUrl = function() {
			var params = nl.location.search();
			this.type = _convertType(params.type);
			this.custtype = ('custtype' in params) ? parseInt(params.custtype) : null;
		};

		this.listingFunction = function(filter) {
			var data = {
				search : filter
			};
			if (this.custtype !== null)
				data.custtype = this.custtype;

			if (this.type == TYPES.PAST) {
				data.bPast = true;
				return nlServerApi.assignmentGetMyList(data);
			} else if (this.type == TYPES.SHARED) {
				return nlServerApi.assignmentGetSharedList(data);
			} else if (this.type == TYPES.MANAGE) {
				data.mine = false;
				return nlServerApi.assignmentGetSentList(data);
			} else if (this.type == TYPES.SENT) {
				data.mine = true;
				return nlServerApi.assignmentGetSentList(data);
			} else {
				return nlServerApi.assignmentGetMyList(data);
			}
		};

		this.pageTitle = function() {
			if (this.type == TYPES.NEW)
				return nl.t('New Assignments');
			if (this.type == TYPES.PAST)
				return nl.t('Past Assignments');
			if (this.type == TYPES.SHARED)
				return nl.t('Reports shared with me');
			if (this.type == TYPES.MANAGE)
				return nl.t('Manage assignments');
			if (this.type == TYPES.SENT)
				return nl.t('View assignment status');
			return '';
		};

		function _convertType(typeStr) {
			if (typeStr === undefined)
				return TYPES.NEW;
			typeStr = typeStr.toLowerCase();
			for (var t in TYPENAMES) {
				if (t == typeStr)
					return TYPENAMES[t];
			}
			return TYPES.NEW;
		}

	}

	var AssignmentDeskCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi',
	function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi) {

		var mode = new TypeHandler(nl, nlServerApi);
		var _userInfo = null;
		var _searchFilterInUrl = '';

		function _onPageEnter(userInfo) {
			_userInfo = userInfo;
			_initParams();
			return nl.q(function(resolve, reject) {
				mode.initFromUrl();
				nl.pginfo.pageTitle = mode.pageTitle();
				$scope.cards = {};
				$scope.cards.staticlist = [];
				$scope.cards.emptycard = _getEmptyCard(nlCardsSrv);
				_getDataFromServer(_searchFilterInUrl, resolve, reject);
			});
		}


		nlRouter.initContoller($scope, '', _onPageEnter);

		function _getEmptyCard(nlCardsSrv) {
			var help = help = nl.t('There are no assignments to display.');
			return nlCardsSrv.getEmptyCard({
				help : help
			});
		}

		function _getDataFromServer(filter, resolve, reject) {
			mode.listingFunction(filter).then(function(resultList) {
				nl.log.debug('Got result: ', resultList.length);
				$scope.cards.cardlist = _getCards(_userInfo, resultList, nlCardsSrv);
				_addSearchInfo($scope.cards);
				resolve(true);
			}, function(reason) {
				resolve(false);
			});
		}

		function _getCards(userInfo, resultList, nlCardsSrv) {
			var cards = [];
			for (var i = 0; i < resultList.length; i++) {
				var card = _createAssignmentCard(resultList[i], userInfo);
				cards.push(card);
			}
			return cards;
		}

		function _createAssignmentCard(assignment, userInfo) {
			var url = null;
			if (mode.type == 2) {
				url = nl.fmt2('/lesson/view_shared_report_assign/{}/', assignment.id);
			} else if (mode.type == 3 || mode.type == 4) {
				url = nl.fmt2('/reports/assignment_rep/{}/', assignment.id);
			} else {
				url = nl.fmt2('/lesson/do_report_assign/{}/', assignment.id);
			}
			var card = {
				assignmentId : assignment.id,
				title : assignment.name,
				icon : nl.url.lessonIconUrl(assignment.icon),
				url : url,
				children : []
			};
			if (mode.type == 1 || mode.type == 2) {
				card['help'] = nl.t("Assigned to: <b>{}</b><br> Subject: {}<br> by: <b>{}</b><br> <img src={} class='nl-24'> completed", assignment.assigned_to, assignment.subject, assignment.assigned_by, nl.url.resUrl('general/tick.png'));
			} else {
				card['help'] = nl.t("Assigned to: <b>{}</b><br> Subject: {}<br> by: <b>{}</b><br> {}", assignment.assigned_to, assignment.subject, assignment.assigned_by, assignment.assign_remarks);
			}
			card.details = {
				help : assignment.descMore,
				avps : _getAssignmentAvps(assignment)
			};
			card.links = [];
			if (mode.type == 3 || mode.type == 4) {
				card.links.push({
					id : assignment.id,
					text : nl.t('content')
				});
				card.links.push({
					id : 'details',
					text : nl.t('details')
				});
			} else {
				card.links.push({
					id : 'details',
					text : nl.t('details')
				});
			}
			return card;
		}

		function _getAssignmentAvps(assignment) {
			var avps = [];
			_addAvp(avps, 'Operations', assignment.id, 'link');
			nl.fmt.addAvp(avps, 'Name', assignment.name);
			nl.fmt.addAvp(avps, 'Remarks', assignment.assign_remarks);
			nl.fmt.addAvp(avps, 'Assigned by', assignment.assigned_by);
			nl.fmt.addAvp(avps, 'Assigned on', assignment.assigned_on, 'date');
			if (mode.type !== 3 || mode.type == 4) {
				nl.fmt.addAvp(avps, 'Owner', assignment.authorname);
				nl.fmt.addAvp(avps, 'Started on', assignment.started, 'date');
				nl.fmt.addAvp(avps, 'Ended on', assignment.ended, 'date');
			}
			nl.fmt.addAvp(avps, 'Assigned to', assignment.assigned_to);
			nl.fmt.addAvp(avps, 'Subject', assignment.subject);
			nl.fmt.addAvp(avps, 'Lesson Author', assignment.authorname);
			nl.fmt.addAvp(avps, 'Earliest start time', assignment.not_before, 'date');
			nl.fmt.addAvp(avps, 'Latest end time', assignment.not_after, 'date');
			nl.fmt.addAvp(avps, 'Max duration', assignment.max_duration, 'minutes');
			_addAvp(avps, 'Show answers', assignment.learnmode, 'string');
			_addAvp(avps, 'Is published?', assignment.published, 'publish');
			nl.fmt.addAvp(avps, 'Discussion forum', assignment.forum, 'boolean');
			return avps;
		}

		function _addAvp(avps, fieldName, fieldValue, fmtType, fieldDefault) {
			if (fmtType == 'link') {
				if (mode.type == 1) {
					fieldValue = nl.fmt.t(["<a href='/lesson/view_report_assign/{}/'> view report</a>", fieldValue]);
				} else if (mode.type == 2) {
					fieldValue = nl.fmt.t(["<a href='/lesson/view_shared_report_assign/{}/'> view report</a>", fieldValue]);
				} else if (mode.type == 3 || mode.type == 4) {
					fieldValue = nl.fmt.t(["<a href='/reports/assignment_rep/{}/'>reports</a> | <a href='/lesson/view_assign/{}/'> content</a> | <a href='/lesson/view_assign/{}/'> export</a> | <span class='nl-clickable' onclick='deleteAssignment()'> delete</button>", fieldValue, fieldValue]);
				} else {
					fieldValue = nl.fmt.t(["<a href='/lesson/do_report_assign/{}/'> Do assignments</a>", fieldValue]);
				}
			}
			if (fmtType == 'string') {
				if (fieldValue == 1)
					fieldValue = nl.fmt.t(['on every page']);
				if (fieldValue == 2)
					fieldValue = nl.fmt.t(['after submitting']);
				if (fieldValue == 3)
					fieldValue = nl.fmt.t(['only when published']);
			}
			if (fmtType == 'publish')
				fieldValue = fieldValue == true ? nl.fmt.t(['True']) : nl.fmt.t(['False']);
			if (!fieldValue)
				fieldValue = fieldDefault || '-';
			return avps.push({
				attr : nl.fmt.t([fieldName]),
				val : fieldValue
			});
		}

		function _addSearchInfo(cards) {
			cards.search = {
				placeholder : nl.t('Enter assignment name/description')
			};
			cards.search.onSearch = _onSearch;
		}

		function _onSearch(filter) {
			nlDlg.showLoadingScreen();
			var promise = nl.q(function(resolve, reject) {
				_getDataFromServer(filter, resolve, reject);
			});
			promise.then(function(res) {
				nlDlg.hideLoadingScreen();
			});
		}


		$scope.onCardLinkClicked = function(card, linkid) {
			var url = nl.t('/lesson/view_assign/{}/', linkid);
			nl.window.location.href = url;
		};

		function _initParams() {
			var params = nl.location.search();
			_searchFilterInUrl = ('search' in params) ? params.search : '';
		}

	}];
	module_init();
})();

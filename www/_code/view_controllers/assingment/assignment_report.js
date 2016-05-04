(function() {

//-------------------------------------------------------------------------------------------------
// assignment_report.js:
// assignment - Assignment reports upload dialogs and controllers
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.assignment_report', [])
    .config(configFn)
    .controller('nl.AssignmentReportCtrl', AssignmentReportCtrl)
   }
   
//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.assignment_report', {
        url: '^/assignment_report',
        views: {
            'appContent': {
                template : 'lib_ui/cards/cardsview.html',
                controller: 'nl.AssignmentReportCtrl'
            }
        }});
}];



//-------------------------------------------------------------------------------------------------

	function TypeHandler(nl, nlServerApi) {
		this.custtype = null;

		this.initFromUrl = function() {
			var params = nl.location.search();
			this.custtype = ('custtype' in params) ? parseInt(params.custtype) : null;
			this.search = ('search' in params) ? params.search : null;
			this.grade = ('grade' in params) ? params.grade : null;
		};

		this.listingFunction = function(filter) {
			var data = {
				search : filter
			};
			if (this.custtype !== null) data.custtype = this.custtype;
			if (this.search !== null) data.search = this.search;
			if (this.grade !== null) data.grade = this.grade;
				return nlServerApi.assignmentGetMyList(data);
			};
		

		this.pageTitle = function() {
			return nl.t('New Assignments');
		};
	};

//-------------------------------------------------------------------------------------------------
var AssignmentReportCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi', 'nlResourceUploader', 'nlResourceModifySrv',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, nlResourceUploader, nlResourceModifySrv) {

	var _userInfo = null;
	var _allCardsForReview = [];
	var my = 0;
	var search = null;
	var mode = new TypeHandler(nl, nlServerApi);

	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		return nl.q(function(resolve, reject) {
		var params = nl.location.search();
		assignid = ('mine' in params) ? parseInt(params.mine) : 0;
		search = ('search' in params) ? params.search : null;
		//nl.pginfo.pageTitle = mode.pageTitle(); 
		$scope.cards = {};
		//$scope.cards.staticlist = _getStaticCard();
		//$scope.cards.emptycard = _getEmptyCard(nlCardsSrv);
		_getDataFromServer(resolve, reject);
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

function _getDataFromServer(filter, resolve, reject) {
	mode.listingFunction(filter).then(function(resultList) {
		nl.log.debug('Got result: ', resultList.length);
		console.log(resultList);
		//$scope.cards.cardlist = _getCards(_userInfo, resultList, nlCardsSrv);
		//_addSearchInfo($scope.cards);
		resolve(true);
	}, function(reason) {
		resolve(false);
	});
}

}];


//-------------------------------------------------------------------------------------------------
module_init();
})();

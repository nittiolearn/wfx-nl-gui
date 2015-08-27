(function() {

	//-------------------------------------------------------------------------------------------------
	// forum.js:
	// Forum module for experimentation
	//-------------------------------------------------------------------------------------------------
	function module_init() {
		angular.module('nl.forum', [])
		.config(configFn).controller('nl.ForumCtrl', ForumCtrl);
	}

	//-------------------------------------------------------------------------------------------------
	var configFn = ['$stateProvider', '$urlRouterProvider',
	function($stateProvider, $urlRouterProvider) {
		$stateProvider.state('app.forum', {
			url : '/forum',
			views : {
				'appContent' : {
					templateUrl : 'view_controllers/forum/forum.html',
					controller : 'nl.ForumCtrl'
				}
			}
		});
	}];

	//-------------------------------------------------------------------------------------------------
	var ForumCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlServerApi',
	function(nl, nlRouter, $scope, nlDlg, nlServerApi) {
		var serverParams = {};
		function _onPageEnter(userInfo) {
			return nl.q(function(resolve, reject) {
				var params = nl.location.search();
				if (!('forumtype' in params) || !('refid' in params)) {
					resolve(false);
					return false;
				}
				serverParams.forumtype = params.forumtype;
				serverParams.refid = params.refid;
				serverParams.secid = ('secid' in params) ? params.secid : 0;
				nlServerApi.forumGetMsgs(serverParams).then(function(forumInfo) {
					nl.pginfo.pageTitle = forumInfo.forumName;
					$scope.msgs = forumInfo.msgs;
					$scope.tittle = forumInfo.msgs.title;
					resolve(true);
				});
				$scope.newTitle = '';
				$scope.newContent = '';
			});
		}
		nlRouter.initContoller($scope, '', _onPageEnter);
		$scope.fmtDate = function(msgDate) {
			return nl.fmt.jsonDate2Str(msgDate);
		};

		$scope.getUserIcon = function(msg) {
			return nl.url.resUrl('general/top-logedin.png');
		};

		$scope.postNew = function() {
			if ($scope.newTitle === '') return;
			var params = {};
			angular.copy(serverParams, params);
			params.title = $scope.newTitle;
			params.text  = $scope.newContent;
			$scope.newContent = '';
			$scope.newTitle = '';
			nlServerApi.forumCreateMsg(params).then(function(forumInfo) {
				nl.pginfo.pageTitle = forumInfo.forumName;
				$scope.msgs = forumInfo.msgs;
				var currDate = new Date();
				var d = currDate;
				var currMonth = d.getMonth();
				currMonth+=1;
				if(currMonth<10) currMonth = "0"+currMonth;
				var todDate = d.getDate();
				if(todDate<10) todDate = "0"+todDate;
				var hour = d.getHours();
				var minutes = d.getMinutes();
				var seconds = d.getSeconds();
				if(hour>=12 && minutes>0 && seconds>0){
					if(hour === 12 || hour === 24 ) hour = "00";
					else if(hour>12) hour = hour-12;
				}
				if(hour<10) hour = "0"+hour;
				if(minutes<10) minutes = "0"+minutes;
				currDate = d.getFullYear()+"-"+currMonth+"-"+todDate+"  "+hour+":"+minutes;
				var msg = {authorname:'Me', title:params.title,updated:currDate , text: params.text};
				var len=$scope.msgs.length;
        		$scope.msgs.splice(0, 0, msg);
		        $scope.title = params.title;
				$scope.text = params.text;
			});
		};
		
		$scope.syncMessages = function() {
        	var msg = {authorname: 'Admin', timestamp: new Date(), text: 'Sync is not implemented yet'};
		};
	}];

	//-------------------------------------------------------------------------------------------------
	module_init();
})();

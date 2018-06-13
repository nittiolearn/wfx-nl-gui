(function() {

//-------------------------------------------------------------------------------------------------
// leader_board.js:
// leader board module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.leaderboard', []).config(configFn)
	.controller('nl.LeaderBoardCtrl', LeaderBoardCtrl)
	.directive('nlLeaderBox', LeaderBoxDirective)
	.directive('nlLeaderBoxTwo', LeaderBoxTwoDirective);
};

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.leader_board', {
		url : '^/leader_board',
		views : {
			'appContent' : {
				templateUrl : 'view_controllers/leaderboard/leader_board.html',
				controller : 'nl.LeaderBoardCtrl'
			}
		}
	});
}];

//-------------------------------------------------------------------------------------------------
var LeaderBoardCtrl = ['nl', 'nlDlg', 'nlRouter', '$scope',
function(nl, nlDlg, nlRouter, $scope) {
	var _userInfo = null;
	var _scope = null;
	function _onPageEnter(userInfo) {
		_userInfo = userInfo;
		_scope = $scope;
		return nl.q(function (resolve, reject) {
			$scope.userinfo = _userInfo;
        	$scope.data = {};
			nl.pginfo.pageTitle = nl.t('Leader Board');
			resolve(true);	
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

	$scope.userList = [
						{id:1, name:'AB de villiars', level: 'Level 5', point: 1250, badges:32, icon:'https://images.mid-day.com/images/2018/jan/AB-De-Villiers-out.jpg'},
						{id:2, name:'Virat kohli', level: 'Level 4', point: 1024, badges:28, icon:'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTbEepcsQOJ-i96T4tNQ6vJZwlCfhdcjWaPJIMz4rwkiutKCZ1J'},
						{id:3, name:'Stuart Broad', level: 'Level 4', point: 824, badges:25, icon:'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTxFDtqXFwTd4krVgH3fSBvdnU9uHomKDwCM4yve1dkUURF5ULI'},
						{id:4, name:'Corey Anderson', level: 'Level 3', point: 750, badges:23, icon:'http://i.cricketcb.com/stats/img/faceImages/8982.jpg'},
						{id:5, name:'Alex Hales', level: 'Level 2', point: 600, badges:16, icon:'http://i.cricketcb.com/stats/img/faceImages/6734.jpg'},
					  ];

	$scope.myScoreList = $scope.userList[0];
}];

//-------------------------------------------------------------------------------------------------
var LeaderBoxDirective =  [
function () {
	return {
    	restrict: 'E',
    	transclude: true,
    	scope: {
    		number: '=',
    		desc: '=',
    		fieldcls: '='
    	},
    	template:"<div class='col padding0 margin0'>"+
					"<div class='row row-center text-center row-wrap padding0 margin0'>"+
						"<div class='padding'>"+
							"<div class='nl-leader-box {{fieldcls}}' style='padding-top:12px'>"+
								"<div class='row row-center text-center row-justify-evenly padding0 margin0'>"+
									"<span class='fprimary' style='font-size:300%; font-weight: 600;min-width:95px'>{{number}}</span>"+
								"</div>"+
								"<div class='row row-center text-center row-justify-evenly padding0 margin0'>"+
									"<span class='fheading2' style='font-size: 12px;'>{{desc}}</span>"+
								"</div>"+
							"</div>"+
						"</div>"+
					"</div>"+
				"</div>"

   };
}];

//-------------------------------------------------------------------------------------------------
var LeaderBoxTwoDirective =  [
function () {
	return {
    	restrict: 'E',
    	transclude: true,
    	scope: {
    		title:'=',
    		desc: '=',
    		imageurl: '='
    	},
    	template:"<div class='col padding0 margin0'>"+
					"<div class='row row-center text-center row-wrap padding0 margin0'>"+
						"<div class='padding'>"+
							"<div class='nl-leader-box2' style='padding-top:16px'>"+
								"<div class='row row-center text-center row-justify-evenly padding0 margin0'>"+
									"<div style='width:100px'>"+
										"<img style='width:100px; height:100px; border-radius:50%;opacity:0.7' src='{{imageurl}}'>"+
									"</div>"+
								"</div>"+
								"<span style='padding-top:2px;'><span/>"+
								"<div class='row row-center text-center row-justify-evenly padding0 margin0'>"+
									"<span class='fheading2' style='font-size:16px;font-weight:bold;'>{{title}}</span>"+
								"</div>"+
								"<div class='row row-center text-center row-justify-evenly padding0 margin0'>"+
									"<span class='fheading2' style='font-size: 12px;'>{{desc}}</span>"+
								"</div>"+
							"</div>"+
						"</div>"+
					"</div>"+
				"</div>"
  };
}];
//-------------------------------------------------------------------------------------------------

module_init();
})();

(function() {

//-------------------------------------------------------------------------------------------------
// course_view.js:
// course_view module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.course_cert', [])
    .config(configFn).controller('nl.CourseCertCtrl', NlCourseCertCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.course_cert', {
        url : '^/course_cert',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/course/course_cert.html',
                controller : 'nl.CourseCertCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var NlCourseCertCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlPrinter',
function(nl, nlRouter, $scope, nlDlg, nlPrinter) {
    var nlContainer = null;
    $scope.available = false;
	$scope.sample = false;

    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.timeout(function() {
                _onPageEnterImpl(userInfo);
            });
            resolve(true);
        });
    }

    nlRouter.initContoller($scope, '', _onPageEnter);
    
    $scope.onPrint = function() {
        nlPrinter.print(nl.fmt2('{} - {} certificate', $scope.userName, $scope.courseName));
    };

    function _onPageEnterImpl(userInfo) {
	    $scope.available = false;
		$scope.sample = false;
        $scope.userName = userInfo.displayname;

        nlContainer = nlRouter.discoverNlContainer();
        if (!nlContainer) return;
        nlContainer.init({version: 0});
        
        var course = nlContainer.getCourse();
        var scoreDict = nlContainer.getScoreObj();
        $scope.avgQuizScore = scoreDict['avgQuizScore'];
        if (!course || !course.content || !course.content.modules) return;
        $scope.courseName = course.name;

        var cm = nlContainer.getCurrentModule();
        if (!cm) return;
        if (cm.type != 'certificate') return;
        $scope.bgimg = cm.certificate_image || '';
        
        if (nlContainer.getMode() == 'published') {
        	$scope.sample = true;
	        $scope.userName = '<Sample: Learner Name>';
	        $scope.completionTime = new Date();
	        
        } else {
	        var statusinfos = course.statusinfo || {};
	        var statusinfo = statusinfos[cm.id] || {};
	        if (statusinfo.status == 'done' || cm.state.status == 'success') {
		        $scope.completionTime = nl.fmt.json2Date(statusinfo.date || course.updated);
	        }
        }
        $scope.available = true;
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();
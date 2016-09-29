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
    $scope.error = false;
    $scope.available = false;

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
        $scope.error = true;

        $scope.userName = userInfo.displayname;

        nlContainer = nlRouter.discoverNlContainer();
        if (!nlContainer) return;
        nlContainer.init({version: 0});
        
        var course = nlContainer.getCourse();
        if (!course || !course.content || !course.content.modules) return;
        $scope.courseName = course.name;

        var certinfo = course.content.certificate;
        $scope.bgimg = certinfo && certinfo.bg ? certinfo.bg : '';

        var cm = nlContainer.getCurrentModule();
        if (!cm) return;
        if (cm.type != 'link') return;

        var statusinfos = course.statusinfo || {};
        var statusinfo = statusinfos[cm.id] || {};
        if (statusinfo.status != 'done' || !statusinfo.date) return;
        $scope.completionTime = nl.fmt.json2Date(statusinfo.date);

        $scope.error = false;
        $scope.available = true;
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();
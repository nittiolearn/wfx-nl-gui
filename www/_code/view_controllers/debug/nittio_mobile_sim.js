(function() {

//-------------------------------------------------------------------------------------------------
// nittio_mobile_sim.js:
// Temp module for experimentation
// TODO-LATER: Remove this once app notifications are stable
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.nittio_mobile_sim', [])
    .config(configFn)
    .controller('nl.NittioMobileSimCtrl', NittioMobileSimCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.nittio_mobile_sim', {
        url : '^/nittio_mobile_sim',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/debug/nittio_mobile_sim.html',
                controller : 'nl.NittioMobileSimCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var NittioMobileSimCtrl = ['nl', 'nlRouter', '$scope',
function(nl, nlRouter, $scope) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            resolve(true);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);

    $scope.iframeUrl = '/#/apphome';
    $scope.isFrameOn = false;
    $scope.data = {title: 'Test title ', ctype: '0', repid: '31877'};

    $scope.onSendNotification = function() {
        console.log('nittio_mobile: Notification received');
        $scope.isFrameOn = true;
        nl.timeout(function() {
            _sendNotificationToChild();
        });
    };

    function _sendNotificationToChild() {
        var iframe = document.getElementById("nittio_mobile_sim_iframe");
        var child = iframe.contentWindow || iframe;
        console.log('nittio_mobile: got the child window', child);

        var data = {notif_title: $scope.data.title, notif_body: 'Dummy body', ctype: $scope.data.ctype, repid: $scope.data.repid};
        data.nittio_mobile_msginfo = {apptype: 'android', appversion: '200'};
        var dataJson = JSON.stringify(data);
        child.postMessage(dataJson, '*');
        console.log('nittio_mobile: posted msg');
    }
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

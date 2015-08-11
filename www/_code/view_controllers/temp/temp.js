(function() {

//-------------------------------------------------------------------------------------------------
// temp.js:
// Temp module for experimentation
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.temp', [])
    .config(configFn)
    .directive('nlImgReader', NlImgReaderDirective)
    .controller('nl.TempCtrl', TempCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.temp', {
        url : '/temp',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/temp/temp.html',
                controller : 'nl.TempCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var TempCtrl = ['nl', 'nlRouter', '$scope', '$stateParams', '$location', 'nlDlg', 'nlLogViewer', 'nlServerApi',
function(nl, nlRouter, $scope, $stateParams, $location, nlDlg, nlLogViewer, nlServerApi) {
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.log.debug('TempCtrl:onPageEnter - enter');
            nl.pginfo.pageTitle = nl.t('Temp playground');
            //_ajaxRequest(nl, method1, $scope, 'httpResult1');
            //_ajaxRequest(nl, method2, $scope, 'httpResult2');
            $scope.homeIcon = nl.url.resUrl('general/home.png');
            nl.log.debug('TempCtrl:onPageEnter - done');
            resolve(true);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);

    $scope.showLogViewer = function() {
        nlLogViewer.show($scope);
    };

    $scope.showTestDlg = function() {
        var testDlg = nlDlg.create($scope);
        testDlg.scope.dlgForms = {};
        var data = {username: 'username.grpid', remember: true};
        testDlg.scope.data = data;
        testDlg.show('view_controllers/temp/testdlg.html', [], {text: 'Close', onTap: function(e) {
            if (testDlg.scope.dlgForms.testForm.$valid) return 'All Ok';
            //if (e) e.preventDefault();
        }}).then(function(res) {
            alert('Dialog returned: ' + res);
        });
    };
}];

var server = 'https://65-dot-nittio-org.appspot.com';
var method1 = '/default/dummy_method.json';
var method2 = '/default/dummy_method2.json';

function _ajaxRequest(nl, method, $scope, resultVar) {
    nl.http.get(server + method, {cache: false})
    .success(function(data, status, headers, config) {
        nl.log.debug('_ajaxRequest HTTP success: ', method, data, status, headers, config);
        $scope[resultVar] = [];
        for (var d in data.result) {
            $scope[resultVar].push({attr:d, val:data.result[d]});
        }
    }).error(function(data, status, headers, config) {
        nl.log.debug('_ajaxRequest HTTP failed: ', method, data, status, headers, config);
    });
}

//-------------------------------------------------------------------------------------------------
var NlImgReaderDirective = ['nl',
function(nl) {
    nl.log.debug('NlImgReaderDirective: ');
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/temp/img_reader.html',
        scope: {
            nlFileRead: "@"
        },
        link: function (scope, element, attributes) {
            nl.log.debug('NlImgReaderDirective linking: ', scope);
            scope.imgFiles = [];

            var children = element.children();
            var imgInput = angular.element(children[0]);
            var imgListDiv = angular.element(children[1]);

            imgInput.bind("change", function (event) {
                nl.log.debug('NlImgReaderDirective changed: ', event);
                scope.$apply(function () {
                    scope.imgFiles = event.target.files;
                    nl.log.debug(scope);
                    _updateImageSection(imgListDiv, event.target.files);
                });
            });
        }
    };
}];

function _updateImageSection(imgListDiv, imgList) {
    imgListDiv.html('');
    var ulElem = angular.element('<ul/>');
    imgListDiv.append(ulElem);
    for (var i = 0; i < imgList.length; i++) {
        var liElem = angular.element('<li/>');
        ulElem.append(liElem);

        var imgElem = angular.element('<img/>');
        var URL = window.URL || window.webkitURL;
        var url = URL.createObjectURL(imgList[i]);
        imgElem.attr('src', url);
        imgElem.attr('height', 60);
        imgElem.attr('onload', function() {
            console.log('TODO - onload function needs to be angularized: ', url);
            URL.revokeObjectURL(url);
        });
        liElem.append(imgElem);
        var infoElem = angular.element('<span/>');
        infoElem.html(imgList[i].name + ": " + imgList[i].size + " bytes");
        liElem.append(infoElem);
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

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
    // TODO-MUNNI: Make a checin of logged in user first
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
var TempCtrl = ['nl', '$scope', '$stateParams', '$location', 'nlDlg', 'nlLogViewer',
function(nl, $scope, $stateParams, $location, nlDlg, nlLogViewer) {
    nl.pginfo.pageTitle = nl.t('Temp playground');
    //_ajaxRequest(nl, method1, $scope, 'httpResult1');
    //_ajaxRequest(nl, method2, $scope, 'httpResult2');

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
            alert('Form not valid');
            e.preventDefault();
        }}).then(function(res) {
            alert('Dialog returned: ' + res);
        });
    };

    var url = nl.url.resUrl('general/home.png');
    nl.url.getCachedUrl(url).then(function(localUrl) {
        nl.log.debug('Got cached url: ', url, localUrl);
        $scope.homeIcon = localUrl;
    }, function(err) {
        nl.log.error('Error getting cached url: ', err);
        $scope.homeIcon = url;
    });

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
    nl.log.warn('NlImgReaderDirective: ');
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/temp/img_reader.html',
        scope: {
            nlFileRead: "@"
        },
        link: function (scope, element, attributes) {
            nl.log.warn('NlImgReaderDirective linking: ', scope);
            scope.imgFiles = [];

            var children = element.children();
            var imgInput = angular.element(children[0]);
            var imgListDiv = angular.element(children[1]);

            imgInput.bind("change", function (event) {
                nl.log.warn('NlImgReaderDirective changed: ', event);
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
        imgElem.attr('src', window.URL.createObjectURL(imgList[i]));
        imgElem.attr('height', 60);
        imgElem.attr('onload', function() {
            window.URL.revokeObjectURL(this.src);
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

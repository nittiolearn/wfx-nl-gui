(function() {

//-------------------------------------------------------------------------------------------------
// temp.js:
// Temp module for experimentation
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.temp', [])
    .config(configFn)
    .service('nlDummy', NlDummy)
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
                templateUrl : 'view_controllers/temp.html',
                controller : 'nl.TempCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var NlDummy = ['nl', 'nlLessonHelperSrv',
function(nl, nlLessonHelperSrv) {
    this.getSampleContent = function(lessonId) {
        return _getSampleContent(lessonId, 10, nlLessonHelperSrv);
    };
    
    this.populateDummyData = function(nLesson, nPages) {
        nl.log.debug('db.populateDummyData:', nLesson, nPages);
        var db = nl.db.get();
        for (var i=0; i<nLesson; i++) {
            _createDummyLesson(nl, db, i, nPages, nlLessonHelperSrv);
        }
    };
}];

function _createDummyLesson(nl, db, i, nPages, nlLessonHelperSrv) {
    var maxPages = 1 + Math.round(Math.random()*nPages*2);
    var l = _getSampleContent(i, maxPages, nlLessonHelperSrv);
    db.put('lesson', l, l.id)
    .then(function(key) {
        nl.log.debug('wrote to db ' + key);         
    }, function(e) {
        nl.log.debug('error writing to db ', e);         
    });
}

var pageTypes = [['H',1], ['S',2], ['2S50',3], ['2S50',4], ['MCQ_4_1',6], ['MCQ_4_1B',6], ['MCQ_2_1B',4]];
var someStrings = ['H1 Hello', 'This is some other section text', 'some thing else', 'sfg sfgsfg dfgg', 
                'img:http://www.clker.com/cliparts/e/a/5/b/11949846051211496895blacksmiti_ganson.svg.med.png'];
                
var images = ['commerce-economics-piggybank.png', 'commerce-economics-profitbag.png', 'chemistry-molecules-color.png', 
'Eng4.png', 'Frog.png'];

function _getSampleContent(i, maxPages, nlLessonHelperSrv) {
    var l={};
    l.id = i;
    l.name = 'Lesson Name: ' + i;
    l.image = _randElem(nlLessonHelperSrv.getIconList(), 1).id;
    l.template = _randElem(nlLessonHelperSrv.getBgTemplateList(), 1).id;
    l.subject = 'Subject 1';
    l.description = 'Description of lesson ' + i + ' - ' + _randElem(someStrings);
    l.pages = [];
    for(var p=0; p<maxPages; p++) {
        var pt = _randElem(pageTypes);
        var sections = [];
        for (var s=0; s<pt[1]; s++) {
            sections.push({type:'txt', text: _randElem(someStrings)});
        }
        l.pages.push({pageId:p, type:pt[0], sections:sections});
    }
    return l;
}

function _randElem(arr, nStart) {
    if (nStart === undefined) nStart = 0;
    var nMax = arr.length -1 - nStart;
    return arr[Math.round(Math.random()*nMax+nStart)];
}

//-------------------------------------------------------------------------------------------------
var TempCtrl = ['nl', '$scope', '$stateParams', '$location', 'nlDummy',
function(nl, $scope, $stateParams, $location, nlDummy) {
    nl.pginfo.pageTitle = nl.t('Temp playground');
    //_ajaxRequest(nl, method1, $scope, 'httpResult1');
    //_ajaxRequest(nl, method2, $scope, 'httpResult2');
    $scope.lessoncnt=100;
    $scope.pagecnt=10;
    $scope.updateDummyData = function() {
        $scope.updateStatus = 'Update in progress: clearing old db ...';
        nl.db.clearDb();
        $scope.updateStatus = 'Update in progress: populating db ...';
        nlDummy.populateDummyData(this.lessoncnt, this.pagecnt);
        $scope.updateStatus = 'Update done.';
    };
    $scope.updateStatus = 'Update not initiated';
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
        templateUrl: 'view_controllers/img_reader.html',
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

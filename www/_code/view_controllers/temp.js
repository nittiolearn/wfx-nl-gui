(function() {

//-------------------------------------------------------------------------------------------------
// temp.js:
// Temp module for experimentation
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.temp', [])
    .config(configFn)
    .service('nlDummy', NlDummy)
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
var NlDummy = ['nl',
function(nl) {
    this.getSampleContent = function(lessonId) {
        return _getSampleContent(lessonId);
    };
    
    this.populateDummyData = function(nLesson, nAssign) {
        console.log('db.populateDummyData:', nLesson, nAssign);
        var db = nl.db.get();
        for (var i=0; i<nLesson; i++) {
            _createDummyLesson(db, i);
        }
    };
}];

function _createDummyLesson(db, i) {
    var l = _getSampleContent(i);
    db.put('lesson', l, l.id)
    .then(function(key) {
        console.log('wrote to db ' + key);         
    }, function(e) {
        console.log('error writing to db ', e);         
    });
}

var pageTypes = [['H',1], ['S',2], ['2S50',3], ['2S50',4], ['MCQ_4_1',6], ['MCQ_4_1B',6], ['MCQ_2_1B',4]];
var someStrings = ['H1 Hello', 'This is some other section text', 'some thing else', 'sfg sfgsfg dfgg', 
                'img:http://www.clker.com/cliparts/e/a/5/b/11949846051211496895blacksmiti_ganson.svg.med.png'];
                
var images = ['commerce-economics-piggybank.png', 'commerce-economics-profitbag.png', 'chemistry-molecules-color.png', 
'Eng4.png', 'Frog.png'];

function _getSampleContent(i) {
    var l={};
    l.id = i;
    l.name = 'Lesson Name: ' + i;
    l.image = _randElem(images);
    l.subject = 'Subject 1';
    l.description = 'Description of lesson ' + i + ' - ' + _randElem(someStrings);
    l.pages = [];
    for(var p=0; p<i+1; p++) {
        var pt = _randElem(pageTypes);
        var sections = [];
        for (var s=0; s<pt[1]; s++) {
            sections.push({type:'txt', text: _randElem(someStrings)});
        }
        l.pages.push({pageId:p, type:pt[0], sections:sections});
    }
    return l;
}

function _randElem(arr) {
    return arr[Math.round(Math.random()*(arr.length-1))];
}

//-------------------------------------------------------------------------------------------------
var TempCtrl = ['nl', '$scope', '$stateParams', '$location', 'nlDummy',
function(nl, $scope, $stateParams, $location, nlDummy) {
    //_ajaxRequest(nl, method1, $scope, 'httpResult1');
    //_ajaxRequest(nl, method2, $scope, 'httpResult2');
    $scope.lessoncnt=10;
    $scope.assigncnt=10;
    $scope.updateDummyData = function() {
        nl.db.clearDb();
        nlDummy.populateDummyData(this.lessoncnt, this.assigncnt);
    };
    
}];

var server = 'https://65-dot-nittio-org.appspot.com';
var method1 = '/default/dummy_method.json';
var method2 = '/default/dummy_method2.json';

function _ajaxRequest(nl, method, $scope, resultVar) {
    nl.http.get(server + method, {cache: false})
    .success(function(data, status, headers, config) {
        console.log('_ajaxRequest HTTP success: ', method, data, status, headers, config);
        $scope[resultVar] = [];
        for (var d in data.result) {
            $scope[resultVar].push({attr:d, val:data.result[d]});
        }
    }).error(function(data, status, headers, config) {
        console.log('_ajaxRequest HTTP failed: ', method, data, status, headers, config);
    });
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

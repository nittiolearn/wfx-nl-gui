(function() {

//-------------------------------------------------------------------------------------------------
// sco.js:
// sco - Sharable content object (SCORM)
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.sco', [])
	.config(configFn)
	.controller('nl.ScoCtrl', ScoCtrl)
	.service('nlInterpolate', nlInterpolate);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.sco', {
		url: '^/sco',
		views: {
			'appContent': {
				templateUrl: 'view_controllers/sco/sco_temp.html',
				controller: 'nl.ScoCtrl'
			}
		}});
}];

//-------------------------------------------------------------------------------------------------
var ScoCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlInterpolate',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlInterpolate) {
	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
            resolve(true);
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);
    var scope = {};
    scope.title = 'Scorm export from Nittio Learn';
    scope.uuid = 'UUID1';
    scope.modules = [
        {id: 0, name: 'Module 0'},
        {id: 1, name: 'Module 1'},
        {id: 2, name: 'Module 2'},
        {id: 3, name: 'Module 3'},
        {id: 4, name: 'Module 4'}
    ];
    scope.scripts = [
        {id: 0, name: 'nittio.bundle.js'},
        {id: 1, name: 'nittio.bundle.css'}
    ];
    scope.resources = [
        {id: 0, resid: '0.png'},
        {id: 1, resid: '1.png'},
        {id: 2, resid: '2.png'}
    ];
    
    var content = nlInterpolate.interpolateWithNgRepeat('view_controllers/sco/sco_manifest_xml.html', scope);
	$scope.data = {xmlContent: content};
	
}];

//-------------------------------------------------------------------------------------------------
var nlInterpolate = ['nl', '$templateCache', '$interpolate',
function(nl, $templateCache, $interpolate) {
    
    this.interpolate = function(templateFile, scope) {
        var template = $templateCache.get(templateFile);
        var interFn = $interpolate(template); 
        return interFn(scope);
    };
    
    this.interpolateWithNgRepeat = function(templateFile, scope) {
        var template = $templateCache.get(templateFile);
        var elems = angular.element(template);
        var expandedTree = angular.element('<nl_dummy_wrapper/>');
        _appendAfterNgRepeat(expandedTree, elems, scope);
        var html = expandedTree.html();
        var interFn = $interpolate(html); 
        return interFn(scope);
    }

    function _appendAfterNgRepeat(parent, elems, scope) {
        var children = [];
        for(var i=0; i<elems.length; i++) {
            var eDom = elems[i];
            var eObj = angular.element(eDom);
            var ngRepeat = eObj.attr('ng-repeat');
            if (!ngRepeat) {
                children.push(eDom);
                continue;
            }
            eObj.removeAttr('ng-repeat');
            var eDomRepeated = _repeatElem(eObj, ngRepeat, scope);
            for(var j=0; j<eDomRepeated.length; j++) {
                children.push(eDomRepeated[j]);
            }
        }
        
        for(var k=0; k < children.length; k++) {
            var eDom = children[k];
            var eObj = angular.element(eDom);
            var grandChildren = eObj.contents();
            eObj.empty();
            _appendAfterNgRepeat(eObj, grandChildren, scope);
            parent.append(eObj);
        }
    }

    function _repeatElem(eObj, ngRepeat, scope) {
        var html = _getHtml(eObj);

        var repInfo = ngRepeat.split(' ');
        var repVar = '$ngRepeat_' + repInfo[0];
        var repArray = repInfo[2];
        
        var arrayInScope = _getElemFromScope(scope, repArray);

        var ret = [];
        for(var i=0; i<arrayInScope.length; i++) {
            var html2 = _replaceAll(html, repVar, nl.fmt2('{}[{}]', repArray, i));
            var clone = angular.element(html2);
            ret.push(clone[0]);
        }
        return ret;
    }
    
    function _getHtml(eObj) {
        var wrapper = angular.element('<nl_dummy_wrapper/>');
        wrapper.append(eObj);
        return wrapper.html();
    }
    
    function _replaceAll(str, search, replace) {
        return str.split(search).join(replace);
    }
    
    function _getElemFromScope(scope, variableName) {
        var names = variableName.split('.');
        var val = scope;
        for(var i=0; i<names.length; i++) {
            var nameAndIndex = names[i].split('[');
            if (nameAndIndex.length == 1) {
                val = val[nameAndIndex[0]];
            } else {
                var index = parseInt(nameAndIndex[1].replace(/\]/, ''));
                val = val[nameAndIndex[0]][index];
            }
        }
        return val;
    }
    
}];
    
//-------------------------------------------------------------------------------------------------
module_init();
})();

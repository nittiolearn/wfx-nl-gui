(function() {

//-------------------------------------------------------------------------------------------------
// sco.js:
// sco - Sharable content object (SCORM)
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.sco', [])
	.config(configFn)
	.controller('nl.ScoExportCtrl', ScoExportCtrl)
	.service('nlInterpolate', nlInterpolate);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.sco_export', {
		url: '^/sco_export',
		views: {
			'appContent': {
				templateUrl: 'view_controllers/sco/sco_export.html',
				controller: 'nl.ScoExportCtrl'
			}
		}});
}];

//-------------------------------------------------------------------------------------------------
var ScoExportCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlInterpolate',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlInterpolate) {
	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
		    $scope.logs = [];
            nl.timeout(_scoExport);
            resolve(true);
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    function _log(status, title, details) {
        if (!details) details ='';
        var ts = nl.fmt.date2Str(new Date(), 'milli');
        $scope.logs.push({status:status, ts:ts, title:title, details:details, expanded:false});
    }
    
    function _logError(title, details) {
        _log('error', title, details);
    }
    
    function _logInfo(title, details) {
        _log('info', title, details);
    }

    function _logDebug(title, details) {
        _log('debug', title, details);
    }

    function _scoExport() {
        var params = nl.location.search();
        if (!('lessonid' in params)) {
            _logError('error', 'lessonid argument missing');
            return;
        }
        var lessonid = parseInt(params.lessonid);
        _fetchLessonData(lessonid);
    }

    function _fetchLessonData(lessonid) {
        _logDebug('Downloading SCO content from server', 'id: '+lessonid);
        nlServerApi.scoExport({lessonid: lessonid})
        .then(function(result) {
            _logInfo('Downloaded SCO content from server', result.html);
            _logInfo(nl.fmt2('SCO uses {} resources (assets)', Object.keys(result.resurls).length),
                angular.toJson(result.resurls, 2));
            _downloadPackageZip();
        }, function(error) {
            _logError('Server call failed:', error);
        });
    }
    
    function _downloadPackageZip() {
        _logDebug('Downloading SCO package template from server');
        var templateZip = '/static/others/scorm-templ.zip';
        JSZipUtils.getBinaryContent(templateZip, function(err, data) {
            if (err) {
                _logError(nl.fmt2('Downloading SCO package template {} failed', 
                    templateZip), err);
                return;
            }
            _onDownloadPackageZip(data);
        });
    }

    function _onDownloadPackageZip(data) {
        _logInfo('Downloaded SCO package template from server');
        try {
            _logDebug('Loading SCO package template');
            JSZip.loadAsync(data).then(function(zip) {
                var dcnt = 0;
                var files = [];
                for(var f in zip.files) {
                    var file = zip.files[f];
                    if (file.dir) dcnt++;
                    files.push({name: file.name, dir: file.dir});
                }
                _logInfo(nl.fmt2('Loaded SCO package template ({} folder, {} files)', 
                    dcnt, files.length - dcnt), angular.toJson(files, 2));
                return zip.file('imsmanifest.xml').async('string');
            }).then(function success(text) {
                _logInfo('Read the imsmanifest.xml file', text);
            }, function error(e) {
                _logError('Loading the SCO package template zip file failed', e);
            });
        } catch(e) {
            _logError('Exception while loading the SCO package template zip file', e);
        }
    }
    
    // TODO - below methods to be implemented
    function _scoDownloadResources() {
    }
    
    function _scoGenerateMetadataXml() {
        _scoMetadataXml();
    }
    
    function _scoUpdatePackageZip() {
    }
    
    function _scoMetadataXml() {
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
    }
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

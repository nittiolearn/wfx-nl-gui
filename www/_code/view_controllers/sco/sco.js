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
var ScoExportCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 
                     'nlInterpolate', 'nlProgressLog',
function(nl, nlRouter, $scope, nlServerApi, nlInterpolate, nlProgressLog) {
    var pl = nlProgressLog.create($scope);
    pl.showLogDetails(true);
    var scoExporter = new ScoExporter(nl, nlServerApi, nlInterpolate, pl);

	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
            nl.timeout(_scoExport);
            resolve(true);
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    function _scoExport() {
        var params = nl.location.search();
        if (!('lessonid' in params)) {
            pl.error('error', 'lessonid argument missing');
            return;
        }
        var lessonid = parseInt(params.lessonid);
        scoExporter.export(lessonid, $scope);
    }

}];

//-------------------------------------------------------------------------------------------------
function ScoExporter(nl, nlServerApi, nlInterpolate, pl) {
    
    var self = this;
    self.lessons = {};
    self.resources = {};
    self.zip = null;
    var CONTENT_FOLDER = 'nlcontent';

    this.export = function(lessonid, scope) {
        self.lessonid = lessonid;
        _q(_downloadPackageZip)()
        .then(_q(_openPackageZip))
        .then(_q(_fetchLessonData))
        .then(_q(_downloadResources))
        .then(_q(_generateMetadataXml))
        .then(_q(_savePackageZip))
        .then(function() {
            pl.info('Export completed.');
            scope.downloadUrl = self.downloadUrl;
        }, function() {
            pl.error('Export failed.');
        });
    };

    function _q(fn) {
        return function(param) {
            return nl.q(function(resolve, reject) {
                fn(resolve, reject, param);
            });
        };
    }
    
    function _downloadPackageZip(resolve, reject) {
        pl.debug('Downloading SCO package template zip from server');
        var v =  NL_SERVER_INFO.versions.script;
        var templateZip = nl.fmt2('/static/others/scorm-templ-old.zip?version={}', v);
        JSZipUtils.getBinaryContent(templateZip, function(e, zipBinary) {
            if (e) {
                pl.error(nl.fmt2('Downloading SCO package template {} failed', 
                    templateZip), e);
                reject('Downloading SCO package template failed');
                return;
            }
            pl.info('Downloaded SCO package template zip from server');
            resolve(zipBinary);
        });
    }

    function _openPackageZip(resolve, reject, zipBinary) {
        try {
            pl.debug('Opening SCO package template zip file');
            JSZip.loadAsync(zipBinary)
            .then(function(zip) {
                self.zip = zip;

                var prefix = CONTENT_FOLDER + '/res';
                var plen = prefix.length;
                var folderCnt = 0;
                var fileCnt = 0;
                var packagedCnt = 0;
                for(var f in self.zip.files) {
                    var file = self.zip.files[f];
                    if (file.dir) {
                        folderCnt++;
                        continue;
                    }
                    fileCnt++;
                    if(file.name.indexOf(prefix) != 0) continue;
                    packagedCnt++;
                    self.resources[file.name.substring(plen)] = {packaged: true, usageCnt:0};
                }
                var fmt = 'Opened SCO package template zip file: Folders={}, Files={}, Prepackaged files={}';
                pl.info(nl.fmt2(fmt, folderCnt, fileCnt, packagedCnt), angular.toJson(self.resources, 2));
                resolve(true);
            }, function(e) {
                var msg = 'Opening the SCO package template zip file failed';
                pl.error(msg, e);
                reject(msg);
            });
        } catch(e) {
            var msg = 'Exception while opening the SCO package template zip file';
            pl.error(msg, e);
            reject(msg);
        }
    }

    function _fetchLessonData(resolve, reject) {
        pl.debug('Downloading SCO content from server', 'id: '+ self.lessonid);
        return nlServerApi.scoExport({lessonid: self.lessonid})
        .then(function(result) {
            pl.info('Downloaded SCO content from server', result.html);
            pl.info(nl.fmt2('SCO uses {} resources (assets)', Object.keys(result.resurls).length),
                angular.toJson(result.resurls, 2));
            self.lessons[self.lessonid] = {lesson: result.lesson, packaged: false};
            var filename = nl.fmt2('{}/{}.html', CONTENT_FOLDER, self.lessonid);
            self.zip.file(filename, result.html);
            
            var newUrls = [];
            for(var url in result.resurls) {
                url = _removeQueryParams(url);
                if (url in self.resources) {
                    self.resources[url].usageCnt++;
                    continue;
                }
                newUrls.push(url);
                self.resources[url] = {packaged: false, usageCnt: 1};
            }
            pl.info(nl.fmt2('{} new resources (assets) to package', newUrls.length),
                angular.toJson(newUrls, 2));
            resolve(true);
        }, function(e) {
            var msg = 'Downloading SCO content from server failed';
            pl.error(msg, e);
            reject(msg);
        });
    }
    
    function _downloadResources(resolve, reject) {
        var urls = [];
        for(var res in self.resources) {
            if (self.resources[res].packaged) continue;
            urls.push(res);
        }
        pl.error(nl.fmt2('TODO-MUNNI-NOW - need to download {} resources', urls.length), 
            angular.toJson(urls, 2));
        resolve(true);
    }
    
    function _generateMetadataXml(resolve, reject) {
        pl.debug('Generating metadata xml');
        var scope = {};
        scope.title = 'Scorm export from Nittio Learn';
        scope.uuid = nl.fmt2('fcfcfaf6-3440-4d50-8e81-ea0d58bcdda2-{}', (new Date()).getTime());
        scope.content_folder = CONTENT_FOLDER;
        scope.lessons = [];
        scope.resources = [];
        
        for(var lessonId in self.lessons) {
            scope.lessons.push({id: lessonId, name: self.lessons[lessonId].lesson.name});
        }
        
        var unusedResources = [];
        for(var res in self.resources) {
            var resid = CONTENT_FOLDER + '/res' + res;
            scope.resources.push({id: resid});
            if (!self.resources[res].usageCnt) unusedResources.push(res);
        }
        pl.debug(nl.fmt2('{} resources are not referred', unusedResources.length), unusedResources);
        
        var content = nlInterpolate.interpolateWithNgRepeat('view_controllers/sco/sco_manifest_xml.html', scope);
        self.zip.file('imsmanifest.xml', content);
        pl.info('Generated metadata xml', content);
        resolve(true);
    }
    
    var link = null;
    function _savePackageZip(resolve, reject) {
        pl.info('Saving package zip file');
        self.zip.generateAsync({type:"base64"}).then(function (base64) {
            //saveAs(blob, "scorm_pkg.zip");
            self.downloadUrl = "data:application/zip;base64," + base64;
            var len = self.downloadUrl.length;
            pl.info(nl.fmt2('Generated save link for package zip file ({} bytes)', len));
            resolve(true);
        }, function(e) {
            pl.info('Error saving package zip file', e);
            reject(e);
        });
    }

    function _getRelUrl(url) {
        return 'res' + url;
    }
    
    function _getAbsUrl(url) {
        return url.substring(3);
    }
    
    function _removeQueryParams(url) {
        var pos = url.indexOf('?'); 
        return (pos < 0) ? url : url.substring(0, pos);
    }
    
}

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

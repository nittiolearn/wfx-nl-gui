(function() {

//-------------------------------------------------------------------------------------------------
// sco_export.js:
// sco - Sharable content object (SCORM) export
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.sco_export', [])
	.config(configFn)
	.controller('nl.ScoExportCtrl', ScoExportCtrl);
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
                     '$templateCache', 'nlProgressLog',
function(nl, nlRouter, $scope, nlServerApi, $templateCache, nlProgressLog) {
    var pl = nlProgressLog.create($scope);
    pl.showLogDetails(true);
    var scoExporter = new ScoExporter(nl, nlServerApi, $templateCache, pl);

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
            pl.error('lessonid argument missing');
            return;
        }
        $scope.options = {version: [{id: '1.2', name: 'SCORM 1.2'}, {id: '2004 4th Edition', name: 'SCORM 2004 4th Edition'}]};
        $scope.error = {};
        var lessonid = parseInt(params.lessonid);
        $scope.data = {lessonIds: '' + lessonid, version: {id: '2004 4th Edition'},
            title: 'Nittio Learn SCORM Module', mathjax: false};
    }
    
    $scope.onExport = function() {
        var lessonIds = $scope.data.lessonIds.split(',');
        if (lessonIds.length == 0) {
            $scope.error.lessonIds = 'Please enter atleast one module id for export';
            return;
        }
        
        for(var i in lessonIds) {
            lessonIds[i] = parseInt(lessonIds[i]);
        }
        $scope.started = true;
        scoExporter.export(lessonIds, $scope.data.version.id, $scope.data.title, 
            $scope.data.mathjax, $scope);
    }

}];

var CONTENT_FOLDER = 'nlcontent';

//-------------------------------------------------------------------------------------------------
function ScoExporter(nl, nlServerApi, $templateCache, pl) {
    
    var self = this;
    self.lessons = {};
    self.resources = {};
    self.zip = null;
    
    this.export = function(lessonIds, version, moduleTitle, mathjax, scope) {
        pl.clear();
        self.moduleTitle = moduleTitle;
        self.savedSize = 0;
        self.lessonIds = lessonIds;
        self.version = version;
        self.mathjax = mathjax;
        _q(_downloadPackageZip)()
        .then(_q(_openPackageZip))
        .then(_q(_downloadModules))
        .then(_q(_downloadResources))
        .then(_q(_generateMetadataXml))
        .then(_q(_savePackageZip))
        .then(function() {
            self.setProgress('done');
            var savedSizeMb = '';
            if (self.savedSize) {
                savedSizeMb = nl.fmt2(': {} MB', 
                    Math.round(self.savedSize / 1024 / 1024 * 10)/10);
            }
            pl.imp('Export completed' + savedSizeMb);
        }, function() {
            self.setProgress('done');
            pl.error('Export failed');
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
        self.setProgress('start');
        pl.debug('Downloading SCO package template zip from server');
        var v =  NL_SERVER_INFO.versions.script;
        var templateZip = nl.fmt2('/static/others/scorm-templ.zip?version={}', v);
        JSZipUtils.getBinaryContent(templateZip, function(e, zipBinary) {
            if (e) {
                pl.error(nl.fmt2('Downloading SCO package template {} failed', 
                    templateZip), e);
                reject('Downloading SCO package template failed');
                return;
            }
            pl.imp('Downloaded SCO package template zip from server');
            self.setProgress('downloadPkgZip');
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
                self.setProgress('openPkgZip');
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

    function _downloadModules(resolve, reject) {
        var pdm = new ParallelDownloadManager(nl, nlServerApi, pl, self, 
            'modules', self.lessonIds, resolve, reject);
        pdm.download();
    }
    
    function _downloadResources(resolve, reject) {
        var urls = [];
        for(var res in self.resources) {
            if (self.resources[res].packaged) continue;
            urls.push(res);
        }
        
        var pdm = new ParallelDownloadManager(nl, nlServerApi, pl, self, 
            'resources', urls, resolve, reject);
        pdm.download();
    }
    
    function _generateMetadataXml(resolve, reject) {
        pl.debug('Generating metadata xml');
        var scope = {};
        scope.title = self.moduleTitle;
        scope.uuid = nl.fmt2('fcfcfaf6-3440-4d50-8e81-ea0d58bcdda2-{}', (new Date()).getTime());
        scope.content_folder = CONTENT_FOLDER;
        scope.version = self.version;
        var lessons = [];
        var resources = [];
        
        for(var lessonId in self.lessons) {
            lessons.push({id: lessonId, name: self.lessons[lessonId].lesson.name});
        }
        
        var unusedResources = [];
        for(var res in self.resources) {
            var resid = 'res' + res;
            resources.push({id: resid});
            if (!self.resources[res].usageCnt) unusedResources.push(res);
        }
        pl.debug(nl.fmt2('{} resources are not referred', unusedResources.length), unusedResources);
        scope.orgItems = _getMetadataOrgItems(scope, lessons);
        scope.assets = _getMetadataAssets(scope, resources);
        scope.scos = _getMetadataSCOs(scope, lessons);
        
        var template = $templateCache.get('view_controllers/sco/sco_manifest_xml.html');
        var content = nl.fmt.fmt1(template, scope);
        self.zip.file('imsmanifest.xml', content);
        pl.imp('Generated metadata xml', content);
        self.setProgress('generateMetadata');
        resolve(true);
    }
    
    function _getMetadataOrgItems(scope, lessons) {
        var ret = '';
        for(var i in lessons) {
            var l = lessons[i];
            ret += nl.fmt2('<item identifier="{}.ITEM.{}"' +
            ' identifierref="{}.SCO.{}" isvisible="true">' +
            '<title>{}</title></item>\r\n',
            scope.uuid, l.id, scope.uuid, l.id, l.name);
        }
        return ret;
    }

    function _getMetadataAssets(scope, resources) {
        var ret = nl.fmt2('<resource identifier="{}.RES" type="webcontent"' +
            ' adlcp:scormType="asset">\r\n', scope.uuid);
        for(var i in resources) {
            var r = resources[i];
            ret += nl.fmt2('    <file href="{}/{}"/>\r\n',
            scope.content_folder, r.id);
        }
        return ret + '</resource>\r\n';
    }

    function _getMetadataSCOs(scope, lessons) {
        var ret = '';
        for(var i in lessons) {
            var l = lessons[i];
            ret += nl.fmt2('<resource identifier="{}.SCO.{}"' + 
                ' href="{}/{}.html" type="webcontent" adlcp:scormType="sco">' +
                '<file href="{}/{}.html"/>' +
                '<dependency identifierref="{}.RES"/></resource>\r\n',
            scope.uuid, l.id, 
            scope.content_folder, l.id, 
            scope.content_folder, l.id,
            scope.uuid);
        }
        return ret;
    }
    
    var link = null;
    function _savePackageZip(resolve, reject) {
        pl.info('Saving package zip file');
        self.zip.generateAsync({type:'blob', compression: 'DEFLATE', compressionOptions:{level:9}}).then(function (zipContent) {
            self.savedSize = zipContent.size || 0;
            saveAs(zipContent, "scorm_pkg.zip");
            pl.info('Initiated save of package zip file');
            resolve(true);
        }, function(e) {
            pl.info('Error saving package zip file', e);
            reject(e);
        });
    }

    var _progressLevels = {
        start: [0, 0],
        downloadPkgZip: [0, 3],
        openPkgZip: [3, 5],
        modules: [5, 20],
        resources: [20, 95],
        generateMetadata: [95, 98],
        done: [98, 100]
    };
    
    this.setProgress = function(currentAction, doneSubItems, maxSubItems) {
        if (!doneSubItems) doneSubItems = 1;
        if (!maxSubItems) maxSubItems = 1;
        var levels = _progressLevels[currentAction];
        var p = levels[0] + (doneSubItems/maxSubItems)*(levels[1] - levels[0]);
        pl.progress(p);
    }

}

//-------------------------------------------------------------------------------------------------
function ParallelDownloadManager(nl, nlServerApi, pl, scoExporter, type, urls, resolve, reject) {
    scoExporter.setProgress(type, 0, urls.length);
    var zip = scoExporter.zip;
    var MAX_PARALLEL = 1;
    self = this;
    this.download = function() {
        pl.debug(nl.fmt2('About to download {} {}', urls.length, type), 
            angular.toJson(urls, 2));
        self.startPos = 0;
        self.runningCnt = 0;
        self.doneCnt = 0;
        self.errorCnt = 0;
        self.successCnt = 0;
        _fireDownloads(0, 0);
    }
    
    function _fireDownloads() {
        if (self.doneCnt == urls.length) {
            var msg = nl.fmt2('Downloaded {}: {} success, {} fail', type, self.successCnt, self.errorCnt); 
            if (self.errorCnt > 0) {
                pl.error(msg);
            } else {
                pl.imp(msg);
            }
            scoExporter.setProgress(type, urls.length, urls.length);
            resolve(true);
            return;
        }
        for(var i=self.startPos; i<urls.length && self.runningCnt < MAX_PARALLEL; i++) {
            self.startPos++;
            self.runningCnt++;
            var downloadFn = (type == 'resources') ? _downloadResource : _downloadLesson;
            downloadFn(urls[i], function() {
                scoExporter.setProgress(type, self.doneCnt, urls.length);
                self.runningCnt--;
                self.doneCnt++;
                _fireDownloads();
            });
        }
    }

    function _downloadLesson(lessonid, onDone) {
        pl.debug('Downloading SCO content from server', 'id: '+ lessonid);
        return nlServerApi.scoExport({lessonid: lessonid, mathjax: scoExporter.mathjax})
        .then(function(result) {
            pl.info('Downloaded SCO content from server', result.html);
            pl.info(nl.fmt2('SCO uses {} resources (assets)', Object.keys(result.resurls).length),
                angular.toJson(result.resurls, 2));
            scoExporter.lessons[lessonid] = {lesson: result.lesson, packaged: false};
            var filename = nl.fmt2('{}/{}.html', CONTENT_FOLDER, lessonid);
            zip.file(filename, result.html);
            
            var newUrls = [];
            for(var url in result.resurls) {
                url = _removeQueryParams(url);
                if (!_isKnownExtn(url)) {
                    pl.info(nl.fmt2('resource ignored: {}', url));
                    continue;
                }
                if (url in scoExporter.resources) {
                    scoExporter.resources[url].usageCnt++;
                    continue;
                }
                newUrls.push(url);
                scoExporter.resources[url] = {packaged: false, usageCnt: 1};
            }
            pl.info(nl.fmt2('{} new resources (assets) to package', newUrls.length),
                angular.toJson(newUrls, 2));
            self.successCnt++;
            onDone();
        }, function(e) {
            var msg = 'Downloading SCO content from server failed';
            pl.error(msg, e);
            self.errorCnt++;
            onDone();
        });
    }
    
    function _downloadResource(url, onDone) {
        pl.debug(nl.fmt2('Downloading resource {}', url));
        JSZipUtils.getBinaryContent(url, function(e, content) {
            nl.timeout(function() { // same as scope.$apply as scope is not there!
                if (e) {
                    pl.error(nl.fmt2('Downloading resource {} failed', 
                        url), e);
                    self.errorCnt++;
                    onDone();
                    return;
                }
                pl.info(nl.fmt2('Downloaded resource {}', url));
                self.successCnt++;
                var prefix = CONTENT_FOLDER + '/res';
                zip.file(prefix + url, content);
                onDone();
            });
        });
    }

    function _removeQueryParams(url) {
        var pos = url.indexOf('?'); 
        return (pos < 0) ? url : url.substring(0, pos);
    }
    
    function _isKnownExtn(url) {
        var path = url.split('/');
        var file = path[path.length-1];
        return (file.indexOf('.') >= 0);
    }
    
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

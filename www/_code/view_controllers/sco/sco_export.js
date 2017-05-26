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
                     '$templateCache', 'nlProgressLog', 'nlExporter', 'nlDlg',
function(nl, nlRouter, $scope, nlServerApi, $templateCache, nlProgressLog, nlExporter, nlDlg) {
    var pl = nlProgressLog.create($scope);
    pl.showLogDetails(true);
    var scoExporter = new ScoExporter(nl, nlServerApi, $templateCache, pl, nlExporter);

	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
            var params = nl.location.search();
            var data = {courseModules: {names: [], ids: []}, title: 'Nittio Learn SCORM Module'};
            data.lessonid = ('lessonid' in params) ? params.lessonid : '';
            data.courseid = ('courseid' in params) ? parseInt(params.courseid) : null;
            if (!data.courseid) {
                nl.timeout(function() {
                    _scoExport(data);
                });
                resolve(true);
                return;
            }
            nlServerApi.courseGet(data.courseid, true).then(function(course) {
                data.title = course.name;
                if(!_getCourseModules(course, data.courseModules)) {
                    nlDlg.popupAlert({title: 'Error', template: 'Error opening the course'})
                    .then(function() {
                        resolve(false);
                    });
                    return;
                }
                if(data.courseModules.ids.length == 0) {
                    nlDlg.popupAlert({title: 'Error', template: 'No modules found in the course'})
                    .then(function() {
                        resolve(false);
                    });
                    return;
                }
                _scoExport(data);
                resolve(true);
            }, function() {
                resolve(false);
            });
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);

    function _getCourseModules(course, courseModules) {
        if (!course || !course.content || !course.content.modules) return false;
        var modules = course.content.modules;
        for(var i=0; i<modules.length; i++) {
            var cm = modules[i];
            if (cm.type != 'lesson') continue;
            courseModules.ids.push(cm.refid);
            courseModules.names.push(cm.name);
        }
        return true;
    }
    
    function _scoExport(data) {
        $scope.options = {version: [{id: '1.2', name: 'SCORM 1.2'}, {id: '2004 4th Edition', name: 'SCORM 2004 4th Edition'}]};
        $scope.error = {};
        $scope.data = {lessonIds: data.lessonid, version: {id: '2004 4th Edition'},
            title: data.title, mathjax: true, courseid: data.courseid, courseModules: data.courseModules};
    }
    
    $scope.onExport = function() {
        var lessonNames = $scope.data.courseid ? $scope.data.courseModules.names : null;
        var lessonIds = $scope.data.courseid ? $scope.data.courseModules.ids : null;
        if (!lessonIds) {
            var lessonIds = $scope.data.lessonIds.split(',');
            if (lessonIds.length == 0) {
                $scope.error.lessonIds = 'Please enter atleast one module id for export';
                return;
            }
            for(var i=0; i<lessonIds.length; i++) {
                lessonIds[i] = parseInt(lessonIds[i]);
            }
        }
        
        $scope.started = true;
        $scope.ongoing = true;
        scoExporter.export(lessonIds, $scope.data.version.id, $scope.data.title, 
            $scope.data.mathjax, $scope, lessonNames);
    }

}];

var CONTENT_FOLDER = 'nlcontent';

//-------------------------------------------------------------------------------------------------
function ScoExporter(nl, nlServerApi, $templateCache, pl, nlExporter) {
    
    var self = this;
    self.lessons = {};
    self.resources = {};
    self.zip = null;
    
    this.export = function(lessonIds, version, moduleTitle, mathjax, scope, lessonNames) {
        pl.clear();
        self.moduleTitle = moduleTitle;
        self.savedSize = 0;
        self.lessonIds = lessonIds;
        self.lessonNames = lessonNames;
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
                    Math.round(self.savedSize / 1024 * 10)/10);
            }
            pl.imp('Export completed' + savedSizeMb);
            scope.ongoing = false;
        }, function() {
            self.setProgress('done');
            pl.error('Export failed');
            scope.ongoing = false;
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
    
    var _metadataXmlTemplate = {
        '1.2': 'sco_manifest_xml_v12.html',
        '2004 4th Edition': 'sco_manifest_xml_v2004.html'
    };
    
    var _attrNames = {
        '1.2': {scormType: 'adlcp:scormtype'},
        '2004 4th Edition': {scormType: 'adlcp:scormType'}
    };
    
    function _generateMetadataXml(resolve, reject) {
        pl.debug('Generating metadata xml');
        var scope = {};
        scope.title = self.moduleTitle;
        scope.uuid = nl.fmt2('fcfcfaf6-3440-4d50-8e81-ea0d58bcdda2-{}', (new Date()).getTime());
        scope.content_folder = CONTENT_FOLDER;
        scope.version = self.version;
        var lessons = [];
        var resources = [];
        
        for(var i=0; i<self.lessonIds.length; i++) {
            var lessonId = self.lessonIds[i];
            var name = self.lessonNames && self.lessonNames[i] 
                ? self.lessonNames[i]
                : self.lessons[lessonId].lesson.name;
            lessons.push({id: lessonId, name: name});
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
        
        var template = $templateCache.get('view_controllers/sco/' + _metadataXmlTemplate[self.version]);
        var content = nl.fmt.fmt1(template, scope);
        self.zip.file('imsmanifest.xml', content);
        pl.imp('Generated metadata xml', content);
        self.setProgress('generateMetadata');
        resolve(true);
    }
    
    function _getMetadataOrgItems(scope, lessons) {
        var ret = '';
        for(var i=0; i<lessons.length; i++) {
            var l = lessons[i];
            ret += nl.fmt2('<item identifier="{}.ITEM.{}"' +
            ' identifierref="{}.SCO.{}" isvisible="true">' +
            '<title>{}</title></item>\r\n',
            scope.uuid, i, scope.uuid, i, l.name);
        }
        return ret;
    }

    function _getMetadataAssets(scope, resources) {
        var scormType = _attrNames[self.version]['scormType'];
        var ret = nl.fmt2('<resource identifier="{}.RES" type="webcontent"' +
            ' {}="asset">\r\n', scope.uuid, scormType);
        for(var i in resources) {
            var r = resources[i];
            ret += nl.fmt2('    <file href="{}/{}"/>\r\n',
            scope.content_folder, r.id);
        }
        return ret + '</resource>\r\n';
    }

    function _getMetadataSCOs(scope, lessons) {
        var scormType = _attrNames[self.version]['scormType'];
        var ret = '';
        for(var i=0; i<lessons.length; i++) {
            var l = lessons[i];
            ret += nl.fmt2('<resource identifier="{}.SCO.{}"' + 
                ' href="{}/{}.html" type="webcontent" {}="sco">' +
                '<file href="{}/{}.html"/>' +
                '<dependency identifierref="{}.RES"/></resource>\r\n',
            scope.uuid, i,
            scope.content_folder, l.id, 
            scormType,
            scope.content_folder, l.id,
            scope.uuid);
        }
        return ret;
    }
    
    var link = null;
    function _savePackageZip(resolve, reject) {
        nlExporter.saveZip(self.zip, 'scorm_pkg.zip', pl, function(sizeKb) {
            self.savedSize = sizeKb || 0;
            resolve(true);
        }, function(e) {
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
        self.ignoreCnt = 0;
        _fireDownloads(0, 0);
    }
    
    function _fireDownloads() {
        if (self.doneCnt == urls.length) {
            var msg = nl.fmt2('Downloaded {}: {} success, {} fail, {} ignored', 
                type, self.successCnt, self.errorCnt, self.ignoreCnt); 
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
            downloadFn(i, urls[i], function() {
                scoExporter.setProgress(type, self.doneCnt, urls.length);
                self.runningCnt--;
                self.doneCnt++;
                _fireDownloads();
            });
        }
    }

    function _downloadLesson(pos, lessonid, onDone) {
        pl.debug('Downloading SCO content from server', 'id: '+ lessonid);
        if (lessonid in scoExporter.lessons) {
            pl.info('SCO content already downloaded', lessonid);
            self.ignoreCnt++;
            onDone();
            return;
        }
        return nlServerApi.scoExport({lessonid: lessonid, mathjax: scoExporter.mathjax})
        .then(function(result) {
            pl.info('Downloaded SCO content from server', result.html);
            pl.info(nl.fmt2('SCO uses {} resources (assets)', Object.keys(result.resurls).length),
                angular.toJson(result.resurls, 2));
            scoExporter.lessons[lessonid] = {lesson: result.lesson, packaged: false};
            var filename = nl.fmt2('{}/{}.html', CONTENT_FOLDER, lessonid);
            zip.file(filename, result.html);
            
            var newUrls = [];
            for(var urlFull in result.resurls) {
                var url = _removeQueryParams(urlFull);
                if (!_isKnownExtn(url)) {
                    pl.info(nl.fmt2('resource ignored: {}', url));
                    continue;
                }
                if (url in scoExporter.resources) {
                    scoExporter.resources[url].usageCnt++;
                    continue;
                }
                newUrls.push(url);
                scoExporter.resources[url] = {packaged: false, usageCnt: 1, urlFull: urlFull};
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
    
    function _downloadResource(pos, url, onDone) {
        var urlTrunc =  url;
        url = scoExporter.resources[urlTrunc].urlFull || urlTrunc;
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
                zip.file(prefix + urlTrunc, content);
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

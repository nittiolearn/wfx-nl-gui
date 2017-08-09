(function() {

//-------------------------------------------------------------------------------------------------
// sco_import.js:
// sco - Sharable content object (SCORM) import
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.sco_import', [])
	.config(configFn)
    .controller('nl.ScoImportListCtrl', ScoImportListCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.sco_import_list', {
        url: '^/sco_import_list',
        views: {
            'appContent': {
                templateUrl: 'view_controllers/sco/sco_import.html',
                controller: 'nl.ScoImportListCtrl'
            }
        }});
}];

//-------------------------------------------------------------------------------------------------
var ScoImportListCtrl = ['nl', 'nlDlg', 'nlRouter', '$scope', 'nlServerApi', 'nlResourceUploader',
                     'nlProgressLog', 'nlCardsSrv',
function(nl, nlDlg, nlRouter, $scope, nlServerApi, nlResourceUploader, nlProgressLog, nlCardsSrv) {
    var importer = new ScormImporter(nl, nlDlg, $scope, nlServerApi, 
        nlResourceUploader, nlProgressLog);
    var viewer = new ScormViewer(nl, nlDlg, $scope, nlServerApi);
    var cardDict = {};
    var template = 0;
    
    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('SCORM Import');
            var params = nl.location.search();
            template = parseInt(params.template || 0);
            $scope.cards = {
                staticlist: _getStaticCards(),
                search: {placeholder: nl.t('Enter SCORM module name')}
            };
            nlCardsSrv.initCards($scope.cards);
            _getDataFromServer(resolve);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
    
    $scope.onCardInternalUrlClicked = function(card, internalUrl) {
        if (internalUrl === 'view_sco') {
            viewer.show(card, card.manifestid);
        } else if (internalUrl === 'new_sco') {
            importer.import(template, 0, function() {
                _getDataFromServer();
            });
        } else if (internalUrl === 'modify_sco') {
            importer.import(template, card.manifestid);
        } else if (internalUrl === 'fetch_more') {
            _getDataFromServer(null, true);
        }
    };
    $scope.onCardLinkClicked = $scope.onCardInternalUrlClicked;

    $scope.onDeleteManifest = function(card) {
        _revertCards($scope);
        nlDlg.popupConfirm({title: 'Please confirm',
            template: 'Are you sure you want to delete all the resources (ASSETS) uploaded as part of this scorm import. You will not be able to revert this change.'})
        .then(function(res) {
            if (!res) return;
            importer.deleteResources(card.title, card.manifestid, function() {
                _revertCards($scope);
                _deleteManifest(card.manifestid);
            });
        })
    };
    
    function _getStaticCards() {
        var card = {title: nl.t('Import'), 
                    icon: nl.url.resUrl('dashboard/crnewwsheet.png'), 
                    internalUrl: 'new_sco',
                    help: nl.t('Import a new scorm module zip file'), 
                    children: [], style: 'nl-bg-blue'};
        card.links = [];
        return [card];
    }

    var _pageFetcher = nlServerApi.getPageFetcher();
    function _getDataFromServer(resolve, fetchMore) {
        var params = {};
        _pageFetcher.fetchPage(nlServerApi.scoGetManifestList, 
            params, fetchMore, function(resultList) {
            if(!resultList) {
                if (resolve) resolve(false);
                return;
            }
            $scope.cards.canFetchMore = _pageFetcher.canFetchMore();
            if (!fetchMore) $scope.cards.cardlist = [];
            _updateCards(resultList, $scope.cards.cardlist);
            nlCardsSrv.updateCards($scope.cards);
            if (resolve) resolve(true);
        });
    }
    
    function _updateCards(resultList, cards) {
        for (var i = 0; i < resultList.length; i++) {
            var card = _createCard(resultList[i]);
            cards.push(card);
        }
        cards.sort(function(a, b) {
            return b.updated - a.updated;
        });
    }
    
    function _createCard(manifest) {
        cardDict[manifest.id] = manifest;
        manifest.updated = nl.fmt.json2Date(manifest.updated || null);
        manifest.created = nl.fmt.json2Date(manifest.created || null);
        var desc = nl.t("<span class='nl-card-description'>uploaded by <b>{}</b> on <b>{}<b></span>", 
            manifest.authorname, nl.fmt.date2Str(manifest.updated, 'minute'));
        var card = {manifestid: manifest.id,
                    updated: manifest.updated,
                    title: manifest.name, 
                    icon: nl.url.resUrl('dashboard/wsheet.png'), 
                    internalUrl: 'view_sco',
                    help: desc,
                    children: []};

        card.details = {help: '', avps: _getAvps(manifest)};
        card.links = [{id: 'details', text: nl.t('details')}];
        return card;
    }
    
    function  _getAvps(manifest) {
        var avps = [];
        nl.fmt.addAvp(avps, 'Name', manifest.name);
        nl.fmt.addAvp(avps, 'Author', manifest.authorname);
        nl.fmt.addAvp(avps, 'Group', manifest.grpname);
        nl.fmt.addAvp(avps, 'Created on', manifest.created, 'date');
        nl.fmt.addAvp(avps, 'Updated on', manifest.updated, 'date');
        return avps;
    }

    function _deleteManifest(manifestid) {
        nlDlg.showLoadingScreen();
        nlServerApi.scoDeleteManifest(manifestid).then(function(status) {
            nlDlg.popupStatus('Manifest deleted');
            _getDataFromServer();
        });
    }
}];

var _cards = null;
function _storeCards($scope) {
    if ($scope.cards) _cards = $scope.cards;
    $scope.cards = null;
}
function _revertCards($scope) {
    if (_cards) $scope.cards = _cards;
    _cards = null;
}

//-------------------------------------------------------------------------------------------------
function ScormViewer(nl, nlDlg, $scope, nlServerApi) {
    var self = this;
    $scope.viewer = {};
    $scope.viewerFn = {};
    
    this.show = function(card, manifestid) {
        _storeCards($scope);
        $scope.title = nl.fmt2('SCORM module: {}', manifestid);
        $scope.showImportForm = false;

        $scope.viewer = {manifestid: manifestid, show: true, data: null, card: card};
        nlServerApi.scoGetManifestData($scope.viewer.manifestid).then(function(data) {
            $scope.viewer.data = data;
            var active = {scos: 0, assets: 0};
            $scope.viewer.active = active;
            for(var i=0; i<data.scos.length; i++)
                if (data.scos[i].lessonid) active.scos++;
            for(var i=0; i<data.assets.length; i++)
                if (data.assets[i].resid) active.assets++;
        });
    };

    $scope.viewerFn.onClose = function() {
        _revertCards($scope);
        $scope.viewer = {};
    };
}

//-------------------------------------------------------------------------------------------------
function ScormImporter(nl, nlDlg, $scope, nlServerApi, nlResourceUploader, nlProgressLog) {
    var self = this;
    var pl = nlProgressLog.create($scope);
    pl.showLogDetails(true);
    
    function _initScope(template, manifestid, operation, nextFn) {
        self.template = template;
        self.manifestid = manifestid;
        self.operation = operation;
        self.nextFn = nextFn || null;
        _storeCards($scope);
 
        $scope.running = false;
        $scope.data = {scozip: null};
        $scope.error = {};
        $scope.showImportForm = true;
        $scope.viewer = {};

        if (operation == 'create')
            $scope.title = 'Upload a new SCORM module';
        else if (operation == 'modify')
            $scope.title = nl.fmt2('Modify SCORM module: {}', manifestid);
        else
            $scope.title = nl.fmt2('Delete SCORM module: {}', manifestid);

        $scope.showImportButton = (operation != 'delete');
        pl.clear();
        _setProgress('start');
        $scope.started = false;
    }

    $scope.onClose = function() {
        if ($scope.running) {
            nlDlg.popupAlert({title: 'Warning', template: 'Please cancel before closing'});
            return;
        }
        _revertCards($scope);
        $scope.showImportForm = false;
        if (self.nextFn) self.nextFn();
    };
    
    $scope.onAbort = function() {
        $scope.abort = true;
    };

    this.import = function(template, manifestid, nextFn) {
        _initScope(template, manifestid, manifestid ? 'modify' : 'create', nextFn);
    };

    this.deleteResources = function(title, manifestid, postDeleteFn) {
        _initScope(0, manifestid, 'delete');

        _init(null, title);
        _q(_createOrGetManifest)()
        .then(_q(_initDone))
        .then(_q(_deleteOldResources))
        .then(function() {
            _onComplete(true, postDeleteFn);
        }, function() {
            _onComplete(false, postDeleteFn);
        });
    };

	$scope.onImport = function() {
	    if (!$scope.data.scozip || $scope.data.scozip.length == 0) {
	        $scope.error.scozip = 'Please select a zip file';
	        return;
	    }
        var scofile = $scope.data.scozip[0].resource;
        if (!scofile) {
            $scope.error.scozip = 'Please select a zip file';
            return;
        }
        _init(scofile, '');
        _q(_loadZip)()
        .then(_q(_readManifestXml))
        .then(_q(_parseManifestXml))
        .then(_q(_createOrGetManifest))
        .then(_q(_initDone))
        .then(_q(_deleteOldResources))
        .then(_q(_createScormLessons))
        .then(_q(_uploadResources))
        .then(function() {
            _onComplete(true);
        }, function() {
            _onComplete(false);
        });
	}
	
	function _onComplete(bSuccess, postDeleteFn) {
        _q(_storeManifest)().then(function() {
            _onComplete2(bSuccess, postDeleteFn);
        }, function() {
            _onComplete2(false, postDeleteFn);
        });
	}

    function _onComplete2(bSuccess, postDeleteFn) {
        nlServerApi.noPopup(false);
        _setProgress('done');
        if (bSuccess) pl.imp(self.operation == 'delete' ? 'Deleted resources' : 'Import completed');
        else pl.error('Import failed');
        $scope.running = false;
        if (postDeleteFn) postDeleteFn();
    }
    
    function _init(scofile, title) {
        nlServerApi.noPopup(true);
        $scope.running = true;
        $scope.abort = false;
        self.scofile = scofile;
        self.zip = null;
        self.manifestXml = '';
        self.manifestJson = null;
        self.currentManifestData = null;
        self.deleteAssets = null;
        self.title = title;
        self.assets = [];
        self.scos = [];
        self.actionsDone = 0;
        self.actionsMax = 0;

        $scope.started = true;

        pl.clear();
        pl.imp('Initializing');
        _setProgress('start');
    }
        
    function _loadZip(resolve, reject) {
        JSZip.loadAsync(self.scofile).then(function(zip) {
            pl.debug('Opened zip file: ' + self.scofile.name);
            self.zip = zip;
            resolve(true);
        }, function() {
            return _err(reject, 'Opening zip file failed: ' + self.scofile.name);
        });
    }
    
    function _readManifestXml(resolve, reject) {
        var manifestFile = self.zip.file('imsmanifest.xml');
        if (!manifestFile)
            return _err(reject, 'imsmanifest.xml is missing in the zip file');
        pl.debug('Opened imsmanifest.xml file');
        manifestFile.async('string').then(function(content) {
            content = content.replace(/adlcp:scormType/ig, function(x) {
                return x.toLowerCase();
            });
            self.manifestXml = content;
            pl.debug('Read imsmanifest content', self.manifestXml);
            resolve(true);
        })
    }
    
    function _parseManifestXml(resolve, reject) {
        pl.debug('Parsing Xml file');
        var x2js = new X2JS({arrayAccessFormPaths : [
           "manifest.resources.resource",
           "manifest.resources.resource.file",
           "manifest.organizations.organization",
           "manifest.organizations.organization.item"
        ]});
        pl.debug('Read xml content', self.manifestXml);
        self.manifestJson = x2js.xml_str2json(self.manifestXml);
        if(!self.manifestJson)
            return _err(reject, 'Improper manifest xml');

        var manifest = self.manifestJson.manifest;
        pl.info('Parsed manifest xml content', manifest ? angular.toJson(manifest, 2) : self.manifestJson);
        if(!manifest)
            return _err(reject, '<manifest> element missing in manifestXml', self.manifestJson);

        var metadata = manifest.metadata;
        if(metadata && metadata.lom && metadata.lom.general) {
            var title = metadata.lom.general.title;
            if (title && title.langstring) title = title.langstring.__text;
            else if (title && title.string) title = title.string.__text;
            if (title) self.title = title;
        }
        
        var resources = manifest.resources;
        if(!resources)
            return _err(reject, '<resources> element missing in <manifest>');
        var resource = resources.resource;
        if(!resource)
            return _err(reject, '<resource> element missing in <resources>');
        _getResourcesFromXml(resource);

        var organizations = manifest.organizations;
        if(!organizations)
            return _err(reject, '<organizations> element missing in <manifest>');
        var orgs = organizations.organization;
        if(!orgs)
            return _err(reject, '<organization> element missing in <organizations>');
        _updateScoTitlesFromXml(orgs);

        pl.debug('Got the list of sco and assets', {scos: self.scos, assets: self.assets});

        resolve(true);
    }

    function _getResourcesFromXml(resources) {
        for(var i=0; i<resources.length; i++) {
            var res = resources[i];
            if (res['_adlcp:scormtype'] == 'sco' && res._href)
                self.scos.push({href: res._href, id: res._identifier});
            var files=res.file;
            for(var j=0; j<files.length; j++) {
                self.assets.push({href: files[j]._href});
            }
        }
    }
    
    function _updateScoTitlesFromXml(orgs) {
        var scoTitles = {};
        for (var i=0; i <orgs.length; i++) {
            var org = orgs[i];
            if (!self.title && org.title) self.title = org.title;
            for (var j=0; j < org.item.length; j++) {
                var item = org.item[j];
                scoTitles[item._identifierref] = item.title;
                if (!self.title) self.title = item.title;
            }
        }
        if(!self.title) self.title = nl.fmt2('SCORM Import on {}', new Date());
        for(var i=0; i<self.scos.length; i++) {
            var sco = self.scos[i];
            sco.title = (sco.id in scoTitles) ? scoTitles[sco.id] : self.title;
        }
    }
    
    function _createOrGetManifest(resolve, reject) {
        if (self.operation == 'create') {
            _storeManifest(resolve, reject);
            return;
        }
        _getManifest(resolve, reject);
    }
    
    function _getManifest(resolve, reject) {
        pl.debug('Getting manifest information from DB');
        nlServerApi.scoGetManifestData(self.manifestid).then(function(data) {
            self.currentManifestData = data;
            self.deleteAssets = data.assets || [];
            pl.debug('Got manifest information from DB', self.currentManifestData);
            resolve(true);
        }, function(msg) {
            return _err(reject, 'Error getting manifest information from DB', msg);
        });
    }

    function _storeManifest(resolve, reject) {
        var data = self.currentManifestData || {};
        if (self.operation == 'delete') {
            data.assets = self.deleteAssets;
        } else {
            data.assets = self.assets;
            data.manifestXml = self.manifestXml;
            data.scos = self.scos;
            data.template = self.template;
        }
        pl.debug('Storing manifest information to DB', data);
        nlServerApi.scoUpdateManifest({data: data, id: self.manifestid, name: self.title})
        .then(function(manifestData) {
            self.currentManifestData = manifestData;
            pl.info('Stored manifest information to DB', manifestData);
            self.manifestid = manifestData.id;
            resolve(true);
        }, function(msg) {
            return _err(reject, 'Error storing manifest information to DB', msg);
        });
    }
    
    function _initDone(resolve, reject) {
        self.deleteCnt = Math.ceil(self.deleteAssets ? self.deleteAssets.length/10: 0);
        if (self.operation == 'create') {
            self.actionsMax = self.assets.length + self.scos.length;
        } else if (self.operation == 'modify') {
            self.actionsMax = self.deleteCnt + self.assets.length;
        } else {
            self.actionsMax = self.deleteCnt;
        }
        _setProgress('init');
        resolve(true);
    }

    function _deleteOldResources(resolve, reject) {
        pl.imp('Deleting current resources');
        nlServerApi.resourceDeleteBulk(_getInsertfrom()).then(function(status) {
            pl.debug('Deleted current resources');
            var deleteAssets = self.deleteAssets || [];
            for (var i=0; i<deleteAssets.length; i++)
                if (deleteAssets[i].resid) delete deleteAssets[i].resid;
            resolve(true);
        }, function(msg) {
            pl.error('Error deleting current resource');
            reject();
        }); 
    }

    function _getReskey(filename) {
        return nl.fmt2('{}/{}', self.manifestid, filename);
    }
    
    function _getInsertfrom() {
        return nl.fmt2('scorm:{}', self.manifestid);
    }
    
    function _createScormLessons(resolve, reject) {
        if (self.operation == 'create') {
            pl.imp('Uploading SCORM SCOs');
            _createScormLesson(resolve, reject, 0);
            return;
        }
        self.scos = self.currentManifestData.scos;
        pl.imp('Skipping upload of SCORM SCOs');
        resolve(true);
    }
    
    function _createScormLesson(resolve, reject, pos) {
        if (pos > 0) self.actionsDone++;
        _setProgress('action', self.actionsDone, self.actionsMax);
        if (pos == self.scos.length) {
            pl.imp(nl.fmt2('Uploaded {} SCORM SCOs', self.scos.length));
            resolve(true);
            return;
        }
        if ($scope.abort) return _err(reject, 'Aborting on user request');

        var sco = self.scos[pos];
        pos++;
        var aofb = nl.fmt2(' {} of {}', pos, self.scos.length);
        var section0 = nl.fmt2('scorm:/resource/resview/key/{}', _getReskey(sco.href));
        pl.debug('Creating scorm module' +  aofb, sco);
        nlServerApi.lessonCreate(self.template, false, sco.title, section0)
        .then(function(lessonId) {
            pl.debug('Created scorm module' + aofb, lessonId);
            sco.lessonid = lessonId;
            nlServerApi.lessonApprove({lessonid:lessonId, exportLevel:0, selectedOus:[]})
            .then(function(lessonId) {
                pl.debug('Approved scorm module' + aofb, lessonId);
                _createScormLesson(resolve, reject, pos);
            }, function(msg) {
                return _err(reject, 'Failed approving scorm module: ' + msg);
            });
        }, function(msg) {
            return _err(reject, 'Failed creating scorm module: ' + msg);
        });
    }

    function _uploadResources(resolve, reject) {
        pl.imp('Uploading SCORM assets');
        _uploadResource(resolve, reject, 0);
    }

    function _uploadResource(resolve, reject, pos) {
        if (pos > 0) self.actionsDone++;
        _setProgress('action', self.actionsDone, self.actionsMax);
        if (pos == self.assets.length) {
            pl.imp(nl.fmt2('Uploaded {} SCORM assets', self.assets.length));
            resolve(true);
            return;
        }
        if ($scope.abort) return _err(reject, 'Aborting on user request');

        var asset = self.assets[pos];
        pos++;
        var aofb = nl.fmt2(' {} of {}', pos, self.assets.length);

        var fname = asset.href;
        var mimetype = _guessMimeType(fname);
        var f = self.zip.file(fname);
        if (!f) {
            nlDlg.popdownStatus(0);
            pl.warn('Error accessing file from Zip:' + fname);
            _uploadResource(resolve, reject, pos);
            return;
        }
        f.async('arraybuffer').then(function(content) {
            try {
                pl.debug('Upload resource' + aofb, asset);
                var blob = new Blob([content], {type: mimetype});
                blob = new File([blob], fname, {type: mimetype});
                var reskey = _getReskey(fname);
                var resInfo = {resource: blob, restype: 'Attachment', extn: '', 
                    reskey: reskey, insertfrom: _getInsertfrom()};
                nlResourceUploader.uploadInSequence([resInfo], 'SCORM', null, null)
                .then(function(resInfos) {
                    var resInfo = resInfos[0];
                    asset.resid = resInfo.resid;
                    nlDlg.popdownStatus(0);
                    pl.debug('Uploaded resource' + aofb, resInfo);
                    _uploadResource(resolve, reject, pos);
                }, function(msg) {
                    nlDlg.popdownStatus(0);
                    return _err(reject, 'Error uploading resource:' + msg);
                });
            } catch(e) {
                nlDlg.popdownStatus(0);
                return _err(reject, 'Exception uploading resource', e);
            }
        });
    }
    
    function _guessMimeType(fname) {
        return 'application/nittioguess';
    }

    function _q(fn) {
        return function(param) {
            return nl.q(function(resolve, reject) {
                fn(resolve, reject, param);
            });
        };
    }

    var _progressLevels = {
        start: [0, 0],
        init: [0, 4],
        action: [4, 99],
        done: [99, 100]
    };
    
    function _setProgress(currentAction, doneSubItems, maxSubItems) {
        if (!doneSubItems) doneSubItems = 1;
        if (!maxSubItems) maxSubItems = 1;
        var levels = _progressLevels[currentAction];
        var p = levels[0] + (doneSubItems/maxSubItems)*(levels[1] - levels[0]);
        pl.progress(p);
    }
    
    function _err(reject, msg, details) {
        pl.error(msg, details);
        reject(false);
        return false;
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

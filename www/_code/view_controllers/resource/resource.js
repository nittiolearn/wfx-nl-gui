(function() {

//-------------------------------------------------------------------------------------------------
// resource.js:
// resource - Resource upload dialogs and controllers
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.resource', [])
    .config(configFn)
    .directive('nlResourceUpload', ResourceUploadDirective)
    .controller('nl.PdfUploadCtrl', PdfUploadCtrl)
    .service('nlResourceUploader', ResourceUploaderSrv)
    .service('nlProgressFn', ProgressFnSrv)
    .service('nlPdf', PdfSrv);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.upload_pdf', {
        url: '^/upload_pdf',
        views: {
            'appContent': {
                template : '',
                controller: 'nl.PdfUploadCtrl'
            }
        }});
}];

//-------------------------------------------------------------------------------------------------
var ResourceUploadDirective = ['nl', 'Upload', 'nlDlg', 'nlResourceUploader',
function(nl, Upload, nlDlg, nlResourceUploader) {
    function _linkFunction($scope, iElem, iAttrs) {
        $scope.$parent.data[$scope.fieldmodel] = [];
        $scope.accept = _getAcceptString($scope.restype, true);
        $scope.onFileSelect = function(files) {
            _onFileSelect($scope, files);
            if (!('onChange' in $scope.$parent) || 
                !($scope.fieldmodel in $scope.$parent.onChange))
                return;
            $scope.$parent.onChange[$scope.fieldmodel]();
        };
        $scope.onResourceClick = function(fileInfo, pos) {
            _onResourceClick($scope, fileInfo, pos);
        };
        $scope.onResourceRemove = function(fileInfo, pos) {
            _onResourceRemove($scope, fileInfo, pos);
        };
        var field = iElem.find('div')[0];
        nlDlg.addField($scope.fieldmodel, field);
    }
    
    function _onFileSelect($scope, files) {
        $scope.$parent.error[$scope.fieldmodel] = '';
        if ($scope.multiple !== 'true')
            $scope.$parent.data[$scope.fieldmodel] = [];
        for(var i=0; i<files.length; i++) {
            var file = files[i];
            var restype = $scope.restype;
            var extn = nlResourceUploader.getValidExtension(file, restype);
            if (extn === null) {
                $scope.$parent.error[$scope.fieldmodel] = nl.t('Wrong file exension selected. Supported file extensions: "{}"', _getAcceptString($scope.restype, false));
                continue;
            }
            if (!restype) restype = nlResourceUploader.getRestypeFromExt(extn);
            var fileInfo = {resource: file, restype: restype, extn: extn, resimg: _getImage(restype)};
            $scope.$parent.data[$scope.fieldmodel].push(fileInfo);
            _updateImage(fileInfo);
        }
    }
    
    function _updateImage(fileInfo) {
        if (fileInfo.restype != 'Image') return;
        Upload.dataUrl(fileInfo.resource).then(function(url) {
            fileInfo.resimg = url;
        });
    }
    
    function _onResourceClick($scope, fileInfo, pos) {
        var scope = $scope.$new();
        scope.fileInfo = fileInfo;
        if (!fileInfo.date) {
            fileInfo.date = nl.fmt.date2Str(fileInfo.resource.lastModifiedDate, 'second');
        }
        var msg = {title: fileInfo.resource.name, 
           templateUrl: 'view_controllers/resource/resource_desc.html',
           scope: scope,
           okText: nl.t('Remove')};
        nlDlg.popupConfirm(msg).then(function(e) {
            if(!e) return;
            _onResourceRemove($scope, fileInfo, pos);
        });
    }

    function _onResourceRemove($scope, fileInfo, pos) {
        var fileInfos = $scope.$parent.data[$scope.fieldmodel];
        fileInfos.splice(pos,1);
    }
    
    var _restypeToImage = {
        Image: 'dashboard/resource.png', 
        PDF: 'dashboard/pdf.png' , 
        Audio: 'dashboard/audio.png' , 
        Video: 'dashboard/video1.png',
        Attachment: 'dashboard/attach.png'
    };
    function _getImage(restype) {
        return nl.url.resUrl(_restypeToImage[restype]);
    }
    
    function _getAcceptString(restype, bDevCheck) {
        if (!restype) return '';
        if (bDevCheck && nl.pginfo.isMobileOrTab) return '';
        return nlResourceUploader.getRestypeToExtDict()[restype].join(', ');
    }

    return {
        restrict: 'E',
        templateUrl: 'view_controllers/resource/resource_upload.html',
        scope: {
            fieldmodel: '@',
            multiple: '@',
            restype: '@',
            tabindex: '@'
        },
        link: _linkFunction
    };
}];

//-------------------------------------------------------------------------------------------------
var PdfUploadCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'Upload', 'nlPdf', 'nlProgressFn',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, Upload, nlPdf, nlProgressFn) {
    var _template = 0;
    var uploadDlg = nlDlg.create($scope);
    uploadDlg.setCssClass('nl-height-max nl-width-max');

    uploadDlg.scope.options = {};
    uploadDlg.scope.data = {pdf: []};
    uploadDlg.scope.error = {};
    uploadDlg.scope.onChange = {pdf: function() {
        _onPdfChange();
    }};

    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            var params = nl.location.search();
            _template = ('template' in params) ? parseInt(params.template): 0;

            nl.pginfo.pageTitle = nl.t('Upload your content');
            
            uploadDlg.scope.gradeLabel = userInfo.groupinfo.gradelabel || 'Grade';
            uploadDlg.scope.subjectLabel = userInfo.groupinfo.subjectlabel || 'Subject';
            
            uploadDlg.scope.options.grade = _getOptions(userInfo, 'grades'); 
            uploadDlg.scope.options.subject = _getOptions(userInfo, 'subjects'); 

            uploadDlg.scope.data.name = '';
            uploadDlg.scope.data.singlePage = true;
            uploadDlg.scope.data.grade = uploadDlg.scope.options.grade[0];
            uploadDlg.scope.data.subject = uploadDlg.scope.options.subject[0];
            uploadDlg.scope.data.description = '';
            uploadDlg.scope.data.keywords = '';
            resolve(true);
            nl.timeout(function() {
                _showUploadDlg();
            });
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
    
    //---------------------------------------------------------------------------------------------
    function _getOptions(userInfo, optname) {
        var opts = userInfo.groupinfo[optname];
        var ret = [];
        for (var i=0; i<opts.length; i++) {
            ret.push({id: opts[i], name: opts[i]});
        }
        return ret;
    }

    function _showUploadDlg() {
        var uploadButton = {text: nl.t('Upload'), onTap: function(e) {
            if (e) e.preventDefault();
            _upload();
        }};
        var cancelButton = {text: nl.t('Cancel'), onTap: function(e) {
            if (e) e.preventDefault();
            uploadDlg.close(false);
            uploadDlg.destroy();
            nl.location.url('/home');
        }};
        uploadDlg.show('view_controllers/resource/pdf_upload_dlg.html', 
                        [uploadButton], cancelButton, false);
    }

    function _onPdfChange() {
        if (uploadDlg.scope.data.pdf.length != 1) return;
        var fname = uploadDlg.scope.data.pdf[0].resource.name;
        fname = fname.substr(0, fname.lastIndexOf('.'));
        fname = fname.replace(/\-/g, ' ')
        uploadDlg.scope.data.name = fname.replace(/\_/g, ' ');
    }
    
    function _upload() {
        if(!_validateInputs()) return;
        
        nlDlg.showLoadingScreen();
        uploadDlg.close(false);
        _uploadActionsInAsyncChain(uploadDlg.scope.data.pdf[0]).then(function(newLessonId) {
            nlDlg.hideLoadingScreen();
            nlDlg.popupStatus('uploaded complete.');
            nl.window.location.href = nl.fmt2('/lesson/edit/{}', newLessonId);
        }, function error(msg) {
            nlDlg.popdownStatus();
            _showUploadDlg();
            if (msg === undefined) return;
            nlDlg.popupAlert({title: nl.t('Error'), template: nl.t(msg)});
        });
    }

    function _uploadActionsInAsyncChain(fileInfo) {
        return nl.q(function(resolve, reject) {
            
            function _getDataUrl() {
                Upload.dataUrl(fileInfo.resource).then(function success(url) {
                    nlDlg.popupStatus('Opening PDF ...', false);
                    _openPdf(url);
                }, function error(err) {
                    reject(err);
                });
            }
            
            function _openPdf(url) {
                nlPdf.open(url).then(function success(pdfDoc) {
                    nlDlg.popupStatus('Starting upload ...', false);
                    _upload(pdfDoc.numPages);
                }, function error(err) {
                    reject(err);
                });
            }
            
            function _upload(pageCount) {
                var data = {resource: fileInfo.resource, 
                            restype: fileInfo.restype,
                            keywords: uploadDlg.scope.data.keywords, 
                            info: '',
                            name: uploadDlg.scope.data.name, 
                            description: uploadDlg.scope.data.description,
                            subject: uploadDlg.scope.data.subject.id, 
                            grade: uploadDlg.scope.data.grade.id,
                            pagecount: pageCount, 
                            template: _template, 
                            singlepage: uploadDlg.scope.data.singlePage ? 1 : 0};
                data.progressFn = nlProgressFn.onProgress;
                
                nlServerApi.resourceUploadPdf(data).then(function success(newLessonId) {
                    resolve(newLessonId);
                }, function error(msg) {
                    reject();
                });
            }

            _getDataUrl();
        });
    }
    
    function _validateInputs() {
        uploadDlg.scope.error = {};
        if(uploadDlg.scope.data.pdf.length != 1) return _validateFail(uploadDlg.scope, 'pdf', 'Please select a PDF file');
        if(!uploadDlg.scope.data.name) return _validateFail(uploadDlg.scope, 'name', 'Name is mandatory');
        return true;
    }

    function _validateFail(scope, attr, errMsg) {
        return nlDlg.setFieldError(scope, attr,
            nl.t(errMsg));
    }
}];

//-------------------------------------------------------------------------------------------------
var ResourceUploaderSrv = ['nl', 'nlServerApi', 'nlDlg', 'nlProgressFn',
function(nl, nlServerApi, nlDlg, nlProgressFn) {

    var imageShrinker = new ImageShrinker(nl, nlDlg);

    var _restypeToExtension = {
        Image: ['.jpg', '.png', '.gif', '.svg', '.bmp'], 
        PDF: ['.pdf'] , 
        Audio: ['.m4a'] , 
        Video: ['.mp4'],
        Attachment: []
    }; 
    var _restypeToMaxFileSize = {
        Image: 1*1024*1024, 
        PDF: 10*1024*1024, 
        Audio: 10*1024*1024, 
        Video: 30*1024*1024,
        Attachment: 10*1024*1024
    }; 

    var _extToRestype = {};

    function _initExtToRestype() {
        for(var restype in _restypeToExtension) {
            var exts = _restypeToExtension[restype];
            for (var i=0; i<exts.length; i++) {
                _extToRestype[exts[i]] = restype;
            }
        }
    }
    _initExtToRestype();

    this.getRestypeToExtDict = function() {
        return _restypeToExtension;
    };

    this.getRestypeFromExt = function(ext) {
        if (ext in _extToRestype) return _extToRestype[ext];
        return 'Attachment';
    };


    this.uploadInSequence = function(resourceList, keyword, compressionlevel, resid) {
        var self = this;
        return nl.q(function(resolve, reject) {
            var resourceInfos = [];
            _uploadNextReource(self, resourceList, keyword, compressionlevel, resid, resourceInfos, resolve, reject);
        });
    };

    function _uploadNextReource(self, resourceList, keyword, compressionlevel, resid, resourceInfos, resolve, reject) {
        if (resourceList.length == 0) {
            resolve(resourceInfos);
            return;
        }
        var fileInfo = resourceList.shift();
        var validateStatus = {};
        if (!_validateBeforeShrinking(fileInfo, validateStatus, compressionlevel)) {
            nlDlg.popdownStatus(0);
            reject(validateStatus.error);
            return;
        }
        nlDlg.popupStatus(nl.t('Compressing {}', fileInfo.resource.name), false);
        // TODO: compression level from user choice in future
        var bImg = self.getRestypeFromExt(fileInfo.extn) == 'Image'; // actual restype could also be Attachment
        imageShrinker.getShrinkedFile(fileInfo.resource, fileInfo.extn, bImg, compressionlevel,
        function(_file, compInfo) {
            if (!_file) {
                reject(compInfo.status);
                return;
            }
            if (!_validateAfterShrinkingDone(_file, fileInfo.restype)) {
                compInfo.status = nl.fmt2('You cannot upload a {} file greater than {} MB.',
                    fileInfo.restype, _restypeToMaxFileSize[fileInfo.restype]/1024/1024);
                if (fileInfo.restype == 'Image') compInfo.status += ' Please try uploading image with lesser resolution.';
                reject(compInfo.status);
                return;
            }
        	resid = resid ? resid : '';
            
            var data = {resource: _file, 
                        restype: fileInfo.restype,
                        keywords: keyword, 
                        info: angular.toJson(compInfo, 2),
                        resid: resid
                        };
            data.progressFn = nlProgressFn.onProgress;
            nlDlg.popupStatus(nl.t('uploading {}', fileInfo.resource.name), false);
            nlServerApi.resourceUpload(data).then(function success(resinfo) {
                resourceInfos.push(resinfo);
                _uploadNextReource(self, resourceList, keyword, compressionlevel, resid, resourceInfos, resolve, reject);
            }, function error(msg) {
                reject(nl.t('Uploading {} failed:', fileInfo.resource.name, msg));
            });
        });
    }

    this.getValidExtension = function(_file, restype) {
        var fileNameLower = _file.name.toLowerCase();
        var index = fileNameLower.lastIndexOf('.');
        var extn = (index == -1) ? '' : fileNameLower.substring(index);
        if (restype && restype === 'Attachment') return extn;
        
        if (restype && restype != this.getRestypeFromExt(extn)) return null;
        return extn;
    }
    
    function _validateBeforeShrinking(fileInfo, status, compressionLevel) {
        var _file = fileInfo.resource;
        var restype = fileInfo.restype;
        if (!(restype in _restypeToExtension)) {
            status.error = nl.t('Please choose the resource Type, followed by file');
            return false;
        }
        if (_file.size == 0) {
            status.error = nl.t('Empty file cannot be uploaded');
            return false;
        }
        return true;
    }

    function _validateAfterShrinkingDone(shrinkedFile, restype) {
        if (shrinkedFile.size > _restypeToMaxFileSize[restype]) return false;
        return true;
    }
}];

//-------------------------------------------------------------------------------------------------
var ProgressFnSrv = ['nl', 'nlDlg',
function(nl, nlDlg) {
    this.onProgress = function(prog, resName) {
        if (prog < 100)
            nlDlg.popupStatus(nl.t('{}% of data transfered to server', prog), false);
        else
            nlDlg.popupStatus(nl.t('Processing. Please wait ...'), false);
    };
}];
        
//-------------------------------------------------------------------------------------------------
var PdfSrv = ['nl',
function(nl) {
    
    PDFJS.disableWorker = true;

    this.open = function(url) {
        return PDFJS.getDocument(url);
    };
}];

//---------------------------------------------------------------------------------------
//resize the image
//---------------------------------------------------------------------------------------
function ImageShrinker(nl, nlDlg) {
    
    var COMPRESSION_LEVEL = {
        'high': {w: 720, h: 720},
        'medium': {w: 1080, h: 1080},
        'low': {w: 1280, h: 1280}
    };
    var SHRINK_QUALITY = {low: 0.7, medium: 0.8, high: 0.9, uhigh: 1.0};

    this.getShrinkedFile = function(_file, fileExtn, bImg, compressionLevel, onDone) {
        try {
            _readAsDataUrl(_file, fileExtn, onDone, bImg, compressionLevel);
        } catch(e) {
            var compInfo = {};
            compInfo.status = nl.t('Compression of {} failed: readAsDataURL error', _file.name);
            onDone(null, compInfo);
        }
    };

    function _readAsDataUrl(_file, fileExtn, onDone, bImg, compressionLevel) {
        var shrinkSize = null;
        var compInfo = {compression: compressionLevel, origName: _file.name, origSize: _file.size};
        if (compressionLevel in COMPRESSION_LEVEL) {
            shrinkSize = COMPRESSION_LEVEL[compressionLevel];
        }
        if(!bImg) {
            compInfo.status = 'No compression done';
            onDone(_file, compInfo);
            return;
        }
        var reader = new FileReader();
        reader.onerror = function (e) {
            compInfo.status = nl.t('Compression of {} failed: FileReader error', _file.name);
            onDone(_file, compInfo);
        };
        reader.onload = function (loadEvent) {
            var origUrl = loadEvent.target.result;
            if(!shrinkSize) {
                compInfo.status = 'No compression done';
                onDone(_file, compInfo);
                return;
            }
            var bJpg = (fileExtn == '.jpg');
            _shrinkImage(bJpg, origUrl, shrinkSize, compInfo, function(shrinkedUrl, compInfo) {
                if (!shrinkedUrl) {
                    onDone(_file, compInfo);
                    return;
                }
                var newFileName = bJpg ? _file.name : _file.name.replace(fileExtn, '.png');
                var shrinkedFile = _dataUrlToImgFile(shrinkedUrl, newFileName);
                compInfo.compressedName = shrinkedFile.name;
                compInfo.compressedSize = shrinkedFile.size;
                if (shrinkedFile.size > _file.size) {
                    compInfo.status = 'Compression not used as compressed size is larger';
                    onDone(_file, compInfo);
                    return;
                }
                compInfo.status = 'Compression done';
                onDone(shrinkedFile, compInfo);
            });
        };
        reader.readAsDataURL(_file);
    }
    
    function _shrinkImage(bJpg, imgUrl, shrinkSize, compInfo, onShrinkDone) {
        var document = window.document;
        var img = document.createElement('img');
        img.onerror = function (e) {
            compInfo.status = 'Compression failed: Image load error';
            onShrinkDone(null, compInfo);
        };
        img.onload = function (data) {
            _onImgLoad(document, bJpg, img, shrinkSize, compInfo, onShrinkDone);
        };
        img.src = imgUrl;
    }

    function _onImgLoad(document, bJpg, img, shrinkSize, compInfo, onShrinkDone) {
        try {
            var imgSize = _getNewImgSize(img, shrinkSize, compInfo);
            compInfo.compressedWidth = imgSize.w;
            compInfo.compressedHeight = imgSize.h;
            var canvas = document.createElement('canvas');
            canvas.width = imgSize.w;
            canvas.height = imgSize.h;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, imgSize.w, imgSize.h);
            var shrinkedUrl = bJpg ? canvas.toDataURL('image/jpeg', 0.9) : canvas.toDataURL('image/png');
            if (!shrinkedUrl) {
                compInfo.status = 'Compression failed: toDataURL error';
                onShrinkDone(null, compInfo);
                return;
            }
            onShrinkDone(shrinkedUrl, compInfo);
        } catch(e) {
            compInfo.status = 'Compression failed: onImgLoad exception';
            onShrinkDone(null, compInfo);
        }
    }
    
    function _getNewImgSize(img, shrinkSize, compInfo) {
        var ret = {w: img.width, h: img.height};
        compInfo.origWidth = ret.w;
        compInfo.origHeight = ret.h;
        if (ret.w <= shrinkSize.w && ret.h <= shrinkSize.h) return ret;
        
        if (ret.w > ret.h) {
            return {w: shrinkSize.w, h: ret.h*shrinkSize.w/ret.w};
        }
        return {w: ret.w*shrinkSize.h/ret.h, h: shrinkSize.h};
    }    

    function _dataUrlToImgFile(dataUrl, fileName) {
        var MARKER = ';base64,';
        var b64 = true;
        if (dataUrl.indexOf(MARKER) == -1) {
            b64 = false;
            MARKER = ',';
        }
        var parts = dataUrl.split(MARKER);
        var contentType = parts[0].split(':')[1];
        var raw = parts[1];
        if (!b64) return new File([raw], fileName, {type: contentType});
    
        raw = window.atob(raw);
        var rawLength = raw.length;
        var uInt8Array = new Uint8Array(rawLength);
        for (var i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        return new File([uInt8Array], fileName, {type: contentType});
    }
}

//-------------------------------------------------------------------------------------------------
module_init();
})();

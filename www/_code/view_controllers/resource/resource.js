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
        $scope.accept = _getAcceptString($scope.restype);
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

        $scope.imageEditor = function(imagesrc, pos) {
            imageEditor($scope, imagesrc, pos);
        };

        $scope.intializeEditor =function(id) {
            intializeEditor(id);
        };

        var field = iElem.find('div')[0];
        nlDlg.addField($scope.fieldmodel, field);
        nl.timeout(function() {
            $scope.$parent.data.fieldrefer = {};
            var fieldrefer = $scope.$parent.data.fieldrefer;
            var elemid = '#' + $scope.fieldid;
            fieldrefer.elem = angular.element(document.querySelector(elemid));
            fieldrefer['elem'].bind('click', function(e) {
                console.log('...');
            });
        });
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
                $scope.$parent.error[$scope.fieldmodel] = nl.t('Wrong file exension selected. Supported file extensions: "{}"', _getExtns($scope.restype));
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

    function imageEditor($scope,imagesrc,pos) {
        var EditorDlg =$scope.$new();
        EditorDlg.fileInfo=imagesrc;
        var msg = {title: 'Image Editor', 
            templateUrl: 'view_controllers/resource/image_editor.html',
            scope: EditorDlg,
            okText: nl.t('OK')
        };
            var imageEditor;
            $scope.intializeEditor = function(id) {
                    imageEditor = new tui.ImageEditor('#'+id , {
                        includeUI: {
                            loadImage: {
                                path: imagesrc,
                                name: 'edited-image'
                            },
                            initMenu: 'filter',
                            menuBarPosition: 'bottom',
                        },
                        cssMaxWidth: 700,
                        cssMaxHeight: 500,
                        usageStatistics: false
                    });
                    window.onresize = function() {
                        imageEditor.ui.resizeEditor();
                    }
                }
            nlDlg.popupConfirm(msg).then(function(e) {
                if(!e) return;
                
                _applyEditor($scope, imagesrc, pos);
            });
            function _applyEditor($scope, imagesrc, pos) {
                var editedFile=[];
                var editedImagesrc=imageEditor.toDataURL();
                var blobfile=nlResourceUploader.dataURItoBlob(editedImagesrc);
                editedFile.push(blobfile);
                _onFileSelect($scope, editedFile)
             }
     };

    function _onResourceClick($scope, fileInfo, pos) {
        var scope = $scope.$new();
        scope.fileInfo = fileInfo;
        if (!fileInfo.date) {
            fileInfo.date = fileInfo.resource.lastModifiedDate;
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
    
    // Check if _RT_DICT is in Sync when changing this. Already Zip, Csv
    // and Xls are not present there
    var _restypeToImage = {
        Image: 'dashboard/resource.png', 
        PDF: 'dashboard/pdf.png' , 
        Audio: 'dashboard/audio.png' , 
        Video: 'dashboard/video1.png',
        Attachment: 'dashboard/attach.png',
        Zip: 'dashboard/attach.png', // Used in SCORM import
        Xls: 'dashboard/attach.png', // Used in Lesson import
        Csv: 'dashboard/attach.png'  // Used in Admin import
    };
    function _getImage(restype) {
        return nl.url.resUrl(_restypeToImage[restype]);
    }
    
    function _getAcceptString(restype) {
        if (!restype) return '';
        if (nl.pginfo.isMobileOrTab && restype == 'PDF') return '';
        return nlResourceUploader.getRestypeToAcceptString(restype);
    }

    function _getExtns(restype) {
        return nlResourceUploader.getRestypeToExts(restype).join(', ');
    }
    return {
        restrict: 'E',
        templateUrl: 'view_controllers/resource/resource_upload.html',
        scope: {
            fieldmodel: '@',
            multiple: '@',
            restype: '@',
            fieldindex: '@',
            fieldid: '@'
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
            uploadDlg.scope.data.singlePage = false;
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
                
                // TODO-LATER: Use resumeable_upload later
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
    // TODO-LATER: Remove 'old_upload' code after Feb 2020.
    // prerequisites for removal: 
    // a. handling upload from local machine
    // b. refactor pdf upload
    // c. refactor polly autovoice
    var localHost = nl.window.location.protocol.toLowerCase() == 'http:';
    var oldUpload = ('old_upload' in nl.location.search());
    var isApi3 = ('api3' in nl.location.search()); //to enable resumable upload on localhost in case it is routed through nittio3 , only checks the url and not group settings
    var _resumableUploader = localHost & !isApi3 || oldUpload ? nlServerApi : new ResumableUploader(nl, nlServerApi, nlDlg);

    var _restypeToAcceptString = {
        Image: 'image/*', 
        PDF: '.pdf', 
        Audio: 'audio/*', 
        Video: 'video/*',
        Attachment: '',
        Zip: '.zip',
        Xls: '.csv, .xlsx, .xlsm, .ods, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel',
        Csv: '.csv'
    }; 
    var _restypeToMaxFileSize = {
        Image: 100*1024*1024, // 100 MB
        PDF: 100*1024*1024, // 100 MB
        Audio: 100*1024*1024, // 100 MB
        Video: 1024*1024*1024, // 1 GB
        Attachment: 100*1024*1024, // 100 MB
        Zip: 300*1024*1024, // 300 MB
        Xls: 300*1024*1024, // 300 MB
        Csv: 100*1024*1024 // 100 MB
    }; 

    // Frist in the list is the default restype for the extension
    var _extToRestypes = {
        '.jpg': ['Image'], '.png': ['Image'], '.jpeg': ['Image'], '.gif': ['Image'], '.svg': ['Image'], '.bmp': ['Image'],
        '.pdf': ['PDF'],
        '.mp3': ['Audio'], '.m4a': ['Audio'],
        '.mp4': ['Video', 'Audio'], 
        '.webm': ['Video', 'Audio'], 
        '.zip': ['Zip'],
        '.xls': ['Xls'], '.xlsx': ['Xls'], '.xlsm': ['Xls'], '.xlsmb': ['Xls'], '.ods': ['Xls'],
        '.csv': ['Csv']};

    var _restypeToExtensions = {
        Image: [], 
        PDF: [] , 
        Audio: [] , 
        Video: [],
        Attachment: [],
        Zip: [],
        Xls: ['.csv'], // .csv is present here as well as in Csv.
        Csv: []
    }; 

    function _initRestypeToExtensions() {
        for(var ext in _extToRestypes) {
            var restypes = _extToRestypes[ext];
            for (var i=0; i<restypes.length; i++) {
                _restypeToExtensions[restypes[i]].push(ext);
            }
        }
    }
    _initRestypeToExtensions();

    this.getRestypeToExts = function(restype) {
        return _restypeToExtensions[restype];
    };

    this.getRestypeToAcceptString = function(restype) {
        return _restypeToAcceptString[restype];
    };

    this.getRestypeFromExt = function(ext) {
        if (ext in _extToRestypes) return _extToRestypes[ext][0];
        return 'Attachment';
    };


    this.uploadInSequence = function(resourceList, keyword, compressionlevel, resid, resourceInfoDict) {
        var self = this;
        return nl.q(function(resolve, reject) {
            var resourceInfos = [];
            _uploadNextResource(self, resourceList, keyword, compressionlevel, resid, resourceInfos, resourceInfoDict, resolve, reject);
        });
    };

    this.dataURItoBlob = function(dataURI) {
        return _dataURItoBlob(dataURI);
    }

    function _dataURItoBlob(dataURI) {
        var byteString = atob(dataURI.split(',')[1]);
        var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
        var arraybuffer = new ArrayBuffer(byteString.length);
        var unitArray = new Uint8Array(arraybuffer);
        for (var i = 0; i < byteString.length; i++) {
            unitArray[i] = byteString.charCodeAt(i);
        }
        // write the ArrayBuffer to a blob, and you're done
        var blobFile = new File([unitArray],'image.png',{ type: mimeString })
        return blobFile;
    }

    function _uploadNextResource(self, resourceList, keyword, compressionlevel, resid, resourceInfos, resourceInfoDict, resolve, reject) {
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
            if(resourceInfoDict.animated) compInfo.animated = 1;
            if(resourceInfoDict.bgShade) compInfo.bgShade = resourceInfoDict.bgShade;
            var data = {resource: _file, 
                        restype: fileInfo.restype || 'Image',
                        filename: resourceInfoDict.filename || fileInfo.name,
                        name: resourceInfoDict.name || fileInfo.name,
                        keywords: keyword || "", 
                        info: angular.toJson(compInfo, 2),
                        resid: resid,
                        batchMode: resourceInfoDict.batchMode || false,
                        shared: resourceInfoDict.shared,
                        updateUserDatabase: resourceInfoDict.updateUserDatabase || false
                        };
            if (fileInfo.reskey) data.reskey = fileInfo.reskey;
            data.insertfrom = resourceInfoDict.insertfrom || '/';
            data.progressFn = nlProgressFn.onProgress;
            nlDlg.popupStatus(nl.t('uploading {}', fileInfo.resource.name), false);
            _resumableUploader.resourceUpload(data).then(function success(resinfo) {
                resourceInfos.push(resinfo);
                _uploadNextResource(self, resourceList, keyword, compressionlevel, resid, resourceInfos, resourceInfoDict, resolve, reject);
            }, function error(msg) {
                reject(nl.t('Uploading {} failed: {}', fileInfo.resource.name, msg));
            });
        });
    }

    this.getValidExtension = function(_file, restype) {
        var fileNameLower = _file.name.toLowerCase();
        var index = fileNameLower.lastIndexOf('.');
        var extn = (index == -1) ? '' : fileNameLower.substring(index);
        if (!restype || restype === 'Attachment') return extn;
        var allowedExtns = this.getRestypeToExts(restype);
        for (var i=0; i<allowedExtns.length; i++)
            if (extn == allowedExtns[i]) return extn;
        return null;
    };
    
    function _validateBeforeShrinking(fileInfo, status, compressionLevel) {
        var _file = fileInfo.resource;
        var restype = fileInfo.restype || 'Image';
        if (!(restype in _restypeToExtensions)) {
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
        	compInfo.compression = 'No compression';
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
            	compInfo.compression = 'No compression';
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
function ResumableUploader(nl, nlServerApi, nlDlg) {

    var _batchMode = false;
    this.resourceUpload = function(data) {
        _batchMode = data.batchMode || false; 
        var impl = new ResumableUploaderImpl(nl, nlServerApi, nlDlg, this);
        return impl.resourceUpload(data);
    };
    this.popupRetryDlg = function(onRetry, onCancel) {
        _waiting.push({onRetry: onRetry, onCancel: onCancel});
        if (_waiting.length > 1) return;
        var msg = 'Upload is interrupted due to slow network. Check your network and press resume to continue the upload.';
        nlDlg.popupConfirm({title: 'Upload Interrupted', template: msg, 
            okText: 'Resume', cancelText: 'Cancel'}).then(function(result) {
            if (!_batchMode) nlDlg.showLoadingScreen();
            _callAllWaiting(result ? true : false);
        });
    };

    var _waiting = [];
    function _callAllWaiting(isRetry) {
        var waiting = _waiting;
        _waiting = [];
        for(var i=0; i<waiting.length; i++) {
            if (isRetry) waiting[i].onRetry();
            else waiting[i].onCancel('Upload is cancelled');
        }
    }
}

function ResumableUploaderImpl(nl, nlServerApi, nlDlg, resumableUploader) {
    var _state = {};
    var CHUNK_SIZE = 2*1024*1024;
    
    this.resourceUpload = function(data) {
        return nl.q(function(resolve, reject) {
            _state.retryCount = 0;
            _getResumableResourceUrl(data, function(result) {
                _state.start = 0;
                _state.retryCount = 0;
                _state.resumableUrl = result.location;
                _state.gcsUri = result.gcsUri;
                _resourceUploadNextChunk(data, function(data2) {
                    nlDlg.popupStatus(nl.fmt2('{} uploaded', data.resource.name));
                    if (!data.batchMode) nlDlg.hideLoadingScreen();
                    resolve(data2);
                }, function(err) {
                    nlDlg.popdownStatus(0);
                    if (!data.batchMode) nlDlg.hideLoadingScreen();
                    reject(err);
                });
            }, reject);
        });
    };

    function _getResumableResourceUrl(data, resolve, reject) {
        _retryAfterTimeout(function() {
            _getResumableResourceUrlImpl(data, resolve, reject);
        }, reject);
    }

    function _getResumableResourceUrlImpl(data, resolve, reject) {
        nlServerApi.executeRestApi3('resource_get_resumable_upload_url',
        {
            name: data.resource.name,
            contenttype: data.resource.type,
            contentlength: data.resource.size
        }, false, true).then(function(result) {
            if (!result.location) reject('Not able to get the url to upload.');
            resolve(result);
        }, function() {
            _getResumableResourceUrl(data, resolve, reject);
        });
    }

    function _resourceUploadNextChunk(data, resolve, reject) {
        if (_state.start >= data.resource.size) {
            return reject('Failed to upload - too many chunks.');
        }
        var chunkSize = (data.resource.size - _state.start);
        if (chunkSize > CHUNK_SIZE) chunkSize = CHUNK_SIZE;
        _state.end = _state.start + chunkSize;
        
        if (chunkSize > data.resource.size) chunkSize = data.resource.size;
        var contentRange = nl.fmt2('bytes {}-{}/{}', _state.start, _state.end-1, data.resource.size);
        var fileChunk = data.resource.slice(_state.start, _state.end);
        fileChunk.name = data.resource.name;
        var req = {
            method: 'PUT',
            url: _state.resumableUrl,
            headers: {
                'Content-Type'  : data.resource.type,
                'Content-Range' : contentRange,
                'Access-Control-Allow-Origin': '*'
            },
            data: fileChunk
        };
        nl.http(req).then(function(success) {
            _resourceSaveToDB(data, success.data, resolve, reject);
        }, function(errorResp) {
            if (errorResp.status == 308) {
                _handle308AndUploadNextChunk(errorResp, data, resolve, reject);
            } else {
                _retryUploadOfNextChunk(data, resolve, reject);
            }
        });
    }

    function _handle308AndUploadNextChunk(resp, data, resolve, reject) {
        var headers = resp.headers();
        _state.start = 'range' in headers ? parseInt(headers['range'].split('-')[1])+1 : 0;
        _state.retryCount = 0;
        var perc = parseInt(100.0*_state.start/data.resource.size);
        nlDlg.popupStatus(nl.fmt2('{} - {}% uploaded', data.resource.name, perc), false);
        _resourceUploadNextChunk(data, resolve, reject);
    }

    function _retryUploadOfNextChunk(data, resolve, reject) {
        _retryAfterTimeout(function() {
            _retryUploadOfNextChunkImpl(data, resolve, reject);
        }, reject);
    }

    function _retryUploadOfNextChunkImpl(data, resolve, reject) {
        var req = {
            method: 'PUT',
            url: _state.resumableUrl,
            headers: {
                'Content-Range' : 'bytes */*'
            }
        };
        nl.http(req).then(function(success) {
            _resourceSaveToDB(data, success.data, resolve, reject);
        }, function(retryResponse) {
            if (retryResponse.status == 308) {
                return _handle308AndUploadNextChunk(retryResponse, data, resolve, reject);
            }
            _retryUploadOfNextChunk(data, resolve, reject);
        });
    }

    function _resourceSaveToDB(data, resInfo, resolve, reject) {
        nlDlg.popupStatus(nl.fmt2('{} uploaded. Processing ...', data.resource.name), false);
        _state.dbData = {resInfo: resInfo, data: {
            'info': data['info'] || '',
            'keywords': data['keywords'] || '',
            'gcsUri': _state.gcsUri || '',
            'restype': data['restype'] || '',
            'reskey': data['reskey'] || '',
            'filename': data.resource.name || '',
            'insertfrom' : data['insertfrom'] || '',
            'shared' : data['shared'] || ''
        }};
        _state.retryCount = 0;
        _retrySaveToDB(resolve, reject);
    }

    function _retrySaveToDB(resolve, reject) {
        _retryAfterTimeout(function() {
            _retrySaveToDBImpl(resolve, reject);
        }, reject);
    }

    function _retrySaveToDBImpl(resolve, reject) {
        nlServerApi.executeRestApi3('resource_save_to_db', _state.dbData, false, true)
        .then(resolve, function() {
            _retrySaveToDB(resolve, reject);
        });
    }

    function _retryAfterTimeout(onRetry, onCancel) {
        if (_state.retryCount > 3) {
            return _popupRetryDlg(onRetry, onCancel);
        }
        var timeout = _state.retryCount == 0 ? 0 : _state.retryCount == 1 ? 2000 : 5000;
        nl.timeout(function() {
            _state.retryCount++;
            onRetry();
        }, timeout);
    }

    function _popupRetryDlg(onRetry, onCancel) {
        resumableUploader.popupRetryDlg(function() {
            _state.retryCount = 0;
            onRetry();
        }, onCancel);
    }

}

//-------------------------------------------------------------------------------------------------
module_init();
})();

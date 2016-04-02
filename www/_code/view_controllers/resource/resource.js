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
    .service('nlPdf', PdfSrv);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.upload_pdf', {
        url: '^/upload_pdf',
        views: {
            'appContent': {
                templateUrl: 'view_controllers/resource/upload_pdf.html',
                controller: 'nl.PdfUploadCtrl'
            }
        }});
}];

//-------------------------------------------------------------------------------------------------
var ResourceUploadDirective = ['nl', 'Upload', 'nlDlg',
function(nl, Upload, nlDlg) {
    function _linkFunction($scope, iElem, iAttrs) {
        $scope.imgBasePath = nl.url.resUrl();
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
        }
        $scope.onResourceRemove = function(fileInfo, pos) {
            _onResourceRemove($scope, fileInfo, pos);
        }
        var field = iElem.find('div')[0];
        nlDlg.addField($scope.fieldmodel, field);
    }
    
    function _onFileSelect($scope, files) {
        if ($scope.multiple !== 'true')
            $scope.$parent.data[$scope.fieldmodel] = [];
        for(var i=0; i<files.length; i++) {
            var file = files[i];
            var restype = $scope.restype;
            if (!restype) {
                var ext = file.name.substr(file.name.lastIndexOf('.')).toLowerCase();
                restype = _getRestype(ext);
            }
            var compInfo = {status: 'No compression done'};
            var fileInfo = {resource: file, restype: restype, info: angular.toJson(compInfo),
                resimg: _getImage(restype)};
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
    
    var _restypeToExtension = {
        Image: ['.jpg', '.png', '.gif', '.svg', '.bmp'], 
        PDF: ['.pdf'] , 
        Audio: ['.m4a'] , 
        Video: ['.mp4'],
        Attachment: []
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

    function _getRestype(ext) {
        if (ext in _extToRestype) return _extToRestype[ext];
        return 'Attachment';
    }

    function _getAcceptString(restype) {
        if (!restype) return '';
        return _restypeToExtension[restype].join(',');
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
var PdfUploadCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'Upload', 'nlPdf',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, Upload, nlPdf) {
    var _template = 0;

    $scope.options = {};
    $scope.data = {pdf: []};
    $scope.error = {};
    $scope.onChange = {pdf: function() {
        _onPdfChange();
    }};

    $scope.upload = function(e) {
        _upload(e);
    };
    
    $scope.cancel= function(e) {
        nl.location.url('/home');
    }

    function _onPageEnter(userInfo) {
        return nl.q(function(resolve, reject) {
            var params = nl.location.search();
            _template = ('template' in params) ? parseInt(params.template): 0;

            $scope.gradeLabel = userInfo.groupinfo.gradelabel || 'Grade';
            $scope.subjectLabel = userInfo.groupinfo.subjectlabel || 'Subject';
            
            $scope.options.grade = _getOptions(userInfo, 'grades'); 
            // TODO-MUNNI: remove below line
            $scope.options.subject = _getOptions(userInfo, 'grades'); 
            //$scope.options.subject = _getOptions(userInfo, 'subjects'); 

            $scope.data.name = '';
            $scope.data.grade = $scope.options.grade[0];
            $scope.data.subject = $scope.options.subject[0]
            $scope.data.description = '';
            $scope.data.keywords = '';
            resolve(true);
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

    function _onPdfChange() {
        if ($scope.data.pdf.length != 1) return;
        var fname = $scope.data.pdf[0].resource.name;
        fname = fname.substr(0, fname.lastIndexOf('.'));
        fname = fname.replace(/\-/g, ' ')
        $scope.data.name = fname.replace(/\_/g, ' ');
    }
    
    function _upload(e) {
        if(!_validateInputs()) {
            if(e) e.preventDefault();
            return;
        }
        
        nlDlg.showLoadingScreen();
        _uploadActionsInAsyncChain($scope.data.pdf[0]).then(function(newLessonId) {
            nlDlg.hideLoadingScreen();
            nlDlg.popupStatus('uploaded complete.');
            nl.window.location.href = nl.fmt2('/lesson/edit/{}', newLessonId);
        }, function error(msg) {
            nlDlg.popdownStatus();
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
                var data = {resource: fileInfo.resource, restype: fileInfo.restype,
                            keywords: $scope.data.keywords, info: fileInfo.info,
                            name: $scope.data.name, description: $scope.data.description,
                            subject: $scope.data.subject.id, grade: $scope.data.grade.id,
                            pagecount: pageCount, template: _template};
                data.progressFn = function(prog, resName) {
                    if (prog < 100)
                        nlDlg.popupStatus(nl.t('{}% of data transfered to server', prog), false);
                    else
                        nlDlg.popupStatus(nl.t('Processing. Please wait ...'), false);
                };
                
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
        $scope.error = {};
        if($scope.data.pdf.length != 1) return _validateFail($scope, 'pdf', 'Please select a PDF file');
        if(!$scope.data.name) return _validateFail($scope, 'name', 'Name is mandatory');
        return true;
    }

    function _validateFail(scope, attr, errMsg) {
        return nlDlg.setFieldError(scope, attr,
            nl.t(errMsg));
    }
}];

//-------------------------------------------------------------------------------------------------
var PdfSrv = ['nl',
function(nl) {
    
    PDFJS.disableWorker = true;

    this.open = function(url) {
        return PDFJS.getDocument(url);
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

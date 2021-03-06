(function() {

//-------------------------------------------------------------------------------------------------
// course_canvas_view.js:
// course_canvas_view module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.course_canvas_view', [])
    .service('nlCourseCanvas', NlCourseCanvasSrv)
    .directive('nlCourseCanvasView', CourseCanvasViewDirective);
}

//-------------------------------------------------------------------------------------------------
var CourseCanvasViewDirective = ['nl', 'nlDlg', 'nlCourseCanvas',
function(nl, nlDlg, nlCourseCanvas) {

    function _positionBgImage($scope, holder1) {
        var canvas = $scope.canvas;
        if (!canvas) return;
        var imgUrl = canvas.bgimg;
        if (!imgUrl) {
            canvas.status = 'ok'; 
            return;
        }

        canvas.status = 'loading'; 
        var size = nlCourseCanvas.loadBgImg(imgUrl, function(imgSize) {
            nl.timeout(function() {
                if (!imgSize.w || !imgSize.h) {
                    canvas.status = 'error';
                    return;
                }
                canvas.t = 0;
                canvas.l = 0;
                canvas.h = 100;
                canvas.w = 100;
                canvas.status = 'ok';
                var w = holder1.offsetWidth;
                var h = holder1.offsetHeight;
                if (!w || !h) return;
                // arr = aspectRatioRatio
                var arr = (w/h)*(imgSize.h/imgSize.w);
                if (arr < 1) {
                    canvas.h = arr*100;
                    canvas.t = (100 - canvas.h)/2;
                } else {
                    canvas.w= 100/arr;
                    canvas.l= (100 - canvas.w)/2;
                }
                canvas.loadedimg = imgUrl;
            });
        });
    }

    var debouncer = nl.CreateDeboucer();
    var templateUrl = 'view_controllers/course/canvas/course_canvas_view.html';
    var ret = {restrict: 'E', templateUrl: templateUrl, scope: true,
    link: function($scope, iElem, iAttrs) {
        var holder1 = iElem[0].querySelector('.holder1');
        var pScope = $scope.$parent.$parent;
        _positionBgImage(pScope, holder1);
        pScope.onCanvasChange = function() {
            _positionBgImage(pScope, holder1);
        };
        angular.element(nl.window).on('resize', debouncer.debounce(200, function() {
            _positionBgImage(pScope, holder1);
        }));
    }};
    return ret;
}];

//-------------------------------------------------------------------------------------------------
var NlCourseCanvasSrv = ['nl', 'nlDlg',
function(nl, nlDlg) {
    
    var $scope = null;
    var mode = null;
    var course = null;
    var treeList = null;
    this.init = function(_scope, _modeHandler, _treeList, userInfo) {
        $scope = _scope;
        $scope.canvas = {};
        _setupFunctions();
        course = _modeHandler.course || {};
        treeList = _treeList;
        $scope.canvasMode = (course.content || {}).canvasview || false;
        if (!$scope.canvasMode) {
            $scope.canvasShown = false;
            return;
        }
        if (!$scope.ext.isEditorMode()) $scope.canvasShown = true;
        if ($scope.onCanvasChange) $scope.onCanvasChange();
    };
    
    function _setupFunctions() {
        var c = $scope.canvas;
        c.currentPin = -1;
        c.showPin = function(e, index) {
            if (c.currentPin == index) return c.closePins(e);
            e.stopImmediatePropagation();
            e.preventDefault();
            c.currentPin = index;
            $scope.ext.setCurrentItem(c.pins[index].cm);
        };

        c.closePins = function(e) {
            e.stopImmediatePropagation();
            e.preventDefault();
            c.currentPin = -1;
        };
        
        c.onDetails = function(e, index) {
            e.stopImmediatePropagation();
            e.preventDefault();
            $scope.canvasShown = false;
			$scope.isDetailsShown = true;
            $scope.updateVisiblePanes();
        };

        c.onOpen = function(e, index) {
            e.stopImmediatePropagation();
            e.preventDefault();
            var current = $scope.ext.item;
            if (current.type == 'module') {
                var children = treeList.getChildren(current);
                if (children.length > 0) {
                    if (!current.isOpen) treeList.toggleItem(current);
                    $scope.showVisible(children[0]);
                }
            } else if ($scope.ext.canLaunch()) {
            	$scope.canvasShown = true;
                $scope.onLaunch(e, $scope.ext.item);
            }
        };
    }

    this.updateCanvasMode = function(newMode) {
        $scope.canvasMode = (course.content || {}).canvasview || false;
        this.update();
    };
    
    this.update = function() {
        if (!$scope.canvasMode) {
            $scope.canvasShown = false;
            return;
        }
        var selected = $scope.ext.item;
        var item = treeList.getParent($scope.ext.item) || $scope.ext.item;
        _updateCanvas(item, selected, $scope.canvas);
        if ($scope.onCanvasChange) $scope.onCanvasChange();
    };
    
    function _updateCanvas(item, selected, canvas) {
        var obj = item;
        if (item.id == treeList.getRootItem().id) obj = course.content || {};
        canvas.bgcolor = obj.bgcolor || 'rgba(255, 255, 255, 1)';
        if (canvas.bgimg != obj.bgimg) {
            canvas.currentPin = -1;
            canvas.bgimg = obj.bgimg || null;
            canvas.loadedimg = null;
            canvas.t = 0;
            canvas.l = 0;
            canvas.h = 100;
            canvas.w = 100;
        }
        var children = treeList.getChildren(item);
        canvas.pins = _getCanvasPins(children, selected);
    }

    function _getCanvasPins(cms, selected) {
        var pins = [];
        var slotUsed = {};
        for (var i=0; i<cms.length; i++) {
            var cm = cms[i];
            pins.push(_getCanvasPin(cm, selected, slotUsed));
        }
        
        var nextSlot = 0;
        for (var i=0; i<pins.length; i++) {
            var pin = pins[i];
            if (pin.ok) continue;
            nextSlot = _assignNextSlot(pin.cm, nextSlot, slotUsed);
            _updateCanvasPin(pin, slotUsed);
        }
        return pins;
    }

    var SLOTX = 5;
    var SLOTY = 4;
    var POPUPGAP = 2;

    function _getCanvasPin(cm, selected, slotUsed) {
        var pin= {cm: cm, ok: false};
        if (selected && selected.id == cm.id) pin.selected=true;
        var children = treeList.getChildren(cm);
        pin.hasChildren = (children.length > 0);
        _updateCanvasPin(pin, slotUsed);
        return pin;
    }

    function _updateCanvasPin(pin, slotUsed) {
        var cm = pin.cm;
        if (!('posX' in cm) || !('posY' in cm)) return;
        pin.quadCls = '';
        _updateXPos(pin, cm);
        _updateYPos(pin, cm);
        _addPercSign(pin);
        _updateSlotUsed(cm, slotUsed);
        pin.ok = true;
    }

    function _updateXPos(pin, cm) {
        if (cm.posX <= 50) {
            pin.l =  cm.posX;
            pin.r =  'auto';
            pin.quadCls += ' quadL';
        } else {
            pin.l =  'auto';
            pin.r =  100 - cm.posX;
            pin.quadCls += ' quadR';
        }
    }
    
    function _updateYPos(pin, cm) {
        if (cm.posY <= 50) {
            pin.t =  cm.posY;
            pin.b =  'auto';
            pin.quadCls += ' quadT';
        } else {
            pin.t =  'auto';
            pin.b =  100 - cm.posY;
            pin.quadCls += ' quadB';
        }
    }
    
    function _addPercSign(pin) {
        var attrs = ['t', 'b', 'l', 'r'];
        for(var i=0; i<attrs.length; i++)
            if (pin[attrs[i]] != 'auto') pin[attrs[i]] = '' + pin[attrs[i]] + '%';
    }

    function _updateSlotUsed(cm, slotUsed) {
        var slotX = Math.floor(cm.posX*SLOTX/100);
        var slotY = Math.floor(cm.posY*SLOTY/100);
        var slot = slotY*SLOTX + slotX;
        slotUsed[slot] = true;
    }

    function _assignNextSlot(cm, nextSlot, slotUsed) {
        while (slotUsed[nextSlot]) {
            if (nextSlot == SLOTX*SLOTY-1) break;
            nextSlot++;
        }
        var slotX = nextSlot % SLOTX;
        var slotY = Math.floor(nextSlot / SLOTX);
        if (!('posX' in cm)) cm.posX = Math.round(100*(slotX+0.5)/SLOTX);
        if (!('posY' in cm)) cm.posY = Math.round(100*(slotY+0.5)/SLOTY);
        if (nextSlot < SLOTX*SLOTY-1) nextSlot++;
        return nextSlot;
    }

    var _imgToSizeCache = {};
    this.loadBgImg = function(imgUrl, onLoadDone) {
        if (_imgToSizeCache[imgUrl]) return onLoadDone(_imgToSizeCache[imgUrl]);
        
        var imgSize = {w: 0, h: 0};
        var document = window.document;
        var img = document.createElement('img');
        img.onerror = function (e) {
            _imgToSizeCache[imgUrl] = imgSize;
            onLoadDone(imgSize);
        };
        img.onload = function (data) {
            imgSize = {w: img.width, h: img.height};
            _imgToSizeCache[imgUrl] = imgSize;
            onLoadDone(imgSize);
        };
        img.src = imgUrl;
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();
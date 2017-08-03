(function() {

//-------------------------------------------------------------------------------------------------
// course_canvas_view.js:
// course_canvas_view module
//-------------------------------------------------------------------------------------------------
function module_init() {
    var templateUrl = 'view_controllers/course/canvas/course_canvas_view.html';
    angular.module('nl.course_canvas_view', [])
    .service('nlCourseCanvas', NlCourseCanvasSrv)
    .directive('nlCourseCanvasView', _nl.elemDirective(templateUrl, true));
}

//-------------------------------------------------------------------------------------------------
function CourseViewDirective(template) {
    return _nl.elemDirective('view_controllers/course/view/' + template 
        + '.html', true);
}

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
    };
    
    function _setupFunctions() {
        var c = $scope.canvas;
        c.currentPin = -1;
        c.showPin = function(index) {
            c.currentPin = index;
        };

        c.closePins = function(e) {
            e.stopImmediatePropagation();
            e.preventDefault();
            c.currentPin = -1;
        };
        
        c.showDetails = function(e, index) {
            e.stopImmediatePropagation();
            e.preventDefault();
            nlDlg.popupStatus('TODO');
        };

        c.launch = function(e, index) {
            e.stopImmediatePropagation();
            e.preventDefault();
            nlDlg.popupStatus('TODO');
        };
    }
    this.update = function() {
        $scope.canvasMode = (course.content || {}).canvasview || false;
        if (!$scope.canvasMode) {
            $scope.canvasShown = false;
            return;
        }
        
        if ($scope.ext.isEditorMode()) {
            var item = treeList.getParent($scope.ext.item) || $scope.ext.item;
            var selected = $scope.ext.item;
            _updateCanvas(item, selected, $scope.canvas);
        } else {
            $scope.canvasShown = true;
            var selected = null;
            _updateCanvas($scope.ext.item, selected, $scope.canvas);
        }
    };
    
    function _updateCanvas(item, selected, canvas) {
        var obj = item;
        if (item.id == treeList.getRootItem().id) obj = course.content || {};
        canvas.bgimg = obj.bgimg || null;
        canvas.bgcolor = obj.bgcolor || 'rgba(255, 255, 255, 1)';

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
            nextSlot = _assignNextSlot(cm, nextSlot, slotUsed);
            _updateCanvasPin(cm, pin, slotUsed);
        }
        return pins;
    }

    var SLOTX = 5;
    var SLOTY = 4;
    var POPUPGAP = 2;

    function _getCanvasPin(cm, selected, slotUsed) {
        var pin= {cm: cm, ok: false};
        if (selected && selected.id == cm.id) pin.selected=true;
        _updateCanvasPin(cm, pin, slotUsed);
        return pin;
    }

    function _updateCanvasPin(cm, pin, slotUsed) {
        if (!('posX' in cm) || !('posY' in cm)) return;
        _updateXPos(pin, cm);
        _updateYPos(pin, cm)
        _addPercSign(pin);
        _updateSlotUsed(cm, slotUsed);
        pin.ok = true;
    }

    function _updateXPos(pin, cm) {
        if (cm.posX <= 50) {
            pin.l =  cm.posX;
            pin.r =  'auto';
        } else {
            pin.l =  'auto';
            pin.r =  100 - cm.posX;
        }
    }
    
    function _updateYPos(pin, cm) {
        if (cm.posY <= 50) {
            pin.t =  cm.posY;
            pin.b =  'auto';
        } else {
            pin.t =  'auto';
            pin.b =  100 - cm.posY;
        }
    }
    
    function _addPercSign(pin) {
        var attrs = ['t', 'b', 'l', 'r'];
        for(var i=0; i<attrs.length; i++)
            if (pin[attrs[i]] != 'auto') pin[attrs[i]] = '' + pin[attrs[i]] + '%';
    }

    function _updateSlotUsed(cm, slotUsed) {
        var slotX = Math.floor(cm.posX/SLOTX);
        var slotY = Math.floor(cm.posY/SLOTY);
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
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();
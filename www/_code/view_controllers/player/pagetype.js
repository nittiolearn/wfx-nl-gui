(function() {

//-------------------------------------------------------------------------------------------------
// pagetype.js:
// pagetype information 
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.pagetype', [])
    .service('nlPageType', PageTypeSrv);
}

//-------------------------------------------------------------------------------------------------
var PageTypeSrv = ['nl',
function(nl) {

    this.getPageTypeHandler = function(lesson, pageTypes) {
        return new PageTypeHandler(nl, lesson, pageTypes);
    };

}];

//-------------------------------------------------------------------------------------------------
function PageTypeHandler(nl, lesson, pageTypes) {
    
    this.interactionToLayouts = {};
    this.pageTypeMap = {};
    
    //---------------------------------------------------------------------------------------------
    function _init(self) {
        _updatePageTypeMap(self, pageTypes);
        _initLessonLayout(self);
    }

    function _updatePageTypeMap(self, pageTypes) {
        for (var i = 0; i < pageTypes.length; i++) {
            var pt = pageTypes[i];
            self.pageTypeMap[pt.id] = pt;
            
            if (!(pt.interaction in _pageInteractionTypeMap)) {
                pt.interaction = _pageInteractionTypes[0].id;
            }

            if (!(pt.interaction in self.interactionToLayouts)) {
                self.interactionToLayouts[pt.interaction] = [];
            }
            self.interactionToLayouts[pt.interaction].push({'pagetype_id': pt.id, 'desc': pt.layoutName});
        }
    }

    function _initLessonLayout(self) {
        self.layout = {};
        for(var p=0; p<lesson.pages.length; p++) {
            var page = lesson.pages[p];
            self.layout[page.pageId] = _getPageLayout(self, page);
        }
    }
    
    function _getPageLayout(self, page) {
        var layout  = _getPageLayout2(self, page);
        var ret = [];
        for(var i=0; i<layout.length; i++) {
            var l = layout[i];
            var data = {};
            data.secStyle = {top: l.t + '%', left: l.l + '%', height: l.h + '%', width: l.w + '%'};
            // TODO-MUNNI-PLAYER: font resizing and h/v alignment pending
            data.secViewStyle = {'font-size': '80%', 'text-align': 'center', 'margin-top': 0, 'height': '100%'};
            _copyIf('aligntype', l, data);
            _copyIf('fmtgroup', l, data);
            _copyIf('ans', l, data);
            _copyIf('correct', l, data);
            ret.push(data);
        }
        return ret;
    }
    
    function _getPageLayout2(self, page) {
        if ('sectionLayout' in page) return page.sectionLayout;
        if (page.type in self.pageTypeMap) return self.pageTypeMap[page.type].layout;
        return pagetypes[0].layout;
    }

    function _copyIf(attr, src, dest) {
        if (attr in src) dest[attr] = src[attr];
    }

    //---------------------------------------------------------------------------------------------
    _init(this);
}

var _pageInteractionTypeMap = {};
var _pageInteractionTypes = [
    {'id' : 'TITLE', 'desc' : 'Information (title layouts)', 'default_aligntype' : 'title'},
    {'id' : 'INFO', 'desc' : 'Information (basic layouts)', 'default_aligntype' : 'content'},
    {'id' : 'INFO2', 'desc' : 'Information (extended layouts)', 'default_aligntype' : 'content'},
    {'id' : 'MCQ', 'desc' : 'Multiple choice', 'default_aligntype' : 'option', 'beh' : 'BehMcq'},
    {'id' : 'MATCH', 'desc' : 'Match it', 'default_aligntype' : 'option', 'beh' : 'BehMatch'},
    {'id' : 'ORDER', 'desc' : 'Order it', 'default_aligntype' : 'option', 'beh' : 'BehOrder'},
    {'id' : 'FILL', 'desc' : 'Fill in the blanks', 'default_aligntype' : 'option', 'beh' : 'BehFib'},
    {'id' : 'DESC', 'desc' : 'Descriptive', 'default_aligntype' : 'option', 'beh' : 'BehDesc'},
    {'id' : 'PARTFILL', 'desc' : 'Fill in the parts', 'default_aligntype' : 'option', 'beh' : 'BehFibParts'},
    {'id' : 'QUESTIONNAIRE', 'desc' : 'Questionnaire', 'default_aligntype' : 'content', 'beh' : 'BehQuestionnaire'},
    {'id' : 'MANYQUESTIONS', 'bleedingEdge' : false, 'desc' : 'Many questions', 'default_aligntype' : 'content', 'beh' : 'BehManyQuestions'}
];

function _updatePageInteractionTypeMap() {
    for (var i = 0; i < _pageInteractionTypes.length; i++) {
        var interaction = _pageInteractionTypes[i];
        _pageInteractionTypeMap[interaction.id] = interaction;
    }
}
_updatePageInteractionTypeMap();

//-------------------------------------------------------------------------------------------------
module_init();
})();

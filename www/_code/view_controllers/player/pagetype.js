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

    this.getPageTypeHandler = function(pageTypes) {
        return new PageTypeHandler(nl, pageTypes);
    };

}];

//-------------------------------------------------------------------------------------------------
function PageTypeHandler(nl, pageTypes) {
    
    this.pageTypes = pageTypes;
    this.interactionToLayouts = {};
    this.pageTypeMap = {};
    
    this.getPageType = function(page) {
        return new PageType(nl, this, page);
    }

    //---------------------------------------------------------------------------------------------
    function _init(self) {
        _updatePageTypeMap(self, pageTypes);
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

    //---------------------------------------------------------------------------------------------
    _init(this);
}

//-------------------------------------------------------------------------------------------------
function PageType(nl, ptHandler, page) {

    this.getSectionLayout = function(secPos) {
        return this.layout[secPos];
    };
    
    this.getHAlign = function(secPos) {
        return this.halign[secPos];
    };
    
    this.isVAlignMiddle = function(secPos) {
        return this.valignmiddle[secPos];
    };

    //---------------------------------------------------------------------------------------------
    function _init(self) {
        self.pt = _getPageType();
        self.interaction = _getInteraction(self.pt);
        self.layout = _getPageLayout(self.pt);
        self.halign = [];
        self.valignmiddle = [];
        for(var i=0; i<self.layout.length; i++) {
            var aligntype = _getAlignType(self, i);
            self.halign.push(_getHAlign(aligntype));
            self.valignmiddle.push(_isVAlignMiddle(aligntype));
        }
    }

    function _getPageType() {
        return ptHandler.pageTypeMap[page.type] || ptHandler.pagetypes[0];
    }
    
    function _getInteraction(pt) {
        return _pageInteractionTypeMap[pt.interaction] || _pageInteractionTypes[0];
    }

    function _getPageLayout(pt) {
        // returned object is an array - one per section. Each array element contains
        // t, l, w, h and optionally 
        // 'aligntype' (title|content|option), 
        // 'fmtgroup' (number)
        // 'ans', 'correct'
        return page.sectionLayout || pt.layout;
    }

    function _getAlignType(self, secPos) {
        return self.layout[secPos].aligntype || _getDefaultAlignType(self.interaction);
    }
    
    function _getDefaultAlignType(interaction) {
        return interaction.default_aligntype || 'content';
    }

    function _getHAlign(aligntype) {
        if (aligntype == 'title' || aligntype == 'option') return 'center';
        return 'left';
    }

    function _isVAlignMiddle(aligntype) {
        if (aligntype == 'title' || aligntype == 'option') return true;
        return false;
    }

    //---------------------------------------------------------------------------------------------
    _init(this);
}

//-------------------------------------------------------------------------------------------------
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

/**
 * Toolbelt js utilities
 * ---------------------
 **/
njs_toolbelt = function() {

function Toolbelt() {
    var _tb = null;
    var self = this;

    this.setup = function(tools) {
        _tb = jQuery('#toolbelt');
        _tb.html('');
        if (tools.length == 0) return;

        _initDefaultIcons();
        _toggleDisplayMode();
        _buildToolbelt(tools);
        _showToolbelt();
    };
    
    function _showToolbelt() {
        setTimeout(function() {
            jQuery('.pagecanvas').addClass('toolbeltShown');
            setTimeout(function() {
                nittio.onWindowResize();
            }, 1000);
        }, 1000);
    }
        
    function _hideToolbelt() {
        jQuery('.pagecanvas').removeClass('toolbeltShown');
    }

    function _initDefaultIcons() {
        var tool = {id : 'toggle_toolbelt', icon : '', name : '', onclick : _toggleDisplayMode};
        var grp = _getGrpElem('toolbeltDefIcon', _tb);
        grp.append(_getToolbeltRow(tool, 'toolbeltDefIcon'));
    }

    function _getGrpElem(toolCls, parent) {
        if (!toolCls) toolCls = '';
        var elem = jQuery(njs_helper.fmt2(
            '<div class="toolbeltGrp row row-wrap {}"></div>', toolCls));
        parent.append(elem);
        return elem;
    }

    function _getGrpElemAndSetupClick(grpTitle, parent) {
        var grpElem = _getGrpElem('', parent);
        grpTitle.click(function() {
            if (!grpElem.hasClass('animated-hide')) {
                grpElem.addClass('animated-hide');
            } else {
                grpElem.removeClass('animated-hide');
            }
        });
        return grpElem;
    }
    
    function _buildToolbelt(tools) {
        var currentGrp = null;
        var currentGrpElem = null;
        for (var i = 0; i < tools.length; i++) {
            var tool = tools[i];
            if (currentGrp != tool.grpid && tool.grpid) {
                var grpItem = jQuery(njs_helper.fmt2('<div id="{}" class="toolbeltGrpHolder"></div>', _getGrpId(tool.grpid)));
                var grpTitle = jQuery(njs_helper.fmt2(
                    '<div class="padding-small toolbeltTitle nl-link-text">{}</div>', tool.grp));
                _tb.append(grpItem);
                grpItem.append(grpTitle);
                currentGrpElem = _getGrpElemAndSetupClick(grpTitle, grpItem);
            }
            currentGrp = tool.grpid;
            currentGrpElem.append(_getToolbeltRow(tool));
        }
    }
    
    var _isCompact = true;
    function _toggleDisplayMode() {
        _isCompact = !_isCompact;
        if (_isCompact)
            _tb.addClass('compactToolbelt');
        else
            _tb.removeClass('compactToolbelt');

        var title = _isCompact ? 'Show expanded tool bar' : 'Show compact tool bar';
        var icon = _isCompact ? 'ion-arrow-expand' : 'ion-arrow-shrink';
        self.updateTool('toggle_toolbelt', null, icon, title);
    }

    function _getToolbeltRow(tool, toolCls) {
        if (!toolCls) toolCls = '';
        var iconCls = tool.font == 'material-icons' ? 'material-icons' : tool.icon;
        var iconTxt = tool.font == 'material-icons' ? tool.icon : '';
        var title = (tool.title || tool.name) + (tool.shortcut || '');
        var toolHtml = jQuery(njs_helper.fmt2('<div id="{}" class="toolbeltRow row row-center margin0 padding0 nl-link-text {}" title="{}"></div>', tool.id, toolCls, title));
        toolHtml.append(njs_helper.fmt2('<span class="nl-toolbar-icon"><i class="toolbeltIcon icon {}">{}</i></span>', iconCls, iconTxt));
        toolHtml.append(njs_helper.fmt2('<span class="col toolbeltTxt">{}</span>', tool.name));
        var clicked = false;
        toolHtml.click(function() {
        	if(clicked) return;
    		clicked = true;
			tool.onclick();
    		setTimeout(function() {
    			clicked = false;
    		}, 500);
            njs_animate.animEffect(toolHtml, 'toolbeltToolHighlight');
        });
        return toolHtml;
    }

    this.updateTool = function(toolId, name, iconCls, title) {
        var iconSpan = _tb.find('#' + toolId);
        if (title !== null) iconSpan.attr('title', title);
        if (name !== null) iconSpan.find('.toolbeltTxt').html(name);

        if (iconCls !== null) {
            var icon = iconSpan.find('I.toolbeltIcon');
            icon.removeAttr('class');
            icon.addClass('toolbeltIcon icon ' + iconCls);
        }
    };

    this.updateToolGrp = function(grpId, name) {
        var grpTitle = _tb.find('#' + _getGrpId(grpId) + ' .toolbeltTitle');
        grpTitle.html(name);
    };
    
    this.toggleTool = function(toolId, bShow) {
        _toggleElem(_tb.find('#' + toolId), bShow);
    };

    this.toggleToolGroup = function(grpId, bShow) {
        _toggleElem(_tb.find('#' + _getGrpId(grpId)), bShow);
    };

    function _toggleElem(elem, bShow) {
        if (bShow) elem.removeClass('animated-hide');
        else elem.addClass('animated-hide');
    }
    
    function _getGrpId(grpName) {
        return 'toolbelt_grp_' + grpName.replace(/\s+/g, '_').toLowerCase();
    }
}

var gToolbelt = new Toolbelt();
return {
	Toolbelt: gToolbelt
};
}();

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
    }
    
    function _showToolbelt() {
        setTimeout(function() {
            jQuery('.pagecanvas').addClass('toolbeltShown');
        }, 1000);
    }
        
    function _hideToolbelt() {
        jQuery('.pagecanvas').removeClass('toolbeltShown');
    }

    function _initDefaultIcons() {
        var tool = {id : 'toggle_toolbelt', icon : '', name : '', onclick : _toggleDisplayMode};
        var grp = _getGrpElem('toolbeltDefIcon');
        grp.append(_getToolbeltIcon(tool, 'toolbeltDefIcon'));
    }

    function _getGrpElem(toolCls) {
        if (!toolCls) toolCls = '';
        var elem = jQuery(njs_helper.fmt2(
            '<div class="toolbeltGrp row row-wrap {}"></div>', toolCls));
        _tb.append(elem);
        return elem;
    }

    function _getGrpElemAndSetupClick(grpTitle) {
        var grpElem = _getGrpElem();
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
            if (currentGrp != tool.grp && tool.grp) {
                var grpTitle = jQuery(njs_helper.fmt2(
                    '<div class="padding-small toolbeltTitle nl-link-text">{}</div>', tool.grp));
                _tb.append(grpTitle);
                currentGrpElem = _getGrpElemAndSetupClick(grpTitle);
            }
            currentGrp = tool.grp;
            currentGrpElem.append(_getToolbeltIcon(tool));
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

    function _getToolbeltIcon(tool, toolCls) {
        if (!toolCls) toolCls = '';
        var iconCls = tool.font == 'material-icons' ? 'material-icons' : tool.icon;
        var iconTxt = tool.font == 'material-icons' ? tool.icon : '';
        var title = (tool.title || tool.name) + (tool.shortcut || '');
        var toolHtml = jQuery(njs_helper.fmt2('<div id="{}" class="toolbeltRow row row-center margin0 padding0 nl-link-text {}" title="{}"></div>', tool.id, toolCls, title));
        toolHtml.append(njs_helper.fmt2('<span class="nl-toolbar-icon"><i class="toolbeltIcon icon {}">{}</i></span>', iconCls, iconTxt));
        toolHtml.append(njs_helper.fmt2('<span class="col toolbeltTxt">{}</span>', tool.name));
        toolHtml.click(function() {
            njs_animate.animEffect(toolHtml, 'toolbeltToolHighlight', function() {
                tool.onclick();
            });
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
    }
}

var gToolbelt = new Toolbelt();
return {
	Toolbelt: gToolbelt
};
}();

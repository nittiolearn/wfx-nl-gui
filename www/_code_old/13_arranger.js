njsArranger = function() {

	var g_arranger = null;

	function get() {
		if (!g_arranger) g_arranger = new Arranger();
		return g_arranger;
	}

	function Arranger() {

		var _isAllowed = false; // Is this feature allowed in the current lesson template?
		var _isEnabled = false; // Is the editor currently running in the Arranger mode
		var _origLessonCtx = 'edit';
		
		this.getMenuItem = function() {
			// TOOD-NOW-RSA - get this from parent template
			var oLesson = nlesson.theLesson.oLesson;
			_isAllowed = oLesson.arrangerEnabled || false;
			if (!_isAllowed) return null;
			return {id: 'edit_icon_arrange', grpid: 'section', grp: 'Section', icon: 'flip_to_front', 
					font: 'material-icons', name: 'Arrange', title: 'Move and resize sections',
					onclick: this.toggle};
		}

		this.toggle = function() {
			if (!_isAllowed) return false;
			_isEnabled = !_isEnabled;
			var lesson = nlesson.theLesson;

			var njsSlides = jQuery('.njsSlides');
			njsSlides.removeClass('njsArranger');
			if (_isEnabled) {
				njsSlides.addClass('njsArranger');
				_origLessonCtx = lesson.renderCtx.getLessonCtx();
                njs_toolbelt.Toolbelt.updateTool({id: 'edit_icon_arrange', enableItem: true});
				lesson.renderCtx.setLessonCtx('edit_pv');
			} else {
                njs_toolbelt.Toolbelt.updateTool({id: 'edit_icon_arrange', enableItem: false});
				lesson.renderCtx.setLessonCtx(_origLessonCtx);
			}
			nlesson.theLesson.reRender(false);
		}
	
		this.setupSection = function(section) {
			console.log('Section: ', section.oSection);
			return _isEnabled;
		}
	
	}

	return {
		get: get
	};
}();

njsCommentEditor = function() {

	
	var g_lessonComment = new LessonComment();
	var g_doneFn = '';
	var g_closeFn = '';
	var g_bInitDone = false;
	var g_userName = '';
	var g_bAuthorMode = true;
	var g_newCommentId = 0;
	var g_myResponseLen = 0; 
	var _commentEditorDlg = new njs_helper.Dialog();
	
	jQuery(function(){
		var cancelButton = {id: 'cancel', text: 'Close', fn: closeCommentEditor};
		_commentEditorDlg.create('comment_editor', jQuery('#comment_editor').remove(), [], cancelButton);
	}); 
	
	function LessonComment() {
		this.init = LessonComment_init;
		this.setComments = LessonComment_setComments;
		this.addComment = LessonComment_addComment;
		this.getOpenComments = LessonComment_getOpenComments;
		this.load = LessonComment_load;
		this.getUpdatedComments = LessonComment_getUpdatedComments;
		this.getDataForSave = LessonComment_getDataForSave;
		this.isModified = LessonComment_isModified;					
	}	
	function LessonComment_init(doneFn) {
		this.commentList = [];
		this.responseList = [];
		this.my_responseList = [];
		this.cauthorlist = [];
		g_doneFn = doneFn;
		this.load(on_loadComment);
		
	}
	function LessonComment_setComments(commentList) {
		this.commentList = commentList;		
	}
	
	function LessonComment_addComment(comment) {
		this.commentList.unshift(comment);		
	}
	
	
	function LessonComment_getOpenComments(pageId) {	
		
		var clist = [];
		for (var i= 0; i < this.commentList.length; i++){
			var comment = this.commentList[i];			
			if(comment.status == 'Open' && comment.lessonPageId == pageId){
				clist.push(comment);
			}			
		}
		return clist;
	}
	
	function LessonComment_getUpdatedComments() {
		var clist = [];
		for (var i= 0; i < this.commentList.length; i++){
			var comment = this.commentList[i];			
			if('save' in comment){
				if(comment.save == true){					
					clist.push(comment);											
				}			
			}
						
		}
		return clist;		
	}
	
	function LessonComment_getDataForSave() {
		var ret = {comments: this.getUpdatedComments(), responses: this.my_responseList, modified: false};
		if(ret.comments.length > 0) ret.modified = true;		
		if(g_myResponseLen != this.my_responseList.length) ret.modified = true;
		return ret;
	}
	
	function LessonComment_isModified() {
		var ret = this.getDataForSave();
		return ret.modified; 
	} 

	function on_comment_save(resultDict){
		clist = resultDict['resultComments'];
		rlist = resultDict['resultResponses'];		
		
		for(var i = 0; i < clist.length; i++){
			for(var j=0; j < g_lessonComment.commentList.length; j++){
				if(clist[i].tempId == g_lessonComment.commentList[j].id){
					g_lessonComment.commentList[j].id = clist[i].id;
					g_lessonComment.commentList[j].created = clist[i].created;
					g_lessonComment.commentList[j].bInDB  = true;					
				}				
			}
		}
		for(var i = 0; i < rlist.length; i++){
			for (var j=0; j < g_lessonComment.responseList.length; j++){
				if(g_lessonComment.responseList[j].parentId == rlist[i].clientParentId){
					g_lessonComment.responseList[j].parentId = rlist[i].parentId;
					if('created' in g_lessonComment.responseList[j] == false){
						g_lessonComment.responseList[j].created = rlist[i].created;
					}				
										
				}				
			}
			for (var j=0; j < g_lessonComment.my_responseList.length; j++){
				if(g_lessonComment.my_responseList[j].parentId == rlist[i].clientParentId){
					g_lessonComment.my_responseList[j].parentId = rlist[i].parentId;
					if('created' in g_lessonComment.my_responseList[j] == false){
						g_lessonComment.my_responseList[j].created = rlist[i].created;
					}
										
				}				
			}
			
		}
		updClist = g_lessonComment.getUpdatedComments();
		for(var j=0; j < updClist.length; j++){
			updClist[j].save = false;
		}
		g_myResponseLen = g_lessonComment.my_responseList.length;
	}
	
	function LessonComment_load(loadFn) {
		var lessonId = jQuery('#l_lessonId').val();
		if(lessonId == 0){
			g_bInitDone = true;
			return;
		}
		var _ajax = new njs_helper.Ajax(function(data, errorType, errorMsg) {
			if (errorType != njs_helper.Ajax.ERROR_NONE) return;
			loadFn(data);
		});
		var ajaxPath = njs_helper.fmt2('/lesson/lessoncomment_get.json/{}', lessonId);
		_ajax.send(ajaxPath, {});
		
	}
	function initCommentEditor(doneFn, bMode) {		
		if(g_bInitDone) {
			doneFn();
			return;
		}

		g_bAuthorMode = bMode;
		jQuery('#comment_editor_icon_reply').remove();
		jQuery('#replyhelp').remove();		
		if(g_bAuthorMode == true){						
			var templ = '<img id="comment_editor_icon_reply" src="{}/toolbar-view/newresponse.png" alt="Reply" title="Reply" onclick="njsCommentEditor.onAddReply();"/>';
			replyImg = njs_helper.jobj(njs_helper.fmt2(templ,nittio.getStaticResFolder()));
			jQuery('#comment_editor_toolbar').append(replyImg);
			var replyhelp = '<li id="replyhelp"><b>Reply:</b> Add a reply to the comment (after selecting the comment)</li>';
			jQuery('#commenthelp').append(njs_helper.jobj(replyhelp));
		}
	
		g_lessonComment.init(doneFn);		
	}
	function on_loadComment(commentobj){
		g_userName = commentobj.username;
		g_lessonComment.setComments(commentobj.comments);
		g_lessonComment.responseList = commentobj.responses;
		g_lessonComment.my_responseList = commentobj.myresponses;
		g_lessonComment.cauthorList = commentobj.commentAuthorList;
		g_myResponseLen = g_lessonComment.my_responseList.length;
		populateAuthorFilter();				
		g_bInitDone = true;
		g_doneFn();	
	}
	
	function isValid() {
		return g_bInitDone;
	}

	function showCommentEditor (closeFn) {
		g_closeFn = closeFn;
		_enableButtonsPerState(-1);		
		refreshCommentRows();		
		_pressFilterComment();
		jQuery('#comment_edit').hide();		
		_commentEditorDlg.show();
	}

	function closeCommentEditor () {		
		_commentEditorDlg.close();
		g_closeFn();
		g_closeFn = '';
	}	

	function refreshCommentRows() {
		rows = jQuery('#commentTable tr.commentRow');
		rows.each(function(){
			row = $(this);
			row.remove();
			
		});
		createCommentHeader();
		var pageIdList = nlesson.theLesson.getExistingPageIds();
		for (var i=0; i < g_lessonComment.commentList.length; i++ ){
			var rowDetails = g_lessonComment.commentList[i];
			rowDetails.index = i;
			if (g_filterPageView == 1){
				var currentPageId = nlesson.theLesson.getCurrentPageId();
				if (rowDetails.lessonPageId != currentPageId){
					continue;
				}
			}
			if (g_filterPageView == 2){								
				if (pageIdList.indexOf(rowDetails.lessonPageId) >= 0){
					continue;
				}
			}
			
			if(g_bStatusOpenFilter){
				if(rowDetails.status != 'Open') continue;
			}
			if(g_AuthorFilter_cauthor != 'All'){
				if(rowDetails.authorname != g_AuthorFilter_cauthor) continue;
			}
			
			if (rowDetails.status == 'Open'){
				rowDetails.uistatus = '';
			}
			else{
				rowDetails.uistatus = 'checked';
			}
			var pgNo = pageIdList.indexOf(rowDetails.lessonPageId);
			if (pgNo >= 0){
					rowDetails.pgNo = pgNo + 1;
			}
			else{
				rowDetails.pgNo = 'Deleted';
			}
			convertToDisplayTime(rowDetails);			 
			createCommentRow(rowDetails);
		}
	}
	
	function convertToDisplayTime(rowDetails){
		if('created' in rowDetails){			
			var created = njs_helper.fmt2('{}Z',rowDetails.created);
			var d = new Date(created);
			rowDetails.uicreated = 	_formatTimeStamp(d);							
		}
		else if('uicreated' in rowDetails == false){						
			var d = new Date();
			rowDetails.uicreated = 	_formatTimeStamp(d);
		}
			
	}
	
	function _formatTimeStamp(d) {
		var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
		var h = d.getHours();
		var mid = 'AM';		
		if(h == 0) h =  12;
		if(h > 12){
			h = h%12;
			mid = 'PM';
		}
		var m = d.getMinutes();
		if(m < 10) m = njs_helper.fmt2('0{}',m);  
		
		return njs_helper.fmt2("{}:{} {} {} {}", h,m,mid, monthNames[d.getMonth()],d.getDate());		
	}
	
	function on_commentEdit_done(){
		var selectedRow = jQuery('.commentselected');

		var response = jQuery('#l_comment').val();
		
		if (selectedRow.length > 0){		
			var index = selectedRow.attr('rowIndex');		
			var comment = g_lessonComment.commentList[index];
			var replyObj = {};
			replyObj.response = response;
			replyObj.authorname = g_userName;
			replyObj.parentId = comment.id;
			convertToDisplayTime(replyObj);					
			g_lessonComment.responseList.push(replyObj);
			g_lessonComment.my_responseList.push(replyObj);
			_enableButtonsPerState(-1);
			refreshCommentRows();
			jQuery('#comment_edit').hide();
			jQuery('#l_comment').val('');
			return;
		}
		
		var newRowDetails = {};
		newRowDetails.id = njs_helper.fmt2('temp_{}',g_newCommentId++);
		newRowDetails.lessonPageId = nlesson.theLesson.getCurrentPageId();
		newRowDetails.comment = jQuery('#l_comment').val();
		newRowDetails.status = 'Open';
		newRowDetails.authorname = g_userName;
		convertToDisplayTime(newRowDetails);
		newRowDetails.bInDB = false;
		newRowDetails.save = true;
				
		g_lessonComment.commentList.unshift(newRowDetails);
		jQuery('#comment_edit').hide();
		refreshCommentRows();
			
	}
	
	function on_commentEdit_cancel() {
		jQuery('#comment_edit').hide();
		jQuery('#l_comment').val('');
	}
	
	function createCommentHeader() {
		var authortempl = '<tr class= "bold commentRow"><td></td><td>Page</td><td class="comment">Comment</td><td>Status</td></tr>';
		var templ = '<tr class= "bold commentRow"><td>Page</td><td class="comment">Comment</td><td>Status</td></tr>';
		if (g_bAuthorMode){
			templ = authortempl;
		}
		var comment_header = njs_helper.jobj(templ);
		jQuery('#comment_editor_body > table').append(comment_header);
	}
	function createCommentRow(rowDetails) {		
		tab = jQuery('#comment_editor_body > table');
		var authortempl = '<tr id="comment_row_{index}" class="normal commentRow" rowIndex={index}><td><input type="checkbox" id="comment_row_sel_{index}" onclick="njsCommentEditor.onRowClick({index});"></input><td>{pgNo}</td><td class= "comment"><div class="commentarea"><div class="cauthor">{authorname}: </div><div class="ctimestamp">{uicreated}</div><span>{comment}</span></div></td><td><input type="checkbox" id="comment_row_status_{index}" onclick="njsCommentEditor.onCommentStatusClick({index});" {uistatus}></input></td></tr>';
		var templ = '<tr id="comment_row_{index}" class="normal commentRow" rowIndex={index}><td>{pgNo}</td><td class= "comment"><div class= "commentarea"><div class="cauthor">{authorname}: </div><div class="ctimestamp">{uicreated}</div><span>{comment}</span></div></td><td>{status}</td></tr>';
		if (g_bAuthorMode){
			templ = authortempl;
		}			
		var comment_row = njs_helper.jobj(njs_helper.fmt1(templ,rowDetails));
		tab.append(comment_row);
		
		
		var replytempl = '<div class= "reply"><div class="cauthor">{authorname}: </div><div class="ctimestamp">{uicreated}</div><span>{response}</span></div>';
		cell = comment_row.children('.comment');
		
		for (var i =0; i < g_lessonComment.responseList.length; i++){
			if(g_lessonComment.responseList[i].parentId == rowDetails.id){				
				convertToDisplayTime( g_lessonComment.responseList[i]); 				
				var reply_row = njs_helper.jobj(njs_helper.fmt1(replytempl,g_lessonComment.responseList[i]));
				cell.append(reply_row);				
			} 
		}
				
	}

	function onCommentStatusClick(index) {
		var bChecked = (index >= 0 && jQuery('#comment_row_status_' + index).is(":checked"));
		if (bChecked){
			jQuery('#comment_row_status_' + index).prop('checked', true);
			g_lessonComment.commentList[index].status = 'Closed';
			g_lessonComment.commentList[index].save = true;
			g_lessonComment.commentList[index].statusChanged = true;
			return;
		}
		
		jQuery('#comment_row_status_' + index).prop('checked', false);
		g_lessonComment.commentList[index].status = 'Open';
		g_lessonComment.commentList[index].save = true;
		g_lessonComment.commentList[index].statusChanged = true;
	}

	var g_selectedRowIndex = -1;

	function onRowClick(rowindex) {
		var bChecked = (rowindex >= 0 && jQuery('#comment_row_sel_' + rowindex).is(":checked"));

		if (g_selectedRowIndex >= 0) {
			jQuery('#comment_row_' + g_selectedRowIndex).removeClass('commentselected');
			jQuery('#comment_row_sel_' + g_selectedRowIndex).prop('checked', false);
		}

		if (!bChecked) {
			g_selectedRowIndex = -1;
			_enableButtonsPerState(g_selectedRowIndex);
			return;
		}

		g_selectedRowIndex = rowindex;
		jQuery('#comment_row_' + g_selectedRowIndex).addClass('commentselected');
		jQuery('#comment_row_sel_' + g_selectedRowIndex).prop('checked', true);
		_enableButtonsPerState(g_selectedRowIndex);
	}
	
	var g_filterPressed = true;
	function onFilterCommentsClick() {
		var butId = 'comment_editor_icon_filter';
		if (!nittio.isButtonEnabled(butId)) {
			return false;
		}
		icon = jQuery('#comment_editor_icon_filter');
		if(g_filterPressed){
			fmt = njs_helper.fmt2("{}/toolbar-view/filtercomment.png",nittio.getStaticResFolder());
			icon.attr('src', fmt);
			g_filterPressed = false;			
		}
		else{
			fmt = njs_helper.fmt2("{}/toolbar-view/filtercomment.png",nittio.getStaticResFolder());
			icon.attr('src', fmt);
			g_filterPressed = true;
		}					
					
		jQuery('#commentviewfilter').toggle();
	}
	
	function _pressFilterComment() {
		g_filterPressed = true;
		jQuery('#commentviewfilter').show();
		
	}
	
	
	function _enableButtonsPerState(rowIndex) {
		var buttonStates = {
			comment_editor_icon_newcomment : true,			
			comment_editor_icon_filter : true			
		};
		if(g_bAuthorMode){
			buttonStates['comment_editor_icon_reply'] = false;
		}

		if (rowIndex < 0) {
			return _enableButtons(buttonStates);
		}
		
		buttonStates['comment_editor_icon_newcomment'] = false;
		buttonStates['comment_editor_icon_filter'] = false;
		
		if(g_bAuthorMode){
			buttonStates['comment_editor_icon_reply'] = true;
		}

		return _enableButtons(buttonStates);
	}

	function _enableButtons(buttonStates) {
		for (var button in buttonStates) {
			nittio.enableButton(button, buttonStates[button]);
		}
		return true;
	}
	
	function onAddReply() {
		var butId = 'comment_editor_icon_reply';
		if (!nittio.isButtonEnabled(butId)) {
			return false;
		}
							
		jQuery('#l_comment').val('');
		jQuery('#comment_edit').show();
		
	}
	
	var g_filterPageView = 0;	
	function onPageFilterChange() {
		var pageFilter = jQuery('#pageFilter').val();		
		if(pageFilter == 'All pages'){
			g_filterPageView = 0;
		}
		else if(pageFilter == 'Current page'){
			g_filterPageView = 1;
		}
		else if(pageFilter == 'Deleted pages'){
			g_filterPageView = 2;
		}
		refreshCommentRows();		
	}
	
	var g_bStatusOpenFilter = false;
	function onStatusFilterChange() {
		var filter = jQuery('#statusFilter').val();
		
		if(filter == 'Open'){
			g_bStatusOpenFilter = true;			
		}
		else{
			g_bStatusOpenFilter = false;
		}
		refreshCommentRows();		
	}
	
	var g_AuthorFilter_cauthor = 'All';
	function onAuthorFilterChange() {
		var filter = jQuery('#authorFilter').val();
		g_AuthorFilter_cauthor = filter;
		refreshCommentRows();
	}
	
	
	function populateAuthorFilter() {
		authorFilter = jQuery('#authorFilter');
		for(var i=0; i < g_lessonComment.cauthorList.length; i++){
			opt = jQuery("<option />").appendTo(authorFilter);				
			opt.val(g_lessonComment.cauthorList[i]);
			opt.text(g_lessonComment.cauthorList[i]);				
		}
		
	}
	
	function on_currentPageClick(){
		jQuery('#showallpage').prop('checked', false);
		jQuery('#showcurrentpage').prop('checked', true);
		jQuery('#showdeletedpage').prop('checked', false);
		g_filterPageView = 1;
		refreshCommentRows();
		
	}
	function on_allPageClick(){		
		jQuery('#showallpage').prop('checked', true);
		jQuery('#showcurrentpage').prop('checked', false);
		jQuery('#showdeletedpage').prop('checked', false);
		g_filterPageView = 0;
		refreshCommentRows();
		
	}
	function on_deletedPageClick(){
		jQuery('#showallpage').prop('checked', false);
		jQuery('#showcurrentpage').prop('checked', false);
		jQuery('#showdeletedpage').prop('checked', true);
		g_filterPageView = 2;
		refreshCommentRows();
		
	}
	
	function onNewComment() {
		var butId = 'comment_editor_icon_newcomment';
		if (!nittio.isButtonEnabled(butId)) {
			return false;
		}							
		jQuery('#l_comment').val('');
		jQuery('#comment_edit').toggle();
		
	}
	
	return {
		initCommentEditor : initCommentEditor,		
		showCommentEditor : showCommentEditor,
		on_commentEdit_done : on_commentEdit_done,
		onCommentStatusClick : onCommentStatusClick,
		onRowClick : onRowClick,
		onFilterCommentsClick : onFilterCommentsClick,
		on_commentEdit_cancel : on_commentEdit_cancel,				
		theLessonComment : g_lessonComment,
		onAddReply : onAddReply,
		on_currentPageClick : on_currentPageClick,
		on_allPageClick : on_allPageClick,
		on_deletedPageClick : on_deletedPageClick,
		onNewComment : onNewComment,
		onPageFilterChange : onPageFilterChange,
		onStatusFilterChange : onStatusFilterChange,
		onAuthorFilterChange :	onAuthorFilterChange,
		on_comment_save : on_comment_save,
		isValid : isValid	
		
	};
}();
(function() {

//-------------------------------------------------------------------------------------------------
// assignment_send_srv.js:
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.send_assignment_srv', [])
    .service('nlSendAssignmentSrv', SendAssignmentSrv);
}
//-------------------------------------------------------------------------------------------------
var SendAssignmentSrv = ['nl', 'nlDlg', 'nlServerApi',
function(nl, nlDlg, nlServerApi) {
	var ouList = [];
	var selectedOuList = [];
	var ouUserList = [];
	var selectedUserTreedata = []; 
	var selectedOuUserList = [];
	var selectedOuUserListNames = [];
	var sendAssignmentParams = null;

	
    this.show = function(parentScope, assignInfo) {
		var sendAssignmentDlg = nlDlg.create(parentScope);
		_initSendAssignmentDlg(sendAssignmentDlg, assignInfo);
		nlServerApi.getOuList().then(function(status) {
			ouList = status;
		});

		sendAssignmentDlg.scope.onOuClick = function(){
			_showOuListDlg(parentScope, sendAssignmentDlg, ouList);
		};
		
		sendAssignmentDlg.scope.onUserClick = function(){
			if(selectedOuList.length == 0) {
				nlDlg.popupAlert({title:'Alert message', template:nl.t('You may choose to send assignment to subset of users once you select the class/ user group. Please select the class first.')});
			} else{
				var data = {oulist: selectedOuList};
				nlServerApi.getOuUserList(data).then(function(status) {
					ouUserList = [];
					selectedOuUserList = [];
					for(var key in status){
						var arr1 = status[key];
						for(var i in arr1){
							if(arr1[i].users.length !== 0) ouUserList.push({name:key, children:arr1[i].users});
						}
					}
					if(ouUserList.length == 0) return alertWhenNoUsers();
					_showOuUserListDlg(parentScope, sendAssignmentDlg, ouUserList);
  				});
			}
		};
		
		sendAssignmentDlg.scope.onClickOnVisibleTo = function(){
			var title = nl.t('selected group/classes');
			_showSelectedList(selectedOuList, title);
		};
		
		sendAssignmentDlg.scope.onClickOnVisibleToUsers = function(){
			var title = nl.t('selected users');
			_showSelectedList(selectedOuUserListNames, title);
		};

		function _showSelectedList(selectedList, title){
			var selectedListDlg = nlDlg.create(parentScope);
			selectedListDlg.scope.data = {};
			selectedListDlg.scope.data.pagetitle = title;
			selectedListDlg.scope.data.selectedlist = selectedList;
			var cancelButton = {text : nl.t('Cancel')};
			selectedListDlg.show('view_controllers/assingment/show_selected_users_dlg.html', [], cancelButton, false);
		}
		

		nlDlg.showLoadingScreen();
		sendAssignmentParams = sendAssignmentDlg;
		_showDlg(parentScope, sendAssignmentDlg);
	};

	var LEARNMODE_SELF = 1;
    var LEARNMODE_ASSIGNMENT = 2;
    var LEARNMODE_TEST = 3;

    var learningModeStrings = ['on every page', 
    							'after submitting', 
    							'only when published'];

	function _initSendAssignmentDlg(sendAssignmentDlg, assignInfo) {
		sendAssignmentDlg.setCssClass('nl-height-max nl-width-max');	
		sendAssignmentDlg.scope.assignInfo = assignInfo;
		sendAssignmentDlg.scope.data = {};
		sendAssignmentDlg.scope.options = {};
		sendAssignmentDlg.scope.options.showAnswers = _getShowanswersList();
		sendAssignmentDlg.scope.data.showAnswers = {id: 2, name: 'after submitting'};
		sendAssignmentDlg.scope.data.visibleto	= nl.t('<p class="nl-data-visibleTo"><b>Please select</b></p>');
		sendAssignmentDlg.scope.data.visibleToUsers	= nl.t('<p class="nl-data-visibleTo"> Will be sent to all users by default</p>');
		sendAssignmentDlg.scope.data.visibleToUsersLength = 0;
		sendAssignmentDlg.scope.data.visibleToGroupLength = 0;	
		sendAssignmentDlg.scope.data.datetimevalue = '';
		sendAssignmentDlg.scope.data.maxduration = assignInfo.esttime;
		sendAssignmentDlg.scope.data.starttime = '';
		sendAssignmentDlg.scope.data.endtime = '';
		sendAssignmentDlg.scope.data.remarks = '';
	}

	function _getShowanswersList() {
		var showAnswerList = [];
		for(var i=0; i<learningModeStrings.length; i++){
			showAnswerList.push({id: i+1, name: learningModeStrings[i]});
		}
		return showAnswerList;
	}
	
	function _showDlg(parentScope, sendAssignmentDlg) {
		var sendButton = {text : nl.t('Send Assignment'), onTap : function(e) {
			if(e) e.preventDefault(e); 
	    	if(selectedOuList.length == 0) return nlDlg.popupAlert({title: nl.t('Please select'), template: nl.t('Please select  atleast one user or group')});
			 _onClickonSend(e, parentScope, sendAssignmentDlg);
			}};
		var cancelButton = {text : nl.t('Cancel')};
		sendAssignmentDlg.show('view_controllers/assingment/send_assignment_dlg.html',
			[sendButton], cancelButton, false);
    }
    
    function _onClickonSend(e, parentScope, sendAssignmentDlg){
    	e.preventDefault(e);
    	var starttime = sendAssignmentDlg.scope.data.starttime;
    	var endtime = sendAssignmentDlg.scope.data.endtime;
		var maxduration = sendAssignmentDlg.scope.data.maxduration;
    	if(sendAssignmentDlg.scope.data.starttime) {
    		var utcstarttime = convertLocalDateToUTCDate(starttime, true);
    		starttime = nl.fmt.date2Str(utcstarttime, 'second');
    	} else {
    		starttime = '';
    	}
    	
    	if(sendAssignmentDlg.scope.data.endtime) {
    		var utcendtime = convertLocalDateToUTCDate(endtime, true);
    		endtime = nl.fmt.date2Str(utcendtime, 'second');
    	} else {
    		endtime = '';
    	}
    	
		
    	var learnmode = sendAssignmentDlg.scope.data.showAnswers.id;
    	var data = {lessonid: sendAssignmentDlg.scope.assignInfo.id,
					type : sendAssignmentDlg.scope.assignInfo.type,
					orgunits:selectedOuList, 
					selectedusers: selectedOuUserList,
					not_before: starttime, 
					not_after: endtime,
					learnmode: learnmode,
					forum: (sendAssignmentDlg.scope.data.forum in sendAssignmentDlg.scope.data || sendAssignmentDlg.scope.data.forum == true) ? true : '',
					max_duration: maxduration,
					remarks: (sendAssignmentDlg.scope.data.remarks in sendAssignmentDlg.scope.data)? sendAssignmentDlg.scope.data.remarks: ''};
    	nlDlg.showLoadingScreen();
    	nlServerApi.checkPastAssignments(data).then(function(status){
    		if(starttime !== '' && endtime !== '') {
	    		var diff = Math.abs(new Date(endtime) - new Date(starttime));
	    		var minutes = Math.floor((diff/1000)/60);
				if(minutes < sendAssignmentDlg.scope.data.maxduration) return nlDlg.popupAlert({title:'Alert message', template:nl.t('End date/time should be atleast {} minutes more than start date/time', sendAssignmentDlg.scope.data.maxduration)});
    		} else if(endtime) {
    			var newDate = convertLocalDateToUTCDate(new Date(), true);
	    		var diff = Math.abs(new Date(endtime) - newDate);
	    		var minutes = Math.floor((diff/1000)/60);
				if(minutes < sendAssignmentDlg.scope.data.maxduration) return nlDlg.popupAlert({title:'Alert message', template:nl.t('End date/time should be atleast {} minutes more than current date/time', sendAssignmentDlg.scope.data.maxduration)});
    		}
    		if(status.totalUsers == 0) return alertWhenNoUsers();
    		if(status.assignedUsers === 0) {
				nlServerApi.assignmentSend(data).then(function(status) {
					nlDlg.hideLoadingScreen();
					_showAfterAssignmentSentDlg(e, data, parentScope, status);
				});
    		} else {
    			_showConfirmBeforeSend(parentScope, data, status);
    		}
    	});
    	
    	function _showConfirmBeforeSend(parentScope, data, status) {
    		var sendAssignmentAfterConfirmDlg = nlDlg.create(parentScope);
			sendAssignmentAfterConfirmDlg.setCssClass('nl-height-max nl-width-max');
			sendAssignmentAfterConfirmDlg.scope.data = {};
			sendAssignmentAfterConfirmDlg.scope.data.visibleTo = data.orgunits;
			sendAssignmentAfterConfirmDlg.scope.data.pastAssignmentSentList = status;
			var okButton = {text : nl.t('Send'), onTap : function(e) {
				nlDlg.showLoadingScreen();
				nlServerApi.assignmentSend(data).then(function(status) {
					nlDlg.hideLoadingScreen();
					_showAfterAssignmentSentDlg(e, data, parentScope, status);
				});
			}};
			var cancelButton = {text : nl.t('Close')};
			sendAssignmentAfterConfirmDlg.show('view_controllers/assingment/confirm_before_send_dlg.html',
				[okButton], cancelButton, false);
    	}
    }

	function _showAfterAssignmentSentDlg(e, data, parentScope, status) {
		if(e) e.preventDefault();
		var afterAssignmentSentDlg = nlDlg.create(parentScope);
			afterAssignmentSentDlg.scope.data = {};
			if(data.type == 'lesson') {
				afterAssignmentSentDlg.scope.data.url = nl.fmt2('/reports/assignment_rep/{}', status);
				afterAssignmentSentDlg.scope.data.pageTitle = nl.t('Assignment sent');
			}else if (data.type == 'course') {
				afterAssignmentSentDlg.scope.data.url = nl.fmt2('#/course_report_list?assignid={}', status);
				afterAssignmentSentDlg.scope.data.pageTitle = nl.t('Course assigned');
			}
			var cancelButton = {text : nl.t('Close'), onTap: function(e){
				afterAssignmentSentDlg.close(false);
				afterAssignmentSentDlg.destroy();
			}};
			afterAssignmentSentDlg.show('view_controllers/assingment/after_assignment_sent_dlg.html',
				[], cancelButton, false);
	}

	function alertWhenNoUsers(){
		nlDlg.popupAlert({title:'Alert message', template:nl.t('There are no users in the class(es)/ user group(s) you selected')});
	}

	function convertLocalDateToUTCDate(date, toUTC) {
	    date = new Date(date);
	    var localOffset = date.getTimezoneOffset() * 60000;
	    var localTime = date.getTime();
	    if (toUTC) {
	        date = localTime + localOffset;
	    } else {
	        date = localTime - localOffset;
	    }
	    date = new Date(date);
	    return date;
	}

    function _showOuListDlg(parentScope, sendAssignmentDlg, data){
		var ouSelectionDlg = nlDlg.create(parentScope);
			_initouSelectionDlg(ouSelectionDlg, data);

		function _initouSelectionDlg(ouSelectionDlg, data) {
			ouSelectionDlg.setCssClass('nl-height-max nl-width-max');	
			ouSelectionDlg.scope.treeData = data;
			ouSelectionDlg.scope.treeOptions = {
			defaultSelectedState: false,
			twistieExpandedTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('folder.png')),
			twistieCollapsedTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('folder_closed.png')),
			twistieLeafTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('file.png')),
		    labelAttribute: 'text'
			};
		}

		ouSelectionDlg.scope.onNodeClick = function(node, isSelected, tree) {
			selectedOuList = _getSelectedIds(ouSelectionDlg.scope.treeData);
			sendAssignmentDlg.scope.data.visibleto = _showVisibleTo(selectedOuList);
		};
		
		function _showVisibleTo(selectedOuList){
			sendAssignmentDlg.scope.data.visibleToGroupLength = selectedOuList.length; 
			if(selectedOuList.length == 1) return nl.t('<p class="nl-data-visibleTo"><b>{}</b></p>', selectedOuList[0]);
			if(selectedOuList.length > 1) return nl.t('<p class="nl-clickable nl-data-visibleTo"><b>{} classes/ user groups selected</b></p>', selectedOuList.length);
		}
		function _getSelectedIds(tree) {
			var ret = [];
			var allSelected = _updateSelectedIds(tree, ret);
			return ret;
		}
	
		function _updateSelectedIds(tree, selectedList) {
			var allSelected = true;
			for (var i in tree) {
				var node = tree[i];
				if (node.selected) {
					selectedList.push(node.id);
				} else {
					allSelected = false;
				}
				var allChildrenSelected = _updateSelectedIds(node.children, selectedList);
				if (!allChildrenSelected) allSelected = false;
			}
			return allSelected;
		}
		
		function updateVisibleToUsers(){
			sendAssignmentDlg.scope.data.visibleToUsersLength = selectedOuUserList.length;
			if(selectedOuUserList.length == 0) sendAssignmentDlg.scope.data.visibleToUsers = nl.t('<p class="nl-data-visibleTo"> Will be sent to all users by default</p>');
			if(selectedOuUserList.length == 1) sendAssignmentDlg.scope.data.visibleToUsers = nl.t('<p class="nl-data-visibleTo"><b>{}</b></p>', selectedOuUserListNames)
			if(selectedOuUserList.length > 1) sendAssignmentDlg.scope.data.visibleToUsers = nl.t('<p class="nl-clickable nl-data-visibleTo"><b>{} users selected</b></p>', selectedOuUserListNames.length)
		}

		var okButton = {text : nl.t('Select'), onTap : function(e) {
			selectedOuUserList = [];
			if(selectedOuList.length == 0){
				e.preventDefault();
				nlDlg.popupAlert({title:'Alert message', template:nl.t('Select atleast one class/ user group')});
			} else {
				updateVisibleToUsers();
				return;
			}
			}};
		var cancelButton = {text : nl.t('Cancel')};
		ouSelectionDlg.show('view_controllers/assingment/ou_selection_dlg.html',
			[okButton], cancelButton, false);
    }
    
    
    function _showOuUserListDlg(parentScope, sendAssignmentDlg, data){
    	var allSelectedUsers = true;
		var ouUserSelectionDlg = nlDlg.create(parentScope);
			_initouUserSelectionDlg(ouUserSelectionDlg, data);
		
		function _initouUserSelectionDlg(ouUserSelectionDlg, data) {
			ouUserSelectionDlg.setCssClass('nl-height-max nl-width-max');	
			ouUserSelectionDlg.scope.treeData = data;
			ouUserSelectionDlg.scope.data = {};
			ouUserSelectionDlg.scope.data.allselectedUsers = true;
			ouUserSelectionDlg.scope.treeOptions = {
			defaultSelectedState: true,
			twistieExpandedTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('folder.png')),
			twistieCollapsedTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('folder_closed.png')),
			twistieLeafTpl: nl.fmt2('<img src="{}" class="nl-16">', nl.url.resUrl('file.png')),
		    labelAttribute: 'name'
			};
		}

		ouUserSelectionDlg.scope.onNodeClick = function(node, isSelected, tree) {
			selectedOuUserListNames = [];
			selectedOuUserList = _getSelectedIds(ouUserSelectionDlg.scope.treeData);
			selectedUserTreedata = ouUserSelectionDlg.scope.treeData;
		};

		function _getSelectedIds(tree) {
			var ret = [];
			var allSelected = _updateSelectedIds(tree, ret); 
			if(allSelected) {
				allSelectedUsers = true;
				return [];
			}
			allSelectedUsers = false;
			return ret;
		}
	
		function _updateSelectedIds(tree, selectedList) {
			var allSelected = true;
			for (var i in tree) {
				var node = tree[i];
				if (node.selected && node.id) {
					selectedList.push(node.id);
					selectedOuUserListNames.push(node.name);
				} else {
					allSelected = false;
				}
				var allChildrenSelected = _updateSelectedIds(node.children, selectedList);
				if (!allChildrenSelected) allSelected = false;
			}
			return allSelected;
		}

		function _updateVisibleToUsers(e){
			if(e) e.preventDefault();
			sendAssignmentDlg.scope.data.visibleToUsersLength = selectedOuUserList.length;
			if(selectedOuUserList.length == 0) sendAssignmentDlg.scope.data.visibleToUsers = nl.t('<p class="nl-data-visibleTo">Will be sent to all users by default</p>');
			if(selectedOuUserList.length == 1) sendAssignmentDlg.scope.data.visibleToUsers = nl.t('<p class="nl-data-visibleTo"><b>{}</b></p>', selectedOuUserListNames);
			if(selectedOuUserList.length > 1) sendAssignmentDlg.scope.data.visibleToUsers = nl.t('<p class="nl-clickable nl-data-visibleTo"><b>{} users selected</b></p>', selectedOuUserListNames.length);
			ouUserSelectionDlg.close(e);
		}
		
		var okButton = {text : nl.t('Select'), onTap : function(e) { 
			 e.preventDefault();				
			 if(allSelectedUsers == true || selectedOuUserList.length !== 0){
			 	_updateVisibleToUsers(e);
			 } else {
			 return nlDlg.popupAlert({title: nl.t('Alert message'), template:nl.t('Please select atleast one user')});}}};
		var cancelButton = {text : nl.t('Cancel')};
		ouUserSelectionDlg.show('view_controllers/assingment/ou_user_selection_dlg.html',
			[okButton], cancelButton, false);
    }
    
}];
//-------------------------------------------------------------------------------------------------

module_init();
})();

njs_treeview = function() {
	//#############################################################################################
	// Implements the yahoo module pattern to minimize pollution of namespace all variables/
	// functions exposed out of this .js file are available under namespace "njs_treeview".
	//#############################################################################################

	//#############################################################################################
	/*------------------------------------------------------------------------------------------	
	Sample usage: 
		
	{{response.title='Sample TreeView Application'}}
	{{extend 'layout.html'}}
	
	<script>
	
		// All needed Java script/css are loaded in layout.html. 
	
		var data = [{id:'Teachers', text: 'Teachers', children: [
						{id:'Primary School Teachers'},
						{id:'Middle School Teachers'},
						{id:'High School Teachers'}
					]},
					// If text is omited, id is taken as text
					{id:'Students', children: [
						{id:'Grade1', children: [
							{id:'Grade1 - Yellow'},
							{id:'Grade1 - Blue'}
						]},
						// You pass some states. You can make some noted open, seleted or diabled
						{id:'Grade2', state: {opened: true, disabled: true}, children: [
							{id:'Grade2 - Yellow'},
							{id:'Grade2 - Blue'}
						]},
						{id:'Grade3', children: [
							{id:'Grade3 - A'},
							{id:'Grade3 - B'}
						]},
						{id:'Grade4', state: {opened: true, disabled: true}, children: [
							{id:'Grade4 - White', state: {disabled: true, selected: true}}
						]},
						{id:'Grade5'},
						{id:'Grade6'}
					]}
					];
			
		var treeview;		
		jQuery(function() {
			treeview = new njs_treeview.TreeView();
			treeview.init({data:data, container:jQuery('#treeview'), checkBox:true, multiSelect:true, leafOnly:false});
		});
		
		function onTreeDone() {
			var listOfSelectedItems = treeview.getSelectedItems();
			alert(listOfSelectedItems.length + ' items selected');
		}
	</script>
	
	<button onclick='onTreeDone();'>Done</button>
	<div id='treeview'></div>
	------------------------------------------------------------------------------------------*/	
	//#############################################################################################
	

	//------------------------------------------------------------------------------------------	
	// Class TreeView - Public Methods
	//------------------------------------------------------------------------------------------
	function TreeView() {
		// Define public functions
		this.init = TreeView_init;
		this.onEvent = TreeView_onEvent;
		this.updateData = TreeView_updateData;
		this.updateSelection = TreeView_updateSelection;

		this.initFromForm = TreeView_initFromForm;
		this.updateForm = TreeView_updateForm;

		this.getSelectedItems = TreeView_getSelectedItems;
		this.getSelectedIds = TreeView_getSelectedIds;
	}
	
	function TreeView_init(initData) {
		this.bMultiSelect = ('multiSelect' in initData) ? initData.multiSelect : false;
		this.plugins = [];
		if ('checkBox' in initData && initData.checkBox) this.plugins.push('checkbox');
		this.leafOnly = ('leafOnly' in initData) ? initData.leafOnly : false;
		this.defaultSelect = ('defaultSelect' in initData) ? initData.defaultSelect : [];
		this.emptyMeansAll = ('emptyMeansAll' in initData) ? initData.emptyMeansAll : false;
		this.closeOnLoad = ('closeOnLoad' in initData) ? initData.closeOnLoad : false;
		
		this.container = initData.container;

		__createTree(this, initData.data, this.defaultSelect);
	}

	function TreeView_onEvent(eventid, handlerFn) {
		this.container.on(eventid, handlerFn);
	}

	function TreeView_updateData(data, selectedItems) {
		this.jstree.destroy();
		var defaultSelect = [];
		for (var i=0; i<selectedItems.length; i++) {
			defaultSelect.push(selectedItems[i].id);
		}
		__createTree(this, data, defaultSelect);
	}

	function TreeView_updateSelection(selectedItems) {
		this.jstree.deselect_all();
		this.jstree.close_all();
		for(var i in selectedItems) {
			this.jstree.select_node(selectedItems[i].id);
		}
		this.jstree.refresh();
	}
	
	function TreeView_initFromForm(fieldName, initData) {
		var dataField = jQuery('#tvdata_' + fieldName);
		var defaultField = jQuery('#tvdefault_' + fieldName);

		initData.container = dataField;
		initData.data = JSON.parse(dataField.html());
		initData.defaultSelect = [defaultField.html()];
		
		dataField.html('');
		defaultField.html('');

		this.init(initData);
	}
	
	function TreeView_updateForm(fieldName) {
		var items = this.getSelectedIds();
		if (items.length == 0) return false;
		var ids= this.getSelectedIds();
		if (this.leafOnly) {
			ids = __getLeafNodesOnly(this, ids);
		}
		
		jQuery('#' + fieldName).val(ids);
		return true;
	}
	
	function TreeView_getSelectedItems() {
		return this.jstree.get_selected(true);
	}

	// bUnique: if parent node is selected including *all* children, then only parent node id is retained in list
	function TreeView_getSelectedIds(bUnique) {
		if (bUnique === undefined) bUnique = false;
		var selected = this.jstree.get_selected();
		
		if (this.emptyMeansAll && selected.length == this.nodeCount) return [];
		if (!bUnique) return selected;
		
		var selectedMap = {};		
		for(var i=0; i<selected.length; i++) {
			selectedMap[selected[i]] = this.nodeidToChildren[selected[i]];
		}

		__markRedundantChildrenInMap(this.data, selectedMap);
		
		var ret = [];
		for (var i in selectedMap) {
			if (selectedMap.hasOwnProperty(i) && selectedMap[i]) ret.push(i);
		}
		return ret;
	}

	//------------------------------------------------------------------------------------------	
	// Class TreeView - Private Methods
	//------------------------------------------------------------------------------------------
	function __markRedundantChildrenInMap(data, selectedMap) {
		for (var i in data) {
			var node = data[i];
			if (!('children' in node) || node.children.length <= 0) continue;
			var children = node.children;
			
			var allChildrenFound = true;
			for (var c in children) {
				if (children[c].id in selectedMap) continue;
				allChildrenFound = false;
				break;
			}
			
			if (allChildrenFound) {
				for (var c in children) {
					selectedMap[children[c].id] = false;
				}
			}

			__markRedundantChildrenInMap(children, selectedMap);
		}
	}
		
	function __createTree(treeView, data, defaultSelect) {
		treeView.data = JSON.parse(JSON.stringify(data));
		treeView.nodeidToChildren = {};
		treeView.nodeCount = 0;
		
		var selectAll = (treeView.emptyMeansAll && defaultSelect.length == 0);
		
		var defaultSelectDict = __listToDict(defaultSelect);
		__updateTreeStates(treeView, treeView.data, treeView.leafOnly, defaultSelectDict, selectAll);

		treeView.container.jstree({
			core: {data: treeView.data, multiple: treeView.bMultiSelect},
			plugins: treeView.plugins
		});
		treeView.jstree = treeView.container.jstree(true);
		treeView.container.addClass('tvdata');

		if (treeView.closeOnLoad) {
			treeView.jstree.close_all();
			treeView.onEvent('ready.jstree', function() {
				treeView.jstree.close_all();
			});
		}
	}

	function __listToDict(lst) {
		var ret = {};
		for (var i in lst) {
			ret[lst[i]] = true;
		}
		return ret;
	}

	var NODE_TYPE_LEAF = 0;
	var NODE_TYPE_CONTAINER = 1;

	function __getLeafNodesOnly(treeView, ids) {
		var ret = [];
		for (var i in ids) {
			if (treeView.nodeidToChildren[ids[i]].length > 0) continue;
			ret.push(ids[i]);
		}
		return ret;
	}

	function __updateTreeStates(treeView, data, leafOnly, defaultSelectDict, selectAll) {
		for (var i in data) {
			var d = data[i];
			treeView.nodeCount++;
			treeView.nodeidToChildren[d.id] = [];
			if (selectAll || d.id in defaultSelectDict) __updateNodeState(d, 'selected');
			if (!('children' in d) || d.children.length <= 0) continue;
			treeView.nodeidToChildren[d.id] = d.children;
			if (leafOnly) __updateNodeState(d, 'disabled');
			__updateTreeStates(treeView, d.children, leafOnly, defaultSelectDict, selectAll);
		}
	}

	function __updateNodeState(d, stateName) {
		if (!('state' in d)) {
			d.state = {};
		}
		d.state[stateName] = true;
	}
	
	function Private_initDataList(data) {
		for(var i in data) {
			Private_initDataElem(data[i]);
		}
	}

	function Private_initDataElem(data) {
		if(!('text' in data)) data.text = data.id;
		if (!'children' in data) return;
		Private_initDataList(data.children);
	}
	
	//---------------------------------------------------------------------------------------------
	// Exposed Functions
	//---------------------------------------------------------------------------------------------
	return {
		TreeView : TreeView
	};
}(); 
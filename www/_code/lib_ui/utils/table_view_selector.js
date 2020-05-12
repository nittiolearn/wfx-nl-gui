(function() {

    //-------------------------------------------------------------------------------------------------
    // table_view_selector.js: Directive to select a view on a table (columns to display) and also define
    // such views.
    //-------------------------------------------------------------------------------------------------
    function module_init() {
        angular.module('nl.ui.table_view_selector', [])
        .directive('nlTableViewSelector', TableViewSelector);
    }
    
    //-------------------------------------------------------------------------------------------------
    var TableViewSelector = ['nl', 'nlDlg', 'nlServerApi', 'nlExpressionProcessor',
    function(nl, nlDlg, nlServerApi, nlExpressionProcessor) {
        var _groupSettings = new GroupSettings(nl, nlDlg, nlServerApi);
        var _defaultOption = {id: 'default', name: 'Default', columns: null};
        var _allOption = {id: null, name: 'All Columns', columns: null};
        var _loading = {id: null, name: 'Loading ...', columns: null};

        function _onDirectiveLink($scope, iElem, iAttrs) {
            _initScope($scope);
            _loadOptionsIfNeeded($scope);
            $scope.onSelectClick = function() {
                $scope.isOpen = !$scope.isOpen;
                if (!$scope.isOpen) return;
                _loadOptionsIfNeeded($scope);
            };

            $scope.onOptionSelect = function(option) {
                $scope.selected = option;
                $scope.isOpen = false;
                if (!$scope.config || !$scope.config.onViewChange) return;
                _groupSettings.updateAllColumnNames($scope.config.tableType, $scope.config.allColumns);
                var columns = _validateColumns(option.columns, $scope.config.allColumns);
                $scope.config.onViewChange(columns);
            };

            $scope.onCustomizeViews = function() {
                if (!$scope.config || !$scope.config.canEdit) return;
                $scope.isOpen = false;
                var tableViewEditDlg = new TableViewEditDlg(nl, nlDlg, nlExpressionProcessor, _groupSettings, $scope);
                tableViewEditDlg.show();
            }
        }

        function _initScope($scope) {
            $scope.isOpen = false;
            $scope.selected = _defaultOption;
            $scope.options = [_allOption, _loading];
        }

        function _loadOptionsIfNeeded($scope) {
            if (!$scope.config) return;
            _groupSettings.load($scope.config.tableType, function(options) {
                if (!options) return _initScope($scope);
                if ($scope.config.defaultViewColumns) $scope.options = [$scope.config.defaultViewColumns, _allOption];
                else $scope.options = [_defaultOption, _allOption];
                for (var i=0; i<options.length; i++) {
                    $scope.options.push(options[i]);
                }
            });
        }

        function _validateColumns(selectedColumns, allColumns) {
            if (!selectedColumns) return allColumns;
            var allColumnIds = {};
            for(var i=0; i<allColumns.length; i++) allColumnIds[allColumns[i].id] = allColumns[i];
            var ret = [];
            for(var i=0; i<selectedColumns.length; i++) {
                if (selectedColumns[i] in allColumnIds) ret.push(allColumnIds[selectedColumns[i]]);
            }
            return ret;
        }

        return {
            restrict: 'E',
            templateUrl: 'lib_ui/utils/table_view_selector.html',
            scope: {
                config: '='
            },
            link: _onDirectiveLink
        };
    }];

    //-------------------------------------------------------------------------------------------------
    function GroupSettings(nl, nlDlg, nlServerApi) {
        var _settings = {};
        this.load = function(settingsType, onLoadDoneFn) {
            if (settingsType in _settings) return onLoadDoneFn(_getViews(settingsType));
            this.reload(settingsType, onLoadDoneFn, true);
        };

        this.reload = function(settingsType, onLoadDoneFn, showHideLoadingScreen) {
            if (showHideLoadingScreen) nlDlg.showLoadingScreen();
            nlServerApi.getGroupSettings({settings_type: settingsType})
            .then(function(data) {
                if (showHideLoadingScreen) nlDlg.hideLoadingScreen();
                _settings[settingsType] = data || _defaultSettings();
                onLoadDoneFn(_getViews(settingsType));
            }, function(err) {
                onLoadDoneFn(null);
            });
        };

        this.getViews = function(settingsType) {
            return _getViews(settingsType);
        };

        this.getColumnNames = function(settingsType) {
            return _getColumnNames(settingsType);
        };

        this.getCustomColumns = function(settingsType) {
            return _getCustomColumns(settingsType);
        };

        this.update = function(settingsType, views, columnNames, customColumns) {
            // TODO-NOW: remove deleted customColumns from all the views 
            var info = {views: views, columnNames: columnNames, customColumns: customColumns};
            var promise = nlServerApi.updateGroupSettings({settings_type: settingsType, info: info});
            promise.then(function(data) {
                _settings[settingsType] = data || _defaultSettings();
            });
            return promise;
        };

        this.updateAllColumnNames = function(settingsType, allColumns) {
            var updatedColumnNamesDict = _getColumnNames(settingsType);
            for(var i=0; i<allColumns.length; i++) {
                if(allColumns[i].id in updatedColumnNamesDict)
                    allColumns[i].name = updatedColumnNamesDict[allColumns[i].id] ;
            }
        };

        /* data = _settings[settingsType] = 
                    {
                        "views": [
                            {
                                "id": "id_1588757267240_nr58ivn44",
                                "columns": ["raw_record.typeStr", "raw_record._batchName", "raw_record.subject", "not_after"], 
                                "name": "custom view 2"
                            },
                            {
                                "id": "id_1582191876044_i3w7jq0d1", 
                                "columns": ["raw_record.subject", "raw_record._batchName", "raw_record._grade", "repcontent.name"],
                                "name": "my  custom view"
                            }
                        ],
                        "columnNames": {
                            "colid": "nameToDISTPLAY"
                        },
                        "customColumns": [
                            {"id": "_id.custom.1589265801125_en9pyu1km", "name": "custom column 1", "formula": "$date_format{'YYYY-MM-DD' , _id.created}"}, 
                            {"id": "_id.custom.1589265840230_wfanbt209", "name": "custom column 2", "formula": "$date_format{'YY-MM-DD' , _id.created}"}
                        ]
                    }
        */

        function _getViews(settingsType) {
            var data = _settings[settingsType] || {};
            return data.views || [];
        }

        function _getColumnNames(settingsType) {
            var data = _settings[settingsType] || {};
            return data.columnNames || {};
        }

        function _getCustomColumns(settingsType) {
            var data = _settings[settingsType] || {};
            return data.customColumns || [];
        }

        function _defaultSettings() {
            return {views: [], columnNames: {}, customColumns: []};
        }
    }

    //-------------------------------------------------------------------------------------------------
    function TableViewEditDlg(nl, nlDlg, nlExpressionProcessor, _groupSettings, $scope) {
        var _dlg = nlDlg.create($scope);
        var _deletedViewIds = {};

        function _init() {
            _dlg.setCssClass('nl-height-max nl-width-max');
            _dlg.scope.selectedView = null;
            _dlg.scope.data = {newViewName: '', selectedColumn: null, newName : '', newFormula : ''};
            _dlg.scope.views = angular.copy(_groupSettings.getViews($scope.config.tableType) || []);
            _dlg.scope.columnNames = angular.copy(_groupSettings.getColumnNames($scope.config.tableType) || {});
            _dlg.scope.customColumns = angular.copy(_groupSettings.getCustomColumns($scope.config.tableType) || []);
            _groupSettings.updateAllColumnNames($scope.config.tableType, $scope.config.allColumns);
            _dlg.scope.allColumns = angular.copy($scope.config.allColumns);
            _dlg.scope.selectedColumns = [];
            _dlg.scope.notSelectedFixedColumns = _dlg.scope.allColumns;
            _dlg.scope.notSelectedCustomColumns= angular.copy(_groupSettings.getCustomColumns($scope.config.tableType) || []);
            _updateCurrentColumnSelections();
            _dlg.scope.getIntelliTextOptions= _getIntelliTextOptions;
        }

        function _updateCurrentColumnSelections() {
            _dlg.scope.selectedColumns = [];
            _dlg.scope.notSelectedFixedColumns = _dlg.scope.allColumns;
            var columnDict = {};
            _selectionFalseOfColumns(_dlg.scope.allColumns, columnDict);
            _selectionFalseOfColumns(_dlg.scope.customColumns, columnDict);
            if (!_dlg.scope.selectedView) return;
            var columns = _dlg.scope.selectedView.columns || [];
            for (var i=0; i<columns.length; i++) {
                var column = columnDict[columns[i]];
                if (!column) continue;
                column.selected = true;
                _dlg.scope.selectedColumns.push(column);
            }
            _updateNotSelectedColumns();
        }

        function _selectionFalseOfColumns(columns, columnDict) {
            for(var i=0; i<columns.length; i++) {
                var column = columns[i];
                column.selected = false;
                columnDict[column.id] = column;
            }
        }

        function _updateNotSelectedColumns() {
            _dlg.scope.notSelectedFixedColumns = [];
            _dlg.scope.notSelectedCustomColumns = [];
            __updateNotSelectedColumns(_dlg.scope.notSelectedFixedColumns, _dlg.scope.allColumns);
            __updateNotSelectedColumns(_dlg.scope.notSelectedCustomColumns, _dlg.scope.customColumns);
        }

        function __updateNotSelectedColumns(updateColumns, allColumns) {
            for(var i=0; i<allColumns.length; i++) {
                var column = allColumns[i];
                if (!column.selected) updateColumns.push(column);
            }
        }

        function _getIntelliTextOptions(column) {
            var ret = {
                '$':[
                        { "name": "$date_format - (MM-YY)", "val": "$date_format{'MM-YY', }", "cursor": -1},
                        { "name": "$date_format - (MMM-YY)", "val": "$date_format{'MMM-YY', }", "cursor": -1},
                        { "name": "$date_format - (MMMM-YY)", "val": "$date_format{'MMMM-YY', }", "cursor": -1}
                    ],
                '_':[]
            };
            _modifyIntelliTextOptions(_dlg.scope.allColumns, ret);
            _modifyIntelliTextOptions(_dlg.scope.customColumns, ret, column);
            return ret;
        }

        function _modifyIntelliTextOptions(columns, ret, column) {
            for(var i=0; i < columns.length; i++) {
                var m = columns[i];
                if(column && column.id == m.id) break;
                var mid = '_id.' + m.id;
                var n = nl.fmt2('{} ({})', m.name, mid);
                ret['_'].push({name: n, val: mid, cursor: 0});
            }
        }

        _dlg.scope.onSelectView = function(view) {
            _updateCurrentView();
            _dlg.scope.selectedView = view;
            _updateCurrentColumnSelections();
        };

        function _updateCurrentView() {
            if (!_dlg.scope.selectedView) return;
            _dlg.scope.selectedView.columns = [];
            var viewCols = _dlg.scope.selectedView.columns;
            var guiCols = _dlg.scope.selectedColumns;
            for(var i=0; i<guiCols.length; i++) {
                viewCols.push(guiCols[i].id);
            }
        }

        _dlg.scope.onAddView = function() {
            if (!_dlg.scope.data.newViewName) {
                return nlDlg.popupAlert({title: 'Name needed', template: "Name cannot be empty. Please enter a view name."});
            }
            var newView = {id: _getUniqueId('id_'), name: _dlg.scope.data.newViewName};
            _dlg.scope.views.push(newView);
            _dlg.scope.data.newViewName = '';
            _dlg.scope.onSelectView(newView);
        };

        function _getUniqueId(prefix) {
            // Thanks to https://gist.github.com/gordonbrander/2230317
            // Math.random should be unique because of its seeding algorithm.
            // Convert it to base 36 (numbers + letters), and grab the first 9 characters
            // after the decimal.
            return prefix + (new Date()).getTime() + '_' + Math.random().toString(36).substr(2, 9);
        }

        _dlg.scope.onDeleteView = function(selectedView) {
            nlDlg.popupConfirm({title: 'Confirm', template: 'Are you sure you want to delete the view?'})
            .then(function(res) {
                if (!res) return;
                var pos = -1;
                for (var i=0; i<_dlg.scope.views.length; i++) {
                    if (_dlg.scope.views[i].id == selectedView.id) {
                        pos = i;
                        break;
                    }
                }
                if (pos == -1) return;
                _dlg.scope.views.splice(pos, 1);
                _deletedViewIds[selectedView.id] = true;
                if (_dlg.scope.selectedView && _dlg.scope.selectedView.id == selectedView.id) _dlg.scope.onSelectView(null);
            });
        };

        _dlg.scope.onColumnAdd = function(index, type) {
            _dlg.scope.editColumnClose();
            var column = (type == 'custom') ? _dlg.scope.notSelectedCustomColumns[index] : _dlg.scope.notSelectedFixedColumns[index];
            if (!column) return;
            column.selected = true;
            _dlg.scope.selectedColumns.push(column);
            _updateNotSelectedColumns();
        };

        _dlg.scope.removeItem = function(index) {
            _dlg.scope.editColumnClose();
            _dlg.scope.selectedColumns[index].selected = false;
            _dlg.scope.selectedColumns.splice(index, 1);
            _updateNotSelectedColumns();
        };

        var _reorderDlg = nlDlg.create($scope);
        _dlg.scope.reorderList = function() {
            _reorderDlg.setCssClass('nl-height-max nl-width-max');
            _reorderDlg.scope.data = {};
            _reorderDlg.scope.data.title = nl.t('Reorder the List');
            _reorderDlg.scope.data.selectedColumns = _dlg.scope.selectedColumns || [];
            var closeButton = {text: nl.t('Close')};
            _reorderDlg.show('lib_ui/utils/reorder_list.html', [], closeButton, false);
        }

        _reorderDlg.scope.moveItem = function(fromIndex, toIndex) {
            var _selectedColumns = _reorderDlg.scope.data.selectedColumns;
            if (!(_selectedColumns)) return;
            _selectedColumns.splice(toIndex, 0, _selectedColumns.splice(fromIndex, 1)[0]);
        };

        _dlg.scope.editColumnDetail = function(index, typeOfColumn) {
            _dlg.scope.columnType = typeOfColumn || '';
            var column = _dlg.scope.columnType == 'custom' ? _dlg.scope.notSelectedCustomColumns[index] : _dlg.scope.notSelectedFixedColumns[index];
            if(_dlg.scope.columnType == 'custom') _dlg.scope.data.newFormula = column.formula;
            _dlg.scope.data.newName = column.name;
            _dlg.scope.renameCol = index;
        };

        _dlg.scope.editColumnClose = function() {
            _dlg.scope.renameCol = undefined;
            _dlg.scope.columnType = undefined;
            _dlg.scope.data.newName = '';
            _dlg.scope.data.newFormula = '';
        };

        _dlg.scope.editColumnDone = function(index) {
            var column = _dlg.scope.columnType == 'custom' ? _dlg.scope.notSelectedCustomColumns[index] : _dlg.scope.notSelectedFixedColumns[index];
            var colid = column.id;
            column.name = _dlg.scope.data.newName;
            _dlg.scope.columnNames[colid] = column.name;
            if(_dlg.scope.columnType == 'custom') {
                column.formula = _dlg.scope.data.newFormula;
                _editCustomFormula(colid, column.formula);
            }
            _dlg.scope.editColumnClose();
        };

        function _editCustomFormula(colid, formula) {
            for(var i=0; i< _dlg.scope.customColumns.length; i++) {
                if(_dlg.scope.customColumns[i].id == colid){
                    _dlg.scope.customColumns[i].formula = formula;
                };
            }
        }

        _dlg.scope.addCustomColumn = function() {
            _dlg.scope.editColumnClose();
            _dlg.scope.columnType = 'addCustomColumn';
        };

        _dlg.scope.addCustomColumnDone = function() {

            if(!(_dlg.scope.data.newName && _dlg.scope.data.newFormula)) {
                _errorMesg('Name and Formula is mandatory for the custom column');
                return;
            }
            _customColumnValidation('name', _dlg.scope.data.newName);
            _customColumnValidation('formula', _dlg.scope.data.newFormula);
            var _newCustomColumn = {id: _getUniqueId('custom.'), name: _dlg.scope.data.newName, formula: _dlg.scope.data.newFormula};
            _dlg.scope.notSelectedCustomColumns.push(_newCustomColumn);
            _dlg.scope.customColumns.push(_newCustomColumn);
            _dlg.scope.editColumnClose();
        };

        _dlg.scope.removeCustomColumn = function(index) {
            var column = _dlg.scope.columnType == 'custom' ? _dlg.scope.notSelectedCustomColumns[index] : {};
            var colid = column.id;
            nlDlg.popupConfirm({title: nl.t('Please confirm'), template: 'Do you want to delete the column : <b>'+ column.name + '</b>'}).then(function(result) {
	    		if (!result) return;
                _dlg.scope.notSelectedCustomColumns.splice(index,1);
                for(var i=0; i< _dlg.scope.customColumns.length; i++) {
                    if(_dlg.scope.customColumns[i].id == colid) {
                        _dlg.scope.customColumns.splice(i,1);
                        break;
                    }
                }
                _dlg.scope.editColumnClose();
	    	});  
        };
        
        function _getAvpsForCustomFormula(currentCustomColumnId) {
            var ret = {};
            _getAvps(ret, _dlg.scope.allColumns);
            _getAvps(ret, _dlg.scope.customColumns, currentCustomColumnId); // TODO-NOW: pass proper id when we edit any custom column detail.
            return ret;
        }

        function _getAvps(ret, columns, currentCustomColumnId) {
            for(var i=0; i<columns.length; i++) {
                var column = columns[i];
                if(currentCustomColumnId && column.id == currentCustomColumnId) break;
                var cid = '_id.' + column.id;
                ret[cid] = null;
            }
        }

        function _customColumnValidation(type, value, currentCustomColumnId) {
            if(type == 'name') {
                for(var i=0; i< _dlg.scope.customColumns.length; i++ ) {
                    var _column = _dlg.scope.customColumns[i];
                    if(_column.name == value) {_errorMesg('Column Name alredy exist'); return false;}
                }
            }
            if(type == 'formula') {
                var _idsAboveCustomField = _getAvpsForCustomFormula(currentCustomColumnId);
                var payload = {strExpression: value, dictAvps: _idsAboveCustomField};
                nlExpressionProcessor.process(payload);
                if(payload.error) {
                    _errorMesg(payload.error);
                    return false;
                }
            }
            return true;
        }

        function _errorMesg(msg) {
            console.log(msg);
            // nlDlg.popupAlert(msg);
        }

        function _onUpdate(e) {
            _updateCurrentView();
            var serverViewsOld = _arrayToDict(_groupSettings.getViews($scope.config.tableType));
            var guiViews = _arrayToDict(_dlg.scope.views);
            var updatedColumnNames = _dlg.scope.columnNames;
            var updatedCustomColumns = _dlg.scope.customColumns;
            var lastSelectedView = angular.copy(_dlg.scope.selectedView);
            nl.timeout(function() {
                nlDlg.showLoadingScreen();
                _groupSettings.reload($scope.config.tableType, function(serverViewsLatest) {
                    serverViewsLatest = _arrayToDict(serverViewsLatest);
                    for (var viewId in _deletedViewIds) {
                        if (viewId in serverViewsLatest) delete serverViewsLatest[viewId];
                    }
                    for (var viewId in guiViews) {
                        var guiView = guiViews[viewId];
                        var serverViewOld = serverViewsOld[viewId] || null;
                        if (!(viewId in serverViewsLatest) || _hasViewChanged(serverViewOld, guiView)) {
                            serverViewsLatest[viewId] = {id: guiView.id, name: guiView.name, columns: guiView.columns || []};
                            continue;
                        }
                    }
                    serverViewsLatest = _dictToSortedArray(serverViewsLatest);
                    _groupSettings.update($scope.config.tableType, serverViewsLatest, updatedColumnNames, updatedCustomColumns)
                    .then(function() {
                        for(var i=0; i<serverViewsLatest.length; i++) {
                            if(lastSelectedView.id == serverViewsLatest[i].id) {
                                $scope.onOptionSelect(serverViewsLatest[i]);
                                break;
                            }
                        }
                        nlDlg.hideLoadingScreen();
                    });
                });
            });
        }

        function _arrayToDict(arr) {
            if (!arr) arr = [];
            var ret = {};
            for(var i=0; i<arr.length; i++) ret[arr[i].id] = arr[i];
            return ret;
        }

        function _dictToSortedArray(viewDict) {
            var ret = [];
            for (var viewId in viewDict) ret.push(viewDict[viewId]);
            ret.sort(function(a, b) {
                return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
            })
            return ret;
        }

        function _hasViewChanged(view1, view2) {
            if (!view1) return true;
            if (view1.name != view2.name || view1.columns.length != view2.columns.length) return true;
            for(var i=0; i<view1.columns.length; i++) {
                if (view1.columns[i] != view2.columns[i]) return true;
            }
            return false;
        }

        this.show = function() {
            _init();
            var buttons = [{text: nl.t('Update'), onTap : _onUpdate}];
            var cancelButton = {text : nl.t('Cancel')};
            _dlg.show('lib_ui/utils/table_view_editor_dlg.html', buttons, cancelButton);
        };
    }
    
    //-------------------------------------------------------------------------------------------------
    module_init();
})();
(function() {

    //-------------------------------------------------------------------------------------------------
    // table_view_selector.js: Directive to select a view on a table (columns to display) and also define
    // such views.
    //-------------------------------------------------------------------------------------------------
    function module_init() {
        angular.module('nl.ui.table_view_selector', [])
        .directive('nlTableViewSelector', TableViewSelector)
        .service('nlTableViewSelectorSrv', TableViewSelectorSrv);
    }
    
    //-------------------------------------------------------------------------------------------------
    var TableViewSelectorSrv = ['nl', 'nlServerApi',
    function(nl, nlServerApi) {
        this.init = function(userInfo) {
            _grpAdmin = ((userInfo || {}).permissions || {}).nittio_support || false;
            return this.reload(['nht_views', 'lr_views']);
        };

        var _grpAdmin = false;
        this.isGrpAdmin = function() {
            return _grpAdmin;
        }; 

        this.reload = function(settings_types) {
            return nl.q(function(resolve, reject) {
                nlServerApi.getGroupSettings({settings_types: settings_types}).then(function(data) {
                    for (var k in data) {
                        _settings[k] = data[k];
                        if (!_settings[k]) _settings[k] = _defaultSettings();
                    }
                    // TODO-NOW: Migrate column ids
                    // LR tab:
                    // repcontent.assignid => raw_record.assignment
                    // stats.internalIdentifier => raw_record.id
                    resolve(true);
                }, function(err) {
                    resolve(false);
                });
            });
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
                            {"id": "custom.1589265801125_en9pyu1km", "name": "custom column 1", "formula": "$date_format{'YYYY-MM-DD' , _id.created}"}, 
                            {"id": "custom.1589265840230_wfanbt209", "name": "custom column 2", "formula": "$date_format{'YY-MM-DD' , _id.created}"}
                        ]
                    }
        */
       this.update = function(settingsType, info) {
            _cleanupDeletedCustomColumns(info);
            return nlServerApi.updateGroupSettings({settings_type: settingsType, info: info})
            .then(function(data) {
                _settings[settingsType] = data || _defaultSettings();
            });
        };

        this.getViews = function(settingsType) {
            var data = _settings[settingsType] || {};
            return data.views || [];
        };

        this.getColumnNames = function(settingsType) {
            var data = _settings[settingsType] || {};
            return data.columnNames || {};
        };

        this.getCustomColumns = function(settingsType) {
            var data = _settings[settingsType] || {};
            return data.customColumns || [];
        };

        this.updateAllColumnNames = function(settingsType, allColumns) {
            var updatedColumnNamesDict = this.getColumnNames(settingsType);
            for(var i=0; i<allColumns.length; i++) {
                if(allColumns[i].id in updatedColumnNamesDict)
                    allColumns[i].name = updatedColumnNamesDict[allColumns[i].id] ;
            }
        };

        var _settings = {};
        function _defaultSettings() {
            return {views: [], columnNames: {}, customColumns: []};
        }

        function _cleanupDeletedCustomColumns(info) {
            var customColumnsDict = nl.utils.arrayToDictById(info.customColumns);
            for (var i=0; i<info.views.length; i++) {
                var view = info.views[i];
                var newColumns = [];
                for (var j=0; j<view.columns.length; j++) {
                    var colid = view.columns[j];
                    if (_isCustomColumn(colid) && !(colid in customColumnsDict)) continue;
                    newColumns.push(colid);
                };
                info.views[i].columns = newColumns;
            }
        }

        function _isCustomColumn(colid) {
            return colid.indexOf('custom.') == 0;
        }
    }];

    //-------------------------------------------------------------------------------------------------
    var TableViewSelector = ['nl', 'nlDlg', 'nlTableViewSelectorSrv', 'nlExpressionProcessor',
    function(nl, nlDlg, nlTableViewSelectorSrv, nlExpressionProcessor) {
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
                nlTableViewSelectorSrv.updateAllColumnNames($scope.config.tableType, $scope.config.allColumns);
                var selectedCustColumns = {};
                var selectedColumns = _getColumnsSelectedInView($scope.config.tableType, option.columns,
                    $scope.config.allColumns, selectedCustColumns);
                $scope.config.onViewChange(selectedColumns, selectedCustColumns);
            };

            $scope.onCustomizeViews = function() {
                if (!$scope.config || !$scope.config.canEdit) return;
                $scope.isOpen = false;
                var tableViewEditDlg = new TableViewEditDlg(nl, nlDlg, nlExpressionProcessor, nlTableViewSelectorSrv, $scope);
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
            var options =  nlTableViewSelectorSrv.getViews($scope.config.tableType);
            if (!options) return _initScope($scope);
            if ($scope.config.defaultViewColumns) $scope.options = [$scope.config.defaultViewColumns, _allOption];
            else $scope.options = [_defaultOption, _allOption];
            for (var i=0; i<options.length; i++) {
                $scope.options.push(options[i]);
            }
        }

        function _getColumnsSelectedInView(tableType, selectedColumns, allColumns, selectedCustColumns) {
            if (!selectedColumns) return allColumns;
            var allColumnIds = nl.utils.arrayToDictById(allColumns);
            var custColsDict = nl.utils.arrayToDictById(nlTableViewSelectorSrv.getCustomColumns(tableType));
            var ret = [];
            for(var i=0; i<selectedColumns.length; i++) {
                var colid = selectedColumns[i];
                if (colid in custColsDict) {
                    ret.push(custColsDict[colid]);
                    selectedCustColumns[colid] = true;
                } else if (colid in allColumnIds) ret.push(allColumnIds[colid]);
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
    function TableViewEditDlg(nl, nlDlg, nlExpressionProcessor, nlTableViewSelectorSrv, $scope) {
        var _dlg = nlDlg.create($scope);
        var _deletedViewIds = {};

        function _init() {
            _dlg.setCssClass('nl-height-max nl-width-max');
            _dlg.scope.selectedView = null;
            _dlg.scope.isGrpAdmin = nlTableViewSelectorSrv.isGrpAdmin();
            _dlg.scope.data = {newViewName: '', selectedColumn: null, newName : '', newFormula : ''};
            _dlg.scope.views = angular.copy(nlTableViewSelectorSrv.getViews($scope.config.tableType));
            _dlg.scope.columnNames = angular.copy(nlTableViewSelectorSrv.getColumnNames($scope.config.tableType));
            _dlg.scope.customColumns = angular.copy(nlTableViewSelectorSrv.getCustomColumns($scope.config.tableType));
            nlTableViewSelectorSrv.updateAllColumnNames($scope.config.tableType, $scope.config.allColumns);
            _dlg.scope.allColumns = angular.copy($scope.config.allColumns);
            _dlg.scope.selectedColumns = [];
            _dlg.scope.notSelectedFixedColumns = _dlg.scope.allColumns;
            _dlg.scope.notSelectedCustomColumns= angular.copy(nlTableViewSelectorSrv.getCustomColumns($scope.config.tableType));
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
            if(!_validateColumnName(_dlg.scope.data.newName)) return;
            if(_dlg.scope.columnType == 'custom') {
                if(!_validateCustomColumnFormula(_dlg.scope.data.newFormula, index)) return;
                column.formula = _dlg.scope.data.newFormula;
                _editCustomFormula(colid, column.formula);
            }
            column.name = _dlg.scope.data.newName;
            _dlg.scope.columnNames[colid] = column.name;
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
            if(!_validateColumnName(_dlg.scope.data.newName)) return;
            if(!_validateCustomColumnFormula(_dlg.scope.data.newFormula)) return;
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
            _getAvps(ret, _dlg.scope.customColumns, currentCustomColumnId);
            return ret;
        }

        function _getAvps(ret, columns, currentCustomColumnId) {
            for(var i=0; i<columns.length; i++) {
                var column = columns[i];
                if(column.id == currentCustomColumnId) break;
                var cid = '_id.' + column.id;
                ret[cid] = null;
            }
        }

        function _validateColumnName(value) {
            if(!value) return _errorMesg('Name is mandatory');
            if(!(__validateColumnName(value, _dlg.scope.customColumns) && __validateColumnName(value, _dlg.scope.allColumns)))
                return _errorMesg('Column Name alredy exist')
            return true;
        }

        function __validateColumnName(value, columns) {
            for(var i=0; i< columns.length; i++ ) {
                var column = columns[i];
                if(column.name.toLowerCase() == value.toLowerCase()) return false;
            }
            return true;
        }

        function _validateCustomColumnFormula(value, currentCustomColumnId) {
            if(!value) return _errorMesg('Formula is mandatory');
            var _idsAboveCustomField = _getAvpsForCustomFormula(currentCustomColumnId);
            var payload = {strExpression: value, dictAvps: _idsAboveCustomField};
            nlExpressionProcessor.process(payload);
            if(payload.error) return _errorMesg(payload.error);
            return true;
        }

        function _errorMesg(msg) {
            nlDlg.popupAlert({title: 'Error', template: msg});
            return false;
        }

        function _onUpdate(e) {
            _updateCurrentView();
            var serverViewsOld = nl.utils.arrayToDictById(nlTableViewSelectorSrv.getViews($scope.config.tableType));
            var guiViews = nl.utils.arrayToDictById(_dlg.scope.views);
            var updatedColumnNames = _dlg.scope.columnNames;
            var updatedCustomColumns = _dlg.scope.customColumns;
            var lastSelectedView = angular.copy(_dlg.scope.selectedView);
            nl.timeout(function() {
                nlDlg.showLoadingScreen();
                nlTableViewSelectorSrv.reload([$scope.config.tableType])
                .then(function() {
                    var serverViewsLatest = nlTableViewSelectorSrv.getViews($scope.config.tableType);
                    serverViewsLatest = nl.utils.arrayToDictById(serverViewsLatest);
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
                    var info = {views: serverViewsLatest, columnNames: updatedColumnNames, customColumns: updatedCustomColumns};
                    nlTableViewSelectorSrv.update($scope.config.tableType, info)
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

        function _dictToSortedArray(viewDict) {
            var ret = nl.utils.dictToList(viewDict);
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
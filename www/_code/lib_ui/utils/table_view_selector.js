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
    var TableViewSelector = ['nl', 'nlDlg', 'nlServerApi',
    function(nl, nlDlg, nlServerApi) {
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
                var columns = _validateColumns(option.columns, $scope.config.allColumns);
                $scope.config.onViewChange(columns);
            };

            $scope.onCustomizeViews = function() {
                if (!$scope.config || !$scope.config.canEdit) return;
                $scope.isOpen = false;
                var tableViewEditDlg = new TableViewEditDlg(nl, nlDlg, _groupSettings, $scope);
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
            if (settingsType in _settings) return onLoadDoneFn(_get(settingsType));
            this.reload(settingsType, onLoadDoneFn, true);
        };

        this.reload = function(settingsType, onLoadDoneFn, showHideLoadingScreen) {
            if (showHideLoadingScreen) nlDlg.showLoadingScreen();
            nlServerApi.getGroupSettings({settings_type: settingsType})
            .then(function(data) {
                if (showHideLoadingScreen) nlDlg.hideLoadingScreen();
                _settings[settingsType] = data || _defaultSettings();
                onLoadDoneFn(_get(settingsType));
            }, function(err) {
                onLoadDoneFn(null);
            });
        };

        this.get = function(settingsType) {
            return _get(settingsType);
        };

        this.update = function(settingsType, views) {
            var info = {views: views};
            var promise = nlServerApi.updateGroupSettings({settings_type: settingsType, info: info});
            promise.then(function(data) {
                _settings[settingsType] = data || _defaultSettings();
            });
            return promise;
        };

        function _get(settingsType) {
            var data = _settings[settingsType]; // {views: [{id: xx, name: XX, columns: ['col3', 'col5', 'col1']}, ...]}
            return data.views || [];
        }

        function _defaultSettings() {
            return {views: []};
        }
    }

    //-------------------------------------------------------------------------------------------------
    function TableViewEditDlg(nl, nlDlg, _groupSettings, $scope) {
        var _dlg = nlDlg.create($scope);
        var _deletedViewIds = {};

        function _init() {
            _dlg.setCssClass('nl-height-max nl-width-max');
            _dlg.scope.selectedView = null;
            _dlg.scope.data = {newViewName: '', selectedColumn: null};
            _dlg.scope.views = angular.copy(_groupSettings.get($scope.config.tableType) || []);
            _dlg.scope.allColumns = angular.copy($scope.config.allColumns);
            _dlg.scope.selectedColumns = [];
            _dlg.scope.notSelectedColumns = _dlg.scope.allColumns;
            _updateCurrentColumnSelections();
        }

        function _updateCurrentColumnSelections() {
            _dlg.scope.selectedColumns = [];
            _dlg.scope.notSelectedColumns = _dlg.scope.allColumns;
            var columnDict = {};
            for(var i=0; i<_dlg.scope.allColumns.length; i++) {
                var column = _dlg.scope.allColumns[i];
                column.selected = false;
                columnDict[column.id] = column;
            }
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

        function _updateNotSelectedColumns() {
            _dlg.scope.notSelectedColumns = [];
            for(var i=0; i<_dlg.scope.allColumns.length; i++) {
                var column = _dlg.scope.allColumns[i];
                if (!column.selected) _dlg.scope.notSelectedColumns.push(column);
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
            var newView = {id: _getUniqueId(), name: _dlg.scope.data.newViewName};
            _dlg.scope.views.push(newView);
            _dlg.scope.data.newViewName = '';
            _dlg.scope.onSelectView(newView);
        };

        function _getUniqueId() {
            // Thanks to https://gist.github.com/gordonbrander/2230317
            // Math.random should be unique because of its seeding algorithm.
            // Convert it to base 36 (numbers + letters), and grab the first 9 characters
            // after the decimal.
            return 'id_' + (new Date()).getTime() + '_' + Math.random().toString(36).substr(2, 9);
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

        _dlg.scope.onColumnSelect = function() {
            var column = _dlg.scope.data.selectedColumn;
            if (!column || column.selected) return;
            column.selected = true;
            _dlg.scope.selectedColumns.push(column);
            _updateNotSelectedColumns();
        };

        _dlg.scope.onColumnUnselect = function(pos) {
            _dlg.scope.selectedColumns[pos].selected = false;
            _dlg.scope.selectedColumns.splice(pos, 1);
            _updateNotSelectedColumns();
        };

        _dlg.scope.onColumnMoveUp = function(pos) {
            if (pos-1 < 0 || pos > _dlg.scope.selectedColumns.length - 1) return;
            var temp = _dlg.scope.selectedColumns[pos];
            _dlg.scope.selectedColumns[pos] = _dlg.scope.selectedColumns[pos-1];
            _dlg.scope.selectedColumns[pos-1] = temp;
        };

        _dlg.scope.onColumnMoveDown = function(pos) {
            if (pos < 0 || pos+1 > _dlg.scope.selectedColumns.length - 1) return;
            var temp = _dlg.scope.selectedColumns[pos];
            _dlg.scope.selectedColumns[pos] = _dlg.scope.selectedColumns[pos+1];
            _dlg.scope.selectedColumns[pos+1] = temp;
        };

        function _onUpdate(e) {
            _updateCurrentView();
            var serverViewsOld = _arrayToDict(_groupSettings.get($scope.config.tableType));
            var guiViews = _arrayToDict(_dlg.scope.views);
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
                    _groupSettings.update($scope.config.tableType, serverViewsLatest)
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
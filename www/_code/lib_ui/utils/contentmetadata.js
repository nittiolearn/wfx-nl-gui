(function() {

//-------------------------------------------------------------------------------------------------
// contentmetadata.js: Content metadata related service
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.ui.contentmetadata', [])
    .service('nlMetaDlg', MetaDlg);
}

//-------------------------------------------------------------------------------------------------
var MetaDlg = ['nl', 'nlDlg', 'nlServerApi', 'nlTreeSelect',
function(nl, nlDlg, nlServerApi, nlTreeSelect) {

    this.getMetadataFromUrl = function() {
        var params = nl.location.search();
        var ret = {};
        _copyIf(params, ret, 'search');
        _copyIf(params, ret, 'custtype');
        _copyIf(params, ret, 'grade');
        _copyIf(params, ret, 'subject');
        for(var i=0; i<100; i++) {
            _copyIf(params, ret, 'attr'+i);
        }
        return ret;
    };
    
    function _copyIf(src, dest, attr) {
        if (attr in src) dest[attr] = src[attr];
    }
    
    this.showMetadata = function($scope, _userInfo, ctype, cid, card) {
        return nl.q(function(resolve, reject) {
            var params = {$scope: $scope, _userInfo: _userInfo, 
                resolve: resolve, reject: reject,
                ctype: ctype, cid: cid, card: card,
                config: {}};
            return _showImpl(params);
        });
    };
    
    this.showAdvancedSearchDlg = function($scope, _userInfo, ctype, metadata, config) {
        if (!config) config = {};
        return nl.q(function(resolve, reject) {
            var params = {$scope: $scope, _userInfo: _userInfo, 
                resolve: resolve, reject: reject, 
                ctype: ctype, cid: null, card: null,
                config: config, metadata: metadata};
            _showImpl(params);
        });
    };

    var _hiddenFields = [];

    function _showImpl(params) {
        params.dlg = nlDlg.create(params.$scope);
        params.dlg.setCssClass('nl-height-max nl-width-max');
        if (params.cid)
            params.dlg.scope.dlgTitle = nl.t('Metadata: {}', params.card.title);
        else
            params.dlg.scope.dlgTitle = nl.t('Advanced search');
        params.dlg.scope.data = {};
        params.dlg.scope.banner = params.config.banner;
        params.dlg.scope.canFetchMore = params.config.canFetchMore;
        
        nlDlg.showLoadingScreen();
        var promise1 = nlServerApi.cmGetFields();
        var promise2 = (params.cid) ? nlServerApi.cmGet(params.cid, params.ctype) : _dummyPromise(params);
        promise1.then(function(cmFields) {
            promise2.then(function(metadata) {
                nlDlg.hideLoadingScreen();
                _showDlg(params, cmFields, metadata);
            });
        });
    }
    
    function _dummyPromise(params) {
        return nl.q(function(resolve, reject) {
            resolve(params.metadata || {});
        });
    }

    function _getImportFromGroup(search) {
        if (!search) return null;
        var words = search.toLowerCase().split(' ');
        if (words[0].indexOf('grp:') != 0) return null;
        var grp = words[0].substring(4);
        return grp.trim();
    }

    function _showDlg(params, cmFields, metadata) {
        var data = params.dlg.scope.data;
        data.cmFields = [];
        _hiddenFields = [];
        var isSearch = !params.cid;

        if (isSearch) {
            var searchField = {id: 'search', name: 'Search', type: 'text', value: metadata.search || ''};
            _hiddenFields.push(searchField);
            var importfromgrp = _getImportFromGroup(metadata.search);
            if (importfromgrp !== null)
                data.cmFields.push({id: 'importfromgrp', name: 'Search in group', 
                    type: 'text', value: importfromgrp});
        }

        var allowedFields = params.config.allowedFields || null;
        for(var i=0; i<cmFields.length; i++) {
            var cmField = cmFields[i];
            cmField.value = _valueToGuiField(cmField, metadata, isSearch);
            if (cmField.hidden || (allowedFields && !allowedFields[cmField.id])) {
                _hiddenFields.push(cmField);
                continue;
            }
            data.cmFields.push(cmField);
        }

        var additionalFields = params.config.additionalFields || {};
        for(var f in additionalFields) {
            var cmField = additionalFields[f];
            cmField.value = _valueToGuiField(cmField, metadata, isSearch);
            data.cmFields.push(cmField);
        }

        var buttons = [];
        if (!isSearch &&
            params._userInfo.groupinfo.id == params.card.grp && 
            params._userInfo.permissions.lesson_approve) {
            buttons.push({ text : nl.t('Update'), onTap : function(e) {
                _onUpdate(e, params);
            }});
        }
        if (isSearch) {
            buttons.push({ text : nl.t('Search'), onTap : function(e) {
                if (params.resolve) params.resolve({metadata: _getMetadata(params, false)});
            }});
            if (params.dlg.scope.canFetchMore)
                buttons.push({ text : nl.t('Fetch more'), onTap : function(e) {
                    if (params.resolve) params.resolve({canFetchMore: true});
                }});
        }
        var cancelButton = {text : nl.t('Close')};
        params.dlg.show('lib_ui/utils/contentmetadata_dlg.html', buttons, cancelButton);
    }
    
    function _onUpdate(e, params) {
        var metadata = _getMetadata(params, true);
        if (!metadata) {
            if(e) e.preventDefault();
            nlDlg.popupAlert({title: 'Error', template: 
                nl.t('Some mandatory fields are not filled. Please fill them up before updating')})
            return;
        }
        nlDlg.showLoadingScreen();
        nlServerApi.cmSet(params.cid, params.ctype, metadata).then(function() {
            nlDlg.hideLoadingScreen();
            if (params.resolve) params.resolve(true);
        });
    }
    
    function _getMetadata(params, isUpdate) {
        var cmFields = params.dlg.scope.data.cmFields;
        var metadata = {};
        var error = false;
        for (var i=0; i<cmFields.length; i++) {
            var cmField = cmFields[i];
            if (!_guiFieldToMetadataDict(params, cmField, metadata, isUpdate)) error = true;
        }
        for (var i=0; i<_hiddenFields.length; i++) {
            var cmField = _hiddenFields[i];
            if (!_guiFieldToMetadataDict(params, cmField, metadata, isUpdate)) error = true;
        }
        if (isUpdate && error) return null;
        if ('importfromgrp' in metadata) {
            var grp = metadata.importfromgrp;
            var words = metadata.search.split(' ');
            words.shift();
            words.unshift('grp:' + grp);
            metadata.search = words.join(' ');
        }
        return metadata;
    }
    
    function _valueToGuiField(cmField, metadata, isSearch) {
        var val = cmField.id in metadata ? metadata[cmField.id] : null;
        if (cmField.type == 'text' || cmField.type == 'number') return val;

        // type is 'select' or 'multi-select'
        var selectedIds = {};
        if (Array.isArray(val)) for (var i=0; i<val.length; i++) selectedIds[val[i]] = true;
        else if (val) selectedIds[val] = true;

        var treeSelectInfo = {};
        treeSelectInfo.data = nlTreeSelect.strArrayToTreeArray(cmField.values || []);
        nlTreeSelect.updateSelectionTree(treeSelectInfo, selectedIds);
        treeSelectInfo.treeIsShown = false;
        treeSelectInfo.multiSelect = !isSearch && (cmField.type == 'multi-select');
        return treeSelectInfo;
    }

    var _ctypesManditoryAttrs = {module: {grade: true, subject: true, custtype: true}, 
                    course: {custtype: true} }

    function _guiFieldToMetadataDict(params, cmField, metadata, isUpdate) {
        cmField.error = false;
        var val = _guiFieldToValue(params, cmField, isUpdate);
        var mandatory = isUpdate && (cmField.id in _ctypesManditoryAttrs[params.ctype]);
        if (mandatory && val === null) {
            cmField.error = 'This field is mandatory';
            return false;
        }
        if (val === null) return true;
        metadata[cmField.id] = val;
        return true;
    }
    
    function _guiFieldToValue(params, cmField, isUpdate) {
        var val = cmField.value;
        if (cmField.type == 'text') return val || null;
        if (cmField.type == 'number') return val !== null? parseInt(val) : null;
        val.treeIsShown = false;
        val = nlTreeSelect.getSelectedIds(val);
        var ret = [];
        for (var v in val) ret.push(v);
        if (ret.length == 0) return null;
        if (isUpdate && cmField.type == 'multi-select') return ret;
        return ret[0];
    }

}];

//-------------------------------------------------------------------------------------------------
module_init();
})();
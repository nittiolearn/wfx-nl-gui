(function() {

//-------------------------------------------------------------------------------------------------
// admin_user_import.js:
// CSV bulk import of user administration data
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.admin_user_import', [])
    .service('nlAdminUserImport', AdminUserImportSrv);
}

//-------------------------------------------------------------------------------------------------
var AdminUserImportSrv = ['nl', 'nlDlg', 'nlGroupInfo', 'nlImporter', 'nlProgressLog', 'nlRouter',
'nlServerApi',
function(nl, nlDlg, nlGroupInfo, nlImporter, nlProgressLog, nlRouter, nlServerApi) {
    var self = this;
    var _grpid = null;
    var _groupInfo = null;
    var _userInfo = null;
    
    this.importUsers = function($scope, grpid, groupInfo, userInfo) {
        return nl.q(function(resolve, reject) {
            if (_isImportOngoing()) {
                reject('Import operation is ongoing');
                return;
            }
            _grpid = grpid;
            _groupInfo = groupInfo;
            _userInfo = userInfo;
            self.resolve = resolve;
            self.reject = reject;
            _import($scope);
        });
    };
    
    function _isImportOngoing() {
        return _groupInfo != null;
    }
    
    function _onImportDone() {
        self.reject = null;
        self.pl = null;
        self.dlg = null;
        _groupInfo = null;
        _userInfo = null;

        self.resolve();
        self.resolve = null;
        return true;
    }

    function _import($scope) {
        var dlg = nlDlg.create($scope);
        self.dlg = dlg;
        dlg.setCssClass('nl-height-max nl-width-max');
        dlg.scope.error = {};
        dlg.scope.started = false;
        dlg.scope.running = false;
        dlg.scope.data = {filelist: [], validateOnly: true};
        dlg.scope.onImport = function(e) {
            _onImport(e, dlg.scope);
        };
        self.pl = nlProgressLog.create(dlg.scope);
        self.pl.showLogDetails(true);
        self.pl.clear();
        
        var cancelButton = {
            text : nl.t('Close'),
            onTap: function(e) {
                if (!dlg.scope.running) {
                    dlg.scope.dontClose = false;
                    _onImportDone();
                    return;
                }
                if (e) e.preventDefault();
                nlDlg.popupStatus('Import ongoing'); 
                dlg.scope.dontClose = true;
            }
        };
        dlg.show('view_controllers/admin/admin_user_import_dlg.html', [], cancelButton, false);
    }

    function _onImport(e, dlgScope) {
        self.statusCnts = {total: 0, ignore: 0, process: 0, success: 0, error: 0};
        self.foundKeys = {};
        if (e) e.preventDefault();
        if (dlgScope.data.filelist.length == 0) {
            dlgScope.error.filelist = 'Please select the CSV file';
            return;
        }

        self.setProgress('start');
        dlgScope.started = true;
        dlgScope.running = true;
        var csvFile = dlgScope.data.filelist[0].resource;
        self.pl.imp('Import started: ' + csvFile.name);
        nlImporter.readCsv(csvFile).then(function(result) {
            try {
                if (result.error)
                    _throwException('Error parsing CSV file. Header row missing');
                self.pl.imp('Read successful', angular.toJson(result, 2));
                var table = result.table;
                var rows = _processCsvFile(table);
                self.setProgress('processCsv');
                self.pl.imp(nl.fmt2('Processing CSV file successful - {} of {} records to be sent to server', 
                    self.statusCnts.process, self.statusCnts.total), angular.toJson(rows, 2));
                if (dlgScope.data.validateOnly) {
                    _done(true);
                    return;
                }
                _updateServer(rows).then(function() {
                    _done();
                });
            } catch(e) {
                _error(e);
            }
        }, function(e) {
            _error(nl.t('Error reading CSV file: {}', e));
        });
    }

    function _throwException(message, obj) {
        throw({message: message, obj: obj});
    }
    
    function _error(e) {
        self.setProgress('done');
        var msg = e && e.message ? e.message : 'Error encountered during import';
        var data = e && e.obj ? e.obj : self.statusCnts;
        self.pl.imp('Status counts', angular.toJson(self.statusCnts, 2));
        self.pl.error(msg, angular.toJson(data, 2));
        self.dlg.scope.running = false;
    }
    
    function _doneImpl(validateOnly) {
        self.setProgress('done');
        self.reload = false;
        var msg = self.statusCnts.error > 0 ? 'Import done with errors: ' : 'Import successful: ';
        msg += ' total:{}, records sent to server: {}, success: {}, error: {}';
        if (validateOnly) msg = 'Validation done - no upload done: total:{}';
        msg = nl.fmt2(msg, self.statusCnts.total, self.statusCnts.process,
            self.statusCnts.success, self.statusCnts.error);
        if (self.statusCnts.error > 0)
            self.pl.error(msg, angular.toJson(self.statusCnts, 2));
        else
            self.pl.imp(msg, angular.toJson(self.statusCnts, 2));
        self.dlg.scope.running = false;
    }
    
    function _done(validateOnly) {
        if (!self.reload) {
            _doneImpl(validateOnly);
            return;
        }
        nlGroupInfo.init(true, _grpid).then(function() {
            nlGroupInfo.update(_grpid);
            _groupInfo = nlGroupInfo.get(_grpid);
            _doneImpl(validateOnly);
        });
    }
    
    var _progressLevels = {
        start: [0, 0],
        processCsv: [0, 5],
        uploadToServer: [5, 98],
        done: [98, 100]
    };
    
    this.setProgress = function(currentAction, doneSubItems, maxSubItems) {
        if (doneSubItems !== 0 && !doneSubItems) doneSubItems = 1;
        if (!maxSubItems) maxSubItems = 1;
        var levels = _progressLevels[currentAction];
        var p = levels[0] + (doneSubItems/maxSubItems)*(levels[1] - levels[0]);
        self.pl.progress(p);
    }

    function _processCsvFile(table) {
        var headerInfo = _getHeaders(table);
        self.pl.debug('Header row processsed', angular.toJson(headerInfo, 2));
        var data = [];
        for (var i=1; i<table.length; i++) {
            var row = table[i];
            self.statusCnts.total++;
            self.pl.debug('Validating row', angular.toJson(row, 2));
            row = _getRowObj(row, headerInfo, i);
            if (row == null) {
                self.statusCnts.ignore++;
                self.pl.debug('Validated row - ignoring');
            } else {
                self.statusCnts.process++;
                self.pl.debug('Validated row', angular.toJson(row, 2));
                data.push(row);
            }
        }
        return data;
    }
    
    var _headers = [
        {id: 'op', name: "Operation"},
        {id: 'key', name: "Key", optional: true},
        {id: 'uid', name: "User Id"},
        {id: 'gid', name: "Group Id", optional: true},
        {id: 'ut', name: "User Type"},
        {id: 'fname', name: "First name"},
        {id: 'lname', name: "Last name", optional: true},
        {id: 'email', name: "Email"},
        {id: 'state', name: "State", optional: true},
        {id: 'ou', name: "OU", oldnames: ["Class / user group"]},
        {id: 'secOus', name: "Sec OUs", oldnames: ["Secondary user groups"], optional: true},
        {id: 'created', name: "Created UTC Time", optional: true},
        {id: 'updated', name: "Updated UTC Time", optional: true}
     ];

    var _headerNameToInfo = (function() {
        var ret = {};
        for(var i=0; i<_headers.length; i++) {
            var item = _headers[i];
            ret[item.name.toLowerCase()] = item;
            if (!item.oldnames) continue;
            for (var j=0; j<item.oldnames.length; j++)
                ret[item.oldnames[j].toLowerCase()] = item;
        }
        return ret;
    })();

    function _getHeaders(table) {
        if (table.length == 0)
            _throwException('Header row not found'); 
        var row = table[0];
        var ret = [];
        var found = {};
        for(var i=0; i<row.length; i++) {
            var col = row[i].toLowerCase().trim();
            if (!(col in _headerNameToInfo))
                _throwException(nl.fmt2('Unknown header: {}', col)); 
            var info = _headerNameToInfo[col];
            if (info.id in found)
                _throwException(nl.fmt2('Header repeated: {}', col));
            found[info.id] = true;
            ret.push(info);
        }
        
        // Check if all mandatory headers are present
        for(var i=0; i<_headers.length; i++) {
            var info = _headers[i];
            if (!info.optional && !(info.id in found))
                _throwException(nl.fmt2('Mandatory header missing: {}', info.name)); 
        }
        return ret;
    }

    function _getRowObj(row, headerInfo, pos) {
        var ret = {pos: pos+1};
        for(var i=0; i<row.length; i++) {
            if (i>headerInfo.length-1) break;
            var colInfo = headerInfo[i];
            ret[colInfo.id] = row[i];
        }
        for(var i=0; i<_headers.length; i++) {
            if (_headers[i].id in ret) continue;
            if (!_headers[i].optional && ret[i] === '')
                _throwException(nl.fmt2('Mandatory field {} missing in row {}', _headers[i].name, i)); 
        }
        _validateRow(ret);
        if (ret.ignore) return null;
        return ret;
    }

    function _validateRow(row) {
        _validateOp(row);
        _validateGroup(row);
        _validateKeyColumns(row);
        _validateUserType(row);
        _validateState(row);
        _validateNames(row);
        _validateEmailAndMobile(row);
        _validateOus(row);
        _validateManagers(row);
        _deleteUnwanted(row);
        _validateDuplicates(row);
    }

    var _validOps = {'c': true, 'C': true, 'u': true, 'U': true, 'd': true, 'e': true, 'E': true, 'i': true};
    function _validateOp(row) {
        if (!(row.op in _validOps))
            _throwException('Invalid operation specified', row);
        if (row.op == 'd' && !nlRouter.isPermitted(_userInfo, 'admin_group'))
            _throwException('Modify with state=1 instead of delete', row);
        if (row.op == 'i') row.ignore = true;
    }
    
    function _validateGroup(row) {
        if (!row.gid) row.gid = _groupInfo.grpid;
        row.gid = row.gid.toLowerCase().trim();
        if (nlRouter.isPermitted(_userInfo, 'admin_group')) return;

        if (row.gid != _groupInfo.grpid)
            _throwException('Group id not allowed', row);
    }
    
    function _validateKeyColumns(row) {
        if (!row.uid)
            _throwException('User id is missing', row);
        row.uid = row.uid.toLowerCase().trim();
        if (!row.key) row.key = row.uid + '.' + row.gid;
        row.key = row.key.toLowerCase().trim();
        
        if (row.op != 'i' && row.op != 'c' && row.op != 'C') {
            if (!(row.key in _groupInfo.derived.keyToUsers))
                _throwException('Key/loginid not found', row);
        } else if (row.op == 'c' || row.op == 'C') {
            if (row.key in _groupInfo.derived.keyToUsers)
                _throwException('Key/loginid already exists', row);
        }
        if (row.key in self.foundKeys)
            _throwException('Duplicate instances of Key/loginid found', row);
        self.foundKeys[row.key] = true;

        var user = _groupInfo.derived.keyToUsers[row.key];
        if (user.usertype <= nlGroupInfo.UT_PADMIN && row.uid != user.userid) 
            _throwException('Cannot change loginid of this user', row);
    }

    function _validateUserType(row) {
        row.ut = nlGroupInfo.getUtStrToInt(row.ut, _grpid);
        if (row.ut ===  null)
            _throwException('Invalid Usertype specified', row);
        var user = _groupInfo.derived.keyToUsers[row.key];
        if (user.usertype <= nlGroupInfo.UT_PADMIN && row.ut != user.usertype) 
            _throwException('Cannot change usertype of this user', row);
        if (user.usertype > nlGroupInfo.UT_PADMIN && row.ut <= nlGroupInfo.UT_PADMIN) 
            _throwException('Cannot promote the user type to primary admin', row);
    }

    function _validateState(row) {
        row.state = (row.state === '1') ? 1 : (row.state === '0') ? 0 : null;
        if (row.state === null)
            _throwException('Invalid state specified', row);
    }

    function _validateNames(row) {
        if (!row.lname) row.lname= '';
        row.fname = _toDisplayName(row.fname);
        row.lname = _toDisplayName(row.lname);
    }

    function _toDisplayName(input) {
        input = input.replace(/[^a-zA-Z0-9_-]/g, function(x) {
            if (x == '.' || x == '(' || x == ')' || x == ' ') return x;
            return ' ';
        });
        return input.trim();
    }

    function _validateEmailAndMobile(row) {
        if(!row.email)
            _throwException('Email is mandatory', row);
        var emailRe = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
        row.email = row.email.trim();

        if(!row.mobile) row.mobile = '';
        row.mobile = row.mobile.replace(/[^0-9]/g, function(x) {
            if (x == '+') return x;
            return '';
        });
        row.mobile = row.mobile.trim();
    }

    function _validateOus(row) {
        row.ou = row.ou.trim();
        if (!(row.ou in _groupInfo.derived.ouDict))
            _throwException(nl.fmt2('Invalid OU: {}', row.ou), row);
        
        if(!row.secOus) row.secOus = '';
        row.secOus = row.secOus.trim();
        if (row.secOus == '') return;
        var secOus = row.secOus.split(',');
        for(var i=0; i<secOus.length; i++) {
            if (!(secOus[i] in _groupInfo.derived.ouDict))
                _throwException(nl.fmt2('Invalid Sec OU: {}', secOus[i]), row);
        }
    }

    function _deleteUnwanted(row) {
        if ('created' in row) delete row.created;
        if ('udpated' in row) delete row.updated;
    }
    
    function _validateDuplicates(row) {
        if (row.ignore || row.op != 'u') return;
        var user = _groupInfo.derived.keyToUsers[row.key];
        row.id = user.id;
        if (user.state != row.state) return;
        if (user.email != row.email) return;
        if (user.usertype != row.ut) return;
        if (user.ou != row.ou) return;
        if (user.secOus != row.secOus) return;
        if (user.fname != row.fname) return;
        if (user.lname != row.lname) return;
        self.pl.imp('Update with no change ignored', angular.toJson(row, 2));
        row.ignore = true;
    }

    function _validateManagers(row) {
        // Manager and Watchers to be validated here
    }
    
    function _updateServer(rows) {
        self.reload = false;
        return nl.q(function(resolve, reject) {
            self.chunkStart = 0;
            _updateChunkToServer(rows, resolve);
        });
    }

    var CHUNK_SIZE = 100;
    function _updateChunkToServer(rows, resolve) {
        self.setProgress('uploadToServer', self.chunkStart, rows.length);
        if (self.chunkStart >= rows.length) {
            self.pl.imp('all updates done');
            resolve();
            return;
        }
        
        var chunkEnd = self.chunkStart + CHUNK_SIZE;
        if (chunkEnd > rows.length) {
            chunkEnd = rows.length;
        }
        var rowsChunk = rows.slice(self.chunkStart, chunkEnd);
        self.pl.imp(nl.fmt2('updating server: row {} (update {} of {})', 
            rows[self.chunkStart].pos, self.chunkStart+1, rows.length));
        nlServerApi.groupUpdateUsers(_groupInfo.id, rowsChunk)
        .then(function(result) {
            self.reload = self.reload || result.reload;
            var statuslist = result.statuslist;
            for(var i=0; i<statuslist.length; i++) {
                var result = statuslist[i];
                var row = rows[self.chunkStart+i];
                if (result.error) {
                    self.pl.warn(nl.fmt2('Updating row {} failed at server', 
                        row.pos), result);
                    self.statusCnts.error++;
                } else {
                    self.pl.debug(nl.fmt2('Updated row {} at the server successfully',
                        row.pos));
                    self.statusCnts.success++;
                }
            }
            self.chunkStart = chunkEnd;
            _updateChunkToServer(rows, resolve);
        }, function(e) {
            self.pl.warn(nl.fmt2('Updating the server chunk {} - {} failed', 
                self.chunkStart, chunkEnd), e);
            self.statusCnts.error += (chunkEnd - self.chunkStart);
            self.chunkStart = chunkEnd;
            _updateChunkToServer(rows, resolve);
        });
    }
}];

module_init();
})();

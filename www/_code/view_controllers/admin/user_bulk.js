(function() {

//-------------------------------------------------------------------------------------------------
// user_bulk.js:
// CSV bulk import/export of user administration data
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.user_bulk', [])
    .service('nlAdminUserExport', AdminUserExportSrv)
    .service('nlAdminUserImport', AdminUserImportSrv);
}

//-------------------------------------------------------------------------------------------------
var _insertMetadataAt = 10;

function _getHeadersWithMetadata(nlGroupInfo, grpid) {
    var headers = angular.copy(nlGroupInfo.getUserTableAttrs());
    var metadata = nlGroupInfo.getUserMetadata(null, grpid);
    for(var i=0; i<metadata.length; i++)
        headers.splice(_insertMetadataAt+i, 0, {id: metadata[i].id, 
            name: metadata[i].name, optional: true, metadata: true});
    return headers;
}

function _getHeaderNameToInfo(headers) {
    var ret = {};
    for(var i=0; i<headers.length; i++) {
        var item = headers[i];
        ret[item.name.toLowerCase()] = item;
        if (!item.oldnames) continue;
        for (var j=0; j<item.oldnames.length; j++)
            ret[item.oldnames[j].toLowerCase()] = item;
    }
    return ret;
};

//-------------------------------------------------------------------------------------------------
var AdminUserExportSrv = ['nl', 'nlDlg', 'nlGroupInfo', 'nlExporter',
function(nl, nlDlg, nlGroupInfo, nlExporter) {
    var _toCsvFns = {
        op: function(user) {
            return 'i';
        },
        gid: function(user, attr, groupInfo) {
            return groupInfo.grpid;
        },
        usertype: function(user) {
            return user.getUtStr();
        },
        created: function(user) {
            return user.created ? nl.fmt.date2UtcStr(user.created) : '';
        },
        updated: function(user) {
            return user.updated ? nl.fmt.date2UtcStr(user.updated) : '';
        },
        doj: function(user) {
            return user.doj ? 'date:' + user.doj : '';
        }
    };
    
    this.exportUsers = function(groupInfo, grpid) {
        return nl.q(function(resolve, reject) {
            nl.timeout(function() {
                _export(groupInfo, grpid, resolve);
            }, 1000);
        });
    };

    var DELIM = '\n';
    function _export(groupInfo, grpid, resolve) {
        var headers = _getHeadersWithMetadata(nlGroupInfo, grpid);
        var csv = nlExporter.getCsvString(headers, 'name');
        for(var key in groupInfo.derived.keyToUsers) {
            var user = groupInfo.derived.keyToUsers[key];
            var md = _getMetadataDict(grpid, user);
            var row = [];
            for(var i=0; i<headers.length; i++) {
                var attr = headers[i];
                var toCsv = _toCsvFns[attr.id] || function(user) {
                    return attr.metadata ? md[attr.id].value : user[attr.id];
                };
                var val = toCsv(user, attr, groupInfo);
                if (val === null || val === undefined) val = '';
                row.push(val);
            }
            csv += DELIM + nlExporter.getCsvString(row);
        }
        nlExporter.exportCsvFile('NittioUserData.csv', csv);
        resolve(true);
    }

    function _getMetadataDict(grpid, user) {
        var metadata = nlGroupInfo.getUserMetadata(user, grpid);
        var ret = {};
        for(var i=0; i<metadata.length; i++)
            ret[metadata[i].id] = metadata[i];
        return ret;
    }
}];

//-------------------------------------------------------------------------------------------------
var AdminUserImportSrv = ['nl', 'nlDlg', 'nlGroupInfo', 'nlImporter', 'nlProgressLog', 'nlRouter',
'nlServerApi',
function(nl, nlDlg, nlGroupInfo, nlImporter, nlProgressLog, nlRouter, nlServerApi) {
    var _fromCsvFns = {
        doj: function(row) {
        	if (!row.doj || row.doj.indexOf('date:') != 0) return '';
            return row.doj.substring(5);
        }
    };
    var self = this;
    var _grpid = null;
    var _groupInfo = null;
    var _userInfo = null;
    var _SERVER_CHUNK_SIZE = 100;
    var _canUpdateLoginId = false;
    
    this.init = function(groupInfo, userInfo, grpid) {
        _groupInfo = groupInfo;
        _userInfo = userInfo;
        _grpid = grpid;
        var params = nl.location.search();
        _canUpdateLoginId = 'debug' in params && nlRouter.isPermitted(_userInfo, 'nittio_support');
    };

    this.importUsers = function($scope, chunkSize, debugLog) {
        if (chunkSize) _SERVER_CHUNK_SIZE = chunkSize;
        return nl.q(function(resolve, reject) {
            if (self.resolve) {
                reject('Import operation is ongoing');
                return;
            }
            self.resolve = resolve;
            _import($scope, debugLog);
        });
    };
    
    function _onImportDone() {
        self.pl = null;
        self.dlg = null;

        self.resolve();
        self.resolve = null;
        return true;
    }

    function _import($scope, debugLog) {
        var dlg = nlDlg.create($scope);
        self.dlg = dlg;
        dlg.setCssClass('nl-height-max nl-width-max');
        dlg.scope.error = {};
        dlg.scope.started = false;
        dlg.scope.running = false;
        dlg.scope.data = {filelist: [], validateOnly: true, createMissingOus: false};
        dlg.scope.onImport = function(e) {
            _progressLevels = dlg.scope.data.validateOnly ? _progressLevelsValidateOnly : _progressLevelsFull;
            _onImport(e, dlg.scope);
        };
        self.pl = nlProgressLog.create(dlg.scope);
        self.pl.showLogDetails(true);
        if (!debugLog) self.pl.hideDebugAndInfoLogs();
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
        dlg.show('view_controllers/admin/user_import_dlg.html', [], cancelButton, false);
    }

    this.initImportOperation = function() {
        self.statusCnts = {total: 0, ignore: 0, process: 0, success: 0, error: 0};
        self.foundKeys = {};
        self.showRowNumber = false;
        self.missingOus = {};
    };
    
    function _onImport(e, dlgScope) {
        self.initImportOperation();
        if (e) e.preventDefault();
        if (dlgScope.data.filelist.length == 0) {
            dlgScope.error.filelist = 'Please select the CSV file';
            return;
        }
        
        self.showRowNumber = true;

        self.setProgress('start');
        dlgScope.started = true;
        dlgScope.running = true;
        var csvFile = dlgScope.data.filelist[0].resource;
        self.pl.imp('Import started: ' + csvFile.name);
        nlImporter.readCsv(csvFile).then(function(result) {
            if (result.error)
                _throwException(nl.fmt2('Error parsing CSV file. {}', result.error));
            self.pl.imp('Read successful', angular.toJson(result, 2));
            self.setProgress('fileRead');
            var table = result.table;
            _processCsvFile(table).then(function(rows) {
                self.setProgress('processCsv');
                var missingCnt = Object.keys(self.missingOus).length;
                if (missingCnt == 0) {
                    self.pl.imp(nl.fmt2('Processing CSV file successful - {} changes found',
                    	self.statusCnts.process), angular.toJson(rows, 2));
                } else if (dlgScope.data.createMissingOus) {
                    self.pl.imp(nl.fmt2('{} ou(s) are not present in tree - these will be added to the tree before updating user information.', missingCnt), self.missingOus);
                } else {
                    self.pl.error(nl.fmt2('{} ou(s) are not present in tree. You may enable the option to create missing organization units.', missingCnt), self.missingOus);
                }
                if (dlgScope.data.validateOnly) {
                    _done(true);
                    return;
                }
                self.updateServer(rows, dlgScope.data.createMissingOus);
            }, function(e) {
                _error(e);
            });
        }, function(e) {
            _error(nl.t('Error reading CSV file: {}', e));
        });
    }

    function _throwException(message, obj) {
        if (self.showRowNumber && obj && obj.pos) message = nl.fmt2('Row {}: {}', obj.pos, message);
        throw({message: message, obj: obj});
    }
    
    function _error(e) {
        self.setProgress('done');
        var msg = e && e.message ? e.message : 'Error encountered during import';
        var data = e && e.obj ? e.obj : self.statusCnts;
        if(self.pl) self.pl.imp('Status counts', angular.toJson(self.statusCnts, 2));
        if(self.pl) self.pl.error(msg, angular.toJson(data, 2));
        if(self.dlg) self.dlg.scope.running = false;
    }
    
    function _doneImpl(validateOnly) {
        self.setProgress('done');
        self.reload = false;
        var msg = '';
        if (validateOnly) {
        	msg = nl.fmt2('Validation done - {} of {} records to be sent to server', 
                        self.statusCnts.process, self.statusCnts.total);
		} else {
	        msg = self.statusCnts.error > 0 ? 'Import done with errors: ' : 'Import successful: ';
	        msg = nl.fmt2('{}total:{}, records sent to server: {}, success: {}, error: {}', msg,
	        	self.statusCnts.total, self.statusCnts.process,  self.statusCnts.success, 
	        	self.statusCnts.error);
		}
        if (self.statusCnts.error > 0) {
            if(self.pl) self.pl.error(msg, angular.toJson(self.statusCnts, 2));
        } else {
            if(self.pl) self.pl.imp(msg, angular.toJson(self.statusCnts, 2));
		}
        if(self.dlg) self.dlg.scope.running = false;
    }
    
    function _done(validateOnly) {
        return nl.q(function(resolve, reject) {
            if (!self.reload) {
                _doneImpl(validateOnly);
                resolve();
                return;
            }
            nlGroupInfo.init(true, _grpid).then(function() {
                nlGroupInfo.update(_grpid);
                _groupInfo = nlGroupInfo.get(_grpid);
                _doneImpl(validateOnly);
                resolve();
            });
        });
    }
    
    var _progressLevelsFull = {
        start: [0, 0],
        fileRead: [0, 2],
        processCsv: [2, 20],
        uploadToServer: [20, 99],
        done: [99, 100]
    };
    
    var _progressLevelsValidateOnly = {
        start: [0, 0],
        fileRead: [0, 2],
        processCsv: [2, 99],
        uploadToServer: [99, 99],
        done: [99, 100]
    };

    var _progressLevels = null;

    this.setProgress = function(currentAction, doneSubItems, maxSubItems) {
        if (!self.pl) return;
        if (doneSubItems !== 0 && !doneSubItems) doneSubItems = 1;
        if (!maxSubItems) maxSubItems = 1;
        var levels = _progressLevels[currentAction];
        var p = levels[0] + (doneSubItems/maxSubItems)*(levels[1] - levels[0]);
        self.pl.progress(p);
    };

    function _processCsvFile(table) {
        return nl.q(function(resolve, reject) {
            nl.timeout(function() {
                try {
                    var headerInfo = _getHeaders(table);
                    self.pl.debug('Header row processsed', angular.toJson(headerInfo, 2));
                    var data = [];
                    _processCsvRowsT(table, headerInfo, 1, data, resolve, reject);
                } catch (e) {
                    reject(e);
                }
            }, 0);
        });
    }
    
    function _processCsvRowsT(table, headerInfo, start, data, resolve, reject) {
        nl.timeout(function() {
            try {
                _processCsvRows(table, headerInfo, start, data, resolve, reject);
            } catch (e) {
                reject(e);
            }
        }, 0);
    }

    var PROCESS_CHUNK_SIZE = 487; // Some prime number instead of a round number
    function _processCsvRows(table, headerInfo, start, data, resolve, reject) {
        var doneCnt = start >= table.length ? table.length : start+1;
        if (self.pl) self.pl.imp(nl.fmt2('{} of {} rows processed', doneCnt, table.length));
        self.setProgress('processCsv', start, table.length+1);
        if (start >= table.length) {
            resolve(data);
            return;
        }
        var end = start+PROCESS_CHUNK_SIZE;
        if (end > table.length) end = table.length;
        for (var i=start; i<end; i++) {
            var row = table[i];
            self.statusCnts.total++;
            if (self.pl) self.pl.debug(nl.fmt2('Validating row {} of {}', i+1, table.length), angular.toJson(row, 2));
            row = _getRowObj(row, headerInfo, i);
            if (row == null) {
                self.statusCnts.ignore++;
                if (self.pl) self.pl.debug('Validated row - ignoring');
            } else {
                self.statusCnts.process++;
                if (self.pl) self.pl.debug('Validated row', angular.toJson(row, 2));
                data.push(row);
            }
        }
        _processCsvRowsT(table, headerInfo, end, data, resolve, reject);
    }
    
    function _getHeaders(table) {
        if (table.length == 0)
            _throwException('Header row not found'); 
        var row = table[0];
        var ret = [];
        var found = {};
        var headers = _getHeadersWithMetadata(nlGroupInfo, _grpid);
        var headerNameToInfo = _getHeaderNameToInfo(headers);
        for(var i=0; i<row.length; i++) {
            var col = row[i].toLowerCase().trim();
            if (!(col in headerNameToInfo))
                _throwException(nl.fmt2('Unknown header: {}', col)); 
            var info = headerNameToInfo[col];
            if (info.id in found)
                _throwException(nl.fmt2('Header repeated: {}', col));
            found[info.id] = true;
            ret.push(info);
        }
        
        // Check if all mandatory headers are present
        for(var i=0; i<headers.length; i++) {
            var info = headers[i];
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
        for(var i=0; i<headerInfo.length; i++) {
            if (headerInfo[i].id in ret) continue;
            if (!headerInfo[i].optional && ret[i] === '')
                _throwException(nl.fmt2('Mandatory field {} missing in row {}', headerInfo[i].name, i)); 
        }
        _updateColumnValues(ret, headerInfo);
        _updateMetadataAttr(ret, headerInfo);
        _validateRow(ret, headerInfo);
        if (ret.ignore) return null;
        return ret;
    }

    function _updateColumnValues(row, headerInfo) {
        for(var i=0; i<headerInfo.length; i++) {
            var h = headerInfo[i];
            if (h.id in _fromCsvFns) row[h.id] = _fromCsvFns[h.id](row);
        }
    }
    
    function _updateMetadataAttr(row, headerInfo) {
        var mdValues = {};
        for(var i=0; i<headerInfo.length; i++) {
            var h = headerInfo[i];
            if (!h.metadata) continue;
            if (row[h.id] !== '') mdValues[h.id] = row[h.id];
            delete row[h.id];
        }
        row.metadata = angular.toJson(mdValues);
    }
    
    function _validateRow(row, headerInfo) {
        self.validateOp(row);
        self.validateGroup(row);
        self.validateKeyColumns(row);
        self.validateUserType(row);
        self.validateState(row);
        self.validateNames(row);
        self.validateEmail(row);
        self.validateMobile(row);
        self.validateOu(row);
        self.validateSecOu(row);
        self.validateManagers(row);
        self.deleteUnwanted(row);
        self.validateRealChange(row);
    }

    var _validOps = {'c': true, 'C': true, 'u': true, 'U': true, 'd': true, 'e': true, 'E': true, 'i': true};
    this.validateOp = function(row) {
        if (!(row.op in _validOps))
            _throwException('Invalid operation specified', row);
        if (row.op == 'd' && !nlRouter.isPermitted(_userInfo, 'admin_group'))
            _throwException('Modify with state=1 instead of delete', row);
        if (row.op == 'i') row.ignore = true;
    };
    
    this.validateGroup = function(row) {
        if (!row.gid) row.gid = _groupInfo.grpid;
        row.gid = row.gid.toLowerCase().trim();
        if (nlRouter.isPermitted(_userInfo, 'admin_group')) return;

        if (row.gid != _groupInfo.grpid)
            _throwException('Group id not allowed', row);
    };
    
    this.validateKeyColumns = function(row) {
        row.user_id = _toIdName(row.user_id || '');
        if (row.user_id == '')
            _throwException('User id is mandatory and can have only characters from a-z or 0-9 or special character _ or -.', row);
        if (!row.username) row.username = row.user_id + '.' + row.gid;
        row.username = row.username.toLowerCase().trim();
        
        if (row.op != 'i' && row.op != 'c' && row.op != 'C') {
            if (!(row.username in _groupInfo.derived.keyToUsers))
                _throwException('User id not found', row);
        } else if (row.op == 'c' || row.op == 'C') {
	        var newUserName = row.user_id + '.' + row.gid;
	        if (newUserName != row.username)
	            _throwException('User id and username mis match. Please have same username and user id', row);
            if (row.username in _groupInfo.derived.keyToUsers)
                _throwException('User id already exists', row);
        }
        if (row.op == 'u' || row.op == 'U') {
            var newUserName = row.user_id + '.' + row.gid;
            if (newUserName != row.username &&
                newUserName in _groupInfo.derived.keyToUsers) {
                _throwException('User id already exists', row);
            }
        }
        
        if (row.username in self.foundKeys)
            _throwException('Duplicate instances of Key/loginid found', row);
        self.foundKeys[row.username] = true;

        var user = _groupInfo.derived.keyToUsers[row.username];
        if (user && user.usertype <= nlGroupInfo.UT_PADMIN && row.user_id != user.user_id) 
            _throwException('Cannot change loginid of this user', row);
        if (!_canUpdateLoginId && user && row.user_id != user.user_id)
            _throwException('Cannot change loginid of a user', row);
    };

    this.validateUserType = function(row) {
        row.usertype = nlGroupInfo.getUtStrToInt(row.usertype, _grpid);
        if (row.usertype ===  null)
            _throwException('Invalid Usertype specified', row);
        var user = _groupInfo.derived.keyToUsers[row.username];
        if (user) {
            if (user.usertype <= nlGroupInfo.UT_PADMIN && row.usertype != user.usertype) 
                _throwException('Cannot change usertype of this user', row);
            if (user.usertype > nlGroupInfo.UT_PADMIN && row.usertype <= nlGroupInfo.UT_PADMIN) 
                _throwException('Cannot promote the user type to primary admin', row);
        } else {
            if (row.usertype <= nlGroupInfo.UT_PADMIN) 
                _throwException('Cannot create users of this type', row);
        }
    };

    this.validateState = function(row) {
        row.state = parseInt(row.state);
        var user = _groupInfo.derived.keyToUsers[row.username];
        if (row.state != 0 && row.state != 1)
            _throwException('Invalid state specified', row);
        if (user && user.usertype <= nlGroupInfo.UT_PADMIN && row.state == 0) 
            _throwException('Admin or primary admin cannot be deactivated', row);
    };

    this.validateNames = function(row) {
        if (!row.last_name) row.last_name= '';
        row.first_name = _toDisplayName(row.first_name);
        row.last_name = _toDisplayName(row.last_name);
        if (row.first_name == '')
            _throwException('First name is mandatory and can have only characters from a-z or A-Z or 0-9 or special character from set _ - . ( or ). Cannot start with space.', row);
    };

    function _toIdName(input) {
        input = input.toLowerCase();
        input = input.replace(/[^a-z0-9_-]/g, function(x) {
            return '';
        });
        return input;
    }

    function _toDisplayName(input) {
        input = input.replace(/[^a-zA-Z0-9_-]/g, function(x) {
            if (x == '.' || x == '(' || x == ')' || x == ' ') return x;
            return ' ';
        });
        return input.trim();
    }

    var EMAIL_REGEX = new RegExp("[^@]+@[^@]+");
    this.validateEmail = function(row) {
        if(!row.email)
            _throwException('Properly formed email address is mandatory', row);
        row.email = row.email.trim();
        if (row.email == 'NA' || EMAIL_REGEX.test(row.email)) return;
        _throwException('Properly formed email address is mandatory', row);
    };

    this.validateMobile = function(row) {
        if(!row.mobile) row.mobile = '';
        row.mobile = row.mobile.replace(/[^0-9]/g, function(x) {
            if (x == '+') return x;
            return '';
        });
        row.mobile = row.mobile.trim();
    };
    
    function _checkOu(ou, row) {
        if (ou in _groupInfo.derived.ouDict) return;
        var msg = nl.fmt2('OU not present in tree: {}', ou);
        if (ou in self.missingOus) {
            self.pl.debug(msg, row);
            self.missingOus[ou]++;
        } else {
            self.pl.warn(msg, row);
            self.missingOus[ou] = 1;
        }
    }

    this.validateOu = function(row) {
        row.org_unit = row.org_unit.trim();
        if (!(row.org_unit))
            _throwException('OU is mandatory', row);
        _checkOu(row.org_unit, row);
    };
        
    this.validateSecOu = function(row) {
        if(!row.sec_ou_list) row.sec_ou_list = '';
        row.sec_ou_list = row.sec_ou_list.trim();
        if (row.sec_ou_list == '') return;
        var sec_ou_list = row.sec_ou_list.split(',');
        for(var i=0; i<sec_ou_list.length; i++) {
            _checkOu(sec_ou_list[i], row);
        }
    };

    this.deleteUnwanted = function(row) {
        if ('created' in row) delete row.created;
        if ('udpated' in row) delete row.updated;
    };
    
    this.validateRealChange = function(row) {
        if (row.ignore || row.op != 'u') return;
        var user = _groupInfo.derived.keyToUsers[row.username];
        row.id = user.id;
        if (user.user_id != row.user_id) return;
        if (user.state != row.state) return;
        if (user.email != row.email) return;
        if (user.usertype != row.usertype) return;
        if (user.org_unit != row.org_unit) return;
        if (user.sec_ou_list != row.sec_ou_list) return;
        if (user.supervisor != row.supervisor) return;
        if (user.doj != row.doj) return;
        if (user.first_name != row.first_name) return;
        if (user.last_name != row.last_name) return;
        if (user.metadata != row.metadata) return;
        if (self.pl) {
            self.pl.imp('Update with no change ignored', angular.toJson(row, 2));
        }
        row.ignore = true;
    };

    this.validateManagers = function(row) {
        if(!row.supervisor) row.supervisor = '';
        /*
        if(row.supervisor) {
	        var username = row.supervisor + '.' + row.gid;
	        username = username.toLowerCase().trim();
	        if (!(username in _groupInfo.derived.keyToUsers) && !(username in self.foundKeys))
	            _throwException('Supervisor is not defined', row);
        }
        */
    };
    
    this.validateDoj = function(row) {
        if(!row.doj) row.doj = '';
    };

    this.updateServer = function(rows, createMissingOus) {
        self.reload = false;
        self.chunkStart = 0;
        return nl.q(function(resolve, reject) {
            _updateServerImpl(rows, createMissingOus).then(function() {
                _done().then(function() {
                    resolve(self.statusCnts.error);
                });
            });
        });
    };

    function _updateServerImpl(rows, createMissingOus) {
        return nl.q(function(resolve, reject) {
            if (Object.keys(self.missingOus).length == 0) {
                _updateChunkToServer(rows, resolve);
                return;
            }
            if (!createMissingOus) {
                self.statusCnts.error += rows.length;
                resolve();
                return;
            }
            _updateOuTree().then(function(ret) {
                self.reload = true;
                _updateChunkToServer(rows, resolve);
            }, function(e) {
                if (self.pl) self.pl.error('Updating ouTree failed', e);
                self.statusCnts.error += rows.length;
                resolve();
            });
        });
    }

    function _updateOuTree() {
        var missingOus = [];
        for (var ou in self.missingOus) missingOus.push(ou);
        missingOus.sort();
        return nlServerApi.groupUpdateOrgTree(_groupInfo.id, missingOus);
    }
    
    function _updateChunkToServer(rows, resolve) {
        self.setProgress('uploadToServer', self.chunkStart, rows.length);
        if (self.chunkStart >= rows.length) {
            if (self.pl) self.pl.imp('all updates done');
            resolve();
            return;
        }
        
        var chunkEnd = self.chunkStart + _SERVER_CHUNK_SIZE;
        if (chunkEnd > rows.length) {
            chunkEnd = rows.length;
        }
        var rowsChunk = rows.slice(self.chunkStart, chunkEnd);
        if (self.pl) self.pl.imp(nl.fmt2('updating server: row {} (update {} of {})', 
            rows[self.chunkStart].pos, self.chunkStart+1, rows.length));
        nlServerApi.groupUpdateUsers(_groupInfo.id, rowsChunk)
        .then(function(result) {
            self.reload = self.reload || result.reload;
            var statuslist = result.statuslist;
            var processed = rowsChunk.length;
            if (self.pl) self.pl.imp(nl.fmt2('Processed {} of {} at server', 
                processed, rowsChunk.length));

            for(var i=0; i<statuslist.length; i++) {
                var statusitem = statuslist[i];
                var row = rows[self.chunkStart+i];
                if (statusitem.status == 'error') {
                    if (self.pl) self.pl.warn(nl.fmt2('Updating row {} failed at server: {}', 
                        row.pos, statusitem.message));
                    self.statusCnts.error++;
                } else {
                    if (self.pl) self.pl.debug(nl.fmt2('Updated row {} at the server successfully',
                        row.pos));
                    self.statusCnts.success++;
                }
            }
            self.chunkStart += processed;
            _updateChunkToServer(rows, resolve);
        }, function(e) {
            if (self.pl) self.pl.warn(nl.fmt2('Updating the server chunk {} - {} failed', 
                self.chunkStart, chunkEnd), e);
            self.statusCnts.error += (chunkEnd - self.chunkStart);
            self.chunkStart = chunkEnd;
            _updateChunkToServer(rows, resolve);
        });
    }
}];

module_init();
})();

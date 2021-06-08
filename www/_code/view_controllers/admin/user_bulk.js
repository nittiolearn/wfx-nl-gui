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
        },
        id: function(user) {
            return 'id=' + user.id;
        },
        last_login_time: function(user) {
            var details = angular.fromJson(user.details || "{}");
            if (details && details.last_login_time) {
                var lastLogin = details.last_login_time || '';
                return nl.fmt.date2Str(nl.fmt.json2Date(lastLogin), 'date');
            }
            return '';
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
    var NUM_REG = new RegExp("^[0-9]+$");
    function _export(groupInfo, grpid, resolve) {
        var headers = nlGroupInfo.getUserTableHeaders(grpid);
        var csv = nlExporter.getCsvString(headers, 'name');
        var usersDict = nlGroupInfo.getKeyToUsers(groupInfo, grpid);
        for(var key in usersDict) {
            var user = usersDict[key];
            var md = _getMetadataDict(grpid, user);
            var row = [];
            for(var i=0; i<headers.length; i++) {
                var attr = headers[i];
                var toCsv = _toCsvFns[attr.id] || function(user) {
                    return attr.metadata ? md[attr.id].value : user[attr.id];
                };
                var val = toCsv(user, attr, groupInfo);
                if (val === null || val === undefined) val = '';
                val = '' + val;
                if (val && NUM_REG.test(val) && val.length > 10) val = 'id='+val; //add id= while exporting user list
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
    var _pastUserInfosFetcher = nlGroupInfo.getPastUserInfosFetcher();
    var _ouDict = {};
    var _secloginDict = {};
    var _renamedUserIds = {};
    this.init = function(groupInfo, userInfo, grpid) {
        _ouDict = {};
        _groupInfo = groupInfo;
        _userInfo = userInfo;
        _grpid = grpid;
        _canUpdateLoginId = nlRouter.isPermitted(_userInfo, 'admin_user');
        _pastUserInfosFetcher.init(_groupInfo, true);
        _updateOuDict();
        _updateSecLoginDict();
        return _pastUserInfosFetcher.fetchAllPastUsersFiles(true).then(function() {   
            return _pastUserInfosFetcher.isArchivedUserExist();
        });
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

    function _updateOuDict() {
        var ouDict = _groupInfo.derived.ouDict;
        for(var key in ouDict) {
            var origou = key;
            var ou = key;
            if (ou.indexOf('.') > 0) {
                var ouarray = ou.split('.');
                for(var i=0; i<ouarray.length; i++) ouarray[i] = ouarray[i].toLowerCase().trim();
                ou = ouarray.join('.');
            } else {
                ou = ou.toLowerCase().trim();
            }
            if (ou in _ouDict) continue;
            _ouDict[ou] = origou;
        }
    }

    this.resetSecLoginDict = function() {
        _updateSecLoginDict();
    };

    function _updateSecLoginDict() {
        _secloginDict = {};
        _renamedUserIds = {};
        var columnMap = _groupInfo.column_mapping || [];
        var secPos = null;
        for (var i=0; i<columnMap.length; i++) {
            if (columnMap[i] == 'seclogin') secPos = i;
        }
        var users = _groupInfo.users || {};
        for (var key in users) {
            var userRow = users[key];
            var secloginid = userRow[secPos];
            if (secloginid in _secloginDict || !secloginid) continue;
            if (secloginid.indexOf('id:') == 0) secloginid = secloginid.replace('id=', '');
            _secloginDict[secloginid] = userRow[0];
        }
    }
    
    this.initImportOperation = function() {
        self.statusCnts = {total: 0, ignore: 0, process: 0, success: 0, error: 0};
        self.foundKeys = {};
        self.showRowNumber = false;
        self.missingOus = {};
    };

    var lstUidChanges = [];        // [{oldUserId, newUserId},...] when user_id is modified
    function _onImport(e, dlgScope) {
        self.initImportOperation();
        if (e) e.preventDefault();
        if (dlgScope.data.filelist.length == 0) {
            var fieldReferToOpenFileExplorer = dlgScope.data.fieldrefer.elem;
            fieldReferToOpenFileExplorer.triggerHandler('click');
            return;
        }
        
        self.showRowNumber = true;

        self.setProgress('start');
        dlgScope.started = true;
        dlgScope.running = true;
        var csvFile = dlgScope.data.filelist[0].resource;
        self.pl.imp('Import started: ' + csvFile.name);
        nlImporter.readCsv(csvFile).then(function(result) {
            try {
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
                    _updateServerAfterConfirmIfNeeded(false, rows, dlgScope.data.createMissingOus);
                }, function(e) {
                    dlgScope.data.filelist = [];
                    _error(e);
                });
            } catch (e) {
                dlgScope.data.filelist = [];
                _error(e);
            }
        }, function(e) {
            dlgScope.data.filelist = [];
            _error(nl.t('Error reading CSV file: {}', e));
        });
    }

    function _throwException(message, obj) {
        if (self.showRowNumber && obj && obj.pos) message = nl.fmt2('Row {}: {}. Please correct the issue and reattach the file.', obj.pos, message);
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
            nlGroupInfo.init3(_grpid).then(function() {
                nlGroupInfo.update(_grpid);
                _groupInfo = nlGroupInfo.get(_grpid);
                if (!validateOnly) {
                    _ouDict = {};
                    _updateOuDict();
                }
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
                    lstUidChanges = [];
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
        var csvHeader = table[0];
        for (var i=start; i<end; i++) {
            var row = table[i];
            self.statusCnts.total++;
            if(row[0] == 'i') { 
                self.statusCnts.ignore++;
                continue;
            }
            if (self.pl) self.pl.debug(nl.fmt2('Validating row {} of {}', i+1, table.length), angular.toJson(row, 2));
            row = _getRowObj(row, headerInfo, i, csvHeader);
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
        var headers = nlGroupInfo.getUserTableHeaders(_grpid);
        var headerNameToInfo = _getHeaderNameToInfo(headers);
        for(var i=0; i<row.length; i++) {
            var col = row[i].toLowerCase().trim();
            if (!col) continue;
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

    function _getRowObj(row, headerInfo, pos, csvHeader) {
        var ret = {pos: pos+1};
        for(var i=0; i<row.length; i++) {
            if (i>headerInfo.length-1) break;
            var colInfo = headerInfo[i];
            if (row[i] && !csvHeader[i]) _throwException(nl.fmt2('Header missing for item "{}" in row {}', row[i], ret.pos));
            if (row[i].indexOf('id=') === 0) row[i] = row[i].replace('id=', '') //Remove id= while importing user data
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
        _formatUserName(row);
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
        self.validateSeclogin(row);
    }

    function _formatUserName(row) {
        var username = row.username || '';
        if(!username) return;
            username = username.split('.');
        var partsArray = []
        for (var i=0; i<username.length; i++) partsArray.push(username[i].trim());
        row.username = partsArray.join('.');
    }

    var _validOps = {'c': true, 'C': true, 'u': true, 'U': true, 'd': true, 'e': true, 'E': true, 'i': true};
    this.validateOp = function(row) {
        if (!(row.op in _validOps))
            _throwException('Invalid operation specified', row);
        if (row.op == 'd' && !nlRouter.isPermitted(_userInfo, 'admin_group'))
            _throwException('Deactivate the user instead of deleting', row);
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
        
        var usersDict = nlGroupInfo.getKeyToUsers(_groupInfo, _grpid);
        if (row.op != 'i' && row.op != 'c' && row.op != 'C') {
            if (!(row.username in usersDict))
                _throwException('User id not found', row);
        } else if (row.op == 'c' || row.op == 'C') {
	        var newUserName = row.user_id + '.' + row.gid;
	        if (newUserName != row.username)
	            _throwException('User id and username mis match. Please have same username and user id', row);
            if (row.username in usersDict)
                _throwException('User id already exists', row);
            if (_pastUserInfosFetcher.getUserObj(null, row.user_id))
                _throwException('User id already exists in archived list', row);
        }
        if (row.op == 'u' || row.op == 'U') {
            var newUserName = row.user_id + '.' + row.gid;
            if (newUserName != row.username) {
                if (newUserName in usersDict)
                    _throwException('User id already exists', row);
                if (_pastUserInfosFetcher.getUserObj(null, row.user_id))
                    _throwException('User id already exists in archived list', row);
                if (newUserName in _renamedUserIds) {
                    _throwException('User id already exists', row);
                }
                _renamedUserIds[newUserName] = true;
            }
        }
        
        if (row.username in self.foundKeys)
            _throwException('Duplicate instances of Key/loginid found', row);
        self.foundKeys[row.username] = true;

        var user = usersDict[row.username];

        if(user && row.user_id != user.user_id) {
            var newUserId = row.user_id;
            var oldUserId = user.user_id;
            lstUidChanges.push({newUserId:newUserId, oldUserId:oldUserId});
        }
        if (user && user.usertype <= nlGroupInfo.UT_PADMIN && row.user_id != user.user_id) 
            _throwException('Cannot change loginid of this user', row);
        if (!_canUpdateLoginId && user && row.user_id != user.user_id)
            _throwException('Cannot change loginid of a user', row);
    };

    this.validateUserType = function(row) {
        row.usertype = nlGroupInfo.getUtStrToInt(row.usertype, _grpid);
        if (row.usertype ===  null)
            _throwException('Invalid Usertype specified', row);
        var user = nlGroupInfo.getKeyToUsers(_groupInfo, _grpid)[row.username];
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
        var user = nlGroupInfo.getKeyToUsers(_groupInfo, _grpid)[row.username];
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

    var MOBILE_REGEX = /^[0-9]+$/;
    this.validateMobile = function(row) {
        if(!row.mobile) row.mobile = '';
        if (!row.mobile) return;
        row.mobile = row.mobile.replace(/\s/g, '');
        row.mobile = row.mobile.replace(/\+/g, '');
        row.mobile = row.mobile.indexOf('m:') === 0 ? row.mobile.replace('m:', '') : row.mobile;
        if (row.mobile.length == 10) row.mobile = '91' + row.mobile;
        if(!MOBILE_REGEX.test(row.mobile) || row.mobile.length != 12) _throwException('Mobile number expected in format "m:919988766554"', row);
    };

    var SECLOGIN_REGEX = /^[a-z0-9_-]+$/;
    this.validateSeclogin = function(row) {
        if (!row.seclogin) row.seclogin= '';
        if (!row.seclogin) return;
        row.seclogin = row.seclogin.replace(/\s/g, '');
        row.seclogin = row.seclogin.toLowerCase();
        row.seclogin = row.seclogin.indexOf('id:') === 0 ? row.seclogin.replace('id:', '') : row.seclogin;
        if(!SECLOGIN_REGEX.test(row.seclogin))
            _throwException('Secondary login can have only characters from a-z, 0-9, _, -. ( optional: It can start with id:) ', row);
        if (row.seclogin in _secloginDict && _secloginDict[row.seclogin] != row.username)
            _throwException('Secondary login should be unique and cannot be repeated, -. ( optional: It can start with id:) ', row);
        if (!(row.seclogin in _secloginDict)) _secloginDict[row.seclogin] = row.username;
    };
    
    function _checkOu(ou, row) {
        var actualOU = ou;
        if (ou.indexOf('.') > 0) {
            var ouarray = ou.split('.');
            for(var i=0; i<ouarray.length; i++) ouarray[i] = ouarray[i].toLowerCase().trim();
            ou = ouarray.join('.');
        } else {
            ou = ou.toLowerCase().trim();
        }
        if (ou in _ouDict) return {isFound: true, ou: ou};
        if (actualOU.indexOf('.') > 0) {
            var ouarray = actualOU.split('.');
            for(var i=0; i<ouarray.length; i++) ouarray[i] = ouarray[i].trim();
            actualOU = ouarray.join('.');
        } else {
            actualOU = actualOU.trim();
        }
        ou = actualOU;
        var msg = nl.fmt2('OU not present in tree: {}', ou);
        if (ou in self.missingOus) {
            self.pl.debug(msg, row);
            self.missingOus[ou]++;
        } else {
            self.pl.warn(msg, row);
            self.missingOus[ou] = 1;
        }
        return {isFound: false}
    }

    this.validateOu = function(row) {
        row.org_unit = row.org_unit.trim();
        if (!(row.org_unit))
            _throwException('OU is mandatory', row);
        var oufound = _checkOu(row.org_unit, row);
        if (oufound.isFound) {
            row.org_unit = _ouDict[oufound.ou];
        } else {
            var actualOU = row.org_unit;
            if (actualOU.indexOf('.') > 0) {
                var ouarray = actualOU.split('.');
                for(var i=0; i<ouarray.length; i++) ouarray[i] = ouarray[i].trim();
                actualOU = ouarray.join('.');
            }
            row.org_unit = actualOU;
        }
    };
        
    this.validateSecOu = function(row) {
        if(!row.sec_ou_list) row.sec_ou_list = '';
        row.sec_ou_list = row.sec_ou_list.trim();
        if (row.sec_ou_list == '') return;
        var sec_ou_list = row.sec_ou_list.split(',');
        var array = [];
        for(var i=0; i<sec_ou_list.length; i++) {            
            var oufound = _checkOu(sec_ou_list[i], row);
            if (oufound.isFound) {
                array.push(_ouDict[oufound.ou]);
            } else {
                var actualOU = sec_ou_list[i];
                if (actualOU.indexOf('.') > 0) {
                    var ouarray = actualOU.split('.');
                    for(var i=0; i<ouarray.length; i++) ouarray[i] = ouarray[i].trim();
                    actualOU = ouarray.join('.');
                } else {
                    actualOU = actualOU.trim();
                }
                array.push(actualOU);
            }
        }
        row.sec_ou_list = array.join(',');
    };

    this.deleteUnwanted = function(row) {
        if ('created' in row) delete row.created;
        if ('udpated' in row) delete row.updated;
    };
    
    this.validateRealChange = function(row) {
        if (row.ignore || row.op != 'u') return;
        var user = nlGroupInfo.getKeyToUsers(_groupInfo, _grpid)[row.username];
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
        if (user.mobile != row.mobile) return;
        if (user.seclogin != row.seclogin) return;
        if (self.pl) {
            self.pl.imp('Update with no change ignored', angular.toJson(row, 2));
        }
        row.ignore = true;
    };

    this.validateManagers = function(row) {
        if(!row.supervisor) row.supervisor = '';
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

    this.updateServerAfterConfirmIfNeeded = _updateServerAfterConfirmIfNeeded;
    function _updateServerAfterConfirmIfNeeded(lstUidChangeFromGui, rows, createMissingOus) {
        var _parentScope = nl.rootScope;
        if (lstUidChangeFromGui) lstUidChanges = lstUidChangeFromGui;
        if (lstUidChanges.length == 0) {
            return self.updateServer(rows, lstUidChangeFromGui.length ? false : createMissingOus)
        }

        return nl.q(function(resolve, reject) {
            var userIdDlg = nlDlg.create(_parentScope);
            userIdDlg.scope.error = {};
            userIdDlg.scope.dlgTitle = nl.t('Modifying login user ids?');
            userIdDlg.scope.lstUidChanges = lstUidChanges;
            userIdDlg.scope.data = {};
            userIdDlg.scope.data.error = {};
            userIdDlg.scope.data.confirmModification = '';

            var confirmBtnClick = false;
            var confirmButton = {text : nl.t('Confirm'), onTap : function(e) {
                if (userIdDlg.scope.data.confirmModification.toLowerCase().trim() != 'confirm') {
                    if(e) e.preventDefault(e);
                    nlDlg.setFieldError(userIdDlg.scope, 'confirmModification', nl.t('Please write "confirm" to proceed'));
                    return;
                }
                confirmBtnClick = true;
                if (lstUidChangeFromGui.length) nlDlg.showLoadingScreen();
                self.updateServer(rows, lstUidChangeFromGui.length ? false : createMissingOus)
                .then(function(errorCnt) {
                    resolve(errorCnt);
                });
            }};
            var closeButton = {text : nl.t('Cancel'), onTap : function(e) {
                if(confirmBtnClick || lstUidChangeFromGui) return resolve(0);
                self.setProgress('done');
                self.reload = false;
                var mesg = nl.fmt2('Modifications are denied', self.statusCnts.process, self.statusCnts.total);
                self.pl.imp(mesg, angular.toJson(self.statusCnts, 2));
                if(self.dlg) self.dlg.scope.running = false;
                return resolve(0);
            }};
            userIdDlg.show('view_controllers/admin/user_id_dlg.html', [confirmButton], closeButton);
        });
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

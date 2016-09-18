(function() {

//-------------------------------------------------------------------------------------------------
// rno.js:
// rno - Rating and observation module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.rno', ['nl.rno_stats'])
	.config(configFn)
    .controller('nl.RnoListCtrl', RnoListCtrl)
    .controller('nl.RnoParentViewCtrl', RnoParentViewCtrl)
    .controller('nl.RnoStatsCtrl', RnoStatsCtrl)
    .directive('nlRnoMstree', _simpleElemDirective('rno_mstree.html'))
    .directive('nlRnoMstreeView', _simpleElemDirective('rno_mstree_view.html'));
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.rno_list', {
		url: '^/rno_list',
		views: {
			'appContent': {
				templateUrl: 'view_controllers/rno/rno_report_manage.html',
				controller: 'nl.RnoListCtrl'
			}
		}});

    $stateProvider.state('app.rno_view', {
        url: '^/rno_view',
        views: {
            'appContent': {
                templateUrl: 'view_controllers/rno/rno_parent_view.html',
                controller: 'nl.RnoParentViewCtrl'
            }
        }});

    $stateProvider.state('app.rno_stats', {
        url: '^/rno_stats',
        views: {
            'appContent': {
                templateUrl: 'view_controllers/rno/rno_stats.html',
                controller: 'nl.RnoStatsCtrl'
            }
        }});
}];

//-------------------------------------------------------------------------------------------------
var _pageGlobals = {
    userInfo: null,
    role: 'observe',
    metadataId: 0,  // The metadata is retreived from here
    metadataIdParent: 0, // Actual rno records are stored under this metadata - by default same as metadataId
    max: 50, // Number of RNO recrods to fetch
    metadata: null,
    enableDelete: false
};
    
//-------------------------------------------------------------------------------------------------
var RnoParentViewCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlCardsSrv', 'nlResourceUploader',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlCardsSrv, nlResourceUploader) {
    var _rnoServer = new RnoServer(nl, nlServerApi, nlDlg, true);
    var _observationManager = new ObservationManager(nl, _rnoServer, nlResourceUploader, nlDlg);
    var _cards = {};
    var _rnoReportManageForm = new RnoReportManageForm(nl, nlDlg, _rnoServer, _observationManager, _cards);

    function _onPageEnter(userInfo) {
        nl.pginfo.hidemenu = true;
        _pageGlobals.userInfo = userInfo;
        return nl.q(function(resolve, reject) {
            var params = nl.location.search();
            var hashKey = params.hashkey || '';

            nlServerApi.rnoGetDataEx(hashKey).then(function(response) {
                var rno = response.rno;
                rno.config = rno.config ? angular.fromJson(rno.config) : {};
                rno.data = angular.fromJson(response.data);
                _pageGlobals.metadata = response.metadata.content;
                nl.pginfo.pageTitle = nl.t('Reports of {} {}', rno.config.first_name, 
                    rno.config.last_name);
                _rnoReportManageForm.show($scope, rno);
                if (response.key) {
                    _rnoReportManageForm.showSentReport(response.key);
                }
                resolve(true);
            }, function(error) {
                resolve(false);
            });
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
}];

//-------------------------------------------------------------------------------------------------
var RnoStatsCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlRnoStats',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlRnoStats) {
    /* 
     * URLs handled
     * 'RNO Stats Dashboard' : /rno_stats?role=[observe|review|admin]&metadata=[metadataid]&title=[]
     * role=observe: shows the observer's stats dashboard
     * role=review: shows the reviewer's stats dashboard
     * role=admion: shows the admin's stats dashboard
     */
    var _rnoServer = new RnoServer(nl, nlServerApi, nlDlg, false);
    var _rnoData = {};

    function _onPageEnter(userInfo) {
        _pageGlobals.userInfo = userInfo;
        return nl.q(function(resolve, reject) {
            _initParams();
            if (_pageGlobals.metadataId == 0) {
                nlDlg.popupStatus(nl.t('Invalid url'));
                resolve(false);
                return;
            }
            _rnoServer.getMetaData(function() {
                if (!_pageGlobals.metadata) {
                    resolve(false);
                    return;
                }
                nl.pginfo.pageTitle = _pageGlobals.metadata.title + ': statistics';
                nlRnoStats.init(_pageGlobals, $scope);
                nlRnoStats.loadData();
                resolve(true);
            });
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);
    
    function _initParams() {
        var params = nl.location.search();
        _pageGlobals.metadataId = ('metadata' in params) ? parseInt(params.metadata) : 0;
        _pageGlobals.metadataIdParent = _pageGlobals.metadataId;
        _pageGlobals.role = ('role' in params) ? params.role : 'observe';
        _pageGlobals.max = ('max' in params) ? parseInt(params.max) : 50;
    }
}];

//-------------------------------------------------------------------------------------------------
var RnoListCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlCardsSrv', 'nlResourceUploader',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlCardsSrv, nlResourceUploader) {
	/* 
	 * URLs handled
	 * 'RNO Dashboard' : /rno_list?role=[observe|review|admin]&metadata=[metadataid]&title=[]
     * role=observe: shows the observer's dashboard
     * role=review: shows the reviewer's dashboard
     * role=admion: shows the admin's dashboard
	 */
    var _rnoDict = {};
    var _searchFilterInUrl = '';
    var _gradeFilterInUrl = '';
    var _rnoServer = new RnoServer(nl, nlServerApi, nlDlg, false);
	var _observationManager = new ObservationManager(nl, _rnoServer, nlResourceUploader, nlDlg);
    var _cards = {};
    var _rnoReportManageForm = new RnoReportManageForm(nl, nlDlg, _rnoServer, _observationManager, _cards);

	function _onPageEnter(userInfo) {
	    _pageGlobals.userInfo = userInfo;
		return nl.q(function(resolve, reject) {
		    _initParams();
			if (_pageGlobals.metadataId == 0) {
                nlDlg.popupStatus(nl.t('Invalid url'));
                resolve(false);
                return;
			}
            _rnoServer.getMetaData(function() {
                if (!_pageGlobals.metadata) {
                    resolve(false);
                    return;
                }
                nl.pginfo.pageTitle = _pageGlobals.metadata.title;
                if (_pageGlobals.role == 'admin') nl.pginfo.pageTitle += ' - administration'; 
                if (_pageGlobals.role == 'review') nl.pginfo.pageTitle += ' - review'; 
                $scope.cards = _cards;
                _cards.staticlist = _getStaticCards();
                _cards.emptycard = nlCardsSrv.getEmptyCard();
                _getDataFromServer(resolve, reject);
            });
		});
	}
	nlRouter.initContoller($scope, '', _onPageEnter);
	
    $scope.onCardInternalUrlClicked = function(card, internalUrl) {
		if (internalUrl === 'rno_create') {
			_createOrModifyRno($scope, null);
        } else if (internalUrl === 'rno_modify') {
            _createOrModifyRno($scope, card.rnoId);
        } else if (internalUrl === 'rno_delete') {
            _deleteRno($scope, card.rnoId);
        } else if (internalUrl === 'rno_report_manage') {
            var rno = _rnoDict[card.rnoId];
            _rnoServer.getData(rno).then(function() {
                _reportManage($scope, rno);
            });
		}
    };

	$scope.onCardLinkClicked = function(card, internalUrl) {
	    $scope.onCardInternalUrlClicked(card, internalUrl);
	};

    $scope.onAttachementShow = function(attachment, pos) {
        _observationManager.onAttachementShow($scope, attachment, pos);
    };
    $scope.onAttachementRemove = function(attachment, pos) {
        _observationManager.onAttachementRemove($scope, attachment, pos);
    };
    
	function _initParams() {
		_rnoDict = {};
        var params = nl.location.search();
        _searchFilterInUrl = ('search' in params) ? params.search : '';
        _gradeFilterInUrl = ('grade' in params) ? params.grade : '';
        _pageGlobals.metadataId = ('metadata' in params) ? parseInt(params.metadata) : 0;
        _pageGlobals.metadataIdParent = _pageGlobals.metadataId;
        _pageGlobals.role = ('role' in params) ? params.role : 'observe';
        _pageGlobals.enableDelete  = ('candelete' in params);
	}
	
    function _getStaticCards() {
        var card0 = {title: nl.t('Statistics'), 
                    icon: nl.url.resUrl('dashboard/reports.png'), 
                    url: nl.fmt2('/#/rno_stats?metadata={}&role={}', 
                        _pageGlobals.metadataId, _pageGlobals.role),
                    help: nl.t('View key statistics by click on this card.'), 
                    children: [], style: 'nl-bg-blue'};
        card0.links = [];
        if (_pageGlobals.role != 'admin') return [card0];
        var card = {title: _pageGlobals.metadata.createCardTitle, 
                    icon: _pageGlobals.metadata.createCardIcon, 
                    internalUrl: 'rno_create',
                    help: _pageGlobals.metadata.createCardHelp, 
                    children: [], style: 'nl-bg-blue'};
        card.links = [];
        return [card0, card];
    }

	function _getDataFromServer(resolve, reject) {
	    var utSec = _gradeFilterInUrl.split('.');	    
        nlServerApi.rnoGetList({metadata: _pageGlobals.metadataIdParent,
                                search: _searchFilterInUrl, user_type: utSec[0] || '', 
                                section: utSec[1] || '',
                                role: _pageGlobals.role,
                                max: _pageGlobals.max})
        .then(function(resultList) {
			nl.log.debug('Got result: ', resultList.length);
			_cards.cardlist = _getCards(resultList, nlCardsSrv);
			_addSearchInfo(_cards);
			resolve(true);
		}, function(reason) {
            resolve(false);
		});
	}

    function _addSearchInfo(cards) {
        cards.search = {placeholder: _pageGlobals.metadata.searchTitle};
        cards.search.onSearch = _onSearch;
        nlCardsSrv.updateGrades(cards, _getUtSecOptions());
        // cards.search.img = nl.url.resUrl('info.png');
        // cards.search.maxLimit = 1000;
    }
    
    function _onSearch(filter, grade) {
        nlDlg.showLoadingScreen();
        var promise = nl.q(function(resolve, reject) {
            _gradeFilterInUrl = grade || '';
            _searchFilterInUrl = filter || '';
            _getDataFromServer(resolve, reject);
        });
        promise.then(function(res) {
            nlDlg.hideLoadingScreen();
        });
    }

	function _getCards(resultList, nlCardsSrv) {
		var cards = [];
		for (var i = 0; i < resultList.length; i++) {
			var card = _createCard(resultList[i]);
			cards.push(card);
		}
		return cards;
	}
	
	function _createCard(rno) {
        if (!rno.data) rno.data = {};
		_rnoDict[rno.id] = rno;
		_updateJsonFields(rno);
		var internalUrl = (_pageGlobals.role == 'admin') ? 'rno_modify' : 'rno_report_manage';
		var help = (_pageGlobals.role == 'admin') ? '' : 'Manage observations and reports';
	    var card = {rnoId: rno.id,
	                title: nl.fmt2('{} {}', rno.config.first_name, rno.config.last_name), 
					icon: _getCardIcon(nl, rno.config), 
                    internalUrl: internalUrl,
					help: help,
					grade: _getCardGrade(rno),
					children: [], links: []};
        if (_pageGlobals.role != 'admin') {
            card.links.push({id: 'rno_modify', text: nl.t('modify')});
        }
        card.links.push({id: 'details', text: nl.t('details')});
		card.details = {help: card.help, avps: _getRnoAvps(rno)};

        if (_pageGlobals.role == 'admin') {
            var link = {title: nl.t('Modify'), 
                        internalUrl: 'rno_modify',
                        children: [], links: []};
            card.children.push(link);
            link = {title: nl.t('Delete'), 
                        internalUrl: 'rno_delete',
                        children: [], links: []};
            card.children.push(link);
        }
		return card;
	}
	
	function _getCardGrade(rno) {
        if (!rno.config.section) return rno.config.user_type;
        if (!rno.config.user_type) return rno.config.section;
        return rno.config.user_type + '.' + rno.config.section;
	}

    function _updateJsonFields(rno) {
        rno.config = rno.config ? angular.fromJson(rno.config) : {};
	}
	
    function  _getRnoUserModelAvps(rno, avps) {
        var um = _pageGlobals.metadata.user_model;
        if ('first_name' in um)
            nl.fmt.addAvp(avps, um.first_name.title, rno.config.first_name);
        if ('last_name' in um)
            nl.fmt.addAvp(avps, um.last_name.title, rno.config.last_name);
        if ('email' in um)
            nl.fmt.addAvp(avps, um.email.title, rno.config.email);
        if ('reply_to' in um)
            nl.fmt.addAvp(avps, um.reply_to.title, rno.config.reply_to);
        if ('centre' in um)
            nl.fmt.addAvp(avps, um.centre.title, rno.config.centre);
        if ('user_type' in um)
            nl.fmt.addAvp(avps, um.user_type.title, rno.config.user_type);
        if ('section' in um)
            nl.fmt.addAvp(avps, um.section.title, rno.config.section);
    }
    
	function  _getRnoAvps(rno) {
		var avps = [];
		_getRnoUserModelAvps(rno, avps);
        nl.fmt.addAvp(avps, 'Id', rno.id);
        nl.fmt.addAvp(avps, 'Created by', rno.authorname);
		nl.fmt.addAvp(avps, 'Updated by', rno.updated_by_name);
        nl.fmt.addAvp(avps, 'Observed by', rno.observername);
        nl.fmt.addAvp(avps, 'Reviewed by', rno.reviewername);
		nl.fmt.addAvp(avps, 'Created on', rno.created, 'date');
		nl.fmt.addAvp(avps, 'Updated on', rno.updated, 'date');
        nl.fmt.addAvp(avps, 'Group', rno.grpname);
		return avps;
	}

	function _deleteRno($scope, rnoId) {
		var msg = {title: nl.t('Please confirm'), 
				   template: nl.t('Are you sure you want to delete? All data associated with this card will be lost.'),
				   okText: nl.t('Delete')};
		nlDlg.popupConfirm(msg).then(function(result) {
			if (!result) return;
			nlDlg.showLoadingScreen();
			nlServerApi.rnoDelete(rnoId).then(function(status) {
				nlDlg.hideLoadingScreen();
				if (!status) return;
				if (rnoId in _rnoDict) delete _rnoDict[rnoId];
				for (var i in _cards.cardlist) {
					var card = _cards.cardlist[i];
					if (card.rnoId !== rnoId) continue;
					_cards.cardlist.splice(i, 1);
				}
			});	
		});
	}

    function _updateScope(scope, rno, optionName, options) {
        scope.options[optionName] = options;
        scope.data[optionName] = rno && rno.config[optionName] ?
            {id: rno.config[optionName]} :
            options[0];
    }
    
	function _createOrModifyRno($scope, rnoId) {
		var modifyDlg = nlDlg.create($scope);
		modifyDlg.setCssClass('nl-width-max');
        modifyDlg.scope.error = {};
        modifyDlg.scope.model = _pageGlobals.metadata.user_model;
        modifyDlg.scope.options = {};
        modifyDlg.scope.role = _pageGlobals.role;
		if (rnoId !== null) {
			var rno = _rnoDict[rnoId];
			modifyDlg.scope.dlgTitle = nl.t('Modify properties');
			modifyDlg.scope.data = {first_name: rno.config.first_name, last_name: rno.config.last_name, 
									email: rno.config.email, 
									reply_to: rno.config.reply_to,
									image: rno.config.image,
									observer: rno.observerid,
									reviewer: rno.reviewerid};
		} else {
			modifyDlg.scope.dlgTitle = nl.t('Create new');
			modifyDlg.scope.data = {first_name: '', last_name: '', 
                                    observer: _pageGlobals.userInfo.username, reviewer: _pageGlobals.userInfo.username};
		}
        _updateScope(modifyDlg.scope, rno, 'centre', _getCentreOptions());
        _updateScope(modifyDlg.scope, rno, 'user_type', _getUserTypeOptions());
        _updateScope(modifyDlg.scope, rno, 'section', _getSectionOptions());
		
		var buttons = [];
		var saveName = (rnoId !== null) ? nl.t('Save') : nl.t('Create');
		var saveButton = {
			text : saveName,
			onTap : function(e) {
				_onSaveRno(e, $scope, modifyDlg, rnoId);
			}
		};
		buttons.push(saveButton);
		var cancelButton = {text : nl.t('Cancel')};
		modifyDlg.show('view_controllers/rno/rno_create_dlg.html',
			buttons, cancelButton, false);
	}
	
	function _onSaveRno(e, $scope, modifyDlg, rnoId) {
	    if(!_validateInputs(modifyDlg.scope)) {
	        if(e) e.preventDefault();
	        return;
	    }
		nlDlg.showLoadingScreen();
		var config = {
            first_name: modifyDlg.scope.data.first_name, 
            last_name: modifyDlg.scope.data.last_name, 
            centre: modifyDlg.scope.data.centre.id, 
            user_type: modifyDlg.scope.data.user_type.id, 
            section: modifyDlg.scope.data.section.id, 
            email: modifyDlg.scope.data.email, 
            reply_to: modifyDlg.scope.data.reply_to, 
            image: modifyDlg.scope.data.image
		};
		var modifiedData = {
		    metadata: _pageGlobals.metadataIdParent,
		    config: angular.toJson(config),
		    role: _pageGlobals.role
		};
		if (_pageGlobals.role == 'admin') {
            modifiedData.observer = modifyDlg.scope.data.observer;
            modifiedData.reviewer = modifyDlg.scope.data.reviewer;
		}
		if (rnoId !== null) modifiedData.id = rnoId;
		var crModFn = (rnoId != null) ? nlServerApi.rnoModify: nlServerApi.rnoCreate;
		crModFn(modifiedData).then(function(rno) {
			_onModifyDone(rno, rnoId, modifiedData, $scope);
		});
	}

    function _onModifyDone(rno, rnoId, modifiedData, $scope) {
		nlDlg.hideLoadingScreen();
	    _updateForTesting(rno, modifiedData);
	    var card = _createCard(rno);
	    if (rnoId !== null) {
            var pos = _getCardPosition(rno.id);
            _cards.cardlist.splice(pos, 1);
	    }
		_cards.cardlist.splice(0, 0, card);			
	}

    function _validateInputs(scope) {
        scope.error = {};
        if (!_validateMandatoryAttr(scope, 'first_name')) return false;
        if (!_validateMandatoryAttr(scope, 'last_name')) return false;
        if (!_validateMandatoryAttr(scope, 'centre')) return false;
        if (!_validateMandatoryAttr(scope, 'user_type')) return false;
        if (!_validateMandatoryAttr(scope, 'section')) return false;
        if (!_validateMandatoryAttr(scope, 'email')) return false;
        if (!_validateMandatoryAttr(scope, 'reply_to')) return false;
        if (!_validateMandatoryAttr(scope, 'image')) return false;
        return true;
    }

    function _validateMandatoryAttr(scope, attr) {
        if (scope.data[attr]) return true;
        if (!(attr in _pageGlobals.metadata.user_model) || _pageGlobals.metadata.user_model[attr].optional)
            return true;
        var attrName = _pageGlobals.metadata.user_model[attr].title;
        return nlDlg.setFieldError(scope, attr, nl.t('{} is mandatory', attrName));
    }
    
	var uniqueId = 100;
	function _updateForTesting(rno, modifiedData) {
		if (NL_SERVER_INFO.serverType !== 'local') return;
		if ('id' in modifiedData) {
			rno.id = modifiedData.id;
		} else {
			rno.id = uniqueId++;
		}
        rno.config.first_name  = modifiedData.first_name;
        rno.config.last_name  = modifiedData.last_name;
        rno.config.centre  = modifiedData.centre;
        rno.config.user_type  = modifiedData.user_type;
        rno.config.section  = modifiedData.section;
        rno.config.email  = modifiedData.email;
        rno.config.reply_to  = modifiedData.reply_to;
        rno.config.image  = modifiedData.image;
	}

	function _getCardPosition(rnoId) {
		for(var i in _cards.cardlist) {
			var card = _cards.cardlist[i];
			if(card.rnoId === rnoId) return i;
		}
		nl.log.error('Cannot find modified card', rnoId);
		return 0;
	}

    function _reportManage($scope, rno) {
        _rnoReportManageForm.show($scope, rno);
    }
}];

//-------------------------------------------------------------------------------------------------
function RnoServer(nl, nlServerApi, nlDlg, bParent) {
    this.getMetaData = function(onDone) {
        nlServerApi.rnoGetMetadata(_pageGlobals.metadataId).then(function(metadata) {
            nl.log.debug('Got metadata: ', metadata);
            _pageGlobals.metadata = metadata.content;
            
            // Setting defaults
            if ('metadataParent' in _pageGlobals.metadata) 
                _pageGlobals.metadataIdParent = _pageGlobals.metadata.metadataParent;
            if (!('title' in _pageGlobals.metadata)) 
                _pageGlobals.metadata.title = nl.t('Rating and observation dashboard');
            if (!('searchTitle' in _pageGlobals.metadata))
                _pageGlobals.metadata.searchTitle = nl.t('Enter search words');
            if (!('createCardTitle' in _pageGlobals.metadata))
                _pageGlobals.metadata.createCardTitle = nl.t('New');
            if (!('createCardIcon' in _pageGlobals.metadata))
                _pageGlobals.metadata.createCardIcon = nl.url.resUrl('new_user.png');
            if (!('createCardHelp' in _pageGlobals.metadata))
                _pageGlobals.metadata.createCardHelp = nl.t('Create a rating and observation log for a new user by clicking on this card.');

            onDone();
        }, function(reason) {
            _pageGlobals.metadata = null;
            onDone();
        });
    };
    
    this.getData = function(rno) {
        nlDlg.showLoadingScreen();
        var metadata2 = _pageGlobals.metadataIdParent != _pageGlobals.metadataId
            ? _pageGlobals.metadataId : null;
        return nlServerApi.rnoGetData(rno.id, null, metadata2).then(function(newData) {
            nlDlg.hideLoadingScreen();
            rno.data = angular.fromJson(newData);
            _initRnoData(rno.data);
        });
    }
    
    function _initRnoData(rnoData) {
        if (!rnoData.observations) rnoData.observations = [];
        if (!rnoData.ratings) rnoData.ratings = {};
        if (!rnoData.report_info) rnoData.report_info = {};
        if (!rnoData.reportsSent) rnoData.reportsSent = {};

        var rm = _pageGlobals.metadata.report_model;
        if (!rm) return;
        if (rm.year && !rnoData.report_info.year)
            rnoData.report_info.year = {id:rm.year.values[0], name:rm.year.values[0]};
        if (rm.term && !rnoData.report_info.term)
            rnoData.report_info.term = {id:rm.term.values[0], name:rm.term.values[0]};
    }

    this.getSentReportData = function(rno, reportKey) {
        nlDlg.showLoadingScreen();
        var serverApi = bParent ? nlServerApi.rnoGetData2 : nlServerApi.rnoGetData;
        return serverApi(rno.id, reportKey).then(function(newData) {
            nlDlg.hideLoadingScreen();
            return angular.fromJson(newData);
        });
    }
    
    this.updateData = function(rno, send, mailData) {
        if (send === undefined) send = -2;
        if (mailData === undefined) mailData = {};
        nlDlg.showLoadingScreen();
        var data = angular.toJson(rno.data);
        var metadata2 = _pageGlobals.metadataIdParent != _pageGlobals.metadataId
            ? _pageGlobals.metadataId : null;
        return nlServerApi.rnoUpdateData(rno.id, data, send, mailData, metadata2)
        .then(function(newData) {
            nlDlg.hideLoadingScreen();
            rno.data = angular.fromJson(newData);
        });
    };
}

//-------------------------------------------------------------------------------------------------
function ObservationManager(nl, _rnoServer, nlResourceUploader, nlDlg) {

    this.createOrModifyObservation = function($scope, rno, observationId, cbFn) {
        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-width-max nl-height-max');

        var title = (observationId !== null) ? nl.t('Modify observation') : nl.t('New observation');
        dlg.scope.dlgTitle = nl.t('{}: {} {}', title, rno.config.first_name, rno.config.last_name);

        var observations = rno.data.observations;
        var o = (observationId !== null) ? observations[observationId] : {};
        var ratings = o.ratings || {};
        dlg.scope.msTree = new MsTree(nl, nlDlg, _pageGlobals.metadata.milestones, rno.config.user_type, ratings);
        dlg.scope.options = {rating: _getRatingOptions()};
        dlg.scope.formScope = {purpose:'observation'};
        
        dlg.scope.onResourceClick = function(attachment, $index) {
            attachment.isSelected = false;
        };

        dlg.scope.onResourceRemove = function(attachment, $index) {
            attachment.isSelected = false;
        };
        
        var currentAttachments = [];
        var att = o.attachments || [];
        for (var i=0; i<att.length; i++) {
            currentAttachments.push({isSelected: true, data: att[i]});
        }
        dlg.scope.data = {text: o.text || '', notes: o.notes || '', 
            newAttachments: [], currentAttachments: currentAttachments};
        dlg.scope.error = {};
        dlg.scope.observation_model = _pageGlobals.metadata.observation_model || {};
        
        var saveButton = {
            text : (observationId !== null) ? nl.t('Modify') : nl.t('Create'),
            onTap : function(e) {
                _onObservationSave(rno, dlg.scope, observationId, cbFn);
            }
        };
        var cancelButton = {text : nl.t('Cancel')};
        dlg.show('view_controllers/rno/rno_observe_new.html', [saveButton], cancelButton);
    };

    function _onObservationSave(rno, scope, observationId, cbFn) {
        nlDlg.showLoadingScreen();
        nlResourceUploader.uploadInSequence(scope.data.newAttachments, '', 'high')
        .then(function resolve(resInfos) {
            _onResourcesUploaded(rno, scope, observationId, resInfos, cbFn);
        }, function reject(msg) {
            nlDlg.popdownStatus(0);
            nlDlg.popupAlert({title: nl.t('Error'), template: msg});
        });
    }

    function _onResourcesUploaded(rno, scope, observationId, resInfos, cbFn) {
        nlDlg.popupStatus('Saving data ...', false);
        var isSelected = true;
        var attachments = [];
        var created = null;
        if (observationId !== null) {
            var o = rno.data.observations[observationId];
            created = o.created;
            isSelected = o.selected;
            rno.data.observations.splice(observationId, 1); // Remove the current element in case of modify
            for (var i=0; i<scope.data.currentAttachments.length; i++) {
                var att = scope.data.currentAttachments[i];
                if (att.isSelected) attachments.push(att.data);
                // TODO-MUNNI - delete unwanted resources
                // In general look at mechanism to scrub unused resources
            }
        }
        for(var i=0; i<resInfos.length; i++) {
            attachments.push({name: resInfos[i].name, 
                              url: resInfos[i].url, 
                              size: resInfos[i].size,
                              restype: resInfos[i].restype,
                              resid: resInfos[i].resid});
        }
        var now = new Date();
        var observation = {created: created || now, updated: now,
            text: scope.data.text, notes: scope.data.notes, attachments: attachments,
            ratings: scope.msTree.getSelectedRatings(),
            selected: isSelected};
        
        rno.data.observations.splice(0, 0, observation); // Insert to top of array
        _rnoServer.updateData(rno).then(function resolve() {
            nlDlg.popupStatus('Done');
            cbFn();
        }, function reject() {
            nlDlg.popdownStatus(0);
        });
    }
    
    this.onAttachementShow = function(attachment, pos) {
        _observationManager.onAttachementShow($scope, attachment, pos);
    };
    
    this.onAttachementRemove = function(attachment, pos) {
        _observationManager.onAttachementRemove($scope, attachment, pos);
    };
    
    this.deleteObservation = function($scope, rno, observationId, cbFn) {
        nlDlg.popupConfirm({title:nl.t('Confirm'), template:nl.t('Are you sure you want to delete the observation?')})
        .then(function(res) {
            if (!res) return;
            // Remove the specified element
            rno.data.observations.splice(observationId, 1); 
            _rnoServer.updateData(rno).then(function resolve() {
                cbFn();
            });
        });
    };
}

//-------------------------------------------------------------------------------------------------
function RnoReportManageForm(nl, nlDlg, _rnoServer, _observationManager, _cards) {
    var $scope = null;
    var rno = null;
    var formScope = null;
    
    this.show = function(scopeInput, rnoInput) {
        _initPrivate(scopeInput, rnoInput);
        _initFormScope();
        _updateFormScope();
        _initFormScopeFunctions();
    };

    this.showSentReport = function(sentKey) {
        var sent = formScope.reportsSentDict[sentKey];
        _onReportHistory(sent);
    };
    
    function _initPrivate(scopeInput, rnoInput) {
        $scope = scopeInput;
        rno = rnoInput;

        $scope.cards = null;
        $scope.formScope = {};
        formScope = $scope.formScope;
    }
    
    function _initFormScope() {
        formScope.purpose = 'rating';
        formScope.image = _getCardIcon(nl, rno.config);
        formScope.rno = rno;
        formScope.metadata = _pageGlobals.metadata;
        formScope.dlgTitle = nl.t('Manage and report: {} {}', rno.config.first_name, rno.config.last_name);
        formScope.canDelete = _pageGlobals.enableDelete;

        formScope.hideObservations = true;
        formScope.hideRatings = true;
        formScope.hideHistory = true;
        
        $scope.msTree = new MsTree(nl, nlDlg, _pageGlobals.metadata.milestones, 
            rno.config.user_type);
        
        $scope.options = {year: _getYearOptions(), term: _getTermOptions(), rating: _getRatingOptions()};
    }

    function _updateFormScope() {
        var ratings = _getMergedRatings(rno.data);
        $scope.msTree.updateRatings(ratings);

        formScope.reportsSent = [];
        formScope.reportsSentDict = {};
        for (var i=0; i<rno.data.observations.length; i++) {
            var o = rno.data.observations[i];
            if (!o.sent) continue;
            formScope.reportsSent.push(o.sent);
            formScope.reportsSentDict[o.sent.key] = o.sent;
        }
        
        for (var key in rno.data.reportsSent) {
            formScope.reportsSent.push(rno.data.reportsSent[key]);
            formScope.reportsSentDict[key] = rno.data.reportsSent[key];
        }

        formScope.reportsSent.sort(function(a, b) {
            if (a.sent_on > b.sent_on) return -1;
            // They being equal is very unlikely in our case!
            return 1;
        });

        formScope.isReportSent = function() {
            var key = _getReportKey(rno.data);
            if (rno.data.reportsSent[key]) return true;
            return false;
        };
    }
    
    function _getMergedRatings(rnoData) {
        var ratings = rnoData.ratings;
        var ratingsUpdatedOn = rnoData.ratingsUpdatedOn || nl.fmt.getPastDate();
        var observations = rnoData.observations;
        for(var i=observations.length-1; i>=0; i--) {
            var o = observations[i];
            if (o.updated < ratingsUpdatedOn) continue;
            for(var r in o.ratings) {
                ratings[r] = o.ratings[r];
            }
        }
        rnoData.ratingsUpdatedOn = new Date();
        return ratings;
    }

    function _initFormScopeFunctions() {
        formScope.onDlgClose = _onDlgClose;
        formScope.onSave = _onSave;
        formScope.onCreateObservation = _onCreateObservation;
        formScope.onEditObservation = _onEditObservation;
        formScope.onDeleteObservation = _onDeleteObservation;
        formScope.onSendObservation = _onSendObservation;
        formScope.onReportHistory = _onReportHistory;
        formScope.onPreview = _onPreview;
    }

    function _onDlgClose() {
        _saveReport(false);
        $scope.cards = _cards;
    }

    function _onSave() {
        _saveReport(true);
        $scope.cards = _cards;
    }

    function _onCreateObservation() {
        _observationManager.createOrModifyObservation($scope, rno, null, 
        function() {
            _updateFormScope();
        });
    }

    function _onEditObservation(observationId) {
        _observationManager.createOrModifyObservation($scope, rno, observationId,
        function() {
            _updateFormScope();
        });
    }

    function _onDeleteObservation(observationId) {      
        _observationManager.deleteObservation($scope, rno, observationId,
        function() {
            _updateFormScope();
        });
    }

    function _onSendObservation(observationId) {
        var mailData = _getMailData(false);
        _rnoServer.updateData(rno, observationId, mailData)
        .then(function() {
            _updateFormScope();
            nlDlg.popupAlert({title: nl.t('Done'), template: 'Observation is sent successfully.'});
        });
    }

    function _saveReport(saveToServer) {
        rno.data.ratings =  $scope.msTree.getSelectedRatings();
        if (saveToServer) _rnoServer.updateData(rno);
    }

    function _onReportHistory(sent) {
        _rnoServer.getSentReportData(rno, sent.key)
        .then(function(rnoData) {
            _showReportPreview(rnoData, sent);
        });
    }

    function _onPreview() {
        _saveReport(false);
        _showReportPreview(rno.data, null);
    }

    function _showReportPreview(rnoData, reportSent) {
        if (reportSent && reportSent.type == 'observation') {
            rnoData.ratings = rnoData.observations[0].ratings;
            rnoData.report_info = null;
            rnoData.reportsSent = {};
        }

        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-height-max nl-width-max');
        dlg.scope.formScope = $scope.formScope;
        dlg.scope.reportSent = reportSent;
        dlg.scope.image = _getCardIcon(nl, rno.config);
        dlg.scope.rnoConfig = rno.config;
        dlg.scope.rnoData = rnoData;
        dlg.scope.metadata = _pageGlobals.metadata;
        if (reportSent) {
            dlg.scope.dlgTitle = nl.t('{} {}', rno.config.first_name, rno.config.last_name);
        } else {
            dlg.scope.dlgTitle = nl.t('Preview: {} {}', rno.config.first_name, rno.config.last_name);
        }
        
        dlg.scope.observations = [];
        for(var i=0; i<rnoData.observations.length; i++) {
            var o = rnoData.observations[i];
            if (o.selected) dlg.scope.observations.push(o);
        }

        dlg.scope.msTree = new MsTree(nl, nlDlg, _pageGlobals.metadata.milestones, 
            rno.config.user_type);
        dlg.scope.msTree.updateRatings(rnoData.ratings);
        
        var sendButton = {text: nl.t('Send'), onTap: function(e) {
            if(_isReportSent(rno)) return;
            var mailData = _getMailData(true);
            _rnoServer.updateData(rno, -1, mailData).then(function() {
                _updateFormScope();
            });
        }};
        var buttons = [];
        if (!reportSent) {
            buttons.push(sendButton);
        } 
        var cancelButton = {text : nl.t('Close')};
        var template = 'view_controllers/rno/rno_report_view.html';
        dlg.show(template, buttons, cancelButton);
    }

    function _isReportSent(rno) {
        var key = _getReportKey(rno.data);
        if (!rno.data.reportsSent[key]) return false;
        var rm = _pageGlobals.metadata.report_model;
        var msg = nl.t('Report is already finalized and sent. ' + 
            'You need to change {} or {} field before sending it again.',
            rm.year.title, rm.term.title);
        nlDlg.popupAlert({title: nl.t('Already sent'), template: msg});
        return true;
    }

    function _getReportKey(data) {
        if (!data.reportsSent) data.reportsSent = {};
        var ret = 'Report/' + data.report_info.year.id + '/' + data.report_info.term.id;
        var metadata2Prefix = _pageGlobals.metadataIdParent != _pageGlobals.metadataId
            ? nl.fmt2('{}_', _pageGlobals.metadataId) : '';
        return metadata2Prefix + ret;
    }
    
    function _getMailData(bReport) {
        var metaMailData = _pageGlobals.metadata.mail_data || {};
        var subject = bReport ? 
            'New progress report has been shared with you' :
            'New observation has been shared with you';
        var mailData = {
            sender: metaMailData.sender || 'Nittio Learn',
            brandingTopImgs: metaMailData.brandingTopImgs || [],
            brandingBottomImgs: metaMailData.brandingBottomImgs || [],
            bgimg: ('bgimg' in metaMailData) ? metaMailData.bgimg : nl.url.resUrl('background/bg-sky.png'),
            parentLogin: metaMailData.parent_login_id,
            type: bReport ? 'report' : 'observation',
            typeStr: bReport ? 'Progress report' : 'Observation report',
            subject: subject, 
            image: rno.config.image || '',
            emailId: rno.config.email,
            observer: rno.observername,
            student: nl.fmt2('{} {}', rno.config.first_name, rno.config.last_name)
        };
        if (rno.config.reply_to) {
            mailData.reply_to = rno.config.reply_to;
        }
        return mailData;
    }
}

//-------------------------------------------------------------------------------------------------
function MsTree(nl, nlDlg, milestones, usertype) {
    var ratingDict = _getRatingDict();
    var defaultRating = null;
    var rootName = '_root';

    usertype = _userTypeToMilestoneUsertype(usertype);
    this.utOptions = _getMilestoneUserTypeOptions();
    this.utOptions.unshift({name: 'All clusters', id: 'all'});
    this.utOption = {id: usertype};

    this.ratingFilterOptions = [
        {id: 'all', name: 'All milestones'},
        {id: 'rated', name: 'Rated milestones'},
        {id: 'unrated', name: 'Unrated milestones'}];
    this.ratingFilterOption = {id: 'all'};

    this.ratingOverride = {id: null, name: ''};

    this.idToPos = {};
    this.items = [];
    
    this.getSelectedRatings = function() {
        var ratings = {};
        for(var i=0; i<this.items.length; i++) {
            var item = this.items[i];
            if (!item.rating || !item.rating.id) continue;
            ratings[item.milestone] = item.rating.id;
        }
        return ratings;
    };

    this.updateRatings = function(newRatings) {
        for(var i=0; i<this.items.length; i++) {
            var item = this.items[i];
            if (!item.milestone || !(item.milestone in newRatings)) continue;
            item.rating = {id: newRatings[item.milestone]};
            item.rating.name = ratingDict[item.rating.id];
            this.onRatingChange(item, true);
        }
        this.updateVisibleItems();
    };

    this.canShowItem = function(ms) {
        if (ms.indentation == 0) return true;
        return ms.isShown && (ms.isFolder || ms.usertype == this.utOption.id
            || this.utOption.id == 'all' || ms.selectCnt > 0) 
            && (this.ratingFilterOption.id == 'all' || 
            (this.ratingFilterOption.id == 'rated' && ms.selectCnt > 0) ||
            (this.ratingFilterOption.id == 'unrated' && ms.deselectCnt > 0));
    };
    
    this.visibleItems = [];
    this.updateVisibleItems = function() {
        this.visibleItems = [];
        for(var i=0; i<this.items.length; i++) {
            var item = this.items[i];
            if (this.canShowItem(item)) this.visibleItems.push(item);
        }
    };
    
    this.onRootFolderClick = function(folder) {
        folder.isFolderOpen = false;
        this.onFolderClick(folder);
    };

    this.onFolderClick = function(folder) {
        if (!folder.isFolder) return;
        folder.isFolderOpen = !folder.isFolderOpen;
        for(var i=0; i<this.items.length; i++) {
            var item = this.items[i];
            if (folder.id == item.id) continue;
            if (_isParent(folder, item)) {
                item.isShown = folder.isFolderOpen;
                if (item.isFolder) item.isFolderOpen = false;
            } else if (_isAnsistor(folder, item)) {
                item.isShown = false;
                if (item.isFolder) item.isFolderOpen = false;
            }
        }
        this.updateVisibleItems();
    };

    this.onRatingChange = function(ms, avoidUpdate) {
        if (ms.rating.id && ms.selectCnt == 0) {
            _changeSelectCnt(this, ms.id, 1);
        } else if (!ms.rating.id && ms.deselectCnt == 0) {
            _changeSelectCnt(this, ms.id, -1);
        }
        if (!avoidUpdate) this.updateVisibleItems();
    };

    this.onOverrideRating = function() {
        var updatedItems = [];
        var self = this;
        if (!self.ratingOverride.id) return;
        for(var i=0; i<self.items.length; i++) {
            var item = self.items[i];
            if (item.isFolder) continue;
            if (!self.canShowItem(item)) continue;
            
            item.rating = {id: self.ratingOverride.id, name: self.ratingOverride.name};
            self.onRatingChange(item, true);
            updatedItems.push(item);
        }
        var appliedRating = self.ratingOverride.name;
        self.ratingOverride = {id: null, name: ''};
        if (updatedItems.length == 0) {
            nlDlg.popupAlert({title: 'No update done',
                template: 'Bulk update is performed on visible milestones only.'});
            return;
        }
        var msg = nl.fmt2('<h4>Applied the rating <b>{}</b> on following <b>{}</b> items:</h4><ol>', 
            appliedRating, updatedItems.length);
        for (var i=0; i<updatedItems.length; i++) {
            msg += nl.fmt2('<li>{}</li>', updatedItems[i].text);
        }
        msg += '</ol>'
        nlDlg.popupAlert({title: 'Bulk update done', template: msg});
        self.updateVisibleItems();
    }

    function _init(self) {
        _addItem(self, {id: rootName, text: nl.t('Milestones'), parent: null,
            isShown: true, isFolder: true, indentation: 0,
            isFolderOpen: true, selectCnt: 0, deselectCnt: 0});
        for (var i=0; i<milestones.length; i++) {
            var m = milestones[i];
            var g1Id = nl.fmt2('{}.{}', rootName, m.group1);
            if (!(g1Id in self.idToPos)) {
                _addItem(self, {id: g1Id, text: m.group1, parent: rootName,
                    isShown: true, isFolder: true, indentation: 1,
                    isFolderOpen: false, selectCnt: 0, deselectCnt: 0});
            }
            var g2Id = nl.fmt2('{}.{}', g1Id, m.group2);
            if (!(g2Id in self.idToPos)) {
                _addItem(self, {id: g2Id, text: m.group2, parent: g1Id,
                    isShown: false, isFolder: true, indentation: 2,
                    isFolderOpen: false, selectCnt: 0, deselectCnt: 0});
            }
            var rating = {id: defaultRating, name: ''};
            var mid = nl.fmt2('{}.{}', g2Id, m.id);
            _addItem(self, {id: mid, text: m.name, parent: g2Id,
                isShown: false, isFolder: false, indentation: 3,
                milestone: m.id, rating: rating, selectCnt: 0, deselectCnt: 0,
                usertype: m.usertype});
        }
        self.updateVisibleItems();
    }
    
    function _addItem(self, item) {
        self.items.push(item);
        self.idToPos[item.id] = self.items.length -1;
        if (!item.rating) return;
        if (item.rating.id) {
            _addSelectCnt(self, item.id);
        } else {
            _addDeselectCnt(self, item.id);
        }
    }

    function _getItem(self, itemId) {
        if (itemId in self.idToPos) return self.items[self.idToPos[itemId]];
        return null;
    }
    
    function _isAnsistor(other, me) {
        // Is other the ansistor of me?
        return (me.id.indexOf(other.id) == 0);
    }
    
    function _isParent(other, me) {
        // Is other the direct parent of me?
        return (me.parent == other.id);
    }
    
    function _addSelectCnt(self, itemId) {
        var item = _getItem(self, itemId);
        if (!item) return;
        item.selectCnt++;
        _addSelectCnt(self, item.parent);
    }

    function _addDeselectCnt(self, itemId) {
        var item = _getItem(self, itemId);
        if (!item) return;
        item.deselectCnt++;
        _addDeselectCnt(self, item.parent);
    }

    function _changeSelectCnt(self, itemId, delta) {
        var item = _getItem(self, itemId);
        if (!item) return;
        item.selectCnt += delta;
        item.deselectCnt -= delta;
        _changeSelectCnt(self, item.parent, delta);
    }

    _init(this);
}

//-------------------------------------------------------------------------------------------------
// Utilities used in all the classes above
function _getArrayAsOptions(opts) {
    var options = [];
    for (var i=0; i<opts.length; i++) {
        options.push({name: opts[i], id: opts[i]});
    }
    return options;
}

function _userTypeToMilestoneUsertype(ut) {
    var mapping = _pageGlobals.metadata.user_type_mapping;
    if (!mapping) return ut;
    return mapping[ut];
}

function _getMilestoneUserTypeOptions() {
    var m = _pageGlobals.metadata;
    return _getArrayAsOptions(m.milestone_usertypes || m.user_model.user_type.values);
}

function _getUserTypeOptions() {
    return _getArrayAsOptions(_pageGlobals.metadata.user_model.user_type.values);
}

function _getSectionOptions() {
    if (!_pageGlobals.metadata.user_model.section) return [{id: 'NA'}];
    return _getArrayAsOptions(_pageGlobals.metadata.user_model.section.values);
}

function _getUtSecOptions() {
    var um = _pageGlobals.metadata.user_model;
    var uts = um.user_type ? um.user_type.values : [];
    var secs = um.section ? um.section.values : [];
    if (!secs.length) return uts; 
    if (!uts.length) return secs;

    var ret = [];
    for (var u=0; u<uts.length; u++) {
        for (var s=0; s<secs.length; s++) {
            ret.push(uts[u] + '.' + secs[s]);
        }    
    }
    return ret;
}

function _getCentreOptions() {
    if (!_pageGlobals.metadata.user_model.centre) return [{id: 'NA'}];
    return _getArrayAsOptions(_pageGlobals.metadata.user_model.centre.values);
}

function _getYearOptions() {
    var rm = _pageGlobals.metadata.report_model;
    if (!rm || !rm.year) return [{id: 'NA'}];
    return _getArrayAsOptions(rm.year.values);
}

function _getTermOptions() {
    var rm = _pageGlobals.metadata.report_model;
    if (!rm || !rm.term) return [{id: 'NA'}];
    return _getArrayAsOptions(rm.term.values);
}

function _getRatingOptions() {
    return [{id: null, name: ''}].concat(_pageGlobals.metadata.ratings);
}

function _getRatingDict() {
    var ratingDict = {};
    for(var i=0; i<_pageGlobals.metadata.ratings.length; i++) {
        var r = _pageGlobals.metadata.ratings[i];
        ratingDict[r.id] = r.name;
    }
    return ratingDict;
}

function _getCardIcon(nl, rnoConfig) {
    return rnoConfig.image || nl.url.resUrl('user.png');
}

//-------------------------------------------------------------------------------------------------
function _simpleElemDirective(viewName) {
    return [function(){
        return {restrict: 'E', templateUrl: 'view_controllers/rno/' + viewName};
    }];
}

module_init();
})();
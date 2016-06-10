(function() {

//-------------------------------------------------------------------------------------------------
// rno.js:
// rno - Rating and observation module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.rno', [])
	.config(configFn)
	.controller('nl.RnoListCtrl', RnoListCtrl)
    .directive('nlRnoReport', _simpleElemDirective('rno_report.html'))
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
				templateUrl: 'lib_ui/cards/cardsview.html',
				controller: 'nl.RnoListCtrl'
			}
		}});
}];

//-------------------------------------------------------------------------------------------------
var _pageGlobals = {
    userInfo: null,
    role: 'observe',
    metadataId: 0,
    metadata: null,
    enableDelete: false
};
    
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
    var _rnoServer = new RnoServer(nl, nlServerApi, nlDlg);
	var _observationManager = new ObservationManager(nl, _rnoServer, nlResourceUploader, nlDlg);

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
                $scope.cards = {};
                $scope.cards.staticlist = _getStaticCards();
                $scope.cards.emptycard = nlCardsSrv.getEmptyCard();
                _getDataFromServer(_searchFilterInUrl, resolve, reject);
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
        } else if (internalUrl === 'rno_observe') {
            var rno = _rnoDict[card.rnoId];
            _observationManager.createOrModifyObservation($scope, rno, null);
        } else if (internalUrl === 'rno_report_edit') {
            var rno = _rnoDict[card.rnoId];
            _editReport($scope, rno, true);
        } else if (internalUrl === 'rno_report_review') {
            var rno = _rnoDict[card.rnoId];
            _editReport($scope, rno, false);
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
        _pageGlobals.metadataId = ('metadata' in params) ? parseInt(params.metadata) : 0;
        _pageGlobals.role = ('role' in params) ? params.role : 'observe';
        _pageGlobals.enableDelete  = ('candelete' in params);
	}
	
    function _getStaticCards() {
        if (_pageGlobals.role != 'admin') return [];
        var card = {title: _pageGlobals.metadata.createCardTitle, 
                    icon: _pageGlobals.metadata.createCardIcon, 
                    internalUrl: 'rno_create',
                    help: _pageGlobals.metadata.createCardHelp, 
                    children: [], style: 'nl-bg-blue'};
        card.links = [];
        return [card];
    }

	function _getDataFromServer(filter, resolve, reject) {
        nlServerApi.rnoGetList({metadata: _pageGlobals.metadataId, search: filter, role: _pageGlobals.role})
        .then(function(resultList) {
			nl.log.debug('Got result: ', resultList.length);
			$scope.cards.cardlist = _getCards(resultList, nlCardsSrv);
			_addSearchInfo($scope.cards);
			resolve(true);
		}, function(reason) {
            resolve(false);
		});
	}
	
    function _addSearchInfo(cards) {
        cards.search = {placeholder: _pageGlobals.metadata.searchTitle};
        cards.search.onSearch = _onSearch;
    }
    
    function _onSearch(filter) {
        nlDlg.showLoadingScreen();
        var promise = nl.q(function(resolve, reject) {
            _getDataFromServer(filter, resolve, reject);
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
	
    function _getCardIcon(rno) {
        return rno.config.image || nl.url.resUrl('user.png');
    }
    
	function _createCard(rno) {
		_rnoDict[rno.id] = rno;
		_updateJsonFields(rno);
		var internalUrl = (_pageGlobals.role == 'admin') ? 'rno_modify' : 
		  (_pageGlobals.role == 'review') ? 'rno_report_review' : 'rno_observe';
	    var card = {rnoId: rno.id,
	                title: nl.fmt2('{} {}', rno.config.first_name, rno.config.last_name), 
					icon: _getCardIcon(rno), 
                    internalUrl: internalUrl,
					help: '',
					children: [], links: []};
        if (_pageGlobals.role != 'admin') {
            card.links.push({id: 'rno_modify', text: nl.t('modify')});
        }
        card.links.push({id: 'details', text: nl.t('details')});
		card.details = {help: card.help, avps: _getRnoAvps(rno)};

        if (_pageGlobals.role == 'observe') {
            var link = {title: nl.t('New observation'), 
                        internalUrl: 'rno_observe',
                        children: [], links: []};
            card.children.push(link);
            link = {title: nl.t('Manage and report'), 
                        internalUrl: 'rno_report_edit',
                        children: [], links: []};
            card.children.push(link);
            link = {title: nl.t('Send for review'), 
                        internalUrl: 'rno_review',
                        children: [], links: []};
            // card.children.push(link); TODO-MUNNI - commented out for now
        } else if (_pageGlobals.role == 'review') {
            var link = {title: nl.t('Review report'), 
                        internalUrl: 'rno_report_review',
                        children: [], links: []};
            card.children.push(link);
        } else {
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

    function _updateJsonFields(rno) {
        rno.data = rno.data ? angular.fromJson(rno.data) : {};
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
        if ('user_type' in um)
            nl.fmt.addAvp(avps, um.user_type.title, rno.config.user_type);
    }
    
	function  _getRnoAvps(rno) {
		var avps = [];
		_getRnoUserModelAvps(rno, avps);
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
				for (var i in $scope.cards.cardlist) {
					var card = $scope.cards.cardlist[i];
					if (card.rnoId !== rnoId) continue;
					$scope.cards.cardlist.splice(i, 1);
				}
			});	
		});
	}
	
	function _createOrModifyRno($scope, rnoId) {
		var modifyDlg = nlDlg.create($scope);
		modifyDlg.setCssClass('nl-width-max');
        modifyDlg.scope.error = {};
        modifyDlg.scope.model = _pageGlobals.metadata.user_model;
        modifyDlg.scope.options = {user_type: _getUserTypeOptions()};
        modifyDlg.scope.role = _pageGlobals.role;
		if (rnoId !== null) {
			var rno = _rnoDict[rnoId];
            var utOption = {id: rno.config.user_type};
			modifyDlg.scope.dlgTitle = nl.t('Modify properties');
			modifyDlg.scope.data = {first_name: rno.config.first_name, last_name: rno.config.last_name, 
									user_type: utOption, email: rno.config.email, image: rno.config.image,
									observer: rno.observerid,
									reviewer: rno.reviewerid};
		} else {
			modifyDlg.scope.dlgTitle = nl.t('Create new');
			modifyDlg.scope.data = {first_name: '', last_name: '', 
                                    user_type: '', email: '', image: '',
                                    observer: _pageGlobals.userInfo.username, reviewer: _pageGlobals.userInfo.username};
		}
		
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
            user_type: modifyDlg.scope.data.user_type.id, 
            email: modifyDlg.scope.data.email, 
            image: modifyDlg.scope.data.image
		};
		var modifiedData = {
		    metadata: _pageGlobals.metadataId,
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
            $scope.cards.cardlist.splice(pos, 1);
	    }
		$scope.cards.cardlist.splice(0, 0, card);			
	}

    function _validateInputs(scope) {
        scope.error = {};
        if (!_validateMandatoryAttr(scope, 'first_name')) return false;
        if (!_validateMandatoryAttr(scope, 'last_name')) return false;
        if (!_validateMandatoryAttr(scope, 'user_type')) return false;
        if (!_validateMandatoryAttr(scope, 'email')) return false;
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
        rno.config.user_type  = modifiedData.user_type;
        rno.config.email  = modifiedData.email;
        rno.config.image  = modifiedData.image;
	}

	function _getCardPosition(rnoId) {
		for(var i in $scope.cards.cardlist) {
			var card = $scope.cards.cardlist[i];
			if(card.rnoId === rnoId) return i;
		}
		nl.log.error('Cannot find modified card', rnoId);
		return 0;
	}

    function _editReport($scope, rno, bEdit) {
        var dlg = nlDlg.create($scope);
        var template = 'view_controllers/rno/rno_report_dlg.html';
        dlg.setCssClass('nl-height-max nl-width-max');
        
        var templ = bEdit ? 'Manage and edit report: {} {}' : 'Review and update report: {} {}';
        dlg.scope.dlgTitle = nl.t(templ, rno.config.first_name, rno.config.last_name);
        dlg.scope.rno = rno;
        dlg.scope.purpose = 'rating';
        _togglePreviewMode(dlg.scope);
        dlg.scope.user_model = _pageGlobals.metadata.user_model;
        dlg.scope.image = _getCardIcon(rno);

        var ratings = _getRatings(rno);
        dlg.scope.observations = _getObservations(rno);
        var obsSelected = [];
        for (var i=0; i<dlg.scope.observations.length; i++) {
            obsSelected.push(dlg.scope.observations[i].selected);
        }
        
        dlg.scope.msTree = new MsTree(nl, nlDlg, _pageGlobals.metadata.milestones, rno.config.user_type, ratings, _getRatingDict(), null);
        
        var reportInfo = _getReportInfo(rno);
        dlg.scope.options = {year: _getYearOptions(), term: _getTermOptions(), rating: _getRatingOptions()};
        dlg.scope.data = {year: reportInfo.year, term: reportInfo.term, 
            summary: reportInfo.summary, obsSelected: obsSelected};
        dlg.scope.error = {};

        _observationManager.manageObservations($scope, dlg.scope, rno);
        
        var previewButton = {text: nl.t('Toggle preview'), onTap: function(e) {
            if (e) e.preventDefault();
            _togglePreviewMode(dlg.scope);
        }};
        var saveButton = {text: nl.t('Save'), onTap: function(e) {
            _onSaveReport(e, dlg.scope);
        }};
        var buttons = [];
        if (_pageGlobals.role == 'observe' || _pageGlobals.role == 'review') {
            buttons.push(previewButton);
            buttons.push(saveButton);
        } 
        var cancelButton = {text : nl.t('Cancel')};
        dlg.show(template, buttons, cancelButton);
    }
    
    function _togglePreviewMode(dlgScope) {
        if (_pageGlobals.role == 'admin') {
            dlgScope.mode = 'preview';
            return;           
        }

        if (dlgScope.mode == 'edit')
            dlgScope.mode = 'preview';
        else
            dlgScope.mode = 'edit';
    }

    function _onSaveReport(e, dlgScope) {
        if(!_validateReportInputs(dlgScope)) {
            if(e) e.preventDefault();
            return;
        }
        var rno =  dlgScope.rno;
        var data =  dlgScope.data;
        rno.data.ratings =  dlgScope.msTree.getSelectedRatings();
        rno.data.report_info.summary = data.summary;
        rno.data.report_info.year = data.year;
        rno.data.report_info.term = data.term;
        for (var i=0; i<data.obsSelected.length; i++) {
            rno.data.observations[i].selected = data.obsSelected[i];
        }
        _rnoServer.updateData(rno);
    }

    function _validateReportInputs(scope) {
        scope.error = {};
        if (!_validateMandatoryAttr(scope, 'summary')) return false;
        return true;
    }
}];

//-------------------------------------------------------------------------------------------------
function RnoServer(nl, nlServerApi, nlDlg) {
    this.getMetaData = function(onDone) {
        nlServerApi.rnoGetMetadata(_pageGlobals.metadataId).then(function(metadata) {
            nl.log.debug('Got metadata: ', metadata);
            _pageGlobals.metadata = metadata.content;
            
            // Setting defaults
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
    
    var saveStatus = {};
    this.updateData = function(rno) {
        nlDlg.showLoadingScreen();
        if (!(rno.id in saveStatus)) saveStatus[rno.id] = {saveSent: 0, saved: 0};
        saveStatus[rno.id].saveSent++;
        var saveNumber = saveStatus[rno.id].saveSent;
        var data = angular.toJson(rno.data);
        return nlServerApi.rnoUpdateData(rno.id, data).then(function(updatedRno) {
            nlDlg.hideLoadingScreen();
            if (saveNumber > saveStatus[rno.id].saved) saveStatus[rno.id].saved = saveNumber;
        });
    };
}

//-------------------------------------------------------------------------------------------------
function ObservationManager(nl, _rnoServer, nlResourceUploader, nlDlg) {

    this.createOrModifyObservation = function($scope, rno, observationId) {
        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-width-max nl-height-max');

        var title = (observationId !== null) ? nl.t('Modify observation') : nl.t('New observation');
        dlg.scope.dlgTitle = nl.t('{}: {} {}', title, rno.config.first_name, rno.config.last_name);

        var observations = _getObservations(rno);
        var o = (observationId !== null) ? observations[observationId] : {};
        var ratings = o.ratings || {};
        dlg.scope.msTree = new MsTree(nl, nlDlg, _pageGlobals.metadata.milestones, rno.config.user_type, ratings, _getRatingDict(), null);
        dlg.scope.options = {rating: _getRatingOptions()};
        dlg.scope.purpose = 'observation';
        
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
        
        var saveButton = {
            text : (observationId !== null) ? nl.t('Modify') : nl.t('Create'),
            onTap : function(e) {
                _onObservationSave(rno, dlg.scope, observationId);
            }
        };
        var cancelButton = {text : nl.t('Cancel')};
        dlg.show('view_controllers/rno/rno_observe_new.html', [saveButton], cancelButton);
    };

    function _onObservationSave(rno, scope, observationId) {
        nlDlg.showLoadingScreen();
        nlResourceUploader.uploadInSequence(scope.data.newAttachments, '', 'high')
        .then(function resolve(resInfos) {
            _onResourcesUploaded(rno, scope, observationId, resInfos);
        }, function reject(msg) {
            nlDlg.popdownStatus(0);
            nlDlg.popupAlert({title: nl.t('Error'), template: msg});
        });
    }

    function _onResourcesUploaded(rno, scope, observationId, resInfos) {
        nlDlg.popupStatus('Saving data ...', false);
        var isSelected = true;
        var attachments = [];
        if (observationId !== null) {
            var o = rno.data.observations[observationId];
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
        var observation = {created: now, updated: now,
            text: scope.data.text, notes: scope.data.notes, attachments: attachments,
            ratings: scope.msTree.getSelectedRatings(),
            selected: isSelected};
        _updateRatings(rno, observation);
        
        rno.data.observations.splice(0, 0, observation); // Insert to top of array
        _rnoServer.updateData(rno).then(function resolve() {
            nlDlg.popupStatus('Done');
        }, function reject() {
            nlDlg.popdownStatus(0);
        });
    }
    
    function _updateRatings(rno, observation) {
        var ratings = _getRatings(rno);
        for(var milestone in observation.ratings) {
            if (milestone in ratings) continue;
            ratings[milestone] = observation.ratings[milestone];
        }
    }
    
    this.onAttachementShow = function(attachment, pos) {
        _observationManager.onAttachementShow($scope, attachment, pos);
    };
    
    this.onAttachementRemove = function(attachment, pos) {
        _observationManager.onAttachementRemove($scope, attachment, pos);
    };

    this.manageObservations = function($scope, dlgScope, rno) {
        var self = this;
        dlgScope.canDelete = _pageGlobals.enableDelete;
     
        dlgScope.onCreate = function(e) {
            self.createOrModifyObservation($scope, rno, null);
        };
        dlgScope.onEdit = function(observationId, e) {
            self.createOrModifyObservation($scope, rno, observationId);
        };
        dlgScope.onDelete = function(observationId, e) {      
            if (e) e.stopImmediatePropagation();
            self.deleteObservation($scope, rno, observationId);
        };
    };

    this.deleteObservation = function($scope, rno, observationId) {
        nlDlg.popupConfirm({title:nl.t('Confirm'), template:nl.t('Are you sure you want to delete the observation?')})
        .then(function(res) {
            if (!res) return;
            // Remove the specified element
            rno.data.observations.splice(observationId, 1); 
            _rnoServer.updateData(rno);
        });
    };
}

//-------------------------------------------------------------------------------------------------
function MsTree(nl, nlDlg, milestones, usertype, ratings, ratingDict, defaultRating) {
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
    _init(this);
    
    this.getSelectedRatings = function() {
        var ratings = {};
        for(var i=0; i<this.items.length; i++) {
            var item = this.items[i];
            if (!item.rating || !item.rating.id) continue;
            ratings[item.milestone] = item.rating.id;
        }
        return ratings;
    };

    this.canShowItem = function(ms) {
        if (ms.indentation == 0) return true;
        return ms.isShown && (ms.isFolder || ms.usertype == this.utOption.id
            || this.utOption.id == 'all' || ms.selectCnt > 0) 
            && (this.ratingFilterOption.id == 'all' || 
            (this.ratingFilterOption.id == 'rated' && ms.selectCnt > 0) ||
            (this.ratingFilterOption.id == 'unrated' && ms.deselectCnt > 0));
    }
    
    this.expandedAll = false;    
    this.onRootFolderClick = function(folder) {
        if (this.expandedAll) {
            this.expandedAll = false;
            folder.isFolderOpen = false;
            this.onFolderClick(folder);
            return;
        }
        this.expandAll();
    };

    this.expandAll = function() {
        this.expandedAll = true;
        for(var i=0; i<this.items.length; i++) {
            var item = this.items[i];
            item.isShown = true;
            if (item.isFolder) item.isFolderOpen = true;
        }
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
    };

    this.onRatingChange = function(ms) {
        if (ms.rating.id && ms.selectCnt == 0) {
            _changeSelectCnt(this, ms.id, 1);
        } else if (!ms.rating.id && ms.deselectCnt == 0) {
            _changeSelectCnt(this, ms.id, -1);
        }
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
            self.onRatingChange(item);
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
            var ratingId = (m.id in ratings) ? ratings[m.id] : defaultRating;
            var ratingName = ratingId ? ratingDict[ratingId] : '';
            var rating = {id: ratingId, name: ratingName};
            var mid = nl.fmt2('{}.{}', g2Id, m.id);
            _addItem(self, {id: mid, text: m.name, parent: g2Id,
                isShown: false, isFolder: false, indentation: 3,
                milestone: m.id, rating: rating, selectCnt: 0, deselectCnt: 0,
                usertype: m.usertype});
        }
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
}

//-------------------------------------------------------------------------------------------------
// Utilities used in all the classes above
function _getObservations(rno) {
    if (!rno.data.observations) rno.data.observations = [];
    return rno.data.observations;
}

function _getRatings(rno) {
    if (!rno.data.ratings) rno.data.ratings = {};
    return rno.data.ratings;
}

function _getReportInfo(rno) {
    if (!rno.data.report_info) rno.data.report_info = {};
    return rno.data.report_info;
}

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

function _getYearOptions() {
    return _getArrayAsOptions(_pageGlobals.metadata.report_model.year.values);
}

function _getTermOptions() {
    return _getArrayAsOptions(_pageGlobals.metadata.report_model.term.values);
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

//-------------------------------------------------------------------------------------------------
function _simpleElemDirective(viewName) {
    return [function(){
        return {restrict: 'E', templateUrl: 'view_controllers/rno/' + viewName};
    }];
}

module_init();
})();
(function() {

//-------------------------------------------------------------------------------------------------
// rno.js:
// rno - Rating and observation module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.rno', [])
	.config(configFn)
	.controller('nl.RnoMyCtrl', RnoMyCtrl)
    .directive('nlRnoReport', _simpleElemDirective('rno_report.html'))
    .directive('nlRnoMstree', _simpleElemDirective('rno_mstree.html'))
    .directive('nlRnoMstreeView', _simpleElemDirective('rno_mstree_view.html'));
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.rno_my', {
		url: '/rno_my',
		views: {
			'appContent': {
				templateUrl: 'lib_ui/cards/cardsview.html',
				controller: 'nl.RnoMyCtrl'
			}
		}});
}];

var RnoMyCtrl = ['nl', 'nlRouter', '$scope', 'nlServerApi', 'nlDlg', 'nlCardsSrv',
function(nl, nlRouter, $scope, nlServerApi, nlDlg, nlCardsSrv) {
	/* 
	 * URLs handled
	 * 'RNO Dashboard' : /app/rno_my?metadata=[metadataid]?title=[]
	 */
	var _rnoDict = {};
	var _metadataId = 0;
	var _metadata = null;
	var _searchFilterInUrl = '';

	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
		    _initParams();
			if (_metadataId == 0) {
                nlDlg.popupStatus(nl.t('Invalid url'));
                resolve(false);
                return;
			}
            _getMetaData(function() {
                if (!_metadata) {
                    resolve(false);
                    return;
                }
                nl.pginfo.pageTitle = _metadata.title;
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
        } else if (internalUrl === 'rno_observe') {
            var rno = _rnoDict[card.rnoId];
            _createOrModifyObservation($scope, rno, null);
        } else if (internalUrl === 'rno_observe_manage') {
            var rno = _rnoDict[card.rnoId];
            _manageObservations($scope, rno);
        } else if (internalUrl === 'rno_report') {
            var rno = _rnoDict[card.rnoId];
            _editReport($scope, rno);
		}
    };

	$scope.onCardLinkClicked = function(card, linkid) {
		if (linkid === 'rno_modify') {
			_createOrModifyRno($scope, card.rnoId);
		} else if (linkid === 'rno_delete') {
			_deleteRno($scope, card.rnoId);
		}
	};

	function _initParams() {
		_rnoDict = {};
        var params = nl.location.search();
        _searchFilterInUrl = ('search' in params) ? params.search : '';
        _metadataId = ('metadata' in params) ? parseInt(params.metadata) : 0;
	}
	
	function _getMetaData(onDone) {
        nlServerApi.rnoGetMetadata(_metadataId).then(function(metadata) {
            nl.log.debug('Got metadata: ', metadata);
            _metadata = metadata.content;
            
            // Setting defaults
            if (!('title' in _metadata)) 
                _metadata.title = nl.t('Rating and observation dashboard');
            if (!('searchTitle' in _metadata))
                _metadata.searchTitle = nl.t('Enter search words');
            if (!('createCardTitle' in _metadata))
                _metadata.createCardTitle = nl.t('New');
            if (!('createCardIcon' in _metadata))
                _metadata.createCardIcon = nl.url.resUrl('new_user.png');
            if (!('createCardHelp' in _metadata))
                _metadata.createCardHelp = nl.t('Create a new rating and observation log for a user by clicking on this card.');

            onDone();
        }, function(reason) {
            _metadata = null;
            onDone();
        });
	}

    function _getStaticCards() {
        var card = {title: _metadata.createCardTitle, 
                    icon: _metadata.createCardIcon, 
                    internalUrl: 'rno_create',
                    help: _metadata.createCardHelp, 
                    children: [], style: 'nl-bg-blue'};
        card.links = [];
        return [card];
    }

	function _getDataFromServer(filter, resolve, reject) {
        nlServerApi.rnoGetList({metadata: _metadataId, search: filter}).then(function(resultList) {
			nl.log.debug('Got result: ', resultList.length);
			$scope.cards.cardlist = _getCards(resultList, nlCardsSrv);
			_addSearchInfo($scope.cards);
			resolve(true);
		}, function(reason) {
            resolve(false);
		});
	}
	
    function _addSearchInfo(cards) {
        cards.search = {placeholder: _metadata.searchTitle};
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
        return rno.image || nl.url.resUrl('user.png');
    }
    
	function _createCard(rno) {
		_rnoDict[rno.id] = rno;
		if (!rno.data) rno.data = {};
	    var card = {rnoId: rno.id,
	                title: nl.fmt2('{} {}', rno.first_name, rno.last_name), 
					icon: _getCardIcon(rno), 
                    internalUrl: 'rno_observe',
					help: '',
					children: [], links: []};
        card.links.push({id: 'rno_modify', text: nl.t('modify')});
        card.links.push({id: 'rno_delete', text: nl.t('delete')});
        card.links.push({id: 'details', text: nl.t('details')});
		card.details = {help: card.help, avps: _getRnoAvps(rno)};

        var link = {title: nl.t('New observation'), 
                    internalUrl: 'rno_observe',
                    children: [], links: []};
        card.children.push(link);

        link = {title: nl.t('Manage observations'), 
                    internalUrl: 'rno_observe_manage',
                    children: [], links: []};
        card.children.push(link);

        link = {title: nl.t('Edit report'), 
                    internalUrl: 'rno_report',
                    children: [], links: []};
        card.children.push(link);

        link = {title: nl.t('Send for review'), 
                    internalUrl: 'rno_review',
                    children: [], links: []};
        card.children.push(link);

		return card;
	}
	
	function  _getRnoAvps(rno) {
		var avps = [];
		if ('first_name' in _metadata.user_model)
            nl.fmt.addAvp(avps, _metadata.user_model.first_name.title, rno.first_name);
        if ('last_name' in _metadata.user_model)
            nl.fmt.addAvp(avps, _metadata.user_model.last_name.title, rno.last_name);
        if ('email' in _metadata.user_model)
            nl.fmt.addAvp(avps, _metadata.user_model.email.title, rno.email);
        if ('user_type' in _metadata.user_model)
            nl.fmt.addAvp(avps, _metadata.user_model.user_type.title, rno.user_type);
        nl.fmt.addAvp(avps, 'Created by', rno.authorname);
		nl.fmt.addAvp(avps, 'Updated by', rno.updated_by_name);
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
        modifyDlg.scope.model = _metadata.user_model;
        modifyDlg.scope.options = {user_type: _getUserTypeOptions()};
		if (rnoId !== null) {
			var rno = _rnoDict[rnoId];
            var utOption = {id: rno.user_type};
			modifyDlg.scope.dlgTitle = nl.t('Modify properties');
			modifyDlg.scope.data = {first_name: rno.first_name, last_name: rno.last_name, 
									user_type: utOption, email: rno.email, image: rno.image};
		} else {
			modifyDlg.scope.dlgTitle = nl.t('Create new');
			modifyDlg.scope.data = {first_name: '', last_name: '', 
                                    user_type: '', email: '', image: ''};
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
	
    function _getArrayAsOptions(opts) {
        var options = [];
        for (var i=0; i<opts.length; i++) {
            options.push({name: opts[i], id: opts[i]});
        }
        return options;
    }

    function _getUserTypeOptions() {
        return _getArrayAsOptions(_metadata.user_model.user_type.values);
    }

    function _getYearOptions() {
        return _getArrayAsOptions(_metadata.report_model.year.values);
    }
    
    function _getTermOptions() {
        return _getArrayAsOptions(_metadata.report_model.term.values);
    }

    function _getRatingOptions() {
        return [{id: null, name: ''}].concat(_metadata.ratings);
    }
    
    function _getRatingDict() {
        var ratingDict = {};
        for(var i=0; i<_metadata.ratings.length; i++) {
            var r = _metadata.ratings[i];
            ratingDict[r.id] = r.name;
        }
        return ratingDict;
    }

	function _onSaveRno(e, $scope, modifyDlg, rnoId) {
	    if(!_validateInputs(modifyDlg.scope)) {
	        if(e) e.preventDefault();
	        return;
	    }
		nlDlg.showLoadingScreen();
		var modifiedData = {
		    metadata: _metadataId,
            first_name: modifyDlg.scope.data.first_name, 
            last_name: modifyDlg.scope.data.last_name, 
            user_type: modifyDlg.scope.data.user_type.id, 
            email: modifyDlg.scope.data.email, 
            image: modifyDlg.scope.data.image
		};
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
        if (!(attr in _metadata.user_model) || _metadata.user_model[attr].optional)
            return true;
        var attrName = _metadata.user_model[attr].title;
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
        rno.first_name  = modifiedData.first_name;
        rno.last_name  = modifiedData.last_name;
        rno.user_type  = modifiedData.user_type;
        rno.email  = modifiedData.email;
        rno.image  = modifiedData.image;
	}

	function _getCardPosition(rnoId) {
		for(var i in $scope.cards.cardlist) {
			var card = $scope.cards.cardlist[i];
			if(card.rnoId === rnoId) return i;
		}
		nl.log.error('Cannot find modified card', rnoId);
		return 0;
	}

    function _createOrModifyObservation($scope, rno, observationId) {
        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-width-max nl-height-max');

        var title = (observationId !== null) ? nl.t('Modify observation') : nl.t('New observation');
        dlg.scope.dlgTitle = nl.t('{}: {} {}', title, rno.first_name, rno.last_name);

        var observations = _getObservations(rno);
        var o = (observationId !== null) ? observations[observationId] : {};
        var ratings = o.ratings || {};
        dlg.scope.msTree = new MsTree(_metadata.milestones, rno.user_type, ratings, _getRatingDict(), null);
        dlg.scope.options = {rating: _getRatingOptions()};
        
        dlg.scope.data = {text: o.text || '', notes: o.notes || '', attachments: o.attachments || ''};
        dlg.scope.error = {};
        
        var saveButton = {
            text : (observationId !== null) ? nl.t('Modify') : nl.t('Create'),
            onTap : function(e) {
                _onNewObservation(rno, dlg.scope, observationId);
            }
        };
        var cancelButton = {text : nl.t('Cancel')};
        dlg.show('view_controllers/rno/rno_observe_new.html', [saveButton], cancelButton);
    }

    function _onNewObservation(rno, scope, observationId) {
        var isSelected = true;
        if (observationId !== null) {
            isSelected = rno.data.observations[observationId].selected;
            rno.data.observations.splice(observationId, 1); // Remove the current element in case of modify
        }

        var data = scope.data;
        var now = new Date();
        var observation = {created: now, updated: now,
            text: data.text, notes: data.notes,
            ratings: scope.msTree.getSelectedRatings(),
            selected: isSelected};
        _updateRatings(rno, observation);
        
        rno.data.observations.splice(0, 0, observation); // Insert to top of array
        _updateDataInServer(rno);
    }
    
    function _updateRatings(rno, observation) {
        var ratings = _getRatings(rno);
        for(var milestone in observation.ratings) {
            if (milestone in ratings) continue;
            ratings[milestone] = observation.ratings[milestone];
        }
    }
    
    function _manageObservations($scope, rno) {
        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-width-max nl-height-max');
        dlg.scope.dlgTitle = nl.t('Manage observations: {} {}', rno.first_name, rno.last_name);
        dlg.scope.observations = _getObservations(rno);
        var cancelButton = {text : nl.t('Close')};
     
        dlg.scope.onCreate = function() {
            _createOrModifyObservation($scope, rno, null);
        };
        dlg.scope.onEdit = function(observationId) {
            _createOrModifyObservation($scope, rno, observationId);
        };
        dlg.scope.onDelete = function(observationId) {            
            _deleteObservation($scope, rno, observationId);
        };
        dlg.show('view_controllers/rno/rno_observe_manage.html', [], cancelButton);
    }

    function _deleteObservation($scope, rno, observationId) {
        nlDlg.popupConfirm({title:nl.t('Confirm'), template:nl.t('Are you sure you want to delete the observation?')})
        .then(function(res) {
            if (!res) return;
            // Remove the specified element
            rno.data.observations.splice(observationId, 1); 
            _updateDataInServer(rno);
        });
    }

    function _editReport($scope, rno) {
        var dlg = nlDlg.create($scope);
        var template = 'view_controllers/rno/rno_report_dlg.html';
        dlg.setCssClass('nl-height-max nl-width-max');

        dlg.scope.dlgTitle = nl.t('Edit report: {} {}', rno.first_name, rno.last_name);
        dlg.scope.rno = rno;
        _togglePreviewMode(dlg.scope);
        dlg.scope.user_model = _metadata.user_model;
        dlg.scope.image = _getCardIcon(rno);

        var ratings = _getRatings(rno);
        dlg.scope.observations = _getObservations(rno);
        var obsSelected = [];
        for (var i=0; i<dlg.scope.observations.length; i++) {
            obsSelected.push(dlg.scope.observations[i].selected);
        }
        
        dlg.scope.msTree = new MsTree(_metadata.milestones, rno.user_type, ratings, _getRatingDict(), null);
        
        var reportInfo = _getReportInfo(rno);
        dlg.scope.options = {year: _getYearOptions(), term: _getTermOptions(), rating: _getRatingOptions()};
        dlg.scope.data = {year: reportInfo.year, term: reportInfo.term, 
            summary: reportInfo.summary, obsSelected: obsSelected};
        dlg.scope.error = {};

        var previewButton = {text: nl.t('Toggle preview'), onTap: function(e) {
            if (e) e.preventDefault();
            _togglePreviewMode(dlg.scope);
        }};
        var saveButton = {text: nl.t('Save'), onTap: function(e) {
            _onSaveReport(e, dlg.scope);
        }};
        var cancelButton = {text : nl.t('Cancel')};
        dlg.show(template, [previewButton, saveButton], cancelButton);
    }
    
    function _togglePreviewMode(dlgScope) {
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
        _updateDataInServer(rno);
    }

    function _validateReportInputs(scope) {
        scope.error = {};
        if (!_validateMandatoryAttr(scope, 'summary')) return false;
        return true;
    }

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
    
    var saveStatus = {};
    function _updateDataInServer(rno) {
        nlDlg.showLoadingScreen();
        if (!(rno.id in saveStatus)) saveStatus[rno.id] = {saveSent: 0, saved: 0};
        saveStatus[rno.id].saveSent++;
        var saveNumber = saveStatus[rno.id].saveSent;
        nlServerApi.rnoUpdateData(rno.id, rno.data).then(function(updatedRno) {
            nlDlg.hideLoadingScreen();
            saveStatus[rno.id].saved = saveNumber;
        });
    }
    
    function MsTree(milestones, usertype, ratings, ratingDict, defaultRating) {
        this.idToPos = {};
        this.items = [];
        _init(this);
        
        this.getItems = function() {
            return this.items;
        };
        
        this.getSelectedRatings = function() {
            var ratings = {};
            for(var i=0; i<this.items.length; i++) {
                var item = this.items[i];
                if (!item.rating || !item.rating.id) continue;
                ratings[item.milestone] = item.rating.id;
            }
            return ratings;
        };
        
        this.onFolderClick = function(folder) {
            if (!folder.isFolder) reuturn;
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

        this.showFiltered = function(folder, showSelected) {
            if (!folder.isFolder) reuturn;
            for(var i=0; i<this.items.length; i++) {
                var item = this.items[i];
                if (_isAnsistor(item, folder)) continue;
                if (_isAnsistor(folder, item)) {
                    if (showSelected && item.selectCnt > 0 || !showSelected && item.deselectCnt> 0) {
                        item.isShown = true;
                        if (item.isFolder) item.isFolderOpen = true;
                        continue;
                    }
                }
                item.isShown = false;
                if (item.isFolder) item.isFolderOpen = false;
            }
        };

        this.onRatingChange = function(ms) {
            if (ms.rating.id && ms.selectCnt == 0) {
                _changeSelectCnt(this, ms.id, 1);
            } else if (!ms.rating.id && ms.deselectCnt == 0) {
                _changeSelectCnt(this, ms.id, -1);
            }
        };

        function _init(self) {
            var rootName = '_root';
            _addItem(self, {id: rootName, text: nl.t('All milestones'), parent: null,
                isShown: true, isFolder: true, indentation: 0,
                isFolderOpen: true, selectCnt: 0, deselectCnt: 0});
            for (var i=0; i<milestones.length; i++) {
                var m = milestones[i];
                if (m.usertype != usertype) continue;
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
                    milestone: m.id, rating: rating, selectCnt: 0, deselectCnt: 0});
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
            return (me.id.indexOf(other.id) == 0);
        }
        
        function _isParent(other, me) {
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
}];

function _simpleElemDirective(viewName) {
    return [function(){
        return {restrict: 'E', templateUrl: 'view_controllers/rno/' + viewName};
    }];
}

module_init();
})();

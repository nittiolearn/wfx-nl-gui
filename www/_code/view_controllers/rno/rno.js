(function() {

//-------------------------------------------------------------------------------------------------
// rno.js:
// rno - Rating and observation module
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.rno', [])
	.config(configFn)
	.controller('nl.RnoMyCtrl', RnoMyCtrl);
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
            _newObservation($scope, card);
        } else if (internalUrl === 'rno_report') {
            _editReport($scope, card);
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
	
	function _createCard(rno) {
		_rnoDict[rno.id] = rno;
	    var card = {rnoId: rno.id,
	                title: nl.fmt2('{} {}', rno.first_name, rno.last_name), 
					icon: rno.image || nl.url.resUrl('user.png'), 
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

        link = {title: nl.t('Edit report'), 
                    internalUrl: 'rno_report',
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
        var utOptions = _getUserTypeOptions();
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
        modifyDlg.scope.data.options = {user_type: utOptions};
		
		var buttons = [];
		var saveName = (rnoId !== null) ? nl.t('Save') : nl.t('Create');
		var saveButton = {
			text : saveName,
			onTap : function(e) {
				_onSave(e, $scope, modifyDlg, rnoId);
			}
		};
		buttons.push(saveButton);
		var cancelButton = {text : nl.t('Cancel')};
		modifyDlg.show('view_controllers/rno/rno_create_dlg.html',
			buttons, cancelButton, false);
	}
	
    function _getUserTypeOptions() {
        var options = [];
        var opts = _metadata.user_model.user_type.values;
        for (var i=0; i<opts.length; i++) {
            options.push({name: opts[i], id: opts[i]});
        }
        return options;
    }

	function _onSave(e, $scope, modifyDlg, rnoId) {
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

    function _newObservation($scope, card) {
        var rno = _rnoDict[card.rnoId];
        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-width-max nl-height-max');
        dlg.scope.error = {};
        dlg.scope.dlgTitle = nl.t('New observation: {} {}', rno.first_name, rno.last_name);
        dlg.scope.data = {milestone: '', rating: {id: 'expected'}, observation: '', // TODO-MUNNI - metadata
                          notes: '', attachments: ''};
        dlg.scope.data.options = {
            milestone: _getMilestoneOptions(rno.user_type), 
            rating: _metadata.ratings};
        
        var saveButton = {
            text : nl.t('Create'),
            onTap : function(e) {
                _onNewObservation(e, $scope, dlg, rnoId);
            }
        };
        var cancelButton = {text : nl.t('Cancel')};
        dlg.show('view_controllers/rno/rno_observe_new.html', [saveButton], cancelButton);
    }

    function _getMilestoneOptions(usertype) {
        var milestones = _metadata.milestones;
        var ms = [];
        for (var i=0; i<milestones.length; i++) {
            var m = milestones[i];
            if (m.usertype != usertype) continue;
            var grp = nl.fmt2('{}: {}', m.group1, m.group2);
            ms.push({id: m.id, name: m.name, group: grp});
        }
        return ms;
    }

    function _getMilestoneTree(usertype, ratings) {
        var milestones = _metadata.milestones;
        var msTree = {g1Names:[], g1ToG2Names:{}, g2ToMilestones:{}};
        for (var i=0; i<milestones.length; i++) {
            var m = milestones[i];
            if (m.usertype != usertype) continue;
            if (!(m.group1 in msTree.g1ToG2Names)) {
                msTree.g1ToG2Names[m.group1] = [];
                msTree.g1Names.push(m.group1);
            }
            if (!(m.group2 in msTree.g2ToMilestones)) {
                msTree.g2ToMilestones[m.group2] = [];
                msTree.g1ToG2Names[m.group1].push(m.group2);
            }
            msTree.g2ToMilestones[m.group2].push({name:m.name, achievement:ratings[1]});
        }
        return msTree;
    }

    function _editReport($scope, card) {
        var rno = _rnoDict[card.rnoId];

        var d1 = nl.fmt.jsonDate2Str('2015-11-03', 'date');
        var d2 = nl.fmt.jsonDate2Str('2015-10-23', 'date');
        var d3 = nl.fmt.jsonDate2Str('2015-10-06', 'date');
        var observations = [
            {date: d1, text: "Rama enjoys playing on the slide. Today she climbed up the slide and jumping from the top of the slide."},
            {date: d2, text: "Rama read the 'Animals' book today. She is able to read words and simple sentences with assistance."},
            {date: d3, text: "Rama picked up the toys after playing, counted them and placed them in the shelf."}
        ];
        var summary = 'Rama enjoys circle time every day. Rama is able to read words and simple sentences with assistance. She loves reading the same set of books every day. She is able to count from 1 to 10.';
        var msTree = _getMilestoneTree(rno.user_type, _metadata.ratings);
        var data = {rno: rno, metadata: _metadata, msTree: msTree, achievements: _metadata.ratings, summary:summary, observations:observations};
        var template = 'view_controllers/rno/rno_edit_report.html';

        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-height-max nl-width-max');
        dlg.scope.user_model = _metadata.user_model;
        dlg.scope.rno = rno;
        dlg.scope.data = data;
        dlg.scope.error = {};
        dlg.scope.dlgTitle = nl.t('Edit report: {} {}', rno.first_name, rno.last_name);
        dlg.scope.data.options = {
            milestone: _getMilestoneOptions(rno.user_type), 
            rating: _metadata.ratings};

        var viewButton = {text: nl.t('View report'), onTap: function(e) {
            if (e) e.preventDefault();
            _onViewReport(e, dlg.scope);
        }};
        var saveButton = {text: nl.t('Save'), onTap: function(e) {
            if (e) e.preventDefault();
            _onSave(e, dlg.scope);
        }};
        var reviewButton = {text: nl.t('Send for review'), onTap: function(e) {
            if (e) e.preventDefault();
            _onReview(e, dlg.scope);
        }};
        var cancelButton = {text : nl.t('Cancel')};
        dlg.show(template, [viewButton, saveButton, reviewButton], cancelButton);
    }
}];

module_init();
})();

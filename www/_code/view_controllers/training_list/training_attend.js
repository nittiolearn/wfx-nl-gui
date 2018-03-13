(function() {

//-------------------------------------------------------------------------------------------------
// training_attend.js:
// training module: learner's view of list of offline training
//-------------------------------------------------------------------------------------------------
function module_init() {
	angular.module('nl.training_attend', [])
	.config(configFn)
	.controller('nl.TrainingAttendCtrl', TrainingAttendCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {
	$stateProvider.state('app.training_attend', {
		url : '^/training_attend',
		views : {
			'appContent' : {
				templateUrl : 'view_controllers/training_list/training_attend.html',
				controller : 'nl.TrainingAttendCtrl'
			}
		}
	});
}];

//-------------------------------------------------------------------------------------------------
var TrainingAttendCtrl = ['nl', 'nlRouter', '$scope', 'nlDlg', 'nlCardsSrv', 'nlServerApi', 'nlTrainingReport',
function(nl, nlRouter, $scope, nlDlg, nlCardsSrv, nlServerApi, nlTrainingReport) {

	var _repid = null;
	function _onPageEnter(userInfo) {
		return nl.q(function(resolve, reject) {
			nl.pginfo.pageTitle = nl.t('My training');
			nlTrainingReport.init(userInfo);
            var params = nl.location.search();
            if (params.id) _repid = parseInt(params.id);
            else {
				$scope.cards = {
	                search: {placeholder: nl.t('Enter training name/description')},
	            };
	            nlCardsSrv.initCards($scope.cards);
            }
			_getDataFromServer(resolve);
		});
	}

	nlRouter.initContoller($scope, '', _onPageEnter);
	
    function _fetchMore() {
        _getDataFromServer(null, true);
    }

    var _pageFetcher = nlServerApi.getPageFetcher();
	function _getDataFromServer(resolve, fetchMore) {
        if (!fetchMore) {
            if (!_repid) nlCardsSrv.updateCards($scope.cards, {cardlist: []});
        }
        var params = _repid ? {mode: 'single', objid: _repid} : {mode: 'learner', filters: [{field: 'ctype', val: _nl.ctypes.CTYPE_TRAINING}]};
        _pageFetcher.fetchPage(nlServerApi.learningReportsGetList, params, fetchMore, function(results) {
            if (!results) {
                if (resolve) resolve(false);
                return;
            }
            var records = [];
            for (var i=0; i<results.length; i++) {
            	records.push(nlTrainingReport.processRecord(results[i]));
            }
            if (_repid && records.length == 1) {
            	_setupRecordInScope(records[0]);
            } else {
				_updateTrainingCards(records);
	            nlCardsSrv.updateCards($scope.cards, 
	                {canFetchMore: _pageFetcher.canFetchMore()});
            }
            if (resolve) resolve(true);
		});
	}
	
	function _updateTrainingCards(trainingList) {
		for (var i = 0; i < trainingList.length; i++) {
			var card = _createCard(trainingList[i]);
			$scope.cards.cardlist.push(card);
		}
	}

	function _createCard(item) {
		var content = item.content;
		var help = nl.fmt2('<div>{}</div', item.statusInfo.html);
		help += nl.fmt2('<div><b>{} till {}</b></div>', nl.fmt.date2Str(content.start, 'date'),
			nl.fmt.date2Str(content.end, 'date'));
		if (item.content.kindName && item.content.name)
			help += nl.fmt2('<div>{}</div>', item.content.name);
		if (item.content.kindDesc)
			help += nl.fmt2('<div>{}</div>', item.content.kindDesc);
		if (item.content.desc)
			help += nl.fmt2('<div>{}</div>', item.content.desc);
		
		var card = {
			id : item.id,
			item : item,
			url: nl.fmt2('/#/training_attend?id={}', item.id),
			title : content.kindName || content.name,
			icon : content.moduleicon,
			start_date : content.start,
			end_date : content.end,
			help : help,
			children : [],
			details : {help: content.desc, avps: _getAvps(item)},
			links : []
		};
		card.links.push({id: 'details', text: nl.t('details')});
		return card;
	}
	
	function _getAvps(item) {
		var content = item.content;
		var avps = [];
		if (content.kindName) nl.fmt.addAvp(avps, 'Training Name', content.kindName);
		if (content.name) nl.fmt.addAvp(avps, 'Batch Name', content.name);
		if (content.start) nl.fmt.addAvp(avps, 'From', content.start, 'minutes');
		if (content.end) nl.fmt.addAvp(avps, 'Till', content.end, 'minutes');
		if (content.trainername) nl.fmt.addAvp(avps, 'Trainer', content.trainername);
		if (content.venue) nl.fmt.addAvp(avps, 'Venue', content.venue);
		if (content.kindDesc) nl.fmt.addAvp(avps, 'Training Description', content.kindDesc);
		if (content.desc) nl.fmt.addAvp(avps, 'Batch Description', content.desc);
		return avps;
	}

	function  _setupRecordInScope(record) {
    	var content = record.content;
		nl.pginfo.pageTitle = 'Training: ' + content.kindName || content.name || '';
    	$scope.record = record;
    	$scope.start = content.start ? nl.fmt.date2Str(content.start, 'minutes') : '';
    	$scope.end = content.end ? nl.fmt.date2Str(content.end, 'minutes') : '';
    	$scope.kindDesc = nl.fmt.multiLineHtml(content.kindDesc);
    	$scope.desc = nl.fmt.multiLineHtml(content.desc);
	}
	
    $scope.onCardInternalUrlClicked = function(card, internalUrl) {
        $scope.onCardLinkClicked(card, internalUrl);
    };
    
    $scope.onCardLinkClicked = function(card, internalUrl) {
        if (internalUrl == 'training_assign' || internalUrl =='training_report') {
            _trainingReportView(card, internalUrl);
        } else if (internalUrl == 'training_edit') {
            _createNewTrainingModule(card, 'edit_batch');
        } else if (internalUrl == 'training_delete') {
            _deleteTrainingModule(card, card.id);
        } else if (internalUrl === 'fetch_more') {
            _fetchMore();
        }
    };
    
	$scope.onLaunchModule = function(item) {
		_getModuleInfo(item).then(function (result) {
			if (!result) return;
			var ts = item.content.trainingStatus;
	        var url = ts.childStatus == 'completed' ?  '/lesson/view_report_assign/{}' : '/lesson/do_report_assign/{}';
	        url = nl.fmt2(url, ts.childReportId);
            nl.window.location.href = url;
		});
	};
	
	function _getModuleInfo(item) {
		return nl.q(function(resolve, reject) {
			var ts = item.content.trainingStatus;
			if (ts.childReportId) {
				resolve(true);
				return;
			}
			nlDlg.showLoadingScreen();
			nlServerApi.trainingCreateChildReport({repid: item.id}).then(function(childReportId) {
				nlDlg.hideLoadingScreen();
				ts.childReportId = childReportId;
				ts.childStatus = 'pending';
				resolve(true);
			});
		});
	}

}];

module_init();
})();

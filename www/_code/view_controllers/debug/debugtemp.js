(function() {

//-------------------------------------------------------------------------------------------------
// debugtemp.js:
// Temp module for experimentation
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.debugtemp', [])
    .config(configFn)
    .controller('nl.DebugTempCtrl', DebugTempCtrl);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider',
function($stateProvider) {
    $stateProvider.state('app.debugtemp', {
        url : '^/debugtemp',
        views : {
            'appContent' : {
                templateUrl : 'view_controllers/debug/debugtemp.html',
                controller : 'nl.DebugTempCtrl'
            }
        }
    });
}];

//-------------------------------------------------------------------------------------------------
var DebugTempCtrl = ['nl', 'nlRouter', 'nlSearchCacheSrv', 'nlCardsSrv', '$scope',
function(nl, nlRouter, nlSearchCacheSrv, nlCardsSrv, $scope) {
    var _itemsDict = {};
    var _userInfo = null;
    var _type = 'published_course';
    var _folder = 'grade';

    $scope.cards = [];

    function _onPageEnter(userInfo) {
        _userInfo = userInfo;
        return nl.q(function(resolve, reject) {
            nl.pginfo.pageTitle = nl.t('Debug Temp');
            _initScope();
            _getDataFromServer(resolve);
        });
    }
    nlRouter.initContoller($scope, '', _onPageEnter);

    function _initScope() {
        nlSearchCacheSrv.init();
        _initCards();
    }

    function _initCards() {
        $scope.cards = {
            staticlist: [], 
            search: {onSearch: null, placeholder: nl.t('Enter name/description')}
        };
        nlCardsSrv.initCards($scope.cards);
    }

    function _getDataFromServer(resolve) {
        nlSearchCacheSrv.getItems(_type).then(function(itemsDict, canFetchMore) {
            _itemsDict = itemsDict;
            _updateCards();
            if (resolve) resolve(true);
        });
    }

    function _updateCards() {
		var cards = [];
		for (var itemId in _itemsDict) {
            var card = _createCard(_itemsDict[itemId]);
            if (!card) continue;
			cards.push(card);
		}
		nlCardsSrv.updateCards($scope.cards, {
			cardlist: cards,
			canFetchMore: nlSearchCacheSrv.canFetchMore()
		});
    }

	function _createCard(item) {
        if (_type == 'published_course') return _createPublishedCourseCard(item);
        return null;
    }

    function _createPublishedCourseCard(course) {
		var url = nl.fmt2('#/course_view?id={}&mode=published', course.id);
	    var card = {courseId: course.id,
	    			title: course.name, 
					url: url,
					authorName: course.authorname,
					blended: course.blended || false,
					help: course.description,
					json: angular.toJson(course, 0),
					grp: course.grp,
					children: []};
		if (course.icon && course.icon.indexOf('icon:') == 0) {
			var icon2 = course.icon.substring(5);
			if (!icon2) icon2='ion-ios-bookmarks fblue';
			card.icon2 = icon2;
		} else {
			card.icon = course.icon;
		}

		card.details = {help: card.help, avps: _getCourseAvps(course)};
		card.links = [];
        card.links.push({id: 'course_assign', text: nl.t('assign')});
        card.links.push({id: 'course_report', text: nl.t('report')});
		card.links.push({id: 'details', text: nl.t('details')});
		return card;
	}

	function  _getCourseAvps(course) {
		var avps = [];
		_populateLinks(avps);
		nl.fmt.addAvp(avps, 'Name', course.name);
		nl.fmt.addAvp(avps, 'Author', course.authorname);
		nl.fmt.addAvp(avps, 'Group', course.grpname);
		nl.fmt.addAvp(avps, _userInfo.groupinfo.gradelabel, course.grade);
		nl.fmt.addAvp(avps, _userInfo.groupinfo.subjectlabel, course.subject);
		nl.fmt.addAvp(avps, 'Updated by', course.updated_by_name);
		nl.fmt.addAvp(avps, 'Created on', course.created, 'date');
		nl.fmt.addAvp(avps, 'Updated on', course.updated, 'date');
		nl.fmt.addAvp(avps, 'Published on', course.published, 'date');
		nl.fmt.addAvp(avps, 'Is published?', course.is_published, 'boolean');
		nl.fmt.addAvp(avps, 'Description', course.description);
		nl.fmt.addAvp(avps, 'Internal identifier', course.id);
		return avps;
	}

	function _populateLinks(avps) {
		var isAdmin = nlRouter.isPermitted(_userInfo, 'admin_user');
		var isApproverInPublished = _userInfo.permissions.lesson_approve;
		if (!isAdmin && !isApproverInPublished) return;
		var linkAvp = nl.fmt.addLinksAvp(avps, 'Operation(s)');
		nl.fmt.addLinkToAvp(linkAvp, 'copy', null, 'course_copy');
		if (isApproverInPublished) nl.fmt.addLinkToAvp(linkAvp, 'change owner', null, 'change_owner');
		if (isAdmin) nl.fmt.addLinkToAvp(linkAvp, 'course modify', null, 'course_modify');
	}
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

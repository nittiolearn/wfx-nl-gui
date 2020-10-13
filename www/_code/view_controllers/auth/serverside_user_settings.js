(function() {

//-------------------------------------------------------------------------------------------------
// serverside_user_settings.js: Service to update user settings
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.auth.serverside_user_settings', [])
    .config(configFn)
    .service('nlServerSideUserSettings', nlServerSideUserSettings);
}

//-------------------------------------------------------------------------------------------------
var configFn = ['$stateProvider',
function($stateProvider) {
}];

//-------------------------------------------------------------------------------------------------
var nlServerSideUserSettings = ['nl', 'nlDlg', 'nlServerApi',
function(nl, nlDlg, nlServerApi) {
    var self = this;

    this.getQuestionString = function(q) {
        return _getSecurityQuestionString(q);
    };

    this.updateSecurityQuestionsIfNeeded = function($scope, userInfo) {
        return nl.q(function(resolve, reject) {
            if (!userInfo) return resolve(false);
            var notNeeded = userInfo.settings && userInfo.settings.securityQuestions;
            notNeeded = notNeeded && _validateObjDate(userInfo.settings.securityQuestions);
            if (notNeeded) return resolve(true);
            _updateSettings($scope, userInfo, 'sec_questions', resolve);
        });
    };

    this.updateSettings = function($scope, userInfo) {
        return nl.q(function(resolve, reject) {
            _updateSettings($scope, userInfo, 'all', resolve);
        });
    };

    this.canUpdateSettings = function(userInfo) {
        return userInfo && userInfo.groupinfo && userInfo.groupinfo.passwordSelfRecover;
    };

    function _updateSettings($scope, userInfo, launchMode, resolve) {
        if (!self.canUpdateSettings(userInfo)) return resolve(false);
        var seqQuestionsInScope = _getSecurityQuestionsFromSettings(userInfo.settings);
        var dlg = _createSetttingsDlg($scope, launchMode, seqQuestionsInScope);

        var updateButton = {text : 'Update', onTap : function(e) {
            if (!_validateScopeDate(dlg)) {
                e.preventDefault();
                return;
            }
            var settings = userInfo.settings || {};
            _setSecurityQuestionsInSettings(settings, dlg.scope.seqQuestionsInScope);
            _updateDataOnServer(settings, resolve);
        }};
        var buttons = [];
        var cancelButton = null;
        if (launchMode == 'all') {
            buttons.push(updateButton);
            cancelButton = {text : nl.t('Cancel'), onTap: function(e) {
                resolve(false);
            }};
        } else {
            cancelButton = updateButton;
        }
        dlg.show('view_controllers/auth/serverside_user_settings.html', buttons, cancelButton);
    }

    var NOPTIONS = 3;
    function _getSecurityQuestionsFromSettings(settings) {
        var seqQuestionsInObj = (settings || {}).securityQuestions || {};
        var seqQuestionsInScope = [];
        var nCount = 0;
        for (var q in seqQuestionsInObj) {
            var seqQuestionInScope = {q: {id: q}, a: ''}; //a: seqQuestionsInObj[q] --> a: "" in issue #2060
            seqQuestionsInScope.push(seqQuestionInScope);
            nCount++;
            if (nCount == NOPTIONS) break;
        }

        for(var i=nCount; i<NOPTIONS; i++) {
            seqQuestionsInScope.push({q: {id: ''}, a: ''});
        }
        return seqQuestionsInScope;
    }

    function _setSecurityQuestionsInSettings(settings, seqQuestionsInScope) {
        settings.securityQuestions = {};
        for (var i=0; i<seqQuestionsInScope.length; i++) {
            var item = seqQuestionsInScope[i];
            settings.securityQuestions[item.q.id] = item.a;
        }
    }

    function _createSetttingsDlg($scope, launchMode, seqQuestionsInScope) {
        var dlg = nlDlg.create($scope);
        dlg.setCssClass('nl-width-max');
        dlg.scope.launchMode = launchMode;
        dlg.scope.dlgTitle = (launchMode == 'sec_questions') ? 'Choose your security questions' : 'Settings';
        dlg.scope.seqQuestionsInScope = seqQuestionsInScope;
        _updateSecurityQuestionsInScope(dlg, -1);

        dlg.scope.onSecurityQuestionChange = function(changedPos) {
            _updateSecurityQuestionsInScope(dlg, changedPos);
        }
        return dlg;
    }
    
    function _updateSecurityQuestionsInScope(dlg, changedPos) {
        var seqQuestionsInScope = dlg.scope.seqQuestionsInScope;
        for (var i=0; i<seqQuestionsInScope.length; i++) {
            var seqQuestionInScope = seqQuestionsInScope[i];

            var alreadySelectedQuestions = [];
            for(var j=0; j<i; j++) alreadySelectedQuestions.push(seqQuestionsInScope[j].q.id);
            seqQuestionInScope.qOptions = _getSecurityQuestions(alreadySelectedQuestions);
            var changeQuestion = !_isQuestionPresent(seqQuestionInScope.qOptions, seqQuestionInScope.q.id);
            if (changeQuestion) seqQuestionInScope.q = seqQuestionInScope.qOptions[0];
            if (changedPos == i || changeQuestion) seqQuestionInScope.a = '';
        }
    }
    
    function _validateScopeDate(dlg) {
        var knownQs = {};
        var seqQuestionsInScope = dlg.scope.seqQuestionsInScope;
        for (var i=0; i<seqQuestionsInScope.length; i++) {
            var currentItem = seqQuestionsInScope[i];
            if (currentItem.a == "CLEAR_FOR_TESTING") {
                // This is only for internal testing (Send answer to first question as CLEAR_FOR_TESTING)
                // to delete all items
                dlg.scope.seqQuestionsInScope = [];
                return true;
            }
            if (currentItem.q.id in knownQs) {
                nlDlg.popupAlert({title: 'Error', template: nl.fmt2('You need to choose {} distinct questions.', NOPTIONS)});
                return false;
            }
            if (!currentItem.a) {
                nlDlg.popupAlert({title: 'Error', template: nl.fmt2('Please enter answer to question {}.', i+1)});
                return false;
            }
        }
        return true;
    }

    function _validateObjDate(seqQuestionsInObj) {
        if (Object.keys(seqQuestionsInObj).length != NOPTIONS) return false;
        for (var q in seqQuestionsInObj) {
            var bFound = false;
            for (var i=0; i<_questions.length; i++) {
                if (_questions[i].id == q) {
                    bFound = true;
                    break;
                }
            }
            if (!bFound) return false;
        }
        return true;
    }


    function _updateDataOnServer(settings, resolve) {
        nlDlg.showLoadingScreen();
        nlServerApi.authUpdateSettings(settings).then(function(result) {
            nlDlg.hideLoadingScreen();
            resolve(true);
        }, function() {
            resolve(false);
        })
    }

    var _questions = [
        {id: 'mother', name: 'What is your mother’s maiden name?'},
        {id: 'company', name: 'What was the first company that you worked for?'},
        {id: 'city', name: 'What city were you born in?'},
        {id: 'school', name: 'Which high school did you go to?'},
        {id: 'college', name: 'Which college did you go to?'},
        {id: 'pet', name: 'What was the name of your favorite pet?'},
        {id: 'vacation', name: 'Where is your favorite place to vacation?'},
        {id: 'number', name: 'What is your favorite number?'},
        {id: 'book', name: 'What is your favorite book?'},
        {id: 'movie', name: 'What is your favorite movie?'},
        {id: 'movie_star', name: 'Who is your favorite movie star?'},
        {id: 'food', name: 'What is your favorite food?'},
        {id: 'drink', name: 'What is your favorite drink?'}
    ];

    function _getSecurityQuestionString(q) {
        for (var i=0; i<_questions.length; i++) {
            var item = _questions[i];
            if (item.id == q) return item.name;
        }
        return null;
    }

    function _getSecurityQuestions(notList) {
        if (!notList) notList = [];
        var ret = [];
        for (var i=0; i<_questions.length; i++) {
            var item = _questions[i];
            var dontAdd = false;
            for (var j=0; j<notList.length; j++) {
                if (item.id != notList[j]) continue;
                dontAdd = true;
                break;
            }
            if (dontAdd) continue;
            ret.push(item);
        }
        return ret;
    }

    function _isQuestionPresent(options, q) {
        if (!q) return false;
        for (var i=0; i<options.length; i++) if (options[i].id == q) return true;
        return false;
    }
}];
    

//-------------------------------------------------------------------------------------------------
module_init();
}());

(function() {

    //-------------------------------------------------------------------------------------------------
    // report_helper.js:
    // Common code to process db.report record is placed here. This is used in learning_reports, 
    // learner_view and course_view for status computation and processing the content of report
    // records.
    // To begin with the status computation of course reports are available here.
    //
    // Allowed itemInfo.rawStatus: pending, started, failed, success, partial_success
    // Allowed item states: pending, started, failed, success, partial_success, waiting, delayed
    // Allowed course states: pending, started, failed, certified, passed, done, attrition*, custom-states
    // Attrition* are equivalent to failed
    // CustomStates are equivalent to started
    //-------------------------------------------------------------------------------------------------
    function module_init() {
        angular.module('nl.learner_records_cache', [])
        .service('nlLearnerRecordsCache', NlLearnerRecordsCache);
    }
    
    //-------------------------------------------------------------------------------------------------
    var NlLearnerRecordsCache = ['nl', 'nlConfig', 'nlServerApi',
    function(nl, nlConfig, nlServerApi) {
        var _saveToDb = function(resultset) {
            return nl.q(function(resolve,reject){
                nlConfig.saveToDb('learning_records', resultset);
            })
        };
        var _loadFromDb = function() {
            return nl.q(function(resolve, reject){
                nlConfig.loadFromDb('l', function(data){
                resolve(data);
            })
            });
        };
        var _getLearningRecordsFromDb = function(){
            return nl.q(function(resolve, reject){
                _loadFromDb().then(
                function(data){
                    var res = {};
                    res.resultset = data;
                    res.nextstartpos = null;
                    res.more = false;
                    resolve(res);
            });
        })};
        
        var _getLearningRecordsFromServer = function(resolve, reject) {
            return nl.q(function(resolve, reject){
                var res = {};
                res.resultset = [];
                res.more = true;
                res.nextstartpos = null;
                var _pageFetcher = nlServerApi.getPageFetcher({defMax: 100, itemType: 'learning record cache'});
                var params = {containerid: 0, type: 'all', assignor: 'all', learner: 'me', nextstartpos: null};
                _pageFetcher.fetchPage(nlServerApi.learningReportsGetList, params, res.more, function(results, _, resp) {
                    res.resultset = results;
                    res.more = resp.more;
                    res.nextstartpos = resp.nextstartpos;
                    _saveToDb(results);
                    resolve(res);
                });
            });
        };
        this.getLearningRecordsFromDbOrServer = function(data) {
            return nl.q(function(resolve, reject){
                resolve(_getLearningRecordsFromDb().then(
                    function(res) {
                        if (res.resultset){
                            return res;
                        }else{
                            return _getLearningRecordsFromServer(resolve,reject);
                        }
                    }
                ));
            });
        };
    }];

    //-------------------------------------------------------------------------------------------------
    module_init();
    })();
    
(function() {

//-------------------------------------------------------------------------------------------------
// All Server side interfaces are collected in a single service
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.db', [])
    .service('nlDb', NlDb);
}

//-------------------------------------------------------------------------------------------------
var NlDb = ['nlLog', 'nlRes', '$http',
function(nlLog, nlRes, $http) {
    var lessonSchema = {
      name: 'lesson',
      key: 'id',
      autoIncrement: false
    };
    var schema = {stores: [lessonSchema], version: 1};
    var db = new ydn.db.Storage('nl_db', schema);
    
    this.get = function() {
        return db;
    };
    
    this.clearDb = function() {
        console.log('db.clear');
        db.clear();
    };
}];

//-------------------------------------------------------------------------------------------------
module_init();
})();

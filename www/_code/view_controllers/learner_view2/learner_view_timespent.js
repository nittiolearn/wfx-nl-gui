(function() {

    //-------------------------------------------------------------------------------------------------
    // learner_view_timespent.js: Process and store a list of learner assignment records
    //-------------------------------------------------------------------------------------------------
    function module_init() {
        angular.module('nl.learner_view_timespent', [])
        .service('nlLearnerViewTimeSpent', NlLearnerViewTimeSpent);
    }

    var NlLearnerViewTimeSpent = ['nl', 'nlLearnerViewRecords2',
    function(nl, nlLearnerViewRecords2 ) {
        this.show = function () {
            return NlTimeSpentImplement(nlLearnerViewRecords2);
        };
    }];

    function NlTimeSpentImplement(nlLearnerViewRecords2) {
		var updatedDate = [];
		var records = nlLearnerViewRecords2.getRecords();
		for (var recid in records) {
				updatedDate.push({'updatedate' : records[recid].raw_record.updated, 'timespent': records[recid].stats.timeSpentSeconds});
		}
		sortByUpdatedDate(updatedDate);
		return timespentEachSection(updatedDate);
	}

	function sortByUpdatedDate(records) {
		records.sort(function(a, b) {
			var dateA = new Date(a.updatedate), dateB = new Date(b.updatedate);
			return dateB - dateA;
		});
	}

	function timespentEachSection(updatedDate) {
		var currDate = new Date();
		currDate.setDate(currDate.getDate() - 7)
		var sevendayagodate = new Date(currDate.toLocaleString().split(',')[0]);
		currDate.setDate(currDate.getDate() - 23);
		var thirtydayagodate = new Date(currDate.toLocaleString().split(',')[0]);
		currDate.setDate(currDate.getDate() - 60);
		var nintydayagodate = new Date(currDate.toLocaleString().split(',')[0]);

        var tsnintydays = 0, tsthirtydays=0, tssevendays=0;
		for(var i=0 ; i<updatedDate.length;i++) {
			var lstupdateDate = new Date(updatedDate[i].updatedate.toLocaleString().split(',')[0]);
			if(sevendayagodate <= lstupdateDate) tssevendays += updatedDate[i].timespent;
				else if(thirtydayagodate <=lstupdateDate) {
					tsthirtydays += updatedDate[i].timespent;
				}
				else if(nintydayagodate <= lstupdateDate) {
					tsnintydays += updatedDate[i].timespent;
				}	
			else break;	
		}
		tsthirtydays = tsthirtydays + tssevendays;
		tsnintydays = tsthirtydays + tsnintydays;
		return [Math.round(tsnintydays/60) , Math.round(tsthirtydays/60), Math.round(tssevendays/60)]
	}

//-------------------------------------------------------------------------------------------------
module_init();
})();
console.log('Hello 1');

function thisWillBeCalled() {
    var a=1;
    for (var i=0; i<100; i++) {
        a=a+1;
    }
    return 6;
}

describe('A suite', function() {
    it('contains spec with an expectation', function() {
        thisWillBeCalled();
        expect(true).toBe(true);
    });
}); 


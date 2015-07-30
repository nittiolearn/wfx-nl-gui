"use strict";

describe('Test suite for app.js', function() {
    beforeEach(angular.mock.module('nl.app'));

    var nl = null;
    describe('Test sub-suite for nl.AppCtrl', function() {
        var $scope = null;
        beforeEach(angular.mock.inject(function($controller, _nl_, nlKeyboardHandler, nlServerApi, nlRouter) {
            var c = $controller;
            nl = _nl_;
            $scope = nl.rootScope.$new();
            var controller = $controller('nl.AppCtrl', {
                'nl' : nl,
                '$scope' : $scope,
                'nlKeyboardHandler' : nlKeyboardHandler,
                'nlServerApi': nlServerApi,
                'nlRouter': nlRouter
            });
        }));

        it('nl.AppCtrl basic check', function() {
            expect(true).toBe(true);
        });
    });
});


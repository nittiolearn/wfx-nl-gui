"use strict";

describe('Test suite for app.js', function() {
    beforeEach(angular.mock.module('nl.app'));

    var location = null;
    describe('Test sub-suite for nl.AppCtrl', function() {
        var $scope = null;
        beforeEach(angular.mock.inject(function($controller, $rootScope, nl, $stateParams, 
                                                $location, nlDlg, nlKeyboardHandler) {
            var c = $controller;
            $scope = $rootScope.$new();
            location = $location;
            var controller = $controller('nl.AppCtrl', {
                'nl' : nl,
                '$scope' : $scope,
                '$stateParams' : $stateParams,
                '$location' : $location,
                'nlDlg' : nlDlg,
                'nlKeyboardHandler' : nlKeyboardHandler
            });
        }));

        it('nl.AppCtrl should set logo', function() {
            expect($scope.logo).toBe('img/top-logo.png');
        });
        it('nl.AppCtrl should set title', function() {
            expect($scope.title).toBe('Nittio Learn');
        });
        it('nl.AppCtrl should set location onHomeClick', function() {
            $scope.onHomeClick();
            expect(location.path()).toBe('/#');
        });
    });
});


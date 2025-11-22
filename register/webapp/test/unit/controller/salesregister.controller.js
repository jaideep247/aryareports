/*global QUnit*/

sap.ui.define([
	"register/controller/salesregister.controller"
], function (Controller) {
	"use strict";

	QUnit.module("salesregister Controller");

	QUnit.test("I should test the salesregister controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});

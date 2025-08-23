/*global QUnit*/

sap.ui.define([
	"gsttax/controller/gsttaxreport.controller"
], function (Controller) {
	"use strict";

	QUnit.module("gsttaxreport Controller");

	QUnit.test("I should test the gsttaxreport controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});

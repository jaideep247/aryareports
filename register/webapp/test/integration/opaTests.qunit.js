/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["register/test/integration/AllJourneys"
], function () {
	QUnit.start();
});

sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("gsttax.controller.App", {
        onInit: function () {
            // Initialize app-level configurations
            this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
        }
    });
});
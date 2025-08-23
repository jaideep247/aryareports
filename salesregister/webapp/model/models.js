sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
],
    function (JSONModel, Device) {
        "use strict";

        return {
            /**
             * Provides runtime information for the device the UI5 app is running on as a JSONModel.
             * @returns {sap.ui.model.json.JSONModel} The device model.
             */
            createDeviceModel: function () {
                var oModel = new JSONModel(Device);
                oModel.setDefaultBindingMode("OneWay");
                return oModel;
            },

            /**
             * Creates a view model for the sales register application
             * @returns {sap.ui.model.json.JSONModel} The view model.
             */
            createViewModel: function () {
                var oModel = new JSONModel({
                    dateFrom: null,
                    dateTo: null,
                    plantFilter: "",
                    materialFilter: "",
                    salesData: [],
                    busy: false,
                    selectedCount: 0
                });

                // Initialize filter model with current date - 30 days
                var oToday = new Date();
                var oFromDate = new Date(oToday.getTime() - (30 * 24 * 60 * 60 * 1000));
                oModel.setProperty("/dateFrom", oFromDate);
                oModel.setProperty("/dateTo", oToday);

                return oModel;
            }
        };
    });
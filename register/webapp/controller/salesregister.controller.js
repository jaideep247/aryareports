sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v2/ODataModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, JSONModel, ODataModel, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("register.controller.salesregister", {
        onInit: function () {
            this._initializeModel();
            this._loadSalesData();
        },

        _initializeModel: function () {
            // Create OData model
            const oModel = new ODataModel("/sap/opu/odata/sap/YY1_SALESREGISTER_CDS/", {
                json: true,
                useBatch: false
            });

            // Set model to view
            this.getView().setModel(oModel);
        },

        _loadSalesData: function () {
            const oTable = this.byId("salesTable");
            const oModel = this.getView().getModel();

            if (oTable) {
                oTable.setBusy(true);

                // Read data from OData service
                oModel.read("/YY1_SALESREGISTER", {
                    urlParameters: {
                        "$top": 100, // Limit to 100 records
                        "$orderby": "BillingDocumentDate desc" // Latest first
                    },
                    success: function (oData) {
                        oTable.setBusy(false);
                        MessageToast.show("Data loaded successfully");
                    },
                    error: function (oError) {
                        oTable.setBusy(false);
                        MessageBox.error("Error loading data: " + oError.message);
                    }
                });
            }
        },

        onRefresh: function () {
            MessageToast.show("Refreshing data...");
            this._loadSalesData();
        },

        onOpenFilterDialog: function () {
            // Simple filter implementation - you can enhance this with a proper dialog
            const oTable = this.byId("salesTable");
            const oBinding = oTable.getBinding("rows");

            if (oBinding) {
                // Example: Filter for specific tax codes
                const aFilters = [
                    new sap.ui.model.Filter("TaxCode", sap.ui.model.FilterOperator.Contains, "V0")
                ];
                oBinding.filter(aFilters);
                MessageToast.show("Filter applied");
            }
        },

        onExportToExcel: function () {
            // Export functionality
            const oTable = this.byId("salesTable");

            if (oTable) {
                oTable.exportToExcel({
                    workbook: {
                        columns: [
                            { property: "BillingDocument", title: "Billing Document" },
                            { property: "BillingDocumentDate", title: "Invoice Date" },
                            { property: "BusinessPartnerName1", title: "Customer Name" },
                            { property: "TotalNetAmount", title: "Net Amount" },
                            { property: "TransactionCurrency", title: "Currency" }
                        ]
                    },
                    fileName: "Sales_Register_Export.xlsx",
                    worker: false
                });
            }
        }
    });
});
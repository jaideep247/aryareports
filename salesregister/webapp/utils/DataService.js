sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Filter, FilterOperator) {
    "use strict";

    return {
        /**
         * Performs a GET request to read sales register data
         * @param {sap.ui.model.odata.v2.ODataModel} oModel - The OData model
         * @param {Array} aFilters - Array of filters to apply
         * @returns {Promise} Promise that resolves with the data
         */
        readSalesRegisterData: function (oModel, aFilters) {
            return new Promise(function (resolve, reject) {
                // GET request using OData model's read method
                oModel.read("/YY1_SALESREGISTER", {
                    filters: aFilters,
                    urlParameters: {
                        "$top": 10000, // Limit for performance
                        "$select": [
                            "BillingDocument",
                            "BillingDocumentDate",
                            "SalesDocument",
                            "BusinessPartnerName1",
                            "CustomerFullName_1",
                            "Plant",
                            "Material",
                            "BillingDocumentItemText",
                            "TotalNetAmount",
                            "TransactionCurrency",
                            "BillingQuantity",
                            "BillingQuantityUnit",
                            "Division",
                            "Region",
                            "ProfitCenter",
                            "BillingDocumentType",
                            "TaxCode",
                            "PayerParty",
                            "CustomerPaymentTerms",
                            "NetDueDate",
                            "AdditionalCustomerGroup1",
                            "AdditionalCustomerGroup2",
                            "AdditionalCustomerGroup3",
                            "AdditionalCustomerGroup4",
                            "AdditionalCustomerGroup5",
                            "Warehouse",
                            "ConditionType",
                            "ConditionAmount",
                            "Discount",
                            "ElectronicDocSourceKey",
                            "IN_EDocEInvcEWbillCreateDate"
                        ].join(",")
                    },
                    success: function (oData) {
                        resolve(oData.results || []);
                    },
                    error: function (oError) {
                        console.error("Error reading sales register data:", oError);
                        reject(new Error("Failed to load sales register data: " +
                            (oError.responseText || oError.message || "Unknown error")));
                    }
                });
            });
        },

        /**
         * Performs a GET request to read sales order text data
         * @param {sap.ui.model.odata.v2.ODataModel} oModel - The OData model
         * @param {string} sSalesOrder - Sales order number
         * @returns {Promise} Promise that resolves with the text data
         */
        readSalesOrderText: function (oModel, sSalesOrder) {
            return new Promise(function (resolve, reject) {
                const aFilters = [
                    new Filter("SalesOrder", FilterOperator.EQ, sSalesOrder),
                    new Filter("Language", FilterOperator.EQ, "EN"),
                    new Filter("LongTextID", FilterOperator.EQ, "0001")
                ];

                // GET request using OData model's read method
                oModel.read("/A_SalesOrderText", {
                    filters: aFilters,
                    urlParameters: {
                        "$select": "SalesOrder,LongText,Language,LongTextID"
                    },
                    success: function (oData) {
                        let sText = "";
                        if (oData.results && oData.results.length > 0) {
                            sText = oData.results[0].LongText || "";
                        }
                        resolve({
                            salesOrder: sSalesOrder,
                            text: sText
                        });
                    },
                    error: function (oError) {
                        console.warn("Error reading sales order text for " + sSalesOrder + ":", oError);
                        // Don't reject, just resolve with empty text
                        resolve({
                            salesOrder: sSalesOrder,
                            text: ""
                        });
                    }
                });
            });
        },

        /**
         * Builds filters based on user input
         * @param {Object} oFilterData - Filter data object
         * @returns {Array} Array of filters
         */
        buildFilters: function (oFilterData) {
            const aFilters = [];

            // Date filters
            if (oFilterData.dateFrom) {
                aFilters.push(new Filter("BillingDocumentDate", FilterOperator.GE, oFilterData.dateFrom));
            }
            if (oFilterData.dateTo) {
                aFilters.push(new Filter("BillingDocumentDate", FilterOperator.LE, oFilterData.dateTo));
            }

            // Plant filter
            if (oFilterData.plantFilter) {
                aFilters.push(new Filter("Plant", FilterOperator.EQ, oFilterData.plantFilter));
            }

            // Material filter
            if (oFilterData.materialFilter) {
                aFilters.push(new Filter("Material", FilterOperator.Contains, oFilterData.materialFilter));
            }

            return aFilters;
        },

        /**
         * Validates the OData service connection
         * @param {sap.ui.model.odata.v2.ODataModel} oModel - The OData model
         * @returns {Promise} Promise that resolves if connection is valid
         */
        validateServiceConnection: function (oModel) {
            return new Promise(function (resolve, reject) {
                // GET request to metadata to validate connection
                oModel.attachMetadataLoaded(function () {
                    resolve();
                });

                oModel.attachMetadataFailed(function (oEvent) {
                    reject(new Error("Failed to connect to OData service"));
                });
            });
        }
    };
});
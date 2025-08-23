sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/export/library",
    "sap/ui/export/Spreadsheet",
    "../model/models"
], (Controller, MessageBox, MessageToast, JSONModel, Filter, FilterOperator, exportLibrary, Spreadsheet, models) => {
    "use strict";

    const EdmType = exportLibrary.EdmType;

    return Controller.extend("salesregister.controller.SalesRegister", {

        onInit() {
            // Initialize view model
            const oViewModel = models.createViewModel();
            this.getView().setModel(oViewModel, "viewModel");

            // Initialize OData models for the APIs
            this._initializeModels();
        },

        _initializeModels: function () {
            // Sales Register Service Model
            const oSalesRegisterModel = new sap.ui.model.odata.v2.ODataModel({
                serviceUrl: "/sap/opu/odata/sap/YY1_SALESREGISTER_CDS/",
                defaultBindingMode: "OneWay",
                defaultCountMode: "Request"
            });
            this.getView().setModel(oSalesRegisterModel, "salesRegister");

            // Sales Order Service Model
            const oSalesOrderModel = new sap.ui.model.odata.v2.ODataModel({
                serviceUrl: "/sap/opu/odata/sap/API_SALES_ORDER_SRV/",
                defaultBindingMode: "OneWay",
                defaultCountMode: "Request"
            });
            this.getView().setModel(oSalesOrderModel, "salesOrder");
        },

        onLoadData: function () {
            const oViewModel = this.getView().getModel("viewModel");

            // Show busy dialog
            this.byId("busyDialog").open();
            oViewModel.setProperty("/busy", true);

            this._loadSalesRegisterData()
                .then((aSalesData) => {
                    return this._enrichWithSalesOrderTexts(aSalesData);
                })
                .then((aEnrichedData) => {
                    oViewModel.setProperty("/salesData", aEnrichedData);
                    MessageToast.show(`Data loaded successfully. ${aEnrichedData.length} records found.`);
                })
                .catch((oError) => {
                    MessageBox.error("Error loading data: " + (oError.message || "Unknown error"));
                })
                .finally(() => {
                    this.byId("busyDialog").close();
                    oViewModel.setProperty("/busy", false);
                });
        },

        _loadSalesRegisterData: function () {
            const oSalesRegisterModel = this.getView().getModel("salesRegister");
            const aFilters = this._buildFilters();

            return new Promise((resolve, reject) => {
                oSalesRegisterModel.read("/YY1_SALESREGISTER", {
                    filters: aFilters,
                    success: function (oData) {
                        resolve(oData.results || []);
                    },
                    error: function (oError) {
                        reject(new Error("Failed to load sales register data: " + (oError.message || "Unknown error")));
                    }
                });
            });
        },

        _enrichWithSalesOrderTexts: function (aSalesData) {
            const oSalesOrderModel = this.getView().getModel("salesOrder");

            return new Promise((resolve) => {
                const aSalesOrderNumbers = [...new Set(
                    aSalesData
                        .map(item => item.SalesDocument)
                        .filter(salesDoc => salesDoc)
                )];

                if (aSalesOrderNumbers.length === 0) {
                    // No sales orders to enrich, return original data
                    const aEnrichedData = aSalesData.map(item => ({
                        ...item,
                        SalesOrderText: ""
                    }));
                    resolve(aEnrichedData);
                    return;
                }

                const aPromises = aSalesOrderNumbers.map(sSalesOrder => {
                    return new Promise((resolveText) => {
                        oSalesOrderModel.read("/A_SalesOrderText", {
                            filters: [
                                new Filter("SalesOrder", FilterOperator.EQ, sSalesOrder),
                                new Filter("Language", FilterOperator.EQ, "EN"),
                                new Filter("LongTextID", FilterOperator.EQ, "0001")
                            ],
                            success: function (oTextData) {
                                let sText = "";
                                if (oTextData.results && oTextData.results.length > 0) {
                                    sText = oTextData.results[0].LongText || "";
                                }
                                resolveText({
                                    salesOrder: sSalesOrder,
                                    text: sText
                                });
                            },
                            error: function () {
                                // Don't reject, just resolve with empty text
                                resolveText({
                                    salesOrder: sSalesOrder,
                                    text: ""
                                });
                            }
                        });
                    });
                });

                Promise.all(aPromises).then((aTexts) => {
                    // Create a map of sales order to text
                    const oTextMap = {};
                    aTexts.forEach(oTextResult => {
                        oTextMap[oTextResult.salesOrder] = oTextResult.text;
                    });

                    // Enrich the sales data with texts
                    const aEnrichedData = aSalesData.map(oItem => ({
                        ...oItem,
                        SalesOrderText: oTextMap[oItem.SalesDocument] || ""
                    }));

                    resolve(aEnrichedData);
                }).catch(() => {
                    // If text enrichment fails, return original data with empty texts
                    const aEnrichedData = aSalesData.map(oItem => ({
                        ...oItem,
                        SalesOrderText: ""
                    }));
                    resolve(aEnrichedData);
                });
            });
        },

        _buildFilters: function () {
            const oViewModel = this.getView().getModel("viewModel");
            const aFilters = [];

            // Date filters
            const oDateFrom = oViewModel.getProperty("/dateFrom");
            const oDateTo = oViewModel.getProperty("/dateTo");

            if (oDateFrom) {
                aFilters.push(new Filter("BillingDocumentDate", FilterOperator.GE, oDateFrom));
            }
            if (oDateTo) {
                aFilters.push(new Filter("BillingDocumentDate", FilterOperator.LE, oDateTo));
            }

            // Plant filter
            const sPlant = oViewModel.getProperty("/plantFilter");
            if (sPlant) {
                aFilters.push(new Filter("Plant", FilterOperator.EQ, sPlant));
            }

            // Material filter
            const sMaterial = oViewModel.getProperty("/materialFilter");
            if (sMaterial) {
                aFilters.push(new Filter("Material", FilterOperator.Contains, sMaterial));
            }

            return aFilters;
        },

        onExportToExcel: function () {
            const oViewModel = this.getView().getModel("viewModel");
            const aSalesData = oViewModel.getProperty("/salesData");

            if (!aSalesData || aSalesData.length === 0) {
                MessageBox.warning("No data available to export. Please load data first.");
                return;
            }

            try {
                this._exportToExcel(aSalesData);
            } catch (oError) {
                MessageBox.error("Error exporting to Excel: " + oError.message);
            }
        },

        _exportToExcel: function (aSalesData) {
            const aCols = this._createColumnConfig();

            const oSettings = {
                workbook: {
                    columns: aCols,
                    hierarchyLevel: 'Level'
                },
                dataSource: aSalesData,
                fileName: `SalesRegister_${this._getFormattedDate()}.xlsx`,
                worker: false
            };

            const oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(() => {
                oSheet.destroy();
                MessageToast.show("Excel file exported successfully!");
            });
        },

        _createColumnConfig: function () {
            return [
                {
                    label: 'Billing Document',
                    property: 'BillingDocument',
                    type: EdmType.String
                },
                {
                    label: 'Billing Date',
                    property: 'BillingDocumentDate',
                    type: EdmType.Date
                },
                {
                    label: 'Sales Document',
                    property: 'SalesDocument',
                    type: EdmType.String
                },
                {
                    label: 'Sales Order Text',
                    property: 'SalesOrderText',
                    type: EdmType.String
                },
                {
                    label: 'Customer Name',
                    property: 'BusinessPartnerName1',
                    type: EdmType.String
                },
                {
                    label: 'Customer Full Name',
                    property: 'CustomerFullName_1',
                    type: EdmType.String
                },
                {
                    label: 'Plant',
                    property: 'Plant',
                    type: EdmType.String
                },
                {
                    label: 'Material',
                    property: 'Material',
                    type: EdmType.String
                },
                {
                    label: 'Material Description',
                    property: 'BillingDocumentItemText',
                    type: EdmType.String
                },
                {
                    label: 'Net Amount',
                    property: 'TotalNetAmount',
                    type: EdmType.Number,
                    scale: 2
                },
                {
                    label: 'Currency',
                    property: 'TransactionCurrency',
                    type: EdmType.String
                },
                {
                    label: 'Billing Quantity',
                    property: 'BillingQuantity',
                    type: EdmType.Number,
                    scale: 3
                },
                {
                    label: 'Unit',
                    property: 'BillingQuantityUnit',
                    type: EdmType.String
                },
                {
                    label: 'Division',
                    property: 'Division',
                    type: EdmType.String
                },
                {
                    label: 'Region',
                    property: 'Region',
                    type: EdmType.String
                },
                {
                    label: 'Profit Center',
                    property: 'ProfitCenter',
                    type: EdmType.String
                },
                {
                    label: 'Billing Document Type',
                    property: 'BillingDocumentType',
                    type: EdmType.String
                },
                {
                    label: 'Tax Code',
                    property: 'TaxCode',
                    type: EdmType.String
                },
                {
                    label: 'Payer Party',
                    property: 'PayerParty',
                    type: EdmType.String
                },
                {
                    label: 'Payment Terms',
                    property: 'CustomerPaymentTerms',
                    type: EdmType.String
                },
                {
                    label: 'Net Due Date',
                    property: 'NetDueDate',
                    type: EdmType.Date
                },
                {
                    label: 'Customer Group 1',
                    property: 'AdditionalCustomerGroup1',
                    type: EdmType.String
                },
                {
                    label: 'Customer Group 2',
                    property: 'AdditionalCustomerGroup2',
                    type: EdmType.String
                },
                {
                    label: 'Customer Group 3',
                    property: 'AdditionalCustomerGroup3',
                    type: EdmType.String
                },
                {
                    label: 'Customer Group 4',
                    property: 'AdditionalCustomerGroup4',
                    type: EdmType.String
                },
                {
                    label: 'Customer Group 5',
                    property: 'AdditionalCustomerGroup5',
                    type: EdmType.String
                },
                {
                    label: 'Warehouse',
                    property: 'Warehouse',
                    type: EdmType.String
                },
                {
                    label: 'Condition Type',
                    property: 'ConditionType',
                    type: EdmType.String
                },
                {
                    label: 'Condition Amount',
                    property: 'ConditionAmount',
                    type: EdmType.Number,
                    scale: 2
                },
                {
                    label: 'Discount',
                    property: 'Discount',
                    type: EdmType.Number,
                    scale: 2
                },
                {
                    label: 'Electronic Doc Source Key',
                    property: 'ElectronicDocSourceKey',
                    type: EdmType.String
                },
                {
                    label: 'eWay Bill Creation Date',
                    property: 'IN_EDocEInvcEWbillCreateDate',
                    type: EdmType.Date
                }
            ];
        },

        _getFormattedDate: function () {
            const oDate = new Date();
            const sYear = oDate.getFullYear();
            const sMonth = String(oDate.getMonth() + 1).padStart(2, '0');
            const sDay = String(oDate.getDate()).padStart(2, '0');
            const sHours = String(oDate.getHours()).padStart(2, '0');
            const sMinutes = String(oDate.getMinutes()).padStart(2, '0');

            return `${sYear}${sMonth}${sDay}_${sHours}${sMinutes}`;
        },

        onClearFilters: function () {
            const oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/dateFrom", null);
            oViewModel.setProperty("/dateTo", null);
            oViewModel.setProperty("/plantFilter", "");
            oViewModel.setProperty("/materialFilter", "");
            oViewModel.setProperty("/salesData", []);
            MessageToast.show("Filters cleared");
        },

        onSelectAll: function () {
            const oTable = this.byId("salesTable");
            oTable.selectAll();
        },

        onDeselectAll: function () {
            const oTable = this.byId("salesTable");
            oTable.clearSelection();
        }
    });
});
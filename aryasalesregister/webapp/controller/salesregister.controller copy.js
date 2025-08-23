sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/export/Spreadsheet",
    "sap/ui/model/Sorter",
    "aryasalesregister/services/SalesOrderTextService",
    "aryasalesregister/utils/DataProcessor"
], function (
    Controller,
    JSONModel,
    MessageToast,
    MessageBox,
    Filter,
    FilterOperator,
    Spreadsheet,
    Sorter,
    SalesOrderTextService,
    DataProcessor
) {
    "use strict";

    return Controller.extend("aryasalesregister.controller.salesregister", {

        // =================== LIFECYCLE METHODS ===================
        /**
         * Initializes the controller. Sets up models, services, and validates configuration.
         */
        onInit: function () {
            console.log("🚀 Enhanced Sales Register Controller initializing...");
            this._initializeModels();
            this._initializeServices();
            this._validateConfiguration();
            console.log("✅ Controller initialized successfully");
        },

        /**
         * Cleans up resources when the controller is destroyed.
         */
        onExit: function () {
            if (this._oDocumentSearchDialog) {
                this._oDocumentSearchDialog.destroy();
            }
            if (this._oRowDetailsDialog) {
                this._oRowDetailsDialog.destroy();
            }
            if (this._salesOrderTextService) {
                this._salesOrderTextService.destroy();
            }
            if (this._dataProcessor) {
                this._dataProcessor.destroy();
            }
        },

        // =================== MODEL INITIALIZATION ===================
        /**
         * Initializes the JSON models used by the view.
         */
        _initializeModels: function () {
            // Main sales data model
            var salesDataModel = new JSONModel({
                results: [],
                count: 0,
                totalCount: 0,
                originalRecordCount: 0,
                lastLoadTime: null
            });
            this.getView().setModel(salesDataModel, "salesData");

            // Filter data model
            var filterDataModel = new JSONModel({
                billingDocument: "",
                material: "",
                region: "",
                billingDocumentType: "",
                salesOrder: "",
                customer: "",
                fromDate: null,
                toDate: null,
                amountRange: { from: "", to: "" },
                documentRange: { from: "", to: "" },
                pagingTop: 500,
                enableBatchLoading: true,
                groupByEnabled: true,
                groupingMethod: "none", // none, salesOrder, billingDoc, billingDocAndItems
                enrichWithTexts: true
            });
            this.getView().setModel(filterDataModel, "filterData");

            // Loading state model
            var loadingStateModel = new JSONModel({
                loading: false,
                currentOperation: "",
                progress: 0,
                totalSteps: 0,
                currentStep: 0
            });
            this.getView().setModel(loadingStateModel, "loadingState");

            // Pagination model
            var paginationModel = new JSONModel({
                hasMore: false,
                currentSkip: 0,
                pageSize: 500,
                totalRecords: 0,
                loadedRecords: 0
            });
            this.getView().setModel(paginationModel, "pagination");
        },

        /**
         * Initializes service classes for external data enrichment.
         */
        _initializeServices: function () {
            // Initialize Sales Order Text Service
            this._salesOrderTextService = new SalesOrderTextService(this);

            // Initialize Data Processor
            this._dataProcessor = new DataProcessor(this);
        },

        /**
         * Validates that the necessary OData models are configured correctly.
         */
        _validateConfiguration: function () {
            console.group("🔧 Validating Configuration");

            // Validate main sales model
            var salesModel = this.getView().getModel();
            if (!salesModel) {
                console.error("❌ Sales Register Model not found in view, checking component...");
                var ownerComponent = this.getOwnerComponent();
                salesModel = ownerComponent?.getModel();
                if (salesModel) {
                    this.getView().setModel(salesModel);
                    console.log("✅ Sales Register Model found in component and set to view");
                } else {
                    console.error("❌ Sales Register Model not found anywhere - check manifest.json");
                }
            }
            if (salesModel) {
                var serviceUrl = salesModel.sServiceUrl || salesModel.getServiceUrl();
                console.log("✅ Sales Register Model configured:", serviceUrl);
                salesModel.getMetaModel().loaded().then(() => {
                    console.log("✅ Sales Register Metadata loaded successfully");
                }).catch(error => {
                    console.error("❌ Sales Register Metadata failed:", error);
                });
            }

            // Validate Sales Order API model
            var salesOrderModel = this.getView().getModel("salesOrder");
            if (!salesOrderModel) {
                console.warn("⚠️ Sales Order API Model not found in view, checking component...");
                var ownerComponent = this.getOwnerComponent();
                salesOrderModel = ownerComponent?.getModel("salesOrder");
                if (salesOrderModel) {
                    this.getView().setModel(salesOrderModel, "salesOrder");
                    console.log("✅ Sales Order API Model found in component and set to view");
                } else {
                    console.warn("⚠️ Sales Order API Model not found - will proceed without text enrichment");
                }
            }
            if (salesOrderModel) {
                var soServiceUrl = salesOrderModel.sServiceUrl || salesOrderModel.getServiceUrl();
                console.log("✅ Sales Order API Model configured:", soServiceUrl);
                salesOrderModel.getMetaModel().loaded().then(() => {
                    console.log("✅ Sales Order API Metadata loaded successfully");
                }).catch(error => {
                    console.warn("⚠️ Sales Order API Metadata failed:", error);
                });
            }

            // Validate services
            if (this._salesOrderTextService) {
                this._salesOrderTextService.validateConfiguration();
            }

            console.groupEnd();
        },

        // =================== MAIN DATA LOADING ===================
        /**
         * The main method for loading data with comprehensive processing.
         */
        _loadData: function (isLoadMore, skip) {
            console.group("📊 Starting Enhanced Sales Data Load");

            var salesModel = this.getView().getModel();
            if (!salesModel) {
                MessageBox.error("Sales Register service is not configured. Please check your manifest.json file.");
                console.groupEnd();
                return;
            }

            var filterData = this.getView().getModel("filterData").getData();
            var validationErrors = this._validateFilterData(filterData);
            if (validationErrors.length > 0) {
                MessageBox.error("Filter validation failed:\n" + validationErrors.join("\n"));
                console.groupEnd();
                return;
            }

            this._setLoading(true, "Initializing data load...", 0, 4);

            if (!isLoadMore) {
                this.getView().getModel("salesData").setData({
                    results: [],
                    count: 0
                });
                this.getView().getModel("pagination").setData({
                    hasMore: false,
                    currentSkip: 0,
                    pageSize: filterData.pagingTop || 500,
                    totalRecords: 0,
                    loadedRecords: 0
                });
            }

            var currentSkip = skip || 0;
            var pageSize = filterData.pagingTop || 500;

            this._loadSalesDataWithFilters(currentSkip, pageSize)
                .then(result => this._processSalesResult(result, isLoadMore, filterData))
                .catch(error => this._handleLoadError(error))
                .finally(() => {
                    console.groupEnd();
                });
        },

        /**
         * Loads the main sales data with the specified filters and pagination.
         */
        _loadSalesDataWithFilters: function (skip, top) {
            return new Promise((resolve, reject) => {
                this._setLoading(true, "Loading sales documents...", 1, 4);
                var salesModel = this.getView().getModel();
                var filters = this._buildSalesFilters();
                var urlParameters = this._buildSalesUrlParameters(skip, top);
                var path = "/YY1_SALESREGISTER";

                salesModel.read(path, {
                    filters: filters,
                    urlParameters: urlParameters,
                    success: data => {
                        var results = data.results || [];
                        results.totalCount = data.__count;
                        results.hasNext = !!data.__next;
                        resolve(results);
                    },
                    error: error => {
                        var errorMessage = this._buildErrorMessage("Sales Data", error);
                        reject(new Error(errorMessage));
                    }
                });
            });
        },

        /**
         * Processes the loaded sales data with comprehensive options.
         */
        _processSalesResult: function (salesResult, isLoadMore, filterData) {
            if (salesResult.length === 0) {
                this._finishDataLoad([], isLoadMore, 0);
                return Promise.resolve();
            }

            this._setLoading(true, "Processing and enriching sales data...", 2, 4);

            // Determine processing options based on filter settings
            const processingOptions = {
                addComputedFields: true,
                validateData: true,
                groupData: filterData.groupingMethod !== "none",
                groupingMethod: filterData.groupingMethod,
                enrichWithTexts: filterData.enrichWithTexts && filterData.groupingMethod === "salesOrder",
                maxRecords: filterData.pagingTop || 500
            };

            return this._dataProcessor.loadAllRecords(salesResult, processingOptions)
                .then(processedData => {
                    this._finishDataLoad(processedData, isLoadMore, salesResult.totalCount);
                })
                .catch(error => {
                    console.error("❌ Error processing sales data:", error);
                    // Fallback to basic processing
                    const basicProcessedData = this._dataProcessor.addComputedFields(salesResult);
                    this._finishDataLoad(basicProcessedData, isLoadMore, salesResult.totalCount);
                });
        },

        /**
         * Finalizes the data load process by updating models and showing results.
         */
        _finishDataLoad: function (salesData, isLoadMore, totalCount) {
            this._setLoading(true, "Finalizing data load...", 4, 4);

            // Get existing data if loading more, otherwise start fresh
            var existingData = this.getView().getModel("salesData").getProperty("/results") || [];
            var finalData = isLoadMore ? existingData.concat(salesData) : salesData;

            // Update models
            var originalRecordCount = isLoadMore ?
                this.getView().getModel("pagination").getProperty("/loadedRecords") + salesData.length :
                salesData.length;

            this._updateModelsWithData(finalData, originalRecordCount, totalCount);
            this._setLoading(false);

            var message = isLoadMore ?
                `Loaded ${salesData.length} additional records` :
                `Successfully loaded ${salesData.length} records`;

            // Add grouping info to message if applicable
            var filterData = this.getView().getModel("filterData").getData();
            if (filterData.groupingMethod !== "none") {
                message += ` (grouped by ${filterData.groupingMethod})`;
            }

            MessageToast.show(message);
        },

        /**
         * Updates the salesData and pagination models with new data.
         */
        _updateModelsWithData: function (finalData, loadedRecords, totalCount) {
            var salesDataModel = this.getView().getModel("salesData");
            salesDataModel.setData({
                results: finalData,
                count: finalData.length,
                totalCount: totalCount,
                originalRecordCount: loadedRecords,
                lastLoadTime: new Date().toISOString()
            });
            salesDataModel.refresh(true);

            var hasMore = loadedRecords < totalCount;
            var paginationModel = this.getView().getModel("pagination");
            paginationModel.setData({
                hasMore: hasMore,
                currentSkip: loadedRecords,
                pageSize: this.getView().getModel("filterData").getProperty("/pagingTop") || 500,
                totalRecords: totalCount,
                loadedRecords: loadedRecords
            });
        },

        // =================== FILTER BUILDERS ===================
        /**
         * Builds the OData filter array for the sales service.
         */
        _buildSalesFilters: function () {
            var filters = [];
            var filterData = this.getView().getModel("filterData").getData();

            // Basic filters
            if (filterData.billingDocument && filterData.billingDocument.trim()) {
                filters.push(new Filter("BillingDocument", FilterOperator.EQ, filterData.billingDocument.trim()));
            }
            if (filterData.material && filterData.material.trim()) {
                filters.push(new Filter("Product", FilterOperator.Contains, filterData.material.trim()));
            }
            if (filterData.region && filterData.region.trim()) {
                filters.push(new Filter("Region", FilterOperator.EQ, filterData.region.trim()));
            }
            if (filterData.billingDocumentType && filterData.billingDocumentType.trim()) {
                filters.push(new Filter("BillingDocumentType", FilterOperator.EQ, filterData.billingDocumentType.trim()));
            }
            if (filterData.salesOrder && filterData.salesOrder.trim()) {
                filters.push(new Filter("SalesDocument", FilterOperator.EQ, filterData.salesOrder.trim()));
            }
            if (filterData.customer && filterData.customer.trim()) {
                filters.push(new Filter("Customer", FilterOperator.EQ, filterData.customer.trim()));
            }

            // Date range filters
            if (filterData.fromDate) {
                filters.push(new Filter("BillingDocumentDate", FilterOperator.GE, filterData.fromDate));
            }
            if (filterData.toDate) {
                filters.push(new Filter("BillingDocumentDate", FilterOperator.LE, filterData.toDate));
            }

            // Amount range filters
            if (filterData.amountRange && filterData.amountRange.from) {
                filters.push(new Filter("TotalNetAmount", FilterOperator.GE, filterData.amountRange.from));
            }
            if (filterData.amountRange && filterData.amountRange.to) {
                filters.push(new Filter("TotalNetAmount", FilterOperator.LE, filterData.amountRange.to));
            }

            // Document range filters
            if (filterData.documentRange) {
                var docFilters = this._buildDocumentRangeFilters(filterData.documentRange);
                if (docFilters.length > 0) {
                    filters.push(...docFilters);
                }
            }

            console.log("🔍 Built sales filters:", filters);
            return filters;
        },

        /**
         * Builds document range filters similar to GST Tax Report.
         */
        _buildDocumentRangeFilters: function (docRange) {
            var filters = [];
            var fromDoc = docRange.from ? docRange.from.trim() : "";
            var toDoc = docRange.to ? docRange.to.trim() : "";

            if (!fromDoc && !toDoc) {
                return filters;
            }

            if (fromDoc && toDoc) {
                if (fromDoc === toDoc) {
                    // Exact document search
                    filters.push(this._createExactDocumentFilter(fromDoc));
                } else {
                    // Range search
                    filters.push(new Filter("BillingDocument", FilterOperator.GE, this._normalizeDocumentNumber(fromDoc)));
                    filters.push(new Filter("BillingDocument", FilterOperator.LE, this._normalizeDocumentNumber(toDoc)));
                }
            } else if (fromDoc) {
                filters.push(new Filter("BillingDocument", FilterOperator.GE, this._normalizeDocumentNumber(fromDoc)));
            } else if (toDoc) {
                filters.push(new Filter("BillingDocument", FilterOperator.LE, this._normalizeDocumentNumber(toDoc)));
            }

            return filters;
        },

        /**
         * Creates filter for exact document search with multiple format support.
         */
        _createExactDocumentFilter: function (docNumber) {
            var exactSearchFilters = [];

            // Add original format
            exactSearchFilters.push(new Filter("BillingDocument", FilterOperator.EQ, docNumber));

            // Add zero-padded formats if different
            var paddedDoc10 = docNumber.padStart(10, "0");
            var paddedDoc12 = docNumber.padStart(12, "0");

            if (paddedDoc10 !== docNumber) {
                exactSearchFilters.push(new Filter("BillingDocument", FilterOperator.EQ, paddedDoc10));
            }
            if (paddedDoc12 !== docNumber && paddedDoc12 !== paddedDoc10) {
                exactSearchFilters.push(new Filter("BillingDocument", FilterOperator.EQ, paddedDoc12));
            }

            // Add unpadded version if input was padded
            var unpaddedDoc = docNumber.replace(/^0+/, "") || "0";
            if (unpaddedDoc !== docNumber && unpaddedDoc !== "0") {
                exactSearchFilters.push(new Filter("BillingDocument", FilterOperator.EQ, unpaddedDoc));
            }

            // Return OR filter if multiple formats, otherwise single filter
            if (exactSearchFilters.length > 1) {
                return new Filter({ filters: exactSearchFilters, and: false });
            } else {
                return exactSearchFilters[0];
            }
        },

        /**
         * Normalizes document number for consistent comparison.
         */
        _normalizeDocumentNumber: function (docNumber) {
            if (!docNumber) return "";
            return docNumber.padStart(10, "0");
        },

        /**
         * Creates OData URL parameters for the sales service.
         */
        _buildSalesUrlParameters: function (skip, top) {
            var params = {
                $select: this._getSalesSelectFields(),
                $top: top || 500,
                $orderby: "BillingDocument asc, BillingDocumentDate desc, SalesDocument asc",
                $inlinecount: "allpages"
            };
            if (skip > 0) {
                params["$skip"] = skip;
            }
            return params;
        },

        /**
         * Returns the list of fields to select from the sales service.
         */

        _getSalesSelectFields: function () {
            // Include ALL available fields from the YY1_SALESREGISTER entity
            return "BillingDocument,BillingDocumentDate,BillingDocumentItem,BillingDocumentType," +
                "SalesDocument,SalesDocumentItem," +
                "Product,BillingDocumentItemText," +
                "TotalNetAmount,TransactionCurrency," +
                "BillingQuantity,BillingQuantityUnit," +
                "CustomerFullName_1,PayerParty_1,Region," +
                "GLAccount,TaxCode,ProfitCenter," +
                "BillToParty,Plant,Division," +
                "IN_EDocEInvcEWbillNmbr,IN_EDocEWbillStatus,IN_EDocEInvcEWbillValidityDate," +
                "PurchaseOrderByShipToParty," +
                "ConditionType,ConditionAmount";
        },

        // =================== EVENT HANDLERS ===================
        /**
         * Handles the "Load Data" button press.
         */
        onLoadData: function () {
            var filterData = this.getView().getModel("filterData").getData();
            if (!filterData.billingDocument && !filterData.material && !filterData.region &&
                !filterData.salesOrder && !filterData.fromDate && !filterData.customer &&
                !filterData.documentRange?.from) {
                MessageBox.confirm("No filters specified. This may load a large amount of data. Continue?", {
                    title: "Confirm Load",
                    onClose: action => {
                        if (action === MessageBox.Action.OK) {
                            this._loadData(false, 0);
                        }
                    }
                });
            } else {
                this._loadData(false, 0);
            }
        },

        /**
         * Clears all filters.
         */
        onClearFilters: function () {
            this.getView().getModel("filterData").setData({
                billingDocument: "",
                material: "",
                region: "",
                billingDocumentType: "",
                salesOrder: "",
                customer: "",
                fromDate: null,
                toDate: null,
                amountRange: { from: "", to: "" },
                documentRange: { from: "", to: "" },
                pagingTop: 500,
                enableBatchLoading: true,
                groupByEnabled: true,
                groupingMethod: "none",
                enrichWithTexts: true
            });
            this.getView().getModel("salesData").setData({
                results: [],
                count: 0,
                totalCount: 0,
                originalRecordCount: 0
            });
            MessageToast.show("Filters cleared");
        },

        /**
         * Handles the "Test Connection" button press.
         */
        onTestConnection: function () {
            console.group("🔬 Testing Sales Register Connection");
            var salesModel = this.getView().getModel();
            if (!salesModel) {
                MessageBox.error("Sales Model not found");
                console.groupEnd();
                return;
            }

            this._setLoading(true, "Testing connection...");
            salesModel.read("/YY1_SALESREGISTER", {
                urlParameters: {
                    $select: "BillingDocument,TotalNetAmount,TransactionCurrency,SalesDocument",
                    $top: 5,
                    $orderby: "BillingDocument asc"
                },
                success: data => {
                    this._setLoading(false);
                    var results = data.results || [];
                    console.log("✅ Connection test successful. Sample data:", results);
                    if (results.length > 0) {
                        var sampleDoc = results[0];
                        var successMessage = `Connection successful!\n\n` +
                            `Sample document found:\n` +
                            `Billing Document: ${sampleDoc.BillingDocument}\n` +
                            `Sales Document: ${sampleDoc.SalesDocument}\n` +
                            `Amount: ${sampleDoc.TotalNetAmount}\n` +
                            `Currency: ${sampleDoc.TransactionCurrency}`;
                        MessageBox.success(successMessage);
                    } else {
                        MessageBox.information("Connection successful but no data returned");
                    }
                    console.groupEnd();
                },
                error: error => {
                    this._setLoading(false);
                    console.error("❌ Connection test failed:", error);
                    console.groupEnd();
                    this._handleLoadError(error);
                }
            });
        },

        /**
         * Tests the Sales Order API connection.
         */
        onTestSalesOrderConnection: function () {
            if (this._salesOrderTextService) {
                this._salesOrderTextService.testConnection();
            } else {
                MessageBox.error("Sales Order Text Service not available");
            }
        },

        /**
         * Tests all connections (Sales Register + Sales Order API).
         */
        onTestAllConnections: function () {
            console.group("🔬 Testing All Connections");
            this._setLoading(true, "Testing all connections...");

            Promise.all([
                this._testSalesRegisterConnection(),
                this._testSalesOrderAPIConnection()
            ])
                .then(results => {
                    this._setLoading(false);
                    const [salesResult, soResult] = results;
                    const message = `Connection Test Results:\n\n` +
                        `Sales Register: ${salesResult.success ? '✅ Success' : '❌ Failed'}\n` +
                        `Sales Order API: ${soResult.success ? '✅ Success' : '❌ Failed'}\n\n` +
                        `Details:\n${salesResult.message}\n${soResult.message}`;
                    MessageBox.information(message);
                    console.groupEnd();
                })
                .catch(error => {
                    this._setLoading(false);
                    console.error("❌ Connection test error:", error);
                    MessageBox.error(`Connection test failed: ${error.message}`);
                    console.groupEnd();
                });
        },

        /**
         * Handles the "Load More" button press.
         */
        onLoadMoreData: function () {
            var paginationData = this.getView().getModel("pagination").getData();
            if (!paginationData.hasMore) {
                MessageToast.show("No more data to load");
                return;
            }
            this._loadData(true, paginationData.currentSkip);
        },

        /**
         * Handles the "Load All" button press.
         */
        onLoadAllData: function () {
            var paginationData = this.getView().getModel("pagination").getData();
            if (!paginationData.hasMore) {
                MessageToast.show("All data is already loaded");
                return;
            }
            MessageBox.confirm("This will load all remaining data. Continue?", {
                title: "Load All Data",
                onClose: action => {
                    if (action === MessageBox.Action.OK) {
                        this._loadAllRemainingData();
                    }
                }
            });
        },

        /**
         * Loads all remaining data.
         */
        _loadAllRemainingData: function () {
            var paginationData = this.getView().getModel("pagination").getData();
            var remainingRecords = paginationData.totalRecords - paginationData.loadedRecords;
            if (remainingRecords > 0) {
                this.getView().getModel("filterData").setProperty("/pagingTop", remainingRecords);
                this._loadData(true, paginationData.loadedRecords);
            }
        },

        /**
         * Handles grouping method change.
         */
        onGroupingMethodChange: function (oEvent) {
            var selectedKey = oEvent.getParameter("selectedItem").getKey();
            this.getView().getModel("filterData").setProperty("/groupingMethod", selectedKey);

            // Enable text enrichment automatically for sales order grouping
            var enableTexts = selectedKey === "salesOrder";
            this.getView().getModel("filterData").setProperty("/enrichWithTexts", enableTexts);

            MessageToast.show(`Grouping method changed to: ${selectedKey}`);
        },

        /**
         * Handles text enrichment toggle.
         */
        onTextEnrichmentToggle: function (oEvent) {
            var selected = oEvent.getParameter("selected");
            this.getView().getModel("filterData").setProperty("/enrichWithTexts", selected);
            MessageToast.show(selected ? "Text enrichment enabled" : "Text enrichment disabled");
        },

        /**
         * Opens the exact document search dialog.
         */
        onSearchExactDocument: function () {
            if (!this._oDocumentSearchDialog) {
                this._oDocumentSearchDialog = new sap.m.Dialog({
                    title: "Search Exact Document",
                    type: "Message",
                    content: [
                        new sap.m.VBox({
                            items: [
                                new sap.m.Label({ text: "Billing Document:" }),
                                new sap.m.Input({
                                    id: "exactSearchBillingDoc",
                                    placeholder: "e.g., 90000003",
                                    maxLength: 12,
                                    width: "200px"
                                }).addStyleClass("sapUiSmallMarginTop"),
                                new sap.m.Label({ text: "Sales Order:" }).addStyleClass("sapUiMediumMarginTop"),
                                new sap.m.Input({
                                    id: "exactSearchSalesOrder",
                                    placeholder: "e.g., 2000000100",
                                    maxLength: 10,
                                    width: "200px"
                                }).addStyleClass("sapUiSmallMarginTop"),
                                new sap.m.Text({
                                    text: "Enter either Billing Document or Sales Order for exact search"
                                }).addStyleClass("sapUiMediumMarginTop")
                            ]
                        }).addStyleClass("sapUiMediumMargin")
                    ],
                    buttons: [
                        new sap.m.Button({
                            text: "Search",
                            type: "Emphasized",
                            press: this._performExactDocumentSearch.bind(this)
                        }),
                        new sap.m.Button({
                            text: "Cancel",
                            press: () => this._oDocumentSearchDialog.close()
                        })
                    ]
                });
                this.getView().addDependent(this._oDocumentSearchDialog);
            }
            this._oDocumentSearchDialog.open();
        },

        /**
         * Performs the exact document search using dialog inputs.
         */
        _performExactDocumentSearch: function () {
            var billingDoc = sap.ui.getCore().byId("exactSearchBillingDoc").getValue().trim();
            var salesOrder = sap.ui.getCore().byId("exactSearchSalesOrder").getValue().trim();

            if (!billingDoc && !salesOrder) {
                MessageBox.error("Please enter either Billing Document or Sales Order");
                return;
            }

            // Clear existing data and set the new filters
            this.getView().getModel("salesData").setData({
                results: [],
                count: 0,
                totalCount: 0,
                originalRecordCount: 0
            });

            var filterModel = this.getView().getModel("filterData");
            if (billingDoc) {
                filterModel.setProperty("/billingDocument", billingDoc);
                filterModel.setProperty("/salesOrder", "");
            } else {
                filterModel.setProperty("/salesOrder", salesOrder);
                filterModel.setProperty("/billingDocument", "");
            }

            this._oDocumentSearchDialog.close();
            var searchTerm = billingDoc || salesOrder;
            var searchType = billingDoc ? "Billing Document" : "Sales Order";
            console.log(`🔍 Starting exact search for ${searchType}:`, searchTerm);
            MessageToast.show(`Searching for ${searchType}: ${searchTerm}`);
            this._loadData(false, 0);
        },

        // =================== TABLE FUNCTIONALITY ===================
        /**
         * Handles table search functionality.
         */
        onTableSearch: function (event) {
            var query = event.getParameter("query") || event.getParameter("newValue");
            var table = this.byId("salesTable");
            var binding = table.getBinding("rows") || table.getBinding("items");

            if (binding) {
                var filters = [];
                if (query && query.length > 0) {
                    var searchFields = [
                        "BillingDocument", "SalesDocument", "Product", "Material", "Region",
                        "CustomerFullName_1", "Customer", "BillingDocumentType", "Plant",
                        "DeliveryDocument", "MaterialDisplay"
                    ];
                    var orFilters = searchFields.map(function (field) {
                        return new Filter(field, FilterOperator.Contains, query);
                    });
                    filters.push(new Filter({
                        filters: orFilters,
                        and: false
                    }));
                }
                binding.filter(filters);
            }
        },

        /**
         * Handles quick sort functionality.
         */
        onQuickSort: function (event) {
            var button = event.getSource();
            var property = button.data("property");
            var descending = button.data("descending") === "true";
            var table = this.byId("salesTable");
            var binding = table.getBinding("rows") || table.getBinding("items");

            if (binding) {
                var sorter = new Sorter(property, descending);
                binding.sort(sorter);
                var sortDirection = descending ? "descending" : "ascending";
                MessageToast.show(`Table sorted by ${property} (${sortDirection})`);
            }
        },

        /**
         * Handles column visibility toggle.
         */
        onToggleColumn: function (event) {
            var button = event.getSource();
            var columnId = button.data("columnId");
            var column = this.byId(columnId);
            if (column) {
                var isVisible = column.getVisible();
                column.setVisible(!isVisible);
                button.setIcon(isVisible ? "sap-icon://decline" : "sap-icon://accept");
                MessageToast.show(isVisible ? "Column hidden" : "Column shown");
            }
        },

        /**
         * Shows or hides all condition type columns.
         */
        onShowAllConditionColumns: function () {
            var conditionColumns = ["salesColPPR0", "salesColJOIG", "salesColJOCG", "salesColJOSG",
                "salesColZDV2", "salesColZDV4", "salesColZTCS", "salesColDRV1"];
            conditionColumns.forEach(columnId => {
                var column = this.byId(columnId);
                if (column) column.setVisible(true);
            });
            MessageToast.show("All condition type columns shown");
        },

        onHideAllConditionColumns: function () {
            var conditionColumns = ["salesColPPR0", "salesColJOIG", "salesColJOCG", "salesColJOSG",
                "salesColZDV2", "salesColZDV4", "salesColZTCS", "salesColDRV1"];
            conditionColumns.forEach(columnId => {
                var column = this.byId(columnId);
                if (column) column.setVisible(false);
            });
            MessageToast.show("All condition type columns hidden");
        },

        /**
         * Views detailed information for a selected row.
         */
        onViewRowDetails: function (event) {
            var bindingContext = event.getSource().getBindingContext("salesData");
            if (!bindingContext) return;

            var rowData = bindingContext.getObject();
            this._showRowDetailsDialog(rowData);
        },

        /**
         * Shows the row details dialog with comprehensive information.
         */
        _showRowDetailsDialog: function (rowData) {
            if (!this._oRowDetailsDialog) {
                this._oRowDetailsDialog = new sap.m.Dialog({
                    title: "Sales Record Details",
                    contentWidth: "600px",
                    contentHeight: "500px",
                    resizable: true,
                    draggable: true,
                    content: [
                        new sap.m.ScrollContainer({
                            height: "450px",
                            vertical: true,
                            content: [
                                new sap.m.VBox({ id: "rowDetailsContent" })
                            ]
                        })
                    ],
                    buttons: [
                        new sap.m.Button({
                            text: "Export Details",
                            press: this._exportRowDetails.bind(this)
                        }),
                        new sap.m.Button({
                            text: "Close",
                            press: () => this._oRowDetailsDialog.close()
                        })
                    ]
                });
                this.getView().addDependent(this._oRowDetailsDialog);
            }

            // Update dialog content
            this._updateRowDetailsContent(rowData);
            this._oRowDetailsDialog.open();
        },

        /**
         * Updates the content of the row details dialog.
         */
        _updateRowDetailsContent: function (rowData) {
            var contentBox = sap.ui.getCore().byId("rowDetailsContent");
            contentBox.destroyItems();

            // Document Information Section
            contentBox.addItem(new sap.m.Panel({
                headerText: "Document Information",
                content: [
                    this._createDetailItem("Billing Document", rowData.BillingDocument),
                    this._createDetailItem("Sales Document", rowData.SalesDocument),
                    this._createDetailItem("Document Type", rowData.BillingDocumentType),
                    this._createDetailItem("Billing Date", this.formatDate(rowData.BillingDocumentDate)),
                    this._createDetailItem("Posting Date", this.formatDate(rowData.PostingDate)),
                    this._createDetailItem("Document Date", this.formatDate(rowData.DocumentDate))
                ]
            }));

            // Product Information Section
            contentBox.addItem(new sap.m.Panel({
                headerText: "Product Information",
                content: [
                    this._createDetailItem("Material", rowData.Material || rowData.Product),
                    this._createDetailItem("Material Display", rowData.MaterialDisplay),
                    this._createDetailItem("Quantity", `${rowData.BillingQuantity || 0} ${rowData.BillingQuantityUnit || ''}`),
                    this._createDetailItem("Plant", rowData.Plant),
                    this._createDetailItem("Storage Location", rowData.StorageLocation)
                ]
            }));

            // Customer Information Section
            contentBox.addItem(new sap.m.Panel({
                headerText: "Customer Information",
                content: [
                    this._createDetailItem("Customer", rowData.Customer),
                    this._createDetailItem("Customer Name", rowData.CustomerFullName_1),
                    this._createDetailItem("Region", rowData.Region)
                ]
            }));

            // Financial Information Section
            contentBox.addItem(new sap.m.Panel({
                headerText: "Financial Information",
                content: [
                    this._createDetailItem("Net Amount", this.formatCurrency(rowData.TotalNetAmount, rowData.TransactionCurrency)),
                    this._createDetailItem("Discount", this.formatCurrency(rowData.Discount, rowData.TransactionCurrency)),
                    this._createDetailItem("Currency", rowData.TransactionCurrency),
                    this._createDetailItem("Condition Type", rowData.ConditionType),
                    this._createDetailItem("Condition Amount", this.formatCurrency(rowData.ConditionAmount, rowData.TransactionCurrency))
                ]
            }));

            // Sales Order Text Section (if available)
            if (rowData.SalesOrderText || rowData.HasItemText) {
                var textContent = [];
                if (rowData.SalesOrderText) {
                    textContent.push(this._createDetailItem("Sales Order Text", rowData.SalesOrderText));
                }
                if (rowData.ZXT1) textContent.push(this._createDetailItem("Warehouse (ZXT1)", rowData.ZXT1));
                if (rowData.ZXT3) textContent.push(this._createDetailItem("Location (ZXT3)", rowData.ZXT3));
                if (rowData.ZXT4) textContent.push(this._createDetailItem("Contract (ZXT4)", rowData.ZXT4));
                if (rowData.ZXT5) textContent.push(this._createDetailItem("Period (ZXT5)", rowData.ZXT5));
                if (rowData.ZXT6) textContent.push(this._createDetailItem("Description (ZXT6)", rowData.ZXT6));

                if (textContent.length > 0) {
                    contentBox.addItem(new sap.m.Panel({
                        headerText: "Sales Order Text Information",
                        content: textContent
                    }));
                }
            }

            // Condition Type Breakdown (if available)
            if (rowData.PPR0 || rowData.JOIG || rowData.JOCG || rowData.JOSG || rowData.ZDV2 || rowData.ZDV4 || rowData.ZTCS) {
                contentBox.addItem(new sap.m.Panel({
                    headerText: "Condition Type Breakdown",
                    content: [
                        this._createDetailItem("Rate/MT (PPR0)", this.formatCurrency(rowData.PPR0, rowData.TransactionCurrency)),
                        this._createDetailItem("IGST (JOIG)", this.formatCurrency(rowData.JOIG, rowData.TransactionCurrency)),
                        this._createDetailItem("CGST (JOCG)", this.formatCurrency(rowData.JOCG, rowData.TransactionCurrency)),
                        this._createDetailItem("SGST (JOSG)", this.formatCurrency(rowData.JOSG, rowData.TransactionCurrency)),
                        this._createDetailItem("Additional Charges (ZDV2)", this.formatCurrency(rowData.ZDV2, rowData.TransactionCurrency)),
                        this._createDetailItem("Delay Charges (ZDV4)", this.formatCurrency(rowData.ZDV4, rowData.TransactionCurrency)),
                        this._createDetailItem("TCS (ZTCS)", this.formatCurrency(rowData.ZTCS, rowData.TransactionCurrency)),
                        this._createDetailItem("Invoice Amount", this.formatCurrency(rowData.InvoiceAmount, rowData.TransactionCurrency))
                    ]
                }));
            }

            // Grouping Information (if applicable)
            if (rowData.GroupingType) {
                contentBox.addItem(new sap.m.Panel({
                    headerText: "Grouping Information",
                    content: [
                        this._createDetailItem("Grouping Type", rowData.GroupingType),
                        this._createDetailItem("Item Count", rowData.ItemCount),
                        this._createDetailItem("Group Summary", rowData.GroupSummary),
                        this._createDetailItem("Average Item Value", this.formatCurrency(rowData.AverageItemValue, rowData.TransactionCurrency))
                    ]
                }));
            }

            // Store current row data for export
            this._currentRowData = rowData;
        },

        /**
         * Creates a detail item for the row details dialog.
         */
        _createDetailItem: function (label, value) {
            return new sap.m.HBox({
                alignItems: "Center",
                class: "sapUiSmallMarginBottom",
                items: [
                    new sap.m.Label({
                        text: label + ":",
                        width: "200px",
                        class: "sapUiSmallMarginEnd"
                    }),
                    new sap.m.Text({
                        text: value || "Not Available",
                        wrapping: true
                    })
                ]
            });
        },

        /**
         * Exports the current row details.
         */
        _exportRowDetails: function () {
            if (!this._currentRowData) {
                MessageToast.show("No row data available for export");
                return;
            }

            try {
                var rowData = this._currentRowData;
                var exportData = [{
                    "Billing Document": rowData.BillingDocument,
                    "Sales Document": rowData.SalesDocument,
                    "Document Type": rowData.BillingDocumentType,
                    "Material": rowData.Material || rowData.Product,
                    "Material Display": rowData.MaterialDisplay,
                    "Quantity": rowData.BillingQuantity,
                    "Unit": rowData.BillingQuantityUnit,
                    "Customer": rowData.Customer,
                    "Customer Name": rowData.CustomerFullName_1,
                    "Region": rowData.Region,
                    "Net Amount": rowData.TotalNetAmount,
                    "Discount": rowData.Discount,
                    "Currency": rowData.TransactionCurrency,
                    "Billing Date": this.formatDate(rowData.BillingDocumentDate),
                    "Sales Order Text": rowData.SalesOrderText || "",
                    "Invoice Amount": rowData.InvoiceAmount
                }];

                var columns = Object.keys(exportData[0]).map(key => ({
                    label: key,
                    property: key,
                    type: "string"
                }));

                var fileName = `Sales_Record_Details_${rowData.BillingDocument}_${new Date().toISOString().split("T")[0]}.xlsx`;
                var exportSettings = {
                    workbook: { columns: columns },
                    dataSource: exportData,
                    fileName: fileName
                };

                var spreadsheet = new Spreadsheet(exportSettings);
                spreadsheet.build()
                    .then(() => {
                        MessageToast.show("Row details exported successfully");
                    })
                    .finally(() => {
                        spreadsheet.destroy();
                    });
            } catch (error) {
                MessageBox.error("Export failed: " + error.message);
            }
        },

        // =================== EXPORT FUNCTIONALITY ===================
        /**
         * Handles the "Export to Excel" button press.
         */
        onExportToExcel: function () {
            var data = this.getView().getModel("salesData").getData();
            if (!data.results || data.results.length === 0) {
                MessageBox.warning("No data available to export. Please load data first.");
                return;
            }

            try {
                var columns = this._createExportColumns();
                var fileName = `Enhanced_Sales_Register_${new Date().toISOString().split("T")[0]}.xlsx`;
                var exportSettings = {
                    workbook: {
                        columns: columns,
                        context: {
                            title: "Enhanced Sales Register Export",
                            sheetName: "Sales Data"
                        }
                    },
                    dataSource: data.results,
                    fileName: fileName
                };
                var spreadsheet = new Spreadsheet(exportSettings);
                spreadsheet.build()
                    .then(() => {
                        MessageToast.show(`Exported ${data.results.length} records with ${columns.length} columns`);
                    })
                    .catch(error => {
                        MessageBox.error("Export failed: " + error.message);
                    })
                    .finally(() => {
                        spreadsheet.destroy();
                    });
            } catch (error) {
                MessageBox.error("Export functionality not available: " + error.message);
            }
        },

        /**
         * Exports enhanced data with Sales Order texts.
         */
        onExportToExcelEnhanced: function () {
            var data = this.getView().getModel("salesData").getData();
            if (!data.results || data.results.length === 0) {
                MessageBox.warning("No data available to export. Please load data first.");
                return;
            }

            try {
                var enhancedColumns = this._createEnhancedExportColumns();
                var fileName = `Enhanced_Sales_Register_with_SO_Text_${new Date().toISOString().split("T")[0]}.xlsx`;
                var exportSettings = {
                    workbook: {
                        columns: enhancedColumns,
                        context: {
                            title: "Enhanced Sales Register with Sales Order Text",
                            sheetName: "Enhanced Sales Data"
                        }
                    },
                    dataSource: data.results,
                    fileName: fileName
                };
                var spreadsheet = new Spreadsheet(exportSettings);
                spreadsheet.build()
                    .then(() => {
                        MessageToast.show(`Enhanced export completed with ${data.results.length} records`);
                    })
                    .finally(() => {
                        spreadsheet.destroy();
                    });
            } catch (error) {
                MessageBox.error("Enhanced export failed: " + error.message);
            }
        },

        /**
         * Exports comprehensive invoice format.
         */
        onExportToExcelComprehensive: function () {
            var data = this.getView().getModel("salesData").getData();
            if (!data.results || data.results.length === 0) {
                MessageBox.warning("No data available to export. Please load data first.");
                return;
            }

            try {
                var comprehensiveColumns = this._createComprehensiveExportColumns();
                var fileName = `Comprehensive_Sales_Invoice_Format_${new Date().toISOString().split("T")[0]}.xlsx`;
                var exportSettings = {
                    workbook: {
                        columns: comprehensiveColumns,
                        context: {
                            title: "Comprehensive Sales Invoice Format",
                            sheetName: "Invoice Data"
                        }
                    },
                    dataSource: data.results,
                    fileName: fileName
                };
                var spreadsheet = new Spreadsheet(exportSettings);
                spreadsheet.build()
                    .then(() => {
                        MessageToast.show(`Comprehensive export completed with all ${comprehensiveColumns.length} columns`);
                    })
                    .finally(() => {
                        spreadsheet.destroy();
                    });
            } catch (error) {
                MessageBox.error("Comprehensive export failed: " + error.message);
            }
        },

        /**
         * Creates standard export columns.
         */
        _createExportColumns: function () {
            return [
                { label: "Billing Document", property: "BillingDocument", type: "string" },
                { label: "Billing Date", property: "BillingDocumentDate", type: "date" },
                { label: "Sales Document", property: "SalesDocument", type: "string" },
                { label: "Sales Document Item", property: "SalesDocumentItem", type: "string" },
                { label: "Product", property: "Product", type: "string" },
                { label: "Material Display", property: "MaterialDisplay", type: "string" },
                { label: "Customer", property: "Customer", type: "string" },
                { label: "Customer Name", property: "CustomerFullName_1", type: "string" },
                { label: "Region", property: "Region", type: "string" },
                { label: "Net Amount", property: "TotalNetAmount", type: "number" },
                { label: "Currency", property: "TransactionCurrency", type: "string" },
                { label: "Quantity", property: "BillingQuantity", type: "number" },
                { label: "Unit", property: "BillingQuantityUnit", type: "string" },
                { label: "Discount", property: "Discount", type: "number" },
                { label: "Document Type", property: "BillingDocumentType", type: "string" },
                { label: "Plant", property: "Plant", type: "string" },
                { label: "Storage Location", property: "StorageLocation", type: "string" }
            ];
        },

        /**
         * Creates enhanced export columns with Sales Order text data.
         */
        _createEnhancedExportColumns: function () {
            var baseColumns = this._createExportColumns();
            var enhancedColumns = [
                ...baseColumns,
                { label: "Sales Order Text", property: "SalesOrderText", type: "string" },
                { label: "Warehouse (ZXT1)", property: "ZXT1", type: "string" },
                { label: "Location (ZXT3)", property: "ZXT3", type: "string" },
                { label: "Contract (ZXT4)", property: "ZXT4", type: "string" },
                { label: "Period (ZXT5)", property: "ZXT5", type: "string" },
                { label: "Description (ZXT6)", property: "ZXT6", type: "string" },
                { label: "Has Item Text", property: "HasItemText", type: "boolean" },
                { label: "Invoice Amount", property: "InvoiceAmount", type: "number" }
            ];
            return enhancedColumns;
        },

        /**
         * Creates comprehensive export columns with all available data.
         */
        _createComprehensiveExportColumns: function () {
            var enhancedColumns = this._createEnhancedExportColumns();
            var comprehensiveColumns = [
                ...enhancedColumns,
                { label: "Rate/MT (PPR0)", property: "PPR0", type: "number" },
                { label: "IGST (JOIG)", property: "JOIG", type: "number" },
                { label: "CGST (JOCG)", property: "JOCG", type: "number" },
                { label: "SGST (JOSG)", property: "JOSG", type: "number" },
                { label: "Additional Charges (ZDV2)", property: "ZDV2", type: "number" },
                { label: "Delay Charges (ZDV4)", property: "ZDV4", type: "number" },
                { label: "TCS (ZTCS)", property: "ZTCS", type: "number" },
                { label: "Discount Rate (DRV1)", property: "DRV1", type: "number" },
                { label: "Condition Type", property: "ConditionType", type: "string" },
                { label: "Condition Amount", property: "ConditionAmount", type: "number" },
                { label: "Posting Date", property: "PostingDate", type: "date" },
                { label: "Document Date", property: "DocumentDate", type: "date" },
                { label: "Created By", property: "CreatedByUser", type: "string" },
                { label: "Created On", property: "CreatedOn", type: "date" },
                { label: "Sales Organization", property: "SalesOrganization", type: "string" },
                { label: "Distribution Channel", property: "DistributionChannel", type: "string" },
                { label: "Division", property: "Division", type: "string" },
                { label: "Sales Group", property: "SalesGroup", type: "string" },
                { label: "Sales Office", property: "SalesOffice", type: "string" },
                { label: "Delivery Document", property: "DeliveryDocument", type: "string" },
                { label: "Delivery Document Item", property: "DeliveryDocumentItem", type: "string" }
            ];
            return comprehensiveColumns;
        },

        // =================== SUMMARY FUNCTIONALITY ===================
        /**
         * Shows a comprehensive summary of the loaded data.
         */
        onShowSummary: function () {
            var data = this.getView().getModel("salesData").getData();
            if (!data.results || data.results.length === 0) {
                MessageBox.warning("No data available for summary.");
                return;
            }

            var stats = this._dataProcessor.getDataStatistics(data.results);
            var summaryText = this._buildSummaryText(stats, data);

            MessageBox.information(summaryText, {
                title: "Enhanced Sales Register Summary",
                styleClass: "sapUiSizeCompact"
            });
        },

        /**
         * Shows enhanced summary with condition type breakdown.
         */
        onShowEnhancedSummary: function () {
            var data = this.getView().getModel("salesData").getData();
            if (!data.results || data.results.length === 0) {
                MessageBox.warning("No data available for enhanced summary.");
                return;
            }

            var stats = this._dataProcessor.getDataStatistics(data.results);
            var enhancedSummaryText = this._buildEnhancedSummaryText(stats, data);

            MessageBox.information(enhancedSummaryText, {
                title: "Enhanced Sales Summary with Condition Breakdown",
                styleClass: "sapUiSizeCompact"
            });
        },

        /**
         * Shows condition type summary.
         */
        onShowConditionTypeSummary: function () {
            var data = this.getView().getModel("salesData").getData();
            if (!data.results || data.results.length === 0) {
                MessageBox.warning("No data available for condition summary.");
                return;
            }

            var conditionSummary = this._buildConditionTypeSummary(data.results);

            MessageBox.information(conditionSummary, {
                title: "Condition Type Summary",
                styleClass: "sapUiSizeCompact"
            });
        },

        /**
         * Builds the standard summary text.
         */
        _buildSummaryText: function (stats, data) {
            return `ENHANCED SALES REGISTER SUMMARY\n\n` +
                `📊 OVERVIEW:\n` +
                `• Total Records: ${stats.totalRecords}\n` +
                `• Original Record Count: ${data.originalRecordCount || 0}\n` +
                `• Last Load Time: ${data.lastLoadTime ? new Date(data.lastLoadTime).toLocaleString() : "Never"}\n\n` +

                `💰 FINANCIAL TOTALS:\n` +
                `• Total Net Amount: ${this.formatNumber(stats.totalAmount.toString())}\n` +
                `• Average Amount: ${this.formatNumber(stats.averageAmount.toString())}\n` +
                `• Total Quantity: ${this.formatNumber(stats.totalQuantity.toString())}\n` +
                `• Average Quantity: ${this.formatNumber(stats.averageQuantity.toString())}\n\n` +

                `📅 DATE RANGE:\n` +
                `• ${stats.dateRange.formatted || "No date range available"}\n\n` +

                `🏢 BREAKDOWN:\n` +
                `• Unique Currencies: ${Object.keys(stats.currencyBreakdown).length}\n` +
                `• Unique Materials: ${Object.keys(stats.materialBreakdown).length}\n` +
                `• Unique Plants: ${Object.keys(stats.plantBreakdown).length}\n` +
                `• Unique Regions: ${Object.keys(stats.regionBreakdown).length}`;
        },

        /**
         * Builds the enhanced summary text with condition breakdown.
         */
        _buildEnhancedSummaryText: function (stats, data) {
            var basicSummary = this._buildSummaryText(stats, data);

            // Add condition type breakdown
            var conditionBreakdown = "\n\n📋 CONDITION TYPE BREAKDOWN:\n";
            Object.keys(stats.conditionTypeBreakdown).forEach(conditionType => {
                var breakdown = stats.conditionTypeBreakdown[conditionType];
                conditionBreakdown += `• ${conditionType}: ${breakdown.count} records, Total: ${this.formatNumber(breakdown.total.toString())}\n`;
            });

            // Add currency breakdown
            var currencyBreakdown = "\n💱 CURRENCY BREAKDOWN:\n";
            Object.keys(stats.currencyBreakdown).forEach(currency => {
                var breakdown = stats.currencyBreakdown[currency];
                currencyBreakdown += `• ${currency}: ${breakdown.count} records, Total: ${this.formatNumber(breakdown.total.toString())}\n`;
            });

            return basicSummary + conditionBreakdown + currencyBreakdown;
        },

        /**
         * Builds condition type summary.
         */
        _buildConditionTypeSummary: function (results) {
            var conditionTotals = {
                PPR0: 0, JOIG: 0, JOCG: 0, JOSG: 0,
                ZDV2: 0, ZDV4: 0, ZTCS: 0, DRV1: 0
            };
            var conditionCounts = { ...conditionTotals };
            var totalInvoiceAmount = 0;

            results.forEach(record => {
                Object.keys(conditionTotals).forEach(conditionType => {
                    var amount = parseFloat(record[conditionType]) || 0;
                    if (amount > 0) {
                        conditionTotals[conditionType] += amount;
                        conditionCounts[conditionType]++;
                    }
                });
                totalInvoiceAmount += parseFloat(record.InvoiceAmount) || 0;
            });

            var summary = "CONDITION TYPE SUMMARY\n\n";
            Object.keys(conditionTotals).forEach(conditionType => {
                var total = conditionTotals[conditionType];
                var count = conditionCounts[conditionType];
                var avg = count > 0 ? total / count : 0;
                summary += `${conditionType}: ${this.formatNumber(total.toString())} (${count} records, Avg: ${this.formatNumber(avg.toString())})\n`;
            });

            summary += `\nTotal Invoice Amount: ${this.formatNumber(totalInvoiceAmount.toString())}\n`;
            summary += `Records with Invoice Data: ${results.filter(r => r.InvoiceAmount > 0).length}`;

            return summary;
        },

        // =================== UTILITY FUNCTIONS ===================
        /**
         * Sets the loading state of the application.
         */
        _setLoading: function (isLoading, operation, currentStep, totalSteps) {
            this.getView().getModel("loadingState").setData({
                loading: isLoading,
                currentOperation: operation || "",
                currentStep: currentStep || 0,
                totalSteps: totalSteps || 0,
                progress: totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0
            });
        },

        /**
         * Validates filter data.
         */
        _validateFilterData: function (filterData) {
            var errors = [];

            // Amount range validation
            if (filterData.amountRange.from && filterData.amountRange.to) {
                var fromAmount = parseFloat(filterData.amountRange.from);
                var toAmount = parseFloat(filterData.amountRange.to);
                if (!isNaN(fromAmount) && !isNaN(toAmount) && fromAmount > toAmount) {
                    errors.push("Amount From cannot be greater than Amount To");
                }
            }

            // Document range validation
            if (filterData.documentRange && filterData.documentRange.from && filterData.documentRange.to) {
                var fromDoc = parseInt(filterData.documentRange.from);
                var toDoc = parseInt(filterData.documentRange.to);
                if (!isNaN(fromDoc) && !isNaN(toDoc) && fromDoc > toDoc) {
                    errors.push("Document From cannot be greater than Document To");
                }
            }

            // Date range validation
            if (filterData.fromDate && filterData.toDate) {
                if (new Date(filterData.fromDate) > new Date(filterData.toDate)) {
                    errors.push("From Date cannot be later than To Date");
                }
            }

            return errors;
        },

        /**
         * Handles data loading errors.
         */
        _handleLoadError: function (error) {
            console.error("❌ Sales data load error:", error);
            this._setLoading(false);
            if (this._isConnectivityError(error)) {
                this._showConnectivityHelp(error);
            } else {
                MessageBox.error(`Data loading failed: ${error.message}\n\nCheck browser console for details.`);
            }
        },

        /**
         * Checks if an error is likely due to connectivity issues.
         */
        _isConnectivityError: function (error) {
            var message = (error.message || error.toString()).toLowerCase();
            return message.includes("failed to fetch") ||
                message.includes("cors") ||
                message.includes("network") ||
                error.statusCode === 0;
        },

        /**
         * Shows connectivity help dialog.
         */
        _showConnectivityHelp: function (error) {
            MessageBox.error("Connectivity Issue Detected\n\n" +
                "Unable to connect to SAP services. This could be due to:\n" +
                "• Missing proxy configuration in ui5.yaml\n" +
                "• Incorrect destination setup\n" +
                "• Authentication issues\n" +
                "• Network connectivity problems\n\n" +
                `Error: ${error.message}`, {
                title: "Connection Error",
                styleClass: "sapUiSizeCompact"
            });
        },

        /**
         * Builds error message from error object.
         */
        _buildErrorMessage: function (context, error) {
            var message = `${context} loading failed`;
            if (error.responseText) {
                try {
                    var errorObj = JSON.parse(error.responseText);
                    if (errorObj.error && errorObj.error.message) {
                        message += `: ${errorObj.error.message.value || errorObj.error.message}`;
                    }
                } catch (e) {
                    message += `: ${error.responseText}`;
                }
            } else if (error.message) {
                message += `: ${error.message}`;
            }
            return message;
        },

        /**
         * Tests Sales Register connection.
         */
        _testSalesRegisterConnection: function () {
            return new Promise((resolve) => {
                var salesModel = this.getView().getModel();
                if (!salesModel) {
                    resolve({ success: false, message: "Sales Register Model not found" });
                    return;
                }

                salesModel.read("/YY1_SALESREGISTER", {
                    urlParameters: {
                        $select: "BillingDocument,TotalNetAmount,TransactionCurrency",
                        $top: 1
                    },
                    success: (data) => {
                        var results = data.results || [];
                        resolve({
                            success: true,
                            message: `Sales Register API working. Sample records: ${results.length}`
                        });
                    },
                    error: (error) => {
                        resolve({
                            success: false,
                            message: `Sales Register API failed: ${error.message || 'Unknown error'}`
                        });
                    }
                });
            });
        },

        /**
         * Tests Sales Order API connection.
         */
        _testSalesOrderAPIConnection: function () {
            return new Promise((resolve) => {
                if (!this._salesOrderTextService) {
                    resolve({ success: false, message: "Sales Order Text Service not available" });
                    return;
                }

                var salesOrderModel = this.getView().getModel("salesOrder");
                if (!salesOrderModel) {
                    resolve({ success: false, message: "Sales Order API Model not found" });
                    return;
                }

                // Test with a sample sales order
                salesOrderModel.read("/A_SalesOrder", {
                    urlParameters: {
                        $select: "SalesOrder,SalesOrderType",
                        $top: 1
                    },
                    success: (data) => {
                        var results = data.results || [];
                        resolve({
                            success: true,
                            message: `Sales Order API working. Sample records: ${results.length}`
                        });
                    },
                    error: (error) => {
                        resolve({
                            success: false,
                            message: `Sales Order API failed: ${error.message || 'Unknown error'}`
                        });
                    }
                });
            });
        },

        // =================== TIME PERIOD FILTERS ===================
        /**
         * Consolidated quick filter method for different time periods.
         */
        onQuickFilterTimePeriod: function (period) {
            var today = new Date();
            var firstDay, lastDay;

            switch (period) {
                case "currentMonth":
                    firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                    lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    break;

                case "currentQuarter":
                    var quarter = Math.floor(today.getMonth() / 3);
                    firstDay = new Date(today.getFullYear(), quarter * 3, 1);
                    lastDay = new Date(today.getFullYear(), (quarter + 1) * 3, 0);
                    break;

                case "currentYear":
                    firstDay = new Date(today.getFullYear(), 0, 1);
                    lastDay = new Date(today.getFullYear(), 11, 31);
                    break;

                case "lastMonth":
                    firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
                    break;

                default:
                    MessageToast.show("Invalid time period specified");
                    return;
            }

            var filterModel = this.getView().getModel("filterData");
            filterModel.setProperty("/fromDate", firstDay);
            filterModel.setProperty("/toDate", lastDay);

            MessageToast.show(`Filter set to ${period.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        },

        onQuickFilterCurrentMonth: function () {
            this.onQuickFilterTimePeriod("currentMonth");
        },

        onQuickFilterCurrentQuarter: function () {
            this.onQuickFilterTimePeriod("currentQuarter");
        },

        onQuickFilterCurrentYear: function () {
            this.onQuickFilterTimePeriod("currentYear");
        },

        onQuickFilterLastMonth: function () {
            this.onQuickFilterTimePeriod("lastMonth");
        },

        // =================== DOCUMENT RANGE HELPERS ===================
        /**
         * Quick filter helper for single document.
         */
        onQuickFilterSingleDocument: function (documentNumber) {
            if (!documentNumber) {
                MessageBox.error("Please provide a document number");
                return;
            }

            this.getView().getModel("filterData").setProperty("/documentRange", {
                from: documentNumber,
                to: documentNumber
            });

            MessageToast.show(`Filter set for document: ${documentNumber}`);
        },

        /**
         * Quick filter helper for document range.
         */
        onQuickFilterDocumentRange: function (fromDoc, toDoc) {
            if (!fromDoc && !toDoc) {
                MessageBox.error("Please provide at least one document number");
                return;
            }

            this.getView().getModel("filterData").setProperty("/documentRange", {
                from: fromDoc || "",
                to: toDoc || ""
            });

            var message = fromDoc && toDoc ?
                `Filter set for documents: ${fromDoc} to ${toDoc}` :
                fromDoc ? `Filter set from document: ${fromDoc}` :
                    `Filter set up to document: ${toDoc}`;

            MessageToast.show(message);
        },

        /**
         * Clear document range filter.
         */
        onClearDocumentRange: function () {
            this.getView().getModel("filterData").setProperty("/documentRange", {
                from: "",
                to: ""
            });
            MessageToast.show("Document range filter cleared");
        },

        // =================== FORMATTERS ===================
        /**
         * Formats a number with Indian locale formatting.
         */
        formatNumber: function (value) {
            if (!value && value !== 0) return "0.00";
            var parsedValue = Math.abs(parseFloat(value));
            if (isNaN(parsedValue)) return "0.00";
            return new Intl.NumberFormat("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(parsedValue);
        },

        /**
         * Formats a date object or string.
         */
        formatDate: function (date) {
            if (!date) return "";
            if (typeof date === "string" && date.includes("/Date(")) {
                var timestamp = parseInt(date.match(/\d+/)[0]);
                return new Date(timestamp).toLocaleDateString();
            }
            return new Date(date).toLocaleDateString();
        },

        /**
         * Formats currency with amount and currency code.
         */
        formatCurrency: function (amount, currency) {
            return this.formatNumber(amount) + " " + (currency || "INR");
        },

        /**
         * Formats date range for display.
         */
        formatDateRange: function (dateRange, singleDate) {
            if (dateRange && dateRange.includes(" - ")) {
                return dateRange;
            }
            return this.formatDate(singleDate);
        },

        /**
         * Formats quantity with unit.
         */
        formatQuantity: function (quantity, unit) {
            if (!quantity && quantity !== 0) return "";
            return `${this.formatNumber(quantity)} ${unit || ""}`.trim();
        },

        /**
         * Formats boolean values.
         */
        formatBoolean: function (value) {
            return value === true ? "Yes" : "No";
        },

        /**
         * Enhanced currency formatter for simple display.
         */
        formatCurrencySimple: function (value) {
            if (!value && value !== 0) return 0;
            var parsedValue = Math.abs(parseFloat(value));
            if (isNaN(parsedValue)) return 0;
            return Math.round(parsedValue * 100) / 100;
        },

        /**
         * Formats sales order text display.
         */
        formatSalesOrderText: function (text, hasText) {
            if (!hasText || !text) return "No text available";
            return text.length > 100 ? text.substring(0, 100) + "..." : text;
        },

        /**
         * Formats grouping display information.
         */
        formatGroupingInfo: function (groupingType, itemCount) {
            if (!groupingType) return "Individual Record";
            return `Grouped (${itemCount || 1} items)`;
        },

        /**
         * Formats condition amount display.
         */
        formatConditionAmount: function (amount, conditionType) {
            if (!amount || amount === 0) return "-";
            var formattedAmount = this.formatNumber(amount);
            return conditionType ? `${formattedAmount} (${conditionType})` : formattedAmount;
        }
    });
});
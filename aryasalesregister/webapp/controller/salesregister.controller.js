sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/export/Spreadsheet",
    "sap/ui/model/Sorter",
    "sap/ui/core/Fragment"
], function (
    Controller,
    JSONModel,
    MessageToast,
    MessageBox,
    Filter,
    FilterOperator,
    Spreadsheet,
    Sorter,
    Fragment
) {
    "use strict";

    return Controller.extend("aryasalesregister.controller.salesregister", {

        // --- Lifecycle Methods ---
        /**
         * Initializes the controller. Sets up the models and performs configuration validation.
         */
        onInit: function () {
            console.log("🚀 Sales Register Controller initializing...");
            this._initializeModels();
            this._validateConfiguration();
            console.log("✅ Controller initialized successfully");
        },

        /**
         * Cleans up resources when the controller is destroyed.
         */
        onExit: function () {
            if (this._oDetailDialog) {
                this._oDetailDialog.destroy();
            }
            if (this._oRowDetailsDialog) {
                this._oRowDetailsDialog.destroy();
            }
        },

        // --- Model Management & Initialization ---
        /**
         * Initializes the JSON models used by the view.
         * Similar to GST Tax Report but adapted for Sales Register data structure
         */
        _initializeModels: function () {
            var salesDataModel = new JSONModel({
                results: [],
                count: 0,
                totalCount: 0,
                originalRecordCount: 0,
                totalAmount: 0,
                lastLoadTime: null
            });
            this.getView().setModel(salesDataModel, "salesData");

            var filterDataModel = new JSONModel({
                billingDocument: "",
                salesOrder: "",
                billingDocumentType: "",
                fromDate: null,
                toDate: null,
                pagingTop: 500,
                groupingMethod: "salesDocAndItems",
                autoRefresh: false
            });
            this.getView().setModel(filterDataModel, "filterData");

            var loadingStateModel = new JSONModel({
                loading: false,
                currentOperation: "",
                progress: 0,
                totalSteps: 0,
                currentStep: 0
            });
            this.getView().setModel(loadingStateModel, "loadingState");

            var paginationModel = new JSONModel({
                hasMore: false,
                currentSkip: 0,
                pageSize: 500,
                totalRecords: 0,
                loadedRecords: 0
            });
            this.getView().setModel(paginationModel, "pagination");

            var salesTextModel = new JSONModel({
                textData: {},
                loadedSalesOrders: []
            });
            this.getView().setModel(salesTextModel, "salesText");

            // Initialize services
            this._initializeServices();
        },

        /**
         * Initialize services including SalesOrderTextService with proper model checking
         */
        _initializeServices: function () {
            // Load SalesOrderTextService
            sap.ui.require([
                "aryasalesregister/services/SalesOrderTextService"
            ], (SalesOrderTextService) => {
                this.salesOrderTextService = new SalesOrderTextService(this);
                console.log("✅ SalesOrderTextService initialized");

                // Check if sales order API model is properly configured
                this._validateSalesOrderAPIConfiguration();
            }, (error) => {
                console.warn("⚠️ Failed to load SalesOrderTextService:", error);
                this.salesOrderTextService = null;
            });
        },

        /**
         * Validates that the Sales Order API model is properly configured
         */
        _validateSalesOrderAPIConfiguration: function () {
            console.group("🔧 Validating Sales Order API Configuration");

            const component = this.getOwnerComponent();
            const availableModels = Object.keys(component.oModels || {});

            console.log("📋 Available models:", availableModels);

            // Check for the actual model name from manifest.json
            const possibleModelNames = ["salesOrder", "salesOrderAPI", "API_SALES_ORDER_SRV"];
            let salesOrderModel = null;
            let foundModelName = null;

            for (let modelName of possibleModelNames) {
                salesOrderModel = component.getModel(modelName);
                if (salesOrderModel) {
                    foundModelName = modelName;
                    break;
                }
            }

            if (salesOrderModel) {
                const serviceUrl = salesOrderModel.sServiceUrl || salesOrderModel.getServiceUrl?.();
                console.log(`✅ Sales Order API Model found: ${foundModelName}`);
                console.log(`🌐 Service URL: ${serviceUrl}`);

                // Test metadata loading
                salesOrderModel.getMetaModel().loaded().then(() => {
                    console.log("✅ Sales Order API Metadata loaded successfully");
                    console.log("🔄 Text data auto-fetch is ready");
                }).catch(error => {
                    console.error("❌ Sales Order API Metadata failed:", error);
                    console.error("⚠️ Text data auto-fetch may not work properly");
                });

            } else {
                console.error("❌ Sales Order API Model not found!");
                console.error("📋 Checked model names:", possibleModelNames);
                console.error("🔧 Expected model name from your manifest.json: 'salesOrder'");
                console.error("⚠️ Text data auto-fetch will return empty values");

                // Show user-friendly message
                MessageToast.show("Warning: Sales Order model 'salesOrder' not ready - text fields may be empty");
            }

            console.groupEnd();
        },

        /**
         * Validates that the necessary OData models are configured correctly.
         */
        _validateConfiguration: function () {
            console.group("🔧 Validating Configuration");
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
            console.groupEnd();
        },

        // --- Data Loading & Processing ---
        /**
         * The main method for loading data. Orchestrates the process of loading sales data,
         * processing it with text information, and grouping by Sales Document & Item.
         * @param {boolean} isLoadMore - Flag to indicate if this is an additional load (for pagination).
         * @param {number} skip - The number of records to skip for pagination.
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

            this._setLoading(true, "Initializing data load...", 0, 3);
            if (!isLoadMore) {
                this.getView().getModel("salesData").setData({
                    results: [],
                    count: 0,
                    totalAmount: 0
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
                .then(salesResult => this._processSalesResult(salesResult, isLoadMore))
                .catch(error => this._handleLoadError(error))
                .finally(() => {
                    console.groupEnd();
                });
        },

        /**
         * Loads the sales register data with the specified filters and pagination.
         * @param {number} skip - Number of records to skip.
         * @param {number} top - Number of records to retrieve.
         * @returns {Promise<Object[]>} A promise that resolves with the sales data results.
         */
        _loadSalesDataWithFilters: function (skip, top) {
            return new Promise((resolve, reject) => {
                this._setLoading(true, "Loading sales documents...", 1, 3);
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
         * Processes the loaded sales data by automatically loading text data and grouping
         * @param {Object[]} salesResult - The sales data results.
         * @param {boolean} isLoadMore - Whether this is an additional load.
         * @returns {Promise<void>}
         */
        _processSalesResult: async function (salesResult, isLoadMore) {
            if (salesResult.length === 0) {
                this._finishDataLoad([], isLoadMore, 0);
                return Promise.resolve();
            }

            this._setLoading(true, `Processing ${salesResult.length} sales records...`, 2, 4);

            // Automatically load sales order text data for all fetched sales orders
            var enhancedDataWithText = salesResult;
            if (this.salesOrderTextService) {
                try {
                    this._setLoading(true, "Automatically loading sales order text data...", 3, 4);
                    console.log("🔄 Auto-fetching text data for all loaded sales orders...");
                    enhancedDataWithText = await this.salesOrderTextService.loadAndMapSalesOrderText(salesResult);
                    console.log("✅ Text data auto-fetch completed");
                } catch (error) {
                    console.warn("⚠️ Auto text loading failed, continuing without text data:", error);
                    MessageToast.show("Warning: Sales order text data could not be loaded automatically");
                    enhancedDataWithText = salesResult;
                }
            } else {
                console.warn("⚠️ SalesOrderTextService not available for auto-fetch");
                MessageToast.show("Warning: Text service not configured - ZXT fields will be empty");
            }

            // Group data by Sales Document & Item with enhanced text data
            this._setLoading(true, "Grouping with text data and calculating totals...", 4, 4);
            var groupedData = this._groupSalesDataByDocumentAndItem(enhancedDataWithText);
            this._finishDataLoad(groupedData, isLoadMore, salesResult.totalCount);

            return Promise.resolve();
        },

        /**
         * Groups sales data by Sales Document and Item, calculating invoice amounts
         * This is different from GST grouping - it groups by Sales Document + Item combination
         * @param {Object[]} salesData - The raw sales data
         * @returns {Object[]} Array of grouped sales summaries
         */
        _groupSalesDataByDocumentAndItem: function (salesData) {
            console.log("📊 Grouping sales data by Sales Document & Item with invoice calculation...");

            var groupedData = {};

            salesData.forEach(item => {
                var groupKey = `${item.SalesDocument || 'N/A'}_${item.SalesDocumentItem || '000010'}`;

                if (!groupedData[groupKey]) {
                    // Initialize document group
                    groupedData[groupKey] = {
                        // Document identifiers
                        BillingDocument: item.BillingDocument,
                        SalesDocument: item.SalesDocument,
                        SalesDocumentItem: item.SalesDocumentItem,
                        BillingDocumentDate: item.BillingDocumentDate,

                        // Customer information
                        CustomerNumber: item.PayerParty,
                        CustomerDisplay: item.CustomerFullName_1,
                        CustomerState: item.Region,
                        CustomerGSTIN: item.BusinessPartnerName1,

                        // Product information
                        Product: item.Product,
                        ProductDescription: item.BillingDocumentItemText,
                        Plant: item.Plant,
                        BillingQuantity: this._parseQuantity(item.BillingQuantity),
                        BillingQuantityUnit: item.BillingQuantityUnit,

                        // Currency
                        TransactionCurrency: item.TransactionCurrency,

                        // Initialize condition amounts
                        PPR0: 0,     // Rate/MT
                        DRV1: 0,     // Discount
                        ZDV2: 0,     // Additional Charges
                        JOIG: 0,     // IGST
                        JOCG: 0,     // CGST
                        JOSG: 0,     // SGST
                        ZTCS: 0,     // TCS
                        ZDV4: 0,     // Delay Charges

                        // Calculated amounts
                        TotalNetAmount: 0,
                        InvoiceAmount: 0,

                        // E-Invoice status
                        IN_EDocEWbillStatus: item.IN_EDocEWbillStatus,
                        IN_EDocEInvcEWbillNmbr: item.IN_EDocEInvcEWbillNmbr,

                        // Sales order text fields
                        ZXT1: item.ZXT1,  // Warehouse Code
                        ZXT3: item.ZXT3,  // Warehouse Location
                        ZXT4: item.ZXT4,  // Contract/Trade ID
                        ZXT5: item.ZXT5,  // Service Period
                        ZXT6: item.ZXT6,  // Material Description
                        ZXT7: item.ZXT7,  // Flag
                        ZXT8: item.ZXT8,  // Item Number

                        DetailRecords: []
                    };
                }

                var group = groupedData[groupKey];

                // Accumulate condition amounts based on condition type
                var condAmount = this._parseAmount(item.ConditionAmount);
                if (item.ConditionType && group.hasOwnProperty(item.ConditionType)) {
                    group[item.ConditionType] += condAmount;
                }

                // For net amount calculation, use PPR0 (base price)
                if (item.ConditionType === 'PPR0') {
                    group.TotalNetAmount += condAmount;
                }

                // Store detail record
                group.DetailRecords.push(item);

                console.log(`📝 Processing Sales Doc: ${item.SalesDocument}, Item: ${item.SalesDocumentItem}, Condition: ${item.ConditionType}, Amount: ${condAmount}`);
            });

            // Final calculation for each group
            Object.values(groupedData).forEach(group => {
                // Calculate Invoice Amount = Net Amount + Additional Charges + Taxes - Discounts
                group.InvoiceAmount = group.TotalNetAmount +
                    (group.ZDV2 || 0) +      // Additional charges
                    (group.JOIG || 0) +      // IGST
                    (group.JOCG || 0) +      // CGST
                    (group.JOSG || 0) +      // SGST
                    (group.ZTCS || 0) +      // TCS
                    (group.ZDV4 || 0) -      // Delay charges
                    (group.DRV1 || 0);       // Discount

                // Round amounts to 2 decimal places
                group.TotalNetAmount = Math.round(group.TotalNetAmount * 100) / 100;
                group.InvoiceAmount = Math.round(group.InvoiceAmount * 100) / 100;

                console.log(`🎯 Sales Group ${group.SalesDocument}-${group.SalesDocumentItem} FINAL TOTALS:`);
                console.log(`   💵 Net Amount: ${group.TotalNetAmount}`);
                console.log(`   💸 Invoice Amount: ${group.InvoiceAmount}`);
                console.log(`   📊 Detail Records: ${group.DetailRecords.length}`);
            });

            // Convert to array and sort
            var groupedArray = Object.values(groupedData);
            groupedArray.sort((a, b) => {
                if (a.SalesDocument !== b.SalesDocument) return a.SalesDocument.localeCompare(b.SalesDocument);
                return a.SalesDocumentItem.localeCompare(b.SalesDocumentItem);
            });

            console.log(`✅ Grouped ${salesData.length} line items into ${groupedArray.length} sales document summaries`);
            return groupedArray;
        },

        // --- Filter & URL Parameter Builders ---
        /**
         * Builds the OData filter array for the Sales Register service
         * @returns {sap.ui.model.Filter[]} An array of filters.
         */
        _buildSalesFilters: function () {
            var filters = [];
            var filterData = this.getView().getModel("filterData").getData();

            if (filterData.billingDocument && filterData.billingDocument.trim()) {
                filters.push(new Filter("BillingDocument", FilterOperator.EQ, filterData.billingDocument.trim()));
            }

            if (filterData.salesOrder && filterData.salesOrder.trim()) {
                filters.push(new Filter("SalesDocument", FilterOperator.EQ, filterData.salesOrder.trim()));
            }

            if (filterData.billingDocumentType && filterData.billingDocumentType.trim()) {
                filters.push(new Filter("BillingDocumentType", FilterOperator.EQ, filterData.billingDocumentType.trim()));
            }

            if (filterData.fromDate) {
                filters.push(new Filter("BillingDocumentDate", FilterOperator.GE, filterData.fromDate));
            }

            if (filterData.toDate) {
                filters.push(new Filter("BillingDocumentDate", FilterOperator.LE, filterData.toDate));
            }

            console.log("🔍 Built Sales filters:", filters);
            return filters;
        },

        /**
         * Creates OData URL parameters for the Sales Register service
         * @param {number} skip - The number of records to skip.
         * @param {number} top - The number of records to retrieve.
         * @returns {Object} A key-value map of URL parameters.
         */
        _buildSalesUrlParameters: function (skip, top) {
            var params = {
                $select: this._getSalesSelectFields(),
                $top: top || 500,
                $orderby: "SalesDocument asc,SalesDocumentItem asc,BillingDocument asc",
                $inlinecount: "allpages"
            };
            if (skip > 0) {
                params["$skip"] = skip;
            }
            return params;
        },

        /**
         * Returns a comma-separated string of fields to select from the Sales Register service.
         * @returns {string} The list of selected fields.
         */
        _getSalesSelectFields: function () {
            return "BillingDocument,BillingDocumentDate,BillingDocumentType,SalesDocument,SalesDocumentItem," +
                "Product,BillingDocumentItemText,BillingQuantity,BillingQuantityUnit,ConditionType," +
                "ConditionAmount,TransactionCurrency,CustomerFullName_1,BusinessPartnerName1,PayerParty," +
                "Region,Plant,Division,ProfitCenter,TaxCode,CustomerPaymentTerms," +
                "IN_EDocEWbillStatus,IN_EDocEInvcEWbillNmbr,PurchaseOrderByShipToParty";
        },

        // --- Quick Date Filter Methods (Fixed Syntax Error) ---
        /**
         * Consolidated quick filter method for different time periods
         * @param {string} period - "currentMonth", "currentQuarter", "currentYear", "lastMonth"
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
                    lastDay = new Date(today.getFullYear(), today.getMonth(), 0); // FIXED: was "New" instead of "new"
                    break;

                default:
                    MessageToast.show("Invalid time period specified");
                    return;
            }

            this.getView().getModel("filterData").setData({
                billingDocument: "",
                salesOrder: "",
                billingDocumentType: "",
                fromDate: firstDay,
                toDate: lastDay,
                pagingTop: 500,
                groupingMethod: "salesDocAndItems",
                autoRefresh: false
            });

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

        // --- Event Handlers ---
        /**
         * Handles the "Load Data" button press
         */
        onLoadData: function () {
            var filterData = this.getView().getModel("filterData").getData();
            if (!this._hasActiveFilters(filterData)) {
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
         * Clears all filters and loaded data
         */
        onClearFilters: function () {
            this.getView().getModel("filterData").setData({
                billingDocument: "",
                salesOrder: "",
                billingDocumentType: "",
                fromDate: null,
                toDate: null,
                pagingTop: 500,
                groupingMethod: "salesDocAndItems",
                autoRefresh: false
            });

            this.getView().getModel("salesData").setData({
                results: [],
                count: 0,
                totalCount: 0,
                originalRecordCount: 0,
                totalAmount: 0
            });

            MessageToast.show("Filters cleared");
        },

        /**
         * Handles the "Test Connection" button press with enhanced sales order API testing
         */
        onTestConnection: function () {
            console.group("🔬 Testing Sales Register Service Connection");
            var salesModel = this.getView().getModel();
            if (!salesModel) {
                MessageBox.error("Sales Register Model not found");
                console.groupEnd();
                return;
            }

            this._setLoading(true, "Testing connections...");

            // Test main sales register service
            salesModel.read("/YY1_SALESREGISTER", {
                urlParameters: {
                    $select: "BillingDocument,SalesDocument,BillingDocumentDate,SalesDocumentItem",
                    $top: 5,
                    $orderby: "BillingDocument asc"
                },
                success: data => {
                    var results = data.results || [];
                    console.log("✅ Sales Register connection test successful. Sample data:", results);

                    if (results.length > 0) {
                        var sampleDoc = results[0];
                        var successMessage = `Sales Register Connection successful!\n\nSample document found:\n` +
                            `Billing Document: ${sampleDoc.BillingDocument}\n` +
                            `Sales Document: ${sampleDoc.SalesDocument}\n` +
                            `Document Date: ${this.formatDate(sampleDoc.BillingDocumentDate)}`;

                        // Now test Sales Order API if available
                        this._testSalesOrderAPIConnection(sampleDoc.SalesDocument, sampleDoc.SalesDocumentItem, successMessage);
                    } else {
                        this._setLoading(false);
                        MessageBox.information("Sales Register connection successful but no data returned");
                        console.groupEnd();
                    }
                },
                error: error => {
                    this._setLoading(false);
                    console.error("❌ Sales Register connection test failed:", error);
                    console.groupEnd();
                    this._handleLoadError(error);
                }
            });
        },

        /**
         * Tests the Sales Order API connection using a sample sales order
         * @param {string} sampleSalesOrder - Sample sales order number
         * @param {string} sampleItem - Sample sales order item
         * @param {string} mainMessage - Main success message from sales register test
         */
        _testSalesOrderAPIConnection: function (sampleSalesOrder, sampleItem, mainMessage) {
            console.log("🔄 Testing Sales Order API connection...");

            if (!this.salesOrderTextService) {
                this._setLoading(false);
                MessageBox.warning(mainMessage + "\n\nSales Order Text Service not available - text fields will be empty");
                console.groupEnd();
                return;
            }

            // Test loading text data for the sample sales order
            this.salesOrderTextService._loadTextDataForSingleOrder(sampleSalesOrder, sampleItem || "000010")
                .then(textData => {
                    this._setLoading(false);

                    var hasTextData = Object.values(textData).some(value => value && value.trim());
                    var textMessage = hasTextData ?
                        `\n\nSales Order Text API: ✅ Working\nSample text data loaded successfully` :
                        `\n\nSales Order Text API: ⚠️ Connected but no text data found`;

                    console.log("📊 Sample text data:", textData);

                    MessageBox.success(mainMessage + textMessage);
                    console.groupEnd();
                })
                .catch(error => {
                    this._setLoading(false);
                    console.error("❌ Sales Order API test failed:", error);

                    MessageBox.warning(mainMessage +
                        `\n\nSales Order Text API: ❌ Failed\nText fields will be empty\n\nError: ${error.message || 'Connection failed'}`);
                    console.groupEnd();
                });
        },

        /**
         * Handles the "Load More" button press
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
         * Handles the "Show Summary" button press with enhanced text data reporting
         */
        onShowSummary: function () {
            var data = this.getView().getModel("salesData").getData();
            if (!data.results || data.results.length === 0) {
                MessageBox.warning("No data available for summary.");
                return;
            }

            var documentGroups = data.results.length;
            var originalRecords = data.originalRecordCount || 0;
            var totalInvoiceAmount = data.results.reduce((sum, item) => sum + (item.InvoiceAmount || 0), 0);
            var totalNetAmount = data.results.reduce((sum, item) => sum + (item.TotalNetAmount || 0), 0);
            var totalDiscount = data.results.reduce((sum, item) => sum + (item.DRV1 || 0), 0);

            var uniqueSalesDocuments = new Set(data.results.map(item => item.SalesDocument)).size;
            var uniqueBillingDocuments = new Set(data.results.map(item => item.BillingDocument)).size;
            var uniqueCustomers = new Set(data.results.map(item => item.CustomerNumber).filter(Boolean)).size;

            // Enhanced text data statistics
            var recordsWithTextData = data.recordsWithTextData || 0;
            var textDataPercentage = documentGroups > 0 ? Math.round((recordsWithTextData / documentGroups) * 100) : 0;

            // Count specific text field availability
            var textFieldStats = {
                ZXT1: data.results.filter(item => item.ZXT1).length, // Warehouse Code
                ZXT3: data.results.filter(item => item.ZXT3).length, // Warehouse Location  
                ZXT4: data.results.filter(item => item.ZXT4).length, // Contract ID/Trade ID
                ZXT5: data.results.filter(item => item.ZXT5).length, // Service Period
                ZXT6: data.results.filter(item => item.ZXT6).length, // Material Description
                ZXT7: data.results.filter(item => item.ZXT7).length, // Flag/Cluster ID
                ZXT8: data.results.filter(item => item.ZXT8).length  // Item Number
            };

            var summaryText = `SALES REGISTER REPORT SUMMARY\n\n` +
                `📊 OVERVIEW:\n` +
                `• Document Groups: ${documentGroups}\n` +
                `• Original Records: ${originalRecords}\n` +
                `• Unique Sales Documents: ${uniqueSalesDocuments}\n` +
                `• Unique Billing Documents: ${uniqueBillingDocuments}\n` +
                `• Unique Customers: ${uniqueCustomers}\n\n` +

                `💰 FINANCIAL TOTALS:\n` +
                `• Total Net Amount: ${this.formatNumber(totalNetAmount.toString())}\n` +
                `• Total Discount: ${this.formatNumber(totalDiscount.toString())}\n` +
                `• Total Invoice Amount: ${this.formatNumber(totalInvoiceAmount.toString())}\n\n` +

                `📝 TEXT DATA AVAILABILITY:\n` +
                `• Records with Text Data: ${recordsWithTextData}/${documentGroups} (${textDataPercentage}%)\n` +
                `• Warehouse Code (ZXT1): ${textFieldStats.ZXT1} records\n` +
                `• Contract ID (ZXT4): ${textFieldStats.ZXT4} records\n` +
                `• Service Period (ZXT5): ${textFieldStats.ZXT5} records\n` +
                `• Material Desc (ZXT6): ${textFieldStats.ZXT6} records\n` +
                `• Location (ZXT3): ${textFieldStats.ZXT3} records\n\n` +

                `📈 BREAKDOWN:\n` +
                `• Average Invoice Amount: ${this.formatNumber((totalInvoiceAmount / documentGroups).toString())}\n` +
                `• Auto Text Load: ${recordsWithTextData > 0 ? 'Successful' : 'Failed/No Data'}\n` +
                `• Last Load Time: ${data.lastLoadTime ? (new Date(data.lastLoadTime)).toLocaleString() : "Never"}`;

            MessageBox.information(summaryText, {
                title: "Sales Register Summary with Text Data",
                styleClass: "sapUiSizeCompact"
            });
        },

        /**
         * Handles table search functionality
         */
        onTableSearch: function (event) {
            var query = event.getParameter("query") || event.getParameter("newValue");
            var table = this.byId("salesTable");
            var binding = table.getBinding("rows");

            if (binding) {
                var filters = [];
                if (query && query.length > 0) {
                    var searchFields = [
                        "BillingDocument", "SalesDocument", "CustomerDisplay", "Product",
                        "ProductDescription", "CustomerNumber", "Plant", "ZXT1", "ZXT4", "ZXT6"
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
         * Handles the "Toggle Column" button press
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
         * Handles the "Quick Sort" button press
         */
        onQuickSort: function (event) {
            var button = event.getSource();
            var property = button.data("property");
            var descending = button.data("descending") === "true";
            var table = this.byId("salesTable");
            var binding = table.getBinding("rows");
            if (binding) {
                var sorter = new Sorter(property, descending);
                binding.sort(sorter);
                var sortDirection = descending ? "descending" : "ascending";
                MessageToast.show(`Table sorted by ${property} (${sortDirection})`);
            }
        },

        /**
         * Opens row details dialog
         */
        onViewRowDetails: function (event) {
            var bindingContext = event.getSource().getBindingContext("salesData");
            if (bindingContext) {
                var record = bindingContext.getObject();
                this._showRowDetailsDialog(record);
            }
        },

        /**
         * Handles billing document link press
         */
        onBillingDocumentPress: function (event) {
            var bindingContext = event.getSource().getBindingContext("salesData");
            if (bindingContext) {
                var record = bindingContext.getObject();
                MessageToast.show(`Billing Document: ${record.BillingDocument}`);
                // Add navigation logic here if needed
            }
        },

        /**
         * Handles sales document link press
         */
        onSalesDocumentPress: function (event) {
            var bindingContext = event.getSource().getBindingContext("salesData");
            if (bindingContext) {
                var record = bindingContext.getObject();
                MessageToast.show(`Sales Document: ${record.SalesDocument}`);
                // Add navigation logic here if needed
            }
        },

        // --- Export Functionality ---
        /**
         * Handles the "Export to Excel" button press
         */
        onExportToExcel: function () {
            var data = this.getView().getModel("salesData").getData();
            if (!data.results || data.results.length === 0) {
                MessageBox.warning("No data available to export. Please load data first.");
                return;
            }

            try {
                var columns = this._createExportColumns();
                var fileName = `Sales_Register_Report_${(new Date).toISOString().split("T")[0]}.xlsx`;
                var exportSettings = {
                    workbook: {
                        columns: columns,
                        context: {
                            title: "Sales Register Report - Grouped Data",
                            sheetName: "Sales Data"
                        }
                    },
                    dataSource: data.results,
                    fileName: fileName
                };
                var spreadsheet = new Spreadsheet(exportSettings);
                spreadsheet.build()
                    .then(() => {
                        MessageToast.show(`Exported ${data.results.length} grouped records`);
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
         * Handles the "Export Current View" button press
         */
        onExportCurrentView: function () {
            var table = this.byId("salesTable");
            var binding = table.getBinding("rows");

            if (!binding) {
                MessageBox.warning("No data available to export.");
                return;
            }

            var contexts = binding.getContexts();
            var data = contexts.map(context => context.getObject());
            if (data.length === 0) {
                MessageBox.warning("No data in current view to export.");
                return;
            }

            try {
                var columns = this._createExportColumns();
                var fileName = `Sales_Register_CurrentView_${new Date().toISOString().split("T")[0]}.xlsx`;
                var exportSettings = {
                    workbook: {
                        columns: columns,
                        context: {
                            title: "Sales Register Report - Current View",
                            sheetName: "Current View Data"
                        }
                    },
                    dataSource: data,
                    fileName: fileName
                };
                var spreadsheet = new Spreadsheet(exportSettings);
                spreadsheet.build()
                    .then(() => {
                        MessageToast.show(`Exported ${data.length} records from current view`);
                    })
                    .finally(() => {
                        spreadsheet.destroy();
                    });
            } catch (error) {
                MessageBox.error("Export failed: " + error.message);
            }
        },

        /**
         * Creates the column definitions for the spreadsheet export.
         */
        _createExportColumns: function () {
            return [{
                label: "Invoice Date",
                property: "BillingDocumentDate",
                type: "date"
            }, {
                label: "Arya DTR Invoice No.",
                property: "CustomerReference",
                type: "string"
            }, {
                label: "SAP Invoice No.",
                property: "BillingDocument",
                type: "string"
            }, {
                label: "Contract ID/Trade ID",
                property: "ZXT4",
                type: "string"
            }, {
                label: "Customer Name(sold to)",
                property: "CustomerDisplay",
                type: "string"
            }, {
                label: "Customer State",
                property: "CustomerState",
                type: "string"
            }, {
                label: "Customer GSTIN",
                property: "CustomerGSTIN",
                type: "string"
            }, {
                label: "Terms of Payment",
                property: "CustomerPaymentTerms",
                type: "string"
            }, {
                label: "Sale Order No.",
                property: "SalesDocument",
                type: "string"
            }, {
                label: "Plant",
                property: "Plant",
                type: "string"
            }, {
                label: "Invoice Type",
                property: "BillingDocumentType",
                type: "string"
            }, {
                label: "Customer Code",
                property: "CustomerNumber",
                type: "string"
            }, {
                label: "Material Code",
                property: "Product",
                type: "string"
            }, {
                label: "Material Description",
                property: "ProductDescription",
                type: "string"
            }, {
                label: "Taxable Amount",
                property: "TotalNetAmount",
                type: "number"
            }, {
                label: "Discount",
                property: "DRV1",
                type: "number"
            }, {
                label: "Additional Charges",
                property: "ZDV2",
                type: "number"
            }, {
                label: "IGST",
                property: "JOIG",
                type: "number"
            }, {
                label: "CGST",
                property: "JOCG",
                type: "number"
            }, {
                label: "SGST",
                property: "JOSG",
                type: "number"
            }, {
                label: "Invoice Amount",
                property: "InvoiceAmount",
                type: "number"
            }, {
                label: "Warehouse Code",
                property: "ZXT1",
                type: "string"
            }, {
                label: "Warehouse Location",
                property: "ZXT3",
                type: "string"
            }, {
                label: "E-Invoice Status",
                property: "IN_EDocEWbillStatus",
                type: "string"
            }, {
                label: "Qty.",
                property: "BillingQuantity",
                type: "number"
            }, {
                label: "Rate/MT",
                property: "PPR0",
                type: "number"
            }, {
                label: "Delay Charges",
                property: "ZDV4",
                type: "number"
            }, {
                label: "E-way Bill No.",
                property: "IN_EDocEInvcEWbillNmbr",
                type: "string"
            }, {
                label: "TCS",
                property: "ZTCS",
                type: "number"
            }, {
                label: "Currency",
                property: "TransactionCurrency",
                type: "string"

            }, {
                label: "TIN",
                property: "CustomerGSTIN",
                type: "string"
            }, {
                label: "Product",
                property: "Product",
                type: "string"
            }, {
                label: "Product Description",
                property: "ProductDescription",
                type: "string"
            }, {
                label: "Plant",
                property: "Plant",
                type: "string"
            }, {
                label: "Billing Quantity",
                property: "BillingQuantity",
                type: "number"
            }, {
                label: "Quantity Unit",
                property: "BillingQuantityUnit",
                type: "string"
            }, {
                label: "Net Amount",
                property: "TotalNetAmount",
                type: "number"
            }, {
                label: "Discount",
                property: "DRV1",
                type: "number"
            }, {
                label: "Additional Charges",
                property: "ZDV2",
                type: "number"
            }, {
                label: "IGST",
                property: "JOIG",
                type: "number"
            }, {
                label: "CGST",
                property: "JOCG",
                type: "number"
            }, {
                label: "SGST",
                property: "JOSG",
                type: "number"
            }, {
                label: "TCS",
                property: "ZTCS",
                type: "number"
            }, {
                label: "Delay Charges",
                property: "ZDV4",
                type: "number"
            }, {
                label: "Invoice Amount",
                property: "InvoiceAmount",
                type: "number"
            }, {
                label: "Currency",
                property: "TransactionCurrency",
                type: "string"
            }, {
                label: "E-Invoice Status",
                property: "IN_EDocEWbillStatus",
                type: "string"
            }, {
                label: "E-Way Bill Number",
                property: "IN_EDocEInvcEWbillNmbr",
                type: "string"
            }, {
                label: "Warehouse Code",
                property: "ZXT1",
                type: "string"
            }, {
                label: "Warehouse Location",
                property: "ZXT3",
                type: "string"
            }, {
                label: "Contract/Trade ID",
                property: "ZXT4",
                type: "string"
            }, {
                label: "Service Period",
                property: "ZXT5",
                type: "string"
            }, {
                label: "Material Description",
                property: "ZXT6",
                type: "string"
            }];
        },

        // --- Helper Methods ---
        /**
         * Shows row details dialog
         */
        _showRowDetailsDialog: async function (record) {
            if (!this._oRowDetailsDialog) {
                this._oRowDetailsDialog = await Fragment.load({
                    id: this.getView().getId(),
                    name: "aryasalesregister.view.fragments.RowDetailsDialog",
                    controller: this
                });
                this.getView().addDependent(this._oRowDetailsDialog);
            }

            var detailModel = new JSONModel({ details: record });
            this._oRowDetailsDialog.setModel(detailModel, "details");
            this._oRowDetailsDialog.open();
        },

        /**
         * Closes row details dialog
         */
        onCloseRowDetailsDialog: function () {
            if (this._oRowDetailsDialog) {
                this._oRowDetailsDialog.close();
            }
        },

        /**
         * Checks if there are active filters
         */
        _hasActiveFilters: function (filterData) {
            return !!(filterData.billingDocument?.trim() ||
                filterData.salesOrder?.trim() ||
                filterData.billingDocumentType?.trim() ||
                filterData.fromDate ||
                filterData.toDate);
        },

        /**
         * Validates filter data
         */
        _validateFilterData: function (filterData) {
            var errors = [];

            if (filterData.billingDocument && !/^\d+$/.test(filterData.billingDocument)) {
                errors.push("Billing Document must be numeric");
            }

            if (filterData.salesOrder && !/^\d+$/.test(filterData.salesOrder)) {
                errors.push("Sales Order must be numeric");
            }

            if (filterData.fromDate && filterData.toDate) {
                if (new Date(filterData.fromDate) > new Date(filterData.toDate)) {
                    errors.push("From Date cannot be later than To Date");
                }
            }

            return errors;
        },

        /**
         * Finalizes the data load process with automatic text data integration
         */
        _finishDataLoad: function (processedData, isLoadMore, totalCount) {
            var totalAmount = processedData.reduce((sum, record) => sum + (record.InvoiceAmount || 0), 0);
            var existingData = isLoadMore ? this.getView().getModel("salesData").getProperty("/results") : [];
            var finalData = existingData.concat(processedData);

            // Count records with text data for reporting
            var recordsWithTextData = finalData.filter(record =>
                record.ZXT1 || record.ZXT3 || record.ZXT4 || record.ZXT5 || record.ZXT6 || record.ZXT7 || record.ZXT8
            ).length;

            this.getView().getModel("salesData").setData({
                results: finalData,
                count: finalData.length,
                totalCount: totalCount,
                originalRecordCount: isLoadMore ?
                    this.getView().getModel("salesData").getProperty("/originalRecordCount") + processedData.length :
                    processedData.length,
                totalAmount: totalAmount,
                lastLoadTime: (new Date).toISOString(),
                recordsWithTextData: recordsWithTextData // Track text data availability
            });

            var hasMore = finalData.length < totalCount;
            this.getView().getModel("pagination").setData({
                hasMore: hasMore,
                currentSkip: finalData.length,
                pageSize: this.getView().getModel("filterData").getProperty("/pagingTop") || 500,
                totalRecords: totalCount,
                loadedRecords: finalData.length
            });

            this._setLoading(false);

            var message = isLoadMore ?
                `Loaded ${processedData.length} additional grouped records` :
                `Successfully loaded ${finalData.length} grouped sales records`;

            // Add text data info to the message
            if (recordsWithTextData > 0) {
                message += ` (${recordsWithTextData} with text data)`;
            }

            MessageToast.show(message);

            console.log(`📊 Final data summary: ${finalData.length} total records, ${recordsWithTextData} with text data`);
        },

        /**
         * Handles data loading errors
         */
        _handleLoadError: function (error) {
            console.error("❌ Sales data load error:", error);
            this._setLoading(false);
            MessageBox.error(`Data loading failed: ${error.message}\n\nCheck browser console for details.`);
        },

        /**
         * Builds error messages from error objects
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
            } else if (error.statusText) {
                message += `: ${error.statusText}`;
            }

            return message;
        },

        /**
         * Sets the loading state
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
         * Parses amount values
         */
        _parseAmount: function (amount) {
            if (typeof amount === 'number') return amount;
            if (typeof amount === 'string') {
                var parsed = parseFloat(amount.replace(/[^\d.-]/g, ''));
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        },

        /**
         * Parses quantity values
         */
        _parseQuantity: function (quantity) {
            if (typeof quantity === 'number') return quantity;
            if (typeof quantity === 'string') {
                var parsed = parseFloat(quantity.replace(/[^\d.-]/g, ''));
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        },

        // --- Formatters ---
        /**
         * Formats numbers with Indian locale
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
         * Formats dates
         */
        formatDate: function (date) {
            if (!date) return "";
            if (typeof date === "string" && date.includes("/Date(")) {
                var timestamp = parseInt(date.match(/\d+/)[0]);
                return new Date(timestamp).toLocaleDateString("en-IN");
            }
            return new Date(date).toLocaleDateString("en-IN");
        },

        /**
         * Formats E-Invoice status state
         */
        formatEInvoiceState: function (status) {
            if (!status) return "None";
            switch (status.toUpperCase()) {
                case "SUCCESS":
                case "COMPLETED":
                    return "Success";
                case "PENDING":
                case "IN_PROGRESS":
                    return "Warning";
                case "FAILED":
                case "ERROR":
                    return "Error";
                default:
                    return "Information";
            }
        }
    });
});
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
            this._loadColumnSettings();
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
         */
        _initializeModels: function () {
            var salesDataModel = new JSONModel({
                results: [],
                count: 0,
                totalCount: 0,
                originalRecordCount: 0,
                totalAmount: 0,
                lastLoadTime: null,
                recordsWithTextData: 0
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
                autoRefresh: false,
                showConditionDetails: true
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

        // --- Event Handlers ---
        /**
         * Handles the "Load Data" button press
         */
        onLoadData: function () {
            this._loadData();
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
                    totalCount: 0,
                    originalRecordCount: 0,
                    totalAmount: 0,
                    recordsWithTextData: 0
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

            console.log(`📊 Loading data: skip=${currentSkip}, pageSize=${pageSize}, isLoadMore=${isLoadMore}`);

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

                console.log(`🔗 Loading from: ${path}`);
                console.log(`📋 URL Parameters:`, urlParameters);
                console.log(`🔍 Filters:`, filters.length, "active filters");

                salesModel.read(path, {
                    filters: filters,
                    urlParameters: urlParameters,
                    success: data => {
                        var results = data.results || [];
                        results.totalCount = data.__count;
                        results.hasNext = !!data.__next;
                        results.skip = skip;
                        results.top = top;
                        
                        console.log(`✅ Data loaded: ${results.length} records, total count: ${data.__count}, skip: ${skip}`);
                        
                        resolve(results);
                    },
                    error: error => {
                        var errorMessage = this._buildErrorMessage("Sales Data", error);
                        console.error("❌ Sales data load error:", error);
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

            // Store original record count
            var originalRecordCount = salesResult.length;

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

            // Set original record count in model
            if (!isLoadMore) {
                this.getView().getModel("salesData").setProperty("/originalRecordCount", originalRecordCount);
            }

            this._finishDataLoad(groupedData, isLoadMore, salesResult.totalCount);

            return Promise.resolve();
        },

        /**
         * Groups sales data by Sales Document and Item, calculating invoice amounts
         * This is different from GST grouping - it groups by Sales Document + Item combination
         * @param {Object[]} salesData - The raw sales data with enhanced text data
         * @returns {Object[]} Array of grouped sales summaries
         */
        _groupSalesDataByDocumentAndItem: function (salesData) {
            console.log("📊 Grouping sales data by Sales Document & Item with invoice calculation...");

            var groupedData = {};

            salesData.forEach(item => {
                var groupKey = `${item.SalesDocument || 'N/A'}_${item.SalesDocumentItem || '000010'}`;

                if (!groupedData[groupKey]) {
                    // Initialize document group with enhanced data
                    groupedData[groupKey] = {
                        // Document identifiers
                        BillingDocument: item.BillingDocument,
                        SalesDocument: item.SalesDocument,
                        SalesDocumentItem: item.SalesDocumentItem,
                        BillingDocumentDate: item.BillingDocumentDate,
                        BillingDocumentType: item.BillingDocumentType,

                        // Customer information
                        CustomerNumber: item.PayerParty,
                        CustomerDisplay: item.CustomerFullName_1,
                        CustomerState: item.Region,
                        CustomerGSTIN: item.BusinessPartnerName1,
                        CustomerPaymentTerms: item.CustomerPaymentTerms,

                        // Product information
                        Product: item.Product,
                        ProductDescription: item.BillingDocumentItemText,
                        BillingDocumentItemText: item.BillingDocumentItemText, // Keep both for compatibility
                        Plant: item.Plant,
                        BillingQuantity: this._parseQuantity(item.BillingQuantity),
                        BillingQuantityUnit: item.BillingQuantityUnit,

                        // Currency and additional fields
                        TransactionCurrency: item.TransactionCurrency,
                        Division: item.Division,
                        TaxCode: item.TaxCode,
                        ProfitCenter: item.ProfitCenter,

                        // Due Date calculation (approximation - you may need to adjust this based on payment terms)
                        NetDueDate: this._calculateDueDate(item.BillingDocumentDate, item.CustomerPaymentTerms),

                        // Customer Type (derive from available data or set default)
                        CustomerType: this._deriveCustomerType(item),

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

                        // Sales order text fields (from auto-fetch)
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

        /**
         * Calculate due date based on billing date and payment terms
         * @param {Date} billingDate - The billing document date
         * @param {string} paymentTerms - Payment terms code (e.g., "NT90", "NT30")
         * @returns {Date} Calculated due date
         */
        _calculateDueDate: function (billingDate, paymentTerms) {
            if (!billingDate) return null;

            var baseDate = new Date(billingDate);
            var days = 0;

            // Extract days from payment terms (simple parsing)
            if (paymentTerms) {
                var matches = paymentTerms.match(/\d+/);
                if (matches) {
                    days = parseInt(matches[0], 10);
                }
            }

            // Default to 30 days if no payment terms found
            if (days === 0) {
                days = 30;
            }

            var dueDate = new Date(baseDate);
            dueDate.setDate(dueDate.getDate() + days);

            return dueDate;
        },

        /**
         * Derive customer type from available data
         * @param {Object} item - Sales data item
         * @returns {string} Customer type ("B2B", "B2C", or "Unknown")
         */
        _deriveCustomerType: function (item) {
            // Simple logic - you may need to adjust based on your business rules
            if (item.BusinessPartnerName1 && item.BusinessPartnerName1.trim()) {
                // If GSTIN is present, likely B2B
                return "B2B";
            }
            return "B2C"; // Default assumption
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
            
            // Always add skip parameter if it's greater than 0
            if (skip > 0) {
                params["$skip"] = skip;
                console.log(`📊 Adding skip parameter: ${skip}`);
            }
            
            console.log(`📋 Built URL parameters:`, params);
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
                "IN_EDocEWbillStatus,IN_EDocEInvcEWbillNmbr";
        },

        // --- Quick Date Filter Methods ---
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
                    lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
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
                totalAmount: 0,
                recordsWithTextData: 0
            });

            MessageToast.show("Filters cleared");
        },

        /**
         * Handles the "Test Connection" button press
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
         * Handles the "Load More" button press with improved duplicate handling
         */
        onLoadMoreData: function () {
            var paginationData = this.getView().getModel("pagination").getData();
            if (!paginationData.hasMore) {
                MessageToast.show("No more data to load");
                return;
            }

            // Use the pagination model's currentSkip value for proper pagination
            var nextSkip = paginationData.currentSkip;
            
            console.log(`🔄 Loading more data: skip=${nextSkip}, current records=${paginationData.loadedRecords}, total=${paginationData.totalRecords}`);

            this._loadData(true, nextSkip);
        },
        /**
         * Shows current pagination status for debugging
         */
        onShowPaginationStatus: function () {
            var paginationData = this.getView().getModel("pagination").getData();
            var salesData = this.getView().getModel("salesData").getData();
            
            var statusText = `PAGINATION STATUS\n\n` +
                `📊 Current State:\n` +
                `• Has More: ${paginationData.hasMore}\n` +
                `• Current Skip: ${paginationData.currentSkip}\n` +
                `• Page Size: ${paginationData.pageSize}\n` +
                `• Total Records: ${paginationData.totalRecords}\n` +
                `• Loaded Records: ${paginationData.loadedRecords}\n` +
                `• Displayed Results: ${salesData.results ? salesData.results.length : 0}\n\n` +
                
                `🔍 Next Load Info:\n` +
                `• Next Skip Value: ${paginationData.currentSkip}\n` +
                `• Remaining Records: ${paginationData.totalRecords - paginationData.loadedRecords}\n` +
                `• Can Load More: ${paginationData.hasMore ? 'Yes' : 'No'}`;

            MessageBox.information(statusText, {
                title: "Pagination Status",
                styleClass: "sapUiSizeCompact"
            });
        },

        /**
         * Shows current table data state for debugging
         */
        onShowTableDataState: function () {
            var salesData = this.getView().getModel("salesData").getData();
            var paginationData = this.getView().getModel("pagination").getData();
            
            var statusText = `TABLE DATA STATE\n\n` +
                `📊 Sales Data Model:\n` +
                `• Total Results: ${salesData.results ? salesData.results.length : 0}\n` +
                `• Original Record Count: ${salesData.originalRecordCount || 0}\n` +
                `• Total Count: ${salesData.totalCount || 0}\n` +
                `• Total Amount: ${this.formatNumber((salesData.totalAmount || 0).toString())}\n` +
                `• Records with Text: ${salesData.recordsWithTextData || 0}\n\n` +
                
                `📊 Pagination Model:\n` +
                `• Has More: ${paginationData.hasMore}\n` +
                `• Current Skip: ${paginationData.currentSkip}\n` +
                `• Loaded Records: ${paginationData.loadedRecords}\n` +
                `• Total Records: ${paginationData.totalRecords}\n\n` +
                
                `🔍 Table Binding:\n` +
                `• Table ID: salesTable\n` +
                `• Binding Path: /results\n` +
                `• Model: salesData`;

            MessageBox.information(statusText, {
                title: "Table Data State",
                styleClass: "sapUiSizeCompact"
            });
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

            // Customer Type statistics
            var b2bCustomers = data.results.filter(item => item.CustomerType === 'B2B').length;
            var b2cCustomers = data.results.filter(item => item.CustomerType === 'B2C').length;
            var b2bPercentage = documentGroups > 0 ? Math.round((b2bCustomers / documentGroups) * 100) : 0;

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

                `👥 CUSTOMER TYPE BREAKDOWN:\n` +
                `• B2B Customers: ${b2bCustomers} (${b2bPercentage}%)\n` +
                `• B2C Customers: ${b2cCustomers} (${100 - b2bPercentage}%)\n\n` +

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
         * Handles the "Load All" button press to load all remaining data
         */
        onLoadAllData: function () {
            var paginationData = this.getView().getModel("pagination").getData();
            if (!paginationData.hasMore) {
                MessageToast.show("No more data to load");
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
         * Sets the pagingTop to load all remaining records and triggers a data load.
         */
        _loadAllRemainingData: function () {
            var paginationData = this.getView().getModel("pagination").getData();
            var remainingRecords = paginationData.totalRecords - paginationData.loadedRecords;
            if (remainingRecords > 0) {
                // Temporarily increase the page size to load all remaining records
                var currentPageSize = this.getView().getModel("filterData").getProperty("/pagingTop");
                this.getView().getModel("filterData").setProperty("/pagingTop", remainingRecords);
                
                // Load the data
                this._loadData(true, paginationData.loadedRecords);
                
                // Reset the page size back to original
                setTimeout(() => {
                    this.getView().getModel("filterData").setProperty("/pagingTop", currentPageSize);
                }, 1000);
            }
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
            console.log("🔍 View row details button clicked");
            
            var bindingContext = event.getSource().getBindingContext("salesData");
            if (bindingContext) {
                var record = bindingContext.getObject();
                console.log("📋 Record data for details:", record);
                this._showRowDetailsDialog(record);
            } else {
                console.error("❌ No binding context found for details");
                MessageBox.error("No record data available for details");
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

        // --- Column Visibility Management ---
        /**
         * Column Visibility Management
         */
        onToggleColumn: function (oEvent) {
            // Get the column ID from the custom data
            var sColumnId = oEvent.getSource().data("columnId");
            var oColumn = this.byId(sColumnId);

            if (oColumn) {
                // Toggle visibility
                var bVisible = !oColumn.getVisible();
                oColumn.setVisible(bVisible);

                // Update the icon in the menu item
                var sIcon = bVisible ? "sap-icon://accept" : "sap-icon://decline";
                oEvent.getSource().setIcon(sIcon);

                // Save column visibility settings to user preferences
                this._saveColumnSettings();
            }
        },

        onSelectAllColumns: function () {
            this._setAllColumnsVisibility(true);
        },

        onDeselectAllColumns: function () {
            // Keep at least one column visible
            this._setAllColumnsVisibility(false, true);
        },

        onResetDefaultColumns: function () {
            // Define your default visible columns
            var aDefaultVisibleColumns = [
                "docDateCol", "billingDocCol", "salesDocCol", "customerNameCol",
                "materialCol", "netAmountCol", "discountCol", "invoiceAmountCol", "actionsCol"
            ];

            // Set visibility based on default configuration
            var oTable = this.byId("salesTable");
            var aColumns = oTable.getColumns();

            aColumns.forEach(function (oColumn) {
                var sColumnId = oColumn.getId().replace(this.createId(""), "");
                var bVisible = aDefaultVisibleColumns.indexOf(sColumnId) !== -1;
                oColumn.setVisible(bVisible);

                // Update the icon in the menu item
                var oMenuItem = this._findMenuItemByColumnId(sColumnId);
                if (oMenuItem) {
                    oMenuItem.setIcon(bVisible ? "sap-icon://accept" : "sap-icon://decline");
                }
            }.bind(this));

            // Save column visibility settings to user preferences
            this._saveColumnSettings();
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
                label: "Customer Type",
                property: "CustomerType",
                type: "string"
            }, {
                label: "Material Code",
                property: "Product",
                type: "string"
            }, {
                label: "Material Description",
                property: "BillingDocumentItemText",
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
            }];
        },

        // --- Helper Methods ---
        /**
         * Shows row details dialog
         */
        _showRowDetailsDialog: async function (record) {
            try {
                if (!this._oRowDetailsDialog) {
                    console.log("🔄 Loading details dialog fragment...");
                    
                    this._oRowDetailsDialog = await Fragment.load({
                        id: this.getView().getId(),
                        name: "aryasalesregister.view.DetailsDialogFragment",
                        controller: this
                    });
                    
                    if (!this._oRowDetailsDialog) {
                        throw new Error("Failed to load details dialog fragment");
                    }
                    
                    this.getView().addDependent(this._oRowDetailsDialog);
                    console.log("✅ Details dialog fragment loaded successfully");
                }

                if (!record) {
                    MessageBox.error("No record data available for details");
                    return;
                }

                console.log("📋 Setting details data:", record);
                
                // Create a stable model with frozen data to prevent binding flickering
                var stableRecord = JSON.parse(JSON.stringify(record)); // Deep clone to prevent reference issues
                var detailModel = new JSONModel(stableRecord);
                
                // Set the model before opening the dialog to ensure stable bindings
                this._oRowDetailsDialog.setModel(detailModel, "details");
                
                // Create a stable filterData model for the dialog
                var stableFilterData = {
                    showConditionDetails: true,
                    // Add any other needed filter properties with stable values
                    dialogMode: true
                };
                var dialogFilterModel = new JSONModel(stableFilterData);
                this._oRowDetailsDialog.setModel(dialogFilterModel, "filterData");
                console.log("🔗 Stable FilterData model set on dialog");
                
                // Debug: Check what models are available on the dialog
                console.log("🔍 Details model data:", detailModel.getData());
                console.log("🔍 FilterData model available:", !!this._oRowDetailsDialog.getModel("filterData"));
                
                // Open dialog immediately after model is set to prevent flickering
                if (this._oRowDetailsDialog && !this._oRowDetailsDialog.isOpen()) {
                    this._oRowDetailsDialog.open();
                    console.log("✅ Details dialog opened successfully");
                } else {
                    console.log("⚠️ Dialog is already open or not available");
                }
                
            } catch (error) {
                console.error("❌ Failed to show details dialog:", error);
                MessageBox.error("Failed to open details dialog: " + error.message);
            }
        },

        /**
         * Closes row details dialog
         */
        onCloseRowDetailsDialog: function () {
            if (this._oRowDetailsDialog && this._oRowDetailsDialog.isOpen()) {
                this._oRowDetailsDialog.close();
            }
        },

        /**
         * Closes details dialog (for compatibility with fragment)
         */
        onCloseDetailsDialog: function () {
            if (this._oRowDetailsDialog && this._oRowDetailsDialog.isOpen()) {
                this._oRowDetailsDialog.close();
            }
        },

        /**
         * Handles the "Refresh Sales Order Text" button press in details dialog
         */
        onRefreshSalesOrderText: function () {
            var detailModel = this._oRowDetailsDialog.getModel("details");
            if (!detailModel) {
                MessageToast.show("No record data available for refresh");
                return;
            }

            var record = detailModel.getData();
            if (!record.SalesDocument) {
                MessageToast.show("No sales document available for text refresh");
                return;
            }

            MessageToast.show("Refreshing sales order text data...");
            
            // Call the text service to refresh data for this specific record
            if (this.salesOrderTextService) {
                this.salesOrderTextService._loadTextDataForSingleOrder(record.SalesDocument, record.SalesDocumentItem || "000010")
                    .then(textData => {
                        // Update the record with new text data
                        Object.assign(record, textData);
                        
                        // Update the model to refresh the UI
                        detailModel.refresh(true);
                        
                        MessageToast.show("Sales order text data refreshed successfully");
                    })
                    .catch(error => {
                        console.error("Failed to refresh text data:", error);
                        MessageBox.error("Failed to refresh text data: " + error.message);
                    });
            } else {
                MessageBox.warning("Sales Order Text Service not available");
            }
        },

        /**
         * Handles the "Export Single Record" button press in details dialog
         */
        onExportSingleRecord: function () {
            var detailModel = this._oRowDetailsDialog.getModel("details");
            if (!detailModel) {
                MessageBox.warning("No record data available for export");
                return;
            }

            var record = detailModel.getData();
            if (!record) {
                MessageBox.warning("No record data available for export");
                return;
            }

            try {
                // Create export data for this single record
                var exportData = [record];
                var columns = this._createExportColumns();
                var fileName = `Sales_Record_${record.BillingDocument || 'Unknown'}_${new Date().toISOString().split("T")[0]}.xlsx`;
                
                var exportSettings = {
                    workbook: {
                        columns: columns,
                        context: {
                            title: `Sales Record - ${record.BillingDocument}`,
                            sheetName: "Record Details"
                        }
                    },
                    dataSource: exportData,
                    fileName: fileName
                };

                var spreadsheet = new Spreadsheet(exportSettings);
                spreadsheet.build()
                    .then(() => {
                        MessageToast.show(`Record exported successfully: ${fileName}`);
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
         * Helper Methods for Column Management
         */
        _setAllColumnsVisibility: function (bVisible, bKeepOne) {
            var oTable = this.byId("salesTable");
            var aColumns = oTable.getColumns();

            aColumns.forEach(function (oColumn, iIndex) {
                // If bKeepOne is true, keep the first column visible
                var bMakeVisible = bVisible || (bKeepOne && iIndex === 0);
                oColumn.setVisible(bMakeVisible);

                // Update the icon in the menu item
                var sColumnId = oColumn.getId().replace(this.createId(""), "");
                var oMenuItem = this._findMenuItemByColumnId(sColumnId);
                if (oMenuItem) {
                    oMenuItem.setIcon(bMakeVisible ? "sap-icon://accept" : "sap-icon://decline");
                }
            }.bind(this));

            // Save column visibility settings to user preferences
            this._saveColumnSettings();
        },

        _findMenuItemByColumnId: function (sColumnId) {
            var oMenu = this.byId("columnVisibilityMenu");
            var aItems = oMenu.getItems();

            for (var i = 0; i < aItems.length; i++) {
                var oItem = aItems[i];
                var oCustomData = oItem.getCustomData();

                for (var j = 0; oCustomData && j < oCustomData.length; j++) {
                    if (oCustomData[j].getKey() === "columnId" && oCustomData[j].getValue() === sColumnId) {
                        return oItem;
                    }
                }
            }

            return null;
        },

        _saveColumnSettings: function () {
            // Save column settings to user preferences
            var oColumnLayout = this._getColumnLayout();

            // For now, just log to console. Replace with your preferred storage method
            console.log("Column settings saved:", oColumnLayout);

            // Example with localStorage:
            try {
                localStorage.setItem("salesRegisterColumnSettings", JSON.stringify(oColumnLayout));
            } catch (e) {
                console.error("Failed to save column settings:", e);
            }
        },

        _getColumnLayout: function () {
            var oTable = this.byId("salesTable");
            var aColumns = oTable.getColumns();
            var aColumnLayout = [];

            aColumns.forEach(function (oColumn, iIndex) {
                var sColumnId = oColumn.getId().replace(this.createId(""), "");
                aColumnLayout.push({
                    id: sColumnId,
                    visible: oColumn.getVisible(),
                    index: iIndex
                });
            }.bind(this));

            return aColumnLayout;
        },

        _loadColumnSettings: function () {
            // Load column settings from user preferences
            try {
                var sSettings = localStorage.getItem("salesRegisterColumnSettings");
                if (sSettings) {
                    var oColumnLayout = JSON.parse(sSettings);
                    this._applyColumnLayout(oColumnLayout);
                    return true;
                }
            } catch (e) {
                console.error("Failed to load column settings:", e);
            }

            return false;
        },

        _applyColumnLayout: function (aColumnLayout) {
            var oTable = this.byId("salesTable");

            // Apply visibility settings
            aColumnLayout.forEach(function (oColumnData) {
                var oColumn = this.byId(oColumnData.id);
                if (oColumn) {
                    oColumn.setVisible(oColumnData.visible);

                    // Update the icon in the menu item
                    var oMenuItem = this._findMenuItemByColumnId(oColumnData.id);
                    if (oMenuItem) {
                        oMenuItem.setIcon(oColumnData.visible ? "sap-icon://accept" : "sap-icon://decline");
                    }
                }
            }.bind(this));
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
         * Now ensures no duplicate groups when loading more data
         */
        _finishDataLoad: function (processedData, isLoadMore, totalCount) {
            var totalAmount = 0;
            var existingData = isLoadMore ? this.getView().getModel("salesData").getProperty("/results") : [];
            var finalData = [];

            // Create a map to track unique groups (SalesDocument + SalesDocumentItem)
            var groupMap = {};

            // First, add all existing groups to the map
            existingData.forEach(record => {
                var groupKey = `${record.SalesDocument || 'N/A'}_${record.SalesDocumentItem || '000010'}`;
                groupMap[groupKey] = record;
            });

            // Then, add new groups only if they don't already exist
            processedData.forEach(record => {
                var groupKey = `${record.SalesDocument || 'N/A'}_${record.SalesDocumentItem || '000010'}`;
                if (!groupMap[groupKey]) {
                    groupMap[groupKey] = record;
                } else {
                    console.log(`⚠️ Skipping duplicate group: ${groupKey}`);
                }
            });

            // Convert the map back to array
            finalData = Object.values(groupMap);

            // Sort the final data to maintain order
            finalData.sort((a, b) => {
                if (a.SalesDocument !== b.SalesDocument) return a.SalesDocument.localeCompare(b.SalesDocument);
                return a.SalesDocumentItem.localeCompare(b.SalesDocumentItem);
            });

            // Calculate total amount
            totalAmount = finalData.reduce((sum, record) => sum + (record.InvoiceAmount || 0), 0);

            // Count records with text data for reporting
            var recordsWithTextData = finalData.filter(record =>
                record.ZXT1 || record.ZXT3 || record.ZXT4 || record.ZXT5 || record.ZXT6 || record.ZXT7 || record.ZXT8
            ).length;

            // Update sales data model
            var salesDataModel = this.getView().getModel("salesData");
            salesDataModel.setData({
                results: finalData,
                count: finalData.length,
                totalCount: totalCount,
                originalRecordCount: isLoadMore ?
                    this.getView().getModel("salesData").getProperty("/originalRecordCount") + processedData.length :
                    this.getView().getModel("salesData").getProperty("/originalRecordCount") || processedData.length,
                totalAmount: totalAmount,
                lastLoadTime: (new Date).toISOString(),
                recordsWithTextData: recordsWithTextData // Track text data availability
            });
            
                        // Force refresh the model to ensure table binding updates
            salesDataModel.refresh(true);
            
            // Ensure table binding is properly updated
            var salesTable = this.byId("salesTable");
            if (salesTable) {
                var tableBinding = salesTable.getBinding("items");
                if (tableBinding) {
                    tableBinding.refresh();
                    console.log("✅ Table binding refreshed successfully");
                } else {
                    console.log("⚠️ No table binding found, table may not be properly configured");
                }
            } else {
                console.log("⚠️ Sales table not found");
            }
            
            // Calculate if there are more records to load
            var hasMore = false;
            if (totalCount && finalData.length < totalCount) {
                hasMore = true;
            }

            // Update pagination model with proper skip calculation
            var pageSize = this.getView().getModel("filterData").getProperty("/pagingTop") || 500;
            
            // CRITICAL FIX: For load more, we need to track the actual loaded records from backend
            // not just the final displayed records (which might be deduplicated)
            var actualLoadedRecords = isLoadMore ? 
                (this.getView().getModel("pagination").getProperty("/loadedRecords") + processedData.length) : 
                processedData.length;
            
            // The next skip should be based on what we've actually loaded from backend, not displayed
            var nextSkip = actualLoadedRecords;
            
            this.getView().getModel("pagination").setData({
                hasMore: hasMore,
                currentSkip: nextSkip, // This is the skip value for next load
                pageSize: pageSize,
                totalRecords: totalCount || 0,
                loadedRecords: actualLoadedRecords
            });

            this._setLoading(false);

            var message = isLoadMore ?
                `Loaded ${processedData.length} additional records, ${finalData.length - existingData.length} unique groups added` :
                `Successfully loaded ${finalData.length} grouped sales records`;

            // Add text data info to the message
            if (recordsWithTextData > 0) {
                message += ` (${recordsWithTextData} with text data)`;
            }

            // Add pagination info
            if (hasMore) {
                message += `. More data available (${totalCount - finalData.length} records remaining)`;
            }

            MessageToast.show(message);

            console.log(`📊 Final data summary: ${finalData.length} total records, ${recordsWithTextData} with text data`);
            console.log(`📊 Pagination: hasMore=${hasMore}, nextSkip=${nextSkip}, totalRecords=${totalCount}`);
            console.log(`📊 Data breakdown: existing=${existingData.length}, new=${processedData.length}, final=${finalData.length}`);

            // Log duplicates if any were found
            if (isLoadMore && processedData.length > (finalData.length - existingData.length)) {
                var duplicates = processedData.length - (finalData.length - existingData.length);
                console.log(`⚠️ Skipped ${duplicates} duplicate group(s) during load more`);
            }
            
            // Final verification log
            console.log(`🔍 VERIFICATION: Table should now show ${finalData.length} records`);
            console.log(`🔍 VERIFICATION: Next load will skip ${nextSkip} records`);
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
        },

        /**
         * Formats document type state for display
         */
        formatDocTypeState: function (docType) {
            if (!docType) return "None";
            switch (docType.toUpperCase()) {
                case "F2":
                    return "Success"; // Invoice
                case "G2":
                    return "Warning"; // Credit Memo
                case "L2":
                    return "Error"; // Debit Memo
                default:
                    return "Information";
            }
        },

        /**
         * Formats region state for display
         */
        formatRegionState: function (region) {
            if (!region) return "None";
            // Add your region-specific logic here
            return "Information";
        },

        /**
         * Formats amount state for display
         */
        formatAmountState: function (amount) {
            if (!amount || amount === 0) return "None";
            if (amount > 0) return "Success";
            if (amount < 0) return "Error";
            return "Information";
        },

        /**
         * Formats condition state for display
         */
        formatConditionState: function (amount) {
            if (!amount || amount === 0) return "None";
            if (amount > 0) return "Success";
            if (amount < 0) return "Error";
            return "Information";
        }
    });
});
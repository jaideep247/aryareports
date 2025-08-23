// =================== services/SalesDataService.js - CORRECTED ===================
sap.ui.define([
    "sap/ui/base/Object",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (BaseObject, MessageBox, Filter, FilterOperator) {
    "use strict";

    return BaseObject.extend("aryasalesregister.services.SalesDataService", {

        constructor: function (oController) {
            this._controller = oController;
        },

        /**
         * Validates the Sales Register service configuration
         */
        validateConfiguration: function () {
            console.group("🔧 Validating Sales Register Configuration");
            const oMainModel = this._controller.getView().getModel();
            if (!oMainModel) {
                console.error("❌ Sales Register Model not found - check manifest.json");
            } else {
                console.log("✅ Sales Register Model configured:", oMainModel.sServiceUrl);
                oMainModel.getMetaModel().loaded().then(() => {
                    console.log("✅ Sales Register Metadata loaded successfully");
                }).catch(error => {
                    console.error("❌ Sales Register Metadata failed:", error);
                });
            }
            console.groupEnd();
        },

        /**
         * Main method to load sales data from the OData service
         * Automatically determines whether to use pagination or load all data based on filters
         * @param {number} skip - Number of records to skip for pagination
         * @param {number} top - Number of records to fetch (default 100)
         * @param {boolean} forceLoadAll - Force loading all data regardless of filters
         * @returns {Promise} Promise that resolves with sales data
         */
        loadSalesData: function (skip = 0, top = 100, forceLoadAll = false) {
            return new Promise((resolve, reject) => {
                console.log("📊 Loading Sales Register Data...");

                const salesModel = this._controller.getView().getModel();
                if (!salesModel) {
                    reject(new Error("Sales Register Model not found"));
                    return;
                }

                const filters = this._buildFilters();
                const hasActiveFilters = this._hasActiveFilters();

                // 🎯 KEY LOGIC: Load all data if filters are active or forced
                const shouldLoadAll = hasActiveFilters || forceLoadAll;

                const urlParameters = {
                    $select: this._getSelectFields(),
                    $orderby: this._buildOrderBy("document"),
                    $inlinecount: "allpages"
                };

                // Only add pagination parameters if NOT loading all data
                if (!shouldLoadAll) {
                    urlParameters["$top"] = top;
                    if (skip > 0) {
                        urlParameters["$skip"] = skip;
                    }
                    console.log("📄 Using pagination - Top:", top, "Skip:", skip);
                } else {
                    console.log("🚀 Loading ALL data (filters active or forced)");
                }

                const path = "/YY1_SALESREGISTER";
                console.log("🔗 Sales Register Path:", path);
                console.log("📋 URL Parameters:", urlParameters);
                console.log("🔍 Filters:", filters);
                console.log("🎯 Has Active Filters:", hasActiveFilters);
                console.log("📊 Load Strategy:", shouldLoadAll ? "LOAD ALL" : "PAGINATED");

                salesModel.read(path, {
                    filters: filters,
                    urlParameters: urlParameters,
                    success: data => {
                        console.log("✅ Sales Register data loaded successfully:", data.results?.length || 0, "records");
                        const results = data.results || [];
                        results.totalCount = data.__count;
                        results.isLoadAll = shouldLoadAll;
                        results.hasActiveFilters = hasActiveFilters;
                        resolve(results);
                    },
                    error: error => {
                        console.error("❌ Sales Register load error:", error);
                        const errorMessage = this._buildErrorMessage("Sales Register Data", error);
                        reject(new Error(errorMessage));
                    }
                });
            });
        },

        /**
         * Load next batch of data for pagination (scroll loading)
         * @param {number} skip - Number of records to skip
         * @param {number} top - Number of records to fetch (default 100)
         * @returns {Promise} Promise that resolves with next batch of data
         */
        loadNextBatch: function (skip, top = 100) {
            console.log("📄 Loading next batch - Skip:", skip, "Top:", top);
            return this.loadSalesData(skip, top, false); // Force pagination mode
        },

        /**
         * Checks if there are any active filters applied
         * @returns {boolean} True if filters are active
         */
        _hasActiveFilters: function () {
            const oFilterData = this._controller.getView().getModel("filterData").getData();

            // Check simple text filters
            const textFilters = [
                'billingDocument', 'material', 'salesOrder', 'region',
                'billingDocumentType', 'paymentTerms', 'transactionCurrency', 'selectedPeriod'
            ];

            for (const filter of textFilters) {
                if (oFilterData[filter] && oFilterData[filter].trim()) {
                    return true;
                }
            }

            // Check amount range
            if ((oFilterData.amountRange?.from && oFilterData.amountRange.from.trim()) ||
                (oFilterData.amountRange?.to && oFilterData.amountRange.to.trim())) {
                return true;
            }

            // Check date range
            if (oFilterData.dateRange?.from || oFilterData.dateRange?.to) {
                return true;
            }

            return false;
        },

        /**
         * Gets the current loading strategy info
         * @returns {Object} Loading strategy information
         */
        getLoadingStrategy: function () {
            const hasFilters = this._hasActiveFilters();
            return {
                hasActiveFilters: hasFilters,
                strategy: hasFilters ? 'LOAD_ALL' : 'PAGINATED',
                batchSize: hasFilters ? 'ALL' : 100,
                description: hasFilters ?
                    'Loading all filtered data at once' :
                    'Loading data in batches of 100 records'
            };
        },

        /**
         * Tests the connection to the Sales Register service
         */
        testConnection: function () {
            console.group("🔬 Testing Sales Register Connection");
            const oMainModel = this._controller.getView().getModel();
            if (!oMainModel) {
                MessageBox.error("Sales Register Model not found");
                console.groupEnd();
                return;
            }

            this._controller._setLoading(true, "Testing connection...");
            const path = "/YY1_SALESREGISTER";

            // ✅ CORRECTED: Using only fields that exist in metadata
            const mTestParameters = {
                "$select": "BillingDocument,Product,TotalNetAmount,TransactionCurrency",
                "$top": 5,
                "$orderby": "BillingDocument asc"
            };

            oMainModel.read(path, {
                urlParameters: mTestParameters,
                success: (data) => {
                    this._controller._setLoading(false);
                    const results = data.results || [];
                    console.log("✅ Connection test successful. Sample data:", results);

                    if (results.length > 0) {
                        const sampleRecord = results[0];
                        const formatter = this._controller._formatter;
                        const sMessage = `Connection successful!\n\nSample record found:\n` +
                            `Billing Document: ${sampleRecord.BillingDocument}\n` +
                            `Product: ${sampleRecord.Product || 'N/A'}\n` +
                            `Amount: ${formatter.formatNumber(sampleRecord.TotalNetAmount)} ${sampleRecord.TransactionCurrency}`;
                        MessageBox.success(sMessage);
                    } else {
                        MessageBox.information("Connection successful but no data returned");
                    }
                    console.groupEnd();
                },
                error: (error) => {
                    this._controller._setLoading(false);
                    console.error("❌ Connection test failed:", error);
                    console.groupEnd();
                    this._controller._handleLoadError(error);
                }
            });
        },
        configureBatchSettings: function () {
            const oMainModel = this._controller.getView().getModel();
            if (oMainModel) {
                oMainModel.setDeferredGroups(["batchGroup"]);
                oMainModel.setChangeGroups({
                    "*": {
                        groupId: "batchGroup",
                        changeSetId: "changeSet",
                        single: false
                    }
                });
            }
        },
        /**
         * Builds OData filters based on user input
         * @returns {Array} Array of OData filters
         */
        _buildFilters: function () {
            const oFilterData = this._controller.getView().getModel("filterData").getData();
            const aFilters = [];

            // Billing Document filter with padding support
            if (oFilterData.billingDocument && oFilterData.billingDocument.trim()) {
                const sBillingDoc = oFilterData.billingDocument.trim();
                const aDocumentFilters = [];
                aDocumentFilters.push(new Filter("BillingDocument", FilterOperator.EQ, sBillingDoc));

                // Add padded version for SAP format (max 10 chars per metadata)
                const sPaddedDoc = sBillingDoc.padStart(10, '0');
                if (sPaddedDoc !== sBillingDoc) {
                    aDocumentFilters.push(new Filter("BillingDocument", FilterOperator.EQ, sPaddedDoc));
                }

                if (aDocumentFilters.length > 1) {
                    aFilters.push(new Filter({ filters: aDocumentFilters, and: false }));
                } else {
                    aFilters.push(aDocumentFilters[0]);
                }
            }

            // ✅ CORRECTED: Product filter (not Material)
            if (oFilterData.material && oFilterData.material.trim()) {
                aFilters.push(new Filter("Product", FilterOperator.Contains, oFilterData.material.trim()));
            }

            // Sales Order filter
            if (oFilterData.salesOrder && oFilterData.salesOrder.trim()) {
                aFilters.push(new Filter("SalesDocument", FilterOperator.Contains, oFilterData.salesOrder.trim()));
            }

            // Region filter
            if (oFilterData.region && oFilterData.region.trim()) {
                aFilters.push(new Filter("Region", FilterOperator.EQ, oFilterData.region.trim()));
            }

            // Billing Document Type filter
            if (oFilterData.billingDocumentType && oFilterData.billingDocumentType.trim()) {
                aFilters.push(new Filter("BillingDocumentType", FilterOperator.EQ, oFilterData.billingDocumentType.trim()));
            }

            // Payment Terms filter
            if (oFilterData.paymentTerms && oFilterData.paymentTerms.trim()) {
                aFilters.push(new Filter("CustomerPaymentTerms", FilterOperator.EQ, oFilterData.paymentTerms.trim()));
            }

            // Transaction Currency filter
            if (oFilterData.transactionCurrency && oFilterData.transactionCurrency.trim()) {
                aFilters.push(new Filter("TransactionCurrency", FilterOperator.EQ, oFilterData.transactionCurrency.trim()));
            }

            // Amount range filters
            if (oFilterData.amountRange.from && oFilterData.amountRange.from.trim()) {
                const fAmountFrom = parseFloat(oFilterData.amountRange.from);
                if (!isNaN(fAmountFrom)) {
                    aFilters.push(new Filter("TotalNetAmount", FilterOperator.GE, fAmountFrom.toString()));
                }
            }

            if (oFilterData.amountRange.to && oFilterData.amountRange.to.trim()) {
                const fAmountTo = parseFloat(oFilterData.amountRange.to);
                if (!isNaN(fAmountTo)) {
                    aFilters.push(new Filter("TotalNetAmount", FilterOperator.LE, fAmountTo.toString()));
                }
            }

            // Add period-based date filters if needed
            this._addPeriodFilters(aFilters, oFilterData);

            // Add date range filters
            this._addDateRangeFilters(aFilters, oFilterData);

            console.log("🔍 Built sales filters:", aFilters);
            return aFilters;
        },

        /**
         * Adds date range filters based on from/to dates
         * @param {Array} aFilters - Existing filters array
         * @param {Object} oFilterData - Filter data from model
         */
        _addDateRangeFilters: function (aFilters, oFilterData) {
            if (!oFilterData.dateRange) {
                return;
            }

            const { from, to } = oFilterData.dateRange;

            // Add from date filter
            if (from && from instanceof Date) {
                const fromDateString = this._formatDateForOData(from);
                aFilters.push(new Filter("BillingDocumentDate", FilterOperator.GE, fromDateString));
                console.log("📅 Added from date filter:", fromDateString);
            }

            // Add to date filter
            if (to && to instanceof Date) {
                const toDateString = this._formatDateForOData(to);
                aFilters.push(new Filter("BillingDocumentDate", FilterOperator.LE, toDateString));
                console.log("📅 Added to date filter:", toDateString);
            }
        },

        /**
         * Formats a JavaScript Date object for OData filtering
         * Based on the OData metadata: BillingDocumentDate is Edm.DateTime with Precision="0" (date only)
         * @param {Date} date - JavaScript Date object
         * @returns {string} Formatted date string for OData
         */
        _formatDateForOData: function (date) {
            if (!date || !(date instanceof Date)) {
                return null;
            }

            // For Edm.DateTime with Precision="0", we need to format as YYYY-MM-DD
            // The OData service expects dates in ISO format without time component
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');

            // Return ISO date string (YYYY-MM-DD)
            return `${year}-${month}-${day}`;
        },

        /**
         * Adds period-based date filters
         * @param {Array} aFilters - Existing filters array
         * @param {Object} oFilterData - Filter data from model
         */
        _addPeriodFilters: function (aFilters, oFilterData) {
            if (!oFilterData.selectedPeriod) {
                return;
            }

            const dateRange = this._calculateDateRangeFromPeriod(oFilterData.selectedPeriod);
            if (dateRange) {
                if (dateRange.from) {
                    aFilters.push(new Filter("BillingDocumentDate", FilterOperator.GE, dateRange.from));
                }
                if (dateRange.to) {
                    aFilters.push(new Filter("BillingDocumentDate", FilterOperator.LE, dateRange.to));
                }
            }
        },

        /**
         * Calculates date range based on period selection
         * @param {string} sPeriod - Selected period
         * @returns {Object|null} Date range object or null
         */
        _calculateDateRangeFromPeriod: function (sPeriod) {
            const today = new Date();
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth();
            let fromDate, toDate;

            switch (sPeriod) {
                case "Current Month":
                    fromDate = new Date(currentYear, currentMonth, 1);
                    toDate = new Date(currentYear, currentMonth + 1, 0);
                    break;
                case "Last Month":
                    fromDate = new Date(currentYear, currentMonth - 1, 1);
                    toDate = new Date(currentYear, currentMonth, 0);
                    break;
                case "Current Quarter":
                    const currentQuarter = Math.floor(currentMonth / 3);
                    fromDate = new Date(currentYear, currentQuarter * 3, 1);
                    toDate = new Date(currentYear, (currentQuarter + 1) * 3, 0);
                    break;
                case "Last Quarter":
                    const lastQuarter = Math.floor(currentMonth / 3) - 1;
                    const quarterYear = lastQuarter < 0 ? currentYear - 1 : currentYear;
                    const adjustedQuarter = lastQuarter < 0 ? 3 : lastQuarter;
                    fromDate = new Date(quarterYear, adjustedQuarter * 3, 1);
                    toDate = new Date(quarterYear, (adjustedQuarter + 1) * 3, 0);
                    break;
                case "Current Year":
                    fromDate = new Date(currentYear, 0, 1);
                    toDate = new Date(currentYear, 11, 31);
                    break;
                case "Last Year":
                    fromDate = new Date(currentYear - 1, 0, 1);
                    toDate = new Date(currentYear - 1, 11, 31);
                    break;
                default:
                    // Handle specific month-year combinations like "January 2024"
                    if (sPeriod.includes(" ")) {
                        const parts = sPeriod.split(" ");
                        if (parts.length === 2) {
                            const monthNames = ["January", "February", "March", "April", "May", "June",
                                "July", "August", "September", "October", "November", "December"];
                            const monthIndex = monthNames.indexOf(parts[0]);
                            const year = parseInt(parts[1]);
                            if (monthIndex !== -1 && !isNaN(year)) {
                                fromDate = new Date(year, monthIndex, 1);
                                toDate = new Date(year, monthIndex + 1, 0);
                            }
                        }
                    }
                    break;
            }

            if (fromDate && toDate) {
                return {
                    from: fromDate.toISOString().split('T')[0],
                    to: toDate.toISOString().split('T')[0]
                };
            }

            return null;
        },

        /**
         * ✅ CORRECTED: Returns the select fields for the OData query
         * Based on actual metadata fields available in YY1_SALESREGISTER
         * @returns {string} Comma-separated field list
         */
        _getSelectFields: function () {
            return "BillingDocument," +
                "BillingDocumentDate," +
                "BillingDocumentItem," +
                "BillingDocumentItemText," +
                "Product," +                           // ✅ CORRECTED: Using Product instead of Material
                "BillingDocumentType," +
                "BillingDocumentTypeName," +
                "TotalNetAmount," +
                "TransactionCurrency," +
                "BillingQuantity," +
                "BillingQuantityUnit," +
                "PayerParty," +
                "PayerParty_1," +                      // ✅ ADDED: Head Office Code
                "Region," +
                "CustomerPaymentTerms," +
                "Plant," +
                "Division," +
                "ProfitCenter," +
                "TaxCode," +
                "TaxCode_1," +                         // ✅ ADDED: Second Tax Code field
                "CustomerFullName_1," +
                "BusinessPartnerName1," +
                "SalesDocument," +
                "SalesDocumentItem," +
                "ConditionType," +
                "ConditionAmount," +
                "BillToParty," +                       // ✅ ADDED: Missing field
                "GLAccount," +                         // ✅ ADDED: Missing field
                "NetDueDate," +                        // ✅ ADDED: Missing field
                "BPIdentificationNumber," +            // ✅ ADDED: PAN Number
                "AdditionalCustomerGroup1," +          // ✅ ADDED: Customer groups
                "AdditionalCustomerGroup2," +
                "AdditionalCustomerGroup3," +
                "AdditionalCustomerGroup4," +
                "AdditionalCustomerGroup5," +
                "IN_EDocEInvcEWbillNmbr," +           // ✅ ADDED: eWay Bill fields
                "IN_EDocEWbillStatus," +
                "IN_EDocEInvcEWbillValidityDate," +
                "PurchaseOrderByShipToParty";          // ✅ ADDED: Customer reference
        },

        /**
         * ✅ CORRECTED: Builds the OData $orderby parameter
         * @param {string} sortOption - Sorting option
         * @returns {string} OData orderby string
         */
        _buildOrderBy: function (sortOption = "document") {
            const sortOptions = {
                "document": "BillingDocument asc",
                "document_desc": "BillingDocument desc",
                "type": "BillingDocumentType asc, BillingDocument asc",
                "product": "Product asc, BillingDocument asc",        // ✅ CORRECTED: product instead of material
                "amount": "TotalNetAmount desc, BillingDocument asc",
                "amount_asc": "TotalNetAmount asc, BillingDocument asc",
                "date": "BillingDocumentDate desc, BillingDocument asc",
                "date_asc": "BillingDocumentDate asc, BillingDocument asc",
                "salesorder": "SalesDocument asc, BillingDocument asc",
                "salesorder_desc": "SalesDocument desc, BillingDocument asc",
                "customer": "CustomerFullName_1 asc, BillingDocument asc",
                "region": "Region asc, BillingDocument asc"
            };
            return sortOptions[sortOption] || sortOptions.document;
        },

        /**
         * ✅ CORRECTED: Gets available sort options for the UI
         * @returns {Array} Array of sort option objects
         */
        getSortOptions: function () {
            return [
                { key: "document", text: "Billing Document (A-Z)" },
                { key: "document_desc", text: "Billing Document (Z-A)" },
                { key: "salesorder", text: "Sales Order (A-Z)" },
                { key: "salesorder_desc", text: "Sales Order (Z-A)" },
                { key: "amount", text: "Amount (High to Low)" },
                { key: "amount_asc", text: "Amount (Low to High)" },
                { key: "date", text: "Date (Newest First)" },
                { key: "date_asc", text: "Date (Oldest First)" },
                { key: "product", text: "Product (A-Z)" },              // ✅ CORRECTED: product instead of material
                { key: "customer", text: "Customer (A-Z)" },
                { key: "region", text: "Region (A-Z)" }
            ];
        },

        /**
         * Gets statistics about the current filter configuration
         * @returns {Object} Filter statistics
         */
        getFilterStatistics: function () {
            const oFilterData = this._controller.getView().getModel("filterData").getData();
            const stats = {
                totalFilters: 0,
                activeFilters: [],
                isEmpty: true
            };

            const filterFields = [
                { key: 'billingDocument', label: 'Billing Document' },
                { key: 'material', label: 'Product' },                    // ✅ CORRECTED: Label updated
                { key: 'salesOrder', label: 'Sales Order' },
                { key: 'region', label: 'Region' },
                { key: 'billingDocumentType', label: 'Document Type' },
                { key: 'paymentTerms', label: 'Payment Terms' },
                { key: 'transactionCurrency', label: 'Currency' },
                { key: 'selectedPeriod', label: 'Period' }
            ];

            filterFields.forEach(field => {
                if (oFilterData[field.key] && oFilterData[field.key].trim()) {
                    stats.totalFilters++;
                    stats.activeFilters.push({
                        field: field.label,
                        value: oFilterData[field.key]
                    });
                    stats.isEmpty = false;
                }
            });

            // Check amount range
            if ((oFilterData.amountRange.from && oFilterData.amountRange.from.trim()) ||
                (oFilterData.amountRange.to && oFilterData.amountRange.to.trim())) {
                stats.totalFilters++;
                stats.activeFilters.push({
                    field: 'Amount Range',
                    value: `${oFilterData.amountRange.from || 'Any'} - ${oFilterData.amountRange.to || 'Any'}`
                });
                stats.isEmpty = false;
            }

            return stats;
        },

        /**
         * Validates filter data for common issues
         * @param {Object} oFilterData - Filter data to validate
         * @returns {Array} Array of validation error messages
         */
        validateFilters: function (oFilterData) {
            const errors = [];

            // Validate amount range
            if (oFilterData.amountRange.from && oFilterData.amountRange.to) {
                const fromAmount = parseFloat(oFilterData.amountRange.from);
                const toAmount = parseFloat(oFilterData.amountRange.to);

                if (!isNaN(fromAmount) && !isNaN(toAmount) && fromAmount > toAmount) {
                    errors.push("Amount 'From' value cannot be greater than 'To' value");
                }

                if (!isNaN(fromAmount) && fromAmount < 0) {
                    errors.push("Amount 'From' value cannot be negative");
                }

                if (!isNaN(toAmount) && toAmount < 0) {
                    errors.push("Amount 'To' value cannot be negative");
                }
            }

            // ✅ CORRECTED: Validate billing document format (MaxLength="10" per metadata)
            if (oFilterData.billingDocument && oFilterData.billingDocument.trim()) {
                const billingDoc = oFilterData.billingDocument.trim();
                if (!/^\d+$/.test(billingDoc)) {
                    errors.push("Billing Document should contain only numbers");
                }
                if (billingDoc.length > 10) {                            // ✅ CORRECTED: Max 10 chars
                    errors.push("Billing Document cannot be longer than 10 characters");
                }
            }

            // Validate sales order format
            if (oFilterData.salesOrder && oFilterData.salesOrder.trim()) {
                const salesOrder = oFilterData.salesOrder.trim();
                if (salesOrder.length > 10) {
                    errors.push("Sales Order cannot be longer than 10 characters");
                }
            }

            return errors;
        },

        /**
         * Builds a comprehensive error message from OData error response
         * @param {string} sServiceName - Name of the service
         * @param {Object} error - Error object from OData call
         * @returns {string} Formatted error message
         */
        _buildErrorMessage: function (sServiceName, error) {
            let sMessage = `${sServiceName} loading failed: `;

            if (error.responseText) {
                try {
                    const oErrorData = JSON.parse(error.responseText);
                    if (oErrorData.error && oErrorData.error.message) {
                        sMessage += oErrorData.error.message.value || oErrorData.error.message;
                    } else {
                        sMessage += error.responseText;
                    }
                } catch (e) {
                    sMessage += error.responseText;
                }
            } else if (error.message) {
                sMessage += error.message;
            } else if (error.statusCode) {
                sMessage += `HTTP ${error.statusCode}`;
                switch (error.statusCode) {
                    case 401:
                        sMessage += " - Authentication required";
                        break;
                    case 403:
                        sMessage += " - Access forbidden";
                        break;
                    case 404:
                        sMessage += " - Service not found";
                        break;
                    case 500:
                        sMessage += " - Internal server error";
                        break;
                    case 503:
                        sMessage += " - Service unavailable";
                        break;
                }
            } else {
                sMessage += "Unknown error occurred";
            }

            // Add troubleshooting hints
            if (error.statusCode === 0 || (error.message && error.message.includes("fetch"))) {
                sMessage += "\n\nTroubleshooting tips:\n" +
                    "• Check if the service is accessible\n" +
                    "• Verify proxy configuration in ui5.yaml\n" +
                    "• Check destination setup in BTP\n" +
                    "• Ensure CORS is properly configured";
            }

            return sMessage;
        },

        /**
         * Gets metadata information about available fields
         * @returns {Promise} Promise that resolves with metadata info
         */
        getMetadataInfo: function () {
            return new Promise((resolve, reject) => {
                const oMainModel = this._controller.getView().getModel();
                if (!oMainModel) {
                    reject(new Error("Sales Register Model not found"));
                    return;
                }

                oMainModel.getMetaModel().loaded().then(() => {
                    const oMetaModel = oMainModel.getMetaModel();
                    const oEntitySet = oMetaModel.getODataEntitySet("YY1_SALESREGISTER");
                    const oEntityType = oMetaModel.getODataEntityType(oEntitySet.entityType);

                    const fields = oEntityType.property.map(prop => ({
                        name: prop.name,
                        type: prop.type,
                        maxLength: prop.maxLength,
                        nullable: prop.nullable
                    }));

                    resolve({
                        entitySet: oEntitySet.name,
                        entityType: oEntityType.name,
                        fields: fields,
                        totalFields: fields.length
                    });
                }).catch(reject);
            });
        },

        /**
         * Resets all filters to default state
         */
        clearAllFilters: function () {
            const oFilterModel = this._controller.getView().getModel("filterData");
            const defaultFilterData = {
                billingDocument: "",
                material: "",
                salesOrder: "",
                region: "",
                billingDocumentType: "",
                paymentTerms: "",
                transactionCurrency: "",
                selectedPeriod: "",
                amountRange: {
                    from: "",
                    to: ""
                },
                dateRange: {
                    from: null,
                    to: null
                }
            };
            oFilterModel.setData(defaultFilterData);
            console.log("🧹 All filters cleared");
        },

        /**
         * Gets a summary of current data loading configuration
         * @returns {Object} Data loading summary
         */
        getDataLoadingSummary: function () {
            const strategy = this.getLoadingStrategy();
            const filterStats = this.getFilterStatistics();

            return {
                strategy: strategy,
                filters: filterStats,
                recommendation: strategy.hasActiveFilters ?
                    "Filtered data will be loaded completely for better user experience" :
                    "Data will be loaded progressively as you scroll (100 records per batch)"
            };
        },
        // =================== Service Debugging Helper ===================

        // Add these methods to your SalesDataService.js for debugging

        /**
         * Test different variations of the service to understand data availability
         */
        debugServiceData: function () {
            console.group("🔬 Debugging Service Data Availability");

            const salesModel = this._controller.getView().getModel();
            if (!salesModel) {
                console.error("❌ No model found");
                console.groupEnd();
                return;
            }

            // Test 1: Check total count without any parameters
            console.log("🧪 Test 1: Basic count check");
            salesModel.read("/YY1_SALESREGISTER", {
                urlParameters: {
                    "$inlinecount": "allpages",
                    "$top": 0  // Don't load data, just get count
                },
                success: (data) => {
                    console.log("✅ Total records available:", data.__count);

                    // Test 2: Get minimal data to verify structure
                    this._runTest2(salesModel);
                },
                error: (error) => {
                    console.error("❌ Test 1 failed:", error);
                    console.groupEnd();
                }
            });
        },

        _runTest2: function (salesModel) {
            console.log("🧪 Test 2: Minimal field selection");
            salesModel.read("/YY1_SALESREGISTER", {
                urlParameters: {
                    "$select": "BillingDocument,TotalNetAmount,TransactionCurrency",
                    "$top": 10,
                    "$inlinecount": "allpages"
                },
                success: (data) => {
                    console.log("✅ Test 2 results:", {
                        count: data.results?.length,
                        totalCount: data.__count,
                        sampleData: data.results?.slice(0, 3)
                    });

                    // Test 3: Try without specific selects
                    this._runTest3(salesModel);
                },
                error: (error) => {
                    console.error("❌ Test 2 failed:", error);
                    console.groupEnd();
                }
            });
        },

        _runTest3: function (salesModel) {
            console.log("🧪 Test 3: No $select clause");
            salesModel.read("/YY1_SALESREGISTER", {
                urlParameters: {
                    "$top": 5,
                    "$inlinecount": "allpages"
                },
                success: (data) => {
                    console.log("✅ Test 3 results:", {
                        count: data.results?.length,
                        totalCount: data.__count,
                        fieldNames: data.results?.length > 0 ? Object.keys(data.results[0]) : []
                    });

                    // Test 4: Check if specific fields are causing issues
                    this._runTest4(salesModel);
                },
                error: (error) => {
                    console.error("❌ Test 3 failed:", error);
                    console.groupEnd();
                }
            });
        },

        _runTest4: function (salesModel) {
            console.log("🧪 Test 4: Check problematic fields");

            // Try with core fields only (avoiding potentially missing fields)
            const coreFields = [
                "BillingDocument",
                "BillingDocumentDate",
                "BillingDocumentItem",
                "Product",
                "TotalNetAmount",
                "TransactionCurrency",
                "SalesDocument",
                "CustomerFullName_1"
            ];

            salesModel.read("/YY1_SALESREGISTER", {
                urlParameters: {
                    "$select": coreFields.join(","),
                    "$top": 10,
                    "$inlinecount": "allpages"
                },
                success: (data) => {
                    console.log("✅ Test 4 (core fields) results:", {
                        count: data.results?.length,
                        totalCount: data.__count
                    });

                    if (data.results?.length > 1) {
                        console.log("🎯 SUCCESS: Core fields work fine, issue is with extended field selection");
                        this._testProblematicFields(salesModel);
                    } else {
                        console.log("⚠️ Even core fields return limited data");
                        this._checkEntitySetDefinition(salesModel);
                    }
                },
                error: (error) => {
                    console.error("❌ Test 4 failed:", error);
                    this._checkEntitySetDefinition(salesModel);
                }
            });
        },

        _testProblematicFields: function (salesModel) {
            console.log("🧪 Test 5: Finding problematic fields");

            // Fields that might not exist or cause issues
            const suspiciousFields = [
                "BillingDocumentItemText",
                "BillingDocumentTypeName",
                "PayerParty_1",
                "TaxCode_1",
                "BillToParty",
                "GLAccount",
                "NetDueDate",
                "BPIdentificationNumber",
                "AdditionalCustomerGroup1",
                "AdditionalCustomerGroup2",
                "AdditionalCustomerGroup3",
                "AdditionalCustomerGroup4",
                "AdditionalCustomerGroup5",
                "IN_EDocEInvcEWbillNmbr",
                "IN_EDocEWbillStatus",
                "IN_EDocEInvcEWbillValidityDate",
                "PurchaseOrderByShipToParty"
            ];

            // Test each field individually
            this._testFieldBatch(salesModel, suspiciousFields, 0);
        },

        _testFieldBatch: function (salesModel, fields, index) {
            if (index >= fields.length) {
                console.log("🏁 Field testing complete");
                console.groupEnd();
                return;
            }

            const field = fields[index];
            const testFields = "BillingDocument," + field;

            salesModel.read("/YY1_SALESREGISTER", {
                urlParameters: {
                    "$select": testFields,
                    "$top": 5
                },
                success: (data) => {
                    console.log(`✅ Field ${field}: OK (${data.results?.length} records)`);
                    this._testFieldBatch(salesModel, fields, index + 1);
                },
                error: (error) => {
                    console.error(`❌ Field ${field}: PROBLEM -`, error);
                    this._testFieldBatch(salesModel, fields, index + 1);
                }
            });
        },

        _checkEntitySetDefinition: function (salesModel) {
            console.log("🧪 Test 6: Check service metadata");

            salesModel.getMetaModel().loaded().then(() => {
                const oMetaModel = salesModel.getMetaModel();
                const oEntitySet = oMetaModel.getODataEntitySet("YY1_SALESREGISTER");
                const oEntityType = oMetaModel.getODataEntityType(oEntitySet.entityType);

                console.log("📋 Available fields in metadata:",
                    oEntityType.property.map(p => p.name).sort());

                console.log("📊 Entity set info:", {
                    name: oEntitySet.name,
                    entityType: oEntityType.name,
                    totalFields: oEntityType.property.length
                });

                console.groupEnd();
            }).catch(error => {
                console.error("❌ Metadata check failed:", error);
                console.groupEnd();
            });
        },

        /**
         * Quick method to test if we can get more than 1 record
         */
        testRecordCount: function () {
            const salesModel = this._controller.getView().getModel();
            if (!salesModel) {
                console.error("❌ No model found");
                return;
            }

            console.log("🔍 Testing record availability...");

            // Simple test with minimal parameters
            salesModel.read("/YY1_SALESREGISTER", {
                urlParameters: {
                    "$top": 50,
                    "$inlinecount": "allpages"
                },
                success: (data) => {
                    console.log("📊 Record test results:", {
                        returned: data.results?.length,
                        totalAvailable: data.__count,
                        sampleRecord: data.results?.[0]
                    });

                    if (data.__count === 1) {
                        console.warn("⚠️ Only 1 record exists in the entire dataset");
                    } else if (data.results?.length === 1 && data.__count > 1) {
                        console.warn("⚠️ Multiple records exist but only 1 is being returned - possible filtering or permission issue");
                    }
                },
                error: (error) => {
                    console.error("❌ Record count test failed:", error);
                }
            });
        },

        /**
         * Add this method to your existing SalesDataService class
         * This is the missing method that was causing the error
         */
        loadSalesDataWithPagination: function (searchParams, pagination = {}) {
            return new Promise((resolve, reject) => {
                console.log("🔍 Loading sales data with pagination:", searchParams);

                try {
                    // Step 1: Build filters from search parameters
                    const filters = this._buildSearchFilters(searchParams);

                    // Step 2: Load ALL matching data first (no OData pagination)
                    this._loadAllMatchingData(filters)
                        .then(allData => {
                            console.log(`📊 Retrieved ${allData.length} raw records for grouping`);

                            // Step 3: Group the data by Sales Document + Item
                            const groupedData = this._groupBySalesDocumentAndItem(allData);
                            console.log(`📋 Grouped into ${groupedData.length} groups`);

                            // Step 4: Apply pagination to grouped results
                            const paginatedResult = this._applyPaginationToGroups(groupedData, pagination);

                            resolve({
                                data: paginatedResult.data,
                                totalCount: groupedData.length,
                                totalRecords: allData.length,
                                hasMore: paginatedResult.hasMore,
                                pagination: pagination,
                                isGrouped: true
                            });
                        })
                        .catch(error => {
                            console.error("❌ Error in loadSalesDataWithPagination:", error);
                            reject(error);
                        });

                } catch (error) {
                    reject(error);
                }
            });
        },

        /**
         * Build filters specifically for search parameters (different from UI filters)
         */
        _buildSearchFilters: function (searchParams) {
            const filters = [];

            if (searchParams.billingDocument) {
                const docFilters = [];
                const billingDoc = searchParams.billingDocument.trim();

                // Exact match
                docFilters.push(new sap.ui.model.Filter("BillingDocument", sap.ui.model.FilterOperator.EQ, billingDoc));

                // Padded version for SAP format
                const paddedDoc = billingDoc.padStart(10, '0');
                if (paddedDoc !== billingDoc) {
                    docFilters.push(new sap.ui.model.Filter("BillingDocument", sap.ui.model.FilterOperator.EQ, paddedDoc));
                }

                if (docFilters.length > 1) {
                    filters.push(new sap.ui.model.Filter({ filters: docFilters, and: false }));
                } else {
                    filters.push(docFilters[0]);
                }
            }

            if (searchParams.salesDocument) {
                filters.push(new sap.ui.model.Filter("SalesDocument", sap.ui.model.FilterOperator.EQ, searchParams.salesDocument));
            }

            if (searchParams.customerNumber) {
                filters.push(new sap.ui.model.Filter("PayerParty", sap.ui.model.FilterOperator.EQ, searchParams.customerNumber));
            }

            if (searchParams.dateFrom && searchParams.dateTo) {
                filters.push(new sap.ui.model.Filter("BillingDocumentDate", sap.ui.model.FilterOperator.BT,
                    this._formatDateForOData(searchParams.dateFrom), this._formatDateForOData(searchParams.dateTo)));
            }

            console.log("🔍 Built search filters:", filters);
            return filters;
        },


        /**
         * Load ALL matching data without pagination for grouping
         */
        _loadAllMatchingData: function (filters) {
            return new Promise((resolve, reject) => {
                const salesModel = this._controller.getView().getModel();
                if (!salesModel) {
                    reject(new Error("Sales Register Model not found"));
                    return;
                }

                // Use core fields for grouping - avoid problematic fields that might cause issues
                const groupingFields = [
                    "BillingDocument",
                    "BillingDocumentDate",
                    "BillingDocumentItem",
                    "Product",
                    "TotalNetAmount",
                    "TransactionCurrency",
                    "BillingQuantity",
                    "BillingQuantityUnit",
                    "SalesDocument",        // 🎯 CRITICAL for grouping
                    "SalesDocumentItem",    // 🎯 CRITICAL for grouping
                    "PayerParty",
                    "CustomerFullName_1",
                    "BusinessPartnerName1",
                    "Region",
                    "Plant",
                    "Division",
                    "BillingDocumentType"
                ].join(",");

                const urlParameters = {
                    $select: groupingFields,
                    $orderby: "SalesDocument asc, SalesDocumentItem asc, BillingDocument asc", // 🎯 Better ordering
                    $inlinecount: "allpages"
                    // Note: NO $top or $skip - we want ALL matching data
                };

                console.log("🚀 Loading ALL data for grouping...");
                console.log("📋 URL Parameters:", urlParameters);
                console.log("🔍 Filters:", filters);

                salesModel.read("/YY1_SALESREGISTER", {
                    filters: filters,
                    urlParameters: urlParameters,
                    success: (data) => {
                        const results = data.results || [];
                        console.log(`✅ Loaded ${results.length} records for grouping (total available: ${data.__count})`);

                        // 🔬 Debug the raw data structure
                        this.debugRawDataStructure(results);

                        resolve(results);
                    },
                    error: (error) => {
                        console.error("❌ Failed to load data for grouping:", error);
                        reject(new Error(this._buildErrorMessage("Sales Data Loading", error)));
                    }
                });
            });
        },

        /**
         * Group raw data by Sales Document + Item combination
         */
        /**
  * Group raw data by Sales Document + Item combination - CORRECTED VERSION
  */
        _groupBySalesDocumentAndItem: function (rawData) {
            console.log("🔄 Starting grouping process...");
            console.log("📊 Raw data sample:", rawData.slice(0, 3)); // Debug: show first 3 records

            const groupMap = new Map();
            let groupingStats = {
                totalRecords: rawData.length,
                uniqueKeys: new Set(),
                groupingIssues: []
            };

            rawData.forEach((record, index) => {
                // 🎯 CORRECTED: Better logic for creating group keys
                let salesDocument = '';
                let item = '';

                // First priority: Use SalesDocument if available
                if (record.SalesDocument && record.SalesDocument.trim()) {
                    salesDocument = record.SalesDocument.trim();
                }
                // Fallback: Use BillingDocument if SalesDocument is empty
                else if (record.BillingDocument && record.BillingDocument.trim()) {
                    salesDocument = record.BillingDocument.trim();
                }

                // Get item number
                if (record.SalesDocumentItem && record.SalesDocumentItem.trim()) {
                    item = record.SalesDocumentItem.trim();
                }
                else if (record.BillingDocumentItem && record.BillingDocumentItem.trim()) {
                    item = record.BillingDocumentItem.trim();
                }
                else {
                    item = '000010'; // Default item if none found
                }

                // 🔑 Create unique group key
                const groupKey = `${salesDocument}_${item}`;

                // Debug logging for first few records
                if (index < 5) {
                    console.log(`🔍 Record ${index}:`, {
                        salesDocument: record.SalesDocument,
                        billingDocument: record.BillingDocument,
                        salesItem: record.SalesDocumentItem,
                        billingItem: record.BillingDocumentItem,
                        groupKey: groupKey
                    });
                }

                // Track unique keys for debugging
                groupingStats.uniqueKeys.add(groupKey);

                // Validate group key
                if (!salesDocument) {
                    groupingStats.groupingIssues.push(`Record ${index}: No sales/billing document found`);
                }

                if (!groupMap.has(groupKey)) {
                    // Initialize new group
                    groupMap.set(groupKey, {
                        // Group identifiers
                        GroupKey: groupKey,
                        SalesDocument: salesDocument,
                        SalesDocumentItem: item,
                        BillingDocument: record.BillingDocument || salesDocument,

                        // Aggregated values
                        TotalNetAmount: 0,
                        TotalQuantity: 0,
                        RecordCount: 0,

                        // Master data (from first/best record)
                        Product: record.Product || '',
                        CustomerName: record.CustomerFullName_1 || record.BusinessPartnerName1 || '',
                        CustomerNumber: record.PayerParty || '',
                        TransactionCurrency: record.TransactionCurrency || '',
                        BillingDocumentDate: record.BillingDocumentDate || null,
                        BillingDocumentType: record.BillingDocumentType || '',
                        Region: record.Region || '',
                        Plant: record.Plant || '',
                        Division: record.Division || '',

                        // Detail records for drill-down
                        DetailRecords: []
                    });

                    console.log(`➕ Created new group: ${groupKey}`);
                }

                const group = groupMap.get(groupKey);

                // Add to detail records
                group.DetailRecords.push({
                    ...record,
                    OriginalIndex: index,
                    GroupKey: groupKey
                });

                // Aggregate numerical values
                group.TotalNetAmount += this._parseAmount(record.TotalNetAmount);
                group.TotalQuantity += this._parseQuantity(record.BillingQuantity);
                group.RecordCount++;

                // Update master data if current is better/more complete
                this._updateGroupMasterData(group, record);
            });

            // Convert to array and sort
            const groupedArray = Array.from(groupMap.values());
            groupedArray.sort((a, b) => {
                if (a.SalesDocument !== b.SalesDocument) {
                    return a.SalesDocument.localeCompare(b.SalesDocument);
                }
                return a.SalesDocumentItem.localeCompare(b.SalesDocumentItem);
            });

            // 📊 Enhanced logging for debugging
            console.log("✅ Grouping completed:");
            console.log(`   📈 Input: ${rawData.length} records`);
            console.log(`   📋 Output: ${groupedArray.length} groups`);
            console.log(`   🔑 Unique keys found: ${groupingStats.uniqueKeys.size}`);
            console.log(`   🎯 Group keys:`, Array.from(groupingStats.uniqueKeys).slice(0, 10));

            if (groupingStats.groupingIssues.length > 0) {
                console.warn("⚠️ Grouping issues:", groupingStats.groupingIssues.slice(0, 5));
            }

            // Show sample groups for verification
            if (groupedArray.length > 0) {
                console.log("📋 Sample groups:");
                groupedArray.slice(0, 3).forEach((group, index) => {
                    console.log(`   Group ${index + 1}: ${group.GroupKey} (${group.RecordCount} records, Amount: ${group.TotalNetAmount})`);
                });
            }

            return groupedArray;
        },
        /**
         * Debug method to analyze the raw data structure before grouping
         */
        debugRawDataStructure: function (rawData) {
            console.group("🔬 Raw Data Structure Analysis");

            if (!rawData || rawData.length === 0) {
                console.log("❌ No data to analyze");
                console.groupEnd();
                return;
            }

            // Analyze first record structure
            const firstRecord = rawData[0];
            console.log("📊 First record fields:", Object.keys(firstRecord));

            // Check sales document distribution
            const salesDocStats = {
                withSalesDocument: 0,
                withoutSalesDocument: 0,
                uniqueSalesDocuments: new Set(),
                uniqueBillingDocuments: new Set()
            };

            const itemStats = {
                withSalesDocumentItem: 0,
                withoutSalesDocumentItem: 0,
                uniqueItems: new Set()
            };

            rawData.forEach((record, index) => {
                // Sales document analysis
                if (record.SalesDocument && record.SalesDocument.trim()) {
                    salesDocStats.withSalesDocument++;
                    salesDocStats.uniqueSalesDocuments.add(record.SalesDocument.trim());
                } else {
                    salesDocStats.withoutSalesDocument++;
                }

                if (record.BillingDocument && record.BillingDocument.trim()) {
                    salesDocStats.uniqueBillingDocuments.add(record.BillingDocument.trim());
                }

                // Item analysis
                if (record.SalesDocumentItem && record.SalesDocumentItem.trim()) {
                    itemStats.withSalesDocumentItem++;
                    itemStats.uniqueItems.add(record.SalesDocumentItem.trim());
                } else {
                    itemStats.withoutSalesDocumentItem++;
                }

                if (record.BillingDocumentItem && record.BillingDocumentItem.trim()) {
                    itemStats.uniqueItems.add(record.BillingDocumentItem.trim());
                }

                // Show first few records in detail
                if (index < 3) {
                    console.log(`Record ${index}:`, {
                        SalesDocument: record.SalesDocument || 'EMPTY',
                        BillingDocument: record.BillingDocument || 'EMPTY',
                        SalesDocumentItem: record.SalesDocumentItem || 'EMPTY',
                        BillingDocumentItem: record.BillingDocumentItem || 'EMPTY',
                        Product: record.Product,
                        TotalNetAmount: record.TotalNetAmount
                    });
                }
            });

            console.log("📈 Sales Document Statistics:", {
                total: rawData.length,
                withSalesDocument: salesDocStats.withSalesDocument,
                withoutSalesDocument: salesDocStats.withoutSalesDocument,
                uniqueSalesDocuments: salesDocStats.uniqueSalesDocuments.size,
                uniqueBillingDocuments: salesDocStats.uniqueBillingDocuments.size
            });

            console.log("📋 Item Statistics:", {
                withSalesDocumentItem: itemStats.withSalesDocumentItem,
                withoutSalesDocumentItem: itemStats.withoutSalesDocumentItem,
                uniqueItems: itemStats.uniqueItems.size,
                sampleItems: Array.from(itemStats.uniqueItems).slice(0, 10)
            });

            console.log("🔑 Sample Sales Documents:", Array.from(salesDocStats.uniqueSalesDocuments).slice(0, 10));
            console.log("🔑 Sample Billing Documents:", Array.from(salesDocStats.uniqueBillingDocuments).slice(0, 10));

            console.groupEnd();
        },
        /**
         * Apply pagination to grouped results
         */
        _applyPaginationToGroups: function (groupedData, pagination) {
            const defaultPagination = {
                skip: 0,
                top: 50,
                ...pagination
            };

            const startIndex = defaultPagination.skip;
            const endIndex = startIndex + defaultPagination.top;

            const paginatedData = groupedData.slice(startIndex, endIndex);
            const hasMore = endIndex < groupedData.length;

            console.log(`📄 Applied pagination: showing ${paginatedData.length} groups (${startIndex + 1}-${Math.min(endIndex, groupedData.length)} of ${groupedData.length})`);

            return {
                data: paginatedData,
                hasMore: hasMore
            };
        },

        /**
         * Parse amount field safely
         */
        _parseAmount: function (amount) {
            if (typeof amount === 'number') return amount;
            if (typeof amount === 'string') {
                const parsed = parseFloat(amount.replace(/[^\d.-]/g, ''));
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        },

        /**
         * Parse quantity field safely  
         */
        _parseQuantity: function (quantity) {
            if (typeof quantity === 'number') return quantity;
            if (typeof quantity === 'string') {
                const parsed = parseFloat(quantity);
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        },

        /**
         * Update group master data with better information
         */
        _updateGroupMasterData: function (group, record) {
            // Update if current data is empty or less complete
            if (!group.CustomerName && (record.CustomerFullName_1 || record.BusinessPartnerName1)) {
                group.CustomerName = record.CustomerFullName_1 || record.BusinessPartnerName1;
            }

            if (!group.Product && record.Product) {
                group.Product = record.Product;
            }

            // Take the latest/most recent date
            if (record.BillingDocumentDate) {
                group.BillingDocumentDate = record.BillingDocumentDate;
            }
        },

        /**
         * Get detail records for a specific group
         */
        getDetailRecordsForGroup: function (groupKey, groupedData) {
            const group = groupedData.find(g => g.GroupKey === groupKey);
            return group ? group.DetailRecords : [];
        },

        /**
         * Export grouped data in different formats
         */
        exportGroupedData: function (groupedData, format = 'summary') {
            if (format === 'detailed') {
                // Flatten all detail records
                const detailRecords = [];
                groupedData.forEach(group => {
                    group.DetailRecords.forEach(record => {
                        detailRecords.push({
                            ...record,
                            GroupKey: group.GroupKey,
                            GroupTotalAmount: group.TotalNetAmount,
                            GroupRecordCount: group.RecordCount
                        });
                    });
                });
                return detailRecords;
            } else {
                // Return summary grouped data
                return groupedData.map(group => ({
                    GroupKey: group.GroupKey,
                    SalesDocument: group.SalesDocument,
                    SalesDocumentItem: group.SalesDocumentItem,
                    BillingDocument: group.BillingDocument,
                    Product: group.Product,
                    CustomerName: group.CustomerName,
                    CustomerNumber: group.CustomerNumber,
                    TotalNetAmount: group.TotalNetAmount,
                    TotalQuantity: group.TotalQuantity,
                    RecordCount: group.RecordCount,
                    TransactionCurrency: group.TransactionCurrency,
                    BillingDocumentDate: group.BillingDocumentDate,
                    Region: group.Region
                }));
            }
        }

        // =================== MODIFICATIONS END ===================
    });
});
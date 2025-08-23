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
            this._metadataAnalysis = null;
        },

        /**
         * Initialize the service with metadata analysis
         */
        initialize: async function () {
            console.log("📋 Initializing Enhanced Sales Data Service...");

            try {
                const salesModel = this._controller.getView().getModel();
                if (!salesModel) {
                    throw new Error("Sales Register Model not found");
                }

                await salesModel.getMetaModel().loaded();
                this._metadataAnalysis = this._analyzeServiceMetadata(salesModel.getMetaModel());

                console.log("✅ Sales Data Service initialized with metadata");
                return this._metadataAnalysis;

            } catch (error) {
                console.error("❌ Failed to initialize Sales Data Service:", error);
                throw error;
            }
        },

        /**
         * Analyze service metadata to understand capabilities
         */
        _analyzeServiceMetadata: function (metaModel) {
            console.log("🔍 Analyzing service metadata for capabilities...");

            const entityContainer = metaModel.getODataEntityContainer();
            const entitySets = entityContainer.entitySet || [];

            let salesRegisterEntitySet = null;
            entitySets.forEach(entitySet => {
                if (entitySet.name === "YY1_SALESREGISTER") {
                    salesRegisterEntitySet = entitySet;
                }
            });

            if (!salesRegisterEntitySet) {
                throw new Error("YY1_SALESREGISTER entity set not found");
            }

            const entityTypeName = salesRegisterEntitySet.entityType;
            const entityType = metaModel.getODataEntityType(entityTypeName);
            const properties = entityType.property || [];

            // Analyze each property for filtering and sorting capabilities
            const fieldCapabilities = {};
            properties.forEach(prop => {
                fieldCapabilities[prop.name] = {
                    name: prop.name,
                    type: prop.type,
                    filterable: prop["sap:filterable"] !== "false",
                    sortable: prop["sap:sortable"] !== "false",
                    label: prop["sap:label"] || prop.name,
                    maxLength: prop.maxLength,
                    precision: prop.precision,
                    scale: prop.scale
                };
            });

            console.log("📊 Field capabilities analyzed:", Object.keys(fieldCapabilities).length, "fields");

            return {
                entitySet: salesRegisterEntitySet,
                entityType: entityType,
                properties: properties,
                fieldCapabilities: fieldCapabilities,
                serviceUrl: metaModel.getODataServiceUrl(),
                serviceName: metaModel.getODataServiceMetadata().dataServices.schema[0].namespace
            };
        },

        /**
         * Load sales data with metadata-driven filtering
         */
        loadSalesData: function (skip = 0, top = 100, forceLoadAll = false) {
            return new Promise((resolve, reject) => {
                console.log("📊 Loading Sales Register Data with enhanced filtering...");

                const salesModel = this._controller.getView().getModel();
                if (!salesModel) {
                    reject(new Error("Sales Register Model not found"));
                    return;
                }

                // Build filters using metadata validation
                const filters = this._buildMetadataValidatedFilters();
                const hasActiveFilters = this._hasActiveFilters();
                const shouldLoadAll = hasActiveFilters || forceLoadAll;

                const urlParameters = {
                    $select: this._getOptimizedSelectFields(),
                    $orderby: this._buildOptimizedOrderBy(),
                    $inlinecount: "allpages"
                };

                if (!shouldLoadAll) {
                    urlParameters["$top"] = top;
                    if (skip > 0) {
                        urlParameters["$skip"] = skip;
                    }
                }

                const path = "/YY1_SALESREGISTER";
                console.log("🔗 Loading from:", path);
                console.log("📋 Parameters:", urlParameters);
                console.log("🔍 Filters:", filters.length, "active filters");

                salesModel.read(path, {
                    filters: filters,
                    urlParameters: urlParameters,
                    success: data => {
                        console.log("✅ Data loaded:", data.results?.length || 0, "records");

                        // Enhance data structure analysis
                        this._analyzeDataStructure(data.results);

                        const results = data.results || [];
                        results.totalCount = data.__count;
                        results.isLoadAll = shouldLoadAll;
                        results.hasActiveFilters = hasActiveFilters;
                        results.loadTimestamp = new Date().toISOString();

                        resolve(results);
                    },
                    error: error => {
                        console.error("❌ Load error:", error);
                        const errorMessage = this._buildErrorMessage("Sales Data", error);
                        reject(new Error(errorMessage));
                    }
                });
            });
        },
        // In SalesOrderTextService.js
        validateConfiguration: function () {
            console.group("🔧 Validating Sales Order API Configuration");

            try {
                const oSalesOrderModel = this._controller.getView().getModel("salesOrder");
                if (!oSalesOrderModel) {
                    console.warn("❌ Sales Order API Model not found - text features will be limited");
                    console.warn("To enable sales order text, configure the salesOrder model in manifest.json");
                } else {
                    console.log("✅ Sales Order API Model configured:", oSalesOrderModel.sServiceUrl || "URL not available");

                    // Try to load metadata with timeout
                    const metadataPromise = oSalesOrderModel.getMetaModel().loaded();
                    Promise.race([
                        metadataPromise,
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
                    ]).then(() => {
                        console.log("✅ Sales Order API Metadata loaded successfully");
                    }).catch(error => {
                        console.warn("⚠️ Sales Order API Metadata loading failed:", error.message);
                    });
                }
            } catch (error) {
                console.warn("⚠️ Sales Order API validation failed:", error.message);
            }

            console.groupEnd();
        },
        /**
         * Build filters with metadata validation
         */
        _buildMetadataValidatedFilters: function () {
            const oFilterData = this._controller.getView().getModel("filterData").getData();
            const aFilters = [];
            const capabilities = oFilterData.filterCapabilities || {};

            // Helper function to add filter if field is filterable
            const addFilterIfCapable = (fieldName, operator, value, uiFilterName) => {
                if (capabilities[uiFilterName] && value) {
                    aFilters.push(new Filter(fieldName, operator, value));
                    console.log(`✅ Added filter: ${fieldName} ${operator} ${value}`);
                } else if (value && !capabilities[uiFilterName]) {
                    console.warn(`⚠️ Skipped non-filterable field: ${fieldName}`);
                }
            };

            // Sales Order filter
            if (oFilterData.salesOrder && oFilterData.salesOrder.trim()) {
                addFilterIfCapable("SalesDocument", FilterOperator.EQ, oFilterData.salesOrder.trim(), "salesOrder");
            }

            // Billing Document filter
            if (oFilterData.billingDocument && oFilterData.billingDocument.trim()) {
                addFilterIfCapable("BillingDocument", FilterOperator.EQ, oFilterData.billingDocument.trim(), "billingDocument");
            }

            // Product filter with Contains for better UX
            if (oFilterData.material && oFilterData.material.trim()) {
                addFilterIfCapable("Product", FilterOperator.Contains, oFilterData.material.trim(), "material");
            }

            // Customer filter
            if (oFilterData.customer && oFilterData.customer.trim()) {
                addFilterIfCapable("CustomerFullName_1", FilterOperator.Contains, oFilterData.customer.trim(), "customer");
            }

            // Region filter - handle multiple regions
            if (oFilterData.regions && oFilterData.regions.length > 0) {
                if (capabilities.region) {
                    if (oFilterData.regions.length === 1) {
                        aFilters.push(new Filter("Region", FilterOperator.EQ, oFilterData.regions[0]));
                    } else {
                        // Multiple regions - use OR filter
                        const regionFilters = oFilterData.regions.map(region =>
                            new Filter("Region", FilterOperator.EQ, region)
                        );
                        aFilters.push(new Filter({
                            filters: regionFilters,
                            and: false
                        }));
                    }
                    console.log(`✅ Added region filter for: ${oFilterData.regions.join(", ")}`);
                }
            }

            // Billing Document Type filter
            if (oFilterData.billingDocumentType && oFilterData.billingDocumentType.trim()) {
                addFilterIfCapable("BillingDocumentType", FilterOperator.EQ, oFilterData.billingDocumentType.trim(), "billingDocumentType");
            }

            // Date range filters
            if (oFilterData.dateRange && capabilities.dateRange) {
                if (oFilterData.dateRange.from) {
                    aFilters.push(new Filter("BillingDocumentDate", FilterOperator.GE, oFilterData.dateRange.from));
                }
                if (oFilterData.dateRange.to) {
                    aFilters.push(new Filter("BillingDocumentDate", FilterOperator.LE, oFilterData.dateRange.to));
                }
            }

            // Amount range filters
            if (oFilterData.amountRange && capabilities.amountRange) {
                if (oFilterData.amountRange.from) {
                    const fromAmount = parseFloat(oFilterData.amountRange.from);
                    if (!isNaN(fromAmount)) {
                        aFilters.push(new Filter("TotalNetAmount", FilterOperator.GE, fromAmount));
                    }
                }
                if (oFilterData.amountRange.to) {
                    const toAmount = parseFloat(oFilterData.amountRange.to);
                    if (!isNaN(toAmount)) {
                        aFilters.push(new Filter("TotalNetAmount", FilterOperator.LE, toAmount));
                    }
                }
            }

            console.log("🔍 Built metadata-validated filters:", aFilters.length);
            return aFilters;
        },

        /**
         * Get optimized select fields based on requirements and metadata
         */
        _getOptimizedSelectFields: function () {
            const baseFields = [
                "BillingDocument", "BillingDocumentDate", "BillingDocumentItem", "BillingDocumentType",
                "SalesDocument", "SalesDocumentItem",
                "Product", "BillingDocumentItemText",
                "TotalNetAmount", "TransactionCurrency",
                "BillingQuantity", "BillingQuantityUnit",
                "CustomerFullName_1", "PayerParty_1", "Region",
                "GLAccount", "TaxCode", "ProfitCenter",
                "BillToParty", "Plant", "Division"
            ];

            // Add e-invoice fields if available
            const eInvoiceFields = [
                "IN_EDocEInvcEWbillNmbr", "IN_EDocEWbillStatus", "IN_EDocEInvcEWbillValidityDate",
                "PurchaseOrderByShipToParty"
            ];

            // Add condition type fields if metadata shows they're available
            const conditionFields = [
                "ConditionType", "ConditionAmount"
            ];

            let selectFields = baseFields.concat(eInvoiceFields).concat(conditionFields);

            // Only include fields that exist in metadata
            if (this._metadataAnalysis) {
                const availableFieldNames = Object.keys(this._metadataAnalysis.fieldCapabilities);
                selectFields = selectFields.filter(field => availableFieldNames.includes(field));
            }

            console.log("📋 Optimized select fields:", selectFields.length, "fields");
            return selectFields.join(",");
        },

        /**
         * Build optimized order by clause
         */
        _buildOptimizedOrderBy: function () {
            // Default sorting with fallback if fields are not sortable
            let orderBy = "SalesDocument asc, SalesDocumentItem asc, BillingDocument asc";

            // Check if primary sort fields are sortable
            if (this._metadataAnalysis) {
                const capabilities = this._metadataAnalysis.fieldCapabilities;
                const sortableFields = [];

                if (capabilities.SalesDocument?.sortable) sortableFields.push("SalesDocument asc");
                if (capabilities.SalesDocumentItem?.sortable) sortableFields.push("SalesDocumentItem asc");
                if (capabilities.BillingDocument?.sortable) sortableFields.push("BillingDocument asc");
                if (capabilities.BillingDocumentDate?.sortable) sortableFields.push("BillingDocumentDate desc");

                if (sortableFields.length > 0) {
                    orderBy = sortableFields.join(", ");
                }
            }

            console.log("📊 Order by:", orderBy);
            return orderBy;
        },

        /**
         * Enhanced data structure analysis
         */
        _analyzeDataStructure: function (data) {
            if (!data || data.length === 0) return;

            console.group("📊 Enhanced Data Structure Analysis");

            const firstRecord = data[0];
            const availableFields = Object.keys(firstRecord);
            console.log("Available fields:", availableFields);

            // Analyze data quality and completeness
            const fieldCompleteness = {};
            availableFields.forEach(field => {
                const nonEmptyCount = data.filter(record =>
                    record[field] !== null &&
                    record[field] !== undefined &&
                    record[field] !== ""
                ).length;
                fieldCompleteness[field] = {
                    completeness: (nonEmptyCount / data.length * 100).toFixed(1) + "%",
                    nonEmptyCount: nonEmptyCount,
                    totalCount: data.length
                };
            });

            console.log("Field completeness:", fieldCompleteness);

            // Count unique combinations for better grouping insights
            const uniqueStats = {
                salesOrders: new Set(),
                billingDocs: new Set(),
                glAccounts: new Set(),
                taxCodes: new Set(),
                customers: new Set(),
                products: new Set()
            };

            data.forEach(record => {
                if (record.SalesDocument) uniqueStats.salesOrders.add(record.SalesDocument);
                if (record.BillingDocument) uniqueStats.billingDocs.add(record.BillingDocument);
                if (record.GLAccount) uniqueStats.glAccounts.add(record.GLAccount);
                if (record.TaxCode) uniqueStats.taxCodes.add(record.TaxCode);
                if (record.CustomerFullName_1) uniqueStats.customers.add(record.CustomerFullName_1);
                if (record.Product) uniqueStats.products.add(record.Product);
            });

            console.log("Unique value statistics:");
            console.log("- Total records:", data.length);
            console.log("- Unique Sales Orders:", uniqueStats.salesOrders.size);
            console.log("- Unique Billing Documents:", uniqueStats.billingDocs.size);
            console.log("- Unique GL Accounts:", uniqueStats.glAccounts.size);
            console.log("- Unique Tax Codes:", uniqueStats.taxCodes.size);
            console.log("- Unique Customers:", uniqueStats.customers.size);
            console.log("- Unique Products:", uniqueStats.products.size);

            // Calculate recommended grouping strategy
            const recordsPerSalesOrder = data.length / uniqueStats.salesOrders.size;
            const recordsPerBillingDoc = data.length / uniqueStats.billingDocs.size;

            let recommendedGrouping = "none";
            if (recordsPerSalesOrder > 2) {
                recommendedGrouping = "salesDocAndItems";
            } else if (recordsPerBillingDoc > 2) {
                recommendedGrouping = "billingDocAndItems";
            }

            console.log("Recommended grouping strategy:", recommendedGrouping);
            console.log("Average records per Sales Order:", recordsPerSalesOrder.toFixed(2));
            console.log("Average records per Billing Document:", recordsPerBillingDoc.toFixed(2));

            console.groupEnd();

            // Store analysis results for later use
            this._lastDataAnalysis = {
                fieldCompleteness,
                uniqueStats,
                recommendedGrouping,
                recordsPerSalesOrder,
                recordsPerBillingDoc
            };
        },

        /**
         * Enhanced grouping by Sales Document and Item with sales order text integration
         */
        groupBySalesDocumentAndItem: function (rawData) {
            console.log("🔄 Enhanced grouping by Sales Document and Item...");
            const groupMap = new Map();

            rawData.forEach((record, index) => {
                const salesDoc = record.SalesDocument || "";
                const salesItem = record.SalesDocumentItem || "000010";
                const groupKey = `${salesDoc}_${salesItem}`;

                if (!groupMap.has(groupKey)) {
                    groupMap.set(groupKey, {
                        // Group identifiers
                        GroupKey: groupKey,
                        GroupingType: "SALES_DOC_AND_ITEM",
                        SalesDocument: salesDoc,
                        SalesDocumentItem: salesItem,

                        // Master data from first record
                        BillingDocument: record.BillingDocument,
                        BillingDocumentItem: record.BillingDocumentItem,
                        BillingDocumentDate: record.BillingDocumentDate,
                        BillingDocumentType: record.BillingDocumentType,
                        Product: record.Product,
                        ProductDescription: record.BillingDocumentItemText || record.Product,
                        Customer: record.CustomerFullName_1,
                        CustomerNumber: record.PayerParty_1,
                        CustomerDisplay: record.CustomerFullName_1 || record.PayerParty_1 || "Unknown",
                        Region: record.Region,
                        TransactionCurrency: record.TransactionCurrency || "INR",
                        ProfitCenter: record.ProfitCenter,
                        Plant: record.Plant || "",
                        Division: record.Division || "",
                        BillingQuantityUnit: record.BillingQuantityUnit || "",

                        // E-Invoice fields
                        IN_EDocEWbillStatus: record.IN_EDocEWbillStatus,
                        IN_EDocEInvcEWbillNmbr: record.IN_EDocEInvcEWbillNmbr,
                        PurchaseOrderByShipToParty: record.PurchaseOrderByShipToParty,

                        // Collections for multiple values
                        GLAccounts: new Map(),
                        TaxCodes: new Map(),
                        ConditionTypes: new Map(),

                        // Aggregated values
                        TotalNetAmount: 0,
                        TotalQuantity: 0,
                        RecordCount: 0,

                        // Detail records for drill-down
                        DetailRecords: [],

                        // Sales order text placeholders (will be populated by text service)
                        ZXT1: null, // Warehouse Code
                        ZXT3: null, // Warehouse Location
                        ZXT4: null, // Contract
                        ZXT5: null, // Date Range
                        ZXT6: null, // Description
                        ZXT7: null, // Flag
                        ZXT8: null, // Item Number

                        // Condition type aggregations
                        PPR0: 0, // Rate/MT
                        ZDV2: 0, // Additional Charges
                        JOIG: 0, // IGST
                        JOCG: 0, // CGST
                        JOSG: 0, // SGST
                        DRV1: 0, // Discount
                        ZTCS: 0, // TCS
                        ZDV4: 0  // Delay Charges
                    });
                }

                const group = groupMap.get(groupKey);

                // Add detail record with proper field mapping
                group.DetailRecords.push({
                    ...record,
                    OriginalIndex: index,
                    CustomerDisplay: record.CustomerFullName_1 || record.PayerParty_1 || "Unknown",
                    ProductDescription: record.BillingDocumentItemText || record.Product || ""
                });

                // Track GL Account with amounts
                if (record.GLAccount) {
                    const glAmount = this._parseAmount(record.TotalNetAmount);
                    const currentGL = group.GLAccounts.get(record.GLAccount) || 0;
                    group.GLAccounts.set(record.GLAccount, currentGL + glAmount);
                }

                // Track Tax Code with amounts
                if (record.TaxCode) {
                    const taxAmount = this._parseAmount(record.TotalNetAmount);
                    const currentTax = group.TaxCodes.get(record.TaxCode) || 0;
                    group.TaxCodes.set(record.TaxCode, currentTax + taxAmount);
                }

                // Track Condition Types
                if (record.ConditionType && record.ConditionAmount) {
                    const condAmount = this._parseAmount(record.ConditionAmount);
                    const currentCond = group.ConditionTypes.get(record.ConditionType) || 0;
                    group.ConditionTypes.set(record.ConditionType, currentCond + condAmount);

                    // Aggregate specific condition types
                    switch (record.ConditionType) {
                        case 'PPR0': group.PPR0 += condAmount; break;
                        case 'ZDV2': group.ZDV2 += condAmount; break;
                        case 'JOIG': group.JOIG += condAmount; break;
                        case 'JOCG': group.JOCG += condAmount; break;
                        case 'JOSG': group.JOSG += condAmount; break;
                        case 'DRV1': group.DRV1 += condAmount; break;
                        case 'ZTCS': group.ZTCS += condAmount; break;
                        case 'ZDV4': group.ZDV4 += condAmount; break;
                    }
                }

                // Aggregate totals
                group.TotalNetAmount += this._parseAmount(record.TotalNetAmount);
                group.TotalQuantity += this._parseQuantity(record.BillingQuantity);
                group.RecordCount++;
            });

            // Convert to array and format display fields
            const groupedArray = Array.from(groupMap.values()).map(group => {
                // Format GL Accounts display with amounts
                const glEntries = Array.from(group.GLAccounts.entries());
                group.GLAccountsDisplay = glEntries.length > 0 ?
                    glEntries.map(([account, amount]) =>
                        `${account} (${this._controller.formatNumber(amount)})`
                    ).join(", ") : "N/A";

                // Format Tax Codes display with amounts
                const taxEntries = Array.from(group.TaxCodes.entries());
                group.TaxCodesDisplay = taxEntries.length > 0 ?
                    taxEntries.map(([code, amount]) =>
                        `${code} (${this._controller.formatNumber(amount)})`
                    ).join(", ") : "N/A";

                // Format condition breakdown
                group.ConditionBreakdownDisplay = Array.from(group.ConditionTypes.entries())
                    .map(([type, amount]) => `${type}: ${this._controller.formatNumber(amount)}`)
                    .join(" | ");

                // Ensure all display fields have values
                group.FormattedAmount = this._controller.formatNumber(group.TotalNetAmount);

                return group;
            });

            // Sort by Sales Document and Item
            groupedArray.sort((a, b) => {
                const salesCompare = (a.SalesDocument || "").localeCompare(b.SalesDocument || "");
                if (salesCompare !== 0) return salesCompare;
                return (a.SalesDocumentItem || "").localeCompare(b.SalesDocumentItem || "");
            });

            console.log(`✅ Enhanced grouped ${rawData.length} records into ${groupedArray.length} groups`);

            // Log sample for verification
            if (groupedArray.length > 0) {
                console.log("Sample grouped record:", groupedArray[0]);
            }

            return groupedArray;
        },

        /**
         * Enhanced grouping by Billing Document and Item
         */
        groupByBillingDocumentAndItem: function (rawData) {
            console.log("🔄 Enhanced grouping by Billing Document and Item...");
            const groupMap = new Map();

            rawData.forEach((record, index) => {
                const billingDoc = record.BillingDocument || "";
                const billingItem = record.BillingDocumentItem || "000010";
                const groupKey = `${billingDoc}_${billingItem}`;

                if (!groupMap.has(groupKey)) {
                    groupMap.set(groupKey, {
                        // Group identifiers
                        GroupKey: groupKey,
                        GroupingType: "BILLING_DOC_AND_ITEM",
                        BillingDocument: billingDoc,
                        BillingDocumentItem: billingItem,

                        // Master data
                        SalesDocument: record.SalesDocument || "",
                        SalesDocumentItem: record.SalesDocumentItem || "",
                        BillingDocumentDate: record.BillingDocumentDate,
                        BillingDocumentType: record.BillingDocumentType || "",
                        Product: record.Product || "",
                        ProductDescription: record.BillingDocumentItemText || "",
                        Customer: record.CustomerFullName_1 || "",
                        CustomerNumber: record.PayerParty_1 || "",
                        CustomerDisplay: record.CustomerFullName_1 || record.PayerParty_1 || "Unknown",
                        Region: record.Region || "",
                        TransactionCurrency: record.TransactionCurrency || "INR",
                        ProfitCenter: record.ProfitCenter || "",
                        BillingQuantityUnit: record.BillingQuantityUnit || "",

                        // Collections
                        GLAccounts: new Map(),
                        TaxCodes: new Map(),
                        ConditionTypes: new Map(),

                        // Aggregated values
                        TotalNetAmount: 0,
                        TotalQuantity: 0,
                        RecordCount: 0,

                        // Detail records
                        DetailRecords: [],

                        // Condition type aggregations
                        PPR0: 0, ZDV2: 0, JOIG: 0, JOCG: 0, JOSG: 0, DRV1: 0, ZTCS: 0, ZDV4: 0
                    });
                }

                const group = groupMap.get(groupKey);

                // Add detail record with proper mapping
                group.DetailRecords.push({
                    ...record,
                    OriginalIndex: index,
                    CustomerDisplay: record.CustomerFullName_1 || record.PayerParty_1 || "Unknown",
                    ProductDescription: record.BillingDocumentItemText || record.Product || ""
                });

                // Aggregate values and condition types (same logic as sales doc grouping)
                group.TotalNetAmount += this._parseAmount(record.TotalNetAmount);
                group.TotalQuantity += this._parseQuantity(record.BillingQuantity);
                group.RecordCount++;

                // Track condition types
                if (record.ConditionType && record.ConditionAmount) {
                    const condAmount = this._parseAmount(record.ConditionAmount);
                    const currentCond = group.ConditionTypes.get(record.ConditionType) || 0;
                    group.ConditionTypes.set(record.ConditionType, currentCond + condAmount);

                    // Aggregate specific condition types
                    switch (record.ConditionType) {
                        case 'PPR0': group.PPR0 += condAmount; break;
                        case 'ZDV2': group.ZDV2 += condAmount; break;
                        case 'JOIG': group.JOIG += condAmount; break;
                        case 'JOCG': group.JOCG += condAmount; break;
                        case 'JOSG': group.JOSG += condAmount; break;
                        case 'DRV1': group.DRV1 += condAmount; break;
                        case 'ZTCS': group.ZTCS += condAmount; break;
                        case 'ZDV4': group.ZDV4 += condAmount; break;
                    }
                }

                // Track GL and Tax codes
                if (record.GLAccount) {
                    const glAmount = this._parseAmount(record.TotalNetAmount);
                    const currentGL = group.GLAccounts.get(record.GLAccount) || 0;
                    group.GLAccounts.set(record.GLAccount, currentGL + glAmount);
                }
                if (record.TaxCode) {
                    const taxAmount = this._parseAmount(record.TotalNetAmount);
                    const currentTax = group.TaxCodes.get(record.TaxCode) || 0;
                    group.TaxCodes.set(record.TaxCode, currentTax + taxAmount);
                }
            });

            // Convert to array and format
            const groupedArray = Array.from(groupMap.values()).map(group => {
                group.GLAccountsDisplay = Array.from(group.GLAccounts.keys()).join(", ") || "N/A";
                group.TaxCodesDisplay = Array.from(group.TaxCodes.keys()).join(", ") || "N/A";
                group.FormattedAmount = this._controller.formatNumber(group.TotalNetAmount);
                return group;
            });

            // Sort by Billing Document and Item
            groupedArray.sort((a, b) => {
                if (a.BillingDocument !== b.BillingDocument) {
                    return a.BillingDocument.localeCompare(b.BillingDocument);
                }
                return a.BillingDocumentItem.localeCompare(b.BillingDocumentItem);
            });

            console.log(`✅ Grouped ${rawData.length} records into ${groupedArray.length} groups by billing document`);
            return groupedArray;
        },

        /**
         * Process raw data for "no grouping" mode with condition type columns
         */
        processRawDataWithConditionColumns: function (rawData) {
            console.log("📊 Processing raw data with condition type columns...");

            // First, group by Sales Document + Item to aggregate condition types
            const tempGroupMap = new Map();

            rawData.forEach(record => {
                const salesDoc = record.SalesDocument || "";
                const salesItem = record.SalesDocumentItem || "000010";
                const groupKey = `${salesDoc}_${salesItem}`;

                if (!tempGroupMap.has(groupKey)) {
                    tempGroupMap.set(groupKey, {
                        ...record,
                        CustomerDisplay: record.CustomerFullName_1 || record.PayerParty_1 || "Unknown",
                        ProductDescription: record.BillingDocumentItemText || record.Product || "",
                        // Initialize condition type columns
                        PPR0: 0, ZDV2: 0, JOIG: 0, JOCG: 0, JOSG: 0, DRV1: 0, ZTCS: 0, ZDV4: 0,
                        // Track all condition types for this combination
                        AllConditionTypes: new Map(),
                        BaseNetAmount: this._parseAmount(record.TotalNetAmount)
                    });
                }

                const group = tempGroupMap.get(groupKey);

                // Aggregate condition types
                if (record.ConditionType && record.ConditionAmount) {
                    const condAmount = this._parseAmount(record.ConditionAmount);

                    // Track all condition types
                    const currentAmount = group.AllConditionTypes.get(record.ConditionType) || 0;
                    group.AllConditionTypes.set(record.ConditionType, currentAmount + condAmount);

                    // Aggregate specific condition types into columns
                    switch (record.ConditionType) {
                        case 'PPR0': group.PPR0 += condAmount; break;
                        case 'ZDV2': group.ZDV2 += condAmount; break;
                        case 'JOIG': group.JOIG += condAmount; break;
                        case 'JOCG': group.JOCG += condAmount; break;
                        case 'JOSG': group.JOSG += condAmount; break;
                        case 'DRV1': group.DRV1 += condAmount; break;
                        case 'ZTCS': group.ZTCS += condAmount; break;
                        case 'ZDV4': group.ZDV4 += condAmount; break;
                    }
                }
            });

            // Convert back to array with calculated invoice amounts
            const processedData = Array.from(tempGroupMap.values()).map(record => {
                // Calculate invoice amount: Base + charges + taxes - discounts
                const invoiceAmount = record.BaseNetAmount +
                    record.ZDV2 + record.JOIG + record.JOCG + record.JOSG +
                    record.ZTCS + record.ZDV4 - record.DRV1;

                return {
                    ...record,
                    InvoiceAmount: invoiceAmount,
                    // Format condition type display
                    ConditionTypesDisplay: Array.from(record.AllConditionTypes.entries())
                        .map(([type, amount]) => `${type}: ${this._controller.formatNumber(amount)}`)
                        .join(" | "),
                    FormattedAmount: this._controller.formatNumber(record.TotalNetAmount)
                };
            });

            console.log(`✅ Processed ${rawData.length} raw records into ${processedData.length} records with condition columns`);
            return processedData;
        },

        /**
         * Get detailed breakdown for a specific sales document + item combination
         */
        getConditionTypeBreakdown: function (salesDocument, salesItem, rawData) {
            const breakdown = {
                salesDocument: salesDocument,
                salesItem: salesItem,
                conditionTypes: new Map(),
                totalBaseAmount: 0,
                calculatedInvoiceAmount: 0
            };

            // Filter records for this specific combination
            const relevantRecords = rawData.filter(record =>
                record.SalesDocument === salesDocument &&
                record.SalesDocumentItem === salesItem
            );

            relevantRecords.forEach(record => {
                // Track base amount
                breakdown.totalBaseAmount += this._parseAmount(record.TotalNetAmount);

                // Track condition types
                if (record.ConditionType && record.ConditionAmount) {
                    const condAmount = this._parseAmount(record.ConditionAmount);
                    const existing = breakdown.conditionTypes.get(record.ConditionType) || {
                        amount: 0,
                        records: 0,
                        description: this._getConditionTypeDescription(record.ConditionType)
                    };

                    breakdown.conditionTypes.set(record.ConditionType, {
                        amount: existing.amount + condAmount,
                        records: existing.records + 1,
                        description: existing.description
                    });
                }
            });

            // Calculate invoice amount
            const conditionAmounts = Array.from(breakdown.conditionTypes.entries());
            let invoiceAmount = breakdown.totalBaseAmount;

            conditionAmounts.forEach(([type, data]) => {
                switch (type) {
                    case 'ZDV2': case 'JOIG': case 'JOCG': case 'JOSG': case 'ZTCS': case 'ZDV4':
                        invoiceAmount += data.amount;
                        break;
                    case 'DRV1':
                        invoiceAmount -= data.amount; // Discount is deducted
                        break;
                }
            });

            breakdown.calculatedInvoiceAmount = invoiceAmount;

            return breakdown;
        },

        /**
         * Get condition type descriptions
         */
        _getConditionTypeDescription: function (conditionType) {
            const descriptions = {
                'PPR0': 'Rate/MT (Base Rate)',
                'ZDV2': 'Additional Charges',
                'JOIG': 'IGST (Integrated Goods & Services Tax)',
                'JOCG': 'CGST (Central Goods & Services Tax)',
                'JOSG': 'SGST (State Goods & Services Tax)',
                'DRV1': 'Trade Discount',
                'ZTCS': 'TCS (Tax Collected at Source)',
                'ZDV4': 'Delay Charges'
            };
            return descriptions[conditionType] || conditionType;
        },

        /**
         * Check if any filters are active
         */
        _hasActiveFilters: function () {
            const oFilterData = this._controller.getView().getModel("filterData").getData();

            return !!(
                oFilterData.salesOrder?.trim() ||
                oFilterData.billingDocument?.trim() ||
                oFilterData.material?.trim() ||
                oFilterData.customer?.trim() ||
                (oFilterData.regions && oFilterData.regions.length > 0) ||
                oFilterData.billingDocumentType?.trim() ||
                oFilterData.dateRange?.from ||
                oFilterData.dateRange?.to ||
                oFilterData.amountRange?.from ||
                oFilterData.amountRange?.to
            );
        },

        /**
         * Create enhanced export data with condition type columns
         */
        createExportData: function (groupedData, includeDetails = false) {
            const exportData = [];

            groupedData.forEach(group => {
                if (includeDetails && group.DetailRecords && group.DetailRecords.length > 0) {
                    // Export individual detail records with condition type breakdown
                    group.DetailRecords.forEach(record => {
                        exportData.push({
                            GroupKey: group.GroupKey || 'INDIVIDUAL',
                            SalesDocument: record.SalesDocument,
                            SalesDocumentItem: record.SalesDocumentItem,
                            BillingDocument: record.BillingDocument,
                            BillingDocumentItem: record.BillingDocumentItem,
                            BillingDate: this._formatDateForExport(record.BillingDocumentDate),
                            Product: record.Product,
                            ProductDescription: record.BillingDocumentItemText,
                            Customer: record.CustomerFullName_1,
                            CustomerNumber: record.PayerParty_1,
                            Region: record.Region,
                            GLAccount: record.GLAccount,
                            TaxCode: record.TaxCode,
                            BaseAmount: this._parseAmount(record.TotalNetAmount),
                            Currency: record.TransactionCurrency,
                            Quantity: this._parseQuantity(record.BillingQuantity),
                            Unit: record.BillingQuantityUnit,

                            // Condition Type Columns
                            'Rate_MT_PPR0': group.PPR0 || 0,
                            'Additional_Charges_ZDV2': group.ZDV2 || 0,
                            'IGST_JOIG': group.JOIG || 0,
                            'CGST_JOCG': group.JOCG || 0,
                            'SGST_JOSG': group.JOSG || 0,
                            'Discount_DRV1': group.DRV1 || 0,
                            'TCS_ZTCS': group.ZTCS || 0,
                            'Delay_Charges_ZDV4': group.ZDV4 || 0,

                            // Calculated fields
                            InvoiceAmount: (group.TotalNetAmount || 0) + (group.ZDV2 || 0) +
                                (group.JOIG || 0) + (group.JOCG || 0) + (group.JOSG || 0) +
                                (group.ZTCS || 0) + (group.ZDV4 || 0) - (group.DRV1 || 0),

                            // Additional fields
                            ProfitCenter: record.ProfitCenter,
                            Plant: record.Plant,
                            Division: record.Division,
                            EWayBillNumber: record.IN_EDocEInvcEWbillNmbr,
                            EWayBillStatus: record.IN_EDocEWbillStatus,
                            CustomerPO: record.PurchaseOrderByShipToParty,

                            // Sales Order Text fields (if loaded)
                            WarehouseCode: group.ZXT1 || record.ZXT1,
                            WarehouseLocation: group.ZXT3 || record.ZXT3,
                            Contract: group.ZXT4 || record.ZXT4,
                            DateRange: group.ZXT5 || record.ZXT5,
                            Description: group.ZXT6 || record.ZXT6
                        });
                    });
                } else {
                    // Export grouped summary with condition type columns
                    exportData.push({
                        GroupType: group.GroupingType || 'INDIVIDUAL',
                        SalesDocument: group.SalesDocument,
                        SalesDocumentItem: group.SalesDocumentItem,
                        BillingDocument: group.BillingDocument,
                        BillingDocumentItem: group.BillingDocumentItem,
                        BillingDate: this._formatDateForExport(group.BillingDocumentDate),
                        Product: group.Product,
                        ProductDescription: group.ProductDescription,
                        Customer: group.Customer,
                        CustomerNumber: group.CustomerNumber,
                        Region: group.Region,
                        BaseAmount: group.TotalNetAmount,
                        Currency: group.TransactionCurrency,
                        TotalQuantity: group.TotalQuantity,
                        RecordCount: group.RecordCount,

                        // Condition Type Columns
                        'Rate_MT_PPR0': group.PPR0 || 0,
                        'Additional_Charges_ZDV2': group.ZDV2 || 0,
                        'IGST_JOIG': group.JOIG || 0,
                        'CGST_JOCG': group.JOCG || 0,
                        'SGST_JOSG': group.JOSG || 0,
                        'Discount_DRV1': group.DRV1 || 0,
                        'TCS_ZTCS': group.ZTCS || 0,
                        'Delay_Charges_ZDV4': group.ZDV4 || 0,

                        // Calculated Invoice Amount
                        InvoiceAmount: group.TotalNetAmount + (group.ZDV2 || 0) +
                            (group.JOIG || 0) + (group.JOCG || 0) + (group.JOSG || 0) +
                            (group.ZTCS || 0) + (group.ZDV4 || 0) - (group.DRV1 || 0),

                        GLAccounts: group.GLAccountsDisplay,
                        TaxCodes: group.TaxCodesDisplay,
                        ProfitCenter: group.ProfitCenter,

                        // Sales Order Text fields
                        WarehouseCode: group.ZXT1,
                        WarehouseLocation: group.ZXT3,
                        Contract: group.ZXT4,
                        DateRange: group.ZXT5,
                        Description: group.ZXT6
                    });
                }
            });

            return exportData;
        },

        /**
         * Parse amount safely
         */
        _parseAmount: function (amount) {
            if (!amount && amount !== 0) return 0;
            if (typeof amount === 'number') return amount;
            if (typeof amount === 'string') {
                const cleaned = amount.replace(/[^\d.-]/g, '');
                const parsed = parseFloat(cleaned);
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        },

        /**
         * Parse quantity safely
         */
        _parseQuantity: function (quantity) {
            if (!quantity && quantity !== 0) return 0;
            if (typeof quantity === 'number') return quantity;
            if (typeof quantity === 'string') {
                const parsed = parseFloat(quantity);
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        },

        /**
         * Build error message from OData error
         */
        _buildErrorMessage: function (context, error) {
            let message = `${context} loading failed`;

            if (error.responseText) {
                try {
                    const errorObj = JSON.parse(error.responseText);
                    if (errorObj.error?.message) {
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
         * Format date for export
         */
        _formatDateForExport: function (date) {
            if (!date) return "";

            if (typeof date === "string" && date.includes("/Date(")) {
                const timestamp = parseInt(date.match(/\d+/)[0]);
                const dateObj = new Date(timestamp);
                return dateObj.toLocaleDateString("en-IN");
            }

            return new Date(date).toLocaleDateString("en-IN");
        },

        /**
         * Get metadata analysis results
         */
        getMetadataAnalysis: function () {
            return this._metadataAnalysis;
        },

        /**
         * Get last data analysis results
         */
        getLastDataAnalysis: function () {
            return this._lastDataAnalysis;
        }
    });
});
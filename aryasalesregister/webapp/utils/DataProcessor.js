sap.ui.define([
    "sap/ui/base/Object"
], function (Object) {
    "use strict";

    return Object.extend("aryasalesregister.utils.DataProcessor", {

        constructor: function (controller) {
            this.controller = controller;
        },

        /**
         * Process loaded data - enhanced for sales register with proper grouping
         * @param {Array} rawData - Raw data from the service
         * @returns {Promise<Array>} Processed and grouped data
         */
        _processLoadedData: async function (rawData) {
            const controller = this.controller;
            if (!rawData || rawData.length === 0) {
                console.warn("⚠️ No raw data received from the service.");
                return [];
            }
            console.log("📊 Processing loaded data with", rawData.length, "records");

            // Load and map sales order text data if service is available
            let enhancedDataWithText = rawData;
            if (controller.salesOrderTextService) {
                try {
                    enhancedDataWithText = await controller.salesOrderTextService.loadAndMapSalesOrderText(rawData);
                } catch (error) {
                    console.warn("⚠️ Sales order text service failed, continuing with raw data:", error);
                    enhancedDataWithText = rawData;
                }
            }

            // Group data by Sales Document and Item
            const groupedData = this.groupBySalesDocumentAndItem(enhancedDataWithText);

            console.log("✅ Data processing complete. Grouped records:", groupedData.length);
            return groupedData;
        },

        /**
         * Groups sales data by Sales Document and Item combination
         * This is the core grouping logic for Sales Register
         * @param {Array} rawData - Raw sales data
         * @returns {Array} Grouped sales data with calculated totals
         */
        groupBySalesDocumentAndItem: function (rawData) {
            const controller = this.controller;
            console.log("📊 Starting grouping by Sales Document & Item...");

            const groupMap = new Map();

            rawData.forEach((record) => {
                const salesDoc = record.SalesDocument || "N/A";
                const salesItem = record.SalesDocumentItem || "000010";
                const groupKey = `${salesDoc}_${salesItem}`;

                if (!groupMap.has(groupKey)) {
                    // Initialize new group with base document data
                    groupMap.set(groupKey, {
                        GroupKey: groupKey,
                        isSummary: true,

                        // Document identifiers
                        BillingDocument: record.BillingDocument,
                        BillingDocumentDate: record.BillingDocumentDate,
                        BillingDocumentType: record.BillingDocumentType,
                        SalesDocument: record.SalesDocument,
                        SalesDocumentItem: record.SalesDocumentItem,

                        // Customer information
                        CustomerNumber: record.PayerParty || record.PayerParty_1,
                        CustomerDisplay: record.CustomerFullName_1 || record.CustomerDisplay,
                        CustomerState: record.Region,
                        CustomerGSTIN: record.BusinessPartnerName1 || record.PurchaseOrderByShipToParty,

                        // Product information
                        Product: record.Product,
                        ProductDescription: record.BillingDocumentItemText || record.ProductDescription,
                        Plant: record.Plant,

                        // Quantity information
                        BillingQuantity: controller._parseQuantity(record.BillingQuantity),
                        BillingQuantityUnit: record.BillingQuantityUnit,

                        // Currency
                        TransactionCurrency: record.TransactionCurrency,

                        // Initialize all condition type amounts to 0
                        PPR0: 0,     // Rate/Price per MT
                        DRV1: 0,     // Discount
                        ZDV2: 0,     // Additional Charges
                        JOIG: 0,     // IGST
                        JOCG: 0,     // CGST
                        JOSG: 0,     // SGST
                        ZTCS: 0,     // TCS
                        ZDV4: 0,     // Delay Charges
                        JTC1: 0,     // Tax Condition 1
                        JTC2: 0,     // Tax Condition 2
                        JTC3: 0,     // Tax Condition 3
                        DRD1: 0,     // Discount Condition 1
                        DCD1: 0,     // Cash Discount
                        PCIP: 0,     // Commission

                        // Calculated totals
                        TotalNetAmount: 0,
                        InvoiceAmount: 0,

                        // E-Invoice information
                        IN_EDocEWbillStatus: record.IN_EDocEWbillStatus,
                        IN_EDocEInvcEWbillNmbr: record.IN_EDocEInvcEWbillNmbr,

                        // Sales Order Text fields (ZXT fields)
                        ZXT1: record.ZXT1 || "",  // Warehouse Code
                        ZXT3: record.ZXT3 || "",  // Warehouse Location
                        ZXT4: record.ZXT4 || "",  // Contract ID/Trade ID
                        ZXT5: record.ZXT5 || "",  // Service Period
                        ZXT6: record.ZXT6 || "",  // Material Description
                        ZXT7: record.ZXT7 || "",  // Flag
                        ZXT8: record.ZXT8 || "",  // Item Number

                        // Additional fields
                        Division: record.Division,
                        ProfitCenter: record.ProfitCenter,
                        TaxCode: record.TaxCode,
                        CustomerPaymentTerms: record.CustomerPaymentTerms,

                        // Store all detail records for reference
                        DetailRecords: []
                    });
                }

                const group = groupMap.get(groupKey);

                // Parse and accumulate condition amounts
                const condAmount = controller._parseAmount(record.ConditionAmount);

                // Add condition amount to the appropriate field if it exists in our group
                if (record.ConditionType && group.hasOwnProperty(record.ConditionType)) {
                    group[record.ConditionType] += condAmount;
                    console.log(`📝 ${groupKey}: Adding ${record.ConditionType} = ${condAmount}, New Total = ${group[record.ConditionType]}`);
                }

                // Store the detail record
                group.DetailRecords.push(record);
            });

            // Final calculations for each group
            const groupedArray = Array.from(groupMap.values()).map(group => {
                // Calculate Total Net Amount (typically based on PPR0 - base price)
                group.TotalNetAmount = Math.abs(group.PPR0 || 0);

                // Calculate Invoice Amount using Sales Register formula:
                // Invoice Amount = Net Amount + Additional Charges + All Taxes - Discounts
                group.InvoiceAmount = group.TotalNetAmount +
                    (group.ZDV2 || 0) +      // Additional charges
                    (group.JOIG || 0) +      // IGST
                    (group.JOCG || 0) +      // CGST
                    (group.JOSG || 0) +      // SGST
                    (group.ZTCS || 0) +      // TCS
                    (group.ZDV4 || 0) +      // Delay charges
                    (group.JTC1 || 0) +      // Additional tax conditions
                    (group.JTC2 || 0) +
                    (group.JTC3 || 0) +
                    (group.PCIP || 0) -      // Commission (if positive, add it)
                    (group.DRV1 || 0) -      // Main discount
                    (group.DRD1 || 0) -      // Additional discount
                    (group.DCD1 || 0);       // Cash discount

                // Round amounts to 2 decimal places
                group.TotalNetAmount = Math.round(group.TotalNetAmount * 100) / 100;
                group.InvoiceAmount = Math.round(group.InvoiceAmount * 100) / 100;

                // Ensure non-negative amounts
                group.TotalNetAmount = Math.max(0, group.TotalNetAmount);
                group.InvoiceAmount = Math.max(0, group.InvoiceAmount);

                console.log(`🎯 Group ${group.GroupKey} FINAL CALCULATION:`);
                console.log(`   📋 Detail Records: ${group.DetailRecords.length}`);
                console.log(`   💵 Net Amount (PPR0): ${group.TotalNetAmount}`);
                console.log(`   💸 Invoice Amount: ${group.InvoiceAmount}`);
                console.log(`   🏷️ Key Conditions: JOIG=${group.JOIG}, JOCG=${group.JOCG}, JOSG=${group.JOSG}, DRV1=${group.DRV1}`);

                return group;
            });

            // Sort the grouped data
            groupedArray.sort((a, b) => {
                // Sort by Sales Document first, then by Sales Document Item
                if (a.SalesDocument !== b.SalesDocument) {
                    return a.SalesDocument.localeCompare(b.SalesDocument);
                }
                return a.SalesDocumentItem.localeCompare(b.SalesDocumentItem);
            });

            console.log(`✅ Successfully grouped ${rawData.length} records into ${groupedArray.length} sales document groups`);

            // Log summary statistics
            const totalInvoiceAmount = groupedArray.reduce((sum, group) => sum + group.InvoiceAmount, 0);
            const totalNetAmount = groupedArray.reduce((sum, group) => sum + group.TotalNetAmount, 0);
            console.log(`💰 Total Net Amount: ${totalNetAmount.toFixed(2)}`);
            console.log(`💰 Total Invoice Amount: ${totalInvoiceAmount.toFixed(2)}`);

            return groupedArray;
        },

        /**
         * Alternative grouping method - by Billing Document and Item
         * Can be used when different grouping is needed
         * @param {Array} rawData - Raw sales data
         * @returns {Array} Grouped by billing document and item
         */
        groupByBillingDocumentAndItem: function (rawData) {
            console.log("📊 Grouping by Billing Document & Item...");

            const controller = this.controller;
            const groupMap = new Map();

            rawData.forEach((record) => {
                const billingDoc = record.BillingDocument || "N/A";
                const billingItem = record.BillingDocumentItem || "000010";
                const groupKey = `${billingDoc}_${billingItem}`;

                if (!groupMap.has(groupKey)) {
                    groupMap.set(groupKey, {
                        GroupKey: groupKey,
                        isSummary: true,

                        // Use Billing Document as primary identifier
                        BillingDocument: record.BillingDocument,
                        BillingDocumentItem: record.BillingDocumentItem,
                        BillingDocumentDate: record.BillingDocumentDate,
                        SalesDocument: record.SalesDocument,
                        SalesDocumentItem: record.SalesDocumentItem,

                        // Copy other fields similar to the main grouping method
                        CustomerNumber: record.PayerParty || record.PayerParty_1,
                        CustomerDisplay: record.CustomerFullName_1,
                        Product: record.Product,
                        ProductDescription: record.BillingDocumentItemText,
                        TransactionCurrency: record.TransactionCurrency,
                        BillingQuantity: controller._parseQuantity(record.BillingQuantity),

                        // Initialize condition amounts
                        PPR0: 0, DRV1: 0, ZDV2: 0, JOIG: 0, JOCG: 0, JOSG: 0, ZTCS: 0, ZDV4: 0,
                        TotalNetAmount: 0, InvoiceAmount: 0,
                        DetailRecords: []
                    });
                }

                const group = groupMap.get(groupKey);
                const condAmount = controller._parseAmount(record.ConditionAmount);

                if (record.ConditionType && group.hasOwnProperty(record.ConditionType)) {
                    group[record.ConditionType] += condAmount;
                }

                group.DetailRecords.push(record);
            });

            // Calculate totals for billing document groups
            return Array.from(groupMap.values()).map(group => {
                group.TotalNetAmount = Math.abs(group.PPR0 || 0);
                group.InvoiceAmount = group.TotalNetAmount + (group.ZDV2 || 0) + (group.JOIG || 0) +
                    (group.JOCG || 0) + (group.JOSG || 0) + (group.ZTCS || 0) +
                    (group.ZDV4 || 0) - (group.DRV1 || 0);

                group.TotalNetAmount = Math.round(group.TotalNetAmount * 100) / 100;
                group.InvoiceAmount = Math.round(group.InvoiceAmount * 100) / 100;

                return group;
            }).sort((a, b) => {
                if (a.BillingDocument !== b.BillingDocument) {
                    return a.BillingDocument.localeCompare(b.BillingDocument);
                }
                return (a.BillingDocumentItem || "").localeCompare(b.BillingDocumentItem || "");
            });
        },

        /**
         * Create flattened data structure for display
         * This method is kept for compatibility but not used in the new structure
         * @param {Array} groupedData - Grouped data
         * @returns {Array} Flattened data with condition details
         */
        _flattenGroupedData: function (groupedData) {
            const flattened = [];

            groupedData.forEach(group => {
                // Add summary row
                const summaryRow = {
                    ...group,
                    isSummary: true,
                    displayConditionType: "",
                    displayConditionAmount: null
                };
                flattened.push(summaryRow);

                // Add condition detail rows if needed
                const conditionTypes = ['PPR0', 'DRV1', 'ZDV2', 'JOIG', 'JOCG', 'JOSG', 'ZTCS', 'ZDV4'];
                conditionTypes.forEach(type => {
                    if (group[type] !== 0) {
                        flattened.push({
                            isSummary: false,
                            GroupKey: group.GroupKey,
                            displayConditionType: type,
                            displayConditionAmount: group[type],
                            TransactionCurrency: group.TransactionCurrency
                        });
                    }
                });
            });

            return flattened;
        },

        // Helper functions for parsing values
        _parseAmount: function (amount) {
            if (typeof amount === 'number') return amount;
            if (typeof amount === 'string') {
                const parsed = parseFloat(amount.replace(/[^\d.-]/g, ''));
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        },

        _parseQuantity: function (quantity) {
            if (typeof quantity === 'number') return quantity;
            if (typeof quantity === 'string') {
                const parsed = parseFloat(quantity.replace(/[^\d.-]/g, ''));
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        },

        /**
         * Validates and processes sales order text data
         * @param {Object} textData - Raw text data from sales order
         * @returns {Object} Processed text data with ZXT fields
         */
        processSalesOrderTextData: function (textData) {
            return {
                ZXT1: textData.ZXT1 || textData.WarehouseCode || "",        // Warehouse Code
                ZXT2: textData.ZXT2 || textData.AdditionalCharges || "",     // Additional Charges  
                ZXT3: textData.ZXT3 || textData.WarehouseLocation || "",     // Warehouse Location
                ZXT4: textData.ZXT4 || textData.ContractTradeId || "",       // Contract ID/Trade ID
                ZXT5: textData.ZXT5 || textData.ServicePeriod || "",         // Service Period/Invoice Raised for the month
                ZXT6: textData.ZXT6 || textData.MaterialDescription || "",   // Material Description/Warehouse Name
                ZXT7: textData.ZXT7 || textData.ClusterId || "",             // Flag/Cluster ID
                ZXT8: textData.ZXT8 || textData.ItemNumber || ""             // Item Number
            };
        },

        /**
         * Map condition types to their business meanings
         * @param {String} conditionType - SAP condition type
         * @returns {String} Business description
         */
        getConditionTypeDescription: function (conditionType) {
            const conditionMap = {
                'PPR0': 'Rate/MT',
                'DRV1': 'Discount',
                'ZDV2': 'Additional Charges',
                'JOIG': 'IGST',
                'JOCG': 'CGST',
                'JOSG': 'SGST',
                'ZTCS': 'TCS',
                'ZDV4': 'Delay Charges',
                'JTC1': 'Tax Condition 1',
                'JTC2': 'Tax Condition 2',
                'JTC3': 'Tax Condition 3',
                'DRD1': 'Additional Discount',
                'DCD1': 'Cash Discount',
                'PCIP': 'Commission'
            };

            return conditionMap[conditionType] || conditionType;
        },

        /**
         * Calculate summary statistics for loaded data
         * @param {Array} groupedData - Grouped sales data
         * @returns {Object} Summary statistics
         */
        calculateSummaryStatistics: function (groupedData) {
            const stats = {
                totalGroups: groupedData.length,
                totalInvoiceAmount: 0,
                totalNetAmount: 0,
                totalDiscount: 0,
                totalTax: 0,
                uniqueSalesDocuments: new Set(),
                uniqueBillingDocuments: new Set(),
                uniqueCustomers: new Set(),
                documentTypes: new Map(),
                plants: new Map()
            };

            groupedData.forEach(group => {
                stats.totalInvoiceAmount += (group.InvoiceAmount || 0);
                stats.totalNetAmount += (group.TotalNetAmount || 0);
                stats.totalDiscount += (group.DRV1 || 0);
                stats.totalTax += (group.JOIG || 0) + (group.JOCG || 0) + (group.JOSG || 0);

                if (group.SalesDocument) stats.uniqueSalesDocuments.add(group.SalesDocument);
                if (group.BillingDocument) stats.uniqueBillingDocuments.add(group.BillingDocument);
                if (group.CustomerNumber) stats.uniqueCustomers.add(group.CustomerNumber);

                // Count document types
                const docType = group.BillingDocumentType || 'Unknown';
                stats.documentTypes.set(docType, (stats.documentTypes.get(docType) || 0) + 1);

                // Count plants
                const plant = group.Plant || 'Unknown';
                stats.plants.set(plant, (stats.plants.get(plant) || 0) + 1);
            });

            // Convert sets to counts
            stats.uniqueSalesDocuments = stats.uniqueSalesDocuments.size;
            stats.uniqueBillingDocuments = stats.uniqueBillingDocuments.size;
            stats.uniqueCustomers = stats.uniqueCustomers.size;

            // Round amounts
            stats.totalInvoiceAmount = Math.round(stats.totalInvoiceAmount * 100) / 100;
            stats.totalNetAmount = Math.round(stats.totalNetAmount * 100) / 100;
            stats.totalDiscount = Math.round(stats.totalDiscount * 100) / 100;
            stats.totalTax = Math.round(stats.totalTax * 100) / 100;

            return stats;
        }
    });
});
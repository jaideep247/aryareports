sap.ui.define([
    "sap/ui/base/Object"
], function (BaseObject) {
    "use strict";

    return BaseObject.extend("aryasalesregister.utils.DataGroupingManager", {
        constructor: function (oController) {
            BaseObject.call(this);
            this._controller = oController;
        },

        /**
         * Group by billing document only
         */
        groupByBillingDocument: function (rawData) {
            console.log("📋 Grouping by billing document");
            
            if (!Array.isArray(rawData) || rawData.length === 0) {
                console.warn("⚠️ No data to group");
                return [];
            }

            const groupedRecords = {};
            const processingErrors = [];

            rawData.forEach((item, index) => {
                try {
                    const key = item.BillingDocument;
                    if (!key) {
                        processingErrors.push(`Record ${index}: Missing BillingDocument`);
                        return;
                    }

                    if (!groupedRecords[key]) {
                        groupedRecords[key] = this._initializeBillingDocumentGroup(item);
                    } else {
                        this._mergeItemIntoBillingDocumentGroup(groupedRecords[key], item);
                    }
                } catch (error) {
                    processingErrors.push(`Record ${index}: ${error.message}`);
                }
            });

            if (processingErrors.length > 0) {
                console.warn("⚠️ Processing errors:", processingErrors);
            }

            const result = Object.values(groupedRecords).map(record => {
                return this._formatBillingDocumentGroup(record);
            });

            console.log("✅ Billing document grouping complete:", result.length, "groups");
            return result;
        },

        /**
         * Group by billing document AND items (material/product combination)
         */
        groupByBillingDocumentAndItems: function (rawData) {
            console.log("📋 Grouping by billing document AND items");
            
            if (!Array.isArray(rawData) || rawData.length === 0) {
                console.warn("⚠️ No data to group");
                return [];
            }

            const groupedRecords = {};
            const processingErrors = [];

            rawData.forEach((item, index) => {
                try {
                    const billingDoc = item.BillingDocument;
                    // Use document item as the secondary key to collapse identical lines
                    const billingItem = item.BillingDocumentItem || item.SalesDocumentItem || item.Item;
                    
                    if (!billingDoc) {
                        processingErrors.push(`Record ${index}: Missing BillingDocument`);
                        return;
                    }

                    const key = `${billingDoc}_${billingItem}`;
                    
                    if (!groupedRecords[key]) {
                        groupedRecords[key] = this._initializeBillingDocumentAndItemsGroup(item);
                    } else {
                        this._mergeItemIntoBillingDocumentAndItemsGroup(groupedRecords[key], item);
                    }
                } catch (error) {
                    processingErrors.push(`Record ${index}: ${error.message}`);
                }
            });

            if (processingErrors.length > 0) {
                console.warn("⚠️ Processing errors:", processingErrors);
            }

            const result = Object.values(groupedRecords).map(record => {
                return this._formatBillingDocumentAndItemsGroup(record);
            });

            console.log("✅ Billing document + items grouping complete:", result.length, "groups");
            return result;
        },

        /**
         * Group by sales document AND items (material/product combination)
         */
        groupBySalesDocumentAndItems: function (rawData) {
            console.log("📋 Grouping by sales document AND items");
            
            if (!Array.isArray(rawData) || rawData.length === 0) {
                console.warn("⚠️ No data to group");
                return [];
            }

            const groupedRecords = {};
            const processingErrors = [];

            rawData.forEach((item, index) => {
                try {
                    const salesDoc = item.SalesDocument;
                    // Use document item as the secondary key to collapse identical lines
                    const salesItem = item.SalesDocumentItem || item.Item || item.SalesOrderItem;
                    
                    if (!salesDoc) {
                        processingErrors.push(`Record ${index}: Missing SalesDocument`);
                        return;
                    }

                    const key = `${salesDoc}_${salesItem}`;
                    
                    if (!groupedRecords[key]) {
                        groupedRecords[key] = this._initializeSalesDocumentAndItemsGroup(item);
                    } else {
                        this._mergeItemIntoSalesDocumentAndItemsGroup(groupedRecords[key], item);
                    }
                } catch (error) {
                    processingErrors.push(`Record ${index}: ${error.message}`);
                }
            });

            if (processingErrors.length > 0) {
                console.warn("⚠️ Processing errors:", processingErrors);
            }

            const result = Object.values(groupedRecords).map(record => {
                return this._formatSalesDocumentAndItemsGroup(record);
            });

            console.log("✅ Sales document + items grouping complete:", result.length, "groups");
            return result;
        },

        /**
         * Group by sales order with text enrichment
         */
        groupBySalesOrder: function (rawData) {
            console.log("📝 Grouping by sales order with text enrichment");
            
            try {
                const groupedRecords = this._groupBySalesOrder(rawData);
                return this._enrichWithSalesOrderTexts(Object.values(groupedRecords));
            } catch (error) {
                console.error("❌ Sales order grouping error:", error);
                return rawData;
            }
        },

        // Private methods for billing document grouping
        _initializeBillingDocumentGroup: function (item) {
            return {
                ...item,
                Materials: [item.Material || item.Product],
                Products: [item.Product],
                Quantities: [item.BillingQuantity],
                TotalNetAmountSum: parseFloat(item.TotalNetAmount) || 0,
                DiscountSum: parseFloat(item.Discount) || 0,
                TotalQuantitySum: parseFloat(item.BillingQuantity) || 0,
                ItemCount: 1,
                GroupingType: 'BILLING_DOCUMENT',
                GroupingTimestamp: new Date().toISOString(),
                
            };
        },

        _mergeItemIntoBillingDocumentGroup: function (group, item) {
            const currentMaterial = item.Material || item.Product;
            const currentProduct = item.Product;
            
            const materialExists = group.Materials.includes(currentMaterial);
            const productExists = group.Products.includes(currentProduct);
            
            group.Materials.push(currentMaterial);
            group.Products.push(currentProduct);
            group.Quantities.push(item.BillingQuantity);
            
            // Do not add financial amounts for identical document+item lines
            // Keep initial values set during group initialization
            if (group.ItemCount > 1) {
                // no-op: avoid double-counting TotalNetAmount/Discount/ConditionAmount
            }
            
            if (!materialExists && !productExists) {
                group.TotalQuantitySum += parseFloat(item.BillingQuantity) || 0;
            }
            
            group.ItemCount += 1;
            
            
        },

        _formatBillingDocumentGroup: function (record) {
            const formattedRecord = { ...record };
            const uniqueMaterials = [...new Set(record.Materials)].filter(Boolean);
            const uniqueProducts = [...new Set(record.Products)].filter(Boolean);

            formattedRecord.MaterialCombined = uniqueMaterials.length === 1 ?
                uniqueMaterials[0] : uniqueMaterials.join(", ");
            formattedRecord.ProductsCombined = uniqueProducts.length === 1 ?
                uniqueProducts[0] : uniqueProducts.join(" | ");
            
            if (uniqueMaterials.length === 1 && uniqueProducts.length === 1) {
                formattedRecord.CombinedQuantities = record.Quantities
                    .map(q => `${q || 0} ${record.BillingQuantityUnit || ''}`).join(" | ");
                formattedRecord.QuantityNote = "Individual quantities (same material)";
            } else {
                formattedRecord.CombinedQuantities = `${record.TotalQuantitySum || 0} ${record.BillingQuantityUnit || ''}`;
                formattedRecord.QuantityNote = "Total quantity (different materials)";
            }

            formattedRecord.Material = formattedRecord.MaterialCombined;
            formattedRecord.TotalNetAmount = record.TotalNetAmountSum;
            formattedRecord.Discount = record.DiscountSum;
            formattedRecord.BillingQuantity = record.TotalQuantitySum;
            
            const quantityLogic = uniqueMaterials.length === 1 ? 
                "quantities not summed (same material)" : 
                "quantities summed (different materials)";
            
            formattedRecord.GroupSummary = `${record.ItemCount} items, ${uniqueMaterials.length} materials, ${quantityLogic}`;
            formattedRecord.AverageItemValue = record.ItemCount > 0 ? (record.TotalNetAmountSum / record.ItemCount) : 0;
            
            // Try to format currency if formatter is available, otherwise use simple formatting
            try {
                if (this._controller._formatter && this._controller._formatter.formatCurrency) {
                    formattedRecord.AverageItemValueFormatted = this._controller._formatter.formatCurrency(
                        formattedRecord.AverageItemValue, 
                        record.TransactionCurrency
                    );
                } else {
                    formattedRecord.AverageItemValueFormatted = `${formattedRecord.AverageItemValue.toFixed(2)} ${record.TransactionCurrency || 'USD'}`;
                }
            } catch (error) {
                formattedRecord.AverageItemValueFormatted = `${formattedRecord.AverageItemValue.toFixed(2)} ${record.TransactionCurrency || 'USD'}`;
            }

            return formattedRecord;
        },

        // Private methods for billing document + items grouping
        _initializeBillingDocumentAndItemsGroup: function (item) {
            const billingItem = item.BillingDocumentItem || item.SalesDocumentItem || item.Item;
            return {
                ...item,
                Materials: [item.Material || item.Product],
                Products: [item.Product],
                Quantities: [item.BillingQuantity],
                TotalNetAmountSum: parseFloat(item.TotalNetAmount) || 0,
                DiscountSum: parseFloat(item.Discount) || 0,
                TotalQuantitySum: parseFloat(item.BillingQuantity) || 0,
                ItemCount: 1,
                GroupingType: 'BILLING_DOCUMENT_AND_ITEMS',
                GroupingTimestamp: new Date().toISOString(),
                
                BillingDocumentKey: item.BillingDocument,
                ItemKey: billingItem,
                MaterialKey: item.Material || item.Product,
                ProductKey: item.Product
            };
        },

        _mergeItemIntoBillingDocumentAndItemsGroup: function (group, item) {
            group.Quantities.push(item.BillingQuantity);
            
            // Do not add financial amounts for identical document+item lines
            if (group.ItemCount > 1) {
                // no-op
            }
            
            // For billing document + items grouping, quantities should NOT be summed
            // since we're already grouping by the same billing doc + same material/product
            // The quantity represents the same item, so we keep the original quantity
            if (group.ItemCount === 1) {
                // First item, keep the quantity as is
                group.TotalQuantitySum = parseFloat(item.BillingQuantity) || 0;
            }
            // For subsequent items with same billing doc + material + product, don't add quantities
            
            group.ItemCount += 1;
            
            
        },

        _formatBillingDocumentAndItemsGroup: function (record) {
            const formattedRecord = { ...record };
            
            formattedRecord.Material = record.Material || record.Product;
            formattedRecord.Product = record.Product;
            formattedRecord.TotalNetAmount = record.TotalNetAmountSum;
            formattedRecord.Discount = record.DiscountSum;
            formattedRecord.BillingQuantity = record.TotalQuantitySum;

            formattedRecord.CombinedQuantities = `${record.TotalQuantitySum || 0} ${record.BillingQuantityUnit || ''}`;
            formattedRecord.QuantityNote = `Combined quantity from ${record.ItemCount} lines for same document item`;

            formattedRecord.GroupSummary = `${record.ItemCount} lines combined (same billing document + same item)`;
            formattedRecord.AverageItemValue = record.ItemCount > 0 ? (record.TotalNetAmountSum / record.ItemCount) : 0;
            
            // Try to format currency if formatter is available, otherwise use simple formatting
            try {
                if (this._controller._formatter && this._controller._formatter.formatCurrency) {
                    formattedRecord.AverageItemValueFormatted = this._controller._formatter.formatCurrency(
                        formattedRecord.AverageItemValue, 
                        record.TransactionCurrency
                    );
                } else {
                    formattedRecord.AverageItemValueFormatted = `${formattedRecord.AverageItemValue.toFixed(2)} ${record.TransactionCurrency || 'USD'}`;
                }
            } catch (error) {
                formattedRecord.AverageItemValueFormatted = `${formattedRecord.AverageItemValue.toFixed(2)} ${record.TransactionCurrency || 'USD'}`;
            }

            return formattedRecord;
        },

        // Private methods for sales document + items grouping
        _initializeSalesDocumentAndItemsGroup: function (item) {
            const salesItem = item.SalesDocumentItem || item.Item || item.SalesOrderItem;
            return {
                ...item,
                Materials: [item.Material || item.Product],
                Products: [item.Product],
                Quantities: [item.OrderQuantity || item.BillingQuantity || 0],
                TotalNetAmountSum: parseFloat(item.TotalNetAmount || item.NetValue) || 0,
                DiscountSum: parseFloat(item.Discount || 0),
                TotalQuantitySum: parseFloat(item.OrderQuantity || item.BillingQuantity || 0),
                ItemCount: 1,
                GroupingType: 'SALES_DOCUMENT_AND_ITEMS',
                GroupingTimestamp: new Date().toISOString(),
                
                SalesDocumentKey: item.SalesDocument,
                ItemKey: salesItem,
                MaterialKey: item.Material || item.Product,
                ProductKey: item.Product,
                SalesOrderType: item.SalesOrderType,
                SalesOrganization: item.SalesOrganization,
                DistributionChannel: item.DistributionChannel,
                Division: item.Division
            };
        },

        _mergeItemIntoSalesDocumentAndItemsGroup: function (group, item) {
            group.Quantities.push(item.OrderQuantity || item.BillingQuantity || 0);
            
            // Do not add financial amounts for identical document+item lines
            // Keep initial values set during group initialization
            if (group.ItemCount > 1) {
                // no-op: avoid double-counting TotalNetAmount/Discount/ConditionAmount
            }
            
            // For sales document + items grouping, quantities should NOT be summed
            // since we're already grouping by the same sales doc + same material/product
            // The quantity represents the same item, so we keep the original quantity
            if (group.ItemCount === 1) {
                // First item, keep the quantity as is
                group.TotalQuantitySum = parseFloat(item.OrderQuantity || item.BillingQuantity || 0);
            }
            // For subsequent items with same sales doc + material + product, don't add quantities
            
            group.ItemCount += 1;
            
            
        },

        _formatSalesDocumentAndItemsGroup: function (record) {
            const formattedRecord = { ...record };
            
            formattedRecord.Material = record.Material || record.Product;
            formattedRecord.Product = record.Product;
            formattedRecord.TotalNetAmount = record.TotalNetAmountSum;
            formattedRecord.Discount = record.DiscountSum;
            formattedRecord.OrderQuantity = record.TotalQuantitySum;

            formattedRecord.CombinedQuantities = `${record.TotalQuantitySum || 0} ${record.OrderUnit || record.BillingQuantityUnit || ''}`;
            formattedRecord.QuantityNote = `Combined quantity from ${record.ItemCount} lines for same document item`;

            formattedRecord.GroupSummary = `${record.ItemCount} lines combined (same sales document + same item)`;
            formattedRecord.AverageItemValue = record.ItemCount > 0 ? (record.TotalNetAmountSum / record.ItemCount) : 0;
            
            // Try to format currency if formatter is available, otherwise use simple formatting
            try {
                if (this._controller._formatter && this._controller._formatter.formatCurrency) {
                    formattedRecord.AverageItemValueFormatted = this._controller._formatter.formatCurrency(
                        formattedRecord.AverageItemValue, 
                        record.TransactionCurrency
                    );
                } else {
                    formattedRecord.AverageItemValueFormatted = `${formattedRecord.AverageItemValue.toFixed(2)} ${record.TransactionCurrency || 'USD'}`;
                }
            } catch (error) {
                formattedRecord.AverageItemValueFormatted = `${formattedRecord.AverageItemValue.toFixed(2)} ${record.TransactionCurrency || 'USD'}`;
            }

            return formattedRecord;
        },

        // Sales order grouping methods (simplified)
        _groupBySalesOrder: function (rawData) {
            const groupedRecords = {};
            rawData.forEach(item => {
                const key = item.SalesDocument;
                if (!groupedRecords[key]) {
                    groupedRecords[key] = this._initializeSalesOrderGroup(item);
                } else {
                    this._mergeItemIntoSalesOrderGroup(groupedRecords[key], item);
                }
            });
            return groupedRecords;
        },

        _initializeSalesOrderGroup: function (item) {
            return {
                ...item,
                Materials: [item.Material || item.Product],
                Products: [item.Product],
                Quantities: [item.OrderQuantity || item.BillingQuantity || 0],
                TotalNetAmountSum: parseFloat(item.TotalNetAmount || item.NetValue) || 0,
                DiscountSum: parseFloat(item.Discount || 0),
                TotalQuantitySum: parseFloat(item.OrderQuantity || item.BillingQuantity || 0),
                ItemCount: 1,
                GroupingType: 'SALES_ORDER',
                GroupingTimestamp: new Date().toISOString(),
                
            };
        },

        _mergeItemIntoSalesOrderGroup: function (group, item) {
            group.Materials.push(item.Material || item.Product);
            group.Products.push(item.Product);
            group.Quantities.push(item.OrderQuantity || item.BillingQuantity || 0);
            
            group.TotalNetAmountSum += parseFloat(item.TotalNetAmount || item.NetValue) || 0;
            group.DiscountSum += parseFloat(item.Discount || 0);
            group.TotalQuantitySum += parseFloat(item.OrderQuantity || item.BillingQuantity || 0);
            
            group.ItemCount += 1;
            
            
        },

        _enrichWithSalesOrderTexts: function (aGroupedRecords) {
            // Simplified - would need actual OData service integration
            console.log("📝 Sales order text enrichment (placeholder)");
            return aGroupedRecords;
        },

        destroy: function () {
            this._controller = null;
        }
    });
});

sap.ui.define([
    "sap/ui/base/Object"
], function (Object) {
    "use strict";

    return Object.extend("aryasalesregister.services.SalesOrderTextService", {

        constructor: function (controller) {
            this.controller = controller;
            this._textCache = new Map(); // Cache for loaded text data
        },

        /**
         * Loads and maps sales order text data for the given sales records automatically
         * @param {Array} salesData - Array of sales records
         * @returns {Promise<Array>} Enhanced sales data with ZXT fields
         */
        loadAndMapSalesOrderText: async function (salesData) {
            console.log("📝 Auto-loading sales order text data for all fetched records...");

            if (!salesData || salesData.length === 0) {
                console.log("ℹ️ No sales data to process for text loading");
                return salesData;
            }

            // Get unique sales order + item combinations from ALL fetched records
            const uniqueOrders = this._getUniqueSalesOrderItems(salesData);
            console.log(`📋 Auto-processing ${uniqueOrders.length} unique sales order items from ${salesData.length} records`);

            // Show progress for large datasets
            if (uniqueOrders.length > 50) {
                console.log("⏳ Large dataset detected - text loading may take a few moments...");
            }

            // Load text data for all unique orders automatically
            const textDataMap = await this._loadTextDataForOrders(uniqueOrders);
            console.log(`📊 Text data loaded for ${textDataMap.size} sales order items`);

            // Map text data back to all sales records
            const enhancedData = this._mapTextDataToSalesRecords(salesData, textDataMap);

            // Log summary of text data loading
            const recordsWithText = enhancedData.filter(record =>
                record.ZXT1 || record.ZXT3 || record.ZXT4 || record.ZXT5 || record.ZXT6 || record.ZXT7 || record.ZXT8
            ).length;

            console.log(`✅ Auto text loading complete: ${recordsWithText}/${enhancedData.length} records have text data`);

            return enhancedData;
        },

        /**
         * Extracts unique sales order + item combinations from sales data
         * @param {Array} salesData - Sales data array
         * @returns {Array} Array of unique {SalesOrder, SalesOrderItem} objects
         */
        _getUniqueSalesOrderItems: function (salesData) {
            const uniqueMap = new Map();

            salesData.forEach(record => {
                if (record.SalesDocument && record.SalesDocumentItem) {
                    const key = `${record.SalesDocument}_${record.SalesDocumentItem}`;
                    if (!uniqueMap.has(key)) {
                        uniqueMap.set(key, {
                            SalesOrder: record.SalesDocument,
                            SalesOrderItem: record.SalesDocumentItem
                        });
                    }
                }
            });

            return Array.from(uniqueMap.values());
        },

        /**
         * Loads text data for multiple sales orders using the API with auto-retry and better error handling
         * @param {Array} orderItems - Array of {SalesOrder, SalesOrderItem} objects
         * @returns {Promise<Map>} Map of orderKey -> text data
         */
        _loadTextDataForOrders: async function (orderItems) {
            const textDataMap = new Map();
            const batchSize = 5; // Smaller batch size for more reliable API calls
            let successCount = 0;
            let failureCount = 0;

            console.log(`🔄 Auto-loading text data in batches of ${batchSize}...`);

            for (let i = 0; i < orderItems.length; i += batchSize) {
                const batch = orderItems.slice(i, i + batchSize);
                const batchNumber = Math.floor(i / batchSize) + 1;
                const totalBatches = Math.ceil(orderItems.length / batchSize);

                console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)...`);

                const batchPromises = batch.map(orderItem =>
                    this._loadTextDataForSingleOrder(orderItem.SalesOrder, orderItem.SalesOrderItem)
                );

                try {
                    const batchResults = await Promise.allSettled(batchPromises);

                    batchResults.forEach((result, index) => {
                        const orderItem = batch[index];
                        const key = `${orderItem.SalesOrder}_${orderItem.SalesOrderItem}`;

                        if (result.status === 'fulfilled') {
                            textDataMap.set(key, result.value);
                            successCount++;
                            console.log(`✅ Text loaded for ${key}`);
                        } else {
                            console.warn(`⚠️ Text load failed for ${key}:`, result.reason?.message || result.reason);
                            textDataMap.set(key, this._getEmptyTextData());
                            failureCount++;
                        }
                    });
                } catch (error) {
                    console.error(`❌ Batch ${batchNumber} failed completely:`, error);
                    // Set empty text data for entire failed batch
                    batch.forEach(orderItem => {
                        const key = `${orderItem.SalesOrder}_${orderItem.SalesOrderItem}`;
                        textDataMap.set(key, this._getEmptyTextData());
                        failureCount++;
                    });
                }

                // Longer delay between batches for API stability
                if (i + batchSize < orderItems.length) {
                    await this._delay(200);
                }
            }

            console.log(`📊 Auto text loading summary: ${successCount} success, ${failureCount} failures out of ${orderItems.length} total`);
            return textDataMap;
        },

        /**
         * Loads text data for a single sales order item using SAP Sales Order API
         * @param {string} salesOrder - Sales order number
         * @param {string} salesOrderItem - Sales order item number
         * @returns {Promise<Object>} Text data object with ZXT fields
         */
        _loadTextDataForSingleOrder: async function (salesOrder, salesOrderItem) {
            const cacheKey = `${salesOrder}_${salesOrderItem}`;

            // Check cache first
            if (this._textCache.has(cacheKey)) {
                console.log(`📋 Using cached text data for ${cacheKey}`);
                return this._textCache.get(cacheKey);
            }

            console.log(`🔄 Loading text data for Sales Order: ${salesOrder}, Item: ${salesOrderItem}`);

            return new Promise((resolve, reject) => {
                // Try to get the salesOrder model (as configured in your manifest.json)
                let salesOrderModel = this.controller.getOwnerComponent()?.getModel("salesOrder");

                // Fallback options
                if (!salesOrderModel) {
                    salesOrderModel = this.controller.getView().getModel("salesOrder");
                }

                if (!salesOrderModel) {
                    salesOrderModel = this.controller.getOwnerComponent()?.getModel("salesOrderAPI");
                }

                if (!salesOrderModel) {
                    salesOrderModel = this.controller.getOwnerComponent()?.getModel("API_SALES_ORDER_SRV");
                }

                if (!salesOrderModel) {
                    console.error(`❌ Sales Order model not found. Expected model name: 'salesOrder'`);
                    console.error(`Available models:`, Object.keys(this.controller.getOwnerComponent().oModels || {}));
                    const emptyData = this._getEmptyTextData();
                    this._textCache.set(cacheKey, emptyData);
                    resolve(emptyData);
                    return;
                }

                // Build the path for the API call
                const path = `/A_SalesOrderItem(SalesOrder='${salesOrder}',SalesOrderItem='${salesOrderItem}')/to_Text`;

                console.log(`🌐 Making API call to: ${path}`);
                console.log(`📡 Using model service URL: ${salesOrderModel.sServiceUrl || salesOrderModel.getServiceUrl?.()}`);

                const urlParameters = {
                    $select: "SalesOrder,SalesOrderItem,Language,LongTextID,LongText",
                    $filter: "Language eq 'EN'"
                };

                console.log(`📋 URL Parameters:`, urlParameters);

                salesOrderModel.read(path, {
                    urlParameters: urlParameters,
                    success: (data) => {
                        console.log(`✅ API call successful for ${cacheKey}`);
                        console.log(`📊 Received ${(data.results || []).length} text entries:`, data.results);

                        const textData = this._parseTextResponse(data.results || []);
                        this._textCache.set(cacheKey, textData);

                        console.log(`📝 Parsed text data for ${cacheKey}:`, textData);
                        resolve(textData);
                    },
                    error: (error) => {
                        console.error(`❌ API call failed for ${cacheKey}:`, error);
                        console.error(`Error details:`, {
                            status: error.statusCode,
                            statusText: error.statusText,
                            responseText: error.responseText,
                            message: error.message
                        });

                        const emptyData = this._getEmptyTextData();
                        this._textCache.set(cacheKey, emptyData);
                        resolve(emptyData); // Resolve with empty data instead of rejecting
                    }
                });
            });
        },

        /**
         * Parses the text response from SAP API into ZXT fields
         * @param {Array} textEntries - Array of text entries from API
         * @returns {Object} Parsed text data with ZXT fields
         */
        _parseTextResponse: function (textEntries) {
            const textData = this._getEmptyTextData();

            textEntries.forEach(entry => {
                const textId = entry.LongTextID;
                const textValue = entry.LongText || "";

                switch (textId) {
                    case 'ZXT1':
                        textData.ZXT1 = textValue; // Warehouse Code
                        break;
                    case 'ZXT3':
                        textData.ZXT3 = textValue; // Warehouse Location  
                        break;
                    case 'ZXT4':
                        textData.ZXT4 = textValue; // Contract ID/Trade ID
                        break;
                    case 'ZXT5':
                        textData.ZXT5 = textValue; // Service Period
                        break;
                    case 'ZXT6':
                        textData.ZXT6 = textValue; // Material Description/Warehouse Name
                        break;
                    case 'ZXT7':
                        textData.ZXT7 = textValue; // Flag/Cluster ID
                        break;
                    case 'ZXT8':
                        textData.ZXT8 = textValue; // Item Number
                        break;
                }
            });

            return textData;
        },

        /**
         * Maps loaded text data back to the original sales records
         * @param {Array} salesData - Original sales data
         * @param {Map} textDataMap - Map of text data by order key
         * @returns {Array} Enhanced sales data with ZXT fields
         */
        _mapTextDataToSalesRecords: function (salesData, textDataMap) {
            return salesData.map(record => {
                const key = `${record.SalesDocument}_${record.SalesDocumentItem}`;
                const textData = textDataMap.get(key) || this._getEmptyTextData();

                return {
                    ...record,
                    ZXT1: textData.ZXT1, // Warehouse Code
                    ZXT3: textData.ZXT3, // Warehouse Location  
                    ZXT4: textData.ZXT4, // Contract ID/Trade ID
                    ZXT5: textData.ZXT5, // Service Period
                    ZXT6: textData.ZXT6, // Material Description/Warehouse Name
                    ZXT7: textData.ZXT7, // Flag/Cluster ID
                    ZXT8: textData.ZXT8  // Item Number
                };
            });
        },

        /**
         * Returns empty text data structure
         * @returns {Object} Empty text data with all ZXT fields as empty strings
         */
        _getEmptyTextData: function () {
            return {
                ZXT1: "", // Warehouse Code
                ZXT3: "", // Warehouse Location  
                ZXT4: "", // Contract ID/Trade ID
                ZXT5: "", // Service Period
                ZXT6: "", // Material Description/Warehouse Name
                ZXT7: "", // Flag/Cluster ID
                ZXT8: ""  // Item Number
            };
        },

        /**
         * Utility method to add delay between API calls
         * @param {number} ms - Milliseconds to delay
         * @returns {Promise} Promise that resolves after delay
         */
        _delay: function (ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        /**
         * Clears the text data cache
         */
        clearCache: function () {
            this._textCache.clear();
            console.log("🗑️ Sales order text cache cleared");
        },

        /**
         * Gets cache statistics
         * @returns {Object} Cache statistics
         */
        getCacheStats: function () {
            return {
                size: this._textCache.size,
                keys: Array.from(this._textCache.keys())
            };
        }
    });
});
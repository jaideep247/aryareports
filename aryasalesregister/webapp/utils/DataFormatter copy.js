sap.ui.define([
    "sap/ui/base/Object"
], function (BaseObject) {
    "use strict";

    return BaseObject.extend("aryasalesregister.utils.DataFormatter", {
        constructor: function (oController) {
            BaseObject.call(this);
            this._controller = oController;
        },

        /**
         * Add computed fields to sales data
         */
        addComputedFields: function (salesData) {
            if (!Array.isArray(salesData) || salesData.length === 0) {
                return [];
            }

            return salesData.map((record, index) => {
                try {
                    const enhancedRecord = { ...record };
                    
                    // Add computed fields
                    enhancedRecord.SearchText = this._buildSearchText(enhancedRecord);
                    enhancedRecord.RecordId = this._generateRecordId(enhancedRecord);
                    enhancedRecord.AmountCategory = this._categorizeAmount(enhancedRecord.TotalNetAmount);
                    enhancedRecord.QuantityCategory = this._categorizeQuantity(enhancedRecord.BillingQuantity);
                    enhancedRecord.DateCategory = this._categorizeDateFromSAP(enhancedRecord.BillingDocumentDate);
                    enhancedRecord.IsRecentTransaction = this._isRecentTransaction(enhancedRecord.BillingDocumentDate);
                    enhancedRecord.DisplayDocument = this._getDisplayDocument(enhancedRecord);
                    enhancedRecord.CustomerShortName = this._getCustomerShortName(enhancedRecord);
                    enhancedRecord.MaterialShortCode = this._getMaterialShortCode(enhancedRecord);
                    enhancedRecord.QuantityFormatted = this._formatQuantity(enhancedRecord.BillingQuantity, enhancedRecord.BillingQuantityUnit);
                    enhancedRecord.AmountFormatted = this._formatAmount(enhancedRecord.TotalNetAmount, enhancedRecord.TransactionCurrency);
                    
                    // Validation
                    enhancedRecord.ValidationStatus = this._validateRecordCompleteness(enhancedRecord);
                    
                    return enhancedRecord;
                } catch (error) {
                    console.warn(`⚠️ Error processing record ${index}:`, error);
                    return record;
                }
            });
        },

        /**
         * Build searchable text from record fields
         */
        _buildSearchText: function (record) {
            const searchableFields = [
                record.BillingDocument,
                record.Material,
                record.Product,
                record.CustomerFullName_1,
                record.BusinessPartnerName1,
                record.Region,
                record.Plant,
                record.Division,
                record.ProfitCenter,
                record.SalesDocument
            ].filter(Boolean);

            return searchableFields.join(" ").toLowerCase();
        },

        /**
         * Generate unique record ID
         */
        _generateRecordId: function (record) {
            const billingDoc = record.BillingDocument || '';
            const material = record.Material || record.Product || '';
            const date = record.BillingDocumentDate || '';
            
            return `${billingDoc}_${material}_${date}`.replace(/[^a-zA-Z0-9_]/g, '');
        },

        /**
         * Categorize amount into ranges
         */
        _categorizeAmount: function (amount) {
            const numAmount = parseFloat(amount) || 0;
            
            if (numAmount === 0) return "Zero";
            if (numAmount < 1000) return "Low (< 1K)";
            if (numAmount < 10000) return "Medium (1K-10K)";
            if (numAmount < 100000) return "High (10K-100K)";
            if (numAmount < 1000000) return "Very High (100K-1M)";
            return "Extreme (1M+)";
        },

        /**
         * Categorize quantity into ranges
         */
        _categorizeQuantity: function (quantity) {
            const numQuantity = parseFloat(quantity) || 0;
            
            if (numQuantity === 0) return "Zero";
            if (numQuantity < 10) return "Low (< 10)";
            if (numQuantity < 100) return "Medium (10-100)";
            if (numQuantity < 1000) return "High (100-1K)";
            if (numQuantity < 10000) return "Very High (1K-10K)";
            return "Extreme (10K+)";
        },

        /**
         * Format SAP date
         */
        _formatSAPDate: function (sapDate) {
            if (!sapDate) return "Unknown";
            
            try {
                const dateObj = this._parseSAPDate(sapDate);
                if (!dateObj) return sapDate;
                
                return dateObj.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            } catch (error) {
                console.warn("⚠️ Date formatting error:", error);
                return sapDate;
            }
        },

        /**
         * Parse SAP date string
         */
        _parseSAPDate: function (sapDate) {
            if (!sapDate) return null;
            
            try {
                // Handle different SAP date formats
                if (typeof sapDate === 'string') {
                    // Format: "20231201" or "2023-12-01"
                    const cleanDate = sapDate.replace(/[^0-9]/g, '');
                    if (cleanDate.length === 8) {
                        const year = parseInt(cleanDate.substring(0, 4));
                        const month = parseInt(cleanDate.substring(4, 6)) - 1;
                        const day = parseInt(cleanDate.substring(6, 8));
                        return new Date(year, month, day);
                    }
                }
                
                // Try standard date parsing
                const dateObj = new Date(sapDate);
                if (!isNaN(dateObj.getTime())) {
                    return dateObj;
                }
                
                return null;
            } catch (error) {
                console.warn("⚠️ Date parsing error:", error);
                return null;
            }
        },

        /**
         * Generate short period name for filtering
         */
        _generateShortPeriodName: function (filterData) {
            if (!filterData || !filterData.dateFrom || !filterData.dateTo) {
                return "All Periods";
            }

            try {
                const fromDate = this._parseSAPDate(filterData.dateFrom);
                const toDate = this._parseSAPDate(filterData.dateTo);
                
                if (!fromDate || !toDate) {
                    return "Invalid Date Range";
                }

                const fromMonth = fromDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                const toMonth = toDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

                if (fromDate.getFullYear() === toDate.getFullYear()) {
                    if (fromDate.getMonth() === toDate.getMonth()) {
                        return fromMonth;
                    } else {
                        return `${fromMonth} - ${toMonth}`;
                    }
                } else {
                    return `${fromMonth} - ${toMonth}`;
                }
            } catch (error) {
                console.warn("⚠️ Period name generation error:", error);
                return "Period Error";
            }
        },

        /**
         * Validate record completeness
         */
        _validateRecordCompleteness: function (record) {
            const requiredFields = [
                'BillingDocument',
                'BillingDocumentDate',
                'Material',
                'TotalNetAmount',
                'TransactionCurrency'
            ];

            const missingFields = requiredFields.filter(field => !record[field]);
            
            if (missingFields.length === 0) {
                return { isValid: true, missingFields: [], score: 100 };
            } else {
                const score = Math.max(0, 100 - (missingFields.length * 20));
                return {
                    isValid: false,
                    missingFields: missingFields,
                    score: score
                };
            }
        },

        /**
         * Get display document information
         */
        _getDisplayDocument: function (record) {
            const docType = record.BillingDocumentType || 'Unknown';
            const docNumber = record.BillingDocument || 'N/A';
            const date = this._formatSAPDate(record.BillingDocumentDate);
            
            return `${docType} ${docNumber} (${date})`;
        },

        /**
         * Get customer short name
         */
        _getCustomerShortName: function (record) {
            const fullName = record.CustomerFullName_1 || record.BusinessPartnerName1 || '';
            
            if (!fullName) return 'Unknown Customer';
            
            // Extract first word or first few characters
            const words = fullName.trim().split(/\s+/);
            if (words.length > 0) {
                return words[0].length > 20 ? words[0].substring(0, 20) + '...' : words[0];
            }
            
            return fullName.length > 20 ? fullName.substring(0, 20) + '...' : fullName;
        },

        /**
         * Get material short code
         */
        _getMaterialShortCode: function (record) {
            const material = record.Material || record.Product || '';
            
            if (!material) return 'N/A';
            
            // If it's already short, return as is
            if (material.length <= 15) return material;
            
            // Try to extract meaningful part
            const parts = material.split(/[-_]/);
            if (parts.length > 1) {
                return parts.slice(0, 2).join('-');
            }
            
            // Return first 15 characters
            return material.substring(0, 15) + '...';
        },

        /**
         * Check if transaction is recent (within last 30 days)
         */
        _isRecentTransaction: function (billingDate) {
            try {
                const transactionDate = this._parseSAPDate(billingDate);
                if (!transactionDate) return false;
                
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                
                return transactionDate >= thirtyDaysAgo;
            } catch (error) {
                console.warn("⚠️ Recent transaction check error:", error);
                return false;
            }
        },

        /**
         * Categorize date from SAP
         */
        _categorizeDateFromSAP: function (billingDate) {
            try {
                const transactionDate = this._parseSAPDate(billingDate);
                if (!transactionDate) return 'Unknown';
                
                const now = new Date();
                const diffTime = Math.abs(now - transactionDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays <= 7) return 'This Week';
                if (diffDays <= 30) return 'This Month';
                if (diffDays <= 90) return 'Last 3 Months';
                if (diffDays <= 365) return 'This Year';
                return 'Older';
            } catch (error) {
                console.warn("⚠️ Date categorization error:", error);
                return 'Unknown';
            }
        },

        /**
         * Format quantity with unit
         */
        _formatQuantity: function (quantity, unit) {
            const numQuantity = parseFloat(quantity) || 0;
            const formattedQuantity = numQuantity.toLocaleString('en-IN');
            return unit ? `${formattedQuantity} ${unit}` : formattedQuantity;
        },

        /**
         * Format amount with currency
         */
        _formatAmount: function (amount, currency) {
            const numAmount = parseFloat(amount) || 0;
            const formattedAmount = numAmount.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            return currency ? `${formattedAmount} ${currency}` : formattedAmount;
        },

        /**
         * Format unique materials for display
         */
        formatUniqueMaterials: function (materials) {
            if (!Array.isArray(materials) || materials.length === 0) {
                return "No Materials";
            }

            const uniqueMaterials = [...new Set(materials)].filter(Boolean);
            
            if (uniqueMaterials.length === 1) {
                return uniqueMaterials[0];
            }
            
            if (uniqueMaterials.length <= 3) {
                return uniqueMaterials.join(" | ");
            }
            
            return `${uniqueMaterials.slice(0, 2).join(" | ")} + ${uniqueMaterials.length - 2} more`;
        },

        destroy: function () {
            this._controller = null;
        }
    });
});

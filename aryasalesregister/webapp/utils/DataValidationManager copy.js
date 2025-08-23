sap.ui.define([
    "sap/ui/base/Object"
], function (BaseObject) {
    "use strict";

    return BaseObject.extend("aryasalesregister.utils.DataValidationManager", {
        constructor: function (oController) {
            BaseObject.call(this);
            this._controller = oController;
        },

        /**
         * Validate and sanitize raw data
         */
        validateAndSanitizeData: function (rawData) {
            if (!Array.isArray(rawData) || rawData.length === 0) {
                return {
                    data: [],
                    errors: ["No data provided for validation"],
                    warnings: [],
                    summary: {
                        totalRecords: 0,
                        validRecords: 0,
                        invalidRecords: 0,
                        qualityScore: 0
                    }
                };
            }

            const validatedData = [];
            const errors = [];
            const warnings = [];
            let validCount = 0;
            let invalidCount = 0;

            rawData.forEach((record, index) => {
                try {
                    const validationResult = this._validateRecordCompleteness(record);

                    if (validationResult.isValid) {
                        validatedData.push(record);
                        validCount++;
                    } else {
                        // Try to fix common issues
                        const fixedRecord = this._attemptDataFix(record);
                        if (fixedRecord) {
                            validatedData.push(fixedRecord);
                            validCount++;
                            warnings.push(`Record ${index}: Fixed data issues`);
                        } else {
                            invalidCount++;
                            errors.push(`Record ${index}: ${validationResult.missingFields.join(', ')} missing`);
                        }
                    }
                } catch (error) {
                    invalidCount++;
                    errors.push(`Record ${index}: Validation error - ${error.message}`);
                }
            });

            const qualityScore = validCount > 0 ? Math.round((validCount / rawData.length) * 100) : 0;

            return {
                data: validatedData,
                errors: errors,
                warnings: warnings,
                summary: {
                    totalRecords: rawData.length,
                    validRecords: validCount,
                    invalidRecords: invalidCount,
                    qualityScore: qualityScore
                }
            };
        },

        /**
         * Assess data quality and provide insights
         */
        assessDataQuality: function (processedData) {
            if (!Array.isArray(processedData) || processedData.length === 0) {
                return {
                    overallScore: 0,
                    completeness: 0,
                    consistency: 0,
                    accuracy: 0,
                    recommendations: ["No data available for quality assessment"]
                };
            }

            const completeness = this._assessCompleteness(processedData);
            const consistency = this._assessConsistency(processedData);
            const accuracy = this._assessAccuracy(processedData);

            const overallScore = Math.round((completeness + consistency + accuracy) / 3);

            const recommendations = this._generateRecommendations(completeness, consistency, accuracy);

            return {
                overallScore: overallScore,
                completeness: completeness,
                consistency: consistency,
                accuracy: accuracy,
                recommendations: recommendations,
                recordCount: processedData.length
            };
        },

        /**
         * Validate individual record completeness
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
         * Attempt to fix common data issues
         */
        _attemptDataFix: function (record) {
            const fixedRecord = { ...record };
            let wasFixed = false;

            // Fix missing material with product
            if (!fixedRecord.Material && fixedRecord.Product) {
                fixedRecord.Material = fixedRecord.Product;
                wasFixed = true;
            }

            // Fix missing product with material
            if (!fixedRecord.Product && fixedRecord.Material) {
                fixedRecord.Product = fixedRecord.Material;
                wasFixed = true;
            }

            // Fix missing currency with default
            if (!fixedRecord.TransactionCurrency) {
                fixedRecord.TransactionCurrency = 'USD';
                wasFixed = true;
            }

            // Fix missing quantities
            if (!fixedRecord.BillingQuantity && fixedRecord.OrderQuantity) {
                fixedRecord.BillingQuantity = fixedRecord.OrderQuantity;
                wasFixed = true;
            }

            // Fix missing amounts
            if (!fixedRecord.TotalNetAmount && fixedRecord.NetValue) {
                fixedRecord.TotalNetAmount = fixedRecord.NetValue;
                wasFixed = true;
            }

            // Only return fixed record if it now passes validation
            const validationResult = this._validateRecordCompleteness(fixedRecord);
            return validationResult.isValid ? fixedRecord : null;
        },

        /**
         * Assess data completeness
         */
        _assessCompleteness: function (data) {
            const requiredFields = [
                'BillingDocument',
                'BillingDocumentDate',
                'Material',
                'TotalNetAmount',
                'TransactionCurrency'
            ];

            let totalFields = 0;
            let filledFields = 0;

            data.forEach(record => {
                requiredFields.forEach(field => {
                    totalFields++;
                    if (record[field]) {
                        filledFields++;
                    }
                });
            });

            return totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
        },

        /**
         * Assess data consistency
         */
        _assessConsistency: function (data) {
            if (data.length < 2) return 100;

            let consistencyScore = 0;
            const checks = 0;

            // Check currency consistency
            const currencies = [...new Set(data.map(r => r.TransactionCurrency).filter(Boolean))];
            if (currencies.length === 1) {
                consistencyScore += 25;
            }

            // Check date format consistency
            const dateFormats = data.map(r => r.BillingDocumentDate).filter(Boolean);
            if (dateFormats.length > 0) {
                const firstFormat = typeof dateFormats[0];
                const consistentFormats = dateFormats.filter(d => typeof d === firstFormat).length;
                consistencyScore += Math.round((consistentFormats / dateFormats.length) * 25);
            }

            // Check numeric field consistency
            const numericFields = ['TotalNetAmount', 'BillingQuantity'];
            numericFields.forEach(field => {
                const values = data.map(r => r[field]).filter(v => !isNaN(parseFloat(v)));
                if (values.length > 0) {
                    const allNumeric = values.every(v => !isNaN(parseFloat(v)));
                    if (allNumeric) consistencyScore += 25;
                }
            });

            return Math.min(100, consistencyScore);
        },

        /**
         * Assess data accuracy
         */
        _assessAccuracy: function (data) {
            if (data.length === 0) return 0;

            let accuracyScore = 0;
            let validRecords = 0;

            data.forEach(record => {
                let recordScore = 0;

                // Check for reasonable values
                if (record.TotalNetAmount && parseFloat(record.TotalNetAmount) >= 0) {
                    recordScore += 25;
                }
                if (record.BillingQuantity && parseFloat(record.BillingQuantity) >= 0) {
                    recordScore += 25;
                }
                if (record.BillingDocument && record.BillingDocument.length > 0) {
                    recordScore += 25;
                }
                if (record.Material && record.Material.length > 0) {
                    recordScore += 25;
                }

                accuracyScore += recordScore;
                if (recordScore === 100) validRecords++;
            });

            return Math.round(accuracyScore / data.length);
        },

        /**
         * Generate improvement recommendations
         */
        _generateRecommendations: function (completeness, consistency, accuracy) {
            const recommendations = [];

            if (completeness < 80) {
                recommendations.push("Improve data completeness by ensuring required fields are populated");
            }
            if (consistency < 80) {
                recommendations.push("Standardize data formats for better consistency");
            }
            if (accuracy < 80) {
                recommendations.push("Validate data values for accuracy and reasonableness");
            }
            if (completeness >= 90 && consistency >= 90 && accuracy >= 90) {
                recommendations.push("Data quality is excellent! Consider adding advanced analytics");
            }

            return recommendations;
        },

        destroy: function () {
            this._controller = null;
        }
    });
});

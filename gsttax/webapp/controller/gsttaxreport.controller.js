sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/export/Spreadsheet",
    "sap/ui/model/Sorter"
], function (
    Controller,
    JSONModel,
    MessageToast,
    MessageBox,
    Filter,
    FilterOperator,
    Spreadsheet,
    Sorter
) {
    "use strict";

    return Controller.extend("gsttax.controller.gsttaxreport", {
        _oRowDetailsDialog: null,
        // --- Lifecycle Methods ---
        /**
         * Initializes the controller. Sets up the models and performs configuration validation.
         */
        onInit: function () {
            console.log("🚀 GST Tax Report Controller initializing...");
            this._initializeModels();
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
        },

        // --- Model Management & Initialization ---
        /**
         * Initializes the JSON models used by the view.
         * - `mergedData`: Stores the main report data, including results, counts, and load time.
         * - `filterData`: Holds the values from the filter bar.
         * - `loadingState`: Manages the state of data loading and progress indicators.
         * - `pagination`: Tracks pagination state like skip, page size, and if more data exists.
         */
        _initializeModels: function () {
            var mergedDataModel = new JSONModel({
                results: [],
                count: 0,
                totalCount: 0,
                originalRecordCount: 0,
                lastLoadTime: null
            });
            this.getView().setModel(mergedDataModel, "mergedData");

            var filterDataModel = new JSONModel({
                companyCode: "",
                fiscalYear: (new Date).getFullYear().toString(),
                fromDate: null,
                toDate: null,
                accountingDocumentRange: {
                    from: "",
                    to: ""
                },
                pagingTop: 500,
                enableBatchLoading: true,
                groupByEnabled: true
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
        },

        /**
         * Validates that the necessary OData models (`EO` and `gstTaxModel`) are configured correctly.
         * It checks for models at the view and component levels and logs any issues.
         */
        _validateConfiguration: function () {
            console.group("🔧 Validating Configuration");
            var eoModel = this.getView().getModel();
            if (!eoModel) {
                console.error("❌ EO Model not found in view, checking component...");
                var ownerComponent = this.getOwnerComponent();
                eoModel = ownerComponent?.getModel();
                if (eoModel) {
                    this.getView().setModel(eoModel);
                    console.log("✅ EO Model found in component and set to view");
                } else {
                    console.error("❌ EO Model not found anywhere - check manifest.json");
                }
            }
            if (eoModel) {
                var eoServiceUrl = eoModel.sServiceUrl || eoModel.getServiceUrl();
                console.log("✅ EO Model configured:", eoServiceUrl);
                eoModel.getMetaModel().loaded().then(() => {
                    console.log("✅ EO Metadata loaded successfully");
                }).catch(error => {
                    console.error("❌ EO Metadata failed:", error);
                });
            }

            var gstTaxModel = this.getView().getModel("gstTaxModel");
            if (!gstTaxModel) {
                console.warn("⚠️ GST Model not found in view, checking component...");
                var ownerComponent = this.getOwnerComponent();
                gstTaxModel = ownerComponent?.getModel("gstTaxModel");
                if (gstTaxModel) {
                    this.getView().setModel(gstTaxModel, "gstTaxModel");
                    console.log("✅ GST Model found in component and set to view");
                } else {
                    console.warn("⚠️ GST Model not found - will proceed without GST data");
                }
            }
            if (gstTaxModel) {
                var gstServiceUrl = gstTaxModel.sServiceUrl || gstTaxModel.getServiceUrl();
                console.log("✅ GST Model configured:", gstServiceUrl);
                gstTaxModel.getMetaModel().loaded().then(() => {
                    console.log("✅ GST Metadata loaded successfully");
                }).catch(error => {
                    console.warn("⚠️ GST Metadata failed:", error);
                });
            }
            console.groupEnd();
        },

        // --- Data Loading & Processing ---
        /**
         * The main method for loading data. It orchestrates the process of loading EO documents,
         * fetching corresponding GST data, and merging the two datasets.
         * @param {boolean} isLoadMore - Flag to indicate if this is an additional load (for pagination).
         * @param {number} skip - The number of records to skip for pagination.
         */
        _loadData: function (isLoadMore, skip) {
            console.group("📊 Starting Enhanced Data Load");
            var eoModel = this.getView().getModel();
            if (!eoModel) {
                MessageBox.error("EO Data service is not configured. Please check your manifest.json file.");
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
                this.getView().getModel("mergedData").setData({
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
            this._loadEODataWithFilters(currentSkip, pageSize)
                .then(eoResult => this._processEOResult(eoResult, isLoadMore))
                .catch(error => this._handleLoadError(error))
                .finally(() => {
                    console.groupEnd();
                });
        },

        /**
         * Loads the main EO documents with the specified filters and pagination.
         * @param {number} skip - Number of records to skip.
         * @param {number} top - Number of records to retrieve.
         * @returns {Promise<Object[]>} A promise that resolves with the EO data results.
         */
        _loadEODataWithFilters: function (skip, top) {
            return new Promise((resolve, reject) => {
                this._setLoading(true, "Loading EO documents...", 1, 3);
                var eoModel = this.getView().getModel();
                var filters = this._buildEOFilters();
                var urlParameters = this._buildEOUrlParameters(skip, top);
                var path = "/YY1_EO_ODATA_API";

                eoModel.read(path, {
                    filters: filters,
                    urlParameters: urlParameters,
                    success: data => {
                        var results = data.results || [];
                        results.totalCount = data.__count;
                        results.hasNext = !!data.__next;
                        resolve(results);
                    },
                    error: error => {
                        var errorMessage = this._buildErrorMessage("EO Data", error);
                        reject(new Error(errorMessage));
                    }
                });
            });
        },
        /**
         * Builds a user-friendly error message from error object
         * @param {string} context - Context of the error (e.g., "EO Data")
         * @param {Object} error - Error object
         * @returns {string} Formatted error message
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
         * Processes the loaded EO data. If data is found, it extracts document keys
         * and loads the corresponding GST data.
         * @param {Object[]} eoResult - The EO data results.
         * @param {boolean} isLoadMore - Whether this is an additional load.
         * @returns {Promise<void>}
         */
        _processEOResult: function (eoResult, isLoadMore) {
            if (eoResult.length === 0) {
                this._finishDataLoad([], [], isLoadMore, 0);
                return Promise.resolve();
            }

            var documentKeys = this._extractDocumentKeys(eoResult);
            this._setLoading(true, `Loading GST data for ${documentKeys.length} documents...`, 2, 3);
            return this._loadGSTDataForDocuments(documentKeys)
                .then(gstResult => {
                    this._finishDataLoad(eoResult, gstResult, isLoadMore, eoResult.totalCount);
                });
        },

        /**
         * Extracts unique document keys (Company Code, Accounting Document, Fiscal Year)
         * from the EO data.
         * @param {Object[]} eoData - The EO data.
         * @returns {Object[]} An array of unique document key objects.
         */
        _extractDocumentKeys: function (eoData) {
            var keys = [];
            var seenKeys = new Set();
            eoData.forEach(item => {
                if (!item.CompanyCode || !item.AccountingDocument || !item.FiscalYear) return;
                var key = `${item.CompanyCode}_${item.AccountingDocument}_${item.FiscalYear}`;
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    keys.push({
                        CompanyCode: item.CompanyCode,
                        AccountingDocument: item.AccountingDocument,
                        FiscalYear: item.FiscalYear
                    });
                }
            });
            return keys;
        },

        /**
         * Loads GST tax data for a given set of document keys.
         * @param {Object[]} documentKeys - The document keys to search for.
         * @returns {Promise<Object[]>} A promise that resolves with the GST data.
         */
        _loadGSTDataForDocuments: function (documentKeys) {
            return new Promise((resolve, reject) => {
                var gstModel = this.getView().getModel("gstTaxModel");
                if (!gstModel) {
                    // If GST model is not found, resolve with an empty array and proceed.
                    resolve([]);
                    return;
                }

                var filters = this._buildGSTFiltersForDocuments(documentKeys);
                var urlParameters = this._buildGSTUrlParameters();
                var path = "/YY1_GSTTAXAMOUNT_API";

                gstModel.read(path, {
                    filters: filters,
                    urlParameters: urlParameters,
                    success: data => {
                        resolve(data.results || []);
                    },
                    error: error => {
                        console.warn("⚠️ GST Data loading failed, proceeding without GST data:", error);
                        // Resolve with an empty array to allow the process to continue even if GST data fails.
                        resolve([]);
                    }
                });
            });
        },

        // --- Filter & URL Parameter Builders ---
        /**
         * Builds the OData filter array for the EO service based on the filter bar data.
         * @returns {sap.ui.model.Filter[]} An array of filters.
         */
        _buildEOFilters: function () {
            var filters = [];
            var filterData = this.getView().getModel("filterData").getData();

            // Standard filters
            if (filterData.companyCode && filterData.companyCode.trim()) {
                filters.push(new Filter("CompanyCode", FilterOperator.EQ, filterData.companyCode.trim()));
            }
            if (filterData.fiscalYear && filterData.fiscalYear.trim()) {
                filters.push(new Filter("FiscalYear", FilterOperator.EQ, filterData.fiscalYear.trim()));
            }
            if (filterData.fromDate) {
                filters.push(new Filter("PostingDate", FilterOperator.GE, filterData.fromDate));
            }
            if (filterData.toDate) {
                filters.push(new Filter("PostingDate", FilterOperator.LE, filterData.toDate));
            }

            // Enhanced document range handling
            if (filterData.accountingDocumentRange) {
                var docFilters = this._buildDocumentRangeFilters(filterData.accountingDocumentRange);
                if (docFilters.length > 0) {
                    filters.push(...docFilters);
                }
            }

            // If no document range is specified, only show records with a TaxableAmount
            if (!filterData.accountingDocumentRange?.from && !filterData.accountingDocumentRange?.to) {
                filters.push(new Filter("TaxableAmount", FilterOperator.NE, "0"));
            }

            console.log("🔍 Built EO filters:", filters);
            return filters;
        },
        /**
         * Creates filter for exact document search with multiple format support
         * @param {string} docNumber - Document number to search
         * @returns {Filter} Filter for exact document match
         */
        _createExactDocumentFilter: function (docNumber) {
            var exactSearchFilters = [];

            // The OData service defines AccountingDocument as an Edm.String with MaxLength of 10.
            // To handle various user inputs (e.g., "1" or "0000000001"), we need to ensure the filter
            // sends the value in a format the backend expects.

            // Always add the zero-padded 10-digit version
            var paddedDoc10 = docNumber.padStart(10, "0");
            exactSearchFilters.push(new Filter("AccountingDocument", FilterOperator.EQ, paddedDoc10));

            // Also include the original value if it's different, as the backend might accept it
            if (paddedDoc10 !== docNumber) {
                exactSearchFilters.push(new Filter("AccountingDocument", FilterOperator.EQ, docNumber));
            }

            // Combine all filters with an OR operator to handle different formats
            return new Filter({ filters: exactSearchFilters, and: false });
        },
        /**
         * Builds document range filters with enhanced logic
         * @param {Object} docRange - Document range object with from/to properties
         * @returns {Array} Array of filters for document range
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
                    // For exact match, use the more robust _createExactDocumentFilter
                    filters.push(this._createExactDocumentFilter(fromDoc));
                } else {
                    // For range, pad both numbers to ensure correct lexicographical comparison
                    filters.push(
                        new Filter("AccountingDocument", FilterOperator.GE, fromDoc.padStart(10, "0"))
                    );
                    filters.push(
                        new Filter("AccountingDocument", FilterOperator.LE, toDoc.padStart(10, "0"))
                    );
                }
            } else if (fromDoc) {
                // From document only
                filters.push(
                    new Filter("AccountingDocument", FilterOperator.GE, fromDoc.padStart(10, "0"))
                );
            } else if (toDoc) {
                // To document only
                filters.push(
                    new Filter("AccountingDocument", FilterOperator.LE, toDoc.padStart(10, "0"))
                );
            }
            return filters;
        },
        /**
         * Creates filters for document range search
         * @param {string} fromDoc - Start document number
         * @param {string} toDoc - End document number
         * @returns {Array} Array of filters for range
         */
        _createRangeDocumentFilters: function (fromDoc, toDoc) {
            var filters = [];

            // Determine the best format to use for range comparison
            var fromPadded = this._normalizeDocumentNumber(fromDoc);
            var toPadded = this._normalizeDocumentNumber(toDoc);

            console.log("📋 Document range - From:", fromDoc, "->", fromPadded, "To:", toDoc, "->", toPadded);

            filters.push(new Filter("AccountingDocument", FilterOperator.GE, fromPadded));
            filters.push(new Filter("AccountingDocument", FilterOperator.LE, toPadded));

            return filters;
        },

        /**
         * Creates filter for documents from specified number onwards
         * @param {string} fromDoc - Start document number
         * @returns {Filter} Filter for from document
         */
        _createFromDocumentFilter: function (fromDoc) {
            var normalizedDoc = this._normalizeDocumentNumber(fromDoc);
            console.log("📋 From document filter:", fromDoc, "->", normalizedDoc);
            return new Filter("AccountingDocument", FilterOperator.GE, normalizedDoc);
        },

        /**
         * Creates filter for documents up to specified number
         * @param {string} toDoc - End document number
         * @returns {Filter} Filter for to document
         */
        _createToDocumentFilter: function (toDoc) {
            var normalizedDoc = this._normalizeDocumentNumber(toDoc);
            console.log("📋 To document filter:", toDoc, "->", normalizedDoc);
            return new Filter("AccountingDocument", FilterOperator.LE, normalizedDoc);
        },

        /**
         * Normalizes document number for consistent comparison
         * @param {string} docNumber - Document number to normalize
         * @returns {string} Normalized document number
         */
        _normalizeDocumentNumber: function (docNumber) {
            if (!docNumber) return "";

            // For range operations, use 10-digit padding as standard
            return docNumber.padStart(10, "0");
        },

        /**
         * Enhanced validation for document range
         * @param {Object} filterData - Filter data to validate
         * @returns {Array} Array of validation errors
         */
        _validateFilterData: function (filterData) {
            var errors = [];

            // START OF MODIFIED LOGIC
            if (!filterData.companyCode || !filterData.companyCode.trim()) {
                errors.push("Company Code is mandatory.");
            }
            if (!filterData.fiscalYear || !filterData.fiscalYear.trim()) {
                errors.push("Fiscal Year is mandatory.");
            }
            // END OF MODIFIED LOGIC

            if (filterData.companyCode && !/^\d{4}$/.test(filterData.companyCode)) {
                errors.push("Company Code must be 4 digits");
            }
            if (filterData.fiscalYear && !/^\d{4}$/.test(filterData.fiscalYear)) {
                errors.push("Fiscal Year must be 4 digits");
            }
            if (filterData.fromDate && filterData.toDate) {
                if (new Date(filterData.fromDate) > new Date(filterData.toDate)) {
                    errors.push("From Date cannot be later than To Date");
                }
            }

            // Enhanced document range validation
            if (filterData.accountingDocumentRange) {
                var docErrors = this._validateDocumentRange(filterData.accountingDocumentRange);
                errors.push(...docErrors);
            }

            return errors;
        },

        /**
         * Validates document range inputs
         * @param {Object} docRange - Document range object
         * @returns {Array} Array of validation errors
         */
        _validateDocumentRange: function (docRange) {
            var errors = [];
            var fromDoc = docRange.from ? docRange.from.trim() : "";
            var toDoc = docRange.to ? docRange.to.trim() : "";

            // START OF FIX: Enhanced validation to ensure numeric input
            if (fromDoc && !/^\d+$/.test(fromDoc)) {
                errors.push("From Document must be a numeric value.");
            }
            if (toDoc && !/^\d+$/.test(toDoc)) {
                errors.push("To Document must be a numeric value.");
            }
            // END OF FIX

            if (fromDoc && toDoc) {
                var fromNum = parseInt(fromDoc);
                var toNum = parseInt(toDoc);

                if (fromNum > toNum) {
                    errors.push("From Document cannot be greater than To Document.");
                }

                if (toNum - fromNum > 10000) {
                    errors.push("Document range is very large (>10,000). Consider using smaller ranges for better performance.");
                }
            }

            if (fromDoc && (fromDoc.length > 12 || fromDoc.length < 1)) {
                errors.push("From Document should be 1-12 digits.");
            }
            if (toDoc && (toDoc.length > 12 || toDoc.length < 1)) {
                errors.push("To Document should be 1-12 digits.");
            }

            return errors;
        },


        /**
         * Quick filter helper for single document
         * @param {string} documentNumber - Single document to search
         */
        onQuickFilterSingleDocument: function (documentNumber) {
            if (!documentNumber) {
                MessageBox.error("Please provide a document number");
                return;
            }

            this.getView().getModel("filterData").setProperty("/accountingDocumentRange", {
                from: documentNumber,
                to: documentNumber
            });

            MessageToast.show(`Filter set for document: ${documentNumber}`);
        },

        /**
         * Quick filter helper for document range
         * @param {string} fromDoc - Start document
         * @param {string} toDoc - End document
         */
        onQuickFilterDocumentRange: function (fromDoc, toDoc) {
            if (!fromDoc && !toDoc) {
                MessageBox.error("Please provide at least one document number");
                return;
            }

            this.getView().getModel("filterData").setProperty("/accountingDocumentRange", {
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
         * Clear document range filter
         */
        onClearDocumentRange: function () {
            this.getView().getModel("filterData").setProperty("/accountingDocumentRange", {
                from: "",
                to: ""
            });
            MessageToast.show("Document range filter cleared");
        },

        /**
         * Enhanced document search dialog with better UX
         */
        onSearchDocumentRange: function () {
            if (!this._oDocumentRangeDialog) {
                this._oDocumentRangeDialog = new sap.m.Dialog({
                    title: "Set Document Range",
                    type: "Message",
                    content: [
                        new sap.m.VBox({
                            items: [
                                new sap.m.Label({ text: "From Document Number:" }),
                                new sap.m.Input({
                                    id: "rangeFromDocument",
                                    placeholder: "e.g., 1000000001 or 1",
                                    maxLength: 12,
                                    width: "300px",
                                    type: "Number"
                                }).addStyleClass("sapUiSmallMarginTop"),

                                new sap.m.Label({ text: "To Document Number:" }).addStyleClass("sapUiMediumMarginTop"),
                                new sap.m.Input({
                                    id: "rangeToDocument",
                                    placeholder: "e.g., 1000000100 or 100",
                                    maxLength: 12,
                                    width: "300px",
                                    type: "Number"
                                }).addStyleClass("sapUiSmallMarginTop"),

                                new sap.m.FormattedText({
                                    htmlText: "<p><strong>Tips:</strong></p>" +
                                        "<ul>" +
                                        "<li>Leave 'To' empty to search from a document onwards</li>" +
                                        "<li>Leave 'From' empty to search up to a document</li>" +
                                        "<li>Use same number in both fields for exact match</li>" +
                                        "<li>System handles different number formats automatically</li>" +
                                        "</ul>"
                                }).addStyleClass("sapUiMediumMarginTop")
                            ]
                        }).addStyleClass("sapUiMediumMargin")
                    ],
                    buttons: [
                        new sap.m.Button({
                            text: "Apply Range",
                            type: "Emphasized",
                            press: this._applyDocumentRange.bind(this)
                        }),
                        new sap.m.Button({
                            text: "Clear Range",
                            press: this._clearDialogRange.bind(this)
                        }),
                        new sap.m.Button({
                            text: "Cancel",
                            press: () => this._oDocumentRangeDialog.close()
                        })
                    ]
                });
                this.getView().addDependent(this._oDocumentRangeDialog);
            }

            // Pre-fill current values
            var currentRange = this.getView().getModel("filterData").getProperty("/accountingDocumentRange");
            if (currentRange) {
                sap.ui.getCore().byId("rangeFromDocument").setValue(currentRange.from || "");
                sap.ui.getCore().byId("rangeToDocument").setValue(currentRange.to || "");
            }

            this._oDocumentRangeDialog.open();
        },

        /**
         * Apply document range from dialog
         */
        _applyDocumentRange: function () {
            var fromDoc = sap.ui.getCore().byId("rangeFromDocument").getValue().trim();
            var toDoc = sap.ui.getCore().byId("rangeToDocument").getValue().trim();

            // Validate input
            var errors = this._validateDocumentRange({ from: fromDoc, to: toDoc });
            if (errors.length > 0) {
                MessageBox.error("Validation errors:\n" + errors.join("\n"));
                return;
            }

            if (!fromDoc && !toDoc) {
                MessageBox.error("Please enter at least one document number");
                return;
            }

            // Apply the range
            this.onQuickFilterDocumentRange(fromDoc, toDoc);
            this._oDocumentRangeDialog.close();
        },

        /**
         * Clear range in dialog
         */
        _clearDialogRange: function () {
            sap.ui.getCore().byId("rangeFromDocument").setValue("");
            sap.ui.getCore().byId("rangeToDocument").setValue("");
            this.onClearDocumentRange();
        },
        /**
         * Builds the OData filter array for the GST service based on document keys.
         * This handles both single document searches and multi-document searches (batch loading).
         * @param {Object[]} documentKeys - The list of document keys.
         * @returns {sap.ui.model.Filter[]} An array of filters.
         */
        _buildGSTFiltersForDocuments: function (documentKeys) {
            var filters = [];
            if (documentKeys.length === 0) return filters;

            if (documentKeys.length === 1) {
                // For a single document, use AND filters
                var key = documentKeys[0];
                filters.push(new Filter("CompanyCode", FilterOperator.EQ, key.CompanyCode));
                filters.push(new Filter("AccountingDocument", FilterOperator.EQ, key.AccountingDocument));
                filters.push(new Filter("FiscalYear", FilterOperator.EQ, key.FiscalYear));
            } else {
                // For multiple documents, build a large OR filter of ANDed key combinations
                var orFilters = documentKeys.map(key => new Filter({
                    filters: [
                        new Filter("CompanyCode", FilterOperator.EQ, key.CompanyCode),
                        new Filter("AccountingDocument", FilterOperator.EQ, key.AccountingDocument),
                        new Filter("FiscalYear", FilterOperator.EQ, key.FiscalYear)
                    ],
                    and: true
                }));
                // OData URLs have a character limit, so we cap the number of filters
                if (orFilters.length > 100) {
                    console.warn("⚠️ Too many documents for single GST query. Capping at 100.");
                    orFilters = orFilters.slice(0, 100);
                }
                filters.push(new Filter({
                    filters: orFilters,
                    and: false
                }));
            }
            return filters;
        },

        /**
         * Creates OData URL parameters for the EO service, including select fields, pagination, and sorting.
         * @param {number} skip - The number of records to skip.
         * @param {number} top - The number of records to retrieve.
         * @returns {Object} A key-value map of URL parameters.
         */
        _buildEOUrlParameters: function (skip, top) {
            var params = {
                $select: this._getEOSelectFields(),
                $top: top || 500,
                $orderby: "CompanyCode asc,FiscalYear desc,PostingDate desc,AccountingDocument asc",
                $inlinecount: "allpages"
            };
            if (skip > 0) {
                params["$skip"] = skip;
            }
            return params;
        },

        /**
         * Creates OData URL parameters for the GST service.
         * @returns {Object} A key-value map of URL parameters.
         */
        _buildGSTUrlParameters: function () {
            return {
                $select: this._getGSTSelectFields(),
                $top: 5000,
                $orderby: "CompanyCode asc,AccountingDocument asc,FiscalYear asc,TaxItem asc",
                $inlinecount: "allpages"
            };
        },

        /**
         * Returns a comma-separated string of fields to select from the EO service.
         * @returns {string} The list of selected fields.
         */
        _getEOSelectFields: function () {
            return "ID,CompanyCode,AccountingDocument,Ledger,FiscalYear,LedgerGLLineItem," +
                "PostingDate,DocumentDate,TransactionCurrency,Customer,CustomerName," +
                "AccountingDocumentTypeName_1,AccountingDocumentType_1,IsReversal," +
                "ReversalReferenceDocument,Region,BusinessPlace,BPTaxNumber," +
                "IN_GSTPlaceOfSupply,TaxableAmount,CompanyCodeCurrency," +
                "TransactionTypeDetermination,AccountingDocumentTypeName";
        },

        /**
         * Returns a comma-separated string of fields to select from the GST service.
         * @returns {string} The list of selected fields.
         */
        _getGSTSelectFields: function () {
            return "CompanyCode,AccountingDocument,FiscalYear,TaxItem,TaxItemUUID," +
                "TaxCode,TaxBaseAmountInTransCrcy,TaxAmountInTransCrcy," +
                "TransactionTypeDetermination,TransactionCurrency";
        },

        // --- Data Merging & Finalization ---
        /**
         * Merges EO and GST data WITHOUT calculating tax totals at line item level
         * @param {Object[]} eoData - The EO data (multiple line items per document)
         * @param {Object[]} gstData - The GST data (tax items per document)
         * @returns {Object[]} An array of merged data objects
         */
        _mergeEOAndGSTData: function (eoData, gstData) {
            console.log("🔄 Merging EO and GST data...");
            console.log("📊 EO Records:", eoData.length);
            console.log("💰 GST Records:", gstData.length);

            // First, group GST data by document (not by line item)
            var gstDataByDoc = {};
            gstData.forEach(gstItem => {
                var key = `${gstItem.CompanyCode}_${gstItem.AccountingDocument}_${gstItem.FiscalYear}`;
                if (!gstDataByDoc[key]) {
                    gstDataByDoc[key] = [];
                }
                gstDataByDoc[key].push(gstItem);
            });

            console.log("🗂️ GST Data grouped by documents:", Object.keys(gstDataByDoc).length);

            // Process each EO line item - do NOT calculate tax amounts here
            var mergedData = eoData.map(eoItem => {
                var key = `${eoItem.CompanyCode}_${eoItem.AccountingDocument}_${eoItem.FiscalYear}`;
                var relatedGstItems = gstDataByDoc[key] || [];

                var taxableAmount = Math.abs(parseFloat(eoItem.TaxableAmount || 0));

                console.log(`📋 Processing EO Line: ${eoItem.AccountingDocument}-${eoItem.LedgerGLLineItem}, Taxable: ${taxableAmount}`);

                return {
                    ...eoItem,
                    TaxableAmount: taxableAmount,

                    // 🎯 KEY CHANGE: Store GST items as reference only, don't calculate here
                    _hasGstData: relatedGstItems.length > 0,
                    _documentKey: key,

                    // Store basic info for UI display
                    TaxCodes: [...new Set(relatedGstItems.map(item => item.TaxCode).filter(Boolean))],
                    HasGSTData: relatedGstItems.length > 0,
                    DocumentStatus: this._determineDocumentStatus(eoItem),
                    ComplianceStatus: this._determineComplianceStatus(eoItem, relatedGstItems)
                };
            });

            return mergedData;
        },
        /**
         * Groups merged data by document and calculates tax amounts ONCE per document
         * @param {Object[]} mergedData - Array of merged EO line items with GST references
         * @returns {Object[]} Array of document-level summaries
         */
        _groupDataByDocument: function (mergedData, gstData) {
            console.log("📊 Grouping data by document with corrected tax calculation...");

            // First, create a clean GST lookup by document
            var gstDataByDoc = {};
            gstData.forEach(gstItem => {
                var key = `${gstItem.CompanyCode}_${gstItem.AccountingDocument}_${gstItem.FiscalYear}`;
                if (!gstDataByDoc[key]) {
                    gstDataByDoc[key] = [];
                }
                gstDataByDoc[key].push(gstItem);
            });

            var groupedData = {};

            // Group all line items by document
            mergedData.forEach(item => {
                var docKey = `${item.CompanyCode}-${item.FiscalYear}-${item.AccountingDocument}`;

                if (!groupedData[docKey]) {
                    // Initialize document group
                    groupedData[docKey] = {
                        // Document identifiers
                        CompanyCode: item.CompanyCode,
                        FiscalYear: item.FiscalYear,
                        AccountingDocument: item.AccountingDocument,

                        // Document properties (take from first line item)
                        AccountingDocumentType_1: item.AccountingDocumentType_1,
                        AccountingDocumentTypeName_1: item.AccountingDocumentTypeName_1,
                        IsReversal: item.IsReversal,
                        ReversalReferenceDocument: item.ReversalReferenceDocument,
                        BusinessPlace: item.BusinessPlace,
                        Customer: item.Customer,
                        CustomerName: item.CustomerName,
                        BPTaxNumber: item.BPTaxNumber,
                        IN_GSTPlaceOfSupply: item.IN_GSTPlaceOfSupply,
                        Region: item.Region,
                        TransactionCurrency: item.TransactionCurrency,
                        PostingDate: item.PostingDate,
                        DocumentDate: item.DocumentDate,

                        // Accumulated values
                        TaxableAmount: 0,
                        RecordCount: 0,
                        TaxCodes: new Set(),
                        HasGSTData: false,

                        // Initialize tax amounts to zero - will calculate once
                        TotalTaxAmount: 0,
                        TotalTaxBaseAmount: 0,
                        TaxItemCount: 0,
                        GrandTotal: 0,

                        // Track if we've calculated taxes for this document
                        _taxCalculated: false,
                        _documentKey: item._documentKey
                    };
                }

                var group = groupedData[docKey];

                // Accumulate EO line item values
                group.TaxableAmount += item.TaxableAmount;
                group.RecordCount += 1;
                group.HasGSTData = group.HasGSTData || item.HasGSTData;

                // Collect tax codes
                item.TaxCodes.forEach(taxCode => group.TaxCodes.add(taxCode));

                // 🎯 CRITICAL: Calculate GST amounts ONLY ONCE per document
                if (!group._taxCalculated && item._hasGstData) {
                    var documentGstItems = gstDataByDoc[item._documentKey] || [];

                    // Calculate tax amounts from actual GST data
                    group.TotalTaxAmount = documentGstItems.reduce((sum, gstItem) => {
                        var taxAmount = Math.abs(parseFloat(gstItem.TaxAmountInTransCrcy || 0));
                        return sum + taxAmount;
                    }, 0);

                    group.TotalTaxBaseAmount = documentGstItems.reduce((sum, gstItem) => {
                        var baseAmount = Math.abs(parseFloat(gstItem.TaxBaseAmountInTransCrcy || 0));
                        return sum + baseAmount;
                    }, 0);

                    group.TaxItemCount = documentGstItems.length;
                    group._taxCalculated = true; // Mark as calculated

                    console.log(`💰 Document ${group.AccountingDocument} Tax Calculation (ONCE):`);
                    console.log(`   🏷️ GST Items: ${group.TaxItemCount}`);
                    console.log(`   💸 Total Tax: ${group.TotalTaxAmount}`);
                    console.log(`   📊 Tax Base: ${group.TotalTaxBaseAmount}`);
                }

                console.log(`📝 Document ${item.AccountingDocument}: Line ${item.LedgerGLLineItem}, Running EO Total: ${group.TaxableAmount}`);
            });

            // Final calculation and cleanup
            Object.values(groupedData).forEach(group => {
                // Calculate grand total (EO taxable amount + GST tax amount)
                group.GrandTotal = group.TaxableAmount + group.TotalTaxAmount;

                console.log(`🎯 Document ${group.AccountingDocument} FINAL TOTALS:`);
                console.log(`   📋 EO Line Items: ${group.RecordCount}`);
                console.log(`   💵 EO Taxable Amount: ${group.TaxableAmount}`);
                console.log(`   💸 GST Tax Amount: ${group.TotalTaxAmount}`);
                console.log(`   📊 GST Base Amount: ${group.TotalTaxBaseAmount}`);
                console.log(`   🎯 Grand Total: ${group.GrandTotal}`);

                // Clean up temporary fields
                delete group._taxCalculated;
                delete group._documentKey;
            });

            // Convert to array and finalize
            var groupedArray = Object.values(groupedData).map(group => ({
                ...group,
                TaxCodes: Array.from(group.TaxCodes),
                TaxableAmount: Math.round(group.TaxableAmount * 100) / 100,
                TotalTaxAmount: Math.round(group.TotalTaxAmount * 100) / 100,
                TotalTaxBaseAmount: Math.round(group.TotalTaxBaseAmount * 100) / 100,
                GrandTotal: Math.round(group.GrandTotal * 100) / 100
            }));

            // Sort for consistent display
            groupedArray.sort((a, b) => {
                if (a.CompanyCode !== b.CompanyCode) return a.CompanyCode.localeCompare(b.CompanyCode);
                if (a.FiscalYear !== b.FiscalYear) return b.FiscalYear.localeCompare(a.FiscalYear);
                return a.AccountingDocument.localeCompare(b.AccountingDocument);
            });

            console.log(`✅ Grouped ${mergedData.length} line items into ${groupedArray.length} document summaries with corrected tax calculations`);
            return groupedArray;
        },


        /**
         * Updates the `mergedData` and `pagination` models with the new data, triggering a table refresh.
         * @param {Object[]} finalData - The final array of data to display.
         * @param {number} loadedRecords - The number of records loaded in the last request.
         * @param {number} totalCount - The total count of records available on the backend.
         */
        _updateModelsWithData: function (finalData, loadedRecords, totalCount) {
            var mergedDataModel = this.getView().getModel("mergedData");
            mergedDataModel.setData({
                results: finalData,
                count: finalData.length,
                totalCount: totalCount,
                originalRecordCount: loadedRecords,
                lastLoadTime: (new Date).toISOString()
            });
            mergedDataModel.refresh(true);

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

        /**
         * Finalizes the data load process by merging data, updating models, and showing a message toast.
         * @param {Object[]} eoResult - The EO data results.
         * @param {Object[]} gstResult - The GST data results.
         * @param {boolean} isLoadMore - Flag for pagination.
         * @param {number} totalCount - The total number of records available.
         */
        _finishDataLoad: function (eoResult, gstResult, isLoadMore, totalCount) {
            this._setLoading(true, "Merging and processing data...", 3, 3);

            // 🎯 KEY CHANGE: Pass GST data to grouping method
            var mergedItems = this._mergeEOAndGSTData(eoResult, gstResult);
            var groupedSummaries = this._groupDataByDocument(mergedItems, gstResult); // Pass GST data here

            // Get existing data if loading more, otherwise start fresh
            var existingData = this.getView().getModel("mergedData").getProperty("/results") || [];
            var finalData = isLoadMore ? existingData.concat(groupedSummaries) : groupedSummaries;

            // Update models
            var originalRecordCount = isLoadMore ?
                this.getView().getModel("pagination").getProperty("/loadedRecords") + eoResult.length :
                eoResult.length;

            this._updateModelsWithData(finalData, originalRecordCount, totalCount);

            this._setLoading(false);
            var message = isLoadMore ?
                `Loaded ${eoResult.length} additional records, grouped into ${groupedSummaries.length} summaries` :
                `Successfully loaded ${eoResult.length} records, grouped into ${groupedSummaries.length} document summaries`;
            MessageToast.show(message);
        },
        // ===================  GING METHOD ===================
        // Add this method to help debug calculation issues:

        /**
         * Debugs the calculation for a specific document.
         * @param {string} documentNumber - The document number to debug.
         */
        debugDocumentCalculation: function (documentNumber) {
            console.group(`🔬 Debug Calculation for Document: ${documentNumber}`);

            var data = this.getView().getModel("mergedData").getData();
            var document = data.results.find(doc => doc.AccountingDocument === documentNumber);

            if (!document) {
                console.log("❌ Document not found in current results");
                console.groupEnd();
                return;
            }

            console.log("📊 Document Summary:", {
                accountingDocument: document.AccountingDocument,
                companyCode: document.CompanyCode,
                fiscalYear: document.FiscalYear,
                recordCount: document.RecordCount,
                taxableAmount: document.TaxableAmount,
                totalTaxAmount: document.TotalTaxAmount,
                totalTaxBaseAmount: document.TotalTaxBaseAmount,
                grandTotal: document.GrandTotal,
                taxItemCount: document.TaxItemCount,
                hasGSTData: document.HasGSTData
            });

            console.groupEnd();
        },
        // --- Event Handlers ---

        /**
         * Handles the "View Details" button press to open the row details fragment.
         * @param {sap.ui.base.Event} oEvent The button press event.
         */
        onViewRowDetails: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("mergedData");
            if (!oContext) {
                MessageBox.error("Could not retrieve row data.");
                return;
            }

            // Check if the dialog instance already exists.
            if (!this._oRowDetailsDialog) {
                // If not, load the fragment asynchronously.
                // The dialog control is only available inside the 'then' block.
                sap.ui.core.Fragment.load({
                    name: "gsttax.view.fragments.RowDetails",
                    controller: this
                }).then(function (oDialog) {
                    // Assign the loaded dialog control to the controller property.
                    this._oRowDetailsDialog = oDialog;
                    this.getView().addDependent(this._oRowDetailsDialog);

                    // Now that the dialog is loaded and ready, open it.
                    this._openRowDetailsDialog(oContext);
                }.bind(this));
            } else {
                // If the dialog already exists, just open it with the new context.
                this._openRowDetailsDialog(oContext);
            }
        },

        /**
         * A private helper method to open the dialog and set the context.
         * This method is called once the dialog is guaranteed to be ready.
         * @param {sap.ui.model.Context} oContext The binding context of the selected row.
         */
        _openRowDetailsDialog: function (oContext) {
            // This is the correct place to call setBindingContext, after the dialog object has been created.
            this._oRowDetailsDialog.setBindingContext(oContext, "mergedData");
            this._oRowDetailsDialog.open();
        },

        /**
         * Handles the close button press in the row details fragment.
         */
        onCloseDetailsDialog: function () {
            if (this._oRowDetailsDialog) {
                this._oRowDetailsDialog.close();
            }
        },
        /**
         * Handles the "Load Data" button press. Confirms if no filters are set to prevent large data loads.
         */
        onLoadData: function () {
            var filterData = this.getView().getModel("filterData").getData();

            // START OF NEW MANDATORY CHECK
            if (!filterData.companyCode || !filterData.fiscalYear) {
                MessageBox.error("Company Code and Fiscal Year are mandatory for data selection. Please enter these values.");
                return; // Stop the function
            }
            // END OF NEW MANDATORY CHECK

            if (!filterData.fromDate && !filterData.toDate && !filterData.accountingDocumentRange?.from) {
                MessageBox.confirm("Only Company Code and Fiscal Year are specified. This may load a large amount of data. Continue?", {
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
         * Clears all filters in the filter bar and the loaded table data.
         */
        onClearFilters: function () {
            this.getView().getModel("filterData").setData({
                companyCode: "",
                fiscalYear: (new Date).getFullYear().toString(),
                fromDate: null,
                toDate: null,
                accountingDocumentRange: {
                    from: "",
                    to: ""
                },
                pagingTop: 500,
                enableBatchLoading: true,
                groupByEnabled: true
            });
            this.getView().getModel("mergedData").setData({
                results: [],
                count: 0,
                totalCount: 0,
                originalRecordCount: 0
            });
            MessageToast.show("Filters cleared");
        },

        /**
         * Handles the "Test Connection" button press to verify service connectivity.
         */
        onTestConnection: function () {
            console.group("🔬 Testing Data Service Connection");
            var eoModel = this.getView().getModel();
            if (!eoModel) {
                MessageBox.error("EO Model not found");
                console.groupEnd();
                return;
            }

            var filters = [new Filter("TaxableAmount", FilterOperator.NE, "0")];
            var urlParameters = {
                $select: "CompanyCode,AccountingDocument,FiscalYear,TaxableAmount",
                $top: 5,
                $orderby: "CompanyCode asc,AccountingDocument asc"
            };

            this._setLoading(true, "Testing connection...");
            eoModel.read("/YY1_EO_ODATA_API", {
                filters: filters,
                urlParameters: urlParameters,
                success: data => {
                    this._setLoading(false);
                    var results = data.results || [];
                    console.log("✅ Connection test successful. Sample data:", results);
                    if (results.length > 0) {
                        var sampleDoc = results[0];
                        var successMessage = `Connection successful!\n\nSample document found:\n` +
                            `Company: ${sampleDoc.CompanyCode}\n` +
                            `Document: ${sampleDoc.AccountingDocument}\n` +
                            `Fiscal Year: ${sampleDoc.FiscalYear}\n` +
                            `Amount: ${sampleDoc.TaxableAmount}`;
                        MessageBox.success(successMessage);
                    } else {
                        MessageBox.information("Connection successful but no data returned with current filters");
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
         * Handles the "Load More" button press to load the next page of data.
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
         * Handles the "Load All" button press, confirming with the user before loading all remaining data.
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
         * Sets the pagingTop to load all remaining records and triggers a data load.
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
         * Consolidated quick filter method for different time periods
         * @param {string} period - "currentMonth", "currentQuarter", "currentYear", "lastMonth"
         */
        onQuickFilterTimePeriod: function (period) {
            var today = new Date();
            var firstDay, lastDay, fiscalYear;

            switch (period) {
                case "currentMonth":
                    firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                    lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    fiscalYear = today.getFullYear();
                    break;

                case "currentQuarter":
                    var quarter = Math.floor(today.getMonth() / 3);
                    firstDay = new Date(today.getFullYear(), quarter * 3, 1);
                    lastDay = new Date(today.getFullYear(), (quarter + 1) * 3, 0);
                    fiscalYear = today.getFullYear();
                    break;

                case "currentYear":
                    firstDay = new Date(today.getFullYear(), 0, 1);
                    lastDay = new Date(today.getFullYear(), 11, 31);
                    fiscalYear = today.getFullYear();
                    break;

                case "lastMonth":
                    firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
                    fiscalYear = firstDay.getFullYear();
                    break;

                default:
                    MessageToast.show("Invalid time period specified");
                    return;
            }

            this.getView().getModel("filterData").setData({
                companyCode: "",
                fiscalYear: fiscalYear.toString(),
                fromDate: firstDay,
                toDate: lastDay,
                accountingDocumentRange: { from: "", to: "" },
                pagingTop: 500,
                enableBatchLoading: true,
                groupByEnabled: true
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
         * Opens the "Search Exact Document" dialog.
         */
        onSearchExactDocument: function () {
            if (!this._oDocumentSearchDialog) {
                this._oDocumentSearchDialog = new sap.m.Dialog({
                    title: "Search Exact Document",
                    type: "Message",
                    content: [
                        new sap.m.VBox({
                            items: [
                                new sap.m.Label({ text: "Company Code:" }),
                                new sap.m.Input({ id: "exactSearchCompanyCode", placeholder: "e.g., 1000", maxLength: 4, width: "200px" }).addStyleClass("sapUiSmallMarginTop"),
                                new sap.m.Label({ text: "Accounting Document:" }).addStyleClass("sapUiMediumMarginTop"),
                                new sap.m.Input({ id: "exactSearchDocument", placeholder: "e.g., 1800000018", maxLength: 12, width: "200px" }).addStyleClass("sapUiSmallMarginTop"),
                                new sap.m.Label({ text: "Fiscal Year:" }).addStyleClass("sapUiMediumMarginTop"),
                                new sap.m.Input({ id: "exactSearchFiscalYear", placeholder: "e.g., 2024", maxLength: 4, width: "200px", value: (new Date).getFullYear().toString() }).addStyleClass("sapUiSmallMarginTop"),
                                new sap.m.Text({ text: "Enter at least Document Number for exact search" }).addStyleClass("sapUiMediumMarginTop")
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
         * Performs the exact document search using the dialog inputs.
         * Sets filters and triggers a data load.
         */
        _performExactDocumentSearch: function () {
            var companyCode = sap.ui.getCore().byId("exactSearchCompanyCode").getValue().trim();
            var documentNumber = sap.ui.getCore().byId("exactSearchDocument").getValue().trim();
            var fiscalYear = sap.ui.getCore().byId("exactSearchFiscalYear").getValue().trim();

            if (!documentNumber) {
                MessageBox.error("Please enter the Document Number");
                return;
            }

            // Clear existing data and set the new filters
            this.getView().getModel("mergedData").setData({
                results: [],
                count: 0,
                totalCount: 0,
                originalRecordCount: 0
            });
            this.getView().getModel("filterData").setData({
                companyCode: companyCode || "",
                fiscalYear: fiscalYear || "",
                fromDate: null,
                toDate: null,
                accountingDocumentRange: {
                    from: documentNumber,
                    to: documentNumber
                },
                pagingTop: 100, // Small page size is fine for single document search
                enableBatchLoading: false,
                groupByEnabled: true
            });

            this._oDocumentSearchDialog.close();
            console.log("🔍 Starting exact document search for:", documentNumber);
            MessageToast.show(`Searching for document: ${documentNumber}`);
            this._loadData(false, 0);
        },

        /**
         * Handles the search event on the table, filtering the results based on the query.
         * @param {sap.ui.base.Event} event The search event.
         */
        onTableSearch: function (event) {
            var query = event.getParameter("query") || event.getParameter("newValue");
            var table = this.byId("gstTaxTable");
            var binding = table.getBinding("rows");

            if (binding) {
                var filters = [];
                if (query && query.length > 0) {
                    var searchFields = [
                        "CompanyCode", "AccountingDocument", "FiscalYear", "Customer", "CustomerName",
                        "BPTaxNumber", "IN_GSTPlaceOfSupply", "Region",
                        // NEW SEARCHABLE FIELDS with correct names:
                        "LedgerGLLineItem", "AccountingDocumentType_1", "AccountingDocumentTypeName_1",
                        "ReversalReferenceDocument", "BusinessPlace"
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

        onFilterByDocumentType: function (sDocumentType) {
            if (!sDocumentType) {
                MessageToast.show("Please specify a document type");
                return;
            }

            var oTable = this.byId("gstTaxTable");
            var oBinding = oTable.getBinding("rows");

            if (oBinding) {
                var aFilters = [
                    new Filter("AccountingDocumentType_1", FilterOperator.EQ, sDocumentType)
                ];
                oBinding.filter(aFilters);
                MessageToast.show(`Filtered by Document Type: ${sDocumentType}`);
            }
        },

        onFilterByGLLineItem: function (sLineItem) {
            if (!sLineItem) {
                MessageToast.show("Please specify a GL Line Item");
                return;
            }

            var oTable = this.byId("gstTaxTable");
            var oBinding = oTable.getBinding("rows");

            if (oBinding) {
                var aFilters = [
                    new Filter("LedgerGLLineItem", FilterOperator.EQ, sLineItem.padStart(6, '0'))
                ];
                oBinding.filter(aFilters);
                MessageToast.show(`Filtered by GL Line Item: ${sLineItem}`);
            }
        },

        onFilterReversalDocuments: function () {
            var oTable = this.byId("gstTaxTable");
            var oBinding = oTable.getBinding("rows");

            if (oBinding) {
                var aFilters = [
                    new Filter("IsReversal", FilterOperator.EQ, true)
                ];
                oBinding.filter(aFilters);
                MessageToast.show("Showing only reversal documents");
            }
        },

        onFilterNormalDocuments: function () {
            var oTable = this.byId("gstTaxTable");
            var oBinding = oTable.getBinding("rows");

            if (oBinding) {
                var aFilters = [
                    new Filter("IsReversal", FilterOperator.EQ, false)
                ];
                oBinding.filter(aFilters);
                MessageToast.show("Showing only normal (non-reversal) documents");
            }
        },

        onFilterByBusinessPlace: function (sBusinessPlace) {
            if (!sBusinessPlace) {
                MessageToast.show("Please specify a business place");
                return;
            }

            var oTable = this.byId("gstTaxTable");
            var oBinding = oTable.getBinding("rows");

            if (oBinding) {
                var aFilters = [
                    new Filter("BusinessPlace", FilterOperator.EQ, sBusinessPlace)
                ];
                oBinding.filter(aFilters);
                MessageToast.show(`Filtered by Business Place: ${sBusinessPlace}`);
            }
        },

        /**
         * Handles the "Toggle Column" button press to hide or show a column in the table.
         * @param {sap.ui.base.Event} event The button press event.
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
         * Handles the "Quick Sort" button press to sort the table by a specific property.
         * @param {sap.ui.base.Event} event The button press event.
         */
        onQuickSort: function (event) {
            var button = event.getSource();
            var property = button.data("property");
            var descending = button.data("descending") === "true";
            var table = this.byId("gstTaxTable");
            var binding = table.getBinding("rows");
            if (binding) {
                var sorter = new Sorter(property, descending);
                binding.sort(sorter);
                var sortDirection = descending ? "descending" : "ascending";
                MessageToast.show(`Table sorted by ${property} (${sortDirection})`);
            }
        },

        // --- Export Functionality ---
        /**
         * Handles the "Export to Excel" button press, exporting all loaded data.
         */
        onExportToExcel: function () {
            var data = this.getView().getModel("mergedData").getData();
            if (!data.results || data.results.length === 0) {
                MessageBox.warning("No data available to export. Please load data first.");
                return;
            }

            try {
                var columns = this._createExportColumns();
                var fileName = `GST_Tax_Report_${(new Date).toISOString().split("T")[0]}.xlsx`;
                var exportSettings = {
                    workbook: {
                        columns: columns
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
         * Creates complete column definitions for detailed export
         * @returns {Object[]} An array of all available column objects
         */
        _createCompleteExportColumns: function () {
            return [
                // Basic Document Info
                { label: "Company Code", property: "CompanyCode", type: "string" },
                { label: "Fiscal Year", property: "FiscalYear", type: "string" },
                { label: "Accounting Document", property: "AccountingDocument", type: "string" },
                { label: "Document Type", property: "AccountingDocumentType_1", type: "string" },
                { label: "Document Type Name", property: "AccountingDocumentTypeName_1", type: "string" },

                // Dates
                { label: "Posting Date", property: "PostingDate", type: "date" },
                { label: "Document Date", property: "DocumentDate", type: "date" },

                // Customer Info
                { label: "Customer", property: "Customer", type: "string" },
                { label: "Customer Name", property: "CustomerName", type: "string" },

                // Location & Business Info
                { label: "Business Place", property: "BusinessPlace", type: "string" },
                { label: "Region", property: "Region", type: "string" },
                { label: "GST Number", property: "BPTaxNumber", type: "string" },
                { label: "Place of Supply", property: "IN_GSTPlaceOfSupply", type: "string" },

                // Financial Data
                { label: "Taxable Amount", property: "TaxableAmount", type: "number" },
                { label: "Tax Amount", property: "TotalTaxAmount", type: "number" },
                { label: "Grand Total", property: "GrandTotal", type: "number" },
                { label: "Currency", property: "TransactionCurrency", type: "string" },

                // Tax Details
                { label: "Tax Codes", property: "TaxCodes", type: "string" },

                // Document Status
                { label: "Is Reversal", property: "IsReversal", type: "boolean" },
                { label: "Reversal Reference Document", property: "ReversalReferenceDocument", type: "string" },
                { label: "Document Status", property: "DocumentStatus", type: "string" },
                { label: "Compliance Status", property: "ComplianceStatus", type: "string" },

            ];
        },

        /**
         * Handles the "Export Current View" button press, exporting only the currently filtered and visible data.
         */

        onExportCurrentView: function () {
            var table = this.byId("gstTaxTable");
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
                var columns = this._createCompleteExportColumns();
                var fileName = `GST_Tax_Report_CurrentView_Complete_${new Date().toISOString().split("T")[0]}.xlsx`;
                var exportSettings = {
                    workbook: {
                        columns: columns,
                        context: {
                            title: "GST Tax Report - Current View (Complete Data)",
                            sheetName: "Current View Data"
                        }
                    },
                    dataSource: data,
                    fileName: fileName
                };
                var spreadsheet = new Spreadsheet(exportSettings);
                spreadsheet.build()
                    .then(() => {
                        MessageToast.show(`Exported ${data.length} records from current view with all ${columns.length} columns`);
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
         * @returns {Object[]} An array of column objects.
         */
        _createExportColumns: function () {
            return [{
                label: "Company Code",
                property: "CompanyCode",
                type: "string"
            }, {
                label: "Fiscal Year",
                property: "FiscalYear",
                type: "string"
            }, {
                label: "Accounting Document",
                property: "AccountingDocument",
                type: "string"
            }, {
                label: "Customer",
                property: "Customer",
                type: "string"
            }, {
                label: "Customer Name",
                property: "CustomerName",
                type: "string"
            }, {
                label: "Record Count",
                property: "RecordCount",
                type: "number"
            }, {
                label: "Taxable Amount",
                property: "TaxableAmount",
                type: "number"
            }, {
                label: "Tax Amount",
                property: "TotalTaxAmount",
                type: "number"
            }, {
                label: "Tax Base Amount",
                property: "TotalTaxBaseAmount",
                type: "number"
            }, {
                label: "Grand Total",
                property: "GrandTotal",
                type: "number"
            }, {
                label: "Currency",
                property: "TransactionCurrency",
                type: "string"
            }, {
                label: "GST Number",
                property: "BPTaxNumber",
                type: "string"
            }, {
                label: "Place of Supply",
                property: "IN_GSTPlaceOfSupply",
                type: "string"
            }, {
                label: "Region",
                property: "Region",
                type: "string"
            }, {
                label: "Posting Date",
                property: "PostingDate",
                type: "date"
            },
            // NEW EXPORT COLUMNS with correct field names:
            {
                label: "GL Line Item",
                property: "LedgerGLLineItem",
                type: "string"
            }, {
                label: "Document Type",
                property: "AccountingDocumentType_1",
                type: "string"
            }, {
                label: "Document Type Name",
                property: "AccountingDocumentTypeName_1",
                type: "string"
            }, {
                label: "Document Date",
                property: "DocumentDate",
                type: "date"
            }, {
                label: "Reversal Reference Document",
                property: "ReversalReferenceDocument",
                type: "string"
            }, {
                label: "Is Reversal",
                property: "IsReversal",
                type: "boolean"
            }, {
                label: "Business Place",
                property: "BusinessPlace",
                type: "string"
            }];
        },

        // --- Summary and Status Helpers ---
        /**
         * Handles the "Show Summary" button press, displaying key report totals and metrics.
         */
        onShowSummary: function () {
            var data = this.getView().getModel("mergedData").getData();
            if (!data.results || data.results.length === 0) {
                MessageBox.warning("No data available for summary.");
                return;
            }

            var documentGroups = data.results.length;
            var originalRecords = data.originalRecordCount || 0;
            var totalTaxableAmount = data.results.reduce((sum, item) => sum + (item.TaxableAmount || 0), 0);
            var totalTaxAmount = data.results.reduce((sum, item) => sum + (item.TotalTaxAmount || 0), 0);
            var grandTotal = data.results.reduce((sum, item) => sum + (item.GrandTotal || 0), 0);
            var groupsWithGstData = data.results.filter(item => item.HasGSTData).length;

            var uniqueCompanyCodes = new Set(data.results.map(item => item.CompanyCode)).size;
            var uniqueFiscalYears = new Set(data.results.map(item => item.FiscalYear)).size;

            // NEW STATISTICS for the new fields:
            var uniqueDocumentTypes = new Set(data.results.map(item => item.AccountingDocumentType_1).filter(Boolean)).size;
            var reversalDocuments = data.results.filter(item => item.IsReversal === true).length;
            var normalDocuments = documentGroups - reversalDocuments;
            var uniqueBusinessPlaces = new Set(data.results.map(item => item.BusinessPlace).filter(Boolean)).size;
            var documentsWithReversalRef = data.results.filter(item => item.ReversalReferenceDocument && item.ReversalReferenceDocument.trim()).length;

            var summaryText = `GST TAX REPORT SUMMARY\n\n` +
                `📊 OVERVIEW:\n` +
                `• Document Groups: ${documentGroups}\n` +
                `• Original Records: ${originalRecords}\n` +
                `• Groups with GST Data: ${groupsWithGstData}\n` +
                `• Normal Documents: ${normalDocuments}\n` +
                `• Reversal Documents: ${reversalDocuments}\n` +
                `• Documents with Reversal Reference: ${documentsWithReversalRef}\n\n` +

                `💰 FINANCIAL TOTALS:\n` +
                `• Total Taxable Amount: ${this.formatNumber(totalTaxableAmount.toString())}\n` +
                `• Total Tax Amount: ${this.formatNumber(totalTaxAmount.toString())}\n` +
                `• Grand Total: ${this.formatNumber(grandTotal.toString())}\n\n` +

                `🏢 BREAKDOWN:\n` +
                `• Unique Company Codes: ${uniqueCompanyCodes}\n` +
                `• Unique Fiscal Years: ${uniqueFiscalYears}\n` +
                `• Unique Document Types: ${uniqueDocumentTypes}\n` +
                `• Unique Business Places: ${uniqueBusinessPlaces}\n` +
                `• Last Load Time: ${data.lastLoadTime ? (new Date(data.lastLoadTime)).toLocaleString() : "Never"}`;

            MessageBox.information(summaryText, {
                title: "GST Tax Report Summary",
                styleClass: "sapUiSizeCompact"
            });
        },


        /**
         * Sets the loading state of the app, including progress and current operation.
         * @param {boolean} isLoading - Whether the app is in a loading state.
         * @param {string} operation - The current operation being performed.
         * @param {number} currentStep - The current step in a multi-step process.
         * @param {number} totalSteps - The total number of steps.
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

        // --- Validation, Error Handling, & Formatting ---

        /**
         * Handles data loading errors, providing user-friendly messages.
         * @param {Object} error - The error object.
         */
        _handleLoadError: function (error) {
            console.error("❌ Data load error:", error);
            this._setLoading(false);
            if (this._isConnectivityError(error)) {
                this._showConnectivityHelp(error);
            } else {
                MessageBox.error(`Data loading failed: ${error.message}\n\nCheck browser console for details.`);
            }
        },

        /**
         * Checks if an error is likely due to a connectivity issue.
         * @param {Object} error - The error object.
         * @returns {boolean} True if it's a connectivity error, otherwise false.
         */
        _isConnectivityError: function (error) {
            var message = (error.message || error.toString()).toLowerCase();
            return message.includes("failed to fetch") || message.includes("cors") || message.includes("network") || error.statusCode === 0;
        },

        /**
         * Shows a detailed error message and help for connectivity issues.
         * @param {Object} error - The error object.
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
         * Determines the document status (e.g., Active, Reversed).
         * @param {Object} item The document data.
         * @returns {string} The document status.
         */
        _determineDocumentStatus: function (item) {
            if (item.IsReversal === true) return "Reversed";
            if (item.ReversalReferenceDocument) return "Has Reversal";
            return "Active";
        },

        /**
         * Determines the compliance status based on missing data.
         * @param {Object} eoItem The EO document data.
         * @param {Object[]} gstItems The associated GST data.
         * @returns {string} The compliance status.
         */
        _determineComplianceStatus: function (eoItem, gstItems) {
            var issues = [];
            if (!eoItem.BPTaxNumber) issues.push("Missing GST Number");
            if (!eoItem.IN_GSTPlaceOfSupply) issues.push("Missing Place of Supply");
            if (gstItems.length === 0 && parseFloat(eoItem.TaxableAmount || 0) > 0) {
                issues.push("No GST Data");
            }
            return issues.length === 0 ? "Compliant" : issues.join(", ");
        },

        /**
         * Formats a number with Indian locale and two decimal places.
         * @param {string|number} value The number to format.
         * @returns {string} The formatted number.
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
        formatGLLineItem: function (sLineItem) {
            if (!sLineItem) return "";
            return `Line ${sLineItem}`;
        },

        formatDocumentTypeInfo: function (sType, sTypeName) {
            if (!sType && !sTypeName) return "";
            if (sType && sTypeName) return `${sType} - ${sTypeName}`;
            return sType || sTypeName || "";
        },

        formatReversalStatus: function (bIsReversal) {
            return bIsReversal === true ? "Yes" : "No";
        },

        formatBusinessPlace: function (sBusinessPlace) {
            return sBusinessPlace || "Not Specified";
        },

        // Enhanced boolean formatter:
        formatBoolean: function (bValue) {
            return bValue === true ? "Yes" : "No";
        },

        /**
         * Formats a number simply to two decimal places.
         * @param {string|number} value The number to format.
         * @returns {number} The formatted number.
         */
        formatCurrencySimple: function (value) {
            if (!value && value !== 0) return 0;
            var parsedValue = Math.abs(parseFloat(value));
            if (isNaN(parsedValue)) return 0;
            return Math.round(parsedValue * 100) / 100;
        },

        /**
         * Formats a date object or string into a locale-specific date string.
         * @param {Date|string} date The date to format.
         * @returns {string} The formatted date string.
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
         * Consolidated formatter for different data types
         * @param {any} value - Value to format
         * @param {string} type - Format type: "number", "currency", "boolean", "date"
         * @param {Object} options - Additional formatting options
         * @returns {string} Formatted value
         */
        formatValue: function (value, type, options = {}) {
            if (!value && value !== 0 && value !== false) return options.defaultValue || "";

            switch (type) {
                case "number":
                case "currency":
                    var parsedValue = Math.abs(parseFloat(value));
                    if (isNaN(parsedValue)) return "0.00";
                    return new Intl.NumberFormat("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }).format(parsedValue);

                case "boolean":
                    return value === true ? "Yes" : "No";

                case "date":
                    if (typeof value === "string" && value.includes("/Date(")) {
                        var timestamp = parseInt(value.match(/\d+/)[0]);
                        return new Date(timestamp).toLocaleDateString();
                    }
                    return new Date(value).toLocaleDateString();

                case "glLineItem":
                    return value ? `Line ${value}` : "";

                case "documentType":
                    var type = options.type || "";
                    var typeName = options.typeName || "";
                    if (type && typeName) return `${type} - ${typeName}`;
                    return type || typeName || "";

                case "businessPlace":
                    return value || "Not Specified";

                default:
                    return value.toString();
            }
        }
    });
});
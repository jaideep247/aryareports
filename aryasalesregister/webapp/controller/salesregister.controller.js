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
    Controller, JSONModel, MessageToast, MessageBox,
    Filter, FilterOperator, Spreadsheet, Sorter, Fragment
) {
    "use strict";

    // Define the page size for fetching data in batches
    const PAGE_SIZE = 50000;

    return Controller.extend("aryasalesregister.controller.salesregister", {

        // ========================================
        // CONSTANTS
        // ========================================
        _CONSTANTS: {
            SERVICE_URLS: {
                SALES_REGISTER: "/YY1_SALESREGISTER",
                SALES_ORDER: "/A_SalesOrder"
            },
            CONDITION_TYPES: {
                BASE_PRICE: "PPR0",
                DISCOUNT: "DRV1",
                ADDITIONAL_CHARGES: "ZDV2",
                IGST: "JOIG",
                CGST: "JOCG",
                SGST: "JOSG",
                TCS: "ZTCS",
                DELAY_CHARGES: "ZDV4"
            },
            CUSTOMER_TYPES: {
                B2B: "B2B",
                B2C: "B2C"
            },
            ALL_COLUMNS: [
                "actionsCol", "invoiceMonthCol", "aryaDTRCol", "sapInvoiceCol", "contractIdCol",
                "customerInfoCol", "customerStateCol", "shipToCol", "customerGSTINCol",
                "paymentTermsCol", "salesOrderCol", "dueDateCol", "plantCol", "invoiceTypeCol",
                "taxCodeCol", "customerNumberCol", "headOfficeCol", "custGroup1Col", "custGroup2Col",
                "custGroup3Col", "custGroup4Col", "custGroup5Col", "customerTypeCol", "invoiceMonthCol",
                "salesDivisionCol", "productInfoCol", "glCodeCol", "hsnCol", "materialCodeCol",
                "materialDescCol", "panCol", "tanCol", "financialsCol", "discountCol", "addChargesCol",
                "igstCol", "cgstCol", "sgstCol", "invoiceAmountCol", "profitCenterCol", "warehouseCodeCol",
                "warehouseNameCol", "warehouseStateCol", "warehouseLocationCol", "clusterIdCol",
                "parentInvoiceCol", "parentInvoiceDateCol", "docStatusCol", "quantityCol", "ratePerMTCol",
                "delayChargesCol", "ewayBillCol", "ewayBillDateCol", "tcsCol"
            ],
            DEFAULT_COLUMNS: [
                "actionsCol", "invoiceMonthCol", "sapInvoiceCol", "contractIdCol", "customerInfoCol",
                "customerStateCol","customerTypeCol", "salesOrderCol", "productInfoCol", "quantityCol",
                "financialsCol", "invoiceAmountCol", "docStatusCol"
            ]
        },

        // ========================================
        // LIFECYCLE METHODS
        // ========================================
        onInit: function () {
            console.log("🚀 Sales Register Controller initializing...");

            this._initializeModels();
            this._validateConfiguration();
            this._loadColumnSettings();
            this._initializeServices();

            // Safely attach resize listener for table height
            if (window.addEventListener) {
                window.addEventListener('resize', this._fixTableScrollBars.bind(this));
            } else {
                console.warn("Window event listener unavailable.");
            }
            console.log("✅ Controller initialized successfully");
        },

        onExit: function () {
            [this._oDetailDialog, this._oRowDetailsDialog].forEach(dialog => {
                if (dialog) dialog.destroy();
            });
            if (window.removeEventListener) {
                window.removeEventListener('resize', this._fixTableScrollBars.bind(this));
            }
        },

        onAfterRendering: function () {
            this._fixTableScrollBars();
            this._setupFixedColumns();
        },

        /**
         * ✅ NEW: Setup fixed/frozen columns for proper scroll sync
         */
        _setupFixedColumns: function () {
            const table = this.byId("salesTable");
            if (table && table.setFixedColumnCount) {
                // Freeze first 3 columns (Actions, Invoice Month, SAP Invoice)
                table.setFixedColumnCount(3);
                console.log("✅ Fixed columns configured for scroll sync");
            }
        },

        // ========================================
        // QUICK FILTER METHODS
        // ========================================
        onQuickFilterCurrentMonth: function () {
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

            this._applyQuickFilter(firstDay, lastDay);
            MessageToast.show("Filter set to current month");
            this.onLoadData();
        },

        onQuickFilterCurrentQuarter: function () {
            const today = new Date();
            const quarter = Math.floor(today.getMonth() / 3);
            const firstDay = new Date(today.getFullYear(), quarter * 3, 1);
            const lastDay = new Date(today.getFullYear(), (quarter + 1) * 3, 0);

            this._applyQuickFilter(firstDay, lastDay);
            MessageToast.show("Filter set to current quarter");
            this.onLoadData();
        },

        onQuickFilterCurrentYear: function () {
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), 0, 1);
            const lastDay = new Date(today.getFullYear(), 11, 31);

            this._applyQuickFilter(firstDay, lastDay);
            MessageToast.show("Filter set to current year");
            this.onLoadData();
        },

        onQuickFilterLastMonth: function () {
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);

            this._applyQuickFilter(firstDay, lastDay);
            MessageToast.show("Filter set to last month");
            this.onLoadData();
        },

        _applyQuickFilter: function (fromDate, toDate) {
            const filterModel = this.getView().getModel("filterData");
            filterModel.setProperty("/fromDate", fromDate);
            filterModel.setProperty("/toDate", toDate);
            filterModel.setProperty("/billingDocument", "");
            filterModel.setProperty("/salesOrder", "");
            filterModel.setProperty("/billingDocumentType", "");
        },

        onClearFilters: function () {
            console.log("🧹 Clearing all filters...");
            const filterModel = this.getView().getModel("filterData");
            filterModel.setData({
                billingDocument: "", salesOrder: "", billingDocumentType: "",
                fromDate: null, toDate: null, pagingTop: PAGE_SIZE,
                groupingMethod: "salesDocAndItems", autoRefresh: false, showConditionDetails: true
            });
            this._resetDataModels();
            MessageToast.show("All filters cleared");
        },

        // ========================================
        // INITIALIZATION & CONFIGURATION
        // ========================================
        _initializeModels: function () {
            const modelDefinitions = {
                salesData: {
                    results: [], count: 0, totalCount: 0, originalRecordCount: 0,
                    totalAmount: 0, recordsWithTextData: 0, lastLoadTime: null, rawResults: []
                },
                filterData: {
                    billingDocument: "", salesOrder: "", billingDocumentType: "",
                    fromDate: null, toDate: null, pagingTop: PAGE_SIZE,
                    groupingMethod: "salesDocAndItems", autoRefresh: false, showConditionDetails: true
                },
                loadingState: {
                    loading: false, currentOperation: "", progress: 0,
                    totalSteps: 0, currentStep: 0
                },
                pagination: {
                    hasMore: false, currentSkip: 0, pageSize: PAGE_SIZE,
                    totalRecords: 0, loadedRecords: 0
                },
                salesText: {
                    textData: {}, loadedSalesOrders: []
                }
            };

            Object.entries(modelDefinitions).forEach(([name, data]) => {
                this.getView().setModel(new JSONModel(data), name);
            });
        },

        _initializeServices: function () {
            sap.ui.require(
                ["aryasalesregister/services/SalesOrderTextService"],
                (SalesOrderTextService) => {
                    this.salesOrderTextService = new SalesOrderTextService(this);
                    console.log("✅ SalesOrderTextService initialized");
                },
                (error) => {
                    console.warn("⚠️ SalesOrderTextService not available:", error);
                    this.salesOrderTextService = null;
                }
            );
        },

        _validateConfiguration: function () {
            const salesModel = this.getView().getModel();
            if (!salesModel) {
                const component = this.getOwnerComponent();
                const componentModel = component?.getModel();
                if (componentModel) {
                    this.getView().setModel(componentModel);
                    console.log("✅ Sales Register Model set from component");
                } else {
                    console.error("❌ Sales Register Model not found");
                    MessageBox.error("Sales Register service not configured. Check manifest.json.");
                    return false;
                }
            }
            console.log("✅ Sales Register Model validated");
            return true;
        },

        // ========================================
        // COLUMN MANAGEMENT
        // ========================================
        _loadColumnSettings: function () {
            try {
                const settings = localStorage.getItem("salesRegisterColumnSettings");
                if (settings) {
                    this._applyColumnLayout(JSON.parse(settings));
                    console.log("📁 Column settings loaded");
                    return true;
                }
            } catch (error) {
                console.error("Failed to load column settings:", error);
            }
            return false;
        },

        _saveColumnSettings: function () {
            try {
                const layout = this._getColumnLayout();
                localStorage.setItem("salesRegisterColumnSettings", JSON.stringify(layout));
                console.log("💾 Column settings saved");
            } catch (error) {
                console.error("Failed to save column settings:", error);
            }
        },

        _getColumnLayout: function () {
            return this._CONSTANTS.ALL_COLUMNS.map(columnId => {
                const column = this.byId(columnId);
                return {
                    id: columnId,
                    visible: column ? column.getVisible() : true
                };
            });
        },

        _applyColumnLayout: function (layout) {
            layout.forEach(({ id, visible }) => {
                const column = this.byId(id);
                if (column) column.setVisible(visible);
            });
        },

        onSelectAllColumns: function () {
            this._setAllColumnsVisibility(true);
            this._saveColumnSettings();
            MessageToast.show("All columns visible");
        },

        onResetDefaultColumns: function () {
            this._CONSTANTS.ALL_COLUMNS.forEach(columnId => {
                const column = this.byId(columnId);
                if (column) {
                    const visible = this._CONSTANTS.DEFAULT_COLUMNS.includes(columnId);
                    column.setVisible(visible);
                }
            });
            this._saveColumnSettings();
            MessageToast.show("Reset to default layout");
        },

        _setAllColumnsVisibility: function (visible) {
            this._CONSTANTS.ALL_COLUMNS.forEach(columnId => {
                const column = this.byId(columnId);
                if (column) column.setVisible(visible);
            });
        },

        // ========================================
        // DATA LOADING & PAGINATION
        // ========================================
        onLoadData: function () {
            // Reset pagination and start fresh
            this.getView().getModel("pagination").setProperty("/currentSkip", 0);
            this._loadData(0, true); // true = reset data
        },

        onLoadMoreData: function () {
            const paginationModel = this.getView().getModel("pagination");
            const { hasMore, currentSkip } = paginationModel.getData();

            if (hasMore) {
                try {
                    this._loadData(currentSkip, false); // false = append data
                } catch (error) {
                    console.error("Error loading more data:", error);
                    MessageToast.show("Error loading more data");
                }
            } else {
                MessageToast.show("No more records to load.");
            }
        },

        _loadData: function (skip, resetData = false) {
            const salesModel = this.getView().getModel();
            if (!salesModel) {
                MessageBox.error("Sales Register service not available");
                return;
            }

            const errors = this._validateFilterData();
            if (errors.length > 0) {
                MessageBox.error("Validation Error:\n\n" + errors.join("\n"));
                return;
            }

            if (resetData) {
                this._setLoading(true, "Loading first batch of data...", 1, 4);
                this._resetDataModels();
            } else {
                this._setLoading(true, `Loading next batch starting from record ${skip + 1}...`, 1, 4);
            }

            this._loadSalesDataWithFilters(skip)
                .then(result => this._processSalesResult(result, skip, resetData))
                .catch(error => this._handleLoadError(error))
                .finally(() => this._setLoading(false));
        },

        _loadSalesDataWithFilters: function (skip) {
            return new Promise((resolve, reject) => {
                const salesModel = this.getView().getModel();
                const filters = this._buildFilters();
                const urlParameters = this._buildUrlParameters(skip);

                console.log(`🔗 Loading data: skip=${skip}, top=${urlParameters.$top}`);

                salesModel.read(this._CONSTANTS.SERVICE_URLS.SALES_REGISTER, {
                    filters: filters,
                    urlParameters: urlParameters,
                    success: (data) => {
                        const results = data.results || [];
                        let totalCount;

                        if (data.__count) {
                            totalCount = parseInt(data.__count, 10);
                        } else {
                            const paginationModel = this.getView().getModel("pagination");
                            const existingTotal = paginationModel.getProperty("/totalRecords") || 0;
                            totalCount = existingTotal || (skip + results.length);
                        }

                        console.log(`✅ Loaded ${results.length} records (skip=${skip}), Total: ${totalCount}`);
                        resolve({ results, totalCount });
                    },
                    error: (error) => reject(new Error(this._formatError("Sales Data", error)))
                });
            });
        },

        _processSalesResult: async function (salesResult, skip, resetData) {
            const { results: newSalesResult, totalCount } = salesResult;
            const salesDataModel = this.getView().getModel("salesData");
            const paginationModel = this.getView().getModel("pagination");

            // 1. Merge with previously loaded raw data
            let existingRawData = resetData ? [] : (salesDataModel.getProperty("/rawResults") || []);
            let rawDataToProcess = existingRawData.concat(newSalesResult);

            // 2. If nothing loaded and this was a fresh load, show "no data"
            if (rawDataToProcess.length === 0 && resetData) {
                this._finishDataLoad([], 0, 0, []);
                MessageBox.information("No data found for the selected date range.");
                return;
            }

            // 3. Enrich raw data with ZXT* BEFORE grouping
            if (this.salesOrderTextService && rawDataToProcess.length > 0) {
                try {
                    this._setLoading(true, "Loading contract & warehouse text data...", 2, 4);
                    rawDataToProcess = await this.salesOrderTextService.loadAndMapSalesOrderText(rawDataToProcess);
                    console.log("✅ ZXT* text enrichment done for", rawDataToProcess.length, "records");
                } catch (e) {
                    console.warn("⚠️ Text enrichment failed, continuing without ZXT*:", e);
                }
            } else {
                console.log("ℹ️ SalesOrderTextService not available, skipping ZXT* enrichment");
            }

            // 4. Group after enrichment
            this._setLoading(true, `Processing ${rawDataToProcess.length} records...`, 3, 4);
            const groupedData = this._groupByDocumentAndItem(rawDataToProcess);

            // 5. Finish data load & update models
            this._finishDataLoad(groupedData, totalCount, rawDataToProcess.length, rawDataToProcess);

            const recordsLoadedSoFar = rawDataToProcess.length;
            const pageSize = paginationModel.getProperty("/pageSize") || PAGE_SIZE;

            const backendTotal = totalCount || 0;
            const effectiveTotal = backendTotal && backendTotal >= recordsLoadedSoFar
                ? backendTotal
                : recordsLoadedSoFar;

            paginationModel.setProperty("/currentSkip", recordsLoadedSoFar);
            paginationModel.setProperty("/loadedRecords", recordsLoadedSoFar);
            paginationModel.setProperty("/totalRecords", effectiveTotal);

            // 6. Decide if there's more data
            let hasMore = false;
            if (backendTotal && recordsLoadedSoFar < backendTotal) {
                hasMore = true;
            } else if (newSalesResult.length === pageSize) {
                hasMore = true;
            } else {
                hasMore = false;
            }

            paginationModel.setProperty("/hasMore", hasMore);

            // 7. User feedback
            if (resetData) {
                MessageToast.show(
                    `Loaded first ${newSalesResult.length} of ${backendTotal || recordsLoadedSoFar} records`
                );
            } else if (hasMore) {
                const remaining = backendTotal
                    ? (backendTotal - recordsLoadedSoFar)
                    : "more";
                MessageToast.show(
                    `Loaded ${newSalesResult.length} more records. Remaining: ${remaining}`
                );
            } else {
                MessageToast.show(
                    `✅ All ${recordsLoadedSoFar} records loaded successfully!`
                );
            }
        },

        // ========================================
        // DATA GROUPING (MAPPED TO EDMX)
        // ========================================
        _groupByDocumentAndItem: function (salesData) {
            console.log("📊 Grouping sales data...");
            const grouped = {};

            salesData.forEach(item => {
                const key = this._createGroupKey(item);
                if (!grouped[key]) {
                    grouped[key] = this._createGroupRecord(item);
                }
                this._accumulateGroupAmounts(grouped[key], item);
            });

            Object.values(grouped).forEach(group => {
                this._calculateTotals(group);
            });

            const result = Object.values(grouped);
            this._sortGroups(result);
            console.log(`✅ Grouped ${salesData.length} items → ${result.length} groups`);
            return result;
        },

        _createGroupKey: function (item) {
            return `${item.BillingDocument || 'N/A'}_${item.SalesDocument || 'N/A'}_${item.SalesDocumentItem || '000010'}`;
        },

        _createGroupRecord: function (item) {
            return {
                // Core fields
                BillingDocument: item.BillingDocument,
                PurchaseOrderByCustomer: item.PurchaseOrderByCustomer || "",
                SalesDocument: item.SalesDocument,
                SalesDocumentItem: item.SalesDocumentItem,
                BillingDocumentDate: item.BillingDocumentDate,
                InvoiceMonth: this.formatInvoiceMonth(item.BillingDocumentDate),
                BillingDocumentType: item.BillingDocumentType,
                BillingDocumentItemText: item.ProductName || "",

                // Customer/Partner
                CustomerNumber: item.PayerParty || "",
                CustomerDisplay: item.CustomerFullName_1 || item.BusinessPartnerName1 || "",
                CustomerState: item.Region || "",
                ShipToParty: item.BillToParty || "",
                ShipToDisplay: "",
                CustomerGSTIN: item.BPTaxNumber || "",
                CustomerPaymentTerms: item.CustomerPaymentTerms || "",
                CustomerHeadOffice: item.CustomerHeadOffice || "",
                PAN: item.PAN || "",
                TAN: "",

                // Product
                Product: item.Product || "",
                ProductName: item.ProductName || "",
                Plant: item.Plant || "",
                SAC_HSN: "",

                BillingQuantity: this._parseNumber(item.BillingQuantity),
                BillingQuantityUnit: item.BillingQuantityUnit || "",

                // Financial/Tax
                TransactionCurrency: item.TransactionCurrency || "INR",
                DistributionChannel: item.DistributionChannel || "",
                Division: item.Division || "",
                TaxCode: item.TaxCode || "",
                ProfitCenter: item.ProfitCenter || "",
                GLAccount: item.GLAccount || "",

                // Derived
                NetDueDate: item.NetDueDate,
                CustomerType: this._deriveCustomerType(item),

                // E-Invoice / E-Way Bill
                EInvoiceStatus: item.IN_EDocEWbillStatus || "",
                EWayBillNo: item.IN_EDocEInvcEWbillNmbr || "",
                EWayBillDate: item.IN_EDocEInvcEWbillValidityDate,

                // Customer Groups
                CustomerGroup1: item.AdditionalCustomerGroup1 || "",
                CustomerGroup2: item.AdditionalCustomerGroup2 || "",
                CustomerGroup3: item.AdditionalCustomerGroup3 || "",
                CustomerGroup4: item.AdditionalCustomerGroup4 || "",
                CustomerGroup5: item.AdditionalCustomerGroup5 || "",

                // Condition amounts
                PPR0: 0, DRV1: 0, ZDV2: 0, JOIG: 0, JOCG: 0, JOSG: 0, ZTCS: 0, ZDV4: 0,

                // Totals
                TotalNetAmount: this._parseNumber(item.TotalNetAmount),
                InvoiceAmount: 0,

                // ZXT fields - initialized from item
                ZXT1: item.ZXT1 || "",
                ZXT2: item.ZXT2 || "",
                ZXT3: item.ZXT3 || "",
                ZXT4: item.ZXT4 || "",
                ZXT5: item.ZXT5 || "",
                ZXT6: item.ZXT6 || "",
                ZXT7: item.ZXT7 || "",
                ZXT8: item.ZXT8 || "",
                ZXT9: item.ZXT9 || "",
                ZXT10: this._parseNumber(item.ZXT10),

                DetailRecords: []
            };
        },

        /**
         * ✅ FIXED: Fill all non-amount attributes from detail records
         */
        _fillMissingAttributes: function (group, item) {
            const attributeFields = [
                // Customer / partner attributes
                "CustomerNumber", "CustomerDisplay", "CustomerState",
                "ShipToParty", "ShipToDisplay", "CustomerGSTIN",
                "CustomerPaymentTerms", "CustomerHeadOffice", "PAN", "TAN",
                "PurchaseOrderByCustomer",
                // Product / org structure
                "Product", "ProductName", "Plant", "SAC_HSN",
                "TransactionCurrency", "Division", "DistributionChannel",
                "TaxCode", "ProfitCenter", "GLAccount", "BillingQuantityUnit",
                "BillingDocumentItemText",

                // Groups
                "CustomerGroup1", "CustomerGroup2", "CustomerGroup3",
                "CustomerGroup4", "CustomerGroup5",

                // E-Invoice / E-Way info
                "EInvoiceStatus", "EWayBillNo", "EWayBillDate",

                // ✅ FIXED: Include ALL ZXT text fields (not ZXT10 which is numeric)
                "ZXT1", "ZXT2", "ZXT3", "ZXT4", "ZXT5",
                "ZXT6", "ZXT7", "ZXT8", "ZXT9"
            ];

            attributeFields.forEach(function (field) {
                const current = group[field];
                const candidate = item[field];

                if ((current === undefined || current === null || current === "") &&
                    candidate !== undefined && candidate !== null && candidate !== "") {
                    group[field] = candidate;
                }
            });
        },

        _accumulateGroupAmounts: function (group, item) {
            const amount = this._parseNumber(item.ConditionAmount);
            const condType = item.ConditionType;
            const constants = this._CONSTANTS.CONDITION_TYPES;

            // Pricing / amounts aggregation
            if (condType && group.hasOwnProperty(condType)) {
                group[condType] += amount;
            }
            if (condType === constants.BASE_PRICE) {
                group.TotalNetAmount += amount;
            }

            // ✅ Fill missing attributes from each detail record
            this._fillMissingAttributes(group, item);

            // ✅ FIXED: Also accumulate ZXT10 (rate) if it's numeric
            if (item.ZXT10 && this._parseNumber(item.ZXT10) > 0) {
                group.ZXT10 = this._parseNumber(item.ZXT10);
            }

            // Keep complete detail history
            group.DetailRecords.push(item);
        },

        _calculateTotals: function (group) {
            const { DRV1, ZDV2, JOIG, JOCG, JOSG, ZTCS, ZDV4, TotalNetAmount } = group;
            group.InvoiceAmount = TotalNetAmount - DRV1 + ZDV2 + JOIG + JOCG + JOSG + ZTCS + ZDV4;
            group.TotalNetAmount = this._round(TotalNetAmount);
            group.InvoiceAmount = this._round(group.InvoiceAmount);
        },

        _sortGroups: function (groups) {
            groups.sort((a, b) => {
                if (a.SalesDocument !== b.SalesDocument) {
                    return a.SalesDocument.localeCompare(b.SalesDocument);
                }
                return a.SalesDocumentItem.localeCompare(b.SalesDocumentItem);
            });
        },

        // ========================================
        // FILTERS & URL PARAMETERS
        // ========================================
        _buildFilters: function () {
            const filters = [];
            const data = this.getView().getModel("filterData").getData();

            if (data.billingDocument && data.billingDocument.trim()) {
                filters.push(new Filter("BillingDocument", FilterOperator.EQ, data.billingDocument.trim()));
            }
            if (data.salesOrder && data.salesOrder.trim()) {
                filters.push(new Filter("SalesDocument", FilterOperator.EQ, data.salesOrder.trim()));
            }
            if (data.billingDocumentType && data.billingDocumentType.trim()) {
                filters.push(new Filter("BillingDocumentType", FilterOperator.EQ, data.billingDocumentType.trim()));
            }
            if (data.fromDate) {
                filters.push(new Filter("BillingDocumentDate", FilterOperator.GE, data.fromDate));
            }
            if (data.toDate) {
                filters.push(new Filter("BillingDocumentDate", FilterOperator.LE, data.toDate));
            }
            return filters;
        },

        _buildUrlParameters: function (skip) {
            const params = {
                $select: this._getSelectFields(),
                $top: PAGE_SIZE,
                $skip: skip,
                $orderby: "BillingDocumentDate desc,BillingDocument asc,SalesDocumentItem asc",
                $inlinecount: "allpages"
            };
            return params;
        },
        _getSelectFields: function () {
            const fields = [
                "BillingDocument", "BillingDocumentDate", "BillingDocumentType", "BillingDocumentItem",
                "SalesDocument", "SalesDocumentItem", "Product", "ProductName",  // <-- UPDATED: ProductName
                "BillingQuantity", "BillingQuantityUnit", "ConditionType", "ConditionAmount",
                "TransactionCurrency", "TotalNetAmount", "ProfitCenter", "GLAccount",
                "PayerParty", "BusinessPartnerName1", "CustomerFullName_1", "CustomerHeadOffice", // <-- UPDATED: CustomerHeadOffice
                "BillToParty", "ShipToParty", "Region", "CustomerPaymentTerms", "BPTaxNumber", "PAN", // <-- UPDATED: ShipToParty
                "TaxCode", "DistributionChannel", "Division", // <-- UPDATED: DistributionChannel
                "AdditionalCustomerGroup1", "AdditionalCustomerGroup2", "AdditionalCustomerGroup3",
                "AdditionalCustomerGroup4", "AdditionalCustomerGroup5", "Plant",
                "NetDueDate",
                "IN_EDocEWbillStatus", "IN_EDocEInvcEWbillNmbr", "IN_EDocEInvcEWbillValidityDate"
            ];
            return fields.filter(Boolean).join(",");
        },
        _getSelectFields: function () {
            const fields = [
                "BillingDocument", "PurchaseOrderByCustomer",
                "BillingDocumentDate", "BillingDocumentType", "BillingDocumentItem",
                "SalesDocument", "SalesDocumentItem", "Product", "ProductName",
                "BillingQuantity", "BillingQuantityUnit", "ConditionType", "ConditionAmount",
                "TransactionCurrency", "TotalNetAmount", "ProfitCenter", "GLAccount",
                "PayerParty", "BusinessPartnerName1", "CustomerFullName_1", "CustomerHeadOffice",
                "BillToParty", "ShipToParty", "Region", "CustomerPaymentTerms", "BPTaxNumber", "PAN",
                "TaxCode", "DistributionChannel", "Division",
                "AdditionalCustomerGroup1", "AdditionalCustomerGroup2", "AdditionalCustomerGroup3",
                "AdditionalCustomerGroup4", "AdditionalCustomerGroup5", "Plant",
                "NetDueDate",
                "IN_EDocEWbillStatus", "IN_EDocEInvcEWbillNmbr", "IN_EDocEInvcEWbillValidityDate"
            ];
            return fields.filter(Boolean).join(",");
        },

        // ========================================
        // EXPORT
        // ========================================
        onExportToExcel: function () {
            const data = this.getView().getModel("salesData").getData();

            if (!data.results || data.results.length === 0) {
                MessageBox.warning("No data to export");
                return;
            }

            try {
                const columns = this._getExportColumns();
                const fileName = `Sales_Register_${new Date().toISOString().split('T')[0]}.xlsx`;

                const spreadsheet = new Spreadsheet({
                    workbook: { columns: columns },
                    dataSource: data.results,
                    fileName: fileName
                });

                spreadsheet.build()
                    .then(() => MessageToast.show(`Exported ${data.results.length} records`))
                    .catch(error => MessageBox.error("Export failed: " + error.message))
                    .finally(() => spreadsheet.destroy());

            } catch (error) {
                MessageBox.error("Export not available: " + error.message);
            }
        },

        _getExportColumns: function () {
            return [
                { label: "Invoice Date", property: "BillingDocumentDate", type: "date" },
                { label: "Arya DTR Invoice No.", property: "ZXT2", type: "string" },
                { label: "SAP Invoice No.", property: "BillingDocument", type: "string" },
                { label: "Contract ID/Trade ID", property: "ZXT4", type: "string" },
                { label: "Customer Name(sold to)", property: "CustomerDisplay", type: "string" },
                { label: "Customer State", property: "CustomerState", type: "string" },
                { label: "Customer Name(ship to)", property: "ShipToDisplay", type: "string" },
                { label: "Customer GSTIN", property: "CustomerGSTIN", type: "string" },
                { label: "Terms of Payment", property: "CustomerPaymentTerms", type: "string" },
                { label: "Sale order No.", property: "SalesDocument", type: "string" },
                { label: "Due Date", property: "NetDueDate", type: "date" },
                { label: "Plant", property: "Plant", type: "string" },
                { label: "Invoice Type", property: "BillingDocumentType", type: "string" },
                { label: "Tax Code", property: "TaxCode", type: "string" },
                { label: "Customer Code", property: "CustomerNumber", type: "string" },
                { label: "Head Office Code", property: "CustomerHeadOffice", type: "string" },
                { label: "Customer Group-1", property: "CustomerGroup1", type: "string" },
                { label: "Customer Group-2", property: "CustomerGroup2", type: "string" },
                { label: "Customer Group-3", property: "CustomerGroup3", type: "string" },
                { label: "Customer Group-4", property: "CustomerGroup4", type: "string" },
                { label: "Customer Group-5", property: "CustomerGroup5", type: "string" },
                { label: "Customer Type", property: "CustomerType", type: "string" },
                { label: "Invoice Raised for the month", property: "BillingDocumentDate", type: "date" },
                { label: "Divison", property: "Division", type: "string" },
                { label: "Distribution Channel", property: "DistributionChannel", type: "string" },
                { label: "GL Code", property: "GLAccount", type: "string" },
                { label: "SAC/HSN Code", property: "SAC_HSN", type: "string" },
                { label: "Material Code", property: "Product", type: "string" },
                { label: "Material Description", property: "ProductName", type: "string" },
                { label: "PAN No.", property: "PAN", type: "string" },
                { label: "TAN No.", property: "TAN", type: "string" },
                { label: "Taxable Amount", property: "TotalNetAmount", type: "number" },
                { label: "Discount", property: "DRV1", type: "number" },
                { label: "Additional Charges", property: "ZDV2", type: "number" },
                { label: "IGST", property: "JOIG", type: "number" },
                { label: "CGST", property: "JOCG", type: "number" },
                { label: "SGST", property: "JOSG", type: "number" },
                { label: "Invoice Amount", property: "InvoiceAmount", type: "number" },
                { label: "Profit Centre", property: "ProfitCenter", type: "string" },
                { label: "Warehouse Code", property: "ZXT1", type: "string" },
                { label: "Warehouse Name", property: "ZXT3", type: "string" },
                { label: "Warehouse State", property: "ZXT5", type: "string" },
                { label: "Warehouse Location", property: "ZXT6", type: "string" },
                { label: "Cluster ID", property: "ZXT7", type: "string" },
                { label: "Parent Invoice No.", property: "ZXT8", type: "string" },
                { label: "Parent Invoice Date", property: "ZXT9", type: "date" },
                { label: "E-invoice Status", property: "EInvoiceStatus", type: "string" },
                { label: "Qty.", property: "BillingQuantity", type: "number" },
                { label: "Rate/MT", property: "ZXT10", type: "number" },
                { label: "Delay Charges", property: "ZDV4", type: "number" },
                { label: "E-way Bill No.", property: "EWayBillNo", type: "string" },
                { label: "E-way Bill Date", property: "EWayBillDate", type: "date" },
                { label: "TCS", property: "ZTCS", type: "number" }
            ];
        },

        // ========================================
        // FORMATTERS & HELPERS
        // ========================================
        formatNumber: function (value) {
            if (!value && value !== 0) return "0.00";
            const num = parseFloat(value);
            return isNaN(num) ? "0.00" :
                new Intl.NumberFormat("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(num);
        },

        formatDate: function (date) {
            if (!date) return "";
            try {
                let d = date;
                if (typeof date === 'string' && date.startsWith('/Date(')) {
                    d = new Date(parseInt(date.match(/\d+/)[0], 10));
                } else if (!(date instanceof Date)) {
                    d = new Date(date);
                }
                return d.toLocaleDateString("en-IN");
            } catch (e) {
                return "";
            }
        },

        formatDocTypeState: function (docType) {
            if (!docType) return "None";
            const states = { F2: "Success", G2: "Warning", L2: "Error" };
            return states[docType.toUpperCase()] || "Information";
        },

        formatEInvoiceState: function (status) {
            if (!status) return "None";
            const upper = status.toUpperCase();
            if (["SUCCESS", "COMPLETED"].includes(upper)) return "Success";
            if (["PENDING", "IN_PROGRESS"].includes(upper)) return "Warning";
            if (["FAILED", "ERROR"].includes(upper)) return "Error";
            return "Information";
        },

        formatAmountState: function (amount) {
            if (!amount && amount !== 0) return "None";
            return amount > 0 ? "Information" : "Error";
        },

        _resetDataModels: function () {
            this.getView().getModel("salesData").setData({
                results: [], count: 0, totalCount: 0, originalRecordCount: 0,
                totalAmount: 0, recordsWithTextData: 0, lastLoadTime: null, rawResults: []
            });

            this.getView().getModel("pagination").setData({
                hasMore: false, currentSkip: 0, pageSize: PAGE_SIZE,
                totalRecords: 0, loadedRecords: 0
            });
        },

        formatInvoiceMonth: function (date) {
            if (!date) return "";
            let d = date;

            if (typeof date === 'string' && date.startsWith('/Date(')) {
                d = new Date(parseInt(date.match(/\d+/)[0], 10));
            } else if (!(d instanceof Date)) {
                d = new Date(date);
            }

            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

            return `${months[d.getMonth()]} ${d.getFullYear()}`;
        },

        _finishDataLoad: function (processedData, totalCount, originalCount, rawDataToProcess) {
            const finalData = processedData;
            const totalAmount = finalData.reduce((sum, r) => sum + (r.InvoiceAmount || 0), 0);

            const textCount = finalData.filter(r =>
                r.ZXT1 || r.ZXT2 || r.ZXT3 || r.ZXT4 ||
                r.ZXT5 || r.ZXT6 || r.ZXT7 || r.ZXT8
            ).length;

            this.getView().getModel("salesData").setData({
                results: finalData,
                count: finalData.length,
                totalCount: totalCount,
                originalRecordCount: originalCount,
                totalAmount: totalAmount,
                recordsWithTextData: textCount,
                lastLoadTime: new Date().toLocaleTimeString(),
                rawResults: rawDataToProcess
            });

            this._setLoading(false);
            this._fixTableScrollBars();
        },

        _fixTableScrollBars: function () {
            const table = this.byId("salesTable");
            if (!table) {
                return;
            }

            setTimeout(() => {
                try {
                    const tableDom = table.getDomRef();
                    if (!tableDom) {
                        return;
                    }

                    const headerHeight = this.byId("headerToolbar")?.getDomRef()?.offsetHeight || 0;
                    const filterHeight = this.byId("enterpriseFilterPanel")?.getDomRef()?.offsetHeight || 0;
                    const footerHeight = this.getView().byId("mainPage")?.getFooter()?.getDomRef()?.offsetHeight || 0;

                    const estimatedOffset = headerHeight + filterHeight + footerHeight + 150;
                    const availableHeight = window.innerHeight - estimatedOffset;
                    const newHeight = Math.max(300, availableHeight) + "px";

                    tableDom.style.height = newHeight;
                } catch (e) {
                    console.warn("⚠️ _fixTableScrollBars failed, ignoring:", e);
                }
            }, 500);
        },

        _deriveCustomerType: function (item) {
            return (item.BPTaxNumber && item.BPTaxNumber.trim()) ?
                this._CONSTANTS.CUSTOMER_TYPES.B2B : this._CONSTANTS.CUSTOMER_TYPES.B2C;
        },

        _parseNumber: function (value) {
            if (typeof value === 'number') return value;
            if (typeof value === 'string') {
                const parsed = parseFloat(value);
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        },

        _round: function (value) {
            return Math.round(value * 100) / 100;
        },

        _validateFilterData: function () {
            const errors = [];
            const data = this.getView().getModel("filterData").getData();

            if (!data.fromDate || !data.toDate) {
                errors.push("⚠️ Date Range is MANDATORY\n\nPlease select both From Date and To Date, or use one of the Quick Period buttons.");
                return errors;
            }

            const fromDate = new Date(data.fromDate);
            const toDate = new Date(data.toDate);

            if (fromDate > toDate) {
                errors.push("From Date cannot be after To Date");
            }

            if (data.billingDocument && data.billingDocument.trim() && !/^\d+$/.test(data.billingDocument.trim())) {
                errors.push("Billing Document must be numeric");
            }
            if (data.salesOrder && data.salesOrder.trim() && !/^\d+$/.test(data.salesOrder.trim())) {
                errors.push("Sales Order must be numeric");
            }

            return errors;
        },

        _setLoading: function (loading, operation = "", step = 0, total = 0) {
            this.getView().getModel("loadingState").setData({
                loading: loading,
                currentOperation: operation,
                currentStep: step,
                totalSteps: total,
                progress: total > 0 ? Math.round((step / total) * 100) : 0
            });
        },

        _formatError: function (context, error) {
            let msg = `${context} loading failed`;
            if (error.responseText) {
                try {
                    const obj = JSON.parse(error.responseText);
                    if (obj.error?.message) {
                        msg += `: ${obj.error.message.value || obj.error.message}`;
                    }
                } catch (e) {
                    msg += `: ${error.responseText}`;
                }
            } else if (error.message) {
                msg += `: ${error.message}`;
            }
            return msg;
        },

        _handleLoadError: function (error) {
            console.error("❌ Load error:", error);
            this._setLoading(false);
            MessageBox.error(`Loading failed: ${error.message}`);
        },

        // ========================================
        // EVENT HANDLERS
        // ========================================
        onBillingDocumentPress: function (event) {
            const record = event.getSource().getBindingContext("salesData").getObject();
            MessageToast.show(`Viewing details for Billing Document: ${record.BillingDocument}`);
        },

        onSalesDocumentPress: function (event) {
            const record = event.getSource().getBindingContext("salesData").getObject();
            MessageToast.show(`Viewing details for Sales Order: ${record.SalesDocument}`);
        },

        onViewRowDetails: function (event) {
            const record = event.getSource().getBindingContext("salesData").getObject();
            MessageBox.information(
                `Billing Document: ${record.BillingDocument}\n` +
                `Sales Order: ${record.SalesDocument}\n` +
                `Customer: ${record.CustomerDisplay}\n` +
                `Amount: ${this.formatNumber(record.InvoiceAmount)}`
            );
        },

        onTableSearch: function (event) {
            const query = event.getParameter("query") || event.getParameter("newValue");
            const table = this.byId("salesTable");
            const binding = table.getBinding("rows");

            if (binding) {
                if (query && query.length > 0) {
                    const filters = [
                        new Filter("BillingDocument", FilterOperator.Contains, query),
                        new Filter("SalesDocument", FilterOperator.Contains, query),
                        new Filter("CustomerDisplay", FilterOperator.Contains, query),
                        new Filter("Product", FilterOperator.Contains, query)
                    ];
                    binding.filter(new Filter({ filters: filters, and: false }));
                } else {
                    binding.filter([]);
                }
            }
        }
    });
});
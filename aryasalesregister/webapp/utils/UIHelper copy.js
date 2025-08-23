sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/model/json/JSONModel",
    "sap/m/GroupHeaderListItem"
], function (Object, JSONModel, GroupHeaderListItem) {
    "use strict";

    return Object.extend("aryasalesregister.controller.UIHelper", {

        constructor: function (controller) {
            this.controller = controller;
            this.autoRefreshTimer = null;
            this.detailDialog = null;
        },

        initializeModels: function () {
            const controller = this.controller;
            controller.getView().setModel(new JSONModel({ results: [], count: 0, totalCount: 0, totalAmount: 0, lastLoadTime: null }), "salesData");
            controller.getView().setModel(new JSONModel({
                billingDocument: "", salesOrder: "", billingDocumentType: "", pagingTop: 100,
                groupingMethod: "salesDocAndItems", autoRefresh: false,
                filterCapabilities: { billingDocument: true, salesOrder: true, billingDocumentType: true }
            }), "filterData");
            controller.getView().setModel(new JSONModel({ loading: false, currentOperation: "" }), "loadingState");
            controller.getView().setModel(new JSONModel({ hasMore: false, currentSkip: 0, pageSize: 100, totalRecords: 0, loadedRecords: 0 }), "pagination");
            controller.getView().setModel(new JSONModel({ selectedCount: 0, selectedItems: [], dataRequested: false }), "ui");
            controller.getView().setModel(new JSONModel({ textData: {}, loadedSalesOrders: [] }), "salesText");
        },

        setupAutoRefresh: function () {
            const controller = this.controller;
            const filterDataModel = controller.getView().getModel("filterData");
            if (filterDataModel && filterDataModel.getProperty("/autoRefresh")) {
                this.autoRefreshTimer = setInterval(() => {
                    const salesDataModel = controller.getView().getModel("salesData");
                    if (salesDataModel && salesDataModel.getProperty("/results").length > 0) {
                        console.log("🔄 Auto-refresh triggered");
                        controller.onLoadData();
                    }
                }, 5 * 60 * 1000);
            }
        },

        loadMetadataAndConfigureFilters: async function () {
            const controller = this.controller;
            controller._setLoading(true, "Loading service metadata...");
            const salesModel = controller.getView().getModel();
            if (!salesModel) {
                console.warn("⚠️ Sales Register service not configured.");
                return;
            }
            await Promise.race([salesModel.getMetaModel().loaded(), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))]);
            const metadata = this._analyzeMetadata(salesModel.getMetaModel());
            this._configureFilterCapabilities(metadata);
            controller.onMessageToast.show("Service metadata loaded successfully");
            controller._setLoading(false);
        },

        _analyzeMetadata: function (metaModel) {
            const entityContainer = metaModel.getODataEntityContainer();
            const entitySets = entityContainer.entitySet || [];
            const salesRegisterEntitySet = entitySets.find(es => es.name === "YY1_SALESREGISTER");
            const entityType = metaModel.getODataEntityType(salesRegisterEntitySet.entityType);
            const properties = entityType.property || [];
            const availableFields = properties.map(prop => ({ name: prop.name, filterable: prop["sap:filterable"] !== "false" }));
            return { availableFields };
        },

        _configureFilterCapabilities: function (metadata) {
            const filterModel = this.controller.getView().getModel("filterData");
            const capabilities = {};
            const filterMappings = {
                billingDocument: "BillingDocument", salesOrder: "SalesDocument", billingDocumentType: "BillingDocumentType"
            };
            Object.keys(filterMappings).forEach(key => {
                const field = metadata.availableFields.find(f => f.name === filterMappings[key]);
                capabilities[key] = field ? field.filterable : false;
            });
            filterModel.setProperty("/filterCapabilities", capabilities);
            this._updateFilterUIState(capabilities);
        },
        
        _updateFilterUIState: function (capabilities) {
            const controller = this.controller;
            const controls = { billingDocInput: "billingDocument", salesOrderInput: "salesOrder", docTypeCombo: "billingDocumentType" };
            Object.keys(controls).forEach(id => {
                const control = controller.byId(id);
                if (control) {
                    const isEnabled = capabilities[controls[id]];
                    control.setEnabled(isEnabled);
                    if (!isEnabled) {
                        control.setTooltip(`Filter not available - ${controls[id]} field is not filterable in the service`);
                    }
                }
            });
        },

        // --- Formatters ---
        formatNumber: function (value) {
            if (value === undefined || value === null || isNaN(parseFloat(value))) return "0.00";
            const parsedValue = Math.abs(parseFloat(value));
            return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsedValue);
        },

        formatDate: function (date) {
            if (!date) return "";
            if (typeof date === "string" && date.includes("/Date(")) {
                const timestamp = parseInt(date.match(/\d+/)[0]);
                return new Date(timestamp).toLocaleDateString("en-IN");
            }
            return new Date(date).toLocaleDateString("en-IN");
        },

        formatDateTime: function (dateTime) {
            if (!dateTime) return "";
            return new Date(dateTime).toLocaleString("en-IN");
        },
        
        formatCurrency: function (amount, currency) {
            return this.formatNumber(amount) + " " + (currency || "INR");
        },

        formatGroupType: function (groupType) {
            switch (groupType) {
                case "SALES_DOC_AND_ITEM": return "Sales Doc/Item";
                case "BILLING_DOC_AND_ITEM": return "Billing Doc/Item";
                default: return groupType || "Individual";
            }
        },

        formatAmountState: function (amount) {
            const value = parseFloat(amount);
            if (value > 100000) return "Success";
            if (value > 50000) return "Warning";
            return "None";
        },

        formatEInvoiceState: function (status) {
            if (!status) return "None";
            switch (status.toUpperCase()) {
                case "SUCCESS": case "COMPLETED": return "Success";
                case "PENDING": case "IN_PROGRESS": return "Warning";
                case "FAILED": case "ERROR": return "Error";
                default: return "Information";
            }
        },

        getGroupHeader: function (oGroup) {
            return new GroupHeaderListItem({
                title: "Invoice Date: " + this.formatDate(oGroup.key),
                upperCase: false
            });
        },

        // Helper functions for UI interaction
        setLoading: function (isLoading, operation) {
            this.controller._setLoading(isLoading, operation);
        },
        
        showDetailDialog: async function (record) {
            const controller = this.controller;
             if (!this.detailDialog) {
                this.detailDialog = await Fragment.load({
                    id: controller.getView().getId(),
                    name: "aryasalesregister.view.fragments.DetailDialog",
                    controller: controller
                });
                controller.getView().addDependent(this.detailDialog);
            }

            const detailModel = new JSONModel({ details: record });
            this.detailDialog.setModel(detailModel, "details");
            this.detailDialog.open();
        }
    });
});

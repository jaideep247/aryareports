sap.ui.define([
    "sap/ui/base/Object",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Sorter"
], function (Object, MessageToast, MessageBox, Sorter) {
    "use strict";

    return Object.extend("aryasalesregister.controller.EventHandlers", {

        constructor: function (controller) {
            this.controller = controller;
        },

        onLoadData: function () {
            const controller = this.controller;
            const filterData = controller.getView().getModel("filterData").getData();
            if (!this._hasActiveFilters(filterData)) {
                MessageBox.confirm("No filters specified. This may load a large amount of data. Continue?", {
                    title: "Confirm Load",
                    onClose: (action) => {
                        if (action === MessageBox.Action.OK) {
                            this._loadDataAsync(false, 0);
                        }
                    }
                });
            } else {
                this._loadDataAsync(false, 0);
            }
        },

        _loadDataAsync: async function (isLoadMore, skip) {
            const controller = this.controller;
            console.log("📊 Starting Sales Data Load...");
            try {
                controller.uiHelper.setLoading(true, "Loading sales data...");
                controller.getView().getModel("ui").setProperty("/dataRequested", true);
                if (!isLoadMore) {
                    controller.getView().getModel("salesData").setData({ results: [], count: 0, totalCount: 0, totalAmount: 0 });
                }

                const filterData = controller.getView().getModel("filterData").getData();
                const odataResponse = await controller.salesDataService.loadSalesData(skip, filterData.pagingTop);

                if (!odataResponse || !Array.isArray(odataResponse.results)) {
                    throw new Error("Invalid data structure returned from the service.");
                }
                const processedData = await controller.dataProcessor._processLoadedData(odataResponse.results);
                this._finishDataLoad(processedData, isLoadMore, parseInt(odataResponse.__count, 10));
            } catch (error) {
                this._handleLoadError(error);
            }
        },

        onClearFilters: function () {
            const controller = this.controller;
            const filterData = controller.getView().getModel("filterData");
            const currentCapabilities = filterData.getProperty("/filterCapabilities");
            filterData.setData({
                billingDocument: "", salesOrder: "", billingDocumentType: "", pagingTop: 100,
                groupingMethod: "salesDocAndItems", autoRefresh: false,
                filterCapabilities: currentCapabilities
            });
            controller.getView().getModel("salesData").setData({ results: [], count: 0, totalCount: 0, totalAmount: 0 });
            controller.getView().getModel("ui").setData({ selectedCount: 0, selectedItems: [], dataRequested: false });
            MessageToast.show("All filters and data cleared");
        },

        onOpenColumnSettings: async function () {
            const controller = this.controller;
            if (!controller.columnSettingsDialog) {
                controller.columnSettingsDialog = await Fragment.load({
                    id: controller.getView().getId(),
                    name: "aryasalesregister.view.fragments.ColumnSettings",
                    controller: this
                });
                controller.getView().addDependent(controller.columnSettingsDialog);
            }
            controller.columnSettingsDialog.open();
        },

        onToggleColumn: function (oEvent) {
            const controller = this.controller;
            const menuItem = oEvent.getSource();
            const columnId = menuItem.getCustomData()[0].getValue();
            const column = controller.byId(columnId);
            const isVisible = column.getVisible();
            column.setVisible(!isVisible);
            menuItem.setIcon(isVisible ? "sap-icon://decline" : "sap-icon://accept");
        },

        onSalesOrderHelp: function (oEvent) {
            MessageToast.show("Value help for Sales Order - Coming soon!");
        },
        onBillingDocHelp: function (oEvent) {
            MessageToast.show("Value help for Billing Document - Coming soon!");
        },

        onTableSearch: function (oEvent) {
            const controller = this.controller;
            const query = oEvent.getParameter("query") || oEvent.getParameter("newValue");
            const table = controller.byId("salesTable");
            const binding = table.getBinding("items");
            if (binding) {
                const filters = [];
                if (query && query.length > 0) {
                    const searchFields = ["BillingDocument", "SalesDocument", "CustomerDisplay", "ProductDescription", "CustomerGSTIN"];
                    const orFilters = searchFields.map(field => new Filter(field, FilterOperator.Contains, query));
                    filters.push(new Filter({ filters: orFilters, and: false }));
                }
                binding.filter(filters);
            }
        },

        onSelectionChange: function (oEvent) {
            const controller = this.controller;
            const selectedItems = oEvent.getSource().getSelectedItems();
            const selectedCount = selectedItems.length;
            controller.getView().getModel("ui").setProperty("/selectedCount", selectedCount);
            controller.getView().getModel("ui").setProperty("/selectedItems", selectedItems.map(item => item.getBindingContext("salesData").getObject()));
        },

        onRowPress: function (oEvent) {
            const controller = this.controller;
            const bindingContext = oEvent.getSource().getBindingContext("salesData");
            if (bindingContext) {
                const record = bindingContext.getObject();
                controller.uiHelper.showDetailDialog(record);
            }
        },

        onLoadMoreData: function () {
            const controller = this.controller;
            const paginationData = controller.getView().getModel("pagination").getData();
            if (!paginationData.hasMore) {
                MessageToast.show("No more data to load");
                return;
            }
            this._loadDataAsync(true, paginationData.currentSkip);
        },

        _hasActiveFilters: function (filterData) {
            return !!(filterData.billingDocument?.trim() || filterData.salesOrder?.trim() || filterData.billingDocumentType?.trim());
        },

        _finishDataLoad: function (processedData, isLoadMore, totalCount) {
            const controller = this.controller;
            const totalAmount = processedData.filter(record => record.isSummary)
                .reduce((sum, record) => sum + controller.dataProcessor._parseAmount(record.InvoiceAmount), 0);
            const existingData = isLoadMore ? controller.getView().getModel("salesData").getProperty("/results") : [];
            const finalData = existingData.concat(processedData);
            controller.getView().getModel("salesData").setData({
                results: finalData, count: finalData.length, totalCount: totalCount,
                totalAmount: totalAmount, lastLoadTime: new Date().toISOString()
            });
            const hasMore = finalData.length < totalCount;
            controller.getView().getModel("pagination").setData({
                hasMore: hasMore, currentSkip: finalData.length,
                pageSize: controller.getView().getModel("filterData").getProperty("/pagingTop"),
                totalRecords: totalCount, loadedRecords: finalData.length
            });
            controller.uiHelper.setLoading(false);
            const message = isLoadMore ? `Loaded ${processedData.length} additional records` :
                `Successfully loaded ${finalData.length} records/groups`;
            MessageToast.show(message);
        },

        _handleLoadError: function (error) {
            const controller = this.controller;
            console.error("❌ Enhanced data load error:", error);
            controller.uiHelper.setLoading(false);
            MessageBox.error(`Data loading failed: ${error.message}\n\nPlease check your filters and try again.`);
        },

    });
});

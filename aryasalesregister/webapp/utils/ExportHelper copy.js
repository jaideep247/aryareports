sap.ui.define([
    "sap/ui/base/Object",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/export/Spreadsheet"
], function (Object, MessageToast, MessageBox, Spreadsheet) {
    "use strict";

    return Object.extend("aryasalesregister.controller.ExportHelper", {

        constructor: function (controller) {
            this.controller = controller;
        },

        onExportToExcel: function () {
            this.controller.uiHelper.setLoading(true, "Preparing all data for export...");
            this._performExportAllData();
        },
        
        onExportSelected: function () {
            const controller = this.controller;
            const selectedItems = controller.getView().getModel("ui").getProperty("/selectedItems");
            if (!selectedItems || selectedItems.length === 0) {
                MessageBox.warning("No records selected for export.");
                return;
            }
            this._performExport(selectedItems, "Selected_Sales_Data");
        },
        
        _performExportAllData: async function() {
            const controller = this.controller;
            try {
                const allDataResponse = await controller.salesDataService.loadAllData();
                if (!allDataResponse || !Array.isArray(allDataResponse.results) || allDataResponse.results.length === 0) {
                    MessageBox.warning("No data available to export.");
                    return;
                }

                const rawData = allDataResponse.results;
                const enhancedDataWithText = await controller.dataProcessor.loadAndMapSalesOrderText(rawData);
                const groupedData = controller.dataProcessor.groupBySalesDocumentAndItem(enhancedDataWithText);
                const exportData = this._createExportData(groupedData);

                const columns = this._createEnhancedExportColumns();
                const fileName = `All_Sales_Data_${new Date().toISOString().split("T")[0]}.xlsx`;

                const exportSettings = {
                    workbook: { columns: columns },
                    dataSource: exportData,
                    fileName: fileName,
                    worker: false
                };

                const spreadsheet = new Spreadsheet(exportSettings);
                await spreadsheet.build();
                MessageToast.show(`Exported ${exportData.length} records to ${fileName}`);

            } catch (error) {
                console.error("❌ Export failed:", error);
                MessageBox.error("Export failed: " + error.message);
            } finally {
                controller.uiHelper.setLoading(false);
            }
        },

        _performExport: function (dataToExport, filePrefix) {
            const controller = this.controller;
            const exportData = this._createExportData(dataToExport);
            const columns = this._createEnhancedExportColumns();
            const fileName = `${filePrefix}_${new Date().toISOString().split("T")[0]}.xlsx`;

            const exportSettings = {
                workbook: { columns: columns },
                dataSource: exportData,
                fileName: fileName,
                worker: false
            };

            const spreadsheet = new Spreadsheet(exportSettings);
            spreadsheet.build()
                .then(() => {
                    MessageToast.show(`Exported ${exportData.length} selected records to ${fileName}`);
                })
                .catch(error => {
                    MessageBox.error("Export failed: " + error.message);
                })
                .finally(() => {
                    spreadsheet.destroy();
                });
        },

        _createExportData: function (dataToExport) {
            const controller = this.controller;
            return dataToExport.map(record => {
                const row = {
                    "Invoice Date": controller.uiHelper.formatDate(record.BillingDocumentDate),
                    "Arya DTR Invoice No.": record.CustomerReference,
                    "SAP Invoice No.": record.BillingDocument,
                    "Contract ID/Trade ID": record.ZXT4,
                    "Customer Name(sold to)": record.CustomerDisplay,
                    "Customer State": record.CustomerState,
                    "Customer Name(ship to)": record.ShipToCustomerName,
                    "Customer GSTIN": record.CustomerGSTIN,
                    "Terms of Payment": record.TermsOfPayment,
                    "Sale Order No.": record.SalesDocument,
                    "Due Date": record.DueDate,
                    "Plant": record.Plant,
                    "Invoice Type": record.InvoiceType,
                    "Tax Code": record.TaxCode,
                    "Customer Code": record.CustomerNumber,
                    "Head Office Code": record.HeadOfficeCode,
                    "Customer Group-1": record.CustomerGroup1,
                    "Customer Group-2": record.CustomerGroup2,
                    "Customer Group-3": record.CustomerGroup3,
                    "Customer Group-4": record.CustomerGroup4,
                    "Customer Group-5": record.CustomerGroup5,
                    "Customer Type": record.CustomerType,
                    "Invoice Raised for the month": controller.uiHelper.formatDate(record.BillingDocumentDate).substring(0, controller.uiHelper.formatDate(record.BillingDocumentDate).lastIndexOf('/')),
                    "Sales Divison/Distribution Channel": record.SalesDivision,
                    "GL Code": record.GLCode,
                    "SAC/HSN Code": record.SAC_HSN_Code,
                    "Material Code": record.Product,
                    "Material Description": record.ProductDescription,
                    "PAN No.": record.PAN_No,
                    "TAN No.": record.TAN_No,
                    "Taxable Amount": record.TotalNetAmount,
                    "Discount": record.DRV1,
                    "Additional Charges": record.ZDV2,
                    "IGST": record.JOIG,
                    "CGST": record.JOCG,
                    "SGST": record.JOSG,
                    "Invoice Amount": record.InvoiceAmount,
                    "Profit Centre": record.ProfitCenter,
                    "Warehouse Code": record.ZXT1,
                    "Warehouse Name": record.ZXT6,
                    "Warehouse State": record.ZXT5,
                    "Warehouse Location": record.ZXT3,
                    "Cluster ID": record.ZXT7,
                    "Parent Invoice No.": record.ParentInvoiceNo,
                    "Parent Invoice Date": controller.uiHelper.formatDate(record.ParentInvoiceDate),
                    "E-invoice Status": record.IN_EDocEWbillStatus,
                    "Qty.": record.BillingQuantity,
                    "Rate/MT": record.PPR0,
                    "Delay Charges": record.ZDV4,
                    "E-way Bill No.": record.IN_EDocEInvcEWbillNmbr,
                    "E-way Bill Date": controller.uiHelper.formatDate(record.EWayBillDate),
                    "TCS": record.ZTCS
                };
                return row;
            });
        },

        _createEnhancedExportColumns: function () {
            return [
                { label: "Invoice Date", property: "Invoice Date", type: "date" },
                { label: "Arya DTR Invoice No.", property: "Arya DTR Invoice No.", type: "string" },
                { label: "SAP Invoice No.", property: "SAP Invoice No.", type: "string" },
                { label: "Contract ID/Trade ID", property: "Contract ID/Trade ID", type: "string" },
                { label: "Customer Name(sold to)", property: "Customer Name(sold to)", type: "string" },
                { label: "Customer State", property: "Customer State", type: "string" },
                { label: "Customer Name(ship to)", property: "Customer Name(ship to)", type: "string" },
                { label: "Customer GSTIN", property: "Customer GSTIN", type: "string" },
                { label: "Terms of Payment", property: "Terms of Payment", type: "string" },
                { label: "Sale Order No.", property: "Sale Order No.", type: "string" },
                { label: "Due Date", property: "Due Date", type: "date" },
                { label: "Plant", property: "Plant", type: "string" },
                { label: "Invoice Type", property: "Invoice Type", type: "string" },
                { label: "Tax Code", property: "Tax Code", type: "string" },
                { label: "Customer Code", property: "Customer Code", type: "string" },
                { label: "Head Office Code", property: "Head Office Code", type: "string" },
                { label: "Customer Group-1", property: "Customer Group-1", type: "string" },
                { label: "Customer Group-2", property: "Customer Group-2", type: "string" },
                { label: "Customer Group-3", property: "Customer Group-3", type: "string" },
                { label: "Customer Group-4", property: "Customer Group-4", type: "string" },
                { label: "Customer Group-5", property: "Customer Group-5", type: "string" },
                { label: "Customer Type", property: "Customer Type", type: "string" },
                { label: "Invoice Raised for the month", property: "Invoice Raised for the month", type: "string" },
                { label: "Sales Divison/Distribution Channel", property: "Sales Divison/Distribution Channel", type: "string" },
                { label: "GL Code", property: "GL Code", type: "string" },
                { label: "SAC/HSN Code", property: "SAC/HSN Code", type: "string" },
                { label: "Product", property: "Material Code", type: "string" },
                { label: "Material Description", property: "Material Description", type: "string" },
                { label: "PAN No.", property: "PAN No.", type: "string" },
                { label: "TAN No.", property: "TAN No.", type: "string" },
                { label: "Taxable Amount", property: "Taxable Amount", type: "number" },
                { label: "Discount", property: "Discount", type: "number" },
                { label: "Additional Charges", property: "Additional Charges", type: "number" },
                { label: "IGST", property: "IGST", type: "number" },
                { label: "CGST", property: "CGST", type: "number" },
                { label: "SGST", property: "SGST", type: "number" },
                { label: "Invoice Amount", property: "Invoice Amount", type: "number" },
                { label: "Profit Centre", property: "Profit Centre", type: "string" },
                { label: "Warehouse Code", property: "Warehouse Code", type: "string" },
                { label: "Warehouse Name", property: "Warehouse Name", type: "string" },
                { label: "Warehouse State", property: "Warehouse State", type: "string" },
                { label: "Warehouse Location", property: "Warehouse Location", type: "string" },
                { label: "Cluster ID", property: "Cluster ID", type: "string" },
                { label: "Parent Invoice No.", property: "Parent Invoice No.", type: "string" },
                { label: "Parent Invoice Date", property: "Parent Invoice Date", type: "date" },
                { label: "E-invoice Status", property: "E-invoice Status", type: "string" },
                { label: "Qty.", property: "Qty.", type: "number" },
                { label: "Rate/MT", property: "Rate/MT", type: "number" },
                { label: "Delay Charges", property: "Delay Charges", type: "number" },
                { label: "E-way Bill No.", property: "E-way Bill No.", type: "string" },
                { label: "E-way Bill Date", property: "E-way Bill Date", type: "date" },
                { label: "TCS", property: "TCS", type: "number" }
            ];
        }
    });
});

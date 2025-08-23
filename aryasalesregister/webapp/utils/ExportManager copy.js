sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/export/Spreadsheet",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (BaseObject, Spreadsheet, MessageToast, MessageBox) {
    "use strict";

    return BaseObject.extend("aryasalesregister.utils.ExportManager", {

        constructor: function (oController) {
            this._controller = oController;
        },

        exportToExcel: function (data, exportType) {
            try {
                const columns = this._createExportColumns(exportType);
                const fileName = this._generateFileName(exportType);
                const title = this._getExportTitle(exportType);

                const exportSettings = {
                    workbook: {
                        columns: columns,
                        context: {
                            title: title,
                            sheetName: this._getSheetName(exportType)
                        }
                    },
                    dataSource: data,
                    fileName: fileName
                };

                const spreadsheet = new Spreadsheet(exportSettings);
                spreadsheet.build().then(() => {
                    let message = "";
                    if (exportType === "complete") {
                        message = `Exported ${data.length} records with all ${columns.length} columns`;
                    } else if (exportType === "enhanced") {
                        message = `Exported ${data.length} records with enhanced format including sales order text (${columns.length} columns)`;
                    } else if (exportType === "comprehensive") {
                        message = `Exported ${data.length} records with comprehensive invoice format (${columns.length} columns)`;
                    } else if (exportType === "current_view") {
                        message = `Exported ${data.length} records from current view with all columns`;
                    } else {
                        message = `Exported ${data.length} records with ${columns.length} columns`;
                    }
                    MessageToast.show(message);
                }).catch((error) => {
                    MessageBox.error("Export failed: " + error.message);
                }).finally(() => {
                    spreadsheet.destroy();
                });
            } catch (error) {
                MessageBox.error("Export functionality not available: " + error.message);
            }
        },

        _createExportColumns: function (exportType) {
            if (exportType === "comprehensive") {
                return this._createComprehensiveInvoiceColumns();
            } else if (exportType === "enhanced") {
                return this._createEnhancedExportColumns();
            }
            return this._createStandardExportColumns();
        },

        _createComprehensiveInvoiceColumns: function () {
            return [
                // Invoice Details
                { label: "Invoice Date", property: "BillingDocumentDate", type: "date" },
                { label: "Arya DTR Invoice No.", property: "BillingDocument", type: "string" },
                { label: "SAP Invoice No.", property: "BillingDocument", type: "string" },
                { label: "Contract ID/Trade ID", property: "ZXT4", type: "string" },
                { label: "Customer Name(sold to)", property: "CustomerFullName_1", type: "string" },
                { label: "Customer State", property: "Region", type: "string" },
                { label: "Customer Name(ship to)", property: "CustomerFullName_1", type: "string" },
                { label: "Customer GSTIN", property: "BusinessPartnerName1", type: "string" },
                { label: "Terms of Payment", property: "CustomerPaymentTerms", type: "string" },
                { label: "Sale order No.", property: "SalesDocument", type: "string" },
                { label: "Due Date", property: "DueDate", type: "date" },
                { label: "Plant", property: "Plant", type: "string" },
                { label: "Invoice Type", property: "BillingDocumentType", type: "string" },
                { label: "Tax Code", property: "TaxCode", type: "string" },
                { label: "Customer Code", property: "PayerParty", type: "string" },
                { label: "Head Office Code", property: "HeadOfficeCode", type: "string" },
                { label: "Customer Group-1", property: "CustomerGroup1", type: "string" },
                { label: "Customer Group-2", property: "CustomerGroup2", type: "string" },
                { label: "Customer Group-3", property: "CustomerGroup3", type: "string" },
                { label: "Customer Group-4", property: "CustomerGroup4", type: "string" },
                { label: "Customer Group-5", property: "CustomerGroup5", type: "string" },
                { label: "Customer Type", property: "CustomerType", type: "string" },
                { label: "Invoice Raised for the month", property: "ZXT5", type: "string" },
                { label: "Sales Division/Distribution Channel", property: "Division", type: "string" },
                { label: "GL Code", property: "GLCode", type: "string" },
                { label: "SAC/HSN Code", property: "SACHSNCode", type: "string" },
                { label: "Product", property: "Material", type: "string" },
                { label: "Material Description", property: "ZXT6", type: "string" },
                { label: "PAN No.", property: "PANNo", type: "string" },
                { label: "TAN No.", property: "TANNo", type: "string" },
                { label: "Taxable Amount", property: "TotalNetAmount", type: "number" },
                { label: "Discount", property: "Discount", type: "number" },
                { label: "Additional Charges", property: "ZXT2", type: "number" },
                { label: "IGST", property: "JOIG", type: "number" },
                { label: "CGST", property: "JOCG", type: "number" },
                { label: "SGST", property: "JOSG", type: "number" },
                { label: "Invoice Amount", property: "InvoiceAmount", type: "number" },
                { label: "Profit Centre", property: "ProfitCenter", type: "string" },
                { label: "Warehouse Code", property: "ZXT1", type: "string" },
                { label: "Warehouse Name", property: "WarehouseName", type: "string" },
                { label: "Warehouse State", property: "WarehouseState", type: "string" },
                { label: "Warehouse Location", property: "ZXT3", type: "string" },
                { label: "Cluster ID", property: "ClusterID", type: "string" },
                { label: "Parent Invoice No.", property: "ParentInvoiceNo", type: "string" },
                { label: "Parent Invoice Date", property: "ParentInvoiceDate", type: "date" },
                { label: "E-invoice Status", property: "EInvoiceStatus", type: "string" },
                { label: "Qty.", property: "BillingQuantity", type: "number" },
                { label: "Rate/MT", property: "PPR0", type: "number" },
                { label: "Delay Charges", property: "ZDV4", type: "number" },
                { label: "E-way Bill No.", property: "EWayBillNo", type: "string" },
                { label: "E-way Bill Date", property: "EWayBillDate", type: "date" },
                { label: "TCS", property: "ZTCS", type: "number" }
            ];
        },

        _createEnhancedExportColumns: function () {
            return [
                // Basic Information
                { label: "Billing Document", property: "BillingDocument", type: "string" },
                { label: "Billing Date", property: "BillingDocumentDate", type: "date" },
                { label: "Document Type", property: "BillingDocumentType", type: "string" },
                { label: "Sales Document", property: "SalesDocument", type: "string" },
                { label: "Sales Document Item", property: "SalesDocumentItem", type: "string" },
                { label: "Product", property: "Material", type: "string" },
                { label: "Product", property: "Product", type: "string" },
                { label: "Billing Quantity", property: "BillingQuantity", type: "number" },
                { label: "Quantity Unit", property: "BillingQuantityUnit", type: "string" },
                
                // Financial Information
                { label: "Total Net Amount", property: "TotalNetAmount", type: "number" },
                { label: "Discount", property: "Discount", type: "number" },
                { label: "Invoice Amount", property: "InvoiceAmount", type: "number" },
                { label: "Transaction Currency", property: "TransactionCurrency", type: "string" },
                
                // Condition Types
                { label: "Rate/MT (PPR0)", property: "PPR0", type: "number" },
                { label: "IGST (JOIG)", property: "JOIG", type: "number" },
                { label: "CGST (JOCG)", property: "JOCG", type: "number" },
                { label: "SGST (JOSG)", property: "JOSG", type: "number" },
                { label: "Additional Charges (ZDV2)", property: "ZDV2", type: "number" },
                { label: "Delay Charges (ZDV4)", property: "ZDV4", type: "number" },
                { label: "TCS (ZTCS)", property: "ZTCS", type: "number" },
                
                // Customer Information
                { label: "Customer Name", property: "CustomerFullName_1", type: "string" },
                { label: "Business Partner", property: "BusinessPartnerName1", type: "string" },
                { label: "Payer Party", property: "PayerParty", type: "string" },
                { label: "Payment Terms", property: "CustomerPaymentTerms", type: "string" },
                
                // Location & Organization
                { label: "Region", property: "Region", type: "string" },
                { label: "Plant", property: "Plant", type: "string" },
                { label: "Division", property: "Division", type: "string" },
                { label: "Profit Center", property: "ProfitCenter", type: "string" },
                { label: "Tax Code", property: "TaxCode", type: "string" },
                
                // Sales Order Text Information
                { label: "Warehouse Code (ZXT1)", property: "ZXT1", type: "string" },
                { label: "Contract (ZXT4)", property: "ZXT4", type: "string" },
                { label: "Service Period (ZXT5)", property: "ZXT5", type: "string" },
                { label: "Material Description (ZXT6)", property: "ZXT6", type: "string" },
                { label: "Flag (ZXT7)", property: "ZXT7", type: "string" },
                { label: "Item Number (ZXT8)", property: "ZXT8", type: "string" },
                { label: "Warehouse Location (ZXT3)", property: "ZXT3", type: "string" },
                
                // Grouping Information
                { label: "Grouping Type", property: "GroupingType", type: "string" },
                { label: "Item Count", property: "ItemCount", type: "number" },
                { label: "Total Quantity Sum", property: "TotalQuantitySum", type: "number" },
                { label: "Total Net Amount Sum", property: "TotalNetAmountSum", type: "number" },
                { label: "Discount Sum", property: "DiscountSum", type: "number" }
            ];
        },

        _createStandardExportColumns: function () {
            return [
                { label: "Billing Document", property: "BillingDocument", type: "string" },
                { label: "Billing Date", property: "BillingDocumentDate", type: "date" },
                { label: "Document Type", property: "BillingDocumentType", type: "string" },
                { label: "Sales Document", property: "SalesDocument", type: "string" },
                { label: "Product", property: "Material", type: "string" },
                { label: "Product", property: "Product", type: "string" },
                { label: "Billing Quantity", property: "BillingQuantity", type: "number" },
                { label: "Quantity Unit", property: "BillingQuantityUnit", type: "string" },
                { label: "Total Net Amount", property: "TotalNetAmount", type: "number" },
                { label: "Discount", property: "Discount", type: "number" },
                { label: "PPR0 (Price)", property: "PPR0", type: "number" },
                { label: "DRV1 (Discount)", property: "DRV1", type: "number" },
                { label: "JTC1 (Tax)", property: "JTC1", type: "number" },
                { label: "JTC2 (Tax)", property: "JTC2", type: "number" },
                { label: "JTC3 (Tax)", property: "JTC3", type: "number" },
                { label: "DRD1 (Discount)", property: "DRD1", type: "number" },
                { label: "DCD1 (Discount)", property: "DCD1", type: "number" },
                { label: "PCIP (Commission)", property: "PCIP", type: "number" },
                { label: "JOIG (IGST)", property: "JOIG", type: "number" },
                { label: "JOCG (CGST)", property: "JOCG", type: "number" },
                { label: "JOSG (SGST)", property: "JOSG", type: "number" },
                { label: "ZTCS (TCS)", property: "ZTCS", type: "number" },
                { label: "ZDV2 (Additional Charges)", property: "ZDV2", type: "number" },
                { label: "ZDV4 (Delay Charges)", property: "ZDV4", type: "number" },
                { label: "Transaction Currency", property: "TransactionCurrency", type: "string" },
                { label: "Payer Party", property: "PayerParty", type: "string" },
                { label: "Customer Name", property: "CustomerFullName_1", type: "string" },
                { label: "Business Partner", property: "BusinessPartnerName1", type: "string" },
                { label: "Payment Terms", property: "CustomerPaymentTerms", type: "string" },
                { label: "Region", property: "Region", type: "string" },
                { label: "Plant", property: "Plant", type: "string" },
                { label: "Division", property: "Division", type: "string" },
                { label: "Profit Center", property: "ProfitCenter", type: "string" },
                { label: "Tax Code", property: "TaxCode", type: "string" },
                { label: "Item Count", property: "ItemCount", type: "number" },
                { label: "Sales Order Summary", property: "SalesOrderSummary", type: "string" }
            ];
        },

        _generateFileName: function (exportType) {
            const date = new Date().toISOString().split('T')[0];
            let typeText = "Standard";
            
            if (exportType === "complete") {
                typeText = "Complete";
            } else if (exportType === "enhanced") {
                typeText = "Enhanced";
            } else if (exportType === "comprehensive") {
                typeText = "ComprehensiveInvoice";
            } else if (exportType === "current_view") {
                typeText = "CurrentView";
            }
            
            return `Sales_Register_${typeText}_${date}.xlsx`;
        },

        _getExportTitle: function (exportType) {
            if (exportType === "complete") {
                return "Sales Register Report - Complete Data Export";
            } else if (exportType === "enhanced") {
                return "Sales Register Report - Enhanced Export (with Sales Order Text)";
            } else if (exportType === "comprehensive") {
                return "Sales Register Report - Comprehensive Invoice Format";
            } else if (exportType === "current_view") {
                return "Sales Register Report - Current View";
            }
            return "Sales Register Report - Standard Export";
        },

        _getSheetName: function (exportType) {
            if (exportType === "comprehensive") {
                return "Comprehensive Invoice";
            } else if (exportType === "enhanced") {
                return "Enhanced Sales Data";
            } else if (exportType === "complete") {
                return "Complete Sales Data";
            } else if (exportType === "current_view") {
                return "Current View";
            }
            return "Sales Data";
        }
    });
});
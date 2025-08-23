sap.ui.define([
    "sap/ui/base/Object",
    "sap/m/Dialog",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/Text",
    "sap/m/Title",
    "sap/m/Button",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Core",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel"
], function (BaseObject, Dialog, VBox, HBox, Label, Input, Text, Title, Button, MessageToast, MessageBox, Core, Fragment, JSONModel) {
    "use strict";

    const BUSINESS_COLUMN_MAPPING = {
        // Basic Invoice Information
        "BillingDocumentDate": "Invoice Date",
        "BillingDocument": "SAP Invoice No.",
        "InvoiceNumber": "Arya DTR Invoice No.",
        "ContractID": "Contract ID/Trade ID",
        "ZXT4": "Contract ID/Trade ID",

        // Customer Information
        "CustomerFullName_1": "Customer Name(sold to)",
        "Region": "Customer State",
        "ShipToCustomer": "Customer Name(ship to)",
        "CustomerGSTIN": "Customer GSTIN",
        "CustomerPaymentTerms": "Terms of Payment",
        "PayerParty": "Customer Code",

        // Sales Order Information
        "SalesDocument": "Sale order No.",
        "DueDate": "Due Date",
        "Plant": "Plant",
        "BillingDocumentType": "Invoice Type",
        "TaxCode": "Tax Code",

        // Customer Classification
        "HeadOfficeCode": "Head Office Code",
        "CustomerGroup1": "Customer Group-1",
        "CustomerGroup2": "Customer Group-2",
        "CustomerGroup3": "Customer Group-3",
        "CustomerGroup4": "Customer Group-4",
        "CustomerGroup5": "Customer Group-5",
        "CustomerType": "Customer Type",

        // Business Information
        "InvoiceMonth": "Invoice Raised for the month",
        "Division": "Sales Divison/Distribution Channel",
        "GLCode": "GL Code",
        "SACHSNCode": "SAC/HSN Code",

        // Material Information
        "Material": "Material Code",
        "MaterialDescription": "Material Description",
        "Product": "Material Description",
        "PANNo": "PAN No.",
        "TANNo": "TAN No.",

        // Financial Information
        "TotalNetAmount": "Taxable Amount",
        "Discount": "Discount",
        "ZDV2": "Additional Charges",
        "JOIG": "IGST",
        "JOCG": "CGST",
        "JOSG": "SGST",
        "InvoiceAmount": "Invoice Amount",
        "ProfitCenter": "Profit Centre",

        // Warehouse Information
        "ZXT1": "Warehouse Code",
        "WarehouseName": "Warehouse Name",
        "WarehouseState": "Warehouse State",
        "ZXT3": "Warehouse Location",
        "ClusterID": "Cluster ID",

        // Parent Invoice Information
        "ParentInvoiceNo": "Parent Invoice No.",
        "ParentInvoiceDate": "Parent Invoice Date",
        "EInvoiceStatus": "E-invoice Status",

        // Quantity and Rate
        "BillingQuantity": "Qty.",
        "PPR0": "Rate/MT",
        "ZDV4": "Delay Charges",

        // E-way Bill
        "EWayBillNo": "E-way Bill No.",
        "EWayBillDate": "E-way Bill Date",
        "ZTCS": "TCS"
    };

    return BaseObject.extend("aryasalesregister.utils.DialogManager", {

        constructor: function (oController) {
            this._controller = oController;
        },

        _addBusinessInformationSections: function (container, rowData) {
            // Invoice Header Section
            this._addBusinessSection(container, "📋 Invoice Information", [
                { field: "BillingDocumentDate", label: "Invoice Date", formatter: "date" },
                { field: "InvoiceNumber", label: "Arya DTR Invoice No." },
                { field: "BillingDocument", label: "SAP Invoice No." },
                { field: "ZXT4", label: "Contract ID/Trade ID" },
                { field: "BillingDocumentType", label: "Invoice Type" },
                { field: "InvoiceMonth", label: "Invoice Raised for the month", formatter: "month" },
                { field: "TaxCode", label: "Tax Code" }
            ], rowData);

            // Customer Information Section
            this._addBusinessSection(container, "👥 Customer Information", [
                { field: "CustomerFullName_1", label: "Customer Name(sold to)" },
                { field: "Region", label: "Customer State" },
                { field: "ShipToCustomer", label: "Customer Name(ship to)" },
                { field: "CustomerGSTIN", label: "Customer GSTIN" },
                { field: "CustomerPaymentTerms", label: "Terms of Payment" },
                { field: "PayerParty", label: "Customer Code" },
                { field: "HeadOfficeCode", label: "Head Office Code" },
                { field: "CustomerGroup1", label: "Customer Group-1" },
                { field: "CustomerGroup2", label: "Customer Group-2" },
                { field: "CustomerGroup3", label: "Customer Group-3" },
                { field: "CustomerGroup4", label: "Customer Group-4" },
                { field: "CustomerGroup5", label: "Customer Group-5" },
                { field: "CustomerType", label: "Customer Type" }
            ], rowData);

            // Sales Order Information Section
            this._addBusinessSection(container, "📦 Sales Order Information", [
                { field: "SalesDocument", label: "Sale order No." },
                { field: "DueDate", label: "Due Date", formatter: "date" },
                { field: "Plant", label: "Plant" },
                { field: "Division", label: "Sales Divison/Distribution Channel" },
                { field: "ProfitCenter", label: "Profit Centre" },
                { field: "GLCode", label: "GL Code" }
            ], rowData);

            // Material Information Section
            this._addBusinessSection(container, "🛍️ Material Information", [
                { field: "Material", label: "Material Code" },
                { field: "Product", label: "Material Description" },
                { field: "MaterialDescription", label: "Material Description" },
                { field: "SACHSNCode", label: "SAC/HSN Code" },
                { field: "BillingQuantity", label: "Qty.", formatter: "quantity" },
                { field: "PPR0", label: "Rate/MT", formatter: "currency" }
            ], rowData);

            // Financial Information Section
            this._addBusinessSection(container, "💰 Financial Information", [
                { field: "TotalNetAmount", label: "Taxable Amount", formatter: "currency" },
                { field: "Discount", label: "Discount", formatter: "currency" },
                { field: "ZDV2", label: "Additional Charges", formatter: "currency" },
                { field: "JOIG", label: "IGST", formatter: "currency" },
                { field: "JOCG", label: "CGST", formatter: "currency" },
                { field: "JOSG", label: "SGST", formatter: "currency" },
                { field: "ZDV4", label: "Delay Charges", formatter: "currency" },
                { field: "ZTCS", label: "TCS", formatter: "currency" },
                { field: "InvoiceAmount", label: "Invoice Amount", formatter: "currency" }
            ], rowData);

            // Warehouse Information Section
            this._addBusinessSection(container, "🏭 Warehouse Information", [
                { field: "ZXT1", label: "Warehouse Code" },
                { field: "WarehouseName", label: "Warehouse Name" },
                { field: "WarehouseState", label: "Warehouse State" },
                { field: "ZXT3", label: "Warehouse Location" },
                { field: "ClusterID", label: "Cluster ID" }
            ], rowData);

            // Compliance Information Section
            this._addBusinessSection(container, "📄 Compliance Information", [
                { field: "PANNo", label: "PAN No." },
                { field: "TANNo", label: "TAN No." },
                { field: "ParentInvoiceNo", label: "Parent Invoice No." },
                { field: "ParentInvoiceDate", label: "Parent Invoice Date", formatter: "date" },
                { field: "EInvoiceStatus", label: "E-invoice Status" },
                { field: "EWayBillNo", label: "E-way Bill No." },
                { field: "EWayBillDate", label: "E-way Bill Date", formatter: "date" }
            ], rowData);
        },

        _addBusinessSection: function (container, sectionTitle, fields, rowData) {
            // Add section title
            container.addItem(new Title({
                text: sectionTitle,
                level: "H3"
            }));

            // Filter fields that have values and create items
            const items = fields.map(fieldConfig => {
                let value = rowData[fieldConfig.field];

                // Apply formatter if specified
                if (fieldConfig.formatter && value) {
                    value = this._formatBusinessValue(value, fieldConfig.formatter, rowData);
                }

                // Special handling for calculated fields
                if (fieldConfig.field === "InvoiceMonth" && rowData.BillingDocumentDate) {
                    value = this._extractMonthYear(rowData.BillingDocumentDate);
                } else if (fieldConfig.field === "DueDate" && rowData.BillingDocumentDate && rowData.CustomerPaymentTerms) {
                    value = this._calculateDueDate(rowData.BillingDocumentDate, rowData.CustomerPaymentTerms);
                }

                return value ? this._createBusinessInfoItem(fieldConfig.label, value) : null;
            }).filter(item => item !== null);

            // Add items to container if any exist
            if (items.length > 0) {
                const sectionContainer = new VBox({ items: items });
                container.addItem(sectionContainer);
            }
        },

        _createBusinessInfoItem: function (label, value) {
            if (!value || value === "null" || value === "undefined" || value === "") {
                return null;
            }

            return new HBox({
                alignItems: "Start",
                items: [
                    new Label({
                        text: label + ":",
                        width: "250px"
                    }),
                    new Text({
                        text: String(value),
                        wrapping: true
                    })
                ]
            });
        },

        _formatBusinessValue: function (value, formatter, rowData) {
            if (!value && value !== 0) return "";

            switch (formatter) {
                case "currency":
                    const currency = rowData.TransactionCurrency || "INR";
                    return `${this._formatNumber(value)} ${currency}`;
                case "quantity":
                    const unit = rowData.BillingQuantityUnit || "";
                    return `${this._formatNumber(value)} ${unit}`.trim();
                case "date":
                    return this._formatSAPDate(value);
                case "month":
                    return this._extractMonthYear(value);
                default:
                    return String(value);
            }
        },

        _extractMonthYear: function (sapDate) {
            if (!sapDate) return "";

            try {
                let date;
                if (typeof sapDate === 'string' && sapDate.includes('/Date(')) {
                    const timestamp = sapDate.match(/\d+/)[0];
                    date = new Date(parseInt(timestamp));
                } else if (sapDate instanceof Date) {
                    date = sapDate;
                } else {
                    date = new Date(sapDate);
                }

                const monthNames = ["January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"];
                return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
            } catch (e) {
                return String(sapDate);
            }
        },

        _calculateDueDate: function (invoiceDate, paymentTerms) {
            if (!invoiceDate || !paymentTerms) return "";

            try {
                let date;
                if (typeof invoiceDate === 'string' && invoiceDate.includes('/Date(')) {
                    const timestamp = invoiceDate.match(/\d+/)[0];
                    date = new Date(parseInt(timestamp));
                } else {
                    date = new Date(invoiceDate);
                }

                // Extract days from payment terms (assuming format like "30 days" or just "30")
                const daysMatch = paymentTerms.match(/\d+/);
                if (daysMatch) {
                    const days = parseInt(daysMatch[0]);
                    date.setDate(date.getDate() + days);
                    return date.toLocaleDateString();
                }

                return "";
            } catch (e) {
                return "";
            }
        },

        showBillingDocumentSearchDialog: function () {
            if (!this._oBillingDocSearchDialog) {
                this._oBillingDocSearchDialog = new Dialog({
                    title: "Search Exact Billing Document",
                    type: "Message",
                    content: [
                        new VBox({
                            items: [
                                new Label({ text: "Billing Document Number:" }),
                                new Input({
                                    id: "exactSearchBillingDoc",
                                    placeholder: "e.g., 90000003",
                                    maxLength: 12,
                                    width: "250px"
                                }).addStyleClass("sapUiSmallMarginTop"),
                                new Text({
                                    text: "Enter the exact billing document number to search for"
                                }).addStyleClass("sapUiMediumMarginTop")
                            ]
                        }).addStyleClass("sapUiMediumMargin")
                    ],
                    buttons: [
                        new Button({
                            text: "Search",
                            type: "Emphasized",
                            press: this._performExactBillingDocSearch.bind(this)
                        }),
                        new Button({
                            text: "Cancel",
                            press: () => this._oBillingDocSearchDialog.close()
                        })
                    ]
                });
                this._controller.getView().addDependent(this._oBillingDocSearchDialog);
            }
            this._oBillingDocSearchDialog.open();
        },

        _destroyExistingDialog: function () {
            if (this._oRowDetailsDialog) {
                try {
                    if (typeof this._oRowDetailsDialog.destroy === 'function') {
                        this._oRowDetailsDialog.destroy();
                    }
                } catch (e) {
                    console.warn("Warning cleaning up existing dialog:", e);
                }
                this._oRowDetailsDialog = null;
            }
        },

        _loadFragmentDialog: function (detailsData) {
            console.log("📋 Attempting to load fragment dialog...");

            Fragment.load({
                id: this._controller.getView().getId(),
                name: "aryasalesregister.view.DetailsDialogFragment",
                controller: this._controller
            }).then(function (oDialog) {
                console.log("✅ Fragment loaded successfully");

                this._oRowDetailsDialog = oDialog;
                this._controller.getView().addDependent(oDialog);

                if (!oDialog.getButtons() || oDialog.getButtons().length === 1) {
                    oDialog.addButton(new Button({
                        text: "Export This Row",
                        icon: "sap-icon://excel-attachment",
                        press: this._exportSingleRow.bind(this),
                        type: "Ghost"
                    }));

                    oDialog.addButton(new Button({
                        text: "Copy to Clipboard",
                        icon: "sap-icon://copy",
                        press: this._copyRowToClipboard.bind(this),
                        type: "Ghost"
                    }));
                }

                this._openFragmentDialog(oDialog, detailsData);

            }.bind(this)).catch(function (oError) {
                console.error("❌ Failed to load fragment:", oError);
                console.log("🔄 Creating fallback dialog...");
                this._createAndOpenFallbackDialog(detailsData);
            }.bind(this));
        },

        _openFragmentDialog: function (oDialog, detailsData) {
            try {
                const oDetailsModel = new JSONModel(detailsData);
                oDialog.setModel(oDetailsModel, "details");
                oDialog.setTitle(`Record Details: ${detailsData.BillingDocument || 'N/A'}`);
                oDialog.open();
                console.log("✅ Fragment details dialog opened successfully");
            } catch (error) {
                console.error("❌ Error opening fragment dialog:", error);
                this._createAndOpenFallbackDialog(detailsData);
            }
        },

        showSalesOrderDetailsDialog: function (rowData) {
            const sSalesOrder = rowData.PrimarySalesOrder || rowData.SalesDocument;
            const sSalesOrderItem = rowData.SalesDocumentItem || rowData.Item || rowData.SalesOrderItem;

            if (!sSalesOrder || sSalesOrder === 'NO_SALES_ORDER') {
                MessageToast.show("No valid sales order available for this record");
                return;
            }

            if (!sSalesOrderItem) {
                MessageToast.show("No valid sales order item available for this record");
                return;
            }

            this._controller._setLoading(true, `Fetching S4HANA Cloud data for Sales Order ${sSalesOrder} Item ${sSalesOrderItem}...`);

            this._controller._salesOrderTextService.fetchItemText(sSalesOrder, sSalesOrderItem)
                .then((textData) => {
                    this._controller._setLoading(false);
                    this._showEnhancedSalesOrderDetailsDialog(sSalesOrder, textData, null, rowData);
                })
                .catch((error) => {
                    this._controller._setLoading(false);
                    console.error("Error fetching sales order item details:", error);
                    MessageBox.error(`Failed to fetch sales order item details: ${error.message}`);
                });
        },

        _performExactBillingDocSearch: function () {
            const sBillingDoc = Core.byId("exactSearchBillingDoc").getValue().trim();
            if (!sBillingDoc) {
                MessageBox.error("Please enter a billing document number");
                return;
            }

            // Close the dialog first
            this._oBillingDocSearchDialog.close();

            // ✅ FIXED: Call the controller's exact search method
            if (this._controller.performExactBillingDocumentSearch) {
                this._controller.performExactBillingDocumentSearch(sBillingDoc);
            } else {
                // Fallback to the old method but without clearing all filters
                const oFilterModel = this._controller.getView().getModel("filterData");
                oFilterModel.setProperty("/billingDocument", sBillingDoc);

                MessageToast.show(`Searching for billing document: ${sBillingDoc}`);
                this._controller._loadSalesData(false, 0);
            }
        },
        _showRowDetailsWithFragment: function (rowData) {
            this._currentRowData = rowData;
            const detailsModel = new JSONModel({
                details: rowData
            });
            this._oRowDetailsDialog.setModel(detailsModel, "details");
            this._oRowDetailsDialog.setTitle(`Record Details: ${rowData.BillingDocument || 'N/A'}`);
            this._oRowDetailsDialog.open();
        },

        _createFallbackDialog: function (rowData) {
            this._oRowDetailsDialog = new Dialog({
                title: "Complete Row Details",
                contentWidth: "80%",
                contentHeight: "80%",
                verticalScrolling: true,
                horizontalScrolling: false,
                resizable: true,
                draggable: true,
                content: [
                    new VBox({
                        id: "rowDetailsContainer",
                        class: "sapUiMediumMargin"
                    })
                ],
                buttons: [
                    new Button({
                        text: "Export This Row",
                        icon: "sap-icon://excel-attachment",
                        press: this._exportSingleRow.bind(this),
                        type: "Ghost"
                    }),
                    new Button({
                        text: "Copy to Clipboard",
                        icon: "sap-icon://copy",
                        press: this._copyRowToClipboard.bind(this),
                        type: "Ghost"
                    }),
                    new Button({
                        text: "Close",
                        press: () => this._oRowDetailsDialog.close(),
                        type: "Emphasized"
                    })
                ]
            });
            this._controller.getView().addDependent(this._oRowDetailsDialog);

            this._currentRowData = rowData;
            this._populateRowDetailsContent(rowData);
            this._oRowDetailsDialog.open();
        },

        showRowDetailsDialog: function (rowData) {
            console.log("📋 Opening row details dialog from DialogManager");

            try {
                if (!rowData) {
                    console.warn("⚠️ No row data provided for details view");
                    MessageToast.show("Unable to load record details");
                    return;
                }

                console.log("📋 Record data for details:", rowData);
                console.log("📋 Available data fields:", Object.keys(rowData));

                const detailsData = {
                    ...rowData,
                    InvoiceAmount: rowData.InvoiceAmount || (parseFloat(rowData.TotalNetAmount || 0)).toFixed(2),
                    PPR0: rowData.PPR0 || "0.00",
                    DRV1: rowData.DRV1 || "0.00",
                    ZDV2: rowData.ZDV2 || "0.00",
                    JOIG: rowData.JOIG || "0.00",
                    JOCG: rowData.JOCG || "0.00",
                    JOSG: rowData.JOSG || "0.00",
                    ZDV4: rowData.ZDV4 || "0.00",
                    ZTCS: rowData.ZTCS || "0.00",
                    ZXT1: rowData.ZXT1 || null,
                    ZXT3: rowData.ZXT3 || null,
                    ZXT4: rowData.ZXT4 || null,
                    ZXT5: rowData.ZXT5 || null,
                    ZXT6: rowData.ZXT6 || null,
                    ZXT7: rowData.ZXT7 || null,
                    ZXT8: rowData.ZXT8 || null
                };

                this._currentRowData = detailsData;
                this._destroyExistingDialog();
                this._loadFragmentDialog(detailsData);

            } catch (error) {
                console.error("❌ Error opening details dialog:", error);
                MessageToast.show("Error loading record details: " + error.message);
            }
        },

        _createAndOpenFallbackDialog: function (detailsData) {
            console.log("🔧 Creating fallback programmatic dialog");

            try {
                const uniqueId = "rowDetailsContainer_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

                this._oRowDetailsDialog = new Dialog({
                    title: `Record Details: ${detailsData.BillingDocument || 'N/A'}`,
                    contentWidth: "900px",
                    contentHeight: "700px",
                    verticalScrolling: true,
                    horizontalScrolling: false,
                    resizable: true,
                    draggable: true,
                    content: [
                        new VBox({
                            id: uniqueId
                        })
                    ],
                    buttons: [
                        new Button({
                            text: "Export This Row",
                            icon: "sap-icon://excel-attachment",
                            press: this._exportSingleRow.bind(this),
                            type: "Ghost"
                        }),
                        new Button({
                            text: "Copy to Clipboard",
                            icon: "sap-icon://copy",
                            press: this._copyRowToClipboard.bind(this),
                            type: "Ghost"
                        }),
                        new Button({
                            text: "Close",
                            press: function () {
                                this._oRowDetailsDialog.close();
                            }.bind(this),
                            type: "Emphasized"
                        })
                    ]
                });

                this._controller.getView().addDependent(this._oRowDetailsDialog);
                this._populateFallbackContent(detailsData, uniqueId);
                this._oRowDetailsDialog.open();
                console.log("✅ Fallback dialog created and opened successfully");

            } catch (error) {
                console.error("❌ Error creating fallback dialog:", error);
                MessageToast.show("Unable to create details dialog: " + error.message);
            }
        },

        _populateFallbackContent: function (rowData, containerId) {
            console.log("📋 Populating fallback content for container:", containerId);
            console.log("📋 Data keys available:", Object.keys(rowData));

            try {
                const container = sap.ui.getCore().byId(containerId);
                if (!container) {
                    console.error("❌ Container not found:", containerId);
                    return;
                }

                container.destroyItems();
                this._addBusinessInformationSections(container, rowData);
                console.log("✅ Fallback content populated successfully");

            } catch (error) {
                console.error("❌ Error populating fallback content:", error);
            }
        },

        _addGeneralInformation: function (container, rowData) {
            container.addItem(new Title({
                text: "📋 Invoice Information",
                level: "H3"
            }));

            const generalInfo = new VBox({
                items: [
                    this._createInfoItem("Invoice Date:", this._formatSAPDate(rowData.BillingDocumentDate)),
                    this._createInfoItem("Arya DTR Invoice No.:", rowData.InvoiceNumber),
                    this._createInfoItem("SAP Invoice No.:", rowData.BillingDocument),
                    this._createInfoItem("Contract ID/Trade ID:", rowData.ZXT4),
                    this._createInfoItem("Invoice Type:", rowData.BillingDocumentType),
                    this._createInfoItem("Tax Code:", rowData.TaxCode)
                ].filter(item => item !== null)
            });

            container.addItem(generalInfo);
        },

        _addQuantityInformation: function (container, rowData) {
            container.addItem(new Title({
                text: "📦 Quantity Information",
                level: "H3"
            }));

            const quantityInfo = new VBox({
                items: [
                    this._createInfoItem("Qty.:", `${this._formatNumber(rowData.BillingQuantity)} ${rowData.BillingQuantityUnit || ''}`),
                    this._createInfoItem("Rate/MT:", `${this._formatNumber(rowData.PPR0)} ${rowData.TransactionCurrency || 'INR'}`)
                ].filter(item => item !== null)
            });

            container.addItem(quantityInfo);
        },

        _addFinancialInformation: function (container, rowData) {
            container.addItem(new Title({
                text: "💰 Financial Information",
                level: "H3"
            }));

            const currency = rowData.TransactionCurrency || "INR";

            const financialInfo = new VBox({
                items: [
                    this._createInfoItem("Taxable Amount:", `${this._formatNumber(rowData.TotalNetAmount)} ${currency}`),
                    this._createInfoItem("Discount:", `${this._formatNumber(rowData.Discount)} ${currency}`),
                    this._createInfoItem("Additional Charges:", `${this._formatNumber(rowData.ZDV2)} ${currency}`),
                    this._createInfoItem("IGST:", `${this._formatNumber(rowData.JOIG)} ${currency}`),
                    this._createInfoItem("CGST:", `${this._formatNumber(rowData.JOCG)} ${currency}`),
                    this._createInfoItem("SGST:", `${this._formatNumber(rowData.JOSG)} ${currency}`),
                    this._createInfoItem("Delay Charges:", `${this._formatNumber(rowData.ZDV4)} ${currency}`),
                    this._createInfoItem("TCS:", `${this._formatNumber(rowData.ZTCS)} ${currency}`),
                    this._createInfoItem("Invoice Amount:", `${this._formatNumber(rowData.InvoiceAmount)} ${currency}`)
                ].filter(item => item !== null)
            });

            container.addItem(financialInfo);
        },

        _addConditionTypesInformation: function (container, rowData) {
            // This method is kept for backward compatibility but content is now in _addFinancialInformation
        },

        _addSalesOrderTextInformation: function (container, rowData) {
            const hasZXTData = rowData.ZXT1 || rowData.ZXT3 || rowData.ZXT4 || rowData.ZXT5 || rowData.ZXT6 || rowData.ZXT7 || rowData.ZXT8;

            if (hasZXTData) {
                container.addItem(new Title({
                    text: "🏭 Warehouse Information",
                    level: "H3"
                }));

                const warehouseInfo = new VBox({
                    items: [
                        this._createInfoItem("Warehouse Code:", rowData.ZXT1),
                        this._createInfoItem("Warehouse Name:", rowData.WarehouseName),
                        this._createInfoItem("Warehouse State:", rowData.WarehouseState),
                        this._createInfoItem("Warehouse Location:", rowData.ZXT3),
                        this._createInfoItem("Cluster ID:", rowData.ClusterID)
                    ].filter(item => item !== null)
                });

                container.addItem(warehouseInfo);
            }
        },

        _addLocationInformation: function (container, rowData) {
            container.addItem(new Title({
                text: "👥 Customer Information",
                level: "H3"
            }));

            const customerInfo = new VBox({
                items: [
                    this._createInfoItem("Customer Name(sold to):", rowData.CustomerFullName_1),
                    this._createInfoItem("Customer State:", rowData.Region),
                    this._createInfoItem("Customer Name(ship to):", rowData.ShipToCustomer),
                    this._createInfoItem("Customer GSTIN:", rowData.CustomerGSTIN),
                    this._createInfoItem("Terms of Payment:", rowData.CustomerPaymentTerms),
                    this._createInfoItem("Customer Code:", rowData.PayerParty),
                    this._createInfoItem("Head Office Code:", rowData.HeadOfficeCode),
                    this._createInfoItem("Customer Group-1:", rowData.CustomerGroup1),
                    this._createInfoItem("Customer Group-2:", rowData.CustomerGroup2),
                    this._createInfoItem("Customer Group-3:", rowData.CustomerGroup3),
                    this._createInfoItem("Customer Group-4:", rowData.CustomerGroup4),
                    this._createInfoItem("Customer Group-5:", rowData.CustomerGroup5),
                    this._createInfoItem("Customer Type:", rowData.CustomerType)
                ].filter(item => item !== null)
            });

            container.addItem(customerInfo);

            // Sales Order Information
            container.addItem(new Title({
                text: "📦 Sales Order Information",
                level: "H3"
            }));

            const salesOrderInfo = new VBox({
                items: [
                    this._createInfoItem("Sale order No.:", rowData.SalesDocument),
                    this._createInfoItem("Due Date:", this._formatSAPDate(rowData.DueDate)),
                    this._createInfoItem("Plant:", rowData.Plant),
                    this._createInfoItem("Sales Divison/Distribution Channel:", rowData.Division),
                    this._createInfoItem("Profit Centre:", rowData.ProfitCenter),
                    this._createInfoItem("GL Code:", rowData.GLCode)
                ].filter(item => item !== null)
            });

            container.addItem(salesOrderInfo);

            // Material Information
            container.addItem(new Title({
                text: "🛍️ Material Information",
                level: "H3"
            }));

            const materialInfo = new VBox({
                items: [
                    this._createInfoItem("Material Code:", rowData.Material),
                    this._createInfoItem("Material Description:", rowData.Product || rowData.MaterialDescription),
                    this._createInfoItem("SAC/HSN Code:", rowData.SACHSNCode)
                ].filter(item => item !== null)
            });

            container.addItem(materialInfo);

            // Compliance Information
            container.addItem(new Title({
                text: "📄 Compliance Information",
                level: "H3"
            }));

            const complianceInfo = new VBox({
                items: [
                    this._createInfoItem("PAN No.:", rowData.PANNo),
                    this._createInfoItem("TAN No.:", rowData.TANNo),
                    this._createInfoItem("Parent Invoice No.:", rowData.ParentInvoiceNo),
                    this._createInfoItem("Parent Invoice Date:", this._formatSAPDate(rowData.ParentInvoiceDate)),
                    this._createInfoItem("E-invoice Status:", rowData.EInvoiceStatus),
                    this._createInfoItem("E-way Bill No.:", rowData.EWayBillNo),
                    this._createInfoItem("E-way Bill Date:", this._formatSAPDate(rowData.EWayBillDate))
                ].filter(item => item !== null)
            });

            container.addItem(complianceInfo);
        },

        // Helper methods
        _formatSAPDate: function (sapDate) {
            if (!sapDate) return "Not specified";

            if (typeof sapDate === 'string' && sapDate.includes('/Date(')) {
                const timestamp = sapDate.match(/\d+/)[0];
                const date = new Date(parseInt(timestamp));
                return date.toLocaleDateString();
            }

            if (sapDate instanceof Date) {
                return sapDate.toLocaleDateString();
            }

            return String(sapDate);
        },

        _formatNumber: function (value) {
            if (!value && value !== 0) return "0.00";
            const num = parseFloat(value);
            if (isNaN(num)) return "0.00";
            return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        },

        _createInfoItem: function (label, value) {
            if (!value || value === "null" || value === "undefined" || value === "") {
                return null;
            }

            return new HBox({
                alignItems: "Start",
                items: [
                    new Label({
                        text: label,
                        width: "250px"
                    }),
                    new Text({
                        text: String(value),
                        wrapping: true
                    })
                ]
            });
        },

        closeRowDetailsDialog: function () {
            if (this._oRowDetailsDialog && typeof this._oRowDetailsDialog.close === 'function') {
                this._oRowDetailsDialog.close();
            }
        },

        _populateRowDetailsContent: function (rowData) {
            const container = Core.byId("rowDetailsContainer");
            if (!container) return;

            container.destroyItems();
            this._addBusinessInformationSections(container, rowData);
        },

        _showEnhancedSalesOrderDetailsDialog: function (sSalesOrder, oTextData, oBasicInfo, oRowData) {
            if (!this._oEnhancedSalesOrderDialog) {
                this._oEnhancedSalesOrderDialog = new Dialog({
                    title: "S4HANA Cloud Sales Order Details",
                    contentWidth: "700px",
                    contentHeight: "600px",
                    verticalScrolling: true,
                    resizable: true,
                    draggable: true,
                    content: [
                        new VBox({
                            id: "enhancedSalesOrderDetailsContainer",
                            class: "sapUiMediumMargin"
                        })
                    ],
                    buttons: [
                        new Button({
                            text: "Test API Connection",
                            icon: "sap-icon://connected",
                            press: this._controller.onTestSalesOrderConnection.bind(this._controller),
                            type: "Ghost"
                        }),
                        new Button({
                            text: "Refresh Data",
                            icon: "sap-icon://refresh",
                            press: () => {
                                this.showSalesOrderDetailsDialog(oRowData);
                            },
                            type: "Ghost"
                        }),
                        new Button({
                            text: "Close",
                            press: () => this._oEnhancedSalesOrderDialog.close(),
                            type: "Emphasized"
                        })
                    ]
                });
                this._controller.getView().addDependent(this._oEnhancedSalesOrderDialog);
            }

            this._populateEnhancedSalesOrderContent(sSalesOrder, oTextData, oBasicInfo, oRowData);
            this._oEnhancedSalesOrderDialog.open();
        },

        _fetchSalesOrderBasicInfo: function (sSalesOrder) {
            return new Promise((resolve, reject) => {
                const oSalesOrderModel = this._controller.getView().getModel("salesOrder");
                if (!oSalesOrderModel) {
                    resolve(null);
                    return;
                }

                const sPath = `/A_SalesOrder('${sSalesOrder}')`;
                const mParameters = {
                    $select: "SalesOrder,SalesOrderType,SoldToParty,CreationDate,RequestedDeliveryDate,TotalNetAmount,TransactionCurrency"
                };

                oSalesOrderModel.read(sPath, {
                    urlParameters: mParameters,
                    success: (data) => {
                        console.log("✅ Sales Order basic info fetched:", data);
                        resolve(data);
                    },
                    error: (error) => {
                        console.warn("⚠️ Could not fetch sales order basic info:", error);
                        resolve(null);
                    }
                });
            });
        },

        _populateEnhancedSalesOrderContent: function (sSalesOrder, oTextData, oBasicInfo, oRowData) {
            const oContainer = Core.byId("enhancedSalesOrderDetailsContainer");
            if (!oContainer) return;

            oContainer.destroyItems();

            // Header with Sales Order info
            oContainer.addItem(new Title({
                text: `📋 S4HANA Cloud Sales Order: ${sSalesOrder}`,
                level: "H2",
                class: "sapUiMediumMarginBottom"
            }));

            // API Connection Status
            const sConnectionStatus = oTextData.error ? "❌ Connection Issues" : "✅ Connected";
            oContainer.addItem(new Text({
                text: `API Status: ${sConnectionStatus}`,
                class: "sapUiSmallMarginBottom"
            }));

            // S4HANA Basic Information (if available)
            if (oBasicInfo) {
                oContainer.addItem(new Title({
                    text: "🏢 S4HANA Cloud Sales Order Information",
                    level: "H3",
                    class: "sapUiMediumMarginTop sapUiSmallMarginBottom"
                }));

                const basicInfoFields = [
                    { label: "Sales Order Type", value: oBasicInfo.SalesOrderType },
                    { label: "Sold-To Party", value: oBasicInfo.SoldToParty },
                    { label: "Creation Date", value: oBasicInfo.CreationDate },
                    { label: "Requested Delivery Date", value: oBasicInfo.RequestedDeliveryDate },
                    { label: "Total Net Amount", value: `${oBasicInfo.TotalNetAmount || 'N/A'} ${oBasicInfo.TransactionCurrency || ''}` }
                ];

                basicInfoFields.forEach(field => {
                    if (field.value) {
                        oContainer.addItem(new HBox({
                            alignItems: "Start",
                            class: "sapUiTinyMarginBottom",
                            items: [
                                new Label({
                                    text: field.label + ":",
                                    width: "200px"
                                }),
                                new Text({
                                    text: field.value,
                                    wrapping: true
                                })
                            ]
                        }));
                    }
                });
            }

            // Sales Order Text Information
            oContainer.addItem(new Title({
                text: "📝 Sales Order Text Information",
                level: "H3",
                class: "sapUiMediumMarginTop sapUiSmallMarginBottom"
            }));

            if (oTextData.description && oTextData.description !== sSalesOrder) {
                oContainer.addItem(new Label({
                    text: "Description:",
                    class: "sapUiSmallMarginBottom"
                }));
                oContainer.addItem(new Text({
                    text: oTextData.description,
                    class: "sapUiMediumMarginBottom",
                    wrapping: true
                }));
            } else {
                oContainer.addItem(new Text({
                    text: "No text description available for this Sales Order",
                    class: "sapUiMediumMarginBottom",
                    wrapping: true
                }));
            }

            // Technical Information
            this._addTechnicalInfo(oContainer, sSalesOrder, oTextData);

            // Local Register Data
            this._addLocalRegisterData(oContainer, oRowData);
        },

        _addTechnicalInfo: function (oContainer, sSalesOrder, oTextData) {
            oContainer.addItem(new Title({
                text: "🔧 Technical Information",
                level: "H3",
                class: "sapUiMediumMarginTop sapUiSmallMarginBottom"
            }));

            const technicalInfo = [
                { label: "API URL Pattern", value: `A_SalesOrder('${sSalesOrder}')/to_Text` },
                { label: "Text Code Used", value: oTextData.textCode || 'No text found' },
                { label: "Text Lines Count", value: oTextData.textLines ? oTextData.textLines.length.toString() : '0' },
                { label: "Total Text Count", value: oTextData.totalCount ? oTextData.totalCount.toString() : 'Unknown' }
            ];

            if (oTextData.error) {
                technicalInfo.push({ label: "Error", value: oTextData.error });
            }

            technicalInfo.forEach(info => {
                oContainer.addItem(new HBox({
                    alignItems: "Start",
                    class: "sapUiTinyMarginBottom",
                    items: [
                        new Label({
                            text: info.label + ":",
                            width: "200px"
                        }),
                        new Text({
                            text: info.value,
                            wrapping: true
                        })
                    ]
                }));
            });
        },

        _addLocalRegisterData: function (oContainer, oRowData) {
            oContainer.addItem(new Title({
                text: "📊 Local Register Record",
                level: "H3",
                class: "sapUiMediumMarginTop sapUiSmallMarginBottom"
            }));

            const registerInfo = [
                { label: "Billing Documents", value: oRowData.BillingDocumentsCombined || oRowData.BillingDocument },
                { label: "Materials", value: oRowData.MaterialCombined || oRowData.Material },
                { label: "Total Net Amount", value: this._controller._formatter.formatCurrency(oRowData.TotalNetAmount, oRowData.TransactionCurrency) },
                { label: "Item Count", value: oRowData.ItemCount || 1 },
                { label: "Customer", value: oRowData.CustomerDisplay },
                { label: "Region", value: oRowData.RegionsCombined || oRowData.Region }
            ];

            registerInfo.forEach(info => {
                if (info.value) {
                    oContainer.addItem(new HBox({
                        alignItems: "Start",
                        class: "sapUiTinyMarginBottom",
                        items: [
                            new Label({
                                text: info.label + ":",
                                width: "200px"
                            }),
                            new Text({
                                text: info.value,
                                wrapping: true
                            })
                        ]
                    }));
                }
            });
        },

        _getFieldGroups: function () {
            return [
                {
                    title: "📋 Invoice Information",
                    fields: [
                        { key: "BillingDocumentDate", label: "Invoice Date", formatter: "date" },
                        { key: "InvoiceNumber", label: "Arya DTR Invoice No.", formatter: "text" },
                        { key: "BillingDocument", label: "SAP Invoice No.", formatter: "text" },
                        { key: "ZXT4", label: "Contract ID/Trade ID", formatter: "text" },
                        { key: "BillingDocumentType", label: "Invoice Type", formatter: "text" },
                        { key: "TaxCode", label: "Tax Code", formatter: "text" }
                    ]
                },
                {
                    title: "👥 Customer Information",
                    fields: [
                        { key: "CustomerFullName_1", label: "Customer Name(sold to)", formatter: "text" },
                        { key: "Region", label: "Customer State", formatter: "text" },
                        { key: "ShipToCustomer", label: "Customer Name(ship to)", formatter: "text" },
                        { key: "CustomerGSTIN", label: "Customer GSTIN", formatter: "text" },
                        { key: "CustomerPaymentTerms", label: "Terms of Payment", formatter: "text" },
                        { key: "PayerParty", label: "Customer Code", formatter: "text" },
                        { key: "HeadOfficeCode", label: "Head Office Code", formatter: "text" },
                        { key: "CustomerGroup1", label: "Customer Group-1", formatter: "text" },
                        { key: "CustomerGroup2", label: "Customer Group-2", formatter: "text" },
                        { key: "CustomerGroup3", label: "Customer Group-3", formatter: "text" },
                        { key: "CustomerGroup4", label: "Customer Group-4", formatter: "text" },
                        { key: "CustomerGroup5", label: "Customer Group-5", formatter: "text" },
                        { key: "CustomerType", label: "Customer Type", formatter: "text" }
                    ]
                },
                {
                    title: "📦 Sales Order Information",
                    fields: [
                        { key: "SalesDocument", label: "Sale order No.", formatter: "text" },
                        { key: "DueDate", label: "Due Date", formatter: "date" },
                        { key: "Plant", label: "Plant", formatter: "text" },
                        { key: "Division", label: "Sales Divison/Distribution Channel", formatter: "text" },
                        { key: "ProfitCenter", label: "Profit Centre", formatter: "text" },
                        { key: "GLCode", label: "GL Code", formatter: "text" }
                    ]
                },
                {
                    title: "🛍️ Material Information",
                    fields: [
                        { key: "Material", label: "Material Code", formatter: "text" },
                        { key: "Product", label: "Material Description", formatter: "text" },
                        { key: "MaterialDescription", label: "Material Description", formatter: "text" },
                        { key: "SACHSNCode", label: "SAC/HSN Code", formatter: "text" },
                        { key: "BillingQuantity", label: "Qty.", formatter: "number" },
                        { key: "PPR0", label: "Rate/MT", formatter: "currency" }
                    ]
                },
                {
                    title: "💰 Financial Information",
                    fields: [
                        { key: "TotalNetAmount", label: "Taxable Amount", formatter: "currency" },
                        { key: "Discount", label: "Discount", formatter: "currency" },
                        { key: "ZDV2", label: "Additional Charges", formatter: "currency" },
                        { key: "JOIG", label: "IGST", formatter: "currency" },
                        { key: "JOCG", label: "CGST", formatter: "currency" },
                        { key: "JOSG", label: "SGST", formatter: "currency" },
                        { key: "ZDV4", label: "Delay Charges", formatter: "currency" },
                        { key: "ZTCS", label: "TCS", formatter: "currency" },
                        { key: "InvoiceAmount", label: "Invoice Amount", formatter: "currency" }
                    ]
                },
                {
                    title: "🏭 Warehouse Information",
                    fields: [
                        { key: "ZXT1", label: "Warehouse Code", formatter: "text" },
                        { key: "WarehouseName", label: "Warehouse Name", formatter: "text" },
                        { key: "WarehouseState", label: "Warehouse State", formatter: "text" },
                        { key: "ZXT3", label: "Warehouse Location", formatter: "text" },
                        { key: "ClusterID", label: "Cluster ID", formatter: "text" }
                    ]
                },
                {
                    title: "📄 Compliance Information",
                    fields: [
                        { key: "PANNo", label: "PAN No.", formatter: "text" },
                        { key: "TANNo", label: "TAN No.", formatter: "text" },
                        { key: "ParentInvoiceNo", label: "Parent Invoice No.", formatter: "text" },
                        { key: "ParentInvoiceDate", label: "Parent Invoice Date", formatter: "date" },
                        { key: "EInvoiceStatus", label: "E-invoice Status", formatter: "text" },
                        { key: "EWayBillNo", label: "E-way Bill No.", formatter: "text" },
                        { key: "EWayBillDate", label: "E-way Bill Date", formatter: "date" }
                    ]
                }
            ];
        },

        _formatFieldValue: function (value, formatter, rowData) {
            if (value === null || value === undefined || value === "") {
                return "";
            }

            switch (formatter) {
                case "currency":
                    const currency = rowData.TransactionCurrency || "INR";
                    return this._controller._formatter.formatCurrency(value, currency);
                case "number":
                    return this._controller._formatter.formatNumber(value);
                case "date":
                    return this._controller._formatter.formatDate(value);
                case "text":
                default:
                    return value.toString();
            }
        },

        _exportSingleRow: function () {
            if (!this._currentRowData) {
                MessageToast.show("No row data available for export");
                return;
            }
            this._controller._exportManager.exportToExcel([this._currentRowData], "single_row");
        },

        _copyRowToClipboard: function () {
            if (!this._currentRowData) {
                MessageToast.show("No row data available");
                return;
            }

            let copyText = "SALES REGISTER - ROW DETAILS\n";
            copyText += "=====================================\n\n";

            // Use business field names for clipboard
            Object.keys(this._currentRowData).forEach(key => {
                const value = this._currentRowData[key];
                if (value !== null && value !== undefined && value !== "") {
                    const businessLabel = BUSINESS_COLUMN_MAPPING[key] || key;
                    copyText += `${businessLabel}: ${value}\n`;
                }
            });

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(copyText).then(() => {
                    MessageToast.show("Row data copied to clipboard");
                }).catch(() => {
                    this._fallbackCopyToClipboard(copyText);
                });
            } else {
                this._fallbackCopyToClipboard(copyText);
            }
        },

        _fallbackCopyToClipboard: function (text) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                MessageToast.show("Row data copied to clipboard");
            } catch (err) {
                MessageToast.show("Unable to copy to clipboard. Please copy manually from the dialog.");
            }
            document.body.removeChild(textArea);
        },

        destroy: function () {
            if (this._oBillingDocSearchDialog) {
                this._oBillingDocSearchDialog.destroy();
            }
            if (this._oRowDetailsDialog) {
                this._oRowDetailsDialog.destroy();
            }
            if (this._oEnhancedSalesOrderDialog) {
                this._oEnhancedSalesOrderDialog.destroy();
            }
        }
    });
});
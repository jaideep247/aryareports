sap.ui.define([
    "sap/ui/base/Object"
], function (BaseObject) {
    "use strict";

    return BaseObject.extend("aryasalesregister.utils.Formatter", {

        formatNumber: function (sAmount) {
            if (!sAmount && sAmount !== 0) return "0.00";
            const fAmount = Math.abs(parseFloat(sAmount));
            if (isNaN(fAmount)) return "0.00";
            return new Intl.NumberFormat('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(fAmount);
        },

        formatCurrency: function (sAmount, sCurrency) {
            if (!sAmount && sAmount !== 0) return "";
            const fAmount = parseFloat(sAmount);
            if (isNaN(fAmount)) return "";
            const sFormatted = new Intl.NumberFormat('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(Math.abs(fAmount));
            return `${sFormatted} ${sCurrency || ''}`.trim();
        },

        formatDate: function (oDate) {
            if (!oDate) return "";

            try {
                if (typeof oDate === "string" && oDate.includes("/Date(")) {
                    const timestamp = parseInt(oDate.match(/\d+/)[0]);
                    return new Date(timestamp).toLocaleDateString('en-GB');
                }

                if (typeof oDate === "string") {
                    return new Date(oDate).toLocaleDateString('en-GB');
                }

                if (oDate instanceof Date) {
                    return oDate.toLocaleDateString('en-GB');
                }

                return "";
            } catch (error) {
                console.error("Date formatting error:", error);
                return "";
            }
        },

        formatDateRange: function (sDateRange, sBillingDocumentDate) {
            if (sDateRange) {
                return sDateRange;
            }
            if (sBillingDocumentDate) {
                return this.formatDate(sBillingDocumentDate);
            }
            return "N/A";
        }
    });
});
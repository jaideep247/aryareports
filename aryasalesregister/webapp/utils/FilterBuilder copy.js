sap.ui.define([
    "sap/ui/base/Object"
], function (BaseObject) {
    "use strict";

    return BaseObject.extend("aryasalesregister.utils.FilterBuilder", {

        constructor: function (oController) {
            this._controller = oController;
        },

        hasAnyFilters: function (oFilterData) {
            return !!(oFilterData.billingDocument ||
                oFilterData.material ||
                oFilterData.region ||
                oFilterData.billingDocumentType ||
                oFilterData.salesOrder ||
                oFilterData.amountRange.from ||
                oFilterData.amountRange.to);
        }
    });
});

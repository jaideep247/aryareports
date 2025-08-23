sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "gsttax/model/models",
    "sap/ui/model/odata/v2/ODataModel"
], function (UIComponent, Device, models, ODataModel) {
    "use strict";

    return UIComponent.extend("gsttax.Component", {

        metadata: {
            manifest: "json"
        },

        /**
         * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
         * @public
         * @override
         */
        init: function () {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // Create OData models manually if they don't exist
            this._ensureODataModels();

            // enable routing
            this.getRouter().initialize();

            // set the device model
            this.setModel(models.createDeviceModel(), "device");
        },

        /**
         * Ensure OData models are created and available
         * @private
         */
        _ensureODataModels: function () {
            console.log("🔧 Ensuring OData models are available...");

            // Check if default model exists
            var oDefaultModel = this.getModel();
            if (!oDefaultModel) {
                console.warn("⚠️ Default model not found, creating manually...");
                try {
                    var oEOModel = new ODataModel({
                        serviceUrl: "/sap/opu/odata/sap/YY1_EO_ODATA_API_CDS/",
                        useBatch: false,
                        headers: {
                            "sap-client": "100"
                        }
                    });
                    this.setModel(oEOModel);
                    console.log("✅ Manual EO model created successfully");
                } catch (error) {
                    console.error("❌ Failed to create manual EO model:", error);
                }
            } else {
                console.log("✅ Default EO model found");
            }

            // Check if GST Tax model exists
            var oGSTModel = this.getModel("gstTaxModel");
            if (!oGSTModel) {
                console.warn("⚠️ GST Tax model not found, creating manually...");
                try {
                    var oGSTTaxModel = new ODataModel({
                        serviceUrl: "/sap/opu/odata/sap/YY1_GSTTAXAMOUNT_API_CDS/",
                        useBatch: false,
                        headers: {
                            "sap-client": "100"
                        }
                    });
                    this.setModel(oGSTTaxModel, "gstTaxModel");
                    console.log("✅ Manual GST Tax model created successfully");
                } catch (error) {
                    console.error("❌ Failed to create manual GST Tax model:", error);
                }
            } else {
                console.log("✅ GST Tax model found");
            }

            // Log all available models
            setTimeout(() => {
                this._logAvailableModels();
            }, 1000);
        },

        /**
         * Log all available models for debugging
         * @private
         */
        _logAvailableModels: function () {
            console.group("📊 Available Models Debug");

            try {
                var oModels = this.oModels || {};
                var aModelNames = Object.keys(oModels);

                console.log("📋 Model count:", aModelNames.length);
                console.log("📋 Model names:", aModelNames);

                aModelNames.forEach((sModelName) => {
                    var oModel = oModels[sModelName];
                    var sDisplayName = sModelName || "(default)";

                    if (oModel && oModel.getServiceUrl) {
                        console.log(`✅ ${sDisplayName}:`, oModel.getServiceUrl());
                    } else {
                        console.log(`📄 ${sDisplayName}:`, typeof oModel);
                    }
                });

            } catch (error) {
                console.error("❌ Error listing models:", error);
            }

            console.groupEnd();
        },

        /**
         * The component is destroyed by UI5 automatically.
         * In this method, the ListSelector and ErrorHandler are destroyed.
         * @public
         * @override
         */
        destroy: function () {
            // call the base component's destroy function
            UIComponent.prototype.destroy.apply(this, arguments);
        },

        /**
         * This method can be called to determine whether the sapUiSizeCompact or sapUiSizeCozy
         * design mode class should be set, which influences the size appearance of some controls.
         * @public
         * @return {string} css class, either 'sapUiSizeCompact' or 'sapUiSizeCozy' - or an empty string if no css class should be set
         */
        getContentDensityClass: function () {
            if (this._sContentDensityClass === undefined) {
                // check whether FLP has already set the content density class; do nothing in this case
                if (document.body.classList.contains("sapUiSizeCozy") || document.body.classList.contains("sapUiSizeCompact")) {
                    this._sContentDensityClass = "";
                } else if (!Device.support.touch) { // apply "compact" mode if touch is not supported
                    this._sContentDensityClass = "sapUiSizeCompact";
                } else {
                    // "cozy" in case of touch support; default for most sap.m controls, but needed for desktop-first controls like sap.ui.table.Table
                    this._sContentDensityClass = "sapUiSizeCozy";
                }
            }
            return this._sContentDensityClass;
        }
    });
});
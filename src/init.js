'use strict';

var $             = require('jquery');
var timekitSdk    = require('timekit-sdk');

var ConfigDep     = require('./config');
var UtilsDep      = require('./utils');
var RenderDep     = require('./render');

// Main library
function Initialize() {

  // SDK instance
  var sdk     = timekitSdk.newInstance();
  var config  = new ConfigDep();
  var utils   = new UtilsDep({ config: config });
  var render  = new RenderDep({ config: config, utils: utils, sdk: sdk });
  var getConfig = config.retrieve;

  // Setup the Timekit SDK with correct config
  var timekitSetupConfig = function() {
    sdk.configure(getConfig().sdk);
  };

  // Initilization method
  var init = function(suppliedConfig) {

    var localConfig = config.setDefaults(suppliedConfig || {});
    config.update(localConfig);

    utils.logDebug(['Supplied config:', suppliedConfig]);

    try {

      // Set rootTarget to the target element and clean before child nodes before continuing
      render.prepareDOM(suppliedConfig || {});

      // Start from local config
      if (!suppliedConfig || (!suppliedConfig.projectId && !suppliedConfig.projectSlug) || suppliedConfig.disable_remote_load) {
        return startWithConfig(suppliedConfig)
      }

    } catch (e) {
      utils.logError(e)
      return this
    }

    // Load remote config
    loadRemoteConfig(suppliedConfig)
    .then(function (response) {
      var remoteConfig = response.data
      // streamline naming of object keys
      if (remoteConfig.id) {
        remoteConfig.projectId = remoteConfig.id
        delete remoteConfig.id
      }
      if (remoteConfig.app_key) {
        remoteConfig.appKey = remoteConfig.app_key
        delete remoteConfig.app_key
      }
      // TODO fix this on the backend
      if (remoteConfig.ui === null) {
        remoteConfig.ui = {}
      }
      if (remoteConfig.customer_fields === null) {
        remoteConfig.customer_fields = {}
      }
      // merge with supplied config for overwriting settings
      var mergedConfig = $.extend(true, {}, remoteConfig, suppliedConfig);
      utils.logDebug(['Remote config:', remoteConfig]);
      startWithConfig(mergedConfig)
    })
    .catch(function (e) {
      render.triggerError('The project could not be found, please double-check your projectId/projectSlug' + e);
    })

    return this

  };

  // Load config from remote (embed or hosted)
  var loadRemoteConfig = function(suppliedConfig) {

    var localConfig = config.setDefaults(suppliedConfig);
    config.update(localConfig);
    timekitSetupConfig();
    if (suppliedConfig.projectId && suppliedConfig.appKey) {
      return sdk
      .makeRequest({
        url: '/projects/embed/' + suppliedConfig.projectId,
        method: 'get'
      })
    }
    if (suppliedConfig.projectSlug) {
      return sdk
      .makeRequest({
        url: '/projects/hosted/' + suppliedConfig.projectSlug,
        method: 'get'
      })
    }
    throw render.triggerError('No widget configuration, projectSlug or projectId found');

  };

  // Parse the config and start rendering
  var startWithConfig = function(suppliedConfig) {

    // Handle config and defaults
    try {
      config.parseAndUpdate(suppliedConfig);
      utils.logDebug(['Final config:', getConfig()]);
      utils.logDebug(['Version:', getVersion()]);
    } catch (e) {
      render.triggerError(e);
      return this
    }

    return startRender();

  };

  // Render method
  var startRender = function() {

    utils.doCallback('renderStarted');

    // Setup Timekit SDK config
    timekitSetupConfig();

    // Initialize FullCalendar
    render.initializeCalendar();

    // Get availability through Timekit SDK
    render.getAvailability();

    // TODO Show timezone helper if enabled
    if (getConfig().ui.show_timezone_helper) {
      // renderTimezoneHelper();
    }

    // Show image avatar if set
    if (getConfig().ui.avatar) {
      render.renderAvatarImage();
    }

    // Print out display name
    if (getConfig().name) {
      render.renderDisplayName();
    }

    utils.doCallback('renderCompleted');

    return this;

  };

  // Get library version
  var getVersion = function() {

    return VERSION;

  };

  var destroy = function() {

    render.prepareDOM({});
    config.update({});
    return this;

  };

  // Expose methods
  return {
    setConfig:    config.parseAndUpdate,
    getConfig:    getConfig,
    getVersion:   getVersion,
    render:       startRender,
    init:         init,
    destroy:      destroy,
    timekitCreateBooking: render.timekitCreateBooking,
    fullCalendar: render.fullCalendar,
    timekitSdk:   sdk
  };

}

module.exports = Initialize
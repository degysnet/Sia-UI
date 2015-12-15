'use strict';

// Imported Node modules
const Path = require('path');
const Fs = require('fs');
// Imported Other modules
const $ = require('jquery');

/**
 * PluginManager manages all plugin logic for the UI
 * @class PluginManager
 */
module.exports = (function PluginManager() {
	// Plugin constructor
	var Plugin = require('./plugin');
	// The home view to be opened first
	var home;
	// The plugins folder
	var plugPath;
	// Object to hold plugins and other public members
	var self = {};

	/**
	 * Detects the home Plugin or otherwise the alphabetically first
	 * plugin and sets its button and view to be first in order
	 * @function PluginManager~setOrder
	 * @todo: this is hardcoded, perhaps can add priority system
	 * @param {string[]} pluginNames - array of subdirectories of plugins/
	 */
	function setOrder(pluginNames) {
		// Detect if about plugin is installed
		var aboutIndex = pluginNames.indexOf('About');
		if (aboutIndex !== -1) {
			// Swap it to be last
			pluginNames[aboutIndex] = pluginNames[pluginNames.length - 1];
			pluginNames[pluginNames.length - 1] = 'About';
		}

		// Detect if home plugin is installed
		var homeIndex = pluginNames.indexOf(home);
		if (homeIndex !== -1) {
			// Swap it to be first
			pluginNames[homeIndex] = pluginNames[0];
			pluginNames[0] = home;
			return;
		}
		// No home plugin installed
		home = pluginNames[0];
	}

	/**
	 * Handles listening for plugin messages and reacting to them
	 * @function PluginManager~addListeners
	 * @param {Plugin} plugin - a newly made plugin object
	 */
	function addListeners(plugin) {
		/** 
		 * Standard transition upon button click.
		 * @typedef transition
		 */
		plugin.transition(function() {
			// Don't do anything if already on this plugin
			if (self.Current === plugin || self.Current.isLoading()) {
				return;
			}

			// Fadein and fadeout mainbar
			var main = document.getElementById('mainbar').classList;
			main.add('transition');
			setTimeout(function() {
				main.remove('transition');
			}, 170);

			// Switch plugins
			self.Current.hide();
			self.Current = plugin;
			self.Current.show();
		});
		
		// Handle any ipc messages from the plugin
		plugin.on('ipc-message', function(event) {
			var responseChannel;
			switch(event.channel) {
				case 'notify':
					// Use UI notification system
					UI.notify.apply(null, event.args);
					break;
				case 'tooltip':
					// Use UI tooltip system
					event.args[1].top += $('.header').height();
					event.args[1].left += $('#sidebar').width();
					UI.tooltip.apply(null, event.args);
					break;
				case 'config':
					// Get or set something in the config.json
					var args = event.args[0];
					var result = UI.config(args);
					responseChannel = event.args[1];
					if (responseChannel) {
						plugin.sendToView(responseChannel, result);
					}
					break;
				case 'devtools':
					// Plugin called for its own devtools, toggle it
					plugin.toggleDevTools();
					break;
				default:
					UI.notify('Unknown ipc message: ' + event.channel, 'error');
			}
		});

		// Display any console messages from the plugin
		plugin.on('console-message', function(event) {
			var srcFile = event.sourceId.replace(/^.*[\\\/]/, '');
			console.log(plugin.name + ' plugin logged from ' + srcFile +'(' + event.line + '): ' + event.message);
		});
	}

	/**
	 * Constructs the plugins and adds them to this manager 
	 * @function PluginManager~addPlugin
	 * @param {string} name - The plugin folder's name
	 */
	function addPlugin(name) {
		// Make the plugin, giving its button a standard transition
		var plugin = new Plugin(plugPath, name);

		// Start with the home plugin as current
		if (name === home) {
			self.Current = plugin;
			plugin.on('dom-ready', self.Current.show);
		}

		// addListeners deals with any webview related async tasks
		addListeners(plugin);

		// Store the plugin
		self[name] = plugin;
	}

	/**
	 * Reads the config's plugPath for plugin folders
	 * @function PluginManager~initPlugins
	 */
	function initPlugins() {
		Fs.readdir(plugPath, function(err, pluginNames) {
			if (err) {
				UI.notify('Couldn\'t read plugins folder: ' + err, 'error');
			}

			// Determine default plugin
			setOrder(pluginNames);
			
			// Initialize each plugin according to config
			pluginNames.forEach(addPlugin);
		});
	}

	/**
	 * Sets the member variables based on the passed config
	 * @function PluginManager~setConfig
	 * @param {config} config - config in memory
	 * @param {callback} callback
	 * @todo delete all plugins when a new path is set?
	 */
	function setConfig(config, callback) {
		home = config.homePlugin;
		callback();
	}

	/**
	 * Initializes the plugins to the UI
	 * @function PluginManager.init
	 * @param {config} config - config in memory
	 */
	function init(config) {
		plugPath = Path.join(__dirname, '..', 'plugins');
		setConfig(config, initPlugins);
	}

	// Return public members
	self.init = init;
	return self;
}());
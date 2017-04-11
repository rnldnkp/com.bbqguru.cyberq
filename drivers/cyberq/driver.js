'use strict';

//var devices = {};
//var cyberq = require('./../../includes/cyberq.js');
//var parser = require('xml2json-light');
var request = require('request');
var querystring = require('querystring');
//var refreshIntervalId;
//var prevstatus;

//var homey_lang = Homey.manager('i18n').getLanguage();

var cyberq;
const util = require('./../../lib/util.js');
//const driver = require('./drivers/cyberq/driver.js');
const parser = require('xml2json-light');

// Enable full logging for more info
const fullLogging = true;

const defaultUpdateTime = 1;
const insightsLogs = [
        "cooktemp",
        "cookset",
        "food1temp",
        "food1set",
        "food2temp",
        "food2set",
        "food3temp",
        "food3set",
        "fanoutput",
        "timerleft"
    ];
const severity = util.severity;
const statuscode = util.statuscode;

var units_metric;
var dataInterval;
var update_frequency = defaultUpdateTime;

var devices = {};

var unitData = {};
var cyberqData = {};
cyberqData.cook = {};
var useErrorNotifications;

// Variables for when value has changed
var oldcookTemp;
var oldcookStatus;
var oldfood1Temp;
var oldfood1Status;
var oldfood2Temp;
var oldfood2Status;
var oldfood3Temp;
var oldfood3Status;
var oldtempRemaining = {};
var oldtempTrigger = {};
var oldStatus;
var countStatus;
var Status;
var oldTimerleft;

var self = {
	settings: function( device_data, newSettingsObj, oldSettingsObj, changedKeysArr, callback ) 
	{
    	Homey.log ('Changed settings: ' + JSON.stringify(device_data) + ' / ' + JSON.stringify(newSettingsObj) + ' / old = ' + JSON.stringify(oldSettingsObj));
	    try {
		    changedKeysArr.forEach(function (key) {
			    devices[device_data.id].settings[key] = newSettingsObj[key];
			});
			callback(null, true);
	    } catch (error) {
	      callback(error); 
	    }
	},

	pair: function( socket ) {
    socket.on('manual_add', function (device, callback) 
    	{
	        var url = 'http://' + device.settings.cyberq_ip + '/config.xml';
	        Homey.log('Calling '+ url);
	        request(url, function (error, response, body) 
	        	{
					if (response === null || response === undefined) 
						{
							socket.emit("error", "http error");
							return;
						}
					if (!error && response.statusCode == 200) 
						{
			                Homey.log('CQ added');
			                devices[device.data.id] = {
			                  id: device.data.id,
			                  name: device.name,
			                  settings: device.settings
			                };
			                callback( null, devices );
			                socket.emit("success", device);
					  	} else {
				            socket.emit("error", "http error: "+response.statusCode);
						}
				});
    	});
    
    socket.on('disconnect', function()
    	{
        	console.log("User aborted pairing, or pairing is finished");
    	});
	},

    // this `init` function will be run when Homey is done loading
    init: function(devices_data, callback) {
		util.wuLog("Initialize driver", severity.debug);	   
		 
        self.checkInsightsLogs();

        // Listen for triggers and conditions
        registerTriggerAndConditionListeners();

        // Listen for speech input
        //Homey.manager('speech-input').on('speech', parseSpeech);

        // Listen for changes in settings
        util.wuLog("Registering settings listener", severity.debug);
        Homey.manager('settings').on('set', self.settingsChanged);

        // Listen for Homey app warnings and performance triggers
        registerWarningAndPerformanceListeners();
        
        // Get all Cyberq devices
        self.getDevices(devices_data);
        
        // Check settings and start updating weather
        self.checkSettings();
                    
                    
        callback (null, true);
    },

    getDevices: function(devices_data) {
		util.wuLog("Initialize devices", severity.debug);		    
	    devices_data.forEach(function initdevice(device) 
	    	{
				devices[device.id] = device;
		        module.exports.getSettings(device, function(err, settings){
		            devices[device.id].settings = settings;
		        });
				util.wuLog("CyberQ Initialized: " + JSON.stringify(device.id), severity.debug);
    		}
    	);    	
	},
	
    scheduleData: function(update_frequency) {
        util.wuLog("", severity.debug);
        util.wuLog("Scheduling updateData", severity.debug);

        if (dataInterval) {
            util.wuLog("Clearing current dataInterval", severity.debug);
            clearInterval(dataInterval);
        }

        if (update_frequency == null || update_frequency == 0 || isNaN(update_frequency)) {
            util.wuLog("Update_frequency out of bounds, reset to default: " + update_frequency, severity.debug);
            update_frequency = defaultUpdateTime;
        }
        
        trigger_update();

        var updateTime = update_frequency * 60 * 1000;  // From minutes to milliseconds
        dataInterval = setInterval(trigger_update.bind(this), updateTime);
        
        
        function trigger_update() {
            //self.updateData();
            
            Object.keys(devices).forEach(function (device_id) 
            	{  
		                     
/*
					if (typeof devices[device_id].data === 'undefined') 
						{
			            	devices[device_id].data = [];  
			         	}
*/
			        var cyberq_ip = devices[device_id].settings.cyberq_ip;
			        //var cyberq_ip = "10.10.0.134";
			        var url = 'http://' + cyberq_ip + '/all.xml';
			        util.wuLog("Requesting updateData: " + url, severity.debug);
			        self.updateData(device_id, url) 
			    }
			);

        }
    },
    setUnits: function() {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('setUnits', severity.debug);

        units_metric = Homey.manager('settings').get('units_metric');
        var units_imperial = Homey.manager('settings').get('units_imperial');
        var units_auto = Homey.manager('settings').get('units_auto');
        var homey_units = Homey.manager('i18n').getUnits();

        if (units_auto && util.value_exist(homey_units) && homey_units != "") {
            Homey.manager('settings').set('currentSettingUnits', 'auto');
            if (homey_units == 'metric') {
                if (fullLogging) util.wuLog('Autodetect metric units', severity.debug);
                units_metric = true;
            } else {
                if (fullLogging) util.wuLog('Autodetect imperial units', severity.debug);
                units_metric = false;
            }
        } else if (!util.value_exist(units_auto) && !util.value_exist(units_metric) && !util.value_exist(units_imperial)) {
            // Something is wrong here, none of the radio buttons are checked!
            util.wuLog('No unit value existed, resetting to auto', severity.debug);
            Homey.manager('settings').set('units_auto', 'true');

            // Let check the units again
            self.setUnits();
            return;
        }

        if (units_metric) {
            //noinspection SpellCheckingInspection
            unitData = {
                temp_unit : "&degC",
            }
        } else {
            unitData = {
                temp_unit : "&degF",
            }
        }
    },
    checkSettings: function() {
        util.wuLog("", severity.debug);
        util.wuLog("Check settings", severity.debug);

        // Check units to use in app
        self.setUnits();

        // Get user preference setting for notifications on errors
        useErrorNotifications = Homey.manager('settings').get('useErrorNotifications');
        if(!util.value_exist(useErrorNotifications)) useErrorNotifications = true;
        util.wuLog('Use error notifications: ' + useErrorNotifications, severity.debug);
        if (!util.value_exist(useErrorNotifications)) useErrorNotifications = true;

        // Get user settings for update frequency
        update_frequency = Homey.manager('settings').get('updateFrequency');
        util.wuLog("Update every (user setting): " + update_frequency, severity.debug);

        if (update_frequency < 1 || update_frequency > 60 || !util.value_exist(update_frequency)) {
            if (fullLogging) util.wuLog("Update value out of bounds, resetting to default", severity.debug);
            update_frequency = defaultUpdateTime;                 // in minutes
            util.wuLog("Update value: " + update_frequency + " minutes", severity.debug);
        }

        // Get user settings for update frequency
//         cyberq_ip = Homey.manager('settings').get('cyberq_ip');
//         util.wuLog("Update every (user setting): " + cyberq_ip, severity.debug);

        self.scheduleData(update_frequency);
    },

    settingsChanged: function(settingName) {
        util.wuLog("", severity.debug);
        // Not interested in currentSettingUnits changes
        //noinspection SpellCheckingInspection
        if (settingName != "currentSettingUnits" || settingName != "currentsettingunits") {
            util.wuLog("Setting has changed " + JSON.stringify(settingName), severity.debug);
        }

        // Homey v 0.8.35 has a bug where all variables are lower case
        if (settingName == "currentSettingUnits" || settingName == "currentSettingUnits") {
            // Don't do anything when this setting has changed or it will cause a loop
        } else if (settingName == 'updateFrequency' || settingName == 'updateFrequency') {
            // If the frequency is changed we have to cancel the current interval and schedule a new
            self.checkSettings();
            util.wuLog("Scheduling weather update every:" + update_frequency, severity.debug);
            self.scheduleData(update_frequency);
        } else if (settingName == 'units_auto' || settingName == 'units_imperial' || settingName == 'units_metric') {
            // Let's check if the units have changed
            var units_metric = Homey.manager('settings').get('units_metric');
            if (fullLogging) util.wuLog('units_metric:' + units_metric, severity.debug);
            var units_imperial = Homey.manager('settings').get('units_imperial');
            if (fullLogging) util.wuLog('units_imperial:' + units_imperial, severity.debug);
            var units_auto = Homey.manager('settings').get('units_auto');
            if (fullLogging) util.wuLog('units_auto:' + units_auto, severity.debug);
            var currentSettingUnits = Homey.manager('settings').get('currentSettingUnits');
            if (fullLogging) util.wuLog('currentSettingUnits:' + currentSettingUnits, severity.debug);

            if (units_metric && util.value_exist(currentSettingUnits)) {
                if (currentSettingUnits != 'metric') {
                    // Setting has changed, delete all Insights logs!
                    util.wuLog('Units setting has changed, going to delete all Insights logs!', severity.debug);
//                    self.checkInsightsLogs();
                    Homey.manager('settings').set('currentSettingUnits', 'metric');
                }
            } else if (units_imperial && util.value_exist(currentSettingUnits)) {
                if (currentSettingUnits != 'imperial') {
                    // Setting has changed, delete all Insights logs!
                    util.wuLog('Units setting has changed, going to delete all Insights logs!', severity.debug);
//                    self.checkInsightsLogs();
                    Homey.manager('settings').set('currentSettingUnits', 'imperial');
                }
            } else if (units_auto && util.value_exist(currentSettingUnits)) {
                if (currentSettingUnits != 'auto') {
                    // Setting has changed, delete all Insights logs!
                    util.wuLog('Units setting has changed, going to delete all Insights logs!', severity.debug);
//                    self.checkInsightsLogs();
                    Homey.manager('settings').set('currentSettingUnits', 'auto');
                }
            } else {
                // Something is wrong here, reset to auto units
                util.wuLog('No unit radio button was checked, setting to auto units', severity.debug);
                Homey.manager('settings').set('units_metric', false);
                Homey.manager('settings').set('units_imperial', false);
                Homey.manager('settings').set('units_auto', true);
                Homey.manager('settings').set('currentSettingUnits', 'auto');
            }
        } else {
            self.checkSettings();
        }
    },

    unload: function() {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('unload', severity.debug);
        if (cyberq != null) {
            if (fullLogging) util.wuLog("cyberq != null, closing cyberq", severity.debug);
            cyberq = null;
        }
    },

    // update the data
    updateData: function(device_id, url) {
        util.wuLog("", severity.debug);
        util.wuLog("Updating Data", severity.debug);

        // Get cyberq data
        request(url, function (error, response, body) {
	        
	        // CyberQ not responding, it's offline or not responding on the configured IP-address
			if (response === null || response === undefined) {
				
				// detect if the cyberq was already offline the last time
				if (oldStatus != 'offline') {
					
					// make sure it's set offline this time, reset counter to 1
					Status = 'offline';
					oldStatus = Status;
					countStatus = 1;
					
					util.wuLog("First time cyberq is offline", severity.debug);
				}
				else if (countStatus++ && countStatus == 2) {
					// add one to counter each time we check untill we reach X
					util.wuLog("Cyberq has been offline during " + countStatus + " attempts." , severity.debug);
					// trigger statusOffline
					self.statusOffline(device_id);
					
					// Reset some variables for a new session
					oldtempRemaining = {};
				}

					
				return util.wuLog("HTTP error, no response", severity.debug);
				
	        }
            if (!error && response.statusCode === 200) {
	            
	            
		        // Convert XML to JSON
	            var json = parser.xml2json(body.toLowerCase()).nutcallstatus;
	            
	            // Filter 1 level out
	            //var json = jsonraw.nutcallstatus;

				//util.wuLog("Error: " + JSON.stringify(json), severity.debug);
	            
            } else if (error) {
                util.wuLog("Error getting data" + JSON.stringify(response), severity.debug);
            } else {
	            util.wuLog("Problem getting data without error" + JSON.stringify(response), severity.debug);
            }  
       
            // CyberQ is online, if we can read data continue
            if (!error && util.value_exist(json.cook)) {

				// Detect if the cyberq was already offline the last time
				if (oldStatus != 'online') {
					
					// make sure it's set online this time, reset counter to 1
					Status = 'online';
					oldStatus = Status;
					countStatus = 1;
					
					util.wuLog("First time cyberq is online", severity.debug);
				}
				else if (countStatus++ && countStatus == 2) {
					// add one to counter each time we check untill we reach X
					util.wuLog("Cyberq has been online during " + countStatus + " attempts." , severity.debug);
					// trigger statusOffline
					self.statusOnline(device_id);
				}

				// No new status, just check if we need to trigger anything
                var cookname, cooktemp, cookset, cookstatus, food1name, food1temp, food1set, food1status, food2name, food2temp, food2set, food2status, food3name, food3temp, food3set, food3status, fanoutput, timerleft;

                if (fullLogging) util.wuLog('Using metric units', severity.debug);
                cookname = util.testCyberqData(json.cook.cook_name);
                cooktemp = util.parseCyberqTemp(util.testCyberqData(json.cook.cook_temp), units_metric);
                cookset = util.parseCyberqTemp(util.testCyberqData(json.cook.cook_set), units_metric);
                cookstatus = util.parseCyberqFloat(json.cook.cook_status);
                
                util.wuLog('Cookstatus is ' + cookstatus, severity.debug);
                util.wuLog('Cookstatus human readable is ' + statuscode[cookstatus], severity.debug);
                
                food1name = util.testCyberqData(json.food1.food1_name);
                food1temp = util.parseCyberqTemp(util.testCyberqData(json.food1.food1_temp), units_metric);
                food1set = util.parseCyberqTemp(util.testCyberqData(json.food1.food1_set), units_metric);
                food1status = util.parseCyberqFloat(util.testCyberqData(json.food1.food1_status));
                
                food2name = util.testCyberqData(json.food2.food2_name);
                food2temp = util.parseCyberqTemp(util.testCyberqData(json.food2.food2_temp), units_metric);
                food2set = util.parseCyberqTemp(util.testCyberqData(json.food2.food2_set), units_metric);
                food2status = util.parseCyberqFloat(util.testCyberqData(json.food2.food2_status));
                
                food3name = util.testCyberqData(json.food3.food3_name);
                food3temp = util.parseCyberqTemp(util.testCyberqData(json.food3.food3_temp), units_metric);
                food3set = util.parseCyberqTemp(util.testCyberqData(json.food3.food3_set), units_metric);
                food3status = util.parseCyberqFloat(util.testCyberqData(json.food3.food3_status));
                
                fanoutput = util.parseCyberqFloat(util.testCyberqData(json.output_percent));
                timerleft = util.parseCyberqTimer(util.testCyberqData(json.timer_curr));

                cyberqData = {
	                status: Status,
                    cookname: cookname,
                    cooktemp: cooktemp,
                    cookset: cookset,
                    cookstatus: cookstatus,
                    food1name: food1name,
                    food1temp: food1temp,
                    food1set: food1set,
                    food1status: food1status,
                    food2name: food2name,
                    food2temp: food2temp,
                    food2set: food2set,
                    food2status: food2status,
                    food3name: food3name,
                    food3temp: food3temp,
                    food3set: food3set,
                    food3status: food3status,
                    fanoutput: fanoutput,
                    timerleft: timerleft
                };                

                util.updateGlobalTokens(cyberqData);

                util.wuLog("Current time: " + new Date(), severity.debug);
                if (fullLogging) util.wuLog("Cyberq data: " + JSON.stringify(cyberqData), severity.debug);
                
// need to find better if structure, but will do for now                    
                    
                self.tempchanged (device_id);                
                
                
                

                // BBQ Temperature triggers and conditions
                if (util.value_exist(cyberqData.cooktemp)) {
	                //if (fullLogging) util.wuLog("");

                    if (fullLogging) util.wuLog("cooktemp, currently: " + JSON.stringify(cyberqData.cooktemp) + " old: " + JSON.stringify(oldcookTemp), severity.debug);
                    //if (fullLogging) util.wuLog("Old cooktemp: " + JSON.stringify(oldcookTemp), severity.debug);

                    // Determine if the temp has changed
                    if (!util.value_exist(oldcookTemp)){
                        if (fullLogging) util.wuLog("cooktemp, No oldcookTemp value exists, maybe it's the first start of app", severity.debug);
                        // First time update after reboot/install
                        oldcookTemp = cyberqData.cooktemp;
//                        cyberqData.cook.oldtemp = cyberqData.cooktemp;
                    } else if (util.diff(oldcookTemp, cyberqData.cooktemp) >= 1) {
                        // Only trigger when difference is equal or more then 1 degree
                        //if (fullLogging) util.wuLog("oldcookTemp: " + oldcookTemp + " temp: " + cyberqData.cooktemp, severity.debug);
                        oldcookTemp = cyberqData.cooktemp;
                        self.cooktempChanged(cyberqData.cookname, cyberqData.cooktemp, cyberqData.cookset, cyberqData.cookstatus, device_id);
                    }
                    // Start trigger
                    self.cooktempAboveBelow(cyberqData.cookname, cyberqData.cooktemp, cyberqData.cookset, cyberqData.cookstatus, device_id);
                    self.tempAboveBelow(device_id);

                } else {
                    // No temperature data available!
                    util.wuLog("cooktemp is undefined!", severity.debug)
                }

                // BBQ Status triggers and conditions
                if (util.value_exist(cyberqData.cookstatus)) {
	                //if (fullLogging) util.wuLog("");

                    if (fullLogging) util.wuLog("cookstatus, currently: " + JSON.stringify(cyberqData.cookstatus) + " old: " + JSON.stringify(oldcookStatus), severity.debug);
                    //if (fullLogging) util.wuLog("Old cooktemp: " + JSON.stringify(oldcookTemp), severity.debug);

                    // Determine if the temp has changed
                    if (!util.value_exist(oldcookStatus)){
                        if (fullLogging) util.wuLog("cookstatus, No oldcookStatus value exists, maybe it's the first start of app", severity.debug);
                        // First time update after reboot/install
                        oldcookStatus = cyberqData.cookstatus;
                    } else if (util.diff(oldcookStatus, cyberqData.cookstatus) >= 1) {
                        // Only trigger when difference is equal or more then 1 degree
                        //if (fullLogging) util.wuLog("oldcookTemp: " + oldcookTemp + " temp: " + cyberqData.cooktemp, severity.debug);
                        oldcookStatus = cyberqData.cookstatus;
                        self.cookstatusChanged(cyberqData.cookname, cyberqData.cooktemp, cyberqData.cookset, cyberqData.cookstatus, device_id);
                    }
                    // Start trigger
                    self.cookstatusEqual(cyberqData.cookname, cyberqData.cooktemp, cyberqData.cookset, cyberqData.cookstatus, device_id);

                } else {
                    // No temperature data available!
                    util.wuLog("cookstatus is undefined!", severity.debug)
                }

                // Food1 Temperature triggers and conditions
                if (util.value_exist(cyberqData.food1temp)) {
	                //if (fullLogging) util.wuLog("");

                    if (fullLogging) util.wuLog("food1temp, currently: " + JSON.stringify(cyberqData.food1temp) + " old: " + JSON.stringify(oldfood1Temp), severity.debug);
                    //if (fullLogging) util.wuLog("Old food1temp: " + JSON.stringify(oldfood1Temp), severity.debug);

                    // Determine if the temp has changed
                    if (!util.value_exist(oldfood1Temp)){
                        if (fullLogging) util.wuLog("foodtemp1, No oldfood1Temp value exists, maybe it's the first start of app", severity.debug);
                        // First time update after reboot/install
                        oldfood1Temp = cyberqData.food1temp;
                    } else if (util.diff(oldfood1Temp, cyberqData.food1temp) >= 1) {
                        // Only trigger when difference is equal or more then 1 degree
                        //if (fullLogging) util.wuLog("oldfood1Temp: " + oldfood1Temp + " temp: " + cyberqData.food1temp, severity.debug);
                        oldfood1Temp = cyberqData.food1temp;
                        self.food1tempChanged(cyberqData.food1name, cyberqData.food1temp, cyberqData.food1set, cyberqData.food1status, device_id);
                    }

                    // Start trigger
                    self.food1tempAboveBelow(cyberqData.food1name, cyberqData.food1temp, cyberqData.food1set, cyberqData.food1status, device_id);
                    self.tempAboveBelow(device_id);
                } else {
                    // No temperature data available!
                    util.wuLog("food1temp is undefined!", severity.debug)
                }

                // Food1 Status triggers and conditions
                if (util.value_exist(cyberqData.food1status)) {
                    if (fullLogging) util.wuLog("food1status, currently: " + JSON.stringify(cyberqData.food1status) + " old: " + JSON.stringify(oldfood1Status), severity.debug);
                    // Determine if the temp has changed
                    if (!util.value_exist(oldfood1Status)){
                        if (fullLogging) util.wuLog("food1status, No oldfood1Status value exists, maybe it's the first start of app", severity.debug);
                        // First time update after reboot/install
                        oldfood1Status = cyberqData.food1status;
                    } else if (util.diff(oldfood1Status, cyberqData.food1status) >= 1) {
                        // Only trigger when difference is equal or more then 1 degree
                        oldfood1Status = cyberqData.food1status;
                        self.food1statusChanged(cyberqData.cookname, cyberqData.cooktemp, cyberqData.cookset, cyberqData.cookstatus, device_id);
                    }
                    // Start trigger
                    self.foodstatusEqual(cyberqData.cookname, cyberqData.cooktemp, cyberqData.cookset, cyberqData.cookstatus, device_id);
                } else {
                    // No temperature data available!
                    util.wuLog("food1status is undefined!", severity.debug)
                }
                
                // Food2 Temperature triggers and conditions
                if (util.value_exist(cyberqData.food2temp)) {
	                //if (fullLogging) util.wuLog("");
                    if (fullLogging) util.wuLog("Food2temp: " + JSON.stringify(cyberqData.food2temp), severity.debug);
                    if (fullLogging) util.wuLog("Old food2temp: " + JSON.stringify(oldfood2Temp), severity.debug);

                    // Determine if the temp has changed
                    if (!util.value_exist(oldfood2Temp)){
                        if (fullLogging) util.wuLog("No oldfood2Temp value exists, maybe it's the first start of app", severity.debug);
                        // First time update after reboot/install
                        oldfood2Temp = cyberqData.food2temp;
                    } else if (util.diff(oldfood2Temp, cyberqData.food2temp) >= 1) {
                        // Only trigger when difference is equal or more then 1 degree
                        if (fullLogging) util.wuLog("oldfood2Temp: " + oldfood2Temp + " temp: " + cyberqData.food2temp, severity.debug);
                        oldfood2Temp = cyberqData.food2temp;
                        self.food2tempChanged(cyberqData.food2name, cyberqData.food2temp, cyberqData.food2set, cyberqData.food2status, device_id);
                    }

                    // Start trigger
                    self.food2tempAboveBelow(cyberqData.food2name, cyberqData.food2temp, cyberqData.food2set, cyberqData.food2status, device_id);
                    self.tempAboveBelow(device_id);
                    
                } else {
                    // No temperature data available!
                    util.wuLog("Temperature is undefined!", severity.debug)
                }

                // Food2 Status triggers and conditions
                if (util.value_exist(cyberqData.food2status)) {
                    if (fullLogging) util.wuLog("food2status, currently: " + JSON.stringify(cyberqData.food2status) + " old: " + JSON.stringify(oldfood2Status), severity.debug);
                    // Determine if the temp has changed
                    if (!util.value_exist(oldfood2Status)){
                        if (fullLogging) util.wuLog("food2status, No oldfood2Status value exists, maybe it's the first start of app", severity.debug);
                        // First time update after reboot/install
                        oldfood2Status = cyberqData.food2status;
                    } else if (util.diff(oldfood2Status, cyberqData.food2status) >= 1) {
                        oldfood2Status = cyberqData.food2status;
                        self.food2statusChanged(cyberqData.cookname, cyberqData.cooktemp, cyberqData.cookset, cyberqData.cookstatus, device_id);
                    }
                    // Start trigger
                    self.foodstatusEqual(cyberqData.cookname, cyberqData.cooktemp, cyberqData.cookset, cyberqData.cookstatus, device_id);
                } else {
                    // No temperature data available!
                    util.wuLog("food2status is undefined!", severity.debug)
                }
                
                // Food3 Temperature triggers and conditions
                if (util.value_exist(cyberqData.food3temp)) {
	                if (fullLogging) util.wuLog("");

                    if (fullLogging) util.wuLog("Food3temp: " + JSON.stringify(cyberqData.food3temp), severity.debug);
                    if (fullLogging) util.wuLog("Old food3temp: " + JSON.stringify(oldfood3Temp), severity.debug);

                    // Determine if the temp has changed
                    if (!util.value_exist(oldfood3Temp)){
                        if (fullLogging) util.wuLog("No oldfood3Temp value exists, maybe it's the first start of app", severity.debug);
                        // First time update after reboot/install
                        oldfood3Temp = cyberqData.food3temp;
                    } else if (util.diff(oldfood3Temp, cyberqData.food3temp) >= 1) {
                        // Only trigger when difference is equal or more then 1 degree
                        if (fullLogging) util.wuLog("oldfood3Temp: " + oldfood3Temp + " temp: " + cyberqData.food3temp, severity.debug);
                        oldfood3Temp = cyberqData.food3temp;
                        self.food3tempChanged(cyberqData.food3name, cyberqData.food3temp, cyberqData.food3set, cyberqData.food3status, device_id);
                    }

                    // Start trigger
                    self.food3tempAboveBelow(cyberqData.food3name, cyberqData.food3temp, cyberqData.food3set, cyberqData.food3status, device_id);
					self.tempAboveBelow(device_id);

                } else {
                    // No temperature data available!
                    util.wuLog("Temperature is undefined!", severity.debug)
                }               

                // Food3 Status triggers and conditions
                if (util.value_exist(cyberqData.food3status)) {
                    if (fullLogging) util.wuLog("food3status, currently: " + JSON.stringify(cyberqData.food3status) + " old: " + JSON.stringify(oldfood3Status), severity.debug);
                    // Determine if the temp has changed
                    if (!util.value_exist(oldfood3Status)){
                        if (fullLogging) util.wuLog("food3status, No oldfood3Status value exists, maybe it's the first start of app", severity.debug);
                        // First time update after reboot/install
                        oldfood3Status = cyberqData.food3status;
                    } else if (util.diff(oldfood3Status, cyberqData.food3status) >= 1) {
                        oldfood3Status = cyberqData.food3status;
                        self.food3statusChanged(cyberqData.food3name, cyberqData.food3temp, cyberqData.food3set, cyberqData.food3status, device_id);
                    }
                    // Start trigger
                    self.foodstatusEqual(cyberqData.food3name, cyberqData.food3temp, cyberqData.food3set, cyberqData.food3status, device_id);
                } else {
                    // No temperature data available!
                    util.wuLog("food3status is undefined!", severity.debug)
                }

// 				Nog op iets checkem?
				self.tempRemaining(device_id);

                // BBQ remaining triggers and conditions
                if (util.value_exist(cyberqData.cooktemp) && util.value_exist(cyberqData.cookset) && util.value_exist(oldcookTemp)) {
	                if (fullLogging) util.wuLog("Remaining cook should be good to go. Temp " + JSON.stringify(cyberqData.cooktemp) + " Set " + JSON.stringify(cyberqData.cookset) + " oldTemp: " + JSON.stringify(oldcookTemp) , severity.debug);
						self.cooktempRemaining(cyberqData.cookname, cyberqData.cooktemp, cyberqData.cookset, cyberqData.cookstatus, device_id);

                } else {
                    // No fanoutput data available!
                    util.wuLog("cooktempRemaining, one of the values is undefined, maybe it's the first start of app", severity.debug)
                }

                // food1 remaining triggers and conditions
                if (util.value_exist(cyberqData.food1temp) && util.value_exist(cyberqData.food1set) && util.value_exist(oldfood1Temp)) {
	                if (fullLogging) util.wuLog("Remaining food1 should be good to go. Temp " + JSON.stringify(cyberqData.food1temp) + " Set " + JSON.stringify(cyberqData.food1set) + " oldTemp: " + JSON.stringify(oldfood1Temp) , severity.debug);
						self.food1tempRemaining(cyberqData.food1name, cyberqData.food1temp, cyberqData.food1set, cyberqData.food1status, device_id);

                } else {
                    // No fanoutput data available!
                    util.wuLog("food1tempRemaining, one of the values is undefined, maybe it's the first start of app", severity.debug)
                }

                // food2 remaining triggers and conditions
                if (util.value_exist(cyberqData.food2temp) && util.value_exist(cyberqData.food2set) && util.value_exist(oldfood2Temp)) {
	                if (fullLogging) util.wuLog("Remaining food2 should be good to go. Temp " + JSON.stringify(cyberqData.food2temp) + " Set " + JSON.stringify(cyberqData.food2set) + " oldTemp: " + JSON.stringify(oldfood2Temp) , severity.debug);
						self.food2tempRemaining(cyberqData.food2name, cyberqData.food2temp, cyberqData.food2set, cyberqData.food2status, device_id);

                } else {
                    // No fanoutput data available!
                    util.wuLog("food2tempRemaining, one of the values is undefined, maybe it's the first start of app", severity.debug)
                }
                
                // food3 remaining triggers and conditions
                if (util.value_exist(cyberqData.food3temp) && util.value_exist(cyberqData.food3set) && util.value_exist(oldfood3Temp)) {
	                if (fullLogging) util.wuLog("Remaining food3 should be good to go. Temp " + JSON.stringify(cyberqData.food3temp) + " Set " + JSON.stringify(cyberqData.food3set) + " oldTemp: " + JSON.stringify(oldfood3Temp) , severity.debug);
						self.food3tempRemaining(cyberqData.food3name, cyberqData.food3temp, cyberqData.food3set, cyberqData.food3status, device_id);

                } else {
                    // No fanoutput data available!
                    util.wuLog("food3tempRemaining, one of the values is undefined, maybe it's the first start of app", severity.debug)
                }                                
                // Fan Output triggers and conditions
                if (util.value_exist(cyberqData.fanoutput)) {
	                if (fullLogging) util.wuLog("");
                    if (fullLogging) util.wuLog("fanoutput: " + JSON.stringify(cyberqData.fanoutput), severity.debug);
                    // Start trigger
                    self.fanoutputAboveBelow(cyberqData.fanoutput, device_id);
                } else {
                    // No fanoutput data available!
                    util.wuLog("fanoutput is undefined!", severity.debug)
                }
                
                // Timer triggers and conditions
                if (util.value_exist(cyberqData.timerleft)) {
	                if (fullLogging) util.wuLog("");
                    if (fullLogging) util.wuLog("timerleft: " + JSON.stringify(cyberqData.timerleft), severity.debug);
                    
					// Determine if the timer has changed
                    if (!util.value_exist(oldTimerleft)){
                        if (fullLogging) util.wuLog("No oldTimerleft value exists, maybe it's the first start of app", severity.debug);
                        // First time update after reboot/install
                        oldTimerleft = cyberqData.timerleft;
                    } else if (util.diff(oldTimerleft, cyberqData.timerleft) >= 1) {
                        // Only trigger when difference is equal or more then 1 degree
                        if (fullLogging) util.wuLog("oldTimerleft: " + oldTimerleft + " now remaining: " + cyberqData.timerleft, severity.debug);
                        
                        
                        // Start trigger
                        self.timerleftAboveBelow(cyberqData.timerleft, device_id);
                        
                        oldTimerleft = cyberqData.timerleft;
                    }

                } else {
                    // No timerleft data available!
                    util.wuLog("timerleft is undefined!", severity.debug)
                }

                // Add data to insights
/*
                self.addInsightsEntry("cooktemp", cyberqData.cooktemp);
                self.addInsightsEntry("cookset", cyberqData.cookset);
                self.addInsightsEntry("food1temp", cyberqData.food1temp);
                self.addInsightsEntry("food1set", cyberqData.food1set);
                self.addInsightsEntry("food2temp", cyberqData.food2temp);
                self.addInsightsEntry("food2set", cyberqData.food2set);
                self.addInsightsEntry("food3temp", cyberqData.food3temp);
                self.addInsightsEntry("food3set", cyberqData.food3set);
                self.addInsightsEntry("fanoutput", cyberqData.fanoutput);
                self.addInsightsEntry("timerleft", cyberqData.timerleft);
*/

                
/*
                insightsLogs.forEach(function(log) 
                	{
	                self.addInsightsEntry(log, cyberqData, device_id);
	                	
                	});
*/


            } else {
                //var message;
                var message = 'Error while receiving cyberq data: ' + JSON.stringify(json);
                //else message = 'Error while receiving cyberq data: ' + JSON.stringify(err) + JSON.stringify(response);
                util.wuLog(message, severity.error);
                triggerError(message);
            }
        }
      )
    },

	// Handler for status changes
	statusOffline: function(device_id) {
        var tokens = {'counter': countStatus};
        if (fullLogging) util.wuLog("Sending trigger statusOffline without tokens.", severity.debug);
        Homey.manager('flow').triggerDevice('statusOffline', devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});

    },
	statusOnline: function(device_id) {
        var tokens = {'counter': countStatus};
        if (fullLogging) util.wuLog("Sending trigger statusOnline without tokens", severity.debug);
        Homey.manager('flow').triggerDevice('statusOnline', devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});

    },

    // Handler for cooktemp status changes
    // Cook
    cooktempChanged: function(name, temp, set, status, device_id) {
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
        if (fullLogging) util.wuLog("Sending trigger cooktempChanged with tokens: " + JSON.stringify(tokens), severity.debug);
        Homey.manager('flow').triggerDevice('cooktempChanged', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
    },
    cookstatusChanged: function(name, temp, set, status, device_id) {
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
        if (fullLogging) util.wuLog("Sending trigger cookstatusChanged with tokens: " + JSON.stringify(tokens), severity.debug);
        Homey.manager('flow').triggerDevice('cookstatusChanged', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
		
    },
    // Food1
    food1tempChanged: function(name, temp, set, status, device_id) {
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
        if (fullLogging) util.wuLog("Sending trigger food1tempChanged with tokens: " + JSON.stringify(tokens), severity.debug);
        Homey.manager('flow').triggerDevice('food1tempChanged', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
    },
    food1statusChanged: function(name, temp, set, status, device_id) {
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
        if (fullLogging) util.wuLog("Sending trigger food1statusChanged with tokens: " + JSON.stringify(tokens), severity.debug);
        Homey.manager('flow').triggerDevice('food1statusChanged', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
    },
    // Food2
    food2tempChanged: function(name, temp, set, status, device_id) {
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
        if (fullLogging) util.wuLog("Sending trigger food2tempChanged with tokens: " + JSON.stringify(tokens), severity.debug);
        Homey.manager('flow').triggerDevice('food2tempChanged', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
    },
    food2statusChanged: function(name, temp, set, status, device_id) {
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
        if (fullLogging) util.wuLog("Sending trigger food2statusChanged with tokens: " + JSON.stringify(tokens), severity.debug);
        Homey.manager('flow').triggerDevice('food2statusChanged', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
    },
    // Food3
    food3tempChanged: function(name, temp, set, status, device_id) {
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
        if (fullLogging) util.wuLog("Sending trigger food3tempChanged with tokens: " + JSON.stringify(tokens), severity.debug);
        Homey.manager('flow').triggerDevice('food3tempChanged', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});

    },
    food3statusChanged: function(name, temp, set, status, device_id) {
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
        if (fullLogging) util.wuLog("Sending trigger food3statusChanged with tokens: " + JSON.stringify(tokens), severity.debug);
        Homey.manager('flow').triggerDevice('food3statusChanged', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
    },
    
    // Handler for cookstate condition
    cookstatusEqual: function(name, temp, set, status, device_id) {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('cookstatusEqual', severity.debug);
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
    	Homey.manager('flow').triggerDevice('cookStatus', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
	},    

    // Handler for foodstate condition
    foodstatusEqual: function(name, temp, set, status, device_id) {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('food1statusEqual', severity.debug);
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
    	Homey.manager('flow').triggerDevice('foodStatus', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
	},   
    
    // Handler for universal temp above below conditions
    tempAboveBelow: function(device_id) {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('tempAboveBelow', severity.debug);
    
		Homey.manager('flow').triggerDevice('tempAboveBelow', devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
	},
    // Handler for temp remaining triggers
    cooktempRemaining: function(name, temp, set, status, device_id) {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('cooktempRemaining', severity.debug);
        if (fullLogging) util.wuLog('name ' + JSON.stringify(name) + ' temp ' + JSON.stringify(temp) + ' set ' + JSON.stringify(set) + ' status ' + JSON.stringify(status), severity.debug);
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
        Homey.manager('flow').triggerDevice('cooktempRemaining', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
	},
    // Handler for temp remaining triggers
    food1tempRemaining: function(name, temp, set, status, device_id) {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('food1tempRemaining', severity.debug);
        if (fullLogging) util.wuLog('name ' + JSON.stringify(name) + ' temp ' + JSON.stringify(temp) + ' set ' + JSON.stringify(set) + ' status ' + JSON.stringify(status), severity.debug);
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
        Homey.manager('flow').triggerDevice('food1tempRemaining', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
	},
    // Handler for temp remaining triggers
    food2tempRemaining: function(name, temp, set, status, device_id) {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('food2tempRemaining', severity.debug);
        if (fullLogging) util.wuLog('name ' + JSON.stringify(name) + ' temp ' + JSON.stringify(temp) + ' set ' + JSON.stringify(set) + ' status ' + JSON.stringify(status), severity.debug);
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
        Homey.manager('flow').triggerDevice('food2tempRemaining', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
	},
    // Handler for temp remaining triggers
    food3tempRemaining: function(name, temp, set, status, device_id) {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('food3tempRemaining', severity.debug);
        if (fullLogging) util.wuLog('name ' + JSON.stringify(name) + ' temp ' + JSON.stringify(temp) + ' set ' + JSON.stringify(set) + ' status ' + JSON.stringify(status), severity.debug);
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
        Homey.manager('flow').triggerDevice('food3tempRemaining', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
	},

// TEST

    // Handler for temp remaining triggers
    tempRemaining: function(device_id) {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('cooktempRemaining', severity.debug);
        Homey.manager('flow').triggerDevice('tempRemaining', devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
	},
	
    // Handler for temp above and below triggers
    tempchanged: function(device_id) {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('Trigger setup for tempchanged started', severity.debug);

        
        // We need to know the probe (cook/1/2/3), type (current or set), current temp or current settemp, args.temperature (input)
        // This is handled by the on.trigger part
        
        // Based on the probe, we can get the name, current temp, set temp and status of that probe
        // Need for tokens...
        
        // try to get arguments for triggers
        if (fullLogging) util.wuLog('Getting arguments tempchanged triggers', severity.debug);
        Homey.manager('flow').getTriggerArgs('tempAbove', function (err, triggers) {  // An array of Flows using this trigger 
	        if (fullLogging) util.wuLog('Got tempchanged arguments', severity.debug);
			if (fullLogging) util.wuLog(triggers, severity.debug);
			
			
					Homey.manager('flow').triggerDevice('tempAbove', devices[device_id], function callback(err, success){
				        if (fullLogging) util.wuLog('Trigger status: ' + success, severity.debug);
					    if( err ) return Homey.error(err);
					});

/*
			triggers.forEach(trigger => {

                // Check if all args are valid and present
                if (trigger && trigger.hasOwnProperty('probename') && trigger.hasOwnProperty('probetype') && trigger.hasOwnProperty('temperature')) {
                    
                    // set tokens based on the selected probe in each trigger
			        var tokens = {'name': cyberqData[trigger.probename+'name'], 'temp': cyberqData[trigger.probename+'temp'], 'set': cyberqData[trigger.probename+'set'], 'status': cyberqData[trigger.probename+'status']};
			        if (fullLogging) util.wuLog('Created tempchanged tokens: ' + JSON.stringify(tokens), severity.debug);
			        var state = {'probename': trigger.probename, 'probetype': trigger.probetype, 'temperature': trigger.temperature};
			        if (fullLogging) util.wuLog('Created tempchanged state: ' + JSON.stringify(state), severity.debug);
			        
			        if (fullLogging) util.wuLog('Trigger tempchanged', severity.debug);
			        Homey.manager('flow').triggerDevice('tempchanged', tokens, devices[device_id], function callback(err, success){
				        if (fullLogging) util.wuLog('Trigger status: ' + success, severity.debug);
					    if( err ) return Homey.error(err);
					});
                    
                }
            });
*/
		});
        if (fullLogging) util.wuLog('Done getting arguments and triggering tempchanged', severity.debug);          
        //if (fullLogging) util.wuLog('name ' + JSON.stringify(name) + ' temp ' + JSON.stringify(temp) + ' set ' + JSON.stringify(set) + ' status ' + JSON.stringify(status), severity.debug);
        //var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
        
        
/*
        Homey.manager('flow').triggerDevice('tempAbove', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
*/

/*
        Homey.manager('flow').triggerDevice('cooktempBelow', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
*/
	},




    // Handler for temp above and below triggers
    cooktempAboveBelow: function(name, temp, set, status, device_id) {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('cooktempAboveBelow', severity.debug);
        if (fullLogging) util.wuLog('name ' + JSON.stringify(name) + ' temp ' + JSON.stringify(temp) + ' set ' + JSON.stringify(set) + ' status ' + JSON.stringify(status), severity.debug);
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
        Homey.manager('flow').triggerDevice('cooktempAbove', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});

        Homey.manager('flow').triggerDevice('cooktempBelow', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
	},
    
    // Handler for temp above and below triggers
    food1tempAboveBelow: function(name, temp, set, status, device_id) {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('food1tempAboveBelow', severity.debug);
        if (fullLogging) util.wuLog('name ' + JSON.stringify(name) + ' temp ' + JSON.stringify(temp) + ' set ' + JSON.stringify(set) + ' status ' + JSON.stringify(status), severity.debug);
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
        Homey.manager('flow').triggerDevice('food1tempAbove', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
        Homey.manager('flow').triggerDevice('food1tempBelow', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
    },
    
    // Handler for temp above and below triggers
    food2tempAboveBelow: function(name, temp, set, status, device_id) {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('food2tempAboveBelow', severity.debug);
        if (fullLogging) util.wuLog('name ' + JSON.stringify(name) + ' temp ' + JSON.stringify(temp) + ' set ' + JSON.stringify(set) + ' status ' + JSON.stringify(status), severity.debug);
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
        Homey.manager('flow').triggerDevice('food2tempAbove', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});

        Homey.manager('flow').triggerDevice('food2tempBelow', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});

    },
    
    // Handler for temp above and below triggers
    food3tempAboveBelow: function(name, temp, set, status, device_id) {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('food3tempAboveBelow', severity.debug);
        if (fullLogging) util.wuLog('name ' + JSON.stringify(name) + ' temp ' + JSON.stringify(temp) + ' set ' + JSON.stringify(set) + ' status ' + JSON.stringify(status), severity.debug);
        var tokens = {'name': name, 'temp': temp, 'set': set, 'status': status};
        Homey.manager('flow').triggerDevice('food3tempAbove', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});

        Homey.manager('flow').triggerDevice('food3tempBelow', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});

    },
    
    // Handler for fanoutput triggers and conditions
    fanoutputAboveBelow: function(fanoutput, device_id) {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('fanoutputAboveBelow', severity.debug);
        var tokens = {'fanoutput': fanoutput};
        Homey.manager('flow').triggerDevice('fanoutputAbove', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});

        Homey.manager('flow').triggerDevice('fanoutputBelow', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});

    },

    // Handler for timerleft triggers and conditions
    timerleftAboveBelow: function(timerleft, device_id) {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('timerleftAboveBelow', severity.debug);

        var tokens = {'timerleft': timerleft};
        Homey.manager('flow').triggerDevice('timerleftAbove', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});

        Homey.manager('flow').triggerDevice('timerleftBelow', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
		});
		
		if (fullLogging) util.wuLog('timerleft: ' + timerleft, severity.debug);
		if (fullLogging) util.wuLog('oldTimerleft' + oldTimerleft, severity.debug);
		if (timerleft == 0 && oldTimerleft >= 1) {
			// No arguments, so no 'on.trigger' needed. Just ring the bells!
			util.wuLog('Current timerleft of ' + timerleft + ' is equal to 0. oldTimerleft is ' + oldTimerleft + ' and not equal to 0', severity.debug);
			Homey.manager('flow').triggerDevice('timerleftAlarm', tokens, devices[device_id], function(err, result){
		    if( err ) return Homey.error(err);
			});
		}


    },

    deleteInsightsLog: function(log) {
        util.wuLog("Deleting log " + log, severity.debug);

        Homey.manager('insights').deleteLog(log, function callback(err){
            if (err) {
                //triggerError(__("app.messages.error_deletingInsightsLog") + JSON.stringify(err));
                util.wuLog('Error while deleting Insights log: ' + JSON.stringify(err), severity.error);
                return Homey.error(err);
            }
            else util.wuLog("Log " + log + " deleted", severity.debug);
        });
    },    
    
    deleteAllInsightsLogs: function() {
        util.wuLog("", severity.debug);
        util.wuLog("deleteAllInsightsLogs", severity.debug);

        Homey.manager('insights').getLogs(function callback(err, logs) {
            if (err) {
                //triggerError(__("app.messages.error_deletingInsightsLog") + JSON.stringify(err));
                util.wuLog('Error while deleting all Insights log: ' + JSON.stringify(err), severity.error);
                return Homey.error(err);
            }
            else {
                for (var l in logs) {
                    //noinspection JSUnfilteredForInLoop
                    self.deleteInsightsLog(logs[l]);
                }
            }
        });
    },

    checkInsightsLogs: function() {
        util.wuLog("", severity.debug);
        util.wuLog("checkInsightsLogs", severity.debug);

        // self.deleteInsightsLog("precip_today");

        Homey.manager('insights').getLogs(function callback(err, logs) {
            if (err) {
                // Error, let's create them all
                util.wuLog("Error getting the Insights logs, (re)create all Insights logs", severity.error);
                //noinspection JSDuplicatedDeclaration
                for (var l in insightsLogs) {
                    //noinspection JSUnfilteredForInLoop
                    self.createInsightsLogs(insightsLogs[l]);
                }
                return Homey.error(err);
            } else {
                var currentInsightLogs = [];
                // Let's check if the logs on Homey should be there
                //noinspection JSDuplicatedDeclaration
                for (var l in logs) {
                    // Add current Homey log names to array
                    //noinspection JSUnfilteredForInLoop
                    currentInsightLogs.push(logs[l].name);

                    //noinspection JSUnfilteredForInLoop
                    if (insightsLogs.indexOf(logs[l].name) < 0) {
                        //noinspection JSUnfilteredForInLoop
                        util.wuLog("Log " + logs[l].name + " is old and will be deleted", severity.debug);
                        //noinspection JSUnfilteredForInLoop
                        self.deleteInsightsLog(logs[l].name);
                    }
                }
                // Let's check all required logs are there on Homey
                //noinspection JSDuplicatedDeclaration
                for (var l in insightsLogs) {
                    //noinspection JSUnfilteredForInLoop
                    if (currentInsightLogs.indexOf(insightsLogs[l]) < 0) {
                        //noinspection JSUnfilteredForInLoop
                        util.wuLog("", severity.debug);
                        util.wuLog("Log " + insightsLogs[l] + " is not on Homey", severity.debug);
                        //noinspection JSUnfilteredForInLoop
                        self.createInsightsLogs(insightsLogs[l]);
                    }
                }
            }
        });
    },

    createInsightsLogs: function(log) {
        util.wuLog("Create Insights log: " + log, severity.debug);
        if (fullLogging) util.wuLog("Metric units" + units_metric, severity.debug);

        var temp_unit = unitData.temp_unit;

        switch(log) {
            case 'cooktemp':
                Homey.manager('insights').createLog('cooktemp', {
                label: {
                    en: 'BBQ temperature',
                    nl: 'BBQ temperatuur'
                },
                type: 'number',
                units: {
                    en: temp_unit,
                    nl: temp_unit
                },
                decimals: 0
                },
                function callback(err){
                    if (err) {
                        util.wuLog('createLog cooktemp error', severity.error);
                        return Homey.error(err);
                    }
                });
                break;

            case 'cookset':
                Homey.manager('insights').createLog('cookset', {
                label: {
                    en: 'BBQ set temperature',
                    nl: 'BBQ ingestelde temperatuur'
                },
                type: 'number',
                units: {
                    en: temp_unit,
                    nl: temp_unit
                },
                decimals: 0
                },
                function callback(err){
                    if (err) {
                        util.wuLog('createLog cookset error', severity.error);
                        return Homey.error(err);
                    }
                });
                break;
                
            case 'food1temp':
                Homey.manager('insights').createLog('food1temp', {
                label: {
                    en: 'Food1 temperature',
                    nl: 'Food1 temperatuur'
                },
                type: 'number',
                units: {
                    en: temp_unit,
                    nl: temp_unit
                },
                decimals: 0
                },
                function callback(err){
                    if (err) {
                        util.wuLog('createLog food1temp error', severity.error);
                        return Homey.error(err);
                    }
                });
                break;

            case 'food1set':
                Homey.manager('insights').createLog('food1set', {
                label: {
                    en: 'Food1 set temperature',
                    nl: 'Food1 ingestelde temperatuur'
                },
                type: 'number',
                units: {
                    en: temp_unit,
                    nl: temp_unit
                },
                decimals: 0
                },
                function callback(err){
                    if (err) {
                        util.wuLog('createLog food1set error', severity.error);
                        return Homey.error(err);
                    }
                });
                break;
                
            case 'food2temp':
                Homey.manager('insights').createLog('food2temp', {
                label: {
                    en: 'Food2 temperature',
                    nl: 'Food2 temperatuur'
                },
                type: 'number',
                units: {
                    en: temp_unit,
                    nl: temp_unit
                },
                decimals: 0
                },
                function callback(err){
                    if (err) {
                        util.wuLog('createLog food2temp error', severity.error);
                        return Homey.error(err);
                    }
                });
                break;

            case 'food2set':
                Homey.manager('insights').createLog('food2set', {
                label: {
                    en: 'Food2 set temperature',
                    nl: 'Food2 ingestelde temperatuur'
                },
                type: 'number',
                units: {
                    en: temp_unit,
                    nl: temp_unit
                },
                decimals: 0
                },
                function callback(err){
                    if (err) {
                        util.wuLog('createLog food2set error', severity.error);
                        return Homey.error(err);
                    }
                });
                break;
                
            case 'food3temp':
                Homey.manager('insights').createLog('food3temp', {
                label: {
                    en: 'Food3 temperature',
                    nl: 'Food3 temperatuur'
                },
                type: 'number',
                units: {
                    en: temp_unit,
                    nl: temp_unit
                },
                decimals: 0
                },
                function callback(err){
                    if (err) {
                        util.wuLog('createLog food3temp error', severity.error);
                        return Homey.error(err);
                    }
                });
                break;

            case 'food3set':
                Homey.manager('insights').createLog('food3set', {
                label: {
                    en: 'Food3 set temperature',
                    nl: 'Food3 ingestelde temperatuur'
                },
                type: 'number',
                units: {
                    en: temp_unit,
                    nl: temp_unit
                },
                decimals: 0
                },
                function callback(err){
                    if (err) {
                        util.wuLog('createLog food3set error', severity.error);
                        return Homey.error(err);
                    }
                });
                break;
                
            case 'fanoutput':
                Homey.manager('insights').createLog('fanoutput', {
                label: {
                    en: 'Fan output',
                    nl: 'Fan vermogen'
                },
                type: 'number',
                units: {
                    en: 'Percent',
                    nl: 'Procent'
                },
                decimals: 0
                },
                function callback(err){
                    if (err) {
                        util.wuLog('createLog fanoutout error', severity.error);
                        return Homey.error(err);
                    }
                });
                break;

            case 'timerleft':
                Homey.manager('insights').createLog('timerleft', {
                    label: {
                        en: 'Timer left',
                        nl: 'Timer resterend'
                    },
                    type: 'number',
                    units: {
                        en: 'Seconds',
                        nl: 'Seconden'
                    },
                    decimals: 0
                    },
                    function callback(err){
                        if (err) {
                            util.wuLog('createLog timerleft error', severity.error);
                            return Homey.error(err);
                        }
                    });
                break;

            default:
                util.wuLog("Create Insights log default switch-case was hit which means one log wasn't created!", severity.error);
                break;
        }
    },

    addInsightsEntry: function(logName, value) {

        Homey.manager('insights').createEntry(logName, value, new Date(), function(err){
            if (err) util.wuLog('Error creating Insights entry: ' + JSON.stringify(logName) + JSON.stringify(value) + JSON.stringify(err), severity.debug);
        })

        
//        module.exports.realtime( { id: device_id }, logName, cyberqData[logName]);
    },
    
    

    capabilities: {
		cooktemp : {
			get: function (callback) {
			  //if (device instanceof Error) return callback(device);
			  console.log("measure_temperature test capabilities in app");
			  //getStatus(device.id);
			  
			  
			  //var newvalue = devices[device.id].temperature;
			  
			  
			  //var newvalue = cyberqData.cooktemp;
			   var newvalue = 10;
			  // Callback ambient temperature
			  callback(null, newvalue);
			}
		}
	},

/*
		target_temperature: {
		
			get: function (device, callback) {
				if (device instanceof Error) return callback(device);
				console.log("target_temperature:get");
				// Retrieve updated data
				getStatus(device.id);
				var newvalue;
				if (devices[device.id].setTemperature !== 0) {
				newvalue = devices[device.id].setTemperature;
				} else {
				newvalue = devices[device.id].thermTemperature;
				}
				callback(null, newvalue);
			},
			
			set: function (device, temperature, callback) {
			  if (device instanceof Error) return callback(device);
			    // Catch faulty trigger and max/min temp
			    if (!temperature) {
			      callback(true, temperature);
			      return false;
			    }
			    else if (temperature < 5) {
			      temperature = 5;
			    }
			    else if (temperature > 35) {
			      temperature = 35;
			    }
			    temperature = Math.round(temperature.toFixed(1) * 2) / 2;
			    var url = '/hl/0/settarget/'+temperature;
			    console.log(url);
			    var homewizard_id = devices[device.id].settings.homewizard_id;
			    homewizard.call(homewizard_id, '/hl/0/settarget/'+temperature, function(err, response) {
			        console.log(err);
			        if (callback) callback(err, temperature);
			    });
			}

		},
		
*/		
//	},
	
	realtime: function (device_id, callback) {
		util.wuLog("Exporting cooktemp poging 2 30 graden", severity.debug);
		callback( {id: device_id}, 'cooktemp', 30);
	}
		

};


module.exports = self;

function registerTriggerAndConditionListeners() {
    util.wuLog("Registering trigger and condition listeners", severity.debug);
    
	// Triggers
    Homey.manager('flow').on('trigger.statusOnline', statusOnline);
    
    Homey.manager('flow').on('trigger.tempAbove', tempAboveTrigger);
    
    Homey.manager('flow').on('trigger.tempRemaining', tempRemainingTrigger);
    
    Homey.manager('flow').on('trigger.cooktempAbove', cooktempAbove);
    Homey.manager('flow').on('trigger.cooktempBelow', cooktempBelow);
    Homey.manager('flow').on('trigger.cooktempRemaining', cooktempRemaining);
    Homey.manager('flow').on('trigger.cookstatusChanged', cookstatusChanged);

    Homey.manager('flow').on('trigger.cooksetAbove', cooksetAbove);
    Homey.manager('flow').on('trigger.cooksetBelow', cooksetBelow);

    Homey.manager('flow').on('trigger.food1tempAbove', food1tempAbove);
    Homey.manager('flow').on('trigger.food1tempBelow', food1tempBelow);
    Homey.manager('flow').on('trigger.food1tempRemaining', food1tempRemaining);
    Homey.manager('flow').on('trigger.food1statusChanged', food1statusChanged);
    
    Homey.manager('flow').on('trigger.food1setAbove', food1setAbove);
    Homey.manager('flow').on('trigger.food1setBelow', food1setBelow);

    Homey.manager('flow').on('trigger.food2tempAbove', food2tempAbove);
    Homey.manager('flow').on('trigger.food2tempBelow', food2tempBelow);
    Homey.manager('flow').on('trigger.food2tempRemaining', food2tempRemaining);
    Homey.manager('flow').on('trigger.food2statusChanged', food3statusChanged);

    Homey.manager('flow').on('trigger.food2setAbove', food2setAbove);
    Homey.manager('flow').on('trigger.food2setBelow', food2setBelow);

    Homey.manager('flow').on('trigger.food3tempAbove', food3tempAbove);
    Homey.manager('flow').on('trigger.food3tempBelow', food3tempBelow);
    Homey.manager('flow').on('trigger.food3tempRemaining', food3tempRemaining);    
    Homey.manager('flow').on('trigger.food3statusChanged', food3statusChanged);
    
    Homey.manager('flow').on('trigger.food3setAbove', food3setAbove);
    Homey.manager('flow').on('trigger.food3setBelow', food3setBelow);

    Homey.manager('flow').on('trigger.fanoutputAbove', fanoutputAbove);
    Homey.manager('flow').on('trigger.fanoutputBelow', fanoutputBelow);
    Homey.manager('flow').on('trigger.timerleftAbove', timerleftAbove);
    Homey.manager('flow').on('trigger.timerleftBelow', timerleftBelow);

	// Conditions
    Homey.manager('flow').on('condition.statusOnline', statusOnline);
    
    
    Homey.manager('flow').on('condition.tempAboveBelow', tempAboveBelow);
    Homey.manager('flow').on('condition.tempRemaining', tempRemainingCondition);
    Homey.manager('flow').on('condition.foodStatus', statusChanged);
    Homey.manager('flow').on('condition.cookStatus', cookstatusChanged);

    Homey.manager('flow').on('condition.cooktempAbove', tempAboveBelow);
    Homey.manager('flow').on('condition.cooktempBelow', tempAboveBelow);
    Homey.manager('flow').on('condition.cooksetAbove', tempAboveBelow);
    Homey.manager('flow').on('condition.cooksetBelow', tempAboveBelow);

    Homey.manager('flow').on('condition.food1tempAbove', tempAboveBelow);
    Homey.manager('flow').on('condition.food1tempBelow', tempAboveBelow);
    Homey.manager('flow').on('condition.food1setAbove', tempAboveBelow);
    Homey.manager('flow').on('condition.food1setBelow', tempAboveBelow);

    Homey.manager('flow').on('condition.food2tempAbove', tempAboveBelow);
    Homey.manager('flow').on('condition.food2tempBelow', tempAboveBelow);
    Homey.manager('flow').on('condition.food2setAbove', tempAboveBelow);
    Homey.manager('flow').on('condition.food2setBelow', tempAboveBelow);
    
    Homey.manager('flow').on('condition.food3tempAbove', tempAboveBelow);
    Homey.manager('flow').on('condition.food3tempBelow', tempAboveBelow);
    Homey.manager('flow').on('condition.food3setAbove', tempAboveBelow);
    Homey.manager('flow').on('condition.food3setBelow', tempAboveBelow);

    Homey.manager('flow').on('condition.fanoutputAbove', fanoutputAbove);
    Homey.manager('flow').on('condition.fanoutputBelow', fanoutputBelow);

    Homey.manager('flow').on('condition.timerleftAbove', timerleftAbove);
    Homey.manager('flow').on('condition.timerleftBelow', timerleftBelow);
    
    //Actions
    Homey.manager('flow').on('action.nameSet', nameSet);
    Homey.manager('flow').on('action.targetSet', targetSet);
    Homey.manager('flow').on('action.timerSet', timerSet);
    Homey.manager('flow').on('action.scrollingSet', scrollingSet);
    Homey.manager('flow').on('action.alarmbeepSet', alarmbeepSet);
    Homey.manager('flow').on('action.keybeepSet', keybeepSet);
    Homey.manager('flow').on('action.alarmdevSet', alarmdevSet);
    Homey.manager('flow').on('action.propbandSet', propbandSet);
    Homey.manager('flow').on('action.cookholdSet', cookholdSet);
    Homey.manager('flow').on('action.cookrampSet', cookrampSet);
    Homey.manager('flow').on('action.timeoutSet', timeoutSet);
    Homey.manager('flow').on('action.backlightSet', backlightSet);
    Homey.manager('flow').on('action.contrastSet', contrastSet);
    Homey.manager('flow').on('action.opendetectSet', opendetectSet);
    Homey.manager('flow').on('action.mailportSet', mailportSet);
   
    
    //Homey.manager('flow').on('trigger.timerleftAlarm', timerleftAlarm);
    
    //Homey.manager('flow').on('condition.timerleftAlarm', timerleftAlarm);

    //Homey.manager('flow').on('action.readForecast_today', readForecast_today);
    //Homey.manager('flow').on('action.readForecast_tonight', readForecast_tonight);

	// Function to check if the CyberQ is online or not (trigger does not have tokens, so is merged with offline)
    function statusOnline(callback) {
        if (cyberqData.status == 'online') {
            util.wuLog('Current status is online', severity.debug);
            callback(null, true);
        }
        else {
	        util.wuLog('Current status is offline', severity.debug);
	        callback(null, false);
	    }
    }

	// Function used for checking conditions with dropdown probe selection
    function tempAboveBelow(callback, args) {
	    
	    util.wuLog(args.probename+args.probetype + ' ' + args.variable, severity.debug);
        if (cyberqData[args.probename+args.probetype] > args.variable) {
            util.wuLog('Current temp of ' + args.probename+args.probetype + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else {
	        util.wuLog('Current temp of ' + args.probename+args.probetype + ' is lower then trigger value of ' + args.variable, severity.debug);
	        callback(null, false);
	    }
    }    
 
 	// Function used for checking conditions with dropdown probe selection
    function statusChanged(callback, args) {
        if (cyberqData[args.probe] == args.status) {
            util.wuLog('Current value of ' + args.probe + ' is equal to ' + args.status, severity.debug);
            callback(null, true);
        }
        else {
	        util.wuLog('Current value of ' + args.probe + ' is not equal to ' + args.status, severity.debug);
	        callback(null, false);
	    }
    }   
    function tempRemainingCondition(callback, args) {
	    
	    // lets make an universal treshold we should pass to trigger
	    if (args.type == 'degrees') {
		    var treshold = cyberqData[args.probename+'set'] - args.variable;
	    }
		else if (args.type == 'percent') {
			var treshold = Math.round(cyberqData[args.probename+'set'] - (cyberqData[args.probename+'set'] * args.variable / 100));
		}
	    util.wuLog('Continue if temp is lower than treshold: ' + treshold, severity.debug);
	    		
		// Start real trigger
    	if (cyberqData[args.probename+'temp'] >= treshold) {
            util.wuLog('Current temp of ' + args.probename + ' is within ' + args.variable + ' ' + args.type + ' of ' + cyberqData[args.probename+'set'], severity.debug);
            callback(null, true);
        } 
		else {
	        util.wuLog('Current temp of ' + args.probename + ' is not within '  + args.variable + ' ' + args.type + ' of ' + cyberqData[args.probename+'set'], severity.debug);
	        callback(null, false);
	    }	 

    } 


	// Temp above trigger validation
    function tempAboveTrigger(callback, args) {
	    util.wuLog('TEST trigger validation: ' + JSON.stringify(args), severity.debug);
	    // lets make a treshold we should pass to trigger
		var treshold = args.temperature;
		
/*
		if (util.value_exist(cyberqdata[args.probename][args.probetype]['tempabove'+treshold+cyberqData.cookset])) {
			treshold = treshold - 2;
		    if (cyberqData.cooktemp >= treshold) {
			    util.wuLog('temp is still within in the last (safe) trigger zone: ' + cyberqData.cooktemp + ' is more than ' + treshold, severity.debug);
			    return callback(null, false);
		    }
		}
*/
	    // First make sure we never run before
	    if (util.value_exist(oldtempTrigger[args.probe+args.temperature])) {
			// Since we run before, we want to make sure there is a real difference before triggering again
		    util.wuLog('We already triggered this one before. Creating safe trigger zone (treshold - 2)', severity.debug);
			treshold = treshold - 2;
		    if (cyberqData[args.probe] >= treshold) {
			    util.wuLog('temp is still within in the last (safe) trigger zone: ' + cyberqData[args.probe] + ' is more than or equal to ' + treshold, severity.debug);
			    return callback(null, false);
		    }
		util.wuLog('But temp is no longer within in the last (safe) trigger zone: ' + cyberqData[args.probe] + ' is less than ' + treshold +'. Lets try again!', severity.debug);
		delete oldtempTrigger[args.probe+args.temperature];
	    }
	    else {
		    util.wuLog('Trigger not run before, or is reset because of too low temperature', severity.debug);
		}

		
//		if (cyberqData[args.probename]['old'+args.probetype] < cyberqData[args.probename+args.probetype] && cyberqData[args.probename+args.probetype] > treshold) {
		if (cyberqData[args.probe] >= treshold) {
			util.wuLog('true: current temp ' + cyberqData[args.probe] + ' is higher than or equal to treshold ' + treshold, severity.debug);
//			util.wuLog('old temp lower than current AND current temp is higher than treshold', severity.debug);
			oldtempTrigger[args.probe+args.temperature] = cyberqData[args.probe];
		    callback(null, true);
		}
		else {
			util.wuLog('false: current temp ' + cyberqData[args.probe] + '  is lower than treshold ' + treshold, severity.debug);
			//util.wuLog('old temp ' + cyberqData[args.probename]['old'+args.probetype] + ' higher than current ' + cyberqData[args.probename+args.probetype] + ' OR current temp ' + cyberqData[args.probename+args.probetype] + '  is lower than treshold' + treshold, severity.debug);
			callback(null, false);
			
		}
    }
    
     function tempRemainingTrigger(callback, args) {
	    // lets make an universal treshold we should pass to trigger
	    var probe = args.probename;
	    var variable = args.variable;
	    var type = args.type;
	    var temp = cyberqData[args.probename+'temp'];
	    var set = cyberqData[args.probename+'set'];
	    
	    
	    if (type == 'degrees') {
		    var treshold = set - variable;
	    }
		else if (type == 'percent') {
			var treshold = Math.round(set - (set * variable / 100));
		}
	    util.wuLog('Continue if temp is lower than treshold: ' + treshold, severity.debug);
	    // First make sure we never run before
	    if (util.value_exist(oldtempRemaining[probe+variable+type+set])) {
			// Since we run before, we want to make sure there is a real difference before triggering again
		    util.wuLog('We already triggered this one before. Creating safe trigger zone (treshold - 2)', severity.debug);
			treshold = treshold - 2;
		    if (temp >= treshold) {
			    util.wuLog('temp is still within in the last (safe) trigger zone: ' + temp + ' is more than or equal to ' + treshold, severity.debug);
			    return callback(null, false);
		    }
		util.wuLog('But temp is no longer within in the last (safe) trigger zone: ' + temp + ' is less than ' + treshold +'. Lets try again!', severity.debug);
		delete oldtempRemaining[probe+variable+type+set];
	    }
	    else {
		    util.wuLog('Trigger not run before, or is reset because of too low temperature', severity.debug);
		}
		// Start real trigger
    	if (temp >= treshold) {
	        oldtempRemaining[probe+variable+type+set] = temp;
	        util.wuLog(JSON.stringify(oldtempRemaining), severity.debug);
            util.wuLog('Current temp of ' + temp + ' is within ' + variable + ' ' + type + ' of ' + set, severity.debug);
            callback(null, true);
        } 
		else {
	        util.wuLog('Current ctemp of ' + temp + ' is not within '  + variable + ' ' + type + ' of ' + set, severity.debug);
	        callback(null, false);
	    }	 

    } 
   


	// cooktemp trigger validation
    function cooktempAbove(callback, args) {
	    util.wuLog(args, severity.debug);
	    
        if (cyberqData[args.probe] > args.variable) {
            util.wuLog('Current temp of ' + args.probe + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else {
	        util.wuLog('Current temp of ' + args.probe + ' is lower then trigger value of ' + args.variable, severity.debug);
	        callback(null, false);
	    }
    }
    function cooktempBelow(callback, args) {
	    util.wuLog(args, severity.debug);
	    
        if (cyberqData.cooktemp < args.variable) {
            util.wuLog('Current cooktemp of ' + cyberqData.cooktemp + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

	// cookset trigger validation
    function cooksetAbove(callback, args) {
        if (cyberqData.cookset > args.variable) {
            util.wuLog('Current cookset of ' + cyberqData.cookset + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else {
	        util.wuLog('Current cookset of ' + cyberqData.cookset + ' is lower then trigger value of ' + args.variable, severity.debug);
	        callback(null, false);
	    }
    }
    function cooksetBelow(callback, args) {
        if (cyberqData.cookset < args.variable) {
            util.wuLog('Current cookset of ' + cyberqData.cookset + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }
    function cooktempRemaining(callback, args) {
	    // lets make an universal treshold we should pass to trigger
	    if (args.type == 'degrees') {
		    var treshold = cyberqData.cookset - args.variable;
	    }
		else if (args.type == 'percent') {
			var treshold = Math.round(cyberqData.cookset - (cyberqData.cookset * args.variable / 100));
		}
	    util.wuLog('Continue if temp is lower than treshold: ' + treshold, severity.debug);
	    // First make sure we never run before
	    if (util.value_exist(oldtempRemaining['cook'+args.variable+args.type+cyberqData.cookset])) {
			// Since we run before, we want to make sure there is a real difference before triggering again
		    util.wuLog('We already triggered this one before. Creating safe trigger zone (treshold - 2)', severity.debug);
			treshold = treshold - 2;
		    if (cyberqData.cooktemp >= treshold) {
			    util.wuLog('Cooktemp is still within in the last (safe) trigger zone: ' + cyberqData.cooktemp + ' is more than or equal to ' + treshold, severity.debug);
			    return callback(null, false);
		    }
		util.wuLog('But cooktemp is no longer within in the last (safe) trigger zone: ' + cyberqData.cooktemp + ' is less than ' + treshold +'. Lets try again!', severity.debug);
		delete oldtempRemaining['cook'+args.variable+args.type+cyberqData.cookset];
	    }
	    else {
		    util.wuLog('Trigger not run before, or is reset because of too low temperature', severity.debug);
		}
		// Start real trigger
    	if (cyberqData.cooktemp >= treshold) {
	        oldtempRemaining['cook'+args.variable+args.type+cyberqData.cookset] = cyberqData.cooktemp;
	        util.wuLog(JSON.stringify(oldtempRemaining), severity.debug);
            util.wuLog('Current cooktemp of ' + cyberqData.cooktemp + ' is within ' + args.variable + ' ' + args.type + ' of ' + cyberqData.cookset, severity.debug);
            callback(null, true);
        } 
		else {
	        util.wuLog('Current cooktemp of ' + cyberqData.cooktemp + ' is not within '  + args.variable + ' ' + args.type + ' of ' + cyberqData.cookset, severity.debug);
	        callback(null, false);
	    }	 

    } 
	// cookstatus trigger validation
    function cookstatusChanged(callback, args) {
        if (cyberqData.cookstatus == args.status) {
            util.wuLog('Current value of cookstatus is equal to ' + args.status, severity.debug);
            callback(null, true);
        }
        else {
	        util.wuLog('Current value of cookstatus is not equal to ' + args.status, severity.debug);
	        callback(null, false);
	    }
    }    

	// food1temp trigger validation
    function food1tempAbove(callback, args) {
        if (cyberqData.food1temp > args.variable) {
            util.wuLog('Current food1temp of ' + cyberqData.food1temp + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else {
	        util.wuLog('Current food1temp of ' + cyberqData.food1temp + ' is lower then trigger value of ' + args.variable, severity.debug);
	        callback(null, false);
	    }
    }
    function food1tempBelow(callback, args) {
        if (cyberqData.food1temp < args.variable) {
            util.wuLog('Current food1temp of ' + cyberqData.food1temp + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

	// food1set trigger validation
    function food1setAbove(callback, args) {
        if (cyberqData.food1set > args.variable) {
            util.wuLog('Current food1set of ' + cyberqData.food1set + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else {
	        util.wuLog('Current food1set of ' + cyberqData.food1set + ' is lower then trigger value of ' + args.variable, severity.debug);
	        callback(null, false);
	    }
    }
    function food1setBelow(callback, args) {
        if (cyberqData.food1set < args.variable) {
            util.wuLog('Current food1set of ' + cyberqData.food1set + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }
    function food1tempRemaining(callback, args) {
	    // lets make an universal treshold we should pass to trigger
	    if (args.type == 'degrees') {
		    var treshold = cyberqData.food1set - args.variable;
	    }
		else if (args.type == 'percent') {
			var treshold = Math.round(cyberqData.food1set - (cyberqData.food1set * args.variable / 100));
		}
	    util.wuLog('Continue if temp is lower than treshold: ' + treshold, severity.debug);
	    // First make sure we never run before
	    if (util.value_exist(oldtempRemaining['food1'+args.variable+args.type+cyberqData.food1set])) {
			// Since we run before, we want to make sure there is a real difference before triggering again
		    util.wuLog('We already triggered this one before. Creating safe trigger zone (treshold - 2)', severity.debug);
			treshold = treshold - 2;
		    if (cyberqData.food1temp >= treshold) {
			    util.wuLog('food1temp is still within in the last (safe) trigger zone: ' + cyberqData.food1temp + ' is more than ' + treshold, severity.debug);
			    return callback(null, false);
		    }
		util.wuLog('But food1temp is no longer within in the last (safe) trigger zone: ' + cyberqData.food1temp + ' is less than ' + treshold +'. Lets try again!', severity.debug);
		delete oldtempRemaining['food1'+args.variable+args.type+cyberqData.food1set];
	    }
	    else {
		    util.wuLog('Trigger not run before, or is reset because of too low temperature', severity.debug);
		}
		// Start real trigger
    	if (cyberqData.food1temp >= treshold) {
	        oldtempRemaining['food1'+args.variable+args.type+cyberqData.food1set] = cyberqData.food1temp;
	        util.wuLog(JSON.stringify(oldtempRemaining), severity.debug);
            util.wuLog('Current food1temp of ' + cyberqData.food1temp + ' is within ' + args.variable + ' ' + args.type + ' of ' + cyberqData.food1set, severity.debug);
            callback(null, true);
        } 
		else {
	        util.wuLog('Current food1temp of ' + cyberqData.food1temp + ' is not within '  + args.variable + ' ' + args.type + ' of ' + cyberqData.food1set, severity.debug);
	        callback(null, false);
	    }	 

    } 
	// food1status trigger validation
    function food1statusChanged(callback, args) {
        if (cyberqData.food1status == args.status) {
            util.wuLog('Current value of food1status is equal to ' + args.status, severity.debug);
            callback(null, true);
        }
        else {
	        util.wuLog('Current value of food1status is not equal to ' + args.status, severity.debug);
	        callback(null, false);
	    }
    }    


	// food2temp trigger validation
    function food2tempAbove(callback, args) {
        if (cyberqData.food2temp > args.variable) {
            util.wuLog('Current food2temp of ' + cyberqData.food2temp + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else {
	        util.wuLog('Current food2temp of ' + cyberqData.food2temp + ' is lower then trigger value of ' + args.variable, severity.debug);
	        callback(null, false);
	    }
    }
    function food2tempBelow(callback, args) {
        if (cyberqData.food2temp < args.variable) {
            util.wuLog('Current food2temp of ' + cyberqData.food2temp + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }
    
	// food2set trigger validation
    function food2setAbove(callback, args) {
        if (cyberqData.food2set > args.variable) {
            util.wuLog('Current food2set of ' + cyberqData.food2set + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else {
	        util.wuLog('Current food2set of ' + cyberqData.food2set + ' is lower then trigger value of ' + args.variable, severity.debug);
	        callback(null, false);
	    }
    }
    function food2setBelow(callback, args) {
        if (cyberqData.food2set < args.variable) {
            util.wuLog('Current food2set of ' + cyberqData.food2set + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }
    function food2tempRemaining(callback, args) {
	    // lets make an universal treshold we should pass to trigger
	    if (args.type == 'degrees') {
		    var treshold = cyberqData.food2set - args.variable;
	    }
		else if (args.type == 'percent') {
			var treshold = Math.round(cyberqData.food2set - (cyberqData.food2set * args.variable / 100));
		}
	    util.wuLog('Continue if temp is lower than treshold: ' + treshold, severity.debug);
	    // First make sure we never run before
	    if (util.value_exist(oldtempRemaining['food2'+args.variable+args.type+cyberqData.food2set])) {
			// Since we run before, we want to make sure there is a real difference before triggering again
		    util.wuLog('We already triggered this one before. Creating safe trigger zone (treshold - 2)', severity.debug);
			treshold = treshold - 2;
		    if (cyberqData.food2temp >= treshold) {
			    util.wuLog('food2temp is still within in the last (safe) trigger zone: ' + cyberqData.food2temp + ' is more than ' + treshold, severity.debug);
			    return callback(null, false);
		    }
		util.wuLog('But food2temp is no longer within in the last (safe) trigger zone: ' + cyberqData.food2temp + ' is less than ' + treshold +'. Lets try again!', severity.debug);
		delete oldtempRemaining['food2'+args.variable+args.type+cyberqData.food2set];
	    }
	    else {
		    util.wuLog('Trigger not run before, or is reset because of too low temperature', severity.debug);
		}
		// Start real trigger
    	if (cyberqData.food2temp >= treshold) {
	        oldtempRemaining['food2'+args.variable+args.type+cyberqData.food2set] = cyberqData.food2temp;
	        util.wuLog(JSON.stringify(oldtempRemaining), severity.debug);
            util.wuLog('Current food2temp of ' + cyberqData.food2temp + ' is within ' + args.variable + ' ' + args.type + ' of ' + cyberqData.food2set, severity.debug);
            callback(null, true);
        } 
		else {
	        util.wuLog('Current food2temp of ' + cyberqData.food2temp + ' is not within '  + args.variable + ' ' + args.type + ' of ' + cyberqData.food2set, severity.debug);
	        callback(null, false);
	    }	 

    }     
	// food2status trigger validation
    function food2statusChanged(callback, args) {
        if (cyberqData.food2status == args.status) {
            util.wuLog('Current value of food2status is equal to ' + args.status, severity.debug);
            callback(null, true);
        }
        else {
	        util.wuLog('Current value of food2status is not equal to ' + args.status, severity.debug);
	        callback(null, false);
	    }
    }    
    
	// food3temp trigger validation
    function food3tempAbove(callback, args) {
        if (cyberqData.food3temp > args.variable) {
            util.wuLog('Current food3temp of ' + cyberqData.food3temp + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else {
	        util.wuLog('Current food3temp of ' + cyberqData.food3temp + ' is lower then trigger value of ' + args.variable, severity.debug);
	        callback(null, false);
	    }
    }
    function food3tempBelow(callback, args) {
        if (cyberqData.food3temp < args.variable) {
            util.wuLog('Current food3temp of ' + cyberqData.food3temp + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

	// food3set trigger validation
    function food3setAbove(callback, args) {
        if (cyberqData.food3set > args.variable) {
            util.wuLog('Current food3set of ' + cyberqData.food3set + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else {
	        util.wuLog('Current food3set of ' + cyberqData.food3set + ' is lower then trigger value of ' + args.variable, severity.debug);
	        callback(null, false);
	    }
    }
    function food3setBelow(callback, args) {
        if (cyberqData.food3set < args.variable) {
            util.wuLog('Current food3set of ' + cyberqData.food3set + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }
    function food3tempRemaining(callback, args) {
	    // lets make an universal treshold we should pass to trigger
	    if (args.type == 'degrees') {
		    var treshold = cyberqData.food3set - args.variable;
	    }
		else if (args.type == 'percent') {
			var treshold = Math.round(cyberqData.food3set - (cyberqData.food3set * args.variable / 100));
		}
	    util.wuLog('Continue if temp is lower than treshold: ' + treshold, severity.debug);
	    // First make sure we never run before
	    if (util.value_exist(oldtempRemaining['food3'+args.variable+args.type+cyberqData.food3set])) {
			// Since we run before, we want to make sure there is a real difference before triggering again
		    util.wuLog('We already triggered this one before. Creating safe trigger zone (treshold - 2)', severity.debug);
			treshold = treshold - 2;
		    if (cyberqData.food3temp >= treshold) {
			    util.wuLog('food3temp is still within in the last (safe) trigger zone: ' + cyberqData.food3temp + ' is more than ' + treshold, severity.debug);
			    return callback(null, false);
		    }
		util.wuLog('But food3temp is no longer within in the last (safe) trigger zone: ' + cyberqData.food3temp + ' is less than ' + treshold +'. Lets try again!', severity.debug);
		delete oldtempRemaining['food3'+args.variable+args.type+cyberqData.food3set];
	    }
	    else {
		    util.wuLog('Trigger not run before, or is reset because of too low temperature', severity.debug);
		}
		// Start real trigger
    	if (cyberqData.food3temp >= treshold) {
	        oldtempRemaining['food3'+args.variable+args.type+cyberqData.food3set] = cyberqData.food3temp;
	        util.wuLog(JSON.stringify(oldtempRemaining), severity.debug);
            util.wuLog('Current food3temp of ' + cyberqData.food3temp + ' is within ' + args.variable + ' ' + args.type + ' of ' + cyberqData.food3set, severity.debug);
            callback(null, true);
        } 
		else {
	        util.wuLog('Current food3temp of ' + cyberqData.food3temp + ' is not within '  + args.variable + ' ' + args.type + ' of ' + cyberqData.food3set, severity.debug);
	        callback(null, false);
	    }	 

    }       
	// food3status trigger validation
    function food3statusChanged(callback, args) {
        if (cyberqData.food3status == args.status) {
            util.wuLog('Current value of food3status is equal to ' + args.status, severity.debug);
            callback(null, true);
        }
        else {
	        util.wuLog('Current value of food3status is not equal to ' + args.status, severity.debug);
	        callback(null, false);
	    }
    }    
    
	// fanoutput trigger validation
    function fanoutputAbove(callback, args) {
        if (cyberqData.fanoutput > args.variable) {
            util.wuLog('Current fanoutout of ' + cyberqData.fanoutput + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else {
	        util.wuLog('Current fanoutput of ' + cyberqData.fanoutput + ' is lower then trigger value of ' + args.variable, severity.debug);
	        callback(null, false);
	    }
    }
    function fanoutputBelow(callback, args) {
        if (cyberqData.fanoutput < args.variable) {
            util.wuLog('Current fanoutput of ' + cyberqData.fanoutput + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

	// timerleft trigger validation
    function timerleftAbove(callback, args) {
        if (cyberqData.timerleft > args.variable && oldTimerleft < args.variable) {
            util.wuLog('Current timerleft of ' + cyberqData.timerleft + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else {
	        util.wuLog('Current timerleft of ' + cyberqData.timerleft + ' is lower then trigger value of ' + args.variable, severity.debug);
	        callback(null, false);
	    }
    }

    function timerleftBelow(callback, args) {
        if (cyberqData.timerleft < args.variable && oldTimerleft > args.variable) {
            util.wuLog('Current timerleft of ' + cyberqData.timerleft + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }
    
    function nameSet(callback, args) {
        if (cyberqData[args.probe+'name'] != args.name) {
	        var data = querystring.stringify({
		        [args.probe + '_name']: args.name
		        });
	        var page = '';
	        var device_id = args.device.id;
	        postForm(data, page, device_id, function (statusCode) {
		        
		        if (fullLogging) util.wuLog(callback, severity.debug);
		        if (statusCode == 200) {
			        
			        if (fullLogging) util.wuLog('Changed name of ' + args.probe + ' from ' + cyberqData[args.probe+'name'] + ' to ' + args.name, severity.debug);
			        cyberqData[args.probe+'name'] = args.name;
					callback(null, true);
			        
		        }
		        else {
			        if (fullLogging) util.wuLog('Requested change of name failed', severity.debug);
			        callback(null, false);
			    }
	        });
        }
        else callback(null, false);
    }
    
    function targetSet(callback, args) {
	    var temp = util.parseTenthsF (args.temperature, units_metric);
        if (cyberqData[args.probe+'set'] != args.temperature) {
	        var data = querystring.stringify({
		        [args.probe + '_set']: temp
		        });
	        var page = '';
	        postForm(data, page, function (statusCode) {
		        
		        if (fullLogging) util.wuLog(callback, severity.debug);
		        if (statusCode == 200) {
			        
			        if (fullLogging) util.wuLog('Changed set of ' + args.probe + ' from ' + cyberqData[args.probe+'set'] + ' to ' + args.temperature + ' degrees', severity.debug);
			        cyberqData[args.probe+'set'] = args.temperature;
					callback(null, true);
			        
		        }
		        else {
			        if (fullLogging) util.wuLog('Requested change of set failed', severity.debug);
			        callback(null, false);
			    }
	        });
        }
        else callback(null, false);
    }
    
    function timerSet(callback, args) {
	    var timer = args.hours+':'+args.minutes+':'+args.seconds;
	    var data = querystring.stringify({'cook_timer': timer});
	    var page = '';
	    postForm(data, page, function (statusCode) {
	        if (statusCode == 200) {
		        if (fullLogging) util.wuLog('Changing cook_timer to: ' + timer, severity.debug);
		        cyberqData.timerleft = util.parseCyberqTimer(timer);
				callback(null, true);
	        }
	        else {
		        if (fullLogging) util.wuLog('Requested change of cook_timer failed', severity.debug);
		        callback(null, false);
		    }
        });
    }
    
    function scrollingSet(callback, args) {
	    var data = querystring.stringify({'MENU_SCROLLING': args.onoff});
	    var page = 'system.htm';
	    postForm(data, page, function (statusCode) {
	        if (statusCode == 200) {
		        if (fullLogging) util.wuLog('Changing MENU_SCROLLING to: ' + args.onoff, severity.debug);
				callback(null, true);
	        }
	        else {
		        if (fullLogging) util.wuLog('Requested change of MENU_SCROLLING failed', severity.debug);
		        callback(null, false);
		    }
        });
    }
    function alarmbeepSet(callback, args) {
	    var data = querystring.stringify({'ALARM_BEEPS': args.beep});
	    var page = 'system.htm';
	    postForm(data, page, function (statusCode) {
	        if (statusCode == 200) {
		        if (fullLogging) util.wuLog('Changing ALARM_BEEPS to: ' + args.beep, severity.debug);
				callback(null, true);
	        }
	        else {
		        if (fullLogging) util.wuLog('Requested change of ALARM_BEEPS failed', severity.debug);
		        callback(null, false);
		    }
        });
    }
    function keybeepSet(callback, args) {
	    var data = querystring.stringify({'KEY_BEEPS': args.beep});
	    var page = 'system.htm';
	    postForm(data, page, function (statusCode) {
	        if (statusCode == 200) {
		        if (fullLogging) util.wuLog('Changing KEY_BEEPS to: ' + args.beep, severity.debug);
				callback(null, true);
	        }
	        else {
		        if (fullLogging) util.wuLog('Requested change of KEY_BEEPS failed', severity.debug);
		        callback(null, false);
		    }
        });
    }
    function cookholdSet(callback, args) {
	    var temperature = util.parseTenthsF (args.temperature, units_metric);
	    var data = querystring.stringify({'COOKHOLD': temperature});
	    var page = 'control.htm';
	    postForm(data, page, function (statusCode) {
	        if (statusCode == 200) {
		        if (fullLogging) util.wuLog('Changing COOKHOLD to: ' + args.temperature, severity.debug);
				callback(null, true);
	        }
	        else {
		        if (fullLogging) util.wuLog('Requested change of COOKHOLD failed', severity.debug);
		        callback(null, false);
		    }
        });
    }
    function alarmdevSet(callback, args) {
	    var degrees = util.parseTenthsF (args.degrees, units_metric);
	    var data = querystring.stringify({'ALARMDEV': degrees});
	    var page = 'control.htm';
	    postForm(data, page, function (statusCode) {
	        if (statusCode == 200) {
		        if (fullLogging) util.wuLog('Changing ALARMDEV to: ' + args.degrees, severity.debug);
				callback(null, true);
	        }
	        else {
		        if (fullLogging) util.wuLog('Requested change of ALARMDEV failed', severity.debug);
		        callback(null, false);
		    }
        });
    }
    function propbandSet(callback, args) {
	    var degrees = util.parseTenthsF (args.degrees, units_metric);
	    var data = querystring.stringify({'PROPBAND': degrees});
	    var page = 'control.htm';
	    postForm(data, page, function (statusCode) {
	        if (statusCode == 200) {
		        if (fullLogging) util.wuLog('Changing PROPBAND to: ' + args.degrees, severity.debug);
				callback(null, true);
	        }
	        else {
		        if (fullLogging) util.wuLog('Requested change of PROPBAND failed', severity.debug);
		        callback(null, false);
		    }
        });
    }
    function cookrampSet(callback, args) {
	    var data = querystring.stringify({'COOK_RAMP': args.probe});
	    var page = 'control.htm';
	    postForm(data, page, function (statusCode) {
	        if (statusCode == 200) {
		        if (fullLogging) util.wuLog('Changing COOK_RAMP to: ' + args.probe, severity.debug);
				callback(null, true);
	        }
	        else {
		        if (fullLogging) util.wuLog('Requested change of COOK_RAMP failed', severity.debug);
		        callback(null, false);
		    }
        });
    }
    function timeoutSet(callback, args) {
	    var data = querystring.stringify({'TIMEOUT_ACTION': args.action});
	    var page = 'control.htm';
	    postForm(data, page, function (statusCode) {
	        if (statusCode == 200) {
		        if (fullLogging) util.wuLog('Changing TIMEOUT_ACTION to: ' + args.action, severity.debug);
				callback(null, true);
	        }
	        else {
		        if (fullLogging) util.wuLog('Requested change of TIMEOUT_ACTION failed', severity.debug);
		        callback(null, false);
		    }
        });
    }
    function backlightSet(callback, args) {
	    var data = querystring.stringify({'LCD_BACKLIGHT': args.percentage});
	    var page = 'system.htm';
	    postForm(data, page, function (statusCode) {
	        if (statusCode == 200) {
		        if (fullLogging) util.wuLog('Changing LCD_BACKLIGHT to: ' + args.percentage, severity.debug);
				callback(null, true);
	        }
	        else {
		        if (fullLogging) util.wuLog('Requested change of LCD_BACKLIGHT failed', severity.debug);
		        callback(null, false);
		    }
        });
    }
    function contrastSet(callback, args) {
	    var data = querystring.stringify({'LCD_CONTRAST': args.percentage});
	    var page = 'system.htm';
	    postForm(data, page, function (statusCode) {
	        if (statusCode == 200) {
		        if (fullLogging) util.wuLog('Changing LCD_CONTRAST to: ' + args.percentage, severity.debug);
				callback(null, true);
	        }
	        else {
		        if (fullLogging) util.wuLog('Requested change of LCD_CONTRAST failed', severity.debug);
		        callback(null, false);
		    }
        });
    }
    function opendetectSet(callback, args) {
	    var data = querystring.stringify({'OPENDETECT': args.onoff});
	    var page = 'control.htm';
	    postForm(data, page, function (statusCode) {
	        if (statusCode == 200) {
		        if (fullLogging) util.wuLog('Changing OPENDETECT to: ' + args.onoff, severity.debug);
				callback(null, true);
	        }
	        else {
		        if (fullLogging) util.wuLog('Requested change of OPENDETECT failed', severity.debug);
		        callback(null, false);
		    }
        });
    }
    function mailportSet(callback, args) {
	    var data = querystring.stringify({'SMTP_PORT': args.port});
	    var page = 'email.htm';
	    postForm(data, page, function (statusCode) {
	        if (statusCode == 200) {
		        if (fullLogging) util.wuLog('Changing SMTP_PORT to: ' + args.port, severity.debug);
				callback(null, true);
	        }
	        else {
		        if (fullLogging) util.wuLog('Requested change of SMTP_PORT failed', severity.debug);
		        callback(null, false);
		    }
        });
    }
    
    
    
/*
    function timerleftAlarm(callback, args) {
	    if (cyberqData.timerleft === 0) {
            util.wuLog('Current timerleft of ' + cyberqData.timerleft + ' is equal to 0', severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }
*/


}

function postForm (data, page, device_id, callback) {

    var cyberq_ip = devices[device_id].settings.cyberq_ip;

	var options = {
	  method: 'post',
	  body: data,
	  json: true,
	  url: 'http://' + cyberq_ip + '/' + page,
	  headers: {
	        'Content-Type': 'application/x-www-form-urlencoded',
	        'Accept': 'text/plain',
	        'Content-Length': Buffer.byteLength(data)
	    }
	}
	
	if (Status != 'online'){
		if (fullLogging) util.wuLog('Request ignored (device offline): ' + options.url + ' data: ' + data, severity.debug);
		return callback(404);
	}
	
	if (fullLogging) util.wuLog('Request started: ' + options.url + ' data: ' + data, severity.debug);
	request(options, function (err, res, body) {
	  if (err || res.statusCode != 200) {
	    if (fullLogging) util.wuLog('Request failed: ' + options.url + ' data:' + data + ' error: ' + err + '  StatusCode: ' + res.statusCode, severity.debug);
	    return callback(res.statusCode);
	  }
	  if (fullLogging) util.wuLog('Request successful: ' + options.url + ' data: ' + data + ' StatusCode: ' + res.statusCode, severity.debug);
	  return callback(res.statusCode);
	
	});
	
}

/**
 * Helper function to register the unload of the app
 */
function registerWarningAndPerformanceListeners() {
    try {
        util.wuLog("Registering app unload listener", severity.debug);
        Homey.on('unload', self.unload);
    } catch (err) {
        util.wuLog('Registration for one of the app warning and performance listeners failed!', severity.error);
    }
}

/*
function parseSpeech(speech, callback) {
    util.wuLog("", severity.debug);
    util.wuLog("parseSpeech", severity.debug);

    // On very first start units aren't always there yet
    if (!util.value_exist(units_metric)) {
        units_metric = Homey.manager('settings').get('units_metric');
        var units_imperial = Homey.manager('settings').get('units_imperial');
        var units_auto = Homey.manager('settings').get('units_auto');
        var homey_units = Homey.manager('i18n').getUnits();

        if (units_auto && util.value_exist(homey_units) && homey_units != "") {
            Homey.manager('settings').set('currentSettingUnits', 'auto');
            if (homey_units == 'metric') {
                if (fullLogging) util.wuLog('Autodetect metric units', severity.debug);
                units_metric = true;
            } else {
                if (fullLogging) util.wuLog('Autodetect imperial units', severity.debug);
                units_metric = false;
            }
        }
    }

    self.updateForecast();
    self.updateWeather();

    if (util.value_exist(forecastData) && forecastData.length > 0 && util.value_exist(cyberqData) && Object.keys(cyberqData).length > 0) {
        util.wuLog("Weather and forecast data available", severity.debug);

        // Units available:
        // var temp_unit = unitData.temp_unit;
        // var distance_unit = unitData.distance_unit;
        // var speed_unit = unitData.speed_unit;
        // var pressure_unit = unitData.pressure_unit;
        // var distance_small_unit = unitData.distance_small_unit;

        speech.triggers.some(function (trigger) {

            var text;

            switch (trigger.id) {
                case 'weather_tomorrow' :
                    util.wuLog("weather_tomorrow", severity.debug);

                    if (units_metric)
                        text = forecastData[2].fcttext_metric;
                    else
                        text = forecastData[2].fcttext;

                    speech.say(util.parseAbbreviations(text));
                    callback(null, true);
                    return true;

                case 'weather_dayAfterTomorrow' :
                    util.wuLog("weather_dayAfterTomorrow", severity.debug);

                    if (units_metric)
                        text = forecastData[4].fcttext_metric;
                    else
                        text = forecastData[4].fcttext;

                    speech.say(util.parseAbbreviations(text));
                    callback(null, true);
                    return true;

                case 'weather_today' :
                    util.wuLog("weather_today", severity.debug);

                    if (units_metric)
                        text = forecastData[0].fcttext_metric;
                    else
                        text = forecastData[0].fcttext;

                    speech.say(util.parseAbbreviations(text));
                    callback(null, true);
                    return true;

                case 'rain_today' :
                    util.wuLog("rain_today", severity.debug);
                    text = __("app.speech.rainToday") + " " + cyberqData.precip_today + unitData.distance_small_unit;
                    speech.say(util.parseAbbreviations(text));
                    text = "";
                    callback(null, true);
                    return true;

                case 'rain_hour' :
                    util.wuLog("rain_hour", severity.debug);
                    text = __("app.speech.rainToday") + " " + cyberqData.precip_1hr + unitData.distance_small_unit;
                    speech.say(util.parseAbbreviations(text));
                    text = "";
                    callback(null, true);
                    return true;

                default:
                    // Guess it wasn't meant for this app, return that in the callback
                    callback(true, null);
            }
        });
    } else {
        if (fullLogging) util.wuLog("!! Weather and forecast not available", severity.debug);
        speech.say(__("app.speech.weatherDataNotAvailableYet"));
        callback(null, true);
    }
}
*/

function triggerError(errorMsg) {
    if (useErrorNotifications) sendNotification(errorMsg);

    var tokens = {'error': errorMsg};
    Homey.manager('flow').trigger('error', tokens);
}

/**
 * Sends a notification to Homey's notification center
 * @param text Text to send
 */
function sendNotification(text) {
    Homey.manager('notifications').createNotification({
        excerpt: text
    }, function (err, notification) {
        if (err && fullLogging) util.wuLog('Sent notification error: ' + JSON.stringify(err), severity.debug);
        if (fullLogging) util.wuLog('Sent notification: ' + JSON.stringify(notification), severity.debug);
    });
}

/**
 * Helper function to test the Weather Underground response
 * @param err
 * @param result
 * @returns {boolean} True is everything is fine
 */
function testResponse(err, result){

    if (err) return true;

    var err_msg;
    try {
        // If error is in the response, something must have gone wrong
        err_msg = result.response.error.description;
        util.wuLog('test response error: ' + JSON.stringify(err_msg), severity.error);
        return true;
    } catch(err) {
        // If it catches the error it means that there is no result.response.error.description
        // so all is good
        if (fullLogging) util.wuLog('No error message found in weather request', severity.debug);
        return false;
    }
}

'use strict';

var cyberq;
const util = require('./../lib/util.js');
//const driver = require('./drivers/cyberq/driver.js');
const parser = require('xml2json-light');

// Enable full logging for more info
const fullLogging = false;

const defaultUpdateTime = 60;
const insightsLogs = [
        "cooktemp",
        "cookset",
        "cookstatus",
        "food1temp",
        "food1set",
        "food1status",
        "food2temp",
        "food2set",
        "food2status",
        "food3temp",
        "food3set",
        "food3status",
        "fanoutput",
        "timerleft"
    ];
const severity = util.severity;

var units_metric;
var dataInterval;
var update_frequency = defaultUpdateTime;

var devices = {};

var unitData = {};
var cyberqData = {};
var useErrorNotifications;

// Variables for when value has changed
var oldcookTemp;

var self = {
    // this `init` function will be run when Homey is done loading
    init: function(devices_data, callback) {
	Homey.log("init");
	    
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
        self.getDevices();
        
        // Check settings and start updating weather
        self.checkSettings();
    },
    
    getDevices: function(devices_data) {
	    
	    devices_data.forEach(function initdevice(device) 
	    	{
				devices[device.id] = device;
				devices[device.id].settings = settings;
				util.wuLog("CyberQ Initialized: " + JSON.stringify(device.id), severity.debug);
    		}
    	);    	
	},

    scheduleData: function(update_frequency) {
        util.wuLog("", severity.debug);
        util.wuLog("Schedule data", severity.debug);

        if (weatherInterval) {
            util.wuLog("Clearing current dataInterval", severity.debug);
            clearInterval(dataInterval);
        }

        if (update_frequency == null || update_frequency == 0 || isNaN(update_frequency)) {
            util.wuLog("Update_frequency out of bounds, reset to default: " + update_frequency, severity.debug);
            update_frequency = defaultUpdateTime;
        }

        var updateTime = update_frequency * 60 * 1000;  // From minutes to milliseconds
        dataInterval = setInterval(trigger_update.bind(this), updateTime);
        function trigger_update() {
            //self.updateData();
            
            Object.keys(self.devices).forEach(function (device_id) 
            	{      
			        Homey.log(device_id + ': Polling data');
		                     
					if (typeof devices[device_id].data === 'undefined') 
						{
			            	devices[device_id].data = [];  
			         	}
			        cyberq_ip = devices[device_id].settings.cyberq_ip;
			        uri = 'http://' + cyberq_ip + '/all.xml';
			        self.updateData(device_id, uri) 
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
            self.scheduleWeather(update_frequency);
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
                    //self.deleteAllInsightsLogs();
                    self.checkInsightsLogs();
                    Homey.manager('settings').set('currentSettingUnits', 'metric');
                }
            } else if (units_imperial && util.value_exist(currentSettingUnits)) {
                if (currentSettingUnits != 'imperial') {
                    // Setting has changed, delete all Insights logs!
                    util.wuLog('Units setting has changed, going to delete all Insights logs!', severity.debug);
                    //self.deleteAllInsightsLogs();
                    self.checkInsightsLogs();
                    Homey.manager('settings').set('currentSettingUnits', 'imperial');
                }
            } else if (units_auto && util.value_exist(currentSettingUnits)) {
                if (currentSettingUnits != 'auto') {
                    // Setting has changed, delete all Insights logs!
                    util.wuLog('Units setting has changed, going to delete all Insights logs!', severity.debug);
                    //self.deleteAllInsightsLogs();
                    self.checkInsightsLogs();
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
    // update the weather
    updateData: function(device_id, uri {
        util.wuLog("", severity.debug);
        util.wuLog("Update Data", severity.debug);

        // Get cyberq data
        cyberq.conditions().request(uri, function(err, response) {

            var error = testResponse(err, response);
            
            // Convert XML to JSON
            response = parser.xml2json(response);
            
            // Filter 1 level out
            response = response.nutcallstatus;

            if (response && !error && util.value_exist(response.cook)) {

/* wellicht handig om hier de timer uit te werken
                var hum = util.testCyberqData(response.current_observation.relative_humidity);
                var hum_float = 0;
                try {
                    // Cut % sign and convert to float
                    hum_float = util.parseCyberqFloat(hum.substr(0, (hum.length -1)));
                } catch(err) {
                    util.wuLog("Error while parsing relative_humidity to float, setting to 0", severity.error);
                }
*/

                var cookname, cooktemp, cookset, cookstatus, food1name, food1temp, food2set, food1status, food2name, food2temp, food2set, food2status, food3name, food3temp, food3set, food3status, fanoutput, timerleft;


                if (fullLogging) util.wuLog('Using metric units', severity.debug);
                cookname = util.parseCyberqFloat(util.testCyberqData(response.cook.cook_name));
                cooktemp = util.parseCyberqFloat(util.testCyberqData(response.cook.cook_temp), metrics_data);
                cookset = util.parseCyberqFloat(util.testCyberqData(response.cook.cook_set), metrics_data);
                cookstatus = util.parseCyberqFloat(util.testCyberqData(response.cook.cook_status));
                
                food1name = util.parseCyberqFloat(util.testCyberqData(response.cook.food1_name));
                food1temp = util.parseCyberqFloat(util.testCyberqData(response.cook.food1_temp), metrics_data);
                food1set = util.parseCyberqFloat(util.testCyberqData(response.cook.food1_set), metrics_data);
                food1status = util.parseCyberqFloat(util.testCyberqData(response.cook.food1_status));
                
                food2name = util.parseCyberqFloat(util.testCyberqData(response.cook.food2_name));
                food2temp = util.parseCyberqFloat(util.testCyberqData(response.cook.food2_temp), metrics_data);
                food2set = util.parseCyberqFloat(util.testCyberqData(response.cook.food2_set), metrics_data);
                food2status = util.parseCyberqFloat(util.testCyberqData(response.cook.food2_status));
                
                food3name = util.parseCyberqFloat(util.testCyberqData(response.cook.food3_name));
                food3temp = util.parseCyberqFloat(util.testCyberqData(response.cook.food3_temp), metrics_data);
                food3set = util.parseCyberqFloat(util.testCyberqData(response.cook.food3_set), metrics_data);
                food3status = util.parseCyberqFloat(util.testCyberqData(response.cook.food3_status));
                
                fanoutput = util.parseCyberqFloat(util.testCyberqData(response.cook.fanoutput));
                timerleft = util.parseCyberqTimer(util.testCyberqData(response.cook.timerleft));

                cyberqData = {
                    cookname: cookname,
                    cooktemp: cooktemp,
                    cookset: cookset,
                    cookstatus: cookstatus,
                    food1name: food1name,
                    food1temp: food1temp,
                    food1set: food1set,
                    food1status: food1status,
                    food2name: food1name,
                    food2temp: food1temp,
                    food2set: food1set,
                    food2status: food1status,
                    food3name: food1name,
                    food3temp: food1temp,
                    food3set: food1set,
                    food3status: food1status,
                    fanoutput: fanoutput,
                    timerleft: timerleft
                };

                util.updateGlobalTokens(cyberqData);

                util.wuLog("Current time: " + new Date(), severity.debug);
                util.wuLog("Observation time: " + util.epochToString(cyberqData.observation_epoch), severity.debug);
                if (fullLogging) util.wuLog("Cyberq data: " + JSON.stringify(cyberqData), severity.debug);

                // Temperature triggers and conditions
                if (util.value_exist(cyberqData.cooktemp)) {

                    if (fullLogging) util.wuLog("Temp: " + JSON.stringify(cyberqData.cooktemp), severity.debug);
                    if (fullLogging) util.wuLog("Old temp: " + JSON.stringify(oldcookTemp), severity.debug);

                    // Determine if the temp has changed
                    if (!util.value_exist(oldcookTemp)){
                        if (fullLogging) util.wuLog("No oldcookTemp value exists, maybe it's the first start of app", severity.debug);
                        // First time update after reboot/install
                        oldcookTemp = cyberqData.cooktemp;
                    } else if (util.diff(oldcookTemp, cyberqData.cooktemp) >= 1) {
                        // Only trigger when difference is equal or more then 1 degree
                        if (fullLogging) util.wuLog("oldcookTemp: " + oldcookTemp + " temp: " + cyberqData.cooktemp, severity.debug);
                        oldcookTemp = cyberqData.cooktemp;
                        self.cooktempChanged(cyberqData.cookname, cyberqData.cooktemp, cyberqData.cookset, cyberqData.cookstatus);
                    }

                    // Start trigger
                    self.cooktempAboveBelow(cyberqData.cookname, cyberqData.cooktemp, cyberqData.cookset, cyberqData.cookstatus);
                } else {
                    // No temperature data available!
                    util.wuLog("Temperature is undefined!", severity.debug)
                }


                // Fan Output triggers and conditions
                if (util.value_exist(cyberqData.fanoutput)) {
                    // Start trigger
                    self.fanoutputAboveBelow(cyberqData.fanoutput);
                } else {
                    // No fanoutput data available!
                    util.wuLog("fanoutput is undefined!", severity.debug)
                }
                
                // Timer triggers and conditions
                if (util.value_exist(cyberqData.timerleft)) {
                    // Start trigger
                    self.timerleftAboveBelow(cyberqData.timerleft);
                } else {
                    // No timerleft data available!
                    util.wuLog("timerleft is undefined!", severity.debug)
                }

                // Add data to insights
                self.addInsightsEntry("cooktemp", cyberqData.cooktemp);
                self.addInsightsEntry("cookset", cyberqData.cookset);
                self.addInsightsEntry("cookstatus", cyberqData.cookstatus);
                self.addInsightsEntry("food1temp", cyberqData.food1temp);
                self.addInsightsEntry("food1set", cyberqData.food1set);
                self.addInsightsEntry("food1status", cyberqData.food1status);
                self.addInsightsEntry("food2temp", cyberqData.food2temp);
                self.addInsightsEntry("food2set", cyberqData.food2set);
                self.addInsightsEntry("food2status", cyberqData.food2status);
                self.addInsightsEntry("food3temp", cyberqData.food3temp);
                self.addInsightsEntry("food3set", cyberqData.food3set);
                self.addInsightsEntry("food3status", cyberqData.food3status);
                self.addInsightsEntry("fanoutput", cyberqData.fanoutput);
                self.addInsightsEntry("timerleft", cyberqData.timerleft);

            } else {
                var message;
                if (error == true) message = 'Error while receiving cyberq data: ' + JSON.stringify(response);
                else message = 'Error while receiving cyberq data: ' + JSON.stringify(err) + JSON.stringify(response);
                util.wuLog(message, severity.error);
                triggerError(message);
            }
        }
      )
    },

    // Handler for temp status changes
    cooktempChanged: function(name, temp, set, status) {
        var tokens = {'name': name,
                      'temp': temp,
                      'set': set,
                      'status': status};
        if (fullLogging) util.wuLog("Sending trigger cooktemp_changed with tokens: " + JSON.stringify(tokens), severity.debug);
        Homey.manager('flow').trigger('cooktemp_changed', tokens);
    },
    
    // Handler for temp status changes
    food1tempChanged: function(name, temp, set, status) {
        var tokens = {'name': name,
                      'temp': temp,
                      'set': set,
                      'status': status};
        if (fullLogging) util.wuLog("Sending trigger cooktemp_changed with tokens: " + JSON.stringify(tokens), severity.debug);
        Homey.manager('flow').trigger('food1temp_changed', tokens);
    },
    
    // Handler for temp status changes
    food2tempChanged: function(name, temp, set, status) {
        var tokens = {'name': name,
                      'temp': temp,
                      'set': set,
                      'status': status};
        if (fullLogging) util.wuLog("Sending trigger cooktemp_changed with tokens: " + JSON.stringify(tokens), severity.debug);
        Homey.manager('flow').trigger('food2temp_changed', tokens);
    },
    
    // Handler for temp status changes
    food3tempChanged: function(name, temp, set, status) {
        var tokens = {'name': name,
                      'temp': temp,
                      'set': set,
                      'status': status};
        if (fullLogging) util.wuLog("Sending trigger cooktemp_changed with tokens: " + JSON.stringify(tokens), severity.debug);
        Homey.manager('flow').trigger('food3temp_changed', tokens);
    },



    // Handler for temp above and below triggers
    cooktempAboveBelow: function(name, temp, set, status) {
        if (fullLogging) util.wuLog('', severity.debug);
        if (fullLogging) util.wuLog('cooktempAboveBelow', severity.debug);
        if (fullLogging) util.wuLog('name ' + JSON.stringify(name), severity.debug);
        if (fullLogging) util.wuLog('temp ' + JSON.stringify(temp), severity.debug);
        if (fullLogging) util.wuLog('set ' + JSON.stringify(set), severity.debug);
        if (fullLogging) util.wuLog('status ' + JSON.stringify(status), severity.debug);
        var tokens = {'name': name,
                      'temp': temp,
                      'set': set,
                      'status': status};
        Homey.manager('flow').trigger('cooktemp_above', tokens);
        Homey.manager('flow').trigger('cooktemp_below', tokens);
    },

    // Handler for fanoutput triggers and conditions
    fanoutputAboveBelow: function(fanoutput) {
        var tokens = {'fanoutput': fanoutput};
        Homey.manager('flow').trigger('fanoutput_above', tokens);
        Homey.manager('flow').trigger('fanoutput_below', tokens);
    },

    // Handler for timerleft triggers and conditions
    timerleftAboveBelow: function(timerleft) {
        var tokens = {'timerleft': timerleft};
        Homey.manager('flow').trigger('timerleft_above', tokens);
        Homey.manager('flow').trigger('timerleft_below', tokens);
    },

    deleteInsightsLog: function(log) {
        util.wuLog("Deleting log " + log, severity.debug);

        Homey.manager('insights').deleteLog(log, function callback(err){
            if (err) {
                triggerError(__("app.messages.error_deletingInsightsLog") + JSON.stringify(err));
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
                triggerError(__("app.messages.error_deletingInsightsLog") + JSON.stringify(err));
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
                        util.wuLog("Log " + insightsLogs[l] + " is not on Homey", severity.debug);
                        //noinspection JSUnfilteredForInLoop
                        self.createInsightsLogs(insightsLogs[l]);
                    }
                }
            }
        });
    },

    createInsightsLogs: function(log) {
        util.wuLog("", severity.debug);
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
                
            case 'cookstatus':
                Homey.manager('insights').createLog('cookstatus', {
                label: {
                    en: 'Status',
                    nl: 'Status'
                },
                type: 'number',
                units: {
                    en: 'BBQ status',
                    nl: 'BBQ status'
                },
                decimals: 0
                },
                function callback(err){
                    if (err) {
                        util.wuLog('createLog cookstatus error', severity.error);
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
                
            case 'food1status':
                Homey.manager('insights').createLog('food1status', {
                label: {
                    en: 'Status',
                    nl: 'Status'
                },
                type: 'number',
                units: {
                    en: 'Food1 status',
                    nl: 'Food1 status'
                },
                decimals: 0
                },
                function callback(err){
                    if (err) {
                        util.wuLog('createLog food1status error', severity.error);
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
                
            case 'food2status':
                Homey.manager('insights').createLog('food2status', {
                label: {
                    en: 'Food2 status',
                    nl: 'Food2 status'
                },
                type: 'number',
                units: {
                    en: 'statuscode',
                    nl: 'statuscode'
                },
                decimals: 0
                },
                function callback(err){
                    if (err) {
                        util.wuLog('createLog food2status error', severity.error);
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
                
            case 'food3status':
                Homey.manager('insights').createLog('food3status', {
                label: {
                    en: 'Food3 status',
                    nl: 'Food3 status'
                },
                type: 'number',
                units: {
                    en: 'statuscode',
                    nl: 'statuscode'
                },
                decimals: 0
                },
                function callback(err){
                    if (err) {
                        util.wuLog('createLog food3status error', severity.error);
                        return Homey.error(err);
                    }
                });
                break;

            case 'fanoutput':
                Homey.manager('insights').createLog('fanoutout', {
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
                    decimals: 2
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
            if (err) util.wuLog('Error creating Insights entry: ' + JSON.stringify(err), severity.debug);
        })
    }
};

function registerTriggerAndConditionListeners() {
    util.wuLog("Registering trigger and condition listeners", severity.debug);

    Homey.manager('flow').on('trigger.cooktemp_above', cooktempAbove);
    Homey.manager('flow').on('condition.cooktemp_above', cooktempAbove);
    Homey.manager('flow').on('trigger.cooktemp_below', cooktempBelow);
    Homey.manager('flow').on('condition.cooktemp_below', cooktempBelow);

    Homey.manager('flow').on('trigger.cookset_above', cooksetAbove);
    Homey.manager('flow').on('condition.cookset_above', cooksetAbove);
    Homey.manager('flow').on('trigger.cookset_below', cooksetBelow);
    Homey.manager('flow').on('condition.cookset_below', cooksetBelow);

    Homey.manager('flow').on('trigger.food1temp_above', food1tempAbove);
    Homey.manager('flow').on('condition.food1temp_above', food1tempAbove);
    Homey.manager('flow').on('trigger.food1temp_below', food1tempBelow);
    Homey.manager('flow').on('condition.food1temp_below', food1tempBelow);
    
    Homey.manager('flow').on('trigger.food1set_above', food1setAbove);
    Homey.manager('flow').on('condition.food1set_above', food1setAbove);
    Homey.manager('flow').on('trigger.food1set_below', food1setBelow);
    Homey.manager('flow').on('condition.food1set_below', food1setBelow);

    Homey.manager('flow').on('trigger.food2temp_above', food2tempAbove);
    Homey.manager('flow').on('condition.food2temp_above', food2tempAbove);
    Homey.manager('flow').on('trigger.food2temp_below', food2tempBelow);
    Homey.manager('flow').on('condition.food2temp_below', food2tempBelow);
 
    Homey.manager('flow').on('trigger.food2set_above', food2setAbove);
    Homey.manager('flow').on('condition.food2set_above', food2setAbove);
    Homey.manager('flow').on('trigger.food2set_below', food2setBelow);
    Homey.manager('flow').on('condition.food2set_below', food2setBelow);
    
    Homey.manager('flow').on('trigger.food3temp_above', food3tempAbove);
    Homey.manager('flow').on('condition.food3temp_above', food3tempAbove);
    Homey.manager('flow').on('trigger.food3temp_below', food3tempBelow);
    Homey.manager('flow').on('condition.food3temp_below', food3tempBelow);
    
    Homey.manager('flow').on('trigger.food3set_above', food3setAbove);
    Homey.manager('flow').on('condition.food3set_above', food3setAbove);
    Homey.manager('flow').on('trigger.food3set_below', food3setBelow);
    Homey.manager('flow').on('condition.food3set_below', food3setBelow);

    Homey.manager('flow').on('trigger.fanoutput_above', fanoutputAbove);
    Homey.manager('flow').on('condition.fanoutput_above', fanoutputAbove);
    Homey.manager('flow').on('trigger.fanoutput_below', fanoutputBelow);
    Homey.manager('flow').on('condition.fanoutput_below', fanoutputBelow);

    Homey.manager('flow').on('trigger.timerleft_above', timerleftAbove);
    Homey.manager('flow').on('condition.timerleft_above', timerleftAbove);
    Homey.manager('flow').on('trigger.timerleft_below', timerleftBelow);
    Homey.manager('flow').on('condition.timerleft_below', timerleftBelow);

    //Homey.manager('flow').on('action.readForecast_today', readForecast_today);
    //Homey.manager('flow').on('action.readForecast_tonight', readForecast_tonight);


    function cooktempAbove(callback, args) {
        if (cyberqData.cooktemp > args.variable) {
            util.wuLog('Current temp of ' + cyberqData.cooktemp + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function cooktempBelow(callback, args) {
        if (cyberqData.cooktemp < args.variable) {
            util.wuLog('Current temp of ' + cyberqData.cooktemp + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function cooksetAbove(callback, args) {
        if (cyberqData.cookset > args.variable) {
            util.wuLog('Current humidity of ' + cyberqData.cookset + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function cooksetBelow(callback, args) {
        if (cyberqData.cookset < args.variable) {
            util.wuLog('Current humidity of ' + cyberqData.cookset + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function food1tempAbove(callback, args) {
        if (cyberqData.food1temp > args.variable) {
            util.wuLog('Current UV of ' + cyberqData.food1temp + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function food1tempBelow(callback, args) {
        if (cyberqData.food1temp < args.variable) {
            util.wuLog('Current UV of ' + cyberqData.food1temp + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function food1setAbove(callback, args) {
        if (cyberqData.food1set > args.variable) {
            util.wuLog('Current wind of ' + cyberqData.food1set + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function food1setBelow(callback, args) {
        if (cyberqData.food1set < args.variable) {
            util.wuLog('Current wind of ' + cyberqData.food1set + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function food2tempAbove(callback, args) {
        if (cyberqData.food2temp > args.variable) {
            util.wuLog('Current wind gust of ' + cyberqData.food2temp + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function food2tempBelow(callback, args) {
        if (cyberqData.food2temp < args.variable) {
            util.wuLog('Current wind gust of ' + cyberqData.food2temp + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }
    
    function food2setAbove(callback, args) {
        if (cyberqData.food2set > args.variable) {
            util.wuLog('Current wind of ' + cyberqData.food2set + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function food2setBelow(callback, args) {
        if (cyberqData.food2set < args.variable) {
            util.wuLog('Current wind of ' + cyberqData.food2set + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function food3tempAbove(callback, args) {
        if (cyberqData.food3temp > args.variable) {
            util.wuLog('Current wind gust of ' + cyberqData.food3temp + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function food3tempBelow(callback, args) {
        if (cyberqData.food3temp < args.variable) {
            util.wuLog('Current wind gust of ' + cyberqData.food3temp + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function food3setAbove(callback, args) {
        if (cyberqData.food3set > args.variable) {
            util.wuLog('Current wind of ' + cyberqData.food3set + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function food3setBelow(callback, args) {
        if (cyberqData.food3set < args.variable) {
            util.wuLog('Current wind of ' + cyberqData.food3set + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function fanoutputAbove(callback, args) {
        if (cyberqData.fanoutput > args.variable) {
            util.wuLog('Current wind gust of ' + cyberqData.fanoutput + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function fanoutputBelow(callback, args) {
        if (cyberqData.fanoutput < args.variable) {
            util.wuLog('Current wind gust of ' + cyberqData.fanoutput + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function timerleftAbove(callback, args) {
        if (cyberqData.timerleft > args.variable) {
            util.wuLog('Current wind gust of ' + cyberqData.timerleft + ' is higher then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

    function timerleftBelow(callback, args) {
        if (cyberqData.timerleft < args.variable) {
            util.wuLog('Current wind gust of ' + cyberqData.timerleft + ' is lower then trigger value of ' + args.variable, severity.debug);
            callback(null, true);
        }
        else callback(null, false);
    }

/*
    function readForecast_today(callback, args) {
        if (fullLogging) util.wuLog("", severity.debug);
        if (fullLogging) util.wuLog("function readForecast_today", severity.debug);
        if (util.value_exist(forecastData) && forecastData.length > 0) {
            readForecast(0);
            callback(null, true);
        } else {
            util.wuLog('Read forecast but forecast data is empty: ' + JSON.stringify(forecastData), severity.error);
            Homey.manager('speech-output').say(__("app.speech.cyberqDataNotAvailable"));
            callback(null, true);
        }
    }

    function readForecast_tonight(callback, args) {
        if (fullLogging) util.wuLog("", severity.debug);
        if (fullLogging) util.wuLog("function readForecast_tonight", severity.debug);
        if (util.value_exist(forecastData) && forecastData.length > 0) {
            readForecast(1);
            callback(null, true);
        } else {
            util.wuLog('Read forecast but forecast data is empty: ' + JSON.stringify(forecastData), severity.error);
            Homey.manager('speech-output').say(__("app.speech.weatherDataNotAvailable"));
            callback(null, true);
        }
    }

     // Helper function to read the forecast for a specific day in the correct units
     // @param day Number of the day to read the forecast for

    function readForecast(day) {
        var forecastText;
        if (util.isInt(day)) {
            if (units_metric)
                forecastText = forecastData[day].fcttext_metric;
            else
                forecastText = forecastData[day].fcttext;

            util.wuLog('forecast text ' + JSON.stringify(forecastText), severity.debug);

            if (util.value_exist(forecastText)) Homey.manager('speech-output').say(forecastText);
            else {
                util.wuLog('Read forecast but forecast data is empty: ' + JSON.stringify(forecastData), severity.error);
                Homey.manager('speech-output').say(__("app.speech.somethingWrong"));
            }
        } else util.wuLog("Read forecast day is not a integer", severity.error);
    }
*/

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

module.exports = self;
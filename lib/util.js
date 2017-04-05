
var tokens = [];

const severity = {
    debug: 1,
    info: 2,
    warning: 3,
    error: 4,
    critical: 5
};
exports.severity = severity;

const statuscode = {
    0: 'ok',
    1: 'high',
    2: 'low',
    3: 'done',
    4: 'error',
    5: 'hold',
    6: 'alarm',
    7: 'shutdown'
};
exports.statuscode = statuscode;

exports.updateGlobalTokens = function (cyberqData) {
    if (tokens && tokens.length < 1) _registerGlobalTokens(cyberqData);
    else _updateGlobalTokens(cyberqData);
};

function _updateGlobalTokens(cyberqData) {
	Homey.log('');
    Homey.log('Update tokens');

    for (i = tokens.length - 1; i >= 0; i--) {
        var token = tokens[i];
        
        if (token.id == 'timerdone') {
	        
	        token.setValue(exports.parseTimerDone(cyberqData.timerleft), function(err) {
	            if (err) return Homey.log('update token error: ' + JSON.stringify(err));
	        });
        } else {
	        token.setValue(cyberqData[token.id], function(err) {
	            if (err) return Homey.log('update token error: ' + JSON.stringify(err));
	        });	      	        
        }

    }
}

function _registerGlobalTokens(cyberqData) {
    Homey.log('Register tokens');
    Homey.manager('flow').registerToken("cookname", {
        type: 'string',
        title: __("cyberq.cookname")
    }, function(err, token) {
        if (err) return Homey.log('cookname registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.cookname, function(err) {
            if (err) return Homey.log('cookname setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });
    
    Homey.manager('flow').registerToken("cooktemp", {
        type: 'number',
        title: __("cyberq.cooktemp")
    }, function(err, token) {
        if (err) return Homey.log('cooktemp registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.cooktemp, function(err) {
            if (err) return Homey.log('cooktemp setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });

    Homey.manager('flow').registerToken("cookset", {
        type: 'number',
        title: __("cyberq.cookset")
    }, function(err, token) {
        if (err) return Homey.log('cookset registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.cookset, function(err) {
            if (err) return Homey.log('cookset setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });

    Homey.manager('flow').registerToken("cookstatus", {
        type: 'number',
        title: __("cyberq.cookstatus")
    }, function(err, token) {
        if (err) return Homey.log('cookstatus registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.cookstatus, function(err) {
            if (err) return Homey.log('cookstatus setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });

    Homey.manager('flow').registerToken("food1name", {
        type: 'string',
        title: __("cyberq.food1name")
    }, function(err, token) {
        if (err) return Homey.log('food1name registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.food1name, function(err) {
            if (err) return Homey.log('food1name setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });
    
    Homey.manager('flow').registerToken("food1temp", {
        type: 'number',
        title: __("cyberq.food1temp")
    }, function(err, token) {
        if (err) return Homey.log('food1temp registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.food1temp, function(err) {
            if (err) return Homey.log('food1temp setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });

    Homey.manager('flow').registerToken("food1set", {
        type: 'number',
        title: __("cyberq.food1set")
    }, function(err, token) {
        if (err) return Homey.log('food1set registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.food1set, function(err) {
            if (err) return Homey.log('food1set setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });

    Homey.manager('flow').registerToken("food1status", {
        type: 'number',
        title: __("cyberq.food1status")
    }, function(err, token) {
        if (err) return Homey.log('food1status registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.food1status, function(err) {
            if (err) return Homey.log('food1status setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });

    Homey.manager('flow').registerToken("food2name", {
        type: 'string',
        title: __("cyberq.food2name")
    }, function(err, token) {
        if (err) return Homey.log('food2name registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.food2name, function(err) {
            if (err) return Homey.log('food2name setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });
    
    Homey.manager('flow').registerToken("food2temp", {
        type: 'number',
        title: __("cyberq.food2temp")
    }, function(err, token) {
        if (err) return Homey.log('food2temp registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.food2temp, function(err) {
            if (err) return Homey.log('food2temp setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });

    Homey.manager('flow').registerToken("food2set", {
        type: 'number',
        title: __("cyberq.food2set")
    }, function(err, token) {
        if (err) return Homey.log('food2set registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.food2set, function(err) {
            if (err) return Homey.log('food2set setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });

    Homey.manager('flow').registerToken("food2status", {
        type: 'number',
        title: __("cyberq.food2status")
    }, function(err, token) {
        if (err) return Homey.log('food2status registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.food2status, function(err) {
            if (err) return Homey.log('food2status setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });

    Homey.manager('flow').registerToken("food3name", {
        type: 'string',
        title: __("cyberq.food3name")
    }, function(err, token) {
        if (err) return Homey.log('food3name registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.food3name, function(err) {
            if (err) return Homey.log('food3name setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });
    
    Homey.manager('flow').registerToken("food3temp", {
        type: 'number',
        title: __("cyberq.food3temp")
    }, function(err, token) {
        if (err) return Homey.log('food3temp registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.food3temp, function(err) {
            if (err) return Homey.log('food3temp setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });

    Homey.manager('flow').registerToken("food3set", {
        type: 'number',
        title: __("cyberq.food3set")
    }, function(err, token) {
        if (err) return Homey.log('food3set registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.food3set, function(err) {
            if (err) return Homey.log('food3set setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });

    Homey.manager('flow').registerToken("food3status", {
        type: 'number',
        title: __("cyberq.food3status")
    }, function(err, token) {
        if (err) return Homey.log('food3status registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.food3status, function(err) {
            if (err) return Homey.log('food3status setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });

    Homey.manager('flow').registerToken("fanoutput", {
        type: 'number',
        title: __("cyberq.fanoutput")
    }, function(err, token) {
        if (err) return Homey.log('fanoutput registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.fanoutput, function(err) {
            if (err) return Homey.log('fanoutput setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });

    Homey.manager('flow').registerToken("timerleft", {
        type: 'number',
        title: __("cyberq.timerleft")
    }, function(err, token) {
        if (err) return Homey.log('timerleft registerToken error:' + JSON.stringify(err));

        token.setValue(cyberqData.timerleft, function(err) {
            if (err) return Homey.log('timerleft setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });
    
    Homey.manager('flow').registerToken("timerdone", {
        type: 'string',
        title: __("cyberq.timerdone")
    }, function(err, token) {
        if (err) return Homey.log('timerdone registerToken error:' + JSON.stringify(err));

        token.setValue(exports.parseTimerDone(cyberqData.timerleft), function(err) {
            if (err) return Homey.log('timerdone setValue error:' + JSON.stringify(err));
        });
        tokens.push(token);

    });

}

/**
 * Helper function to check if the variable is not undefined and null
 * @param string Variable to check
 * @returns {boolean} true when not undefined or null
 */
exports.value_exist = function (string) {
    //noinspection RedundantIfStatementJS
    if (typeof string != 'undefined' && string != null) return true;
    else return false;
};

/**
 * Logs the message to console.
 * When the severity is error or above the message will also be logged to Athom online logging (Sentry atm).
 * @param {string} message Message to log
 * @param {int} level Message priority level
 */
exports.wuLog = function (message, level) {
    if (!this.value_exist(level)) level = severity.debug;

    if (level >= severity.error) Log.captureMessage(message);
    this.debugLog(message);
};

/**
 * Logs to Homey's log and exporting it to the app Homey Logger (if installed)
 * @param message Message to log
 */
exports.debugLog = function (message) {
    // Do not log empty lines to the Homey Logger app
    if (message != '') Homey.manager('api').realtime('WU Log', message);

    Homey.log('[' + this.epochToTimeFormatter() + ']', message)
};

/**
 * Helper function to generate unique ID
 * @returns {string} Returns unique ID
 */
exports.generateUniqueId = function () {
    var uuid = require('node-uuid');
    return uuid.v4();
};

/**
 * Helper function to convert epoch time to a date variable
 * @param epoch Epoch time (in milli seconds)
 * @returns {Date} Returns the date
 */
exports.epochToString = function (epoch) {
    var date = new Date(0);
    date.setUTCSeconds(epoch);
    return date;
};

/**
 * Helper function to calculates the difference between two values
 * @param a Value 1
 * @param b Value 2
 * @returns {number} Returns the difference, 0 if something went wrong
 */
exports.diff = function (a,b) {
    try {
        return Math.abs(a-b);
    } catch(err) {
        Homey.log('Error while calculating the difference between ' + JSON.stringify(a) + ' and ' + JSON.stringify(b));
        return 0;
    }
};

/**
 * Helper function to check if a value is a integer
 * @param value Value to check
 * @returns {boolean} Returns true if integer
 */
exports.isInt = function (value) {
    return !isNaN(value) &&
        parseInt(Number(value)) == value &&
        !isNaN(parseInt(value, 10));
};

exports.epochToTimeFormatter = function (epoch) {
    if (epoch == null) epoch = new Date().getTime();
    return (new Date(epoch)).toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, '$1')
};

exports.parseTimerDone = function (timerleft) {
	
	try {
		var date = new Date();
		date.setSeconds(date.getSeconds() + timerleft);
		var time = date.toTimeString().replace(/.*(\d{2}:\d{2})(:\d{2}).*/, "$1")
	    
	    return time;
    } catch(err) {
        Homey.log('Error while parsing parseTimerDone', severity.debug);
        return "00:00";
    }
	
};

exports.parseCyberqTimer = function (timer) {

    try {
	    var hours = parseFloat(timer.substr(0,2) * 3600);
	    var minutes = parseFloat(timer.substr(3,2) * 60);
	    var seconds = parseFloat(timer.substr(6,2) * 1);
	    
	    var secondsLeft = Math.round(hours + minutes + seconds);
	    
	    return secondsLeft;
    } catch(err) {
        Homey.log('Error while parsing CyberqTimer', severity.debug);
        return 0;
    }		
};

exports.parseCyberqTimerHR = function (totalSeconds) {

    try {
		var hours = Math.floor(totalSeconds / 3600);
		totalSeconds %= 3600;
		var minutes = Math.floor(totalSeconds / 60);
		var seconds = totalSeconds % 60;
	    
	    var timerHR = {
		    hours: hours,
		    minutes: minutes,
		    seconds: seconds
	    }
	    
	    return timerHR;
    } catch(err) {
        Homey.log('Error while parsing parseCyberqTimerHR', severity.debug);
        return 0;
    }		
};

exports.parseCyberqTemp = function (data, units_metric){
    var temp = parseFloat(data);
    if (isNaN(temp)) {
	    Homey.log('Error while parsing CyberqFloat, not a number ' + JSON.stringify(data), severity.debug);
	    return 0;
	}
	else if (temp == 0)
		{
			return 0;
	}
	else if (units_metric) 
		{
		temp = (temp -320) / 18;
		temp = Math.round(temp);
		//Homey.log('CyberqFloat is converting ' + JSON.stringify(data) + ' fahrenheit to celsius: ' + JSON.stringify(temp), severity.debug);
		return temp;
	}
	else {
		temp = temp / 10;
		return temp;
	}
};

exports.parseTenthsF = function (data, units_metric){
	// function to help check what the current metric setting is.
	// Input (data) should be in current metric. But end result always needs te be F in tenth degrees
	
    var temp = parseFloat(data);
    if (isNaN(temp)) {
	    Homey.log('Error while parsing TenthsF, not a number ' + JSON.stringify(data), severity.debug);
	    return 0;
	}
	else if (temp == 0)
		{
			return 0;
	}
	else if (units_metric) 
		{
		// asuming end user entered (whole - not tenths) degrees celsius
		temp = temp * 1.8 + 32;
		temp = Math.round(temp,1);
		return temp;
	}
	else {
		// asuming end user entered degrees fahrenheit
		temp = Math.round(temp,1);
		return temp;
	}
};

exports.parseCyberqFloat = function (data){
    var number = parseFloat(data);
    if (isNaN(number)) {
	    Homey.log('Error while parsing CyberqStatus, not a number ' + JSON.stringify(data), severity.debug);
	    return 0;
	}
	else {
		return number;
	}
};

/**
 * Helper function to test weather data
 * @param data Data to test
 * @returns {object} returns the weather object or a empty string the data was null or undefined
 */
exports.testCyberqData = function (data) {
    if (!this.value_exist(data)) {
        Homey.log('Test CyberQ data: Value was undefined or null, returning empty string' + JSON.stringify(data), severity.debug);
        return "";
    }
    else if (data == "open")
    	{
	    return 0;
    }
    else return data;
};

# com.bbqguru.cyberq
BBQ Guru CyberQ app for Homey

Just started working on the idea of an App for Homey that connects with your BBQ Guru's CyberQ Wifi.
Homey could tell you what is going on and you will be able to make some awesome flows with that information.

For a starter, this is my first GitHub project ever and I just got my Homey yesterday afternoon. I know some basic programming and have made some really simple projects in the past. But this is a whole new chapter for me. So bear with me on this!

First goal would be to read out the XML data from the CyberQ and let Homey use the data.

For example:
* "BBQ Started, currently at 180 degrees"
* "Diner time! Food <probename> has finished"
* "Food <probename> is almost ready"
* "Food <probename> is 5 degrees from reaching the goal of 120 degrees"

Next goal could be to do more intelligent stuff even the CyberQ cannot tell you.

For example:
* "It seems like your charcoal is running out"
* "Somebody left the lid open"
* "Did you probe fall out?"

And, if I find out how to do it we could set the probe setting trough homey

* "Set probe name"
* "Set desired temperature (both pit probe and food probes)"
* "Set cook timer"

# Introduction

BBQ Guru CyberQ app for Homey

Being a BBQ enthousiast I started working on my very first app the day after my Homey arrived. 

The idea is to create an App for Homey that connects with your BBQ Guru's CyberQ Wifi.
Homey could tell you what is going on and you will be able to make some awesome flows with that information.

Had quite some challenges to overcome, eventually even stopped working on the app although all functions worked (for me). And then, without doing anything, just waiting and reloading the code onto homey. My biggest bug got solved (remembering the IP-address).

Update 9 april 2017: almost 700 flows are possible at the moment! Now working to finish it up, so it can use the ip-address you set for example ;)

Update 24 august 2017: Didn't do anything for quite some time, but my problem of not being able to get the device ip-address out of homey (after a reboot for example) needs to be fixed before the summer ends... So working on it

# What to expect?

I started of with some simple reading, like the temperature and delta betweend current and desired temperature.
But, soon after I created a whole list of options... Here it is

## If

* CyberQ went offline
* CyberQ came online
* Probe X temperature has changed by Y
* Probe X temperature is higer than Y
* Probe X temperature is lower than Y
* Probe X temperature is less than Y degrees/percent from target
* Cook status changed to Y
* Probe X status change to Y
* Timer was activated
* Timer is less than Y seconds
* Timer finished

## And

* CyberQ is online/offline
* Probe X name is Y
* Probe X currect/target temp is higher/lower than Y
* Probe X less/more than Y degrees/percent from target
* Cook status is (not) equal to Y
* Probe X status is (not) equal to Y
* Fan output is lower/higher than Y percent
* Timer is more/less than Y (HH:MM:SS)

## Then

* Probe X name to Y
* Probe X target to Y
* Timer to Y (HH:MM:SS)
* Alarm beep (disable/volume 1-5)
* Key beep (disable/enable)
* Scrolling (disable/enable)
* Backlight (percentage)
* Contrast (percentage)
* Cookhold disable/enable
* Timeout (no action, hold, alarm, shutdown)
* Alarm deviation (
* Ramp (disable/probe 1-3)
* Open lid detection (disable/enable)
* Propertional band (
* Mail alarm (off, port 25/465/587)

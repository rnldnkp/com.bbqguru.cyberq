# Introduction

BBQ Guru CyberQ Wifi app for Homey

Being a BBQ enthousiast I started working on my very first app the day after my Homey arrived. 

The idea is to create an App for Homey that connects with your BBQ Guru's CyberQ Wifi.
Homey could tell you what is going on and you will be able to make some awesome flows with that information.

Had quite some challenges to overcome, eventually even stopped working on the app although all functions worked (using some static info). Didn't quite figure out how to read some information from Homey and use it within the app (passing it along all functions). 

Seem to have fixed this though. That means BETA time!

# A what? CyberQ?
CyberQ Wifi is a device made by BBQ Guru.
It's a wireless controller for your BBQ. It measures cook/probe temperatures and uses the fan to keep the BBQ at the desired temperature.

# What to expect?

I started of with some simple readings, like the temperature and delta between current and desired temperature.
But, soon after I created a whole list of thing that could be done... 

Here are the options, which create 700+ combinations!

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

# What might be next

Not sure how many other features I'm able to add. But there's room for improvements.
My lack of experience made me copy/reuse a lot of functions from other apps. I'm sure I didn't place them all in the optimal place. Good thing these devices are too expensive to have two, since I'm not sure the app can really handle two...

# To consider

I'm not a professional developer, never made an app like this before.
While I try to make sure this app works, I can't pay my bills with it. So bare with me while I try to devide my time between (paid) work, my private life and all other things like this app.

# Thanks
A big thank you goes out to InversionNL without him knowing it. His Wunderground app inspired me the most while they don't even seem to look-a-like. ;)

Next, thanks to the guys at Sybrand's Place (Lubbert, Marijn, Max) for creating such a fine place to discuss Athom with each other. Everyone who likes to create something should visit (check the forum/slack for more info).

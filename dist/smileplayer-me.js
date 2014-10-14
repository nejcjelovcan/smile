/*!
* MediaElement.js
* HTML5 <video> and <audio> shim and player
* http://mediaelementjs.com/
*
* Creates a JavaScript object that mimics HTML5 MediaElement API
* for browsers that don't understand HTML5 or can't play the provided codec
* Can play MP4 (H.264), Ogg, WebM, FLV, WMV, WMA, ACC, and MP3
*
* Copyright 2010-2014, John Dyer (http://j.hn)
* License: MIT
*
*/
// Namespace
var mejs = mejs || {};

// version number
mejs.version = '2.14.2'; 


// player number (for missing, same id attr)
mejs.meIndex = 0;

// media types accepted by plugins
mejs.plugins = {
	silverlight: [
		{version: [3,0], types: ['video/mp4','video/m4v','video/mov','video/wmv','audio/wma','audio/m4a','audio/mp3','audio/wav','audio/mpeg']}
	],
	flash: [
		{version: [9,0,124], types: ['video/mp4','video/m4v','video/mov','video/flv','video/rtmp','video/x-flv','audio/flv','audio/x-flv','audio/mp3','audio/m4a','audio/mpeg', 'video/youtube', 'video/x-youtube']}
		//,{version: [12,0], types: ['video/webm']} // for future reference (hopefully!)
	],
	youtube: [
		{version: null, types: ['video/youtube', 'video/x-youtube', 'audio/youtube', 'audio/x-youtube']}
	],
	vimeo: [
		{version: null, types: ['video/vimeo', 'video/x-vimeo']}
	]
};

/*
Utility methods
*/
mejs.Utility = {
	encodeUrl: function(url) {
		return encodeURIComponent(url); //.replace(/\?/gi,'%3F').replace(/=/gi,'%3D').replace(/&/gi,'%26');
	},
	escapeHTML: function(s) {
		return s.toString().split('&').join('&amp;').split('<').join('&lt;').split('"').join('&quot;');
	},
	absolutizeUrl: function(url) {
		var el = document.createElement('div');
		el.innerHTML = '<a href="' + this.escapeHTML(url) + '">x</a>';
		return el.firstChild.href;
	},
	getScriptPath: function(scriptNames) {
		var
			i = 0,
			j,
			codePath = '',
			testname = '',
			slashPos,
			filenamePos,
			scriptUrl,
			scriptPath,			
			scriptFilename,
			scripts = document.getElementsByTagName('script'),
			il = scripts.length,
			jl = scriptNames.length;
			
		// go through all <script> tags
		for (; i < il; i++) {
			scriptUrl = scripts[i].src;
			slashPos = scriptUrl.lastIndexOf('/');
			if (slashPos > -1) {
				scriptFilename = scriptUrl.substring(slashPos + 1);
				scriptPath = scriptUrl.substring(0, slashPos + 1);
			} else {
				scriptFilename = scriptUrl;
				scriptPath = '';			
			}
			
			// see if any <script> tags have a file name that matches the 
			for (j = 0; j < jl; j++) {
				testname = scriptNames[j];
				filenamePos = scriptFilename.indexOf(testname);
				if (filenamePos > -1) {
					codePath = scriptPath;
					break;
				}
			}
			
			// if we found a path, then break and return it
			if (codePath !== '') {
				break;
			}
		}
		
		// send the best path back
		return codePath;
	},
	secondsToTimeCode: function(time, forceHours, showFrameCount, fps) {
		//add framecount
		if (typeof showFrameCount == 'undefined') {
		    showFrameCount=false;
		} else if(typeof fps == 'undefined') {
		    fps = 25;
		}
	
		var hours = Math.floor(time / 3600) % 24,
			minutes = Math.floor(time / 60) % 60,
			seconds = Math.floor(time % 60),
			frames = Math.floor(((time % 1)*fps).toFixed(3)),
			result = 
					( (forceHours || hours > 0) ? (hours < 10 ? '0' + hours : hours) + ':' : '')
						+ (minutes < 10 ? '0' + minutes : minutes) + ':'
						+ (seconds < 10 ? '0' + seconds : seconds)
						+ ((showFrameCount) ? ':' + (frames < 10 ? '0' + frames : frames) : '');
	
		return result;
	},
	
	timeCodeToSeconds: function(hh_mm_ss_ff, forceHours, showFrameCount, fps){
		if (typeof showFrameCount == 'undefined') {
		    showFrameCount=false;
		} else if(typeof fps == 'undefined') {
		    fps = 25;
		}
	
		var tc_array = hh_mm_ss_ff.split(":"),
			tc_hh = parseInt(tc_array[0], 10),
			tc_mm = parseInt(tc_array[1], 10),
			tc_ss = parseInt(tc_array[2], 10),
			tc_ff = 0,
			tc_in_seconds = 0;
		
		if (showFrameCount) {
		    tc_ff = parseInt(tc_array[3])/fps;
		}
		
		tc_in_seconds = ( tc_hh * 3600 ) + ( tc_mm * 60 ) + tc_ss + tc_ff;
		
		return tc_in_seconds;
	},
	

	convertSMPTEtoSeconds: function (SMPTE) {
		if (typeof SMPTE != 'string') 
			return false;

		SMPTE = SMPTE.replace(',', '.');
		
		var secs = 0,
			decimalLen = (SMPTE.indexOf('.') != -1) ? SMPTE.split('.')[1].length : 0,
			multiplier = 1;
		
		SMPTE = SMPTE.split(':').reverse();
		
		for (var i = 0; i < SMPTE.length; i++) {
			multiplier = 1;
			if (i > 0) {
				multiplier = Math.pow(60, i); 
			}
			secs += Number(SMPTE[i]) * multiplier;
		}
		return Number(secs.toFixed(decimalLen));
	},	
	
	/* borrowed from SWFObject: http://code.google.com/p/swfobject/source/browse/trunk/swfobject/src/swfobject.js#474 */
	removeSwf: function(id) {
		var obj = document.getElementById(id);
		if (obj && /object|embed/i.test(obj.nodeName)) {
			if (mejs.MediaFeatures.isIE) {
				obj.style.display = "none";
				(function(){
					if (obj.readyState == 4) {
						mejs.Utility.removeObjectInIE(id);
					} else {
						setTimeout(arguments.callee, 10);
					}
				})();
			} else {
				obj.parentNode.removeChild(obj);
			}
		}
	},
	removeObjectInIE: function(id) {
		var obj = document.getElementById(id);
		if (obj) {
			for (var i in obj) {
				if (typeof obj[i] == "function") {
					obj[i] = null;
				}
			}
			obj.parentNode.removeChild(obj);
		}		
	}
};


// Core detector, plugins are added below
mejs.PluginDetector = {

	// main public function to test a plug version number PluginDetector.hasPluginVersion('flash',[9,0,125]);
	hasPluginVersion: function(plugin, v) {
		var pv = this.plugins[plugin];
		v[1] = v[1] || 0;
		v[2] = v[2] || 0;
		return (pv[0] > v[0] || (pv[0] == v[0] && pv[1] > v[1]) || (pv[0] == v[0] && pv[1] == v[1] && pv[2] >= v[2])) ? true : false;
	},

	// cached values
	nav: window.navigator,
	ua: window.navigator.userAgent.toLowerCase(),

	// stored version numbers
	plugins: [],

	// runs detectPlugin() and stores the version number
	addPlugin: function(p, pluginName, mimeType, activeX, axDetect) {
		this.plugins[p] = this.detectPlugin(pluginName, mimeType, activeX, axDetect);
	},

	// get the version number from the mimetype (all but IE) or ActiveX (IE)
	detectPlugin: function(pluginName, mimeType, activeX, axDetect) {

		var version = [0,0,0],
			description,
			i,
			ax;

		// Firefox, Webkit, Opera
		if (typeof(this.nav.plugins) != 'undefined' && typeof this.nav.plugins[pluginName] == 'object') {
			description = this.nav.plugins[pluginName].description;
			if (description && !(typeof this.nav.mimeTypes != 'undefined' && this.nav.mimeTypes[mimeType] && !this.nav.mimeTypes[mimeType].enabledPlugin)) {
				version = description.replace(pluginName, '').replace(/^\s+/,'').replace(/\sr/gi,'.').split('.');
				for (i=0; i<version.length; i++) {
					version[i] = parseInt(version[i].match(/\d+/), 10);
				}
			}
		// Internet Explorer / ActiveX
		} else if (typeof(window.ActiveXObject) != 'undefined') {
			try {
				ax = new ActiveXObject(activeX);
				if (ax) {
					version = axDetect(ax);
				}
			}
			catch (e) { }
		}
		return version;
	}
};

// Add Flash detection
mejs.PluginDetector.addPlugin('flash','Shockwave Flash','application/x-shockwave-flash','ShockwaveFlash.ShockwaveFlash', function(ax) {
	// adapted from SWFObject
	var version = [],
		d = ax.GetVariable("$version");
	if (d) {
		d = d.split(" ")[1].split(",");
		version = [parseInt(d[0], 10), parseInt(d[1], 10), parseInt(d[2], 10)];
	}
	return version;
});

// Add Silverlight detection
mejs.PluginDetector.addPlugin('silverlight','Silverlight Plug-In','application/x-silverlight-2','AgControl.AgControl', function (ax) {
	// Silverlight cannot report its version number to IE
	// but it does have a isVersionSupported function, so we have to loop through it to get a version number.
	// adapted from http://www.silverlightversion.com/
	var v = [0,0,0,0],
		loopMatch = function(ax, v, i, n) {
			while(ax.isVersionSupported(v[0]+ "."+ v[1] + "." + v[2] + "." + v[3])){
				v[i]+=n;
			}
			v[i] -= n;
		};
	loopMatch(ax, v, 0, 1);
	loopMatch(ax, v, 1, 1);
	loopMatch(ax, v, 2, 10000); // the third place in the version number is usually 5 digits (4.0.xxxxx)
	loopMatch(ax, v, 2, 1000);
	loopMatch(ax, v, 2, 100);
	loopMatch(ax, v, 2, 10);
	loopMatch(ax, v, 2, 1);
	loopMatch(ax, v, 3, 1);

	return v;
});
// add adobe acrobat
/*
PluginDetector.addPlugin('acrobat','Adobe Acrobat','application/pdf','AcroPDF.PDF', function (ax) {
	var version = [],
		d = ax.GetVersions().split(',')[0].split('=')[1].split('.');

	if (d) {
		version = [parseInt(d[0], 10), parseInt(d[1], 10), parseInt(d[2], 10)];
	}
	return version;
});
*/
// necessary detection (fixes for <IE9)
mejs.MediaFeatures = {
	init: function() {
		var
			t = this,
			d = document,
			nav = mejs.PluginDetector.nav,
			ua = mejs.PluginDetector.ua.toLowerCase(),
			i,
			v,
			html5Elements = ['source','track','audio','video'];

		// detect browsers (only the ones that have some kind of quirk we need to work around)
		t.isiPad = (ua.match(/ipad/i) !== null);
		t.isiPhone = (ua.match(/iphone/i) !== null);
		t.isiOS = t.isiPhone || t.isiPad;
		t.isAndroid = (ua.match(/android/i) !== null);
		t.isBustedAndroid = (ua.match(/android 2\.[12]/) !== null);
		t.isBustedNativeHTTPS = (location.protocol === 'https:' && (ua.match(/android [12]\./) !== null || ua.match(/macintosh.* version.* safari/) !== null));
		t.isIE = (nav.appName.toLowerCase().indexOf("microsoft") != -1 || nav.appName.toLowerCase().match(/trident/gi) !== null);
		t.isChrome = (ua.match(/chrome/gi) !== null);
		t.isFirefox = (ua.match(/firefox/gi) !== null);
		t.isWebkit = (ua.match(/webkit/gi) !== null);
		t.isGecko = (ua.match(/gecko/gi) !== null) && !t.isWebkit && !t.isIE;
		t.isOpera = (ua.match(/opera/gi) !== null);
		t.hasTouch = ('ontouchstart' in window); //  && window.ontouchstart != null); // this breaks iOS 7
		
		// borrowed from Modernizr
		t.svg = !! document.createElementNS &&
				!! document.createElementNS('http://www.w3.org/2000/svg','svg').createSVGRect;

		// create HTML5 media elements for IE before 9, get a <video> element for fullscreen detection
		for (i=0; i<html5Elements.length; i++) {
			v = document.createElement(html5Elements[i]);
		}
		
		t.supportsMediaTag = (typeof v.canPlayType !== 'undefined' || t.isBustedAndroid);

		// Fix for IE9 on Windows 7N / Windows 7KN (Media Player not installer)
		try{
			v.canPlayType("video/mp4");
		}catch(e){
			t.supportsMediaTag = false;
		}

		// detect native JavaScript fullscreen (Safari/Firefox only, Chrome still fails)
		
		// iOS
		t.hasSemiNativeFullScreen = (typeof v.webkitEnterFullscreen !== 'undefined');
		
		// W3C
		t.hasNativeFullscreen = (typeof v.requestFullscreen !== 'undefined');
		
		// webkit/firefox/IE11+
		t.hasWebkitNativeFullScreen = (typeof v.webkitRequestFullScreen !== 'undefined');
		t.hasMozNativeFullScreen = (typeof v.mozRequestFullScreen !== 'undefined');
		t.hasMsNativeFullScreen = (typeof v.msRequestFullscreen !== 'undefined');
		
		t.hasTrueNativeFullScreen = (t.hasWebkitNativeFullScreen || t.hasMozNativeFullScreen || t.hasMsNativeFullScreen);
		t.nativeFullScreenEnabled = t.hasTrueNativeFullScreen;
		
		// Enabled?
		if (t.hasMozNativeFullScreen) {
			t.nativeFullScreenEnabled = document.mozFullScreenEnabled;
		} else if (t.hasMsNativeFullScreen) {
			t.nativeFullScreenEnabled = document.msFullscreenEnabled;		
		}
		
		if (t.isChrome) {
			t.hasSemiNativeFullScreen = false;
		}
		
		if (t.hasTrueNativeFullScreen) {
			
			t.fullScreenEventName = '';
			if (t.hasWebkitNativeFullScreen) { 
				t.fullScreenEventName = 'webkitfullscreenchange';
				
			} else if (t.hasMozNativeFullScreen) {
				t.fullScreenEventName = 'mozfullscreenchange';
				
			} else if (t.hasMsNativeFullScreen) {
				t.fullScreenEventName = 'MSFullscreenChange';
			}
			
			t.isFullScreen = function() {
				if (v.mozRequestFullScreen) {
					return d.mozFullScreen;
				
				} else if (v.webkitRequestFullScreen) {
					return d.webkitIsFullScreen;
				
				} else if (v.hasMsNativeFullScreen) {
					return d.msFullscreenElement !== null;
				}
			}
					
			t.requestFullScreen = function(el) {
		
				if (t.hasWebkitNativeFullScreen) {
					el.webkitRequestFullScreen();
					
				} else if (t.hasMozNativeFullScreen) {
					el.mozRequestFullScreen();

				} else if (t.hasMsNativeFullScreen) {
					el.msRequestFullscreen();

				}
			}
			
			t.cancelFullScreen = function() {				
				if (t.hasWebkitNativeFullScreen) {
					document.webkitCancelFullScreen();
					
				} else if (t.hasMozNativeFullScreen) {
					document.mozCancelFullScreen();
					
				} else if (t.hasMsNativeFullScreen) {
					document.msExitFullscreen();
					
				}
			}	
			
		}
		
		
		// OS X 10.5 can't do this even if it says it can :(
		if (t.hasSemiNativeFullScreen && ua.match(/mac os x 10_5/i)) {
			t.hasNativeFullScreen = false;
			t.hasSemiNativeFullScreen = false;
		}
		
	}
};
mejs.MediaFeatures.init();

/*
extension methods to <video> or <audio> object to bring it into parity with PluginMediaElement (see below)
*/
mejs.HtmlMediaElement = {
	pluginType: 'native',
	isFullScreen: false,

	setCurrentTime: function (time) {
		this.currentTime = time;
	},

	setMuted: function (muted) {
		this.muted = muted;
	},

	setVolume: function (volume) {
		this.volume = volume;
	},

	// for parity with the plugin versions
	stop: function () {
		this.pause();
	},

	// This can be a url string
	// or an array [{src:'file.mp4',type:'video/mp4'},{src:'file.webm',type:'video/webm'}]
	setSrc: function (url) {
		
		// Fix for IE9 which can't set .src when there are <source> elements. Awesome, right?
		var 
			existingSources = this.getElementsByTagName('source');
		while (existingSources.length > 0){
			this.removeChild(existingSources[0]);
		}
	
		if (typeof url == 'string') {
			this.src = url;
		} else {
			var i, media;

			for (i=0; i<url.length; i++) {
				media = url[i];
				if (this.canPlayType(media.type)) {
					this.src = media.src;
					break;
				}
			}
		}
	},

	setVideoSize: function (width, height) {
		this.width = width;
		this.height = height;
	}
};

/*
Mimics the <video/audio> element by calling Flash's External Interface or Silverlights [ScriptableMember]
*/
mejs.PluginMediaElement = function (pluginid, pluginType, mediaUrl) {
	this.id = pluginid;
	this.pluginType = pluginType;
	this.src = mediaUrl;
	this.events = {};
	this.attributes = {};
};

// JavaScript values and ExternalInterface methods that match HTML5 video properties methods
// http://www.adobe.com/livedocs/flash/9.0/ActionScriptLangRefV3/fl/video/FLVPlayback.html
// http://www.whatwg.org/specs/web-apps/current-work/multipage/video.html
mejs.PluginMediaElement.prototype = {

	// special
	pluginElement: null,
	pluginType: '',
	isFullScreen: false,

	// not implemented :(
	playbackRate: -1,
	defaultPlaybackRate: -1,
	seekable: [],
	played: [],

	// HTML5 read-only properties
	paused: true,
	ended: false,
	seeking: false,
	duration: 0,
	error: null,
	tagName: '',

	// HTML5 get/set properties, but only set (updated by event handlers)
	muted: false,
	volume: 1,
	currentTime: 0,

	// HTML5 methods
	play: function () {
		if (this.pluginApi != null) {
			if (this.pluginType == 'youtube' || this.pluginType == 'vimeo') {
				this.pluginApi.playVideo();
			} else {
				this.pluginApi.playMedia();
			}
			this.paused = false;
		}
	},
	load: function () {
		if (this.pluginApi != null) {
			if (this.pluginType == 'youtube' || this.pluginType == 'vimeo') {
			} else {
				this.pluginApi.loadMedia();
			}
			
			this.paused = false;
		}
	},
	pause: function () {
		if (this.pluginApi != null) {
			if (this.pluginType == 'youtube' || this.pluginType == 'vimeo') {
				this.pluginApi.pauseVideo();
			} else {
				this.pluginApi.pauseMedia();
			}			
			
			
			this.paused = true;
		}
	},
	stop: function () {
		if (this.pluginApi != null) {
			if (this.pluginType == 'youtube' || this.pluginType == 'vimeo') {
				this.pluginApi.stopVideo();
			} else {
				this.pluginApi.stopMedia();
			}	
			this.paused = true;
		}
	},
	canPlayType: function(type) {
		var i,
			j,
			pluginInfo,
			pluginVersions = mejs.plugins[this.pluginType];

		for (i=0; i<pluginVersions.length; i++) {
			pluginInfo = pluginVersions[i];

			// test if user has the correct plugin version
			if (mejs.PluginDetector.hasPluginVersion(this.pluginType, pluginInfo.version)) {

				// test for plugin playback types
				for (j=0; j<pluginInfo.types.length; j++) {
					// find plugin that can play the type
					if (type == pluginInfo.types[j]) {
						return 'probably';
					}
				}
			}
		}

		return '';
	},
	
	positionFullscreenButton: function(x,y,visibleAndAbove) {
		if (this.pluginApi != null && this.pluginApi.positionFullscreenButton) {
			this.pluginApi.positionFullscreenButton(Math.floor(x),Math.floor(y),visibleAndAbove);
		}
	},
	
	hideFullscreenButton: function() {
		if (this.pluginApi != null && this.pluginApi.hideFullscreenButton) {
			this.pluginApi.hideFullscreenButton();
		}		
	},	
	

	// custom methods since not all JavaScript implementations support get/set

	// This can be a url string
	// or an array [{src:'file.mp4',type:'video/mp4'},{src:'file.webm',type:'video/webm'}]
	setSrc: function (url) {
		if (typeof url == 'string') {
			this.pluginApi.setSrc(mejs.Utility.absolutizeUrl(url));
			this.src = mejs.Utility.absolutizeUrl(url);
		} else {
			var i, media;

			for (i=0; i<url.length; i++) {
				media = url[i];
				if (this.canPlayType(media.type)) {
					this.pluginApi.setSrc(mejs.Utility.absolutizeUrl(media.src));
					this.src = mejs.Utility.absolutizeUrl(url);
					break;
				}
			}
		}

	},
	setCurrentTime: function (time) {
		if (this.pluginApi != null) {
			if (this.pluginType == 'youtube' || this.pluginType == 'vimeo') {
				this.pluginApi.seekTo(time);
			} else {
				this.pluginApi.setCurrentTime(time);
			}				
			
			
			
			this.currentTime = time;
		}
	},
	setVolume: function (volume) {
		if (this.pluginApi != null) {
			// same on YouTube and MEjs
			if (this.pluginType == 'youtube' || this.pluginType == 'vimeo') {
				this.pluginApi.setVolume(volume * 100);
			} else {
				this.pluginApi.setVolume(volume);
			}
			this.volume = volume;
		}
	},
	setMuted: function (muted) {
		if (this.pluginApi != null) {
			if (this.pluginType == 'youtube' || this.pluginType == 'vimeo') {
				if (muted) {
					this.pluginApi.mute();
				} else {
					this.pluginApi.unMute();
				}
				this.muted = muted;
				this.dispatchEvent('volumechange');
			} else {
				this.pluginApi.setMuted(muted);
			}
			this.muted = muted;
		}
	},

	// additional non-HTML5 methods
	setVideoSize: function (width, height) {
		
		//if (this.pluginType == 'flash' || this.pluginType == 'silverlight') {
			if ( this.pluginElement.style) {
				this.pluginElement.style.width = width + 'px';
				this.pluginElement.style.height = height + 'px';
			}
			if (this.pluginApi != null && this.pluginApi.setVideoSize) {
				this.pluginApi.setVideoSize(width, height);
			}
		//}
	},

	setFullscreen: function (fullscreen) {
		if (this.pluginApi != null && this.pluginApi.setFullscreen) {
			this.pluginApi.setFullscreen(fullscreen);
		}
	},
	
	enterFullScreen: function() {
		if (this.pluginApi != null && this.pluginApi.setFullscreen) {
			this.setFullscreen(true);
		}		
		
	},
	
	exitFullScreen: function() {
		if (this.pluginApi != null && this.pluginApi.setFullscreen) {
			this.setFullscreen(false);
		}
	},	

	// start: fake events
	addEventListener: function (eventName, callback, bubble) {
		this.events[eventName] = this.events[eventName] || [];
		this.events[eventName].push(callback);
	},
	removeEventListener: function (eventName, callback) {
		if (!eventName) { this.events = {}; return true; }
		var callbacks = this.events[eventName];
		if (!callbacks) return true;
		if (!callback) { this.events[eventName] = []; return true; }
		for (var i = 0; i < callbacks.length; i++) {
			if (callbacks[i] === callback) {
				this.events[eventName].splice(i, 1);
				return true;
			}
		}
		return false;
	},	
	dispatchEvent: function (eventName) {
		var i,
			args,
			callbacks = this.events[eventName];

		if (callbacks) {
			args = Array.prototype.slice.call(arguments, 1);
			for (i = 0; i < callbacks.length; i++) {
				callbacks[i].apply(null, args);
			}
		}
	},
	// end: fake events
	
	// fake DOM attribute methods
	hasAttribute: function(name){
		return (name in this.attributes);  
	},
	removeAttribute: function(name){
		delete this.attributes[name];
	},
	getAttribute: function(name){
		if (this.hasAttribute(name)) {
			return this.attributes[name];
		}
		return '';
	},
	setAttribute: function(name, value){
		this.attributes[name] = value;
	},

	remove: function() {
		mejs.Utility.removeSwf(this.pluginElement.id);
		mejs.MediaPluginBridge.unregisterPluginElement(this.pluginElement.id);
	}
};

// Handles calls from Flash/Silverlight and reports them as native <video/audio> events and properties
mejs.MediaPluginBridge = {

	pluginMediaElements:{},
	htmlMediaElements:{},

	registerPluginElement: function (id, pluginMediaElement, htmlMediaElement) {
		this.pluginMediaElements[id] = pluginMediaElement;
		this.htmlMediaElements[id] = htmlMediaElement;
	},

	unregisterPluginElement: function (id) {
		delete this.pluginMediaElements[id];
		delete this.htmlMediaElements[id];
	},

	// when Flash/Silverlight is ready, it calls out to this method
	initPlugin: function (id) {

		var pluginMediaElement = this.pluginMediaElements[id],
			htmlMediaElement = this.htmlMediaElements[id];

		if (pluginMediaElement) {
			// find the javascript bridge
			switch (pluginMediaElement.pluginType) {
				case "flash":
					pluginMediaElement.pluginElement = pluginMediaElement.pluginApi = document.getElementById(id);
					break;
				case "silverlight":
					pluginMediaElement.pluginElement = document.getElementById(pluginMediaElement.id);
					pluginMediaElement.pluginApi = pluginMediaElement.pluginElement.Content.MediaElementJS;
					break;
			}
	
			if (pluginMediaElement.pluginApi != null && pluginMediaElement.success) {
				pluginMediaElement.success(pluginMediaElement, htmlMediaElement);
			}
		}
	},

	// receives events from Flash/Silverlight and sends them out as HTML5 media events
	// http://www.whatwg.org/specs/web-apps/current-work/multipage/video.html
	fireEvent: function (id, eventName, values) {

		var
			e,
			i,
			bufferedTime,
			pluginMediaElement = this.pluginMediaElements[id];

		if(!pluginMediaElement){
            return;
        }
        
		// fake event object to mimic real HTML media event.
		e = {
			type: eventName,
			target: pluginMediaElement
		};

		// attach all values to element and event object
		for (i in values) {
			pluginMediaElement[i] = values[i];
			e[i] = values[i];
		}

		// fake the newer W3C buffered TimeRange (loaded and total have been removed)
		bufferedTime = values.bufferedTime || 0;

		e.target.buffered = e.buffered = {
			start: function(index) {
				return 0;
			},
			end: function (index) {
				return bufferedTime;
			},
			length: 1
		};

		pluginMediaElement.dispatchEvent(e.type, e);
	}
};

/*
Default options
*/
mejs.MediaElementDefaults = {
	// allows testing on HTML5, flash, silverlight
	// auto: attempts to detect what the browser can do
	// auto_plugin: prefer plugins and then attempt native HTML5
	// native: forces HTML5 playback
	// shim: disallows HTML5, will attempt either Flash or Silverlight
	// none: forces fallback view
	mode: 'auto',
	// remove or reorder to change plugin priority and availability
	plugins: ['flash','silverlight','youtube','vimeo'],
	// shows debug errors on screen
	enablePluginDebug: false,
	// use plugin for browsers that have trouble with Basic Authentication on HTTPS sites
	httpsBasicAuthSite: false,
	// overrides the type specified, useful for dynamic instantiation
	type: '',
	// path to Flash and Silverlight plugins
	pluginPath: mejs.Utility.getScriptPath(['mediaelement.js','mediaelement.min.js','mediaelement-and-player.js','mediaelement-and-player.min.js']),
	// name of flash file
	flashName: 'flashmediaelement.swf',
	// streamer for RTMP streaming
	flashStreamer: '',
	// turns on the smoothing filter in Flash
	enablePluginSmoothing: false,
	// enabled pseudo-streaming (seek) on .mp4 files
	enablePseudoStreaming: false,
	// start query parameter sent to server for pseudo-streaming
	pseudoStreamingStartQueryParam: 'start',
	// name of silverlight file
	silverlightName: 'silverlightmediaelement.xap',
	// default if the <video width> is not specified
	defaultVideoWidth: 480,
	// default if the <video height> is not specified
	defaultVideoHeight: 270,
	// overrides <video width>
	pluginWidth: -1,
	// overrides <video height>
	pluginHeight: -1,
	// additional plugin variables in 'key=value' form
	pluginVars: [],	
	// rate in milliseconds for Flash and Silverlight to fire the timeupdate event
	// larger number is less accurate, but less strain on plugin->JavaScript bridge
	timerRate: 250,
	// initial volume for player
	startVolume: 0.8,
	success: function () { },
	error: function () { }
};

/*
Determines if a browser supports the <video> or <audio> element
and returns either the native element or a Flash/Silverlight version that
mimics HTML5 MediaElement
*/
mejs.MediaElement = function (el, o) {
	return mejs.HtmlMediaElementShim.create(el,o);
};

mejs.HtmlMediaElementShim = {

	create: function(el, o) {
		var
			options = mejs.MediaElementDefaults,
			htmlMediaElement = (typeof(el) == 'string') ? document.getElementById(el) : el,
			tagName = htmlMediaElement.tagName.toLowerCase(),
			isMediaTag = (tagName === 'audio' || tagName === 'video'),
			src = (isMediaTag) ? htmlMediaElement.getAttribute('src') : htmlMediaElement.getAttribute('href'),
			poster = htmlMediaElement.getAttribute('poster'),
			autoplay =  htmlMediaElement.getAttribute('autoplay'),
			preload =  htmlMediaElement.getAttribute('preload'),
			controls =  htmlMediaElement.getAttribute('controls'),
			playback,
			prop;

		// extend options
		for (prop in o) {
			options[prop] = o[prop];
		}

		// clean up attributes
		src = 		(typeof src == 'undefined' 	|| src === null || src == '') ? null : src;		
		poster =	(typeof poster == 'undefined' 	|| poster === null) ? '' : poster;
		preload = 	(typeof preload == 'undefined' 	|| preload === null || preload === 'false') ? 'none' : preload;
		autoplay = 	!(typeof autoplay == 'undefined' || autoplay === null || autoplay === 'false');
		controls = 	!(typeof controls == 'undefined' || controls === null || controls === 'false');

		// test for HTML5 and plugin capabilities
		playback = this.determinePlayback(htmlMediaElement, options, mejs.MediaFeatures.supportsMediaTag, isMediaTag, src);
		playback.url = (playback.url !== null) ? mejs.Utility.absolutizeUrl(playback.url) : '';

		if (playback.method == 'native') {
			// second fix for android
			if (mejs.MediaFeatures.isBustedAndroid) {
				htmlMediaElement.src = playback.url;
				htmlMediaElement.addEventListener('click', function() {
					htmlMediaElement.play();
				}, false);
			}
		
			// add methods to native HTMLMediaElement
			return this.updateNative(playback, options, autoplay, preload);
		} else if (playback.method !== '') {
			// create plugin to mimic HTMLMediaElement
			
			return this.createPlugin( playback,  options, poster, autoplay, preload, controls);
		} else {
			// boo, no HTML5, no Flash, no Silverlight.
			this.createErrorMessage( playback, options, poster );
			
			return this;
		}
	},
	
	determinePlayback: function(htmlMediaElement, options, supportsMediaTag, isMediaTag, src) {
		var
			mediaFiles = [],
			i,
			j,
			k,
			l,
			n,
			type,
			result = { method: '', url: '', htmlMediaElement: htmlMediaElement, isVideo: (htmlMediaElement.tagName.toLowerCase() != 'audio')},
			pluginName,
			pluginVersions,
			pluginInfo,
			dummy,
			media;
			
		// STEP 1: Get URL and type from <video src> or <source src>

		// supplied type overrides <video type> and <source type>
		if (typeof options.type != 'undefined' && options.type !== '') {
			
			// accept either string or array of types
			if (typeof options.type == 'string') {
				mediaFiles.push({type:options.type, url:src});
			} else {
				
				for (i=0; i<options.type.length; i++) {
					mediaFiles.push({type:options.type[i], url:src});
				}
			}

		// test for src attribute first
		} else if (src !== null) {
			type = this.formatType(src, htmlMediaElement.getAttribute('type'));
			mediaFiles.push({type:type, url:src});

		// then test for <source> elements
		} else {
			// test <source> types to see if they are usable
			for (i = 0; i < htmlMediaElement.childNodes.length; i++) {
				n = htmlMediaElement.childNodes[i];
				if (n.nodeType == 1 && n.tagName.toLowerCase() == 'source') {
					src = n.getAttribute('src');
					type = this.formatType(src, n.getAttribute('type'));
					media = n.getAttribute('media');

					if (!media || !window.matchMedia || (window.matchMedia && window.matchMedia(media).matches)) {
						mediaFiles.push({type:type, url:src});
					}
				}
			}
		}
		
		// in the case of dynamicly created players
		// check for audio types
		if (!isMediaTag && mediaFiles.length > 0 && mediaFiles[0].url !== null && this.getTypeFromFile(mediaFiles[0].url).indexOf('audio') > -1) {
			result.isVideo = false;
		}
		

		// STEP 2: Test for playback method
		
		// special case for Android which sadly doesn't implement the canPlayType function (always returns '')
		if (mejs.MediaFeatures.isBustedAndroid) {
			htmlMediaElement.canPlayType = function(type) {
				return (type.match(/video\/(mp4|m4v)/gi) !== null) ? 'maybe' : '';
			};
		}		
		

		// test for native playback first
		if (supportsMediaTag && (options.mode === 'auto' || options.mode === 'auto_plugin' || options.mode === 'native')  && !(mejs.MediaFeatures.isBustedNativeHTTPS && options.httpsBasicAuthSite === true)) {
						
			if (!isMediaTag) {

				// create a real HTML5 Media Element 
				dummy = document.createElement( result.isVideo ? 'video' : 'audio');			
				htmlMediaElement.parentNode.insertBefore(dummy, htmlMediaElement);
				htmlMediaElement.style.display = 'none';
				
				// use this one from now on
				result.htmlMediaElement = htmlMediaElement = dummy;
			}
				
			for (i=0; i<mediaFiles.length; i++) {
				// normal check
				if (htmlMediaElement.canPlayType(mediaFiles[i].type).replace(/no/, '') !== '' 
					// special case for Mac/Safari 5.0.3 which answers '' to canPlayType('audio/mp3') but 'maybe' to canPlayType('audio/mpeg')
					|| htmlMediaElement.canPlayType(mediaFiles[i].type.replace(/mp3/,'mpeg')).replace(/no/, '') !== ''
					// special case for m4a supported by detecting mp4 support
					|| htmlMediaElement.canPlayType(mediaFiles[i].type.replace(/m4a/,'mp4')).replace(/no/, '') !== '') {
					result.method = 'native';
					result.url = mediaFiles[i].url;
					break;
				}
			}			
			
			if (result.method === 'native') {
				if (result.url !== null) {
					htmlMediaElement.src = result.url;
				}
			
				// if `auto_plugin` mode, then cache the native result but try plugins.
				if (options.mode !== 'auto_plugin') {
					return result;
				}
			}
		}

		// if native playback didn't work, then test plugins
		if (options.mode === 'auto' || options.mode === 'auto_plugin' || options.mode === 'shim') {
			for (i=0; i<mediaFiles.length; i++) {
				type = mediaFiles[i].type;

				// test all plugins in order of preference [silverlight, flash]
				for (j=0; j<options.plugins.length; j++) {

					pluginName = options.plugins[j];
			
					// test version of plugin (for future features)
					pluginVersions = mejs.plugins[pluginName];				
					
					for (k=0; k<pluginVersions.length; k++) {
						pluginInfo = pluginVersions[k];
					
						// test if user has the correct plugin version
						
						// for youtube/vimeo
						if (pluginInfo.version == null || 
							
							mejs.PluginDetector.hasPluginVersion(pluginName, pluginInfo.version)) {

							// test for plugin playback types
							for (l=0; l<pluginInfo.types.length; l++) {
								// find plugin that can play the type
								if (type == pluginInfo.types[l]) {
									result.method = pluginName;
									result.url = mediaFiles[i].url;
									return result;
								}
							}
						}
					}
				}
			}
		}
		
		// at this point, being in 'auto_plugin' mode implies that we tried plugins but failed.
		// if we have native support then return that.
		if (options.mode === 'auto_plugin' && result.method === 'native') {
			return result;
		}

		// what if there's nothing to play? just grab the first available
		if (result.method === '' && mediaFiles.length > 0) {
			result.url = mediaFiles[0].url;
		}

		return result;
	},

	formatType: function(url, type) {
		var ext;

		// if no type is supplied, fake it with the extension
		if (url && !type) {		
			return this.getTypeFromFile(url);
		} else {
			// only return the mime part of the type in case the attribute contains the codec
			// see http://www.whatwg.org/specs/web-apps/current-work/multipage/video.html#the-source-element
			// `video/mp4; codecs="avc1.42E01E, mp4a.40.2"` becomes `video/mp4`
			
			if (type && ~type.indexOf(';')) {
				return type.substr(0, type.indexOf(';')); 
			} else {
				return type;
			}
		}
	},
	
	getTypeFromFile: function(url) {
		url = url.split('?')[0];
		var ext = url.substring(url.lastIndexOf('.') + 1).toLowerCase();
		return (/(mp4|m4v|ogg|ogv|webm|webmv|flv|wmv|mpeg|mov)/gi.test(ext) ? 'video' : 'audio') + '/' + this.getTypeFromExtension(ext);
	},
	
	getTypeFromExtension: function(ext) {
		
		switch (ext) {
			case 'mp4':
			case 'm4v':
			case 'm4a':
				return 'mp4';
			case 'webm':
			case 'webma':
			case 'webmv':	
				return 'webm';
			case 'ogg':
			case 'oga':
			case 'ogv':	
				return 'ogg';
			default:
				return ext;
		}
	},

	createErrorMessage: function(playback, options, poster) {
		var 
			htmlMediaElement = playback.htmlMediaElement,
			errorContainer = document.createElement('div');
			
		errorContainer.className = 'me-cannotplay';

		try {
			errorContainer.style.width = htmlMediaElement.width + 'px';
			errorContainer.style.height = htmlMediaElement.height + 'px';
		} catch (e) {}

    if (options.customError) {
      errorContainer.innerHTML = options.customError;
    } else {
      errorContainer.innerHTML = (poster !== '') ?
        '<a href="' + playback.url + '"><img src="' + poster + '" width="100%" height="100%" /></a>' :
        '<a href="' + playback.url + '"><span>' + mejs.i18n.t('Download File') + '</span></a>';
    }

		htmlMediaElement.parentNode.insertBefore(errorContainer, htmlMediaElement);
		htmlMediaElement.style.display = 'none';

		options.error(htmlMediaElement);
	},

	createPlugin:function(playback, options, poster, autoplay, preload, controls) {
		var 
			htmlMediaElement = playback.htmlMediaElement,
			width = 1,
			height = 1,
			pluginid = 'me_' + playback.method + '_' + (mejs.meIndex++),
			pluginMediaElement = new mejs.PluginMediaElement(pluginid, playback.method, playback.url),
			container = document.createElement('div'),
			specialIEContainer,
			node,
			initVars;

		// copy tagName from html media element
		pluginMediaElement.tagName = htmlMediaElement.tagName

		// copy attributes from html media element to plugin media element
		for (var i = 0; i < htmlMediaElement.attributes.length; i++) {
			var attribute = htmlMediaElement.attributes[i];
			if (attribute.specified == true) {
				pluginMediaElement.setAttribute(attribute.name, attribute.value);
			}
		}

		// check for placement inside a <p> tag (sometimes WYSIWYG editors do this)
		node = htmlMediaElement.parentNode;
		while (node !== null && node.tagName.toLowerCase() !== 'body' && node.parentNode != null) {
			if (node.parentNode.tagName.toLowerCase() === 'p') {
				node.parentNode.parentNode.insertBefore(node, node.parentNode);
				break;
			}
			node = node.parentNode;
		}

		if (playback.isVideo) {
			width = (options.pluginWidth > 0) ? options.pluginWidth : (options.videoWidth > 0) ? options.videoWidth : (htmlMediaElement.getAttribute('width') !== null) ? htmlMediaElement.getAttribute('width') : options.defaultVideoWidth;
			height = (options.pluginHeight > 0) ? options.pluginHeight : (options.videoHeight > 0) ? options.videoHeight : (htmlMediaElement.getAttribute('height') !== null) ? htmlMediaElement.getAttribute('height') : options.defaultVideoHeight;
		
			// in case of '%' make sure it's encoded
			width = mejs.Utility.encodeUrl(width);
			height = mejs.Utility.encodeUrl(height);
		
		} else {
			if (options.enablePluginDebug) {
				width = 320;
				height = 240;
			}
		}

		// register plugin
		pluginMediaElement.success = options.success;
		mejs.MediaPluginBridge.registerPluginElement(pluginid, pluginMediaElement, htmlMediaElement);

		// add container (must be added to DOM before inserting HTML for IE)
		container.className = 'me-plugin';
		container.id = pluginid + '_container';
		
		if (playback.isVideo) {
				htmlMediaElement.parentNode.insertBefore(container, htmlMediaElement);
		} else {
				document.body.insertBefore(container, document.body.childNodes[0]);
		}

		// flash/silverlight vars
		initVars = [
			'id=' + pluginid,
			'isvideo=' + ((playback.isVideo) ? "true" : "false"),
			'autoplay=' + ((autoplay) ? "true" : "false"),
			'preload=' + preload,
			'width=' + width,
			'startvolume=' + options.startVolume,
			'timerrate=' + options.timerRate,
			'flashstreamer=' + options.flashStreamer,
			'height=' + height,
      'pseudostreamstart=' + options.pseudoStreamingStartQueryParam];

		if (playback.url !== null) {
			if (playback.method == 'flash') {
				initVars.push('file=' + mejs.Utility.encodeUrl(playback.url));
			} else {
				initVars.push('file=' + playback.url);
			}
		}
		if (options.enablePluginDebug) {
			initVars.push('debug=true');
		}
		if (options.enablePluginSmoothing) {
			initVars.push('smoothing=true');
		}
    if (options.enablePseudoStreaming) {
      initVars.push('pseudostreaming=true');
    }
		if (controls) {
			initVars.push('controls=true'); // shows controls in the plugin if desired
		}
		if (options.pluginVars) {
			initVars = initVars.concat(options.pluginVars);
		}		

		switch (playback.method) {
			case 'silverlight':
				container.innerHTML =
'<object data="data:application/x-silverlight-2," type="application/x-silverlight-2" id="' + pluginid + '" name="' + pluginid + '" width="' + width + '" height="' + height + '" class="mejs-shim">' +
'<param name="initParams" value="' + initVars.join(',') + '" />' +
'<param name="windowless" value="true" />' +
'<param name="background" value="black" />' +
'<param name="minRuntimeVersion" value="3.0.0.0" />' +
'<param name="autoUpgrade" value="true" />' +
'<param name="source" value="' + options.pluginPath + options.silverlightName + '" />' +
'</object>';
					break;

			case 'flash':

				if (mejs.MediaFeatures.isIE) {
					specialIEContainer = document.createElement('div');
					container.appendChild(specialIEContainer);
					specialIEContainer.outerHTML =
'<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" codebase="//download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab" ' +
'id="' + pluginid + '" width="' + width + '" height="' + height + '" class="mejs-shim">' +
'<param name="movie" value="' + options.pluginPath + options.flashName + '?x=' + (new Date()) + '" />' +
'<param name="flashvars" value="' + initVars.join('&amp;') + '" />' +
'<param name="quality" value="high" />' +
'<param name="bgcolor" value="#000000" />' +
'<param name="wmode" value="transparent" />' +
'<param name="allowScriptAccess" value="always" />' +
'<param name="allowFullScreen" value="true" />' +
'<param name="scale" value="default" />' + 
'</object>';

				} else {

					container.innerHTML =
'<embed id="' + pluginid + '" name="' + pluginid + '" ' +
'play="true" ' +
'loop="false" ' +
'quality="high" ' +
'bgcolor="#000000" ' +
'wmode="transparent" ' +
'allowScriptAccess="always" ' +
'allowFullScreen="true" ' +
'type="application/x-shockwave-flash" pluginspage="//www.macromedia.com/go/getflashplayer" ' +
'src="' + options.pluginPath + options.flashName + '" ' +
'flashvars="' + initVars.join('&') + '" ' +
'width="' + width + '" ' +
'height="' + height + '" ' +
'scale="default"' + 
'class="mejs-shim"></embed>';
				}
				break;
			
			case 'youtube':
			
				
				var videoId;
				// youtu.be url from share button
				if (playback.url.lastIndexOf("youtu.be") != -1) {
					videoId = playback.url.substr(playback.url.lastIndexOf('/')+1);
					if (videoId.indexOf('?') != -1) {
						videoId = videoId.substr(0, videoId.indexOf('?'));
					}
				}
				else {
					videoId = playback.url.substr(playback.url.lastIndexOf('=')+1);
				}
				youtubeSettings = {
						container: container,
						containerId: container.id,
						pluginMediaElement: pluginMediaElement,
						pluginId: pluginid,
						videoId: videoId,
						height: height,
						width: width	
					};				
				
				if (mejs.PluginDetector.hasPluginVersion('flash', [10,0,0]) ) {
					mejs.YouTubeApi.createFlash(youtubeSettings);
				} else {
					mejs.YouTubeApi.enqueueIframe(youtubeSettings);		
				}
				
				break;
			
			// DEMO Code. Does NOT work.
			case 'vimeo':
				var player_id = pluginid + "_player";
				pluginMediaElement.vimeoid = playback.url.substr(playback.url.lastIndexOf('/')+1);
				
				container.innerHTML ='<iframe src="//player.vimeo.com/video/' + pluginMediaElement.vimeoid + '?api=1&portrait=0&byline=0&title=0&player_id=' + player_id + '" width="' + width +'" height="' + height +'" frameborder="0" class="mejs-shim" id="' + player_id + '"></iframe>';
				if (typeof($f) == 'function') { // froogaloop available
					var player = $f(container.childNodes[0]);
					player.addEvent('ready', function() {
						player.playVideo = function() {
							player.api('play');
						};
						player.pauseVideo = function() {
							player.api('pause');
						};
                                                player.seekTo = function(seconds) {
                                                        player.api('seekTo', seconds);
                                                };
						function createEvent(player, pluginMediaElement, eventName, e) {
							var obj = {
								type: eventName,
								target: pluginMediaElement
							};
							if (eventName == 'timeupdate') {
								pluginMediaElement.currentTime = obj.currentTime = e.seconds;
								pluginMediaElement.duration = obj.duration = e.duration;
							}
							pluginMediaElement.dispatchEvent(obj.type, obj);
						}
						player.addEvent('play', function() {
							createEvent(player, pluginMediaElement, 'play');
							createEvent(player, pluginMediaElement, 'playing');
						});
						player.addEvent('pause', function() {
							createEvent(player, pluginMediaElement, 'pause');
						});

						player.addEvent('finish', function() {
							createEvent(player, pluginMediaElement, 'ended');
						});
						player.addEvent('playProgress', function(e) {
							createEvent(player, pluginMediaElement, 'timeupdate', e);
						});
						pluginMediaElement.pluginApi = player;

						// init mejs
						mejs.MediaPluginBridge.initPlugin(pluginid);

					});
				}
				else {
					console.warn("You need to include froogaloop for vimeo to work");
				}
				break;			
		}
		// hide original element
		htmlMediaElement.style.display = 'none';
		// prevent browser from autoplaying when using a plugin
		htmlMediaElement.removeAttribute('autoplay');

		// FYI: options.success will be fired by the MediaPluginBridge
		
		return pluginMediaElement;
	},

	updateNative: function(playback, options, autoplay, preload) {
		
		var htmlMediaElement = playback.htmlMediaElement,
			m;
		
		
		// add methods to video object to bring it into parity with Flash Object
		for (m in mejs.HtmlMediaElement) {
			htmlMediaElement[m] = mejs.HtmlMediaElement[m];
		}

		/*
		Chrome now supports preload="none"
		if (mejs.MediaFeatures.isChrome) {
		
			// special case to enforce preload attribute (Chrome doesn't respect this)
			if (preload === 'none' && !autoplay) {
			
				// forces the browser to stop loading (note: fails in IE9)
				htmlMediaElement.src = '';
				htmlMediaElement.load();
				htmlMediaElement.canceledPreload = true;

				htmlMediaElement.addEventListener('play',function() {
					if (htmlMediaElement.canceledPreload) {
						htmlMediaElement.src = playback.url;
						htmlMediaElement.load();
						htmlMediaElement.play();
						htmlMediaElement.canceledPreload = false;
					}
				}, false);
			// for some reason Chrome forgets how to autoplay sometimes.
			} else if (autoplay) {
				htmlMediaElement.load();
				htmlMediaElement.play();
			}
		}
		*/

		// fire success code
		options.success(htmlMediaElement, htmlMediaElement);
		
		return htmlMediaElement;
	}
};

/*
 - test on IE (object vs. embed)
 - determine when to use iframe (Firefox, Safari, Mobile) vs. Flash (Chrome, IE)
 - fullscreen?
*/

// YouTube Flash and Iframe API
mejs.YouTubeApi = {
	isIframeStarted: false,
	isIframeLoaded: false,
	loadIframeApi: function() {
		if (!this.isIframeStarted) {
			var tag = document.createElement('script');
			tag.src = "//www.youtube.com/player_api";
			var firstScriptTag = document.getElementsByTagName('script')[0];
			firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
			this.isIframeStarted = true;
		}
	},
	iframeQueue: [],
	enqueueIframe: function(yt) {
		
		if (this.isLoaded) {
			this.createIframe(yt);
		} else {
			this.loadIframeApi();
			this.iframeQueue.push(yt);
		}
	},
	createIframe: function(settings) {
		
		var
		pluginMediaElement = settings.pluginMediaElement,	
		player = new YT.Player(settings.containerId, {
			height: settings.height,
			width: settings.width,
			videoId: settings.videoId,
			playerVars: {controls:0},
			events: {
				'onReady': function() {
					
					// hook up iframe object to MEjs
					settings.pluginMediaElement.pluginApi = player;
					
					// init mejs
					mejs.MediaPluginBridge.initPlugin(settings.pluginId);
					
					// create timer
					setInterval(function() {
						mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'timeupdate');
					}, 250);					
				},
				'onStateChange': function(e) {
					
					mejs.YouTubeApi.handleStateChange(e.data, player, pluginMediaElement);
					
				}
			}
		});
	},
	
	createEvent: function (player, pluginMediaElement, eventName) {
		var obj = {
			type: eventName,
			target: pluginMediaElement
		};

		if (player && player.getDuration) {
			
			// time 
			pluginMediaElement.currentTime = obj.currentTime = player.getCurrentTime();
			pluginMediaElement.duration = obj.duration = player.getDuration();
			
			// state
			obj.paused = pluginMediaElement.paused;
			obj.ended = pluginMediaElement.ended;			
			
			// sound
			obj.muted = player.isMuted();
			obj.volume = player.getVolume() / 100;
			
			// progress
			obj.bytesTotal = player.getVideoBytesTotal();
			obj.bufferedBytes = player.getVideoBytesLoaded();
			
			// fake the W3C buffered TimeRange
			var bufferedTime = obj.bufferedBytes / obj.bytesTotal * obj.duration;
			
			obj.target.buffered = obj.buffered = {
				start: function(index) {
					return 0;
				},
				end: function (index) {
					return bufferedTime;
				},
				length: 1
			};

		}
		
		// send event up the chain
		pluginMediaElement.dispatchEvent(obj.type, obj);
	},	
	
	iFrameReady: function() {
		
		this.isLoaded = true;
		this.isIframeLoaded = true;
		
		while (this.iframeQueue.length > 0) {
			var settings = this.iframeQueue.pop();
			this.createIframe(settings);
		}	
	},
	
	// FLASH!
	flashPlayers: {},
	createFlash: function(settings) {
		
		this.flashPlayers[settings.pluginId] = settings;
		
		/*
		settings.container.innerHTML =
			'<object type="application/x-shockwave-flash" id="' + settings.pluginId + '" data="//www.youtube.com/apiplayer?enablejsapi=1&amp;playerapiid=' + settings.pluginId  + '&amp;version=3&amp;autoplay=0&amp;controls=0&amp;modestbranding=1&loop=0" ' +
				'width="' + settings.width + '" height="' + settings.height + '" style="visibility: visible; " class="mejs-shim">' +
				'<param name="allowScriptAccess" value="always">' +
				'<param name="wmode" value="transparent">' +
			'</object>';
		*/

		var specialIEContainer,
			youtubeUrl = '//www.youtube.com/apiplayer?enablejsapi=1&amp;playerapiid=' + settings.pluginId  + '&amp;version=3&amp;autoplay=0&amp;controls=0&amp;modestbranding=1&loop=0';
			
		if (mejs.MediaFeatures.isIE) {
			
			specialIEContainer = document.createElement('div');
			settings.container.appendChild(specialIEContainer);
			specialIEContainer.outerHTML = '<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" codebase="//download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab" ' +
'id="' + settings.pluginId + '" width="' + settings.width + '" height="' + settings.height + '" class="mejs-shim">' +
	'<param name="movie" value="' + youtubeUrl + '" />' +
	'<param name="wmode" value="transparent" />' +
	'<param name="allowScriptAccess" value="always" />' +
	'<param name="allowFullScreen" value="true" />' +
'</object>';
		} else {
		settings.container.innerHTML =
			'<object type="application/x-shockwave-flash" id="' + settings.pluginId + '" data="' + youtubeUrl + '" ' +
				'width="' + settings.width + '" height="' + settings.height + '" style="visibility: visible; " class="mejs-shim">' +
				'<param name="allowScriptAccess" value="always">' +
				'<param name="wmode" value="transparent">' +
			'</object>';
		}		
		
	},
	
	flashReady: function(id) {
		var
			settings = this.flashPlayers[id],
			player = document.getElementById(id),
			pluginMediaElement = settings.pluginMediaElement;
		
		// hook up and return to MediaELementPlayer.success	
		pluginMediaElement.pluginApi = 
		pluginMediaElement.pluginElement = player;
		mejs.MediaPluginBridge.initPlugin(id);
		
		// load the youtube video
		player.cueVideoById(settings.videoId);
		
		var callbackName = settings.containerId + '_callback';
		
		window[callbackName] = function(e) {
			mejs.YouTubeApi.handleStateChange(e, player, pluginMediaElement);
		}
		
		player.addEventListener('onStateChange', callbackName);
		
		setInterval(function() {
			mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'timeupdate');
		}, 250);
	},
	
	handleStateChange: function(youTubeState, player, pluginMediaElement) {
		switch (youTubeState) {
			case -1: // not started
				pluginMediaElement.paused = true;
				pluginMediaElement.ended = true;
				mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'loadedmetadata');
				//createYouTubeEvent(player, pluginMediaElement, 'loadeddata');
				break;
			case 0:
				pluginMediaElement.paused = false;
				pluginMediaElement.ended = true;
				mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'ended');
				break;
			case 1:
				pluginMediaElement.paused = false;
				pluginMediaElement.ended = false;				
				mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'play');
				mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'playing');
				break;
			case 2:
				pluginMediaElement.paused = true;
				pluginMediaElement.ended = false;				
				mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'pause');
				break;
			case 3: // buffering
				mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'progress');
				break;
			case 5:
				// cued?
				break;						
			
		}			
		
	}
}
// IFRAME
function onYouTubePlayerAPIReady() {
	mejs.YouTubeApi.iFrameReady();
}
// FLASH
function onYouTubePlayerReady(id) {
	mejs.YouTubeApi.flashReady(id);
}

window.mejs = mejs;
window.MediaElement = mejs.MediaElement;

/*!
 * Adds Internationalization and localization to mediaelement.
 *
 * This file does not contain translations, you have to add the manually.
 * The schema is always the same: me-i18n-locale-[ISO_639-1 Code].js
 *
 * Examples are provided both for german and chinese translation.
 *
 *
 * What is the concept beyond i18n?
 *   http://en.wikipedia.org/wiki/Internationalization_and_localization
 *
 * What langcode should i use?
 *   http://en.wikipedia.org/wiki/ISO_639-1
 *
 *
 * License?
 *
 *   The i18n file uses methods from the Drupal project (drupal.js):
 *     - i18n.methods.t() (modified)
 *     - i18n.methods.checkPlain() (full copy)
 *
 *   The Drupal project is (like mediaelementjs) licensed under GPLv2.
 *    - http://drupal.org/licensing/faq/#q1
 *    - https://github.com/johndyer/mediaelement
 *    - http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 *
 *
 * @author
 *   Tim Latz (latz.tim@gmail.com)
 *
 *
 * @params
 *  - context - document, iframe ..
 *  - exports - CommonJS, window ..
 *
 */
;(function(context, exports, undefined) {
    "use strict";
    var i18n = {
        "locale": {
            "language" : '',
            "strings" : {}
        },
        "methods" : {}
    };
// start i18n


    /**
     * Get language, fallback to browser's language if empty
     */
    i18n.getLanguage = function () {
        var language = i18n.locale.language || window.navigator.userLanguage || window.navigator.language;
        // convert to iso 639-1 (2-letters, lower case)
        return language.substr(0, 2).toLowerCase();
    };

    // i18n fixes for compatibility with WordPress
    if ( typeof mejsL10n != 'undefined' ) {
        i18n.locale.language = mejsL10n.language;
    }



    /**
     * Encode special characters in a plain-text string for display as HTML.
     */
    i18n.methods.checkPlain = function (str) {
        var character, regex,
        replace = {
            '&': '&amp;',
            '"': '&quot;',
            '<': '&lt;',
            '>': '&gt;'
        };
        str = String(str);
        for (character in replace) {
            if (replace.hasOwnProperty(character)) {
                regex = new RegExp(character, 'g');
                str = str.replace(regex, replace[character]);
            }
        }
        return str;
    };

    /**
     * Translate strings to the page language or a given language.
     *
     *
     * @param str
     *   A string containing the English string to translate.
     *
     * @param options
     *   - 'context' (defaults to the default context): The context the source string
     *     belongs to.
     *
     * @return
     *   The translated string, escaped via i18n.methods.checkPlain()
     */
    i18n.methods.t = function (str, options) {

        // Fetch the localized version of the string.
        if (i18n.locale.strings && i18n.locale.strings[options.context] && i18n.locale.strings[options.context][str]) {
            str = i18n.locale.strings[options.context][str];
        }

        return i18n.methods.checkPlain(str);
    };


    /**
     * Wrapper for i18n.methods.t()
     *
     * @see i18n.methods.t()
     * @throws InvalidArgumentException
     */
    i18n.t = function(str, options) {

        if (typeof str === 'string' && str.length > 0) {

            // check every time due language can change for
            // different reasons (translation, lang switcher ..)
            var language = i18n.getLanguage();

            options = options || {
                "context" : language
            };

            return i18n.methods.t(str, options);
        }
        else {
            throw {
                "name" : 'InvalidArgumentException',
                "message" : 'First argument is either not a string or empty.'
            };
        }
    };

// end i18n
    exports.i18n = i18n;
}(document, mejs));

// i18n fixes for compatibility with WordPress
;(function(exports, undefined) {

    "use strict";

    if ( typeof mejsL10n != 'undefined' ) {
        exports[mejsL10n.language] = mejsL10n.strings;
    }

}(mejs.i18n.locale.strings));

/*!
 * This is a i18n.locale language object.
 *
 * German translation by Tim Latz, latz.tim@gmail.com
 *
 * @author
 *   Tim Latz (latz.tim@gmail.com)
 *
 * @see
 *   me-i18n.js
 *
 * @params
 *  - exports - CommonJS, window ..
 */
;(function(exports, undefined) {

    "use strict";

    if (typeof exports.de === 'undefined') {
        exports.de = {
            "Fullscreen" : "Vollbild",
            "Go Fullscreen" : "Vollbild an",
            "Turn off Fullscreen" : "Vollbild aus",
            "Close" : "Schließen"
        };
    }

}(mejs.i18n.locale.strings));
/*!
 * This is a i18n.locale language object.
 *
 * Traditional chinese translation by Tim Latz, latz.tim@gmail.com
 *
 * @author
 *   Tim Latz (latz.tim@gmail.com)
 *
 * @see
 *   me-i18n.js
 *
 * @params
 *  - exports - CommonJS, window ..
 */
;(function(exports, undefined) {

    "use strict";

    if (typeof exports.zh === 'undefined') {
        exports.zh = {
            "Fullscreen" : "全螢幕",
            "Go Fullscreen" : "全屏模式",
            "Turn off Fullscreen" : "退出全屏模式",
            "Close" : "關閉"
        };
    }

}(mejs.i18n.locale.strings));


// EventTarget interface http://www.w3.org/TR/DOM-Level-3-Events/#interface-EventTarget
//(MIT)
/**
 * @author mrdoob / http://mrdoob.com/
 */
(function (window) {
var EventDispatcher = window.EventDispatcher = function () {};
EventDispatcher.prototype = {

	constructor: EventDispatcher,

	apply: function ( object ) {

		object.addEventListener = EventDispatcher.prototype.addEventListener;
		object.hasEventListener = EventDispatcher.prototype.hasEventListener;
		object.removeEventListener = EventDispatcher.prototype.removeEventListener;
		object.dispatchEvent = EventDispatcher.prototype.dispatchEvent;

	},

	addEventListener: function ( type, listener ) {
		if ( this._listeners === undefined ) this._listeners = {};
		var listeners = this._listeners;
		
		if ( listeners[ type ] === undefined ) {
			listeners[ type ] = [];
		}

		if ( listeners[ type ].indexOf( listener ) === - 1 ) {
			listeners[ type ].push( listener );
		}
	},

	hasEventListener: function ( type, listener ) {
		if ( this._listeners === undefined ) return false;
		var listeners = this._listeners;

		if ( listeners[ type ] !== undefined && listeners[ type ].indexOf( listener ) !== - 1 ) {
			return true;
		}
		return false;
	},

	removeEventListener: function ( type, listener ) {
		if ( this._listeners === undefined ) return;
		var listeners = this._listeners;
		var listenerArray = listeners[ type ];

		if ( listenerArray !== undefined ) {
			var index = listenerArray.indexOf( listener );
			if ( index !== - 1 ) {
				listenerArray.splice( index, 1 );
			}
		}
	},

	dispatchEvent: function ( event ) {
		if ( this._listeners === undefined ) return;
		var listeners = this._listeners;
		var listenerArray = listeners[ event.type ];

		if ( listenerArray !== undefined ) {
			event.target = this;
			var array = [];
			var length = listenerArray.length;

			for ( var i = 0; i < length; i ++ ) {
				array[ i ] = listenerArray[ i ];
			}

			for ( var i = 0; i < length; i ++ ) {
				array[ i ].call( this, event );
			}
		}
	}

};
}(window));
/**
    This code is copied from mep-feature-track.js MIT
    bower mediaelement#2.14.2       cached git://github.com/johndyer/mediaelement.git#2.14.2
    used by trackshim.js
*/
(function ($, mejs) {
    /*
    Parses WebVVT format which should be formatted as
    ================================
    WEBVTT
    
    1
    00:00:01,1 --> 00:00:05,000
    A line of text

    2
    00:01:15,1 --> 00:02:05,000
    A second line of text
    
    ===============================

    Adapted from: http://www.delphiki.com/html5/playr
    */
    mejs.TrackFormatParser = {
        webvvt: {
            // match start "chapter-" (or anythingelse)
            pattern_identifier: /^([a-zA-Z]+)?[0-9]+$/,
            pattern_timecode: /^([0-9]{2}:[0-9]{2}:[0-9]{2}([,.][0-9]{1,3})?) --\> ([0-9]{2}:[0-9]{2}:[0-9]{2}([,.][0-9]{3})?)(.*)$/,

            parse: function(trackText) {
                var 
                    i = 0,
                    lines = mejs.TrackFormatParser.split2(trackText, /\r?\n/),
                    entries = {text:[], times:[], ids:[]},
                    idcode,
                    timecode,
                    text;
                for(; i<lines.length; i++) {
                    // check for the line number
                    idcode = this.pattern_identifier.exec(lines[i]);
                    timecode = this.pattern_timecode.exec(lines[i]);
                    if (idcode || timecode){
                        // skip to the next line where the start --> end time code should be
                        if (idcode) {
                            i++;
                            timecode = this.pattern_timecode.exec(lines[i]);
                        }

                        if (timecode && i<lines.length){
                            i++;
                            // grab all the (possibly multi-line) text that follows
                            text = lines[i];
                            i++;
                            while(lines[i] !== '' && i<lines.length){
                                text = text + '\n' + lines[i];
                                i++;
                            }
                            text = $.trim(text).replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, "<a href='$1' target='_blank'>$1</a>");
                            // Text is in a different array so I can use .join
                            entries.text.push(text);
                            entries.ids.push(idcode ? idcode[0] : '');
                            entries.times.push(
                            {
                                start: (mejs.Utility.convertSMPTEtoSeconds(timecode[1]) == 0) ? 0.200 : mejs.Utility.convertSMPTEtoSeconds(timecode[1]),
                                stop: mejs.Utility.convertSMPTEtoSeconds(timecode[3]),
                                settings: timecode[5]
                            });
                        }
                    }
                }
                return entries;
            }
        },
        // Thanks to Justin Capella: https://github.com/johndyer/mediaelement/pull/420
        dfxp: {
            parse: function(trackText) {
                trackText = $(trackText).filter("tt");
                var 
                    i = 0,
                    container = trackText.children("div").eq(0),
                    lines = container.find("p"),
                    styleNode = trackText.find("#" + container.attr("style")),
                    styles,
                    begin,
                    end,
                    text,
                    entries = {text:[], times:[]};


                if (styleNode.length) {
                    var attributes = styleNode.removeAttr("id").get(0).attributes;
                    if (attributes.length) {
                        styles = {};
                        for (i = 0; i < attributes.length; i++) {
                            styles[attributes[i].name.split(":")[1]] = attributes[i].value;
                        }
                    }
                }

                for(i = 0; i<lines.length; i++) {
                    var style;
                    var _temp_times = {
                        start: null,
                        stop: null,
                        style: null
                    };
                    if (lines.eq(i).attr("begin")) _temp_times.start = mejs.Utility.convertSMPTEtoSeconds(lines.eq(i).attr("begin"));
                    if (!_temp_times.start && lines.eq(i-1).attr("end")) _temp_times.start = mejs.Utility.convertSMPTEtoSeconds(lines.eq(i-1).attr("end"));
                    if (lines.eq(i).attr("end")) _temp_times.stop = mejs.Utility.convertSMPTEtoSeconds(lines.eq(i).attr("end"));
                    if (!_temp_times.stop && lines.eq(i+1).attr("begin")) _temp_times.stop = mejs.Utility.convertSMPTEtoSeconds(lines.eq(i+1).attr("begin"));
                    if (styles) {
                        style = "";
                        for (var _style in styles) {
                            style += _style + ":" + styles[_style] + ";";                   
                        }
                    }
                    if (style) _temp_times.style = style;
                    if (_temp_times.start == 0) _temp_times.start = 0.200;
                    entries.times.push(_temp_times);
                    text = $.trim(lines.eq(i).html()).replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, "<a href='$1' target='_blank'>$1</a>");
                    entries.text.push(text);
                    if (entries.times.start == 0) entries.times.start = 2;
                }
                return entries;
            }
        },
        split2: function (text, regex) {
            // normal version for compliant browsers
            // see below for IE fix
            return text.split(regex);
        }
    };
    
    // test for browsers with bad String.split method.
    if ('x\n\ny'.split(/\n/gi).length != 3) {
        // add super slow IE8 and below version
        mejs.TrackFormatParser.split2 = function(text, regex) {
            var 
                parts = [], 
                chunk = '',
                i;

            for (i=0; i<text.length; i++) {
                chunk += text.substring(i,i+1);
                if (regex.test(chunk)) {
                    parts.push(chunk.replace(regex, ''));
                    chunk = '';
                }
            }
            parts.push(chunk);
            return parts;
        }
    }
}(jQuery, mejs));
(function ($, mejs) {

    /**
        Text track shim

        http://html5index.org/Media%20-%20Overview.html

        @TODO .on[eventtype] properties can be implemented fairly easily
            (add one listener for each event type that calls the property if exists)

        @TODO track add and remove events can be handled very nicely with MutationObserver (which can also be shimmed)

        @TODO Safari uses integers (0,1,2) instead of strings (disabled,showing,hidden) for track modes.
        @TODO IE Server MIME type for text/vtt must be set.
    */

    function isFirefox (version) {
        return (new RegExp('Firefox/'+(version||'')).test(navigator.userAgent));
    }

    function setTrackNode (track) {
        $('track').each(function () {
            if (this.track && !this.track.node && (!track || this.track === track)) {
                this.track.node = this;
                if (track) track.node = this;
            }
        });
    }

    // do asap on tracks
    $(function () {setTrackNode();});

    /**
        MediaElementTrackTrait

        This is a trait of methods meant to be injected into MediaElement shim
        (since mediaelement.js does not shim textTrack-related stuff)
    */
    mejs.MediaElementTracksTrait = {
        /**
            addTextTrack
            Default mode of such a track is hidden

            how is it different then HTML5 API
            - it takes options parameter (@see mejs.TextTrack for all the options)
                This is not a problem in native, options argument will simply be ignored
                (and native TextTrack constructor is forbidden anyways - at least chrome - @TODO)
        */
        addTextTrack: function (kind, label, language, options) {
            options || (options = {});
            options.kind = kind; options.label = label; options.language = language;
            var textTrack = new mejs.TextTrack(options);
            this.textTracks.push(textTrack);
            return textTrack;
        },


        /**
            _initTextTracks

            This must be called on mediaElement (plugin OR standard with no texttrack api OR standard with texttrack api only polyfilled)
            ASAP (when dom in mediaElement is ready) in order for shimmed tracks to work correctly

            It will
            1. initialize textTracks property
            2. hook addtrack event to hook modechange event to activate/deactivate listening to timeupdate events on mediaElement
            3. call _parseTextTracks to find all track subelements to given elem and load them to .textTracks
        */
        _initTextTracks: function (elem, parseTracks) {
            var that = this
                shimmed = this.pluginType != 'native' || window.TextTrack.shim
                    || isFirefox();
            if (!this.textTracks) {
                this.textTracks = new mejs.TextTrackList();
            }

            this.textTracks.addEventListener('addtrack', function (e) {
                if (!e.track.node) setTrackNode(e.track);
                // if text tracks are shimmed, set up _activate and _deactivate (which take care of _update calls)
                if (shimmed) {
                    e.track._initTextTrack();
                    if (e.track.mode != 'disabled') {
                        e.track._activate(that);
                    }
                    e.track.addEventListener('modechange', function (e) {
                        if (e.track.mode == 'disabled') e.track._deactivate(that);
                        else e.track._activate(that);
                    });
                } else {
                    e.track._initTextTrack();
                }
            });

            if (parseTracks) {
                this._parseTextTracks(elem);
            }
        },


        /**
            _parseTextTracks

            @TODO MutationObserver to enable (better) addtrack event and removetrack event at all
        */
        _parseTextTracks: function (elem) {
            var that = this, textTrack;
            $(elem).find('track').each(function () {
                var el = $(this)[0];
                textTrack = that.addTextTrack($(el).attr('kind'), $(el).attr('label'), $(el).attr('srclang'),
                    {id: $(el).attr('id'), node: el, src: $(el).attr('src')});
            });
        }

    };

    /**
        TextTrackList shim

        use addTextTrack on mediaelement to add new tracks!

        @TODO
        does not have addtrack, removetrack and change events

        Events
        addtrack        fired when addTextTrack on mediaelement is called @TODO mutationObserver
        removetrack     @TODO achieve this with MutationObserver
        change          @TODO
    */
    mejs.TextTrackList = function () {};
    mejs.TextTrackList.prototype = new Array;
    $.extend(mejs.TextTrackList.prototype, EventDispatcher.prototype, {
        push: function (track) {
            console.warn('Use addTextTrack on player instead of using textTracks as array');
            Array.prototype.push.apply(this, $.makeArray(arguments));
            this.dispatchEvent(new mejs.TrackEvent('addtrack', {track: track}));
            if (track.node && $(track.node).attr('default')) track.setMode('showing');
        },
        getTrackById: function (id) {
            for (var i = 0; i < this.length; i += 1) {
                if (this[i].id == id) return this[i];
            }
        },
        item: function (i) {
            return this[i];
        }
    });

    /**
        TextTrack trait
    */
    mejs.TextTrackTrait = {
        _initTextTrack: function () {
            // fill missing cue ids
            var that = this,
                node = this.node;
            this.ready(function () {
                // since we are ready, request was successful
                if (that.mode == 'disabled') {
                    that.setMode('hidden');
                }
                var cue, id = 1;
                while(cue = that.cues.getCueById('')) {
                    while(that.cues.getCueById(id)) {
                        id += 1;
                    }
                    cue.id = id;
                }
            });

            // poll for readyState changes in FF 31/32
            if (isFirefox(31) || isFirefox(32)) {
                var interval = setInterval(function () {
                    var state = (node._readyState||node.readyState);
                    window.thaaat = that;
                    if (state > 1) {
                        if (state === 2) node.dispatchEvent(new mejs.TrackEvent('load', {track: that}));
                        clearInterval(interval);
                    }
                }, 1000);
            }

            this._bound_update = function (e) { that._update(e); };
        },
        setMode: function (mode) {
            if (this instanceof mejs.TextTrack && this.mode != mode) {
                this._mode = mode;
                this.dispatchEvent(new mejs.TrackEvent('modechange', {track: this}));
            } else if (!(this instanceof mejs.TextTrack) && this._mode != mode) {
                this.mode = mode;
                this.dispatchEvent(new mejs.TrackEvent('modechange', {track: this}));
            }
        },
        getMode: function () {
            if (this instanceof mejs.TextTrack) return this._mode;
            return this.mode;
        },
        ready: function (f) {
            var node = this.node || (this.id && $('#'+this.id)[0]);  // @TODO
            if (node) {
                if ((node._readyState||node.readyState) === 2 || (node._readyState||node.readyState) === 3) {
                    setTimeout(f, 0);
                } else {
                    var cb = function () {
                        if ((node._readyState||node.readyState) > 1) {
                            node.removeEventListener('load', cb);
                            node.removeEventListener('readystatechange', cb);
                            setTimeout(f, 0);
                        }
                    };
                    node.addEventListener('load', cb);
                    node.addEventListener('readystatechange', cb);
                }
            } else {
                console.warn('TextTrack id missing! .ready only works with native TextTrack support if <track> node has id attribute set!');
            }
            return this;
        },
        _activate: function (mediaElement) {
            mediaElement.addEventListener('timeupdate', this._bound_update);
        },
        _deactivate: function (mediaElement) {
            mediaElement.removeEventListener('timeupdate', this._bound_update);
        },
        _update: function (event) {
            // based on video.js
            // if target missing we take it from event.mediaElement (for test purposes?)
            var mediaElement = event.target || event.mediaElement,
                updateData = this._updateData || {},
                cues = this.cues,
                time = mediaElement.currentTime;
            if (this.cues.length) {

                if (updateData.prevChange === undefined
                    || time < updateData.prevChange
                    || updateData.nextChange <= time) {
                    var newNextChange = mediaElement.duration,
                        newPrevChange = 0,
                        newCues = new mejs.TextTrackCueList,
                        reverse = false,
                        entered = [],
                        exited = [],
                        firstActiveIndex,
                        lastActiveIndex,
                        cue, i;

                    // check if forward/rewinding
                    if (time >= updateData.nextChange || updateData.nextChange === undefined) {
                        i = (updateData.firstActiveIndex !== undefined) ? updateData.firstActiveIndex : 0;
                    } else {
                        reverse = true;
                        i = (updateData.lastActiveIndex !== undefined) ? updateData.lastActiveIndex : cues.length - 1;
                    }

                    while(true) {
                        cue = cues[i];

                        // cue ended
                        if (cue.endTime <= time) {
                            newPrevChange = max(newPrevChange, cue.endTime);

                            if (cue.active) {
                                cue.active = false;
                                exited.push(cue);
                            }

                        // cue hasnt started
                        } else if (time < cue.startTime) {
                            newNextChange = min(newNextChange, cue.startTime)

                            if (cue.active) {
                                cue.active = false;
                                exited.push(cue);
                            }

                            // No later cues should have an active start time.
                            if (!reverse) { break; }

                        // cue is current
                        } else {

                            if (reverse) {
                                // Add cue to front of array to keep in time order
                                newCues.splice(0,0,cue);
                                // @TODO call addCue on activeCues (which should take care of proper order?!)

                                // If in reverse, the first current cue is our lastActiveCue
                                if (lastActiveIndex === undefined) {
                                    lastActiveIndex = i;
                                }
                                firstActiveIndex = i;
                            } else {
                                // Add cue to end of array
                                newCues.push(cue);

                                // If forward, the first current cue is our firstActiveIndex
                                if (firstActiveIndex === undefined) { firstActiveIndex = i; }
                                lastActiveIndex = i;
                            }

                            newNextChange = min(newNextChange, cue.endTime);
                            newPrevChange = max(newPrevChange, cue.startTime);

                            cue.active = true;
                            entered.push(cue);
                        }

                        if (reverse) {
                            // Reverse down the array of cues, break if at first
                            if (i === 0) { break; } else { i--; }
                        } else {
                            // Walk up the array fo cues, break if at last
                            if (i === cues.length - 1) { break; } else { i++; }
                        }
                    }

                    this.activeCues = newCues;  // @TODO fill them (call addcue?)
                    updateData.nextChange = newNextChange;
                    updateData.prevChange = newPrevChange;
                    updateData.firstActiveIndex = firstActiveIndex;
                    updateData.lastActiveIndex = lastActiveIndex;
                    this._updateData = updateData;

                    // fire events
                    /*for(i = 0; i < entered.length; i+=1) {
                        entered[i].dispatchEvent(new mejs.TrackEvent('enter', {cue: entered[i]}));
                    }
                    for(i = 0; i < exited.length; i+=1) {
                        exited[i].dispatchEvent(new mejs.TrackEvent('exit', {cue: exited[i]}));
                    }*/
                    this.dispatchEvent(new mejs.TrackEvent('cuechange', {track: this}));
                }
            }
        }
    };

    mejs.TextTrackCueTrait = {
        isActive: function () {
            return Array.prototype.indexOf.apply(this.track.activeCues, [this]) > -1;
        }
    };

    // min and max that are undefined-safe (NaN-check)
    var min = function (a,b) { var m = Math.min(a,b); return (m != m) ? a||b : m;},
        max = function (a,b) { var m = Math.max(a,b); return (m != m) ? a||b : m;};

    /**
        TextTrack

        Should not be instantiated directly
        (e.g. Chrome throws 'Illegal constructor when doing this')
        Use addTextTrack on mediaelement

        How is it different than standard HTML5 API?
        - setting mode should be done through .setMode (instead of setting .mode property directly)
            (we define setter but in old browsers this will not work)
        - with native TextTrack support, constructing it will throw an error (these options below are arbitrary)

        @param      options         Object
        @param      options.kind
        @param      options.label
        @param      options.language
        @param      options.id
        @param      options.src
        @param      options.node
        @param      options.done    Function    done callback for loadCues ajax request
        @param      options.fail    Function    fail callback for loadCues ajax request

        Events:
        cuechange
        modechange  @NONSTANDARD when using setMode() this event will fire
        load        track loaded
    */
    mejs.TextTrack = function (options) {
        var that = this, promise;
        options || (options = {});
        this.kind = options.kind || 'subtitles';
        this.label = options.label||'';
        this.language = options.language||'';
        this.id = options.id;
        this.node = options.node;
        if (this.node) this.node.track = this;
        this.src = options.src;
        this.cues = new mejs.TextTrackCueList;
        this.activeCues = new mejs.TextTrackCueList;

        this._mode = options.mode || 'hidden';   // disabled, hidden, showing
        if (!this.node) console.warn('Use addTextTrack on player instead of instantiating TextTrack manually');

        // @TODO        if we have the node we can listen to it being removed and also remove track from the tracklist

        // we set up setters and getters here (also gets called when polyfilling texttracks)
        if (Object.defineProperty) Object.defineProperty(this, 'mode', {set: this.setMode, get: this.getMode});

        // load cues
        this._loadCues();
    };
    $.extend(mejs.TextTrack.prototype, EventDispatcher.prototype, mejs.TextTrackTrait, {
        addCue: function (cue) {
            // @TODO order
            //if (mejs.TextTrackCue.prototype.isPrototypeOf(cue)) {
                this.cues.push(cue);
            //}
        },
        removeCue: function (cue) {
            //if (mejs.TextTrackCue.prototype.isPrototypeOf(cue)) {
                var i = this.cues.indexOf(cue);
                if (i === -1) {
                    throw new Error("Failed to execute 'removeCue' on 'TextTrack': The specified cue is not listed in the TextTrack's list of cues.");
                }
                this.cues.splice(i, 1);
            //}
        },
        /**
            Load track src

            @type   jQuery.promise
        */
        _loadCues: function ()  {
            // only when shimmed, this.node will be present
            // TextTrack API specification does not have .node property
            if (this.node && !this.node._readyState) { // 0 - None, 1 - Loading, 2 - Loaded, 3 - Error
                var node = this.node,
                    track = this;
                node._readyState = 1;   // @TODO ready state change
                return $.ajax({
                    url: this.src,
                    dataType: 'text',
                    success: function (d) {
                        // parse the loaded file
                        var entries;
                        if (typeof d == "string" && (/<tt\s+xml/ig).exec(d)) {
                            // @TODO this is not tested
                            entries = mejs.TrackFormatParser.dfxp.parse(d);
                        } else {
                            entries = mejs.TrackFormatParser.webvvt.parse(d);
                        }
                        var cue;
                        for (var i = 0; i < entries.text.length; i += 1) {
                            // Chrome deprecated the TextTrackCue constructor
                            // @TODO this needs more testing
                            cue = new (window.VTTCue||window.TextTrackCue)(
                                entries.times[i].start,
                                entries.times[i].stop,
                                entries.text[i]
                            , {
                                track: track,
                                id: entries.ids[i]
                            });
                            track.addCue(cue);
                        }
                        node._readyState = 2;
                        track.node.dispatchEvent(new mejs.TrackEvent('load', {track: track}));
                    },
                    error: function () {
                        node._readyState = 3;
                        track.node.dispatchEvent(new mejs.TrackEvent('error', {track: track}));
                    }
                });
            }
        }
    });
    mejs.TextTrack.shim = true;


    /**
        Text track cue list

        This is really minimal, no events
    */
    mejs.TextTrackCueList = function () {

    };
    mejs.TextTrackCueList.prototype = new Array;
    $.extend(mejs.TextTrackCueList.prototype, EventDispatcher.prototype, {
        getCueById: function (id) {
            for (var i = 0; i < this.length; i += 1) {
                if (this[i].id == id) return this[i];
            }
        }
    });


    /**
        TextTrackCue

        Can be instantiated directly (existing HTML5 implementation support this)

        @param  startTime           Float           start time in seconds
        @param  endTime             Float           end time in seconds
        @param  text                String          text
        @param  options             Object          options
        @param  options.id          String          string id (line above the time in .vtt format)
        @param  options.pauseOnExit Boolean         whether to pause the video when this cue is ended
        @param  options.track       mejs.TextTrack  parent TextTrack

        Events:
        enter
        exit
    */
    mejs.TextTrackCue = function (startTime, endTime, text, options) {
        if (typeof startTime == 'undefined' || typeof endTime == 'undefined' || typeof text == 'undefined') {
            throw new Error("Failed to construct 'TextTrackCue': 3 arguments required.")
        }
        options || (options = {});
        this.startTime = parseFloat(startTime);
        this.endTime = parseFloat(endTime);
        this.text = ''+text;
        this.id = options.id;
        this.track = options.track;
    }
    $.extend(mejs.TextTrackCue.prototype, mejs.TextTrackCueTrait, EventDispatcher.prototype, {
    });


    /**
        TrackEvent
        In addition to standard window.Event, it has a track (and cue) parameters

        @param      Object          params
        @param      Boolean         params.bubbles
        @param      Boolean         params.cancelable
        @param      mejs.TextTrack  params.track
    */
    mejs.TrackEvent = function (type, params) {
        params = params || { bubbles: false, cancelable: false, track: undefined };
        var evt = document.createEvent('CustomEvent');
        evt.initEvent(type, params.bubbles, params.cancelable);
        if (params.track && !(mejs.TextTrack.prototype.isPrototypeOf(params.track) || window.TextTrack.prototype.isPrototypeOf(params.track))) {
            throw new Error("Failed to construct 'TrackEvent': 'track' property does not look like a TextTrack");
        }
        evt.track = params.track;
        evt.cue = params.cue;
        evt.target = evt.cue || evt.track;
        evt.currentTarget = evt.target; evt.srcElement = evt.target;
        return evt;
    }
    mejs.TrackEvent.prototype = window.Event;




    // ========================================================================
    // May the polyfill begin!
    // Unicorns breed here NSFW
    // @TODO needs testing in old browsers (and Firefox lolkillmenao)
    // ========================================================================

    // ====== MediaElement shims

    // extend mediaelement.js plugin prototype
    $.extend(mejs.PluginMediaElement.prototype, mejs.MediaElementTracksTrait);

    // make sure when plugin is initialized, _initTextTracks is called
    var oldCreate = mejs.HtmlMediaElementShim.create,
        oldCreatePlugin = mejs.HtmlMediaElementShim.createPlugin;
    mejs.HtmlMediaElementShim.createPlugin = function (playback, options, poster, autoplay, preload, controls) {
        var plugin = oldCreatePlugin.call(this, playback, options, poster, autoplay, preload, controls);
        plugin._initTextTracks(playback.htmlMediaElement, true);  // actual video element, not object/embed if plugin..
        console.info("Initializing mediaelement shim");
        return plugin;
    };
    mejs.HtmlMediaElementShim.create = function (el, o) {
        var api = oldCreate.call(this, el, o);
        // flash/silverlight
        if (api.pluginType != 'native') {
            // already inited text tracks at .createPlugin (see above)

        // html5 but shimmed track api
        } else if (window.TextTrack.shim) {
            console.info("Initializing textrack shim");
            $.extend(api, mejs.MediaElementTracksTrait);
            api._initTextTracks(api, true);

        } else {
            api._initTextTracks = mejs.MediaElementTracksTrait._initTextTracks;
            api._initTextTracks(api);
        }
        return api;
    }


    // shim HTMLVideoElement if no support for textTrack (@TODO test on old firefoxes - or current? :D)
    if (window.HTMLVideoElement && !window.HTMLVideoElement.prototype.addTextTrack) {
        // @TODO call _initTextTracks on initialize (just like with PluginMediaElement)
        $.extend(window.HTMLVideoElement.prototype, mejs.MediaElementTracksTrait);
    }

    // ====== TextTrack shims
    if (!window.TextTrack) {
        window.TextTrack = mejs.TextTrack;
        //window.TextTrack.shim = true;
    } else {
        // this will add .setMode(), .getMode() and .ready() to TextTrack
        console.info("Polyfilling TextTrack.setMode, .getMode and .ready");
        $.extend(window.TextTrack.prototype, mejs.TextTrackTrait);
    }

    // ====== TextTrackList shims
    if (!window.TextTrackList) {
        window.TextTrackList = mejs.TextTrackList;
        window.TextTrackList.shim = true;
    }

    // ====== TextTrackCueList shims
    if (!window.TextTrackCueList) {
        window.TextTrackCueList = mejs.TextTrackCueList;
        window.TextTrackCueList.shim = true;
    }

    // ====== TextTrackCue shims
    if (!window.TextTrackCue) {
        window.TextTrackCue = mejs.TextTrackCue;
        window.TextTrackCue.shim = true;
    } else {
        console.info("Polyfilling TextTrackCue.isActive");
        $.extend(window.TextTrackCue.prototype, mejs.TextTrackCueTrait);
    }

    // ====== TrackEvent shims
    if (!window.TrackEvent) {
        window.TrackEvent = mejs.TrackEvent;
        window.TrackEvent.shim = true;
    }

}(jQuery, mejs));

var smile = {};
(function ($, smile) {

    // Object literal parsing (derived from knockout.js binding/expressionRewriting.js)
    var javaScriptReservedWords = ["true", "false", "null", "undefined"],
        javaScriptAssignmentTarget = /^(?:[$_a-z][$\w]*|(.+)(\.\s*[$_a-z][$\w]*|\[.+\]))$/i,
        stringDouble = '"(?:[^"\\\\]|\\\\.)*"',
        stringSingle = "'(?:[^'\\\\]|\\\\.)*'",
        stringRegexp = '/(?:[^/\\\\]|\\\\.)*/\w*',
        specials = ',"\'{}()/:[\\]',
        everyThingElse = '[^\\s:,/][^' + specials + ']*[^\\s' + specials + ']',
        oneNotSpace = '[^\\s]',
        bindingToken = RegExp(stringDouble + '|' + stringSingle + '|' + stringRegexp + '|' + everyThingElse + '|' + oneNotSpace, 'g'),
        divisionLookBehind = /[\])"'A-Za-z0-9_$]+$/,
        keywordRegexLookBehind = {'in':1,'return':1,'typeof':1};

    // derived from knockout.js binding/expressionRewriting.js
    function parseObjectLiteral (objectLiteralString) {
        // Trim leading and trailing spaces from the string
        var str = smile.util.stringTrim(objectLiteralString);

        // Trim braces '{' surrounding the whole object literal
        if (str.charCodeAt(0) === 123) str = str.slice(1, -1);

        // Split into tokens
        var result = [], toks = str.match(bindingToken), key, values, depth = 0;

        if (toks) {
            // Append a comma so that we don't need a separate code block to deal with the last item
            toks.push(',');

            for (var i = 0, tok; tok = toks[i]; ++i) {
                var c = tok.charCodeAt(0);
                // A comma signals the end of a key/value pair if depth is zero
                if (c === 44) { // ","
                    if (depth <= 0) {
                        if (key)
                            result.push(values ? {key: key, value: values.join('')} : {'unknown': key});
                        key = values = depth = 0;
                        continue;
                    }
                // Simply skip the colon that separates the name and value
                } else if (c === 58) { // ":"
                    if (!values)
                        continue;
                // A set of slashes is initially matched as a regular expression, but could be division
                } else if (c === 47 && i && tok.length > 1) {  // "/"
                    // Look at the end of the previous token to determine if the slash is actually division
                    var match = toks[i-1].match(divisionLookBehind);
                    if (match && !keywordRegexLookBehind[match[0]]) {
                        // The slash is actually a division punctuator; re-parse the remainder of the string (not including the slash)
                        str = str.substr(str.indexOf(tok) + 1);
                        toks = str.match(bindingToken);
                        toks.push(',');
                        i = -1;
                        // Continue with just the slash
                        tok = '/';
                    }
                // Increment depth for parentheses, braces, and brackets so that interior commas are ignored
                } else if (c === 40 || c === 123 || c === 91) { // '(', '{', '['
                    ++depth;
                } else if (c === 41 || c === 125 || c === 93) { // ')', '}', ']'
                    --depth;
                // The key must be a single token; if it's a string, trim the quotes
                } else if (!key && !values) {
                    key = (c === 34 || c === 39) /* '"', "'" */ ? tok.slice(1, -1) : tok;
                    continue;
                }
                if (values)
                    values.push(tok);
                else
                    values = [tok];
            }
        }
        return result;
    }

    smile.util = {
        // derived from knockout.js utils.js
        stringTrim: function (string) {
            return string === null || string === undefined ? '' :
                string.trim ?
                    string.trim() :
                    string.toString().replace(/^[\s\xa0]+|[\s\xa0]+$/g, '');
        },

        parseObjectLiteral: function (str) {
            var obj = {};
            $.each(parseObjectLiteral(str), function (i, item) {
                if (item.unknown) obj[item.unknown] = true;
                else if ((item.value||'').substr(0,1) == '{') obj[item.key] = smile.util.parseObjectLiteral(item.value);
                else obj[item.key] = item.value;
            });
            return obj;
        },

        capitalize: function (str) {
            return str.substr(0,1).toUpperCase() + str.substr(1);
        },

        /**
            underscore-ish bindAll
            this helper saves livers!
        */
        bindAll: function (obj, methodList) {
            for (var i = 0; i < methodList.length; i += 1) {
                obj[methodList[i]] = $.proxy(obj[methodList[i]], obj);
            }
            return obj;
        },

        horizontalAreas: function (area1, area2) {
            area1.ratio = area1.width/area1.height;
            area2.ratio = area2.width/area2.height;
            var data = {
                ratio: area1.ratio+area2.ratio,
                area1: area1,
                area2: area2
            };
            area1.widthPercentage = area1.ratio/data.ratio;
            area2.widthPercentage = area2.ratio/data.ratio;
            return data;
        },

        /**
            Format integer time_ms to a nice string "HH:MM:SS"

            @param  {Integer}   time_ms     time in miliseconds
            @param  {Boolean}   decimal     display decimal time
            @param  {Boolean}   force_hours force hours, even if 00
        */
        formatTime: function (time_ms, decimal, force_hours) {
            var res = "",
                tim = decimal ? Math.floor(time_ms/1000) : Math.round(time_ms/1000);
            for(var i = 0; i < 2; i += 1) {
                if (res.length > 0) { res = ":" + res; }
                res = smile.util.pad(tim%60, 2) + res;
                tim = Math.floor(tim/60);
            }
            if (tim > 0 || force_hours) {
                res = smile.util.pad(tim, 2) + ":" + res;
            }
            if (decimal) {
                var st = '' + time_ms;
                res = res + '.' + (st).substr(st.length-3);
            }
            return res;
        },

        /**
            Parse integer time_ms from string

            Expected format: [[HH":"]MM":"]SS["."000]
            If non string is passed, it is returned as integer/float

            @param  {String}    str
            @type   Integer
        */
        parseTime: function (str) {
            var spl = str.split(':'),
                secs = 0.0;
            for(var i = spl.length - 1; i >= 0; i -= 1) {
                if (i === spl.length - 1) {
                    secs += parseFloat(spl[i], 10);
                } else {
                    secs += Math.pow(60, spl.length - 1 - i)*parseInt(spl[i], 10);
                }
            }
            if (secs !== secs) return 0;
            return ~~(secs * 1000);
        },

        /**
            Pad string
            <p>
            e.g. pad(1, 2) -> "01"
            <p>
            pad(2,3,1) -> "112"
            <p>
            pad("lala", 6, " ", true) -> "lala  "

            @param  {String}    str         string to be padded
            @param  {Integer}   len         length to be reached
            @param  {String}    [chr]       character for filling empty spaces
            @param  {Boolean}   [append]    append instead of prepend characters
            @type   String
        */
        pad: function (str, len, chr, append) {
            if (chr === undefined) { chr = '0'; }
            var res = "" + str;
            for (var i = (""+str).length; i < len; i += 1) {
                if (append) {
                    res += chr;
                } else {
                    res = chr + res;
                }
            }
            return res;
        },

        parseRatio: function (str) {
            var ratio = null;
            str || (str = '');
            if (str.search('/') > -1) {
                str = str.split('/');
                ratio = parseFloat(str[0])/parseFloat(str[1]);
            } else if (str.search('%') > -1) {
                ratio = parseFloat(str)/100;
            } else if (str) {
                ratio = parseFloat(str);
            }
            return ratio;
        },

        addCssRule: function (selector, css) {
            if (document.styleSheets[0].addRule) document.styleSheets[0].addRule(selector, css);
            else if (document.styleSheets[0].insertRule) {
                // firefox same origin bullshit
                var style = document.createElement('style');
                style.innerHTML = selector+'{'+css+'}';
                document.getElementsByTagName('head')[0].appendChild(style);
                //document.styleSheets[0].insertRule(selector+'{'+css+'}', 0);
            }
        },

        /**
            Convert string to XML Document
            @param  {String}    str
            @type   XMLDocument
        */
        stringToDoc: function (str) {
            var doc, parser;
            if (window.ActiveXObject){
                doc = new ActiveXObject('Microsoft.XMLDOM');
                doc.async='false';
                doc.loadXML(str);
            } else {
                parser = new DOMParser();
                doc = parser.parseFromString(str, 'text/xml');
            }
            return doc;
        }


    };

    $.fn.dataObject = function (attrName) {
        return smile.util.parseObjectLiteral($(this).data(attrName));
    };


    $.throttle = jq_throttle = function( delay, no_trailing, callback, debounce_mode ) {
        var timeout_id,
            last_exec = 0;

        // `no_trailing` defaults to falsy.
        if ( typeof no_trailing !== 'boolean' ) {
            debounce_mode = callback;
            callback = no_trailing;
            no_trailing = undefined;
        }

        function wrapper() {
            var that = this,
                elapsed = +new Date() - last_exec,
                args = arguments;

            // Execute `callback` and update the `last_exec` timestamp.
            function exec() {
                last_exec = +new Date();
                callback.apply( that, args );
            };

            // If `debounce_mode` is true (at_begin) this is used to clear the flag
            // to allow future `callback` executions.
            function clear() {
                timeout_id = undefined;
            };

            if ( debounce_mode && !timeout_id ) {
                // Since `wrapper` is being called for the first time and
                // `debounce_mode` is true (at_begin), execute `callback`.
                exec();
            }

            // Clear any existing timeout.
            timeout_id && clearTimeout( timeout_id );

            if ( debounce_mode === undefined && elapsed > delay ) {
                // In throttle mode, if `delay` time has been exceeded, execute
                // `callback`.
                exec();
            } else if ( no_trailing !== true ) {
                timeout_id = setTimeout( debounce_mode ? clear : exec, debounce_mode === undefined ? delay - elapsed : delay );
            }
        };

        if ( $.guid ) {
            wrapper.guid = callback.guid = callback.guid || $.guid++;
        }

        return wrapper;
    };


    $.debounce = function( delay, at_begin, callback ) {
        return callback === undefined
            ? jq_throttle( delay, at_begin, false )
            : jq_throttle( delay, callback, at_begin !== false );
    };

    $.delay = function ( delay, callback ) {
        return function () {
            setTimeout(callback, delay);
        };
    };


}(jQuery, smile));

(function ($, mejs, smile) {

    /**
        Base Player (wraps mediaelement)

        Usage:

        Sources:
        extension   mimetype                source
        mp4         video/mp4               http://
        webm        video/webm              http://
        m3u8        application/x-mpegURL   http://
        flv         video/x-flv             http://
        wmv         video/x-ms-wmv          http://
        rtmp        video/rtmp              rtmp://

        Guidelines
        1. give video a unique id (and use it's prefix for track ids)
            tracks must have ids!
        2. first list rtmp sources, <video> will ignore them but flash will use them instead of http
        3. use .smile-player hideNativeTracks to hide native caption/subtitles rendering
            or use .smile-display hideIfNative to only show display when native caption/subtitles aren't rendering

        @TODO firefox 31 THERE IS NO "load" EVENT ON <track> @FML

        Attributes:

        video
            poster              poster image
            controls            show controls ?
            preload             none|metadata|auto
            data-smile
                thumbnail       video thumbnail (as alternative to poster="" attribute) ?

        source
            type                source mimetype (see above)
            src                 source uri
            data-smile
                width
                height
                bitrate
                size

        track
            kind                subtitles|captions|chapters|metadata
            srclang             language
            src                 source uri (IE needs proper mimetype for this to work)
            id                  NEEDED for proper track functioning
            default             whether this is the default track (there can be only one per kind)

        .smile-display element inside .smile-player container
            data-smile
                display         type of display
                track           track id (can be without "-lang")
                autoLanguage    (default: true) will try to find trackId by appending '-lang' to id (useful for language changes in between playback)
                onlyShim        (default: false) will only show display if player is shimmed (not native) or texttracks are shimmed with native player
                                (useful for showing subtitles and/or captions only in setups where they aren't displayed natively)

        Example:
        <div class="smile-player" data-smile="">
            <video id="video1" width="480" height="360" poster="https://media.viidea.com/v003/f9/7fyy6jgpnjetxl2ysumv7tiicamiq3xs.jpg" controls="controls" preload="none" data-smile="thumbnail: 'https://media.viidea.com/v003/96/s3swkcyvy74yk4ldosjlm6oqqjtfu4xw.jpg'">
                <source data-smile="width: 640, height: 480, bitrate: 566891, size: 144526110" type="video/rtmp" src="rtmp://maat2.viidea.com/vod/mp4:v003/6a/nkluipq7fxvi73nb5abkuclty36byp7g.mp4" />
                <source data-smile="width: 480, height: 360, bitrate: 417220, size: 106368396" type="video/rtmp" src="rtmp://maat2.viidea.com/vod/mp4/v003/76/ozanhot62etoaaophm2ttkqagt3dviys.mp4" />
                <source data-smile="width: 768, height: 576, bitrate: 947107, size: 241460369" type="video/rtmp" src="rtmp://maat2.viidea.com/vod/mp4:v003/49/jgm7sefrygoocade4vixah2buaszagkc.mp4" />
                <source data-smile="width: 640, height: 480, bitrate: 566891, size: 144526110" type="video/mp4" src="https://media.viidea.com/v003/6a/nkluipq7fxvi73nb5abkuclty36byp7g.mp4" />
                <source data-smile="width: 640, height: 480, bitrate: 566891, size: 144526110" type="application/x-mpegURL" src="http://maat2.viidea.com/vod/_definst_/mp4:v003/6a/nkluipq7fxvi73nb5abkuclty36byp7g.mp4/playlist.m3u8" />
                <source data-smile="width: 480, height: 360, bitrate: 417220, size: 106368396" type="video/mp4" src="https://media.viidea.com/v003/76/ozanhot62etoaaophm2ttkqagt3dviys.mp4" />
                <source data-smile="width: 480, height: 360, bitrate: 417220, size: 106368396" type="application/x-mpegURL" src="http://maat2.viidea.com/vod/_definst_/mp4:v003/76/ozanhot62etoaaophm2ttkqagt3dviys.mp4/playlist.m3u8" />
                <track kind="subtitles" src="subtitles.vtt" srclang="en" id="video1-track-subtitles-en" default="default" />
                <track kind="metadata" src="metadata.vtt" srclang="en" id="video1-track-slides-en" default="default" />
            </video>
            <div id="video1-slides" class="smile-display" data-smile="track: video1-track-slides, display: slides"></div>
            <div id="video1-subtitles" class="smile-display" data-smile="track: video1-track-subtitles, onlyShim"><div>
        </div>

        Source selection / bitrate switching:

        Current behaviour:
        if only rtmp:// is present, <video> will try to play it
            - ideally, flash player should be loaded
        if http:// sources are before rtmp, flash will load http://
            - ideally, rtmp sources should be played by default
            - ideally, rtmp bitrate swithing would happen inside flash engine?

        @param  node                        HTMLElement     media (video) HTML element
        @param  options                     Object
        @param  [options.regions]           Object          region id -> region class mapping

        Extensions:
        @param  [options.display]           Boolean         auto set up displays (default: true)
        @param  [options.hideNativeTracks]  Boolean         hide native tracks (subtitles and captions)

        Events
        @event  load            mediaelement successfully loaded
        @event  error           mediaelement error when loading
        @event  loadtracks      tracks are loaded (either with error or not)
        @event  resize          player (window) resized
        @event  statechange     state changed (see state property)

        @property   media       mediaelement API
        @property   $media      jquery wrapped video node
        @property   container   container node
        @property   $container  jquery wrapped container node
        @property   state       video state     'initializing'|'ready'|'playing'|'waiting'|'pause'|'ended'
    */
    smile.Player = function (node, options) {
        if (! (this instanceof smile.Player)) return new smile.Player(node, options);
        smile.util.bindAll(this, ['initializeDisplays', 'onMediaReady', 'onHandleError', 'resize']);
        options || (options = {});
        this.smileReadyState = 1;
        this.state = 'initializing';

        // node is media element
        var $media = $(node),
            tagName = $media[0].tagName.toLowerCase(),
            that = this;
        if (tagName == 'video' || tagName == 'audio') {
            this.$media = $media;

        // node is parent of media element
        } else {
            $media = $($media.find('video,audio')[0]);
            if ($media.length && ['video', 'audio'].indexOf($media[0].tagName.toLowerCase()) > -1) {
                this.$media = $media;
                options.container = $(node);
            }
        }
        if (!this.$media) throw new Error("Needs <video> or <audio> or an element containing one of those");
        this.media = this.$media[0];

        // player instance found
        if (typeof this.media.smile != 'undefined') {
            return this.media.smile;
        }
        this.media.smile = this;

        // container
        this.initializeContainer(options.container);

        // options
        this.options = $.extend({},
            this.constructor.defaults,
            this.$media.dataObject('smile'),
            this.$container.dataObject('smile'),
            options);

        function setState (state) {
            return function () {
                that.state = state;
                that.dispatchEvent({type: 'statechange', state: state});
            };
        }

        // when ready
        this.ready(function () {
            setState('ready')();
            that.media.addEventListener('loadedmetadata', $.proxy(that.updateRatio, that));
            that.media.addEventListener('playing', setState('playing'));
            that.media.addEventListener('waiting', setState('waiting'));
            that.media.addEventListener('pause', setState('pause'));
            that.media.addEventListener('ended', setState('ended'));
            that.updateRatio();
        });

        // =======================
        // CONSTRUCT MEDIA ELEMENT
        mejs.MediaElement(this.$media[0], $.extend({}, this.options, {
            success: this.onMediaReady,
            error: this.onHandleError
        }));

        // extensions
        for (var option in this.options) {
            if (this.options.hasOwnProperty(option) && smile.Player.extensions[option]) {
                this.enableExtension(option);
            }
        }

        $(window).resize($.debounce(500, this.resize));
    };

    $.extend(smile.Player.prototype, EventDispatcher.prototype, {
        initializeContainer: function (container) {
            // container
            if (container) {
                this.$container = $(container);
            } else {
                this.$container = this.$media.closest('.smile-player');
                if (!this.$container.length) this.$container = this.$media;
            }
            this.container = this.$container[0];
            this.container.smile = this;
            this.$container.attr('id', (this.$media.attr('id')||'smile1')+'-container');
        },
        enableExtension: function (name) {
            var ext = smile.Player.extensions[name];
            $.extend(this, ext.methods);
            ext.initialize && ext.initialize.apply(this);
            ext.ready && this.ready($.proxy(ext.ready, this));
            ext.tracksReady && this.tracksReady($.proxy(ext.tracksReady, this));
        },
        onMediaReady: function (media, domNode) {
            var that = this;
            this.smileReadyState = 2;

            // set media
            this.media = media;
            this.media.smile = this;

            // dispatch load
            this.dispatchEvent({type: 'load', target: this});
            this._loadtracksFired = false;

            // hook tracks
            for (var i = 0; i < this.media.textTracks.length; i += 1) {
                this.media.textTracks[i].ready(function () {
                    if (!that._loadtracksFired && that.areTracksReady()) {
                        that._loadtracksFired = true;
                        that.dispatchEvent({type: 'loadtracks', target: that});
                    }
                });
            }
        },
        onHandleError: function (e) {
            this.smileReadyState = 3;
            this.dispatchEvent({type: 'error', error: e, target: this});
        },

        /**
            Call function when player is ready
        */
        ready: function (f) {
            // @TODO track ready?
            var that = this;
            if (this.smileReadyState === 2 || this.smileReadyState === 3) {
                setTimeout(f, 0);
            } else {
                var cb = function () {
                    that.removeEventListener('load', cb);
                    setTimeout(f, 0);
                }
                this.addEventListener('load', cb);
            }
            return this;
        },
        areTracksReady: function ()  {
            var tracks = this.$media.find('track');
            for (var i = 0; i < tracks.length; i += 1) {
                if (((tracks[i].readyState || tracks[i]._readyState)||0) < 2) return false;
            }
            return true;
        },

        resize: function () {
            this.updateSize();
            this.dispatchEvent({type: 'resize'});
            return this;
        },

        /**
            Call function when player and tracks are ready
        */
        tracksReady: function (f) {
            var that = this;
            if (this.areTracksReady()) {
                setTimeout(f, 0);
            } else {
                var cb = function () {
                    that.removeEventListener('loadtracks', cb);
                    setTimeout(f, 0);
                }
                this.addEventListener('loadtracks', cb);
            }
            return this;
        },

        getVideoRatio: function () {
            var attrWidth = this.$media.attr('width'),
                attrHeight = this.$media.attr('height'),
                data = $.extend({}, this.$media.dataObject('smile'), this.$container.dataObject('smile')),
                ratio;
            if (this.media.videoWidth) ratio = this.media.videoWidth/this.media.videoHeight;
            else if (this._attrRatio) ratio = this._attrRatio;
            else if (attrWidth && attrHeight) {
                ratio = this._attrRatio = attrWidth/attrHeight;
                this.$media.attr({width: '', height: ''});
            } else if (data.ratio) ratio = smile.util.parseRatio(data.ratio);
            else ratio = this.$media.width()/this.$media.height();
            if (Math.abs(ratio) === Infinity) ratio = 0;
            return ratio || (16/9);
        },

        updateRatio: function (ratio) {
            if (typeof ratio != 'number' || !ratio) ratio = this.getVideoRatio();
            smile.util.addCssRule('#'+this.$container.attr('id')+' .smile-media:after', 'padding-top: '+(100/ratio)+'%;');
            this.updateSize();
        },

        updateSize: function () {
            var embed = this.$container.find('embed');
            if (embed.length) {
                var w = this.$container.width(),
                    h = w*(1/this.getVideoRatio());
                this.media.setVideoSize(w, h);
            }
        },

        /**
            Get tracks by id (without "-lang")

            @param  trackId     String      track id without -lang suffix
        */
        getTracksById: function (trackId) {
            var tracks = [],
                track;
            for (var i = 0; i < this.media.textTracks.length; i += 1) {
                track = this.media.textTracks[i];
                if (track.id == trackId + '-' + track.language) {
                    tracks.push(track);
                }
            }
            return tracks;
        },

        /**
            Get track by id

            @param  trackId     String      track id
            @param  autoLang    Boolean     if true will search for tracks without -lang suffix and will return the first with mode == 'showing'
        */
        getTrackById: function (trackId, autoLang) {
            var tracks = autoLang ? this.getTracksById(trackId) : this.media.textTracks,
                track,
                i;
            for (i = 0; i < tracks.length; i += 1) {
                track = tracks[i];
                if (autoLang && track.mode != 'disabled') return track;
                else if (!autoLang && track.id == trackId) return track;
            }
            if (autoLang && tracks.length) return tracks[0];
            return null;
        }
    });
    $.extend(smile.Player, {
        defaults: {
            // default options go here
        },
        extensions: {},
        registerExtension: function (name, obj) {
            this.extensions[name] = {
                initialize: obj.initialize,
                ready: obj.ready,
                tracksReady: obj.tracksReady,
                methods: obj
            };
            delete obj.initialize;
            delete obj.ready;
            delete obj.tracksReady;
        }
    });
    $.fn.smile = function (options) {
        // @TODO use .data() instead (/in addition to) of property on DOM
        $(this).each(function () {
            this.smile ||
                (this.smile = new smile.Player($(this), options));
        });
    };

    /**
        Determine which url to use
        @TODO put source selection logic here
        @TODO add support for returning list of url for bitrate switching (currently choosing just one)
        @TODO remember playback options somewhere on media for later usage (like media.pluginType which is already set)
    */
    var oldDeterminePlayback = mejs.HtmlMediaElementShim.determinePlayback;
    mejs.HtmlMediaElementShim.determinePlayback = function () {
        var data = oldDeterminePlayback.apply(this, arguments);
        return data;
    };

}(jQuery, mejs, smile));

(function ($, mejs, smile){
    smile.Player.registerExtension('hideNativeTracks', {
        ready: function () {
            this.hideNativeTracks();
        },
        hideNativeTracks: function () {
            var that = this;
            $.each(that.media.textTracks, function (i, track) {
                if (track.kind == 'subtitles' || track.kind == 'captions') {
                    track.setMode('hidden');
                }
            });
        }
    });

    smile.Player.registerExtension('css', {
        initialize: function () {
            // css stuff
            var features = mejs.MediaFeatures;
            this.$container.addClass(
                'smile-player smile-initial ' +
                (features.isAndroid ? 'smile-android ' : '') +
                (features.isiOS ? 'smile-ios ' : '') +
                (features.isiPad ? 'smile-ipad ' : '') +
                (features.isiPhone ? 'smile-iphone ' : '') +
                (window.TextTrack.shim ? 'smile-trackshim ' : '')
            );
        },
        ready: function () {
            var that = this,
                playbackStates = 'smile-playing smile-paused smile-waiting smile-ended smile-initial',
                toggleStateClass = function (state) {
                    return function () {
                        that.$container.removeClass(playbackStates).addClass(state);
                    }
                };
            this.$container.addClass('smile-plugin-'+this.media.pluginType);
            this.media.addEventListener('playing', toggleStateClass('smile-playing'));
            this.media.addEventListener('pause', toggleStateClass('smile-paused'));
            this.media.addEventListener('ended', toggleStateClass('smile-ended'));
            this.media.addEventListener('waiting', toggleStateClass('smile-waiting'));
        }
    });
}(jQuery, mejs, smile));

(function ($, mejs, smile) {
    smile.Player.registerExtension('controls', {
        initialize: function () {
            this._controls = { container: this.$container.find('.smile-controls') };
            this._controls.container[0].smile = this;
        },
        ready: function () {
            var player = this,
                ctrl = this._controls,
                setPlayButton = function (state) {
                    ctrl.container.find('.smile-button-play')
                        .removeClass('play pause')
                        .addClass(state);
                    ctrl.container.find('.smile-button-play i')
                        .removeClass('fa-play fa-pause')
                        .addClass('fa-'+state);
                },
                setVolumeButton = function () {
                    var cls = 'vol3';
                    if (player.media.muted) cls = 'vol0';
                    else {
                        if (player.media.volume < 0.66) cls = 'vol2';
                        if (player.media.volume < 0.33) cls = 'vol1';
                        if (player.media.volume == 0) cls = 'vol0';
                    }
                    
                    ctrl.container.find('.smile-button-volume')
                        .removeClass('vol0 vol1 vol2 vol3')
                        .addClass(cls);
                    ctrl.container.find('.smile-volume-progress-bar')
                        .css('width', (player.media.muted?0:(player.media.volume*100))+'%');
                    ctrl.container.find('.smile-button-volume i')
                        .removeClass('fa-volume-up fa-volume-down fa-volume-off')
                        .addClass(cls == 'vol0' ? 'fa-volume-off' : (cls == 'vol3' ? 'fa-volume-up' : 'fa-volume-down'));
                },
                setFullscreenButton = $.delay(100, function (event) {
                    var fs = document.fullScreen||document.mozFullScreen||document.webkitIsFullScreen;
                    ctrl.container.find('.smile-button-fullscreen')
                        .removeClass('open close')
                        .addClass(fs ? 'close' : 'open');
                    ctrl.container.find('.smile-button-fullscreen i')
                        .removeClass('fa-expand fa-compress')
                        .addClass(fs ? 'fa-compress' : 'fa-expand');
                }),
                getNearestBuffer = function () {
                    var i;
                    for (i = player.media.buffered.length-1; i >= 0; i -= 1) {
                        if (player.media.buffered.start(i) < player.media.currentTime) return i;
                    }
                    return 0;
                },
                setTimeProgress = function () {
                    if (!player.media.duration) return;
                    var bufferEnd = player.media.buffered.length &&
                            player.media.buffered.end(getNearestBuffer()),
                        currentTime = player.media.currentTime,
                        duration = player.media.duration;
                    ctrl.container.find('.smile-time-display')
                        .text(smile.util.formatTime(currentTime*1000));
                    ctrl.container.find('.smile-time-progress-bar')
                        .css('width', ((currentTime/duration)*100)+'%');
                    ctrl.container.find('.smile-time-progress-buffer')
                        .css('width', (bufferEnd && bufferEnd > currentTime ?
                            (bufferEnd-currentTime)/duration : 0)*100 + '%')
                },
                getProgressFromPosition = function (event, progress) {
                    var prog = (event.pageX-progress.offset().left)/progress.width();
                    if (prog < 0) prog = 0;
                    if (prog > 1) prog = 1;
                    return prog;
                };
            this.media.addEventListener('timeupdate', function () {
                setTimeProgress();
            });
            this.media.addEventListener('playing', function () {
                setPlayButton('pause');
                setVolumeButton();
                setTimeProgress();
            });
            this.media.addEventListener('waiting', function () {
                setPlayButton('pause');
            });
            this.media.addEventListener('pause', function () {
                setPlayButton('play');
            });
            this.media.addEventListener('ended', function () {
                setPlayButton('play');
            });
            this.media.addEventListener('volumechange', function () {
                setVolumeButton();
            });
            this.media.addEventListener('progress', function () {
                setTimeProgress();
            });

            ctrl.container.on('click', '.smile-button-play.play', function (event) {
                player.media.play();
                event.preventDefault();
            });
            ctrl.container.on('click', '.smile-button-play.pause', function (event) {
                player.media.pause();
                event.preventDefault();
            });
            ctrl.container.on('click', '.smile-button-volume', function (event) {
                player.media.setMuted(!player.media.muted);
                event.preventDefault();
            });
            ctrl.container.on('click', '.smile-button-fullscreen,.smile-button-fullscreen.open', function (event) {
                event.preventDefault();
                if (player.container.webkitRequestFullScreen) player.container.webkitRequestFullScreen();
                else if (player.container.mozRequestFullScreen) player.container.mozRequestFullScreen();
                else if (player.container.requestFullscreen) player.container.requestFullscreen();
                else if (player.container.requestFullScreen) player.container.requestFullScreen();
            });
            ctrl.container.on('click', '.smile-button-fullscreen.close', function (event) {
                event.preventDefault();
                if (document.cancelFullScreen) document.cancelFullScreen();
                else if (document.webkitCancelFullScreen) document.webkitCancelFullScreen();
                else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
                else if (document.exitFullscreen) document.exitFullscreen();
            });
            ctrl.container.on('mouseup', '.smile-time-progress', function (event) {
                if (!player.media.duration) return;
                var progress = getProgressFromPosition(event, ctrl.container.find('.smile-time-progress'));
                player.media.setCurrentTime(progress*player.media.duration);
            });
            ctrl.container.on('mouseup', '.smile-volume-progress', function (event) {
                if (player.media.muted) return;
                var progress = getProgressFromPosition(event, ctrl.container.find('.smile-volume-progress'));
                player.media.setVolume(progress);
            });

            document.addEventListener("fullscreenchange", setFullscreenButton);
            document.addEventListener("webkitfullscreenchange", setFullscreenButton);
            document.addEventListener("mozfullscreenchange", setFullscreenButton);

            setPlayButton('play');
            setFullscreenButton();

            ctrl.resize = function () {
                player.$container.find('.smile-media, .smile-area, video')
                    .css('max-height', ($(window).height()-40)+'px');
            };
            ctrl.resize();
            this.addEventListener('resize', ctrl.resize);
        }
    });
}(jQuery, mejs, smile));
(function ($, smile) {

    smile.Player.registerExtension('displays', {
        initialize: function () {
            var that = this;
            this.addEventListener('resize', function (){
                $.each(that.displays||[], function (i, display) {
                    if (display.resize) display.resize();
                });
            });
        },
        ready: function () {
            var that = this;
            this.displays = [];
            this.$container.find('.smile-display').each(function () {
                var data = $(this).dataObject('smile'),
                    clsName = 'Display',
                    cls = smile.Display;
                if (data.track) {
                    if (data.display) {
                        clsName = 'Display' + smile.util.capitalize(data.display);
                    }
                    cls = smile[clsName];
                    if (!cls) {
                        console.warn('Smile display expects valid display type: smile.'+clsName+' not found');
                    } else {
                        data.track = that.getTrackById(data.track) || that.getTrackById(data.track, true);
                        data.container = $(this);
                        data.player = that;
                        // other options are also in data (e.g. onlyTrackshim and autoLanguage)
                        that.displays.push(new cls(data));
                    }
                } else {
                    console.warn('Smile display expects track parameter');
                }
            });
        }
    });

    smile.CueDisplay = function (options) {
        this.display = options.display;
        this.cue = options.cue;
        this.toggleDisplay = options.toggleDisplay || false;
        this.render();
    };
    $.extend(smile.CueDisplay.prototype, {
        render: function () {
            this.el = $('<div>').addClass('smile-cue')
                .append(this.cue.text.replace('\n', '<br/>'))
                .attr('id', this.display.track.id+'-cue-'+this.cue.id)
                .hide()
                .appendTo(this.display.$container);
        },
        activate: function () {
            this.el.addClass('active');
            if (this.toggleDisplay) this.el.show();
        },
        deactivate: function () {
            this.el.removeClass('active');
            if (this.toggleDisplay) this.el.hide();
        }
    });

    /**
        Display
        If you want to hide it, use track.setMode('disabled') - mode 'hidden' is used for hiding native renderers
            if you still need the track to fire, just hide container

        Redefine renderCue(VttCue) -> smile.CueDisplay

        Also, all <*> elements in display container with data-time="" value will seek video position on button click

        @param  options                     Object
        @param  options.container           HTMLElement|jQuery  container element
        @param  options.player              smile.Player        player instance
        @param  options.track               smile.Track         track instance
        @param  options.toggleDisplay       Boolean             whether to toggle display when cue is active/inactive (defaul: true; otherwise only active class gets toggled)
        @param  options.visibleOnCue        Boolean             whether to hide display when no cue is active
        @param  options.pauseOnExit         Boolean             pause when any cue exists (deactivates)
        @param  options.pauseOnEnter        Boolean             pause when any cue enters (activates)
        @param  options.hideIfNative        Boolean             only show display when shim is active (default: false)
                                                                (native means that both media element is native and track support is native)
        @param  options.autoLanguage        Boolean             automatically handle language change (default: true)
    */
    smile.Display = function (options) {
        if (!options.container) throw new Error("Display needs container");
        this.$container = $(options.container);
        this.$container[0].smileDisplay = this;
        if (options.visibleOnCue) this.$container.hide();
        this.player = options.player;
        this.cues = {};

        options.toggleDisplay = typeof options.toggleDisplay == 'undefined' ? true : !!options.toggleDisplay;
        options.autoLanguage = typeof options.autoLanguage == 'undefined' ? true : !!options.autoLanguage;
        this.options = options;

        this.lastActiveIds = [];
        smile.util.bindAll(this, ['render', 'onModeChange', 'onCueChange']);
        if (options.track) this.setTrack(options.track);
    };
    $.extend(smile.Display.prototype, EventDispatcher.prototype, {
        setTrack: function (track) {
            var show = (!this.options.hideIfNative)
                || (this.player.media.pluginType != 'native' || window.TextTrack.shim);
            if (this.track) this.unhookTrack();
            this.cues = {};
            this.track = track;
            if (show) {
                this.track.ready(this.render);
                this.hookTrack();
                this.onCueChange();
            }
        },
        hookTrack: function () {
            this.track.addEventListener('cuechange', this.onCueChange);
            this.track.addEventListener('modechange', this.onModeChange);
        },
        unhookTrack: function () {
            this.track.removeEventListener('cuechange', this.onCueChange);
            this.track.removeEventListener('modechange', this.onModeChange);
        },
        render: function (i,j) {
            var currentTime = this.player.media.currentTime,
                that = this,
                cue;
            if (this.track.mode == 'disabled') return;
            for (i = i || 0; i < (j || this.track.cues.length); i += 1) {
                cue = this.track.cues[i];
                if (!this.cues[cue.id]) {
                    this.cues[cue.id] = this.renderCue(cue);
                }
            }
            smile.Display.hookTimeLinkEvents(this.$container, this.player);
        },
        renderCue: function (cue) {
            return new smile.CueDisplay({display: this, cue: cue, toggleDisplay: this.options.toggleDisplay});
        },
        onModeChange: function () {
            // if (this.track.mode == 'showing' || this.track.mode == 'hidden') {
            //     this.$container.show();
            // } else {
            //     this.$container.hide();
            // }
            if (this.autoLanguage && this.track.mode == 'disabled') {
                var that = this, spl = this.track.id.split('-'),
                    trackId = spl.slice(0, spl.length-1).join('-');
                // wait till modes on tracks are set (@TODO defer?)
                setTimeout(10, function () {
                    that.setTrack(that.player.getTrackById(trackId, true));
                });
            } else {
                this.render();
            }
        },
        onCueChange: function () {
            // @TODO this could be refactored to effectively shim chrome's (and others') broken onexit/enter on cues
            var cuePrefix = this.track.id+'-cue-',
                activeIds = $.map(this.track.activeCues||[], function (cue) { return cue.id; }),
                cueView, id, i;
            for (i = 0; i < activeIds.length; i += 1) {
                id = activeIds[i]; cueView = this.cues[id];
                if (cueView && this.lastActiveIds.indexOf(id) === -1) {
                    cueView.activate();
                    if (this.options.pauseOnEnter) this.player.media.pause(); // @TODO what if seeked?
                }
            }
            for (i = 0; i < this.lastActiveIds.length; i += 1) {
                id = this.lastActiveIds[i]; cueView = this.cues[id];
                if (cueView && activeIds.indexOf(id) === -1) {
                    cueView.deactivate();
                    if (this.options.pauseOnExit) this.player.media.pause();
                }
            }
            this.lastActiveIds = activeIds;
            if (this.options.visibleOnCue) this.$container[activeIds.length ? 'show' : 'hide']();
        },
        resize: function () {
        },
        getRatio: function () {
            return 4/3;
        }
    });

    smile.Display.hookTimeLinkEvents = function (container, player) {
        container.find('*[data-time]').each(function () {
            var $el = $(this), time = parseFloat($el.attr('data-time'))+0.1;
            $el.on('click', function (event) {
                event.preventDefault();
                player.media.setCurrentTime(time);
            });
        });
    };

    /**
        DisplaySlides

        expects cue format:
        {
            images: [{src: width: height: }]
            title:
            text:
        }

        @TODO dynamic render (only add certain amount of near images to DOM)
    */
    smile.DisplaySlides = function (options) {
        smile.Display.apply(this, [options]);
        this._ratio = 4/3;
    };
    $.extend(smile.DisplaySlides.prototype, smile.Display.prototype, {
        renderCue: function (cue) {
            var cueData = JSON.parse(cue.text),
                cueView = smile.Display.prototype.renderCue.apply(this, [cue]);
            cueView.el.empty().append($('<img>').attr({src: cueData.images[0].src, title: cueData.title}));
            return cueView;
        },
        render: function () {
            smile.Display.prototype.render.apply(this);
            var ratios = [],
                cueData;
            for (var i = 0; i < this.track.cues.length; i += 1) {
                cueData = JSON.parse(this.track.cues[i].text);
                if (cueData.images && cueData.images.length) {
                    if (cueData.images[0].width && cueData.images[0].height) {
                        ratios.push(cueData.images[0].width/cueData.images[0].height)
                    }
                }
            }

            if (ratios.length) {
                ratios.sort(function (a, b) { return a - b; });
                this._ratio = ratios[Math.floor(ratios.length/2)];
            }
        },
        getRatio: function () {
            return this._ratio;
        }
    });

}(jQuery, smile));

(function ($, smile) {


/*

    For player events (EventDispatcher prototype), we signal via postmessage
    with dispatchEvent overload. (For media we hook to all known events in _proxyMediaEvents)
    To make this more usable, certain events should be dispatched on player
    (e.g. fullscreenchange with custom prefixes)

*/

    smile.Player.registerExtension('postMessage', {
        initialize: function () {
            smile.util.bindAll(this, ['onWindowMessage', '_cleanObject']);

            this.postMessage = {
                readyState: 1,
                source: null,   // @TODO determining target origin can fail!!! - must show warning on console that postmessage API is down!
                targetOrigin: this._determineTargetOrigin(typeof this.options.postMessage === 'boolean' ? '*' : this.options.postMessage)
            };
            console.log('INITIALIZE postmessage', this.postMessage);

            // no need to filter events, we assume only one video in the child (i.e. iframe content document has only one video in DOM)
            $(window).on('message', this.onWindowMessage);

            this._proxyMediaEvents();
        },

        /**
            Event data is expected to be string of JSON:
            {   method: 'nameOfTheMethod',
                args: [ ... ],
                uuid: 'xyz' }   // if uuid present, callback can be provided
            {   method: 'event',
                args: [ event ] }
            {   method: 'callback',
                uuid: 'xyz',
                args: [ ... ] }
        */
        onWindowMessage: function (event) {
            console.log('ON WINDOW MESSAGE (CHILD)', event);

            var data;
            try { data = JSON.parse(event.originalEvent.data); }
            catch (e) { return; }

            if (data.method == 'registerParent') {
                this.registerParent(data.args, event.originalEvent.source);
                // ignore data.args with registerParent call (for now?)
            } else {
                var method = data.method.split('.'),
                    f = this,
                    name, that, result;
                // .media.someMethod will also work! :D
                while (method.length) { // @TODO errors
                    name = method.shift();
                    that = f;
                    f = f[name];
                }
                if ($.isFunction(f)) {
                    result = f.apply(that, data.args);
                } else {
                    if (typeof f != 'undefined') result = f;
                    else {
                        if (name.substr(0,3) == 'get') {
                            result = that[name.substr(3,1).toLowerCase()+name.substr(4)];
                        }
                    }
                }
                if (data.uuid) { // callback
                    this._postMessage({
                        method: 'callback',
                        uuid: data.uuid,
                        args: [typeof result == 'object' && result !== null ? this._cleanObject(result) : result]
                    });
                }
            }
        },

        registerParent: function (args, source) {
            // {a: true, b: {a: true}};
            var methods = this._scanMethods(this, ['media']);
            this.postMessage.source = source;

            this._postMessage({
                method: 'registerChild',
                args: [this.smileReadyState, methods]
            });
        },

        dispatchEvent: function () {
            var args = $.makeArray(arguments),
                result = smile.Player.prototype.dispatchEvent.apply(this, args);
            if (this.postMessage.source) {
                this._postMessage({
                    method: 'event',
                    prefix: '',
                    args: $.map(args, this._cleanObject)
                });
            }
            return result;
        },

        _proxyMediaEvents: function () {
            var events = ['waiting', 'volumechange', 'toggle', 'timeupdate', 'suspend', 'stalled', 'seeking', 'seeked',
                'ratechange', 'progress', 'playing', 'play', 'pause', 'loadstart', 'loadedmetadata', 'loadeddata', 'load',
                'ended', 'durationchange', 'cuechange', 'canplaythrough', 'canplay', 'webkitfullscreenerror', 'webkitfullscreenchange'],
                that = this;
            $.each(events, function (i, event) {
                that.media.addEventListener(event, function () {
                    that._postMessage({
                        method: 'event',
                        prefix: 'media',
                        args: $.map($.makeArray(arguments), that._cleanObject)
                    })
                });
            });
        },

        _scanMethods: function (obj, props) {
            var methods = {}, k, v, el = $('<div>')[0];
            props || (props = []);
            for (k in obj) {
                v = obj[k];
                if (k.substr(0,1) == '_' || k.substr(0,2) == 'on' || k.substr(0,6) == 'webkit' || k.substr(0,3) == 'moz' || k == 'registerParent' || k == 'apply'
                    || k == 'dispatchEvent' || k == 'addEventListener' || k == 'removeEventListener') {
                    // private or callback - starts with _ or 'on'
                } else if (v == HTMLElement.prototype[k] || v == Element.prototype[k] || v == Node.prototype[k]) {
                    // node method
                } else if (HTMLVideoElement[k] !== undefined || HTMLElement[k] !== undefined || Element[k] !== undefined || Node[k] !== undefined || el[k] !== undefined) {
                    // video node property
                } else if ($.isFunction(v)) {
                    methods[k] = true;
                } else if (['string', 'number', 'boolean'].indexOf(typeof v) > -1) {
                    methods['get'+k.substr(0,1).toUpperCase()+k.substr(1)] = true;
                } else if (v && props.indexOf(k) > -1) {
                    methods[k] = this._scanMethods(v, props);
                }
            }
            return methods;
        },

        _postMessage: function (data) {
            if (!this.postMessage.source) return;
            // @TODO remember postmessage history while .postmessageSource is null
            return this.postMessage.source.postMessage(JSON.stringify(data), this.postMessage.targetOrigin);
        },

        _determineTargetOrigin: function (origins) {
            origins = origins ? ($.isArray(origins) ? origins : [origins]) : [];
            var referrer = document.referrer || '',
                cleanReferrer = this._cleanUrl(referrer),
                cleanOrigins = $.map(origins, this._cleanUrl),
                targetOrigin;

            if (origins.indexOf('*') > -1 || $.map(cleanOrigins, function (orig) { return orig == cleanReferrer; }).indexOf(true) > -1) {
                targetOrigin = this._cleanUrl(referrer, true);
            } else {
                return false;
            }
            return targetOrigin;
        },

        _cleanUrl: function (url, noproto) {
            var proto = '';
            if (url.slice(0,7) == 'http://') {
                if (noproto === true) proto = 'http://';
                url = url.slice(7);
            }
            if (url.slice(0,8) == 'https://') {
                if (noproto === true) proto = 'https://';
                url = url.slice(8);
            }
            $.each(['#', '?', '/'], function (c) { if(url.indexOf(c) > -1) { url = url.split(c)[0]; } });
            if (noproto !== true && url.slice(0,4) == 'www.') url = url.slice(4);
            return proto+url;
        },

        _cleanObject: function (obj) {
            var newObj = $.isArray(obj) ? [] : {},
                that = this;
            $.each(obj, function (k, v) {
                if (!obj.hasOwnProperty(k)) return;
                if (['boolean', 'number', 'string'].indexOf(typeof v) > -1) {
                    newObj[k] = v;
                } else if ($.isArray(obj) || $.isPlainObject(obj)) {
                    newObj[k] = that._cleanObject(v);
                }
            });
            return newObj;
        },

        ready: function () {

        }
    });


}(jQuery, smile));

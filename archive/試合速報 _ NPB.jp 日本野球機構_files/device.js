var ua = ua || {};

(function (window, $, undefined) {

	ua.name = window.navigator.userAgent.toLowerCase();
	ua.isIE = (ua.name.indexOf('msie') >= 0 || ua.name.indexOf('trident') >= 0);
	ua.isiPhone = ua.name.indexOf('iphone') >= 0;
	ua.isiPod = ua.name.indexOf('ipod') >= 0;
	ua.isiPad = ua.name.indexOf('ipad') >= 0;
	ua.isiOS = (ua.isiPhone || ua.isiPod || ua.isiPad);
	ua.isAndroid = ua.name.indexOf('android') >= 0;
	ua.isTablet = (ua.isiPad || (ua.isAndroid && ua.name.indexOf('mobile') < 0));
	ua.isSP = ( ( ua.isAndroid && !ua.isTablet ) || ua.isiPhone || ua.isiPod );
	ua.isLoadCSS = false;

	ua.versionNumber = "2025080701";

	if (ua.isIE) {
		ua.verArray = /(msie|rv:?)\s?([0-9]{1,})([\.0-9]{1,})/.exec(ua.name);
		if (ua.verArray) {
			ua.ver = parseInt(ua.verArray[2], 10);
		}
	}
	if (ua.isiOS) {
		ua.verArray = /(os)\s([0-9]{1,})([\_0-9]{1,})/.exec(ua.name);
		if (ua.verArray) {
			ua.ver = parseInt(ua.verArray[2], 10);
		}
	}
	if (ua.isAndroid) {
		ua.verArray = /(android)\s([0-9]{1,})([\.0-9]{1,})/.exec(ua.name);
		if (ua.verArray) {
			ua.ver = parseInt(ua.verArray[2], 10);
		}
	}

	ua.loadCSS = function( ary ) {
		var url;
		for ( var i = 0 ; i < ary.length ; i++ ) {
			if ( ua.isSP ) {
				url = ary[i].replace(".css","_sp.css");
			}
			else {
				url = ary[i];
			}
			url += "?" + ua.versionNumber;
			document.write('<link rel="stylesheet" href="' + url + '" media="all">');
		}

		if ( ua.isSP ) {
			$('meta[name=viewport]').attr('content','width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
		}

		ua.isLoadCSS = true;
	}

}(this, jQuery));

(function WebViewStaticScope(window) {
	if (!window.blackberry)
		blackberry = new Object();
	if (!blackberry.lib)
		blackberry.lib = new Object();
	
	var lib = blackberry.lib;
	if (!lib.views)
		lib.views = new Object();
	
	var WebView = lib.views.WebView = function WebView() {		
		var _view = window.open('', '_blank');
		var _timer = null;
		var _loaded = true;
		var _url = '';
		
		var getDocument = function() {
			return _view.window.document;
		};
		
		var urlChecker = function() {
			var newUrl = _view.window.location.href;
			if (newUrl != _url) {
				// dispatch Something
				_url = newUrl;
			}
		};
		
		var startListener = function() {
			_timer = setInterval(urlChecker, 500);
		};
		
		var stopListener = function() {
			clearInterval(_timer);
			_timer = null;
		};
		
		this.__defineGetter__('document', getDocument);
		
		
		this.load = function(url, replace) {
			_loaded = false;
			if (replace || (!replace && replace !== false))
				_view.window.location.replace(url);
			else
				_view.window.location.assign(url);
		};
		
		this.write = function() {
			
		};
		
		this.writeToHead = function(str) {
			
		};
		
		this.writeToBody = function(str) {
			
		};
		
		this.close = function() {
			_view.close();
		};
		
		this.clear = function() {
			_view.window.location.assign('about:blank');
			_loaded = true;
		};
	};
	WebView.URL_CHANGE;
	WebView.URL_LOADED;
	WebView.CLOSED;
})(window);
/* EventDispatcher */
(function EventDispatcherStaticScope() {
	if (!window.blackberry)
		blackberry = new Object();
	if (!blackberry.grahamzibar)
		blackberry.grahamzibar = new Object();
	if (!blackberry.grahamzibar.events)
		blackberry.grahamzibar.events = new Object();
	
	Function.prototype.blackberry_grahamzibar_events_EventDispatcher_ID = 0;
	var ID = 0;
	blackberry.grahamzibar.events.EventDispatcher = function EventDispatcher() {
		var _events = {};
		var _count = {};
		
		var addEventListener = function addEventListener(event, callback) {
			var rry = _events[event];
			if (!rry) {
				_events[event] = {};
				_count[event] = 0;
			}
			_count++;
			var id = callback.blackberry_grahamzibar_events_EventDispatcher_ID = ID++;
			rry[id] = callback;
		};
		
		var removeEventListener = function removeEventListener(event, callback) {
			var rry = _events[event];
			if (!rry)
				return;
			var id = callback.blackberry_grahamzibar_events_EventDispatcher_ID;
			if (!rry[id])
				return;
			delete rry[id];
			var count = --_count[event];
			if (!count) {
				delete _events[event];
				delete _count[event];
			}
			callback.blackberry_grahamzibar_events_EventDispatcher_ID = 0;
		};
		
		var dispatchEvent = function dispatchEvent(event, data) {
			var rry = _events[event];
			if (!rry)
				return;
			for (var id in rry)
				rry[id](data);
		};
		
		var removeEventListeners = function removeEventListeners(event) {
			if (event) {
				delete _events[event];
				delete _count[event];
			} else {
				_events = {};
				_count = {};
			}
		};
	};
})();
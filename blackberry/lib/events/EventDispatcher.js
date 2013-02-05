/*
* Copyright (c) 2013 Research In Motion Limited.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

/* EventDispatcher */
(function EventDispatcherStaticScope() {
	if (!window.blackberry)
		blackberry = new Object();
	if (!blackberry.lib)
		blackberry.lib = new Object();
	if (!blackberry.lib.events)
		blackberry.lib.events = new Object();
	
	Function.prototype.blackberry_lib_events_EventDispatcher_ID = 0;
	var ID = 0;
	blackberry.lib.events.EventDispatcher = function EventDispatcher() {
		var _events = {};
		var _count = {};
		
		this.addEventListener = function addEventListener(event, callback) {
			var rry = _events[event];
			if (!rry) {
				rry = _events[event] = {};
				_count[event] = 0;
			}
			_count[event]++;
			rry[callback.blackberry_lib_events_EventDispatcher_ID || ++ID] = callback;
		};
		
		this.removeEventListener = function removeEventListener(event, callback) {
			var rry = _events[event];
			if (!rry)
				return;
			var id = callback.blackberry_lib_events_EventDispatcher_ID;
			if (!rry[id])
				return;
			delete rry[id];
			var count = --_count[event];
			if (!count) {
				delete _events[event];
				delete _count[event];
			}
			callback.blackberry_lib_events_EventDispatcher_ID = 0;
		};
		
		this.dispatchEvent = function dispatchEvent(event, data) {
			var rry = _events[event];
			if (!rry)
				return;
			for (var id in rry)
				rry[id](data);
		};
		
		this.removeEventListeners = function removeEventListeners(event) {
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
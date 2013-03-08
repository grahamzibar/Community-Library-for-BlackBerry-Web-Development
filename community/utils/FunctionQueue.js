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

/* FunctionQueue */
(function FunctionQueueStaticScope() {
	if (!window.community)
		community = new Object();
	if (!community.utils)
		community.utils = new Object();
	
	var Queued = function Queued(id, type, method, args) {
		this.id = id;
		this.type = type;
		this.method = method;
		this.arguments = args;
	};
	
	var OPEN_TASK_TYPE = 0;
	var FUNCTION_TASK_TYPE = 1;
	var CLOSE_TASK_TYPE = 2;
	var FunctionQueue = community.utils.FunctionQueue = function FunctionQueue() {
		var _openTasks = new Array();
		var _taskQueue = new Array();
		var _started = false;
		var _busy = false;
		
		var openTaskHandler = function(id, callback) {
			if (typeof id == 'function') {
				callback = id;
				id = null;
			}
			_openTasks[_openTasks.length] = id;
			console.log('TASK STARTED:', id || 'anonymous');
			if (callback)
				callback();
			nextHandler();
		};
		
		var closeTaskHandler = function(callback) {
			console.log('TASK COMPLETE:', _openTasks.pop() || 'anonymous');
			if (callback)
				callback();
			nextHandler();
		};
		
		var nextHandler = function() {
			if (!_started || _taskQueue.length == 0)
				return;
			var task = _taskQueue.shift();
			task.method.apply(this, task.arguments);
		};
		
		var push = function(type, method, args) {
			_taskQueue[_taskQueue.length] = new Queued(getCurrentTask(), type, method, args);
		};
		
		this.openTask = function(id, callback) {
			push(OPEN_TASK_TYPE, openTaskHandler, arguments);
			if (_started && !_busy && _taskQueue.length == 1)
				nextHandler();
		};
		
		this.closeTask = function(callback) {
			push(CLOSE_TASK_TYPE, closeTaskHandler, arguments);
			if (_started && !_busy && _taskQueue.length == 1)
				nextHandler();
		};
		
		this.push = function(method, args) {
			push(FUNCTION_TASK_TYPE, method, args);
			
			if (_busy)
				return;
			
			_busy = true;
			nextHandler();
		};
		
		this.next = function() {
			if (_taskQueue.length == 0) {
				_busy = false;
				return;
			}
			nextHandler();
		};
		
		this.start = function() {
			_started = true;
			nextHandler();
		};
		
		this.stop = function() {
			_started = false;
		};
		
		this.clear = function() {
			_openTasks = new Array();
			_taskQueue = new Array();
			_busy = false;
		};
		
		this.length = function() {
			return _taskQueue.length;
		};
		
		var getCurrentTask = this.getCurrentTask = function() {
			return _openTasks.length ? _openTasks[_openTasks.length - 1] : FunctionQueue.DEFAULT_TASK;
		};	
	};
	FunctionQueue.TASK_START = 'task_start';
	FunctionQueue.TASK_COMPLETE = 'task_complete';
	FunctionQueue.DEFAULT_TASK = 'default';

})();
/*
* IndexedDB Wrapper
* Author: Graham Robertson

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

/*
	REQUIREMENTS
	
	blackberry.lib.events.EventDispatcher
	blackberry.lib.utils.FunctionQueue
	
	See Readme for use instructions
	
	If I  but the end of it I had given it back to them
*/

(function IndexedStaticScope(window, lib) {
	
	/* Event Objects */
	var ErrorEvent = function() {
		
	};
	
	var RequestEvent = function() {
		
	};
	
	var TransactionEvent = function() {
		
	};
	
	/* Private Classes */
	var Transaction = function() {
		this.transaction;
		this.request;
		
		this.onsuccess = ;
		this.onerror = ;
		this.onabort = ;
	};
	
	var Indexed = lib.db.Indexed = function Indexed(name, version, schema) {
		this.inheritFrom = lib.events.EventDispatcher;
		this.inheritFrom();
		delete this.inheritFrom;
		
		var _queue = lib.utils.FunctionQueue();
		var _dbAccess = window.IndexedDB || window.webkitIndexedDB;
		var _db;
		var _request;
		var _transactions = new Array();
		
		
		var _blocked = false;
		var _upgrading = false;
		
		/* Internal Functions */
		
		var processSchema = function() {
			// Here, we start the cumbersome process of interating over the keys
			// of the schema object and executing the necessary JavaScript.
		};
		
		// API
		this.connect = function() {
			
		};
		this.disconnect = function() {
			
		};
		this.get = function() { // this should maybe be some sort of JSON like the schema.. makes the most sense.
		};
		this.getByKey = function() {
			
		};
		this.getByKeyRange = function() {
			
		};
		this.getByIndex = function() {
			
		};
		this.getByIndexRange = function() {
			
		};
		this.join = function() {
			
		};
		this.insert = function() {
			
		};
		this.update = function() {
			
		};
		this.delete = function() {
			
		};
		this.clear = function() {
			
		};
		this.getObjectStores = function() {
			
		};
		this.startTransaction = function() {
			
		};
		this.closeTransaction = function() {
			
		};
	};
	Indexed.ERROR = 'error';
	Indexed.DATABASE_REQUESTED = 'database_requested';
	Indexed.DATABASE_BLOCKED = 'database_blocked';
	Indexed.DATABASE_UPGRADING = 'database_upgrading';
	Indexed.DATABASE_OPENED = 'database_opened';
	Indexed.DATABASE_REQUEST_ERROR = 'database_request_error';
	
	Indexed.REQUEST_STARTED = 'request_started';
	Indexed.REQUEST_COMPLETE = 'request_complete';
	Indexed.REQUEST_ERROR = 'request_error';
	Indexed.REQUEST_ABORTED = 'request_aborted';
	
	
	
})(window, blackberry.lib);
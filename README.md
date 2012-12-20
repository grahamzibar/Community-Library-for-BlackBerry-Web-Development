# My BlackBerry Library #

Only the greatest library of code ever.

Truth.

## Namespace ##

All libraries in this repo are located within the `blackberry.grahamzibar` namespace.  Mostly because I like building apps and code for the WebWorks platform on BlackBerry and also because my username is grahamzibar.  Makes sense, yeah?

## Event Dispatcher ##

No requirements.

	blackberry.grahamzibar.events.EventDispatcher;
	
	// Example
	var Dispatcher = function Dispatcher() {
		this.inheritFrom = blackberry.grahamzibar.events.EventDispatcher;
		this.inheritFrom();
		delete this.inheritFrom;
		
		// Whatever other code your dispatcher does
	};
	
	// Create an instance
	var instance = new Dispatcher();
	
	// The available API
	instance.addEventListener(eventKey, callback);
	instance.removeEventListener(eventKey, callback);
	instance.dispatchEvent(eventKey, eventObj);
	instance.removeEventListeners(optEventKey); // with no eventKey passed, this removes **ALL** listeners.

## FileManager ##

Requires `blackberry.grahamzibar.events.EventDispatcher` and `blackberry.grahamzibar.utils.FunctionQueue`.

### How it works ###

The **HTML5 FileManager** by default kinda sucks.  Why?  [Try it out for yourself](http://www.w3.org/TR/file-system-api/) and come back here with tears of frustration and I'll forgive you for doubting me.

Most (if not all) calls to the filesystem are asynchronous but no interface for listening to events exists.  Instead, we're required to pass in callbacks as arguments to filesystem operations and thus it starts to get messy really quickly.  As an example, let's get the filesystem, retrieve a file, and write data to it.


	window.requestFileSystem(window.TEMPORARY, 5 * 1024 * 1024, initHandler, errorHandler);
	function initHandler(fs) {
		fs.root.getFile('/Documents/HelloWorld.txt', { create: false }, function (fileEntry) {
			fileEntry.createWriter(function (fileWriter) {
				window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder;
				
				var bb = new BlobBuilder();
				bb.append('Hello World');
				fileWriter.write(bb.getBlob('text/plain'));
			}, errorHandler);
		}, errorHandler);
	};
	function errorHandler(){
		console.log('An error occured');
	};
	

For doing something very basic, it's already hard to follow.  Also, what if **/Documents** doesn't exist?  What if **HelloWorld.txt** doesn't exist within it?  We would need separate error handlers for each operation which in turn would then create the proper filesystem entries and then have to recall our original task.  To create bug-free code, it helps to have organized clean code and, with the way this system is built, it becomes hard to do so for more complicated tasks.

To Free you of this burden, I have written the `blackberry.grahamzibar.io.FileManager` class.  It essentially provides a way to queue filesystem operations one after the other and handle for you the creation of non-existent directories or files you've requested.  It gives you the freedom of listening to one generic error event or error events specific to certain operations (such as move, copy, etc) by inheriting the `blackberry.grahamzibar.events.EventDispatcher` class.  It also allows you to create *tasks* and you can simply listen for the start and end of those tasks when they are, eventually, performed.  The secret is functions are not called as you necessarily call them, but are queued until the filesystem is ready to call them by wrapping the `blackberry.grahamzibar.utils.FunctionQueue` class.  Here's an example:

~~~

(function App(FileManager) {

var filesystem = new FileManager(window.TEMPORARY);
filesystem.init();
filesystem.changeDir('/Shared/Documents/MyApp');
filesystem.openTask('FirstFile');
filesystem.saveNewFile('MyAppsFirstFile.txt', someBlobOrArrayBufferDataWeHave);
filesystem.closeTask();

console.log('Hello World :)');

})(blackberry.grahamzibar.io.FileManager);

~~~

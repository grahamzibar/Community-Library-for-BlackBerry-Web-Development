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
	instance.removeEventListeners(opt_EventKey); // with no eventKey passed, this removes **ALL** listeners.

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

To Free you of this burden, I have written the `blackberry.grahamzibar.io.FileManager` class.  It essentially provides a way to queue filesystem operations one after the other and handle for you the creation of non-existent directories or files you've requested.  It gives you the freedom of listening to one generic error event or error events specific to certain operations (such as move, copy, etc) by inheriting the `blackberry.grahamzibar.events.EventDispatcher` class.  It also allows you to create *tasks* to which you can simply listen for when they start and end when they are, eventually, performed.  The secret is functions are not called as you necessarily call them, but are queued until the filesystem is ready to call them by wrapping the `blackberry.grahamzibar.utils.FunctionQueue` class.  Here's an example:

~~~

(function App(FileManager) {

var filesystem = new FileManager(window.TEMPORARY);
	filesystem.load();
	filesystem.changeDir('/Shared/Documents/MyApp');
	filesystem.addEventListener(FunctionQueue.TASK_START, someListener);
	filesystem.addEventListener(FunctionQueue.TASK_COMPLETE, someOtherListener);
	
	filesystem.openTask('FirstFile');
	filesystem.saveNewFile('MyAppsFirstFile.txt', someBlobOrArrayBufferDataWeHave);
	filesystem.closeTask();

	console.log('Hello World');

})(blackberry.grahamzibar.io.FileManager);

~~~

The key thing to note in the above code example is these operations are **not** called as we call them.  When we call `filesystem.changeDir` and pass in our desired arguments, `filesystem.load()` may not have finished requesting for the filesystem and obtaining usage information.  In fact, the last statement `console.log('Hello World');` will probably execute before we get to navigate to the **/Shared/Documents/MyApp** directory.  The idea here is that we're _queueing_ functions to be executed.  This goes for every function `FileManager` exposes except for `dispatchEvent` - this is the only function in the API that will execute immediately.  Therefore, even `addEventListener` and `removeEventListener` have their algorithms stalled until it's their turn.  All of this is possible because `FileManager` has a private `FunctionQueue` object which stores functions we called if the're not ready to be executed just yet.

### API ###

#### Events ####
* `addEventListener(eventKey, callbackFN)` - Allows us to listen to events dispatched by the `FileManager`.

* `removeEventListener(eventKey, callbackFN)` - When we no longer need to listen to events, we call this to remove the callback reference from `FileManager`.

* `openTask(id, opt_CallbackFN)` - Before we start a group of operations, we can call this function to assign all following operations to the **id** of the task until the `closeTask` function is called.

* `closeTask(opt_CallbackFN)` - This will close the _last opened task_.  Thus, if we opened 3 tasks, we would need to call close 3 times for all tasks to be complete.  In this sense, we're able to create subtasks fairly easily:  
~~~
var startCallback = function() {
	console.log('Task Started');
};
var completeCallback = function() {
	console.log('Task Complete');
};
// OPEN TASK
filesystem.openTask('MoveFile');
filesystem.changeDir('/To/Some/Path');
filesystem.moveFile('MoveMe.txt', '/now/to/another/path');
// OPEN SUBTASK
filesystem.openTask('RenameFile', startCallback);
filesystem.changeDir('/now/to/another/path');
filesystem.renameFile('MoveMe.txt', 'Renamed.txt');
// CLOSE SUBTASK
filesystem.closeTask(completeCallback);	
// CLOSE TASK
filesystem.closeTask(completeCallback);
~~~

To reiterate, since all functions are queued (except `dispatchEvent` inherited from `blackberry.grahamzibar.events.EventDispatcher`), calling `openTask` does **NOT** start the task, but queues the starting of the task until the `FileManager` is ready to do so.  For example, `moveFile` does not actually move th file, but it queues several operations for requesting **MoveMe.txt** and the directory **/now/to/another/path** and then using both to perform the actual **moveTo** operation specified in the [File System API](http://www.w3.org/TR/file-system-api/).  All three of those operations are asynchronous and thus we need to wait for all of them to have been completed successfully before proceeding to actually start the subtask **RenameFile**.

#### Navigation and Directories ####
* `changeDir(pathSTR, opt_CreateBOOL)` - Much like **cd** in a terminal or command prompt, this function allows us to navigate _into_ a directory and make it our _**current working directory**_.  By default, `opt_CreateBOOL` is **true** (hence the opt_ since this parameter is optional and is of boolean type) and will take care of creating the directory for you if it does not already exists.  It actually takes it one step further and will create any non-existent directory in the path tree.  For example, if you pass **/path/to/my/heart/** to the function but **my** and **heart** don't exist, `changeDir` will take care of that for you unless you explicity pass **false** as the second argument.

* `makeDir(pathSTR)` - Similar to the last function but we won't be navigated to that directory and it will always be created for us.  If we listen to the `DIRECTORY_READY` event, we gain access to the entry object.

* `up` - Same as performing a **cd ..**.  We essentially navigate up to the parent directory.

* `getParent` - Like `up`, but we don't navigate into the directory.  The purpose would be to listen to the `DIRECTORY_READY` event and use the entry property in the event object returned.


#### Entry Modifiction ####

* `copyDir` - 

* `copyFile` -  

* `copyEntry` - 

* `moveDir` - 

* `moveFile` - 

* `moveEntry` - 

* `renameDir` - 

* `renameFile` - 

* `renameEntry` - 

* `removeDir` - 

* `removeFile` - 

* `removeEntry` - 


#### File IO ####
* `openFile` - 

* `writeTo` - 

* `appendTo` - 

* `read` - 

* `saveNewFile` - 


#### FileSystem ####
* `updateInfo` - 

* `load` - 


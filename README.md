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
	

For doing something very basic, it's already hard to follow.  Also, what if "**/Documents**" doesn't exist?  What if "**HelloWorld.txt**" doesn't exist within it?  We would need separate error handlers for each operation which, in turn, would create the proper filesystem entries and then we would have to recall our original task.  To create bug-free code, it helps to have organized code and, with the way this system is built, it becomes hard to do so for more complicated tasks.

To Free you of this burden, I have written the `blackberry.grahamzibar.io.FileManager` class.  It essentially provides a way to queue filesystem operations one after the other and handle for you the creation of non-existent directories or files you've requested.  It gives you the freedom of listening to one generic error event or events specific to certain operations (such as move, copy, etc) by inheriting the `blackberry.grahamzibar.events.EventDispatcher` class.  It also allows you to create *tasks* to which you can simply listen for when they start and end when they are, eventually, completed.  The secret is these operations are not performed necessarily when you call them, but are queued until the filesystem is ready to call them by wrapping the `blackberry.grahamzibar.utils.FunctionQueue` class.  Here's an example:

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

The key thing to note in the above code example is these operations are **not** called as we call them.  When we call `filesystem.changeDir` and pass in our desired arguments, `filesystem.load()` may not have finished requesting for the filesystem and obtaining usage information.  In fact, the last statement `console.log('Hello World');` will probably execute before we get to navigate to the "**/Shared/Documents/MyApp**" directory.  The idea here is that we're _queueing_ functions to be executed.  This goes for every function `FileManager` exposes except for `dispatchEvent` -- this is the only function in the API that will execute immediately.  Therefore, even `addEventListener` and `removeEventListener` have their algorithms stalled until it's their turn.  All of this is possible because `FileManager` has a private `FunctionQueue` object which stores functions we call if the're not ready to be executed just yet.

### API ###

#### Constructor ####
* `new blackberry.grahamzibar.io.FileManager(type, opt_size)` - The parameter `type` is either one of the constants window.TEMPORARY or window.PERSISTENT (depending how your app needs to store data) and, by default, `opt_size` is our request for the size of the filesystem in bytes.  By default, we request 5 MB but many implementations of HTML5 FileSystem storage provides us with a much larger amount of data than we request.  
**NOTE**: to access the _real_ filesystem and not a sandboxed filesystem on **BlackBerry 10**, we must add the following before intializing our filesystem: `blackberry.io.sandbox = false;`.  We _must_ add the feature element `<feature id="blackberry.io" />` to the config.xml despite what the [documentation](https://developer.blackberry.com/html5/apis/blackberry.io.html) tells you.

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

To reiterate, since all functions are queued (except `dispatchEvent` which is inherited from `blackberry.grahamzibar.events.EventDispatcher`), calling `openTask` does **NOT** start the task, but queues the starting of the task until the `FileManager` is ready to do so.  For example, `moveFile` does not actually move the file but it queues several operations: requesting **MoveMe.txt**, requesting the directory **/now/to/another/path**, and then using both to perform the actual **moveTo** operation specified in the [File System API](http://www.w3.org/TR/file-system-api/).  All three of those operations are asynchronous and thus we need to wait for all of them to have been completed successfully before proceeding to actually start the subtask **RenameFile**.

#### Navigation and Directories ####
* `changeDir(pathSTR, opt_CreateBOOL)` - Much like **cd** in a terminal or command prompt, this function allows us to navigate _into_ a directory and make it our _**current working directory**_.  By default, `opt_CreateBOOL` is **true** (hence the opt_ since this parameter is optional and is of boolean type) and will take care of creating the directory for you if it does not already exists.  It actually takes it one step further and will create any non-existent directory in the path tree.  For example, if you pass **/path/to/my/heart/** to the function but **my** and **heart** don't exist, `changeDir` will take care of that for you unless you explicity pass **false** as the second argument.

* `changeDir(directoryEntry)` - **Overloaded method** - Navigates us to a directory using a filesystem entry object we already have.

* `makeDir(pathSTR)` - Similar to the `changeDir` function, but we won't be navigated to that directory and it will always be created for us.  If we listen to the `DIRECTORY_READY` event, we gain access to the entry object.

* `up()` - Same as performing a "**cd ..**".  We essentially navigate up to the parent of our _**current working directory**_.

* `getParent(opt_entry)` - Like `up`, but we don't navigate into the directory.  The purpose would be to listen to the `DIRECTORY_READY` event and use the entry property in the event object returned.  We can also pass in an entry object we already have to request for its parent.

* `readEntries(opt_directoryEntry)' - A lot like **ls**, this will either use the `opt_directoryEntry` or our _**current working directory**_ as the parent entry from which to list its entries.


#### Entry Modifiction ####

All filesystem entry modifications are very similar.  Both `dirNameSTR` and `fileNameSTR` can be just the name of the directory or file within our _**current working directory**_, the relative path from the _**current working directory**_ to desired entry, the absolute path from the root of the filesystem, or an actual entry object to be modified.  `toPathSTR` is the directory to which we wish to copy or move the directory or file (with the same rules mentioned above) and, for the cases of `copyEntry` and `moveEntry`, `toPathSTRorENTRY` allows us to pass either a target path or entry.  The rest should hopefully be pretty self-explanatory :)

* `copyDir(dirNameSTR, toPathSTR, opt_newNameSTR)`

* `copyFile(fileNameSTR, toPathSTR, opt_newNameSTR)`

* `copyEntry(entry, toPathSTRorENTRY, opt_newNameSTR)`

* `moveDir(dirNameSTR, toPathSTR, opt_newNameSTR)`

* `moveFile(fileNameSTR, toPathSTR, opt_newNameSTR)`

* `moveEntry(entry, toPathSTRorENTRY, opt_newNameSTR)`

* `renameDir(dirNameSTR, newNameSTR)` 

* `renameFile(fileNameSTR, newNameSTR)`

* `renameEntry(entry, newNameSTR)`

* `removeDir(dirNameSTR)` 

* `removeFile(fileNameSTR)`

* `removeEntry(entry)`


#### File IO ####

All `data` parameters listed below can be either of type [Blob](http://www.w3.org/TR/FileAPI/#blob) or [ArrayBuffer](https://developer.mozilla.org/en-US/docs/JavaScript/Typed_arrays/ArrayBuffer).  If you need to save base64 data (or read a file and get base64 data), there are a plethora of libraries on the web for converting base64 to ArrayBuffers and vise-versa.  An awesome [base64-binary library](http://blog.danguer.com/2011/10/24/base64-binary-decoding-in-javascript/) by Daniel Guerrero is worth checking-out.

* `openFile(fileNameSTR, opt_createBOOL)` - We use this to not only retrieve the **FileEntry** and store it as our _**current working file**_ but to also create the **FileReader** for us.  Use the `FILE_READY` event to get the FileEntry and the `FILE_READ` event to get both the **FileEntry** and **FileReader**.  Or, we can simply listen to the `FILE_OPENED` event when using _this particular_ function.  The parameter `fileNameSTR` can be a file name within our _**current working directory**_, a relative path from said directory, or an absolute path.  The second parameter is optional and is **true** by default.  It will create the file if it already does not exist.

* `read(entry)` - Here we create the **FileReader** object and dispatch the aforementioned `FILE_READ` event to retireve the **FileReader** of a known entry (must be of type **FileEntry**).

* `saveNewFile(fileNameSTR, data)` - This handy function saves us the trouble of handling several asynchronous operations and simply saving some data somewhere on the filesystem with the data we need to store.  Without handling any errors or callbacks, we can simply invoke this method and walk away.  Nice, right?

The next two funtions only work once we've opened a file using the `openFile` function.  They act on the _**current working file**_ and can write an entire file or add data to the end of the file respectively.

* `writeTo(data)`

* `appendTo(data)`

#### FileSystem ####
* `updateInfo()` - This asks the filesystem for the current available memory, used memory, and overall capacity of the filesystem.  This will dispatch the `INFO_UPDATED` event.

* `load()` - Initializes the filesystem and obtains usage information.  This **must** be called in order for other operations to occur.  This also allows us to setup any appropriate listeners we wish to have registered prior to the filesystem being loaded.


### Events ###

The `FileManager` exposes a great deal of events to which we can subscribe, depending on how we wish to use the filesystem for our app.

#### Event Classes (All are private and are used for reference only) ####



#### Event Constants ####

All constants are static and exist as properties of the `FileManager` class.  Below, we just refer to the class as is but don't forget it exists within the `blackberry.grahamzibar.io` namespace.  Just like in an example above, I like to cache classes into variables as so: `var FileManager = blackberry.grahamzibar.io.FileManager`.

##### Request Events #####

Request events don't fire when we request for these operations to occur, but when the **FileManager's** queue is ready for these operations to occur.  We'll still have to wait for the asynchronous operations to complete before we can fire our on-complete/fire events.

* `FileManager.DIRECTORY_REQUESTED` - When a directory is requested in order to perform some operation.  
_returns_ `EntryRequestEvent`
* `FileManager.DIRECTORY_CHANGE_REQUESTED` - Whenever we attempt to navigate into a directory.  
_returns_ `EntryRequestEvent`

* `FileManager.FILE_REQUESTED` - The **FileEntry** has been asked for.  
_returns_ `EntryRequestEvent`
* `FileManager.FILE_READ_REQUESTED` - The request for the **FileReader*.  
_returns_ `RequestEvent`
* `FileManager.FILE_WRITE_REQUESTED` - We wish to start writing data to a file, but we must wait for the **FileWriter**  
_returns_ `RequestEvent`
* `FileManager.FILE_OPEN_REQUESTED` - We have asked to retrieve a file entry and obtain the file reader using `openFile`.  
_returns_ `EntryRequestEvent`
* `FileManager.FILE_CREATE_REQUESTED` - Whenever we use `saveNewFile` to request the creation of a file entry, get the file writer, and write data to the disk.  
_returns_ `EntryRequestEvent`

The following are pretty self explanatory

* `FileManager.ENTRY_MOVE_REQUESTED` - _returns_ **ModifyRequestEvent**
* `FileManager.ENTRY_COPY_REQUESTED` - _returns_ **ModifyRequestEvent**
* `FileManager.ENTRY_RENAME_REQUESTED` - _returns_ **ModifyRequestEvent**
* `FileManager.ENTRY_REMOVE_REQUESTED` - _returns_ **ModifyRequestEvent**

Lastly, the following event is when we've requested our _**current working directory**_ for its entries (be it files or folders.

* `FileManager.ENTRIES_LIST_REQUESTED` - _returns **RequestEvent**


##### On-Complete Events #####

* `FileManager.FILESYSTEM_READY`
* `FileManager.INFO_UPDATED`

* `FileManager.DIRECTORY_READY`
* `FileManager.DIRECTORY_CHANGED`

* `FileManager.FILE_READY`
* `FileManager.FILE_READ`
* `FileManager.FILE_WRITTEN`
* `FileManager.FILE_OPENED`
* `FileManager.FILE_CREATED`

* `FileManager.ENTRY_MOVED`
* `FileManager.ENTRY_COPIED`
* `FileManager.ENTRY_RENAMED`
* `FileManager.ENTRY_REMOVED`

* `FileManager.ENTRIES_LISTED`


Error Events

* `FileManager.ERROR`
* `FileManager.FILESYSTEM_ERROR`
* `FileManager.INFO_ERROR`

* `FileManager.DIRECTORY_ERROR`

* `FileManager.FILE_ERROR`
* `FileManager.FILE_READ_ERROR`
* `FileManager.FILE_WRITE_ERROR`

* `FileManager.ENTRY_MOVE_ERROR`
* `FileManager.ENTRY_COPY_ERROR`
* `FileManager.ENTRY_RENAME_ERROR`
* `FileManager.ENTRY_REMOVE_ERROR`

* `FileManager.ENTRIES_LIST_ERROR`

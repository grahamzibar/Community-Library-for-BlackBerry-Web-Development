# My BlackBerry Library #

Only the greatest library of code ever.

Truth.

## Namespace ##

All libraries in this repo are located within the `blackberry.lib` namespace.

## Event Dispatcher ##

No requirements.

	blackberry.lib.events.EventDispatcher;
	
	// Example
	var Dispatcher = function Dispatcher() {
		this.inheritFrom = blackberry.lib.events.EventDispatcher;
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

Requires `blackberry.lib.events.EventDispatcher` and `blackberry.lib.utils.FunctionQueue`.

### How it works ###

The **HTML5 File System API** by default is a bit of a pain.  Why?  [Try it out for yourself](http://www.w3.org/TR/file-system-api/) and come back here with tears of frustration and I'll forgive you for doubting me.

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
	

For doing something very basic, it's already hard to follow.  Also, what if **/Documents** doesn't exist?  What if **HelloWorld.txt** doesn't exist within it?  We would need separate error handlers for each operation which, in turn, would create the proper filesystem entries and then we would have to recall our original task.  To create bug-free code, it helps to have organized code and, with the way this system is built, it becomes hard to do so for more complicated tasks.

To Free you of this burden, I have written the `blackberry.lib.io.FileManager` class.  It essentially provides a way to queue filesystem operations one after the other and handle for you the creation of non-existent directories or files you've requested.  It gives you the freedom of listening to one generic error event or events specific to certain operations (such as move, copy, etc) by inheriting the `blackberry.lib.events.EventDispatcher` class.  It also allows you to create *tasks* to which you can simply listen for when they start and end when they are, eventually, completed.  The nice thing about tasks is we can group a series of operations together and not have to worry about the indiviual events; we can simply listen for the task to be finished.  The secret about all of **FileManager**'s operations is that they're not performed necessarily when you call them, but are queued until the filesystem is ready to call them by wrapping the `blackberry.lib.utils.FunctionQueue` class.  Here's an example:

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

})(blackberry.lib.io.FileManager);

~~~

The key thing to note in the above code example is these operations are **not** called as we call them.  When we call `filesystem.changeDir` and pass in our desired arguments, `filesystem.load()` may not have finished requesting for the filesystem and obtaining usage information.  In fact, the last statement `console.log('Hello World');` will probably execute before we get to navigate to the **/Shared/Documents/MyApp** directory.  The idea here is that we're _queueing_ functions to be executed.  This goes for every function `FileManager` exposes except for `dispatchEvent` -- this is the only function in the API that will execute immediately.  Therefore, even `addEventListener` and `removeEventListener` have their algorithms stalled until it's their turn.  All of this is possible because `FileManager` has a private `FunctionQueue` object which stores functions we call if the're not ready to be executed just yet.

### API ###

#### Constructor ####
* `new blackberry.lib.io.FileManager(type, opt_size)` - The parameter `type` is either one of the constants window.TEMPORARY or window.PERSISTENT (depending how your app needs to store data) and, by default, `opt_size` is our request for the size of the filesystem in bytes.  By default, we request 5 MB but many implementations of HTML5 FileSystem storage provides us with a much larger amount of data than we request.  
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

To reiterate, since all functions are queued (except `dispatchEvent` which is inherited from `blackberry.lib.events.EventDispatcher`), calling `openTask` does **NOT** start the task, but queues the starting of the task until the `FileManager` is ready to do so.  For example, `moveFile` does not actually move the file but it queues several operations: requesting **MoveMe.txt**, requesting the directory **/now/to/another/path**, and then using both to perform the actual **moveTo** operation specified in the [File System API](http://www.w3.org/TR/file-system-api/).  All three of those operations are asynchronous and thus we need to wait for all of them to have been completed successfully before proceeding to actually start the subtask **RenameFile**.

#### Navigation and Directories ####
* `changeDir(pathSTR, opt_CreateBOOL)` - Much like **cd** in a terminal or command prompt, this function allows us to navigate _into_ a directory and make it our _**current working directory**_.  By default, `opt_CreateBOOL` is **true** (hence the opt_ since this parameter is optional and is of boolean type) and will take care of creating the directory for you if it does not already exists.  It actually takes it one step further and will create any non-existent directory in the path tree.  For example, if you pass **/path/to/my/heart/** to the function but **my** and **heart** don't exist, `changeDir` will take care of that for you unless you explicity pass **false** as the second argument.

* `changeDir(directoryEntry)` - **Overloaded method** - Navigates us to a directory using a filesystem entry object we already have.

* `makeDir(pathSTR)` - Similar to the `changeDir` function, but we won't be navigated to that directory and it will always be created for us.  If we listen to the `DIRECTORY_MADE` event, we gain access to the entry object.

* `up()` - Same as performing a **cd ..** (so much like `changeDir` so the `FileManager.DIRECTORY_CHANGED` event fires upon completion) which means we navigate up to the _parent_ of our _**current working directory**_.

* `getParent(opt_entry)` - Like `up`, but we don't navigate into the directory.  The purpose would be to listen to the `DIRECTORY_READY` event and use the entry property in the event object returned.  We can also pass in an entry object we already have to request for its parent as opposed to the parent of the _**current working directory**_

* `readEntries(opt_directoryEntry)` - A lot like **ls**, this will either use the `opt_directoryEntry` or our _**current working directory**_ as the parent entry from which to list its entries.


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

#### Event Classes ####

All are **private** and are used for reference only so you cannot create instances of these yourselves.  However, these are the classes our `FileManager` uses to create events to dispatch.  Below, find the interfaces available to you.

~~~
FileSystemEvent {
	fileSystem
	
	// The following are represented in bytes
	used
	available
	capacity
}

EntryRequestEvent {
	path
	create // Did this request demand we create the entry if it does not exist?
}

RequestEvent {
	entry
}

ModifyRequestEvent {
	type // 
	path
	toPath
	newName
}

EntryReadyEvent {
	entry
}

ModifyEvent {
	type
	entry
}

ListEvent {
	directory
	entries // Not an array, but it does have a length property
}

ReadEvent {
	entry
	file // We use this to read data from the file
}

WriteEvent {
	entry
	writer // We use this to manually write data to the file
}

ErrorEvent {
	error
	message
}
~~~

#### Event Constants ####

All constants are static and exist as properties of the `FileManager` class.  Below, we just refer to the class as is but don't forget it exists within the `blackberry.lib.io` namespace.  Just like in an example above, I like to cache classes into variables as so: `var FileManager = blackberry.lib.io.FileManager`.

##### Request Events #####

Request events don't fire when we request for these operations to occur, but when the **FileManager's** queue is ready for these operations to occur.  We'll still have to wait for the asynchronous operations to complete before we can fire our on-complete/fire events.  These are _excellent_ for listening to when the filesystem is working..

* `FileManager.DIRECTORY_REQUESTED` - When a directory is requested in order to perform some operation.  This occurs because we need some reference to a **DirectoryEntry** but we currently do not have one.  
_returns_ `EntryRequestEvent`

* `FileManager.DIRECTORY_CHANGE_REQUESTED` - Whenever we attempt to navigate into a directory using `changeDir`.  
_returns_ `EntryRequestEvent`

* `FileManager.DIRECTORY_MAKE_REQUESTED` - If for some reason we desire to make a diretory which we believe to not yet exist using the `makeDir` function.  
_returns_ `EntryRequestEvent`

* `FileManager.FILE_REQUESTED` - The **FileEntry** has been asked for.  
_returns_ `EntryRequestEvent`

* `FileManager.FILE_READ_REQUESTED` - The request for the **FileReader**.  
_returns_ `RequestEvent`

* `FileManager.FILE_WRITE_REQUESTED` - We wish to start writing data to a file, but we must wait for the **FileWriter**  
_returns_ `RequestEvent`

* `FileManager.FILE_OPEN_REQUESTED` - We have asked to retrieve a file entry and obtain the file reader using `openFile`.  
_returns_ `EntryRequestEvent`

* `FileManager.FILE_CREATE_REQUESTED` - Whenever we use `saveNewFile` to request the creation of a file entry, get the file writer, and write data to the disk.  
_returns_ `EntryRequestEvent`


The following are pretty self explanatory

* `FileManager.ENTRY_MOVE_REQUESTED`  
_returns_ `ModifyRequestEvent`

* `FileManager.ENTRY_COPY_REQUESTED`  
_returns_ `ModifyRequestEvent`

* `FileManager.ENTRY_RENAME_REQUESTED`  
_returns_ `ModifyRequestEvent`

* `FileManager.ENTRY_REMOVE_REQUESTED`  
_returns_ `ModifyRequestEvent`


Lastly, the following event is when we've requested our _**current working directory**_ or some other entry for its entries (be it files or folders).

* `FileManager.ENTRIES_LIST_REQUESTED`  
_returns `RequestEvent`


##### On-Complete Events #####

* `FileManager.FILESYSTEM_READY` - The filesystem has initialized and we're ready to perform operations on the filesystem.  Any queued operations will begin to execute.
_returns_ `FileSystemEvent`

* `FileManager.INFO_UPDATED` - We now have the latest filesystem informaton.  
_returns_ `FileSystemEvent`

* `FileManager.DIRECTORY_READY` - A diretory that was requested is now available.  _ANY_ dirextory action fires this event.  
_returns_ `EntryReadyEvent`

* `FileManager.DIRECTORY_CHANGED` - If we not only requested a diretory, but did it through `changeDir` and we have navigated into it, this event is fired.  
_returns_ `EntryReadyEvent`

* `FileManager.DIRECTORY_MADE` - Here, we have requested a directory (so `FileManager.DIRECTORY_READY` also fires) using `makeDir`.  This means we have explicitly requested a directory for the purpose of creating it whether or not it already exists.  
_returns_ `EntryReadyEvent`

* `FileManager.FILE_READY` - Whenever a file entry has been requested to perform an operation and is now available.  
_returns_ `EntryReadyEvent`

* `FileManager.FILE_READ` - A file reader has been created and can be accessed through this event.  
_returns_ `ReadEvent`

* `FileManager.FILE_WRITTEN` - Data has been written to a file.  
_returns_ `WriteEvent`

* `FileManager.FILE_OPENED` - This is the combination of both retrieving a file entry and creating its file reader.  
_returns_ `ReadEvent`

* `FileManager.FILE_CREATED` - This is the combination of creating a file if it is not already there, requesting its file writer, and writing data to it.  
_returns `WriteEvent`

The following _return_ the `ModifyEvent`.

* `FileManager.ENTRY_MOVED`

* `FileManager.ENTRY_COPIED`

* `FileManager.ENTRY_RENAMED`

* `FileManager.ENTRY_REMOVED`

Lastly, this is when a successful reading of a directory's entries has occured:

* `FileManager.ENTRIES_LISTED`  
_returns_ `ListEvent`


##### Error Events #####

The following events are when any of the above **request** events have failed to perform successfuly and thus won't produce an **on-complete** event.  Note a handful of events don't have a corresponding error event.  This is simply because those operations are a combination of smaller operations which each already have their own unique and descriptive event listed below.

All below events _return_ the `ErrorEvent`.

* `FileManager.ERROR` - General error event.  Any other event after this will dispatch this event first.

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
* 

## Indexed ##

Requires `blackberry.lib.events.EventDispatcher` and `blackberry.lib.utils.FunctionQueue`.

### How it works ###

`blackberry.lib.db.Indexed`

IndexedDB is a new jazzy tool we have for storing _persistent_ information for web apps.  Not everyone supports IndexedDB but, luckily, BlackBerry 10 does!  And I'm happy about that.

**HOWEVER**, the current standard browser environments are left to implement leaves a lot to be desired.  For the most part, it looks really good but has many of the same issues that the **HTML5 File System API** does (see previous section for more details) with too many nested callbacks and the like.  It also has an unnecessary large number of classes and, thus, interfaces we need to worry about that just makes working with it terribly tedious.  APIs should be as semantic and concise as possible and we should haven't to worry about multiple classes or to pass callback function after callback function just to accomplish simple tasks.  This is where `blackberry.lib.db.Indexed` comes in handy...

**Indexed** works much like **FileManager** does by queueing and delaying operations you invoke and dispatches events accordingly _(but does an event really dispatch if no one is around to attach an event listener??!)_.  Below, we compare how the current standard implies we do it, and the way I've made things.

~~~
// Open a database, update the "schema", add an object to an object store, and then retrieve its generated key.

//
// 1. The ol' fashioned way:

var request = IndexedDB.open('MyDB', 1);
request.onupgradeneeded = function(e) {
	// This is our change script and, whenever the version of the database changes, this scripts runs.
	var db = e.target.result;
	
	var store = db.createObjectStore('person', { autoIncrement: true });
	store.createIndex('email', 'email', { unique: true });
	store.createIndex('name', 'name', { unique: false });
};
request.onsuccess = function(e) {
	var db = e.target.result;
	
	var transaction = db.transaction('person', 'readwrite');
	var store = transaction.objectStore('person');
	
	var request = store.add({ name: 'John Doe', email: 'john.doe@domain.com', alive: true });
	request.onsuccess = function(e) {
		// We can piggyback on the previous transaction if we keep adding requests!
		var index = store.index('email');
		var request = index.openCursor('john.doe@domain.com');
		request.onsuccess = function(e) {
			var cursor = e.target.result;
  			if (cursor) {
  				alert('The key for ' + cursor.value.name + ' is ' + cursor.key);
  				cursor.continue();
  				// this is how we get to our next "row" in the object store.
  				// We only have one object in the database, so this continue,
  				// will call our onsuccess again but cursor will be undefined
  				// and thus the loop will end.  Word.
  			}
		};
		request.onerror = function() {
			alert('Boo!');
		};
	};
	request.onerror = function(e) {
		alert('woops!');
	};
};
request.onerror = function(e) {
	alert(':(');
};

//
// 2. The better way:

(function(Indexed) {
	var schema = {
		person: {
			email: { index: true, unique: true },
			name: { index: true },
			__key__: true
		}
	};
	
	var db = new Indexed('MyDB', 1, schema);
	db.connect();
	db.insert('person', { name: 'John Doe', email: 'john.doe@domain.com', alive: true });
	
	var onRequestComplete = function(e) {
		var person = e.results[0];
		alert('The key for ' + person.name + ' is ' + person.__key__);
	};
	
	db.addEventListener(Indexed.REQUEST_COMPLETE, onRequestComplete);
	db.get('person', { index: 'email', value: 'john.doe@domain.com' });
	db.removeEventListener(Indexed.REQUEST_COMPLETE, onRequestComplete);
})(blackberry.lib.db.Indexed);
~~~

You be the judge: which seems easier to read, easier to write, and, thusly, easier to manage/debug?  Good.  Glad you're on our side :)

Note that the original way means we make structural changes to the database via an event called `onupgradeneeded`.  There is an inherent flaw with this as it's essentially an event for **change scripts**.  Perhaps the scenario of a user having database version 1 and needing to upgrade to database version 3 was overlooked - how do we run the change script for version 2?  I'll be more than happy to hear the answer if anyone has one!  This and other common problems is what my **Indexed** class solves.

### API ###

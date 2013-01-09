/* FileManager */
(function FileManagerStaticScope(window, grahamzibar) {
	window.storageInfo = window.storageInfo || window.webkitStorageInfo;
	window.requestFileSystem = window.requestFileSystem || window.requestFilesystem ||
								window.webkitRequestFileSystem ||
								window.webkitRequestFilesystem;
	
	if (!grahamzibar.io)
		grahamzibar.io = new Object();
	
	
	// EVENT CLASSES
	var FileSystemEvent = function(fs, used, available, capacity) {
		this.fileSystem = fs;
		this.used = used;
		this.available = available;
		this.capacity = capacity;
	};
	var EntryRequestEvent = function(path, create) {
		this.path = path;
		this.create = create;
	};
	var RequestEvent = function(entry) {
		this.entry = entry;
	};
	var EntryReadyEvent = function(entry) {
		this.entry = entry;
	};
	var ModifyRequestEvent = function(type, path, to, newName) {
		this.type = type;
		this.path = path;
		this.toPath = to;
		this.newName = newName;
	};
	var ModifyEvent = function(type, entry) {
		this.type = type;
		this.entry = entry;
	};
	var ListEvent = function(directoryEntry, entriesList) {
		this.directory = directoryEntry;
		this.entries = entriesList;
	};
	var ReadEvent = function(fileEntry, file) {
		this.entry = fileEntry;
		this.file = file;
	};
	var WriteEvent = function(fileEntry, fileWriter) {
		this.entry = fileEntry;
		this.writer = fileWriter;
	};
	var ErrorEvent = function(e, msg) {
		this.error = e;
		this.message = msg;
	};
	
	// THE CLASS YO
	var FileManager = grahamzibar.io.FileManager = function FileManager(type, opt_size) {
		this.inheritFrom = grahamzibar.events.EventDispatcher;
		this.inheritFrom();
		delete this.inheritFrom;
		
		var __self__ = this;
		var _queue = new grahamzibar.utils.FunctionQueue();
		
		var _fileSystem;
		var _state;
		var _initialized = false;
		
		var _used;
		var _available;
		var _capacity;
		
		var _directory;
		var _fileEntry;
		var _file;
		var _fileWriter;
		
		var _toDirectory; // For move and copy
		var _modifyEntry; // For move, copy, remove, rename, and writing new files
		var _saveWriter; // For writing new files
		
		// HANDLERS
		var errorHandler = function(e) {
			_queue.clear();
			var event = new ErrorEvent(e, FileManager.errorHandler(e));
			__self__.dispatchEvent(FileManager.ERROR, event);
			return event;
		};
		
		var fileSystemHandler = function(fs) {
			_fileSystem = fs;
			_directory = fs.root;
			console.log('FILESYSTEM INITIALIZED');
			_queue.next();
		};
		var fileSystemErrorHandler = function(e) {
			__self__.dispatchEvent(FileManager.FILESYSTEM_ERROR, errorHandler(e));
		};
		
		var usageHandler = function(used, available) {
			_used = used;
			_available = available;
			_capacity = used + available;
			console.log('INFO - used:', used, '- available:', available);
			var fsEvent = new FileSystemEvent(_fileSystem, used, available, _capacity);
			if (!_initialized)
				__self__.dispatchEvent(FileManager.FILESYSTEM_READY, fsEvent);
			else
				__self__.dispatchEvent(FileManager.INFO_UPDATED, fsEvent);
			_initialized = false;
			_queue.next();
		};
		var usageErrorHandler = function(e) {
			if (!_initialized)
				__self__.dispatchEvent(FileManager.FILESYSTEM_ERROR, errorHandler(e));
			__self__.dispatchEvent(FileManager.INFO_ERROR, errorHandler(e));
		};
		
		var directoryHandler = function(entry) {
			var dirEvent = new EntryReadyEvent(entry);
			console.log('DIRECTORY ENTRY READY - Path:', entry.fullPath);
			if (_state == FileManager.OPEN_ACTION) {
				_directory = entry;
				__self__.dispatchEvent(FileManager.DIRECTORY_CHANGED, dirEvent);
			} else if (_state == FileManager.MOVE_ACTION || _state == FileManager.COPY_ACTION ||
			_state == FileManager.REMOVE_ACTION || _state == FileManager.RENAME_ACTION) {
				if (!_modifyEntry)
					_modifyEntry = entry;
				else
					_toDirectory = entry;
			} else if (_state == FileManager.LIST_ACTION) {
				entry.createReader().readEntries(readEntriesHandler, readEntriesErrorHandler);
			}
			// WRITE_ACTION and REQUEST_ACTION have no saved reference.
			__self__.dispatchEvent(FileManager.DIRECTORY_READY, dirEvent);
			_queue.next();
		};
		var directoryErrorHandler = function(e) {
			var errorEvent = errorHandler(e);
			__self__.dispatchEvent(FileManager.DIRECTORY_ERROR, errorEvent);
		};
		
		var fileEntryHandler = function(entry) {
			console.log('FILE ENTRY READY - Path:', entry.fullPath);
			if (_state == FileManager.OPEN_ACTION)
				_fileEntry = entry;
			else
				_modifyEntry = entry;
			__self__.dispatchEvent(FileManager.FILE_READY, new EntryReadyEvent(entry));
			_queue.next();
		};
		var fileEntryErrorHandler = function(e) {
			__self__.dispatchEvent(FileManager.FILE_ERROR, errorHandler(e));
		};
		
		var fileReadHandler = function(file) {
			console.log('FILE READ COMPLETE');
			_file = file;
			var e = new ReadEvent(_fileEntry, file);
			__self__.dispatch(FileManager.FILE_READ, e);
			if (_state == FileManager.OPEN_ACTION)
				__self__.dispatchEvent(FileManager.FILE_OPENED, e);
			_queue.next();
		};
		var fileReadErrorHandler = function(e) {
			__self__.dispatchEvent(FileManager.FILE_READ_ERROR, errorHandler(e));
		};
		
		var fileWriterHandler = function(writer) {
			console.log('FILE WRITER READY');
			if (_state == FileManager.OPEN_ACTION)
				_fileWriter = writer;
			else
				_saveWriter = writer;
			_queue.next();
		};
		var fileWriterErrorHandler = function(e) {
			__self__.dispatchEvent(FileManager.FILE_WRITE_ERROR, errorHandler);
		};
		
		var readEntriesHandler = function(entries) {
			console.log('DIRECTORY ENTRIES LISTED - Path:', _directory.fullPath,
						'- Entries:', entries.length);
			__self__.dispatchEvent(FileManager.ENTRIES_LISTED, new ListEvent(_directory, entries));
			_queue.next();
		};
		var readEntriesErrorHandler = function(e) {
			__self__.dispatchEvent(FileManager.ENTRIES_LIST_ERROR, errorHandler(e));
		};
		
		var moveEntryHandler = function(entry) {
			console.log('MOVE ENTRY COMPLETE - Name:', entry.name, '- From:',
						'- To:', _toDirectory.fullPath);
			var modifyEvent = new ModifyEvent(_state, entry);
			if (_state == FileManager.MOVE_ACTION)
				__self__.dispatchEvent(FileManager.ENTRY_MOVED, modifyEvent);
			else if (_state == FileManager.RENAME_ACTION)
				__self__.dispatchEvent(FileManager.ENTRY_RENAMED, modifyEvent);
			_queue.next();
		};
		var moveEntryErrorHandler = function(e) {
			__self__.dispatchEvent(FileManager.ENTRY_MOVE_ERROR, errorHandler(e));
		};
		
		var copyEntryHandler = function(entry) {
			console.log('COPY ENTRY COMPLETE - Name:', entry.name, '- From:',
						'- To:', _toDirectory.fullPath);
			__self__.dispatchEvent(FileManager.ENTRY_COPIED,
					new ModifyEvent(_state, entry));
			_queue.next();
		};
		var copyEntryErrorHandler = function(e) {
			__self__.dispatchEvent(FileManager.ENTRY_COPY_ERROR, errorHandler(e));
		};
		
		var removeEntryHandler = function() {
			console.log('REMOVE ENTRY COMPLETE - Path:', (_modifyEntry || _editFile).fullPath);
			__self__.dispatchEvent(FileManager.ENTRY_REMOVED, new ModifyEvent(_state, null));
			_queue.next();
		};
		var removeEntryErrorHandler = function(e) {
			__self__.dispatchEvent(FileManager.ENTRY_REMOVE_ERROR, errorHandler(e));
		};
		
		
		
		// HELPERS
		var setState = function(state) {
			_state = state;
			_toDirectory = null;
			_modifyEntry = null;
			_saveWriter = null;
		};
		
		var directory = function(path, create) {
			if (!create && create !== false)
				create = true;
			
			console.log(path, create)
			if (create) {
				if (typeof path != 'object')
					path = new String(path);
				if (path.charAt(path.length - 1) === '/')
					path = path.substring(0, path.length - 1);
				
				path = path.split('/');
				var length = path.length;
				
				if (_state == FileManager.OPEN_ACTION) {
					if (!path[0]) {
						path.shift();
						path[0] = '/' + path[0];
						length--;
					}
					for (var i = 0; i < length; i++) {
						console.log(path[i]);
						requestDirectory(path[i], true);
					}
				} else {
					var builder = '';
					for (var i = 0; i < length; i++) {
						builder += path[i];
						builder += '/';
						console.log(builder);
						requestDirectory(builder, true);
					}
				}
			} else
				requestDirectory(path, false);
		};
		
		var fileSystemAsync = function() {
			console.log('FILESYSTEM REQUESTED', opt_size);
			setState(FileManager.REQUEST_ACTION);
			window.requestFileSystem(type, opt_size, fileSystemHandler, fileSystemErrorHandler);
		};
		var fileSystem = function() {
			_queue.push(fileSystemAsync, arguments);
		};
		
		var usageAsync = function() {
			console.log('INFO REQUESTED');
			setState(FileManager.REQUEST_ACTION);
			window.storageInfo.queryUsageAndQuota(type, usageHandler, usageErrorHandler);
		};
		var usage = function() {
			_queue.push(usageAsync, arguments);
		};
		
		var requestDirectoryAsync = function(path, create) {
			if (!create && create !== false)
				create = true;
			__self__.dispatchEvent(FileManager.DIRECTORY_REQUESTED, new EntryRequestEvent(path, create));
			if (path == _directory.fullPath) {
				directoryHandler(_directory);
			} else
				_directory.getDirectory(path, { create: create }, directoryHandler, directoryErrorHandler);
		};
		var requestDirectory = function() {
			_queue.push(requestDirectoryAsync, arguments);
		};
		
		var parentAsync = function(entry) {
			entry = entry || _modifyEntry || _directory;
			entry.getParent(directoryHandler, directoryErrorHandler);
		};
		var parent = function() {
			_queue.push(parentAsync, arguments);
		};
		
		var fileEntryAsync = function(name, create) {
			__self__.dispatchEvent(FileManager.FILE_REQUESTED, new EntryRequestEvent(name, create));
			var fullPath;
			if (name.charAt(0) != '/') {
				fullPath = _directory.fullPath;
				fullPath += '/';
				fullPath += name;
			} else
				fullPath = name;
			if (_state == FileManager.OPEN_ACTION && _fileEntry.fullPath == fullPath) {
			//if ((_state == FileManager.OPEN_ACTION && _fileEntry.fullPath == fullPath) ||
				//_modifyEntry.fullPath == fullPath) {
				_queue.next();
			} else
				_directory.getFile(name, { create: create }, fileEntryHandler, fileEntryErrorHandler);
		};
		var fileEntry = function() {
			_queue.push(fileEntryAsync, arguments);
		};
		
		var fileReadAsync = function(entry) {
			entry = entry || _fileEntry;
			__self__.dispatchEvent(FileManager.FILE_READ_REQUESTED, new RequestEvent(entry));
			entry.file(fileReadHandler, fileReadErrorHandler);
		};
		var fileRead = function() {
			_queue.push(fileReadAsync, arguments);
		};
		
		var fileWriterAsync = function() {
			var entry;
			if (_state == FileManager.OPEN_ACTION)
				entry = _fileEntry;
			else
				entry = _modifyEntry;
			__self__.dispatchEvent(FileManager.FILE_WRITE_REQUESTED, new RequestEvent(entry));
			entry.createWriter(fileWriterHandler, fileWriterErrorHandler);
		};
		var fileWriter = function() {
			_queue.push(fileWriterAsync, arguments);
		};
		
		var appendAsync = function(data) {
			var writer;
			var e;
			if (_state == FileManager.OPEN_ACTION) {
				writer = _fileWriter;
				e = new WriteEvent(_fileEntry, writer);
			} else if (_state == FileManager.WRITE_ACTION) {
				writer = _saveWriter;
				e = new WriteEvent(_modifyEntry, writer);
			}
			writer.seek(writer.length);
			writer.write(data);
			__self__.dispatchEvent(FileManager.FILE_WRITTEN, e);
			_queue.next();
		};
		var append = function() {
			_queue.push(appendAsync, arguments);
		};
		
		var writeAsync = function(data) {
			var writer;
			var e;
			if (_state == FileManager.OPEN_ACTION) {
				writer = _fileWriter;
				e = new WriteEvent(_fileEntry, writer);
			} else if (_state == FileManager.WRITE_ACTION) {
				writer = _saveWriter;
				e = new WriteEvent(_modifyEntry, writer);
				__self__.dispatchEvent(FileManager.FILE_CREATED, e);
			}
			writer.write(data);
			__self__.dispatchEvent(FileManager.FILE_WRITTEN, e);
			_queue.next();
		};
		var write = function() {
			_queue.push(appendAsync, arguments);
		};
		
		
		// STARTERS (SET STATE OF MANAGER)
		var changeDirAsync = function(path, create) {
			if (!create && create !== false)
				create = true;
			console.log('CHANGE DIRECTORY REQUESTED');
			setState(FileManager.OPEN_ACTION);
			__self__.dispatchEvent(FileManager.DIRECTORY_CHANGE_REQUESTED, new EntryRequestEvent(path, create));
			if (typeof path != 'string')
				_directory = path;
			else
				directory(path, create);
			_queue.next();
		};
		var changeDir = function() {
			_queue.push(changeDirAsync, arguments);
		};
		
		
		var makeDirAsync = function(path) {
			console.log('MAKE DIRECTORY REQUESTED');
			setState(FileManager.WRITE_ACTION);
			directory(path, true);
			_queue.next();
		};
		var makeDir = function() {
			_queue.push(makeDirAsync, arguments);
		};
		
		
		var upAsync = function() {
			setState(FileManager.OPEN_ACTION);
			parentAsync();
		};
		var up = function() {
			_queue.push(upAsync, arguments);
		};
		
		
		var getParentAsync = function(entry) {
			setState(FileManager.REQUEST_ACTION);
			parentAsync(entry);
		};
		var getParent = function() {
			_queue.push(getParentAsync, arguments);
		};
		
		
		var copyAsync = function(entry, toEntry, newName) {
			entry = entry || _modifyEntry;
			toEntry = toEntry || _toDirectory;
			entry.copyTo(entry, toEntry, newName, copyEntryHandler, copyEntryErrorHandler);
		};
		var copy = function() {
			_queue.push(copyAsync, arguments);
		};
		var copyDirectoryAsync = function(dirName, to, newName) {
			setState(FileManager.COPY_ACTION);
			__self__.dispatchEvent(FileManager.ENTRY_COPY_REQUESTED, new ModifyEvent(_state, dirName, to));
			requestDirectory(dirName, false);
			requestDirectory(to, false);
			copy(null, null, newName);
			_queue.next();
		};
		var copyDirectory = function() {
			_queue.push(copyDirectoryAsync, arguments);
		};
		
		var copyFileAsync = function(fileName, to, newName) {
			setState(FileManager.COPY_ACTION);
			
			fileEntry(fileName, false);
			requestDirectory(to, false);
			copy(null, null, newName);
			_queue.next();
		};
		var copyFile = function() {
			_queue.push(copyFileAsync, arguments);
		};
		
		var copyEntryAsync = function(entry, toEntry, newName) {
			setState(FileManager.COPY_ACTION);
			if (typeof toEntry == 'string') {
				requestDirectory(toEntry, false);
				copy(entry, null, newName);
			} else
				copy(entry, toEntry, newName);
			_queue.next();
		};
		var copyEntry = function() {
			_queue.push(copyEntryAsync, arguments);
		};
		
		
		var moveAsync = function(entry, toEntry, newName) {
			entry = entry || _modifyEntry;
			toEntry = toEntry || _toDirectory;
			entry.moveTo(toEntry, newName, moveEntryHandler, moveEntryErrorHandler);
		};
		var move = function() {
			_queue.push(moveAsync, arguments);
		};
		var moveDirectoryAsync = function(dirName, to, newName) {
			setState(FileManager.MOVE_ACTION);
			requestDirectory(dirName, false);
			requestDirectory(to, false);
			move(null, null, newName);
			_queue.next();
		};
		var moveDirectory = function() {
			_queue.push(moveDirectoryAsync, arguments);
		};
		
		var moveFileAsync = function(fileName, to, newName) {
			setState(FileManager.MOVE_ACTION);
			fileEntry(fileName, false);
			requestDirectory(to, false);
			move(null, null, newName);
			_queue.next();
		};
		var moveFile = function() {
			_queue.push(moveFileAsync, arguments);
		};
		
		var moveEntryAsync = function(entry, toEntry, newName) {
			setState(FileManager.MOVE_ACTION);
			if (typeof toEntry == 'string') {
				requestDirectory(toEntry, false);
				move(entry, null, newName);
			} else
				move(entry, toEntry, newName);
			_queue.next();
		};
		var moveEntry = function() {
			_queue.push(moveEntryAsync, arguments);
		};
		
		
		var renameDirectoryAsync = function(dirName, newName) {
			setState(FileManager.RENAME_ACTION);
			requestDirectory(dirName, false);
			if (dirName.charAt(0) != '/')
				move(null, _directory, newName);
			else {
				parent();
				move(null, null, newName);
			}
			_queue.next();
		};
		var renameDirectory = function() {
			_queue.push(renameDirectoryAsync, arguments);
		};
		
		var renameFileAsync = function(fileName, newName) {
			setState(FileManager.RENAME_ACTION);
			fileEntry(fileName);
			if (fileName.charAt(0) != '/')
				move(null, _directory, newName);
			else {
				parent();
				move(null, null, newName);
			}
			_queue.next();
		};
		var renameFile = function() {
			_queue.push(renameFileAsync, arguments);
		};
		
		var renameEntryAsync = function(entry, newName) {
			setState(FileManager.RENAME_ACTION);
			parent(entry);
			move(entry, null, newName);
			_queue.next();
		};
		var renameEntry = function() {
			_queue.push(renameEntryAsync, arguments);
		};
		
		
		var removeAsync = function(entry) {
			entry = entry || _modifyEntry;
			if (entry.isFile)
				entry.remove(removeEntryHandler, removeEntryErrorHandler);
			else if (entry.isDirectory)
				entry.removeRecursively(removeEntryHandler, removeEntryErrorHandler);
		};
		var remove = function() {
			_queue.push(removeAsync, arguments);
		};
		
		var removeDirectoryAsync = function(dirName) {
			setState(FileManager.REMOVE_ACTION);
			requestDirectory(dirName, false);
			remove();
			_queue.next();
		};
		var removeDirectory = function() {
			_queue.push(removeDirectoryAsync, arguments);
		};
		
		var removeFileAsync = function(name) {
			setState(FileManager.REMOVE_ACTION);
			fileEntry(name, false);
			remove();
			_queue.next();
		};
		var removeFile = function() {
			_queue.push(removeFileAsync, arguments);
		};
		
		var removeEntryAsync = function(entry) {
			setState(FileManager.REMOVE_ACTION);
			removeAsync(entry);
		};
		var removeEntry = function() {
			_queue.push(removeEntryAsync, arguments);
		};
		
		
		var openFileAsync = function(name, create) {
			setState(FileManager.OPEN_ACTION);
			__self__.dispatchEvent(FileManager.FILE_OPEN_REQUESTED, new EntryRequestEvent(name, create));
			fileEntry(name, create);
			fileRead();
		};
		var openFile = function() {
			_queue.push(openFileAsync, arguments);
		};
		
		var appendToAsync = function(data) {
			setState(FileManager.OPEN_ACTION);
			fileWriter();
			append(data);
		};
		var appendTo = function() {
			_queue.push(appendToAsync, arguments);
		};
		
		var writeToAsync = function(data) {
			setState(FileManager.OPEN_ACTION);
			fileWriter();
			write(data);
		};
		var writeTo = function() {
			_queue.push(writeToAsync, arguments);
		};
		
		var saveNewFileAsync = function(name, data) {
			setState(FileManager.WRITE_ACTION);
			__self__.dispatchEvent(FileManager.FILE_CREATE_REQUESTED, new EntryRequestEvent(name, true));
			
			fileEntry(name, true);
			fileWriter();
			write(data);
		};
		var saveNewFile = function() {
			_queue.push(saveNewFileAsync, arguments);
		};
		
		var readEntriesAsync = function(opt_directoryEntry) {
			console.log('READ ENTRIES REQUESTED');
			setState(FileManager.LIST_ACTION);
			__self__.dispatchEvent(FileManager.ENTRIES_LIST_REQUESTED, new RequestEvent(_directory));
			if (opt_directoryEntry) {
				if (typeof opt_directoryEntry == 'string') {
					requestDirectory(opt_directoryEntry, false);
					_queue.next();
				} else
					opt_directoryEntry.createReader().readEntries(readEntriesHandler, readEntriesErrorHandler);
			} else
				_directory.createReader().readEntries(readEntriesHandler, readEntriesErrorHandler);
		};
		var readEntries = function() {
			_queue.push(readEntriesAsync, arguments);
		};
		
		
		
		// API
		var addEventListener = this.addEventListener;
		
		var addEventListenerAsync = function(eventName, callback) {
			addEventListener(eventName, callback);
			_queue.next();
		};
		this.addEventListener = function() {
			_queue.push(addEventListenerAsync, arguments);
		};
		
		
		var removeEventListener = this.removeEventListener;
		
		var removeEventListenerAsync = function(eventName, callback) {
			removeEventListener(eventName, callback);
			_queue.next();
		};
		this.removeEventListener = function() {
			_queue.push(removeEventListenerAsync, arguments);
		};
		
		
		this.openTask = _queue.openTask;
		this.closeTask = _queue.closeTask;
		
		
		this.changeDir = changeDir;
		this.makeDir = makeDir;
		this.up = up;
		this.getParent = getParent;
		
		this.readEntries = readEntries;
		
		this.copyDir = copyDirectory;
		this.copyFile = copyFile;
		this.copyEntry = copyEntry;
		
		this.moveDir = moveDirectory;
		this.moveFile = moveFile;
		this.moveEntry = moveEntry;
		
		this.renameDir = renameDirectory;
		this.renameFile = renameFile;
		this.renameEntry = renameEntry;
		
		this.removeDir = removeDirectory;
		this.removeFile = removeFile;
		this.removeEntry = removeEntry;
		
		this.openFile = openFile;
		this.writeTo = write;
		this.appendTo = append;
		this.read = fileRead;
		this.saveNewFile = saveNewFile;
		
		this.updateInfo = usage;
		this.load = function() {
			if (!opt_size || opt_size < 0)
				opt_size = 5*1024*1024; // 5MB default, homie.  That's just the way it is.  Deal with it.
			fileSystem();
			usage();
			_queue.start();
		};
	};
	/* CONSTANTS */
	FileManager.MOVE_ACTION = 'move';
	FileManager.COPY_ACTION = 'copy';
	FileManager.REMOVE_ACTION = 'remove';
	FileManager.RENAME_ACTION = 'rename';
	FileManager.OPEN_ACTION = 'open';
	FileManager.WRITE_ACTION = 'write';
	FileManager.LIST_ACTION = 'list';
	FileManager.REQUEST_ACTION = 'request';
	/* STATIC FUNCTION (can be used if you want to handle filesystem errors yourself) */
	FileManager.errorHandler = function(e) {
		var msg = 'File API Error - ';
		switch (e.code) {
			case FileError.NOT_FOUND_ERR:
				msg += 'NOT FOUND: File or directory could not be found';
				break;
			case FileError.SECURITY_ERR:
				msg += 'SECURITY: Permission denied, file is deemed unsafe, or '
				msg += 'too many calls are being made to the filesystem';
				break;
			case FileError.ABORT_ERR:
				msg += 'ABORTED: call to abort() was invoked';
				break;
			case FileError.NOT_READABLE_ERR:
				msg += 'NOT READABLE: File or directory could not be read';
				break;
			case FileError.ENCODING_ERR:
				msg += 'ENCODING: File or directory path is malformed';
				break;
			case FileError.NO_MODIFICATION_ALLOWED_ERR:
				msg += 'NO MODIFICATION ALLOWED: A restricted state exists '
				msg += 'within your filesystem';
				break;
			case FileError.INVALID_STATE_ERR:
				msg += 'INVALID STATE: File or directory is stale and has conflicting values';
				break;
			case FileError.SYNTAX_ERR:
				msg += 'INVALID SYNTAX: File contains incorrect line endings';
				break;
			case FileError.INVALID_MODIFICATION_ERROR:
				msg += 'INVALID MODIFICATION: File moved to same directory or '
				msg += 'diretory moved to one of its children';
				break;
			case FileError.QUOTA_EXCEEDED_ERR:
				msg += 'QUOTA EXCEEDED: Insufficient available space to write file '
				msg += 'or directory';
				break;
			case FileError.TYPE_MISMATCH_ERR:
				msg += 'TYPE_MISMATCH: File is actually a directory or vise-versa';
				break;
			case FileError.PATH_EXISTS_ERR:
				msg += 'PATH EXISTS: File or directory already exists';
				break;
			default:
				msg += 'UNKOWN ERROR: I\'m stumped';
				break;
		}
		console.error(msg);
		return msg;
	};
	/* EVENTS */
	FileManager.ERROR = 'error';
	
	FileManager.FILESYSTEM_READY = 'filesystem_ready';
	FileManager.FILESYSTEM_ERROR = 'filesystem_error';
	
	FileManager.INFO_UPDATED = 'info_updated';
	FileManager.INFO_ERROR = 'info_error';
	
	
	FileManager.DIRECTORY_REQUESTED = 'directory_requested';
	FileManager.DIRECTORY_READY = 'directory_ready';
	FileManager.DIRECTORY_ERROR = 'directory_error';
	
	FileManager.DIRECTORY_CHANGE_REQUESTED = 'directory_change_requested';
	FileManager.DIRECTORY_CHANGED = 'directory_changed';
	
	
	FileManager.FILE_REQUESTED = 'file_requested';
	FileManager.FILE_READY = 'file_ready';
	FileManager.FILE_ERROR = 'file_error';
	
	FileManager.FILE_READ_REQUESTED = 'file_read_requested';
	FileManager.FILE_READ = 'file_read';
	FileManager.FILE_READ_ERROR = 'file_read_error';
	
	FileManager.FILE_WRITE_REQUESTED = 'file_write_requested';
	FileManager.FILE_WRITTEN = 'file_written';
	FileManager.FILE_WRITE_ERROR = 'file_write_error';
	
	FileManager.FILE_OPEN_REQUESTED = 'file_open_requested';
	FileManager.FILE_OPENED = 'file_opened';
	
	FileManager.FILE_CREATE_REQUESTED = 'file_create_requested';
	FileManager.FILE_CREATED = 'file_created';
	
	
	FileManager.ENTRY_MOVE_REQUESTED = 'entry_move_requested';
	FileManager.ENTRY_MOVED = 'entry_moved';
	FileManager.ENTRY_MOVE_ERROR = 'entry_move_error';
	
	FileManager.ENTRY_COPY_REQUESTED = 'entry_copy_requested';
	FileManager.ENTRY_COPIED = 'entry_copied';
	FileManager.ENTRY_COPY_ERROR = 'entry_copy_error';
	
	FileManager.ENTRY_RENAME_REQUESTED = 'entry_rename_requested';
	FileManager.ENTRY_RENAMED = 'entry_renamed';
	FileManager.ENTRY_RENAME_ERROR = 'entry_rename_error';
	
	FileManager.ENTRY_REMOVE_REQUESTED = 'entry_remove_requested';
	FileManager.ENTRY_REMOVED = 'entry_removed';
	FileManager.ENTRY_REMOVE_ERROR = 'entry_remove_error';
	
	
	FileManager.ENTRIES_LIST_REQUESTED = 'entries_list_requested';
	FileManager.ENTRIES_LISTED = 'entries_listed';
	FileManager.ENTRIES_LIST_ERROR = 'entries_list_error';
})(window, blackberry.grahamzibar);
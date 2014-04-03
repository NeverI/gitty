/*
 * Gitty - command.js
 * Author: Gordon Hall
 *
 * Handles the execution of Git commands
 */

var exec = require('child_process').exec
  , execSync = require('execSync').exec
  , Command;

Command = function(repo_path, operation, flags, options) {
	this.repo = repo_path;
	// assemble command
	this.command = 'git ' + operation;
	// add flags
	for (var flag = 0; flag < flags.length; flag ++) {
		this.command += ' ' + flags[flag];
	}
	// add options
	this.command +=  ' ' + options;
};

Command.prototype.exec = function(callback, sync) {
	if (!sync) {
		exec(this.command, { cwd : this.repo }, callback);
	} else {
		try {
			var cwd = process.env.PWD;
			process.chdir(this.repo);
			var result = execSync(this.command)
			process.chdir(cwd);
			if (result.code != 0) {
				callback.call(this, result, null);
			} else {
				callback.call(this, null, result.stdout.trim());
			}
		} catch(e) {
			process.chdir(cwd);
			callback.call(this, e, null);
		}
	}
};

module.exports = Command;

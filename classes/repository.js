/*
 * Gitty - repository.js
 * Author: Gordon Hall
 *
 * Primary repository class that exposes all repository level operations
 */

var fs = require('fs')
  , path = require('path')
  , Command = require('./command.js')
  , parse = require('../modules/output-parser.js')
  , pty = require('pty.js')
  , Repository;

////
// Repository Constructor
////
Repository = function(repo) {
	// create assumed path to .git directory
	var repo_path = path.normalize(repo)
	  , split_path = repo_path.split('/');
	// determine if this is a valid repo
	this.isRepository = fs.existsSync(repo_path + '/.git');
	// set name as dir name
	this.name = split_path[split_path.length - 1];
	// set path
	this.path = repo_path;
};

////
// Repository.init(callback, [flags])
// Initializes the directory as a Git repository
////
Repository.prototype.init = function(callback, flags) {
	var gitInit = new Command(this.path, 'init', (flags || []), '')
	  , repo = this;
	gitInit.exec(function(error, stdout, stderr) {
		var err = error || stderr;
		repo.isRepository = fs.existsSync(repo.path + '/.git');
		if (callback && typeof callback === 'function') callback.call(repo, err);
	});
};

////
// Repository.log(callback)
// Passes commit history as array to callback
////
Repository.prototype.log = function(callback, options, useSync) {
	options = options ? options : {};

	var format = '--pretty=format:\'{"commit": "%H","author": "%an <%ae>","date": "%ad","message": "%s"},\''
		, count = options.count ? '-'+options.count : ''
	  , gitLog = new Command(this.path, 'log', [format, count], '')
	  , repo = this;
	gitLog.exec(function(error, stdout, stderr) {
		var output = stdout
		  , err = error || stderr;
		if (output) {
			output = parse['log'](output);
		}
		if (callback && typeof callback === 'function') callback.call(repo, err, output);
	}, useSync);
};

////
// Repository.status(callback)
// Passes a status object into the callack
////
Repository.prototype.status = function(callback) {
	var gitStatus = new Command(this.path, 'status', [], '')
	  , gitLsFiles = new Command(this.path, 'ls-files', ['--other','--exclude-standard'], '')
	  , repo = this;
	gitStatus.exec(function(error, stdout, stderr) {
		var status = stdout
		  , err = error || stderr;
		gitLsFiles.exec(function(error, stdout, stderr) {
			var untracked = stdout;
			if (!err) {
				err = error || stderr;
			}
			status = parse['status'](status, untracked);
			if (callback && typeof callback === 'function') callback.call(repo, err, status);
		});
	});
};

////
// Repository.add([files], callback)
// Stages the passed array of files for commit
////
Repository.prototype.add = function(files, callback, useSync) {
	var options = files.join(' ')
	  , gitAdd = new Command(this.path, 'add', [], options)
	  , repo = this;
	gitAdd.exec(function(error, stdout, stderr) {
		var err = error || stderr;
		if (callback && typeof callback === 'function') callback.call(repo, err);
	}, useSync);
};

////
// Repository.remove([files], callback)
// Removes the passed array of files for commit
////
Repository.prototype.remove = function(files, callback) {
	var options = files.join(' ')
	  , gitRm = new Command(this.path, 'rm', ['--cached'], options)
	  , repo = this;
	gitRm.exec(function(error, stdout, stderr) {
		var err = error || stderr;
		if (callback && typeof callback === 'function') callback.call(repo, err);
	});
};

////
// Repository.unstage([files], callback)
// Removes passed array of files from staging area
////
Repository.prototype.unstage = function(files, callback) {
	var options = files.join(' ')
	  , gitUnstage = new Command(this.path, 'reset HEAD', [], options)
	  , repo = this;
	gitUnstage.exec(function(error, stdout, stderr) {
		var err = error || stderr;
		if (callback && typeof callback === 'function') callback.call(repo, err);
	});
};

////
// Repository.commit(message, callback)
// Commits the current staged files
////
Repository.prototype.commit = function(message, callback, useSync) {
	var options = '"' + message + '"'
	  , gitCommit = new Command(this.path, 'commit', ['-m'], options)
	  , repo = this;
	gitCommit.exec(function(error, stdout, stderr) {
		var err = error || stderr
		  , data = (stdout) ? parse['commit'](stdout) : null;
		if (data && data.error) {
			err = data.error;
			data = null;
		}
		if (callback && typeof callback === 'function') callback.call(repo, err, data);
	}, useSync);
};

////
// Repository.branches(callback)
// Passes object denoting current branch, array of other branches and array of remote branches
////
Repository.prototype.branches = function(callback) {
	var gitBranches = new Command(this.path, 'branch', ['-a'], '')
	  , repo = this;
	gitBranches.exec(function(error, stdout, stderr) {
		var err = error || stderr
		  , branches = parse['branch'](stdout);
		if (callback && typeof callback === 'function') callback.call(this, err, branches);
	});
};

////
// Repository.branch(branch, callback)
// Creates a new branch from the given branch name
////
Repository.prototype.branch = function(name, callback) {
	var gitBranch = new Command(this.path, 'branch', [], name)
	  , repo = this;
	gitBranch.exec(function(error, stdout, stderr) {
		var err = error || stderr;
		if (callback && typeof callback === 'function') callback.call(repo, err);
	});
};

////
// Repository.deleteBranch(branch, callback, unmerged)
// Delete a branch
////
Repository.prototype.deleteBranch = function(name, callback, unmerged) {
	var gitBranch = new Command(this.path, 'branch', [unmerged ? '-D' : '-d'], name)
	  , repo = this;
	gitBranch.exec(function(error, stdout, stderr) {
		var err = error || stderr;
		if (callback && typeof callback === 'function') callback.call(repo, err);
	});
};

////
// Repository.checkout(branch, callback)
// Performs checkout on given branch
////
Repository.prototype.checkout = function(branch, opts, callback) {
	var gitCheckout = new Command(this.path, 'checkout', opts, branch)
	  , repo = this;
	gitCheckout.exec(function(error, stdout, stderr) {
		if (error) {
			callback(error);
			return;
		}

		var output = parse['checkout'](stderr, stdout);
		callback.call(repo, output);
	});
};

////
// Repository.merge(branch, callback)
// Performs a merge of the current branch with the specified one
// TODO: proper output parsing
////
Repository.prototype.merge = function(branch, callback, forceFF) {
	var gitMerge = new Command(this.path, 'merge', [!forceFF ? '--no-ff' : '' ], branch)
	  , repo = this;
	gitMerge.exec(function(error, stdout, stderr) {
		var err = error || stderr;
		if (callback && typeof callback === 'function') callback.call(repo, err);
	});
};

////
// Repository.remoteAdd(remote, url, callback)
// Adds a new remote
////
Repository.prototype.remoteAdd = function(remote, url, callback) {
	var options = remote + ' ' + url
	  , gitRemoteAdd = new Command(this.path, 'remote add', [], options)
	  , repo = this;
	gitRemoteAdd.exec(function(error, stdout, stderr) {
		var err = error || stderr;
		if (callback && typeof callback === 'function') callback.call(repo, err);
	});
};

////
// Repository.remoteSetUrl(remote, url, callback)
// Changes url of an existing remote
////
Repository.prototype.remoteSetUrl = function(remote, url, callback) {
	var options = remote + ' ' + url
	  , gitRemoteSetUrl = new Command(this.path, 'remote set-url', [], options)
	  , repo = this;
	gitRemoteSetUrl.exec(function(error, stdout, stderr) {
		var err = error || stderr;
		if (callback && typeof callback === 'function') callback.call(repo, err);
	});
};

////
// Repository.remoteRemove(remote, callback)
// Removes the specified remote
////
Repository.prototype.remoteRemove = function(remote, callback) {
	var gitRemoteRemove = new Command(this.path, 'remote rm', [], remote)
	  , repo = this;
	gitRemoteRemove.exec(function(error, stdout, stderr) {
		var err = error || stderr;
		if (callback && typeof callback === 'function') callback.call(repo, err);
	});
};

////
// Repository.remoteList(callback)
// Passes key-value pairs to callback -> remote : url
////
Repository.prototype.remoteList = function(callback) {
	var gitRemoteList = new Command(this.path, 'remote', ['-v'], '')
	  , repo = this;
	gitRemoteList.exec(function(error, stdout, stderr) {
		var err = error || stderr
		  , output = stdout;
		if (output) {
			output = parse['remotes'](output);
		}
		if (callback && typeof callback === 'function') callback.call(repo, err, output);
	});
};

////
// Repository.push(remote, branch, callback, creds)
// Pushes the specified branch to the specified remote
////
Repository.prototype.push = function(remote, branch, callback, creds) {
	sync(this.path, 'push', remote, branch, callback, creds);
};

////
// Repository.pull(remote, branch, callback, creds)
// Pulls the specified branch from the specified remote
////
Repository.prototype.pull = function(remote, branch, callback, creds) {
	sync(this.path, 'pull', remote, branch, callback, creds);
};

////
// sync(operation, remote, branch, callback, creds)
// ----
// Creates a fake terminal to push or pull from remote
// This is because SSH does not read creds from stdin,
// but instead, a pseudo-terminal.
////
function sync(path, operation, remote, branch, callback, creds) {
	var pterm = pty.spawn('git', [operation, remote, branch], { cwd : path })
	  , repo = this
	  , err
	  , succ;
	pterm.on('data', function(data) {
		var prompt = data.toLowerCase();
		if (prompt.indexOf('username') > -1) {
			pterm.write(creds.user + '\r');
		} else if (prompt.indexOf('password') > -1) {
			pterm.write(creds.pass + '\r');
		} else if ((prompt.indexOf('error') > -1) || (prompt.indexOf('fatal') > -1)) {
			err = prompt;
		} else {
			succ = prompt;
		}
	});
	pterm.on('exit', function() {
		if (callback && typeof callback === 'function') callback.call(repo, err, succ);
	});
};

////
// Repository.reset(hash, callback)
// Resets the repository's HEAD to the specified commit and passes commit log to callback
////
Repository.prototype.reset = function(hash, callback) {
	var gitReset = new Command(this.path, 'reset', ['-q'], hash)
	  , repo = this
	  , err;
	gitReset.exec(function(error, stdout, stderr) {
		err = error || stderr || err;
		repo.log(function(logErr, log) {
			err = logErr || err;
			if (callback && typeof callback === 'function') callback.call(repo, err, log);
		});
	});
};

////
// Repository.reset(hash, callback)
// Resets the repository's HEAD to the specified commit and passes commit log to callback
////
Repository.prototype.graph = function(callback) {
	var gitGraph = new Command(this.path, 'log', ['--graph', '--pretty=oneline', '--abbrev-commit'], '')
	  , repo = this
	  , err
	  , graph;
	gitGraph.exec(function(error, stdout, stderr) {
		err = error || stderr || err;
		if (!err && stdout) {
			graph = require('../modules/grapher.js')(stdout);
		}
		if (callback && typeof callback === 'function') callback.call(repo, err, graph);
	});
};

////
// Repository.stash(?option, callback)
////
Repository.prototype.stash = function(option, callback) {
	var gitStash = new Command(this.path, 'stash', [], option ? option : '')
	  , repo = this;
	gitStash.exec(function(error, stdout, stderr) {
		var err = error || stderr;
		if (callback && typeof callback === 'function') callback.call(repo, err, stdout);
	});
};

////
// Repository.fetch(callback, creds)
// TODO: proper output parsing
////
Repository.prototype.fetch = function(callback, prune, creds)
{
  var args = ['fetch'];
  if (prune) {
    args.push('--prune');
  }
	passthroughOutput(this, args, callback, creds);
}

function passthroughOutput(repo, arguments, callback, creds)
{
	var pterm = pty.spawn('git', arguments, { cwd : repo.path })
	  , output = ''
	  ;
	pterm.on('data', function(data) {
		var prompt = data.toLowerCase();
		if (prompt.indexOf('username') > -1) {
			pterm.write(creds.user + '\r');
		} else if (prompt.indexOf('password') > -1) {
			pterm.write(creds.pass + '\r');
		} else {
			output += data;
		}
	});
	pterm.on('exit', function() {
		if (callback && typeof callback === 'function') callback.call(repo, undefined, output);
	});
}

////
// Repository.rebase(branch, callback, creds)
// TODO: proper output parsing
////
Repository.prototype.rebase = function(branch, callback, creds)
{
	passthroughOutput(this, ['rebase', branch], callback, creds);
}


////
// Repository.revlist(from, to, callback)
// Resets the repository's HEAD to the specified commit and passes commit log to callback
////
Repository.prototype.forEachRef = function(options, callback) {

	var args = Object.keys(options).map(function(arg){ return options[arg] !== undefined ? arg+'='+options[arg] : arg })
		, forEachRef = new Command(this.path, 'for-each-ref', args, '')
	  , repo = this
	  , callback = callback && typeof callback === 'function' ? callback : undefined;

	forEachRef.exec(function(error, stdout, stderr) {
		var err = error || stderr;
		if (err) {
			if (callback) callback.call(repo, err);
			return;
		}

		if (callback) callback.call(repo, undefined, stdout);
	});
};

// Export Constructor
module.exports = Repository;

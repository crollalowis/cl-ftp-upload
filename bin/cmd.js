#!/usr/bin/env node

'use strict';

var JSFtp = require('jsftp');
var glob = require('glob');
var fs = require('fs');
var path = require('path');
var async = require('neo-async');

// TODO create remote dir?

var program = require('commander');

var BASE_PATH = __dirname;

program
  .version('0.0.1')
  .option('-l, --local <path>', 'Local path (default: .)')
  .option('-r, --remote <path>', 'Remote path (default: /)')
  .option('-h, --host <string>', 'Hostname (default: localhost)')
  .option('-p, --port <number>', 'Port (default: 22)')
  .option('-u, --user <string>', 'Username (default: anonymous)')
  .option('-s, --password <string>', 'Password (default: @anonymous)')
  .parse(process.argv);

var Ftp = new JSFtp({
  host: program.host || '127.0.0.1',
  port: program.port || 21,
  user: program.user,
  pass: program.password
});

var REMOTE_PATH = program.remote || '';
var LOCAL_PATH = program.local || '.';

upload(LOCAL_PATH, function (err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('everything done');
});

function getFileList(dirPath, cb) {

  glob(dirPath + '/*', function (err, files) {

    cb(err, files.map(normalizeLocalFileInfo));

  });
}

function normalizeLocalFileInfo(file) {

  var stat = fs.statSync(file);

  var size = stat.size;
  var relPath = path.relative(BASE_PATH, file);
  var fileAbsPath = path.resolve(file);

  return {
    size: size,
    relPath: relPath,
    absPath: fileAbsPath,
    isDir: stat.isDirectory()
  };
}

function uploadEntity(entity, cb) {
  console.log('uploading ' + entity.relPath);
  if (entity.isDir) {
    uploadDir(entity.absPath, cb);
  } else {
    uploadFile(entity.absPath, entity.relPath, cb);
  }
}

function uploadFile(localPath, remotePath, cb) {
  Ftp.put(localPath, REMOTE_PATH + '/' + remotePath, cb);
}

function uploadDir(dirPath, cb) {

  var dir = REMOTE_PATH + '/' + path.relative(BASE_PATH, dirPath);

  Ftp.list(dir, function (err, res) {
    if (!res) {
      console.log('creating folder ' + dir);
      Ftp.raw.mkd(dir, function (err) {
        if (err) {
          return cb(err);
        }
        uploadDir(dirPath, cb);
      });
    } else {
      getFileList(dirPath, function (err, files) {
        async.eachSeries(files, uploadEntity, cb);
      });
    }
  });
}

function checkIfRemoteDirExists(cb) {
  Ftp.list(REMOTE_PATH, function (err, res) {
    if (err || !res) {
      cb(err || new Error('Remote Dir does not exist, please create it first'));
    } else {
      cb();
    }
  });
}

function upload(dirPath, cb) {
  if (path.isAbsolute(dirPath)) {
    BASE_PATH = dirPath;
  } else {
    BASE_PATH = path.resolve(dirPath);
  }

  checkIfRemoteDirExists(function (err) {
    if (err) {
      return cb(err);
    }
    uploadDir(path.resolve(dirPath), function (err) {
      if (err) {
        cb(err);
      }
      Ftp.raw.quit(cb);
    });

  });
}

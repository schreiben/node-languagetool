/* MIT License
 *
 * Copyright (c) 2016 schreiben
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

 "use strict";

(function(){

  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  const rmdir = require('rmdir');
  const yauzl = require("yauzl");
  const mkdirp = require("mkdirp");
  const process = require('process');
  const request = require('request');
  const ProgressBar = require('progress');
  const child_process = require('child_process');

  const fail = reason => {
    console.error(reason);
    process.exit(1);
  };

  const ltFile = exports.ltFile = () => path.join(path.resolve('.'), 'lt.zip');
  const ltDir = exports.ltDir = () => path.join(path.resolve('.'), 'lt');

  const smoketest = exports.smoketest = () => true;

  const url = exports.url = () =>
    'https://languagetool.org/download/LanguageTool-stable.zip';

  const install = exports.install = callback => {
    callback = callback || () => {};
    var ltdir = ltDir(), ltfile = ltFile();

    rmdir(ltdir);

    request
      .get(url())
      .on('response', res => {
        var len = parseInt(res.headers['content-length'], 10);
        var bar = new ProgressBar('  downloading Language Tool [:bar] :percent :etas', {
          complete: '=',
          incomplete: ' ',
          width: 80,
          total: len
        });
        res.on('data', chunk => bar.tick(chunk.length));
      })
      .on('error', err => {
        console.log(`problem with request: ${err.message}`);
        callback(err);
      })
      .pipe(fs.createWriteStream(ltfile))
      .on('close', () => {
        const toreal = fn => {
          var parts = fn.split('/');
          parts[0] = ltdir;
          return path.join.apply(path, parts);
        };
        yauzl.open(ltfile, { lazyEntries: true }, (err, zipfile) => {

          var len = parseInt(zipfile.entryCount, 10);
          var bar = new ProgressBar('  unzipping   Language Tool [:bar] :percent :etas', {
            complete: '=',
            incomplete: ' ',
            width: 80,
            total: len
          });

          if (err) throw err;
          zipfile.readEntry();
          zipfile.on('entry', entry => {
            bar.tick(1);
            var realfn = toreal(entry.fileName);
            if (/\/$/.test(entry.fileName)) {
              // directory file names end with '/'
              mkdirp(realfn, err => {
                if (err)
                  callback(err);
                else
                  zipfile.readEntry();
              });
            } else {
              // file entry
              zipfile.openReadStream(entry, (err, readStream) => {
                if (err)
                  callback(err);
                else {
                  // ensure parent directory exists
                  mkdirp(path.dirname(realfn), err => {
                    if (err)
                      callback(err);
                    else {
                      readStream.pipe(fs.createWriteStream(realfn));
                      readStream.on('end', () => zipfile.readEntry());
                    }
                  });
                }
              });
            }
          });
          zipfile.on('close', () => {
            fs.unlink(ltfile);
            callback();
          });

        });
      });
  };

})();

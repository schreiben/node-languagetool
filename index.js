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
  const portfinder = require('portfinder');
  const osLocale = require('os-locale');
  const jre = require('node-jre');

  const ltFile = exports.ltFile = () => path.join(__dirname, 'lt.zip');
  const ltDir = exports.ltDir = () => path.join(__dirname, 'lt');
  const url = exports.url = () =>
    'https://languagetool.org/download/LanguageTool-stable.zip';
  const host = 'localhost';

  const fail = reason => {
    console.error(reason);
    process.exit(1);
  };

  const smoketest = exports.smoketest = () => new Promise((resolve, reject) =>
    check('This is wong.', 'en-US').then(
      res => {
        try {
          var match = res.matches[0];
          if (match.offset === 8 && match.length === 4)
            resolve();
          else
            reject();
        } catch (ex) {
          reject();
        }
      },
      err => reject()
    )
  );

  const install = exports.install = () => new Promise((resolve, reject) => {
    var ltdir = ltDir(), ltfile = ltFile();

    rmdir(ltdir);

    request
      .get({
        url: url(),
        agent: false,
        headers: { connection: 'keep-alive' }
      })
      .on('response', res => {
        var len = parseInt(res.headers['content-length'], 10);
        var bar = new ProgressBar(
          '  downloading Language Tool [:bar] :percent :etas', {
          complete: '=',
          incomplete: ' ',
          width: 80,
          total: len
        });
        res.on('data', chunk => bar.tick(chunk.length));
      })
      .on('error', err => reject(err))
      .pipe(fs.createWriteStream(ltfile))
      .on('close', () => {
        const toreal = fn => {
          var parts = fn.split('/');
          parts[0] = ltdir;
          return path.join.apply(path, parts);
        };
        yauzl.open(ltfile, { lazyEntries: true }, (err, zipfile) => {

          var len = parseInt(zipfile.entryCount, 10);
          var bar = new ProgressBar(
            '  unzipping   Language Tool [:bar] :percent :etas', {
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
                  reject(err);
                else
                  zipfile.readEntry();
              });
            } else {
              // file entry
              zipfile.openReadStream(entry, (err, readStream) => {
                if (err)
                  reject(err);
                else {
                  // ensure parent directory exists
                  mkdirp(path.dirname(realfn), err => {
                    if (err)
                      reject(err);
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
            resolve();
          });

        });
      });
  });


  var service, queue = [];

  const kill = exports.kill = () => {
    if (service)
      service.kill();
    service = null;
  };

  const writeTopCommand = () =>
    service.stdin.write(JSON.stringify(queue[queue.length - 1].cmd) + '\n');

  const start = exports.start = () => new Promise((resolve, reject) => {
    const ltdir = ltDir();
    if (service)
      resolve();
    else {
      service = jre.spawn(
        [
          ltdir,
          path.join(ltdir, 'languagetool.jar'),
          'resources'
        ],
        'Service',
        [],
        { encoding: 'utf-8' }
      );
      service.stdout.on('data', line => {
        line = JSON.parse(line);
        var entry = queue.pop();
        if (line.code === 200 && entry.resolve)
          entry.resolve(line);
        else if (line.code != 200 && entry.reject)
          entry.reject(line);
      });
      if(queue.length > 0)
        writeTopCommand();
      resolve();
    }
  });

  const stop = exports.stop = () => new Promise((resolve, reject) => {
    kill();
    resolve();
  });

  const restart = exports.start = () => stop().then(
    (resolve, reject) => start().then(resolve, reject)
  );

  const send = exports.send = cmd => new Promise((resolve, reject) => start().then(() => {
    var entry = {
      cmd: cmd,
      resolve: resolve,
      reject: reject
    };
    queue.unshift(entry);
    if(queue.length === 1)
      writeTopCommand();
  }));

  const check = exports.check = (text, locale) => send({
    command: "check",
    text: text,
    language: locale.toString()
  });

  const languages = exports.languages = () => send({ command: "languages" });

})();

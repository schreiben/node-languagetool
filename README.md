# node-languagetool

[![Build Status](https://ci.appveyor.com/api/projects/status/github/schreiben/node-languagetool?svg=true)](https://ci.appveyor.com/project/tilmankamp/node-languagetool)
[![Build Status](https://travis-ci.org/schreiben/node-languagetool.svg?branch=master)](https://travis-ci.org/schreiben/node-languagetool)
[![npm version](https://badge.fury.io/js/node-languagetool.svg)](https://www.npmjs.com/package/node-languagetool)

This is a Node.js binding to the [LanguageTool](https://languagetool.org/) (LT)
spellchecker. It is based on a local instance of LT.
As it is a Java based framework, this binding will use
[node-jre](https://github.com/schreiben/node-jre/), which provides an embedded
local Java Runtime Engine.

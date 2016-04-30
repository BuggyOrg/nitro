#!/usr/bin/env node

import program from 'commander'
import graphlib from 'graphlib'
import getStdin from 'get-stdin'
import fs from 'fs'
import path from 'path'
import { rewriteConstants } from './constrewrite'
import cleanupCompounds from './cleanupCompounds'

program
  .version(JSON.parse(fs.readFileSync(path.join(__dirname, '/../package.json')))['version'])
  .option('-f, --graphfile <graph file>', 'Set graph file to parse. If none is given stdin is read')
  .option('-o, --out <graph output file>', 'Set a custom output file. If none is given, stdout is used.')
  .parse(process.argv)

let getInput = program.graphfile ? Promise.resolve(fs.readFileSync(program.graphfile, 'utf8')) : getStdin()

getInput
  .then((serializedGraph) => {
    let graph = graphlib.json.read(JSON.parse(serializedGraph))
    rewriteConstants(graph)
    cleanupCompounds(graph)
    rewriteConstants(graph)

    if (program.out) {
      fs.writeFileSync(program.out, JSON.stringify(graphlib.json.write(graph)), 'utf8')
    } else {
      process.stdout.write(JSON.stringify(graphlib.json.write(graph)))
    }
  })
  .catch((e) => console.error(e))

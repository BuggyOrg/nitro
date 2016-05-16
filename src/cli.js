#!/usr/bin/env node

import program from 'commander'
import graphlib from 'graphlib'
import getStdin from 'get-stdin'
import fs from 'fs'
import path from 'path'
import _ from 'lodash'
import cleanupCompounds from './cleanupCompounds'
import rewriteRules from './rewrite/rules/index'

program
  .version(JSON.parse(fs.readFileSync(path.join(__dirname, '/../package.json')))['version'])
  .option('-f, --graphfile <graph file>', 'Set graph file to parse. If none is given stdin is read')
  .option('-o, --out <graph output file>', 'Set a custom output file. If none is given, stdout is used.')
  .option('-i, --include-intermediate', 'Print an array of all intermediate graphs.')
  .parse(process.argv)

let getInput = program.graphfile ? Promise.resolve(fs.readFileSync(program.graphfile, 'utf8')) : getStdin()

getInput
  .then((serializedGraph) => {
    let graph = graphlib.json.read(JSON.parse(serializedGraph))
    let rewriteFunctions = [ ...rewriteRules, cleanupCompounds ]

    if (program.includeIntermediate) {
      let out
      if (program.out) {
        out = fs.createWriteStream(program.out)
      } else {
        out = process.stdout
      }

      const printGraph = (() => {
        let first = true
        return (graph) => {
          if (!first) {
            out.write(',')
          }
          out.write(JSON.stringify(graph))
          first = false
        }
      })()

      let previousGraph
      let newGraph = graphlib.json.write(graph)
      out.write('[')
      printGraph(newGraph)
      do {
        previousGraph = newGraph
        rewriteFunctions.forEach(f => {
          const graphBeforeRewrite = graphlib.json.write(graph)
          f(graph)
          const graphAfterRewrite = graphlib.json.write(graph)

          if (!_.isEqual(graphBeforeRewrite, graphAfterRewrite)) {
            printGraph(graphAfterRewrite)
          }
        })
        newGraph = graphlib.json.write(graph)
      } while (!_.isEqual(newGraph, previousGraph))
      out.write(']\n')
      if (out !== process.stdout) {
        out.end()
      }
    } else {
      let previousGraph
      let newGraph = graphlib.json.write(graph)
      do {
        previousGraph = newGraph
        rewriteFunctions.forEach(f => {
          f(graph)
        })
        newGraph = graphlib.json.write(graph)
      } while (!_.isEqual(newGraph, previousGraph))

      if (program.out) {
        fs.writeFileSync(program.out, JSON.stringify(graphlib.json.write(graph)), 'utf8')
      } else {
        process.stdout.write(JSON.stringify(graphlib.json.write(graph)))
      }
    }
  })
  .catch((e) => console.log(e, e.stack.split('\n')))

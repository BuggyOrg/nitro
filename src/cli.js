#!/usr/bin/env node

import program from 'commander'
import graphlib from 'graphlib'
import getStdin from 'get-stdin'
import fs from 'fs'
import path from 'path'
import rewriteRules from './rewrite/rules/index'
import { applyRules } from './rewrite/index'

program
  .version(JSON.parse(fs.readFileSync(path.join(__dirname, '/../package.json')))['version'])
  .option('-f, --graphfile <graph file>', 'Set graph file to parse. If none is given stdin is read')
  .option('-o, --out <graph output file>', 'Set a custom output file. If none is given, stdout is used.')
  .option('-i, --include-intermediate', 'Print an array of all intermediate graphs.')
  .option('--stats', 'Print stats to stderr after optimizing the graph.')
  .parse(process.argv)

let getInput = program.graphfile ? Promise.resolve(fs.readFileSync(program.graphfile, 'utf8')) : getStdin()

getInput
  .then((serializedGraph) => {
    let graph = graphlib.json.read(JSON.parse(serializedGraph))
    let rewriteFunctions = [ ...rewriteRules ]

    let out
    if (program.out) {
      out = fs.createWriteStream(program.out)
    } else {
      out = process.stdout
    }

    if (program.includeIntermediate) {
      out.write('[', 'utf8')
      out.write(JSON.stringify({ graph: graphlib.json.write(graph) }), 'utf8')
    }

    const { newGraph, stats } = applyRules(graph, rewriteFunctions, {
      onRuleApplied: program.includeIntermediate ? (rule, graph) => {
        out.write(',' + JSON.stringify({ transition: { label: rule }, graph: graphlib.json.write(graph) }), 'utf8')
      } : null
    })

    if (program.includeIntermediate) {
      out.write(']\n', 'utf8')
    } else {
      out.write(`${JSON.stringify(newGraph)}\n`, 'utf8')
    }
    if (out !== process.stdout) {
      out.end()
    }

    if (program.stats) {
      console.error('\n📈  Statistics:')
      console.error(`rules applied: ${stats.appliedRules}`)
      console.error(`nodes: ${stats.finalNodes} (${(stats.finalNodes / stats.initialNodes * 100).toFixed(1)}%), Δ=${stats.finalNodes - stats.initialNodes}`)
      console.error(`edges: ${stats.finalEdges} (${(stats.finalEdges / stats.initialEdges * 100).toFixed(1)}%), Δ=${stats.finalEdges - stats.initialEdges}`)
    }
  })
  .catch((e) => console.log(e, e.stack.split('\n')))

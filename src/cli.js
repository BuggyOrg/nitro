#!/usr/bin/env node

import program from 'commander'
import graphlib from 'graphlib'
import getStdin from 'get-stdin'
import fs from 'fs'
import path from 'path'
import { optimize as optimizeGraph } from './api'

program
  .version(JSON.parse(fs.readFileSync(path.join(__dirname, '/../package.json')))['version'])
  .option('-f, --graphfile <graph file>', 'Set graph file to parse. If none is given stdin is read.')
  .option('-o, --out <graph output file>', 'Set a custom output file. If none is given, stdout is used.')
  .option('-i, --include-intermediate', 'Print an array of all intermediate graphs.')
  .option('--stats', 'Print stats to stderr after optimizing the graph.')
  .option('-v, --verbose', 'Prints verbose output to stderr during optimization.')
  .option('--keep-dead-code', 'Disable removal of unreachable code.')
  .parse(process.argv)

let getInput = program.graphfile ? Promise.resolve(fs.readFileSync(program.graphfile, 'utf8')) : getStdin()

getInput
  .then((serializedGraph) => {
    let graph = graphlib.json.read(JSON.parse(serializedGraph))

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

    const result = optimizeGraph(graph, {
      keepDeadCode: program.keepDeadCode,
      onRuleApplied: (rule, graph) => {
        if (program.includeIntermediate) {
          out.write(',' + JSON.stringify({ transition: { label: rule.name }, graph: graphlib.json.write(graph) }), 'utf8')
        }
        if (program.verbose) {
          if (rule.name === rule.id) {
            console.error(`Applied rule: ${rule.id}`)
          } else {
            console.error(`Applied rule: ${rule.name} (${rule.id})`)
          }
        }
      }
    })

    if (program.includeIntermediate) {
      out.write(']\n', 'utf8')
    } else {
      out.write(`${JSON.stringify(graphlib.json.write(result.graph))}\n`, 'utf8')
    }
    if (out !== process.stdout) {
      out.end()
    }

    if (program.stats) {
      const { stats } = result
      console.error('\n📈  Statistics:')
      console.error(`rules applied: ${stats.appliedRules}`)
      console.error(`nodes: ${stats.finalNodes} (${(stats.finalNodes / stats.initialNodes * 100).toFixed(1)}%), Δ=${stats.finalNodes - stats.initialNodes}`)
      console.error(`edges: ${stats.finalEdges} (${(stats.finalEdges / stats.initialEdges * 100).toFixed(1)}%), Δ=${stats.finalEdges - stats.initialEdges}`)
    }
  })
  .catch((e) => {
    console.error(e, e.stack.split('\n'))
    process.exit(1)
  })

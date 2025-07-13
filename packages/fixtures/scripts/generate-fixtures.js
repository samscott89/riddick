#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const FIXTURES_DIR = path.join(__dirname, '..', 'src', 'crates')
const RUST_PARSER_BIN = path.join(__dirname, '..', '..', '..', 'target', 'debug', 'rust-parser')

function findRustFiles(dir) {
  const results = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findRustFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.rs')) {
      results.push(fullPath)
    }
  }
  
  return results
}

function generateParsedOutput(rustFile, outputFile) {
  console.log(`Parsing ${rustFile} -> ${outputFile}`)
  
  try {
    const output = execSync(`"${RUST_PARSER_BIN}" "${rustFile}"`, { 
      encoding: 'utf8',
      cwd: path.join(__dirname, '..', '..', '..')
    })
    
    // Ensure output directory exists
    fs.mkdirSync(path.dirname(outputFile), { recursive: true })
    
    // Write parsed output
    fs.writeFileSync(outputFile, output)
    console.log(`  ✓ Generated ${outputFile}`)
  } catch (error) {
    console.error(`  ✗ Failed to parse ${rustFile}:`, error.message)
  }
}

function processCrate(crateName) {
  const crateDir = path.join(FIXTURES_DIR, crateName)
  
  // Find the extracted crate directory (e.g., rudy-parser-0.4.0)
  const entries = fs.readdirSync(crateDir, { withFileTypes: true })
  const extractedDir = entries.find(entry => 
    entry.isDirectory() && 
    entry.name.includes(crateName) && 
    entry.name !== 'parsed-outputs'
  )
  
  if (!extractedDir) {
    console.log(`No extracted directory found for ${crateName}`)
    return
  }
  
  const sourceDir = path.join(crateDir, extractedDir.name)
  const outputDir = path.join(crateDir, `${extractedDir.name}-parsed`)
  
  console.log(`Processing crate: ${crateName}`)
  console.log(`  Source: ${sourceDir}`)
  console.log(`  Output: ${outputDir}`)
  
  // Find all .rs files
  const rustFiles = findRustFiles(sourceDir)
  
  for (const rustFile of rustFiles) {
    // Calculate relative path from source dir
    const relativePath = path.relative(sourceDir, rustFile)
    // Create corresponding output path with .json extension
    const outputFile = path.join(outputDir, relativePath + '.json')
    
    generateParsedOutput(rustFile, outputFile)
  }
  
  console.log(`Finished processing ${crateName}\n`)
}

function main() {
  // Check if rust-parser binary exists
  if (!fs.existsSync(RUST_PARSER_BIN)) {
    console.error(`Rust parser binary not found at: ${RUST_PARSER_BIN}`)
    console.error('Please run: cargo build --bin rust-parser')
    process.exit(1)
  }
  
  // Get list of crates to process
  const crates = fs.readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
  
  console.log(`Found crates: ${crates.join(', ')}\n`)
  
  for (const crate of crates) {
    processCrate(crate)
  }
  
  console.log('✅ All fixtures generated!')
}

if (require.main === module) {
  main()
}
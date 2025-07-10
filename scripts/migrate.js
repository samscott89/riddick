#!/usr/bin/env node

const { execSync } = require('child_process')
const path = require('path')

const isProduction = process.argv.includes('--production')
const environment = isProduction ? 'production' : 'development'

console.log(`Running migrations for ${environment}...`)

try {
  if (isProduction) {
    // Run migrations on production D1 database
    execSync('npx wrangler d1 migrations apply riddick-db-production --env production', {
      stdio: 'inherit',
      cwd: process.cwd()
    })
  } else {
    // Run migrations on local D1 database
    execSync('npx wrangler d1 migrations apply riddick-db --local', {
      stdio: 'inherit',
      cwd: process.cwd()
    })
  }
  
  console.log(`✓ Migrations completed for ${environment}`)
} catch (error) {
  console.error(`✗ Migration failed for ${environment}:`, error.message)
  process.exit(1)
}
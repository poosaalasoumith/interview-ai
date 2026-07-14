const fs = require('fs');
const path = require('path');

// Helper to recursively list all files matching a filter
function walk(dir, filter, filelist = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        walk(filepath, filter, filelist);
      }
    } else if (filter(file, filepath)) {
      filelist.push(filepath);
    }
  }
  return filelist;
}

// Main logic
function validate() {
  console.log('[Route Manifest Validator] Starting route synchronization audit...');

  // 1. Read and parse RoutesConfig from src/lib/routes.ts
  const routesFilePath = path.join(__dirname, '..', 'src', 'lib', 'routes.ts');
  if (!fs.existsSync(routesFilePath)) {
    console.error(`[Error] Routes definition file not found at: ${routesFilePath}`);
    process.exit(1);
  }

  const routesContent = fs.readFileSync(routesFilePath, 'utf8');
  
  // Extract RoutesConfig definition using regex
  const configMatch = routesContent.match(/export const RoutesConfig = \{([\s\S]*?)\}\s*as const;/);
  if (!configMatch) {
    console.error('[Error] Could not parse RoutesConfig from src/lib/routes.ts');
    process.exit(1);
  }

  // Parse key-value pairs
  const registeredRoutes = [];
  const lines = configMatch[1].split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;
    
    // Match "key: "value"," or 'key: "value"' or similar
    const match = trimmed.match(/^([a-zA-Z0-9_-]+)\s*:\s*["']([^"']+)["']/);
    if (match) {
      registeredRoutes.push({ key: match[1], path: match[2] });
    }
  }

  // 2. Scan src/app for all page.tsx files
  const appDir = path.join(__dirname, '..', 'src', 'app');
  if (!fs.existsSync(appDir)) {
    console.error(`[Error] App router directory not found at: ${appDir}`);
    process.exit(1);
  }

  const pageFiles = walk(appDir, (file) => file === 'page.tsx');
  
  // 3. Normalize page files into route patterns
  const actualRoutes = pageFiles.map((filepath) => {
    // Relative path from src/app
    let relative = path.relative(appDir, filepath);
    // Replace backslashes for Windows
    relative = relative.replace(/\\/g, '/');
    
    // Remove '/page.tsx' or 'page.tsx'
    let routePath = relative.replace(/\/page\.tsx$/, '').replace(/^page\.tsx$/, '');
    
    // Split and filter out route groups e.g. (auth)
    const segments = routePath.split('/').filter(Boolean);
    const cleanedSegments = segments.filter(seg => !seg.startsWith('(') || !seg.endsWith(')'));
    
    return '/' + cleanedSegments.join('/');
  });

  // Unique list of actual routes
  const actualRoutesSet = new Set(actualRoutes);
  const registeredRoutesPaths = registeredRoutes.map(r => r.path);
  const registeredRoutesSet = new Set(registeredRoutesPaths);

  let errorsFound = false;

  // Check A: page exists but isn't registered
  for (const actualRoute of actualRoutes) {
    // Skip checking API and special paths
    if (actualRoute.startsWith('/api') || actualRoute.startsWith('/auth/callback')) continue;
    
    if (!registeredRoutesSet.has(actualRoute)) {
      console.error(`\x1b[31m[Error] Unregistered Route: A page file exists at '${actualRoute}' but is not registered in RoutesConfig.\x1b[0m`);
      errorsFound = true;
    }
  }

  // Check B: registered route has no page
  for (const registered of registeredRoutes) {
    // Skip special virtual or dynamic paths if needed, but they all should have page files
    if (!actualRoutesSet.has(registered.path)) {
      console.error(`\x1b[31m[Error] Missing Route File: '${registered.path}' (${registered.key}) is registered in RoutesConfig but no corresponding page.tsx file was found.\x1b[0m`);
      errorsFound = true;
    }
  }

  if (errorsFound) {
    console.error('\x1b[31m[Route Manifest Validator] Audit FAILED. Build blocked.\x1b[0m');
    process.exit(1);
  } else {
    console.log('\x1b[32m[Route Manifest Validator] Audit PASSED. All routes synchronized perfectly.\x1b[0m');
  }
}

validate();

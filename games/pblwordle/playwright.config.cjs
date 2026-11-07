const {defineConfig,devices}=require('@playwright/test');
const path=require('node:path');
module.exports=defineConfig({
  testDir:path.join(__dirname,'tests'),
  testMatch:'*.spec.cjs',
  outputDir:path.join(__dirname,'../../.tmp/pblwordle-tests'),
  workers:2,
  use:{baseURL:process.env.PBL_TEST_URL || 'http://127.0.0.1:4199/games/pblwordle/',trace:'retain-on-failure'},
  projects:[
    {name:'desktop',use:{...devices['Desktop Chrome'],launchOptions:process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}}},
    {name:'phone',use:{...devices['iPhone 13'],defaultBrowserType:'chromium',launchOptions:process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}}},
  ],
});

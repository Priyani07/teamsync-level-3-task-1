import {copyFileSync,existsSync,mkdirSync} from 'node:fs';
if(!existsSync('.env')) copyFileSync('.env.example','.env');
mkdirSync('data',{recursive:true});
console.log('Ready. Run npm run dev. Production: npm run build, then npm start.');

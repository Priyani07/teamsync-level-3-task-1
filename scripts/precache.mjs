import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const assets=readdirSync('dist/assets').map(name=>'/assets/'+name);
writeFileSync('dist/sw.js','self.TEAMSYNC_ASSETS='+JSON.stringify(assets)+';\n'+readFileSync('public/sw.js','utf8').replace('teamsync-shell-v1','teamsync-shell-'+createHash('sha256').update(assets.join()).digest('hex').slice(0,12)));

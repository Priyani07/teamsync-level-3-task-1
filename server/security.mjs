import {scrypt as scryptCallback,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
export const opaque=()=>randomBytes(32).toString('hex');
export const digest=token=>createHash('sha256').update(token||'').digest('hex');
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');return salt+':'+(await scrypt(password,salt,64)).toString('hex')}
export async function verifyPassword(password,hash){const [salt,encoded]=hash.split(':');const given=await scrypt(password,salt,64);const expected=Buffer.from(encoded,'hex');return given.length===expected.length&&timingSafeEqual(given,expected)}
export function validateCredentials(body,register=false){if(typeof body.email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)||body.email.length>254)throw Object.assign(new Error('Enter a valid email address.'),{status:400});if(typeof body.password!=='string'||body.password.length>128||(register&&body.password.length<10))throw Object.assign(new Error('Password must contain 10–128 characters.'),{status:400});if(register&&(typeof body.name!=='string'||!body.name.trim()||body.name.length>60))throw Object.assign(new Error('Enter a name (up to 60 characters).'),{status:400})}
export function fail(status,message){throw Object.assign(new Error(message),{status})}

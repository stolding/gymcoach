import { readFileSync, writeFileSync } from 'node:fs';
const j = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const data = j.data || j.result?.data;
if (!data) throw new Error('geen png-data');
writeFileSync(process.argv[3], Buffer.from(data, 'base64'));

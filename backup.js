// Back-up van GymCoach: database (consistente kopie, ook tijdens draaien) + Speediance-logins.
// Gebruik: node backup.js [map]   (standaard ./backups)
import { mkdir, rm, chmod } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { DATA_DIR, backupTo } from './lib/store.js';

const outDir = path.resolve(process.argv[2] || 'backups');
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const work = path.join(outDir, `gymcoach-${stamp}`);
await mkdir(work, { recursive: true, mode: 0o700 });
backupTo(path.join(work, 'gymcoach.db'));
execFileSync('tar', ['-czf', `${work}.tar.gz`, '-C', work, 'gymcoach.db', '-C', DATA_DIR, '--ignore-failed-read', 'users']);
await chmod(`${work}.tar.gz`, 0o600);
await rm(work, { recursive: true });
console.log(`Back-up gemaakt: ${work}.tar.gz`);
console.log('Terugzetten: stop de dienst, pak uit in data/ en start opnieuw.');

// Herberekent de gezondheidsscore van elke gebruiker, bijvoorbeeld na een nieuwe norms_version.
import * as store from '../lib/store.js';
import { rebuild } from '../lib/scores.js';

const users = await store.getUsers();
for (const user of users) {
  const rows = await store.runAs(user, () => rebuild());
  console.log(`${user.username}: ${rows.length}`);
}

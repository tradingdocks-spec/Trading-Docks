// The original aliasing demonstration is preserved in p0/original-reproduce-csv-location.mjs.
// Exercise the active import API, its real SQL, location assignment, and replay.
import { reproduceCsvLocation } from '../tests/helpers/p0-reproductions.mjs';
console.log(JSON.stringify(await reproduceCsvLocation(), null, 2));

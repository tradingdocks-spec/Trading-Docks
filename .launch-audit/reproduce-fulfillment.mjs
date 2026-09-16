// The original defect-asserting script is preserved in p0/original-reproduce-fulfillment.mjs.
// Exercise the fixed production route with a real database write failure.
import { reproduceFulfillment } from '../tests/helpers/p0-reproductions.mjs';
console.log(JSON.stringify(await reproduceFulfillment(), null, 2));

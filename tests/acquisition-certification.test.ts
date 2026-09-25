import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyAcquisitionWriteDecision} from '../src/lib/purchase-history/legacy-gate.ts';
import {createPurchaseLedgerRecord,purchaseRecordFromRow} from '../src/lib/purchase-history/server.ts';

test('legacy finance writer is gated before any independent database insert',async()=>{
 const result=await createPurchaseLedgerRecord({supabase:{from(){throw Error('must not write');}},access:{} as never,userId:'fixture',purchase:{} as never});
 assert.equal(result.error?.code,'ACQUISITION_WORKFLOW_REQUIRED');
 assert.equal(legacyAcquisitionWriteDecision().allowed,false);
});
test('missing historical purchase date remains unknown rather than current time',()=>{
 assert.equal(purchaseRecordFromRow({id:'historical'}).purchasedAt,'');
});

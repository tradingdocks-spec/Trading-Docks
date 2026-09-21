import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const migration = readFileSync('supabase/migrations/20260921154907_inventory_identity_trusted_backfill.sql','utf8');
export async function verifyIdentityBackfill({admin,a,stranger,other,check}) {
  await a.query("update inventory_items set set_code='lea' where id='bolt'");
  await stranger.query("insert into inventory_items(id,user_id,card_name,set_code,quantity) values('identity-other',$1,'Other','lea',1)",[other]);
  const guard = async () => (await admin.query("select pg_get_functiondef('public.enforce_collector_inventory_mutation()'::regprocedure) d")).rows[0].d;
  const original = await guard();
  await check('trusted path rejects an attempted ownership reassignment',async()=>{
    const tampered=migration.replace("update public.inventory_items i set game_id=",`update public.inventory_items i set user_id='${other}',game_id=`);
    await assert.rejects(admin.query(tampered),/TD_COLLECTOR_UNAUTHORIZED/);
    assert.equal(await guard(),original);
  });
  await check('identity migration cannot be invoked under browser role',async()=>{
    await assert.rejects(a.query(migration),/permission denied|must be owner|TRUSTED_DATABASE/);
  });
  await check('trusted identity backfill preserves all nonidentity row fields and tenants',async()=>{
    const before=(await admin.query('select to_jsonb(i) row from inventory_items i order by user_id,id')).rows;
    await admin.query(migration);
    const after=(await admin.query('select to_jsonb(i) row from inventory_items i order by user_id,id')).rows;
    assert.equal(after.length,before.length);
    for(let i=0;i<before.length;i++) {
      assert.equal(after[i].row.game_id,'magic'); assert.equal(after[i].row.product_type,'card');
      for(const [k,v] of Object.entries(before[i].row)) {
        if(!['game_id','product_type','provider_category_id'].includes(k)) assert.deepEqual(after[i].row[k],v,k);
      }
    }
    assert.equal(await guard(),original);
    assert.equal((await admin.query("select to_regclass('pg_temp.inventory_identity_backfill_rows') r")).rows[0].r,null);
  });
  await check('ordinary unauthorized collector writes still raise exact authorization error',async()=>{
    await assert.rejects(admin.query("update inventory_items set card_name='Unauthorized' where id='bolt'"),/TD_COLLECTOR_UNAUTHORIZED/);
    await admin.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
    try { await assert.rejects(admin.query("update inventory_items set card_name='Cross tenant' where id='bolt'"),/TD_COLLECTOR_UNAUTHORIZED/); }
    finally { await admin.query("select set_config('request.jwt.claim.sub','',false)"); }
  });
  await check('owner writes work and cross-tenant API updates affect zero rows',async()=>{
    await a.query("update inventory_items set card_name='Lightning Bolt' where id='bolt'");
    assert.equal((await stranger.query("update inventory_items set card_name='Attack' where id='bolt' returning id")).rowCount,0);
    await assert.rejects(stranger.query('select * from pg_temp.inventory_identity_backfill_rows'),/does not exist|permission denied/);
  });
  await check('forward identity repair is idempotent and leaves no migration mode',async()=>{
    await admin.query(migration); assert.equal(await guard(),original);
    await assert.rejects(admin.query("update inventory_items set game_id='pokemon' where id='bolt'"),/TD_COLLECTOR_UNAUTHORIZED/);
  });
  await stranger.query("delete from inventory_items where id='identity-other'");
}

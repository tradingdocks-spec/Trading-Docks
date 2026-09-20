import assert from 'node:assert/strict';

// Audit regression only: exercise the accepted owner-only architecture, without
// changing its production authorization functions or grants.
export async function verifyStaffingBoundary({ admin, staff, owner, other, workspace, setup, request, command, check }) {
  await admin.query("insert into workspace_members values($1,$2,'employee')", [workspace, other]);
  try {
    await check('invited employee role cannot currently enter POS', async () => {
      await assert.rejects(command(staff, 'bootstrap'), /POS_FORBIDDEN/);
    });
    await admin.query("update workspace_members set role='manager' where workspace_id=$1 and user_id=$2", [workspace, other]);
    await check('same-workspace manager cannot operate another inventory owner register', async () => {
      const bootstrap = await command(staff, 'bootstrap');
      assert.deepEqual(bootstrap.sites, []);
      assert.deepEqual(bootstrap.registers, []);
      await assert.rejects(command(staff, 'open', { registerId: setup.registerId }), /POS_FORBIDDEN/);
      await assert.rejects(command(staff, 'checkout', request()), /POS_FORBIDDEN/);
    });
    await check('canonical trigger rejects foreign-owner mutation even with SQL RLS bypass', async () => {
      const before = (await admin.query("select quantity from inventory_items where user_id=$1 and id='bolt'", [owner])).rows[0].quantity;
      // The privileged local fixture connection isolates the trigger from RLS.
      // Its auth.uid() remains the real manager, as in a SECURITY DEFINER RPC.
      await admin.query('begin');
      try {
        await admin.query("select set_config('request.jwt.claim.sub',$1,true)", [other]);
        // The existing service fallback cannot override an authenticated actor.
        await admin.query("select set_config('app.collector_authorized_user_id',$1,true)", [owner]);
        await assert.rejects(admin.query("update inventory_items set quantity=quantity-1 where user_id=$1 and id='bolt'", [owner]), /TD_COLLECTOR_UNAUTHORIZED/);
      } finally {
        await admin.query('rollback');
      }
      assert.equal((await admin.query("select quantity from inventory_items where user_id=$1 and id='bolt'", [owner])).rows[0].quantity, before);
      assert.equal((await admin.query('select count(*)::int n from pos_sales')).rows[0].n, 0);
    });
  } finally {
    await admin.query('delete from workspace_members where workspace_id=$1 and user_id=$2', [workspace, other]);
  }
}

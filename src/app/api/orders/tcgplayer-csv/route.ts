import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function rows(csv: string) {
  const out: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i=0;i<csv.length;i++) { const c=csv[i]; if(c==='"' && quoted && csv[i+1]==='"'){cell+='"';i++;} else if(c==='"') quoted=!quoted; else if(c===','&&!quoted){row.push(cell);cell="";} else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&csv[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))out.push(row);row=[];cell="";} else cell+=c; }
  row.push(cell); if(row.some(Boolean)) out.push(row); return out;
}
const key = (v:string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function POST(request: Request) {
  const supabase = await createClient(); const { data:{user} } = await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Authentication required."},{status:401});
  const body=await request.json().catch(()=>null) as {csv?:string}|null; const parsed=rows(String(body?.csv??""));
  if(parsed.length<2) return NextResponse.json({error:"The CSV does not contain order rows."},{status:400});
  const headers=parsed[0].map(key); const pick=(r:string[],names:string[])=>{const i=headers.findIndex(h=>names.includes(h));return i>=0?r[i]?.trim()??"":"";};
  const grouped=new Map<string,string[][]>(); for(const r of parsed.slice(1)){const id=pick(r,["orderid","ordernumber","order#"]);if(id)grouped.set(id,[...(grouped.get(id)??[]),r]);}
  const batch=crypto.randomUUID(); let imported=0; let skipped=0;
  for(const [orderId,lines] of grouped){const first=lines[0]; const total=lines.reduce((n,r)=>n+(Number(pick(r,["ordertotal","total","price"]))||0),0); const date=pick(first,["orderdate","date","orderedat"]);
    const {data:order,error}=await supabase.from("marketplace_orders").upsert({user_id:user.id,marketplace_id:"tcgplayer",external_order_id:orderId,normalized_status:"new",currency:"USD",total,buyer_alias:pick(first,["buyer","buyername","customer"]),ordered_at:date?new Date(date).toISOString():new Date().toISOString(),source_type:"csv",import_batch_id:batch,raw_snapshot:{source:"tcgplayer_csv"}},{onConflict:"user_id,marketplace_id,external_order_id"}).select("id").single();
    if(error||!order){skipped++;continue;} let lineNo=0; for(const r of lines){lineNo++; const title=pick(r,["productname","cardname","name","product"]); if(!title)continue; await supabase.from("marketplace_order_items").upsert({user_id:user.id,marketplace_order_id:order.id,external_line_item_id:pick(r,["lineitemid","productid","sku"])||`${orderId}-${lineNo}`,external_sku:pick(r,["sku","productid"]),title,quantity:Math.max(1,Number(pick(r,["quantity","qty"]))||1),unit_price:Number(pick(r,["unitprice","price"]))||0,condition:pick(r,["condition"]),finish:pick(r,["printing","finish"]),language:pick(r,["language"])||"English",currency:"USD",match_status:"unmatched",raw_snapshot:{source:"tcgplayer_csv"}},{onConflict:"user_id,marketplace_order_id,external_line_item_id"});} imported++; }
  return NextResponse.json({imported,skipped,batch});
}

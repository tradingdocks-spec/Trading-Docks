import { squareAccounts } from "@/lib/pos/payments/square/server";
import { squareWebhook } from "@/lib/pos/payments/square/webhook";
export const runtime="nodejs";
export async function POST(request: Request) {
  try {
    const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400});
    const chunks: Uint8Array[]=[];let size=0;
    for(;;) {const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1048576){await reader.cancel();return new Response(null,{status:413});}chunks.push(value);}
    await squareWebhook(squareAccounts(),Buffer.concat(chunks),request.headers.get("x-square-hmacsha256-signature")??"");
    return new Response(null,{status:200});
  } catch(e) {return new Response(null,{status:e instanceof Error&&e.message==="WEBHOOK_SIGNATURE_INVALID"?403:503});}
}

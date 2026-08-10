import { NextResponse } from "next/server";
import { requireApiCapability } from "@/lib/platform/server-access";

export async function GET(){
  const capability = await requireApiCapability("orders.manage");
  if (!capability.ok) return capability.response;const supabase=capability.supabase;const id=capability.access.workspaceId;if(!id)return NextResponse.json({messages:[]});const{data,error}=await supabase.from("inbound_email_messages").select("id,subject,sender,marketplace_id,message_type,processing_status,processing_error,received_at").eq("workspace_id",id).in("processing_status",["needs_review","failed","unsupported"]).order("received_at",{ascending:false}).limit(100);if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({messages:data??[]});}
export async function PATCH(request:Request){
  const capability = await requireApiCapability("orders.manage");
  if (!capability.ok) return capability.response;const supabase=capability.supabase;const id=capability.access.workspaceId;const body=await request.json().catch(()=>null)as{id?:string;action?:string}|null;if(!id||!body?.id)return NextResponse.json({error:"Message not found."},{status:404});const status=body.action==="dismiss"?"unsupported":"needs_review";const{error}=await supabase.from("inbound_email_messages").update({processing_status:status,processing_error:body.action==="retry"?null:"Dismissed by user"}).eq("id",body.id).eq("workspace_id",id);if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({ok:true});}

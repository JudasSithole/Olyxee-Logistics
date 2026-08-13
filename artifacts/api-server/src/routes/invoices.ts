import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db, invoicesTable, ordersTable, customersTable, businessesTable, auditLogsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { generateId } from "../lib/id";
import { canConfirmInvoicePaid } from "../lib/invoice-workflow";
import { sendInvoiceEmail } from "../lib/email";

const router = Router();
const InvoiceBody = z.object({
  orderId: z.string().min(1), subtotal: z.string().min(1),
  additionalCharges: z.string().default("0"), currency: z.string().length(3).default("ZAR"),
  dueDate: z.coerce.date().optional().nullable(), notes: z.string().max(5000).optional().nullable(),
});
function invoiceNumber() { return `INV-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${generateId().slice(0,6).toUpperCase()}`; }
function serialize(row:any) { return Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v instanceof Date?v.toISOString():v])); }

router.get("/invoices", requireAuth, async (req,res) => {
  const businessId=(req as any).businessId; const conditions:any[]=[eq(invoicesTable.businessId,businessId)];
  if(req.query.customerId)conditions.push(eq(invoicesTable.customerId,String(req.query.customerId)));
  if(req.query.orderId)conditions.push(eq(invoicesTable.orderId,String(req.query.orderId)));
  const rows=await db.select({
    invoice: invoicesTable,
    trackingId: ordersTable.trackingId,
    orderReference: ordersTable.orderReference,
    customerName: customersTable.fullName,
  }).from(invoicesTable)
    .leftJoin(ordersTable, eq(invoicesTable.orderId, ordersTable.id))
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .where(and(...conditions)).orderBy(desc(invoicesTable.createdAt));
  res.json({data:rows.map(({invoice,...related})=>({...serialize(invoice),...related})),total:rows.length});
});

router.post("/invoices", requireAuth, async (req,res) => {
  try {
    const parsed=InvoiceBody.safeParse(req.body); if(!parsed.success){res.status(400).json({error:"Invalid input",details:parsed.error.issues});return;}
    const businessId=(req as any).businessId,userId=(req as any).userId;
    const order=await db.query.ordersTable.findFirst({where:and(eq(ordersTable.id,parsed.data.orderId),eq(ordersTable.businessId,businessId))});
    if(!order){res.status(404).json({error:"Order not found"});return;}
    const existing=await db.query.invoicesTable.findFirst({where:and(eq(invoicesTable.orderId,order.id),eq(invoicesTable.businessId,businessId))});
    if(existing){res.status(409).json({error:"This order already has an invoice",invoiceId:existing.id});return;}
    const subtotal=Number(parsed.data.subtotal),additional=Number(parsed.data.additionalCharges);
    if(!Number.isFinite(subtotal)||!Number.isFinite(additional)||subtotal<0||additional<0){res.status(400).json({error:"Amounts must be non-negative numbers"});return;}
    const invoice=await db.transaction(async tx=>{
      const [created]=await tx.insert(invoicesTable).values({id:generateId(),businessId,invoiceNumber:invoiceNumber(),customerId:order.customerId,orderId:order.id,subtotal:parsed.data.subtotal,additionalCharges:parsed.data.additionalCharges,total:String(subtotal+additional),currency:parsed.data.currency.toUpperCase(),dueDate:parsed.data.dueDate,notes:parsed.data.notes}).returning();
      await tx.update(ordersTable).set({invoiceId:created.id,updatedAt:new Date()}).where(and(eq(ordersTable.id,order.id),eq(ordersTable.businessId,businessId)));
      await tx.insert(auditLogsTable).values({id:generateId(),businessId,userId,action:"CREATE_INVOICE",entityType:"invoice",entityId:created.id,metadata:{orderId:order.id,invoiceNumber:created.invoiceNumber}});
      return created;
    });
    res.status(201).json(serialize(invoice));
  } catch(err){req.log.error({err},"Create invoice failed");res.status((err as any)?.code==="23505"?409:500).json({error:(err as any)?.code==="23505"?"This order already has an invoice":"Internal server error"});}
});

router.get("/invoices/:invoiceId",requireAuth,async(req,res)=>{
  const businessId=(req as any).businessId;const invoice=await db.query.invoicesTable.findFirst({where:and(eq(invoicesTable.id,String(req.params.invoiceId)),eq(invoicesTable.businessId,businessId))});
  if(!invoice){res.status(404).json({error:"Invoice not found"});return;}
  const [order,customer,business]=await Promise.all([
    db.query.ordersTable.findFirst({where:and(eq(ordersTable.id,invoice.orderId),eq(ordersTable.businessId,businessId))}),
    db.query.customersTable.findFirst({where:and(eq(customersTable.id,invoice.customerId),eq(customersTable.businessId,businessId))}),
    db.query.businessesTable.findFirst({where:eq(businessesTable.id,businessId)}),
  ]);
  res.json({...serialize(invoice),order:order?serialize(order):null,customer:customer?serialize(customer):null,business:business?serialize(business):null});
});
router.post("/invoices/:invoiceId/send",requireAuth,async(req,res)=>{
  const businessId=(req as any).businessId,userId=(req as any).userId,id=String(req.params.invoiceId);
  const invoice=await db.query.invoicesTable.findFirst({where:and(eq(invoicesTable.id,id),eq(invoicesTable.businessId,businessId))});
  if(!invoice){res.status(404).json({error:"Invoice not found"});return;}
  const [order,customer,business]=await Promise.all([
    db.query.ordersTable.findFirst({where:and(eq(ordersTable.id,invoice.orderId),eq(ordersTable.businessId,businessId))}),
    db.query.customersTable.findFirst({where:and(eq(customersTable.id,invoice.customerId),eq(customersTable.businessId,businessId))}),
    db.query.businessesTable.findFirst({where:eq(businessesTable.id,businessId)}),
  ]);
  if(!order||!customer||!business){res.status(409).json({error:"Invoice customer or order details are incomplete"});return;}
  const sent=await sendInvoiceEmail({customerEmail:customer.email,customerName:customer.fullName,customerAddress:customer.address,invoiceNumber:invoice.invoiceNumber,createdAt:invoice.createdAt,dueDate:invoice.dueDate??invoice.createdAt,description:order.cargoType||order.description||"Cross-border logistics service",serviceDetails:[order.transportMode?`${order.transportMode} FREIGHT`:null,order.serviceRequired,order.weight].filter(Boolean).join(" | "),quantity:1,subtotal:Number(invoice.subtotal),additionalCharges:Number(invoice.additionalCharges),total:Number(invoice.total),currency:invoice.currency,businessName:business.name,supportEmail:business.supportEmail,businessPhone:business.phone,businessAddress:business.location,logoUrl:business.businessLogoUrl});
  if(!sent.success){res.status(502).json({error:sent.error||"Invoice email failed"});return;}
  const now=new Date();const [updated]=await db.update(invoicesTable).set({status:"sent",sentAt:now,updatedAt:now}).where(and(eq(invoicesTable.id,id),eq(invoicesTable.businessId,businessId))).returning();
  await db.insert(auditLogsTable).values({id:generateId(),businessId,userId,action:"SEND_INVOICE",entityType:"invoice",entityId:id,metadata:{orderId:invoice.orderId,messageId:sent.messageId,customerEmail:customer.email}});
  res.json(serialize(updated));
});
router.post("/invoices/:invoiceId/pay",requireAuth,async(req,res)=>updateStatus(req,res,"paid"));
async function updateStatus(req:any,res:any,status:"sent"|"paid"){
  const businessId=req.businessId,userId=req.userId,id=String(req.params.invoiceId);
  const invoice=await db.query.invoicesTable.findFirst({where:and(eq(invoicesTable.id,id),eq(invoicesTable.businessId,businessId))});
  if(!invoice){res.status(404).json({error:"Invoice not found"});return;}
  if(invoice.status==="cancelled"||(status==="paid"&&!canConfirmInvoicePaid(invoice.status))){res.status(409).json({error:`Cannot mark ${invoice.status} invoice as ${status}`});return;}
  const now=new Date();const [updated]=await db.update(invoicesTable).set({status,sentAt:status==="sent"?now:invoice.sentAt,paidAt:status==="paid"?now:invoice.paidAt,paymentConfirmedBy:status==="paid"?userId:invoice.paymentConfirmedBy,updatedAt:now}).where(and(eq(invoicesTable.id,id),eq(invoicesTable.businessId,businessId))).returning();
  await db.insert(auditLogsTable).values({id:generateId(),businessId,userId,action:status==="paid"?"CONFIRM_INVOICE_PAYMENT":"SEND_INVOICE",entityType:"invoice",entityId:id,metadata:{orderId:invoice.orderId,previousStatus:invoice.status,newStatus:status}});
  res.json(serialize(updated));
}
export default router;

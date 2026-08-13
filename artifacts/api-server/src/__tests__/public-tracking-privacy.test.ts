import { expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const order = {
  id: "o1", businessId: "biz-secret", customerId: "customer-secret",
  invoiceId: "invoice-secret", trackingId: "OLY-ABC-2345",
  orderReference: "ORD-1", supplierTrackingNumber: "COURIER-SECRET",
  currentStatus: "RECEIVED_FROM_SUPPLIER", transportMode: "AIR",
  estimatedDeliveryDate: null, createdAt: new Date(), updatedAt: new Date(),
};
const events = [{ id:"e1", orderId:"o1", status:"RECEIVED_FROM_SUPPLIER", message:"Cargo received", location:"China", createdBy:"staff-secret", createdAt:new Date() }];
const mockDb:any = { query:{ ordersTable:{ findFirst:vi.fn().mockResolvedValue(order) } }, select:vi.fn(()=>({from:vi.fn(()=>({where:vi.fn(()=>({orderBy:vi.fn().mockResolvedValue(events)}))}))})) };
vi.mock("@workspace/db", async(importOriginal)=>({...(await importOriginal<any>()),db:mockDb}));

it("keeps customer, invoice, supplier and staff data out of public tracking", async () => {
  const app=express();app.use((await import("../routes/public-tracking")).default);
  const res=await request(app).get("/public/track/OLY-ABC-2345");
  expect(res.status).toBe(200);
  for (const privateField of ["businessId","customerId","invoiceId","supplierTrackingNumber","createdBy"]) {
    expect(JSON.stringify(res.body)).not.toContain(privateField);
  }
  expect(res.body.trackingId).toBe("OLY-ABC-2345");
  expect(res.body.currentStatus).toBe("RECEIVED_FROM_SUPPLIER");
});

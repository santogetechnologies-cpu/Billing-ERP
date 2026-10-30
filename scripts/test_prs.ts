import { purchaseRequestService } from '../src/services/purchaseRequestService';

async function main() {
  console.log('--- Testing purchaseRequestService.getPurchaseRequests() ---');
  const reqs = await purchaseRequestService.getPurchaseRequests(undefined, '00000000-0000-0000-0000-000000000001');
  console.log('Total purchase requests returned:', reqs.length);
  if (reqs.length > 0) {
    console.log('Sample purchase request:', reqs[0]);
    const withPO = reqs.filter(r => r.purchaseOrderNumber || r.purchaseOrderId);
    console.log('Requests with PO number / ID:', withPO.length);
  }
}

main().catch(console.error);
